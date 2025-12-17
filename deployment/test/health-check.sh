#!/bin/bash
# AgogSaaS Test Environment - Health Check Script
# Purpose: Check health status of all services
# Usage: ./health-check.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================================================"
echo -e "${BLUE}  AgogSaaS Test Environment - Health Check${NC}"
echo "================================================================================"
echo ""

# Function to check service health
check_health() {
  local url=$1
  local name=$2
  local timeout=${3:-5}

  if curl -f -s --max-time "$timeout" "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ $name${NC}"
    return 0
  else
    echo -e "${RED}✗ $name (UNHEALTHY)${NC}"
    return 1
  fi
}

# Function to check docker container status
check_container() {
  local container=$1
  local name=$2

  if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
    local status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null)
    if [ "$status" = "running" ]; then
      echo -e "${GREEN}✓ $name (running)${NC}"
      return 0
    else
      echo -e "${YELLOW}⚠ $name (status: $status)${NC}"
      return 1
    fi
  else
    echo -e "${RED}✗ $name (not found)${NC}"
    return 1
  fi
}

# Track overall health
failed=0

echo -e "${BLUE}=== Docker Containers ===${NC}"
check_container "test-postgres-edge" "PostgreSQL (Edge)" || ((failed++))
check_container "test-backend-edge" "Backend (Edge)" || ((failed++))
check_container "test-nats-edge" "NATS (Edge)" || ((failed++))
echo ""
check_container "test-postgres-region1" "PostgreSQL (Region 1)" || ((failed++))
check_container "test-redis-region1" "Redis (Region 1)" || ((failed++))
check_container "test-backend-region1" "Backend (Region 1)" || ((failed++))
check_container "test-frontend-region1" "Frontend (Region 1)" || ((failed++))
check_container "test-nats-region1" "NATS (Region 1)" || ((failed++))
echo ""
check_container "test-postgres-region2" "PostgreSQL (Region 2)" || ((failed++))
check_container "test-redis-region2" "Redis (Region 2)" || ((failed++))
check_container "test-backend-region2" "Backend (Region 2)" || ((failed++))
check_container "test-frontend-region2" "Frontend (Region 2)" || ((failed++))
check_container "test-nats-region2" "NATS (Region 2)" || ((failed++))
echo ""
check_container "test-prometheus" "Prometheus" || ((failed++))
check_container "test-grafana" "Grafana" || ((failed++))
check_container "test-alertmanager" "Alertmanager" || ((failed++))

echo ""
echo -e "${BLUE}=== Health Endpoints ===${NC}"
check_health "http://localhost:5001/health" "Edge Backend Health" || ((failed++))
check_health "http://localhost:6001/health" "Region 1 Backend Health" || ((failed++))
check_health "http://localhost:7001/health" "Region 2 Backend Health" || ((failed++))
check_health "http://localhost:6080/health" "Region 1 Frontend Health" || ((failed++))
check_health "http://localhost:7080/health" "Region 2 Frontend Health" || ((failed++))
check_health "http://localhost:9090/-/healthy" "Prometheus Health" || ((failed++))
check_health "http://localhost:3000/api/health" "Grafana Health" || ((failed++))
check_health "http://localhost:9093/-/healthy" "Alertmanager Health" || ((failed++))

echo ""
echo -e "${BLUE}=== Database Connectivity ===${NC}"

# Check PostgreSQL connectivity
if docker exec test-postgres-edge pg_isready -U edge_user -d agog_edge > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PostgreSQL Edge (agog_edge)${NC}"
else
  echo -e "${RED}✗ PostgreSQL Edge (agog_edge)${NC}"
  ((failed++))
fi

if docker exec test-postgres-region1 pg_isready -U agogsaas_user -d agogsaas > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PostgreSQL Region 1 (agogsaas)${NC}"
else
  echo -e "${RED}✗ PostgreSQL Region 1 (agogsaas)${NC}"
  ((failed++))
fi

if docker exec test-postgres-region2 pg_isready -U agogsaas_user -d agogsaas > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PostgreSQL Region 2 (agogsaas)${NC}"
else
  echo -e "${RED}✗ PostgreSQL Region 2 (agogsaas)${NC}"
  ((failed++))
fi

# Check Redis connectivity
if docker exec test-redis-region1 redis-cli ping | grep -q "PONG"; then
  echo -e "${GREEN}✓ Redis Region 1${NC}"
else
  echo -e "${RED}✗ Redis Region 1${NC}"
  ((failed++))
fi

if docker exec test-redis-region2 redis-cli ping | grep -q "PONG"; then
  echo -e "${GREEN}✓ Redis Region 2${NC}"
else
  echo -e "${RED}✗ Redis Region 2${NC}"
  ((failed++))
fi

echo ""
echo -e "${BLUE}=== GraphQL Endpoints ===${NC}"
check_health "http://localhost:5001/graphql" "Edge GraphQL" 3 || ((failed++))
check_health "http://localhost:6001/graphql" "Region 1 GraphQL" 3 || ((failed++))
check_health "http://localhost:7001/graphql" "Region 2 GraphQL" 3 || ((failed++))

echo ""
echo -e "${BLUE}=== NATS Monitoring ===${NC}"
check_health "http://localhost:5223" "NATS Edge Monitoring" 3 || ((failed++))
check_health "http://localhost:6223" "NATS Region 1 Monitoring" 3 || ((failed++))
check_health "http://localhost:7223" "NATS Region 2 Monitoring" 3 || ((failed++))

echo ""
echo "================================================================================"
if [ $failed -eq 0 ]; then
  echo -e "${GREEN}✓ All services are healthy!${NC}"
  echo "================================================================================"
  echo ""
  echo "ACCESS POINTS:"
  echo "  Frontend (Region 1): http://localhost:6080"
  echo "  Frontend (Region 2): http://localhost:7080"
  echo "  Grafana:            http://localhost:3000"
  echo "  Prometheus:         http://localhost:9090"
  echo ""
  exit 0
else
  echo -e "${RED}✗ $failed service(s) are unhealthy${NC}"
  echo "================================================================================"
  echo ""
  echo "TROUBLESHOOTING:"
  echo "  View logs:    docker-compose -f docker-compose.test.yml logs -f [service]"
  echo "  Restart all:  docker-compose -f docker-compose.test.yml restart"
  echo "  Check status: docker-compose -f docker-compose.test.yml ps"
  echo ""
  exit 1
fi
