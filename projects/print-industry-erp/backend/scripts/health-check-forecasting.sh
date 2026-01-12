#!/bin/bash
# =====================================================
# Inventory Forecasting - Health Check Script
# =====================================================
# REQ: REQ-STRATEGIC-AUTO-1735405200000
# Agent: Berry (DevOps Specialist)
# Purpose: Monitor inventory forecasting system health
# Date: 2025-12-28
# =====================================================

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
    echo -e "${BLUE}║  Inventory Forecasting Health Check                       ║${NC}"
    echo -e "${BLUE}║  $(date '+%Y-%m-%d %H:%M:%S')                              ║${NC}"
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

check_forecasting_tables() {
    echo -e "${BLUE}[CHECK]${NC} Forecasting Tables..."

    local tables=("demand_history" "material_forecasts" "forecast_models" "forecast_accuracy_metrics" "replenishment_suggestions")
    local missing_tables=0

    for table in "${tables[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -tc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='$table')" 2>/dev/null | grep -q t; then
            echo -e "${GREEN}  ✓ Table exists: $table${NC}"
        else
            echo -e "${RED}  ✗ Table missing: $table${NC}"
            ((missing_tables++))
        fi
    done

    if [ $missing_tables -gt 0 ]; then
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("$missing_tables forecasting tables missing")
    fi
}

check_data_volume() {
    echo -e "${BLUE}[CHECK]${NC} Data Volume..."

    # Check demand history records
    local demand_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM demand_history;
    " 2>/dev/null | xargs)

    if [ -z "$demand_count" ]; then
        echo -e "${YELLOW}  ⚠ Demand history: UNKNOWN${NC}"
    elif [ "$demand_count" -eq 0 ]; then
        echo -e "${YELLOW}  ⚠ Demand history: NO DATA (0 records)${NC}"
        WARNING_ISSUES+=("No demand history data available")
    else
        echo -e "${GREEN}  ✓ Demand history: $demand_count records${NC}"
    fi

    # Check material forecasts
    local forecast_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM material_forecasts;
    " 2>/dev/null | xargs)

    if [ -z "$forecast_count" ]; then
        echo -e "${YELLOW}  ⚠ Material forecasts: UNKNOWN${NC}"
    elif [ "$forecast_count" -eq 0 ]; then
        echo -e "${YELLOW}  ⚠ Material forecasts: NO DATA (0 records)${NC}"
        WARNING_ISSUES+=("No forecasts generated yet")
    else
        echo -e "${GREEN}  ✓ Material forecasts: $forecast_count records${NC}"
    fi

    # Check forecast accuracy metrics
    local accuracy_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM forecast_accuracy_metrics;
    " 2>/dev/null | xargs)

    if [ -z "$accuracy_count" ]; then
        echo -e "${YELLOW}  ⚠ Accuracy metrics: UNKNOWN${NC}"
    elif [ "$accuracy_count" -eq 0 ]; then
        echo -e "${YELLOW}  ⚠ Accuracy metrics: NO DATA${NC}"
        WARNING_ISSUES+=("No forecast accuracy metrics available")
    else
        echo -e "${GREEN}  ✓ Accuracy metrics: $accuracy_count records${NC}"
    fi
}

