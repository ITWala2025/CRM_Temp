/**
 * Comprehensive Payroll Calculator
 * Handles PF, EPS, ESI, Gratuity, Bonus, PT, LWF calculations as per Indian laws
 */

import type { PayrollSettings, PayrollComponentsBreakdown } from '../types/payroll';

// =====================================================
// PROVIDENT FUND (PF) CALCULATIONS
// =====================================================

export interface PFCalculation {
  basic_for_pf: number; // Capped at wage ceiling
  employee_pf: number; // 12% of basic
  employer_pf: number; // 3.67% of basic (12% - 8.33% EPS)
  eps: number; // 8.33% of basic
  total_pf: number; // Employee + Employer contribution
}

/**
 * Calculate PF, EPS contributions as per EPFO rules
 * - Employee PF: 12% of Basic (capped at wage ceiling)
 * - Employer PF: 3.67% of Basic (12% - 8.33%)
 * - EPS: 8.33% of Basic (capped at Rs. 15,000)
 */
export function calculatePF(
  basic_salary: number,
  settings: PayrollSettings
): PFCalculation {
  if (!settings.pf_enabled) {
    return {
      basic_for_pf: 0,
      employee_pf: 0,
      employer_pf: 0,
      eps: 0,
      total_pf: 0
    };
  }

  // Cap basic salary at PF wage ceiling
  const basic_for_pf = Math.min(basic_salary, settings.pf_wage_ceiling);
  const basic_for_eps = Math.min(basic_salary, settings.eps_wage_ceiling);

  // Employee PF contribution (12%)
  const employee_pf = Math.round((basic_for_pf * settings.employee_pf_rate) / 100);

  // EPS contribution (8.33% of basic, max 15000)
  const eps = Math.round((basic_for_eps * settings.eps_rate) / 100);

  // Employer PF contribution (12% - 8.33% = 3.67%)
  const employer_pf_rate = settings.employer_pf_rate - settings.eps_rate;
  const employer_pf = Math.round((basic_for_pf * employer_pf_rate) / 100);

  const total_pf = employee_pf + employer_pf + eps;

  return {
    basic_for_pf,
    employee_pf,
    employer_pf,
    eps,
    total_pf
  };
}

// =====================================================
// ESI (Employee State Insurance) CALCULATIONS
// =====================================================

export interface ESICalculation {
  applicable: boolean;
  gross_for_esi: number;
  employee_esi: number; // 0.75% of gross
  employer_esi: number; // 3.25% of gross
  total_esi: number;
}

/**
 * Calculate ESI as per ESIC rules
 * - Applicable if gross salary <= Rs. 21,000/month
 * - Employee: 0.75% of gross
 * - Employer: 3.25% of gross
 */
export function calculateESI(
  gross_salary: number,
  settings: PayrollSettings
): ESICalculation {
  if (!settings.esi_enabled || gross_salary > settings.esi_wage_ceiling) {
    return {
      applicable: false,
      gross_for_esi: 0,
      employee_esi: 0,
      employer_esi: 0,
      total_esi: 0
    };
  }

  const employee_esi = Math.round((gross_salary * settings.employee_esi_rate) / 100);
  const employer_esi = Math.round((gross_salary * settings.employer_esi_rate) / 100);

  return {
    applicable: true,
    gross_for_esi: gross_salary,
    employee_esi,
    employer_esi,
    total_esi: employee_esi + employer_esi
  };
}

// =====================================================
// PROFESSIONAL TAX CALCULATIONS
// =====================================================

/**
 * Calculate Professional Tax (State-wise)
 * This is a simplified Maharashtra PT calculation
 * Different states have different slabs
 */
export function calculateProfessionalTax(
  monthly_gross: number,
  state: string = 'Maharashtra'
): number {
  if (state === 'Maharashtra') {
    // Maharashtra PT slabs (FY 2024-25)
    if (monthly_gross <= 7500) return 0;
    if (monthly_gross <= 10000) return 175;
    return 200; // Max PT per month (Feb = 300)
  }

  if (state === 'Karnataka') {
    if (monthly_gross <= 15000) return 0;
    return 200;
  }

  if (state === 'West Bengal') {
    if (monthly_gross <= 8500) return 0;
    if (monthly_gross <= 15000) return 90;
    if (monthly_gross <= 25000) return 150;
    if (monthly_gross <= 40000) return 180;
    return 200;
  }

  // Default: No PT
  return 0;
}

