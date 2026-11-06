import {
  mockCountries,
  mockCompanySettings,
  mockProducts,
  mockRateCards,
  mockCustomers,
  mockCustomerContacts,
  mockCustomerRelationships,
  mockQuoteSettings,
  mockQuotes,
  mockInvoiceSettings,
  mockInvoices,
  mockTermsTemplates,
  mockContractTemplates,
  mockContracts,
  mockIncomeCategories,
  mockManualTransactions,
  mockExpenseCategories,
  mockVendors,
  mockExpenses,
  mockActivityTimeline,
} from './mockData';

const STORAGE_KEY = 'template_crm_data_v2';

export interface CRMStorageState {
  version: number;
  countries: any[];
  company_settings: any[];
  products: any[];
  rate_cards: any[];
  customers: any[];
  customer_contacts: any[];
  customer_relationships: any[];
  quote_settings: any;
  quotes: any[];
  invoice_settings: any;
  invoices: any[];
  terms_templates: any[];
  contract_templates: any[];
  contracts: any[];
  income_categories: any[];
  manual_transactions: any[];
  expense_categories: any[];
  vendors: any[];
  expenses: any[];
  activity_timeline: any[];
}

function getDefaultState(): CRMStorageState {
  return {
    version: 2,
    countries: JSON.parse(JSON.stringify(mockCountries)),
    company_settings: JSON.parse(JSON.stringify(mockCompanySettings)),
    products: JSON.parse(JSON.stringify(mockProducts)),
    rate_cards: JSON.parse(JSON.stringify(mockRateCards)),
    customers: JSON.parse(JSON.stringify(mockCustomers)),
    customer_contacts: JSON.parse(JSON.stringify(mockCustomerContacts)),
    customer_relationships: JSON.parse(JSON.stringify(mockCustomerRelationships)),
    quote_settings: JSON.parse(JSON.stringify(mockQuoteSettings)),
    quotes: JSON.parse(JSON.stringify(mockQuotes)),
    invoice_settings: JSON.parse(JSON.stringify(mockInvoiceSettings)),
    invoices: JSON.parse(JSON.stringify(mockInvoices)),
    terms_templates: JSON.parse(JSON.stringify(mockTermsTemplates)),
    contract_templates: JSON.parse(JSON.stringify(mockContractTemplates)),
    contracts: JSON.parse(JSON.stringify(mockContracts)),
    income_categories: JSON.parse(JSON.stringify(mockIncomeCategories)),
    manual_transactions: JSON.parse(JSON.stringify(mockManualTransactions)),
    expense_categories: JSON.parse(JSON.stringify(mockExpenseCategories)),
    vendors: JSON.parse(JSON.stringify(mockVendors)),
    expenses: JSON.parse(JSON.stringify(mockExpenses)),
    activity_timeline: JSON.parse(JSON.stringify(mockActivityTimeline)),
  };
}

class MockStore {
  private state: CRMStorageState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): CRMStorageState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.version === 2) {
          if (!parsed.terms_templates || !parsed.terms_templates.length) {
            parsed.terms_templates = JSON.parse(JSON.stringify(mockTermsTemplates));
            this.saveState(parsed);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stored CRM mock data, using fresh defaults', e);
    }
    const def = getDefaultState();
    this.saveState(def);
    return def;
  }

  private saveState(state: CRMStorageState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to write to localStorage', e);
    }
  }

  public reset(): void {
    this.state = getDefaultState();
    this.saveState(this.state);
  }

  public get<T>(collection: keyof CRMStorageState): T[] {
    const data = this.state[collection];
    if (Array.isArray(data)) {
      return JSON.parse(JSON.stringify(data)) as T[];
    }
    return [];
  }

  public getSingle<T>(collection: keyof CRMStorageState): T {
    return JSON.parse(JSON.stringify(this.state[collection])) as T;
  }

  public getById<T extends { id?: string }>(collection: keyof CRMStorageState, id: string): T | undefined {
    const list = this.get<T>(collection);
    return list.find((item) => item.id === id);
  }

  public insert<T extends { id?: string }>(collection: keyof CRMStorageState, item: T): T {
    const list = this.get<T>(collection);
    const newItem = {
      ...item,
      id: item.id || `gen-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      created_at: (item as any).created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.unshift(newItem);
    (this.state as any)[collection] = list;
    this.saveState(this.state);
    return newItem;
  }

  public update<T extends { id?: string }>(collection: keyof CRMStorageState, id: string, updates: Partial<T>): T {
    const list = this.get<T>(collection);
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Item ${id} not found in ${String(collection)}`);
    }
    const updated = {
      ...list[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    list[index] = updated;
    (this.state as any)[collection] = list;
    this.saveState(this.state);
    return updated;
  }

  public delete(collection: keyof CRMStorageState, id: string): boolean {
    const list = this.get<any>(collection);
    const initialLen = list.length;
    const filtered = list.filter((item) => item.id !== id);
    (this.state as any)[collection] = filtered;
    this.saveState(this.state);
    return filtered.length < initialLen;
  }

  public addTimelineEvent(event: {
    sourceType: string;
    title: string;
    description?: string;
    actorName?: string;
    badgeText?: string;
    badgeVariant?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  }): void {
    const newEvent = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.state.activity_timeline.unshift(newEvent);
    this.saveState(this.state);
  }
}

export const mockStore = new MockStore();

