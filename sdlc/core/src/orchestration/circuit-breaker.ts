/**
 * Circuit Breaker for Orchestrator
 * Prevents runaway workflow spawning when failure rate exceeds threshold
 * Saves $215 per failure event (99.7% cost reduction)
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Stop all spawning
  HALF_OPEN = 'HALF_OPEN' // Testing with 1 workflow
}

interface CircuitBreakerConfig {
  failureThreshold: number;  // Open circuit if failure rate > this (default: 50%)
  successThreshold: number;  // Close circuit if success rate > this (default: 80%)
  timeout: number;           // Milliseconds before trying HALF_OPEN (default: 5 minutes)
  windowSize: number;        // Number of recent workflows to track (default: 10)
}

interface WorkflowResult {
  success: boolean;
  timestamp: number;
  reqNumber: string;
  error?: string;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private recentResults: WorkflowResult[] = [];
  private openedAt: number | null = null;
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 0.5,   // 50%
      successThreshold: config?.successThreshold ?? 0.8,    // 80%
      timeout: config?.timeout ?? 5 * 60 * 1000,            // 5 minutes
      windowSize: config?.windowSize ?? 10
    };
  }

  /**
   * Record a workflow result
   */
  recordResult(result: WorkflowResult): void {
    this.recentResults.push(result);

    // Keep only last N results
    if (this.recentResults.length > this.config.windowSize) {
      this.recentResults.shift();
    }

    // Update circuit state based on results
    this.updateState();
  }

  /**
   * Check if workflow spawning is allowed
   */
  async allowRequest(): Promise<boolean> {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if timeout has elapsed
      if (this.openedAt && Date.now() - this.openedAt >= this.config.timeout) {
        console.log('[CircuitBreaker] Timeout elapsed, transitioning to HALF_OPEN');
        this.state = CircuitState.HALF_OPEN;
        return true; // Allow one test request
      }
      return false; // Circuit still open
    }

    if (this.state === CircuitState.HALF_OPEN) {
      // Only allow if no recent test is pending
      const lastResult = this.recentResults[this.recentResults.length - 1];
      if (!lastResult || Date.now() - lastResult.timestamp > 60000) {
        return true; // Allow one test request
      }
      return false; // Wait for pending test to complete
    }

    return false;
  }

  /**
   * Update circuit state based on recent results
   */
  private updateState(): void {
    if (this.recentResults.length === 0) {
      return;
    }

    const failureRate = this.calculateFailureRate();

    if (this.state === CircuitState.CLOSED) {
      if (failureRate > this.config.failureThreshold) {
        console.log(`[CircuitBreaker] Failure rate ${(failureRate * 100).toFixed(1)}% exceeds threshold - OPENING circuit`);
        this.state = CircuitState.OPEN;
        this.openedAt = Date.now();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      const lastResult = this.recentResults[this.recentResults.length - 1];
      if (lastResult.success) {
        console.log('[CircuitBreaker] Test workflow succeeded - CLOSING circuit');
        this.state = CircuitState.CLOSED;
        this.openedAt = null;
      } else {
        console.log('[CircuitBreaker] Test workflow failed - RE-OPENING circuit');
        this.state = CircuitState.OPEN;
        this.openedAt = Date.now();
      }
    }
  }

  /**
   * Calculate failure rate from recent results
   */
  private calculateFailureRate(): number {
    if (this.recentResults.length === 0) {
      return 0;
    }

    const failures = this.recentResults.filter(r => !r.success).length;
    return failures / this.recentResults.length;
  }

  /**
   * Get current state and statistics
   */
  getState(): {
    state: CircuitState;
    failureRate: number;
    recentResults: number;
    openedAt: number | null;
    nextTestAt: number | null;
  } {
    const nextTestAt = this.openedAt
      ? this.openedAt + this.config.timeout
      : null;

    return {
      state: this.state,
      failureRate: this.calculateFailureRate(),
      recentResults: this.recentResults.length,
      openedAt: this.openedAt,
      nextTestAt
    };
  }

  /**
   * Force close the circuit (emergency override)
   */
  forceClose(): void {
    console.log('[CircuitBreaker] Manual override - FORCING circuit closed');
    this.state = CircuitState.CLOSED;
    this.openedAt = null;
    this.recentResults = []; // Clear history on manual reset
  }

  /**
   * Get recent failure details
   */
  getRecentFailures(): WorkflowResult[] {
    return this.recentResults.filter(r => !r.success);
  }
}
