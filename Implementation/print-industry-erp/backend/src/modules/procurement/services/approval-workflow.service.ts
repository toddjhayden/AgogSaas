/**
 * Purchase Order Approval Workflow Service
 * REQ: REQ-STRATEGIC-AUTO-1766676891764
 *
 * This service manages the complete lifecycle of PO approval workflows including:
 * - Workflow selection and initialization
 * - Authorization and approval authority validation
 * - Step progression and routing
 * - Approval actions (approve, reject, delegate, request changes)
 * - SLA tracking and escalation
 * - Complete audit trail
 */

import { Injectable, Inject, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';

export interface ApprovalWorkflow {
  id: string;
  tenantId: string;
  workflowName: string;
  description?: string;
  appliesToFacilityIds?: string[];
  minAmount?: number;
  maxAmount?: number;
  approvalType: 'SEQUENTIAL' | 'PARALLEL' | 'ANY_ONE';
  isActive: boolean;
  priority: number;
  slaHoursPerStep: number;
  escalationEnabled: boolean;
  escalationUserId?: string;
  autoApproveUnderAmount?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ApprovalWorkflowStep {
  id: string;
  workflowId: string;
  stepNumber: number;
  stepName: string;
  approverRole?: string;
  approverUserId?: string;
  approverUserGroupId?: string;
  isRequired: boolean;
  canDelegate: boolean;
  canSkip: boolean;
  minApprovalLimit?: number;
  createdAt: Date;
}

export interface ApprovalHistoryEntry {
  id: string;
  purchaseOrderId: string;
  workflowId?: string;
  stepId?: string;
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'DELEGATED' | 'ESCALATED' | 'REQUESTED_CHANGES' | 'CANCELLED';
  actionByUserId: string;
  actionDate: Date;
  stepNumber?: number;
  stepName?: string;
  comments?: string;
  rejectionReason?: string;
  delegatedFromUserId?: string;
  delegatedToUserId?: string;
  slaDeadline?: Date;
  wasEscalated: boolean;
  poSnapshot?: any;
  createdAt: Date;
}

export interface UserApprovalAuthority {
  id: string;
  tenantId: string;
  userId: string;
  approvalLimit: number;
  currencyCode: string;
  roleName?: string;
  effectiveFromDate: Date;
  effectiveToDate?: Date;
  canDelegate: boolean;
  grantedByUserId?: string;
  grantedAt: Date;
}

export interface PurchaseOrderForApproval {
  id: string;
  tenantId: string;
  facilityId: string;
  poNumber: string;
  vendorId: string;
  totalAmount: number;
  poCurrencyCode: string;
  status: string;
  requiresApproval: boolean;
  currentApprovalWorkflowId?: string;
  currentApprovalStepNumber?: number;
  approvalStartedAt?: Date;
  approvalCompletedAt?: Date;
  pendingApproverUserId?: string;
  workflowSnapshot?: any;
  createdBy?: string;
}

@Injectable()
export class ApprovalWorkflowService {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool
  ) {}

  /**
   * Submit a purchase order for approval
   * This initiates the approval workflow based on PO amount and facility
   */
  async submitForApproval(
    purchaseOrderId: string,
    submittedByUserId: string,
    tenantId: string
  ): Promise<PurchaseOrderForApproval> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 1. Get PO details and validate
      const poResult = await client.query<PurchaseOrderForApproval>(
        `SELECT id, tenant_id, facility_id, po_number, vendor_id, total_amount,
                po_currency_code, status, requires_approval, created_by,
                current_approval_workflow_id, current_approval_step_number
         FROM purchase_orders
         WHERE id = $1 AND tenant_id = $2`,
        [purchaseOrderId, tenantId]
      );

      if (poResult.rows.length === 0) {
        throw new NotFoundException(`Purchase order ${purchaseOrderId} not found`);
      }

      const po = poResult.rows[0];

      // Validate PO is in correct state for submission
      if (po.status !== 'DRAFT' && po.status !== 'REJECTED') {
        throw new BadRequestException(
          `Purchase order must be in DRAFT or REJECTED status to submit for approval. Current status: ${po.status}`
        );
      }

      // Validate user has permission to submit (must be creator or buyer)
      if (po.createdBy !== submittedByUserId) {
        // Check if user is the buyer
        const buyerCheck = await client.query(
          `SELECT buyer_user_id FROM purchase_orders WHERE id = $1`,
          [purchaseOrderId]
        );

        if (buyerCheck.rows[0]?.buyer_user_id !== submittedByUserId) {
          throw new ForbiddenException('Only the PO creator or buyer can submit for approval');
        }
      }

      // 2. Determine applicable workflow
      const workflowResult = await client.query<ApprovalWorkflow>(
        `SELECT * FROM po_approval_workflows
         WHERE id = get_applicable_workflow($1, $2, $3)`,
        [tenantId, po.facilityId, po.totalAmount]
      );

      if (workflowResult.rows.length === 0) {
        throw new BadRequestException(
          `No active approval workflow configured for PO amount ${po.totalAmount} in this facility`
        );
      }

      const workflow = workflowResult.rows[0];

      // Check if auto-approval applies
      if (workflow.autoApproveUnderAmount && po.totalAmount < workflow.autoApproveUnderAmount) {
        // Auto-approve
        await client.query(
          `UPDATE purchase_orders
           SET status = 'APPROVED',
               approved_by_user_id = $1,
               approved_at = NOW(),
               approval_completed_at = NOW(),
               updated_at = NOW()
           WHERE id = $2`,
          [submittedByUserId, purchaseOrderId]
        );

        // Create history entry for auto-approval
        await this.createHistoryEntry(client, {
          purchaseOrderId,
          workflowId: workflow.id,
          action: 'APPROVED',
          actionByUserId: submittedByUserId,
          comments: 'Auto-approved based on workflow configuration'
        });

        await client.query('COMMIT');

        const updatedPo = await this.getPurchaseOrder(purchaseOrderId, tenantId);
        return updatedPo;
      }

      // 3. Get workflow steps
      const stepsResult = await client.query<ApprovalWorkflowStep>(
        `SELECT * FROM po_approval_workflow_steps
         WHERE workflow_id = $1
         ORDER BY step_number`,
        [workflow.id]
      );

      if (stepsResult.rows.length === 0) {
        throw new BadRequestException('Workflow has no approval steps configured');
      }

      // 4. Determine first approver
      const firstStep = stepsResult.rows[0];
      const firstApproverId = await this.resolveApprover(client, firstStep, tenantId);

      if (!firstApproverId) {
        throw new BadRequestException(
          `Cannot determine approver for step 1 (${firstStep.stepName}). Check workflow configuration.`
        );
      }

      // 5. Calculate SLA deadline
      const slaDeadline = new Date();
      slaDeadline.setHours(slaDeadline.getHours() + workflow.slaHoursPerStep);

      // 6. Capture workflow snapshot (prevents mid-flight changes)
      const workflowSnapshot = {
        workflow,
        steps: stepsResult.rows
      };

      // 7. Update PO to PENDING_APPROVAL status
      await client.query(
        `UPDATE purchase_orders
         SET status = 'PENDING_APPROVAL',
             current_approval_workflow_id = $1,
             current_approval_step_number = 1,
             approval_started_at = NOW(),
             pending_approver_user_id = $2,
             workflow_snapshot = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [workflow.id, firstApproverId, JSON.stringify(workflowSnapshot), purchaseOrderId]
      );

      // 8. Create history entry for submission
      await this.createHistoryEntry(client, {
        purchaseOrderId,
        workflowId: workflow.id,
        stepId: firstStep.id,
        action: 'SUBMITTED',
        actionByUserId: submittedByUserId,
        stepNumber: 1,
        stepName: firstStep.stepName,
        slaDeadline
      });

      await client.query('COMMIT');

      // 9. Return updated PO
      const updatedPo = await this.getPurchaseOrder(purchaseOrderId, tenantId);

      return updatedPo;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Approve a purchase order workflow step
   * Validates authorization and advances workflow or completes it
   */
  async approvePO(
    purchaseOrderId: string,
    approvedByUserId: string,
    tenantId: string,
    comments?: string
  ): Promise<PurchaseOrderForApproval> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 1. Get PO details
      const po = await this.getPurchaseOrderForUpdate(client, purchaseOrderId, tenantId);

      // 2. Validate PO is in PENDING_APPROVAL status
      if (po.status !== 'PENDING_APPROVAL') {
        throw new BadRequestException(
          `Purchase order must be in PENDING_APPROVAL status. Current status: ${po.status}`
        );
      }

      // 3. Validate user is the pending approver
      if (po.pendingApproverUserId !== approvedByUserId) {
        throw new ForbiddenException(
          `You are not authorized to approve this purchase order at this step. ` +
          `Current approver: ${po.pendingApproverUserId}`
        );
      }

      // 4. Validate user has approval authority for this amount
      await this.validateApprovalAuthority(client, approvedByUserId, po.totalAmount, tenantId);

      // 5. Get workflow configuration from snapshot
      const workflowSnapshot = po.workflowSnapshot;
      if (!workflowSnapshot) {
        throw new BadRequestException('Workflow snapshot not found. PO may be corrupted.');
      }

      const workflow = workflowSnapshot.workflow;
      const steps: ApprovalWorkflowStep[] = workflowSnapshot.steps;
      const currentStep = steps.find(s => s.stepNumber === po.currentApprovalStepNumber);

      if (!currentStep) {
        throw new BadRequestException(`Current approval step ${po.currentApprovalStepNumber} not found in workflow`);
      }

      // 6. Create approval history entry
      await this.createHistoryEntry(client, {
        purchaseOrderId,
        workflowId: workflow.id,
        stepId: currentStep.id,
        action: 'APPROVED',
        actionByUserId: approvedByUserId,
        stepNumber: po.currentApprovalStepNumber,
        stepName: currentStep.stepName,
        comments
      });

      // 7. Check if this was the last step
      const isLastStep = (po.currentApprovalStepNumber ?? 0) >= steps.length;

      if (isLastStep) {
        // Workflow complete - mark as APPROVED
        await client.query(
          `UPDATE purchase_orders
           SET status = 'APPROVED',
               approval_completed_at = NOW(),
               approved_by_user_id = $1,
               approved_at = NOW(),
               current_approval_step_number = NULL,
               pending_approver_user_id = NULL,
               updated_at = NOW()
           WHERE id = $2`,
          [approvedByUserId, purchaseOrderId]
        );
      } else {
        // Advance to next step
        const nextStepNumber = po.currentApprovalStepNumber! + 1;
        const nextStep = steps.find(s => s.stepNumber === nextStepNumber);

        if (!nextStep) {
          throw new BadRequestException(`Next step ${nextStepNumber} not found in workflow`);
        }

        const nextApproverId = await this.resolveApprover(client, nextStep, tenantId);

        if (!nextApproverId) {
          throw new BadRequestException(
            `Cannot determine approver for step ${nextStepNumber} (${nextStep.stepName})`
          );
        }

        // Calculate new SLA deadline
        const slaDeadline = new Date();
        slaDeadline.setHours(slaDeadline.getHours() + workflow.slaHoursPerStep);

        await client.query(
          `UPDATE purchase_orders
           SET current_approval_step_number = $1,
               pending_approver_user_id = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [nextStepNumber, nextApproverId, purchaseOrderId]
        );
      }

      await client.query('COMMIT');

      // 8. Return updated PO
      const updatedPo = await this.getPurchaseOrder(purchaseOrderId, tenantId);
      return updatedPo;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject a purchase order
   * Returns PO to REJECTED status for requester to revise
   */
  async rejectPO(
    purchaseOrderId: string,
    rejectedByUserId: string,
    tenantId: string,
    rejectionReason: string
  ): Promise<PurchaseOrderForApproval> {
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 1. Get PO details
      const po = await this.getPurchaseOrderForUpdate(client, purchaseOrderId, tenantId);

      // 2. Validate PO is in PENDING_APPROVAL status
      if (po.status !== 'PENDING_APPROVAL') {
        throw new BadRequestException(
          `Purchase order must be in PENDING_APPROVAL status. Current status: ${po.status}`
        );
      }

      // 3. Validate user is the pending approver
      if (po.pendingApproverUserId !== rejectedByUserId) {
        throw new ForbiddenException(
          `You are not authorized to reject this purchase order at this step.`
        );
      }

      // 4. Get current step info from snapshot
      const workflowSnapshot = po.workflowSnapshot;
      const currentStep = workflowSnapshot?.steps?.find(
        (s: ApprovalWorkflowStep) => s.stepNumber === po.currentApprovalStepNumber
      );

      // 5. Create rejection history entry
      await this.createHistoryEntry(client, {
        purchaseOrderId,
        workflowId: po.currentApprovalWorkflowId,
        stepId: currentStep?.id,
        action: 'REJECTED',
        actionByUserId: rejectedByUserId,
        stepNumber: po.currentApprovalStepNumber,
        stepName: currentStep?.stepName,
        rejectionReason
      });

      // 6. Update PO to REJECTED status
      await client.query(
        `UPDATE purchase_orders
         SET status = 'REJECTED',
             current_approval_workflow_id = NULL,
             current_approval_step_number = NULL,
             pending_approver_user_id = NULL,
             workflow_snapshot = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [purchaseOrderId]
      );

      await client.query('COMMIT');

      // 7. Return updated PO
      const updatedPo = await this.getPurchaseOrder(purchaseOrderId, tenantId);
      return updatedPo;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pending approvals for a user
   * Returns all POs awaiting approval by the specified user
   */
  async getMyPendingApprovals(
    tenantId: string,
    userId: string,
    filters?: {
      amountMin?: number;
      amountMax?: number;
      urgencyLevel?: 'URGENT' | 'WARNING' | 'NORMAL';
    }
  ): Promise<any[]> {
    let query = `
      SELECT * FROM v_approval_queue
      WHERE tenant_id = $1
        AND pending_approver_user_id = $2
    `;

    const params: any[] = [tenantId, userId];
    let paramIndex = 3;

    if (filters?.amountMin !== undefined) {
      query += ` AND total_amount >= $${paramIndex}`;
      params.push(filters.amountMin);
      paramIndex++;
    }

    if (filters?.amountMax !== undefined) {
      query += ` AND total_amount <= $${paramIndex}`;
      params.push(filters.amountMax);
      paramIndex++;
    }

    if (filters?.urgencyLevel) {
      query += ` AND urgency_level = $${paramIndex}`;
      params.push(filters.urgencyLevel);
      paramIndex++;
    }

    query += ` ORDER BY urgency_level DESC, sla_deadline ASC`;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get approval history for a purchase order
   */
  async getApprovalHistory(
    purchaseOrderId: string,
    tenantId: string
  ): Promise<ApprovalHistoryEntry[]> {
    const result = await this.db.query<ApprovalHistoryEntry>(
      `SELECT
         h.*,
         u.first_name || ' ' || u.last_name AS action_by_user_name,
         u_from.first_name || ' ' || u_from.last_name AS delegated_from_user_name,
         u_to.first_name || ' ' || u_to.last_name AS delegated_to_user_name
       FROM po_approval_history h
       INNER JOIN users u ON h.action_by_user_id = u.id
       LEFT JOIN users u_from ON h.delegated_from_user_id = u_from.id
       LEFT JOIN users u_to ON h.delegated_to_user_id = u_to.id
       INNER JOIN purchase_orders po ON h.purchase_order_id = po.id
       WHERE h.purchase_order_id = $1
         AND po.tenant_id = $2
       ORDER BY h.action_date ASC`,
      [purchaseOrderId, tenantId]
    );

    return result.rows;
  }

  // ===== Private Helper Methods =====

  private async getPurchaseOrder(
    purchaseOrderId: string,
    tenantId: string
  ): Promise<PurchaseOrderForApproval> {
    const result = await this.db.query<PurchaseOrderForApproval>(
      `SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2`,
      [purchaseOrderId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Purchase order ${purchaseOrderId} not found`);
    }

    return result.rows[0];
  }

  private async getPurchaseOrderForUpdate(
    client: any,
    purchaseOrderId: string,
    tenantId: string
  ): Promise<PurchaseOrderForApproval> {
    const result = await client.query(
      `SELECT * FROM purchase_orders
       WHERE id = $1 AND tenant_id = $2
       FOR UPDATE`,  // Lock row for update
      [purchaseOrderId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Purchase order ${purchaseOrderId} not found`);
    }

    return result.rows[0];
  }

  private async resolveApprover(
    client: any,
    step: ApprovalWorkflowStep,
    tenantId: string
  ): Promise<string | null> {
    // Priority 1: Specific user
    if (step.approverUserId) {
      return step.approverUserId;
    }

    // Priority 2: User by role
    if (step.approverRole) {
      // Look for user with this role and sufficient approval authority
      const result = await client.query(
        `SELECT ua.user_id
         FROM user_approval_authority ua
         WHERE ua.tenant_id = $1
           AND ua.role_name = $2
           AND ua.effective_from_date <= CURRENT_DATE
           AND (ua.effective_to_date IS NULL OR ua.effective_to_date >= CURRENT_DATE)
         ORDER BY ua.approval_limit DESC
         LIMIT 1`,
        [tenantId, step.approverRole]
      );

      if (result.rows.length > 0) {
        return result.rows[0].user_id;
      }
    }

    // Priority 3: User group (future enhancement)
    if (step.approverUserGroupId) {
      // TODO: Implement user group resolution
      // For now, return null
    }

    return null;
  }

  private async validateApprovalAuthority(
    client: any,
    userId: string,
    amount: number,
    tenantId: string
  ): Promise<void> {
    const result = await client.query(
      `SELECT *
       FROM user_approval_authority
       WHERE tenant_id = $1
         AND user_id = $2
         AND effective_from_date <= CURRENT_DATE
         AND (effective_to_date IS NULL OR effective_to_date >= CURRENT_DATE)
         AND approval_limit >= $3
       ORDER BY approval_limit DESC
       LIMIT 1`,
      [tenantId, userId, amount]
    );

    if (result.rows.length === 0) {
      throw new ForbiddenException(
        `You do not have approval authority for purchase orders of amount ${amount}. ` +
        `Please contact your manager to request approval authority.`
      );
    }
  }

  private async createHistoryEntry(
    client: any,
    entry: {
      purchaseOrderId: string;
      workflowId?: string;
      stepId?: string;
      action: string;
      actionByUserId: string;
      stepNumber?: number;
      stepName?: string;
      comments?: string;
      rejectionReason?: string;
      delegatedFromUserId?: string;
      delegatedToUserId?: string;
      slaDeadline?: Date;
    }
  ): Promise<string> {
    const result = await client.query(
      `SELECT create_approval_history_entry(
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
       ) AS history_id`,
      [
        entry.purchaseOrderId,
        entry.workflowId || null,
        entry.stepId || null,
        entry.action,
        entry.actionByUserId,
        entry.stepNumber || null,
        entry.stepName || null,
        entry.comments || null,
        entry.rejectionReason || null,
        entry.delegatedFromUserId || null,
        entry.delegatedToUserId || null,
        entry.slaDeadline || null
      ]
    );

    return result.rows[0].history_id;
  }
}
