import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  UserPlus,
  UserCheck,
  Shield,
  Building,
  Globe,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Mail,
  Filter,
} from 'lucide-react';
import { UserRoleAssignment, Role, ROLE_COLOR_PALETTES } from '../../../types/role';
import { useCompanyContext } from '../../../contexts/CompanyContext';

interface UserAssignmentsTabProps {
  assignments: UserRoleAssignment[];
  roles: Role[];
  loading: boolean;
  onOpenAssignModal: () => void;
  onOpenInviteModal: () => void;
  onOpenEditModal: (assignment: UserRoleAssignment) => void;
  onRemoveAssignment: (assignment: UserRoleAssignment) => void;
  onQuickRoleChange: (assignment: UserRoleAssignment, newRoleId: string) => Promise<void>;
  onQuickStatusChange: (assignment: UserRoleAssignment, newStatus: 'active' | 'suspended') => Promise<void>;
}

export const UserAssignmentsTab: React.FC<UserAssignmentsTabProps> = ({
  assignments,
  roles,
  loading,
  onOpenAssignModal,
  onOpenInviteModal,
  onOpenEditModal,
  onRemoveAssignment,
  onQuickRoleChange,
  onQuickStatusChange,
}) => {
  const { companies } = useCompanyContext();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'pending'>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesEmail = a.email.toLowerCase().includes(q);
        const matchesName = a.full_name?.toLowerCase().includes(q);
        if (!matchesEmail && !matchesName) return false;
      }

      // Role filter
      if (roleFilter !== 'all' && a.role_id !== roleFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && a.status !== statusFilter) {
        return false;
      }

      // Entity filter
      if (entityFilter !== 'all') {
        if (entityFilter === 'global' && a.company_settings_id !== null) return false;
        if (entityFilter !== 'global' && a.company_settings_id !== entityFilter) return false;
      }

      return true;
    });
  }, [assignments, searchQuery, roleFilter, statusFilter, entityFilter]);

  const getRoleTheme = (color?: string) => {
    return ROLE_COLOR_PALETTES.find(c => c.id === color) || ROLE_COLOR_PALETTES[0];
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    if (email) return email.substring(0, 2).toUpperCase();
    return 'U';
  };

  return (
    <div className="space-y-6">
      
      {/* Search & Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search users by name or email address..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
          />
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-700"
          >
            <option value="all">All Roles</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-700"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>

          {/* Entity Filter */}
          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-700"
          >
            <option value="all">All Entity Scopes</option>
            <option value="global">🌐 Global Scope</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                🏢 {c.company_name}
              </option>
            ))}
          </select>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onOpenAssignModal}
              className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-gray-300 hover:border-indigo-300 rounded-lg transition-all shadow-xs flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assign Role</span>
            </button>

            <button
              onClick={onOpenInviteModal}
              className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite User</span>
            </button>
          </div>
        </div>
      </div>

      {/* User Assignments Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded-md w-1/3 mx-auto" />
            <div className="h-4 bg-gray-100 rounded-md w-1/2 mx-auto" />
            <div className="h-32 bg-gray-50 rounded-xl" />
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-600">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">No user assignments found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
              Assign an existing user/employee to a role or invite a new team member with specific access rights.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={onOpenAssignModal}
                className="px-3.5 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Assign Existing User
              </button>
              <button
                onClick={onOpenInviteModal}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs"
              >
                Invite New User
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">User / Member</th>
                  <th className="py-3.5 px-4">Assigned Role</th>
                  <th className="py-3.5 px-4">Entity Scope</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned Info</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredAssignments.map(a => {
                  const assignedRole = roles.find(r => r.id === a.role_id) || a.role;
                  const theme = getRoleTheme(assignedRole?.color);
                  const isRootAdmin = a.email.toLowerCase() === 'admin@kdadks.com';

                  return (
                    <tr key={a.id} className="hover:bg-gray-50/60 transition-colors group">
                      
                      {/* User Column */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center shadow-xs flex-shrink-0 text-xs">
                            {getInitials(a.full_name, a.email)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900">{a.full_name || 'Admin User'}</span>
                              {isRootAdmin && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Primary Root
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-gray-500 text-[11px] mt-0.5">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span>{a.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Role Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${theme.badge} ${theme.border}`}
                          >
                            <Shield className="w-3.5 h-3.5 mr-1" />
                            {assignedRole?.name || 'Unassigned Role'}
                          </span>

                          {/* Quick Role Switcher */}
                          {!isRootAdmin && (
                            <select
                              value={a.role_id}
                              onChange={e => onQuickRoleChange(a, e.target.value)}
                              className="text-[11px] py-1 px-2 border border-gray-200 rounded-md bg-gray-50 hover:bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              {roles.map(r => (
                                <option key={r.id} value={r.id}>
                                  Switch to {r.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>

                      {/* Entity Scope Column */}
                      <td className="py-3.5 px-4">
                        {a.company_settings_id ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <Building className="w-3.5 h-3.5 mr-1" />
                            {a.company_settings?.company_name || 'Specific Entity'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                            <Globe className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                            All Entities (Global)
                          </span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() =>
                            !isRootAdmin &&
                            onQuickStatusChange(a, a.status === 'active' ? 'suspended' : 'active')
                          }
                          disabled={isRootAdmin}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                            a.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : a.status === 'suspended'
                              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          } ${isRootAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          {a.status === 'active' ? (
                            <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 mr-1 text-red-500" />
                          )}
                          <span className="capitalize">{a.status}</span>
                        </button>
                      </td>

                      {/* Assigned Date Info */}
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        <div>{new Date(a.created_at).toLocaleDateString()}</div>
                        <div className="text-gray-400">By: {a.assigned_by || 'system'}</div>
                      </td>

                      {/* Action Menu */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onOpenEditModal(a)}
                            title="Edit Assignment"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onRemoveAssignment(a)}
                            disabled={isRootAdmin}
                            title={isRootAdmin ? 'Cannot remove primary root administrator' : 'Revoke Assignment'}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 rounded-lg transition-colors"
                          >
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
        )}
      </div>
    </div>
  );
};
