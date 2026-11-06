# Product Requirements Document (PRD)
## Modular Multi-Client Enterprise CRM Template

**Project Code**: `CRM-CORE-TEMPLATE`  
**Version**: `1.0.0`  
**Target Database**: Supabase (PostgreSQL with RLS) | **Active Stage**: Dual-Mode (Production Mock Store & Supabase Ready)  
**Author / Architect**: Antigravity Platform Engineering  

---

## 1. Executive Summary & Vision

The **Modular Multi-Client Enterprise CRM Template** is a production-grade, white-label customer relationship, contracting, billing, and financial management application. Designed from the ground up to serve as a customizable master template, software agencies, consultancies, and independent software vendors (ISVs) can copy, customize, and deploy dedicated instances for different clients in minutes.

The template unifies five mission-critical enterprise domains:
1. **Customer 360 & Hierarchy Engine**: Unified view of accounts, parent-subsidiary corporate trees, and contact network mapping.
2. **Quotation & Rate Card System**: Rapid CPQ (Configure, Price, Quote) engine linked to role-based rate cards, multi-currency conversion, and single-click invoice conversion.
3. **Invoicing & Billing Hub**: Tax-compliant billing (GST, VAT, Sales Tax), multi-item line breakdown, automated number sequencing, and payment reconciliation.
4. **Contract Lifecycle Management (CLM)**: End-to-end contract generation (MSA, SOW, NDA, SLA), milestone tracking, audit logging, template variable interpolation, and PDF export.
5. **Finance, Income & Expense Management**: Centralized financial health cockpit, P&L generation, manual transaction ledger, and categorized expense approvals.

---

## 2. Target Personas & User Journeys

| Persona | Role | Key Goals & JTBD (Jobs to Be Done) |
| :--- | :--- | :--- |
| **Agency / Solution Integrator** | Developer / Agency Owner | Quickly spin up a branded CRM instance for a new client by editing `client.config.ts`, customizing branding tokens, and connecting Supabase without rewriting core business logic. |
| **Client Administrator** | Operations Director | Manage company legal entities, tax IDs, banking information, user roles, contract templates, and company-wide defaults. |
| **Sales & Account Executive** | Sales Manager | Track customer accounts, map organizational stakeholders, generate quotes using pre-agreed rate cards, and draft contractual SOWs. |
| **Finance & Billing Officer** | Accountant / Controller | Convert approved quotes to formal invoices, record partial or full payments, track overdue balances, log operating expenses, and export P&L reports. |

---

## 3. White-Label & Multi-Client Customization Strategy

The CRM template provides a centralized configuration abstraction layer located at `src/config/client.config.ts`. A developer configuring a new client instance can adjust the following parameters without touching UI or service logic:

```typescript
export interface ClientCustomizationConfig {
  clientId: string;
  clientName: string;
  legalEntityName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  theme: {
    primaryColor: string;
    primaryHover: string;
    accentColor: string;
    sidebarBg: string;
    sidebarText: string;
    borderRadius: 'sm' | 'md' | 'lg' | 'xl';
  };
  localization: {
    defaultCurrency: 'INR' | 'EUR' | 'USD' | 'GBP' | 'AED';
    locale: string;
    taxSystem: 'GST' | 'VAT' | 'SALES_TAX';
    dateFormat: string;
  };
  features: {
    enableCustomerHierarchy: boolean;
    enableRateCards: boolean;
    enableQuotes: boolean;
    enableContracts: boolean;
    enableInvoices: boolean;
    enableFinance: boolean;
    enableExpenseManagement: boolean;
    enableIncomeManagement: boolean;
  };
  companySettings: {
    addressLine1: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    email: string;
    phone: string;
    taxNumber: string; // GSTIN / VAT / EIN
    panNumber?: string;
    bankDetails: {
      bankName: string;
      accountNumber: string;
      routingOrIfsc: string;
      swiftBic?: string;
      iban?: string;
    };
  };
}
```

---

## 4. Detailed Functional Requirements

### 4.1 Customer Management & Customer 360 Hub
*Reference Source: `kdadks/src/components/customer`*

