import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * Metrics Service
 *
 * Collects and exposes Prometheus metrics for:
 * - HTTP requests (duration, count, status codes)
 * - GraphQL operations (query/mutation performance)
 * - Database queries (duration, connection pool)
 * - Business metrics (production runs, material utilization, orders)
 * - Security metrics (login attempts, unauthorized access)
 * - Edge metrics (sync status, facility health)
 */
@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  // HTTP Metrics
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestTotal: Counter;

  // GraphQL Metrics
  public readonly graphqlQueryDuration: Histogram;
  public readonly graphqlQueryTotal: Counter;
  public readonly graphqlMutationTotal: Counter;

  // Database Metrics
  public readonly dbQueryDuration: Histogram;
  public readonly dbConnectionPoolSize: Gauge;
  public readonly dbConnectionPoolMax: Gauge;

  // Business Metrics
  public readonly activeProductionRuns: Gauge;
  public readonly materialUtilization: Gauge;
  public readonly ordersCreated: Counter;
  public readonly ordersCompleted: Counter;
  public readonly marketplaceJobsPosted: Counter;
  public readonly marketplaceBidsSubmitted: Counter;
  public readonly marketplaceJobsCompleted: Counter;
  public readonly revenueTotal: Counter;

  // Security Metrics
  public readonly authFailedLoginAttempts: Counter;
  public readonly authLoginSuccess: Counter;
  public readonly authUnauthorizedAccess: Counter;
  public readonly vaultAccess: Counter;
  public readonly chainOfCustodyEvents: Counter;

  // Edge Metrics
  public readonly edgeLastSyncTimestamp: Gauge;
  public readonly productionEventsCaptured: Counter;
  public readonly overallEquipmentEffectiveness: Gauge;
  public readonly productionItemsCompleted: Counter;

  // WebSocket Metrics
  public readonly websocketConnectionsActive: Gauge;
  public readonly activeUsersGauge: Gauge;

  constructor() {
    // Create registry
    this.registry = new Registry();

    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register: this.registry, prefix: 'agogsaas_' });

    // ========================================================================
    // HTTP Metrics
    // ========================================================================

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // ========================================================================
    // GraphQL Metrics
    // ========================================================================

    this.graphqlQueryDuration = new Histogram({
      name: 'graphql_query_duration_seconds',
      help: 'Duration of GraphQL queries in seconds',
      labelNames: ['operation_name', 'operation_type'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.graphqlQueryTotal = new Counter({
      name: 'graphql_query_total',
      help: 'Total number of GraphQL queries',
      labelNames: ['operation_name', 'status'],
      registers: [this.registry],
    });

    this.graphqlMutationTotal = new Counter({
      name: 'graphql_mutation_total',
      help: 'Total number of GraphQL mutations',
      labelNames: ['operation_name', 'status'],
      registers: [this.registry],
    });

    // ========================================================================
    // Database Metrics
    // ========================================================================

    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.dbConnectionPoolSize = new Gauge({
      name: 'db_connection_pool_size',
      help: 'Current number of database connections in pool',
      registers: [this.registry],
    });

    this.dbConnectionPoolMax = new Gauge({
      name: 'db_connection_pool_max',
      help: 'Maximum number of database connections allowed',
      registers: [this.registry],
    });

    // ========================================================================
    // Business Metrics
    // ========================================================================

    this.activeProductionRuns = new Gauge({
      name: 'active_production_runs',
      help: 'Number of currently active production runs',
      labelNames: ['facility_id', 'facility_name', 'tenant_id'],
      registers: [this.registry],
    });

    this.materialUtilization = new Gauge({
      name: 'material_utilization_percentage',
      help: 'Material utilization percentage (0-100)',
      labelNames: ['facility_id', 'facility_name'],
      registers: [this.registry],
    });

    this.ordersCreated = new Counter({
      name: 'orders_created_total',
      help: 'Total number of orders created',
      labelNames: ['tenant_id', 'tenant_name'],
      registers: [this.registry],
    });

    this.ordersCompleted = new Counter({
      name: 'orders_fulfilled_total',
      help: 'Total number of orders fulfilled',
      labelNames: ['tenant_id', 'tenant_name'],
      registers: [this.registry],
    });

    this.marketplaceJobsPosted = new Counter({
      name: 'marketplace_jobs_posted_total',
      help: 'Total number of marketplace jobs posted',
      registers: [this.registry],
    });

    this.marketplaceBidsSubmitted = new Counter({
      name: 'marketplace_bids_submitted_total',
      help: 'Total number of marketplace bids submitted',
      registers: [this.registry],
    });

    this.marketplaceJobsCompleted = new Counter({
      name: 'marketplace_jobs_completed_total',
      help: 'Total number of marketplace jobs completed',
      registers: [this.registry],
    });

    this.revenueTotal = new Counter({
      name: 'revenue_total',
      help: 'Total revenue in USD',
      labelNames: ['tenant_id', 'tenant_name'],
      registers: [this.registry],
    });

    // ========================================================================
    // Security Metrics
    // ========================================================================

    this.authFailedLoginAttempts = new Counter({
      name: 'auth_failed_login_attempts_total',
      help: 'Total number of failed login attempts',
      labelNames: ['username', 'ip_address'],
      registers: [this.registry],
    });

    this.authLoginSuccess = new Counter({
      name: 'auth_login_success_total',
      help: 'Total number of successful logins',
      labelNames: ['username', 'auth_method'],
      registers: [this.registry],
    });

    this.authUnauthorizedAccess = new Counter({
      name: 'auth_unauthorized_access_total',
      help: 'Total number of unauthorized access attempts',
      labelNames: ['username', 'resource', 'security_zone'],
      registers: [this.registry],
    });

    this.vaultAccess = new Counter({
      name: 'vault_access_total',
      help: 'Total number of vault accesses',
      labelNames: ['username', 'vault_type'],
      registers: [this.registry],
    });

    this.chainOfCustodyEvents = new Counter({
      name: 'chain_of_custody_events_total',
      help: 'Total number of chain of custody events',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    // ========================================================================
    // Edge Metrics
    // ========================================================================

    this.edgeLastSyncTimestamp = new Gauge({
      name: 'edge_last_sync_timestamp',
      help: 'Unix timestamp of last successful sync from edge facility',
      labelNames: ['facility_id', 'facility_name', 'tenant_id'],
      registers: [this.registry],
    });

    this.productionEventsCaptured = new Counter({
      name: 'production_events_captured_total',
      help: 'Total number of production events captured',
      labelNames: ['facility_id', 'facility_name', 'event_type'],
      registers: [this.registry],
    });

    this.overallEquipmentEffectiveness = new Gauge({
      name: 'overall_equipment_effectiveness',
      help: 'Overall Equipment Effectiveness (OEE) percentage (0-100)',
      labelNames: ['facility_id', 'facility_name'],
      registers: [this.registry],
    });

    this.productionItemsCompleted = new Counter({
      name: 'production_items_completed_total',
      help: 'Total number of production items completed',
      labelNames: ['facility_id', 'facility_name'],
      registers: [this.registry],
    });

    // ========================================================================
    // WebSocket Metrics
    // ========================================================================

    this.websocketConnectionsActive = new Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      registers: [this.registry],
    });

    this.activeUsersGauge = new Gauge({
      name: 'active_users_gauge',
      help: 'Number of currently active users',
      registers: [this.registry],
    });
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get registry (for advanced use cases)
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Track HTTP request
   */
  trackHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    this.httpRequestTotal.inc({ method, route, status_code: statusCode });
  }

  /**
   * Track GraphQL operation
   */
  trackGraphQLOperation(
    operationName: string,
    operationType: 'query' | 'mutation',
    status: 'success' | 'failure',
    duration: number
  ) {
    this.graphqlQueryDuration.observe({ operation_name: operationName, operation_type: operationType }, duration);

    if (operationType === 'query') {
      this.graphqlQueryTotal.inc({ operation_name: operationName, status });
    } else {
      this.graphqlMutationTotal.inc({ operation_name: operationName, status });
    }
  }

  /**
   * Track database query
   */
  trackDatabaseQuery(queryType: string, duration: number) {
    this.dbQueryDuration.observe({ query_type: queryType }, duration);
  }

  /**
   * Update database connection pool size
   */
  updateConnectionPoolSize(size: number, max: number) {
    this.dbConnectionPoolSize.set(size);
    this.dbConnectionPoolMax.set(max);
  }

  /**
   * Update active production runs
   */
  updateActiveProductionRuns(facilityId: string, facilityName: string, tenantId: string, count: number) {
    this.activeProductionRuns.set({ facility_id: facilityId, facility_name: facilityName, tenant_id: tenantId }, count);
  }

  /**
   * Update material utilization
   */
  updateMaterialUtilization(facilityId: string, facilityName: string, percentage: number) {
    this.materialUtilization.set({ facility_id: facilityId, facility_name: facilityName }, percentage);
  }

  /**
   * Record order created
   */
  recordOrderCreated(tenantId: string, tenantName: string) {
    this.ordersCreated.inc({ tenant_id: tenantId, tenant_name: tenantName });
  }

  /**
   * Record order fulfilled
   */
  recordOrderFulfilled(tenantId: string, tenantName: string) {
    this.ordersCompleted.inc({ tenant_id: tenantId, tenant_name: tenantName });
  }

  /**
   * Record revenue
   */
  recordRevenue(tenantId: string, tenantName: string, amount: number) {
    this.revenueTotal.inc({ tenant_id: tenantId, tenant_name: tenantName }, amount);
  }

  /**
   * Record failed login attempt
   */
  recordFailedLogin(username: string, ipAddress: string) {
    this.authFailedLoginAttempts.inc({ username, ip_address: ipAddress });
  }

  /**
   * Record successful login
   */
  recordSuccessfulLogin(username: string, authMethod: string) {
    this.authLoginSuccess.inc({ username, auth_method: authMethod });
  }

  /**
   * Record unauthorized access attempt
   */
  recordUnauthorizedAccess(username: string, resource: string, securityZone: string) {
    this.authUnauthorizedAccess.inc({ username, resource, security_zone: securityZone });
  }

  /**
   * Update edge sync timestamp
   */
  updateEdgeLastSync(facilityId: string, facilityName: string, tenantId: string) {
    this.edgeLastSyncTimestamp.set(
      { facility_id: facilityId, facility_name: facilityName, tenant_id: tenantId },
      Math.floor(Date.now() / 1000)
    );
  }

  /**
   * Record production event
   */
  recordProductionEvent(facilityId: string, facilityName: string, eventType: string) {
    this.productionEventsCaptured.inc({ facility_id: facilityId, facility_name: facilityName, event_type: eventType });
  }

  /**
   * Update OEE
   */
  updateOEE(facilityId: string, facilityName: string, oee: number) {
    this.overallEquipmentEffectiveness.set({ facility_id: facilityId, facility_name: facilityName }, oee);
  }
}
