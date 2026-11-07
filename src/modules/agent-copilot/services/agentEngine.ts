/**
 * Autonomous CRM Agents & Copilot Module
 * Multi-Agent Autonomous Diagnostic Engine
 */

import { AgentInsight, AgentDataProvider } from '../types';
import { copilotSettingsService } from './copilotSettingsService';
import { mockStore } from '../../../data/mockStore';
import type { Quote } from '../../../types/quote';
import type { Invoice, CompanySettings, Customer } from '../../../types/invoice';
import type { Contract } from '../../../types/contract';
import type { Expense } from '../../../services/expenseService';

/**
 * Default CRM mock data provider.
 * When exported outside this app, can be replaced by any REST/GraphQL/Supabase provider.
 */
export const defaultDataProvider: AgentDataProvider = {
  async getQuotes(companyId?: string) {
    const quotes = mockStore.get<Quote>('quotes');
    return companyId ? quotes.filter((q) => q.company_settings_id === companyId) : quotes;
  },
  async getInvoices(companyId?: string) {
    const invoices = mockStore.get<Invoice>('invoices');
    return companyId ? invoices.filter((i) => i.company_settings_id === companyId) : invoices;
  },
  async getContracts(companyId?: string) {
    const contracts = mockStore.get<Contract>('contracts');
    return companyId ? contracts.filter((c) => c.company_settings_id === companyId) : contracts;
  },
  async getExpenses(companyId?: string) {
    const expenses = mockStore.get<Expense>('expenses');
    return companyId ? expenses.filter((e) => e.company_settings_id === companyId) : expenses;
  },
  async getCustomers() {
    return mockStore.get<Customer>('customers');
  },
  async getCompanySettings(companyId?: string) {
    const list = mockStore.get<CompanySettings>('company_settings');
    if (companyId) {
      return list.find((c) => c.id === companyId) || list[0];
    }
    return list.find((c) => c.is_default) || list[0];
  },
};

export class AgentEngine {
  private dataProvider: AgentDataProvider;

  constructor(dataProvider: AgentDataProvider = defaultDataProvider) {
    this.dataProvider = dataProvider;
  }

  public setDataProvider(provider: AgentDataProvider) {
    this.dataProvider = provider;
  }

  /**
   * 1. Deal Health & CPQ Estimator Agent
   */
  public async runDealHealthAgent(companyId?: string): Promise<AgentInsight[]> {
    const settings = copilotSettingsService.getSettings();
    if (!settings.enabled || !settings.agents.dealHealth) return [];

    const quotes = await this.dataProvider.getQuotes(companyId);
    const insights: AgentInsight[] = [];
    const now = new Date();
    const expiryThreshold = settings.thresholds.quoteExpiryWarningDays;
    const discountThreshold = settings.thresholds.quoteDiscountWarningPercent;

    for (const quote of quotes) {
      const qCurr = quote.currency_code === 'EUR' ? '€' : quote.currency_code === 'INR' ? '₹' : quote.currency_code === 'USD' ? '$' : '€';

      // 1. Check for nearing expiry
      if (quote.status === 'sent' && quote.valid_until) {
        const expiryDate = new Date(quote.valid_until);
        const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= expiryThreshold) {
          insights.push({
            id: `dh-exp-${quote.id}`,
            agentName: 'DealHealthAgent',
            agentLabel: 'Deal Health & Estimator Agent',
            actionType: 'ALERT',
            severity: diffDays <= 2 ? 'high' : 'medium',
            title: `Quote ${quote.quote_number} Expiring in ${diffDays} Day${diffDays === 1 ? '' : 's'}`,
            description: `Valued at ${qCurr}${quote.total_amount?.toLocaleString()} for ${quote.customer?.company_name || 'Customer'}. Immediate follow-up or validity extension recommended before quote terms lapse.`,
            entityType: 'quote',
            entityId: quote.id,
            status: 'PENDING_REVIEW',
            timestamp: new Date().toISOString(),
            metadata: {
              daysToExpiry: diffDays,
              quoteTotal: quote.total_amount,
              expiryDate: quote.valid_until,
              customerName: quote.customer?.company_name,
            },
          });
        }
      }

      // 2. High Discount Alert
      if (quote.subtotal && quote.discount_amount) {
        const discountPercentage = (quote.discount_amount / quote.subtotal) * 100;
        if (discountPercentage >= discountThreshold) {
          insights.push({
            id: `dh-disc-${quote.id}`,
            agentName: 'DealHealthAgent',
            agentLabel: 'Deal Health & Estimator Agent',
            actionType: 'RECOMMENDATION',
            severity: discountPercentage >= 25 ? 'high' : 'medium',
            title: `High Discount Warning (${discountPercentage.toFixed(1)}%) on ${quote.quote_number}`,
            description: `Discount of ${qCurr}${quote.discount_amount.toLocaleString()} exceeds your standard ${discountThreshold}% threshold. Consider capping discount or requesting executive approval.`,
            entityType: 'quote',
            entityId: quote.id,
            status: 'PENDING_REVIEW',
            timestamp: new Date().toISOString(),
            metadata: {
              originalDiscountPercent: Math.round(discountPercentage),
              suggestedDiscountPercent: 10,
              discountAmount: quote.discount_amount,
              subtotal: quote.subtotal,
              quoteTotal: quote.total_amount,
            },
          });
        }
      }
    }

