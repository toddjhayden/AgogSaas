# Audit Column Migration Checklist - V1.0.11

Use this checklist to track progress through the migration deployment.

---

## Pre-Deployment Checklist

### Code Review
- [x] Migration SQL V1.0.11 created and reviewed
- [x] Migration SQL V1.0.12 created and reviewed (for future)
- [x] Migration guide document created
- [x] GraphQL schema pattern defined (tenant.graphql updated)
- [ ] GraphQL schema: `operations.graphql` updated
- [ ] GraphQL schema: `wms.graphql` updated
- [ ] GraphQL schema: `finance.graphql` updated
- [ ] GraphQL schema: `sales-materials.graphql` updated
- [ ] GraphQL schema: `quality-hr-iot-security-marketplace-imposition.graphql` updated

### Resolver Updates (Dual-Write Pattern)
- [ ] Core resolvers updated (tenants, facilities, users)
- [ ] Operations resolvers updated
- [ ] WMS resolvers updated
- [ ] Finance resolvers updated
- [ ] Sales resolvers updated
- [ ] Materials resolvers updated
- [ ] Procurement resolvers updated
- [ ] Quality resolvers updated
- [ ] HR resolvers updated
- [ ] IoT resolvers updated
- [ ] Security resolvers updated
- [ ] Marketplace resolvers updated
- [ ] Imposition resolvers updated

### Testing
- [ ] Unit tests created for `sync_audit_columns()` trigger
- [ ] Unit tests pass on staging
- [ ] Integration tests created for GraphQL mutations
- [ ] Integration tests pass on staging
- [ ] Performance tests run (INSERT/UPDATE overhead measured)
- [ ] Load tests run (concurrent writes tested)

### Staging Environment
- [ ] Staging database backed up
- [ ] V1.0.11 migration run on staging
- [ ] Backfill verification passed (0 mismatches)
- [ ] Triggers verified (86 triggers created)
- [ ] Sample data tested (INSERT, UPDATE, soft-delete)
- [ ] GraphQL endpoints tested (both old and new fields work)
- [ ] Performance acceptable (trigger overhead < 5%)

### Documentation
- [x] Migration guide completed
- [x] Summary document created
- [x] Checklist created
- [ ] Runbook updated (deployment procedures)
- [ ] API documentation updated (deprecation notices)

---

## Phase 1 Deployment: V1.0.11

### Pre-Deployment (Day 0)
- [ ] Code freeze announced (no unrelated changes)
- [ ] Stakeholders notified (deployment window)
- [ ] On-call engineer assigned
- [ ] Rollback plan reviewed
- [ ] Production database backed up (full backup)
- [ ] Blue environment confirmed stable
- [ ] Green environment prepared (empty, ready for new code)

### Deployment (Day 0 - Evening)
- [ ] Deploy V1.0.11 migration to Green database
  ```bash
  flyway migrate -configFiles=flyway.conf -locations=filesystem:./migrations
  ```
- [ ] Verify migration success
  ```bash
  flyway info -configFiles=flyway.conf
  ```
- [ ] Run backfill verification query
  ```sql
  -- Should return 0 rows
  SELECT COUNT(*) FROM customers WHERE created_by IS NOT NULL AND created_by != created_by_user_id;
  ```
- [ ] Verify trigger creation (should be 86 triggers)
  ```sql
  SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE '%sync_audit%';
  ```
- [ ] Deploy Green application (new code with dual-write resolvers)
  ```bash
  docker-compose up -d backend-green
  ```
- [ ] Smoke test GraphQL endpoints
  ```bash
  curl -X POST http://localhost:4001/graphql \
    -H "Content-Type: application/json" \
    -d '{"query": "{ me { id createdBy createdByUserId } }"}'
  ```
- [ ] Verify both old and new fields return same value
- [ ] Monitor error logs (5 minutes, check for trigger errors)

### Monitoring (Days 1-2)
- [ ] **Hour 1:** Check error logs every 15 minutes
- [ ] **Hour 2:** Check error logs every 30 minutes
- [ ] **Hour 4:** Check error logs hourly
- [ ] **Day 1:** Run data consistency check (every 6 hours)
  ```sql
  SELECT table_name, COUNT(*) AS mismatch_count
  FROM (...) -- Use verification query from summary doc
  WHERE cnt > 0;
  ```
