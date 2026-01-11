# Redis Cache Warming Strategy

**REQ-1767924916114-qbjk4: Implement Redis Cache Warming Strategy**

## Overview

This document describes the Redis cache warming strategy implemented for the AgogSaaS ERP system. Cache warming pre-populates frequently accessed data in Redis on application startup to reduce cache misses and improve response times during peak usage.

## Architecture

### Components

1. **CacheModule** (`src/cache/cache.module.ts`)
   - Global module providing Redis integration via NestJS Cache Manager
   - Configured with `cache-manager-redis-yet` store
   - Auto-warms cache on module initialization

2. **CacheService** (`src/cache/services/cache.service.ts`)
   - Type-safe cache wrapper with generics
   - Implements cache-aside pattern
   - Provides TTL management by data type
   - Tracks metrics via monitoring service

3. **CacheKeyService** (`src/cache/services/cache-key.service.ts`)
   - Generates consistent cache keys across modules
   - Ensures tenant isolation with multi-tenant namespacing
   - Provides key patterns for invalidation

4. **CacheWarmingService** (`src/cache/services/cache-warming.service.ts`)
   - Orchestrates three-phase warming strategy
   - Auto-discovers tenants from database
   - Runs on startup via `OnModuleInit` lifecycle hook

5. **CacheMonitoringService** (`src/cache/services/cache-monitoring.service.ts`)
   - Tracks hit/miss rates, response times, errors
   - Provides health status monitoring
   - Logs periodic statistics

6. **CacheInvalidationService** (`src/cache/services/cache-invalidation.service.ts`)
   - Event-driven cache invalidation
   - Pattern-based invalidation support
   - Tenant-level and global invalidation

## Warming Strategy

### Three-Phase Approach

#### **Phase 1: Essential Reference Data (0-30s)**
- **Priority:** CRITICAL
- **TTL:** 24 hours
- **Data:**
  - Chart of Accounts
  - Financial Periods (current year ± 6 months)
  - Current Period
  - CRM Pipeline Stages
  - Work Centers
  - Exchange Rates (latest for common currency pairs)

#### **Phase 2: Master Data (30-60s)**
- **Priority:** HIGH
- **TTL:** 12-24 hours
- **Data:**
  - Vendors (paginated - first 500)
  - Customers (paginated - first 500)
  - Materials/Products (paginated - first 1000)
  - Inventory Locations
  - Kit Definitions
  - Pricing Rules (active only)

#### **Phase 3: Aggregated/Computed Data (60-120s)**
- **Priority:** MEDIUM
- **TTL:** 6-12 hours
- **Data:**
  - Trial Balance (current + previous period)
  - GL Balances (current period)
  - Bin Utilization metrics
  - Equipment Health Scores

### TTL Strategy

```typescript
enum CacheTTL {
  OPERATIONAL = 5 * 60 * 1000,      // 5 minutes - real-time operational data
  DASHBOARD = 60 * 60 * 1000,        // 1 hour - dashboard KPIs
  REFERENCE = 12 * 60 * 60 * 1000,   // 12 hours - master data
  STATIC = 24 * 60 * 60 * 1000,      // 24 hours - rarely-changing data
  AUTH = 15 * 60 * 1000,             // 15 minutes - authorization data
}
```

## Cache Key Patterns

### Format

```
{module}:{entity}:{tenantId}:{...params}
```

### Examples

```typescript
// Finance
finance:coa:{tenantId}
finance:xrate:{tenantId}:from:USD:to:EUR:date:latest
finance:trial_balance:{tenantId}:year:2025:month:12:currency:USD

// CRM
crm:stages:{tenantId}
crm:pipeline_summary:{tenantId}:userId:user-123

// Operations
ops:workcenters:{tenantId}:facilityId:facility-1
ops:equipment_health:{tenantId}:facilityId:facility-1:status:active

// Sales/Materials
sales:materials:{tenantId}:page:1:limit:100
sales:vendor:{tenantId}:vendorId:vendor-123
sales:pricing:{tenantId}:effective:current

// WMS
wms:locations:{tenantId}:facilityId:facility-1
wms:inv_summary:{tenantId}:facilityId:facility-1
```

