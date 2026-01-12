#!/bin/bash

################################################################################
# AgogSaaS ERP - Comprehensive Deployment Health Verification
# REQ: REQ-STRATEGIC-AUTO-1767045901874
# Agent: ROY (Backend Developer)
# Date: 2025-12-29
#
# This script performs comprehensive health verification of all deployed modules
# and generates a detailed deployment health report.
################################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="./deployment-reports"
REPORT_FILE="${REPORT_DIR}/deployment-health-${TIMESTAMP}.md"
METRICS_FILE="${REPORT_DIR}/deployment-metrics-${TIMESTAMP}.json"

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Create report directory
mkdir -p "$REPORT_DIR"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                        ║"
    echo "║          AgogSaaS ERP - Deployment Health Verification                ║"
    echo "║                                                                        ║"
    echo "║  REQ: REQ-STRATEGIC-AUTO-1767045901874                                ║"
    echo "║  Agent: ROY (Backend Developer)                                       ║"
    echo "║  Date: $(date '+%Y-%m-%d %H:%M:%S')                                    ║"
    echo "║                                                                        ║"
    echo "╚════════════════════════════════════════════════════════════════════════╝"
    echo ""
}

print_section() {
    local section_name=$1
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $section_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_pass() {
    local check_name=$1
    local message=$2
    echo -e "${GREEN}✓${NC} $check_name: $message"
    ((TOTAL_CHECKS++))
    ((PASSED_CHECKS++))
    echo "- ✅ **$check_name**: $message" >> "$REPORT_FILE"
}

check_fail() {
    local check_name=$1
    local message=$2
    echo -e "${RED}✗${NC} $check_name: $message"
    ((TOTAL_CHECKS++))
    ((FAILED_CHECKS++))
    echo "- ❌ **$check_name**: $message" >> "$REPORT_FILE"
}

check_warn() {
    local check_name=$1
    local message=$2
    echo -e "${YELLOW}⚠${NC} $check_name: $message"
    ((TOTAL_CHECKS++))
    ((WARNING_CHECKS++))
    echo "- ⚠️ **$check_name**: $message" >> "$REPORT_FILE"
}

################################################################################
# Initialize Report
################################################################################

initialize_report() {
    cat > "$REPORT_FILE" <<EOF
# Deployment Health Verification Report

**REQ:** REQ-STRATEGIC-AUTO-1767045901874
**Agent:** ROY (Backend Developer)
**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Environment:** ${ENVIRONMENT:-production}

---

## Executive Summary

This report contains comprehensive health verification results for all deployed modules in the AgogSaaS ERP system.

---

## Health Check Results

EOF
}

################################################################################
# Module Health Checks
################################################################################

check_build_status() {
    print_section "Build Status Verification"
    echo "" >> "$REPORT_FILE"
    echo "### Build Status" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # Check if backend builds
    if npm run build > /dev/null 2>&1; then
        check_pass "Backend Build" "TypeScript compilation successful"
    else
        check_fail "Backend Build" "TypeScript compilation failed"
        return 1
    fi

    # Check if dist directory exists
    if [ -d "dist" ]; then
        check_pass "Build Artifacts" "dist directory exists"
    else
        check_fail "Build Artifacts" "dist directory not found"
    fi
}

check_database_connectivity() {
    print_section "Database Connectivity"
    echo "" >> "$REPORT_FILE"
    echo "### Database Connectivity" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # Check database connection
    if PGPASSWORD=$DB_PASSWORD psql -h ${DB_HOST:-localhost} -U ${DB_USER:-agogsaas_user} -d ${DB_NAME:-agogsaas} -c "SELECT 1" > /dev/null 2>&1; then
        check_pass "Database Connection" "Successfully connected to PostgreSQL"
    else
        check_fail "Database Connection" "Failed to connect to PostgreSQL"
        return 1
    fi

    # Check for required extensions
    local extensions=("uuid-ossp" "pgcrypto" "pg_stat_statements" "pg_trgm")
    for ext in "${extensions[@]}"; do
        if PGPASSWORD=$DB_PASSWORD psql -h ${DB_HOST:-localhost} -U ${DB_USER:-agogsaas_user} -d ${DB_NAME:-agogsaas} -c "SELECT 1 FROM pg_extension WHERE extname = '$ext'" | grep -q 1; then
            check_pass "Extension: $ext" "Extension installed"
        else
            check_warn "Extension: $ext" "Extension not installed"
        fi
    done
}

check_core_tables() {
    print_section "Core Database Tables"
    echo "" >> "$REPORT_FILE"
    echo "### Core Tables" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    local tables=(
        "tenants"
        "users"
        "facilities"
        "materials"
        "bins"
        "bin_utilization_analytics"
        "demand_history"
        "material_forecasts"
        "replenishment_suggestions"
        "sales_quotes"
        "quote_items"
        "vendor_scorecards"
        "purchase_orders"
    )

    for table in "${tables[@]}"; do
        if PGPASSWORD=$DB_PASSWORD psql -h ${DB_HOST:-localhost} -U ${DB_USER:-agogsaas_user} -d ${DB_NAME:-agogsaas} -c "SELECT to_regclass('$table')" | grep -q "$table"; then
            check_pass "Table: $table" "Table exists"
        else
            check_fail "Table: $table" "Table missing"
        fi
    done
}

check_rls_policies() {
    print_section "Row-Level Security Policies"
    echo "" >> "$REPORT_FILE"
    echo "### RLS Policies" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # Check RLS is enabled on critical tables
    local rls_tables=(
        "demand_history"
        "material_forecasts"
        "sales_quotes"
        "vendor_scorecards"
        "bins"
    )

    for table in "${rls_tables[@]}"; do
        local rls_enabled=$(PGPASSWORD=$DB_PASSWORD psql -h ${DB_HOST:-localhost} -U ${DB_USER:-agogsaas_user} -d ${DB_NAME:-agogsaas} -t -c "SELECT relrowsecurity FROM pg_class WHERE relname = '$table'")

        if echo "$rls_enabled" | grep -q "t"; then
            check_pass "RLS: $table" "Row-level security enabled"
        else
            check_warn "RLS: $table" "Row-level security not enabled"
        fi
    done
}

check_graphql_schema() {
    print_section "GraphQL Schema Validation"
    echo "" >> "$REPORT_FILE"
    echo "### GraphQL Schema" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    local schema_files=(
        "src/graphql/schema/wms.graphql"
        "src/graphql/schema/forecasting.graphql"
        "src/graphql/schema/sales-materials.graphql"
        "src/graphql/schema/procurement.graphql"
    )

    for schema in "${schema_files[@]}"; do
        if [ -f "$schema" ]; then
            check_pass "Schema: $(basename $schema)" "Schema file exists"
        else
            check_warn "Schema: $(basename $schema)" "Schema file not found"
        fi
    done
}

check_nestjs_modules() {
    print_section "NestJS Module Structure"
    echo "" >> "$REPORT_FILE"
    echo "### NestJS Modules" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    local modules=(
        "src/modules/wms/wms.module.ts"
        "src/modules/forecasting/forecasting.module.ts"
        "src/modules/sales/sales.module.ts"
        "src/modules/procurement/procurement.module.ts"
    )

    for module in "${modules[@]}"; do
        if [ -f "$module" ]; then
            check_pass "Module: $(basename $module)" "Module file exists"

            # Check for proper @Module decorator
            if grep -q "@Module" "$module"; then
                check_pass "  └─ Decorator" "@Module decorator found"
            else
                check_fail "  └─ Decorator" "@Module decorator missing"
            fi
        else
            check_fail "Module: $(basename $module)" "Module file not found"
        fi
    done
}

run_feature_health_checks() {
    print_section "Feature-Specific Health Checks"
    echo "" >> "$REPORT_FILE"
    echo "### Feature Health Checks" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # Run bin optimization health check
    if [ -f "scripts/health-check.sh" ]; then
        echo -e "${BLUE}Running Bin Optimization health check...${NC}"
        if bash scripts/health-check.sh > /dev/null 2>&1; then
            check_pass "Bin Optimization" "Health check passed"
        else
            local exit_code=$?
            if [ $exit_code -eq 1 ]; then
                check_warn "Bin Optimization" "Health check degraded"
            else
                check_fail "Bin Optimization" "Health check failed"
            fi
        fi
    else
        check_warn "Bin Optimization" "Health check script not found"
    fi

    # Run forecasting health check
    if [ -f "scripts/health-check-forecasting.sh" ]; then
        echo -e "${BLUE}Running Forecasting health check...${NC}"
        if bash scripts/health-check-forecasting.sh > /dev/null 2>&1; then
            check_pass "Inventory Forecasting" "Health check passed"
        else
            local exit_code=$?
            if [ $exit_code -eq 1 ]; then
                check_warn "Inventory Forecasting" "Health check degraded"
            else
                check_fail "Inventory Forecasting" "Health check failed"
            fi
        fi
    else
        check_warn "Inventory Forecasting" "Health check script not found"
    fi

    # Run sales quotes health check
    if [ -f "scripts/health-check-sales-quotes.sh" ]; then
        echo -e "${BLUE}Running Sales Quotes health check...${NC}"
        if bash scripts/health-check-sales-quotes.sh > /dev/null 2>&1; then
            check_pass "Sales Quote Automation" "Health check passed"
        else
            local exit_code=$?
            if [ $exit_code -eq 1 ]; then
                check_warn "Sales Quote Automation" "Health check degraded"
            else
                check_fail "Sales Quote Automation" "Health check failed"
            fi
        fi
    else
        check_warn "Sales Quote Automation" "Health check script not found"
    fi

    # Run vendor scorecards health check
    if [ -f "scripts/health-check-vendor-scorecards.sh" ]; then
        echo -e "${BLUE}Running Vendor Scorecards health check...${NC}"
        if bash scripts/health-check-vendor-scorecards.sh > /dev/null 2>&1; then
            check_pass "Vendor Scorecards" "Health check passed"
        else
            local exit_code=$?
            if [ $exit_code -eq 1 ]; then
                check_warn "Vendor Scorecards" "Health check degraded"
            else
                check_fail "Vendor Scorecards" "Health check failed"
            fi
        fi
    else
        check_warn "Vendor Scorecards" "Health check script not found"
    fi
}

check_docker_configuration() {
    print_section "Docker Configuration"
    echo "" >> "$REPORT_FILE"
    echo "### Docker Configuration" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # Check Dockerfile exists
    if [ -f "Dockerfile" ]; then
        check_pass "Dockerfile" "Dockerfile exists"

        # Check for healthcheck in Dockerfile
        if grep -q "HEALTHCHECK" Dockerfile; then
            check_pass "  └─ Healthcheck" "Healthcheck configured in Dockerfile"
        else
            check_warn "  └─ Healthcheck" "No healthcheck configured in Dockerfile"
        fi

        # Check for multi-stage build
        if grep -q "AS builder" Dockerfile; then
            check_pass "  └─ Multi-stage" "Multi-stage build configured"
        else
            check_warn "  └─ Multi-stage" "No multi-stage build"
        fi
    else
        check_fail "Dockerfile" "Dockerfile not found"
    fi

    # Check docker-compose files
    if [ -f "../docker-compose.app.yml" ]; then
        check_pass "Docker Compose" "docker-compose.app.yml exists"
    else
        check_warn "Docker Compose" "docker-compose.app.yml not found"
    fi
}

################################################################################
# Generate Summary
################################################################################

generate_summary() {
    print_section "Summary"

    local pass_rate=0
    if [ $TOTAL_CHECKS -gt 0 ]; then
        pass_rate=$(awk "BEGIN {printf \"%.1f\", ($PASSED_CHECKS / $TOTAL_CHECKS) * 100}")
    fi

    cat >> "$REPORT_FILE" <<EOF

---

## Summary

**Total Checks:** $TOTAL_CHECKS
**Passed:** ✅ $PASSED_CHECKS
**Failed:** ❌ $FAILED_CHECKS
**Warnings:** ⚠️ $WARNING_CHECKS
**Pass Rate:** ${pass_rate}%

### Overall Status

EOF

    if [ $FAILED_CHECKS -eq 0 ]; then
        if [ $WARNING_CHECKS -eq 0 ]; then
            echo "**Status:** 🟢 HEALTHY - All checks passed" >> "$REPORT_FILE"
            echo -e "${GREEN}Overall Status: HEALTHY${NC}"
            echo -e "${GREEN}All $PASSED_CHECKS checks passed!${NC}"
        else
            echo "**Status:** 🟡 DEGRADED - All checks passed with $WARNING_CHECKS warnings" >> "$REPORT_FILE"
            echo -e "${YELLOW}Overall Status: DEGRADED${NC}"
            echo -e "${YELLOW}$PASSED_CHECKS checks passed with $WARNING_CHECKS warnings${NC}"
        fi
    else
        echo "**Status:** 🔴 UNHEALTHY - $FAILED_CHECKS checks failed" >> "$REPORT_FILE"
        echo -e "${RED}Overall Status: UNHEALTHY${NC}"
        echo -e "${RED}$FAILED_CHECKS checks failed!${NC}"
    fi

    cat >> "$REPORT_FILE" <<EOF

---

## Recommendations

EOF

    if [ $FAILED_CHECKS -gt 0 ]; then
        cat >> "$REPORT_FILE" <<EOF
### Critical Actions Required

1. **Address Failed Checks:** Review and fix all failed checks before proceeding to production
2. **Verify Database Schema:** Ensure all required tables and extensions are properly installed
3. **Test Feature Health:** Run individual feature health checks and address any issues

EOF
    fi

    if [ $WARNING_CHECKS -gt 0 ]; then
        cat >> "$REPORT_FILE" <<EOF
### Recommended Improvements

1. **Review Warnings:** Address warning items to improve system reliability
2. **Enable RLS:** Ensure row-level security is enabled on all multi-tenant tables
3. **Add Docker Healthchecks:** Configure healthchecks for all services

EOF
    fi

    cat >> "$REPORT_FILE" <<EOF
### Next Steps

1. **Implement Smoke Tests:** Create automated smoke test suite for critical workflows
2. **Set Up CI/CD:** Implement automated deployment pipeline with health check gates
3. **Monitor Continuously:** Set up continuous health monitoring with alerting

---

**Report Generated:** $(date '+%Y-%m-%d %H:%M:%S')
**Report Location:** $REPORT_FILE

EOF
}

generate_metrics() {
    cat > "$METRICS_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "req_number": "REQ-STRATEGIC-AUTO-1767045901874",
  "agent": "roy",
  "total_checks": $TOTAL_CHECKS,
  "passed": $PASSED_CHECKS,
  "failed": $FAILED_CHECKS,
  "warnings": $WARNING_CHECKS,
  "pass_rate": $(awk "BEGIN {printf \"%.1f\", ($PASSED_CHECKS / $TOTAL_CHECKS) * 100}"),
  "status": "$(if [ $FAILED_CHECKS -eq 0 ]; then if [ $WARNING_CHECKS -eq 0 ]; then echo "HEALTHY"; else echo "DEGRADED"; fi; else echo "UNHEALTHY"; fi)"
}
EOF
}

################################################################################
# Main Execution
################################################################################

main() {
    print_header
    initialize_report

    # Run all verification checks
    check_build_status
    check_database_connectivity
    check_core_tables
    check_rls_policies
    check_graphql_schema
    check_nestjs_modules
    run_feature_health_checks
    check_docker_configuration

    # Generate summary and metrics
    generate_summary
    generate_metrics

    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Report saved to: $REPORT_FILE${NC}"
    echo -e "${BLUE}Metrics saved to: $METRICS_FILE${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Exit with appropriate code
    if [ $FAILED_CHECKS -gt 0 ]; then
        exit 2  # UNHEALTHY
    elif [ $WARNING_CHECKS -gt 0 ]; then
        exit 1  # DEGRADED
    else
        exit 0  # HEALTHY
    fi
}

# Run main function
main
