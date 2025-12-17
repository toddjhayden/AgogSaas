# AgogSaaS Test Environment

Complete test environment with Edge + 2 Regional Clouds + Monitoring for bilingual (English/Chinese) testing.

## Quick Start

### Windows
```batch
cd deployment\test
build-and-start.bat
```

### Linux/Mac
```bash
cd deployment/test
./build-and-start.sh
```

Wait 1-2 minutes for all services to start.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEST ENVIRONMENT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  EDGE (Toronto)          - Ports 5001-5010                      │
│  REGION 1 (US-EAST)      - Ports 6001-6010 (English)           │
│  REGION 2 (EU-CENTRAL)   - Ports 7001-7010 (Chinese)           │
│  MONITORING              - Ports 9090-9093, 3000                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend (English)** | http://localhost:6080 | admin@americanprint.com / test123 |
| **Frontend (Chinese)** | http://localhost:7080 | admin@shanghai-printing.com / test123 |
| **Edge Backend** | http://localhost:5001/graphql | - |
| **Region 1 Backend** | http://localhost:6001/graphql | - |
| **Region 2 Backend** | http://localhost:7001/graphql | - |
| **Grafana** | http://localhost:3000 | admin / changeme |
| **Prometheus** | http://localhost:9090 | - |

## Test Accounts

### English Testing (American Print Co.)
- **Email:** admin@americanprint.com
- **Password:** test123
- **Tenant:** American Print Co. (PRINT-US)
- **Facilities:** Toronto, New York

### Chinese Testing (上海印刷公司)
- **Email:** admin@shanghai-printing.com
- **Password:** test123
- **Tenant:** 上海印刷公司 (PRINT-CN)
- **Facilities:** 上海, 北京

## Test Data

The environment includes:
- **2 Tenants** (English + Chinese)
- **4 Facilities** (Toronto, New York, Shanghai, Beijing)
- **10 Users** (5 per tenant)
- **4 Customers** (2 per tenant)
- **6 Materials** (3 per tenant)
- **4 Products** (2 per tenant)
- **6 Work Centers** (3 per tenant)
- **6 Production Orders** (3 per tenant)
- **4 Production Runs** (2 per tenant, some active)

## Available Dashboards

1. **Executive Dashboard** - Revenue, KPIs, high-level metrics
2. **Operations Dashboard** - Production runs, work centers, real-time monitoring
3. **Production Dashboard** - Production orders, scheduling, capacity planning
4. **WMS Dashboard** - Inventory, warehouse management, shipping/receiving
5. **Finance Dashboard** - Revenue, A/R, profitability
6. **Sales Dashboard** - Orders, customers, sales pipeline
7. **KPI Explorer** - Search and explore all 119 KPIs

## Health Check

```bash
./health-check.sh     # Linux/Mac
health-check.bat      # Windows
```

Checks:
- Container status
- Health endpoints
- Database connectivity
- Redis connectivity
- GraphQL endpoints
- NATS messaging

## Common Commands

### View Logs
```bash
# All services
docker-compose -f docker-compose.test.yml logs -f

# Specific service
docker-compose -f docker-compose.test.yml logs -f backend-region1
```

### Restart Services
```bash
# All services
docker-compose -f docker-compose.test.yml restart

# Specific service
docker-compose -f docker-compose.test.yml restart backend-region1
```

### Stop Environment
```bash
docker-compose -f docker-compose.test.yml down
```

### Reset All Data
```bash
docker-compose -f docker-compose.test.yml down -v
```

## Database Access

### PostgreSQL
```bash
# Edge
psql -h localhost -p 5432 -U edge_user -d agog_edge

# Region 1
psql -h localhost -p 6432 -U agogsaas_user -d agogsaas

# Region 2
psql -h localhost -p 7432 -U agogsaas_user -d agogsaas
```

Passwords:
- Edge: `edge_password_test`
- Region 1: `region1_password_test`
- Region 2: `region2_password_test`

