#!/bin/bash
# REQ-STRATEGIC-AUTO-1767048328662: Advanced Analytics Health Check Script
# Agent: Berry (DevOps Specialist)
# Purpose: Monitor advanced analytics and reporting system health
# Created: 2025-12-29

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-agogsaas}"
DB_USER="${DB_USER:-postgres}"
GRAPHQL_ENDPOINT="${GRAPHQL_ENDPOINT:-$API_URL/graphql}"

# Health status
OVERALL_STATUS="HEALTHY"
CRITICAL_ISSUES=()
WARNING_ISSUES=()

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Advanced Analytics & Reporting Health Check              ║${NC}"
    echo -e "${BLUE}║  $(date '+%Y-%m-%d %H:%M:%S')                                      ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_database_connection() {
    echo -e "${BLUE}[CHECK]${NC} Database Connection..."

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Database connection: HEALTHY${NC}"
    else
        echo -e "${RED}  ✗ Database connection: FAILED${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("Database connection failed")
    fi
}

check_required_tables() {
    echo -e "${BLUE}[CHECK]${NC} Required Tables..."

    local required_tables=("export_jobs")
    local missing_tables=()

    for table in "${required_tables[@]}"; do
        local table_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '$table';
        " 2>/dev/null | xargs)

        if [ "$table_exists" -eq 1 ]; then
            echo -e "${GREEN}  ✓ Table '$table' exists${NC}"
        else
            echo -e "${RED}  ✗ Table '$table' missing${NC}"
            missing_tables+=("$table")
        fi
    done

    if [ ${#missing_tables[@]} -gt 0 ]; then
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("Missing tables: ${missing_tables[*]}")
    fi
}

check_analytics_views() {
    echo -e "${BLUE}[CHECK]${NC} Analytics Views..."

    local required_views=("vendor_production_impact_v" "customer_profitability_v" "order_cycle_analysis_v" "material_flow_analysis_v")
    local missing_views=()

    for view in "${required_views[@]}"; do
        local view_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM information_schema.views WHERE table_name = '$view';
        " 2>/dev/null | xargs)

        if [ "$view_exists" -eq 1 ]; then
            echo -e "${GREEN}  ✓ View '$view' exists${NC}"
        else
            echo -e "${RED}  ✗ View '$view' missing${NC}"
            missing_views+=("$view")
        fi
    done

    if [ ${#missing_views[@]} -gt 0 ]; then
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("Missing views: ${missing_views[*]}")
    fi
}

check_materialized_views() {
    echo -e "${BLUE}[CHECK]${NC} Materialized Views..."

    local mat_view_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_matviews WHERE matviewname = 'executive_kpi_summary_mv';
    " 2>/dev/null | xargs)

    if [ "$mat_view_exists" -eq 1 ]; then
        echo -e "${GREEN}  ✓ Materialized view 'executive_kpi_summary_mv' exists${NC}"

        # Check freshness
        local last_refresh=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_refresh))::integer / 60
            FROM pg_catalog.pg_stat_user_tables
            WHERE relname = 'executive_kpi_summary_mv';
        " 2>/dev/null | xargs)

        if [ -n "$last_refresh" ]; then
            if [ "$last_refresh" -gt 60 ]; then
                echo -e "${YELLOW}  ⚠ Materialized view last refreshed $last_refresh minutes ago (>1 hour)${NC}"
                WARNING_ISSUES+=("executive_kpi_summary_mv not refreshed in last hour")
            else
                echo -e "${GREEN}  ✓ Materialized view freshness: $last_refresh minutes (HEALTHY)${NC}"
            fi
        fi
    else
        echo -e "${RED}  ✗ Materialized view 'executive_kpi_summary_mv' missing${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("executive_kpi_summary_mv not found")
    fi
}

check_refresh_function() {
    echo -e "${BLUE}[CHECK]${NC} Refresh Function..."

    local func_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_proc WHERE proname = 'refresh_analytics_materialized_views';
    " 2>/dev/null | xargs)

    if [ "$func_exists" -eq 1 ]; then
        echo -e "${GREEN}  ✓ Function 'refresh_analytics_materialized_views' exists${NC}"

        # Test function execution
        echo -e "${BLUE}  Testing refresh function...${NC}"
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT refresh_analytics_materialized_views();" > /dev/null 2>&1; then
            echo -e "${GREEN}  ✓ Refresh function executed successfully${NC}"
        else
            echo -e "${YELLOW}  ⚠ Refresh function exists but execution failed${NC}"
            WARNING_ISSUES+=("refresh_analytics_materialized_views execution failed")
        fi
    else
        echo -e "${YELLOW}  ⚠ Refresh function not found (manual refresh required)${NC}"
        WARNING_ISSUES+=("Automatic refresh function not available")
    fi
}

check_indexes() {
    echo -e "${BLUE}[CHECK]${NC} Database Indexes..."

    local index_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'export_jobs';
    " 2>/dev/null | xargs)

    if [ -z "$index_count" ]; then
        echo -e "${YELLOW}  ⚠ Cannot query indexes${NC}"
    elif [ "$index_count" -ge 5 ]; then
        echo -e "${GREEN}  ✓ Export jobs indexes: $index_count (HEALTHY)${NC}"
    else
        echo -e "${YELLOW}  ⚠ Export jobs indexes: $index_count (expected at least 5)${NC}"
        WARNING_ISSUES+=("Fewer indexes than expected on export_jobs")
    fi
}

check_rls_policies() {
    echo -e "${BLUE}[CHECK]${NC} Row-Level Security Policies..."

    local rls_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_policies WHERE tablename = 'export_jobs';
    " 2>/dev/null | xargs)

    if [ -z "$rls_count" ]; then
        echo -e "${YELLOW}  ⚠ Cannot query RLS policies${NC}"
    elif [ "$rls_count" -ge 1 ]; then
        echo -e "${GREEN}  ✓ RLS policies on export_jobs: $rls_count (HEALTHY)${NC}"
    else
        echo -e "${RED}  ✗ No RLS policies found on export_jobs${NC}"
        OVERALL_STATUS="DEGRADED"
        WARNING_ISSUES+=("No RLS policies on export_jobs - security risk")
    fi
}

check_export_jobs() {
    echo -e "${BLUE}[CHECK]${NC} Export Jobs Status..."

    # Check total jobs
    local total_jobs=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM export_jobs;
    " 2>/dev/null | xargs)

    if [ -z "$total_jobs" ]; then
        echo -e "${YELLOW}  ⚠ Cannot query export_jobs table${NC}"
    else
        echo -e "${GREEN}  ✓ Total export jobs: $total_jobs${NC}"

        # Check recent jobs (last 24 hours)
        local recent_jobs=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM export_jobs WHERE requested_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours';
        " 2>/dev/null | xargs)

        echo -e "${GREEN}  ✓ Jobs in last 24 hours: $recent_jobs${NC}"

        # Check failed jobs
        local failed_jobs=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM export_jobs WHERE status = 'FAILED' AND requested_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours';
        " 2>/dev/null | xargs)

        if [ "$failed_jobs" -gt 0 ]; then
            echo -e "${YELLOW}  ⚠ Failed jobs (24h): $failed_jobs${NC}"
            WARNING_ISSUES+=("$failed_jobs export jobs failed in last 24 hours")
        else
            echo -e "${GREEN}  ✓ Failed jobs (24h): 0${NC}"
        fi

        # Check pending jobs (might be stuck)
        local pending_jobs=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM export_jobs
            WHERE status = 'PENDING'
            AND requested_at < CURRENT_TIMESTAMP - INTERVAL '1 hour';
        " 2>/dev/null | xargs)

        if [ "$pending_jobs" -gt 0 ]; then
            echo -e "${RED}  ✗ Stuck pending jobs (>1h): $pending_jobs${NC}"
            OVERALL_STATUS="DEGRADED"
            WARNING_ISSUES+=("$pending_jobs export jobs stuck in PENDING state")
        else
            echo -e "${GREEN}  ✓ No stuck pending jobs${NC}"
        fi

        # Check expired jobs that need cleanup
        local expired_jobs=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM export_jobs WHERE status = 'COMPLETED' AND expires_at < CURRENT_TIMESTAMP;
        " 2>/dev/null | xargs)

        if [ "$expired_jobs" -gt 100 ]; then
            echo -e "${YELLOW}  ⚠ Expired jobs needing cleanup: $expired_jobs${NC}"
            WARNING_ISSUES+=("$expired_jobs expired export jobs need cleanup")
        else
            echo -e "${GREEN}  ✓ Expired jobs: $expired_jobs (acceptable)${NC}"
        fi
    fi
}

check_pg_cron() {
    echo -e "${BLUE}[CHECK]${NC} Automated Job Scheduling (pg_cron)..."

    local pg_cron_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_cron';
    " 2>/dev/null | xargs)

    if [ "$pg_cron_exists" -eq 1 ]; then
        echo -e "${GREEN}  ✓ pg_cron extension enabled${NC}"

        # Check for refresh job
        local refresh_job=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM cron.job WHERE jobname = 'refresh-analytics-views';
        " 2>/dev/null | xargs)

        if [ "$refresh_job" -eq 1 ]; then
            echo -e "${GREEN}  ✓ Analytics refresh job scheduled${NC}"
        else
            echo -e "${YELLOW}  ⚠ Analytics refresh job not found${NC}"
            WARNING_ISSUES+=("pg_cron refresh job not scheduled")
        fi

        # Check for cleanup job
        local cleanup_job=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM cron.job WHERE jobname = 'cleanup-expired-exports';
        " 2>/dev/null | xargs)

        if [ "$cleanup_job" -eq 1 ]; then
            echo -e "${GREEN}  ✓ Export cleanup job scheduled${NC}"
        else
            echo -e "${YELLOW}  ⚠ Export cleanup job not found${NC}"
            WARNING_ISSUES+=("pg_cron cleanup job not scheduled")
        fi
    else
        echo -e "${YELLOW}  ⚠ pg_cron extension not available (manual refresh required)${NC}"
        WARNING_ISSUES+=("pg_cron not available - automation limited")
    fi
}

check_graphql_api() {
    echo -e "${BLUE}[CHECK]${NC} GraphQL API Endpoint..."

    # Test basic connectivity
    if command -v curl &> /dev/null; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$GRAPHQL_ENDPOINT" \
            -H "Content-Type: application/json" \
            -d '{"query":"query{__typename}"}' 2>/dev/null)

        if [ "$response" = "200" ] || [ "$response" = "400" ]; then
            echo -e "${GREEN}  ✓ GraphQL endpoint responding (HTTP $response)${NC}"

            # Test analytics schema introspection
            local introspection=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
                -H "Content-Type: application/json" \
                -d '{"query":"query{__type(name:\"VendorProductionImpact\"){name}}"}' 2>/dev/null)

            if echo "$introspection" | grep -q "VendorProductionImpact"; then
                echo -e "${GREEN}  ✓ Analytics schema types available${NC}"
            else
                echo -e "${YELLOW}  ⚠ Analytics schema types not found in introspection${NC}"
                WARNING_ISSUES+=("Analytics GraphQL types not available")
            fi
        else
            echo -e "${RED}  ✗ GraphQL endpoint not responding (HTTP $response)${NC}"
            OVERALL_STATUS="DEGRADED"
            WARNING_ISSUES+=("GraphQL API endpoint unreachable")
        fi
    else
        echo -e "${YELLOW}  ⚠ curl not available (skipping API check)${NC}"
    fi
}

check_backend_module() {
    echo -e "${BLUE}[CHECK]${NC} Backend Module Registration..."

    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local backend_dir="$(dirname "$script_dir")"

    if [ -f "$backend_dir/src/app.module.ts" ]; then
        if grep -q "AnalyticsModule" "$backend_dir/src/app.module.ts"; then
            echo -e "${GREEN}  ✓ AnalyticsModule registered in app.module.ts${NC}"
        else
            echo -e "${RED}  ✗ AnalyticsModule not found in app.module.ts${NC}"
            OVERALL_STATUS="UNHEALTHY"
            CRITICAL_ISSUES+=("Analytics module not registered")
        fi
    else
        echo -e "${YELLOW}  ⚠ Cannot verify module registration (app.module.ts not found)${NC}"
    fi
}

check_backend_dependencies() {
    echo -e "${BLUE}[CHECK]${NC} Backend Dependencies..."

    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local backend_dir="$(dirname "$script_dir")"

    if [ -f "$backend_dir/package.json" ]; then
        local has_puppeteer=$(grep -c "puppeteer" "$backend_dir/package.json" || true)
        local has_exceljs=$(grep -c "exceljs" "$backend_dir/package.json" || true)

        if [ "$has_puppeteer" -gt 0 ]; then
            echo -e "${GREEN}  ✓ Puppeteer dependency found (PDF export)${NC}"
        else
            echo -e "${YELLOW}  ⚠ Puppeteer not found (PDF export unavailable)${NC}"
            WARNING_ISSUES+=("Puppeteer not installed - PDF export won't work")
        fi

        if [ "$has_exceljs" -gt 0 ]; then
            echo -e "${GREEN}  ✓ ExcelJS dependency found (Excel export)${NC}"
        else
            echo -e "${YELLOW}  ⚠ ExcelJS not found (Excel export unavailable)${NC}"
            WARNING_ISSUES+=("ExcelJS not installed - Excel export won't work")
        fi
    else
        echo -e "${YELLOW}  ⚠ Cannot verify dependencies (package.json not found)${NC}"
    fi
}

check_view_query_performance() {
    echo -e "${BLUE}[CHECK]${NC} View Query Performance..."

    # Test vendor_production_impact_v query time
    local start_time=$(date +%s%3N)
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT COUNT(*) FROM vendor_production_impact_v LIMIT 10;
    " > /dev/null 2>&1
    local end_time=$(date +%s%3N)
    local query_time=$((end_time - start_time))

    if [ "$query_time" -lt 2000 ]; then
        echo -e "${GREEN}  ✓ vendor_production_impact_v query: ${query_time}ms (HEALTHY)${NC}"
    elif [ "$query_time" -lt 5000 ]; then
        echo -e "${YELLOW}  ⚠ vendor_production_impact_v query: ${query_time}ms (SLOW)${NC}"
        WARNING_ISSUES+=("vendor_production_impact_v query slow (${query_time}ms)")
    else
        echo -e "${RED}  ✗ vendor_production_impact_v query: ${query_time}ms (CRITICAL)${NC}"
        OVERALL_STATUS="DEGRADED"
        WARNING_ISSUES+=("vendor_production_impact_v query critically slow (${query_time}ms)")
    fi

    # Test materialized view query time
    start_time=$(date +%s%3N)
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT COUNT(*) FROM executive_kpi_summary_mv LIMIT 10;
    " > /dev/null 2>&1
    end_time=$(date +%s%3N)
    query_time=$((end_time - start_time))

    if [ "$query_time" -lt 100 ]; then
        echo -e "${GREEN}  ✓ executive_kpi_summary_mv query: ${query_time}ms (EXCELLENT)${NC}"
    elif [ "$query_time" -lt 500 ]; then
        echo -e "${GREEN}  ✓ executive_kpi_summary_mv query: ${query_time}ms (GOOD)${NC}"
    else
        echo -e "${YELLOW}  ⚠ executive_kpi_summary_mv query: ${query_time}ms (SLOW)${NC}"
        WARNING_ISSUES+=("Materialized view query slow (${query_time}ms)")
    fi
}

print_summary() {
    print_section "Health Check Summary"

    echo ""
    echo "Overall Status: $OVERALL_STATUS"
    echo ""

    if [ ${#CRITICAL_ISSUES[@]} -gt 0 ]; then
        echo -e "${RED}CRITICAL ISSUES:${NC}"
        for issue in "${CRITICAL_ISSUES[@]}"; do
            echo -e "${RED}  ✗ $issue${NC}"
        done
        echo ""
    fi

    if [ ${#WARNING_ISSUES[@]} -gt 0 ]; then
        echo -e "${YELLOW}WARNINGS:${NC}"
        for issue in "${WARNING_ISSUES[@]}"; do
            echo -e "${YELLOW}  ⚠ $issue${NC}"
        done
        echo ""
    fi

    if [ "$OVERALL_STATUS" = "HEALTHY" ]; then
        echo -e "${GREEN}✓ All checks passed - System is HEALTHY${NC}"
    elif [ "$OVERALL_STATUS" = "DEGRADED" ]; then
        echo -e "${YELLOW}⚠ System is DEGRADED - Review warnings${NC}"
    else
        echo -e "${RED}✗ System is UNHEALTHY - Immediate action required${NC}"
    fi

    echo ""
}

print_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Main execution
main() {
    print_header

    check_database_connection
    check_required_tables
    check_analytics_views
    check_materialized_views
    check_refresh_function
    check_indexes
    check_rls_policies
    check_export_jobs
    check_pg_cron
    check_graphql_api
    check_backend_module
    check_backend_dependencies
    check_view_query_performance

    print_summary

    # Exit with appropriate code
    if [ "$OVERALL_STATUS" = "HEALTHY" ]; then
        exit 0
    elif [ "$OVERALL_STATUS" = "DEGRADED" ]; then
        exit 1
    else
        exit 2
    fi
}

main "$@"