check_forecast_accuracy() {
    echo -e "${BLUE}[CHECK]${NC} Forecast Accuracy..."

    # Check average MAPE across all materials (last 30 days)
    local avg_mape=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COALESCE(ROUND(AVG(mape)::numeric, 2), 0)
        FROM forecast_accuracy_metrics
        WHERE measurement_period_end >= CURRENT_DATE - 30
        AND mape IS NOT NULL;
    " 2>/dev/null | xargs)

    if [ -z "$avg_mape" ] || [ "$avg_mape" = "0" ]; then
        echo -e "${YELLOW}  ⚠ Average MAPE (30d): NO DATA${NC}"
    elif (( $(echo "$avg_mape < 10" | bc -l) )); then
        echo -e "${GREEN}  ✓ Average MAPE (30d): ${avg_mape}% (EXCELLENT)${NC}"
    elif (( $(echo "$avg_mape < 20" | bc -l) )); then
        echo -e "${GREEN}  ✓ Average MAPE (30d): ${avg_mape}% (GOOD)${NC}"
    elif (( $(echo "$avg_mape < 50" | bc -l) )); then
        echo -e "${YELLOW}  ⚠ Average MAPE (30d): ${avg_mape}% (ACCEPTABLE)${NC}"
        WARNING_ISSUES+=("Forecast accuracy ${avg_mape}% (target: <20%)")
    else
        echo -e "${RED}  ✗ Average MAPE (30d): ${avg_mape}% (POOR)${NC}"
        OVERALL_STATUS="DEGRADED"
        CRITICAL_ISSUES+=("Forecast accuracy ${avg_mape}% (threshold: 50%)")
    fi

    # Check forecast bias
    local avg_bias=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COALESCE(ROUND(AVG(bias)::numeric, 2), 0)
        FROM forecast_accuracy_metrics
        WHERE measurement_period_end >= CURRENT_DATE - 30
        AND bias IS NOT NULL;
    " 2>/dev/null | xargs)

    if [ ! -z "$avg_bias" ]; then
        if (( $(echo "${avg_bias#-} < 5" | bc -l) )); then
            echo -e "${GREEN}  ✓ Average Bias (30d): ${avg_bias}% (LOW)${NC}"
        elif (( $(echo "${avg_bias#-} < 10" | bc -l) )); then
            echo -e "${YELLOW}  ⚠ Average Bias (30d): ${avg_bias}% (MODERATE)${NC}"
        else
            echo -e "${RED}  ✗ Average Bias (30d): ${avg_bias}% (HIGH)${NC}"
            WARNING_ISSUES+=("High forecast bias: ${avg_bias}%")
        fi
    fi
}

check_replenishment_recommendations() {
    echo -e "${BLUE}[CHECK]${NC} Replenishment Recommendations..."

    # Check pending recommendations
    local pending_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM replenishment_suggestions
        WHERE suggestion_status = 'PENDING';
    " 2>/dev/null | xargs)

    if [ -z "$pending_count" ]; then
        echo -e "${YELLOW}  ⚠ Pending recommendations: UNKNOWN${NC}"
    elif [ "$pending_count" -eq 0 ]; then
        echo -e "${GREEN}  ✓ Pending recommendations: 0 (no urgent actions)${NC}"
    else
        echo -e "${GREEN}  ✓ Pending recommendations: $pending_count${NC}"
    fi

    # Check critical urgency recommendations
    local critical_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM replenishment_suggestions
        WHERE suggestion_status = 'PENDING'
        AND urgency_level = 'CRITICAL';
    " 2>/dev/null | xargs)

    if [ ! -z "$critical_count" ] && [ "$critical_count" -gt 0 ]; then
        echo -e "${RED}  ⚠ CRITICAL urgency: $critical_count recommendations${NC}"
        WARNING_ISSUES+=("$critical_count CRITICAL replenishment recommendations pending")
    fi
}

