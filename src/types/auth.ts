// Authentication & User Session Types

import { SimpleUser } from '../utils/simpleAuth';
import { Role, RolePermissionsMap, SystemModule, RoleAction } from './role';

export interface AuthUser extends SimpleUser {
  role?: Role | null;
  permissions?: RolePermissionsMap;
  isSuperAdmin?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  role: Role | null;
  permissions: RolePermissionsMap;
  isAuthenticated: boolean;
  isLoading: boolean;
  can: (module: SystemModule, action?: RoleAction) => boolean;
  hasAny: (module: SystemModule) => boolean;
  refresh: () => Promise<void>;
}
