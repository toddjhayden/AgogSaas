# Research Deliverable: Fix Duplicate Migration Versions - Flyway Conflicts

**REQ Number**: REQ-STRATEGIC-AUTO-1767084329267
**Agent**: Cynthia (Research Specialist)
**Date**: 2025-12-30
**Status**: COMPLETE

---

## Executive Summary

This research identifies **6 critical Flyway migration version conflicts** in the backend migrations directory that will prevent successful database deployments. A total of **15 migration files** share duplicate version numbers, violating Flyway's requirement for unique sequential versioning.

**Critical Impact**: These conflicts will cause Flyway to fail during migration execution with version conflicts, blocking all database deployments until resolved.

---

## Duplicate Version Conflicts Identified

### 1. Version V0.0.25 (2 files - CONFLICT)

| File | Purpose | Author | REQ Number |
|------|---------|--------|------------|
| `V0.0.25__add_table_partitioning_for_statistical_metrics.sql` | Partition bin_optimization_statistical_metrics table for performance | Marcus + Roy | REQ-STRATEGIC-AUTO-1766584106655 |
| `V0.0.25__add_vendor_performance_rls_and_constraints.sql` | Add RLS policies and constraints to vendor_performance table | Roy | REQ-STRATEGIC-AUTO-1766657618088 |

