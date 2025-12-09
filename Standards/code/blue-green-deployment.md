**📍 Navigation Path:** [AGOG Home](../../README.md) → [Standards](../README.md) → [Code Standards](./README.md) → Blue-Green Deployment

# Blue-Green Deployment Strategy

## What is Blue-Green Deployment?

Blue-Green deployment is a release management strategy that reduces downtime and risk by running two identical production environments: **Blue** (current/live) and **Green** (new/staging).

### The Basic Concept

```
┌─────────────────────────────────────────────────────┐
│                    Load Balancer                    │
└─────────────────────────────────────────────────────┘
                         │
                         ├──────────────────┐
                         │                  │
                    ┌────▼────┐        ┌────▼────┐
                    │  BLUE   │        │  GREEN  │
                    │ (Live)  │        │ (Idle)  │
                    │ v1.2.0  │        │ v1.3.0  │
                    └─────────┘        └─────────┘
                         │                  │
                    ┌────▼──────────────────▼────┐
                    │       Database Layer       │
                    │    (Shared or Synced)      │
                    └────────────────────────────┘

After deployment & validation:
    - Switch traffic from Blue → Green
    - Green becomes live
    - Blue becomes the rollback environment
```

## Why Blue-Green for AGOG?

### Critical Requirements for Print ERP
1. **24/7 Operations** - Print shops run around the clock
2. **Multi-Tenant SaaS** - Downtime affects multiple customers
3. **Real-Time Equipment** - Manufacturing equipment can't lose connection
4. **Financial Transactions** - Order processing can't be interrupted
5. **Zero-Downtime Mandate** - Production schedules are tight

### Benefits
- ✅ **Zero Downtime** - Traffic switches instantly
- ✅ **Instant Rollback** - Switch back if issues arise
- ✅ **Production Testing** - Validate in real environment before cutover
- ✅ **Reduced Risk** - Old version stays ready
- ✅ **Database Migrations** - Test on Green before cutover
- ✅ **Confidence** - Smoke tests on Green with real data

## Blue-Green Deployment vs. Git Workflow

### Important: Blue/Green are NOT Git Branches or Versions

**Common Confusion:**
Many developers mistakenly think "Blue" and "Green" are:
- ❌ Git branches (like `main` vs `feature/new-thing`)
- ❌ Version numbers (like v1.0.0 vs v2.0.0)
- ❌ Permanent environments (like "staging" vs "production")

**Reality:**
Blue and Green are **temporary deployment slots** that swap roles with each release.

### The Key Concepts

| Concept | Purpose | Example |
|---------|---------|---------|
| **Git Workflow** | Code version control and collaboration | `main`, `feature/add-notifications`, `hotfix/fix-bug` |
| **Semantic Versioning** | Describes what changed in the code | v2.0.0 (breaking), v2.1.0 (feature), v2.1.1 (bugfix) |
| **Blue-Green Deployment** | Infrastructure pattern for zero-downtime releases | Blue = live now, Green = deploying next |

### How They Work Together

**Git Workflow (Feature Development):**
```bash
# Developer creates feature branch from main
git checkout -b feature/add-equipment-maintenance

# Create migration with semantic version
# Last deployed version: v2.0.0
# This is a new feature: v2.1.0
touch migrations/V2.1.0__add_equipment_maintenance.sql

# Add application code
code src/modules/equipment/maintenance.service.ts

# Commit everything together
git add migrations/V2.1.0__add_equipment_maintenance.sql
git add src/modules/equipment/
git commit -m "feat: add equipment maintenance tracking (V2.1.0)"

# Push and create PR
git push origin feature/add-equipment-maintenance
gh pr create

# After PR approval, merge to main
git checkout main
git merge feature/add-equipment-maintenance
```

**Blue-Green Deployment (Infrastructure):**
```
Before Deployment:
├─ Production running v2.0.0 → This is "Blue" (active)
└─ Standby environment idle  → This is "Green" (waiting)

During Deployment of v2.1.0:
├─ Blue (v2.0.0) → Still serving all traffic
└─ Green (v2.1.0) → Deploy new version, run migrations, test

After Cutover:
├─ Blue (v2.0.0) → Standby (rollback capability)
└─ Green (v2.1.0) → NOW serving all traffic (active)

After Stabilization:
├─ Blue (v2.1.0) → Update to match, becomes standby for NEXT release
└─ Green (v2.1.0) → Production (will become standby for NEXT release)

Next Deployment (v2.2.0) - Roles Swap!:
├─ Blue (v2.1.0) → Deploy v2.2.0 here (now it's the "new" environment)
└─ Green (v2.1.0) → Keep serving traffic (now it's the "old" environment)
```

### Semantic Versioning in Migrations

**MAJOR.MINOR.PATCH describes what changed, NOT deployment method:**

```sql
-- V2.0.0__initial_release.sql
-- MAJOR: First production release

-- V2.1.0__add_equipment_maintenance.sql  
-- MINOR: New feature (backward compatible)

-- V2.1.1__fix_maintenance_index.sql
-- PATCH: Bug fix (no schema change, just index optimization)

-- V3.0.0__rename_job_fields.sql
-- MAJOR: Breaking change (column renames, multi-step migration needed)
```

**Key Point:** These version numbers are determined by **what changed in the code/schema**, not by whether they're deployed to Blue or Green.

### Real-World Scenario

**Scenario: Bug found in production v2.1.0**

