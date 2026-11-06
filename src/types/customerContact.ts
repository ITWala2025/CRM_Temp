// TypeScript types for Customer Contact Management

export type CustomerContactRole =
  | 'primary'
  | 'secondary'
  | 'sales'
  | 'support'
  | 'billing'
  | 'technical'
  | 'executive'
  | 'other';

export interface CustomerContact {
  id: string;
  customer_id: string;
  company_settings_id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  role: CustomerContactRole;
  is_primary: boolean;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  /** Cross-company links: other companies this contact also serves */
  linkedCustomers?: import('./customerHierarchy').ContactCustomerLink[];
}


export interface CreateCustomerContactData {
  customer_id: string;
  company_settings_id?: string | null;
  name: string;
  email?: string;
  phone?: string;
  job_title?: string;
  role?: CustomerContactRole;
  is_primary?: boolean;
  notes?: string;
}

export interface UpdateCustomerContactData {
  name?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  role?: CustomerContactRole;
  is_primary?: boolean;
  is_active?: boolean;
  notes?: string;
}

export interface CustomerContactFilters {
  customer_id?: string;
  role?: CustomerContactRole;
  is_active?: boolean;
  search?: string;
}

export const ROLE_LABELS: Record<CustomerContactRole, string> = {
  primary: 'Primary Contact',
  secondary: 'Secondary Contact',
  sales: 'Sales',
  support: 'Support',
  billing: 'Billing / Finance',
  technical: 'Technical',
  executive: 'Executive / Lead',
  other: 'Other'
};

export const ROLE_BADGE_CLASSES: Record<CustomerContactRole, string> = {
  primary: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  secondary: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  sales: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  support: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  billing: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  technical: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
  executive: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
  other: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
};
