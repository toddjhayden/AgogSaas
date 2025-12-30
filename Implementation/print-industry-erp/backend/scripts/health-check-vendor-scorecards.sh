#!/bin/bash
# REQ-STRATEGIC-AUTO-1766627342634: Vendor Scorecards Health Check Script
# Agent: Berry (DevOps Specialist)
# Purpose: Monitor vendor scorecard system health
# Created: 2024-12-27

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:4000}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-agogsaas}"
DB_USER="${DB_USER:-postgres}"
PROMETHEUS_ENABLED="${PROMETHEUS_ENABLED:-true}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"

# Health status
OVERALL_STATUS="HEALTHY"
CRITICAL_ISSUES=()
WARNING_ISSUES=()

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Vendor Scorecards Health Check                           ║${NC}"
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

    local required_tables=("vendor_scorecard_config" "vendor_esg_metrics" "vendor_performance_alerts" "vendor_performance")
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

check_scorecard_configuration() {
    echo -e "${BLUE}[CHECK]${NC} Scorecard Configuration..."

    local active_configs=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM vendor_scorecard_config WHERE is_active = TRUE;
    " 2>/dev/null | xargs)

    if [ -z "$active_configs" ]; then
        echo -e "${RED}  ✗ Cannot query scorecard_config table${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("Cannot query vendor_scorecard_config table")
    elif [ "$active_configs" -eq 0 ]; then
        echo -e "${YELLOW}  ⚠ No active scorecard configurations${NC}"
        OVERALL_STATUS="DEGRADED"
        WARNING_ISSUES+=("No active scorecard configurations found")
    else
        echo -e "${GREEN}  ✓ Active configurations: $active_configs (HEALTHY)${NC}"

        # Validate weight totals
        local invalid_weights=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*)
            FROM vendor_scorecard_config
            WHERE is_active = TRUE
            AND ABS((quality_weight + delivery_weight + cost_weight + service_weight + innovation_weight + esg_weight) - 1.0) > 0.01;
        " 2>/dev/null | xargs)

        if [ "$invalid_weights" -gt 0 ]; then
            echo -e "${YELLOW}  ⚠ $invalid_weights configuration(s) with invalid weight totals${NC}"
            WARNING_ISSUES+=("$invalid_weights scorecard configs have weights not summing to 1.0")
        fi
    fi
}

check_alert_thresholds() {
    echo -e "${BLUE}[CHECK]${NC} Alert Thresholds..."

    local threshold_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM vendor_alert_thresholds;
    " 2>/dev/null | xargs)

    if [ -z "$threshold_count" ]; then
        echo -e "${YELLOW}  ⚠ Cannot query alert thresholds (table may not exist)${NC}"
        WARNING_ISSUES+=("vendor_alert_thresholds table not accessible")
    elif [ "$threshold_count" -eq 0 ]; then
        echo -e "${YELLOW}  ⚠ No alert thresholds configured${NC}"
        WARNING_ISSUES+=("No alert thresholds configured")
    else
        echo -e "${GREEN}  ✓ Alert thresholds configured: $threshold_count (HEALTHY)${NC}"
    fi
}

check_active_alerts() {
    echo -e "${BLUE}[CHECK]${NC} Active Alerts..."

    local critical_alerts=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*)
        FROM vendor_performance_alerts
        WHERE alert_status = 'ACTIVE' AND alert_severity = 'CRITICAL';
    " 2>/dev/null | xargs)

    local warning_alerts=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*)
        FROM vendor_performance_alerts
        WHERE alert_status = 'ACTIVE' AND alert_severity = 'WARNING';
    " 2>/dev/null | xargs)

    if [ -z "$critical_alerts" ]; then
        echo -e "${YELLOW}  ⚠ Cannot query alerts table${NC}"
    else
        if [ "$critical_alerts" -gt 0 ]; then
            echo -e "${RED}  ✗ CRITICAL alerts: $critical_alerts (REVIEW REQUIRED)${NC}"
            OVERALL_STATUS="DEGRADED"
            WARNING_ISSUES+=("$critical_alerts CRITICAL vendor alerts active")
        else
            echo -e "${GREEN}  ✓ CRITICAL alerts: 0${NC}"
        fi

        if [ "$warning_alerts" -gt 0 ]; then
            echo -e "${YELLOW}  ⚠ WARNING alerts: $warning_alerts (REVIEW)${NC}"
            WARNING_ISSUES+=("$warning_alerts WARNING vendor alerts active")
        else
            echo -e "${GREEN}  ✓ WARNING alerts: 0${NC}"
        fi
    fi
}

