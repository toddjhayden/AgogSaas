import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { DevOpsAlertingService } from '../../wms/services/devops-alerting.service';
import { HealthMonitorService } from '../../monitoring/services/health-monitor.service';

/**
 * DeploymentApprovalService
 *
 * Manages deployment approval workflows with multi-level approvals,
 * SLA tracking, health checks, and DevOps alerting integration.
 *
 * Follows the same pattern as PO approval workflow for consistency.
 */
@Injectable()
export class DeploymentApprovalService {
  constructor(
    private readonly db: DatabaseService,
    private readonly alerting: DevOpsAlertingService,
    private readonly healthMonitor: HealthMonitorService,
  ) {}

  /**
   * Create a new deployment request
   */
  async createDeployment(input: {
    tenantId: string;
    title: string;
    description?: string;
    environment: string;
    version: string;
    deployedBy: string;
    gitCommitHash?: string;
    gitBranch?: string;
    releaseNotes?: string;
    scheduledDeploymentTime?: string;
    urgency: string;
    autoRollbackEnabled?: boolean;
  }) {
    const deploymentNumber = await this.generateDeploymentNumber(input.tenantId);

    const result = await this.db.query(
      `INSERT INTO deployments (
        tenant_id, deployment_number, title, description, environment,
        version, deployed_by, git_commit_hash, git_branch, release_notes,
        scheduled_deployment_time, urgency, auto_rollback_enabled,
        status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'DRAFT', $14)
      RETURNING *`,
      [
        input.tenantId,
        deploymentNumber,
        input.title,
        input.description || null,
        input.environment,
        input.version,
        input.deployedBy,
        input.gitCommitHash || null,
        input.gitBranch || null,
        input.releaseNotes || null,
        input.scheduledDeploymentTime || null,
        input.urgency,
        input.autoRollbackEnabled ?? true,
        input.deployedBy,
      ]
    );

    return this.mapDeployment(result.rows[0]);
  }

  /**
   * Submit deployment for approval
   * Determines applicable workflow and starts approval process
   */
  async submitForApproval(
    deploymentId: string,
    submittedByUserId: string,
    tenantId: string
  ) {
    return await this.db.transaction(async (client) => {
      // Lock the deployment row
      const deploymentResult = await client.query(
        `SELECT * FROM deployments WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [deploymentId, tenantId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Validate status
      if (!['DRAFT', 'REJECTED'].includes(deployment.status)) {
        throw new Error(`Cannot submit deployment with status ${deployment.status}`);
      }

      // Get applicable workflow
      const workflow = await this.getApplicableWorkflow(
        tenantId,
        deployment.environment,
        deployment.urgency
      );

      if (!workflow) {
        throw new Error(`No active workflow found for ${deployment.environment} environment`);
      }

      // Get first approval step
      const stepResult = await client.query(
        `SELECT * FROM deployment_approval_workflow_steps
         WHERE workflow_id = $1 AND step_number = 1
         ORDER BY step_number LIMIT 1`,
        [workflow.id]
      );

      if (stepResult.rows.length === 0) {
        throw new Error('Workflow has no approval steps configured');
      }

      const firstStep = stepResult.rows[0];

      // Resolve first approver
      const approverId = await this.resolveApprover(
        firstStep.approver_id,
        firstStep.approver_role,
        firstStep.approver_group,
        tenantId
      );

      // Calculate SLA deadline
      const slaHours = firstStep.sla_hours || workflow.default_sla_hours;
      const slaDeadline = new Date();
      slaDeadline.setHours(slaDeadline.getHours() + slaHours);

      // Update deployment to PENDING_APPROVAL
      await client.query(
        `UPDATE deployments
         SET status = 'PENDING_APPROVAL',
             current_approval_workflow_id = $1,
             current_approval_step = 1,
             approval_started_at = CURRENT_TIMESTAMP,
             pending_approver_id = $2,
             sla_deadline = $3,
             updated_by = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [workflow.id, approverId, slaDeadline.toISOString(), submittedByUserId, deploymentId]
      );

      // Create submission history entry
      await client.query(
        `INSERT INTO deployment_approval_history (
          deployment_id, tenant_id, action, action_by_user_id,
          approval_step, comments
        ) VALUES ($1, $2, 'SUBMITTED', $3, 1, $4)`,
        [
          deploymentId,
          tenantId,
          submittedByUserId,
          `Submitted for ${deployment.environment} deployment approval`
        ]
      );

      // Send notification to approver
      await this.alerting.sendAlert({
        tenantId,
        severity: deployment.urgency === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        source: 'deployment-approval',
        message: `New deployment approval required: ${deployment.title} (${deployment.environment})`,
        metadata: {
          deploymentId,
          deploymentNumber: deployment.deployment_number,
          environment: deployment.environment,
          approverId,
          slaDeadline: slaDeadline.toISOString(),
        },
      });

      // Get updated deployment
      const updatedResult = await client.query(
        `SELECT * FROM deployments WHERE id = $1`,
        [deploymentId]
      );

      return this.mapDeployment(updatedResult.rows[0]);
    });
  }

