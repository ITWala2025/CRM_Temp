import React, { useState, useMemo } from 'react';
import {
  Table,
  Search,
  Download,
  Check,
  X,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  Role,
  MODULE_CATEGORIES,
  MODULE_DEFINITIONS,
  ModuleCategory,
  ROLE_COLOR_PALETTES,
} from '../../../types/role';

interface RoleAccessMatrixTabProps {
  roles: Role[];
  loading: boolean;
}

export const RoleAccessMatrixTab: React.FC<RoleAccessMatrixTabProps> = ({
  roles,
  loading,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<ModuleCategory | 'all'>('all');

  const filteredModules = useMemo(() => {
    return MODULE_DEFINITIONS.filter(mod => {
      if (selectedCategory !== 'all' && mod.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return mod.name.toLowerCase().includes(q) || mod.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [searchQuery, selectedCategory]);

  const getRoleTheme = (color?: string) => {
    return ROLE_COLOR_PALETTES.find(c => c.id === color) || ROLE_COLOR_PALETTES[0];
  };

  const handleExportCSV = () => {
    const headers = ['Category', 'Module', ...roles.map(r => r.name)];
    const rows = filteredModules.map(mod => {
      const cat = MODULE_CATEGORIES[mod.category]?.label || mod.category;
      const rolePerms = roles.map(r => {
        const actions = r.permissions[mod.key] || [];
        return actions.length > 0 ? actions.join(', ') : 'None';
      });
      return [cat, mod.name, ...rolePerms];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kdadks_rbac_access_matrix_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Search & Export Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search functionalities & modules..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
          />
        </div>

        {/* Filters and Export */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-700"
          >
            <option value="all">All Functional Areas</option>
            {(Object.keys(MODULE_CATEGORIES) as ModuleCategory[]).map(catKey => (
              <option key={catKey} value={catKey}>
                {MODULE_CATEGORIES[catKey].label}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-gray-300 hover:border-indigo-300 rounded-lg transition-all shadow-xs flex items-center gap-1.5 ml-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Matrix CSV</span>
          </button>
        </div>
      </div>

      {/* Access Matrix Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700">
                <th className="py-4 px-5 min-w-[240px] sticky left-0 bg-gray-50 z-10 border-r border-gray-200 shadow-xs">
                  Module / Functionality
                </th>
                {roles.map(role => {
                  const theme = getRoleTheme(role.color);
                  return (
                    <th key={role.id} className="py-4 px-4 min-w-[170px] text-center border-r border-gray-100 last:border-r-0">
                      <div className="flex flex-col items-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${theme.badge} ${theme.border} mb-1`}
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          {role.name}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">{role.slug}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredModules.map(mod => {
                const cat = MODULE_CATEGORIES[mod.category];

                return (
                  <tr key={mod.key} className="hover:bg-gray-50/70 transition-colors group">
                    
                    {/* Left Sticky Header: Module Details */}
                    <td className="py-3.5 px-5 sticky left-0 bg-white group-hover:bg-gray-50/90 z-10 border-r border-gray-200 shadow-xs">
                      <div className="font-bold text-gray-900">{mod.name}</div>
                      <div className="text-[11px] text-gray-500 line-clamp-1">{mod.description}</div>
                      <div className="text-[10px] font-semibold text-indigo-600 mt-0.5 uppercase tracking-wider">
                        {cat?.label}
                      </div>
                    </td>

                    {/* Role Permission Cells */}
                    {roles.map(role => {
                      const actions = role.permissions[mod.key] || [];
                      const hasAll = mod.availableActions.every(a => actions.includes(a));
                      const hasNone = actions.length === 0;

                      return (
                        <td
                          key={role.id}
                          className="py-3.5 px-3 text-center border-r border-gray-100 last:border-r-0 align-middle"
                        >
                          {hasNone ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400">
                              <X className="w-3.5 h-3.5" />
                            </span>
                          ) : hasAll ? (
                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                              <Check className="w-3 h-3" />
                              <span>Full Access</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 flex-wrap max-w-[160px] mx-auto">
                              {actions.map(act => (
                                <span
                                  key={act}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase"
                                >
                                  {act}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
