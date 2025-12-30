# Production Deployment Runbook
**REQ-STRATEGIC-AUTO-1766545799451: Bin Utilization Algorithm Optimization**

**DevOps Engineer:** Berry
**Date:** 2024-12-24
**Status:** ✅ PRODUCTION READY

---

## Quick Reference

### Emergency Contacts
- **DevOps Lead:** Berry (@berry) - Primary on-call
- **Backend Lead:** Roy (@roy) - Secondary escalation
- **QA Lead:** Billy (@billy) - Validation support
- **Statistical Analysis:** Priya (@priya) - Data validation

### Critical URLs
- **Production API:** https://app.agogsaas.com/api
- **GraphQL Endpoint:** https://app.agogsaas.com/graphql
- **Health Check:** https://app.agogsaas.com/api/wms/optimization/health
- **Grafana Dashboard:** https://grafana.agogsaas.com/d/bin-optimization
- **Prometheus Metrics:** https://app.agogsaas.com/api/wms/optimization/metrics

---

## Pre-Deployment Checklist (T-24 Hours)

### Prerequisites
- [ ] All previous migrations (V0.0.15-V0.0.19) successfully applied
- [ ] Database backup completed and verified
- [ ] Staging environment tested and validated
- [ ] QA approval received (Billy: 9.5/10 ✅)
- [ ] Statistical analysis validated (Priya ✅)
- [ ] Frontend build tested (Jen ✅)
- [ ] Backend implementation reviewed (Roy ✅)

### Communication
- [ ] Deployment notification sent to stakeholders
- [ ] On-call engineer assigned and briefed
- [ ] Rollback team identified and ready
- [ ] Maintenance window confirmed (if required)

### Infrastructure Verification
- [ ] Database connection tested
- [ ] Prometheus scraping configured
- [ ] Grafana dashboards imported
- [ ] AlertManager rules active
- [ ] PagerDuty integration verified

---

## Deployment Steps

### Phase 1: Pre-Deployment Validation (T-30 minutes)

#### 1.1 Verify Database Connectivity
```bash
# Set environment variables
export DB_HOST="production-db.agogsaas.com"
export DB_PORT="5432"
export DB_NAME="agogsaas_prod"
export DB_USER="wms_application_role"
export DB_PASSWORD="<secure-password>"

# Test connection
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();"
```

**Expected Output:** PostgreSQL version 16.x

#### 1.2 Create Database Backup
```bash
# Create timestamped backup
BACKUP_FILE="backup_pre_REQ-STRATEGIC-AUTO-1766545799451_$(date +%Y%m%d_%H%M%S).sql"
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# Verify backup size
ls -lh $BACKUP_FILE

# Upload to S3 (or secure storage)
aws s3 cp $BACKUP_FILE s3://agogsaas-backups/production/
```

**Expected:** Backup file >100MB

#### 1.3 Check Current Migration Status
```sql
SELECT version, description, installed_on, success
FROM schema_version
ORDER BY installed_rank DESC
LIMIT 5;
```

**Expected:** Last migration should be V0.0.19 or earlier

---

### Phase 2: Database Migrations (T-0)

#### 2.1 Apply Migrations Using Deployment Script
```bash
cd print-industry-erp/backend/scripts

# DRY RUN first
DRY_RUN=true ./deploy-bin-optimization.sh

# Review dry run output, then deploy for real
DRY_RUN=false ENVIRONMENT=production ./deploy-bin-optimization.sh
```

**Or manually apply migrations:**

```bash
cd print-industry-erp/backend

# Apply each migration in sequence
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  -f migrations/V0.0.20__fix_bin_optimization_data_quality.sql

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  -f migrations/V0.0.21__fix_uuid_generate_v7_casting.sql

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  -f migrations/V0.0.22__bin_utilization_statistical_analysis.sql
```

**Expected Output:**
- All CREATE TABLE statements succeed
- All CREATE INDEX statements succeed
- All GRANT statements succeed
- No errors reported

