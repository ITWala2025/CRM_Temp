# AI Agents Architecture & Automation Framework
## Autonomous CRM & Development Agents

**Project**: Modular Multi-Client Enterprise CRM Template  
**Version**: `1.0.0`  
**Integration Paradigm**: Event-driven Autonomous Agents + Developer Assistant Protocols  

---

## 1. Overview & Vision

In enterprise CRM systems, manual data entry, missed renewal dates, delayed invoice follow-ups, and static financial reporting reduce operational efficiency. This CRM template integrates an **Agentic AI Architecture** designed both for:
1. **Runtime CRM Autonomous Agents**: AI agents that monitor operational events (quotes expiring, overdue invoices, contract milestones, financial anomalies) and perform proactive workflows.
2. **Developer Scaffolding Agents**: Coding AI agents (Antigravity, Claude, GPT) that automate white-label client onboarding, custom module activation, schema migrations, and brand token injection.

```
+-----------------------------------------------------------------------------------+
|                            EVENT BUS & AUDIT STREAM                               |
|   (QuoteCreated, InvoiceOverdue, ContractExpiring, ExpenseLogged, CustomerAdded) |
+-----------------------------------------------------------------------------------+
                                         |
     +-----------------+-----------------+-----------------+-----------------+
     |                 |                 |                 |                 |
     v                 v                 v                 v                 v
+------------+   +------------+   +------------+   +------------+   +------------+
|   Deal     |   |  Invoice   |   |  Contract  |   | Financial  |   | Customer   |
| Health     |   | Collection |   | Compliance |   |  Anomaly   |   | 360 Scout  |
|   Agent    |   |   Agent    |   |   Agent    |   |   Agent    |   |   Agent    |
+------------+   +------------+   +------------+   +------------+   +------------+
     |                 |                 |                 |                 |
     +-----------------+-----------------+-----------------+-----------------+
                                         |
                                         v
                         +-------------------------------+
                         |   HUMAN-IN-THE-LOOP APPROVAL  |
                         |   (Review queue, Toast, Logs) |
                         +-------------------------------+
```

---

## 2. Runtime Autonomous CRM Agents

### 2.1 The Deal Health & Quote Estimator Agent
- **Trigger**: Quote creation, Quote status change, Quote nearing expiry ($< 5$ days).
- **Capabilities**:
  - Compares quoted rate card items with past closed-won quotes for the same customer tier.
  - Recommends discount bounds and optimal payment terms.
  - Automatically notifies the assigned Account Manager when a high-value quotation is viewed or expiring without response.
- **Tool Calling Schema**:
  ```json
  {
    "name": "analyze_quote_deal_health",
    "parameters": {
      "quote_id": "string",
      "customer_id": "string",
      "items": "array",
      "total_amount": "number"
    }
  }
  ```

### 2.2 The Collections & Cash Flow Chaser Agent
- **Trigger**: Daily cron or `INVOICE_DUE_PASSED` event.
- **Capabilities**:
  - Scans unpaid invoices across entities.
  - Classifies invoices into Aging Buckets: `1-15 days`, `16-30 days`, `31-60 days`, `60+ days`.
  - Drafts empathetic, escalating payment reminders referencing invoice number, balance due, and banking coordinates.
  - Respects customer VIP status or ongoing dispute flags before queuing reminders.
- **Safeguard**: All outbound communications enter an "Agent Drafts" review drawer before sending unless the tenant enables full autopilot.

### 2.3 The Contract Lifecycle & Compliance Agent
- **Trigger**: Contract creation, milestone completion, or renewal horizon ($30/60/90$ days before `end_date`).
- **Capabilities**:
  - Parses contract text against corporate clause templates (e.g. standard indemnity, limitation of liability, payment terms).
  - Highlights deviation from master templates.
  - Tracks milestone deadlines and notifies project managers when deliverables risk breaching SLA terms.
  - Generates renewal quotes automatically for expiring annual maintenance contracts (AMC/SLA).

### 2.4 The Financial Anomaly & Expense Auditor Agent
- **Trigger**: Expense creation or manual transaction logging.
- **Capabilities**:
  - Flags duplicate vendor invoices (matched by vendor name, date, and invoice reference number).
  - Flags expenses exceeding 120% of the 3-month trailing average for a given category.
  - Calculates real-time burn rate and forecasts cash runway based on historical collection velocity.

---

## 3. Developer Scaffolding Agent (Antigravity Onboarding Agent)

When a developer copies this template CRM for a new client, an AI coding agent can execute the following standardized onboarding playbook:

### Agent Instruction: Client Onboarding Workflow
```markdown
1. READ `src/config/client.config.ts`.
2. PROMPT or RECEIVE client specifications:
   - Client legal name, operating entities (e.g. USA, UK, India, Ireland).
   - Brand color palette (primary hex, accent hex).
   - Default currency and tax regime (GST, VAT, Sales Tax).
   - Enabled module toggles.
3. WRITE updated client configuration into `src/config/client.config.ts`.
4. GENERATE client seed data in `src/data/mockData.ts` with customized company settings, banking coordinates, and initial demo records.
5. IF Supabase credentials provided:
   - Configure `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   - Execute database migration script `supabase/migrations/001_initial_crm_schema.sql`.
6. RUN `npm run build` to verify strict TypeScript compilation.
```

---

## 4. Agent Event Hooks & Storage

All agent activities, recommendations, and automated actions are logged to the `audit_logs` table (and stored in `mockStore`):

```typescript
export interface AgentAuditRecord {
  id: string;
  agentName: 'DealHealthAgent' | 'CollectionsAgent' | 'ComplianceAgent' | 'FinanceAuditor';
  actionType: 'RECOMMENDATION' | 'ALERT' | 'AUTO_ACTION' | 'DRAFT_CREATED';
  entityType: 'customer' | 'quote' | 'invoice' | 'contract' | 'expense';
  entityId: string;
  payload: Record<string, any>;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'DISMISSED' | 'APPLIED';
  timestamp: string;
}
```

This guarantees complete traceability and provides transparency to administrators.

