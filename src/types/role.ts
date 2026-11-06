// ====================================================================
// Role-Based Access Control (RBAC) Domain Types
// Supports Granular Action Permissions, Multi-Entity Scopes, and Presets
// ====================================================================

export type RoleAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

export type SystemModule =
  | 'dashboard'
  | 'leads'
  | 'opportunities'
  | 'customers'
  | 'customer_360'
  | 'quotes'
  | 'contracts'
  | 'invoices'
  | 'payments'
  | 'subscriptions'
  | 'rate_cards'
  | 'income'
  | 'expenses'
  | 'finance'
  | 'employees'
  | 'leave'
  | 'attendance'
  | 'compensation'
  | 'settlement'
  | 'policies'
  | 'performance'
  | 'board_resolutions'
  | 'announcements'
  | 'reporting'
  | 'settings'
  | 'roles'
  | 'itsm_tickets';

export type ModuleCategory =
  | 'crm_sales'
  | 'billing_revenue'
  | 'finance_accounting'
  | 'hr_operations'
  | 'service_desk'
  | 'governance_legal'
  | 'analytics_reporting'
  | 'administration';

export interface ModuleDefinition {
  key: SystemModule;
  name: string;
  description: string;
  category: ModuleCategory;
  availableActions: RoleAction[];
}

export type RolePermissionsMap = Record<string, RoleAction[]>;

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_system: boolean;
  is_default: boolean;
  status: 'active' | 'inactive';
  color: string;
  permissions: RolePermissionsMap;
  company_settings_id?: string | null;
  company_settings?: {
    id: string;
    company_name: string;
  } | null;
  assigned_users_count?: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleFormData {
  name: string;
  slug: string;
  description: string;
  status: 'active' | 'inactive';
  color: string;
  company_settings_id: string | null;
  permissions: RolePermissionsMap;
}

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role_id: string;
  role?: Role;
  company_settings_id?: string | null;
  company_settings?: {
    id: string;
    company_name: string;
  } | null;
  status: 'active' | 'suspended' | 'pending';
  assigned_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAssignmentFormData {
  user_id?: string;
  email: string;
  full_name: string;
  role_id: string;
  company_settings_id: string | null;
  status: 'active' | 'suspended' | 'pending';
  password?: string;
  is_new_user?: boolean;
  send_welcome_email?: boolean;
}

export interface SelectableUser {
  id: string;
  email: string;
  full_name: string;
  source: 'auth' | 'employee' | 'assignment';
  subtitle?: string;
  created_at?: string;
}

export interface RoleAuditLog {
  id: string;
  action: 'role_created' | 'role_updated' | 'role_deleted' | 'user_assigned' | 'user_revoked' | 'permissions_updated' | 'role_duplicated';
  target_type: 'role' | 'user';
  target_id: string;
  target_name: string;
  details?: Record<string, unknown>;
  performed_by?: string | null;
  created_at: string;
}

export interface RoleFilters {
  searchQuery?: string;
  status?: 'all' | 'active' | 'inactive';
  company_settings_id?: string | null;
}

export interface UserAssignmentFilters {
  searchQuery?: string;
  role_id?: string | 'all';
  status?: 'all' | 'active' | 'suspended' | 'pending';
  company_settings_id?: string | null | 'all';
}

export interface RolePreset {
  id: string;
  name: string;
  description: string;
  color: string;
  permissions: RolePermissionsMap;
}

// ====================================================================
// CONSTANTS & CATALOGS
// ====================================================================

export const MODULE_CATEGORIES: Record<
  ModuleCategory,
  { label: string; description: string; icon: string }
