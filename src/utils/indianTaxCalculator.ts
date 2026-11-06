/**
 * Indian Income Tax Calculator
 * Supports both Old and New Tax Regimes (FY 2024-25)
 */

export type TaxRegime = 'old' | 'new';

export interface TaxSlabOld {
  min: number;
  max: number | null;
  rate: number;
}

export interface TaxSlabNew {
  min: number;
  max: number | null;
  rate: number;
}

export interface TaxCalculationResult {
  grossIncome: number;
  standardDeduction: number;
  hraExemption: number;
  section80CDeduction: number;
  section80DDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  taxableIncome: number;
  taxOnIncome: number;
  surcharge: number;
  healthAndEducationCess: number;
  totalTax: number;
  monthlyTDS: number;
  regime: TaxRegime;
}

export interface DeductionInputs {
  section80C?: number; // PPF, ELSS, LIC, etc. (max 1.5 lakhs)
  section80D?: number; // Medical Insurance (max 25k for self, 50k for senior citizen parents)
  section80CCD1B?: number; // NPS additional (max 50k)
  homeLoanInterest?: number; // Only in old regime
  otherDeductions?: number;
}

export interface HRAExemptionInputs {
  hra: number;
  basicSalary: number;
  rentPaid: number;
  isMetroCity: boolean; // Mumbai, Delhi, Kolkata, Chennai
}

/**
 * Tax Slabs for Old Regime (FY 2024-25)
 * Standard deduction: ₹50,000
 */
const TAX_SLABS_OLD_REGIME: TaxSlabOld[] = [
  { min: 0, max: 250000, rate: 0 },
  { min: 250000, max: 500000, rate: 5 },
  { min: 500000, max: 1000000, rate: 20 },
  { min: 1000000, max: null, rate: 30 }
];

/**
 * Tax Slabs for New Regime (FY 2024-25)
 * Standard deduction: ₹50,000
 * Rebate under 87A: Up to ₹7 lakhs
 */
const TAX_SLABS_NEW_REGIME: TaxSlabNew[] = [
  { min: 0, max: 300000, rate: 0 },
  { min: 300000, max: 700000, rate: 5 },
  { min: 700000, max: 1000000, rate: 10 },
  { min: 1000000, max: 1200000, rate: 15 },
  { min: 1200000, max: 1500000, rate: 20 },
  { min: 1500000, max: null, rate: 30 }
];

const STANDARD_DEDUCTION = 50000;
const REBATE_87A_LIMIT_NEW = 700000;
const REBATE_87A_LIMIT_OLD = 500000;
const REBATE_87A_AMOUNT = 12500; // For old regime
const REBATE_87A_AMOUNT_NEW = 25000; // For new regime

/**
 * Calculate HRA Exemption (Only applicable in Old Regime)
 */
export function calculateHRAExemption(inputs: HRAExemptionInputs): number {
  const { hra, basicSalary, rentPaid, isMetroCity } = inputs;

  if (rentPaid === 0 || hra === 0) {
    return 0;
  }

  // HRA exemption is minimum of:
  // 1. Actual HRA received
  // 2. 50% of basic (metro) or 40% of basic (non-metro)
  // 3. Rent paid - 10% of basic

  const metroPercentage = isMetroCity ? 0.5 : 0.4;
  const basicPercentage = basicSalary * metroPercentage;
  const rentMinusBasic = rentPaid - (basicSalary * 0.1);

  const exemption = Math.min(hra, basicPercentage, rentMinusBasic);

  return Math.max(0, exemption);
}

/**
 * Calculate Professional Tax (varies by state)
 * This is a simplified calculation - adjust based on your state
 */
export function calculateProfessionalTax(monthlyGross: number): number {
  // Maharashtra PT slab (example)
  if (monthlyGross <= 7500) return 0;
  if (monthlyGross <= 10000) return 175;
  return 200;
}

/**
 * Calculate Provident Fund (12% of Basic + DA)
 */
export function calculateProvidentFund(basicSalary: number): number {
  return Math.round(basicSalary * 0.12);
}

/**
 * Calculate ESIC (Employee State Insurance Corporation)
 * Applicable if gross salary <= 21,000 per month
 * Employee contribution: 0.75% of gross
 */
