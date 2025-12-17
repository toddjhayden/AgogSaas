# Deployment Runbook

Step-by-step guide for deploying AgogSaaS to staging and production environments.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Staging Deployment](#staging-deployment)
3. [Production Deployment](#production-deployment)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Rollback Procedures](#rollback-procedures)

## Pre-Deployment Checklist

Before deploying, ensure:

- [ ] All tests pass locally
- [ ] CI pipeline is green
- [ ] Security scans show no critical issues
- [ ] Database migrations are tested
- [ ] Breaking changes are documented
- [ ] Team is notified of deployment
- [ ] Rollback plan is ready
- [ ] Deployment window is scheduled (for production)

## Staging Deployment

### Automatic Deployment

Staging deploys automatically when you merge to `develop` branch.

**Steps**:

1. **Create PR to develop**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature
   # Make your changes
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature
   ```

2. **Open PR on GitHub**:
   - Navigate to your repository
   - Click "New Pull Request"
   - Base: `develop`, Compare: `feature/your-feature`
   - Wait for CI checks to pass

3. **Get Approval and Merge**:
   - Request review from team member
   - Address any feedback
   - Merge PR

4. **Automatic Deployment Starts**:
   - GitHub Actions automatically triggers `deploy-staging.yml`
   - Monitor progress: Actions > Deploy to Staging

**Timeline**: ~15 minutes from merge to deployed

### Manual Staging Deployment

If you need to manually trigger staging deployment:

1. Go to **Actions > Deploy to Staging**
2. Click **Run workflow**
3. Select branch: `develop`
4. Click **Run workflow**

### Monitor Staging Deployment

Watch the workflow progress:

1. **Build and Push Images** (~5 min)
   - Backend image building
   - Frontend image building
   - Push to ghcr.io

2. **Deploy** (~3 min)
   - SSH to staging server
   - Pull new images
   - Update docker-compose
   - Restart services

3. **Run Migrations** (~1 min)
   - Database schema updates
   - Data migrations

4. **Integration Tests** (~5 min)
   - API tests
   - Smoke tests
   - Performance tests

### Verify Staging

After deployment completes:

```bash
# Check staging health
curl https://staging.agogsaas.com/health

# Test GraphQL endpoint
curl -X POST https://staging.agogsaas.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# Check frontend
curl https://staging.agogsaas.com | grep "AgogSaaS"
```

## Production Deployment

Production deployments use **Blue-Green strategy** for zero downtime.

### Step 1: Prepare for Deployment

**1.1 Determine Active Environment**

Check which environment is currently active:
- Blue: ports 4001 (backend), 3001 (frontend)
- Green: ports 4002 (backend), 3002 (frontend)

**1.2 Choose Target Environment**

Deploy to the INACTIVE environment:
- If Green is active → Deploy to Blue
- If Blue is active → Deploy to Green

**1.3 Notify Team**

Send notification to team:
```
🚀 Production Deployment Starting

Environment: Blue
Version: v1.2.3
ETA: 30 minutes
Deployer: @username
```

### Step 2: Trigger Deployment

**Option A: Tag-Based Deployment (Recommended)**

```bash
# On master branch
git checkout master
git pull origin master

# Create release tag
git tag -a v1.2.3 -m "Release v1.2.3: Feature XYZ"
git push origin v1.2.3
```

This automatically triggers production deployment.

**Option B: Manual Workflow Dispatch**

1. Go to **Actions > Deploy to Production**
2. Click **Run workflow**
3. Select inputs:
   - **Branch**: `master`
   - **Environment**: `blue` or `green`
   - **Skip smoke tests**: `false`
4. Click **Run workflow**

### Step 3: Monitor Deployment

Watch the workflow execution:

**3.1 Pre-Deployment Validation** (~2 min)
- Validates deployment conditions
- Checks for breaking changes

**3.2 Build Production Images** (~5 min)
- Builds optimized production images
- Tags with version and SHA
- Pushes to ghcr.io

**3.3 Deploy to Environment** (~5 min)
- SSH to production server
- Pulls new images
- Stops old containers
- Starts new containers
- Runs health checks

**3.4 Run Smoke Tests** (~5 min)
- Tests critical functionality
- Verifies API endpoints
- Checks database connectivity
- Tests external integrations

### Step 4: Review and Approve

**4.1 Approval Gate** ⏸️

GitHub will pause and request approval. Review:

✅ **Check Smoke Test Results**:
- All tests passed?
- Any errors in logs?

✅ **Check Application Logs**:
```bash
# SSH to production server
ssh production-server

# View logs
cd /opt/agogsaas/blue  # or green
docker-compose logs -f backend
```

✅ **Manual Testing**:
- Test critical user flows
- Verify database queries
- Check external integrations

✅ **Metrics Check**:
- Response times normal?
- No error spikes?
- Resource usage OK?

**4.2 Approve or Reject**

In GitHub Actions:
- ✅ **Approve**: If everything looks good
- ❌ **Reject**: If issues found (triggers rollback)

### Step 5: Traffic Switch

After approval, the workflow will:

**5.1 Switch Traffic** (~1 min)
- Updates nginx configuration
- Routes production traffic to new environment
- Zero downtime cutover

**5.2 Monitor Production** (5 min)
- Runs health checks every 10 seconds
- Monitors error rates
- Checks response times
- **Auto-rollback if issues detected**

**5.3 Final Verification**

```bash
# Test production URL
curl https://agogsaas.com/health

# Check which environment is active
curl -I https://agogsaas.com | grep "X-Environment"
```

### Step 6: Post-Deployment

**6.1 Monitor for 1 Hour**

Watch for:
- Error rate increases
- Response time degradation
- Database performance issues
- User-reported issues

**6.2 Update Documentation**

- Update CHANGELOG.md
- Document any configuration changes
- Update API documentation if needed

**6.3 Notify Team**

Send completion notification:
```
✅ Production Deployment Complete

Environment: Blue → Active
Previous: Green → Standby
Version: v1.2.3
Deployer: @username

Rollback Command:
./deployment/scripts/switch-blue-green.sh green
```

## Post-Deployment Verification

### Automated Checks

The workflow runs these automatically:

✅ Backend health endpoint
✅ Frontend accessibility
✅ GraphQL endpoint
✅ Database connectivity
✅ NATS connectivity

### Manual Verification

Perform these checks manually:

**Test Critical User Flows**:
- [ ] User login
- [ ] Create order
- [ ] View dashboard
- [ ] Run report
- [ ] External API integration

**Check Monitoring Dashboards**:
- [ ] Application metrics
- [ ] Database performance
- [ ] Error rates
- [ ] Response times

**Review Logs**:
```bash
# Backend logs
docker-compose logs -f backend | grep ERROR

# Frontend logs
docker-compose logs -f frontend | grep ERROR

# Database logs
docker-compose logs -f postgres | grep ERROR
```

**Database Verification**:
```bash
# Check migrations applied
docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 5;"

# Check database size
docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "
SELECT pg_size_pretty(pg_database_size('agogsaas'));"
```

## Common Deployment Scenarios

### Scenario 1: Hotfix Deployment

For urgent production fixes:

1. Create hotfix branch from master:
   ```bash
   git checkout master
   git pull origin master
   git checkout -b hotfix/critical-bug-fix
   ```

2. Make fix and test locally

3. Create PR to master (skip staging)

4. Get emergency approval

5. Merge and deploy immediately

6. Monitor closely for 2 hours

### Scenario 2: Database Migration Deployment

For deployments with database changes:

1. **Test migration in staging first**

2. **Backup production database**:
   ```bash
   ssh production-server
   docker exec agogsaas-postgres pg_dump -U agogsaas_user agogsaas | gzip > backup.sql.gz
   ```

3. **Deploy during low-traffic window**

4. **Monitor migration progress**:
   ```bash
   docker-compose logs -f backend | grep "Migration"
   ```

5. **Verify data integrity** after migration

### Scenario 3: Feature Flag Deployment

For large features behind feature flags:

1. Deploy code with feature OFF

2. Verify deployment successful

3. Enable feature for internal users

4. Monitor for issues

5. Gradually roll out to all users

6. Remove feature flag in next deployment

## Rollback Procedures

If issues are detected after deployment:

**See [Rollback Procedures](./ROLLBACK_PROCEDURES.md) for detailed steps**

Quick rollback:
```bash
# Switch back to previous environment
./deployment/scripts/switch-blue-green.sh green  # if blue is broken
```

## Deployment Windows

### Recommended Deployment Times

**Staging**: Anytime during business hours

**Production**:
- ✅ **Best**: Tuesday-Thursday, 10 AM - 2 PM
- ⚠️ **OK**: Monday, 10 AM - 2 PM
- ❌ **Avoid**: Friday, weekends, late nights, holidays

### Blackout Periods

**Never deploy during**:
- Major sales events
- End of month/quarter
- Known high-traffic periods
- Holidays
- After 4 PM on Friday

## Troubleshooting

### Deployment Fails at Build Stage

**Symptoms**: Docker build fails

**Solutions**:
- Check Dockerfile syntax
- Verify all dependencies in package.json
- Check for missing environment variables
- Review build logs

### Deployment Fails at Health Check

**Symptoms**: Health checks timeout

**Solutions**:
- Check application logs: `docker-compose logs backend`
- Verify database connectivity
- Check NATS connection
- Increase health check timeout

### Smoke Tests Fail

**Symptoms**: Tests fail after deployment

**Solutions**:
- Review test logs
- Check for environment-specific issues
- Verify external service connectivity
- Check for data migration issues

## Emergency Contacts

For deployment emergencies:

- **DevOps Lead**: [Contact]
- **Backend Lead**: [Contact]
- **Database Admin**: [Contact]
- **On-Call Engineer**: [PagerDuty]

## Additional Resources

- [CI/CD Pipeline](./CI_CD_PIPELINE.md)
- [Rollback Procedures](./ROLLBACK_PROCEDURES.md)
- [Troubleshooting Guide](./GITHUB_ACTIONS_TROUBLESHOOTING.md)
- [GitHub Setup](./GITHUB_SETUP.md)

---

Last Updated: 2025-12-17
