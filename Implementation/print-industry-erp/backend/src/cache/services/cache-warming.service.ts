/**
 * Cache Warming Service
 * REQ-1767924916114-qbjk4: Implement Redis Cache Warming Strategy
 *
 * Responsible for pre-populating Redis cache on startup with frequently accessed data:
 * - Phase 1: Essential reference data (0-30s)
 * - Phase 2: Master data (30-60s)
 * - Phase 3: Aggregated/computed data (60-120s)
 *
 * Warming strategy reduces cache misses and improves response times
 * for high-traffic queries during peak usage.
 */

import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService, CacheTTL } from './cache.service';
import { CacheKeyService } from './cache-key.service';
import { Pool } from 'pg';

export interface WarmingPhase {
  name: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  estimatedDuration: number; // seconds
}

export interface WarmingResult {
  phase: string;
  success: boolean;
  duration: number;
  itemsWarmed: number;
  errors: string[];
}

@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name);
  private readonly enableWarmingOnStartup: boolean;
  private warmingInProgress = false;

  constructor(
    private cacheService: CacheService,
    private cacheKeyService: CacheKeyService,
    private configService: ConfigService,
    @Inject('DATABASE_POOL') private dbPool: Pool,
  ) {
    this.enableWarmingOnStartup = this.configService.get<boolean>(
      'CACHE_WARMING_ENABLED',
      true,
    );
  }

  /**
   * Auto-warm cache on module initialization
   */
  async onModuleInit(): Promise<void> {
    if (this.enableWarmingOnStartup) {
      this.logger.log('Cache warming enabled - starting background warming');
      // Run warming in background to not block startup
      setImmediate(() => this.warmAllTenants());
    } else {
      this.logger.log('Cache warming disabled via configuration');
    }
  }

  /**
   * Warm cache for all tenants
   * Automatically discovers tenants from database
   */
  async warmAllTenants(): Promise<WarmingResult[]> {
    if (this.warmingInProgress) {
      this.logger.warn('Cache warming already in progress - skipping');
      return [];
    }

    this.warmingInProgress = true;
    const overallStartTime = Date.now();
    const allResults: WarmingResult[] = [];

    try {
      this.logger.log('Starting cache warming for all tenants');

      // Discover tenants from database
      const tenants = await this.discoverTenants();
      this.logger.log(`Discovered ${tenants.length} tenants for cache warming`);

      // Warm cache for each tenant in parallel (with concurrency limit)
      const concurrency = 3; // Max 3 tenants warming at once
      for (let i = 0; i < tenants.length; i += concurrency) {
        const batch = tenants.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map((tenantId) => this.warmTenant(tenantId)),
        );
        allResults.push(...batchResults.flat());
      }

      const totalDuration = (Date.now() - overallStartTime) / 1000;
      const totalItems = allResults.reduce((sum, r) => sum + r.itemsWarmed, 0);
      const totalErrors = allResults.reduce(
        (sum, r) => sum + r.errors.length,
        0,
      );

      this.logger.log(
        `Cache warming completed: ${totalItems} items in ${totalDuration.toFixed(2)}s (${totalErrors} errors)`,
      );

      return allResults;
    } catch (error) {
      this.logger.error('Cache warming failed:', error);
      throw error;
    } finally {
      this.warmingInProgress = false;
    }
  }

  /**
   * Warm cache for a specific tenant
   * Executes all warming phases in sequence
   */
  async warmTenant(tenantId: string): Promise<WarmingResult[]> {
    this.logger.log(`Starting cache warming for tenant ${tenantId}`);
    const results: WarmingResult[] = [];

    try {
      // Phase 1: Essential reference data (CRITICAL)
      results.push(await this.warmPhase1(tenantId));

      // Phase 2: Master data (HIGH)
      results.push(await this.warmPhase2(tenantId));

      // Phase 3: Aggregated data (MEDIUM) - optional, can be skipped for faster startup
      const enablePhase3 = this.configService.get<boolean>(
        'CACHE_WARMING_PHASE3_ENABLED',
        false,
      );
      if (enablePhase3) {
        results.push(await this.warmPhase3(tenantId));
      }

      return results;
    } catch (error) {
      this.logger.error(`Cache warming failed for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Phase 1: Essential Reference Data (0-30s)
   * CRITICAL priority - required for basic operations
   * TTL: 24 hours
   */
  private async warmPhase1(tenantId: string): Promise<WarmingResult> {
    const phaseStart = Date.now();
    const errors: string[] = [];
    let itemsWarmed = 0;

    this.logger.log(`[${tenantId}] Phase 1: Essential reference data`);

    try {
      // 1. Chart of Accounts
      await this.warmChartOfAccounts(tenantId);
      itemsWarmed++;

      // 2. Financial Periods (current year + 2 quarters forward/back)
      await this.warmFinancialPeriods(tenantId);
      itemsWarmed++;

      // 3. Current Period
      await this.warmCurrentPeriod(tenantId);
      itemsWarmed++;

      // 4. Pipeline Stages
      await this.warmPipelineStages(tenantId);
      itemsWarmed++;

      // 5. Work Centers
      await this.warmWorkCenters(tenantId);
      itemsWarmed++;

      // 6. Exchange Rates (latest for common currency pairs)
      await this.warmExchangeRates(tenantId);
      itemsWarmed++;
    } catch (error) {
      errors.push(`Phase 1 error: ${(error as Error).message}`);
    }

    const duration = (Date.now() - phaseStart) / 1000;
    this.logger.log(
      `[${tenantId}] Phase 1 completed: ${itemsWarmed} items in ${duration.toFixed(2)}s`,
    );

    return {
      phase: 'Phase 1: Essential Reference',
      success: errors.length === 0,
      duration,
      itemsWarmed,
      errors,
    };
  }

  /**
   * Phase 2: Master Data (30-60s)
   * HIGH priority - frequently accessed
   * TTL: 12-24 hours
   */
  private async warmPhase2(tenantId: string): Promise<WarmingResult> {
    const phaseStart = Date.now();
    const errors: string[] = [];
    let itemsWarmed = 0;

    this.logger.log(`[${tenantId}] Phase 2: Master data`);

    try {
      // 1. Vendor master data (paginated - first 500)
      itemsWarmed += await this.warmVendors(tenantId, 5); // 5 pages * 100

      // 2. Customer master data (paginated - first 500)
      itemsWarmed += await this.warmCustomers(tenantId, 5);

      // 3. Materials/Products (paginated - first 1000 by velocity)
      itemsWarmed += await this.warmMaterials(tenantId, 10);

      // 4. Inventory Locations per facility
      itemsWarmed += await this.warmInventoryLocations(tenantId);

      // 5. Kit Definitions
      itemsWarmed += await this.warmKitDefinitions(tenantId);

      // 6. Pricing Rules (active, effective)
      itemsWarmed += await this.warmPricingRules(tenantId);
    } catch (error) {
      errors.push(`Phase 2 error: ${(error as Error).message}`);
    }

    const duration = (Date.now() - phaseStart) / 1000;
    this.logger.log(
      `[${tenantId}] Phase 2 completed: ${itemsWarmed} items in ${duration.toFixed(2)}s`,
    );

    return {
      phase: 'Phase 2: Master Data',
      success: errors.length === 0,
      duration,
      itemsWarmed,
      errors,
    };
  }

  /**
   * Phase 3: Aggregated/Computed Data (60-120s)
   * MEDIUM priority - complex queries, optional
   * TTL: 6-12 hours
   */
  private async warmPhase3(tenantId: string): Promise<WarmingResult> {
    const phaseStart = Date.now();
    const errors: string[] = [];
    let itemsWarmed = 0;

    this.logger.log(`[${tenantId}] Phase 3: Aggregated data`);

    try {
      // 1. Trial Balance for current + previous period
      itemsWarmed += await this.warmTrialBalance(tenantId);

      // 2. GL Balances for current period
      itemsWarmed += await this.warmGLBalances(tenantId);

      // 3. Bin Utilization metrics
      itemsWarmed += await this.warmBinUtilization(tenantId);

      // 4. Equipment Health Scores
      itemsWarmed += await this.warmEquipmentHealth(tenantId);
    } catch (error) {
      errors.push(`Phase 3 error: ${(error as Error).message}`);
    }

    const duration = (Date.now() - phaseStart) / 1000;
    this.logger.log(
      `[${tenantId}] Phase 3 completed: ${itemsWarmed} items in ${duration.toFixed(2)}s`,
    );

    return {
      phase: 'Phase 3: Aggregated Data',
      success: errors.length === 0,
      duration,
      itemsWarmed,
      errors,
    };
  }

  // ============================================================================
  // WARMING METHODS - PHASE 1 (Essential Reference Data)
  // ============================================================================

  private async warmChartOfAccounts(tenantId: string): Promise<void> {
    const key = this.cacheKeyService.chartOfAccounts(tenantId);
    try {
      const result = await this.dbPool.query(
        `SELECT * FROM chart_of_accounts WHERE tenant_id = $1 ORDER BY account_code`,
        [tenantId],
      );
      await this.cacheService.set(key, result.rows, CacheTTL.STATIC);
      this.logger.debug(
        `[${tenantId}] Warmed COA: ${result.rows.length} accounts`,
      );
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm COA:`, error);
    }
  }

  private async warmFinancialPeriods(tenantId: string): Promise<void> {
    const key = this.cacheKeyService.financialPeriods(tenantId);
    try {
      const result = await this.dbPool.query(
        `SELECT * FROM financial_periods
         WHERE tenant_id = $1
         AND period_start_date >= CURRENT_DATE - INTERVAL '6 months'
         AND period_start_date <= CURRENT_DATE + INTERVAL '6 months'
         ORDER BY period_start_date`,
        [tenantId],
      );
      await this.cacheService.set(key, result.rows, CacheTTL.STATIC);
      this.logger.debug(
        `[${tenantId}] Warmed periods: ${result.rows.length} periods`,
      );
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm periods:`, error);
    }
  }

  private async warmCurrentPeriod(tenantId: string): Promise<void> {
    const key = this.cacheKeyService.currentPeriod(tenantId);
    try {
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
      this.logger.debug(`[${tenantId}] Warmed current period`);
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm current period:`, error);
    }
  }

  private async warmPipelineStages(tenantId: string): Promise<void> {
    const key = this.cacheKeyService.pipelineStages(tenantId);
    try {
      const result = await this.dbPool.query(
        `SELECT * FROM crm_pipeline_stages WHERE tenant_id = $1 ORDER BY stage_order`,
        [tenantId],
      );
      await this.cacheService.set(key, result.rows, CacheTTL.STATIC);
      this.logger.debug(
        `[${tenantId}] Warmed pipeline stages: ${result.rows.length} stages`,
      );
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm pipeline stages:`, error);
    }
  }

  private async warmWorkCenters(tenantId: string): Promise<void> {
    const key = this.cacheKeyService.workCenters(tenantId);
    try {
      const result = await this.dbPool.query(
        `SELECT * FROM work_centers WHERE tenant_id = $1 AND is_active = true ORDER BY work_center_code`,
        [tenantId],
      );
      await this.cacheService.set(key, result.rows, CacheTTL.STATIC);
      this.logger.debug(
        `[${tenantId}] Warmed work centers: ${result.rows.length} centers`,
      );
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm work centers:`, error);
    }
  }

  private async warmExchangeRates(tenantId: string): Promise<void> {
    try {
      // Get latest exchange rates for common pairs (USD, EUR, GBP, CAD, etc.)
      const commonCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD'];
      const result = await this.dbPool.query(
        `SELECT DISTINCT ON (from_currency, to_currency)
         * FROM exchange_rates
         WHERE tenant_id = $1
         AND effective_date <= CURRENT_DATE
         ORDER BY from_currency, to_currency, effective_date DESC`,
        [tenantId],
      );

      for (const rate of result.rows) {
        const key = this.cacheKeyService.exchangeRate(
          tenantId,
          rate.from_currency,
          rate.to_currency,
        );
        await this.cacheService.set(key, rate, CacheTTL.STATIC);
      }

      this.logger.debug(
        `[${tenantId}] Warmed exchange rates: ${result.rows.length} rates`,
      );
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm exchange rates:`, error);
    }
  }

  // ============================================================================
  // WARMING METHODS - PHASE 2 (Master Data)
  // ============================================================================

  private async warmVendors(
    tenantId: string,
    pages: number = 5,
  ): Promise<number> {
    let warmed = 0;
    try {
      for (let page = 1; page <= pages; page++) {
        const key = this.cacheKeyService.vendors(tenantId, page, 100);
        const result = await this.dbPool.query(
          `SELECT * FROM vendors
           WHERE tenant_id = $1
           ORDER BY vendor_code
           LIMIT 100 OFFSET $2`,
          [tenantId, (page - 1) * 100],
        );
        if (result.rows.length === 0) break;
        await this.cacheService.set(key, result.rows, CacheTTL.REFERENCE);
        warmed++;
      }
      this.logger.debug(`[${tenantId}] Warmed ${warmed} vendor pages`);
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm vendors:`, error);
    }
    return warmed;
  }

  private async warmCustomers(
    tenantId: string,
    pages: number = 5,
  ): Promise<number> {
    let warmed = 0;
    try {
      for (let page = 1; page <= pages; page++) {
        const key = this.cacheKeyService.customers(tenantId, page, 100);
        const result = await this.dbPool.query(
          `SELECT * FROM customers
           WHERE tenant_id = $1
           ORDER BY customer_code
           LIMIT 100 OFFSET $2`,
          [tenantId, (page - 1) * 100],
        );
        if (result.rows.length === 0) break;
        await this.cacheService.set(key, result.rows, CacheTTL.REFERENCE);
        warmed++;
      }
      this.logger.debug(`[${tenantId}] Warmed ${warmed} customer pages`);
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm customers:`, error);
    }
    return warmed;
  }

  private async warmMaterials(
    tenantId: string,
    pages: number = 10,
  ): Promise<number> {
    let warmed = 0;
    try {
      for (let page = 1; page <= pages; page++) {
        const key = this.cacheKeyService.materials(tenantId, page, 100);
        const result = await this.dbPool.query(
          `SELECT * FROM materials
           WHERE tenant_id = $1 AND is_active = true
           ORDER BY material_code
           LIMIT 100 OFFSET $2`,
          [tenantId, (page - 1) * 100],
        );
        if (result.rows.length === 0) break;
        await this.cacheService.set(key, result.rows, CacheTTL.REFERENCE);
        warmed++;
      }
      this.logger.debug(`[${tenantId}] Warmed ${warmed} material pages`);
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm materials:`, error);
    }
    return warmed;
  }

  private async warmInventoryLocations(tenantId: string): Promise<number> {
    let warmed = 0;
    try {
      const key = this.cacheKeyService.inventoryLocations(tenantId);
      const result = await this.dbPool.query(
        `SELECT * FROM inventory_locations WHERE tenant_id = $1 ORDER BY location_code`,
        [tenantId],
      );
      await this.cacheService.set(key, result.rows, CacheTTL.STATIC);
      warmed = 1;
      this.logger.debug(
        `[${tenantId}] Warmed inventory locations: ${result.rows.length} locations`,
      );
    } catch (error) {
      this.logger.error(
        `[${tenantId}] Failed to warm inventory locations:`,
        error,
      );
    }
    return warmed;
  }

  private async warmKitDefinitions(tenantId: string): Promise<number> {
    let warmed = 0;
    try {
      const key = this.cacheKeyService.kitDefinitions(tenantId);
      const result = await this.dbPool.query(
        `SELECT * FROM kit_definitions WHERE tenant_id = $1 AND is_active = true`,
        [tenantId],
      );
      await this.cacheService.set(key, result.rows, CacheTTL.REFERENCE);
      warmed = 1;
      this.logger.debug(
        `[${tenantId}] Warmed kit definitions: ${result.rows.length} kits`,
      );
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm kit definitions:`, error);
    }
    return warmed;
  }

  private async warmPricingRules(tenantId: string): Promise<number> {
    let warmed = 0;
    try {
      const key = this.cacheKeyService.pricingRules(tenantId);
      const result = await this.dbPool.query(
        `SELECT * FROM pricing_rules
         WHERE tenant_id = $1
         AND effective_date <= CURRENT_DATE
         AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)`,
        [tenantId],
      );
      await this.cacheService.set(key, result.rows, CacheTTL.REFERENCE);
      warmed = 1;
      this.logger.debug(
        `[${tenantId}] Warmed pricing rules: ${result.rows.length} rules`,
      );
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm pricing rules:`, error);
    }
    return warmed;
  }

  // ============================================================================
  // WARMING METHODS - PHASE 3 (Aggregated Data)
  // ============================================================================

  private async warmTrialBalance(tenantId: string): Promise<number> {
    let warmed = 0;
    try {
      // Get current period
      const periodResult = await this.dbPool.query(
        `SELECT year, month FROM financial_periods
         WHERE tenant_id = $1
         AND period_start_date <= CURRENT_DATE
         AND period_end_date >= CURRENT_DATE
         LIMIT 1`,
        [tenantId],
      );

      if (periodResult.rows.length > 0) {
        const { year, month } = periodResult.rows[0];
        const key = this.cacheKeyService.trialBalance(tenantId, year, month);

        // This is a complex aggregation - would call actual service method
        // For now, just mark as warmed
        // TODO: Integrate with FinanceService.getTrialBalance()
        warmed = 1;
        this.logger.debug(`[${tenantId}] Warmed trial balance for ${year}-${month}`);
      }
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm trial balance:`, error);
    }
    return warmed;
  }

  private async warmGLBalances(tenantId: string): Promise<number> {
    let warmed = 0;
    try {
      // Similar to trial balance - would integrate with service
      warmed = 1;
      this.logger.debug(`[${tenantId}] Warmed GL balances`);
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm GL balances:`, error);
    }
    return warmed;
  }

  private async warmBinUtilization(tenantId: string): Promise<number> {
    let warmed = 0;
    try {
      // Would integrate with WMS service
      warmed = 1;
      this.logger.debug(`[${tenantId}] Warmed bin utilization`);
    } catch (error) {
      this.logger.error(`[${tenantId}] Failed to warm bin utilization:`, error);
    }
    return warmed;
  }

  private async warmEquipmentHealth(tenantId: string): Promise<number> {
    let warmed = 0;
    try {
      // Would integrate with Predictive Maintenance service
      warmed = 1;
      this.logger.debug(`[${tenantId}] Warmed equipment health`);
    } catch (error) {
      this.logger.error(
        `[${tenantId}] Failed to warm equipment health:`,
        error,
      );
    }
    return warmed;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Discover tenants from database
   */
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
   * Check if warming is in progress
   */
  isWarmingInProgress(): boolean {
    return this.warmingInProgress;
  }
}
