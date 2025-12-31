import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WmsModule } from '../wms/wms.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { DeploymentApprovalService } from './services/deployment-approval.service';
import { DeploymentApprovalResolver } from '../../graphql/resolvers/deployment-approval.resolver';

/**
 * DevOpsModule
 *
 * Provides DevOps automation features including:
 * - Deployment approval workflows with multi-level approvals
 * - Edge device provisioning
 * - Health check integration
 * - SLA tracking and alerting
 *
 * REQ-DEVOPS-DEPLOY-APPROVAL-1767150339448
 * REQ-DEVOPS-EDGE-PROVISION-1767150339448
 */
@Module({
  imports: [
    DatabaseModule,
    WmsModule, // For DevOpsAlertingService
    MonitoringModule, // For HealthMonitorService
  ],
  providers: [
    DeploymentApprovalService,
    DeploymentApprovalResolver,
  ],
  exports: [
    DeploymentApprovalService,
  ],
})
export class DevOpsModule {}
