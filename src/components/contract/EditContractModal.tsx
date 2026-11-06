import React, { useState } from 'react';
import { X, Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { convertToINR, convertFromINR, formatCurrencyWithSymbol } from '../../utils/currencyConverter';
import type { ContractWithDetails, CreateContractSectionData, CreateContractMilestoneData, ContractType, UpdateContractData } from '../../types/contract';
import RichTextEditor from '../ui/RichTextEditor';
import { useCompanyContext } from '../../contexts/CompanyContext';

interface EditContractModalProps {
  contract: ContractWithDetails;
  onSave: (updatedContract: UpdateContractData) => Promise<void>;
  onClose: () => void;
}

const EditContractModal: React.FC<EditContractModalProps> = ({ contract, onSave, onClose }) => {
  const { companies, selectedCompany } = useCompanyContext();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'parties' | 'sections' | 'milestones'>('basic');
  
  // Form state - use contract values directly (no conversion needed)
  const [formData, setFormData] = useState({
    company_settings_id: contract.company_settings_id || selectedCompany?.id,
    contract_title: contract.contract_title,
    contract_type: contract.contract_type,
    contract_date: contract.contract_date,
    effective_date: contract.effective_date,
    expiry_date: contract.expiry_date || '',
    preamble: contract.preamble || '',
    contract_value: contract.contract_value || 0, // Use original value directly
    currency_code: contract.currency_code,
    payment_terms: contract.payment_terms || '',
    notes: contract.notes || '',
    
    // Party A
    party_a_name: contract.party_a_name,
    party_a_address: contract.party_a_address || '',
    party_a_contact: contract.party_a_contact || '',
    party_a_gstin: contract.party_a_gstin || '',
    party_a_pan: contract.party_a_pan || '',
    party_a_vat_number: (contract as any).party_a_vat_number || contract.party_a_gstin || '',
    party_a_cro_number: (contract as any).party_a_cro_number || contract.party_a_pan || '',
    
    // Party B
    party_b_name: contract.party_b_name,
    party_b_address: contract.party_b_address || '',
    party_b_contact: contract.party_b_contact || '',
    party_b_gstin: contract.party_b_gstin || '',
    party_b_pan: contract.party_b_pan || '',
    party_b_vat_number: (contract as any).party_b_vat_number || contract.party_b_gstin || '',
    party_b_cro_number: (contract as any).party_b_cro_number || contract.party_b_pan || ''
  });

  // Entity jurisdiction resolution
  const targetCompany = companies.find(c => c.id === (formData.company_settings_id || contract.company_settings_id || selectedCompany?.id)) || selectedCompany || companies[0];

  const targetCountryCode = (
    targetCompany?.country?.code ||
    targetCompany?.country_id ||
    selectedCompany?.country?.code ||
    selectedCompany?.country_id ||
    ''
  ).toUpperCase();

  const isIrishEntity = targetCountryCode === 'IE' || targetCountryCode === 'IRL' || contract.contract_number?.includes('/IRL/') || formData.currency_code === 'EUR';

  const [sections, setSections] = useState<CreateContractSectionData[]>(
    contract.sections.map((s) => ({
      id: s.id,
      section_number: s.section_number,
      section_title: s.section_title,
      section_content: s.section_content,
      is_required: s.is_required,
      page_break_before: s.page_break_before
    }))
  );

  const [milestones, setMilestones] = useState<CreateContractMilestoneData[]>(
    (contract.milestones || []).map((m) => {
      // Convert payment amount from INR (stored) back to original currency (for display)
      const displayPaymentAmount = m.payment_amount && contract.currency_code !== 'INR'
        ? convertFromINR(m.payment_amount, contract.currency_code)
        : m.payment_amount || 0;
      
      return {
        id: m.id,
        milestone_number: m.milestone_number,
        milestone_title: m.milestone_title,
        description: m.description || '',
        deliverables: m.deliverables || '',
        due_date: m.due_date || '',
        payment_amount: displayPaymentAmount
      };
    })
  );

  const contractTypes: ContractType[] = ['MSA', 'SOW', 'NDA', 'SLA', 'WORK_ORDER', 'MAINTENANCE', 'CONSULTING', 'LICENSE', 'OTHER'];
  const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'CNY'];

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

      const updateData = {
        id: contract.id,
        ...formData,
        company_settings_id: formData.company_settings_id || contract.company_settings_id || selectedCompany?.id,
        expiry_date: formData.expiry_date || undefined, // Convert empty string to undefined
        preamble: formData.preamble || undefined,
        contract_value: formData.contract_value, // Save in original currency
        sections: sections,
        milestones: cleanedMilestones
      };
      
      await onSave(updateData);
    } catch (error) {
      console.error('Error saving contract:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Contract</h2>
            <p className="text-green-100 text-sm">{contract.contract_number}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-green-800 rounded-full p-2 transition-colors"
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
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Basic Info
            </button>
            <button
              onClick={() => setActiveTab('parties')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'parties'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Parties
            </button>
            <button
              onClick={() => setActiveTab('sections')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sections'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Sections ({sections.length})
            </button>
            <button
              onClick={() => setActiveTab('milestones')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'milestones'
                  ? 'border-green-600 text-green-600'
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
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contract Title *
                  </label>
                  <input
                    type="text"
                    value={formData.contract_title}
                    onChange={(e) => handleInputChange('contract_title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => handleInputChange('expiry_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contract Value
                  </label>
                  <input
                    type="number"
                    value={formData.contract_value}
                    onChange={(e) => handleInputChange('contract_value', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    step="0.01"
                  />

                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency *
                  </label>
                  <select
                    value={formData.currency_code}
                    onChange={(e) => handleInputChange('currency_code', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    value={formData.payment_terms}
                    onChange={(e) => handleInputChange('payment_terms', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preamble / Introduction Text
                  </label>
                  <textarea
                    value={formData.preamble}
                    onChange={(e) => handleInputChange('preamble', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Parties Tab */}
          {activeTab === 'parties' && (
            <div className="space-y-6">
              {/* Party A */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Party A (First Party)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name * <span className="text-xs text-gray-500">(from Company Settings)</span></label>
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
                      value={formData.party_a_address}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                    <input
                      type="text"
                      value={formData.party_a_contact}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {isIrishEntity ? 'VAT Number' : 'GSTIN'}
                    </label>
                    <input
                      type="text"
                      value={isIrishEntity ? (formData.party_a_vat_number || formData.party_a_gstin || '') : (formData.party_a_gstin || '')}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {isIrishEntity ? 'CRO Number' : 'PAN'}
                    </label>
                    <input
                      type="text"
                      value={isIrishEntity ? (formData.party_a_cro_number || formData.party_a_pan || '') : (formData.party_a_pan || '')}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Party B */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Party B (Second Party)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name * <span className="text-xs text-gray-500">(from Customer)</span></label>
                    <input
                      type="text"
                      value={formData.party_b_name}
                      onChange={(e) => handleInputChange('party_b_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      value={formData.party_b_address}
                      onChange={(e) => handleInputChange('party_b_address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                    <input
                      type="text"
                      value={formData.party_b_contact}
                      onChange={(e) => handleInputChange('party_b_contact', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {isIrishEntity ? 'VAT Number' : 'GSTIN'}
                    </label>
                    <input
                      type="text"
                      value={isIrishEntity ? (formData.party_b_vat_number || formData.party_b_gstin || '') : (formData.party_b_gstin || '')}
                      onChange={(e) => handleInputChange(isIrishEntity ? 'party_b_vat_number' : 'party_b_gstin', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {isIrishEntity ? 'CRO Number' : 'PAN'}
                    </label>
                    <input
                      type="text"
                      value={isIrishEntity ? (formData.party_b_cro_number || formData.party_b_pan || '') : (formData.party_b_pan || '')}
                      onChange={(e) => handleInputChange(isIrishEntity ? 'party_b_cro_number' : 'party_b_pan', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                <h3 className="text-lg font-semibold text-gray-900">Contract Sections</h3>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Section
                </button>
              </div>

              {sections.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No sections added yet. Click "Add Section" to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {sections.map((section, index) => (
                    <div key={section.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <GripVertical className="w-5 h-5 text-gray-400" />
                          <span className="font-semibold text-gray-900">Section {section.section_number}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSection(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Section Title *</label>
                          <input
                            type="text"
                            value={section.section_title}
                            onChange={(e) => handleSectionChange(index, 'section_title', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Section Content *</label>
                          <RichTextEditor
                            value={section.section_content}
                            onChange={(value) => handleSectionChange(index, 'section_content', value)}
                            placeholder="Enter section content. Use the toolbar for formatting."
                          />
                        </div>
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={section.is_required}
                              onChange={(e) => handleSectionChange(index, 'is_required', e.target.checked)}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Required Section</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={section.page_break_before}
                              onChange={(e) => handleSectionChange(index, 'page_break_before', e.target.checked)}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Page Break Before</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
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
                  className="flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            required
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <textarea
                            value={milestone.description}
                            onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            rows={2}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Deliverables</label>
                          <textarea
                            value={milestone.deliverables}
                            onChange={(e) => handleMilestoneChange(index, 'deliverables', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                          <input
                            type="date"
                            value={milestone.due_date}
                            onChange={(e) => handleMilestoneChange(index, 'due_date', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
                          <input
                            type="number"
                            value={milestone.payment_amount}
                            onChange={(e) => handleMilestoneChange(index, 'payment_amount', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
            className="flex items-center px-6 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 font-medium disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditContractModal;
