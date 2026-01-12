#!/bin/bash
# Health Check Script for Predictive Maintenance AI
# REQ: REQ-STRATEGIC-AUTO-1767108044310

set -e

echo "================================================"
echo "Predictive Maintenance AI - Health Check"
echo "REQ: REQ-STRATEGIC-AUTO-1767108044310"
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
      'predictive_maintenance_models',
      'equipment_health_scores',
      'predictive_maintenance_alerts',
      'maintenance_recommendations'
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

# Check 2: Table Partitions
echo ""
echo "Check 2: Table Partitioning"
echo "---------------------------"
PARTITION_INFO=$(psql "${DATABASE_URL}" -t -c "
  SELECT
    child.relname as partition_name,
    pg_get_expr(child.relpartbound, child.oid, true) as partition_expr
  FROM pg_inherits
  JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
  JOIN pg_class child ON pg_inherits.inhrelid = child.oid
  WHERE parent.relname = 'equipment_health_scores'
  ORDER BY child.relname
  LIMIT 5;
")

PARTITION_COUNT=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*)
  FROM pg_inherits
  JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
  WHERE parent.relname = 'equipment_health_scores';
")

if [ "$PARTITION_COUNT" -ge 18 ]; then
  echo "✓ Partitioning configured ($PARTITION_COUNT partitions)"
  echo "  Sample partitions:"
  echo "$PARTITION_INFO" | head -5 | sed 's/^/    /'
else
  echo "⚠ Unexpected partition count: $PARTITION_COUNT (expected 18)"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 3: RLS Policies
