import { supabase } from '../config/supabase'
import { auditLogService } from './auditLogService'
import type {
  Employee,
  EmploymentDocument,
  TDSRecord,
  HRDocumentSettings,
  EmployeeStats,
  DocumentType,
  SalarySlip,
  CreateSalarySlipInput
} from '../types/employee'
import {
  calculateProvidentFund,
  calculateProfessionalTax,
  calculateESIC,
  calculateMonthlyTDS,
  getFinancialYear,
  getFinancialYearMonth
} from '../utils/indianTaxCalculator'
import { compensationService } from './compensationService'

export const employeeService = {
  // =============== Employee CRUD Operations ===============

  // Resolves whether an entity is the Ireland (IRL) legal entity, for entity-aware ID/number generation
  async resolveEmployeeEntity(companySettingsId?: string): Promise<{ isIrish: boolean; entityCode: 'IND' | 'IRL' }> {
    if (!companySettingsId) return { isIrish: false, entityCode: 'IND' };
    const { data: company } = await supabase
      .from('company_settings')
      .select('cro_number, vat_number, country:countries(code)')
      .eq('id', companySettingsId)
      .maybeSingle();
    const countryCode = ((company as any)?.country?.code || '').toUpperCase();
    const isIrish = countryCode === 'IE' || countryCode === 'IRL' || !!(company as any)?.cro_number || !!(company as any)?.vat_number;
    return { isIrish, entityCode: isIrish ? 'IRL' : 'IND' };
  },

  async getEmployees(company_settings_id?: string): Promise<Employee[]> {
    let query = supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false })

    if (company_settings_id) {
      query = query.eq('company_settings_id', company_settings_id);
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching employees:', error)
      throw error
    }

    return data || []
  },

  async getActiveEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('employment_status', 'active')
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Error fetching active employees:', error)
      throw error
    }

    return data || []
  },

  async getEmployeeById(id: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching employee:', error)
      throw error
    }

    return data
  },

  async getEmployeeByNumber(employeeNumber: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('employee_number', employeeNumber)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching employee by number:', error)
      throw error
    }

    return data
  },

  async createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
    // Calculate gross salary
    const gross_salary =
      (employee.basic_salary || 0) +
      (employee.hra || 0) +
      (employee.special_allowance || 0) +
      (employee.other_allowances || 0)

    const company_settings_id = employee.company_settings_id || employee.company_setting_id || null;
    const payload = {
      ...employee,
      company_settings_id,
      gross_salary
    };
    delete (payload as any).company_setting_id;

    const { data, error } = await supabase
      .from('employees')
      .insert([payload])
      .select()
      .single()

    if (error) {
      console.error('Error creating employee:', error)
      throw error
    }

    return data
  },

  async updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee> {
    // Recalculate gross salary if any salary components are updated
    if (employee.basic_salary !== undefined ||
        employee.hra !== undefined ||
        employee.special_allowance !== undefined ||
        employee.other_allowances !== undefined) {

      const current = await this.getEmployeeById(id)
      if (current) {
        employee.gross_salary =
          (employee.basic_salary ?? current.basic_salary) +
          (employee.hra ?? current.hra ?? 0) +
          (employee.special_allowance ?? current.special_allowance ?? 0) +
          (employee.other_allowances ?? current.other_allowances ?? 0)
      }
    }

    const payload = { ...employee };
    if (payload.company_setting_id && !payload.company_settings_id) {
      payload.company_settings_id = payload.company_setting_id;
    }
    delete (payload as any).company_setting_id;

    const { data, error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating employee:', error)
      throw error
    }

    return data
  },

  async deleteEmployee(id: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting employee:', error)
      throw error
    }
  },

  async getEmployeeStats(): Promise<EmployeeStats> {
    const { data, error } = await supabase
      .from('employee_stats_view')
      .select('*')
      .single()

    if (error) {
      console.error('Error fetching employee stats:', error)
      throw error
    }

    return data || {
      total_employees: 0,
      active_employees: 0,
      employees_on_leave: 0,
      resigned_employees: 0,
      terminated_employees: 0,
      fulltime_employees: 0,
      contract_employees: 0,
      joined_this_month: 0
    }
  },

  // =============== Employment Document Operations ===============

  async getEmploymentDocuments(employeeId?: string): Promise<EmploymentDocument[]> {
    // Query employment_documents table (admin-generated docs like offer letters)
    let query = supabase
      .from('employment_documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching employment documents:', error)
      throw error
    }

    return data || []
  },

  async getAllEmployeeDocuments(employeeId?: string): Promise<any[]> {
    // Query unified view that combines both employee uploads and admin documents
    try {
      let query = supabase
        .from('employee_documents_unified')
        .select('*')
        .order('created_at', { ascending: false })

      if (employeeId) {
        query = query.eq('employee_id', employeeId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching from unified view:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        
        // Fallback: If view doesn't exist, fetch from both tables separately
        console.log('Falling back to separate queries...')
        const [uploads, generated] = await Promise.all([
          this.getEmployeeUploadedDocuments(employeeId),
          this.getEmploymentDocuments(employeeId)
        ])
        
        // Combine with source indicator
        const combined = [
          ...uploads.map(doc => ({ ...doc, document_source: 'employee_upload' })),
          ...generated.map(doc => ({ ...doc, document_source: 'admin_generated' }))
        ]
        
        // Sort by created_at descending
        return combined.sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
      }

      return data || []
    } catch (error) {
      console.error('Exception in getAllEmployeeDocuments:', error)
      // Fallback to separate queries
      try {
        const [uploads, generated] = await Promise.all([
          this.getEmployeeUploadedDocuments(employeeId),
          this.getEmploymentDocuments(employeeId)
        ])
        
        const combined = [
          ...uploads.map(doc => ({ ...doc, document_source: 'employee_upload' })),
          ...generated.map(doc => ({ ...doc, document_source: 'admin_generated' }))
        ]
        
        return combined.sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError)
        throw fallbackError
      }
    }
  },

  async getEmployeeUploadedDocuments(employeeId?: string): Promise<any[]> {
    // Query employee_documents table (employee-uploaded docs)
    let query = supabase
      .from('employee_documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching employee documents:', error)
      throw error
    }

    return data || []
  },

  async getDocumentsByType(documentType: DocumentType): Promise<EmploymentDocument[]> {
    const { data, error } = await supabase
      .from('employment_documents')
      .select('*')
      .eq('document_type', documentType)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching documents by type:', error)
      throw error
    }

    return data || []
  },

  async createEmploymentDocument(doc: Omit<EmploymentDocument, 'id' | 'created_at' | 'updated_at'>): Promise<EmploymentDocument> {
    const { data, error } = await supabase
      .from('employment_documents')
      .insert([doc])
      .select()
      .single()

    if (error) {
      console.error('Error creating employment document:', error)
      throw error
    }

    return data
  },

  async updateEmploymentDocument(id: string, doc: Partial<EmploymentDocument>): Promise<EmploymentDocument> {
    const { data, error } = await supabase
      .from('employment_documents')
      .update(doc)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating employment document:', error)
      throw error
    }

    return data
  },

  async deleteEmploymentDocument(id: string): Promise<void> {
    // Get document details first to access storage_path
    const { data: document, error: fetchError } = await supabase
      .from('employment_documents')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching document for deletion:', fetchError)
      throw fetchError
    }

    // Delete from storage if storage_path exists
    if (document?.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('employee-documents')
        .remove([document.storage_path])

      if (storageError) {
        console.error('Storage delete error:', storageError)
        throw new Error(`Failed to delete file from storage: ${storageError.message}`)
      }
    }

    // Delete from database
    const { error } = await supabase
      .from('employment_documents')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting employment document:', error)
      throw error
    }
  },

  // =============== TDS Record Operations ===============

  async getTDSRecords(employeeId?: string, financialYear?: string): Promise<TDSRecord[]> {
    let query = supabase
      .from('tds_records')
      .select('*')
      .order('created_at', { ascending: false })

    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }

    if (financialYear) {
      query = query.eq('financial_year', financialYear)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching TDS records:', error)
      throw error
    }

    return data || []
  },

  async createTDSRecord(record: Omit<TDSRecord, 'id' | 'created_at' | 'updated_at'>): Promise<TDSRecord> {
    const { data, error } = await supabase
      .from('tds_records')
      .insert([record])
      .select()
      .single()

    if (error) {
      console.error('Error creating TDS record:', error)
      throw error
    }

    return data
  },

  async updateTDSRecord(id: string, record: Partial<TDSRecord>): Promise<TDSRecord> {
    const { data, error } = await supabase
      .from('tds_records')
      .update(record)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating TDS record:', error)
      throw error
    }

    return data
  },

  // =============== HR Document Settings ===============

  async getHRDocumentSettings(): Promise<HRDocumentSettings | null> {
    const { data, error } = await supabase
      .from('hr_document_settings')
      .select('*')
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching HR document settings:', error)
      throw error
    }

    return data
  },

  async updateHRDocumentSettings(settings: Partial<HRDocumentSettings>): Promise<HRDocumentSettings> {
    const current = await this.getHRDocumentSettings()

    if (!current) {
      throw new Error('HR document settings not found')
    }

    const { data, error } = await supabase
      .from('hr_document_settings')
      .update(settings)
      .eq('id', current.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating HR document settings:', error)
      throw error
    }

    return data
  },

  // =============== Salary Slip Operations ===============

  async getSalarySlips(employeeId?: string, month?: number, year?: number): Promise<SalarySlip[]> {
    let query = supabase
      .from('salary_slips')
      .select('*')
      .order('salary_year', { ascending: false })
      .order('salary_month', { ascending: false })

    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }

    if (month) {
      query = query.eq('salary_month', month)
    }

    if (year) {
      query = query.eq('salary_year', year)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching salary slips:', error)
      throw error
    }

    return data || []
  },

  async getSalarySlipById(id: string): Promise<SalarySlip | null> {
    const { data, error } = await supabase
      .from('salary_slips')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching salary slip:', error)
      throw error
    }

    return data
  },

  async generateSalarySlip(input: CreateSalarySlipInput): Promise<Omit<SalarySlip, 'id' | 'created_at' | 'updated_at'>> {
    // Get employee details
    const employee = await this.getEmployeeById(input.employee_id)
    if (!employee) {
      throw new Error('Employee not found')
    }

    // Calculate financial year
    const financialYear = getFinancialYear(new Date(input.salary_year, input.salary_month - 1))

    // Read salary components from employee_compensation table (managed via Compensation Management).
    // A current compensation record MUST exist before generating a salary slip.
    const compensation = await compensationService.getCurrentCompensation(input.employee_id)
    if (!compensation) {
      throw new Error(
        `No compensation record found for employee "${employee.full_name}". ` +
        `Please set up their salary structure in Compensation Management before generating a salary slip.`
      )
    }

    const basicSalary        = input.basic_salary         ?? compensation.basic_salary
    const hra                = input.hra                   ?? compensation.hra                   ?? 0
    const specialAllowance   = input.special_allowance    ?? compensation.special_allowance      ?? 0
    const transportAllowance = input.transport_allowance  ?? compensation.transport_allowance    ?? 0
    const medicalAllowance   = input.medical_allowance    ?? compensation.medical_allowance      ?? 0
    const otherAllowances    = input.other_allowances     ?? compensation.other_allowances       ?? 0

    // Deductions from compensation record
    const compPF  = compensation.pf_contribution  ?? 0
    const compESI = compensation.esi_contribution ?? 0
    const compPT  = compensation.professional_tax ?? 0
    const compTDS = compensation.tds              ?? 0
    const bonus = input.bonus ?? 0
    const overtime = input.overtime ?? 0

    // Calculate working days and paid days
    const workingDays = input.working_days ?? 26
    const lopDays = input.lop_days ?? 0
    const paidDays = input.paid_days ?? (workingDays - lopDays)
    const leavesTaken = input.leaves_taken ?? lopDays

    // Prorate salary based on paid days
    const salaryMultiplier = paidDays / workingDays

    const proratedBasic = basicSalary * salaryMultiplier
    const proratedHRA = hra * salaryMultiplier
    const proratedSpecial = specialAllowance * salaryMultiplier
    const proratedTransport = transportAllowance * salaryMultiplier
    const proratedMedical = medicalAllowance * salaryMultiplier
    const proratedOther = otherAllowances * salaryMultiplier

    // Calculate gross salary
    const grossSalary =
      proratedBasic +
      proratedHRA +
      proratedSpecial +
      proratedTransport +
      proratedMedical +
      proratedOther +
      bonus +
      overtime

    // Calculate deductions
    const providentFund = calculateProvidentFund(proratedBasic)
    const professionalTax = calculateProfessionalTax(grossSalary)
    const esic = calculateESIC(grossSalary)

    // Get previous slips for YTD calculation
    const previousSlips = await this.getSalarySlips(
      input.employee_id,
      undefined,
      input.salary_year
    )

    // Calculate YTD (Year to Date)
    const ytdGross = previousSlips
      .filter(slip => slip.salary_month < input.salary_month)
      .reduce((sum, slip) => sum + slip.gross_salary, 0) + grossSalary

    const ytdTDS = previousSlips
      .filter(slip => slip.salary_month < input.salary_month)
      .reduce((sum, slip) => sum + slip.tds, 0)

    // Calculate TDS
    const monthNumber = getFinancialYearMonth(new Date(input.salary_year, input.salary_month - 1))
    const tds = calculateMonthlyTDS(
      grossSalary,
      input.tax_regime || 'new',
      monthNumber,
      ytdTDS,
      0, // HRA exemption calculation can be added
      {} // Deductions can be added
    )

    // Total deductions
    const loanRepayment = input.loan_repayment ?? 0
    const otherDeductions = input.other_deductions ?? 0
    const totalDeductions = providentFund + professionalTax + esic + tds + loanRepayment + otherDeductions

    // Net salary
    const netSalary = grossSalary - totalDeductions

    // Projected annual income and tax
    const remainingMonths = 12 - monthNumber
    const projectedAnnualIncome = ytdGross + (grossSalary * remainingMonths)
    const annualTaxLiability = tds * 12 // Simplified

    // Create salary slip
    const salarySlip: Omit<SalarySlip, 'id' | 'created_at' | 'updated_at'> = {
      employee_id: input.employee_id,
      salary_month: input.salary_month,
      salary_year: input.salary_year,
      financial_year: financialYear,

      basic_salary: Math.round(proratedBasic),
      hra: Math.round(proratedHRA),
      special_allowance: Math.round(proratedSpecial),
      transport_allowance: Math.round(proratedTransport),
      medical_allowance: Math.round(proratedMedical),
      other_allowances: Math.round(proratedOther),
      bonus: Math.round(bonus),
      overtime: Math.round(overtime),
      gross_salary: Math.round(grossSalary),

      provident_fund: Math.round(providentFund),
      professional_tax: Math.round(professionalTax),
      esic: Math.round(esic),
      tds: Math.round(tds),
      loan_repayment: Math.round(loanRepayment),
      other_deductions: Math.round(otherDeductions),
      total_deductions: Math.round(totalDeductions),

      net_salary: Math.round(netSalary),

      ytd_gross: Math.round(ytdGross),
      ytd_tds: Math.round(ytdTDS + tds),
      projected_annual_income: Math.round(projectedAnnualIncome),
      annual_tax_liability: Math.round(annualTaxLiability),

      working_days: workingDays,
      paid_days: paidDays,
      lop_days: lopDays,
      leaves_taken: leavesTaken,

      status: 'draft',
      email_sent: false
    }

    return salarySlip
  },

  async saveSalarySlip(salarySlipData: Omit<SalarySlip, 'id' | 'created_at' | 'updated_at'>): Promise<SalarySlip> {
    // Check if a salary slip already exists for this employee/month/year
    const { data: existing } = await supabase
      .from('salary_slips')
      .select('id')
      .eq('employee_id', salarySlipData.employee_id)
      .eq('salary_month', salarySlipData.salary_month)
      .eq('salary_year', salarySlipData.salary_year)
      .single()

    if (existing) {
      // Update existing slip
      const { data, error } = await supabase
        .from('salary_slips')
        .update(salarySlipData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating salary slip:', error)
        throw error
      }

      return data
    }

    // Insert new slip
    const { data, error } = await supabase
      .from('salary_slips')
      .insert([salarySlipData])
      .select()
      .single()

    if (error) {
      console.error('Error creating salary slip:', error)
      throw error
    }

    return data
  },

  async updateSalarySlip(id: string, updates: Partial<SalarySlip>): Promise<SalarySlip> {
    const { data, error } = await supabase
      .from('salary_slips')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating salary slip:', error)
      throw error
    }

    return data
  },

  async deleteSalarySlip(id: string): Promise<void> {
    const { error } = await supabase
      .from('salary_slips')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting salary slip:', error)
      throw error
    }
  },

  async approveSalarySlip(id: string, approvedBy: string): Promise<SalarySlip> {
    return this.updateSalarySlip(id, {
      status: 'approved',
      approved_by: approvedBy
    })
  },

  async markSalarySlipAsPaid(
    id: string,
    paymentDate: string,
    paymentMode: string,
    paymentReference?: string
  ): Promise<SalarySlip> {
    return this.updateSalarySlip(id, {
      status: 'paid',
      payment_date: paymentDate,
      payment_mode: paymentMode,
      payment_reference: paymentReference
    })
  },

  async markSalarySlipEmailSent(id: string, emailSentTo: string): Promise<SalarySlip> {
    return this.updateSalarySlip(id, {
      email_sent: true,
      email_sent_at: new Date().toISOString(),
      email_sent_to: emailSentTo
    })
  },

  // =============== Document Number Generation ===============

  async generateDocumentNumber(documentType: DocumentType, companySettingsId?: string): Promise<string> {
    const settings = await this.getHRDocumentSettings()

    if (!settings) {
      throw new Error('HR document settings not configured')
    }

    let prefix: string
    let format: string
    let currentNumber: number
    let settingsUpdate: Partial<HRDocumentSettings>

    switch (documentType) {
      case 'offer_letter':
        prefix = settings.offer_letter_prefix
        format = settings.offer_letter_number_format
        currentNumber = settings.offer_letter_current_number
        settingsUpdate = { offer_letter_current_number: currentNumber + 1 }
        break
      case 'salary_certificate':
        prefix = settings.salary_cert_prefix
        format = settings.salary_cert_number_format
        currentNumber = settings.salary_cert_current_number
        settingsUpdate = { salary_cert_current_number: currentNumber + 1 }
        break
      case 'intern_offer_letter':
        prefix = 'INT-OL'
        format = settings.offer_letter_number_format
        currentNumber = settings.offer_letter_current_number
        settingsUpdate = { offer_letter_current_number: currentNumber + 1 }
        break
      case 'intern_experience_certificate':
        prefix = 'INT-EC'
        format = settings.offer_letter_number_format
        currentNumber = settings.offer_letter_current_number
        settingsUpdate = { offer_letter_current_number: currentNumber + 1 }
        break
      case 'experience_certificate':
        prefix = 'EXP'
        format = settings.offer_letter_number_format
        currentNumber = settings.offer_letter_current_number
        settingsUpdate = { offer_letter_current_number: currentNumber + 1 }
        break
      case 'relieving_letter':
        prefix = 'REL'
        format = settings.offer_letter_number_format
        currentNumber = settings.offer_letter_current_number
        settingsUpdate = { offer_letter_current_number: currentNumber + 1 }
        break
      case 'form_16':
        prefix = 'F16'
        format = settings.offer_letter_number_format
        currentNumber = settings.offer_letter_current_number
        settingsUpdate = { offer_letter_current_number: currentNumber + 1 }
        break
      case 'form_24q':
        prefix = 'F24Q'
        format = settings.offer_letter_number_format
        currentNumber = settings.offer_letter_current_number
        settingsUpdate = { offer_letter_current_number: currentNumber + 1 }
        break
      default:
        prefix = 'DOC'
        format = settings.offer_letter_number_format
        currentNumber = settings.offer_letter_current_number
        settingsUpdate = { offer_letter_current_number: currentNumber + 1 }
    }

    // Ireland entity documents embed IRL into the prefix (e.g. OL/IRL/2026/09/001) and get their own independent sequence
    const { isIrish } = await this.resolveEmployeeEntity(companySettingsId);
    const entityPrefix = isIrish ? `${prefix}/IRL` : prefix;

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')

    const skeleton = format
      .replace('PREFIX', entityPrefix)
      .replace('YYYY', String(year))
      .replace('MM', month)
    const [searchPrefix] = skeleton.split('###')

    // Scan existing document numbers sharing this entity/period prefix to derive the next unique sequence
    const { data: existingDocs } = await supabase
      .from('employment_documents')
      .select('document_number')
      .ilike('document_number', `${searchPrefix}%`)

    let maxNum = 0
    for (const doc of existingDocs || []) {
      const docNumber = doc.document_number as string
      if (!docNumber.startsWith(searchPrefix)) continue
      const num = parseInt(docNumber.substring(searchPrefix.length), 10)
      if (!isNaN(num) && num > maxNum) maxNum = num
    }

    const documentNumber = `${searchPrefix}${String(maxNum + 1).padStart(3, '0')}`

    // Keep the legacy running counter updated for backward compatibility
    if (Object.keys(settingsUpdate).length > 0) {
      await this.updateHRDocumentSettings(settingsUpdate)
    }

    return documentNumber
  },

  // =============== Employee ID Generation ===============

  async generateEmployeeId(department: string, companySettingsId?: string): Promise<string> {
    const prefixMap: Record<string, string> = {
      'ITwala': 'ITW',
      'Kdadks': 'KDA',
      'Nirchal': 'NIR',
      'Ayuh Clinic': 'AYU',
    };
    const deptPrefix = prefixMap[department] || department.substring(0, 3).toUpperCase();

    // Ireland entity employee IDs embed IRL (e.g. KDA-IRL-000001) and keep their own independent sequence
    const { isIrish } = await this.resolveEmployeeEntity(companySettingsId);
    const prefix = isIrish ? `${deptPrefix}-IRL` : deptPrefix;
    const searchPrefix = `${prefix}-`;

    let query = supabase
      .from('employees')
      .select('employee_number')
      .ilike('employee_number', `${searchPrefix}%`);
    if (companySettingsId) {
      query = query.eq('company_settings_id', companySettingsId);
    }

    const { data } = await query;

    let maxNum = 0;
    for (const emp of data || []) {
      const employeeNumber = emp.employee_number as string;
      if (!employeeNumber.startsWith(searchPrefix)) continue;
      const num = parseInt(employeeNumber.substring(searchPrefix.length), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }

    return `${prefix}-${String(maxNum + 1).padStart(6, '0')}`;
  },

  // =============== Rehire Operations ===============

  async rehireEmployee(
    employeeId: string,
    rehireData: {
      new_joining_date: string;
      designation: string;
      department: string;
      employment_type: import('../types/employee').EmploymentType;
      basic_salary: number;
      rehired_by_name: string;
    }
  ): Promise<Employee> {
    const current = await this.getEmployeeById(employeeId);
    if (!current) throw new Error('Employee not found');

    const updatePayload: Partial<Employee> = {
      employment_status: 'active',
      date_of_joining: rehireData.new_joining_date,
      date_of_leaving: undefined,
      designation: rehireData.designation,
      department: rehireData.department,
      employment_type: rehireData.employment_type,
      basic_salary: rehireData.basic_salary,
      gross_salary: rehireData.basic_salary,
      rehire_count: (current.rehire_count || 0) + 1,
      previous_joining_date: current.date_of_joining,
      previous_leaving_date: current.date_of_leaving,
      last_rehired_at: new Date().toISOString(),
      last_rehired_by: rehireData.rehired_by_name,
    };

    const updated = await this.updateEmployee(employeeId, updatePayload);

    await auditLogService.createLog({
      employee_id: employeeId,
      table_name: 'employees',
      record_id: employeeId,
      action: 'rehire',
      change_summary: `Employee rehired by ${rehireData.rehired_by_name}. New joining date: ${rehireData.new_joining_date}. Rehire count: ${updatePayload.rehire_count}`,
      performed_by_name: rehireData.rehired_by_name,
      new_value: JSON.stringify(updatePayload),
      old_value: JSON.stringify({ employment_status: current.employment_status, date_of_joining: current.date_of_joining }),
    });

    return updated;
  },

  // =============== Intern Conversion ===============

  async convertInternToEmployee(
    employeeId: string,
    employeeData: Partial<Employee>,
    convertedByName: string
  ): Promise<Employee> {
    const current = await this.getEmployeeById(employeeId);
    if (!current) throw new Error('Employee not found');
    if (current.employment_type !== 'intern') throw new Error('Employee is not an intern');

    const updatePayload: Partial<Employee> = {
      ...employeeData,
      employment_type: employeeData.employment_type || 'full-time',
      employment_status: 'active',
    };

    const updated = await this.updateEmployee(employeeId, updatePayload);

    await auditLogService.createLog({
      employee_id: employeeId,
      table_name: 'employees',
      record_id: employeeId,
      action: 'intern_conversion',
      change_summary: `Intern converted to ${updatePayload.employment_type} employee by ${convertedByName}`,
      performed_by_name: convertedByName,
      old_value: JSON.stringify({ employment_type: 'intern', designation: current.designation }),
      new_value: JSON.stringify({ employment_type: updatePayload.employment_type, designation: updatePayload.designation }),
    });

    return updated;
  },
}

export default employeeService