```bash
# Step 1: Create hotfix branch
git checkout -b hotfix/fix-notification-crash

# Step 2: Fix the bug
code src/modules/notifications/service.ts

# Step 3: Create PATCH migration (if database fix needed)
# Current: v2.1.0, Patch: v2.1.1
touch migrations/V2.1.1__fix_notification_index.sql

# Step 4: Commit and merge
git commit -m "fix: notification crash on null user (V2.1.1)"
git push origin hotfix/fix-notification-crash
# PR approved, merge to main

# Step 5: Deploy using Blue-Green
# Currently: Green is production at v2.1.0 (it's the "live" one)
# Deploy v2.1.1 to Blue (it's idle right now)
# Test Blue with v2.1.1
# Switch traffic to Blue
# Now: Blue is production at v2.1.1, Green is standby
```

**See how Blue and Green swap?** They're just deployment slots, not versions!

### Common Mistakes to Avoid

❌ **MISTAKE:** "We need to fork the repo for Blue and Green"
✅ **CORRECT:** Single repo, use feature branches, merge to `main`

❌ **MISTAKE:** "v2.0.1 will be called Green"  
✅ **CORRECT:** v2.0.1 is a version number. It will be deployed to whichever slot (Blue or Green) is currently idle

❌ **MISTAKE:** "Blue is always v1.x, Green is always v2.x"
✅ **CORRECT:** Both Blue and Green can run any version. They swap roles with each deployment

❌ **MISTAKE:** "Migration versions only for database schema issues"
✅ **CORRECT:** Migration versions match application versions (MAJOR for breaking, MINOR for features, PATCH for fixes)

❌ **MISTAKE:** "Need separate branches for Blue and Green"
✅ **CORRECT:** One `main` branch, one version number, deployed to whichever environment is idle

### Quick Reference

**Git Workflow:**
```
main (production code)
├─ feature/new-thing → merge → v2.1.0
├─ hotfix/fix-bug    → merge → v2.1.1
└─ feature/breaking  → merge → v3.0.0
```

**Blue-Green Deployment:**
```
Deployment 1: v2.1.0 → Deploy to Green → Cutover → Green is live
Deployment 2: v2.1.1 → Deploy to Blue  → Cutover → Blue is live
Deployment 3: v2.2.0 → Deploy to Green → Cutover → Green is live
(Blue and Green keep swapping who's live)
```

**The Mental Model:**
- **Git branches:** How developers organize code changes
- **Version numbers:** What changed (semantic versioning)
- **Blue/Green:** Where it's deployed (infrastructure slots that swap)

### Summary

Think of it this way:
- **Git workflow** = Your kitchen (where you prepare the meal)
- **Version numbers** = The recipe version (v1: pizza, v2: improved pizza with toppings)
- **Blue-Green** = Two serving tables (serve from Table 1 while preparing Table 2, then swap)

The recipe (code version) is independent of which table (Blue or Green) is currently serving customers!

## How Blue-Green Works for AGOG

### Phase 1: Pre-Deployment State
```
┌─────────────┐
│Load Balancer│ ──100%──> BLUE (v1.2.0) [LIVE]
└─────────────┘
                          GREEN (v1.2.0) [IDLE - waiting for next release]
```

**Current State:**
- Blue environment serving all production traffic
- Green environment idle or serving staging traffic
- Both environments identical (v1.2.0)

### Phase 2: Deploy New Version to Green
```
┌─────────────┐
│Load Balancer│ ──100%──> BLUE (v1.2.0) [LIVE]
└─────────────┘
                          GREEN (v1.3.0) [DEPLOYING - new version]
```

**Actions:**
1. Deploy new code (v1.3.0) to Green environment
2. Run database migrations on Green database (if schema compatible)
3. Warm up application (start services, load caches)
4. Run automated smoke tests
5. Verify health checks pass

**Users:** Still on Blue (v1.2.0) - no impact

### Phase 3: Validation on Green
```
┌─────────────┐
│Load Balancer│ ──100%──> BLUE (v1.2.0) [LIVE]
└─────────────┘           
              ──Internal─> GREEN (v1.3.0) [VALIDATING]
```

**Validation Steps:**
1. **Smoke Tests** - Core functionality works
2. **Integration Tests** - External systems (JDF, equipment) connect
3. **Database Validation** - Migrations applied correctly
4. **Performance Checks** - Response times acceptable
5. **Manual Verification** - QA team spot checks
6. **Canary Testing** (optional) - Route 1-5% traffic to Green

**Decision Point:** Go/No-Go for traffic cutover

### Phase 4: Traffic Cutover
```
┌─────────────┐
│Load Balancer│ ──100%──> GREEN (v1.3.0) [NOW LIVE]
└─────────────┘
                          BLUE (v1.2.0) [STANDBY - ready for rollback]
```

**Cutover Process:**
1. Update load balancer configuration
2. Route 100% traffic to Green
3. Monitor metrics closely (errors, latency, throughput)
4. Keep Blue running for quick rollback

**Cutover Time:** Seconds (DNS/load balancer switch)

### Phase 5: Monitoring & Stabilization
```
Monitor GREEN for 30-60 minutes:
  ✓ Error rates normal
  ✓ Response times acceptable
  ✓ Database performance good
  ✓ Equipment connections stable
  ✓ No customer complaints
```

**If Issues Detected:**
- Switch traffic back to Blue (instant rollback)
- Investigate issues on Green
- Fix and redeploy

**If Stable:**
- Declare deployment successful
- Green is now the production environment
- Prepare Blue for next release

