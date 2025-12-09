**📍 Navigation Path:** [AGOG Home](../README.md) → [Project Architecture](./README.md) → Deployment Process

# Deployment and Release Management

## Deployment Strategy

AGOG uses **Blue-Green Deployment** for zero-downtime releases. See [Blue-Green Deployment Guide](../Standards/code/blue-green-deployment.md) for comprehensive documentation.

### Why Blue-Green?
- **Zero Downtime:** Critical for 24/7 print manufacturing operations
- **Multi-Tenant SaaS:** Can't afford downtime for any customer
- **Instant Rollback:** Switch back to previous version in seconds
- **Production Validation:** Test new version with real traffic before full cutover
- **Risk Reduction:** Old version stays ready as safety net

### Environment Management

#### Production Environments
```
BLUE Environment (Current Live)
  ├─ Application Servers (v1.2.0)
  ├─ Load Balancer (active)
  └─ Database Connection

GREEN Environment (Next Release)
  ├─ Application Servers (v1.3.0)
  ├─ Load Balancer (standby)
  └─ Database Connection

Shared Infrastructure
  ├─ PostgreSQL Database (with replication)
  ├─ Redis Cache Cluster
  ├─ File Storage (Azure Blob)
  └─ Monitoring & Logging
```

#### Supporting Environments
- **Development** - Individual developer environments
- **Staging** - Pre-production testing
- **QA** - Quality assurance and integration testing
- **DR (Disaster Recovery)** - Geographic failover

### Release Process

#### 1. Release Planning
- Feature freeze date
- Code review completion
- Test suite validation
- Database migration review
- Stakeholder notification

#### 2. Change Approval
- Technical review (architecture team)
- Security review (if applicable)
- Database change approval
- Business stakeholder sign-off
- Release window scheduling

#### 3. Deployment Steps

**Pre-Deployment:**
- [ ] Merge to main branch
- [ ] Tag release version
- [ ] Run full test suite
- [ ] Build and publish Docker images
- [ ] Review rollback plan

**Deploy to Green:**
- [ ] Deploy application to Green environment
- [ ] Run database migrations (backward-compatible)
- [ ] Start services and warm up
- [ ] Run automated smoke tests
- [ ] Execute integration tests
- [ ] Manual QA validation

**Traffic Cutover:**
- [ ] Switch load balancer to Green (100% traffic)
- [ ] Monitor error rates and performance
- [ ] Verify equipment connections stable
- [ ] Check customer-facing features
- [ ] Monitor for 1+ hour

**Post-Deployment:**
- [ ] Declare deployment successful
- [ ] Update Blue to match Green (for next cycle)
- [ ] Document any issues or learnings
- [ ] Notify stakeholders of completion

#### 4. Rollback Procedures

**Instant Rollback (within 1 hour of cutover):**
```bash
# Switch traffic back to Blue environment
./scripts/switch-to-blue.sh

# Verify Blue is serving traffic
curl https://api.agog.com/health | grep "blue"

# Investigate issues on Green offline
```

**Rollback Triggers:**
- Error rate increase >1%
- Response time degradation >50%
- Database connection issues
- Equipment integration failures
- Critical bug discovered
- Customer complaints

## Monitoring

### Deployment Monitoring Dashboard

**Real-Time Metrics (during deployment):**
```
┌─────────────────────────────────────────────┐
│         AGOG Deployment Monitor             │
├─────────────────────────────────────────────┤
│ Environment:     GREEN (v1.3.0)             │
│ Status:          Validating                 │
│ Traffic:         0% (staging)               │
├─────────────────────────────────────────────┤
│ Error Rate:      0.3% ✓                     │
│ Response Time:   125ms (avg) ✓              │
│ Requests/sec:    0 (staging only)           │
│ DB Connections:  12 ✓                       │
│ Cache Hit Rate:  95% ✓                      │
│ Equipment:       23/23 connected ✓          │
├─────────────────────────────────────────────┤
│ Smoke Tests:     PASSED ✓                   │
│ Integration:     PASSED ✓                   │
│ Performance:     PASSED ✓                   │
└─────────────────────────────────────────────┘
```

### Health Checks

**Application Health Endpoint:**
```typescript
GET /api/health
Response:
{
  "status": "healthy",
  "environment": "green",
  "version": "1.3.0",
  "timestamp": "2025-10-30T10:30:00Z",
  "checks": {
    "database": "ok",
    "cache": "ok",
    "storage": "ok",
    "equipment": "ok (23/23 connected)"
  }
}
```

### Performance Metrics

**Track During Deployment:**
- HTTP error rates (by endpoint)
- Response time percentiles (p50, p95, p99)
- Database query performance
- Cache hit/miss ratios
- Equipment connection stability
- WebSocket connection health
- Background job queue depth

### Error Tracking

