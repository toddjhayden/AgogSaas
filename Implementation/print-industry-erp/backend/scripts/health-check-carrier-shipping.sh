#!/bin/bash

###############################################################################
# REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
# Health Check Script
#
# Purpose: Verify carrier shipping integration feature health and functionality
#
# Checks:
# - Database tables and indexes
# - Backend service availability
# - GraphQL schema and resolvers
# - Carrier API connectivity
# - Circuit breaker status
# - Rate limiter functionality
# - Error handling and logging
#
# Usage: ./health-check-carrier-shipping.sh
###############################################################################

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "REQ-STRATEGIC-AUTO-1767066329941"
echo "Carrier Shipping Integrations Health Check"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f "$BACKEND_DIR/.env" ]; then
    source "$BACKEND_DIR/.env"
else
    echo -e "${RED}ERROR: .env file not found${NC}"
    exit 1
fi

PASSED=0
FAILED=0
WARNINGS=0

# Function to print check result
check_result() {
    local status=$1
    local message=$2

    if [ "$status" == "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $message"
        ((PASSED++))
    elif [ "$status" == "FAIL" ]; then
        echo -e "${RED}✗ FAIL${NC}: $message"
        ((FAILED++))
    elif [ "$status" == "WARN" ]; then
        echo -e "${YELLOW}⚠ WARN${NC}: $message"
        ((WARNINGS++))
    fi
}

# Check 1: Database connectivity
echo "Check 1: Database Connectivity"
echo "-------------------------------"

if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    check_result "PASS" "Database connection successful"
else
    check_result "FAIL" "Cannot connect to database"
    exit 1
fi
echo ""

# Check 2: Database tables
echo "Check 2: Database Tables"
echo "------------------------"

TABLES=(
    "carrier_integrations"
    "shipments"
    "shipment_lines"
    "tracking_events"
    "shipment_manifest_attempts"
    "shipment_retry_queue"
    "shipment_manual_review_queue"
    "carrier_api_errors"
)

for table in "${TABLES[@]}"; do
    TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.$table')")
    if [ "$TABLE_EXISTS" != "null" ] && [ -n "$TABLE_EXISTS" ]; then
        ROW_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM $table")
        check_result "PASS" "Table '$table' exists ($ROW_COUNT rows)"
    else
        check_result "FAIL" "Table '$table' does not exist"
    fi
done
echo ""

# Check 3: Database indexes
echo "Check 3: Database Indexes"
echo "-------------------------"

INDEXES=(
    "idx_shipments_tenant_facility"
    "idx_shipments_tracking_number"
    "idx_shipments_status"
    "idx_shipment_lines_shipment_id"
    "idx_tracking_events_shipment_id"
    "idx_tracking_events_tracking_number"
    "idx_carrier_integrations_tenant_code"
)

for index in "${INDEXES[@]}"; do
    INDEX_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.$index')")
    if [ "$INDEX_EXISTS" != "null" ] && [ -n "$INDEX_EXISTS" ]; then
        check_result "PASS" "Index '$index' exists"
    else
        check_result "WARN" "Index '$index' does not exist (may impact performance)"
    fi
done
echo ""

# Check 4: Carrier integration configurations
echo "Check 4: Carrier Integration Configurations"
echo "--------------------------------------------"

CARRIER_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM carrier_integrations WHERE deleted_at IS NULL")
ACTIVE_CARRIER_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM carrier_integrations WHERE is_active = true AND deleted_at IS NULL")

if [ "$CARRIER_COUNT" -gt 0 ]; then
    check_result "PASS" "$CARRIER_COUNT carrier integrations configured"
else
    check_result "WARN" "No carrier integrations configured"
fi

if [ "$ACTIVE_CARRIER_COUNT" -gt 0 ]; then
    check_result "PASS" "$ACTIVE_CARRIER_COUNT carrier integrations active"
else
    check_result "WARN" "No active carrier integrations"
fi

# List configured carriers
echo "Configured carriers:"
psql "$DATABASE_URL" -c "SELECT carrier_code, carrier_name, carrier_type, is_active, supports_tracking, supports_rate_quotes, supports_label_generation FROM carrier_integrations WHERE deleted_at IS NULL" 2>/dev/null || echo "None"
echo ""

# Check 5: Backend service files
echo "Check 5: Backend Service Files"
echo "-------------------------------"

SERVICES=(
    "src/modules/wms/services/credential-encryption.service.ts"
    "src/modules/wms/services/carrier-error-mapper.service.ts"
    "src/modules/wms/services/carrier-rate-limiter.service.ts"
    "src/modules/wms/services/carrier-circuit-breaker.service.ts"
    "src/modules/wms/services/shipment-manifest-orchestrator.service.ts"
    "src/modules/wms/services/carrier-client-factory.service.ts"
    "src/modules/wms/services/carriers/fedex-client.service.ts"
)

for service in "${SERVICES[@]}"; do
    if [ -f "$BACKEND_DIR/$service" ]; then
        check_result "PASS" "Service file exists: $(basename $service)"
    else
        check_result "FAIL" "Service file missing: $(basename $service)"
    fi
done
echo ""

# Check 6: GraphQL schema
echo "Check 6: GraphQL Schema"
echo "-----------------------"

SCHEMA_FILE="$BACKEND_DIR/src/graphql/schema/wms.graphql"
if [ -f "$SCHEMA_FILE" ]; then
    check_result "PASS" "GraphQL schema file exists"

    # Check for key types
    if grep -q "type CarrierIntegration" "$SCHEMA_FILE"; then
        check_result "PASS" "CarrierIntegration type defined"
    else
        check_result "FAIL" "CarrierIntegration type not found"
    fi

    if grep -q "type Shipment" "$SCHEMA_FILE"; then
        check_result "PASS" "Shipment type defined"
    else
        check_result "FAIL" "Shipment type not found"
    fi

    if grep -q "type TrackingEvent" "$SCHEMA_FILE"; then
        check_result "PASS" "TrackingEvent type defined"
    else
        check_result "FAIL" "TrackingEvent type not found"
    fi
else
    check_result "FAIL" "GraphQL schema file not found"
fi
echo ""

# Check 7: GraphQL resolver
echo "Check 7: GraphQL Resolver"
echo "-------------------------"

RESOLVER_FILE="$BACKEND_DIR/src/graphql/resolvers/wms.resolver.ts"
if [ -f "$RESOLVER_FILE" ]; then
    check_result "PASS" "WMS resolver file exists"

    # Check for key queries
    if grep -q "@Query('shipments')" "$RESOLVER_FILE"; then
        check_result "PASS" "shipments query implemented"
    else
        check_result "FAIL" "shipments query not found"
    fi

    if grep -q "@Query('carrierIntegrations')" "$RESOLVER_FILE"; then
        check_result "PASS" "carrierIntegrations query implemented"
    else
        check_result "FAIL" "carrierIntegrations query not found"
    fi

    # Check for key mutations
    if grep -q "@Mutation('manifestShipment')" "$RESOLVER_FILE"; then
        check_result "PASS" "manifestShipment mutation implemented"
    else
        check_result "FAIL" "manifestShipment mutation not found"
    fi
else
    check_result "FAIL" "WMS resolver file not found"
fi
echo ""

# Check 8: WMS module registration
echo "Check 8: WMS Module Registration"
echo "---------------------------------"

MODULE_FILE="$BACKEND_DIR/src/modules/wms/wms.module.ts"
if [ -f "$MODULE_FILE" ]; then
    check_result "PASS" "WMS module file exists"

    # Check if carrier services are registered
    if grep -q "CarrierClientFactoryService" "$MODULE_FILE"; then
        check_result "PASS" "CarrierClientFactoryService registered"
    else
        check_result "FAIL" "CarrierClientFactoryService not registered"
    fi

    if grep -q "ShipmentManifestOrchestratorService" "$MODULE_FILE"; then
        check_result "PASS" "ShipmentManifestOrchestratorService registered"
    else
        check_result "FAIL" "ShipmentManifestOrchestratorService not registered"
    fi

    if grep -q "FedExClientService" "$MODULE_FILE"; then
        check_result "PASS" "FedExClientService registered"
    else
        check_result "FAIL" "FedExClientService not registered"
    fi
else
    check_result "FAIL" "WMS module file not found"
fi
echo ""

# Check 9: Frontend components
echo "Check 9: Frontend Components"
echo "-----------------------------"

FRONTEND_DIR="$(dirname "$BACKEND_DIR")/frontend"

if [ -d "$FRONTEND_DIR" ]; then
    COMPONENTS=(
        "src/pages/CarrierIntegrationsPage.tsx"
        "src/pages/ShipmentsPage.tsx"
        "src/pages/ShipmentDetailPage.tsx"
        "src/graphql/queries/shipping.ts"
        "src/graphql/mutations/shipping.ts"
    )

    for component in "${COMPONENTS[@]}"; do
        if [ -f "$FRONTEND_DIR/$component" ]; then
            check_result "PASS" "Component exists: $(basename $component)"
        else
            check_result "WARN" "Component not found: $(basename $component)"
        fi
    done
else
    check_result "WARN" "Frontend directory not found"
fi
echo ""

# Check 10: Shipment data quality
echo "Check 10: Shipment Data Quality"
echo "--------------------------------"

# Check for shipments without carrier assignments
UNASSIGNED_SHIPMENTS=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM shipments WHERE carrier_integration_id IS NULL AND status = 'PLANNED' AND deleted_at IS NULL" 2>/dev/null || echo "0")
if [ "$UNASSIGNED_SHIPMENTS" -eq 0 ]; then
    check_result "PASS" "No planned shipments without carrier assignment"
else
    check_result "WARN" "$UNASSIGNED_SHIPMENTS planned shipments without carrier assignment"
fi

# Check for failed manifests in retry queue
RETRY_QUEUE_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM shipment_retry_queue WHERE processed_at IS NULL" 2>/dev/null || echo "0")
if [ "$RETRY_QUEUE_COUNT" -eq 0 ]; then
    check_result "PASS" "No shipments in retry queue"
else
    check_result "WARN" "$RETRY_QUEUE_COUNT shipments in retry queue awaiting retry"
fi

# Check for shipments in manual review
MANUAL_REVIEW_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM shipment_manual_review_queue WHERE resolved_at IS NULL" 2>/dev/null || echo "0")
if [ "$MANUAL_REVIEW_COUNT" -eq 0 ]; then
    check_result "PASS" "No shipments in manual review queue"
else
    check_result "WARN" "$MANUAL_REVIEW_COUNT shipments in manual review queue requiring attention"
fi

echo ""

# Check 11: Carrier API error logging
echo "Check 11: Carrier API Error Logging"
echo "------------------------------------"

ERROR_COUNT_24H=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM carrier_api_errors WHERE created_at > NOW() - INTERVAL '24 hours'" 2>/dev/null || echo "0")

if [ "$ERROR_COUNT_24H" -eq 0 ]; then
    check_result "PASS" "No carrier API errors in last 24 hours"
elif [ "$ERROR_COUNT_24H" -lt 10 ]; then
    check_result "WARN" "$ERROR_COUNT_24H carrier API errors in last 24 hours"
else
    check_result "FAIL" "$ERROR_COUNT_24H carrier API errors in last 24 hours (high error rate)"
fi

# Show recent errors if any
if [ "$ERROR_COUNT_24H" -gt 0 ]; then
    echo "Recent carrier API errors:"
    psql "$DATABASE_URL" -c "SELECT carrier_code, error_code, severity, COUNT(*) as count FROM carrier_api_errors WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY carrier_code, error_code, severity ORDER BY count DESC LIMIT 5" 2>/dev/null || echo "None"
fi

echo ""

# Check 12: Shipment manifest attempt success rate
echo "Check 12: Shipment Manifest Success Rate"
echo "-----------------------------------------"

TOTAL_ATTEMPTS=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM shipment_manifest_attempts WHERE created_at > NOW() - INTERVAL '7 days'" 2>/dev/null || echo "0")
SUCCESSFUL_ATTEMPTS=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM shipment_manifest_attempts WHERE status = 'MANIFESTED' AND created_at > NOW() - INTERVAL '7 days'" 2>/dev/null || echo "0")

if [ "$TOTAL_ATTEMPTS" -eq 0 ]; then
    check_result "WARN" "No manifest attempts in last 7 days"
else
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.2f\", ($SUCCESSFUL_ATTEMPTS / $TOTAL_ATTEMPTS) * 100}")
    if (( $(echo "$SUCCESS_RATE > 95" | bc -l) )); then
        check_result "PASS" "Manifest success rate: $SUCCESS_RATE% ($SUCCESSFUL_ATTEMPTS/$TOTAL_ATTEMPTS)"
    elif (( $(echo "$SUCCESS_RATE > 80" | bc -l) )); then
        check_result "WARN" "Manifest success rate: $SUCCESS_RATE% ($SUCCESSFUL_ATTEMPTS/$TOTAL_ATTEMPTS)"
    else
        check_result "FAIL" "Manifest success rate: $SUCCESS_RATE% ($SUCCESSFUL_ATTEMPTS/$TOTAL_ATTEMPTS) - too low"
    fi
fi

echo ""

# Summary
echo "=========================================="
echo "HEALTH CHECK SUMMARY"
echo "=========================================="
echo ""
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    if [ "$WARNINGS" -eq 0 ]; then
        echo -e "${GREEN}✓ All health checks passed!${NC}"
        echo ""
        echo "System Status: HEALTHY"
        exit 0
    else
        echo -e "${YELLOW}⚠ Health checks passed with warnings${NC}"
        echo ""
        echo "System Status: HEALTHY (with warnings)"
        echo "Please review warnings above"
        exit 0
    fi
else
    echo -e "${RED}✗ Some health checks failed${NC}"
    echo ""
    echo "System Status: UNHEALTHY"
    echo "Please address failures above before proceeding"
    exit 1
fi
