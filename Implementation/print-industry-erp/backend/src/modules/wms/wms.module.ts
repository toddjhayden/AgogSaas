import { Module } from '@nestjs/common';
import { WMSResolver } from '../../graphql/resolvers/wms.resolver';
import { WmsDataQualityResolver } from '../../graphql/resolvers/wms-data-quality.resolver';

// Import all WMS services
import { BinUtilizationOptimizationService } from './services/bin-utilization-optimization.service';
import { BinUtilizationOptimizationEnhancedService } from './services/bin-utilization-optimization-enhanced.service';
import { BinUtilizationOptimizationFixedService } from './services/bin-utilization-optimization-fixed.service';
import { BinUtilizationOptimizationHybridService } from './services/bin-utilization-optimization-hybrid.service';
import { BinOptimizationHealthService } from './services/bin-optimization-health.service';
import { BinOptimizationHealthEnhancedService } from './services/bin-optimization-health-enhanced.service';
import { BinOptimizationDataQualityService } from './services/bin-optimization-data-quality.service';
import { BinFragmentationMonitoringService } from './services/bin-fragmentation-monitoring.service';
import { BinUtilizationStatisticalAnalysisService } from './services/bin-utilization-statistical-analysis.service';
import { BinOptimizationMonitoringService } from './services/bin-optimization-monitoring.service';
import { DevOpsAlertingService } from './services/devops-alerting.service';
import { FacilityBootstrapService } from './services/facility-bootstrap.service';
import { BinUtilizationOptimizationDataQualityIntegrationService } from './services/bin-utilization-optimization-data-quality-integration';

/**
 * WMS MODULE - Phase 2 NestJS Migration
 *
 * Purpose: Warehouse Management System operations
 *
 * Features:
 * - Inventory Locations (physical locations with 5-tier security)
 * - Lots (batch tracking with traceability)
 * - Inventory Transactions (all movements)
 * - Wave Processing (efficient picking workflows)
 * - Pick Lists (warehouse worker assignments)
 * - Shipments (outbound shipping with 3PL integration)
 * - Carrier Integrations (UPS, FedEx, DHL, etc.)
 * - Kit Definitions (assemblies and bundles)
 * - Inventory Reservations (soft/hard allocations)
 * - Bin Utilization Optimization (intelligent placement)
 * - Data Quality Monitoring (dimension validation, capacity checks)
 *
 * Migration Status:
 * - All 13 services converted to use @Injectable()
 * - Both resolvers converted to class-based pattern
 * - Proper dependency injection via constructors
 * - Integrated with DatabaseModule
 */
@Module({
  providers: [
    // GraphQL Resolvers
    WMSResolver,
    WmsDataQualityResolver,

    // Core WMS Services
    BinUtilizationOptimizationService,
    BinUtilizationOptimizationEnhancedService,
    BinUtilizationOptimizationFixedService,
    BinUtilizationOptimizationHybridService,
    BinOptimizationHealthService,
    BinOptimizationHealthEnhancedService,
    BinOptimizationDataQualityService,
    BinFragmentationMonitoringService,
    BinUtilizationStatisticalAnalysisService,
    BinOptimizationMonitoringService,
    DevOpsAlertingService,
    FacilityBootstrapService,
    BinUtilizationOptimizationDataQualityIntegrationService,
  ],
  exports: [
    // Export key services for use by other modules
    BinUtilizationOptimizationService,
    BinOptimizationHealthService,
    BinOptimizationHealthEnhancedService,
    BinOptimizationDataQualityService,
    FacilityBootstrapService,
    DevOpsAlertingService,
  ],
})
export class WmsModule {}
