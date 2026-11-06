# Modular Multi-Client Enterprise CRM Template

A production-grade, white-label Customer Relationship, Quoting, Invoicing, Contracting, and Financial Management platform built with **React 18**, **TypeScript 5**, **Tailwind CSS**, and **Vite**.

Designed as a master template project that can be copied, customized, and deployed for diverse clients in minutes.

---

## 🚀 Key Features & Domain Modules

All modules are functionally identical to the reference enterprise architecture:

- **Customer Management & Customer 360 Hub** (`src/components/customer`):
  - Full customer directory with multi-entity filtering, search, and status tracking.
  - Interactive **Customer 360 Hub** showing lifetime value (LTV), outstanding balances, quotes, invoices, contracts, and contacts.
  - Organization Hierarchy Panel (parent-child enterprise group mapping).
  - Stakeholder Contact Network Panel with influence tiers and decision-maker tags.
- **Quotation & CPQ Engine** (`src/components/quote`):
  - Multi-item quotation builder with role-based rate card selector.
  - Tax computation (GST / VAT / Sales Tax), discount allowances, terms & conditions.
  - Single-click Quote-to-Invoice conversion.
- **Invoicing & Billing Management** (`src/components/invoice`):
  - Draft, sent, paid, overdue, and cancelled status lifecycles.
  - PDF generation and branding with company letterhead, signatures, and QR codes.
  - Partial/full payment tracking and balance calculations.
- **Contract Lifecycle Management (CLM)** (`src/components/contract`):
  - MSA, SOW, NDA, and SLA contract creation and lifecycle tracking.
  - Country-specific legal templates (Indian Contract Act, Irish / EU Commercial Law).
  - Milestone schedule tracking and PDF contract generation.
- **Finance, Income & Expense Management** (`src/components/admin`):
  - Financial Health cockpit with cash flow metrics, P&L calculations, and revenue trends.
  - Income and manual transaction journal with payment receipts.
  - Categorized operational expense logging and approvals.
  - Rate Card & Salary Rate Analyzer tools.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
The application will launch with **Mock Mode** active by default, persisting all changes to reactive browser `localStorage`.

### 3. Build for Production
```bash
npm run build
```
Generates optimized static assets in the `dist/` directory.

---

## 🎨 White-Labeling for a New Client (in 60 seconds)

To brand this template for a specific client, simply modify `src/config/client.config.ts`:

```typescript
export const clientConfig: ClientConfig = {
  clientId: 'client-acme-corp',
  clientName: 'Acme Corporation CRM',
  legalEntityName: 'Acme Global Technologies Inc.',
  tagline: 'Client Operations & Revenue Management',
  theme: {
    primaryColor: '#2563eb', // Client primary color
    primaryHover: '#1d4ed8',
    accentColor: '#10b981',
    sidebarBg: '#0f172a',
    sidebarText: '#f8fafc',
  },
  localization: {
    defaultCurrency: 'USD',
    locale: 'en-US',
    taxSystem: 'SALES_TAX', // 'GST' | 'VAT' | 'SALES_TAX'
    dateFormat: 'YYYY-MM-DD',
  },
  activeModules: {
    dashboard: true,
    customers: true,
    customer360: true,
    quotes: true,
    invoices: true,
    contracts: true,
    income: true,
    expenses: true,
    finance: true,
    rateCards: true,
  },
};
```

---

## 🗄️ Database & Dual-Mode Persistence Architecture

This template is architected with dual-mode storage:

1. **Mock Mode (Default)**:
   - Zero external setup required.
   - Initialized with realistic seed data across all CRM entities.
   - Synchronizes changes to `localStorage['template_crm_data_v1']`.
   - Creating quotes, invoices, contracts, or expenses immediately updates state, stats, and activity feeds.

2. **Supabase PostgreSQL Mode (Ready for Production)**:
   - When you are ready to connect a real Supabase database, create a `.env` file:
     ```env
     VITE_USE_MOCK=false
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key
     ```
   - Run the included database migration in your Supabase SQL editor:
     `supabase/migrations/001_initial_crm_schema.sql`
   - Complete schema includes tables, indexes, constraints, audit triggers, and Row Level Security (RLS) policies.

---

## 📚 Project Documentation

- [PRD.md](file:///Users/prashant/Documents/Application%20directory/CRM/PRD.md): Detailed Product Requirements Document covering multi-client white-label strategy, domain requirements, and acceptance criteria.
- [Design.md](file:///Users/prashant/Documents/Application%20directory/CRM/Design.md): System architecture, dual-mode persistence, entity relationships, and component blueprints.
- [Agents.md](file:///Users/prashant/Documents/Application%20directory/CRM/Agents.md): Autonomous CRM agents (deal health, collections, contract compliance, anomaly detection) and developer scaffolding automation.
- [Memory.md](file:///Users/prashant/Documents/Application%20directory/CRM/Memory.md): Three-tier memory architecture (ephemeral UI, client config/localStorage, Supabase RLS database) and activity timeline streams.

