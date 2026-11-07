// ====================================================================
// Automated Multi-Jurisdiction Tax & Compliance Reporting Types
// Irish & EU VAT3 / VIES + Indian GST (GSTR-3B & GSTR-1) Specifications
// ====================================================================

export type TaxJurisdiction = 'IE_VAT' | 'IN_GST' | 'US_SALES_TAX' | 'GENERAL';

export type TaxPeriodType = 'monthly' | 'bi_monthly' | 'quarterly' | 'annual' | 'custom';

export interface TaxPeriodSelection {
  type: TaxPeriodType;
  year: number;
  // For monthly: 1-12. For bi_monthly: 1-6 (1 = Jan/Feb, 2 = Mar/Apr, etc.). For quarterly: 1-4.
  periodIndex?: number;
  startDate: string;
  endDate: string;
  label: string;
}

// ----------------------------------------------------------------------
// Irish Revenue Commissioners VAT3 Return Structure
// ----------------------------------------------------------------------
export interface IrishVAT3BoxBreakdown {
  /** Box T1: VAT on Sales (Output VAT payable on domestic Irish supplies) */
  boxT1_VatOnSales: number;
  /** Box T2: VAT on Purchases (Input VAT deductible on qualifying business expenses) */
  boxT2_VatOnPurchases: number;
  /** Box T3: Net VAT Payable to Revenue (if T1 > T2) */
  boxT3_NetVatPayable: number;
  /** Box T4: Net VAT Repayable from Revenue (if T2 > T1) */
  boxT4_NetVatRepayable: number;
  /** Box E1: Total Net Value of Intra-EU Supplies of Goods & Services (VIES dispatches) */
  boxE1_IntraEuSupplies: number;
  /** Box E2: Total Net Value of Intra-EU Acquisitions of Goods & Services (Reverse charge inbound) */
  boxE2_IntraEuAcquisitions: number;
  /** ES1: Total Intra-EU B2B Services Supplied (VIES Service Schedule) */
  boxES1_IntraEuServicesSupplied: number;
  /** ES2: Total Intra-EU B2B Services Received */
  boxES2_IntraEuServicesReceived: number;
}

export interface IrishVatRateItem {
  rateName: string;
  ratePercentage: number;
  taxableNet: number;
  vatAmount: number;
  transactionCount: number;
}

export interface IrishVAT3ReturnReport {
  jurisdiction: 'IE_VAT';
  companyId: string;
  companyName: string;
  vatRegistrationNumber: string;
  currency: string; // 'EUR'
  period: TaxPeriodSelection;
  boxes: IrishVAT3BoxBreakdown;
  salesByRate: {
    standard23: IrishVatRateItem;
    reduced13_5: IrishVatRateItem;
    secondReduced9: IrishVatRateItem;
    zeroRatedDomestic: IrishVatRateItem;
    intraEuB2BZeroRated: IrishVatRateItem;
    exportNonEuZeroRated: IrishVatRateItem;
    exempt: IrishVatRateItem;
  };
  purchasesByRate: {
    standard23Deductible: IrishVatRateItem;
    reduced13_5Deductible: IrishVatRateItem;
    intraEuAcquisitionsDeductible: IrishVatRateItem;
    zeroRatedOrExempt: IrishVatRateItem;
  };
  viesDispatches: ViesDispatchRecord[];
  summary: {
    totalGrossSales: number;
    totalNetSales: number;
    totalOutputTax: number;
    totalGrossExpenses: number;
    totalNetExpenses: number;
    totalInputTaxDeductible: number;
    netLiability: number;
    isRefundDue: boolean;
  };
}

export interface ViesDispatchRecord {
  customerId: string;
  customerName: string;
  countryCode: string; // e.g. 'DE', 'FR'
  memberStateName: string;
  customerVatNumber: string;
  supplyType: 'services' | 'goods';
  totalNetValueEUR: number;
  invoiceCount: number;
}

