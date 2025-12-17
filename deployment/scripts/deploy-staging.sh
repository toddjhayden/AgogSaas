#!/bin/bash
# AgogSaaS Staging Deployment Script
# Deploys backend and frontend to staging environment with health checks
# Usage: ./deploy-staging.sh <backend-image> <frontend-image>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  AgogSaaS Staging Deployment${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    echo -e "${RED}Error: Backend and frontend images required${NC}"
    echo "Usage: ./deploy-staging.sh <backend-image> <frontend-image>"
    echo "Example: ./deploy-staging.sh ghcr.io/user/backend:staging-abc123 ghcr.io/user/frontend:staging-abc123"
    exit 1
fi

BACKEND_IMAGE=$1
FRONTEND_IMAGE=$2
DEPLOY_DIR="/opt/agogsaas"
BACKUP_DIR="/opt/agogsaas-backups"

echo -e "${YELLOW}Backend Image:${NC} $BACKEND_IMAGE"
echo -e "${YELLOW}Frontend Image:${NC} $FRONTEND_IMAGE"
echo ""

# =============================================================================
# Pre-Deployment Checks
# =============================================================================
echo -e "${BLUE}Running pre-deployment checks...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if deployment directory exists
if [ ! -d "$DEPLOY_DIR" ]; then
    echo -e "${YELLOW}Creating deployment directory: $DEPLOY_DIR${NC}"
    mkdir -p "$DEPLOY_DIR"
fi
echo -e "${GREEN}✓ Deployment directory exists${NC}"

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}Creating backup directory: $BACKUP_DIR${NC}"
    mkdir -p "$BACKUP_DIR"
fi
echo -e "${GREEN}✓ Backup directory exists${NC}"

# Check disk space (need at least 5GB free)
AVAILABLE_SPACE=$(df "$DEPLOY_DIR" | tail -1 | awk '{print $4}')
if [ "$AVAILABLE_SPACE" -lt 5242880 ]; then
    echo -e "${RED}Error: Insufficient disk space (need 5GB free)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Sufficient disk space available${NC}"

echo ""

# =============================================================================
# Backup Current Deployment
# =============================================================================
echo -e "${BLUE}Backing up current deployment...${NC}"

BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/staging_backup_$BACKUP_TIMESTAMP"

if [ -d "$DEPLOY_DIR" ] && [ "$(ls -A $DEPLOY_DIR 2>/dev/null)" ]; then
    mkdir -p "$BACKUP_PATH"

    # Save current image tags
    if [ -f "$DEPLOY_DIR/.env" ]; then
        cp "$DEPLOY_DIR/.env" "$BACKUP_PATH/.env.backup"
        echo -e "${GREEN}✓ Backed up environment configuration${NC}"
    fi

    # Save current docker-compose.yml
    if [ -f "$DEPLOY_DIR/docker-compose.yml" ]; then
        cp "$DEPLOY_DIR/docker-compose.yml" "$BACKUP_PATH/docker-compose.yml.backup"
        echo -e "${GREEN}✓ Backed up docker-compose configuration${NC}"
    fi

    # Export database backup
    if docker ps | grep -q "agogsaas-postgres"; then
        echo -e "${YELLOW}Creating database backup...${NC}"
        docker exec agogsaas-postgres pg_dump -U agogsaas_user agogsaas > "$BACKUP_PATH/database_backup.sql" 2>/dev/null || echo -e "${YELLOW}Warning: Could not backup database${NC}"
        echo -e "${GREEN}✓ Database backup created${NC}"
    fi

    echo -e "${GREEN}✓ Backup created at: $BACKUP_PATH${NC}"
else
    echo -e "${YELLOW}No existing deployment to backup${NC}"
fi

# Clean up old backups (keep last 5)
echo -e "${YELLOW}Cleaning up old backups (keeping last 5)...${NC}"
ls -t "$BACKUP_DIR" | tail -n +6 | xargs -I {} rm -rf "$BACKUP_DIR/{}" 2>/dev/null || true
echo -e "${GREEN}✓ Old backups cleaned up${NC}"

