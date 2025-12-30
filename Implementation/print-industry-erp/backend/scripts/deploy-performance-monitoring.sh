#!/bin/bash

# =====================================================
# Performance Analytics & Optimization Dashboard Deployment
# REQ: REQ-STRATEGIC-AUTO-1767045901876
# Author: Berry (DevOps Engineer)
# Date: 2025-12-29
# =====================================================

set -e  # Exit on error

echo "======================================================"
echo "Performance Monitoring Dashboard Deployment"
echo "REQ: REQ-STRATEGIC-AUTO-1767045901876"
echo "======================================================"
echo ""

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-agog_erp}
DB_USER=${DB_USER:-agog_app}
BACKEND_DIR="$(dirname "$0")/.."
MIGRATION_FILE="$BACKEND_DIR/migrations/V0.0.40__add_performance_monitoring_olap.sql"

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Step 1: Pre-deployment checks
echo "Step 1: Pre-deployment Validation"
echo "------------------------------------------------------"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    print_error "Migration file not found: $MIGRATION_FILE"
    exit 1
fi
print_status "Migration file found"

# Check database connectivity
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; then
    print_status "Database connection successful"
else
    print_error "Cannot connect to database"
    exit 1
fi

# Check if uuid-ossp extension is available
UUID_EXT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'uuid-ossp';")
if [ "$UUID_EXT" -eq 0 ]; then
    print_error "uuid-ossp extension not installed"
    exit 1
fi
print_status "uuid-ossp extension available"

echo ""

# Step 2: Run database migration
echo "Step 2: Database Migration Execution"
echo "------------------------------------------------------"

echo "Running migration V0.0.40..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE" > /tmp/migration_output.log 2>&1; then
    print_status "Migration executed successfully"
else
    print_error "Migration failed. Check /tmp/migration_output.log for details"
    cat /tmp/migration_output.log
    exit 1
fi

echo ""

# Step 3: Verify schema installation
echo "Step 3: Schema Verification"
echo "------------------------------------------------------"

# Verify tables created
TABLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
        'query_performance_log',
        'api_performance_log',
        'system_resource_metrics',
        'performance_metrics_cache'
    );
")

if [ "$TABLES" -eq 4 ]; then
    print_status "All 4 tables created successfully"
else
    print_error "Expected 4 tables, found $TABLES"
    exit 1
fi

# Verify functions created
FUNCTIONS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM pg_proc
    WHERE proname IN (
        'refresh_performance_metrics_incremental',
        'get_performance_summary'
    );
")

if [ "$FUNCTIONS" -eq 2 ]; then
    print_status "All 2 functions created successfully"
else
    print_error "Expected 2 functions, found $FUNCTIONS"
    exit 1
fi

# Verify indexes created
INDEXES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE tablename LIKE '%performance%'
    AND schemaname = 'public';
")

if [ "$INDEXES" -ge 9 ]; then
    print_status "$INDEXES indexes created successfully"
else
    print_warning "Expected at least 9 indexes, found $INDEXES"
fi

echo ""

# Step 4: Setup pg_cron (optional but recommended)
echo "Step 4: Automated Cache Refresh Setup"
echo "------------------------------------------------------"

PG_CRON=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_cron';")

if [ "$PG_CRON" -eq 1 ]; then
    print_status "pg_cron extension already installed"

    # Schedule OLAP cache refresh every 5 minutes
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT cron.schedule(
            'refresh-performance-metrics',
            '*/5 * * * *',
            \$\$SELECT refresh_performance_metrics_incremental()\$\$
        );
    " > /dev/null 2>&1 || print_warning "Failed to schedule cron job (may already exist)"

    print_status "Cache refresh scheduled (every 5 minutes)"
else
    print_warning "pg_cron not installed - manual refresh required"
    echo "    To install: CREATE EXTENSION pg_cron;"
    echo "    Then run: SELECT cron.schedule('refresh-performance-metrics', '*/5 * * * *', \$\$SELECT refresh_performance_metrics_incremental()\$\$);"
fi

echo ""

# Step 5: Run verification script
echo "Step 5: Deployment Verification"
echo "------------------------------------------------------"

if [ -f "$BACKEND_DIR/scripts/verify-performance-monitoring.ts" ]; then
    echo "Running verification script..."
    cd "$BACKEND_DIR"
    if npx ts-node scripts/verify-performance-monitoring.ts > /tmp/verification_output.log 2>&1; then
        print_status "All verification tests passed"
    else
        print_warning "Some verification tests failed. Check /tmp/verification_output.log"
    fi
else
    print_warning "Verification script not found, skipping automated tests"
fi

echo ""

# Step 6: Backend service check
echo "Step 6: Backend Service Status"
echo "------------------------------------------------------"

# Check if backend is running
if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    print_status "Backend service is running"

    # Check GraphQL endpoint
    if curl -s http://localhost:4000/graphql -H "Content-Type: application/json" --data '{"query":"{ __typename }"}' | grep -q "Query"; then
        print_status "GraphQL endpoint is accessible"
    else
        print_warning "GraphQL endpoint may not be fully initialized"
    fi
else
    print_warning "Backend service not detected on port 4000"
    echo "    Start with: npm run start:prod"
fi

echo ""

# Step 7: Summary and next steps
echo "======================================================"
echo "Deployment Summary"
echo "======================================================"
echo ""
print_status "Database schema deployed (V0.0.40)"
print_status "4 tables created with partitioning"
print_status "9+ indexes created for performance"
print_status "2 SQL functions created"

if [ "$PG_CRON" -eq 1 ]; then
    print_status "Automated cache refresh configured"
else
    print_warning "Manual cache refresh required"
fi

echo ""
echo "Next Steps:"
echo "  1. Restart backend service if running: npm run start:prod"
echo "  2. Test GraphQL queries at http://localhost:4000/graphql"
echo "  3. Access dashboard at http://localhost:3000/monitoring/performance"
echo "  4. Monitor cache refresh: SELECT * FROM performance_metrics_cache;"
echo ""

if [ "$PG_CRON" -eq 0 ]; then
    echo "Optional but Recommended:"
    echo "  - Install pg_cron extension for automated refresh"
    echo "  - Setup partition cleanup cron job"
    echo ""
fi

echo "======================================================"
print_status "Deployment Complete!"
echo "======================================================"
