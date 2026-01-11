/**
 * Webhook Delivery Service
 * REQ-1767925582664-n6du5
 *
 * Handles actual HTTP delivery of webhook events with retry logic
 */

import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import {
  WebhookDeliveryDto,
  DeliveryStatus,
  ListWebhookDeliveriesDto,
  LogLevel,
} from '../dto/webhook.dto';

@Injectable()
export class WebhookDeliveryService implements OnModuleInit {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private deliveryInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
  ) {}

  async onModuleInit() {
    // Start delivery processor (runs every 30 seconds)
    this.startDeliveryProcessor();
  }

  /**
   * Start the background delivery processor
   */
  private startDeliveryProcessor(): void {
    this.logger.log('Starting webhook delivery processor');

    this.deliveryInterval = setInterval(async () => {
      if (!this.isProcessing) {
        this.isProcessing = true;
        try {
          await this.processPendingDeliveries();
        } catch (error) {
          this.logger.error(`Delivery processor error: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          this.isProcessing = false;
        }
      }
    }, 30000); // Run every 30 seconds
  }

  /**
   * Stop the background delivery processor
   */
  stopDeliveryProcessor(): void {
    if (this.deliveryInterval) {
      clearInterval(this.deliveryInterval);
      this.deliveryInterval = null;
      this.logger.log('Stopped webhook delivery processor');
    }
  }

  /**
   * Process pending webhook deliveries
   */
  async processPendingDeliveries(): Promise<void> {
    const client = await this.db.connect();

    try {
      // Get pending deliveries that are ready to be sent (next_retry_at <= now)
      const result = await client.query(
        `SELECT
          d.*,
          s.timeout_seconds,
          s.max_retry_attempts,
          s.initial_retry_delay_seconds,
          s.retry_backoff_multiplier,
          s.max_retry_delay_seconds
        FROM webhook_deliveries d
        JOIN webhook_subscriptions s ON d.subscription_id = s.id
        WHERE d.delivery_status IN ('PENDING', 'FAILED')
          AND d.next_retry_at <= NOW()
          AND s.is_active = true
          AND s.deleted_at IS NULL
        ORDER BY d.created_at ASC
        LIMIT 50`
      );

      if (result.rows.length === 0) {
        return;
      }

      this.logger.log(`Processing ${result.rows.length} pending webhook deliveries`);

      // Process deliveries in parallel (max 10 concurrent)
      const batches = this.chunkArray(result.rows, 10);

      for (const batch of batches) {
        await Promise.all(batch.map(delivery => this.deliverWebhook(delivery)));
      }

    } finally {
      client.release();
    }
  }

  /**
   * Deliver a single webhook
   */
  private async deliverWebhook(delivery: any): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Update status to SENDING
      await client.query(
        `UPDATE webhook_deliveries
        SET delivery_status = 'SENDING', sent_at = NOW()
        WHERE id = $1`,
        [delivery.id]
      );

      await client.query('COMMIT');

      // Log attempt
      await this.createLog(client, delivery.tenant_id, delivery.id, LogLevel.INFO, 'Starting webhook delivery', {
        attempt: delivery.attempt_number,
        url: delivery.request_url,
      });

      // Parse request data
      const requestHeaders = delivery.request_headers || {};
      const requestBody = delivery.request_body;

      // Make HTTP request
      const startTime = Date.now();
      let response: Response;
      let responseBody: string | null = null;
      let responseHeaders: Record<string, string> = {};
      let errorMessage: string | null = null;
      let errorCode: string | null = null;

      try {
        response = await fetch(delivery.request_url, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(delivery.timeout_seconds * 1000),
        });

        const responseTime = Date.now() - startTime;

        // Collect response headers
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Read response body (limit to 10KB to prevent memory issues)
        const responseText = await response.text();
        responseBody = responseText.substring(0, 10240);

        // Determine if delivery succeeded
        const succeeded = response.status >= 200 && response.status < 300;

        if (succeeded) {
          // Success - mark as SUCCEEDED
          await client.query('BEGIN');

          await client.query(
            `UPDATE webhook_deliveries
            SET delivery_status = 'SUCCEEDED',
                response_status_code = $1,
                response_headers = $2,
                response_body = $3,
                response_time_ms = $4,
                completed_at = NOW()
            WHERE id = $5`,
            [response.status, JSON.stringify(responseHeaders), responseBody, responseTime, delivery.id]
          );

          await client.query('COMMIT');

          await this.createLog(client, delivery.tenant_id, delivery.id, LogLevel.INFO, 'Webhook delivered successfully', {
            status_code: response.status,
            response_time_ms: responseTime,
          });

          this.logger.log(`Webhook delivery ${delivery.id} succeeded (${response.status}) in ${responseTime}ms`);

        } else {
          // HTTP error - schedule retry if attempts remaining
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          errorCode = `HTTP_${response.status}`;

          await this.handleDeliveryFailure(
            client,
            delivery,
            response.status,
            responseHeaders,
            responseBody,
            responseTime,
            errorMessage,
            errorCode
          );
        }

      } catch (error) {
        // Network error or timeout
        const responseTime = Date.now() - startTime;
        errorMessage = error instanceof Error ? error.message : String(error);
        errorCode = error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';

        await this.handleDeliveryFailure(
          client,
          delivery,
          null,
          null,
          null,
          responseTime,
          errorMessage,
          errorCode
        );
      }

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to deliver webhook ${delivery.id}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Handle delivery failure and schedule retry
   */
  private async handleDeliveryFailure(
    client: any,
    delivery: any,
    statusCode: number | null,
    responseHeaders: Record<string, string> | null,
    responseBody: string | null,
    responseTime: number,
    errorMessage: string,
    errorCode: string
  ): Promise<void> {
    await client.query('BEGIN');

    const newRetryCount = delivery.retry_count + 1;
    const maxRetries = delivery.max_retry_attempts;

    if (newRetryCount >= maxRetries) {
      // Abandon delivery - too many retries
      await client.query(
        `UPDATE webhook_deliveries
        SET delivery_status = 'ABANDONED',
            response_status_code = $1,
            response_headers = $2,
            response_body = $3,
            response_time_ms = $4,
            error_message = $5,
            error_code = $6,
            completed_at = NOW()
        WHERE id = $7`,
        [
          statusCode,
          responseHeaders ? JSON.stringify(responseHeaders) : null,
          responseBody,
          responseTime,
          errorMessage,
          errorCode,
          delivery.id,
        ]
      );

      await client.query('COMMIT');

      await this.createLog(client, delivery.tenant_id, delivery.id, LogLevel.ERROR, 'Webhook delivery abandoned after max retries', {
        error_message: errorMessage,
        error_code: errorCode,
        retry_count: newRetryCount,
      });

      this.logger.error(`Webhook delivery ${delivery.id} abandoned after ${newRetryCount} attempts: ${errorMessage}`);

    } else {
      // Schedule retry with exponential backoff
      const retryDelaySeconds = this.calculateRetryDelay(
        newRetryCount,
        delivery.initial_retry_delay_seconds,
        delivery.retry_backoff_multiplier,
        delivery.max_retry_delay_seconds
      );

      const nextRetryAt = new Date(Date.now() + retryDelaySeconds * 1000);

      await client.query(
        `UPDATE webhook_deliveries
        SET delivery_status = 'FAILED',
            response_status_code = $1,
            response_headers = $2,
            response_body = $3,
            response_time_ms = $4,
            error_message = $5,
            error_code = $6,
            retry_count = $7,
            next_retry_at = $8,
            completed_at = NOW()
        WHERE id = $9`,
        [
          statusCode,
          responseHeaders ? JSON.stringify(responseHeaders) : null,
          responseBody,
          responseTime,
          errorMessage,
          errorCode,
          newRetryCount,
          nextRetryAt,
          delivery.id,
        ]
      );

      await client.query('COMMIT');

      await this.createLog(client, delivery.tenant_id, delivery.id, LogLevel.WARN, 'Webhook delivery failed, will retry', {
        error_message: errorMessage,
        error_code: errorCode,
        retry_count: newRetryCount,
        next_retry_at: nextRetryAt.toISOString(),
        retry_delay_seconds: retryDelaySeconds,
      });

      this.logger.warn(`Webhook delivery ${delivery.id} failed (attempt ${newRetryCount}/${maxRetries}). Retrying in ${retryDelaySeconds}s: ${errorMessage}`);
    }
  }

  /**
   * Calculate retry delay using exponential backoff
   */
  private calculateRetryDelay(
    retryCount: number,
    initialDelay: number,
    backoffMultiplier: number,
    maxDelay: number
  ): number {
    const delay = Math.min(
      initialDelay * Math.pow(backoffMultiplier, retryCount),
      maxDelay
    );
    return Math.floor(delay);
  }

  /**
   * Get a webhook delivery by ID
   */
  async getDelivery(deliveryId: string, tenantId: string): Promise<WebhookDeliveryDto> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      const result = await client.query(
        `SELECT * FROM webhook_deliveries WHERE id = $1 AND tenant_id = $2`,
        [deliveryId, tenantId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Webhook delivery ${deliveryId} not found`);
      }

      return this.mapRowToDto(result.rows[0]);

    } finally {
      client.release();
    }
  }

  /**
   * List webhook deliveries
   */
  async listDeliveries(dto: ListWebhookDeliveriesDto): Promise<WebhookDeliveryDto[]> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [dto.tenantId]);

      const conditions: string[] = ['tenant_id = $1'];
      const values: any[] = [dto.tenantId];
      let paramIndex = 2;

      if (dto.subscriptionId) {
        conditions.push(`subscription_id = $${paramIndex++}`);
        values.push(dto.subscriptionId);
      }

      if (dto.eventId) {
        conditions.push(`event_id = $${paramIndex++}`);
        values.push(dto.eventId);
      }

      if (dto.deliveryStatus) {
        conditions.push(`delivery_status = $${paramIndex++}`);
        values.push(dto.deliveryStatus);
      }

      if (dto.startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(dto.startDate);
      }

      if (dto.endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(dto.endDate);
      }

      const limit = dto.limit ?? 100;
      const offset = dto.offset ?? 0;

      const result = await client.query(
        `SELECT * FROM webhook_deliveries
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, offset]
      );

      return result.rows.map(row => this.mapRowToDto(row));

    } finally {
      client.release();
    }
  }

  /**
   * Retry a failed delivery immediately
   */
  async retryDelivery(deliveryId: string, tenantId: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // Reset delivery to PENDING with immediate retry
      const result = await client.query(
        `UPDATE webhook_deliveries
        SET delivery_status = 'PENDING',
            next_retry_at = NOW(),
            error_message = NULL,
            error_code = NULL
        WHERE id = $1 AND tenant_id = $2 AND delivery_status IN ('FAILED', 'ABANDONED')
        RETURNING id`,
        [deliveryId, tenantId]
      );

      if (result.rowCount === 0) {
        throw new Error(`Cannot retry delivery ${deliveryId} - not found or not in failed state`);
      }

      this.logger.log(`Manually retrying webhook delivery ${deliveryId}`);

    } finally {
      client.release();
    }
  }

  /**
   * Create a delivery log entry
   */
  private async createLog(
    client: any,
    tenantId: string,
    deliveryId: string,
    logLevel: LogLevel,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      await client.query(
        `INSERT INTO webhook_delivery_logs (tenant_id, delivery_id, log_level, log_message, log_data)
        VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, deliveryId, logLevel, message, data ? JSON.stringify(data) : null]
      );
    } catch (error) {
      // Don't fail delivery if logging fails
      this.logger.error(`Failed to create delivery log: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Map database row to DTO
   */
  private mapRowToDto(row: any): WebhookDeliveryDto {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      subscriptionId: row.subscription_id,
      eventId: row.event_id,
      attemptNumber: row.attempt_number,
      deliveryStatus: row.delivery_status as DeliveryStatus,
      requestUrl: row.request_url,
      requestHeaders: row.request_headers,
      requestBody: row.request_body,
      requestSignature: row.request_signature,
      responseStatusCode: row.response_status_code,
      responseHeaders: row.response_headers,
      responseBody: row.response_body,
      responseTimeMs: row.response_time_ms,
      errorMessage: row.error_message,
      errorCode: row.error_code,
      errorDetails: row.error_details,
      nextRetryAt: row.next_retry_at,
      retryCount: row.retry_count,
      sentAt: row.sent_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }
}
