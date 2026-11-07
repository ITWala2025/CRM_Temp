// ====================================================================
// Automated Multi-Jurisdiction Tax & Compliance Reporting Service
// Automates:
// 1. Irish & EU VAT3 Return + VIES European Dispatches (Revenue Commissioners)
// 2. Indian GST (GSTR-3B & GSTR-1) + HSN/SAC + Input Tax Credit (ITC) Set-Off
// ====================================================================

import { mockStore } from '../data/mockStore';
import type { Invoice, Customer, CompanySettings } from '../types/invoice';
import type { Expense } from './expenseService';
import type { ManualTransaction } from './financeService';
import type {
  TaxJurisdiction,
  TaxPeriodSelection,
  TaxPeriodType,
  IrishVAT3ReturnReport,
  IrishVAT3BoxBreakdown,
  IrishVatRateItem,
  ViesDispatchRecord,
  IndianGSTR3BReturnReport,
  GSTR3BTable31Item,
  GSTR3BTable4ITCItem,
  GSTR1OutwardSummary,
  HSNSACSummaryItem,
  TaxAuditTransaction,
} from '../types/taxReport';

const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE', 'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST',
  'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX',
  'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE'
]);

export class TaxReportingService {
  /**
   * Determine the statutory tax jurisdiction from company settings
   */
  public static getJurisdiction(company: CompanySettings | undefined | null): TaxJurisdiction {
    if (!company) return 'IE_VAT';
    const code = (company.country_id || company.country?.code || '').toUpperCase();
    if (code === 'IN' || code === 'IND' || code === 'COUNTRY-IND') return 'IN_GST';
    if (code === 'IE' || code === 'IRL' || code === 'COUNTRY-IRL') return 'IE_VAT';
    if (code === 'US' || code === 'USA' || code === 'COUNTRY-USA') return 'US_SALES_TAX';
    return 'IE_VAT';
  }

  /**
   * Helper to check if a country code is within the European Union
   */
  public static isEUCountry(countryCode?: string | null): boolean {
    if (!countryCode) return false;
    return EU_COUNTRY_CODES.has(countryCode.trim().toUpperCase());
  }

  /**
   * Generate available filing periods for a given year and jurisdiction
   */
  public static getAvailablePeriods(year: number, jurisdiction: TaxJurisdiction): TaxPeriodSelection[] {
    if (jurisdiction === 'IN_GST') {
      // Indian Financial Year: April 1 to March 31
      return [
        {
          type: 'monthly',
          year,
          periodIndex: 1,
          startDate: `${year}-04-01`,
          endDate: `${year}-04-30`,
          label: `April ${year} (Monthly)`,
        },
        {
          type: 'monthly',
          year,
          periodIndex: 2,
          startDate: `${year}-05-01`,
          endDate: `${year}-05-31`,
          label: `May ${year} (Monthly)`,
        },
        {
          type: 'monthly',
          year,
          periodIndex: 3,
          startDate: `${year}-06-01`,
          endDate: `${year}-06-30`,
          label: `June ${year} (Monthly)`,
        },
        {
          type: 'quarterly',
          year,
          periodIndex: 1,
          startDate: `${year}-04-01`,
          endDate: `${year}-06-30`,
          label: `Q1 (Apr - Jun ${year})`,
        },
        {
          type: 'quarterly',
          year,
          periodIndex: 2,
          startDate: `${year}-07-01`,
          endDate: `${year}-07-30`,
          label: `Q2 (Jul - Sep ${year})`,
        },
        {
          type: 'quarterly',
          year,
          periodIndex: 3,
          startDate: `${year}-10-01`,
          endDate: `${year}-12-31`,
          label: `Q3 (Oct - Dec ${year})`,
        },
        {
          type: 'quarterly',
          year,
          periodIndex: 4,
          startDate: `${year + 1}-01-01`,
          endDate: `${year + 1}-03-31`,
          label: `Q4 (Jan - Mar ${year + 1})`,
        },
        {
          type: 'annual',
          year,
          startDate: `${year}-04-01`,
          endDate: `${year + 1}-03-31`,
          label: `Full FY ${year}-${(year + 1).toString().slice(-2)}`,
        },
        {
          type: 'custom',
          year,
          startDate: `${year}-01-01`,
          endDate: `${year}-12-31`,
          label: `Calendar Year ${year}`,
        },
      ];
    }

    // Default: Irish & EU VAT3 (Standard Bi-Monthly Cycles + Calendar Quarter + Annual)
    return [
      {
        type: 'bi_monthly',
        year,
        periodIndex: 1,
        startDate: `${year}-01-01`,
        endDate: `${year}-02-28`,
        label: `Jan / Feb ${year} (Period 1)`,
      },
      {
        type: 'bi_monthly',
        year,
        periodIndex: 2,
        startDate: `${year}-03-01`,
        endDate: `${year}-04-30`,
        label: `Mar / Apr ${year} (Period 2)`,
      },
      {
        type: 'bi_monthly',
        year,
        periodIndex: 3,
        startDate: `${year}-05-01`,
        endDate: `${year}-06-30`,
        label: `May / Jun ${year} (Period 3)`,
      },
      {
        type: 'bi_monthly',
        year,
        periodIndex: 4,
        startDate: `${year}-07-01`,
        endDate: `${year}-08-31`,
        label: `Jul / Aug ${year} (Period 4)`,
      },
      {
        type: 'bi_monthly',
        year,
        periodIndex: 5,
        startDate: `${year}-09-01`,
        endDate: `${year}-10-31`,
        label: `Sep / Oct ${year} (Period 5)`,
      },
      {
        type: 'bi_monthly',
        year,
        periodIndex: 6,
        startDate: `${year}-11-01`,
        endDate: `${year}-12-31`,
        label: `Nov / Dec ${year} (Period 6)`,
      },
      {
        type: 'quarterly',
        year,
        periodIndex: 1,
        startDate: `${year}-01-01`,
        endDate: `${year}-03-31`,
        label: `Q1 (Jan - Mar ${year})`,
      },
      {
        type: 'quarterly',
        year,
        periodIndex: 2,
        startDate: `${year}-04-01`,
        endDate: `${year}-06-30`,
        label: `Q2 (Apr - Jun ${year})`,
      },
      {
        type: 'quarterly',
        year,
        periodIndex: 3,
        startDate: `${year}-07-01`,
        endDate: `${year}-09-30`,
        label: `Q3 (Jul - Sep ${year})`,
      },
      {
        type: 'quarterly',
        year,
        periodIndex: 4,
        startDate: `${year}-10-01`,
        endDate: `${year}-12-31`,
        label: `Q4 (Oct - Dec ${year})`,
      },
      {
        type: 'annual',
        year,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        label: `Full Year ${year} (Annual Summary)`,
      },
    ];
  }

