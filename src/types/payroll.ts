// Comprehensive Payroll, Leave, and Attendance Types

// =====================================================
// ORGANIZATION DETAILS (For Statutory Forms - Form 16, etc.)
// =====================================================

export interface OrganizationDetails {
  id: string;
  
  // Organization Identity
  organization_name: string;
  legal_entity_name?: string;
  organization_type?: string; // Pvt Ltd, Limited, Partnership, etc.
  
  // Tax Registration Details
  pan: string;
  tan: string;
  gst_registration_number?: string;
  cin?: string; // Corporate Identification Number
  llpin?: string; // Limited Liability Partnership ID
  
  // Bank Account Details (Payroll Account)
  bank_account_holder_name?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_type?: string; // Savings, Current, etc.
  ifsc_code?: string;
  micr_code?: string;
  bank_branch_name?: string;
  
  // Registered Address
  registered_address_line1?: string;
  registered_address_line2?: string;
  registered_city?: string;
  registered_state?: string;
  registered_postal_code?: string;
  registered_country?: string;
  
  // Corporate Office Address
  corporate_address_line1?: string;
  corporate_address_line2?: string;
  corporate_city?: string;
  corporate_state?: string;
  corporate_postal_code?: string;
  
  // Contact Details
  primary_phone?: string;
  primary_email?: string;
  helpdesk_phone?: string;
  helpdesk_email?: string;
  
  // Statutory Compliance
  financial_year_start: string; // MM-DD format
  financial_year_end: string; // MM-DD format
  
  // Form 16 Details
  form_16_issuer_name?: string;
  form_16_issuer_designation?: string;
  form_16_place_of_issuance?: string;
  
  // Professional Tax
  professional_tax_state?: string;
  professional_tax_registration_number?: string;
  
  // PF Establishment
  pf_establishment_code?: string;
  pf_establishment_name?: string;
  
  // ESI Establishment
  esi_establishment_code?: string;
  
  // LWFC Registration
  lwfc_registration_number?: string;
  
  // HR Contact
  hr_contact_person_name?: string;
  hr_contact_person_phone?: string;
  hr_contact_person_email?: string;
  
  // Company Logo
  logo_image_data?: string; // Base64 encoded
  
  // Compliance Tracking
  pf_last_deposit_date?: string; // ISO date format
  esi_last_deposit_date?: string; // ISO date format
  tds_last_deposit_date?: string; // ISO date format
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateOrganizationDetailsDto = Omit<OrganizationDetails, 'id' | 'created_at' | 'updated_at'>;
export type UpdateOrganizationDetailsDto = Partial<CreateOrganizationDetailsDto>;

// =====================================================
// LEAVE MANAGEMENT
// =====================================================

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description?: string;
  max_days_per_year: number;
  carry_forward: boolean;
  max_carry_forward_days: number;
  paid: boolean;
  requires_approval: boolean;
  notice_days: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeLeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  financial_year: string;
  opening_balance: number;
  earned: number;
  taken: number;
  carry_forward: number;
  encashed: number;
  lapsed: number;
  available: number;
  created_at?: string;
  updated_at?: string;
}

export type LeaveApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'withdrawn';

export interface LeaveApplication {
  id: string;
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  half_day: boolean;
  total_days: number;
  reason: string;
  contact_during_leave?: string;
  status: LeaveApplicationStatus;
  applied_by: string;
  applied_at?: string;
  approved_by?: string;
  approved_at?: string;
  approval_remarks?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at?: string;
  updated_at?: string;
}

// =====================================================
// ATTENDANCE MANAGEMENT
// =====================================================

export type AttendanceStatus = 'present' | 'absent' | 'half-day' | 'on-leave' | 'holiday' | 'week-off';

export interface AttendanceBreak {
  check_out: string;
  check_in: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time?: string;
  check_out_time?: string;
  breaks?: AttendanceBreak[];
  total_hours: number;
  work_hours: number;
  break_hours: number;
  overtime_hours: number;
  status: AttendanceStatus;
  check_in_location?: string;
  check_out_location?: string;
  check_in_ip?: string;
  remarks?: string;
  is_regularized: boolean;
  regularized_by?: string;
  regularized_at?: string;
  regularization_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  description?: string;
  type: 'public' | 'optional' | 'restricted';
  is_optional: boolean;
  applicable_locations?: string[];
  created_at?: string;
  updated_at?: string;
}

