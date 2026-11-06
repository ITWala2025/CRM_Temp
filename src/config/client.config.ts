/**
 * Client Customization Configuration
 *
 * To customize this template CRM for a new client:
 * 1. Update the clientName, legalEntityName, and domain
 * 2. Update the theme colors to match client brand guidelines
 * 3. Update the default currency and taxSystem
 * 4. Toggle features in activeModules as required by the client
 * 5. Update the default company addresses and banking details
 */

export interface ClientConfig {
  clientId: string;
  clientName: string;
  legalEntityName: string;
  tagline: string;
  logoUrl?: string;
  theme: {
    primaryColor: string;
    primaryHover: string;
    accentColor: string;
    sidebarBg: string;
    sidebarText: string;
  };
  localization: {
    defaultCurrency: 'INR' | 'EUR' | 'USD' | 'GBP' | 'AED';
    locale: string;
    taxSystem: 'GST' | 'VAT' | 'SALES_TAX';
    dateFormat: string;
  };
  activeModules: {
    dashboard: boolean;
    customers: boolean;
    customer360: boolean;
    quotes: boolean;
    invoices: boolean;
    contracts: boolean;
    income: boolean;
    expenses: boolean;
    finance: boolean;
    rateCards: boolean;
  };
}

export const clientConfig: ClientConfig = {
  clientId: 'client-master-template',
  clientName: 'Enterprise CRM Europe',
  legalEntityName: 'Acme Cloud Technologies Ireland Limited',
  tagline: 'European Operations & Client Revenue Management Platform',
  theme: {
    primaryColor: '#4f46e5', // Indigo-600
    primaryHover: '#4338ca', // Indigo-700
    accentColor: '#10b981',  // Emerald-500
    sidebarBg: '#0f172a',    // Slate-900
    sidebarText: '#f8fafc',  // Slate-50
  },
  localization: {
    defaultCurrency: 'EUR',
    locale: 'en-IE',
    taxSystem: 'VAT',
    dateFormat: 'DD/MM/YYYY',
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

