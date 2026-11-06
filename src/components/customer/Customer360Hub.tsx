import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Users, Building2, Search, ArrowRight, DollarSign, FileText,
  Briefcase, RefreshCw, Plus, CheckCircle, AlertTriangle,
  Phone, Mail, MapPin, Globe, CreditCard, Clock, Award,
  TrendingUp, Compass, UserPlus, FilePlus, ShieldCheck, Network, GitBranch, LifeBuoy, UserCheck
} from 'lucide-react';
import { customer360Service } from '../../services/customer360Service';
import { invoiceService } from '../../services/invoiceService';
import { useCompanyContext } from '../../contexts/CompanyContext';
import { formatCurrencyWithSymbol, convertCurrency } from '../../utils/currencyConverter';
import { getTaxRegistrationLabel } from '../../utils/taxUtils';
import { getPrimaryCustomerId } from '../../utils/customerCodeUtils';
import { CustomerContactModal } from './CustomerContactModal';
import { CustomerHierarchyPanel } from './CustomerHierarchyPanel';
import { ContactNetworkPanel } from './ContactNetworkPanel';
import type { Customer } from '../../types/invoice';
import type { Customer360Data } from '../../types/customer360';

type TabType = 'overview' | 'contacts' | 'leads' | 'opportunities' | 'quotes' | 'contracts' | 'subscriptions' | 'invoices' | 'tickets' | 'timeline' | 'hierarchy' | 'network';

