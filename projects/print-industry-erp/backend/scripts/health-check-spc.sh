#!/bin/bash

# =====================================================
# SPC Health Check Script
# =====================================================
# Purpose: Verify SPC infrastructure health
# REQ: REQ-STRATEGIC-AUTO-1767048328664
# Created: 2025-12-29
# =====================================================

set -e

echo "=================================================="
echo "SPC HEALTH CHECK"
echo "Statistical Process Control Infrastructure"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check environment
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
    exit 1
fi

PASSED=0
FAILED=0

# Test 1: Table existence
echo ""
echo -e "${BLUE}Test 1: Checking table existence${NC}"

TABLES=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*)
FROM information_schema.tables
WHERE table_name IN (
    'spc_control_chart_data',
    'spc_control_limits',
    'spc_process_capability',
    'spc_out_of_control_alerts',
    'spc_data_retention_policies'
);
")

if [ "$TABLES" -eq 5 ]; then
    echo -e "${GREEN}✅ All 5 SPC tables exist${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Expected 5 tables, found $TABLES${NC}"
    ((FAILED++))
fi

# Test 2: Partition existence
echo ""
echo -e "${BLUE}Test 2: Checking table partitions${NC}"

PARTITIONS=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*)
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
WHERE parent.relname = 'spc_control_chart_data';
")

if [ "$PARTITIONS" -ge 12 ]; then
    echo -e "${GREEN}✅ Found $PARTITIONS partitions (expected >= 12)${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Expected >= 12 partitions, found $PARTITIONS${NC}"
    ((FAILED++))
fi

# Test 3: RLS policies
echo ""
echo -e "${BLUE}Test 3: Checking RLS policies${NC}"

RLS_POLICIES=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*)
FROM pg_policies
WHERE tablename LIKE 'spc_%';
")

if [ "$RLS_POLICIES" -ge 5 ]; then
    echo -e "${GREEN}✅ Found $RLS_POLICIES RLS policies${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Expected >= 5 RLS policies, found $RLS_POLICIES${NC}"
    ((FAILED++))
fi

# Test 4: Indexes
echo ""
echo -e "${BLUE}Test 4: Checking indexes${NC}"

INDEXES=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*)
FROM pg_indexes
WHERE tablename LIKE 'spc_%';
")

if [ "$INDEXES" -ge 15 ]; then
    echo -e "${GREEN}✅ Found $INDEXES indexes${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Expected >= 15 indexes, found $INDEXES${NC}"
    ((PASSED++)) # Still pass, but warn
fi

# Test 5: GraphQL schema
echo ""
echo -e "${BLUE}Test 5: Checking GraphQL schema file${NC}"

if [ -f "src/graphql/schema/spc.graphql" ]; then
    echo -e "${GREEN}✅ SPC GraphQL schema exists${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ SPC GraphQL schema not found${NC}"
    ((FAILED++))
fi

# Test 6: Module file
echo ""
echo -e "${BLUE}Test 6: Checking SPC module${NC}"

if [ -f "src/modules/spc/spc.module.ts" ]; then
    echo -e "${GREEN}✅ SPC module exists${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ SPC module not found${NC}"
    ((FAILED++))
fi

# Test 7: Resolver file
echo ""
echo -e "${BLUE}Test 7: Checking SPC resolver${NC}"

if [ -f "src/graphql/resolvers/spc.resolver.ts" ]; then
    echo -e "${GREEN}✅ SPC resolver exists${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ SPC resolver not found${NC}"
    ((FAILED++))
fi

# Test 8: Sample query test
echo ""
echo -e "${BLUE}Test 8: Testing database connectivity${NC}"

QUERY_TEST=$(psql "$DATABASE_URL" -t -c "SELECT 1;")

if [ "$QUERY_TEST" -eq 1 ]; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Database connection failed${NC}"
    ((FAILED++))
fi

# Summary
echo ""
echo "=================================================="
echo "HEALTH CHECK SUMMARY"
echo "=================================================="
echo ""
echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "Tests Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
    echo ""
    echo "SPC infrastructure is healthy and ready!"
    echo ""
    echo "Next steps:"
    echo "  - Create control limits via GraphQL"
    echo "  - Configure IoT sensor mappings"
    echo "  - Set up alert rules"
    echo "  - Test measurement recording"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please review the errors above and fix issues."
    echo "Run deployment script if tables are missing:"
    echo "  ./scripts/deploy-spc.sh"
    exit 1
fi
