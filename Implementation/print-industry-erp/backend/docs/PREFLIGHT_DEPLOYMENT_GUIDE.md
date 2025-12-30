# PDF Preflight & Color Management - Deployment Guide

**REQ:** REQ-STRATEGIC-AUTO-1767066329942
**Module:** PDF Preflight & Color Management
**Version:** Phase 1
**Date:** 2025-12-30
**Author:** Berry (DevOps Agent)

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Rollback Procedure](#rollback-procedure)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Phase 2 Planning](#phase-2-planning)

---

## Overview

The PDF Preflight & Color Management module provides comprehensive PDF validation and color accuracy checking for the print industry ERP system. This deployment guide covers Phase 1 implementation, which includes:

- **Database Schema**: 6 tables, 2 analytical views, 21 indexes, complete RLS policies
- **Backend Service**: PreflightService with 15+ methods
- **GraphQL API**: 9 queries, 8 mutations, 11 types, 9 enums
- **Frontend UI**: 4 pages (Dashboard, Profiles, Report Detail, Color Proof Management)
- **Default Profiles**: PDF/X-1a, PDF/X-3, PDF/X-4 standard profiles

### Architecture Highlights

- **Multi-tenant isolation** via Row-Level Security (RLS)
- **Structured issue tracking** (not JSONB) for efficient querying
- **Blob storage references** (not inline) for scalability
- **Profile versioning** with audit trail
- **Async processing ready** (queuing mechanism for Phase 2)

---

## Prerequisites

### System Requirements

- **Operating System**: Linux/Unix (bash shell required)
- **PostgreSQL**: 12+ with uuid-ossp extension
- **Node.js**: 16+ LTS
- **Docker**: 20+ (optional, for containerized deployment)
- **Git**: For version control

### Environment Variables

Ensure the following environment variables are set:

```bash
# Database connection
export DATABASE_URL="postgresql://user:password@localhost:5432/agog_erp"

# Application settings
export NODE_ENV="production"
export PORT="4000"

# GraphQL endpoint
export GRAPHQL_ENDPOINT="http://localhost:4000/graphql"

# S3/Blob storage (for Phase 2)
export S3_BUCKET_NAME="agog-preflight-artifacts"
export S3_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
```

### Required Permissions

- Database: `CREATE TABLE`, `CREATE INDEX`, `CREATE POLICY`
- File system: Read/write access to `backend/migrations/`
- Docker: Permission to restart containers (if using Docker)

---

## Deployment Steps

### Step 1: Pre-Deployment Checks

```bash
# Navigate to the project root
cd /path/to/agogsaas/Implementation/print-industry-erp

# Verify database connectivity
psql "$DATABASE_URL" -c "SELECT version();"

# Check for existing migration status
psql "$DATABASE_URL" -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;"

# Verify backend build
cd backend
npm run build

# Verify frontend build
cd ../frontend
npm run build
```

### Step 2: Backup Existing Data

**CRITICAL**: Always backup before deploying to production.

```bash
# Create backup directory
mkdir -p backend/backups

# Full database backup
pg_dump "$DATABASE_URL" > "backend/backups/full_backup_$(date +%Y%m%d_%H%M%S).sql"

# Preflight-specific backup (if tables already exist)
pg_dump "$DATABASE_URL" \
  --schema=public \
  --table=preflight_* \
  --table=color_proofs \
  > "backend/backups/preflight_backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Step 3: Run Automated Deployment Script

```bash
# Navigate to backend directory
cd backend

# Make deployment script executable
chmod +x scripts/deploy-preflight-color-management.sh

# Run deployment (interactive)
./scripts/deploy-preflight-color-management.sh
```

The deployment script will:
1. Check prerequisites
2. Create database backup
3. Run migration `V0.0.46__create_preflight_color_management_tables.sql`
4. Verify schema creation
5. Seed default profiles (PDF/X-1a, PDF/X-3, PDF/X-4)
6. Update dependencies
7. Build backend and frontend
8. Restart services
9. Run health checks

### Step 4: Manual Migration (Alternative)

If you prefer manual deployment:

```bash
# Run the migration SQL file
psql "$DATABASE_URL" -f backend/migrations/V0.0.46__create_preflight_color_management_tables.sql

# Verify tables were created
psql "$DATABASE_URL" -c "\dt preflight_*"

# Seed default profiles
psql "$DATABASE_URL" << 'EOF'
INSERT INTO preflight_profiles (
    tenant_id, profile_name, profile_type, version,
    version_notes, rules, is_default, is_active
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'PDF/X-1a:2001 Standard',
    'PDF_X_1A',
    1,
    'Standard PDF/X-1a:2001 profile for commercial printing',
    '{"pdf_version": {"required": "1.3"}, "color_space": {"allowed": ["CMYK", "GRAY"]}, "images": {"min_resolution_dpi": 300}, "fonts": {"must_be_embedded": true}}'::jsonb,
    true,
    true
) ON CONFLICT DO NOTHING;
EOF
```

---

## Post-Deployment Verification

### Step 1: Run Health Checks

```bash
# Navigate to backend directory
cd backend

# Make health check script executable
chmod +x scripts/health-check-preflight.sh

# Run health checks
./scripts/health-check-preflight.sh
```

Expected output:
```
=====================================
HEALTH CHECK SUMMARY
=====================================
Total Checks: 45
Passed: 43
Warnings: 2
Failed: 0

✓ All critical checks passed!
Pass Rate: 95%
⚠ There are 2 warnings to review
```

### Step 2: Verify Database Schema

```bash
# Check tables
psql "$DATABASE_URL" -c "
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name LIKE 'preflight_%' OR table_name = 'color_proofs'
ORDER BY table_name;
"

# Check views
psql "$DATABASE_URL" -c "
SELECT table_name
FROM information_schema.views
WHERE table_name LIKE 'vw_preflight_%';
"

# Check indexes
psql "$DATABASE_URL" -c "
SELECT indexname
FROM pg_indexes
WHERE tablename LIKE 'preflight_%' OR tablename = 'color_proofs'
ORDER BY indexname;
"

# Check RLS policies
psql "$DATABASE_URL" -c "
SELECT schemaname, tablename, policyname, permissive
FROM pg_policies
WHERE tablename LIKE 'preflight_%' OR tablename = 'color_proofs';
"
```

### Step 3: Verify Backend API

```bash
# Test GraphQL introspection
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __type(name: \"PreflightProfile\") { name fields { name type { name } } } }"}'

# Test query - list profiles
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "query { preflightProfiles(tenantId: \"YOUR_TENANT_ID\") { id profileName profileType version isActive } }"
  }'
