# AgogSaaS Complete Monitoring System

**"We need to know everything is working." - Todd**

This monitoring system provides complete observability for AgogSaaS, from edge computers to regional cloud to global infrastructure.

## Quick Start

### 1. Start Monitoring Stack

```bash
# From deployment/monitoring directory
cd deployment/monitoring

# Configure environment
cp .env.example .env
# Edit .env and set:
# - GRAFANA_PASSWORD (change from default!)
# - SLACK_WEBHOOK_URL (for alerts)
# - PAGERDUTY_SERVICE_KEY (for on-call)

# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Check all services are running
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Access Grafana

Open browser: `http://localhost:3000`

**Login:**
- Username: `admin`
- Password: (from .env or default: `changeme`)

**IMPORTANT**: Change password on first login!

### 3. View Dashboards

All dashboards are pre-loaded. Navigate to:
- `Dashboards → Browse → AgogSaaS`

**Available Dashboards:**
1. Executive Overview (start here!)
2. Edge Computer Monitoring
3. Database Performance
4. API Performance
5. Business Metrics
6. Security Monitoring

---

## What's Included

### Core Services

| Service | Port | Purpose |
|---------|------|---------|
| **Grafana** | 3000 | Visualization & dashboards |
| **Prometheus** | 9090 | Metrics collection & storage |
| **AlertManager** | 9093 | Alert routing |
| **Loki** | 3100 | Log aggregation |
| **Promtail** | 9080 | Log shipping |
| **Blackbox Exporter** | 9115 | Uptime monitoring |
| **Status Page** | 8080 | Public status page |

### Exporters

| Exporter | Port | Monitors |
|----------|------|----------|
| Postgres Exporter (Blue) | 9187 | PostgreSQL metrics |
| Postgres Exporter (Green) | 9188 | PostgreSQL metrics |
| Redis Exporter (Blue) | 9121 | Redis metrics |
| Redis Exporter (Green) | 9122 | Redis metrics |
| NGINX Exporter | 9113 | Load balancer metrics |
| Node Exporter | 9100 | System metrics (CPU, memory, disk) |

---

## Features

### 1. Metrics Collection (Prometheus)

**Scrapes metrics from:**
- Backend API (HTTP, GraphQL, business metrics)
- PostgreSQL (queries, connections, replication)
- Redis (cache hit rate, memory usage)
- NATS (message throughput, consumers)
- NGINX (request rate, response time)
- Edge facilities (health, sync status)
- System (CPU, memory, disk, network)

**Retention:** 30 days

### 2. Dashboards (Grafana)

**6 pre-configured dashboards:**

**Executive Overview** - High-level system health
- All services status
- Request rate, error rate, response time
- Active users, edge facilities online
- Current alerts

**Edge Computer Monitoring** - Facility health
- Online/offline status per facility
- CPU, memory, disk usage per facility
- PostgreSQL connection status
- Last sync time (alert if > 5 min)
- Production data capture rate

**Database Performance** - PostgreSQL deep dive
- Connection pool utilization
- Slow queries (> 1s)
- Replication lag
- Cache hit ratio (target: > 95%)
- Transaction rate
- Table sizes & index usage

**API Performance** - GraphQL & HTTP
- Request rate, error rate
- Top 10 slowest queries
- Mutation success/failure
- Concurrent users, WebSocket connections
- Latency percentiles (P50, P95, P99)

**Business Metrics** - KPIs
- Active production runs
- Material utilization % (target: 85%)
- OEE by facility (target: 75%)
- Orders created/fulfilled
- Marketplace activity
- Revenue trends

**Security Monitoring** - Audit & compliance
- Failed login attempts
- Unauthorized access attempts
- Vault access log
- Chain of custody events
- Suspicious activity detection

### 3. Alerting (Prometheus + AlertManager)

**Critical Alerts** (PagerDuty + Slack + Email):
- Service down (> 2 min)
- Edge facility offline (> 5 min)
- High error rate (> 5%)
- Database connection pool exhausted (> 90%)
- Replication lag high (> 60s)

**Warning Alerts** (Slack + Email):
- High response time (P95 > 2s)
- Disk space low (< 15%)
- Memory usage high (> 90%)
- CPU usage high (> 85%)
- Redis connection errors

**Business Alerts**:
- No production runs active (30 min during business hours)
- Low material utilization (< 75% for 1 hour)

**Security Alerts**:
- Failed login spike (> 10/sec)
- Unauthorized access attempts

### 4. Log Aggregation (Loki + Promtail)

**Collects logs from:**
- All Docker containers (backend, database, redis, nginx)
- System logs (journald)
- Application logs (JSON formatted)

**Features:**
- Structured logging with labels (facility_id, tenant_id, level)
- Fast full-text search
- Context around errors
- Correlation with metrics

**Retention:** 7 days

### 5. Uptime Monitoring (Blackbox Exporter)

**Probes:**
- HTTP endpoints (health checks)
- TCP connectivity (database, redis, nats)
- GraphQL API
- SSL certificate validity

**Frequency:** Every 30 seconds

### 6. Public Status Page

Accessible at `http://localhost:8080`

**Shows:**
- Overall system status (operational/degraded/down)
- Individual service status
- Uptime % (30 days)
- Average response time
- Active users, edge facilities
- Recent incidents

**Updates:** Every 30 seconds

---

## Configuration

### Environment Variables

Create `.env` file:

```bash
# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=<strong-password>

# Database (for exporters)
DB_USER=agogsaas_user
DB_PASSWORD=<database-password>
DB_NAME=agogsaas

# Region
REGION=US-EAST

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
PAGERDUTY_SERVICE_KEY=your-pagerduty-integration-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=alerts@agogsaas.com
SMTP_PASSWORD=<email-password>
```

### Alert Routing

Edit `prometheus/alertmanager.yml` to configure:
- Slack channels
- Email addresses
- PagerDuty integration
- Teams/Discord webhooks

### Scrape Targets

To add edge facilities, update `prometheus/edge-facilities.json`:

```json
[
  {
    "targets": ["facility-001.edge.agogsaas.com:4010"],
    "labels": {
      "facility_id": "facility-001",
      "facility_name": "Toronto Print Shop",
      "tenant_id": "tenant-001",
      "region": "US-EAST"
    }
  }
]
```

Prometheus automatically reloads this file every 60 seconds.

---

## Usage

### Viewing Metrics

**Grafana (recommended):**
- Open dashboard
- Select time range
- Use filters (facility, tenant, etc.)

**Prometheus (raw metrics):**
- Go to `http://localhost:9090`
- Enter PromQL query
- Example: `rate(http_requests_total[5m])`

### Querying Logs

**In Grafana:**
1. Click "Explore" (compass icon)
2. Select "Loki" datasource
3. Enter LogQL query
4. Examples:
   ```logql
   # All errors
   {level="error"}

   # Errors from specific service
   {container="backend-blue", level="error"}

   # Failed logins
   {container="backend-blue"} |= "failed login"

   # Logs for specific facility
   {facility_id="facility-001"}
   ```

### Checking Alerts

**Active alerts:**
- Grafana: Executive Overview dashboard (bottom panel)
- Prometheus: `http://localhost:9090/alerts`
- AlertManager: `http://localhost:9093`

**Silencing alerts:**
1. Go to AlertManager
2. Click alert
3. Click "Silence"
4. Set duration and reason

### Testing Alerts

```bash
# Simulate service down (backend will be unavailable)
docker stop backend-blue

# Wait 2 minutes for alert to fire

# Check AlertManager
curl http://localhost:9093/api/v2/alerts | jq

# Restore service
docker start backend-blue
```

---

## Maintenance

### Backup

**Prometheus data:**
```bash
docker run --rm -v prometheus-data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz /data
```

**Grafana dashboards:**
```bash
docker exec grafana grafana-cli admin export
```

### Cleanup

```bash
# Stop all monitoring services
docker-compose -f docker-compose.monitoring.yml down

# Remove volumes (CAUTION: deletes all metrics/logs)
docker-compose -f docker-compose.monitoring.yml down -v

# Clean old data (in container)
docker exec prometheus prometheus-tsdb-tool compact /prometheus
```

### Updates

```bash
# Pull latest images
docker-compose -f docker-compose.monitoring.yml pull

# Restart with new images
docker-compose -f docker-compose.monitoring.yml up -d
```

---

## Troubleshooting

### Grafana not showing data

**Check:**
1. Prometheus is running: `docker ps | grep prometheus`
2. Datasource connected: Grafana → Configuration → Data Sources
3. Metrics being scraped: `http://localhost:9090/targets`

### No alerts firing

**Check:**
1. AlertManager is running: `docker ps | grep alertmanager`
2. Prometheus connected to AlertManager: `http://localhost:9090/status`
3. Alert rules loaded: `http://localhost:9090/rules`

### Logs not appearing in Loki

**Check:**
1. Promtail is running: `docker ps | grep promtail`
2. Promtail can access Docker socket: `docker logs promtail`
3. Loki is reachable: `curl http://localhost:3100/ready`

### High memory usage

**Solutions:**
1. Reduce metric retention: Edit `prometheus.yml`, change `--storage.tsdb.retention.time=30d` to `15d`
2. Reduce log retention: Edit `loki-config.yml`, change `retention_period: 168h` to `72h`
3. Increase Docker memory limits: Edit `docker-compose.monitoring.yml`

---

## Documentation

- **Monitoring Guide**: `docs/MONITORING_GUIDE.md`
- **Alerting Runbook**: `docs/ALERTING_RUNBOOK.md`
- **Prometheus Docs**: https://prometheus.io/docs
- **Grafana Docs**: https://grafana.com/docs
- **Loki Docs**: https://grafana.com/docs/loki

---

## Support

- **Documentation**: https://docs.agogsaas.com/monitoring
- **Operations Team**: ops@agogsaas.com
- **On-Call**: PagerDuty
- **Slack**: #monitoring channel

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GRAFANA (Dashboards)                     │
│  - Executive Overview  - API Performance  - Security         │
│  - Edge Monitoring    - Database Perf    - Business KPIs   │
└────────────┬────────────────────────────────┬────────────────┘
             │                                │
     ┌───────▼────────┐              ┌────────▼───────┐
     │  PROMETHEUS    │              │     LOKI       │
     │   (Metrics)    │              │    (Logs)      │
     └───────┬────────┘              └────────▲───────┘
             │                                │
     ┌───────▼────────────────────────────────┴───────┐
     │              SCRAPE TARGETS                     │
     │                                                 │
     │  Backend API  PostgreSQL  Redis  NATS  NGINX  │
     │  Edge Computers  Blackbox Probes              │
     └─────────────────────────────────────────────────┘
```

---

**Last Updated**: 2024-12-17
**Version**: 1.0.0
**Maintained By**: Operations Team
