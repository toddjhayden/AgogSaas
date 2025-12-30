/**
 * Analytics Module
 * Advanced Reporting & Business Intelligence Suite
 * REQ-STRATEGIC-AUTO-1767048328662
 *
 * Features:
 * - Cross-domain analytics (vendor → production, customer → warehouse)
 * - Export functionality (PDF, Excel, CSV)
 * - Executive KPI aggregations
 * - Trend analysis
 */

import { Module } from '@nestjs/common';
import { AnalyticsResolver } from './analytics.resolver';
import { AnalyticsService } from './services/analytics.service';
import { ExportService } from './services/export.service';

@Module({
  providers: [
    AnalyticsResolver,
    AnalyticsService,
    ExportService,
  ],
  exports: [AnalyticsService, ExportService],
})
export class AnalyticsModule {}
