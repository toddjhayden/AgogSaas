/**
 * Webhook DTOs
 * REQ-1767925582664-n6du5
 */

// =====================================================
// WEBHOOK SUBSCRIPTION DTOs
// =====================================================

export interface CreateWebhookSubscriptionDto {
  tenantId: string;
  name: string;
  description?: string;
  endpointUrl: string;
  eventTypes: string[];
  eventFilters?: Record<string, any>;
  maxRetryAttempts?: number;
  retryBackoffMultiplier?: number;
  initialRetryDelaySeconds?: number;
  maxRetryDelaySeconds?: number;
  maxEventsPerMinute?: number;
  maxEventsPerHour?: number;
  maxEventsPerDay?: number;
  timeoutSeconds?: number;
  customHeaders?: Record<string, string>;
  createdBy: string;
}

export interface UpdateWebhookSubscriptionDto {
  name?: string;
  description?: string;
  endpointUrl?: string;
  eventTypes?: string[];
  eventFilters?: Record<string, any>;
  isActive?: boolean;
  maxRetryAttempts?: number;
  retryBackoffMultiplier?: number;
  initialRetryDelaySeconds?: number;
  maxRetryDelaySeconds?: number;
  maxEventsPerMinute?: number;
  maxEventsPerHour?: number;
  maxEventsPerDay?: number;
  timeoutSeconds?: number;
  customHeaders?: Record<string, string>;
  updatedBy: string;
}

export interface WebhookSubscriptionDto {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  endpointUrl: string;
  isActive: boolean;
  eventTypes: string[];
  eventFilters?: Record<string, any>;
  secretKey: string;
  signatureHeader: string;
  signatureAlgorithm: string;
  maxRetryAttempts: number;
  retryBackoffMultiplier: number;
  initialRetryDelaySeconds: number;
  maxRetryDelaySeconds: number;
  maxEventsPerMinute?: number;
  maxEventsPerHour?: number;
  maxEventsPerDay?: number;
  timeoutSeconds: number;
  customHeaders?: Record<string, string>;
  totalEventsSent: number;
  totalEventsFailed: number;
  lastSuccessfulDeliveryAt?: Date;
  lastFailedDeliveryAt?: Date;
  consecutiveFailures: number;
  healthStatus: HealthStatus;
  healthCheckedAt?: Date;
  autoDisabledAt?: Date;
  autoDisabledReason?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  FAILING = 'FAILING',
  SUSPENDED = 'SUSPENDED',
}

// =====================================================
// WEBHOOK EVENT DTOs
// =====================================================

export interface PublishWebhookEventDto {
  tenantId: string;
  eventType: string;
  eventData: Record<string, any>;
  eventMetadata?: Record<string, any>;
  sourceEntityType?: string;
  sourceEntityId?: string;
}

export interface WebhookEventDto {
  id: string;
  tenantId: string;
  eventType: string;
  eventVersion: string;
  eventTimestamp: Date;
  eventData: Record<string, any>;
  eventMetadata?: Record<string, any>;
  sourceEntityType?: string;
  sourceEntityId?: string;
  totalSubscriptionsMatched: number;
  totalDeliveriesSucceeded: number;
  totalDeliveriesFailed: number;
  totalDeliveriesPending: number;
  createdAt: Date;
}

// =====================================================
// WEBHOOK DELIVERY DTOs
// =====================================================

export interface WebhookDeliveryDto {
  id: string;
  tenantId: string;
  subscriptionId: string;
  eventId: string;
  attemptNumber: number;
  deliveryStatus: DeliveryStatus;
  requestUrl: string;
  requestHeaders?: Record<string, string>;
  requestBody: Record<string, any>;
  requestSignature?: string;
  responseStatusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseTimeMs?: number;
  errorMessage?: string;
  errorCode?: string;
  errorDetails?: Record<string, any>;
  nextRetryAt?: Date;
  retryCount: number;
  sentAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  ABANDONED = 'ABANDONED',
}

// =====================================================
// WEBHOOK EVENT TYPE DTOs
// =====================================================

export interface WebhookEventTypeDto {
  eventType: string;
  category: string;
  displayName: string;
  description: string;
  currentVersion: string;
  deprecated: boolean;
  deprecatedAt?: Date;
  replacementEventType?: string;
  payloadSchema?: Record<string, any>;
  examplePayload?: Record<string, any>;
  isEnabled: boolean;
  totalEventsPublished: number;
  lastPublishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================
// WEBHOOK DELIVERY LOG DTOs
// =====================================================

export interface WebhookDeliveryLogDto {
  id: string;
  tenantId: string;
  deliveryId: string;
  logLevel: LogLevel;
  logMessage: string;
  logData?: Record<string, any>;
  createdAt: Date;
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// =====================================================
// QUERY DTOs
// =====================================================

export interface ListWebhookSubscriptionsDto {
  tenantId: string;
  isActive?: boolean;
  healthStatus?: HealthStatus;
  eventType?: string;
  limit?: number;
  offset?: number;
}

export interface ListWebhookEventsDto {
  tenantId: string;
  eventType?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ListWebhookDeliveriesDto {
  tenantId: string;
  subscriptionId?: string;
  eventId?: string;
  deliveryStatus?: DeliveryStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// =====================================================
// RESPONSE DTOs
// =====================================================

export interface TestWebhookResponseDto {
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

export interface WebhookStatsDto {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalEventsSent: number;
  totalEventsSucceeded: number;
  totalEventsFailed: number;
  averageResponseTimeMs: number;
  healthySubscriptions: number;
  degradedSubscriptions: number;
  failingSubscriptions: number;
  suspendedSubscriptions: number;
}
