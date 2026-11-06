import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Edit, Trash2, Eye, X, Filter, Download, Upload,
  CheckCircle, XCircle, Clock, DollarSign, Receipt, Building2,
  Calendar, CreditCard, Tag, FileText, TrendingUp, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  expenseService,
  Expense,
  ExpenseCategory,
  Vendor,
  CreateExpenseData,
  CreateVendorData,
  ExpenseStats,
  PaginatedResponse
} from '../../services/expenseService';
import { invoiceService } from '../../services/invoiceService';
import type { Country, CompanySettings } from '../../types/invoice';
import { useToast } from '../ui/ToastProvider';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useActionProgress } from '../../contexts/ActionProgressContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useCompanyContext } from '../../contexts/CompanyContext';

type TabType = 'expenses' | 'vendors' | 'categories';
type ModalType = 'expense' | 'vendor' | 'category' | null;

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' }
];

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  reimbursed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  partially_paid: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-gray-100 text-gray-800'
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

const ExpenseManagement: React.FC = () => {
  const { showError, showSuccess } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const { startAction, endAction } = useActionProgress();
  const { selectedCompany, companies } = useCompanyContext();

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Mark paid dialog state
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [markPaidTargetId, setMarkPaidTargetId] = useState('');
  const [markPaidDate, setMarkPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [markPaidLoading, setMarkPaidLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    categoryId: '',
    vendorId: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    loadData();
    loadCountries();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedCompany]);
  
  const loadCountries = async () => {
    try {
      const data = await invoiceService.getCountries();
      setCountries(data);
    } catch (error) {
      console.error('Error loading countries:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'expenses') {
      loadExpenses();
    }
  }, [filters, currentPage, searchTerm, itemsPerPage]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expenseData, vendorData, categoryData, statsData] = await Promise.all([
        expenseService.getExpenses({ company_settings_id: selectedCompany?.id, search: searchTerm || undefined }, currentPage, itemsPerPage),
        expenseService.getVendors(),
        expenseService.getCategories(),
        expenseService.getExpenseStats(undefined, undefined, selectedCompany?.id)
      ]);
      setExpenses(expenseData.data);
      setTotalPages(expenseData.total_pages);
      setTotalCount(expenseData.count);
      setVendors(vendorData);
      setCategories(categoryData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExpenses = async () => {
    try {
      const data = await expenseService.getExpenses(
        {
          status: filters.status || undefined,
          paymentStatus: filters.paymentStatus || undefined,
          categoryId: filters.categoryId || undefined,
          vendorId: filters.vendorId || undefined,
          company_settings_id: selectedCompany?.id,
          search: searchTerm || undefined,
        },
        currentPage,
        itemsPerPage
      );
      setExpenses(data.data);
      setTotalPages(data.total_pages);
      setTotalCount(data.count);
      expenseService.getExpenseStats(undefined, undefined, selectedCompany?.id).then(setStats);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      paymentStatus: '',
      categoryId: '',
      vendorId: ''
    });
    setCurrentPage(1);
    setSearchTerm('');
  };

  const openModal = (type: ModalType, mode: 'create' | 'edit' | 'view', item?: any) => {
    setModalType(type);
    setModalMode(mode);
    setSelectedItem(item || null);
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedItem(null);
  };

  const handleSaveExpense = async (data: CreateExpenseData) => {
    try {
      if (modalMode === 'create') {
        await expenseService.createExpense(data);
      } else {
        await expenseService.updateExpense(selectedItem.id, data);
      }
      closeModal();
      // Reload expenses with current filters to maintain filter state
      await loadExpenses();
      // Reload stats in the background
      expenseService.getExpenseStats(undefined, undefined, selectedCompany?.id).then(setStats);
      showSuccess('Expense saved successfully');
    } catch (error) {
      console.error('Error saving expense:', error);
      showError('Failed to save expense');
    }
  };

  const handleSaveVendor = async (data: CreateVendorData) => {
    try {
      if (modalMode === 'create') {
        await expenseService.createVendor(data);
      } else {
        await expenseService.updateVendor(selectedItem.id, data);
      }
      closeModal();
      loadData();
      showSuccess('Vendor saved successfully');
    } catch (error) {
      console.error('Error saving vendor:', error);
      showError('Failed to save vendor');
    }
  };

  const handleSaveCategory = async (name: string, description?: string) => {
    try {
      if (modalMode === 'create') {
        await expenseService.createCategory(name, description);
      } else {
        await expenseService.updateCategory(selectedItem.id, { name, description });
      }
      closeModal();
      loadData();
      showSuccess('Category saved successfully');
    } catch (error) {
      console.error('Error saving category:', error);
      showError('Failed to save category');
    }
  };

  const handleApprove = async (id: string) => {
    const confirmed = await confirm({
      title: 'Approve Expense',
      message: 'Are you sure you want to approve this expense?',
      confirmText: 'Approve',
      cancelText: 'Cancel',
      type: 'warning'
    });
    if (!confirmed) return;
    startAction('Approving expense…');
    try {
      await expenseService.approveExpense(id);
      await loadExpenses();
      expenseService.getExpenseStats(undefined, undefined, selectedCompany?.id).then(setStats);
    } catch (error) {
      console.error('Error approving expense:', error);
    } finally {
      endAction();
    }
  };

  const handleReject = (id: string) => {
    setRejectTargetId(id);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) return;
    setRejectLoading(true);
    try {
      await expenseService.rejectExpense(rejectTargetId, rejectReason);
      await loadExpenses();
      expenseService.getExpenseStats(undefined, undefined, selectedCompany?.id).then(setStats);
      setRejectDialogOpen(false);
    } catch (error) {
      console.error('Error rejecting expense:', error);
    } finally {
      setRejectLoading(false);
    }
  };

  const handleMarkPaid = (id: string) => {
    setMarkPaidTargetId(id);
    setMarkPaidDate(new Date().toISOString().split('T')[0]);
    setMarkPaidDialogOpen(true);
  };

  const submitMarkPaid = async () => {
    setMarkPaidLoading(true);
    try {
      await expenseService.markExpensePaid(markPaidTargetId, markPaidDate);
      await loadExpenses();
      expenseService.getExpenseStats(undefined, undefined, selectedCompany?.id).then(setStats);
      setMarkPaidDialogOpen(false);
    } catch (error) {
      console.error('Error marking expense paid:', error);
    } finally {
      setMarkPaidLoading(false);
    }
  };

  const handleDelete = async (type: 'expense' | 'vendor' | 'category', id: string) => {
    const confirmed = await confirm({
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item? This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!confirmed) return;
    startAction(`Deleting ${type}…`);
    try {
      switch (type) {
        case 'expense':
          await expenseService.deleteExpense(id);
          await loadExpenses();
          expenseService.getExpenseStats(undefined, undefined, selectedCompany?.id).then(setStats);
          break;
        case 'vendor':
          await expenseService.deleteVendor(id);
          loadData();
          break;
        case 'category':
          await expenseService.deleteCategory(id);
          loadData();
          break;
      }
    } catch (error) {
      console.error('Error deleting:', error);
    } finally {
      endAction();
    }
  };

  // Filter data based on search
  const filteredExpenses = expenses.filter(e =>
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.expense_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.vendors?.name || e.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-orange-600" />
            Expense Management
          </h1>
          <p className="text-gray-600 mt-1">Manage company expenses, vendors, and categories</p>
        </div>
        <button
          onClick={() => openModal(activeTab === 'expenses' ? 'expense' : activeTab === 'vendors' ? 'vendor' : 'category', 'create')}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-5 h-5" />
          Add {activeTab === 'expenses' ? 'Expense' : activeTab === 'vendors' ? 'Vendor' : 'Category'}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Receipt className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Expenses</p>
                <p className="text-lg font-bold text-gray-900">{stats.totalExpenses}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalAmount, getCompanyCurrency(selectedCompany))}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Approval</p>
                <p className="text-lg font-bold text-gray-900">{stats.pendingApproval}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Payment</p>
                <p className="text-lg font-bold text-gray-900">{stats.pendingPayment}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Paid This Month</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.paidThisMonth, getCompanyCurrency(selectedCompany))}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'expenses', label: 'Expenses', icon: Receipt },
              { id: 'vendors', label: 'Vendors', icon: Building2 },
              { id: 'categories', label: 'Categories', icon: Tag }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-orange-600 text-orange-600'
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

        {/* Search and Filters */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            {activeTab === 'expenses' && (
              <>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                    showFilters ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  Filters
                </button>
                {(filters.status || filters.paymentStatus || filters.categoryId || filters.vendorId || searchTerm) && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    title="Clear all filters"
                  >
                    <X className="w-5 h-5" />
                    Clear
                  </button>
                )}
              </>
            )}
          </div>

          {/* Expense Filters */}
          {activeTab === 'expenses' && showFilters && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters({ ...filters, status: e.target.value });
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={filters.paymentStatus}
                onChange={(e) => {
                  setFilters({ ...filters, paymentStatus: e.target.value });
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Payment Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially Paid</option>
              </select>
              <select
                value={filters.categoryId}
                onChange={(e) => {
                  setFilters({ ...filters, categoryId: e.target.value });
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <select
                value={filters.vendorId}
                onChange={(e) => {
                  setFilters({ ...filters, vendorId: e.target.value });
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Content */}
        {activeTab === 'expenses' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Expense #</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Amt</th>
                  <th className="py-3 px-4 text-right">Tax</th>
                  <th className="py-3 px-4 text-right">Total Amt</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12">
                      <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-2" />
                      <p className="text-gray-500">Loading expenses...</p>
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-12 text-gray-500">
                          No expenses found
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((expense) => {
                        const companyCurrency = getCompanyCurrency(selectedCompany);
                        const isIndianCompany = companyCurrency === 'INR';

                        let displayCurrency = companyCurrency;
                        let amt = expense.amount;
                        let tax = expense.tax_amount || 0;
                        let total = expense.total_amount || (amt + tax);

                        if (isIndianCompany) {
                          displayCurrency = 'INR';
                          const rate = expense.exchange_rate || 1;
                          amt = expense.inr_amount ?? ((expense.amount || expense.original_amount || 0) * rate);
                          tax = expense.inr_tax_amount ?? ((expense.tax_amount || 0) * rate);
                          total = expense.inr_total_amount ?? ((expense.total_amount || ((expense.amount || 0) + (expense.tax_amount || 0))) * rate);
                        } else {
                          displayCurrency = expense.currency || expense.original_currency_code || companyCurrency;
                        }

                        const isForeign = isIndianCompany && expense.original_currency_code && expense.original_currency_code !== 'INR';

                        return (
                          <tr key={expense.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <span className="font-mono text-sm">{expense.expense_number}</span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-gray-900">{expense.title}</p>
                              {expense.description && (
                                <p className="text-sm text-gray-500 truncate max-w-xs">{expense.description}</p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {expense.expense_categories?.name || '-'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {expense.vendors?.name || expense.vendor_name || '-'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {formatDate(expense.expense_date)}
                            </td>
                            <td className="py-3 px-4 text-right text-sm text-gray-700">
                              {formatCurrency(amt, displayCurrency)}
                            </td>
                            <td className="py-3 px-4 text-right text-sm text-gray-600">
                              {formatCurrency(tax, displayCurrency)}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-gray-900">
                              <div>{formatCurrency(total, displayCurrency)}</div>
                              {isForeign && (
                                <div className="text-xs text-gray-400 font-normal">
                                  ({expense.original_currency_code} {(expense.original_amount || expense.amount).toFixed(2)})
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[expense.status]}`}>
                                {expense.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[expense.payment_status]}`}>
                                {expense.payment_status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openModal('expense', 'view', expense)}
                                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                                  title="View"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openModal('expense', 'edit', expense)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                {expense.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleApprove(expense.id)}
                                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                      title="Approve"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleReject(expense.id)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                      title="Reject"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                {expense.status === 'approved' && expense.payment_status === 'pending' && (
                                  <button
                                    onClick={() => handleMarkPaid(expense.id)}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                    title="Mark Paid"
                                  >
                                    <DollarSign className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete('expense', expense.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Expenses Pagination Bar */}
        {activeTab === 'expenses' && totalCount > 0 && (
          <div className="px-4 py-3 bg-white border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)} to{' '}
                {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} expenses
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="ml-2 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-orange-500"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="font-medium text-gray-900">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Vendors Tab */}
        {activeTab === 'vendors' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredVendors.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                No vendors found
              </div>
            ) : (
              filteredVendors.map((vendor) => (
                <div key={vendor.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Building2 className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{vendor.name}</h3>
                        {vendor.contact_person && (
                          <p className="text-sm text-gray-500">{vendor.contact_person}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openModal('vendor', 'edit', vendor)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete('vendor', vendor.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    {vendor.email && <p>📧 {vendor.email}</p>}
                    {vendor.phone && <p>📞 {vendor.phone}</p>}
                    {vendor.gstin && <p>🏷️ GSTIN: {vendor.gstin}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {categories.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                No categories found
              </div>
            ) : (
              categories.map((category) => {
                const categoryStats = stats?.byCategory.find(c => c.category === category.name);
                return (
                  <div key={category.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Tag className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{category.name}</h3>
                          {category.description && (
                            <p className="text-sm text-gray-500">{category.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openModal('category', 'edit', category)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete('category', category.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {categoryStats && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                        <span className="text-gray-500">{categoryStats.count} expenses</span>
                        <span className="font-medium text-gray-900">{formatCurrency(categoryStats.amount, getCompanyCurrency(selectedCompany))}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {modalType === 'expense' && (
        <ExpenseModal
          mode={modalMode}
          expense={selectedItem}
          categories={categories}
          vendors={vendors}
          countries={countries}
          companies={companies}
          selectedCompany={selectedCompany}
          onClose={closeModal}
          onSave={handleSaveExpense}
        />
      )}
      {modalType === 'vendor' && (
        <VendorModal
          mode={modalMode}
          vendor={selectedItem}
          onClose={closeModal}
          onSave={handleSaveVendor}
        />
      )}
      {modalType === 'category' && (
        <CategoryModal
          mode={modalMode}
          category={selectedItem}
          onClose={closeModal}
          onSave={handleSaveCategory}
        />
      )}

      {/* Reject Modal */}
      {rejectDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Expense</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Rejection *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 mb-4"
              placeholder="Provide a reason..."
              required
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectDialogOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={rejectLoading || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {rejectLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {markPaidDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mark Expense as Paid</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
            <input
              type="date"
              value={markPaidDate}
              onChange={(e) => setMarkPaidDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 mb-4"
              required
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMarkPaidDialogOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitMarkPaid}
                disabled={markPaidLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {markPaidLoading ? 'Saving...' : 'Mark Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

// Expense Modal Component
const ExpenseModal: React.FC<{
  mode: 'create' | 'edit' | 'view';
  expense: Expense | null;
  categories: ExpenseCategory[];
  vendors: Vendor[];
  countries: Country[];
  companies: CompanySettings[];
  selectedCompany: CompanySettings | null;
  onClose: () => void;
  onSave: (data: CreateExpenseData) => void;
}> = ({ mode, expense, categories, vendors, countries, companies, selectedCompany, onClose, onSave }) => {
  const initialCurrency = expense?.currency || expense?.original_currency_code || getCompanyCurrency(selectedCompany);

  const [formData, setFormData] = useState<CreateExpenseData>(() => {
    if (expense && mode !== 'create') {
      return {
        category_id: expense.category_id || undefined,
        vendor_id: expense.vendor_id || undefined,
        vendor_name: expense.vendor_name || undefined,
        title: expense.title,
        description: expense.description || undefined,
        expense_date: expense.expense_date,
        amount: expense.amount,
        tax_amount: expense.tax_amount,
        currency: expense.currency || initialCurrency,
        company_settings_id: expense.company_settings_id || undefined,
        // Multi-currency fields
        original_currency_code: expense.original_currency_code || initialCurrency,
        original_amount: expense.original_amount || expense.amount,
        exchange_rate: expense.exchange_rate || 1,
        exchange_rate_date: expense.exchange_rate_date || undefined,
        inr_amount: expense.inr_amount || expense.amount,
        inr_tax_amount: expense.inr_tax_amount || expense.tax_amount,
        inr_total_amount: expense.inr_total_amount || expense.total_amount,
        // Other fields
        payment_method: expense.payment_method || undefined,
        payment_status: expense.payment_status,
        payment_date: expense.payment_date || undefined,
        payment_reference: expense.payment_reference || undefined,
        invoice_number: expense.invoice_number || undefined,
        receipt_url: expense.receipt_url || undefined,
        status: expense.status,
        is_reimbursable: expense.is_reimbursable,
        notes: expense.notes || undefined,
        tags: expense.tags || undefined
      };
    }
    return {
      title: '',
      description: '',
      expense_date: new Date().toISOString().split('T')[0],
      amount: 0,
      tax_amount: 0,
      currency: initialCurrency,
      company_settings_id: selectedCompany?.id || undefined,
      // Multi-currency defaults
      original_currency_code: initialCurrency,
      original_amount: 0,
      exchange_rate: 1,
      exchange_rate_date: new Date().toISOString().split('T')[0],
      inr_amount: 0,
      inr_tax_amount: 0,
      inr_total_amount: 0,
      // Other defaults
      payment_method: 'bank_transfer',
      payment_status: 'pending',
      status: 'pending',
      is_reimbursable: false
    };
  });
  
  const isReadOnly = mode === 'view';
  const isCurrencyLocked = expense?.is_currency_locked || false;
  
  // Get currency symbol for display
  const getSelectedCurrency = () => {
    const currency = formData.original_currency_code || initialCurrency;
    const country = countries.find(c => c.currency_code === currency);
    return country ? { code: currency, symbol: country.currency_symbol, name: country.currency_name } : { code: currency, symbol: currency === 'EUR' ? '€' : currency === 'INR' ? '₹' : '$', name: currency };
  };

  // Calculate INR values when amount or exchange rate changes
  const calculateINRValues = (originalAmount: number, taxAmount: number, exchangeRate: number) => {
    const inrAmount = originalAmount * exchangeRate;
    const inrTaxAmount = taxAmount * exchangeRate;
    const inrTotalAmount = inrAmount + inrTaxAmount;
    return { inrAmount, inrTaxAmount, inrTotalAmount };
  };

  // Handle currency change
  const handleCurrencyChange = (currencyCode: string) => {
    const newRate = 1;
    
    setFormData(prev => {
      const { inrAmount, inrTaxAmount, inrTotalAmount } = calculateINRValues(
        prev.original_amount || 0,
        prev.tax_amount || 0,
        newRate
      );
      return {
        ...prev,
        original_currency_code: currencyCode,
        currency: currencyCode,
        exchange_rate: newRate,
        exchange_rate_date: new Date().toISOString().split('T')[0],
        inr_amount: inrAmount,
        inr_tax_amount: inrTaxAmount,
        inr_total_amount: inrTotalAmount,
        amount: prev.original_amount || 0
      };
    });
  };

  // Handle original amount change
  const handleOriginalAmountChange = (amount: number) => {
    setFormData(prev => {
      const { inrAmount, inrTaxAmount, inrTotalAmount } = calculateINRValues(
        amount,
        prev.tax_amount || 0,
        prev.exchange_rate || 1
      );
      return {
        ...prev,
        original_amount: amount,
        inr_amount: inrAmount,
        inr_tax_amount: inrTaxAmount,
        inr_total_amount: inrTotalAmount,
        amount: amount
      };
    });
  };

  // Handle tax amount change
  const handleTaxAmountChange = (taxAmount: number) => {
    setFormData(prev => {
      const { inrAmount, inrTaxAmount, inrTotalAmount } = calculateINRValues(
        prev.original_amount || 0,
        taxAmount,
        prev.exchange_rate || 1
      );
      return {
        ...prev,
        tax_amount: taxAmount,
        inr_tax_amount: inrTaxAmount,
        inr_total_amount: inrTotalAmount
      };
    });
  };

  // Handle exchange rate change
  const handleExchangeRateChange = (rate: number) => {
    setFormData(prev => {
      const { inrAmount, inrTaxAmount, inrTotalAmount } = calculateINRValues(
        prev.original_amount || 0,
        prev.tax_amount || 0,
        rate
      );
      return {
        ...prev,
        exchange_rate: rate,
        exchange_rate_date: new Date().toISOString().split('T')[0],
        inr_amount: inrAmount,
        inr_tax_amount: inrTaxAmount,
        inr_total_amount: inrTotalAmount,
        amount: prev.original_amount || 0
      };
    });
  };

  const handleCompanySelectChange = (companyId: string) => {
    const comp = companies.find(c => c.id === companyId) || null;
    const newCurr = getCompanyCurrency(comp);
    setFormData(prev => ({
      ...prev,
      company_settings_id: companyId || null,
      currency: newCurr,
      original_currency_code: newCurr
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      currency: formData.original_currency_code || initialCurrency,
      amount: formData.original_amount || 0
    });
  };

  // Get unique currencies from countries
  const uniqueCurrencies = Array.from(new Set(countries.map(c => c.currency_code)))
    .map(code => {
      const country = countries.find(c => c.currency_code === code);
      return { code, symbol: country?.currency_symbol || '', name: country?.currency_name || '' };
    })
    .sort((a, b) => a.code === 'INR' ? -1 : b.code === 'INR' ? 1 : a.code.localeCompare(b.code));

  const selectedCurrency = getSelectedCurrency();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Create Expense' : mode === 'edit' ? 'Edit Expense' : 'View Expense'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company / Entity</label>
              <select
                value={formData.company_settings_id || ''}
                onChange={(e) => handleCompanySelectChange(e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              >
                <option value="">Unassigned (All Companies)</option>
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.company_name}{comp.country?.code ? ` (${comp.country.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isReadOnly}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category_id || ''}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
              <select
                value={formData.vendor_id || ''}
                onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value, vendor_name: '' })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              >
                <option value="">Select Vendor (or enter name)</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            {!formData.vendor_id && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name (if not in list)</label>
                <input
                  type="text"
                  value={formData.vendor_name || ''}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expense Date *</label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={formData.payment_method || ''}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              >
                <option value="">Select Method</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.value} value={pm.value}>{pm.label}</option>
                ))}
              </select>
            </div>
            
            {/* Currency Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
              <select
                value={formData.original_currency_code || 'INR'}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                disabled={isReadOnly || isCurrencyLocked}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              >
                {uniqueCurrencies.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name} ({curr.symbol})
                  </option>
                ))}
              </select>
              {isCurrencyLocked && (
                <p className="text-xs text-amber-600 mt-1">Currency is locked for approved/paid expenses</p>
              )}
            </div>
            
            {/* Amount in Original Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount ({selectedCurrency.symbol}) *
              </label>
              <input
                type="number"
                value={formData.original_amount || 0}
                onChange={(e) => handleOriginalAmountChange(parseFloat(e.target.value) || 0)}
                disabled={isReadOnly || isCurrencyLocked}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                required
                min="0"
                step="0.01"
              />
            </div>
            
            {/* Tax Amount in Original Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Amount ({selectedCurrency.symbol})
              </label>
              <input
                type="number"
                value={formData.tax_amount || 0}
                onChange={(e) => handleTaxAmountChange(parseFloat(e.target.value) || 0)}
                disabled={isReadOnly || isCurrencyLocked}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                min="0"
                step="0.01"
              />
            </div>
            
            {/* Exchange Rate (shown only for non-INR currencies) */}
            {formData.original_currency_code !== 'INR' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exchange Rate (1 {formData.original_currency_code} = ₹)
                  </label>
                  <input
                    type="number"
                    value={formData.exchange_rate || 1}
                    onChange={(e) => handleExchangeRateChange(parseFloat(e.target.value) || 1)}
                    disabled={isReadOnly || isCurrencyLocked}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                    min="0.0001"
                    step="0.0001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate Date</label>
                  <input
                    type="date"
                    value={formData.exchange_rate_date || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormData({ ...formData, exchange_rate_date: e.target.value })}
                    disabled={isReadOnly || isCurrencyLocked}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                  />
                </div>
              </>
            )}
            
            {/* INR Value Display */}
            <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">INR Values (Reporting Currency)</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Amount:</span>
                  <span className="font-semibold text-blue-900 ml-2">
                    ₹{(formData.inr_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Tax:</span>
                  <span className="font-semibold text-blue-900 ml-2">
                    ₹{(formData.inr_tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Total:</span>
                  <span className="font-bold text-blue-900 ml-2">
                    ₹{(formData.inr_total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice/Bill Number</label>
              <input
                type="text"
                value={formData.invoice_number || ''}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Reference</label>
              <input
                type="text"
                value={formData.payment_reference || ''}
                onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={isReadOnly}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_reimbursable}
                  onChange={(e) => setFormData({ ...formData, is_reimbursable: e.target.checked })}
                  disabled={isReadOnly}
                  className="rounded text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">This is a reimbursable expense</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                {mode === 'create' ? 'Create Expense' : 'Save Changes'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// Vendor Modal Component
const VendorModal: React.FC<{
  mode: 'create' | 'edit' | 'view';
  vendor: Vendor | null;
  onClose: () => void;
  onSave: (data: CreateVendorData) => void;
}> = ({ mode, vendor, onClose, onSave }) => {
  const [formData, setFormData] = useState<CreateVendorData>(() => {
    if (vendor && mode !== 'create') {
      return { ...vendor };
    }
    return {
      name: '',
      is_active: true
    };
  });

  const isReadOnly = mode === 'view';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Add Vendor' : mode === 'edit' ? 'Edit Vendor' : 'View Vendor'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input
              type="text"
              value={formData.contact_person || ''}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              disabled={isReadOnly}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
              <input
                type="text"
                value={formData.gstin || ''}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
              <input
                type="text"
                value={formData.pan || ''}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <input
              type="text"
              value={formData.bank_name || ''}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input
                type="text"
                value={formData.bank_account || ''}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
              <input
                type="text"
                value={formData.bank_ifsc || ''}
                onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                {mode === 'create' ? 'Add Vendor' : 'Save Changes'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// Category Modal Component
const CategoryModal: React.FC<{
  mode: 'create' | 'edit' | 'view';
  category: ExpenseCategory | null;
  onClose: () => void;
  onSave: (name: string, description?: string) => void;
}> = ({ mode, category, onClose, onSave }) => {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(name, description || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Add Category' : 'Edit Category'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="pt-4 border-t border-gray-200 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              {mode === 'create' ? 'Add Category' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseManagement;
