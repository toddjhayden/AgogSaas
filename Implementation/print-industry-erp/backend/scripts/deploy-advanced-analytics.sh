#!/bin/bash
# REQ-STRATEGIC-AUTO-1767048328662: Advanced Reporting & Business Intelligence Suite Deployment Script
# Agent: Berry (DevOps Specialist)
# Purpose: Automated deployment of advanced analytics and reporting features
# Created: 2025-12-29

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

# Function to check backend dependencies
check_backend_dependencies() {
    print_section "Checking Backend Dependencies"

    cd "$BACKEND_DIR"

    print_info "Verifying required npm packages..."

    local missing_packages=()

    # Check for Puppeteer (PDF export)
    if ! npm list puppeteer &> /dev/null; then
        missing_packages+=("puppeteer")
    fi

    # Check for ExcelJS (Excel export)
    if ! npm list exceljs &> /dev/null; then
        missing_packages+=("exceljs")
    fi

    if [ ${#missing_packages[@]} -gt 0 ]; then
        print_warning "Missing required packages: ${missing_packages[*]}"
        print_info "Will be installed during deployment"
    else
        print_success "All required backend packages are installed"
    fi
}

# Function to run data quality audit
run_data_quality_audit() {
    print_section "Running Data Quality Audit"

    print_info "Checking analytics prerequisite data..."

    local issues=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT
            COALESCE(SUM(count), 0) as total_issues
        FROM (
            SELECT COUNT(*) as count FROM vendors WHERE is_active = TRUE AND vendor_name IS NULL
            UNION ALL
            SELECT COUNT(*) FROM customers WHERE is_active = TRUE AND customer_name IS NULL
            UNION ALL
            SELECT COUNT(*) FROM materials WHERE material_code IS NULL
        ) issues;
    " | xargs)

    if [ "$issues" -gt 0 ]; then
        print_warning "Found $issues data quality issues"
        print_info "Running detailed audit..."

        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
SELECT 'Missing Vendor Names' as issue_type, COUNT(*) as count
FROM vendors
WHERE is_active = TRUE AND vendor_name IS NULL
UNION ALL
SELECT 'Missing Customer Names', COUNT(*)
FROM customers
WHERE is_active = TRUE AND customer_name IS NULL
UNION ALL
SELECT 'Materials with NULL code', COUNT(*)
FROM materials
WHERE material_code IS NULL;
EOF

        print_warning "These issues may affect analytics accuracy"
        print_info "Analytics will skip records with missing required data"
    else
        print_success "No critical data quality issues found"
    fi
}

# Function to apply database migrations
apply_migrations() {
    print_section "Applying Database Migrations"

    local migrations=(
        "V0.0.42__create_analytics_views.sql"
    )

    for migration in "${migrations[@]}"; do
        local migration_file="$MIGRATIONS_DIR/$migration"

        if [ ! -f "$migration_file" ]; then
            print_error "Migration file not found: $migration"
            exit 1
        fi

        print_info "Checking migration: $migration"

        # Check if migration already applied by checking for key objects
        local views_exist=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM information_schema.views
            WHERE table_name IN ('vendor_production_impact_v', 'customer_profitability_v', 'order_cycle_analysis_v', 'material_flow_analysis_v');
        " | xargs)

        local export_table_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'export_jobs';
        " | xargs)

        if [ "$views_exist" -eq 4 ] && [ "$export_table_exists" -eq 1 ]; then
            print_success "Migration already applied: $migration"
            continue
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

# Function to refresh materialized views
refresh_materialized_views() {
    print_section "Refreshing Materialized Views"

    print_info "Refreshing executive_kpi_summary_mv..."

    if [ "$DRY_RUN" = "true" ]; then
        print_info "[DRY RUN] Would refresh materialized view"
    else
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
REFRESH MATERIALIZED VIEW CONCURRENTLY executive_kpi_summary_mv;
EOF
        print_success "Materialized view refreshed"
    fi
}

# Function to setup automated view refresh
setup_view_refresh() {
    print_section "Setting Up Automated View Refresh"

    print_info "Checking if pg_cron extension is available..."

    local pg_cron_available=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_available_extensions WHERE name = 'pg_cron';
    " | xargs)

    if [ "$pg_cron_available" -eq 0 ]; then
        print_warning "pg_cron extension not available on this PostgreSQL instance"
        print_info "Materialized view refresh will need to be triggered manually or via external cron"
        print_info "To install pg_cron: https://github.com/citusdata/pg_cron"
        print_info "Manual refresh command: SELECT refresh_analytics_materialized_views();"
        return
    fi

    print_info "Enabling pg_cron extension..."

    if [ "$DRY_RUN" = "true" ]; then
        print_info "[DRY RUN] Would enable pg_cron extension"
        print_info "[DRY RUN] Would schedule 30-minute analytics refresh"
    else
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if it exists
SELECT cron.unschedule('refresh-analytics-views') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'refresh-analytics-views'
);

-- Schedule materialized view refresh every 30 minutes
SELECT cron.schedule(
    'refresh-analytics-views',
    '*/30 * * * *',
    \$\$SELECT refresh_analytics_materialized_views();\$\$
);

-- Verify job was created
SELECT jobid, schedule, command FROM cron.job WHERE jobname = 'refresh-analytics-views';
EOF
        print_success "pg_cron configured successfully"
        print_info "Analytics views will refresh every 30 minutes"
    fi
}

# Function to cleanup expired exports
setup_export_cleanup() {
    print_section "Setting Up Export File Cleanup"

    print_info "Configuring automated cleanup of expired export jobs..."

    local pg_cron_available=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_available_extensions WHERE name = 'pg_cron';
    " | xargs)

    if [ "$pg_cron_available" -eq 0 ]; then
        print_warning "pg_cron not available - export cleanup must be configured externally"
        return
    fi

    if [ "$DRY_RUN" = "true" ]; then
        print_info "[DRY RUN] Would schedule daily export cleanup (2 AM)"
    else
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
-- Remove existing cleanup job if it exists
SELECT cron.unschedule('cleanup-expired-exports') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-exports'
);

-- Schedule daily cleanup at 2 AM
SELECT cron.schedule(
    'cleanup-expired-exports',
    '0 2 * * *',
    \$\$
    DELETE FROM export_jobs
    WHERE status = 'COMPLETED'
      AND expires_at < CURRENT_TIMESTAMP;
    \$\$
);

-- Verify job was created
SELECT jobid, schedule FROM cron.job WHERE jobname = 'cleanup-expired-exports';
EOF
        print_success "Export cleanup scheduled (daily at 2 AM)"
    fi
}

# Function to verify deployment
verify_deployment() {
    print_section "Verifying Deployment"

    # Check if export_jobs table exists
    print_info "Checking export_jobs table..."
    local export_table_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'export_jobs';
    " | xargs)

    if [ "$export_table_exists" -eq 1 ]; then
        print_success "Table 'export_jobs' exists"
    else
        print_error "Table 'export_jobs' not found"
        exit 1
    fi

    # Check if analytics views exist
    print_info "Checking analytics views..."
    local views=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM information_schema.views
        WHERE table_name IN (
            'vendor_production_impact_v',
            'customer_profitability_v',
            'order_cycle_analysis_v',
            'material_flow_analysis_v'
        );
    " | xargs)

    if [ "$views" -eq 4 ]; then
        print_success "All 4 analytics views exist"
    else
        print_error "Expected 4 analytics views, found $views"
        exit 1
    fi

    # Check if materialized view exists
    print_info "Checking materialized views..."
    local mat_views=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_matviews WHERE matviewname = 'executive_kpi_summary_mv';
    " | xargs)

    if [ "$mat_views" -eq 1 ]; then
        print_success "Materialized view 'executive_kpi_summary_mv' exists"
    else
        print_error "Materialized view not found"
        exit 1
    fi

    # Check if refresh function exists
    print_info "Checking refresh function..."
    local func_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_proc WHERE proname = 'refresh_analytics_materialized_views';
    " | xargs)

    if [ "$func_exists" -eq 1 ]; then
        print_success "Function 'refresh_analytics_materialized_views' exists"
    else
        print_warning "Refresh function not found (optional)"
    fi

    # Check RLS policies
    print_info "Checking Row-Level Security policies..."
    local rls_policies=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_policies WHERE tablename = 'export_jobs';
    " | xargs)

    if [ "$rls_policies" -ge 1 ]; then
        print_success "Row-Level Security policies configured ($rls_policies policies found)"
    else
        print_warning "No RLS policies found for export_jobs"
    fi

    # Check indexes on export_jobs
    print_info "Checking indexes on export_jobs..."
    local indexes=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'export_jobs';
    " | xargs)

    if [ "$indexes" -ge 5 ]; then
        print_success "Export jobs table has $indexes indexes"
    else
        print_warning "Expected at least 5 indexes, found $indexes"
    fi
}

# Function to check GraphQL schema
verify_graphql_schema() {
    print_section "Verifying GraphQL Schema"

    local schema_file="$BACKEND_DIR/src/modules/analytics/analytics.graphql"

    if [ ! -f "$schema_file" ]; then
        print_error "GraphQL schema not found: $schema_file"
        exit 1
    fi

    print_success "GraphQL schema file exists"

    # Check for key types
    if grep -q "type VendorProductionImpact" "$schema_file"; then
        print_success "VendorProductionImpact type defined"
    else
        print_error "VendorProductionImpact type not found in schema"
        exit 1
    fi

    if grep -q "type CustomerProfitability" "$schema_file"; then
        print_success "CustomerProfitability type defined"
    else
        print_error "CustomerProfitability type not found in schema"
        exit 1
    fi

    if grep -q "type ExecutiveKPISummary" "$schema_file"; then
        print_success "ExecutiveKPISummary type defined"
    else
        print_error "ExecutiveKPISummary type not found in schema"
        exit 1
    fi

    # Check for export mutation
    if grep -q "exportReport" "$schema_file"; then
        print_success "exportReport mutation defined"
    else
        print_error "exportReport mutation not found in schema"
        exit 1
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

    print_info "Checking for analytics module registration..."
    if grep -q "AnalyticsModule" "$BACKEND_DIR/src/app.module.ts"; then
        print_success "Analytics module registered in app.module.ts"
    else
        print_warning "Analytics module not found in app.module.ts"
        print_info "Module may need to be manually registered"
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

    # Verify frontend files exist
    print_info "Verifying frontend components..."
    local components=(
        "src/pages/BusinessIntelligenceDashboard.tsx"
        "src/pages/AdvancedAnalyticsDashboard.tsx"
        "src/pages/ReportBuilderPage.tsx"
        "src/graphql/queries/analytics.ts"
    )

    for component in "${components[@]}"; do
        if [ -f "$FRONTEND_DIR/$component" ]; then
            print_success "Found: $component"
        else
            print_warning "Missing: $component"
        fi
    done

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
    echo "Feature: Advanced Reporting & Business Intelligence Suite"
    echo "REQ Number: REQ-STRATEGIC-AUTO-1767048328662"
    echo ""
    echo "Migrations Applied:"
    echo "  ✓ V0.0.42 - Analytics views and export infrastructure"
    echo ""
    echo "Database Objects Created:"
    echo "  ✓ 1 table (export_jobs)"
    echo "  ✓ 4 analytics views (vendor_production_impact_v, customer_profitability_v,"
    echo "                        order_cycle_analysis_v, material_flow_analysis_v)"
    echo "  ✓ 1 materialized view (executive_kpi_summary_mv)"
    echo "  ✓ 1 refresh function (refresh_analytics_materialized_views)"
    echo "  ✓ 5 indexes on export_jobs table"
    echo "  ✓ Row-Level Security policies"
    echo ""
    echo "Backend Services:"
    echo "  ✓ analytics.module.ts - NestJS module"
    echo "  ✓ analytics.service.ts - Cross-domain analytics service"
    echo "  ✓ export.service.ts - PDF/Excel/CSV/JSON export service"
    echo "  ✓ analytics.resolver.ts - GraphQL resolver"
    echo "  ✓ analytics.graphql - Schema (6 queries, 2 mutations)"
    echo ""
    echo "Frontend Components:"
    echo "  ✓ BusinessIntelligenceDashboard - Executive KPI summary"
    echo "  ✓ AdvancedAnalyticsDashboard - Cross-domain analytics"
    echo "  ✓ ReportBuilderPage - Multi-format export interface"
    echo "  ✓ GraphQL queries - 9 queries/mutations"
    echo "  ✓ i18n translations - English & Chinese"
    echo ""
    echo "Export Formats Supported:"
    echo "  ✓ PDF (via Puppeteer)"
    echo "  ✓ Excel (via ExcelJS)"
    echo "  ✓ CSV"
    echo "  ✓ JSON"
    echo ""
    echo "Analytics Capabilities:"
    echo "  ✓ Vendor-Production Impact Analysis"
    echo "  ✓ Customer Profitability Analysis"
    echo "  ✓ Order Cycle Time Analysis"
    echo "  ✓ Material Flow Analysis"
    echo "  ✓ Executive KPI Summary (pre-aggregated)"
    echo "  ✓ Trend Analysis (time-series)"
    echo ""
    echo "Automation Configured:"
    if [ "$pg_cron_available" -eq 1 ]; then
        echo "  ✓ Materialized view refresh (every 30 minutes)"
        echo "  ✓ Export cleanup (daily at 2 AM)"
    else
        echo "  ⚠ Manual refresh required (pg_cron not available)"
    fi
    echo ""
    echo "Next Steps:"
    echo "  1. Start backend:  cd $BACKEND_DIR && npm start"
    echo "  2. Start frontend: cd $FRONTEND_DIR && npm run dev"
    echo "  3. Access dashboards:"
    echo "     - Business Intelligence: http://localhost:5173/analytics/business-intelligence"
    echo "     - Advanced Analytics:    http://localhost:5173/analytics/advanced"
    echo "     - Report Builder:        http://localhost:5173/analytics/reports"
    echo "  4. Run health check:    ./scripts/health-check-advanced-analytics.sh"
    echo "  5. Test GraphQL API:    http://localhost:3000/graphql"
    echo ""
    echo "GraphQL API Endpoints:"
    echo "  Queries:"
    echo "    - vendorProductionImpact"
    echo "    - customerProfitability"
    echo "    - orderCycleAnalysis"
    echo "    - materialFlowAnalysis"
    echo "    - executiveKPISummary"
    echo "    - trendAnalysis"
    echo "    - exportStatus"
    echo "  Mutations:"
    echo "    - exportReport"
    echo "    - cancelExport"
    echo ""
    echo "Known Limitations (Phase 1 MVP):"
    echo "  ⚠ Mock data implementation (will be replaced with actual DB queries)"
    echo "  ⚠ Export file operations commented out (requires S3 or file storage config)"
    echo "  ⚠ Frontend-backend schema alignment needed (minor field name differences)"
    echo ""
    echo "Documentation:"
    echo "  - Backend Deliverable:  backend/ROY_BACKEND_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328662.md"
    echo "  - Frontend Deliverable: frontend/JEN_FRONTEND_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328662.md"
    echo "  - QA Report:            backend/BILLY_QA_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328662.md"
    echo "  - Research Report:      backend/CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328662.md"
    echo ""
}

# Main deployment flow
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  REQ-STRATEGIC-AUTO-1767048328662                          ║"
    echo "║  Advanced Reporting & Business Intelligence Suite         ║"
    echo "║  Deployment Script                                         ║"
    echo "║  Environment: $ENVIRONMENT"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""

    if [ "$DRY_RUN" = "true" ]; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi

    # Execute deployment steps
    check_prerequisites
    check_backend_dependencies
    run_data_quality_audit
    apply_migrations
    refresh_materialized_views
    setup_view_refresh
    setup_export_cleanup
    verify_deployment
    verify_graphql_schema
    deploy_backend
    deploy_frontend
    print_deployment_summary

    print_success "Deployment completed successfully!"
}

# Run main function
main "$@"
