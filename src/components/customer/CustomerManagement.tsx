import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Edit, Trash2, X, Users, RefreshCw, Globe, Building2, UserCheck, Contact, Compass, GitBranch, KeyRound } from 'lucide-react';
import { invoiceService } from '../../services/invoiceService';
import { CustomerAuthService } from '../../services/customerAuthService';
import { useToast } from '../ui/ToastProvider';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useActionProgress } from '../../contexts/ActionProgressContext';
import { useCompanyContext } from '../../contexts/CompanyContext';
import { getTaxRegistrationLabel, getTaxLabel } from '../../utils/taxUtils';
import { getCustomerDisplayIds } from '../../utils/customerCodeUtils';
import { CustomerContactModal } from './CustomerContactModal';
import type { Customer, Country, CreateCustomerData } from '../../types/invoice';

// Sentinel meaning the customer is shared across all entities (company_settings_id = null)
const SHARED_VALUE = '__shared__';

const CustomerManagement: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCompany, companies } = useCompanyContext();
  const { showSuccess, showError } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const { startAction, endAction } = useActionProgress();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'add'>('view');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Contacts Modal state
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalCustomer, setContactModalCustomer] = useState<Customer | null>(null);

  const openContactModal = (customer: Customer) => {
    setContactModalCustomer(customer);
    setContactModalOpen(true);
  };

  const closeContactModal = () => {
    setContactModalOpen(false);
    setContactModalCustomer(null);
    loadCustomers();
  };
  const [formData, setFormData] = useState<CreateCustomerData>({
    company_name: '',
    contact_person: '',
    relationship_manager: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country_id: 'IN',
    gstin: '',
    pan: '',
    credit_limit: 0,
    payment_terms: 30,
  });

  const entityId = selectedCompany?.id ?? null;

  // Entity selector helpers
  const entitySelectValue = (formData.company_settings_id ?? SHARED_VALUE) as string;
  const handleEntityChange = (val: string) => {
    setFormData(prev => ({ ...prev, company_settings_id: val === SHARED_VALUE ? undefined : val }));
  };
  const entityLabel = (c: Customer) => {
    if (!c.company_settings_id) return null;
    return companies.find(co => co.id === c.company_settings_id)?.company_name ?? 'Unknown Entity';
  };

  useEffect(() => {
    loadCountries();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCompany, searchTerm]);

  useEffect(() => {
    loadCustomers();
  }, [currentPage, selectedCompany, searchTerm]);

  const loadCountries = async () => {
    try {
      const data = await invoiceService.getCountries();
      setCountries(data);
    } catch {
      // non-blocking
    }
  };

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const filters = {
        search: searchTerm || undefined,
        company_settings_id: entityId ?? undefined,
      };
      const result = await invoiceService.getCustomers(filters, currentPage, 20);
      setCustomers(result.data || []);
      setTotalPages(result.total_pages || 1);
    } catch (err) {
      showError(`Failed to load customers: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (mode: 'view' | 'edit' | 'add', customer?: Customer) => {
    setModalMode(mode);
    setSelectedCustomer(customer ?? null);
    if (mode === 'add') {
      setFormData({
        company_name: '',
        contact_person: '',
        relationship_manager: '',
        email: '',
        phone: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        country_id: selectedCompany?.country_id ?? 'IN',
        company_settings_id: entityId ?? undefined,
        gstin: '',
        pan: '',
        credit_limit: 0,
        payment_terms: 30,
      });
    } else if (customer) {
      setFormData({
        company_name: customer.company_name ?? '',
        contact_person: customer.contact_person ?? '',
        relationship_manager: customer.relationship_manager ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        address_line1: customer.address_line1 ?? '',
        address_line2: customer.address_line2 ?? '',
        city: customer.city ?? '',
        state: customer.state ?? '',
        postal_code: customer.postal_code ?? '',
        country_id: customer.country_id ?? 'IN',
        company_settings_id: customer.company_settings_id ?? entityId ?? undefined,
        gstin: customer.gstin ?? '',
        pan: customer.pan ?? '',
        credit_limit: Number(customer.credit_limit) || 0,
        payment_terms: Number(customer.payment_terms) || 30,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCustomer(null);
    setModalLoading(false);
  };

  const handleChange = (field: keyof CreateCustomerData, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    if (!formData.company_name?.trim() && !formData.contact_person?.trim()) {
      errors.push('Either Company Name or Contact Person is required');
    }
    if (formData.email?.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.push('Please enter a valid email address');
      }
    }
    if (formData.phone?.trim()) {
      if (!/^[+]?[1-9][\d]{3,14}$/.test(formData.phone.replace(/[\s\-()]/g, ''))) {
        errors.push('Please enter a valid phone number');
      }
    }
    if (formData.pan?.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan)) {
      errors.push('Please enter a valid PAN (e.g., ABCDE1234F)');
    }
    return errors;
  };

  const handleSave = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      showError(`Please fix: ${errors.join(', ')}`);
      return;
    }
    try {
      setModalLoading(true);
      if (modalMode === 'add') {
        const result = await invoiceService.createCustomer(formData);
        setCustomers(prev => [result, ...prev]);
        showSuccess('Customer created successfully!');
      } else if (modalMode === 'edit' && selectedCustomer) {
        const result = await invoiceService.updateCustomer(selectedCustomer.id, formData);
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? result : c));
        showSuccess('Customer updated successfully!');
      }
      closeModal();
    } catch (err) {
      showError(`Failed to save customer: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = await confirm({
      title: 'Delete Customer',
      message: `Delete "${customer.company_name || customer.contact_person}"? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
    });
    if (!confirmed) return;
    startAction('Deleting customer…');
    try {
      await invoiceService.deleteCustomer(customer.id);
      showSuccess('Customer deleted successfully!');
      await loadCustomers();
    } catch (err) {
      showError(`Failed to delete customer: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      endAction();
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadCustomers();
  };

  const handleSendCredentials = async (customer: Customer) => {
    try {
      const tempPass = `Pass-${Math.floor(1000 + Math.random() * 9000)}`;
      const res = await CustomerAuthService.setCustomerInitialPassword(customer.id, tempPass);
      if (res.success) {
        showSuccess(res.message);
      } else {
        showError(res.message);
      }
    } catch (err) {
      showError(`Failed to send credentials: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Dynamic tax registration label based on form country
  const selectedCountryForForm = countries.find(c => c.id === formData.country_id);
  const customerWithCountry = { country: selectedCountryForForm } as Customer;
  const taxRegLabel = getTaxRegistrationLabel(customerWithCountry);
  const isGST = getTaxLabel(customerWithCountry) === 'IGST';

  return (
    <div className="space-y-6">
      <ConfirmDialog {...dialogProps} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
          {selectedCompany && (
            <p className="text-sm text-gray-500 mt-1">
            {selectedCompany
              ? <>Showing customers for <span className="font-medium text-blue-600">{selectedCompany.company_name}</span> + shared customers</>
              : 'Showing all customers across entities'}
          </p>
          )}
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <button
            onClick={loadCustomers}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => openModal('add')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <form onSubmit={handleSearch} className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search customers by name, email, or company..."
          />
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Customers Found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'No customers match your search.' : 'No customers yet. Add your first customer to get started.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => openModal('add')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map(customer => {
                    const entity = entityLabel(customer);
                    const displayIds = getCustomerDisplayIds(customer, companies);
                    return (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {displayIds.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {displayIds.map(id => (
                              <span key={id} className="inline-block font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-2 py-0.5">
                                {id}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{customer.company_name || customer.contact_person}</div>
                        {customer.company_name && customer.contact_person && (
                          <div className="text-sm text-gray-500">{customer.contact_person}</div>
                        )}
                        {customer.relationship_manager && (
                          <div className="text-xs text-blue-600 font-medium mt-0.5 flex items-center gap-1">
                            <span>RM:</span> {customer.relationship_manager}
                          </div>
                        )}
                        {customer.country && (
                          <div className="text-xs text-gray-400">{customer.country.name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{customer.email || '—'}</div>
                        <div className="text-sm text-gray-500">{customer.phone || '—'}</div>
                        <button
                          onClick={() => openContactModal(customer)}
                          className="mt-1 inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>
                            {customer.contacts && customer.contacts.length > 0
                              ? `${customer.contacts.filter(c => c.is_active).length} contact${customer.contacts.filter(c => c.is_active).length !== 1 ? 's' : ''}`
                              : 'Manage Contacts'}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{[customer.city, customer.state].filter(Boolean).join(', ')}</div>
                        <div className="text-sm text-gray-500">{customer.postal_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{customer.gstin || '—'}</div>
                        {customer.pan && <div className="text-xs text-gray-500">PAN: {customer.pan}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entity ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            <Building2 className="w-3 h-3" />{entity}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            <Globe className="w-3 h-3" />All Entities
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          customer.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => navigate(`/admin/customer-360?id=${customer.id}`)}
                            className="text-orange-600 hover:text-orange-900 flex items-center gap-1 font-semibold text-xs bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded border border-orange-200 shadow-2xs transition"
                            title="Open Customer 360° Hub"
                          >
                            <Compass className="w-3.5 h-3.5 text-orange-600" />
                            360° Hub
                          </button>
                          <button
                            onClick={() => navigate(`/admin/customer-360?id=${customer.id}&tab=hierarchy`)}
                            className="text-violet-600 hover:text-violet-900 flex items-center gap-1 font-semibold text-xs bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded border border-violet-200 shadow-2xs transition"
                            title="Manage B2B Hierarchy"
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            Hierarchy
                          </button>
                          <button
                            onClick={() => handleSendCredentials(customer)}
                            className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 font-semibold text-xs bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded border border-indigo-200 shadow-2xs transition"
                            title="Send Onboarding Passcode & Welcome Email via Resend"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Passcode
                          </button>
                          <button onClick={() => openContactModal(customer)} className="text-purple-600 hover:text-purple-900" title="Manage Contacts">
                            <UserCheck className="w-4 h-4" />
                          </button>
                          <button onClick={() => openModal('view', customer)} className="text-blue-600 hover:text-blue-900" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openModal('edit', customer)} className="text-gray-600 hover:text-gray-900" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(customer)} className="text-red-600 hover:text-red-900" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">Page {currentPage} of {totalPages}</div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {modalMode === 'view' ? 'Customer Details' : modalMode === 'edit' ? 'Edit Customer' : 'Add Customer'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">

              {/* Customer ID — displayed prominently for existing records */}
              {selectedCustomer?.customer_code && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Customer ID</p>
                  <div className="flex flex-wrap gap-2">
                    {getCustomerDisplayIds(selectedCustomer, companies).map(id => (
                      <span key={id} className="font-mono text-base font-bold text-indigo-800 bg-white border border-indigo-300 rounded-md px-3 py-1 select-all">
                        {id}
                      </span>
                    ))}
                  </div>
                  {!selectedCustomer.company_settings_id && companies.length > 1 && (
                    <p className="text-xs text-indigo-500 mt-1">This shared customer has an ID for each entity.</p>
                  )}
                </div>
              )}

              {/* Contact Persons Banner */}
              {selectedCustomer && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-purple-600" />
                      Contact Persons ({selectedCustomer.contacts?.filter(c => c.is_active).length || 0})
                    </h4>
                    <p className="text-xs text-purple-700 mt-0.5">
                      {selectedCustomer.contacts && selectedCustomer.contacts.length > 0
                        ? `Primary Contact: ${selectedCustomer.contacts.find(c => c.is_primary)?.name || selectedCustomer.contact_person || 'Not set'}`
                        : 'No custom contact profiles added yet.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      closeModal();
                      openContactModal(selectedCustomer);
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-md shadow transition"
                  >
                    Manage Contacts
                  </button>
                </div>
              )}
              {modalMode === 'add' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                  <p className="text-xs text-gray-500">
                    A unique Customer ID (e.g., <span className="font-mono font-semibold">IND-{new Date().getFullYear()}-0001</span>) will be auto-assigned on save.
                  </p>
                </div>
              )}

              {/* Entity Association — explicit selector at top of form */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <label className="block text-sm font-semibold text-blue-900 mb-1">Entity Association</label>
                <select
                  value={entitySelectValue}
                  onChange={e => handleEntityChange(e.target.value)}
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-blue-300 rounded-md bg-white focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 text-sm"
                >
                  <option value={SHARED_VALUE}>🌐 All Entities (Shared — visible across all entities)</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>🏢 {c.company_name}</option>
                  ))}
                </select>
                <p className="text-xs text-blue-700 mt-1">
                  {entitySelectValue === SHARED_VALUE
                    ? 'This customer will appear in all entity views and can be used for any entity\'s invoices, quotes, and contracts.'
                    : `This customer will only appear when "${companies.find(c => c.id === entitySelectValue)?.company_name}" entity is active.`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input type="text" value={formData.company_name} onChange={e => handleChange('company_name', e.target.value)}
                    disabled={modalMode === 'view'} placeholder="Enter company name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input type="text" value={formData.contact_person} onChange={e => handleChange('contact_person', e.target.value)}
                    disabled={modalMode === 'view'} placeholder="Enter contact person name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relationship Manager</label>
                  <input type="text" value={formData.relationship_manager || ''} onChange={e => handleChange('relationship_manager', e.target.value)}
                    disabled={modalMode === 'view'} placeholder="e.g., John Doe (Key Account Manager)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)}
                    disabled={modalMode === 'view'} placeholder="Enter email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={formData.phone} onChange={e => handleChange('phone', e.target.value)}
                    disabled={modalMode === 'view'} placeholder="Enter phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                <input type="text" value={formData.address_line1} onChange={e => handleChange('address_line1', e.target.value)}
                  disabled={modalMode === 'view'} placeholder="Enter street address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input type="text" value={formData.address_line2} onChange={e => handleChange('address_line2', e.target.value)}
                  disabled={modalMode === 'view'} placeholder="Apartment, suite, etc. (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input type="text" value={formData.city} onChange={e => handleChange('city', e.target.value)}
                    disabled={modalMode === 'view'} placeholder="Enter city"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input type="text" value={formData.state} onChange={e => handleChange('state', e.target.value)}
                    disabled={modalMode === 'view'} placeholder="Enter state/province"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <input type="text" value={formData.postal_code} onChange={e => handleChange('postal_code', e.target.value)}
                    disabled={modalMode === 'view'} placeholder="Enter postal code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <select value={formData.country_id} onChange={e => handleChange('country_id', e.target.value)}
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50">
                  <option value="">Select Country</option>
                  {countries.map(country => (
                    <option key={country.id} value={country.id}>{country.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{taxRegLabel}</label>
                  <input type="text" value={formData.gstin}
                    onChange={e => handleChange('gstin', e.target.value.toUpperCase())}
                    disabled={modalMode === 'view'}
                    placeholder={isGST ? 'e.g., 22AAAAA0000A1Z5' : 'e.g., VAT123456789'}
                    maxLength={isGST ? 15 : 20}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
                  <input type="text" value={formData.pan}
                    onChange={e => handleChange('pan', e.target.value.toUpperCase())}
                    disabled={modalMode === 'view'} placeholder="e.g., ABCDE1234F" maxLength={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
                  <input type="number" min="0" step="0.01" value={formData.credit_limit}
                    onChange={e => handleChange('credit_limit', parseFloat(e.target.value) || 0)}
                    disabled={modalMode === 'view'} placeholder="Enter credit limit"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms (Days)</label>
                  <input type="number" min="0" max="365" value={formData.payment_terms}
                    onChange={e => handleChange('payment_terms', parseInt(e.target.value) || 30)}
                    disabled={modalMode === 'view'} placeholder="e.g., 30"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
                </div>
              </div>
            </div>

            {modalMode !== 'view' && (
              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={closeModal}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-md text-sm font-medium hover:from-red-600 hover:to-red-700">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={modalLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  {modalLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : 'Save Customer'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contacts Management Modal */}
      <CustomerContactModal
        isOpen={contactModalOpen}
        onClose={closeContactModal}
        customer={contactModalCustomer}
        onContactsUpdated={loadCustomers}
      />
    </div>
  );
};

export default CustomerManagement;
