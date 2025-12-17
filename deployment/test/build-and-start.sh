#!/bin/bash
# AgogSaaS Test Environment - Build and Start Script
# Purpose: Build Docker images and start complete test environment
# Usage: ./build-and-start.sh

set -e

echo "================================================================================"
echo "  AgogSaaS Test Environment - Build and Start"
echo "================================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}Project root: $PROJECT_ROOT${NC}"
echo ""

# Step 1: Build backend image
echo -e "${YELLOW}[1/5] Building backend Docker image...${NC}"
cd "$PROJECT_ROOT/Implementation/print-industry-erp/backend"
docker build -t agogsaas/backend:test --target production .
echo -e "${GREEN}✓ Backend image built successfully${NC}"
echo ""

# Step 2: Build frontend image
echo -e "${YELLOW}[2/5] Building frontend Docker image...${NC}"
cd "$PROJECT_ROOT/Implementation/print-industry-erp/frontend"
docker build -t agogsaas/frontend:test --target production \
  --build-arg VITE_API_URL=http://localhost:6001/graphql \
  --build-arg VITE_WS_URL=ws://localhost:6222 \
  --build-arg VITE_DEFAULT_LANGUAGE=en-US \
  --build-arg VITE_ENABLE_MARKETPLACE=true \
  --build-arg VITE_ENABLE_AI_FEATURES=false \
  .
echo -e "${GREEN}✓ Frontend image built successfully${NC}"
echo ""

# Step 3: Stop any existing containers
echo -e "${YELLOW}[3/5] Stopping existing test environment...${NC}"
cd "$SCRIPT_DIR"
docker-compose -f docker-compose.test.yml down 2>/dev/null || true
echo -e "${GREEN}✓ Existing environment stopped${NC}"
echo ""

# Step 4: Start test environment
echo -e "${YELLOW}[4/5] Starting test environment...${NC}"
docker-compose -f docker-compose.test.yml up -d
echo -e "${GREEN}✓ Test environment started${NC}"
echo ""

# Step 5: Wait for services to be ready
echo -e "${YELLOW}[5/5] Waiting for services to start...${NC}"
echo "This may take 1-2 minutes for all services to initialize..."
sleep 30

# Check service health
echo ""
echo "Checking service health..."

# Function to check service health
check_health() {
  local url=$1
  local name=$2
  local max_attempts=30
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if curl -f -s "$url" > /dev/null 2>&1; then
      echo -e "${GREEN}✓ $name is healthy${NC}"
      return 0
    fi
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
  done

  echo -e "${RED}✗ $name failed to start${NC}"
  return 1
}

echo ""
check_health "http://localhost:5001/health" "Edge Backend"
check_health "http://localhost:6001/health" "Region 1 Backend"
check_health "http://localhost:7001/health" "Region 2 Backend"
check_health "http://localhost:6080/health" "Region 1 Frontend"
check_health "http://localhost:7080/health" "Region 2 Frontend"
check_health "http://localhost:9090/-/healthy" "Prometheus"
check_health "http://localhost:3000/api/health" "Grafana"

echo ""
echo -e "${YELLOW}Loading seed data...${NC}"

# Load seed data for Region 1 (US-EAST - English)
if [ -f "$PROJECT_ROOT/Implementation/print-industry-erp/backend/seeds/test-data.sql" ]; then
  echo "Loading seed data for Region 1 (US-EAST)..."
  docker exec test-postgres-region1 psql -U agogsaas_user -d agogsaas -f /docker-entrypoint-initdb.d/../seeds/test-data.sql 2>/dev/null || \
  PGPASSWORD=region1_password_test psql -h localhost -p 6432 -U agogsaas_user -d agogsaas -f "$PROJECT_ROOT/Implementation/print-industry-erp/backend/seeds/test-data.sql" || \
  echo -e "${YELLOW}Note: Could not load seed data automatically. Run manually if needed.${NC}"

  echo "Loading seed data for Region 2 (EU-CENTRAL)..."
  docker exec test-postgres-region2 psql -U agogsaas_user -d agogsaas -f /docker-entrypoint-initdb.d/../seeds/test-data.sql 2>/dev/null || \
  PGPASSWORD=region2_password_test psql -h localhost -p 7432 -U agogsaas_user -d agogsaas -f "$PROJECT_ROOT/Implementation/print-industry-erp/backend/seeds/test-data.sql" || \
  echo -e "${YELLOW}Note: Could not load seed data automatically. Run manually if needed.${NC}"
else
  echo -e "${YELLOW}Note: Seed data file not found. Skipping...${NC}"
fi

echo ""
echo "================================================================================"
echo -e "${GREEN}✓ Test environment is ready!${NC}"
echo "================================================================================"
echo ""
echo "ACCESS POINTS:"
echo "  Frontend (Region 1 - English):    http://localhost:6080"
echo "  Frontend (Region 2 - Chinese):    http://localhost:7080"
echo "  Backend (Edge):                   http://localhost:5001/graphql"
echo "  Backend (Region 1):               http://localhost:6001/graphql"
echo "  Backend (Region 2):               http://localhost:7001/graphql"
echo "  Prometheus:                       http://localhost:9090"
echo "  Grafana:                          http://localhost:3000 (admin/changeme)"
echo "  Alertmanager:                     http://localhost:9093"
echo ""
echo "TEST ACCOUNTS:"
echo "  English Tenant (Region 1):"
echo "    Email:    admin@americanprint.com"
echo "    Password: test123"
echo "    Tenant:   American Print Co. (PRINT-US)"
echo ""
echo "  Chinese Tenant (Region 2):"
echo "    Email:    admin@shanghai-printing.com"
echo "    Password: test123"
echo "    Tenant:   上海印刷公司 (PRINT-CN)"
echo ""
echo "USEFUL COMMANDS:"
echo "  View logs:        docker-compose -f docker-compose.test.yml logs -f"
echo "  Stop environment: docker-compose -f docker-compose.test.yml down"
echo "  Reset data:       docker-compose -f docker-compose.test.yml down -v"
echo "  Health check:     ./health-check.sh"
echo ""
echo "See TESTING_GUIDE.md for detailed test scenarios."
echo ""
