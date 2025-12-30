import { Injectable } from '@nestjs/common';
import { CircuitBreakerOpenError } from '../errors/carrier-errors';

/**
 * Carrier Circuit Breaker Service
 *
 * REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
 * Priority 2 - Circuit Breaker pattern from Sylvia's critique
 *
 * Prevents cascading failures when carrier APIs are down.
 * Implements Circuit Breaker pattern with three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests blocked
 * - HALF_OPEN: Testing if service recovered
 *
 * Configuration per carrier:
 * - Failure threshold: Number of failures before opening circuit
 * - Timeout: Time to wait before attempting recovery
 * - Success threshold: Successes needed in HALF_OPEN to close circuit
 */

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Successes in HALF_OPEN before closing
  timeout: number; // Time in ms before attempting recovery
  volumeThreshold: number; // Minimum requests before evaluating
}

interface CircuitStatus {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastStateChange: Date;
  nextRetryTime?: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
}

@Injectable()
export class CarrierCircuitBreakerService {
  private circuits = new Map<string, CircuitStatus>();

  // Default configuration
  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5, // Open after 5 consecutive failures
    successThreshold: 2, // Close after 2 consecutive successes
    timeout: 60000, // 60 seconds before retry
    volumeThreshold: 10 // Need 10 requests before evaluating
  };

  // Per-carrier overrides
  private readonly carrierConfigs: Record<string, Partial<CircuitBreakerConfig>> = {
    FEDEX: { failureThreshold: 3, timeout: 30000 }, // More sensitive for FedEx
    UPS: { failureThreshold: 5, timeout: 60000 },
    USPS: { failureThreshold: 10, timeout: 120000 }, // USPS is less reliable, be more lenient
  };

  /**
   * Executes an operation through the circuit breaker
   *
   * @param carrierCode - Carrier identifier
   * @param operation - Async operation to execute
   * @returns Promise that resolves when operation completes
   * @throws CircuitBreakerOpenError if circuit is open
   */
  async execute<T>(
    carrierCode: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const status = this.getOrCreateCircuit(carrierCode);
    const config = this.getConfig(carrierCode);

    // Check circuit state
    if (status.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset(status, config)) {
        // Transition to HALF_OPEN
        this.transitionTo(carrierCode, CircuitState.HALF_OPEN);
      } else {
        // Circuit still open
        throw new CircuitBreakerOpenError(carrierCode, status.nextRetryTime);
      }
    }

    // Execute operation
    try {
      const result = await operation();
      this.onSuccess(carrierCode);
      return result;
    } catch (error) {
      this.onFailure(carrierCode, error);
      throw error;
    }
  }

  /**
   * Records a successful operation
   */
  private onSuccess(carrierCode: string): void {
    const status = this.getOrCreateCircuit(carrierCode);
    const config = this.getConfig(carrierCode);

    status.successCount++;
    status.failureCount = 0; // Reset failure count
    status.totalRequests++;
    status.successfulRequests++;

    // If in HALF_OPEN state, check if we should close the circuit
    if (status.state === CircuitState.HALF_OPEN) {
      if (status.successCount >= config.successThreshold) {
        this.transitionTo(carrierCode, CircuitState.CLOSED);
        console.log(`Circuit breaker for ${carrierCode} CLOSED after ${status.successCount} successes`);
      }
    }
  }

  /**
   * Records a failed operation
   */
  private onFailure(carrierCode: string, error: any): void {
    const status = this.getOrCreateCircuit(carrierCode);
    const config = this.getConfig(carrierCode);

    status.failureCount++;
    status.successCount = 0; // Reset success count
    status.totalRequests++;
    status.failedRequests++;
    status.lastFailureTime = new Date();

    // Check if we should open the circuit
    if (
      status.state === CircuitState.CLOSED &&
      status.failureCount >= config.failureThreshold &&
      status.totalRequests >= config.volumeThreshold
    ) {
      this.transitionTo(carrierCode, CircuitState.OPEN);
      status.nextRetryTime = new Date(Date.now() + config.timeout);

      console.error(
        `Circuit breaker for ${carrierCode} OPENED after ${status.failureCount} failures. ` +
        `Next retry at ${status.nextRetryTime.toISOString()}`
      );

      // Alert operations team
      this.alertCircuitOpened(carrierCode, status);
    }

    // If in HALF_OPEN and we get a failure, reopen the circuit
    if (status.state === CircuitState.HALF_OPEN) {
      this.transitionTo(carrierCode, CircuitState.OPEN);
      status.nextRetryTime = new Date(Date.now() + config.timeout);

      console.error(
        `Circuit breaker for ${carrierCode} REOPENED during recovery test. ` +
        `Next retry at ${status.nextRetryTime.toISOString()}`
      );
    }
  }

  /**
   * Checks if we should attempt to reset the circuit
   */
  private shouldAttemptReset(status: CircuitStatus, config: CircuitBreakerConfig): boolean {
    if (!status.nextRetryTime) {
      return true; // No retry time set, attempt reset
    }

    return Date.now() >= status.nextRetryTime.getTime();
  }

  /**
   * Transitions circuit to a new state
   */
  private transitionTo(carrierCode: string, newState: CircuitState): void {
    const status = this.getOrCreateCircuit(carrierCode);
    const oldState = status.state;

    status.state = newState;
    status.lastStateChange = new Date();

    // Reset counters on state change
    if (newState === CircuitState.CLOSED) {
      status.failureCount = 0;
      status.successCount = 0;
      status.nextRetryTime = undefined;
    } else if (newState === CircuitState.HALF_OPEN) {
      status.successCount = 0;
      status.failureCount = 0;
    }

    console.log(`Circuit breaker for ${carrierCode}: ${oldState} -> ${newState}`);
  }

  /**
   * Gets or creates circuit status for a carrier
   */
  private getOrCreateCircuit(carrierCode: string): CircuitStatus {
    let status = this.circuits.get(carrierCode);

    if (!status) {
      status = {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastStateChange: new Date(),
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0
      };

      this.circuits.set(carrierCode, status);
    }

    return status;
  }

  /**
   * Gets configuration for a carrier (with defaults)
   */
  private getConfig(carrierCode: string): CircuitBreakerConfig {
    const overrides = this.carrierConfigs[carrierCode] || {};
    return { ...this.defaultConfig, ...overrides };
  }

  /**
   * Alerts operations team that circuit has opened
   */
  private alertCircuitOpened(carrierCode: string, status: CircuitStatus): void {
    // TODO: Integrate with alerting system (PagerDuty, Slack, etc.)
    console.error('CIRCUIT_BREAKER_ALERT:', {
      carrierCode,
      state: status.state,
      failureCount: status.failureCount,
      lastFailureTime: status.lastFailureTime,
      nextRetryTime: status.nextRetryTime,
      errorRate: status.totalRequests > 0
        ? (status.failedRequests / status.totalRequests * 100).toFixed(2) + '%'
        : 'N/A'
    });
  }

  /**
   * Gets circuit status for a carrier
   */
  getCircuitStatus(carrierCode: string): CircuitStatus {
    return this.getOrCreateCircuit(carrierCode);
  }

  /**
   * Gets all circuit statuses
   */
  getAllCircuitStatuses(): Record<string, CircuitStatus> {
    const statuses: Record<string, CircuitStatus> = {};

    for (const [carrierCode, status] of this.circuits.entries()) {
      statuses[carrierCode] = status;
    }

    return statuses;
  }

  /**
   * Manually opens a circuit (emergency use)
   */
  forceOpen(carrierCode: string, durationMs: number = 300000): void {
    const status = this.getOrCreateCircuit(carrierCode);
    this.transitionTo(carrierCode, CircuitState.OPEN);
    status.nextRetryTime = new Date(Date.now() + durationMs);

    console.warn(`Circuit breaker for ${carrierCode} manually OPENED for ${durationMs}ms`);
  }

  /**
   * Manually closes a circuit (emergency use)
   */
  forceClose(carrierCode: string): void {
    this.transitionTo(carrierCode, CircuitState.CLOSED);
    console.warn(`Circuit breaker for ${carrierCode} manually CLOSED`);
  }

  /**
   * Resets circuit state (clears all metrics)
   */
  reset(carrierCode: string): void {
    this.circuits.delete(carrierCode);
    console.log(`Circuit breaker for ${carrierCode} RESET`);
  }

  /**
   * Gets health metrics for monitoring
   */
  getHealthMetrics(carrierCode: string): {
    state: string;
    errorRate: number;
    availability: number;
    totalRequests: number;
  } {
    const status = this.getOrCreateCircuit(carrierCode);

    const errorRate = status.totalRequests > 0
      ? (status.failedRequests / status.totalRequests) * 100
      : 0;

    const availability = status.totalRequests > 0
      ? (status.successfulRequests / status.totalRequests) * 100
      : 100;

    return {
      state: status.state,
      errorRate: Math.round(errorRate * 100) / 100,
      availability: Math.round(availability * 100) / 100,
      totalRequests: status.totalRequests
    };
  }
}
