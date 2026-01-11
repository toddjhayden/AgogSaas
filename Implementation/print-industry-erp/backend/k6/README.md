# K6 Database Load Testing

Comprehensive k6 load testing suite for database stress testing and performance validation.

**REQ: REQ-P0-1768148786448-3r439 - Database stress testing**

## Overview

This directory contains k6 load tests designed to stress test the database layer of the AgogSaaS ERP system. The tests are organized into scenarios and focused database tests.

## Directory Structure

```
k6/
├── config/              # Test configuration
│   └── test.config.js   # Base configuration
├── lib/                 # Shared utilities
│   └── helpers.js       # Helper functions and metrics
├── scenarios/           # Test scenarios
│   ├── smoke-test.js    # Minimal load verification
│   ├── load-test.js     # Normal load testing
│   ├── stress-test.js   # High load/breaking point
│   ├── spike-test.js    # Sudden traffic spike
│   └── soak-test.js     # Endurance testing (1+ hours)
├── tests/
│   ├── database/        # Database-specific tests
│   │   ├── connection-pool.js      # Connection pool behavior
│   │   ├── query-performance.js    # Query performance
│   │   └── write-throughput.js     # Write performance
│   └── graphql/         # GraphQL endpoint tests
│       └── endpoint-load.js        # GraphQL API load
├── grafana/             # Grafana configuration
│   ├── dashboards/      # Dashboard definitions
│   └── datasources/     # InfluxDB datasource
├── docker-compose.k6.yml # Docker infrastructure
└── README.md            # This file
```

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Backend API running on `localhost:4000`
- PostgreSQL running on `localhost:5433`

### 1. Start Monitoring Infrastructure

Start InfluxDB and Grafana for metrics visualization:

```bash
cd Implementation/print-industry-erp/backend
docker-compose -f k6/docker-compose.k6.yml up -d influxdb grafana
```

**Access Grafana:**
- URL: http://localhost:3001
- User: admin
- Password: admin (will prompt to change on first login)

### 2. Run Tests Locally (Without Docker)

**Smoke Test** (quick verification):
```bash
npm run k6:smoke
# OR
k6 run k6/scenarios/smoke-test.js
```

**Load Test** (normal load):
```bash
npm run k6:load
# OR
k6 run k6/scenarios/load-test.js
```

**Stress Test** (find breaking point):
```bash
npm run k6:stress
# OR
k6 run k6/scenarios/stress-test.js
```

**Spike Test** (sudden traffic spike):
```bash
npm run k6:spike
# OR
k6 run k6/scenarios/spike-test.js
```

**Soak Test** (endurance - 1 hour):
```bash
npm run k6:soak
# OR
k6 run k6/scenarios/soak-test.js
```

### 3. Run Database-Specific Tests

**Connection Pool Test:**
```bash
npm run k6:db:connections
# OR
k6 run k6/tests/database/connection-pool.js
```

**Query Performance Test:**
```bash
npm run k6:db:query
# OR
k6 run k6/tests/database/query-performance.js
```

**Write Throughput Test:**
```bash
npm run k6:db:write
# OR
k6 run k6/tests/database/write-throughput.js
```

### 4. Run Tests in Docker

**Start infrastructure:**
```bash
npm run k6:docker:up
```

**Run tests:**
```bash
# Smoke test
npm run k6:docker:smoke

# Load test
npm run k6:docker:load

# Stress test
npm run k6:docker:stress

# Custom test
docker-compose -f k6/docker-compose.k6.yml run --rm k6 run /tests/database/connection-pool.js
```

**Stop infrastructure:**
```bash
npm run k6:docker:down
```

## Test Scenarios Explained

### Smoke Test
- **Duration:** 30 seconds
- **VUs:** 2
- **Purpose:** Quick validation that system is functioning
- **When to use:** After deployments, before running larger tests

### Load Test
- **Duration:** 10 minutes (ramp + sustain)
- **VUs:** 10 → 50
- **Purpose:** Test under expected production load
- **When to use:** Regular performance testing, baseline establishment

### Stress Test
- **Duration:** 15 minutes
- **VUs:** 50 → 200
- **Purpose:** Find system breaking point
- **When to use:** Capacity planning, finding limits

### Spike Test
- **Duration:** 4 minutes
- **VUs:** 10 → 200 (sudden spike)
- **Purpose:** Test system elasticity under sudden load
- **When to use:** Prepare for traffic spikes (sales, marketing campaigns)

### Soak Test
- **Duration:** 70 minutes
- **VUs:** 30 (sustained)
- **Purpose:** Find memory leaks, connection leaks, degradation
- **When to use:** Before major releases, quarterly stability checks

## Configuration

### Environment Variables

