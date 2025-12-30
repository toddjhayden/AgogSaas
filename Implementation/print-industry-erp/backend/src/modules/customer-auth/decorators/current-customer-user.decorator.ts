/**
 * Current Customer User Decorator
 * Extracts customer user from request context
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328659
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentCustomerUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);
