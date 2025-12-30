/**
 * JWT Authentication Guard
 * Global guard for protecting GraphQL resolvers with JWT authentication
 *
 * REQ: REQ-STRATEGIC-AUTO-1767066329944
 * Security: GraphQL Authorization & Tenant Isolation
 *
 * Usage:
 * @UseGuards(JwtAuthGuard)
 * export class MyResolver { ... }
 */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Override getRequest to support GraphQL execution context
   * Extracts HTTP request from GraphQL context
   */
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}