// ----------------------------------------------------------------------
// Indian GST (Goods and Services Tax) Compliance Types
// ----------------------------------------------------------------------
export interface GSTR3BTable31Item {
  natureOfSupplies: string;
  totalTaxableValue: number;
  integratedTax: number; // IGST
  centralTax: number;    // CGST
  stateTax: number;      // SGST/UTGST
  cess: number;
}

export interface GSTR3BTable4ITCItem {
  details: string;
  integratedTax: number;
  centralTax: number;
  stateTax: number;
  cess: number;
}

export interface IndianGSTR3BReturnReport {
  jurisdiction: 'IN_GST';
  companyId: string;
  companyName: string;
  gstin: string;
  stateCode: string; // e.g. '27' for Maharashtra
  stateName: string;
  currency: string; // 'INR'
  period: TaxPeriodSelection;
  table31_OutwardSupplies: {
    taxableSuppliesOtherThanZero: GSTR3BTable31Item; // Domestic Intra & Inter
    zeroRatedSuppliesExports: GSTR3BTable31Item;     // Exports / SEZ
    otherOutwardSuppliesNilExempt: GSTR3BTable31Item;
    inwardSuppliesLiableToReverseCharge: GSTR3BTable31Item;
    nonGstOutwardSupplies: GSTR3BTable31Item;
  };
  table4_InputTaxCredit: {
    itcAvailable_ImportOfServices: GSTR3BTable4ITCItem;
    itcAvailable_ReverseCharge: GSTR3BTable4ITCItem;
    itcAvailable_AllOtherITC: GSTR3BTable4ITCItem;
    totalItcAvailable: GSTR3BTable4ITCItem;
    itcReversed_Rule42_43: GSTR3BTable4ITCItem;
    netItcAvailable: GSTR3BTable4ITCItem;
  };
  table51_TaxPayableAndPaid: {
    totalOutputTaxLiability: {
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
      total: number;
    };
    itcSetoffUtilized: {
      igstCreditUsed: { forIgst: number; forCgst: number; forSgst: number };
      cgstCreditUsed: { forCgst: number; forIgst: number };
      sgstCreditUsed: { forSgst: number; forIgst: number };
      totalItcUtilized: number;
    };
    netTaxPayableInCash: {
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
      total: number;
    };
  };
  gstr1Summary: GSTR1OutwardSummary;
  hsnSummary: HSNSACSummaryItem[];
}

export interface GSTR1OutwardSummary {
  b2bInvoicesCount: number;
  b2bTaxableValue: number;
  b2bTotalTax: number;

  b2cLargeCount: number;
  b2cLargeTaxableValue: number;
  b2cLargeTotalTax: number;

  b2cSmallCount: number;
  b2cSmallTaxableValue: number;
  b2cSmallTotalTax: number;

  exportInvoicesCount: number;
  exportTaxableValue: number;
  exportTotalTax: number;
}

export interface HSNSACSummaryItem {
  hsnSacCode: string;
  description: string;
  uqc: string; // e.g. 'OTH', 'NOS', 'HRS'
  totalQuantity: number;
  totalValue: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
}

// ----------------------------------------------------------------------
// General / Audit Transaction Item for Drilldown
// ----------------------------------------------------------------------
export interface TaxAuditTransaction {
  id: string;
  sourceType: 'invoice' | 'expense' | 'income';
  transactionNumber: string;
  date: string;
  partyName: string;
  partyTaxId: string | null;
  partyCountryCode: string;
  partyState?: string;
  direction: 'outward' | 'inward'; // outward = sales/income, inward = expense
  category: string;
  grossAmount: number;
  taxableAmount: number;
  taxRatePercent: number;
  taxAmount: number;
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  taxClassification:
    | 'DOMESTIC_STANDARD'
    | 'DOMESTIC_REDUCED'
    | 'INTRA_EU_B2B_REVERSE_CHARGE'
    | 'EXPORT_OUTSIDE_EU'
    | 'INTRA_STATE_GST'
    | 'INTER_STATE_IGST'
    | 'EXPORT_LUT_GST'
    | 'INPUT_DEDUCTIBLE'
    | 'EXEMPT';
  currency: string;
  status: string;
}

