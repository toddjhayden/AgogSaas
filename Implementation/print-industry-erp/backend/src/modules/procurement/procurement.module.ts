/**
 * Procurement Module
 *
 * Handles vendor performance tracking, tier classification, and alert management
 * for the procurement/supply chain domain.
 *
 * Features:
 * - Vendor performance scorecards with 12-month rolling metrics
 * - ESG (Environmental, Social, Governance) metrics tracking
 * - Automated tier classification (Strategic/Preferred/Transactional)
 * - Performance alert generation and workflow management
 * - Weighted scoring configurations per tenant/vendor type
 *
 * Related Migration: REQ-STRATEGIC-AUTO-1766627342634
 */

import { Module } from '@nestjs/common';
import { VendorPerformanceResolver } from '../../graphql/resolvers/vendor-performance.resolver';
import { VendorPerformanceService } from './services/vendor-performance.service';
import { VendorTierClassificationService } from './services/vendor-tier-classification.service';
import { VendorAlertEngineService } from './services/vendor-alert-engine.service';

@Module({
  providers: [
    VendorPerformanceResolver,
    VendorPerformanceService,
    VendorTierClassificationService,
    VendorAlertEngineService,
  ],
  exports: [
    VendorPerformanceService,
    VendorTierClassificationService,
    VendorAlertEngineService,
  ],
})
export class ProcurementModule {}
