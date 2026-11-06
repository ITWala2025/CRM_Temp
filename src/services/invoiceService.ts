import { supabase, isSupabaseConfigured, isMockMode } from '../config/supabase';
import { mockStore } from '../data/mockStore';
import { simpleAuth } from '../utils/simpleAuth';
import { exchangeRateService } from './exchangeRateService';
import { subscriptionService } from './subscriptionService';
import { quoteService } from './quoteService';
import type {
  Country,
  CompanySettings,
  InvoiceSettings,
  TermsTemplate,
  Customer,
  Product,
  Invoice,
  Payment,
  CreateInvoiceData,
  CreateCustomerData,
  CreateProductData,
  CreateCompanySettingsData,
  CreateInvoiceSettingsData,
  UpdateCompanySettingsData,
  UpdateInvoiceSettingsData,
  InvoiceStats,
  InvoiceFilters,
  CustomerFilters,
  ProductFilters,
  PaginatedResponse
} from '../types/invoice';

class InvoiceService {
  /**
   * Calculate the current financial year based on the financial year start month
   * @param fyStartMonth - The month when financial year starts (1-12, default: 4 for April)
   * @param currentDate - The current date (default: new Date())
   * @returns Financial year string in format "YYYY-YY" (e.g., "2024-25")
   */
  private calculateFinancialYear(fyStartMonth: number = 4, currentDate: Date = new Date()): string {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    if (currentMonth >= fyStartMonth) {
      // We're in the second half of the financial year
      return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    } else {
      // We're in the first half of the financial year
      return `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    }
  }

  /**
   * Check if we're at the start of a new financial year
   * @param currentFY - Current financial year from settings
   * @param calculatedFY - Calculated financial year based on current date
   * @returns true if it's a new financial year, false otherwise
   */
  private isNewFinancialYear(currentFY: string | null, calculatedFY: string): boolean {
    return currentFY !== calculatedFY;
  }
  // Countries
  async getCountries(): Promise<Country[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured. Please contact the administrator.');
    }
    
    const { data, error } = await supabase
      .from('countries')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  async getCountryById(id: string): Promise<Country | null> {
    const { data, error } = await supabase
      .from('countries')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Company Settings
  async getCompanySettings(): Promise<CompanySettings[]> {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select(`
          *,
          country:countries(*)
        `)
        .eq('is_active', true)
        .order('is_default', { ascending: false });
      
      if (error) {
        console.warn('getCompanySettings DB error (falling back):', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('getCompanySettings exception:', err);
      return [];
    }
  }

  async getDefaultCompanySettings(): Promise<CompanySettings | null> {
    const { data, error } = await supabase
      .from('company_settings')
      .select(`
        *,
        country:countries(*)
      `)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Resolves the company entity and determines if it represents the Ireland (IRL) entity
   */
  async resolveCompanyEntity(companySettingsId?: string): Promise<{
    company: CompanySettings | null;
    entityCode: 'IND' | 'IRL';
    isIrish: boolean;
  }> {
    let company: CompanySettings | null = null;
    if (companySettingsId) {
      const companies = await this.getCompanySettings();
      company = companies.find(c => c.id === companySettingsId) || null;
      if (!company) {
        try {
          const { data } = await supabase
            .from('company_settings')
            .select(`*, country:countries(*)`)
            .eq('id', companySettingsId)
            .maybeSingle();
          if (data) company = data;
        } catch {
          // ignore error
        }
      }
    }

    if (!company) {
      company = await this.getDefaultCompanySettings();
    }

    const countryCode = (company?.country?.code || company?.country_id || '').toUpperCase();
    const isIrish = countryCode === 'IE' || countryCode === 'IRL' || !!company?.cro_number || !!company?.vat_number;
    const entityCode: 'IND' | 'IRL' = isIrish ? 'IRL' : 'IND';

    return { company, entityCode, isIrish };
  }

  async updateCompanySettings(id: string, settings: UpdateCompanySettingsData): Promise<CompanySettings> {
    const { data, error } = await supabase
      .from('company_settings')
      .update(settings)
      .eq('id', id)
      .select(`
        *,
        country:countries(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  async createCompanySettings(settings: CreateCompanySettingsData): Promise<CompanySettings> {
    const { data, error } = await supabase
      .from('company_settings')
      .insert({
        ...settings,
        is_active: true,
        is_default: settings.is_default || false
      })
      .select(`
        *,
        country:countries(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteCompanySettings(id: string): Promise<void> {
    const { error } = await supabase
      .from('company_settings')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Invoice Settings
  async getInvoiceSettings(companySettingsId?: string): Promise<InvoiceSettings | null> {
    let query = supabase
      .from('invoice_settings')
      .select('*')
      .eq('is_active', true);

    if (companySettingsId) {
      query = query.eq('company_settings_id', companySettingsId);
    } else {
      query = query.is('company_settings_id', null);
    }

    const { data, error } = await query.maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;

    // Resolve entity context
    const { isIrish } = await this.resolveCompanyEntity(companySettingsId);

    if (data) {
      // For Ireland entity, ensure standard IRL prefix and format
      if (isIrish) {
        let needsUpdate = false;
        let prefix = data.invoice_prefix;
        let format = data.number_format;
        if (!format.includes('IRL') && !format.includes('XXXX')) {
          format = 'INV/IRL/YYYY/MM/XXXX';
          needsUpdate = true;
        }
        if (!prefix.includes('IRL')) {
          prefix = 'INV/IRL';
          needsUpdate = true;
        }
        if (needsUpdate) {
          data.invoice_prefix = prefix;
          data.number_format = format;
          try {
            await supabase
              .from('invoice_settings')
              .update({ invoice_prefix: prefix, number_format: format })
              .eq('id', data.id);
          } catch (e) {
            console.warn('Could not auto-update IRL invoice format in DB:', e);
          }
        }
      }
      return data;
    }

    // No row found in invoice_settings for this company_settings_id
    if (isIrish) {
      const currentYear = new Date().getFullYear();
      const defaultIrlSettings: InvoiceSettings = {
        id: `irl-settings-${companySettingsId || 'default'}`,
        company_settings_id: companySettingsId || null,
        invoice_prefix: 'INV/IRL',
        invoice_suffix: '',
        number_format: 'INV/IRL/YYYY/MM/XXXX',
        current_number: 1,
        reset_annually: true,
        financial_year_start_month: 1, // Calendar year (Jan-Dec)
        current_financial_year: currentYear.toString(),
        payment_terms: 'Payment due within 30 days',
        notes: 'Thank you for your business!',
        footer_text: '',
        default_tax_rate: 23,
        enable_gst: false,
        due_days: 30,
        late_fee_percentage: 0,
        template_name: 'default',
        currency_position: 'before',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (companySettingsId) {
        try {
          const { data: inserted, error: insertError } = await supabase
            .from('invoice_settings')
            .insert({
              company_settings_id: companySettingsId,
              invoice_prefix: 'INV/IRL',
              number_format: 'INV/IRL/YYYY/MM/XXXX',
              current_number: 1,
              reset_annually: true,
              financial_year_start_month: 1,
              current_financial_year: currentYear.toString(),
              payment_terms: 'Payment due within 30 days',
              notes: 'Thank you for your business!',
              default_tax_rate: 23,
              enable_gst: false,
              due_days: 30,
              template_name: 'default',
              currency_position: 'before',
              is_active: true
            })
            .select('*')
            .maybeSingle();

          if (!insertError && inserted) {
            return inserted;
          }
        } catch (insertErr) {
          console.warn('Could not auto-insert default IRL invoice settings:', insertErr);
        }
      }
      return defaultIrlSettings;
    }

    // For IND entity, check if global settings (company_settings_id IS NULL) exist
    if (companySettingsId) {
      const { data: globalSettings } = await supabase
        .from('invoice_settings')
        .select('*')
        .is('company_settings_id', null)
        .eq('is_active', true)
        .maybeSingle();
      if (globalSettings) {
        return globalSettings;
      }
    }

    // Fallback default IND settings
    const currentFY = this.calculateFinancialYear(4, new Date());
    return {
      id: `ind-settings-${companySettingsId || 'default'}`,
      company_settings_id: companySettingsId || null,
      invoice_prefix: 'INV',
      invoice_suffix: '',
      number_format: 'PREFIX/YYYY/MM/###',
      current_number: 1,
      reset_annually: true,
      financial_year_start_month: 4,
      current_financial_year: currentFY,
      payment_terms: 'Payment due within 30 days',
      notes: 'Thank you for your business!',
      footer_text: '',
      default_tax_rate: 18,
      enable_gst: true,
      due_days: 30,
      late_fee_percentage: 0,
      template_name: 'default',
      currency_position: 'inr_before',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  async updateInvoiceSettings(id: string, settings: UpdateInvoiceSettingsData): Promise<InvoiceSettings> {
    const { data, error } = await supabase
      .from('invoice_settings')
      .update(settings)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  async createInvoiceSettings(settings: CreateInvoiceSettingsData, companySettingsId?: string): Promise<InvoiceSettings> {
    const { data, error } = await supabase
      .from('invoice_settings')
      .insert({
        ...settings,
        company_settings_id: companySettingsId || null,
        is_active: true,
        current_number: 1
      })
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteInvoiceSettings(id: string): Promise<void> {
    const { error } = await supabase
      .from('invoice_settings')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Terms Templates
  async getTermsTemplates(): Promise<TermsTemplate[]> {
    const { data, error } = await supabase
      .from('terms_templates')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  async createTermsTemplate(template: Omit<TermsTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<TermsTemplate> {
    const { data, error } = await supabase
      .from('terms_templates')
      .insert(template)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateTermsTemplate(id: string, template: Partial<TermsTemplate>): Promise<TermsTemplate> {
    const { data, error } = await supabase
      .from('terms_templates')
      .update(template)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteTermsTemplate(id: string): Promise<void> {
    const { error } = await supabase
      .from('terms_templates')
      .update({ is_active: false })
      .eq('id', id);
    
    if (error) throw error;
  }

  // Customers
  async getCustomers(filters?: CustomerFilters, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Customer>> {
    let query = supabase
      .from('customers')
      .select(`
        *,
        country:countries(*)
      `, { count: 'exact' });

    if (filters) {
      if (filters.search) {
        const s = filters.search.trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
        if (isUuid) {
          query = query.or(`id.eq.${s},company_name.ilike.%${s}%,contact_person.ilike.%${s}%,email.ilike.%${s}%,customer_code.ilike.%${s}%`);
        } else {
          query = query.or(`company_name.ilike.%${s}%,contact_person.ilike.%${s}%,email.ilike.%${s}%,customer_code.ilike.%${s}%`);
        }
      }
      if (filters.country_id) {
        query = query.eq('country_id', filters.country_id);
      }
      // Show entity-specific records AND shared records (null = visible to all)
      if (filters.company_settings_id) {
        query = query.or(`company_settings_id.eq.${filters.company_settings_id},company_settings_id.is.null`);
      }
      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error) throw error;
    
    const customerList: Customer[] = data || [];

    // Auto-repair/backfill any existing customers missing customer_code
    for (const c of customerList) {
      if (!c.customer_code) {
        try {
          const year = c.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear();
          const prefix = `${year}-`;
          const { data: latest } = await supabase
            .from('customers')
            .select('customer_code')
            .like('customer_code', `${prefix}%`)
            .order('customer_code', { ascending: false })
            .limit(1);
          const lastSeq = latest?.[0]?.customer_code
            ? parseInt(latest[0].customer_code.split('-')[1], 10)
            : 0;
          const newCode = `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
          
          await supabase
            .from('customers')
            .update({ customer_code: newCode })
            .eq('id', c.id);
          
          c.customer_code = newCode;
        } catch (repairErr) {
          console.warn(`Could not backfill customer_code for customer ${c.id}:`, repairErr);
        }
      }
    }

    // Safely load contacts if customer_contacts table exists in Supabase
    if (customerList.length > 0) {
      try {
        const customerIds = customerList.map(c => c.id);
        const { data: contactsData } = await supabase
          .from('customer_contacts')
          .select('*')
          .in('customer_id', customerIds)
          .eq('is_active', true);
        
        if (contactsData && contactsData.length > 0) {
          const contactsMap: Record<string, any[]> = {};
          contactsData.forEach(contact => {
            contactsMap[contact.customer_id] = contactsMap[contact.customer_id] || [];
            contactsMap[contact.customer_id].push(contact);
          });

          customerList.forEach(c => {
            c.contacts = contactsMap[c.id] || [];
          });
        }
      } catch (err) {
        console.warn('customer_contacts table not available or query failed:', err);
      }
    }

    return {
      data: customerList,
      count: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage)
    };
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        country:countries(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!data) return null;

    if (!data.customer_code) {
      try {
        const year = data.created_at ? new Date(data.created_at).getFullYear() : new Date().getFullYear();
        const prefix = `${year}-`;
        const { data: latest } = await supabase
          .from('customers')
          .select('customer_code')
          .like('customer_code', `${prefix}%`)
          .order('customer_code', { ascending: false })
          .limit(1);
        const lastSeq = latest?.[0]?.customer_code
          ? parseInt(latest[0].customer_code.split('-')[1], 10)
          : 0;
        const newCode = `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
        await supabase
          .from('customers')
          .update({ customer_code: newCode })
          .eq('id', id);
        data.customer_code = newCode;
      } catch (repairErr) {
        console.warn(`Could not backfill customer_code for customer ${id}:`, repairErr);
      }
    }

    // Safely load contacts if table exists
    try {
      const { data: contactsData } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', id)
        .eq('is_active', true);

      data.contacts = contactsData || [];
    } catch (err) {
      console.warn(`Could not load contacts for customer ${id}:`, err);
      data.contacts = [];
    }

    return data;
  }

  async createCustomer(customer: CreateCustomerData): Promise<Customer> {
    // Generate sequential customer_code: YYYY-XXXX (e.g. 2026-0001)
    const year = new Date().getFullYear();
    const prefix = `${year}-`;
    let attempts = 0;
    while (attempts < 10) {
      const { data: latest } = await supabase
        .from('customers')
        .select('customer_code')
        .like('customer_code', `${prefix}%`)
        .order('customer_code', { ascending: false })
        .limit(1);
      const lastSeq = latest?.[0]?.customer_code
        ? parseInt(latest[0].customer_code.split('-')[1], 10)
        : 0;
      const nextCode = `${prefix}${String(lastSeq + 1 + attempts).padStart(4, '0')}`;

      const { data, error } = await supabase
        .from('customers')
        .insert({ ...customer, customer_code: nextCode })
        .select(`*, country:countries(*)`)
        .single();

      if (!error) return data;
      // Retry on unique-constraint collision (code 23505)
      if ((error as { code?: string }).code !== '23505') throw error;
      attempts++;
    }
    throw new Error('Failed to generate unique customer code after 10 attempts');
  }

  async updateCustomer(id: string, customer: Partial<CreateCustomerData>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update(customer)
      .eq('id', id)
      .select(`
        *,
        country:countries(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id);
    
    if (error) throw error;
  }

  // Products
  async getProducts(filters?: ProductFilters, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Product>> {
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    if (filters) {
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,product_code.ilike.%${filters.search}%`);
      }
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query
      .order('name')
      .range(from, to);
    
    if (error) throw error;
    
    return {
      data: data || [],
      count: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage)
    };
  }

  async getProductById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async createProduct(product: CreateProductData): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateProduct(id: string, product: Partial<CreateProductData>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update(product)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);
    
    if (error) throw error;
  }

  // Invoice Number Generation
  /**
   * Helper to compute next invoice number, sequence and financial year per legal entity
   * - IND: preserves existing format (PREFIX/YYYY/MM/### e.g. INV/2026/09/010) and sequence
   * - IRL: uses format INV/IRL/YYYY/MM/XXXX (e.g. INV/IRL/2026/09/0001) with dedicated IRL sequence
   */
  private async calculateNextInvoiceDetails(companySettingsId?: string): Promise<{
    invoiceNumber: string;
    nextSequentialNumber: number;
    currentFinancialYear: string;
    settings: InvoiceSettings;
    isIrish: boolean;
    entityCode: 'IND' | 'IRL';
  }> {
    const { isIrish, entityCode, company } = await this.resolveCompanyEntity(companySettingsId);
    const settings = await this.getInvoiceSettings(companySettingsId);
    if (!settings) throw new Error('Invoice settings not found');

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentMonthStr = currentMonth.toString().padStart(2, '0');

    let nextSequentialNumber = settings.current_number || 1;
    let currentFinancialYear: string;

    if (isIrish) {
      // ── IRL Entity Logic ──────────────────────────────────────────────────
      // In Ireland, financial year is the calendar year (Jan - Dec)
      currentFinancialYear = currentYear.toString();

      // 1. Query existing IRL invoices count
      let irlCountQuery = supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

      if (company?.id) {
        irlCountQuery = irlCountQuery.or(`company_settings_id.eq.${company.id},invoice_number.ilike.INV/IRL/%`);
      } else {
        irlCountQuery = irlCountQuery.ilike('invoice_number', 'INV/IRL/%');
      }

      const { count: irlInvoiceCount } = await irlCountQuery;
      const actualIrlCount = irlInvoiceCount || 0;

      // 2. Query latest IRL invoice in the current year to ensure strictly sequential and collision-free numbers
      const { data: latestIrlInvoices } = await supabase
        .from('invoices')
        .select('invoice_number')
        .ilike('invoice_number', `INV/IRL/${currentYear}/%`)
        .order('invoice_number', { ascending: false })
        .limit(10);

      let maxIrlSeq = 0;
      if (latestIrlInvoices && latestIrlInvoices.length > 0) {
        for (const inv of latestIrlInvoices) {
          if (inv.invoice_number) {
            const parts = inv.invoice_number.split('/');
            const lastPart = parts[parts.length - 1];
            const seq = parseInt(lastPart, 10);
            if (!isNaN(seq) && seq > maxIrlSeq) {
              maxIrlSeq = seq;
            }
          }
        }
      }

      console.log('🇮🇪 IRL Invoice Number State:', {
        actualIrlCount,
        maxIrlSeq,
        settingsCurrentNumber: settings.current_number,
        currentFinancialYear,
        settingsFinancialYear: settings.current_financial_year
      });

      if (actualIrlCount === 0 && maxIrlSeq === 0) {
        nextSequentialNumber = 1;
      } else if (settings.reset_annually && settings.current_financial_year && settings.current_financial_year !== currentFinancialYear) {
        // New calendar year reset
        nextSequentialNumber = 1;
      } else {
        if (maxIrlSeq >= nextSequentialNumber) {
          nextSequentialNumber = maxIrlSeq + 1;
        }
      }

      // Format for IRL: strictly INV/IRL/YYYY/MM/XXXX with 4-digit zero padding
      const numberStr = nextSequentialNumber.toString().padStart(4, '0');
      const invoiceNumber = `INV/IRL/${currentYear}/${currentMonthStr}/${numberStr}`;

      return {
        invoiceNumber,
        nextSequentialNumber,
        currentFinancialYear,
        settings,
        isIrish: true,
        entityCode: 'IRL'
      };
    } else {
      // ── IND Entity Logic ──────────────────────────────────────────────────
      // Preserve existing sequence and format for IND
      const fyStartMonth = settings.financial_year_start_month || 4; // Default to April
      currentFinancialYear = this.calculateFinancialYear(fyStartMonth, currentDate);

      // Count only IND invoices (exclude IRL invoices)
      let indCountQuery = supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

      if (company?.id) {
        indCountQuery = indCountQuery.eq('company_settings_id', company.id);
      } else {
        indCountQuery = indCountQuery.not('invoice_number', 'ilike', 'INV/IRL/%');
      }

      const { count: indInvoiceCount } = await indCountQuery;
      const actualInvoiceCount = indInvoiceCount || 0;

      console.log('🇮🇳 IND Invoice Number State:', {
        actualInvoiceCount,
        settingsCurrentNumber: settings.current_number,
        currentFinancialYear,
        settingsFinancialYear: settings.current_financial_year
      });

      if (actualInvoiceCount === 0) {
        nextSequentialNumber = 1;
      } else if (settings.reset_annually && this.isNewFinancialYear(settings.current_financial_year, currentFinancialYear)) {
        nextSequentialNumber = 1;
      } else if (actualInvoiceCount > 0 && settings.current_number > actualInvoiceCount + 1) {
        const fyStartDate = new Date(currentYear, fyStartMonth - 1, 1);
        const fyEndDate = new Date(currentYear + (fyStartMonth <= 3 ? 1 : 0), fyStartMonth - 1, 0);
        let fyQuery = supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', fyStartDate.toISOString())
          .lte('created_at', fyEndDate.toISOString())
          .not('invoice_number', 'ilike', 'INV/IRL/%');

        if (company?.id) {
          fyQuery = fyQuery.eq('company_settings_id', company.id);
        }

        const { count: fyInvoiceCount } = await fyQuery;
        const fyActualCount = fyInvoiceCount || 0;
        if (settings.current_number > fyActualCount + 1) {
          nextSequentialNumber = fyActualCount + 1;
        }
      }

      // Dynamic number padding: 3 digits until 1000, then 4 digits
      const numberStr = nextSequentialNumber < 1000 
        ? nextSequentialNumber.toString().padStart(3, '0')
        : nextSequentialNumber.toString();

      let invoiceNumber = settings.number_format || 'PREFIX/YYYY/MM/###';
      invoiceNumber = invoiceNumber.replace(/PREFIX/g, settings.invoice_prefix || 'INV');
      invoiceNumber = invoiceNumber.replace(/YYYY/g, currentYear.toString());
      invoiceNumber = invoiceNumber.replace(/MM/g, currentMonthStr);
      invoiceNumber = invoiceNumber.replace(/XXXX/g, numberStr);
      invoiceNumber = invoiceNumber.replace(/####/g, numberStr);
      invoiceNumber = invoiceNumber.replace(/###/g, numberStr);
      invoiceNumber = invoiceNumber.replace(/NNNN/g, numberStr);
      invoiceNumber = invoiceNumber.replace(/NNN/g, numberStr);

      if (settings.invoice_suffix) {
        invoiceNumber = invoiceNumber.replace(/SUFFIX/g, settings.invoice_suffix);
      }

      return {
        invoiceNumber,
        nextSequentialNumber,
        currentFinancialYear,
        settings,
        isIrish: false,
        entityCode: 'IND'
      };
    }
  }

  async previewInvoiceNumber(companySettingsId?: string): Promise<string> {
    const details = await this.calculateNextInvoiceDetails(companySettingsId);
    console.log(`👀 Preview invoice number: ${details.invoiceNumber} (Entity: ${details.entityCode}, Next#: ${details.nextSequentialNumber})`);
    return details.invoiceNumber;
  }

  /**
   * Generate next invoice number without updating database settings
   * Used for uniqueness checking before final save
   */
  async generateNextInvoiceNumber(companySettingsId?: string): Promise<string> {
    const details = await this.calculateNextInvoiceDetails(companySettingsId);
    console.log(`🔢 Generated next invoice number (no DB update): ${details.invoiceNumber} (Entity: ${details.entityCode}, Next#: ${details.nextSequentialNumber})`);
    return details.invoiceNumber;
  }

  async generateInvoiceNumber(companySettingsId?: string): Promise<string> {
    const details = await this.calculateNextInvoiceDetails(companySettingsId);
    const { invoiceNumber, nextSequentialNumber, currentFinancialYear, settings, isIrish, entityCode } = details;

    // Update settings in database to reserve sequential number
    try {
      if (settings.id && !settings.id.startsWith('irl-settings-') && !settings.id.startsWith('ind-settings-')) {
        await supabase
          .from('invoice_settings')
          .update({
            current_number: nextSequentialNumber + 1,
            current_financial_year: currentFinancialYear
          })
          .eq('id', settings.id);
      } else if (companySettingsId) {
        await supabase
          .from('invoice_settings')
          .upsert({
            company_settings_id: companySettingsId,
            invoice_prefix: isIrish ? 'INV/IRL' : (settings.invoice_prefix || 'INV'),
            number_format: isIrish ? 'INV/IRL/YYYY/MM/XXXX' : (settings.number_format || 'PREFIX/YYYY/MM/###'),
            current_number: nextSequentialNumber + 1,
            current_financial_year: currentFinancialYear,
            reset_annually: settings.reset_annually,
            financial_year_start_month: isIrish ? 1 : (settings.financial_year_start_month || 4),
            default_tax_rate: isIrish ? 23 : (settings.default_tax_rate || 18),
            enable_gst: isIrish ? false : (settings.enable_gst ?? true),
            due_days: settings.due_days || 30,
            template_name: settings.template_name || 'default',
            currency_position: isIrish ? 'before' : (settings.currency_position || 'inr_before'),
            is_active: true
          }, { onConflict: 'company_settings_id' });
      }
    } catch (saveErr) {
      console.warn(`Could not update invoice settings counter in DB for ${entityCode}:`, saveErr);
    }

    console.log(`📋 Generated and reserved invoice number: ${invoiceNumber} (Entity: ${entityCode}, FY: ${currentFinancialYear}, Next#: ${nextSequentialNumber + 1})`);
    return invoiceNumber;
  }

  // Invoices
  async getInvoices(filters?: InvoiceFilters, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Invoice>> {
    if (isMockMode) {
      let list = mockStore.get<Invoice>('invoices');
      if (filters) {
        if (filters.search) {
          const s = filters.search.toLowerCase();
          list = list.filter((i) => i.invoice_number.toLowerCase().includes(s) || (i.notes && i.notes.toLowerCase().includes(s)));
        }
        if (filters.status) {
          list = list.filter((i) => i.status === filters.status);
        }
        if (filters.payment_status) {
          list = list.filter((i) => i.payment_status === filters.payment_status);
        }
        if (filters.customer_id) {
          list = list.filter((i) => i.customer_id === filters.customer_id);
        }
        if (filters.company_settings_id) {
          list = list.filter((i) => i.company_settings_id === filters.company_settings_id);
        }
      }
      const total = list.length;
      const startIndex = (page - 1) * perPage;
      const data = list.slice(startIndex, startIndex + perPage);
      return {
        data,
        count: total,
        page,
        per_page: perPage,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      };
    }

    let query = supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(*),
        company_settings:company_settings(*),
        invoice_items:invoice_items(
          *,
          product:products(*)
        ),
        payments:payments(*)
      `, { count: 'exact' });

    if (filters) {
      if (filters.search) {
        query = query.or(`invoice_number.ilike.%${filters.search}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.payment_status) {
        query = query.eq('payment_status', filters.payment_status);
      }
      if (filters.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters.date_from) {
        query = query.gte('invoice_date', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('invoice_date', filters.date_to);
      }
      if (filters.subscription_only) {
        query = query.not('subscription_id', 'is', null);
      }
      if (filters.company_settings_id) {
        query = query.eq('company_settings_id', filters.company_settings_id);
      }
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error) throw error;
    
    return {
      data: data || [],
      count: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage)
    };
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    if (isMockMode) {
      return mockStore.getById<Invoice>('invoices', id) || null;
    }

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(
          *,
          country:countries(*)
        ),
        company_settings:company_settings(
          *,
          country:countries(*)
        ),
        invoice_items:invoice_items(
          *,
          product:products(*)
        ),
        payments:payments(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Generate draft invoices for all active subscriptions
   * whose next_billing_date is today or past.
   * Returns the list of created draft invoices.
   */
  async generateDraftInvoicesFromSubscriptions(): Promise<Invoice[]> {
    const dueSubs = await subscriptionService.getDueSubscriptions();
    const createdInvoices: Invoice[] = [];

    for (const sub of dueSubs) {
      try {
        const subCompanyId = sub.company_settings_id || sub.customer?.company_settings_id;
        const invoice = await invoiceService.createInvoice({
          customer_id: sub.customer_id,
          invoice_date: sub.next_billing_date || new Date().toISOString().split('T')[0],
          due_date: new Date(
            new Date(sub.next_billing_date || new Date().toISOString().split('T')[0]).getTime() + 15 * 86400000
          ).toISOString().split('T')[0],
          notes: `Auto-generated from subscription #${sub.id}`,
          terms_conditions: sub.notes || '',
          subscription_id: sub.id,
          items: [
            {
              item_name: `${sub.plan?.name || 'Subscription'} - ${sub.plan?.billing_interval === 'monthly' ? 'Monthly' : 'Annual'}`,
              description: `Subscription to ${sub.plan?.name || 'Unknown'} plan (${sub.plan?.billing_interval}). ${sub.plan?.description || ''}`,
              quantity: 1,
              unit: 'svc',
              unit_price: sub.plan?.price || 0,
              tax_rate: 0,
            },
          ],
        }, undefined, subCompanyId);

        // Update the subscription's next_billing_date
        const newNextDate = sub.plan?.billing_interval === 'monthly'
          ? subscriptionService.calculateNextBillingDate(sub.next_billing_date, 'monthly')
          : subscriptionService.calculateNextBillingDate(sub.next_billing_date, 'annual');
        await subscriptionService.updateNextBillingDate(sub.id, newNextDate);

        createdInvoices.push(invoice);
      } catch (err) {
        console.error(`Failed to generate draft invoice for subscription ${sub.id}:`, err);
      }
    }

    return createdInvoices;
  }

  async createInvoice(invoiceData: CreateInvoiceData, invoiceNumber?: string, companySettingsId?: string): Promise<Invoice> {
    // If companySettingsId not provided, check if customer is linked to a specific company
    if (!companySettingsId && invoiceData.customer_id) {
      try {
        const customer = await this.getCustomerById(invoiceData.customer_id);
        if (customer?.company_settings_id) {
          companySettingsId = customer.company_settings_id;
        }
      } catch {
        // ignore error
      }
    }

    let finalInvoiceNumber: string;
    
    if (invoiceNumber) {
      finalInvoiceNumber = invoiceNumber;
      console.log('📝 Using provided invoice number:', finalInvoiceNumber);
    } else {
      finalInvoiceNumber = await this.generateInvoiceNumber(companySettingsId);
      console.log('🔢 Generated new invoice number:', finalInvoiceNumber);
    }
    
    let companySettings = await this.getDefaultCompanySettings();
    
    if (companySettingsId) {
      const all = await this.getCompanySettings();
      companySettings = all.find(c => c.id === companySettingsId) || companySettings;
    }
    
    if (!companySettings) {
      throw new Error('Default company settings not found');
    }

    // Get current user for created_by field
    const currentUser = await simpleAuth.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Get customer to determine currency
    const customer = await this.getCustomerById(invoiceData.customer_id);
    let currencyCode = 'INR'; // Default fallback
    
    console.log('💱 Invoice currency determination:', {
      customerId: invoiceData.customer_id,
      currencyOverride: invoiceData.currency_code_override,
      customer: customer ? {
        id: customer.id,
        name: customer.company_name || customer.contact_person,
        country_id: customer.country_id,
        country: customer.country
      } : null
    });

    // Allow explicit currency override (e.g. billing a foreign customer in INR)
    if (invoiceData.currency_code_override) {
      currencyCode = invoiceData.currency_code_override;
      console.log('✅ Using currency override:', currencyCode);
    } else if (customer && customer.country) {
      currencyCode = customer.country.currency_code;
      console.log('✅ Using customer country currency:', {
        countryCode: customer.country.code,
        currencyCode: customer.country.currency_code,
        currencySymbol: customer.country.currency_symbol
      });
    } else {
      console.log('⚠️ No customer country found, using default INR');
    }

    // Calculate totals in original currency
    let subtotal = 0;
    let taxAmount = 0;

    invoiceData.items.forEach(item => {
      let lineTotal = 0;

      // For service-based items: resource_count × quantity (months) × billable_hours × unit_price (rate/hour)
      if (item.is_service_item && item.billable_hours) {
        const resourceCount = item.resource_count || 1;
        lineTotal = resourceCount * item.quantity * item.billable_hours * item.unit_price;
      } else {
        // For product-based items: quantity × unit_price
        lineTotal = item.quantity * item.unit_price;
      }

      const itemTax = (lineTotal * item.tax_rate) / 100;
      subtotal += lineTotal;
      taxAmount += itemTax;
    });

    // Calculate discount
    let discountAmount = 0;
    if (invoiceData.discount_type && invoiceData.discount_value) {
      const discountValue = Number(invoiceData.discount_value);
      if (invoiceData.discount_type === 'percentage') {
        discountAmount = (subtotal * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }
    }

    // Recalculate tax on discounted subtotal
    const discountedSubtotal = subtotal - discountAmount;
    const averageTaxRate = taxAmount > 0 && subtotal > 0 ? (taxAmount / subtotal) * 100 : 0;
    const adjustedTaxAmount = (discountedSubtotal * averageTaxRate) / 100;

    const totalAmount = discountedSubtotal + adjustedTaxAmount;

    // Get exchange rate and convert to INR
    const invoiceDate = invoiceData.invoice_date.split('T')[0]; // Get date part only
    let exchangeRate = 1.0;
    let inrSubtotal = subtotal;
    let inrTaxAmount = adjustedTaxAmount;
    let inrTotalAmount = totalAmount;

    if (currencyCode !== 'INR') {
      console.log('🔄 Converting currency to INR:', {
        originalCurrency: currencyCode,
        originalAmount: totalAmount,
        invoiceDate
      });

      try {
        // Use enhanced database-first exchange rate service
        const serviceRate = await exchangeRateService.getExchangeRate(currencyCode, 'INR', invoiceDate);
        
        if (serviceRate && serviceRate > 0) {
          // Validate rate to prevent backward conversion
          if (serviceRate < 10 && ['EUR', 'USD', 'GBP'].includes(currencyCode)) {
            console.warn(`🚨 Exchange rate ${serviceRate} seems too low for ${currencyCode} → INR, this may be incorrect`);
            throw new Error(`Suspicious exchange rate: ${serviceRate}`);
          }
          
          exchangeRate = serviceRate;
          console.log(`✅ Using database exchange rate: 1 ${currencyCode} = ${exchangeRate} INR`);
          
          // Convert amounts to INR using the exchange rate service
          inrSubtotal = await exchangeRateService.convertToINR(subtotal, currencyCode, invoiceDate);
          inrTaxAmount = await exchangeRateService.convertToINR(adjustedTaxAmount, currencyCode, invoiceDate);
          inrTotalAmount = await exchangeRateService.convertToINR(totalAmount, currencyCode, invoiceDate);
          
          console.log('✅ Currency conversion completed via database:', {
            exchangeRate,
            original: { subtotal, taxAmount, totalAmount, currency: currencyCode },
            inr: { inrSubtotal, inrTaxAmount, inrTotalAmount }
          });
        } else {
          throw new Error('Exchange rate service returned null or invalid rate');
        }

      } catch (error) {
        console.error('❌ Currency conversion failed:', error);
        // The enhanced exchange rate service already has emergency fallbacks
        // so this should not happen, but if it does, we need to handle it
        throw new Error(`Currency conversion failed for ${currencyCode}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('💾 Creating invoice with multi-currency support:', {
      invoiceNumber: finalInvoiceNumber,
      customerId: invoiceData.customer_id,
      originalCurrency: currencyCode,
      originalTotal: totalAmount,
      exchangeRate,
      inrTotal: inrTotalAmount,
      createdBy: currentUser.id
    });

    // Create invoice with multi-currency support
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: finalInvoiceNumber,
        customer_id: invoiceData.customer_id,
        company_settings_id: companySettings.id,
        // Project details
        project_title: invoiceData.project_title,
        estimated_time: invoiceData.estimated_time,
        company_contact_name: invoiceData.company_contact_name,
        company_contact_email: invoiceData.company_contact_email,
        company_contact_phone: invoiceData.company_contact_phone,
        // Invoice dates
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.due_date,
        // Original currency amounts (for display and PDF generation)
        subtotal,
        discount_type: invoiceData.discount_type || null,
        discount_value: invoiceData.discount_value || 0,
        discount_amount: discountAmount,
        tax_amount: adjustedTaxAmount,
        total_amount: totalAmount,
        currency_code: currencyCode,
        // Multi-currency fields
        original_currency_code: currencyCode,
        original_subtotal: subtotal,
        original_tax_amount: adjustedTaxAmount,
        original_total_amount: totalAmount,
        exchange_rate: exchangeRate,
        exchange_rate_date: invoiceDate,
        inr_subtotal: inrSubtotal,
        inr_tax_amount: inrTaxAmount,
        inr_total_amount: inrTotalAmount,
        // Quote reference
        created_from_quote_id: invoiceData.created_from_quote_id || null,
        quote_reference: invoiceData.quote_reference || null,
        // Subscription reference
        subscription_id: invoiceData.subscription_id || null,
        // Other fields
        notes: invoiceData.notes,
        terms_conditions: invoiceData.terms_conditions,
        // International banking details (for non-INR invoices)
        intl_account_name: invoiceData.intl_account_name || null,
        intl_account_number: invoiceData.intl_account_number || null,
        intl_account_type: invoiceData.intl_account_type || null,
        intl_routing_number: invoiceData.intl_routing_number || null,
        intl_swift_bic: invoiceData.intl_swift_bic || null,
        intl_bank_address: invoiceData.intl_bank_address || null,
        intl_iban: invoiceData.intl_iban || null,
        intl_sort_code: invoiceData.intl_sort_code || null,
        created_by: currentUser.id
      })
      .select('*')
      .single();

    if (invoiceError) throw invoiceError;

    console.log('✅ Invoice created successfully:', {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      currencyCode: invoice.currency_code,
      originalTotal: invoice.original_total_amount,
      inrTotal: invoice.inr_total_amount,
      exchangeRate: invoice.exchange_rate
    });

    // Create invoice items with multi-currency support
    const itemsWithCalculations = await Promise.all(invoiceData.items.map(async (item, index) => {
      let lineTotal = 0;

      // For service-based items: resource_count × quantity (months) × billable_hours × unit_price (rate/hour)
      if (item.is_service_item && item.billable_hours) {
        const resourceCount = item.resource_count || 1;
        lineTotal = resourceCount * item.quantity * item.billable_hours * item.unit_price;
      } else {
        // For product-based items: quantity × unit_price
        lineTotal = item.quantity * item.unit_price;
      }

      const itemTaxAmount = (lineTotal * item.tax_rate) / 100;
      
      // Convert item amounts to INR
      let inrUnitPrice = item.unit_price;
      let inrLineTotal = lineTotal;
      let inrItemTaxAmount = itemTaxAmount;

      if (currencyCode !== 'INR') {
        inrUnitPrice = await exchangeRateService.convertToINR(item.unit_price, currencyCode, invoiceDate);
        inrLineTotal = await exchangeRateService.convertToINR(lineTotal, currencyCode, invoiceDate);
        inrItemTaxAmount = await exchangeRateService.convertToINR(itemTaxAmount, currencyCode, invoiceDate);
      }
      
      console.log(`📦 Processing item ${index + 1} with multi-currency:`, {
        product_id: item.product_id || 'NULL/UNDEFINED',
        item_name: item.item_name,
        original: { unit_price: item.unit_price, line_total: lineTotal, tax_amount: itemTaxAmount },
        inr: { unit_price: inrUnitPrice, line_total: inrLineTotal, tax_amount: inrItemTaxAmount }
      });
      
      // Ensure product_id is handled correctly (null for undefined)
      const processedItem = {
        invoice_id: invoice.id,
        product_id: item.product_id || null,
        item_name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        // Original currency amounts
        unit_price: item.unit_price,
        line_total: lineTotal,
        tax_rate: item.tax_rate,
        tax_amount: itemTaxAmount,
        // Multi-currency fields
        original_unit_price: item.unit_price,
        original_line_total: lineTotal,
        original_tax_amount: itemTaxAmount,
        inr_unit_price: inrUnitPrice,
        inr_line_total: inrLineTotal,
        inr_tax_amount: inrItemTaxAmount,
        // Service-based billing fields
        billable_hours: item.billable_hours || null,
        resource_count: item.resource_count || null,
        is_service_item: item.is_service_item || false,
        // Other fields
        hsn_code: item.hsn_code || null
      };
      
      return processedItem;
    }));

    console.log('💾 Inserting invoice items with multi-currency:', {
      invoiceId: invoice.id,
      itemCount: itemsWithCalculations.length
    });

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsWithCalculations);

    if (itemsError) {
      console.error('❌ Error inserting invoice items:', {
        error: itemsError,
        message: itemsError.message,
        details: itemsError.details,
        hint: itemsError.hint,
        code: itemsError.code
      });
      throw itemsError;
    }

    console.log('✅ Invoice items inserted successfully with multi-currency support');

    // Automatically fix currency conversion after creating the invoice
    await this.fixInvoiceCurrencyConversion(invoice.id);

    // Return complete invoice with relations
    return this.getInvoiceById(invoice.id) as Promise<Invoice>;
  }

  async updateInvoice(id: string, invoiceData: Partial<CreateInvoiceData>): Promise<Invoice> {
    console.log('🔧 updateInvoice started:', { id, invoiceData });
    
    try {
      // First update the basic invoice fields
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .update({
          customer_id: invoiceData.customer_id,
          invoice_date: invoiceData.invoice_date,
          due_date: invoiceData.due_date,
          // Project details
          project_title: invoiceData.project_title,
          estimated_time: invoiceData.estimated_time,
          company_contact_name: invoiceData.company_contact_name,
          company_contact_email: invoiceData.company_contact_email,
          company_contact_phone: invoiceData.company_contact_phone,
          // Discount fields
          discount_type: invoiceData.discount_type || null,
          discount_value: invoiceData.discount_value || 0,
          // Additional info
          notes: invoiceData.notes,
          terms_conditions: invoiceData.terms_conditions,
          // International banking details (for non-INR invoices)
          intl_account_name: invoiceData.intl_account_name || null,
          intl_account_number: invoiceData.intl_account_number || null,
          intl_account_type: invoiceData.intl_account_type || null,
          intl_routing_number: invoiceData.intl_routing_number || null,
          intl_swift_bic: invoiceData.intl_swift_bic || null,
          intl_bank_address: invoiceData.intl_bank_address || null,
          intl_iban: invoiceData.intl_iban || null,
          intl_sort_code: invoiceData.intl_sort_code || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('*')
        .single();
      
      if (invoiceError) {
        console.error('❌ Invoice update error:', invoiceError);
        throw invoiceError;
      }
      
      console.log('✅ Invoice basic fields updated:', invoice);

      // If items are provided, update them
      if (invoiceData.items && invoiceData.items.length > 0) {
        console.log('🔄 Updating invoice items, count:', invoiceData.items.length);
        
        // Get customer to determine currency for multi-currency conversion
        const customer = await this.getCustomerById(invoice.customer_id);
        let currencyCode = 'INR'; // Default fallback

        // Respect explicit currency override (e.g. billing a foreign customer in INR)
        if (invoiceData.currency_code_override) {
          currencyCode = invoiceData.currency_code_override;
          console.log('✅ Using currency_code_override for update:', currencyCode);
        } else if (customer && customer.country) {
          currencyCode = customer.country.currency_code;
          console.log('✅ Using customer country currency for update:', {
            countryCode: customer.country.code,
            currencyCode: customer.country.currency_code,
            currencySymbol: customer.country.currency_symbol
          });
        } else {
          console.log('⚠️ No customer country found for update, using default INR');
        }
        
        // Delete existing invoice items
        const { error: deleteError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id);
        
        if (deleteError) {
          console.error('❌ Delete existing items error:', {
            error: deleteError,
            message: deleteError.message,
            details: deleteError.details,
            hint: deleteError.hint,
            code: deleteError.code,
            invoiceId: id
          });
          throw new Error(`Failed to delete existing invoice items: ${deleteError.message || JSON.stringify(deleteError)}`);
        }
        
        console.log('🗑️ Existing items deleted');

        // Calculate totals and prepare new items with multi-currency support
        let subtotal = 0;
        let taxAmount = 0;
        const invoiceDate = invoiceData.invoice_date?.split('T')[0] || invoice.invoice_date?.split('T')[0];

        console.log('📋 Processing invoice items with multi-currency:', {
          itemCount: invoiceData.items.length,
          currencyCode,
          invoiceDate,
          items: invoiceData.items.map((item, index) => ({
            index,
            item_name: item.item_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            product_id: item.product_id,
            hasDescription: !!item.description,
            hasUnit: !!item.unit,
            hasHsnCode: !!item.hsn_code
          }))
        });

        // Get exchange rate for currency conversion
        let exchangeRate = 1.0;
        if (currencyCode !== 'INR') {
          try {
            const serviceRate = await exchangeRateService.getExchangeRate(currencyCode, 'INR', invoiceDate);
            
            if (serviceRate && serviceRate > 0) {
              // Validate rate to prevent backward conversion
              if (serviceRate < 10 && ['EUR', 'USD', 'GBP'].includes(currencyCode)) {
                console.warn(`🚨 Exchange rate ${serviceRate} seems too low for ${currencyCode} → INR during update`);
                throw new Error(`Suspicious exchange rate: ${serviceRate}`);
              }
              
              exchangeRate = serviceRate;
              console.log(`✅ Using database exchange rate for update: 1 ${currencyCode} = ${exchangeRate} INR`);
            } else {
              throw new Error('Exchange rate service returned null or invalid rate');
            }
          } catch (error) {
            console.error('❌ Currency conversion failed during update:', error);
            throw new Error(`Currency conversion failed for ${currencyCode}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Create invoice items with multi-currency support
        const itemsWithCalculations = await Promise.all(invoiceData.items.map(async (item, index) => {
          let lineTotal = 0;

          // For service-based items: resource_count × quantity (months) × billable_hours × unit_price (rate/hour)
          if (item.is_service_item && item.billable_hours) {
            const resourceCount = item.resource_count || 1;
            lineTotal = resourceCount * item.quantity * item.billable_hours * item.unit_price;
          } else {
            // For product-based items: quantity × unit_price
            lineTotal = item.quantity * item.unit_price;
          }

          const itemTaxAmount = (lineTotal * item.tax_rate) / 100;
          subtotal += lineTotal;
          taxAmount += itemTaxAmount;
          
          // Convert item amounts to INR
          let inrUnitPrice = item.unit_price;
          let inrLineTotal = lineTotal;
          let inrItemTaxAmount = itemTaxAmount;

          if (currencyCode !== 'INR') {
            inrUnitPrice = await exchangeRateService.convertToINR(item.unit_price, currencyCode, invoiceDate);
            inrLineTotal = await exchangeRateService.convertToINR(lineTotal, currencyCode, invoiceDate);
            inrItemTaxAmount = await exchangeRateService.convertToINR(itemTaxAmount, currencyCode, invoiceDate);
          }
          
          console.log(`� Processing update item ${index + 1} with multi-currency:`, {
            product_id: item.product_id || 'NULL/UNDEFINED',
            item_name: item.item_name,
            original: { unit_price: item.unit_price, line_total: lineTotal, tax_amount: itemTaxAmount },
            inr: { unit_price: inrUnitPrice, line_total: inrLineTotal, tax_amount: inrItemTaxAmount }
          });

          return {
            invoice_id: id,
            product_id: item.product_id || null,
            item_name: item.item_name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            // Original currency amounts
            unit_price: item.unit_price,
            line_total: lineTotal,
            tax_rate: item.tax_rate,
            tax_amount: itemTaxAmount,
            // Multi-currency fields
            original_unit_price: item.unit_price,
            original_line_total: lineTotal,
            original_tax_amount: itemTaxAmount,
            inr_unit_price: inrUnitPrice,
            inr_line_total: inrLineTotal,
            inr_tax_amount: inrItemTaxAmount,
            // Service-based billing fields
            billable_hours: item.billable_hours || null,
            resource_count: item.resource_count || null,
            is_service_item: item.is_service_item || false,
            // Other fields
            hsn_code: item.hsn_code || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }));

        console.log('💾 Inserting new items with multi-currency support:', { 
          itemCount: itemsWithCalculations.length, 
          subtotal, 
          taxAmount,
          currencyCode,
          exchangeRate
        });

        // Insert new invoice items
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsWithCalculations);
        
        if (itemsError) {
          console.error('❌ Insert new items error:', {
            error: itemsError,
            message: itemsError.message,
            details: itemsError.details,
            hint: itemsError.hint,
            code: itemsError.code,
            invoiceItems: itemsWithCalculations
          });
          throw new Error(`Failed to insert invoice items: ${itemsError.message || JSON.stringify(itemsError)}`);
        }
        
        console.log('✅ New items inserted successfully with multi-currency support');

        // Calculate discount
        let discountAmount = 0;
        if (invoiceData.discount_type && invoiceData.discount_value) {
          const discountValue = Number(invoiceData.discount_value);
          if (invoiceData.discount_type === 'percentage') {
            discountAmount = (subtotal * discountValue) / 100;
          } else {
            discountAmount = discountValue;
          }
        }

        // Recalculate tax on discounted subtotal
        const discountedSubtotal = subtotal - discountAmount;
        const averageTaxRate = taxAmount > 0 && subtotal > 0 ? (taxAmount / subtotal) * 100 : 0;
        const adjustedTaxAmount = (discountedSubtotal * averageTaxRate) / 100;

        // Convert totals to INR for multi-currency support
        const totalAmount = discountedSubtotal + adjustedTaxAmount;
        let inrSubtotal = subtotal;
        let inrTaxAmount = adjustedTaxAmount;
        let inrTotalAmount = totalAmount;

        if (currencyCode !== 'INR') {
          inrSubtotal = await exchangeRateService.convertToINR(subtotal, currencyCode, invoiceDate);
          inrTaxAmount = await exchangeRateService.convertToINR(adjustedTaxAmount, currencyCode, invoiceDate);
          inrTotalAmount = await exchangeRateService.convertToINR(totalAmount, currencyCode, invoiceDate);
          
          console.log('✅ Currency conversion completed for invoice update:', {
            exchangeRate,
            original: { subtotal, taxAmount, totalAmount, currency: currencyCode },
            inr: { inrSubtotal, inrTaxAmount, inrTotalAmount }
          });
        }

        // Update invoice totals with multi-currency support
        console.log('🧮 Updating invoice totals with multi-currency:', { 
          subtotal, 
          taxAmount, 
          totalAmount,
          currencyCode,
          exchangeRate,
          inrSubtotal,
          inrTaxAmount,
          inrTotalAmount
        });
        
        const { error: totalsError } = await supabase
          .from('invoices')
          .update({
            // Original currency amounts (for display and PDF generation)
            subtotal,
            discount_type: invoiceData.discount_type || null,
            discount_value: invoiceData.discount_value || 0,
            discount_amount: discountAmount,
            tax_amount: adjustedTaxAmount,
            total_amount: totalAmount,
            currency_code: currencyCode,
            // Multi-currency fields
            original_currency_code: currencyCode,
            original_subtotal: subtotal,
            original_tax_amount: adjustedTaxAmount,
            original_total_amount: totalAmount,
            exchange_rate: exchangeRate,
            exchange_rate_date: invoiceDate,
            inr_subtotal: inrSubtotal,
            inr_tax_amount: inrTaxAmount,
            inr_total_amount: inrTotalAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
        
        if (totalsError) {
          console.error('❌ Update totals error:', totalsError);
          throw totalsError;
        }
        
        console.log('✅ Invoice totals updated with multi-currency support');
      }

      // Return the complete updated invoice with all relations
      console.log('🔍 Fetching complete updated invoice');
      const { data: updatedInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(
            *,
            country:countries(*)
          ),
          company_settings:company_settings(
            *,
            country:countries(*)
          ),
          invoice_items:invoice_items(
            *,
            product:products(*)
          ),
          payments:payments(*)
        `)
        .eq('id', id)
        .single();
      
      if (fetchError) {
        console.error('❌ Fetch updated invoice error:', fetchError);
        throw fetchError;
      }
      
      // Automatically fix currency conversion after updating the invoice
      await this.fixInvoiceCurrencyConversion(id);
      
      console.log('✅ Invoice update completed successfully');
      return updatedInvoice;
    } catch (error) {
      console.error('❌ updateInvoice failed:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        invoiceId: id,
        invoiceData
      });
      
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(`Update invoice failed: ${JSON.stringify(error)}`);
      }
    }
  }

  async updateInvoiceStatus(id: string, status: Invoice['status'], paymentStatus?: Invoice['payment_status']): Promise<Invoice> {
    const updateData: { status: Invoice['status']; payment_status?: Invoice['payment_status']; updated_at: string } = { 
      status, 
      updated_at: new Date().toISOString() 
    };
    if (paymentStatus) {
      updateData.payment_status = paymentStatus;
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        customer:customers(
          *,
          country:countries(*)
        ),
        company_settings:company_settings(
          *,
          country:countries(*)
        ),
        invoice_items:invoice_items(
          *,
          product:products(*)
        ),
        payments:payments(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteInvoice(id: string): Promise<void> {
    // Soft delete: update status to cancelled instead of hard delete
    // This preserves data integrity and audit trails
    const { error } = await supabase
      .from('invoices')
      .update({ 
        status: 'cancelled', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);
    
    if (error) throw error;
  }

  async duplicateInvoice(id: string): Promise<Invoice> {
    // Get the original invoice with all its items
    const originalInvoice = await this.getInvoiceById(id);
    if (!originalInvoice) {
      throw new Error('Invoice not found');
    }

    // Create new invoice data
    const newInvoiceData: CreateInvoiceData = {
      customer_id: originalInvoice.customer_id,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: originalInvoice.due_date || '',
      notes: originalInvoice.notes || '',
      terms_conditions: originalInvoice.terms_conditions || '',
      items: originalInvoice.invoice_items?.map(item => ({
        product_id: item.product_id,
        item_name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        hsn_code: item.hsn_code
      })) || []
    };

    // Create the new invoice
    return await this.createInvoice(newInvoiceData, undefined, originalInvoice.company_settings_id);
  }

  // Payments
  async createPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    const { data, error } = await supabase
      .from('payments')
      .insert(payment)
      .select('*')
      .single();
    
    if (error) throw error;

    // Update invoice payment status.
    // We intentionally never set 'partial' here — when a payment is recorded via
    // "Mark as Paid" the actual amount paid may be slightly less than the invoice
    // total due to forex conversion differences. Treat as 'paid' if totalPaid >= 90%
    // of invoice total, otherwise leave as 'pending'.
    const invoice = await this.getInvoiceById(payment.invoice_id);
    if (invoice) {
      const totalPaid = (invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0) + payment.amount;
      const paymentStatus: Invoice['payment_status'] =
        totalPaid >= invoice.total_amount * 0.9 ? 'paid' : 'pending';

      await this.updateInvoiceStatus(payment.invoice_id, 'sent', paymentStatus);
    }

    return data;
  }

  // Dashboard Statistics
  async getInvoiceStats(companySettingsId?: string): Promise<InvoiceStats> {
    if (isMockMode) {
      let invoices = mockStore.get<Invoice>('invoices');
      if (companySettingsId) {
        invoices = invoices.filter((i) => i.company_settings_id === companySettingsId);
      }
      const totalInvoices = invoices.length;
      const paidInvoices = invoices.filter((i) => i.payment_status === 'paid').length;
      const overdueInvoices = invoices.filter((i) => i.status === 'overdue').length;
      const pendingInvoices = invoices.filter((i) => i.payment_status === 'pending').length;
      const totalRevenue = invoices.reduce((sum, i) => sum + (i.paid_amount || (i.payment_status === 'paid' ? i.total_amount : 0) || 0), 0);
      const pendingAmount = invoices.reduce((sum, i) => sum + (i.payment_status !== 'paid' ? (i.total_amount || 0) : 0), 0);
      const overdueAmount = invoices.filter((i) => i.status === 'overdue').reduce((sum, i) => sum + (i.total_amount || 0), 0);
      return {
        total_invoices: totalInvoices,
        paid_invoices: paidInvoices,
        overdue_invoices: overdueInvoices,
        cancelled_invoices: 0,
        sent_invoices: Math.max(0, totalInvoices - paidInvoices - overdueInvoices),
        draft_invoices: invoices.filter((i) => i.status === 'draft').length,
        total_revenue: totalRevenue,
        pending_amount: pendingAmount,
        this_month_revenue: totalRevenue,
        this_year_revenue: totalRevenue,
        total_revenue_inr: totalRevenue,
        pending_amount_inr: pendingAmount,
        this_month_revenue_inr: totalRevenue,
      };
    }

    console.log('📊 Starting getInvoiceStats calculation...', { companySettingsId });
    
    // Fetch raw invoice data
    let query = supabase
      .from('invoices')
      .select('id, status, payment_status, total_amount, inr_total_amount, paid_amount, original_currency_code, invoice_date');

    if (companySettingsId) {
      query = query.eq('company_settings_id', companySettingsId);
    }
    
    const { data: invoices, error: invoicesError } = await query;
    
    if (invoicesError) {
      console.error('❌ Failed to fetch invoices for stats:', invoicesError);
      throw invoicesError;
    }

    // Fetch actual payments to get real revenue amounts
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('invoice_id, amount, inr_amount, original_amount, original_currency_code, payment_date, created_at, reference_number, notes');

    if (paymentsError) {
      console.warn('⚠️ Could not fetch payments table, falling back to invoice amounts:', paymentsError.message);
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Build a map of PAID (non-cancelled) invoices
    const paidInvoicesMap = new Map<string, any>(
      invoices?.filter(i => i.payment_status === 'paid' && i.status !== 'cancelled').map(i => [i.id, i]) || []
    );

    // Group payments by invoice_id to handle duplicate payment records from re-marking paid
    const paymentsByInvoice: Record<string, any[]> = {};
    (payments || []).forEach(p => {
      if (paidInvoicesMap.has(p.invoice_id)) {
        if (!paymentsByInvoice[p.invoice_id]) paymentsByInvoice[p.invoice_id] = [];
        paymentsByInvoice[p.invoice_id].push(p);
      }
    });

    const validPayments = Object.entries(paymentsByInvoice).map(([invId, list]) => {
      list.sort((a, b) => {
        const aIsAuto = Boolean((a.reference_number || '').startsWith('AUTO-') || (a.notes || '').includes('Auto-'));
        const bIsAuto = Boolean((b.reference_number || '').startsWith('AUTO-') || (b.notes || '').includes('Auto-'));
        if (aIsAuto !== bIsAuto) return aIsAuto ? 1 : -1;
        const timeB = new Date(b.created_at || b.payment_date || 0).getTime();
        const timeA = new Date(a.created_at || a.payment_date || 0).getTime();
        return timeB - timeA;
      });
      const topPayment = list[0];
      const inv = paidInvoicesMap.get(invId);
      return {
        ...topPayment,
        invoice_paid_amount: inv?.paid_amount
      };
    });

    // Revenue = sum of actual payments received (from payments table or invoice.paid_amount)
    // Use inr_amount when available for INR entity reporting, fallback to amount
    const getPaymentValue = (p: any) => p.invoice_paid_amount || p.inr_amount || (p.original_currency_code === 'INR' ? p.original_amount : null) || p.amount || 0;
    const total_revenue = validPayments.reduce((sum, p) => sum + getPaymentValue(p), 0);

    const this_month_revenue = validPayments.filter(p => {
      const d = new Date(p.payment_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((sum, p) => sum + getPaymentValue(p), 0);

    const this_year_revenue = validPayments.filter(p => {
      return new Date(p.payment_date).getFullYear() === currentYear;
    }).reduce((sum, p) => sum + getPaymentValue(p), 0);

    // Pending = invoice amounts not yet paid.
    // Use native total_amount when companySettingsId is specified so currency value matches the entity currency.
    const pending_amount = invoices
      ?.filter(i => i.payment_status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => sum + (companySettingsId ? (i.total_amount || 0) : (i.inr_total_amount || i.total_amount || 0)), 0) || 0;

    const stats: InvoiceStats = {
      total_invoices: invoices?.length || 0,
      draft_invoices: invoices?.filter(i => i.status === 'draft').length || 0,
      sent_invoices: invoices?.filter(i => i.status === 'sent').length || 0,
      paid_invoices: invoices?.filter(i => i.payment_status === 'paid' && i.status !== 'cancelled').length || 0,
      overdue_invoices: invoices?.filter(i => i.status === 'overdue').length || 0,
      cancelled_invoices: invoices?.filter(i => i.status === 'cancelled').length || 0,
      total_revenue,
      pending_amount,
      this_month_revenue,
      this_year_revenue,
      total_revenue_inr: total_revenue,
      pending_amount_inr: pending_amount,
      this_month_revenue_inr: this_month_revenue,
      currency_breakdown: {}
    };

    console.log('✅ Stats calculated from payments table:', {
      total_revenue,
      pending_amount,
      this_month_revenue,
      payment_count: validPayments.length
    });

    return stats;
  }
  // Exchange rate management methods
  async updateExchangeRates(forceUpdate: boolean = false): Promise<boolean> {
    return await exchangeRateService.updateExchangeRates(forceUpdate);
  }

  async getExchangeRate(fromCurrency: string, toCurrency: string, date?: string): Promise<number | null> {
    return await exchangeRateService.getExchangeRate(fromCurrency, toCurrency, date);
  }

  async convertCurrency(amount: number, fromCurrency: string, toCurrency: string, date?: string) {
    return await exchangeRateService.convertCurrency(amount, fromCurrency, toCurrency, date);
  }

  async convertToINR(amount: number, fromCurrency: string, date?: string): Promise<number> {
    return await exchangeRateService.convertToINR(amount, fromCurrency, date);
  }

  async getAvailableCurrencies() {
    return await exchangeRateService.getAvailableCurrencies();
  }

  /**
   * Fix currency conversion for a specific invoice
   * This method should be called after saving/updating an invoice to ensure correct INR amounts
   */
  async fixInvoiceCurrencyConversion(invoiceId: string): Promise<boolean> {
    try {
      console.log(`🔧 Fixing currency conversion for invoice ${invoiceId}...`);
      
      // Get the invoice
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('id, currency_code, original_currency_code, total_amount, subtotal, tax_amount, inr_total_amount, inr_subtotal, inr_tax_amount, invoice_date')
        .eq('id', invoiceId)
        .single();
        
      if (error || !invoice) {
        console.error('❌ Failed to fetch invoice for currency fix:', error);
        return false;
      }
      
      const currencyCode = invoice.original_currency_code || invoice.currency_code || 'INR';
      
      // If already INR or INR amounts already exist and seem correct, skip
      if (currencyCode === 'INR') {
        if (!invoice.inr_total_amount || invoice.inr_total_amount !== invoice.total_amount) {
          await supabase
            .from('invoices')
            .update({
              inr_total_amount: invoice.total_amount,
              inr_subtotal: invoice.subtotal,
              inr_tax_amount: invoice.tax_amount,
              original_currency_code: 'INR',
              exchange_rate: 1.0,
              exchange_rate_date: invoice.invoice_date
            })
            .eq('id', invoiceId);
          console.log(`✅ Fixed INR invoice ${invoiceId}`);
        }
        return true;
      }
      
      // For non-INR currencies, check if conversion is needed
      if (invoice.inr_total_amount && invoice.inr_total_amount > 10) {
        console.log(`✅ Invoice ${invoiceId} already has valid INR conversion`);
        return true;
      }
      
      // Need to convert to INR
      console.log(`🔄 Converting ${currencyCode} to INR for invoice ${invoiceId}`);
      
      // Use fallback rates for reliability - Updated with current market rates (Aug 2025)
      const fallbackRates: { [key: string]: number } = {
        'USD': 83.0,      // 1 USD = 83.0 INR
        'GBP': 105.0,     // 1 GBP = 105.0 INR  
        'EUR': 101.15,    // 1 EUR = 101.15 INR (updated from 90.0)
        'AUD': 55.0,      // 1 AUD = 55.0 INR
        'CAD': 61.0,      // 1 CAD = 61.0 INR
        'SGD': 62.0,      // 1 SGD = 62.0 INR
        'AED': 22.5,      // 1 AED = 22.5 INR
        'SAR': 22.0,      // 1 SAR = 22.0 INR
        'JPY': 0.56,      // 1 JPY = 0.56 INR
        'CNY': 11.5       // 1 CNY = 11.5 INR
      };
      
      const exchangeRate = fallbackRates[currencyCode] || 1.0;
      const inrTotalAmount = Math.round((invoice.total_amount * exchangeRate) * 100) / 100;
      const inrSubtotal = Math.round((invoice.subtotal * exchangeRate) * 100) / 100;
      const inrTaxAmount = Math.round((invoice.tax_amount * exchangeRate) * 100) / 100;
      
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          original_currency_code: currencyCode,
          original_total_amount: invoice.total_amount,
          original_subtotal: invoice.subtotal,
          original_tax_amount: invoice.tax_amount,
          inr_total_amount: inrTotalAmount,
          inr_subtotal: inrSubtotal,
          inr_tax_amount: inrTaxAmount,
          exchange_rate: exchangeRate,
          exchange_rate_date: invoice.invoice_date
        })
        .eq('id', invoiceId);
        
      if (updateError) {
        console.error(`❌ Failed to update invoice ${invoiceId} with INR amounts:`, updateError);
        return false;
      }
      
      console.log(`✅ Fixed invoice ${invoiceId}: ${currencyCode} ${invoice.total_amount} → INR ${inrTotalAmount} (rate: ${exchangeRate})`);
      return true;
    } catch (error) {
      console.error(`❌ Currency fix failed for invoice ${invoiceId}:`, error);
      return false;
    }
  }

  /**
   * Fix missing INR amounts for existing invoices
   * This method should be called to update invoices that were created before multi-currency support
   */
  async fixMissingINRAmounts(): Promise<{ updated: number; errors: string[] }> {
    console.log('🔧 Starting to fix missing INR amounts for existing invoices...');

    try {
      // Check authentication first
      const currentUser = await simpleAuth.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Get all invoices with missing INR amounts or where INR amount seems incorrect
      console.log('📋 Fetching invoices that need INR amount fixes...');
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, currency_code, original_currency_code, total_amount, original_total_amount, inr_total_amount, subtotal, original_subtotal, inr_subtotal, tax_amount, original_tax_amount, inr_tax_amount, invoice_date, exchange_rate')
        .or('inr_total_amount.is.null,and(currency_code.neq.INR,inr_total_amount.lt.10),and(currency_code.neq.INR,inr_total_amount.eq.total_amount)');

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      if (!invoices || invoices.length === 0) {
        console.log('✅ No invoices need INR amount fixes');
        return { updated: 0, errors: [] };
      }

      console.log(`📊 Found ${invoices.length} invoices that need INR amount fixes`);

      let updated = 0;
      const errors: string[] = [];

      for (const invoice of invoices) {
        try {
          const currencyCode = invoice.original_currency_code || invoice.currency_code;
          
          if (currencyCode === 'INR') {
            // For INR invoices, INR amount should equal original amount
            console.log(`💰 Fixing INR invoice ${invoice.id}`);
            const { error: updateError } = await supabase
              .from('invoices')
              .update({
                inr_total_amount: invoice.original_total_amount || invoice.total_amount,
                inr_subtotal: invoice.original_subtotal || invoice.subtotal,
                inr_tax_amount: invoice.original_tax_amount || invoice.tax_amount,
                exchange_rate: 1.0
              })
              .eq('id', invoice.id);

            if (updateError) {
              console.error(`❌ Failed to update INR invoice ${invoice.id}:`, updateError);
              throw updateError;
            }
            updated++;
            console.log(`✅ Fixed INR invoice ${invoice.id}`);
          } else {
            // For non-INR invoices, convert to INR using exchange rate service
            const totalAmount = invoice.original_total_amount || invoice.total_amount;
            const subtotal = invoice.original_subtotal || invoice.subtotal;
            const taxAmount = invoice.original_tax_amount || invoice.tax_amount;

            console.log(`🔄 Converting ${currencyCode} amounts to INR for invoice ${invoice.id}`);

            try {
              const exchangeRate = await exchangeRateService.getExchangeRate(currencyCode, 'INR', invoice.invoice_date) || 1.0;
              const inrTotalAmount = await exchangeRateService.convertToINR(totalAmount, currencyCode, invoice.invoice_date);
              const inrSubtotal = await exchangeRateService.convertToINR(subtotal, currencyCode, invoice.invoice_date);
              const inrTaxAmount = await exchangeRateService.convertToINR(taxAmount, currencyCode, invoice.invoice_date);

              console.log(`💱 Conversion results: ${currencyCode} ${totalAmount} -> INR ${inrTotalAmount} (rate: ${exchangeRate})`);

              const { error: updateError } = await supabase
                .from('invoices')
                .update({
                  original_currency_code: currencyCode,
                  original_total_amount: totalAmount,
                  original_subtotal: subtotal,
                  original_tax_amount: taxAmount,
                  inr_total_amount: inrTotalAmount,
                  inr_subtotal: inrSubtotal,
                  inr_tax_amount: inrTaxAmount,
                  exchange_rate: exchangeRate,
                  exchange_rate_date: invoice.invoice_date
                })
                .eq('id', invoice.id);

              if (updateError) {
                console.error(`❌ Failed to update non-INR invoice ${invoice.id}:`, updateError);
                throw updateError;
              }
              updated++;
              console.log(`✅ Fixed non-INR invoice ${invoice.id}: ${currencyCode} ${totalAmount} -> INR ${inrTotalAmount} (rate: ${exchangeRate})`);
            } catch (conversionError) {
              console.warn(`⚠️ Conversion failed for invoice ${invoice.id}, using fallback (rate=1.0)`);
              // Fallback: use 1:1 conversion if exchange rate service fails
              const { error: updateError } = await supabase
                .from('invoices')
                .update({
                  original_currency_code: currencyCode,
                  original_total_amount: totalAmount,
                  original_subtotal: subtotal,
                  original_tax_amount: taxAmount,
                  inr_total_amount: totalAmount, // Fallback 1:1
                  inr_subtotal: subtotal,
                  inr_tax_amount: taxAmount,
                  exchange_rate: 1.0,
                  exchange_rate_date: invoice.invoice_date
                })
                .eq('id', invoice.id);

              if (updateError) throw updateError;
              updated++;
              console.log(`✅ Fixed invoice ${invoice.id} with fallback conversion`);
            }
          }
        } catch (error) {
          const errorMsg = `Failed to fix invoice ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`🎉 INR amount fix completed: ${updated} invoices updated, ${errors.length} errors`);
      return { updated, errors };
    } catch (error) {
      console.error('💥 Failed to fix missing INR amounts:', error);
      throw error;
    }
  }

  /**
   * Quick fix for missing INR amounts using fallback exchange rates
   * This is a simpler version that doesn't rely on external APIs
   */
  async quickFixMissingINRAmounts(): Promise<{ updated: number; errors: string[] }> {
    console.log('🔧 Starting quick fix for missing INR amounts using fallback rates...');

    try {
      // Check authentication first
      const currentUser = await simpleAuth.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Simple fallback exchange rates (approximate values)
      const fallbackRates: { [key: string]: number } = {
        'USD': 83.0,
        'GBP': 105.0,
        'EUR': 90.0,
        'AUD': 55.0,
        'CAD': 61.0,
        'SGD': 62.0,
        'AED': 22.5,
        'SAR': 22.0,
        'JPY': 0.56,
        'CNY': 11.5,
        'INR': 1.0
      };

      // Get all invoices with missing or incorrect INR amounts
      console.log('📋 Fetching invoices that need INR amount fixes...');
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, currency_code, original_currency_code, total_amount, original_total_amount, inr_total_amount, subtotal, original_subtotal, inr_subtotal, tax_amount, original_tax_amount, inr_tax_amount, invoice_date')
        .or('inr_total_amount.is.null,and(currency_code.neq.INR,inr_total_amount.lt.10),and(currency_code.neq.INR,inr_total_amount.eq.total_amount)');

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      if (!invoices || invoices.length === 0) {
        console.log('✅ No invoices need INR amount fixes');
        return { updated: 0, errors: [] };
      }

      console.log(`📊 Found ${invoices.length} invoices that need INR amount fixes`);

      let updated = 0;
      const errors: string[] = [];

      for (const invoice of invoices) {
        try {
          const currencyCode = invoice.original_currency_code || invoice.currency_code || 'INR';
          const totalAmount = invoice.original_total_amount || invoice.total_amount;
          const subtotal = invoice.original_subtotal || invoice.subtotal;
          const taxAmount = invoice.original_tax_amount || invoice.tax_amount;

          const exchangeRate = fallbackRates[currencyCode] || 1.0;
          const inrTotalAmount = totalAmount * exchangeRate;
          const inrSubtotal = subtotal * exchangeRate;
          const inrTaxAmount = taxAmount * exchangeRate;

          console.log(`💱 Converting ${currencyCode} ${totalAmount} -> INR ${inrTotalAmount} (rate: ${exchangeRate})`);

          const { error: updateError } = await supabase
            .from('invoices')
            .update({
              original_currency_code: currencyCode,
              original_total_amount: totalAmount,
              original_subtotal: subtotal,
              original_tax_amount: taxAmount,
              inr_total_amount: Math.round(inrTotalAmount * 100) / 100, // Round to 2 decimal places
              inr_subtotal: Math.round(inrSubtotal * 100) / 100,
              inr_tax_amount: Math.round(inrTaxAmount * 100) / 100,
              exchange_rate: exchangeRate,
              exchange_rate_date: invoice.invoice_date
            })
            .eq('id', invoice.id);

          if (updateError) {
            console.error(`❌ Failed to update invoice ${invoice.id}:`, updateError);
            throw updateError;
          }
          
          updated++;
          console.log(`✅ Fixed invoice ${invoice.id}: ${currencyCode} ${totalAmount} -> INR ${Math.round(inrTotalAmount * 100) / 100}`);
        } catch (error) {
          const errorMsg = `Failed to fix invoice ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`🎉 Quick fix completed: ${updated} invoices updated, ${errors.length} errors`);
      return { updated, errors };
    } catch (error) {
      console.error('💥 Failed to quick fix missing INR amounts:', error);
      throw error;
    }
  }

  /**
   * Force fix ALL invoices with currency conversion (more aggressive)
   * This will recalculate INR amounts for all non-INR invoices regardless of current state
   */
  async forceFixAllCurrencyConversions(): Promise<{ updated: number; errors: string[] }> {
    console.log('🔧 Starting FORCE fix for ALL invoice currency conversions...');

    try {
      // Check authentication first
      const currentUser = await simpleAuth.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Simple fallback exchange rates (approximate values)
      const fallbackRates: { [key: string]: number } = {
        'USD': 83.0,
        'GBP': 105.0,
        'EUR': 90.0,
        'AUD': 55.0,
        'CAD': 61.0,
        'SGD': 62.0,
        'AED': 22.5,
        'SAR': 22.0,
        'JPY': 0.56,
        'CNY': 11.5,
        'INR': 1.0
      };

      // Get ALL invoices to force fix them
      console.log('📋 Fetching ALL invoices for force currency fix...');
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, currency_code, original_currency_code, total_amount, original_total_amount, inr_total_amount, subtotal, original_subtotal, inr_subtotal, tax_amount, original_tax_amount, inr_tax_amount, invoice_date');

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      if (!invoices || invoices.length === 0) {
        console.log('✅ No invoices found');
        return { updated: 0, errors: [] };
      }

      console.log(`📊 Found ${invoices.length} invoices for force currency fix`);

      let updated = 0;
      const errors: string[] = [];

      for (const invoice of invoices) {
        try {
          const currencyCode = invoice.original_currency_code || invoice.currency_code || 'INR';
          const totalAmount = invoice.original_total_amount || invoice.total_amount;
          const subtotal = invoice.original_subtotal || invoice.subtotal;
          const taxAmount = invoice.original_tax_amount || invoice.tax_amount;

          console.log(`🔄 Force fixing invoice ${invoice.id}: ${currencyCode} ${totalAmount}`);

          if (currencyCode === 'INR') {
            // For INR invoices, INR amount should equal original amount
            const { error: updateError } = await supabase
              .from('invoices')
              .update({
                original_currency_code: 'INR',
                original_total_amount: totalAmount,
                original_subtotal: subtotal,
                original_tax_amount: taxAmount,
                inr_total_amount: totalAmount,
                inr_subtotal: subtotal,
                inr_tax_amount: taxAmount,
                exchange_rate: 1.0,
                exchange_rate_date: invoice.invoice_date
              })
              .eq('id', invoice.id);

            if (updateError) {
              console.error(`❌ Failed to update INR invoice ${invoice.id}:`, updateError);
              throw updateError;
            }
            console.log(`✅ Force fixed INR invoice ${invoice.id}: INR ${totalAmount}`);
          } else {
            // For non-INR invoices, convert using fallback rates
            const exchangeRate = fallbackRates[currencyCode] || 1.0;
            const inrTotalAmount = totalAmount * exchangeRate;
            const inrSubtotal = subtotal * exchangeRate;
            const inrTaxAmount = taxAmount * exchangeRate;

            const { error: updateError } = await supabase
              .from('invoices')
              .update({
                original_currency_code: currencyCode,
                original_total_amount: totalAmount,
                original_subtotal: subtotal,
                original_tax_amount: taxAmount,
                inr_total_amount: Math.round(inrTotalAmount * 100) / 100,
                inr_subtotal: Math.round(inrSubtotal * 100) / 100,
                inr_tax_amount: Math.round(inrTaxAmount * 100) / 100,
                exchange_rate: exchangeRate,
                exchange_rate_date: invoice.invoice_date
              })
              .eq('id', invoice.id);

            if (updateError) {
              console.error(`❌ Failed to update invoice ${invoice.id}:`, updateError);
              throw updateError;
            }
            console.log(`✅ Force fixed invoice ${invoice.id}: ${currencyCode} ${totalAmount} -> INR ${Math.round(inrTotalAmount * 100) / 100} (rate: ${exchangeRate})`);
          }
          
          updated++;
        } catch (error) {
          const errorMsg = `Failed to force fix invoice ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`🎉 Force fix completed: ${updated} invoices updated, ${errors.length} errors`);
      return { updated, errors };
    } catch (error) {
      console.error('💥 Failed to force fix currency conversions:', error);
      throw error;
    }
  }

  /**
   * Create invoice(s) from a quote with optional split capability
   * @param quoteId - The quote ID to convert
   * @param splitOptions - Optional array of item indices for each invoice (for split invoices)
   * @returns Array of created invoice IDs and numbers
   */
  async createInvoicesFromQuote(
    quoteId: string,
    splitOptions?: { itemIndices: number[]; dueDate?: string }[]
  ): Promise<{ invoiceId: string; invoiceNumber: string }[]> {
    const quote = await quoteService.getQuoteById(quoteId);
    if (!quote) {
      throw new Error('Quote not found');
    }

    if (quote.status === 'converted') {
      throw new Error('Quote has already been converted to an invoice');
    }

    if (!quote.quote_items || quote.quote_items.length === 0) {
      throw new Error('Quote has no items to convert');
    }

    const invoiceSettings = await this.getInvoiceSettings(quote.company_settings_id);
    const dueDays = invoiceSettings?.due_days || 30;

    const invoices: { invoiceId: string; invoiceNumber: string }[] = [];

    // If no split options provided, create a single invoice with all items
    if (!splitOptions || splitOptions.length === 0) {
      const defaultDueDate = new Date();
      defaultDueDate.setDate(defaultDueDate.getDate() + dueDays);

      const invoiceData: CreateInvoiceData = {
        customer_id: quote.customer_id,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: defaultDueDate.toISOString().split('T')[0],
        // Copy project details from quote
        project_title: quote.project_title,
        estimated_time: quote.estimated_time,
        company_contact_name: quote.company_contact_name,
        company_contact_email: quote.company_contact_email,
        company_contact_phone: quote.company_contact_phone,
        // Copy discount
        discount_type: quote.discount_type,
        discount_value: quote.discount_value,
        // Quote reference
        created_from_quote_id: quote.id,
        quote_reference: quote.quote_number,
        // Additional info
        notes: quote.notes || `Generated from Quote: ${quote.quote_number}`,
        terms_conditions: quote.terms_conditions || '',
        items: quote.quote_items.map(item => ({
          product_id: item.product_id,
          item_name: item.item_name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          hsn_code: item.hsn_code,
          billable_hours: item.billable_hours,
          resource_count: item.resource_count,
          is_service_item: item.is_service_item
        }))
      };

      const invoice = await this.createInvoice(invoiceData, undefined, quote.company_settings_id);
      invoices.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number
      });
    } else {
      // Create multiple invoices (split invoice functionality)
      for (let i = 0; i < splitOptions.length; i++) {
        const option = splitOptions[i];
        const itemIndices = option.itemIndices;

        if (itemIndices.length === 0) {
          continue; // Skip empty splits
        }

        const selectedItems = itemIndices
          .filter(idx => idx >= 0 && idx < quote.quote_items!.length)
          .map(idx => quote.quote_items![idx]);

        if (selectedItems.length === 0) {
          continue; // Skip if no valid items
        }

        const splitDueDate = option.dueDate || (() => {
          const date = new Date();
          date.setDate(date.getDate() + dueDays);
          return date.toISOString().split('T')[0];
        })();

        const invoiceData: CreateInvoiceData = {
          customer_id: quote.customer_id,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: splitDueDate,
          // Copy project details from quote
          project_title: quote.project_title,
          estimated_time: quote.estimated_time,
          company_contact_name: quote.company_contact_name,
          company_contact_email: quote.company_contact_email,
          company_contact_phone: quote.company_contact_phone,
          // Note: Discount is not applied to split invoices for accuracy
          // Quote reference
          created_from_quote_id: quote.id,
          quote_reference: `${quote.quote_number} (Split ${i + 1}/${splitOptions.length})`,
          // Additional info
          notes: quote.notes || `Generated from Quote: ${quote.quote_number} - Part ${i + 1} of ${splitOptions.length}`,
          terms_conditions: quote.terms_conditions || '',
          items: selectedItems.map(item => ({
            product_id: item.product_id,
            item_name: item.item_name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            hsn_code: item.hsn_code,
            billable_hours: item.billable_hours,
            resource_count: item.resource_count,
            is_service_item: item.is_service_item
          }))
        };

        const invoice = await this.createInvoice(invoiceData, undefined, quote.company_settings_id);
        invoices.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number
        });
      }
    }

    // Update quote status to converted
    await supabase
      .from('quotes')
      .update({
        status: 'converted',
        converted_to_invoice_id: invoices[0].invoiceId, // Reference the first invoice
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId);

    return invoices;
  }
}

export const invoiceService = new InvoiceService();
