import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Shield,
  Users,
  KeyRound,
  History,
  Grid,
  Sparkles,
  Building,
  Plus,
  RefreshCw,
  Layers,
  CheckCircle,
} from 'lucide-react';
import { useCompanyContext } from '../../../contexts/CompanyContext';
import { useToast } from '../../ui/ToastProvider';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import ConfirmDialog from '../../ui/ConfirmDialog';
import {
  Role,
  RoleFormData,
  UserRoleAssignment,
  UserAssignmentFormData,
  MODULE_DEFINITIONS,
} from '../../../types/role';
import { RoleService } from '../../../services/roleService';
import { RoleListTab } from './RoleListTab';
import { UserAssignmentsTab } from './UserAssignmentsTab';
import { RoleAccessMatrixTab } from './RoleAccessMatrixTab';
import { RoleAuditLogTab } from './RoleAuditLogTab';
import { RoleModal } from './RoleModal';
import { UserAssignmentModal } from './UserAssignmentModal';

type ActiveTab = 'roles' | 'assignments' | 'matrix' | 'audit';

export const RoleManagement: React.FC = () => {
  const { selectedCompany } = useCompanyContext();
  const { showSuccess, showError, showInfo } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();

  const [activeTab, setActiveTab] = useState<ActiveTab>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [roleModalOpen, setRoleModalOpen] = useState<boolean>(false);
  const [roleModalMode, setRoleModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const [assignmentModalOpen, setAssignmentModalOpen] = useState<boolean>(false);
  const [assignmentModalMode, setAssignmentModalMode] = useState<'assign' | 'invite' | 'edit'>('assign');
  const [selectedAssignment, setSelectedAssignment] = useState<UserRoleAssignment | null>(null);

  // Fetch all RBAC data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesData, assignmentsData] = await Promise.all([
        RoleService.getRoles({ company_settings_id: selectedCompany?.id || null }),
        RoleService.getUserAssignments(),
      ]);
      setRoles(rolesData);
      setAssignments(assignmentsData);
    } catch (err) {
      console.error('Error loading RBAC data:', err);
      showError('Failed to load role and user data.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompany?.id, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Role Handlers
  const handleOpenCreateRole = () => {
    setSelectedRole(null);
    setRoleModalMode('create');
    setRoleModalOpen(true);
  };

  const handleOpenEditRole = (role: Role) => {
    setSelectedRole(role);
    setRoleModalMode('edit');
    setRoleModalOpen(true);
  };

  const handleOpenDuplicateRole = (role: Role) => {
    setSelectedRole(role);
    setRoleModalMode('duplicate');
    setRoleModalOpen(true);
  };

  const handleSaveRole = async (formData: RoleFormData) => {
    try {
      if (roleModalMode === 'create' || roleModalMode === 'duplicate') {
        const created = await RoleService.createRole(formData);
        showSuccess(`Role "${created.name}" created successfully!`);
      } else if (roleModalMode === 'edit' && selectedRole) {
        const updated = await RoleService.updateRole(selectedRole.id, formData);
        showSuccess(`Role "${updated.name}" updated successfully!`);
      }
      await fetchData();
    } catch (err: any) {
      showError(err.message || 'Failed to save role');
      throw err;
    }
  };

  const handleDeleteRole = async (role: Role) => {
    const confirmed = await confirm({
      title: `Delete Role: ${role.name}`,
      message: `Are you sure you want to permanently delete the role "${role.name}"? This action cannot be undone.`,
      confirmText: 'Delete Role',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await RoleService.deleteRole(role.id);
      showSuccess(`Role "${role.name}" deleted successfully.`);
      await fetchData();
    } catch (err: any) {
      showError(err.message || 'Failed to delete role');
    }
  };

  // User Assignment Handlers
  const handleOpenAssignModal = () => {
    setSelectedAssignment(null);
    setAssignmentModalMode('assign');
    setAssignmentModalOpen(true);
  };

  const handleOpenInviteModal = () => {
    setSelectedAssignment(null);
    setAssignmentModalMode('invite');
    setAssignmentModalOpen(true);
  };

  const handleOpenEditAssignment = (assignment: UserRoleAssignment) => {
    setSelectedAssignment(assignment);
    setAssignmentModalMode('edit');
    setAssignmentModalOpen(true);
  };

  const handleSaveAssignment = async (formData: UserAssignmentFormData) => {
    try {
      if (assignmentModalMode === 'invite') {
        const res = await RoleService.inviteOrRegisterUser(formData);
        showSuccess(res.message || 'User invited and assigned successfully!');
      } else {
        await RoleService.assignUserRole(formData);
        showSuccess(`Role assigned to ${formData.email} successfully!`);
      }
      await fetchData();
    } catch (err: any) {
      showError(err.message || 'Failed to save user assignment');
      throw err;
    }
  };

  const handleRemoveAssignment = async (assignment: UserRoleAssignment) => {
    const confirmed = await confirm({
      title: `Revoke Role Assignment: ${assignment.email}`,
      message: `Are you sure you want to remove role "${assignment.role?.name || 'Assigned Role'}" from user ${assignment.email}?`,
      confirmText: 'Revoke Assignment',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await RoleService.removeUserAssignment(assignment.id);
      showSuccess(`Role revoked from ${assignment.email}.`);
      await fetchData();
    } catch (err: any) {
      showError(err.message || 'Failed to revoke role assignment');
    }
  };

  const handleQuickRoleChange = async (assignment: UserRoleAssignment, newRoleId: string) => {
    try {
      await RoleService.assignUserRole({
        user_id: assignment.user_id,
        email: assignment.email,
        full_name: assignment.full_name,
        role_id: newRoleId,
        company_settings_id: assignment.company_settings_id || null,
        status: assignment.status,
      });
      showSuccess(`Updated role for ${assignment.email}`);
      await fetchData();
    } catch (err: any) {
      showError(err.message || 'Failed to update user role');
    }
  };

  const handleQuickStatusChange = async (assignment: UserRoleAssignment, newStatus: 'active' | 'suspended') => {
    try {
      await RoleService.assignUserRole({
        user_id: assignment.user_id,
        email: assignment.email,
        full_name: assignment.full_name,
        role_id: assignment.role_id,
        company_settings_id: assignment.company_settings_id || null,
        status: newStatus,
      });
      showSuccess(`Updated status for ${assignment.email} to ${newStatus}`);
      await fetchData();
    } catch (err: any) {
      showError(err.message || 'Failed to update user status');
    }
  };

  // Summary Metrics
  const activeRolesCount = roles.filter(r => r.status === 'active').length;
  const customRolesCount = roles.filter(r => !r.is_system).length;
  const activeUsersCount = assignments.filter(a => a.status === 'active').length;
  const totalModulesCount = MODULE_DEFINITIONS.length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                <ShieldCheck className="w-6 h-6 text-indigo-300" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Roles & Access Control (RBAC)
              </h1>
            </div>
            <p className="text-sm text-indigo-200 max-w-2xl">
              Create custom roles, configure granular functionality permissions across all 26 system modules, and assign Supabase Auth users to roles.
            </p>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-xs font-semibold text-white backdrop-blur-sm transition-all flex items-center gap-1.5 shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleOpenCreateRole}
              className="px-4 py-2.5 bg-white hover:bg-indigo-50 text-indigo-900 rounded-xl text-xs font-bold transition-all shadow-lg shadow-black/10 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Role</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Roles */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">{roles.length}</div>
            <div className="text-xs font-semibold text-gray-500">
              Configured Roles ({activeRolesCount} Active)
            </div>
          </div>
        </div>

        {/* Card 2: Assigned Users */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">{assignments.length}</div>
            <div className="text-xs font-semibold text-gray-500">
              Assigned Members ({activeUsersCount} Active)
            </div>
          </div>
        </div>

        {/* Card 3: Custom Roles */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">{customRolesCount}</div>
            <div className="text-xs font-semibold text-gray-500">
              Custom Organization Roles
            </div>
          </div>
        </div>

        {/* Card 4: System Modules */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <Grid className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">{totalModulesCount}</div>
            <div className="text-xs font-semibold text-gray-500">
              Protected System Modules
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'roles'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Roles Catalog ({roles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'assignments'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Role Assignments ({assignments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Access Matrix Grid</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Activity Log</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="transition-all duration-200">
        {activeTab === 'roles' && (
          <RoleListTab
            roles={roles}
            loading={loading}
            onOpenCreate={handleOpenCreateRole}
            onOpenEdit={handleOpenEditRole}
            onOpenDuplicate={handleOpenDuplicateRole}
            onDeleteRole={handleDeleteRole}
          />
        )}

        {activeTab === 'assignments' && (
          <UserAssignmentsTab
            assignments={assignments}
            roles={roles}
            loading={loading}
            onOpenAssignModal={handleOpenAssignModal}
            onOpenInviteModal={handleOpenInviteModal}
            onOpenEditModal={handleOpenEditAssignment}
            onRemoveAssignment={handleRemoveAssignment}
            onQuickRoleChange={handleQuickRoleChange}
            onQuickStatusChange={handleQuickStatusChange}
          />
        )}

        {activeTab === 'matrix' && (
          <RoleAccessMatrixTab roles={roles} loading={loading} />
        )}

        {activeTab === 'audit' && (
          <RoleAuditLogTab />
        )}
      </div>

      {/* Role Creation / Edit / Duplicate Modal */}
      <RoleModal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        onSave={handleSaveRole}
        role={selectedRole}
        mode={roleModalMode}
      />

      {/* User Role Assignment / Invite Modal */}
      <UserAssignmentModal
        isOpen={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        onSave={handleSaveAssignment}
        roles={roles}
        assignment={selectedAssignment}
        mode={assignmentModalMode}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default RoleManagement;