export function calculateESIC(grossSalary: number): number {
  if (grossSalary > 21000) return 0;
  return Math.round(grossSalary * 0.0075);
}

/**
 * Calculate tax based on tax slabs
 */
function calculateTaxFromSlabs(
  taxableIncome: number,
  slabs: TaxSlabOld[] | TaxSlabNew[]
): number {
  let tax = 0;

  for (const slab of slabs) {
    if (taxableIncome <= slab.min) {
      break;
    }

    const slabMax = slab.max || Infinity;
    const taxableInSlab = Math.min(taxableIncome, slabMax) - slab.min;

    if (taxableInSlab > 0) {
      tax += (taxableInSlab * slab.rate) / 100;
    }
  }

  return Math.round(tax);
}

/**
 * Calculate Surcharge based on income
 */
function calculateSurcharge(taxableIncome: number, taxOnIncome: number): number {
  if (taxableIncome <= 5000000) return 0;
  if (taxableIncome <= 10000000) return taxOnIncome * 0.10; // 10%
  if (taxableIncome <= 20000000) return taxOnIncome * 0.15; // 15%
  if (taxableIncome <= 50000000) return taxOnIncome * 0.25; // 25%
  return taxOnIncome * 0.37; // 37%
}

/**
 * Calculate Health and Education Cess (4% of tax + surcharge)
 */
function calculateCess(taxPlusSurcharge: number): number {
  return Math.round(taxPlusSurcharge * 0.04);
}

/**
 * Calculate Annual Tax - Old Regime
 */
export function calculateTaxOldRegime(
  annualGrossIncome: number,
  hraExemption: number = 0,
  deductions: DeductionInputs = {}
): TaxCalculationResult {
  // Step 1: Calculate total deductions
  const standardDeduction = STANDARD_DEDUCTION;
  const section80CDeduction = Math.min(deductions.section80C || 0, 150000);
  const section80DDeduction = Math.min(deductions.section80D || 0, 25000);
  const section80CCD1B = Math.min(deductions.section80CCD1B || 0, 50000);
  const homeLoanInterest = Math.min(deductions.homeLoanInterest || 0, 200000);
  const otherDeductions = deductions.otherDeductions || 0;

  const totalDeductions =
    standardDeduction +
    hraExemption +
    section80CDeduction +
    section80DDeduction +
    section80CCD1B +
    homeLoanInterest +
    otherDeductions;

  // Step 2: Calculate taxable income
  const taxableIncome = Math.max(0, annualGrossIncome - totalDeductions);

  // Step 3: Calculate tax
  let taxOnIncome = calculateTaxFromSlabs(taxableIncome, TAX_SLABS_OLD_REGIME);

  // Step 4: Apply rebate under section 87A if applicable
  if (taxableIncome <= REBATE_87A_LIMIT_OLD) {
    taxOnIncome = Math.max(0, taxOnIncome - REBATE_87A_AMOUNT);
  }

  // Step 5: Calculate surcharge
  const surcharge = calculateSurcharge(taxableIncome, taxOnIncome);

  // Step 6: Calculate cess
  const healthAndEducationCess = calculateCess(taxOnIncome + surcharge);

  // Step 7: Total tax
  const totalTax = Math.round(taxOnIncome + surcharge + healthAndEducationCess);

  return {
    grossIncome: annualGrossIncome,
    standardDeduction,
    hraExemption,
    section80CDeduction,
    section80DDeduction,
    otherDeductions: section80CCD1B + homeLoanInterest + otherDeductions,
    totalDeductions,
    taxableIncome,
    taxOnIncome,
    surcharge,
    healthAndEducationCess,
    totalTax,
    monthlyTDS: Math.round(totalTax / 12),
    regime: 'old'
  };
}

/**
 * Calculate Annual Tax - New Regime
 */