echo ""

# =============================================================================
# Login to Container Registry
# =============================================================================
echo -e "${BLUE}Authenticating with container registry...${NC}"

# Check if GITHUB_TOKEN is set
if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin
    echo -e "${GREEN}✓ Authenticated with GitHub Container Registry${NC}"
else
    echo -e "${YELLOW}Warning: GITHUB_TOKEN not set, assuming already authenticated${NC}"
fi

echo ""

# =============================================================================
# Pull New Images
# =============================================================================
echo -e "${BLUE}Pulling new Docker images...${NC}"

echo -e "${YELLOW}Pulling backend image...${NC}"
if docker pull "$BACKEND_IMAGE"; then
    echo -e "${GREEN}✓ Backend image pulled${NC}"
else
    echo -e "${RED}Error: Failed to pull backend image${NC}"
    exit 1
fi

echo -e "${YELLOW}Pulling frontend image...${NC}"
if docker pull "$FRONTEND_IMAGE"; then
    echo -e "${GREEN}✓ Frontend image pulled${NC}"
else
    echo -e "${RED}Error: Failed to pull frontend image${NC}"
    exit 1
fi

echo ""

# =============================================================================
# Stop Current Services
# =============================================================================
echo -e "${BLUE}Stopping current services...${NC}"

cd "$DEPLOY_DIR"

if [ -f "docker-compose.yml" ]; then
    docker-compose down || true
    echo -e "${GREEN}✓ Services stopped${NC}"
else
    echo -e "${YELLOW}No existing docker-compose.yml found${NC}"
fi

echo ""

# =============================================================================
# Update Configuration
# =============================================================================
echo -e "${BLUE}Updating deployment configuration...${NC}"

# Create/update docker-compose.yml
cat > "$DEPLOY_DIR/docker-compose.yml" << EOF
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: agogsaas-postgres
    environment:
      POSTGRES_DB: agogsaas
      POSTGRES_USER: agogsaas_user
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agogsaas_user -d agogsaas"]
      interval: 10s
      timeout: 5s
      retries: 5

  nats:
    image: nats:latest
    container_name: agogsaas-nats
    command:
      - "-js"
      - "-sd"
      - "/data"
      - "-m"
      - "8222"
    ports:
      - "4223:4222"
      - "8223:8222"
    volumes:
      - nats_data:/data

  ollama:
    image: ollama/ollama:latest
    container_name: agogsaas-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

  backend:
    image: $BACKEND_IMAGE
    container_name: agogsaas-backend
    environment:
      NODE_ENV: staging
      PORT: 4000
      DATABASE_URL: postgresql://agogsaas_user:\${DB_PASSWORD}@postgres:5432/agogsaas
      NATS_URL: nats://nats:4222
      OLLAMA_URL: http://ollama:11434
    ports:
      - "4001:4000"
    depends_on:
      postgres:
        condition: service_healthy
      nats:
        condition: service_started
    restart: unless-stopped

  frontend:
    image: $FRONTEND_IMAGE
    container_name: agogsaas-frontend
    environment:
      VITE_GRAPHQL_URL: https://staging.agogsaas.com/graphql
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  nats_data:
  ollama_data:

networks:
  default:
    name: agogsaas-staging
EOF

echo -e "${GREEN}✓ docker-compose.yml updated${NC}"

# Ensure .env file exists
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > "$DEPLOY_DIR/.env" << EOF
DB_PASSWORD=\${DB_PASSWORD:-changeme}
NODE_ENV=staging
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
fi

echo ""

# =============================================================================
# Start New Services
# =============================================================================
echo -e "${BLUE}Starting new services...${NC}"

cd "$DEPLOY_DIR"
docker-compose up -d

echo -e "${GREEN}✓ Services started${NC}"
echo ""

# =============================================================================
# Wait for Services to be Ready
# =============================================================================
echo -e "${BLUE}Waiting for services to be ready...${NC}"