check_vendor_data_quality() {
    echo -e "${BLUE}[CHECK]${NC} Vendor Data Quality..."

    local active_vendors=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM vendors WHERE is_active = TRUE;
    " 2>/dev/null | xargs)

    if [ -z "$active_vendors" ]; then
        echo -e "${YELLOW}  ⚠ Cannot query vendors table${NC}"
    elif [ "$active_vendors" -eq 0 ]; then
        echo -e "${YELLOW}  ⚠ No active vendors found${NC}"
        WARNING_ISSUES+=("No active vendors in system")
    else
        echo -e "${GREEN}  ✓ Active vendors: $active_vendors${NC}"

        # Check for vendors with missing tier classification
        local vendors_without_tier=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*)
            FROM vendors
            WHERE is_active = TRUE AND vendor_tier IS NULL;
        " 2>/dev/null | xargs)

        if [ ! -z "$vendors_without_tier" ] && [ "$vendors_without_tier" -gt 0 ]; then
            local tier_percentage=$(awk "BEGIN {printf \"%.1f\", ($vendors_without_tier/$active_vendors)*100}")
            echo -e "${YELLOW}  ⚠ Vendors without tier: $vendors_without_tier ($tier_percentage%)${NC}"
            WARNING_ISSUES+=("$vendors_without_tier vendors missing tier classification")
        fi
    fi
}

check_performance_metrics_coverage() {
    echo -e "${BLUE}[CHECK]${NC} Performance Metrics Coverage..."

    # Check how many active vendors have performance metrics
    local vendors_with_metrics=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(DISTINCT v.vendor_id)
        FROM vendors v
        INNER JOIN vendor_performance vp ON v.vendor_id = vp.vendor_id
        WHERE v.is_active = TRUE
        AND vp.evaluation_date >= CURRENT_DATE - INTERVAL '90 days';
    " 2>/dev/null | xargs)

    local total_active_vendors=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM vendors WHERE is_active = TRUE;
    " 2>/dev/null | xargs)

    if [ -z "$vendors_with_metrics" ] || [ -z "$total_active_vendors" ]; then
        echo -e "${YELLOW}  ⚠ Cannot calculate metrics coverage${NC}"
    elif [ "$total_active_vendors" -eq 0 ]; then
        echo -e "${YELLOW}  ⚠ No active vendors (0% coverage)${NC}"
    else
        local coverage_percentage=$(awk "BEGIN {printf \"%.1f\", ($vendors_with_metrics/$total_active_vendors)*100}")

        if (( $(echo "$coverage_percentage >= 80" | bc -l) )); then
            echo -e "${GREEN}  ✓ Metrics coverage: $coverage_percentage% ($vendors_with_metrics/$total_active_vendors vendors)${NC}"
        elif (( $(echo "$coverage_percentage >= 50" | bc -l) )); then
            echo -e "${YELLOW}  ⚠ Metrics coverage: $coverage_percentage% ($vendors_with_metrics/$total_active_vendors vendors)${NC}"
            WARNING_ISSUES+=("Metrics coverage at $coverage_percentage% (target: 80%)")
        else
            echo -e "${RED}  ✗ Metrics coverage: $coverage_percentage% ($vendors_with_metrics/$total_active_vendors vendors)${NC}"
            OVERALL_STATUS="DEGRADED"
            WARNING_ISSUES+=("Low metrics coverage: $coverage_percentage% (target: 80%)")
        fi
    fi
}

