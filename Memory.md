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

