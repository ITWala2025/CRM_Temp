import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import { RoleService } from '../services/roleService';
import { Role, RoleAction, RolePermissionsMap, SystemModule } from '../types/role';

export interface UseRolePermissionsReturn {
  currentRole: Role | null;
  permissions: RolePermissionsMap;
  can: (module: SystemModule, action?: RoleAction) => boolean;
  hasAny: (module: SystemModule) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to check RBAC permissions for the currently authenticated user
 */
export function useRolePermissions(): UseRolePermissionsReturn {
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<RolePermissionsMap>({});
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await RoleService.getCurrentUserEffectivePermissions();
      setCurrentRole(res.role);
      setPermissions(res.permissions || {});
      setIsAdmin(res.isAdmin);
      setIsSuperAdmin(res.isSuperAdmin);
    } catch (err) {
      console.error('useRolePermissions failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();

    // Listen to Supabase Auth state changes
    if (isSupabaseConfigured) {
      const { data: authListener } = supabase.auth.onAuthStateChange(() => {
        fetchPermissions();
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, [fetchPermissions]);

  const can = useCallback(
    (module: SystemModule, action: RoleAction = 'view'): boolean => {
      if (isSuperAdmin) return true;
      return RoleService.hasPermission(permissions, module, action);
    },
    [isSuperAdmin, permissions]
  );

  const hasAny = useCallback(
    (module: SystemModule): boolean => {
      if (isSuperAdmin) return true;
      const actions = permissions[module];
      return Array.isArray(actions) && actions.length > 0;
    },
    [isSuperAdmin, permissions]
  );

  return {
    currentRole,
    permissions,
    can,
    hasAny,
    isAdmin,
    isSuperAdmin,
    loading,
    refresh: fetchPermissions,
  };
}
