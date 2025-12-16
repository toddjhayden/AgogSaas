#!/bin/bash
# AgogSaaS Edge Deployment Script
# One-command edge computer deployment
# Usage: ./deploy-edge.sh [facility-id] [region]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EDGE_DIR="$SCRIPT_DIR/../edge"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  AgogSaaS Edge Deployment${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Facility ID required${NC}"
    echo "Usage: ./deploy-edge.sh [facility-id] [region]"
    echo "Example: ./deploy-edge.sh facility-la-001 US-EAST"
    exit 1
fi

if [ -z "$2" ]; then
    echo -e "${RED}Error: Region required${NC}"
    echo "Usage: ./deploy-edge.sh [facility-id] [region]"
    echo "Example: ./deploy-edge.sh facility-la-001 US-EAST"
    exit 1
fi

FACILITY_ID=$1
REGION=$2

echo -e "${BLUE}Facility ID:${NC} $FACILITY_ID"
echo -e "${BLUE}Region:${NC} $REGION"
echo ""

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
if [ ! -f "$EDGE_DIR/.env" ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    if [ -f "$EDGE_DIR/.env.edge.example" ]; then
        cp "$EDGE_DIR/.env.edge.example" "$EDGE_DIR/.env"
        echo -e "${GREEN}✓ .env file created${NC}"
        echo -e "${YELLOW}Please edit $EDGE_DIR/.env with your configuration${NC}"
        exit 0
    else
        echo -e "${RED}Error: .env.edge.example not found${NC}"
        exit 1
    fi
fi

# Load environment
source "$EDGE_DIR/.env"

# Override with command-line arguments
export FACILITY_ID=$FACILITY_ID
export REGION=$REGION

# Set regional cloud URL based on region
case $REGION in
    US-EAST)
        export REGIONAL_CLOUD_URL="https://us-east.agogsaas.com"
        ;;
    EU-CENTRAL)
        export REGIONAL_CLOUD_URL="https://eu-central.agogsaas.com"
        ;;
    APAC)
        export REGIONAL_CLOUD_URL="https://apac.agogsaas.com"
        ;;
    *)
        echo -e "${RED}Error: Invalid region. Use US-EAST, EU-CENTRAL, or APAC${NC}"
        exit 1
        ;;
esac

echo -e "${BLUE}Configuration:${NC}"
echo -e "  Facility ID: $FACILITY_ID"
echo -e "  Tenant ID: ${TENANT_ID:-default}"
echo -e "  Region: $REGION"
echo -e "  Regional Cloud: $REGIONAL_CLOUD_URL"
echo ""

# Pull latest images
echo -e "${YELLOW}Pulling latest Docker images...${NC}"
cd "$EDGE_DIR"
docker-compose -f docker-compose.edge.yml pull

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose -f docker-compose.edge.yml down

# Start services
echo -e "${YELLOW}Starting edge services...${NC}"
docker-compose -f docker-compose.edge.yml up -d

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 10

# Check health
echo -e "${YELLOW}Checking service health...${NC}"

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:4000/health &> /dev/null; then
        echo -e "${GREEN}✓ Backend healthy${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${YELLOW}Waiting for backend... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}Error: Backend failed to start${NC}"
    echo -e "${YELLOW}Checking logs:${NC}"
    docker-compose -f docker-compose.edge.yml logs backend-edge
    exit 1
fi

# Check PostgreSQL
if docker-compose -f docker-compose.edge.yml exec -T postgres-edge pg_isready -U ${EDGE_DB_USER:-edge_user} -d ${EDGE_DB_NAME:-agog_edge} &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL healthy${NC}"
else
    echo -e "${RED}Error: PostgreSQL not healthy${NC}"
    exit 1
fi

# Check NATS
if curl -f http://localhost:8222/healthz &> /dev/null; then
    echo -e "${GREEN}✓ NATS healthy${NC}"
else
    echo -e "${RED}Error: NATS not healthy${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Edge Deployment Successful!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"
echo -e "  Backend API: http://localhost:4000"
echo -e "  Backend Health: http://localhost:4000/health"
echo -e "  PostgreSQL: localhost:5432"
echo -e "  NATS Monitoring: http://localhost:8222"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo -e "  View all: docker-compose -f $EDGE_DIR/docker-compose.edge.yml logs -f"
echo -e "  View backend: docker-compose -f $EDGE_DIR/docker-compose.edge.yml logs -f backend-edge"
echo ""
echo -e "${BLUE}Management:${NC}"
echo -e "  Stop: docker-compose -f $EDGE_DIR/docker-compose.edge.yml down"
echo -e "  Restart: docker-compose -f $EDGE_DIR/docker-compose.edge.yml restart"
echo -e "  Status: docker-compose -f $EDGE_DIR/docker-compose.edge.yml ps"
echo ""

# Register with regional cloud
echo -e "${YELLOW}Registering with regional cloud...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "${REGIONAL_CLOUD_URL}/api/edge/register" \
    -H "Content-Type: application/json" \
    -d "{\"facilityId\":\"$FACILITY_ID\",\"tenantId\":\"${TENANT_ID:-default}\",\"region\":\"$REGION\"}" || echo "failed")

if [ "$REGISTER_RESPONSE" != "failed" ]; then
    echo -e "${GREEN}✓ Registered with regional cloud${NC}"
else
    echo -e "${YELLOW}⚠ Could not register with regional cloud (will retry automatically)${NC}"
fi

echo ""
echo -e "${GREEN}Edge deployment complete!${NC}"