export function calculateTaxNewRegime(
  annualGrossIncome: number
): TaxCalculationResult {
  // Step 1: Standard deduction only
  const standardDeduction = STANDARD_DEDUCTION;
  const totalDeductions = standardDeduction;

  // Step 2: Calculate taxable income
  const taxableIncome = Math.max(0, annualGrossIncome - totalDeductions);

  // Step 3: Calculate tax
  let taxOnIncome = calculateTaxFromSlabs(taxableIncome, TAX_SLABS_NEW_REGIME);

  // Step 4: Apply rebate under section 87A if applicable
  if (taxableIncome <= REBATE_87A_LIMIT_NEW) {
    taxOnIncome = Math.max(0, taxOnIncome - REBATE_87A_AMOUNT_NEW);
  }

  // Step 5: Calculate surcharge
  const surcharge = calculateSurcharge(taxableIncome, taxOnIncome);

  // Step 6: Calculate cess
  const healthAndEducationCess = calculateCess(taxOnIncome + surcharge);

  // Step 7: Total tax
  const totalTax = Math.round(taxOnIncome + surcharge + healthAndEducationCess);

  return {
    grossIncome: annualGrossIncome,
    standardDeduction,
    hraExemption: 0,
    section80CDeduction: 0,
    section80DDeduction: 0,
    otherDeductions: 0,
    totalDeductions,
    taxableIncome,
    taxOnIncome,
    surcharge,
    healthAndEducationCess,
    totalTax,
    monthlyTDS: Math.round(totalTax / 12),
    regime: 'new'
  };
}

/**
 * Calculate which regime is better for the taxpayer
 */
export function compareRegimes(
  annualGrossIncome: number,
  hraExemption: number = 0,
  deductions: DeductionInputs = {}
): {
  oldRegime: TaxCalculationResult;
  newRegime: TaxCalculationResult;
  recommendation: TaxRegime;
  savings: number;
} {
  const oldRegime = calculateTaxOldRegime(annualGrossIncome, hraExemption, deductions);
  const newRegime = calculateTaxNewRegime(annualGrossIncome);

  const recommendation: TaxRegime = oldRegime.totalTax < newRegime.totalTax ? 'old' : 'new';
  const savings = Math.abs(oldRegime.totalTax - newRegime.totalTax);

  return {
    oldRegime,
    newRegime,
    recommendation,
    savings
  };
}

/**
 * Calculate monthly TDS based on projected annual income
 */
export function calculateMonthlyTDS(
  monthlyGross: number,
  regime: TaxRegime = 'new',
  monthNumber: number = 1,
  previousTDS: number = 0,
  hraExemption: number = 0,
  deductions: DeductionInputs = {}
): number {
  // Project annual income based on current month
  const remainingMonths = 12 - monthNumber + 1;
  const projectedAnnualIncome = (monthlyGross * remainingMonths) + (monthlyGross * (monthNumber - 1));

  // Calculate total annual tax
  const taxResult = regime === 'old'
    ? calculateTaxOldRegime(projectedAnnualIncome, hraExemption * 12, deductions)
    : calculateTaxNewRegime(projectedAnnualIncome);

  // Calculate remaining tax to be deducted
  const remainingTax = Math.max(0, taxResult.totalTax - previousTDS);

  // Distribute remaining tax over remaining months
  const monthlyTDS = Math.round(remainingTax / remainingMonths);

  return monthlyTDS;
}

/**
 * Get Financial Year string from date
 */
export function getFinancialYear(date: Date = new Date()): string {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  if (month >= 4) {
    // Apr to Dec: FY 2024-25 (if year is 2024)
    return `${year}-${(year + 1) % 100}`;
  } else {
    // Jan to Mar: FY 2023-24 (if year is 2024)
    return `${year - 1}-${year % 100}`;
  }
}

/**
 * Get month number in financial year (Apr = 1, Mar = 12)
 */
export function getFinancialYearMonth(date: Date = new Date()): number {
  const month = date.getMonth() + 1; // 1-12

  if (month >= 4) {
    return month - 3; // Apr = 1, May = 2, ..., Dec = 9
  } else {
    return month + 9; // Jan = 10, Feb = 11, Mar = 12
  }
}

export default {
  calculateHRAExemption,
  calculateProfessionalTax,
  calculateProvidentFund,
  calculateESIC,
  calculateTaxOldRegime,
  calculateTaxNewRegime,
  compareRegimes,
  calculateMonthlyTDS,
  getFinancialYear,
  getFinancialYearMonth
};
