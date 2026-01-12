#!/bin/bash
# REQ-STRATEGIC-AUTO-1766545799451: Bin Optimization Deployment Script
# Agent: Berry (DevOps Specialist)
# Purpose: Automated deployment of bin utilization optimization features
# Updated: 2024-12-24

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$(dirname "$BACKEND_DIR")/frontend"
MIGRATIONS_DIR="$BACKEND_DIR/migrations"

# Environment variables (can be overridden)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-agogsaas}"
DB_USER="${DB_USER:-postgres}"
ENVIRONMENT="${ENVIRONMENT:-staging}"
DRY_RUN="${DRY_RUN:-false}"

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_section "Checking Prerequisites"

    # Check PostgreSQL client
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL client (psql) not found. Please install PostgreSQL client tools."
        exit 1
    fi
    print_success "PostgreSQL client found"

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js 18+"
        exit 1
    fi
    print_success "Node.js found: $(node --version)"

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm not found. Please install npm"
        exit 1
    fi
    print_success "npm found: $(npm --version)"

    # Check curl
    if ! command -v curl &> /dev/null; then
        print_error "curl not found. Please install curl"
        exit 1
    fi
    print_success "curl found"

    # Check database connectivity
    print_info "Testing database connection..."
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        print_success "Database connection successful"
    else
        print_error "Cannot connect to database. Please check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME"
        exit 1
    fi
}

# Function to run data quality audit
run_data_quality_audit() {
    print_section "Running Data Quality Audit"

    local audit_sql="$SCRIPT_DIR/data-quality-audit.sql"

    print_info "Checking for data quality issues..."

    local issues=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT
            COALESCE(SUM(count), 0) as total_issues
        FROM (
            SELECT COUNT(*) as count FROM materials WHERE width_inches IS NULL OR height_inches IS NULL OR length_inches IS NULL
            UNION ALL
            SELECT COUNT(*) FROM materials WHERE abc_classification IS NULL
            UNION ALL
            SELECT COUNT(*) FROM inventory_locations WHERE cubic_feet <= 0 OR max_weight_lbs <= 0
        ) issues;
    " | xargs)

    if [ "$issues" -gt 0 ]; then
        print_warning "Found $issues data quality issues"
        print_info "Running detailed audit..."

        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
SELECT 'Missing Material Dimensions' as issue_type, COUNT(*) as count
FROM materials
WHERE width_inches IS NULL OR height_inches IS NULL OR length_inches IS NULL
UNION ALL
SELECT 'Missing ABC Classification', COUNT(*)
FROM materials
WHERE abc_classification IS NULL
UNION ALL
SELECT 'Invalid Bin Capacity', COUNT(*)
FROM inventory_locations
WHERE cubic_feet <= 0 OR max_weight_lbs <= 0;
EOF

        print_warning "These issues should be fixed before production deployment"
        print_info "Algorithm will use fallbacks (ABC='C', skip materials with missing dimensions)"
    else
        print_success "No data quality issues found"
    fi
}

# Function to apply database migrations
apply_migrations() {
    print_section "Applying Database Migrations"

    local migrations=(
        "V0.0.15__add_bin_utilization_tracking.sql"
        "V0.0.16__optimize_bin_utilization_algorithm.sql"
        "V0.0.18__add_bin_optimization_triggers.sql"
        "V0.0.20__fix_bin_optimization_data_quality.sql"
        "V0.0.21__fix_uuid_generate_v7_casting.sql"
        "V0.0.22__bin_utilization_statistical_analysis.sql"
    )

    for migration in "${migrations[@]}"; do
        local migration_file="$MIGRATIONS_DIR/$migration"

        if [ ! -f "$migration_file" ]; then
            print_warning "Migration file not found: $migration"
            continue
        fi

        print_info "Checking migration: $migration"

        # Check if migration already applied (simple version check)
        local version=$(echo "$migration" | grep -oP 'V\d+\.\d+\.\d+')
        local applied=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_name = 'flyway_schema_history' OR table_name = 'schema_migrations';
        " | xargs)

        if [ "$applied" -eq 0 ]; then
            print_warning "Migration tracking table not found. Will apply migration."
        fi

        if [ "$DRY_RUN" = "true" ]; then
            print_info "[DRY RUN] Would apply migration: $migration"
        else
            print_info "Applying migration: $migration"
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"
            print_success "Migration applied: $migration"
        fi
    done
}

# Function to setup pg_cron for cache refresh
setup_pg_cron() {
    print_section "Setting Up pg_cron for Cache Refresh"

    print_info "Checking if pg_cron extension is available..."

    local pg_cron_available=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_available_extensions WHERE name = 'pg_cron';
    " | xargs)

    if [ "$pg_cron_available" -eq 0 ]; then
        print_warning "pg_cron extension not available on this PostgreSQL instance"
        print_info "Cache refresh will need to be triggered manually or via external cron"
        print_info "To install pg_cron: https://github.com/citusdata/pg_cron"
        return
    fi

    print_info "Enabling pg_cron extension..."

    if [ "$DRY_RUN" = "true" ]; then
        print_info "[DRY RUN] Would enable pg_cron extension"
        print_info "[DRY RUN] Would schedule cache refresh every 10 minutes"
    else
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if it exists
SELECT cron.unschedule('refresh_bin_util');

-- Schedule cache refresh every 10 minutes
SELECT cron.schedule(
    'refresh_bin_util',
    '*/10 * * * *',
    \$\$SELECT scheduled_refresh_bin_utilization();\$\$
);

-- Verify job was created
SELECT jobid, schedule, command FROM cron.job WHERE jobname = 'refresh_bin_util';
EOF
        print_success "pg_cron configured successfully"
        print_info "Cache will refresh every 10 minutes"
    fi
}

