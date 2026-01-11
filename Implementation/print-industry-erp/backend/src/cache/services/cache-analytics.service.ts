/**
 * Cache Analytics Service
 * REQ-1767924916114-qbjk4: Implement Redis Cache Warming Strategy
 *
 * Tracks query patterns and access frequencies to enable predictive cache warming.
 * Provides intelligence for:
 * - Most frequently accessed keys by tenant
 * - Query patterns and timing
 * - Optimal TTL recommendations
 * - Cache efficiency metrics
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

export interface KeyAccessPattern {
  key: string;
  tenantId: string;
  accessCount: number;
  lastAccessed: Date;
  avgAccessFrequency: number; // accesses per hour
  hitRate: number; // percentage
  avgResponseTime: number; // milliseconds
}

export interface TenantUsagePattern {
  tenantId: string;
  peakHours: number[]; // Hours of day (0-23)
  mostAccessedKeys: string[];
  avgDailyRequests: number;
  preferredDataCategories: string[]; // finance, crm, ops, wms, etc.
}

export interface TTLRecommendation {
  key: string;
  currentTTL: number;
  recommendedTTL: number;
  reason: string;
  dataVolatility: 'static' | 'reference' | 'dashboard' | 'operational';
}

@Injectable()
export class CacheAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(CacheAnalyticsService.name);
  private readonly enableAnalytics: boolean;

  // In-memory storage for access patterns (would use Redis sorted sets in production)
  private keyAccessData = new Map<string, KeyAccessPattern>();
  private tenantUsageData = new Map<string, TenantUsagePattern>();
  private hourlyAccessCounts = new Map<string, Map<number, number>>();

  constructor(private configService: ConfigService) {
    this.enableAnalytics = this.configService.get<boolean>(
      'CACHE_ANALYTICS_ENABLED',
      true,
    );
  }

  async onModuleInit(): Promise<void> {
    if (this.enableAnalytics) {
      this.logger.log('Cache analytics service initialized');
    } else {
      this.logger.log('Cache analytics disabled via configuration');
    }
  }

  /**
   * Record a cache access event
   */
  recordAccess(
    key: string,
    tenantId: string,
    hit: boolean,
    responseTime: number,
  ): void {
    if (!this.enableAnalytics) return;

    const pattern = this.keyAccessData.get(key) || {
      key,
      tenantId,
      accessCount: 0,
      lastAccessed: new Date(),
      avgAccessFrequency: 0,
      hitRate: 0,
      avgResponseTime: 0,
    };

    // Update access metrics
    pattern.accessCount++;
    pattern.lastAccessed = new Date();
    pattern.hitRate =
      (pattern.hitRate * (pattern.accessCount - 1) + (hit ? 100 : 0)) /
      pattern.accessCount;
    pattern.avgResponseTime =
      (pattern.avgResponseTime * (pattern.accessCount - 1) + responseTime) /
      pattern.accessCount;

    this.keyAccessData.set(key, pattern);

    // Track hourly access patterns
    const hour = new Date().getHours();
    const tenantHourlyMap =
      this.hourlyAccessCounts.get(tenantId) || new Map<number, number>();
    tenantHourlyMap.set(hour, (tenantHourlyMap.get(hour) || 0) + 1);
    this.hourlyAccessCounts.set(tenantId, tenantHourlyMap);
  }

  /**
   * Get most frequently accessed keys for predictive warming
   */
  getTopAccessedKeys(tenantId: string, limit: number = 50): string[] {
    const tenantKeys = Array.from(this.keyAccessData.values()).filter(
      (p) => p.tenantId === tenantId,
    );

    return tenantKeys
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit)
      .map((p) => p.key);
  }

  /**
   * Analyze tenant usage patterns for optimized warming
   */
  getTenantUsagePattern(tenantId: string): TenantUsagePattern {
    const existingPattern = this.tenantUsageData.get(tenantId);
    if (existingPattern) return existingPattern;

    // Calculate peak hours based on access patterns
    const hourlyMap = this.hourlyAccessCounts.get(tenantId) || new Map();
    const peakHours = Array.from(hourlyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour]) => hour);

    // Get most accessed keys
    const mostAccessedKeys = this.getTopAccessedKeys(tenantId, 20);

    // Categorize data preferences based on key patterns
    const categories = new Set<string>();
    mostAccessedKeys.forEach((key) => {
      const category = key.split(':')[0]; // Extract module from key
      categories.add(category);
    });

    // Calculate average daily requests
    const totalRequests = Array.from(this.keyAccessData.values())
      .filter((p) => p.tenantId === tenantId)
      .reduce((sum, p) => sum + p.accessCount, 0);

    const pattern: TenantUsagePattern = {
      tenantId,
      peakHours: peakHours.length > 0 ? peakHours : [8, 9, 10, 14, 15], // Default business hours
      mostAccessedKeys,
      avgDailyRequests: totalRequests, // Simplified - would track over time
      preferredDataCategories: Array.from(categories),
    };

    this.tenantUsageData.set(tenantId, pattern);
    return pattern;
  }

  /**
   * Get TTL recommendations based on access patterns
   */
  getTTLRecommendations(tenantId: string): TTLRecommendation[] {
    const recommendations: TTLRecommendation[] = [];
    const tenantKeys = Array.from(this.keyAccessData.values()).filter(
      (p) => p.tenantId === tenantId,
    );

    for (const pattern of tenantKeys) {
      const recommendation = this.analyzeKeyVolatility(pattern);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    return recommendations.sort((a, b) => {
      // Sort by potential impact (most accessed first)
      const patternA = this.keyAccessData.get(a.key);
      const patternB = this.keyAccessData.get(b.key);
      return (patternB?.accessCount || 0) - (patternA?.accessCount || 0);
    });
  }

  /**
   * Analyze key volatility and recommend optimal TTL
   */
  private analyzeKeyVolatility(
    pattern: KeyAccessPattern,
  ): TTLRecommendation | null {
    // Extract data type from key pattern
    const keyParts = pattern.key.split(':');
    const module = keyParts[0];
    const entity = keyParts[1];

    let dataVolatility: 'static' | 'reference' | 'dashboard' | 'operational';
    let recommendedTTL: number;
    let reason: string;

    // Determine volatility based on entity type and access patterns
    if (
      entity === 'coa' ||
      entity === 'stages' ||
      entity === 'workcenters' ||
      entity === 'locations'
    ) {
      dataVolatility = 'static';
      recommendedTTL = 24 * 60 * 60 * 1000; // 24 hours
      reason = 'Rarely changing configuration data';
    } else if (
      entity === 'vendors' ||
      entity === 'customers' ||
      entity === 'materials'
    ) {
      dataVolatility = 'reference';
      recommendedTTL = 12 * 60 * 60 * 1000; // 12 hours
      reason = 'Master data with moderate update frequency';
    } else if (
      entity === 'currentPeriod' ||
      entity === 'summary' ||
      entity === 'kpis'
    ) {
      dataVolatility = 'dashboard';
      recommendedTTL = 60 * 60 * 1000; // 1 hour
      reason = 'Dashboard data requiring periodic refresh';
    } else {
      dataVolatility = 'operational';
      recommendedTTL = 5 * 60 * 1000; // 5 minutes
      reason = 'Frequently changing operational data';
    }

    // Adjust based on access frequency
    if (pattern.accessCount > 1000 && pattern.hitRate > 90) {
      // High access, high hit rate - extend TTL
      recommendedTTL *= 1.5;
      reason += ' (extended due to high stability)';
    } else if (pattern.hitRate < 50) {
      // Low hit rate - reduce TTL
      recommendedTTL *= 0.5;
      reason += ' (reduced due to frequent invalidation)';
    }

    return {
      key: pattern.key,
      currentTTL: recommendedTTL, // Would fetch from cache in production
      recommendedTTL: Math.floor(recommendedTTL),
      reason,
      dataVolatility,
    };
  }

  /**
   * Get predictive warming candidates
   * Returns keys that should be pre-warmed based on historical patterns
   */
  getPredictiveWarmingCandidates(
    tenantId: string,
    currentHour: number = new Date().getHours(),
  ): string[] {
    const pattern = this.getTenantUsagePattern(tenantId);

    // If current hour is a peak hour, return all top accessed keys
    if (pattern.peakHours.includes(currentHour)) {
      this.logger.debug(
        `[${tenantId}] Peak hour ${currentHour} detected - warming top keys`,
      );
      return pattern.mostAccessedKeys;
    }

    // Otherwise, return top 10 most critical keys
    return pattern.mostAccessedKeys.slice(0, 10);
  }

  /**
   * Get cache efficiency metrics
   */
  getEfficiencyMetrics(tenantId?: string): {
    totalKeys: number;
    avgHitRate: number;
    avgResponseTime: number;
    topPerformers: string[];
    poorPerformers: string[];
  } {
    let patterns = Array.from(this.keyAccessData.values());
    if (tenantId) {
      patterns = patterns.filter((p) => p.tenantId === tenantId);
    }

    if (patterns.length === 0) {
      return {
        totalKeys: 0,
        avgHitRate: 0,
        avgResponseTime: 0,
        topPerformers: [],
        poorPerformers: [],
      };
    }

    const avgHitRate =
      patterns.reduce((sum, p) => sum + p.hitRate, 0) / patterns.length;
    const avgResponseTime =
      patterns.reduce((sum, p) => sum + p.avgResponseTime, 0) / patterns.length;

    const topPerformers = patterns
      .filter((p) => p.hitRate > 90 && p.accessCount > 100)
      .sort((a, b) => b.hitRate - a.hitRate)
      .slice(0, 10)
      .map((p) => p.key);

    const poorPerformers = patterns
      .filter((p) => p.hitRate < 50 && p.accessCount > 50)
      .sort((a, b) => a.hitRate - b.hitRate)
      .slice(0, 10)
      .map((p) => p.key);

    return {
      totalKeys: patterns.length,
      avgHitRate,
      avgResponseTime,
      topPerformers,
      poorPerformers,
    };
  }

  /**
   * Periodic analysis and logging (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async analyzeAndLog(): Promise<void> {
    if (!this.enableAnalytics) return;

    this.logger.log('Running periodic cache analytics...');

    const tenants = Array.from(
      new Set(
        Array.from(this.keyAccessData.values()).map((p) => p.tenantId),
      ),
    );

    for (const tenantId of tenants) {
      const metrics = this.getEfficiencyMetrics(tenantId);
      const recommendations = this.getTTLRecommendations(tenantId);

      this.logger.log(
        `[${tenantId}] Analytics: ${metrics.totalKeys} keys tracked, ` +
          `${metrics.avgHitRate.toFixed(2)}% hit rate, ` +
          `${metrics.avgResponseTime.toFixed(2)}ms avg response time`,
      );

      if (recommendations.length > 0) {
        this.logger.debug(
          `[${tenantId}] Top TTL recommendations: ${recommendations.slice(0, 3).map((r) => `${r.key} -> ${r.recommendedTTL}ms`).join(', ')}`,
        );
      }
    }
  }

  /**
   * Reset analytics data (for testing or periodic cleanup)
   */
  resetAnalytics(): void {
    this.keyAccessData.clear();
    this.tenantUsageData.clear();
    this.hourlyAccessCounts.clear();
    this.logger.log('Cache analytics data reset');
  }

  /**
   * Export analytics data for external analysis
   */
  exportAnalytics(tenantId?: string): {
    keyAccessPatterns: KeyAccessPattern[];
    tenantUsagePatterns: TenantUsagePattern[];
    ttlRecommendations: TTLRecommendation[];
  } {
    let keyPatterns = Array.from(this.keyAccessData.values());
    if (tenantId) {
      keyPatterns = keyPatterns.filter((p) => p.tenantId === tenantId);
    }

    const tenantPatterns = tenantId
      ? [this.getTenantUsagePattern(tenantId)]
      : Array.from(this.tenantUsageData.values());

    const recommendations = tenantId
      ? this.getTTLRecommendations(tenantId)
      : [];

    return {
      keyAccessPatterns: keyPatterns,
      tenantUsagePatterns: tenantPatterns,
      ttlRecommendations: recommendations,
    };
  }
}
