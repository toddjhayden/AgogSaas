/**
 * Tenant Context Interceptor
 * Automatically validates tenant access on every GraphQL request
 *
 * REQ: REQ-STRATEGIC-AUTO-1767066329944
 * Security: GraphQL Authorization & Tenant Isolation
 *
 * Features:
 * - Validates requested tenantId matches authenticated user's tenantId
 * - Prevents cross-tenant data access
 * - Works automatically without manual validation calls
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantContextInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();

    // Get authenticated user's tenant ID
    const userTenantId = request.user?.tenantId;

    if (!userTenantId) {
      // User not authenticated (should be caught by JwtAuthGuard)
      this.logger.warn('TenantContextInterceptor: No user tenant ID found');
      return next.handle();
    }

    // Extract tenantId from various possible argument locations
    const requestedTenantId =
      args.tenantId ||
      args.input?.tenantId ||
      args.filter?.tenantId ||
      args.where?.tenantId;

    // If a specific tenant is requested, validate access
    if (requestedTenantId && requestedTenantId !== userTenantId) {
      this.logger.warn(
        `Tenant access denied: User ${request.user.userId} (tenant ${userTenantId}) attempted to access tenant ${requestedTenantId}`,
      );

      throw new ForbiddenException(
        `Access denied. You do not have permission to access data for tenant ${requestedTenantId}`,
      );
    }

    // Validation passed, continue with request
    return next.handle();
  }
}
