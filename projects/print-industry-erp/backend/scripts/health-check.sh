#!/bin/bash
# REQ-STRATEGIC-AUTO-1766545799451: Health Check Script
# Agent: Berry (DevOps Specialist)
# Purpose: Monitor bin optimization system health
# Updated: 2024-12-24

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
    echo -e "${BLUE}║  Bin Optimization Health Check                             ║${NC}"
    echo -e "${BLUE}║  $(date)${NC}"
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

check_cache_freshness() {
    echo -e "${BLUE}[CHECK]${NC} Cache Freshness..."

    local cache_age=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT EXTRACT(EPOCH FROM (NOW() - MAX(last_updated)))/60
        FROM bin_utilization_cache;
    " 2>/dev/null | xargs)

    if [ -z "$cache_age" ]; then
        echo -e "${YELLOW}  ⚠ Cache age: UNKNOWN (cache may be empty)${NC}"
        WARNING_ISSUES+=("Cache age unknown")
    elif (( $(echo "$cache_age < 15" | bc -l) )); then
        echo -e "${GREEN}  ✓ Cache age: ${cache_age%.*} minutes (HEALTHY)${NC}"
    elif (( $(echo "$cache_age < 30" | bc -l) )); then
        echo -e "${YELLOW}  ⚠ Cache age: ${cache_age%.*} minutes (DEGRADED)${NC}"
        OVERALL_STATUS="DEGRADED"
        WARNING_ISSUES+=("Cache age ${cache_age%.*} minutes (threshold: 15 min)")
    else
        echo -e "${RED}  ✗ Cache age: ${cache_age%.*} minutes (UNHEALTHY)${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("Cache age ${cache_age%.*} minutes (threshold: 30 min)")
    fi
}

check_ml_accuracy() {
    echo -e "${BLUE}[CHECK]${NC} ML Model Accuracy..."

    local accuracy=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COALESCE(
            ROUND(100.0 * COUNT(*) FILTER (WHERE was_accepted = TRUE)::numeric / NULLIF(COUNT(*), 0), 1),
            0
        )
        FROM putaway_recommendations
        WHERE created_at > NOW() - INTERVAL '7 days'
        AND user_feedback IS NOT NULL;
    " 2>/dev/null | xargs)

    if [ -z "$accuracy" ] || [ "$accuracy" = "0" ]; then
        echo -e "${YELLOW}  ⚠ ML accuracy: NO DATA (insufficient feedback)${NC}"
        WARNING_ISSUES+=("ML accuracy: No feedback data available")
    elif (( $(echo "$accuracy >= 80" | bc -l) )); then
        echo -e "${GREEN}  ✓ ML accuracy: ${accuracy}% (HEALTHY)${NC}"
    elif (( $(echo "$accuracy >= 70" | bc -l) )); then
        echo -e "${YELLOW}  ⚠ ML accuracy: ${accuracy}% (DEGRADED)${NC}"
        OVERALL_STATUS="DEGRADED"
        WARNING_ISSUES+=("ML accuracy ${accuracy}% (threshold: 80%)")
    else
        echo -e "${RED}  ✗ ML accuracy: ${accuracy}% (UNHEALTHY)${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("ML accuracy ${accuracy}% (threshold: 70%)")
    fi
}

check_query_performance() {
    echo -e "${BLUE}[CHECK]${NC} Query Performance..."

    local start=$(date +%s%N)
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT * FROM bin_utilization_cache LIMIT 10;
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
        SELECT COUNT(*) FROM cron.job WHERE jobname = 'refresh_bin_util';
    " 2>/dev/null | xargs)

    if [ -z "$job_count" ]; then
        echo -e "${YELLOW}  ⚠ pg_cron: NOT AVAILABLE (using manual refresh)${NC}"
        WARNING_ISSUES+=("pg_cron extension not available")
    elif [ "$job_count" -eq 1 ]; then
        echo -e "${GREEN}  ✓ pg_cron job: CONFIGURED${NC}"
    else
        echo -e "${RED}  ✗ pg_cron job: NOT CONFIGURED${NC}"
        OVERALL_STATUS="DEGRADED"
        WARNING_ISSUES+=("pg_cron job not configured")
    fi
}

check_graphql_endpoint() {
    echo -e "${BLUE}[CHECK]${NC} GraphQL Endpoint..."

    if curl -s -f -X POST "$API_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __schema { types { name } } }"}' > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ GraphQL endpoint: HEALTHY${NC}"
    else
        echo -e "${RED}  ✗ GraphQL endpoint: UNAVAILABLE${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("GraphQL endpoint unavailable at $API_URL/graphql")
    fi
}