// =====================================================
// GRATUITY CALCULATIONS
// =====================================================

export interface GratuityCalculation {
  eligible: boolean;
  years_worked: number;
  last_drawn_salary: number;
  gratuity_amount: number;
  formula: string;
}

/**
 * Calculate Gratuity as per Payment of Gratuity Act, 1972
 * Formula: (Last drawn salary × 15 × Years of service) / 26
 * - Minimum 5 years of service required
 * - Last drawn salary = Basic + DA
 * - Maximum gratuity: Rs. 20 lakhs
 */
export function calculateGratuity(
  date_of_joining: Date,
  date_of_leaving: Date,
  last_drawn_salary: number,
  settings: PayrollSettings
): GratuityCalculation {
  if (!settings.gratuity_enabled) {
    return {
      eligible: false,
      years_worked: 0,
      last_drawn_salary: 0,
      gratuity_amount: 0,
      formula: 'Gratuity not enabled'
    };
  }

  // Calculate years worked
  const years_worked = calculateYearsOfService(date_of_joining, date_of_leaving);

  // Check eligibility (minimum 5 years)
  if (years_worked < settings.gratuity_years_required) {
    return {
      eligible: false,
      years_worked,
      last_drawn_salary,
      gratuity_amount: 0,
      formula: `Minimum ${settings.gratuity_years_required} years required`
    };
  }

  // Calculate gratuity: (Salary × 15 × Years) / 26
  let gratuity_amount = (last_drawn_salary * 15 * years_worked) / 26;

  // Cap at 20 lakhs
  const max_gratuity = 2000000;
  gratuity_amount = Math.min(gratuity_amount, max_gratuity);

  return {
    eligible: true,
    years_worked,
    last_drawn_salary,
    gratuity_amount: Math.round(gratuity_amount),
    formula: `(${last_drawn_salary} × 15 × ${years_worked}) / 26`
  };
}

/**
 * Calculate years of service
 * Rounds to nearest year if more than 6 months
 */
function calculateYearsOfService(from_date: Date, to_date: Date): number {
  const diff_ms = to_date.getTime() - from_date.getTime();
  const diff_days = diff_ms / (1000 * 60 * 60 * 24);
  const years = diff_days / 365.25;

  // Round to 2 decimal places
  return Math.round(years * 100) / 100;
}

// =====================================================
// BONUS CALCULATIONS
// =====================================================

export interface BonusCalculation {
  eligible_salary: number;
  bonus_percentage: number;
  bonus_amount: number;
  formula: string;
}

/**
 * Calculate Annual Bonus as per Payment of Bonus Act, 1961
 * - Minimum: 8.33% of salary (eligible employees earning <= Rs. 21,000/month)
 * - Maximum: 20% of salary
 * - Calculated on actual working days
 */
export function calculateAnnualBonus(
  monthly_salary: number,
  working_days_in_year: number,
  bonus_percentage: number,
  settings: PayrollSettings
): BonusCalculation {
  if (!settings.annual_bonus_enabled) {
    return {
      eligible_salary: 0,
      bonus_percentage: 0,
      bonus_amount: 0,
      formula: 'Bonus not enabled'
    };
  }

  // Cap salary at bonus wage ceiling
  const eligible_salary = Math.min(monthly_salary, settings.bonus_wage_ceiling);

  // Ensure bonus percentage is within limits
  const capped_percentage = Math.max(
    settings.minimum_bonus_percent,
    Math.min(bonus_percentage, settings.maximum_bonus_percent)
  );

  // Calculate annual bonus
  const annual_salary = eligible_salary * 12;
  const bonus_amount = Math.round((annual_salary * capped_percentage) / 100);

  // Prorate based on working days (if less than full year)
  const prorated_bonus = Math.round((bonus_amount * working_days_in_year) / 365);

  return {
    eligible_salary,
    bonus_percentage: capped_percentage,
    bonus_amount: prorated_bonus,
    formula: `(${eligible_salary} × 12 × ${capped_percentage}%) × (${working_days_in_year}/365)`
  };
}

// =====================================================
// OVERTIME CALCULATIONS
// =====================================================

