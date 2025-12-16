# AgogSaaS Regional Cloud Deployment

High-availability multi-region cloud infrastructure with Blue-Green deployment.

## Overview

Regional cloud deployment provides:

- **Blue-Green environments** - Zero-downtime deployments
- **Multi-region support** - US-EAST, EU-CENTRAL, APAC
- **Auto-scaling** - Handle load spikes automatically
- **High availability** - Multi-AZ deployment
- **Full monitoring** - Prometheus + Grafana

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Regional Cloud (US-EAST)           │
├─────────────────────────────────────────────────┤
│  Blue Environment (Currently Active)            │
│    - PostgreSQL Blue                            │
│    - Backend API Blue (3 replicas)              │
│    - Frontend Blue (2 replicas)                 │
│    - Redis Blue                                 │
│    - Ollama Blue                                │
├─────────────────────────────────────────────────┤
│  Green Environment (Deployment Target)          │
│    - PostgreSQL Green                           │
│    - Backend API Green (3 replicas)             │
│    - Frontend Green (2 replicas)                │
│    - Redis Green                                │
│    - Ollama Green                               │
├─────────────────────────────────────────────────┤
│  Shared Infrastructure                          │
│    - Nginx Load Balancer                        │
│    - NATS Cluster                               │
│    - Prometheus                                 │
│    - Grafana                                    │
│    - Alertmanager                               │
└─────────────────────────────────────────────────┘
```

## Deployment Options

### Docker Compose (Development/Testing)
For development, testing, and small-scale production.

### Kubernetes (Production)
For large-scale production deployments.

## Quick Start - Docker Compose

```bash
# 1. Clone repository
git clone https://github.com/yourusername/agogsaas.git
cd agogsaas/deployment/regional

# 2. Configure environment
cp .env.regional.example .env
nano .env  # Edit configuration

# 3. Deploy both environments
docker-compose -f docker-compose.regional.yml up -d

# 4. Or deploy specific environment
docker-compose -f docker-compose.regional.yml up -d \
  postgres-blue redis-blue backend-blue frontend-blue ollama-blue \
  nats nginx prometheus grafana

# 5. Verify health
curl http://localhost:80/health
```

## Quick Start - Kubernetes

```bash
# 1. Apply namespaces
kubectl apply -f ../kubernetes/postgres-statefulset.yml

# 2. Create secrets (edit first!)
kubectl apply -f ../kubernetes/secrets.yml

# 3. Apply ConfigMaps
kubectl apply -f ../kubernetes/configmaps.yml

# 4. Deploy Blue environment
kubectl apply -f ../kubernetes/backend-deployment.yml
kubectl apply -f ../kubernetes/frontend-deployment.yml

# 5. Setup ingress
kubectl apply -f ../kubernetes/ingress.yml

# 6. Enable autoscaling
kubectl apply -f ../kubernetes/hpa.yml

# 7. Apply network policies
kubectl apply -f ../kubernetes/network-policies.yml
```

## Configuration

### Environment Variables (.env)

```bash
# Region Configuration
REGION=US-EAST                  # US-EAST, EU-CENTRAL, or APAC
OTHER_REGIONS=EU-CENTRAL,APAC

# Database
DB_NAME=agogsaas
DB_USER=agogsaas_user
DB_PASSWORD=secure_password_here

# Security
JWT_SECRET=your_jwt_secret_here

# Active Environment
ACTIVE_ENVIRONMENT=blue         # blue or green

# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=secure_password_here
```

### Multi-Region Setup

Each region should have its own deployment:

**US-EAST (Virginia)**
```bash
REGION=US-EAST
OTHER_REGIONS=EU-CENTRAL,APAC
```

**EU-CENTRAL (Frankfurt)**
```bash
REGION=EU-CENTRAL
OTHER_REGIONS=US-EAST,APAC
```

**APAC (Singapore)**
```bash
REGION=APAC
OTHER_REGIONS=US-EAST,EU-CENTRAL
```

## Blue-Green Deployment

### Step 1: Deploy to Green

```bash
# Deploy latest version to Green
../scripts/deploy-regional.sh US-EAST green
```

### Step 2: Smoke Test Green

```bash
# Test Green environment
curl http://localhost:4002/health
curl http://localhost:3002

# Run comprehensive smoke tests
../scripts/smoke-test.sh green
```

### Step 3: Switch Traffic

```bash
# Switch production traffic to Green
../scripts/switch-blue-green.sh green
```

### Step 4: Monitor

```bash
# Watch Grafana dashboards
open http://localhost:3000

