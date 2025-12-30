#!/bin/bash
# ============================================================================
# Estimating & Job Costing Module Health Check Script
# REQ-STRATEGIC-AUTO-1767048328661
# ============================================================================
#
# This script performs health checks on the Estimating & Job Costing module
# database components.
#
# Author: Berry (DevOps Specialist)
# Date: 2025-12-29
# ============================================================================

set -e
set -u

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-agogsaas}"
DB_USER="${DB_USER:-agogsaas_user}"
DB_PASSWORD="${DB_PASSWORD:-changeme}"

# Counters
CHECKS_TOTAL=0
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# ============================================================================
# Functions
# ============================================================================

check_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_pass() {
    ((CHECKS_TOTAL++))
    ((CHECKS_PASSED++))
    echo -e "  ${GREEN}✓${NC} $1"
}

check_fail() {
    ((CHECKS_TOTAL++))
    ((CHECKS_FAILED++))
    echo -e "  ${RED}✗${NC} $1"
}

check_warn() {
    ((CHECKS_TOTAL++))
    ((CHECKS_WARNING++))
    echo -e "  ${YELLOW}⚠${NC} $1"
}

run_query() {
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "$1" 2>/dev/null | tr -d ' '
}

# ============================================================================
# Health Checks
# ============================================================================

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Estimating & Job Costing Module - Health Check           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "Timestamp: $(date +'%Y-%m-%d %H:%M:%S')"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 1: Database Connectivity
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_header "1. Database Connectivity"

if PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1; then
    check_pass "Database connection successful"
else
    check_fail "Cannot connect to database"
    echo ""
    echo -e "${RED}CRITICAL ERROR: Cannot proceed with health checks${NC}"
    exit 1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 2: Migration Status
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_header "2. Migration Status"

MIGRATIONS=(
    "0.0.40:create jobs and standard costs tables"
    "0.0.41:create estimating tables"
    "0.0.42:create job costing tables"
)

