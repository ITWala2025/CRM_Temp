import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut,
  Receipt,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  Plus,
  Users,
  TrendingUp,
  RefreshCw,
  DollarSign,
  Calculator,
  Wallet,
  BarChart3,
  LayoutDashboard,
  Settings,
  Mail,
  UserCheck,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSignature,
  Bot,
  Sparkles,
} from 'lucide-react';
import AgentCopilotCenter from './AgentCopilotCenter';
import { simpleAuth, SimpleUser } from '../../utils/simpleAuth';
import { isSupabaseConfigured } from '../../config/supabase';
import { invoiceService } from '../../services/invoiceService';
import { quoteService } from '../../services/quoteService';
import { contractService } from '../../services/contractService';
import { financeService } from '../../services/financeService';
import { expenseService } from '../../services/expenseService';
import { mockStore } from '../../data/mockStore';
import { useCompanyContext } from '../../contexts/CompanyContext';
import { clientConfig } from '../../config/client.config';
import CompanySelector from '../ui/CompanySelector';
import type { InvoiceStats, Invoice } from '../../types/invoice';
import type { QuoteStats } from '../../types/quote';
import type { ContractStatistics } from '../../types/contract';
import type { FinancialSummary } from '../../services/financeService';
import type { ExpenseStats } from '../../services/expenseService';
import type { CustomerActivityTimelineItem } from '../../types/customer360';

// Lazy loaded CRM modules
const InvoiceManagement = lazy(() => import('../invoice/InvoiceManagement'));
const QuoteManagement = lazy(() => import('../quote/QuoteManagement'));
const ContractManagement = lazy(() => import('../contract/ContractManagement'));
const CustomerManagement = lazy(() => import('../customer/CustomerManagement'));
const Customer360Hub = lazy(() => import('../customer/Customer360Hub').then((m) => ({ default: m.Customer360Hub })));
const RateCardManagement = lazy(() => import('./RateCardManagement'));
const ExpenseManagement = lazy(() => import('./ExpenseManagement'));
const FinanceManagement = lazy(() => import('./FinanceManagement'));
const IncomeManagement = lazy(() => import('./IncomeManagement'));
const InvoiceSettings = lazy(() => import('./InvoiceSettings'));

type ActiveView =
  | 'dashboard'
  | 'invoices'
  | 'quotes'
  | 'contracts'
  | 'customers'
  | 'customer-360'
  | 'rate-cards'
  | 'income'
  | 'expenses'
  | 'finance'
  | 'settings';

type MenuSection = 'sales' | 'billing' | 'finance' | 'configuration';