// =====================================================
// TIMESHEET MANAGEMENT
// =====================================================

export type ProjectStatus = 'active' | 'on-hold' | 'completed' | 'cancelled';

export interface Project {
  id: string;
  project_code: string;
  project_name: string;
  client_name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  estimated_hours?: number;
  status: ProjectStatus;
  manager_id?: string;
  created_at?: string;
  updated_at?: string;
}

export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'billed';

export interface TimesheetEntry {
  id: string;
  employee_id: string;
  project_id?: string;
  entry_date: string;
  task_description: string;
  hours_worked: number;
  billable: boolean;
  status: TimesheetStatus;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  approval_remarks?: string;
  created_at?: string;
  updated_at?: string;
}

// =====================================================
// PAYROLL COMPONENTS
// =====================================================

export interface PayrollSettings {
  id: string;

  // PF Settings
  pf_enabled: boolean;
  employee_pf_rate: number;
  employer_pf_rate: number;
  pf_wage_ceiling: number;

  // EPS Settings
  eps_rate: number;
  eps_wage_ceiling: number;

  // ESI Settings
  esi_enabled: boolean;
  employee_esi_rate: number;
  employer_esi_rate: number;
  esi_wage_ceiling: number;

  // Professional Tax
  pt_enabled: boolean;
  pt_state: string;

  // Gratuity
  gratuity_enabled: boolean;
  gratuity_years_required: number;

  // Bonus
  annual_bonus_enabled: boolean;
  minimum_bonus_percent: number;
  maximum_bonus_percent: number;
  bonus_wage_ceiling: number;

  // LWF
  lwf_enabled: boolean;
  employee_lwf_amount: number;
  employer_lwf_amount: number;

  financial_year: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type BonusStatus = 'calculated' | 'approved' | 'paid' | 'cancelled';

export interface BonusRecord {
  id: string;
  employee_id: string;
  financial_year: string;
  bonus_type: string;
  eligible_salary: number;
  bonus_percentage: number;
  bonus_amount: number;
  calculation_basis?: string;
  status: BonusStatus;
  approved_by?: string;
  approved_at?: string;
  paid_in_salary_slip_id?: string;
  paid_at?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export type GratuityStatus = 'calculated' | 'approved' | 'paid' | 'rejected';

export interface GratuityRecord {
  id: string;
  employee_id: string;
  date_of_joining: string;
  date_of_leaving: string;
  total_years_worked: number;
  eligible: boolean;
  last_drawn_salary: number;
  gratuity_amount: number;
  calculation_formula?: string;
  status: GratuityStatus;
  approved_by?: string;
  approved_at?: string;
  paid_at?: string;
  payment_reference?: string;
  created_at?: string;
  updated_at?: string;
}

// =====================================================
// PAYROLL CALCULATIONS
// =====================================================

export interface PayrollComponentsBreakdown {
  // Earnings
  basic_salary: number;
  hra: number;
  special_allowance: number;
  transport_allowance: number;
  medical_allowance: number;
  other_allowances: number;
  bonus: number;
  overtime: number;
  gross_salary: number;

  // Employee Deductions
  employee_pf: number;
  employee_esi: number;
  professional_tax: number;
  tds: number;
  lwf: number;
  loan_repayment: number;
  other_deductions: number;
  total_deductions: number;

  // Employer Contributions
  employer_pf: number;
  eps: number;
  employer_esi: number;

  // Net Salary
  net_salary: number;

  // Cost to Company
  ctc: number;
}

export interface PayrollCalculationInput {
  employee_id: string;
  salary_month: number;
  salary_year: number;

  // Attendance
  working_days: number;
  paid_days: number;
  lop_days: number;
  attendance_days: number;

  // Additional earnings
  bonus?: number;
  overtime_hours?: number;
  overtime_rate?: number;

  // Additional deductions
  loan_repayment?: number;
  other_deductions?: number;

  // Tax regime
  tax_regime?: 'old' | 'new';

  // Overrides
  basic_salary?: number;
  hra?: number;
  special_allowance?: number;
  transport_allowance?: number;
  medical_allowance?: number;
}

export interface MonthlyAttendanceSummary {
  employee_id: string;
  month: number;
  year: number;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  half_days: number;
  leave_days: number;
  holidays: number;
  week_offs: number;
  paid_days: number;
  lop_days: number;
  total_hours: number;
  work_hours: number;
  overtime_hours: number;
}
