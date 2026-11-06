import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  FileText,
  Download,
  Mail,
  Users,
  Package,
  ArrowLeft,
  RefreshCw,
  Trash2,
  X,
  Save,
  Trash,
  CreditCard,
  CheckCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { invoiceService } from '../../services/invoiceService';
import { paymentService } from '../../services/paymentService';
import { EmailService } from '../../services/emailService';
import { simpleAuth } from '../../utils/simpleAuth';
import { useToast } from '../ui/ToastProvider';
import ConfirmDialog from '../ui/ConfirmDialog';
import { PDFBrandingUtils } from '../../utils/pdfBrandingUtils';
import PDFBrandingManager from '../admin/PDFBrandingManager';
import { CurrencyDisplay } from '../ui/CurrencyDisplay';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useActionProgress } from '../../contexts/ActionProgressContext';
import { useCompanyContext } from '../../contexts/CompanyContext';
import { CreateInvoice } from './CreateInvoice';
import { EditInvoice } from './EditInvoice';
import { getTaxLabel, getTaxRegistrationLabel, validateTaxRegistration, getDefaultTaxRate, getClassificationCodeLabel, getCompanyTaxFields } from '../../utils/taxUtils';
import { getPrimaryCustomerId } from '../../utils/customerCodeUtils';
import type { Invoice, InvoiceFilters, InvoiceStats, Customer, Product, CompanySettings, InvoiceSettings, Country, CreateProductData, CreateCustomerData, CreateInvoiceData, CreateInvoiceItemData, TermsTemplate } from '../../types/invoice';

interface InvoiceManagementProps {
  onBackToDashboard?: () => void;
}

const InvoiceManagement: React.FC<InvoiceManagementProps> = ({ onBackToDashboard }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedCompany } = useCompanyContext();

const getBankingLabel = (company: CompanySettings | undefined | null): string => {
  if (!company) return 'IFSC';
  const code = company.country_id?.toUpperCase();
  if (code === 'IN' || code === 'IND') return 'IFSC';
  if (code === 'IE' || code === 'IRL' || code === 'GB' || code === 'GBR' || code === 'UK') return 'IBAN';
  if (code === 'US' || code === 'USA') return 'Routing No';
  const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'GR', 'HU', 'IE', 'LV', 'LT', 'LU', 'MT', 'PL', 'PT', 'RO', 'SK', 'SI', 'SE', 'DE', 'FR', 'ES', 'IT', 'NL'];
  if (code && euCountries.includes(code)) return 'IBAN';
  return 'SWIFT/BIC';
};

