import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  Download,
  RefreshCw,
  Calendar,
  Building2,
  TrendingUp,
  Receipt,
  Wallet,
  Scale,
  CheckCircle2,
  AlertCircle,
  Globe,
  ArrowRight,
  Filter,
  Search,
  ExternalLink,
  ChevronDown,
  Layers,
  Percent,
} from 'lucide-react';
import { useCompanyContext } from '../../../contexts/CompanyContext';
import { useToast } from '../../ui/ToastProvider';
import { TaxReportingService } from '../../../services/taxReportingService';
import type {
  TaxJurisdiction,
  TaxPeriodSelection,
  IrishVAT3ReturnReport,
  IndianGSTR3BReturnReport,
  TaxAuditTransaction,
} from '../../../types/taxReport';

type ReportTab = 'official-return' | 'rate-breakdown' | 'audit-ledger';

const tabFromPath = (pathname: string): ReportTab => {
  const cleanPath = pathname.replace(/^\/admin/, '/crm');
  if (cleanPath === '/crm/tax-reports/rate-breakdown' || cleanPath === '/crm/tax-reports/rates' || cleanPath === '/crm/tax-reports/slabs') {
    return 'rate-breakdown';
  }
  if (cleanPath === '/crm/tax-reports/audit-ledger' || cleanPath === '/crm/tax-reports/ledger' || cleanPath === '/crm/tax-reports/audit') {
    return 'audit-ledger';
  }
  return 'official-return';
};

