import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { WorkflowEngineService } from '../../modules/workflow/services/workflow-engine.service';

/**
 * Workflow Automation Engine GraphQL Resolver
 * REQ: REQ-STRATEGIC-AUTO-1767108044309
 *
 * Handles workflow automation operations:
 * - Workflow Definitions (templates)
 * - Workflow Instances (executions)
 * - User Tasks (approvals, user tasks)
 * - Workflow History (audit trail)
 * - Workflow Analytics (performance metrics)
 */

@Resolver('Workflow')
export class WorkflowResolver {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly workflowEngineService: WorkflowEngineService,
  ) {}

  // =====================================================
  // WORKFLOW DEFINITION QUERIES
  // =====================================================

  @Query('workflowDefinitions')
  async getWorkflowDefinitions(
    @Args('tenantId') tenantId: string,
    @Args('isActive') isActive: boolean | undefined,
    @Args('category') category: string | undefined,
    @Context() context: any
  ) {
    let query = `SELECT * FROM workflow_definitions WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(isActive);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapWorkflowDefinitionRow(row));
  }

  @Query('workflowDefinition')
  async getWorkflowDefinition(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM workflow_definitions WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Workflow definition ${id} not found`);
    }

    return this.mapWorkflowDefinitionRow(result.rows[0]);
  }

  // =====================================================
  // WORKFLOW INSTANCE QUERIES
  // =====================================================

  @Query('workflowInstances')
  async getWorkflowInstances(
    @Args('status') status: string | undefined,
    @Args('entityType') entityType: string | undefined,
    @Args('limit') limit: number | undefined,
    @Context() context: any
  ) {
    const tenantId = context.user?.tenant_id;
    if (!tenantId) {
      throw new Error('Tenant ID not found in context');
    }

    let query = `SELECT * FROM workflow_instances WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (entityType) {
      query += ` AND context_entity_type = $${paramIndex}`;
      params.push(entityType);
      paramIndex++;
    }

    query += ` ORDER BY started_at DESC`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapWorkflowInstanceRow(row));
  }

  @Query('workflowInstance')
  async getWorkflowInstance(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.user?.tenant_id;
    if (!tenantId) {
      throw new Error('Tenant ID not found in context');
    }

    const instance = await this.workflowEngineService.getInstance(id, tenantId);
    return this.mapWorkflowInstanceRow(instance);
  }

  @Query('workflowInstanceHistory')
  async getWorkflowInstanceHistory(@Args('instanceId') instanceId: string, @Context() context: any) {
    const tenantId = context.user?.tenant_id;
    if (!tenantId) {
      throw new Error('Tenant ID not found in context');
    }

    const history = await this.workflowEngineService.getWorkflowHistory(instanceId, tenantId);
    return history.map(entry => this.mapHistoryEntryRow(entry));
  }

  // =====================================================
  // USER TASK QUERIES
  // =====================================================

  @Query('myPendingTasks')
  async getMyPendingTasks(
    @Args('urgencyLevel') urgencyLevel: string | undefined,
    @Args('limit') limit: number | undefined,
    @Context() context: any
  ) {
    const userId = context.user?.id;
    const tenantId = context.user?.tenant_id;

    if (!userId || !tenantId) {
      throw new Error('User ID or Tenant ID not found in context');
    }

    const tasks = await this.workflowEngineService.getUserPendingTasks(userId, tenantId, urgencyLevel);

    if (limit) {
      return tasks.slice(0, limit);
    }

    return tasks;
  }

  // =====================================================
  // WORKFLOW ANALYTICS QUERIES
  // =====================================================

  @Query('workflowAnalytics')
  async getWorkflowAnalytics(
    @Args('workflowDefinitionId') workflowDefinitionId: string | undefined,
    @Args('category') category: string | undefined,
    @Context() context: any
  ) {
    const tenantId = context.user?.tenant_id;
    if (!tenantId) {
      throw new Error('Tenant ID not found in context');
    }

    let query = `SELECT * FROM v_workflow_analytics WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (workflowDefinitionId) {
      query += ` AND workflow_definition_id = $${paramIndex}`;
      params.push(workflowDefinitionId);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
    }

    const result = await this.db.query(query, params);
    return result.rows;
  }

  // =====================================================
  // WORKFLOW DEFINITION MUTATIONS
  // =====================================================

  @Mutation('createWorkflowDefinition')
  async createWorkflowDefinition(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const tenantId = context.user?.tenant_id;
    const userId = context.user?.id;

    if (!tenantId || !userId) {
      throw new Error('Tenant ID or User ID not found in context');
    }

    const result = await this.db.query(
      `INSERT INTO workflow_definitions (
        tenant_id, name, description, category, trigger_config,
        nodes, routes, sla_hours, escalation_enabled, escalation_user_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        tenantId,
        input.name,
        input.description || null,
        input.category || null,
        JSON.stringify(input.triggerConfig),
        JSON.stringify(input.nodes),
        JSON.stringify(input.routes),
        input.slaHours || null,
        input.escalationEnabled || false,
        input.escalationUserId || null,
        userId
      ]
    );

    return this.mapWorkflowDefinitionRow(result.rows[0]);
  }

  @Mutation('updateWorkflowDefinition')
  async updateWorkflowDefinition(
    @Args('id') id: string,
    @Args('input') input: any,
    @Context() context: any
  ) {
    const tenantId = context.user?.tenant_id;
    if (!tenantId) {
      throw new Error('Tenant ID not found in context');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(input.name);
      paramIndex++;
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(input.description);
      paramIndex++;
    }

    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      values.push(input.category);
      paramIndex++;
    }

    if (input.triggerConfig !== undefined) {
      updates.push(`trigger_config = $${paramIndex}`);
      values.push(JSON.stringify(input.triggerConfig));
      paramIndex++;
    }

    if (input.nodes !== undefined) {
      updates.push(`nodes = $${paramIndex}`);
      values.push(JSON.stringify(input.nodes));
      paramIndex++;
    }

    if (input.routes !== undefined) {
      updates.push(`routes = $${paramIndex}`);
      values.push(JSON.stringify(input.routes));
      paramIndex++;
    }

    if (input.slaHours !== undefined) {
      updates.push(`sla_hours = $${paramIndex}`);
      values.push(input.slaHours);
      paramIndex++;
    }

    if (input.escalationEnabled !== undefined) {
      updates.push(`escalation_enabled = $${paramIndex}`);
      values.push(input.escalationEnabled);
      paramIndex++;
    }

    if (input.escalationUserId !== undefined) {
      updates.push(`escalation_user_id = $${paramIndex}`);
      values.push(input.escalationUserId);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id, tenantId);

    const result = await this.db.query(
      `UPDATE workflow_definitions SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Workflow definition ${id} not found`);
    }

    return this.mapWorkflowDefinitionRow(result.rows[0]);
  }

  @Mutation('publishWorkflowDefinition')
  async publishWorkflowDefinition(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.user?.tenant_id;
    if (!tenantId) {
      throw new Error('Tenant ID not found in context');
    }

    const result = await this.db.query(
      `UPDATE workflow_definitions SET is_active = true
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Workflow definition ${id} not found`);
    }

    return this.mapWorkflowDefinitionRow(result.rows[0]);
  }

  @Mutation('archiveWorkflowDefinition')
  async archiveWorkflowDefinition(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.user?.tenant_id;
    if (!tenantId) {
      throw new Error('Tenant ID not found in context');
    }

    const result = await this.db.query(
      `UPDATE workflow_definitions SET is_active = false
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Workflow definition ${id} not found`);
    }

    return this.mapWorkflowDefinitionRow(result.rows[0]);
  }

  // =====================================================
  // WORKFLOW EXECUTION MUTATIONS
  // =====================================================

  @Mutation('startWorkflow')
  async startWorkflow(@Args('input') input: any, @Context() context: any) {
    const tenantId = context.user?.tenant_id;
    const userId = context.user?.id;

    if (!tenantId || !userId) {
      throw new Error('Tenant ID or User ID not found in context');
    }

    const instance = await this.workflowEngineService.startWorkflow(
      input.workflowDefinitionId,
      input.contextEntityType,
      input.contextEntityId,
      input.contextData || {},
      userId,
      tenantId
    );

    return this.mapWorkflowInstanceRow(instance);
  }

  // =====================================================
  // USER TASK MUTATIONS
  // =====================================================

  @Mutation('approveTask')
  async approveTask(
    @Args('taskId') taskId: string,
    @Args('comments') comments: string | undefined,
    @Context() context: any
  ) {
    const tenantId = context.user?.tenant_id;
    const userId = context.user?.id;

    if (!tenantId || !userId) {
      throw new Error('Tenant ID or User ID not found in context');
    }

    const instance = await this.workflowEngineService.approveNode(
      taskId,
      userId,
      comments,
      tenantId
    );

    return this.mapWorkflowInstanceRow(instance);
  }

  @Mutation('rejectTask')
  async rejectTask(
    @Args('taskId') taskId: string,
    @Args('reason') reason: string,
    @Context() context: any
  ) {
    const tenantId = context.user?.tenant_id;
    const userId = context.user?.id;

    if (!tenantId || !userId) {
      throw new Error('Tenant ID or User ID not found in context');
    }

    const instance = await this.workflowEngineService.rejectNode(
      taskId,
      userId,
      reason,
      tenantId
    );

    return this.mapWorkflowInstanceRow(instance);
  }

  @Mutation('delegateTask')
  async delegateTask(
    @Args('taskId') taskId: string,
    @Args('delegateToUserId') delegateToUserId: string,
    @Context() context: any
  ) {
    const tenantId = context.user?.tenant_id;
    if (!tenantId) {
      throw new Error('Tenant ID not found in context');
    }

    // Update assigned user
    await this.db.query(
      `UPDATE workflow_instance_nodes
       SET assigned_user_id = $1
       WHERE id = $2 AND tenant_id = $3`,
      [delegateToUserId, taskId, tenantId]
    );

    // Get updated instance
    const nodeResult = await this.db.query(
      `SELECT instance_id FROM workflow_instance_nodes WHERE id = $1 AND tenant_id = $2`,
      [taskId, tenantId]
    );

    if (nodeResult.rows.length === 0) {
      throw new Error('Task not found');
    }

    const instance = await this.workflowEngineService.getInstance(
      nodeResult.rows[0].instance_id,
      tenantId
    );

    return this.mapWorkflowInstanceRow(instance);
  }

  @Mutation('completeUserTask')
  async completeUserTask(
    @Args('taskId') taskId: string,
    @Args('formData') formData: any,
    @Context() context: any
  ) {
    const tenantId = context.user?.tenant_id;
    const userId = context.user?.id;

    if (!tenantId || !userId) {
      throw new Error('Tenant ID or User ID not found in context');
    }

    // Mark task as completed with form data
    await this.db.query(
      `UPDATE workflow_instance_nodes
       SET status = 'completed',
           action = 'completed',
           action_by_user_id = $1,
           action_date = NOW(),
           completed_at = NOW(),
           output_data = $2
       WHERE id = $3 AND tenant_id = $4 AND assigned_user_id = $1`,
      [userId, JSON.stringify(formData), taskId, tenantId]
    );

    // Get instance and execute next node
    const nodeResult = await this.db.query(
      `SELECT instance_id, node_id FROM workflow_instance_nodes WHERE id = $1 AND tenant_id = $2`,
      [taskId, tenantId]
    );

    if (nodeResult.rows.length === 0) {
      throw new Error('Task not found');
    }

    const instance = await this.workflowEngineService.getInstance(
      nodeResult.rows[0].instance_id,
      tenantId
    );

    return this.mapWorkflowInstanceRow(instance);
  }

  @Mutation('cancelWorkflow')
  async cancelWorkflow(@Args('instanceId') instanceId: string, @Context() context: any) {
    const tenantId = context.user?.tenant_id;
    if (!tenantId) {
      throw new Error('Tenant ID not found in context');
    }

    const result = await this.db.query(
      `UPDATE workflow_instances
       SET status = 'cancelled', completed_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [instanceId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Workflow instance not found');
    }

    return this.mapWorkflowInstanceRow(result.rows[0]);
  }

  // =====================================================
  // HELPER METHODS - ROW MAPPING
  // =====================================================

  private mapWorkflowDefinitionRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      version: row.version,
      isActive: row.is_active,
      category: row.category,
      triggerConfig: row.trigger_config,
      nodes: row.nodes || [],
      routes: row.routes || [],
      slaHours: row.sla_hours,
      escalationEnabled: row.escalation_enabled,
      escalationUserId: row.escalation_user_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapWorkflowInstanceRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      workflowDefinitionId: row.workflow_definition_id,
      workflowName: row.workflow_name,
      workflowVersion: row.workflow_version,
      contextEntityType: row.context_entity_type,
      contextEntityId: row.context_entity_id,
      contextData: row.context_data,
      status: row.status,
      currentNodeId: row.current_node_id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      slaDeadline: row.sla_deadline,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapHistoryEntryRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      instanceId: row.instance_id,
      nodeId: row.node_id,
      eventType: row.event_type,
      eventByUserId: row.event_by_user_id,
      eventDate: row.event_date,
      eventData: row.event_data,
      instanceSnapshot: row.instance_snapshot,
      createdAt: row.created_at
    };
  }
}
