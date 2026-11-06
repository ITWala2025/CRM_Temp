/**
 * Salary Slip Service - Handles salary generation and management
 */

import { supabase } from '../config/supabase';
import type { SalarySlip, SalaryStructure, AttendanceSummary } from '../types/employee';
import { attendanceService } from './attendanceService';

export const salaryService = {
  /**
   * Get salary structure for employee
   */
  async getSalaryStructure(employeeId: string, date?: string): Promise<SalaryStructure | null> {
    try {
      const queryDate = date || new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('salary_structures')
        .select('*')
        .eq('employee_id', employeeId)
        .lte('effective_from', queryDate)
        .or('effective_to.is.null,effective_to.gte.' + queryDate)
        .order('effective_from', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code === 'PGRST116') return null; // No rows returned
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching salary structure:', error);
      return null;
    }
  },

  /**
   * Generate salary slip for a month
   */
  async generateSalarySlip(
    employeeId: string,
    month: number,
    year: number,
    generatedBy: string
  ): Promise<SalarySlip | null> {
    try {
      // Get employee details
      const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (!employee) throw new Error('Employee not found');

      // Get salary structure
      const structure = await this.getSalaryStructure(employeeId);
      if (!structure) throw new Error('Salary structure not found');

      // Get attendance summary
      const attendance = await attendanceService.getMonthlyAttendanceSummary(employeeId, month, year);
      if (!attendance) throw new Error('Could not fetch attendance data');

      // Get holidays for the month
      const holidays = await this.getMonthlyHolidays(month, year);
      const holidayCount = holidays?.length || 0;

      // Calculate working days
      const totalCalendarDays = new Date(year, month, 0).getDate();
      const weekendDays = Math.ceil(totalCalendarDays / 7) * 2; // Assuming 5-day week
      let totalWorkingDays = totalCalendarDays - weekendDays - holidayCount;

      // Calculate earnings
      const baseSalary = structure.base_salary;
      const hra = baseSalary * (structure.hra_percentage / 100);
      const da = baseSalary * (structure.dearness_allowance_percentage / 100);
      const otherAllowances = structure.other_allowances || 0;

      const grossSalary = baseSalary + hra + da + otherAllowances;

      // Prorate salary based on attendance
      const presentDays = attendance?.present_days ?? attendance?.days_present ?? 0;
      const halfDays = attendance?.half_days ?? attendance?.days_half_day ?? 0;
      const attendanceWorkingDays = attendance?.total_days ?? attendance?.total_working_days ?? 22; // Default working days
      // Use either attendance working days or calculated working days (prefer attendance)
      if (attendanceWorkingDays && attendanceWorkingDays !== 22) {
        totalWorkingDays = attendanceWorkingDays;
      }
      const attendanceRatio = Math.min(presentDays + (halfDays * 0.5), totalWorkingDays) / totalWorkingDays;
      const proratedGrossSalary = grossSalary * attendanceRatio;

      // Calculate deductions
      const pf = baseSalary * (structure.pf_percentage / 100);
      const esi = baseSalary * (structure.esi_percentage / 100);
      const incomeTax = calculateIncomeTax(proratedGrossSalary); // Simplified calculation
      const otherDeductions = 0;

      const totalDeductions = pf + esi + incomeTax + otherDeductions;
      const netSalary = proratedGrossSalary - totalDeductions;

      // Create salary slip record
      const { data, error } = await supabase
        .from('salary_slips')
        .upsert({
          employee_id: employeeId,
          salary_month: month,
          salary_year: year,
          working_days: totalWorkingDays,
          paid_days: Math.round(presentDays + (halfDays * 0.5)),
          lop_days: (attendance?.absent_days ?? 0),
          leaves_taken: attendance?.leaves ?? 0,
          basic_salary: baseSalary,
          hra,
          dearness_allowance: da,
          other_allowances: otherAllowances,
          gross_salary: grossSalary,
          provident_fund: pf,
          esic: esi,
          tds: incomeTax,
          other_deductions: otherDeductions,
          total_deductions: totalDeductions,
          net_salary: netSalary,
          generated_by: generatedBy,
          generated_at: new Date().toISOString(),
        }, { onConflict: 'employee_id,month,year' })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error generating salary slip:', error);
      return null;
    }
  },

  /**
   * Get salary slip
   */
  async getSalarySLip(employeeId: string, month: number, year: number): Promise<SalarySlip | null> {
    try {
      const { data, error } = await supabase
        .from('salary_slips')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('month', month)
        .eq('year', year)
        .single();

      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching salary slip:', error);
      return null;
    }
  },

  /**
   * Get employee salary slips
   */
  async getEmployeeSalarySlips(
    employeeId: string,
    limit = 12,
    offset = 0
  ): Promise<{ slips: SalarySlip[], total: number } | null> {
    try {
      const { data, count, error } = await supabase
        .from('salary_slips')
        .select('*', { count: 'exact' })
        .eq('employee_id', employeeId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        slips: data || [],
        total: count || 0,
      };
    } catch (error) {
      console.error('Error fetching salary slips:', error);
      return null;
    }
  },

  /**
   * Generate salary slips for all employees for a month (Admin)
   */
  async generateMonthSalarySlips(
    month: number,
    year: number,
    generatedBy: string
  ): Promise<{ success: number, failed: number, errors: string[] }> {
    try {
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('employment_status', 'active');

      if (empError) throw empError;

      const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] };

      for (const emp of employees || []) {
        try {
          const slip = await this.generateSalarySlip(emp.id, month, year, generatedBy);
          if (slip) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push(`Failed to generate slip for employee ${emp.id}`);
          }
        } catch (err) {
          results.failed++;
          results.errors.push(`Error for employee ${emp.id}: ${(err as Error).message}`);
        }
      }

      return results;
    } catch (error) {
      console.error('Error generating salary slips for month:', error);
      return { success: 0, failed: 0, errors: [(error as Error).message] };
    }
  },

  /**
   * Get monthly holidays
   */
  async getMonthlyHolidays(month: number, year: number): Promise<any[] | null> {
    try {
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('company_holidays')
        .select('*')
        .gte('holiday_date', firstDay)
        .lte('holiday_date', lastDay)
        .eq('is_mandatory', true);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching monthly holidays:', error);
      return null;
    }
  },

  /**
   * Update salary structure
   */
  async updateSalaryStructure(
    employeeId: string,
    structure: Omit<SalaryStructure, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SalaryStructure | null> {
    try {
      // End previous structure
      const { data: previous } = await supabase
        .from('salary_structures')
        .select('id')
        .eq('employee_id', employeeId)
        .is('effective_to', null)
        .single();

      if (previous) {
        await supabase
          .from('salary_structures')
          .update({ effective_to: new Date().toISOString().split('T')[0] })
          .eq('id', previous.id);
      }

      // Create new structure
      const { data, error } = await supabase
        .from('salary_structures')
        .insert({
          ...structure,
          employee_id: employeeId,
          effective_from: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating salary structure:', error);
      return null;
    }
  },

  /**
   * Calculate salary summary for a period
   */
  async getSalarySummary(
    employeeId: string,
    fromMonth: number,
    fromYear: number,
    toMonth: number,
    toYear: number
  ): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('salary_slips')
        .select('*')
        .eq('employee_id', employeeId)
        .or(
          `and(year.eq.${fromYear},month.gte.${fromMonth}),` +
          `year.gt.${fromYear},year.lt.${toYear},` +
          `and(year.eq.${toYear},month.lte.${toMonth})`
        )
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (error) throw error;

      const slips = data || [];
      const summary = {
        total_gross_salary: 0,
        total_deductions: 0,
        total_net_salary: 0,
        avg_attendance: 0,
        slips_count: slips.length,
      };

      slips.forEach((slip: SalarySlip) => {
        summary.total_gross_salary += slip.gross_salary;
        summary.total_deductions += slip.total_deductions;
        summary.total_net_salary += slip.net_salary;
      });

      if (slips.length > 0) {
        summary.avg_attendance = slips.reduce((sum: number, slip: SalarySlip) => 
          sum + (slip.paid_days / slip.working_days * 100), 0
        ) / slips.length;
      }

      return summary;
    } catch (error) {
      console.error('Error calculating salary summary:', error);
      return null;
    }
  },
};

/**
 * Simple income tax calculation (India)
 * This is a simplified calculation - actual tax may vary based on tax slabs
 */
function calculateIncomeTax(monthlySalary: number): number {
  const annualSalary = monthlySalary * 12;
  
  // India FY 2024-25 tax brackets (simplified)
  let tax = 0;
  if (annualSalary > 1000000) {
    tax += (annualSalary - 1000000) * 0.30;
    tax += 250000 * 0.20;
    tax += 250000 * 0.05;
  } else if (annualSalary > 500000) {
    tax += (annualSalary - 500000) * 0.20;
    tax += 250000 * 0.05;
  } else if (annualSalary > 250000) {
    tax += (annualSalary - 250000) * 0.05;
  }

  return tax / 12; // Monthly tax
}

export default salaryService;
