# Memory Architecture & State Persistence
## Context Retention, Configuration Memory & Knowledge Graph

**Project**: Modular Multi-Client Enterprise CRM Template  
**Version**: `1.0.0`  
**Storage Model**: Tiered Memory (Ephemeral UI State $\rightarrow$ Persistent Local Store $\rightarrow$ Cloud Supabase RLS Database)  

---

## 1. Memory Tier Overview

```
+-----------------------------------------------------------------------------------------+
|                                    TIER 1: EPHEMERAL MEMORY                             |
|  * Component state (modals, search input filters, current pagination page)              |
|  * React Contexts: `ActionProgressContext` (in-flight spinner pill), active toast queue |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                              TIER 2: CLIENT & PERSISTENT LOCAL MEMORY                   |
|  * `client.config.ts`: Client branding, feature flags, currency & tax settings          |
|  * `localStorage['template_crm_data_v2']`: Reactive entity store (Customers, Quotes,   |
|     Invoices, Contracts, Transactions, Rate Cards, Categories)                          |
|  * `localStorage['template_crm_selected_company_id']`: Active entity selection          |
|  * `localStorage['template_crm_currency_cache']`: Cached exchange rates (1 hr TTL)     |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v (When Supabase is Enabled)
+-----------------------------------------------------------------------------------------+
|                              TIER 3: CLOUD RELATIONAL KNOWLEDGE BANK                     |
|  * PostgreSQL Database via Supabase with Row Level Security (RLS)                       |
|  * Transactional integrity, automated audit triggers, historical versioning            |
|  * Real-time change streams (`supabase.channel`)                                        |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Client Configuration Memory (`client.config.ts`)

Each client deployment maintains a declarative configuration memory object. This decouples the core UI and business logic from client-specific variances:

```typescript
export interface ClientMemoryProfile {
  identity: {
    clientId: string;
    clientName: string;
    domain: string;
    supportEmail: string;
  };
  theming: {
    primaryHex: string;
    sidebarBgHex: string;
    accentHex: string;
  };
  jurisdiction: {
    defaultEntityId: string;
    currency: string;
    taxSystem: 'GST' | 'VAT' | 'SALES_TAX';
    financialYearStartMonth: number; // 1 for Jan, 4 for April (India/UK)
  };
  toggles: {
    enableContracts: boolean;
    enableRateCards: boolean;
    enableExpenseApprovals: boolean;
  };
}
```

---

## 3. Episodic Memory: Activity Timeline & Audit Logs

The CRM tracks human and automated events across all entities in an episodic memory model. Every significant lifecycle event generates an immutable record stored in the timeline:

### Supported Event Types:
- `CUSTOMER_CREATED`, `CUSTOMER_UPDATED`, `CONTACT_LINKED`
- `QUOTE_GENERATED`, `QUOTE_SENT`, `QUOTE_ACCEPTED`, `QUOTE_CONVERTED_TO_INVOICE`
- `INVOICE_ISSUED`, `PAYMENT_RECORDED`, `INVOICE_OVERDUE`
- `CONTRACT_DRAFTED`, `CONTRACT_STATUS_CHANGED`, `CONTRACT_MILESTONE_UPDATED`
- `EXPENSE_SUBMITTED`, `EXPENSE_APPROVED`, `MANUAL_TRANSACTION_LOGGED`

### Schema of Episodic Item:
```typescript
export interface CustomerActivityTimelineItem {
  id: string;
  sourceType: 'customer' | 'quote' | 'invoice' | 'contract' | 'payment' | 'expense';
  title: string;
  description?: string;
  timestamp: string;
  actorName?: string;
  badgeText?: string;
  badgeVariant?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  metadata?: Record<string, any>;
}
```

---

## 4. Semantic Memory: Knowledge Graph & Hierarchies

Enterprise accounts often comprise complex parent-subsidiary corporate webs and cross-company contact networks. The CRM stores this as a semantic graph:

```
[Parent Enterprise: Global Holding Corp]
          |
          +---> [Subsidiary: Tech Solutions Ltd (IND)]
          |              |
          |              +---> [Contact: Rohan Sharma (VP Engineering)]
          |              +---> [Contact: Priya Patel (Procurement Lead)]
          |
          +---> [Subsidiary: Cloud Systems Europe (IRL)]
                         |
                         +---> [Contact: Sarah Murphy (Head of Finance)]