- [ ] **Day 1:** Monitor GraphQL query performance (should be stable)
- [ ] **Day 1:** Monitor INSERT/UPDATE performance (trigger overhead < 5%)
- [ ] **Day 2:** Run data consistency check (every 12 hours)
- [ ] **Day 2:** Review client deprecation warnings (track migration progress)

### Metrics to Track
- [ ] Error rate (should be 0% increase)
- [ ] Response time (should be < 5% increase)
- [ ] Throughput (should be stable)
- [ ] Data mismatches (should be 0)
- [ ] Client deprecation warnings (should decrease over time)

### Go/No-Go Decision (End of Day 2)
- [ ] **GO:** Green stable for 48 hours, proceed to traffic cutover
- [ ] **NO-GO:** Issues detected, rollback to Blue

---

## Phase 1 Cutover: Switch Traffic to Green

### Pre-Cutover (Day 3)
- [ ] Green environment stable for 48+ hours
- [ ] No data mismatches detected
- [ ] No performance degradation
- [ ] No critical errors
- [ ] Stakeholders notified (cutover window)

### Cutover (Day 3 - Low-Traffic Window)
- [ ] Announce cutover (5 minutes before)
- [ ] Switch load balancer to Green
  ```bash
  # Example: Update docker-compose or your load balancer config
  docker-compose stop backend-blue
  docker-compose up -d backend-green
  ```
- [ ] Verify traffic flowing to Green
- [ ] Monitor error logs (watch for 15 minutes)
- [ ] Smoke test critical endpoints
- [ ] Verify Blue idle (no active connections)

### Post-Cutover Monitoring (Days 3-5)
- [ ] **Hour 1:** Check error logs every 15 minutes
- [ ] **Day 3:** Monitor all metrics (hourly)
- [ ] **Day 4:** Run data consistency check (daily)
- [ ] **Day 5:** Confirm stable, ready for Blue decommission

### Decommission Blue (Day 5)
- [ ] Green stable for 48+ hours post-cutover
- [ ] No rollback needed
- [ ] Stop Blue environment
  ```bash
  docker-compose rm -f backend-blue
  ```

---

## Phase 2 Preparation: V1.0.12 (Days 6-7)

### Pre-Phase 2 Checklist
- [ ] V1.0.11 stable for 5+ days
- [ ] All GraphQL clients migrated to new fields
  - [ ] Web app using `createdByUserId`
  - [ ] Mobile app using `createdByUserId`
  - [ ] Partner integrations using `createdByUserId`
  - [ ] Internal tools using `createdByUserId`
- [ ] Deprecation warnings reviewed (confirm migration complete)
- [ ] Data consistency verified (run verification query)
  ```sql
  -- Should return 0 rows
  SELECT COUNT(*) FROM customers WHERE created_by IS NOT NULL AND created_by != created_by_user_id;
  ```
- [ ] Stakeholder approval obtained (sign-off to drop old columns)

### Testing V1.0.12 on Staging
- [ ] Staging database backed up
- [ ] Run V1.0.12 migration on staging
- [ ] Verify triggers dropped (86 triggers removed)
- [ ] Verify old columns dropped (86 tables updated)
- [ ] Test application (ensure no references to old fields)
- [ ] Run regression tests (all tests pass)

---

## Phase 2 Deployment: V1.0.12

### Pre-Deployment (Day 7)
- [ ] **CRITICAL:** Full production database backup
  ```bash
  pg_dump -d erp_db -F c -f backup_before_v1.0.12_$(date +%Y%m%d_%H%M%S).dump
  ```
- [ ] Verify backup completed successfully
- [ ] Test restore procedure (confirm backup valid)
- [ ] Stakeholders notified (deployment window)
- [ ] On-call engineer assigned
- [ ] Rollback plan reviewed (requires restore from backup)

### Deployment (Day 7 - Low-Traffic Window)
- [ ] Run V1.0.12 migration
  ```bash
  flyway migrate -configFiles=flyway.conf
  ```
- [ ] Verify migration success
  ```bash
  flyway info -configFiles=flyway.conf
  ```
- [ ] Verify triggers dropped
  ```sql
  -- Should return 0 rows
  SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE '%sync_audit%';
  ```
- [ ] Verify old columns dropped
  ```sql
  -- Should return 0 rows
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name IN ('created_by', 'updated_by', 'deleted_by');
  ```
- [ ] Remove deprecated fields from GraphQL schemas
- [ ] Remove dual-write logic from resolvers
- [ ] Deploy updated application
  ```bash
  docker-compose restart backend-green
  ```