const getBankingCodeField = (company: CompanySettings | undefined | null): keyof CompanySettings => {
  if (!company) return 'ifsc_code';
  const code = company.country_id?.toUpperCase();
  if (code === 'IN' || code === 'IND') return 'ifsc_code';
  if (code === 'US' || code === 'USA') return 'ifsc_code';
  return 'ifsc_code';
};

  // Mark as Paid dialog state
  const [markAsPaidDialogOpen, setMarkAsPaidDialogOpen] = useState(false);
  const [markAsPaidInvoice, setMarkAsPaidInvoice] = useState<Invoice | null>(null);
  const [markAsPaidAmount, setMarkAsPaidAmount] = useState('');
  const [markAsPaidDate, setMarkAsPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [markAsPaidMethod, setMarkAsPaidMethod] = useState('bank_transfer');
  const [markAsPaidReference, setMarkAsPaidReference] = useState('');
  const [markAsPaidLoading, setMarkAsPaidLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<InvoiceFilters>({});
  type InvoiceTab = 'dashboard' | 'invoices' | 'create-invoice';
  const TAB_PATHS: Record<InvoiceTab, string> = {
    dashboard: '/admin/invoices',
    invoices: '/admin/invoices/list',
    'create-invoice': '/admin/invoices/new',
  };
  const tabFromPath = (pathname: string): InvoiceTab =>
    pathname === '/admin/invoices/list' ? 'invoices' :
    pathname === '/admin/invoices/new' ? 'create-invoice' :
    'dashboard';
  const [activeTab, setActiveTab] = useState<InvoiceTab>(tabFromPath(window.location.pathname));
  
  // Product modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'add'>('view');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState<CreateProductData>({
    name: '',
    description: '',
    product_code: '',
    category: '',
    unit_price: 0,
    unit: '',
    tax_rate: 18,
    hsn_code: '',
    is_active: true
  });
  const [modalLoading, setModalLoading] = useState(false);

  // Customer modal states
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalMode, setCustomerModalMode] = useState<'view' | 'edit' | 'add'>('view');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerFormData, setCustomerFormData] = useState<CreateCustomerData>({
    company_name: '',
    contact_person: '',
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
    payment_terms: 30
  });

  // Invoice modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceModalMode, setInvoiceModalMode] = useState<'view' | 'edit' | 'add'>('view');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedDefaultProduct, setSelectedDefaultProduct] = useState<string>('');
  const [globalHsnCode, setGlobalHsnCode] = useState<string>(''); // Global HSN code for all line items
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState<string>('');
  const [invoiceFormData, setInvoiceFormData] = useState<CreateInvoiceData>({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    // Project details
    project_title: '',
    estimated_time: '',
    company_contact_name: '',
    company_contact_email: '',
    company_contact_phone: '',
    // Discount
    discount_type: undefined,
    discount_value: 0,
    // International banking - populated when customer is selected
    intl_account_name: '',
    intl_account_number: '',
    intl_account_type: '',
    intl_routing_number: '',
    intl_swift_bic: '',
    intl_bank_address: '',
    intl_iban: '',
    intl_sort_code: '',
    // Additional info
    notes: '',
    terms_conditions: '',
    items: [{
      product_id: undefined,
      item_name: '',
      description: '',
      quantity: 1,
      unit: 'pcs',
      unit_price: 0,
      tax_rate: 18,
      hsn_code: undefined,
      billable_hours: undefined,
      resource_count: undefined,
      is_service_item: false
    }]
  });
  const [termsTemplates, setTermsTemplates] = useState<TermsTemplate[]>([]);
  const [selectedTermsTemplateId, setSelectedTermsTemplateId] = useState<string>('');
  // Currency override: allows billing a foreign customer in INR
  const [useINROverride, setUseINROverride] = useState(false);

  // Debug customer currency changes
  useEffect(() => {
    if (invoiceFormData.customer_id) {
      const selectedCustomer = customers.find(c => c.id === invoiceFormData.customer_id);
      const currencyInfo = getCurrencyInfo(selectedCustomer);
      console.log('💰 Customer changed - Currency update:', {
        customerId: invoiceFormData.customer_id,
        customer: selectedCustomer ? {
          id: selectedCustomer.id,
          name: selectedCustomer.company_name || selectedCustomer.contact_person,
          country_id: selectedCustomer.country_id,
          country: selectedCustomer.country
        } : null,
        currencyInfo
      });
    }
  }, [invoiceFormData.customer_id, customers]);

  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const { startAction, endAction } = useActionProgress();

  // Keep the tab in sync with dedicated per-tab routes so each tab is
  // directly linkable/bookmarkable and browser back/forward works as expected.
  useEffect(() => {
    const tabForPath = tabFromPath(location.pathname);
    setActiveTab(prev => (prev === tabForPath ? prev : tabForPath));
  }, [location.pathname]);

  // Switches tabs and updates the URL to the tab's dedicated route.
  const goToTab = (tab: InvoiceTab) => {
    setActiveTab(tab);
    if (location.pathname !== TAB_PATHS[tab]) {
      navigate(TAB_PATHS[tab]);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPage, filters, activeTab, selectedCompany]);

  useEffect(() => {
    // Reset to page 1 when changing tabs
    setCurrentPage(1);
  }, [activeTab]);

  // Product Modal Functions
  const openProductModal = (mode: 'view' | 'edit' | 'add', product?: Product) => {
    setModalMode(mode);
    setSelectedProduct(product || null);
    
    if (mode === 'add') {
      setProductFormData({
        name: '',
        description: '',
        product_code: '',
        category: '',
        unit_price: 0,
        unit: '',
        tax_rate: 18,
        hsn_code: '',
        is_active: true
      });
    } else if (product) {
      setProductFormData({
        name: product.name,
        description: product.description || '',
        product_code: product.product_code || '',
        category: product.category || '',
        unit_price: product.unit_price,
        unit: product.unit,
        tax_rate: product.tax_rate,
        hsn_code: product.hsn_code || '',
        is_active: product.is_active
      });
    }
    
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setSelectedProduct(null);
    setModalLoading(false);
  };

  const handleProductFormChange = (field: keyof CreateProductData, value: string | number | boolean) => {
    setProductFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProduct = async () => {
    try {
      setModalLoading(true);
      
      if (modalMode === 'add') {
        await invoiceService.createProduct(productFormData);
        showSuccess('Product created successfully!');
      } else if (modalMode === 'edit' && selectedProduct) {
        await invoiceService.updateProduct(selectedProduct.id, productFormData);
        showSuccess('Product updated successfully!');
      }
      
      closeProductModal();
      await loadData(); // Refresh the product list
    } catch (error) {
      console.error('Failed to save product:', error);
      showError(`Failed to save product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const confirmed = await confirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete "${product.name}"?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger'
    });
    
    if (confirmed) {
      startAction('Deleting product…');
      try {
        await invoiceService.deleteProduct(product.id);
        showSuccess('Product deleted successfully!');
        await loadData(); // Refresh the product list
      } catch (error) {
        console.error('Failed to delete product:', error);
        showError(`Failed to delete product: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        endAction();
      }
    }
  };

  // Customer Modal Functions
  const openCustomerModal = (mode: 'view' | 'edit' | 'add', customer?: Customer) => {
    console.log('🏢 Opening customer modal:', { mode, customer: customer?.id });
    setCustomerModalMode(mode);
    setSelectedCustomer(customer || null);
    
    if (mode === 'add') {
      setCustomerFormData({
        company_name: '',
        contact_person: '',
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
        payment_terms: 30
      });
    } else if (customer) {
      setCustomerFormData({
        company_name: customer.company_name || '',
        contact_person: customer.contact_person || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address_line1: customer.address_line1 || '',
        address_line2: customer.address_line2 || '',
        city: customer.city || '',
        state: customer.state || '',
        postal_code: customer.postal_code || '',
        country_id: customer.country_id || 'IN',
        gstin: customer.gstin || '',
        pan: customer.pan || '',
        credit_limit: Number(customer.credit_limit) || 0,
        payment_terms: Number(customer.payment_terms) || 30
      });
    }
    
    setShowCustomerModal(true);
  };

  const closeCustomerModal = () => {
    setShowCustomerModal(false);
    setSelectedCustomer(null);
    setModalLoading(false);
  };

  const handleCustomerFormChange = (field: keyof CreateCustomerData, value: string | number) => {
    setCustomerFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Customer form validation
  const validateCustomerForm = () => {
    const errors: string[] = [];
    
    // At least one identifier should be provided
    if (!(customerFormData.company_name || '').trim() && !(customerFormData.contact_person || '').trim()) {
      errors.push('Either Company Name or Contact Person is required');
    }
    
    // Email validation
    if ((customerFormData.email || '').trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerFormData.email || '')) {
        errors.push('Please enter a valid email address');
      }
    }
    
    // Phone validation (basic)
    if ((customerFormData.phone || '').trim()) {
      const phoneRegex = /^[+]?[1-9][\d]{3,14}$/;
      if (!phoneRegex.test((customerFormData.phone || '').replace(/[\s\-()]/g, ''))) {
        errors.push('Please enter a valid phone number');
      }
    }
    
    // Tax registration validation (GSTIN/VAT Number)
    if ((customerFormData.gstin || '').trim()) {
      const selectedCustomer = customers.find(c => c.id === customerFormData.country_id) || 
                               { country: countries.find(country => country.id === customerFormData.country_id) } as Customer;
      const taxValidation = validateTaxRegistration(customerFormData.gstin || '', selectedCustomer);
      if (!taxValidation.isValid && taxValidation.error) {
        errors.push(taxValidation.error);
      }
    }
    
    // PAN validation
    if ((customerFormData.pan || '').trim()) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(customerFormData.pan || '')) {
        errors.push('Please enter a valid PAN (10 characters: ABCDE1234F)');
      }
    }
    
    // Postal code validation (basic)
    if ((customerFormData.postal_code || '').trim()) {
      const postalRegex = /^[A-Z0-9\s-]{3,10}$/i;
      if (!postalRegex.test(customerFormData.postal_code || '')) {
        errors.push('Please enter a valid postal code');
      }
    }
    
    return errors;
  };

  const handleSaveCustomer = async () => {
    try {
      setModalLoading(true);
      
      // Validate form
      const validationErrors = validateCustomerForm();
      if (validationErrors.length > 0) {
        showError(`Please fix the following errors:\n• ${validationErrors.join('\n• ')}`);
        return;
      }
      
      console.log('💾 Saving customer:', { mode: customerModalMode, data: customerFormData });
      
      if (customerModalMode === 'add') {
        const result = await invoiceService.createCustomer(customerFormData);
        console.log('✅ Customer created:', result);
        console.log('🏁 Customer country relationship:', {
          customer_id: result.id,
          country_id: result.country_id,
          country: result.country,
          currency_code: result.country?.currency_code,
          currency_symbol: result.country?.currency_symbol,
          currency_name: result.country?.currency_name
        });
        
        // Add the new customer to the existing customers list to avoid full reload
        // This ensures the country relationship is preserved
        setCustomers(prev => [result, ...prev]);
        
        showSuccess('Customer created successfully!');
      } else if (customerModalMode === 'edit' && selectedCustomer) {
        const result = await invoiceService.updateCustomer(selectedCustomer.id, customerFormData);
        console.log('✅ Customer updated:', result);
        console.log('🏁 Updated customer country relationship:', {
          customer_id: result.id,
          country_id: result.country_id,
          country: result.country,
          currency_code: result.country?.currency_code,
          currency_symbol: result.country?.currency_symbol,
          currency_name: result.country?.currency_name
        });
        
        // Update the specific customer in the list
        setCustomers(prev => prev.map(customer => 
          customer.id === selectedCustomer.id ? result : customer
        ));
        
        showSuccess('Customer updated successfully!');
      }
      
      closeCustomerModal();
      // Only reload data after saving customer
        await loadData();
    } catch (error) {
      console.error('Failed to save customer:', error);
      showError(`Failed to save customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    console.log('🗑️ Delete customer requested:', customer);
    const confirmed = await confirm({
      title: 'Delete Customer',
      message: `Are you sure you want to delete "${customer.company_name || customer.contact_person}"?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger'
    });
    
    if (confirmed) {
      startAction('Deleting customer…');
      try {
        console.log('🗑️ Deleting customer:', customer.id);
        await invoiceService.deleteCustomer(customer.id);
        console.log('✅ Customer deleted successfully');
        showSuccess('Customer deleted successfully!');
        await loadData();
      } catch (error) {
        console.error('❌ Failed to delete customer:', error);
        showError(`Failed to delete customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        endAction();
      }
    }
  };

  // Invoice Modal Functions
  const openCreateInvoiceTab = async () => {
    goToTab('create-invoice');
    
    // Ensure all required data is loaded
    await loadData();
    
    // Force reload terms templates for create invoice tab
    let defaultTermsContent = '';
    let defaultTemplateId = '';
    try {
      const templates = await invoiceService.getTermsTemplates();
      setTermsTemplates(templates);
      
      // Set default terms from template
      const generalTemplate = templates.find(t => t.category === 'general' && t.is_default);
      if (generalTemplate) {
        defaultTermsContent = generalTemplate.content;
        defaultTemplateId = generalTemplate.id;
      }
    } catch (error) {
      console.error('Failed to load terms templates:', error);
    }
    
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // Default 30 days from today
    
    setSelectedDefaultProduct('');
    setGlobalHsnCode(''); // Reset global HSN code
    setSelectedTermsTemplateId(defaultTemplateId); // Set default selected template
    
    // Preview invoice number using the service (doesn't increment counter)
    try {
      const previewNumber = await invoiceService.previewInvoiceNumber(selectedCompany?.id);
      setGeneratedInvoiceNumber(previewNumber);
    } catch (error) {
      console.error('Failed to preview invoice number:', error);
      setGeneratedInvoiceNumber('INV-PREVIEW');
    }
    
    setInvoiceFormData({
      customer_id: '',
      invoice_date: today,
      due_date: dueDate.toISOString().split('T')[0],
      notes: '',
      terms_conditions: defaultTermsContent,
      // International banking - populated when customer is selected
      intl_account_name: '',
      intl_account_number: '',
      intl_account_type: '',
      intl_routing_number: '',
      intl_swift_bic: '',
      intl_bank_address: '',
      intl_iban: '',
      intl_sort_code: '',
      items: [{
        product_id: undefined,
        item_name: '',
        description: '',
        quantity: 1,
        unit: 'pcs',
        unit_price: 0,
        tax_rate: 18,
        hsn_code: undefined
      }]
    });
    
    console.log('✅ Create invoice tab initialized with:', {
      invoiceNumber: generatedInvoiceNumber,
      defaultTerms: defaultTermsContent,
      invoiceDate: today,
      dueDate: dueDate.toISOString().split('T')[0]
    });
  };

  const closeInvoiceModal = () => {
    setShowInvoiceModal(false);
    setSelectedInvoice(null);
    setSelectedDefaultProduct('');
    setSelectedTermsTemplateId('');
    setGeneratedInvoiceNumber('');
    setShowInvoicePreview(false);
    setModalLoading(false);
    setUseINROverride(false);
  };

  const handleShowPreview = () => {
    // Clear any existing selected invoice to ensure we're in "creation preview" mode
    setSelectedInvoice(null);
    setShowInvoicePreview(true);
  };

  // Helper: returns Wise banking defaults for the given currency code (non-INR)
  const getIntlBankingDefaults = (currencyCode: string): Partial<CreateInvoiceData> => {
    const defaults: Partial<CreateInvoiceData> = {
      intl_account_name: '',
      intl_account_number: '',
      intl_account_type: '',
      intl_routing_number: '',
      intl_swift_bic: '',
      intl_bank_address: '',
      intl_iban: '',
      intl_sort_code: ''
    };
    if (currencyCode === 'EUR') {
      defaults.intl_account_name = 'Kdadks';
      defaults.intl_iban         = 'BE93905254252767';
      defaults.intl_swift_bic    = 'TRWIBEB1XXX';
      defaults.intl_bank_address = 'Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium';
    } else if (currencyCode === 'GBP') {
      defaults.intl_account_name   = 'Kdadks';
      defaults.intl_iban           = 'GB43TRWI60846460921788';
      defaults.intl_account_number = '60921788';
      defaults.intl_sort_code      = '608464';
      defaults.intl_swift_bic      = 'TRWIGB2LXXX';
      defaults.intl_bank_address   = 'Wise Payments Limited, Worship Square, 65 Clifton Street, London, EC2A 4JE, United Kingdom';
    } else if (currencyCode === 'USD') {
      defaults.intl_account_name   = 'Kdadks';
      defaults.intl_account_number = '218404409881';
      defaults.intl_account_type   = 'Checking';
      defaults.intl_routing_number = '101019628';
      defaults.intl_swift_bic      = 'TRWIUS35XXX';
      defaults.intl_bank_address   = 'Wise US Inc, 108 W 13th St, Wilmington, DE, 19801, United States';
    }
    return defaults;
  };

  // Helper: backfill empty intl_* fields on an invoice/form-data shape using currency-based defaults.
  // Returns a copy with defaults applied only where existing values are empty/missing.
  const applyIntlBankingFallback = <T extends Record<string, unknown>>(data: T, currencyCode: string): T => {
    if (!currencyCode || currencyCode === 'INR') return data;
    const defaults = getIntlBankingDefaults(currencyCode);
    const out: Record<string, unknown> = { ...data };
    (Object.keys(defaults) as (keyof CreateInvoiceData)[]).forEach((key) => {
      const cur = out[key as string];
      if (cur === undefined || cur === null || cur === '') {
        out[key as string] = defaults[key] ?? '';
      }
    });
    return out as T;
  };

  const handleInvoiceFormChange = (field: keyof CreateInvoiceData, value: string | CreateInvoiceItemData[]) => {
    if (field === 'customer_id') {
      console.log('👤 Customer selection changed:', {
        oldCustomerId: invoiceFormData.customer_id,
        newCustomerId: value,
        timestamp: new Date().toISOString()
      });

      // Reset INR override when customer changes
      setUseINROverride(false);

      // Auto-populate intl banking defaults based on the selected customer's currency
      const selectedCustomer = customers.find(c => c.id === value);
      const currencyCode = getCurrencyInfo(selectedCustomer).code;
      const intlDefaults = currencyCode !== 'INR' ? getIntlBankingDefaults(currencyCode) : {};

      setInvoiceFormData(prev => ({
        ...prev,
        customer_id: value as string,
        ...intlDefaults
      }));
      return;
    }
    
    setInvoiceFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleInvoiceItemChange = (index: number, field: keyof CreateInvoiceItemData, value: string | number | boolean | undefined) => {
    // Debug product_id changes specifically
    if (field === 'product_id') {
      console.log(`🔄 Setting product_id for item ${index + 1}:`, {
        field,
        value,
        type: typeof value,
        isUndefined: value === undefined,
        isNull: value === null,
        isEmpty: value === ''
      });
    }

    setInvoiceFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };

          // Debug the complete updated item for product_id changes
          if (field === 'product_id') {
            console.log(`📝 Updated item ${index + 1} after product_id change:`, {
              product_id: updatedItem.product_id,
              item_name: updatedItem.item_name,
              description: updatedItem.description
            });
          }
          
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const addInvoiceItem = () => {
    console.log('➕ Adding new line item with current state:', {
      selectedDefaultProduct,
      globalHsnCode,
      hasSelectedProduct: !!selectedDefaultProduct,
      hasGlobalHsn: !!globalHsnCode,
      currentItems: invoiceFormData.items.length
    });

    // Get selected customer to determine appropriate tax rate
    const selectedCustomer = customers.find(c => c.id === invoiceFormData.customer_id);
    const defaultTaxRate = getDefaultTaxRate(selectedCustomer);

    const newItem = {
      product_id: selectedDefaultProduct || undefined, // Apply global product_id to new items
      item_name: '',
      description: '',
      quantity: 1,
      unit: 'pcs',
      unit_price: 0,
      tax_rate: defaultTaxRate,
      hsn_code: globalHsnCode || undefined // Apply global HSN code to new items
    };

    console.log('📦 New item created with country-specific tax rate:', {
      ...newItem,
      customerCountry: selectedCustomer?.country?.name || 'Unknown',
      taxLabel: getTaxLabel(selectedCustomer)
    });

    setInvoiceFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    
    console.log('✅ Added new line item with global product_id:', {
      productId: selectedDefaultProduct || 'None',
      hsnCode: globalHsnCode || 'None',
      totalItems: invoiceFormData.items.length + 1
    });
  };

  const removeInvoiceItem = (index: number) => {
    if (invoiceFormData.items.length > 1) {
      setInvoiceFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const calculateInvoiceTotals = () => {
    let subtotal = 0;
    let totalTax = 0;

    invoiceFormData.items.forEach(item => {
      let lineTotal = 0;

      // For service-based items: resource_count × quantity (months) × billable_hours × unit_price (rate/hour)
      if (item.is_service_item && item.billable_hours) {
        const resourceCount = item.resource_count || 1;
        lineTotal = resourceCount * item.quantity * item.billable_hours * item.unit_price;
      } else {
        // For product-based items: quantity × unit_price
        lineTotal = item.quantity * item.unit_price;
      }

      const taxAmount = (lineTotal * item.tax_rate) / 100;
      subtotal += lineTotal;
      totalTax += taxAmount;
    });

    // Calculate discount
    let discountAmount = 0;
    if (invoiceFormData.discount_type && invoiceFormData.discount_value) {
      const discountValue = Number(invoiceFormData.discount_value);
      if (invoiceFormData.discount_type === 'percentage') {
        discountAmount = (subtotal * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }
    }

    // Recalculate tax on discounted subtotal
    const discountedSubtotal = subtotal - discountAmount;
    const averageTaxRate = totalTax > 0 && subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
    const adjustedTaxAmount = (discountedSubtotal * averageTaxRate) / 100;

    return {
      subtotal,
      discountAmount,
      taxAmount: adjustedTaxAmount,
      total: discountedSubtotal + adjustedTaxAmount
    };
  };

  // Convert number to words (Indian system)
  const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const convertHundreds = (n: number): string => {
      let result = '';
      
      if (n >= 100) {
        result += ones[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      
      if (n >= 20) {
        result += tens[Math.floor(n / 10)] + ' ';
        n %= 10;
      } else if (n >= 10) {
        result += teens[n - 10] + ' ';
        return result;
      }
      
      if (n > 0) {
        result += ones[n] + ' ';
      }
      
      return result;
    };

    const crores = Math.floor(num / 10000000);
    num %= 10000000;
    const lakhs = Math.floor(num / 100000);
    num %= 100000;
    const thousands = Math.floor(num / 1000);
    num %= 1000;
    const hundreds = num;

    let result = '';
    if (crores > 0) result += convertHundreds(crores) + ' Crore ';
    if (lakhs > 0) result += convertHundreds(lakhs) + ' Lakh ';
    if (thousands > 0) result += convertHundreds(thousands) + ' Thousand ';
    if (hundreds > 0) result += convertHundreds(hundreds);

    return result.trim();
  };

  const formatAmountInWords = (amount: number, currencyName: string = 'Rupees'): string => {
    const integerPart = Math.floor(amount);
    const decimalPart = Math.round((amount - integerPart) * 100);
    
    let result = numberToWords(integerPart).trim() + ' ' + currencyName;
    if (decimalPart > 0) {
      result += ' and ' + numberToWords(decimalPart).trim() + ' Paise';
    }
    result += ' Only';
    return result.replace(/\s+/g, ' ').trim(); // Remove extra spaces
  };

  const getCurrencyInfo = (customer: Customer | undefined) => {
    console.log('🔍 getCurrencyInfo called with customer:', {
      customer: customer ? {
        id: customer.id,
        name: customer.company_name || customer.contact_person,
        country_id: customer.country_id,
        country: customer.country
      } : null
    });

    const customerCountry = customer?.country;
    console.log('🌍 Customer country details:', {
      hasCountry: !!customerCountry,
      countryCode: customerCountry?.code,
      currencyCode: customerCountry?.currency_code,
      currencySymbol: customerCountry?.currency_symbol,
      currencyName: customerCountry?.currency_name
    });

    if (customerCountry && customerCountry.currency_symbol && customerCountry.currency_code) {
      // Use the currency information from the customer's country
      console.log('✅ Using country currency data:', customerCountry);
      return {
        symbol: customerCountry.currency_symbol,
        name: customerCountry.currency_name || 'Currency',
        code: customerCountry.currency_code
      };
    }
    
    // Fallback to hardcoded currencies based on country code if country data doesn't have currency info
    if (customerCountry) {
      console.log('⚠️ Using fallback currency for country code:', customerCountry.code);
      switch (customerCountry.code) {
        case 'IND':
          return { symbol: '₹', name: 'Rupees', code: 'INR' };
        case 'USA':
          return { symbol: '$', name: 'Dollars', code: 'USD' };
        case 'GBR':
        case 'GB':
        case 'UK':
          return { symbol: '£', name: 'Pounds', code: 'GBP' };
        case 'DEU':
        case 'FRA':
        case 'ITA':
        case 'ESP':
        case 'NLD':
          return { symbol: '€', name: 'Euros', code: 'EUR' };
        default:
          break;
      }
    }
    
    // Default to Indian Rupee
    console.log('🔄 Using default currency (INR) - no country found or no currency data');
    return {
      symbol: '₹',
      name: 'Rupees',
      code: 'INR'
    };
  };

  const formatCurrencyAmount = (amount: number, currencyInfo: { symbol: string; code: string }) => {
    // Use clean number formatting to prevent any Unicode spacing issues
    const roundedAmount = Math.round(amount * 100) / 100;
    const formattedNumber = roundedAmount.toFixed(2);
    return currencyInfo.symbol + ' ' + formattedNumber;
  };

   const handleGenerateDraftInvoices = async () => {
     const confirmed = await confirm({
       title: 'Generate Draft Invoices',
       message: 'Generate draft invoices for all due subscriptions?',
       confirmText: 'Generate',
       type: 'info',
     });
     if (!confirmed) return;
     startAction('Generating draft invoices…');
     try {
       const invoices = await invoiceService.generateDraftInvoicesFromSubscriptions();
       showSuccess(`${invoices.length} draft invoice(s) generated successfully!`);
       loadData();
     } catch (err) {
       showError(`Failed to generate draft invoices: ${err instanceof Error ? err.message : 'Unknown error'}`);
     } finally {
       endAction();
     }
   };

   const handleSaveInvoice = async () => {
    try {
      setModalLoading(true);
      
      // Enhanced validation for all required fields
      console.log('🔍 Starting invoice validation:', {
        customer_id: invoiceFormData.customer_id,
        invoice_date: invoiceFormData.invoice_date,
        items_count: invoiceFormData.items.length
      });
      
      // Validate customer selection
      if (!invoiceFormData.customer_id || invoiceFormData.customer_id.trim() === '') {
        showError('Customer is required. Please select a customer from the dropdown.');
        return;
      }
      
      // Validate invoice date
      if (!invoiceFormData.invoice_date || invoiceFormData.invoice_date.trim() === '') {
        showError('Invoice date is required. Please select an invoice date.');
        return;
      }
      
      // Validate invoice date is not in the future (optional business rule)
      const invoiceDate = new Date(invoiceFormData.invoice_date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of day for comparison
      if (invoiceDate > today) {
        showError('Invoice date cannot be in the future. Please select a valid date.');
        return;
      }
      
      // Validate due date if provided
      if (invoiceFormData.due_date && invoiceFormData.due_date.trim() !== '') {
        const dueDate = new Date(invoiceFormData.due_date);
        if (dueDate < invoiceDate) {
          showError('Due date cannot be earlier than invoice date. Please select a valid due date.');
          return;
        }
      }
      
      // Validate at least one line item exists
      if (!invoiceFormData.items || invoiceFormData.items.length === 0) {
        showError('At least one line item is required. Please add items to the invoice.');
        return;
      }
      
      // Count valid items (items with any content)
      let validItemsCount = 0;
      let hasCompleteItems = false;
      
      // Validate all items have required fields (skip completely empty items)
      for (let i = 0; i < invoiceFormData.items.length; i++) {
        const item = invoiceFormData.items[i];
        
        // Skip validation for completely empty items (newly added but not filled)
        // An empty item has: no item_name, no description, quantity=1, unit_price=0
        // Also check if user has started filling any field
        const hasAnyContent = item.item_name || item.description || item.quantity !== 1 || item.unit_price !== 0 || (item.unit && item.unit !== 'pcs');
        
        if (!hasAnyContent) {
          console.log(`⏭️ Skipping validation for completely empty item ${i + 1}:`, item);
          continue; // Skip validation for empty items
        }
        
        validItemsCount++;
        console.log(`✅ Validating item ${i + 1} with content:`, item);
        
        // Validate item name
        if (!item.item_name || item.item_name.trim() === '') {
          showError(`Item ${i + 1}: Item name is required. Please enter an item name.`);
          return;
        }
        
        // Validate description
        if (!item.description || item.description.trim() === '') {
          showError(`Item ${i + 1}: Description is required. Please enter an item description.`);
          return;
        }
        
        // Validate quantity
        if (!item.quantity || item.quantity <= 0) {
          showError(`Item ${i + 1}: Quantity must be greater than 0. Please enter a valid quantity.`);
          return;
        }
        
        // Validate unit price
        if (item.unit_price < 0) {
          showError(`Item ${i + 1}: Unit price cannot be negative. Please enter a valid price.`);
          return;
        }
        
        // Validate tax rate
        if (item.tax_rate < 0 || item.tax_rate > 100) {
          showError(`Item ${i + 1}: Tax rate must be between 0% and 100%. Please enter a valid tax rate.`);
          return;
        }
        
        // Check if this item is complete
        if (item.item_name && item.description && item.quantity > 0 && item.unit_price >= 0) {
          hasCompleteItems = true;
        }
      }
      
      // Ensure at least one complete item exists
      if (validItemsCount === 0 || !hasCompleteItems) {
        showError('At least one complete line item is required. Please fill in item name, description, quantity, and price for at least one item.');
        return;
      }
      
      console.log(`✅ Validation passed with ${validItemsCount} valid items`);
      
      console.log('💾 Saving invoice with validated data:', {
        totalItems: invoiceFormData.items.length,
        items: invoiceFormData.items.map((item, index) => ({
          index: index + 1,
          product_id: item.product_id || 'No product selected',
          item_name: item.item_name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          hsn_code: item.hsn_code || 'No HSN'
        }))
      });
      
      // Filter out any empty line items before saving, but preserve product_id even if undefined
      const validItems = invoiceFormData.items.filter(item => 
        item.item_name && item.description && item.quantity > 0 && item.unit_price >= 0
      ).map(item => ({
        // Ensure all fields are properly preserved including optional product_id
        product_id: item.product_id || undefined, // Explicitly handle undefined
        item_name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        hsn_code: item.hsn_code || undefined // Explicitly handle undefined
      }));
      
      if (validItems.length === 0) {
        showError('No valid line items found. Please add at least one complete item.');
        return;
      }
      
      console.log('📋 Valid items after filtering and mapping:', {
        count: validItems.length,
        totalOriginal: invoiceFormData.items.length,
        items: validItems.map((item, index) => ({
          index: index + 1,
          product_id: item.product_id || 'UNDEFINED/NULL',
          item_name: item.item_name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          hsn_code: item.hsn_code || 'UNDEFINED/NULL'
        }))
      });
      
      console.log('💾 Saving invoice:', invoiceFormData);
      
      if (invoiceModalMode === 'add' || activeTab === 'create-invoice') {
        // For new invoices, generate and reserve the final invoice number when ready to save
        let finalInvoiceNumber: string;
        let attempts = 0;
        const maxAttempts = 10; // Prevent infinite loops
        
        while (attempts < maxAttempts) {
          try {
            // Generate and reserve the invoice number in the database
            finalInvoiceNumber = await invoiceService.generateInvoiceNumber(selectedCompany?.id);
            console.log(`🔢 Generated and reserved invoice number attempt ${attempts + 1}:`, finalInvoiceNumber);
            
            // Check if this invoice number already exists in the database
            const existingInvoices = await invoiceService.getInvoices({ search: finalInvoiceNumber }, 1, 1);
            const exactMatch = existingInvoices.data.find(invoice => 
              invoice.invoice_number === finalInvoiceNumber
            );
            
            if (!exactMatch) {
              // Invoice number is unique, we can proceed
              console.log('✅ Invoice number is unique and reserved:', finalInvoiceNumber);
              break;
            } else {
              console.log('⚠️ Invoice number already exists (rare collision), generating new one:', finalInvoiceNumber);
              attempts++;
              
              if (attempts >= maxAttempts) {
                throw new Error(`Unable to generate unique invoice number after ${maxAttempts} attempts`);
              }
              
              // Continue loop to generate another number
            }
          } catch (numberError) {
            console.error('❌ Error during invoice number generation/validation:', numberError);
            if (attempts >= maxAttempts - 1) {
              throw numberError;
            }
            attempts++;
            // Continue loop to try again
          }
        }
        
        // Update the displayed invoice number for user feedback
        setGeneratedInvoiceNumber(finalInvoiceNumber!);
        
        // Create invoice with the reserved invoice number
        const finalInvoiceData = {
          ...invoiceFormData,
          items: validItems, // Use only valid items
          // Apply INR override if toggled on for a foreign customer
          currency_code_override: useINROverride ? 'INR' : undefined
        };
        
        console.log('💾 Saving invoice with data:', {
          invoiceNumber: finalInvoiceNumber!,
          customerId: finalInvoiceData.customer_id,
          itemsCount: finalInvoiceData.items.length,
          items: finalInvoiceData.items.map(item => ({
            product_id: item.product_id,
            item_name: item.item_name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            hsn_code: item.hsn_code
          }))
        });
        
        // Pass the invoice data and reserved invoice number to the service
        await invoiceService.createInvoice(finalInvoiceData, finalInvoiceNumber!, selectedCompany?.id);
        console.log('💾 Invoice saved successfully with final number:', finalInvoiceNumber!);
        showSuccess(`Invoice ${finalInvoiceNumber!} created successfully!`);
        goToTab('invoices'); // Switch to invoices tab after creation
      } else if (invoiceModalMode === 'edit' && selectedInvoice) {
        // For edit mode, check invoice status to determine action
        if (selectedInvoice.status === 'draft') {
          // For draft invoices, update the existing invoice
          console.log('📝 Updating draft invoice:', selectedInvoice.invoice_number);
          
          // Prepare update data with line items - using Partial<CreateInvoiceData> to match service
          const updateData: Partial<CreateInvoiceData> = {
            customer_id: invoiceFormData.customer_id,
            invoice_date: invoiceFormData.invoice_date,
            due_date: invoiceFormData.due_date,
            notes: invoiceFormData.notes,
            terms_conditions: invoiceFormData.terms_conditions,
            currency_code_override: useINROverride ? 'INR' : undefined,
            items: validItems // Use the filtered and validated items
          };
          
          await invoiceService.updateInvoice(selectedInvoice.id, updateData);
          console.log('✅ Draft invoice updated successfully');
          showSuccess(`Draft invoice ${selectedInvoice.invoice_number} updated successfully!`);
          
        } else if (selectedInvoice.status === 'sent') {
          // For sent invoices, create a new invoice (revision)
          console.log('📄 Creating new invoice revision for sent invoice:', selectedInvoice.invoice_number);
          
          // Generate new invoice number for the revision
          const newInvoiceNumber = await invoiceService.generateInvoiceNumber(selectedCompany?.id);
          console.log('🔢 Generated new invoice number for revision:', newInvoiceNumber);
          
          // Prepare new invoice data (service will calculate totals and set status)
          const revisionInvoiceData: CreateInvoiceData = {
            customer_id: invoiceFormData.customer_id,
            invoice_date: invoiceFormData.invoice_date,
            due_date: invoiceFormData.due_date,
            notes: invoiceFormData.notes,
            terms_conditions: invoiceFormData.terms_conditions,
            currency_code_override: useINROverride ? 'INR' : undefined,
            items: invoiceFormData.items.map(item => ({
              product_id: item.product_id,
              item_name: item.item_name,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              hsn_code: item.hsn_code
            }))
          };
          
          // Create new invoice
          await invoiceService.createInvoice(revisionInvoiceData, newInvoiceNumber, selectedCompany?.id);
          console.log('💾 New invoice revision created successfully:', newInvoiceNumber);
          showSuccess(`New invoice ${newInvoiceNumber} created as revision of ${selectedInvoice.invoice_number}!`);
          
        } else {
          // For other statuses (paid, overdue, cancelled), show warning
          showWarning(`Cannot edit invoice with status: ${selectedInvoice.status}. Only draft and sent invoices can be edited.`);
          return;
        }
      }
      
      closeInvoiceModal();
      await loadData(); // Refresh the data
    } catch (error) {
      console.error('❌ Failed to save invoice:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
        invoiceModalMode,
        selectedInvoice: selectedInvoice?.id,
        formData: invoiceFormData,
        fullError: error
      });
      
      // Provide specific, user-friendly error messages
      let errorMessage = 'Failed to save invoice due to an unexpected error.';
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('duplicate key') || errorMsg.includes('already exists')) {
          errorMessage = 'This invoice number already exists. Please try again with a different invoice number.';
        } else if (errorMsg.includes('foreign key') || errorMsg.includes('invalid customer')) {
          errorMessage = 'Invalid customer selected. Please select a valid customer from the dropdown.';
        } else if (errorMsg.includes('check constraint') || errorMsg.includes('invalid data')) {
          errorMessage = 'Some data values are invalid. Please check all fields and ensure they contain valid information.';
        } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
          errorMessage = 'Network connection error. Please check your internet connection and try again.';
        } else if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
          errorMessage = 'You do not have permission to perform this action. Please contact your administrator.';
        } else if (errorMsg.includes('timeout')) {
          errorMessage = 'The request timed out. Please try again in a moment.';
        } else if (errorMsg.includes('validation') || errorMsg.includes('required')) {
          errorMessage = `Validation error: ${error.message}`;
        } else if (errorMsg.includes('not found')) {
          errorMessage = 'The invoice or related data could not be found. Please refresh the page and try again.';
        } else {
          // For other errors, show a more informative message
          errorMessage = `Unable to save invoice: ${error.message}. Please check your data and try again.`;
        }
      }
      
      showError(errorMessage);
    } finally {
      setModalLoading(false);
    }
  };

  // Product Selection Functions
  const handleDefaultProductChange = (productId: string) => {
    console.log('🛒 Global product selection changed:', { 
      productId, 
      availableProducts: products.length,
      previousSelection: selectedDefaultProduct,
      previousGlobalHsn: globalHsnCode
    });
    setSelectedDefaultProduct(productId);
    
    if (productId) {
      const product = products.find(p => p.id === productId);
      console.log('📦 Selected global product details:', {
        product,
        hasHsnCode: !!product?.hsn_code,
        hsnCodeValue: product?.hsn_code
      });
      if (product) {
        // Set global HSN code for all line items
        const hsnCode = product.hsn_code || '';
        setGlobalHsnCode(hsnCode);
        
        console.log('🔧 Setting global values:', {
          productId: product.id,
          hsnCode,
          willApplyToItems: invoiceFormData.items.length
        });
        
        // Apply product_id and HSN code to ALL line items (like a global setting)
        const updatedItems = invoiceFormData.items.map(item => ({
          ...item,
          product_id: product.id, // Apply same product_id to all line items
          hsn_code: hsnCode       // Apply same HSN code to all line items
        }));
        
        console.log('✅ Applied global product_id and HSN code to all line items:', {
          productId: product.id,
          hsnCode,
          totalItems: updatedItems.length
        });
        
        setInvoiceFormData(prev => ({
          ...prev,
          items: updatedItems
        }));
      }
    } else {
      // Clear global HSN code and product_id when no product is selected
      setGlobalHsnCode('');
      
      // Remove product_id from all line items
      const updatedItems = invoiceFormData.items.map(item => ({
        ...item,
        product_id: undefined,
        hsn_code: undefined
      }));
      
      console.log('🧹 Cleared global product_id and HSN code from all line items');
      
      setInvoiceFormData(prev => ({
        ...prev,
        items: updatedItems
      }));
    }
  };

  // Terms Template Functions
  const handleTermsChange = (termsContent: string) => {
    setInvoiceFormData(prev => ({
      ...prev,
      terms_conditions: termsContent
    }));
  };

  const handleTermsTemplateSelect = (templateId: string) => {
    setSelectedTermsTemplateId(templateId);
    const template = termsTemplates.find(t => t.id === templateId);
    if (template) {
      handleTermsChange(template.content);
    }
  };

  // Delete functions
  const handleDeleteInvoice = async (invoice: Invoice) => {
    const confirmed = await confirm({
      title: 'Delete Invoice',
      message: `Are you sure you want to delete invoice "${invoice.invoice_number}"?\n\nThis action will mark the invoice as deleted but preserve it in the database for audit purposes. The invoice will no longer appear in regular lists but can be recovered if needed.`,
      confirmText: 'Delete',
      type: 'danger'
    });
    
    if (confirmed) {
      startAction('Deleting invoice…');
      try {
        await invoiceService.deleteInvoice(invoice.id);
        showSuccess('Invoice deleted successfully!');
        await loadData();
      } catch (error) {
        console.error('Failed to delete invoice:', error);
        showError(`Failed to delete invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        endAction();
      }
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    try {
      // Load full invoice details
      const fullInvoice = await invoiceService.getInvoiceById(invoice.id);
      if (fullInvoice) {
        // Backfill intl_* on the loaded invoice for legacy non-INR invoices
        // so view/PDF rendering shows banking details even if DB row was empty.
        const viewCustomer = customers.find(c => c.id === fullInvoice.customer_id);
        const viewCurrency = getCurrencyInfo(viewCustomer).code;
        const filledInvoice = applyIntlBankingFallback(fullInvoice as unknown as Record<string, unknown>, viewCurrency) as unknown as typeof fullInvoice;
        setSelectedInvoice(filledInvoice);
        setInvoiceFormData({
          customer_id: filledInvoice.customer_id,
          invoice_date: filledInvoice.invoice_date,
          due_date: filledInvoice.due_date || '',
          notes: filledInvoice.notes || '',
          terms_conditions: filledInvoice.terms_conditions || '',
          project_title: filledInvoice.project_title || '',
          estimated_time: filledInvoice.estimated_time || '',
          company_contact_name: filledInvoice.company_contact_name || '',
          company_contact_email: filledInvoice.company_contact_email || '',
          company_contact_phone: filledInvoice.company_contact_phone || '',
          discount_type: filledInvoice.discount_type || 'percentage',
          discount_value: filledInvoice.discount_value || 0,
          intl_account_name: filledInvoice.intl_account_name || '',
          intl_account_number: filledInvoice.intl_account_number || '',
          intl_account_type: filledInvoice.intl_account_type || '',
          intl_routing_number: filledInvoice.intl_routing_number || '',
          intl_swift_bic: filledInvoice.intl_swift_bic || '',
          intl_bank_address: filledInvoice.intl_bank_address || '',
          intl_iban: filledInvoice.intl_iban || '',
          intl_sort_code: filledInvoice.intl_sort_code || '',
          items: filledInvoice.invoice_items?.map(item => ({
            product_id: item.product_id,
            item_name: item.item_name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            hsn_code: item.hsn_code
          })) || []
        });
        setGeneratedInvoiceNumber(fullInvoice.invoice_number);
        // Restore INR override: invoice was billed in INR but customer's native currency is foreign
        setUseINROverride(filledInvoice.currency_code === 'INR' && viewCurrency !== 'INR');
        
        // Only show preview modal for viewing - no edit modal
        setInvoiceModalMode('view');
        setShowInvoicePreview(true);
        // Ensure the edit modal is closed
        setShowInvoiceModal(false);
      }
    } catch (error) {
      console.error('Failed to load invoice details:', error);
      showError(`Failed to load invoice details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEditInvoice = async (invoice: Invoice) => {
    console.log('🔧 handleEditInvoice called with invoice:', invoice);
    try {
      // Load full invoice details
      const fullInvoice = await invoiceService.getInvoiceById(invoice.id);
      console.log('📄 Full invoice loaded:', fullInvoice);
      
      if (fullInvoice) {
        setSelectedInvoice(fullInvoice);
        
        // Map invoice items to form data format
        const mappedItems = fullInvoice.invoice_items?.map(item => ({
          product_id: item.product_id,
          item_name: item.item_name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          hsn_code: item.hsn_code
        })) || [];
        
        console.log('🛒 Mapped items for editing:', mappedItems);
        console.log('📊 Invoice status:', fullInvoice.status);
        console.log('📊 Original invoice_items:', fullInvoice.invoice_items);
        
        // Ensure we have at least one item for editing
        const itemsForForm = mappedItems.length > 0 ? mappedItems : [{
          product_id: undefined,
          item_name: '',
          description: '',
          quantity: 1,
          unit: 'pcs',
          unit_price: 0,
          tax_rate: 18,
          hsn_code: undefined
        }];
        
        console.log('📝 Final items for form:', itemsForForm);
        
        // Backfill intl_* defaults for non-INR currencies so admin can edit the
        // banking section pre-populated for legacy invoices missing these fields.
        const editCustomer = customers.find(c => c.id === fullInvoice.customer_id);
        const editCurrency = getCurrencyInfo(editCustomer).code;
        const intlSource = applyIntlBankingFallback(
          {
            intl_account_name: fullInvoice.intl_account_name || '',
            intl_account_number: fullInvoice.intl_account_number || '',
            intl_account_type: fullInvoice.intl_account_type || '',
            intl_routing_number: fullInvoice.intl_routing_number || '',
            intl_swift_bic: fullInvoice.intl_swift_bic || '',
            intl_bank_address: fullInvoice.intl_bank_address || '',
            intl_iban: fullInvoice.intl_iban || '',
            intl_sort_code: fullInvoice.intl_sort_code || ''
          },
          editCurrency
        );

        const formData = {
          customer_id: fullInvoice.customer_id,
          invoice_date: fullInvoice.invoice_date,
          due_date: fullInvoice.due_date || '',
          notes: fullInvoice.notes || '',
          terms_conditions: fullInvoice.terms_conditions || '',
          project_title: fullInvoice.project_title || '',
          estimated_time: fullInvoice.estimated_time || '',
          company_contact_name: fullInvoice.company_contact_name || '',
          company_contact_email: fullInvoice.company_contact_email || '',
          company_contact_phone: fullInvoice.company_contact_phone || '',
          discount_type: fullInvoice.discount_type || 'percentage',
          discount_value: fullInvoice.discount_value || 0,
          ...intlSource,
          items: itemsForForm
        };
        
        console.log('📝 Setting form data for editing:', formData);
        setInvoiceFormData(formData);
        setGeneratedInvoiceNumber(fullInvoice.invoice_number);
        // Restore INR override: invoice was billed in INR but customer's native currency is foreign
        setUseINROverride(fullInvoice.currency_code === 'INR' && editCurrency !== 'INR');
        
        // Set default product and HSN code for new items based on existing items
        if (itemsForForm.length > 0) {
          // Check if all items have the same product_id
          const firstProductId = itemsForForm[0].product_id;
          const allSameProduct = itemsForForm.every(item => item.product_id === firstProductId);
          
          if (allSameProduct && firstProductId) {
            console.log('📦 Setting default product for edit mode:', firstProductId);
            setSelectedDefaultProduct(firstProductId);
          }
          
          // Check if all items have the same HSN code
          const firstHsnCode = itemsForForm[0].hsn_code;
          const allSameHsn = itemsForForm.every(item => item.hsn_code === firstHsnCode);
          
          if (allSameHsn && firstHsnCode) {
            console.log('🏷️ Setting global HSN code for edit mode:', firstHsnCode);
            setGlobalHsnCode(firstHsnCode);
          }
        }
        
        // Open edit modal instead of switching tabs
        setInvoiceModalMode('edit');
        setShowInvoiceModal(true);
        
        // Ensure customers, products, and terms are loaded for editing
        await ensureDataLoadedForEdit();
      }
    } catch (error) {
      console.error('Failed to load invoice details:', error);
      showError(`Failed to load invoice details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Helper function to ensure data is loaded for editing
  const ensureDataLoadedForEdit = async () => {
    try {
      if (customers.length === 0 || products.length === 0 || termsTemplates.length === 0) {
        const [customersData, productsData, termsData] = await Promise.all([
          customers.length === 0 ? invoiceService.getCustomers({}, 1, 1000) : Promise.resolve({ data: customers }),
          products.length === 0 ? invoiceService.getProducts({}, 1, 1000) : Promise.resolve({ data: products }),
          termsTemplates.length === 0 ? invoiceService.getTermsTemplates() : Promise.resolve(termsTemplates)
        ]);
        
        if (customers.length === 0) setCustomers(customersData.data || []);
        if (products.length === 0) setProducts(productsData.data || []);
        if (termsTemplates.length === 0) setTermsTemplates(termsData || []);
      }
    } catch (error) {
      console.warn('Failed to load data for editing:', error);
    }
  };

  // Helper to load QR code image for invoice PDFs (preserves original aspect ratio)
  const loadQRCodeImage = async (): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = '/bankqrcode.jpg';
      });
      if (!loaded) return null;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.95),
        width: img.naturalWidth,
        height: img.naturalHeight
      };
    } catch {
      console.warn('Failed to load bank QR code image');
      return null;
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      // Load full invoice details first
      const fullInvoiceRaw = await invoiceService.getInvoiceById(invoice.id);
      if (!fullInvoiceRaw) {
        showError('Invoice not found');
        return;
      }
      // Backfill intl_* banking defaults for legacy non-INR invoices so PDF renders banking section
      const dlCustomer = customers.find(c => c.id === fullInvoiceRaw.customer_id);
      const dlCurrency = getCurrencyInfo(dlCustomer).code;
      const fullInvoice = applyIntlBankingFallback(fullInvoiceRaw as unknown as Record<string, unknown>, dlCurrency) as unknown as typeof fullInvoiceRaw;

      // Get company settings - prefer the invoice's own company, then selected, then default, then first
      const company = fullInvoice.company_settings || selectedCompany || companySettings.find(c => c.is_default) || companySettings[0];
      if (!company) {
        showError('No company settings found. Please go to Settings and configure your company information first, then try again.');
        navigate('/admin/settings');
        return;
      }

      // Get customer details
      let currentCustomers = customers;
      if (customers.length === 0) {
        try {
          currentCustomers = await ensureCustomersLoaded();
        } catch (error) {
          showError('Failed to load customer data for PDF generation');
          return;
        }
      }
      
      const customer = currentCustomers.find(c => c.id === fullInvoice.customer_id);
      if (!customer) {
        showError('Customer details not found for PDF generation');
        return;
      }

      // Calculate totals
      const subtotal = fullInvoice.invoice_items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0;
      const totalTax = fullInvoice.invoice_items?.reduce((sum, item) => sum + (item.quantity * item.unit_price * item.tax_rate / 100), 0) || 0;
      const total = subtotal + totalTax;

      // Get currency info for the customer
      const selectedCustomer = currentCustomers.find(c => c.id === fullInvoice.customer_id);
      const nativeCurrencyInfo = getCurrencyInfo(selectedCustomer);
      // Honor INR override: if invoice was saved with INR currency but customer's native currency is foreign
      const currencyInfo = (fullInvoice.currency_code === 'INR' && nativeCurrencyInfo.code !== 'INR')
        ? { symbol: '₹', code: 'INR', name: 'Rupees' }
        : nativeCurrencyInfo;
      
      // Get dynamic tax label based on customer's country
      const taxLabel = getTaxLabel(selectedCustomer);
      
      console.log('💰 Currency info for PDF generation:', {
        customer: selectedCustomer ? {
          id: selectedCustomer.id,
          name: selectedCustomer.company_name || selectedCustomer.contact_person,
          country_id: selectedCustomer.country_id
        } : 'Not found',
        currencyInfo: currencyInfo,
        symbol: currencyInfo.symbol,
        name: currencyInfo.name,
        code: currencyInfo.code
      });

      // Create PDF using the MOST BASIC configuration to avoid ALL encoding issues
      const downloadPdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
        // Remove ALL optional configuration that might cause issues
      });
      
      // Use ONLY the most basic font without any variations that might trigger Unicode
      downloadPdf.setFont('helvetica');
      
      // Get PDF dimensions for branding
      const dimensions = PDFBrandingUtils.getStandardDimensions();
      
      // Apply branding images (header, footer, logo)
      const { contentStartY, contentEndY } = await PDFBrandingUtils.applyBranding(
        downloadPdf, 
        company, 
        dimensions
      );
      
      // Create branded header section
      let yPos = PDFBrandingUtils.createBrandedHeader(
        downloadPdf,
        company,
        String(fullInvoice.invoice_number),
        String(new Date(fullInvoice.invoice_date).toLocaleDateString()),
        String(fullInvoice.due_date ? new Date(fullInvoice.due_date).toLocaleDateString() : 'N/A'),
        dimensions,
        contentStartY
      );
      
      // Extract dimensions for use throughout the function
      const leftMargin = dimensions.leftMargin;
      const rightMargin = dimensions.rightMargin;
      
      // Company and Customer Information Section - Two columns with aligned starting positions
      downloadPdf.setTextColor(0, 0, 0);
      
      // Remember starting position for both columns
      const fromToStartY = yPos;
      let fromYPos = fromToStartY;
      let billToYPos = fromToStartY;
      const billToX = 110;
      
      // FROM Section (Left Column)
      downloadPdf.setFontSize(9);
      downloadPdf.setFont('helvetica', 'bold');
      downloadPdf.text('From:', leftMargin, fromYPos);
      
      fromYPos += 5;
      downloadPdf.setFontSize(11);
      downloadPdf.setFont('helvetica', 'bold');
      const companyNameLines = downloadPdf.splitTextToSize(company.company_name, 85);
      downloadPdf.text(companyNameLines, leftMargin, fromYPos);
      fromYPos += companyNameLines.length * 4.5;
      
      downloadPdf.setFontSize(8);
      downloadPdf.setFont('helvetica', 'normal');
      downloadPdf.setTextColor(60, 60, 60);
      
      if (company.legal_name && company.legal_name !== company.company_name) {
        const legalNameLines = downloadPdf.splitTextToSize(company.legal_name, 85);
        downloadPdf.text(legalNameLines, leftMargin, fromYPos);
        fromYPos += legalNameLines.length * 4;
      }
      
      if (company.address_line1) {
        const address1Lines = downloadPdf.splitTextToSize(company.address_line1, 85);
        downloadPdf.text(address1Lines, leftMargin, fromYPos);
        fromYPos += address1Lines.length * 4;
      }
      
      if (company.address_line2) {
        const address2Lines = downloadPdf.splitTextToSize(company.address_line2, 85);
        downloadPdf.text(address2Lines, leftMargin, fromYPos);
        fromYPos += address2Lines.length * 4;
      }
      
      const companyLocation = [company.city, company.state, company.postal_code].filter(Boolean).join(', ');
      if (companyLocation) {
        const locationLines = downloadPdf.splitTextToSize(companyLocation, 85);
        downloadPdf.text(locationLines, leftMargin, fromYPos);
        fromYPos += locationLines.length * 4;
      }
      
      if (company.email) {
        const emailLines = downloadPdf.splitTextToSize('Email: ' + String(company.email), 85);
        downloadPdf.text(emailLines, leftMargin, fromYPos);
        fromYPos += emailLines.length * 4;
      }
      
      if (company.phone) {
        const phoneLines = downloadPdf.splitTextToSize('Phone: ' + String(company.phone), 85);
        downloadPdf.text(phoneLines, leftMargin, fromYPos);
        fromYPos += phoneLines.length * 4;
      }
      
      if (company.website) {
        const websiteLines = downloadPdf.splitTextToSize('Website: ' + String(company.website), 85);
        downloadPdf.text(websiteLines, leftMargin, fromYPos);
        fromYPos += websiteLines.length * 4;
      }
      
      const companyWithCountry = { country: company.country } as Customer;
      const taxFields = getCompanyTaxFields(company.country?.code);
      taxFields.fields.forEach((field) => {
        const value = company[field.key as keyof CompanySettings] as string | undefined;
        if (value) {
          const fieldLines = downloadPdf.splitTextToSize(`${field.label}: ` + String(value), 85);
          downloadPdf.text(fieldLines, leftMargin, fromYPos);
          fromYPos += fieldLines.length * 4;
        }
      });
      
      if (company.pan && !taxFields.fields.some(f => f.key === 'pan')) {
        const panLabel = (company.country?.code === 'IN' || company.country?.code === 'IND') ? 'PAN' : 'Tax ID';
        const panLines = downloadPdf.splitTextToSize(`${panLabel}: ` + String(company.pan), 85);
        downloadPdf.text(panLines, leftMargin, fromYPos);
        fromYPos += panLines.length * 4;
      }
      
      // BILL TO Section (Right Column) - aligned with FROM section
      const billToMaxWidth = 85;
      downloadPdf.setTextColor(0, 0, 0);
      downloadPdf.setFontSize(9);
      downloadPdf.setFont('helvetica', 'bold');
      downloadPdf.text('Bill To:', billToX, billToYPos);
      
      billToYPos += 5;
      downloadPdf.setFontSize(11);
      downloadPdf.setFont('helvetica', 'bold');
      downloadPdf.setTextColor(37, 99, 235);
      const customerName = customer.company_name || customer.contact_person || 'N/A';
      const customerNameLines = downloadPdf.splitTextToSize(customerName, billToMaxWidth);
      downloadPdf.text(customerNameLines, billToX, billToYPos);
      billToYPos += customerNameLines.length * 4.5;
      
      downloadPdf.setFontSize(8);
      downloadPdf.setFont('helvetica', 'normal');
      downloadPdf.setTextColor(60, 60, 60);
      
      if (customer.contact_person && customer.company_name) {
        const attnLines = downloadPdf.splitTextToSize('Attn: ' + String(customer.contact_person), billToMaxWidth);
        downloadPdf.text(attnLines, billToX, billToYPos);
        billToYPos += attnLines.length * 4;
      }
      
      if (customer.address_line1) {
        const address1Lines = downloadPdf.splitTextToSize(customer.address_line1, billToMaxWidth);
        downloadPdf.text(address1Lines, billToX, billToYPos);
        billToYPos += address1Lines.length * 4;
      }
      
      if (customer.address_line2) {
        const address2Lines = downloadPdf.splitTextToSize(customer.address_line2, billToMaxWidth);
        downloadPdf.text(address2Lines, billToX, billToYPos);
        billToYPos += address2Lines.length * 4;
      }
      
      const customerLocation = [customer.city, customer.state, customer.postal_code].filter(Boolean).join(', ');
      if (customerLocation) {
        const locationLines = downloadPdf.splitTextToSize(customerLocation, billToMaxWidth);
        downloadPdf.text(locationLines, billToX, billToYPos);
        billToYPos += locationLines.length * 4;
      }
      
      if (customer.email) {
        const emailLines = downloadPdf.splitTextToSize('Email: ' + String(customer.email), billToMaxWidth);
        downloadPdf.text(emailLines, billToX, billToYPos);
        billToYPos += emailLines.length * 4;
      }
      
      if (customer.phone) {
        const phoneLines = downloadPdf.splitTextToSize('Phone: ' + String(customer.phone), billToMaxWidth);
        downloadPdf.text(phoneLines, billToX, billToYPos);
        billToYPos += phoneLines.length * 4;
      }
      
      if (customer.gstin) {
        const taxRegLabel = getTaxRegistrationLabel(customer);
        const taxRegLines = downloadPdf.splitTextToSize(`${taxRegLabel}: ` + String(customer.gstin), billToMaxWidth);
        downloadPdf.text(taxRegLines, billToX, billToYPos);
        billToYPos += taxRegLines.length * 4;
      }

      if (customer.pan) {
        const panLabel = (customer.country?.code === 'IN' || customer.country?.code === 'IND') ? 'PAN' : 'Tax ID';
        const panLines = downloadPdf.splitTextToSize(`${panLabel}: ` + String(customer.pan), billToMaxWidth);
        downloadPdf.text(panLines, billToX, billToYPos);
        billToYPos += panLines.length * 4;
      }
      
      // Payment Status Badge - compact and professional
      const statusX = billToX;
      billToYPos += 5;
      const paymentStatusColor = fullInvoice.payment_status === 'paid' ? [34, 197, 94] : [239, 68, 68];
      downloadPdf.setFillColor(paymentStatusColor[0], paymentStatusColor[1], paymentStatusColor[2]);
      downloadPdf.roundedRect(statusX, billToYPos - 3, 25, 6, 1, 1, 'F');
      downloadPdf.setTextColor(255, 255, 255);
      downloadPdf.setFontSize(7);
      downloadPdf.setFont('helvetica', 'bold');
      downloadPdf.text((fullInvoice.payment_status === 'paid' ? 'COMPLETED' : fullInvoice.payment_status.toUpperCase()), statusX + 12.5, billToYPos + 1, { align: 'center' });

      // Set yPos to the maximum of both columns for proper spacing
      yPos = Math.max(fromYPos, billToYPos) + 10;

      // Project Details Section (if present)
      if (fullInvoice.project_title || fullInvoice.estimated_time || fullInvoice.company_contact_name) {
        downloadPdf.setFillColor(250, 251, 252);
        const projectBoxHeight = 8 +
          (fullInvoice.project_title ? 4 : 0) +
          (fullInvoice.estimated_time ? 4 : 0) +
          (fullInvoice.company_contact_name ? 4 : 0);

        downloadPdf.rect(leftMargin, yPos, 180, projectBoxHeight, 'F');
        downloadPdf.setDrawColor(220, 220, 220);
        downloadPdf.setLineWidth(0.1);
        downloadPdf.rect(leftMargin, yPos, 180, projectBoxHeight);

        yPos += 3;
        downloadPdf.setTextColor(37, 99, 235);
        downloadPdf.setFontSize(9);
        downloadPdf.setFont('helvetica', 'bold');
        downloadPdf.text('Project Details', leftMargin + 2, yPos);
        yPos += 5;

        downloadPdf.setFontSize(8);
        downloadPdf.setFont('helvetica', 'normal');
        downloadPdf.setTextColor(60, 60, 60);

        if (fullInvoice.project_title) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text('Project: ', leftMargin + 2, yPos);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(String(fullInvoice.project_title), leftMargin + 20, yPos);
          yPos += 4;
        }

        if (fullInvoice.estimated_time) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text('Timeline: ', leftMargin + 2, yPos);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(String(fullInvoice.estimated_time), leftMargin + 20, yPos);
          yPos += 4;
        }

        if (fullInvoice.company_contact_name) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text('Contact: ', leftMargin + 2, yPos);
          downloadPdf.setFont('helvetica', 'normal');
          let contactText = String(fullInvoice.company_contact_name);
          if (fullInvoice.company_contact_email) {
            contactText += ' (' + String(fullInvoice.company_contact_email) + ')';
          }
          if (fullInvoice.company_contact_phone) {
            contactText += ' | ' + String(fullInvoice.company_contact_phone);
          }
          downloadPdf.text(contactText, leftMargin + 20, yPos);
          yPos += 4;
        }

        yPos += 8;
      }

      // Professional Items Table
      downloadPdf.setFillColor(245, 247, 250);
      downloadPdf.rect(leftMargin, yPos, 180, 8, 'F');
      
      downloadPdf.setTextColor(37, 99, 235);
      downloadPdf.setFontSize(8);
      downloadPdf.setFont('helvetica', 'bold');
      downloadPdf.text('Description', leftMargin + 2, yPos + 5);
      downloadPdf.text('Qty', leftMargin + 95, yPos + 5, { align: 'center' });
      downloadPdf.text('Rate', leftMargin + 120, yPos + 5, { align: 'center' });
      downloadPdf.text(`${taxLabel}%`, leftMargin + 145, yPos + 5, { align: 'center' });
      downloadPdf.text('Amount', leftMargin + 175, yPos + 5, { align: 'right' });
      
      yPos += 8;
      
      // Table border
      downloadPdf.setDrawColor(220, 220, 220);
      downloadPdf.setLineWidth(0.1);
      
      // Items with better spacing and typography
      downloadPdf.setTextColor(0, 0, 0);
      downloadPdf.setFont('helvetica', 'normal');
      
      // Get currency symbol dynamically from customer's country - with safety checks
      let safeCurrencySymbol = 'Rs.'; // Default safe ASCII fallback
      
      // Safely extract currency symbol and convert to ASCII-safe version
      if (currencyInfo && currencyInfo.code) {
        const currencyCode = currencyInfo.code.toUpperCase();
        switch (currencyCode) {
          case 'INR':
            safeCurrencySymbol = 'Rs.';
            break;
          case 'USD':
            safeCurrencySymbol = '$';
            break;
          case 'EUR':
            safeCurrencySymbol = '€';
            break;
          case 'GBP':
            safeCurrencySymbol = '£';
            break;
          default:
            safeCurrencySymbol = currencyCode || 'Rs.';
        }
      }
      
      console.log('� Final currency symbol for PDF:', {
        customerCountry: selectedCustomer?.country_id || 'Unknown',
        currencySymbol: safeCurrencySymbol,
        currencyCode: currencyInfo?.code || 'Unknown',
        currencyName: currencyInfo?.name || 'Unknown'
      });
      
      // Helper function to format numbers without Unicode issues - alternative approach
      const formatCleanNumber = (num: number): string => {
        // Use basic string operations to avoid any Unicode formatting issues
        const wholeNumber = Math.floor(num);
        const decimal = Math.round((num - wholeNumber) * 100);
        const decimalStr = decimal.toString().padStart(2, '0');
        return wholeNumber.toString() + '.' + decimalStr;
      };
      
      // Helper function to format currency amounts with safe symbols
      const formatCurrencyForPdf = (amount: number): string => {
        const cleanAmount = formatCleanNumber(amount);
        return safeCurrencySymbol + ' ' + cleanAmount;
      };
      
      // Debug: Test number formatting
      console.log('🧪 Number formatting test with Times font:', {
        testAmount: 14130,
        cleanFormatted: formatCleanNumber(14130),
        withCurrency: formatCurrencyForPdf(14130),
        basicString: '14130.00',
        directCurrency: safeCurrencySymbol + ' 14130.00'
      });
      
      // Alternative simple format function for testing
      const formatSimple = (num: number): string => {
        return num.toString() + '.00';
      };
      
      console.log('🔧 Simple format test:', {
        simple14130: formatSimple(14130),
        basicConcat: '14130' + '.' + '00'
      });
      
      // Debug: Currency symbol in PDF generation
      console.log('📄 PDF currency formatting test:', {
        testAmount: 15000.00,
        currencySymbol: safeCurrencySymbol,
        formattedPrice: safeCurrencySymbol + ' ' + '15000.00'
      });
      
      if (fullInvoice.invoice_items && fullInvoice.invoice_items.length > 0) {
        fullInvoice.invoice_items.forEach((item, index) => {
          // Calculate based on item type
          let itemSubtotal = 0;
          if (item.is_service_item && item.billable_hours) {
            const resourceCount = item.resource_count || 1;
            itemSubtotal = resourceCount * item.quantity * item.billable_hours * item.unit_price;
          } else {
            itemSubtotal = item.quantity * item.unit_price;
          }
          const itemTax = itemSubtotal * item.tax_rate / 100;
          const itemTotal = itemSubtotal + itemTax;
          
          // Calculate row height based on content
          let rowHeight = 12;
          if (item.description || item.hsn_code) {
            rowHeight = 18;
          }
          
          // Check for page break
          if (yPos + rowHeight > 240) {
            downloadPdf.addPage();
            yPos = 20;
            
            // Repeat header
            downloadPdf.setFillColor(245, 247, 250);
            downloadPdf.rect(leftMargin, yPos, 180, 8, 'F');
            
            downloadPdf.setTextColor(37, 99, 235);
            downloadPdf.setFontSize(8);
            downloadPdf.setFont('helvetica', 'bold');
            downloadPdf.text('Description', leftMargin + 2, yPos + 5);
            downloadPdf.text('Qty', leftMargin + 95, yPos + 5, { align: 'center' });
            downloadPdf.text('Rate', leftMargin + 120, yPos + 5, { align: 'center' });
            downloadPdf.text(`${taxLabel}%`, leftMargin + 145, yPos + 5, { align: 'center' });
            downloadPdf.text('Amount', leftMargin + 175, yPos + 5, { align: 'right' });
            
            yPos += 8;
            downloadPdf.setTextColor(0, 0, 0);
            downloadPdf.setFont('helvetica', 'normal');
          }
          
          // Subtle row separator
          if (index > 0) {
            downloadPdf.setDrawColor(240, 240, 240);
            downloadPdf.line(leftMargin, yPos, leftMargin + 180, yPos);
          }
          
          yPos += 3;
          
          // Calculate proper row height based on content
          const itemText = item.item_name + (item.description ? ` - ${item.description}` : '');
          const itemLines = downloadPdf.splitTextToSize(itemText, 80); // Slightly reduce width for HSN code space
          const hasHsnCode = item.hsn_code ? true : false;
          const itemRowHeight = Math.max(itemLines.length * 3 + (hasHsnCode ? 6 : 3), 12); // Dynamic height
          
          // Item name with description - positioned at top of row
          downloadPdf.setFontSize(8);
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.setTextColor(0, 0, 0);
          downloadPdf.text(itemLines, leftMargin + 2, yPos + 3);
          
          // Classification Code - positioned below description with proper spacing
          if (item.hsn_code) {
            const hsnYPos = yPos + 3 + (itemLines.length * 3) + 1; // Position below description
            downloadPdf.setFontSize(6);
            downloadPdf.setFont('helvetica', 'normal');
            downloadPdf.setTextColor(100, 100, 100);
            const classificationLabel = getClassificationCodeLabel(selectedCustomer);
            const shortLabel = classificationLabel === 'HSN Code' ? 'HSN' : 'Code';
            downloadPdf.text(`${shortLabel}: ${item.hsn_code}`, leftMargin + 2, hsnYPos);
          }
          
          // Position numbers at the top baseline, same as the first line of item text
          const numbersYPos = yPos + 3; // Same baseline as item text for proper alignment
          downloadPdf.setTextColor(0, 0, 0);
          downloadPdf.setFontSize(8);
          downloadPdf.setFont('helvetica', 'normal');
          
          // INDIAN CURRENCY FORMATTING - Lakhs/Crores system with currency symbol
          
          // SAFE INDIAN CURRENCY FORMATTING - No Unicode issues
          const formatIndianNumber = (amount: number): string => {
            const amountStr = amount.toString();
            let wholePart: string;
            let decimalPart: string;
            
            if (!amountStr.includes('.')) {
              wholePart = amountStr;
              decimalPart = '00';
            } else {
              const parts = amountStr.split('.');
              wholePart = parts[0];
              decimalPart = parts[1];
              if (decimalPart.length === 1) {
                decimalPart = decimalPart + '0';
              } else if (decimalPart.length > 2) {
                decimalPart = decimalPart.substring(0, 2);
              }
            }
            
            // Add Indian comma formatting (lakhs/crores)
            let formattedWhole = '';
            const wholePartReversed = wholePart.split('').reverse().join('');
            
            for (let i = 0; i < wholePartReversed.length; i++) {
              if (i === 3) {
                formattedWhole = ',' + formattedWhole;
              } else if (i > 3 && (i - 3) % 2 === 0) {
                formattedWhole = ',' + formattedWhole;
              }
              formattedWhole = wholePartReversed[i] + formattedWhole;
            }
            
            return formattedWhole + '.' + decimalPart;
          };
          
          const qtyText = item.quantity.toString();
          const priceText = formatIndianNumber(item.unit_price);
          const taxText = item.tax_rate.toString() + '%';
          const totalText = formatIndianNumber(itemTotal);
          
          // Test with even simpler strings
          const testPriceText = '15000.00';
          const testTotalText = '17700.00';
          
          // Log everything for debugging
          console.log('� PDF DEBUG - Multiple formats:', {
            qty: qtyText,
            priceCalculated: priceText,
            priceTest: testPriceText,
            tax: taxText,
            totalCalculated: totalText,
            totalTest: testTotalText,
            itemIndex: index,
            originalAmount: item.unit_price,
            calculatedCents: Math.round(item.unit_price * 100)
          });
          
          downloadPdf.text(qtyText, leftMargin + 95, numbersYPos, { align: 'center' });
          
          // Safe currency format - concatenate symbol with formatted number
          const priceWithCurrency = safeCurrencySymbol + ' ' + priceText;
          downloadPdf.text(priceWithCurrency, leftMargin + 120, numbersYPos, { align: 'center' });
          
          downloadPdf.text(taxText, leftMargin + 145, numbersYPos, { align: 'center' });
          downloadPdf.setFont('helvetica', 'bold');
          
          // Safe currency format for total
          const totalWithCurrency = safeCurrencySymbol + ' ' + totalText;
          downloadPdf.text(totalWithCurrency, leftMargin + 175, numbersYPos, { align: 'right' });
          
          yPos += itemRowHeight;
        });
      } else {
        downloadPdf.setTextColor(150, 150, 150);
        downloadPdf.setFontSize(8);
        downloadPdf.text('No items found', leftMargin + 90, yPos + 10, { align: 'center' });
        yPos += 20;
      }
      
      // Table bottom border
      downloadPdf.setDrawColor(200, 200, 200);
      downloadPdf.setLineWidth(0.3);
      downloadPdf.line(leftMargin, yPos, leftMargin + 180, yPos);
      
      yPos += 10;
      
      // Professional Totals Section - aligned with table boundary
      const tableWidth = 180; // Same as table width
      const totalsWidth = 60; // Slightly wider for better formatting
      const totalsStartX = leftMargin + tableWidth - totalsWidth; // Right-align with table

      // Calculate totals box height based on whether discount is present
      const hasDiscount = fullInvoice.discount_amount && fullInvoice.discount_amount > 0;
      // const inrPayments = ((fullInvoice.currency_code || '').toUpperCase() !== 'INR')
      //   ? (fullInvoice.payments || [])
      //   : [];
      // const hasINRPaymentLine = inrPayments.length > 0;
      const isIndianCurrency = (fullInvoice.currency_code || '').toUpperCase() === 'INR';
      const totalsBoxHeight = (hasDiscount ? 31 : 25); // INR payment line removed

      // Clean totals box
      downloadPdf.setFillColor(250, 251, 252);
      downloadPdf.rect(totalsStartX, yPos - 3, totalsWidth, totalsBoxHeight, 'F');
      downloadPdf.setDrawColor(225, 229, 235);
      downloadPdf.setLineWidth(0.2);
      downloadPdf.rect(totalsStartX, yPos - 3, totalsWidth, totalsBoxHeight);
      
      downloadPdf.setTextColor(60, 60, 60);
      downloadPdf.setFontSize(8);
      downloadPdf.setFont('helvetica', 'normal');
      
      // SAFE INDIAN NUMBER FORMATTING - No currency symbol concatenation
      const formatIndianNumber = (amount: number): string => {
        const amountStr = amount.toString();
        let wholePart: string;
        let decimalPart: string;
        
        if (!amountStr.includes('.')) {
          wholePart = amountStr;
          decimalPart = '00';
        } else {
          const parts = amountStr.split('.');
          wholePart = parts[0];
          decimalPart = parts[1];
          if (decimalPart.length === 1) {
            decimalPart = decimalPart + '0';
          } else if (decimalPart.length > 2) {
            decimalPart = decimalPart.substring(0, 2);
          }
        }
        
        // Add Indian comma formatting (lakhs/crores)
        let formattedWhole = '';
        const wholePartReversed = wholePart.split('').reverse().join('');
        
        for (let i = 0; i < wholePartReversed.length; i++) {
          if (i === 3) {
            formattedWhole = ',' + formattedWhole;
          } else if (i > 3 && (i - 3) % 2 === 0) {
            formattedWhole = ',' + formattedWhole;
          }
          formattedWhole = wholePartReversed[i] + formattedWhole;
        }
        
        return formattedWhole + '.' + decimalPart;
      };
      
      // Format the totals with Indian number formatting (no currency concatenation)
      const subtotalText = formatIndianNumber(subtotal);
      const taxAmountText = formatIndianNumber(totalTax);  
      const finalTotalText = formatIndianNumber(total);
      
      // Subtotal - safe currency concatenation
      downloadPdf.text('Subtotal:', totalsStartX + 3, yPos + 2);
      downloadPdf.setFont('helvetica', 'bold');
      const subtotalWithCurrency = safeCurrencySymbol + ' ' + subtotalText;
      downloadPdf.text(subtotalWithCurrency, totalsStartX + totalsWidth - 3, yPos + 2, { align: 'right' });

      yPos += 6;

      // Discount (if applicable)
      if (fullInvoice.discount_amount && fullInvoice.discount_amount > 0) {
        const discountText = formatIndianNumber(fullInvoice.discount_amount);
        downloadPdf.setFont('helvetica', 'normal');
        downloadPdf.setTextColor(34, 197, 94); // Green color
        const discountLabel = fullInvoice.discount_type === 'percentage'
          ? `Discount (${fullInvoice.discount_value}%):`
          : 'Discount:';
        downloadPdf.text(discountLabel, totalsStartX + 3, yPos + 2);
        downloadPdf.setFont('helvetica', 'bold');
        const discountWithCurrency = '- ' + safeCurrencySymbol + ' ' + discountText;
        downloadPdf.text(discountWithCurrency, totalsStartX + totalsWidth - 3, yPos + 2, { align: 'right' });
        yPos += 6;
        downloadPdf.setTextColor(60, 60, 60); // Reset color
      }

      downloadPdf.setFont('helvetica', 'normal');
      downloadPdf.text(`${taxLabel} Amount:`, totalsStartX + 3, yPos + 2);
      downloadPdf.setFont('helvetica', 'bold');
      const taxWithCurrency = safeCurrencySymbol + ' ' + taxAmountText;
      downloadPdf.text(taxWithCurrency, totalsStartX + totalsWidth - 3, yPos + 2, { align: 'right' });
      
      // Total line - elegant
      yPos += 6;
      downloadPdf.setDrawColor(37, 99, 235);
      downloadPdf.setLineWidth(0.3);
      downloadPdf.line(totalsStartX + 3, yPos, totalsStartX + totalsWidth - 3, yPos);
      
      yPos += 6;
      downloadPdf.setFontSize(9);
      downloadPdf.setFont('helvetica', 'bold');
      downloadPdf.setTextColor(37, 99, 235);
      downloadPdf.text('Total:', totalsStartX + 3, yPos + 2);
      const finalTotalWithCurrency = safeCurrencySymbol + ' ' + finalTotalText;
      downloadPdf.text(finalTotalWithCurrency, totalsStartX + totalsWidth - 3, yPos + 2, { align: 'right' });

      // if (hasINRPaymentLine) {
      //   const dlTotalINRPaid = inrPayments.reduce((sum, p) => sum + p.amount, 0);
      //   yPos += 6;
      //   downloadPdf.setFontSize(8);
      //   downloadPdf.setFont('helvetica', 'normal');
      //   downloadPdf.setTextColor(100, 100, 100);
      //   downloadPdf.text('Rs. ' + formatIndianNumber(dlTotalINRPaid), totalsStartX + totalsWidth - 3, yPos + 2, { align: 'right' });
      // }

      yPos += 8;
      
      // Amount in Words - positioned directly below totals
      const amountInWords = formatAmountInWords(total, currencyInfo.name);
      
      downloadPdf.setTextColor(37, 99, 235);
      downloadPdf.setFontSize(9);
      downloadPdf.setFont('helvetica', 'bold');
      downloadPdf.text('Amount in Words', totalsStartX, yPos);
      
      yPos += 5;
      downloadPdf.setFontSize(7);
      downloadPdf.setFont('helvetica', 'italic');
      downloadPdf.setTextColor(60, 60, 60);
      const amountLines = downloadPdf.splitTextToSize(amountInWords, totalsWidth);
      downloadPdf.text(amountLines, totalsStartX, yPos);
      
      yPos += amountLines.length * 3 + 8;

      // Smart layout: Banking details and Notes positioning
      const leftSectionStart = leftMargin;
      // Determine banking by company entity, not invoice currency
      const isIndianCompany = company.country?.code === 'IN' || company.country?.code === 'IND' ||
        company.country_id?.toUpperCase() === 'IN' || company.country_id?.toUpperCase() === 'IND';
      // Company banking shown for: Indian entity + INR invoice, OR any non-Indian entity (getBankingLabel applies correct label)
      const bankingDetailsAvailable = !!(company.bank_name || company.account_number || company.ifsc_code ||
        company.iban || company.swift_bic) &&
        (!isIndianCompany || isIndianCurrency);
      // Wise intl banking shown only for Indian entity billing a foreign-currency invoice
      const intlBankingAvailable = isIndianCompany && !isIndianCurrency &&
        !!(fullInvoice.intl_account_name || fullInvoice.intl_account_number);
      const notesAvailable = fullInvoice.notes;

      // Helper: render international banking box (region-specific fields, no QR)
      const renderIntlBankingBox = (startX: number, startY: number, boxWidth: number) => {
        const invCurrency = (fullInvoice.currency_code || '').toUpperCase();
        let fields: Array<[string, string | undefined]>;
        if (invCurrency === 'EUR') {
          fields = [
            ['Account Name:', fullInvoice.intl_account_name],
            ['IBAN:', fullInvoice.intl_iban],
            ['Swift/BIC:', fullInvoice.intl_swift_bic],
            ['Address:', fullInvoice.intl_bank_address],
          ];
        } else if (invCurrency === 'GBP') {
          fields = [
            ['Account Name:', fullInvoice.intl_account_name],
            ['IBAN:', fullInvoice.intl_iban],
            ['Account No:', fullInvoice.intl_account_number],
            ['Sort Code:', fullInvoice.intl_sort_code],
            ['Swift/BIC:', fullInvoice.intl_swift_bic],
            ['Address:', fullInvoice.intl_bank_address],
          ];
        } else if (invCurrency === 'USD') {
          fields = [
            ['Account Name:', fullInvoice.intl_account_name],
            ['Account No:', fullInvoice.intl_account_number],
            ['Account Type:', fullInvoice.intl_account_type],
            ['Routing No:', fullInvoice.intl_routing_number],
            ['Swift/BIC:', fullInvoice.intl_swift_bic],
            ['Address:', fullInvoice.intl_bank_address],
          ];
        } else {
          fields = [
            ['Account Name:', fullInvoice.intl_account_name],
            ['IBAN:', fullInvoice.intl_iban],
            ['Account No:', fullInvoice.intl_account_number],
            ['Account Type:', fullInvoice.intl_account_type],
            ['Sort Code:', fullInvoice.intl_sort_code],
            ['Routing No:', fullInvoice.intl_routing_number],
            ['Swift/BIC:', fullInvoice.intl_swift_bic],
            ['Address:', fullInvoice.intl_bank_address],
          ];
        }
        const filtered = fields.filter(([, v]) => v) as Array<[string, string]>;
        const intlBoxHeight = 4 + filtered.length * 4 + (fullInvoice.intl_bank_address ? 3 : 0);
        downloadPdf.setFillColor(248, 250, 252);
        downloadPdf.rect(startX, startY - 2, boxWidth, intlBoxHeight, 'F');
        downloadPdf.setDrawColor(225, 229, 235);
        downloadPdf.setLineWidth(0.2);
        downloadPdf.rect(startX, startY - 2, boxWidth, intlBoxHeight);
        downloadPdf.setFontSize(7);
        downloadPdf.setTextColor(60, 60, 60);
        let cy = startY + 2;
        filtered.forEach(([label, val]) => {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text(label, startX + 2, cy);
          downloadPdf.setFont('helvetica', 'normal');
          const valLines = downloadPdf.splitTextToSize(val as string, boxWidth - 28);
          downloadPdf.text(valLines, startX + 26, cy);
          cy += valLines.length > 1 ? valLines.length * 3 + 1 : 4;
        });
        return startY - 2 + intlBoxHeight;
      };
      
      // If we have banking details but no notes, position banking details beside totals
      if ((bankingDetailsAvailable || intlBankingAvailable) && !notesAvailable) {
        // Position banking details to the left of totals at the same height
        const bankingStartY = totalsStartX > 100 ? (yPos - amountLines.length * 3 - 8 - totalsBoxHeight) : yPos; // Align with totals if space allows
        
        downloadPdf.setTextColor(37, 99, 235);
        downloadPdf.setFontSize(9);
        downloadPdf.setFont('helvetica', 'bold');
        downloadPdf.text('Banking Details', leftSectionStart, bankingStartY);

        if (intlBankingAvailable) {
          const intlBoxBottomY = renderIntlBankingBox(leftSectionStart, bankingStartY + 5, 100);
          yPos = Math.max(yPos, intlBoxBottomY + 5);
        } else {
        const bankingYPos = bankingStartY + 5;
        downloadPdf.setFillColor(248, 250, 252);
        let bankFieldCount = 0;
        if (company.bank_name) bankFieldCount++;
        if (company.account_number) bankFieldCount++;
        if (isIndianCompany && company.ifsc_code) bankFieldCount++;
        if (!isIndianCompany && company.iban) bankFieldCount++;
        if (!isIndianCompany && company.swift_bic) bankFieldCount++;
        const bankingBoxHeight = 4 + bankFieldCount * 4;
        const leftColWidth = 85;
        downloadPdf.rect(leftSectionStart, bankingYPos - 2, leftColWidth, bankingBoxHeight, 'F');
        downloadPdf.setDrawColor(225, 229, 235);
        downloadPdf.setLineWidth(0.2);
        downloadPdf.rect(leftSectionStart, bankingYPos - 2, leftColWidth, bankingBoxHeight);
        
        downloadPdf.setFontSize(7);
        downloadPdf.setTextColor(60, 60, 60);
        
        let bankingContentY = bankingYPos + 2;
        
        if (company.bank_name) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text('Bank:', leftSectionStart + 2, bankingContentY);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(company.bank_name, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        
        if (company.account_number) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text('A/C:', leftSectionStart + 2, bankingContentY);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(company.account_number, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        
        if (isIndianCompany && company.ifsc_code) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text(`${getBankingLabel(company)}:`, leftSectionStart + 2, bankingContentY);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(company.ifsc_code, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        if (!isIndianCompany && company.iban) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text('IBAN:', leftSectionStart + 2, bankingContentY);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(company.iban, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        if (!isIndianCompany && company.swift_bic) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text('SWIFT/BIC:', leftSectionStart + 2, bankingContentY);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(company.swift_bic, leftSectionStart + 22, bankingContentY);
        }
        
        // QR code directly below banking box (side-by-side layout)
        const bankBoxBottomY1 = bankingYPos - 2 + bankingBoxHeight + 5;
        const dlQrData1 = (isIndianCompany && isIndianCurrency) ? await loadQRCodeImage() : null;
        if (dlQrData1) {
          const qrPdfWidth = 50;
          const qrPdfHeight = qrPdfWidth * (dlQrData1.height / dlQrData1.width);
          downloadPdf.addImage(dlQrData1.dataUrl, 'JPEG', leftSectionStart, bankBoxBottomY1, qrPdfWidth, qrPdfHeight, undefined, 'FAST');
          downloadPdf.setFontSize(6);
          downloadPdf.setTextColor(100, 100, 100);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text('Scan to Pay', leftSectionStart + qrPdfWidth / 2, bankBoxBottomY1 + qrPdfHeight + 2, { align: 'center' });
          yPos = Math.max(yPos, bankBoxBottomY1 + qrPdfHeight + 10);
        } else {
          yPos = Math.max(yPos, bankBoxBottomY1);
        }
        } // end Indian banking (side-by-side)
        
      } else if (bankingDetailsAvailable || intlBankingAvailable) {
        // Default layout: Banking details below totals (when notes are present)
        downloadPdf.setTextColor(37, 99, 235);
        downloadPdf.setFontSize(9);
        downloadPdf.setFont('helvetica', 'bold');
        downloadPdf.text('Banking Details', leftSectionStart, yPos);
        
        yPos += 5;

        if (intlBankingAvailable) {
          const intlBoxBottomY = renderIntlBankingBox(leftSectionStart, yPos, 100);
          yPos = intlBoxBottomY + 5;
        } else {
        downloadPdf.setFillColor(248, 250, 252);
        let bankFieldCount = 0;
        if (company.bank_name) bankFieldCount++;
        if (company.account_number) bankFieldCount++;
        if (isIndianCompany && company.ifsc_code) bankFieldCount++;
        if (!isIndianCompany && company.iban) bankFieldCount++;
        if (!isIndianCompany && company.swift_bic) bankFieldCount++;
        const bankingBoxHeight = 4 + bankFieldCount * 4;
        const leftColWidth = 85;
        downloadPdf.rect(leftSectionStart, yPos - 2, leftColWidth, bankingBoxHeight, 'F');
        downloadPdf.setDrawColor(225, 229, 235);
        downloadPdf.setLineWidth(0.2);
        downloadPdf.rect(leftSectionStart, yPos - 2, leftColWidth, bankingBoxHeight);
        
        downloadPdf.setFontSize(7);
        downloadPdf.setTextColor(60, 60, 60);
        
        let bankingYPos = yPos + 2;
        
        if (company.bank_name) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text('Bank:', leftSectionStart + 2, bankingYPos);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(company.bank_name, leftSectionStart + 15, bankingYPos);
          bankingYPos += 4;
        }
        
        if (company.account_number) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text('A/C:', leftSectionStart + 2, bankingYPos);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(company.account_number, leftSectionStart + 15, bankingYPos);
          bankingYPos += 4;
        }
        
        if (isIndianCompany && company.ifsc_code) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text(`${getBankingLabel(company)}:`, leftSectionStart + 2, bankingYPos);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(company.ifsc_code, leftSectionStart + 15, bankingYPos);
          bankingYPos += 4;
        }
        if (!isIndianCompany && company.iban) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text('IBAN:', leftSectionStart + 2, bankingYPos);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(company.iban, leftSectionStart + 15, bankingYPos);
          bankingYPos += 4;
        }
        if (!isIndianCompany && company.swift_bic) {
          downloadPdf.setFont('helvetica', 'bold');
          downloadPdf.text('SWIFT/BIC:', leftSectionStart + 2, bankingYPos);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text(company.swift_bic, leftSectionStart + 22, bankingYPos);
        }
        
        // QR code directly below banking box (stacked layout)
        const bankBoxBottomY2 = yPos - 2 + bankingBoxHeight + 5;
        const dlQrData2 = (isIndianCompany && isIndianCurrency) ? await loadQRCodeImage() : null;
        if (dlQrData2) {
          const qrPdfWidth = 50;
          const qrPdfHeight = qrPdfWidth * (dlQrData2.height / dlQrData2.width);
          downloadPdf.addImage(dlQrData2.dataUrl, 'JPEG', leftSectionStart, bankBoxBottomY2, qrPdfWidth, qrPdfHeight, undefined, 'FAST');
          downloadPdf.setFontSize(6);
          downloadPdf.setTextColor(100, 100, 100);
          downloadPdf.setFont('helvetica', 'normal');
          downloadPdf.text('Scan to Pay', leftSectionStart + qrPdfWidth / 2, bankBoxBottomY2 + qrPdfHeight + 2, { align: 'center' });
          yPos = bankBoxBottomY2 + qrPdfHeight + 10;
        } else {
          yPos = bankBoxBottomY2;
        }
        } // end Indian banking (stacked)
      }

      // Notes Section - compact and clean
      if (fullInvoice.notes) {
        downloadPdf.setTextColor(37, 99, 235);
        downloadPdf.setFontSize(8);
        downloadPdf.setFont('helvetica', 'bold');
        downloadPdf.text('Notes', leftMargin, yPos);
        
        yPos += 5;
        downloadPdf.setFontSize(6);
        downloadPdf.setFont('helvetica', 'normal');
        downloadPdf.setTextColor(60, 60, 60);
        const notesLines = downloadPdf.splitTextToSize(fullInvoice.notes, 180);
        downloadPdf.text(notesLines, leftMargin, yPos);
        yPos += notesLines.length * 3 + 5;
      }
      
      // Terms & Conditions - compact and clean
      if (fullInvoice.terms_conditions) {
        downloadPdf.setTextColor(37, 99, 235);
        downloadPdf.setFontSize(8);
        downloadPdf.setFont('helvetica', 'bold');
        downloadPdf.text('Terms & Conditions', leftMargin, yPos);
        
        yPos += 4;
        downloadPdf.setFontSize(5.5);
        downloadPdf.setFont('helvetica', 'normal');
        downloadPdf.setTextColor(60, 60, 60);
        const termsLines = downloadPdf.splitTextToSize(fullInvoice.terms_conditions, 180);
        downloadPdf.text(termsLines, leftMargin, yPos);
        yPos += termsLines.length * 2.5 + 5;
      }
      
      // Professional Footer - respect footer image positioning
      console.log(`Current yPos before footer: ${yPos.toFixed(1)}mm`);
      console.log(`contentEndY (calculated by footer image): ${contentEndY.toFixed(1)}mm`);
      
      // Position footer text just above the footer image area
      const footerStartY = contentEndY - 2;
      yPos = footerStartY;
      
      console.log(`Forced footer text yPos to: ${yPos.toFixed(1)}mm (based on contentEndY with gap)`);
      
      downloadPdf.setDrawColor(240, 240, 240);
      downloadPdf.setLineWidth(0.2);
      downloadPdf.line(leftMargin, yPos, rightMargin, yPos);
      
      yPos += 4;
      downloadPdf.setTextColor(37, 99, 235);
      downloadPdf.setFontSize(7);
      downloadPdf.setFont('helvetica', 'bold');
      downloadPdf.text('Thank you for your business!', 105, yPos, { align: 'center' });
      
      yPos += 3;
      downloadPdf.setTextColor(120, 120, 120);
      downloadPdf.setFontSize(5.5);
      downloadPdf.setFont('helvetica', 'normal');
      downloadPdf.text('This is a computer-generated invoice and does not require a signature.', 105, yPos, { align: 'center' });
      
      // Save with descriptive filename
      const downloadFilename = `Invoice-${fullInvoice.invoice_number}-${customer.company_name || customer.contact_person || 'Customer'}.pdf`;
      downloadPdf.save(downloadFilename.replace(/[^a-zA-Z0-9.-]/g, '_')); // Clean filename
      
      showSuccess(`Invoice ${fullInvoice.invoice_number} downloaded successfully!`);
    } catch (error) {
      console.error('Failed to download invoice:', error);
      showError(`Failed to download invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Helper function to ensure customers are loaded
  const ensureCustomersLoaded = async () => {
    if (customers.length === 0) {
      try {
        const customersData = await invoiceService.getCustomers(
          { company_settings_id: selectedCompany?.id },
          1,
          1000
        );
        setCustomers(customersData.data || []);
        return customersData.data || [];
      } catch (error) {
        console.error('Failed to load customers:', error);
        throw new Error('Failed to load customer data');
      }
    }
    return customers;
  };

  const handleEmailInvoice = async (invoice: Invoice) => {
    try {
      showInfo('📧 Preparing to send invoice email...');
      
      // Ensure customers are loaded
      let currentCustomers = customers;
      if (customers.length === 0) {
        showInfo('🔄 Loading customer data...');
        try {
          currentCustomers = await ensureCustomersLoaded();
          if (currentCustomers.length === 0) {
            showError('No customers found in database. Please add customers first.');
            return;
          }
        } catch (customerLoadError) {
          console.error('Failed to load customers:', customerLoadError);
          showError('Failed to load customer data. Please refresh the page and try again.');
          return;
        }
      }
      
      // Find customer
      const customer = currentCustomers.find(c => c.id === invoice.customer_id);
      
      if (!customer) {
        showError(`Cannot send email: Customer not found (ID: ${invoice.customer_id}). Please refresh the page and try again.`);
        return;
      }

      // Get dynamic tax label based on customer's country
      const taxLabel = getTaxLabel(customer);

      // Log customer data for debugging
      console.log('📋 Found customer for email:', {
        id: customer.id,
        company_name: customer.company_name,
        contact_person: customer.contact_person,
        email: customer.email
      });

      // Check if customer has email
      if (!customer.email || customer.email.trim() === '') {
        const customerName = customer.company_name || customer.contact_person || `Customer ID: ${customer.id}`;
        showError(`Cannot send email: "${customerName}" does not have an email address. Please edit the customer profile and add an email address first.`);
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customer.email)) {
        showError(`Cannot send email: Customer email "${customer.email}" is not valid. Please update the customer's email address.`);
        return;
      }

      // Get company settings for email content
      const company = selectedCompany || companySettings.find(c => c.is_default) || selectedCompany || companySettings[0];
      
      if (!company) {
        showError('Cannot send email: No company settings found. Please go to Settings and configure your company information first, then try again.');
        navigate('/admin/settings');
        return;
      }

      showInfo('📄 Generating PDF attachment...');

      // Load full invoice details first
      const fullInvoiceRaw = await invoiceService.getInvoiceById(invoice.id);
      if (!fullInvoiceRaw) {
        showError('Invoice not found');
        return;
      }
      // Backfill intl_* banking defaults for legacy non-INR invoices so emailed PDF includes banking
      const emCustomer = customers.find(c => c.id === fullInvoiceRaw.customer_id);
      const emCurrency = getCurrencyInfo(emCustomer).code;
      const fullInvoice = applyIntlBankingFallback(fullInvoiceRaw as unknown as Record<string, unknown>, emCurrency) as unknown as typeof fullInvoiceRaw;

      // Generate high-quality PDF using the SAME format as download PDF
      const subtotal = fullInvoice.invoice_items?.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0) || 0;
      const totalTax = fullInvoice.invoice_items?.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price * item.tax_rate / 100), 0) || 0;
      const total = subtotal + totalTax;

      // Create PDF using EXACT same format as download function with branding
      const emailPdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = emailPdf.internal.pageSize.getWidth();
      const leftMargin = 10;
      const rightMargin = pageWidth - 10;
      let yPos = 10;
      
      // Get currency info for the customer
      const selectedCustomer = customer;
      const nativeCurrencyInfo = getCurrencyInfo(selectedCustomer);
      // Honor INR override: if invoice was saved with INR currency but customer's native currency is foreign
      const currencyInfo = (fullInvoice.currency_code === 'INR' && nativeCurrencyInfo.code !== 'INR')
        ? { symbol: '₹', code: 'INR', name: 'Rupees' }
        : nativeCurrencyInfo;

      // Use same branding system as download PDF
      const dimensions = PDFBrandingUtils.getStandardDimensions();
      
      // Apply branding images (header, footer, logo) - same as download
      const { contentStartY, contentEndY } = await PDFBrandingUtils.applyBranding(
        emailPdf, 
        company, 
        dimensions
      );
      
      // Create branded header section - same as download
      yPos = PDFBrandingUtils.createBrandedHeader(
        emailPdf,
        company,
        String(fullInvoice.invoice_number),
        String(new Date(fullInvoice.invoice_date).toLocaleDateString()),
        String(fullInvoice.due_date ? new Date(fullInvoice.due_date).toLocaleDateString() : 'N/A'),
        dimensions,
        contentStartY
      );
      
      // Company and Customer Information Section - Two columns with aligned starting positions
      emailPdf.setTextColor(0, 0, 0);
      
      // Remember starting position for both columns
      const fromToStartY = yPos;
      let fromYPos = fromToStartY;
      let billToYPos = fromToStartY;
      const billToX = 110;
      const billToMaxWidth = 85; // Maximum width for customer details to prevent overflow
      
      // FROM Section (Left Column)
      emailPdf.setFontSize(9);
      emailPdf.setFont('helvetica', 'bold');
      emailPdf.text('From:', leftMargin, fromYPos);
      
      fromYPos += 5;
      emailPdf.setFontSize(11);
      emailPdf.setFont('helvetica', 'bold');
      const companyNameLines = emailPdf.splitTextToSize(company.company_name, 85);
      emailPdf.text(companyNameLines, leftMargin, fromYPos);
      fromYPos += companyNameLines.length * 4.5;
      
      emailPdf.setFontSize(8);
      emailPdf.setFont('helvetica', 'normal');
      emailPdf.setTextColor(60, 60, 60);
      
      if (company.legal_name && company.legal_name !== company.company_name) {
        const legalNameLines = emailPdf.splitTextToSize(company.legal_name, 85);
        emailPdf.text(legalNameLines, leftMargin, fromYPos);
        fromYPos += legalNameLines.length * 4;
      }
      
      if (company.address_line1) {
        const address1Lines = emailPdf.splitTextToSize(company.address_line1, 85);
        emailPdf.text(address1Lines, leftMargin, fromYPos);
        fromYPos += address1Lines.length * 4;
      }
      
      if (company.address_line2) {
        const address2Lines = emailPdf.splitTextToSize(company.address_line2, 85);
        emailPdf.text(address2Lines, leftMargin, fromYPos);
        fromYPos += address2Lines.length * 4;
      }
      
      const companyLocation = [company.city, company.state, company.postal_code].filter(Boolean).join(', ');
      if (companyLocation) {
        const locationLines = emailPdf.splitTextToSize(companyLocation, 85);
        emailPdf.text(locationLines, leftMargin, fromYPos);
        fromYPos += locationLines.length * 4;
      }
      
      if (company.email) {
        const emailLines = emailPdf.splitTextToSize('Email: ' + company.email, 85);
        emailPdf.text(emailLines, leftMargin, fromYPos);
        fromYPos += emailLines.length * 4;
      }
      
      if (company.phone) {
        const phoneLines = emailPdf.splitTextToSize('Phone: ' + company.phone, 85);
        emailPdf.text(phoneLines, leftMargin, fromYPos);
        fromYPos += phoneLines.length * 4;
      }
      
      if (company.website) {
        const websiteLines = emailPdf.splitTextToSize('Website: ' + company.website, 85);
        emailPdf.text(websiteLines, leftMargin, fromYPos);
        fromYPos += websiteLines.length * 4;
      }
      
      const companyWithCountry = { country: company.country } as Customer;
      const taxFields = getCompanyTaxFields(company.country?.code);
      taxFields.fields.forEach((field) => {
        const value = company[field.key as keyof CompanySettings] as string | undefined;
        if (value) {
          const fieldLines = emailPdf.splitTextToSize(`${field.label}: ` + value, 85);
          emailPdf.text(fieldLines, leftMargin, fromYPos);
          fromYPos += fieldLines.length * 4;
        }
      });
      
      if (company.pan && !taxFields.fields.some(f => f.key === 'pan')) {
        const panLabel = (company.country?.code === 'IN' || company.country?.code === 'IND') ? 'PAN' : 'Tax ID';
        const panLines = emailPdf.splitTextToSize(`${panLabel}: ` + company.pan, 85);
        emailPdf.text(panLines, leftMargin, fromYPos);
        fromYPos += panLines.length * 4;
      }
      
      // BILL TO Section (Right Column) - aligned with FROM section
      emailPdf.setTextColor(0, 0, 0);
      emailPdf.setFontSize(9);
      emailPdf.setFont('helvetica', 'bold');
      emailPdf.text('Bill To:', billToX, billToYPos);
      
      billToYPos += 5;
      emailPdf.setFontSize(11);
      emailPdf.setFont('helvetica', 'bold');
      emailPdf.setTextColor(37, 99, 235);
      
      // Wrap customer name properly
      const customerName = customer.company_name || customer.contact_person || 'N/A';
      const customerNameLines = emailPdf.splitTextToSize(customerName, billToMaxWidth);
      emailPdf.text(customerNameLines, billToX, billToYPos);
      billToYPos += customerNameLines.length * 4.5;
      
      emailPdf.setFontSize(8);
      emailPdf.setFont('helvetica', 'normal');
      emailPdf.setTextColor(60, 60, 60);
      
      if (customer.contact_person && customer.company_name) {
        const attnText = 'Attn: ' + customer.contact_person;
        const attnLines = emailPdf.splitTextToSize(attnText, billToMaxWidth);
        emailPdf.text(attnLines, billToX, billToYPos);
        billToYPos += attnLines.length * 4;
      }
      
      if (customer.address_line1) {
        const addr1Lines = emailPdf.splitTextToSize(customer.address_line1, billToMaxWidth);
        emailPdf.text(addr1Lines, billToX, billToYPos);
        billToYPos += addr1Lines.length * 4;
      }
      
      if (customer.address_line2) {
        const addr2Lines = emailPdf.splitTextToSize(customer.address_line2, billToMaxWidth);
        emailPdf.text(addr2Lines, billToX, billToYPos);
        billToYPos += addr2Lines.length * 4;
      }
      
      const customerLocation = [customer.city, customer.state, customer.postal_code].filter(Boolean).join(', ');
      if (customerLocation) {
        const locationLines = emailPdf.splitTextToSize(customerLocation, billToMaxWidth);
        emailPdf.text(locationLines, billToX, billToYPos);
        billToYPos += locationLines.length * 4;
      }
      
      if (customer.email) {
        const emailText = 'Email: ' + customer.email;
        const emailLines = emailPdf.splitTextToSize(emailText, billToMaxWidth);
        emailPdf.text(emailLines, billToX, billToYPos);
        billToYPos += emailLines.length * 4;
      }
      
      if (customer.phone) {
        const phoneText = 'Phone: ' + customer.phone;
        const phoneLines = emailPdf.splitTextToSize(phoneText, billToMaxWidth);
        emailPdf.text(phoneLines, billToX, billToYPos);
        billToYPos += phoneLines.length * 4;
      }
      
      if (customer.gstin) {
        const taxRegLabel = getTaxRegistrationLabel(customer);
        const taxRegText = `${taxRegLabel}: ` + customer.gstin;
        const taxRegLines = emailPdf.splitTextToSize(taxRegText, billToMaxWidth);
        emailPdf.text(taxRegLines, billToX, billToYPos);
        billToYPos += taxRegLines.length * 4;
      }

      if (customer.pan) {
        const panLabel = (customer.country?.code === 'IN' || customer.country?.code === 'IND') ? 'PAN' : 'Tax ID';
        const panText = `${panLabel}: ` + customer.pan;
        const panLines = emailPdf.splitTextToSize(panText, billToMaxWidth);
        emailPdf.text(panLines, billToX, billToYPos);
        billToYPos += panLines.length * 4;
      }
      
      // Payment Status Badge - compact and professional
      const statusX = billToX;
      billToYPos += 5;
      const paymentStatusColor = fullInvoice.payment_status === 'paid' ? [34, 197, 94] : [239, 68, 68];
      emailPdf.setFillColor(paymentStatusColor[0], paymentStatusColor[1], paymentStatusColor[2]);
      emailPdf.roundedRect(statusX, billToYPos - 3, 25, 6, 1, 1, 'F');
      emailPdf.setTextColor(255, 255, 255);
      emailPdf.setFontSize(7);
      emailPdf.setFont('helvetica', 'bold');
      emailPdf.text((fullInvoice.payment_status === 'paid' ? 'COMPLETED' : fullInvoice.payment_status.toUpperCase()), statusX + 12.5, billToYPos + 1, { align: 'center' });

      // Set yPos to the maximum of both columns for proper spacing
      yPos = Math.max(fromYPos, billToYPos) + 10;

      // Project Details Section (if present)
      if (fullInvoice.project_title || fullInvoice.estimated_time || fullInvoice.company_contact_name) {
        emailPdf.setFillColor(250, 251, 252);
        const projectBoxHeight = 8 +
          (fullInvoice.project_title ? 4 : 0) +
          (fullInvoice.estimated_time ? 4 : 0) +
          (fullInvoice.company_contact_name ? 4 : 0);

        emailPdf.rect(leftMargin, yPos, 180, projectBoxHeight, 'F');
        emailPdf.setDrawColor(220, 220, 220);
        emailPdf.setLineWidth(0.1);
        emailPdf.rect(leftMargin, yPos, 180, projectBoxHeight);

        yPos += 3;
        emailPdf.setTextColor(37, 99, 235);
        emailPdf.setFontSize(9);
        emailPdf.setFont('helvetica', 'bold');
        emailPdf.text('Project Details', leftMargin + 2, yPos);
        yPos += 5;

        emailPdf.setFontSize(8);
        emailPdf.setFont('helvetica', 'normal');
        emailPdf.setTextColor(60, 60, 60);

        if (fullInvoice.project_title) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('Project: ', leftMargin + 2, yPos);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(String(fullInvoice.project_title), leftMargin + 20, yPos);
          yPos += 4;
        }

        if (fullInvoice.estimated_time) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('Timeline: ', leftMargin + 2, yPos);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(String(fullInvoice.estimated_time), leftMargin + 20, yPos);
          yPos += 4;
        }

        if (fullInvoice.company_contact_name) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('Contact: ', leftMargin + 2, yPos);
          emailPdf.setFont('helvetica', 'normal');
          let contactText = String(fullInvoice.company_contact_name);
          if (fullInvoice.company_contact_email) {
            contactText += ' (' + String(fullInvoice.company_contact_email) + ')';
          }
          if (fullInvoice.company_contact_phone) {
            contactText += ' | ' + String(fullInvoice.company_contact_phone);
          }
          emailPdf.text(contactText, leftMargin + 20, yPos);
          yPos += 4;
        }

        yPos += 8;
      }

      // Professional Items Table
      emailPdf.setFillColor(245, 247, 250);
      emailPdf.rect(leftMargin, yPos, 180, 8, 'F');
      
      emailPdf.setTextColor(37, 99, 235);
      emailPdf.setFontSize(8);
      emailPdf.setFont('helvetica', 'bold');
      emailPdf.text('Description', leftMargin + 2, yPos + 5);
      emailPdf.text('Qty', leftMargin + 95, yPos + 5, { align: 'center' });
      emailPdf.text('Rate', leftMargin + 120, yPos + 5, { align: 'center' });
      emailPdf.text(`${taxLabel}%`, leftMargin + 145, yPos + 5, { align: 'center' });
      emailPdf.text('Amount', leftMargin + 175, yPos + 5, { align: 'right' });
      
      yPos += 8;
      
      // Table border
      emailPdf.setDrawColor(220, 220, 220);
      emailPdf.setLineWidth(0.1);
      
      // Items with better spacing and typography
      emailPdf.setTextColor(0, 0, 0);
      emailPdf.setFont('helvetica', 'normal');
      
      // Get currency symbol dynamically from customer's country - with safety checks
      let safeCurrencySymbol = 'Rs.'; // Default safe ASCII fallback
      
      // Safely extract currency symbol and convert to ASCII-safe version
      if (currencyInfo && currencyInfo.code) {
        const currencyCode = currencyInfo.code.toUpperCase();
        switch (currencyCode) {
          case 'INR':
            safeCurrencySymbol = 'Rs.';
            break;
          case 'USD':
            safeCurrencySymbol = '$';
            break;
          case 'EUR':
            safeCurrencySymbol = '€';
            break;
          case 'GBP':
            safeCurrencySymbol = '£';
            break;
          default:
            safeCurrencySymbol = currencyCode || 'Rs.';
        }
      }
      
      console.log('📧 Email PDF currency symbol:', {
        customerCountry: selectedCustomer?.country_id || 'Unknown',
        currencySymbol: safeCurrencySymbol,
        currencyCode: currencyInfo?.code || 'Unknown',
        currencyName: currencyInfo?.name || 'Unknown'
      });
      
      // Helper function to format numbers with Indian comma format - SAME AS DOWNLOAD PDF
      const formatIndianNumber = (amount: number): string => {
        const amountStr = amount.toString();
        let wholePart: string;
        let decimalPart: string;
        
        if (!amountStr.includes('.')) {
          wholePart = amountStr;
          decimalPart = '00';
        } else {
          const parts = amountStr.split('.');
          wholePart = parts[0];
          decimalPart = parts[1];
          if (decimalPart.length === 1) {
            decimalPart = decimalPart + '0';
          } else if (decimalPart.length > 2) {
            decimalPart = decimalPart.substring(0, 2);
          }
        }
        
        // Add Indian comma formatting (lakhs/crores)
        let formattedWhole = '';
        const wholePartReversed = wholePart.split('').reverse().join('');
        
        for (let i = 0; i < wholePartReversed.length; i++) {
          if (i === 3) {
            formattedWhole = ',' + formattedWhole;
          } else if (i > 3 && (i - 3) % 2 === 0) {
            formattedWhole = ',' + formattedWhole;
          }
          formattedWhole = wholePartReversed[i] + formattedWhole;
        }
        
        return formattedWhole + '.' + decimalPart;
      };
      
      if (fullInvoice.invoice_items && fullInvoice.invoice_items.length > 0) {
        fullInvoice.invoice_items.forEach((item: any, index: number) => {
          // Calculate based on item type
          let itemSubtotal = 0;
          if (item.is_service_item && item.billable_hours) {
            const resourceCount = item.resource_count || 1;
            itemSubtotal = resourceCount * item.quantity * item.billable_hours * item.unit_price;
          } else {
            itemSubtotal = item.quantity * item.unit_price;
          }
          const itemTax = itemSubtotal * item.tax_rate / 100;
          const itemTotal = itemSubtotal + itemTax;
          
          // Calculate proper row height based on content
          const itemText = item.item_name + (item.description ? ` - ${item.description}` : '');
          const itemLines = emailPdf.splitTextToSize(itemText, 80); // Slightly reduce width for HSN code space
          const hasHsnCode = item.hsn_code ? true : false;
          const itemRowHeight = Math.max(itemLines.length * 3 + (hasHsnCode ? 6 : 3), 12); // Dynamic height
          
          // Alternating row background with proper height
          if (index % 2 === 0) {
            emailPdf.setFillColor(252, 253, 254);
            emailPdf.rect(leftMargin, yPos - 2, 180, itemRowHeight, 'F');
          }
          
          emailPdf.setFontSize(8);
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.setTextColor(0, 0, 0);
          
          // Item name with description - positioned at top of row
          emailPdf.text(itemLines, leftMargin + 2, yPos + 3);
          
          // Classification Code - positioned below description with proper spacing
          if (item.hsn_code) {
            const hsnYPos = yPos + 3 + (itemLines.length * 3) + 1; // Position below description
            emailPdf.setFontSize(6);
            emailPdf.setFont('helvetica', 'normal');
            emailPdf.setTextColor(100, 100, 100);
            const classificationLabel = getClassificationCodeLabel(customer);
            const shortLabel = classificationLabel === 'HSN Code' ? 'HSN' : 'Code';
            emailPdf.text(`${shortLabel}: ${item.hsn_code}`, leftMargin + 2, hsnYPos);
          }
          
          // Reset for numbers - position at the top baseline for proper alignment
          const numbersYPos = yPos + 3; // Same baseline as item text for proper alignment
          emailPdf.setFontSize(8);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.setTextColor(0, 0, 0);
          
          // Quantity with unit
          emailPdf.text(`${item.quantity} ${item.unit || 'pcs'}`, leftMargin + 95, numbersYPos, { align: 'center' });
          
          // Unit price with currency and comma formatting
          const formattedUnitPrice = formatIndianNumber(item.unit_price);
          emailPdf.text(`${safeCurrencySymbol} ${formattedUnitPrice}`, leftMargin + 120, numbersYPos, { align: 'center' });
          
          // Tax rate
          emailPdf.text(`${item.tax_rate.toFixed(1)}%`, leftMargin + 145, numbersYPos, { align: 'center' });
          
          // Total amount with currency and comma formatting
          emailPdf.setFont('helvetica', 'bold');
          const formattedItemTotal = formatIndianNumber(itemTotal);
          emailPdf.text(`${safeCurrencySymbol} ${formattedItemTotal}`, leftMargin + 175, numbersYPos, { align: 'right' });
          
          yPos += itemRowHeight;
        });
      } else {
        emailPdf.setFontSize(8);
        emailPdf.setTextColor(150, 150, 150);
        emailPdf.text('No items found', leftMargin + 2, yPos + 3);
        yPos += 8;
      }
      
      // Table bottom border
      emailPdf.setDrawColor(200, 200, 200);
      emailPdf.setLineWidth(0.3);
      emailPdf.line(leftMargin, yPos, leftMargin + 180, yPos);
      
      yPos += 10;
      
      // Professional Totals Section - aligned with table boundary
      const tableWidth = 180; // Same as table width
      const totalsWidth = 60; // Slightly wider for better formatting
      const totalsStartX = leftMargin + tableWidth - totalsWidth; // Right-align with table
      
      // Calculate totals box height based on whether discount is present
      const hasDiscount = fullInvoice.discount_amount && fullInvoice.discount_amount > 0;
      // const inrPayments = ((fullInvoice.currency_code || '').toUpperCase() !== 'INR')
      //   ? (fullInvoice.payments || [])
      //   : [];
      // const hasINRPaymentLine = inrPayments.length > 0;
      const isIndianCurrency = (fullInvoice.currency_code || '').toUpperCase() === 'INR';
      const totalsBoxHeight = (hasDiscount ? 31 : 25); // INR payment line removed

      // Clean totals box
      emailPdf.setFillColor(250, 251, 252);
      emailPdf.rect(totalsStartX, yPos - 3, totalsWidth, totalsBoxHeight, 'F');
      emailPdf.setDrawColor(225, 229, 235);
      emailPdf.setLineWidth(0.2);
      emailPdf.rect(totalsStartX, yPos - 3, totalsWidth, totalsBoxHeight);

      emailPdf.setTextColor(60, 60, 60);
      emailPdf.setFontSize(8);
      emailPdf.setFont('helvetica', 'normal');

      // Format the totals with Indian number formatting (no currency concatenation)
      const subtotalText = formatIndianNumber(subtotal);
      const taxAmountText = formatIndianNumber(totalTax);
      const finalTotalText = formatIndianNumber(total);

      // Subtotal - safe currency concatenation
      emailPdf.text('Subtotal:', totalsStartX + 3, yPos + 2);
      emailPdf.setFont('helvetica', 'bold');
      const subtotalWithCurrency = safeCurrencySymbol + ' ' + subtotalText;
      emailPdf.text(subtotalWithCurrency, totalsStartX + totalsWidth - 3, yPos + 2, { align: 'right' });

      yPos += 6;

      // Discount (if applicable)
      if (fullInvoice.discount_amount && fullInvoice.discount_amount > 0) {
        const discountText = formatIndianNumber(fullInvoice.discount_amount);
        emailPdf.setFont('helvetica', 'normal');
        emailPdf.setTextColor(34, 197, 94); // Green color
        const discountLabel = fullInvoice.discount_type === 'percentage'
          ? `Discount (${fullInvoice.discount_value}%):`
          : 'Discount:';
        emailPdf.text(discountLabel, totalsStartX + 3, yPos + 2);
        emailPdf.setFont('helvetica', 'bold');
        const discountWithCurrency = '- ' + safeCurrencySymbol + ' ' + discountText;
        emailPdf.text(discountWithCurrency, totalsStartX + totalsWidth - 3, yPos + 2, { align: 'right' });
        yPos += 6;
        emailPdf.setTextColor(60, 60, 60); // Reset color
      }

      emailPdf.setFont('helvetica', 'normal');
      emailPdf.text(`${taxLabel} Amount:`, totalsStartX + 3, yPos + 2);
      emailPdf.setFont('helvetica', 'bold');
      const taxWithCurrency = safeCurrencySymbol + ' ' + taxAmountText;
      emailPdf.text(taxWithCurrency, totalsStartX + totalsWidth - 3, yPos + 2, { align: 'right' });
      
      // Total line - elegant
      yPos += 6;
      emailPdf.setDrawColor(37, 99, 235);
      emailPdf.setLineWidth(0.3);
      emailPdf.line(totalsStartX + 3, yPos, totalsStartX + totalsWidth - 3, yPos);
      
      yPos += 6;
      emailPdf.setFontSize(9);
      emailPdf.setFont('helvetica', 'bold');
      emailPdf.setTextColor(37, 99, 235);
      emailPdf.text('Total:', totalsStartX + 3, yPos + 2);
      const finalTotalWithCurrency = safeCurrencySymbol + ' ' + finalTotalText;
      emailPdf.text(finalTotalWithCurrency, totalsStartX + totalsWidth - 3, yPos + 2, { align: 'right' });

      // if (hasINRPaymentLine) {
      //   const emTotalINRPaid = inrPayments.reduce((sum, p) => sum + p.amount, 0);
      //   yPos += 6;
      //   emailPdf.setFontSize(8);
      //   emailPdf.setFont('helvetica', 'normal');
      //   emailPdf.setTextColor(100, 100, 100);
      //   emailPdf.text('Rs. ' + formatIndianNumber(emTotalINRPaid), totalsStartX + totalsWidth - 3, yPos + 2, { align: 'right' });
      // }

      yPos += 8;
      
      // Amount in Words - positioned directly below totals
      const amountInWords = formatAmountInWords(total, currencyInfo.name);
      
      emailPdf.setTextColor(37, 99, 235);
      emailPdf.setFontSize(9);
      emailPdf.setFont('helvetica', 'bold');
      emailPdf.text('Amount in Words', totalsStartX, yPos);
      
      yPos += 5;
      emailPdf.setFontSize(7);
      emailPdf.setFont('helvetica', 'italic');
      emailPdf.setTextColor(60, 60, 60);
      const amountLines = emailPdf.splitTextToSize(amountInWords, totalsWidth);
      emailPdf.text(amountLines, totalsStartX, yPos);
      
      yPos += amountLines.length * 3 + 8;

      // Smart layout: Banking details and Notes positioning (same as download PDF)
      const leftSectionStart = leftMargin;
      const isIndianCompany = company.country?.code === 'IN' || company.country?.code === 'IND' ||
        company.country_id?.toUpperCase() === 'IN' || company.country_id?.toUpperCase() === 'IND';
      const bankingDetailsAvailable = !!(company.bank_name || company.account_number || company.ifsc_code ||
        company.iban || company.swift_bic) &&
        (!isIndianCompany || isIndianCurrency);
      const intlBankingAvailable = isIndianCompany && !isIndianCurrency &&
        !!(fullInvoice.intl_account_name || fullInvoice.intl_account_number);
      const notesAvailable = fullInvoice.notes;

      // Helper: render international banking box (region-specific fields, no QR)
      const renderIntlBankingBox = (startX: number, startY: number, boxWidth: number) => {
        const invCurrency = (fullInvoice.currency_code || '').toUpperCase();
        let fields: Array<[string, string | undefined]>;
        if (invCurrency === 'EUR') {
          fields = [
            ['Account Name:', fullInvoice.intl_account_name],
            ['IBAN:', fullInvoice.intl_iban],
            ['Swift/BIC:', fullInvoice.intl_swift_bic],
            ['Address:', fullInvoice.intl_bank_address],
          ];
        } else if (invCurrency === 'GBP') {
          fields = [
            ['Account Name:', fullInvoice.intl_account_name],
            ['IBAN:', fullInvoice.intl_iban],
            ['Account No:', fullInvoice.intl_account_number],
            ['Sort Code:', fullInvoice.intl_sort_code],
            ['Swift/BIC:', fullInvoice.intl_swift_bic],
            ['Address:', fullInvoice.intl_bank_address],
          ];
        } else if (invCurrency === 'USD') {
          fields = [
            ['Account Name:', fullInvoice.intl_account_name],
            ['Account No:', fullInvoice.intl_account_number],
            ['Account Type:', fullInvoice.intl_account_type],
            ['Routing No:', fullInvoice.intl_routing_number],
            ['Swift/BIC:', fullInvoice.intl_swift_bic],
            ['Address:', fullInvoice.intl_bank_address],
          ];
        } else {
          fields = [
            ['Account Name:', fullInvoice.intl_account_name],
            ['IBAN:', fullInvoice.intl_iban],
            ['Account No:', fullInvoice.intl_account_number],
            ['Account Type:', fullInvoice.intl_account_type],
            ['Sort Code:', fullInvoice.intl_sort_code],
            ['Routing No:', fullInvoice.intl_routing_number],
            ['Swift/BIC:', fullInvoice.intl_swift_bic],
            ['Address:', fullInvoice.intl_bank_address],
          ];
        }
        const filtered = fields.filter(([, v]) => v) as Array<[string, string]>;
        const intlBoxHeight = 4 + filtered.length * 4 + (fullInvoice.intl_bank_address ? 3 : 0);
        emailPdf.setFillColor(248, 250, 252);
        emailPdf.rect(startX, startY - 2, boxWidth, intlBoxHeight, 'F');
        emailPdf.setDrawColor(225, 229, 235);
        emailPdf.setLineWidth(0.2);
        emailPdf.rect(startX, startY - 2, boxWidth, intlBoxHeight);
        emailPdf.setFontSize(7);
        emailPdf.setTextColor(60, 60, 60);
        let cy = startY + 2;
        filtered.forEach(([label, val]) => {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text(label, startX + 2, cy);
          emailPdf.setFont('helvetica', 'normal');
          const valLines = emailPdf.splitTextToSize(val as string, boxWidth - 28);
          emailPdf.text(valLines, startX + 26, cy);
          cy += valLines.length > 1 ? valLines.length * 3 + 1 : 4;
        });
        return startY - 2 + intlBoxHeight;
      };
      
      // If we have banking details but no notes, position banking details beside totals
      if ((bankingDetailsAvailable || intlBankingAvailable) && !notesAvailable) {
        // Position banking details to the left of totals at the same height
        const bankingStartY = totalsStartX > 100 ? (yPos - amountLines.length * 3 - 8 - totalsBoxHeight) : yPos; // Align with totals if space allows
        
        emailPdf.setTextColor(37, 99, 235);
        emailPdf.setFontSize(9);
        emailPdf.setFont('helvetica', 'bold');
        emailPdf.text('Banking Details', leftSectionStart, bankingStartY);

        if (intlBankingAvailable) {
          const intlBoxBottomY = renderIntlBankingBox(leftSectionStart, bankingStartY + 5, 100);
          yPos = Math.max(yPos, intlBoxBottomY + 5);
        } else {
        const bankingYPos = bankingStartY + 5;
        emailPdf.setFillColor(248, 250, 252);
        let bankFieldCount = 0;
        if (company.bank_name) bankFieldCount++;
        if (company.account_number) bankFieldCount++;
        if (isIndianCompany && company.ifsc_code) bankFieldCount++;
        if (!isIndianCompany && company.iban) bankFieldCount++;
        if (!isIndianCompany && company.swift_bic) bankFieldCount++;
        const bankingBoxHeight = 4 + bankFieldCount * 4;
        const leftColWidth = 85;
        emailPdf.rect(leftSectionStart, bankingYPos - 2, leftColWidth, bankingBoxHeight, 'F');
        emailPdf.setDrawColor(225, 229, 235);
        emailPdf.setLineWidth(0.2);
        emailPdf.rect(leftSectionStart, bankingYPos - 2, leftColWidth, bankingBoxHeight);
        
        emailPdf.setFontSize(7);
        emailPdf.setTextColor(60, 60, 60);
        
        let bankingContentY = bankingYPos + 2;
        
        if (company.bank_name) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('Bank:', leftSectionStart + 2, bankingContentY);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(company.bank_name, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        
        if (company.account_number) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('A/C:', leftSectionStart + 2, bankingContentY);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(company.account_number, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        
        if (isIndianCompany && company.ifsc_code) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text(`${getBankingLabel(company)}:`, leftSectionStart + 2, bankingContentY);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(company.ifsc_code, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        if (!isIndianCompany && company.iban) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('IBAN:', leftSectionStart + 2, bankingContentY);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(company.iban, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        if (!isIndianCompany && company.swift_bic) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('SWIFT/BIC:', leftSectionStart + 2, bankingContentY);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(company.swift_bic, leftSectionStart + 22, bankingContentY);
        }
        
        // QR code directly below banking box (side-by-side layout)
        const emBankBoxBottomY1 = bankingYPos - 2 + bankingBoxHeight + 5;
        const emQrData1 = (isIndianCompany && isIndianCurrency) ? await loadQRCodeImage() : null;
        if (emQrData1) {
          const qrPdfWidth = 50;
          const qrPdfHeight = qrPdfWidth * (emQrData1.height / emQrData1.width);
          emailPdf.addImage(emQrData1.dataUrl, 'JPEG', leftSectionStart, emBankBoxBottomY1, qrPdfWidth, qrPdfHeight, undefined, 'FAST');
          emailPdf.setFontSize(6);
          emailPdf.setTextColor(100, 100, 100);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text('Scan to Pay', leftSectionStart + qrPdfWidth / 2, emBankBoxBottomY1 + qrPdfHeight + 2, { align: 'center' });
          yPos = Math.max(yPos, emBankBoxBottomY1 + qrPdfHeight + 10);
        } else {
          yPos = Math.max(yPos, emBankBoxBottomY1);
        }
        } // end Indian banking (side-by-side)
        
      } else if (bankingDetailsAvailable || intlBankingAvailable) {
        // Default layout: Banking details below totals (when notes are present)
        emailPdf.setTextColor(37, 99, 235);
        emailPdf.setFontSize(9);
        emailPdf.setFont('helvetica', 'bold');
        emailPdf.text('Banking Details', leftSectionStart, yPos);
        
        yPos += 5;

        if (intlBankingAvailable) {
          const intlBoxBottomY = renderIntlBankingBox(leftSectionStart, yPos, 100);
          yPos = intlBoxBottomY + 5;
        } else {
        emailPdf.setFillColor(248, 250, 252);
        let bankFieldCount = 0;
        if (company.bank_name) bankFieldCount++;
        if (company.account_number) bankFieldCount++;
        if (isIndianCompany && company.ifsc_code) bankFieldCount++;
        if (!isIndianCompany && company.iban) bankFieldCount++;
        if (!isIndianCompany && company.swift_bic) bankFieldCount++;
        if (company.branch_name) bankFieldCount++;
        const bankingBoxHeight = 4 + bankFieldCount * 4;
        const leftColWidth = 90;
        emailPdf.rect(leftSectionStart, yPos - 2, leftColWidth, bankingBoxHeight, 'F');
        emailPdf.setDrawColor(225, 229, 235);
        emailPdf.setLineWidth(0.2);
        emailPdf.rect(leftSectionStart, yPos - 2, leftColWidth, bankingBoxHeight);
        
        emailPdf.setFontSize(7);
        emailPdf.setTextColor(60, 60, 60);
        
        let bankingContentY = yPos + 2;
        
        if (company.bank_name) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('Bank:', leftSectionStart + 2, bankingContentY);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(company.bank_name, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        
        if (company.account_number) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('A/C:', leftSectionStart + 2, bankingContentY);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(company.account_number, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        
        if (isIndianCompany && company.ifsc_code) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text(`${getBankingLabel(company)}:`, leftSectionStart + 2, bankingContentY);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(company.ifsc_code, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        if (!isIndianCompany && company.iban) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('IBAN:', leftSectionStart + 2, bankingContentY);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(company.iban, leftSectionStart + 15, bankingContentY);
          bankingContentY += 4;
        }
        if (!isIndianCompany && company.swift_bic) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('SWIFT/BIC:', leftSectionStart + 2, bankingContentY);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(company.swift_bic, leftSectionStart + 22, bankingContentY);
          bankingContentY += 4;
        }
        
        if (company.branch_name) {
          emailPdf.setFont('helvetica', 'bold');
          emailPdf.text('Branch:', leftSectionStart + 2, bankingContentY);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text(company.branch_name, leftSectionStart + 15, bankingContentY);
        }
        
        // QR code directly below banking box (stacked layout)
        const emBankBoxBottomY2 = yPos - 2 + bankingBoxHeight + 5;
        const emQrData2 = (isIndianCompany && isIndianCurrency) ? await loadQRCodeImage() : null;
        if (emQrData2) {
          const qrPdfWidth = 50;
          const qrPdfHeight = qrPdfWidth * (emQrData2.height / emQrData2.width);
          emailPdf.addImage(emQrData2.dataUrl, 'JPEG', leftSectionStart, emBankBoxBottomY2, qrPdfWidth, qrPdfHeight, undefined, 'FAST');
          emailPdf.setFontSize(6);
          emailPdf.setTextColor(100, 100, 100);
          emailPdf.setFont('helvetica', 'normal');
          emailPdf.text('Scan to Pay', leftSectionStart + qrPdfWidth / 2, emBankBoxBottomY2 + qrPdfHeight + 2, { align: 'center' });
          yPos = emBankBoxBottomY2 + qrPdfHeight + 10;
        } else {
          yPos = emBankBoxBottomY2;
        }
        } // end Indian banking (stacked)
      }

      // Notes Section - compact and clean
      if (fullInvoice.notes) {
        emailPdf.setTextColor(37, 99, 235);
        emailPdf.setFontSize(8);
        emailPdf.setFont('helvetica', 'bold');
        emailPdf.text('Notes', leftSectionStart, yPos);
        
        yPos += 4;
        emailPdf.setFontSize(6);
        emailPdf.setFont('helvetica', 'normal');
        emailPdf.setTextColor(60, 60, 60);
        const notesLines = emailPdf.splitTextToSize(fullInvoice.notes, 90);
        emailPdf.text(notesLines, leftSectionStart, yPos);
        yPos += notesLines.length * 2.5 + 4;
      }
      
      // Terms & Conditions - compact and clean
      if (fullInvoice.terms_conditions) {
        emailPdf.setTextColor(37, 99, 235);
        emailPdf.setFontSize(8);
        emailPdf.setFont('helvetica', 'bold');
        emailPdf.text('Terms & Conditions', leftSectionStart, yPos);
        
        yPos += 4;
        emailPdf.setFontSize(5.5);
        emailPdf.setFont('helvetica', 'normal');
        emailPdf.setTextColor(60, 60, 60);
        const termsLines = emailPdf.splitTextToSize(fullInvoice.terms_conditions, 90);
        emailPdf.text(termsLines, leftSectionStart, yPos);
        yPos += termsLines.length * 2.5 + 4;
      }
      
      // Professional Footer - respect footer image positioning
      console.log(`EMAIL PDF - Current yPos before footer: ${yPos.toFixed(1)}mm`);
      console.log(`EMAIL PDF - contentEndY (calculated by footer image): ${contentEndY.toFixed(1)}mm`);
      
      // Position footer text just above the footer image area
      const footerStartY = contentEndY - 2;
      yPos = footerStartY;
      
      console.log(`EMAIL PDF - Forced footer text yPos to: ${yPos.toFixed(1)}mm (based on contentEndY with gap)`);
      
      emailPdf.setDrawColor(240, 240, 240);
      emailPdf.setLineWidth(0.2);
      emailPdf.line(leftMargin, yPos, rightMargin, yPos);
      
      yPos += 4;
      emailPdf.setTextColor(37, 99, 235);
      emailPdf.setFontSize(7);
      emailPdf.setFont('helvetica', 'bold');
      emailPdf.text('Thank you for your business!', 105, yPos, { align: 'center' });
      
      yPos += 3;
      emailPdf.setTextColor(120, 120, 120);
      emailPdf.setFontSize(5.5);
      emailPdf.setFont('helvetica', 'normal');
      emailPdf.text('This is a computer-generated invoice and does not require a signature.', 105, yPos, { align: 'center' });

      // Get PDF as base64 string for email attachment
      const emailPdfBase64 = emailPdf.output('datauristring').split(',')[1]; // Remove data:application/pdf;base64, prefix

      // Check PDF size (much smaller now with native PDF generation)
      const emailPdfSizeKB = (emailPdfBase64.length * 3) / 4 / 1024; // Approximate size in KB
      console.log(`📄 Generated crisp PDF size: ${emailPdfSizeKB.toFixed(2)} KB`);
      
      if (emailPdfSizeKB > 25000) { // 25MB limit (very unlikely now with native PDF)
        showError(`❌ PDF file too large (${(emailPdfSizeKB/1024).toFixed(1)}MB). Maximum size is 25MB.`);
        return;
      }

      showInfo('📧 Sending invoice email...');

      // Check if this is a paid invoice
      const isPaidInvoice = fullInvoice.payment_status === 'paid';
      
      if (isPaidInvoice) {
        showInfo('💳 Sending payment confirmation email...');
      } else {
        showInfo('📄 Sending invoice email...');
      }

      // Send email using EmailService with PDF attachment
      try {
        await EmailService.sendInvoiceEmail(
          fullInvoice,
          customer,
          company,
          emailPdfBase64,
          isPaidInvoice
        );

        // Email sent successfully - update invoice status to 'sent' if not already paid
        if (!isPaidInvoice) {
          try {
            await invoiceService.updateInvoiceStatus(invoice.id, 'sent');
            
            // Refresh invoices list to show updated status
            await loadData();
            
            showSuccess(`✅ Email sent successfully! Invoice ${invoice.invoice_number} has been emailed to ${customer.email} and status updated to 'Sent'.`);
          } catch (statusError) {
            console.error('Failed to update invoice status:', statusError);
            showSuccess(`✅ Email sent successfully! Invoice ${invoice.invoice_number} has been emailed to ${customer.email}. (Note: Status update failed - please refresh the page)`);
          }
        } else {
          // For paid invoices, just confirm email was sent
          showSuccess(`✅ Payment confirmation email sent successfully! Thank you receipt for Invoice ${invoice.invoice_number} has been emailed to ${customer.email}.`);
        }

      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        throw new Error(`Failed to send email: ${emailError instanceof Error ? emailError.message : 'Email service unavailable'}`);
      }

    } catch (error) {
      console.error('Failed to email invoice:', error);
      showError(`❌ Failed to email invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCreatePaymentRequest = async (invoice: Invoice) => {
    try {
      showInfo('💳 Creating payment request...');

      // Ensure customers are loaded
      const allCustomers = await ensureCustomersLoaded();
      
      // Find the customer for this invoice
      const customer = allCustomers.find(c => c.id === invoice.customer_id);
      if (!customer) {
        showError(`Cannot create payment request: Customer not found (ID: ${invoice.customer_id}). Please refresh the page and try again.`);
        return;
      }

      // Validate customer has email
      if (!customer.email) {
        showError(`Cannot create payment request: "${customer.company_name || customer.contact_person}" does not have an email address. Please edit the customer profile and add an email address first.`);
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customer.email)) {
        showError(`Cannot create payment request: Customer email "${customer.email}" is not valid. Please update the customer's email address.`);
        return;
      }

      // Check if invoice is eligible for payment request
      if (invoice.payment_status === 'paid') {
        showError('Cannot create payment request: This invoice has already been paid.');
        return;
      }

      if (invoice.status === 'cancelled') {
        showError('Cannot create payment request: Cannot create payment request for cancelled invoices.');
        return;
      }

      // Get active payment gateways
      const activeGateways = await paymentService.getActivePaymentGateways();
      if (activeGateways.length === 0) {
        showError('No active payment gateways available. Please configure a payment gateway in the Payment Management section first.');
        return;
      }

      // Calculate invoice totals for payment amount
      const selectedCustomer = allCustomers.find(c => c.id === invoice.customer_id);
      const currencyInfo = getCurrencyInfo(selectedCustomer);
      
      // Calculate totals using the invoice items
      let subtotal = 0;
      let totalTax = 0;
      (invoice.invoice_items || []).forEach(item => {
        const lineTotal = item.quantity * item.unit_price;
        const taxAmount = (lineTotal * item.tax_rate) / 100;
        subtotal += lineTotal;
        totalTax += taxAmount;
      });
      const invoiceTotals = {
        subtotal,
        taxAmount: totalTax,
        total: subtotal + totalTax
      };

      // Use the first active gateway (you can enhance this to let user select)
      const primaryGateway = activeGateways[0];

      // Create payment request data
      const paymentRequestData = {
        invoice_id: invoice.id,
        gateway_id: primaryGateway.id,
        amount: invoiceTotals.total,
        currency: currencyInfo.code,
        description: `Payment for Invoice ${invoice.invoice_number}`,
        customer_email: customer.email,
        customer_name: customer.company_name || customer.contact_person || 'Valued Customer',
        customer_phone: customer.phone || undefined,
        expires_in_hours: 72, // 3 days expiry
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          customer_id: customer.id
        }
      };

      // Create the payment request
      const paymentRequest = await paymentService.createPaymentRequest(paymentRequestData);

      // Create payment link for email
      const paymentLink = await paymentService.createPaymentLink(paymentRequest.id, 'email', {
        payment_request_id: paymentRequest.id,
        link_type: 'email',
        recipient_email: customer.email,
        send_immediately: true
      });

      // Generate the actual payment URL that customers will use
      const paymentUrl = `${window.location.origin}/payment/${paymentLink.link_token}`;
      console.log('Payment URL generated for invoice system:', paymentUrl);

      // Send email notification with payment link using EmailService
      try {
        await EmailService.sendPaymentRequestEmail(customer.email, {
          customerName: customer.company_name || customer.contact_person || 'Valued Customer',
          invoiceNumber: invoice.invoice_number,
          amount: invoiceTotals.total,
          currency: currencyInfo.code,
          dueDate: new Date(invoice.due_date || '').toLocaleDateString() || 'N/A',
          paymentUrl: paymentUrl,
          paymentRequestId: paymentRequest.id,
          gatewayName: primaryGateway.name
        });

        showSuccess(`💳 Payment request created successfully! Email sent to ${customer.email} with secure payment link.`);
        
        // Optionally refresh data to show any status changes
        await loadData();

      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        showWarning(`Payment request created but email sending failed. Please send the payment link manually to ${customer.email}.`);
      }

    } catch (error) {
      console.error('Failed to create payment request:', error);
      showError(`❌ Failed to create payment request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUpdateInvoiceStatus = async (invoice: Invoice, newStatus: Invoice['status'], newPaymentStatus?: Invoice['payment_status']) => {
    try {
      await invoiceService.updateInvoiceStatus(invoice.id, newStatus, newPaymentStatus);
      showSuccess(`Invoice status updated to ${newStatus}${newPaymentStatus ? ` with payment status ${newPaymentStatus}` : ''}`);
      await loadData();
    } catch (error) {
      console.error('Failed to update invoice status:', error);
      showError(`Failed to update invoice status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleMarkAsPaid = (invoice: Invoice) => {
    setMarkAsPaidInvoice(invoice);
    const { isForeign } = getMarkAsPaidEntityInfo(invoice);
    const paidInfo = getInvoicePaidInfo(invoice);
    if (paidInfo.amount > 0 && (invoice.payment_status === 'paid' || invoice.status === 'completed')) {
      setMarkAsPaidAmount(String(paidInfo.amount));
    } else {
      setMarkAsPaidAmount(isForeign ? '' : String(invoice.total_amount));
    }
    setMarkAsPaidDate(invoice.paid_at || new Date().toISOString().split('T')[0]);
    setMarkAsPaidMethod('bank_transfer');
    setMarkAsPaidReference('');
    setMarkAsPaidDialogOpen(true);
  };

  const submitMarkAsPaid = async () => {
    if (!markAsPaidInvoice) return;
    const amount = parseFloat(markAsPaidAmount);
    if (!amount || amount <= 0) return;
    setMarkAsPaidLoading(true);
    try {
      const { entityCurrency, isForeign, symbol } = getMarkAsPaidEntityInfo(markAsPaidInvoice);
      // The entered amount is always already denominated in the settlement
      // currency being captured here — the invoice's own currency when it
      // matches the entity's currency, or the entity currency the admin
      // manually typed when isForeign. Never multiply by invoice.exchange_rate:
      // that field only stores the original-currency→INR rate (e.g. an Irish
      // EUR invoice still carries a EUR→INR rate), so multiplying by it here
      // silently inflated paid_amount for any non-Indian entity billed in its
      // own currency (e.g. IRL/EUR invoices).
      const entityAmount = amount;

      // Delete any previous payment records for this invoice to prevent duplicate payment rows
      await supabase.from('payments').delete().eq('invoice_id', markAsPaidInvoice.id);

      await invoiceService.createPayment({
        invoice_id: markAsPaidInvoice.id,
        payment_date: markAsPaidDate,
        amount: isForeign ? amount : markAsPaidInvoice.total_amount,
        inr_amount: entityAmount,
        original_currency_code: isForeign ? entityCurrency : (markAsPaidInvoice.currency_code || entityCurrency),
        original_amount: amount,
        payment_method: markAsPaidMethod || undefined,
        reference_number: markAsPaidReference || undefined,
        created_by: undefined
      });

      // Update invoice table directly with the exact entered paid amount in paid_amount (preserving inr_total_amount)
      const invoiceUpdates: Record<string, any> = { 
        paid_at: markAsPaidDate,
        status: 'completed',
        payment_status: 'paid'
      };

      // If inr_subtotal is available and this is a foreign-currency invoice, restore inr_total_amount to the issue date exchange value
      if (isForeign && markAsPaidInvoice.inr_subtotal) {
        invoiceUpdates.inr_total_amount = Number(markAsPaidInvoice.inr_subtotal) + Number(markAsPaidInvoice.inr_tax_amount || 0);
      }

      try {
        const { error: updateErr } = await supabase
          .from('invoices')
          .update({ 
            ...invoiceUpdates,
            paid_amount: entityAmount,
            paid_currency: isForeign ? entityCurrency : (markAsPaidInvoice.currency_code || entityCurrency)
          })
          .eq('id', markAsPaidInvoice.id);

        if (updateErr) {
          console.warn('Could not update paid_amount on invoices (column may need migration):', updateErr.message);
          await supabase
            .from('invoices')
            .update(invoiceUpdates)
            .eq('id', markAsPaidInvoice.id);
        }
      } catch (err) {
        console.warn('Error updating invoice with paid_amount:', err);
        await supabase
          .from('invoices')
          .update(invoiceUpdates)
          .eq('id', markAsPaidInvoice.id);
      }

      showSuccess(`✅ Invoice ${markAsPaidInvoice.invoice_number} payment recorded! Received: ${symbol}${entityAmount.toLocaleString('en-IN')}`);
      setMarkAsPaidDialogOpen(false);
      setMarkAsPaidInvoice(null);
      await loadData();
    } catch (error) {
      console.error('Failed to record payment:', error);
      showError(`Failed to record payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setMarkAsPaidLoading(false);
    }
  };

  // Sync invoice status with completed payments
  const handleSyncPaymentStatus = async (invoice: Invoice) => {
    try {
      setLoading(true);
      showInfo('🔄 Checking payment status for this invoice...');

      // Check if there are any completed payments for this invoice
      const { data: payments, error } = await supabase
        .from('payment_requests')
        .select(`
          *,
          payment_transactions (*)
        `)
        .eq('invoice_id', invoice.id)
        .eq('status', 'completed');

      if (error) {
        throw new Error(`Failed to check payment status: ${error.message}`);
      }

      if (payments && payments.length > 0) {
        const completedPayment = payments[0];
        showInfo('💳 Found completed payment - updating invoice status...');

        // Update invoice status to paid
        await handleUpdateInvoiceStatus(invoice, 'paid', 'paid');
        showSuccess(`✅ Invoice ${invoice.invoice_number} has been synced and marked as paid!`);
      } else {
        showInfo('ℹ️ No completed payments found for this invoice.');
      }
    } catch (error) {
      console.error('Failed to sync payment status:', error);
      showError(`Failed to sync payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load countries if not already loaded
      if (countries.length === 0) {
        try {
          const countriesData = await invoiceService.getCountries();
          setCountries(countriesData);
        } catch (countryError) {
          console.warn('Failed to load countries:', countryError);
          // Don't block the rest of the data loading
        }
      }

      // Always load company settings and invoice settings for PDF/email functionality
      try {
        const [companyData, invoiceSettingsData] = await Promise.all([
          invoiceService.getCompanySettings(),
          invoiceService.getInvoiceSettings(selectedCompany?.id)
        ]);
        setCompanySettings(companyData);
        setInvoiceSettings(invoiceSettingsData);
      } catch (settingsError) {
        console.warn('Failed to load settings:', settingsError);
        // Don't block the rest of the data loading
      }

      if (activeTab === 'dashboard') {
        const entityFilter = { company_settings_id: selectedCompany?.id };
        const [invoicesData, statsData, customersData] = await Promise.all([
          invoiceService.getInvoices({ ...filters, ...entityFilter }, currentPage, 10),
          invoiceService.getInvoiceStats(selectedCompany?.id),
          invoiceService.getCustomers(entityFilter, 1, 1000)
        ]);
        setInvoices(invoicesData.data);
        setCustomers(customersData.data || []);
        setTotalPages(invoicesData.total_pages);
        setStats(statsData);
      } else if (activeTab === 'invoices') {
        const entityFilter = { company_settings_id: selectedCompany?.id };
        const [invoicesData, customersData] = await Promise.all([
          invoiceService.getInvoices({ ...filters, ...entityFilter }, currentPage, 20),
          invoiceService.getCustomers(entityFilter, 1, 1000)
        ]);
        setInvoices(invoicesData.data);
        setCustomers(customersData.data || []);
        setTotalPages(invoicesData.total_pages);
      } else if (activeTab === 'create-invoice') {
        const entityFilter = { company_settings_id: selectedCompany?.id };
        const [customersData, productsData, termsData, previewNumber] = await Promise.all([
          invoiceService.getCustomers(entityFilter, 1, 1000),
          invoiceService.getProducts({}, 1, 1000),
          invoiceService.getTermsTemplates(),
          invoiceService.previewInvoiceNumber(selectedCompany?.id).catch(err => {
            console.warn('Failed to preview invoice number on tab load:', err);
            return 'INV-PREVIEW';
          })
        ]);
        setCustomers(customersData.data || []);
        setProducts(productsData.data || []);
        setTermsTemplates(termsData || []);
        if (previewNumber && previewNumber !== 'INV-PREVIEW') {
          setGeneratedInvoiceNumber(previewNumber);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchTerm });
    setCurrentPage(1);
  };

  const formatCurrency = (amount: number, currency = 'INR') => {
    const locale = currency === 'EUR' ? 'en-IE' : currency === 'USD' ? 'en-US' : currency === 'GBP' ? 'en-GB' : 'en-IN';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-slate-100 text-slate-600 line-through';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'partial': return 'bg-orange-100 text-orange-800';
      case 'paid': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'pending': return 'Pending';
      case 'partial': return 'Partial';
      default: return status;
    }
  };

  const renderDashboard = () => {
    // Dashboard tiles reflect the currently selected entity's own currency (EUR for Ireland, INR for India, etc.)
    const entityCurrencyCode = selectedCompany?.country?.currency_code || 'INR';
    const entityCurrencySymbol = getEntityCurrencySymbol(entityCurrencyCode);
    return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Invoices</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.total_invoices || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">{entityCurrencySymbol}</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(stats?.total_revenue || 0, entityCurrencyCode)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-yellow-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">{entityCurrencySymbol}</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Amount</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(stats?.pending_amount || 0, entityCurrencyCode)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">{entityCurrencySymbol}</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(stats?.this_month_revenue || 0, entityCurrencyCode)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Invoice Status Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{stats?.draft_invoices || 0}</div>
            <div className="text-sm text-gray-500">Draft</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats?.sent_invoices || 0}</div>
            <div className="text-sm text-gray-500">Sent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats?.paid_invoices || 0}</div>
            <div className="text-sm text-gray-500">Paid</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats?.overdue_invoices || 0}</div>
            <div className="text-sm text-gray-500">Overdue</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-400">
              {(stats?.total_invoices || 0) - (stats?.paid_invoices || 0) - (stats?.cancelled_invoices || 0)}
            </div>
            <div className="text-sm text-gray-500">Unpaid</div>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Invoices</h3>
        </div>
        <div className="overflow-x-auto">
          {renderRecentInvoicesTable(invoices.slice(0, 5))}
        </div>
      </div>
    </div>
    );
  };

  const isIndianCompany = (invoice?: Invoice | null) => {
    const company = invoice?.company_settings || selectedCompany || companySettings.find(c => c.is_default);
    if (!company) return true;
    return Boolean(company.is_default || company.country?.code === 'IN' || company.country?.currency_code === 'INR');
  };

  const getEntityCurrencySymbol = (code: string) => {
    const symbols: Record<string, string> = { INR: '₹', EUR: '€', USD: '$', GBP: '£', AED: 'AED', SGD: 'S$' };
    return symbols[code.toUpperCase()] || code;
  };

  // Determines the entity's own bank/settlement currency (INR for India, EUR for Ireland, etc.)
  // and whether the invoice's billed currency differs from it, requiring actual-received amount capture.
  const getMarkAsPaidEntityInfo = (invoice: Invoice) => {
    const isInd = isIndianCompany(invoice);
    const company = invoice.company_settings || selectedCompany || companySettings.find(c => c.is_default);
    const entityCurrency = isInd ? 'INR' : (company?.country?.currency_code || 'EUR');
    const isForeign = Boolean(invoice.currency_code && invoice.currency_code !== entityCurrency);
    return { isInd, entityCurrency, isForeign, symbol: getEntityCurrencySymbol(entityCurrency) };
  };

  const getInvoiceIssueInrAmount = (invoice: Invoice) => {
    if (invoice.currency_code === 'INR') return invoice.total_amount;
    // Prefer inr_subtotal + inr_tax_amount to reflect the issued currency exchange value
    if (invoice.inr_subtotal && Number(invoice.inr_subtotal) > 0) {
      return Number(invoice.inr_subtotal) + Number(invoice.inr_tax_amount || 0);
    }
    if (invoice.exchange_rate && invoice.total_amount && Number(invoice.exchange_rate) > 0) {
      return Number(invoice.total_amount) * Number(invoice.exchange_rate);
    }
    return invoice.inr_total_amount;
  };

  const getInvoicePaidInfo = (invoice: Invoice) => {
    const isInd = isIndianCompany(invoice);

    // 1. Direct paid_amount on invoice
    if (invoice.paid_amount && Number(invoice.paid_amount) > 0) {
      return {
        amount: Number(invoice.paid_amount),
        currency: invoice.paid_currency || (isInd ? 'INR' : (invoice.currency_code || 'INR'))
      };
    }

    // 2. Payments array (prioritize non-AUTO payments)
    if (invoice.payments && invoice.payments.length > 0) {
      const sorted = [...invoice.payments].sort((a, b) => {
        const aIsAuto = Boolean((a.reference_number || '').startsWith('AUTO-') || (a.notes || '').includes('Auto-'));
        const bIsAuto = Boolean((b.reference_number || '').startsWith('AUTO-') || (b.notes || '').includes('Auto-'));
        if (aIsAuto !== bIsAuto) return aIsAuto ? 1 : -1;
        const timeB = new Date(b.created_at || b.payment_date || 0).getTime();
        const timeA = new Date(a.created_at || a.payment_date || 0).getTime();
        return timeB - timeA;
      });
      const p = sorted[0];
      if (isInd) {
        const inrVal = p.inr_amount || (p.original_currency_code === 'INR' ? p.original_amount : null) || p.amount;
        return {
          amount: Number(inrVal || 0),
          currency: 'INR'
        };
      } else {
        return {
          amount: Number(p.amount || p.original_amount || 0),
          currency: p.original_currency_code || invoice.currency_code || 'EUR'
        };
      }
    }

    // 3. Fallback when marked paid/completed
    if (invoice.payment_status === 'paid' || invoice.status === 'completed' || invoice.status === 'paid') {
      if (isInd && invoice.currency_code !== 'INR' && invoice.inr_total_amount) {
        return {
          amount: Number(invoice.inr_total_amount),
          currency: 'INR'
        };
      }
      return {
        amount: Number(invoice.total_amount || 0),
        currency: invoice.currency_code || 'INR'
      };
    }

    return {
      amount: 0,
      currency: isInd ? 'INR' : (invoice.currency_code || 'INR')
    };
  };

  const getPaidAmount = (invoice: Invoice) => {
    return getInvoicePaidInfo(invoice).amount;
  };

  const getInrPaidAmount = (invoice: Invoice) => {
    return getInvoicePaidInfo(invoice).amount;
  };

  const renderInvoiceTable = (invoiceList: Invoice[] = invoices) => (
    <table className="min-w-full divide-y divide-gray-200 text-xs">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Invoice
          </th>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Customer
          </th>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Date
          </th>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Amount & INR Value
          </th>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Status
          </th>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Payment
          </th>
          <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider sticky right-0 bg-gray-50 border-l border-gray-200 shadow-xs z-10">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {invoiceList.map((invoice) => (
          <tr key={invoice.id} className={`hover:bg-gray-50 transition ${invoice.status === 'cancelled' ? 'opacity-60 bg-gray-50' : ''}`}>
            <td className="px-4 py-3 whitespace-nowrap">
              <div className={`font-bold ${invoice.status === 'cancelled' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                {invoice.invoice_number}
              </div>
              {invoice.subscription_id && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 mt-0.5">
                  Subscription
                </span>
              )}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-medium text-gray-900">
                {invoice.customer?.company_name || invoice.customer?.contact_person || 'N/A'}
              </div>
              {invoice.customer?.customer_code && (
                <div className="text-[11px] font-mono text-indigo-600 mt-0.5">
                  {getPrimaryCustomerId(invoice.customer, companySettings, selectedCompany)}
                </div>
              )}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-gray-600 font-medium">
              {new Date(invoice.invoice_date).toLocaleDateString()}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-bold text-gray-900">
                <CurrencyDisplay 
                  amount={invoice.total_amount}
                  currencyCode={invoice.currency_code}
                  inrAmount={getInvoiceIssueInrAmount(invoice)}
                  showBothCurrencies={true}
                  conversionDate={invoice.invoice_date}
                />
              </div>
              {(invoice.payment_status === 'paid' || invoice.status === 'completed' || invoice.status === 'paid') && (() => {
                const paidInfo = getInvoicePaidInfo(invoice);
                if (paidInfo.amount <= 0) return null;
                return (
                  <div className="mt-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
                    <span>Paid:</span>
                    <span className="font-bold">{formatCurrency(paidInfo.amount, paidInfo.currency)}</span>
                  </div>
                );
              })()}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full uppercase ${getStatusColor(invoice.status)}`}>
                {invoice.status}
              </span>
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full uppercase ${getPaymentStatusColor(invoice.payment_status)}`}>
                {getPaymentStatusLabel(invoice.payment_status)}
              </span>
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-right font-medium sticky right-0 bg-white border-l border-gray-200 shadow-xs z-10">
              <div className="flex items-center justify-end space-x-2">
                <button 
                  onClick={() => handleViewInvoice(invoice)}
                  className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition"
                  title="View Invoice"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {(invoice.status === 'draft' || invoice.status === 'sent') && (
                  <button 
                    onClick={() => handleEditInvoice(invoice)}
                    className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition"
                    title={invoice.status === 'draft' ? 'Edit draft invoice' : 'Edit sent invoice (creates new version)'}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                {invoice.status !== 'cancelled' && (
                  <button 
                    onClick={() => handleDownloadInvoice(invoice)}
                    className="p-1 text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 rounded transition"
                    title="Download Invoice"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                {invoice.status !== 'cancelled' && (
                  <button 
                    onClick={() => handleEmailInvoice(invoice)}
                    className="p-1 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded transition"
                    title="Email Invoice"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                )}

                {/* Mark as Paid / Record Payment Button */}
                {invoice.status !== 'cancelled' && (
                  <button 
                    onClick={() => handleMarkAsPaid(invoice)}
                    className="p-1 text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 rounded transition"
                    title={invoice.payment_status === 'paid' ? "Update Payment Details" : "Mark as Paid"}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}

                {/* Delete Button */}
                {invoice.status !== 'cancelled' && (
                  <button 
                    onClick={() => handleDeleteInvoice(invoice)}
                    className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition"
                    title="Delete Invoice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Separate table for recent invoices with limited actions
  const renderRecentInvoicesTable = (invoiceList: Invoice[]) => (
    <table className="min-w-full divide-y divide-gray-200 text-xs">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Invoice
          </th>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Customer
          </th>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Date
          </th>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Amount & INR Value
          </th>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Status
          </th>
          <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
            Payment
          </th>
          <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider sticky right-0 bg-gray-50 border-l border-gray-200 shadow-xs z-10">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {invoiceList.map((invoice) => (
          <tr key={invoice.id} className={`hover:bg-gray-50 transition ${invoice.status === 'cancelled' ? 'opacity-60 bg-gray-50' : ''}`}>
            <td className="px-4 py-3 whitespace-nowrap">
              <div className={`font-bold ${invoice.status === 'cancelled' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                {invoice.invoice_number}
              </div>
              {invoice.subscription_id && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 mt-0.5">
                  Subscription
                </span>
              )}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-medium text-gray-900">
                {invoice.customer?.company_name || invoice.customer?.contact_person || 'N/A'}
              </div>
              {invoice.customer?.customer_code && (
                <div className="text-[11px] font-mono text-indigo-600 mt-0.5">
                  {getPrimaryCustomerId(invoice.customer, companySettings, selectedCompany)}
                </div>
              )}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-gray-600 font-medium">
              {new Date(invoice.invoice_date).toLocaleDateString()}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-bold text-gray-900">
                <CurrencyDisplay 
                  amount={invoice.total_amount}
                  currencyCode={invoice.currency_code}
                  inrAmount={getInvoiceIssueInrAmount(invoice)}
                  showBothCurrencies={true}
                  conversionDate={invoice.invoice_date}
                />
              </div>
              {(invoice.payment_status === 'paid' || invoice.status === 'completed' || invoice.status === 'paid') && (() => {
                const paidInfo = getInvoicePaidInfo(invoice);
                if (paidInfo.amount <= 0) return null;
                return (
                  <div className="mt-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
                    <span>Paid:</span>
                    <span className="font-bold">{formatCurrency(paidInfo.amount, paidInfo.currency)}</span>
                  </div>
                );
              })()}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full uppercase ${getStatusColor(invoice.status)}`}>
                {invoice.status}
              </span>
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full uppercase ${getPaymentStatusColor(invoice.payment_status)}`}>
                {getPaymentStatusLabel(invoice.payment_status)}
              </span>
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-right font-medium sticky right-0 bg-white border-l border-gray-200 shadow-xs z-10">
              <div className="flex items-center justify-end space-x-2">
                <button 
                  onClick={() => handleViewInvoice(invoice)}
                  className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition"
                  title="View Invoice"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {invoice.status !== 'cancelled' && (
                  <button 
                    onClick={() => handleDownloadInvoice(invoice)}
                    className="p-1 text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 rounded transition"
                    title="Download Invoice"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderInvoicesList = () => (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
         <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
         <div className="mt-4 sm:mt-0 flex gap-2">
           <button
             onClick={handleGenerateDraftInvoices}
             className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
           >
             <FileText className="w-4 h-4 mr-2" />
             Generate Draft Invoices
           </button>
           <button
             onClick={() => openCreateInvoiceTab()}
             className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
           >
             <Plus className="w-4 h-4 mr-2" />
             Create Invoice
           </button>
         </div>
       </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search invoices..."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={filters.payment_status || ''}
              onChange={(e) => setFilters({ ...filters, payment_status: e.target.value || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Payments</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto relative">
          {renderInvoiceTable()}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => openCustomerModal('add')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSearch} className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search customers by name, email, or company..."
          />
        </form>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading customers...</p>
          </div>
        )}
        
        {!loading && customers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Customers Found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'No customers match your search criteria.' : 'No customers are available. Create your first customer to get started.'}
            </p>
            {!searchTerm && (
              <button 
                onClick={() => openCustomerModal('add')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </button>
            )}
          </div>
        )}

        {!loading && customers.length > 0 && (
          <>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credit Limit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {customer.company_name || customer.contact_person}
                    </div>
                    {customer.company_name && customer.contact_person && (
                      <div className="text-sm text-gray-500">{customer.contact_person}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{customer.email}</div>
                    <div className="text-sm text-gray-500">{customer.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {customer.city}, {customer.state}
                    </div>
                    <div className="text-sm text-gray-500">{customer.postal_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatCurrency(customer.credit_limit || 0)}
                    </div>
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
                        onClick={() => openCustomerModal('view', customer)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Customer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => openCustomerModal('edit', customer)}
                        className="text-gray-600 hover:text-gray-900"
                        title="Edit Customer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCustomer(customer)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Customer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        )}
        
        {/* Pagination */}
        {!loading && customers.length > 0 && totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Products & Services</h2>
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <button 
            onClick={() => loadData()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button 
            onClick={() => openProductModal('add')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search products..."
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        )}
        
        {!loading && products.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Products Found</h3>
            <p className="text-gray-500 mb-4">No products are available in the database. Create your first product to get started.</p>
            <button 
              onClick={() => openProductModal('add')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </button>
          </div>
        )}

        {!loading && products.length > 0 && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing {products.length} product{products.length !== 1 ? 's' : ''} from database
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tax Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.product_code}</div>
                        {product.description && (
                          <div className="text-xs text-gray-400 mt-1">{product.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{product.category || 'N/A'}</div>
                        {product.hsn_code && (
                          <div className="text-xs text-gray-500">HSN: {product.hsn_code}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(product.unit_price)} / {product.unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{product.tax_rate}%</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => openProductModal('view', product)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Product"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => openProductModal('edit', product)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Edit Product"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(product)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {!loading && products.length > 0 && totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoice system...</p>
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

  // Product Modal Component
  const renderProductModal = () => {
    if (!showProductModal) return null;

    const isReadOnly = modalMode === 'view';
    const modalTitle = modalMode === 'add' ? 'Add New Product' : 
                      modalMode === 'edit' ? 'Edit Product' : 'Product Details';

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
          {/* Modal Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">{modalTitle}</h3>
            <button
              onClick={closeProductModal}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={productFormData.name}
                  onChange={(e) => handleProductFormChange('name', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter product name"
                />
              </div>

              {/* Product Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Code
                </label>
                <input
                  type="text"
                  value={productFormData.product_code}
                  onChange={(e) => handleProductFormChange('product_code', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter product code"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={productFormData.category}
                  onChange={(e) => handleProductFormChange('category', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                >
                  <option value="">Select category</option>
                  <option value="Products">Products</option>
                  <option value="Services">Services</option>
                  <option value="Software">Software</option>
                  <option value="Hardware">Hardware</option>
                  <option value="Consulting">Consulting</option>
                </select>
              </div>

              {/* Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit *
                </label>
                <select
                  value={productFormData.unit}
                  onChange={(e) => handleProductFormChange('unit', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                >
                  <option value="">Select unit</option>
                  <option value="piece">Piece</option>
                  <option value="project">Project</option>
                  <option value="hour">Hour</option>
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  <option value="kg">Kilogram</option>
                  <option value="liter">Liter</option>
                </select>
              </div>

              {/* Unit Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productFormData.unit_price}
                  onChange={(e) => handleProductFormChange('unit_price', parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="0.00"
                />
              </div>

              {/* Tax Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Rate (%) *
                </label>
                <select
                  value={productFormData.tax_rate}
                  onChange={(e) => handleProductFormChange('tax_rate', parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                >
                  <option value={0}>0% (Exempt)</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
              </div>

              {/* HSN Code */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HSN Code
                </label>
                <input
                  type="text"
                  value={productFormData.hsn_code}
                  onChange={(e) => handleProductFormChange('hsn_code', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter HSN code"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={productFormData.description}
                  onChange={(e) => handleProductFormChange('description', e.target.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    isReadOnly ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter product description"
                />
              </div>

              {/* Active Status */}
              <div className="md:col-span-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="productActive"
                    checked={productFormData.is_active ?? true}
                    onChange={(e) => handleProductFormChange('is_active', e.target.checked)}
                    disabled={isReadOnly}
                    className={`h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${
                      isReadOnly ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                  <label htmlFor="productActive" className={`ml-2 text-sm font-medium ${
                    isReadOnly ? 'text-gray-500' : 'text-gray-700'
                  }`}>
                    Active Product
                  </label>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {productFormData.is_active ?? true 
                    ? 'This product is available for selection in invoices' 
                    : 'This product is hidden from invoice creation'}
                </p>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end space-x-3 mt-8">
            <button
              onClick={closeProductModal}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-md text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSaveProduct}
                disabled={modalLoading || !productFormData.name || !productFormData.unit}
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
                    Save Product
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Invoice Preview Content Function
  const renderInvoicePreviewContent = () => {
    const { subtotal, discountAmount, taxAmount, total } = calculateInvoiceTotals();
    const selectedCustomer = customers.find(c => c.id === invoiceFormData.customer_id);
    const nativeCurrencyInfo = getCurrencyInfo(selectedCustomer);
    // Apply INR override: bill foreign customer in INR
    const currencyInfo = useINROverride && nativeCurrencyInfo.code !== 'INR'
      ? { symbol: '₹', code: 'INR', name: 'Rupees' }
      : nativeCurrencyInfo;
    const company = selectedInvoice?.company_settings || selectedCompany || companySettings.find(c => c.is_default) || companySettings[0];
    
    // Get dynamic tax label based on customer's country
    const taxLabel = getTaxLabel(selectedCustomer);

    console.log('🖨️ Preview Currency Info:', {
      customer: selectedCustomer?.company_name || selectedCustomer?.contact_person,
      country: selectedCustomer?.country,
      currencyInfo
    });

    return (
      <div className="bg-white p-6 shadow-lg max-w-4xl mx-auto" style={{fontSize: '14px', lineHeight: '1.4'}}>
        {/* Company Header - More Compact */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            {company?.logo_url && (
              <img 
                src={company.logo_url} 
                alt="Company Logo" 
                className="h-12 w-auto mb-3"
              />
            )}
            <div className="text-xl font-bold text-gray-900 mb-1">{company?.company_name || 'Your Company'}</div>
            <div className="text-xs text-gray-600 leading-tight">
              {company?.address_line1 && <div>{company.address_line1}</div>}
              {company?.address_line2 && <div>{company.address_line2}</div>}
              <div>{company?.city && `${company.city}, `}{company?.state} {company?.postal_code}</div>
              <div className="flex gap-4 mt-1">
                {company?.email && <span>📧 {company.email}</span>}
                {company?.phone && <span>📞 {company.phone}</span>}
                {company?.website && <span>🌐 {company.website}</span>}
              </div>
              {company && (() => {
                const taxFields = getCompanyTaxFields(company.country?.code);
                return (
                  <div className="mt-1">
                    {taxFields.fields.map((field) => {
                      const value = company[field.key as keyof CompanySettings] as string | undefined;
                      if (value) {
                        return <div key={field.key}><strong>{field.label}:</strong> {value}</div>;
                      }
                      return null;
                    })}
                    {company.pan && !taxFields.fields.some(f => f.key === 'pan') && (() => {
                      const panLabel = (company.country?.code === 'IN' || company.country?.code === 'IND') ? 'PAN' : 'Tax ID';
                      return <div><strong>{panLabel}:</strong> {company.pan}</div>;
                    })()}
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="text-right ml-6">
            <div className="text-2xl font-bold text-blue-600 mb-2">INVOICE</div>
            <div className="text-xs text-gray-600">
              <div><strong>Invoice #:</strong> {generatedInvoiceNumber}</div>
              <div><strong>Date:</strong> {new Date(invoiceFormData.invoice_date).toLocaleDateString()}</div>
              {invoiceFormData.due_date && (
                <div><strong>Due Date:</strong> {new Date(invoiceFormData.due_date).toLocaleDateString()}</div>
              )}
            </div>
          </div>
        </div>

        {/* Bill To - Compact Layout */}
        {selectedCustomer && (
          <div className="mb-6">
            <div className="bg-gray-50 p-4 rounded">
              <div className="font-semibold text-gray-900 mb-2">Bill To:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-700">
                <div>
                  <div className="font-medium text-sm">{selectedCustomer.company_name || selectedCustomer.contact_person}</div>
                  {selectedCustomer.contact_person && selectedCustomer.company_name && (
                    <div className="text-gray-600">Attn: {selectedCustomer.contact_person}</div>
                  )}
                  <div className="mt-1">
                    {selectedCustomer.address_line1 && <div>{selectedCustomer.address_line1}</div>}
                    {selectedCustomer.address_line2 && <div>{selectedCustomer.address_line2}</div>}
                    <div>{selectedCustomer.city && `${selectedCustomer.city}, `}{selectedCustomer.state} {selectedCustomer.postal_code}</div>
                  </div>
                </div>
                <div className="space-y-1">
                  {selectedCustomer.email && <div>📧 {selectedCustomer.email}</div>}
                  {selectedCustomer.phone && <div>📞 {selectedCustomer.phone}</div>}
                  {selectedCustomer.gstin && <div><strong>{getTaxRegistrationLabel(selectedCustomer)}:</strong> {selectedCustomer.gstin}</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Project Details - if present */}
        {(invoiceFormData.project_title || invoiceFormData.estimated_time || invoiceFormData.company_contact_name) && (
          <div className="mb-6">
            <div className="bg-blue-50 p-4 rounded border border-blue-200">
              <div className="font-semibold text-blue-900 mb-2">Project Details:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-700">
                {invoiceFormData.project_title && (
                  <div>
                    <span className="font-medium">Project:</span> {invoiceFormData.project_title}
                  </div>
                )}
                {invoiceFormData.estimated_time && (
                  <div>
                    <span className="font-medium">Timeline:</span> {invoiceFormData.estimated_time}
                  </div>
                )}
                {invoiceFormData.company_contact_name && (
                  <div className="md:col-span-2">
                    <span className="font-medium">Contact:</span> {invoiceFormData.company_contact_name}
                    {invoiceFormData.company_contact_email && ` (${invoiceFormData.company_contact_email})`}
                    {invoiceFormData.company_contact_phone && ` | ${invoiceFormData.company_contact_phone}`}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Items Table - More Compact */}
        <div className="mb-6">
          <table className="w-full border-collapse border border-gray-300 text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-900">Item</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-900">Description</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-medium text-gray-900 w-20">{getClassificationCodeLabel(selectedCustomer)}</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-medium text-gray-900 w-24">
                  {/* Dynamic header - check if any service items exist */}
                  {invoiceFormData.items.some(item => item.is_service_item) ? 'Duration (months)' : 'Qty'}
                </th>
                <th className="border border-gray-300 px-2 py-2 text-center font-medium text-gray-900 w-24">
                  {/* Dynamic header - check if any service items exist */}
                  {invoiceFormData.items.some(item => item.is_service_item && item.billable_hours) ? 'Billable Hrs' : 'Unit'}
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-medium text-gray-900 w-24">
                  {/* Dynamic header - check if any service items exist */}
                  {invoiceFormData.items.some(item => item.is_service_item) ? 'Rate (/hour)' : 'Rate'}
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-medium text-gray-900 w-16">{taxLabel}%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-medium text-gray-900 w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoiceFormData.items.map((item, index) => {
                // Calculate line total based on item type
                let lineSubtotal = 0;
                if (item.is_service_item && item.billable_hours) {
                  const resourceCount = item.resource_count || 1;
                  lineSubtotal = resourceCount * item.quantity * item.billable_hours * item.unit_price;
                } else {
                  lineSubtotal = item.quantity * item.unit_price;
                }
                const lineTotal = lineSubtotal * (1 + item.tax_rate / 100);

                return (
                  <tr key={index}>
                    <td className="border border-gray-300 px-2 py-2 font-medium">{item.item_name}</td>
                    <td className="border border-gray-300 px-2 py-2">
                      {item.description}
                      {item.is_service_item && item.billable_hours && (
                        <div className="text-xs text-blue-600 mt-1">
                          <strong>Service Details:</strong><br/>
                          Resources: {item.resource_count || 1} | Billable Hrs/Month: {item.billable_hours}<br/>
                          Calculation: {item.resource_count || 1} × {item.quantity} months × {item.billable_hours} hrs × {formatCurrencyAmount(item.unit_price, currencyInfo)}
                        </div>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center text-gray-600">
                      {item.hsn_code || 'N/A'}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center font-medium">
                      {item.quantity}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center font-medium">
                      {item.is_service_item && item.billable_hours ? (
                        item.billable_hours
                      ) : (
                        item.unit
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-medium">
                      {formatCurrencyAmount(item.unit_price, currencyInfo)}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-right">{item.tax_rate}%</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-medium">
                      {formatCurrencyAmount(lineTotal, currencyInfo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals and Notes Section - Side by Side */}
        <div className="flex justify-between items-start mb-6">
          {/* Notes Section - Left Side */}
          <div className="flex-1 mr-8">
            {invoiceFormData.notes && (
              <div>
                <div className="font-semibold text-gray-900 mb-2 text-sm">Notes:</div>
                <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{invoiceFormData.notes}</div>
              </div>
            )}
          </div>
          
          {/* Totals Section - Right Side */}
          <div className="w-48">
            <div className="border border-gray-300 text-xs">
              <div className="flex justify-between px-3 py-2 border-b border-gray-300">
                <span className="font-medium">Subtotal:</span>
                <span>{formatCurrencyAmount(subtotal, currencyInfo)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between px-3 py-2 border-b border-gray-300 text-green-600">
                  <span className="font-medium">
                    Discount ({invoiceFormData.discount_type === 'percentage' ? `${invoiceFormData.discount_value}%` : 'Fixed'}):
                  </span>
                  <span>- {formatCurrencyAmount(discountAmount, currencyInfo)}</span>
                </div>
              )}
              <div className="flex justify-between px-3 py-2 border-b border-gray-300">
                <span className="font-medium">{taxLabel}:</span>
                <span>{formatCurrencyAmount(taxAmount, currencyInfo)}</span>
              </div>
              <div className="flex justify-between px-3 py-2 bg-gray-50 font-bold">
                <span>Total:</span>
                <span>{formatCurrencyAmount(total, currencyInfo)}</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-600 italic leading-tight">
              {formatAmountInWords(total, currencyInfo.name)}
            </div>
          </div>
        </div>

        {/* Terms and Banking Information Section - Compact */}
        {(() => {
          const isIndianCurrency = currencyInfo.code === 'INR';
          const invCurrency = currencyInfo.code;
          const isIndianCompany = company?.country?.code === 'IN' || company?.country?.code === 'IND' ||
            company?.country_id?.toUpperCase() === 'IN' || company?.country_id?.toUpperCase() === 'IND';
          const hasIndianBanking = (!isIndianCompany || isIndianCurrency) && !!(company?.bank_name || company?.iban || company?.swift_bic);
          const hasIntlBanking = !!(isIndianCompany && !isIndianCurrency &&
            (invoiceFormData.intl_account_name || invoiceFormData.intl_account_number));
          const hasBanking = hasIndianBanking || hasIntlBanking;

          // Build intl field rows for preview
          const intlFields: Array<[string, string | undefined]> = (() => {
            if (invCurrency === 'EUR') return [
              ['Account Name', invoiceFormData.intl_account_name],
              ['IBAN', invoiceFormData.intl_iban],
              ['Swift/BIC', invoiceFormData.intl_swift_bic],
              ['Address', invoiceFormData.intl_bank_address],
            ];
            if (invCurrency === 'GBP') return [
              ['Account Name', invoiceFormData.intl_account_name],
              ['IBAN', invoiceFormData.intl_iban],
              ['Account No', invoiceFormData.intl_account_number],
              ['Sort Code', invoiceFormData.intl_sort_code],
              ['Swift/BIC', invoiceFormData.intl_swift_bic],
              ['Address', invoiceFormData.intl_bank_address],
            ];
            if (invCurrency === 'USD') return [
              ['Account Name', invoiceFormData.intl_account_name],
              ['Account No', invoiceFormData.intl_account_number],
              ['Account Type', invoiceFormData.intl_account_type],
              ['Routing No', invoiceFormData.intl_routing_number],
              ['Swift/BIC', invoiceFormData.intl_swift_bic],
              ['Address', invoiceFormData.intl_bank_address],
            ];
            return [
              ['Account Name', invoiceFormData.intl_account_name],
              ['IBAN', invoiceFormData.intl_iban],
              ['Account No', invoiceFormData.intl_account_number],
              ['Account Type', invoiceFormData.intl_account_type],
              ['Sort Code', invoiceFormData.intl_sort_code],
              ['Routing No', invoiceFormData.intl_routing_number],
              ['Swift/BIC', invoiceFormData.intl_swift_bic],
              ['Address', invoiceFormData.intl_bank_address],
            ];
          })().filter(([, v]) => v) as Array<[string, string]>;

          return (
            <div className="space-y-4">
              {hasBanking ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {invoiceFormData.terms_conditions && (
                    <div>
                      <div className="font-semibold text-gray-900 mb-2 text-sm">Terms & Conditions:</div>
                      <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{invoiceFormData.terms_conditions}</div>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-gray-900 mb-2 text-sm">Banking Details:</div>
                    <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded leading-relaxed">
                      {hasIndianBanking && company ? (
                        <>
                          {company.bank_name && <div><strong>Bank:</strong> {company.bank_name}</div>}
                          {company.account_number && <div><strong>A/C:</strong> {company.account_number}</div>}
                          {isIndianCompany && company.ifsc_code && <div><strong>{getBankingLabel(company)}:</strong> {company.ifsc_code}</div>}
                          {!isIndianCompany && company.iban && <div><strong>IBAN:</strong> {company.iban}</div>}
                          {!isIndianCompany && company.swift_bic && <div><strong>SWIFT/BIC:</strong> {company.swift_bic}</div>}
                          {company.branch_name && <div><strong>Branch:</strong> {company.branch_name}</div>}
                        </>
                      ) : (
                        intlFields.map(([label, val]) => (
                          <div key={label}><strong>{label}:</strong> {val}</div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                invoiceFormData.terms_conditions && (
                  <div>
                    <div className="font-semibold text-gray-900 mb-2 text-sm">Terms & Conditions:</div>
                    <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{invoiceFormData.terms_conditions}</div>
                  </div>
                )
              )}
              {!hasBanking && !invoiceFormData.terms_conditions && null}
            </div>
          );
        })()}

        {/* Disclaimer - Compact and Italic */}
        <div className="mt-6 pt-3 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500 italic">
            This is a computer generated invoice and does not require a signature.
          </p>
        </div>
      </div>
    );
  };

   return (
     <div className="min-h-screen bg-gray-100">
       {/* Full-screen loading overlay */}
       {modalLoading && (
         <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
           <div className="bg-white rounded-lg p-6 shadow-xl flex items-center space-x-3">
             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
             <span className="text-sm font-medium text-gray-700">Saving invoice...</span>
           </div>
         </div>
       )}

       {/* Header */}
       <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">Invoice Management</h1>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: FileText },
              { key: 'invoices', label: 'Invoices', icon: FileText },
              { key: 'create-invoice', label: 'Create Invoice', icon: Plus },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => key === 'create-invoice' ? openCreateInvoiceTab() : goToTab(key as InvoiceTab)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'invoices' && renderInvoicesList()}
        {activeTab === 'create-invoice' && (
          <CreateInvoice
            invoiceFormData={invoiceFormData}
            onFormChange={handleInvoiceFormChange}
            onItemChange={handleInvoiceItemChange}
            onAddItem={addInvoiceItem}
            onRemoveItem={removeInvoiceItem}
            onTermsChange={handleTermsChange}
            onTermsTemplateSelect={handleTermsTemplateSelect}
            onDefaultProductChange={handleDefaultProductChange}
            onSaveInvoice={handleSaveInvoice}
            onCloseInvoice={() => goToTab('dashboard')}
            onShowPreview={handleShowPreview}
            customers={customers}
            products={products}
            termsTemplates={termsTemplates}
            companySettings={companySettings}
            selectedDefaultProduct={selectedDefaultProduct}
            selectedTermsTemplateId={selectedTermsTemplateId}
            globalHsnCode={globalHsnCode}
            generatedInvoiceNumber={generatedInvoiceNumber}
            calculateInvoiceTotals={calculateInvoiceTotals}
            getCurrencyInfo={getCurrencyInfo}
            formatCurrencyAmount={formatCurrencyAmount}
            formatAmountInWords={formatAmountInWords}
            useINROverride={useINROverride}
            onCurrencyToggle={() => setUseINROverride(prev => !prev)}
          />
        )}
      </main>

      {/* Product Modal */}
      {renderProductModal()}
      
      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {customerModalMode === 'view' ? 'Customer Details' : 
                 customerModalMode === 'edit' ? 'Edit Customer' : 'Add Customer'}
              </h3>
              <button
                onClick={closeCustomerModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={customerFormData.company_name}
                    onChange={(e) => handleCustomerFormChange('company_name', e.target.value)}
                    disabled={customerModalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    placeholder="Enter company name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={customerFormData.contact_person}
                    onChange={(e) => handleCustomerFormChange('contact_person', e.target.value)}
                    disabled={customerModalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    placeholder="Enter contact person name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={customerFormData.email}
                    onChange={(e) => handleCustomerFormChange('email', e.target.value)}
                    disabled={customerModalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    placeholder="Enter email address"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={customerFormData.phone}
                    onChange={(e) => handleCustomerFormChange('phone', e.target.value)}
                    disabled={customerModalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={customerFormData.address_line1}
                  onChange={(e) => handleCustomerFormChange('address_line1', e.target.value)}
                  disabled={customerModalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                  placeholder="Enter street address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={customerFormData.address_line2}
                  onChange={(e) => handleCustomerFormChange('address_line2', e.target.value)}
                  disabled={customerModalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={customerFormData.city}
                    onChange={(e) => handleCustomerFormChange('city', e.target.value)}
                    disabled={customerModalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    placeholder="Enter city"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={customerFormData.state}
                    onChange={(e) => handleCustomerFormChange('state', e.target.value)}
                    disabled={customerModalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    placeholder="Enter state/province"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={customerFormData.postal_code}
                    onChange={(e) => handleCustomerFormChange('postal_code', e.target.value)}
                    disabled={customerModalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    placeholder="Enter postal code"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <select
                  value={customerFormData.country_id}
                  onChange={(e) => handleCustomerFormChange('country_id', e.target.value)}
                  disabled={customerModalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                >
                  <option value="">Select Country</option>
                  {countries.map(country => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  {(() => {
                    // Get selected country for dynamic labels
                    const selectedCountry = countries.find(c => c.id === customerFormData.country_id);
                    const customerWithCountry = { country: selectedCountry } as Customer;
                    const taxRegLabel = getTaxRegistrationLabel(customerWithCountry);
                    const isIGST = getTaxLabel(customerWithCountry) === 'IGST';
                    
                    return (
                      <>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {taxRegLabel}
                        </label>
                        <input
                          type="text"
                          value={customerFormData.gstin}
                          onChange={(e) => handleCustomerFormChange('gstin', e.target.value.toUpperCase())}
                          disabled={customerModalMode === 'view'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                          placeholder={isIGST ? "e.g., 22AAAAA0000A1Z5" : "e.g., VAT123456789"}
                          pattern={isIGST ? "[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}" : undefined}
                          maxLength={isIGST ? 15 : 20}
                        />
                      </>
                    );
                  })()}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PAN
                  </label>
                  <input
                    type="text"
                    value={customerFormData.pan}
                    onChange={(e) => handleCustomerFormChange('pan', e.target.value.toUpperCase())}
                    disabled={customerModalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    placeholder="e.g., ABCDE1234F"
                    pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customerFormData.credit_limit}
                    onChange={(e) => handleCustomerFormChange('credit_limit', parseFloat(e.target.value) || 0)}
                    disabled={customerModalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    placeholder="Enter credit limit"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={customerFormData.payment_terms}
                    onChange={(e) => handleCustomerFormChange('payment_terms', parseInt(e.target.value) || 30)}
                    disabled={customerModalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    placeholder="e.g., 30"
                  />
                </div>
              </div>
            </div>

            {customerModalMode !== 'view' && (
              <>
                {/* Validation Guidelines */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">📋 Form Guidelines & International Policies:</h4>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• <strong>Required Fields:</strong> Either Company Name or Contact Person is mandatory</li>
                    <li>• <strong>Email Validation:</strong> Valid email format required if provided</li>
                    <li>• <strong>India (IGST):</strong> GSTIN: 15 chars (e.g., 22AAAAA0000A1Z5), PAN: 10 chars (e.g., ABCDE1234F)</li>
                    <li>• <strong>USA:</strong> Federal Tax ID/EIN format required for business customers</li>
                    <li>• <strong>UK:</strong> VAT number format validation for VAT-registered entities</li>
                    <li>• <strong>EU:</strong> EU VAT ID format compliance for cross-border transactions</li>
                    <li>• <strong>Canada:</strong> IGST/HST number format validation for registered businesses</li>
                    <li>• <strong>Australia:</strong> ABN (Australian Business Number) format verification</li>
                    <li>• <strong>Singapore:</strong> UEN (Unique Entity Number) format for business registration</li>
                    <li>• <strong>UAE:</strong> TRN (Tax Registration Number) format for VAT compliance</li>
                    <li>• <strong>Global Policy:</strong> All tax IDs auto-validated based on selected country</li>
                    <li>• <strong>Data Privacy:</strong> Customer data handled per GDPR, CCPA, and local regulations</li>
                  </ul>
                </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={closeCustomerModal}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-md text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomer}
                  disabled={modalLoading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                   {modalLoading ? (
                     <>
                       <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                       Saving...
                     </>
                   ) : 'Save Customer'}
                </button>
              </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto border w-[95%] max-w-7xl shadow-lg rounded-lg bg-white">
            {/* Close button overlay */}
            <button
              onClick={closeInvoiceModal}
              className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-full p-2 shadow-md"
            >
              <X className="w-6 h-6" />
            </button>

            {invoiceModalMode === 'add' ? (
              <CreateInvoice
                invoiceFormData={invoiceFormData}
                onFormChange={handleInvoiceFormChange}
                onItemChange={handleInvoiceItemChange}
                onAddItem={addInvoiceItem}
                onRemoveItem={removeInvoiceItem}
                onTermsChange={handleTermsChange}
                onTermsTemplateSelect={handleTermsTemplateSelect}
                onDefaultProductChange={handleDefaultProductChange}
                onSaveInvoice={handleSaveInvoice}
                onCloseInvoice={closeInvoiceModal}
                onShowPreview={handleShowPreview}
                customers={customers}
                products={products}
                termsTemplates={termsTemplates}
                companySettings={companySettings}
                selectedDefaultProduct={selectedDefaultProduct}
                selectedTermsTemplateId={selectedTermsTemplateId}
                globalHsnCode={globalHsnCode}
                generatedInvoiceNumber={generatedInvoiceNumber}
                calculateInvoiceTotals={calculateInvoiceTotals}
                getCurrencyInfo={getCurrencyInfo}
                formatCurrencyAmount={formatCurrencyAmount}
                formatAmountInWords={formatAmountInWords}
                modalLoading={modalLoading}
                useINROverride={useINROverride}
                onCurrencyToggle={() => setUseINROverride(prev => !prev)}
              />
            ) : invoiceModalMode === 'edit' && selectedInvoice ? (
              <EditInvoice
                selectedInvoice={selectedInvoice}
                invoiceFormData={invoiceFormData}
                onFormChange={handleInvoiceFormChange}
                onItemChange={handleInvoiceItemChange}
                onAddItem={addInvoiceItem}
                onRemoveItem={removeInvoiceItem}
                onSaveInvoice={handleSaveInvoice}
                onCloseInvoice={closeInvoiceModal}
                onTermsChange={handleTermsChange}
                onTermsTemplateSelect={handleTermsTemplateSelect}
                onDefaultProductChange={handleDefaultProductChange}
                customers={customers}
                products={products}
                termsTemplates={termsTemplates}
                companySettings={companySettings}
                selectedDefaultProduct={selectedDefaultProduct}
                selectedTermsTemplateId={selectedTermsTemplateId}
                globalHsnCode={globalHsnCode}
                modalLoading={modalLoading}
                calculateInvoiceTotals={calculateInvoiceTotals}
                getCurrencyInfo={getCurrencyInfo}
                formatCurrencyAmount={formatCurrencyAmount}
                formatAmountInWords={formatAmountInWords}
                getStatusColor={getStatusColor}
                useINROverride={useINROverride}
                onCurrencyToggle={() => setUseINROverride(prev => !prev)}
              />
            ) : null}

            {/* Modal Actions - only for add mode */}
            {invoiceModalMode === 'add' && (
              <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-6 rounded-b-lg">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={closeInvoiceModal}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveInvoice}
                    disabled={modalLoading || !invoiceFormData.customer_id || invoiceFormData.items.length === 0 || !invoiceFormData.items[0]?.item_name}
                    className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {modalLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Create Invoice
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Invoice Preview Modal */}
      {showInvoicePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-lg bg-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-900">
                Invoice Preview
                {/* Only show status badges for saved invoices (when selectedInvoice exists and has an ID) */}
                {selectedInvoice?.id && selectedInvoice?.status === 'cancelled' && (
                  <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    CANCELLED
                  </span>
                )}
                {selectedInvoice?.id && selectedInvoice?.payment_status === 'paid' && selectedInvoice?.status !== 'cancelled' && (
                  <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    PAID
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowInvoicePreview(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Preview Content with Watermark */}
            <div className="max-h-[80vh] overflow-y-auto relative">
              {/* Only show watermarks for saved invoices (when selectedInvoice exists and has an ID) */}
              {/* Cancelled Watermark Overlay */}
              {selectedInvoice?.id && selectedInvoice?.status === 'cancelled' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="transform rotate-45 opacity-10">
                    <div className="text-8xl font-bold text-red-600 select-none">
                      CANCELLED
                    </div>
                  </div>
                </div>
              )}
              
              {/* Paid Watermark Overlay */}
              {selectedInvoice?.id && selectedInvoice?.payment_status === 'paid' && selectedInvoice?.status !== 'cancelled' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="transform rotate-45 opacity-10">
                    <div className="text-8xl font-bold text-green-600 select-none">
                      PAID
                    </div>
                  </div>
                </div>
              )}
              
              {/* Invoice Content */}
              <div className={selectedInvoice?.id && (selectedInvoice?.status === 'cancelled' || selectedInvoice?.payment_status === 'paid') ? 'relative z-0' : ''}>
                {renderInvoicePreviewContent()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setShowInvoicePreview(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirmation Dialog */}
      <ConfirmDialog {...dialogProps} />

      {/* Record Payment Dialog */}
      {markAsPaidDialogOpen && markAsPaidInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
              <button onClick={() => setMarkAsPaidDialogOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Invoice <span className="font-semibold">{markAsPaidInvoice.invoice_number}</span>
                {' '}— Total: <span className="font-semibold">{markAsPaidInvoice.total_amount.toLocaleString('en-IN', { style: 'currency', currency: markAsPaidInvoice.currency_code || 'INR' })}</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {(() => {
                    const { isForeign, entityCurrency, symbol } = getMarkAsPaidEntityInfo(markAsPaidInvoice);
                    return isForeign
                      ? <>{entityCurrency} Amount Received ({symbol}) <span className="text-red-500">*</span></>
                      : <>Amount Paid <span className="text-red-500">*</span></>;
                  })()}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={markAsPaidAmount}
                  onChange={e => setMarkAsPaidAmount(e.target.value)}
                  placeholder={getMarkAsPaidEntityInfo(markAsPaidInvoice).isForeign ? `Enter actual ${getMarkAsPaidEntityInfo(markAsPaidInvoice).entityCurrency} amount received` : ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={markAsPaidDate}
                  onChange={e => setMarkAsPaidDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={markAsPaidMethod}
                  onChange={e => setMarkAsPaidMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="neft">NEFT / RTGS</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Transaction ID</label>
                <input
                  type="text"
                  value={markAsPaidReference}
                  onChange={e => setMarkAsPaidReference(e.target.value)}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setMarkAsPaidDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitMarkAsPaid}
                disabled={markAsPaidLoading || !markAsPaidAmount || parseFloat(markAsPaidAmount) <= 0}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {markAsPaidLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {markAsPaidLoading ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceManagement;