- **Customer List & Grid (`CustomerManagement.tsx`)**:
  - Search by company name, contact person, email, customer code, or tax identifier.
  - Pagination, sorting, and filter by entity/company affiliation or global shared customers.
  - Add Customer Modal: Capture company name, legal entity, contact details, tax numbers (GSTIN/VAT/EIN), currency preference, payment terms, and relationship manager.
  - Inline actions: View Customer 360, Edit Customer, Manage Contacts, and Soft Delete.
- **Customer 360 Hub (`Customer360Hub.tsx`)**:
  - **Financial Metrics Strip**: Lifetime Invoiced Amount (LTV), Total Collected, Outstanding Balance, Overdue Balance, Active MRR, Open Pipeline Value, and Total Contracts.
  - **Tabbed Sub-Views**:
    1. *Overview*: Account summary, primary contact card, quick metrics, billing & shipping address, banking snapshot.
    2. *Contacts*: Roster of affiliated contacts with designation, email, direct phone, and primary status.
    3. *Quotes*: Quotes associated with this account with conversion status.
    4. *Invoices*: All historical invoices, payment statuses, and balance dues.
    5. *Contracts*: Active and historical contracts (MSA, SOW, SLA) with lifecycle badges.
    6. *Hierarchy & Corporate Tree*: Parent-subsidiary corporate family visualization.
    7. *Activity Timeline*: Chronological event log (e.g., quotes generated, contracts signed, payments recorded).
- **Contact Management Modal (`CustomerContactModal.tsx`)**:
  - Modal to create, edit, or remove contacts attached to a customer account.
  - Captures name, role, email, phone, decision-maker flag, and primary contact toggle.
- **Customer Hierarchy & Corporate Network (`CustomerHierarchyPanel.tsx` & `ContactNetworkPanel.tsx`)**:
  - Map multi-tier parent corporations, operating subsidiaries, and sister branches.
  - Contact organizational hierarchy tree for identifying economic buyers, champions, and billing contacts.

---

### 4.2 Quote & CPQ Engine
*Reference Source: `kdadks/src/components/quote`*

- **Quote Management (`QuoteManagement.tsx`)**:
  - Status pipeline: `Draft` $\rightarrow$ `Sent` $\rightarrow$ `Accepted` $\rightarrow$ `Declined` $\rightarrow$ `Expired` $\rightarrow$ `Converted to Invoice`.
  - Aggregated KPIs: Total Quote Value, Accepted Conversion Rate, Pending Quotes, and Expired Volume.
  - Fast-action buttons:
    - **Convert to Invoice**: Automatically converts accepted quotes into formal draft invoices with all line items and customer data preserved.
    - **Duplicate Quote**: Clone quotation for rapid revisions.
    - **Generate PDF**: Professional PDF export with client branding, itemized tables, and terms.
    - **Send Email Modal**: Send quotation details directly to customer contacts.
- **Create Quote Builder (`CreateQuote.tsx`)**:
  - Dynamic line items: Item name, description, quantity, unit, unit price, and discount percentage.
  - Auto-calculation of subtotal, tax amount (based on customer country tax rules), and grand total.
  - Multi-currency support with real-time conversion rates.
  - Rate Card Integration via `QuoteRateCardSelector.tsx` for importing standard hourly or monthly resource rates.
  - Custom terms & conditions presets and payment terms dropdown.

---

### 4.3 Invoicing & Billing Lifecycle
*Reference Source: `kdadks/src/components/invoice`*

- **Invoice Management Dashboard (`InvoiceManagement.tsx`)**:
  - Status badges: `Draft`, `Sent`, `Paid`, `Partially Paid`, `Overdue`, `Cancelled`.
  - Financial metric cards: Total Invoiced Revenue, Total Paid Amount, Total Pending Balance, and Overdue Amount.
  - Filter by date range, customer, payment status, and company entity.
  - Payment Recording Modal: Record partial or full offline/online payments with payment date, reference transaction ID, and method (Bank Wire, Credit Card, Cash, UPI).
  - Print & PDF download engine using `jsPDF` with branding headers and footers.
- **Create & Edit Invoice (`CreateInvoice.tsx`, `EditInvoice.tsx`)**:
  - Automatic invoice number generation according to entity sequence settings.
  - Line item editor with tax calculation, HSN/SAC codes, discount, and unit pricing.
  - Customer selection with auto-fill for billing address, tax registration, and payment terms.
  - Banking details snippet dynamically matched to company entity settings.

---

### 4.4 Contract Lifecycle Management (CLM) & Templates
*Reference Source: `kdadks/src/components/contract`*