### Redis
```bash
# Region 1
redis-cli -h localhost -p 6379

# Region 2
redis-cli -h localhost -p 7379
```

## Monitoring

### Prometheus
- URL: http://localhost:9090
- Targets: Status > Targets
- Alerts: Alerts
- Query: Graph tab

### Grafana
- URL: http://localhost:3000
- Login: admin / changeme
- Dashboards:
  - AgogSaaS Overview
  - AgogSaaS API
  - AgogSaaS Database
  - AgogSaaS Edge
  - AgogSaaS Business

### NATS Monitoring
- Edge: http://localhost:5223
- Region 1: http://localhost:6223
- Region 2: http://localhost:7223

## Testing Guide

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for:
- 17 comprehensive test scenarios
- English and Chinese testing procedures
- Performance testing
- Error handling tests
- Test result reporting templates

## Troubleshooting

### Services Won't Start
```bash
# Check Docker
docker info

# View logs
docker-compose -f docker-compose.test.yml logs [service]

# Restart
docker-compose -f docker-compose.test.yml restart
```

### Can't Access Frontend
```bash
# Check container
docker ps | grep frontend

# Check logs
docker logs test-frontend-region1

# Check port
netstat -ano | findstr :6080  # Windows
lsof -i :6080                  # Mac/Linux
```

### Database Issues
```bash
# Check PostgreSQL
docker exec test-postgres-region1 pg_isready

# Check tables
docker exec test-postgres-region1 psql -U agogsaas_user -d agogsaas -c "\dt"

# Reload seed data
docker exec test-postgres-region1 psql -U agogsaas_user -d agogsaas -f /docker-entrypoint-initdb.d/../seeds/test-data.sql
```

## Port Allocation

### Edge (5xxx)
- 5001: Backend
- 5222: NATS Client
- 5223: NATS Monitoring
- 5432: PostgreSQL

### Region 1 - US-EAST (6xxx)
- 6001: Backend
- 6080: Frontend
- 6222: NATS Client
- 6223: NATS Monitoring
- 6224: NATS Cluster
- 6379: Redis
- 6432: PostgreSQL

### Region 2 - EU-CENTRAL (7xxx)
- 7001: Backend
- 7080: Frontend
- 7222: NATS Client
- 7223: NATS Monitoring
- 7224: NATS Cluster
- 7379: Redis
- 7432: PostgreSQL

### Monitoring (9xxx, 3000)
- 3000: Grafana
- 9090: Prometheus
- 9093: Alertmanager

## Features Tested

### Core Functionality
- ✅ Multi-tenant isolation
- ✅ Bilingual support (English/Chinese)
- ✅ 7 dashboards with 119 KPIs
- ✅ Real-time production monitoring
- ✅ Inventory management
- ✅ Financial reporting
- ✅ Sales tracking

### Technical Features
- ✅ GraphQL API
- ✅ WebSocket real-time updates
- ✅ Edge-to-regional sync
- ✅ Multi-region data replication
- ✅ Offline edge operation
- ✅ Health monitoring
- ✅ Metrics collection (Prometheus)
- ✅ Visualization (Grafana)

### Infrastructure
- ✅ Docker containerization
- ✅ Multi-stage builds
- ✅ NGINX for frontend
- ✅ PostgreSQL with pgvector
- ✅ Redis caching
- ✅ NATS messaging
- ✅ Health checks
- ✅ Resource limits

## Next Steps

1. **Run Tests** - Execute test scenarios from TESTING_GUIDE.md
2. **Performance Test** - Load test with multiple concurrent users
3. **Verify Monitoring** - Check Grafana dashboards show real data
4. **Test Sync** - Verify edge-to-regional and cross-region sync
5. **Test Failover** - Simulate failures and verify recovery

## Support

- **Documentation:** See TESTING_GUIDE.md
- **Issues:** Report to development team
- **Logs:** Check docker-compose logs for errors

---

**Version:** 1.0.0
**Created:** 2025-12-17
**Maintained by:** Containerization Specialist
