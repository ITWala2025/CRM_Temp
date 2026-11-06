import { supabase, isSupabaseConfigured } from '../config/supabase';
import { simpleAuth } from '../utils/simpleAuth';
import { EmailService } from './emailService';
import {
  Role,
  RoleFormData,
  RoleFilters,
  UserRoleAssignment,
  UserAssignmentFormData,
  UserAssignmentFilters,
  RoleAuditLog,
  RolePermissionsMap,
  DEFAULT_ROLE_PRESETS,
  MODULE_DEFINITIONS,
  RoleAction,
  SystemModule,
  SelectableUser,
} from '../types/role';

// Local storage key for fallback cache when offline / dev mode
const ROLES_CACHE_KEY = 'kdadks_roles_cache';
const ASSIGNMENTS_CACHE_KEY = 'kdadks_user_assignments_cache';
const AUDIT_LOGS_CACHE_KEY = 'kdadks_role_audit_cache';

/**
 * Service class for Role-Based Access Control (RBAC)
 * Handles role definition, permission matrix customization, and user assignments
 */
export class RoleService {
  /**
   * Initialize and seed fallback data if needed
   */
  private static getInitialDefaultRoles(): Role[] {
    const now = new Date().toISOString();
    return DEFAULT_ROLE_PRESETS.map((preset, index) => ({
      id: `default-role-${preset.id}`,
      name: preset.name,
      slug: preset.id,
      description: preset.description,
      is_system: preset.id === 'super_admin',
      is_default: preset.id === 'employee_portal',
      status: 'active' as const,
      color: preset.color,
      permissions: preset.permissions,
      company_settings_id: null,
      assigned_users_count: preset.id === 'super_admin' ? 1 : 0,
      created_by: 'system',
      updated_by: 'system',
      created_at: now,
      updated_at: now,
    }));
  }

