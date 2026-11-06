import { supabase } from '../config/supabase';

// ==================== TYPES ====================

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  expense_number: string;
  category_id: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  title: string;
  description: string | null;
  expense_date: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  // Multi-currency fields
  original_currency_code: string;
  original_amount: number | null;
  exchange_rate: number;
  exchange_rate_date: string | null;
  inr_amount: number | null;
  inr_tax_amount: number | null;
  inr_total_amount: number | null;
  is_currency_locked: boolean;
  // Payment fields
  payment_method: 'cash' | 'bank_transfer' | 'upi' | 'credit_card' | 'debit_card' | 'cheque' | 'other' | null;
  payment_status: 'pending' | 'paid' | 'partially_paid' | 'cancelled';
  payment_date: string | null;
  payment_reference: string | null;
  invoice_number: string | null;
  receipt_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  claimed_by: string | null;
  is_reimbursable: boolean;
  reimbursement_date: string | null;
  notes: string | null;
  tags: string[] | null;
  company_settings_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  expense_categories?: ExpenseCategory;
  vendors?: Vendor;
}

export interface CreateExpenseData {
  category_id?: string;
  vendor_id?: string;
  vendor_name?: string;
  title: string;
  description?: string;
  expense_date: string;
  amount: number;
  tax_amount?: number;
  currency?: string;
  // Multi-currency fields
  original_currency_code?: string;
  original_amount?: number;
  exchange_rate?: number;
  exchange_rate_date?: string;
  inr_amount?: number;
  inr_tax_amount?: number;
  inr_total_amount?: number;
  // Payment fields
  payment_method?: Expense['payment_method'];
  payment_status?: Expense['payment_status'];
  payment_date?: string;
  payment_reference?: string;
  invoice_number?: string;
  receipt_url?: string;
  status?: Expense['status'];
  is_reimbursable?: boolean;
  notes?: string;
  tags?: string[];
  company_settings_id?: string | null;
  created_by?: string;
}

export interface CreateVendorData {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  is_active?: boolean;
  notes?: string;
}

export interface ExpenseStats {
  totalExpenses: number;
  totalAmount: number;
  pendingApproval: number;
  pendingPayment: number;
  paidThisMonth: number;
  byCategory: { category: string; amount: number; count: number }[];
}

// ==================== SERVICE ====================

