# CI/CD Pipeline Architecture

Complete documentation for the AgogSaaS CI/CD pipeline architecture and workflows.

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Workflows](#pipeline-workflows)
3. [Workflow Triggers](#workflow-triggers)
4. [Pipeline Stages](#pipeline-stages)
5. [Blue-Green Deployment Strategy](#blue-green-deployment-strategy)
6. [Security and Compliance](#security-and-compliance)
7. [Monitoring and Metrics](#monitoring-and-metrics)

## Overview

The AgogSaaS CI/CD pipeline is built on GitHub Actions and implements:

- **Continuous Integration**: Automated testing on every push/PR
- **Continuous Deployment**: Auto-deploy to staging, manual approve to production
- **Blue-Green Deployments**: Zero-downtime production deployments
- **Security Scanning**: Automated vulnerability and secret detection
- **Performance Testing**: Weekly load and stress testing

### Pipeline Philosophy

- **Security First**: Multiple layers of security scanning
- **Test Coverage**: Comprehensive testing before deployment
- **Zero Downtime**: Blue-green strategy for production
- **Quick Rollback**: Automated backup and restore capabilities
- **Full Transparency**: Detailed logs and notifications

## Pipeline Workflows

### 1. **ci.yml** - Continuous Integration

**Trigger**: Push to any branch, PR to master/develop

**Purpose**: Validate code quality and functionality

**Jobs**:
1. Security checks (secrets detection)
2. Linting (ESLint)
3. Type checking (TypeScript)
4. Unit tests (Jest/Vitest)
5. Docker build verification
6. Smoke tests

**Duration**: ~8-12 minutes

**Pass Criteria**: All jobs must succeed

### 2. **deploy-staging.yml** - Staging Deployment

**Trigger**: Push to `develop` branch

**Purpose**: Auto-deploy to staging for testing

**Jobs**:
1. Build and push Docker images
2. Deploy to staging server
3. Run database migrations
4. Verify deployment health
5. Run integration tests
6. Send notification

**Duration**: ~10-15 minutes

**Rollback**: Automatic on failure

### 3. **deploy-production.yml** - Production Deployment

**Trigger**: Manual dispatch OR tag push (v*.*.*)

**Purpose**: Deploy to production with blue-green strategy

**Jobs**:
1. Pre-deployment validation
2. Build production images
3. Deploy to blue/green environment
4. Run smoke tests
5. **Manual approval gate** ⏸️
6. Switch production traffic
7. Monitor for 5 minutes
8. Send notification

**Duration**: ~20-30 minutes (excluding approval wait)

**Rollback**: Manual trigger or automatic on health failure

### 4. **security-scan.yml** - Security Scanning

**Trigger**: Push to master/develop, PR, daily at 2 AM UTC

**Purpose**: Comprehensive security analysis

**Jobs**:
1. NPM audit (dependency vulnerabilities)
2. OWASP dependency check
3. Secret detection (gitleaks)
4. Container image scan (Trivy)
5. Static code analysis (ESLint security rules)
6. License compliance check

**Duration**: ~15-20 minutes

**Notifications**: PR comment with results

### 5. **performance-test.yml** - Performance Testing

**Trigger**: Weekly (Monday 3 AM UTC), manual dispatch

**Purpose**: Validate performance under load

**Jobs**:
1. Load testing (k6) - 50 concurrent users
2. Stress testing (k6) - ramp up to 300 users
3. Database performance queries
4. Frontend performance (Lighthouse)

**Duration**: ~15-30 minutes

**Pass Criteria**: Response time < 500ms (p95), error rate < 5%

### 6. **docker-build-push.yml** - Reusable Docker Workflow

**Trigger**: Called by other workflows

**Purpose**: Build and push Docker images to GHCR

**Features**:
- Multi-stage builds
- Layer caching for speed
- SBOM generation
- Image signing (optional)
- Size optimization

## Workflow Triggers

### Automatic Triggers

| Event | Workflows Triggered |
|-------|---------------------|
| Push to `master` | `ci.yml`, `security-scan.yml` |
| Push to `develop` | `ci.yml`, `deploy-staging.yml`, `security-scan.yml` |
| Push to feature branch | `ci.yml` |
| Pull Request | `ci.yml`, `security-scan.yml` |
| Tag `v*.*.*` | `deploy-production.yml` |
| Schedule (daily 2 AM) | `security-scan.yml` |
| Schedule (weekly Mon 3 AM) | `performance-test.yml` |

### Manual Triggers

All workflows support manual dispatch via GitHub Actions UI:

```
Actions > [Workflow Name] > Run workflow
```

## Pipeline Stages

### Stage 1: Code Validation (Layer 1)

**Pre-commit Hooks** (Local)
- Secret detection
- Linting
- Type checking
- Unit tests

**CI Pipeline** (GitHub Actions)
- Same checks as pre-commit
- Plus integration tests
- Plus smoke tests

### Stage 2: Build & Package

**Docker Image Build**
- Multi-stage builds for optimization
- Backend: Node.js 20 + TypeScript
- Frontend: Vite + React
- Tagged with: branch name, SHA, semver
- Pushed to: ghcr.io

**Artifacts**
- Docker images
- Build logs
- Test coverage reports
- SBOM (Software Bill of Materials)

### Stage 3: Deployment

**Staging** (Automatic)
- Triggered by push to `develop`
- Deploys to staging server
- Runs migrations
- Runs integration tests
- No approval required

**Production** (Manual Approval)
- Triggered manually or by tag
- Deploys to blue or green environment
- **Requires manual approval before traffic switch**
- Runs comprehensive smoke tests
- Monitors for issues

### Stage 4: Verification

**Health Checks**
- Backend health endpoint
- Frontend accessibility
- GraphQL endpoint
- Database connectivity
- NATS connectivity

**Smoke Tests**
- Critical user flows
- API endpoints
- Database queries
- External integrations

**Performance Monitoring**
- Response times
- Error rates
- Resource usage
- Database performance

## Blue-Green Deployment Strategy

### Environments

```
┌─────────────────────────────────────────┐
│           Production Traffic             │
│         (nginx load balancer)            │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
   ┌───▼────┐      ┌────▼───┐
   │  BLUE  │      │ GREEN  │
   │ (port  │      │ (port  │
   │ 4001)  │      │ 4002)  │
   └────────┘      └────────┘
```

### Deployment Flow

1. **Deploy to Inactive Environment**
   - If Green is active, deploy to Blue
   - If Blue is active, deploy to Green
   - Other environment remains serving traffic

2. **Run Smoke Tests**
   - Test all critical functionality
   - Verify database connectivity
   - Check external integrations

3. **Manual Approval**
   - Review smoke test results
   - Check application logs
   - Verify no errors

4. **Switch Traffic**
   - Update nginx configuration
   - Route production traffic to new environment
   - Monitor for issues

5. **Monitor**
   - Watch error rates
   - Check response times
   - Monitor resource usage
   - Keep for 24 hours

6. **Rollback (if needed)**
   - Switch traffic back to previous environment
   - Zero downtime
   - Immediate recovery

### Advantages

- ✅ **Zero downtime**: Traffic switches instantly
- ✅ **Easy rollback**: Switch back to previous environment
- ✅ **Test in production-like**: Inactive environment is identical
- ✅ **No data loss**: Database shared or replicated
- ✅ **Confidence**: Full testing before traffic switch

## Security and Compliance

### Security Layers

**Layer 1: Pre-commit**
- Local secret scanning
- Lint security rules

**Layer 2: CI Pipeline**
- Secret detection (gitleaks)
- Dependency scanning (npm audit)
- OWASP dependency check

**Layer 3: Container Scanning**
- Trivy vulnerability scanning
- Image analysis
- SBOM generation

**Layer 4: Runtime**
- Health monitoring
- Security alerts
- Audit logs

### Compliance Checks

- ✅ No secrets in code
- ✅ All dependencies scanned
- ✅ Container vulnerabilities checked
- ✅ License compliance verified
- ✅ SARIF reports uploaded to GitHub Security

## Monitoring and Metrics

### CI/CD Metrics

**Tracked Automatically**:
- Build success rate
- Average build time
- Deployment frequency
- Lead time for changes
- Mean time to recovery (MTTR)
- Change failure rate

**Available in**:
- GitHub Actions insights
- Workflow run history
- Pull request comments

### Deployment Tracking

Each deployment records:
- Git commit SHA
- Docker image tags
- Deployment timestamp
- Approver name
- Environment deployed to
- Health check results

### Notifications

**Slack Notifications** (if configured):
- ✅ Deployment success
- ❌ Deployment failure
- ⏸️ Approval required
- 🔄 Traffic switched

**GitHub Notifications**:
- PR comments with test results
- Security scan summaries
- Deployment status updates

## Workflow Dependencies

```
ci.yml (on PR/push)
    ↓
[All checks pass]
    ↓
Merge to develop
    ↓
deploy-staging.yml (automatic)
    ↓
[Staging tests pass]
    ↓
Merge to master (via PR)
    ↓
deploy-production.yml (manual trigger)
    ↓
[Deploy to blue/green]
    ↓
[Smoke tests pass]
    ↓
[Manual approval] ⏸️
    ↓
[Switch traffic]
    ↓
[Monitor for issues]
```

## Best Practices

### For Developers

1. **Always run pre-commit hooks** before pushing
2. **Write tests** for new features
3. **Keep PRs small** for faster reviews
4. **Monitor CI results** and fix failures quickly
5. **Test locally** before pushing

### For Deployments

1. **Deploy to staging first** - Always test in staging
2. **Review logs** before approving production
3. **Monitor metrics** during and after deployment
4. **Have rollback plan** ready
5. **Deploy during low-traffic hours** for major changes

### For Security

1. **Never commit secrets** - Use GitHub Secrets
2. **Review security scan results** before merging
3. **Keep dependencies updated** regularly
4. **Monitor vulnerability alerts** from GitHub
5. **Rotate secrets** periodically

## Troubleshooting

See [GitHub Actions Troubleshooting](./GITHUB_ACTIONS_TROUBLESHOOTING.md) for common issues and solutions.

## Configuration Files

All CI/CD configuration is in:
- `.github/workflows/*.yml` - Workflow definitions
- `deployment/scripts/*.sh` - Deployment scripts
- `docker-compose.yml` - Local/staging setup
- `.env.example` - Environment template

## Next Steps

- Read [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md) for step-by-step deployment guide
- Review [Rollback Procedures](./ROLLBACK_PROCEDURES.md) for emergency recovery
- Check [GitHub Setup](./GITHUB_SETUP.md) for initial configuration

---

Last Updated: 2025-12-17