```

### Step 4: Verify Frontend UI

1. **Access the Preflight Dashboard**:
   - URL: `http://localhost:3000/preflight`
   - Expected: Dashboard showing statistics cards (Pass Rate, Total Errors, etc.)

2. **Access Preflight Profiles**:
   - URL: `http://localhost:3000/preflight/profiles`
   - Expected: List of 3 default profiles (PDF/X-1a, PDF/X-3, PDF/X-4)

3. **Check Console for Errors**:
   - Open browser DevTools (F12)
   - Check Console tab for JavaScript errors
   - Check Network tab for failed GraphQL requests

### Step 5: Smoke Test

Perform a basic smoke test:

```bash
# Test profile creation (via GraphQL)
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "mutation { createPreflightProfile(input: { tenantId: \"YOUR_TENANT_ID\", profileName: \"Test Profile\", profileType: CUSTOM, rules: { test: true } }) { id profileName } }"
  }'

# Verify profile was created
psql "$DATABASE_URL" -c "
SELECT id, profile_name, profile_type, version
FROM preflight_profiles
WHERE profile_name = 'Test Profile';
"
```

---

## Rollback Procedure

If deployment fails or issues are discovered:

### Immediate Rollback (Database Only)

```bash
# Restore from backup
psql "$DATABASE_URL" < backend/backups/preflight_backup_YYYYMMDD_HHMMSS.sql

# Verify restoration
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM preflight_profiles;"
```

### Full Rollback (Application + Database)

```bash
# 1. Restore database
psql "$DATABASE_URL" < backend/backups/full_backup_YYYYMMDD_HHMMSS.sql

# 2. Revert code changes
cd /path/to/agogsaas/Implementation
git log --oneline -10  # Find commit before deployment
git revert <commit-hash>

# 3. Rebuild and restart
cd print-industry-erp/backend
npm run build

cd ../frontend
npm run build

# 4. Restart services
docker-compose restart backend frontend
# OR
pm2 restart all
```