check_data_quality() {
    echo -e "${BLUE}[CHECK]${NC} Data Quality Monitoring..."

    # Check for unresolved capacity failures
    local capacity_failures=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM capacity_validation_failures
        WHERE resolved = FALSE AND created_at > NOW() - INTERVAL '24 hours';
    " 2>/dev/null | xargs)

    if [ -z "$capacity_failures" ]; then
        echo -e "${YELLOW}  ⚠ Data quality tables: NOT FOUND${NC}"
    elif [ "$capacity_failures" -eq 0 ]; then
        echo -e "${GREEN}  ✓ Capacity failures (24h): 0 (HEALTHY)${NC}"
    elif [ "$capacity_failures" -lt 5 ]; then
        echo -e "${YELLOW}  ⚠ Capacity failures (24h): $capacity_failures (REVIEW)${NC}"
        WARNING_ISSUES+=("$capacity_failures unresolved capacity failures in last 24h")
    else
        echo -e "${RED}  ✗ Capacity failures (24h): $capacity_failures (UNHEALTHY)${NC}"
        OVERALL_STATUS="DEGRADED"
        CRITICAL_ISSUES+=("$capacity_failures unresolved capacity failures")
    fi
}

check_statistical_analysis() {
    echo -e "${BLUE}[CHECK]${NC} Statistical Analysis Framework..."

    # Check if statistical metrics are being collected
    local metrics_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM bin_optimization_statistical_metrics
        WHERE measurement_timestamp > NOW() - INTERVAL '7 days';
    " 2>/dev/null | xargs)

    if [ -z "$metrics_count" ]; then
        echo -e "${YELLOW}  ⚠ Statistical tables: NOT FOUND${NC}"
    elif [ "$metrics_count" -eq 0 ]; then
        echo -e "${YELLOW}  ⚠ Statistical metrics (7d): 0 (NO DATA)${NC}"
        WARNING_ISSUES+=("No statistical metrics collected in last 7 days")
    else
        echo -e "${GREEN}  ✓ Statistical metrics (7d): $metrics_count (COLLECTING)${NC}"
    fi

    # Check for critical outliers
    local critical_outliers=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM bin_optimization_outliers
        WHERE outlier_severity IN ('SEVERE', 'EXTREME')
        AND requires_investigation = TRUE
        AND investigation_status = 'PENDING';
    " 2>/dev/null | xargs)

    if [ ! -z "$critical_outliers" ] && [ "$critical_outliers" -gt 0 ]; then
        echo -e "${YELLOW}  ⚠ Critical outliers pending: $critical_outliers (REVIEW)${NC}"
        WARNING_ISSUES+=("$critical_outliers critical outliers require investigation")
    fi
}

export_prometheus_metrics() {
    if [ "$PROMETHEUS_ENABLED" != "true" ]; then
        return
    fi

    echo ""
    echo -e "${BLUE}[METRICS]${NC} Prometheus Metrics Export..."

    # Cache age metric
    local cache_age=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(last_updated))), 0)
        FROM bin_utilization_cache;
    " 2>/dev/null | xargs)

    # ML accuracy metric
    local ml_accuracy=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COALESCE(
            100.0 * COUNT(*) FILTER (WHERE was_accepted = TRUE)::numeric / NULLIF(COUNT(*), 0),
            0
        )
        FROM putaway_recommendations
        WHERE created_at > NOW() - INTERVAL '7 days'
        AND user_feedback IS NOT NULL;
    " 2>/dev/null | xargs)

    # Recommendation count
    local rec_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*)
        FROM putaway_recommendations
        WHERE created_at > NOW() - INTERVAL '24 hours';
    " 2>/dev/null | xargs)

    cat > /tmp/bin_optimization_metrics.prom <<EOF
# HELP bin_utilization_cache_age_seconds Age of bin utilization cache in seconds
# TYPE bin_utilization_cache_age_seconds gauge
bin_utilization_cache_age_seconds ${cache_age:-0}

# HELP ml_model_accuracy_percentage ML model accuracy percentage (7-day window)
# TYPE ml_model_accuracy_percentage gauge
ml_model_accuracy_percentage ${ml_accuracy:-0}

# HELP putaway_recommendations_total Total putaway recommendations (24-hour window)
# TYPE putaway_recommendations_total counter
putaway_recommendations_total ${rec_count:-0}

# HELP bin_optimization_health_status Overall system health status (0=UNHEALTHY, 1=DEGRADED, 2=HEALTHY)
# TYPE bin_optimization_health_status gauge
bin_optimization_health_status $([ "$OVERALL_STATUS" = "HEALTHY" ] && echo 2 || ([ "$OVERALL_STATUS" = "DEGRADED" ] && echo 1 || echo 0))
EOF

    echo -e "${GREEN}  ✓ Metrics exported to: /tmp/bin_optimization_metrics.prom${NC}"
}

send_alert() {
    if [ -z "$ALERT_WEBHOOK" ]; then
        return
    fi

    if [ "$OVERALL_STATUS" != "HEALTHY" ]; then
        echo ""
        echo -e "${BLUE}[ALERT]${NC} Sending alert notification..."

        local alert_message="Bin Optimization Health: $OVERALL_STATUS"

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
        echo -e "${GREEN}All systems operational!${NC}"
    fi

    echo ""
}

main() {
    print_header
    check_database_connection
    check_cache_freshness
    check_ml_accuracy
    check_query_performance
    check_pg_cron_jobs
    check_graphql_endpoint
    check_data_quality
    check_statistical_analysis
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
