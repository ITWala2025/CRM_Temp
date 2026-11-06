/**
 * Attendance Service - Handles attendance marking and management
 */

import { supabase } from '../config/supabase';
import type { Attendance, AttendanceStatus, AttendanceSummary, AttendanceFilter } from '../types/employee';

export const attendanceService = {
  /**
   * Mark attendance for an employee
   */
  async markAttendance(
    employeeId: string,
    attendanceDate: string,
    status: AttendanceStatus,
    checkInTime?: string,
    checkOutTime?: string
  ): Promise<Attendance | null> {
    try {
      const durationHours = checkInTime && checkOutTime 
        ? calculateDuration(checkInTime, checkOutTime)
        : undefined;

      const { data, error } = await supabase
        .from('attendance_records')
        .upsert({
          employee_id: employeeId,
          attendance_date: attendanceDate,
          status,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          total_hours: durationHours,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'employee_id,attendance_date' })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error marking attendance:', error);
      return null;
    }
  },

  /**
   * Get attendance for a specific date range
   */
  async getAttendanceByDateRange(
    employeeId: string,
    fromDate: string,
    toDate: string
  ): Promise<Attendance[] | null> {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('attendance_date', fromDate)
        .lte('attendance_date', toDate)
        .order('attendance_date', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching attendance:', error);
      return null;
    }
  },

  /**
   * Get monthly attendance summary
   */
  async getMonthlyAttendanceSummary(
    employeeId: string,
    month: number,
    year: number
  ): Promise<AttendanceSummary | null> {
    try {
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      // Use getDate() not toISOString() to avoid UTC timezone shift for IST users
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('employee_id', employeeId)
        .gte('attendance_date', firstDay)
        .lte('attendance_date', lastDay);

      if (error) throw error;

      const attendance = data || [];
      const totalWorkingDays = attendance.length;
      const daysPresent = attendance.filter(a => a.status === 'present').length;
      const daysAbsent = attendance.filter(a => a.status === 'absent').length;
      const daysHalfDay = attendance.filter(a => a.status === 'half-day').length;
      const daysOnLeave = attendance.filter(a => a.status === 'on-leave').length;

      return {
        employee_id: employeeId,
        month,
        year,
        total_working_days: totalWorkingDays,
        total_days: totalWorkingDays,
        days_present: daysPresent,
        present_days: daysPresent,
        days_absent: daysAbsent,
        absent_days: daysAbsent,
        days_half_day: daysHalfDay,
        half_days: daysHalfDay,
        days_on_leave: daysOnLeave,
        leaves: daysOnLeave,
        work_from_home: 0,
        attendance_percentage: totalWorkingDays > 0 
          ? ((daysPresent + daysHalfDay * 0.5) / totalWorkingDays) * 100 
          : 0,
      };
    } catch (error) {
      console.error('Error calculating monthly summary:', error);
      return null;
    }
  },

  /**
   * Get attendance with filters (Admin view)
   */
  async getAttendanceWithFilters(
    filters: AttendanceFilter,
    limit = 100,
    offset = 0
  ): Promise<{ attendance: Attendance[], total: number } | null> {
    try {
      let query = supabase.from('attendance_records').select('*', { count: 'exact' });

      if (filters.employee_id) {
        query = query.eq('employee_id', filters.employee_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.from_date) {
        query = query.gte('attendance_date', filters.from_date);
      }

      if (filters.to_date) {
        query = query.lte('attendance_date', filters.to_date);
      }

      const { data, count, error } = await query
        .order('attendance_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        attendance: data || [],
        total: count || 0,
      };
    } catch (error) {
      console.error('Error fetching attendance:', error);
      return null;
    }
  },

  /**
   * Review and update attendance (Admin)
   */
  async reviewAttendance(
    attendanceId: string,
    reviewedBy: string,
    reviewComments: string
  ): Promise<Attendance | null> {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .update({
          reviewed_by: reviewedBy,
          review_comments: reviewComments,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', attendanceId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error reviewing attendance:', error);
      return null;
    }
  },

  /**
   * Get employees with discrepancies (Admin)
   */
  async getAttendanceDiscrepancies(month: number, year: number): Promise<any[] | null> {
    try {
      // Get all employees
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, employee_id, first_name, last_name, email')
        .eq('employment_status', 'active');

      if (empError) throw empError;

      const discrepancies = [];

      for (const emp of employees || []) {
        const summary = await this.getMonthlyAttendanceSummary(emp.id, month, year);
        if (summary && summary.attendance_percentage < 75) {
          discrepancies.push({
            employee: emp,
            attendance_summary: summary,
          });
        }
      }

      return discrepancies;
    } catch (error) {
      console.error('Error fetching discrepancies:', error);
      return null;
    }
  },

  /**
   * Bulk update attendance status
   */
  async bulkUpdateAttendance(updates: Array<{ id: string, status: AttendanceStatus }>): Promise<boolean> {
    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('attendance_records')
          .update({ status: update.status, updated_at: new Date().toISOString() })
          .eq('id', update.id);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error bulk updating attendance:', error);
      return false;
    }
  },
};

/**
 * Calculate duration between two times
 */
function calculateDuration(checkIn: string, checkOut: string): number {
  const [inHours, inMinutes] = checkIn.split(':').map(Number);
  const [outHours, outMinutes] = checkOut.split(':').map(Number);

  const inTotalMinutes = inHours * 60 + inMinutes;
  const outTotalMinutes = outHours * 60 + outMinutes;

  return (outTotalMinutes - inTotalMinutes) / 60;
}

export default attendanceService;