### Partial Rollback (Remove Tables Only)

```bash
# Drop tables in reverse order (respects foreign keys)
psql "$DATABASE_URL" << 'EOF'
DROP TABLE IF EXISTS preflight_audit_log CASCADE;
DROP TABLE IF EXISTS preflight_artifacts CASCADE;
DROP TABLE IF EXISTS preflight_issues CASCADE;
DROP TABLE IF EXISTS color_proofs CASCADE;
DROP TABLE IF EXISTS preflight_reports CASCADE;
DROP TABLE IF EXISTS preflight_profiles CASCADE;
DROP VIEW IF EXISTS vw_preflight_error_frequency CASCADE;
DROP VIEW IF EXISTS vw_preflight_pass_rates CASCADE;
EOF
```

---

## Monitoring & Maintenance

### Database Monitoring

```bash
# Check table sizes
psql "$DATABASE_URL" -c "
SELECT
    schemaname || '.' || tablename as table,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE tablename LIKE 'preflight_%' OR tablename = 'color_proofs'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Check index usage statistics
psql "$DATABASE_URL" -c "
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename LIKE 'preflight_%' OR tablename = 'color_proofs'
ORDER BY idx_scan DESC;
"

# Monitor slow queries
psql "$DATABASE_URL" -c "
SELECT
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
WHERE query LIKE '%preflight%'
ORDER BY mean_time DESC
LIMIT 10;
"
```

### Application Monitoring

```bash
# Check backend logs
tail -f backend/logs/application.log | grep -i preflight

# Check error rates
psql "$DATABASE_URL" -c "
SELECT
    DATE(processed_at) as date,
    status,
    COUNT(*) as count
FROM preflight_reports
WHERE processed_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(processed_at), status
ORDER BY date DESC, status;
"

# Check processing times
psql "$DATABASE_URL" -c "
SELECT
    AVG(processing_time_ms) as avg_ms,
    MIN(processing_time_ms) as min_ms,
    MAX(processing_time_ms) as max_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_time_ms) as median_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_ms
FROM preflight_reports
WHERE processed_at >= NOW() - INTERVAL '24 hours';
"
```

### Scheduled Maintenance Tasks

Add to cron or task scheduler:

```bash
# Daily: Archive old artifacts (move to cheaper storage tier)
0 2 * * * psql "$DATABASE_URL" -c "
UPDATE preflight_artifacts
SET storage_tier = 'INFREQUENT_ACCESS'
WHERE created_at < NOW() - INTERVAL '30 days'
  AND storage_tier = 'STANDARD';
"

# Weekly: Vacuum and analyze tables
0 3 * * 0 psql "$DATABASE_URL" -c "
VACUUM ANALYZE preflight_profiles;
VACUUM ANALYZE preflight_reports;
VACUUM ANALYZE preflight_issues;
VACUUM ANALYZE preflight_artifacts;
VACUUM ANALYZE color_proofs;
VACUUM ANALYZE preflight_audit_log;
"

# Monthly: Archive old reports (>1 year)
0 4 1 * * psql "$DATABASE_URL" -c "
DELETE FROM preflight_reports
WHERE processed_at < NOW() - INTERVAL '1 year'
  AND status IN ('PASS', 'PASS_WITH_WARNINGS');
"
```

---

## Troubleshooting

### Common Issues

#### 1. Migration Fails with "relation already exists"

**Cause**: Migration was partially applied.

**Solution**:
```bash
# Check existing tables
psql "$DATABASE_URL" -c "\dt preflight_*"

# Drop existing tables and re-run
psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS preflight_audit_log CASCADE;"
# ... (drop all tables)

# Re-run migration
psql "$DATABASE_URL" -f backend/migrations/V0.0.46__create_preflight_color_management_tables.sql
```

#### 2. GraphQL Query Returns "Cannot return null for non-nullable field"

**Cause**: Frontend expects fields that are null in the database.

