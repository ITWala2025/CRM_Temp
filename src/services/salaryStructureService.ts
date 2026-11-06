/**
 * Salary Structure Service - Manages employee salary components and structures
 */

import { supabase } from '../config/supabase';

export interface SalaryStructure {
  id: string;
  employee_id: string;
  effective_from: string;
  effective_to?: string;
  base_salary: number;
  hra_percentage: number;
  dearness_allowance_percentage: number;
  transport_allowance: number;
  medical_allowance: number;
  special_allowance: number;
  other_allowances: number;
  pf_percentage: number;
  esi_percentage: number;
  professional_tax: number;
  currency: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const salaryStructureService = {
  /**
   * Get active salary structure for employee
   */
  async getActiveSalaryStructure(employeeId: string): Promise<SalaryStructure | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('salary_structures')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error fetching active salary structure:', error);
      return null;
    }
  },

  /**
   * Get all salary structures for employee (history)
   */
  async getSalaryStructureHistory(employeeId: string): Promise<SalaryStructure[]> {
    try {
      const { data, error } = await supabase
        .from('salary_structures')
        .select('*')
        .eq('employee_id', employeeId)
        .order('effective_from', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching salary structure history:', error);
      return [];
    }
  },

  /**
   * Create new salary structure
   */
  async createSalaryStructure(
    structure: Omit<SalaryStructure, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SalaryStructure | null> {
    try {
      // Deactivate previous structures for this employee
      const { error: deactivateError } = await supabase
        .from('salary_structures')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('employee_id', structure.employee_id)
        .eq('is_active', true);

      if (deactivateError) throw deactivateError;

      // Create new structure
      const { data, error } = await supabase
        .from('salary_structures')
        .insert(structure)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating salary structure:', error);
      return null;
    }
  },

  /**
   * Update salary structure
   */
  async updateSalaryStructure(
    id: string,
    updates: Partial<SalaryStructure>
  ): Promise<SalaryStructure | null> {
    try {
      const { data, error } = await supabase
        .from('salary_structures')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
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
   * Calculate gross salary from structure
   */
  calculateGrossSalary(structure: SalaryStructure): number {
    const hra = (structure.base_salary * structure.hra_percentage) / 100;
    const da = (structure.base_salary * structure.dearness_allowance_percentage) / 100;
    
    return (
      structure.base_salary +
      hra +
      da +
      structure.transport_allowance +
      structure.medical_allowance +
      structure.special_allowance +
      structure.other_allowances
    );
  },

  /**
   * Calculate total deductions from structure
   */
  calculateDeductions(structure: SalaryStructure): {
    pf: number;
    esi: number;
    professionalTax: number;
    total: number;
  } {
    const pf = (structure.base_salary * structure.pf_percentage) / 100;
    const esi = (structure.base_salary * structure.esi_percentage) / 100;
    const professionalTax = structure.professional_tax;
    
    return {
      pf,
      esi,
      professionalTax,
      total: pf + esi + professionalTax,
    };
  },

  /**
   * Calculate net salary
   */
  calculateNetSalary(structure: SalaryStructure): {
    gross: number;
    deductions: number;
    net: number;
  } {
    const gross = this.calculateGrossSalary(structure);
    const deductions = this.calculateDeductions(structure);
    
    return {
      gross,
      deductions: deductions.total,
      net: gross - deductions.total,
    };
  },

  /**
   * Deactivate salary structure
   */
  async deactivateSalaryStructure(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('salary_structures')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deactivating salary structure:', error);
      return false;
    }
  },
};