  // ====================================================================
  // 1. IRISH & EU VAT3 RETURN GENERATION (Revenue Commissioners Ireland)
  // ====================================================================

  public static async generateIrishVAT3Report(
    companyId: string,
    period: TaxPeriodSelection
  ): Promise<{ report: IrishVAT3ReturnReport; auditTransactions: TaxAuditTransaction[] }> {
    const companies = mockStore.get<CompanySettings>('company_settings');
    const company = companies.find((c) => c.id === companyId) || companies.find((c) => c.is_default) || companies[0];

    const invoices = mockStore.get<Invoice>('invoices');
    const expenses = mockStore.get<Expense>('expenses');
    const manualTransactions = mockStore.get<ManualTransaction>('manual_transactions');
    const customers = mockStore.get<Customer>('customers');

    const startDate = period.startDate;
    const endDate = period.endDate;

    const auditTransactions: TaxAuditTransaction[] = [];

    // Filter relevant Invoices (Sales / Output VAT)
    const periodInvoices = invoices.filter((inv) => {
      const matchCompany = !companyId || inv.company_settings_id === companyId || !inv.company_settings_id;
      const matchDate = inv.invoice_date >= startDate && inv.invoice_date <= endDate;
      const matchStatus = inv.status !== 'cancelled';
      return matchCompany && matchDate && matchStatus;
    });

    // Filter relevant Income transactions
    const periodIncome = manualTransactions.filter((tx) => {
      const matchDate = tx.transaction_date >= startDate && tx.transaction_date <= endDate;
      return tx.transaction_type === 'income' && matchDate;
    });

    // Filter relevant Expenses (Purchases / Input VAT)
    const periodExpenses = expenses.filter((exp) => {
      const matchCompany = !companyId || exp.company_settings_id === companyId || !exp.company_settings_id;
      const matchDate = exp.expense_date >= startDate && exp.expense_date <= endDate;
      const matchStatus = exp.status !== 'rejected';
      return matchCompany && matchDate && matchStatus;
    });

    // Initial rate buckets
    const createRateBucket = (name: string, pct: number): IrishVatRateItem => ({
      rateName: name,
      ratePercentage: pct,
      taxableNet: 0,
      vatAmount: 0,
      transactionCount: 0,
    });

    const salesByRate = {
      standard23: createRateBucket('Standard Rate (23%)', 23),
      reduced13_5: createRateBucket('Reduced Rate (13.5%)', 13.5),
      secondReduced9: createRateBucket('Second Reduced Rate (9%)', 9),
      zeroRatedDomestic: createRateBucket('Zero-Rated Domestic (0%)', 0),
      intraEuB2BZeroRated: createRateBucket('Intra-EU B2B Reverse Charge (0%)', 0),
      exportNonEuZeroRated: createRateBucket('Export Outside EU (0%)', 0),
      exempt: createRateBucket('Exempt Supplies', 0),
    };

    const purchasesByRate = {
      standard23Deductible: createRateBucket('Standard Rate Purchases (23%)', 23),
      reduced13_5Deductible: createRateBucket('Reduced Rate Purchases (13.5%)', 13.5),
      intraEuAcquisitionsDeductible: createRateBucket('Intra-EU Acquisitions Reverse Charge', 23),
      zeroRatedOrExempt: createRateBucket('Zero-Rated / Exempt Purchases', 0),
    };

    let boxT1 = 0; // VAT on Sales
    let boxT2 = 0; // VAT on Purchases
    let boxE1 = 0; // Intra-EU supplies of goods/services
    let boxE2 = 0; // Intra-EU acquisitions
    let boxES1 = 0; // Intra-EU services supplied
    let boxES2 = 0; // Intra-EU services received

    const viesMap = new Map<string, ViesDispatchRecord>();

    // 1. Process Outward Invoices
    for (const inv of periodInvoices) {
      const customer = customers.find((c) => c.id === inv.customer_id) || inv.customer;
      const customerCountry = (customer?.country?.code || customer?.country_id || 'IRL').toUpperCase();
      const hasVatNumber = Boolean(customer?.vat_number && customer.vat_number.trim().length > 4);
      const isIreland = customerCountry === 'IRL' || customerCountry === 'IE';
      const isEU = !isIreland && TaxReportingService.isEUCountry(customerCountry);
      const isNonEUExport = !isIreland && !isEU;

      const netAmount = Number(inv.subtotal || 0);
      const vatAmount = Number(inv.tax_amount || 0);
      const grossAmount = Number(inv.total_amount || 0);

      let classification: TaxAuditTransaction['taxClassification'] = 'DOMESTIC_STANDARD';

      if (isIreland) {
        // Domestic Irish Supply
        if (vatAmount > 0) {
          const effectiveRate = netAmount > 0 ? (vatAmount / netAmount) * 100 : 23;
          if (effectiveRate > 18) {
            salesByRate.standard23.taxableNet += netAmount;
            salesByRate.standard23.vatAmount += vatAmount;
            salesByRate.standard23.transactionCount += 1;
            classification = 'DOMESTIC_STANDARD';
          } else {
            salesByRate.reduced13_5.taxableNet += netAmount;
            salesByRate.reduced13_5.vatAmount += vatAmount;
            salesByRate.reduced13_5.transactionCount += 1;
            classification = 'DOMESTIC_REDUCED';
          }
          boxT1 += vatAmount;
        } else {
          salesByRate.zeroRatedDomestic.taxableNet += netAmount;
          salesByRate.zeroRatedDomestic.transactionCount += 1;
          classification = 'EXEMPT';
        }
      } else if (isEU) {
        // Intra-EU Supply
        if (hasVatNumber) {
          // B2B Reverse charge under Article 196 EU VAT Directive
          salesByRate.intraEuB2BZeroRated.taxableNet += netAmount;
          salesByRate.intraEuB2BZeroRated.transactionCount += 1;
          boxE1 += netAmount;
          boxES1 += netAmount; // Services dispatch
          classification = 'INTRA_EU_B2B_REVERSE_CHARGE';

          // Track for VIES return
          const custKey = customer?.id || customer?.company_name || 'unknown';
          const existingVies = viesMap.get(custKey);
          if (existingVies) {
            existingVies.totalNetValueEUR += netAmount;
            existingVies.invoiceCount += 1;
          } else {
            viesMap.set(custKey, {
              customerId: customer?.id || '',
              customerName: customer?.company_name || 'EU Enterprise Client',
              countryCode: customerCountry.slice(0, 2),
              memberStateName: customer?.country?.name || customerCountry,
              customerVatNumber: customer?.vat_number || '',
              supplyType: 'services',
              totalNetValueEUR: netAmount,
              invoiceCount: 1,
            });
          }
        } else {
          // B2C EU supply without VAT ID -> Subject to standard Irish VAT
          salesByRate.standard23.taxableNet += netAmount;
          salesByRate.standard23.vatAmount += vatAmount;
          salesByRate.standard23.transactionCount += 1;
          boxT1 += vatAmount;
          classification = 'DOMESTIC_STANDARD';
        }
      } else if (isNonEUExport) {
        // Non-EU Export (Zero-Rated)
        salesByRate.exportNonEuZeroRated.taxableNet += netAmount;
        salesByRate.exportNonEuZeroRated.transactionCount += 1;
        classification = 'EXPORT_OUTSIDE_EU';
      }

      auditTransactions.push({
        id: inv.id,
        sourceType: 'invoice',
        transactionNumber: inv.invoice_number,
        date: inv.invoice_date,
        partyName: customer?.company_name || 'Client',
        partyTaxId: customer?.vat_number || null,
        partyCountryCode: customerCountry,
        direction: 'outward',
        category: 'Invoiced Sales',
        grossAmount,
        taxableAmount: netAmount,
        taxRatePercent: netAmount > 0 ? Math.round((vatAmount / netAmount) * 100) : 0,
        taxAmount: vatAmount,
        taxClassification: classification,
        currency: inv.currency_code || 'EUR',
        status: inv.payment_status,
      });
    }

    // 2. Process Manual Income Transactions
    for (const tx of periodIncome) {
      const netAmount = Number(tx.net_amount || tx.amount || 0);
      const taxAmount = Number(tx.tax_amount || 0);
      const grossAmount = Number(tx.amount || 0);

      if (taxAmount > 0) {
        boxT1 += taxAmount;
        salesByRate.standard23.taxableNet += netAmount;
        salesByRate.standard23.vatAmount += taxAmount;
        salesByRate.standard23.transactionCount += 1;
      } else {
        salesByRate.exempt.taxableNet += netAmount;
        salesByRate.exempt.transactionCount += 1;
      }

      auditTransactions.push({
        id: tx.id,
        sourceType: 'income',
        transactionNumber: tx.transaction_number,
        date: tx.transaction_date,
        partyName: tx.party_name || 'Income Received',
        partyTaxId: null,
        partyCountryCode: 'IRL',
        direction: 'outward',
        category: tx.category || 'Direct Income',
        grossAmount,
        taxableAmount: netAmount,
        taxRatePercent: netAmount > 0 && taxAmount > 0 ? Math.round((taxAmount / netAmount) * 100) : 0,
        taxAmount,
        taxClassification: taxAmount > 0 ? 'DOMESTIC_STANDARD' : 'EXEMPT',
        currency: tx.currency || 'EUR',
        status: 'completed',
      });
    }

    // 3. Process Inward Expenses (Purchases & Input VAT)
    for (const exp of periodExpenses) {
      const netAmount = Number(exp.amount || 0);
      const taxAmount = Number(exp.tax_amount || 0);
      const grossAmount = Number(exp.total_amount || 0);

      // Check if vendor is EU reverse charge (e.g. AWS EMEA SARL in Luxembourg)
      const vendorName = (exp.vendor_name || exp.title || '').toLowerCase();
      const isEuVendor = vendorName.includes('emea') || vendorName.includes('sarl') || vendorName.includes('aws') || vendorName.includes('google cloud emea');

      let classification: TaxAuditTransaction['taxClassification'] = 'INPUT_DEDUCTIBLE';

      if (taxAmount > 0) {
        boxT2 += taxAmount;
        purchasesByRate.standard23Deductible.taxableNet += netAmount;
        purchasesByRate.standard23Deductible.vatAmount += taxAmount;
        purchasesByRate.standard23Deductible.transactionCount += 1;
        classification = 'INPUT_DEDUCTIBLE';
      } else if (isEuVendor) {
        // Intra-EU Acquisition under Reverse Charge
        const calculatedVat = Math.round(netAmount * 0.23);
        boxE2 += netAmount;
        boxES2 += netAmount;
        purchasesByRate.intraEuAcquisitionsDeductible.taxableNet += netAmount;
        purchasesByRate.intraEuAcquisitionsDeductible.vatAmount += calculatedVat;
        purchasesByRate.intraEuAcquisitionsDeductible.transactionCount += 1;
        // In self-accounting reverse charge, both T1 and T2 are increased equally
        boxT1 += calculatedVat;
        boxT2 += calculatedVat;
        classification = 'INTRA_EU_B2B_REVERSE_CHARGE';
      } else {
        purchasesByRate.zeroRatedOrExempt.taxableNet += netAmount;
        purchasesByRate.zeroRatedOrExempt.transactionCount += 1;
        classification = 'EXEMPT';
      }

      auditTransactions.push({
        id: exp.id,
        sourceType: 'expense',
        transactionNumber: exp.expense_number,
        date: exp.expense_date,
        partyName: exp.vendor_name || exp.title,
        partyTaxId: null,
        partyCountryCode: isEuVendor ? 'LU' : 'IRL',
        direction: 'inward',
        category: 'Operational Expense',
        grossAmount,
        taxableAmount: netAmount,
        taxRatePercent: netAmount > 0 && taxAmount > 0 ? Math.round((taxAmount / netAmount) * 100) : isEuVendor ? 23 : 0,
        taxAmount,
        taxClassification: classification,
        currency: exp.currency || 'EUR',
        status: exp.payment_status,
      });
    }

    // Official Irish Box Calculations
    const netDifference = boxT1 - boxT2;
    const boxT3 = netDifference > 0 ? Math.round(netDifference) : 0;
    const boxT4 = netDifference < 0 ? Math.round(Math.abs(netDifference)) : 0;

    const boxes: IrishVAT3BoxBreakdown = {
      boxT1_VatOnSales: Math.round(boxT1),
      boxT2_VatOnPurchases: Math.round(boxT2),
      boxT3_NetVatPayable: boxT3,
      boxT4_NetVatRepayable: boxT4,
      boxE1_IntraEuSupplies: Math.round(boxE1),
      boxE2_IntraEuAcquisitions: Math.round(boxE2),
      boxES1_IntraEuServicesSupplied: Math.round(boxES1),
      boxES2_IntraEuServicesReceived: Math.round(boxES2),
    };

    const totalNetSales =
      salesByRate.standard23.taxableNet +
      salesByRate.reduced13_5.taxableNet +
      salesByRate.secondReduced9.taxableNet +
      salesByRate.zeroRatedDomestic.taxableNet +
      salesByRate.intraEuB2BZeroRated.taxableNet +
      salesByRate.exportNonEuZeroRated.taxableNet +
      salesByRate.exempt.taxableNet;

    const totalNetExpenses =
      purchasesByRate.standard23Deductible.taxableNet +
      purchasesByRate.reduced13_5Deductible.taxableNet +
      purchasesByRate.intraEuAcquisitionsDeductible.taxableNet +
      purchasesByRate.zeroRatedOrExempt.taxableNet;

    const report: IrishVAT3ReturnReport = {
      jurisdiction: 'IE_VAT',
      companyId: company.id,
      companyName: company.company_name || 'Acme Cloud Technologies Ireland Ltd',
      vatRegistrationNumber: company.vat_number || 'IE987654321A',
      currency: 'EUR',
      period,
      boxes,
      salesByRate,
      purchasesByRate,
      viesDispatches: Array.from(viesMap.values()),
      summary: {
        totalGrossSales: totalNetSales + boxT1,
        totalNetSales,
        totalOutputTax: boxT1,
        totalGrossExpenses: totalNetExpenses + boxT2,
        totalNetExpenses,
        totalInputTaxDeductible: boxT2,
        netLiability: boxT3 > 0 ? boxT3 : -boxT4,
        isRefundDue: boxT4 > 0,
      },
    };

    // Sort audit transactions descending by date
    auditTransactions.sort((a, b) => b.date.localeCompare(a.date));

    return { report, auditTransactions };
  }

