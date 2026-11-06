/**
 * Employee Audit Log Service - Tracks all employee record changes
 */

import { supabase } from '../config/supabase';

export interface AuditLog {
  id: string;
  employee_id?: string;
  table_name: string;
  record_id?: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'cancel' | 'restore' | 'rehire' | 'intern_conversion' | 'note_added';
  field_name?: string;
  old_value?: string;
  new_value?: string;
  change_summary?: string;
  performed_by?: string;
  performed_by_name?: string;
  performed_by_role?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export const auditLogService = {
  /**
   * Create audit log entry
   */
  async createLog(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog | null> {
    try {
      const { data, error } = await supabase
        .from('employee_audit_logs')
        .insert(log)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating audit log:', error);
      return null;
    }
  },

  /**
   * Get audit logs for an employee
   */
  async getEmployeeLogs(
    employeeId: string,
    options?: {
      tableName?: string;
      action?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      let query = supabase
        .from('employee_audit_logs')
        .select('*', { count: 'exact' })
        .eq('employee_id', employeeId);

      if (options?.tableName) {
        query = query.eq('table_name', options.tableName);
      }

      if (options?.action) {
        query = query.eq('action', options.action);
      }

      query = query.order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        logs: data || [],
        total: count || 0,
      };
    } catch (error) {
      console.error('Error fetching employee audit logs:', error);
      return { logs: [], total: 0 };
    }
  },

  /**
   * Get audit logs for a specific record
   */
  async getRecordLogs(tableName: string, recordId: string): Promise<AuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('employee_audit_logs')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching record audit logs:', error);
      return [];
    }
  },

  /**
   * Get recent audit logs (Admin view)
   */
  async getRecentLogs(limit = 50): Promise<AuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('employee_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching recent audit logs:', error);
      return [];
    }
  },

  /**
   * Get audit logs by user
   */
  async getUserActivityLogs(userId: string, limit = 50): Promise<AuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('employee_audit_logs')
        .select('*')
        .eq('performed_by', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user activity logs:', error);
      return [];
    }
  },

  /**
   * Get audit logs within date range
   */
  async getLogsByDateRange(
    fromDate: string,
    toDate: string,
    options?: { employeeId?: string; tableName?: string }
  ): Promise<AuditLog[]> {
    try {
      let query = supabase
        .from('employee_audit_logs')
        .select('*')
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      if (options?.employeeId) {
        query = query.eq('employee_id', options.employeeId);
      }

      if (options?.tableName) {
        query = query.eq('table_name', options.tableName);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching logs by date range:', error);
      return [];
    }
  },

  /**
   * Helper: Log employee creation
   */
  async logEmployeeCreation(
    employeeId: string,
    createdBy: string,
    createdByName: string,
    employeeData: Record<string, unknown>
  ): Promise<void> {
    await this.createLog({
      employee_id: employeeId,
      table_name: 'employees',
      record_id: employeeId,
      action: 'create',
      change_summary: `Employee record created: ${employeeData.first_name} ${employeeData.last_name}`,
      performed_by: createdBy,
      performed_by_name: createdByName,
      new_value: JSON.stringify(employeeData),
      metadata: { employee_data: employeeData },
    });
  },

  /**
   * Helper: Log employee update
   */
  async logEmployeeUpdate(
    employeeId: string,
    updatedBy: string,
    updatedByName: string,
    fieldName: string,
    oldValue: string | number | boolean,
    newValue: string | number | boolean
  ): Promise<void> {
    await this.createLog({
      employee_id: employeeId,
      table_name: 'employees',
      record_id: employeeId,
      action: 'update',
      field_name: fieldName,
      old_value: String(oldValue),
      new_value: String(newValue),
      change_summary: `Updated ${fieldName} from "${oldValue}" to "${newValue}"`,
      performed_by: updatedBy,
      performed_by_name: updatedByName,
    });
  },

  /**
   * Helper: Log leave approval/rejection
   */
  async logLeaveAction(
    leaveId: string,
    employeeId: string,
    action: 'approve' | 'reject',
    approvedBy: string,
    approverName: string,
    comments?: string
  ): Promise<void> {
    await this.createLog({
      employee_id: employeeId,
      table_name: 'leave_applications',
      record_id: leaveId,
      action,
      change_summary: `Leave application ${action}d by ${approverName}`,
      performed_by: approvedBy,
      performed_by_name: approverName,
      metadata: { comments },
    });
  },

  /**
   * Helper: Log document verification
   */
  async logDocumentVerification(
    documentId: string,
    employeeId: string,
    verifiedBy: string,
    verifierName: string,
    status: string
  ): Promise<void> {
    await this.createLog({
      employee_id: employeeId,
      table_name: 'employment_documents',
      record_id: documentId,
      action: 'update',
      field_name: 'verification_status',
      new_value: status,
      change_summary: `Document verification status changed to ${status}`,
      performed_by: verifiedBy,
      performed_by_name: verifierName,
    });
  },

  /**
   * Helper: Log salary structure change
   */
  async logSalaryStructureChange(
    structureId: string,
    employeeId: string,
    changedBy: string,
    changerName: string,
    oldStructure: Record<string, unknown>,
    newStructure: Record<string, unknown>
  ): Promise<void> {
    await this.createLog({
      employee_id: employeeId,
      table_name: 'salary_structures',
      record_id: structureId,
      action: 'update',
      change_summary: `Salary structure updated`,
      old_value: JSON.stringify(oldStructure),
      new_value: JSON.stringify(newStructure),
      performed_by: changedBy,
      performed_by_name: changerName,
      metadata: {
        old_base_salary: oldStructure?.base_salary,
        new_base_salary: newStructure?.base_salary,
      },
    });
  },
};
