/**
 * Indian Salary Calculator
 * Based on Indian Income Tax Act and standard salary structure practices
 * FY 2025-26
 */

export interface SalaryBreakdown {
  // Earnings
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  transportAllowance: number;
  medicalAllowance: number;
  da: number;
  otherAllowances: number;
  grossSalary: number;
  
  // Deductions
  professionalTax: number;
  esi: number;
  tds: number;
  otherDeductions: number;
  totalDeductions: number;
  
  // Net
  netSalary: number;
}

/**
 * Income Tax Slabs for FY 2025-26 (New Tax Regime - Default)
 */
const TAX_SLABS_NEW_REGIME = [
  { min: 0, max: 300000, rate: 0 },          // Up to 3 Lakhs - NIL
  { min: 300001, max: 700000, rate: 0.05 },  // 3-7 Lakhs - 5%
  { min: 700001, max: 1000000, rate: 0.10 }, // 7-10 Lakhs - 10%
  { min: 1000001, max: 1200000, rate: 0.15 },// 10-12 Lakhs - 15%
  { min: 1200001, max: 1500000, rate: 0.20 },// 12-15 Lakhs - 20%
  { min: 1500001, max: Infinity, rate: 0.30 } // Above 15 Lakhs - 30%
];

/**
 * Professional Tax Slabs (Maharashtra - highest in India)
 * Different states have different PT rates
 */
const getProfessionalTax = (monthlyGross: number): number => {
  // Maharashtra PT rates (monthly)
  if (monthlyGross <= 7500) return 0;
  if (monthlyGross <= 10000) return 175;
  return 200; // Above 10,000
};

/**
 * ESI (Employee State Insurance) - Applicable if gross salary <= 21,000/month
 * Employee contribution: 0.75% of gross
 */
const getESI = (monthlyGross: number): number => {
  if (monthlyGross > 21000) return 0;
  return Math.round(monthlyGross * 0.0075);
};

/**
 * Calculate TDS based on annual income
 * Using New Tax Regime (no standard deduction)
 */
const calculateAnnualTDS = (annualGross: number): number => {
  const taxableIncome = annualGross;
  let tax = 0;
  
  for (const slab of TAX_SLABS_NEW_REGIME) {
    if (taxableIncome > slab.min) {
      const taxableInSlab = Math.min(taxableIncome, slab.max) - slab.min;
      tax += taxableInSlab * slab.rate;
    }
  }
  
  // Add 4% Health and Education Cess
  tax = tax * 1.04;
  
  // Rebate u/s 87A - For income up to 7 lakhs, rebate of up to 25,000
  if (annualGross <= 700000) {
    tax = Math.max(0, tax - 25000);
  }
  
  return Math.round(tax);
};

/**
 * Calculate salary breakdown from gross salary
 * @param monthlyGross - Monthly gross salary in INR
 * @param options - Optional overrides for specific components
 */
export const calculateSalaryBreakdown = (
  monthlyGross: number,
  options: {
    customBasicPercent?: number;
    customHRAPercent?: number;
    otherAllowances?: number;
    otherDeductions?: number;
  } = {}
): SalaryBreakdown => {
  const {
    customBasicPercent,
    customHRAPercent,
    otherAllowances = 0,
    otherDeductions = 0
  } = options;

  // Standard salary structure percentages
  const basicPercent = customBasicPercent || 0.40;  // 40% of gross
  const hraPercent = customHRAPercent || 0.40;      // 40% of gross (can be up to 50% in metros)
  const specialAllowancePercent = 0.20;              // 20% of gross (balance)

  // Calculate earnings components
  const basicSalary = Math.round(monthlyGross * basicPercent);
  const hra = Math.round(monthlyGross * hraPercent);
  const specialAllowance = Math.round(monthlyGross * specialAllowancePercent);
  
  // Standard allowances (these are typically fixed amounts or not provided)
  const transportAllowance = 0;  // Usually not provided or fixed at 1600
  const medicalAllowance = 0;    // Usually not provided or fixed at 1250
  const da = 0;                  // Usually not provided in private sector

  // Ensure components add up to gross (adjust special allowance for rounding)
  const calculatedGross = basicSalary + hra + specialAllowance + transportAllowance + medicalAllowance + da + otherAllowances;
  const adjustment = monthlyGross - calculatedGross;
  const adjustedSpecialAllowance = specialAllowance + adjustment;

  // Calculate deductions
  const professionalTax = getProfessionalTax(monthlyGross);
  const esi = getESI(monthlyGross);
  
  // Calculate monthly TDS (annual TDS / 12)
  const annualGross = monthlyGross * 12;
  const annualTDS = calculateAnnualTDS(annualGross);
  const monthlyTDS = Math.round(annualTDS / 12);

  const totalDeductions = professionalTax + esi + monthlyTDS + otherDeductions;
  const netSalary = monthlyGross - totalDeductions;

  return {
    basicSalary,
    hra,
    specialAllowance: adjustedSpecialAllowance,
    transportAllowance,
    medicalAllowance,
    da,
    otherAllowances,
    grossSalary: monthlyGross,
    professionalTax,
    esi,
    tds: monthlyTDS,
    otherDeductions,
    totalDeductions,
    netSalary
  };
};

/**
 * Calculate net salary from gross
 * @param monthlyGross - Monthly gross salary
 */
export const calculateNetSalary = (monthlyGross: number): number => {
  const breakdown = calculateSalaryBreakdown(monthlyGross);
  return breakdown.netSalary;
};

/**
 * Get formatted salary breakdown summary
 */
export const getSalarySummary = (monthlyGross: number): string => {
  const breakdown = calculateSalaryBreakdown(monthlyGross);
  
  return `
Gross Salary: ₹${monthlyGross.toLocaleString('en-IN')}
Basic: ₹${breakdown.basicSalary.toLocaleString('en-IN')} (40%)
HRA: ₹${breakdown.hra.toLocaleString('en-IN')} (40%)
Special Allowance: ₹${breakdown.specialAllowance.toLocaleString('en-IN')} (20%)

Deductions:
Professional Tax: ₹${breakdown.professionalTax.toLocaleString('en-IN')}
ESI: ₹${breakdown.esi.toLocaleString('en-IN')}
TDS: ₹${breakdown.tds.toLocaleString('en-IN')}

Net Salary: ₹${breakdown.netSalary.toLocaleString('en-IN')}
  `.trim();
};

/**
 * Validate if salary structure components are within acceptable ranges
 */
export const validateSalaryStructure = (breakdown: SalaryBreakdown): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Basic should be at least 40% of gross
  const basicPercent = (breakdown.basicSalary / breakdown.grossSalary) * 100;
  if (basicPercent < 40) {
    errors.push('Basic salary should be at least 40% of gross salary');
  }
  
  // HRA should not exceed 50% of gross
  const hraPercent = (breakdown.hra / breakdown.grossSalary) * 100;
  if (hraPercent > 50) {
    errors.push('HRA should not exceed 50% of gross salary');
  }
  
  // Check if ESI is correctly applied
  if (breakdown.grossSalary <= 21000 && breakdown.esi === 0) {
    errors.push('ESI should be deducted for gross salary <= ₹21,000');
  }
  
  if (breakdown.grossSalary > 21000 && breakdown.esi > 0) {
    errors.push('ESI should not be deducted for gross salary > ₹21,000');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};
