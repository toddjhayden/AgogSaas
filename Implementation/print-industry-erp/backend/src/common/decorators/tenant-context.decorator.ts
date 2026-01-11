/**
 * Tenant Context Decorator
 * REQ-1767924916114-xhhll: Audit logging implementation
 *
 * Extracts the tenant context from the GraphQL context
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const TenantContext = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return {
      tenantId: request.user?.tenantId,
      userId: request.user?.userId,
      username: request.user?.username,
    };
  },
);