### Phase 6: Cleanup
```
┌─────────────┐
│Load Balancer│ ──100%──> GREEN (v1.3.0) [LIVE]
└─────────────┘
                          BLUE (v1.3.0) [Update to match Green]
```

**After Stabilization (24-48 hours):**
1. Update Blue to v1.3.0 (match Green)
2. Both environments now identical again
3. Blue becomes standby for next release cycle

## Database Considerations - CRITICAL REQUIREMENT

### ⚠️ The Database Challenge That Breaks Blue-Green

**Common Mistake:**
Many teams think Blue-Green is just about running two application environments, but **forget that TRUE Blue-Green requires parallel database capability** for full rollback.

**The Problem:**
```
❌ WRONG: Shared Database Only
┌──────────┐
│   BLUE   │ ─┐
│ (v1.2.0) │  │
└──────────┘  ├──> Single Database (v1.3.0 schema)
              │
┌──────────┐  │
│  GREEN   │ ─┘
│ (v1.3.0) │
└──────────┘

Issue: If you rollback to Blue, it can't read v1.3.0 schema!
Rollback is BROKEN.
```

**The Reality:**
For TRUE Blue-Green with full rollback capability, you need **parallel databases** or **backward-compatible schema changes**.

### Database Strategy Options for AGOG

#### Strategy 1: Backward-Compatible Shared Database (RECOMMENDED)

**How it Works:**
```
┌──────────┐
│   BLUE   │ ──> Shared Database
│ (v1.2.0) │     (Schema works with BOTH versions)
└──────────┘

┌──────────┐
│  GREEN   │ ──> Same Database
│ (v1.3.0) │     (New features, old compatibility)
└──────────┘
```

**Requirements:**
1. ✅ Schema changes MUST be backward-compatible
2. ✅ Old version ignores new columns/tables
3. ✅ New version can read old data format
4. ✅ Data migrations are optional (new columns nullable)

**Example: Adding Customer Preferences**
```sql
-- CORRECT: Backward-Compatible Migration
-- This works for Blue-Green rollback

-- Phase 1: Add new column (nullable)
ALTER TABLE customers 
ADD COLUMN preferences JSONB DEFAULT '{}';

-- Add index for new version
CREATE INDEX idx_customers_preferences 
ON customers USING gin(preferences);

-- Phase 1 Result:
-- ✓ Blue (v1.2.0): Ignores preferences column, continues working
-- ✓ Green (v1.3.0): Uses preferences column for new features
-- ✓ ROLLBACK WORKS: Blue can still read all data
```

**Later Enforcement (AFTER Blue updated to v1.3.0):**
```sql
-- Phase 2: Only run after BOTH environments on v1.3.0+
ALTER TABLE customers 
ALTER COLUMN preferences SET NOT NULL;

-- Now safe because no rollback to v1.2.0 possible
```

**Breaking Change Example (AVOID FOR ROLLBACK):**
```sql
-- ❌ WRONG: This breaks Blue-Green rollback
ALTER TABLE customers 
RENAME COLUMN email TO email_address;

-- Problem: Blue (v1.2.0) looks for "email" column
-- After migration, column doesn't exist
-- Blue CRASHES on rollback!
```

**How to Handle Breaking Changes:**
```sql
-- ✓ CORRECT: Add new column, keep old one temporarily
-- Step 1: Add new column
ALTER TABLE customers 
ADD COLUMN email_address VARCHAR(255);

-- Step 2: Populate from existing (in application or migration)
UPDATE customers 
SET email_address = email 
WHERE email_address IS NULL;

-- Step 3: Deploy Green (uses email_address)
-- Blue still uses email column

-- Step 4: After successful cutover, sync both columns
-- (in application logic for a while)

-- Step 5: Much later (after Blue updated), drop old column
-- ALTER TABLE customers DROP COLUMN email;
```

#### Strategy 2: Parallel Databases with Bidirectional Sync (FULL ISOLATION)

**How it Works:**
```
┌──────────┐
│   BLUE   │ ──> Blue Database (v1.2.0 schema)
│ (v1.2.0) │     └─ Snapshot at deployment time
└──────────┘

┌──────────┐
│  GREEN   │ ──> Green Database (v1.3.0 schema)
│ (v1.3.0) │     └─ Clone + new migrations
└──────────┘

   ↕ Bidirectional Sync ↕
   (During validation only)
```

**Critical Window: Post-Deployment Transaction Safety**

This is where most Blue-Green documentation fails. Here's the real-world scenario:

```
Timeline of a Sunday Night Release:

Sunday 8:00 PM:  Deploy v1.3.0 to Green, cutover traffic to Green
Sunday 8:00 PM → Monday 11:59 PM: Green is LIVE, customers create transactions
Monday Night:    FATAL FLAW discovered in v1.3.0
                 Need to rollback to Blue (v1.2.0)
                 
PROBLEM: Monday's transactions are in Green database only!
         Rollback to Blue = LOSE ALL MONDAY TRANSACTIONS! 💥
```

**The Solution: Bidirectional Sync During Stabilization Window**