- [ ] Smoke test GraphQL endpoints (verify only new fields)
- [ ] Monitor error logs (watch for 30 minutes)

### Post-Deployment Monitoring (Days 7-10)
- [ ] **Hour 1:** Check error logs every 15 minutes
- [ ] **Day 7:** Monitor all metrics (hourly)
- [ ] **Day 8:** Verify no references to old columns (grep codebase)
- [ ] **Day 9:** Performance check (INSERT/UPDATE faster without triggers)
- [ ] **Day 10:** Confirm stable, migration complete

---

## Rollback Procedures

### Rollback from Phase 1 (SAFE - Before Cutover)
If issues detected during Green soak (Days 0-2):
- [ ] Switch traffic back to Blue
  ```bash
  docker-compose stop backend-green
  docker-compose up -d backend-blue
  ```
- [ ] Investigate issue in Green (offline)
- [ ] No data loss (old columns still exist)
- [ ] Fix issue and retry deployment

### Rollback from Phase 1 (SAFE - After Cutover)
If issues detected after cutover (Days 3-5):
- [ ] Re-enable Blue environment
  ```bash
  docker-compose up -d backend-blue
  ```
- [ ] Switch traffic to Blue
- [ ] Investigate issue in Green (offline)
- [ ] No data loss (old columns still exist)
- [ ] Fix issue and retry deployment

### Rollback from Phase 2 (DESTRUCTIVE - Requires Restore)
If issues detected after V1.0.12 (Days 7+):
- [ ] **CRITICAL:** Stop application immediately
  ```bash
  docker-compose stop backend-green
  ```
- [ ] Restore database from backup
  ```bash
  pg_restore -d erp_db -c backup_before_v1.0.12_YYYYMMDD_HHMMSS.dump
  ```
- [ ] Revert code to V1.0.11
  ```bash
  git checkout v1.0.11
  ```
- [ ] Deploy old version
  ```bash
  docker-compose up -d backend-green
  ```
- [ ] Verify application working
- [ ] Investigate issue before attempting V1.0.12 again

---

## Success Criteria

### Phase 1 Success (V1.0.11)
- ✅ Migration runs without errors
- ✅ All 86 tables have new columns
- ✅ Backfill complete (0 mismatches)
- ✅ 86 triggers created and functioning
- ✅ GraphQL endpoints return both old and new fields
- ✅ No performance degradation (< 5% overhead)
- ✅ Stable for 48+ hours

### Phase 2 Success (V1.0.12)
- ✅ Old columns dropped from 86 tables
- ✅ Triggers removed (0 remaining)
- ✅ GraphQL schemas only expose new fields
- ✅ Application stable (no errors)
- ✅ Performance improved (no trigger overhead)
- ✅ Stable for 48+ hours

---

## Communication Plan

### Before Deployment
- [ ] Email stakeholders (deployment schedule)
- [ ] Slack announcement (engineering channel)
- [ ] Update status page (planned maintenance)

### During Deployment
- [ ] Slack updates (every hour during soak)
- [ ] Update status page (in progress)

### After Deployment
- [ ] Slack announcement (deployment complete)
- [ ] Email stakeholders (success report)
- [ ] Update status page (completed)

### If Issues Occur
- [ ] Immediate Slack notification (critical issues)
- [ ] Update status page (investigating)
- [ ] Email stakeholders (if customer-facing impact)
- [ ] Post-mortem document (after resolution)

---

## Key Contacts

- **Migration Lead:** ___________ (oversees entire migration)
- **Backend Engineer:** ___________ (resolvers, triggers)
- **Database Admin:** ___________ (migration execution)
- **DevOps Engineer:** ___________ (deployment, monitoring)
- **QA Lead:** ___________ (testing, verification)
- **On-Call Engineer:** ___________ (emergency response)

---

## Final Sign-Off

### Phase 1 (V1.0.11)
- [ ] Backend Lead: ___________
- [ ] Database Admin: ___________
- [ ] DevOps Lead: ___________
- [ ] Product Owner: ___________

### Phase 2 (V1.0.12)
- [ ] Backend Lead: ___________
- [ ] Database Admin: ___________
- [ ] DevOps Lead: ___________
- [ ] Product Owner: ___________

---

**Last Updated:** 2025-12-17
**Document Owner:** Migration Lead
**Review Date:** Before each deployment phase