**Solution**:
```bash
# Check for null values
psql "$DATABASE_URL" -c "
SELECT id, profile_name, rules IS NULL as rules_null
FROM preflight_profiles
WHERE rules IS NULL;
"

# Update null values
psql "$DATABASE_URL" -c "
UPDATE preflight_profiles
SET rules = '{}'::jsonb
WHERE rules IS NULL;
"
```

#### 3. Frontend Shows "Network Error" or 500 Status

**Cause**: Backend service not running or misconfigured.

**Solution**:
```bash
# Check backend status
docker-compose ps backend
# OR
pm2 status

# Check backend logs
docker-compose logs -f backend
# OR
pm2 logs backend

# Restart backend
docker-compose restart backend
# OR
pm2 restart backend
```

#### 4. RLS Policies Block Queries

**Cause**: RLS policies require tenant_id to match current user's tenant.

**Solution**:
```bash
# Temporarily disable RLS for testing (NOT for production!)
psql "$DATABASE_URL" -c "ALTER TABLE preflight_profiles DISABLE ROW LEVEL SECURITY;"

# Verify query works
# ...

# Re-enable RLS
psql "$DATABASE_URL" -c "ALTER TABLE preflight_profiles ENABLE ROW LEVEL SECURITY;"

# Fix root cause: ensure JWT token includes correct tenant_id claim
```

#### 5. Performance Issues with Large Result Sets

**Cause**: Missing indexes or inefficient queries.

**Solution**:
```bash
# Check for missing indexes
psql "$DATABASE_URL" -c "
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE tablename LIKE 'preflight_%'
  AND n_distinct > 100
  AND correlation < 0.5;
"

# Add missing index (example)
psql "$DATABASE_URL" -c "
CREATE INDEX CONCURRENTLY idx_preflight_reports_tenant_status
ON preflight_reports(tenant_id, status, processed_at DESC);
"
```

### Debug Mode

Enable debug logging:

```bash
# Backend debug mode
export DEBUG="preflight:*"
export LOG_LEVEL="debug"

# Restart backend
docker-compose restart backend

# Watch logs
docker-compose logs -f backend | grep -i preflight
```

### Contact & Support

For deployment issues:
- **DevOps Agent**: Berry
- **Backend Issues**: Roy
- **Frontend Issues**: Jen
- **Database Issues**: Cynthia (Research) or Priya (Statistics)
- **QA Support**: Billy

---

## Phase 2 Planning

Phase 1 provides the **data structure and API foundation**. Phase 2 will implement **actual PDF validation logic**.

### Phase 2 Scope (10-12 weeks)

1. **Async Worker Architecture** (Week 1-2)
   - NATS queue integration
   - Worker pool for parallel processing
   - Job prioritization

2. **PDF Validation Engine** (Week 3-5)
   - Integrate `pdf-lib` for PDF parsing
   - Implement PDF/X standard checks
   - Image resolution and color space validation
   - Font embedding verification

3. **Color Management** (Week 6-7)
   - Integrate `sharp` for image processing
   - ICC profile validation
   - Spot color detection
   - Ink coverage calculation

4. **Artifact Generation** (Week 8-9)
   - Annotated PDF generation (highlighting issues)
   - Soft proof rendering
   - Color separation exports
   - Thumbnail generation

5. **S3 Storage Integration** (Week 10)
   - Upload artifacts to S3
   - Lifecycle management (move to cheaper tiers)
   - Presigned URL generation for downloads

6. **Testing & Optimization** (Week 11-12)
   - Load testing with real PDFs
   - Performance tuning
   - Error handling improvements
   - Documentation updates

### Phase 2 Prerequisites

- [ ] Complete Phase 1 deployment and stabilization
- [ ] Identify PDF validation library (recommend: `pdf-lib`, `pdfjs-dist`)
- [ ] Set up S3 bucket or alternative blob storage
- [ ] Configure NATS message queue
- [ ] Allocate worker infrastructure (VMs/containers)
- [ ] Obtain sample PDF/X test files

### Phase 2 Risks

- **Performance**: PDF parsing can be CPU-intensive (mitigate with worker pool)
- **Storage Costs**: Artifacts can accumulate quickly (mitigate with lifecycle policies)
- **Color Accuracy**: Commercial color APIs can be expensive (evaluate open-source alternatives)
- **PDF Complexity**: Handling all PDF edge cases is challenging (start with most common formats)

