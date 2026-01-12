#!/bin/bash
# =====================================================
# PDF PREFLIGHT & COLOR MANAGEMENT HEALTH CHECK SCRIPT
# =====================================================
# REQ: REQ-STRATEGIC-AUTO-1767066329942
# Description: Health check script for PDF Preflight & Color Management module
# Author: Berry (DevOps Agent)
# Date: 2025-12-30
# =====================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNING_CHECKS++))
    ((TOTAL_CHECKS++))
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

print_header() {
    echo -e "\n${BLUE}=====================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=====================================${NC}\n"
}

# Function to check database connectivity
check_database_connectivity() {
    print_header "DATABASE CONNECTIVITY"

    if [ -z "${DATABASE_URL:-}" ]; then
        print_error "DATABASE_URL environment variable is not set"
        return 1
    fi

    if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        print_success "Database connection successful"
    else
        print_error "Cannot connect to database"
        return 1
    fi
}

# Function to check if tables exist
check_tables() {
    print_header "DATABASE TABLES"

    TABLES=(
        "preflight_profiles"
        "preflight_reports"
        "preflight_issues"
        "preflight_artifacts"
        "color_proofs"
        "preflight_audit_log"
    )

    for table in "${TABLES[@]}"; do
        COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '$table'" | tr -d '[:space:]')

        if [ "$COUNT" -eq 1 ]; then
            print_success "Table exists: $table"
        else
            print_error "Table missing: $table"
        fi
    done
}

# Function to check if views exist
check_views() {
    print_header "DATABASE VIEWS"

    VIEWS=(
        "vw_preflight_error_frequency"
        "vw_preflight_pass_rates"
    )

    for view in "${VIEWS[@]}"; do
        COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_name = '$view'" | tr -d '[:space:]')

        if [ "$COUNT" -eq 1 ]; then
            print_success "View exists: $view"
        else
            print_error "View missing: $view"
        fi
    done
}

# Function to check RLS policies
check_rls_policies() {
    print_header "ROW-LEVEL SECURITY POLICIES"

    TABLES=(
        "preflight_profiles"
        "preflight_reports"
        "preflight_issues"
        "preflight_artifacts"
        "color_proofs"
        "preflight_audit_log"
    )

    for table in "${TABLES[@]}"; do
        RLS_ENABLED=$(psql "$DATABASE_URL" -t -c "SELECT relrowsecurity FROM pg_class WHERE relname = '$table'" | tr -d '[:space:]')

        if [ "$RLS_ENABLED" = "t" ]; then
            print_success "RLS enabled on $table"
        else
            print_warning "RLS not enabled on $table"
        fi

        # Check if policies exist
        POLICY_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_policies WHERE tablename = '$table'" | tr -d '[:space:]')

        if [ "$POLICY_COUNT" -gt 0 ]; then
            print_success "$table has $POLICY_COUNT RLS policies"
        else
            print_warning "$table has no RLS policies"
        fi
    done
}

