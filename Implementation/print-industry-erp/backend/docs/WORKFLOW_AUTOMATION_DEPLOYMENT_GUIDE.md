# Workflow Automation Engine - Deployment Guide
**REQ: REQ-STRATEGIC-AUTO-1767108044309**
**Date:** 2025-12-30
**Agent:** Berry (DevOps Engineer)

---

## Executive Summary

This document provides comprehensive deployment instructions for the **Intelligent Workflow Automation Engine**, a generalized, event-driven workflow automation system for business processes. The engine extends the existing PO approval workflow infrastructure to support any business process requiring approval chains, service tasks, user tasks, and conditional routing.

### Key Features
- ✅ Generalized workflow definitions with versioning
- ✅ Event-driven and scheduled workflow triggers
- ✅ Support for 5 node types: approval, service_task, user_task, gateway, sub_workflow
- ✅ Conditional routing and branching logic
- ✅ SLA monitoring and escalation
- ✅ User task queue with urgency indicators
- ✅ Workflow analytics and performance metrics
- ✅ Immutable audit trail for compliance (SOX/GDPR)
- ✅ Row-Level Security (RLS) for tenant isolation

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Steps](#deployment-steps)
3. [Health Verification](#health-verification)
4. [Configuration](#configuration)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring](#monitoring)

---

## Prerequisites

### System Requirements
- **PostgreSQL**: 14.0 or higher (with uuid-ossp and btree_gist extensions)
- **Node.js**: 18.x or higher
- **NestJS**: 10.x or higher
- **Database Schema Version**: V0.0.60 or higher (prerequisite migrations applied)

### Access Requirements
- Database superuser or owner access for migration execution
- Write access to backend codebase
- Access to restart NestJS backend service
- (Optional) Frontend repository access for UI integration

### Dependency Verification
```bash
# Verify PostgreSQL version
psql --version  # Should be 14.0+

# Verify Node.js version
node --version  # Should be 18.x+

# Verify NestJS CLI
nest --version  # Should be 10.x+

# Check required extensions
psql "${DATABASE_URL}" -c "SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'btree_gist');"
```

---

## Deployment Steps

### Step 1: Pre-Deployment Checklist

**1.1 Backup Database**
```bash
# Create full database backup
pg_dump "${DATABASE_URL}" > backup_before_workflow_$(date +%Y%m%d_%H%M%S).sql

# Verify backup file
ls -lh backup_before_workflow_*.sql
```

**1.2 Verify Prerequisites**
```bash
cd print-industry-erp/backend

# Check migration file exists
ls -l migrations/V0.0.61__create_workflow_automation_engine.sql

# Check required files
ls -l src/modules/workflow/services/workflow-engine.service.ts
ls -l src/graphql/resolvers/workflow.resolver.ts
ls -l src/modules/workflow/workflow.module.ts
```

**1.3 Set Environment Variables**
```bash
# Ensure .env file has DATABASE_URL configured
cat .env | grep DATABASE_URL

# Or export directly
export DATABASE_URL="postgresql://user:password@localhost:5432/agog_erp"
```

---

### Step 2: Database Migration

**2.1 Run Deployment Script**
```bash
cd print-industry-erp/backend

# Make script executable
chmod +x scripts/deploy-workflow-automation.sh

# Execute deployment
./scripts/deploy-workflow-automation.sh
```

**Expected Output:**
```
==========================================
Workflow Automation Engine Deployment
REQ: REQ-STRATEGIC-AUTO-1767108044309
==========================================

Step 1: Checking database connection...
✓ Database connection successful

Step 2: Running database migration...
Applying V0.0.61__create_workflow_automation_engine.sql
✓ Migration applied successfully

Step 3: Verifying table creation...
✓ All 4 tables created successfully

Step 4: Verifying view creation...
✓ All 2 views created successfully

Step 5: Verifying RLS policies...
✓ RLS policies created successfully (8 policies)

Step 6: Verifying indexes...
✓ Indexes created successfully (11 indexes)

Step 7: Verifying triggers...
✓ Updated_at triggers created successfully

Step 8: Verifying sample workflow...
✓ Sample workflow 'Simple Purchase Approval' created

Step 9: Checking GraphQL schema file...
✓ GraphQL schema file exists

Step 10: Checking GraphQL resolver...
✓ GraphQL resolver file exists

Step 11: Checking workflow engine service...
✓ Workflow engine service file exists

Step 12: Checking NestJS module registration...
✓ WorkflowModule registered in AppModule

==========================================
Deployment Summary
==========================================
✓ Database migration applied
✓ 4 tables created
✓ 2 views created
✓ RLS policies enabled
✓ Indexes optimized
✓ Triggers configured

Next Steps:
1. Run health check: ./scripts/health-check-workflow-automation.sh
2. Restart NestJS backend: npm run start:dev
3. Test GraphQL endpoints at http://localhost:4000/graphql
4. Verify frontend integration at /workflows route

==========================================
Deployment Complete!
==========================================
```

**2.2 Manual Migration (Alternative)**

If the deployment script fails, run migration manually:

```bash
# Apply migration directly
psql "${DATABASE_URL}" -f migrations/V0.0.61__create_workflow_automation_engine.sql

# Verify tables created
psql "${DATABASE_URL}" -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_name LIKE 'workflow_%';
"
```

---

### Step 3: Backend Service Restart

**3.1 Stop Existing Service**
```bash
# If using PM2
pm2 stop backend

# If using systemd
sudo systemctl stop agog-backend

# If running in development
# Kill existing node process (Ctrl+C)
```

**3.2 Clear Cache (Optional)**
```bash
# Clear NestJS build cache
rm -rf dist/

# Reinstall dependencies if needed
npm install
```

**3.3 Start Backend Service**
```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod

# PM2 (production)
pm2 start ecosystem.config.js --only backend
pm2 save
```

**3.4 Verify Service Started**
```bash
# Check logs
tail -f logs/backend.log

# Or PM2 logs
pm2 logs backend

# Expected output should include:
# "WorkflowModule dependencies initialized"
# "Workflow engine service ready"
```

---

### Step 4: Health Verification

**4.1 Run Health Check Script**
```bash
cd print-industry-erp/backend

# Make script executable
chmod +x scripts/health-check-workflow-automation.sh

# Execute health check
./scripts/health-check-workflow-automation.sh
```

**Expected Output:**
```
================================================
Workflow Automation Engine - Health Check
REQ: REQ-STRATEGIC-AUTO-1767108044309
================================================

Check 1: Database Tables
------------------------
✓ All 4 tables present
  • workflow_definitions
  • workflow_instance_history
  • workflow_instance_nodes
  • workflow_instances

Check 2: Database Views
-----------------------
✓ All 2 views present
  • v_user_task_queue
  • v_workflow_analytics

Check 3: Row-Level Security
---------------------------
✓ RLS enabled on all tables
  • workflow_definitions       | 2
  • workflow_instance_history  | 2
  • workflow_instance_nodes    | 2
  • workflow_instances         | 2

... (additional checks)

================================================
Health Check Summary
================================================
✓ ALL CHECKS PASSED

System Status: HEALTHY
Workflow Automation Engine is fully operational!

Ready for:
  • Creating workflow definitions
  • Starting workflow instances
  • Processing approval tasks
  • Monitoring workflow analytics
```

**4.2 Manual Health Checks**

If automated health check is not available:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_name LIKE 'workflow_%'
ORDER BY table_name;

-- Check RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'workflow_%';

-- Check sample workflow
SELECT name, version, is_active, category
FROM workflow_definitions;

-- Check views work
SELECT COUNT(*) FROM v_user_task_queue;
SELECT COUNT(*) FROM v_workflow_analytics;
```

---

## Configuration

### Workflow Definition Configuration

**Creating a Workflow Template:**

```graphql
mutation CreateWorkflow {
  createWorkflowDefinition(input: {
    name: "Purchase Order Approval",
    description: "Multi-level PO approval workflow",
    category: "approval",
    nodes: [
      {
        id: "manager_approval",
        nodeType: "approval",
        name: "Manager Approval",
        approverRole: "manager",
        slaHours: 24
      },
      {
        id: "amount_check",
        nodeType: "gateway",
        name: "Check Amount",
        conditionExpression: "context.amount > 10000"
      },
      {
        id: "cfo_approval",
        nodeType: "approval",
        name: "CFO Approval",
        approverRole: "cfo",
        slaHours: 48
      },
      {
        id: "complete",
        nodeType: "service_task",
        name: "Complete Order",
        serviceType: "database_query"
      }
    ],
    routes: [
      {
        fromNodeId: "manager_approval",
        toNodeId: "amount_check"
      },
      {
        fromNodeId: "amount_check",
        toNodeId: "cfo_approval",
        condition: "true"
      },
      {
        fromNodeId: "amount_check",
        toNodeId: "complete",
        condition: "false"
      },
      {
        fromNodeId: "cfo_approval",
        toNodeId: "complete"
      }
    ],
    slaHours: 72,
    escalationEnabled: true
  }) {
    id
    name
    version
    isActive
  }
}
```

### Environment Variables

Add to `.env` file:

```bash
# Workflow Engine Configuration
WORKFLOW_DEFAULT_SLA_HOURS=48
WORKFLOW_ESCALATION_ENABLED=true
WORKFLOW_MAX_RETRIES=3
WORKFLOW_HISTORY_RETENTION_DAYS=3650  # 10 years for compliance

# Task Queue Configuration
TASK_QUEUE_REFRESH_INTERVAL_SECONDS=60
TASK_QUEUE_URGENT_THRESHOLD_HOURS=4
```

---

## Testing

### GraphQL Playground Testing

**1. Access GraphQL Playground**
```
http://localhost:4000/graphql
```

**2. Test Queries**

```graphql
# Get all active workflow definitions
query GetWorkflows {
  workflowDefinitions(isActive: true) {
    id
    name
    version
    category
    nodes {
      id
      nodeType
      name
    }
  }
}

# Get my pending tasks
query GetMyTasks {
  myPendingTasks(urgencyLevel: "URGENT") {
    taskId
    workflowName
    taskName
    urgencyLevel
    hoursRemaining
    isOverdue
  }
}

# Get workflow analytics
query GetAnalytics {
  workflowAnalytics {
    workflowName
    totalInstances
    slaCompliancePercentage
    avgCompletionHours
  }
}
```

**3. Test Mutations**

```graphql
# Start a workflow
mutation StartWorkflow {
  startWorkflow(input: {
    workflowDefinitionId: "uuid-of-workflow-def",
    contextEntityType: "purchase_order",
    contextEntityId: "uuid-of-po",
    contextData: { amount: 15000 }
  }) {
    id
    status
    workflowName
  }
}

# Approve a task
mutation ApproveTask {
  approveTask(
    taskId: "uuid-of-task",
    comments: "Approved - looks good"
  ) {
    id
    status
  }
}
```

### Integration Testing

**Test Workflow Execution End-to-End:**

```bash
# Create test data script
cat > test-workflow.sql << 'EOF'
-- Set tenant context
SET app.current_tenant = (SELECT id FROM tenants LIMIT 1);

-- Create test workflow definition
INSERT INTO workflow_definitions (tenant_id, name, category, nodes, routes)
VALUES (
  current_setting('app.current_tenant')::UUID,
  'Test Approval Workflow',
  'approval',
  '[{"id": "approve", "node_type": "approval", "name": "Test Approval"}]'::jsonb,
  '[]'::jsonb
)
RETURNING id;

-- Start workflow instance
-- (Use returned ID from above)
EOF

# Execute test
psql "${DATABASE_URL}" -f test-workflow.sql
```

---

## Troubleshooting

### Common Issues

**Issue 1: Migration Fails with "relation already exists"**

**Cause:** Migration was partially applied
**Solution:**
```sql
-- Check which tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'workflow_%';

-- Drop tables if needed (CAUTION: data loss)
DROP TABLE IF EXISTS workflow_instance_history CASCADE;
DROP TABLE IF EXISTS workflow_instance_nodes CASCADE;
DROP TABLE IF EXISTS workflow_instances CASCADE;
DROP TABLE IF EXISTS workflow_definitions CASCADE;

-- Re-run migration
\i migrations/V0.0.61__create_workflow_automation_engine.sql
```

**Issue 2: RLS Policies Blocking Access**

**Cause:** Tenant context not set in session
**Solution:**
```sql
-- Set tenant context before queries
SET app.current_tenant = 'your-tenant-uuid';

-- Verify setting
SELECT current_setting('app.current_tenant', true);

-- Test query
SELECT * FROM workflow_definitions;
```

**Issue 3: WorkflowModule Not Registered**

**Cause:** Module not imported in AppModule
**Solution:**
```typescript
// src/app.module.ts
import { WorkflowModule } from './modules/workflow/workflow.module';

@Module({
  imports: [
    // ... other modules
    WorkflowModule,  // Add this line
  ],
})
export class AppModule {}
```

**Issue 4: GraphQL Resolver Not Loading**

**Cause:** Resolver not registered in module
**Solution:**
```typescript
// src/modules/workflow/workflow.module.ts
import { WorkflowResolver } from '../../graphql/resolvers/workflow.resolver';

@Module({
  providers: [
    WorkflowEngineService,
    WorkflowResolver,  // Ensure resolver is registered
  ],
})
export class WorkflowModule {}
```

**Issue 5: Service Tasks Not Executing**

**Cause:** Missing service type handlers
**Solution:**
```typescript
// Implement service task handlers in workflow-engine.service.ts
private async executeServiceTask(node, context) {
  switch (node.service_type) {
    case 'database_query':
      return await this.executeDatabaseQuery(node.service_config);
    case 'http_call':
      return await this.executeHttpCall(node.service_config);
    case 'email_send':
      return await this.sendEmail(node.service_config);
    default:
      throw new Error(`Unknown service type: ${node.service_type}`);
  }
}
```

---

## Rollback Procedures

### Database Rollback

**Option 1: Restore from Backup**
```bash
# Drop workflow tables
psql "${DATABASE_URL}" << 'EOF'
DROP VIEW IF EXISTS v_workflow_analytics;
DROP VIEW IF EXISTS v_user_task_queue;
DROP TABLE IF EXISTS workflow_instance_history CASCADE;
DROP TABLE IF EXISTS workflow_instance_nodes CASCADE;
DROP TABLE IF EXISTS workflow_instances CASCADE;
DROP TABLE IF EXISTS workflow_definitions CASCADE;
EOF

# Restore from backup
psql "${DATABASE_URL}" < backup_before_workflow_*.sql
```

**Option 2: Manual Rollback Migration**
```sql
-- Create rollback script: migrations/V0.0.61_ROLLBACK.sql
DROP VIEW IF EXISTS v_workflow_analytics CASCADE;
DROP VIEW IF EXISTS v_user_task_queue CASCADE;

DROP TABLE IF EXISTS workflow_instance_history CASCADE;
DROP TABLE IF EXISTS workflow_instance_nodes CASCADE;
DROP TABLE IF EXISTS workflow_instances CASCADE;
DROP TABLE IF EXISTS workflow_definitions CASCADE;

DROP FUNCTION IF EXISTS update_workflow_updated_at() CASCADE;
```

Apply rollback:
```bash
psql "${DATABASE_URL}" -f migrations/V0.0.61_ROLLBACK.sql
```

### Code Rollback

```bash
# Revert WorkflowModule registration
git diff src/app.module.ts
git checkout src/app.module.ts

# Or manually remove import:
# Remove: import { WorkflowModule } from './modules/workflow/workflow.module';
# Remove: WorkflowModule from imports array

# Restart backend
npm run start:dev
```

---

## Monitoring

### Key Metrics to Monitor

**1. Workflow Instance Status Distribution**
```sql
SELECT status, COUNT(*)
FROM workflow_instances
GROUP BY status;
```

**2. SLA Compliance**
```sql
SELECT
  workflow_name,
  sla_compliance_percentage
FROM v_workflow_analytics
WHERE total_instances > 0
ORDER BY sla_compliance_percentage ASC;
```

**3. Pending Tasks by Urgency**
```sql
SELECT urgency_level, COUNT(*)
FROM v_user_task_queue
GROUP BY urgency_level;
```

**4. Average Workflow Completion Time**
```sql
SELECT
  workflow_name,
  avg_completion_hours
FROM v_workflow_analytics
WHERE avg_completion_hours IS NOT NULL
ORDER BY avg_completion_hours DESC;
```

### Alerting Thresholds

Set up alerts for:
- SLA compliance < 80%
- Pending urgent tasks > 10
- Failed workflows > 5% of total
- Average completion time > 2x expected

### Logging

**Enable Debug Logging:**
```typescript
// src/modules/workflow/services/workflow-engine.service.ts
import { Logger } from '@nestjs/common';

export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  async startWorkflow(...) {
    this.logger.log(`Starting workflow: ${workflowDefinitionId}`);
    // ... workflow logic
  }
}
```

---

## Post-Deployment Tasks

### Immediate (Day 1)
- [x] Verify all health checks pass
- [ ] Test workflow creation via GraphQL
- [ ] Test workflow instance execution
- [ ] Verify user task queue displays correctly
- [ ] Check RLS policies prevent cross-tenant access

### Short-term (Week 1)
- [ ] Create production workflow templates
- [ ] Train users on workflow approval process
- [ ] Set up monitoring dashboards
- [ ] Configure alerting thresholds
- [ ] Document workflow design patterns

### Long-term (Month 1)
- [ ] Analyze workflow performance metrics
- [ ] Optimize slow-running workflows
- [ ] Implement advanced service tasks (integrations)
- [ ] Build visual workflow designer UI
- [ ] Add ML-based workflow recommendations

---

## Support and Escalation

### Documentation Resources
- **GraphQL Schema**: `src/graphql/schema/workflow.graphql`
- **Database Schema**: `migrations/V0.0.61__create_workflow_automation_engine.sql`
- **Service Layer**: `src/modules/workflow/services/workflow-engine.service.ts`
- **QA Test Report**: `BILLY_QA_DELIVERABLE_REQ-STRATEGIC-AUTO-1767108044309.md`

### Contact Information
- **DevOps Engineer (Berry)**: berry@agog.ai
- **Backend Developer (Roy)**: roy@agog.ai
- **QA Engineer (Billy)**: billy@agog.ai
- **Support Email**: support@agog.ai

---

## Appendix

### A. Database Schema Summary

**Tables:**
1. `workflow_definitions` - Workflow templates with versioning
2. `workflow_instances` - Running/completed workflow executions
3. `workflow_instance_nodes` - Execution log of workflow nodes
4. `workflow_instance_history` - Immutable audit trail

**Views:**
1. `v_user_task_queue` - User task queue with SLA urgency
2. `v_workflow_analytics` - Workflow performance metrics

**Key Indexes:**
- `idx_workflow_definitions_tenant` - Tenant isolation
- `idx_workflow_instances_sla` - SLA deadline queries
- `idx_workflow_instance_nodes_assigned_user` - User task queue
- `idx_workflow_instance_history_instance` - Audit trail queries

### B. GraphQL API Summary

**Queries:**
- `workflowDefinitions` - List workflow templates
- `workflowInstances` - List workflow executions
- `myPendingTasks` - Get user's task queue
- `workflowAnalytics` - Get performance metrics

**Mutations:**
- `createWorkflowDefinition` - Create workflow template
- `startWorkflow` - Start workflow instance
- `approveTask` - Approve workflow task
- `rejectTask` - Reject workflow task
- `delegateTask` - Delegate task to another user

### C. Supported Node Types

1. **Approval Node**: Requires user approval with SLA
2. **Service Task**: Auto-executed background task
3. **User Task**: Form-based user input task
4. **Gateway**: Conditional routing based on context
5. **Sub-Workflow**: Nested workflow execution

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** Production Ready ✅
