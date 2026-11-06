// TypeScript types for the Invoice Generation System

export interface Country {
  id: string;
  name: string;
  code: string;
  currency_code: string;
  currency_name: string;
  currency_symbol: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: string;
  company_name: string;
  legal_name?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country_id: string;
  
  // Tax Information
  gstin?: string;
  pan?: string;
  cin?: string;
  cro_number?: string;
  vat_number?: string;
  
  // Contact Information
  phone?: string;
  email?: string;
  website?: string;
  
  // Banking Information
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  iban?: string;
  swift_bic?: string;
  branch_name?: string;
  
  // Logo and Branding (legacy)
  logo_url?: string;
  signature_url?: string;
  
  // PDF Branding Images (new)
  header_image_url?: string;
  footer_image_url?: string;
  logo_image_url?: string;
  header_image_data?: string; // Base64 encoded
  footer_image_data?: string; // Base64 encoded
  logo_image_data?: string;   // Base64 encoded
  
  // Settings
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Populated from relations
  country?: Country;
}

export interface InvoiceSettings {
  id: string;
  company_settings_id?: string | null;
  
  // Invoice Number Format
  invoice_prefix: string;
  invoice_suffix?: string;
  number_format: string;
  current_number: number;
  reset_annually: boolean;
  
  // Financial Year Settings
  financial_year_start_month: number;
  current_financial_year: string;
  
  // Default Terms and Conditions
  payment_terms?: string;
  notes?: string;
  footer_text?: string;
  
  // Tax Settings
  default_tax_rate: number;
  enable_gst: boolean;
  
  // Other Settings
  due_days: number;
  late_fee_percentage: number;
  
  // Template Settings
  template_name: string;
  currency_position: 'before' | 'after' | 'inr_before' | 'inr_after' | 'euro_before' | 'euro_after' | 'pound_before' | 'pound_after' | 'usd_before' | 'usd_after';
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TermsTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

import type { CustomerContact } from './customerContact';

export interface Customer {
  id: string;
  company_name?: string;
  contact_person?: string;
  relationship_manager?: string;
  email?: string;
  phone?: string;
  
  // Unique customer ID: stored as YYYY-XXXX, displayed with entity prefix
  customer_code?: string;
  
  // Address
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_id?: string;
  
  // Entity association
  company_settings_id?: string;
  
  // IGST Information (if applicable)
  gstin?: string;
  pan?: string;
  
  // Authentication & Credentials (Web Crypto PBKDF2)
  password_hash?: string | null;
  must_change_password?: boolean;
  password_reset_token?: string | null;
  password_reset_expires_at?: string | null;
  failed_login_attempts?: number;
  locked_until?: string | null;

  // Financial & Commercial Terms
  payment_terms?: string | number;
  credit_limit?: number;

  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Populated from relations
  country?: Country;
  contacts?: CustomerContact[];
  primary_contact?: CustomerContact;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  product_code?: string;
  category?: string;
  
  // Pricing
  unit_price: number;
  unit: string;
  
  // Tax Information
  tax_rate: number;
  hsn_code?: string;
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
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

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  company_settings_id: string;

  // Project Details
  project_title?: string;
  estimated_time?: string; // e.g., "2-3 weeks", "1 month"
  company_contact_name?: string;
  company_contact_email?: string;
  company_contact_phone?: string;

  // Invoice Details
  invoice_date: string;
  due_date?: string;

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
  status: 'draft' | 'sent' | 'paid' | 'cancelled' | 'overdue' | 'completed';
  payment_status: 'pending' | 'partial' | 'paid';

  // Separately captured actual payment info (INR for Indian Entity)
  paid_amount?: number;
  paid_currency?: string;
  paid_at?: string;

  // Quote conversion tracking
  created_from_quote_id?: string;
  quote_reference?: string;

  // Additional Information
  notes?: string;
  terms_conditions?: string;

  // International banking details (for non-INR invoices)
  intl_account_name?: string;
  intl_account_number?: string;
  intl_account_type?: string;
  intl_routing_number?: string;
  intl_swift_bic?: string;
  intl_bank_address?: string;
  intl_iban?: string;
  intl_sort_code?: string;

  // Subscription reference (set when invoice is auto-generated for a subscription)
  subscription_id?: string;

  // Tracking
  created_by?: string;
  created_at: string;
  updated_at: string;

  // Populated from relations
  customer?: Customer;
  company_settings?: CompanySettings;
  invoice_items?: InvoiceItem[];
  payments?: Payment[];
}

export interface Payment {
  id: string;
  invoice_id: string;
  
  // Payment Details
  payment_date: string;
  amount: number;
  payment_method?: string;
  reference_number?: string;
  
  // Multi-currency support
  original_currency_code?: string;
  original_amount?: number;
  exchange_rate?: number;
  exchange_rate_date?: string;
  inr_amount?: number;
  
  // Bank Details (if applicable)
  bank_name?: string;
  
