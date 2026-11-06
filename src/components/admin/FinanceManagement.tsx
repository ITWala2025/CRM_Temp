import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import {
  TrendingUp, TrendingDown, DollarSign, PieChart, Calendar, Download,
  Plus, Search, Filter, X, ArrowUpRight, ArrowDownRight, Building2,
  CreditCard, FileText, Receipt, Users, AlertTriangle, CheckCircle,
  BarChart3, Wallet, RefreshCw, Eye, Edit, Trash2, ChevronLeft, ChevronRight, Printer
} from 'lucide-react';
import {
  financeService,
  FinancialSummary,
  FinancialHealth,
  FinancialTransaction
} from '../../services/financeService';
import { invoiceService } from '../../services/invoiceService';
import { PDFBrandingUtils } from '../../utils/pdfBrandingUtils';
import type { CompanySettings, Country } from '../../types/invoice';
import { useToast } from '../ui/ToastProvider';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useCompanyContext } from '../../contexts/CompanyContext';

type ViewType = 'dashboard' | 'transactions' | 'reports';
type PeriodType = 'monthly' | 'quarterly' | 'yearly';

const transactionTypeColors: Record<string, string> = {
  income: 'bg-green-100 text-green-800',
  expense: 'bg-red-100 text-red-800'
};

const sourceColors: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  invoice: { bg: 'bg-blue-100', text: 'text-blue-700', icon: FileText },
  expense: { bg: 'bg-orange-100', text: 'text-orange-700', icon: Receipt },
  salary: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Users },
  bonus: { bg: 'bg-pink-100', text: 'text-pink-700', icon: DollarSign },
  manual: { bg: 'bg-gray-100', text: 'text-gray-700', icon: CreditCard }
};

export const getCompanyCurrency = (comp: CompanySettings | null): string => {
  if (!comp) return 'INR';
  if (comp.country?.currency_code) return comp.country.currency_code;
  const cCode = comp.country?.code?.toUpperCase();
  if (cCode === 'IE' || cCode === 'IRL') return 'EUR';
  if (cCode === 'IN' || cCode === 'IND') return 'INR';
  if (cCode === 'US' || cCode === 'USA') return 'USD';
  if (cCode === 'GB' || cCode === 'GBR') return 'GBP';
  if (cCode === 'AE' || cCode === 'ARE') return 'AED';
  return 'INR';
};