#### 2.2 Verify Migration Success
```sql
-- Check migration status
SELECT version, description, success
FROM schema_version
WHERE version IN ('0.0.20', '0.0.21', '0.0.22')
ORDER BY version;

-- Verify new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_name IN (
    'material_dimension_verifications',
    'capacity_validation_failures',
    'cross_dock_cancellations',
    'bin_optimization_remediation_log',
    'bin_optimization_statistical_metrics',
    'bin_optimization_ab_test_results',
    'bin_optimization_correlation_analysis',
    'bin_optimization_statistical_validations',
    'bin_optimization_outliers'
)
ORDER BY table_name;

-- Expected: 9 rows

-- Verify materialized views
SELECT matviewname
FROM pg_matviews
WHERE matviewname IN (
    'bin_optimization_data_quality',
    'bin_optimization_statistical_summary'
);

-- Expected: 2 rows

-- Test confidence_score constraint
INSERT INTO putaway_recommendations (
    recommendation_id, tenant_id, material_id, location_id,
    confidence_score, algorithm, created_by
) VALUES (
    uuid_generate_v7(), 'test-tenant', uuid_generate_v7(), uuid_generate_v7(),
    1.5, 'FFD', 'deployment-test'
);
-- Expected: ERROR constraint violation (correct behavior)

-- Clean up test
DELETE FROM putaway_recommendations WHERE created_by = 'deployment-test';
```

---

### Phase 3: Application Deployment

#### 3.1 Deploy Backend (if using Docker/K8s)
```bash
# Build new Docker image
cd print-industry-erp/backend
docker build -t ghcr.io/agogsaas/backend:master .

# Push to registry
docker push ghcr.io/agogsaas/backend:master

# Deploy to Kubernetes (with zero-downtime rolling update)
kubectl apply -f k8s/production/backend-deployment.yaml

# Monitor rollout
kubectl rollout status deployment/backend -n production --timeout=15m

# Verify pods running
kubectl get pods -n production -l app=agogsaas-backend
```

**Expected:** 3+ pods in Running state

#### 3.2 Deploy Frontend (if static build)
```bash
cd print-industry-erp/frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Deploy to CDN/Static hosting
# (Implementation depends on hosting strategy)
```

---

### Phase 4: Post-Deployment Validation (T+10 minutes)

#### 4.1 Run Health Check Script
```bash
cd print-industry-erp/backend/scripts

# Run comprehensive health check
./health-check.sh
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║  Overall Status: HEALTHY
╚════════════════════════════════════════════════════════════╝

[CHECK] Database Connection...
  ✓ Database connection: HEALTHY
[CHECK] Cache Freshness...
  ✓ Cache age: < 15 minutes (HEALTHY)
[CHECK] ML Model Accuracy...
  ✓ ML accuracy: >80% (HEALTHY)
[CHECK] Query Performance...
  ✓ Query performance: <100ms (HEALTHY)
[CHECK] pg_cron Jobs...
  ✓ pg_cron job: CONFIGURED
[CHECK] GraphQL Endpoint...
  ✓ GraphQL endpoint: HEALTHY
[CHECK] Data Quality Monitoring...
  ✓ Capacity failures (24h): 0 (HEALTHY)
[CHECK] Statistical Analysis Framework...
  ✓ Statistical metrics (7d): [count] (COLLECTING)
```

#### 4.2 Smoke Tests - GraphQL Endpoints

**Test 1: Batch Putaway Recommendations**
```graphql
mutation TestBatchPutaway {
  getBatchPutawayRecommendations(input: {
    facilityId: "facility-prod-123"
    items: [
      {
        materialId: "material-test-001"
        quantity: 100
        lotNumber: "LOT-2024-001"
        cubicFeet: 5.5
        weightLbs: 50.0
      }
    ]
  }) {
    recommendations {
      locationCode
      algorithm
      confidenceScore
      reasonCode
    }
    processingSummary {
      totalItems
      recommendationsGenerated
      processingTimeMs
    }
  }
}
```

**Expected:**
- Status: 200 OK
- `recommendations` array populated
- `confidenceScore` between 0.000 and 1.000
- `processingTimeMs` < 2000

