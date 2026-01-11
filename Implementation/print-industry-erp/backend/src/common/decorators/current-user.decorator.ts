/**
 * Current User Decorator
 * REQ-1767924916114-xhhll: Audit logging implementation
 *
 * Extracts the current authenticated user from the GraphQL context
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);
