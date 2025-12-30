# Workflow Automation Engine - Quick Start Guide
**REQ:** REQ-STRATEGIC-AUTO-1767108044309

---

## 🚀 Quick Deployment (5 Minutes)

### Prerequisites
- PostgreSQL 14+ running
- Node.js 18+ installed
- Database URL configured in `.env`

### Step 1: Deploy
```bash
cd print-industry-erp/backend
./scripts/deploy-workflow-automation.sh
```

### Step 2: Verify
```bash
./scripts/health-check-workflow-automation.sh
```

### Step 3: Start Backend
```bash
npm run start:dev
# or for production:
npm run build && npm run start:prod
```

### Step 4: Test
Open GraphQL Playground: http://localhost:4000/graphql

```graphql
query {
  workflowDefinitions {
    id
    name
    version
  }
}
```

**✅ Done!** Workflow Automation Engine is operational.

---

## 📦 What Gets Deployed

### Database (Migration V0.0.61)
- ✅ 4 tables (workflow_definitions, workflow_instances, workflow_instance_nodes, workflow_instance_history)
- ✅ 2 views (v_user_task_queue, v_workflow_analytics)
- ✅ 11+ indexes
- ✅ 8 RLS policies
- ✅ 2 triggers

### Backend Services
- ✅ WorkflowModule (NestJS module)
- ✅ WorkflowEngineService (execution engine)
- ✅ WorkflowResolver (GraphQL API)

### GraphQL API
- ✅ 7+ queries
- ✅ 10+ mutations

---

## 🔍 Quick Health Check

```bash
# Full health check
./scripts/health-check-workflow-automation.sh

# Quick database check
psql "${DATABASE_URL}" -c "SELECT COUNT(*) FROM workflow_definitions;"

# Quick API check
curl http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query": "{ workflowDefinitions { id name } }"}'
```

---

## 🐳 Docker Deployment

```bash
# Deploy in Docker environment
./scripts/deploy-workflow-automation-docker.sh

# Start containers
docker-compose -f docker-compose.app.yml up -d postgres backend

# Run health check
docker exec backend-container ./scripts/health-check-workflow-automation.sh

# View logs
docker-compose -f docker-compose.app.yml logs -f backend
```

---

## 🔄 Rollback

### Quick Rollback (If Something Goes Wrong)

```bash
# Option 1: Restore from backup
psql "${DATABASE_URL}" < backup_before_workflow_*.sql

# Option 2: Drop workflow tables
psql "${DATABASE_URL}" << 'EOF'
DROP VIEW IF EXISTS v_workflow_analytics CASCADE;
DROP VIEW IF EXISTS v_user_task_queue CASCADE;
DROP TABLE IF EXISTS workflow_instance_history CASCADE;
DROP TABLE IF EXISTS workflow_instance_nodes CASCADE;
DROP TABLE IF EXISTS workflow_instances CASCADE;
DROP TABLE IF EXISTS workflow_definitions CASCADE;
EOF
```

---

## 📊 Common Queries

### Get All Workflows
```graphql
query {
  workflowDefinitions(isActive: true) {
    id
    name
    category
    version
  }
}
```

### My Pending Tasks
```graphql
query {
  myPendingTasks {
    taskId
    workflowName
    taskName
    urgencyLevel
    hoursRemaining
  }
}
```

### Start a Workflow
```graphql
mutation {
  startWorkflow(input: {
    workflowDefinitionId: "uuid-here",
    contextEntityType: "purchase_order",
    contextEntityId: "po-uuid-here",
    contextData: { amount: 5000 }
  }) {
    id
    status
  }
}
```

### Approve a Task
```graphql
mutation {
  approveTask(
    taskId: "task-uuid-here",
    comments: "Approved"
  ) {
    id
    status
  }
}
```

---

## 🛠️ Troubleshooting

### Issue: "Database connection failed"
**Fix:**
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test connection
psql "${DATABASE_URL}" -c "SELECT 1;"
```

### Issue: "Migration failed - relation already exists"
**Fix:**
```bash
# Tables already exist from previous run
# Re-run is safe if no data loss concern
# Or manually drop tables and re-run
```

### Issue: "WorkflowModule not found"
**Fix:**
```bash
# Ensure module is imported in AppModule
grep "WorkflowModule" src/app.module.ts

# If not found, add to imports array
```

### Issue: "RLS policy blocking access"
**Fix:**
```sql
-- Set tenant context
SET app.current_tenant = 'your-tenant-uuid';

-- Verify
SELECT current_setting('app.current_tenant', true);
```

---

## 📚 Full Documentation

- **Deployment Guide:** `docs/WORKFLOW_AUTOMATION_DEPLOYMENT_GUIDE.md` (25+ pages)
- **Deliverable:** `BERRY_DEVOPS_DELIVERABLE_REQ-STRATEGIC-AUTO-1767108044309.md`
- **QA Report:** `BILLY_QA_DELIVERABLE_REQ-STRATEGIC-AUTO-1767108044309.md`

---

## 💡 Tips

- ✅ Always backup database before deployment
- ✅ Run health check after deployment
- ✅ Test GraphQL endpoints before production
- ✅ Monitor logs during first 24 hours
- ✅ Set up alerting for SLA compliance < 85%

---

## 📞 Support

- **DevOps (Berry):** berry@agog.ai
- **Backend (Roy):** roy@agog.ai
- **QA (Billy):** billy@agog.ai
- **On-Call:** oncall@agog.ai

---

**Status:** Production Ready ✅
**Version:** 1.0
**Last Updated:** 2025-12-30
