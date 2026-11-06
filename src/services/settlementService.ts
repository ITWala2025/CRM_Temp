// Full & Final Settlement Service
import { supabase } from '../config/supabase';
import type {
  FullFinalSettlement,
  CreateSettlementInput,
  Employee
} from '../types/employee';

/**
 * Calculate gratuity amount based on Indian Gratuity Act
 * Gratuity = (Last drawn salary × Years of service × 15) / 26
 * Eligible after 5 years of continuous service
 */
function calculateGratuity(
  basicSalary: number,
  dateOfJoining: string,
  dateOfLeaving: string
): number {
  const joiningDate = new Date(dateOfJoining);
  const leavingDate = new Date(dateOfLeaving);

  const yearsOfService = (leavingDate.getTime() - joiningDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  // Gratuity is payable only after 5 years of service
  if (yearsOfService < 5) {
    return 0;
  }

  // Calculate gratuity: (Basic Salary * Years * 15) / 26
  const gratuity = (basicSalary * Math.floor(yearsOfService) * 15) / 26;

  // Maximum gratuity limit is ₹20,00,000 as per law
  return Math.min(gratuity, 2000000);
}

/**
 * Calculate pending salary for partial month
 */
function calculatePendingSalary(
  dailySalary: number,
  lastWorkingDay: string,
  settlementMonth: number,
  settlementYear: number
): { days: number; amount: number } {
  const lastDay = new Date(lastWorkingDay);
  const daysInMonth = new Date(settlementYear, settlementMonth, 0).getDate();
  const dayOfMonth = lastDay.getDate();

  // Calculate working days from 1st to last working day
  const pendingDays = dayOfMonth;
  const pendingAmount = dailySalary * pendingDays;

  return { days: pendingDays, amount: pendingAmount };
}

/**
 * Calculate notice period recovery
 */
function calculateNoticePeriodRecovery(
  dailySalary: number,
  noticePeriodDays: number,
  noticePeriodServed: number
): { shortfall: number; recovery: number } {
  const shortfall = Math.max(0, noticePeriodDays - noticePeriodServed);
  const recovery = dailySalary * shortfall;

  return { shortfall, recovery };
}

class SettlementService {
  /**
   * Get all full & final settlements
   */
  async getSettlements(): Promise<FullFinalSettlement[]> {
    const { data, error } = await supabase
      .from('full_final_settlements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching settlements:', error);
      throw new Error('Failed to fetch settlements');
    }

    return data || [];
  }

  /**
   * Get settlement by ID
   */
  async getSettlementById(id: string): Promise<FullFinalSettlement | null> {
    const { data, error } = await supabase
      .from('full_final_settlements')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching settlement:', error);
      return null;
    }

    return data;
  }

  /**
   * Get settlements by employee ID
   */
  async getSettlementsByEmployee(employeeId: string): Promise<FullFinalSettlement[]> {
    const { data, error } = await supabase
      .from('full_final_settlements')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching employee settlements:', error);
      throw new Error('Failed to fetch employee settlements');
    }

    return data || [];
  }

  /**
   * Preview settlement calculation without saving to database
   */
  async previewSettlement(input: CreateSettlementInput): Promise<Omit<FullFinalSettlement, 'id' | 'created_at' | 'updated_at'>> {
    // Fetch employee details
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', input.employee_id)
      .single();

    if (empError || !employee) {
      throw new Error('Employee not found');
    }

    // Fetch leave balance
    const lastWorkingDate = new Date(input.last_working_day);
    const financialYear = this.getFinancialYear(lastWorkingDate);

    const { data: leaveBalance } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', input.employee_id)
      .eq('financial_year', financialYear)
      .single();

    const earnedLeaveBalance = leaveBalance?.earned_leave_balance || 0;

    // Calculate settlement components
    const grossMonthlySalary = employee.gross_salary || 0;
    const dailySalary = grossMonthlySalary / 30;

    const settlementMonth = lastWorkingDate.getMonth() + 1;
    const settlementYear = lastWorkingDate.getFullYear();

    // 1. Pending Salary
    const pendingSalary = calculatePendingSalary(
      dailySalary,
      input.last_working_day,
      settlementMonth,
      settlementYear
    );

    // 2. Leave Encashment (per day salary * leave balance)
    const leaveEncashment = dailySalary * earnedLeaveBalance;

    // 3. Gratuity
    const gratuity = input.gratuity_amount !== undefined
      ? input.gratuity_amount
      : calculateGratuity(
          employee.basic_salary,
          employee.date_of_joining,
          input.date_of_leaving
        );

    // 4. Notice Period Recovery
    const noticePeriod = calculateNoticePeriodRecovery(
      dailySalary,
      input.notice_period_days,
      input.notice_period_served
    );

    // Calculate totals
    const totalDues =
      pendingSalary.amount +
      leaveEncashment +
      (input.bonus_amount || 0) +
      (input.incentive_amount || 0) +
      gratuity +
      (input.other_dues || 0);

    const totalRecoveries =
      (input.advance_recovery || 0) +
      (input.loan_recovery || 0) +
      noticePeriod.recovery +
      (input.asset_recovery || 0) +
      (input.other_recoveries || 0);

    const grossSettlement = totalDues - totalRecoveries;

    // Simple TDS calculation (assuming 10% if gross > 50000)
    const taxDeduction = grossSettlement > 50000 ? grossSettlement * 0.10 : 0;

    const netSettlement = grossSettlement - taxDeduction;

    // Return preview settlement (without saving)
    return {
      employee_id: input.employee_id,
      employee_number: employee.employee_number,
      employee_name: employee.full_name,
      designation: employee.designation,
      department: employee.department,
      date_of_joining: employee.date_of_joining,
      date_of_leaving: input.date_of_leaving,
      relieving_date: input.relieving_date,
      reason_for_leaving: input.reason_for_leaving,

      settlement_month: settlementMonth,
      settlement_year: settlementYear,
      last_working_day: input.last_working_day,
      notice_period_days: input.notice_period_days,
      notice_period_served: input.notice_period_served,
      notice_period_shortfall: noticePeriod.shortfall,

      pending_salary_days: pendingSalary.days,
      pending_salary_amount: pendingSalary.amount,
      earned_leave_days: earnedLeaveBalance,
      earned_leave_encashment: leaveEncashment,
      bonus_amount: input.bonus_amount || 0,
      incentive_amount: input.incentive_amount || 0,
      gratuity_amount: gratuity,
      notice_pay_recovery: noticePeriod.recovery,
      other_dues: input.other_dues || 0,
      total_dues: totalDues,

      advance_recovery: input.advance_recovery || 0,
      loan_recovery: input.loan_recovery || 0,
      notice_period_recovery: noticePeriod.recovery,
      asset_recovery: input.asset_recovery || 0,
      other_recoveries: input.other_recoveries || 0,
      total_recoveries: totalRecoveries,

      gross_settlement: grossSettlement,
      tax_deduction: taxDeduction,
      net_settlement: netSettlement,

      assets_returned: input.assets_returned || false,
      asset_clearance_remarks: input.asset_clearance_remarks,
      no_dues_certificate_issued: false,

      status: 'draft',
      remarks: input.remarks
    };
  }

  /**
   * Create a new full & final settlement with automatic calculations
   */
  async createSettlement(
    input: CreateSettlementInput,
    userId?: string
  ): Promise<FullFinalSettlement> {
    // Fetch employee details
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', input.employee_id)
      .single();

    if (empError || !employee) {
      throw new Error('Employee not found');
    }

    // Fetch leave balance
    const lastWorkingDate = new Date(input.last_working_day);
    const financialYear = this.getFinancialYear(lastWorkingDate);

    const { data: leaveBalance } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', input.employee_id)
      .eq('financial_year', financialYear)
      .single();

    const earnedLeaveBalance = leaveBalance?.earned_leave_balance || 0;

    // Calculate settlement components
    const grossMonthlySalary = employee.gross_salary || 0;
    const dailySalary = grossMonthlySalary / 30;

    const settlementMonth = lastWorkingDate.getMonth() + 1;
    const settlementYear = lastWorkingDate.getFullYear();

    // 1. Pending Salary
    const pendingSalary = calculatePendingSalary(
      dailySalary,
      input.last_working_day,
      settlementMonth,
      settlementYear
    );

    // 2. Leave Encashment (per day salary * leave balance)
    const leaveEncashment = dailySalary * earnedLeaveBalance;

    // 3. Gratuity
    const gratuity = input.gratuity_amount !== undefined
      ? input.gratuity_amount
      : calculateGratuity(
          employee.basic_salary,
          employee.date_of_joining,
          input.date_of_leaving
        );

    // 4. Notice Period Recovery
    const noticePeriod = calculateNoticePeriodRecovery(
      dailySalary,
      input.notice_period_days,
      input.notice_period_served
    );

    // Calculate totals
    const totalDues =
      pendingSalary.amount +
      leaveEncashment +
      (input.bonus_amount || 0) +
      (input.incentive_amount || 0) +
      gratuity +
      (input.other_dues || 0);

    const totalRecoveries =
      (input.advance_recovery || 0) +
      (input.loan_recovery || 0) +
      noticePeriod.recovery +
      (input.asset_recovery || 0) +
      (input.other_recoveries || 0);

    const grossSettlement = totalDues - totalRecoveries;

    // Simple TDS calculation (assuming 10% if gross > 50000)
    const taxDeduction = grossSettlement > 50000 ? grossSettlement * 0.10 : 0;

    const netSettlement = grossSettlement - taxDeduction;

    // Prepare settlement record
    const settlement: Omit<FullFinalSettlement, 'id' | 'created_at' | 'updated_at'> = {
      employee_id: input.employee_id,
      employee_number: employee.employee_number,
      employee_name: employee.full_name,
      designation: employee.designation,
      department: employee.department,
      date_of_joining: employee.date_of_joining,
      date_of_leaving: input.date_of_leaving,
      relieving_date: input.relieving_date,
      reason_for_leaving: input.reason_for_leaving,

      settlement_month: settlementMonth,
      settlement_year: settlementYear,
      last_working_day: input.last_working_day,
      notice_period_days: input.notice_period_days,
      notice_period_served: input.notice_period_served,
      notice_period_shortfall: noticePeriod.shortfall,

      pending_salary_days: pendingSalary.days,
      pending_salary_amount: pendingSalary.amount,
      earned_leave_days: earnedLeaveBalance,
      earned_leave_encashment: leaveEncashment,
      bonus_amount: input.bonus_amount || 0,
      incentive_amount: input.incentive_amount || 0,
      gratuity_amount: gratuity,
      notice_pay_recovery: noticePeriod.recovery,
      other_dues: input.other_dues || 0,
      total_dues: totalDues,

      advance_recovery: input.advance_recovery || 0,
      loan_recovery: input.loan_recovery || 0,
      notice_period_recovery: noticePeriod.recovery,
      asset_recovery: input.asset_recovery || 0,
      other_recoveries: input.other_recoveries || 0,
      total_recoveries: totalRecoveries,

      gross_settlement: grossSettlement,
      tax_deduction: taxDeduction,
      net_settlement: netSettlement,

      assets_returned: input.assets_returned || false,
      asset_clearance_remarks: input.asset_clearance_remarks,
      no_dues_certificate_issued: false,

      status: 'draft',
      prepared_by: userId,
      remarks: input.remarks
    };

    const { data, error } = await supabase
      .from('full_final_settlements')
      .insert([settlement])
      .select()
      .single();

    if (error) {
      console.error('Error creating settlement:', error);
      throw new Error('Failed to create settlement');
    }

    return data;
  }

  /**
   * Update settlement
   */
  async updateSettlement(
    id: string,
    updates: Partial<FullFinalSettlement>
  ): Promise<FullFinalSettlement> {
    const { data, error } = await supabase
      .from('full_final_settlements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating settlement:', error);
      throw new Error('Failed to update settlement');
    }

    return data;
  }

  /**
   * Approve settlement
   */
  async approveSettlement(id: string, userId?: string): Promise<FullFinalSettlement> {
    return this.updateSettlement(id, {
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString()
    });
  }

  /**
   * Mark settlement as paid
   */
  async markAsPaid(
    id: string,
    paymentMode: string,
    paymentReference: string,
    paymentDate: string
  ): Promise<FullFinalSettlement> {
    return this.updateSettlement(id, {
      status: 'paid',
      payment_mode: paymentMode,
      payment_reference: paymentReference,
      payment_date: paymentDate
    });
  }

  /**
   * Delete settlement
   */
  async deleteSettlement(id: string): Promise<void> {
    const { error } = await supabase
      .from('full_final_settlements')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting settlement:', error);
      throw new Error('Failed to delete settlement');
    }
  }

  /**
   * Get financial year for a date
   */
  private getFinancialYear(date: Date): string {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    if (month >= 4) {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  /**
   * Get settlement statistics
   */
  async getSettlementStats(): Promise<any> {
    const { data, error } = await supabase
      .from('settlement_stats_view')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching settlement stats:', error);
      return null;
    }

    return data;
  }
}

export const settlementService = new SettlementService();
