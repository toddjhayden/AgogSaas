/**
 * Roles Decorator
 * Marks methods/classes with required roles for RBAC
 *
 * REQ: REQ-STRATEGIC-AUTO-1767066329944
 * Security: GraphQL Authorization & Tenant Isolation
 *
 * Usage:
 * @Roles('ADMIN', 'SUPER_ADMIN')
 * @Query('sensitiveData')
 * async getSensitiveData() { ... }
 */

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * @Roles decorator to specify required roles for an endpoint
 * @param roles - Array of role names that can access this endpoint
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