  /**
   * Approve a deployment workflow step
   */
  async approveDeployment(
    deploymentId: string,
    approvedByUserId: string,
    tenantId: string,
    comments?: string
  ) {
    return await this.db.transaction(async (client) => {
      // Lock deployment
      const deploymentResult = await client.query(
        `SELECT * FROM deployments WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [deploymentId, tenantId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Validate status
      if (deployment.status !== 'PENDING_APPROVAL') {
        throw new Error('Deployment is not pending approval');
      }

      // Validate approver
      if (deployment.pending_approver_id !== approvedByUserId) {
        throw new Error('User is not authorized to approve this step');
      }

      // Get current workflow
      const workflowResult = await client.query(
        `SELECT * FROM deployment_approval_workflows WHERE id = $1`,
        [deployment.current_approval_workflow_id]
      );

      const workflow = workflowResult.rows[0];

      // Get total steps
      const stepsResult = await client.query(
        `SELECT COUNT(*) as total FROM deployment_approval_workflow_steps WHERE workflow_id = $1`,
        [workflow.id]
      );

      const totalSteps = parseInt(stepsResult.rows[0].total);
      const currentStep = deployment.current_approval_step;

      // Check if this is the final step
      if (currentStep >= totalSteps) {
        // Final approval - mark as APPROVED
        await client.query(
          `UPDATE deployments
           SET status = 'APPROVED',
               approval_completed_at = CURRENT_TIMESTAMP,
               approved_at = CURRENT_TIMESTAMP,
               current_approval_step = NULL,
               pending_approver_id = NULL,
               sla_deadline = NULL,
               updated_by = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [approvedByUserId, deploymentId]
        );

        // Create approval history entry
        await client.query(
          `INSERT INTO deployment_approval_history (
            deployment_id, tenant_id, action, action_by_user_id,
            approval_step, comments
          ) VALUES ($1, $2, 'APPROVED', $3, $4, $5)`,
          [deploymentId, tenantId, approvedByUserId, currentStep, comments || 'Final approval granted']
        );

        // Send deployment approved notification
        await this.alerting.sendAlert({
          tenantId,
          severity: 'INFO',
          source: 'deployment-approval',
          message: `Deployment approved: ${deployment.title} (${deployment.environment})`,
          metadata: {
            deploymentId,
            deploymentNumber: deployment.deployment_number,
            environment: deployment.environment,
          },
        });
      } else {
        // Move to next step
        const nextStepNumber = currentStep + 1;

        // Get next step
        const nextStepResult = await client.query(
          `SELECT * FROM deployment_approval_workflow_steps
           WHERE workflow_id = $1 AND step_number = $2`,
          [workflow.id, nextStepNumber]
        );

        const nextStep = nextStepResult.rows[0];

        // Resolve next approver
        const nextApproverId = await this.resolveApprover(
          nextStep.approver_id,
          nextStep.approver_role,
          nextStep.approver_group,
          tenantId
        );

        // Calculate new SLA deadline
        const slaHours = nextStep.sla_hours || workflow.default_sla_hours;
        const slaDeadline = new Date();
        slaDeadline.setHours(slaDeadline.getHours() + slaHours);

        // Update deployment
        await client.query(
          `UPDATE deployments
           SET current_approval_step = $1,
               pending_approver_id = $2,
               sla_deadline = $3,
               updated_by = $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [nextStepNumber, nextApproverId, slaDeadline.toISOString(), approvedByUserId, deploymentId]
        );

        // Create approval history entry
        await client.query(
          `INSERT INTO deployment_approval_history (
            deployment_id, tenant_id, action, action_by_user_id,
            approval_step, comments
          ) VALUES ($1, $2, 'APPROVED', $3, $4, $5)`,
          [deploymentId, tenantId, approvedByUserId, currentStep, comments || `Step ${currentStep} approved`]
        );

        // Notify next approver
        await this.alerting.sendAlert({
          tenantId,
          severity: deployment.urgency === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          source: 'deployment-approval',
          message: `Deployment approval required (Step ${nextStepNumber}): ${deployment.title}`,
          metadata: {
            deploymentId,
            deploymentNumber: deployment.deployment_number,
            stepNumber: nextStepNumber,
            stepName: nextStep.step_name,
            approverId: nextApproverId,
          },
        });
      }

      // Get updated deployment
      const updatedResult = await client.query(
        `SELECT * FROM deployments WHERE id = $1`,
        [deploymentId]
      );

      return this.mapDeployment(updatedResult.rows[0]);
    });
  }

  /**
   * Reject a deployment
   */
  async rejectDeployment(
    deploymentId: string,
    rejectedByUserId: string,
    tenantId: string,
    rejectionReason: string
  ) {
    return await this.db.transaction(async (client) => {
      // Lock deployment
      const deploymentResult = await client.query(
        `SELECT * FROM deployments WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [deploymentId, tenantId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Validate status
      if (deployment.status !== 'PENDING_APPROVAL') {
        throw new Error('Deployment is not pending approval');
      }

      // Validate rejector
      if (deployment.pending_approver_id !== rejectedByUserId) {
        throw new Error('User is not authorized to reject this deployment');
      }

      // Update deployment to REJECTED
      await client.query(
        `UPDATE deployments
         SET status = 'REJECTED',
             approval_completed_at = CURRENT_TIMESTAMP,
             current_approval_step = NULL,
             pending_approver_id = NULL,
             sla_deadline = NULL,
             updated_by = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [rejectedByUserId, deploymentId]
      );

      // Create rejection history entry
      await client.query(
        `INSERT INTO deployment_approval_history (
          deployment_id, tenant_id, action, action_by_user_id,
          approval_step, comments
        ) VALUES ($1, $2, 'REJECTED', $3, $4, $5)`,
        [deploymentId, tenantId, rejectedByUserId, deployment.current_approval_step, rejectionReason]
      );

      // Send rejection notification
      await this.alerting.sendAlert({
        tenantId,
        severity: 'WARNING',
        source: 'deployment-approval',
        message: `Deployment rejected: ${deployment.title} - ${rejectionReason}`,
        metadata: {
          deploymentId,
          deploymentNumber: deployment.deployment_number,
          rejectedBy: rejectedByUserId,
          reason: rejectionReason,
        },
      });

      // Get updated deployment
      const updatedResult = await client.query(
        `SELECT * FROM deployments WHERE id = $1`,
        [deploymentId]
      );

      return this.mapDeployment(updatedResult.rows[0]);
    });
  }

  /**
   * Delegate deployment approval to another user
   */
  async delegateApproval(
    deploymentId: string,
    delegatedByUserId: string,
    delegatedToUserId: string,
    tenantId: string,
    comments?: string
  ) {
    return await this.db.transaction(async (client) => {
      // Lock deployment
      const deploymentResult = await client.query(
        `SELECT * FROM deployments WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [deploymentId, tenantId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Validate status
      if (deployment.status !== 'PENDING_APPROVAL') {
        throw new Error('Deployment is not pending approval');
      }

      // Validate delegator
      if (deployment.pending_approver_id !== delegatedByUserId) {
        throw new Error('User is not authorized to delegate this approval');
      }

      // Update pending approver
      await client.query(
        `UPDATE deployments
         SET pending_approver_id = $1,
             updated_by = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [delegatedToUserId, delegatedByUserId, deploymentId]
      );

      // Create delegation history entry
      await client.query(
        `INSERT INTO deployment_approval_history (
          deployment_id, tenant_id, action, action_by_user_id,
          approval_step, delegated_to_user_id, comments
        ) VALUES ($1, $2, 'DELEGATED', $3, $4, $5, $6)`,
        [
          deploymentId,
          tenantId,
          delegatedByUserId,
          deployment.current_approval_step,
          delegatedToUserId,
          comments || 'Approval delegated'
        ]
      );

      // Notify new approver
      await this.alerting.sendAlert({
        tenantId,
        severity: deployment.urgency === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        source: 'deployment-approval',
        message: `Deployment approval delegated to you: ${deployment.title}`,
        metadata: {
          deploymentId,
          delegatedFrom: delegatedByUserId,
          delegatedTo: delegatedToUserId,
        },
      });

      // Get updated deployment
      const updatedResult = await client.query(
        `SELECT * FROM deployments WHERE id = $1`,
        [deploymentId]
      );

      return this.mapDeployment(updatedResult.rows[0]);
    });
  }

  /**
   * Request changes to a deployment
   */
  async requestChanges(
    deploymentId: string,
    requestedByUserId: string,
    tenantId: string,
    changeRequest: string
  ) {
    await this.db.query(
      `INSERT INTO deployment_approval_history (
        deployment_id, tenant_id, action, action_by_user_id,
        change_request
      ) VALUES ($1, $2, 'REQUESTED_CHANGES', $3, $4)`,
      [deploymentId, tenantId, requestedByUserId, changeRequest]
    );

    return { success: true };
  }

  /**
   * Get pending deployment approvals for a user
   */
  async getMyPendingApprovals(
    tenantId: string,
    userId: string,
    filters?: {
      environment?: string;
      urgency?: string;
      urgencyLevel?: string;
    }
  ) {
    let query = `
      SELECT * FROM v_pending_deployment_approvals
      WHERE tenant_id = $1 AND pending_approver_id = $2
    `;

    const params: any[] = [tenantId, userId];
    let paramIndex = 3;

    if (filters?.environment) {
      query += ` AND environment = $${paramIndex}`;
      params.push(filters.environment);
      paramIndex++;
    }

    if (filters?.urgency) {
      query += ` AND urgency = $${paramIndex}`;
      params.push(filters.urgency);
      paramIndex++;
    }

    if (filters?.urgencyLevel) {
      query += ` AND urgency_level = $${paramIndex}`;
      params.push(filters.urgencyLevel);
      paramIndex++;
    }

    query += ` ORDER BY
      CASE urgency_level
        WHEN 'URGENT' THEN 1
        WHEN 'WARNING' THEN 2
        WHEN 'NORMAL' THEN 3
      END,
      sla_deadline ASC NULLS LAST
    `;

    const result = await this.db.query(query, params);
    return result.rows.map(this.mapPendingApproval);
  }

  /**
   * Get deployment approval history
   */
  async getApprovalHistory(deploymentId: string, tenantId: string) {
    const result = await this.db.query(
      `SELECT * FROM deployment_approval_history
       WHERE deployment_id = $1 AND tenant_id = $2
       ORDER BY action_at DESC`,
      [deploymentId, tenantId]
    );

    return result.rows.map(this.mapHistoryEntry);
  }

  /**
   * Get deployment approval statistics
   */
  async getApprovalStats(tenantId: string) {
    const result = await this.db.query(
      `SELECT * FROM get_deployment_approval_stats($1)`,
      [tenantId]
    );

    return result.rows[0];
  }

  /**
   * Get all deployments with optional filtering
   */
  async getDeployments(
    tenantId: string,
    environment?: string,
    status?: string,
    limit: number = 50,
    offset: number = 0
  ) {
    let query = `
      SELECT * FROM deployments
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (environment) {
      query += ` AND environment = $${paramIndex}`;
      params.push(environment);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapDeployment(row));
  }

  /**
   * Get a single deployment by ID
   */
  async getDeployment(deploymentId: string, tenantId: string) {
    const result = await this.db.query(
      `SELECT * FROM deployments WHERE id = $1 AND tenant_id = $2`,
      [deploymentId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Deployment not found');
    }

    return this.mapDeployment(result.rows[0]);
  }

  /**
   * Get all deployment approval workflows
   */
  async getDeploymentApprovalWorkflows(
    tenantId: string,
    environment?: string,
    isActive?: boolean
  ) {
    let query = `
      SELECT * FROM deployment_approval_workflows
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (environment) {
      query += ` AND environment = $${paramIndex}`;
      params.push(environment);
      paramIndex++;
    }

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(isActive);
      paramIndex++;
    }

    query += ` ORDER BY environment, workflow_name`;

    const result = await this.db.query(query, params);
    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      workflowName: row.workflow_name,
      description: row.description,
      environment: row.environment,
      defaultSlaHours: row.default_sla_hours,
      escalationEnabled: row.escalation_enabled,
      escalationTimeHours: row.escalation_time_hours,
      escalationRecipients: row.escalation_recipients,
      autoApproveIfAllStepsCompleted: row.auto_approve_if_all_steps_completed,
      allowParallelApprovals: row.allow_parallel_approvals,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Get applicable workflow for a deployment
   */
  async getApplicableDeploymentWorkflow(
    tenantId: string,
    environment: string,
    urgency: string
  ) {
    const workflow = await this.getApplicableWorkflow(tenantId, environment, urgency);

    if (!workflow) {
      throw new Error(`No workflow found for environment ${environment} and urgency ${urgency}`);
    }

    return {
      id: workflow.id,
      tenantId: workflow.tenant_id,
      workflowName: workflow.workflow_name,
      description: workflow.description,
      environment: workflow.environment,
      defaultSlaHours: workflow.default_sla_hours,
      escalationEnabled: workflow.escalation_enabled,
      escalationTimeHours: workflow.escalation_time_hours,
      escalationRecipients: workflow.escalation_recipients,
      autoApproveIfAllStepsCompleted: workflow.auto_approve_if_all_steps_completed,
      allowParallelApprovals: workflow.allow_parallel_approvals,
      isActive: workflow.is_active,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at,
    };
  }

  /**
   * Cancel a deployment
   */
  async cancelDeployment(
    deploymentId: string,
    tenantId: string,
    cancelledByUserId: string,
    cancellationReason?: string
  ) {
    return await this.db.transaction(async (client) => {
      // Lock the deployment row
      const deploymentResult = await client.query(
        `SELECT * FROM deployments WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [deploymentId, tenantId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Can only cancel deployments that are not yet deployed
      if (['DEPLOYED', 'ROLLED_BACK', 'CANCELLED'].includes(deployment.status)) {
        throw new Error(`Cannot cancel deployment with status ${deployment.status}`);
      }

      // Update deployment status
      const updateResult = await client.query(
        `UPDATE deployments
         SET status = 'CANCELLED',
             updated_by = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [deploymentId, tenantId, cancelledByUserId]
      );

      // Record in history
      await client.query(
        `INSERT INTO deployment_approval_history (
          deployment_id, tenant_id, action, action_by_user_id,
          approval_step, comments
        ) VALUES ($1, $2, 'CANCELLED', $3, $4, $5)`,
        [
          deploymentId,
          tenantId,
          cancelledByUserId,
          deployment.current_approval_step || 0,
          cancellationReason || 'Deployment cancelled',
        ]
      );

      // Send notification
      await this.alerting.sendDeploymentCancelled(
        tenantId,
        this.mapDeployment(updateResult.rows[0]),
        cancelledByUserId,
        cancellationReason
      );

      return this.mapDeployment(updateResult.rows[0]);
    });
  }

  /**
   * Execute an approved deployment
   */
  async executeDeployment(
    deploymentId: string,
    tenantId: string,
    executedByUserId: string
  ) {
    return await this.db.transaction(async (client) => {
      // Lock the deployment row
      const deploymentResult = await client.query(
        `SELECT * FROM deployments WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [deploymentId, tenantId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Must be in APPROVED status to execute
      if (deployment.status !== 'APPROVED') {
        throw new Error(`Cannot execute deployment with status ${deployment.status}. Must be APPROVED.`);
      }

      // Update to IN_PROGRESS
      await client.query(
        `UPDATE deployments
         SET status = 'IN_PROGRESS',
             updated_by = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2`,
        [deploymentId, tenantId, executedByUserId]
      );

      // Record in history
      await client.query(
        `INSERT INTO deployment_approval_history (
          deployment_id, tenant_id, action, action_by_user_id,
          approval_step, comments
        ) VALUES ($1, $2, 'EXECUTION_STARTED', $3, $4, $5)`,
        [
          deploymentId,
          tenantId,
          executedByUserId,
          deployment.current_approval_step || 0,
          'Deployment execution started',
        ]
      );

      // Send notification
      await this.alerting.sendDeploymentExecutionStarted(
        tenantId,
        this.mapDeployment(deployment),
        executedByUserId
      );

      // Simulate deployment execution (in real scenario, this would trigger actual deployment)
      // For now, we'll mark it as DEPLOYED after a brief moment
      const finalResult = await client.query(
        `UPDATE deployments
         SET status = 'DEPLOYED',
             deployed_at = CURRENT_TIMESTAMP,
             rollback_available = true,
             updated_by = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [deploymentId, tenantId, executedByUserId]
      );

      // Record completion in history
      await client.query(
        `INSERT INTO deployment_approval_history (
          deployment_id, tenant_id, action, action_by_user_id,
          approval_step, comments
        ) VALUES ($1, $2, 'EXECUTION_COMPLETED', $3, $4, $5)`,
        [
          deploymentId,
          tenantId,
          executedByUserId,
          deployment.current_approval_step || 0,
          'Deployment execution completed successfully',
        ]
      );

      // Send success notification
      await this.alerting.sendDeploymentExecutionCompleted(
        tenantId,
        this.mapDeployment(finalResult.rows[0]),
        executedByUserId
      );

      return this.mapDeployment(finalResult.rows[0]);
    });
  }

  /**
   * Get rollback eligible deployments
   */
  async getRollbackEligibleDeployments(
    tenantId: string,
    environment?: string,
    limit: number = 50,
    offset: number = 0
  ) {
    let query = `
      SELECT * FROM v_rollback_eligible_deployments
      WHERE tenant_id = $1
    `;

    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (environment) {
      query += ` AND environment = $${paramIndex}`;
      params.push(environment);
      paramIndex++;
    }

    query += ` ORDER BY deployed_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map(this.mapRollbackEligibleDeployment);
  }

  /**
   * Get rollback decision criteria
   */
  async getRollbackDecisionCriteria(
    tenantId: string,
    environment?: string,
    isActive?: boolean
  ) {
    let query = `SELECT * FROM rollback_decision_criteria WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (environment) {
      query += ` AND environment = $${paramIndex}`;
      params.push(environment);
      paramIndex++;
    }

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(isActive);
      paramIndex++;
    }

    query += ` ORDER BY priority DESC, environment`;

    const result = await this.db.query(query, params);
    return result.rows.map(this.mapRollbackCriteria);
  }

  /**
   * Get deployment rollbacks
   */
  async getDeploymentRollbacks(deploymentId: string, tenantId: string) {
    const result = await this.db.query(
      `SELECT * FROM deployment_rollbacks
       WHERE deployment_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [deploymentId, tenantId]
    );

    return result.rows.map(this.mapDeploymentRollback);
  }

  /**
   * Get rollback health metrics
   */
  async getRollbackHealthMetrics(
    deploymentId: string,
    tenantId: string,
    limit: number = 100
  ) {
    const result = await this.db.query(
      `SELECT * FROM rollback_health_metrics
       WHERE deployment_id = $1 AND tenant_id = $2
       ORDER BY metric_timestamp DESC
       LIMIT $3`,
      [deploymentId, tenantId, limit]
    );

    return result.rows.map(this.mapRollbackHealthMetrics);
  }

  /**
   * Rollback a deployment
   */
  async rollbackDeployment(
    deploymentId: string,
    tenantId: string,
    rolledBackByUserId: string,
    rollbackReason: string,
    rollbackType: 'MANUAL' | 'AUTOMATIC' | 'EMERGENCY' = 'MANUAL'
  ) {
    return await this.db.transaction(async (client) => {
      // Lock the deployment
      const deploymentResult = await client.query(
        `SELECT * FROM deployments WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [deploymentId, tenantId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Validate deployment can be rolled back
      if (deployment.status !== 'DEPLOYED') {
        throw new Error(`Cannot rollback deployment with status ${deployment.status}`);
      }

      if (!deployment.rollback_available) {
        throw new Error('Deployment is not eligible for rollback');
      }

      // Find previous deployment
      const previousDeploymentResult = await client.query(
        `SELECT * FROM deployments
         WHERE tenant_id = $1
           AND environment = $2
           AND status = 'DEPLOYED'
           AND deployed_at < $3
         ORDER BY deployed_at DESC
         LIMIT 1`,
        [tenantId, deployment.environment, deployment.deployed_at]
      );

      const previousDeployment = previousDeploymentResult.rows[0] || null;

      // Generate rollback number
      const rollbackNumberResult = await client.query(
        `SELECT generate_rollback_number($1) as rollback_number`,
        [tenantId]
      );

      const rollbackNumber = rollbackNumberResult.rows[0].rollback_number;

      // Calculate post deployment duration
      const deployedAt = new Date(deployment.deployed_at);
      const postDeploymentDurationMinutes = Math.floor(
        (Date.now() - deployedAt.getTime()) / 60000
      );

      // Get latest health metrics
      const healthMetricsResult = await client.query(
        `SELECT * FROM rollback_health_metrics
         WHERE deployment_id = $1
         ORDER BY metric_timestamp DESC
         LIMIT 1`,
        [deploymentId]
      );

      const latestMetrics = healthMetricsResult.rows[0] || null;

      // Create rollback record
      const rollbackResult = await client.query(
        `INSERT INTO deployment_rollbacks (
          deployment_id, tenant_id, rollback_number, rollback_reason,
          rollback_type, decision_criteria, health_check_status,
          post_deployment_duration_minutes, status,
          previous_deployment_id, previous_version, previous_git_commit_hash,
          requires_approval, initiated_by_user_id, rollback_started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'IN_PROGRESS', $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          deploymentId,
          tenantId,
          rollbackNumber,
          rollbackReason,
          rollbackType,
          latestMetrics ? JSON.stringify(latestMetrics) : null,
          deployment.post_deployment_health_check,
          postDeploymentDurationMinutes,
          previousDeployment ? previousDeployment.id : null,
          previousDeployment ? previousDeployment.version : null,
          previousDeployment ? previousDeployment.git_commit_hash : null,
          rollbackType === 'AUTOMATIC' ? false : true, // Auto rollbacks don't need approval
          rolledBackByUserId,
        ]
      );

      const rollback = rollbackResult.rows[0];

      // Update deployment status to ROLLED_BACK
      await client.query(
        `UPDATE deployments
         SET status = 'ROLLED_BACK',
             updated_by = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [rolledBackByUserId, deploymentId]
      );

      // Create rollback history entry
      await client.query(
        `INSERT INTO deployment_approval_history (
          deployment_id, tenant_id, action, action_by_user_id,
          comments, metadata
        ) VALUES ($1, $2, 'ROLLED_BACK', $3, $4, $5)`,
        [
          deploymentId,
          tenantId,
          rolledBackByUserId,
          `Deployment rolled back: ${rollbackReason}`,
          JSON.stringify({
            rollbackNumber,
            rollbackType,
            previousVersion: previousDeployment?.version,
          }),
        ]
      );

      // Send rollback alert
      await this.alerting.sendAlert({
        tenantId,
        severity: rollbackType === 'AUTOMATIC' ? 'CRITICAL' : 'WARNING',
        source: 'deployment-rollback',
        message: `Deployment rolled back: ${deployment.title} (${rollbackType})`,
        metadata: {
          deploymentId,
          deploymentNumber: deployment.deployment_number,
          rollbackNumber,
          rollbackType,
          rollbackReason,
          previousVersion: previousDeployment?.version,
        },
      });

      // Complete the rollback (in real scenario, this would trigger actual rollback process)
      const rollbackDurationSeconds = 60; // Simulate rollback duration

      await client.query(
        `UPDATE deployment_rollbacks
         SET status = 'COMPLETED',
             rollback_completed_at = CURRENT_TIMESTAMP,
             rollback_duration_seconds = $1
         WHERE id = $2`,
        [rollbackDurationSeconds, rollback.id]
      );

      // Get updated rollback
      const updatedRollbackResult = await client.query(
        `SELECT * FROM deployment_rollbacks WHERE id = $1`,
        [rollback.id]
      );

      return this.mapDeploymentRollback(updatedRollbackResult.rows[0]);
    });
  }

  /**
   * Record health metrics for rollback decision
   */
  async recordRollbackHealthMetrics(
    deploymentId: string,
    tenantId: string,
    metrics: {
      errorRatePercent?: number;
      successRatePercent?: number;
      avgResponseTimeMs?: number;
      requestCount?: number;
      errorCount?: number;
      healthyServicesCount?: number;
      unhealthyServicesCount?: number;
      totalServicesCount?: number;
      cpuUsagePercent?: number;
      memoryUsagePercent?: number;
      diskUsagePercent?: number;
      customMetrics?: any;
    }
  ) {
    // Get deployment deployed_at
    const deploymentResult = await this.db.query(
      `SELECT deployed_at FROM deployments WHERE id = $1 AND tenant_id = $2`,
      [deploymentId, tenantId]
    );

    if (deploymentResult.rows.length === 0) {
      throw new Error('Deployment not found');
    }

    const deployedAt = new Date(deploymentResult.rows[0].deployed_at);
    const minutesSinceDeployment = Math.floor((Date.now() - deployedAt.getTime()) / 60000);

    // Get applicable rollback criteria
    const criteriaResult = await this.db.query(
      `SELECT * FROM rollback_decision_criteria rdc
       JOIN deployments d ON d.environment = rdc.environment AND d.tenant_id = rdc.tenant_id
       WHERE d.id = $1 AND rdc.is_active = TRUE
       ORDER BY rdc.priority DESC
       LIMIT 1`,
      [deploymentId]
    );

    let triggersRollbackCriteria = false;
    const violatedThresholds: any[] = [];

    if (criteriaResult.rows.length > 0) {
      const criteria = criteriaResult.rows[0];

      // Check error rate
      if (metrics.errorRatePercent && criteria.max_error_rate_percent) {
        if (metrics.errorRatePercent > criteria.max_error_rate_percent) {
          triggersRollbackCriteria = true;
          violatedThresholds.push({
            metric: 'error_rate_percent',
            value: metrics.errorRatePercent,
            threshold: criteria.max_error_rate_percent,
          });
        }
      }

      // Check response time
      if (metrics.avgResponseTimeMs && criteria.max_response_time_ms) {
        if (metrics.avgResponseTimeMs > criteria.max_response_time_ms) {
          triggersRollbackCriteria = true;
          violatedThresholds.push({
            metric: 'avg_response_time_ms',
            value: metrics.avgResponseTimeMs,
            threshold: criteria.max_response_time_ms,
          });
        }
      }

      // Check success rate
      if (metrics.successRatePercent !== undefined && criteria.min_success_rate_percent) {
        if (metrics.successRatePercent < criteria.min_success_rate_percent) {
          triggersRollbackCriteria = true;
          violatedThresholds.push({
            metric: 'success_rate_percent',
            value: metrics.successRatePercent,
            threshold: criteria.min_success_rate_percent,
          });
        }
      }
    }

    // Insert health metrics
    await this.db.query(
      `INSERT INTO rollback_health_metrics (
        deployment_id, tenant_id, minutes_since_deployment,
        error_rate_percent, success_rate_percent, avg_response_time_ms,
        request_count, error_count,
        healthy_services_count, unhealthy_services_count, total_services_count,
        cpu_usage_percent, memory_usage_percent, disk_usage_percent,
        custom_metrics, triggers_rollback_criteria, violated_thresholds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        deploymentId,
        tenantId,
        minutesSinceDeployment,
        metrics.errorRatePercent || null,
        metrics.successRatePercent || null,
        metrics.avgResponseTimeMs || null,
        metrics.requestCount || null,
        metrics.errorCount || null,
        metrics.healthyServicesCount || null,
        metrics.unhealthyServicesCount || null,
        metrics.totalServicesCount || null,
        metrics.cpuUsagePercent || null,
        metrics.memoryUsagePercent || null,
        metrics.diskUsagePercent || null,
        metrics.customMetrics ? JSON.stringify(metrics.customMetrics) : null,
        triggersRollbackCriteria,
        violatedThresholds.length > 0 ? JSON.stringify(violatedThresholds) : null,
      ]
    );

    // If auto-rollback is triggered, initiate automatic rollback
    if (triggersRollbackCriteria && criteriaResult.rows[0]?.auto_rollback_enabled) {
      await this.rollbackDeployment(
        deploymentId,
        tenantId,
        'system',
        `Automatic rollback triggered: ${violatedThresholds.map((v) => v.metric).join(', ')}`,
        'AUTOMATIC'
      );
    }

    return { triggersRollbackCriteria, violatedThresholds };
  }

  /**
   * Run pre or post deployment health check
   */
  async runHealthCheck(
    deploymentId: string,
    tenantId: string,
    checkType: 'PRE_DEPLOYMENT' | 'POST_DEPLOYMENT'
  ) {
    // Get system health status
    const healthStatus = await this.healthMonitor.getSystemHealth();

    // Determine if health check passed
    const allHealthy = Object.values(healthStatus.components).every(
      (component: any) => component.status === 'OPERATIONAL'
    );

    const checkStatus = allHealthy ? 'PASSED' : 'FAILED';

    // Update deployment
    const field = checkType === 'PRE_DEPLOYMENT' ? 'pre_deployment_health_check' : 'post_deployment_health_check';

    await this.db.query(
      `UPDATE deployments SET ${field} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [checkStatus, deploymentId]
    );

    // Create history entry
    const action = checkStatus === 'PASSED' ? 'HEALTH_CHECK_PASSED' : 'HEALTH_CHECK_FAILED';

    await this.db.query(
      `INSERT INTO deployment_approval_history (
        deployment_id, tenant_id, action, comments, metadata
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        deploymentId,
        tenantId,
        action,
        `${checkType} health check ${checkStatus.toLowerCase()}`,
        JSON.stringify({ healthStatus, checkType })
      ]
    );

    // Alert if health check failed
    if (checkStatus === 'FAILED') {
      await this.alerting.sendAlert({
        tenantId,
        severity: 'CRITICAL',
        source: 'deployment-health-check',
        message: `${checkType} health check FAILED for deployment ${deploymentId}`,
        metadata: { deploymentId, healthStatus },
      });
    }

    return { checkType, status: checkStatus, healthStatus };
  }

  /**
   * Get applicable workflow for deployment
   */
  private async getApplicableWorkflow(
    tenantId: string,
    environment: string,
    urgency: string
  ) {
    const result = await this.db.query(
      `SELECT * FROM deployment_approval_workflows
       WHERE tenant_id = $1
         AND environment = $2
         AND is_active = TRUE
       ORDER BY priority DESC
       LIMIT 1`,
      [tenantId, environment]
    );

    return result.rows[0] || null;
  }

  /**
   * Resolve approver from ID, role, or group
   */
  private async resolveApprover(
    approverId: string | null,
    approverRole: string | null,
    approverGroup: string | null,
    tenantId: string
  ): Promise<string> {
    // Direct user ID assignment
    if (approverId) {
      return approverId;
    }

    // Role-based assignment (simplified - would query user_roles table)
    if (approverRole) {
      // In production, query user_roles table to find user with role
      // For now, return a placeholder
      return `role:${approverRole}`;
    }

    // Group-based assignment
    if (approverGroup) {
      return `group:${approverGroup}`;
    }

    throw new Error('No approver configured for workflow step');
  }

  /**
   * Generate sequential deployment number
   */
  private async generateDeploymentNumber(tenantId: string): Promise<string> {
    const result = await this.db.query(
      `SELECT generate_deployment_number($1) as deployment_number`,
      [tenantId]
    );

    return result.rows[0].deployment_number;
  }

  /**
   * Map database row to Deployment GraphQL type
   */
  private mapDeployment(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      deploymentNumber: row.deployment_number,
      title: row.title,
      description: row.description,
      environment: row.environment,
      version: row.version,
      deployedBy: row.deployed_by,
      gitCommitHash: row.git_commit_hash,
      gitBranch: row.git_branch,
      releaseNotes: row.release_notes,
      status: row.status,
      scheduledDeploymentTime: row.scheduled_deployment_time,
      requestedAt: row.requested_at,
      approvedAt: row.approved_at,
      deployedAt: row.deployed_at,
      currentApprovalWorkflowId: row.current_approval_workflow_id,
      currentApprovalStep: row.current_approval_step,
      approvalStartedAt: row.approval_started_at,
      approvalCompletedAt: row.approval_completed_at,
      pendingApproverId: row.pending_approver_id,
      preDeploymentHealthCheck: row.pre_deployment_health_check,
      postDeploymentHealthCheck: row.post_deployment_health_check,
      rollbackAvailable: row.rollback_available,
      autoRollbackEnabled: row.auto_rollback_enabled,
      urgency: row.urgency,
      slaDeadline: row.sla_deadline,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to PendingDeploymentApproval GraphQL type
   */
  private mapPendingApproval(row: any) {
    return {
      deploymentId: row.deployment_id,
      deploymentNumber: row.deployment_number,
      tenantId: row.tenant_id,
      title: row.title,
      environment: row.environment,
      version: row.version,
      deployedBy: row.deployed_by,
      requestedAt: row.requested_at,
      currentStep: row.current_step,
      totalSteps: row.total_steps,
      stepDescription: row.step_description,
      pendingApproverId: row.pending_approver_id,
      urgency: row.urgency,
      slaDeadline: row.sla_deadline,
      slaRemainingHours: row.sla_remaining_hours,
      isOverdue: row.is_overdue,
      urgencyLevel: row.urgency_level,
      preDeploymentHealthCheck: row.pre_deployment_health_check,
    };
  }

  /**
   * Map database row to DeploymentApprovalHistoryEntry GraphQL type
   */
  private mapHistoryEntry(row: any) {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      tenantId: row.tenant_id,
      action: row.action,
      actionByUserId: row.action_by_user_id,
      actionAt: row.action_at,
      approvalStep: row.approval_step,
      comments: row.comments,
      delegatedToUserId: row.delegated_to_user_id,
      isEscalated: row.is_escalated,
      escalationReason: row.escalation_reason,
      changeRequest: row.change_request,
      metadata: row.metadata,
    };
  }

  /**
   * Map database row to RollbackEligibleDeployment GraphQL type
   */
  private mapRollbackEligibleDeployment(row: any) {
    return {
      deploymentId: row.deployment_id,
      deploymentNumber: row.deployment_number,
      tenantId: row.tenant_id,
      title: row.title,
      environment: row.environment,
      version: row.version,
      deployedBy: row.deployed_by,
      deployedAt: row.deployed_at,
      gitCommitHash: row.git_commit_hash,
      gitBranch: row.git_branch,
      minutesSinceDeployment: parseFloat(row.minutes_since_deployment),
      rollbackAvailable: row.rollback_available,
      autoRollbackEnabled: row.auto_rollback_enabled,
      postDeploymentHealthCheck: row.post_deployment_health_check,
      previousDeploymentId: row.previous_deployment_id,
      previousVersion: row.previous_version,
      currentErrorRatePercent: row.current_error_rate_percent ? parseFloat(row.current_error_rate_percent) : null,
      currentSuccessRatePercent: row.current_success_rate_percent ? parseFloat(row.current_success_rate_percent) : null,
      currentAvgResponseTimeMs: row.current_avg_response_time_ms,
      activeAutoRollbackRules: parseInt(row.active_auto_rollback_rules),
      rollbackCount: parseInt(row.rollback_count),
    };
  }

  /**
   * Map database row to RollbackDecisionCriteria GraphQL type
   */
  private mapRollbackCriteria(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      criteriaName: row.criteria_name,
      description: row.description,
      environment: row.environment,
      autoRollbackEnabled: row.auto_rollback_enabled,
      maxErrorRatePercent: row.max_error_rate_percent ? parseFloat(row.max_error_rate_percent) : null,
      maxResponseTimeMs: row.max_response_time_ms,
      minSuccessRatePercent: row.min_success_rate_percent ? parseFloat(row.min_success_rate_percent) : null,
      monitoringWindowMinutes: row.monitoring_window_minutes,
      decisionWindowMinutes: row.decision_window_minutes,
      requiredHealthyServices: row.required_healthy_services,
      maxUnhealthyInstancesPercent: row.max_unhealthy_instances_percent ? parseFloat(row.max_unhealthy_instances_percent) : null,
      customMetricThresholds: row.custom_metric_thresholds,
      notifyOnAutoRollback: row.notify_on_auto_rollback,
      notificationChannels: row.notification_channels,
      isActive: row.is_active,
      priority: row.priority,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to DeploymentRollback GraphQL type
   */
  private mapDeploymentRollback(row: any) {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      tenantId: row.tenant_id,
      rollbackNumber: row.rollback_number,
      rollbackReason: row.rollback_reason,
      rollbackType: row.rollback_type,
      decisionCriteria: row.decision_criteria,
      healthCheckStatus: row.health_check_status,
      postDeploymentDurationMinutes: row.post_deployment_duration_minutes,
      status: row.status,
      rollbackStartedAt: row.rollback_started_at,
      rollbackCompletedAt: row.rollback_completed_at,
      rollbackDurationSeconds: row.rollback_duration_seconds,
      previousDeploymentId: row.previous_deployment_id,
      previousVersion: row.previous_version,
      previousGitCommitHash: row.previous_git_commit_hash,
      affectedServices: row.affected_services,
      downtimeMinutes: row.downtime_minutes,
      requiresApproval: row.requires_approval,
      approvedByUserId: row.approved_by_user_id,
      approvedAt: row.approved_at,
      initiatedByUserId: row.initiated_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to RollbackHealthMetrics GraphQL type
   */
  private mapRollbackHealthMetrics(row: any) {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      tenantId: row.tenant_id,
      metricTimestamp: row.metric_timestamp,
      minutesSinceDeployment: row.minutes_since_deployment,
      errorRatePercent: row.error_rate_percent ? parseFloat(row.error_rate_percent) : null,
      successRatePercent: row.success_rate_percent ? parseFloat(row.success_rate_percent) : null,
      avgResponseTimeMs: row.avg_response_time_ms,
      requestCount: row.request_count,
      errorCount: row.error_count,
      healthyServicesCount: row.healthy_services_count,
      unhealthyServicesCount: row.unhealthy_services_count,
      totalServicesCount: row.total_services_count,
      cpuUsagePercent: row.cpu_usage_percent ? parseFloat(row.cpu_usage_percent) : null,
      memoryUsagePercent: row.memory_usage_percent ? parseFloat(row.memory_usage_percent) : null,
      diskUsagePercent: row.disk_usage_percent ? parseFloat(row.disk_usage_percent) : null,
      customMetrics: row.custom_metrics,
      triggersRollbackCriteria: row.triggers_rollback_criteria,
      violatedThresholds: row.violated_thresholds,
      createdAt: row.created_at,
    };
  }
}