check_graphql_endpoints() {
    echo -e "${BLUE}[CHECK]${NC} GraphQL Endpoints..."

    # Check if GraphQL server is running
    if curl -s -f -X POST "$API_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __schema { types { name } } }"}' > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ GraphQL server: HEALTHY${NC}"
    else
        echo -e "${RED}  ✗ GraphQL server: UNAVAILABLE${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("GraphQL server unavailable at $API_URL/graphql")
        return
    fi

    # Test getDemandHistory query
    if curl -s -f -X POST "$API_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __type(name: \"Query\") { fields { name } } }"}' 2>/dev/null | grep -q "getDemandHistory"; then
        echo -e "${GREEN}  ✓ Query: getDemandHistory${NC}"
    else
        echo -e "${RED}  ✗ Query: getDemandHistory NOT FOUND${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("getDemandHistory query not available")
    fi

    # Test getMaterialForecasts query
    if curl -s -f -X POST "$API_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __type(name: \"Query\") { fields { name } } }"}' 2>/dev/null | grep -q "getMaterialForecasts"; then
        echo -e "${GREEN}  ✓ Query: getMaterialForecasts${NC}"
    else
        echo -e "${RED}  ✗ Query: getMaterialForecasts NOT FOUND${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("getMaterialForecasts query not available")
    fi

    # Test calculateSafetyStock query
    if curl -s -f -X POST "$API_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __type(name: \"Query\") { fields { name } } }"}' 2>/dev/null | grep -q "calculateSafetyStock"; then
        echo -e "${GREEN}  ✓ Query: calculateSafetyStock${NC}"
    else
        echo -e "${RED}  ✗ Query: calculateSafetyStock NOT FOUND${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("calculateSafetyStock query not available")
    fi

    # Test getForecastAccuracySummary query
    if curl -s -f -X POST "$API_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __type(name: \"Query\") { fields { name } } }"}' 2>/dev/null | grep -q "getForecastAccuracySummary"; then
        echo -e "${GREEN}  ✓ Query: getForecastAccuracySummary${NC}"
    else
        echo -e "${RED}  ✗ Query: getForecastAccuracySummary NOT FOUND${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("getForecastAccuracySummary query not available")
    fi

    # Test generateForecasts mutation
    if curl -s -f -X POST "$API_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __type(name: \"Mutation\") { fields { name } } }"}' 2>/dev/null | grep -q "generateForecasts"; then
        echo -e "${GREEN}  ✓ Mutation: generateForecasts${NC}"
    else
        echo -e "${RED}  ✗ Mutation: generateForecasts NOT FOUND${NC}"
        OVERALL_STATUS="UNHEALTHY"
        CRITICAL_ISSUES+=("generateForecasts mutation not available")
    fi
}

check_query_performance() {
    echo -e "${BLUE}[CHECK]${NC} Query Performance..."

    # Test demand history query performance
    local start=$(date +%s%N)
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT * FROM demand_history LIMIT 100;
    " > /dev/null 2>&1
    local end=$(date +%s%N)

    local query_time=$(( (end - start) / 1000000 ))  # Convert to milliseconds

    if [ "$query_time" -lt 100 ]; then
        echo -e "${GREEN}  ✓ Demand history query: ${query_time}ms (EXCELLENT)${NC}"
    elif [ "$query_time" -lt 500 ]; then
        echo -e "${GREEN}  ✓ Demand history query: ${query_time}ms (GOOD)${NC}"
    elif [ "$query_time" -lt 1000 ]; then
        echo -e "${YELLOW}  ⚠ Demand history query: ${query_time}ms (SLOW)${NC}"
        WARNING_ISSUES+=("Demand history query ${query_time}ms (target: <500ms)")
    else
        echo -e "${RED}  ✗ Demand history query: ${query_time}ms (VERY SLOW)${NC}"
        OVERALL_STATUS="DEGRADED"
        CRITICAL_ISSUES+=("Demand history query ${query_time}ms (threshold: 1000ms)")
    fi

    # Test forecast query performance
    start=$(date +%s%N)
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT * FROM material_forecasts LIMIT 100;
    " > /dev/null 2>&1
    end=$(date +%s%N)

    query_time=$(( (end - start) / 1000000 ))

    if [ "$query_time" -lt 100 ]; then
        echo -e "${GREEN}  ✓ Forecast query: ${query_time}ms (EXCELLENT)${NC}"
    elif [ "$query_time" -lt 500 ]; then
        echo -e "${GREEN}  ✓ Forecast query: ${query_time}ms (GOOD)${NC}"
    else
        echo -e "${YELLOW}  ⚠ Forecast query: ${query_time}ms (SLOW)${NC}"
        WARNING_ISSUES+=("Forecast query ${query_time}ms (target: <500ms)")
    fi
}

