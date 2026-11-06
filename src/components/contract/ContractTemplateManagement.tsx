import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  Copy, 
  Trash2, 
  FileText, 
  Lock, 
  Unlock, 
  ShieldAlert, 
  RefreshCw, 
  X,
  Globe,
  CheckCircle
} from 'lucide-react';
import { contractService } from '../../services/contractService';
import { useToast } from '../ui/ToastProvider';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../ui/ConfirmDialog';
import EditTemplateModal from './EditTemplateModal';
import type { ContractTemplateWithSections, ContractType } from '../../types/contract';

const ContractTemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<ContractTemplateWithSections[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [lawFilter, setLawFilter] = useState<'ALL' | 'IND' | 'IRL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplateWithSections | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const { showSuccess, showError } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();

  const contractTypes: ContractType[] = [
    'MSA', 'SOW', 'NDA', 'SLA', 'WORK_ORDER', 'MAINTENANCE', 'CONSULTING', 'LICENSE', 'OTHER'
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await contractService.getAllTemplatesWithSections();
      setTemplates(data);
    } catch (err) {
      console.error('Error loading contract templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load contract templates');
      showError('Failed to load contract templates');
    } fontally: {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (templateData: any) => {
    try {
      await contractService.saveTemplate(templateData);
      showSuccess(`Template "${templateData.template_name}" saved successfully.`);
      loadTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      showError('Failed to save template');
      throw err;
    }
  };

  const handleDuplicateTemplate = (tpl: ContractTemplateWithSections) => {
    const duplicated: ContractTemplateWithSections = {
      ...tpl,
      id: undefined as any,
      template_name: `${tpl.template_name} (Copy)`,
      is_custom: true,
      sections: tpl.sections.map(s => ({
        ...s,
        id: undefined as any,
      }))
    };
    setSelectedTemplate(duplicated);
    setShowEditModal(true);
  };

  const handleDeleteTemplate = async (tpl: ContractTemplateWithSections) => {
    const isConfirmed = await confirm({
      title: 'Delete Custom Contract Template',
      message: `Are you sure you want to delete "${tpl.template_name}"? This action cannot be undone.`,
      confirmText: 'Delete Template',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (isConfirmed) {
      try {
        await contractService.deleteTemplate(tpl.id);
        showSuccess(`Template "${tpl.template_name}" deleted.`);
        loadTemplates();
      } catch (err) {
        console.error('Error deleting template:', err);
        showError('Failed to delete template');
      }
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = 
      t.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.contract_title && t.contract_title.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesLaw = lawFilter === 'ALL' || t.entity_law === 'ALL' || t.entity_law === lawFilter;
    const matchesType = typeFilter === 'ALL' || t.contract_type === typeFilter;

    return matchesSearch && matchesLaw && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Contract Templates</h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage standard legal agreement templates, preambles, and locked compliance clauses by jurisdiction.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadTemplates}
              className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Refresh Templates"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setSelectedTemplate(null);
                setShowEditModal(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Custom Template
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <select
              value={lawFilter}
              onChange={(e) => setLawFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="ALL">All Jurisdictions / Laws</option>
              <option value="IND">🇮🇳 Indian Law (IND)</option>
              <option value="IRL">🇮🇪 Irish Law (IRL/IE)</option>
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="ALL">All Contract Types</option>
              {contractTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          Loading contract templates...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No contract templates found</h3>
          <p className="text-sm text-gray-500 mt-1">
            Try adjusting your search criteria or create a new contract template.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const lockedCount = template.sections.filter(s => s.is_locked).length;
            const editableCount = template.sections.length - lockedCount;

            return (
              <div
                key={template.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      {template.contract_type}
                    </span>

                    <div className="flex items-center space-x-1.5">
                      {template.entity_law === 'IND' && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                          🇮🇳 Indian Law
                        </span>
                      )}
                      {template.entity_law === 'IRL' && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          🇮🇪 Irish Law
                        </span>
                      )}
                      {(!template.entity_law || template.entity_law === 'ALL') && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Global
                        </span>
                      )}
                      {template.is_custom && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                          Custom
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-gray-900 line-clamp-1">{template.template_name}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 min-h-[2.5rem]">
                    {template.description || `Standard template for ${template.contract_title || template.contract_type} agreements.`}
                  </p>

                  {/* Section Stats */}
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <span className="text-gray-500 block">Total Sections</span>
                      <span className="font-semibold text-gray-900 text-sm">{template.sections.length}</span>
                    </div>
                    <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                      <span className="text-red-600 block flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Locked Compliance
                      </span>
                      <span className="font-semibold text-red-900 text-sm">{lockedCount} clause{lockedCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowViewModal(true);
                    }}
                    className="text-xs text-gray-600 hover:text-blue-600 font-medium flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDuplicateTemplate(template)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 rounded hover:bg-gray-200 transition-colors"
                      title="Duplicate Template"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowEditModal(true);
                      }}
                      className="p-1.5 text-gray-500 hover:text-blue-600 rounded hover:bg-gray-200 transition-colors"
                      title="Edit Template"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {template.is_custom && (
                      <button
                        onClick={() => handleDeleteTemplate(template)}
                        className="p-1.5 text-gray-500 hover:text-red-600 rounded hover:bg-gray-200 transition-colors"
                        title="Delete Custom Template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Create Modal */}
      {showEditModal && (
        <EditTemplateModal
          template={selectedTemplate}
          onSave={handleSaveTemplate}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTemplate(null);
          }}
        />
      )}

      {/* View Detail Modal */}
      {showViewModal && selectedTemplate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedTemplate.template_name}</h2>
                <span className="text-xs text-gray-500">{selectedTemplate.contract_type} • {selectedTemplate.currency_code || 'INR'}</span>
              </div>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedTemplate(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {selectedTemplate.preamble && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-2">Preamble</h4>
                  <div
                    className="text-xs text-blue-950 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedTemplate.preamble }}
                  />
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3">Sections ({selectedTemplate.sections.length})</h4>
                <div className="space-y-3">
                  {selectedTemplate.sections.map((sec) => (
                    <div
                      key={sec.id}
                      className={`border rounded-lg p-4 text-xs ${
                        sec.is_locked ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-900">
                          Section {sec.section_number}: {sec.section_title}
                        </span>
                        {sec.is_locked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                            <Lock className="w-3 h-3" /> Locked Compliance Clause
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
                            <Unlock className="w-3 h-3" /> Editable Section
                          </span>
                        )}
                      </div>
                      <div
                        className="text-gray-700 leading-relaxed max-h-32 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: sec.section_content || '<em class="text-gray-400">Blank editable section content</em>' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setShowEditModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Edit Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default ContractTemplateManagement;
