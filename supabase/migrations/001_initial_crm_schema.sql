-- ==============================================================================
-- Enterprise CRM Master PostgreSQL / Supabase Schema Migration
-- Version: 1.0.0
-- Includes: Multi-Entity, Customers, Hierarchies, Quotes, Invoices, Contracts,
--           Finance, Expenses, Categories, Audits, and Row-Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Countries
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  currency_code TEXT NOT NULL,
  currency_name TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Company Settings (Tenant / Operating Entities)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  legal_name TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  gstin TEXT,
  pan TEXT,
  cin TEXT,
  cro_number TEXT,
  vat_number TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  iban TEXT,
  swift_bic TEXT,
  branch_name TEXT,
  logo_url TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. Customers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code TEXT,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  relationship_manager TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  company_settings_id UUID REFERENCES public.company_settings(id) ON DELETE SET NULL,
  gstin TEXT,
  pan TEXT,
  vat_number TEXT,
  ein TEXT,
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_company_settings ON public.customers(company_settings_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- ------------------------------------------------------------------------------
-- 4. Customer Contacts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  designation TEXT,
  department TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_decision_maker BOOLEAN DEFAULT false,
  is_billing_contact BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON public.customer_contacts(customer_id);

-- ------------------------------------------------------------------------------
-- 5. Customer Relationships & Hierarchy
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  subsidiary_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  relationship_type TEXT DEFAULT 'subsidiary',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. Rate Card Templates
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_card_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  resource_level TEXT NOT NULL,
  cost_per_hour NUMERIC DEFAULT 0,
  margin_percentage NUMERIC DEFAULT 30,
  hourly_rate NUMERIC NOT NULL,
  daily_rate NUMERIC,
  monthly_rate NUMERIC,
  currency TEXT DEFAULT 'USD',
  currency_code TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. Quotes & Items
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_prefix TEXT DEFAULT 'QTE-',
  quote_suffix TEXT DEFAULT '',
  number_format TEXT DEFAULT 'YYYY-XXXX',
  current_number INTEGER DEFAULT 1,
  reset_annually BOOLEAN DEFAULT true,
  financial_year_start_month INTEGER DEFAULT 4,
  current_financial_year TEXT,
  validity_days INTEGER DEFAULT 30,
  notes TEXT,
  footer_text TEXT,
  default_tax_rate NUMERIC DEFAULT 18,
  enable_gst BOOLEAN DEFAULT true,
  template_name TEXT DEFAULT 'standard',
  currency_position TEXT DEFAULT 'before',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  company_settings_id UUID REFERENCES public.company_settings(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  converted_to_invoice BOOLEAN DEFAULT false,
  converted_invoice_id UUID,
  validity_days INTEGER DEFAULT 30,
  notes TEXT,
  terms_and_conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'Unit',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  hsn_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. Invoices & Items
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_prefix TEXT DEFAULT 'INV-',
  invoice_suffix TEXT DEFAULT '',
  number_format TEXT DEFAULT 'YYYY-XXXX',
  current_number INTEGER DEFAULT 1,
  reset_annually BOOLEAN DEFAULT true,
  financial_year_start_month INTEGER DEFAULT 4,
  current_financial_year TEXT,
  default_payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  footer_text TEXT,
  default_tax_rate NUMERIC DEFAULT 18,
  enable_gst BOOLEAN DEFAULT true,
  template_name TEXT DEFAULT 'standard',
  currency_position TEXT DEFAULT 'before',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  company_settings_id UUID REFERENCES public.company_settings(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  balance_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'Unit',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  hsn_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. Payments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL,
  transaction_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. Contracts, Milestones & Templates
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  jurisdiction TEXT,
  variables TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  company_settings_id UUID REFERENCES public.company_settings(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  terms_and_conditions TEXT,
  auto_renew BOOLEAN DEFAULT false,
  renewal_notice_days INTEGER DEFAULT 30,
  template_id UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contract_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. Income, Expenses & Vendors
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.manual_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  category_id UUID REFERENCES public.income_categories(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  date DATE NOT NULL,
  description TEXT,
  company_settings_id UUID REFERENCES public.company_settings(id) ON DELETE SET NULL,
  payment_method TEXT,
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  tax_number TEXT,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  payment_terms INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  date DATE NOT NULL,
  due_date DATE,
  company_settings_id UUID REFERENCES public.company_settings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Enable Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated read/write
CREATE POLICY "Allow authenticated read on customers" ON public.customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert on customers" ON public.customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update on customers" ON public.customers FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read on invoices" ON public.invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert on invoices" ON public.invoices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update on invoices" ON public.invoices FOR UPDATE USING (auth.role() = 'authenticated');