check_esg_metrics_collection() {
    echo -e "${BLUE}[CHECK]${NC} ESG Metrics Collection..."

    local vendors_with_esg=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(DISTINCT vendor_id)
        FROM vendor_esg_metrics
        WHERE measurement_date >= CURRENT_DATE - INTERVAL '180 days';
    " 2>/dev/null | xargs)

    if [ -z "$vendors_with_esg" ]; then
        echo -e "${YELLOW}  ⚠ Cannot query ESG metrics${NC}"
    elif [ "$vendors_with_esg" -eq 0 ]; then
        echo -e "${YELLOW}  ⚠ No ESG metrics collected (180 days)${NC}"
        WARNING_ISSUES+=("No ESG metrics collected in last 180 days")
    else
        echo -e "${GREEN}  ✓ Vendors with ESG data (180d): $vendors_with_esg${NC}"

        # Check for ESG critical risks
        local critical_esg_risks=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(DISTINCT vendor_id)
            FROM vendor_esg_metrics
            WHERE esg_risk_level = 'CRITICAL'
            AND measurement_date >= CURRENT_DATE - INTERVAL '90 days';
        " 2>/dev/null | xargs)

        if [ ! -z "$critical_esg_risks" ] && [ "$critical_esg_risks" -gt 0 ]; then
            echo -e "${RED}  ✗ Vendors with CRITICAL ESG risk: $critical_esg_risks (REVIEW)${NC}"
            OVERALL_STATUS="DEGRADED"
            WARNING_ISSUES+=("$critical_esg_risks vendors have CRITICAL ESG risk level")
        fi
    fi
}

check_graphql_endpoint() {
    echo -e "${BLUE}[CHECK]${NC} GraphQL Endpoint..."

    # Test basic GraphQL connectivity
    if curl -s -f -X POST "$API_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __schema { types { name } } }"}' > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ GraphQL endpoint: HEALTHY${NC}"
    else
        echo -e "${RED}  ✗ GraphQL endpoint: UNAVAILABLE${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("GraphQL endpoint unavailable at $API_URL/graphql")
        return
    fi

    # Test vendor scorecard specific query
    local query_test=$(curl -s -X POST "$API_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __type(name: \"VendorScorecard\") { name } }"}' 2>/dev/null | grep -o "VendorScorecard" || echo "")

    if [ "$query_test" = "VendorScorecard" ]; then
        echo -e "${GREEN}  ✓ VendorScorecard GraphQL schema: AVAILABLE${NC}"
    else
        echo -e "${YELLOW}  ⚠ VendorScorecard schema not found in GraphQL${NC}"
        WARNING_ISSUES+=("VendorScorecard GraphQL schema not accessible")
    fi
}

check_rls_policies() {
    echo -e "${BLUE}[CHECK]${NC} Row-Level Security Policies..."

    local rls_enabled_tables=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*)
        FROM pg_tables t
        JOIN pg_class c ON t.tablename = c.relname
        WHERE t.tablename IN ('vendor_scorecard_config', 'vendor_esg_metrics', 'vendor_performance_alerts')
        AND c.relrowsecurity = true;
    " 2>/dev/null | xargs)

    if [ -z "$rls_enabled_tables" ]; then
        echo -e "${YELLOW}  ⚠ Cannot check RLS status${NC}"
    elif [ "$rls_enabled_tables" -eq 3 ]; then
        echo -e "${GREEN}  ✓ RLS enabled on all 3 tables${NC}"

        # Count total policies
        local total_policies=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*)
            FROM pg_policies
            WHERE tablename IN ('vendor_scorecard_config', 'vendor_esg_metrics', 'vendor_performance_alerts');
        " 2>/dev/null | xargs)

        echo -e "${GREEN}  ✓ RLS policies configured: $total_policies${NC}"
    else
        echo -e "${YELLOW}  ⚠ RLS enabled on $rls_enabled_tables/3 tables${NC}"
        WARNING_ISSUES+=("RLS not enabled on all vendor scorecard tables")
    fi
}

