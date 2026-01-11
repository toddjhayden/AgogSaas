/**
 * Cache Service
 * REQ-1767924916114-qbjk4: Implement Redis Cache Warming Strategy
 *
 * Wrapper around NestJS Cache Manager with additional features:
 * - Type-safe caching with generics
 * - TTL management by data type
 * - Cache-aside pattern helpers
 * - Metrics tracking
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheKeyService } from './cache-key.service';
import { CacheMonitoringService } from './cache-monitoring.service';

export enum CacheTTL {
  // Short TTL for operational data (5 minutes)
  OPERATIONAL = 5 * 60 * 1000,
  // Medium TTL for dashboard data (1 hour)
  DASHBOARD = 60 * 60 * 1000,
  // Long TTL for reference data (12 hours)
  REFERENCE = 12 * 60 * 60 * 1000,
  // Very long TTL for static data (24 hours)
  STATIC = 24 * 60 * 60 * 1000,
  // Authorization data (15 minutes)
  AUTH = 15 * 60 * 1000,
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private cacheKeyService: CacheKeyService,
    private monitoringService: CacheMonitoringService,
  ) {}

  /**
   * Get value from cache
   * Returns null if not found (cache miss)
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const startTime = Date.now();
      const value = await this.cacheManager.get<T>(key);
      const duration = Date.now() - startTime;

      // Record metrics
      if (value !== undefined && value !== null) {
        this.monitoringService.recordCacheHit(key, duration);
      } else {
        this.monitoringService.recordCacheMiss(key, duration);
      }

      return value ?? null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      this.monitoringService.recordCacheError(key, 'GET', error as Error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (optional, defaults to module default)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const startTime = Date.now();
      await this.cacheManager.set(key, value, ttl);
      const duration = Date.now() - startTime;

      this.monitoringService.recordCacheSet(key, duration);
      this.logger.debug(`Cache set: ${key} (TTL: ${ttl || 'default'}ms)`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      this.monitoringService.recordCacheError(key, 'SET', error as Error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      const startTime = Date.now();
      await this.cacheManager.del(key);
      const duration = Date.now() - startTime;

      this.monitoringService.recordCacheDelete(key, duration);
      this.logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
      this.monitoringService.recordCacheError(key, 'DEL', error as Error);
    }
  }

  /**
   * Reset entire cache (use with caution)
   */
  async reset(): Promise<void> {
    try {
      const startTime = Date.now();
      await this.cacheManager.reset();
      const duration = Date.now() - startTime;

      this.monitoringService.recordCacheReset(duration);
      this.logger.warn('Cache reset completed');
    } catch (error) {
      this.logger.error('Cache reset error:', error);
      this.monitoringService.recordCacheError('*', 'RESET', error as Error);
    }
  }

  /**
   * Wrap a function with cache-aside pattern
   * If value exists in cache, return it
   * Otherwise, execute function, cache result, and return
   *
   * @param key - Cache key
   * @param fn - Function to execute if cache miss
   * @param ttl - Time to live in milliseconds
   */
  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - execute function
    try {
      const startTime = Date.now();
      const result = await fn();
      const duration = Date.now() - startTime;

      this.monitoringService.recordCacheMiss(key, duration);

      // Cache the result
      await this.set(key, result, ttl);

      return result;
    } catch (error) {
      this.logger.error(`Cache wrap error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get or set with automatic cache-aside pattern
   * Convenience method that combines get and set
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    return this.wrap(key, fn, ttl);
  }

  /**
   * Get multiple keys in parallel
   * Returns a map of key -> value (null for misses)
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get<T>(key);
        results.set(key, value);
      }),
    );

    return results;
  }

  /**
   * Set multiple keys in parallel
   */
  async mset<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    await Promise.all(
      Array.from(entries.entries()).map(([key, value]) =>
        this.set(key, value, ttl),
      ),
    );
  }

  /**
   * Delete multiple keys in parallel
   */
  async mdel(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.del(key)));
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
    hitRate: number;
  }> {
    return this.monitoringService.getStats();
  }

  /**
   * Get cache store for advanced operations
   * Use with caution - bypasses monitoring
   */
  getStore(): Cache {
    return this.cacheManager;
  }

  /**
   * Get key service for generating cache keys
   */
  getKeyService(): CacheKeyService {
    return this.cacheKeyService;
  }
}