MAX_WAIT=60
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker ps | grep -q "agogsaas-backend.*Up"; then
        echo -e "${GREEN}✓ Backend container is running${NC}"
        break
    fi

    echo -e "${YELLOW}Waiting for backend... ($WAIT_COUNT/$MAX_WAIT)${NC}"
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 1))

    if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
        echo -e "${RED}Error: Backend failed to start${NC}"
        docker-compose logs backend
        exit 1
    fi
done

# Wait an additional 15 seconds for app initialization
sleep 15

echo ""

# =============================================================================
# Health Checks
# =============================================================================
echo -e "${BLUE}Running health checks...${NC}"

# Check backend health
echo -e "${YELLOW}Checking backend health...${NC}"
HEALTH_CHECK_COUNT=0
MAX_HEALTH_CHECKS=10

while [ $HEALTH_CHECK_COUNT -lt $MAX_HEALTH_CHECKS ]; do
    if curl -f http://localhost:4001/health 2>/dev/null; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        break
    fi

    echo -e "${YELLOW}Backend not ready yet... ($HEALTH_CHECK_COUNT/$MAX_HEALTH_CHECKS)${NC}"
    sleep 5
    HEALTH_CHECK_COUNT=$((HEALTH_CHECK_COUNT + 1))

    if [ $HEALTH_CHECK_COUNT -eq $MAX_HEALTH_CHECKS ]; then
        echo -e "${RED}Error: Backend health check failed${NC}"
        docker-compose logs backend
        echo ""
        echo -e "${YELLOW}Rolling back to previous deployment...${NC}"
        docker-compose down
        if [ -f "$BACKUP_PATH/docker-compose.yml.backup" ]; then
            cp "$BACKUP_PATH/docker-compose.yml.backup" "$DEPLOY_DIR/docker-compose.yml"
            docker-compose up -d
            echo -e "${YELLOW}Rollback completed${NC}"
        fi
        exit 1
    fi
done

# Check frontend health
echo -e "${YELLOW}Checking frontend health...${NC}"
if curl -f http://localhost:3000 2>/dev/null | grep -q "AgogSaaS"; then
    echo -e "${GREEN}✓ Frontend is healthy${NC}"
else
    echo -e "${YELLOW}Warning: Frontend health check failed (non-critical)${NC}"
fi

# Check GraphQL endpoint
echo -e "${YELLOW}Checking GraphQL endpoint...${NC}"
GRAPHQL_RESPONSE=$(curl -s -X POST http://localhost:4001/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"{ __typename }"}' || echo "failed")

if echo "$GRAPHQL_RESPONSE" | grep -q "Query"; then
    echo -e "${GREEN}✓ GraphQL endpoint is healthy${NC}"
else
    echo -e "${YELLOW}Warning: GraphQL endpoint check failed${NC}"
fi

# Check database connection
echo -e "${YELLOW}Checking database connection...${NC}"
if docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is connected${NC}"
else
    echo -e "${RED}Error: Database connection failed${NC}"
    exit 1
fi

echo ""

# =============================================================================
# Deployment Summary
# =============================================================================
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Deployment Successful!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${BLUE}Deployment Details:${NC}"
echo -e "  Backend Image:  $BACKEND_IMAGE"
echo -e "  Frontend Image: $FRONTEND_IMAGE"
echo -e "  Backup Location: $BACKUP_PATH"
echo ""
echo -e "${BLUE}Services:${NC}"
echo -e "  Backend:   http://localhost:4001"
echo -e "  Frontend:  http://localhost:3000"
echo -e "  GraphQL:   http://localhost:4001/graphql"
echo -e "  Postgres:  localhost:5433"
echo -e "  NATS:      localhost:4223 (monitoring: :8223)"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  View logs:    docker-compose logs -f"
echo -e "  Stop:         docker-compose down"
echo -e "  Restart:      docker-compose restart"
echo -e "  Rollback:     cp $BACKUP_PATH/docker-compose.yml.backup docker-compose.yml && docker-compose up -d"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Monitor logs for any errors"
echo -e "  2. Run integration tests"
echo -e "  3. Verify all functionality"
echo ""
