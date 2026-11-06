// Admin Permissions & Override Controls Utility
// Enforces role-based permissions and entity boundary validation within selected company context

import { simpleAuth } from './simpleAuth';
import { RoleService } from '../services/roleService';

export type UserRole = 'admin' | 'manager' | 'sales_rep';

export interface UserPermissions {
  role: UserRole;
  canViewAllEntities: boolean;
  canManageDraftOpportunities: boolean;
  canManageDraftQuotes: boolean;
  canOverrideStageRestrictions: boolean;
  canEditLineItems: boolean;
  canEditPricing: boolean;
}

/**
 * Get current user role from session or RBAC service
 */
export async function getCurrentUserRole(): Promise<UserRole> {
  const user = await simpleAuth.getCurrentUser();
  if (!user) return 'sales_rep';

  try {
    const { role } = await RoleService.getCurrentUserEffectivePermissions();
    if (role) {
      if (role.slug === 'super_admin' || role.slug.includes('admin')) return 'admin';
      if (role.slug.includes('manager') || role.slug.includes('lead')) return 'manager';
      if (role.slug.includes('sales')) return 'sales_rep';
    }
  } catch (e) {
    console.warn('Error fetching dynamic role in getCurrentUserRole:', e);
  }
  
  // Fallback if role is not resolved
  return user.email.toLowerCase() === 'admin@kdadks.com' ? 'admin' : 'sales_rep';
}

/**
 * Check if the user has administrative privileges within the active company context
 */
export function hasAdminPermissions(role: UserRole = 'admin'): boolean {
  return role === 'admin' || role === 'manager';
}

/**
 * Returns comprehensive permissions set for a given role
 */
export function getUserPermissions(role: UserRole = 'admin'): UserPermissions {
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';

  return {
    role,
    canViewAllEntities: isAdmin,
    canManageDraftOpportunities: isAdmin || isManager,
    canManageDraftQuotes: isAdmin || isManager,
    canOverrideStageRestrictions: isAdmin,
    canEditLineItems: isAdmin || isManager,
    canEditPricing: isAdmin || isManager
  };
}

/**
 * Validate that an entity modification belongs to the currently active company context
 */
export function validateCompanyBoundary(
  entityCompanyId?: string | null,
  activeCompanyId?: string | null
): boolean {
  // If no active company is selected, or if entity has no specific company, allow access
  if (!activeCompanyId || !entityCompanyId) return true;
  return entityCompanyId === activeCompanyId;
}

