// TypeScript types for the Rate Card System
// For calculating budgets/quotes for consulting engagements

// Cost Head interface
export interface CostHead {
  name: string;
  percentage?: number;
  value: number;
  valueINR: number;
  type?: 'base' | 'percentage' | 'fixed';
}

// Category types
export type RateCardCategory = 'Full Stack Custom' | 'AI/ML' | 'Non Technical Roles';

// Resource Level types
export type ResourceLevel = 'Junior' | 'Senior' | 'Specialist';

// Rate Card Template
export interface RateCardTemplate {
  id: string;

  // Template Information
  template_name: string;
  category: RateCardCategory;
  resource_level: ResourceLevel;

  // Pricing
  base_rate_usd: number;
  base_rate_inr: number;

  // Cost Heads
  cost_heads: CostHead[];

  // Salary Information
  estimated_annual_salary_usd?: number;
  estimated_annual_salary_inr?: number;
  estimated_monthly_salary_usd?: number;
  estimated_monthly_salary_inr?: number;
  working_hours_per_month?: number;
  working_days_per_year?: number;
  salary_to_rate_multiplier?: number;

  // Status
  is_active: boolean;
  is_default: boolean;

  // Description
  description?: string;

  // Tracking
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Cost Head Type (standard cost heads)
export interface CostHeadType {
  id: string;

  // Cost Head Information
  name: string;
  description?: string;

  // Default Settings
  default_percentage: number;
  applies_to: RateCardCategory | 'all';

  // Display
  display_order: number;

  // Status
  is_active: boolean;

  created_at: string;
  updated_at: string;
}

// Quote Rate Card (customized for specific quote)
export interface QuoteRateCard {
  id: string;

  // Links
  quote_id?: string;
  template_id?: string;

  // Rate Card Details
  category: RateCardCategory;
  resource_level: ResourceLevel;

  // Customized Pricing
  rate_usd: number;
  rate_inr: number;

  // Customized Cost Heads
  cost_heads: CostHead[];

  // Resource Allocation
  quantity: number;
  unit: string;

  // Calculations
  subtotal_usd: number;
  subtotal_inr: number;

  // Notes
  notes?: string;

  created_at: string;
  updated_at: string;

  // Populated from relations
  template?: RateCardTemplate;
}

// Form types for creating/editing
export interface CreateRateCardTemplateData {
  template_name: string;
  category: RateCardCategory;
  resource_level: ResourceLevel;
  base_rate_usd: number;
  base_rate_inr: number;
  cost_heads: CostHead[];
  estimated_annual_salary_usd?: number;
  estimated_annual_salary_inr?: number;
  estimated_monthly_salary_usd?: number;
  estimated_monthly_salary_inr?: number;
  working_hours_per_month?: number;
  working_days_per_year?: number;
  salary_to_rate_multiplier?: number;
  is_active?: boolean;
  is_default?: boolean;
  description?: string;
}

export interface UpdateRateCardTemplateData {
  template_name?: string;
  category?: RateCardCategory;
  resource_level?: ResourceLevel;
  base_rate_usd?: number;
  base_rate_inr?: number;
  cost_heads?: CostHead[];
  estimated_annual_salary_usd?: number;
  estimated_annual_salary_inr?: number;
  estimated_monthly_salary_usd?: number;
  estimated_monthly_salary_inr?: number;
  working_hours_per_month?: number;
  working_days_per_year?: number;
  salary_to_rate_multiplier?: number;
  is_active?: boolean;
  is_default?: boolean;
  description?: string;
}

export interface CreateCostHeadTypeData {
  name: string;
  description?: string;
  default_percentage: number;
  applies_to: RateCardCategory | 'all';
  display_order?: number;
  is_active?: boolean;
}

export interface UpdateCostHeadTypeData {
  name?: string;
  description?: string;
  default_percentage?: number;
  applies_to?: RateCardCategory | 'all';
  display_order?: number;
  is_active?: boolean;
}

export interface CreateQuoteRateCardData {
  quote_id?: string;
  template_id?: string;
  category: RateCardCategory;
  resource_level: ResourceLevel;
  rate_usd: number;
  rate_inr: number;
  cost_heads: CostHead[];
  quantity: number;
  unit: string;
  notes?: string;
}

export interface UpdateQuoteRateCardData {
  template_id?: string;
  category?: RateCardCategory;
  resource_level?: ResourceLevel;
  rate_usd?: number;
  rate_inr?: number;
  cost_heads?: CostHead[];
  quantity?: number;
  unit?: string;
  notes?: string;
}

// Rate Card Calculation
export interface RateCardCalculation {
  base_rate_usd: number;
  base_rate_inr: number;
  cost_heads: CostHead[];
  total_rate_usd: number;
  total_rate_inr: number;
  total_cost_heads_usd: number;
  total_cost_heads_inr: number;
}

// Helper function to calculate total rate from cost heads
export function calculateTotalRate(baseRateUSD: number, baseRateINR: number, costHeads: CostHead[]): RateCardCalculation {
  let totalCostHeadsUSD = 0;
  let totalCostHeadsINR = 0;

  const calculatedCostHeads: CostHead[] = costHeads.map((head) => {
    if (head.type === 'base') {
      return head;
    }

    const valueUSD = head.percentage ? (baseRateUSD * head.percentage) / 100 : head.value;
    const valueINR = head.percentage ? (baseRateINR * head.percentage) / 100 : head.valueINR;

    totalCostHeadsUSD += valueUSD;
    totalCostHeadsINR += valueINR;

    return {
      ...head,
      value: valueUSD,
      valueINR: valueINR,
    };
  });

  return {
    base_rate_usd: baseRateUSD,
    base_rate_inr: baseRateINR,
    cost_heads: calculatedCostHeads,
    total_cost_heads_usd: totalCostHeadsUSD,
    total_cost_heads_inr: totalCostHeadsINR,
    total_rate_usd: baseRateUSD + totalCostHeadsUSD,
    total_rate_inr: baseRateINR + totalCostHeadsINR,
  };
}

// Search and Filter types
export interface RateCardFilters {
  category?: RateCardCategory;
  resource_level?: ResourceLevel;
  is_active?: boolean;
  search?: string;
}

// Statistics
export interface RateCardStats {
  total_templates: number;
  active_templates: number;
  templates_by_category: Record<RateCardCategory, number>;
  templates_by_level: Record<ResourceLevel, number>;
  avg_rate_usd: number;
  avg_rate_inr: number;
}

// Salary Analysis
export interface SalaryAnalysis {
  // Salary Information
  annual_salary_usd: number;
  annual_salary_inr: number;
  monthly_salary_usd: number;
  monthly_salary_inr: number;

