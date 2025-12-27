/**
 * Tenant Module
 *
 * Handles multi-tenant foundation and organizational structure:
 * - Tenants
 * - Facilities
 * - Users
 * - Currencies
 *
 * Related Resolver:
 * - TenantResolver
 */

import { Module } from '@nestjs/common';
import { TenantResolver } from '../../graphql/resolvers/tenant.resolver';

@Module({
  providers: [TenantResolver],
  exports: [],
})
export class TenantModule {}