  notes?: string;
  created_by?: string;
  created_at: string;
  
  // Populated from relations
  invoice?: Invoice;
}

// Form types for creating/editing
export interface CreateInvoiceData {
  customer_id: string;
  invoice_date: string;
  due_date?: string;
  // Project details
  project_title?: string;
  estimated_time?: string;
  company_contact_name?: string;
  company_contact_email?: string;
  company_contact_phone?: string;
  // Discount
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  // Quote reference
  created_from_quote_id?: string;
  quote_reference?: string;
  // Subscription reference (set when invoice is auto-generated for a subscription)
  subscription_id?: string;
  // Additional info
  notes?: string;
  terms_conditions?: string;
  // International banking details (for non-INR invoices)
  intl_account_name?: string;
  intl_account_number?: string;
  intl_account_type?: string;
  intl_routing_number?: string;
  intl_swift_bic?: string;
  intl_bank_address?: string;
  intl_iban?: string;
  intl_sort_code?: string;
  // Currency override: allows billing a foreign customer in INR
  currency_code_override?: string;
  items: CreateInvoiceItemData[];
}

export interface CreateInvoiceItemData {
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

export interface UpdateInvoiceData {
  customer_id?: string;
  invoice_date?: string;
  due_date?: string;
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
  // International banking details (for non-INR invoices)
  intl_account_name?: string;
  intl_account_number?: string;
  intl_account_type?: string;
  intl_routing_number?: string;
  intl_swift_bic?: string;
  intl_bank_address?: string;
  intl_iban?: string;
  intl_sort_code?: string;
  // Currency override: allows billing a foreign customer in INR
  currency_code_override?: string;
  items?: CreateInvoiceItemData[];
  status?: Invoice['status'];
  payment_status?: Invoice['payment_status'];
}

export interface CreateCustomerData {
  company_name?: string;
  contact_person?: string;
  relationship_manager?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_id?: string;
  company_settings_id?: string;
  gstin?: string;
  pan?: string;
  credit_limit?: number;
  payment_terms?: number;
}

export interface CreateProductData {
  name: string;
  description?: string;
  product_code?: string;
  category?: string;
  unit_price: number;
  unit: string;
  tax_rate: number;
  hsn_code?: string;
  is_active?: boolean;
}

export interface UpdateCompanySettingsData {
  company_name: string;
  legal_name?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country_id: string;
  gstin?: string;
  pan?: string;
  cin?: string;
  phone?: string;
  email?: string;
  website?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  iban?: string;
  swift_bic?: string;
  branch_name?: string;
  cro_number?: string;
  vat_number?: string;
  logo_url?: string;
  signature_url?: string;
}

export interface CreateCompanySettingsData extends UpdateCompanySettingsData {
  is_default?: boolean;
}

export interface UpdateInvoiceSettingsData {
  company_settings_id?: string | null;
  invoice_prefix: string;
  invoice_suffix?: string;
  number_format: string;
  reset_annually: boolean;
  financial_year_start_month: number;
  current_financial_year: string;
  payment_terms?: string;
  notes?: string;
  footer_text?: string;
  default_tax_rate: number;
  enable_gst: boolean;
  due_days: number;
  late_fee_percentage: number;
  template_name: string;
  currency_position: 'before' | 'after' | 'inr_before' | 'inr_after' | 'euro_before' | 'euro_after' | 'pound_before' | 'pound_after' | 'usd_before' | 'usd_after';
}

export interface CreateInvoiceSettingsData extends UpdateInvoiceSettingsData {}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Dashboard Statistics
export interface InvoiceStats {
  total_invoices: number;
  draft_invoices: number;
  sent_invoices: number;
  paid_invoices: number;
  overdue_invoices: number;
  cancelled_invoices: number;
  total_revenue: number;
  pending_amount: number;
  this_month_revenue: number;
  this_year_revenue: number;
  
  // Multi-currency stats (all in INR)
  total_revenue_inr?: number;
  pending_amount_inr?: number;
  this_month_revenue_inr?: number;
  currency_breakdown?: Record<string, {
    total_amount: number;
    count: number;
  }>;
}

// Exchange Rate Types
export interface ExchangeRate {
  id: string;
  base_currency: string;
  target_currency: string;
  rate: number;
  date: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

export interface CurrencyConversion {
  from_currency: string;
  to_currency: string;
  original_amount: number;
  converted_amount: number;
  exchange_rate: number;
  conversion_date: string;
}

// API Response for exchange rates
export interface ExchangeRateApiResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
  success?: boolean;
  error?: {
    code: number;
    type: string;
    info: string;
  };
}

// Search and Filter types
export interface InvoiceFilters {
  status?: string;
  payment_status?: string;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  subscription_only?: boolean;
  company_settings_id?: string;
}

export interface CustomerFilters {
  search?: string;
  country_id?: string;
  company_settings_id?: string;
  is_active?: boolean;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  is_active?: boolean;
}
