# AgogSaaS Monitoring Guide

**Complete observability for AgogSaaS platform**

This guide explains how to access and use the AgogSaaS monitoring system to understand system health, troubleshoot issues, and track business metrics.

## Table of Contents

1. [Quick Access](#quick-access)
2. [Grafana Dashboards](#grafana-dashboards)
3. [Understanding Alerts](#understanding-alerts)
4. [Log Analysis](#log-analysis)
5. [Common Troubleshooting](#common-troubleshooting)
6. [Metrics Reference](#metrics-reference)

---

## Quick Access

### URLs

**Regional Cloud (per region):**
- **Grafana**: `http://localhost:3000` (local) or `https://grafana.{region}.agogsaas.com`
- **Prometheus**: `http://localhost:9090` (local) or `https://prometheus.{region}.agogsaas.com`
- **AlertManager**: `http://localhost:9093` (local)
- **Status Page**: `https://status.agogsaas.com` (public)

### Default Credentials

**Grafana:**
- **Username**: `admin`
- **Password**: Check `.env` file for `GRAFANA_PASSWORD` (default: `changeme`)

**IMPORTANT**: Change default password on first login!

```bash
# Generate secure password
openssl rand -base64 32
```

---

## Grafana Dashboards

We provide 6 pre-configured dashboards for complete observability:

### 1. Executive Overview Dashboard

**Path**: `AgogSaaS → Executive Overview`

**What it shows:**
- System health (services online/offline)
- Request rate (req/sec)
- Error rate (%)
- Response time (P50, P95, P99)
- Database connections
- Active users
- Edge facility map (online/offline status)
- Active alerts

**Who uses it:** Todd, executives, operations team

**When to check:**
- Daily health check
- When customers report issues
- Before/after deployments
- During incidents

**Key metrics:**
- 🟢 **Good**: Error rate < 1%, Response time P95 < 1s
- 🟡 **Warning**: Error rate 1-5%, Response time P95 1-3s
- 🔴 **Critical**: Error rate > 5%, Response time P95 > 3s

---

### 2. Edge Computer Monitoring Dashboard

**Path**: `AgogSaaS → Edge Computer Monitoring`

**What it shows:**
- Edge facilities online/offline count
- CPU usage per facility
- Memory usage per facility
- Disk usage per facility
- PostgreSQL connection status
- Last sync time to regional cloud
- Production data capture rate
- OEE by facility

**Who uses it:** Customer success team, facility IT staff

**When to check:**
- When edge facility goes offline
- Customer reports production issues
- Troubleshooting slow sync
- Capacity planning

**Alerts configured:**
- Edge offline > 5 minutes
- Disk space < 10%
- Memory usage > 90%

---

### 3. Database Performance Dashboard

**Path**: `AgogSaaS → Database Performance`

**What it shows:**
- Connection pool utilization
- Slow queries (> 1s)
- Replication lag (edge → regional → global)
- Cache hit ratio
- Transaction rate
- Table sizes
- Index usage efficiency
- Active connections by state

**Who uses it:** Engineering team, DBAs

**When to check:**
- API response time increases
- Database alerts fire
- Before schema changes
- Performance optimization

**Key metrics:**
- 🟢 **Good**: Cache hit ratio > 95%, Connection pool < 70%
- 🟡 **Warning**: Cache hit ratio 85-95%, Connection pool 70-90%
- 🔴 **Critical**: Cache hit ratio < 85%, Connection pool > 90%

---

### 4. API Performance Dashboard

**Path**: `AgogSaaS → API Performance`

**What it shows:**
- GraphQL requests/sec
- Query success rate
- Top 10 slowest queries
- Error breakdown (4xx vs 5xx)
- Concurrent users
- WebSocket connections
- Mutation success/failure rates
- API latency percentiles

**Who uses it:** Engineering team, API developers

**When to check:**
- Users report slow responses
- Debugging GraphQL queries
- Optimizing API performance
- After code deployments

**Common issues:**
- **Slow queries**: Check N+1 queries, add DataLoader
- **High error rate**: Check logs for stack traces
- **High latency**: Check database query performance

---

### 5. Business Metrics Dashboard

**Path**: `AgogSaaS → Business Metrics`

**What it shows:**
- Active production runs
- Material utilization % (target: 85%)
- OEE by facility
- Orders created (last 24h)
- Marketplace jobs posted
- Revenue (last 24h)
- Order fulfillment rate
- Production volume by facility

**Who uses it:** Todd, product team, customer success

**When to check:**
- Daily business review
- Customer health checks
- Identifying underutilized facilities
- Sales reporting

**Business goals:**
- Material utilization > 85%
- OEE > 75%
- Order fulfillment rate > 95%

---

### 6. Security Monitoring Dashboard

**Path**: `AgogSaaS → Security Monitoring`

**What it shows:**
- Failed login attempts
- Unauthorized access attempts
- Vault access log
- Chain of custody events
- Suspicious activity alerts
- Authentication methods used
- Security audit log

**Who uses it:** Security team, compliance

**When to check:**
- Daily security review
- Investigating security incidents
- Compliance audits
- Unusual login patterns

**Alerts configured:**
- Failed login rate > 10/sec (possible brute force)
- Unauthorized access attempts spike

---

## Understanding Alerts

### Alert Levels

**Critical** 🔴
- Immediate action required
- Service down or major degradation
- PagerDuty notification sent
- Examples: Service down, edge offline, high error rate

**Warning** 🟡
- Action required soon
- Degraded performance or resource limits
- Slack/Teams notification
- Examples: High CPU, disk space low, slow queries

**Info** ℹ️
- Informational only
- No immediate action needed
- Examples: Low material utilization, no production runs

### Alert Routing

Alerts are routed to appropriate teams:

| Alert Type | Team | Channels |
|------------|------|----------|
| Service Down | Operations | PagerDuty, Slack, Email |
| Edge Offline | Customer Success | Teams, Slack, Email |
| Security Issues | Security Team | Slack, Email |
| High Error Rate | Engineering | Slack, Email |
| Business Metrics | Product Team | Slack |

### Silencing Alerts

During maintenance windows:

1. Go to AlertManager: `http://localhost:9093`
2. Click "Silence" on alert
3. Set duration (e.g., 2 hours)
4. Add reason: "Planned maintenance"

---

## Log Analysis

### Accessing Logs

**Via Grafana:**
1. Open Grafana
2. Click "Explore" (compass icon)
3. Select "Loki" datasource
4. Query logs

**Common queries:**

```logql
# All errors in last 1 hour
{level="error"} |= ""

# Errors from specific service
{container="backend-blue", level="error"}

# Failed login attempts
{container="backend-blue"} |= "failed login"

# Slow queries
{container="postgres-blue"} |= "duration" |= "ms" | duration > 1000

# Edge facility logs
{facility_id="facility-001"}

# GraphQL errors
{container="backend-blue"} |= "GraphQL" |= "error"
```

### Log Retention

- **Metrics**: 30 days (Prometheus)
- **Logs**: 7 days (Loki)
- **Long-term**: Export to S3/Azure Blob for compliance

---

## Common Troubleshooting

### "Service is Down" Alert

**Steps:**
1. Check Grafana Executive Overview
2. Identify which service is down
3. Check service logs:
   ```bash
   docker logs backend-blue
   ```
4. Check service health:
   ```bash
   curl http://localhost:4000/health
   ```
5. Restart if needed:
   ```bash
   docker-compose restart backend-blue
   ```

### "High Response Time" Alert

**Steps:**
1. Check API Performance dashboard
2. Identify slowest queries
3. Check database performance dashboard
4. Look for:
   - Slow database queries
   - N+1 query problems
   - Low cache hit rate
5. Review recent code deployments

### "Edge Facility Offline" Alert

**Steps:**
1. Check Edge Monitoring dashboard
2. Verify which facility is offline
3. Contact facility IT staff (automated via health monitor)
4. Common causes:
   - Internet outage at facility
   - Edge computer powered off
   - VPN tunnel down
5. Offer cloud fallback mode if extended outage

### "High Error Rate" Alert

**Steps:**
1. Check API Performance dashboard
2. Identify error types (4xx vs 5xx)
3. Check logs for stack traces:
   ```logql
   {container="backend-blue", level="error"}
   ```
4. Common causes:
   - Bad deployment (rollback)
   - Database connection issues
   - External API failures
5. Consider rollback if error rate rising

### "Database Connection Pool Exhausted"

**Steps:**
1. Check Database Performance dashboard
2. Identify slow queries
3. Check for connection leaks:
   ```sql
   SELECT * FROM pg_stat_activity WHERE state = 'active';
   ```
4. Kill long-running queries if needed:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE ...;
   ```
5. Increase connection pool size if sustained high usage

---

## Metrics Reference

### HTTP Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `http_requests_total` | Total HTTP requests | - |
| `http_request_duration_seconds` | Request duration | P95 > 2s |
| `http_requests_total{status_code=~"5.."}` | Server errors | > 5% |

### Database Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `db_connection_pool_size` | Active connections | > 180 (of 200) |
| `db_query_duration_seconds` | Query duration | P95 > 1s |
| `pg_replication_lag_seconds` | Replication lag | > 60s |

### Business Metrics

| Metric | Description | Goal |
|--------|-------------|------|
| `active_production_runs` | Active production runs | > 0 during business hours |
| `material_utilization_percentage` | Material utilization | > 85% |
| `overall_equipment_effectiveness` | OEE | > 75% |

### Security Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `auth_failed_login_attempts_total` | Failed logins | > 10/sec |
| `auth_unauthorized_access_total` | Unauthorized access | Any spike |

---

## Best Practices

1. **Check dashboards daily** (Executive Overview)
2. **Review alerts weekly** (tune thresholds)
3. **Investigate 5xx errors immediately**
4. **Monitor edge facilities closely** (customer impact)
5. **Track business metrics** (material utilization, OEE)
6. **Perform capacity planning** (scale before limits hit)
7. **Document incident response** (learn from outages)

---

## Getting Help

- **Documentation**: `https://docs.agogsaas.com/monitoring`
- **Runbook**: See `ALERTING_RUNBOOK.md`
- **On-call**: PagerDuty escalation
- **Support**: `ops@agogsaas.com`

---

**Last Updated**: 2024-12-17
**Maintained By**: Operations Team
