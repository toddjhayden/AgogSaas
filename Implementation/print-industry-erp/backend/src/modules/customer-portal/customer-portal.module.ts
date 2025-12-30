/**
 * Customer Portal Module
 * Main module for customer portal functionality
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328659
 */

import { Module } from '@nestjs/common';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { CustomerPortalResolver } from './customer-portal.resolver';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    CustomerAuthModule,
    DatabaseModule,
  ],
  providers: [CustomerPortalResolver],
  exports: [],
})
export class CustomerPortalModule {}