---

## Appendix

### A. Migration File Details

**File**: `V0.0.46__create_preflight_color_management_tables.sql`
**Lines**: 517
**Tables**: 6
**Views**: 2
**Indexes**: 21
**RLS Policies**: 6+

### B. GraphQL API Reference

**Queries**:
1. `preflightProfile(id: UUID!): PreflightProfile`
2. `preflightProfiles(tenantId: UUID!, profileType: PreflightProfileType, isActive: Boolean): [PreflightProfile!]!`
3. `preflightReport(id: UUID!): PreflightReport`
4. `preflightReports(tenantId: UUID!, jobId: UUID, status: PreflightStatus, limit: Int, offset: Int): [PreflightReport!]!`
5. `preflightIssues(reportId: UUID!): [PreflightIssue!]!`
6. `colorProof(id: UUID!): ColorProof`
7. `colorProofs(jobId: UUID!): [ColorProof!]!`
8. `preflightStatistics(tenantId: UUID!): PreflightStatistics`
9. `preflightErrorFrequency(tenantId: UUID!, limit: Int): [ErrorFrequency!]!`

**Mutations**:
1. `createPreflightProfile(input: CreatePreflightProfileInput!): PreflightProfile!`
2. `updatePreflightProfile(id: UUID!, input: UpdatePreflightProfileInput!): PreflightProfile!`
3. `validatePdf(input: ValidatePdfInput!): PreflightReport!`
4. `approvePreflightReport(id: UUID!, notes: String): PreflightReport!`
5. `rejectPreflightReport(id: UUID!, reason: String!): PreflightReport!`
6. `generateColorProof(input: GenerateColorProofInput!): ColorProof!`
7. `approveColorProof(id: UUID!): ColorProof!`
8. `rejectColorProof(id: UUID!, notes: String): ColorProof!`

### C. Default Profile Specifications

#### PDF/X-1a:2001
- **PDF Version**: 1.3 (fixed)
- **Color Space**: CMYK, Grayscale only (no RGB, LAB)
- **Images**: Min 300 DPI, max 2400 DPI
- **Fonts**: Must be embedded
- **Bleed**: Required, min 0.125"
- **Ink Coverage**: Max 300%
- **Transparency**: Not allowed
- **Layers**: Not allowed

#### PDF/X-3:2002
- **PDF Version**: 1.3 (fixed)
- **Color Space**: CMYK, Grayscale, RGB, LAB (with ICC profiles)
- **Images**: Min 300 DPI, ICC profiles required
- **Fonts**: Must be embedded
- **Bleed**: Required, min 0.125"
- **Ink Coverage**: Max 320%

#### PDF/X-4:2010
- **PDF Version**: 1.4 to 1.6
- **Color Space**: CMYK, Grayscale, RGB, LAB (with ICC profiles)
- **Images**: Min 300 DPI, ICC profiles required
- **Fonts**: Must be embedded, OpenType allowed
- **Transparency**: Allowed (no flattening required)
- **Layers**: Allowed

### D. File Locations

```
print-industry-erp/
├── backend/
│   ├── migrations/
│   │   └── V0.0.46__create_preflight_color_management_tables.sql
│   ├── src/
│   │   ├── graphql/
│   │   │   ├── schema/operations.graphql
│   │   │   └── resolvers/operations.resolver.ts
│   │   └── modules/
│   │       └── operations/
│   │           ├── services/preflight.service.ts
│   │           └── operations.module.ts
│   ├── scripts/
│   │   ├── deploy-preflight-color-management.sh
│   │   └── health-check-preflight.sh
│   └── docs/
│       └── PREFLIGHT_DEPLOYMENT_GUIDE.md (this file)
└── frontend/
    └── src/
        ├── pages/
        │   ├── PreflightDashboard.tsx
        │   ├── PreflightProfilesPage.tsx
        │   ├── PreflightReportDetailPage.tsx
        │   └── ColorProofManagementPage.tsx
        └── graphql/
            └── queries/preflight.ts
```

---

**END OF DEPLOYMENT GUIDE**

For questions or issues, contact the DevOps team or file an issue in the project repository.
