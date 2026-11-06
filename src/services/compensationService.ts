import { supabase } from '../config/supabase';

// Types
export interface EmployeeCompensation {
  id: string;
  employee_id: string;
  basic_salary: number;
  hra: number;
  da: number;
  special_allowance: number;
  transport_allowance: number;
  medical_allowance: number;
  other_allowances: number;
  pf_contribution: number;
  esi_contribution: number;
  professional_tax: number;
  tds: number;
  other_deductions: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  effective_from: string;
  effective_to: string | null;
  is_current: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    employee_number: string;
    designation: string;
    department: string;
  };
}

export interface SalaryIncrement {
  id: string;
  employee_id: string;
  increment_type: 'annual_increment' | 'promotion' | 'performance_based' | 'market_adjustment' | 'role_change' | 'special_increment' | 'correction' | 'other';
  previous_basic: number;
  new_basic: number;
  previous_gross: number | null;
  new_gross: number | null;
  increment_amount: number;
  increment_percentage: number | null;
  effective_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  compensation_id: string | null;
  reason: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    employee_number: string;
    designation: string;
    department: string;
  };
}

export interface EmployeeBonus {
  id: string;
  employee_id: string;
  bonus_type: 'performance_bonus' | 'annual_bonus' | 'festival_bonus' | 'referral_bonus' | 'project_bonus' | 'retention_bonus' | 'signing_bonus' | 'spot_award' | 'other';
  bonus_name: string;
  amount: number;
  bonus_period_start: string | null;
  bonus_period_end: string | null;
  payment_date: string | null;
  payment_status: 'pending' | 'approved' | 'paid' | 'cancelled';
  is_taxable: boolean;
  tax_amount: number;
  net_amount: number;
  approved_by: string | null;
  approved_at: string | null;
  reason: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    employee_number: string;
    designation: string;
    department: string;
  };
}

export interface CreateCompensationData {
  employee_id: string;
  basic_salary: number;
  hra?: number;
  da?: number;
  special_allowance?: number;
  transport_allowance?: number;
  medical_allowance?: number;
  other_allowances?: number;
  pf_contribution?: number;
  esi_contribution?: number;
  professional_tax?: number;
  tds?: number;
  other_deductions?: number;
  effective_from: string;
  is_current?: boolean;
  notes?: string;
  created_by?: string;
}

export interface CreateIncrementData {
  employee_id: string;
  increment_type: SalaryIncrement['increment_type'];
  previous_basic: number;
  new_basic: number;
  previous_gross?: number;
  new_gross?: number;
  increment_percentage?: number;
  effective_date: string;
  status?: SalaryIncrement['status'];
  reason?: string;
  remarks?: string;
  created_by?: string;
}

export interface CreateBonusData {
  employee_id: string;
  bonus_type: EmployeeBonus['bonus_type'];
  bonus_name: string;
  amount: number;
  bonus_period_start?: string;
  bonus_period_end?: string;
  payment_date?: string;
  payment_status?: EmployeeBonus['payment_status'];
  is_taxable?: boolean;
  tax_amount?: number;
  reason?: string;
  remarks?: string;
  created_by?: string;
}

