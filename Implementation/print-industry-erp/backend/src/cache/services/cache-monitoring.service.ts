/**
 * Cache Monitoring Service
 * REQ-1767924916114-qbjk4: Implement Redis Cache Warming Strategy
 *
 * Tracks cache metrics for observability:
 * - Hit/miss rates
 * - Response times
 * - Error tracking
 * - Cache health status
 */

import { Injectable, Logger } from '@nestjs/common';

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  resets: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
  avgHitDuration: number;
  avgMissDuration: number;
  avgSetDuration: number;
}

@Injectable()
export class CacheMonitoringService {
  private readonly logger = new Logger(CacheMonitoringService.name);

  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    resets: 0,
  };

  // Track response times
  private hitDurations: number[] = [];
  private missDurations: number[] = [];
  private setDurations: number[] = [];
  private deleteDurations: number[] = [];

  // Max history size for duration tracking
  private readonly maxHistorySize = 1000;

  /**
   * Record a cache hit
   */
  recordCacheHit(key: string, duration: number): void {
    this.metrics.hits++;
    this.hitDurations.push(duration);
    if (this.hitDurations.length > this.maxHistorySize) {
      this.hitDurations.shift();
    }
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(key: string, duration: number): void {
    this.metrics.misses++;
    this.missDurations.push(duration);
    if (this.missDurations.length > this.maxHistorySize) {
      this.missDurations.shift();
    }
  }

  /**
   * Record a cache set operation
   */
  recordCacheSet(key: string, duration: number): void {
    this.metrics.sets++;
    this.setDurations.push(duration);
    if (this.setDurations.length > this.maxHistorySize) {
      this.setDurations.shift();
    }
  }

  /**
   * Record a cache delete operation
   */
  recordCacheDelete(key: string, duration: number): void {
    this.metrics.deletes++;
    this.deleteDurations.push(duration);
    if (this.deleteDurations.length > this.maxHistorySize) {
      this.deleteDurations.shift();
    }
  }

  /**
   * Record a cache reset operation
   */
  recordCacheReset(duration: number): void {
    this.metrics.resets++;
    this.logger.warn(`Cache reset recorded (duration: ${duration}ms)`);
  }

  /**
   * Record a cache error
   */
  recordCacheError(key: string, operation: string, error: Error): void {
    this.metrics.errors++;
    this.logger.error(`Cache error [${operation}] on key ${key}:`, error);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0;

    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      sets: this.metrics.sets,
      deletes: this.metrics.deletes,
      errors: this.metrics.errors,
      hitRate: hitRate * 100, // Percentage
      avgHitDuration: this.calculateAverage(this.hitDurations),
      avgMissDuration: this.calculateAverage(this.missDurations),
      avgSetDuration: this.calculateAverage(this.setDurations),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      resets: 0,
    };
    this.hitDurations = [];
    this.missDurations = [];
    this.setDurations = [];
    this.deleteDurations = [];
    this.logger.log('Cache metrics reset');
  }

  /**
   * Get health status
   * Returns 'healthy' if hit rate > 70% and error rate < 5%
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    hitRate: number;
    errorRate: number;
  } {
    const stats = this.getStats();
    const totalOperations =
      this.metrics.hits +
      this.metrics.misses +
      this.metrics.sets +
      this.metrics.deletes;
    const errorRate =
      totalOperations > 0 ? this.metrics.errors / totalOperations : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (stats.hitRate > 70 && errorRate < 0.05) {
      status = 'healthy';
    } else if (stats.hitRate > 50 && errorRate < 0.1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      hitRate: stats.hitRate,
      errorRate: errorRate * 100,
    };
  }

  /**
   * Log periodic statistics
   */
  logStats(): void {
    const stats = this.getStats();
    const health = this.getHealthStatus();

    this.logger.log(
      `Cache Stats - Hit Rate: ${stats.hitRate.toFixed(2)}%, ` +
        `Hits: ${stats.hits}, Misses: ${stats.misses}, ` +
        `Sets: ${stats.sets}, Errors: ${stats.errors}, ` +
        `Health: ${health.status}`,
    );
  }

  /**
   * Calculate average of an array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }
}
