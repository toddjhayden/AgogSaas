#!/bin/bash
# REQ-STRATEGIC-AUTO-1766568547079: Continuous Monitoring Script
# Agent: Berry (DevOps Specialist)
# Purpose: Real-time monitoring dashboard for bin optimization system
# Updated: 2025-12-27

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-agogsaas}"
DB_USER="${DB_USER:-postgres}"
API_URL="${API_URL:-http://localhost:4000}"
REFRESH_INTERVAL="${REFRESH_INTERVAL:-5}"

# Function to clear screen and show header
show_header() {
    clear
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  BIN OPTIMIZATION SYSTEM - REAL-TIME MONITORING DASHBOARD              ║${NC}"
    echo -e "${CYAN}║  REQ-STRATEGIC-AUTO-1766568547079                                      ║${NC}"
    echo -e "${CYAN}║  $(date)                                    ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Function to get system metrics
get_system_metrics() {
    echo -e "${BLUE}┌─ SYSTEM METRICS ────────────────────────────────────────────────────────┐${NC}"

    # Cache status
    local cache_stats=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT
            COUNT(*) as total_entries,
            ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_updated)))/60, 1) as age_minutes,
            COUNT(DISTINCT facility_id) as facilities,
            COUNT(DISTINCT zone) as zones
        FROM bin_utilization_cache;
    " 2>/dev/null)

    if [ ! -z "$cache_stats" ]; then
        local entries=$(echo "$cache_stats" | awk '{print $1}')
        local age=$(echo "$cache_stats" | awk '{print $2}')
        local facilities=$(echo "$cache_stats" | awk '{print $3}')
        local zones=$(echo "$cache_stats" | awk '{print $4}')

        echo -e "${CYAN}  Cache Entries:${NC} $entries"

        if (( $(echo "$age < 15" | bc -l) )); then
            echo -e "${CYAN}  Cache Age:${NC} ${GREEN}$age minutes (FRESH)${NC}"
        elif (( $(echo "$age < 30" | bc -l) )); then
            echo -e "${CYAN}  Cache Age:${NC} ${YELLOW}$age minutes (AGING)${NC}"
        else
            echo -e "${CYAN}  Cache Age:${NC} ${RED}$age minutes (STALE)${NC}"
        fi

        echo -e "${CYAN}  Facilities:${NC} $facilities"
        echo -e "${CYAN}  Zones:${NC} $zones"
    else
        echo -e "${RED}  Cache Status: UNAVAILABLE${NC}"
    fi

    # Database connection pool
    local db_connections=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '$DB_NAME';
    " 2>/dev/null | xargs)

    echo -e "${CYAN}  Active DB Connections:${NC} $db_connections / 200"

    echo -e "${BLUE}└─────────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

