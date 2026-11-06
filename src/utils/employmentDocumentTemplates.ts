/**
 * Employment Document Templates Utility
 *
 * Provides jurisdiction-aware prefilled standard templates for all HR document types:
 *   1. Offer Letter (offer_letter)
 *   2. Salary Certificate (salary_certificate)
 *   3. Experience Certificate (experience_certificate)
 *   4. Relieving Letter (relieving_letter)
 *   5. Form 16 (form_16)
 *   6. Form 24Q (form_24q)
 *   7. Internship Offer Letter (intern_offer_letter)
 *   8. Internship Experience Certificate (intern_experience_certificate)
 *
 * Includes explicit Intellectual Property (IP) assignment and Company Asset Management clauses.
 */

import type {
  Employee,
  DocumentType,
  OfferLetterData,
  SalaryCertificateData,
  ExperienceCertificateData,
  RelievingLetterData,
  Form16Data,
  Form24QData,
  InternOfferLetterData,
  InternExperienceCertificateData,
  HRDocumentSettings,
} from '../types/employee';
import type { CompanySettings } from '../types/invoice';
import type { EmployeeCompensation } from '../services/compensationService';

export interface JurisdictionInfo {
  countryCode: string;
  countryName: string;
  jurisdiction: string;
  defaultCurrency: string;
  defaultNoticePeriod: number;
  defaultProbationMonths: number;
  taxNote: string;
  statutoryBenefits: string[];
  defaultBenefitsNote: string;
}

/**
 * Resolves jurisdiction and legal defaults based on company/employee country
 */
