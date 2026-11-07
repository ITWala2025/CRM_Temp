# Autonomous CRM Agents & Copilot Module
`@enterprise/crm-agent-copilot`

A self-contained, enterprise-grade Autonomous Agent Copilot module designed for revenue operations, deal health monitoring, invoice collections, contract compliance, expense anomaly detection, and customer retention.

---

## 1. Module Overview

This module packages 5 specialized runtime autonomous agents into a slide-over copilot center and background monitoring engine:

1. **Deal Health & CPQ Estimator Agent**: Monitors quote validity horizons ($< 5$ days) and flags excessive discounting against rate cards.
2. **Collections & Cash Flow Chaser Agent**: Analyzes aging buckets (`1-15d`, `16-30d`, `31-60d`, `60+d`) and synthesizes personalized payment reminder drafts with verified banking coordinates.
3. **Contract Compliance & Renewal Agent**: Tracks maturity milestones at 30/60/90 days and auto-generates 12-month extension quote drafts.
4. **Financial Anomaly & Expense Auditor Agent**: Identifies duplicate vendor charges and transactions requiring controller signoff ($> €5,000$).
5. **Customer 360 & Account Retention Scout**: Flags dormant Tier-1 accounts ($> 60$ days inactive) to protect Net Revenue Retention.

---

## 2. Exporting / Extracting Out of this App

This module has zero hard coupling to the host CRM and can be exported as a standalone npm package or copied to another repository:

### Step 1: Copy Module Folder
Copy `src/modules/agent-copilot/` into your target project:
```bash
cp -r src/modules/agent-copilot /path/to/other-project/src/modules/
```

### Step 2: Implement Data Provider (Adapter Pattern)
When using outside this CRM, supply an `AgentDataProvider` implementation to connect your own REST API, Supabase, or PostgreSQL backend:

```typescript
import { agentEngine, AgentDataProvider } from './modules/agent-copilot';

const myCustomApiProvider: AgentDataProvider = {
  async getQuotes(companyId) {
    return await api.fetchQuotes(companyId);
  },
  async getInvoices(companyId) {
    return await api.fetchInvoices(companyId);
  },
  async getContracts(companyId) {
    return await api.fetchContracts(companyId);
  },
  async getExpenses(companyId) {
    return await api.fetchExpenses(companyId);
  },
  async getCustomers() {
    return await api.fetchCustomers();
  },
  async getCompanySettings(companyId) {
    return await api.fetchCompanyBanking(companyId);
  },
};

// Wire provider
agentEngine.setDataProvider(myCustomApiProvider);
```

### Step 3: Embed in any React Component
```tsx
import React, { useState } from 'react';
import { AgentCopilotCenter } from './modules/agent-copilot';

export const MyDashboard = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>Open Copilot</button>
      <AgentCopilotCenter
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onNavigateToEntity={(type, id) => console.log('Navigate to:', type, id)}
      />
    </div>
  );
};
```

---

## 3. Client Entitlement & Feature Toggle (Paid Tier Management)

The module includes client entitlement controls so you can turn the feature **ON** or **OFF** per client/tenant if they have not purchased the Enterprise AI Add-On:

```typescript
import { copilotSettingsService } from './modules/agent-copilot';

// Check if client has paid for AI Agents:
const isPaid = copilotSettingsService.isModuleEnabled();

// Deactivate for unpaid client:
copilotSettingsService.setModuleEnabled(false);

// Activate for paid Enterprise client:
copilotSettingsService.setModuleEnabled(true);
```

### Embed Client Settings Card in your Settings UI:
```tsx
import { AgentSettingsCard } from './modules/agent-copilot';

export const SettingsPage = () => {
  return (
    <div>
      <h2>Client Plan & Feature Settings</h2>
      {/* Renders Master ON/OFF toggle, sub-agent switches, and threshold controls */}
      <AgentSettingsCard onSaved={() => console.log('Saved!')} />
    </div>
  );
};
```

---

## 4. Human-In-The-Loop Governance & Audit Trail

All autonomous agent recommendations, drafted emails, and operator reviews are recorded in the structured audit stream (`AgentAuditRecord`) satisfying SOC2 / compliance guidelines:

```typescript
export interface AgentAuditRecord {
  id: string;
  agentName: 'DealHealthAgent' | 'CollectionsAgent' | 'ComplianceAgent' | 'FinanceAuditor' | 'CustomerScout';
  actionType: 'RECOMMENDATION' | 'ALERT' | 'AUTO_ACTION' | 'DRAFT_CREATED';
  entityType: 'customer' | 'quote' | 'invoice' | 'contract' | 'expense';
  entityId: string;
  payload: Record<string, any>;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'DISMISSED' | 'APPLIED';
  timestamp: string;
  actorName?: string;
  resolutionNotes?: string;
}
```

Audit records can be viewed in the "Audit Trail" tab of the Copilot Center or exported as CSV / JSON via `agentAuditService.exportToCsv()`.