    return insights;
  }

  /**
   * 2. Collections & Cash Flow Chaser Agent
   */
  public async runCollectionsAgent(companyId?: string): Promise<AgentInsight[]> {
    const settings = copilotSettingsService.getSettings();
    if (!settings.enabled || !settings.agents.collections) return [];

    const invoices = await this.dataProvider.getInvoices(companyId);
    const company = await this.dataProvider.getCompanySettings(companyId);
    const insights: AgentInsight[] = [];
    const now = new Date();
    const graceDays = settings.thresholds.invoiceOverdueGraceDays;

    for (const inv of invoices) {
      const isOverdue =
        inv.status === 'overdue' ||
        (inv.payment_status !== 'paid' && inv.due_date && new Date(inv.due_date) < now);

      if (isOverdue) {
        const dueDate = new Date(inv.due_date || now.toISOString());
        const daysOverdue = Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        if (daysOverdue >= graceDays) {
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

          const curr = inv.currency_code === 'EUR' ? '€' : inv.currency_code === 'INR' ? '₹' : inv.currency_code === 'USD' ? '$' : '€';
          const balance = inv.total_amount || 0;
          const customerEmail = inv.customer?.billing_email || inv.customer?.email || 'accounts@client.com';
          const customerName = inv.customer?.company_name || 'Valued Partner';

          // Synthesize personalized payment reminder draft
          const bankingInfo = {
            bankName: company?.bank_name || 'Barclays International Corporate Banking',
            accountNumber: company?.account_number || '****9821',
            iban: company?.iban || 'IE29 AIBK 9311 5212 3456 78',
            swiftBic: company?.swift_bic || 'AIBKIE2D',
            ifscCode: company?.ifsc_code,
          };

          const draftSubject = `URGENT: Outstanding Balance for Invoice ${inv.invoice_number} (${curr}${balance.toLocaleString()})`;
          const draftBody = `Dear Accounts Payable Team at ${customerName},

According to our records, payment for invoice ${inv.invoice_number} in the amount of ${curr}${balance.toLocaleString()} was due on ${inv.due_date} and is currently ${daysOverdue} days past due (${bucket} aging bucket).

Please remit payment to our designated corporate banking coordinates:
- Beneficiary: ${company?.company_name || 'Enterprise CRM Operating Entity'}
- Bank: ${bankingInfo.bankName}
- IBAN: ${bankingInfo.iban}
- BIC / SWIFT: ${bankingInfo.swiftBic}
- Reference: ${inv.invoice_number}

If payment has already been initiated, kindly reply with the transaction remittance advice.

Sincerely,
Automated Revenue & Collections Desk`;

          insights.push({
            id: `col-${inv.id}`,
            agentName: 'CollectionsAgent',
            agentLabel: 'Collections & Cash Chaser Agent',
            actionType: 'DRAFT_CREATED',
            severity,
            title: `Payment Follow-up Ready for ${inv.invoice_number} (${daysOverdue}d Overdue)`,
            description: `Outstanding balance of ${curr}${balance.toLocaleString()} for ${customerName} (${bucket}). Personalized payment reminder email synthesized with bank coordinates.`,
            entityType: 'invoice',
            entityId: inv.id,
            status: 'PENDING_REVIEW',
            timestamp: new Date().toISOString(),
            metadata: {
              daysOverdue,
              balanceDue: balance,
              draftRecipient: customerEmail,
              draftSubject,
              draftBody,
              bankingCoordinates: bankingInfo,
            },
          });
        }
      }
    }

    return insights;
  }

  /**
   * 3. Contract Compliance & Renewal Agent
   */
  public async runComplianceAgent(companyId?: string): Promise<AgentInsight[]> {
    const settings = copilotSettingsService.getSettings();
    if (!settings.enabled || !settings.agents.compliance) return [];

    const contracts = await this.dataProvider.getContracts(companyId);
    const insights: AgentInsight[] = [];
    const now = new Date();
    const horizon = settings.thresholds.contractRenewalWarningDays;

    for (const ctr of contracts) {
      if (ctr.status === 'active' && ctr.expiry_date) {
        const expiryDate = new Date(ctr.expiry_date);
        const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysToExpiry > 0 && daysToExpiry <= horizon) {
          insights.push({
            id: `ctr-renew-${ctr.id}`,
            agentName: 'ComplianceAgent',
            agentLabel: 'Contract Compliance & Renewal Agent',
            actionType: 'RECOMMENDATION',
            severity: daysToExpiry <= 30 ? 'high' : 'medium',
            title: `Contract ${ctr.contract_number} Expiring in ${daysToExpiry} Days`,
            description: `Master Agreement "${ctr.contract_title}" with ${ctr.party_b_name || 'Customer'} reaches maturity on ${ctr.expiry_date}. Auto-renewal quote generation recommended.`,
            entityType: 'contract',
            entityId: ctr.id,
            status: 'PENDING_REVIEW',
            timestamp: new Date().toISOString(),
            metadata: {
              daysToExpiry,
              expiryDate: ctr.expiry_date,
              contractValue: ctr.contract_value || 25000,
              renewalQuoteTitle: `Renewal: ${ctr.contract_title}`,
              suggestedTermMonths: 12,
            },
          });
        }
      }
    }

    return insights;
  }

  /**
   * 4. Financial Anomaly & Expense Auditor Agent
   */
  public async runFinanceAuditorAgent(companyId?: string): Promise<AgentInsight[]> {
    const settings = copilotSettingsService.getSettings();
    if (!settings.enabled || !settings.agents.financeAuditor) return [];

    const expenses = await this.dataProvider.getExpenses(companyId);
    const insights: AgentInsight[] = [];
    const seenVendorDate = new Map<string, Expense>();
    const highExpenseLimit = settings.thresholds.largeExpenseThreshold;

    for (const exp of expenses) {
      const expCurr = exp.currency === 'EUR' ? '€' : exp.currency === 'INR' ? '₹' : exp.currency === 'USD' ? '$' : '€';

      // 1. Duplicate check (same vendor_name, same expense_date, similar amount)
      const key = `${(exp.vendor_name || '').toLowerCase().trim()}_${exp.expense_date}_${exp.amount}`;
      if (seenVendorDate.has(key)) {
        const original = seenVendorDate.get(key)!;
        insights.push({
          id: `fin-dup-${exp.id}`,
          agentName: 'FinanceAuditor',
          agentLabel: 'Financial Anomaly & Expense Auditor',
          actionType: 'ALERT',
          severity: 'high',
          title: `Potential Duplicate Expense Detected`,
          description: `Expense #${exp.expense_number} (${exp.title || 'Expense'}: ${expCurr}${exp.amount.toLocaleString()}) matches another transaction logged for vendor "${exp.vendor_name}" on ${exp.expense_date}.`,
          entityType: 'expense',
          entityId: exp.id,
          status: 'PENDING_REVIEW',
          timestamp: new Date().toISOString(),
          metadata: {
            duplicateExpenseIds: [original.id, exp.id],
            matchedVendor: exp.vendor_name,
            matchedAmount: exp.amount,
            matchedDate: exp.expense_date,
          },
        });
      } else {
        seenVendorDate.set(key, exp);
      }

      // 2. High Value Discretionary Expense (> threshold)
      if (exp.amount >= highExpenseLimit && exp.payment_status === 'pending') {
        insights.push({
          id: `fin-high-${exp.id}`,
          agentName: 'FinanceAuditor',
          agentLabel: 'Financial Anomaly & Expense Auditor',
          actionType: 'ALERT',
          severity: 'medium',
          title: `Large Expense Awaiting Controller Signoff`,
          description: `Expense #${exp.expense_number} of ${expCurr}${exp.amount.toLocaleString()} for "${exp.description || exp.title}" exceeds the ${expCurr}${highExpenseLimit.toLocaleString()} discretionary threshold.`,
          entityType: 'expense',
          entityId: exp.id,
          status: 'PENDING_REVIEW',
          timestamp: new Date().toISOString(),
          metadata: {
            matchedAmount: exp.amount,
            vendorName: exp.vendor_name,
          },
        });
      }
    }

    return insights;
  }

  /**
   * 5. Customer 360 & Account Retention Scout
   */
  public async runCustomerScoutAgent(): Promise<AgentInsight[]> {
    const settings = copilotSettingsService.getSettings();
    if (!settings.enabled || !settings.agents.customerScout) return [];

    const customers = await this.dataProvider.getCustomers();
    const insights: AgentInsight[] = [];
    const now = new Date();
    const inactivityLimit = settings.thresholds.customerInactivityDays;

    for (const cust of customers) {
      // Check for high-tier customer inactivity
      if (cust.status === 'active') {
        const lastActive = cust.last_interaction_at || cust.updated_at || cust.created_at;
        if (lastActive) {
          const diffDays = Math.ceil((now.getTime() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= inactivityLimit) {
            insights.push({
              id: `scout-inact-${cust.id}`,
              agentName: 'CustomerScout',
              agentLabel: 'Customer 360 Scout Agent',
              actionType: 'RECOMMENDATION',
              severity: 'low',
              title: `Dormant Account Alert: ${cust.company_name}`,
              description: `No recorded operational touchpoints in ${diffDays} days for Tier-1 customer ${cust.company_name}. Proactive executive outreach recommended.`,
              entityType: 'customer',
              entityId: cust.id,
              status: 'PENDING_REVIEW',
              timestamp: new Date().toISOString(),
              metadata: {
                inactiveDays: diffDays,
                lastActivityDate: lastActive,
                accountTier: cust.tier || 'Enterprise',
              },
            });
          }
        }
      }
    }

    return insights;
  }

  /**
   * Run all enabled agents and aggregate real-time insights
   */
  public async runAllAgents(companyId?: string): Promise<AgentInsight[]> {
    const settings = copilotSettingsService.getSettings();
    if (!settings.enabled) {
      return [];
    }

    const [dealInsights, colInsights, compInsights, finInsights, scoutInsights] = await Promise.all([
      this.runDealHealthAgent(companyId),
      this.runCollectionsAgent(companyId),
      this.runComplianceAgent(companyId),
      this.runFinanceAuditorAgent(companyId),
      this.runCustomerScoutAgent(),
    ]);

    return [...dealInsights, ...colInsights, ...compInsights, ...finInsights, ...scoutInsights];
  }
}

export const agentEngine = new AgentEngine();
export default agentEngine;
