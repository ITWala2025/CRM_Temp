// Employee and HR Document Types

export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'intern';
export type EmploymentStatus = 'active' | 'on-leave' | 'resigned' | 'terminated';
export type Gender = 'male' | 'female' | 'other';

export const DEPARTMENTS = ['ITwala', 'Kdadks', 'Nirchal', 'Ayuh Clinic'] as const;
export type Department = typeof DEPARTMENTS[number];

export const DEPARTMENT_CODES: Record<Department, string> = {
  'ITwala': 'ITW',
  'Kdadks': 'KDA',
  'Nirchal': 'NIR',
  'Ayuh Clinic': 'AYU',
};

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal'
] as const;

export type IndianState = typeof INDIAN_STATES[number];

export interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name: string;
  fathers_name?: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: Gender;

  // Address
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;

  // Employment
  designation: string;
  department?: string;
  date_of_joining: string;
  date_of_leaving?: string;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;

  // Compensation
  basic_salary: number;
  hra?: number;
  special_allowance?: number;
  other_allowances?: number;
  gross_salary: number;
  currency_code: string;

  // Tax Information
  pan_number?: string;
  aadhar_number?: string;
  uan_number?: string;
  esic_number?: string;

  // Reporting
  reporting_manager_id?: string;

  // Banking
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc_code?: string;

  // Authentication
  password_hash?: string;
  is_first_login?: boolean;
  last_login_at?: string;
  password_changed_at?: string;
  account_locked?: boolean;
  failed_login_attempts?: number;
  locked_until?: string;

  // Company Association
  company_settings_id?: string | null;
  company_setting_id?: string | null;

  // Metadata
  created_by?: string;
  created_at?: string;
  updated_at?: string;

  // Rehire tracking
  rehire_count?: number;
  previous_joining_date?: string;
  previous_leaving_date?: string;
  last_rehired_at?: string;
  last_rehired_by?: string;
}

export type DocumentType = 'offer_letter' | 'salary_certificate' | 'experience_certificate' | 'relieving_letter' | 'form_16' | 'form_24q' | 'intern_offer_letter' | 'intern_experience_certificate' | 'other';
export type DocumentStatus = 'draft' | 'generated' | 'sent' | 'archived';

// ─── Version-Control Metadata ────────────────────────────────────────────────
export type ApprovalStatus = 'draft' | 'pending_approval' | 'approved' | 'archived';

export interface DocumentVersionMeta {
  /** Semantic version, e.g. "1.0.0" */
  version: string;
  /** ISO timestamp when this version was first created */
  created_at: string;
  /** ISO timestamp of last modification */
  modified_at: string;
  /** Author / HR user who created the document */
  author: string;
  /** Name of the approver (HR Manager / Director) */
  approved_by?: string;
  /** Current approval status */
  approval_status: ApprovalStatus;
  /** Short description of what changed in this version */
  change_log?: string;
  /** Identifies the template used, e.g. "ITWala-Intern-v1" */
  template_version: string;
  /** Unique document reference ID for auditability */
  document_ref?: string;
}

// ─── RBAC Role definitions for intern documents ───────────────────────────────
export type InternDocumentRole = 'viewer' | 'editor' | 'approver' | 'publisher';

export interface InternDocumentRBAC {
  /** Role → allowed actions map */
  viewer: string[];
  editor: string[];
  approver: string[];
  publisher: string[];
}

// ─── ITWala Academy Internship – Offer Letter Data ────────────────────────────
export interface InternOfferLetterData {
  // ── Core / inherited from OfferLetterData ────────────────────────────────
  position: string;                  // Intern's role title
  department: string;
  offer_date?: string;
  candidate_address?: string;

  // ── Internship Scope & Duration ──────────────────────────────────────────
  joining_date: string;              // Internship start date (REQUIRED)
  end_date: string;                  // Internship end date (REQUIRED)
  internship_duration?: string;      // Human-readable, e.g. "12 weeks"
  internship_scope?: string;         // High-level description of the internship scope

  // ── Program Details ───────────────────────────────────────────────────────
  program_name: string;              // e.g. "ITWala Academy Internship Program"
  program_batch?: string;            // e.g. "Batch 2026-A"
  program_notes?: string;            // Program-specific notes / conditions