check_indexes() {
    echo -e "${BLUE}[CHECK]${NC} Database Indexes..."

    local indexes=("idx_demand_history_material_date_range" "idx_material_forecasts_lookup" "idx_forecast_accuracy_period")
    local missing_indexes=0

    for index in "${indexes[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -tc "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='$index')" 2>/dev/null | grep -q t; then
            echo -e "${GREEN}  ✓ Index exists: $index${NC}"
        else
            echo -e "${YELLOW}  ⚠ Index missing: $index${NC}"
            ((missing_indexes++))
        fi
    done

    if [ $missing_indexes -gt 0 ]; then
        WARNING_ISSUES+=("$missing_indexes performance indexes missing")
    fi
}

export_prometheus_metrics() {
    if [ "$PROMETHEUS_ENABLED" != "true" ]; then
        return
    fi

    echo ""
    echo -e "${BLUE}[METRICS]${NC} Prometheus Metrics Export..."

    # Forecast count metric
    local forecast_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COALESCE(COUNT(*), 0) FROM material_forecasts;
    " 2>/dev/null | xargs)

    # Average MAPE metric
    local avg_mape=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COALESCE(AVG(mape), 0)
        FROM forecast_accuracy_metrics
        WHERE measurement_period_end >= CURRENT_DATE - 30;
    " 2>/dev/null | xargs)

    # Pending recommendations metric
    local pending_recs=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COALESCE(COUNT(*), 0) FROM replenishment_suggestions
        WHERE suggestion_status = 'PENDING';
    " 2>/dev/null | xargs)

    cat > /tmp/inventory_forecasting_metrics.prom <<EOF
# HELP inventory_forecasts_total Total number of material forecasts
# TYPE inventory_forecasts_total gauge
inventory_forecasts_total ${forecast_count:-0}

# HELP forecast_accuracy_mape_percentage Average MAPE percentage (30-day window)
# TYPE forecast_accuracy_mape_percentage gauge
forecast_accuracy_mape_percentage ${avg_mape:-0}

# HELP replenishment_recommendations_pending Pending replenishment recommendations
# TYPE replenishment_recommendations_pending gauge
replenishment_recommendations_pending ${pending_recs:-0}

# HELP inventory_forecasting_health_status Overall system health status (0=UNHEALTHY, 1=DEGRADED, 2=HEALTHY)
# TYPE inventory_forecasting_health_status gauge
inventory_forecasting_health_status $([ "$OVERALL_STATUS" = "HEALTHY" ] && echo 2 || ([ "$OVERALL_STATUS" = "DEGRADED" ] && echo 1 || echo 0))
EOF

    echo -e "${GREEN}  ✓ Metrics exported to: /tmp/inventory_forecasting_metrics.prom${NC}"
}

send_alert() {
    if [ -z "$ALERT_WEBHOOK" ]; then
        return
    fi

    if [ "$OVERALL_STATUS" != "HEALTHY" ]; then
        echo ""
        echo -e "${BLUE}[ALERT]${NC} Sending alert notification..."

        local alert_message="Inventory Forecasting Health: $OVERALL_STATUS"

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
        echo -e "${BLUE}║${NC}  ${GREEN}Overall Status: HEALTHY ✓${NC}"
    elif [ "$OVERALL_STATUS" = "DEGRADED" ]; then
        echo -e "${BLUE}║${NC}  ${YELLOW}Overall Status: DEGRADED ⚠${NC}"
    else
        echo -e "${BLUE}║${NC}  ${RED}Overall Status: UNHEALTHY ✗${NC}"
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
        echo -e "${GREEN}All forecasting systems operational!${NC}"
    fi

    echo ""
}

main() {
    print_header
    check_database_connection
    check_forecasting_tables
    check_data_volume
    check_forecast_accuracy
    check_replenishment_recommendations
    check_graphql_endpoints
    check_query_performance
    check_indexes
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
