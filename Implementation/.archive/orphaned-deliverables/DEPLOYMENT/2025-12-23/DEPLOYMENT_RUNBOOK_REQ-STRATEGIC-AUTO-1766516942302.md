# Deployment Runbook: REQ-STRATEGIC-AUTO-1766516942302
## Bin Utilization Algorithm Optimization

**Agent:** Berry (DevOps Specialist)
**Date:** 2025-12-24
**Status:** Production-Ready
**Product Owner:** Marcus (Warehouse Product Owner)

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Deployment Steps](#deployment-steps)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring & Alerting](#monitoring--alerting)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Operational Procedures](#operational-procedures)

---

## Overview

This runbook provides step-by-step instructions for deploying the Bin Utilization Algorithm optimization features, including:

- **Backend Services:** Optimized bin utilization algorithms, ML feedback loops, monitoring
- **Frontend UI:** Health monitoring dashboard, enhanced bin utilization views
- **Database:** Materialized views, automated triggers, pg_cron scheduled refresh
- **Monitoring:** Prometheus metrics, Grafana dashboards, alert rules

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)                    │
│  - Health Monitoring Dashboard (/wms/health)                │
│  - Enhanced Bin Utilization (/wms/bin-utilization-enhanced) │
└──────────────────────┬──────────────────────────────────────┘
                       │ GraphQL over HTTP
┌──────────────────────┴──────────────────────────────────────┐
│              Backend (Node.js + Apollo Server)               │
│  - GraphQL Resolvers (bin optimization queries/mutations)   │
│  - Monitoring Service (health checks, Prometheus metrics)   │
│  - ML Feedback Service (model training, accuracy tracking)  │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL Queries
┌──────────────────────┴──────────────────────────────────────┐
│                PostgreSQL Database (v13+)                    │
│  - Materialized View: bin_utilization_cache                 │
│  - Triggers: Auto-refresh on lot/transaction changes        │
│  - pg_cron: Scheduled refresh every 10 minutes              │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### System Requirements

- **PostgreSQL:** Version 13 or higher
- **Node.js:** Version 18 or higher
- **npm:** Version 9 or higher
- **Disk Space:** 500MB for backend, 200MB for frontend build
- **Memory:** 2GB minimum for backend service
- **CPU:** 2 cores recommended

### Required Extensions

```sql
-- PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_cron";  -- Optional but recommended
```

### Access Requirements

- **Database:** Superuser or CREATEDB privileges (for migrations)
- **Server:** SSH access with sudo privileges
- **Monitoring:** Access to Prometheus and Grafana (if using)

### Environment Variables

```bash
# Database
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="agogsaas"
export DB_USER="postgres"
export DB_PASSWORD="your_secure_password"

# Backend
export PORT="4000"
export NODE_ENV="production"
export GRAPHQL_ENDPOINT="http://localhost:4000/graphql"

# Frontend
export VITE_GRAPHQL_ENDPOINT="http://localhost:4000/graphql"

# Monitoring (optional)
export PROMETHEUS_ENABLED="true"
export ALERT_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

---

## Pre-Deployment Checklist

### 1. Data Quality Audit

**Purpose:** Ensure data quality before activating optimization algorithms.

```bash
cd print-industry-erp/backend

# Run data quality audit
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
SELECT 'Missing Material Dimensions' as issue_type, COUNT(*) as count
FROM materials
WHERE width_inches IS NULL OR height_inches IS NULL OR length_inches IS NULL
UNION ALL
SELECT 'Missing ABC Classification', COUNT(*)
FROM materials
WHERE abc_classification IS NULL
UNION ALL
SELECT 'Invalid Bin Capacity', COUNT(*)
FROM inventory_locations
WHERE cubic_feet <= 0 OR max_weight_lbs <= 0;
EOF
```

**Action Items:**
- ✅ If count = 0: Proceed with deployment
- ⚠️ If count > 0 but < 100: Proceed with warnings (algorithm will use fallbacks)
- ❌ If count > 100: Fix data quality issues before deploying

### 2. Database Backup

**CRITICAL:** Always backup database before running migrations.

```bash
# Create backup
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  -Fc -f "backup_pre_bin_optimization_$(date +%Y%m%d_%H%M%S).dump"

# Verify backup
pg_restore --list "backup_pre_bin_optimization_$(date +%Y%m%d_%H%M%S).dump" | head -20
```

### 3. Verify Existing Schema

```bash
# Check if previous migrations were applied
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('materials', 'inventory_locations', 'lots', 'inventory_transactions')
ORDER BY table_name;
"
```

**Expected Output:** All 4 tables should exist.

### 4. Check Disk Space

```bash
# Check database disk space
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname))
FROM pg_database
WHERE datname = '$DB_NAME';
"