  // ── Supervisor ────────────────────────────────────────────────────────────
  supervisor_name?: string;
  supervisor_title?: string;
  supervisor_department?: string;

  // ── Duties & Learning Objectives ─────────────────────────────────────────
  duties_and_responsibilities?: string;  // Newline-separated duties
  learning_objectives?: string;          // What the intern will gain

  // ── Compensation (primarily unpaid) ──────────────────────────────────────
  /** false = fully unpaid internship (default & compliant) */
  is_paid: boolean;
  stipend_amount?: number;               // Monthly stipend amount (0 or omit if unpaid)
  stipend_currency?: string;             // Defaults to "INR"
  reimbursement_details?: string;        // e.g. "Travel & meal reimbursement up to ₹2,000/month"

  // ── Working Hours ─────────────────────────────────────────────────────────
  working_hours_start?: string;
  working_hours_end?: string;
  working_days?: string;

  // ── Reporting & Location ─────────────────────────────────────────────────
  reporting_to?: string;
  work_location?: string;
  work_location_type?: 'onsite' | 'hybrid' | 'remote';

  // ── Signatory ────────────────────────────────────────────────────────────
  signatory_name?: string;
  signatory_designation?: string;
  signatory_contact?: string;

  // ── Legal & Compliance ───────────────────────────────────────────────────
  legal_disclaimer?: string;            // Auto-inserted if omitted
  confidentiality_clause?: boolean;     // Include NDA/confidentiality section
  ip_assignment_clause?: boolean;       // Include IP assignment clause
  ip_clause_text?: string;
  asset_clause_text?: string;
  jurisdiction?: string;
  acceptance_section?: boolean;
  terms_and_conditions?: string;
  other_details?: string;

  // ── Version Control ───────────────────────────────────────────────────────
  version_meta?: DocumentVersionMeta;
}

// ─── ITWala Academy Internship – Experience Certificate Data ─────────────────
export interface InternExperienceCertificateData {
  // ── Core / inherited from ExperienceCertificateData ──────────────────────
  employee_name: string;
  designation: string;               // Role held during internship
  department?: string;
  date_of_joining: string;
  last_working_date: string;
  period_of_employment?: string;     // Auto-calculated if omitted
  conduct_note?: string;
  performance_note?: string;
  issued_date?: string;
  signatory_name?: string;
  signatory_designation?: string;
  contact_details?: string;

  // ── Program Metadata ──────────────────────────────────────────────────────
  program_name: string;              // e.g. "ITWala Academy Internship Program"
  program_batch?: string;            // e.g. "Batch 2026-A"
  internship_type?: string;          // e.g. "Software Development Internship"

  // ── Achievements & Skills ─────────────────────────────────────────────────
  projects_worked_on?: string;
  key_achievements?: string;
  skills_acquired?: string;

  // ── Rating ────────────────────────────────────────────────────────────────
  overall_rating?: 'excellent' | 'good' | 'satisfactory';

  // ── Supervisor ────────────────────────────────────────────────────────────
  supervisor_name?: string;
  supervisor_title?: string;

  // ── Compensation Reference ────────────────────────────────────────────────
  was_paid?: boolean;
  stipend_details?: string;

  // ── Legal ─────────────────────────────────────────────────────────────────
  legal_disclaimer?: string;
  ip_clause_text?: string;
  asset_clause_text?: string;
  jurisdiction?: string;

  // ── Version Control ───────────────────────────────────────────────────────
  version_meta?: DocumentVersionMeta;
}