## Configuration

### Environment Variables

```bash
# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# Cache Warming
CACHE_WARMING_ENABLED=true           # Enable auto-warming on startup
CACHE_WARMING_PHASE3_ENABLED=false   # Enable Phase 3 (optional, slower)
```

### Docker Compose (docker-compose.app.yml)

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6380:6379"
  command: >
    redis-server
    --appendonly yes
    --maxmemory 2gb
    --maxmemory-policy allkeys-lru
    --save 900 1
    --save 300 10
    --save 60 10000
```

## Usage

### Basic Cache Operations

```typescript
import { CacheService, CacheTTL } from './cache/services/cache.service';
import { CacheKeyService } from './cache/services/cache-key.service';

@Injectable()
export class FinanceService {
  constructor(
    private cacheService: CacheService,
    private cacheKeyService: CacheKeyService,
  ) {}

  async getChartOfAccounts(tenantId: string): Promise<Account[]> {
    const key = this.cacheKeyService.chartOfAccounts(tenantId);

    // Cache-aside pattern with automatic fallback
    return this.cacheService.wrap(
      key,
      async () => {
        // Execute expensive DB query only on cache miss
        return this.dbPool.query('SELECT * FROM chart_of_accounts WHERE tenant_id = $1', [tenantId]);
      },
      CacheTTL.STATIC, // 24 hours
    );
  }
}
```

### Cache Invalidation

```typescript
import { CacheInvalidationService } from './cache/services/cache-invalidation.service';