check_query_performance() {
    echo -e "${BLUE}[CHECK]${NC} Query Performance..."

    # Test scorecard query performance
    local start=$(date +%s%N)
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT * FROM vendor_performance LIMIT 10;
    " > /dev/null 2>&1
    local end=$(date +%s%N)

    local query_time=$(( (end - start) / 1000000 ))  # Convert to milliseconds

    if [ "$query_time" -lt 100 ]; then
        echo -e "${GREEN}  ✓ Query performance: ${query_time}ms (HEALTHY)${NC}"
    elif [ "$query_time" -lt 500 ]; then
        echo -e "${YELLOW}  ⚠ Query performance: ${query_time}ms (DEGRADED)${NC}"
        OVERALL_STATUS="DEGRADED"
        WARNING_ISSUES+=("Query performance ${query_time}ms (threshold: 100ms)")
    else
        echo -e "${RED}  ✗ Query performance: ${query_time}ms (UNHEALTHY)${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("Query performance ${query_time}ms (threshold: 500ms)")
    fi
}

check_pg_cron_jobs() {
    echo -e "${BLUE}[CHECK]${NC} pg_cron Jobs..."

    local job_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM cron.job WHERE jobname = 'calculate_vendor_performance';
    " 2>/dev/null | xargs)

    if [ -z "$job_count" ]; then
        echo -e "${YELLOW}  ⚠ pg_cron: NOT AVAILABLE (using manual calculation)${NC}"
        WARNING_ISSUES+=("pg_cron extension not available - automated calculations disabled")
    elif [ "$job_count" -eq 1 ]; then
        echo -e "${GREEN}  ✓ pg_cron job: CONFIGURED${NC}"

        # Check last run
        local last_run=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COALESCE(TO_CHAR(MAX(start_time), 'YYYY-MM-DD HH24:MI:SS'), 'Never')
            FROM cron.job_run_details
            WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'calculate_vendor_performance')
            LIMIT 1;
        " 2>/dev/null | xargs)

        echo -e "${BLUE}    Last run: $last_run${NC}"
    else
        echo -e "${YELLOW}  ⚠ pg_cron job: NOT CONFIGURED${NC}"
        WARNING_ISSUES+=("pg_cron job for vendor performance calculation not configured")
    fi
}

export_prometheus_metrics() {
    if [ "$PROMETHEUS_ENABLED" != "true" ]; then
        return
    fi

    echo ""
    echo -e "${BLUE}[METRICS]${NC} Prometheus Metrics Export..."

    # Active vendors metric
    local active_vendors=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM vendors WHERE is_active = TRUE;
    " 2>/dev/null | xargs)

    # Metrics coverage
    local vendors_with_metrics=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(DISTINCT vendor_id)
        FROM vendor_performance
        WHERE evaluation_date >= CURRENT_DATE - INTERVAL '90 days';
    " 2>/dev/null | xargs)

    # Active critical alerts
    local critical_alerts=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*)
        FROM vendor_performance_alerts
        WHERE alert_status = 'ACTIVE' AND alert_severity = 'CRITICAL';
    " 2>/dev/null | xargs)

    # ESG critical risks
    local esg_critical=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(DISTINCT vendor_id)
        FROM vendor_esg_metrics
        WHERE esg_risk_level = 'CRITICAL'
        AND measurement_date >= CURRENT_DATE - INTERVAL '90 days';
    " 2>/dev/null | xargs)

    cat > /tmp/vendor_scorecard_metrics.prom <<EOF
# HELP vendor_scorecards_active_vendors Total number of active vendors
# TYPE vendor_scorecards_active_vendors gauge
vendor_scorecards_active_vendors ${active_vendors:-0}

