#!/bin/bash
# Health Check Script for Workflow Automation Engine
# REQ: REQ-STRATEGIC-AUTO-1767108044309

set -e

echo "================================================"
echo "Workflow Automation Engine - Health Check"
echo "REQ: REQ-STRATEGIC-AUTO-1767108044309"
echo "================================================"
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

FAILED_CHECKS=0

# Check 1: Database Tables
echo "Check 1: Database Tables"
echo "------------------------"
TABLES=$(psql "${DATABASE_URL}" -t -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'workflow_definitions',
      'workflow_instances',
      'workflow_instance_nodes',
      'workflow_instance_history'
    )
  ORDER BY table_name;
")

TABLE_COUNT=$(echo "$TABLES" | grep -v '^$' | wc -l)
if [ "$TABLE_COUNT" -eq 4 ]; then
  echo "✓ All 4 tables present"
  echo "$TABLES" | sed 's/^/  • /'
else
  echo "✗ Missing tables (found $TABLE_COUNT/4)"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 2: Views
echo ""
echo "Check 2: Database Views"
echo "-----------------------"
VIEWS=$(psql "${DATABASE_URL}" -t -c "
  SELECT table_name
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name IN (
      'v_user_task_queue',
      'v_workflow_analytics'
    )
  ORDER BY table_name;
")

VIEW_COUNT=$(echo "$VIEWS" | grep -v '^$' | wc -l)
if [ "$VIEW_COUNT" -eq 2 ]; then
  echo "✓ All 2 views present"
  echo "$VIEWS" | sed 's/^/  • /'
else
  echo "✗ Missing views (found $VIEW_COUNT/2)"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 3: RLS Policies
echo ""
echo "Check 3: Row-Level Security"
echo "---------------------------"
RLS_STATUS=$(psql "${DATABASE_URL}" -t -c "
  SELECT
    tablename,
    COUNT(*) as policy_count
  FROM pg_policies
  WHERE tablename IN (
    'workflow_definitions',
    'workflow_instances',
    'workflow_instance_nodes',
    'workflow_instance_history'
  )
  GROUP BY tablename
  ORDER BY tablename;
")

RLS_ENABLED=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*)
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'workflow_definitions',
      'workflow_instances',
      'workflow_instance_nodes',
      'workflow_instance_history'
    )
    AND rowsecurity = true;
")

if [ "$RLS_ENABLED" -eq 4 ]; then
  echo "✓ RLS enabled on all tables"
  echo "$RLS_STATUS" | sed 's/^/  • /'
else
  echo "✗ RLS not enabled on all tables (enabled on $RLS_ENABLED/4)"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 4: Indexes
echo ""
echo "Check 4: Database Indexes"
echo "-------------------------"
INDEXES=$(psql "${DATABASE_URL}" -t -c "
  SELECT
    tablename,
    COUNT(*) as index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN (
      'workflow_definitions',
      'workflow_instances',
      'workflow_instance_nodes',
      'workflow_instance_history'
    )
  GROUP BY tablename
  ORDER BY tablename;
")

TOTAL_INDEXES=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*)
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN (
      'workflow_definitions',
      'workflow_instances',
      'workflow_instance_nodes',
      'workflow_instance_history'
    );
")

if [ "$TOTAL_INDEXES" -ge 10 ]; then
  echo "✓ Indexes created ($TOTAL_INDEXES total)"
  echo "$INDEXES" | sed 's/^/  • /'
else
  echo "⚠ Lower than expected index count: $TOTAL_INDEXES (expected ≥10)"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 5: Triggers
echo ""
echo "Check 5: Database Triggers"
echo "--------------------------"
TRIGGERS=$(psql "${DATABASE_URL}" -t -c "
  SELECT
    event_object_table,
    trigger_name
  FROM information_schema.triggers
  WHERE event_object_table IN (
    'workflow_definitions',
    'workflow_instances'
  )
  AND trigger_name LIKE '%updated_at%'
  ORDER BY event_object_table, trigger_name;
")

TRIGGER_COUNT=$(echo "$TRIGGERS" | grep -v '^$' | wc -l)
if [ "$TRIGGER_COUNT" -eq 2 ]; then
  echo "✓ Updated_at triggers configured"
  echo "$TRIGGERS" | sed 's/^/  • /'
else
  echo "⚠ Expected 2 triggers, found $TRIGGER_COUNT"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 6: Workflow Definitions
echo ""
echo "Check 6: Workflow Definitions"
echo "-----------------------------"
WORKFLOW_COUNT=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*) FROM workflow_definitions;
")

ACTIVE_WORKFLOWS=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*) FROM workflow_definitions WHERE is_active = true;
")

echo "✓ Total workflow definitions: $WORKFLOW_COUNT"
echo "✓ Active workflow definitions: $ACTIVE_WORKFLOWS"

if [ "$WORKFLOW_COUNT" -gt 0 ]; then
  SAMPLE_WORKFLOWS=$(psql "${DATABASE_URL}" -t -c "
    SELECT name, version, category
    FROM workflow_definitions
    ORDER BY created_at DESC
    LIMIT 5;
  ")
  echo "  Sample workflows:"
  echo "$SAMPLE_WORKFLOWS" | sed 's/^/    /'
fi

# Check 7: Workflow Instances
echo ""
echo "Check 7: Workflow Instances"
echo "---------------------------"
INSTANCE_COUNT=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*) FROM workflow_instances;
")