  private static getInitialDefaultAssignments(): UserRoleAssignment[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'assignment-super-admin-root',
        user_id: 'admin-kdadks-root',
        email: 'admin@kdadks.com',
        full_name: 'System Administrator',
        role_id: 'default-role-super_admin',
        role: {
          id: 'default-role-super_admin',
          name: 'Super Admin (Full Access)',
          slug: 'super_admin',
          is_system: true,
          is_default: false,
          status: 'active',
          color: 'indigo',
          permissions: DEFAULT_ROLE_PRESETS[0].permissions,
          created_at: now,
          updated_at: now,
        },
        company_settings_id: null,
        status: 'active',
        assigned_by: 'system_init',
        created_at: now,
        updated_at: now,
      },
    ];
  }

  /**
   * Helper to get local cached roles
   */
  private static getCachedRoles(): Role[] {
    try {
      const data = localStorage.getItem(ROLES_CACHE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to read roles from cache:', e);
    }
    const initial = this.getInitialDefaultRoles();
    this.saveCachedRoles(initial);
    return initial;
  }

  private static saveCachedRoles(roles: Role[]): void {
    try {
      localStorage.setItem(ROLES_CACHE_KEY, JSON.stringify(roles));
    } catch (e) {
      console.warn('Failed to save roles to cache:', e);
    }
  }

  private static getCachedAssignments(): UserRoleAssignment[] {
    try {
      const data = localStorage.getItem(ASSIGNMENTS_CACHE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to read assignments from cache:', e);
    }
    const initial = this.getInitialDefaultAssignments();
    this.saveCachedAssignments(initial);
    return initial;
  }

  private static saveCachedAssignments(assignments: UserRoleAssignment[]): void {
    try {
      localStorage.setItem(ASSIGNMENTS_CACHE_KEY, JSON.stringify(assignments));
    } catch (e) {
      console.warn('Failed to save assignments to cache:', e);
    }
  }

  private static getCachedAuditLogs(): RoleAuditLog[] {
    try {
      const data = localStorage.getItem(AUDIT_LOGS_CACHE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to read audit logs from cache:', e);
    }
    return [];
  }

  private static saveCachedAuditLogs(logs: RoleAuditLog[]): void {
    try {
      localStorage.setItem(AUDIT_LOGS_CACHE_KEY, JSON.stringify(logs.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to save audit logs to cache:', e);
    }
  }

  /**
   * Generate slug from name
   */
  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Fetch all roles with optional filtering
   */
  static async getRoles(filters?: RoleFilters): Promise<Role[]> {
    if (!isSupabaseConfigured) {
      let cached = this.getCachedRoles();
      if (filters?.status && filters.status !== 'all') {
        cached = cached.filter(r => r.status === filters.status);
      }
      if (filters?.company_settings_id !== undefined && filters.company_settings_id !== null) {
        cached = cached.filter(r => r.company_settings_id === filters.company_settings_id || !r.company_settings_id);
      }
      if (filters?.searchQuery?.trim()) {
        const q = filters.searchQuery.toLowerCase().trim();
        cached = cached.filter(r => r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.slug.includes(q));
      }
      return cached;
    }

    try {
      let query = supabase
        .from('roles')
        .select(`
          *,
          company_settings:company_settings_id(id, company_name)
        `)
        .order('created_at', { ascending: true });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.company_settings_id !== undefined) {
        if (filters.company_settings_id === null) {
          query = query.is('company_settings_id', null);
        } else {
          query = query.or(`company_settings_id.eq.${filters.company_settings_id},company_settings_id.is.null`);
        }
      }

      if (filters?.searchQuery?.trim()) {
        const q = `%${filters.searchQuery.trim()}%`;
        query = query.or(`name.ilike.${q},slug.ilike.${q},description.ilike.${q}`);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Database error querying roles, falling back to local storage:', error.message);
        return this.getCachedRoles();
      }

      if (!data || data.length === 0) {
        // If DB table is empty, seed defaults
        const defaults = this.getInitialDefaultRoles();
        return defaults;
      }

      // Fetch user assignment counts per role
      const { data: assignmentCounts } = await supabase
        .from('user_role_assignments')
        .select('role_id');

      const countMap: Record<string, number> = {};
      if (assignmentCounts) {
        assignmentCounts.forEach(a => {
          countMap[a.role_id] = (countMap[a.role_id] || 0) + 1;
        });
      }

      const formattedRoles: Role[] = data.map(r => ({
        ...r,
        assigned_users_count: countMap[r.id] || 0,
      }));

      // Cache locally
      this.saveCachedRoles(formattedRoles);

      return formattedRoles;
    } catch (err) {
      console.error('RoleService.getRoles error:', err);
      return this.getCachedRoles();
    }
  }

  /**
   * Fetch single role by ID
   */
  static async getRoleById(id: string): Promise<Role | null> {
    const roles = await this.getRoles();
    return roles.find(r => r.id === id) || null;
  }

  /**
   * Create a new role
   */
  static async createRole(formData: RoleFormData): Promise<Role> {
    const user = await simpleAuth.getCurrentUser();
    const slug = formData.slug ? this.generateSlug(formData.slug) : this.generateSlug(formData.name);
    const now = new Date().toISOString();

    const newRolePayload = {
      name: formData.name.trim(),
      slug: slug || `role_${Date.now()}`,
      description: formData.description.trim() || null,
      is_system: false,
      is_default: false,
      status: formData.status,
      color: formData.color || 'blue',
      permissions: formData.permissions || {},
      company_settings_id: formData.company_settings_id || null,
      created_by: user?.email || 'admin',
      updated_by: user?.email || 'admin',
    };

    if (!isSupabaseConfigured) {
      const cached = this.getCachedRoles();
      const createdRole: Role = {
        id: `custom-role-${Date.now()}`,
        ...newRolePayload,
        assigned_users_count: 0,
        created_at: now,
        updated_at: now,
      };
      cached.push(createdRole);
      this.saveCachedRoles(cached);
      this.logAudit('role_created', 'role', createdRole.id, createdRole.name, { slug: createdRole.slug });
      return createdRole;
    }

    try {
      const { data, error } = await supabase
        .from('roles')
        .insert(newRolePayload)
        .select(`*, company_settings:company_settings_id(id, company_name)`)
        .single();

      if (error) throw error;

      await this.logAudit('role_created', 'role', data.id, data.name, { slug: data.slug });
      return { ...data, assigned_users_count: 0 };
    } catch (err) {
      console.error('RoleService.createRole failed:', err);
      // Fallback
      const cached = this.getCachedRoles();
      const createdRole: Role = {
        id: `custom-role-${Date.now()}`,
        ...newRolePayload,
        assigned_users_count: 0,
        created_at: now,
        updated_at: now,
      };
      cached.push(createdRole);
      this.saveCachedRoles(cached);
      this.logAudit('role_created', 'role', createdRole.id, createdRole.name, { slug: createdRole.slug });
      return createdRole;
    }
  }

  /**
   * Update an existing role (All fields editable by admin)
   */
  static async updateRole(id: string, formData: Partial<RoleFormData>): Promise<Role> {
    const user = await simpleAuth.getCurrentUser();
    const now = new Date().toISOString();

    const updatePayload: Record<string, unknown> = {
      updated_by: user?.email || 'admin',
      updated_at: now,
    };

    if (formData.name !== undefined) updatePayload.name = formData.name.trim();
    if (formData.slug !== undefined) updatePayload.slug = this.generateSlug(formData.slug);
    if (formData.description !== undefined) updatePayload.description = formData.description.trim();
    if (formData.status !== undefined) updatePayload.status = formData.status;
    if (formData.color !== undefined) updatePayload.color = formData.color;
    if (formData.company_settings_id !== undefined) updatePayload.company_settings_id = formData.company_settings_id;
    if (formData.permissions !== undefined) updatePayload.permissions = formData.permissions;

    if (!isSupabaseConfigured) {
      const cached = this.getCachedRoles();
      const index = cached.findIndex(r => r.id === id);
      if (index === -1) throw new Error('Role not found');
      const updated = { ...cached[index], ...updatePayload } as Role;
      cached[index] = updated;
      this.saveCachedRoles(cached);
      this.logAudit('role_updated', 'role', id, updated.name, { updates: Object.keys(updatePayload) });
      return updated;
    }

    try {
      const { data, error } = await supabase
        .from('roles')
        .update(updatePayload)
        .eq('id', id)
        .select(`*, company_settings:company_settings_id(id, company_name)`)
        .single();

      if (error) throw error;

      await this.logAudit('role_updated', 'role', id, data.name, { updates: Object.keys(updatePayload) });
      return data;
    } catch (err) {
      console.error('RoleService.updateRole failed:', err);
      // Fallback
      const cached = this.getCachedRoles();
      const index = cached.findIndex(r => r.id === id);
      if (index === -1) throw new Error('Role not found');
      const updated = { ...cached[index], ...updatePayload } as Role;
      cached[index] = updated;
      this.saveCachedRoles(cached);
      this.logAudit('role_updated', 'role', id, updated.name, { updates: Object.keys(updatePayload) });
      return updated;
    }
  }

  /**
   * Delete a role (with safety guards)
   */
  static async deleteRole(id: string): Promise<boolean> {
    const roles = await this.getRoles();
    const roleToDelete = roles.find(r => r.id === id);

    if (!roleToDelete) {
      throw new Error('Role not found');
    }

    if (roleToDelete.assigned_users_count && roleToDelete.assigned_users_count > 0) {
      throw new Error(`Cannot delete "${roleToDelete.name}" because it is currently assigned to ${roleToDelete.assigned_users_count} user(s). Reassign those users first.`);
    }

    if (!isSupabaseConfigured) {
      const cached = this.getCachedRoles();
      const filtered = cached.filter(r => r.id !== id);
      this.saveCachedRoles(filtered);
      this.logAudit('role_deleted', 'role', id, roleToDelete.name);
      return true;
    }

    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await this.logAudit('role_deleted', 'role', id, roleToDelete.name);
      return true;
    } catch (err) {
      console.error('RoleService.deleteRole failed:', err);
      const cached = this.getCachedRoles();
      const filtered = cached.filter(r => r.id !== id);
      this.saveCachedRoles(filtered);
      this.logAudit('role_deleted', 'role', id, roleToDelete.name);
      return true;
    }
  }

  /**
   * Duplicate / Clone an existing role
   */
  static async duplicateRole(sourceRoleId: string, newRoleName: string): Promise<Role> {
    const source = await this.getRoleById(sourceRoleId);
    if (!source) throw new Error('Source role not found');

    const formData: RoleFormData = {
      name: newRoleName.trim(),
      slug: this.generateSlug(newRoleName),
      description: `Copy of ${source.name}. ${source.description || ''}`.trim(),
      status: 'active',
      color: source.color,
      company_settings_id: source.company_settings_id || null,
      permissions: JSON.parse(JSON.stringify(source.permissions)),
    };

    const newRole = await this.createRole(formData);
    await this.logAudit('role_duplicated', 'role', newRole.id, newRole.name, { copied_from: source.name });
    return newRole;
  }

  /**
   * Fetch all user role assignments
   */
  static async getUserAssignments(filters?: UserAssignmentFilters): Promise<UserRoleAssignment[]> {
    if (!isSupabaseConfigured) {
      let cached = this.getCachedAssignments();
      if (filters?.status && filters.status !== 'all') {
        cached = cached.filter(a => a.status === filters.status);
      }
      if (filters?.role_id && filters.role_id !== 'all') {
        cached = cached.filter(a => a.role_id === filters.role_id);
      }
      if (filters?.company_settings_id !== undefined && filters.company_settings_id !== 'all') {
        cached = cached.filter(a => a.company_settings_id === filters.company_settings_id || !a.company_settings_id);
      }
      if (filters?.searchQuery?.trim()) {
        const q = filters.searchQuery.toLowerCase().trim();
        cached = cached.filter(a => a.email.toLowerCase().includes(q) || a.full_name?.toLowerCase().includes(q));
      }
      return cached;
    }

    try {
      let query = supabase
        .from('user_role_assignments')
        .select(`
          *,
          role:role_id(*),
          company_settings:company_settings_id(id, company_name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.role_id && filters.role_id !== 'all') {
        query = query.eq('role_id', filters.role_id);
      }

      if (filters?.company_settings_id !== undefined && filters.company_settings_id !== 'all') {
        if (filters.company_settings_id === null) {
          query = query.is('company_settings_id', null);
        } else {
          query = query.or(`company_settings_id.eq.${filters.company_settings_id},company_settings_id.is.null`);
        }
      }

      if (filters?.searchQuery?.trim()) {
        const q = `%${filters.searchQuery.trim()}%`;
        query = query.or(`email.ilike.${q},full_name.ilike.${q}`);
      }

      const { data, error } = await query;
      let cached = this.getCachedAssignments();

      if (error) {
        console.warn('Database error querying user role assignments, using cached:', error.message);
        return cached;
      }

      if (!data || data.length === 0) {
        // If DB returned empty list, check if we have local only assignments
        const localOnly = cached.filter(c => c.id.startsWith('assignment-'));
        if (localOnly.length > 0) {
          this.saveCachedAssignments(localOnly);
          return localOnly;
        }
        const initial = this.getInitialDefaultAssignments();
        this.saveCachedAssignments(initial);
        return initial;
      }

      // DB is authoritative for database-backed assignments
      const dbEmails = new Set(data.map(d => (d.email || '').toLowerCase().trim()));
      const dbIds = new Set(data.map(d => d.id));

      // Keep only purely local mock assignments that haven't been synced to DB yet
      const localOnly = cached.filter(
        c => c.id.startsWith('assignment-') && !dbEmails.has((c.email || '').toLowerCase().trim()) && !dbIds.has(c.id)
      );

      const mergedList = [...data, ...localOnly];
      this.saveCachedAssignments(mergedList);
      return mergedList;
    } catch (err) {
      console.error('RoleService.getUserAssignments failed:', err);
      return this.getCachedAssignments();
    }
  }

  /**
   * Assign or update a user's role
   */
  static async assignUserRole(formData: UserAssignmentFormData): Promise<UserRoleAssignment> {
    const user = await simpleAuth.getCurrentUser();
    const now = new Date().toISOString();
    const cleanEmail = formData.email.trim().toLowerCase();
    const userId = formData.user_id || `user_${Date.now()}`;

    const assignmentPayload = {
      user_id: userId,
      email: cleanEmail,
      full_name: formData.full_name.trim() || cleanEmail.split('@')[0],
      role_id: formData.role_id,
      company_settings_id: formData.company_settings_id || null,
      status: formData.status || 'active',
      assigned_by: user?.email || 'admin',
      updated_at: now,
    };

    const roles = await this.getRoles();
    const matchedRole = roles.find(r => r.id === formData.role_id);

    // Save to local cache immediately
    const cached = this.getCachedAssignments();
    const existingIndex = cached.findIndex(
      a =>
        (a.email && a.email.toLowerCase().trim() === cleanEmail) ||
        (a.user_id && a.user_id.toLowerCase().trim() === cleanEmail) ||
        (formData.user_id && a.user_id === formData.user_id)
    );

    let localResult: UserRoleAssignment;
    if (existingIndex >= 0) {
      localResult = {
        ...cached[existingIndex],
        ...assignmentPayload,
        role: matchedRole,
      };
      cached[existingIndex] = localResult;
    } else {
      localResult = {
        id: `assignment-${Date.now()}`,
        ...assignmentPayload,
        role: matchedRole,
        created_at: now,
      };
      cached.unshift(localResult);
    }
    this.saveCachedAssignments(cached);

    if (!isSupabaseConfigured) {
      this.logAudit('user_assigned', 'user', localResult.id, localResult.email, { role: matchedRole?.name });
      return localResult;
    }

    try {
      // Check existing in DB by email or user_id
      const { data: existingInDb } = await supabase
        .from('user_role_assignments')
        .select('id')
        .or(`email.eq.${cleanEmail},user_id.eq.${userId}`)
        .limit(1);

      let savedData: any = null;
      if (existingInDb && existingInDb.length > 0) {
        const { data: updated, error: updateErr } = await supabase
          .from('user_role_assignments')
          .update(assignmentPayload)
          .eq('id', existingInDb[0].id)
          .select(`*, role:role_id(*), company_settings:company_settings_id(id, company_name)`)
          .single();
        if (updateErr) throw updateErr;
        savedData = updated;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('user_role_assignments')
          .insert(assignmentPayload)
          .select(`*, role:role_id(*), company_settings:company_settings_id(id, company_name)`)
          .single();
        if (insertErr) throw insertErr;
        savedData = inserted;
      }

      if (savedData) {
        const updatedObj: UserRoleAssignment = {
          ...savedData,
          role: savedData.role || matchedRole,
        };
        // Update cache with authoritative DB result
        const refreshedCache = this.getCachedAssignments().map(c =>
          (c.email && c.email.toLowerCase().trim() === cleanEmail) || c.id === updatedObj.id ? updatedObj : c
        );
        this.saveCachedAssignments(refreshedCache);
        await this.logAudit('user_assigned', 'user', updatedObj.id, updatedObj.email, { role: matchedRole?.name });
        return updatedObj;
      }

      return localResult;
    } catch (err) {
      console.warn('RoleService.assignUserRole DB sync error (cached locally):', err);
      this.logAudit('user_assigned', 'user', localResult.id, localResult.email, { role: matchedRole?.name });
      return localResult;
    }
  }

  /**
   * Invite or Register a new user via Supabase Auth and assign their role
   */
  static async inviteOrRegisterUser(formData: UserAssignmentFormData): Promise<{ success: boolean; assignment: UserRoleAssignment; message: string }> {
    let authUserId: string | undefined;

    // If new user and Supabase Auth configured, attempt sign-up
    if (formData.is_new_user && formData.password && isSupabaseConfigured) {
      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email.trim(),
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
              role_id: formData.role_id,
            },
          },
        });

        if (signUpError) {
          console.warn('Supabase auth.signUp notice:', signUpError.message);
        } else if (signUpData.user) {
          authUserId = signUpData.user.id;
        }
      } catch (authErr) {
        console.warn('Supabase auth sign up failed, continuing with DB assignment:', authErr);
      }
    }

    const assignment = await this.assignUserRole({
      ...formData,
      user_id: authUserId || formData.user_id,
    });

    // Optionally dispatch welcome onboarding credentials email via Resend API
    if (formData.send_welcome_email || formData.is_new_user) {
      try {
        const roles = await this.getRoles();
        const matchedRole = roles.find((r) => r.id === formData.role_id);
        const roleName = matchedRole?.name || 'Staff User';

        await EmailService.sendStaffWelcomeCredentialsEmail(
          formData.email.trim(),
          formData.full_name.trim(),
          roleName,
          formData.password
        );
      } catch (emailErr) {
        console.warn('RoleService.inviteOrRegisterUser welcome email dispatch notice:', emailErr);
      }
    }

    return {
      success: true,
      assignment,
      message: `Staff user ${formData.email} successfully created and assigned to role.`,
    };
  }

  /**
   * Revoke/Delete user assignment
   */
  static async removeUserAssignment(id: string): Promise<boolean> {
    const cached = this.getCachedAssignments();
    const target = cached.find(a => a.id === id || a.email.toLowerCase() === id.toLowerCase());
    const targetEmail = target?.email ? target.email.toLowerCase().trim() : (id.includes('@') ? id.toLowerCase().trim() : '');

    // 1. Immediately purge from local cache so it cannot resurrect
    const filtered = cached.filter(
      a => a.id !== id && (!targetEmail || a.email.toLowerCase().trim() !== targetEmail)
    );
    this.saveCachedAssignments(filtered);

    if (!isSupabaseConfigured) {
      if (target) {
        this.logAudit('user_revoked', 'user', id, target.email);
      }
      return true;
    }

    try {
      // 2. Delete from Supabase DB by ID and by Email
      if (targetEmail) {
        await supabase
          .from('user_role_assignments')
          .delete()
          .or(`id.eq.${id},email.eq.${targetEmail}`);
      } else {
        await supabase
          .from('user_role_assignments')
          .delete()
          .eq('id', id);
      }

      if (target) {
        await this.logAudit('user_revoked', 'user', id, target.email);
      }
      return true;
    } catch (err) {
      console.error('RoleService.removeUserAssignment DB error:', err);
      // Already removed from local cache
      if (target) {
        this.logAudit('user_revoked', 'user', id, target.email);
      }
      return true;
    }
  }

  /**
   * Get active user's effective permissions
   */
  static async getCurrentUserEffectivePermissions(): Promise<{
    role: Role | null;
    permissions: RolePermissionsMap;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  }> {
    const currentUser = await simpleAuth.getCurrentUser();
    const superAdminPreset = DEFAULT_ROLE_PRESETS[0];

    // Explicit Root Super Admin
    if (currentUser && currentUser.email.toLowerCase() === 'admin@kdadks.com') {
      return {
        role: {
          id: 'default-role-super_admin',
          name: 'Super Admin (Full Access)',
          slug: 'super_admin',
          is_system: true,
          is_default: false,
          status: 'active',
          color: 'indigo',
          permissions: superAdminPreset.permissions,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        permissions: superAdminPreset.permissions,
        isAdmin: true,
        isSuperAdmin: true,
      };
    }

    if (!currentUser) {
      return {
        role: null,
        permissions: {},
        isAdmin: false,
        isSuperAdmin: false,
      };
    }

    try {
      // 1. Fetch assignments from DB and local cache
      const assignments = await this.getUserAssignments();
      const userEmail = (currentUser.email || '').toLowerCase().trim();
      const userId = (currentUser.id || '').toLowerCase().trim();

      // Check all assignments (both DB and local cache) by email, user_id, or auth UUID
      const activeAssignment = assignments.find(a => {
        if (a.status !== 'active') return false;
        const aEmail = (a.email || '').toLowerCase().trim();
        const aUserId = (a.user_id || '').toLowerCase().trim();

        return (
          (userEmail && (aEmail === userEmail || aUserId === userEmail)) ||
          (userId && (aUserId === userId || aEmail === userId))
        );
      });

      if (activeAssignment) {
        let assignedRole: Role | null = activeAssignment.role || null;

        // If role not populated or missing permissions, fetch role directly
        if (!assignedRole || !assignedRole.permissions || Object.keys(assignedRole.permissions).length === 0) {
          if (activeAssignment.role_id) {
            assignedRole = await this.getRoleById(activeAssignment.role_id);
          }
        }

        if (assignedRole) {
          const isSuper = assignedRole.slug === 'super_admin' || userEmail === 'admin@kdadks.com';
          return {
            role: assignedRole,
            permissions: assignedRole.permissions || {},
            isAdmin: isSuper,
            isSuperAdmin: isSuper,
          };
        }
      }
    } catch (e) {
      console.warn('Error resolving user permissions:', e);
    }

    // Default restricted viewer fallback for authenticated users without an explicit assignment
    return {
      role: {
        id: 'fallback-viewer',
        name: 'Standard User',
        slug: 'standard_user',
        is_system: false,
        is_default: true,
        status: 'active',
        color: 'gray',
        permissions: {
          dashboard: ['view'],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      permissions: {
        dashboard: ['view'],
      },
      isAdmin: false,
      isSuperAdmin: false,
    };
  }

  /**
   * Helper to check specific action permission
   */
  static hasPermission(
    permissions: RolePermissionsMap,
    module: SystemModule,
    action: RoleAction = 'view'
  ): boolean {
    if (!permissions) return false;
    const modulePerms = permissions[module];
    if (!modulePerms || !Array.isArray(modulePerms)) return false;
    return modulePerms.includes(action);
  }

  /**
   * Log an audit entry
   */
  private static async logAudit(
    action: RoleAuditLog['action'],
    targetType: 'role' | 'user',
    targetId: string,
    targetName: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    const user = await simpleAuth.getCurrentUser();
    const logEntry: RoleAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      details,
      performed_by: user?.email || 'admin@kdadks.com',
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('role_audit_logs').insert({
          action,
          target_type: targetType,
          target_id: targetId,
          target_name: targetName,
          details,
          performed_by: user?.email || 'admin@kdadks.com',
        });
      } catch (e) {
        console.warn('Could not write audit log to database:', e);
      }
    }

    const cached = this.getCachedAuditLogs();
    cached.unshift(logEntry);
    this.saveCachedAuditLogs(cached);
  }

  /**
   * Fetch all selectable users across Supabase Auth, Employees directory, and existing assignments
   */
  static async getSelectableUsers(): Promise<{
    authUsers: SelectableUser[];
    employees: SelectableUser[];
    allUsers: SelectableUser[];
  }> {
    const authUsers: SelectableUser[] = [];
    const employeesList: SelectableUser[] = [];
    const seenEmails = new Set<string>();

    const addAuthUser = (user: { id?: string; email: string; full_name?: string; created_at?: string; subtitle?: string }) => {
      const cleanEmail = (user.email || '').toLowerCase().trim();
      if (!cleanEmail || seenEmails.has(cleanEmail)) return;
      seenEmails.add(cleanEmail);
      authUsers.push({
        id: user.id || cleanEmail,
        email: user.email.trim(),
        full_name: user.full_name || cleanEmail.split('@')[0],
        source: 'auth',
        subtitle: user.subtitle || 'Supabase Auth Account',
        created_at: user.created_at,
      });
    };

    // 0. Fetch from Netlify Serverless API (uses Supabase Service Role Key)
    try {
      const resp = await fetch('/.netlify/functions/get-auth-users');
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && Array.isArray(json.users)) {
          json.users.forEach((u: any) => {
            addAuthUser({
              id: u.id,
              email: u.email,
              full_name: u.full_name,
              created_at: u.created_at,
            });
          });
        }
      }
    } catch (e) {
      // Serverless function might not be available in standard dev server
    }

    // 1. Fetch from Supabase auth.users (via RPC)
    if (isSupabaseConfigured) {
      try {
        const { data: rpcUsers, error: rpcError } = await supabase.rpc('get_auth_users');
        if (!rpcError && rpcUsers && Array.isArray(rpcUsers)) {
          rpcUsers.forEach((u: any) => {
            addAuthUser({
              id: u.id,
              email: u.email,
              full_name: u.full_name,
              created_at: u.created_at,
            });
          });
        }
      } catch (e) {
        console.warn('RPC get_auth_users not available:', e);
      }

      // 2. Also try View system_auth_users
      try {
        const { data: viewUsers, error: viewError } = await supabase
          .from('system_auth_users')
          .select('*');
        if (!viewError && viewUsers && Array.isArray(viewUsers)) {
          viewUsers.forEach((u: any) => {
            addAuthUser({
              id: u.id,
              email: u.email,
              full_name: u.full_name,
              created_at: u.created_at,
            });
          });
        }
      } catch (e) {
        console.warn('View system_auth_users not available:', e);
      }
    }

    // 3. Known Auth Users from Local Storage
    try {
      const knownRaw = localStorage.getItem('kdadks_known_auth_users');
      if (knownRaw) {
        const known: any[] = JSON.parse(knownRaw);
        if (Array.isArray(known)) {
          known.forEach(k => {
            if (k.email && k.email.toLowerCase().trim() !== 'contact@kdadks.com') {
              addAuthUser({
                id: k.id,
                email: k.email,
                full_name: k.full_name,
                created_at: k.created_at,
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('Error reading known auth users:', e);
    }

    // 4. Current user session
    try {
      const currentUser = await simpleAuth.getCurrentUser();
      if (currentUser && currentUser.email) {
        addAuthUser({
          id: currentUser.id,
          email: currentUser.email,
          full_name: currentUser.username || 'Current Admin',
          subtitle: 'Active Auth Session',
        });
      }
    } catch (e) {
      console.warn('Could not read currentUser session:', e);
    }

    // 5. Fallback Root Admin if not already present
    addAuthUser({
      id: 'admin-kdadks-root',
      email: 'admin@kdadks.com',
      full_name: 'System Administrator',
      subtitle: 'Root Admin Account',
    });

    // 6. Fetch Employees Directory
    try {
      const { employeeService } = await import('./employeeService');
      const emps = await employeeService.getEmployees();
      if (emps && Array.isArray(emps)) {
        emps.forEach(emp => {
          if (emp.email) {
            employeesList.push({
              id: emp.id,
              email: emp.email,
              full_name: emp.full_name,
              source: 'employee',
              subtitle: `Employee — ${emp.designation || 'Staff'} (${emp.department || 'General'})`,
              created_at: emp.created_at,
            });
          }
        });
      }
    } catch (e) {
      console.warn('Could not fetch employees for selectable users:', e);
    }

    return {
      authUsers,
      employees: employeesList,
      allUsers: [...authUsers, ...employeesList],
    };
  }

  /**
   * Fetch audit logs
   */
  static async getAuditLogs(limit: number = 50): Promise<RoleAuditLog[]> {
    if (!isSupabaseConfigured) {
      return this.getCachedAuditLogs().slice(0, limit);
    }

    try {
      const { data, error } = await supabase
        .from('role_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return this.getCachedAuditLogs().slice(0, limit);
      }

      return data || [];
    } catch (e) {
      console.warn('RoleService.getAuditLogs failed:', e);
      return this.getCachedAuditLogs().slice(0, limit);
    }
  }
}

export const roleService = RoleService;
export default RoleService;


