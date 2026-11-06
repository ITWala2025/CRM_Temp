import React, { useState, useEffect } from 'react';
import {
  Plus,
  Eye,
  Edit,
  FileText,
  RefreshCw,
  Trash2,
  X,
  Save,
  CreditCard,
  Settings
} from 'lucide-react';
import { invoiceService } from '../../services/invoiceService';
import { useToast } from '../ui/ToastProvider';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useActionProgress } from '../../contexts/ActionProgressContext';
import PDFBrandingManager from '../admin/PDFBrandingManager';
import { getTaxRegistrationLabel, getTaxRegistrationLabelByCode, isGSTCountry } from '../../utils/taxUtils';
import { useCompanyContext } from '../../contexts/CompanyContext';
import CompanySelector from '../ui/CompanySelector';
import type {
  CompanySettings,
  InvoiceSettings,
  Country,
  CreateCompanySettingsData,
  CreateInvoiceSettingsData,
  Customer
} from '../../types/invoice';

const InvoiceSettings: React.FC = () => {
  const { selectedCompany, selectCompany, refreshCompanies } = useCompanyContext();
  const [companySettings, setCompanySettings] = useState<CompanySettings[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { showSuccess, showError, showWarning } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const { startAction, endAction } = useActionProgress();

  const getCountryCode = (countryId?: string) => {
    const country = countries.find(c => c.id === countryId);
    return country?.code;
  };

  const resolveCountryCode = (countryId?: string) => {
    return getCountryCode(countryId) || editingCountryCode;
  };

  const getCompanyTaxFields = (countryIdOrCode?: string) => {
    const code = getCountryCode(countryIdOrCode)?.toUpperCase() || countryIdOrCode?.toUpperCase();
    if (code === 'IN' || code === 'IND') {
      return {
        fields: [
          { key: 'gstin', label: 'GSTIN', placeholder: 'Enter GSTIN' },
          { key: 'pan', label: 'PAN', placeholder: 'Enter PAN' },
          { key: 'cin', label: 'CIN', placeholder: 'Enter CIN' },
        ]
      };
    }
    if (code === 'IE' || code === 'IRL') {
      return {
        fields: [
          { key: 'vat_number', label: 'VAT Number', placeholder: 'Enter VAT Number' },
          { key: 'cro_number', label: 'CRO Number', placeholder: 'Enter CRO Number' },
          { key: 'pan', label: 'Tax ID', placeholder: 'Enter Tax ID' },
        ]
      };
    }
    if (code === 'GB' || code === 'GBR' || code === 'UK') {
      return {
        fields: [
          { key: 'gstin', label: 'VAT Number', placeholder: 'Enter VAT Number' },
          { key: 'pan', label: 'Tax ID', placeholder: 'Enter Tax ID' },
        ]
      };
    }
    if (code === 'US' || code === 'USA') {
      return {
        fields: [
          { key: 'gstin', label: 'Federal Tax ID (EIN)', placeholder: 'Enter EIN' },
          { key: 'pan', label: 'Tax ID', placeholder: 'Enter Tax ID' },
        ]
      };
    }
    return {
      fields: [
        { key: 'gstin', label: getTaxRegistrationLabelByCode(code) || 'Tax Registration Number', placeholder: `Enter ${getTaxRegistrationLabelByCode(code) || 'Tax Registration Number'}` },
      ]
    };
  };

  const getCompanyBankingFields = (countryIdOrCode?: string) => {
    const code = getCountryCode(countryIdOrCode)?.toUpperCase() || countryIdOrCode?.toUpperCase();
    if (code === 'IN' || code === 'IND') {
      return {
        fields: [
          { key: 'bank_name', label: 'Bank Name', placeholder: 'Enter bank name' },
          { key: 'branch_name', label: 'Branch Name', placeholder: 'Enter branch name' },
          { key: 'account_number', label: 'Account Number', placeholder: 'Enter account number' },
          { key: 'ifsc_code', label: 'IFSC Code', placeholder: 'Enter IFSC code' },
        ]
      };
    }
    if (code === 'IE' || code === 'IRL' || code === 'GB' || code === 'GBR' || code === 'UK') {
      return {
        fields: [
          { key: 'bank_name', label: 'Bank Name', placeholder: 'Enter bank name' },
          { key: 'branch_name', label: 'Branch Name', placeholder: 'Enter branch name' },
          { key: 'account_number', label: 'Account Number', placeholder: 'Enter account number' },
          { key: 'iban', label: 'IBAN', placeholder: 'Enter IBAN' },
          { key: 'swift_bic', label: 'SWIFT/BIC', placeholder: 'Enter SWIFT/BIC' },
        ]
      };
    }
    if (code === 'US' || code === 'USA') {
      return {
        fields: [
          { key: 'bank_name', label: 'Bank Name', placeholder: 'Enter bank name' },
          { key: 'branch_name', label: 'Branch Name', placeholder: 'Enter branch name' },
          { key: 'account_number', label: 'Account Number', placeholder: 'Enter account number' },
          { key: 'swift_bic', label: 'SWIFT/BIC', placeholder: 'Enter SWIFT/BIC' },
          { key: 'ifsc_code', label: 'Routing Number', placeholder: 'Enter routing number' },
        ]
      };
    }
    return {
      fields: [
        { key: 'bank_name', label: 'Bank Name', placeholder: 'Enter bank name' },
        { key: 'branch_name', label: 'Branch Name', placeholder: 'Enter branch name' },
        { key: 'account_number', label: 'Account Number', placeholder: 'Enter account number' },
        { key: 'swift_bic', label: 'SWIFT/BIC', placeholder: 'Enter SWIFT/BIC' },
      ]
    };
  };

  // Company settings modal states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyModalMode, setCompanyModalMode] = useState<'view' | 'edit' | 'add'>('view');
  const [selectedCompanyForModal, setSelectedCompanyForModal] = useState<CompanySettings | null>(null);
  const [companyFormData, setCompanyFormData] = useState<CreateCompanySettingsData>({
    company_name: '',
    legal_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country_id: '',
    gstin: '',
    pan: '',
    cin: '',
    cro_number: '',
    vat_number: '',
    phone: '',
    email: '',
    website: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    iban: '',
    swift_bic: '',
    branch_name: '',
    logo_url: '',
    signature_url: '',
    is_default: false
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [editingCountryCode, setEditingCountryCode] = useState<string | undefined>();

  // Invoice settings modal states
  const [showInvoiceSettingsModal, setShowInvoiceSettingsModal] = useState(false);
  const [invoiceSettingsModalMode, setInvoiceSettingsModalMode] = useState<'view' | 'edit' | 'add'>('view');
  const [invoiceSettingsFormData, setInvoiceSettingsFormData] = useState<CreateInvoiceSettingsData>({
    invoice_prefix: 'INV',
    invoice_suffix: '',
    number_format: 'PREFIX/YYYY/MM/###',
    reset_annually: true,
    financial_year_start_month: 4,
    current_financial_year: '2024-25',
    payment_terms: '',
    notes: '',
    footer_text: '',
    default_tax_rate: 18,
    enable_gst: true,
    due_days: 30,
    late_fee_percentage: 0,
    template_name: 'default',
    currency_position: 'inr_before'
  });

  useEffect(() => {
    loadData();
  }, [selectedCompany?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [countriesData, companyData] = await Promise.all([
        invoiceService.getCountries().catch((err) => {
          console.warn('Failed to load countries:', err);
          return [];
        }),
        invoiceService.getCompanySettings().catch((err) => {
          console.warn('Failed to load company settings:', err);
          return [];
        }),
      ]);

      setCountries(countriesData);
      setCompanySettings(companyData);

      if (selectedCompany) {
        const settings = await invoiceService.getInvoiceSettings(selectedCompany.id);
        setInvoiceSettings(settings);
      } else {
        setInvoiceSettings(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // Company Settings Modal Functions
  const openCompanyModal = (mode: 'view' | 'edit' | 'add', company?: CompanySettings) => {
    setCompanyModalMode(mode);
    setSelectedCompanyForModal(company || null);

    if (mode === 'add') {
      setCompanyFormData({
        company_name: '',
        legal_name: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        country_id: 'IN',
        gstin: '',
        pan: '',
        cin: '',
        cro_number: '',
        vat_number: '',
        phone: '',
        email: '',
        website: '',
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        iban: '',
        swift_bic: '',
        branch_name: '',
        logo_url: '',
        signature_url: '',
        is_default: false
      });
    } else if (company) {
      setCompanyFormData({
        company_name: company.company_name,
        legal_name: company.legal_name || '',
        address_line1: company.address_line1,
        address_line2: company.address_line2 || '',
        city: company.city,
        state: company.state,
        postal_code: company.postal_code,
        country_id: company.country_id,
        gstin: company.gstin || '',
        pan: company.pan || '',
        cin: company.cin || '',
        cro_number: company.cro_number || '',
        vat_number: company.vat_number || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        bank_name: company.bank_name || '',
        account_number: company.account_number || '',
        ifsc_code: company.ifsc_code || '',
        iban: company.iban || '',
        swift_bic: company.swift_bic || '',
        branch_name: company.branch_name || '',
        logo_url: company.logo_url || '',
        signature_url: company.signature_url || '',
        is_default: company.is_default
      });
      setEditingCountryCode(company.country?.code);
    }

    setShowCompanyModal(true);
  };

  const closeCompanyModal = () => {
    setShowCompanyModal(false);
    setSelectedCompanyForModal(null);
    setModalLoading(false);
    setEditingCountryCode(undefined);
  };

  const handleCompanyFormChange = (field: keyof CreateCompanySettingsData, value: string | boolean) => {
    setCompanyFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveCompany = async () => {
    try {
      setModalLoading(true);

      if (!companyFormData.company_name) {
        showWarning('Company name is required');
        return;
      }
      if (!companyFormData.address_line1) {
        showWarning('Address line 1 is required');
        return;
      }
      if (!companyFormData.city) {
        showWarning('City is required');
        return;
      }
      if (!companyFormData.state) {
        showWarning('State is required');
        return;
      }
      if (!companyFormData.postal_code) {
        showWarning('Postal code is required');
        return;
      }
      if (!companyFormData.country_id) {
        showWarning('Country ID is required');
        return;
      }

      if (companyModalMode === 'add') {
        await invoiceService.createCompanySettings(companyFormData);
        showSuccess('Company settings created successfully!');
      } else if (companyModalMode === 'edit' && selectedCompanyForModal) {
        await invoiceService.updateCompanySettings(selectedCompanyForModal.id, companyFormData);
        showSuccess('Company settings updated successfully!');
      }

      closeCompanyModal();
      await refreshCompanies();
      await loadData();
    } catch (error) {
      console.error('Failed to save company settings:', error);

      let errorMessage = 'Failed to save company settings';
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          errorMessage = 'A company with this information already exists';
        } else if (error.message.includes('foreign key')) {
          errorMessage = 'Invalid country ID. Please check the country field';
        } else if (error.message.includes('check constraint')) {
          errorMessage = 'Invalid data format. Please check all fields';
        } else {
          errorMessage = `Failed to save company settings: ${error.message}`;
        }
      }

      showError(errorMessage);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteCompany = async (company: CompanySettings) => {
    const confirmed = await confirm({
      title: 'Delete Company Settings',
      message: `Are you sure you want to delete "${company.company_name}"?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      startAction('Deleting company settings…');
      try {
        await invoiceService.deleteCompanySettings(company.id);
        showSuccess('Company settings deleted successfully!');
        await refreshCompanies();
        await loadData();
      } catch (error) {
        console.error('Failed to delete company settings:', error);
        showError(`Failed to delete company settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        endAction();
      }
    }
  };

  // Invoice Settings Modal Functions
  const openInvoiceSettingsModal = (mode: 'view' | 'edit' | 'add', settings?: InvoiceSettings) => {
    setInvoiceSettingsModalMode(mode);

    const isIrish = selectedCompany?.country_id === 'IE' || selectedCompany?.country?.code === 'IE' || selectedCompany?.country?.code === 'IRL' || !!selectedCompany?.cro_number || !!selectedCompany?.vat_number;
    const currentYr = new Date().getFullYear();

    if (mode === 'add') {
      setInvoiceSettingsFormData({
        invoice_prefix: isIrish ? 'INV/IRL' : 'INV',
        invoice_suffix: '',
        number_format: isIrish ? 'INV/IRL/YYYY/MM/XXXX' : 'PREFIX/YYYY/MM/###',
        reset_annually: true,
        financial_year_start_month: isIrish ? 1 : 4,
        current_financial_year: isIrish ? currentYr.toString() : '2026-27',
        payment_terms: '',
        notes: '',
        footer_text: '',
        default_tax_rate: isIrish ? 23 : 18,
        enable_gst: !isIrish,
        due_days: 30,
        late_fee_percentage: 0,
        template_name: 'default',
        currency_position: isIrish ? 'before' : 'inr_before'
      });
    } else if (settings) {
      setInvoiceSettingsFormData({
        invoice_prefix: settings.invoice_prefix,
        invoice_suffix: settings.invoice_suffix || '',
        number_format: settings.number_format,
        reset_annually: settings.reset_annually,
        financial_year_start_month: settings.financial_year_start_month,
        current_financial_year: settings.current_financial_year,
        payment_terms: settings.payment_terms || '',
        notes: settings.notes || '',
        footer_text: settings.footer_text || '',
        default_tax_rate: settings.default_tax_rate,
        enable_gst: settings.enable_gst,
        due_days: settings.due_days,
        late_fee_percentage: settings.late_fee_percentage,
        template_name: settings.template_name,
        currency_position: settings.currency_position === 'before' ? 'inr_before' : settings.currency_position === 'after' ? 'inr_after' : settings.currency_position
      });
    }

    setShowInvoiceSettingsModal(true);
  };

  const closeInvoiceSettingsModal = () => {
    setShowInvoiceSettingsModal(false);
    setModalLoading(false);
  };

  const handleInvoiceSettingsFormChange = (field: keyof CreateInvoiceSettingsData, value: string | number | boolean) => {
    setInvoiceSettingsFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveInvoiceSettings = async () => {
    try {
      setModalLoading(true);

      if (!invoiceSettingsFormData.invoice_prefix) {
        showWarning('Invoice prefix is required');
        return;
      }
      if (!invoiceSettingsFormData.number_format) {
        showWarning('Number format is required');
        return;
      }
      if (!invoiceSettingsFormData.current_financial_year) {
        showWarning('Current financial year is required');
        return;
      }
      if (!invoiceSettingsFormData.template_name) {
        showWarning('Template name is required');
        return;
      }

      if (invoiceSettingsModalMode === 'add') {
        await invoiceService.createInvoiceSettings(invoiceSettingsFormData, selectedCompany?.id);
        showSuccess('Invoice settings created successfully!');
      } else if (invoiceSettingsModalMode === 'edit' && invoiceSettings) {
        await invoiceService.updateInvoiceSettings(invoiceSettings.id, invoiceSettingsFormData);
        showSuccess('Invoice settings updated successfully!');
      }

      closeInvoiceSettingsModal();
      await loadData();
    } catch (error) {
      console.error('Failed to save invoice settings:', error);

      let errorMessage = 'Failed to save invoice settings';
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          errorMessage = 'Invoice settings with this configuration already exists';
        } else if (error.message.includes('check constraint')) {
          errorMessage = 'Invalid data format. Please check all fields';
        } else {
          errorMessage = `Failed to save invoice settings: ${error.message}`;
        }
      }

      showError(errorMessage);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteInvoiceSettings = async (settings: InvoiceSettings) => {
    const confirmed = await confirm({
      title: 'Delete Invoice Settings',
      message: `Are you sure you want to delete these invoice settings?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      startAction('Deleting invoice settings…');
      try {
        await invoiceService.deleteInvoiceSettings(settings.id);
        showSuccess('Invoice settings deleted successfully!');
        await loadData();
      } catch (error) {
        console.error('Failed to delete invoice settings:', error);
        showError(`Failed to delete invoice settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        endAction();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-2">Error</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Company Settings Modal Component
  const renderCompanyModal = () => {
    if (!showCompanyModal) return null;

    const isReadOnly = companyModalMode === 'view';
    const modalTitle = companyModalMode === 'add' ? 'Add Company Settings' :
                      companyModalMode === 'edit' ? 'Edit Company Settings' : 'Company Details';

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">{modalTitle}</h3>
            <button
              onClick={closeCompanyModal}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyFormData.company_name}
                  onChange={(e) => handleCompanyFormChange('company_name', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Legal Name
                </label>
                <input
                  type="text"
                  value={companyFormData.legal_name}
                  onChange={(e) => handleCompanyFormChange('legal_name', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter legal name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  value={companyFormData.address_line1}
                  onChange={(e) => handleCompanyFormChange('address_line1', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter address line 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={companyFormData.address_line2}
                  onChange={(e) => handleCompanyFormChange('address_line2', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter address line 2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={companyFormData.city}
                  onChange={(e) => handleCompanyFormChange('city', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter city"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State *
                </label>
                <input
                  type="text"
                  value={companyFormData.state}
                  onChange={(e) => handleCompanyFormChange('state', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter state"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Postal Code *
                </label>
                <input
                  type="text"
                  value={companyFormData.postal_code}
                  onChange={(e) => handleCompanyFormChange('postal_code', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter postal code"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country *
                </label>
                <select
                  value={companyFormData.country_id}
                  onChange={(e) => handleCompanyFormChange('country_id', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                >
                  <option value="">Select Country</option>
                  {countries.length > 0 ? (
                    countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name} ({country.code})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="IN">India (IN)</option>
                      <option value="US">United States (US)</option>
                      <option value="GB">United Kingdom (GB)</option>
                      <option value="CA">Canada (CA)</option>
                      <option value="AU">Australia (AU)</option>
                    </>
                  )}
                </select>
                {countries.length === 0 && (
                  <p className="text-xs text-yellow-600 mt-1">Using fallback country list</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={companyFormData.email}
                  onChange={(e) => handleCompanyFormChange('email', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={companyFormData.phone}
                  onChange={(e) => handleCompanyFormChange('phone', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter phone number"
                />
              </div>

              {(() => {
                const taxFields = getCompanyTaxFields(resolveCountryCode(companyFormData.country_id));
                return (
                  <>
                    {taxFields.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {field.label}
                        </label>
                        <input
                          type="text"
                          value={companyFormData[field.key as keyof CreateCompanySettingsData] as string}
                          onChange={(e) => handleCompanyFormChange(field.key as keyof CreateCompanySettingsData, e.target.value)}
                          disabled={isReadOnly}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                            isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                          }`}
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h4 className="text-md font-medium text-gray-900 mb-4 flex items-center">
                <CreditCard className="w-4 h-4 mr-2" />
                Banking Information
              </h4>
              {(() => {
                const banking = getCompanyBankingFields(resolveCountryCode(companyFormData.country_id));
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {banking.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {field.label}
                        </label>
                        <input
                          type="text"
                          value={companyFormData[field.key as keyof CreateCompanySettingsData] as string}
                          onChange={(e) => handleCompanyFormChange(field.key as keyof CreateCompanySettingsData, e.target.value)}
                          disabled={isReadOnly}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                            isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                          }`}
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="pt-4">
              <div className="md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={companyFormData.is_default}
                    onChange={(e) => handleCompanyFormChange('is_default', e.target.checked)}
                    disabled={isReadOnly}
                    className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Set as default company
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-8">
            <button
              onClick={closeCompanyModal}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-md text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSaveCompany}
                disabled={modalLoading || !companyFormData.company_name || !companyFormData.address_line1 || !companyFormData.city || !companyFormData.state || !companyFormData.postal_code || !companyFormData.country_id}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {modalLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Company
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Invoice Settings Modal Component
  const renderInvoiceSettingsModal = () => {
    if (!showInvoiceSettingsModal) return null;

    const isReadOnly = invoiceSettingsModalMode === 'view';
    const modalTitle = invoiceSettingsModalMode === 'add' ? 'Create Invoice Settings' :
                      invoiceSettingsModalMode === 'edit' ? 'Edit Invoice Settings' : 'Invoice Settings Details';

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">{modalTitle}</h3>
            <button
              onClick={closeInvoiceSettingsModal}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Prefix *
                </label>
                <input
                  type="text"
                  value={invoiceSettingsFormData.invoice_prefix}
                  onChange={(e) => handleInvoiceSettingsFormChange('invoice_prefix', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="e.g., INV"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Suffix
                </label>
                <input
                  type="text"
                  value={invoiceSettingsFormData.invoice_suffix}
                  onChange={(e) => handleInvoiceSettingsFormChange('invoice_suffix', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Optional suffix"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number Format *
                </label>
                <select
                  value={invoiceSettingsFormData.number_format}
                  onChange={(e) => handleInvoiceSettingsFormChange('number_format', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                >
                  <option value="PREFIX/YYYY/MM/###">PREFIX/YYYY/MM/### (INV/2026/06/010 - India)</option>
                  <option value="INV/IRL/YYYY/MM/XXXX">INV/IRL/YYYY/MM/XXXX (INV/IRL/2026/06/0001 - Ireland)</option>
                  <option value="PREFIX/YYYY/MM/XXXX">PREFIX/YYYY/MM/XXXX (INV/IRL/2026/06/0001)</option>
                  <option value="YYYY-MM-####">YYYY-MM-#### (2024-01-0001)</option>
                  <option value="####">#### (0001)</option>
                  <option value="YYYY####">YYYY#### (20240001)</option>
                  <option value="MM-####">MM-#### (01-0001)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Days *
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={invoiceSettingsFormData.due_days}
                  onChange={(e) => handleInvoiceSettingsFormChange('due_days', parseInt(e.target.value) || 30)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Tax Rate (%) *
                </label>
                <select
                  value={invoiceSettingsFormData.default_tax_rate}
                  onChange={(e) => handleInvoiceSettingsFormChange('default_tax_rate', parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                >
                  <option value={0}>0% (Exempt)</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={23}>23% (VAT)</option>
                  <option value={28}>28%</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Late Fee (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={invoiceSettingsFormData.late_fee_percentage}
                  onChange={(e) => handleInvoiceSettingsFormChange('late_fee_percentage', parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Financial Year Start Month *
                </label>
                <select
                  value={invoiceSettingsFormData.financial_year_start_month}
                  onChange={(e) => handleInvoiceSettingsFormChange('financial_year_start_month', parseInt(e.target.value) || 4)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                >
                  <option value={1}>January</option>
                  <option value={2}>February</option>
                  <option value={3}>March</option>
                  <option value={4}>April</option>
                  <option value={5}>May</option>
                  <option value={6}>June</option>
                  <option value={7}>July</option>
                  <option value={8}>August</option>
                  <option value={9}>September</option>
                  <option value={10}>October</option>
                  <option value={11}>November</option>
                  <option value={12}>December</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Financial Year *
                </label>
                <input
                  type="text"
                  value={invoiceSettingsFormData.current_financial_year}
                  onChange={(e) => handleInvoiceSettingsFormChange('current_financial_year', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="e.g., 2024-25"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template *
                </label>
                <select
                  value={invoiceSettingsFormData.template_name}
                  onChange={(e) => handleInvoiceSettingsFormChange('template_name', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                >
                  <option value="default">Default</option>
                  <option value="modern">Modern</option>
                  <option value="classic">Classic</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency Position *
                </label>
                <select
                  value={invoiceSettingsFormData.currency_position}
                  onChange={(e) => handleInvoiceSettingsFormChange('currency_position', e.target.value as 'before' | 'after' | 'inr_before' | 'inr_after' | 'euro_before' | 'euro_after' | 'pound_before' | 'pound_after' | 'usd_before' | 'usd_after')}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                >
                  <option value="inr_before">Before Amount (₹100)</option>
                  <option value="inr_after">After Amount (100₹)</option>
                  <option value="euro_before">Before Amount (€100)</option>
                  <option value="euro_after">After Amount (100€)</option>
                  <option value="pound_before">Before Amount (£100)</option>
                  <option value="pound_after">After Amount (100£)</option>
                  <option value="usd_before">Before Amount ($100)</option>
                  <option value="usd_after">After Amount (100$)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={invoiceSettingsFormData.enable_gst}
                    onChange={(e) => handleInvoiceSettingsFormChange('enable_gst', e.target.checked)}
                    disabled={isReadOnly}
                    className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable tax calculations
                  </span>
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={invoiceSettingsFormData.reset_annually}
                    onChange={(e) => handleInvoiceSettingsFormChange('reset_annually', e.target.checked)}
                    disabled={isReadOnly}
                    className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Reset invoice numbers at start of financial year
                  </span>
                </label>
                <div className="ml-6 mt-1">
                  <span className="text-xs text-gray-500">
                    Numbers will reset to 1 on April 1st (or your configured financial year start)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-8">
            <button
              onClick={closeInvoiceSettingsModal}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-md text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSaveInvoiceSettings}
                disabled={modalLoading || !invoiceSettingsFormData.invoice_prefix || !invoiceSettingsFormData.number_format || !invoiceSettingsFormData.current_financial_year || !invoiceSettingsFormData.template_name}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {modalLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Company Settings */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Company Information</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => loadData()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              <button
                onClick={() => openCompanyModal('add')}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Company
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Active Company</label>
              <CompanySelector
                companies={companySettings}
                selectedId={selectedCompany?.id ?? null}
                onChange={selectCompany}
              />
            </div>
                        {(() => {
              const displayCompany = selectedCompany || companySettings[0];
              if (!displayCompany) {
                return (
                  <div className="text-center py-12">
                    <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Company Settings Found</h3>
                    <p className="text-gray-500 mb-4">Configure your company information to get started.</p>
                    <button
                      onClick={() => openCompanyModal('add')}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Company
                    </button>
                  </div>
                );
              }
              return (
                <div className="border rounded-lg p-4 relative">
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <button
                      onClick={() => openCompanyModal('view', displayCompany)}
                      className="text-blue-600 hover:text-blue-900"
                      title="View Company"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openCompanyModal('edit', displayCompany)}
                      className="text-gray-600 hover:text-gray-900"
                      title="Edit Company"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(displayCompany)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete Company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pr-20">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Company Name</label>
                      <div className="mt-1 text-sm text-gray-900">{displayCompany.company_name}</div>
                      {displayCompany.is_default && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 mt-1">
                          Default
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Legal Name</label>
                      <div className="mt-1 text-sm text-gray-900">{displayCompany.legal_name || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Address</label>
                      <div className="mt-1 text-sm text-gray-900">
                        {displayCompany.address_line1}
                        {displayCompany.address_line2 && <>, {displayCompany.address_line2}</>}
                        <br />
                        {displayCompany.city}, {displayCompany.state} {displayCompany.postal_code}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Contact</label>
                      <div className="mt-1 text-sm text-gray-900">
                        {displayCompany.email && <div>Email: {displayCompany.email}</div>}
                        {displayCompany.phone && <div>Phone: {displayCompany.phone}</div>}
                        {displayCompany.website && <div>Website: {displayCompany.website}</div>}
                      </div>
                    </div>
                    {(() => {
                      const taxFields = getCompanyTaxFields(resolveCountryCode(displayCompany.country_id));
                      return (
                        <>
                          {taxFields.fields.map((field) => (
                            <div key={field.key}>
                              <label className="block text-sm font-medium text-gray-700">{field.label}</label>
                              <div className="mt-1 text-sm text-gray-900">
                                {field.key === 'vat_number' ? (displayCompany.vat_number || 'N/A') : 
                                 field.key === 'cro_number' ? (displayCompany.cro_number || 'N/A') : 
                                 field.key === 'gstin' ? (displayCompany.gstin || 'N/A') : 
                                 field.key === 'pan' ? (displayCompany.pan || 'N/A') : 
                                 field.key === 'cin' ? (displayCompany.cin || 'N/A') : 'N/A'}
                              </div>
                            </div>
                          ))}
                        </>
                      );
                    })()}

                    <div className="md:col-span-2">
                      <h4 className="text-md font-medium text-gray-900 mb-4 flex items-center">
                        <CreditCard className="w-4 h-4 mr-2" />
                        Banking Information
                      </h4>
                       <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Bank Name</label>
                            <div className="mt-1 text-sm text-gray-900">{displayCompany.bank_name || 'N/A'}</div>
                          </div>
                          {(() => {
                            const banking = getCompanyBankingFields(resolveCountryCode(displayCompany.country_id));
                            return (
                              <>
                                {banking.fields.filter(f => f.key !== 'bank_name' && f.key !== 'account_number').map((field) => (
                                  <div key={field.key}>
                                    <label className="block text-sm font-medium text-gray-700">{field.label}</label>
                                    <div className="mt-1 text-sm text-gray-900 font-mono">
                                      {field.key === 'iban' ? (displayCompany.iban || 'N/A') : 
                                       field.key === 'swift_bic' ? (displayCompany.swift_bic || 'N/A') : 
                                       field.key === 'ifsc_code' ? (displayCompany.ifsc_code || 'N/A') : 
                                       field.key === 'branch_name' ? (displayCompany.branch_name || 'N/A') : 'N/A'}
                                    </div>
                                  </div>
                                ))}
                              </>
                            );
                          })()}
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Account Number</label>
                            <div className="mt-1 text-sm text-gray-900 font-mono">
                              {displayCompany.account_number || 'N/A'}
                            </div>
                          </div>
                        </div>
                       </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Invoice Settings */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Invoice Settings</h3>
            <div className="flex space-x-2">
              {!invoiceSettings && (
                <button
                  onClick={() => openInvoiceSettingsModal('add')}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Settings
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {invoiceSettings ? (
              <div className="border rounded-lg p-4 relative">
                <div className="absolute top-4 right-4 flex space-x-2">
                  <button
                    onClick={() => openInvoiceSettingsModal('view', invoiceSettings)}
                    className="text-blue-600 hover:text-blue-900"
                    title="View Settings"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openInvoiceSettingsModal('edit', invoiceSettings)}
                    className="text-gray-600 hover:text-gray-900"
                    title="Edit Settings"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteInvoiceSettings(invoiceSettings)}
                    className="text-red-600 hover:text-red-900"
                    title="Delete Settings"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pr-20">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Invoice Prefix</label>
                    <div className="mt-1 text-sm text-gray-900">{invoiceSettings.invoice_prefix}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Current Number</label>
                    <div className="mt-1 text-sm text-gray-900">{invoiceSettings.current_number}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Due Days</label>
                    <div className="mt-1 text-sm text-gray-900">{invoiceSettings.due_days} days</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Default Tax Rate</label>
                    <div className="mt-1 text-sm text-gray-900">{invoiceSettings.default_tax_rate}%</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Late Fee</label>
                    <div className="mt-1 text-sm text-gray-900">{invoiceSettings.late_fee_percentage}%</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Template</label>
                    <div className="mt-1 text-sm text-gray-900">{invoiceSettings.template_name}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tax Enabled</label>
                    <div className="mt-1 text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        invoiceSettings.enable_gst ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {invoiceSettings.enable_gst ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Financial Year</label>
                    <div className="mt-1 text-sm text-gray-900">{invoiceSettings.current_financial_year}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Invoice Settings Found</h3>
                <p className="text-gray-500 mb-4">Configure your invoice settings to get started.</p>
                <button
                  onClick={() => openInvoiceSettingsModal('add')}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Settings
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PDF Branding Settings */}
        {companySettings.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">PDF Invoice Branding</h3>
              <p className="text-sm text-gray-600 mt-1">
                Customize your PDF invoices with header, footer, and logo images. Images will be optimized to keep PDF size under 2MB.
              </p>
            </div>
            <div className="p-6">
              <PDFBrandingManager
                companySettings={selectedCompany || companySettings[0]}
                onSettingsUpdate={(updatedSettings) => {
                  setCompanySettings(prev =>
                    prev.map(company =>
                      company.id === updatedSettings.id ? updatedSettings : company
                    )
                  );
                }}
                onSuccess={showSuccess}
                onError={showError}
              />
            </div>
          </div>
        )}
      </main>

      {/* Company Modal */}
      {renderCompanyModal()}

      {/* Invoice Settings Modal */}
      {renderInvoiceSettingsModal()}
    </div>
  );
};

export default InvoiceSettings;