export const TaxReportingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCompany } = useCompanyContext();
  const { showSuccess, showError, showInfo } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ReportTab>(() => tabFromPath(window.location.pathname));

  useEffect(() => {
    const nextTab = tabFromPath(location.pathname);
    setActiveTab(prev => (prev === nextTab ? prev : nextTab));
  }, [location.pathname]);

  const handleTabChange = (tab: ReportTab) => {
    setActiveTab(tab);
    const targetPath = tab === 'official-return' ? '/crm/tax-reports' : `/crm/tax-reports/${tab}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [periods, setPeriods] = useState<TaxPeriodSelection[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TaxPeriodSelection | null>(null);

  // Loaded reports
  const [irishReport, setIrishReport] = useState<IrishVAT3ReturnReport | null>(null);
  const [indianReport, setIndianReport] = useState<IndianGSTR3BReturnReport | null>(null);
  const [auditTransactions, setAuditTransactions] = useState<TaxAuditTransaction[]>([]);

  // Filter & Search states for Audit Ledger
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerDirectionFilter, setLedgerDirectionFilter] = useState<'all' | 'outward' | 'inward'>('all');
  const [ledgerClassificationFilter, setLedgerClassificationFilter] = useState<string>('all');

  // Detect current jurisdiction based on active company
  const jurisdiction: TaxJurisdiction = useMemo(() => {
    return TaxReportingService.getJurisdiction(selectedCompany);
  }, [selectedCompany]);

  // Currency symbol
  const currencySymbol = useMemo(() => {
    if (jurisdiction === 'IN_GST') return '₹';
    if (jurisdiction === 'IE_VAT') return '€';
    return '$';
  }, [jurisdiction]);

  // Load available periods on year or jurisdiction change
  useEffect(() => {
    const available = TaxReportingService.getAvailablePeriods(selectedYear, jurisdiction);
    setPeriods(available);
    // Default to first period (e.g. Period 1 Jan/Feb or Q1)
    if (available.length > 0) {
      setSelectedPeriod(available[0]);
    }
  }, [selectedYear, jurisdiction]);

  // Load report data when period or company changes
  const loadTaxData = async () => {
    if (!selectedPeriod) return;
    try {
      setLoading(true);
      const companyId = selectedCompany?.id || '';

      if (jurisdiction === 'IN_GST') {
        const { report, auditTransactions: txs } = await TaxReportingService.generateIndianGSTReport(
          companyId,
          selectedPeriod
        );
        setIndianReport(report);
        setIrishReport(null);
        setAuditTransactions(txs);
      } else {
        // Default to Irish VAT3
        const { report, auditTransactions: txs } = await TaxReportingService.generateIrishVAT3Report(
          companyId,
          selectedPeriod
        );
        setIrishReport(report);
        setIndianReport(null);
        setAuditTransactions(txs);
      }
    } catch (err) {
      console.error('Failed to load tax report data:', err);
      showError('Failed to calculate tax figures for this period.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaxData();
  }, [selectedPeriod, selectedCompany?.id, jurisdiction]);

  // Format currency numbers
  const formatAmount = (num: number) => {
    return `${currencySymbol}${Number(num || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Export handlers
  const handleExportCSV = () => {
    if (auditTransactions.length === 0) {
      showError('No transactions available to export for this period.');
      return;
    }
    const csvContent = TaxReportingService.exportAuditToCSV(auditTransactions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Tax_Audit_Ledger_${selectedPeriod?.startDate}_to_${selectedPeriod?.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Audit ledger exported successfully to CSV.');
  };

  const handleExportOfficialJSON = () => {
    let payload = '';
    let filename = '';

    if (jurisdiction === 'IE_VAT' && irishReport) {
      payload = TaxReportingService.exportVAT3ToROS(irishReport);
      filename = `Revenue_Ireland_VAT3_${irishReport.vatRegistrationNumber}_${selectedPeriod?.startDate}.json`;
    } else if (jurisdiction === 'IN_GST' && indianReport) {
      payload = TaxReportingService.exportGSTR3BToGSTN(indianReport);
      filename = `GSTN_GSTR3B_${indianReport.gstin}_${selectedPeriod?.startDate}.json`;
    } else {
      showError('No tax report available to export.');
      return;
    }

    const blob = new Blob([payload], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess(`Statutory tax return payload exported: ${filename}`);
  };

  // Filtered audit transactions
  const filteredAudit = useMemo(() => {
    return auditTransactions.filter((tx) => {
      const matchSearch =
        !ledgerSearch ||
        tx.transactionNumber.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        tx.partyName.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        (tx.partyTaxId && tx.partyTaxId.toLowerCase().includes(ledgerSearch.toLowerCase()));

      const matchDir =
        ledgerDirectionFilter === 'all' || tx.direction === ledgerDirectionFilter;

      const matchClass =
        ledgerClassificationFilter === 'all' || tx.taxClassification === ledgerClassificationFilter;

      return matchSearch && matchDir && matchClass;
    });
  }, [auditTransactions, ledgerSearch, ledgerDirectionFilter, ledgerClassificationFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header & Statutory Entity Selector ──────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-gray-900 tracking-tight">
                  {jurisdiction === 'IE_VAT'
                    ? 'Irish & EU VAT3 Reporting'
                    : jurisdiction === 'IN_GST'
                    ? 'Indian GST & CST Reporting'
                    : 'Tax Compliance Reporting'}
                </h1>
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    jurisdiction === 'IE_VAT'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-orange-50 text-orange-700 border border-orange-200'
                  }`}
                >
                  {jurisdiction === 'IE_VAT' ? '🇮🇪 Revenue Ireland (VAT3)' : '🇮🇳 GSTN Portal (GSTR-3B / 1)'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {jurisdiction === 'IE_VAT'
                  ? 'Automated bi-monthly VAT3 Return, Input VAT T2 deductions, and VIES Intra-EU Dispatches'
                  : 'Automated GSTR-3B Table 3.1 & Table 4 ITC, GSTR-1 Outward Summary, and HSN/SAC Breakdown'}
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector & Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Picker */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs font-bold bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>

          {/* Period Dropdown */}
          <div className="relative">
            <select
              value={selectedPeriod?.label}
              onChange={(e) => {
                const found = periods.find((p) => p.label === e.target.value);
                if (found) setSelectedPeriod(found);
              }}
              className="text-xs font-bold bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-gray-800 focus:ring-2 focus:ring-indigo-500 pr-8 shadow-2xs"
            >
              {periods.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadTaxData}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title="Refresh Tax Calculations"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportOfficialJSON}
            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
            title="Export official JSON return"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{jurisdiction === 'IE_VAT' ? 'Export ROS JSON' : 'Export GSTN JSON'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold transition shadow-2xs"
            title="Export CSV Audit Spreadsheet"
          >
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            <span>Audit CSV</span>
          </button>
        </div>
      </div>

      {/* ── Key Statutory KPI Metric Cards ──────────────────────────────── */}
      {jurisdiction === 'IE_VAT' && irishReport && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* T1: VAT on Sales */}
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
              <span>Box T1: Output VAT</span>
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[10px]">Sales</span>
            </div>
            <div className="mt-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                {formatAmount(irishReport.boxes.boxT1_VatOnSales)}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">VAT on Irish domestic sales</p>
            </div>
          </div>

          {/* T2: VAT on Purchases */}
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
              <span>Box T2: Input VAT</span>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px]">Deductible</span>
            </div>
            <div className="mt-2">
              <h3 className="text-xl font-black text-emerald-600 tracking-tight">
                {formatAmount(irishReport.boxes.boxT2_VatOnPurchases)}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">Qualifying business purchases</p>
            </div>
          </div>

          {/* T3 or T4: Net Payable / Repayable */}
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
              <span>{irishReport.boxes.boxT3_NetVatPayable > 0 ? 'Box T3: Net Payable' : 'Box T4: Net Refund'}</span>
              <span
                className={`px-1.5 py-0.5 font-bold rounded text-[10px] ${
                  irishReport.boxes.boxT3_NetVatPayable > 0
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {irishReport.boxes.boxT3_NetVatPayable > 0 ? 'Due to Revenue' : 'Repayable'}
              </span>
            </div>
            <div className="mt-2">
              <h3
                className={`text-xl font-black tracking-tight ${
                  irishReport.boxes.boxT3_NetVatPayable > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {formatAmount(
                  irishReport.boxes.boxT3_NetVatPayable > 0
                    ? irishReport.boxes.boxT3_NetVatPayable
                    : irishReport.boxes.boxT4_NetVatRepayable
                )}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">T1 minus T2 balance</p>
            </div>
          </div>

          {/* E1: Intra-EU Supplies (0%) */}
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
              <span>Box E1: Intra-EU (VIES)</span>
              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-[10px]">0% B2B</span>
            </div>
            <div className="mt-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                {formatAmount(irishReport.boxes.boxE1_IntraEuSupplies)}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">Reverse charge to EU clients</p>
            </div>
          </div>

          {/* Total Turnover */}
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
              <span>Total Net Turnover</span>
              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 font-bold rounded text-[10px]">Net Sales</span>
            </div>
            <div className="mt-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                {formatAmount(irishReport.summary.totalNetSales)}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">Gross: {formatAmount(irishReport.summary.totalGrossSales)}</p>
            </div>
          </div>
        </div>
      )}

      {jurisdiction === 'IN_GST' && indianReport && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Output GST */}
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
              <span>Table 3.1: Output GST</span>
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[10px]">Liability</span>
            </div>
            <div className="mt-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                {formatAmount(indianReport.table51_TaxPayableAndPaid.totalOutputTaxLiability.total)}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                IGST: {formatAmount(indianReport.table51_TaxPayableAndPaid.totalOutputTaxLiability.igst)} | CGST+SGST
              </p>
            </div>
          </div>

          {/* Table 4: Eligible ITC */}
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
              <span>Table 4: Eligible ITC</span>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px]">Credit</span>
            </div>
            <div className="mt-2">
              <h3 className="text-xl font-black text-emerald-600 tracking-tight">
                {formatAmount(
                  indianReport.table4_InputTaxCredit.netItcAvailable.integratedTax +
                    indianReport.table4_InputTaxCredit.netItcAvailable.centralTax +
                    indianReport.table4_InputTaxCredit.netItcAvailable.stateTax
                )}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">Claimable on vendor purchases</p>
            </div>
          </div>

          {/* Table 5.1: Cash Payable */}
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
              <span>Net Tax Payable</span>
              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 font-bold rounded text-[10px]">Cash Challan</span>
            </div>
            <div className="mt-2">
              <h3 className="text-xl font-black text-amber-600 tracking-tight">
                {formatAmount(indianReport.table51_TaxPayableAndPaid.netTaxPayableInCash.total)}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">Post statutory ITC set-off</p>
            </div>
          </div>

          {/* Exports (Zero Rated LUT) */}
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
              <span>Zero-Rated Exports</span>
              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-[10px]">LUT 0%</span>
            </div>
            <div className="mt-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                {formatAmount(indianReport.table31_OutwardSupplies.zeroRatedSuppliesExports.totalTaxableValue)}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">Foreign export turnover</p>
            </div>
          </div>

          {/* Domestic Taxable Turnover */}
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
              <span>Domestic Turnover</span>
              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 font-bold rounded text-[10px]">Taxable</span>
            </div>
            <div className="mt-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                {formatAmount(indianReport.table31_OutwardSupplies.taxableSuppliesOtherThanZero.totalTaxableValue)}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">B2B & B2C Domestic Sales</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Navigation ──────────────────────────────────────────────── */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => handleTabChange('official-return')}
            className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'official-return'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>{jurisdiction === 'IE_VAT' ? 'Official VAT3 Return Sheet' : 'Official GSTR-3B & GSTR-1'}</span>
          </button>

          <button
            onClick={() => handleTabChange('rate-breakdown')}
            className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'rate-breakdown'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Percent className="w-4 h-4" />
            <span>Rate Card & Slabs Breakdown</span>
          </button>

          <button
            onClick={() => handleTabChange('audit-ledger')}
            className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'audit-ledger'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Transaction Audit Ledger ({auditTransactions.length})</span>
          </button>
        </nav>
      </div>

      {/* ── Tab 1: Official Return Sheet ─────────────────────────────────── */}
      {activeTab === 'official-return' && (
        <div className="space-y-6">
          {/* Irish Revenue VAT3 Return Form */}
          {jurisdiction === 'IE_VAT' && irishReport && (
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
              <div className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black tracking-wide">
                    REVENUE COMMISSIONERS IRELAND • VAT3 RETURN OF TRADING DETAILS
                  </h2>
                  <p className="text-xs text-slate-300">
                    Taxpayer: <span className="font-bold text-white">{irishReport.companyName}</span> • VAT ID:{' '}
                    <span className="font-mono text-emerald-400 font-bold">{irishReport.vatRegistrationNumber}</span> •
                    Filing Period: <span className="font-bold text-white">{selectedPeriod?.label}</span>
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-xs font-bold">
                    Official Statutory Template
                  </span>
                </div>
              </div>

              {/* VAT3 Official Box Grid */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Domestic Supplies & Purchases */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider">
                      Part 1: Irish Domestic Trading (T1, T2, T3, T4)
                    </h3>

                    {/* Box T1 */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-black text-xs rounded">
                            BOX T1
                          </span>
                          <span className="text-sm font-bold text-gray-900">VAT on Sales</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Total output VAT charged on domestic supplies of services & goods</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-gray-900">
                          {formatAmount(irishReport.boxes.boxT1_VatOnSales)}
                        </span>
                      </div>
                    </div>

                    {/* Box T2 */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-xs rounded">
                            BOX T2
                          </span>
                          <span className="text-sm font-bold text-gray-900">VAT on Purchases (Input VAT)</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Deductible VAT incurred on qualifying operational expenses</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-emerald-600">
                          {formatAmount(irishReport.boxes.boxT2_VatOnPurchases)}
                        </span>
                      </div>
                    </div>

                    {/* Box T3 / T4 Result */}
                    <div
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        irishReport.boxes.boxT3_NetVatPayable > 0
                          ? 'border-amber-200 bg-amber-50/60'
                          : 'border-emerald-200 bg-emerald-50/60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 font-black text-xs rounded ${
                              irishReport.boxes.boxT3_NetVatPayable > 0
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-emerald-200 text-emerald-900'
                            }`}
                          >
                            {irishReport.boxes.boxT3_NetVatPayable > 0 ? 'BOX T3' : 'BOX T4'}
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            {irishReport.boxes.boxT3_NetVatPayable > 0 ? 'Net VAT Payable to Revenue' : 'Net VAT Repayable from Revenue'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {irishReport.boxes.boxT3_NetVatPayable > 0
                            ? 'Payable electronically via Revenue Online Service (ROS)'
                            : 'Credit refundable to company bank account'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xl font-black ${
                            irishReport.boxes.boxT3_NetVatPayable > 0 ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatAmount(
                            irishReport.boxes.boxT3_NetVatPayable > 0
                              ? irishReport.boxes.boxT3_NetVatPayable
                              : irishReport.boxes.boxT4_NetVatRepayable
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Intra-EU Cross-Border & VIES */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider">
                      Part 2: Intra-Community European Trade (E1, E2, ES1, ES2)
                    </h3>

                    {/* Box E1 */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-black text-xs rounded">
                            BOX E1
                          </span>
                          <span className="text-sm font-bold text-gray-900">Intra-EU Supplies of Goods & Services</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Total net value supplied to VAT-registered businesses in other EU States</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-gray-900">
                          {formatAmount(irishReport.boxes.boxE1_IntraEuSupplies)}
                        </span>
                      </div>
                    </div>

                    {/* Box E2 */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-black text-xs rounded">
                            BOX E2
                          </span>
                          <span className="text-sm font-bold text-gray-900">Intra-EU Acquisitions</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Net value of goods/services received under reverse charge from EU</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-gray-900">
                          {formatAmount(irishReport.boxes.boxE2_IntraEuAcquisitions)}
                        </span>
                      </div>
                    </div>

                    {/* ES1 & ES2 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl border border-gray-200 bg-white">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">BOX ES1 • Services Dispatches</span>
                        <div className="text-base font-black text-gray-900 mt-1">
                          {formatAmount(irishReport.boxes.boxES1_IntraEuServicesSupplied)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-gray-200 bg-white">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">BOX ES2 • Services Received</span>
                        <div className="text-base font-black text-gray-900 mt-1">
                          {formatAmount(irishReport.boxes.boxES2_IntraEuServicesReceived)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* VIES European Statement Schedule */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">
                        VIES (VAT Information Exchange System) Intra-EU Dispatches Schedule
                      </h4>
                      <p className="text-xs text-gray-500">
                        Mandatory declaration of zero-rated supplies to VAT-registered entities in EU member states
                      </p>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                      {irishReport.viesDispatches.length} EU B2B Dispatches
                    </span>
                  </div>

                  {irishReport.viesDispatches.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                      No intra-EU dispatches to VAT-registered buyers recorded in this period.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 text-gray-600 font-bold">
                          <tr>
                            <th className="px-4 py-3 text-left">EU Member State</th>
                            <th className="px-4 py-3 text-left">Customer Legal Name</th>
                            <th className="px-4 py-3 text-left">Customer EU VAT ID</th>
                            <th className="px-4 py-3 text-center">Supply Type</th>
                            <th className="px-4 py-3 text-center">Invoices</th>
                            <th className="px-4 py-3 text-right">Total Net Value (EUR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {irishReport.viesDispatches.map((vies, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-semibold text-gray-900 flex items-center space-x-1.5">
                                <span className="font-mono uppercase bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                                  {vies.countryCode}
                                </span>
                                <span>{vies.memberStateName}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-800">{vies.customerName}</td>
                              <td className="px-4 py-3 font-mono font-bold text-indigo-700">{vies.customerVatNumber}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded capitalize font-medium">
                                  {vies.supplyType}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-gray-700">{vies.invoiceCount}</td>
                              <td className="px-4 py-3 text-right font-black text-gray-900">
                                {formatAmount(vies.totalNetValueEUR)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Indian GST Return Form (GSTR-3B & GSTR-1) */}
          {jurisdiction === 'IN_GST' && indianReport && (
            <div className="space-y-6">
              {/* GSTR-3B Table 3.1 & Table 4 */}
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
                <div className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black tracking-wide">
                      GOODS AND SERVICES TAX NETWORK • GSTR-3B MONTHLY SUMMARY RETURN
                    </h2>
                    <p className="text-xs text-slate-300">
                      Taxpayer: <span className="font-bold text-white">{indianReport.companyName}</span> • GSTIN:{' '}
                      <span className="font-mono text-orange-400 font-bold">{indianReport.gstin}</span> (State:{' '}
                      {indianReport.stateName} - {indianReport.stateCode})
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded text-xs font-bold">
                    Statutory GSTN Schema
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  {/* Table 3.1 Outward Supplies */}
                  <div>
                    <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider mb-3">
                      Table 3.1: Details of Outward Supplies and Inward Supplies Liable to Reverse Charge
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 text-gray-600 font-bold">
                          <tr>
                            <th className="px-4 py-3 text-left">Nature of Supplies</th>
                            <th className="px-4 py-3 text-right">Taxable Value</th>
                            <th className="px-4 py-3 text-right">IGST (Inter-State)</th>
                            <th className="px-4 py-3 text-right">CGST (Central)</th>
                            <th className="px-4 py-3 text-right">SGST (State)</th>
                            <th className="px-4 py-3 text-right">Cess</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          <tr>
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              (a) Outward taxable supplies (other than zero rated, nil and exempted)
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                              {formatAmount(indianReport.table31_OutwardSupplies.taxableSuppliesOtherThanZero.totalTaxableValue)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-800">
                              {formatAmount(indianReport.table31_OutwardSupplies.taxableSuppliesOtherThanZero.integratedTax)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-800">
                              {formatAmount(indianReport.table31_OutwardSupplies.taxableSuppliesOtherThanZero.centralTax)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-800">
                              {formatAmount(indianReport.table31_OutwardSupplies.taxableSuppliesOtherThanZero.stateTax)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">₹0.00</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              (b) Outward taxable supplies (zero rated - Exports / SEZ units)
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                              {formatAmount(indianReport.table31_OutwardSupplies.zeroRatedSuppliesExports.totalTaxableValue)}
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-bold">₹0.00 (LUT)</td>
                            <td className="px-4 py-3 text-right text-gray-500">₹0.00</td>
                            <td className="px-4 py-3 text-right text-gray-500">₹0.00</td>
                            <td className="px-4 py-3 text-right text-gray-500">₹0.00</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              (c) Other outward supplies (Nil rated, exempted)
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                              {formatAmount(indianReport.table31_OutwardSupplies.otherOutwardSuppliesNilExempt.totalTaxableValue)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">₹0.00</td>
                            <td className="px-4 py-3 text-right text-gray-500">₹0.00</td>
                            <td className="px-4 py-3 text-right text-gray-500">₹0.00</td>
                            <td className="px-4 py-3 text-right text-gray-500">₹0.00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table 4 Eligible ITC */}
                  <div>
                    <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider mb-3">
                      Table 4: Eligible Input Tax Credit (ITC) from Inward Supplies & Expenses
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 text-gray-600 font-bold">
                          <tr>
                            <th className="px-4 py-3 text-left">Details</th>
                            <th className="px-4 py-3 text-right">Integrated Tax (IGST)</th>
                            <th className="px-4 py-3 text-right">Central Tax (CGST)</th>
                            <th className="px-4 py-3 text-right">State Tax (SGST)</th>
                            <th className="px-4 py-3 text-right">Cess</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          <tr>
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              (A)(5) All other ITC (Purchases, cloud servers, office rent, services)
                            </td>
                            <td className="px-4 py-3 text-right font-black text-emerald-600">
                              {formatAmount(indianReport.table4_InputTaxCredit.netItcAvailable.integratedTax)}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-emerald-600">
                              {formatAmount(indianReport.table4_InputTaxCredit.netItcAvailable.centralTax)}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-emerald-600">
                              {formatAmount(indianReport.table4_InputTaxCredit.netItcAvailable.stateTax)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">₹0.00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table 5.1 Tax Payable & ITC Utilization */}
                  <div className="bg-gray-50/70 p-5 rounded-xl border border-gray-200">
                    <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider mb-2">
                      Table 5.1: Payment of Tax & Statutory ITC Cross-Utilization
                    </h3>
                    <p className="text-[11px] text-gray-500 mb-4">
                      Follows statutory GST set-off rules (IGST credit first against IGST, then CGST/SGST; CGST against CGST/IGST; SGST against SGST/IGST).
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-white rounded-xl border border-gray-200">
                        <span className="text-xs font-bold text-gray-500">Gross Output Liability</span>
                        <div className="text-xl font-black text-gray-900 mt-1">
                          {formatAmount(indianReport.table51_TaxPayableAndPaid.totalOutputTaxLiability.total)}
                        </div>
                      </div>
                      <div className="p-4 bg-white rounded-xl border border-gray-200">
                        <span className="text-xs font-bold text-emerald-600">Total ITC Set-Off Utilized</span>
                        <div className="text-xl font-black text-emerald-600 mt-1">
                          {formatAmount(indianReport.table51_TaxPayableAndPaid.itcSetoffUtilized.totalItcUtilized)}
                        </div>
                      </div>
                      <div className="p-4 bg-white rounded-xl border border-amber-200 bg-amber-50/50">
                        <span className="text-xs font-bold text-amber-700">Net Tax to be Paid in Cash</span>
                        <div className="text-xl font-black text-amber-700 mt-1">
                          {formatAmount(indianReport.table51_TaxPayableAndPaid.netTaxPayableInCash.total)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* GSTR-1 Outward Summary & HSN Breakdown */}
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    GSTR-1 Outward Supplies Classification & Table 12 HSN/SAC Summary
                  </h3>
                  <p className="text-xs text-gray-500">
                    Categorized into B2B Invoices, B2C Large, B2C Small, and Zero-rated international exports
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                    <span className="text-xs font-bold text-gray-500">Table 4: B2B Invoices</span>
                    <div className="text-lg font-black text-gray-900 mt-1">
                      {formatAmount(indianReport.gstr1Summary.b2bTaxableValue)}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{indianReport.gstr1Summary.b2bInvoicesCount} Invoices with valid GSTIN</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                    <span className="text-xs font-bold text-gray-500">Table 5: B2C (Large)</span>
                    <div className="text-lg font-black text-gray-900 mt-1">
                      {formatAmount(indianReport.gstr1Summary.b2cLargeTaxableValue)}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Inter-State invoices &gt; ₹2.5 Lakhs</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                    <span className="text-xs font-bold text-gray-500">Table 7: B2C (Others / Small)</span>
                    <div className="text-lg font-black text-gray-900 mt-1">
                      {formatAmount(indianReport.gstr1Summary.b2cSmallTaxableValue)}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Intra-State & small supplies</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                    <span className="text-xs font-bold text-gray-500">Table 6A: Exports (LUT)</span>
                    <div className="text-lg font-black text-gray-900 mt-1">
                      {formatAmount(indianReport.gstr1Summary.exportTaxableValue)}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{indianReport.gstr1Summary.exportInvoicesCount} Overseas Invoices (0%)</p>
                  </div>
                </div>

                {/* HSN/SAC Table */}
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 text-gray-600 font-bold">
                      <tr>
                        <th className="px-4 py-3 text-left">HSN / SAC Code</th>
                        <th className="px-4 py-3 text-left">Service Description</th>
                        <th className="px-4 py-3 text-center">UQC</th>
                        <th className="px-4 py-3 text-right">Taxable Value</th>
                        <th className="px-4 py-3 text-right">IGST</th>
                        <th className="px-4 py-3 text-right">CGST</th>
                        <th className="px-4 py-3 text-right">SGST</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {indianReport.hsnSummary.map((hsn, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono font-bold text-indigo-700">{hsn.hsnSacCode}</td>
                          <td className="px-4 py-3 text-gray-800">{hsn.description}</td>
                          <td className="px-4 py-3 text-center font-bold text-gray-500">{hsn.uqc}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">{formatAmount(hsn.taxableValue)}</td>
                          <td className="px-4 py-3 text-right text-gray-800">{formatAmount(hsn.igstAmount)}</td>
                          <td className="px-4 py-3 text-right text-gray-800">{formatAmount(hsn.cgstAmount)}</td>
                          <td className="px-4 py-3 text-right text-gray-800">{formatAmount(hsn.sgstAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Rate Card & Slabs Breakdown ──────────────────────────── */}
      {activeTab === 'rate-breakdown' && (
        <div className="space-y-6">
          {jurisdiction === 'IE_VAT' && irishReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sales Rates */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-gray-900">Output VAT on Supplies by Rate Slab</h3>
                <div className="space-y-3">
                  {Object.values(irishReport.salesByRate).map((rate, i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-gray-900 text-xs">{rate.rateName}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {rate.transactionCount} transactions • Taxable: {formatAmount(rate.taxableNet)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-sm text-gray-900">{formatAmount(rate.vatAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Purchase Rates */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-gray-900">Input VAT Deductibility on Purchases by Rate</h3>
                <div className="space-y-3">
                  {Object.values(irishReport.purchasesByRate).map((rate, i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-gray-900 text-xs">{rate.rateName}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {rate.transactionCount} transactions • Net Base: {formatAmount(rate.taxableNet)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-sm text-emerald-600">{formatAmount(rate.vatAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {jurisdiction === 'IN_GST' && indianReport && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900">GST Slab Analysis (Intra-State vs Inter-State vs Export)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
                  <span className="text-xs font-bold text-blue-900">Intra-State Supplies (CGST + SGST 18%)</span>
                  <div className="text-xl font-black text-blue-900 mt-2">
                    {formatAmount(
                      indianReport.table31_OutwardSupplies.taxableSuppliesOtherThanZero.centralTax +
                        indianReport.table31_OutwardSupplies.taxableSuppliesOtherThanZero.stateTax
                    )}
                  </div>
                  <p className="text-xs text-blue-700 mt-1">Split 50/50 between Central and State</p>
                </div>

                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40">
                  <span className="text-xs font-bold text-purple-900">Inter-State Supplies (IGST 18%)</span>
                  <div className="text-xl font-black text-purple-900 mt-2">
                    {formatAmount(indianReport.table31_OutwardSupplies.taxableSuppliesOtherThanZero.integratedTax)}
                  </div>
                  <p className="text-xs text-purple-700 mt-1">Central Sales to other Indian states</p>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                  <span className="text-xs font-bold text-emerald-900">Zero-Rated Exports (LUT 0%)</span>
                  <div className="text-xl font-black text-emerald-900 mt-2">
                    {formatAmount(indianReport.table31_OutwardSupplies.zeroRatedSuppliesExports.totalTaxableValue)}
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">100% Tax Exempt Foreign Inbound Revenue</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Transaction Audit Ledger ─────────────────────────────── */}
      {activeTab === 'audit-ledger' && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Transaction Audit Register</h3>
              <p className="text-xs text-gray-500">Every sales invoice, expense voucher, and income line contributing to this return</p>
            </div>

            {/* Filter Tools */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search ref, counterparty..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg w-52 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={ledgerDirectionFilter}
                onChange={(e) => setLedgerDirectionFilter(e.target.value as any)}
                className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-medium"
              >
                <option value="all">All Directions</option>
                <option value="outward">Sales / Income (Outward)</option>
                <option value="inward">Purchases / Expenses (Inward)</option>
              </select>

              <select
                value={ledgerClassificationFilter}
                onChange={(e) => setLedgerClassificationFilter(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-medium"
              >
                <option value="all">All Tax Classifications</option>
                <option value="DOMESTIC_STANDARD">Domestic Standard</option>
                <option value="INTRA_EU_B2B_REVERSE_CHARGE">Intra-EU Reverse Charge</option>
                <option value="EXPORT_OUTSIDE_EU">Export Outside EU</option>
                <option value="INTRA_STATE_GST">Intra-State GST</option>
                <option value="INTER_STATE_IGST">Inter-State IGST</option>
                <option value="EXPORT_LUT_GST">Export (LUT 0%)</option>
                <option value="INPUT_DEDUCTIBLE">Input Deductible</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50 text-gray-600 font-bold">
                <tr>
                  <th className="px-4 py-3 text-left">Ref Number</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Counterparty</th>
                  <th className="px-4 py-3 text-left">Tax ID</th>
                  <th className="px-4 py-3 text-center">Direction</th>
                  <th className="px-4 py-3 text-right">Taxable Base</th>
                  <th className="px-4 py-3 text-center">Rate</th>
                  <th className="px-4 py-3 text-right">Tax Amount</th>
                  <th className="px-4 py-3 text-left">Statutory Classification</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredAudit.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                      No transactions matched the search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAudit.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                        {tx.transactionNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{tx.date}</td>
                      <td className="px-4 py-3 text-gray-900 font-semibold">{tx.partyName}</td>
                      <td className="px-4 py-3 font-mono text-gray-500">{tx.partyTaxId || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.direction === 'outward'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {tx.direction === 'outward' ? 'Sales / Outward' : 'Expense / Inward'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{formatAmount(tx.taxableAmount)}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-600">{tx.taxRatePercent}%</td>
                      <td
                        className={`px-4 py-3 text-right font-black ${
                          tx.direction === 'outward' ? 'text-gray-900' : 'text-emerald-600'
                        }`}
                      >
                        {formatAmount(tx.taxAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded font-mono text-[10px]">
                          {tx.taxClassification}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="capitalize text-gray-600 font-medium">{tx.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxReportingDashboard;