export function getJurisdictionInfo(countryCode?: string): JurisdictionInfo {
  const code = (countryCode || 'IN').toUpperCase();

  switch (code) {
    case 'IN':
    case 'IND':
    case 'INDIA':
      return {
        countryCode: 'IN',
        countryName: 'India',
        jurisdiction: 'Republic of India (High Court Jurisdiction)',
        defaultCurrency: 'INR',
        defaultNoticePeriod: 30,
        defaultProbationMonths: 3,
        taxNote: 'Salary is subject to statutory TDS under Section 192 of the Income Tax Act, Provident Fund (EPF), Professional Tax, and ESIC as applicable.',
        statutoryBenefits: [
          "House Rent Allowance (HRA) as per Income Tax rules (40%-50% of Basic)",
          "Employees' Provident Fund (EPF) employer matching contribution (12%)",
          "Group Medical & Health Insurance coverage",
          "Gratuity entitlement under Payment of Gratuity Act",
          "Leave Travel Allowance (LTA) & Statutory Paid Leaves",
          "ESIC / Workplace Injury Compensation as applicable"
        ],
        defaultBenefitsNote: "You are entitled to statutory Indian employment benefits including House Rent Allowance (HRA), Employees' Provident Fund (EPF) matching, Group Medical Health Cover, Gratuity upon qualifying tenure, Leave Travel Allowance (LTA), and annual leave as per company policy.",
      };

    case 'IE':
    case 'IRL':
    case 'IRELAND':
      return {
        countryCode: 'IE',
        countryName: 'Ireland',
        jurisdiction: 'Republic of Ireland (Workplace Relations Commission & Irish Employment Law)',
        defaultCurrency: 'EUR',
        defaultNoticePeriod: 30,
        defaultProbationMonths: 6,
        taxNote: 'Salary is subject to PAYE income tax, PRSI, and Universal Social Charge (USC) as mandated by Irish Revenue.',
        statutoryBenefits: [
          "Pay Related Social Insurance (PRSI) Class A contribution",
          "Statutory Sick Pay (SSP) under Sick Leave Act",
          "Group PRSA / Occupational Pension scheme matching",
          "Private Medical & Health Insurance cover",
          "TaxSaver Commuter Pass & Cycle to Work scheme",
          "Statutory Paid Annual Leave (20+ days)"
        ],
        defaultBenefitsNote: "You are entitled to statutory Irish employment benefits including PRSI coverage, Statutory Sick Pay (SSP), Occupational Pension matching, Private Medical Insurance cover, TaxSaver travel benefits, and paid annual leave.",
      };

    case 'US':
    case 'USA':
    case 'UNITED STATES':
      return {
        countryCode: 'US',
        countryName: 'United States',
        jurisdiction: 'United States (Federal & State Employment Law)',
        defaultCurrency: 'USD',
        defaultNoticePeriod: 14,
        defaultProbationMonths: 3,
        taxNote: 'Salary is subject to Federal, State, and local withholdings including Social Security and Medicare (FICA).',
        statutoryBenefits: [
          "401(k) Retirement Plan with employer matching",
          "Comprehensive Medical, Dental & Vision Insurance (ACA compliant)",
          "Paid Time Off (PTO) & Federal Paid Holidays",
          "Short & Long Term Disability (STD/LTD) & Life Insurance",
          "Flexible Spending Account (FSA) / Health Savings Account (HSA)"
        ],
        defaultBenefitsNote: "You are entitled to participate in company US benefit plans including 401(k) retirement plan with employer matching, comprehensive Medical/Dental/Vision healthcare, Paid Time Off (PTO), FSA/HSA options, and Life/Disability insurance.",
      };

    case 'GB':
    case 'UK':
    case 'UNITED KINGDOM':
      return {
        countryCode: 'GB',
        countryName: 'United Kingdom',
        jurisdiction: 'United Kingdom (Employment Rights Act & UK Employment Law)',
        defaultCurrency: 'GBP',
        defaultNoticePeriod: 30,
        defaultProbationMonths: 3,
        taxNote: 'Salary is subject to PAYE income tax and National Insurance (NI) contributions as regulated by HMRC.',
        statutoryBenefits: [
          "Workplace Pension scheme auto-enrolment matching",
          "Private Medical Insurance (PMI) cover",
          "Statutory Sick Pay (SSP) & Parental Leave",
          "Cycle to Work & Tech Scheme",
          "Statutory Paid Holiday Entitlement (28 days inclusive of Bank Holidays)"
        ],
        defaultBenefitsNote: "You are entitled to statutory UK employment benefits including workplace pension auto-enrolment with company matching, Private Medical Insurance (PMI), Statutory Sick Pay (SSP), Cycle to Work scheme, and statutory paid annual leave.",
      };

    case 'AE':
    case 'UAE':
    case 'UNITED ARAB EMIRATES':
      return {
        countryCode: 'AE',
        countryName: 'United Arab Emirates',
        jurisdiction: 'United Arab Emirates (UAE Federal Decree-Law on Regulation of Employment Relations)',
        defaultCurrency: 'AED',
        defaultNoticePeriod: 30,
        defaultProbationMonths: 6,
        taxNote: 'Governed by UAE Labor Law regulations. No personal income tax withholding applies.',
        statutoryBenefits: [
          "End of Service Gratuity under UAE Federal Labor Law (Article 51)",
          "Mandatory Employer Medical Insurance (DHA/DOH compliant)",
          "Annual Return Flight Allowance / Travel Benefit",
          "30 Calendar Days Paid Annual Leave",
          "Workplace Injury & Disability Coverage"
        ],
        defaultBenefitsNote: "You are entitled to statutory UAE labor law benefits including End of Service Gratuity, mandatory employer Health Insurance, annual travel flight allowance, and 30 calendar days of paid annual leave.",
      };

    case 'SG':
    case 'SGP':
    case 'SINGAPORE':
      return {
        countryCode: 'SG',
        countryName: 'Singapore',
        jurisdiction: 'Republic of Singapore (Employment Act & Ministry of Manpower)',
        defaultCurrency: 'SGD',
        defaultNoticePeriod: 30,
        defaultProbationMonths: 3,
        taxNote: 'Salary is subject to Central Provident Fund (CPF) contributions for Singapore Citizens/PRs as applicable.',
        statutoryBenefits: [
          "Central Provident Fund (CPF) employer statutory contribution",
          "Outpatient & Specialist Medical Consultation Coverage",
          "Dental & Health Screening Benefit",
          "Statutory Annual & Hospitalisation Leave under Employment Act"
        ],
        defaultBenefitsNote: "You are entitled to statutory Singapore benefits under the Employment Act including CPF employer contributions (for Citizens/PRs), outpatient and specialist medical benefits, dental allowances, and statutory leave.",
      };

    default:
      return {
        countryCode: code,
        countryName: code,
        jurisdiction: 'Applicable National & Local Employment Laws',
        defaultCurrency: 'USD',
        defaultNoticePeriod: 30,
        defaultProbationMonths: 3,
        taxNote: 'Salary is subject to applicable statutory payroll taxes and legal withholdings.',
        statutoryBenefits: [
          "Group Medical & Healthcare Insurance",
          "Statutory Retirement / Pension Contribution",
          "Paid Annual Leave & Statutory Holidays",
          "Sickness & Disability Benefit"
        ],
        defaultBenefitsNote: "You will be entitled to standard company benefits including medical health insurance, statutory retirement/pension contributions, paid annual leave, and sickness benefits as per policy.",
      };
  }
}