# HELP vendor_scorecards_metrics_coverage Vendors with performance metrics (90d)
# TYPE vendor_scorecards_metrics_coverage gauge
vendor_scorecards_metrics_coverage ${vendors_with_metrics:-0}

# HELP vendor_scorecards_critical_alerts Active CRITICAL alerts
# TYPE vendor_scorecards_critical_alerts gauge
vendor_scorecards_critical_alerts ${critical_alerts:-0}

# HELP vendor_scorecards_esg_critical_risks Vendors with CRITICAL ESG risk (90d)
# TYPE vendor_scorecards_esg_critical_risks gauge
vendor_scorecards_esg_critical_risks ${esg_critical:-0}

# HELP vendor_scorecards_health_status Overall system health (0=UNHEALTHY, 1=DEGRADED, 2=HEALTHY)
# TYPE vendor_scorecards_health_status gauge
vendor_scorecards_health_status $([ "$OVERALL_STATUS" = "HEALTHY" ] && echo 2 || ([ "$OVERALL_STATUS" = "DEGRADED" ] && echo 1 || echo 0))
EOF

    echo -e "${GREEN}  ✓ Metrics exported to: /tmp/vendor_scorecard_metrics.prom${NC}"
}

send_alert() {
    if [ -z "$ALERT_WEBHOOK" ]; then
        return
    fi

    if [ "$OVERALL_STATUS" != "HEALTHY" ]; then
        echo ""
        echo -e "${BLUE}[ALERT]${NC} Sending alert notification..."

        local alert_message="Vendor Scorecards Health: $OVERALL_STATUS"

        if [ ${#CRITICAL_ISSUES[@]} -gt 0 ]; then
            alert_message="$alert_message\n\nCRITICAL ISSUES:\n"
            for issue in "${CRITICAL_ISSUES[@]}"; do
                alert_message="$alert_message- $issue\n"
            done
        fi

        if [ ${#WARNING_ISSUES[@]} -gt 0 ]; then
            alert_message="$alert_message\nWARNINGS:\n"
            for issue in "${WARNING_ISSUES[@]}"; do
                alert_message="$alert_message- $issue\n"
            done
        fi

        curl -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"$alert_message\"}" > /dev/null 2>&1

        echo -e "${GREEN}  ✓ Alert sent${NC}"
    fi
}

print_summary() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"

    if [ "$OVERALL_STATUS" = "HEALTHY" ]; then
        echo -e "${BLUE}║${NC}  ${GREEN}Overall Status: HEALTHY${NC}"
    elif [ "$OVERALL_STATUS" = "DEGRADED" ]; then
        echo -e "${BLUE}║${NC}  ${YELLOW}Overall Status: DEGRADED${NC}"
    else
        echo -e "${BLUE}║${NC}  ${RED}Overall Status: UNHEALTHY${NC}"
    fi

    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

    if [ ${#CRITICAL_ISSUES[@]} -gt 0 ]; then
        echo ""
        echo -e "${RED}CRITICAL ISSUES:${NC}"
        for issue in "${CRITICAL_ISSUES[@]}"; do
            echo -e "  ${RED}✗${NC} $issue"
        done
    fi

    if [ ${#WARNING_ISSUES[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}WARNINGS:${NC}"
        for issue in "${WARNING_ISSUES[@]}"; do
            echo -e "  ${YELLOW}⚠${NC} $issue"
        done
    fi

    if [ "$OVERALL_STATUS" = "HEALTHY" ]; then
        echo ""
        echo -e "${GREEN}All vendor scorecard systems operational!${NC}"
    fi

    echo ""
}

main() {
    print_header
    check_database_connection
    check_required_tables
    check_scorecard_configuration
    check_alert_thresholds
    check_active_alerts
    check_vendor_data_quality
    check_performance_metrics_coverage
    check_esg_metrics_collection
    check_graphql_endpoint
    check_rls_policies
    check_query_performance
    check_pg_cron_jobs
    export_prometheus_metrics
    send_alert
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
