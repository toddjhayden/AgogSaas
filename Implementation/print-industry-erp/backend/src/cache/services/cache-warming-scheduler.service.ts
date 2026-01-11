/**
 * Cache Warming Scheduler Service
 * REQ-1767924916114-qbjk4: Implement Redis Cache Warming Strategy
 *
 * Manages periodic cache warming and refresh operations:
 * - Scheduled warming before peak hours
 * - Predictive warming based on usage patterns
 * - Selective refresh of time-sensitive data
 * - Coordinated warming across distributed instances
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CacheWarmingService, WarmingResult } from './cache-warming.service';
import { CacheAnalyticsService } from './cache-analytics.service';
import { CacheService, CacheTTL } from './cache.service';
import { CacheKeyService } from './cache-key.service';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';

export interface ScheduledWarmingConfig {
  enabled: boolean;
  peakHourPreWarm: boolean; // Warm 1 hour before peak
  nightlyFullWarm: boolean; // Full warming at 2 AM
  periodicRefresh: boolean; // Refresh time-sensitive data every 30 min
  predictiveWarm: boolean; // Use analytics for smart warming
}

export interface WarmingSchedule {
  tenantId: string;
  nextWarmingTime: Date;
  warmingType: 'full' | 'partial' | 'predictive';
  priority: number;
}

@Injectable()
export class CacheWarmingSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingSchedulerService.name);
  private readonly config: ScheduledWarmingConfig;
  private activeWarmings = new Set<string>();

  constructor(
    private configService: ConfigService,
    private warmingService: CacheWarmingService,
    private analyticsService: CacheAnalyticsService,
    private cacheService: CacheService,
    private cacheKeyService: CacheKeyService,
    private schedulerRegistry: SchedulerRegistry,
    @Inject('DATABASE_POOL') private dbPool: Pool,
  ) {
    this.config = {
      enabled: this.configService.get<boolean>(
        'CACHE_WARMING_SCHEDULED_ENABLED',
        true,
      ),
      peakHourPreWarm: this.configService.get<boolean>(
        'CACHE_WARMING_PEAK_HOUR_PREWARM',
        true,
      ),
      nightlyFullWarm: this.configService.get<boolean>(
        'CACHE_WARMING_NIGHTLY_FULL',
        true,
      ),
      periodicRefresh: this.configService.get<boolean>(
        'CACHE_WARMING_PERIODIC_REFRESH',
        true,
      ),
      predictiveWarm: this.configService.get<boolean>(
        'CACHE_WARMING_PREDICTIVE',
        true,
      ),
    };
  }

  async onModuleInit(): Promise<void> {
    if (this.config.enabled) {
      this.logger.log(
        'Cache warming scheduler initialized with config: ' +
          JSON.stringify(this.config),
      );
    } else {
      this.logger.log('Cache warming scheduler disabled via configuration');
    }
  }

  /**
   * Nightly full cache warming (runs at 2 AM)
   * Ensures all tenants have fresh cache before business hours
   */
  @Cron('0 2 * * *', {
    name: 'nightly-full-warming',
    timeZone: 'America/New_York',
  })
  async runNightlyFullWarming(): Promise<void> {
    if (!this.config.enabled || !this.config.nightlyFullWarm) return;

    this.logger.log('Starting nightly full cache warming');
    const startTime = Date.now();

    try {
      const results = await this.warmingService.warmAllTenants();
      const duration = (Date.now() - startTime) / 1000;
      const totalItems = results.reduce((sum, r) => sum + r.itemsWarmed, 0);

      this.logger.log(
        `Nightly full warming completed: ${totalItems} items in ${duration.toFixed(2)}s`,
      );
    } catch (error) {
      this.logger.error('Nightly full warming failed:', error);
    }
  }

  /**
   * Periodic refresh of time-sensitive data (runs every 30 minutes)
   * Refreshes dashboard, current period, and operational data
   */
  @Cron('*/30 * * * *', {
    name: 'periodic-refresh',
  })
  async runPeriodicRefresh(): Promise<void> {
    if (!this.config.enabled || !this.config.periodicRefresh) return;

    this.logger.log('Starting periodic cache refresh');

    try {
      const tenants = await this.discoverTenants();

      for (const tenantId of tenants) {
        if (this.activeWarmings.has(tenantId)) {
          this.logger.debug(
            `[${tenantId}] Skipping periodic refresh - warming in progress`,
          );
          continue;
        }

        await this.refreshTimeSensitiveData(tenantId);
      }

      this.logger.log('Periodic cache refresh completed');
    } catch (error) {
      this.logger.error('Periodic cache refresh failed:', error);
    }
  }

  /**
   * Peak hour pre-warming (runs hourly, warms 1 hour before peak)
   * Uses analytics to predict and pre-warm based on usage patterns
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'peak-hour-prewarm',
  })
  async runPeakHourPreWarming(): Promise<void> {
    if (
      !this.config.enabled ||
      !this.config.peakHourPreWarm ||
      !this.config.predictiveWarm
    ) {
      return;
    }

    const currentHour = new Date().getHours();
    const nextHour = (currentHour + 1) % 24;

    this.logger.log(
      `Checking for peak hour pre-warming (current: ${currentHour}, next: ${nextHour})`,
    );

    try {
      const tenants = await this.discoverTenants();

      for (const tenantId of tenants) {
        if (this.activeWarmings.has(tenantId)) continue;

        const pattern = this.analyticsService.getTenantUsagePattern(tenantId);

        // If next hour is a peak hour, pre-warm now
        if (pattern.peakHours.includes(nextHour)) {
          this.logger.log(
            `[${tenantId}] Pre-warming for peak hour ${nextHour}`,
          );
          await this.runPredictiveWarming(tenantId);
        }
      }
    } catch (error) {
      this.logger.error('Peak hour pre-warming failed:', error);
    }
  }

  /**
   * Predictive warming based on analytics
   * Warms only frequently accessed keys for a tenant
   */
  private async runPredictiveWarming(tenantId: string): Promise<void> {
    if (this.activeWarmings.has(tenantId)) return;

    this.activeWarmings.add(tenantId);
    const startTime = Date.now();

    try {
      const currentHour = new Date().getHours();
      const candidateKeys =
        this.analyticsService.getPredictiveWarmingCandidates(
          tenantId,
          currentHour,
        );

      this.logger.log(
        `[${tenantId}] Predictive warming: ${candidateKeys.length} keys`,
      );

      let warmedCount = 0;

      // Warm each candidate key
      for (const key of candidateKeys) {
        try {
          await this.warmKeyFromPattern(tenantId, key);
          warmedCount++;
        } catch (error) {
          this.logger.warn(
            `[${tenantId}] Failed to warm key ${key}:`,
            error,
          );
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.log(
        `[${tenantId}] Predictive warming completed: ${warmedCount}/${candidateKeys.length} keys in ${duration.toFixed(2)}s`,
      );
    } catch (error) {
      this.logger.error(`[${tenantId}] Predictive warming failed:`, error);
    } finally {
      this.activeWarmings.delete(tenantId);
    }
  }

  /**
   * Refresh time-sensitive data (current period, dashboard KPIs, etc.)
   */
  private async refreshTimeSensitiveData(tenantId: string): Promise<void> {
    const startTime = Date.now();
    let refreshedCount = 0;

    try {
      // 1. Current Period (changes daily/monthly)
      const currentPeriodKey = this.cacheKeyService.currentPeriod(tenantId);
      const periodResult = await this.dbPool.query(
        `SELECT * FROM financial_periods
         WHERE tenant_id = $1
         AND period_start_date <= CURRENT_DATE
         AND period_end_date >= CURRENT_DATE
         LIMIT 1`,
        [tenantId],
      );
      if (periodResult.rows.length > 0) {
        await this.cacheService.set(
          currentPeriodKey,
          periodResult.rows[0],
          CacheTTL.DASHBOARD,
        );
        refreshedCount++;
      }

      // 2. Exchange Rates (update daily)
      const ratesResult = await this.dbPool.query(
        `SELECT DISTINCT ON (from_currency, to_currency)
         * FROM exchange_rates
         WHERE tenant_id = $1
         AND effective_date <= CURRENT_DATE
         ORDER BY from_currency, to_currency, effective_date DESC`,
        [tenantId],
      );
      for (const rate of ratesResult.rows) {
        const key = this.cacheKeyService.exchangeRate(
          tenantId,
          rate.from_currency,
          rate.to_currency,
        );
        await this.cacheService.set(key, rate, CacheTTL.STATIC);
        refreshedCount++;
      }

      // 3. Active Pricing Rules (may change daily)
      const pricingKey = this.cacheKeyService.pricingRules(tenantId);
      const pricingResult = await this.dbPool.query(
        `SELECT * FROM pricing_rules
         WHERE tenant_id = $1
         AND effective_date <= CURRENT_DATE
         AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)`,
        [tenantId],
      );
      await this.cacheService.set(
        pricingKey,
        pricingResult.rows,
        CacheTTL.REFERENCE,
      );
      refreshedCount++;

      const duration = (Date.now() - startTime) / 1000;
      this.logger.debug(
        `[${tenantId}] Refreshed ${refreshedCount} time-sensitive items in ${duration.toFixed(2)}s`,
      );
    } catch (error) {
      this.logger.error(
        `[${tenantId}] Failed to refresh time-sensitive data:`,
        error,
      );
    }
  }

  /**
   * Warm a specific key based on its pattern
   * Determines the appropriate query and TTL from the key structure
   */
  private async warmKeyFromPattern(
    tenantId: string,
    key: string,
  ): Promise<void> {
    const keyParts = key.split(':');
    const module = keyParts[0];
    const entity = keyParts[1];

    // Determine entity type and warm accordingly
    switch (entity) {
      case 'coa':
        await this.warmChartOfAccounts(tenantId);
        break;
      case 'currentPeriod':
        await this.warmCurrentPeriod(tenantId);
        break;
      case 'stages':
        await this.warmPipelineStages(tenantId);
        break;
      case 'workcenters':
        await this.warmWorkCenters(tenantId);
        break;
      case 'locations':
        await this.warmInventoryLocations(tenantId);
        break;
      // Add more cases as needed
      default:
        this.logger.debug(
          `[${tenantId}] No warming handler for entity: ${entity}`,
        );
    }
  }

  // ============================================================================
  // WARMING HELPER METHODS (duplicated from cache-warming.service for independence)
  // ============================================================================

  private async warmChartOfAccounts(tenantId: string): Promise<void> {
    const key = this.cacheKeyService.chartOfAccounts(tenantId);
    const result = await this.dbPool.query(
      `SELECT * FROM chart_of_accounts WHERE tenant_id = $1 ORDER BY account_code`,
      [tenantId],
    );
    await this.cacheService.set(key, result.rows, CacheTTL.STATIC);
  }

  private async warmCurrentPeriod(tenantId: string): Promise<void> {
    const key = this.cacheKeyService.currentPeriod(tenantId);
    const result = await this.dbPool.query(
      `SELECT * FROM financial_periods
       WHERE tenant_id = $1
       AND period_start_date <= CURRENT_DATE
       AND period_end_date >= CURRENT_DATE
       LIMIT 1`,
      [tenantId],
    );
    if (result.rows.length > 0) {
      await this.cacheService.set(key, result.rows[0], CacheTTL.DASHBOARD);
    }
  }

  private async warmPipelineStages(tenantId: string): Promise<void> {
    const key = this.cacheKeyService.pipelineStages(tenantId);
    const result = await this.dbPool.query(
      `SELECT * FROM crm_pipeline_stages WHERE tenant_id = $1 ORDER BY stage_order`,
      [tenantId],
    );
    await this.cacheService.set(key, result.rows, CacheTTL.STATIC);
  }

  private async warmWorkCenters(tenantId: string): Promise<void> {
    const key = this.cacheKeyService.workCenters(tenantId);
    const result = await this.dbPool.query(
      `SELECT * FROM work_centers WHERE tenant_id = $1 AND is_active = true ORDER BY work_center_code`,
      [tenantId],
    );
    await this.cacheService.set(key, result.rows, CacheTTL.STATIC);
  }

  private async warmInventoryLocations(tenantId: string): Promise<void> {
    const key = this.cacheKeyService.inventoryLocations(tenantId);
    const result = await this.dbPool.query(
      `SELECT * FROM inventory_locations WHERE tenant_id = $1 ORDER BY location_code`,
      [tenantId],
    );
    await this.cacheService.set(key, result.rows, CacheTTL.STATIC);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async discoverTenants(): Promise<string[]> {
    try {
      const result = await this.dbPool.query(
        `SELECT DISTINCT tenant_id FROM tenants WHERE is_active = true`,
      );
      return result.rows.map((row) => row.tenant_id);
    } catch (error) {
      this.logger.error('Failed to discover tenants:', error);
      return [];
    }
  }

  /**
   * Manually trigger warming for a tenant
   */
  async triggerManualWarming(
    tenantId: string,
    warmingType: 'full' | 'predictive' | 'time-sensitive' = 'full',
  ): Promise<WarmingResult[]> {
    if (this.activeWarmings.has(tenantId)) {
      throw new Error(`Warming already in progress for tenant ${tenantId}`);
    }

    this.logger.log(`[${tenantId}] Manual ${warmingType} warming triggered`);

    switch (warmingType) {
      case 'full':
        return await this.warmingService.warmTenant(tenantId);
      case 'predictive':
        await this.runPredictiveWarming(tenantId);
        return [];
      case 'time-sensitive':
        await this.refreshTimeSensitiveData(tenantId);
        return [];
      default:
        throw new Error(`Unknown warming type: ${warmingType}`);
    }
  }

  /**
   * Get warming schedule status
   */
  getScheduleStatus(): {
    enabled: boolean;
    config: ScheduledWarmingConfig;
    activeWarmings: string[];
    nextRuns: { [jobName: string]: Date | null };
  } {
    const nextRuns: { [jobName: string]: Date | null } = {};

    try {
      const jobs = ['nightly-full-warming', 'periodic-refresh', 'peak-hour-prewarm'];
      jobs.forEach((jobName) => {
        try {
          const job = this.schedulerRegistry.getCronJob(jobName);
          nextRuns[jobName] = job.nextDate()?.toJSDate() || null;
        } catch {
          nextRuns[jobName] = null;
        }
      });
    } catch (error) {
      this.logger.warn('Failed to get schedule status:', error);
    }

    return {
      enabled: this.config.enabled,
      config: this.config,
      activeWarmings: Array.from(this.activeWarmings),
      nextRuns,
    };
  }
}