const formatCurrency = (amount: number, currencyCode: string = 'INR') => {
  const code = (currencyCode || 'INR').toUpperCase();
  const localeMap: Record<string, string> = {
    INR: 'en-IN',
    EUR: 'en-IE',
    USD: 'en-US',
    GBP: 'en-GB',
    AED: 'en-AE',
  };
  const locale = localeMap[code] || 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (e) {
    return `${code} ${amount.toFixed(2)}`;
  }
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const FinanceManagement: React.FC = () => {
  const { showError, showSuccess } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const { selectedCompany } = useCompanyContext();
  const activeCurrency = getCompanyCurrency(selectedCompany);
  const fmtCurr = (amount: number, currencyCode?: string) => formatCurrency(amount, currencyCode || activeCurrency);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  
  // For Indian FY: selectedYear represents the starting year of the FY
  // e.g., selectedYear = 2025 means FY 2025-26 (Apr 2025 - Mar 2026)
  const getCurrentFinancialYear = () => {
    const today = new Date();
    // If month is Jan-Mar, we're in the previous year's FY
    return today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  };
  
  const getCurrentFYQuarter = () => {
    const today = new Date();
    const month = today.getMonth(); // 0-11
    // FY Quarters: Q1 = Apr-Jun (3-5), Q2 = Jul-Sep (6-8), Q3 = Oct-Dec (9-11), Q4 = Jan-Mar (0-2)
    if (month >= 3 && month <= 5) return 1;
    if (month >= 6 && month <= 8) return 2;
    if (month >= 9 && month <= 11) return 3;
    return 4; // Jan-Mar
  };
  
  const getCurrentFYMonth = () => {
    const today = new Date();
    const month = today.getMonth(); // 0-11
    // FY Months: 1 = April, 2 = May, ..., 12 = March
    return month >= 3 ? month - 2 : month + 10;
  };
  
  const [selectedYear, setSelectedYear] = useState(getCurrentFinancialYear());
  const [selectedMonth, setSelectedMonth] = useState(getCurrentFYMonth()); // FY month (1=Apr, 12=Mar)
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentFYQuarter()); // FY quarter

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [health, setHealth] = useState<FinancialHealth | null>(null);
  const [incomeTransactions, setIncomeTransactions] = useState<FinancialTransaction[]>([]);
  const [expenseTransactions, setExpenseTransactions] = useState<FinancialTransaction[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; income: number; expenses: number; profit: number }[]>([]);

  const [transactionFilters, setTransactionFilters] = useState({
    type: '',
    source: ''
  });
  const [txPage, setTxPage] = useState(1);
  const TX_PER_PAGE = 20;

  // PDF Report states
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDashboardData();
    loadCountries();
    loadCompanySettings();
  }, [selectedYear, selectedMonth, selectedQuarter, periodType, selectedCompany]);

  // Convert FY month (1=Apr, 12=Mar) to calendar month and year
  const fyMonthToCalendar = (fyMonth: number, fyStartYear: number) => {
    // fyMonth: 1=Apr, 2=May, ..., 9=Dec, 10=Jan, 11=Feb, 12=Mar
    if (fyMonth <= 9) {
      // Apr (1) to Dec (9) - same year as FY start
      return { month: fyMonth + 3, year: fyStartYear }; // Apr=4, May=5, ..., Dec=12
    } else {
      // Jan (10) to Mar (12) - next year
      return { month: fyMonth - 9, year: fyStartYear + 1 }; // Jan=1, Feb=2, Mar=3
    }
  };

  const getDateRange = () => {
    let startDate: string, endDate: string;
    
    if (periodType === 'yearly') {
      // Indian Financial Year: April 1 of selectedYear to March 31 of selectedYear+1
      startDate = `${selectedYear}-04-01`;
      endDate = `${selectedYear + 1}-03-31`;
    } else if (periodType === 'quarterly') {
      // FY Quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
      if (selectedQuarter === 1) {
        startDate = `${selectedYear}-04-01`;
        endDate = `${selectedYear}-06-30`;
      } else if (selectedQuarter === 2) {
        startDate = `${selectedYear}-07-01`;
        endDate = `${selectedYear}-09-30`;
      } else if (selectedQuarter === 3) {
        startDate = `${selectedYear}-10-01`;
        endDate = `${selectedYear}-12-31`;
      } else {
        // Q4: Jan-Mar of next year
        startDate = `${selectedYear + 1}-01-01`;
        endDate = `${selectedYear + 1}-03-31`;
      }
    } else {
      // Monthly: Convert FY month to calendar month
      const { month, year } = fyMonthToCalendar(selectedMonth, selectedYear);
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    }
    
    return { startDate, endDate };
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      console.log('📊 Finance Dashboard: Loading data for period', { periodType, startDate, endDate, selectedYear, selectedMonth, selectedQuarter, companyId: selectedCompany?.id });
      
      const [summaryData, healthData, incomeData, expenseData, trendData] = await Promise.all([
        financeService.getFinancialSummary(startDate, endDate, undefined, selectedCompany?.id),
        financeService.getFinancialHealth(selectedCompany?.id),
        financeService.getIncomeData(startDate, endDate, selectedCompany?.id),
        financeService.getExpenseData(startDate, endDate, selectedCompany?.id),
        financeService.getMonthlyTrend(12, selectedCompany?.id)
      ]);

      console.log('📊 Finance Dashboard: Data loaded', { 
        periodType,
        companyId: selectedCompany?.id,
        dateRange: { startDate, endDate },
        incomeTotal: summaryData.income.total,
        expenseTotal: summaryData.expenses.total,
        incomeCount: incomeData.length,
        expenseCount: expenseData.length
      });

      setSummary(summaryData);
      setHealth(healthData);
      setIncomeTransactions(incomeData);
      setExpenseTransactions(expenseData);
      setMonthlyTrend(trendData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanySettings = async () => {
    try {
      if (selectedCompany) {
        setCompanySettings(selectedCompany);
      } else {
        const companies = await invoiceService.getCompanySettings();
        const defaultCompany = companies.find(c => c.is_default) || companies[0];
        setCompanySettings(defaultCompany || null);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const loadCountries = async () => {
    try {
      const data = await invoiceService.getCountries();
      setCountries(data);
    } catch (error) {
      console.error('Error loading countries:', error);
    }
  };

  // PDF Generation functions
  const generateFinanceReportPDF = async (action: 'download' | 'preview') => {
    if (!summary || !companySettings) {
      showError('Please ensure data is loaded and company settings are configured.');
      return;
    }

    setPdfGenerating(true);
    try {
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      pdf.setFont('helvetica');
      const dimensions = PDFBrandingUtils.getStandardDimensions();
      
      // Apply branding (header/footer images)
      const { contentStartY, contentEndY } = await PDFBrandingUtils.applyBranding(
        pdf, 
        companySettings, 
        dimensions
      );

      let currentY = contentStartY + 5;
      const leftMargin = dimensions.leftMargin;
      const rightMargin = dimensions.rightMargin;
      const pageWidth = dimensions.pageWidth;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      // Helper function to add new page with branding
      const addNewPage = async () => {
        pdf.addPage();
        const branding = await PDFBrandingUtils.applyBranding(pdf, companySettings, dimensions);
        return branding.contentStartY + 5;
      };

      // Check if we need a new page
      const checkPageBreak = async (requiredHeight: number) => {
        if (currentY + requiredHeight > contentEndY - 10) {
          currentY = await addNewPage();
        }
      };

      // Report Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('Financial Report', leftMargin, currentY);
      currentY += 8;

      // Period
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`Period: ${getPeriodLabel()}`, leftMargin, currentY);
      currentY += 5;
      
      const { startDate, endDate } = getDateRange();
      pdf.setFontSize(10);
      pdf.text(`(${new Date(startDate).toLocaleDateString('en-IN')} - ${new Date(endDate).toLocaleDateString('en-IN')})`, leftMargin, currentY);
      currentY += 5;

      // Generated date
      pdf.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, leftMargin, currentY);
      currentY += 12;

      // Company Info
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(companySettings.company_name, leftMargin, currentY);
      currentY += 4;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      if (companySettings.gstin) {
        pdf.text(`GSTIN: ${companySettings.gstin}`, leftMargin, currentY);
        currentY += 4;
      }
      currentY += 8;

      // Draw section header
      const drawSectionHeader = (title: string) => {
        pdf.setFillColor(37, 99, 235);
        pdf.rect(leftMargin, currentY, contentWidth, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, leftMargin + 5, currentY + 5.5);
        pdf.setTextColor(0, 0, 0);
        currentY += 12;
      };

      // Draw table row
      const drawTableRow = (label: string, value: string, isTotal: boolean = false, isProfit: boolean = false) => {
        if (isTotal) {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(leftMargin, currentY - 3, contentWidth, 7, 'F');
          pdf.setFont('helvetica', 'bold');
        } else {
          pdf.setFont('helvetica', 'normal');
        }
        
        pdf.setFontSize(10);
        if (isProfit) {
          const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
          pdf.setTextColor(numValue >= 0 ? 22 : 220, numValue >= 0 ? 163 : 38, numValue >= 0 ? 74 : 38);
        } else {
          pdf.setTextColor(0, 0, 0);
        }
        
        pdf.text(label, leftMargin + 8, currentY);
        pdf.text(value, pageWidth - rightMargin - 8, currentY, { align: 'right' });
        currentY += 6;
      };

      // ==================== PROFIT & LOSS STATEMENT ====================
      await checkPageBreak(80);
      drawSectionHeader('PROFIT & LOSS STATEMENT');

      // Income Section
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(22, 163, 74);
      pdf.text('INCOME', leftMargin + 5, currentY);
      currentY += 6;
      pdf.setTextColor(0, 0, 0);

      summary.income.breakdown.forEach(({ label, amount }) => {
        drawTableRow(label, fmtCurr(amount));
      });
      pdf.setDrawColor(200, 200, 200);
      pdf.line(leftMargin, currentY - 2, pageWidth - rightMargin, currentY - 2);
      drawTableRow('Total Income', fmtCurr(summary.income.total), true);
      currentY += 6;

      // Capital Section (separate from income)
      if (summary.capital.total > 0) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(29, 78, 216);
        pdf.text('CAPITAL', leftMargin + 5, currentY);
        currentY += 6;
        pdf.setTextColor(0, 0, 0);

        summary.capital.breakdown.forEach(({ label, amount }) => {
          drawTableRow(label, fmtCurr(amount));
        });
        pdf.setDrawColor(200, 200, 200);
        pdf.line(leftMargin, currentY - 2, pageWidth - rightMargin, currentY - 2);
        drawTableRow('Total Capital', fmtCurr(summary.capital.total), true);
        currentY += 6;
      }

      // Expenses Section
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(220, 38, 38);
      pdf.text('EXPENSES', leftMargin + 5, currentY);
      currentY += 6;
      pdf.setTextColor(0, 0, 0);

      summary.expenses.breakdown.forEach(({ label, amount }) => {
        drawTableRow(label, fmtCurr(amount));
      });
      pdf.line(leftMargin, currentY - 2, pageWidth - rightMargin, currentY - 2);
      drawTableRow('Total Expenses', fmtCurr(summary.expenses.total), true);
      currentY += 8;

      // Net Profit
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.line(leftMargin, currentY - 2, pageWidth - rightMargin, currentY - 2);
      pdf.line(leftMargin, currentY, pageWidth - rightMargin, currentY);
      currentY += 4;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      drawTableRow('NET PROFIT / (LOSS)', fmtCurr(summary.netProfit), true, true);
      pdf.setLineWidth(0.2);
      currentY += 10;

      // ==================== KEY METRICS ====================
      await checkPageBreak(50);
      drawSectionHeader('KEY FINANCIAL METRICS');

      const metrics = [
        { label: 'Gross Profit Margin', value: `${summary.profitMargin.toFixed(1)}%` },
        { label: 'Operating Expenses Ratio', value: `${summary.income.total > 0 ? ((summary.expenses.total / summary.income.total) * 100).toFixed(1) : 0}%` },
        { label: 'YTD Profit', value: fmtCurr(health?.yearToDateProfit || 0) },
        { label: 'Average Monthly Revenue', value: fmtCurr(health?.averageMonthlyRevenue || 0) },
        { label: 'Average Monthly Expense', value: fmtCurr(health?.averageMonthlyExpense || 0) },
        { label: 'Month-over-Month Growth', value: `${(health?.monthOverMonthGrowth || 0).toFixed(1)}%` }
      ];

      metrics.forEach(metric => {
        drawTableRow(metric.label, metric.value);
      });
      currentY += 10;

      // ==================== INCOME TRANSACTIONS ====================
      if (incomeTransactions.length > 0) {
        await checkPageBreak(40);
        drawSectionHeader('INCOME TRANSACTIONS');

        // Table header
        pdf.setFillColor(245, 245, 245);
        pdf.rect(leftMargin, currentY - 3, contentWidth, 7, 'F');
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Date', leftMargin + 5, currentY);
        pdf.text('Reference', leftMargin + 32, currentY);
        pdf.text('Description', leftMargin + 72, currentY);
        pdf.text('Amount', pageWidth - rightMargin - 8, currentY, { align: 'right' });
        currentY += 7;

        pdf.setFont('helvetica', 'normal');
        for (const txn of incomeTransactions) {
          await checkPageBreak(7);
          pdf.setFontSize(8);
          pdf.text(new Date(txn.transaction_date).toLocaleDateString('en-IN'), leftMargin + 5, currentY);
          pdf.text(txn.reference_number.substring(0, 25), leftMargin + 32, currentY);
          pdf.text(txn.description.substring(0, 40), leftMargin + 72, currentY);
          pdf.text(fmtCurr(txn.net_amount, txn.currency), pageWidth - rightMargin - 8, currentY, { align: 'right' });
          currentY += 5;
        }
        currentY += 8;
      }

      // ==================== EXPENSE TRANSACTIONS ====================
      if (expenseTransactions.length > 0) {
        await checkPageBreak(40);
        drawSectionHeader('EXPENSE TRANSACTIONS');

        // Table header
        pdf.setFillColor(245, 245, 245);
        pdf.rect(leftMargin, currentY - 3, contentWidth, 7, 'F');
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Date', leftMargin + 5, currentY);
        pdf.text('Reference', leftMargin + 32, currentY);
        pdf.text('Description', leftMargin + 72, currentY);
        pdf.text('Amount', pageWidth - rightMargin - 8, currentY, { align: 'right' });
        currentY += 7;

        pdf.setFont('helvetica', 'normal');
        for (const txn of expenseTransactions) {
          await checkPageBreak(7);
          pdf.setFontSize(8);
          pdf.text(new Date(txn.transaction_date).toLocaleDateString('en-IN'), leftMargin + 5, currentY);
          pdf.text(txn.reference_number.substring(0, 25), leftMargin + 32, currentY);
          pdf.text(txn.description.substring(0, 40), leftMargin + 72, currentY);
          pdf.text(fmtCurr(txn.net_amount, txn.currency), pageWidth - rightMargin - 8, currentY, { align: 'right' });
          currentY += 5;
        }
        currentY += 8;
      }

      // ==================== FOOTER NOTE ====================
      await checkPageBreak(20);
      currentY += 5;
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text('This is a computer-generated report and does not require a signature.', leftMargin, currentY);
      currentY += 4;
      pdf.text(`Report generated by ${companySettings.company_name} Finance Management System`, leftMargin, currentY);

      // Action: Download or Preview
      if (action === 'download') {
        pdf.save(`Financial_Report_${getPeriodLabel().replace(/\s+/g, '_')}.pdf`);
      } else {
        // Open in new window for preview
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      showError('Failed to generate PDF report');
    } finally {
      setPdfGenerating(false);
    }
  };

  // Combined transactions for the all transactions view
  // Dynamic category breakdowns from actual transaction data
  const getIncomeBreakdown = (): { label: string; amount: number }[] => {
    const groups: Record<string, number> = {};
    incomeTransactions.forEach(t => {
      // Exclude capital - it is tracked separately
      if (t.source_type !== 'invoice' && t.category === 'Capital') return;
      const label = t.source_type === 'invoice'
        ? 'Invoice Revenue'
        : (t.category || 'Other Income');
      groups[label] = (groups[label] || 0) + t.net_amount;
    });
    return Object.entries(groups)
      .filter(([, amt]) => amt > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([label, amount]) => ({ label, amount }));
  };

  const getCapitalBreakdown = (): { label: string; amount: number }[] => {
    let total = 0;
    incomeTransactions.forEach(t => {
      if (t.source_type !== 'invoice' && t.category === 'Capital') {
        total += t.net_amount;
      }
    });
    return total > 0 ? [{ label: 'Capital', amount: total }] : [];
  };

  const getExpenseBreakdown = (): { label: string; amount: number }[] => {
    const sourceLabels: Record<string, string> = {
      salary: 'Salaries',
      bonus: 'Bonuses',
      expense: 'Operational Expenses',
      manual: 'Other Expenses',
    };
    const groups: Record<string, number> = {};
    expenseTransactions.forEach(t => {
      const label = t.category || sourceLabels[t.source_type] || t.source_type;
      groups[label] = (groups[label] || 0) + t.net_amount;
    });
    return Object.entries(groups)
      .filter(([, amt]) => amt > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([label, amount]) => ({ label, amount }));
  };

  // Colour palette cycling for breakdown rows
  const breakdownColors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-indigo-100 text-indigo-700',
    'bg-teal-100 text-teal-700',
    'bg-yellow-100 text-yellow-700',
    'bg-red-100 text-red-700',
    'bg-gray-100 text-gray-700',
  ];

  const getAllTransactions = () => {
    const all: (FinancialTransaction & { transactionType: 'income' | 'expense' })[] = [];
    
    incomeTransactions.forEach(t => {
      all.push({ ...t, transactionType: 'income' });
    });
    
    expenseTransactions.forEach(t => {
      all.push({ ...t, transactionType: 'expense' });
    });
    
    return all.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  };

  // Filter transactions
  const filteredTransactions = getAllTransactions().filter(t => {
    if (transactionFilters.type && t.transactionType !== transactionFilters.type) return false;
    if (transactionFilters.source && t.source_type !== transactionFilters.source) return false;
    return true;
  });

  // Dynamic source options from actual transaction data
  const dynamicSources = Array.from(
    new Set(getAllTransactions().map(t => t.source_type).filter(Boolean))
  ).sort();

  // Paginated slice
  const txTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / TX_PER_PAGE));
  const paginatedTransactions = filteredTransactions.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE);

  // FY month names for display
  const fyMonthNames = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

  const getPeriodLabel = () => {
    if (periodType === 'yearly') {
      // Format: FY 2025-26
      return `FY ${selectedYear}-${String(selectedYear + 1).slice(-2)}`;
    }
    if (periodType === 'quarterly') {
      // Format: Q1 FY 2025-26
      return `Q${selectedQuarter} FY ${selectedYear}-${String(selectedYear + 1).slice(-2)}`;
    }
    // Monthly: Show month name and appropriate year
    const { year } = fyMonthToCalendar(selectedMonth, selectedYear);
    return `${fyMonthNames[selectedMonth - 1]} ${year}`;
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (periodType === 'yearly') {
      setSelectedYear(prev => direction === 'prev' ? prev - 1 : prev + 1);
    } else if (periodType === 'quarterly') {
      if (direction === 'prev') {
        if (selectedQuarter === 1) {
          setSelectedQuarter(4);
          setSelectedYear(prev => prev - 1);
        } else {
          setSelectedQuarter(prev => prev - 1);
        }
      } else {
        if (selectedQuarter === 4) {
          setSelectedQuarter(1);
          setSelectedYear(prev => prev + 1);
        } else {
          setSelectedQuarter(prev => prev + 1);
        }
      }
    } else {
      // Monthly navigation in FY context (1=Apr to 12=Mar)
      if (direction === 'prev') {
        if (selectedMonth === 1) {
          // Going from April to previous FY's March
          setSelectedMonth(12);
          setSelectedYear(prev => prev - 1);
        } else {
          setSelectedMonth(prev => prev - 1);
        }
      } else {
        if (selectedMonth === 12) {
          // Going from March to next FY's April
          setSelectedMonth(1);
          setSelectedYear(prev => prev + 1);
        } else {
          setSelectedMonth(prev => prev + 1);
        }
      }
    }
  };

  // Calculate health score
  const getHealthScore = (health: FinancialHealth) => {
    let score = 50; // Base score
    
    // Profit margin contribution (up to 25 points)
    if (health.profitMargin > 20) score += 25;
    else if (health.profitMargin > 10) score += 20;
    else if (health.profitMargin > 0) score += 10;
    else score -= 10;
    
    // MoM growth contribution (up to 15 points)
    if (health.monthOverMonthGrowth > 10) score += 15;
    else if (health.monthOverMonthGrowth > 0) score += 10;
    else if (health.monthOverMonthGrowth > -10) score += 5;
    
    // Current ratio contribution (up to 10 points)
    if (health.currentRatio > 2) score += 10;
    else if (health.currentRatio > 1) score += 5;
    
    return Math.min(100, Math.max(0, score));
  };

  const getHealthStatus = (score: number) => {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-green-600" />
            Finance Management
          </h1>
          <p className="text-gray-600 mt-1">Track income, expenses, and financial health</p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Period Type:</span>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigatePeriod('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-semibold text-gray-900 min-w-[150px] text-center">
              {getPeriodLabel()}
            </span>
            <button
              onClick={() => navigatePeriod('next')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg ml-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: PieChart },
              { id: 'transactions', label: 'All Transactions', icon: FileText },
              { id: 'reports', label: 'Reports', icon: BarChart3 }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as ViewType)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeView === tab.id
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : (
            <>
              {/* Dashboard View */}
              {activeView === 'dashboard' && summary && health && (
                <div className="space-y-6">
                  {/* Financial Health Card */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-4 bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold opacity-90">Financial Health Score</h3>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-5xl font-bold">{getHealthScore(health)}</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              getHealthStatus(getHealthScore(health)) === 'excellent' ? 'bg-green-400/30' :
                              getHealthStatus(getHealthScore(health)) === 'good' ? 'bg-green-300/30' :
                              getHealthStatus(getHealthScore(health)) === 'fair' ? 'bg-yellow-400/30' :
                              'bg-red-400/30'
                            }`}>
                              {getHealthStatus(getHealthScore(health)).charAt(0).toUpperCase() + getHealthStatus(getHealthScore(health)).slice(1)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm opacity-75">Profit Margin</p>
                          <p className="text-2xl font-bold">{health.profitMargin.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
                        <div>
                          <p className="text-sm opacity-75">Avg Monthly Revenue</p>
                          <p className="text-xl font-semibold">{fmtCurr(health.averageMonthlyRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-sm opacity-75">Avg Monthly Expense</p>
                          <p className="text-xl font-semibold">{fmtCurr(health.averageMonthlyExpense)}</p>
                        </div>
                        <div>
                          <p className="text-sm opacity-75">YTD Profit</p>
                          <p className="text-xl font-semibold">{fmtCurr(health.yearToDateProfit)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Period Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <ArrowUpRight className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Period Income</p>
                          <p className="text-xl font-bold text-green-600">{fmtCurr(summary.income.total)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <ArrowDownRight className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Period Expenses</p>
                          <p className="text-xl font-bold text-red-600">{fmtCurr(summary.expenses.total)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Wallet className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Net Profit</p>
                          <p className={`text-xl font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fmtCurr(summary.netProfit)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <TrendingUp className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">MoM Growth</p>
                          <p className={`text-xl font-bold ${health.monthOverMonthGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {health.monthOverMonthGrowth >= 0 ? '+' : ''}{health.monthOverMonthGrowth.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Income, Capital & Expense Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Income Breakdown */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <ArrowUpRight className="w-5 h-5 text-green-600" />
                        Income Breakdown
                      </h3>
                      <div className="space-y-3">
                        {(() => {
                          const breakdown = getIncomeBreakdown();
                          if (breakdown.length === 0) {
                            return <p className="text-sm text-gray-400 italic">No income recorded for this period.</p>;
                          }
                          return breakdown.map(({ label, amount }, i) => (
                            <div key={label} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`p-1.5 rounded ${breakdownColors[i % breakdownColors.length].split(' ')[0]}`}>
                                  <TrendingUp className={`w-4 h-4 ${breakdownColors[i % breakdownColors.length].split(' ')[1]}`} />
                                </span>
                                <span className="text-sm">{label}</span>
                              </div>
                              <span className="font-medium">{fmtCurr(amount)}</span>
                            </div>
                          ));
                        })()}
                        {summary.income.total > 0 && (
                          <div className="flex justify-between font-medium text-green-600 pt-2 border-t border-gray-200">
                            <span>Total Income</span>
                            <span>{fmtCurr(summary.income.total)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Capital Breakdown */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Capital
                      </h3>
                      <div className="space-y-3">
                        {(() => {
                          const capitalData = getCapitalBreakdown();
                          if (capitalData.length === 0) {
                            return <p className="text-sm text-gray-400 italic">No capital recorded for this period.</p>;
                          }
                          return capitalData.map(({ label, amount }, i) => (
                            <div key={label} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`p-1.5 rounded bg-blue-100`}>
                                  <TrendingUp className="w-4 h-4 text-blue-700" />
                                </span>
                                <span className="text-sm">{label}</span>
                              </div>
                              <span className="font-medium">{fmtCurr(amount)}</span>
                            </div>
                          ));
                        })()}
                        {summary.capital.total > 0 && (
                          <div className="flex justify-between font-medium text-blue-600 pt-2 border-t border-gray-200">
                            <span>Total Capital</span>
                            <span>{fmtCurr(summary.capital.total)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expense Breakdown */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <ArrowDownRight className="w-5 h-5 text-red-600" />
                        Expense Breakdown
                      </h3>
                      <div className="space-y-3">
                        {(() => {
                          const breakdown = getExpenseBreakdown();
                          if (breakdown.length === 0) {
                            return <p className="text-sm text-gray-400 italic">No expenses recorded for this period.</p>;
                          }
                          return breakdown.map(({ label, amount }, i) => (
                            <div key={label} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`p-1.5 rounded ${breakdownColors[i % breakdownColors.length].split(' ')[0]}`}>
                                  <TrendingDown className={`w-4 h-4 ${breakdownColors[i % breakdownColors.length].split(' ')[1]}`} />
                                </span>
                                <span className="text-sm">{label}</span>
                              </div>
                              <span className="font-medium">{fmtCurr(amount)}</span>
                            </div>
                          ));
                        })()}
                        {summary.expenses.total > 0 && (
                          <div className="flex justify-between font-medium text-red-600 pt-2 border-t border-gray-200">
                            <span>Total Expenses</span>
                            <span>{fmtCurr(summary.expenses.total)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Monthly Trend */}
                  {monthlyTrend.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend (Last 12 Months)</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Month</th>
                              <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Income</th>
                              <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Expenses</th>
                              <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyTrend.map((item, index) => (
                              <tr key={index} className="border-b border-gray-100">
                                <td className="py-2 px-3 text-sm">{item.month}</td>
                                <td className="py-2 px-3 text-sm text-right text-green-600">{fmtCurr(item.income)}</td>
                                <td className="py-2 px-3 text-sm text-right text-red-600">{fmtCurr(item.expenses)}</td>
                                <td className={`py-2 px-3 text-sm text-right font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {fmtCurr(item.profit)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Receivables & Payables */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <ArrowUpRight className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Pending Receivables</p>
                          <p className="text-xl font-bold text-blue-600">{fmtCurr(health.pendingReceivables)}</p>
                          <p className="text-xs text-gray-500">Unpaid invoices</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <ArrowDownRight className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Pending Payables</p>
                          <p className="text-xl font-bold text-orange-600">{fmtCurr(health.pendingPayables)}</p>
                          <p className="text-xs text-gray-500">Approved unpaid expenses</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* All Transactions View */}
              {activeView === 'transactions' && (
                <div className="space-y-4">
                  <div className="flex gap-4 flex-wrap">
                    <select
                      value={transactionFilters.type}
                      onChange={(e) => { setTransactionFilters({ ...transactionFilters, type: e.target.value }); setTxPage(1); }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">All Types</option>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                    <select
                      value={transactionFilters.source}
                      onChange={(e) => { setTransactionFilters({ ...transactionFilters, source: e.target.value }); setTxPage(1); }}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">All Sources</option>
                      {dynamicSources.map(src => (
                        <option key={src} value={src}>{src.charAt(0).toUpperCase() + src.slice(1)}</option>
                      ))}
                    </select>
                    <span className="ml-auto text-sm text-gray-500 self-center">
                      {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Reference</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Description</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Type</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Source</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-gray-500">
                              No transactions found
                            </td>
                          </tr>
                        ) : (
                          paginatedTransactions.map((transaction, index) => (
                            <tr key={`${transaction.source_id}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-4 text-sm">{formatDate(transaction.transaction_date)}</td>
                              <td className="py-3 px-4">
                                <span className="font-mono text-sm">{transaction.reference_number || '-'}</span>
                              </td>
                              <td className="py-3 px-4">
                                <p className="text-sm text-gray-900">{transaction.description}</p>
                                {transaction.category && (
                                  <p className="text-xs text-gray-500">{transaction.category}</p>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${transactionTypeColors[transaction.transactionType]}`}>
                                  {transaction.transactionType}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${sourceColors[transaction.source_type]?.bg || 'bg-gray-100'} ${sourceColors[transaction.source_type]?.text || 'text-gray-700'}`}>
                                  {transaction.source_type}
                                </span>
                              </td>
                              <td className={`py-3 px-4 text-right font-medium ${
                                transaction.transactionType === 'income' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {transaction.transactionType === 'income' ? '+' : '-'}{fmtCurr(transaction.net_amount, transaction.currency)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {txTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-gray-500">
                        Page {txPage} of {txTotalPages} &mdash; showing {((txPage - 1) * TX_PER_PAGE) + 1}–{Math.min(txPage * TX_PER_PAGE, filteredTransactions.length)} of {filteredTransactions.length}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setTxPage(1)}
                          disabled={txPage === 1}
                          className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
                        >«</button>
                        <button
                          onClick={() => setTxPage(p => Math.max(1, p - 1))}
                          disabled={txPage === 1}
                          className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
                        >Prev</button>
                        <button
                          onClick={() => setTxPage(p => Math.min(txTotalPages, p + 1))}
                          disabled={txPage === txTotalPages}
                          className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
                        >Next</button>
                        <button
                          onClick={() => setTxPage(txTotalPages)}
                          disabled={txPage === txTotalPages}
                          className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
                        >»</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reports View */}
              {activeView === 'reports' && summary && health && (
                <div className="space-y-6">
                  {/* Report Actions */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Financial Reports</h2>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => generateFinanceReportPDF('preview')}
                        disabled={pdfGenerating || !companySettings}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Eye className="w-5 h-5" />
                        {pdfGenerating ? 'Generating...' : 'Preview PDF'}
                      </button>
                      <button
                        onClick={() => generateFinanceReportPDF('download')}
                        disabled={pdfGenerating || !companySettings}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download className="w-5 h-5" />
                        {pdfGenerating ? 'Generating...' : 'Download PDF'}
                      </button>
                    </div>
                  </div>

                  {!companySettings && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Company Settings Required</p>
                        <p className="text-sm text-yellow-700">Please configure your company settings in Invoice Management to enable PDF generation with company branding.</p>
                      </div>
                    </div>
                  )}

                  {/* Profit & Loss Statement */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6" ref={reportRef}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Profit & Loss Statement - {getPeriodLabel()}
                    </h3>
                    <div className="space-y-4">
                      {/* Income Section */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">INCOME</h4>
                        <div className="space-y-2 pl-4">
                          {summary.income.breakdown.length > 0 ? (
                            summary.income.breakdown.map(({ label, amount }) => (
                              <div key={label} className="flex justify-between text-sm">
                                <span>{label}</span>
                                <span>{fmtCurr(amount)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex justify-between text-sm text-gray-400">
                              <span>No income recorded</span>
                              <span>{fmtCurr(0)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between font-medium text-green-600 mt-2 pt-2 border-t border-gray-200">
                          <span>Total Income</span>
                          <span>{fmtCurr(summary.income.total)}</span>
                        </div>
                      </div>

                      {/* Capital Section */}
                      {summary.capital.total > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">CAPITAL</h4>
                          <div className="space-y-2 pl-4">
                            {summary.capital.breakdown.map(({ label, amount }) => (
                              <div key={label} className="flex justify-between text-sm">
                                <span>{label}</span>
                                <span>{fmtCurr(amount)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between font-medium text-blue-600 mt-2 pt-2 border-t border-gray-200">
                            <span>Total Capital</span>
                            <span>{fmtCurr(summary.capital.total)}</span>
                          </div>
                        </div>
                      )}

                      {/* Expenses Section */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">EXPENSES</h4>
                        <div className="space-y-2 pl-4">
                          {summary.expenses.breakdown.length > 0 ? (
                            summary.expenses.breakdown.map(({ label, amount }) => (
                              <div key={label} className="flex justify-between text-sm">
                                <span>{label}</span>
                                <span>{fmtCurr(amount)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex justify-between text-sm text-gray-400">
                              <span>No expenses recorded</span>
                              <span>{fmtCurr(0)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between font-medium text-red-600 mt-2 pt-2 border-t border-gray-200">
                          <span>Total Expenses</span>
                          <span>{fmtCurr(summary.expenses.total)}</span>
                        </div>
                      </div>

                      {/* Net Profit */}
                      <div className="flex justify-between text-lg font-bold pt-4 border-t-2 border-gray-300">
                        <span>Net Profit / (Loss)</span>
                        <span className={summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {fmtCurr(summary.netProfit)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Gross Profit Margin</h4>
                      <p className="text-2xl font-bold text-gray-900">
                        {summary.profitMargin.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Operating Expenses Ratio</h4>
                      <p className="text-2xl font-bold text-gray-900">
                        {summary.income.total > 0 
                          ? ((summary.expenses.total / summary.income.total) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-600 mb-2">YTD Profit</h4>
                      <p className={`text-2xl font-bold ${health.yearToDateProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmtCurr(health.yearToDateProfit)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default FinanceManagement;
