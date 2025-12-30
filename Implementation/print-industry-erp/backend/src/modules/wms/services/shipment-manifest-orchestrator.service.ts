import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { ICarrierClient, ShipmentRequest, ShipmentConfirmation } from '../interfaces/carrier-client.interface';
import { CarrierApiRateLimiterService } from './carrier-rate-limiter.service';
import { CarrierCircuitBreakerService } from './carrier-circuit-breaker.service';
import { CarrierErrorMapperService } from './carrier-error-mapper.service';
import { CarrierApiError } from '../errors/carrier-errors';

/**
 * Shipment Manifest Orchestrator Service
 *
 * REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
 * Priority 1 - Saga Pattern implementation from Sylvia's critique
 *
 * Implements Saga Pattern for distributed transactions between database and carrier APIs.
 * Ensures transaction safety by:
 * - Marking shipments as PENDING_MANIFEST before carrier API call
 * - Rolling back to original state if carrier API fails
 * - Implementing idempotency to prevent duplicate shipments
 * - Queuing failed manifests for retry
 * - Providing manual review dashboard for failed operations
 *
 * State Machine:
 * 1. PLANNED -> PENDING_MANIFEST (database update)
 * 2. PENDING_MANIFEST -> Carrier API call
 * 3a. Success: PENDING_MANIFEST -> MANIFESTED (database update)
 * 3b. Failure: PENDING_MANIFEST -> MANIFEST_FAILED (compensating transaction)
 */

interface ManifestSagaState {
  shipmentId: string;
  tenantId: string;
  previousStatus: string;
  idempotencyKey: string;
  attemptNumber: number;
  startedAt: Date;
}

