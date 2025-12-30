/**
 * Customer Auth Guard
 * Protects customer portal routes with JWT authentication
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328659
 */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class CustomerAuthGuard extends AuthGuard('customer-jwt') {
  getRequest(context: ExecutionContext) {
    // Support both HTTP and GraphQL contexts
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}
