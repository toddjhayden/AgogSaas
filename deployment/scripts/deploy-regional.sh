#!/bin/bash
# AgogSaaS Regional Cloud Deployment Script
# Deploys full regional infrastructure with Blue-Green environments
# Usage: ./deploy-regional.sh [region] [environment]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGIONAL_DIR="$SCRIPT_DIR/../regional"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  AgogSaaS Regional Deployment${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Region required${NC}"
    echo "Usage: ./deploy-regional.sh [region] [environment]"
    echo "Regions: US-EAST, EU-CENTRAL, APAC"
    echo "Environment: blue (default), green, both"
    exit 1
fi

REGION=$1
ENVIRONMENT=${2:-blue}

echo -e "${BLUE}Region:${NC} $REGION"
echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo ""

# Validate region
case $REGION in
    US-EAST|EU-CENTRAL|APAC)
        ;;
    *)
        echo -e "${RED}Error: Invalid region. Use US-EAST, EU-CENTRAL, or APAC${NC}"
        exit 1
        ;;
esac

# Validate environment
case $ENVIRONMENT in
    blue|green|both)
        ;;
    *)
        echo -e "${RED}Error: Invalid environment. Use blue, green, or both${NC}"
        exit 1
        ;;
esac

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker installed${NC}"
echo -e "${GREEN}✓ Docker Compose installed${NC}"
echo ""

# Check .env file
if [ ! -f "$REGIONAL_DIR/.env" ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    if [ -f "$REGIONAL_DIR/.env.regional.example" ]; then
        cp "$REGIONAL_DIR/.env.regional.example" "$REGIONAL_DIR/.env"
        echo -e "${GREEN}✓ .env file created${NC}"
        echo -e "${YELLOW}Please edit $REGIONAL_DIR/.env with your configuration${NC}"
        exit 0
    else
        echo -e "${RED}Error: .env.regional.example not found${NC}"
        exit 1
    fi
fi

# Load environment
source "$REGIONAL_DIR/.env"
export REGION=$REGION

# Set other regions
case $REGION in
    US-EAST)
        export OTHER_REGIONS="EU-CENTRAL,APAC"
        ;;
    EU-CENTRAL)
        export OTHER_REGIONS="US-EAST,APAC"
        ;;
    APAC)
        export OTHER_REGIONS="US-EAST,EU-CENTRAL"
        ;;
esac

echo -e "${BLUE}Configuration:${NC}"
echo -e "  Region: $REGION"
echo -e "  Other Regions: $OTHER_REGIONS"
echo -e "  Active Environment: ${ACTIVE_ENVIRONMENT:-blue}"
echo ""

cd "$REGIONAL_DIR"

# Pull latest images
echo -e "${YELLOW}Pulling latest Docker images...${NC}"
docker-compose -f docker-compose.regional.yml pull

# Deploy based on environment selection
if [ "$ENVIRONMENT" == "both" ]; then
    echo -e "${YELLOW}Deploying both Blue and Green environments...${NC}"
    docker-compose -f docker-compose.regional.yml up -d
elif [ "$ENVIRONMENT" == "blue" ]; then
    echo -e "${YELLOW}Deploying Blue environment...${NC}"
    docker-compose -f docker-compose.regional.yml up -d postgres-blue redis-blue backend-blue frontend-blue ollama-blue
elif [ "$ENVIRONMENT" == "green" ]; then
    echo -e "${YELLOW}Deploying Green environment...${NC}"
    docker-compose -f docker-compose.regional.yml up -d postgres-green redis-green backend-green frontend-green ollama-green
fi

# Always start shared infrastructure
echo -e "${YELLOW}Starting shared infrastructure...${NC}"
docker-compose -f docker-compose.regional.yml up -d nats nginx prometheus grafana alertmanager

# Wait for services
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 15

# Health checks
echo -e "${YELLOW}Performing health checks...${NC}"

check_service() {
    local name=$1
    local url=$2
    local max_retries=30
    local count=0

    while [ $count -lt $max_retries ]; do
        if curl -f "$url" &> /dev/null; then
            echo -e "${GREEN}✓ $name healthy${NC}"
            return 0
        fi
        count=$((count + 1))
        echo -e "${YELLOW}Waiting for $name... ($count/$max_retries)${NC}"
        sleep 2
    done

    echo -e "${RED}✗ $name failed health check${NC}"
    return 1
}

# Check Blue environment
if [ "$ENVIRONMENT" == "blue" ] || [ "$ENVIRONMENT" == "both" ]; then
    echo -e "${BLUE}Checking Blue environment...${NC}"
    check_service "Blue Backend" "http://localhost:4001/health"
    check_service "Blue Frontend" "http://localhost:3001"
fi

# Check Green environment
if [ "$ENVIRONMENT" == "green" ] || [ "$ENVIRONMENT" == "both" ]; then
    echo -e "${BLUE}Checking Green environment...${NC}"
    check_service "Green Backend" "http://localhost:4002/health"
    check_service "Green Frontend" "http://localhost:3002"
fi

# Check shared services
echo -e "${BLUE}Checking shared infrastructure...${NC}"
check_service "NATS" "http://localhost:8222/healthz"
check_service "Prometheus" "http://localhost:9090/-/healthy"
check_service "Grafana" "http://localhost:3000/api/health"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Regional Deployment Successful!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"

if [ "$ENVIRONMENT" == "blue" ] || [ "$ENVIRONMENT" == "both" ]; then
    echo -e "  ${BLUE}Blue Environment:${NC}"
    echo -e "    Backend API: http://localhost:4001"
    echo -e "    Frontend: http://localhost:3001"
    echo -e "    PostgreSQL: localhost:5432"
    echo -e "    Redis: localhost:6379"
    echo ""
fi

if [ "$ENVIRONMENT" == "green" ] || [ "$ENVIRONMENT" == "both" ]; then
    echo -e "  ${BLUE}Green Environment:${NC}"
    echo -e "    Backend API: http://localhost:4002"
    echo -e "    Frontend: http://localhost:3002"
    echo -e "    PostgreSQL: localhost:5433"
    echo -e "    Redis: localhost:6380"
    echo ""
fi

echo -e "  ${BLUE}Shared Infrastructure:${NC}"
echo -e "    Load Balancer: http://localhost:80"
echo -e "    NATS Monitoring: http://localhost:8222"
echo -e "    Prometheus: http://localhost:9090"
echo -e "    Grafana: http://localhost:3000"
echo ""

echo -e "${BLUE}Management:${NC}"
echo -e "  View logs: docker-compose -f $REGIONAL_DIR/docker-compose.regional.yml logs -f"
echo -e "  Stop all: docker-compose -f $REGIONAL_DIR/docker-compose.regional.yml down"
echo -e "  Status: docker-compose -f $REGIONAL_DIR/docker-compose.regional.yml ps"
echo ""

echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Run smoke tests: $SCRIPT_DIR/smoke-test.sh"
echo -e "  2. Setup replication: $SCRIPT_DIR/setup-replication.sh"
echo -e "  3. Configure monitoring: http://localhost:3000"
echo ""

echo -e "${GREEN}Regional deployment complete!${NC}"