Set these when running tests:

```bash
# API endpoint
export BASE_URL=http://localhost:4000

# Database (for direct connection tests)
export DB_HOST=localhost
export DB_PORT=5433
export DB_NAME=agogsaas
export DB_USER=agogsaas_user
export DB_PASSWORD='your-password'

# Test configuration
export MOCK_TENANT_ID=tenant-001
export MOCK_USER_ID=user-001
export ITERATIONS=100
export DURATION=30s
```

### Custom Configuration

Edit `k6/config/test.config.js` to customize:
- Base URL
- Database connection
- Test thresholds
- Performance targets

## Metrics and Analysis

### Key Metrics

**HTTP Metrics:**
- `http_req_duration` - Request latency (p95, p99)
- `http_req_failed` - Error rate
- `http_reqs` - Request throughput (req/s)

**Database Metrics:**
- `db_query_duration` - Query execution time
- `db_connection_time` - Connection acquisition time
- `db_write_duration` - Write operation time
- `db_queries_total` - Total queries executed
- `db_writes_total` - Total writes executed

**Custom Metrics:**
- `connection_failures` - Connection pool failures
- `write_conflicts` - Write lock conflicts
- `slow_queries` - Queries over 1 second
- `graphql_errors` - GraphQL-specific errors

### Viewing Results

**Console Output:**
Tests print summary to stdout with analysis and recommendations.

**JSON Files:**
Each test generates a summary JSON file:
- `smoke-test-summary.json`
- `load-test-summary.json`
- `connection-pool-test-summary.json`
- etc.

**Grafana Dashboards:**
1. Access http://localhost:3001
2. Navigate to "K6 Load Tests" folder
3. View real-time metrics during test execution

## Thresholds and Pass/Fail

Tests use thresholds to determine pass/fail:

```javascript
thresholds: {
  http_req_failed: ['rate<0.01'],          // <1% error rate
  http_req_duration: ['p(95)<2000'],       // 95% under 2s
  db_query_duration: ['p(95)<500'],        // 95% queries under 500ms
  db_connection_time: ['p(95)<100'],       // Connection under 100ms
}
```

**Exit codes:**
- `0` - All thresholds passed
- `99` - One or more thresholds failed

## CI/CD Integration

### Example GitHub Actions

```yaml
- name: Run K6 Smoke Test
  run: |
    npm run k6:smoke
  continue-on-error: false

- name: Run K6 Load Test
  run: |
    npm run k6:load
  continue-on-error: true  # Don't block on performance issues
```

### Pre-deployment Checklist

1. **Always run smoke test** before deploying
2. **Run load test** weekly or before major releases
3. **Run stress test** before capacity changes
4. **Run soak test** quarterly or before major releases

## Troubleshooting

### Common Issues

**Connection refused:**
```bash
# Check backend is running
curl http://localhost:4000/health

# Check database is accessible
psql -h localhost -p 5433 -U agogsaas_user -d agogsaas
```

**High error rate:**
- Check database connection pool size (increase if needed)
- Review slow query logs
- Check for missing indexes
- Verify RLS policies aren't too restrictive

**Slow queries:**
```bash
# Enable slow query logging in PostgreSQL
ALTER DATABASE agogsaas SET log_min_duration_statement = 1000;

# Check for missing indexes
npm run db:analyze-slow-queries
```

**Connection pool exhaustion:**
- Increase pool size in backend configuration
- Check for connection leaks (connections not being released)
- Review transaction timeout settings

### Debug Mode

Run with verbose output:
```bash
k6 run --verbose k6/scenarios/load-test.js
```

Run with HTTP logging:
```bash
k6 run --http-debug k6/scenarios/load-test.js
```

## Best Practices

1. **Start small:** Always run smoke test first
2. **Gradual increase:** Ramp up load gradually
3. **Realistic data:** Use production-like data distributions
4. **Clean environment:** Reset test data between runs if needed
5. **Monitor resources:** Watch CPU, memory, disk I/O during tests
6. **Document findings:** Keep notes on performance issues found

## Performance Targets

| Metric | Target (p95) | Critical (p99) |
|--------|-------------|----------------|
| Simple Query | <100ms | <200ms |
| Complex Query | <500ms | <1000ms |
| Write Operation | <800ms | <1500ms |
| API Response | <2000ms | <5000ms |
| Connection Time | <100ms | <200ms |
| Error Rate | <1% | <2% |

## Support

For issues with k6 tests:
1. Check logs in `k6/results/`
2. Review Grafana dashboards
3. Consult database slow query logs
4. Contact DevOps team

## References

- [K6 Documentation](https://k6.io/docs/)
- [InfluxDB Documentation](https://docs.influxdata.com/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
