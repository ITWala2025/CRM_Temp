import React, { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  UserPlus,
  Mail,
  Lock,
  Building,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Role, UserAssignmentFormData, UserRoleAssignment, SelectableUser } from '../../../types/role';
import { useCompanyContext } from '../../../contexts/CompanyContext';
import { RoleService } from '../../../services/roleService';

interface UserAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: UserAssignmentFormData) => Promise<void>;
  roles: Role[];
  assignment?: UserRoleAssignment | null;
  mode: 'assign' | 'invite' | 'edit';
}

export const UserAssignmentModal: React.FC<UserAssignmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  roles,
  assignment,
  mode,
}) => {
  const { companies } = useCompanyContext();
  const [saving, setSaving] = useState<boolean>(false);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [authUsers, setAuthUsers] = useState<SelectableUser[]>([]);
  const [employees, setEmployees] = useState<SelectableUser[]>([]);
  const [allSelectableUsers, setAllSelectableUsers] = useState<SelectableUser[]>([]);
  const [selectedUserSource, setSelectedUserSource] = useState<'auth' | 'employee' | 'assignment' | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [formData, setFormData] = useState<UserAssignmentFormData>({
    user_id: '',
    email: '',
    full_name: '',
    role_id: roles[0]?.id || '',
    company_settings_id: null,
    status: 'active',
    password: '',
    is_new_user: mode === 'invite',
  });

  // Fetch both auth.users and employees for selection
  useEffect(() => {
    const loadSelectableUsers = async () => {
      try {
        setLoadingUsers(true);
        const data = await RoleService.getSelectableUsers();
        setAuthUsers(data.authUsers || []);
        setEmployees(data.employees || []);
        setAllSelectableUsers(data.allUsers || []);
      } catch (err) {
        console.warn('Could not load selectable users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    if (isOpen) {
      loadSelectableUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (assignment && mode === 'edit') {
      setFormData({
        user_id: assignment.user_id,
        email: assignment.email,
        full_name: assignment.full_name,
        role_id: assignment.role_id,
        company_settings_id: assignment.company_settings_id || null,
        status: assignment.status,
        is_new_user: false,
      });
      setSelectedUserSource('assignment');
    } else {
      setFormData({
        user_id: '',
        email: '',
        full_name: '',
        role_id: roles[0]?.id || '',
        company_settings_id: null,
        status: 'active',
        password: '',
        is_new_user: mode === 'invite',
      });
      setSelectedUserSource(null);
    }
  }, [assignment, mode, roles, isOpen]);

  const handleSelectUser = (selectedId: string) => {
    const cleanId = selectedId.toLowerCase().trim();
    const user = allSelectableUsers.find(
      u =>
        (u.id && u.id.toLowerCase().trim() === cleanId) ||
        (u.email && u.email.toLowerCase().trim() === cleanId)
    );
    if (user) {
      setFormData(prev => ({
        ...prev,
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
      }));
      setSelectedUserSource(user.source);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: pass }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.role_id) return;

    try {
      setSaving(true);
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error('Assignment save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const selectedRole = roles.find(r => r.id === formData.role_id);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-indigo-50/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200">
              {mode === 'invite' ? <UserPlus className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {mode === 'invite' && 'Invite & Register New Admin User'}
                {mode === 'assign' && 'Assign Role to User'}
                {mode === 'edit' && 'Update User Role Assignment'}
              </h2>
              <p className="text-xs text-gray-500">
                {mode === 'invite'
                  ? 'Create a Supabase Auth account and designate system role'
                  : 'Map Supabase Auth account or employee to an RBAC role'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Quick User Select from auth.users and employees */}
          {mode === 'assign' && (
            <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 space-y-2">
              <label className="block text-xs font-bold text-indigo-950 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Quick Select Account from System
                </span>
                {loadingUsers && (
                  <span className="text-[11px] font-normal text-indigo-600 animate-pulse">
                    Fetching auth.users & employees...
                  </span>
                )}
              </label>

              <select
                onChange={e => handleSelectUser(e.target.value)}
                defaultValue=""
                className="w-full px-3.5 py-2 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800 shadow-xs"
              >
                <option value="" disabled>
                  -- Select a Supabase Auth account or Employee to auto-fill --
                </option>

                {/* 1. Supabase Auth Users */}
                <optgroup label="🔐 Supabase Auth Accounts">
                  {authUsers.map(u => (
                    <option key={`auth-${u.id || u.email}`} value={u.id || u.email}>
                      🔐 {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                    </option>
                  ))}
                </optgroup>

                {/* 2. Company Employees */}
                <optgroup label="👥 Company Employees Directory">
                  {employees.map(emp => (
                    <option key={`emp-${emp.id || emp.email}`} value={emp.id || emp.email}>
                      👥 {emp.full_name} ({emp.email})
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* Selected User Info Badge */}
              {selectedUserSource && (
                <div className="flex items-center gap-2 pt-1 text-[11px] text-indigo-800 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>
                    Linked to{' '}
                    <strong>
                      {selectedUserSource === 'auth' ? 'Supabase Auth Account' : 'Company Employee Profile'}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sarah Connor"
              value={formData.full_name}
              onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              disabled={mode === 'edit'}
              placeholder="e.g. user@kdadks.com"
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 font-medium"
            />
          </div>

          {/* Password (for New User Invite) */}
          {mode === 'invite' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                    Initial Password <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    Auto-Generate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Set initial password for login"
                    value={formData.password || ''}
                    onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3.5 py-2 pr-10 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Welcome Email Checkbox */}
              <div className="flex items-center space-x-2 bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                <input
                  type="checkbox"
                  id="send_welcome_email"
                  checked={formData.send_welcome_email ?? true}
                  onChange={(e) => setFormData((prev) => ({ ...prev, send_welcome_email: e.target.checked }))}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="send_welcome_email" className="text-xs font-semibold text-indigo-900 cursor-pointer">
                  Send Welcome Credentials Email via Resend API (includes password & portal links)
                </label>
              </div>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-gray-400" />
              Assigned Role <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.role_id}
              onChange={e => setFormData(prev => ({ ...prev, role_id: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-900"
            >
              {roles.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.is_system ? '(System)' : ''} — {r.status.toUpperCase()}
                </option>
              ))}
            </select>
            {selectedRole && (
              <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded-md border border-gray-200">
                {selectedRole.description || 'No description provided.'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Entity Scope */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-gray-400" />
                Entity Access Scope
              </label>
              <select
                value={formData.company_settings_id || 'global'}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    company_settings_id: e.target.value === 'global' ? null : e.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="global">🌐 All Entities (Global Access)</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    🏢 {c.company_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">User Status</label>
              <select
                value={formData.status}
                onChange={e =>
                  setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'suspended' | 'pending' }))
                }
                className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="active">Active (Full Login)</option>
                <option value="suspended">Suspended (Access Blocked)</option>
                <option value="pending">Pending Verification</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.email.trim() || !formData.role_id}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
              <span>{mode === 'invite' ? 'Create & Assign User' : 'Save Assignment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
