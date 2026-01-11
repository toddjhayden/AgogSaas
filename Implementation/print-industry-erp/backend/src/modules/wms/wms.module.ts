import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WMSResolver } from '../../graphql/resolvers/wms.resolver';
import { WmsDataQualityResolver } from '../../graphql/resolvers/wms-data-quality.resolver';
import { ForecastingModule } from '../forecasting/forecasting.module';

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
import { BinUtilizationPredictionService } from './services/bin-utilization-prediction.service';
import { BinAlgorithmTunerService } from './services/bin-algorithm-tuner.service';

// Import Carrier Integration services (REQ-STRATEGIC-AUTO-1767066329941 + REQ-1767925582663-ieqg0)
import { CredentialEncryptionService } from './services/credential-encryption.service';
import { CarrierErrorMapperService } from './services/carrier-error-mapper.service';
import { CarrierApiRateLimiterService } from './services/carrier-rate-limiter.service';
import { CarrierCircuitBreakerService } from './services/carrier-circuit-breaker.service';
import { ShipmentManifestOrchestratorService } from './services/shipment-manifest-orchestrator.service';
import { CarrierClientFactoryService } from './services/carrier-client-factory.service';
import { FedExClientService } from './services/carriers/fedex-client.service';
import { UPSClientService } from './services/carriers/ups-client.service';
import { CarrierIntegrationService } from './services/carrier-integration.service';
import { ShippingService } from './services/shipping.service';
import { FedExApiClient } from './services/carriers/fedex-api.client';
import { ShippingResolver } from '../../graphql/resolvers/shipping.resolver';

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
 * - Carrier Integrations (UPS, FedEx, DHL, etc.) - REQ-STRATEGIC-AUTO-1767066329941
 * - Kit Definitions (assemblies and bundles)
 * - Inventory Reservations (soft/hard allocations)
 * - Bin Utilization Optimization (intelligent placement with Hybrid FFD/BFD)
 * - Data Quality Monitoring (dimension validation, capacity checks)
 * - Utilization Prediction (REQ-STRATEGIC-AUTO-1766600259419 - proactive capacity planning)
 *
 * Migration Status:
 * - All 14 services converted to use @Injectable()
 * - Both resolvers converted to class-based pattern
 * - Proper dependency injection via constructors
 * - Integrated with DatabaseModule
 * - Carrier integration services added (REQ-STRATEGIC-AUTO-1767066329941)
 */
@Module({
  imports: [
    ForecastingModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    })
  ],
  providers: [
    // GraphQL Resolvers
    WMSResolver,
    WmsDataQualityResolver,
    ShippingResolver,

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
    BinUtilizationPredictionService,
    BinAlgorithmTunerService,

    // Carrier Integration Services (REQ-STRATEGIC-AUTO-1767066329941 + REQ-1767925582663-ieqg0)
    CredentialEncryptionService,
    CarrierErrorMapperService,
    CarrierApiRateLimiterService,
    CarrierCircuitBreakerService,
    ShipmentManifestOrchestratorService,
    CarrierClientFactoryService,
    FedExClientService,
    UPSClientService,
    FedExApiClient,
    CarrierIntegrationService,
    ShippingService,
  ],
  exports: [
    // Export key services for use by other modules
    BinUtilizationOptimizationService,
    BinUtilizationOptimizationHybridService,
    BinOptimizationHealthService,
    BinOptimizationHealthEnhancedService,
    BinOptimizationDataQualityService,
    BinUtilizationPredictionService,
    BinAlgorithmTunerService,
    FacilityBootstrapService,
    DevOpsAlertingService,

    // Export carrier integration services (REQ-1767925582663-ieqg0)
    CarrierClientFactoryService,
    ShipmentManifestOrchestratorService,
    CarrierApiRateLimiterService,
    CarrierCircuitBreakerService,
    CarrierIntegrationService,
    ShippingService,
    FedExApiClient,
  ],
})
export class WmsModule {}
