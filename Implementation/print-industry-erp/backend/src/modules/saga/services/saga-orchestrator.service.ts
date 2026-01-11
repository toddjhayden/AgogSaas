/**
 * Saga Orchestrator Service
 * REQ-1767541724201-s8kck - Implement End-to-End Demand-to-Cash Saga Pattern
 *
 * Manages saga execution with automatic compensation on failure
 */

import { Injectable, Logger, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  SagaDefinition,
  SagaInstance,
  SagaStepExecution,
  SagaStepConfig,
  SagaStatus,
  StepStatus,
  ExecutionType,
  StartSagaDto,
  SagaExecutionResult,
} from '../interfaces/saga.interface';

@Injectable()
export class SagaOrchestratorService {
  private readonly logger = new Logger(SagaOrchestratorService.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
  ) {}

  /**
   * Start a new saga instance
   */
  async startSaga(dto: StartSagaDto): Promise<SagaExecutionResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Load saga definition
      const definition = await this.loadSagaDefinition(client, dto.tenantId, dto.sagaName);

      if (!definition.isActive) {
        throw new BadRequestException(`Saga definition '${dto.sagaName}' is not active`);
      }

      // Calculate deadline
      const deadline = new Date();
      if (definition.timeoutSeconds) {
        deadline.setSeconds(deadline.getSeconds() + definition.timeoutSeconds);
      }

      // Create saga instance
      const instanceResult = await client.query(
        `INSERT INTO saga_instances (
          tenant_id, saga_definition_id, saga_name, saga_version,
          status, current_step_index, context_entity_type, context_entity_id,
          saga_context, deadline, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          dto.tenantId,
          definition.id,
          definition.sagaName,
          definition.version,
          SagaStatus.STARTED,
          0,
          dto.contextEntityType,
          dto.contextEntityId,
          JSON.stringify(dto.initialContext),
          definition.timeoutSeconds ? deadline : null,
          dto.userId,
        ]
      );

      const instance = this.mapSagaInstance(instanceResult.rows[0]);

      // Log saga started event
      await this.logSagaEvent(client, {
        tenantId: dto.tenantId,
        sagaInstanceId: instance.id,
        eventType: 'saga_started',
        eventData: {
          sagaName: definition.sagaName,
          version: definition.version,
          totalSteps: definition.stepsConfig.length,
        },
        createdAt: new Date(),
        createdBy: dto.userId,
      });

      await client.query('COMMIT');

      this.logger.log(`Started saga instance ${instance.id} for ${definition.sagaName}`);

      // Execute saga asynchronously
      this.executeSaga(instance.id, dto.tenantId).catch(error => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Saga ${instance.id} failed: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      });

      return {
        sagaInstanceId: instance.id,
        status: SagaStatus.STARTED,
        completedSteps: 0,
        totalSteps: definition.stepsConfig.length,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to start saga: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute saga steps sequentially
   */
  private async executeSaga(sagaInstanceId: string, tenantId: string): Promise<void> {
    const client = await this.db.connect();

    try {
      // Load saga instance
      let instance = await this.loadSagaInstance(client, sagaInstanceId, tenantId);

      // Load saga definition
      const definition = await this.loadSagaDefinitionById(client, instance.sagaDefinitionId, tenantId);

      // Update status to running
      await this.updateSagaStatus(client, sagaInstanceId, SagaStatus.RUNNING, tenantId);

      // Execute steps sequentially
      for (let i = instance.currentStepIndex; i < definition.stepsConfig.length; i++) {
        const stepConfig = definition.stepsConfig[i];

        try {
          // Execute forward action
          const stepResult = await this.executeStep(
            client,
            instance,
            stepConfig,
            i,
            ExecutionType.FORWARD,
            tenantId
          );

          // Update saga context with step output
          instance = await this.updateSagaContext(
            client,
            sagaInstanceId,
            stepConfig.stepName,
            stepResult.outputData,
            tenantId
          );

          // Move to next step
          await this.updateCurrentStep(client, sagaInstanceId, i + 1, tenantId);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(`Step ${stepConfig.stepName} failed: ${errorMessage}`, errorStack);

          // Mark saga as compensating
          await this.updateSagaStatus(
            client,
            sagaInstanceId,
            SagaStatus.COMPENSATING,
            tenantId,
            errorMessage,
            errorStack
          );

          // Execute compensation for completed steps (in reverse order)
          await this.compensateSaga(client, instance, definition, i - 1, tenantId);

          return;
        }
      }

      // All steps completed successfully
      await this.completeSaga(client, sagaInstanceId, tenantId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Saga execution failed: ${errorMessage}`, errorStack);

