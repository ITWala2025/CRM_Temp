/**
 * Leave Service - Handles leave management, requests, and approvals
 */

import { supabase } from '../config/supabase';
import type { Leave, LeaveAllocation, LeaveType, LeaveFilter, LeaveRequest, LeaveStatus } from '../types/employee';

export const leaveService = {
  /**
   * Get leave types
   */
  async getLeaveTypes(): Promise<LeaveType[] | null> {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .order('name');

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching leave types:', error);
      return null;
    }
  },

  /**
   * Get employee's leave allocation for a financial year
   */
  async getLeaveAllocation(employeeId: string, financialYear: number): Promise<LeaveAllocation[] | null> {
    try {
      const { data, error } = await supabase
        .from('employee_leave_balance')
        .select('*, leave_types(*)')
        .eq('employee_id', employeeId)
        .eq('financial_year', financialYear);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching leave allocation:', error);
      return null;
    }
  },

  /**
   * Get remaining leaves for an employee
   */
  async getRemainingLeaves(employeeId: string, financialYear: number): Promise<any[] | null> {
    try {
      const allocations = await this.getLeaveAllocation(employeeId, financialYear);
      if (!allocations) return null;

      // Fetch leave type names for each allocation
      const mappedAllocations = await Promise.all(
        allocations.map(async (alloc) => {
          const { data: leaveType } = await supabase
            .from('leave_types')
            .select('name')
            .eq('id', alloc.leave_type_id)
            .single();
          
          return {
            leave_type: leaveType?.name || 'Unknown',
            allocated: alloc.allocated_days,
            used: alloc.used_days,
            carried_forward: alloc.carried_forward_days,
            total_available: alloc.allocated_days + alloc.carried_forward_days,
            remaining: (alloc.allocated_days + alloc.carried_forward_days) - alloc.used_days,
          };
        })
      );

      return mappedAllocations;
    } catch (error) {
      console.error('Error calculating remaining leaves:', error);
      return null;
    }
  },

  /**
   * Request leave
   */
  async requestLeave(leaveRequest: LeaveRequest): Promise<Leave | null> {
    try {
      // Calculate total days (0.5 for half day)
      const startDate = new Date(leaveRequest.from_date);
      const endDate = new Date(leaveRequest.to_date);
      const totalDays = leaveRequest.half_day
        ? 0.5
        : Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const { data, error } = await supabase
        .from('leave_applications')
        .insert({
          employee_id: leaveRequest.employee_id,
          leave_type_id: leaveRequest.leave_type_id,
          from_date: leaveRequest.from_date,
          to_date: leaveRequest.to_date,
          half_day: leaveRequest.half_day || false,
          total_days: totalDays,
          reason: leaveRequest.reason,
          contact_during_leave: leaveRequest.contact_during_leave,
          status: 'pending',
          applied_by: leaveRequest.employee_id,
          applied_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error requesting leave:', error);
      return null;
    }
  },

  /**
   * Get employee's leave requests
   */
  async getEmployeeLeaves(employeeId: string, filters?: { status?: LeaveStatus }): Promise<Leave[] | null> {
    try {
      let query = supabase
        .from('leave_applications')
        .select('*, leave_types(id, name, code)')
        .eq('employee_id', employeeId);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('from_date', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching employee leaves:', error);
      return null;
    }
  },

  /**
   * Get pending leave requests (Admin view)
   */
  async getPendingLeaveRequests(): Promise<any[] | null> {
    try {
      const { data, error } = await supabase
        .from('leave_applications')
        .select(`
          *,
          employee:employees!leave_applications_employee_id_fkey(id, first_name, last_name, email, department),
          leave_type:leave_types(name)
        `)
        .eq('status', 'pending')
        .order('applied_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      return null;
    }
  },

  /**
   * Get leaves with filters (Admin view)
   */
  async getLeavesWithFilters(
    filters: LeaveFilter,
    limit = 50,
    offset = 0
  ): Promise<{ leaves: any[], total: number } | null> {
    try {
      let query = supabase
        .from('leave_applications')
        .select(`
          *,
          employee:employees!leave_applications_employee_id_fkey(first_name, last_name, email, department),
          leave_type:leave_types(name)
        `, { count: 'exact' });

      if (filters.employee_id) {
        query = query.eq('employee_id', filters.employee_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.leave_type_id) {
        query = query.eq('leave_type_id', filters.leave_type_id);
      }

      if (filters.from_date) {
        query = query.gte('from_date', filters.from_date);
      }

      if (filters.to_date) {
        query = query.lte('to_date', filters.to_date);
      }

      const { data, count, error } = await query
        .order('applied_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        leaves: data || [],
        total: count || 0,
      };
    } catch (error) {
      console.error('Error fetching leaves:', error);
      return null;
    }
  },

  /**
   * Approve leave request (Admin)
   */
  async approveLeave(
    leaveId: string,
    approvedBy: string,
    approvalComments?: string
  ): Promise<Leave | null> {
    try {
      // Get leave details
      const { data: leave, error: fetchError } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('id', leaveId)
        .single();

      if (fetchError) throw fetchError;

      // Update leave status
      const { data, error: updateError } = await supabase
        .from('leave_applications')
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          approval_remarks: approvalComments,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leaveId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update leave allocation
      if (leave && data) {
        const { data: allocation } = await supabase
          .from('employee_leave_balance')
          .select('*')
          .eq('employee_id', leave.employee_id)
          .eq('leave_type_id', leave.leave_type_id)
          .eq('financial_year', getFinancialYear())
          .single();

        if (allocation) {
          await supabase
            .from('employee_leave_balance')
            .update({
              used_days: allocation.used_days + leave.total_days,
              updated_at: new Date().toISOString(),
            })
            .eq('id', allocation.id);
        }
      }

      return data;
    } catch (error) {
      console.error('Error approving leave:', error);
      return null;
    }
  },

  /**
   * Reject leave request (Admin)
   */
  async rejectLeave(
    leaveId: string,
    approvedBy: string,
    reason: string
  ): Promise<Leave | null> {
    try {
      const { data, error } = await supabase
        .from('leave_applications')
        .update({
          status: 'rejected',
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          approval_remarks: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leaveId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error rejecting leave:', error);
      return null;
    }
  },

  /**
   * Cancel leave request
   */
  async cancelLeave(leaveId: string, cancelledBy: string, reason: string): Promise<Leave | null> {
    try {
      // Get leave details
      const { data: leave } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('id', leaveId)
        .single();

      const { data, error } = await supabase
        .from('leave_applications')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leaveId)
        .select()
        .single();

      if (error) throw error;

      // Update leave allocation if it was approved
      if (leave && leave.status === 'approved') {
        const { data: allocation } = await supabase
          .from('employee_leave_balance')
          .select('*')
          .eq('employee_id', leave.employee_id)
          .eq('leave_type_id', leave.leave_type_id)
          .eq('financial_year', getFinancialYear())
          .single();

        if (allocation && allocation.used_days >= leave.total_days) {
          await supabase
            .from('employee_leave_balance')
            .update({
              used_days: allocation.used_days - leave.total_days,
              updated_at: new Date().toISOString(),
            })
            .eq('id', allocation.id);
        }
      }

      return data;
    } catch (error) {
      console.error('Error cancelling leave:', error);
      return null;
    }
  },

  /**
   * Get upcoming leaves for a department
   */
  async getUpcomingLeavesByDepartment(department: string): Promise<any[] | null> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('leave_applications')
        .select(`
          *,
          employee:employees!leave_applications_employee_id_fkey(first_name, last_name, department),
          leave_type:leave_types(name)
        `)
        .eq('employee.department', department)
        .eq('status', 'approved')
        .gte('from_date', today)
        .order('from_date');

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching upcoming leaves:', error);
      return null;
    }
  },
};

/**
 * Calculate financial year (April - March)
 */
function getFinancialYear(): number {
  const today = new Date();
  const month = today.getMonth();
  const year = today.getFullYear();

  // April (month 3) onwards is current financial year
  return month >= 3 ? year : year - 1;
}

export default leaveService;

