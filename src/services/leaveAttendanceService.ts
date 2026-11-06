import { supabase } from '../config/supabase';
import type {
  LeaveType,
  EmployeeLeaveBalance,
  LeaveApplication,
  AttendanceRecord,
  Holiday,
  MonthlyAttendanceSummary
} from '../types/payroll';
import { getFinancialYear } from '../utils/indianTaxCalculator';

export const leaveAttendanceService = {
  // =====================================================
  // LEAVE TYPE MANAGEMENT
  // =====================================================

  async getLeaveTypes(): Promise<LeaveType[]> {
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getLeaveTypeById(id: string): Promise<LeaveType | null> {
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // =====================================================
  // LEAVE BALANCE MANAGEMENT
  // =====================================================

  async getEmployeeLeaveBalance(
    employeeId: string,
    financialYear?: string
  ): Promise<EmployeeLeaveBalance[]> {
    const fy = financialYear || getFinancialYear();

    const { data, error } = await supabase
      .from('employee_leave_balance')
      .select(`
        *,
        leave_type:leave_types(*)
      `)
      .eq('employee_id', employeeId)
      .eq('financial_year', fy);

    if (error) throw error;
    return data || [];
  },

  async initializeLeaveBalance(
    employeeId: string,
    financialYear?: string
  ): Promise<void> {
    const fy = financialYear || getFinancialYear();
    const leaveTypes = await this.getLeaveTypes();

    const balances = leaveTypes.map(lt => ({
      employee_id: employeeId,
      leave_type_id: lt.id,
      financial_year: fy,
      opening_balance: 0,
      earned: 0,
      taken: 0,
      carry_forward: 0,
      encashed: 0,
      lapsed: 0,
      available: 0
    }));

    const { error } = await supabase
      .from('employee_leave_balance')
      .upsert(balances, {
        onConflict: 'employee_id,leave_type_id,financial_year'
      });

    if (error) throw error;
  },

  async updateLeaveBalance(
    employeeId: string,
    leaveTypeId: string,
    taken: number,
    financialYear?: string
  ): Promise<void> {
    const fy = financialYear || getFinancialYear();

    const { data: balance } = await supabase
      .from('employee_leave_balance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveTypeId)
      .eq('financial_year', fy)
      .single();

    if (!balance) {
      await this.initializeLeaveBalance(employeeId, fy);
    }

    const newTaken = (balance?.taken || 0) + taken;
    const available = (balance?.opening_balance || 0) + (balance?.earned || 0) + (balance?.carry_forward || 0) - newTaken;

    const { error } = await supabase
      .from('employee_leave_balance')
      .update({
        taken: newTaken,
        available: Math.max(0, available)
      })
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveTypeId)
      .eq('financial_year', fy);

    if (error) throw error;
  },

  async updateLeaveAllocation(
    employeeId: string,
    leaveTypeId: string,
    allocation: {
      opening_balance: number;
      earned: number;
      carry_forward: number;
      available: number;
    },
    financialYear?: string
  ): Promise<void> {
    const fy = financialYear || getFinancialYear();

    // Get current balance to preserve taken value
    const { data: currentBalance } = await supabase
      .from('employee_leave_balance')
      .select('taken')
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveTypeId)
      .eq('financial_year', fy)
      .single();

    // Recalculate available based on current taken value
    const taken = currentBalance?.taken || 0;
    const recalculatedAvailable = allocation.opening_balance + allocation.earned + allocation.carry_forward - taken;

    const { error } = await supabase
      .from('employee_leave_balance')
      .update({
        opening_balance: allocation.opening_balance,
        earned: allocation.earned,
        carry_forward: allocation.carry_forward,
        available: Math.max(0, recalculatedAvailable),
        updated_at: new Date().toISOString()
      })
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveTypeId)
      .eq('financial_year', fy);

    if (error) throw error;
  },

  // =====================================================
  // LEAVE APPLICATION MANAGEMENT
  // =====================================================

  async getLeaveApplications(filters?: {
    employeeId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<LeaveApplication[]> {
    let query = supabase
      .from('leave_applications')
      .select(`
        *,
        employee:employees!leave_applications_employee_id_fkey(*),
        leave_type:leave_types(*),
        approver:employees!leave_applications_approved_by_fkey(*)
      `)
      .order('applied_at', { ascending: false });

    if (filters?.employeeId) {
      query = query.eq('employee_id', filters.employeeId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.fromDate) {
      query = query.gte('from_date', filters.fromDate);
    }
    if (filters?.toDate) {
      query = query.lte('to_date', filters.toDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async applyLeave(application: {
    employee_id: string;
    leave_type_id: string;
    from_date: string;
    to_date: string;
    half_day?: boolean;
    reason: string;
    contact_during_leave?: string;
  }): Promise<LeaveApplication> {
    // Calculate total days
    const fromDate = new Date(application.from_date);
    const toDate = new Date(application.to_date);
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    let totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (application.half_day) {
      totalDays = 0.5;
    }

    // Check if employee has sufficient balance
    const fy = getFinancialYear(fromDate);
    const balances = await this.getEmployeeLeaveBalance(application.employee_id, fy);
    const balance = balances.find(b => b.leave_type_id === application.leave_type_id);

    if (!balance || balance.available < totalDays) {
      throw new Error('Insufficient leave balance');
    }

    const { data, error } = await supabase
      .from('leave_applications')
      .insert([{
        ...application,
        total_days: totalDays,
        applied_by: application.employee_id,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async approveLeave(
    applicationId: string,
    approverId: string,
    remarks?: string
  ): Promise<LeaveApplication> {
    // Get the application
    const { data: application } = await supabase
      .from('leave_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (!application) throw new Error('Leave application not found');

    // Check if approverId exists in employees table
    const { data: employeeExists } = await supabase
      .from('employees')
      .select('id')
      .eq('id', approverId)
      .single();

    // Update leave balance
    await this.updateLeaveBalance(
      application.employee_id,
      application.leave_type_id,
      application.total_days
    );

    // Create attendance records for each day of leave
    const startDate = new Date(application.from_date);
    const endDate = new Date(application.to_date);
    const attendanceRecords = [];

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      
      // Check if attendance record already exists for this date
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('employee_id', application.employee_id)
        .eq('attendance_date', dateStr)
        .single();

      if (!existing) {
        attendanceRecords.push({
          employee_id: application.employee_id,
          attendance_date: dateStr,
          status: 'on-leave',
          total_hours: 0,
          work_hours: 0,
          break_hours: 0,
          overtime_hours: 0,
          remarks: `On leave: ${application.reason || 'Leave approved'}`,
          is_regularized: false
        });
      }
    }

    // Insert attendance records if any
    if (attendanceRecords.length > 0) {
      await supabase
        .from('attendance_records')
        .insert(attendanceRecords);
    }

    // Approve the application
    const approvalRemarks = employeeExists 
      ? remarks 
      : `Approved by: Admin${remarks ? ` - ${remarks}` : ''}`;

    const { data, error } = await supabase
      .from('leave_applications')
      .update({
        status: 'approved',
        approved_by: employeeExists ? approverId : null,
        approved_at: new Date().toISOString(),
        approval_remarks: approvalRemarks
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async rejectLeave(
    applicationId: string,
    approverId: string,
    remarks: string
  ): Promise<LeaveApplication> {
    // Check if approverId exists in employees table
    const { data: employeeExists } = await supabase
      .from('employees')
      .select('id')
      .eq('id', approverId)
      .single();

    const rejectionRemarks = employeeExists 
      ? remarks 
      : `Rejected by: Admin${remarks ? ` - ${remarks}` : ''}`;

    const { data, error } = await supabase
      .from('leave_applications')
      .update({
        status: 'rejected',
        approved_by: employeeExists ? approverId : null,
        approved_at: new Date().toISOString(),
        approval_remarks: rejectionRemarks
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async cancelLeave(
    applicationId: string,
    reason: string
  ): Promise<LeaveApplication> {
    // Get the application
    const { data: application } = await supabase
      .from('leave_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (!application) throw new Error('Leave application not found');

    // If it was approved, restore the balance and remove attendance records
    if (application.status === 'approved') {
      await this.updateLeaveBalance(
        application.employee_id,
        application.leave_type_id,
        -application.total_days // Negative to add back
      );

      // Remove attendance records created for this leave
      const startDate = new Date(application.from_date);
      const endDate = new Date(application.to_date);

      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        
        // Delete attendance records that were marked as 'on-leave' for this employee and date
        await supabase
          .from('attendance_records')
          .delete()
          .eq('employee_id', application.employee_id)
          .eq('attendance_date', dateStr)
          .eq('status', 'on-leave');
      }
    }

    const { data, error } = await supabase
      .from('leave_applications')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // =====================================================
  // ATTENDANCE MANAGEMENT
  // =====================================================

  async getAttendanceRecords(filters: {
    employeeId?: string;
    fromDate: string;
    toDate: string;
  }): Promise<AttendanceRecord[]> {
    let query = supabase
      .from('attendance_records')
      .select('*')
      .gte('attendance_date', filters.fromDate)
      .lte('attendance_date', filters.toDate)
      .order('attendance_date', { ascending: false });

    if (filters.employeeId) {
      query = query.eq('employee_id', filters.employeeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getAttendanceByDate(date: Date): Promise<AttendanceRecord[]> {
    const dateStr = date.toISOString().split('T')[0];
    return this.getAttendanceRecords({
      fromDate: dateStr,
      toDate: dateStr
    });
  },

  async markAttendance(attendance: {
    employee_id: string;
    attendance_date: string;
    status: 'present' | 'absent' | 'half-day' | 'leave';
    check_in_time?: string;
    check_out_time?: string;
    notes?: string;
    remarks?: string;
  }): Promise<AttendanceRecord> {
    try {
      console.log('markAttendance called with:', attendance);

      // Convert time (HH:MM) to full timestamp with timezone
      const convertToTimestamp = (date: string, time?: string): string | undefined => {
        if (!time) return undefined;
        // Combine date and time into ISO timestamp
        return `${date}T${time}:00`;
      };

      const check_in_timestamp = convertToTimestamp(attendance.attendance_date, attendance.check_in_time);
      const check_out_timestamp = convertToTimestamp(attendance.attendance_date, attendance.check_out_time);

      console.log('Converted timestamps:', { check_in_timestamp, check_out_timestamp });

      // Check if attendance already exists for this date
      const { data: existing, error: checkError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', attendance.employee_id)
        .eq('attendance_date', attendance.attendance_date)
        .maybeSingle();

      console.log('Existing attendance check:', { existing, checkError });

      if (checkError) {
        console.error('Error checking existing attendance:');
        console.error('Error code:', checkError.code);
        console.error('Error message:', checkError.message);
        console.error('Error details:', checkError.details);
        console.error('Full error:', JSON.stringify(checkError, null, 2));
        throw checkError;
      }

      if (existing) {
        console.log('Updating existing attendance record:', existing.id);
        // Update existing record
        const { data, error } = await supabase
          .from('attendance_records')
          .update({
            status: attendance.status,
            check_in_time: check_in_timestamp,
            check_out_time: check_out_timestamp,
            remarks: attendance.notes || attendance.remarks,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        console.log('Update response:', { data, error });

        if (error) {
          console.error('Error updating attendance:');
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          console.error('Error details:', error.details);
          console.error('Full error:', JSON.stringify(error, null, 2));
          throw error;
        }
        return data;
      } else {
        console.log('Creating new attendance record');
        // Create new record
        const { data, error } = await supabase
          .from('attendance_records')
          .insert([{
            employee_id: attendance.employee_id,
            attendance_date: attendance.attendance_date,
            status: attendance.status,
            check_in_time: check_in_timestamp,
            check_out_time: check_out_timestamp,
            remarks: attendance.notes || attendance.remarks
          }])
          .select()
          .single();

        console.log('Insert response:', { data, error });

        if (error) {
          console.error('Error creating attendance:');
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          console.error('Error details:', error.details);
          console.error('Error hint:', error.hint);
          console.error('Full error:', JSON.stringify(error, null, 2));
          throw error;
        }
        return data;
      }
    } catch (error) {
      console.error('markAttendance exception caught:', error);
      throw error;
    }
  },

  async checkIn(
    employeeId: string,
    location?: string,
    ip?: string
  ): Promise<AttendanceRecord> {
    const today = new Date().toISOString().split('T')[0];

    // Check if already checked in
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('attendance_date', today)
      .single();

    if (existing) {
      throw new Error('Already checked in for today');
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .insert([{
        employee_id: employeeId,
        attendance_date: today,
        check_in_time: new Date().toISOString(),
        check_in_location: location,
        check_in_ip: ip,
        status: 'present'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async checkOut(
    employeeId: string,
    location?: string
  ): Promise<AttendanceRecord> {
    const today = new Date().toISOString().split('T')[0];

    const { data: attendance } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('attendance_date', today)
      .single();

    if (!attendance) {
      throw new Error('No check-in record found for today');
    }

    if (attendance.check_out_time) {
      throw new Error('Already checked out');
    }

    const checkOutTime = new Date();
    const checkInTime = new Date(attendance.check_in_time);
    const totalMs = checkOutTime.getTime() - checkInTime.getTime();
    const totalHours = totalMs / (1000 * 60 * 60);

    // Calculate overtime (if more than 8 hours)
    const workHours = Math.min(totalHours, 8);
    const overtimeHours = Math.max(0, totalHours - 8);

    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        check_out_time: checkOutTime.toISOString(),
        check_out_location: location,
        total_hours: Number(totalHours.toFixed(2)),
        work_hours: Number(workHours.toFixed(2)),
        overtime_hours: Number(overtimeHours.toFixed(2))
      })
      .eq('id', attendance.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async regularizeAttendance(
    attendanceId: string,
    regularizedBy: string,
    reason: string,
    updates: {
      check_in_time?: string;
      check_out_time?: string;
      status?: string;
    }
  ): Promise<AttendanceRecord> {
    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        ...updates,
        is_regularized: true,
        regularized_by: regularizedBy,
        regularized_at: new Date().toISOString(),
        regularization_reason: reason
      })
      .eq('id', attendanceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getMonthlyAttendanceSummary(
    year: number,
    month: number
  ): Promise<MonthlyAttendanceSummary[]> {
    // Use local date formatting (not toISOString) to avoid UTC timezone shift for IST users
    const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const toDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    // Get all attendance records for the month
    const records = await this.getAttendanceRecords({
      fromDate,
      toDate
    });

    // Group by employee
    const employeeRecords = records.reduce((acc, record) => {
      if (!acc[record.employee_id]) {
        acc[record.employee_id] = [];
      }
      acc[record.employee_id].push(record);
      return acc;
    }, {} as Record<string, AttendanceRecord[]>);

    // Create summary for each employee
    const summaries: MonthlyAttendanceSummary[] = Object.entries(employeeRecords).map(([employeeId, empRecords]) => {
      const summary: MonthlyAttendanceSummary = {
        employee_id: employeeId,
        month,
        year,
        total_working_days: new Date(year, month, 0).getDate(),
        present_days: empRecords.filter(r => r.status === 'present').length,
        absent_days: empRecords.filter(r => r.status === 'absent').length,
        half_days: empRecords.filter(r => r.status === 'half-day').length,
        leave_days: empRecords.filter(r => r.status === 'on-leave').length,
        holidays: empRecords.filter(r => r.status === 'holiday').length,
        week_offs: empRecords.filter(r => r.status === 'week-off').length,
        paid_days: 0,
        lop_days: 0,
        total_hours: empRecords.reduce((sum, r) => sum + (r.work_hours || 0), 0),
        work_hours: empRecords.reduce((sum, r) => sum + (r.work_hours || 0), 0),
        overtime_hours: empRecords.reduce((sum, r) => sum + (r.overtime_hours || 0), 0)
      };

      // Calculate paid days and LOP
      summary.paid_days = summary.present_days + summary.half_days * 0.5 + summary.leave_days;
      summary.lop_days = Math.max(0, summary.total_working_days - summary.paid_days - summary.holidays - summary.week_offs);

      return summary;
    });

    return summaries;
  },

  // =====================================================
  // HOLIDAY MANAGEMENT
  // =====================================================

  async getHolidays(year?: number): Promise<Holiday[]> {
    let query = supabase
      .from('company_holidays')
      .select('*')
      .order('holiday_date');

    if (year) {
      query = query
        .gte('holiday_date', `${year}-01-01`)
        .lte('holiday_date', `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async addHoliday(holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>): Promise<Holiday> {
    const { data, error } = await supabase
      .from('company_holidays')
      .insert([holiday])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

export default leaveAttendanceService;