      await this.failSaga(client, sagaInstanceId, errorMessage, errorStack, tenantId);
    } finally {
      client.release();
    }
  }

  /**
   * Execute a single saga step
   */
  private async executeStep(
    client: PoolClient,
    instance: SagaInstance,
    stepConfig: SagaStepConfig,
    stepIndex: number,
    executionType: ExecutionType,
    tenantId: string
  ): Promise<SagaStepExecution> {
    // Create step execution record
    const stepExecution = await this.createStepExecution(
      client,
      instance.id,
      stepIndex,
      stepConfig.stepName,
      executionType,
      tenantId
    );

    try {
      // Mark step as running
      await this.updateStepStatus(client, stepExecution.id, StepStatus.RUNNING, tenantId);

      // Prepare input data from saga context
      const inputData = this.prepareStepInput(instance.sagaContext, stepConfig);

      // Execute step action based on service type
      let outputData: Record<string, any>;

      if (executionType === ExecutionType.FORWARD) {
        outputData = await this.executeForwardAction(stepConfig, inputData, instance.sagaContext);
      } else {
        outputData = await this.executeCompensationAction(stepConfig, inputData, instance.sagaContext);
      }

      // Mark step as completed
      await this.updateStepExecution(client, stepExecution.id, {
        status: executionType === ExecutionType.FORWARD ? StepStatus.COMPLETED : StepStatus.COMPENSATED,
        inputData,
        outputData,
        completedAt: new Date(),
      }, tenantId);

      // Log event
      await this.logSagaEvent(client, {
        tenantId,
        sagaInstanceId: instance.id,
        stepExecutionId: stepExecution.id,
        eventType: executionType === ExecutionType.FORWARD ? 'step_completed' : 'step_compensated',
        eventData: { stepName: stepConfig.stepName, stepIndex },
        createdAt: new Date(),
      });

      return {
        ...stepExecution,
        outputData,
        status: executionType === ExecutionType.FORWARD ? StepStatus.COMPLETED : StepStatus.COMPENSATED,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Check if retryable
      if (stepConfig.retryable && stepExecution.retryCount < (stepConfig.maxRetries || 3)) {
        this.logger.warn(`Step ${stepConfig.stepName} failed, retrying... (${stepExecution.retryCount + 1}/${stepConfig.maxRetries || 3})`);

        // Increment retry count
        await client.query(
          'UPDATE saga_step_executions SET retry_count = retry_count + 1, updated_at = NOW() WHERE id = $1',
          [stepExecution.id]
        );

        // Retry with exponential backoff
        await this.sleep((stepExecution.retryCount + 1) * 1000);

        // Recursive retry
        return await this.executeStep(client, instance, stepConfig, stepIndex, executionType, tenantId);
      }

      // Mark step as failed
      await this.updateStepExecution(client, stepExecution.id, {
        status: executionType === ExecutionType.FORWARD ? StepStatus.FAILED : StepStatus.COMPENSATION_FAILED,
        failedAt: new Date(),
        errorMessage,
        errorStack,
      }, tenantId);

      // Log failure event
      await this.logSagaEvent(client, {
        tenantId,
        sagaInstanceId: instance.id,
        stepExecutionId: stepExecution.id,
        eventType: executionType === ExecutionType.FORWARD ? 'step_failed' : 'compensation_failed',
        eventData: { stepName: stepConfig.stepName, stepIndex, errorMessage },
        createdAt: new Date(),
      });

      throw error;
    }
  }

  /**
   * Compensate saga by executing compensation actions in reverse order
   */
  private async compensateSaga(
    client: PoolClient,
    instance: SagaInstance,
    definition: SagaDefinition,
    lastCompletedStepIndex: number,
    tenantId: string
  ): Promise<void> {
    this.logger.log(`Starting compensation for saga ${instance.id} from step ${lastCompletedStepIndex}`);

    // Execute compensation in reverse order
    for (let i = lastCompletedStepIndex; i >= 0; i--) {
      const stepConfig = definition.stepsConfig[i];

      try {
        await this.executeStep(
          client,
          instance,
          stepConfig,
          i,
          ExecutionType.COMPENSATION,
          tenantId
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Compensation failed for step ${stepConfig.stepName}: ${errorMessage}`);

        // Mark saga as failed (compensation failed)
        await this.updateSagaStatus(
          client,
          instance.id,
          SagaStatus.FAILED,
          tenantId,
          `Compensation failed at step ${stepConfig.stepName}: ${errorMessage}`
        );

        return;
      }
    }

    // All compensations completed
    await this.updateSagaStatus(client, instance.id, SagaStatus.COMPENSATED, tenantId);

    await this.logSagaEvent(client, {
      tenantId,
      sagaInstanceId: instance.id,
      eventType: 'saga_compensated',
      eventData: { compensatedSteps: lastCompletedStepIndex + 1 },
      createdAt: new Date(),
    });

    this.logger.log(`Saga ${instance.id} fully compensated`);
  }

  /**
   * Execute forward action (placeholder - to be implemented by specific saga handlers)
   */
  private async executeForwardAction(
    stepConfig: SagaStepConfig,
    inputData: Record<string, any>,
    sagaContext: Record<string, any>
  ): Promise<Record<string, any>> {
    // This is a placeholder - actual implementation will call services based on serviceType
    this.logger.log(`Executing forward action: ${stepConfig.stepName}`);

    // For internal services, we would inject and call the appropriate service method
    // For external HTTP, we would make HTTP calls
    // For agents, we would publish to NATS

    // Simulate work
    await this.sleep(100);

    return {
      success: true,
      executedAt: new Date().toISOString(),
      stepName: stepConfig.stepName,
    };
  }

  /**
   * Execute compensation action (placeholder - to be implemented by specific saga handlers)
   */
  private async executeCompensationAction(
    stepConfig: SagaStepConfig,
    inputData: Record<string, any>,
    sagaContext: Record<string, any>
  ): Promise<Record<string, any>> {
    this.logger.log(`Executing compensation action: ${stepConfig.stepName}`);

    // Simulate compensation work
    await this.sleep(100);

    return {
      compensated: true,
      compensatedAt: new Date().toISOString(),
      stepName: stepConfig.stepName,
    };
  }

  /**
   * Prepare step input from saga context
   */
  private prepareStepInput(sagaContext: Record<string, any>, stepConfig: SagaStepConfig): Record<string, any> {
    // Extract relevant data from saga context for this step
    // This can be customized based on step configuration
    return { ...sagaContext };
  }

  /**
   * Complete saga successfully
   */
  private async completeSaga(client: PoolClient, sagaInstanceId: string, tenantId: string): Promise<void> {
    await client.query(
      `UPDATE saga_instances
       SET status = $1, completed_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [SagaStatus.COMPLETED, sagaInstanceId, tenantId]
    );

    await this.logSagaEvent(client, {
      tenantId,
      sagaInstanceId,
      eventType: 'saga_completed',
      eventData: {},
      createdAt: new Date(),
    });

    this.logger.log(`Saga ${sagaInstanceId} completed successfully`);
  }

  /**
   * Fail saga permanently
   */
  private async failSaga(
    client: PoolClient,
    sagaInstanceId: string,
    errorMessage: string,
    errorStack: string | undefined,
    tenantId: string
  ): Promise<void> {
    await client.query(
      `UPDATE saga_instances
       SET status = $1, failed_at = NOW(), error_message = $2, error_stack = $3, updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5`,
      [SagaStatus.FAILED, errorMessage, errorStack, sagaInstanceId, tenantId]
    );

    await this.logSagaEvent(client, {
      tenantId,
      sagaInstanceId,
      eventType: 'saga_failed',
      eventData: { errorMessage },
      createdAt: new Date(),
    });

    this.logger.error(`Saga ${sagaInstanceId} failed: ${errorMessage}`);
  }

  // ========== DATABASE OPERATIONS ==========

  private async loadSagaDefinition(
    client: PoolClient,
    tenantId: string,
    sagaName: string
  ): Promise<SagaDefinition> {
    const result = await client.query(
      `SELECT * FROM saga_definitions
       WHERE tenant_id = $1 AND saga_name = $2 AND is_active = true AND deleted_at IS NULL
       ORDER BY version DESC LIMIT 1`,
      [tenantId, sagaName]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Saga definition '${sagaName}' not found`);
    }

    return this.mapSagaDefinition(result.rows[0]);
  }

  private async loadSagaDefinitionById(
    client: PoolClient,
    definitionId: string,
    tenantId: string
  ): Promise<SagaDefinition> {
    const result = await client.query(
      'SELECT * FROM saga_definitions WHERE id = $1 AND tenant_id = $2',
      [definitionId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Saga definition not found`);
    }

    return this.mapSagaDefinition(result.rows[0]);
  }

  private async loadSagaInstance(
    client: PoolClient,
    sagaInstanceId: string,
    tenantId: string
  ): Promise<SagaInstance> {
    const result = await client.query(
      'SELECT * FROM saga_instances WHERE id = $1 AND tenant_id = $2',
      [sagaInstanceId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Saga instance not found');
    }

    return this.mapSagaInstance(result.rows[0]);
  }

  private async createStepExecution(
    client: PoolClient,
    sagaInstanceId: string,
    stepIndex: number,
    stepName: string,
    executionType: ExecutionType,
    tenantId: string
  ): Promise<SagaStepExecution> {
    const result = await client.query(
      `INSERT INTO saga_step_executions (
        tenant_id, saga_instance_id, step_index, step_name, status, execution_type
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [tenantId, sagaInstanceId, stepIndex, stepName, StepStatus.PENDING, executionType]
    );

    return this.mapStepExecution(result.rows[0]);
  }

  private async updateStepStatus(
    client: PoolClient,
    stepExecutionId: string,
    status: StepStatus,
    tenantId: string
  ): Promise<void> {
    await client.query(
      `UPDATE saga_step_executions
       SET status = $1, started_at = COALESCE(started_at, NOW()), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [status, stepExecutionId, tenantId]
    );
  }

  private async updateStepExecution(
    client: PoolClient,
    stepExecutionId: string,
    updates: Partial<SagaStepExecution>,
    tenantId: string
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.inputData !== undefined) {
      fields.push(`input_data = $${paramIndex++}`);
      values.push(JSON.stringify(updates.inputData));
    }
    if (updates.outputData !== undefined) {
      fields.push(`output_data = $${paramIndex++}`);
      values.push(JSON.stringify(updates.outputData));
    }
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }
    if (updates.failedAt !== undefined) {
      fields.push(`failed_at = $${paramIndex++}`);
      values.push(updates.failedAt);
    }
    if (updates.errorMessage !== undefined) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(updates.errorMessage);
    }
    if (updates.errorStack !== undefined) {
      fields.push(`error_stack = $${paramIndex++}`);
      values.push(updates.errorStack);
    }

    fields.push(`updated_at = NOW()`);

    values.push(stepExecutionId, tenantId);

    await client.query(
      `UPDATE saga_step_executions SET ${fields.join(', ')}
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++}`,
      values
    );
  }

  private async updateSagaStatus(
    client: PoolClient,
    sagaInstanceId: string,
    status: SagaStatus,
    tenantId: string,
    errorMessage?: string,
    errorStack?: string
  ): Promise<void> {
    await client.query(
      `UPDATE saga_instances
       SET status = $1, error_message = $2, error_stack = $3, updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5`,
      [status, errorMessage, errorStack, sagaInstanceId, tenantId]
    );
  }

  private async updateCurrentStep(
    client: PoolClient,
    sagaInstanceId: string,
    stepIndex: number,
    tenantId: string
  ): Promise<void> {
    await client.query(
      'UPDATE saga_instances SET current_step_index = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
      [stepIndex, sagaInstanceId, tenantId]
    );
  }

  private async updateSagaContext(
    client: PoolClient,
    sagaInstanceId: string,
    stepName: string,
    stepOutput: Record<string, any> | undefined,
    tenantId: string
  ): Promise<SagaInstance> {
    // Load current instance
    const instance = await this.loadSagaInstance(client, sagaInstanceId, tenantId);

    // Merge step output into saga context
    const updatedContext = {
      ...instance.sagaContext,
      [stepName]: stepOutput,
    };

    // Update saga context
    await client.query(
      'UPDATE saga_instances SET saga_context = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
      [JSON.stringify(updatedContext), sagaInstanceId, tenantId]
    );

    return {
      ...instance,
      sagaContext: updatedContext,
    };
  }

  private async logSagaEvent(client: PoolClient, event: Omit<import('../interfaces/saga.interface').SagaEventLog, 'id'>): Promise<void> {
    await client.query(
      `INSERT INTO saga_event_log (
        tenant_id, saga_instance_id, step_execution_id, event_type, event_data, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        event.tenantId,
        event.sagaInstanceId,
        event.stepExecutionId,
        event.eventType,
        event.eventData ? JSON.stringify(event.eventData) : null,
        event.createdBy,
      ]
    );
  }

  // ========== MAPPERS ==========

  private mapSagaDefinition(row: any): SagaDefinition {
    return {
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
    };
  }

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

  private mapStepExecution(row: any): SagaStepExecution {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sagaInstanceId: row.saga_instance_id,
      stepIndex: row.step_index,
      stepName: row.step_name,
      status: row.status as StepStatus,
      executionType: row.execution_type as ExecutionType,
      inputData: row.input_data,
      outputData: row.output_data,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      failedAt: row.failed_at,
      compensatedAt: row.compensated_at,
      errorMessage: row.error_message,
      errorStack: row.error_stack,
      retryCount: row.retry_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ========== UTILITIES ==========

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
