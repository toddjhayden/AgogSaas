/**
 * Cache Key Service
 * REQ-1767924916114-qbjk4: Implement Redis Cache Warming Strategy
 *
 * Provides consistent cache key generation patterns across the application.
 * Ensures proper tenant isolation and prevents key collisions.
 */

import { Injectable } from '@nestjs/common';

export interface CacheKeyOptions {
  tenantId?: string;
  facilityId?: string;
  userId?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Cache Key Service
 * Generates standardized cache keys with proper namespacing
 */
@Injectable()
export class CacheKeyService {
  /**
   * Generate a cache key with proper namespacing
   * Format: {module}:{entity}:{tenantId}:{...params}
   */
  private generateKey(
    module: string,
    entity: string,
    options: CacheKeyOptions = {},
  ): string {
    const parts: string[] = [module, entity];

    // Always include tenantId for multi-tenant isolation (if provided)
    if (options.tenantId) {
      parts.push(options.tenantId);
    }

    // Add additional parameters in deterministic order
    const additionalKeys = Object.keys(options)
      .filter((k) => k !== 'tenantId')
      .sort();

    for (const key of additionalKeys) {
      const value = options[key];
      if (value !== undefined && value !== null) {
        parts.push(`${key}:${value}`);
      }
    }

    return parts.join(':');
  }

  // ============================================================================
  // FINANCE MODULE CACHE KEYS
  // ============================================================================

  /**
   * Chart of Accounts cache key
   * TTL: 24 hours (rarely changes)
   */
  chartOfAccounts(tenantId: string): string {
    return this.generateKey('finance', 'coa', { tenantId });
  }

  /**
   * Individual account cache key
   * TTL: 24 hours
   */
  account(tenantId: string, accountId: string): string {
    return this.generateKey('finance', 'account', { tenantId, accountId });
  }

  /**
   * Financial periods cache key
   * TTL: 24 hours (changes monthly)
   */
  financialPeriods(tenantId: string): string {
    return this.generateKey('finance', 'periods', { tenantId });
  }

  /**
   * Current period cache key
   * TTL: 1 hour (frequently accessed, but changes rarely)
   */
  currentPeriod(tenantId: string): string {
    return this.generateKey('finance', 'current_period', { tenantId });
  }

  /**
   * Exchange rate cache key
   * TTL: 24 hours (updated daily or on-demand)
   */
  exchangeRate(
    tenantId: string,
    fromCurrency: string,
    toCurrency: string,
    date?: string,
  ): string {
    return this.generateKey('finance', 'xrate', {
      tenantId,
      from: fromCurrency,
      to: toCurrency,
      date: date || 'latest',
    });
  }

  /**
   * Trial balance cache key
   * TTL: 6-12 hours (recalculated post-period close)
   */
  trialBalance(
    tenantId: string,
    year: number,
    month: number,
    currency?: string,
  ): string {
    return this.generateKey('finance', 'trial_balance', {
      tenantId,
      year: year.toString(),
      month: month.toString(),
      currency: currency || 'default',
    });
  }

  /**
   * Profit & Loss cache key
   * TTL: 6-12 hours
   */
  profitAndLoss(
    tenantId: string,
    startDate: string,
    endDate: string,
    currency?: string,
  ): string {
    return this.generateKey('finance', 'pl', {
      tenantId,
      start: startDate,
      end: endDate,
      currency: currency || 'default',
    });
  }

  /**
   * Balance sheet cache key
   * TTL: 6-12 hours
   */
  balanceSheet(tenantId: string, asOfDate: string, currency?: string): string {
    return this.generateKey('finance', 'bs', {
      tenantId,
      asOf: asOfDate,
      currency: currency || 'default',
    });
  }

  /**
   * AR Aging cache key
   * TTL: 6 hours
   */
  arAging(tenantId: string, asOfDate: string, currency?: string): string {
    return this.generateKey('finance', 'ar_aging', {
      tenantId,
      asOf: asOfDate,
      currency: currency || 'default',
    });
  }

  /**
   * AP Aging cache key
   * TTL: 6 hours
   */
  apAging(tenantId: string, asOfDate: string, currency?: string): string {
    return this.generateKey('finance', 'ap_aging', {
      tenantId,
      asOf: asOfDate,
      currency: currency || 'default',
    });
  }

  /**
   * GL Balances cache key
   * TTL: 12 hours
   */
  glBalances(
    tenantId: string,
    year: number,
    month: number,
    currency?: string,
  ): string {
    return this.generateKey('finance', 'gl_balances', {
      tenantId,
      year: year.toString(),
      month: month.toString(),
      currency: currency || 'default',
    });
  }

  // ============================================================================
  // CRM MODULE CACHE KEYS
  // ============================================================================

  /**
   * Pipeline stages cache key
   * TTL: 24 hours (rarely changes)
   */
  pipelineStages(tenantId: string): string {
    return this.generateKey('crm', 'stages', { tenantId });
  }

  /**
   * Pipeline summary cache key
   * TTL: 1 hour (dashboard KPI)
   */
  pipelineSummary(tenantId: string, userId?: string): string {
    return this.generateKey('crm', 'pipeline_summary', { tenantId, userId });
  }

  /**
   * Activity summary cache key
   * TTL: 1 hour
   */
  activitySummary(
    tenantId: string,
    userId: string,
    startDate: string,
    endDate: string,
  ): string {
    return this.generateKey('crm', 'activity_summary', {
      tenantId,
      userId,
      start: startDate,
      end: endDate,
    });
  }

  // ============================================================================
  // OPERATIONS MODULE CACHE KEYS
  // ============================================================================

