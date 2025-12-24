# Deployment Runbook: Bin Utilization Optimization
## REQ-STRATEGIC-AUTO-1766516942302

**Owner:** Berry (DevOps Agent)
**Version:** 1.0
**Last Updated:** 2024-12-24
**Status:** Production Ready

---

## Table of Contents
1. [Overview](#overview)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Procedures](#deployment-procedures)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Rollback Procedures](#rollback-procedures)
6. [Monitoring and Alerts](#monitoring-and-alerts)
7. [Troubleshooting](#troubleshooting)
8. [Emergency Contacts](#emergency-contacts)

---

## Overview

This runbook covers the deployment of the Bin Utilization Optimization feature, which includes:
- Enhanced bin optimization algorithms (FFD/BFD/Hybrid)
- SKU affinity scoring
- Cross-dock detection
- Congestion avoidance
- ML-based confidence scoring
- Automated materialized view refresh
- Comprehensive health monitoring

**Expected Impact:**
- 40-55% pick travel reduction
- 60-85% optimal bin utilization
- <2s processing time for 50-item batches
- >85% ML accuracy target

---

## Pre-Deployment Checklist

### 1. Database Prerequisites

- [ ] **PostgreSQL 16+ installed** with pg_vector extension
- [ ] **pg_cron extension enabled** for scheduled refreshes
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  ```
- [ ] **Database backup completed** (within last 24 hours)
- [ ] **Migration V0.0.15 applied** (bin utilization tracking)
- [ ] **Migration V0.0.16 applied** (performance optimizations)
- [ ] **Migration V0.0.18 ready** (automated triggers)

### 2. Data Quality Audit

Run data quality audit before deployment:

```sql
-- Check for missing dimensions
SELECT COUNT(*) FROM materials
WHERE width_inches IS NULL OR height_inches IS NULL;
-- Expected: <10 items

-- Check for missing ABC classification
SELECT COUNT(*) FROM materials WHERE abc_classification IS NULL;
-- Expected: <100 items (will default to 'C')

-- Check for invalid bin capacity
SELECT COUNT(*) FROM inventory_locations
WHERE cubic_feet <= 0 OR max_weight_lbs <= 0;
-- Expected: 0 items (CRITICAL)
```

**Action Required:** Fix invalid bin capacities before deployment.

### 3. Infrastructure Prerequisites

- [ ] **Kubernetes cluster ready** (v1.28+)
- [ ] **Docker images built** and pushed to registry
- [ ] **Secrets configured:**
  - `database-credentials` (connection URL)
  - `slack-webhook` (for alerts)
- [ ] **ConfigMaps created:**
  - `bin-optimization-config`
  - `prometheus-alerts`
- [ ] **Persistent volumes ready** (for PostgreSQL)
- [ ] **Load balancer configured** (for external access)

### 4. Monitoring Prerequisites

- [ ] **Prometheus installed** and scraping enabled
- [ ] **Grafana dashboards imported**
  - Location: `monitoring/grafana/dashboards/bin-optimization.json`
- [ ] **Alert manager configured**
  - PagerDuty integration for CRITICAL alerts
  - Slack integration for WARNING alerts
- [ ] **Log aggregation ready** (e.g., ELK stack)

---

## Deployment Procedures

### Option A: Automated CI/CD Deployment (Recommended)

**Trigger:** Push to `master` branch

```bash
# 1. Merge feature branch
git checkout master
git merge develop
git push origin master

# 2. Monitor GitHub Actions
# URL: https://github.com/{org}/agogsaas/actions
# Wait for all checks to pass (estimated: 15-20 minutes)

# 3. Verify deployment
kubectl get pods -n production -l feature=bin-optimization
kubectl logs -f deployment/backend -n production
```

**CI/CD Pipeline Steps:**
1. Run backend tests (unit + integration)
2. Run frontend tests
3. Security scan (Trivy + npm audit)
4. Build Docker images
5. Deploy to staging (if `develop` branch)
6. Deploy to production with canary (if `master` branch)
7. Verify health checks
8. Send Slack notification

---

### Option B: Manual Deployment

Use this for emergency hotfixes or when CI/CD is unavailable.

#### Step 1: Deploy Database Migration

```bash
# Connect to database pod
kubectl exec -it postgres-0 -n production -- bash

# Run migration V0.0.18
psql -U agogsaas_user -d agogsaas -f /migrations/V0.0.18__add_bin_optimization_triggers.sql

# Verify migration
psql -U agogsaas_user -d agogsaas -c "\dt cache_refresh_status"

# Exit pod
exit
```

#### Step 2: Configure pg_cron Job

```sql
-- Connect via psql
psql $DATABASE_URL

-- Schedule materialized view refresh (every 10 minutes)
SELECT cron.schedule(
  'refresh_bin_util',
  '*/10 * * * *',
  'SELECT scheduled_refresh_bin_utilization();'
);

-- Verify cron job
SELECT * FROM cron.job;
```

#### Step 3: Deploy Kubernetes Manifests

```bash
# Apply ConfigMaps
kubectl apply -f k8s/production/bin-optimization/configmap.yaml

# Apply CronJobs
kubectl apply -f k8s/production/bin-optimization/cronjob.yaml

# Apply Deployment (with rolling update)
kubectl apply -f k8s/production/bin-optimization/deployment.yaml

# Monitor rollout
kubectl rollout status deployment/backend -n production --timeout=10m
```

#### Step 4: Verify Pods

```bash
# Check pod status
kubectl get pods -n production -l app=agogsaas-backend

# Expected output:
# NAME                       READY   STATUS    RESTARTS   AGE
# backend-7d9f8b6c5d-abcde   1/1     Running   0          2m
# backend-7d9f8b6c5d-fghij   1/1     Running   0          2m
# backend-7d9f8b6c5d-klmno   1/1     Running   0          2m

# Check logs for errors
kubectl logs -f deployment/backend -n production --tail=100
```

---

## Post-Deployment Verification

### 1. Health Check Verification

```bash
# Internal health check
kubectl exec -n production deployment/backend -- curl -f http://localhost:4000/api/wms/optimization/health

# Expected response:
# {
#   "status": "HEALTHY",
#   "checks": {
#     "cacheAge": {"status": "HEALTHY", "ageMinutes": 2.3},
#     "mlModelAccuracy": {"status": "HEALTHY", "accuracy": 87.5},
#     ...
#   }
# }

# External health check
curl -f https://app.agogsaas.com/api/wms/optimization/health

# Check Prometheus metrics
curl https://app.agogsaas.com/api/wms/optimization/metrics | grep bin_utilization
```

### 2. Database Trigger Verification

```sql
-- Verify triggers exist
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname LIKE '%bin_utilization%';

-- Expected:
-- refresh_bin_utilization_on_lot_change    | lots                  | O
-- refresh_bin_utilization_on_transaction   | inventory_transactions| O

-- Test trigger
UPDATE lots SET quantity_on_hand = quantity_on_hand + 1 WHERE lot_id = (SELECT lot_id FROM lots LIMIT 1);

-- Check cache refresh
SELECT * FROM cache_refresh_status WHERE cache_name = 'bin_utilization_cache' ORDER BY last_refresh_time DESC LIMIT 1;
-- last_refresh_time should be within last 5 seconds
```

### 3. Smoke Tests

Run end-to-end smoke tests:

```bash
# Run GraphQL query for batch putaway recommendations
curl -X POST https://app.agogsaas.com/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "query { getBatchPutawayRecommendations(input: { items: [...] }) { locationCode algorithm confidenceScore } }"
  }'

# Expected: 200 OK with recommendations array
```

### 4. Performance Validation

```bash
# Check processing time metrics
kubectl exec -n production deployment/backend -- curl http://localhost:9090/metrics | grep batch_putaway_processing_time

# P95 should be <2000ms for 50-item batches
# P99 should be <5000ms
```

### 5. Monitoring Dashboard Verification

1. **Open Grafana:** https://grafana.agogsaas.com
2. **Navigate to:** Dashboards > Bin Utilization Optimization - Production
3. **Verify metrics are populating:**
   - Health Status: UP (green)
   - Cache Age: <15 minutes
   - ML Accuracy: >80%
   - Acceptance Rate: data populating

---

## Rollback Procedures

### Emergency Rollback (< 5 minutes)

If critical issues detected immediately after deployment:

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/backend -n production

# Verify rollback
kubectl rollout status deployment/backend -n production

# Check health
kubectl exec -n production deployment/backend -- curl http://localhost:4000/health
```

### Database Rollback

If migration V0.0.18 causes issues:

```sql
-- Disable triggers
ALTER TABLE lots DISABLE TRIGGER refresh_bin_utilization_on_lot_change;
ALTER TABLE inventory_transactions DISABLE TRIGGER refresh_bin_utilization_on_transaction;

-- Remove cron job
SELECT cron.unschedule('refresh_bin_util');

-- Drop migration objects (if necessary)
DROP FUNCTION IF EXISTS refresh_bin_utilization_for_location(uuid);
DROP FUNCTION IF EXISTS scheduled_refresh_bin_utilization();
DROP TABLE IF EXISTS cache_refresh_status;
```

### Feature Flag Disable

If partial rollback needed (disable new algorithms but keep infrastructure):

```bash
# Update ConfigMap
kubectl edit configmap bin-optimization-config -n production

# Set:
# BIN_OPTIMIZATION_ALGORITHM: "FFD"  # Revert to simple FFD
# SKU_AFFINITY_ENABLED: "false"      # Disable SKU affinity
# CROSS_DOCK_ENABLED: "false"        # Disable cross-dock
# ML_MODEL_ENABLED: "false"          # Disable ML

# Restart pods to pick up changes
kubectl rollout restart deployment/backend -n production
```

---

## Monitoring and Alerts

### Critical Alerts (Immediate Response Required)

| Alert | Threshold | Impact | Response |
|-------|-----------|--------|----------|
| **BinUtilizationCacheStale** | Cache age >30 min | Recommendations using stale data | Check pg_cron job, database triggers |
| **MLModelAccuracyLow** | Accuracy <70% | Poor recommendation quality | Review feedback data, retrain model |
| **PutawayProcessingTimeCritical** | P95 >5s | User experience degraded | Check database load, scale pods |
| **BinOptimizationErrorRateHigh** | Error rate >5% | Service failures | Check logs, rollback if necessary |

### Warning Alerts (Review Within 1 Hour)

| Alert | Threshold | Impact | Response |
|-------|-----------|--------|----------|
| **BinUtilizationCacheDegraded** | Cache age >15 min | Slightly stale data | Monitor, investigate if persists |
| **MLModelAccuracyDegraded** | Accuracy <80% | Below target | Schedule model retraining |
| **PutawayProcessingTimeSlow** | P95 >2s | Slower than target | Investigate query performance |
| **PutawayAcceptanceRateLow** | Rate <60% | User trust issues | Review recommendations, user feedback |

### Alert Notification Channels

- **PagerDuty:** CRITICAL alerts (24/7 on-call)
- **Slack #wms-alerts:** All alerts
- **Email:** Daily summary reports

---

## Troubleshooting

### Issue 1: Cache Not Refreshing

**Symptoms:**
- `bin_utilization_cache_age_seconds` metric >1800
- Alert: BinUtilizationCacheStale

**Diagnosis:**
```sql
-- Check cache status
SELECT * FROM cache_refresh_status ORDER BY last_refresh_time DESC LIMIT 1;

-- Check pg_cron jobs
SELECT * FROM cron.job WHERE jobname = 'refresh_bin_util';

-- Check trigger status
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE '%bin_utilization%';
```

**Resolution:**
```sql
-- Manual refresh
SELECT scheduled_refresh_bin_utilization();

-- If error, check logs
SELECT * FROM cache_refresh_status WHERE error_message IS NOT NULL;

-- Re-enable trigger if disabled
ALTER TABLE lots ENABLE TRIGGER refresh_bin_utilization_on_lot_change;
```

---

### Issue 2: High Error Rate

**Symptoms:**
- Alert: BinOptimizationErrorRateHigh
- GraphQL errors in logs

**Diagnosis:**
```bash
# Check pod logs
kubectl logs -n production deployment/backend --tail=100 | grep ERROR

# Check database connection
kubectl exec -n production deployment/backend -- psql $DATABASE_URL -c "SELECT 1"

# Check data quality
kubectl exec -n production deployment/backend -- node -e "
  const service = require('./dist/modules/wms/services/bin-utilization-optimization-fixed.service');
  // Run data validation
"
```

**Resolution:**
1. Check database connectivity
2. Review data quality validation errors
3. Check for missing tenant_id in queries
4. Scale pods if CPU/memory saturated

---

### Issue 3: ML Accuracy Degraded

**Symptoms:**
- Alert: MLModelAccuracyDegraded
- `ml_model_accuracy_percentage` <80%

**Diagnosis:**
```sql
-- Check feedback data
SELECT COUNT(*), AVG(CASE WHEN accepted THEN 1 ELSE 0 END)
FROM ml_feedback_training_data
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Check model weights
SELECT * FROM ml_model_weights ORDER BY updated_at DESC LIMIT 1;
```

**Resolution:**
```bash
# Trigger manual ML training
kubectl create job --from=cronjob/bin-optimization-ml-training ml-training-manual -n production

# Monitor training job
kubectl logs -f job/ml-training-manual -n production

# Verify new accuracy
curl https://app.agogsaas.com/api/wms/optimization/health | jq '.checks.mlModelAccuracy'
```

---

### Issue 4: Slow Processing Time

**Symptoms:**
- Alert: PutawayProcessingTimeSlow
- `batch_putaway_processing_time_ms` P95 >2000ms

**Diagnosis:**
```bash
# Check database query performance
kubectl exec -n production postgres-0 -- psql -U agogsaas_user -d agogsaas -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  WHERE query LIKE '%bin_utilization%'
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"

# Check pod resource usage
kubectl top pods -n production -l app=agogsaas-backend
```

**Resolution:**
1. **Scale pods:** `kubectl scale deployment/backend --replicas=5 -n production`
2. **Check database indexes:** Verify indexes on `lots`, `inventory_locations`, `materials`
3. **Review query plans:** Add EXPLAIN ANALYZE to slow queries
4. **Check materialized view:** May need VACUUM or REINDEX

---

## Emergency Contacts

| Role | Contact | Availability |
|------|---------|-------------|
| **DevOps Lead (Berry)** | berry@agogsaas.com | 24/7 PagerDuty |
| **Backend Lead (Roy)** | roy@agogsaas.com | Business hours + on-call rotation |
| **QA Lead (Billy)** | billy@agogsaas.com | Business hours |
| **Product Owner (Marcus)** | marcus@agogsaas.com | Business hours |
| **On-Call Engineer** | PagerDuty auto-escalation | 24/7 |

**Escalation Path:**
1. On-Call Engineer (0-15 min)
2. DevOps Lead (15-30 min)
3. Backend Lead (30-60 min)
4. VP Engineering (>60 min or business impact)

---

## Deployment History

| Version | Date | Changes | Deployed By |
|---------|------|---------|-------------|
| v1.0.0 | 2024-12-24 | Initial production release | Berry (DevOps) |

---

## Related Documentation

- [Bin Optimization Architecture](../architecture/bin-optimization.md)
- [QA Test Report](../../print-industry-erp/backend/REQ-STRATEGIC-AUTO-1766516942302_BILLY_QA_DELIVERABLE.md)
- [Backend Implementation](../../print-industry-erp/backend/REQ-STRATEGIC-AUTO-1766516942302_ROY_BACKEND_DELIVERABLE.md)
- [Monitoring Setup](../monitoring/grafana-dashboards.md)
- [Database Schema](../../print-industry-erp/backend/migrations/)

---

**Document Status:** ✅ Production Ready
**REQ Number:** REQ-STRATEGIC-AUTO-1766516942302
**Last Review:** 2024-12-24
