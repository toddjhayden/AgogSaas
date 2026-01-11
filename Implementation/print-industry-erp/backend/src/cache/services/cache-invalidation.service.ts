/**
 * Cache Invalidation Service
 * REQ-1767924916114-qbjk4: Implement Redis Cache Warming Strategy
 *
 * Provides cache invalidation strategies:
 * - Invalidate by key pattern
 * - Event-driven invalidation (on mutations)
 * - Time-based invalidation (TTL)
 * - Manual invalidation via API
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheKeyService } from './cache-key.service';
import { CacheService } from './cache.service';

export interface InvalidationEvent {
  eventType:
    | 'ACCOUNT_CREATED'
    | 'ACCOUNT_UPDATED'
    | 'PERIOD_CLOSED'
    | 'EXCHANGE_RATE_UPDATED'
    | 'PRICING_RULE_CHANGED'
    | 'WORK_CENTER_UPDATED'
    | 'PIPELINE_STAGE_CHANGED'
    | 'MATERIAL_UPDATED'
    | 'VENDOR_UPDATED'
    | 'CUSTOMER_UPDATED';
  tenantId: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private cacheKeyService: CacheKeyService,
    private cacheService: CacheService,
  ) {}

  /**
   * Handle invalidation event
   * Routes to appropriate invalidation strategy based on event type
   */
  async handleEvent(event: InvalidationEvent): Promise<void> {
    this.logger.log(
      `Handling invalidation event: ${event.eventType} for tenant ${event.tenantId}`,
    );

    try {
      switch (event.eventType) {
        case 'ACCOUNT_CREATED':
        case 'ACCOUNT_UPDATED':
          await this.invalidateChartOfAccounts(event.tenantId);
          break;

        case 'PERIOD_CLOSED':
          await this.invalidateFinancialPeriods(event.tenantId);
          await this.invalidateFinancialReports(event.tenantId);
          break;

        case 'EXCHANGE_RATE_UPDATED':
          await this.invalidateExchangeRates(event.tenantId);
          await this.invalidateFinancialReports(event.tenantId);
          break;

        case 'PRICING_RULE_CHANGED':
          await this.invalidatePricingRules(event.tenantId);
          break;

        case 'WORK_CENTER_UPDATED':
          await this.invalidateWorkCenters(event.tenantId);
          break;

        case 'PIPELINE_STAGE_CHANGED':
          await this.invalidatePipelineStages(event.tenantId);
          break;

        case 'MATERIAL_UPDATED':
          await this.invalidateMaterials(event.tenantId, event.entityId);
          break;

        case 'VENDOR_UPDATED':
          await this.invalidateVendors(event.tenantId, event.entityId);
          break;

        case 'CUSTOMER_UPDATED':
          await this.invalidateCustomers(event.tenantId, event.entityId);
          break;

        default:
          this.logger.warn(`Unknown invalidation event type: ${event.eventType}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle invalidation event ${event.eventType}:`,
        error,
      );
    }
  }

  // ============================================================================
  // FINANCE MODULE INVALIDATION
  // ============================================================================

  /**
   * Invalidate Chart of Accounts cache
   * Triggered when accounts are created/updated
   */
  async invalidateChartOfAccounts(tenantId: string): Promise<void> {
    const key = this.cacheKeyService.chartOfAccounts(tenantId);
    await this.cacheService.del(key);
    this.logger.debug(`[${tenantId}] Invalidated Chart of Accounts`);
  }

  /**
   * Invalidate Financial Periods cache
   * Triggered when periods are closed or created
   */
  async invalidateFinancialPeriods(tenantId: string): Promise<void> {
    const keys = [
      this.cacheKeyService.financialPeriods(tenantId),
      this.cacheKeyService.currentPeriod(tenantId),
    ];
    await this.cacheService.mdel(keys);
    this.logger.debug(`[${tenantId}] Invalidated Financial Periods`);
  }

  /**
   * Invalidate Exchange Rates cache
   * Triggered when exchange rates are updated
   */
  async invalidateExchangeRates(tenantId: string): Promise<void> {
    // Invalidate all exchange rate keys for tenant
    // Pattern: finance:xrate:{tenantId}:*
    const pattern = this.cacheKeyService.pattern('finance', 'xrate', `${tenantId}:*`);
    await this.invalidateByPattern(pattern);
    this.logger.debug(`[${tenantId}] Invalidated Exchange Rates`);
  }

  /**
   * Invalidate Financial Reports cache
   * Triggered when period closes or financial data changes
   */
  async invalidateFinancialReports(tenantId: string): Promise<void> {
    // Invalidate all financial report keys for tenant
    const patterns = [
      this.cacheKeyService.pattern('finance', 'trial_balance', `${tenantId}:*`),
      this.cacheKeyService.pattern('finance', 'pl', `${tenantId}:*`),
      this.cacheKeyService.pattern('finance', 'bs', `${tenantId}:*`),
      this.cacheKeyService.pattern('finance', 'ar_aging', `${tenantId}:*`),
      this.cacheKeyService.pattern('finance', 'ap_aging', `${tenantId}:*`),
      this.cacheKeyService.pattern('finance', 'gl_balances', `${tenantId}:*`),
    ];

    for (const pattern of patterns) {
      await this.invalidateByPattern(pattern);
    }

    this.logger.debug(`[${tenantId}] Invalidated Financial Reports`);
  }

  // ============================================================================
  // CRM MODULE INVALIDATION
  // ============================================================================

  /**
   * Invalidate Pipeline Stages cache
   * Triggered when stages are created/updated/deleted
   */
  async invalidatePipelineStages(tenantId: string): Promise<void> {
    const keys = [
      this.cacheKeyService.pipelineStages(tenantId),
      // Also invalidate pipeline summary which depends on stages
      this.cacheKeyService.pipelineSummary(tenantId),
    ];
    await this.cacheService.mdel(keys);
    this.logger.debug(`[${tenantId}] Invalidated Pipeline Stages`);
  }

  // ============================================================================
  // OPERATIONS MODULE INVALIDATION
  // ============================================================================

  /**
   * Invalidate Work Centers cache
   * Triggered when work centers are created/updated
   */
  async invalidateWorkCenters(tenantId: string): Promise<void> {
    // Invalidate all work center keys for tenant
    const pattern = this.cacheKeyService.pattern('ops', 'workcenter', `${tenantId}:*`);
    await this.invalidateByPattern(pattern);

    // Also invalidate the work centers list
    const listKey = this.cacheKeyService.workCenters(tenantId);
    await this.cacheService.del(listKey);

    this.logger.debug(`[${tenantId}] Invalidated Work Centers`);
  }

  // ============================================================================
  // SALES/MATERIALS MODULE INVALIDATION
  // ============================================================================

  /**
   * Invalidate Materials cache
   * Triggered when materials are created/updated
   */
  async invalidateMaterials(
    tenantId: string,
    materialId?: string,
  ): Promise<void> {
    if (materialId) {
      // Invalidate specific material
      const key = this.cacheKeyService.material(tenantId, materialId);
      await this.cacheService.del(key);
    }

    // Invalidate all material list pages
    const pattern = this.cacheKeyService.pattern('sales', 'materials', `${tenantId}:*`);
    await this.invalidateByPattern(pattern);

    this.logger.debug(
      `[${tenantId}] Invalidated Materials${materialId ? ` (${materialId})` : ''}`,
    );
  }

  /**
   * Invalidate Vendors cache
   * Triggered when vendors are created/updated
   */
  async invalidateVendors(tenantId: string, vendorId?: string): Promise<void> {
    if (vendorId) {
      const key = this.cacheKeyService.vendor(tenantId, vendorId);
      await this.cacheService.del(key);
    }

    const pattern = this.cacheKeyService.pattern('sales', 'vendors', `${tenantId}:*`);
    await this.invalidateByPattern(pattern);

    this.logger.debug(
      `[${tenantId}] Invalidated Vendors${vendorId ? ` (${vendorId})` : ''}`,
    );
  }

  /**
   * Invalidate Customers cache
   * Triggered when customers are created/updated
   */
  async invalidateCustomers(
    tenantId: string,
    customerId?: string,
  ): Promise<void> {
    if (customerId) {
      const key = this.cacheKeyService.customer(tenantId, customerId);
      await this.cacheService.del(key);
    }

    const pattern = this.cacheKeyService.pattern('sales', 'customers', `${tenantId}:*`);
    await this.invalidateByPattern(pattern);

    this.logger.debug(
      `[${tenantId}] Invalidated Customers${customerId ? ` (${customerId})` : ''}`,
    );
  }

  /**
   * Invalidate Pricing Rules cache
   * Triggered when pricing rules are created/updated
   */
  async invalidatePricingRules(tenantId: string): Promise<void> {
    const pattern = this.cacheKeyService.pattern('sales', 'pricing', `${tenantId}:*`);
    await this.invalidateByPattern(pattern);
    this.logger.debug(`[${tenantId}] Invalidated Pricing Rules`);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Invalidate all cache keys matching a pattern
   * Note: This requires Redis SCAN command access via underlying store
   */
  private async invalidateByPattern(pattern: string): Promise<void> {
    try {
      // Get the underlying Redis store
      const store = this.cacheService.getStore().store;

      // Check if store has keys() method (cache-manager-redis-yet supports this)
      if (typeof (store as any).keys === 'function') {
        const keys = await (store as any).keys(pattern);
        if (keys && keys.length > 0) {
          await this.cacheService.mdel(keys);
          this.logger.debug(`Invalidated ${keys.length} keys matching ${pattern}`);
        }
      } else {
        this.logger.warn(
          `Pattern invalidation not supported - store does not implement keys()`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate pattern ${pattern}:`, error);
    }
  }

  /**
   * Invalidate all cache for a tenant
   * Use with caution - invalidates ALL tenant data
   */
  async invalidateTenant(tenantId: string): Promise<void> {
    this.logger.warn(`Invalidating ALL cache for tenant ${tenantId}`);

    // Invalidate all major cache categories
    await Promise.all([
      this.invalidateFinancialReports(tenantId),
      this.invalidateChartOfAccounts(tenantId),
      this.invalidateFinancialPeriods(tenantId),
      this.invalidateExchangeRates(tenantId),
      this.invalidatePipelineStages(tenantId),
      this.invalidateWorkCenters(tenantId),
      this.invalidateMaterials(tenantId),
      this.invalidateVendors(tenantId),
      this.invalidateCustomers(tenantId),
      this.invalidatePricingRules(tenantId),
    ]);

    this.logger.warn(`Tenant ${tenantId} cache invalidation completed`);
  }

  /**
   * Invalidate all cache
   * DANGEROUS - use only for testing or emergency
   */
  async invalidateAll(): Promise<void> {
    this.logger.warn('DANGER: Invalidating ALL cache');
    await this.cacheService.reset();
  }
}