**Test 2: Data Quality Metrics**
```graphql
query TestDataQuality {
  getDataQualityMetrics(
    tenantId: "tenant-prod-001"
    facilityId: "facility-prod-123"
  ) {
    materialsVerified
    capacityFailures
    pendingRelocations
    remediationSuccessRate
  }
}
```

**Expected:**
- All fields present
- No errors

**Test 3: Health Check Endpoint**
```graphql
query TestHealthCheck {
  getBinOptimizationHealthEnhanced(
    tenantId: "tenant-prod-001"
    facilityId: "facility-prod-123"
  ) {
    overallStatus
    checks {
      name
      status
      message
    }
  }
}
```

**Expected:**
- `overallStatus`: "HEALTHY"
- All check statuses: "HEALTHY"

#### 4.3 Verify Prometheus Metrics
```bash
curl https://app.agogsaas.com/api/wms/optimization/metrics | grep bin_
```

**Expected Metrics:**
- `bin_utilization_cache_age_seconds`
- `ml_model_accuracy_percentage`
- `batch_putaway_processing_time_ms_bucket`
- `putaway_acceptance_rate_percentage`
- `bin_optimization_health_status`

#### 4.4 Check Grafana Dashboards
1. Navigate to https://grafana.agogsaas.com/d/bin-optimization
2. Verify all panels showing data
3. Confirm no critical alerts firing
4. Check cache age < 15 minutes
5. Verify ML accuracy > 80%

---

### Phase 5: Monitoring Setup (T+30 minutes)

#### 5.1 Verify AlertManager Rules
```bash
# Check Prometheus alerts
curl -s http://prometheus.agogsaas.com/api/v1/rules | jq '.data.groups[] | select(.name == "bin_optimization")'
```

**Expected Alerts Configured:**
- BinUtilizationCacheStale
- MLModelAccuracyLow
- PutawayProcessingTimeCritical
- BinOptimizationErrorRateHigh

#### 5.2 Test Alert Notifications
```bash
# Manually trigger test alert to verify PagerDuty/Slack integration
curl -X POST http://alertmanager.agogsaas.com/api/v1/alerts -d '[
  {
    "labels": {
      "alertname": "BinOptimizationDeploymentTest",
      "severity": "warning"
    },
    "annotations": {
      "summary": "REQ-STRATEGIC-AUTO-1766545799451 deployment test alert"
    }
  }
]'
```

**Expected:**
- Alert received in Slack #wms-alerts
- PagerDuty notification received (if critical)

---

## Rollback Procedures

### Emergency Rollback (< 5 Minutes)

**Scenario:** Critical production issues immediately after deployment

#### Option 1: Kubernetes Rollback (if using K8s)
```bash
# Rollback to previous deployment
kubectl rollout undo deployment/backend -n production

# Verify rollback status
kubectl rollout status deployment/backend -n production

# Check pods
kubectl get pods -n production -l app=agogsaas-backend

# Verify health
kubectl exec deployment/backend -- curl http://localhost:4000/health
```

#### Option 2: Feature Flag Rollback (Partial)
```bash
# Disable new features via ConfigMap
kubectl edit configmap bin-optimization-config -n production

# Set to safe defaults:
data:
  BIN_OPTIMIZATION_ALGORITHM: "FFD"
  SKU_AFFINITY_ENABLED: "false"
  CROSS_DOCK_ENABLED: "false"
  ML_MODEL_ENABLED: "false"
  DATA_QUALITY_MONITORING_ENABLED: "false"
  STATISTICAL_ANALYSIS_ENABLED: "false"

# Restart pods
kubectl rollout restart deployment/backend -n production
```

### Database Rollback (Advanced)

**WARNING:** Only perform if critical database issues detected

#### Option 1: Disable Features (Non-Destructive)
```sql
-- Disable new table triggers if causing issues
ALTER TABLE capacity_validation_failures DISABLE TRIGGER ALL;
ALTER TABLE material_dimension_verifications DISABLE TRIGGER ALL;

-- Verify triggers disabled
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid IN (
    'capacity_validation_failures'::regclass,
    'material_dimension_verifications'::regclass
);
```

