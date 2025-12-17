# AgogSaaS Alerting Runbook

**Incident response procedures for all alerts**

This runbook provides step-by-step procedures for responding to every alert in the AgogSaaS monitoring system.

## Table of Contents

1. [Alert Response Framework](#alert-response-framework)
2. [Critical Alerts](#critical-alerts)
3. [Warning Alerts](#warning-alerts)
4. [Business Metric Alerts](#business-metric-alerts)
5. [Escalation Procedures](#escalation-procedures)

---

## Alert Response Framework

### Response Priorities

| Severity | Response Time | Actions |
|----------|--------------|---------|
| **Critical** | < 5 minutes | Immediate investigation, page on-call |
| **Warning** | < 30 minutes | Investigate during business hours |
| **Info** | < 4 hours | Review and track |

### Standard Response Process

1. **Acknowledge** - Acknowledge alert in PagerDuty/Slack
2. **Assess** - Check Grafana dashboards for context
3. **Investigate** - Review logs, metrics, recent changes
4. **Mitigate** - Take action to restore service
5. **Communicate** - Update status page, notify stakeholders
6. **Document** - Record incident details, root cause
7. **Follow-up** - Post-mortem, preventive measures

---

## Critical Alerts

### 🚨 ServiceDown

**Alert**: `Service {{ job }} is down`

**What it means**: A core service (backend, database, redis, nats) is not responding to health checks for > 2 minutes.

**Impact**: Complete or partial service outage. Users cannot access the platform.

**Investigation Steps:**

1. **Check which service is down:**
   ```bash
   docker ps | grep -i {{ job }}
   ```

2. **Check service logs:**
   ```bash
   docker logs {{ job }} --tail 100
   ```

3. **Check health endpoint:**
   ```bash
   curl http://localhost:4000/health
   ```

4. **Check system resources:**
   ```bash
   docker stats {{ job }}
   free -h
   df -h
   ```

**Common Causes:**

- **Out of Memory (OOM)**: Container killed by Docker
  - **Solution**: Increase memory limit, investigate memory leak

- **Configuration error**: Service won't start
  - **Solution**: Review logs, fix config, restart service

- **Database connection failure**: Can't connect to DB
  - **Solution**: Check database health, network connectivity

- **Crash loop**: Service starts then immediately crashes
  - **Solution**: Review logs for stack trace, rollback if recent deploy

**Resolution:**

```bash
# Restart service
docker-compose restart {{ job }}

# Or restart entire stack
docker-compose down && docker-compose up -d

# Check health after restart
watch -n 1 'curl -s http://localhost:4000/health | jq'
```

**Escalation**: If issue persists > 10 minutes, page senior engineer.

---

### 🚨 EdgeFacilityOffline

**Alert**: `Edge facility {{ facility_name }} is offline`

**What it means**: Edge computer at customer facility has not synced to regional cloud for > 5 minutes.

**Impact**: Customer cannot capture production data. Facility operations may be impacted.

**Investigation Steps:**

1. **Check Edge Monitoring dashboard** in Grafana

2. **Review facility status:**
   ```sql
   SELECT * FROM facility_status WHERE facility_id = '{{ facility_id }}';
   ```

3. **Check edge health monitor logs:**
   ```bash
   docker logs backend-blue | grep "{{ facility_name }}"
   ```

4. **Contact facility IT staff** (automated via EdgeHealthMonitorService):
   - SMS sent
   - Phone call to primary contact
   - Teams/Slack message

**Common Causes:**

- **Internet outage**: Facility lost internet connectivity
  - **Customer Action**: Check ISP, router, firewall

- **Edge computer powered off**: Hardware issue
  - **Customer Action**: Check power, restart computer

- **VPN tunnel down**: Tailscale/WireGuard disconnected
  - **Customer Action**: `tailscale status`, restart VPN

- **Edge software crash**: Docker container stopped
  - **Customer Action**: `docker-compose restart`

**Resolution:**

1. **Guide customer through troubleshooting** (steps sent via SMS)
2. **Offer remote assistance** if customer permits
3. **Enable cloud fallback mode** if extended outage:
   ```sql
   UPDATE facilities SET mode = 'cloud_fallback' WHERE id = '{{ facility_id }}';
   ```
4. **Schedule on-site visit** if hardware failure

**Escalation**:
- If offline > 1 hour: Escalate to customer success manager
- If offline > 4 hours: Offer replacement edge computer

---

### 🚨 HighErrorRate

**Alert**: `Error rate > 5% on {{ job }}`

**What it means**: More than 5% of HTTP requests are returning 5xx errors.

**Impact**: Users experiencing errors. Critical functionality may be broken.

**Investigation Steps:**

1. **Check API Performance dashboard** - identify error spike timing

2. **Review error logs:**
   ```bash
   docker logs backend-blue | grep ERROR | tail -50
   ```

3. **Check for patterns:**
   ```logql
   {container="backend-blue", level="error"} |= ""
   ```

4. **Check recent deployments:**
   ```bash
   git log --oneline -10
   docker images | grep backend
   ```

**Common Causes:**

- **Bad deployment**: Recent code change introduced bug
  - **Solution**: Rollback to previous version

- **Database connection issues**: Connection pool exhausted
  - **Solution**: Restart backend, check connection leaks

- **External API failures**: Stripe, SendGrid, etc. down
  - **Solution**: Implement circuit breaker, fallback logic

- **Resource exhaustion**: Out of memory, CPU maxed
  - **Solution**: Scale horizontally, optimize code

**Resolution:**

```bash
# Option 1: Rollback (if recent deployment)
./scripts/switch-blue-green.sh blue  # Switch back to stable

# Option 2: Restart service
docker-compose restart backend-blue

# Option 3: Scale horizontally
docker-compose up -d --scale backend-blue=5

# Monitor error rate
watch -n 5 'curl -s http://localhost:9090/api/v1/query?query=rate(http_requests_total{status_code=~"5.."}[5m])'
```

**Escalation**: If error rate not decreasing after 15 minutes, page engineering lead.

---

### 🚨 DatabaseConnectionPoolExhausted

**Alert**: `Database connection pool nearly exhausted`

**What it means**: Backend is using > 90% of available database connections (180+ of 200).

**Impact**: New requests will fail. Users cannot perform operations.

**Investigation Steps:**

1. **Check Database Performance dashboard**

2. **Identify active connections:**
   ```sql
   SELECT
     pid,
     usename,
     application_name,
     state,
     query,
     state_change
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY state_change;
   ```

3. **Check for long-running queries:**
   ```sql
   SELECT
     pid,
     now() - query_start AS duration,
     query
   FROM pg_stat_activity
   WHERE state = 'active'
     AND now() - query_start > interval '30 seconds'
   ORDER BY duration DESC;
   ```

**Common Causes:**

- **Connection leaks**: Application not closing connections
  - **Solution**: Review code, ensure proper connection handling

- **Slow queries**: Queries taking too long, holding connections
  - **Solution**: Kill slow queries, add indexes

- **Traffic spike**: Legitimate high load
  - **Solution**: Scale backend horizontally

**Resolution:**

```sql
-- Option 1: Kill specific slow query
SELECT pg_terminate_backend(12345);  -- Replace with PID

-- Option 2: Kill all idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < now() - interval '5 minutes';

-- Option 3: Increase connection limit (requires restart)
ALTER SYSTEM SET max_connections = 300;
SELECT pg_reload_conf();
```

```bash
# Restart backend to clear connection pool
docker-compose restart backend-blue backend-green
```

**Escalation**: If issue persists, increase max_connections and restart database (requires maintenance window).

---

### 🚨 DatabaseReplicationLagHigh

**Alert**: `Replication lag > 60s on {{ instance }}`

**What it means**: Data sync between edge/regional/global is delayed by > 1 minute.

**Impact**: Users may see stale data. Reports may be inaccurate.

**Investigation Steps:**

1. **Check Database Performance dashboard** - Replication Lag panel

2. **Identify replication slots:**
   ```sql
   SELECT * FROM pg_replication_slots;
   ```

3. **Check replication status:**
   ```sql
   SELECT
     application_name,
     state,
     sent_lsn,
     write_lsn,
     flush_lsn,
     replay_lsn,
     sync_state
   FROM pg_stat_replication;
   ```

4. **Check WAL generation rate:**
   ```sql
   SELECT pg_current_wal_lsn();
   ```

**Common Causes:**

- **Network issues**: Poor connectivity between regions
  - **Solution**: Check network latency, bandwidth

- **Large transaction**: Bulk operation blocking replication
  - **Solution**: Break into smaller transactions

- **Subscriber overloaded**: Replica can't keep up
  - **Solution**: Scale subscriber resources

**Resolution:**

```bash
# Check network latency
ping -c 10 {{ replica_host }}

# Check replication slot lag
psql -c "SELECT slot_name, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag FROM pg_replication_slots;"

# Temporarily pause non-critical writes
# (coordinate with team first)
```

**Escalation**: If lag > 5 minutes, engage database team.

---

## Warning Alerts

### ⚠️ HighResponseTime

**Alert**: `P95 response time > 2s on {{ job }}`

**What it means**: 95% of requests are taking longer than 2 seconds.

**Impact**: Poor user experience. Users report "slowness".

**Investigation:**

1. Check API Performance dashboard
2. Identify slowest GraphQL queries
3. Check Database Performance dashboard for slow queries
4. Profile application CPU usage

**Common Causes:**
- N+1 queries in GraphQL resolvers
- Missing database indexes
- Low cache hit rate
- Inefficient algorithms

**Resolution:**
- Add DataLoader to batch queries
- Add database indexes
- Optimize query logic
- Review recent code changes

---

### ⚠️ DiskSpaceLow

**Alert**: `Disk space < 15% on {{ instance }}`

**Investigation:**

```bash
# Check disk usage
df -h

# Find large files
du -sh /* | sort -rh | head -10

# Check Docker disk usage
docker system df
```

**Resolution:**

```bash
# Clean up Docker
docker system prune -a --volumes

# Rotate logs
journalctl --vacuum-time=7d

# Clean old backups
find /backups -mtime +30 -delete
```

---

### ⚠️ HighMemoryUsage

**Alert**: `Memory usage > 90% on {{ instance }}`

**Investigation:**

```bash
# Check memory usage
free -h
docker stats

# Identify memory-hungry processes
ps aux --sort=-%mem | head -10
```

**Resolution:**

```bash
# Restart memory-hungry service
docker-compose restart backend-blue

# Clear caches
sync; echo 3 > /proc/sys/vm/drop_caches

# Scale horizontally if sustained
docker-compose up -d --scale backend-blue=5
```

---

### ⚠️ HighCPUUsage

**Alert**: `CPU usage > 85% on {{ instance }}`

**Investigation:**

```bash
# Check CPU usage
top
docker stats

# Profile application
node --prof app.js  # For Node.js apps
```

**Resolution:**
- Identify CPU-intensive operations
- Optimize hot code paths
- Scale horizontally
- Add caching

---

## Business Metric Alerts

### ℹ️ NoProductionRunsActive

**Alert**: `No production runs active for 30 minutes`

**What it means**: No facilities are currently running production jobs.

**Impact**: May indicate business operations have stopped.

**Investigation:**

1. Check if during business hours (8am-6pm local time)
2. Check Edge Monitoring dashboard - are facilities online?
3. Contact facility managers if unexpected

**Resolution**: Usually informational. No action needed outside business hours.

---

### ℹ️ LowMaterialUtilization

**Alert**: `Material utilization < 75% for 1 hour`

**What it means**: Facilities are wasting material (not optimally nesting jobs).

**Impact**: Increased costs, lower profitability.

**Investigation:**

1. Check Business Metrics dashboard
2. Identify facilities with lowest utilization
3. Review nesting algorithm performance

**Resolution:**
- Schedule customer training
- Optimize nesting algorithm
- Review job planning efficiency

---

### 🚨 FailedLoginAttemptsSpike

**Alert**: `Failed login rate > 10/sec`

**What it means**: Possible brute force attack or credential stuffing.

**Impact**: Security risk. Potential account compromise.

**Investigation:**

1. Check Security Monitoring dashboard
2. Review failed login logs:
   ```logql
   {container="backend-blue"} |= "failed login"
   ```
3. Identify source IP addresses

**Resolution:**

```bash
# Enable rate limiting (if not active)
# Block suspicious IPs at firewall level

# Example: Block IP in iptables
iptables -A INPUT -s 192.168.1.100 -j DROP

# Or use Cloudflare/WAF to block
```

**Escalation**: Notify security team immediately.

---

## Escalation Procedures

### On-Call Rotation

| Team | Hours | Contact |
|------|-------|---------|
| Operations | 24/7 | PagerDuty |
| Engineering | Business hours | Slack #engineering |
| Customer Success | Business hours | Slack #customer-success |
| Security | 24/7 | security@agogsaas.com |

### Escalation Levels

**Level 1**: On-call engineer (primary responder)
**Level 2**: Engineering lead (if issue > 30 min)
**Level 3**: CTO (if issue > 1 hour or customer-facing)
**Level 4**: CEO (if major outage > 4 hours)

### Communication

**Internal**: Slack #incidents channel
**External**: Update status page (https://status.agogsaas.com)
**Customers**: Email/SMS if their facility impacted

### Post-Incident

1. **Write incident report** within 24 hours
2. **Conduct blameless post-mortem**
3. **Identify root cause** and preventive measures
4. **Update runbook** with lessons learned
5. **Implement fixes** to prevent recurrence

---

## Emergency Contacts

- **Operations Team**: ops@agogsaas.com
- **On-Call**: PagerDuty (1-800-XXX-XXXX)
- **Security Team**: security@agogsaas.com
- **Customer Success**: success@agogsaas.com
- **Todd (CEO)**: todd@agogsaas.com

---

**Last Updated**: 2024-12-17
**Maintained By**: Operations Team
**Review Schedule**: Quarterly
