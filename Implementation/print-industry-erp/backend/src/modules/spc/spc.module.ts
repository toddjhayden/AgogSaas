/**
 * SPC Module - Statistical Process Control
 *
 * Provides comprehensive SPC capabilities including:
 * - Control chart data collection and management
 * - Western Electric rules evaluation
 * - Process capability analysis (Cp, Cpk, Pp, Ppk)
 * - Out-of-control alerting
 * - Real-time monitoring
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328664 - Quality Management & SPC
 * Created: 2025-12-29
 *
 * Services:
 * - SPCDataCollectionService: Data ingestion from sensors and inspections
 * - SPCControlChartService: Control limit calculations and chart management
 * - SPCCapabilityAnalysisService: Process capability calculations
 * - SPCAlertingService: Western Electric rules and alert management
 * - SPCStatisticsService: Statistical calculations and utilities
 *
 * Related Resolver:
 * - SPCResolver
 */

import { Module } from '@nestjs/common';
import { SPCResolver } from '../../graphql/resolvers/spc.resolver';
import { SPCDataCollectionService } from './services/spc-data-collection.service';
import { SPCControlChartService } from './services/spc-control-chart.service';
import { SPCCapabilityAnalysisService } from './services/spc-capability-analysis.service';
import { SPCAlertingService } from './services/spc-alerting.service';
import { SPCStatisticsService } from './services/spc-statistics.service';

@Module({
  providers: [
    SPCResolver,
    SPCDataCollectionService,
    SPCControlChartService,
    SPCCapabilityAnalysisService,
    SPCAlertingService,
    SPCStatisticsService,
  ],
  exports: [
    SPCDataCollectionService,
    SPCControlChartService,
    SPCCapabilityAnalysisService,
    SPCAlertingService,
    SPCStatisticsService,
  ],
})
export class SPCModule {}
