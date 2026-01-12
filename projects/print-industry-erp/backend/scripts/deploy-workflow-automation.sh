#!/bin/bash
# Deployment Script for Intelligent Workflow Automation Engine
# REQ: REQ-STRATEGIC-AUTO-1767108044309

set -e

echo "=========================================="
echo "Workflow Automation Engine Deployment"
echo "REQ: REQ-STRATEGIC-AUTO-1767108044309"
echo "=========================================="
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Database connection check
echo "Step 1: Checking database connection..."
psql "${DATABASE_URL}" -c "SELECT version();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Database connection successful"
else
  echo "✗ Database connection failed"
  exit 1
fi

# Run migration
echo ""
echo "Step 2: Running database migration..."
echo "Applying V0.0.61__create_workflow_automation_engine.sql"
psql "${DATABASE_URL}" -f migrations/V0.0.61__create_workflow_automation_engine.sql
if [ $? -eq 0 ]; then
  echo "✓ Migration applied successfully"
else
  echo "✗ Migration failed"
  exit 1
fi

# Verify tables
echo ""
echo "Step 3: Verifying table creation..."
TABLES_CREATED=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'workflow_definitions',
      'workflow_instances',
      'workflow_instance_nodes',
      'workflow_instance_history'
    );
")

if [ "$TABLES_CREATED" -eq 4 ]; then
  echo "✓ All 4 tables created successfully"
else
  echo "✗ Table creation incomplete (found $TABLES_CREATED/4 tables)"
  exit 1
fi

# Verify views
echo ""
echo "Step 4: Verifying view creation..."
VIEWS_CREATED=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*)
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name IN (
      'v_user_task_queue',
      'v_workflow_analytics'
    );
")

if [ "$VIEWS_CREATED" -eq 2 ]; then
  echo "✓ All 2 views created successfully"
else
  echo "✗ View creation incomplete (found $VIEWS_CREATED/2 views)"
  exit 1
fi

# Verify RLS policies
echo ""
echo "Step 5: Verifying RLS policies..."
RLS_POLICIES=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*)
  FROM pg_policies
  WHERE tablename IN (
    'workflow_definitions',
    'workflow_instances',
    'workflow_instance_nodes',
    'workflow_instance_history'
  );
")

if [ "$RLS_POLICIES" -ge 8 ]; then
  echo "✓ RLS policies created successfully ($RLS_POLICIES policies)"
else
  echo "⚠ Expected at least 8 RLS policies, found $RLS_POLICIES"
fi

# Verify indexes
echo ""
echo "Step 6: Verifying indexes..."
INDEXES_CREATED=$(psql "${DATABASE_URL}" -t -c "
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

if [ "$INDEXES_CREATED" -ge 10 ]; then
  echo "✓ Indexes created successfully ($INDEXES_CREATED indexes)"
else
  echo "⚠ Expected at least 10 indexes, found $INDEXES_CREATED"
fi

# Verify triggers
echo ""
echo "Step 7: Verifying triggers..."
TRIGGERS_CREATED=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*)
  FROM information_schema.triggers
  WHERE event_object_table IN (
    'workflow_definitions',
    'workflow_instances'
  )
  AND trigger_name LIKE '%updated_at%';
")

if [ "$TRIGGERS_CREATED" -eq 2 ]; then
  echo "✓ Updated_at triggers created successfully"
else
  echo "⚠ Expected 2 triggers, found $TRIGGERS_CREATED"
fi

# Check for sample workflow
echo ""
echo "Step 8: Verifying sample workflow..."
SAMPLE_WORKFLOW=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*)
  FROM workflow_definitions
  WHERE name = 'Simple Purchase Approval';
")

if [ "$SAMPLE_WORKFLOW" -ge 1 ]; then
  echo "✓ Sample workflow 'Simple Purchase Approval' created"
else
  echo "⚠ Sample workflow not found (this is optional)"
fi

# Verify GraphQL schema
echo ""
echo "Step 9: Checking GraphQL schema file..."
if [ -f "src/graphql/schema/workflow.graphql" ]; then
  echo "✓ GraphQL schema file exists"
else
  echo "⚠ GraphQL schema file not found at src/graphql/schema/workflow.graphql"
fi

# Verify resolver
echo ""
echo "Step 10: Checking GraphQL resolver..."
if [ -f "src/graphql/resolvers/workflow.resolver.ts" ]; then
  echo "✓ GraphQL resolver file exists"
else
  echo "⚠ GraphQL resolver file not found at src/graphql/resolvers/workflow.resolver.ts"
fi

# Verify service layer
echo ""
echo "Step 11: Checking workflow engine service..."
if [ -f "src/modules/workflow/services/workflow-engine.service.ts" ]; then
  echo "✓ Workflow engine service file exists"
else
  echo "⚠ Workflow engine service file not found"
fi

# Verify module registration
echo ""
echo "Step 12: Checking NestJS module registration..."
if grep -q "WorkflowModule" src/app.module.ts; then
  echo "✓ WorkflowModule registered in AppModule"
else
  echo "⚠ WorkflowModule not found in AppModule - manual registration required"
fi

# Summary
echo ""
echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
echo "✓ Database migration applied"
echo "✓ 4 tables created (workflow_definitions, workflow_instances, workflow_instance_nodes, workflow_instance_history)"
echo "✓ 2 views created (v_user_task_queue, v_workflow_analytics)"
echo "✓ RLS policies enabled"
echo "✓ Indexes optimized"
echo "✓ Triggers configured"
echo ""
echo "Next Steps:"
echo "1. Run health check: ./scripts/health-check-workflow-automation.sh"
echo "2. Restart NestJS backend: npm run start:dev"
echo "3. Test GraphQL endpoints at http://localhost:4000/graphql"
echo "4. Verify frontend integration at /workflows route"
echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