```
┌─────────────────────────────────────────────────────────────┐
│               Sunday 8 PM: Cutover to Green                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  BLUE Database (v1.2.0)      GREEN Database (v1.3.0)       │
│  [Read-Only Archive]    ◄──┬──► [LIVE - Active Traffic]   │
│                             │                               │
│  Receives:                  │   Receives:                   │
│  ✓ Real-time replica ◄──────┤   ✓ All customer traffic     │
│    of Green transactions    │   ✓ All new orders           │
│                             │   ✓ All updates              │
│  Then replicates back: ─────┘                              │
│  ✓ Compatible format                                       │
│                                                             │
│  WHY: If rollback needed Monday, Blue has all Sunday +     │
│       Monday transactions. NO DATA LOSS.                   │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**

**Phase 1: Pre-Deployment (Before Sunday)**
```sql
-- 1. Create snapshot of Production (Blue) database
-- This is your "point-in-time catastrophe recovery"
pg_dump agog_production > agog_backup_pre_release_v1.3.0.sql

-- 2. Restore to Green database
psql agog_green < agog_backup_pre_release_v1.3.0.sql

-- 3. Apply new migrations to Green only
psql agog_green < migrations/V1.3.0__add_new_features.sql

-- 4. Green now has v1.3.0 schema, Blue still v1.2.0 schema
```

**Phase 2: Setup Bidirectional Replication (Before Cutover)**
```yaml
# Replication Configuration
# Sunday 7:45 PM - Before cutover

Replication Setup:
  Primary: GREEN (will be live soon)
  Replica: BLUE (receives changes from Green)
  
  Direction: GREEN → BLUE
  Mode: Real-time logical replication
  Transformation: Map v1.3.0 schema → v1.2.0 compatible format
```

**PostgreSQL Logical Replication Setup:**
```sql
-- On GREEN (publisher)
CREATE PUBLICATION green_to_blue_pub 
FOR ALL TABLES;

-- On BLUE (subscriber)
CREATE SUBSCRIPTION blue_from_green_sub
CONNECTION 'host=green-db port=5432 dbname=agog_green'
PUBLICATION green_to_blue_pub
WITH (
    copy_data = false,  -- Don't copy existing, we're at same point
    create_slot = true,
    enabled = true
);
```

**Phase 3: Cutover (Sunday 8:00 PM)**
```bash
#!/bin/bash
# cutover-to-green.sh

echo "Switching traffic to GREEN..."

# 1. Verify replication is running
echo "Checking replication lag..."
REPLICATION_LAG=$(psql -h blue-db -c "SELECT NOW() - last_msg_receipt_time FROM pg_stat_subscription WHERE subname='blue_from_green_sub';")

if [ "$REPLICATION_LAG" -gt 5 ]; then
    echo "ERROR: Replication lag too high: $REPLICATION_LAG seconds"
    exit 1
fi

# 2. Switch load balancer to Green
az network lb rule update \
  --resource-group agog-prod \
  --lb-name agog-lb \
  --name http-rule \
  --backend-pool-name green-pool

echo "✓ Traffic now on GREEN"
echo "✓ BLUE receiving real-time replica of all transactions"
echo "✓ Safe to rollback with zero data loss for 48 hours"
```

**Phase 4: Stabilization Window (Sunday 8 PM → Tuesday 8 PM)**
```
┌──────────────────────────────────────────────────────────┐
│          48-Hour Stabilization Window                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  BLUE DB: Receives ALL transactions from Green          │
│           ✓ Sunday night orders                         │
│           ✓ Monday morning production                   │
│           ✓ Monday afternoon shipments                  │
│           ✓ Monday night invoice generation             │
│                                                          │
│  If fatal flaw found Monday night:                      │
│    1. Switch traffic back to Blue                       │
│    2. Blue has ALL Sunday + Monday transactions         │
│    3. Zero data loss                                    │
│    4. Customers never know there was an issue           │
│                                                          │
│  Replication continues until we're confident            │
└──────────────────────────────────────────────────────────┘
```

**Phase 5: Schema Translation Layer (Critical for Different Schemas)**

When Green has v1.3.0 schema and Blue has v1.2.0 schema:

```sql
-- Example: Green added "preferences JSONB" column
-- Blue doesn't have this column