INSTANCE_STATUS=$(psql "${DATABASE_URL}" -t -c "
  SELECT
    status,
    COUNT(*) as count
  FROM workflow_instances
  GROUP BY status
  ORDER BY status;
")

echo "✓ Total workflow instances: $INSTANCE_COUNT"
if [ "$INSTANCE_COUNT" -gt 0 ]; then
  echo "  Status breakdown:"
  echo "$INSTANCE_STATUS" | sed 's/^/    /'
fi

# Check 8: User Task Queue View
echo ""
echo "Check 8: User Task Queue View"
echo "-----------------------------"
PENDING_TASKS=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*) FROM v_user_task_queue;
")

echo "✓ Pending tasks in queue: $PENDING_TASKS"

if [ "$PENDING_TASKS" -gt 0 ]; then
  URGENT_TASKS=$(psql "${DATABASE_URL}" -t -c "
    SELECT COUNT(*) FROM v_user_task_queue WHERE urgency_level = 'URGENT';
  ")
  echo "  • URGENT tasks: $URGENT_TASKS"
fi

# Check 9: Workflow Analytics View
echo ""
echo "Check 9: Workflow Analytics View"
echo "--------------------------------"
ANALYTICS_AVAILABLE=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*) FROM v_workflow_analytics;
")

echo "✓ Workflow definitions with analytics: $ANALYTICS_AVAILABLE"

if [ "$ANALYTICS_AVAILABLE" -gt 0 ]; then
  SAMPLE_ANALYTICS=$(psql "${DATABASE_URL}" -t -c "
    SELECT
      workflow_name,
      total_instances,
      completed_instances,
      ROUND(sla_compliance_percentage::numeric, 2) as sla_compliance
    FROM v_workflow_analytics
    WHERE total_instances > 0
    ORDER BY total_instances DESC
    LIMIT 3;
  ")
  echo "  Top workflows by instance count:"
  echo "$SAMPLE_ANALYTICS" | sed 's/^/    /'
fi

# Check 10: GraphQL Schema and Resolver
echo ""
echo "Check 10: GraphQL Schema and Resolver"
echo "-------------------------------------"
if [ -f "src/graphql/schema/workflow.graphql" ]; then
  QUERY_COUNT=$(grep -c "^  [a-zA-Z].*:" src/graphql/schema/workflow.graphql | grep -v "#" || echo 0)
  echo "✓ GraphQL schema file exists"
  echo "  • Defined operations: ~$QUERY_COUNT"
else
  echo "✗ GraphQL schema file not found"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

if [ -f "src/graphql/resolvers/workflow.resolver.ts" ]; then
  RESOLVER_METHODS=$(grep -c "@Query\|@Mutation" src/graphql/resolvers/workflow.resolver.ts || echo 0)
  echo "✓ GraphQL resolver file exists"
  echo "  • Resolver methods: ~$RESOLVER_METHODS"
else
  echo "✗ GraphQL resolver file not found"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 11: Service Layer
echo ""
echo "Check 11: Workflow Engine Service"
echo "----------------------------------"
if [ -f "src/modules/workflow/services/workflow-engine.service.ts" ]; then
  SERVICE_METHODS=$(grep -c "async" src/modules/workflow/services/workflow-engine.service.ts || echo 0)
  echo "✓ Workflow engine service file exists"
  echo "  • Service methods: ~$SERVICE_METHODS"
else
  echo "✗ Workflow engine service file not found"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 12: Module Registration
echo ""
echo "Check 12: NestJS Module Registration"
echo "-------------------------------------"
if [ -f "src/modules/workflow/workflow.module.ts" ]; then
  echo "✓ WorkflowModule file exists"
else
  echo "✗ WorkflowModule file not found"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

if [ -f "src/app.module.ts" ]; then
  if grep -q "WorkflowModule" src/app.module.ts; then
    echo "✓ WorkflowModule registered in AppModule"
  else
    echo "⚠ WorkflowModule not registered in AppModule"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
fi

# Check 13: Frontend Integration
echo ""
echo "Check 13: Frontend Integration"
echo "-------------------------------"
if [ -f "../frontend/src/graphql/queries/workflow.ts" ]; then
  QUERY_DEFS=$(grep -c "export const" ../frontend/src/graphql/queries/workflow.ts || echo 0)
  echo "✓ Frontend workflow queries file exists"
  echo "  • Query definitions: ~$QUERY_DEFS"
else
  echo "⚠ Frontend workflow queries file not found (optional)"
fi

if [ -f "../frontend/src/graphql/mutations/workflow.ts" ]; then
  MUTATION_DEFS=$(grep -c "export const" ../frontend/src/graphql/mutations/workflow.ts || echo 0)
  echo "✓ Frontend workflow mutations file exists"
  echo "  • Mutation definitions: ~$MUTATION_DEFS"
else
  echo "⚠ Frontend workflow mutations file not found (optional)"
fi

# Final Summary
echo ""
echo "================================================"
echo "Health Check Summary"
echo "================================================"

if [ $FAILED_CHECKS -eq 0 ]; then
  echo "✓ ALL CHECKS PASSED"
  echo ""
  echo "System Status: HEALTHY"
  echo "Workflow Automation Engine is fully operational!"
  echo ""
  echo "Ready for:"
  echo "  • Creating workflow definitions"
  echo "  • Starting workflow instances"
  echo "  • Processing approval tasks"
  echo "  • Monitoring workflow analytics"
  exit 0
else
  echo "✗ $FAILED_CHECKS CHECK(S) FAILED"
  echo ""
  echo "System Status: NEEDS ATTENTION"
  echo "Please review failed checks above and resolve issues."
  echo ""
  echo "Common fixes:"
  echo "  • Re-run deployment script: ./scripts/deploy-workflow-automation.sh"
  echo "  • Restart NestJS backend: npm run start:dev"
  echo "  • Check database connection: psql \$DATABASE_URL"
  exit 1
fi