export const SimpleAdminDashboard: React.FC = () => {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  const [openSections, setOpenSections] = useState<Record<MenuSection, boolean>>({
    sales: true,
    billing: true,
    finance: true,
    configuration: true,
  });

  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats | null>(null);
  const [quoteStats, setQuoteStats] = useState<QuoteStats | null>(null);
  const [contractStats, setContractStats] = useState<ContractStatistics | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [expenseStats, setExpenseStats] = useState<ExpenseStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [recentTimeline, setRecentTimeline] = useState<CustomerActivityTimelineItem[]>([]);
  const [isAgentCenterOpen, setIsAgentCenterOpen] = useState(false);

  const { companies, selectedCompany, selectCompany } = useCompanyContext();
  const navigate = useNavigate();
  const location = useLocation();

  const pathToView: Record<string, ActiveView> = {
    '/admin': 'dashboard',
    '/admin/dashboard': 'dashboard',
    '/admin/invoices': 'invoices',
    '/admin/quotes': 'quotes',
    '/admin/contracts': 'contracts',
    '/admin/customers': 'customers',
    '/admin/customer-360': 'customer-360',
    '/admin/rate-cards': 'rate-cards',
    '/admin/income': 'income',
    '/admin/expenses': 'expenses',
    '/admin/finance': 'finance',
    '/admin/settings': 'settings',
  };

  const activeView: ActiveView = pathToView[location.pathname] ?? 'dashboard';

  const currencySymbol =
    selectedCompany?.country?.currency_symbol ||
    (selectedCompany?.country?.code === 'USA' ? '$' : selectedCompany?.country?.code === 'IND' ? '₹' : '€');

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const toggleSection = (section: MenuSection) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const loadDashboardStats = async () => {
    try {
      setStatsLoading(true);
      const companyId = selectedCompany?.id;

      const [invStats, qteStats, ctrStats, finSummary, expStats, invList] = await Promise.all([
        invoiceService.getInvoiceStats(companyId),
        quoteService.getQuoteStats(companyId),
        contractService.getStatistics(companyId),
        financeService.getFinancialSummary('2026-01-01', '2026-12-31', 'Year to Date', companyId),
        expenseService.getExpenseStats(undefined, undefined, companyId),
        invoiceService.getInvoices({ company_settings_id: companyId }, 1, 5),
      ]);

      setInvoiceStats(invStats);
      setQuoteStats(qteStats);
      setContractStats(ctrStats);
      setFinancialSummary(finSummary);
      setExpenseStats(expStats);
      setRecentInvoices(invList.data || []);
      setRecentTimeline(mockStore.get<CustomerActivityTimelineItem>('activity_timeline').slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    const initUser = async () => {
      const currentUser = await simpleAuth.getCurrentUser();
      setUser(
        currentUser || {
          id: 'admin-01',
          email: 'admin@enterprise-crm.internal',
          username: 'admin',
        }
      );
    };
    initUser();
    loadDashboardStats();
  }, [selectedCompany]);

  const handleLogout = async () => {
    await simpleAuth.logout();
    navigate('/login');
  };

  const renderMainContent = () => {
    switch (activeView) {
      case 'invoices':
        return <InvoiceManagement onBackToDashboard={() => navigate('/admin')} />;
      case 'quotes':
        return <QuoteManagement onBackToDashboard={() => navigate('/admin')} />;
      case 'contracts':
        return <ContractManagement />;
      case 'customers':
        return <CustomerManagement />;
      case 'customer-360':
        return <Customer360Hub />;
      case 'rate-cards':
        return <RateCardManagement />;
      case 'income':
        return <IncomeManagement />;
      case 'expenses':
        return <ExpenseManagement />;
      case 'finance':
        return <FinanceManagement />;
      case 'settings':
        return <InvoiceSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-slate-900 text-slate-100 flex-shrink-0 transition-all duration-300 ease-in-out flex flex-col z-30 shadow-xl`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/60">
          {sidebarOpen ? (
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-indigo-600/30">
                CR
              </div>
              <div className="truncate">
                <h1 className="text-sm font-bold text-white tracking-wide truncate">{clientConfig.clientName}</h1>
                <p className="text-[10px] text-slate-400 truncate">{clientConfig.tagline}</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-base">
              CR
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {/* Main Dashboard Link */}
          <div>
            <button
              onClick={() => navigate('/admin')}
              className={`w-full flex items-center ${!sidebarOpen ? 'justify-center' : ''} px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                activeView === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={!sidebarOpen ? 'Dashboard' : undefined}
            >
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="ml-3 font-semibold">Executive Dashboard</span>}
            </button>
          </div>

          {/* Section 1: Sales & Customers */}
          <div>
            {sidebarOpen ? (
              <button
                onClick={() => toggleSection('sales')}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
              >
                <span>Sales & Accounts</span>
                {openSections.sales ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="h-px bg-slate-800 my-2" />
            )}

            {(openSections.sales || !sidebarOpen) && (
              <ul className="mt-2 space-y-1">
                <li>
                  <button
                    onClick={() => navigate('/admin/customers')}
                    className={`w-full flex items-center ${!sidebarOpen ? 'justify-center' : ''} px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'customers' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={!sidebarOpen ? 'Customers' : undefined}
                  >
                    <Building2 className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3">Customers</span>}
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => navigate('/admin/customer-360')}
                    className={`w-full flex items-center ${!sidebarOpen ? 'justify-center' : ''} px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'customer-360' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={!sidebarOpen ? 'Customer 360' : undefined}
                  >
                    <Compass className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3">Customer 360 Hub</span>}
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => navigate('/admin/quotes')}
                    className={`w-full flex items-center ${!sidebarOpen ? 'justify-center' : ''} px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'quotes' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={!sidebarOpen ? 'Quotes' : undefined}
                  >
                    <FileText className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3">Quotes & CPQ</span>}
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => navigate('/admin/contracts')}
                    className={`w-full flex items-center ${!sidebarOpen ? 'justify-center' : ''} px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'contracts' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={!sidebarOpen ? 'Contracts' : undefined}
                  >
                    <FileSignature className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3">Contracts (CLM)</span>}
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => navigate('/admin/rate-cards')}
                    className={`w-full flex items-center ${!sidebarOpen ? 'justify-center' : ''} px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'rate-cards' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={!sidebarOpen ? 'Rate Cards' : undefined}
                  >
                    <Calculator className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3">Rate Cards</span>}
                  </button>
                </li>
              </ul>
            )}
          </div>

          {/* Section 2: Billing & Revenue */}
          <div>
            {sidebarOpen ? (
              <button
                onClick={() => toggleSection('billing')}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
              >
                <span>Billing & Revenue</span>
                {openSections.billing ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="h-px bg-slate-800 my-2" />
            )}

            {(openSections.billing || !sidebarOpen) && (
              <ul className="mt-2 space-y-1">
                <li>
                  <button
                    onClick={() => navigate('/admin/invoices')}
                    className={`w-full flex items-center ${!sidebarOpen ? 'justify-center' : ''} px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'invoices' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={!sidebarOpen ? 'Invoices' : undefined}
                  >
                    <Receipt className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3">Invoices & Billing</span>}
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => navigate('/admin/income')}
                    className={`w-full flex items-center ${!sidebarOpen ? 'justify-center' : ''} px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'income' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={!sidebarOpen ? 'Income' : undefined}
                  >
                    <TrendingUp className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3">Income Tracking</span>}
                  </button>
                </li>
              </ul>
            )}
          </div>

          {/* Section 3: Finance & Cost Management */}
          <div>
            {sidebarOpen ? (
              <button
                onClick={() => toggleSection('finance')}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
              >
                <span>Finance & Costs</span>
                {openSections.finance ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="h-px bg-slate-800 my-2" />
            )}

            {(openSections.finance || !sidebarOpen) && (
              <ul className="mt-2 space-y-1">
                <li>
                  <button
                    onClick={() => navigate('/admin/expenses')}
                    className={`w-full flex items-center ${!sidebarOpen ? 'justify-center' : ''} px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'expenses' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={!sidebarOpen ? 'Expenses' : undefined}
                  >
                    <Wallet className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3">Expense Management</span>}
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => navigate('/admin/finance')}
                    className={`w-full flex items-center ${!sidebarOpen ? 'justify-center' : ''} px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'finance' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={!sidebarOpen ? 'Finance Health' : undefined}
                  >
                    <BarChart3 className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3">Finance & P&L</span>}
                  </button>
                </li>
              </ul>
            )}
          </div>

          {/* Section 4: Configuration */}
          <div>
            {sidebarOpen ? (
              <button
                onClick={() => toggleSection('configuration')}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
              >
                <span>Configuration</span>
                {openSections.configuration ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="h-px bg-slate-800 my-2" />
            )}

            {(openSections.configuration || !sidebarOpen) && (
              <ul className="mt-2 space-y-1">
                <li>
                  <button
                    onClick={() => navigate('/admin/settings')}
                    className={`w-full flex items-center ${!sidebarOpen ? 'justify-center' : ''} px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'settings' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={!sidebarOpen ? 'Settings' : undefined}
                  >
                    <Settings className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3">Invoice & Tax Settings</span>}
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* User Info & Logout Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="truncate pr-2">
                <p className="text-xs font-semibold text-white truncate">{user?.email || 'admin@crm.internal'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                    {isSupabaseConfigured ? 'Supabase Live' : 'Mock Engine'}
                  </span>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Container ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-bold text-gray-900 capitalize tracking-tight">
              {activeView === 'dashboard' ? 'Executive CRM Cockpit' : activeView.replace(/-/g, ' ')}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
              {clientConfig.legalEntityName}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Multi-Tenant Entity Selector */}
            <CompanySelector
              companies={companies}
              selectedId={selectedCompany?.id ?? null}
              onChange={selectCompany}
            />

            <button
              onClick={() => setIsAgentCenterOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all"
              title="Open Autonomous AI Agents Center"
            >
              <Bot className="w-4 h-4" />
              <span>AI Agents</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </button>

            <button
              onClick={loadDashboardStats}
              disabled={statsLoading}
              className="p-2 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh CRM Data"
            >
              <RefreshCw className={`w-5 h-5 ${statsLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </header>

        {/* View Router */}
        <main className="p-6">
          {activeView === 'dashboard' ? (
            <div className="space-y-6">
              {/* Top KPI Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Revenue Card */}
                <div
                  onClick={() => navigate('/admin/invoices')}
                  className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Total Invoiced</span>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Receipt className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                      {formatCurrency(invoiceStats?.total_revenue || 0)}
                    </h3>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span className="text-emerald-600 font-medium">{invoiceStats?.paid_invoices || 0} Paid</span>
                      <span className="text-amber-600 font-medium">{invoiceStats?.draft_invoices || 0} Draft</span>
                    </div>
                  </div>
                </div>

                {/* Quotes Card */}
                <div
                  onClick={() => navigate('/admin/quotes')}
                  className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Quotes Pipeline</span>
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                      {formatCurrency(quoteStats?.total_quoted_amount || 0)}
                    </h3>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span className="text-emerald-600 font-medium">{quoteStats?.accepted_quotes || 0} Accepted</span>
                      <span className="text-indigo-600 font-medium">{quoteStats?.converted_quotes || 0} Converted</span>
                    </div>
                  </div>
                </div>

                {/* Contracts Card */}
                <div
                  onClick={() => navigate('/admin/contracts')}
                  className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Active Contracts</span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileSignature className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                      {formatCurrency(contractStats?.active_contract_value || 0)}
                    </h3>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span className="text-emerald-600 font-medium">{contractStats?.active_contracts || 0} Active</span>
                      <span className="text-slate-500 font-medium">{contractStats?.total_contracts || 0} Total</span>
                    </div>
                  </div>
                </div>

                {/* Net Margin / Operating Profit */}
                <div
                  onClick={() => navigate('/admin/finance')}
                  className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Net Operating Profit</span>
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                      {formatCurrency(financialSummary?.netProfit || 0)}
                    </h3>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span className="text-teal-600 font-medium">{financialSummary?.profitMargin?.toFixed(1) || 0}% Margin</span>
                      <span className="text-slate-400">YTD Performance</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Action Shortcuts */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Quick CRM Operations</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <button
                    onClick={() => navigate('/admin/customers')}
                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-700 transition-all border border-indigo-100 group"
                  >
                    <Building2 className="w-6 h-6 mb-2 text-indigo-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-center">Add Customer</span>
                  </button>

                  <button
                    onClick={() => navigate('/admin/quotes')}
                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-purple-50/60 hover:bg-purple-100/80 text-purple-700 transition-all border border-purple-100 group"
                  >
                    <FileText className="w-6 h-6 mb-2 text-purple-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-center">New Quote</span>
                  </button>

                  <button
                    onClick={() => navigate('/admin/invoices')}
                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-blue-50/60 hover:bg-blue-100/80 text-blue-700 transition-all border border-blue-100 group"
                  >
                    <Receipt className="w-6 h-6 mb-2 text-blue-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-center">New Invoice</span>
                  </button>

                  <button
                    onClick={() => navigate('/admin/contracts')}
                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-700 transition-all border border-emerald-100 group"
                  >
                    <FileSignature className="w-6 h-6 mb-2 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-center">Draft Contract</span>
                  </button>

                  <button
                    onClick={() => navigate('/admin/income')}
                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-teal-50/60 hover:bg-teal-100/80 text-teal-700 transition-all border border-teal-100 group"
                  >
                    <TrendingUp className="w-6 h-6 mb-2 text-teal-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-center">Log Income</span>
                  </button>

                  <button
                    onClick={() => navigate('/admin/expenses')}
                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-rose-50/60 hover:bg-rose-100/80 text-rose-700 transition-all border border-rose-100 group"
                  >
                    <Wallet className="w-6 h-6 mb-2 text-rose-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-center">Log Expense</span>
                  </button>
                </div>
              </div>

              {/* Two Column Grid: Recent Invoices & Realtime Activity Stream */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Invoices Table (2 cols) */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-bold text-gray-900">Recent Invoices</h4>
                      <p className="text-xs text-gray-500">Latest billing transactions across entities</p>
                    </div>
                    <button
                      onClick={() => navigate('/admin/invoices')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      View All &rarr;
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100 overflow-x-auto">
                    {recentInvoices.map((inv) => (
                      <div key={inv.id} className="p-4 hover:bg-gray-50 flex items-center justify-between transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{inv.invoice_number}</p>
                            <p className="text-xs text-gray-500">{inv.customer?.company_name || 'Customer'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-gray-900">{formatCurrency(inv.total_amount)}</p>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              inv.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.status === 'overdue'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Realtime Activity Stream (1 col) */}
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
                  <h4 className="text-base font-bold text-gray-900 mb-1">Live CRM Activity</h4>
                  <p className="text-xs text-gray-500 mb-4">Chronological operational timeline</p>
                  <div className="space-y-4">
                    {recentTimeline.map((item) => (
                      <div key={item.id} className="flex items-start space-x-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-600 mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{item.title}</p>
                          {item.description && <p className="text-[11px] text-gray-500 mt-0.5">{item.description}</p>}
                          <p className="text-[10px] text-gray-400 mt-1 font-mono">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                </div>
              }
            >
              {renderMainContent()}
            </Suspense>
          )}
        </main>
      </div>

      {/* Autonomous AI Agents Slide-over Drawer */}
      <AgentCopilotCenter
        isOpen={isAgentCenterOpen}
        onClose={() => setIsAgentCenterOpen(false)}
        onNavigateToEntity={(entityType) => {
          setIsAgentCenterOpen(false);
          if (entityType === 'invoice') navigate('/admin/invoices');
          else if (entityType === 'quote') navigate('/admin/quotes');
          else if (entityType === 'contract') navigate('/admin/contracts');
          else if (entityType === 'expense') navigate('/admin/expenses');
          else if (entityType === 'customer') navigate('/admin/customers');
        }}
      />
    </div>
  );
};

export default SimpleAdminDashboard;