# Check error rates, latency, throughput
# Monitor for 24 hours before considering deployment complete
```

### Step 5: Rollback (if needed)

```bash
# Rollback to Blue
../scripts/switch-blue-green.sh blue
```

## Services

### Blue Environment

| Service | Port | Description |
|---------|------|-------------|
| Backend API | 4001 | GraphQL API (Blue) |
| Frontend | 3001 | React SPA (Blue) |
| PostgreSQL | 5432 | Database (Blue) |
| Redis | 6379 | Cache (Blue) |
| Ollama | 11435 | AI Models (Blue) |

### Green Environment

| Service | Port | Description |
|---------|------|-------------|
| Backend API | 4002 | GraphQL API (Green) |
| Frontend | 3002 | React SPA (Green) |
| PostgreSQL | 5433 | Database (Green) |
| Redis | 6380 | Cache (Green) |
| Ollama | 11436 | AI Models (Green) |

### Shared Infrastructure

| Service | Port | Description |
|---------|------|-------------|
| Nginx | 80, 443 | Load Balancer |
| NATS | 4222 | Message Queue |
| NATS Monitor | 8222 | NATS Dashboard |
| Prometheus | 9090 | Metrics |
| Grafana | 3000 | Monitoring Dashboards |
| Alertmanager | 9093 | Alert Routing |

## Management

### Deployment Scripts

```bash
# Deploy regional infrastructure
../scripts/deploy-regional.sh US-EAST blue

# Switch Blue-Green traffic
../scripts/switch-blue-green.sh green

# Setup cross-region replication
../scripts/setup-replication.sh regional-to-regional US-EAST EU-CENTRAL

# Health check all services
../scripts/health-check.sh regional
```

### Docker Compose Commands

```bash
# View logs (all services)
docker-compose -f docker-compose.regional.yml logs -f

# View logs (specific service)
docker-compose -f docker-compose.regional.yml logs -f backend-blue

# Restart specific service
docker-compose -f docker-compose.regional.yml restart backend-blue

# Stop all services
docker-compose -f docker-compose.regional.yml down

# Remove volumes (WARNING: deletes data!)
docker-compose -f docker-compose.regional.yml down -v
```

### Kubernetes Commands

```bash
# Check deployment status
kubectl get deployments -n agogsaas-blue
kubectl get pods -n agogsaas-blue

# View logs
kubectl logs -f deployment/backend -n agogsaas-blue

# Scale deployment
kubectl scale deployment backend --replicas=5 -n agogsaas-blue

# Rollback deployment
kubectl rollout undo deployment/backend -n agogsaas-blue

# Check HPA status
kubectl get hpa -n agogsaas-blue
```

## Monitoring

### Grafana Dashboards

Access: http://localhost:3000 (default: admin/admin)

**Dashboards:**
1. **Regional Overview** - Overall system health
2. **Blue-Green Comparison** - Compare environments
3. **Database Performance** - PostgreSQL metrics
4. **API Performance** - GraphQL response times
5. **Resource Utilization** - CPU, memory, disk

### Prometheus Queries

Access: http://localhost:9090

**Useful queries:**
```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_errors_total[5m])

# Database connections
pg_stat_database_numbackends

# Memory usage
container_memory_usage_bytes
```

### Alerts

Configured in `prometheus/alerts.yml`:
- High error rate (>5%)
- High response time (>1s p95)
- Database connection pool exhausted
- Disk usage >90%
- Memory usage >85%

## Database Replication

### Cross-Region Replication

```bash
# Setup US-EAST to EU-CENTRAL replication
../scripts/setup-replication.sh regional-to-regional US-EAST EU-CENTRAL
```

### Edge to Regional Replication

```bash
# Setup edge facility to regional cloud
../scripts/setup-replication.sh edge-to-regional facility-la-001 US-EAST

# Setup master data download to edge
../scripts/setup-replication.sh regional-to-edge US-EAST facility-la-001
```

## Scaling

### Manual Scaling (Docker Compose)

```bash
# Scale backend to 5 instances
docker-compose -f docker-compose.regional.yml up -d --scale backend-blue=5
```

### Auto-Scaling (Kubernetes)

Configured via HPA:
- Min replicas: 3
- Max replicas: 10
- Target CPU: 70%
- Target Memory: 80%

## Security

- **Network Policies** - 5-tier security zones
- **TLS Encryption** - All traffic encrypted
- **Secrets Management** - Kubernetes secrets
- **RBAC** - Role-based access control
- **Non-root containers** - Security best practices

## Backup & Recovery

### Database Backup

```bash
# Backup Blue database
docker exec regional-postgres-blue pg_dump -U agogsaas_user agogsaas > backup_blue_$(date +%Y%m%d).sql

# Backup Green database
docker exec regional-postgres-green pg_dump -U agogsaas_user agogsaas > backup_green_$(date +%Y%m%d).sql
```

### Restore

```bash
# Restore to Blue
docker exec -i regional-postgres-blue psql -U agogsaas_user agogsaas < backup_blue_20241216.sql
```

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs backend-blue

# Verify database
docker-compose exec postgres-blue pg_isready

# Check resources
docker stats
```

### High latency

```bash
# Check database connections
docker exec regional-postgres-blue psql -U agogsaas_user -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis
docker exec regional-redis-blue redis-cli INFO
```

### Out of memory

```bash
# Check memory usage
docker stats

# Adjust resource limits in docker-compose.yml
# Restart services
docker-compose restart
```

## Support

- **Documentation:** https://docs.agogsaas.com/regional
- **Support Email:** support@agogsaas.com
- **Slack:** #agogsaas-devops

## License

Copyright 2024 AgogSaaS. All rights reserved.