# Function to check indexes
check_indexes() {
    print_header "DATABASE INDEXES"

    # Expected indexes from migration
    INDEXES=(
        "idx_preflight_profiles_tenant"
        "idx_preflight_profiles_type"
        "idx_preflight_profiles_active"
        "idx_preflight_reports_tenant_job"
        "idx_preflight_reports_status"
        "idx_preflight_reports_processed_at"
        "idx_preflight_reports_profile"
        "idx_preflight_reports_file_hash"
        "idx_preflight_issues_report"
        "idx_preflight_issues_severity"
        "idx_preflight_issues_error_code"
        "idx_preflight_artifacts_report"
        "idx_preflight_artifacts_type"
        "idx_preflight_artifacts_storage_tier"
        "idx_color_proofs_tenant_job"
        "idx_color_proofs_type_status"
        "idx_color_proofs_approved_at"
        "idx_preflight_audit_log_report"
        "idx_preflight_audit_log_performed_at"
    )

    INDEX_COUNT=0

    for index in "${INDEXES[@]}"; do
        COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname = '$index'" | tr -d '[:space:]')

        if [ "$COUNT" -eq 1 ]; then
            ((INDEX_COUNT++))
        fi
    done

    if [ "$INDEX_COUNT" -eq ${#INDEXES[@]} ]; then
        print_success "All $INDEX_COUNT expected indexes exist"
    elif [ "$INDEX_COUNT" -gt 0 ]; then
        print_warning "$INDEX_COUNT of ${#INDEXES[@]} expected indexes exist"
    else
        print_error "No expected indexes found"
    fi
}

# Function to check default profiles
check_default_profiles() {
    print_header "DEFAULT PREFLIGHT PROFILES"

    PROFILE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM preflight_profiles WHERE tenant_id = '00000000-0000-0000-0000-000000000000'" | tr -d '[:space:]')

    if [ "$PROFILE_COUNT" -ge 3 ]; then
        print_success "Found $PROFILE_COUNT default profiles (expected: 3)"
    elif [ "$PROFILE_COUNT" -gt 0 ]; then
        print_warning "Found $PROFILE_COUNT default profiles (expected: 3)"
    else
        print_error "No default profiles found"
    fi

    # Check specific profile types
    PROFILE_TYPES=("PDF_X_1A" "PDF_X_3" "PDF_X_4")

    for type in "${PROFILE_TYPES[@]}"; do
        COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM preflight_profiles WHERE profile_type = '$type' AND tenant_id = '00000000-0000-0000-0000-000000000000'" | tr -d '[:space:]')

        if [ "$COUNT" -ge 1 ]; then
            print_success "Found $type profile"
        else
            print_warning "Missing $type profile"
        fi
    done
}

# Function to check data integrity
check_data_integrity() {
    print_header "DATA INTEGRITY"

    # Check for orphaned issues (reports that don't exist)
    ORPHANED_ISSUES=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*)
        FROM preflight_issues pi
        WHERE NOT EXISTS (SELECT 1 FROM preflight_reports pr WHERE pr.id = pi.preflight_report_id)
    " | tr -d '[:space:]')

    if [ "$ORPHANED_ISSUES" -eq 0 ]; then
        print_success "No orphaned preflight issues"
    else
        print_warning "Found $ORPHANED_ISSUES orphaned preflight issues"
    fi

    # Check for orphaned artifacts
    ORPHANED_ARTIFACTS=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*)
        FROM preflight_artifacts pa
        WHERE NOT EXISTS (SELECT 1 FROM preflight_reports pr WHERE pr.id = pa.preflight_report_id)
    " | tr -d '[:space:]')

    if [ "$ORPHANED_ARTIFACTS" -eq 0 ]; then
        print_success "No orphaned preflight artifacts"
    else
        print_warning "Found $ORPHANED_ARTIFACTS orphaned preflight artifacts"
    fi

    # Check for invalid profile references
    INVALID_PROFILE_REFS=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*)
        FROM preflight_reports pr
        WHERE NOT EXISTS (SELECT 1 FROM preflight_profiles pp WHERE pp.id = pr.preflight_profile_id)
    " | tr -d '[:space:]')

    if [ "$INVALID_PROFILE_REFS" -eq 0 ]; then
        print_success "All preflight reports reference valid profiles"
    else
        print_warning "Found $INVALID_PROFILE_REFS reports with invalid profile references"
    fi
}

# Function to check GraphQL schema
check_graphql_schema() {
    print_header "GRAPHQL SCHEMA"

    SCHEMA_FILE="$(dirname "$(dirname "$(realpath "$0")")")/src/graphql/schema/operations.graphql"

    if [ -f "$SCHEMA_FILE" ]; then
        print_success "GraphQL schema file exists"

        # Check for key type definitions
        if grep -q "type PreflightProfile" "$SCHEMA_FILE"; then
            print_success "PreflightProfile type defined"
        else
            print_error "PreflightProfile type missing"
        fi

        if grep -q "type PreflightReport" "$SCHEMA_FILE"; then
            print_success "PreflightReport type defined"
        else
            print_error "PreflightReport type missing"
        fi

        if grep -q "validatePdf" "$SCHEMA_FILE"; then
            print_success "validatePdf mutation defined"
        else
            print_error "validatePdf mutation missing"
        fi

        if grep -q "preflightReports" "$SCHEMA_FILE"; then
            print_success "preflightReports query defined"
        else
            print_error "preflightReports query missing"
        fi
    else
        print_error "GraphQL schema file not found: $SCHEMA_FILE"
    fi
}

# Function to check backend service
check_backend_service() {
    print_header "BACKEND SERVICE"

    SERVICE_FILE="$(dirname "$(dirname "$(realpath "$0")")")/src/modules/operations/services/preflight.service.ts"

    if [ -f "$SERVICE_FILE" ]; then
        print_success "PreflightService file exists"

        # Check for key methods
        if grep -q "async validatePdf" "$SERVICE_FILE"; then
            print_success "validatePdf method exists"
        else
            print_error "validatePdf method missing"
        fi

        if grep -q "async getReport" "$SERVICE_FILE"; then
            print_success "getReport method exists"
        else
            print_error "getReport method missing"
        fi

        if grep -q "async approveReport" "$SERVICE_FILE"; then
            print_success "approveReport method exists"
        else
            print_error "approveReport method missing"
        fi
    else
        print_error "PreflightService file not found: $SERVICE_FILE"
    fi
}