export interface EmploymentDocument {
  id: string;
  employee_id: string;
  document_type: DocumentType;
  document_number: string;
  document_date: string;
  document_data: any; // JSON data specific to document type
  purpose?: string;
  valid_until?: string;
  status: DocumentStatus;
  pdf_url?: string;
  storage_path?: string; // Path to PDF in Supabase storage
  pdf_generated_at?: string;
  generated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TDSRecord {
  id: string;
  employee_id: string;
  financial_year: string;
  quarter?: number;
  month?: number;
  gross_salary: number;
  standard_deduction: number;
  hra_exemption: number;
  section_80c_deduction: number;
  other_deductions: number;
  taxable_income: number;
  tax_on_income: number;
  surcharge: number;
  education_cess: number;
  total_tax: number;
  tds_deducted: number;
  challan_number?: string;
  deposit_date?: string;
  bsr_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HRDocumentSettings {
  id: string;
  offer_letter_prefix: string;
  offer_letter_number_format: string;
  offer_letter_current_number: number;
  offer_letter_template?: string;
  salary_cert_prefix: string;
  salary_cert_number_format: string;
  salary_cert_current_number: number;
  salary_cert_template?: string;
  form16_financial_year_start_month: number;
  form16_current_financial_year?: string;
  signatory_name?: string;
  signatory_designation?: string;
  signatory_signature_url?: string;
  company_tan?: string;
  company_pan?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Specific document data types
export interface OfferLetterData {
  // Basic Details
  position: string;
  department: string;
  joining_date: string;
  offer_date?: string;
  candidate_address?: string;
  
  // Position Details
  reporting_to?: string;
  work_location?: string;
  work_location_type?: 'onsite' | 'hybrid' | 'remote';
  employment_type?: string;
  
  // Roles and Responsibilities (editable by admin)
  roles_responsibilities?: string;
  
  // Compensation
  salary_breakdown: {
    basic: number;
    hra: number;
    special_allowance: number;
    other_allowances: number;
    gross_salary: number;
  };
  annual_ctc: number;
  salary_payment_note?: string;
  benefits_note?: string;
  
  // Working Hours (editable)
  working_hours_start?: string;
  working_hours_end?: string;
  working_days?: string;
  additional_hours_note?: string;
  
  // Probation & Notice
  probation_period?: number;
  probation_note?: string;
  notice_period?: number;
  
  // Leave and Holidays
  leave_policy_note?: string;
  
  // Confidentiality
  confidentiality_note?: string;
  
  // Termination
  termination_note?: string;
  
  // Acceptance Section
  acceptance_section?: boolean;
  
  // Signatory Details
  signatory_name?: string;
  signatory_designation?: string;
  signatory_contact?: string;
  
  // Additional Content
  benefits?: string[];
  terms_and_conditions?: string;
  other_details?: string;

  // IP & Asset Management and Jurisdiction
  ip_clause_text?: string;
  asset_clause_text?: string;
  jurisdiction?: string;
}

export interface SalaryCertificateData {
  purpose: string;
  period_from: string;
  period_to: string;
  salary_breakdown: {
    basic: number;
    hra: number;
    special_allowance: number;
    other_allowances: number;
    gross_monthly: number;
  };
  annual_gross: number;
  deductions?: {
    pf?: number;
    esic?: number;
    tds?: number;
    other?: number;
  };
  net_salary?: number;
}

export interface Form16Data {
  financial_year: string;
  employee: {
    name: string;
    pan: string;
    address: string;
  };
  employer: {
    name: string;
    tan: string;
    pan: string;
    address: string;
  };
  salary_details: {
    gross_salary: number;
    allowances: number;
    perquisites: number;
    profits_in_lieu: number;
  };
  deductions: {
    standard_deduction: number;
    entertainment_allowance: number;
    professional_tax: number;
  };
  chapter_vi_deductions: {
    section_80c: number;
    section_80d: number;
    other: number;
  };
  income_chargeable: number;
  tax_computed: number;
  relief_under_89: number;
  tax_payable: number;
  tds_deducted: number;
}

export interface Form24QData {
  quarter: number;
  financial_year: string;
  employees: Array<{
    employee_id: string;
    employee_name: string;
    pan: string;
    tds_deducted: number;
    challan_details: {
      challan_number: string;
      deposit_date: string;
      bsr_code: string;
    };
  }>;
  total_tds: number;
  employer: {
    name: string;
    tan: string;
    pan: string;
  };
}

export interface ExperienceCertificateData {
  employee_name: string;
  designation: string;
  department?: string;
  date_of_joining: string;
  last_working_date: string;
  period_of_employment?: string; // Auto-calculated
  roles_responsibilities?: string;
  performance_note?: string;
  conduct_note?: string;
  reason_for_leaving?: string;
  issued_date?: string;
  signatory_name?: string;
  signatory_designation?: string;
  contact_details?: string;

  // IP & Asset Management and Jurisdiction
  ip_clause_text?: string;
  asset_clause_text?: string;
  jurisdiction?: string;
}

export interface RelievingLetterData {
  employee_name: string;
  employee_number: string;
  designation: string;
  department?: string;
  date_of_joining: string;
  last_working_date: string;
  relieving_date: string;
  resignation_date?: string;
  notice_period_served?: string;
  handover_completion?: boolean;
  assets_returned?: boolean;
  dues_cleared?: boolean;
  notice_text?: string;
  issued_date?: string;
  signatory_name?: string;
  signatory_designation?: string;
  contact_details?: string;

  // IP & Asset Management and Jurisdiction
  ip_clause_text?: string;
  asset_clause_text?: string;
  jurisdiction?: string;
}

export interface EmployeeStats {
  total_employees: number;
  active_employees: number;
  employees_on_leave: number;
  resigned_employees: number;
  terminated_employees: number;
  fulltime_employees: number;
  contract_employees: number;
  joined_this_month: number;
}

export interface EmployeeNote {
  id: string;
  employee_id: string;
  note_text: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeNoteInput {
  employee_id: string;
  note_text: string;
  created_by_name: string;
}

// Salary Slip Types
export type SalarySlipStatus = 'draft' | 'approved' | 'paid' | 'cancelled';

export interface SalarySlip {
  id: string;
  employee_id: string;
  salary_month: number;
  salary_year: number;
  financial_year: string;

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

  // Deductions
  provident_fund: number;
  professional_tax: number;
  esic: number;
  tds: number;
  loan_repayment: number;
  other_deductions: number;
  total_deductions: number;

  // Net Salary
  net_salary: number;

  // Tax Information
  ytd_gross: number;
  ytd_tds: number;
  projected_annual_income: number;
  annual_tax_liability: number;

  // Attendance
  working_days: number;
  paid_days: number;
  lop_days: number;
  leaves_taken: number;

  // Status and tracking
  status: SalarySlipStatus;
  email_sent: boolean;
  email_sent_at?: string;
  email_sent_to?: string;

  // Payment
  payment_date?: string;
  payment_mode?: string;
  payment_reference?: string;

  // Metadata
  generated_by?: string;
  approved_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSalarySlipInput {
  employee_id: string;
  salary_month: number;
  salary_year: number;
  working_days?: number;
  paid_days?: number;
  lop_days?: number;
  leaves_taken?: number;
  bonus?: number;
  overtime?: number;
  loan_repayment?: number;
  other_deductions?: number;
  tax_regime?: 'old' | 'new';

  // Optional overrides
  basic_salary?: number;
  hra?: number;
  special_allowance?: number;
  transport_allowance?: number;
  medical_allowance?: number;
  other_allowances?: number;
}

// Full & Final Settlement Types
export type SettlementStatus = 'draft' | 'pending_approval' | 'approved' | 'paid' | 'cancelled';

export interface FullFinalSettlement {
  id: string;
  employee_id: string;

  // Employee Details (denormalized for record keeping)
  employee_number: string;
  employee_name: string;
  designation: string;
  department?: string;
  date_of_joining: string;
  date_of_leaving: string;
  relieving_date: string;
  reason_for_leaving?: string;

  // Settlement Period
  settlement_month: number;
  settlement_year: number;
  last_working_day: string;
  notice_period_days: number;
  notice_period_served: number;
  notice_period_shortfall: number;

  // Salary Components (Dues)
  pending_salary_days: number;
  pending_salary_amount: number;
  earned_leave_days: number;
  earned_leave_encashment: number;
  bonus_amount: number;
  incentive_amount: number;
  gratuity_amount: number;
  notice_pay_recovery: number;
  other_dues: number;
  total_dues: number;

  // Deductions (Recoveries)
  advance_recovery: number;
  loan_recovery: number;
  notice_period_recovery: number;
  asset_recovery: number;
  other_recoveries: number;
  total_recoveries: number;

  // Net Settlement
  gross_settlement: number;
  tax_deduction: number;
  net_settlement: number;

  // Assets & Clearance
  assets_returned: boolean;
  asset_clearance_remarks?: string;
  no_dues_certificate_issued: boolean;

  // Payment Details
  payment_mode?: string;
  payment_reference?: string;
  payment_date?: string;

  // Approval Workflow
  status: SettlementStatus;
  prepared_by?: string;
  approved_by?: string;
  approved_at?: string;

  // Documents
  pdf_url?: string;
  pdf_generated_at?: string;

  // Remarks
  remarks?: string;

  // Metadata
  created_at?: string;
  updated_at?: string;
}

export interface CreateSettlementInput {
  employee_id: string;
  date_of_leaving: string;
  relieving_date: string;
  last_working_day: string;
  reason_for_leaving?: string;
  notice_period_days: number;
  notice_period_served: number;

  // Optional custom amounts
  bonus_amount?: number;
  incentive_amount?: number;
  gratuity_amount?: number;
  advance_recovery?: number;
  loan_recovery?: number;
  asset_recovery?: number;
  other_dues?: number;
  other_recoveries?: number;

  // Clearance
  assets_returned?: boolean;
  asset_clearance_remarks?: string;
  remarks?: string;
}

// ============================================
// EMPLOYEE MANAGEMENT SYSTEM TYPES
// ============================================

// Attendance Types
export type AttendanceStatus = 'present' | 'absent' | 'half-day' | 'on-leave' | 'holiday' | 'week-off';

export interface Attendance {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time?: string;
  check_out_time?: string;
  breaks?: any; // jsonb
  total_hours?: number;
  work_hours?: number;
  break_hours?: number;
  overtime_hours?: number;
  status: AttendanceStatus;
  check_in_location?: string;
  check_out_location?: string;
  check_in_ip?: string;
  remarks?: string;
  is_regularized?: boolean;
  regularized_by?: string;
  regularized_at?: string;
  regularization_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceSummary {
  total_days: number;
  present_days: number;
  absent_days: number;
  half_days: number;
  leaves: number;
  work_from_home: number;
  attendance_percentage: number;
  employee_id?: string;
  month?: number;
  year?: number;
  total_working_days?: number;
  days_present?: number;
  days_absent?: number;
  days_half_day?: number;
  days_on_leave?: number;
}

export interface AttendanceFilter {
  employee_id?: string;
  from_date?: string;
  to_date?: string;
  status?: AttendanceStatus;
  limit?: number;
  offset?: number;
}

// Leave Types
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveType {
  id: string;
  name: string;
  description?: string;
  annual_limit: number;
  is_paid: boolean;
  requires_approval: boolean;
  color_code: string;
  created_at?: string;
  updated_at?: string;
}

export interface Leave {
  id: string;
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  half_day?: boolean;
  total_days: number;
  reason: string;
  contact_during_leave?: string;
  status: LeaveStatus;
  applied_by: string;
  applied_at: string;
  approved_by?: string;
  approved_at?: string;
  approval_remarks?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeaveAllocation {
  id: string;
  employee_id: string;
  leave_type_id: string;
  financial_year: number;
  allocated_days: number;
  used_days: number;
  carried_forward_days: number;
  created_at?: string;
  updated_at?: string;
}

export interface LeaveRequest {
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  half_day?: boolean;
  reason: string;
  contact_during_leave?: string;
}

export interface LeaveFilter {
  employee_id?: string;
  leave_type_id?: string;
  status?: LeaveStatus;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

// Document Types for Employee Management
export type DocumentVerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: string;
  document_name: string;
  document_description?: string;
  document_url?: string;
  document_path?: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_bucket?: string;
  storage_path: string;
  verification_status: DocumentVerificationStatus;
  verified_by?: string;
  verification_date?: string;
  expiry_date?: string;
  verification_comments?: string;
  uploaded_by: string;
  uploaded_at?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentUploadFormData {
  employee_id: string;
  document_type: string;
  document_name: string;
  file: File;
  expiry_date?: string;
}

export interface QueuedDocument {
  id: string;
  document_type: string;
  document_name: string;
  document_description?: string;
  expiry_date?: string;
  file: File;
  previewUrl: string;
}

// Salary Structure and Slip for Employee Management
export interface SalaryStructure {
  id: string;
  employee_id: string;
  effective_from: string;
  base_salary: number;
  hra_percentage: number;
  dearness_allowance_percentage: number;
  other_allowances: number;
  pf_percentage: number;
  esi_percentage: number;
  created_at?: string;
  updated_at?: string;
}

// Enhanced SalarySlip with employee management fields
export interface EmployeeSalarySlip extends SalarySlip {
  days_present: number;
  working_days: number;
  attendance_percentage: number;
}

// Salary Summary for dashboard
export interface SalarySummary {
  total_slips: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  average_gross: number;
  average_net: number;
  highest_net: number;
  lowest_net: number;
}
