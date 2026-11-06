import React, { useState } from 'react';
import { X, Save, Plus, Trash2, GripVertical, Lock, Unlock, AlertCircle } from 'lucide-react';
import RichTextEditor from '../ui/RichTextEditor';
import type { ContractTemplateWithSections, ContractType } from '../../types/contract';

interface EditTemplateModalProps {
  template?: ContractTemplateWithSections | null;
  onSave: (templateData: Partial<ContractTemplateWithSections> & { template_name: string; contract_type: ContractType }) => Promise<void>;
  onClose: () => void;
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({ template, onSave, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'sections'>('basic');
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    id: template?.id,
    template_name: template?.template_name || '',
    contract_type: (template?.contract_type || 'MSA') as ContractType,
    contract_title: template?.contract_title || template?.template_name || '',
    description: template?.description || '',
    entity_law: (template?.entity_law || 'ALL') as 'IRL' | 'IND' | 'ALL',
    currency_code: template?.currency_code || 'INR',
    preamble: template?.preamble || '',
    is_active: template?.is_active !== undefined ? template.is_active : true,
  });

  const [sections, setSections] = useState<Array<{
    id?: string;
    section_number: number;
    section_title: string;
    section_content: string;
    is_required: boolean;
    is_locked: boolean;
    page_break_before: boolean;
  }>>(
    template?.sections.map(s => ({
      id: s.id,
      section_number: s.section_number,
      section_title: s.section_title,
      section_content: s.section_content,
      is_required: !!s.is_required,
      is_locked: !!s.is_locked,
      page_break_before: !!s.page_break_before,
    })) || []
  );

  const contractTypes: ContractType[] = [
    'MSA', 'SOW', 'NDA', 'SLA', 'WORK_ORDER', 'MAINTENANCE', 'CONSULTING', 'LICENSE', 'OTHER'
  ];

  const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'CNY'];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSection = () => {
    setSections(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        section_number: prev.length + 1,
        section_title: '',
        section_content: '',
        is_required: false,
        is_locked: false,
        page_break_before: false,
      }
    ]);
  };

  const handleRemoveSection = (index: number) => {
    const updated = sections.filter((_, i) => i !== index);
    updated.forEach((sec, idx) => {
      sec.section_number = idx + 1;
    });
    setSections(updated);
  };

  const handleSectionChange = (index: number, field: string, value: any) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    setSections(updated);
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === sections.length - 1)) {
      return;
    }
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    updated.forEach((sec, idx) => {
      sec.section_number = idx + 1;
    });
    setSections(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.template_name.trim()) {
      setError('Template Name is required.');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        ...formData,
        sections: sections.map(s => ({
          id: s.id || '',
          template_id: formData.id || '',
          section_number: s.section_number,
          section_title: s.section_title,
          section_content: s.section_content,
          is_required: s.is_required,
          is_editable: !s.is_locked,
          is_locked: s.is_locked,
          page_break_before: s.page_break_before,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      });
      onClose();
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {template ? 'Edit Contract Template' : 'Create Contract Template'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Define standard clause sections, legal preambles, and locked compliance clauses for contract generation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Header */}
        <div className="border-b border-gray-200 px-6 bg-white">
          <nav className="flex space-x-6">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'basic'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              General Info & Preamble
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sections')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sections'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Template Sections ({sections.length})
            </button>
          </nav>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-red-600 flex-shrink-0" />
              {error}
            </div>
          )}

          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.template_name}
                    onChange={(e) => handleInputChange('template_name', e.target.value)}
                    placeholder="e.g. Master Services Agreement (Indian Law)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Contract Title
                  </label>
                  <input
                    type="text"
                    value={formData.contract_title}
                    onChange={(e) => handleInputChange('contract_title', e.target.value)}
                    placeholder="e.g. Master Services Agreement"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Applicable Law / Jurisdiction
                  </label>
                  <select
                    value={formData.entity_law}
                    onChange={(e) => handleInputChange('entity_law', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                  >
                    <option value="IND">Indian Law (IND Entity)</option>
                    <option value="IRL">Irish Law (IRL/IE Entity)</option>
                    <option value="ALL">All Entities (Global Template)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contract Type *
                  </label>
                  <select
                    value={formData.contract_type}
                    onChange={(e) => handleInputChange('contract_type', e.target.value as ContractType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                  >
                    {contractTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Currency
                  </label>
                  <select
                    value={formData.currency_code}
                    onChange={(e) => handleInputChange('currency_code', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                  >
                    {currencies.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description / Purpose
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe when this contract template should be used..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contract Preamble (Legal Introduction)
                </label>
                <RichTextEditor
                  value={formData.preamble}
                  onChange={(html) => handleInputChange('preamble', html)}
                  placeholder="THIS AGREEMENT is entered into between Party A and Party B..."
                />
              </div>
            </div>
          )}

          {activeTab === 'sections' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Template Sections</h3>
                  <p className="text-xs text-gray-500">
                    Add standard terms, schedule clauses, and mandatory compliance sections. Mark compliance sections as locked to protect regulatory text.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Section
                </button>
              </div>

              {sections.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 text-sm">
                  No sections created yet. Click "Add Section" to begin building this contract template.
                </div>
              ) : (
                <div className="space-y-4">
                  {sections.map((section, index) => (
                    <div key={section.id || index} className={`border rounded-lg p-4 transition-colors ${section.is_locked ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                          <span className="font-semibold text-sm text-gray-900">Section {section.section_number}</span>
                          <button
                            type="button"
                            onClick={() => handleSectionChange(index, 'is_locked', !section.is_locked)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                              section.is_locked
                                ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                            }`}
                          >
                            {section.is_locked ? (
                              <>
                                <Lock className="w-3 h-3" /> Locked Compliance Clause
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3" /> Editable Section
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveSection(index, 'up')}
                            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
                          >
                            ↑ Move Up
                          </button>
                          <button
                            type="button"
                            disabled={index === sections.length - 1}
                            onClick={() => handleMoveSection(index, 'down')}
                            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
                          >
                            ↓ Move Down
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(index)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Section Title *</label>
                          <input
                            type="text"
                            required
                            value={section.section_title}
                            onChange={(e) => handleSectionChange(index, 'section_title', e.target.value)}
                            placeholder="e.g. Governing Law and Jurisdiction"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Section Body Content</label>
                          <RichTextEditor
                            value={section.section_content}
                            onChange={(html) => handleSectionChange(index, 'section_content', html)}
                            placeholder="Enter legal terms or clause content..."
                          />
                        </div>

                        <div className="flex items-center space-x-6 pt-1">
                          <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={section.is_required}
                              onChange={(e) => handleSectionChange(index, 'is_required', e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <span>Required Section</span>
                          </label>

                          <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={section.page_break_before}
                              onChange={(e) => handleSectionChange(index, 'page_break_before', e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <span>Insert Page Break Before Section</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTemplateModal;
