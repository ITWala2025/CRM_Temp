import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, GripVertical, Lock, Unlock, FileText, AlertCircle } from 'lucide-react';
import { invoiceService } from '../../services/invoiceService';
import { contractService } from '../../services/contractService';
import { convertToINR, formatCurrencyWithSymbol } from '../../utils/currencyConverter';
import { useCompanyContext } from '../../contexts/CompanyContext';
import { formatCustomerOption } from '../../utils/customerCodeUtils';
import { IRISH_CONTRACT_TEMPLATES, getIrishTemplate } from '../../data/irishContractTemplates';
import { INDIAN_CONTRACT_TEMPLATES, getIndianTemplate } from '../../data/indianContractTemplates';
import type { Customer } from '../../types/invoice';
import type { CreateContractData, CreateContractSectionData, CreateContractMilestoneData, ContractType } from '../../types/contract';
import RichTextEditor from '../ui/RichTextEditor';

interface CreateContractModalProps {
  onSave: (contractData: CreateContractData) => Promise<void>;
  onClose: () => void;
  initialData: CreateContractData;
}

const CreateContractModal: React.FC<CreateContractModalProps> = ({ onSave, onClose, initialData }) => {
  const { companies, selectedCompany } = useCompanyContext();
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<'basic' | 'parties' | 'sections' | 'milestones'>('basic');
  const [templateApplied, setTemplateApplied] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateContractData>(initialData);
  const [sections, setSections] = useState<CreateContractSectionData[]>(initialData.sections || []);
  const [milestones, setMilestones] = useState<CreateContractMilestoneData[]>(initialData.milestones || []);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialData?.customer_id || '');

  // Entity jurisdiction resolution
  const targetCompany = companies.find(c => c.id === (formData.company_settings_id || initialData?.company_settings_id || selectedCompany?.id)) || selectedCompany || companies[0];

  const targetCountryCode = (
    targetCompany?.country?.code ||
    targetCompany?.country_id ||
    selectedCompany?.country?.code ||
    selectedCompany?.country_id ||
    formData?.entity_prefix ||
    initialData?.entity_prefix ||
    ''
  ).toUpperCase();

  const isIrishEntity = targetCountryCode === 'IE' || targetCountryCode === 'IRL' || formData?.entity_prefix === 'IRL' || initialData?.entity_prefix === 'IRL' || formData?.currency_code === 'EUR';
  const isIndianEntity = !isIrishEntity && (targetCountryCode === 'IN' || targetCountryCode === 'IND' || formData?.entity_prefix === 'IND' || initialData?.entity_prefix === 'IND');
  const hasEntityTemplates = isIrishEntity || isIndianEntity;
  const lawName = isIndianEntity ? 'Indian Law' : isIrishEntity ? 'Irish Law' : 'Contract';

  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);

  const contractTypes: ContractType[] = ['MSA', 'SOW', 'NDA', 'SLA', 'WORK_ORDER', 'MAINTENANCE', 'CONSULTING', 'LICENSE', 'OTHER'];
  const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'CNY'];

  // Load customers and dynamic templates on mount & company change
  useEffect(() => {
    loadCustomers();
    loadTemplates();
  }, [selectedCompany]);

  const loadTemplates = async () => {
    try {
      const countryCode = companies.find(c => c.id === selectedCompany?.id)?.country?.code;
      const tpls = await contractService.getAllTemplatesWithSections(countryCode);
      setAvailableTemplates(tpls);

      // Auto-apply matching template if contract_type is present and sections are default/empty
      if (initialData?.contract_type && tpls && tpls.length > 0 && (!sections || sections.length <= 2)) {
        const matching = tpls.find((t: any) => t.contract_type === initialData.contract_type);
        if (matching && matching.sections && matching.sections.length > 0) {
          setFormData(prev => ({
            ...prev,
            template_id: matching.id,
            contract_title: prev.contract_title || matching.contract_title || matching.template_name,
            preamble: matching.preamble || prev.preamble,
          }));
          setSections(matching.sections.map((s: any) => ({
            id: `tpl-${s.section_number}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            section_number: s.section_number,
            section_title: s.section_title,
            section_content: s.section_content,
            is_required: s.is_required,
            page_break_before: !!s.page_break_before,
          })));
          setTemplateApplied(true);
        }
      }
    } catch (err) {
      console.error('Error loading contract templates:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const filters = {
        company_settings_id: selectedCompany?.id ?? undefined,
      };
      const response = await invoiceService.getCustomers(filters, 1, 1000);
      setCustomers(response.data.filter(c => c.is_active));
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find(c => c.id === customerId);
    
    if (customer) {
      // Build complete address
      let fullAddress = '';
      if (customer.address_line1) {
        fullAddress = customer.address_line1;
        if (customer.address_line2) fullAddress += ', ' + customer.address_line2;
        if (customer.city) fullAddress += ', ' + customer.city;
        if (customer.state) fullAddress += ', ' + customer.state;
        if (customer.postal_code) fullAddress += ' - ' + customer.postal_code;
      }

      setFormData(prev => ({
        ...prev,
        party_b_name: customer.company_name || '',
        party_b_address: fullAddress,
        party_b_contact: customer.contact_person || customer.phone || '',
        // Populate the correct tax ID field based on entity type
        ...(isIrishEntity
          ? { party_b_vat_number: customer.gstin || '', party_b_cro_number: customer.pan || '' }
          : { party_b_gstin: customer.gstin || '', party_b_pan: customer.pan || '' }),
        payment_terms: customer.payment_terms ? `Net ${customer.payment_terms} days` : prev.payment_terms
      }));
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'contract_type' && availableTemplates.length > 0) {
      const matchingTpl = availableTemplates.find(t => t.contract_type === value);
      if (matchingTpl && matchingTpl.sections && matchingTpl.sections.length > 0) {
        setFormData(prev => ({
          ...prev,
          template_id: matchingTpl.id,
          contract_title: matchingTpl.contract_title || matchingTpl.template_name || prev.contract_title,
          preamble: matchingTpl.preamble || prev.preamble,
        }));
        setSections(matchingTpl.sections.map((s: any) => ({
          id: `tpl-${s.section_number}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          section_number: s.section_number,
          section_title: s.section_title,
          section_content: s.section_content,
          is_required: s.is_required,
          page_break_before: !!s.page_break_before,
        })));
        setTemplateApplied(true);
      }
    }
  };

  const applyEntityTemplate = (templateId: string) => {
    const tpl = availableTemplates.find(t => t.id === templateId);
    if (!tpl) return;
    setFormData(prev => ({
      ...prev,
      template_id: tpl.id,
      contract_title: prev.contract_title || tpl.contract_title || tpl.template_name,
      preamble: tpl.preamble || prev.preamble,
      currency_code: tpl.currency_code || prev.currency_code,
      contract_type: tpl.contract_type || prev.contract_type,
    }));
    setSections(tpl.sections.map((s: any) => ({
      id: `tpl-${s.section_number}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      section_number: s.section_number,
      section_title: s.section_title,
      section_content: s.section_content,
      is_required: s.is_required,
      is_locked: s.is_locked,
      page_break_before: !!s.page_break_before,
    })));
    setTemplateApplied(true);
    setActiveTab('basic');
  };

  const handleAddSection = () => {
    const newSection: CreateContractSectionData = {
      id: `temp-${Date.now()}`,
      section_number: sections.length + 1,
      section_title: '',
      section_content: '',
      is_required: false,
      page_break_before: false
    };
    setSections([...sections, newSection]);
  };

  const handleRemoveSection = (index: number) => {
    const updatedSections = sections.filter((_, i) => i !== index);
    // Renumber sections
    updatedSections.forEach((section, idx) => {
      section.section_number = idx + 1;
    });
    setSections(updatedSections);
  };

  const handleSectionChange = (index: number, field: keyof CreateContractSectionData, value: string | number | boolean) => {
    const updatedSections = [...sections];
    // Prevent unnecessary updates - check if value actually changed
    if (updatedSections[index][field] === value) {
      return;
    }
    updatedSections[index] = { ...updatedSections[index], [field]: value };
    setSections(updatedSections);
  };

  const handleAddMilestone = () => {
    const newMilestone: CreateContractMilestoneData = {
      id: `temp-${Date.now()}`,
      milestone_number: milestones.length + 1,
      milestone_title: '',
      description: '',
      deliverables: '',
      due_date: '',
      payment_amount: 0
    };
    setMilestones([...milestones, newMilestone]);
  };

  const handleRemoveMilestone = (index: number) => {
    const updatedMilestones = milestones.filter((_, i) => i !== index);
    // Renumber milestones
    updatedMilestones.forEach((milestone, idx) => {
      milestone.milestone_number = idx + 1;
    });
    setMilestones(updatedMilestones);
  };

  const handleMilestoneChange = (index: number, field: keyof CreateContractMilestoneData, value: string | number) => {
    const updatedMilestones = [...milestones];
    updatedMilestones[index] = { ...updatedMilestones[index], [field]: value };
    setMilestones(updatedMilestones);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Keep contract value in original currency (no conversion)
      // Clean up milestone dates
      const cleanedMilestones = milestones.map(m => ({
        ...m,
        due_date: m.due_date || undefined // Convert empty string to undefined
      }));

      // Clean up date fields - convert empty strings to undefined
      const contractData: CreateContractData = {
        ...formData,
        company_settings_id: formData.company_settings_id || initialData?.company_settings_id || selectedCompany?.id,
        expiry_date: formData.expiry_date || undefined,
        preamble: formData.preamble || undefined,
        contract_value: formData.contract_value, // Save in original currency
        sections: sections,
        milestones: cleanedMilestones.length > 0 ? cleanedMilestones : undefined
      };
      
      await onSave(contractData);
    } catch (error) {
      console.error('Error creating contract:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Create New Contract</h2>
            <p className="text-blue-100 text-sm">Fill in the details to create a contract</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-full p-2 transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex space-x-4 px-6">
            <button
              onClick={() => setActiveTab('basic')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'basic'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Basic Info
            </button>
            <button
              onClick={() => setActiveTab('parties')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'parties'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Parties
            </button>
            <button
              onClick={() => setActiveTab('sections')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sections'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Sections ({sections.length})
            </button>
            <button
              onClick={() => setActiveTab('milestones')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'milestones'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Milestones ({milestones.length})
            </button>
          </nav>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">

              {/* Entity Template Picker — shown for Irish and Indian entities */}
              {hasEntityTemplates && (
                <div className={`rounded-lg border p-4 ${templateApplied ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-start gap-3">
                    <FileText className={`w-5 h-5 mt-0.5 flex-shrink-0 ${templateApplied ? 'text-green-600' : 'text-blue-600'}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${templateApplied ? 'text-green-800' : 'text-blue-800'}`}>
                        {templateApplied ? `✓ ${lawName} Template Applied` : `${lawName} Templates Available`}
                      </p>
                      <p className={`text-xs mt-0.5 ${templateApplied ? 'text-green-700' : 'text-blue-700'}`}>
                        {templateApplied
                          ? 'Compliance clauses are locked and protected. Editable sections are marked with an unlock icon.'
                          : `Select a template to pre-populate this contract with ${lawName}-compliant sections and locked regulatory clauses.`}
                      </p>
                      {!templateApplied && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {availableTemplates.map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => applyEntityTemplate(t.id)}
                              className="px-3 py-1.5 text-xs font-medium bg-white border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-1.5"
                            >
                              <span>{t.template_name || t.label}</span>
                              {t.is_custom && (
                                <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 font-semibold rounded text-[10px]">Custom</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {templateApplied && (
                        <button
                          type="button"
                          onClick={() => { setTemplateApplied(false); setSections([]); }}
                          className="mt-2 text-xs text-green-700 underline hover:no-underline"
                        >
                          Clear template and start blank
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contract Title *
                  </label>
                  <input
                    type="text"
                    value={formData.contract_title}
                    onChange={(e) => handleInputChange('contract_title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contract Type *
                  </label>
                  <select
                    value={formData.contract_type}
                    onChange={(e) => handleInputChange('contract_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {contractTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contract Date *
                  </label>
                  <input
                    type="date"
                    value={formData.contract_date}
                    onChange={(e) => handleInputChange('contract_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => handleInputChange('effective_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date || ''}
                    onChange={(e) => handleInputChange('expiry_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contract Value
                  </label>
                  <input
                    type="number"
                    value={formData.contract_value || ''}
                    onChange={(e) => handleInputChange('contract_value', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency *
                  </label>
                  <select
                    value={formData.currency_code || 'INR'}
                    onChange={(e) => handleInputChange('currency_code', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {currencies.map(curr => (
                      <option key={curr} value={curr}>{curr}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Terms
                  </label>
                  <textarea
                    value={formData.payment_terms || ''}
                    onChange={(e) => handleInputChange('payment_terms', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preamble / Introduction Text
                  </label>
                  <textarea
                    value={formData.preamble || ''}
                    onChange={(e) => handleInputChange('preamble', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Enter any introductory text that should appear before the contract sections (e.g., WHEREAS clauses, background information, etc.)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This text will appear after the parties information and before the numbered sections.
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Parties Tab */}
          {activeTab === 'parties' && (
            <div className="space-y-6">
              {/* Party A - Readonly from Company Settings */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Party A (Our Company) - Read Only</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                    <input
                      type="text"
                      value={formData.party_a_name}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      value={formData.party_a_address || ''}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                    <input
                      type="text"
                      value={formData.party_a_contact || ''}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {isIrishEntity ? 'VAT Number' : 'GSTIN'}
                    </label>
                    <input type="text"
                      value={isIrishEntity ? (formData.party_a_vat_number || '') : (formData.party_a_gstin || '')}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {isIrishEntity ? 'CRO Number' : 'PAN'}
                    </label>
                    <input type="text"
                      value={isIrishEntity ? (formData.party_a_cro_number || '') : (formData.party_a_pan || '')}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Party B - Customer Selection */}
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Party B (Client/Customer)</h3>
                
                {/* Customer Dropdown */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Existing Customer *
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loadingCustomers}
                  >
                    <option value="">-- Select a customer --</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {formatCustomerOption(customer, companies, selectedCompany)}
                      </option>
                    ))}
                  </select>
                  {loadingCustomers && (
                    <p className="text-sm text-gray-500 mt-1">Loading customers...</p>
                  )}
                </div>

                {/* Customer Details (Auto-populated) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                    <input
                      type="text"
                      value={formData.party_b_name}
                      onChange={(e) => handleInputChange('party_b_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      placeholder="Select a customer or enter manually"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      value={formData.party_b_address || ''}
                      onChange={(e) => handleInputChange('party_b_address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                    <input
                      type="text"
                      value={formData.party_b_contact || ''}
                      onChange={(e) => handleInputChange('party_b_contact', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {isIrishEntity ? 'VAT Number' : 'GSTIN'}
                    </label>
                    <input type="text"
                      value={isIrishEntity ? (formData.party_b_vat_number || '') : (formData.party_b_gstin || '')}
                      onChange={(e) => handleInputChange(isIrishEntity ? 'party_b_vat_number' : 'party_b_gstin', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={isIrishEntity ? 'e.g., IE1234567T' : 'e.g., 22AAAAA0000A1Z5'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {isIrishEntity ? 'CRO Number' : 'PAN'}
                    </label>
                    <input type="text"
                      value={isIrishEntity ? (formData.party_b_cro_number || '') : (formData.party_b_pan || '')}
                      onChange={(e) => handleInputChange(isIrishEntity ? 'party_b_cro_number' : 'party_b_pan', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={isIrishEntity ? 'e.g., 123456' : 'e.g., ABCDE1234F'}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sections Tab */}
          {activeTab === 'sections' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Contract Sections</h3>
                  {templateApplied && (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-red-500" /> Locked = compliance clause &nbsp;
                      <Unlock className="w-3 h-3 text-green-600" /> Unlocked = editable
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Section
                </button>
              </div>

              {sections.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No sections added yet. Click "Add Section" or apply a {lawName.toLowerCase()} template above.
                </div>
              ) : (
                <div className="space-y-4">
                  {sections.map((section, index) => {
                    const locked = !!section.is_locked;
                    return (
                    <div key={section.id} className={`border rounded-lg p-4 ${locked ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <GripVertical className="w-5 h-5 text-gray-400" />
                          <span className="font-semibold text-gray-900">Section {section.section_number}</span>
                          {locked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                              <Lock className="w-3 h-3" /> Compliance — Locked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                              <Unlock className="w-3 h-3" /> Editable
                            </span>
                          )}
                        </div>
                        {!locked && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {locked && (
                        <div className="mb-2 flex items-start gap-2 text-xs text-red-700 bg-red-100 rounded p-2">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          This section contains a mandatory {lawName.toLowerCase()} compliance clause and cannot be modified.
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Section Title *</label>
                          <input
                            type="text"
                            value={section.section_title}
                            onChange={(e) => !locked && handleSectionChange(index, 'section_title', e.target.value)}
                            readOnly={locked}
                            className={`w-full px-3 py-2 border rounded-md ${locked ? 'border-red-200 bg-red-50 text-gray-600 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'}`}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Section Content {locked ? '' : '*'}
                          </label>
                          {locked ? (
                            <div className="w-full px-3 py-2 border border-red-200 rounded-md bg-red-50 text-sm text-gray-700 whitespace-pre-wrap min-h-[80px]">
                              {section.section_content}
                            </div>
                          ) : (
                            <RichTextEditor
                              value={section.section_content}
                              onChange={(value) => handleSectionChange(index, 'section_content', value)}
                              placeholder={section.section_title === 'Scope of Work' ? 'Describe the specific scope of work for this engagement…' : 'Enter section content.'}
                            />
                          )}
                        </div>
                        {!locked && (
                          <div className="flex items-center space-x-4">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={section.is_required}
                                onChange={(e) => handleSectionChange(index, 'is_required', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">Required Section</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={section.page_break_before}
                                onChange={(e) => handleSectionChange(index, 'page_break_before', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">Page Break Before</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Milestones Tab */}
          {activeTab === 'milestones' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Project Milestones</h3>
                <button
                  type="button"
                  onClick={handleAddMilestone}
                  className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Milestone
                </button>
              </div>

              {milestones.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No milestones added yet. Click "Add Milestone" to track project deliverables.
                </div>
              ) : (
                <div className="space-y-4">
                  {milestones.map((milestone, index) => (
                    <div key={milestone.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-3">
                        <span className="font-semibold text-gray-900">Milestone {milestone.milestone_number}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestone(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Milestone Title *</label>
                          <input
                            type="text"
                            value={milestone.milestone_title}
                            onChange={(e) => handleMilestoneChange(index, 'milestone_title', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <textarea
                            value={milestone.description}
                            onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={2}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Deliverables</label>
                          <textarea
                            value={milestone.deliverables}
                            onChange={(e) => handleMilestoneChange(index, 'deliverables', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                          <input
                            type="date"
                            value={milestone.due_date}
                            onChange={(e) => handleMilestoneChange(index, 'due_date', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
                          <input
                            type="number"
                            value={milestone.payment_amount}
                            onChange={(e) => handleMilestoneChange(index, 'payment_amount', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            step="0.01"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-md hover:from-red-600 hover:to-red-700 font-medium transition-all"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create Contract
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateContractModal;
