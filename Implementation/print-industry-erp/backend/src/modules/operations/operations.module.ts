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
 * - Routing Templates and Operations
 * - Production Analytics (Real-time dashboard support)
 * - PDF Preflight & Color Management
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328658 - Production Planning & Scheduling Module
 * REQ: REQ-STRATEGIC-AUTO-1767048328660 - Real-Time Production Analytics Dashboard
 * REQ: REQ-STRATEGIC-AUTO-1767066329942 - PDF Preflight & Color Management
 * Updated: 2025-12-30
 *
 * Related Resolver:
 * - OperationsResolver
 *
 * Services:
 * - RoutingManagementService (routing expansion, yield calculations)
 * - ProductionPlanningService (MRP, production order generation, capacity planning)
 * - ProductionAnalyticsService (real-time analytics aggregations for dashboards)
 * - PreflightService (PDF validation, color management, preflight profiles)
 */

import { Module } from '@nestjs/common';
import { OperationsResolver } from '../../graphql/resolvers/operations.resolver';
import { RoutingManagementService } from './services/routing-management.service';
import { ProductionPlanningService } from './services/production-planning.service';
import { ProductionAnalyticsService } from './services/production-analytics.service';
import { PreflightService } from './services/preflight.service';

@Module({
  providers: [
    OperationsResolver,
    RoutingManagementService,
    ProductionPlanningService,
    ProductionAnalyticsService,
    PreflightService
  ],
  exports: [
    RoutingManagementService,
    ProductionPlanningService,
    ProductionAnalyticsService,
    PreflightService
  ],
})
export class OperationsModule {}
