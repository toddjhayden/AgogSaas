#!/bin/bash
# Deployment Script for Predictive Maintenance AI
# REQ: REQ-STRATEGIC-AUTO-1767108044310

set -e

echo "======================================"
echo "Predictive Maintenance AI Deployment"
echo "REQ: REQ-STRATEGIC-AUTO-1767108044310"
echo "======================================"
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
echo "Applying V0.0.62__create_predictive_maintenance_tables.sql"
psql "${DATABASE_URL}" -f migrations/V0.0.62__create_predictive_maintenance_tables.sql
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
      'predictive_maintenance_models',
      'equipment_health_scores',
      'predictive_maintenance_alerts',
      'maintenance_recommendations'
    );
")

if [ "$TABLES_CREATED" -eq 4 ]; then
  echo "✓ All 4 tables created successfully"
else
  echo "✗ Table creation incomplete (found $TABLES_CREATED/4 tables)"
  exit 1
fi

# Verify partitions
echo ""
echo "Step 4: Verifying table partitioning..."
PARTITIONS_CREATED=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*)
  FROM pg_inherits
  JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
  WHERE parent.relname = 'equipment_health_scores';
")

if [ "$PARTITIONS_CREATED" -ge 18 ]; then
  echo "✓ Table partitions created successfully ($PARTITIONS_CREATED partitions)"
else
  echo "⚠ Expected 18 partitions, found $PARTITIONS_CREATED"
fi

# Verify RLS policies
echo ""
echo "Step 5: Verifying RLS policies..."
RLS_POLICIES=$(psql "${DATABASE_URL}" -t -c "
  SELECT COUNT(*)
  FROM pg_policies
  WHERE tablename IN (
    'predictive_maintenance_models',
    'equipment_health_scores',
    'predictive_maintenance_alerts',
    'maintenance_recommendations'
  );
")

if [ "$RLS_POLICIES" -ge 4 ]; then
  echo "✓ RLS policies created successfully ($RLS_POLICIES policies)"
else
  echo "⚠ Expected at least 4 RLS policies, found $RLS_POLICIES"
fi

# Insert default ML model configuration
echo ""
echo "Step 6: Creating default rule-based model..."
psql "${DATABASE_URL}" << EOF
  INSERT INTO predictive_maintenance_models (
    tenant_id,
    facility_id,
    model_name,
    model_type,
    ml_algorithm,
    version,
    deployment_status,
    sensor_weight,
    oee_weight,
    quality_weight,
    reliability_weight,
    performance_weight,
    is_active,
    description
  ) VALUES (
    'default-tenant',
    'default-facility',
    'Rule-Based Health Score Calculator',
    'ANOMALY_DETECTION',
    'RULE_BASED',
    '1.0',
    'PRODUCTION',
    0.30,
    0.25,
    0.20,
    0.15,
    0.10,
    TRUE,
    'Initial rule-based model for calculating equipment health scores across 5 dimensions'
  )
  ON CONFLICT DO NOTHING;
EOF

if [ $? -eq 0 ]; then
  echo "✓ Default model configuration created"
else
  echo "⚠ Default model creation failed (may already exist)"
fi

# Rebuild TypeScript
echo ""
echo "Step 7: Rebuilding NestJS application..."
npm run build
if [ $? -eq 0 ]; then
  echo "✓ Application build successful"
else
  echo "✗ Application build failed"
  exit 1
fi

echo ""
echo "======================================"
echo "✓ Deployment Complete!"
echo "======================================"
echo ""
echo "Summary:"
echo "  • Migration: V0.0.62 applied"
echo "  • Tables: 4 created with partitioning"
echo "  • RLS Policies: $RLS_POLICIES active"
echo "  • Default Model: Rule-Based Health Score Calculator"
echo ""
echo "Next Steps:"
echo "  1. Run health check: ./scripts/health-check-predictive-maintenance.sh"
echo "  2. Restart application to load new module"
echo "  3. Test GraphQL endpoints"
echo ""