@Injectable()
export class FinanceService {
  constructor(
    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  async createAccount(tenantId: string, account: CreateAccountDto): Promise<Account> {
    // Create account in database
    const newAccount = await this.dbPool.query(...);

    // Invalidate Chart of Accounts cache
    await this.cacheInvalidationService.handleEvent({
      eventType: 'ACCOUNT_CREATED',
      tenantId,
      entityId: newAccount.id,
    });

    return newAccount;
  }
}
```

### Manual Cache Warming

```typescript
import { CacheWarmingService } from './cache/services/cache-warming.service';

// Warm specific tenant
await cacheWarmingService.warmTenant('tenant-123');

// Warm all tenants
await cacheWarmingService.warmAllTenants();
```

### Cache Monitoring

```typescript
import { CacheMonitoringService } from './cache/services/cache-monitoring.service';

// Get statistics
const stats = await monitoringService.getStats();
console.log(`Hit Rate: ${stats.hitRate.toFixed(2)}%`);
console.log(`Avg Hit Duration: ${stats.avgHitDuration.toFixed(2)}ms`);

// Get health status
const health = monitoringService.getHealthStatus();
console.log(`Cache Health: ${health.status}`);
// Status: 'healthy' | 'degraded' | 'unhealthy'
```

## Performance Impact

### Expected Improvements

| Query Type | Cache Miss (ms) | Cache Hit (ms) | Speedup |
|------------|-----------------|----------------|---------|
| chartOfAccounts | 50-100 | 0.5-1 | 50-100x |
| exchangeRate | 20-40 | 0.3-0.5 | 100-200x |
| trialBalance | 500-2000 | 10-20 | 10-50x |
| pipelineStages | 30-60 | 0.5-1 | 50-100x |
| inventoryLocations | 100-300 | 2-5 | 20-50x |

### System-Wide Impact

- **Dashboard Load Time:** 30-50% reduction
- **API Response Time:** 50-80% reduction for reference data
- **Database Connection Pool Pressure:** 40-60% reduction
- **Concurrent User Capacity:** 30-50% increase

## Monitoring & Observability

### Health Checks

Cache health is exposed via health endpoint:

```typescript
GET /health

{
  "status": "ok",
  "info": {
    "cache": {
      "status": "healthy",
      "hitRate": 85.3,
      "errorRate": 0.2
    }
  }
}
```

### Metrics

Cache metrics are logged every 5 minutes:

```
[CacheMonitoringService] Cache Stats - Hit Rate: 85.32%, Hits: 12453, Misses: 2134, Sets: 856, Errors: 3, Health: healthy
```

### Alerting

- **Unhealthy Cache** (hit rate < 50% or error rate > 10%)
  - Action: Check Redis connection, review warming configuration
- **High Error Rate** (> 5%)
  - Action: Check Redis logs, verify network connectivity
- **Low Hit Rate** (< 70%)
  - Action: Review TTL settings, check invalidation patterns

## Maintenance

### Cache Reset

```typescript
// Reset all cache (DANGER - production impact)
await cacheService.reset();

// Reset specific tenant
await cacheInvalidationService.invalidateTenant('tenant-123');
```

### Re-warming After Deployment

Cache auto-warms on application startup via `OnModuleInit`. For manual re-warming:

```bash
# Restart backend service to trigger auto-warming
docker-compose -f docker-compose.app.yml restart backend

# Or call manual warming API (if exposed)
POST /api/cache/warm
```

## Best Practices

1. **Use Cache-Aside Pattern:** Always use `cacheService.wrap()` for automatic fallback
2. **Set Appropriate TTL:** Match TTL to data volatility
3. **Invalidate on Mutations:** Always invalidate cache after data changes
4. **Monitor Hit Rates:** Target > 70% hit rate for optimal performance
5. **Avoid Over-Caching:** Don't cache frequently changing operational data (< 5 min TTL)
6. **Test Invalidation:** Verify cache invalidates correctly after mutations

## Troubleshooting

### Issue: Low Cache Hit Rate

**Symptoms:** Hit rate < 50%

**Possible Causes:**
- TTL too short (data expires before reuse)
- Cache not warming properly on startup
- Aggressive invalidation patterns

**Solutions:**
- Increase TTL for stable data
- Check warming service logs for errors
- Review invalidation event triggers

### Issue: Stale Cache Data

**Symptoms:** Users see outdated data

**Possible Causes:**
- Missing cache invalidation on mutations
- TTL too long for volatile data
- Invalidation service not receiving events

**Solutions:**
- Add invalidation to mutation resolvers
- Reduce TTL for volatile data
- Verify event handlers are registered

### Issue: Redis Connection Errors

**Symptoms:** High error rate, cache unavailable

**Possible Causes:**
- Redis service down
- Network connectivity issues
- Connection pool exhausted

**Solutions:**
- Check Redis container status: `docker ps`
- Verify Redis logs: `docker logs agogsaas-app-redis`
- Restart Redis: `docker-compose restart redis`

## Future Enhancements

1. **Distributed Cache Warming**
   - Coordinate warming across multiple backend instances
   - Use NATS for warming orchestration

2. **Predictive Warming**
   - Analyze query patterns
   - Pre-warm based on usage analytics

3. **Smart TTL Management**
   - Auto-adjust TTL based on data volatility
   - Machine learning for optimal TTL selection

4. **Cache Compression**
   - Compress large objects before caching
   - Save memory and improve transfer speeds

5. **Multi-Tier Caching**
   - L1: In-memory cache (node-cache)
   - L2: Redis (distributed)
   - L3: PostgreSQL materialized views

## References

- [NestJS Caching Documentation](https://docs.nestjs.com/techniques/caching)
- [cache-manager-redis-yet GitHub](https://github.com/node-cache-manager/node-cache-manager-redis-yet)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- REQ-1767924916114-qbjk4: Implement Redis Cache Warming Strategy
- REQ-1767541724200-xzjz9: Redis Caching Layer

---

**Last Updated:** 2026-01-10
**Status:** Implemented
**Owner:** Cynthia (Research Agent)
