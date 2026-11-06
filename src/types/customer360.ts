import type { Customer, Invoice, Payment } from './invoice';
import type { CustomerContact } from './customerContact';
import type { Lead, Opportunity } from './lead';
import type { Quote } from './quote';
import type { Contract } from './contract';
import type { CustomerSubscription } from './subscription';
import type { CustomerRelationship, ContactCustomerLink } from './customerHierarchy';
import type { ITSMTicket } from './itsm';

export interface CustomerFinancialMetrics {
  totalInvoiced: number;      // Lifetime value / total invoiced amount
  totalCollected: number;     // Total paid amount
  outstandingBalance: number; // Balance due (unpaid/partially paid/overdue)
  overdueBalance: number;     // Amount past due date
  activeSubscriptionMRR: number; // Monthly Recurring Revenue from active subscriptions
  openPipelineValue: number;  // Estimated total value of open leads & opportunities
  winRatePercentage: number;  // % of closed-won opportunities vs total closed opportunities
  contractsCount: number;     // Total active/valid contracts
  totalInvoicesCount: number; // Total invoices count
  paidInvoicesCount: number;  // Paid invoices count
}

export type TimelineSourceType = 
  | 'customer'
  | 'contact'
  | 'lead'
  | 'opportunity'
  | 'quote'
  | 'contract'
  | 'subscription'
  | 'invoice'
  | 'payment'
  | 'itsm_ticket';

export interface CustomerActivityTimelineItem {
  id: string;
  sourceType: TimelineSourceType;
  title: string;
  description?: string;
  timestamp: string;
  actorName?: string;
  badgeText?: string;
  badgeVariant?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  metadata?: Record<string, any>;
}

export interface Customer360Data {
  customer: Customer;
  contacts: CustomerContact[];
  primaryContact?: CustomerContact;
  leads: Lead[];
  opportunities: Opportunity[];
  quotes: Quote[];
  contracts: Contract[];
  subscriptions: CustomerSubscription[];
  invoices: Invoice[];
  payments: Payment[];
  itsmTickets?: ITSMTicket[];
  metrics: CustomerFinancialMetrics;
  timeline: CustomerActivityTimelineItem[];
  /** All B2B hierarchy relationships this customer is involved in */
  relationships: CustomerRelationship[];
  /** Cross-company contact links for contacts associated with this customer */
  contactLinks: ContactCustomerLink[];
}

export interface Customer360Filter {
  customerId: string;
  companySettingsId?: string;
}