-- Replication needs transformation:
CREATE OR REPLACE FUNCTION replicate_to_blue()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert to Blue, omitting new columns
    INSERT INTO blue.customers (
        id,
        tenant_id,
        name,
        email,
        -- Omit 'preferences' - Blue doesn't understand it
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.tenant_id,
        NEW.name,
        NEW.email,
        NEW.created_at,
        NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        updated_at = EXCLUDED.updated_at;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on Green to replicate to Blue
CREATE TRIGGER replicate_customer_to_blue
AFTER INSERT OR UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION replicate_to_blue();
```

**Phase 6: Rollback Scenario (If Fatal Flaw Found)**

```bash
#!/bin/bash
# rollback-to-blue.sh
# Monday Night - Fatal flaw discovered in Green

echo "EMERGENCY ROLLBACK TO BLUE"
echo "Green v1.3.0 has fatal flaw, reverting to Blue v1.2.0"

# 1. Verify Blue has latest transactions
BLUE_LATEST=$(psql -h blue-db -c "SELECT MAX(created_at) FROM orders;")
GREEN_LATEST=$(psql -h green-db -c "SELECT MAX(created_at) FROM orders;")

echo "Blue latest order: $BLUE_LATEST"
echo "Green latest order: $GREEN_LATEST"

if [ "$BLUE_LATEST" != "$GREEN_LATEST" ]; then
    echo "WARNING: Replication lag detected!"
    echo "Waiting for replication to catch up..."
    sleep 10
fi

# 2. Stop replication from Green to Blue
psql -h blue-db -c "ALTER SUBSCRIPTION blue_from_green_sub DISABLE;"

# 3. Switch traffic back to Blue
az network lb rule update \
  --resource-group agog-prod \
  --lb-name agog-lb \
  --name http-rule \
  --backend-pool-name blue-pool

echo "✓ Traffic switched back to BLUE"
echo "✓ All Sunday + Monday transactions preserved"
echo "✓ Zero data loss"
echo "✓ Investigating Green offline"
```

**Phase 7: Catastrophic Recovery (Point-in-Time Restore)**

**Scenario:** Tuesday morning, discovered Monday's deployment corrupted data

```bash
#!/bin/bash
# catastrophe-recovery.sh
# Rewind to Sunday pre-deployment state

echo "CATASTROPHIC RECOVERY: Restore to Sunday pre-deployment"

# 1. Stop all traffic
echo "Taking system offline..."

# 2. Restore from Sunday snapshot
echo "Restoring pre-deployment snapshot..."
pg_restore agog_backup_pre_release_v1.3.0.sql | psql agog_production

# 3. You've lost Monday's transactions, but this is last resort
echo "WARNING: All Monday transactions lost"
echo "This is catastrophic recovery, not standard rollback"

# 4. Restart on Blue v1.2.0
echo "Restarting on Blue v1.2.0 from Sunday state"
```

**Why Keep Warm Snapshot Separate from Replication?**

```
Bidirectional Sync:     For rollback with zero data loss
                        ↓
                 Handles fatal bugs found Monday

Point-in-Time Snapshot: For catastrophic data corruption
                        ↓
                 Handles "oh no, we corrupted the data"
                 Last resort, lose Monday transactions
```

**Replication vs. Snapshot:**

| Scenario | Solution | Data Loss |
|----------|----------|-----------|
| Fatal bug in v1.3.0 code | Rollback using replicated Blue | Zero - Blue has all transactions |
| Data corruption in production | Restore point-in-time snapshot | Lose transactions since snapshot |
| Performance degradation | Rollback using replicated Blue | Zero - Blue has all transactions |
| Security breach | May need point-in-time restore | Depends on breach timing |

**Phase 8: Cleanup (After Successful Stabilization)**

```bash
#!/bin/bash
# finalize-green.sh
# Tuesday evening - Green stable, no rollback needed

echo "Finalizing Green deployment..."

# 1. Stop replication (no longer need Blue synced)
psql -h blue-db -c "DROP SUBSCRIPTION blue_from_green_sub;"

# 2. Update Blue to v1.3.0 (becomes new standby)
psql -h blue-db < migrations/V1.3.0__add_new_features.sql

# 3. Archive Sunday snapshot (keep for 30 days)
mv agog_backup_pre_release_v1.3.0.sql archives/

# 4. Take new snapshot for next release
pg_dump agog_production > agog_backup_pre_release_v1.4.0.sql

echo "✓ Green is now stable production"
echo "✓ Blue updated to v1.3.0, ready for next release cycle"
echo "✓ Sunday snapshot archived"
```

**Advantages:**
- ✅ Complete rollback capability (Blue DB has all transactions)
- ✅ Zero data loss on rollback
- ✅ Point-in-time recovery for catastrophic scenarios
- ✅ No schema compatibility required
- ✅ Can test destructive migrations safely
- ✅ True isolation between versions during stabilization

**Disadvantages:**
- ❌ Complex bidirectional sync (requires schema translation)
- ❌ Higher infrastructure cost (2x databases during stabilization)
- ❌ Replication lag monitoring required
- ❌ More operational complexity
- ❌ Need to handle conflict resolution (rare, but possible)

**When to Use:**
- Major database schema overhauls
- High-risk releases (major version bumps)
- Regulatory requirement for zero data loss
- First few releases of new system
- Black Friday / critical business periods

**Cost Consideration:**
```
Normal operation:  1 database
Stabilization:     2 databases (48-96 hours)
Annual cost:       ~5-10% increase (only during releases)

Cost vs Risk:      Worth it to avoid data loss
```

**For AGOG:** Use this pattern for:
- Major releases (v1.x.0 → v2.0.0)
- Database schema overhauls
- First production release
- High-risk periods (peak printing season)

#### Strategy 3: Database-Per-Tenant (AGOG FUTURE)

**For Multi-Tenant SaaS:**
```
Tenant A ──> Blue Database
Tenant B ──> Blue Database
Tenant C ──> Green Database (pilot)
Tenant D ──> Blue Database

Gradually migrate tenants to Green databases
```

**How It Works:**
1. Each tenant has own database (or schema)
2. Deploy Green with new schema for pilot tenants
3. Validate with pilot tenants
4. Gradually migrate more tenants
5. Rollback is per-tenant (easy!)

**Advantages:**
- ✅ Per-tenant rollback
- ✅ Gradual migration
- ✅ Isolated risk
- ✅ Easy to identify issues

**For AGOG:** Future consideration as scale grows

### Recommended Strategy for AGOG: Backward-Compatible Shared Database

**Why:**
1. ✅ Simpler infrastructure (single database)
2. ✅ Lower cost (no database duplication)
3. ✅ Proven pattern for SaaS applications
4. ✅ Aligns with PostgreSQL strengths
5. ✅ Works with existing migration strategy

**Requirements:**
1. All database migrations MUST be backward-compatible
2. Schema changes reviewed for compatibility
3. Application code handles both schemas gracefully
4. Rollback tested with every migration

### Backward-Compatible Migration Rules

#### ✅ Safe Operations (Blue-Green Compatible)

**Adding Columns:**
```sql
-- Add nullable column with default
ALTER TABLE jobs ADD COLUMN priority INT DEFAULT 5;

-- Blue (old): Ignores priority, uses default
-- Green (new): Sets priority explicitly
-- Rollback: ✓ Blue works fine
```

**Adding Tables:**
```sql
-- New table for new feature
CREATE TABLE job_templates (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    template_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blue (old): Never queries this table
-- Green (new): Uses new templates feature
-- Rollback: ✓ Blue unaffected
```

**Adding Indexes:**
```sql
-- Index for new query patterns
CREATE INDEX idx_jobs_status_created 
ON jobs(status, created_at);

-- Blue (old): Doesn't use index, still works
-- Green (new): Benefits from faster queries
-- Rollback: ✓ Blue unaffected
```

**Adding Constraints (Careful):**
```sql
-- Add check constraint that doesn't conflict
ALTER TABLE jobs 
ADD CONSTRAINT chk_quantity_positive 
CHECK (quantity > 0);

-- Only safe if Blue already enforces this in code!
-- Rollback: ✓ If Blue's data was already valid
```

#### ❌ Unsafe Operations (Break Blue-Green Rollback)

**Renaming Columns:**
```sql
-- ❌ BREAKS ROLLBACK
ALTER TABLE customers 
RENAME COLUMN email TO email_address;

-- Blue (old): SELECT email FROM customers -- ERROR!
-- Rollback: ✗ BROKEN
```

**Dropping Columns:**
```sql
-- ❌ BREAKS ROLLBACK
ALTER TABLE jobs 
DROP COLUMN legacy_field;

-- Blue (old): SELECT legacy_field FROM jobs -- ERROR!
-- Rollback: ✗ BROKEN
```

**Changing Column Types (Incompatible):**
```sql
-- ❌ BREAKS ROLLBACK
ALTER TABLE jobs 
ALTER COLUMN quantity TYPE VARCHAR(50);  -- was INT

-- Blue (old): Expects INT, gets VARCHAR
-- Rollback: ✗ BROKEN (or data corrupted)
```

**Adding NOT NULL to Existing Columns:**
```sql
-- ❌ BREAKS ROLLBACK (if existing NULLs)
ALTER TABLE jobs 
ALTER COLUMN customer_name SET NOT NULL;

-- Blue (old): Might insert NULL values
-- Green (new): Rejects NULLs
-- Rollback: ✗ Data conflicts
```

### Making Unsafe Changes Blue-Green Safe

**Multi-Step Migration Pattern:**

**Example: Renaming Column**
```sql
-- ❌ Want to rename: email → email_address
-- ✓ Do this instead:

-- Release 1: Add new column
ALTER TABLE customers ADD COLUMN email_address VARCHAR(255);
UPDATE customers SET email_address = email WHERE email_address IS NULL;

-- Application code in Green:
-- Write to BOTH columns, read from email_address

-- Release 2 (after Blue updated): Drop old column
-- ALTER TABLE customers DROP COLUMN email;
```

**Example: Changing Column Type**
```sql
-- ❌ Want to change: quantity INT → quantity DECIMAL(10,2)
-- ✓ Do this instead:

-- Release 1: Add new column
ALTER TABLE jobs ADD COLUMN quantity_decimal DECIMAL(10,2);
UPDATE jobs SET quantity_decimal = quantity WHERE quantity_decimal IS NULL;

-- Application code in Green:
-- Write to BOTH columns, read from quantity_decimal

-- Release 2: Drop old column
-- ALTER TABLE jobs DROP COLUMN quantity;
-- ALTER TABLE jobs RENAME COLUMN quantity_decimal TO quantity;
```

### Database Rollback Testing

**Test Every Migration:**
```bash
#!/bin/bash
# test-migration-rollback.sh

echo "Testing migration rollback compatibility..."

# 1. Apply migration to test database
psql -d test_db -f migrations/V1.3.0__add_preferences.sql

# 2. Run old version (Blue) against new schema
docker run agog:v1.2.0 npm run test:integration

# 3. Check for errors
if [ $? -eq 0 ]; then
    echo "✓ Rollback safe: v1.2.0 works with v1.3.0 schema"
else
    echo "✗ Rollback BROKEN: v1.2.0 fails with v1.3.0 schema"
    exit 1
fi
```

### Data Migration Strategy

**Problem:** Need to populate new columns with data from old columns

**Solution: Application-Level Migration (Preferred for Blue-Green)**
```typescript
// In Green application code
class JobService {
  async getJob(id: string): Promise<Job> {
    const job = await this.jobRepository.findById(id);
    
    // Handle missing data from new column
    if (!job.priority) {
      // Default for records created by Blue
      job.priority = this.calculateDefaultPriority(job);
    }
    
    return job;
  }
  
  async updateJob(id: string, data: Partial<Job>): Promise<Job> {
    // Green writes to new column
    return await this.jobRepository.update(id, {
      ...data,
      priority: data.priority ?? 5
    });
  }
}
```

**Alternative: Background Migration (After Cutover)**
```typescript
// Run after cutover to Green
async function backfillPriority() {
  const jobsWithoutPriority = await Job.find({
    priority: null
  });
  
  for (const job of jobsWithoutPriority) {
    job.priority = calculatePriority(job);
    await job.save();
  }
}

// Run gradually to avoid load spike
```

### Database Version Tracking

**Track which schema version each environment uses:**
```sql
-- Schema version table
CREATE TABLE schema_versions (
    version VARCHAR(50) PRIMARY KEY,
    environment VARCHAR(50) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_by VARCHAR(255)
);

-- Track deployments
INSERT INTO schema_versions (version, environment, applied_by)
VALUES ('v1.3.0', 'green', 'github-actions');
```

**Query before rollback:**
```sql
-- Check compatibility
SELECT 
    blue_version.version as blue_schema,
    green_version.version as green_schema,
    CASE 
        WHEN blue_version.version = green_version.version 
        THEN 'Safe to rollback'
        ELSE 'Review schema compatibility'
    END as rollback_status
FROM 
    (SELECT version FROM schema_versions 
     WHERE environment = 'blue' 
     ORDER BY applied_at DESC LIMIT 1) blue_version,
    (SELECT version FROM schema_versions 
     WHERE environment = 'green' 
     ORDER BY applied_at DESC LIMIT 1) green_version;
```

### Summary: Database Requirements for True Blue-Green

**Minimum Requirements:**
1. ✅ **Backward-compatible migrations** - Old code works with new schema
2. ✅ **Test rollback** - Verify old version runs against new schema
3. ✅ **No breaking changes** - No column renames/drops/type changes
4. ✅ **Nullable new columns** - Old code doesn't set new fields
5. ✅ **Application handles both** - Code works with old and new schema

**Advanced Options:**
- Parallel databases for complex migrations
- Per-tenant databases for gradual rollout
- Database versioning for compatibility tracking

**For AGOG:**
- Use backward-compatible shared database
- All migrations reviewed for compatibility
- Rollback tested in CI/CD pipeline
- Multi-step process for breaking changes

**Remember:** True Blue-Green means you can rollback to Blue at ANY TIME, including after database migrations. If your database changes break the old version, you DON'T have Blue-Green deployment - you have "Blue-Green-ish" deployment with fingers crossed.

## Multi-Tenant Considerations

### Tenant-by-Tenant Rollout (Advanced)
```
┌─────────────┐
│Load Balancer│ ── Tenant A, B, C ──> BLUE (v1.2.0)
└─────────────┘
              ── Tenant D (pilot) ──> GREEN (v1.3.0)
```

**Use for high-risk changes:**
1. Route one pilot tenant to Green
2. Monitor their experience
3. Gradually migrate more tenants
4. Full cutover when confident

**Configuration:**
```typescript
// Load balancer routing rules
if (tenant.id === 'pilot-tenant-uuid') {
  route_to: 'green'
} else {
  route_to: 'blue'
}
```

## Implementation Checklist

### Infrastructure Setup
- [ ] Two identical environments (Blue & Green)
- [ ] Load balancer with instant switching capability
- [ ] Shared or synced database infrastructure
- [ ] Monitoring and alerting for both environments
- [ ] Automated health check endpoints

### Pre-Deployment
- [ ] Code reviewed and approved
- [ ] Database migrations tested
- [ ] Backward compatibility verified
- [ ] Rollback plan documented
- [ ] Smoke test suite ready
- [ ] Team on standby

### Deployment to Green
- [ ] Deploy code to Green
- [ ] Run database migrations
- [ ] Start all services
- [ ] Warm up caches
- [ ] Run automated tests
- [ ] Verify health checks

### Validation
- [ ] Smoke tests pass
- [ ] Integration tests pass
- [ ] Performance acceptable
- [ ] Manual QA complete
- [ ] Stakeholder approval

### Cutover
- [ ] Switch load balancer to Green
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Check database performance
- [ ] Verify equipment connections
- [ ] Watch customer communications

### Post-Deployment
- [ ] Monitor for 1 hour minimum
- [ ] Document any issues
- [ ] Update Blue to match Green
- [ ] Update documentation
- [ ] Communicate success

## Rollback Procedure

### Instant Rollback (During Cutover)
```bash
# If issues detected within first hour
# Switch traffic back to Blue
./scripts/switch-to-blue.sh

# Investigation on Green continues
# No customer impact
```

**Triggers for Rollback:**
- Error rate spike (>1% increase)
- Response time degradation (>50% slower)
- Database connection issues
- Equipment integration failures
- Critical bug discovered
- Customer complaints

### Rollback Steps
1. **Immediate:** Switch load balancer to Blue
2. **Verify:** Blue serving traffic correctly
3. **Investigate:** Analyze Green environment logs
4. **Fix:** Resolve issues offline
5. **Redeploy:** Repeat process when ready

## Automation Scripts

### Traffic Switch Script
```bash
#!/bin/bash
# switch-to-green.sh

echo "Switching traffic to GREEN environment..."

# Update load balancer
az network lb rule update \
  --resource-group agog-prod \
  --lb-name agog-lb \
  --name http-rule \
  --backend-pool-name green-pool

# Verify
echo "Verifying traffic switch..."
curl https://api.agog.com/health | grep "environment: green"

echo "Traffic switch complete. Monitor closely!"
```

### Health Check Endpoint
```typescript
// src/controllers/HealthController.ts
export class HealthController {
  @Get('/health')
  async healthCheck(): Promise<HealthResponse> {
    return {
      status: 'healthy',
      environment: process.env.ENVIRONMENT, // 'blue' or 'green'
      version: process.env.APP_VERSION,
      database: await this.checkDatabase(),
      cache: await this.checkCache(),
      timestamp: new Date()
    };
  }
}
```

### Smoke Test Suite
```typescript
// tests/smoke/production-smoke.test.ts
describe('Production Smoke Tests', () => {
  test('API responds', async () => {
    const response = await fetch('/api/health');
    expect(response.status).toBe(200);
  });

  test('Database connectivity', async () => {
    const jobs = await Job.findAll({ limit: 1 });
    expect(jobs).toBeDefined();
  });

  test('Equipment integration', async () => {
    const status = await EquipmentService.getStatus();
    expect(status.connected).toBe(true);
  });

  test('Authentication works', async () => {
    const token = await auth.login(testUser);
    expect(token).toBeDefined();
  });
});
```

## Monitoring During Deployment

### Key Metrics to Watch
```
┌─────────────────────────────────────────────┐
│            Deployment Dashboard             │
├─────────────────────────────────────────────┤
│ Error Rate:           0.2% → 0.3%  ✓       │
│ Avg Response Time:    120ms → 135ms ✓      │
│ Requests/sec:         450 → 455     ✓      │
│ Database Connections: 45 → 48       ✓      │
│ Cache Hit Rate:       94% → 93%     ✓      │
│ Equipment Connected:  23/23         ✓      │
└─────────────────────────────────────────────┘
```

### Alert Thresholds
| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | >0.5% | >1.0% | Investigate / Rollback |
| Response Time | >200ms | >500ms | Check performance / Rollback |
| Database CPU | >70% | >85% | Scale / Rollback |
| Failed Logins | >10/min | >50/min | Security check |

## Best Practices

### 1. Always Have a Rollback Plan
Never deploy without ability to switch back instantly.

### 2. Automate Everything
- Deployment scripts
- Health checks
- Traffic switching
- Monitoring alerts

### 3. Test in Production-Like Environment
Green should be identical to Blue in:
- Infrastructure specs
- Network configuration
- Database size and load
- External integrations

### 4. Gradual Rollouts for Major Changes
Use canary deployments (1% → 5% → 25% → 100%)

### 5. Keep Both Environments in Sync
After successful deployment, update Blue to match Green

### 6. Database Migrations Must Be Backward Compatible
New version works with old schema (for safe rollback)

### 7. Monitor Longer for Major Releases
- Minor updates: Monitor 30 minutes
- Major releases: Monitor 2-4 hours
- Breaking changes: Monitor 24 hours

### 8. Communicate with Stakeholders
- Pre-deployment notification
- During deployment status
- Post-deployment confirmation

## Common Pitfalls

### ❌ Forgetting to Warm Up Green
**Problem:** First requests to Green are slow (cold start)

**Solution:** Pre-warm caches, run test traffic before cutover

### ❌ Database Schema Incompatibility
**Problem:** New schema breaks old code (rollback fails)

**Solution:** Always use backward-compatible migrations

### ❌ Not Testing Rollback
**Problem:** Assume Blue still works, but it doesn't

**Solution:** Periodically test switching back to Blue

### ❌ Switching Too Quickly
**Problem:** Don't give Green enough validation time

**Solution:** Follow validation checklist completely

### ❌ Not Monitoring After Cutover
**Problem:** Issues appear after initial switch

**Solution:** Monitor for at least 1 hour, preferably longer

## AGOG-Specific Considerations

### Equipment Integration
**Challenge:** Equipment connected to old environment

**Solution:**
- Use DNS-based routing (equipment follows DNS changes)
- Or: Gradually migrate equipment connections
- Test equipment connectivity before full cutover

### Long-Running Jobs
**Challenge:** Print jobs in progress during cutover

**Solution:**
- Jobs stay on Blue until completion
- New jobs route to Green
- Wait for Blue jobs to finish before decommissioning

### Real-Time Dashboards
**Challenge:** Users might see data inconsistency during cutover

**Solution:**
- WebSocket reconnection handling
- Graceful connection migration
- Brief "reconnecting" message

### Financial Transactions
**Challenge:** Orders/payments in flight during switch

**Solution:**
- Use idempotent APIs (safe to retry)
- Transaction state tracking
- Ensure database consistency

## Tools & Infrastructure

### Required Tools
- **Load Balancer:** Azure Load Balancer / AWS ALB / NGINX
- **Container Orchestration:** Kubernetes / Docker Swarm / Azure Container Apps
- **Database:** PostgreSQL with replication
- **Monitoring:** Application Insights / Datadog / New Relic
- **CI/CD:** GitHub Actions / Azure DevOps

### Infrastructure as Code
```yaml
# infrastructure/environments.yaml
blue:
  environment: production-blue
  app_version: ${CURRENT_VERSION}
  instance_count: 3
  database: agog-prod-db

green:
  environment: production-green
  app_version: ${NEW_VERSION}
  instance_count: 3
  database: agog-prod-db
```

## Summary

Blue-Green deployment gives AGOG:
- ✅ Zero downtime for customers
- ✅ Safe, tested deployments
- ✅ Instant rollback capability
- ✅ Confidence in releases
- ✅ Production validation before full cutover

**Core Principle:** Never put customers at risk. Always have a way back.

## Related Documentation
- [Deployment Process](../../Project%20Architecture/deployment-process.md) - Overall deployment strategy
- [Database Standards](../data/database-standards.md) - Migration best practices
- [Testing Standards](../testing/README.md) - Smoke test requirements

## Resources for Learning More
- [Martin Fowler - Blue-Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [AWS Blue-Green Deployments](https://docs.aws.amazon.com/whitepapers/latest/blue-green-deployments/welcome.html)
- [Azure Deployment Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/deployment-stamp)

---

[⬆ Back to top](#blue-green-deployment-strategy) | [🏠 AGOG Home](../../README.md) | [📚 Standards](../README.md) | [💻 Code Standards](./README.md)
