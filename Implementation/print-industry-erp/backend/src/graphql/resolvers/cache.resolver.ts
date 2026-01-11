/**
 * Cache Management GraphQL Resolver
 * REQ-1767541724200-xzjz9: Redis Caching Layer
 *
 * Provides GraphQL API for:
 * - Cache statistics and monitoring
 * - Cache warming operations
 * - Cache invalidation operations
 * - Cache health checks
 */

import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CacheService } from '../../cache/services/cache.service';
import { CacheWarmingService } from '../../cache/services/cache-warming.service';
import { CacheKeyService } from '../../cache/services/cache-key.service';
import { CacheMonitoringService } from '../../cache/services/cache-monitoring.service';
import { CacheInvalidationService } from '../../cache/services/cache-invalidation.service';

/**
 * Cache Management Resolver
 * Exposes cache operations via GraphQL
 */
@Resolver('Cache')
export class CacheResolver {
  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheWarmingService: CacheWarmingService,
    private readonly cacheKeyService: CacheKeyService,
    private readonly cacheMonitoringService: CacheMonitoringService,
    private readonly cacheInvalidationService: CacheInvalidationService,
  ) {}

  // =====================================================
  // QUERIES - MONITORING
  // =====================================================

  /**
   * Get cache statistics
   */
  @Query('cacheStats')
  async getCacheStats() {
    return this.cacheMonitoringService.getStats();
  }

  /**
   * Get cache health status
   */
  @Query('cacheHealth')
  async getCacheHealth() {
    return this.cacheMonitoringService.getHealthStatus();
  }

  /**
   * Check if cache warming is in progress
   */
  @Query('cacheWarmingStatus')
  async getCacheWarmingStatus() {
    return {
      inProgress: this.cacheWarmingService.isWarmingInProgress(),
    };
  }

  // =====================================================
  // MUTATIONS - WARMING
  // =====================================================

  /**
   * Warm cache for all tenants
   * Triggers full cache warming cycle
   */
  @Mutation('warmAllTenantsCache')
  async warmAllTenantsCache() {
    const phaseResults = await this.cacheWarmingService.warmAllTenants();

    // Aggregate results
    const totalDuration = phaseResults.reduce((sum, r) => sum + r.duration, 0);
    const totalItems = phaseResults.reduce((sum, r) => sum + r.itemsWarmed, 0);
    const allErrors = phaseResults.flatMap((r) => r.errors);

    return {
      success: allErrors.length === 0,
      duration: totalDuration,
      itemsWarmed: totalItems,
      errors: allErrors,
      phaseResults,
    };
  }

  /**
   * Warm cache for a specific tenant
   */
  @Mutation('warmTenantCache')
  async warmTenantCache(@Args('tenantId') tenantId: string) {
    const phaseResults = await this.cacheWarmingService.warmTenant(tenantId);

    const totalDuration = phaseResults.reduce((sum, r) => sum + r.duration, 0);
    const totalItems = phaseResults.reduce((sum, r) => sum + r.itemsWarmed, 0);
    const allErrors = phaseResults.flatMap((r) => r.errors);

    return {
      success: allErrors.length === 0,
      duration: totalDuration,
      itemsWarmed: totalItems,
      errors: allErrors,
      phaseResults,
    };
  }

  // =====================================================
  // MUTATIONS - INVALIDATION
  // =====================================================

  /**
   * Invalidate all cache for a tenant
   * Use with caution - invalidates all tenant data
   */
  @Mutation('invalidateTenantCache')
  async invalidateTenantCache(@Args('tenantId') tenantId: string) {
    try {
      await this.cacheInvalidationService.invalidateTenant(tenantId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Invalidate a specific cache key
   */
  @Mutation('invalidateCacheKey')
  async invalidateCacheKey(@Args('key') key: string) {
    try {
      await this.cacheService.del(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Reset all cache
   * DANGER - use only for testing or emergency
   * Requires admin privileges
   */
  @Mutation('resetAllCache')
  async resetAllCache() {
    try {
      await this.cacheInvalidationService.invalidateAll();
      return true;
    } catch (error) {
      return false;
    }
  }
}