# Function to check frontend pages
check_frontend_pages() {
    print_header "FRONTEND PAGES"

    FRONTEND_DIR="$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")/frontend/src/pages"

    PAGES=(
        "PreflightDashboard.tsx"
        "PreflightProfilesPage.tsx"
        "PreflightReportDetailPage.tsx"
        "ColorProofManagementPage.tsx"
    )

    for page in "${PAGES[@]}"; do
        PAGE_PATH="$FRONTEND_DIR/$page"

        if [ -f "$PAGE_PATH" ]; then
            print_success "Frontend page exists: $page"
        else
            print_error "Frontend page missing: $page"
        fi
    done
}

# Function to check frontend queries
check_frontend_queries() {
    print_header "FRONTEND GRAPHQL QUERIES"

    QUERIES_FILE="$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")/frontend/src/graphql/queries/preflight.ts"

    if [ -f "$QUERIES_FILE" ]; then
        print_success "Preflight queries file exists"

        # Check for key queries
        if grep -q "GET_PREFLIGHT_REPORTS" "$QUERIES_FILE"; then
            print_success "GET_PREFLIGHT_REPORTS query exists"
        else
            print_error "GET_PREFLIGHT_REPORTS query missing"
        fi

        if grep -q "GET_PREFLIGHT_STATISTICS" "$QUERIES_FILE"; then
            print_success "GET_PREFLIGHT_STATISTICS query exists"
        else
            print_error "GET_PREFLIGHT_STATISTICS query missing"
        fi

        if grep -q "VALIDATE_PDF" "$QUERIES_FILE"; then
            print_success "VALIDATE_PDF mutation exists"
        else
            print_error "VALIDATE_PDF mutation missing"
        fi
    else
        print_error "Preflight queries file not found: $QUERIES_FILE"
    fi
}

# Function to test database queries
test_database_queries() {
    print_header "DATABASE QUERY TESTS"

    # Test view query - vw_preflight_pass_rates
    if psql "$DATABASE_URL" -c "SELECT * FROM vw_preflight_pass_rates LIMIT 1" > /dev/null 2>&1; then
        print_success "vw_preflight_pass_rates query successful"
    else
        print_error "vw_preflight_pass_rates query failed"
    fi

    # Test view query - vw_preflight_error_frequency
    if psql "$DATABASE_URL" -c "SELECT * FROM vw_preflight_error_frequency LIMIT 1" > /dev/null 2>&1; then
        print_success "vw_preflight_error_frequency query successful"
    else
        print_error "vw_preflight_error_frequency query failed"
    fi

    # Test profile query
    if psql "$DATABASE_URL" -c "SELECT * FROM preflight_profiles WHERE is_active = true LIMIT 1" > /dev/null 2>&1; then
        print_success "Active profiles query successful"
    else
        print_error "Active profiles query failed"
    fi
}

# Function to check performance
check_performance() {
    print_header "PERFORMANCE CHECKS"

    # Check index usage (this is informational)
    print_info "Checking index statistics..."

    # Get table sizes
    TABLE_SIZES=$(psql "$DATABASE_URL" -t -c "
        SELECT
            schemaname || '.' || tablename as table,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables
        WHERE tablename LIKE 'preflight_%' OR tablename = 'color_proofs'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    ")

    if [ -n "$TABLE_SIZES" ]; then
        echo "$TABLE_SIZES"
        print_success "Retrieved table size information"
    else
        print_warning "Could not retrieve table sizes"
    fi
}

# Function to display health check summary
health_check_summary() {
    print_header "HEALTH CHECK SUMMARY"

    echo -e "Total Checks: $TOTAL_CHECKS"
    echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
    echo -e "${YELLOW}Warnings: $WARNING_CHECKS${NC}"
    echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
    echo ""

    PASS_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

    if [ "$FAILED_CHECKS" -eq 0 ]; then
        echo -e "${GREEN}✓ All critical checks passed!${NC}"
        echo -e "Pass Rate: ${GREEN}${PASS_RATE}%${NC}"

        if [ "$WARNING_CHECKS" -gt 0 ]; then
            echo -e "${YELLOW}⚠ There are $WARNING_CHECKS warnings to review${NC}"
        fi

        exit 0
    else
        echo -e "${RED}✗ Some checks failed!${NC}"
        echo -e "Pass Rate: ${RED}${PASS_RATE}%${NC}"
        echo -e "${RED}Please review the failed checks above${NC}"
        exit 1
    fi
}

# Main health check flow
main() {
    print_header "PDF PREFLIGHT & COLOR MANAGEMENT HEALTH CHECK"
    echo "REQ: REQ-STRATEGIC-AUTO-1767066329942"
    echo "Starting health check at $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""

    # Database checks
    check_database_connectivity
    check_tables
    check_views
    check_rls_policies
    check_indexes
    check_default_profiles
    check_data_integrity
    test_database_queries
    check_performance

    # Backend checks
    check_graphql_schema
    check_backend_service

    # Frontend checks
    check_frontend_pages
    check_frontend_queries

    # Summary
    health_check_summary
}

# Run main function
main "$@"
