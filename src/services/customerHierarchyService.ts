import { supabase, isSupabaseConfigured } from '../config/supabase';
import type {
  CustomerRelationship,
  CreateCustomerRelationshipData,
  UpdateCustomerRelationshipData,
  CustomerRelationshipFilters,
  CustomerRelationshipType,
  ContactCustomerLink,
  CreateContactCustomerLinkData,
  UpdateContactCustomerLinkData,
  CustomerHierarchyNode,
} from '../types/customerHierarchy';
import type { Customer } from '../types/invoice';


// Re-export the inverse lookup at runtime
const INVERSE_MAP: Record<CustomerRelationshipType, CustomerRelationshipType> = {
  parent:     'subsidiary',
  subsidiary: 'parent',
  affiliate:  'affiliate',
  partner:    'partner',
  sibling:    'sibling',
  division:   'parent',
  franchisor: 'franchisee',
  franchisee: 'franchisor',
  other:      'other',
};

class CustomerHierarchyService {

  // ==========================================================================
  // Company ↔ Company Relationships
  // ==========================================================================

  /**
   * Get all active relationships for a customer (in both directions).
   * Returns relationships where the customer is either from_customer or to_customer.
   */
  async getRelationships(customerId: string): Promise<CustomerRelationship[]> {
    if (!isSupabaseConfigured || !customerId) return [];

    const [fromResult, toResult] = await Promise.all([
      supabase
        .from('customer_relationships')
        .select(`
          *,
          from_customer:customers!from_customer_id(id, company_name, email, customer_code, country_id, country:countries(*)),
          to_customer:customers!to_customer_id(id, company_name, email, customer_code, country_id, country:countries(*))
        `)
        .eq('from_customer_id', customerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),

      supabase
        .from('customer_relationships')
        .select(`
          *,
          from_customer:customers!from_customer_id(id, company_name, email, customer_code, country_id, country:countries(*)),
          to_customer:customers!to_customer_id(id, company_name, email, customer_code, country_id, country:countries(*))
        `)
        .eq('to_customer_id', customerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
    ]);

    const fromRels: CustomerRelationship[] = fromResult.data || [];
    const toRels: CustomerRelationship[] = toResult.data || [];

    // Merge and de-duplicate by id
    const seen = new Set<string>();
    const merged: CustomerRelationship[] = [];
    for (const rel of [...fromRels, ...toRels]) {
      if (!seen.has(rel.id)) {
        seen.add(rel.id);
        merged.push(rel);
      }
    }

    return merged;
  }

  /**
   * Create a new company relationship.
   * Optionally (default: true) also creates the inverse relationship so the
   * graph is bidirectional and queries are symmetric.
   */
  async addRelationship(data: CreateCustomerRelationshipData): Promise<CustomerRelationship> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const { create_inverse = true, ...payload } = data;

    // Insert primary relationship
    const { data: inserted, error } = await supabase
      .from('customer_relationships')
      .insert({
        from_customer_id:   payload.from_customer_id,
        to_customer_id:     payload.to_customer_id,
        relationship_type:  payload.relationship_type,
        context:            payload.context ?? null,
        company_settings_id: payload.company_settings_id ?? null,
        notes:              payload.notes ?? null,
        is_active:          true,
      })
      .select(`
        *,
        from_customer:customers!from_customer_id(id, company_name, email, customer_code, country_id),
        to_customer:customers!to_customer_id(id, company_name, email, customer_code, country_id)
      `)
      .single();

    if (error) throw error;

    // Auto-create inverse
    if (create_inverse) {
      const inverseType = INVERSE_MAP[payload.relationship_type];
      // Only insert if not a self-inverse of the same record (avoids exact duplicates)
      const swapKey = `${payload.to_customer_id}-${payload.from_customer_id}-${inverseType}`;
      const { error: invError } = await supabase
        .from('customer_relationships')
        .upsert(
          {
            from_customer_id:   payload.to_customer_id,
            to_customer_id:     payload.from_customer_id,
            relationship_type:  inverseType,
            context:            payload.context ?? null,
            company_settings_id: payload.company_settings_id ?? null,
            notes:              payload.notes ?? null,
            is_active:          true,
          },
          { onConflict: 'from_customer_id,to_customer_id,relationship_type', ignoreDuplicates: true }
        );

      if (invError) {
        console.warn('Could not create inverse relationship:', invError.message);
      }
    }

    return inserted as CustomerRelationship;
  }

