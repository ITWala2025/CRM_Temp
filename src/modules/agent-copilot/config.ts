/**
 * Autonomous CRM Agents & Copilot Module
 * Configuration & Metadata Defaults
 */

import { AgentModuleSettings, AgentType } from './types';

export const STORAGE_KEYS = {
  SETTINGS: 'crm_module_agent_copilot_settings_v1',
  AUDIT_LOGS: 'crm_module_agent_copilot_audit_v1',
  DISMISSED: 'crm_module_agent_copilot_dismissed_v1',
  EVENT_NAME: 'crm_agent_copilot_settings_changed',
};

export const DEFAULT_AGENT_SETTINGS: AgentModuleSettings = {
  enabled: true,
  planTier: 'enterprise',
  clientName: 'Enterprise CRM Client',
  agents: {
    dealHealth: true,
    collections: true,
    compliance: true,
    financeAuditor: true,
    customerScout: true,
  },
  thresholds: {
    quoteExpiryWarningDays: 5,
    quoteDiscountWarningPercent: 15,
    invoiceOverdueGraceDays: 1,
    contractRenewalWarningDays: 60,
    largeExpenseThreshold: 5000,
    customerInactivityDays: 60,
  },
  autoPilot: {
    enabled: false,
    requireApprovalForReminders: true,
    requireApprovalForQuotes: true,
    requireApprovalForExpenseFlags: true,
  },
  notifications: {
    showDashboardBadge: true,
    toastAlertsOnCritical: true,
  },
};

export interface AgentMeta {
  type: AgentType;
  label: string;
  shortLabel: string;
  tagline: string;
  description: string;
  iconName: 'FileText' | 'DollarSign' | 'FileSignature' | 'ShieldAlert' | 'Compass';
  themeColor: {
    bg: string;
    text: string;
    badge: string;
    border: string;
  };
  triggerEvents: string[];
}

export const AGENT_ROSTER: Record<AgentType, AgentMeta> = {
  DealHealthAgent: {
    type: 'DealHealthAgent',
    label: 'Deal Health & CPQ Estimator Agent',
    shortLabel: 'Deal Health',
    tagline: 'Monitoring Margins & Quote Expirations',
    description:
      'Continuously monitors quote aging, discount variance against rate cards, and profit margin thresholds.',
    iconName: 'FileText',
    themeColor: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      border: 'border-blue-200',
    },
    triggerEvents: ['QuoteCreated', 'QuoteDiscountThresholdExceeded', 'QuoteExpiryApproaching'],
  },
  CollectionsAgent: {
    type: 'CollectionsAgent',
    label: 'Collections & Cash Flow Chaser Agent',
    shortLabel: 'Collections Chaser',
    tagline: 'Tracking Overdue Receivables & Aging Buckets',
    description:
      'Categorizes overdue invoices into aging buckets (1-15d, 16-30d, 31-60d, 60+d) and synthesizes empathetic payment reminders.',
    iconName: 'DollarSign',
    themeColor: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      border: 'border-emerald-200',
    },
    triggerEvents: ['InvoiceDueDatePassed', 'PaymentOverdueEscalation', 'AgingBucketCrossed'],
  },
  ComplianceAgent: {
    type: 'ComplianceAgent',
    label: 'Contract Compliance & Renewal Agent',
    shortLabel: 'Contract Compliance',
    tagline: 'Tracking Renewal Horizons & SLA Compliance',
    description:
      'Tracks contract expiration milestones at 30/60/90 days and auto-generates renewal draft quotations.',
    iconName: 'FileSignature',
    themeColor: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      border: 'border-purple-200',
    },
    triggerEvents: ['ContractExpiringHorizon', 'MilestoneDueSLA', 'RenewalWindowOpened'],
  },
  FinanceAuditor: {
    type: 'FinanceAuditor',
    label: 'Financial Anomaly & Expense Auditor Agent',
    shortLabel: 'Finance Auditor',
    tagline: 'Detecting Duplicate Expenses & Outliers',
    description:
      'Identifies duplicate vendor charges, monitors discretionary expense spikes, and flags transactions requiring controller signoff.',
    iconName: 'ShieldAlert',
    themeColor: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      border: 'border-amber-200',
    },
    triggerEvents: ['ExpenseLogged', 'DuplicateVendorInvoiceDetected', 'HighValueDiscretionarySpend'],
  },
  CustomerScout: {
    type: 'CustomerScout',
    label: 'Customer 360 & Account Retention Scout',
    shortLabel: 'Customer Scout',
    tagline: 'Detecting Inactivity & Retention Risks',
    description:
      'Surfaces dormant enterprise accounts, highlights credit exposure spikes, and suggests proactive relationship touchpoints.',
    iconName: 'Compass',
    themeColor: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      border: 'border-indigo-200',
    },
    triggerEvents: ['CustomerDormant60Days', 'CreditExposureLimitReached', 'UpsellOpportunityIdentified'],
  },
};

