#!/bin/bash

################################################################################
# HEALTH CHECK: Sales Quote Automation
################################################################################
# Purpose: Monitor health and performance of Sales Quote Automation feature
# Author: Berry (DevOps Engineer)
# Date: 2025-12-27
# Version: 1.0.0
################################################################################

set -e
set -u

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-erp_dev}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
API_ENDPOINT="${API_ENDPOINT:-http://localhost:3000/graphql}"

# Thresholds
MAX_RESPONSE_TIME_MS=2000
MIN_CONVERSION_RATE=20
MIN_MARGIN_PERCENT=15
MAX_ERROR_RATE=5

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

################################################################################
# Health Checks
################################################################################

check_database_tables() {
    log_info "Checking database tables..."

    TABLES=("quotes" "quote_lines" "pricing_rules" "customer_pricing")

    for TABLE in "${TABLES[@]}"; do
        TABLE_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$TABLE');" 2>/dev/null | tr -d '[:space:]')

        if [ "$TABLE_EXISTS" = "t" ]; then
            log_success "Table '$TABLE' exists"
        else
            log_error "Table '$TABLE' missing"
            return 1
        fi
    done

    return 0
}

check_database_performance() {
    log_info "Checking database performance..."

    # Check table sizes
    QUOTES_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM quotes;" 2>/dev/null | tr -d '[:space:]')
    QUOTE_LINES_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM quote_lines;" 2>/dev/null | tr -d '[:space:]')

    log_info "Quotes: $QUOTES_COUNT"
    log_info "Quote Lines: $QUOTE_LINES_COUNT"

    # Check for slow queries (queries taking >1 second)
    SLOW_QUERIES=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_stat_statements WHERE mean_exec_time > 1000 AND query LIKE '%quote%';" 2>/dev/null | tr -d '[:space:]' || echo "0")

    if [ "$SLOW_QUERIES" -gt 0 ]; then
        log_warning "$SLOW_QUERIES slow queries detected (>1s execution time)"
    else
        log_success "No slow queries detected"
    fi

    return 0
}

check_business_metrics() {
    log_info "Checking business metrics..."

    # Average margin percentage
    AVG_MARGIN=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COALESCE(ROUND(AVG(margin_percentage), 2), 0) FROM quotes WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';" 2>/dev/null | tr -d '[:space:]')

    if [ -n "$AVG_MARGIN" ] && [ "$AVG_MARGIN" != "0" ]; then
        if (( $(echo "$AVG_MARGIN >= $MIN_MARGIN_PERCENT" | bc -l) )); then
            log_success "Average margin: $AVG_MARGIN% (>= $MIN_MARGIN_PERCENT%)"
        else
            log_warning "Average margin: $AVG_MARGIN% (< $MIN_MARGIN_PERCENT%)"
        fi
    else
        log_info "Average margin: N/A (no quotes in last 7 days)"
    fi

    # Quote conversion rate
    TOTAL_QUOTES=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM quotes WHERE status IN ('ISSUED', 'ACCEPTED', 'REJECTED') AND created_at >= CURRENT_DATE - INTERVAL '30 days';" 2>/dev/null | tr -d '[:space:]')
    ACCEPTED_QUOTES=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM quotes WHERE status = 'ACCEPTED' AND created_at >= CURRENT_DATE - INTERVAL '30 days';" 2>/dev/null | tr -d '[:space:]')

    if [ -n "$TOTAL_QUOTES" ] && [ "$TOTAL_QUOTES" -gt 0 ]; then
        CONVERSION_RATE=$(echo "scale=2; $ACCEPTED_QUOTES * 100 / $TOTAL_QUOTES" | bc)

        if (( $(echo "$CONVERSION_RATE >= $MIN_CONVERSION_RATE" | bc -l) )); then
            log_success "Conversion rate: $CONVERSION_RATE% (>= $MIN_CONVERSION_RATE%)"
        else
            log_warning "Conversion rate: $CONVERSION_RATE% (< $MIN_CONVERSION_RATE%)"
        fi
    else
        log_info "Conversion rate: N/A (no quotes in last 30 days)"
    fi

    # Low margin quotes requiring approval
    LOW_MARGIN_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM quotes WHERE margin_percentage < $MIN_MARGIN_PERCENT AND created_at >= CURRENT_DATE - INTERVAL '7 days';" 2>/dev/null | tr -d '[:space:]')

    if [ -n "$LOW_MARGIN_COUNT" ] && [ "$LOW_MARGIN_COUNT" -gt 0 ]; then
        log_warning "$LOW_MARGIN_COUNT quotes with margin < $MIN_MARGIN_PERCENT% in last 7 days"
    else
        log_success "No low-margin quotes in last 7 days"
    fi

    return 0
}

