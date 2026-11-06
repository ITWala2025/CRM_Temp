import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Shield,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Building,
  ChevronDown,
  ChevronRight,
  Info,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  Role,
  RoleFormData,
  RolePermissionsMap,
  RoleAction,
  SystemModule,
  ModuleCategory,
  MODULE_CATEGORIES,
  MODULE_DEFINITIONS,
  ROLE_COLOR_PALETTES,
  DEFAULT_ROLE_PRESETS,
} from '../../../types/role';
import { RoleService } from '../../../services/roleService';
import { useCompanyContext } from '../../../contexts/CompanyContext';

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: RoleFormData) => Promise<void>;
  role?: Role | null;
  mode: 'create' | 'edit' | 'duplicate';
}

export const RoleModal: React.FC<RoleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  role,
  mode,
}) => {
  const { companies } = useCompanyContext();
  const [saving, setSaving] = useState<boolean>(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    crm_sales: true,
    billing_revenue: true,
    finance_accounting: true,
    hr_operations: true,
    service_desk: true,
    governance_legal: true,
    analytics_reporting: true,
    administration: true,
  });

  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    slug: '',
    description: '',
    status: 'active',
    color: 'blue',
    company_settings_id: null,
    permissions: {},
  });

  useEffect(() => {
    if (role) {
      if (mode === 'duplicate') {
        setFormData({
          name: `${role.name} (Copy)`,
          slug: `${role.slug}_copy`,
          description: role.description ? `Copy of ${role.name}. ${role.description}` : `Copy of ${role.name}`,
          status: 'active',
          color: role.color || 'blue',
          company_settings_id: role.company_settings_id || null,
          permissions: JSON.parse(JSON.stringify(role.permissions || {})),
        });
      } else {
        setFormData({
          name: role.name,
          slug: role.slug,
          description: role.description || '',
          status: role.status,
          color: role.color || 'blue',
          company_settings_id: role.company_settings_id || null,
          permissions: JSON.parse(JSON.stringify(role.permissions || {})),
        });
      }
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        status: 'active',
        color: 'blue',
        company_settings_id: null,
        permissions: {},
      });
    }
  }, [role, mode, isOpen]);

  const handleNameChange = (name: string) => {
    const slug = RoleService.generateSlug(name);
    setFormData(prev => ({
      ...prev,
      name,
      slug: mode === 'create' ? slug : prev.slug,
    }));
  };

  // Toggle single permission action
  const togglePermission = (moduleKey: SystemModule, action: RoleAction) => {
    setFormData(prev => {
      const current = prev.permissions[moduleKey] ? [...prev.permissions[moduleKey]] : [];
      const index = current.indexOf(action);
      let updated: RoleAction[];

      if (index >= 0) {
        updated = current.filter(a => a !== action);
      } else {
        updated = [...current, action];
      }

      const nextPermissions: RolePermissionsMap = { ...prev.permissions };
      if (updated.length > 0) {
        nextPermissions[moduleKey] = updated;
      } else {
        delete nextPermissions[moduleKey];
      }

      return {
        ...prev,
        permissions: nextPermissions,
      };
    });
  };

  // Toggle all actions for a specific module
  const toggleModuleAll = (moduleKey: SystemModule, availableActions: RoleAction[]) => {
    setFormData(prev => {
      const current = prev.permissions[moduleKey] || [];
      const hasAll = availableActions.every(a => current.includes(a));

      const nextPermissions: RolePermissionsMap = { ...prev.permissions };
      if (hasAll) {
        delete nextPermissions[moduleKey];
      } else {
        nextPermissions[moduleKey] = [...availableActions];
      }

      return { ...prev, permissions: nextPermissions };
    });
  };

  // Toggle all modules in a category
  const toggleCategoryAll = (category: ModuleCategory) => {
    const categoryModules = MODULE_DEFINITIONS.filter(m => m.category === category);
    
    // Check if category currently has all permissions selected
    const allSelected = categoryModules.every(mod => {
      const current = formData.permissions[mod.key] || [];
      return mod.availableActions.every(a => current.includes(a));
    });

    setFormData(prev => {
      const nextPermissions: RolePermissionsMap = { ...prev.permissions };

      categoryModules.forEach(mod => {
        if (allSelected) {
          delete nextPermissions[mod.key];
        } else {
          nextPermissions[mod.key] = [...mod.availableActions];
        }
      });

      return { ...prev, permissions: nextPermissions };
    });
  };

  // Apply a preset
  const applyPreset = (presetId: string) => {
    if (presetId === 'clear') {
      setFormData(prev => ({ ...prev, permissions: {} }));
      return;
    }

    const preset = DEFAULT_ROLE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setFormData(prev => ({
      ...prev,
      color: preset.color,
      permissions: JSON.parse(JSON.stringify(preset.permissions)),
    }));
  };

  // Calculate total selected permissions
  const totalSelectedCount = useMemo(() => {
    let count = 0;
    Object.values(formData.permissions).forEach(actions => {
      if (Array.isArray(actions)) count += actions.length;
    });
    return count;
  }, [formData.permissions]);

  const maxPossiblePermissions = useMemo(() => {
    return MODULE_DEFINITIONS.reduce((acc, mod) => acc + mod.availableActions.length, 0);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSaving(true);
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error('Save role error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-indigo-50/30 to-blue-50/20 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {mode === 'create' && 'Create New Custom Role'}
                {mode === 'edit' && `Edit Role: ${role?.name}`}
                {mode === 'duplicate' && `Duplicate Role: ${role?.name}`}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure role metadata, entity boundaries, and granular functionality permissions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* General Information Section */}
          <div className="bg-gray-50/80 rounded-xl p-5 border border-gray-200/80 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Role Details & Identification
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Role Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales Operations Manager"
                  value={formData.name}
                  onChange={e => handleNameChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  System Identifier Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. sales_ops_manager"
                  value={formData.slug}
                  onChange={e => setFormData(prev => ({ ...prev, slug: RoleService.generateSlug(e.target.value) }))}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-gray-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Description & Responsibilities
              </label>
              <textarea
                rows={2}
                placeholder="Explain the business purpose and responsibilities granted to users with this role..."
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Active (Usable)</option>
                  <option value="inactive">Inactive (Disabled)</option>
                </select>
              </div>

              {/* Entity Scope */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-gray-500" />
                  Entity Scope
                </label>
                <select
                  value={formData.company_settings_id || 'global'}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      company_settings_id: e.target.value === 'global' ? null : e.target.value,
                    }))
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="global">🌐 Global (All Company Entities)</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      🏢 {c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color Theme Badge */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Color Theme</label>
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {ROLE_COLOR_PALETTES.map(col => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color: col.id }))}
                      title={col.label}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${col.badge} flex items-center justify-center ${
                        formData.color === col.id ? 'scale-110 ring-2 ring-indigo-500 ring-offset-1 border-indigo-600' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    >
                      {formData.color === col.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Preset Toolbar */}
          <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Quick Preset Templates</span>
              </div>
              <div className="text-xs font-semibold px-2.5 py-1 bg-white rounded-full border border-indigo-200 text-indigo-700 shadow-sm">
                Active Permissions: <span className="font-bold text-indigo-900">{totalSelectedCount}</span> / {maxPossiblePermissions}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              {DEFAULT_ROLE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-xs font-medium text-gray-700 hover:text-indigo-700 rounded-lg border border-gray-200 hover:border-indigo-300 transition-all shadow-xs"
                >
                  {preset.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyPreset('clear')}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 rounded-lg border border-red-200 transition-colors flex items-center gap-1 ml-auto"
              >
                <RotateCcw className="w-3 h-3" />
                Clear All
              </button>
            </div>
          </div>

          {/* Granular Permission Matrix by Category */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Granular Functionality Permissions
              </h3>
              <p className="text-xs text-gray-500">
                Click actions to toggle or use &quot;Toggle Category&quot; for bulk assignment
              </p>
            </div>

            {(Object.keys(MODULE_CATEGORIES) as ModuleCategory[]).map(categoryKey => {
              const catInfo = MODULE_CATEGORIES[categoryKey];
              const categoryModules = MODULE_DEFINITIONS.filter(m => m.category === categoryKey);
              const isExpanded = expandedCategories[categoryKey] !== false;

              // Check if all permissions in category are selected
              const totalCategoryActions = categoryModules.reduce((acc, m) => acc + m.availableActions.length, 0);
              const selectedCategoryActions = categoryModules.reduce((acc, m) => {
                const perms = formData.permissions[m.key] || [];
                return acc + perms.length;
              }, 0);
              const isAllSelected = totalCategoryActions > 0 && selectedCategoryActions === totalCategoryActions;

              return (
                <div
                  key={categoryKey}
                  className="border border-gray-200 rounded-xl overflow-hidden shadow-xs bg-white"
                >
                  {/* Category Header */}
                  <div className="bg-gray-50/90 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCategories(prev => ({
                          ...prev,
                          [categoryKey]: !prev[categoryKey],
                        }))
                      }
                      className="flex items-center gap-2.5 text-left font-semibold text-gray-800 text-sm hover:text-indigo-600 transition-colors flex-1"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <span>{catInfo.label}</span>
                      <span className="text-xs font-normal text-gray-500 hidden sm:inline">
                        — {catInfo.description}
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 px-2 py-0.5 bg-gray-100 rounded-md">
                        {selectedCategoryActions}/{totalCategoryActions}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCategoryAll(categoryKey)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1 ${
                          isAllSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {isAllSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        {isAllSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>

                  {/* Modules List */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-100">
                      {categoryModules.map(mod => {
                        const currentActions = formData.permissions[mod.key] || [];
                        const isModAll = mod.availableActions.every(a => currentActions.includes(a));

                        return (
                          <div
                            key={mod.key}
                            className="p-4 hover:bg-gray-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                          >
                            {/* Module Info */}
                            <div className="md:w-5/12 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-gray-900">{mod.name}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleModuleAll(mod.key, mod.availableActions)}
                                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                  ({isModAll ? 'clear' : 'all'})
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{mod.description}</p>
                            </div>

                            {/* Action Checkboxes / Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap md:justify-end flex-1">
                              {mod.availableActions.map(action => {
                                const isChecked = currentActions.includes(action);

                                return (
                                  <button
                                    key={action}
                                    type="button"
                                    onClick={() => togglePermission(mod.key, action)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
                                      isChecked
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs ring-1 ring-indigo-300'
                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                                  >
                                    <div
                                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                                        isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'
                                      }`}
                                    >
                                      {isChecked && <Check className="w-2.5 h-2.5" />}
                                    </div>
                                    <span className="capitalize">{action}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Info className="w-4 h-4 text-gray-400" />
            <span>Super administrators have authority to edit any field and permission setting at any time.</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !formData.name.trim()}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all shadow-md shadow-indigo-200 flex items-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{mode === 'create' ? 'Create Role' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