```

### Representation:
- `customer_relationships`: Maps `parent_customer_id` and `subsidiary_customer_id` with `relationship_type` (`subsidiary`, `division`, `affiliate`, `partner`).
- `customer_contacts`: Records organizational roles, reporting lines, decision-maker status (`is_primary`, `is_decision_maker`).

---

## 5. Storage Versioning & State Reset Protocol

To prevent client corruption during rapid iterative prototyping or client demonstrations:

1. **Storage Schema Version**: Tracked via `STORAGE_SCHEMA_VERSION = 1`.
2. **Atomic Reset Function**:
   ```typescript
   export function resetCRMStorage(): void {
     localStorage.removeItem('template_crm_data_v1');
     localStorage.removeItem('template_crm_selected_company_id');
     // Re-seeds immediately with fresh rich demo fixtures
     mockStore.initialize(true);
   }
   ```
3. **Data Integrity Guard**: On boot, `mockStore.initialize()` validates the stored JSON structure. If corrupt or from an obsolete schema version, it gracefully resets to default seed data without crashing the UI.

---

## 6. Routing Architecture & RBAC Subsystem

- **Primary Route Prefix**: `/crm` (all modules route via `/crm`, `/crm/invoices`, `/crm/invoices/new`, `/crm/invoices/list`, `/crm/quotes`, `/crm/roles`, etc.).
- **Legacy Compatibility**: `/admin/*` routes transparently alias and map to the active CRM views.
- **RBAC Role Management**: Integrated directly at `src/components/admin/roles/` mirroring the granular permission matrix from `kdadks` (`RoleListTab`, `RoleAccessMatrixTab`, `UserAssignmentsTab`, `RoleAuditLogTab`, `RoleModal`, `UserAssignmentModal`). Accessible via `/crm/roles`.
- **Terms Templates Offline Memory**: Default Ireland & EU B2B terms stored in `terms_templates` key in `template_crm_data_v2`, guaranteeing seamless invoice creation when Supabase is disconnected.

---

## 7. Automated Multi-Jurisdiction Tax & Compliance Reporting Engine

- **Jurisdiction Detection**: Automatically infers entity tax regime based on active company (`comp-irl-002` $\rightarrow$ Irish VAT3, `comp-ind-001` $\rightarrow$ Indian GST).
- **Irish & EU VAT3 Engine** (`TaxReportingService.generateIrishVAT3Report`):
  - **T1**: VAT on domestic Irish sales (23% standard / 13.5% reduced).
  - **T2**: Input VAT deductible on qualifying operational expenses and purchases.
  - **T3 / T4**: Net VAT payable to Revenue Commissioners or refundable.
  - **E1 & ES1**: Net value of intra-EU B2B supplies to VAT-registered clients under Reverse Charge (0%).
  - **E2 & ES2**: Intra-EU acquisitions of goods/services under self-accounting reverse charge.
  - **VIES Dispatches**: Schedule of European B2B customers, member state codes, and EU VAT IDs.
  - **Export Formats**: ROS (Revenue Online Service) compliant JSON and Accountant Audit CSV.
- **Indian GST Engine** (`TaxReportingService.generateIndianGSTReport`):
  - **GSTR-3B Table 3.1**: Outward taxable supplies categorized into Intra-State (CGST 9% + SGST 9%), Inter-State (IGST 18% / CST), and Zero-Rated Exports (LUT 0%).
  - **GSTR-3B Table 4**: Eligible Input Tax Credit (ITC) from inward vendor expenses.
  - **GSTR-3B Table 5.1**: Statutory ITC cross-utilization matrix and net cash tax payable.
  - **GSTR-1 Summary**: B2B (with GSTIN), B2C Large (> ₹2.5 Lakhs inter-state), B2C Small, Exports Table 6A.
  - **Table 12 HSN/SAC Summary**: IT Consulting (SAC 998313).
  - **Export Formats**: GSTN Offline Tool compliant JSON and Accountant Audit CSV.
- **Route & Access**: Located under Finance & Costs at `/crm/tax-reports` (and `/admin/tax-reports`). Accessible directly from Executive Dashboard and Finance P&L header.