/**
 * Calculate overtime amount
 * - Basic overtime rate: 2x of hourly rate
 * - Holiday overtime: 3x of hourly rate
 */
export function calculateOvertime(
  basic_salary: number,
  overtime_hours: number,
  overtime_multiplier: number = 2,
  working_hours_per_day: number = 8
): number {
  // Calculate hourly rate (monthly salary / 26 days / 8 hours)
  const hourly_rate = basic_salary / 26 / working_hours_per_day;

  // Overtime amount
  const overtime_amount = hourly_rate * overtime_multiplier * overtime_hours;

  return Math.round(overtime_amount);
}

// =====================================================
// LWF (Labour Welfare Fund) CALCULATIONS
// =====================================================

/**
 * Calculate LWF - State specific
 * Some states have fixed amounts per half-year
 */
export function calculateLWF(
  month: number,
  settings: PayrollSettings
): { employee_lwf: number; employer_lwf: number } {
  if (!settings.lwf_enabled) {
    return { employee_lwf: 0, employer_lwf: 0 };
  }

  // LWF is usually deducted in specific months (e.g., June and December)
  const lwf_months = [6, 12];

  if (lwf_months.includes(month)) {
    return {
      employee_lwf: settings.employee_lwf_amount,
      employer_lwf: settings.employer_lwf_amount
    };
  }

  return { employee_lwf: 0, employer_lwf: 0 };
}

// =====================================================
// COMPREHENSIVE PAYROLL CALCULATION
// =====================================================

export interface ComprehensivePayrollCalculation extends PayrollComponentsBreakdown {
  pf_details: PFCalculation;
  esi_details: ESICalculation;
  cost_to_company: number;
  employer_total_contribution: number;
}

/**
 * Calculate complete payroll breakdown
 */
export function calculateComprehensivePayroll(
  basic_salary: number,
  hra: number,
  special_allowance: number,
  transport_allowance: number,
  medical_allowance: number,
  other_allowances: number,
  bonus: number,
  overtime_amount: number,
  tds: number,
  loan_repayment: number,
  other_deductions: number,
  salary_month: number,
  settings: PayrollSettings
): ComprehensivePayrollCalculation {
  // Calculate gross salary
  const gross_salary =
    basic_salary +
    hra +
    special_allowance +
    transport_allowance +
    medical_allowance +
    other_allowances +
    bonus +
    overtime_amount;

  // Calculate PF
  const pf_details = calculatePF(basic_salary, settings);

  // Calculate ESI
  const esi_details = calculateESI(gross_salary, settings);

  // Calculate Professional Tax
  const professional_tax = calculateProfessionalTax(gross_salary, settings.pt_state);

  // Calculate LWF
  const { employee_lwf, employer_lwf } = calculateLWF(salary_month, settings);

  // Total employee deductions
  const total_deductions =
    pf_details.employee_pf +
    esi_details.employee_esi +
    professional_tax +
    tds +
    employee_lwf +
    loan_repayment +
    other_deductions;

  // Net salary
  const net_salary = gross_salary - total_deductions;

  // Employer contributions
  const employer_total_contribution =
    pf_details.employer_pf +
    pf_details.eps +
    esi_details.employer_esi +
    employer_lwf;

  // Cost to Company (CTC)
  const cost_to_company = gross_salary + employer_total_contribution;

  return {
    // Earnings
    basic_salary,
    hra,
    special_allowance,
    transport_allowance,
    medical_allowance,
    other_allowances,
    bonus,
    overtime: overtime_amount,
    gross_salary,

    // Employee Deductions
    employee_pf: pf_details.employee_pf,
    employee_esi: esi_details.employee_esi,
    professional_tax,
    tds,
    lwf: employee_lwf,
    loan_repayment,
    other_deductions,
    total_deductions,

    // Employer Contributions
    employer_pf: pf_details.employer_pf,
    eps: pf_details.eps,
    employer_esi: esi_details.employer_esi,

    // Net Salary
    net_salary,

    // CTC
    ctc: cost_to_company,

    // Details
    pf_details,
    esi_details,
    cost_to_company,
    employer_total_contribution
  };
}

export default {
  calculatePF,
  calculateESI,
  calculateProfessionalTax,
  calculateGratuity,
  calculateAnnualBonus,
  calculateOvertime,
  calculateLWF,
  calculateComprehensivePayroll
};