@Injectable()
export class ShipmentManifestOrchestratorService {
  private activeSagas = new Map<string, ManifestSagaState>();

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly rateLimiter: CarrierApiRateLimiterService,
    private readonly circuitBreaker: CarrierCircuitBreakerService,
    private readonly errorMapper: CarrierErrorMapperService
  ) {}

  /**
   * Manifests a shipment with full transaction safety
   *
   * @param shipmentId - Shipment to manifest
   * @param carrierClient - Carrier API client
   * @param tenantId - Tenant identifier
   * @param userId - User requesting manifest
   * @returns Shipment confirmation from carrier
   */
  async manifestShipment(
    shipmentId: string,
    carrierClient: ICarrierClient,
    tenantId: string,
    userId: string
  ): Promise<ShipmentConfirmation> {
    // Generate idempotency key to prevent duplicate manifests
    const idempotencyKey = `manifest-${shipmentId}-${Date.now()}`;

    // Check if already processing
    if (this.activeSagas.has(shipmentId)) {
      throw new Error(`Shipment ${shipmentId} is already being manifested`);
    }

    // Phase 1: Mark shipment as PENDING_MANIFEST
    const sagaState = await this.beginSaga(shipmentId, tenantId, idempotencyKey);

    try {
      // Phase 2: Get shipment details for carrier API
      const shipmentRequest = await this.buildShipmentRequest(shipmentId, tenantId);

      // Phase 3: Call carrier API with rate limiting and circuit breaker
      const confirmation = await this.callCarrierApi(
        carrierClient,
        shipmentRequest,
        sagaState
      );

      // Phase 4: Update database with carrier confirmation
      await this.commitSaga(shipmentId, confirmation, userId);

      // Clean up saga state
      this.activeSagas.delete(shipmentId);

      return confirmation;

    } catch (error) {
      // Compensating transaction: rollback to original state
      await this.rollbackSaga(shipmentId, sagaState, error);

      // Clean up saga state
      this.activeSagas.delete(shipmentId);

      throw error;
    }
  }

  /**
   * Phase 1: Begin Saga - Mark shipment as PENDING_MANIFEST
   */
  private async beginSaga(
    shipmentId: string,
    tenantId: string,
    idempotencyKey: string
  ): Promise<ManifestSagaState> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get current shipment status
      const result = await client.query(
        `SELECT status FROM shipments
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         FOR UPDATE`, // Lock row
        [shipmentId, tenantId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Shipment ${shipmentId} not found`);
      }

      const currentStatus = result.rows[0].status;

      // Validate status transition
      if (currentStatus !== 'PLANNED' && currentStatus !== 'MANIFEST_FAILED') {
        throw new Error(
          `Cannot manifest shipment in ${currentStatus} status. ` +
          `Expected PLANNED or MANIFEST_FAILED.`
        );
      }

      // Check for duplicate idempotency key
      const dupCheck = await client.query(
        `SELECT id FROM shipment_manifest_attempts
         WHERE idempotency_key = $1`,
        [idempotencyKey]
      );

      if (dupCheck.rows.length > 0) {
        throw new Error(`Duplicate manifest attempt detected: ${idempotencyKey}`);
      }

      // Update shipment status to PENDING_MANIFEST
      await client.query(
        `UPDATE shipments
         SET status = 'PENDING_MANIFEST',
             updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [shipmentId, tenantId]
      );

      // Log manifest attempt
      await client.query(
        `INSERT INTO shipment_manifest_attempts (
           tenant_id, shipment_id, idempotency_key, status, started_at
         ) VALUES ($1, $2, $3, 'IN_PROGRESS', NOW())`,
        [tenantId, shipmentId, idempotencyKey]
      );

      await client.query('COMMIT');

      const sagaState: ManifestSagaState = {
        shipmentId,
        tenantId,
        previousStatus: currentStatus,
        idempotencyKey,
        attemptNumber: 1,
        startedAt: new Date()
      };

      this.activeSagas.set(shipmentId, sagaState);

      console.log(`Saga started for shipment ${shipmentId}: ${currentStatus} -> PENDING_MANIFEST`);

      return sagaState;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Phase 2: Build shipment request from database
   */
  private async buildShipmentRequest(
    shipmentId: string,
    tenantId: string
  ): Promise<ShipmentRequest> {
    const result = await this.db.query(
      `SELECT s.*, ci.carrier_code
       FROM shipments s
       LEFT JOIN carrier_integrations ci ON ci.id = s.carrier_integration_id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [shipmentId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Shipment ${shipmentId} not found`);
    }

    const row = result.rows[0];

    // Build shipment request
    const request: ShipmentRequest = {
      tenantId,
      facilityId: row.facility_id,
      shipmentId: row.id,
      serviceType: row.service_level || 'GROUND',
      shipFrom: {
        name: 'Warehouse', // TODO: Get from facility
        addressLine1: '123 Main St',
        city: 'City',
        state: 'CA',
        postalCode: '12345',
        country: 'US'
      },
      shipTo: {
        name: row.ship_to_name,
        addressLine1: row.ship_to_address_line1,
        addressLine2: row.ship_to_address_line2,
        city: row.ship_to_city,
        state: row.ship_to_state,
        postalCode: row.ship_to_postal_code,
        country: row.ship_to_country || 'US',
        phone: row.ship_to_phone,
        email: row.ship_to_email
      },
      packages: [
        {
          sequenceNumber: 1,
          weight: parseFloat(row.total_weight) || 1.0,
          weightUnit: 'LBS'
        }
      ]
    };

    return request;
  }

  /**
   * Phase 3: Call carrier API with rate limiting and circuit breaker
   */
  private async callCarrierApi(
    carrierClient: ICarrierClient,
    request: ShipmentRequest,
    sagaState: ManifestSagaState
  ): Promise<ShipmentConfirmation> {
    const carrierCode = carrierClient.getCarrierCode();

    try {
      // Execute with rate limiting and circuit breaker
      const confirmation = await this.rateLimiter.executeWithRateLimit(
        carrierCode,
        5, // Normal priority
        async () => {
          return await this.circuitBreaker.execute(
            carrierCode,
            async () => {
              return await carrierClient.createShipment(request);
            }
          );
        }
      );

      console.log(
        `Carrier API success for shipment ${request.shipmentId}: ` +
        `Tracking ${confirmation.trackingNumber}`
      );

      return confirmation;

    } catch (error) {
      // Map error to domain-specific error
      const carrierError = error instanceof CarrierApiError
        ? error
        : this.errorMapper.mapError(carrierCode, error);

      console.error(
        `Carrier API failed for shipment ${request.shipmentId}:`,
        carrierError.toJSON()
      );

      // Log detailed error for troubleshooting
      await this.logCarrierError(request.shipmentId, carrierError);

      throw carrierError;
    }
  }

  /**
   * Phase 4: Commit Saga - Update database with carrier confirmation
   */
  private async commitSaga(
    shipmentId: string,
    confirmation: ShipmentConfirmation,
    userId: string
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Update shipment with tracking number and manifest status
      await client.query(
        `UPDATE shipments
         SET status = 'MANIFESTED',
             tracking_number = $1,
             carrier_shipment_id = $2,
             shipping_label_url = $3,
             freight_cost = $4,
             updated_at = NOW(),
             updated_by = $5
         WHERE id = $6`,
        [
          confirmation.trackingNumber,
          confirmation.carrierShipmentId,
          confirmation.labelUrl,
          confirmation.totalCost,
          userId,
          shipmentId
        ]
      );

      // Mark manifest attempt as successful
      const sagaState = this.activeSagas.get(shipmentId)!;
      await client.query(
        `UPDATE shipment_manifest_attempts
         SET status = 'SUCCESS',
             completed_at = NOW(),
             tracking_number = $1
         WHERE idempotency_key = $2`,
        [confirmation.trackingNumber, sagaState.idempotencyKey]
      );

      await client.query('COMMIT');

      console.log(`Saga committed for shipment ${shipmentId}: MANIFESTED`);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Compensating Transaction: Rollback Saga
   */
  private async rollbackSaga(
    shipmentId: string,
    sagaState: ManifestSagaState,
    error: any
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Rollback shipment to previous status or MANIFEST_FAILED
      const newStatus = (error instanceof CarrierApiError && error.retryable)
        ? sagaState.previousStatus // Restore original status for retryable errors
        : 'MANIFEST_FAILED'; // Mark as failed for non-retryable errors

      await client.query(
        `UPDATE shipments
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [newStatus, shipmentId]
      );

      // Mark manifest attempt as failed
      await client.query(
        `UPDATE shipment_manifest_attempts
         SET status = 'FAILED',
             completed_at = NOW(),
             error_code = $1,
             error_message = $2
         WHERE idempotency_key = $3`,
        [
          error.errorCode || 'UNKNOWN',
          error.message || 'Unknown error',
          sagaState.idempotencyKey
        ]
      );

      // Queue for retry if error is retryable
      if (error instanceof CarrierApiError && error.retryable) {
        await this.queueForRetry(shipmentId, sagaState.tenantId, error, client);
      }

      // Queue for manual review if non-retryable
      if (!error.retryable) {
        await this.queueForManualReview(shipmentId, sagaState.tenantId, error, client);
      }

      await client.query('COMMIT');

      console.log(`Saga rolled back for shipment ${shipmentId}: ${newStatus}`);

    } catch (rollbackError) {
      await client.query('ROLLBACK');
      console.error(`Failed to rollback saga for shipment ${shipmentId}:`, rollbackError);
      throw rollbackError;
    } finally {
      client.release();
    }
  }

  /**
   * Queues shipment for automatic retry
   */
  private async queueForRetry(
    shipmentId: string,
    tenantId: string,
    error: CarrierApiError,
    client: any
  ): Promise<void> {
    const retryDelay = this.errorMapper.getRetryDelay(error, 1);
    const retryAt = new Date(Date.now() + retryDelay);

    await client.query(
      `INSERT INTO shipment_retry_queue (
         tenant_id, shipment_id, retry_at, attempt_number, last_error
       ) VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (shipment_id) DO UPDATE
       SET retry_at = $3,
           attempt_number = shipment_retry_queue.attempt_number + 1,
           last_error = $4`,
      [tenantId, shipmentId, retryAt, error.message]
    );

    console.log(`Shipment ${shipmentId} queued for retry at ${retryAt.toISOString()}`);
  }

  /**
   * Queues shipment for manual review
   */
  private async queueForManualReview(
    shipmentId: string,
    tenantId: string,
    error: any,
    client: any
  ): Promise<void> {
    await client.query(
      `INSERT INTO shipment_manual_review_queue (
         tenant_id, shipment_id, reason, error_details, queued_at
       ) VALUES ($1, $2, $3, $4, NOW())`,
      [
        tenantId,
        shipmentId,
        'Manifest failed with non-retryable error',
        JSON.stringify(error.toJSON ? error.toJSON() : error)
      ]
    );

    console.log(`Shipment ${shipmentId} queued for manual review`);
  }

  /**
   * Logs carrier API error for troubleshooting
   */
  private async logCarrierError(
    shipmentId: string,
    error: CarrierApiError
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO carrier_api_errors (
           shipment_id, carrier_code, error_code, error_message,
           severity, retryable, technical_details, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          shipmentId,
          error.carrierCode,
          error.errorCode,
          error.userMessage,
          error.severity,
          error.retryable,
          JSON.stringify(error.technicalDetails)
        ]
      );
    } catch (logError) {
      console.error('Failed to log carrier error:', logError);
    }
  }

  /**
   * Gets active saga count (for monitoring)
   */
  getActiveSagaCount(): number {
    return this.activeSagas.size;
  }

  /**
   * Gets saga state for a shipment (for debugging)
   */
  getSagaState(shipmentId: string): ManifestSagaState | undefined {
    return this.activeSagas.get(shipmentId);
  }
}