/**
 * Standard IP Assignment Clause builder
 */
export function getDefaultIPClause(companyName: string, jurisdiction: string): string {
  return `All intellectual property, inventions, discoveries, source code, designs, software architectures, algorithms, documentation, and work products created, conceived, or developed by the employee during employment (or internship) shall be the sole and exclusive property of ${companyName}. The employee hereby assigns all rights, titles, and interests in such intellectual property to the company under the laws of ${jurisdiction}.`;
}

/**
 * Standard Asset Care & Return Clause builder
 */
export function getDefaultAssetClause(companyName: string): string {
  return `The employee is responsible for proper care, maintenance, and ethical use of all ${companyName}-issued assets, including laptops, mobile devices, security access badges, software accounts, and confidential data. All physical and digital company assets must be returned in good working condition upon request or immediately prior to final employment exit.`;
}

/**
 * Cleanly formats address data into multiline standard address string
 */
export function formatAddressData(addressObj?: {
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}): string {
  if (!addressObj) return '';
  const lines = [
    addressObj.address_line1,
    addressObj.address_line2,
    [addressObj.city, addressObj.state, addressObj.postal_code].filter(Boolean).join(', '),
    addressObj.country
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * Resolves work location text based on location type (onsite, hybrid, remote)
 * Returns formatted multiline address string for onsite/hybrid, or empty for remote.
 */
export function resolveWorkLocation(
  workLocationType: 'onsite' | 'hybrid' | 'remote',
  company: CompanySettings | null
): string {
  if (workLocationType === 'remote') {
    return '';
  }
  if (!company) return 'Corporate Office';
  return formatAddressData({
    address_line1: company.address_line1,
    address_line2: company.address_line2,
    city: company.city,
    state: company.state,
    postal_code: company.postal_code,
    country: company.country_id
  });
}

// ─── Document Data Factories ──────────────────────────────────────────────────

export function getDefaultOfferLetterData(
  employee: Employee | null,
  company: CompanySettings | null,
  hrSettings?: HRDocumentSettings | null
): OfferLetterData {
  const companyName = company?.company_name || 'Kdadks';
  const companyCountry = company?.country_id || employee?.country || 'IN';
  const jurInfo = getJurisdictionInfo(companyCountry);

  const basic = employee?.basic_salary || 30000;
  const hra = employee?.hra || Math.round(basic * 0.4);
  const special = employee?.special_allowance || Math.round(basic * 0.3);
  const other = employee?.other_allowances || 0;
  const gross = employee?.gross_salary || (basic + hra + special + other);
  const annual = gross * 12;

  const todayStr = new Date().toISOString().split('T')[0];
  const workLocType: 'onsite' | 'hybrid' | 'remote' = 'onsite';

  return {
    position: employee?.designation || 'Software Engineer',
    department: employee?.department || 'ITwala',
    joining_date: employee?.date_of_joining || todayStr,
    offer_date: todayStr,
    candidate_address: formatAddressData(employee || undefined),

    reporting_to: 'HR Manager / Tech Lead',
    work_location_type: workLocType,
    work_location: resolveWorkLocation(workLocType, company),
    employment_type: employee?.employment_type === 'full-time' ? 'Full-time' : (employee?.employment_type || 'Full-time'),

    roles_responsibilities: [
      'Managing day-to-day software development and operational projects',
      'Collaborating with internal cross-functional engineering and design teams',
      'Maintaining clean code quality, unit testing, and technical documentation',
      'Adhering to project deadlines, client specifications, and company guidelines',
      'Supporting administrative, operational, and technical tasks assigned by leadership',
    ].join('\n'),

    salary_breakdown: {
      basic,
      hra,
      special_allowance: special,
      other_allowances: other,
      gross_salary: gross,
    },
    annual_ctc: annual,
    salary_payment_note: `Salary will be disbursed on a monthly basis in ${employee?.currency_code || jurInfo.defaultCurrency}. ${jurInfo.taxNote}`,
    benefits_note: jurInfo.defaultBenefitsNote,
    benefits: jurInfo.statutoryBenefits,

    working_hours_start: '09:30 AM',
    working_hours_end: '06:30 PM',
    working_days: 'Monday to Friday',
    additional_hours_note: 'You may occasionally be required to work additional hours depending on business requirements and deliverables.',

    probation_period: jurInfo.defaultProbationMonths,
    probation_note: `You will serve a probation period of ${jurInfo.defaultProbationMonths} months. Employment confirmation will be issued upon satisfactory performance evaluation.`,
    notice_period: jurInfo.defaultNoticePeriod,

    leave_policy_note: `Leave entitlements, public holidays, and sickness leave are governed by ${companyName}'s HR Leave Policy.`,
    confidentiality_note: `You shall maintain strict confidentiality regarding all ${companyName} business strategies, source code, financial data, and client information.`,
    termination_note: `Either party may terminate this employment by giving ${jurInfo.defaultNoticePeriod} days written notice or gross salary in lieu thereof.`,

    acceptance_section: true,
    signatory_name: hrSettings?.signatory_name || 'HR Director',
    signatory_designation: hrSettings?.signatory_designation || 'Head of Human Resources',
    signatory_contact: company?.phone ? `Contact: ${company.phone}` : (company?.email || 'hr@kdadks.com'),

    terms_and_conditions: `1. Employment is subject to background verification.\n2. You must abide by all safety, ethics, and governance policies of ${companyName}.\n3. Governing Jurisdiction: ${jurInfo.jurisdiction}.`,
    other_details: 'Please return a signed copy of this offer letter within 5 working days as token of acceptance.',

    jurisdiction: jurInfo.jurisdiction,
    ip_clause_text: getDefaultIPClause(companyName, jurInfo.jurisdiction),
    asset_clause_text: getDefaultAssetClause(companyName),
  };
}

export function getDefaultSalaryCertificateData(
  employee: Employee | null,
  company: CompanySettings | null,
  compensation?: EmployeeCompensation | null
): SalaryCertificateData {
  const companyCountry = company?.country_id || employee?.country || 'IN';
  const jurInfo = getJurisdictionInfo(companyCountry);

  const basic = compensation?.basic_salary ?? employee?.basic_salary ?? 30000;
  const hra = compensation?.hra ?? employee?.hra ?? Math.round(basic * 0.4);
  const special = compensation?.special_allowance ?? employee?.special_allowance ?? Math.round(basic * 0.3);
  const other = compensation
    ? ((compensation.transport_allowance || 0) + (compensation.medical_allowance || 0) + (compensation.other_allowances || 0))
    : (employee?.other_allowances || 0);
  const gross = compensation?.gross_salary ?? employee?.gross_salary ?? (basic + hra + special + other);

  const pfDeduction = compensation ? compensation.pf_contribution : (jurInfo.countryCode === 'IN' ? Math.round(basic * 0.12) : 0);
  const esiDeduction = compensation ? compensation.esi_contribution : 0;
  const ptDeduction = compensation ? compensation.professional_tax : 200;
  const tdsDeduction = compensation ? compensation.tds : Math.round(gross * 0.1);
  const net = compensation?.net_salary ?? (gross - (pfDeduction + ptDeduction + tdsDeduction));

  const now = new Date();
  const year = now.getFullYear();
  const periodFrom = `${year}-01-01`;
  const periodTo = `${year}-12-31`;

  return {
    purpose: 'Visa application / Bank loan verification / Official documentation',
    period_from: periodFrom,
    period_to: periodTo,
    salary_breakdown: {
      basic,
      hra,
      special_allowance: special,
      other_allowances: other,
      gross_monthly: gross,
    },
    annual_gross: gross * 12,
    deductions: {
      pf: pfDeduction,
      esic: esiDeduction,
      tds: tdsDeduction,
      other: ptDeduction,
    },
    net_salary: net,
  };
}

export function getDefaultExperienceCertificateData(
  employee: Employee | null,
  company: CompanySettings | null,
  hrSettings?: HRDocumentSettings | null
): ExperienceCertificateData {
  const companyName = company?.company_name || 'Kdadks';
  const companyCountry = company?.country_id || employee?.country || 'IN';
  const jurInfo = getJurisdictionInfo(companyCountry);
  const todayStr = new Date().toISOString().split('T')[0];

  return {
    employee_name: employee ? employee.full_name : '[Employee Name]',
    designation: employee ? employee.designation : 'Software Engineer',
    department: employee?.department || 'ITwala',
    date_of_joining: employee?.date_of_joining || '2024-01-01',
    last_working_date: employee?.date_of_leaving || todayStr,
    period_of_employment: 'As per service record',
    roles_responsibilities: employee
      ? `Served as ${employee.designation} in ${employee.department || 'Engineering'}, contributing to core development, system integration, and team collaboration.`
      : 'Responsible for application engineering, maintenance, and technical execution.',
    performance_note: 'During their tenure, performance was commendable, demonstrated high technical standards, dedication, and professional ethics.',
    conduct_note: 'Character and conduct were good throughout the period of service.',
    reason_for_leaving: 'Resigned voluntarily to pursue career growth.',
    issued_date: todayStr,
    signatory_name: hrSettings?.signatory_name || 'HR Director',
    signatory_designation: hrSettings?.signatory_designation || 'Head of Human Resources',
    contact_details: company?.email || company?.phone || 'hr@kdadks.com',

    jurisdiction: jurInfo.jurisdiction,
    ip_clause_text: `Post-Employment IP Obligations: All inventions, code, designs, and intellectual property created by ${employee?.full_name || 'the employee'} during their tenure remain the sole property of ${companyName} under ${jurInfo.jurisdiction}.`,
    asset_clause_text: `Asset Exit Clearance: ${employee?.full_name || 'The employee'} has returned all physical hardware, credentials, access keys, software licenses, and company records prior to release.`,
  };
}

export function getDefaultRelievingLetterData(
  employee: Employee | null,
  company: CompanySettings | null,
  hrSettings?: HRDocumentSettings | null
): RelievingLetterData {
  const companyName = company?.company_name || 'Kdadks';
  const companyCountry = company?.country_id || employee?.country || 'IN';
  const jurInfo = getJurisdictionInfo(companyCountry);
  const todayStr = new Date().toISOString().split('T')[0];

  return {
    employee_name: employee ? employee.full_name : '[Employee Name]',
    employee_number: employee?.employee_number || 'EMP-001',
    designation: employee ? employee.designation : 'Software Engineer',
    department: employee?.department || 'ITwala',
    date_of_joining: employee?.date_of_joining || '2024-01-01',
    last_working_date: employee?.date_of_leaving || todayStr,
    relieving_date: employee?.date_of_leaving || todayStr,
    resignation_date: todayStr,
    notice_period_served: `${jurInfo.defaultNoticePeriod} days served`,
    handover_completion: true,
    assets_returned: true,
    dues_cleared: true,
    notice_text: `This letter confirms that ${employee?.full_name || 'the employee'} has been relieved of all duties and responsibilities at ${companyName} effective end of working hours on ${employee?.date_of_leaving || todayStr}.`,
    issued_date: todayStr,
    signatory_name: hrSettings?.signatory_name || 'HR Director',
    signatory_designation: hrSettings?.signatory_designation || 'Head of Human Resources',
    contact_details: company?.email || company?.phone || 'hr@kdadks.com',

    jurisdiction: jurInfo.jurisdiction,
    ip_clause_text: `Post-Employment Intellectual Property Reaffirmation: Reaffirmed that all code, software artifacts, and IP generated during employment belong exclusively to ${companyName} under ${jurInfo.jurisdiction}.`,
    asset_clause_text: `Full Company Asset Clearance: Confirmed that all company laptops, tokens, software credentials, security badges, and equipment have been returned in full working order.`,
  };
}

export function getDefaultForm16Data(
  employee: Employee | null,
  company: CompanySettings | null,
  hrSettings?: HRDocumentSettings | null,
  compensation?: EmployeeCompensation | null
): Form16Data {
  const currentYear = new Date().getFullYear();
  const finYear = `${currentYear - 1}-${currentYear}`;

  const grossMonthly = compensation?.gross_salary ?? (
    (compensation?.basic_salary ?? employee?.basic_salary ?? 30000) +
    (compensation?.hra ?? employee?.hra ?? 12000) +
    (compensation?.special_allowance ?? employee?.special_allowance ?? 8000) +
    (compensation ? ((compensation.transport_allowance || 0) + (compensation.medical_allowance || 0) + (compensation.other_allowances || 0)) : (employee?.other_allowances || 0))
  );
  const annualGross = grossMonthly * 12;

  const hraAnnual = (compensation?.hra ?? employee?.hra ?? Math.round((compensation?.basic_salary || 30000) * 0.4)) * 12;
  const pfAnnual = (compensation?.pf_contribution ?? Math.round((compensation?.basic_salary || 30000) * 0.12)) * 12;
  const ptAnnual = (compensation?.professional_tax ?? 200) * 12;
  const tdsAnnual = (compensation?.tds ?? Math.round(grossMonthly * 0.1)) * 12;

  const stdDeduction = 50000;
  const taxable = Math.max(0, annualGross - hraAnnual - stdDeduction - ptAnnual - Math.min(150000, pfAnnual));

  return {
    financial_year: finYear,
    employee: {
      name: employee?.full_name || '[Employee Name]',
      pan: employee?.pan_number || 'ABCDE1234F',
      address: employee
        ? [employee.address_line1, employee.city, employee.state, employee.postal_code].filter(Boolean).join(', ')
        : 'Employee Address',
    },
    employer: {
      name: company?.company_name || 'Kdadks',
      tan: hrSettings?.company_tan || company?.gstin || company?.vat_number || 'DELK12345F',
      pan: hrSettings?.company_pan || company?.pan || 'AAACK1234F',
      address: company
        ? [company.address_line1, company.address_line2, company.city, company.state, company.postal_code].filter(Boolean).join(', ')
        : 'Corporate Headquarters Address',
    },
    salary_details: {
      gross_salary: annualGross,
      allowances: hraAnnual,
      perquisites: 0,
      profits_in_lieu: 0,
    },
    deductions: {
      standard_deduction: stdDeduction,
      entertainment_allowance: 0,
      professional_tax: ptAnnual,
    },
    chapter_vi_deductions: {
      section_80c: Math.min(150000, pfAnnual),
      section_80d: 25000,
      other: 0,
    },
    income_chargeable: taxable,
    tax_computed: tdsAnnual,
    relief_under_89: 0,
    tax_payable: tdsAnnual,
    tds_deducted: tdsAnnual,
  };
}

export function getDefaultForm24QData(
  company: CompanySettings | null,
  hrSettings?: HRDocumentSettings | null,
  allCompensations?: EmployeeCompensation[]
): Form24QData {
  const currentYear = new Date().getFullYear();
  const finYear = `${currentYear - 1}-${currentYear}`;

  const employeesTDS = (allCompensations || []).map((comp, idx) => {
    const empName = comp.employees?.full_name || `Employee ${idx + 1}`;
    const empId = comp.employee_id || `emp-${idx + 1}`;
    const pan = String((comp as any).employees?.pan_number || 'ABCDE1234F');
    const quarterlyTDS = (comp.tds || 0) * 3;
    return {
      employee_id: empId,
      employee_name: empName,
      pan: pan,
      tds_deducted: quarterlyTDS,
      challan_details: {
        challan_number: `CHL-${currentYear}-Q4-${(idx + 1).toString().padStart(3, '0')}`,
        bsr_code: '0210045',
        deposit_date: `${currentYear}-03-15`,
      }
    };
  });

  const totalTDS = employeesTDS.reduce((sum, item) => sum + item.tds_deducted, 0);

  return {
    quarter: 4,
    financial_year: finYear,
    employees: employeesTDS,
    total_tds: totalTDS,
    employer: {
      name: company?.company_name || 'Kdadks',
      tan: hrSettings?.company_tan || company?.gstin || company?.vat_number || 'DELK12345F',
      pan: hrSettings?.company_pan || company?.pan || 'AAACK1234F',
    },
  };
}

export function getDefaultInternOfferLetterDataExtended(
  employee: Employee | null,
  company: CompanySettings | null,
  hrSettings?: HRDocumentSettings | null
): InternOfferLetterData {
  const companyName = company?.company_name || 'Kdadks';
  const companyCountry = company?.country_id || employee?.country || 'IN';
  const jurInfo = getJurisdictionInfo(companyCountry);
  const todayStr = new Date().toISOString().split('T')[0];

  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 3);
  const endDateStr = endDate.toISOString().split('T')[0];

  const workLocType: 'onsite' | 'hybrid' | 'remote' = 'onsite';

  return {
    position: employee?.designation || 'Software Engineering Intern',
    department: employee?.department || 'ITwala',
    joining_date: employee?.date_of_joining || todayStr,
    end_date: endDateStr,
    offer_date: todayStr,
    candidate_address: formatAddressData(employee || undefined),

    program_name: 'ITWala Academy Internship Program',
    program_batch: `Batch ${new Date().getFullYear()}-A`,
    program_notes: 'Hands-on practical industry learning and technical project involvement.',
    internship_duration: '3 Months (12 Weeks)',
    internship_scope: 'Full-stack web application development, code optimization, and agile project participation.',

    supervisor_name: 'Lead Engineering Mentor',
    supervisor_title: 'Senior Solutions Architect',
    supervisor_department: employee?.department || 'Engineering',

    duties_and_responsibilities: [
      'Participating in module building, API integrations, and code reviews',
      'Assisting in unit testing, debugging, and platform documentation',
      'Attending weekly sprint standups and technical knowledge sessions',
    ].join('\n'),

    learning_objectives: 'Gain real-world software architecture experience, production deployment practices, and collaborative teamwork skills.',

    is_paid: true,
    stipend_amount: employee?.basic_salary || 10000,
    stipend_currency: employee?.currency_code || jurInfo.defaultCurrency,
    reimbursement_details: 'Travel and learning material allowance reimbursed up to statutory company limits.',

    working_hours_start: '09:30 AM',
    working_hours_end: '06:00 PM',
    working_days: 'Monday to Friday',

    reporting_to: 'Technical Internship Coordinator',
    work_location_type: workLocType,
    work_location: resolveWorkLocation(workLocType, company),

    signatory_name: hrSettings?.signatory_name || 'HR Director',
    signatory_designation: hrSettings?.signatory_designation || 'Head of Human Resources',
    signatory_contact: company?.email || company?.phone || 'hr@kdadks.com',

    legal_disclaimer: `This internship program is designed for academic learning and skill development. Governing Law: ${jurInfo.jurisdiction}.`,
    confidentiality_clause: true,
    ip_assignment_clause: true,
    jurisdiction: jurInfo.jurisdiction,
    ip_clause_text: getDefaultIPClause(companyName, jurInfo.jurisdiction),
    asset_clause_text: getDefaultAssetClause(companyName),
  };
}

export function getDefaultInternExperienceCertDataExtended(
  employee: Employee | null,
  company: CompanySettings | null,
  hrSettings?: HRDocumentSettings | null
): InternExperienceCertificateData {
  const companyName = company?.company_name || 'Kdadks';
  const companyCountry = company?.country_id || employee?.country || 'IN';
  const jurInfo = getJurisdictionInfo(companyCountry);
  const todayStr = new Date().toISOString().split('T')[0];

  return {
    employee_name: employee ? employee.full_name : '[Intern Name]',
    designation: employee?.designation || 'Software Engineering Intern',
    department: employee?.department || 'ITwala',
    date_of_joining: employee?.date_of_joining || '2024-01-01',
    last_working_date: employee?.date_of_leaving || todayStr,
    period_of_employment: '3 Months',
    conduct_note: 'Exemplary work ethic, prompt task completion, and proactive learning behavior.',
    performance_note: 'Demonstrated technical growth, successfully completed assigned project milestones.',
    issued_date: todayStr,
    signatory_name: hrSettings?.signatory_name || 'HR Director',
    signatory_designation: hrSettings?.signatory_designation || 'Head of Human Resources',
    contact_details: company?.email || company?.phone || 'hr@kdadks.com',

    program_name: 'ITWala Academy Internship Program',
    program_batch: `Batch ${new Date().getFullYear()}-A`,
    internship_type: 'Software Development Internship',

    projects_worked_on: 'Cloud platform UI modules, automated reporting tools, and backend API integration.',
    key_achievements: 'Successfully delivered assigned feature modules with 100% test coverage.',
    skills_acquired: 'React, TypeScript, Node.js, SQL database design, and Git workflow.',

    overall_rating: 'excellent',
    supervisor_name: 'Lead Engineering Mentor',
    supervisor_title: 'Senior Solutions Architect',
    was_paid: true,
    stipend_details: `Paid monthly stipend in ${employee?.currency_code || jurInfo.defaultCurrency}.`,

    legal_disclaimer: `Official certificate issued by ${companyName} upon completion of internship requirements.`,
    jurisdiction: jurInfo.jurisdiction,
    ip_clause_text: `Post-Internship Intellectual Property Ownership: Reaffirmed that all code, design artifacts, and documentation produced belong solely to ${companyName} under ${jurInfo.jurisdiction}.`,
    asset_clause_text: `Asset Clearance Confirmation: Intern has returned all company assets, keys, software logins, and equipment prior to issue of this certificate.`,
  };
}

/**
 * Master prefilled default document data dispatcher
 */
export function getPrefilledDocumentData(
  documentType: DocumentType,
  employee: Employee | null,
  company: CompanySettings | null,
  hrSettings?: HRDocumentSettings | null,
  compensation?: EmployeeCompensation | null,
  allCompensations?: EmployeeCompensation[]
): any {
  switch (documentType) {
    case 'offer_letter':
      return getDefaultOfferLetterData(employee, company, hrSettings);
    case 'salary_certificate':
      return getDefaultSalaryCertificateData(employee, company, compensation);
    case 'experience_certificate':
      return getDefaultExperienceCertificateData(employee, company, hrSettings);
    case 'relieving_letter':
      return getDefaultRelievingLetterData(employee, company, hrSettings);
    case 'form_16':
      return getDefaultForm16Data(employee, company, hrSettings, compensation);
    case 'form_24q':
      return getDefaultForm24QData(company, hrSettings, allCompensations);
    case 'intern_offer_letter':
      return getDefaultInternOfferLetterDataExtended(employee, company, hrSettings);
    case 'intern_experience_certificate':
      return getDefaultInternExperienceCertDataExtended(employee, company, hrSettings);
    default:
      return {};
  }
}
