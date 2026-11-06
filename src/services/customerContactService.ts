import { supabase, isSupabaseConfigured } from '../config/supabase';
import type { CustomerContact, CreateCustomerContactData, UpdateCustomerContactData, CustomerContactFilters } from '../types/customerContact';
import type { Customer } from '../types/invoice';

/**
 * Service class for Customer Contact Management.
 * Handles CRUD operations, primary role reassignment, soft deletes, and legacy contact syncing.
 */
class CustomerContactService {
  /**
   * Fetch all contacts for a specific customer
   */
  async getCustomerContacts(customerId: string, includeInactive: boolean = false): Promise<CustomerContact[]> {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured, returning empty contact array');
      return [];
    }

    let query = supabase
      .from('customer_contacts')
      .select('*')
      .eq('customer_id', customerId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.warn(`Error fetching contacts for customer ${customerId} (table may not be created yet):`, error);
      return [];
    }

    return data || [];
  }

  /**
   * Fetch contacts with custom filters (optional pagination)
   */
  async getContacts(filters?: CustomerContactFilters): Promise<CustomerContact[]> {
    if (!isSupabaseConfigured) return [];

    let query = supabase.from('customer_contacts').select('*');

    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }
    if (filters?.role) {
      query = query.eq('role', filters.role);
    }
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters?.search) {
      const s = `%${filters.search}%`;
      query = query.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s},job_title.ilike.${s}`);
    }

    const { data, error } = await query
      .order('is_primary', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching customer contacts:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Fetch a single contact by ID
   */
  async getCustomerContactById(id: string): Promise<CustomerContact | null> {
    if (!isSupabaseConfigured) return null;

    const { data, error } = await supabase
      .from('customer_contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error(`Error fetching contact ${id}:`, error);
      throw error;
    }

    return data;
  }

  /**
   * Create a new contact for a customer
   */
  async createCustomerContact(customerId: string, data: CreateCustomerContactData): Promise<CustomerContact> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    if (!data.name || !data.name.trim()) {
      throw new Error('Contact name is required');
    }

    // Check existing contacts to see if this is the first active contact
    const existingContacts = await this.getCustomerContacts(customerId, false);
    const isFirstContact = existingContacts.length === 0;
    const shouldBePrimary = data.is_primary === true || data.role === 'primary' || isFirstContact;

    // If setting as primary, unset is_primary on existing active contacts
    if (shouldBePrimary && existingContacts.length > 0) {
      await supabase
        .from('customer_contacts')
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq('customer_id', customerId)
        .eq('is_primary', true);
    }

    const payload = {
      customer_id: customerId,
      company_settings_id: data.company_settings_id || null,
      name: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      job_title: data.job_title?.trim() || null,
      role: shouldBePrimary ? ('primary' as const) : (data.role || 'secondary'),
      is_primary: shouldBePrimary,
      is_active: true,
      notes: data.notes?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newContact, error } = await supabase
      .from('customer_contacts')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating customer contact:', error);
      throw error;
    }

    // Sync primary contact details to parent customer record for backward compatibility
    if (shouldBePrimary) {
      await this.syncCustomerPrimaryContact(customerId, newContact);
    }

    return newContact;
  }

  /**
   * Update an existing contact
   */
  async updateCustomerContact(id: string, data: UpdateCustomerContactData): Promise<CustomerContact> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const currentContact = await this.getCustomerContactById(id);
    if (!currentContact) {
      throw new Error('Contact not found');
    }

    const shouldBePrimary = data.is_primary === true || data.role === 'primary';

    // If transitioning to Primary, clear primary status from other contacts of this customer
    if (shouldBePrimary && !currentContact.is_primary) {
      await supabase
        .from('customer_contacts')
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq('customer_id', currentContact.customer_id)
        .eq('is_primary', true);
    }

    const updates: Partial<CustomerContact> = {
      updated_at: new Date().toISOString()
    };

    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.email !== undefined) updates.email = data.email?.trim() || null;
    if (data.phone !== undefined) updates.phone = data.phone?.trim() || null;
    if (data.job_title !== undefined) updates.job_title = data.job_title?.trim() || null;
    if (data.role !== undefined) updates.role = data.role;
    if (data.is_primary !== undefined) updates.is_primary = data.is_primary;
    if (data.is_active !== undefined) updates.is_active = data.is_active;
    if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;

    if (shouldBePrimary) {
      updates.is_primary = true;
      updates.role = data.role || 'primary';
    }

    const { data: updatedContact, error } = await supabase
      .from('customer_contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating contact ${id}:`, error);
      throw error;
    }

    // Sync to parent customer if this contact is or became Primary
    if (updatedContact.is_primary) {
      await this.syncCustomerPrimaryContact(currentContact.customer_id, updatedContact);
    }

    return updatedContact;
  }

  /**
   * Delete or soft-delete a contact
   */
  async deleteCustomerContact(id: string, softDelete: boolean = true): Promise<boolean> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const contact = await this.getCustomerContactById(id);
    if (!contact) return false;

    const customerId = contact.customer_id;
    const wasPrimary = contact.is_primary;

    if (softDelete) {
      const { error } = await supabase
        .from('customer_contacts')
        .update({
          is_active: false,
          is_primary: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('customer_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }

    // If the deleted contact was primary, reassign primary status to the oldest remaining active contact
    if (wasPrimary) {
      const remainingContacts = await this.getCustomerContacts(customerId, false);
      if (remainingContacts.length > 0) {
        const newPrimary = remainingContacts[0];
        await this.setPrimaryContact(customerId, newPrimary.id);
      }
    }

    return true;
  }

  /**
   * Explicitly assign a contact as Primary for a customer
   */
  async setPrimaryContact(customerId: string, contactId: string): Promise<CustomerContact> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    // Unset primary flag on all contacts of this customer
    await supabase
      .from('customer_contacts')
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq('customer_id', customerId);

    // Set target contact as primary
    const { data: updatedContact, error } = await supabase
      .from('customer_contacts')
      .update({
        is_primary: true,
        role: 'primary',
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      console.error(`Error setting contact ${contactId} as primary:`, error);
      throw error;
    }

    // Sync to top-level customer fields
    await this.syncCustomerPrimaryContact(customerId, updatedContact);

    return updatedContact;
  }

  /**
   * Helper to sync primary contact details back to the parent customer record
   * for backward compatibility with existing invoice and quote generators.
   */
  private async syncCustomerPrimaryContact(customerId: string, contact: CustomerContact): Promise<void> {
    try {
      await supabase
        .from('customers')
        .update({
          contact_person: contact.name,
          email: contact.email || undefined,
          phone: contact.phone || undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId);
    } catch (err) {
      console.warn(`Failed to sync primary contact to parent customer ${customerId}:`, err);
    }
  }

  /**
   * Sync legacy customer contact details (contact_person, email, phone)
   * into customer_contacts table if no contacts exist yet for this customer.
   */
  async syncLegacyCustomerContact(customer: Customer): Promise<CustomerContact | null> {
    if (!isSupabaseConfigured || !customer.id) return null;

    try {
      const existingContacts = await this.getCustomerContacts(customer.id, true);
      if (existingContacts.length > 0) {
        return existingContacts.find(c => c.is_primary) || existingContacts[0];
      }

      // If customer has at least a contact_person, email, or phone
      if (customer.contact_person || customer.email || customer.phone) {
        const newContact = await this.createCustomerContact(customer.id, {
          customer_id: customer.id,
          company_settings_id: customer.company_settings_id,
          name: customer.contact_person?.trim() || customer.company_name || 'Primary Contact',
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          role: 'primary',
          is_primary: true,
          notes: 'Auto-created from legacy customer profile'
        });
        return newContact;
      }
    } catch (err) {
      console.warn(`Failed to sync legacy contact for customer ${customer.id}:`, err);
    }

    return null;
  }
}

export const customerContactService = new CustomerContactService();
