#!/bin/bash
# =====================================================
# Health Check Script: Real-Time Production Analytics Dashboard
# =====================================================
# REQ: REQ-STRATEGIC-AUTO-1767048328660
# Author: Berry (DevOps Engineer)
# Date: 2025-12-29
# =====================================================

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "======================================================"
echo "Production Analytics Dashboard - Health Check"
echo "REQ-STRATEGIC-AUTO-1767048328660"
echo "======================================================"
echo ""

# Database connection
DB_CONTAINER="agogsaas-app-postgres"
DB_USER="agogsaas_user"
DB_NAME="agogsaas"
DB_PASSWORD="${DB_PASSWORD:-changeme}"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# =====================================================
# 1. Check Docker Containers
# =====================================================
echo -e "${BLUE}[1/7] Checking Docker Containers${NC}"

if docker ps | grep -q "agogsaas-app-postgres"; then
    echo -e "${GREEN}✓${NC} PostgreSQL container running"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗${NC} PostgreSQL container not running"
    ((FAIL_COUNT++))
fi

if docker ps | grep -q "agogsaas-app-backend"; then
    echo -e "${GREEN}✓${NC} Backend container running"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗${NC} Backend container not running"
    ((FAIL_COUNT++))
fi

if docker ps | grep -q "agogsaas-app-frontend"; then
    echo -e "${GREEN}✓${NC} Frontend container running"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗${NC} Frontend container not running"
    ((FAIL_COUNT++))
fi

# =====================================================
# 2. Check Database Tables
# =====================================================
echo ""
echo -e "${BLUE}[2/7] Checking Database Tables${NC}"