for migration in "${MIGRATIONS[@]}"; do
    IFS=':' read -r version description <<< "$migration"

    APPLIED=$(run_query "
        SELECT COUNT(*) FROM flyway_schema_history
        WHERE version = '${version}' AND success = true;
    ")

    if [ "${APPLIED}" -eq 1 ]; then
        check_pass "Migration V${version} (${description}) applied"
    else
        check_fail "Migration V${version} (${description}) NOT applied"
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 3: Table Existence
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_header "3. Table Existence"

TABLES=(
    "jobs:Job master data"
    "cost_centers:Cost center master"
    "standard_costs:Standard cost master"
    "estimates:Estimate headers"
    "estimate_operations:Estimate operations"
    "estimate_materials:Estimate materials"
    "job_costs:Job cost tracking"
    "job_cost_updates:Cost update audit trail"
)

for table_info in "${TABLES[@]}"; do
    IFS=':' read -r table description <<< "$table_info"

    EXISTS=$(run_query "
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '${table}';
    ")

    if [ "${EXISTS}" -eq 1 ]; then
        check_pass "Table '${table}' exists (${description})"
    else
        check_fail "Table '${table}' NOT found"
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 4: Materialized View
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_header "4. Materialized View"

VIEW_EXISTS=$(run_query "
    SELECT COUNT(*) FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname = 'job_cost_variance_summary';
")

if [ "${VIEW_EXISTS}" -eq 1 ]; then
    check_pass "Materialized view 'job_cost_variance_summary' exists"

    # Check if view has been populated
    ROW_COUNT=$(run_query "SELECT COUNT(*) FROM job_cost_variance_summary;")
    check_pass "Materialized view has ${ROW_COUNT} rows"
else
    check_fail "Materialized view 'job_cost_variance_summary' NOT found"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 5: Database Functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_header "5. Database Functions"

FUNCTIONS=(
    "get_current_standard_cost:Lookup current standard cost"
    "initialize_job_cost_from_estimate:Initialize job cost from estimate"
    "update_job_cost_incremental:Incremental cost update"
    "rollup_estimate_costs:Rollup estimate costs"
    "calculate_quantity_with_scrap:Calculate quantity with scrap"
    "refresh_job_cost_variance_summary:Refresh variance summary view"
)

for func_info in "${FUNCTIONS[@]}"; do
    IFS=':' read -r func description <<< "$func_info"

    FUNC_EXISTS=$(run_query "
        SELECT COUNT(*) FROM pg_proc
        JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
        WHERE pg_namespace.nspname = 'public' AND pg_proc.proname = '${func}';
    ")

    if [ "${FUNC_EXISTS}" -gt 0 ]; then
        check_pass "Function '${func}' exists (${description})"
    else
        check_warn "Function '${func}' NOT found"
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 6: Row-Level Security (RLS)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_header "6. Row-Level Security (RLS)"

for table_info in "${TABLES[@]}"; do
    IFS=':' read -r table description <<< "$table_info"

    RLS_ENABLED=$(run_query "
        SELECT COUNT(*) FROM pg_tables
        WHERE schemaname = 'public' AND tablename = '${table}' AND rowsecurity = true;
    ")

    if [ "${RLS_ENABLED}" -eq 1 ]; then
        # Check if policies exist
        POLICY_COUNT=$(run_query "
            SELECT COUNT(*) FROM pg_policies
            WHERE schemaname = 'public' AND tablename = '${table}';
        ")

        if [ "${POLICY_COUNT}" -gt 0 ]; then
            check_pass "Table '${table}' has RLS enabled with ${POLICY_COUNT} policies"
        else
            check_warn "Table '${table}' has RLS enabled but no policies"
        fi
    else
        check_fail "Table '${table}' does NOT have RLS enabled"
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 7: Indexes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_header "7. Indexes"

CRITICAL_INDEXES=(
    "jobs:idx_jobs_tenant:tenant_id index"
    "jobs:idx_jobs_status:status index"
    "standard_costs:idx_std_costs_current:current standard costs index"
    "estimates:idx_estimates_tenant:tenant_id index"
    "job_costs:idx_job_costs_tenant:tenant_id index"
    "job_costs:idx_job_costs_status:status index"
)

for index_info in "${CRITICAL_INDEXES[@]}"; do
    IFS=':' read -r table index description <<< "$index_info"

    INDEX_EXISTS=$(run_query "
        SELECT COUNT(*) FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = '${table}' AND indexname = '${index}';
    ")

    if [ "${INDEX_EXISTS}" -eq 1 ]; then
        check_pass "Index '${index}' exists on '${table}'"
    else
        check_warn "Index '${index}' NOT found on '${table}'"
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 8: Constraints
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_header "8. Constraints"

# Check foreign keys
FK_COUNT=$(run_query "
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name IN ('jobs', 'cost_centers', 'standard_costs', 'estimates',
                         'estimate_operations', 'estimate_materials',
                         'job_costs', 'job_cost_updates')
      AND constraint_type = 'FOREIGN KEY';
")

check_pass "${FK_COUNT} foreign key constraints found"

# Check unique constraints
UNIQUE_COUNT=$(run_query "
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name IN ('jobs', 'cost_centers', 'standard_costs', 'estimates',
                         'estimate_operations', 'estimate_materials',
                         'job_costs', 'job_cost_updates')
      AND constraint_type = 'UNIQUE';
")

check_pass "${UNIQUE_COUNT} unique constraints found"

# Check CHECK constraints
CHECK_COUNT=$(run_query "
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name IN ('jobs', 'cost_centers', 'standard_costs', 'estimates',
                         'estimate_operations', 'estimate_materials',
                         'job_costs', 'job_cost_updates')
      AND constraint_type = 'CHECK';
")

check_pass "${CHECK_COUNT} check constraints found"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 9: Sample Data Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_header "9. Data Validation"

# Check data counts
JOBS_COUNT=$(run_query "SELECT COUNT(*) FROM jobs;")
check_pass "Jobs table has ${JOBS_COUNT} records"

COST_CENTERS_COUNT=$(run_query "SELECT COUNT(*) FROM cost_centers;")
check_pass "Cost centers table has ${COST_CENTERS_COUNT} records"

STANDARD_COSTS_COUNT=$(run_query "SELECT COUNT(*) FROM standard_costs;")
check_pass "Standard costs table has ${STANDARD_COSTS_COUNT} records"

ESTIMATES_COUNT=$(run_query "SELECT COUNT(*) FROM estimates;")
check_pass "Estimates table has ${ESTIMATES_COUNT} records"

JOB_COSTS_COUNT=$(run_query "SELECT COUNT(*) FROM job_costs;")
check_pass "Job costs table has ${JOB_COSTS_COUNT} records"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Summary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Health Check Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Total Checks:   ${CHECKS_TOTAL}"
echo -e "  ${GREEN}Passed:         ${CHECKS_PASSED}${NC}"
if [ "${CHECKS_WARNING}" -gt 0 ]; then
    echo -e "  ${YELLOW}Warnings:       ${CHECKS_WARNING}${NC}"
fi
if [ "${CHECKS_FAILED}" -gt 0 ]; then
    echo -e "  ${RED}Failed:         ${CHECKS_FAILED}${NC}"
fi
echo ""

if [ "${CHECKS_FAILED}" -eq 0 ]; then
    if [ "${CHECKS_WARNING}" -eq 0 ]; then
        echo -e "${GREEN}✓ All health checks passed!${NC}"
        echo ""
        exit 0
    else
        echo -e "${YELLOW}⚠ Health checks passed with warnings${NC}"
        echo ""
        exit 0
    fi
else
    echo -e "${RED}✗ Health checks failed${NC}"
    echo ""
    exit 1
fi