> = {
  crm_sales: {
    label: 'CRM & Sales Operations',
    description: 'Leads, Opportunities, Quotes, Customers, and B2B Hierarchy',
    icon: 'Target',
  },
  billing_revenue: {
    label: 'Billing & Invoicing',
    description: 'Invoices, Payments, Subscriptions, and Rate Cards',
    icon: 'Receipt',
  },
  finance_accounting: {
    label: 'Finance & Treasury',
    description: 'Company Income, Operational Expenses, and Financial Statements',
    icon: 'DollarSign',
  },
  hr_operations: {
    label: 'HR & People Operations',
    description: 'Employee Directory, Leave Requests, Attendance, Compensation, Settlements & Policies',
    icon: 'Users',
  },
  service_desk: {
    label: 'Service Desk & Support Operations',
    description: 'ITSM Support Ticket Queue, Incident Triage, Dual SLA Stopwatches, and Customer CSAT',
    icon: 'LifeBuoy',
  },
  governance_legal: {
    label: 'Governance & Legal',
    description: 'Board Resolutions, Contractual Agreements, and Organization Announcements',
    icon: 'Gavel',
  },
  analytics_reporting: {
    label: 'Analytics & Reporting Hub',
    description: 'Executive Dashboards, Sales Funnels, Revenue Aging, and Workforce Analytics',
    icon: 'BarChart3',
  },
  administration: {
    label: 'System & Security Admin',
    description: 'Organization Settings, PDF Branding, Payment Gateways, and RBAC Management',
    icon: 'Settings',
  },
};

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  // CRM & Sales
  {
    key: 'leads',
    name: 'Lead Pipeline',
    description: 'Manage sales inquiries, lead qualification, and conversion to opportunities',
    category: 'crm_sales',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    key: 'opportunities',
    name: 'Opportunity Deals',
    description: 'Track deal stages, expected revenue, and convert to quotes',
    category: 'crm_sales',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    key: 'customers',
    name: 'Customer Directory',
    description: 'Customer profile records, contacts, and tax registrations',
    category: 'crm_sales',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    key: 'customer_360',
    name: 'Customer 360° & Hierarchy',
    description: 'Unified operational hub, B2B company org chart, and multi-entity metrics',
    category: 'crm_sales',
    availableActions: ['view', 'edit', 'export'],
  },
  {
    key: 'quotes',
    name: 'Quotes & Proposals',
    description: 'Create multi-currency quotes, rate card line items, discounts, and PDF generation',
    category: 'crm_sales',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },

  // Billing & Revenue
  {
    key: 'invoices',
    name: 'Invoice Management',
    description: 'Generate multi-entity invoices, HSN/SAC codes, tax rates, and PDF issuance',
    category: 'billing_revenue',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  {
    key: 'payments',
    name: 'Payment Processing',
    description: 'Stripe & PayPal transactions, payment receipts, and reconciliation',
    category: 'billing_revenue',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  {
    key: 'subscriptions',
    name: 'Recurring Subscriptions',
    description: 'Subscription plans, billing cycles, auto-renewals, and MRR tracking',
    category: 'billing_revenue',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    key: 'rate_cards',
    name: 'Service Rate Cards',
    description: 'Standard pricing matrix for technical and consulting roles',
    category: 'billing_revenue',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },

  // Finance & Accounting
  {
    key: 'income',
    name: 'Income & Revenue Records',
    description: 'Track incoming payments, direct sales revenue, and miscellaneous earnings',
    category: 'finance_accounting',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    key: 'expenses',
    name: 'Expense Management',
    description: 'Log vendor expenses, operational costs, category tagging, and approval workflows',
    category: 'finance_accounting',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  {
    key: 'finance',
    name: 'Financial Health & P&L',
    description: 'Income vs Expense summaries, P&L reporting, and entity cash flow metrics',
    category: 'finance_accounting',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },

  // HR & People Operations
  {
    key: 'employees',
    name: 'Employee Directory & Docs',
    description: 'Employee profiles, offer letters, relieving letters, and onboarding documents',
    category: 'hr_operations',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    key: 'leave',
    name: 'Leave Management',
    description: 'Leave applications, entitlement balances, and manager approvals',
    category: 'hr_operations',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  {
    key: 'attendance',
    name: 'Attendance Tracking',
    description: 'Daily clock-in/out logs, shift summaries, and attendance regularization',
    category: 'hr_operations',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  {
    key: 'compensation',
    name: 'Compensation & Salary Slips',
    description: 'Salary structures, monthly payslip generation, deductions, and increments',
    category: 'hr_operations',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  {
    key: 'settlement',
    name: 'Full & Final Settlement',
    description: 'Exit dues calculation, notice pay recovery, asset clearance, and settlement PDF',
    category: 'hr_operations',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  {
    key: 'policies',
    name: 'HR Policies & SOPs',
    description: 'Company standard operating procedures, compliance handbooks across jurisdictions',
    category: 'hr_operations',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  {
    key: 'itsm_tickets',
    name: 'ITSM Support & Triage Desk',
    description: 'Support ticket queue, triage state machine, dual SLA stopwatches, private notes, and CSAT',
    category: 'service_desk',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  {
    key: 'performance',
    name: 'Performance & Reviews',
    description: 'Employee appraisal cycles, 360 feedback, and rating scorecards',
    category: 'hr_operations',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },

  // Governance & Legal
  {
    key: 'board_resolutions',
    name: 'Board Resolutions',
    description: 'Official corporate board minutes, resolutions, and formal document signing',
    category: 'governance_legal',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  {
    key: 'contracts',
    name: 'Contracts & Agreements',
    description: 'Client MSA/SOW contracts, NDAs, jurisdiction clauses, and PDF exporter',
    category: 'governance_legal',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  {
    key: 'announcements',
    name: 'Company Announcements',
    description: 'Broadcast notices, policy updates, and organization-wide bulletins',
    category: 'governance_legal',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },

  // Analytics & Reporting
  {
    key: 'reporting',
    name: 'Reports & Analytics',
    description: 'Comprehensive reporting across Sales, Invoices, Subscriptions, Quotes, and HR',
    category: 'analytics_reporting',
    availableActions: ['view', 'export'],
  },

  // Administration & Configuration
  {
    key: 'settings',
    name: 'Organization & Invoice Settings',
    description: 'Company legal entities, bank accounts, tax numbers, and invoice numbering format',
    category: 'administration',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    key: 'roles',
    name: 'Roles & Access Control',
    description: 'Create custom roles, configure permission matrix, and assign users',
    category: 'administration',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
];

export const ROLE_COLOR_PALETTES: { id: string; label: string; bg: string; text: string; border: string; badge: string }[] = [
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-800' },
  { id: 'blue', label: 'Blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800' },
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800' },
  { id: 'purple', label: 'Purple', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-800' },
  { id: 'teal', label: 'Teal', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-800' },
  { id: 'gray', label: 'Slate Gray', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-800' },
];

export const DEFAULT_ROLE_PRESETS: RolePreset[] = [
  {
    id: 'super_admin',
    name: 'Super Admin (Full Access)',
    description: 'Grants unrestricted administrative privileges across all system features and modules.',
    color: 'indigo',
    permissions: MODULE_DEFINITIONS.reduce((acc, mod) => {
      acc[mod.key] = [...mod.availableActions];
      return acc;
    }, {} as RolePermissionsMap),
  },
  {
    id: 'sales_lead',
    name: 'Sales Operations Lead',
    description: 'Full CRM access for leads, deals, quotes, customers, and sales reporting.',
    color: 'blue',
    permissions: {
      dashboard: ['view'],
      leads: ['view', 'create', 'edit', 'delete', 'export'],
      opportunities: ['view', 'create', 'edit', 'delete', 'export'],
      customers: ['view', 'create', 'edit', 'export'],
      customer_360: ['view', 'export'],
      quotes: ['view', 'create', 'edit', 'approve', 'export'],
      contracts: ['view', 'create', 'edit', 'export'],
      invoices: ['view', 'export'],
      subscriptions: ['view', 'create', 'edit', 'export'],
      rate_cards: ['view'],
      announcements: ['view'],
      reporting: ['view', 'export'],
    },
  },
  {
    id: 'finance_specialist',
    name: 'Finance & Accounts Officer',
    description: 'Handles customer invoices, recorded payments, operational expenses, income, and P&L statements.',
    color: 'emerald',
    permissions: {
      dashboard: ['view'],
      customers: ['view', 'export'],
      customer_360: ['view'],
      invoices: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
      payments: ['view', 'create', 'edit', 'approve', 'export'],
      subscriptions: ['view', 'create', 'edit', 'export'],
      income: ['view', 'create', 'edit', 'delete', 'export'],
      expenses: ['view', 'create', 'edit', 'approve', 'export'],
      finance: ['view', 'create', 'edit', 'export'],
      rate_cards: ['view', 'create', 'edit'],
      announcements: ['view'],
      reporting: ['view', 'export'],
    },
  },
  {
    id: 'hr_manager',
    name: 'HR & People Manager',
    description: 'Manages employee records, leaves, attendance, compensation, policy documents, and appraisals.',
    color: 'purple',
    permissions: {
      dashboard: ['view'],
      employees: ['view', 'create', 'edit', 'delete', 'export'],
      leave: ['view', 'create', 'edit', 'approve', 'export'],
      attendance: ['view', 'create', 'edit', 'approve', 'export'],
      compensation: ['view', 'create', 'edit', 'approve', 'export'],
      settlement: ['view', 'create', 'edit', 'approve', 'export'],
      policies: ['view', 'create', 'edit', 'approve', 'export'],
      performance: ['view', 'create', 'edit', 'approve', 'export'],
      announcements: ['view', 'create', 'edit', 'export'],
      reporting: ['view', 'export'],
    },
  },
  {
    id: 'legal_compliance',
    name: 'Legal & Compliance Officer',
    description: 'Administers formal contracts, board resolutions, corporate policies, and compliance archives.',
    color: 'amber',
    permissions: {
      dashboard: ['view'],
      contracts: ['view', 'create', 'edit', 'approve', 'export'],
      board_resolutions: ['view', 'create', 'edit', 'approve', 'export'],
      policies: ['view', 'create', 'edit', 'approve', 'export'],
      announcements: ['view', 'create', 'edit', 'export'],
      reporting: ['view'],
    },
  },
  {
    id: 'read_only_auditor',
    name: 'Auditor (View Only)',
    description: 'Inspection and export access across financial records, CRM, and HR without write or approval rights.',
    color: 'gray',
    permissions: MODULE_DEFINITIONS.reduce((acc, mod) => {
      const actions: RoleAction[] = [];
      if (mod.availableActions.includes('view')) actions.push('view');
      if (mod.availableActions.includes('export')) actions.push('export');
      acc[mod.key] = actions;
      return acc;
    }, {} as RolePermissionsMap),
  },
  {
    id: 'employee_portal',
    name: 'Employee Self-Service',
    description: 'Standard employee portal access for viewing personal profile, marking attendance, and leave requests.',
    color: 'teal',
    permissions: {
      dashboard: ['view'],
      leave: ['view', 'create'],
      attendance: ['view', 'create'],
      policies: ['view'],
      announcements: ['view'],
    },
  },
];
