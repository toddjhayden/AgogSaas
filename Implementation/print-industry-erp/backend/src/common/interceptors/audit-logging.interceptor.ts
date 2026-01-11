/**
 * Audit Logging Interceptor
 * REQ-1767924916114-xhhll - Comprehensive Audit Logging
 *
 * Global interceptor that automatically logs all GraphQL mutations to the
 * security_audit_events table for comprehensive audit trail.
 *
 * FEATURES:
 * - Automatic logging of all mutations (CREATE, UPDATE, DELETE operations)
 * - Risk level assessment based on operation type
 * - Correlation ID propagation for related events
 * - Tenant and user context extraction
 * - Performance tracking (operation duration)
 *
 * SECURITY:
 * - Logs all mutations for audit compliance (SOC2, GDPR, ISO27001, HIPAA)
 * - Captures IP address, user agent, session context
 * - Anomaly score calculation for suspicious operations
 *
 * PERFORMANCE:
 * - Async logging (non-blocking)
 * - Error handling prevents audit failures from blocking operations
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLoggingInterceptor.name);

  constructor(
    @Inject('DATABASE_POOL')
    private readonly pool: Pool,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const request = gqlContext.getContext().req;

    // Only log mutations (not queries)
    const isMutation = info.parentType.name === 'Mutation';
    if (!isMutation) {
      return next.handle();
    }

    const operationName = info.fieldName;
    const tenantId = request.tenantId;
    const userId = request.user?.userId;
    const username = request.user?.username;
    const ipAddress = request.ip || request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];
    const sessionId = request.session?.id || request.sessionID;
    const correlationId = request.headers['x-correlation-id'] || this.generateUUID();

    const startTime = Date.now();

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;

        // Async logging - don't block the response
        this.logAuditEvent({
          tenantId,
          operationName,
          userId,
          username,
          ipAddress,
          userAgent,
          sessionId,
          correlationId,
          success: true,
          duration,
          result,
          request,
        }).catch((error) => {
          // Log error but don't fail the request
          this.logger.error(`Failed to log audit event: ${error.message}`, {
            operationName,
            tenantId,
            userId,
            error: error.message,
          });
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Log failed operations
        this.logAuditEvent({
          tenantId,
          operationName,
          userId,
          username,
          ipAddress,
          userAgent,
          sessionId,
          correlationId,
          success: false,
          duration,
          failureReason: error.message,
          request,
        }).catch((auditError) => {
          this.logger.error(`Failed to log failed audit event: ${auditError.message}`, {
            operationName,
            tenantId,
            userId,
            error: auditError.message,
          });
        });

        // Re-throw original error
        throw error;
      }),
    );
  }

  /**
   * Log audit event to database
   */
  private async logAuditEvent(data: {
    tenantId?: number;
    operationName: string;
    userId?: number;
    username?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    correlationId: string;
    success: boolean;
    duration: number;
    failureReason?: string;
    result?: any;
    request: any;
  }): Promise<void> {
    // Skip logging if tenant context missing (likely system operation)
    if (!data.tenantId) {
      return;
    }

    const eventType = this.determineEventType(data.operationName);
    const riskLevel = this.determineRiskLevel(data.operationName, data.success);
    const targetResource = this.extractTargetResource(data.operationName, data.request);
    const targetType = this.extractTargetType(data.operationName);
    const anomalyScore = this.calculateAnomalyScore({
      operationName: data.operationName,
      success: data.success,
      duration: data.duration,
      riskLevel,
    });

    const query = `
      INSERT INTO security_audit_events (
        tenant_id,
        event_type,
        event_timestamp,
        correlation_id,
        user_id,
        username,
        ip_address,
        user_agent,
        session_id,
        target_resource,
        target_type,
        risk_level,
        success,
        failure_reason,
        metadata,
        anomaly_score,
        flagged_suspicious
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `;

    const metadata = {
      operation: data.operationName,
      duration_ms: data.duration,
      result_type: data.result ? typeof data.result : null,
    };

    const flaggedSuspicious = anomalyScore > 70;

    try {
      await this.pool.query(query, [
        data.tenantId,
        eventType,
        data.correlationId,
        data.userId || null,
        data.username || null,
        data.ipAddress || null,
        data.userAgent || null,
        data.sessionId || null,
        targetResource,
        targetType,
        riskLevel,
        data.success,
        data.failureReason || null,
        JSON.stringify(metadata),
        anomalyScore,
        flaggedSuspicious,
      ]);

      this.logger.debug(`Logged audit event: ${eventType} for operation ${data.operationName}`, {
        tenantId: data.tenantId,
        userId: data.userId,
        success: data.success,
        riskLevel,
        flaggedSuspicious,
      });
    } catch (error) {
      // Log error but don't throw to avoid blocking the operation
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to insert audit event: ${errorMessage}`, {
        operationName: data.operationName,
        tenantId: data.tenantId,
        error: errorMessage,
      });
    }
  }

  /**
   * Determine security event type from GraphQL operation name
   */
  private determineEventType(operationName: string): string {
    const lowerOp = operationName.toLowerCase();

    // Map GraphQL operations to security event types
    if (lowerOp.includes('create') || lowerOp.includes('add')) {
      return 'DATA_CREATION';
    } else if (lowerOp.includes('update') || lowerOp.includes('edit') || lowerOp.includes('modify')) {
      return 'DATA_MODIFICATION';
    } else if (lowerOp.includes('delete') || lowerOp.includes('remove')) {
      return 'DATA_DELETION';
    } else if (lowerOp.includes('export')) {
      return 'DATA_EXPORT';
    } else if (lowerOp.includes('permission') || lowerOp.includes('role') || lowerOp.includes('access')) {
      return 'PERMISSION_CHANGE';
    } else if (lowerOp.includes('config') || lowerOp.includes('setting')) {
      return 'CONFIG_CHANGE';
    } else if (lowerOp.includes('approve') || lowerOp.includes('reject')) {
      return 'APPROVAL_ACTION';
    } else {
      return 'OTHER_MUTATION';
    }
  }

  /**
   * Determine risk level based on operation type
   */
  private determineRiskLevel(operationName: string, success: boolean): string {
    const lowerOp = operationName.toLowerCase();

    // Failed operations are higher risk
    if (!success) {
      return 'HIGH';
    }

    // Critical operations
    if (
      lowerOp.includes('delete') ||
      lowerOp.includes('permission') ||
      lowerOp.includes('role') ||
      lowerOp.includes('credential') ||
      lowerOp.includes('secret')
    ) {
      return 'CRITICAL';
    }

    // High risk operations
    if (
      lowerOp.includes('config') ||
      lowerOp.includes('export') ||
      lowerOp.includes('approve') ||
      lowerOp.includes('void') ||
      lowerOp.includes('close')
    ) {
      return 'HIGH';
    }

    // Medium risk operations
    if (lowerOp.includes('update') || lowerOp.includes('modify')) {
      return 'MEDIUM';
    }

    // Low risk operations (create, add)
    return 'LOW';
  }

  /**
   * Extract target resource from operation name and request args
   */
  private extractTargetResource(operationName: string, request: any): string {
    // Try to extract ID from args
    const args = request.body?.variables || {};
    const id = args.id || args.input?.id;

    if (id) {
      return `${operationName}:${id}`;
    }

    return operationName;
  }

  /**
   * Extract target type from operation name
   */
  private extractTargetType(operationName: string): string {
    const lowerOp = operationName.toLowerCase();

    // Extract entity type from operation name
    // e.g., "createPurchaseOrder" -> "purchase_order"
    const matches = [
      'invoice',
      'payment',
      'order',
      'customer',
      'vendor',
      'user',
      'product',
      'incident',
      'pattern',
      'approval',
      'config',
    ];

    for (const match of matches) {
      if (lowerOp.includes(match)) {
        return match.toUpperCase();
      }
    }

    return 'UNKNOWN';
  }

  /**
   * Calculate anomaly score based on operation characteristics
   */
  private calculateAnomalyScore(data: {
    operationName: string;
    success: boolean;
    duration: number;
    riskLevel: string;
  }): number {
    let score = 0;

    // Risk level contributes to score
    const riskScores: { [key: string]: number } = {
      CRITICAL: 90,
      HIGH: 70,
      MEDIUM: 40,
      LOW: 10,
    };
    score += riskScores[data.riskLevel] || 0;

    // Failed operations are more suspicious
    if (!data.success) {
      score += 20;
    }

    // Very slow operations might be suspicious (>5 seconds)
    if (data.duration > 5000) {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
