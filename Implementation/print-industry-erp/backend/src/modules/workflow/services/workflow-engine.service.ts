import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

interface WorkflowNode {
  id: string;
  node_type: 'approval' | 'service_task' | 'user_task' | 'gateway' | 'sub_workflow';
  name: string;
  approver_user_id?: string;
  approver_role?: string;
  approval_logic?: 'SEQUENTIAL' | 'PARALLEL' | 'ANY_ONE';
  service_type?: 'agent_spawn' | 'http_call' | 'database_query' | 'email_send';
  service_config?: any;
  form_fields?: any[];
  assigned_user_id?: string;
  assigned_role?: string;
  condition_type?: 'amount_based' | 'field_value' | 'expression';
  condition_expression?: string;
  sla_hours?: number;
  timeout_action?: 'escalate' | 'auto_approve' | 'fail';
}

interface WorkflowRoute {
  from_node_id: string;
  to_node_id: string;
  condition?: string;
  is_default?: boolean;
}

interface WorkflowDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  version: number;
  is_active: boolean;
  trigger_config: any;
  nodes: WorkflowNode[];
  routes: WorkflowRoute[];
  sla_hours?: number;
  escalation_enabled: boolean;
  escalation_user_id?: string;
}

interface WorkflowInstance {
  id: string;
  tenant_id: string;
  workflow_definition_id: string;
  workflow_name: string;
  workflow_version: number;
  context_entity_type?: string;
  context_entity_id?: string;
  context_data: any;
  status: string;
  current_node_id?: string;
  started_at: Date;
  completed_at?: Date;
  sla_deadline?: Date;
  created_by?: string;
}

interface WorkflowInstanceNode {
  id: string;
  tenant_id: string;
  instance_id: string;
  node_id: string;
  node_name?: string;
  node_type?: string;
  status: string;
  assigned_user_id?: string;
  started_at?: Date;
  completed_at?: Date;
  sla_deadline?: Date;
  action?: string;
  action_by_user_id?: string;
  action_date?: Date;
  comments?: string;
  output_data?: any;
}

@Injectable()
export class WorkflowEngineService {
  constructor(private readonly pool: Pool) {}

