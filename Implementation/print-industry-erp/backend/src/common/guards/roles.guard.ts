/**
 * Roles Guard
 * Enforces role-based access control (RBAC) on GraphQL resolvers
 *
 * REQ: REQ-STRATEGIC-AUTO-1767066329944
 * Security: GraphQL Authorization & Tenant Isolation
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('ADMIN')
 * export class MyResolver { ... }
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(), // Method-level
      context.getClass(),   // Class-level
    ]);

    // If no roles required, allow access (authenticated users only)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Extract user from GraphQL context
    const ctx = GqlExecutionContext.create(context);
    const { user } = ctx.getContext().req;

    // User should be authenticated (enforced by JwtAuthGuard)
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has at least one of the required roles
    const userRoles = user.roles || [];
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. User roles: ${userRoles.join(', ') || 'none'}`,
      );
    }

    return true;
  }
}