  /**
   * Work centers cache key
   * TTL: 24 hours
   */
  workCenters(tenantId: string, facilityId?: string): string {
    return this.generateKey('ops', 'workcenters', { tenantId, facilityId });
  }

  /**
   * Individual work center cache key
   * TTL: 24 hours
   */
  workCenter(tenantId: string, workCenterId: string): string {
    return this.generateKey('ops', 'workcenter', { tenantId, workCenterId });
  }

  /**
   * Production orders cache key
   * TTL: 5 minutes (operational data)
   */
  productionOrders(
    tenantId: string,
    facilityId?: string,
    status?: string,
  ): string {
    return this.generateKey('ops', 'prod_orders', {
      tenantId,
      facilityId,
      status,
    });
  }

  /**
   * Equipment health scores cache key
   * TTL: 10 minutes (real-time monitoring with acceptable staleness)
   */
  equipmentHealth(
    tenantId: string,
    facilityId?: string,
    status?: string,
  ): string {
    return this.generateKey('ops', 'equipment_health', {
      tenantId,
      facilityId,
      status,
    });
  }

  // ============================================================================
  // SALES/MATERIALS MODULE CACHE KEYS
  // ============================================================================

  /**
   * Materials/products catalog cache key
   * TTL: 12 hours (pagination supported)
   */
  materials(tenantId: string, page: number = 1, limit: number = 100): string {
    return this.generateKey('sales', 'materials', {
      tenantId,
      page: page.toString(),
      limit: limit.toString(),
    });
  }

  /**
   * Individual material cache key
   * TTL: 24 hours
   */
  material(tenantId: string, materialId: string): string {
    return this.generateKey('sales', 'material', { tenantId, materialId });
  }

  /**
   * Material by code cache key (alternate lookup)
   * TTL: 24 hours
   */
  materialByCode(tenantId: string, code: string): string {
    return this.generateKey('sales', 'material_code', { tenantId, code });
  }

  /**
   * Vendors cache key
   * TTL: 12 hours
   */
  vendors(tenantId: string, page: number = 1, limit: number = 100): string {
    return this.generateKey('sales', 'vendors', {
      tenantId,
      page: page.toString(),
      limit: limit.toString(),
    });
  }

  /**
   * Individual vendor cache key
   * TTL: 24 hours
   */
  vendor(tenantId: string, vendorId: string): string {
    return this.generateKey('sales', 'vendor', { tenantId, vendorId });
  }

  /**
   * Customers cache key
   * TTL: 12 hours
   */
  customers(tenantId: string, page: number = 1, limit: number = 100): string {
    return this.generateKey('sales', 'customers', {
      tenantId,
      page: page.toString(),
      limit: limit.toString(),
    });
  }

  /**
   * Individual customer cache key
   * TTL: 24 hours
   */
  customer(tenantId: string, customerId: string): string {
    return this.generateKey('sales', 'customer', { tenantId, customerId });
  }

  /**
   * Pricing rules cache key
   * TTL: 6 hours (changes during promotions)
   */
  pricingRules(tenantId: string, effectiveDate?: string): string {
    return this.generateKey('sales', 'pricing', {
      tenantId,
      effective: effectiveDate || 'current',
    });
  }

  // ============================================================================
  // WMS MODULE CACHE KEYS
  // ============================================================================

  /**
   * Inventory locations cache key
   * TTL: 24 hours
   */
  inventoryLocations(tenantId: string, facilityId?: string): string {
    return this.generateKey('wms', 'locations', { tenantId, facilityId });
  }

  /**
   * Individual inventory location cache key
   * TTL: 24 hours
   */
  inventoryLocation(tenantId: string, locationId: string): string {
    return this.generateKey('wms', 'location', { tenantId, locationId });
  }

  /**
   * Kit definitions cache key
   * TTL: 12 hours
   */
  kitDefinitions(tenantId: string, facilityId?: string): string {
    return this.generateKey('wms', 'kits', { tenantId, facilityId });
  }

  /**
   * Inventory summary cache key
   * TTL: 5 minutes (dashboard widget)
   */
  inventorySummary(tenantId: string, facilityId?: string): string {
    return this.generateKey('wms', 'inv_summary', { tenantId, facilityId });
  }

  /**
   * Bin utilization cache key
   * TTL: 10 minutes (pre-computed metrics)
   */
  binUtilization(tenantId: string, facilityId?: string): string {
    return this.generateKey('wms', 'bin_util', { tenantId, facilityId });
  }

  // ============================================================================
  // QUALITY MODULE CACHE KEYS
  // ============================================================================

  /**
   * Quality metrics trends cache key
   * TTL: 1 hour
   */
  qualityMetricsTrends(limit: number = 30): string {
    return this.generateKey('quality', 'trends', {
      limit: limit.toString(),
    });
  }

  // ============================================================================
  // TENANT MODULE CACHE KEYS
  // ============================================================================

  /**
   * Tenant info cache key
   * TTL: 1 hour (configuration data)
   */
  tenant(tenantId: string): string {
    return this.generateKey('tenant', 'info', { tenantId });
  }

  /**
   * User permissions cache key
   * TTL: 15 minutes (authorization data)
   */
  userPermissions(tenantId: string, userId: string): string {
    return this.generateKey('tenant', 'permissions', { tenantId, userId });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate a wildcard pattern for cache invalidation
   * Example: invalidatePattern('finance:coa:*') invalidates all COA caches
   */
  pattern(module: string, entity: string, pattern: string = '*'): string {
    return `${module}:${entity}:${pattern}`;
  }

  /**
   * Generate a custom cache key
   */
  custom(module: string, entity: string, options: CacheKeyOptions = {}): string {
    return this.generateKey(module, entity, options);
  }
}
