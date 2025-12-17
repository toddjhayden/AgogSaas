# Rollback Procedures

Emergency procedures for rolling back failed deployments in AgogSaaS.

## Table of Contents

1. [When to Rollback](#when-to-rollback)
2. [Quick Rollback Commands](#quick-rollback-commands)
3. [Staging Rollback](#staging-rollback)
4. [Production Rollback](#production-rollback)
5. [Database Rollback](#database-rollback)
6. [Post-Rollback Actions](#post-rollback-actions)

## When to Rollback

Rollback immediately if you observe:

🚨 **Critical Issues** (Rollback NOW):
- Application is completely down
- Data corruption or loss
- Security breach detected
- Critical functionality broken
- Database connection failures
- Error rate > 10%

⚠️ **Major Issues** (Rollback if not fixed in 15 min):
- Performance degradation > 50%
- Error rate > 5%
- Memory leaks causing crashes
- External integration failures
- User-reported critical bugs

ℹ️ **Minor Issues** (Monitor, consider rollback):
- Small performance degradation
- Non-critical bugs
- UI issues
- Logging errors

## Quick Rollback Commands

### Production Blue-Green Switch

If Blue is broken, switch back to Green:

```bash
# SSH to production server
ssh production-server

# Switch traffic back to Green
cd /opt/agogsaas
./deployment/scripts/switch-blue-green.sh green
```

If Green is broken, switch to Blue:

```bash
./deployment/scripts/switch-blue-green.sh blue
```

**Result**: Traffic switches in ~1 minute, zero downtime

### Staging Rollback

```bash
# SSH to staging server
ssh staging-server

cd /opt/agogsaas

# Stop current deployment
docker-compose down

# Restore from latest backup
LATEST_BACKUP=$(ls -t /opt/agogsaas-backups | head -1)
cp /opt/agogsaas-backups/$LATEST_BACKUP/docker-compose.yml.backup docker-compose.yml
cp /opt/agogsaas-backups/$LATEST_BACKUP/.env.backup .env

# Start previous version
docker-compose up -d
```

**Result**: Previous version running in ~3 minutes

## Staging Rollback

Detailed steps for rolling back staging deployments.

### Step 1: Identify the Issue

Check logs to confirm the problem:

```bash
# SSH to staging
ssh staging-server
cd /opt/agogsaas

# Check backend logs
docker-compose logs --tail=100 backend | grep ERROR

# Check application health
curl http://localhost:4001/health

# Check database
docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "SELECT 1;"
```

### Step 2: Stop Current Deployment

```bash
# Stop all services
docker-compose down

# Verify stopped
docker ps | grep agogsaas
```

### Step 3: Restore from Backup

```bash
# List available backups
ls -lh /opt/agogsaas-backups/

# Choose backup (usually latest)
BACKUP_DIR=$(ls -t /opt/agogsaas-backups | head -1)
echo "Restoring from: $BACKUP_DIR"

# Restore configuration
cp "/opt/agogsaas-backups/$BACKUP_DIR/docker-compose.yml.backup" docker-compose.yml
cp "/opt/agogsaas-backups/$BACKUP_DIR/.env.backup" .env

# Restore database if needed
if [ -f "/opt/agogsaas-backups/$BACKUP_DIR/database_backup.sql" ]; then
    echo "Restoring database..."

    # Start postgres
    docker-compose up -d postgres
    sleep 10

    # Restore database
    docker exec -i agogsaas-postgres psql -U agogsaas_user -d agogsaas < \
        "/opt/agogsaas-backups/$BACKUP_DIR/database_backup.sql"
fi
```

### Step 4: Start Previous Version

```bash
# Start all services
docker-compose up -d

# Wait for services to start
sleep 30

# Check health
curl http://localhost:4001/health
```

### Step 5: Verify Rollback

```bash
# Test backend
curl http://localhost:4001/health

# Test GraphQL
curl -X POST http://localhost:4001/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"{ __typename }"}'

# Test frontend
curl http://localhost:3000 | grep "AgogSaaS"

# Check logs for errors
docker-compose logs --tail=50 backend
```

**Staging Rollback Time**: ~5 minutes

## Production Rollback

Detailed steps for rolling back production deployments.

### Production Rollback Strategy

AgogSaaS uses **Blue-Green deployment**, making rollback simple:

```
Current State:        After Rollback:
┌─────────┐           ┌─────────┐
│  BLUE   │ ← Active  │  BLUE   │
│ (broken)│           │ (broken)│
└─────────┘           └─────────┘

┌─────────┐           ┌─────────┐
│  GREEN  │ ← Standby │  GREEN  │ ← Active
│ (good)  │           │ (good)  │
└─────────┘           └─────────┘
```

### Step 1: Assess Situation

**Before rolling back, quickly assess**:

1. What's broken?
2. Is it affecting all users?
3. Can it be hotfixed quickly? (<15 min)
4. Is data at risk?

**Decision Tree**:
- Data at risk? → **Immediate rollback**
- App completely down? → **Immediate rollback**
- Quick fix possible? → **Try fix first, rollback if fails**
- Minor issue? → **Monitor, don't rollback yet**

### Step 2: Announce Rollback

**Notify team immediately**:

```
🚨 PRODUCTION ROLLBACK IN PROGRESS

Reason: [Brief description]
Current Environment: Blue (broken)
Rolling back to: Green
ETA: 2 minutes
Initiator: @username
```

### Step 3: Execute Blue-Green Switch

**Option A: Automated (Recommended)**

```bash
# SSH to production
ssh production-server

# Switch traffic
cd /opt/agogsaas
./deployment/scripts/switch-blue-green.sh green
```

The script will:
1. Run health checks on Green
2. Update nginx configuration
3. Reload nginx (no downtime)
4. Verify traffic switched
5. Monitor for issues

**Option B: Manual nginx Update**

If script fails, manual fallback:

```bash
# Backup current nginx config
cp /etc/nginx/sites-available/agogsaas /etc/nginx/sites-available/agogsaas.backup

# Edit nginx config
sudo nano /etc/nginx/sites-available/agogsaas

# Change upstream from blue to green:
upstream backend {
    server localhost:4002;  # Green backend port
}

upstream frontend {
    server localhost:3002;  # Green frontend port
}

# Test configuration
sudo nginx -t

# Reload nginx (zero downtime)
sudo nginx -s reload
```

### Step 4: Verify Rollback

**Immediately after rollback**:

```bash
# Test production URL
curl https://agogsaas.com/health

# Check which environment is active
curl -I https://agogsaas.com

# Test critical endpoints
curl -X POST https://agogsaas.com/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"{ __typename }"}'

# Monitor error rates
# Check monitoring dashboard
```

**Production Rollback Time**: 1-2 minutes (zero downtime)

### Step 5: Monitor Rolled-Back System

Monitor for 30 minutes after rollback:

- ✅ Error rates back to normal?
- ✅ Response times acceptable?
- ✅ User reports stopped?
- ✅ Critical flows working?

## Database Rollback

Rolling back database changes is more complex.

### Scenario 1: Reversible Migrations

If migrations are reversible:

```bash
# SSH to production
ssh production-server

# Connect to database
docker exec -it agogsaas-postgres psql -U agogsaas_user -d agogsaas

-- Check current migration version
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;

-- Run down migration
-- (depends on your migration tool)
```

### Scenario 2: Data-Only Changes

If deployment only changed data, not schema:

```bash
# Restore from backup
BACKUP_FILE="/opt/agogsaas-backups/[timestamp]/database_backup.sql.gz"

# Stop application
docker-compose stop backend

# Restore database
gunzip -c $BACKUP_FILE | docker exec -i agogsaas-postgres \
    psql -U agogsaas_user -d agogsaas

# Restart application
docker-compose start backend
```

### Scenario 3: Schema Changes (Complex)

For complex schema changes:

1. **Do NOT rollback database** if:
   - New schema is backward compatible
   - Old code can run with new schema
   - Data integrity is maintained

2. **Rollback application only**:
   - Switch to previous environment (Blue-Green)
   - Old code should work with new schema
   - Plan forward-fix for next deployment

3. **Full database rollback** (last resort):
   - Requires downtime
   - Follow emergency database restore procedure
   - Only if data corruption or critical issues

### Emergency Database Restore

**WARNING: This causes downtime!**

```bash
# 1. Put application in maintenance mode
docker-compose stop backend frontend

# 2. Backup current state (in case rollback fails)
docker exec agogsaas-postgres pg_dump -U agogsaas_user agogsaas | \
    gzip > /tmp/pre-rollback-backup.sql.gz

# 3. Restore from backup
BACKUP_FILE="/opt/agogsaas-backups/[timestamp]/database_backup.sql.gz"
gunzip -c $BACKUP_FILE | docker exec -i agogsaas-postgres \
    psql -U agogsaas_user -d agogsaas

# 4. Verify database integrity
docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "
    SELECT COUNT(*) FROM monitoring_events;
    SELECT COUNT(*) FROM monitoring_tasks;
"

# 5. Restart application
docker-compose up -d backend frontend

# 6. Test application
curl http://localhost:4001/health
```

**Database Rollback Time**: 5-30 minutes (depends on database size)

## Rollback Decision Matrix

| Issue | Severity | Action | Max Time to Decide |
|-------|----------|--------|-------------------|
| App completely down | Critical | Rollback NOW | 0 min |
| Data corruption | Critical | Rollback NOW | 0 min |
| Security breach | Critical | Rollback NOW | 0 min |
| Error rate > 10% | Critical | Rollback NOW | 5 min |
| Performance -50% | Major | Rollback if not fixed | 15 min |
| Error rate 5-10% | Major | Rollback if not fixed | 15 min |
| Critical feature broken | Major | Rollback or disable | 15 min |
| Performance -25% | Minor | Monitor, fix forward | 30 min |
| Non-critical bug | Minor | Fix forward | Next release |

## Post-Rollback Actions

After successful rollback:

### Immediate (Within 1 hour)

1. **Send notification**:
   ```
   ✅ Rollback Complete

   Previous: Blue (v1.2.3)
   Current: Green (v1.2.2)
   Reason: [description]
   Status: System stable
   ```

2. **Update status page** (if you have one)

3. **Monitor for 1 hour** to ensure stability

4. **Preserve logs** from failed deployment:
   ```bash
   # Save logs for analysis
   docker-compose logs > /tmp/failed-deployment-logs.txt
   ```

### Short-term (Within 24 hours)

1. **Root cause analysis**:
   - What went wrong?
   - Why wasn't it caught in testing?
   - What can prevent this?

2. **Create fix**:
   - Address root cause
   - Add tests for the bug
   - Test thoroughly in staging

3. **Update monitoring**:
   - Add alerting for this issue
   - Improve health checks if needed

4. **Document incident**:
   - What happened
   - How it was fixed
   - Lessons learned

### Long-term (Within 1 week)

1. **Improve CI/CD**:
   - Add tests that would catch this
   - Enhance smoke tests
   - Update deployment procedures

2. **Team review**:
   - Review incident with team
   - Update runbooks
   - Share learnings

3. **Plan re-deployment**:
   - Fix the issue
   - Test extensively
   - Schedule new deployment

## Testing Rollback Procedures

**Test rollback procedures quarterly**:

1. Schedule test rollback
2. Deploy to staging
3. Intentionally "break" something
4. Practice rollback
5. Time the procedure
6. Update documentation

## Rollback Prevention

Best practices to avoid needing rollbacks:

✅ **Before Deployment**:
- Comprehensive testing in staging
- Load testing for performance changes
- Database migration testing
- Feature flags for large changes

✅ **During Deployment**:
- Deploy during low-traffic windows
- Monitor metrics closely
- Have team on standby
- Use blue-green for zero-downtime

✅ **After Deployment**:
- Monitor for 1 hour minimum
- Run smoke tests
- Check error rates
- Test critical flows

## Emergency Contacts

For rollback assistance:

- **On-Call Engineer**: [PagerDuty]
- **DevOps Lead**: [Contact]
- **Database Admin**: [Contact]
- **CTO**: [Contact] (for major incidents only)

## Additional Resources

- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)
- [CI/CD Pipeline](./CI_CD_PIPELINE.md)
- [Troubleshooting Guide](./GITHUB_ACTIONS_TROUBLESHOOTING.md)

---

Last Updated: 2025-12-17
