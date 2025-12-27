/**
 * TENANT VALIDATION UTILITIES
 *
 * Purpose: Multi-tenant security utilities for GraphQL resolvers
 * Ensures users can only access data from their own tenant
 *
 * Security Pattern:
 * - Extract tenant_id from JWT token in GraphQL context
 * - Validate requested tenantId matches user's tenant
 * - Throw ForbiddenError if mismatch detected
 *
 * Usage:
 * ```typescript
 * @Query('vendorScorecard')
 * async getVendorScorecard(
 *   @Args('tenantId') tenantId: string,
 *   @Args('vendorId') vendorId: string,
 *   @Context() context: any
 * ) {
 *   validateTenantAccess(context, tenantId); // ADD THIS LINE
 *   return this.vendorPerformanceService.getVendorScorecard(tenantId, vendorId);
 * }
 * ```
 */

/**
 * Custom exception classes for tenant validation
 * (Plain JavaScript - no framework dependencies)
 */
export class UnauthorizedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedException';
  }
}

export class ForbiddenException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenException';
  }
}

/**
 * Validates that the requesting user has access to the specified tenant's data
 *
 * @param context - GraphQL context containing request and user info from JWT
 * @param requestedTenantId - The tenant ID being requested in the query/mutation
 * @throws UnauthorizedException if user is not authenticated
 * @throws ForbiddenException if user attempts to access another tenant's data
 */
export function validateTenantAccess(context: any, requestedTenantId: string): void {
  // Check if user is authenticated
  if (!context?.req?.user) {
    throw new UnauthorizedException('User must be authenticated to access this resource');
  }

  // Extract user's tenant ID from JWT token
  const userTenantId = context.req.user.tenantId || context.req.user.tenant_id;

  if (!userTenantId) {
    throw new UnauthorizedException('User tenant information is missing. Please re-authenticate.');
  }

  // Validate that requested tenant matches user's tenant
  if (userTenantId !== requestedTenantId) {
    throw new ForbiddenException(
      `Access denied. You do not have permission to access data for tenant ${requestedTenantId}`
    );
  }
}

/**
 * Extracts the authenticated user's tenant ID from the GraphQL context
 *
 * @param context - GraphQL context containing request and user info from JWT
 * @returns The tenant ID of the authenticated user
 * @throws UnauthorizedException if user is not authenticated or tenant info is missing
 */
export function getTenantIdFromContext(context: any): string {
  if (!context?.req?.user) {
    throw new UnauthorizedException('User must be authenticated to access this resource');
  }

  const tenantId = context.req.user.tenantId || context.req.user.tenant_id;

  if (!tenantId) {
    throw new UnauthorizedException('User tenant information is missing. Please re-authenticate.');
  }

  return tenantId;
}

/**
 * Extracts the authenticated user's ID from the GraphQL context
 *
 * @param context - GraphQL context containing request and user info from JWT
 * @returns The user ID of the authenticated user
 * @throws UnauthorizedException if user is not authenticated
 */
export function getUserIdFromContext(context: any): string {
  if (!context?.req?.user) {
    throw new UnauthorizedException('User must be authenticated to access this resource');
  }

  const userId = context.req.user.id;

  if (!userId) {
    throw new UnauthorizedException('User information is missing. Please re-authenticate.');
  }

  return userId;
}
