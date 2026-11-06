import React, { useState, useMemo } from 'react';
import {
  Shield,
  Plus,
  Search,
  Filter,
  Edit2,
  Copy,
  Trash2,
  Users,
  CheckCircle,
  XCircle,
  Building,
  Globe,
  Lock,
  Layers,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Role, ROLE_COLOR_PALETTES, MODULE_DEFINITIONS } from '../../../types/role';
import { useCompanyContext } from '../../../contexts/CompanyContext';

interface RoleListTabProps {
  roles: Role[];
  loading: boolean;
  onOpenCreate: () => void;
  onOpenEdit: (role: Role) => void;
  onOpenDuplicate: (role: Role) => void;
  onDeleteRole: (role: Role) => void;
}

export const RoleListTab: React.FC<RoleListTabProps> = ({
  roles,
  loading,
  onOpenCreate,
  onOpenEdit,
  onOpenDuplicate,
  onDeleteRole,
}) => {
  const { selectedCompany } = useCompanyContext();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'company'>('all');

  const maxPermissions = useMemo(() => {
    return MODULE_DEFINITIONS.reduce((acc, m) => acc + m.availableActions.length, 0);
  }, []);

  const filteredRoles = useMemo(() => {
    return roles.filter(role => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = role.name.toLowerCase().includes(q);
        const matchesSlug = role.slug.toLowerCase().includes(q);
        const matchesDesc = role.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesSlug && !matchesDesc) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && role.status !== statusFilter) {
        return false;
      }

      // Scope filter
      if (scopeFilter === 'global' && role.company_settings_id !== null) {
        return false;
      }
      if (scopeFilter === 'company') {
        if (!role.company_settings_id) return false;
        if (selectedCompany && role.company_settings_id !== selectedCompany.id) return false;
      }

      return true;
    });
  }, [roles, searchQuery, statusFilter, scopeFilter, selectedCompany]);

  const getColorTheme = (colorId: string) => {
    return (
      ROLE_COLOR_PALETTES.find(c => c.id === colorId) ||
      ROLE_COLOR_PALETTES[0]
    );
  };

  const getPermissionCount = (role: Role) => {
    let count = 0;
    Object.values(role.permissions || {}).forEach(actions => {
      if (Array.isArray(actions)) count += actions.length;
    });
    return count;
  };

  return (
    <div className="space-y-6">
      
      {/* Control Bar: Search, Filters & Action */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search roles by name, slug, or purpose..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
          />
        </div>

        {/* Filters and New Role button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-lg border border-gray-200 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                statusFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                statusFilter === 'active' ? 'bg-white text-emerald-700 shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                statusFilter === 'inactive' ? 'bg-white text-gray-800 shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Inactive
            </button>
          </div>

          {/* Scope Filter */}
          <select
            value={scopeFilter}
            onChange={e => setScopeFilter(e.target.value as 'all' | 'global' | 'company')}
            className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-700"
          >
            <option value="all">All Scopes</option>
            <option value="global">🌐 Global Roles</option>
            <option value="company">🏢 Company-Specific</option>
          </select>

          {/* Create Button */}
          <button
            onClick={onOpenCreate}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5 ml-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Role</span>
          </button>
        </div>
      </div>

      {/* Roles Grid Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse space-y-4 shadow-xs">
              <div className="h-6 bg-gray-200 rounded-md w-3/4" />
              <div className="h-4 bg-gray-100 rounded-md w-full" />
              <div className="h-10 bg-gray-100 rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : filteredRoles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-600">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No matching roles found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-5">
            Adjust your search criteria or create a new custom role with customized access capabilities.
          </p>
          <button
            onClick={onOpenCreate}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-sm"
          >
            Create New Role
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRoles.map(role => {
            const theme = getColorTheme(role.color);
            const permCount = getPermissionCount(role);
            const permPercentage = Math.round((permCount / maxPermissions) * 100);

            return (
              <div
                key={role.id}
                className="bg-white rounded-2xl border border-gray-200/90 hover:border-indigo-200 hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden group shadow-xs"
              >
                {/* Card Top Section */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2.5 rounded-xl border ${theme.bg} ${theme.text} ${theme.border}`}>
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {role.name}
                        </h3>
                        <p className="text-[11px] font-mono text-gray-500">{role.slug}</p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        role.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {role.status === 'active' ? (
                        <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1 text-gray-500" />
                      )}
                      {role.status}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-600 line-clamp-2 min-h-[32px] mb-4">
                    {role.description || 'No specific description provided for this role.'}
                  </p>

                  {/* Scope & Users Chips */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600 mb-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 font-medium">
                      {role.company_settings_id ? (
                        <>
                          <Building className="w-3.5 h-3.5 text-blue-500 mr-1" />
                          {role.company_settings?.company_name || 'Entity-Specific'}
                        </>
                      ) : (
                        <>
                          <Globe className="w-3.5 h-3.5 text-indigo-500 mr-1" />
                          Global (All Entities)
                        </>
                      )}
                    </span>

                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50/50 border border-indigo-100 font-semibold text-indigo-700">
                      <Users className="w-3.5 h-3.5 mr-1" />
                      {role.assigned_users_count || 0} user{role.assigned_users_count === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Permission Coverage Progress Bar */}
                  <div className="space-y-1.5 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-gray-600">Permissions Coverage</span>
                      <span className="text-indigo-700 font-bold">
                        {permCount} <span className="text-gray-400 font-normal">/ {maxPermissions}</span> ({permPercentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(5, permPercentage))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    {role.is_system ? '🛡️ System Seed' : '✨ Custom Role'}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* Duplicate */}
                    <button
                      onClick={() => onOpenDuplicate(role)}
                      title="Duplicate Role"
                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* Edit All Fields */}
                    <button
                      onClick={() => onOpenEdit(role)}
                      title="Edit Role & Permissions"
                      className="px-3 py-1 text-xs font-semibold text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-lg border border-indigo-200 hover:border-transparent transition-all flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {/* Delete (if non-system or allowed) */}
                    <button
                      onClick={() => onDeleteRole(role)}
                      disabled={role.is_system || (role.assigned_users_count || 0) > 0}
                      title={
                        role.is_system
                          ? 'System role cannot be deleted'
                          : (role.assigned_users_count || 0) > 0
                          ? 'Cannot delete role with assigned users'
                          : 'Delete Role'
                      }
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
