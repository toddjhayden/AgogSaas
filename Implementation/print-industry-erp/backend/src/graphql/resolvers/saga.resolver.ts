/**
 * Saga GraphQL Resolver
 * REQ-1767541724201-s8kck - Implement End-to-End Demand-to-Cash Saga Pattern
 */

import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SagaOrchestratorService } from '../../modules/saga/services/saga-orchestrator.service';
import { DemandToCashSagaService, DemandToCashInput } from '../../modules/saga/services/demand-to-cash-saga.service';
import { SagaExecutionResult, SagaInstance, SagaStatus } from '../../modules/saga/interfaces/saga.interface';

@Resolver('Saga')
@UseGuards(JwtAuthGuard)
export class SagaResolver {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly sagaOrchestrator: SagaOrchestratorService,
    private readonly demandToCashSaga: DemandToCashSagaService,
  ) {}

  // ========== QUERIES ==========

  @Query('sagaInstance')
  async getSagaInstance(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any
  ): Promise<SagaInstance | null> {
    const result = await this.db.query(
      `SELECT * FROM saga_instances WHERE id = $1 AND tenant_id = $2`,
      [id, user.tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapSagaInstance(result.rows[0]);
  }

  @Query('sagaInstances')
  async getSagaInstances(
    @Args('tenantId', { type: () => ID }) tenantId: string,
    @Args('status', { nullable: true }) status?: SagaStatus,
    @Args('sagaName', { nullable: true }) sagaName?: string,
    @Args('limit', { nullable: true, defaultValue: 50 }) limit?: number,
    @Args('offset', { nullable: true, defaultValue: 0 }) offset?: number,
    @CurrentUser() user?: any
  ): Promise<SagaInstance[]> {
    const whereClauses: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (sagaName) {
      whereClauses.push(`saga_name = $${paramIndex++}`);
      params.push(sagaName);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM saga_instances
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY started_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    return result.rows.map(row => this.mapSagaInstance(row));
  }

  @Query('sagaDefinitions')
  async getSagaDefinitions(
    @Args('tenantId', { type: () => ID }) tenantId: string,
    @CurrentUser() user: any
  ): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM saga_definitions
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY saga_name, version DESC`,
      [tenantId]
    );

    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      sagaName: row.saga_name,
      description: row.description,
      version: row.version,
      isActive: row.is_active,
      stepsConfig: row.steps_config,
      timeoutSeconds: row.timeout_seconds,
      maxRetries: row.max_retries,
      retryDelaySeconds: row.retry_delay_seconds,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  @Query('sagaEvents')
  async getSagaEvents(
    @Args('sagaInstanceId', { type: () => ID }) sagaInstanceId: string,
    @CurrentUser() user: any
  ): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM saga_event_log
       WHERE saga_instance_id = $1 AND tenant_id = $2
       ORDER BY created_at ASC`,
      [sagaInstanceId, user.tenantId]
    );

    return result.rows.map(row => ({
      id: row.id,
      sagaInstanceId: row.saga_instance_id,
      stepExecutionId: row.step_execution_id,
      eventType: row.event_type,
      eventData: row.event_data,
      createdAt: row.created_at,
      createdBy: row.created_by,
    }));
  }

  // ========== MUTATIONS ==========

  @Mutation('startDemandToCashSaga')
  async startDemandToCashSaga(
    @Args('input') input: any,
    @CurrentUser() user: any
  ): Promise<SagaExecutionResult> {
    const demandToCashInput: DemandToCashInput = {
      tenantId: input.tenantId,
      facilityId: input.facilityId,
      customerId: input.customerId,
      quoteData: {
        items: input.quoteData.items,
        validUntil: new Date(input.quoteData.validUntil),
        notes: input.quoteData.notes,
      },
      userId: user.userId,
    };

    return await this.demandToCashSaga.startDemandToCashSaga(demandToCashInput);
  }

  @Mutation('retrySaga')
  async retrySaga(
    @Args('sagaInstanceId', { type: () => ID }) sagaInstanceId: string,
    @CurrentUser() user: any
  ): Promise<SagaExecutionResult> {
    // Load the saga instance
    const instance = await this.getSagaInstance(sagaInstanceId, user);

    if (!instance) {
      throw new Error('Saga instance not found');
    }

    if (instance.status !== SagaStatus.FAILED && instance.status !== SagaStatus.COMPENSATED) {
      throw new Error('Can only retry failed or compensated sagas');
    }

    // Create a new saga instance with the same context
    return await this.sagaOrchestrator.startSaga({
      tenantId: instance.tenantId,
      sagaName: instance.sagaName,
      contextEntityType: instance.contextEntityType,
      contextEntityId: instance.contextEntityId,
      initialContext: instance.sagaContext,
      userId: user.userId,
    });
  }

  @Mutation('cancelSaga')
  async cancelSaga(
    @Args('sagaInstanceId', { type: () => ID }) sagaInstanceId: string,
    @Args('reason') reason: string,
    @CurrentUser() user: any
  ): Promise<SagaExecutionResult> {
    // Load the saga instance
    const instance = await this.getSagaInstance(sagaInstanceId, user);

    if (!instance) {
      throw new Error('Saga instance not found');
    }

    if (instance.status !== SagaStatus.RUNNING) {
      throw new Error('Can only cancel running sagas');
    }

    // Update status to compensating
    await this.db.query(
      `UPDATE saga_instances
       SET status = $1, error_message = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [SagaStatus.COMPENSATING, `Cancelled by user: ${reason}`, sagaInstanceId, user.tenantId]
    );

    // Log cancellation event
    await this.db.query(
      `INSERT INTO saga_event_log (tenant_id, saga_instance_id, event_type, event_data, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.tenantId,
        sagaInstanceId,
        'saga_cancelled',
        JSON.stringify({ reason, cancelledBy: user.userId }),
        user.userId,
      ]
    );

    // Trigger compensation (this would need to be implemented in the orchestrator)
    // For now, return the current status

    return {
      sagaInstanceId,
      status: SagaStatus.COMPENSATING,
      completedSteps: instance.currentStepIndex,
      totalSteps: 0, // Would need to load definition to get this
      errorMessage: `Cancelled by user: ${reason}`,
    };
  }

  // ========== FIELD RESOLVERS ==========

  async steps(sagaInstance: SagaInstance): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM saga_step_executions
       WHERE saga_instance_id = $1
       ORDER BY step_index, created_at`,
      [sagaInstance.id]
    );

    return result.rows.map(row => ({
      id: row.id,
      sagaInstanceId: row.saga_instance_id,
      stepIndex: row.step_index,
      stepName: row.step_name,
      status: row.status,
      executionType: row.execution_type,
      inputData: row.input_data,
      outputData: row.output_data,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      failedAt: row.failed_at,
      compensatedAt: row.compensated_at,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async events(sagaInstance: SagaInstance): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM saga_event_log
       WHERE saga_instance_id = $1
       ORDER BY created_at`,
      [sagaInstance.id]
    );

    return result.rows.map(row => ({
      id: row.id,
      sagaInstanceId: row.saga_instance_id,
      stepExecutionId: row.step_execution_id,
      eventType: row.event_type,
      eventData: row.event_data,
      createdAt: row.created_at,
      createdBy: row.created_by,
    }));
  }

  // ========== MAPPERS ==========

  private mapSagaInstance(row: any): SagaInstance {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sagaDefinitionId: row.saga_definition_id,
      sagaName: row.saga_name,
      sagaVersion: row.saga_version,
      status: row.status as SagaStatus,
      currentStepIndex: row.current_step_index,
      contextEntityType: row.context_entity_type,
      contextEntityId: row.context_entity_id,
      sagaContext: row.saga_context || {},
      startedAt: row.started_at,
      completedAt: row.completed_at,
      failedAt: row.failed_at,
      compensatedAt: row.compensated_at,
      errorMessage: row.error_message,
      errorStack: row.error_stack,
      deadline: row.deadline,
      retryCount: row.retry_count,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
    };
  }
}
