import { mockStore } from '../data/mockStore';
import type { Quote } from '../types/quote';
import type { Invoice } from '../types/invoice';
import type { Contract } from '../types/contract';
import type { Expense } from './expenseService';

export interface AgentInsight {
  id: string;
  agentName: 'DealHealthAgent' | 'CollectionsAgent' | 'ComplianceAgent' | 'FinanceAuditor';
  agentLabel: string;
  actionType: 'RECOMMENDATION' | 'ALERT' | 'AUTO_ACTION' | 'DRAFT_CREATED';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  entityType: 'quote' | 'invoice' | 'contract' | 'expense' | 'customer';
  entityId: string;
  metadata?: Record<string, any>;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'DISMISSED' | 'APPLIED';
  timestamp: string;
}

export const agentService = {
  /**
   * Run Deal Health & Quote Estimator Agent
   */
  async runDealHealthAgent(companyId?: string): Promise<AgentInsight[]> {
    const quotes = mockStore.get<Quote>('quotes');
    const filteredQuotes = companyId
      ? quotes.filter((q) => q.company_settings_id === companyId)
      : quotes;

    const insights: AgentInsight[] = [];
    const now = new Date();

    for (const quote of filteredQuotes) {
      // 1. Check for nearing expiry (< 5 days)
      if (quote.status === 'sent' && quote.valid_until) {
        const expiryDate = new Date(quote.valid_until);
        const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 5) {
          insights.push({
            id: `insight-dh-exp-${quote.id}`,
            agentName: 'DealHealthAgent',
            agentLabel: 'Deal Health & Estimator Agent',
            actionType: 'ALERT',
            severity: diffDays <= 2 ? 'high' : 'medium',
            title: `Quote ${quote.quote_number} Expiring in ${diffDays} Day${diffDays === 1 ? '' : 's'}`,
            description: `Valued at ${quote.currency_code} ${quote.total_amount?.toLocaleString()} for ${quote.customer?.company_name || 'Customer'}. Immediate follow-up recommended before quote terms expire.`,
            entityType: 'quote',
            entityId: quote.id,
            status: 'PENDING_REVIEW',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // 2. High Discount Alert (> 15%)
      if (quote.subtotal && quote.discount_amount) {
        const discountPercentage = (quote.discount_amount / quote.subtotal) * 100;
        if (discountPercentage >= 15) {
          insights.push({
            id: `insight-dh-disc-${quote.id}`,
            agentName: 'DealHealthAgent',
            agentLabel: 'Deal Health & Estimator Agent',
            actionType: 'RECOMMENDATION',
            severity: 'medium',
            title: `High Discount Warning (${discountPercentage.toFixed(1)}%) on ${quote.quote_number}`,
            description: `Discount of ${quote.currency_code} ${quote.discount_amount.toLocaleString()} exceeds the standard 10% threshold. Verify target operating margins.`,
            entityType: 'quote',
            entityId: quote.id,
            status: 'PENDING_REVIEW',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return insights;
  },

  /**
   * Run Collections & Cash Flow Chaser Agent
   */
  async runCollectionsAgent(companyId?: string): Promise<AgentInsight[]> {
    const invoices = mockStore.get<Invoice>('invoices');
    const filteredInvoices = companyId
      ? invoices.filter((i) => i.company_settings_id === companyId)
      : invoices;

    const insights: AgentInsight[] = [];
    const now = new Date();

    for (const inv of filteredInvoices) {
      if (inv.status === 'overdue' || (inv.payment_status !== 'paid' && inv.due_date && new Date(inv.due_date) < now)) {
        const dueDate = new Date(inv.due_date || now.toISOString());
        const daysOverdue = Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        const balanceDue = inv.total_amount || 0;

        let bucket = '1-15 days';
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

        if (daysOverdue > 60) {
          bucket = '60+ days';
          severity = 'critical';
        } else if (daysOverdue > 30) {
          bucket = '31-60 days';
          severity = 'high';
        } else if (daysOverdue > 15) {
          bucket = '16-30 days';
          severity = 'medium';
        }

        insights.push({
          id: `insight-col-${inv.id}`,
          agentName: 'CollectionsAgent',
          agentLabel: 'Collections & Cash Chaser Agent',
          actionType: 'DRAFT_CREATED',
          severity,
          title: `Payment Follow-up Drafted for ${inv.invoice_number} (${daysOverdue} Days Overdue)`,
          description: `Outstanding balance of ${inv.currency_code || '$'} ${balanceDue.toLocaleString()} for ${inv.customer?.company_name || 'Customer'} (Aging Bucket: ${bucket}). Personalized payment reminder email ready for dispatch.`,
          entityType: 'invoice',
          entityId: inv.id,
          metadata: {
            daysOverdue,
            balanceDue,
            draftSubject: `Payment Reminder: Invoice ${inv.invoice_number} (${inv.customer?.company_name || 'Valued Partner'})`,
          },
          status: 'PENDING_REVIEW',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return insights;
  },

  /**
   * Run Contract Lifecycle & Compliance Agent
   */
  async runComplianceAgent(companyId?: string): Promise<AgentInsight[]> {
    const contracts = mockStore.get<Contract>('contracts');
    const filteredContracts = companyId
      ? contracts.filter((c) => c.company_settings_id === companyId)
      : contracts;

    const insights: AgentInsight[] = [];
    const now = new Date();

    for (const ctr of filteredContracts) {
      if (ctr.status === 'active' && ctr.expiry_date) {
        const expiryDate = new Date(ctr.expiry_date);
        const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysToExpiry > 0 && daysToExpiry <= 60) {
          insights.push({
            id: `insight-ctr-renew-${ctr.id}`,
            agentName: 'ComplianceAgent',
            agentLabel: 'Contract Compliance & Renewal Agent',
            actionType: 'RECOMMENDATION',
            severity: daysToExpiry <= 30 ? 'high' : 'medium',
            title: `Contract ${ctr.contract_number} Expiring in ${daysToExpiry} Days`,
            description: `${ctr.contract_title} with ${ctr.party_b_name || 'Customer'} reaches maturity on ${ctr.expiry_date}. Auto-renewal quote generation recommended.`,
            entityType: 'contract',
            entityId: ctr.id,
            status: 'PENDING_REVIEW',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return insights;
  },

  /**
   * Run Financial Anomaly & Expense Auditor Agent
   */
  async runFinanceAuditorAgent(companyId?: string): Promise<AgentInsight[]> {
    const expenses = mockStore.get<Expense>('expenses');
    const filteredExpenses = companyId
      ? expenses.filter((e) => e.company_settings_id === companyId)
      : expenses;

    const insights: AgentInsight[] = [];
    const seenVendorDate = new Map<string, Expense>();

    for (const exp of filteredExpenses) {
      // 1. Duplicate check (same vendor_name, same expense_date, similar amount)
      const key = `${(exp.vendor_name || '').toLowerCase().trim()}_${exp.expense_date}_${exp.amount}`;
      if (seenVendorDate.has(key)) {
        insights.push({
          id: `insight-fin-dup-${exp.id}`,
          agentName: 'FinanceAuditor',
          agentLabel: 'Financial Anomaly & Expense Auditor',
          actionType: 'ALERT',
          severity: 'high',
          title: `Potential Duplicate Expense Detected`,
          description: `Expense #${exp.expense_number} (${exp.title || 'Expense'}: ${exp.currency || '$'}${exp.amount}) matches another transaction logged for vendor "${exp.vendor_name}" on ${exp.expense_date}.`,
          entityType: 'expense',
          entityId: exp.id,
          status: 'PENDING_REVIEW',
          timestamp: new Date().toISOString(),
        });
      } else {
        seenVendorDate.set(key, exp);
      }

      // 2. High Value Discretionary Expense (> $5,000 / ₹4,00,000)
      if (exp.amount > 5000 && exp.payment_status === 'pending') {
        insights.push({
          id: `insight-fin-high-${exp.id}`,
          agentName: 'FinanceAuditor',
          agentLabel: 'Financial Anomaly & Expense Auditor',
          actionType: 'ALERT',
          severity: 'medium',
          title: `Large Expense Awaiting Executive Approval`,
          description: `Expense #${exp.expense_number} of ${exp.currency || '$'}${exp.amount.toLocaleString()} for "${exp.description || exp.title}" requires Controller signoff.`,
          entityType: 'expense',
          entityId: exp.id,
          status: 'PENDING_REVIEW',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return insights;
  },

  /**
   * Run all agents and aggregate insights
   */
  async runAllAgents(companyId?: string): Promise<AgentInsight[]> {
    const [dealInsights, colInsights, compInsights, finInsights] = await Promise.all([
      this.runDealHealthAgent(companyId),
      this.runCollectionsAgent(companyId),
      this.runComplianceAgent(companyId),
      this.runFinanceAuditorAgent(companyId),
    ]);

    return [...dealInsights, ...colInsights, ...compInsights, ...finInsights];
  },
};