  // Hourly Equivalents
  hourly_salary_equivalent_usd: number;
  hourly_salary_equivalent_inr: number;

  // Rate Information
  hourly_rate_usd: number;
  hourly_rate_inr: number;

  // Markup Analysis
  markup_amount_usd: number;
  markup_amount_inr: number;
  markup_percentage: number;

  // Revenue Projections
  potential_annual_revenue_usd: number;
  potential_annual_revenue_inr: number;
  potential_monthly_revenue_usd: number;
  potential_monthly_revenue_inr: number;

  // Margin Analysis
  gross_margin_usd: number;
  gross_margin_inr: number;
  gross_margin_percentage: number;

  // Working Parameters
  working_hours_per_month: number;
  working_days_per_year: number;
  overhead_multiplier: number;
}

// Salary Simulation
export interface SalarySimulation {
  original_monthly_salary_usd: number;
  original_monthly_salary_inr: number;
  new_monthly_salary_usd: number;
  new_monthly_salary_inr: number;

  original_rate_usd: number;
  original_rate_inr: number;
  new_rate_usd: number;
  new_rate_inr: number;

  rate_change_usd: number;
  rate_change_inr: number;
  rate_change_percentage: number;

  annual_cost_impact_usd: number;
  annual_cost_impact_inr: number;
}

// Helper function to calculate rate from salary
export function calculateRateFromSalary(
  monthlySalaryUSD: number,
  monthlySalaryINR: number,
  workingHours: number = 160,
  overheadPercentage: number = 75
): { rateUSD: number; rateINR: number } {
  const multiplier = 1 + overheadPercentage / 100;
  const hourlySalaryUSD = monthlySalaryUSD / workingHours;
  const hourlySalaryINR = monthlySalaryINR / workingHours;

  return {
    rateUSD: parseFloat((hourlySalaryUSD * multiplier).toFixed(2)),
    rateINR: parseFloat((hourlySalaryINR * multiplier).toFixed(2)),
  };
}

// Helper function to calculate salary from rate
export function calculateSalaryFromRate(
  hourlyRateUSD: number,
  hourlyRateINR: number,
  workingHours: number = 160,
  overheadPercentage: number = 75
): { monthlySalaryUSD: number; monthlySalaryINR: number } {
  const multiplier = 1 + overheadPercentage / 100;
  const hourlySalaryUSD = hourlyRateUSD / multiplier;
  const hourlySalaryINR = hourlyRateINR / multiplier;

  return {
    monthlySalaryUSD: parseFloat((hourlySalaryUSD * workingHours).toFixed(2)),
    monthlySalaryINR: parseFloat((hourlySalaryINR * workingHours).toFixed(2)),
  };
}

// Helper function to analyze salary vs rate
export function analyzeSalaryToRate(template: RateCardTemplate): SalaryAnalysis | null {
  if (
    !template.estimated_monthly_salary_usd ||
    !template.estimated_monthly_salary_inr ||
    !template.working_hours_per_month
  ) {
    return null;
  }

  const workingHours = template.working_hours_per_month;
  const workingDays = template.working_days_per_year || 220;
  const overheadMultiplier = template.salary_to_rate_multiplier || 1.75;

  // Calculate hourly salary equivalents
  const hourlySalaryUSD = template.estimated_monthly_salary_usd / workingHours;
  const hourlySalaryINR = template.estimated_monthly_salary_inr / workingHours;

  // Calculate total hourly rate (base rate + all cost heads)
  const totalRateCalculation = calculateTotalRate(
    template.base_rate_usd,
    template.base_rate_inr,
    template.cost_heads
  );
  const totalHourlyRateUSD = totalRateCalculation.total_rate_usd;
  const totalHourlyRateINR = totalRateCalculation.total_rate_inr;

  // Calculate markup based on total rate (includes all cost heads)
  const markupUSD = totalHourlyRateUSD - hourlySalaryUSD;
  const markupINR = totalHourlyRateINR - hourlySalaryINR;
  const markupPercentage = ((markupUSD / hourlySalaryUSD) * 100);

  // Calculate revenue projections based on total rate
  const annualRevenueUSD = totalHourlyRateUSD * workingHours * 12;
  const annualRevenueINR = totalHourlyRateINR * workingHours * 12;
  const monthlyRevenueUSD = totalHourlyRateUSD * workingHours;
  const monthlyRevenueINR = totalHourlyRateINR * workingHours;

  // Calculate gross margins
  const annualSalaryUSD = template.estimated_annual_salary_usd || template.estimated_monthly_salary_usd * 12;
  const annualSalaryINR = template.estimated_annual_salary_inr || template.estimated_monthly_salary_inr * 12;
  const grossMarginUSD = annualRevenueUSD - annualSalaryUSD;
  const grossMarginINR = annualRevenueINR - annualSalaryINR;
  const grossMarginPercentage = (grossMarginUSD / annualRevenueUSD) * 100;

  return {
    annual_salary_usd: annualSalaryUSD,
    annual_salary_inr: annualSalaryINR,
    monthly_salary_usd: template.estimated_monthly_salary_usd,
    monthly_salary_inr: template.estimated_monthly_salary_inr,
    hourly_salary_equivalent_usd: parseFloat(hourlySalaryUSD.toFixed(2)),
    hourly_salary_equivalent_inr: parseFloat(hourlySalaryINR.toFixed(2)),
    hourly_rate_usd: totalHourlyRateUSD,
    hourly_rate_inr: totalHourlyRateINR,
    markup_amount_usd: parseFloat(markupUSD.toFixed(2)),
    markup_amount_inr: parseFloat(markupINR.toFixed(2)),
    markup_percentage: parseFloat(markupPercentage.toFixed(2)),
    potential_annual_revenue_usd: parseFloat(annualRevenueUSD.toFixed(2)),
    potential_annual_revenue_inr: parseFloat(annualRevenueINR.toFixed(2)),
    potential_monthly_revenue_usd: parseFloat(monthlyRevenueUSD.toFixed(2)),
    potential_monthly_revenue_inr: parseFloat(monthlyRevenueINR.toFixed(2)),
    gross_margin_usd: parseFloat(grossMarginUSD.toFixed(2)),
    gross_margin_inr: parseFloat(grossMarginINR.toFixed(2)),
    gross_margin_percentage: parseFloat(grossMarginPercentage.toFixed(2)),
    working_hours_per_month: workingHours,
    working_days_per_year: workingDays,
    overhead_multiplier: overheadMultiplier,
  };
}

// Helper function to simulate salary change impact
export function simulateSalaryChange(
  currentMonthlySalaryUSD: number,
  currentMonthlySalaryINR: number,
  newMonthlySalaryUSD: number,
  newMonthlySalaryINR: number,
  workingHours: number = 160,
  overheadPercentage: number = 75
): SalarySimulation {
  const originalRate = calculateRateFromSalary(
    currentMonthlySalaryUSD,
    currentMonthlySalaryINR,
    workingHours,
    overheadPercentage
  );

  const newRate = calculateRateFromSalary(
    newMonthlySalaryUSD,
    newMonthlySalaryINR,
    workingHours,
    overheadPercentage
  );

  const rateChangeUSD = newRate.rateUSD - originalRate.rateUSD;
  const rateChangeINR = newRate.rateINR - originalRate.rateINR;
  const rateChangePercentage = ((rateChangeUSD / originalRate.rateUSD) * 100);

  const annualCostImpactUSD = (newMonthlySalaryUSD - currentMonthlySalaryUSD) * 12;
  const annualCostImpactINR = (newMonthlySalaryINR - currentMonthlySalaryINR) * 12;

  return {
    original_monthly_salary_usd: currentMonthlySalaryUSD,
    original_monthly_salary_inr: currentMonthlySalaryINR,
    new_monthly_salary_usd: newMonthlySalaryUSD,
    new_monthly_salary_inr: newMonthlySalaryINR,
    original_rate_usd: originalRate.rateUSD,
    original_rate_inr: originalRate.rateINR,
    new_rate_usd: newRate.rateUSD,
    new_rate_inr: newRate.rateINR,
    rate_change_usd: parseFloat(rateChangeUSD.toFixed(2)),
    rate_change_inr: parseFloat(rateChangeINR.toFixed(2)),
    rate_change_percentage: parseFloat(rateChangePercentage.toFixed(2)),
    annual_cost_impact_usd: parseFloat(annualCostImpactUSD.toFixed(2)),
    annual_cost_impact_inr: parseFloat(annualCostImpactINR.toFixed(2)),
  };
}
