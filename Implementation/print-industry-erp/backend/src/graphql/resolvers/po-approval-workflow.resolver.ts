/**
 * Purchase Order Approval Workflow GraphQL Resolver
 * REQ: REQ-STRATEGIC-AUTO-1766676891764
 *
 * This resolver exposes the PO approval workflow functionality via GraphQL API.
 * It handles all approval-related queries and mutations including:
 * - Approval queue queries
 * - Approval actions (approve, reject, delegate)
 * - Workflow configuration
 * - Approval authority management
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { ApprovalWorkflowService } from '../../modules/procurement/services/approval-workflow.service';

@Injectable()
@Resolver('PurchaseOrder')
export class POApprovalWorkflowResolver {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly approvalWorkflowService: ApprovalWorkflowService
  ) {}

  // =====================================================
  // QUERIES
  // =====================================================

  /**
   * Get all pending approvals for a user
   * Powers the "My Approvals" dashboard
   */
  @Query('getMyPendingApprovals')
  async getMyPendingApprovals(
    @Args('tenantId') tenantId: string,
    @Args('userId') userId: string,
    @Args('amountMin') amountMin?: number,
    @Args('amountMax') amountMax?: number,
    @Args('urgencyLevel') urgencyLevel?: string,
    @Context() context?: any
  ) {
    const filters: any = {};
    if (amountMin !== undefined) filters.amountMin = amountMin;
    if (amountMax !== undefined) filters.amountMax = amountMax;
    if (urgencyLevel) filters.urgencyLevel = urgencyLevel;

    const approvals = await this.approvalWorkflowService.getMyPendingApprovals(
      tenantId,
      userId,
      filters
    );

    return approvals.map(this.mapPendingApprovalItem);
  }

  /**
   * Get approval history for a purchase order
   */
  @Query('getPOApprovalHistory')
  async getPOApprovalHistory(
    @Args('purchaseOrderId') purchaseOrderId: string,
    @Args('tenantId') tenantId: string,
    @Context() context?: any
  ) {
    const history = await this.approvalWorkflowService.getApprovalHistory(
      purchaseOrderId,
      tenantId
    );

    return history.map(this.mapApprovalHistoryEntry);
  }

  /**
   * Get all approval workflows for tenant
   */
  @Query('getApprovalWorkflows')
  async getApprovalWorkflows(
    @Args('tenantId') tenantId: string,
    @Args('isActive') isActive?: boolean,
    @Context() context?: any
  ) {
    let query = `
      SELECT * FROM po_approval_workflows
      WHERE tenant_id = $1
    `;

    const params: any[] = [tenantId];

    if (isActive !== undefined) {
      query += ' AND is_active = $2';
      params.push(isActive);
    }

    query += ' ORDER BY priority DESC, workflow_name';

    const result = await this.db.query(query, params);

    // Load steps for each workflow
    const workflows = await Promise.all(
      result.rows.map(async (wf) => {
        const stepsResult = await this.db.query(
          `SELECT * FROM po_approval_workflow_steps
           WHERE workflow_id = $1
           ORDER BY step_number`,
          [wf.id]
        );

        return {
          ...this.mapApprovalWorkflow(wf),
          steps: stepsResult.rows.map(this.mapApprovalWorkflowStep)
        };
      })
    );

    return workflows;
  }

  /**
   * Get specific approval workflow
   */
  @Query('getApprovalWorkflow')
  async getApprovalWorkflow(
    @Args('id') id: string,
    @Args('tenantId') tenantId: string,
    @Context() context?: any
  ) {
    const workflowResult = await this.db.query(
      `SELECT * FROM po_approval_workflows WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (workflowResult.rows.length === 0) {
      return null;
    }

    const stepsResult = await this.db.query(
      `SELECT * FROM po_approval_workflow_steps
       WHERE workflow_id = $1
       ORDER BY step_number`,
      [id]
    );

    return {
      ...this.mapApprovalWorkflow(workflowResult.rows[0]),
      steps: stepsResult.rows.map(this.mapApprovalWorkflowStep)
    };
  }

  /**
   * Get applicable workflow for a PO
   */
  @Query('getApplicableWorkflow')
  async getApplicableWorkflow(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string,
    @Args('amount') amount: number,
    @Context() context?: any
  ) {
    const result = await this.db.query(
      `SELECT * FROM po_approval_workflows
       WHERE id = get_applicable_workflow($1, $2, $3)`,
      [tenantId, facilityId, amount]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const workflowId = result.rows[0].id;

    const stepsResult = await this.db.query(
      `SELECT * FROM po_approval_workflow_steps
       WHERE workflow_id = $1
       ORDER BY step_number`,
      [workflowId]
    );

    return {
      ...this.mapApprovalWorkflow(result.rows[0]),
      steps: stepsResult.rows.map(this.mapApprovalWorkflowStep)
    };
  }

  /**
   * Get user's approval authority
   */
  @Query('getUserApprovalAuthority')
  async getUserApprovalAuthority(
    @Args('tenantId') tenantId: string,
    @Args('userId') userId: string,
    @Context() context?: any
  ) {
    const result = await this.db.query(
      `SELECT * FROM user_approval_authority
       WHERE tenant_id = $1
         AND user_id = $2
         AND effective_from_date <= CURRENT_DATE
         AND (effective_to_date IS NULL OR effective_to_date >= CURRENT_DATE)
       ORDER BY approval_limit DESC`,
      [tenantId, userId]
    );

    return result.rows.map(this.mapUserApprovalAuthority);
  }

  // =====================================================
  // MUTATIONS
  // =====================================================

  /**
   * Submit PO for approval
   */
  @Mutation('submitPOForApproval')
  async submitPOForApproval(
    @Args('purchaseOrderId') purchaseOrderId: string,
    @Args('submittedByUserId') submittedByUserId: string,
    @Args('tenantId') tenantId: string,
    @Context() context?: any
  ) {
    const po = await this.approvalWorkflowService.submitForApproval(
      purchaseOrderId,
      submittedByUserId,
      tenantId
    );

    // Return full PO with lines
    return this.loadFullPurchaseOrder(po.id, tenantId);
  }

  /**
   * Approve PO workflow step
   */
  @Mutation('approvePOWorkflowStep')
  async approvePOWorkflowStep(
    @Args('purchaseOrderId') purchaseOrderId: string,
    @Args('approvedByUserId') approvedByUserId: string,
    @Args('tenantId') tenantId: string,
    @Args('comments') comments?: string,
    @Context() context?: any
  ) {
    const po = await this.approvalWorkflowService.approvePO(
      purchaseOrderId,
      approvedByUserId,
      tenantId,
      comments
    );

    // Return full PO with lines
    return this.loadFullPurchaseOrder(po.id, tenantId);
  }

  /**
   * Reject PO
   */
  @Mutation('rejectPO')
  async rejectPO(
    @Args('purchaseOrderId') purchaseOrderId: string,
    @Args('rejectedByUserId') rejectedByUserId: string,
    @Args('tenantId') tenantId: string,
    @Args('rejectionReason') rejectionReason: string,
    @Context() context?: any
  ) {
    const po = await this.approvalWorkflowService.rejectPO(
      purchaseOrderId,
      rejectedByUserId,
      tenantId,
      rejectionReason
    );

    // Return full PO with lines
    return this.loadFullPurchaseOrder(po.id, tenantId);
  }

  /**
   * Upsert approval workflow
   */
  @Mutation('upsertApprovalWorkflow')
  async upsertApprovalWorkflow(
    @Args('id') id: string | undefined,
    @Args('tenantId') tenantId: string,
    @Args('workflowName') workflowName: string,
    @Args('description') description: string | undefined,
    @Args('minAmount') minAmount: number | undefined,
    @Args('maxAmount') maxAmount: number | undefined,
    @Args('approvalType') approvalType: string,
    @Args('slaHoursPerStep') slaHoursPerStep: number | undefined,
    @Args('escalationEnabled') escalationEnabled: boolean | undefined,
    @Args('escalationUserId') escalationUserId: string | undefined,
    @Args('autoApproveUnderAmount') autoApproveUnderAmount: number | undefined,
    @Args('steps') steps: any[],
    @Context() context?: any
  ) {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      let workflowId: string;

      if (id) {
        // Update existing workflow
        await client.query(
          `UPDATE po_approval_workflows
           SET workflow_name = $1,
               description = $2,
               min_amount = $3,
               max_amount = $4,
               approval_type = $5,
               sla_hours_per_step = $6,
               escalation_enabled = $7,
               escalation_user_id = $8,
               auto_approve_under_amount = $9,
               updated_at = NOW()
           WHERE id = $10 AND tenant_id = $11`,
          [
            workflowName,
            description,
            minAmount,
            maxAmount,
            approvalType,
            slaHoursPerStep || 24,
            escalationEnabled || false,
            escalationUserId,
            autoApproveUnderAmount,
            id,
            tenantId
          ]
        );

        // Delete existing steps
        await client.query(
          `DELETE FROM po_approval_workflow_steps WHERE workflow_id = $1`,
          [id]
        );

        workflowId = id;
      } else {
        // Create new workflow
        const result = await client.query(
          `INSERT INTO po_approval_workflows (
             tenant_id, workflow_name, description, min_amount, max_amount,
             approval_type, sla_hours_per_step, escalation_enabled,
             escalation_user_id, auto_approve_under_amount
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            tenantId,
            workflowName,
            description,
            minAmount,
            maxAmount,
            approvalType,
            slaHoursPerStep || 24,
            escalationEnabled || false,
            escalationUserId,
            autoApproveUnderAmount
          ]
        );

        workflowId = result.rows[0].id;
      }

      // Insert steps
      for (const step of steps) {
        await client.query(
          `INSERT INTO po_approval_workflow_steps (
             workflow_id, step_number, step_name, approver_role,
             approver_user_id, approver_user_group_id, is_required,
             can_delegate, can_skip, min_approval_limit
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            workflowId,
            step.stepNumber,
            step.stepName,
            step.approverRole,
            step.approverUserId,
            step.approverUserGroupId,
            step.isRequired !== false,
            step.canDelegate !== false,
            step.canSkip || false,
            step.minApprovalLimit
          ]
        );
      }

      await client.query('COMMIT');

      // Return created/updated workflow
      return this.getApprovalWorkflow(workflowId, tenantId, context);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete approval workflow
   */
  @Mutation('deleteApprovalWorkflow')
  async deleteApprovalWorkflow(
    @Args('id') id: string,
    @Args('tenantId') tenantId: string,
    @Context() context?: any
  ): Promise<boolean> {
    // Soft delete by marking as inactive
    const result = await this.db.query(
      `UPDATE po_approval_workflows
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    return result.rowCount > 0;
  }

  /**
   * Grant approval authority to user
   */
  @Mutation('grantApprovalAuthority')
  async grantApprovalAuthority(
    @Args('tenantId') tenantId: string,
    @Args('userId') userId: string,
    @Args('approvalLimit') approvalLimit: number,
    @Args('currencyCode') currencyCode: string | undefined,
    @Args('roleName') roleName: string | undefined,
    @Args('effectiveFromDate') effectiveFromDate: string | undefined,
    @Args('effectiveToDate') effectiveToDate: string | undefined,
    @Args('canDelegate') canDelegate: boolean | undefined,
    @Args('grantedByUserId') grantedByUserId: string,
    @Context() context?: any
  ) {
    const result = await this.db.query(
      `INSERT INTO user_approval_authority (
         tenant_id, user_id, approval_limit, currency_code, role_name,
         effective_from_date, effective_to_date, can_delegate, granted_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        userId,
        approvalLimit,
        currencyCode || 'USD',
        roleName,
        effectiveFromDate || new Date().toISOString().split('T')[0],
        effectiveToDate,
        canDelegate !== false,
        grantedByUserId
      ]
    );

    return this.mapUserApprovalAuthority(result.rows[0]);
  }

  /**
   * Revoke approval authority
   */
  @Mutation('revokeApprovalAuthority')
  async revokeApprovalAuthority(
    @Args('id') id: string,
    @Args('tenantId') tenantId: string,
    @Context() context?: any
  ): Promise<boolean> {
    // Set effective_to_date to today to expire the authority
    const result = await this.db.query(
      `UPDATE user_approval_authority
       SET effective_to_date = CURRENT_DATE, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    return result.rowCount > 0;
  }

  // =====================================================
  // FIELD RESOLVERS (for extended PurchaseOrder type)
  // =====================================================

  /**
   * Resolve approvalHistory field on PurchaseOrder
   */
  async approvalHistory(parent: any, args: any, context: any) {
    if (!parent.id || !parent.tenantId) return [];

    const history = await this.approvalWorkflowService.getApprovalHistory(
      parent.id,
      parent.tenantId
    );

    return history.map(this.mapApprovalHistoryEntry);
  }

  /**
   * Resolve approvalProgress field on PurchaseOrder
   */
  async approvalProgress(parent: any, args: any, context: any) {
    if (!parent.workflowSnapshot || !parent.currentApprovalStepNumber) {
      return null;
    }

    const snapshot = parent.workflowSnapshot;
    const workflow = snapshot.workflow;
    const steps = snapshot.steps;

    const totalSteps = steps.length;
    const currentStep = parent.currentApprovalStepNumber;
    const percentComplete = Math.round((currentStep / totalSteps) * 100);

    // Get next approver info
    let nextApproverUserId = parent.pendingApproverUserId;
    let nextApproverName = null;

    if (nextApproverUserId) {
      const userResult = await this.db.query(
        `SELECT first_name || ' ' || last_name AS full_name FROM users WHERE id = $1`,
        [nextApproverUserId]
      );

      if (userResult.rows.length > 0) {
        nextApproverName = userResult.rows[0].full_name;
      }
    }

    // Calculate SLA
    const slaHours = workflow.slaHoursPerStep || 24;
    const slaDeadline = new Date(parent.approvalStartedAt);
    slaDeadline.setHours(slaDeadline.getHours() + slaHours);

    const hoursRemaining = (slaDeadline.getTime() - Date.now()) / (1000 * 60 * 60);
    const isOverdue = hoursRemaining < 0;

    return {
      currentStep,
      totalSteps,
      percentComplete,
      nextApproverUserId,
      nextApproverName,
      slaDeadline,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      isOverdue
    };
  }

  /**
   * Resolve isAwaitingMyApproval field on PurchaseOrder
   */
  async isAwaitingMyApproval(parent: any, args: { userId: string }, context: any) {
    return parent.pendingApproverUserId === args.userId &&
           parent.status === 'PENDING_APPROVAL';
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private async loadFullPurchaseOrder(id: string, tenantId: string) {
    const poResult = await this.db.query(
      `SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (poResult.rows.length === 0) {
      return null;
    }

    const po = this.mapPurchaseOrderRow(poResult.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM purchase_order_lines WHERE purchase_order_id = $1 ORDER BY line_number`,
      [id]
    );

    po.lines = linesResult.rows.map(this.mapPurchaseOrderLineRow);

    return po;
  }

  // Mapping functions
  private mapPurchaseOrderRow = (row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    facilityId: row.facility_id,
    poNumber: row.po_number,
    purchaseOrderDate: row.po_date,
    vendorId: row.vendor_id,
    shipToFacilityId: row.ship_to_facility_id,
    shipToAddress: row.ship_to_address,
    billingEntityId: row.billing_entity_id,
    buyerUserId: row.buyer_user_id,
    poCurrencyCode: row.po_currency_code,
    exchangeRate: row.exchange_rate,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    shippingAmount: row.shipping_amount,
    totalAmount: row.total_amount,
    paymentTerms: row.payment_terms,
    requestedDeliveryDate: row.requested_delivery_date,
    promisedDeliveryDate: row.promised_delivery_date,
    status: row.status,
    requiresApproval: row.requires_approval,
    approvedByUserId: row.approved_by_user_id,
    approvedAt: row.approved_at,
    currentApprovalWorkflowId: row.current_approval_workflow_id,
    currentApprovalStepNumber: row.current_approval_step_number,
    approvalStartedAt: row.approval_started_at,
    approvalCompletedAt: row.approval_completed_at,
    pendingApproverUserId: row.pending_approver_user_id,
    workflowSnapshot: row.workflow_snapshot,
    journalEntryId: row.journal_entry_id,
    notes: row.notes,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    lines: []
  });

  private mapPurchaseOrderLineRow = (row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    purchaseOrderId: row.purchase_order_id,
    lineNumber: row.line_number,
    materialId: row.material_id,
    materialCode: row.material_code,
    description: row.description,
    quantityOrdered: row.quantity_ordered,
    quantityReceived: row.quantity_received,
    quantityRemaining: row.quantity_remaining,
    unitOfMeasure: row.unit_of_measure,
    unitPrice: row.unit_price,
    lineAmount: row.line_amount,
    requestedDeliveryDate: row.requested_delivery_date,
    promisedDeliveryDate: row.promised_delivery_date,
    expenseAccountId: row.expense_account_id,
    allowOverReceipt: row.allow_over_receipt,
    overReceiptTolerancePercentage: row.over_receipt_tolerance_percentage,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  private mapPendingApprovalItem = (row: any) => ({
    purchaseOrderId: row.purchase_order_id,
    tenantId: row.tenant_id,
    poNumber: row.po_number,
    poDate: row.po_date,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    totalAmount: row.total_amount,
    poCurrencyCode: row.po_currency_code,
    status: row.status,
    requestedDeliveryDate: row.requested_delivery_date,
    currentApprovalWorkflowId: row.current_approval_workflow_id,
    currentApprovalStepNumber: row.current_approval_step_number,
    currentStepName: row.current_step_name,
    approvalStartedAt: row.approval_started_at,
    pendingApproverUserId: row.pending_approver_user_id,
    slaHoursPerStep: row.sla_hours_per_step,
    slaDeadline: row.sla_deadline,
    hoursRemaining: row.hours_remaining,
    isOverdue: row.is_overdue,
    urgencyLevel: row.urgency_level,
    requesterUserId: row.requester_user_id,
    requesterName: row.requester_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  private mapApprovalHistoryEntry = (row: any) => ({
    id: row.id,
    purchaseOrderId: row.purchase_order_id,
    workflowId: row.workflow_id,
    stepId: row.step_id,
    action: row.action,
    actionByUserId: row.action_by_user_id,
    actionByUserName: row.action_by_user_name,
    actionDate: row.action_date,
    stepNumber: row.step_number,
    stepName: row.step_name,
    comments: row.comments,
    rejectionReason: row.rejection_reason,
    delegatedFromUserId: row.delegated_from_user_id,
    delegatedFromUserName: row.delegated_from_user_name,
    delegatedToUserId: row.delegated_to_user_id,
    delegatedToUserName: row.delegated_to_user_name,
    slaDeadline: row.sla_deadline,
    wasEscalated: row.was_escalated,
    poSnapshot: row.po_snapshot,
    createdAt: row.created_at
  });

  private mapApprovalWorkflow = (row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    workflowName: row.workflow_name,
    description: row.description,
    appliesToFacilityIds: row.applies_to_facility_ids,
    minAmount: row.min_amount,
    maxAmount: row.max_amount,
    approvalType: row.approval_type,
    isActive: row.is_active,
    priority: row.priority,
    slaHoursPerStep: row.sla_hours_per_step,
    escalationEnabled: row.escalation_enabled,
    escalationUserId: row.escalation_user_id,
    autoApproveUnderAmount: row.auto_approve_under_amount,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by
  });

  private mapApprovalWorkflowStep = (row: any) => ({
    id: row.id,
    workflowId: row.workflow_id,
    stepNumber: row.step_number,
    stepName: row.step_name,
    approverRole: row.approver_role,
    approverUserId: row.approver_user_id,
    approverUserGroupId: row.approver_user_group_id,
    isRequired: row.is_required,
    canDelegate: row.can_delegate,
    canSkip: row.can_skip,
    minApprovalLimit: row.min_approval_limit,
    createdAt: row.created_at
  });

  private mapUserApprovalAuthority = (row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    approvalLimit: row.approval_limit,
    currencyCode: row.currency_code,
    roleName: row.role_name,
    effectiveFromDate: row.effective_from_date,
    effectiveToDate: row.effective_to_date,
    canDelegate: row.can_delegate,
    grantedByUserId: row.granted_by_user_id,
    grantedAt: row.granted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}