**Analysis**: Both migrations are production-critical. The first addresses a high-priority performance issue (Sylvia Issue #7). The second implements security controls for vendor scorecards. These are completely independent migrations that were accidentally assigned the same version number.

**Recommendation**: Renumber the vendor RLS migration to V0.0.26 (requires shifting subsequent versions).

---

### 2. Version V0.0.32 (2 files - BUG FIX SCENARIO)

| File | Purpose | Status |
|------|---------|--------|
| `V0.0.32__create_inventory_forecasting_tables.sql` | Original inventory forecasting tables (BROKEN) | Has foreign key bugs |
| `V0.0.32__create_inventory_forecasting_tables_FIXED.sql` | Fixed version with corrected foreign keys | Fixed by Billy QA |

**Analysis**: The original V0.0.32 migration had critical bugs (referenced `tenants(tenant_id)` instead of `tenants(id)`). The FIXED version corrects these foreign key references. However, both files still exist with the same version number.

**Recommendation**:
- **Delete** the original broken file: `V0.0.32__create_inventory_forecasting_tables.sql`
- **Rename** the FIXED file to: `V0.0.32__create_inventory_forecasting_tables.sql` (remove _FIXED suffix)
- This is a simple cleanup - the FIXED version should be the canonical V0.0.32

---

### 3. Version V0.0.39 (2 files - BACKUP SCENARIO)

| File | Purpose | Status |
|------|---------|--------|
| `V0.0.39__create_po_approval_workflow_tables_BACKUP_UNUSED.sql` | Original PO approval workflow (marked BACKUP_UNUSED) | Superseded |
| `V0.0.39__forecasting_enhancements_roy_backend.sql` | Forecasting enhancements (urgency_level, costs) | Active migration |

**Analysis**: The filename suffix `_BACKUP_UNUSED` clearly indicates the first file is deprecated. The forecasting enhancements migration is the active V0.0.39. The backup file appears to be from REQ-STRATEGIC-AUTO-1735134000000 and was likely replaced by V0.0.38.

**Recommendation**:
- **Delete** the backup file: `V0.0.39__create_po_approval_workflow_tables_BACKUP_UNUSED.sql`
- Keep `V0.0.39__forecasting_enhancements_roy_backend.sql` as canonical V0.0.39

---

### 4. Version V0.0.40 (3 files - CONFLICT)

| File | Purpose | Author | REQ Number |
|------|---------|--------|------------|
| `V0.0.40__add_performance_monitoring_olap.sql` | Query performance logging and monitoring infrastructure | Roy | REQ-STRATEGIC-AUTO-1767045901876 |
| `V0.0.40__create_routing_templates.sql` | Routing templates for production planning | Roy | REQ-STRATEGIC-AUTO-1767048328658 |
| `V0.0.40__create_jobs_and_standard_costs_tables.sql` | Jobs and standard costs tables for estimating | Roy | REQ-STRATEGIC-AUTO-1767048328661 |

**Analysis**: THREE different migrations all assigned V0.0.40, representing distinct modules:
1. Performance monitoring OLAP (analytics infrastructure)
2. Routing templates (production planning)
3. Jobs and standard costs (estimating/costing)

All three are production-critical and independent. This is a severe versioning conflict.

**Recommendation**: Renumber as follows:
- Keep `V0.0.40__add_performance_monitoring_olap.sql` as V0.0.40 (oldest by timestamp)
- Renumber `V0.0.40__create_routing_templates.sql` → V0.0.50
- Renumber `V0.0.40__create_jobs_and_standard_costs_tables.sql` → V0.0.51

---

### 5. Version V0.0.41 (4 files - CONFLICT)

| File | Purpose | Status | REQ Number |
|------|---------|--------|------------|
| `V0.0.41__add_rls_policies_production_planning.sql` | RLS policies for production planning tables | Active | REQ-STRATEGIC-AUTO-1767048328658 |
| `V0.0.41__add_production_analytics_indexes.sql` | Production analytics indexes (original) | Superseded by FIXED | REQ-STRATEGIC-AUTO-1767048328660 |
| `V0.0.41__add_production_analytics_indexes_FIXED.sql` | Production analytics indexes (fixed version) | Active | REQ-STRATEGIC-AUTO-1767048328660 |
| `V0.0.41__create_estimating_tables.sql` | Estimating module tables | Active | REQ-STRATEGIC-AUTO-1767048328661 |

**Analysis**: FOUR migrations with V0.0.41:
- RLS policies (security - HIGH PRIORITY per Sylvia)
- Analytics indexes (two versions - original + fixed)
- Estimating tables

**Recommendation**:
- **Delete** `V0.0.41__add_production_analytics_indexes.sql` (superseded by FIXED version)
- Keep `V0.0.41__add_rls_policies_production_planning.sql` as V0.0.41 (security priority)
- Renumber `V0.0.41__add_production_analytics_indexes_FIXED.sql` → V0.0.52
- Renumber `V0.0.41__create_estimating_tables.sql` → V0.0.53

---

### 6. Version V0.0.42 (2 files - CONFLICT)

| File | Purpose | Author | REQ Number |
|------|---------|--------|------------|
| `V0.0.42__create_analytics_views.sql` | Advanced reporting and BI views | Roy | REQ-STRATEGIC-AUTO-1767048328662 |
| `V0.0.42__create_job_costing_tables.sql` | Job costing tables for profitability analysis | Roy | REQ-STRATEGIC-AUTO-1767048328661 |

**Analysis**: Both migrations are part of the advanced analytics and job costing features. They are independent but logically related.

**Recommendation**:
- Keep `V0.0.42__create_job_costing_tables.sql` as V0.0.42 (foundational data tables)
- Renumber `V0.0.42__create_analytics_views.sql` → V0.0.54 (views depend on tables)

---

## Migration Version Renumbering Plan

### Phase 1: Cleanup (Delete Superseded/Backup Files)

```bash
# Delete broken original files that were fixed
rm V0.0.32__create_inventory_forecasting_tables.sql

# Delete backup/unused files
rm V0.0.39__create_po_approval_workflow_tables_BACKUP_UNUSED.sql

# Delete superseded analytics index file
rm V0.0.41__add_production_analytics_indexes.sql
```

### Phase 2: Rename Fixed Versions (Remove Suffixes)

```bash
# V0.0.32 - Remove _FIXED suffix
mv V0.0.32__create_inventory_forecasting_tables_FIXED.sql \
   V0.0.32__create_inventory_forecasting_tables.sql
```

### Phase 3: Renumber Conflicts

**Current highest version**: V0.0.49 (`add_rls_wms_procurement_tables.sql`)

**New version assignments for conflicts**:

```bash
# V0.0.25 conflict - shift vendor RLS to V0.0.26
# BLOCKED: V0.0.26 already exists (enhance_vendor_scorecards.sql)
# Must shift V0.0.25__add_vendor_performance_rls_and_constraints.sql to end

mv V0.0.25__add_vendor_performance_rls_and_constraints.sql \
   V0.0.50__add_vendor_performance_rls_and_constraints.sql

# V0.0.40 conflicts - renumber routing and jobs
mv V0.0.40__create_routing_templates.sql \
   V0.0.51__create_routing_templates.sql

mv V0.0.40__create_jobs_and_standard_costs_tables.sql \
   V0.0.52__create_jobs_and_standard_costs_tables.sql

# V0.0.41 conflicts - renumber analytics indexes and estimating
mv V0.0.41__add_production_analytics_indexes_FIXED.sql \
   V0.0.53__add_production_analytics_indexes.sql

mv V0.0.41__create_estimating_tables.sql \
   V0.0.54__create_estimating_tables.sql

# V0.0.42 conflict - renumber analytics views
mv V0.0.42__create_analytics_views.sql \
   V0.0.55__create_analytics_views.sql
```

---

## Final Migration Sequence (After Renumbering)

| Version | Migration Name | Purpose |
|---------|----------------|---------|
| V0.0.25 | add_table_partitioning_for_statistical_metrics | Partition bin optimization metrics |
| V0.0.26 | enhance_vendor_scorecards | Vendor scorecard enhancements |
| ... | (existing migrations V0.0.27-V0.0.31) | ... |
| V0.0.32 | create_inventory_forecasting_tables | Inventory forecasting (FIXED version) |
| ... | (existing migrations V0.0.33-V0.0.38) | ... |
| V0.0.39 | forecasting_enhancements_roy_backend | Forecasting urgency and costs |
| V0.0.40 | add_performance_monitoring_olap | Performance monitoring OLAP |
| V0.0.41 | add_rls_policies_production_planning | Production planning RLS (security) |
| V0.0.42 | create_job_costing_tables | Job costing tables |
| ... | (existing migrations V0.0.43-V0.0.49) | ... |
| **V0.0.50** | add_vendor_performance_rls_and_constraints | Vendor RLS (moved from V0.0.25) |
| **V0.0.51** | create_routing_templates | Routing templates (moved from V0.0.40) |
| **V0.0.52** | create_jobs_and_standard_costs_tables | Jobs and costs (moved from V0.0.40) |
| **V0.0.53** | add_production_analytics_indexes | Analytics indexes (moved from V0.0.41) |
| **V0.0.54** | create_estimating_tables | Estimating tables (moved from V0.0.41) |
| **V0.0.55** | create_analytics_views | Advanced analytics views (moved from V0.0.42) |

---

## Dependency Analysis

### Critical Dependencies to Verify After Renumbering

1. **V0.0.51 (routing_templates)** → Dependencies:
   - Requires: V0.0.03 (operations module - production_orders)
   - Required by: V0.0.41 (RLS policies reference routing_templates)
   - **ACTION**: V0.0.41 must enable RLS on routing_templates, but V0.0.51 creates the table AFTER V0.0.41 runs
   - **FIX REQUIRED**: Must either:
     - Move V0.0.51 BEFORE V0.0.41, OR
     - Update V0.0.41 to conditionally enable RLS (IF EXISTS)

2. **V0.0.52 (jobs_and_standard_costs_tables)** → Dependencies:
   - Requires: V0.0.02 (core multitenant - tenants, users)
   - Required by: V0.0.42 (job_costs references jobs table)
   - **ACTION**: V0.0.42 runs BEFORE V0.0.52 in new sequence
   - **FIX REQUIRED**: Move V0.0.52 BEFORE V0.0.42, renumber to V0.0.41.5 or earlier

3. **V0.0.54 (estimating_tables)** → Dependencies:
   - Requires: V0.0.52 (jobs and standard_costs tables)
   - Required by: None identified
   - **ACTION**: OK - V0.0.54 runs after V0.0.52

4. **V0.0.55 (analytics_views)** → Dependencies:
   - Requires: Multiple tables from vendor, production, job costing modules
   - **ACTION**: Should run LAST - position at V0.0.55 is correct

---

## Recommended Resolution Strategy

### Option A: Conservative Approach (Recommended for Production)

**Preserve existing migration history where possible**:

1. **Delete superseded files** (Phase 1)
2. **Rename FIXED versions** (Phase 2)
3. **Renumber only absolutely necessary conflicts** to versions V0.0.50+
4. **Update dependency migrations** to handle reordered tables:
   - Add `IF EXISTS` clauses to RLS migrations
   - Add dependency comments to migration headers
5. **Test migration sequence** in clean database before deployment

**Pros**:
- Minimal disruption to existing migrations
- Clear audit trail of version changes
- Easier rollback if issues discovered

**Cons**:
- Some migrations run out of logical order
- Requires updating RLS and dependency migrations

---

### Option B: Aggressive Re-sequencing (Development Only)

**Complete renumbering to logical order**:

1. Delete all conflicts and superseded files
2. Renumber ALL migrations from V0.0.25+ to enforce logical dependency order
3. Update all REQ documentation with new version numbers

**Pros**:
- Migrations run in perfect dependency order
- Cleaner long-term structure

**Cons**:
- High risk of breaking existing deployments
- Requires updating all REQ tracking documents
- May conflict with already-applied migrations in deployed environments

---

## Flyway Conflict Resolution Commands

### Automated Script (Recommended)

```bash
#!/bin/bash
# fix-flyway-duplicates.sh

cd print-industry-erp/backend/migrations

echo "Phase 1: Delete superseded files..."
rm -f V0.0.32__create_inventory_forecasting_tables.sql
rm -f V0.0.39__create_po_approval_workflow_tables_BACKUP_UNUSED.sql
rm -f V0.0.41__add_production_analytics_indexes.sql

echo "Phase 2: Rename FIXED versions..."
mv V0.0.32__create_inventory_forecasting_tables_FIXED.sql \
   V0.0.32__create_inventory_forecasting_tables.sql

echo "Phase 3: Renumber conflicts..."
mv V0.0.25__add_vendor_performance_rls_and_constraints.sql \
   V0.0.50__add_vendor_performance_rls_and_constraints.sql

mv V0.0.40__create_routing_templates.sql \
   V0.0.56__create_routing_templates.sql

mv V0.0.40__create_jobs_and_standard_costs_tables.sql \
   V0.0.51__create_jobs_and_standard_costs_tables.sql

mv V0.0.41__add_production_analytics_indexes_FIXED.sql \
   V0.0.57__add_production_analytics_indexes.sql

mv V0.0.41__create_estimating_tables.sql \
   V0.0.54__create_estimating_tables.sql

mv V0.0.42__create_analytics_views.sql \
   V0.0.58__create_analytics_views.sql

echo "Phase 4: Update dependencies..."
# Add IF EXISTS to RLS migration for routing_templates
sed -i 's/ALTER TABLE routing_templates ENABLE/ALTER TABLE IF EXISTS routing_templates ENABLE/' \
   V0.0.41__add_rls_policies_production_planning.sql

# Add IF EXISTS to RLS migration for routing_operations
sed -i 's/ALTER TABLE routing_operations ENABLE/ALTER TABLE IF EXISTS routing_operations ENABLE/' \
   V0.0.41__add_rls_policies_production_planning.sql

echo "✓ Flyway migration conflicts resolved!"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff migrations/"
echo "2. Test in clean database: npm run migrate"
echo "3. Commit changes: git add migrations/ && git commit -m 'fix: resolve Flyway duplicate version conflicts'"
```

---

## Critical Dependency Fix Required

### V0.0.41 RLS Migration Issue

**Problem**: V0.0.41 attempts to enable RLS on `routing_templates` and `routing_operations` tables, but these tables are created in V0.0.56 (after renumbering from V0.0.40).

**Solution**: Update V0.0.41 to use conditional RLS enabling:

```sql
-- V0.0.41__add_rls_policies_production_planning.sql

-- Enable RLS only if tables exist (they may be created in later migrations)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'routing_templates') THEN
    ALTER TABLE routing_templates ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'routing_operations') THEN
    ALTER TABLE routing_operations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
```

**Alternative**: Create a new migration V0.0.59 to enable RLS on routing tables after they're created.

---

## Testing & Validation Plan

### Pre-Deployment Testing

1. **Clean Database Test**:
   ```bash
   # Drop and recreate test database
   npm run db:drop:test
   npm run db:create:test

   # Run all migrations
   npm run migrate:test

   # Verify no version conflicts
   npm run migrate:validate:test
   ```

2. **Verify Migration Order**:
   ```sql
   -- Check flyway_schema_history for correct sequence
   SELECT version, description, installed_on, success
   FROM flyway_schema_history
   ORDER BY installed_rank;
   ```

3. **Dependency Validation**:
   ```bash
   # Run custom dependency checker
   npm run migrate:check-dependencies
   ```

### Post-Deployment Verification

1. Verify all 15 problematic files are resolved
2. Confirm no duplicate versions remain
3. Test affected features:
   - Vendor scorecards (V0.0.50 - moved from V0.0.25)
   - Production routing (V0.0.56 - moved from V0.0.40)
   - Job costing (V0.0.51-V0.0.54)
   - Analytics views (V0.0.58)

---

## Risk Assessment

### High Risk Items

1. **V0.0.41 RLS Migration** - May fail if routing_templates doesn't exist
   - **Mitigation**: Add IF EXISTS checks
   - **Priority**: HIGH

2. **V0.0.42 Job Costing** - References jobs table created in V0.0.51 (later version)
   - **Mitigation**: Move V0.0.51 before V0.0.42, or renumber V0.0.51 to V0.0.41.5
   - **Priority**: CRITICAL

3. **Deployed Environments** - May have already applied some migrations
   - **Mitigation**: Check flyway_schema_history before applying fixes
   - **Priority**: HIGH

### Medium Risk Items

1. **REQ Documentation** - Version numbers in deliverables may be outdated
2. **Git Blame History** - File renames lose git history
   - **Mitigation**: Use `git mv` instead of `mv`

---

## Recommendations for Prevention

### Process Improvements

1. **Version Assignment Registry**:
   - Maintain a shared `MIGRATION_VERSIONS.md` file tracking assigned versions
   - Require agents to reserve version numbers before creating migrations
   - Use atomic increment: `next_version = max(versions) + 1`

2. **Pre-Commit Hook**:
   ```bash
   #!/bin/bash
   # .git/hooks/pre-commit

   # Check for duplicate Flyway versions
   cd migrations/
   DUPLICATES=$(ls V*.sql | sed 's/__.*//' | sort | uniq -d)

   if [ ! -z "$DUPLICATES" ]; then
     echo "ERROR: Duplicate Flyway versions detected:"
     echo "$DUPLICATES"
     exit 1
   fi
   ```

3. **Automated Version Checker**:
   - Add npm script to detect duplicate versions
   - Run in CI/CD pipeline before deployment
   - Block pull requests with version conflicts

4. **Migration Naming Convention**:
   - Include agent name: `V0.0.XX__[agent-name]_feature_description.sql`
   - Include REQ number in comment header
   - Document dependencies in migration comments

---

## Conclusion

**Total Conflicts**: 6 duplicate version numbers affecting 15 migration files

**Immediate Actions Required**:
1. Delete 3 superseded/backup files
2. Rename 1 FIXED file to remove suffix
3. Renumber 6 migrations to versions V0.0.50-V0.0.58
4. Fix dependency issues in V0.0.41 and V0.0.42

**Timeline**:
- Fixes can be implemented in ~30 minutes
- Testing requires ~2 hours (clean DB migration test)
- Total resolution time: 3-4 hours

**Deployment Blocker**: YES - These conflicts will prevent successful Flyway migrations

**Recommended Approach**: Option A (Conservative) - Renumber to V0.0.50+ range with dependency fixes

---

## Deliverable Artifacts

1. This research document (CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1767084329267.md)
2. Automated fix script (recommended for Roy to review and execute)
3. Dependency analysis with critical fixes identified
4. Testing and validation checklist

---

**Research Completed**: 2025-12-30
**Ready for Roy (Backend) Implementation**: YES
**Deployment Blocker Severity**: CRITICAL

