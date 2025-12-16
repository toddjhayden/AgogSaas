#!/bin/bash
# AgogSaaS Health Check Script
# Comprehensive health verification for all services
# Usage: ./health-check.sh [deployment-type]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DEPLOYMENT_TYPE=${1:-regional}

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  AgogSaaS Health Check${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "${BLUE}Deployment Type:${NC} $DEPLOYMENT_TYPE"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Track failures
FAILURES=0

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local expected=${3:-200}

    echo -n "Checking $name... "

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")

    if [ "$HTTP_CODE" == "$expected" ] || [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}✓ Healthy (HTTP $HTTP_CODE)${NC}"
        return 0
    else
        echo -e "${RED}✗ Unhealthy (HTTP $HTTP_CODE)${NC}"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

# Function to check TCP port
check_tcp() {
    local name=$1
    local host=$2
    local port=$3

    echo -n "Checking $name... "

    if timeout 3 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
        echo -e "${GREEN}✓ Port $port open${NC}"
        return 0
    else
        echo -e "${RED}✗ Port $port closed${NC}"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

# Function to check Docker container
check_container() {
    local name=$1

    echo -n "Checking container $name... "

    if docker ps --filter "name=$name" --filter "status=running" | grep -q "$name"; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not running${NC}"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

# Regional Deployment Checks
if [ "$DEPLOYMENT_TYPE" == "regional" ]; then
    echo -e "${BLUE}Checking Regional Deployment...${NC}"
    echo ""

    # Blue Environment
    echo -e "${BLUE}Blue Environment:${NC}"
    check_http "Blue Backend Health" "http://localhost:4001/health"
    check_http "Blue Frontend" "http://localhost:3001"
    check_tcp "Blue PostgreSQL" "localhost" "5432"
    check_tcp "Blue Redis" "localhost" "6379"
    echo ""

    # Green Environment
    echo -e "${BLUE}Green Environment:${NC}"
    check_http "Green Backend Health" "http://localhost:4002/health"
    check_http "Green Frontend" "http://localhost:3002"
    check_tcp "Green PostgreSQL" "localhost" "5433"
    check_tcp "Green Redis" "localhost" "6380"
    echo ""

    # Shared Infrastructure
    echo -e "${BLUE}Shared Infrastructure:${NC}"
    check_http "NATS" "http://localhost:8222/healthz"
    check_tcp "NATS Client" "localhost" "4222"
    check_http "Prometheus" "http://localhost:9090/-/healthy"
    check_http "Grafana" "http://localhost:3000/api/health"
    check_http "Nginx Load Balancer" "http://localhost:80/health" "200|502"
    echo ""

    # Container Status
    echo -e "${BLUE}Container Status:${NC}"
    check_container "regional-postgres-blue"
    check_container "regional-postgres-green"
    check_container "regional-backend-blue"
    check_container "regional-backend-green"
    check_container "regional-frontend-blue"
    check_container "regional-frontend-green"
    check_container "regional-nats"
    check_container "regional-nginx"
    check_container "regional-prometheus"
    check_container "regional-grafana"
    echo ""
fi

# Edge Deployment Checks
if [ "$DEPLOYMENT_TYPE" == "edge" ]; then
    echo -e "${BLUE}Checking Edge Deployment...${NC}"
    echo ""

    # Edge Services
    echo -e "${BLUE}Edge Services:${NC}"
    check_http "Edge Backend Health" "http://localhost:4000/health"
    check_tcp "Edge PostgreSQL" "localhost" "5432"
    check_tcp "Edge NATS" "localhost" "4222"
    check_http "Edge NATS Monitoring" "http://localhost:8222/healthz"
    echo ""

    # Container Status
    echo -e "${BLUE}Container Status:${NC}"
    check_container "edge-postgres"
    check_container "edge-backend"
    check_container "edge-nats"
    check_container "edge-sync-agent"
    check_container "edge-health-monitor"
    echo ""
fi

# Database Connectivity Test
echo -e "${BLUE}Database Connectivity:${NC}"

if [ "$DEPLOYMENT_TYPE" == "regional" ]; then
    echo -n "Blue PostgreSQL query test... "
    if docker exec regional-postgres-blue psql -U agogsaas_user -d agogsaas -c "SELECT 1;" &> /dev/null; then
        echo -e "${GREEN}✓ Connected${NC}"
    else
        echo -e "${RED}✗ Failed${NC}"
        FAILURES=$((FAILURES + 1))
    fi

    echo -n "Green PostgreSQL query test... "
    if docker exec regional-postgres-green psql -U agogsaas_user -d agogsaas -c "SELECT 1;" &> /dev/null; then
        echo -e "${GREEN}✓ Connected${NC}"
    else
        echo -e "${RED}✗ Failed${NC}"
        FAILURES=$((FAILURES + 1))
    fi
elif [ "$DEPLOYMENT_TYPE" == "edge" ]; then
    echo -n "Edge PostgreSQL query test... "
    if docker exec edge-postgres psql -U edge_user -d agog_edge -c "SELECT 1;" &> /dev/null; then
        echo -e "${GREEN}✓ Connected${NC}"
    else
        echo -e "${RED}✗ Failed${NC}"
        FAILURES=$((FAILURES + 1))
    fi
fi

echo ""

# Resource Usage
echo -e "${BLUE}Resource Usage:${NC}"

if [ "$DEPLOYMENT_TYPE" == "regional" ]; then
    echo -e "${YELLOW}Blue Backend:${NC}"
    docker stats --no-stream --format "  CPU: {{.CPUPerc}}\t Memory: {{.MemUsage}}" regional-backend-blue

    echo -e "${YELLOW}Green Backend:${NC}"
    docker stats --no-stream --format "  CPU: {{.CPUPerc}}\t Memory: {{.MemUsage}}" regional-backend-green

    echo -e "${YELLOW}Blue PostgreSQL:${NC}"
    docker stats --no-stream --format "  CPU: {{.CPUPerc}}\t Memory: {{.MemUsage}}" regional-postgres-blue

    echo -e "${YELLOW}Green PostgreSQL:${NC}"
    docker stats --no-stream --format "  CPU: {{.CPUPerc}}\t Memory: {{.MemUsage}}" regional-postgres-green
elif [ "$DEPLOYMENT_TYPE" == "edge" ]; then
    echo -e "${YELLOW}Edge Backend:${NC}"
    docker stats --no-stream --format "  CPU: {{.CPUPerc}}\t Memory: {{.MemUsage}}" edge-backend

    echo -e "${YELLOW}Edge PostgreSQL:${NC}"
    docker stats --no-stream --format "  CPU: {{.CPUPerc}}\t Memory: {{.MemUsage}}" edge-postgres
fi

echo ""

# Summary
echo -e "${BLUE}======================================${NC}"
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}  All Health Checks Passed!${NC}"
    echo -e "${GREEN}======================================${NC}"
    exit 0
else
    echo -e "${RED}  $FAILURES Health Check(s) Failed${NC}"
    echo -e "${RED}======================================${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo -e "  - Check logs: docker-compose logs -f"
    echo -e "  - Restart services: docker-compose restart"
    echo -e "  - Check .env configuration"
    echo ""
    exit 1
fi
