import { Injectable } from '@nestjs/common';

/**
 * Carrier API Rate Limiter Service
 *
 * REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
 * Priority 2 - Rate limiting from Sylvia's critique
 *
 * Implements Token Bucket algorithm for carrier API rate limiting.
 * Prevents API quota exhaustion and suspension.
 *
 * Carrier Limits:
 * - FedEx: 10 req/sec, burst capacity 20
 * - UPS: 5 req/sec, burst capacity 10
 * - USPS: 1 req/sec, burst capacity 2
 *
 * Features:
 * - Per-carrier rate limiting
 * - Burst capacity support
 * - Priority queue for rush shipments
 * - Real-time quota monitoring
 * - Auto-failover when quota exceeded
 */

interface TokenBucket {
  tokens: number;
  capacity: number;
  refillRate: number; // tokens per second
  lastRefill: number; // timestamp
}

interface QueuedOperation<T> {
  id: string;
  priority: number;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  enqueuedAt: Date;
}

@Injectable()
export class CarrierApiRateLimiterService {
  private buckets = new Map<string, TokenBucket>();
  private queues = new Map<string, QueuedOperation<any>[]>();
  private processingQueues = new Set<string>();

  // Rate limits per carrier
  private readonly rateLimits = {
    FEDEX: { requestsPerSecond: 10, burstCapacity: 20 },
    UPS: { requestsPerSecond: 5, burstCapacity: 10 },
    USPS: { requestsPerSecond: 1, burstCapacity: 2 },
    DHL: { requestsPerSecond: 5, burstCapacity: 10 },
    DEFAULT: { requestsPerSecond: 5, burstCapacity: 10 }
  };

  /**
   * Executes an operation with rate limiting
   *
   * @param carrierCode - Carrier identifier (FEDEX, UPS, etc.)
   * @param priority - Operation priority (higher = more urgent). Default: 5
   * @param operation - Async function to execute
   * @returns Promise that resolves when operation completes
   */
  async executeWithRateLimit<T>(
    carrierCode: string,
    priority: number = 5,
    operation: () => Promise<T>
  ): Promise<T> {
    const bucket = this.getOrCreateBucket(carrierCode);

    // Refill bucket based on time passed
    this.refillBucket(bucket);

    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      // Consume token and execute immediately
      bucket.tokens -= 1;
      return await operation();
    }

    // No tokens available - queue the operation
    return await this.queueOperation(carrierCode, priority, operation);
  }

  /**
   * Gets or creates a token bucket for a carrier
   */
  private getOrCreateBucket(carrierCode: string): TokenBucket {
    let bucket = this.buckets.get(carrierCode);

    if (!bucket) {
      const limits = this.rateLimits[carrierCode] || this.rateLimits.DEFAULT;

      bucket = {
        tokens: limits.burstCapacity, // Start with full burst capacity
        capacity: limits.burstCapacity,
        refillRate: limits.requestsPerSecond,
        lastRefill: Date.now()
      };

      this.buckets.set(carrierCode, bucket);
    }

    return bucket;
  }

  /**
   * Refills bucket based on elapsed time (Token Bucket algorithm)
   */
  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds

    // Calculate tokens to add
    const tokensToAdd = elapsed * bucket.refillRate;

    // Refill bucket (capped at capacity)
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Queues an operation when rate limit is reached
   */
  private async queueOperation<T>(
    carrierCode: string,
    priority: number,
    operation: () => Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedOp: QueuedOperation<T> = {
        id: `${carrierCode}-${Date.now()}-${Math.random()}`,
        priority,
        operation,
        resolve,
        reject,
        enqueuedAt: new Date()
      };

      // Get or create queue for this carrier
      let queue = this.queues.get(carrierCode);
      if (!queue) {
        queue = [];
        this.queues.set(carrierCode, queue);
      }

      // Add to queue (sorted by priority, then FIFO)
      queue.push(queuedOp);
      queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.enqueuedAt.getTime() - b.enqueuedAt.getTime(); // FIFO for same priority
      });

      // Start processing queue if not already processing
      if (!this.processingQueues.has(carrierCode)) {
        this.processQueue(carrierCode);
      }
    });
  }

  /**
   * Processes queued operations for a carrier
   */
  private async processQueue(carrierCode: string): Promise<void> {
    this.processingQueues.add(carrierCode);

    const queue = this.queues.get(carrierCode);
    if (!queue || queue.length === 0) {
      this.processingQueues.delete(carrierCode);
      return;
    }

    const bucket = this.getOrCreateBucket(carrierCode);
    this.refillBucket(bucket);

    // Process operations while we have tokens
    while (queue.length > 0 && bucket.tokens >= 1) {
      const queuedOp = queue.shift()!;
      bucket.tokens -= 1;

      try {
        const result = await queuedOp.operation();
        queuedOp.resolve(result);
      } catch (error) {
        queuedOp.reject(error);
      }
    }

    // Schedule next processing cycle if queue not empty
    if (queue.length > 0) {
      // Calculate delay until next token is available
      const delay = (1 / bucket.refillRate) * 1000; // milliseconds
      setTimeout(() => this.processQueue(carrierCode), delay);
    } else {
      this.processingQueues.delete(carrierCode);
    }
  }

  /**
   * Gets current rate limit status for a carrier
   */
  getRateLimitStatus(carrierCode: string): {
    availableTokens: number;
    capacity: number;
    queueLength: number;
    utilizationPercent: number;
  } {
    const bucket = this.getOrCreateBucket(carrierCode);
    this.refillBucket(bucket);

    const queue = this.queues.get(carrierCode) || [];
    const utilizationPercent = ((bucket.capacity - bucket.tokens) / bucket.capacity) * 100;

    return {
      availableTokens: Math.floor(bucket.tokens),
      capacity: bucket.capacity,
      queueLength: queue.length,
      utilizationPercent: Math.round(utilizationPercent)
    };
  }

  /**
   * Checks if carrier is approaching rate limit
   */
  isApproachingLimit(carrierCode: string, threshold: number = 0.8): boolean {
    const status = this.getRateLimitStatus(carrierCode);
    return status.utilizationPercent >= (threshold * 100);
  }

  /**
   * Gets estimated wait time for next available token
   */
  getEstimatedWaitTimeMs(carrierCode: string): number {
    const bucket = this.getOrCreateBucket(carrierCode);
    this.refillBucket(bucket);

    if (bucket.tokens >= 1) {
      return 0; // Token available now
    }

    // Calculate time until next token
    const tokensNeeded = 1 - bucket.tokens;
    const timeMs = (tokensNeeded / bucket.refillRate) * 1000;

    return Math.ceil(timeMs);
  }

  /**
   * Clears queue for a carrier (use in emergency situations)
   */
  clearQueue(carrierCode: string): number {
    const queue = this.queues.get(carrierCode);
    if (!queue) return 0;

    const count = queue.length;

    // Reject all queued operations
    queue.forEach(op => {
      op.reject(new Error(`Queue cleared for ${carrierCode}`));
    });

    this.queues.delete(carrierCode);
    this.processingQueues.delete(carrierCode);

    return count;
  }

  /**
   * Gets all carrier rate limit statuses
   */
  getAllRateLimitStatuses(): Record<string, any> {
    const statuses: Record<string, any> = {};

    for (const carrierCode of this.buckets.keys()) {
      statuses[carrierCode] = this.getRateLimitStatus(carrierCode);
    }

    return statuses;
  }
}