export const Customer360Hub: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedCompany, companies } = useCompanyContext();

  const urlCustomerId = searchParams.get('id') || '';
  const urlTab = searchParams.get('tab') as TabType | null;

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(urlCustomerId);
  const [data360, setData360] = useState<Customer360Data | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingCustomers, setLoadingCustomers] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabType>(urlTab || 'overview');

  // Contact Modal state
  const [contactModalOpen, setContactModalOpen] = useState<boolean>(false);

  // Entity Target Currency logic (INR for Indian Entity, EUR for Irish Entity)
  const isIndianEntity = selectedCompany?.country?.code === 'IN' ||
    selectedCompany?.country?.code === 'IND' ||
    selectedCompany?.country?.currency_code === 'INR';
  const isIrishEntity = selectedCompany?.country?.code === 'IE' ||
    selectedCompany?.country?.code === 'IRL' ||
    selectedCompany?.country?.currency_code === 'EUR';

  const targetCurrency = isIndianEntity ? 'INR' : isIrishEntity ? 'EUR' : (selectedCompany?.country?.currency_code || 'INR');

  // Load list of all active customers for selector
  useEffect(() => {
    loadCustomerList();
  }, [selectedCompany]);

  // Load 360 data when selected customer or target currency changes
  useEffect(() => {
    if (selectedCustomerId) {
      load360Data(selectedCustomerId, targetCurrency);
    } else {
      setLoading(false);
    }
  }, [selectedCustomerId, selectedCompany, targetCurrency]);

  // Sync state with URL parameter changes
  useEffect(() => {
    if (urlCustomerId && urlCustomerId !== selectedCustomerId) {
      setSelectedCustomerId(urlCustomerId);
    }
    // Also sync tab from URL
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlCustomerId, urlTab]);

  const loadCustomerList = async () => {
    try {
      setLoadingCustomers(true);
      const filters = {
        company_settings_id: selectedCompany?.id ?? undefined,
      };
      const res = await invoiceService.getCustomers(filters, 1, 1000);
      const activeList = res.data.filter(c => c.is_active);
      setAllCustomers(activeList);

      // If current selectedCustomerId is not in activeList or no URL customer ID, pick first available
      const isValidSelection = activeList.some(c => c.id === selectedCustomerId);
      if (!isValidSelection) {
        if (activeList.length > 0) {
          const firstId = activeList[0].id;
          setSelectedCustomerId(firstId);
          setSearchParams({ id: firstId });
        } else {
          setSelectedCustomerId('');
          setSearchParams({});
          setData360(null);
        }
      }
    } catch (err) {
      console.error('Failed to load customer list for 360 hub:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const load360Data = async (customerId: string, curr: string) => {
    try {
      setLoading(true);
      const res = await customer360Service.getCustomer360Data(customerId, curr);
      setData360(res);
    } catch (err) {
      console.error('Error fetching customer 360 hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    setSearchParams({ id });
  };

  const currentCustomer = data360?.customer;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Customer Selector Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Compass className="w-7 h-7 text-orange-600" />
            <h1 className="text-2xl font-bold text-gray-900">Customer 360° Hub</h1>
            <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-orange-200">
              Admin CRM View
            </span>
            <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-0.5 rounded-md border border-slate-300">
              Currency: {targetCurrency} ({isIndianEntity ? 'Indian Entity' : isIrishEntity ? 'Irish Entity' : 'Selected Entity'})
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Overarching picture connecting Leads, Opportunities, Quotes, Contracts, Subscriptions, Invoices & Contacts.
          </p>
        </div>

        {/* Customer Selector Dropdown */}
        <div className="w-full md:w-80 relative">
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Select Customer
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
            <select
              value={selectedCustomerId}
              onChange={(e) => handleSelectCustomer(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-sm"
              disabled={loadingCustomers}
            >
              {loadingCustomers ? (
                <option>Loading customers...</option>
              ) : allCustomers.length === 0 ? (
                <option value="">No customers found</option>
              ) : (
                allCustomers.map((c) => {
                  const displayId = getPrimaryCustomerId(c, companies);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.company_name || c.contact_person || 'Unnamed'} ({displayId})
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
          <RefreshCw className="w-10 h-10 text-orange-600 animate-spin mb-3" />
          <p className="text-gray-600 font-medium">Aggregating Customer 360° Data ({targetCurrency})...</p>
        </div>
      ) : !data360 || !currentCustomer ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-800">No Customer Selected</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-4">
            Please select a customer from the dropdown above or create a new customer in Customer Management to view their 360° hub.
          </p>
          <button
            onClick={() => navigate('/admin/customers')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition"
          >
            Go to Customer Management
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Customer Banner Summary Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl shadow-md p-6 text-white border border-slate-700">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-semibold px-3 py-1 rounded-md">
                    {getPrimaryCustomerId(currentCustomer, companies)}
                  </span>
                  {currentCustomer.company_settings_id && (
                    <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold px-3 py-1 rounded-md flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {companies.find(c => c.id === currentCustomer.company_settings_id)?.company_name || 'Assigned Entity'}
                    </span>
                  )}
                  {currentCustomer.country && (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-1 rounded-md flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {currentCustomer.country.name} ({currentCustomer.country.code})
                    </span>
                  )}
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${currentCustomer.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                    {currentCustomer.is_active ? 'Active Customer' : 'Inactive'}
                  </span>
                </div>

                <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
                  {currentCustomer.company_name || 'Individual Customer'}
                </h2>

                <div className="flex items-center gap-6 text-sm text-slate-300 flex-wrap pt-1">
                  {currentCustomer.contact_person && (
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-orange-400" />
                      <span>{currentCustomer.contact_person}</span>
                    </div>
                  )}
                  {currentCustomer.relationship_manager && (
                    <div className="flex items-center gap-1.5 bg-blue-500/20 text-blue-200 border border-blue-500/30 px-2.5 py-0.5 rounded-md text-xs">
                      <UserCheck className="w-4 h-4 text-blue-400" />
                      <span>RM: <strong className="text-white">{currentCustomer.relationship_manager}</strong></span>
                    </div>
                  )}
                  {currentCustomer.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-orange-400" />
                      <a href={`mailto:${currentCustomer.email}`} className="hover:underline text-slate-200">
                        {currentCustomer.email}
                      </a>
                    </div>
                  )}
                  {currentCustomer.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-orange-400" />
                      <span>{currentCustomer.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Toolbar Shortcuts */}
              <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
                <button
                  onClick={() => setContactModalOpen(true)}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 border border-white/10"
                >
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  Manage Contacts
                </button>
                <button
                  onClick={() => navigate(`/admin/quotes?action=create&customerId=${currentCustomer.id}`)}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 border border-white/10"
                >
                  <FilePlus className="w-4 h-4 text-blue-400" />
                  Create Quote
                </button>
                <button
                  onClick={() => navigate(`/admin/invoices?action=create&customerId=${currentCustomer.id}`)}
                  className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Create Invoice
                </button>
              </div>
            </div>
          </div>

          {/* Executive KPI Scorecards Grid (in Target Entity Currency: INR / EUR) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
                <span>Lifetime Revenue ({targetCurrency})</span>
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl font-bold text-gray-900">
                {formatCurrencyWithSymbol(data360.metrics.totalInvoiced, targetCurrency)}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {data360.metrics.totalInvoicesCount} invoices issued
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
                <span>Collected Revenue ({targetCurrency})</span>
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-700">
                {formatCurrencyWithSymbol(data360.metrics.totalCollected, targetCurrency)}
              </div>
              <div className="text-[11px] text-emerald-600 mt-1 font-medium">
                {data360.metrics.paidInvoicesCount} fully paid invoices
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
                <span>Outstanding Balance ({targetCurrency})</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-bold text-amber-700">
                {formatCurrencyWithSymbol(data360.metrics.outstandingBalance, targetCurrency)}
              </div>
              <div className="text-[11px] text-red-600 mt-1 font-semibold">
                {data360.metrics.overdueBalance > 0
                  ? `${formatCurrencyWithSymbol(data360.metrics.overdueBalance, targetCurrency)} overdue`
                  : 'Zero overdue'}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
                <span>Subscription MRR ({targetCurrency})</span>
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl font-bold text-purple-700">
                {formatCurrencyWithSymbol(data360.metrics.activeSubscriptionMRR, targetCurrency)}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {data360.subscriptions.filter(s => s.status === 'active').length} active subscriptions
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
                <span>Open Pipeline ({targetCurrency})</span>
                <Briefcase className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl font-bold text-indigo-700">
                {formatCurrencyWithSymbol(data360.metrics.openPipelineValue, targetCurrency)}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {data360.opportunities.filter(o => o.stage !== 'closed_won' && o.stage !== 'closed_lost').length} open opps
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
                <span>Win Rate</span>
                <Award className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-xl font-bold text-teal-700">
                {data360.metrics.winRatePercentage}%
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {data360.metrics.contractsCount} active contracts
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50 px-4 pt-3 flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: Building2 },
                { id: 'contacts', label: `Contacts (${data360.contacts.length})`, icon: Users },
                { id: 'leads', label: `Leads (${data360.leads.length})`, icon: UserPlus },
                { id: 'opportunities', label: `Opportunities (${data360.opportunities.length})`, icon: Briefcase },
                { id: 'quotes', label: `Quotes (${data360.quotes.length})`, icon: FileText },
                { id: 'contracts', label: `Contracts (${data360.contracts.length})`, icon: ShieldCheck },
                { id: 'subscriptions', label: `Subscriptions (${data360.subscriptions.length})`, icon: CreditCard },
                { id: 'invoices', label: `Invoices & Payments (${data360.invoices.length})`, icon: DollarSign },
                { id: 'tickets', label: `Support Tickets (${data360.itsmTickets?.length || 0})`, icon: LifeBuoy },
                { id: 'timeline', label: `Activity Timeline (${data360.timeline.length})`, icon: Clock },
                { id: 'hierarchy', label: `Hierarchy (${data360.relationships.length})`, icon: GitBranch },
                { id: 'network', label: 'Contact Network', icon: Network },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                      isActive
                        ? 'border-orange-600 text-orange-600 bg-white shadow-xs'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-orange-600' : 'text-gray-400'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content Area */}
            <div className="p-6">
              {/* 1. OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Customer Profile & Address Card */}
                  <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 shadow-xs">
                    <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-orange-600" />
                      Company & Tax Details
                    </h3>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="text-gray-500">Legal Company Name:</span>
                        <div className="font-semibold text-gray-800 text-sm">{currentCustomer.company_name || 'N/A'}</div>
                      </div>

                      {currentCustomer.relationship_manager && (
                        <div className="pt-1 border-t border-gray-100">
                          <span className="text-gray-500">Relationship Manager:</span>
                          <div className="font-semibold text-blue-700 flex items-center gap-1 mt-0.5">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                            {currentCustomer.relationship_manager}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                        <div>
                          <span className="text-gray-500">{getTaxRegistrationLabel(currentCustomer)}:</span>
                          <div className="font-semibold text-gray-800">{currentCustomer.gstin || 'Not Provided'}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">PAN / Tax Ref:</span>
                          <div className="font-semibold text-gray-800">{currentCustomer.pan || 'Not Provided'}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                        <div>
                          <span className="text-gray-500">Credit Limit ({targetCurrency}):</span>
                          <div className="font-semibold text-gray-800">
                            {formatCurrencyWithSymbol(convertCurrency(currentCustomer.credit_limit || 0, 'INR', targetCurrency), targetCurrency)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Payment Terms:</span>
                          <div className="font-semibold text-gray-800">{currentCustomer.payment_terms || 30} Days</div>
                        </div>
                      </div>

                      <div className="pt-1 border-t border-gray-100">
                        <span className="text-gray-500 flex items-center gap-1 mb-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          Billing Address:
                        </span>
                        <div className="text-gray-700 bg-gray-50 p-2.5 rounded border border-gray-200">
                          {currentCustomer.address_line1 && <div>{currentCustomer.address_line1}</div>}
                          {currentCustomer.address_line2 && <div>{currentCustomer.address_line2}</div>}
                          <div>
                            {[currentCustomer.city, currentCustomer.state, currentCustomer.postal_code]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                          {currentCustomer.country && <div className="font-medium text-gray-900 mt-0.5">{currentCustomer.country.name}</div>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Primary Contact Card */}
                  <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-600" />
                        Primary Contact Person
                      </h3>
                      <button
                        onClick={() => setContactModalOpen(true)}
                        className="text-xs text-orange-600 font-semibold hover:underline"
                      >
                        Edit Contacts
                      </button>
                    </div>

                    {data360.primaryContact ? (
                      <div className="space-y-3 text-xs">
                        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-start gap-3">
                          <div className="w-9 h-9 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {data360.primaryContact.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{data360.primaryContact.name}</div>
                            <div className="text-emerald-700 font-medium">{data360.primaryContact.job_title || 'Primary Contact'}</div>
                          </div>
                        </div>

                        <div className="space-y-2 pt-1">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <a href={`mailto:${data360.primaryContact.email}`} className="hover:underline text-blue-600">
                              {data360.primaryContact.email || 'No email specified'}
                            </a>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{data360.primaryContact.phone || 'No phone specified'}</span>
                          </div>
                          {data360.primaryContact.notes && (
                            <div className="text-gray-500 italic bg-gray-50 p-2.5 rounded border border-gray-200 mt-2">
                              "{data360.primaryContact.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-500 text-xs">
                        No primary contact specified yet.
                        <button
                          onClick={() => setContactModalOpen(true)}
                          className="block mx-auto mt-2 text-orange-600 font-semibold hover:underline"
                        >
                          + Add Contact
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Activity Timeline Preview */}
                  <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-600" />
                        Recent Activity Log
                      </h3>
                      <button
                        onClick={() => setActiveTab('timeline')}
                        className="text-xs text-orange-600 font-semibold hover:underline"
                      >
                        View All ({data360.timeline.length})
                      </button>
                    </div>

                    {data360.timeline.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs">No recent activities recorded.</div>
                    ) : (
                      <div className="space-y-3">
                        {data360.timeline.slice(0, 5).map((item) => (
                          <div key={item.id} className="flex items-start gap-2.5 text-xs">
                            <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                            <div className="space-y-0.5">
                              <div className="font-semibold text-gray-800">{item.title}</div>
                              {item.description && <div className="text-gray-500 text-[11px]">{item.description}</div>}
                              <div className="text-[10px] text-gray-400">
                                {new Date(item.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. CONTACTS TAB */}
              {activeTab === 'contacts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">Associated Customer Contacts</h3>
                    <button
                      onClick={() => setContactModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition"
                    >
                      <Plus className="w-4 h-4" /> Add / Manage Contacts
                    </button>
                  </div>

                  {data360.contacts.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs">
                      No customer contacts linked yet. Click "Add / Manage Contacts" above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {data360.contacts.map((contact) => (
                        <div key={contact.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                                {contact.name}
                                {contact.is_primary && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                    Primary
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">{contact.job_title || 'No Title'}</div>
                            </div>
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                              {contact.role}
                            </span>
                          </div>

                          <div className="space-y-1 text-xs text-gray-600 pt-2 border-t border-gray-100">
                            {contact.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-gray-400" />
                                <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                                  {contact.email}
                                </a>
                              </div>
                            )}
                            {contact.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. LEADS TAB */}
              {activeTab === 'leads' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">Leads Pipeline ({data360.leads.length})</h3>
                    <button
                      onClick={() => navigate(`/admin/leads?action=create&customerId=${currentCustomer.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition"
                    >
                      <Plus className="w-4 h-4" /> Create New Lead
                    </button>
                  </div>

                  {data360.leads.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs">
                      No leads recorded for this customer yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3">Lead #</th>
                            <th className="px-4 py-3">Name / Company</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">Est. Value ({targetCurrency})</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {data360.leads.map((lead) => {
                            const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.company_name || 'Lead';
                            const origVal = lead.budget_max || lead.budget_min || 0;
                            const convertedVal = convertCurrency(origVal, lead.currency_code || 'INR', targetCurrency);
                            return (
                              <tr key={lead.id} className="hover:bg-gray-50 transition">
                                <td className="px-4 py-3 font-semibold text-gray-900">{lead.lead_number}</td>
                                <td className="px-4 py-3 text-gray-800 font-medium">{leadName}</td>
                                <td className="px-4 py-3 text-gray-600 capitalize">{lead.source || 'N/A'}</td>
                                <td className="px-4 py-3 font-semibold text-gray-900">
                                  {formatCurrencyWithSymbol(convertedVal, targetCurrency)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    lead.status === 'converted' ? 'bg-emerald-100 text-emerald-800' :
                                    lead.status === 'qualified' ? 'bg-blue-100 text-blue-800' :
                                    lead.status === 'disqualified' ? 'bg-red-100 text-red-800' :
                                    'bg-amber-100 text-amber-800'
                                  }`}>
                                    {lead.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 4. OPPORTUNITIES TAB */}
              {activeTab === 'opportunities' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">Sales Opportunities ({data360.opportunities.length})</h3>
                    <button
                      onClick={() => navigate(`/admin/opportunities?action=create&customerId=${currentCustomer.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition"
                    >
                      <Plus className="w-4 h-4" /> Create Opportunity
                    </button>
                  </div>

                  {data360.opportunities.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs">
                      No sales opportunities logged for this customer.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3">Opp #</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Stage</th>
                            <th className="px-4 py-3">Value ({targetCurrency})</th>
                            <th className="px-4 py-3">Probability</th>
                            <th className="px-4 py-3">Exp. Close</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {data360.opportunities.map((opp) => {
                            const valInTarget = convertCurrency(opp.estimated_value || 0, opp.currency_code || 'INR', targetCurrency);
                            return (
                              <tr key={opp.id} className="hover:bg-gray-50 transition">
                                <td className="px-4 py-3 font-semibold text-gray-900">{opp.opportunity_number}</td>
                                <td className="px-4 py-3 text-gray-800 font-medium">{opp.opportunity_name}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    opp.stage === 'closed_won' ? 'bg-emerald-100 text-emerald-800' :
                                    opp.stage === 'closed_lost' ? 'bg-red-100 text-red-800' :
                                    'bg-purple-100 text-purple-800'
                                  }`}>
                                    {opp.stage.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900">
                                  {formatCurrencyWithSymbol(valInTarget, targetCurrency)}
                                </td>
                                <td className="px-4 py-3 text-gray-600">{opp.probability || 50}%</td>
                                <td className="px-4 py-3 text-gray-500">
                                  {opp.expected_close_date ? new Date(opp.expected_close_date).toLocaleDateString() : 'N/A'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 5. QUOTES TAB */}
              {activeTab === 'quotes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">Issued Quotes ({data360.quotes.length})</h3>
                    <button
                      onClick={() => navigate(`/admin/quotes?action=create&customerId=${currentCustomer.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition"
                    >
                      <Plus className="w-4 h-4" /> Create Quote
                    </button>
                  </div>

                  {data360.quotes.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs">
                      No quotes issued for this customer.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3">Quote #</th>
                            <th className="px-4 py-3">Valid Until</th>
                            <th className="px-4 py-3">Subtotal ({targetCurrency})</th>
                            <th className="px-4 py-3">Tax ({targetCurrency})</th>
                            <th className="px-4 py-3">Total Amount ({targetCurrency})</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {data360.quotes.map((q) => {
                            const subtotalInTarget = convertCurrency(q.subtotal || 0, q.currency_code || 'INR', targetCurrency);
                            const taxInTarget = convertCurrency(q.tax_amount || 0, q.currency_code || 'INR', targetCurrency);
                            const totalInTarget = convertCurrency(q.total_amount || 0, q.currency_code || 'INR', targetCurrency);

                            return (
                              <tr key={q.id} className="hover:bg-gray-50 transition">
                                <td className="px-4 py-3 font-semibold text-gray-900">{q.quote_number}</td>
                                <td className="px-4 py-3 text-gray-600">
                                  {q.valid_until ? new Date(q.valid_until).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {formatCurrencyWithSymbol(subtotalInTarget, targetCurrency)}
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {formatCurrencyWithSymbol(taxInTarget, targetCurrency)}
                                </td>
                                <td className="px-4 py-3 font-bold text-gray-900">
                                  {formatCurrencyWithSymbol(totalInTarget, targetCurrency)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    q.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                                    q.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    q.status === 'converted' ? 'bg-blue-100 text-blue-800' :
                                    'bg-amber-100 text-amber-800'
                                  }`}>
                                    {q.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 6. CONTRACTS TAB */}
              {activeTab === 'contracts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">Legal Contracts ({data360.contracts.length})</h3>
                    <button
                      onClick={() => navigate(`/admin/contracts?action=create&customerId=${currentCustomer.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition"
                    >
                      <Plus className="w-4 h-4" /> Create Contract
                    </button>
                  </div>

                  {data360.contracts.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs">
                      No contracts associated with this customer.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3">Contract #</th>
                            <th className="px-4 py-3">Title</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Effective - Expiry</th>
                            <th className="px-4 py-3">Contract Value ({targetCurrency})</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {data360.contracts.map((c) => {
                            const valInTarget = convertCurrency(c.contract_value || 0, c.currency_code || 'INR', targetCurrency);
                            return (
                              <tr key={c.id} className="hover:bg-gray-50 transition">
                                <td className="px-4 py-3 font-semibold text-gray-900">{c.contract_number}</td>
                                <td className="px-4 py-3 text-gray-800 font-medium">{c.contract_title}</td>
                                <td className="px-4 py-3"><span className="bg-gray-100 font-semibold text-gray-700 px-2 py-0.5 rounded text-[10px]">{c.contract_type}</span></td>
                                <td className="px-4 py-3 text-gray-600">
                                  {c.effective_date ? new Date(c.effective_date).toLocaleDateString() : 'N/A'} - {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'Ongoing'}
                                </td>
                                <td className="px-4 py-3 font-bold text-gray-900">
                                  {formatCurrencyWithSymbol(valInTarget, targetCurrency)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    c.status === 'active' || c.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                                    c.status === 'expired' || c.status === 'terminated' ? 'bg-red-100 text-red-800' :
                                    'bg-amber-100 text-amber-800'
                                  }`}>
                                    {c.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 7. SUBSCRIPTIONS TAB */}
              {activeTab === 'subscriptions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">Recurring Subscriptions ({data360.subscriptions.length})</h3>
                    <button
                      onClick={() => navigate(`/admin/subscriptions?action=create&customerId=${currentCustomer.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition"
                    >
                      <Plus className="w-4 h-4" /> Add Subscription
                    </button>
                  </div>

                  {data360.subscriptions.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs">
                      No active or historical subscriptions for this customer.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3">Sub ID</th>
                            <th className="px-4 py-3">Plan Name</th>
                            <th className="px-4 py-3">Billing Interval</th>
                            <th className="px-4 py-3">Price ({targetCurrency})</th>
                            <th className="px-4 py-3">Start Date</th>
                            <th className="px-4 py-3">Next Billing Date</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {data360.subscriptions.map((s) => {
                            const priceInTarget = convertCurrency(s.plan?.price || 0, s.plan?.currency_code || 'INR', targetCurrency);
                            const subNum = s.subscription_number || s.id.slice(0, 8);
                            return (
                              <tr key={s.id} className="hover:bg-gray-50 transition">
                                <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{subNum}</td>
                                <td className="px-4 py-3 font-semibold text-gray-900">{s.plan?.name || 'Subscription Plan'}</td>
                                <td className="px-4 py-3 text-gray-600 capitalize">{s.plan?.billing_interval || 'monthly'}</td>
                                <td className="px-4 py-3 font-bold text-gray-900">
                                  {formatCurrencyWithSymbol(priceInTarget, targetCurrency)}
                                </td>
                                <td className="px-4 py-3 text-gray-600">{new Date(s.start_date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 font-medium text-gray-800">
                                  {s.next_billing_date ? new Date(s.next_billing_date).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    s.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                                    s.status === 'draft' ? 'bg-slate-100 text-slate-800 border border-slate-200' :
                                    s.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                    'bg-amber-100 text-amber-800'
                                  }`}>
                                    {s.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 8. INVOICES & PAYMENTS TAB */}
              {activeTab === 'invoices' && (
                <div className="space-y-6">
                  {/* Invoices Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-900">Invoices ({data360.invoices.length})</h3>
                      <button
                        onClick={() => navigate(`/admin/invoices?action=create&customerId=${currentCustomer.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition"
                      >
                        <Plus className="w-4 h-4" /> Create Invoice
                      </button>
                    </div>

                    {data360.invoices.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs">
                        No invoices generated for this customer yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3">Invoice #</th>
                              <th className="px-4 py-3">Issue Date</th>
                              <th className="px-4 py-3">Due Date</th>
                              <th className="px-4 py-3">Total Amount ({targetCurrency})</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {data360.invoices.map((inv) => {
                              const totalInTarget = targetCurrency === 'INR' && inv.inr_total_amount
                                ? Number(inv.inr_total_amount)
                                : convertCurrency(inv.total_amount || 0, inv.currency_code || 'INR', targetCurrency);
                              return (
                                <tr key={inv.id} className="hover:bg-gray-50 transition">
                                  <td className="px-4 py-3 font-semibold text-gray-900">{inv.invoice_number}</td>
                                  <td className="px-4 py-3 text-gray-600">{new Date(inv.created_at).toLocaleDateString()}</td>
                                  <td className="px-4 py-3 text-gray-600">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</td>
                                  <td className="px-4 py-3 font-semibold text-gray-900">
                                    {formatCurrencyWithSymbol(totalInTarget, targetCurrency)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                                      inv.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                      inv.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                                      'bg-amber-100 text-amber-800'
                                    }`}>
                                      {inv.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Payment History Section */}
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-bold text-gray-900">Received Payments ({data360.payments.length})</h3>

                    {data360.payments.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs">
                        No payment transactions recorded for customer invoices.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3">Payment Date</th>
                              <th className="px-4 py-3">Method</th>
                              <th className="px-4 py-3">Transaction Ref</th>
                              <th className="px-4 py-3">Amount ({targetCurrency})</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {data360.payments.map((pay) => {
                              const amtInTarget = targetCurrency === 'INR' && pay.inr_amount
                                ? Number(pay.inr_amount)
                                : convertCurrency(pay.amount || 0, pay.original_currency_code || 'INR', targetCurrency);
                              return (
                                <tr key={pay.id} className="hover:bg-gray-50 transition">
                                  <td className="px-4 py-3 font-medium text-gray-800">
                                    {pay.payment_date ? new Date(pay.payment_date).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 uppercase font-semibold text-[10px]">
                                    {pay.payment_method || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700 font-mono text-[11px]">
                                    {pay.reference_number || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 font-bold text-emerald-700">
                                    {formatCurrencyWithSymbol(amtInTarget, targetCurrency)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 9. SUPPORT TICKETS TAB */}
              {activeTab === 'tickets' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">ITSM Support Tickets ({data360.itsmTickets?.length || 0})</h3>
                    <button
                      onClick={() => navigate('/admin/itsm/tickets')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition"
                    >
                      <LifeBuoy className="w-4 h-4" /> Open Triage Desk
                    </button>
                  </div>

                  {!data360.itsmTickets || data360.itsmTickets.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs">
                      No support tickets logged for this customer.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3">Ticket #</th>
                            <th className="px-4 py-3">Subject</th>
                            <th className="px-4 py-3">Priority</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Created Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {data360.itsmTickets.map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50 transition">
                              <td className="px-4 py-3 font-mono font-bold text-indigo-700">{t.ticket_number}</td>
                              <td className="px-4 py-3 font-semibold text-gray-900">{t.title}</td>
                              <td className="px-4 py-3 uppercase font-bold text-[10px] text-gray-700">{t.priority}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800">
                                  {t.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{new Date(t.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 9. TIMELINE TAB */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900">Unified Chronological Touchpoints ({data360.timeline.length})</h3>

                  {data360.timeline.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs">
                      No activity touchpoints recorded.
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-orange-200 ml-4 space-y-6 py-2">
                      {data360.timeline.map((item) => (
                        <div key={item.id} className="relative pl-6">
                          {/* Dot indicator */}
                          <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-orange-600" />

                          <div className="bg-white rounded-lg border border-gray-200 p-3.5 shadow-xs space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-gray-900 text-xs">{item.title}</span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {new Date(item.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-600">{item.description}</p>
                            )}
                            <div className="pt-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-700 rounded uppercase">
                                {item.badgeText || item.sourceType}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 10. HIERARCHY TAB */}
              {activeTab === 'hierarchy' && (
                <CustomerHierarchyPanel
                  customerId={currentCustomer.id}
                  customerName={currentCustomer.company_name || 'Customer'}
                  initialRelationships={data360.relationships}
                />
              )}

              {/* 11. CONTACT NETWORK TAB */}
              {activeTab === 'network' && (
                <ContactNetworkPanel
                  customerId={currentCustomer.id}
                  customerName={currentCustomer.company_name || 'Customer'}
                  contacts={data360.contacts}
                  initialContactLinks={data360.contactLinks}
                />
              )}
            </div>
          </div>

          {/* Customer Contact Modal Trigger */}
          <CustomerContactModal
            isOpen={contactModalOpen}
            onClose={() => setContactModalOpen(false)}
            customer={currentCustomer}
            onContactsUpdated={() => load360Data(currentCustomer.id, targetCurrency)}
          />
        </>
      )}
    </div>
  );
};