for table in "production_runs" "oee_calculations" "equipment_status_log" "work_centers"; do
    TABLE_EXISTS=$(docker exec -e PGPASSWORD=$DB_PASSWORD $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='$table';" 2>&1 | tr -d ' ')

    if [[ "$TABLE_EXISTS" == "1" ]]; then
        echo -e "${GREEN}✓${NC} Table '$table' exists"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗${NC} Table '$table' not found"
        ((FAIL_COUNT++))
    fi
done

# =====================================================
# 3. Check Database Indexes
# =====================================================
echo ""
echo -e "${BLUE}[3/7] Checking Production Analytics Indexes${NC}"

# Count production analytics indexes
INDEX_COUNT=$(docker exec -e PGPASSWORD=$DB_PASSWORD $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname='public'
  AND (
    indexname LIKE 'idx_production_runs_active%'
    OR indexname LIKE 'idx_production_runs_today%'
    OR indexname LIKE 'idx_production_runs_recent%'
    OR indexname LIKE 'idx_oee_current%'
    OR indexname LIKE 'idx_oee_trends%'
    OR indexname LIKE 'idx_oee_low%'
    OR indexname LIKE 'idx_equipment_status_current'
    OR indexname LIKE 'idx_equipment_status_breakdown%'
    OR indexname LIKE 'idx_work_centers_active%'
  );
" 2>&1 | tr -d ' ')

if [[ "$INDEX_COUNT" -ge "7" ]]; then
    echo -e "${GREEN}✓${NC} Production analytics indexes found (${INDEX_COUNT} indexes)"
    ((PASS_COUNT++))
elif [[ "$INDEX_COUNT" -gt "0" ]]; then
    echo -e "${YELLOW}⚠${NC} Some indexes missing (found ${INDEX_COUNT}, expected 9)"
    ((WARN_COUNT++))
else
    echo -e "${RED}✗${NC} No production analytics indexes found"
    ((FAIL_COUNT++))
fi

# =====================================================
# 4. Check Backend Health
# =====================================================
echo ""
echo -e "${BLUE}[4/7] Checking Backend Health${NC}"

HEALTH_RESPONSE=$(curl -s -f http://localhost:4001/health 2>&1 || echo "ERROR")

if echo "$HEALTH_RESPONSE" | grep -q "HEALTHY"; then
    echo -e "${GREEN}✓${NC} Backend health endpoint responding"
    ((PASS_COUNT++))

    # Extract metrics
    UPTIME=$(echo "$HEALTH_RESPONSE" | grep -o '"uptime":[0-9.]*' | cut -d':' -f2)
    MEMORY=$(echo "$HEALTH_RESPONSE" | grep -o '"memoryUsedMB":[0-9.]*' | cut -d':' -f2)

    if [ ! -z "$UPTIME" ]; then
        echo -e "  ${YELLOW}→${NC} Uptime: ${UPTIME} seconds"
    fi
    if [ ! -z "$MEMORY" ]; then
        echo -e "  ${YELLOW}→${NC} Memory: ${MEMORY} MB"
    fi
else
    echo -e "${RED}✗${NC} Backend health endpoint not responding"
    echo -e "  ${YELLOW}→${NC} Response: ${HEALTH_RESPONSE}"
    ((FAIL_COUNT++))
fi

# =====================================================
# 5. Check GraphQL Schema
# =====================================================
echo ""
echo -e "${BLUE}[5/7] Checking GraphQL Schema${NC}"

SCHEMA_RESPONSE=$(curl -s -X POST http://localhost:4001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { fields { name } } } }"}' 2>&1 || echo "ERROR")

if echo "$SCHEMA_RESPONSE" | grep -q '"data"'; then
    echo -e "${GREEN}✓${NC} GraphQL endpoint responding"
    ((PASS_COUNT++))

    # Check for production analytics queries
    if echo "$SCHEMA_RESPONSE" | grep -q "productionSummary"; then
        echo -e "${GREEN}✓${NC} productionSummary query available"
        ((PASS_COUNT++))
    else
        echo -e "${YELLOW}⚠${NC} productionSummary query not found (backend may need restart)"
        ((WARN_COUNT++))
    fi

    if echo "$SCHEMA_RESPONSE" | grep -q "workCenterSummaries"; then
        echo -e "${GREEN}✓${NC} workCenterSummaries query available"
        ((PASS_COUNT++))
    else
        echo -e "${YELLOW}⚠${NC} workCenterSummaries query not found"
        ((WARN_COUNT++))
    fi

    if echo "$SCHEMA_RESPONSE" | grep -q "productionRunSummaries"; then
        echo -e "${GREEN}✓${NC} productionRunSummaries query available"
        ((PASS_COUNT++))
    else
        echo -e "${YELLOW}⚠${NC} productionRunSummaries query not found"
        ((WARN_COUNT++))
    fi
else
    echo -e "${RED}✗${NC} GraphQL endpoint not responding"
    ((FAIL_COUNT++))
fi

# =====================================================
# 6. Check Frontend Accessibility
# =====================================================
echo ""
echo -e "${BLUE}[6/7] Checking Frontend Accessibility${NC}"

FRONTEND_RESPONSE=$(curl -s -f http://localhost:3000 2>&1 || echo "ERROR")

if echo "$FRONTEND_RESPONSE" | grep -q "<!DOCTYPE html>"; then
    echo -e "${GREEN}✓${NC} Frontend accessible at http://localhost:3000"
    ((PASS_COUNT++))
else
    echo -e "${YELLOW}⚠${NC} Frontend may not be fully loaded"
    ((WARN_COUNT++))
fi

# =====================================================
# 7. Check Database Performance
# =====================================================
echo ""
echo -e "${BLUE}[7/7] Checking Database Performance${NC}"

# Check index usage (if data exists)
INDEX_USAGE=$(docker exec -e PGPASSWORD=$DB_PASSWORD $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
SELECT
  COALESCE(SUM(idx_scan), 0) as total_scans
FROM pg_stat_user_indexes
WHERE schemaname='public'
  AND (
    indexrelname LIKE 'idx_production_runs_active%'
    OR indexrelname LIKE 'idx_oee_%'
  );
" 2>&1 | tr -d ' ')

if [[ "$INDEX_USAGE" =~ ^[0-9]+$ ]]; then
    if [[ "$INDEX_USAGE" -gt "0" ]]; then
        echo -e "${GREEN}✓${NC} Indexes are being used (${INDEX_USAGE} scans)"
        ((PASS_COUNT++))
    else
        echo -e "${YELLOW}⚠${NC} Indexes created but not yet used (no queries run yet)"
        ((WARN_COUNT++))
    fi
else
    echo -e "${YELLOW}⚠${NC} Could not check index usage"
    ((WARN_COUNT++))
fi

# =====================================================
# Summary
# =====================================================
echo ""
echo "======================================================"
echo "Health Check Summary"
echo "======================================================"
echo -e "${GREEN}Passed:${NC}  $PASS_COUNT"
echo -e "${YELLOW}Warnings:${NC} $WARN_COUNT"
echo -e "${RED}Failed:${NC}  $FAIL_COUNT"
echo ""

if [[ $FAIL_COUNT -eq 0 ]]; then
    if [[ $WARN_COUNT -eq 0 ]]; then
        echo -e "${GREEN}✓ All checks passed!${NC}"
        echo ""
        echo "Production Analytics Dashboard is fully operational."
        exit 0
    else
        echo -e "${YELLOW}⚠ Some warnings detected${NC}"
        echo ""
        echo "Recommendations:"
        echo "  - Check backend logs: docker logs agogsaas-app-backend --tail 50"
        echo "  - Restart backend if GraphQL queries not available"
        echo "  - Run test queries to populate index usage statistics"
        exit 0
    fi
else
    echo -e "${RED}✗ Some checks failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Start containers: docker-compose -f docker-compose.app.yml up -d"
    echo "  2. Check backend logs: docker logs agogsaas-app-backend"
    echo "  3. Verify database: docker exec -it agogsaas-app-postgres psql -U agogsaas_user -d agogsaas"
    echo "  4. Re-run deployment: bash scripts/deploy-production-analytics.sh"
    exit 1
fi