export const compensationService = {
  // ==================== COMPENSATION ====================
  
  // Get all compensation records with optional filters
  async getCompensations(employeeId?: string, currentOnly: boolean = false): Promise<EmployeeCompensation[]> {
    let query = supabase
      .from('employee_compensation')
      .select(`
        *,
        employees:employee_id (
          id, first_name, last_name, full_name, employee_number, designation, department
        )
      `)
      .order('effective_from', { ascending: false });

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    if (currentOnly) {
      query = query.eq('is_current', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get current compensation for an employee
  async getCurrentCompensation(employeeId: string): Promise<EmployeeCompensation | null> {
    const { data, error } = await supabase
      .from('employee_compensation')
      .select(`
        *,
        employees:employee_id (
          id, first_name, last_name, full_name, employee_number, designation, department
        )
      `)
      .eq('employee_id', employeeId)
      .eq('is_current', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Get compensation history for an employee
  async getCompensationHistory(employeeId: string): Promise<EmployeeCompensation[]> {
    const { data, error } = await supabase
      .from('employee_compensation')
      .select('*')
      .eq('employee_id', employeeId)
      .order('effective_from', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Create new compensation record
  async createCompensation(data: CreateCompensationData): Promise<EmployeeCompensation> {
    const { data: result, error } = await supabase
      .from('employee_compensation')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  // Update compensation record
  async updateCompensation(id: string, data: Partial<CreateCompensationData>): Promise<EmployeeCompensation> {
    // Remove generated/computed columns that PostgreSQL won't allow updating
    const { 
      gross_salary, 
      total_deductions, 
      net_salary, 
      employees,
      created_at,
      updated_at,
      id: _id,
      ...updateData 
    } = data as any;

    const { data: result, error } = await supabase
      .from('employee_compensation')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  // Delete compensation record
  async deleteCompensation(id: string): Promise<void> {
    const { error } = await supabase
      .from('employee_compensation')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // ==================== INCREMENTS ====================

  // Get all increments with optional filters
  async getIncrements(employeeId?: string, status?: string): Promise<SalaryIncrement[]> {
    let query = supabase
      .from('salary_increments')
      .select(`
        *,
        employees:employee_id (
          id, first_name, last_name, full_name, employee_number, designation, department
        )
      `)
      .order('effective_date', { ascending: false });

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get increment by ID
  async getIncrementById(id: string): Promise<SalaryIncrement | null> {
    const { data, error } = await supabase
      .from('salary_increments')
      .select(`
        *,
        employees:employee_id (
          id, first_name, last_name, full_name, employee_number, designation, department
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create increment
  async createIncrement(data: CreateIncrementData): Promise<SalaryIncrement> {
    const incrementPercentage = data.increment_percentage || 
      ((data.new_basic - data.previous_basic) / data.previous_basic * 100);

    const { data: result, error } = await supabase
      .from('salary_increments')
      .insert({
        ...data,
        increment_percentage: Math.round(incrementPercentage * 100) / 100
      })
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  // Update increment
  async updateIncrement(id: string, data: Partial<CreateIncrementData>): Promise<SalaryIncrement> {
    // Remove generated/computed columns that PostgreSQL won't allow updating
    const { 
      increment_amount, 
      employees,
      created_at,
      updated_at,
      id: _id,
      ...updateData 
    } = data as any;

    const { data: result, error } = await supabase
      .from('salary_increments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  // Approve increment and apply new compensation
  async approveIncrement(id: string, newCompensationData: CreateCompensationData): Promise<void> {
    // Create new compensation record
    const compensation = await this.createCompensation(newCompensationData);

    // Update increment status
    const { error } = await supabase
      .from('salary_increments')
      .update({
        status: 'applied',
        approved_at: new Date().toISOString(),
        compensation_id: compensation.id
      })
      .eq('id', id);

    if (error) throw error;
  },

  // Reject increment
  async rejectIncrement(id: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('salary_increments')
      .update({
        status: 'rejected',
        rejection_reason: reason
      })
      .eq('id', id);

    if (error) throw error;
  },

  // Delete increment
  async deleteIncrement(id: string): Promise<void> {
    const { error } = await supabase
      .from('salary_increments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // ==================== BONUSES ====================

  // Get all bonuses with optional filters
  async getBonuses(employeeId?: string, status?: string, year?: number): Promise<EmployeeBonus[]> {
    let query = supabase
      .from('employee_bonuses')
      .select(`
        *,
        employees:employee_id (
          id, first_name, last_name, full_name, employee_number, designation, department
        )
      `)
      .order('created_at', { ascending: false });

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    if (status) {
      query = query.eq('payment_status', status);
    }
    if (year) {
      query = query.gte('created_at', `${year}-01-01`).lte('created_at', `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get bonus by ID
  async getBonusById(id: string): Promise<EmployeeBonus | null> {
    const { data, error } = await supabase
      .from('employee_bonuses')
      .select(`
        *,
        employees:employee_id (
          id, first_name, last_name, full_name, employee_number, designation, department
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create bonus
  async createBonus(data: CreateBonusData): Promise<EmployeeBonus> {
    const { data: result, error } = await supabase
      .from('employee_bonuses')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  // Update bonus
  async updateBonus(id: string, data: Partial<CreateBonusData>): Promise<EmployeeBonus> {
    // Remove generated/computed columns that PostgreSQL won't allow updating
    const { 
      net_amount, 
      employees,
      created_at,
      updated_at,
      id: _id,
      ...updateData 
    } = data as any;

    const { data: result, error } = await supabase
      .from('employee_bonuses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  // Approve bonus
  async approveBonus(id: string): Promise<void> {
    const { error } = await supabase
      .from('employee_bonuses')
      .update({
        payment_status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  },

  // Mark bonus as paid
  async markBonusPaid(id: string, paymentDate: string): Promise<void> {
    const { error } = await supabase
      .from('employee_bonuses')
      .update({
        payment_status: 'paid',
        payment_date: paymentDate
      })
      .eq('id', id);

    if (error) throw error;
  },

  // Cancel bonus
  async cancelBonus(id: string): Promise<void> {
    const { error } = await supabase
      .from('employee_bonuses')
      .update({ payment_status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;
  },

  // Delete bonus
  async deleteBonus(id: string): Promise<void> {
    const { error } = await supabase
      .from('employee_bonuses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // ==================== STATS & REPORTS ====================

  // Get compensation summary for an employee
  async getEmployeeCompensationSummary(employeeId: string) {
    const [compensation, increments, bonuses] = await Promise.all([
      this.getCurrentCompensation(employeeId),
      this.getIncrements(employeeId),
      this.getBonuses(employeeId)
    ]);

    const totalBonusesPaid = bonuses
      .filter(b => b.payment_status === 'paid')
      .reduce((sum, b) => sum + b.net_amount, 0);

    const totalIncrements = increments
      .filter(i => i.status === 'applied')
      .length;

    const latestIncrement = increments.find(i => i.status === 'applied');

    return {
      currentCompensation: compensation,
      totalBonusesPaid,
      totalBonusesThisYear: bonuses.filter(b => {
        const year = new Date().getFullYear();
        return b.payment_status === 'paid' && new Date(b.payment_date || b.created_at).getFullYear() === year;
      }).reduce((sum, b) => sum + b.net_amount, 0),
      totalIncrements,
      latestIncrement,
      pendingBonuses: bonuses.filter(b => b.payment_status === 'pending' || b.payment_status === 'approved').length
    };
  }
};
