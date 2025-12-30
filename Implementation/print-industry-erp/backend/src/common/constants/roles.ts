/**
 * User Role Constants
 * Defines role hierarchy and permissions for RBAC
 *
 * REQ: REQ-STRATEGIC-AUTO-1767066329944
 * Security: GraphQL Authorization & Tenant Isolation
 */

/**
 * User Roles Enum
 * Hierarchical role system from lowest to highest privilege
 */
export enum UserRole {
  VIEWER = 'VIEWER',               // Read-only access to assigned areas
  OPERATOR = 'OPERATOR',           // Day-to-day operations (create/edit work orders, etc.)
  MANAGER = 'MANAGER',             // Department management, approve workflows
  ADMIN = 'ADMIN',                 // Tenant administration (manage users, settings)
  SUPER_ADMIN = 'SUPER_ADMIN',     // Platform administration (manage tenants)
}

/**
 * Role Hierarchy Levels
 * Higher number = higher privilege
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.VIEWER]: 1,
  [UserRole.OPERATOR]: 2,
  [UserRole.MANAGER]: 3,
  [UserRole.ADMIN]: 4,
  [UserRole.SUPER_ADMIN]: 5,
};

/**
 * Role Descriptions for Documentation
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.VIEWER]: 'Read-only access to assigned modules and data',
  [UserRole.OPERATOR]: 'Can perform day-to-day operations: create work orders, record production, etc.',
  [UserRole.MANAGER]: 'Can manage department operations, approve workflows, view reports',
  [UserRole.ADMIN]: 'Can manage tenant settings, users, and all business operations',
  [UserRole.SUPER_ADMIN]: 'Platform administrator: can manage multiple tenants and system configuration',
};

/**
 * Helper function to check if role A has higher or equal privilege than role B
 */
export function hasRoleLevel(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