  /**
   * Update an existing relationship record.
   */
  async updateRelationship(id: string, data: UpdateCustomerRelationshipData): Promise<CustomerRelationship> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const { data: updated, error } = await supabase
      .from('customer_relationships')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated as CustomerRelationship;
  }

  /**
   * Soft-delete a relationship (sets is_active = false).
   */
  async deleteRelationship(id: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const { error } = await supabase
      .from('customer_relationships')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  // ==========================================================================
  // Contact ↔ Company Cross-Links
  // ==========================================================================

  /**
   * Get all active cross-company links for a specific contact.
   */
  async getContactCustomerLinks(contactId: string): Promise<ContactCustomerLink[]> {
    if (!isSupabaseConfigured || !contactId) return [];

    const { data, error } = await supabase
      .from('contact_customer_links')
      .select(`
        *,
        customer:customers(id, company_name, email, customer_code, country_id, country:countries(*))
      `)
      .eq('contact_id', contactId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ContactCustomerLink[];
  }

  /**
   * Get all contacts linked to a given customer (including cross-company links).
   */
  async getLinksForCustomer(customerId: string): Promise<ContactCustomerLink[]> {
    if (!isSupabaseConfigured || !customerId) return [];

    const { data, error } = await supabase
      .from('contact_customer_links')
      .select(`
        *,
        contact:customer_contacts(id, name, email, phone, job_title, role, is_primary, customer_id)
      `)
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ContactCustomerLink[];
  }

  /**
   * Link a contact to an additional company.
   */
  async addContactCustomerLink(data: CreateContactCustomerLinkData): Promise<ContactCustomerLink> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const { data: inserted, error } = await supabase
      .from('contact_customer_links')
      .upsert(
        {
          contact_id:  data.contact_id,
          customer_id: data.customer_id,
          role:        data.role ?? null,
          is_primary:  data.is_primary ?? false,
          context:     data.context ?? null,
          is_active:   true,
        },
        { onConflict: 'contact_id,customer_id' }
      )
      .select(`
        *,
        contact:customer_contacts(id, name, email, phone, job_title, role, is_primary, customer_id),
        customer:customers(id, company_name, email, customer_code, country_id)
      `)
      .single();

    if (error) throw error;
    return inserted as ContactCustomerLink;
  }

  /**
   * Update a contact-customer cross-link.
   */
  async updateContactCustomerLink(id: string, data: UpdateContactCustomerLinkData): Promise<ContactCustomerLink> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const { data: updated, error } = await supabase
      .from('contact_customer_links')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated as ContactCustomerLink;
  }

  /**
   * Remove (soft-delete) a contact-customer cross-link.
   */
  async removeContactCustomerLink(id: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const { error } = await supabase
      .from('contact_customer_links')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  // ==========================================================================
  // Hierarchy Tree Builder
  // ==========================================================================

  /**
   * Build a hierarchy tree for a customer up to `maxDepth` levels deep.
   * Level 0 = the requested customer. Negative depth = parents, positive = children.
   * We use `maxDepth = 2` to fetch grandparent/parent/current/child/grandchild.
   */
  async getCustomerHierarchyTree(customerId: string, maxDepth = 2): Promise<CustomerHierarchyNode> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase not configured');
    }

    // Fetch the root customer
    const { data: rootData, error: rootError } = await supabase
      .from('customers')
      .select('id, company_name, email, customer_code, country_id, is_active, country:countries(*)')
      .eq('id', customerId)
      .single();

    if (rootError || !rootData) throw rootError || new Error('Customer not found');

    const visited = new Set<string>();
    return this.buildNode(rootData as unknown as Customer, 0, maxDepth, visited);
  }

  private async buildNode(
    customer: Customer,
    depth: number,
    maxDepth: number,
    visited: Set<string>
  ): Promise<CustomerHierarchyNode> {
    visited.add(customer.id);

    const node: CustomerHierarchyNode = {
      customer,
      relationships: [],
      parents: [],
      children: [],
      depth,
    };

    if (Math.abs(depth) >= maxDepth) return node;

    // Fetch all active relationships involving this customer
    const [fromResult, toResult] = await Promise.all([
      supabase
        .from('customer_relationships')
        .select('*, to_customer:customers!to_customer_id(id, company_name, email, customer_code, country_id, is_active, country:countries(*))')
        .eq('from_customer_id', customer.id)
        .eq('is_active', true),

      supabase
        .from('customer_relationships')
        .select('*, from_customer:customers!from_customer_id(id, company_name, email, customer_code, country_id, is_active, country:countries(*))')
        .eq('to_customer_id', customer.id)
        .eq('is_active', true),
    ]);

    const fromRels: CustomerRelationship[] = (fromResult.data || []) as CustomerRelationship[];
    const toRels: CustomerRelationship[]   = (toResult.data   || []) as CustomerRelationship[];

    node.relationships = [...fromRels, ...toRels];

    // Build parent nodes (where current is the child/subsidiary/franchisee/division)
    const childTypes: CustomerRelationshipType[] = ['subsidiary', 'franchisee', 'division', 'affiliate'];
    const parentRels = fromRels.filter(r => childTypes.includes(r.relationship_type));

    // Build child nodes (where current is the parent/franchisor)
    const parentTypes: CustomerRelationshipType[] = ['parent', 'franchisor'];
    const childRels = fromRels.filter(r => parentTypes.includes(r.relationship_type));

    // Also consider incoming "parent" as a parent of current
    const incomingParents = toRels.filter(r => r.relationship_type === 'parent' || r.relationship_type === 'franchisor');
    const incomingChildren = toRels.filter(r => childTypes.includes(r.relationship_type));

    // Build child nodes recursively
    for (const rel of [...childRels, ...incomingChildren]) {
      const nextCustomer = (rel.to_customer || rel.from_customer) as Customer | undefined;
      if (nextCustomer && !visited.has(nextCustomer.id)) {
        const childNode = await this.buildNode(nextCustomer, depth + 1, maxDepth, new Set(visited));
        node.children.push(childNode);
      }
    }

    // Build parent nodes recursively
    for (const rel of [...parentRels, ...incomingParents]) {
      const nextCustomer = (rel.to_customer || rel.from_customer) as Customer | undefined;
      if (nextCustomer && !visited.has(nextCustomer.id)) {
        const parentNode = await this.buildNode(nextCustomer, depth - 1, maxDepth, new Set(visited));
        node.parents.push(parentNode);
      }
    }

    return node;
  }
}

export const customerHierarchyService = new CustomerHierarchyService();
