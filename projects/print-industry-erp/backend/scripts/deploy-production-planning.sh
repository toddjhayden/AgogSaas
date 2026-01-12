#!/bin/bash
# =====================================================
# Deployment Script: Production Planning & Scheduling Module
# =====================================================
# REQ: REQ-STRATEGIC-AUTO-1767048328658
# Author: Roy (Backend Architect)
# Date: 2025-12-29
# =====================================================

set -e  # Exit on error

echo "======================================================"
echo "Production Planning & Scheduling Module Deployment"
echo "REQ-STRATEGIC-AUTO-1767048328658"
echo "======================================================"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Database connection
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-agog_erp}"
DB_USER="${DATABASE_USER:-postgres}"

echo -e "${YELLOW}Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}${NC}"
echo ""

# =====================================================
# Step 1: Verify Prerequisites
# =====================================================
echo -e "${YELLOW}Step 1: Verifying Prerequisites${NC}"

# Check if operations-module.sql is already deployed
OPERATIONS_TABLE_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='production_orders';" 2>&1)

if [[ $OPERATIONS_TABLE_EXISTS -eq 0 ]]; then
    echo -e "${RED}Error: Operations module base tables not found. Run migrations first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Operations module base tables exist${NC}"

# =====================================================
# Step 2: Run Migration V0.0.40 (Routing Templates)
# =====================================================
echo -e "${YELLOW}Step 2: Deploying Routing Templates (V0.0.40)${NC}"

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/V0.0.40__create_routing_templates.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Routing templates migration successful${NC}"
else
    echo -e "${RED}✗ Routing templates migration failed${NC}"
    exit 1
fi

# =====================================================
# Step 3: Run Migration V0.0.41 (RLS Policies)
# =====================================================
echo -e "${YELLOW}Step 3: Deploying RLS Policies (V0.0.41)${NC}"

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/V0.0.41__add_rls_policies_production_planning.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ RLS policies migration successful${NC}"
else
    echo -e "${RED}✗ RLS policies migration failed${NC}"
    exit 1
fi

# =====================================================
# Step 4: Verify Table Creation
# =====================================================
echo -e "${YELLOW}Step 4: Verifying Table Creation${NC}"

ROUTING_TEMPLATES_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='routing_templates';" 2>&1)
ROUTING_OPERATIONS_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='routing_operations';" 2>&1)

if [[ $ROUTING_TEMPLATES_COUNT -eq 1 ]] && [[ $ROUTING_OPERATIONS_COUNT -eq 1 ]]; then
    echo -e "${GREEN}✓ Routing tables created successfully${NC}"
else
    echo -e "${RED}✗ Routing tables verification failed${NC}"
    exit 1
fi

# =====================================================
# Step 5: Verify RLS Policies
# =====================================================
echo -e "${YELLOW}Step 5: Verifying RLS Policies${NC}"

RLS_POLICY_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('work_centers', 'production_orders', 'production_runs', 'operations', 'routing_templates', 'routing_operations');" 2>&1)

if [[ $RLS_POLICY_COUNT -ge 6 ]]; then
    echo -e "${GREEN}✓ RLS policies verified (${RLS_POLICY_COUNT} policies)${NC}"
else
    echo -e "${YELLOW}⚠ Warning: Expected at least 6 RLS policies, found ${RLS_POLICY_COUNT}${NC}"
fi

# =====================================================
# Step 6: Rebuild NestJS Application
# =====================================================
echo -e "${YELLOW}Step 6: Building NestJS Application${NC}"

npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ NestJS build successful${NC}"
else
    echo -e "${RED}✗ NestJS build failed${NC}"
    exit 1
fi

# =====================================================
# Step 7: Health Check
# =====================================================
echo -e "${YELLOW}Step 7: Running Health Check${NC}"

# Start server in background (if not already running)
# npm run start:dev &
# SERVER_PID=$!
# sleep 10  # Wait for server to start

# Health check endpoint
# HEALTH_CHECK=$(curl -s http://localhost:3000/health)

# if [[ $HEALTH_CHECK == *"ok"* ]]; then
#     echo -e "${GREEN}✓ Health check passed${NC}"
# else
#     echo -e "${YELLOW}⚠ Health check skipped (manual verification required)${NC}"
# fi

echo -e "${YELLOW}⚠ Health check skipped (run verify-production-planning-deployment.ts)${NC}"

# =====================================================
# Deployment Complete
# =====================================================
echo ""
echo "======================================================"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "======================================================"
echo ""
echo "Next Steps:"
echo "1. Run verification script: npm run verify:production-planning"
echo "2. Review deployment logs above for any warnings"
echo "3. Test GraphQL queries for routing templates"
echo "4. Monitor application logs for RLS policy enforcement"
echo ""
echo "======================================================"