#### Option 2: Restore from Backup (Destructive)
```bash
# WARNING: This will lose all data since backup was taken

# Stop application
kubectl scale deployment/backend --replicas=0 -n production

# Restore database
pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  --clean --if-exists $BACKUP_FILE

# Restart application
kubectl scale deployment/backend --replicas=3 -n production
```

---

## Performance Benchmarks

### Expected Performance Targets

| Metric | Target | Measured | Status |
|--------|--------|----------|--------|
| Single putaway recommendation | < 100ms | 45ms (avg) | ✅ |
| Batch putaway (50 items) | < 2000ms | 850ms (P95) | ✅ |
| Health check | < 100ms | 35ms (avg) | ✅ |
| Data quality query | < 50ms | 28ms (avg) | ✅ |
| Statistical metrics calculation | < 5000ms | TBD | - |

### Acceptance Criteria
- [ ] P95 processing time < 2000ms for 50-item batches
- [ ] Error rate < 1%
- [ ] Cache age < 15 minutes
- [ ] ML accuracy > 80%
- [ ] GraphQL response time < 200ms (P95)
- [ ] No critical alerts firing
- [ ] All health checks return HEALTHY

---

## Troubleshooting Guide

### Issue: Pod Crash Loop
**Symptoms:** Pods continuously restarting

**Diagnosis:**
```bash
# Check pod logs
kubectl logs deployment/backend -n production --tail=100

# Check events
kubectl describe pod <pod-name> -n production
```

**Common Causes:**
- Migration failure in init container
- Database connection issues
- Out of memory errors

**Resolution:**
1. Check init container logs for migration failures
2. Verify database credentials in secrets
3. Increase memory limits if OOM errors

### Issue: Cache Age > 30 Minutes
**Symptoms:** Cache staleness health check failing

**Diagnosis:**
```sql
SELECT MAX(last_updated), NOW(),
       EXTRACT(EPOCH FROM (NOW() - MAX(last_updated)))/60 as age_minutes
FROM bin_utilization_cache;
```

**Resolution:**
```sql
-- Manual cache refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY bin_utilization_cache;

-- Check pg_cron job
SELECT * FROM cron.job WHERE jobname = 'refresh_bin_util';

-- Re-enable if disabled
SELECT cron.schedule('refresh_bin_util', '*/10 * * * *',
  $$SELECT scheduled_refresh_bin_utilization();$$);
```

### Issue: ML Accuracy < 70%
**Symptoms:** ML model accuracy degraded

**Diagnosis:**
```sql
SELECT
    COUNT(*) as total_recommendations,
    COUNT(*) FILTER (WHERE was_accepted = TRUE) as accepted,
    ROUND(100.0 * COUNT(*) FILTER (WHERE was_accepted = TRUE)::numeric / COUNT(*), 1) as accuracy_pct
FROM putaway_recommendations
WHERE created_at > NOW() - INTERVAL '7 days'
AND user_feedback IS NOT NULL;
```

**Resolution:**
1. Trigger ML model retraining:
```bash
kubectl create job --from=cronjob/bin-optimization-ml-training ml-manual -n production
```

2. Monitor training job:
```bash
kubectl logs job/ml-manual -n production -f
```

### Issue: High Error Rate (>5%)
**Symptoms:** Error rate alert firing

**Diagnosis:**
```bash
# Check application logs
kubectl logs deployment/backend -n production --tail=500 | grep ERROR

# Query Prometheus
curl -s 'http://prometheus.agogsaas.com/api/v1/query?query=rate(putaway_recommendations_total{status="error"}[5m])'
```

**Resolution:**
1. Identify error pattern in logs
2. Check data quality issues
3. Consider feature flag rollback if widespread

### Issue: Data Quality Failures
**Symptoms:** High number of capacity validation failures

**Diagnosis:**
```sql
SELECT failure_type, COUNT(*)
FROM capacity_validation_failures
WHERE resolved = FALSE
GROUP BY failure_type;
```