# Function to get performance metrics
get_performance_metrics() {
    echo -e "${BLUE}┌─ PERFORMANCE METRICS ───────────────────────────────────────────────────┐${NC}"

    # Query performance test
    local start=$(date +%s%N)
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT * FROM bin_utilization_cache LIMIT 10;
    " > /dev/null 2>&1
    local end=$(date +%s%N)
    local query_time=$(( (end - start) / 1000000 ))

    if [ "$query_time" -lt 100 ]; then
        echo -e "${CYAN}  Cache Query Time:${NC} ${GREEN}${query_time}ms (EXCELLENT)${NC}"
    elif [ "$query_time" -lt 500 ]; then
        echo -e "${CYAN}  Cache Query Time:${NC} ${YELLOW}${query_time}ms (ACCEPTABLE)${NC}"
    else
        echo -e "${CYAN}  Cache Query Time:${NC} ${RED}${query_time}ms (SLOW)${NC}"
    fi

    # Recent recommendations
    local recommendations=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as last_24h
        FROM putaway_recommendations;
    " 2>/dev/null)

    if [ ! -z "$recommendations" ]; then
        local total=$(echo "$recommendations" | awk '{print $1}')
        local last_hour=$(echo "$recommendations" | awk '{print $2}')
        local last_24h=$(echo "$recommendations" | awk '{print $3}')

        echo -e "${CYAN}  Total Recommendations:${NC} $total"
        echo -e "${CYAN}  Last Hour:${NC} $last_hour"
        echo -e "${CYAN}  Last 24 Hours:${NC} $last_24h"
    fi

    echo -e "${BLUE}└─────────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

# Function to get ML model metrics
get_ml_metrics() {
    echo -e "${BLUE}┌─ ML MODEL PERFORMANCE ──────────────────────────────────────────────────┐${NC}"

    # ML accuracy
    local ml_stats=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT
            COUNT(*) FILTER (WHERE user_feedback IS NOT NULL) as feedback_count,
            ROUND(100.0 * COUNT(*) FILTER (WHERE was_accepted = TRUE)::numeric / NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0), 1) as accuracy_pct,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days' AND user_feedback IS NOT NULL) as recent_feedback
        FROM putaway_recommendations;
    " 2>/dev/null)

    if [ ! -z "$ml_stats" ]; then
        local feedback_count=$(echo "$ml_stats" | awk '{print $1}')
        local accuracy=$(echo "$ml_stats" | awk '{print $2}')
        local recent=$(echo "$ml_stats" | awk '{print $3}')

        echo -e "${CYAN}  Total Feedback Samples:${NC} $feedback_count"
        echo -e "${CYAN}  Recent Feedback (7d):${NC} $recent"

        if [ "$accuracy" != "" ] && [ "$accuracy" != "0" ]; then
            if (( $(echo "$accuracy >= 80" | bc -l) )); then
                echo -e "${CYAN}  Model Accuracy:${NC} ${GREEN}${accuracy}% (EXCELLENT)${NC}"
            elif (( $(echo "$accuracy >= 70" | bc -l) )); then
                echo -e "${CYAN}  Model Accuracy:${NC} ${YELLOW}${accuracy}% (ACCEPTABLE)${NC}"
            else
                echo -e "${CYAN}  Model Accuracy:${NC} ${RED}${accuracy}% (POOR)${NC}"
            fi
        else
            echo -e "${CYAN}  Model Accuracy:${NC} ${YELLOW}INSUFFICIENT DATA${NC}"
        fi
    fi

    # Model weights
    local model_info=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT model_name, accuracy_pct, total_predictions, last_trained
        FROM ml_model_weights
        WHERE model_name = 'putaway_confidence_adjuster'
        LIMIT 1;
    " 2>/dev/null)

    if [ ! -z "$model_info" ]; then
        echo -e "${CYAN}  Model Last Trained:${NC} $(echo $model_info | awk '{print $4, $5}')"
    fi

    echo -e "${BLUE}└─────────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

# Function to get data quality metrics
get_data_quality() {
    echo -e "${BLUE}┌─ DATA QUALITY STATUS ───────────────────────────────────────────────────┐${NC}"

    # Capacity failures
    local capacity_failures=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE resolved = FALSE) as unresolved,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
        FROM capacity_validation_failures;
    " 2>/dev/null)

    if [ ! -z "$capacity_failures" ]; then
        local total=$(echo "$capacity_failures" | awk '{print $1}')
        local unresolved=$(echo "$capacity_failures" | awk '{print $2}')
        local last_24h=$(echo "$capacity_failures" | awk '{print $3}')

        echo -e "${CYAN}  Total Capacity Failures:${NC} $total"

        if [ "$unresolved" -eq 0 ]; then
            echo -e "${CYAN}  Unresolved:${NC} ${GREEN}$unresolved (CLEAN)${NC}"
        elif [ "$unresolved" -lt 5 ]; then
            echo -e "${CYAN}  Unresolved:${NC} ${YELLOW}$unresolved (REVIEW)${NC}"
        else
            echo -e "${CYAN}  Unresolved:${NC} ${RED}$unresolved (ACTION REQUIRED)${NC}"
        fi

        echo -e "${CYAN}  Last 24 Hours:${NC} $last_24h"
    fi

    # Material dimension issues
    local dimension_issues=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM materials
        WHERE width_inches IS NULL OR height_inches IS NULL OR length_inches IS NULL;
    " 2>/dev/null | xargs)

    if [ ! -z "$dimension_issues" ]; then
        if [ "$dimension_issues" -eq 0 ]; then
            echo -e "${CYAN}  Missing Dimensions:${NC} ${GREEN}$dimension_issues (CLEAN)${NC}"
        else
            echo -e "${CYAN}  Missing Dimensions:${NC} ${YELLOW}$dimension_issues (REVIEW)${NC}"
        fi
    fi

    # Cross-dock opportunities
    local cross_dock=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM cross_dock_cancellations
        WHERE created_at > NOW() - INTERVAL '7 days';
    " 2>/dev/null | xargs)

    if [ ! -z "$cross_dock" ]; then
        echo -e "${CYAN}  Cross-Dock Cancellations (7d):${NC} $cross_dock"
    fi

    echo -e "${BLUE}└─────────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

# Function to get utilization stats
get_utilization_stats() {
    echo -e "${BLUE}┌─ WAREHOUSE UTILIZATION ─────────────────────────────────────────────────┐${NC}"

    # Overall utilization
    local utilization=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT
            ROUND(AVG(utilization_pct), 1) as avg_utilization,
            ROUND(MIN(utilization_pct), 1) as min_utilization,
            ROUND(MAX(utilization_pct), 1) as max_utilization,
            COUNT(*) FILTER (WHERE utilization_pct > 80) as over_80pct
        FROM bin_utilization_cache;
    " 2>/dev/null)

    if [ ! -z "$utilization" ]; then
        local avg=$(echo "$utilization" | awk '{print $1}')
        local min=$(echo "$utilization" | awk '{print $2}')
        local max=$(echo "$utilization" | awk '{print $3}')
        local over_80=$(echo "$utilization" | awk '{print $4}')

        echo -e "${CYAN}  Average Utilization:${NC} ${avg}%"
        echo -e "${CYAN}  Min / Max:${NC} ${min}% / ${max}%"

        if [ "$over_80" -gt 0 ]; then
            echo -e "${CYAN}  Bins Over 80%:${NC} ${YELLOW}$over_80 (REVIEW)${NC}"
        else
            echo -e "${CYAN}  Bins Over 80%:${NC} ${GREEN}$over_80 (OPTIMAL)${NC}"
        fi
    fi

    # By ABC classification
    local abc_stats=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT
            abc_class,
            COUNT(*) as count,
            ROUND(AVG(utilization_pct), 1) as avg_util
        FROM bin_utilization_cache
        GROUP BY abc_class
        ORDER BY abc_class;
    " 2>/dev/null)

    if [ ! -z "$abc_stats" ]; then
        echo ""
        echo -e "${CYAN}  ABC Classification Breakdown:${NC}"
        echo "$abc_stats" | while read line; do
            local class=$(echo "$line" | awk '{print $1}')
            local count=$(echo "$line" | awk '{print $2}')
            local util=$(echo "$line" | awk '{print $3}')
            echo -e "    ${class}: ${count} bins, ${util}% avg utilization"
        done
    fi

    echo -e "${BLUE}└─────────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

# Function to get recent activity
get_recent_activity() {
    echo -e "${BLUE}┌─ RECENT ACTIVITY (Last 10 Events) ─────────────────────────────────────┐${NC}"

    local recent=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT
            TO_CHAR(created_at, 'HH24:MI:SS') as time,
            material_id,
            recommended_location_id,
            CASE
                WHEN was_accepted = TRUE THEN 'ACCEPTED'
                WHEN was_accepted = FALSE THEN 'REJECTED'
                ELSE 'PENDING'
            END as status
        FROM putaway_recommendations
        ORDER BY created_at DESC
        LIMIT 10;
    " 2>/dev/null)

    if [ ! -z "$recent" ]; then
        echo "$recent" | while read line; do
            local time=$(echo "$line" | awk '{print $1}')
            local material=$(echo "$line" | awk '{print $2}')
            local location=$(echo "$line" | awk '{print $3}')
            local status=$(echo "$line" | awk '{print $4}')

            if [ "$status" = "ACCEPTED" ]; then
                echo -e "  ${GREEN}✓${NC} ${time} | ${material} → ${location}"
            elif [ "$status" = "REJECTED" ]; then
                echo -e "  ${RED}✗${NC} ${time} | ${material} → ${location}"
            else
                echo -e "  ${YELLOW}○${NC} ${time} | ${material} → ${location}"
            fi
        done
    else
        echo -e "  ${YELLOW}No recent activity${NC}"
    fi

    echo -e "${BLUE}└─────────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

# Function to show alerts and warnings
show_alerts() {
    echo -e "${BLUE}┌─ ALERTS & WARNINGS ─────────────────────────────────────────────────────┐${NC}"

    local alert_count=0

    # Check cache age
    local cache_age=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT EXTRACT(EPOCH FROM (NOW() - MAX(last_updated)))/60
        FROM bin_utilization_cache;
    " 2>/dev/null | xargs)

    if [ ! -z "$cache_age" ] && (( $(echo "$cache_age > 30" | bc -l) )); then
        echo -e "  ${RED}⚠ CRITICAL:${NC} Cache age ${cache_age%.*} minutes (>30 min threshold)"
        alert_count=$((alert_count + 1))
    elif [ ! -z "$cache_age" ] && (( $(echo "$cache_age > 15" | bc -l) )); then
        echo -e "  ${YELLOW}⚠ WARNING:${NC} Cache age ${cache_age%.*} minutes (>15 min threshold)"
        alert_count=$((alert_count + 1))
    fi

    # Check ML accuracy
    local ml_accuracy=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COALESCE(
            ROUND(100.0 * COUNT(*) FILTER (WHERE was_accepted = TRUE)::numeric / NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0), 1),
            0
        )
        FROM putaway_recommendations
        WHERE created_at > NOW() - INTERVAL '7 days';
    " 2>/dev/null | xargs)

    if [ ! -z "$ml_accuracy" ] && [ "$ml_accuracy" != "0" ] && (( $(echo "$ml_accuracy < 70" | bc -l) )); then
        echo -e "  ${RED}⚠ CRITICAL:${NC} ML accuracy ${ml_accuracy}% (<70% threshold)"
        alert_count=$((alert_count + 1))
    elif [ ! -z "$ml_accuracy" ] && [ "$ml_accuracy" != "0" ] && (( $(echo "$ml_accuracy < 80" | bc -l) )); then
        echo -e "  ${YELLOW}⚠ WARNING:${NC} ML accuracy ${ml_accuracy}% (<80% threshold)"
        alert_count=$((alert_count + 1))
    fi

    # Check unresolved capacity failures
    local failures=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM capacity_validation_failures
        WHERE resolved = FALSE AND created_at > NOW() - INTERVAL '24 hours';
    " 2>/dev/null | xargs)

    if [ ! -z "$failures" ] && [ "$failures" -gt 5 ]; then
        echo -e "  ${RED}⚠ CRITICAL:${NC} ${failures} unresolved capacity failures in last 24h"
        alert_count=$((alert_count + 1))
    elif [ ! -z "$failures" ] && [ "$failures" -gt 0 ]; then
        echo -e "  ${YELLOW}⚠ WARNING:${NC} ${failures} unresolved capacity failures in last 24h"
        alert_count=$((alert_count + 1))
    fi

    # Check statistical outliers
    local outliers=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM bin_optimization_outliers
        WHERE outlier_severity IN ('SEVERE', 'EXTREME')
        AND requires_investigation = TRUE
        AND investigation_status = 'PENDING';
    " 2>/dev/null | xargs)

    if [ ! -z "$outliers" ] && [ "$outliers" -gt 0 ]; then
        echo -e "  ${YELLOW}⚠ WARNING:${NC} ${outliers} critical outliers pending investigation"
        alert_count=$((alert_count + 1))
    fi

    if [ $alert_count -eq 0 ]; then
        echo -e "  ${GREEN}✓ No active alerts${NC}"
    fi

    echo -e "${BLUE}└─────────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

# Function to show footer
show_footer() {
    echo -e "${CYAN}Press Ctrl+C to exit | Refreshing every ${REFRESH_INTERVAL} seconds${NC}"
}

# Main monitoring loop
main() {
    while true; do
        show_header
        get_system_metrics
        get_performance_metrics
        get_ml_metrics
        get_data_quality
        get_utilization_stats
        get_recent_activity
        show_alerts
        show_footer

        sleep "$REFRESH_INTERVAL"
    done
}

# Trap Ctrl+C
trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT

# Run main loop
main "$@"