export const expenseService = {
  // ==================== CATEGORIES ====================

  async getCategories(): Promise<ExpenseCategory[]> {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createCategory(name: string, description?: string): Promise<ExpenseCategory> {
    const { data, error } = await supabase
      .from('expense_categories')
      .insert({ name, description })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCategory(id: string, updates: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    const { data, error } = await supabase
      .from('expense_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('expense_categories')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  // ==================== VENDORS ====================

  async getVendors(activeOnly: boolean = true): Promise<Vendor[]> {
    let query = supabase
      .from('vendors')
      .select('*')
      .order('name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getVendorById(id: string): Promise<Vendor | null> {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createVendor(vendorData: CreateVendorData): Promise<Vendor> {
    const { data, error } = await supabase
      .from('vendors')
      .insert(vendorData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateVendor(id: string, updates: Partial<CreateVendorData>): Promise<Vendor> {
    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteVendor(id: string): Promise<void> {
    const { error } = await supabase
      .from('vendors')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  // ==================== EXPENSES ====================

  async getExpenses(
    filters?: {
      status?: string;
      paymentStatus?: string;
      categoryId?: string;
      vendorId?: string;
      startDate?: string;
      endDate?: string;
      company_settings_id?: string;
      search?: string;
    },
    page: number = 1,
    perPage: number = 20
  ): Promise<PaginatedResponse<Expense>> {
    let query = supabase
      .from('expenses')
      .select(`
        *,
        expense_categories (id, name),
        vendors (id, name)
      `, { count: 'exact' })
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
    if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters?.vendorId) query = query.eq('vendor_id', filters.vendorId);
    if (filters?.startDate) query = query.gte('expense_date', filters.startDate);
    if (filters?.endDate) query = query.lte('expense_date', filters.endDate);
    if (filters?.search?.trim()) {
      const term = filters.search.trim();
      query = query.or(`expense_number.ilike.%${term}%,title.ilike.%${term}%,vendor_name.ilike.%${term}%,description.ilike.%${term}%`);
    }
    if (filters?.company_settings_id) {
      const { data: companies } = await supabase
        .from('company_settings')
        .select('id, is_default, country_code')
        .eq('is_active', true);
      const indianCompany = companies?.find(c => c.is_default || c.country_code === 'IN');
      if (indianCompany && filters.company_settings_id === indianCompany.id) {
        query = query.or(`company_settings_id.eq.${filters.company_settings_id},company_settings_id.is.null`);
      } else {
        query = query.eq('company_settings_id', filters.company_settings_id);
      }
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    
    return {
      data: data || [],
      count: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage)
    };
  },

  async getExpenseById(id: string): Promise<Expense | null> {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        expense_categories (id, name),
        vendors (id, name)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createExpense(expenseData: CreateExpenseData): Promise<Expense> {
    let companySettingsId = expenseData.company_settings_id;
    if (!companySettingsId) {
      const { data: companies } = await supabase
        .from('company_settings')
        .select('id, is_default, country_code')
        .eq('is_active', true);
      const indianCompany = companies?.find(c => c.is_default || c.country_code === 'IN');
      if (indianCompany) {
        companySettingsId = indianCompany.id;
      }
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...expenseData, company_settings_id: companySettingsId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateExpense(id: string, updates: Partial<CreateExpenseData>): Promise<Expense> {
    // Remove computed columns
    const { total_amount, expense_categories, vendors, created_at, updated_at, id: _id, expense_number, ...updateData } = updates as any;

    const { data, error } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async approveExpense(id: string): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  },

  async rejectExpense(id: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'rejected',
        rejection_reason: reason
      })
      .eq('id', id);

    if (error) throw error;
  },

  async markExpensePaid(id: string, paymentDate: string, paymentReference?: string): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .update({
        payment_status: 'paid',
        payment_date: paymentDate,
        payment_reference: paymentReference
      })
      .eq('id', id);

    if (error) throw error;
  },

  async getExpenseStats(startDate?: string, endDate?: string, companySettingsId?: string): Promise<ExpenseStats> {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    // Get all expenses
    let query = supabase.from('expenses').select('*, expense_categories(name)');
    if (startDate) query = query.gte('expense_date', startDate);
    if (endDate) query = query.lte('expense_date', endDate);

    let isIndianCompany = true;
    if (companySettingsId) {
      const { data: companies } = await supabase
        .from('company_settings')
        .select('id, is_default, country_code')
        .eq('is_active', true);
      const indianCompany = companies?.find(c => c.is_default || c.country_code === 'IN');
      const targetCompany = companies?.find(c => c.id === companySettingsId);
      if (targetCompany) {
        isIndianCompany = targetCompany.is_default || targetCompany.country_code === 'IN';
      }
      if (indianCompany && companySettingsId === indianCompany.id) {
        query = query.or(`company_settings_id.eq.${companySettingsId},company_settings_id.is.null`);
      } else {
        query = query.eq('company_settings_id', companySettingsId);
      }
    }

    const { data: expenses, error } = await query;
    if (error) throw error;

    const allExpenses = expenses || [];

    const getExpenseTotal = (e: Expense) => {
      if (isIndianCompany) {
        return e.inr_total_amount ?? ((e.total_amount || ((e.amount || 0) + (e.tax_amount || 0))) * (e.exchange_rate || 1));
      }
      return e.total_amount || ((e.amount || 0) + (e.tax_amount || 0));
    };

    // Calculate stats
    const totalExpenses = allExpenses.length;
    const totalAmount = allExpenses.reduce((sum, e) => sum + getExpenseTotal(e), 0);
    const pendingApproval = allExpenses.filter(e => e.status === 'pending').length;
    const pendingPayment = allExpenses.filter(e => e.status === 'approved' && e.payment_status === 'pending').length;

    // Paid this month
    const paidThisMonth = allExpenses
      .filter(e => e.payment_status === 'paid' && e.payment_date && e.payment_date >= monthStart && e.payment_date <= monthEnd)
      .reduce((sum, e) => sum + getExpenseTotal(e), 0);

    // By category
    const categoryMap = new Map<string, { amount: number; count: number }>();
    allExpenses.forEach(e => {
      const cat = e.expense_categories?.name || 'Uncategorized';
      const existing = categoryMap.get(cat) || { amount: 0, count: 0 };
      categoryMap.set(cat, {
        amount: existing.amount + getExpenseTotal(e),
        count: existing.count + 1
      });
    });

    const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data
    })).sort((a, b) => b.amount - a.amount);

    return {
      totalExpenses,
      totalAmount,
      pendingApproval,
      pendingPayment,
      paidThisMonth,
      byCategory
    };
  }
};
