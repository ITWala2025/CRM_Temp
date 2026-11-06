import { supabase, isSupabaseConfigured, isMockMode } from '../config/supabase';
import { mockStore } from '../data/mockStore';
import { simpleAuth } from '../utils/simpleAuth';
import { exchangeRateService } from './exchangeRateService';
import { invoiceService } from './invoiceService';
import type {
  Quote,
  QuoteItem,
  QuoteSettings,
  QuoteStats,
  QuoteFilters,
  CreateQuoteData,
  CreateQuoteItemData,
  UpdateQuoteData,
  CreateQuoteSettingsData,
  UpdateQuoteSettingsData,
  QuotePaginatedResponse,
  Customer,
  CompanySettings
} from '../types/quote';

class QuoteService {
  /**
   * Calculate the current financial year based on the financial year start month
   */
  private calculateFinancialYear(fyStartMonth: number = 4, currentDate: Date = new Date()): string {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    if (currentMonth >= fyStartMonth) {
      return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    } else {
      return `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    }
  }

  /**
   * Check if we're at the start of a new financial year
   */
  private isNewFinancialYear(currentFY: string | null, calculatedFY: string): boolean {
    return currentFY !== calculatedFY;
  }

  // Quote Settings
  async getQuoteSettings(): Promise<QuoteSettings | null> {
    if (isMockMode || !isSupabaseConfigured) {
      const stored = mockStore.get<QuoteSettings>('quote_settings');
      if (stored && !Array.isArray(stored)) {
        return stored;
      }
      return {
        id: 'quote-settings-001',
        quote_prefix: 'QTE/IRL/',
        quote_suffix: '',
        number_format: 'QTE/IRL/YYYY/XXXX',
        current_number: 104,
        reset_annually: true,
        financial_year_start_month: 1,
        current_financial_year: '2026',
        validity_days: 30,
        notes: 'This quote is valid for 30 calendar days from issue date under Irish commercial terms.',
        footer_text: 'Acme Cloud Technologies Ireland Limited • VAT ID: IE987654321A • Registered in Dublin, Ireland',
        default_tax_rate: 23,
        enable_gst: false,
        template_name: 'standard',
        currency_position: 'before',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured. Please contact the administrator.');
    }

    const { data, error } = await supabase
      .from('quote_settings')
      .select('*')
      .eq('is_active', true)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateQuoteSettings(id: string, settings: UpdateQuoteSettingsData): Promise<QuoteSettings> {
    const { data, error } = await supabase
      .from('quote_settings')
      .update(settings)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  async createQuoteSettings(settings: CreateQuoteSettingsData): Promise<QuoteSettings> {
    const { data, error } = await supabase
      .from('quote_settings')
      .insert({
        ...settings,
        is_active: true,
        current_number: 1
      })
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  // Quote Number Generation
  async previewQuoteNumber(): Promise<string> {
    const settings = await this.getQuoteSettings();
    if (!settings) throw new Error('Quote settings not found');

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const fyStartMonth = settings.financial_year_start_month || 4;
    const currentFinancialYear = this.calculateFinancialYear(fyStartMonth, currentDate);
    
    let nextSequentialNumber = settings.current_number;
    
    let actualQuoteCount = 0;
    if (isMockMode || !isSupabaseConfigured) {
      actualQuoteCount = mockStore.get<Quote>('quotes').length;
    } else {
      const { count: quoteCount } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true });
      actualQuoteCount = quoteCount || 0;
    }
    
    if (actualQuoteCount === 0) {
      nextSequentialNumber = 1;
    } else if (settings.reset_annually && this.isNewFinancialYear(settings.current_financial_year, currentFinancialYear)) {
      nextSequentialNumber = 1;
    } else if (actualQuoteCount > 0 && settings.current_number > actualQuoteCount + 1) {
      nextSequentialNumber = actualQuoteCount + 1;
    }

    let previewNumber = settings.number_format;
    
    previewNumber = previewNumber.replace(/PREFIX/g, settings.quote_prefix);
    previewNumber = previewNumber.replace(/YYYY/g, currentYear.toString());
    previewNumber = previewNumber.replace(/MM/g, currentMonth.toString().padStart(2, '0'));
    
    const numberStr = nextSequentialNumber < 1000 
      ? nextSequentialNumber.toString().padStart(3, '0')
      : nextSequentialNumber.toString();
    
    previewNumber = previewNumber.replace(/####/g, numberStr);
    previewNumber = previewNumber.replace(/###/g, numberStr);
    previewNumber = previewNumber.replace(/NNNN/g, numberStr);
    previewNumber = previewNumber.replace(/NNN/g, numberStr);
    
    if (settings.quote_suffix) {
      previewNumber = previewNumber.replace(/SUFFIX/g, settings.quote_suffix);
    }

    return previewNumber;
  }

  async generateQuoteNumber(): Promise<string> {
    const settings = await this.getQuoteSettings();
    if (!settings) throw new Error('Quote settings not found');

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const fyStartMonth = settings.financial_year_start_month || 4;
    const currentFinancialYear = this.calculateFinancialYear(fyStartMonth, currentDate);
    
    let nextSequentialNumber = settings.current_number;
    
    let actualQuoteCount = 0;
    if (isMockMode || !isSupabaseConfigured) {
      actualQuoteCount = mockStore.get<Quote>('quotes').length;
    } else {
      const { count: quoteCount } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true });
      actualQuoteCount = quoteCount || 0;
    }
    
    if (actualQuoteCount === 0) {
      nextSequentialNumber = 1;
    } else if (settings.reset_annually && this.isNewFinancialYear(settings.current_financial_year, currentFinancialYear)) {
      nextSequentialNumber = 1;
    } else if (actualQuoteCount > 0 && settings.current_number > actualQuoteCount + 1) {
      nextSequentialNumber = actualQuoteCount + 1;
    }

    let quoteNumber = settings.number_format;
    
    quoteNumber = quoteNumber.replace(/PREFIX/g, settings.quote_prefix);
    quoteNumber = quoteNumber.replace(/YYYY/g, currentYear.toString());
    quoteNumber = quoteNumber.replace(/MM/g, currentMonth.toString().padStart(2, '0'));
    
    const numberStr = nextSequentialNumber < 1000 
      ? nextSequentialNumber.toString().padStart(3, '0')
      : nextSequentialNumber.toString();
    
    quoteNumber = quoteNumber.replace(/####/g, numberStr);
    quoteNumber = quoteNumber.replace(/###/g, numberStr);
    quoteNumber = quoteNumber.replace(/NNNN/g, numberStr);
    quoteNumber = quoteNumber.replace(/NNN/g, numberStr);
    
    if (settings.quote_suffix) {
      quoteNumber = quoteNumber.replace(/SUFFIX/g, settings.quote_suffix);
    }

    // Update current number in database
    await supabase
      .from('quote_settings')
      .update({ 
        current_number: nextSequentialNumber + 1,
        current_financial_year: currentFinancialYear
      })
      .eq('id', settings.id);

    return quoteNumber;
  }

  // Quotes CRUD
  async getQuotes(filters?: QuoteFilters, page: number = 1, perPage: number = 20): Promise<QuotePaginatedResponse<Quote>> {
    if (isMockMode) {
      let list = mockStore.get<Quote>('quotes');
      if (filters) {
        if (filters.search) {
          const s = filters.search.toLowerCase();
          list = list.filter((q) => q.quote_number.toLowerCase().includes(s) || (q.project_title && q.project_title.toLowerCase().includes(s)));
        }
        if (filters.status) {
          list = list.filter((q) => q.status === filters.status);
        }
        if (filters.customer_id) {
          list = list.filter((q) => q.customer_id === filters.customer_id);
        }
        if (filters.company_settings_id) {
          list = list.filter((q) => q.company_settings_id === filters.company_settings_id);
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
      .from('quotes')
      .select(`
        *,
        customer:customers(*),
        company_settings:company_settings(*),
        quote_items:quote_items(
          *,
          product:products(*)
        )
      `, { count: 'exact' });

    if (filters) {
      if (filters.search) {
        query = query.or(`quote_number.ilike.%${filters.search}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters.date_from) {
        query = query.gte('quote_date', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('quote_date', filters.date_to);
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

  async getQuoteById(id: string): Promise<Quote | null> {
    if (isMockMode) {
      return mockStore.getById<Quote>('quotes', id) || null;
    }

    const { data, error } = await supabase
      .from('quotes')
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
        quote_items:quote_items(
          *,
          product:products(*)
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async createQuote(quoteData: CreateQuoteData, quoteNumber?: string, companySettingsId?: string): Promise<Quote> {
    let finalQuoteNumber: string;
    
    if (quoteNumber) {
      finalQuoteNumber = quoteNumber;
    } else {
      finalQuoteNumber = await this.generateQuoteNumber();
    }

    if (isMockMode || !isSupabaseConfigured) {
      const customers = mockStore.get<Customer>('customers');
      const foundCustomer = customers.find(c => c.id === quoteData.customer_id) || customers[0];
      const companies = mockStore.get<CompanySettings>('company_settings');
      const targetCompany = (companySettingsId && companies.find(c => c.id === companySettingsId))
        || companies.find(c => c.is_default)
        || companies[0];

      let subtotal = 0;
      let taxAmount = 0;
      const quoteItems: QuoteItem[] = (quoteData.items || []).map((item, idx) => {
        const lineTotal = (item.quantity || 1) * (item.unit_price || 0);
        const itemTax = (lineTotal * (item.tax_rate ?? 23)) / 100;
        subtotal += lineTotal;
        taxAmount += itemTax;
        return {
          id: `qitem-${Date.now()}-${idx}`,
          quote_id: '',
          item_name: item.item_name || 'Service Item',
          description: item.description || '',
          quantity: item.quantity || 1,
          unit: item.unit || 'Month',
          unit_price: item.unit_price || 0,
          line_total: lineTotal,
          tax_rate: item.tax_rate ?? 23,
          tax_amount: itemTax,
          created_at: new Date().toISOString(),
        };
      });

      let discountAmount = 0;
      if (quoteData.discount_type && quoteData.discount_value) {
        if (quoteData.discount_type === 'percentage') {
          discountAmount = (subtotal * quoteData.discount_value) / 100;
        } else {
          discountAmount = quoteData.discount_value;
        }
      }
      const discountedSubtotal = subtotal - discountAmount;
      const averageTaxRate = taxAmount > 0 ? (taxAmount / (subtotal || 1)) * 100 : 23;
      const adjustedTaxAmount = (discountedSubtotal * averageTaxRate) / 100;
      const totalAmount = discountedSubtotal + adjustedTaxAmount;

      const currencyCode = foundCustomer?.country?.currency_code || targetCompany?.country?.currency_code || 'EUR';

      const newQuote: Quote = {
        id: `quote-${Date.now()}`,
        quote_number: finalQuoteNumber,
        customer_id: foundCustomer?.id || quoteData.customer_id,
        customer: foundCustomer,
        company_settings_id: targetCompany?.id || 'comp-irl-002',
        company_settings: targetCompany,
        project_title: quoteData.project_title,
        quote_date: quoteData.quote_date,
        valid_until: quoteData.valid_until,
        subtotal,
        discount_amount: discountAmount,
        discount_type: quoteData.discount_type || undefined,
        discount_value: quoteData.discount_value || undefined,
        tax_amount: adjustedTaxAmount,
        total_amount: totalAmount,
        currency_code: currencyCode,
        status: 'draft',
        notes: quoteData.notes || '',
        terms_conditions: quoteData.terms_conditions || '',
        quote_items: quoteItems,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      newQuote.quote_items?.forEach(it => { it.quote_id = newQuote.id; });

      mockStore.insert<Quote>('quotes', newQuote);
      return newQuote;
    }
    
    let companySettings = null;
    if (companySettingsId) {
      const { data: cs } = await supabase
        .from('company_settings')
        .select(`*, country:countries(*)`)
        .eq('id', companySettingsId)
        .eq('is_active', true)
        .single();
      companySettings = cs;
    }
    if (!companySettings) {
      const { data: defaultCs, error: companyError } = await supabase
        .from('company_settings')
        .select(`*, country:countries(*)`)
        .eq('is_default', true)
        .eq('is_active', true)
        .single();
      if (companyError || !defaultCs) {
        throw new Error('Default company settings not found');
      }
      companySettings = defaultCs;
    }

    // Get current user
    const currentUser = await simpleAuth.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Get customer to determine currency
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`*, country:countries(*)`)
      .eq('id', quoteData.customer_id)
      .single();
    
    if (customerError) throw customerError;

    let currencyCode = 'INR';
    if (customer && customer.country) {
      currencyCode = customer.country.currency_code;
    }

    // Calculate totals in original currency
    let subtotal = 0;
    let taxAmount = 0;

    quoteData.items.forEach(item => {
      const lineTotal = item.quantity * item.unit_price;
      const itemTax = (lineTotal * item.tax_rate) / 100;
      subtotal += lineTotal;
      taxAmount += itemTax;
    });

    // Calculate discount
    let discountAmount = 0;
    if (quoteData.discount_type && quoteData.discount_value) {
      if (quoteData.discount_type === 'percentage') {
        discountAmount = (subtotal * quoteData.discount_value) / 100;
      } else {
        discountAmount = quoteData.discount_value;
      }
    }

    // Recalculate tax on discounted subtotal
    const discountedSubtotal = subtotal - discountAmount;
    const averageTaxRate = taxAmount > 0 ? (taxAmount / subtotal) * 100 : 0;
    const adjustedTaxAmount = (discountedSubtotal * averageTaxRate) / 100;

    const totalAmount = discountedSubtotal + adjustedTaxAmount;

    // Get exchange rate and convert to INR
    const quoteDate = quoteData.quote_date.split('T')[0];
    let exchangeRate = 1.0;
    let inrSubtotal = subtotal;
    let inrTaxAmount = taxAmount;
    let inrTotalAmount = totalAmount;

    if (currencyCode !== 'INR') {
      try {
        const serviceRate = await exchangeRateService.getExchangeRate(currencyCode, 'INR', quoteDate);
        
        if (serviceRate && serviceRate > 0) {
          exchangeRate = serviceRate;
          inrSubtotal = await exchangeRateService.convertToINR(subtotal, currencyCode, quoteDate);
          inrTaxAmount = await exchangeRateService.convertToINR(adjustedTaxAmount, currencyCode, quoteDate);
          inrTotalAmount = await exchangeRateService.convertToINR(totalAmount, currencyCode, quoteDate);
        }
      } catch (error) {
        console.error('Currency conversion failed:', error);
        throw new Error(`Currency conversion failed for ${currencyCode}`);
      }
    }

    // Create quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        quote_number: finalQuoteNumber,
        customer_id: quoteData.customer_id,
        company_settings_id: companySettings.id,
        // Project details
        project_title: quoteData.project_title,
        estimated_time: quoteData.estimated_time,
        company_contact_name: quoteData.company_contact_name,
        company_contact_email: quoteData.company_contact_email,
        company_contact_phone: quoteData.company_contact_phone,
        // Quote dates
        quote_date: quoteData.quote_date,
        valid_until: quoteData.valid_until,
        subtotal,
        // Discount fields
        discount_type: quoteData.discount_type || null,
        discount_value: quoteData.discount_value || 0,
        discount_amount: discountAmount,
        tax_amount: adjustedTaxAmount,
        total_amount: totalAmount,
        currency_code: currencyCode,
        original_currency_code: currencyCode,
        original_subtotal: subtotal,
        original_tax_amount: adjustedTaxAmount,
        original_total_amount: totalAmount,
        exchange_rate: exchangeRate,
        exchange_rate_date: quoteDate,
        inr_subtotal: inrSubtotal,
        inr_tax_amount: inrTaxAmount,
        inr_total_amount: inrTotalAmount,
        notes: quoteData.notes,
        terms_conditions: quoteData.terms_conditions,
        created_by: currentUser.id
      })
      .select('*')
      .single();

    if (quoteError) throw quoteError;

    // Create quote items
    const itemsWithCalculations = await Promise.all(quoteData.items.map(async (item) => {
      // Calculate line total based on item type
      let lineTotal = 0;
      if (item.is_service_item && item.billable_hours) {
        const resourceCount = item.resource_count || 1;
        lineTotal = resourceCount * item.quantity * item.billable_hours * item.unit_price;
      } else {
        lineTotal = item.quantity * item.unit_price;
      }
      
      const itemTaxAmount = (lineTotal * item.tax_rate) / 100;
      
      let inrUnitPrice = item.unit_price;
      let inrLineTotal = lineTotal;
      let inrItemTaxAmount = itemTaxAmount;

      if (currencyCode !== 'INR') {
        inrUnitPrice = await exchangeRateService.convertToINR(item.unit_price, currencyCode, quoteDate);
        inrLineTotal = await exchangeRateService.convertToINR(lineTotal, currencyCode, quoteDate);
        inrItemTaxAmount = await exchangeRateService.convertToINR(itemTaxAmount, currencyCode, quoteDate);
      }
      
      return {
        quote_id: quote.id,
        product_id: item.product_id || null,
        item_name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        line_total: lineTotal,
        tax_rate: item.tax_rate,
        tax_amount: itemTaxAmount,
        original_unit_price: item.unit_price,
        original_line_total: lineTotal,
        original_tax_amount: itemTaxAmount,
        inr_unit_price: inrUnitPrice,
        inr_line_total: inrLineTotal,
        inr_tax_amount: inrItemTaxAmount,
        hsn_code: item.hsn_code || null,
        billable_hours: item.billable_hours || null,
        resource_count: item.resource_count || null,
        is_service_item: item.is_service_item || false
      };
    }));

    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(itemsWithCalculations);

    if (itemsError) throw itemsError;

    return this.getQuoteById(quote.id) as Promise<Quote>;
  }

  async updateQuote(id: string, quoteData: UpdateQuoteData): Promise<Quote> {
    if (isMockMode || !isSupabaseConfigured) {
      const existing = mockStore.get<Quote>('quotes').find(q => q.id === id);
      if (!existing) throw new Error('Quote not found');
      const updated = {
        ...existing,
        ...quoteData,
        updated_at: new Date().toISOString(),
      };
      mockStore.update<Quote>('quotes', id, updated);
      return updated as Quote;
    }

    // First update the basic quote fields
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .update({
        customer_id: quoteData.customer_id,
        quote_date: quoteData.quote_date,
        valid_until: quoteData.valid_until,
        // Project details
        project_title: quoteData.project_title,
        estimated_time: quoteData.estimated_time,
        company_contact_name: quoteData.company_contact_name,
        company_contact_email: quoteData.company_contact_email,
        company_contact_phone: quoteData.company_contact_phone,
        // Discount fields
        discount_type: quoteData.discount_type || null,
        discount_value: quoteData.discount_value || 0,
        // Additional info
        notes: quoteData.notes,
        terms_conditions: quoteData.terms_conditions,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();
    
    if (quoteError) throw quoteError;

    // If items are provided, update them intelligently
    if (quoteData.items && quoteData.items.length > 0) {
      
      // Get customer to determine currency
      const { data: customer } = await supabase
        .from('customers')
        .select(`*, country:countries(*)`)
        .eq('id', quote.customer_id)
        .single();

      let currencyCode = 'INR';
      if (customer && customer.country) {
        currencyCode = customer.country.currency_code;
      }

      // Calculate totals and prepare items
      let subtotal = 0;
      let taxAmount = 0;
      const quoteDate = quoteData.quote_date?.split('T')[0] || quote.quote_date?.split('T')[0];

      let exchangeRate = 1.0;
      if (currencyCode !== 'INR') {
        const serviceRate = await exchangeRateService.getExchangeRate(currencyCode, 'INR', quoteDate);
        if (serviceRate && serviceRate > 0) {
          exchangeRate = serviceRate;
        }
      }

      // Separate items into: items with ID (update), items without ID (insert)
      const itemsToUpdate: any[] = [];
      const itemsToInsert: any[] = [];
      const providedItemIds = new Set<string>();

      for (const item of quoteData.items) {
        // Calculate line total based on item type
        let lineTotal = 0;
        if (item.is_service_item && item.billable_hours) {
          const resourceCount = item.resource_count || 1;
          lineTotal = resourceCount * item.quantity * item.billable_hours * item.unit_price;
        } else {
          lineTotal = item.quantity * item.unit_price;
        }
        
        const itemTaxAmount = (lineTotal * item.tax_rate) / 100;
        subtotal += lineTotal;
        taxAmount += itemTaxAmount;

        let inrUnitPrice = item.unit_price;
        let inrLineTotal = lineTotal;
        let inrItemTaxAmount = itemTaxAmount;

        if (currencyCode !== 'INR') {
          inrUnitPrice = await exchangeRateService.convertToINR(item.unit_price, currencyCode, quoteDate);
          inrLineTotal = await exchangeRateService.convertToINR(lineTotal, currencyCode, quoteDate);
          inrItemTaxAmount = await exchangeRateService.convertToINR(itemTaxAmount, currencyCode, quoteDate);
        }

        const itemData = {
          quote_id: id,
          product_id: item.product_id || null,
          item_name: item.item_name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          line_total: lineTotal,
          tax_rate: item.tax_rate,
          tax_amount: itemTaxAmount,
          original_unit_price: item.unit_price,
          original_line_total: lineTotal,
          original_tax_amount: itemTaxAmount,
          inr_unit_price: inrUnitPrice,
          inr_line_total: inrLineTotal,
          inr_tax_amount: inrItemTaxAmount,
          hsn_code: item.hsn_code || null,
          billable_hours: item.billable_hours || null,
          resource_count: item.resource_count || null,
          is_service_item: item.is_service_item || false
        };

        if (item.id) {
          // This is an existing item - UPDATE it
          itemsToUpdate.push({ ...itemData, id: item.id });
          providedItemIds.add(item.id);
        } else {
          // This is a new item - INSERT it
          itemsToInsert.push(itemData);
        }
      }

      // Get existing item IDs from database
      const { data: existingItems } = await supabase
        .from('quote_items')
        .select('id')
        .eq('quote_id', id);

      const existingItemIds = new Set(existingItems?.map(i => i.id) || []);
      
      // Find items to delete (in DB but not in provided list)
      const itemsToDelete = Array.from(existingItemIds).filter(itemId => !providedItemIds.has(itemId));

      // Execute updates
      if (itemsToUpdate.length > 0) {
        for (const item of itemsToUpdate) {
          const { id: itemId, ...updateData } = item;
          const { error: updateError } = await supabase
            .from('quote_items')
            .update(updateData)
            .eq('id', itemId);
          
          if (updateError) throw updateError;
        }
      }

      // Execute inserts
      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('quote_items')
          .insert(itemsToInsert);
        
        if (insertError) throw insertError;
      }

      // Execute deletes
      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('quote_items')
          .delete()
          .in('id', itemsToDelete);
        
        if (deleteError) throw deleteError;
      }

      // Calculate discount
      let discountAmount = 0;
      if (quoteData.discount_type && quoteData.discount_value) {
        if (quoteData.discount_type === 'percentage') {
          discountAmount = (subtotal * quoteData.discount_value) / 100;
        } else {
          discountAmount = quoteData.discount_value;
        }
      }

      // Recalculate tax on discounted subtotal
      const discountedSubtotal = subtotal - discountAmount;
      const averageTaxRate = taxAmount > 0 ? (taxAmount / subtotal) * 100 : 0;
      const adjustedTaxAmount = (discountedSubtotal * averageTaxRate) / 100;

      // Convert totals to INR
      const totalAmount = discountedSubtotal + adjustedTaxAmount;
      let inrSubtotal = subtotal;
      let inrTaxAmount = adjustedTaxAmount;
      let inrTotalAmount = totalAmount;

      if (currencyCode !== 'INR') {
        inrSubtotal = await exchangeRateService.convertToINR(subtotal, currencyCode, quoteDate);
        inrTaxAmount = await exchangeRateService.convertToINR(adjustedTaxAmount, currencyCode, quoteDate);
        inrTotalAmount = await exchangeRateService.convertToINR(totalAmount, currencyCode, quoteDate);
      }

      // Update quote totals
      await supabase
        .from('quotes')
        .update({
          subtotal,
          discount_type: quoteData.discount_type || null,
          discount_value: quoteData.discount_value || 0,
          discount_amount: discountAmount,
          tax_amount: adjustedTaxAmount,
          total_amount: totalAmount,
          currency_code: currencyCode,
          original_currency_code: currencyCode,
          original_subtotal: subtotal,
          original_tax_amount: adjustedTaxAmount,
          original_total_amount: totalAmount,
          exchange_rate: exchangeRate,
          exchange_rate_date: quoteDate,
          inr_subtotal: inrSubtotal,
          inr_tax_amount: inrTaxAmount,
          inr_total_amount: inrTotalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
    } else {
      // If no items were provided in the update, recalculate totals from existing items in database
      // This ensures data integrity - totals always match actual items
      const { data: existingItems } = await supabase
        .from('quote_items')
        .select('line_total, tax_amount')
        .eq('quote_id', id);

      if (existingItems && existingItems.length > 0) {
        // Recalculate totals from existing items
        const subtotal = existingItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
        const taxAmount = existingItems.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
        const totalAmount = subtotal + taxAmount;

        await supabase
          .from('quotes')
          .update({
            subtotal,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
      } else {
        // No items exist - reset totals to zero
        await supabase
          .from('quotes')
          .update({
            subtotal: 0,
            discount_amount: 0,
            tax_amount: 0,
            total_amount: 0,
            inr_subtotal: 0,
            inr_tax_amount: 0,
            inr_total_amount: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
      }
    }

    return this.getQuoteById(id) as Promise<Quote>;
  }

  async updateQuoteStatus(id: string, status: Quote['status']): Promise<Quote> {
    if (isMockMode || !isSupabaseConfigured) {
      const quote = mockStore.get<Quote>('quotes').find(q => q.id === id);
      if (!quote) throw new Error('Quote not found');
      const updated = { ...quote, status, updated_at: new Date().toISOString() };
      mockStore.update<Quote>('quotes', id, updated);
      return updated;
    }

    const { data, error } = await supabase
      .from('quotes')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
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
        quote_items:quote_items(
          *,
          product:products(*)
        )
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteQuote(id: string): Promise<void> {
    if (isMockMode || !isSupabaseConfigured) {
      mockStore.delete('quotes', id);
      return;
    }

    // Get current user for authentication check
    const currentUser = await simpleAuth.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Soft delete: mark as expired
    const { data, error } = await supabase
      .from('quotes')
      .update({ 
        status: 'expired', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Delete quote error:', error);
      throw new Error(`Failed to delete quote: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      throw new Error('Quote not found or already deleted');
    }
  }

  async duplicateQuote(id: string): Promise<Quote> {
    const originalQuote = await this.getQuoteById(id);
    if (!originalQuote) {
      throw new Error('Quote not found');
    }

    const settings = await this.getQuoteSettings();
    const validityDays = settings?.validity_days || 30;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validityDays);

    const newQuoteData: CreateQuoteData = {
      customer_id: originalQuote.customer_id,
      quote_date: new Date().toISOString().split('T')[0],
      valid_until: validUntil.toISOString().split('T')[0],
      notes: originalQuote.notes || '',
      terms_conditions: originalQuote.terms_conditions || '',
      items: originalQuote.quote_items?.map(item => ({
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

    return await this.createQuote(newQuoteData);
  }

  // Convert Quote to Invoice
  async convertToInvoice(quoteId: string): Promise<{ invoiceId: string; invoiceNumber: string }> {
    const quote = await this.getQuoteById(quoteId);
    if (!quote) {
      throw new Error('Quote not found');
    }

    if (quote.status === 'converted') {
      throw new Error('Quote has already been converted to an invoice');
    }

    // Create invoice from quote data
    const invoiceData = {
      customer_id: quote.customer_id,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: quote.notes || '',
      terms_conditions: quote.terms_conditions || '',
      items: quote.quote_items?.map(item => ({
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

    const invoice = await invoiceService.createInvoice(invoiceData, undefined, quote.company_settings_id);

    if (isMockMode || !isSupabaseConfigured) {
      const updated = {
        ...quote,
        status: 'converted' as const,
        converted_to_invoice_id: invoice.id,
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockStore.update<Quote>('quotes', quote.id, updated);
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
      };
    }

    // Update quote status to converted
    await supabase
      .from('quotes')
      .update({
        status: 'converted',
        converted_to_invoice_id: invoice.id,
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number
    };
  }

  // Dashboard Statistics
  async getQuoteStats(companySettingsId?: string): Promise<QuoteStats> {
    if (isMockMode) {
      let quotes = mockStore.get<Quote>('quotes');
      if (companySettingsId) {
        quotes = quotes.filter((q) => q.company_settings_id === companySettingsId);
      }
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      return {
        total_quotes: quotes.length,
        draft_quotes: quotes.filter((q) => q.status === 'draft').length,
        sent_quotes: quotes.filter((q) => q.status === 'sent').length,
        accepted_quotes: quotes.filter((q) => q.status === 'accepted').length,
        rejected_quotes: quotes.filter((q) => q.status === 'rejected').length,
        expired_quotes: quotes.filter((q) => q.status === 'expired').length,
        converted_quotes: quotes.filter((q) => q.status === 'converted').length,
        total_quoted_amount: quotes.filter((q) => q.status !== 'expired' && q.status !== 'rejected').reduce((sum, q) => sum + (q.total_amount || 0), 0),
        pending_amount: quotes.filter((q) => q.status === 'draft' || q.status === 'sent').reduce((sum, q) => sum + (q.total_amount || 0), 0),
        this_month_quotes: quotes.filter((q) => {
          const qd = new Date(q.quote_date);
          return qd.getMonth() === currentMonth && qd.getFullYear() === currentYear;
        }).length,
        this_year_quotes: quotes.filter((q) => new Date(q.quote_date).getFullYear() === currentYear).length,
        total_quoted_amount_inr: quotes.filter((q) => q.status !== 'expired' && q.status !== 'rejected').reduce((sum, q) => sum + (q.total_amount || 0), 0),
        pending_amount_inr: quotes.filter((q) => q.status === 'draft' || q.status === 'sent').reduce((sum, q) => sum + (q.total_amount || 0), 0),
        this_month_amount_inr: quotes.filter((q) => {
          const qd = new Date(q.quote_date);
          return q.status !== 'expired' && q.status !== 'rejected' && qd.getMonth() === currentMonth && qd.getFullYear() === currentYear;
        }).reduce((sum, q) => sum + (q.total_amount || 0), 0),
        conversion_rate: quotes.length > 0 ? (quotes.filter((q) => q.status === 'converted').length / quotes.length) * 100 : 0,
      };
    }

    let query = supabase
      .from('quotes')
      .select('status, total_amount, inr_total_amount, original_currency_code, quote_date');

    if (companySettingsId) {
      query = query.eq('company_settings_id', companySettingsId);
    }
    
    const { data: quotes, error: quotesError } = await query;
    
    if (quotesError) throw quotesError;

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const stats: QuoteStats = {
      total_quotes: quotes?.length || 0,
      draft_quotes: quotes?.filter(q => q.status === 'draft').length || 0,
      sent_quotes: quotes?.filter(q => q.status === 'sent').length || 0,
      accepted_quotes: quotes?.filter(q => q.status === 'accepted').length || 0,
      rejected_quotes: quotes?.filter(q => q.status === 'rejected').length || 0,
      expired_quotes: quotes?.filter(q => q.status === 'expired').length || 0,
      converted_quotes: quotes?.filter(q => q.status === 'converted').length || 0,
      
      total_quoted_amount: quotes?.filter(q => q.status !== 'expired' && q.status !== 'rejected').reduce((sum, q) => sum + (q.total_amount || 0), 0) || 0,
      pending_amount: quotes?.filter(q => q.status === 'draft' || q.status === 'sent').reduce((sum, q) => sum + (q.total_amount || 0), 0) || 0,
      
      this_month_quotes: quotes?.filter(q => {
        const quoteDate = new Date(q.quote_date);
        return quoteDate.getMonth() === currentMonth && quoteDate.getFullYear() === currentYear;
      }).length || 0,
      
      this_year_quotes: quotes?.filter(q => {
        const quoteDate = new Date(q.quote_date);
        return quoteDate.getFullYear() === currentYear;
      }).length || 0,

      total_quoted_amount_inr: quotes?.filter(q => q.status !== 'expired' && q.status !== 'rejected').reduce((sum, q) => sum + (q.inr_total_amount || q.total_amount || 0), 0) || 0,
      pending_amount_inr: quotes?.filter(q => q.status === 'draft' || q.status === 'sent').reduce((sum, q) => sum + (q.inr_total_amount || q.total_amount || 0), 0) || 0,
      this_month_amount_inr: quotes?.filter(q => {
        const quoteDate = new Date(q.quote_date);
        return q.status !== 'expired' && q.status !== 'rejected' &&
               quoteDate.getMonth() === currentMonth && 
               quoteDate.getFullYear() === currentYear;
      }).reduce((sum, q) => sum + (q.inr_total_amount || q.total_amount || 0), 0) || 0,

      conversion_rate: quotes && quotes.length > 0 
        ? (quotes.filter(q => q.status === 'converted').length / quotes.length) * 100 
        : 0
    };

    return stats;
  }

  // Check and update expired quotes
  async updateExpiredQuotes(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('quotes')
      .update({ 
        status: 'expired',
        updated_at: new Date().toISOString()
      })
      .lt('valid_until', today)
      .in('status', ['draft', 'sent'])
      .select();
    
    if (error) throw error;
    return data?.length || 0;
  }
}

export const quoteService = new QuoteService();