**Alert Channels:**
- PagerDuty for critical issues
- Slack for warnings
- Email for deployment status
- Teams for stakeholder updates

**Error Thresholds:**
| Severity | Threshold | Action |
|----------|-----------|--------|
| Critical | Error rate >1% | Auto-rollback consideration |
| Warning | Error rate >0.5% | Manual investigation |
| Info | New error types | Monitor closely |

### User Impact Monitoring

**Customer-Facing Metrics:**
- Active user sessions
- Order submission rate
- Dashboard load times
- Equipment status updates
- Print job processing times

## Database Migration Strategy

### Backward-Compatible Migrations

**Example: Adding New Column**
```sql
-- Migration V1.3.0__add_customer_preferences.sql
-- Safe for Blue-Green: Blue ignores new column, Green uses it

ALTER TABLE customers 
ADD COLUMN preferences JSONB DEFAULT '{}';

-- Index for Green environment queries
CREATE INDEX idx_customers_preferences 
ON customers USING gin(preferences);

-- Blue (v1.2.0) continues working (ignores new column)
-- Green (v1.3.0) can use new column
```

**Later Cleanup (after Blue updated):**
```sql
-- Migration V1.3.1__preferences_not_null.sql
-- Only run after both environments on v1.3.0+

ALTER TABLE customers 
ALTER COLUMN preferences SET NOT NULL;
```

### Migration Testing

**Pre-Production:**
1. Test migration on development database
2. Test migration on staging database
3. Verify backward compatibility
4. Test rollback scenario
5. Document any data transformations

### Multi-Tenant Considerations

**Tenant-Specific Rollout:**
```typescript
// Gradual tenant migration to Green
const tenantRouting = {
  'pilot-tenant-id': 'green',  // Early adopter
  'default': 'blue'            // All others
};

// Gradually move tenants to Green
// Monitor each tenant before moving more
```

## Automation

### CI/CD Pipeline

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production (Blue-Green)

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Determine Target Environment
        run: |
          # Blue or Green based on current live
          
      - name: Build & Test
        run: npm run test:full
        
      - name: Build Docker Image
        run: docker build -t agog:${{ github.ref_name }}
        
      - name: Deploy to Target Environment
        run: ./scripts/deploy-to-green.sh
        
      - name: Run Smoke Tests
        run: npm run test:smoke -- --env=green
        
      - name: Wait for Manual Approval
        uses: trstringer/manual-approval@v1
        
      - name: Switch Traffic
        run: ./scripts/switch-to-green.sh
        
      - name: Monitor Deployment
        run: ./scripts/monitor-deployment.sh --duration=60m
```

### Deployment Scripts

**Location:** `scripts/deployment/`
- `deploy-to-green.sh` - Deploy to Green environment
- `deploy-to-blue.sh` - Deploy to Blue environment
- `switch-to-green.sh` - Route traffic to Green
- `switch-to-blue.sh` - Route traffic to Blue (rollback)
- `monitor-deployment.sh` - Watch key metrics

## Security Considerations

### Deployment Access
- Limited to DevOps team
- Requires MFA authentication
- All actions logged and audited
- Approval required for production

### Secrets Management
- Azure Key Vault for secrets
- Separate secrets per environment
- Automatic rotation for sensitive keys
- No secrets in code or configs

### Compliance
- Change tracking for audit
- Rollback capability for compliance
- Version history maintained
- Deployment logs retained

## Disaster Recovery

### DR Environment Sync
- Continuous replication to DR region
- Blue-Green strategy applies to DR too
- Regular DR failover testing
- RTO: 15 minutes, RPO: 5 minutes

### Backup Strategy
- Database backups every 6 hours
- Transaction log backups every 15 minutes
- Configuration backups before each deployment
- 30-day retention policy

## Communication Plan

### Pre-Deployment
**24 hours before:**
- Email to all stakeholders
- In-app notification banner
- Status page update

**1 hour before:**
- Final reminder email
- Support team briefing
- Monitoring team on standby

### During Deployment
- Real-time updates on status page
- Slack channel for team coordination
- Escalation path documented

### Post-Deployment
- Success/rollback notification
- Summary of changes deployed
- Known issues (if any)
- Next release timeline

## Related Documentation
- [Blue-Green Deployment Guide](../Standards/code/blue-green-deployment.md) - Detailed strategy and examples
- [Database Migration Standards](../Standards/data/migration-standards.md) - Migration best practices
- [Testing Strategy](./testing-strategy.md) - Smoke test requirements
- [Disaster Recovery](./security/disaster-recovery.md) - DR procedures

## Version History
- v1.1 (2025-10-30): Added Blue-Green deployment strategy
- v1.0 (2025-10-29): Initial deployment process

---

[⬆ Back to top](#deployment-and-release-management) | [🏠 AGOG Home](../README.md) | [🏗️ Project Architecture](./README.md)