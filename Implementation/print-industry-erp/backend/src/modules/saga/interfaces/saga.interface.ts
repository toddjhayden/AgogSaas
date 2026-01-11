/**
 * Saga Pattern Interfaces
 * REQ-1767541724201-s8kck - Implement End-to-End Demand-to-Cash Saga Pattern
 */

export interface SagaStepConfig {
  stepName: string;
  description?: string;
  serviceType: 'internal' | 'external_http' | 'agent';
  serviceName?: string; // For internal services
  serviceUrl?: string; // For external HTTP services
  agentName?: string; // For agent services
  forwardAction: string; // Method name or HTTP endpoint
  compensationAction: string; // Rollback method or endpoint
  timeout?: number; // Timeout in seconds
  retryable: boolean;
  maxRetries?: number;
  idempotencyKey?: string; // Template for idempotency key
}

export interface SagaDefinition {
  id?: string;
  tenantId: string;
  sagaName: string;
  description?: string;
  version: number;
  isActive: boolean;
  stepsConfig: SagaStepConfig[];
  timeoutSeconds?: number;
  maxRetries?: number;
  retryDelaySeconds?: number;
}

export interface SagaInstance {
  id: string;
  tenantId: string;
  sagaDefinitionId: string;
  sagaName: string;
  sagaVersion: number;
  status: SagaStatus;
  currentStepIndex: number;
  contextEntityType?: string;
  contextEntityId?: string;
  sagaContext: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  compensatedAt?: Date;
  errorMessage?: string;
  errorStack?: string;
  deadline?: Date;
  retryCount: number;
  createdBy?: string;
  updatedAt: Date;
}

export enum SagaStatus {
  STARTED = 'started',
  RUNNING = 'running',
  COMPENSATING = 'compensating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATED = 'compensated',
}

export enum StepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated',
  COMPENSATION_FAILED = 'compensation_failed',
}

export enum ExecutionType {
  FORWARD = 'forward',
  COMPENSATION = 'compensation',
}

export interface SagaStepExecution {
  id: string;
  tenantId: string;
  sagaInstanceId: string;
  stepIndex: number;
  stepName: string;
  status: StepStatus;
  executionType: ExecutionType;
  inputData?: Record<string, any>;
  outputData?: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  compensatedAt?: Date;
  errorMessage?: string;
  errorStack?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SagaEventLog {
  id?: string;
  tenantId: string;
  sagaInstanceId: string;
  stepExecutionId?: string;
  eventType: string;
  eventData?: Record<string, any>;
  createdAt: Date;
  createdBy?: string;
}

export interface StartSagaDto {
  tenantId: string;
  sagaName: string;
  contextEntityType?: string;
  contextEntityId?: string;
  initialContext: Record<string, any>;
  userId?: string;
}

export interface SagaExecutionResult {
  sagaInstanceId: string;
  status: SagaStatus;
  completedSteps: number;
  totalSteps: number;
  errorMessage?: string;
}
