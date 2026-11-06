// TypeScript types for the Quote/Quotation Generation System
// Mirrors the Invoice system structure for consistency

import type { Country, Customer, CompanySettings, Product } from './invoice';

// Quote Settings - similar to InvoiceSettings
export interface QuoteSettings {
  id: string;
  
  // Quote Number Format
  quote_prefix: string;
  quote_suffix?: string;
  number_format: string;
  current_number: number;
  reset_annually: boolean;
  
  // Financial Year Settings
  financial_year_start_month: number;
  current_financial_year: string;
  
  // Default Terms and Conditions
  validity_days: number; // How long the quote is valid
  notes?: string;
  footer_text?: string;
  
  // Tax Settings
  default_tax_rate: number;
  enable_gst: boolean;
  
  // Template Settings
  template_name: string;
  currency_position: 'before' | 'after' | 'inr_before' | 'inr_after' | 'euro_before' | 'euro_after' | 'pound_before' | 'pound_after' | 'usd_before' | 'usd_after';
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Quote Item - similar to InvoiceItem
export interface QuoteItem {
  id: string;
  quote_id: string;
  product_id?: string;

  // Item Details
  item_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;

  // Service-based billing (for IT consulting, training, etc.)
  billable_hours?: number; // Total billable monthly hours
  resource_count?: number; // Number of resources/personnel (e.g., 5 developers)
  is_service_item?: boolean; // Flag to identify service-based items

  // Calculations
  line_total: number;
  tax_rate: number;
  tax_amount: number;

  // Multi-currency support
  original_unit_price?: number;
  original_line_total?: number;
  original_tax_amount?: number;
  inr_unit_price?: number;
  inr_line_total?: number;
  inr_tax_amount?: number;

  // HSN/SAC for India IGST
  hsn_code?: string;

  created_at: string;

  // Populated from relations
  product?: Product;
}

// Quote Status type
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

// Main Quote interface - mirrors Invoice structure
export interface Quote {
  id: string;
  quote_number: string;
  customer_id: string;
  company_settings_id: string;
  
  // Project Details
  project_title?: string;
  estimated_time?: string; // e.g., "2-3 weeks", "1 month"
  company_contact_name?: string;
  company_contact_email?: string;
  company_contact_phone?: string;
  
  // Quote Details
  quote_date: string;
  valid_until?: string; // Expiry date
  
  // Financial Information (current/display amounts)
  subtotal: number;
  discount_type?: 'percentage' | 'fixed'; // Type of discount
  discount_value?: number; // Discount amount or percentage
  discount_amount?: number; // Calculated discount amount
  tax_amount: number;
  total_amount: number;
  currency_code: string;
  
  // Multi-currency support
  original_currency_code?: string;
  original_subtotal?: number;
  original_tax_amount?: number;
  original_total_amount?: number;
  exchange_rate?: number;
  exchange_rate_date?: string;
  inr_subtotal?: number;
  inr_tax_amount?: number;
  inr_total_amount?: number;
  
  // Status
  status: QuoteStatus;
  
  // Conversion tracking (when quote becomes invoice)
  converted_to_invoice_id?: string;
  converted_at?: string;
  
  // Additional Information
  notes?: string;
  terms_conditions?: string;
  
  // Tracking
  created_by?: string;
  created_at: string;
  updated_at: string;
  
  // Populated from relations
  customer?: Customer;
  company_settings?: CompanySettings;
  quote_items?: QuoteItem[];
}

// Form types for creating/editing
export interface CreateQuoteData {
  customer_id: string;
  quote_date: string;
  valid_until?: string;
  // Project details
  project_title?: string;
  estimated_time?: string;
  company_contact_name?: string;
  company_contact_email?: string;
  company_contact_phone?: string;
  // Discount
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  // Additional info
  notes?: string;
  terms_conditions?: string;
  items: CreateQuoteItemData[];
}

export interface CreateQuoteItemData {
  id?: string; // Include ID for updates
  product_id?: string;
  item_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  hsn_code?: string;
  // Service-based billing
  billable_hours?: number;
  resource_count?: number;
  is_service_item?: boolean;
}

export interface UpdateQuoteData {
  customer_id?: string;
  quote_date?: string;
  valid_until?: string;
  // Project details
  project_title?: string;
  estimated_time?: string;
  company_contact_name?: string;
  company_contact_email?: string;
  company_contact_phone?: string;
  // Discount
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  // Additional info
  notes?: string;
  terms_conditions?: string;
  items?: CreateQuoteItemData[];
  status?: QuoteStatus;
}

export interface UpdateQuoteSettingsData {
  quote_prefix: string;
  quote_suffix?: string;
  number_format: string;
  reset_annually: boolean;
  financial_year_start_month: number;
  current_financial_year: string;
  validity_days: number;
  notes?: string;
  footer_text?: string;
  default_tax_rate: number;
  enable_gst: boolean;
  template_name: string;
  currency_position: 'before' | 'after' | 'inr_before' | 'inr_after' | 'euro_before' | 'euro_after' | 'pound_before' | 'pound_after' | 'usd_before' | 'usd_after';
}

export interface CreateQuoteSettingsData extends UpdateQuoteSettingsData {}

// Search and Filter types
export interface QuoteFilters {
  status?: string;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  company_settings_id?: string;
}

// Dashboard Statistics
export interface QuoteStats {
  total_quotes: number;
  draft_quotes: number;
  sent_quotes: number;
  accepted_quotes: number;
  rejected_quotes: number;
  expired_quotes: number;
  converted_quotes: number;
  total_quoted_amount: number;
  pending_amount: number;
  this_month_quotes: number;
  this_year_quotes: number;
  
  // Multi-currency stats (all in INR)
  total_quoted_amount_inr?: number;
  pending_amount_inr?: number;
  this_month_amount_inr?: number;
  currency_breakdown?: Record<string, {
    total_amount: number;
    count: number;
  }>;
  
  // Conversion metrics
  conversion_rate?: number; // Percentage of quotes converted to invoices
}

// API Response types
export interface QuotePaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Re-export shared types
export type { Country, Customer, CompanySettings, Product };