# Check server disk space
df -h
```

**Requirement:** At least 10GB free disk space.

---

## Deployment Steps

### Step 1: Deploy Database Migrations

**Estimated Time:** 5-10 minutes (depending on data volume)

```bash
cd print-industry-erp/backend

# Apply migrations in order
MIGRATIONS=(
  "migrations/V0.0.15__add_bin_utilization_tracking.sql"
  "migrations/V0.0.16__optimize_bin_utilization_algorithm.sql"
  "migrations/V0.0.18__add_bin_optimization_triggers.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  echo "Applying: $migration"
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration"
  if [ $? -ne 0 ]; then
    echo "ERROR: Migration failed. Rolling back..."
    # Restore from backup
    pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "backup_pre_bin_optimization_*.dump"
    exit 1
  fi
done
```

**What This Does:**
- V0.0.15: Creates materialized view `bin_utilization_cache`
- V0.0.16: Adds performance indexes and refresh function
- V0.0.18: Adds automated triggers and cache tracking

### Step 2: Configure pg_cron (Optional but Recommended)

**Purpose:** Automatically refresh cache every 10 minutes.

```sql
-- Connect to database
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if it exists
SELECT cron.unschedule('refresh_bin_util');

-- Schedule cache refresh every 10 minutes
SELECT cron.schedule(
  'refresh_bin_util',
  '*/10 * * * *',
  $$SELECT scheduled_refresh_bin_utilization();$$
);

-- Verify job was created
SELECT jobid, schedule, command, nodename, active
FROM cron.job
WHERE jobname = 'refresh_bin_util';
```

**If pg_cron is NOT available:**
- Set up external cron job on server
- Or manually refresh via GraphQL mutation: `mutation { refreshBinUtilizationCache }`

### Step 3: Initial Cache Population

**Purpose:** Populate materialized view for the first time.

```sql
-- Manually refresh cache (first time)
REFRESH MATERIALIZED VIEW CONCURRENTLY bin_utilization_cache;

-- Verify cache was populated
SELECT COUNT(*) as total_cached_locations FROM bin_utilization_cache;
```

**Expected:** Should match total active locations in your warehouse.

### Step 4: Deploy Backend Services

```bash
cd print-industry-erp/backend

# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Test build
node dist/index.js --version

# Start backend (production mode)
# Option 1: Using npm
npm start

# Option 2: Using PM2 (recommended for production)
npm install -g pm2
pm2 start dist/index.js --name "agogsaas-backend"
pm2 save
pm2 startup

# Verify backend is running
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'
```

**Expected:** GraphQL introspection query should return schema types.

### Step 5: Deploy Frontend Application

```bash
cd print-industry-erp/frontend

# Install dependencies
npm install

# Build for production
npm run build

# Verify build output
ls -lh dist/

# Option 1: Serve with Vite preview
npm run preview

# Option 2: Deploy to web server (Nginx example)
sudo cp -r dist/* /var/www/html/agogsaas/

# Option 3: Deploy to CDN (example with AWS S3)
aws s3 sync dist/ s3://your-bucket-name/agogsaas/ --acl public-read
```

### Step 6: Automated Deployment Script

**Alternatively, use the provided deployment script:**

```bash
cd print-industry-erp/backend/scripts

# Make script executable
chmod +x deploy-bin-optimization.sh

# Run deployment (dry-run mode first)
DRY_RUN=true ./deploy-bin-optimization.sh

# Run actual deployment
DB_PASSWORD="your_password" \
ENVIRONMENT="production" \
./deploy-bin-optimization.sh
```

---

## Post-Deployment Verification

### 1. Database Verification

```bash
# Check materialized view
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
-- Verify materialized view exists
SELECT schemaname, matviewname, matviewowner
FROM pg_matviews
WHERE matviewname = 'bin_utilization_cache';

-- Check cache data
SELECT COUNT(*) as total_locations,
       MAX(last_updated) as latest_update,
       EXTRACT(EPOCH FROM (NOW() - MAX(last_updated)))/60 as age_minutes
FROM bin_utilization_cache;

-- Verify triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%bin_cache%';
EOF
```

**Expected Output:**
- ✅ Materialized view exists
- ✅ Cache contains data
- ✅ Cache age < 15 minutes
- ✅ 2 triggers configured

### 2. Backend Service Verification

```bash
# Health check endpoint
curl http://localhost:4000/api/wms/optimization/health | jq

# Prometheus metrics endpoint
curl http://localhost:4000/metrics | grep bin_utilization

# GraphQL bin optimization queries
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ getBinOptimizationHealth { status checks { materializedViewFreshness { status message } } } }"}'
```

**Expected Output:**
- ✅ Health status: HEALTHY
- ✅ Prometheus metrics exported
- ✅ GraphQL query returns valid data

### 3. Frontend Verification

```bash
# Test frontend URLs
curl -I http://localhost:5173/wms/health
curl -I http://localhost:5173/wms/bin-utilization-enhanced

# Check JavaScript bundle
ls -lh print-industry-erp/frontend/dist/assets/*.js

# Verify environment configuration
grep VITE_GRAPHQL_ENDPOINT print-industry-erp/frontend/dist/index.html
```

**Manual Testing:**
1. Navigate to `http://localhost:5173/wms/health`
2. Verify health checks display correctly
3. Check for console errors (F12 Developer Tools)
4. Test manual refresh button
5. Verify 30-second auto-polling

### 4. Monitoring Verification

```bash
# Run health check script
cd print-industry-erp/backend/scripts
chmod +x health-check.sh
./health-check.sh

# Check Prometheus metrics (if configured)
curl http://localhost:9090/api/v1/query?query=bin_utilization_cache_age_seconds

# Access Grafana dashboard
# URL: http://localhost:3000/d/bin-optimization-dashboard
```

---

## Rollback Procedures

### Emergency Rollback (< 1 hour after deployment)

**If critical issues are detected:**

```bash
# 1. Stop backend service
pm2 stop agogsaas-backend
# OR
killall node

# 2. Restore database from backup
pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
  "backup_pre_bin_optimization_YYYYMMDD_HHMMSS.dump"

# 3. Revert frontend deployment
# (Restore previous dist/ folder or CDN files)

# 4. Restart backend with previous version
cd print-industry-erp/backend
git checkout HEAD~1  # Or specific commit before deployment
npm install
npm run build
npm start
```

### Partial Rollback (Disable specific features)

**To disable automated cache refresh:**

```sql
-- Disable pg_cron job
SELECT cron.unschedule('refresh_bin_util');

-- Or disable triggers
ALTER TABLE lots DISABLE TRIGGER trigger_lots_refresh_bin_cache;
ALTER TABLE inventory_transactions DISABLE TRIGGER trigger_inventory_tx_refresh_bin_cache;
```

**To revert to baseline algorithm (disable ML):**

```typescript
// In backend code: src/modules/wms/services/bin-utilization-optimization.service.ts
const USE_ML_ADJUSTMENT = false;  // Set to false
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

**Critical Metrics (Alert if threshold exceeded):**
- Cache Age: >30 minutes = CRITICAL
- ML Accuracy: <70% = CRITICAL
- Query Performance: >500ms = WARNING
- API Availability: Down for >2 minutes = CRITICAL

**Performance Metrics:**
- Batch processing time: P95 < 2 seconds
- Recommendation throughput: Recommendations per hour
- Acceptance rate: Target >80%

### Prometheus Queries

```promql
# Cache age in minutes
bin_utilization_cache_age_seconds / 60

# ML accuracy percentage
ml_model_accuracy_percentage

# P95 batch processing time
histogram_quantile(0.95, sum(rate(batch_putaway_processing_time_ms_bucket[5m])) by (le))

# Recommendation acceptance rate
putaway_acceptance_rate_percentage
```

### Alert Escalation

**CRITICAL Alerts:**
1. Immediate PagerDuty notification
2. Slack alert to #warehouse-ops
3. Email to on-call engineer
4. Auto-create incident ticket

**WARNING Alerts:**
1. Slack notification
2. Email digest (hourly)
3. Dashboard annotation

---

## Troubleshooting Guide

### Issue: Cache Age Exceeds 30 Minutes

**Symptoms:**
- Health dashboard shows DEGRADED or UNHEALTHY
- Alert: "Bin utilization cache is stale"

**Diagnosis:**
```sql
-- Check pg_cron job status
SELECT * FROM cron.job WHERE jobname = 'refresh_bin_util';

-- Check for blocking locks
SELECT pid, usename, query, state
FROM pg_stat_activity
WHERE query LIKE '%bin_utilization_cache%';

-- Check cache refresh errors
SELECT * FROM cache_refresh_status
WHERE cache_name = 'bin_utilization_cache'
ORDER BY refreshed_at DESC
LIMIT 5;
```

**Solutions:**

1. **If pg_cron job is inactive:**
   ```sql
   SELECT cron.schedule('refresh_bin_util', '*/10 * * * *', $$SELECT scheduled_refresh_bin_utilization();$$);
   ```

2. **If database is locked:**
   ```sql
   -- Kill blocking queries (use with caution)
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE query LIKE '%bin_utilization_cache%' AND state = 'idle in transaction';
   ```

3. **Manual refresh:**
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY bin_utilization_cache;
   ```

### Issue: ML Accuracy Below 70%

**Symptoms:**
- Health dashboard shows ML accuracy <70%
- High recommendation rejection rate

**Diagnosis:**
```sql
-- Check recent feedback data
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_recommendations,
  COUNT(*) FILTER (WHERE was_accepted = TRUE) as accepted,
  ROUND(100.0 * COUNT(*) FILTER (WHERE was_accepted = TRUE) / COUNT(*), 1) as accuracy_pct
FROM putaway_recommendations
WHERE created_at > NOW() - INTERVAL '7 days'
AND user_feedback IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Check for data quality issues
SELECT COUNT(*) FROM materials WHERE width_inches IS NULL;
SELECT COUNT(*) FROM materials WHERE abc_classification IS NULL;
```

**Solutions:**

1. **Review feedback patterns:**
   ```sql
   SELECT rejection_reason, COUNT(*)
   FROM putaway_recommendations
   WHERE was_accepted = FALSE
   AND created_at > NOW() - INTERVAL '7 days'
   GROUP BY rejection_reason;
   ```

2. **Retrain ML model:**
   ```graphql
   mutation {
     trainMLModel {
       success
       message
       accuracy
     }
   }
   ```

3. **Rollback to baseline algorithm:**
   - Disable ML adjustment feature flag
   - Use FFD algorithm without ML confidence adjustment

### Issue: High Query Latency (>500ms)

**Symptoms:**
- Health dashboard shows query time >500ms
- Slow page loads

**Diagnosis:**
```sql
-- Check query execution plan
EXPLAIN ANALYZE SELECT * FROM bin_utilization_cache WHERE facility_id = 'FAC-001' LIMIT 10;

-- Check table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename = 'bin_utilization_cache';

-- Check for missing indexes
SELECT * FROM pg_stat_user_tables WHERE relname = 'bin_utilization_cache';
```

**Solutions:**

1. **Vacuum and analyze:**
   ```sql
   VACUUM ANALYZE bin_utilization_cache;
   ```

2. **Reindex materialized view:**
   ```sql
   REINDEX TABLE bin_utilization_cache;
   ```

3. **Check server load:**
   ```bash
   top
   iostat -x 1 5
   ```

### Issue: No Recommendations Generated

**Symptoms:**
- GraphQL query returns empty results
- Dashboard shows 0 recommendations

**Diagnosis:**
```sql
-- Check if materials exist
SELECT COUNT(*) FROM materials WHERE tenant_id = 'your-tenant-id';

-- Check if locations exist
SELECT COUNT(*) FROM inventory_locations WHERE tenant_id = 'your-tenant-id' AND is_active = TRUE;

-- Check for recent errors in logs
-- (Check application logs via journalctl or log files)
```

**Solutions:**

1. **Verify data exists:**
   - Ensure materials are configured
   - Ensure locations are active
   - Check tenant_id is correct

2. **Check algorithm parameters:**
   - Review GraphQL query input
   - Verify facility_id is valid
   - Check filter criteria

---

## Operational Procedures

### Daily Operations

**Morning Health Check:**
```bash
cd print-industry-erp/backend/scripts
./health-check.sh
```

**Review Metrics:**
- Grafana dashboard: http://localhost:3000/d/bin-optimization-dashboard
- Check for any WARNING or CRITICAL alerts

### Weekly Operations

**Data Quality Audit:**
```bash
# Run data quality audit
cd print-industry-erp/backend
npm run audit:data-quality
```

**ML Model Review:**
```sql
-- Review ML accuracy trend
SELECT
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE was_accepted = TRUE) / COUNT(*), 1) as accuracy_pct
FROM putaway_recommendations
WHERE created_at > NOW() - INTERVAL '30 days'
AND user_feedback IS NOT NULL
GROUP BY week
ORDER BY week DESC;
```

### Monthly Operations

**ML Model Retraining:**
```graphql
mutation {
  trainMLModel {
    success
    message
    accuracy
    sampleSize
  }
}
```

**Performance Review:**
- Review P95 latency trends
- Analyze cache refresh patterns
- Check for database table bloat
- Plan capacity scaling if needed

### Quarterly Operations

**Full System Audit:**
- Review all critical and warning alerts
- Analyze user feedback trends
- Plan algorithm enhancements
- Update documentation

---

## Contact Information

**Product Owner:** Marcus (Warehouse Product Owner)
**DevOps Lead:** Berry (DevOps Specialist)
**Backend Lead:** Roy (Backend Specialist)
**Frontend Lead:** Jen (Frontend Specialist)
**QA Lead:** Billy (QA Specialist)

**Support Channels:**
- Slack: #warehouse-ops
- Email: support@agogsaas.com
- PagerDuty: On-call rotation

---

**Last Updated:** 2025-12-24
**Document Version:** 1.0
**REQ Number:** REQ-STRATEGIC-AUTO-1766516942302