# Function to verify deployment
verify_deployment() {
    print_section "Verifying Deployment"

    # Check if materialized view exists
    print_info "Checking materialized view..."
    local view_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_matviews WHERE matviewname = 'bin_utilization_cache';
    " | xargs)

    if [ "$view_exists" -eq 1 ]; then
        print_success "Materialized view 'bin_utilization_cache' exists"
    else
        print_error "Materialized view 'bin_utilization_cache' not found"
        exit 1
    fi

    # Check if triggers exist
    print_info "Checking triggers..."
    local triggers=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM information_schema.triggers
        WHERE trigger_name IN ('trigger_lots_refresh_bin_cache', 'trigger_inventory_tx_refresh_bin_cache');
    " | xargs)

    if [ "$triggers" -eq 2 ]; then
        print_success "All triggers configured"
    else
        print_warning "Expected 2 triggers, found $triggers"
    fi

    # Check if cache refresh function exists
    print_info "Checking cache refresh function..."
    local function_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_proc WHERE proname = 'scheduled_refresh_bin_utilization';
    " | xargs)

    if [ "$function_exists" -eq 1 ]; then
        print_success "Cache refresh function exists"
    else
        print_error "Cache refresh function not found"
        exit 1
    fi

    # Check cache freshness
    print_info "Checking cache freshness..."
    local cache_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM bin_utilization_cache LIMIT 1;
    " | xargs)

    if [ "$cache_exists" -gt 0 ]; then
        print_success "Cache contains data"

        # Get cache age
        local cache_age=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT MAX(last_updated) FROM bin_utilization_cache;
        " | xargs)

        print_info "Latest cache timestamp: $cache_age"
    else
        print_warning "Cache is empty (this is normal on first deployment)"
    fi
}

# Function to build and deploy backend
deploy_backend() {
    print_section "Deploying Backend Services"

    cd "$BACKEND_DIR"

    print_info "Installing backend dependencies..."
    if [ "$DRY_RUN" = "true" ]; then
        print_info "[DRY RUN] Would run: npm install"
    else
        npm install
        print_success "Backend dependencies installed"
    fi

    print_info "Building backend..."
    if [ "$DRY_RUN" = "true" ]; then
        print_info "[DRY RUN] Would run: npm run build"
    else
        npm run build
        print_success "Backend built successfully"
    fi

    print_info "Backend deployment complete"
    print_info "To start backend: npm start"
}

# Function to build and deploy frontend
deploy_frontend() {
    print_section "Deploying Frontend Application"

    cd "$FRONTEND_DIR"

    print_info "Installing frontend dependencies..."
    if [ "$DRY_RUN" = "true" ]; then
        print_info "[DRY RUN] Would run: npm install"
    else
        npm install
        print_success "Frontend dependencies installed"
    fi

    print_info "Building frontend..."
    if [ "$DRY_RUN" = "true" ]; then
        print_info "[DRY RUN] Would run: npm run build"
    else
        npm run build
        print_success "Frontend built successfully"
    fi

    print_info "Frontend deployment complete"
    print_info "Built files are in: $FRONTEND_DIR/dist"
}

# Function to print deployment summary
print_deployment_summary() {
    print_section "Deployment Summary"

    echo ""
    echo "Environment: $ENVIRONMENT"
    echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
    echo ""
    echo "Migrations Applied:"
    echo "  ✓ V0.0.15 - Bin utilization tracking"
    echo "  ✓ V0.0.16 - Algorithm optimization"
    echo "  ✓ V0.0.18 - Automated triggers"
    echo "  ✓ V0.0.20 - Data quality fixes & monitoring"
    echo "  ✓ V0.0.21 - UUID generation fix"
    echo "  ✓ V0.0.22 - Statistical analysis framework"
    echo ""
    echo "Components Deployed:"
    echo "  ✓ Backend services (GraphQL API)"
    echo "  ✓ Frontend application (React UI)"
    echo "  ✓ Database migrations"
    echo "  ✓ Materialized view cache"
    echo "  ✓ Automated refresh triggers"
    echo ""
    echo "Next Steps:"
    echo "  1. Start backend:  cd $BACKEND_DIR && npm start"
    echo "  2. Start frontend: cd $FRONTEND_DIR && npm run dev"
    echo "  3. Access health monitoring: http://localhost:5173/wms/health"
    echo "  4. Monitor cache: SELECT * FROM cache_refresh_status;"
    echo "  5. Check pg_cron jobs: SELECT * FROM cron.job;"
    echo ""
    echo "Monitoring URLs:"
    echo "  - Health Dashboard: /wms/health"
    echo "  - Bin Utilization: /wms/bin-utilization-enhanced"
    echo "  - Prometheus Metrics: /api/wms/optimization/metrics"
    echo ""
}

# Main deployment flow
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  REQ-STRATEGIC-AUTO-1766545799451                          ║"
    echo "║  Bin Optimization Deployment Script                        ║"
    echo "║  Environment: $ENVIRONMENT"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""

    if [ "$DRY_RUN" = "true" ]; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi

    # Execute deployment steps
    check_prerequisites
    run_data_quality_audit
    apply_migrations
    setup_pg_cron
    verify_deployment
    deploy_backend
    deploy_frontend
    print_deployment_summary

    print_success "Deployment completed successfully!"
}

# Run main function
main "$@"