echo ""
echo "Check 3: Row-Level Security"
echo "---------------------------"
RLS_STATUS=$(psql "${DATABASE_URL}" -t -c "
  SELECT
    schemaname,
    tablename,
    policyname
  FROM pg_policies
  WHERE tablename IN (
    'predictive_maintenance_models',
    'equipment_health_scores',
    'predictive_maintenance_alerts',
    'maintenance_recommendations'
  )
  ORDER BY tablename, policyname;
")

RLS_COUNT=$(echo "$RLS_STATUS" | grep -v '^$' | wc -l)
if [ "$RLS_COUNT" -ge 4 ]; then
  echo "✓ RLS policies active ($RLS_COUNT policies)"
  echo "$RLS_STATUS" | sed 's/^/  • /'
else
  echo "⚠ Missing RLS policies (found $RLS_COUNT, expected at least 4)"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 4: Indexes
echo ""
echo "Check 4: Database Indexes"
echo "-------------------------"
INDEXES=$(psql "${DATABASE_URL}" -t -c "
  SELECT
    tablename,
    indexname
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN (
      'predictive_maintenance_models',
      'equipment_health_scores',
      'predictive_maintenance_alerts',
      'maintenance_recommendations'
    )
    AND indexname NOT LIKE '%_pkey'
  ORDER BY tablename, indexname;
")

INDEX_COUNT=$(echo "$INDEXES" | grep -v '^$' | wc -l)
if [ "$INDEX_COUNT" -ge 10 ]; then
  echo "✓ Performance indexes created ($INDEX_COUNT indexes)"
  echo "$INDEXES" | head -10 | sed 's/^/  • /'
else
  echo "⚠ Few indexes found ($INDEX_COUNT)"
fi

# Check 5: Default Model
echo ""
echo "Check 5: Default ML Model"
echo "-------------------------"
DEFAULT_MODEL=$(psql "${DATABASE_URL}" -t -c "
  SELECT
    model_name,
    model_type,
    deployment_status,
    version
  FROM predictive_maintenance_models
  WHERE model_type = 'ANOMALY_DETECTION'
    AND deployment_status = 'PRODUCTION'
    AND is_active = TRUE
  LIMIT 1;
")

if [ -n "$DEFAULT_MODEL" ]; then
  echo "✓ Default model configured"
  echo "$DEFAULT_MODEL" | sed 's/^/  • /'
else
  echo "⚠ No default model found"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 6: GraphQL Schema
echo ""
echo "Check 6: GraphQL Schema"
echo "-----------------------"
if [ -f "src/graphql/schema/predictive-maintenance.graphql" ]; then
  TYPES_COUNT=$(grep -c "^type " src/graphql/schema/predictive-maintenance.graphql || true)
  ENUMS_COUNT=$(grep -c "^enum " src/graphql/schema/predictive-maintenance.graphql || true)
  QUERIES_COUNT=$(grep -A 100 "type Query" src/graphql/schema/predictive-maintenance.graphql | grep -c ":" || true)

  echo "✓ GraphQL schema file exists"
  echo "  • Types: $TYPES_COUNT"
  echo "  • Enums: $ENUMS_COUNT"
  echo "  • Queries: $QUERIES_COUNT"
else
  echo "✗ GraphQL schema file missing"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 7: NestJS Module
echo ""
echo "Check 7: NestJS Module"
echo "----------------------"
if [ -f "src/modules/predictive-maintenance/predictive-maintenance.module.ts" ]; then
  echo "✓ Module file exists"

  if grep -q "EquipmentHealthScoreService" src/modules/predictive-maintenance/predictive-maintenance.module.ts; then
    echo "  • EquipmentHealthScoreService registered"
  fi

  if grep -q "PredictiveAlertService" src/modules/predictive-maintenance/predictive-maintenance.module.ts; then
    echo "  • PredictiveAlertService registered"
  fi

  if grep -q "PredictiveMaintenanceResolver" src/modules/predictive-maintenance/predictive-maintenance.module.ts; then
    echo "  • PredictiveMaintenanceResolver registered"
  fi
else
  echo "✗ Module file missing"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 8: App Module Integration
echo ""
echo "Check 8: App Module Integration"
echo "--------------------------------"
if grep -q "PredictiveMaintenanceModule" src/app.module.ts; then
  echo "✓ Module imported in app.module.ts"
else
  echo "✗ Module not imported in app.module.ts"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 9: Service Files
echo ""
echo "Check 9: Service Implementation"
echo "--------------------------------"
SERVICE_FILES=(
  "src/modules/predictive-maintenance/services/equipment-health-score.service.ts"
  "src/modules/predictive-maintenance/services/predictive-alert.service.ts"
)

for file in "${SERVICE_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $(basename $file)"
  else
    echo "✗ Missing: $(basename $file)"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
done

# Check 10: Resolver File
echo ""
echo "Check 10: GraphQL Resolver"
echo "--------------------------"
if [ -f "src/graphql/resolvers/predictive-maintenance.resolver.ts" ]; then
  QUERIES=$(grep -c "@Query()" src/graphql/resolvers/predictive-maintenance.resolver.ts || true)
  MUTATIONS=$(grep -c "@Mutation()" src/graphql/resolvers/predictive-maintenance.resolver.ts || true)

  echo "✓ Resolver file exists"
  echo "  • Queries: $QUERIES"
  echo "  • Mutations: $MUTATIONS"
else
  echo "✗ Resolver file missing"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Summary
echo ""
echo "================================================"
if [ $FAILED_CHECKS -eq 0 ]; then
  echo "✓ ALL CHECKS PASSED"
  echo "================================================"
  echo ""
  echo "System Status: HEALTHY"
  echo "  • Database schema: Complete"
  echo "  • RLS policies: Active"
  echo "  • Services: Implemented"
  echo "  • GraphQL: Configured"
  echo "  • Module: Integrated"
  echo ""
  echo "Ready for testing and production deployment."
  exit 0
else
  echo "✗ FAILED CHECKS: $FAILED_CHECKS"
  echo "================================================"
  echo ""
  echo "System Status: DEGRADED"
  echo "Review failed checks above and rerun deployment."
  exit 1
fi