check_data_quality() {
    log_info "Checking data quality..."

    # Quotes without customer
    QUOTES_NO_CUSTOMER=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM quotes WHERE customer_id IS NULL;" 2>/dev/null | tr -d '[:space:]')

    if [ "$QUOTES_NO_CUSTOMER" -eq 0 ]; then
        log_success "All quotes have customers"
    else
        log_error "$QUOTES_NO_CUSTOMER quotes missing customer_id"
    fi

    # Quote lines without product
    LINES_NO_PRODUCT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM quote_lines WHERE product_id IS NULL;" 2>/dev/null | tr -d '[:space:]')

    if [ "$LINES_NO_PRODUCT" -eq 0 ]; then
        log_success "All quote lines have products"
    else
        log_error "$LINES_NO_PRODUCT quote lines missing product_id"
    fi

    # Quotes with negative margins
    NEGATIVE_MARGINS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM quotes WHERE margin_percentage < 0;" 2>/dev/null | tr -d '[:space:]')

    if [ "$NEGATIVE_MARGINS" -eq 0 ]; then
        log_success "No quotes with negative margins"
    else
        log_warning "$NEGATIVE_MARGINS quotes with negative margins"
    fi

    return 0
}

check_api_health() {
    log_info "Checking GraphQL API health..."

    # Simple introspection query
    QUERY='{"query":"{ __schema { types { name } } }"}'

    RESPONSE=$(curl -s -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$QUERY" \
        -w "\n%{http_code}\n%{time_total}" 2>/dev/null || echo "000\n999")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n 2 | head -n 1)
    RESPONSE_TIME=$(echo "$RESPONSE" | tail -n 1)
    RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc | cut -d'.' -f1)

    if [ "$HTTP_CODE" = "200" ]; then
        log_success "API is responding (HTTP $HTTP_CODE)"

        if [ "$RESPONSE_TIME_MS" -lt "$MAX_RESPONSE_TIME_MS" ]; then
            log_success "Response time: ${RESPONSE_TIME_MS}ms (< ${MAX_RESPONSE_TIME_MS}ms)"
        else
            log_warning "Response time: ${RESPONSE_TIME_MS}ms (>= ${MAX_RESPONSE_TIME_MS}ms)"
        fi
    else
        log_error "API not responding (HTTP $HTTP_CODE)"
        return 1
    fi

    return 0
}

generate_health_report() {
    log_info "Generating health report..."

    REPORT_FILE="health_report_$(date +%Y%m%d_%H%M%S).txt"

    cat > "$REPORT_FILE" << EOF
Sales Quote Automation - Health Report
Generated: $(date +"%Y-%m-%d %H:%M:%S")

=== Database Health ===
Quotes Count: $QUOTES_COUNT
Quote Lines Count: $QUOTE_LINES_COUNT

=== Business Metrics (Last 7 Days) ===
Average Margin: $AVG_MARGIN%
Low Margin Quotes: $LOW_MARGIN_COUNT

=== Business Metrics (Last 30 Days) ===
Total Quotes: $TOTAL_QUOTES
Accepted Quotes: $ACCEPTED_QUOTES
Conversion Rate: $CONVERSION_RATE%

=== Data Quality ===
Quotes without Customer: $QUOTES_NO_CUSTOMER
Quote Lines without Product: $LINES_NO_PRODUCT
Quotes with Negative Margins: $NEGATIVE_MARGINS

=== API Health ===
HTTP Status: $HTTP_CODE
Response Time: ${RESPONSE_TIME_MS}ms
EOF

    log_success "Health report saved: $REPORT_FILE"
}

################################################################################
# Main
################################################################################

main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║   Sales Quote Automation - Health Check                             ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo ""

    TOTAL_CHECKS=0
    PASSED_CHECKS=0

    # Database Tables Check
    ((TOTAL_CHECKS++))
    if check_database_tables; then
        ((PASSED_CHECKS++))
    fi
    echo ""

    # Database Performance Check
    ((TOTAL_CHECKS++))
    if check_database_performance; then
        ((PASSED_CHECKS++))
    fi
    echo ""

    # Business Metrics Check
    ((TOTAL_CHECKS++))
    if check_business_metrics; then
        ((PASSED_CHECKS++))
    fi
    echo ""

    # Data Quality Check
    ((TOTAL_CHECKS++))
    if check_data_quality; then
        ((PASSED_CHECKS++))
    fi
    echo ""

    # API Health Check
    ((TOTAL_CHECKS++))
    if check_api_health; then
        ((PASSED_CHECKS++))
    fi
    echo ""

    # Generate Report
    generate_health_report
    echo ""

    # Summary
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║   Health Check Summary                                               ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo ""
    log_info "Checks Passed: $PASSED_CHECKS / $TOTAL_CHECKS"

    if [ "$PASSED_CHECKS" -eq "$TOTAL_CHECKS" ]; then
        log_success "All health checks passed!"
        exit 0
    else
        log_warning "Some health checks failed. Review the output above."
        exit 1
    fi
}

main "$@"