  // ====================================================================
  // 2. INDIAN GST REPORT GENERATION (GSTR-3B & GSTR-1 & ITC SET-OFF)
  // ====================================================================

  public static async generateIndianGSTReport(
    companyId: string,
    period: TaxPeriodSelection
  ): Promise<{ report: IndianGSTR3BReturnReport; auditTransactions: TaxAuditTransaction[] }> {
    const companies = mockStore.get<CompanySettings>('company_settings');
    const company = companies.find((c) => c.id === companyId) || companies.find((c) => (c.country_id || '').includes('ind')) || companies[0];

    const companyGstin = company.gstin || '27AABCA1234F1ZQ';
    const homeStateCode = companyGstin.slice(0, 2) || '27'; // Default Maharashtra 27

    const invoices = mockStore.get<Invoice>('invoices');
    const expenses = mockStore.get<Expense>('expenses');
    const manualTransactions = mockStore.get<ManualTransaction>('manual_transactions');
    const customers = mockStore.get<Customer>('customers');

    const startDate = period.startDate;
    const endDate = period.endDate;

    const auditTransactions: TaxAuditTransaction[] = [];

    // Filter relevant Invoices for Indian Entity
    const periodInvoices = invoices.filter((inv) => {
      const matchCompany = !companyId || inv.company_settings_id === companyId || !inv.company_settings_id;
      const matchDate = inv.invoice_date >= startDate && inv.invoice_date <= endDate;
      const matchStatus = inv.status !== 'cancelled';
      return matchCompany && matchDate && matchStatus;
    });

    const periodIncome = manualTransactions.filter((tx) => {
      const matchDate = tx.transaction_date >= startDate && tx.transaction_date <= endDate;
      return tx.transaction_type === 'income' && matchDate;
    });

    const periodExpenses = expenses.filter((exp) => {
      const matchCompany = !companyId || exp.company_settings_id === companyId || !exp.company_settings_id;
      const matchDate = exp.expense_date >= startDate && exp.expense_date <= endDate;
      const matchStatus = exp.status !== 'rejected';
      return matchCompany && matchDate && matchStatus;
    });

    // GSTR-3B Table 3.1 Initial State
    const table31: IndianGSTR3BReturnReport['table31_OutwardSupplies'] = {
      taxableSuppliesOtherThanZero: {
        natureOfSupplies: '(a) Outward taxable supplies (other than zero rated, nil and exempted)',
        totalTaxableValue: 0,
        integratedTax: 0,
        centralTax: 0,
        stateTax: 0,
        cess: 0,
      },
      zeroRatedSuppliesExports: {
        natureOfSupplies: '(b) Outward taxable supplies (zero rated - Exports / SEZ)',
        totalTaxableValue: 0,
        integratedTax: 0,
        centralTax: 0,
        stateTax: 0,
        cess: 0,
      },
      otherOutwardSuppliesNilExempt: {
        natureOfSupplies: '(c) Other outward supplies (Nil rated, exempted)',
        totalTaxableValue: 0,
        integratedTax: 0,
        centralTax: 0,
        stateTax: 0,
        cess: 0,
      },
      inwardSuppliesLiableToReverseCharge: {
        natureOfSupplies: '(d) Inward supplies (liable to reverse charge)',
        totalTaxableValue: 0,
        integratedTax: 0,
        centralTax: 0,
        stateTax: 0,
        cess: 0,
      },
      nonGstOutwardSupplies: {
        natureOfSupplies: '(e) Non-GST outward supplies',
        totalTaxableValue: 0,
        integratedTax: 0,
        centralTax: 0,
        stateTax: 0,
        cess: 0,
      },
    };

    // GSTR-1 Summary State
    const gstr1Summary: GSTR1OutwardSummary = {
      b2bInvoicesCount: 0,
      b2bTaxableValue: 0,
      b2bTotalTax: 0,
      b2cLargeCount: 0,
      b2cLargeTaxableValue: 0,
      b2cLargeTotalTax: 0,
      b2cSmallCount: 0,
      b2cSmallTaxableValue: 0,
      b2cSmallTotalTax: 0,
      exportInvoicesCount: 0,
      exportTaxableValue: 0,
      exportTotalTax: 0,
    };

    const hsnMap = new Map<string, HSNSACSummaryItem>();

    // 1. Process Outward Sales Invoices
    for (const inv of periodInvoices) {
      const customer = customers.find((c) => c.id === inv.customer_id) || inv.customer;
      const customerCountry = (customer?.country?.code || customer?.country_id || 'IND').toUpperCase();
      const isIndia = customerCountry === 'IND' || customerCountry === 'IN';
      const customerGstin = customer?.gstin || '';
      const customerStateCode = customerGstin ? customerGstin.slice(0, 2) : (customer?.state?.toLowerCase().includes('maharashtra') ? '27' : '29');

      // Convert to INR if stored in other currency
      const rateToINR = inv.currency_code === 'INR' ? 1 : inv.currency_code === 'EUR' ? 92 : 86;
      const netAmount = Math.round(Number(inv.subtotal || 0) * rateToINR);
      const rawTaxAmount = Math.round(Number(inv.tax_amount || 0) * rateToINR);
      const grossAmount = Math.round(Number(inv.total_amount || 0) * rateToINR);

      let classification: TaxAuditTransaction['taxClassification'] = 'INTRA_STATE_GST';
      let igst = 0;
      let cgst = 0;
      let sgst = 0;

      if (!isIndia) {
        // International Export under LUT (Letter of Undertaking) - 0% IGST
        table31.zeroRatedSuppliesExports.totalTaxableValue += netAmount;
        gstr1Summary.exportInvoicesCount += 1;
        gstr1Summary.exportTaxableValue += netAmount;
        classification = 'EXPORT_LUT_GST';
      } else {
        // Domestic India
        const isIntraState = customerStateCode === homeStateCode;

        if (isIntraState) {
          // Intra-State: Split into CGST (9%) + SGST (9%)
          cgst = Math.round(rawTaxAmount / 2);
          sgst = rawTaxAmount - cgst;
          classification = 'INTRA_STATE_GST';
        } else {
          // Inter-State (IGST / CST): 18% Integrated Tax
          igst = rawTaxAmount;
          classification = 'INTER_STATE_IGST';
        }

        table31.taxableSuppliesOtherThanZero.totalTaxableValue += netAmount;
        table31.taxableSuppliesOtherThanZero.integratedTax += igst;
        table31.taxableSuppliesOtherThanZero.centralTax += cgst;
        table31.taxableSuppliesOtherThanZero.stateTax += sgst;

        // Categorize into GSTR-1
        if (customerGstin) {
          gstr1Summary.b2bInvoicesCount += 1;
          gstr1Summary.b2bTaxableValue += netAmount;
          gstr1Summary.b2bTotalTax += rawTaxAmount;
        } else if (!isIntraState && grossAmount > 250000) {
          // B2C Large: Inter-state invoice value > ₹2.5 Lakhs
          gstr1Summary.b2cLargeCount += 1;
          gstr1Summary.b2cLargeTaxableValue += netAmount;
          gstr1Summary.b2cLargeTotalTax += rawTaxAmount;
        } else {
          gstr1Summary.b2cSmallCount += 1;
          gstr1Summary.b2cSmallTaxableValue += netAmount;
          gstr1Summary.b2cSmallTotalTax += rawTaxAmount;
        }
      }

      // HSN/SAC Summary (Standard IT Service SAC: 998313 Information Technology Consulting)
      const sacCode = '998313';
      const existingHsn = hsnMap.get(sacCode);
      if (existingHsn) {
        existingHsn.totalValue += grossAmount;
        existingHsn.taxableValue += netAmount;
        existingHsn.igstAmount += igst;
        existingHsn.cgstAmount += cgst;
        existingHsn.sgstAmount += sgst;
      } else {
        hsnMap.set(sacCode, {
          hsnSacCode: sacCode,
          description: 'Information Technology Consulting & Support Services',
          uqc: 'OTH',
          totalQuantity: 1,
          totalValue: grossAmount,
          taxableValue: netAmount,
          igstAmount: igst,
          cgstAmount: cgst,
          sgstAmount: sgst,
          cessAmount: 0,
        });
      }

      auditTransactions.push({
        id: inv.id,
        sourceType: 'invoice',
        transactionNumber: inv.invoice_number,
        date: inv.invoice_date,
        partyName: customer?.company_name || 'Client',
        partyTaxId: customerGstin || null,
        partyCountryCode: customerCountry,
        partyState: isIndia ? (customerStateCode === '27' ? 'Maharashtra (27)' : 'Karnataka (29)') : 'Overseas',
        direction: 'outward',
        category: 'Outward Supply',
        grossAmount,
        taxableAmount: netAmount,
        taxRatePercent: netAmount > 0 ? Math.round((rawTaxAmount / netAmount) * 100) : 0,
        taxAmount: rawTaxAmount,
        igstAmount: igst,
        cgstAmount: cgst,
        sgstAmount: sgst,
        taxClassification: classification,
        currency: 'INR',
        status: inv.payment_status,
      });
    }

    // 2. Process Manual Income
    for (const tx of periodIncome) {
      const netAmount = Math.round(Number(tx.net_amount || tx.amount || 0) * (tx.currency === 'INR' ? 1 : 92));
      const rawTax = Math.round(Number(tx.tax_amount || 0) * (tx.currency === 'INR' ? 1 : 92));
      const grossAmount = Math.round(Number(tx.amount || 0) * (tx.currency === 'INR' ? 1 : 92));

      if (rawTax > 0) {
        const cgst = Math.round(rawTax / 2);
        const sgst = rawTax - cgst;
        table31.taxableSuppliesOtherThanZero.totalTaxableValue += netAmount;
        table31.taxableSuppliesOtherThanZero.centralTax += cgst;
        table31.taxableSuppliesOtherThanZero.stateTax += sgst;
      } else {
        table31.otherOutwardSuppliesNilExempt.totalTaxableValue += netAmount;
      }

      auditTransactions.push({
        id: tx.id,
        sourceType: 'income',
        transactionNumber: tx.transaction_number,
        date: tx.transaction_date,
        partyName: tx.party_name || 'Direct Income',
        partyTaxId: null,
        partyCountryCode: 'IND',
        partyState: 'Maharashtra (27)',
        direction: 'outward',
        category: tx.category || 'Income',
        grossAmount,
        taxableAmount: netAmount,
        taxRatePercent: netAmount > 0 && rawTax > 0 ? Math.round((rawTax / netAmount) * 100) : 0,
        taxAmount: rawTax,
        cgstAmount: Math.round(rawTax / 2),
        sgstAmount: rawTax - Math.round(rawTax / 2),
        taxClassification: rawTax > 0 ? 'INTRA_STATE_GST' : 'EXEMPT',
        currency: 'INR',
        status: 'completed',
      });
    }

    // 3. Process Inward Expenses (Input Tax Credit - ITC)
    let totalItcIgst = 0;
    let totalItcCgst = 0;
    let totalItcSgst = 0;

    for (const exp of periodExpenses) {
      const rateToINR = exp.currency === 'INR' ? 1 : exp.currency === 'EUR' ? 92 : 86;
      const netAmount = Math.round(Number(exp.amount || 0) * rateToINR);
      const taxAmount = Math.round(Number(exp.tax_amount || 0) * rateToINR);
      const grossAmount = Math.round(Number(exp.total_amount || 0) * rateToINR);

      const title = (exp.title || '').toLowerCase();
      const isInterState = title.includes('cloud') || title.includes('hosting') || title.includes('telecom');

      let igst = 0;
      let cgst = 0;
      let sgst = 0;

      if (taxAmount > 0) {
        if (isInterState) {
          igst = taxAmount;
          totalItcIgst += igst;
        } else {
          cgst = Math.round(taxAmount / 2);
          sgst = taxAmount - cgst;
          totalItcCgst += cgst;
          totalItcSgst += sgst;
        }
      }

      auditTransactions.push({
        id: exp.id,
        sourceType: 'expense',
        transactionNumber: exp.expense_number,
        date: exp.expense_date,
        partyName: exp.vendor_name || exp.title,
        partyTaxId: '27AAACB0000A1Z5',
        partyCountryCode: 'IND',
        partyState: isInterState ? 'Karnataka (29)' : 'Maharashtra (27)',
        direction: 'inward',
        category: 'Inward Supply / ITC',
        grossAmount,
        taxableAmount: netAmount,
        taxRatePercent: netAmount > 0 && taxAmount > 0 ? Math.round((taxAmount / netAmount) * 100) : 0,
        taxAmount,
        igstAmount: igst,
        cgstAmount: cgst,
        sgstAmount: sgst,
        taxClassification: 'INPUT_DEDUCTIBLE',
        currency: 'INR',
        status: exp.payment_status,
      });
    }

    // Table 4: Eligible Input Tax Credit (ITC)
    const itcAvailableItem: GSTR3BTable4ITCItem = {
      details: '(5) All other ITC',
      integratedTax: totalItcIgst,
      centralTax: totalItcCgst,
      stateTax: totalItcSgst,
      cess: 0,
    };

    const table4_InputTaxCredit: IndianGSTR3BReturnReport['table4_InputTaxCredit'] = {
      itcAvailable_ImportOfServices: { details: '(1) Import of Services', integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
      itcAvailable_ReverseCharge: { details: '(3) Inward supplies liable to reverse charge', integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
      itcAvailable_AllOtherITC: itcAvailableItem,
      totalItcAvailable: itcAvailableItem,
      itcReversed_Rule42_43: { details: '(B) ITC Reversed', integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
      netItcAvailable: itcAvailableItem,
    };

    // Table 5.1: Statutory Cross-Utilization Set-Off Rules
    // Rule: IGST credit used against IGST, then CGST/SGST. CGST credit against CGST & IGST. SGST against SGST & IGST.
    const outputIgst = table31.taxableSuppliesOtherThanZero.integratedTax;
    const outputCgst = table31.taxableSuppliesOtherThanZero.centralTax;
    const outputSgst = table31.taxableSuppliesOtherThanZero.stateTax;

    let remItcIgst = totalItcIgst;
    let remItcCgst = totalItcCgst;
    let remItcSgst = totalItcSgst;

    // Step 1: Set off IGST liability
    const igstUsedForIgst = Math.min(remItcIgst, outputIgst);
    remItcIgst -= igstUsedForIgst;
    let remOutputIgst = outputIgst - igstUsedForIgst;

    // Step 2: Use remaining IGST credit for CGST & SGST (split evenly)
    const igstUsedForCgst = Math.min(remItcIgst, Math.floor(outputCgst));
    remItcIgst -= igstUsedForCgst;
    const igstUsedForSgst = Math.min(remItcIgst, Math.floor(outputSgst));
    remItcIgst -= igstUsedForSgst;

    let remOutputCgst = Math.max(0, outputCgst - igstUsedForCgst);
    let remOutputSgst = Math.max(0, outputSgst - igstUsedForSgst);

    // Step 3: Use CGST credit for CGST, then IGST
    const cgstUsedForCgst = Math.min(remItcCgst, remOutputCgst);
    remItcCgst -= cgstUsedForCgst;
    remOutputCgst -= cgstUsedForCgst;

    const cgstUsedForIgst = Math.min(remItcCgst, remOutputIgst);
    remItcCgst -= cgstUsedForIgst;
    remOutputIgst -= cgstUsedForIgst;

    // Step 4: Use SGST credit for SGST, then IGST
    const sgstUsedForSgst = Math.min(remItcSgst, remOutputSgst);
    remItcSgst -= sgstUsedForSgst;
    remOutputSgst -= sgstUsedForSgst;

    const sgstUsedForIgst = Math.min(remItcSgst, remOutputIgst);
    remItcSgst -= sgstUsedForIgst;
    remOutputIgst -= sgstUsedForIgst;

    const netCashIgst = Math.max(0, remOutputIgst);
    const netCashCgst = Math.max(0, remOutputCgst);
    const netCashSgst = Math.max(0, remOutputSgst);

    const totalOutputTax = outputIgst + outputCgst + outputSgst;
    const totalItcUtilized =
      igstUsedForIgst + igstUsedForCgst + igstUsedForSgst +
      cgstUsedForCgst + cgstUsedForIgst +
      sgstUsedForSgst + sgstUsedForIgst;
    const totalCashPayable = netCashIgst + netCashCgst + netCashSgst;

    const table51_TaxPayableAndPaid: IndianGSTR3BReturnReport['table51_TaxPayableAndPaid'] = {
      totalOutputTaxLiability: {
        igst: outputIgst,
        cgst: outputCgst,
        sgst: outputSgst,
        cess: 0,
        total: totalOutputTax,
      },
      itcSetoffUtilized: {
        igstCreditUsed: { forIgst: igstUsedForIgst, forCgst: igstUsedForCgst, forSgst: igstUsedForSgst },
        cgstCreditUsed: { forCgst: cgstUsedForCgst, forIgst: cgstUsedForIgst },
        sgstCreditUsed: { forSgst: sgstUsedForSgst, forIgst: sgstUsedForIgst },
        totalItcUtilized,
      },
      netTaxPayableInCash: {
        igst: netCashIgst,
        cgst: netCashCgst,
        sgst: netCashSgst,
        cess: 0,
        total: totalCashPayable,
      },
    };

    const report: IndianGSTR3BReturnReport = {
      jurisdiction: 'IN_GST',
      companyId: company.id,
      companyName: company.company_name || 'Acme Enterprise Solutions (India) Pvt Ltd',
      gstin: companyGstin,
      stateCode: homeStateCode,
      stateName: 'Maharashtra',
      currency: 'INR',
      period,
      table31_OutwardSupplies: table31,
      table4_InputTaxCredit,
      table51_TaxPayableAndPaid,
      gstr1Summary,
      hsnSummary: Array.from(hsnMap.values()),
    };

    auditTransactions.sort((a, b) => b.date.localeCompare(a.date));

    return { report, auditTransactions };
  }

  // ====================================================================
  // 3. EXPORT HELPERS (ROS XML/JSON, GSTN OFFLINE, AUDIT CSV)
  // ====================================================================

  /**
   * Export Irish VAT3 Return formatted for Revenue Commissioners ROS
   */
  public static exportVAT3ToROS(report: IrishVAT3ReturnReport): string {
    const payload = {
      form: 'VAT3',
      taxRegistrationNumber: report.vatRegistrationNumber,
      taxpayerName: report.companyName,
      period: {
        type: report.period.type,
        year: report.period.year,
        periodIndex: report.period.periodIndex,
        startDate: report.period.startDate,
        endDate: report.period.endDate,
      },
      vatReturnBoxes: report.boxes,
      viesDispatches: report.viesDispatches,
      generatedAt: new Date().toISOString(),
      currency: report.currency,
      declaration: 'Generated automatically by Enterprise CRM Multi-Entity Tax Engine',
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Export Indian GSTR-3B payload compliant with GSTN offline tool schema
   */
  public static exportGSTR3BToGSTN(report: IndianGSTR3BReturnReport): string {
    const payload = {
      gstin: report.gstin,
      ret_period: `${report.period.periodIndex ? String(report.period.periodIndex).padStart(2, '0') : '03'}${report.period.year}`,
      sec_31: {
        osup_det: {
          txval: report.table31_OutwardSupplies.taxableSuppliesOtherThanZero.totalTaxableValue,
          iamt: report.table31_OutwardSupplies.taxableSuppliesOtherThanZero.integratedTax,
          camt: report.table31_OutwardSupplies.taxableSuppliesOtherThanZero.centralTax,
          samt: report.table31_OutwardSupplies.taxableSuppliesOtherThanZero.stateTax,
          csamt: 0,
        },
        osup_zero: {
          txval: report.table31_OutwardSupplies.zeroRatedSuppliesExports.totalTaxableValue,
          iamt: 0,
          csamt: 0,
        },
      },
      itc_elg: {
        itc_avl: [
          {
            ty: 'OTH',
            iamt: report.table4_InputTaxCredit.netItcAvailable.integratedTax,
            camt: report.table4_InputTaxCredit.netItcAvailable.centralTax,
            samt: report.table4_InputTaxCredit.netItcAvailable.stateTax,
            csamt: 0,
          },
        ],
      },
      gstr1_summary: report.gstr1Summary,
      hsn_sac_summary: report.hsnSummary,
      generated_at: new Date().toISOString(),
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Export complete tax audit transactions as CSV for auditors
   */
  public static exportAuditToCSV(auditList: TaxAuditTransaction[]): string {
    const headers = [
      'Transaction Ref',
      'Source',
      'Date',
      'Counterparty',
      'Tax Registration ID',
      'Country',
      'State',
      'Direction',
      'Category',
      'Gross Amount',
      'Taxable Amount',
      'Tax Rate %',
      'Total Tax',
      'IGST',
      'CGST',
      'SGST',
      'Tax Classification',
      'Currency',
      'Payment Status',
    ];

    const rows = auditList.map((tx) => [
      `"${tx.transactionNumber}"`,
      `"${tx.sourceType}"`,
      `"${tx.date}"`,
      `"${(tx.partyName || '').replace(/"/g, '""')}"`,
      `"${tx.partyTaxId || ''}"`,
      `"${tx.partyCountryCode}"`,
      `"${tx.partyState || ''}"`,
      `"${tx.direction}"`,
      `"${tx.category}"`,
      tx.grossAmount.toFixed(2),
      tx.taxableAmount.toFixed(2),
      tx.taxRatePercent,
      tx.taxAmount.toFixed(2),
      (tx.igstAmount || 0).toFixed(2),
      (tx.cgstAmount || 0).toFixed(2),
      (tx.sgstAmount || 0).toFixed(2),
      `"${tx.taxClassification}"`,
      `"${tx.currency}"`,
      `"${tx.status}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