- **Contract Management (`ContractManagement.tsx`)**:
  - Contract types: Master Service Agreement (`MSA`), Statement of Work (`SOW`), Non-Disclosure Agreement (`NDA`), Service Level Agreement (`SLA`), Work Order (`WORK_ORDER`), Consulting Agreement (`CONSULTING`).
  - Contract lifecycle statuses: `Draft` $\rightarrow$ `Sent` $\rightarrow$ `Accepted` $\rightarrow$ `Active` $\rightarrow$ `Expired` $\rightarrow$ `Terminated` $\rightarrow$ `Renewed`.
  - Metrics: Total Contracts, Active Contracts Value, Renewals Due in 30 Days.
- **Modals & Lifecycle Handlers**:
  - `CreateContractModal.tsx`: Comprehensive wizard capturing party details, contract type, value, start/end dates, milestone payments, and custom clauses.
  - `EditContractModal.tsx`: In-flight contract modification.
  - `ViewContractModal.tsx`: Contract previewer with milestone checklist, signatures block, and audit history.
  - `StatusUpdateModal.tsx`: Controlled state transitions requiring audit log reason.
  - `ContractTemplateManagement.tsx` & `EditTemplateModal.tsx`: Reusable agreement boilerplate editor with token interpolation (`{{customer_name}}`, `{{start_date}}`, `{{contract_value}}`).

---

### 4.5 Financial Management, Income, Expense & Executive Dashboard
*Reference Source: `kdadks/src/components/admin`*

- **Executive Dashboard (`SimpleAdminDashboard.tsx`)**:
  - Unified operational command center featuring quick KPI tiles (Total Invoiced, Quotes Converted, Active Contracts, Cash Collected, Net Margin).
  - Quick action bar: "New Invoice", "New Quote", "New Contract", "Add Customer".
  - Recent Invoices table and Real-time Activity Timeline stream.
  - Seamless entity switcher supporting multi-company / multi-currency setups.
- **Income Management (`IncomeManagement.tsx`)**:
  - Categorized revenue entries (Consulting, Retainers, License, Custom Projects).
  - Manual transaction recording for non-invoiced income (interest, refunds, grants).
  - Income category manager with color badges and description metadata.
- **Expense Management (`ExpenseManagement.tsx`)**:
  - Categorized cost tracking (Infrastructure, Software Licenses, Subcontractors, Office, Travel).
  - Vendor directory management (`CreateVendorData`).
  - Approval workflow: `Pending` $\rightarrow$ `Approved` $\rightarrow$ `Paid` $\rightarrow$ `Rejected`.
- **Financial Health & P&L Cockpit (`FinanceManagement.tsx`)**:
  - Real-time Profit & Loss statement (Total Income vs Total Expenses = Net Operating Income).
  - Cash flow breakdown: Monthly, Quarterly, and Yearly comparative analytics.
  - Master unified transaction ledger consolidating invoices, expenses, and manual entries.

---

## 5. Dual-Mode Data Layer Architecture

To fulfill the user requirement ("I will be using Supabase database which I will implement later on for now use mock data"):

1. **Mock Storage Engine (`mockStore.ts`)**:
   - Initialized with comprehensive, interconnected mock seed data.
   - Saves updates to browser `localStorage` under `template_crm_data_v1`.
   - Supports transactional updates (e.g. converting a Quote updates the quote state and creates an Invoice in the mock store immediately).
   - Can be reset to initial state with a single button.
2. **Supabase Transition**:
   - When environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are provided and `VITE_USE_MOCK !== 'true'`, services automatically switch to querying Supabase tables.
   - Comprehensive SQL migration (`supabase/migrations/001_initial_crm_schema.sql`) included in the project for instant database bootstrapping.

---

## 6. Non-Functional Requirements

- **Zero-Latency Mock Experience**: All mock CRUD operations resolve with realistic async delays (150ms-300ms) to ensure UI loading states, toasts, and spinners are exercised.
- **Type Safety**: 100% strict TypeScript types across all entities, API schemas, and component props.
- **Design Consistency**: Modern Tailwind CSS typography, responsive sidebars, accessible modal backdrops, and consistent color semantics.
- **Security & RLS Readiness**: Database schema models tenant isolation via `company_settings_id` and PostgreSQL Row Level Security (RLS) policies.