  /**
   * Start a new workflow instance
   */
  async startWorkflow(
    workflowDefinitionId: string,
    contextEntityType: string,
    contextEntityId: string,
    contextData: any,
    triggeredByUserId: string,
    tenantId: string
  ): Promise<WorkflowInstance> {
    // 1. Load workflow definition
    const definition = await this.getWorkflowDefinition(workflowDefinitionId, tenantId);

    if (!definition.is_active) {
      throw new BadRequestException('Workflow definition is not active');
    }

    // 2. Calculate SLA deadline
    const slaDeadline = new Date();
    if (definition.sla_hours) {
      slaDeadline.setHours(slaDeadline.getHours() + definition.sla_hours);
    }

    // 3. Create workflow instance
    const result = await this.pool.query(
      `INSERT INTO workflow_instances (
        tenant_id, workflow_definition_id, workflow_name, workflow_version,
        context_entity_type, context_entity_id, context_data,
        status, sla_deadline, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        tenantId,
        definition.id,
        definition.name,
        definition.version,
        contextEntityType,
        contextEntityId,
        JSON.stringify(contextData),
        'running',
        definition.sla_hours ? slaDeadline : null,
        triggeredByUserId
      ]
    );

    const instance = result.rows[0];

    // 4. Create history entry
    await this.createHistoryEntry(instance.id, tenantId, {
      event_type: 'started',
      event_by_user_id: triggeredByUserId,
      event_data: { definition_id: definition.id, definition_version: definition.version }
    });

    // 5. Find entry node (first node with no incoming routes)
    const entryNode = this.findEntryNode(definition);

    if (!entryNode) {
      throw new BadRequestException('Workflow definition has no entry node');
    }

    // 6. Execute entry node
    await this.executeNode(instance.id, entryNode, contextData, tenantId);

    return instance;
  }

  /**
   * Get workflow definition
   */
  private async getWorkflowDefinition(id: string, tenantId: string): Promise<WorkflowDefinition> {
    const result = await this.pool.query(
      'SELECT * FROM workflow_definitions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Workflow definition not found');
    }

    return result.rows[0];
  }

  /**
   * Find entry node (node with no incoming routes)
   */
  private findEntryNode(definition: WorkflowDefinition): WorkflowNode | null {
    const nodesWithIncoming = new Set(definition.routes.map(r => r.to_node_id));
    const entryNode = definition.nodes.find(n => !nodesWithIncoming.has(n.id));
    return entryNode || null;
  }

  /**
   * Execute a workflow node
   */
  private async executeNode(
    instanceId: string,
    node: WorkflowNode,
    contextData: any,
    tenantId: string
  ): Promise<void> {
    // Create node execution record
    const nodeExecution = await this.createNodeExecution(instanceId, node, tenantId);

    try {
      switch (node.node_type) {
        case 'approval':
          await this.executeApprovalNode(nodeExecution, node, contextData, tenantId);
          break;

        case 'service_task':
          await this.executeServiceTask(nodeExecution, node, contextData, tenantId);
          break;

        case 'user_task':
          await this.executeUserTask(nodeExecution, node, contextData, tenantId);
          break;

        case 'gateway':
          await this.executeGateway(nodeExecution, node, contextData, tenantId);
          break;

        case 'sub_workflow':
          await this.executeSubWorkflow(nodeExecution, node, contextData, tenantId);
          break;

        default:
          throw new BadRequestException(`Unknown node type: ${node.node_type}`);
      }
    } catch (error) {
      // Mark node as failed
      await this.updateNodeExecution(nodeExecution.id, {
        status: 'failed',
        action: 'failed',
        completed_at: new Date(),
        comments: error.message
      }, tenantId);

      // Fail workflow
      await this.failWorkflow(instanceId, error.message, tenantId);
      throw error;
    }
  }

  /**
   * Create node execution record
   */
  private async createNodeExecution(
    instanceId: string,
    node: WorkflowNode,
    tenantId: string
  ): Promise<WorkflowInstanceNode> {
    const result = await this.pool.query(
      `INSERT INTO workflow_instance_nodes (
        tenant_id, instance_id, node_id, node_name, node_type, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [tenantId, instanceId, node.id, node.name, node.node_type, 'pending']
    );

    return result.rows[0];
  }

  /**
   * Execute approval node (wait for user approval)
   */
  private async executeApprovalNode(
    nodeExecution: WorkflowInstanceNode,
    node: WorkflowNode,
    contextData: any,
    tenantId: string
  ): Promise<void> {
    // Resolve approver (by user_id or role)
    const approverId = await this.resolveApprover(node, contextData, tenantId);

    // Set SLA deadline
    const slaDeadline = new Date();
    if (node.sla_hours) {
      slaDeadline.setHours(slaDeadline.getHours() + node.sla_hours);
    }

    // Update node to in_progress state with approver assigned
    await this.updateNodeExecution(nodeExecution.id, {
      status: 'in_progress',
      assigned_user_id: approverId,
      started_at: new Date(),
      sla_deadline: node.sla_hours ? slaDeadline : null
    }, tenantId);

    // Create history entry
    await this.createHistoryEntry(nodeExecution.instance_id, tenantId, {
      event_type: 'node_entered',
      node_id: node.id,
      event_by_user_id: approverId,
      event_data: { node_type: 'approval', approver: approverId, node_name: node.name }
    });

    // Node stays in_progress until approveNode() is called via GraphQL mutation
  }

  /**
   * Resolve approver user ID from node configuration
   */
  private async resolveApprover(node: WorkflowNode, contextData: any, tenantId: string): Promise<string> {
    if (node.approver_user_id) {
      return node.approver_user_id;
    }

    if (node.approver_role) {
      // Find user with role (simplified - would query users table in production)
      // For now, return the first user with that role
      const result = await this.pool.query(
        `SELECT id FROM users WHERE tenant_id = $1 AND role = $2 LIMIT 1`,
        [tenantId, node.approver_role]
      );

      if (result.rows.length === 0) {
        throw new NotFoundException(`No user found with role: ${node.approver_role}`);
      }

      return result.rows[0].id;
    }

    throw new BadRequestException('Approval node must specify approver_user_id or approver_role');
  }

  /**
   * Execute service task (automated task)
   */
  private async executeServiceTask(
    nodeExecution: WorkflowInstanceNode,
    node: WorkflowNode,
    contextData: any,
    tenantId: string
  ): Promise<void> {
    await this.updateNodeExecution(nodeExecution.id, {
      status: 'in_progress',
      started_at: new Date()
    }, tenantId);

    let result;

    try {
      switch (node.service_type) {
        case 'database_query':
          result = await this.executeDatabaseQuery(node.service_config, contextData, tenantId);
          break;

        case 'email_send':
          result = await this.sendEmail(node.service_config, contextData);
          break;

        // agent_spawn and http_call would be implemented here
        // For now, stub them
        case 'agent_spawn':
        case 'http_call':
          result = { success: true, message: 'Service task completed (stub)' };
          break;

        default:
          throw new BadRequestException(`Unknown service type: ${node.service_type}`);
      }

      // Mark node as completed
      await this.updateNodeExecution(nodeExecution.id, {
        status: 'completed',
        action: 'completed',
        completed_at: new Date(),
        output_data: result
      }, tenantId);

      // Create history entry
      await this.createHistoryEntry(nodeExecution.instance_id, tenantId, {
        event_type: 'node_completed',
        node_id: node.id,
        event_data: { node_type: 'service_task', result }
      });

      // Execute next node
      await this.executeNextNode(nodeExecution.instance_id, node.id, contextData, tenantId);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute database query service task
   */
  private async executeDatabaseQuery(config: any, contextData: any, tenantId: string): Promise<any> {
    // Stub implementation - would execute configured query
    return { success: true, action: config.action };
  }

  /**
   * Send email service task
   */
  private async sendEmail(config: any, contextData: any): Promise<any> {
    // Stub implementation - would send email via email service
    return { success: true, template: config.template };
  }

  /**
   * Execute user task (form-based task)
   */
  private async executeUserTask(
    nodeExecution: WorkflowInstanceNode,
    node: WorkflowNode,
    contextData: any,
    tenantId: string
  ): Promise<void> {
    // Similar to approval node, but for data collection
    const assigneeId = node.assigned_user_id || await this.resolveApprover(node, contextData, tenantId);

    const slaDeadline = new Date();
    if (node.sla_hours) {
      slaDeadline.setHours(slaDeadline.getHours() + node.sla_hours);
    }

    await this.updateNodeExecution(nodeExecution.id, {
      status: 'in_progress',
      assigned_user_id: assigneeId,
      started_at: new Date(),
      sla_deadline: node.sla_hours ? slaDeadline : null
    }, tenantId);

    await this.createHistoryEntry(nodeExecution.instance_id, tenantId, {
      event_type: 'node_entered',
      node_id: node.id,
      event_by_user_id: assigneeId,
      event_data: { node_type: 'user_task', assignee: assigneeId }
    });
  }

  /**
   * Execute gateway (conditional branching)
   */
  private async executeGateway(
    nodeExecution: WorkflowInstanceNode,
    node: WorkflowNode,
    contextData: any,
    tenantId: string
  ): Promise<void> {
    // Evaluate condition
    const conditionResult = await this.evaluateCondition(node.condition_expression, contextData);

    // Get workflow definition to find routes
    const instance = await this.getInstance(nodeExecution.instance_id, tenantId);
    const definition = await this.getWorkflowDefinition(instance.workflow_definition_id, tenantId);

    // Find next node based on condition
    const outgoingRoutes = definition.routes.filter(r => r.from_node_id === node.id);

    let nextRoute: WorkflowRoute | undefined;
    if (conditionResult) {
      nextRoute = outgoingRoutes.find(r => r.condition === 'true' || r.is_default);
    } else {
      nextRoute = outgoingRoutes.find(r => r.condition === 'false');
    }

    if (!nextRoute) {
      throw new BadRequestException(`No route found for gateway ${node.id} condition result: ${conditionResult}`);
    }

    // Mark gateway as completed
    await this.updateNodeExecution(nodeExecution.id, {
      status: 'completed',
      action: 'completed',
      completed_at: new Date(),
      output_data: { condition_result: conditionResult, next_node: nextRoute.to_node_id }
    }, tenantId);

    // Execute next node
    const nextNode = definition.nodes.find(n => n.id === nextRoute.to_node_id);
    if (nextNode) {
      await this.executeNode(instance.id, nextNode, contextData, tenantId);
    }
  }

  /**
   * Execute sub-workflow
   */
  private async executeSubWorkflow(
    nodeExecution: WorkflowInstanceNode,
    node: WorkflowNode,
    contextData: any,
    tenantId: string
  ): Promise<void> {
    // Stub - would spawn child workflow instance
    await this.updateNodeExecution(nodeExecution.id, {
      status: 'completed',
      action: 'completed',
      completed_at: new Date()
    }, tenantId);

    await this.executeNextNode(nodeExecution.instance_id, node.id, contextData, tenantId);
  }

  /**
   * Evaluate condition expression
   */
  private async evaluateCondition(expression: string | undefined, contextData: any): Promise<boolean> {
    if (!expression) {
      return true;
    }

    // Simple evaluation - in production would use safe expression evaluator
    try {
      // Very basic amount-based evaluation
      if (expression.includes('context.amount >')) {
        const threshold = parseInt(expression.split('>')[1].trim());
        return contextData.amount > threshold;
      }
      return true;
    } catch (error) {
      console.error('Condition evaluation error:', error);
      return false;
    }
  }

  /**
   * Execute next node in workflow
   */
  private async executeNextNode(
    instanceId: string,
    currentNodeId: string,
    contextData: any,
    tenantId: string
  ): Promise<void> {
    const instance = await this.getInstance(instanceId, tenantId);
    const definition = await this.getWorkflowDefinition(instance.workflow_definition_id, tenantId);

    // Find next node
    const route = definition.routes.find(r => r.from_node_id === currentNodeId);

    if (!route) {
      // No more nodes - workflow complete
      await this.completeWorkflow(instanceId, tenantId);
      return;
    }

    const nextNode = definition.nodes.find(n => n.id === route.to_node_id);
    if (nextNode) {
      await this.executeNode(instanceId, nextNode, contextData, tenantId);
    } else {
      await this.completeWorkflow(instanceId, tenantId);
    }
  }

  /**
   * Approve a workflow node (called by GraphQL mutation)
   */
  async approveNode(
    nodeExecutionId: string,
    approvedByUserId: string,
    comments: string | undefined,
    tenantId: string
  ): Promise<WorkflowInstance> {
    const nodeExecution = await this.getNodeExecution(nodeExecutionId, tenantId);

    // Validate approver
    if (nodeExecution.assigned_user_id !== approvedByUserId) {
      throw new ForbiddenException('You are not authorized to approve this task');
    }

    if (nodeExecution.status !== 'in_progress') {
      throw new BadRequestException('Task is not in progress');
    }

    // Mark node as completed
    await this.updateNodeExecution(nodeExecutionId, {
      status: 'completed',
      action: 'approved',
      action_by_user_id: approvedByUserId,
      action_date: new Date(),
      completed_at: new Date(),
      comments
    }, tenantId);

    // Create history entry
    await this.createHistoryEntry(nodeExecution.instance_id, tenantId, {
      event_type: 'approved',
      node_id: nodeExecution.node_id,
      event_by_user_id: approvedByUserId,
      event_data: { action: 'approved', comments }
    });

    // Get instance and execute next node
    const instance = await this.getInstance(nodeExecution.instance_id, tenantId);
    await this.executeNextNode(nodeExecution.instance_id, nodeExecution.node_id, instance.context_data, tenantId);

    return this.getInstance(nodeExecution.instance_id, tenantId);
  }

  /**
   * Reject a workflow node
   */
  async rejectNode(
    nodeExecutionId: string,
    rejectedByUserId: string,
    reason: string,
    tenantId: string
  ): Promise<WorkflowInstance> {
    const nodeExecution = await this.getNodeExecution(nodeExecutionId, tenantId);

    // Validate rejecter
    if (nodeExecution.assigned_user_id !== rejectedByUserId) {
      throw new ForbiddenException('You are not authorized to reject this task');
    }

    // Mark node as completed with rejected action
    await this.updateNodeExecution(nodeExecutionId, {
      status: 'completed',
      action: 'rejected',
      action_by_user_id: rejectedByUserId,
      action_date: new Date(),
      completed_at: new Date(),
      comments: reason
    }, tenantId);

    // Create history entry
    await this.createHistoryEntry(nodeExecution.instance_id, tenantId, {
      event_type: 'rejected',
      node_id: nodeExecution.node_id,
      event_by_user_id: rejectedByUserId,
      event_data: { action: 'rejected', reason }
    });

    // Fail the workflow
    await this.failWorkflow(nodeExecution.instance_id, `Rejected: ${reason}`, tenantId);

    return this.getInstance(nodeExecution.instance_id, tenantId);
  }

  /**
   * Get workflow instance
   */
  async getInstance(id: string, tenantId: string): Promise<WorkflowInstance> {
    const result = await this.pool.query(
      'SELECT * FROM workflow_instances WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Workflow instance not found');
    }

    return result.rows[0];
  }

  /**
   * Get node execution
   */
  private async getNodeExecution(id: string, tenantId: string): Promise<WorkflowInstanceNode> {
    const result = await this.pool.query(
      'SELECT * FROM workflow_instance_nodes WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Node execution not found');
    }

    return result.rows[0];
  }

  /**
   * Update node execution
   */
  private async updateNodeExecution(id: string, updates: Partial<WorkflowInstanceNode>, tenantId: string): Promise<void> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');

    await this.pool.query(
      `UPDATE workflow_instance_nodes SET ${setClause} WHERE id = $${fields.length + 1} AND tenant_id = $${fields.length + 2}`,
      [...values, id, tenantId]
    );
  }

