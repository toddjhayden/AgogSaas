/**
 * Operations Module
 *
 * Handles production operations and manufacturing execution:
 * - Work Centers (manufacturing equipment)
 * - Production Orders
 * - Operations (operation types)
 * - Production Runs (actual execution)
 * - OEE Calculations
 * - Maintenance Records
 * - Production Scheduling
 *
 * Related Resolver:
 * - OperationsResolver
 */

import { Module } from '@nestjs/common';
import { OperationsResolver } from '../../graphql/resolvers/operations.resolver';

@Module({
  providers: [OperationsResolver],
  exports: [],
})
export class OperationsModule {}