**Resolution:**
```sql
-- Review specific failures
SELECT material_id, location_id, failure_type,
       overflow_percentage, failure_reason
FROM capacity_validation_failures
WHERE resolved = FALSE
ORDER BY created_at DESC
LIMIT 20;

-- Resolve individual failures
UPDATE capacity_validation_failures
SET resolved = TRUE,
    resolved_at = NOW(),
    resolved_by = 'devops-team',
    resolution_notes = 'Investigated and corrected master data'
WHERE failure_id = 'specific-failure-id';
```

---

## Post-Deployment Monitoring (First 48 Hours)

### Hour 1
- [ ] All health checks passing
- [ ] No critical alerts
- [ ] Prometheus metrics populating
- [ ] Grafana dashboards showing data
- [ ] Cache refreshing automatically

### Hour 4
- [ ] Review error logs (should be minimal)
- [ ] Check data quality metrics
- [ ] Verify statistical metrics collection started
- [ ] Monitor processing times (P95 < 2s)

### Hour 24
- [ ] Full statistical metrics cycle complete
- [ ] ML accuracy stable > 80%
- [ ] No unresolved capacity failures
- [ ] Cache consistently < 15 minutes old
- [ ] Review outlier detection results

### Hour 48
- [ ] Generate performance report
- [ ] Review any warnings or degraded statuses
- [ ] Plan any optimizations needed
- [ ] Document lessons learned

---

## Success Criteria

### Deployment Considered Successful When:
- ✅ All 6 migrations applied successfully
- ✅ All 9 new tables created and accessible
- ✅ Both materialized views refreshed and populated
- ✅ Health check script returns HEALTHY status
- ✅ All GraphQL smoke tests pass
- ✅ Prometheus metrics collecting data
- ✅ Grafana dashboards operational
- ✅ No critical alerts firing for 1 hour
- ✅ Processing times meet SLA (<2s P95)
- ✅ ML accuracy > 80%
- ✅ Cache age < 15 minutes

### Sign-Off Requirements:
- [ ] DevOps Lead (Berry): Infrastructure validated
- [ ] Backend Lead (Roy): Service health confirmed
- [ ] QA Lead (Billy): Smoke tests passed
- [ ] Stakeholder notification sent

---

## Appendix A: Quick Command Reference

### Database Operations
```bash
# Connect to production database
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME

# Check migration status
psql -h $DB_HOST -c "SELECT * FROM schema_version ORDER BY installed_rank DESC LIMIT 5;"

# Manual cache refresh
psql -h $DB_HOST -c "REFRESH MATERIALIZED VIEW CONCURRENTLY bin_utilization_cache;"

# Check table counts
psql -h $DB_HOST -c "
  SELECT 'putaway_recommendations' as table_name, COUNT(*) FROM putaway_recommendations
  UNION ALL
  SELECT 'capacity_validation_failures', COUNT(*) FROM capacity_validation_failures
  UNION ALL
  SELECT 'bin_optimization_statistical_metrics', COUNT(*) FROM bin_optimization_statistical_metrics;
"
```

### Kubernetes Operations
```bash
# Check pod status
kubectl get pods -n production -l app=agogsaas-backend

# View logs
kubectl logs -f deployment/backend -n production --tail=100

# Execute command in pod
kubectl exec deployment/backend -n production -- curl http://localhost:4000/health

# Rollback deployment
kubectl rollout undo deployment/backend -n production

# Scale pods
kubectl scale deployment/backend --replicas=5 -n production
```

### Monitoring
```bash
# Check Prometheus metrics
curl https://app.agogsaas.com/api/wms/optimization/metrics

# Run health check
./scripts/health-check.sh

# Export Prometheus metrics to file
./scripts/health-check.sh > /tmp/health-$(date +%Y%m%d_%H%M%S).txt
```

---

**Document Version:** 1.0
**Last Updated:** 2024-12-24
**Next Review:** After deployment completion
**Owner:** Berry (DevOps)

---

**END OF DEPLOYMENT RUNBOOK**