  /**
   * Complete workflow
   */
  private async completeWorkflow(instanceId: string, tenantId: string): Promise<void> {
    await this.pool.query(
      `UPDATE workflow_instances SET status = $1, completed_at = $2 WHERE id = $3 AND tenant_id = $4`,
      ['completed', new Date(), instanceId, tenantId]
    );

    await this.createHistoryEntry(instanceId, tenantId, {
      event_type: 'completed',
      event_data: { status: 'completed' }
    });
  }

  /**
   * Fail workflow
   */
  private async failWorkflow(instanceId: string, reason: string, tenantId: string): Promise<void> {
    await this.pool.query(
      `UPDATE workflow_instances SET status = $1, completed_at = $2 WHERE id = $3 AND tenant_id = $4`,
      ['failed', new Date(), instanceId, tenantId]
    );

    await this.createHistoryEntry(instanceId, tenantId, {
      event_type: 'failed',
      event_data: { reason }
    });
  }

  /**
   * Create history entry
   */
  private async createHistoryEntry(
    instanceId: string,
    tenantId: string,
    entry: {
      event_type: string;
      node_id?: string;
      event_by_user_id?: string;
      event_data?: any;
    }
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO workflow_instance_history (
        tenant_id, instance_id, node_id, event_type, event_by_user_id, event_data
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tenantId,
        instanceId,
        entry.node_id || null,
        entry.event_type,
        entry.event_by_user_id || null,
        entry.event_data ? JSON.stringify(entry.event_data) : null
      ]
    );
  }

  /**
   * Get user's pending tasks
   */
  async getUserPendingTasks(userId: string, tenantId: string, urgencyLevel?: string): Promise<any[]> {
    let query = `
      SELECT * FROM v_user_task_queue
      WHERE assigned_user_id = $1 AND tenant_id = $2
    `;
    const params: any[] = [userId, tenantId];

    if (urgencyLevel) {
      query += ` AND urgency_level = $3`;
      params.push(urgencyLevel);
    }

    query += ` ORDER BY sla_deadline ASC`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Get workflow instance history
   */
  async getWorkflowHistory(instanceId: string, tenantId: string): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT * FROM workflow_instance_history
       WHERE instance_id = $1 AND tenant_id = $2
       ORDER BY event_date DESC`,
      [instanceId, tenantId]
    );

    return result.rows;
  }
}
