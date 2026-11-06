import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthState, AuthUser } from '../types/auth';
import { simpleAuth } from '../utils/simpleAuth';
import { RoleService } from '../services/roleService';
import { Role, RolePermissionsMap, SystemModule, RoleAction } from '../types/role';

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<RolePermissionsMap>({});
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const isAuth = await simpleAuth.isAuthenticated();
      setIsAuthenticated(isAuth);

      if (isAuth) {
        const currentUser = await simpleAuth.getCurrentUser();
        const rbac = await RoleService.getCurrentUserEffectivePermissions();

        if (currentUser) {
          setUser({
            ...currentUser,
            role: rbac.role,
            permissions: rbac.permissions,
            isSuperAdmin: rbac.isSuperAdmin,
          });
        }
        setRole(rbac.role);
        setPermissions(rbac.permissions);
      } else {
        setUser(null);
        setRole(null);
        setPermissions({});
      }
    } catch (err) {
      console.error('Error in AuthProvider.refresh:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const can = useCallback(
    (module: SystemModule, action: RoleAction = 'view'): boolean => {
      if (!role) return false;
      if (role.slug === 'super_admin') return true;
      return RoleService.hasPermission(permissions, module, action);
    },
    [role, permissions]
  );

  const hasAny = useCallback(
    (module: SystemModule): boolean => {
      if (!role) return false;
      if (role.slug === 'super_admin') return true;
      const actions = permissions[module];
      return Array.isArray(actions) && actions.length > 0;
    },
    [role, permissions]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        permissions,
        isAuthenticated,
        isLoading,
        can,
        hasAny,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
