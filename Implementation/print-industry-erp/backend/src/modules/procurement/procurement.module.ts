/**
 * Procurement Module
 *
 * Handles vendor performance tracking, tier classification, alert management,
 * and purchase order approval workflows for the procurement/supply chain domain.
 *
 * Features:
 * - Vendor performance scorecards with 12-month rolling metrics
 * - ESG (Environmental, Social, Governance) metrics tracking
 * - Automated tier classification (Strategic/Preferred/Transactional)
 * - Performance alert generation and workflow management
 * - Weighted scoring configurations per tenant/vendor type
 * - Multi-level PO approval workflows (REQ-STRATEGIC-AUTO-1766676891764)
 * - Approval authority management and routing
 * - Complete approval audit trail
 *
 * Related Migrations:
 * - REQ-STRATEGIC-AUTO-1766627342634 (Vendor Performance)
 * - REQ-STRATEGIC-AUTO-1766676891764 (PO Approval Workflow)
 */

import { Module } from '@nestjs/common';
import { VendorPerformanceResolver } from '../../graphql/resolvers/vendor-performance.resolver';
import { POApprovalWorkflowResolver } from '../../graphql/resolvers/po-approval-workflow.resolver';
import { VendorPerformanceService } from './services/vendor-performance.service';
import { VendorTierClassificationService } from './services/vendor-tier-classification.service';
import { VendorAlertEngineService } from './services/vendor-alert-engine.service';
import { ApprovalWorkflowService } from './services/approval-workflow.service';

@Module({
  providers: [
    VendorPerformanceResolver,
    POApprovalWorkflowResolver,
    VendorPerformanceService,
    VendorTierClassificationService,
    VendorAlertEngineService,
    ApprovalWorkflowService,
  ],
  exports: [
    VendorPerformanceService,
    VendorTierClassificationService,
    VendorAlertEngineService,
    ApprovalWorkflowService,
  ],
})
export class ProcurementModule {}
