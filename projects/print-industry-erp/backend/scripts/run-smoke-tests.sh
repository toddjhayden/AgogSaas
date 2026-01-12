#!/bin/bash
# =====================================================
# Smoke Test Runner
# =====================================================
# REQ: REQ-STRATEGIC-AUTO-1767045901874
# Purpose: Run automated smoke tests after deployment
# Author: Roy (Backend Developer)
# Date: 2025-12-29
# =====================================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
GRAPHQL_URL="${GRAPHQL_URL:-http://localhost:4000/graphql}"
TENANT_ID="${TENANT_ID:-TEST_TENANT}"
USER_ID="${USER_ID:-TEST_USER}"
TEST_MODE="${TEST_MODE:-critical}" # critical or all

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   AgogSaaS ERP - Smoke Test Suite                         ║${NC}"
    echo -e "${BLUE}║   $(date '+%Y-%m-%d %H:%M:%S')                              ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

run_smoke_tests() {
    echo -e "${BLUE}[INFO]${NC} Running ${TEST_MODE} smoke tests..."
    echo -e "${BLUE}[INFO]${NC} GraphQL URL: $GRAPHQL_URL"
    echo -e "${BLUE}[INFO]${NC} Tenant ID: $TENANT_ID"
    echo ""

    local mutation="runCriticalSmokeTests"
    if [ "$TEST_MODE" = "all" ]; then
        mutation="runSmokeTests"
    fi

    # Run smoke tests via GraphQL
    response=$(curl -s -X POST "$GRAPHQL_URL" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: $TENANT_ID" \
        -H "X-User-ID: $USER_ID" \
        -d "{\"query\": \"mutation { $mutation }\"}" 2>&1)

    # Check if curl command succeeded
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR]${NC} Failed to connect to GraphQL endpoint"
        echo -e "${RED}[ERROR]${NC} Response: $response"
        exit 2
    fi

    # Check for GraphQL errors
    if echo "$response" | grep -q '"errors"'; then
        echo -e "${RED}[ERROR]${NC} GraphQL errors detected"
        echo "$response" | jq '.errors' 2>/dev/null || echo "$response"
        exit 2
    fi

    # Parse response
    local report=$(echo "$response" | jq -r ".data.$mutation" 2>/dev/null)

    if [ -z "$report" ] || [ "$report" = "null" ]; then
        echo -e "${RED}[ERROR]${NC} Invalid response from smoke tests"
        echo "$response"
        exit 2
    fi

    # Parse test results
    local overall_status=$(echo "$report" | jq -r '.overallStatus' 2>/dev/null)
    local total_tests=$(echo "$report" | jq -r '.totalTests' 2>/dev/null)
    local passed=$(echo "$report" | jq -r '.passed' 2>/dev/null)
    local failed=$(echo "$report" | jq -r '.failed' 2>/dev/null)
    local critical_failed=$(echo "$report" | jq -r '.criticalFailed' 2>/dev/null)
    local duration=$(echo "$report" | jq -r '.duration' 2>/dev/null)

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Smoke Test Results${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Total Tests:        ${BLUE}$total_tests${NC}"
    echo -e "  Passed:             ${GREEN}$passed${NC}"
    echo -e "  Failed:             ${RED}$failed${NC}"
    echo -e "  Critical Failed:    ${RED}$critical_failed${NC}"
    echo -e "  Duration:           ${BLUE}${duration}ms${NC}"
    echo -e "  Overall Status:     $(get_status_color "$overall_status")"
    echo ""

    # Print individual test results
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Individual Test Results${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""

    local test_count=$(echo "$report" | jq -r '.results | length' 2>/dev/null)
    for ((i=0; i<$test_count; i++)); do
        local test_name=$(echo "$report" | jq -r ".results[$i].testName" 2>/dev/null)
        local test_status=$(echo "$report" | jq -r ".results[$i].status" 2>/dev/null)
        local test_category=$(echo "$report" | jq -r ".results[$i].category" 2>/dev/null)
        local test_message=$(echo "$report" | jq -r ".results[$i].message" 2>/dev/null)
        local test_critical=$(echo "$report" | jq -r ".results[$i].critical" 2>/dev/null)
        local test_duration=$(echo "$report" | jq -r ".results[$i].duration" 2>/dev/null)

        local icon="✓"
        local color="$GREEN"
        if [ "$test_status" = "FAIL" ]; then
            icon="✗"
            color="$RED"
        fi

        local critical_marker=""
        if [ "$test_critical" = "true" ]; then
            critical_marker=" ${YELLOW}[CRITICAL]${NC}"
        fi

        echo -e "  ${color}${icon}${NC} ${test_category}/${test_name}${critical_marker}"
        echo -e "     ${test_message} (${test_duration}ms)"

        # Show error if failed
        if [ "$test_status" = "FAIL" ]; then
            local test_error=$(echo "$report" | jq -r ".results[$i].error" 2>/dev/null)
            if [ -n "$test_error" ] && [ "$test_error" != "null" ]; then
                echo -e "     ${RED}Error: $test_error${NC}"
            fi
        fi
        echo ""
    done

    # Return exit code based on overall status
    if [ "$overall_status" = "ALL_PASSED" ]; then
        echo -e "${GREEN}✅ All smoke tests PASSED${NC}"
        echo ""
        return 0
    elif [ "$overall_status" = "SOME_FAILED" ]; then
        echo -e "${YELLOW}⚠️  Some smoke tests failed (non-critical)${NC}"
        echo ""
        return 1
    else
        echo -e "${RED}❌ CRITICAL smoke tests FAILED - deployment blocked${NC}"
        echo ""
        return 2
    fi
}

get_status_color() {
    local status=$1
    if [ "$status" = "ALL_PASSED" ]; then
        echo -e "${GREEN}ALL_PASSED${NC}"
    elif [ "$status" = "SOME_FAILED" ]; then
        echo -e "${YELLOW}SOME_FAILED${NC}"
    else
        echo -e "${RED}CRITICAL_FAILED${NC}"
    fi
}

# Main execution
print_header

# Check dependencies
if ! command -v curl &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} curl is not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} jq is not installed"
    exit 1
fi

# Run smoke tests
run_smoke_tests
exit_code=$?

exit $exit_code
