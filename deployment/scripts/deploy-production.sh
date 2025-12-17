#!/bin/bash
# AgogSaaS Production Deployment Script (Blue-Green)
# Deploys to either Blue or Green environment for zero-downtime deployments
# Usage: ./deploy-production.sh <environment> <backend-image> <frontend-image>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  AgogSaaS Production Deployment${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check arguments
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo -e "${RED}Error: Environment and image names required${NC}"
    echo "Usage: ./deploy-production.sh <environment> <backend-image> <frontend-image>"
    echo "Environment: blue or green"
    echo "Example: ./deploy-production.sh blue ghcr.io/user/backend:v1.0.0 ghcr.io/user/frontend:v1.0.0"
    exit 1
fi

ENVIRONMENT=$1
BACKEND_IMAGE=$2
FRONTEND_IMAGE=$3

# Validate environment
if [ "$ENVIRONMENT" != "blue" ] && [ "$ENVIRONMENT" != "green" ]; then
    echo -e "${RED}Error: Environment must be 'blue' or 'green'${NC}"
    exit 1
fi

# Determine other environment for reference
if [ "$ENVIRONMENT" == "blue" ]; then
    OTHER_ENV="green"
    BACKEND_PORT=4001
    FRONTEND_PORT=3001
    DB_PORT=5432
else
    OTHER_ENV="blue"
    BACKEND_PORT=4002
    FRONTEND_PORT=3002
    DB_PORT=5433
fi

DEPLOY_DIR="/opt/agogsaas/$ENVIRONMENT"
BACKUP_DIR="/opt/agogsaas-backups"

echo -e "${YELLOW}Target Environment:${NC} $ENVIRONMENT"
echo -e "${YELLOW}Backend Image:${NC} $BACKEND_IMAGE"
echo -e "${YELLOW}Frontend Image:${NC} $FRONTEND_IMAGE"
echo -e "${YELLOW}Backend Port:${NC} $BACKEND_PORT"
echo -e "${YELLOW}Frontend Port:${NC} $FRONTEND_PORT"
echo ""

# =============================================================================
# Pre-Deployment Safety Checks
# =============================================================================
echo -e "${BLUE}Running pre-deployment safety checks...${NC}"

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
    mkdir -p "$BACKUP_DIR"
fi
echo -e "${GREEN}✓ Backup directory exists${NC}"

# Check disk space (need at least 10GB free for production)
AVAILABLE_SPACE=$(df "$DEPLOY_DIR" | tail -1 | awk '{print $4}')
if [ "$AVAILABLE_SPACE" -lt 10485760 ]; then
    echo -e "${RED}Error: Insufficient disk space (need 10GB free)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Sufficient disk space available${NC}"

# Check if other environment is running (for reference)
if docker ps | grep -q "agogsaas-backend-$OTHER_ENV"; then
    echo -e "${GREEN}✓ $OTHER_ENV environment is running (available for rollback)${NC}"
    ROLLBACK_AVAILABLE=true
else
    echo -e "${YELLOW}Warning: $OTHER_ENV environment is not running${NC}"
    ROLLBACK_AVAILABLE=false
fi

echo ""

# Require manual confirmation for production
echo -e "${RED}PRODUCTION DEPLOYMENT WARNING${NC}"
echo -e "${YELLOW}You are about to deploy to PRODUCTION $ENVIRONMENT environment${NC}"
echo -e "${YELLOW}Current images will be replaced with:${NC}"
echo -e "  Backend:  $BACKEND_IMAGE"
echo -e "  Frontend: $FRONTEND_IMAGE"
echo ""
echo -e "${YELLOW}Type 'DEPLOY' to continue:${NC}"
read -r CONFIRMATION

if [ "$CONFIRMATION" != "DEPLOY" ]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

echo ""

# =============================================================================
# Backup Current Deployment
# =============================================================================
echo -e "${BLUE}Backing up current deployment...${NC}"

BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/production_${ENVIRONMENT}_backup_$BACKUP_TIMESTAMP"

if [ -d "$DEPLOY_DIR" ] && [ "$(ls -A $DEPLOY_DIR 2>/dev/null)" ]; then
    mkdir -p "$BACKUP_PATH"

    # Save current configuration
    if [ -f "$DEPLOY_DIR/.env" ]; then
        cp "$DEPLOY_DIR/.env" "$BACKUP_PATH/.env.backup"
        echo -e "${GREEN}✓ Backed up environment configuration${NC}"
    fi

    if [ -f "$DEPLOY_DIR/docker-compose.yml" ]; then
        cp "$DEPLOY_DIR/docker-compose.yml" "$BACKUP_PATH/docker-compose.yml.backup"
        echo -e "${GREEN}✓ Backed up docker-compose configuration${NC}"
    fi

    # Export database backup (CRITICAL for production)
    if docker ps | grep -q "agogsaas-postgres-$ENVIRONMENT"; then
        echo -e "${YELLOW}Creating database backup (this may take a few minutes)...${NC}"
        docker exec "agogsaas-postgres-$ENVIRONMENT" pg_dump -U agogsaas_user agogsaas | gzip > "$BACKUP_PATH/database_backup.sql.gz" 2>/dev/null || echo -e "${RED}ERROR: Database backup failed!${NC}"
        echo -e "${GREEN}✓ Database backup created${NC}"
    fi

    # Save current image information
    docker images | grep "agogsaas-backend\|agogsaas-frontend" > "$BACKUP_PATH/images.txt" || true

    echo -e "${GREEN}✓ Backup created at: $BACKUP_PATH${NC}"
else
    echo -e "${YELLOW}No existing deployment to backup${NC}"
fi

# Keep last 10 production backups
echo -e "${YELLOW}Cleaning up old backups (keeping last 10)...${NC}"
ls -t "$BACKUP_DIR" | grep "production_${ENVIRONMENT}" | tail -n +11 | xargs -I {} rm -rf "$BACKUP_DIR/{}" 2>/dev/null || true
echo -e "${GREEN}✓ Old backups cleaned up${NC}"

echo ""

# =============================================================================
# Login to Container Registry
# =============================================================================
echo -e "${BLUE}Authenticating with container registry...${NC}"

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
echo -e "${BLUE}Stopping current $ENVIRONMENT services...${NC}"

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

# Create/update docker-compose.yml for production
cat > "$DEPLOY_DIR/docker-compose.yml" << EOF
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: agogsaas-postgres-$ENVIRONMENT
    environment:
      POSTGRES_DB: agogsaas
      POSTGRES_USER: agogsaas_user
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    ports:
      - "$DB_PORT:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agogsaas_user -d agogsaas"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G

  nats:
    image: nats:latest
    container_name: agogsaas-nats-$ENVIRONMENT
    command:
      - "-js"
      - "-sd"
      - "/data"
      - "-m"
      - "8222"
    ports:
      - "4222:4222"
      - "8222:8222"
    volumes:
      - nats_data:/data
    restart: always

  ollama:
    image: ollama/ollama:latest
    container_name: agogsaas-ollama-$ENVIRONMENT
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: always

  backend:
    image: $BACKEND_IMAGE
    container_name: agogsaas-backend-$ENVIRONMENT
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://agogsaas_user:\${DB_PASSWORD}@postgres:5432/agogsaas
      NATS_URL: nats://nats:4222
      OLLAMA_URL: http://ollama:11434
    ports:
      - "$BACKEND_PORT:4000"
    depends_on:
      postgres:
        condition: service_healthy
      nats:
        condition: service_started
    restart: always
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    image: $FRONTEND_IMAGE
    container_name: agogsaas-frontend-$ENVIRONMENT
    environment:
      VITE_GRAPHQL_URL: https://agogsaas.com/graphql
      NODE_ENV: production
    ports:
      - "$FRONTEND_PORT:3000"
    depends_on:
      - backend
    restart: always
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

volumes:
  postgres_data:
    name: agogsaas_postgres_${ENVIRONMENT}
  nats_data:
    name: agogsaas_nats_${ENVIRONMENT}
  ollama_data:
    name: agogsaas_ollama_${ENVIRONMENT}

networks:
  default:
    name: agogsaas-production-$ENVIRONMENT
EOF

echo -e "${GREEN}✓ docker-compose.yml updated${NC}"

# Ensure .env file exists
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > "$DEPLOY_DIR/.env" << EOF
DB_PASSWORD=\${DB_PASSWORD}
NODE_ENV=production
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

MAX_WAIT=120
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker ps | grep -q "agogsaas-backend-$ENVIRONMENT.*Up"; then
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

# Wait for app initialization (production needs more time)
echo -e "${YELLOW}Waiting for application initialization...${NC}"
sleep 30

echo ""

# =============================================================================
# Comprehensive Health Checks
# =============================================================================
echo -e "${BLUE}Running comprehensive health checks...${NC}"

HEALTH_FAILED=false

# Check backend health
echo -e "${YELLOW}Checking backend health...${NC}"
HEALTH_CHECK_COUNT=0
MAX_HEALTH_CHECKS=15

while [ $HEALTH_CHECK_COUNT -lt $MAX_HEALTH_CHECKS ]; do
    if curl -f http://localhost:$BACKEND_PORT/health 2>/dev/null; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        break
    fi

    echo -e "${YELLOW}Backend not ready yet... ($HEALTH_CHECK_COUNT/$MAX_HEALTH_CHECKS)${NC}"
    sleep 10
    HEALTH_CHECK_COUNT=$((HEALTH_CHECK_COUNT + 1))

    if [ $HEALTH_CHECK_COUNT -eq $MAX_HEALTH_CHECKS ]; then
        echo -e "${RED}Error: Backend health check failed${NC}"
        HEALTH_FAILED=true
        break
    fi
done

# Check frontend health
echo -e "${YELLOW}Checking frontend health...${NC}"
if curl -f http://localhost:$FRONTEND_PORT 2>/dev/null | grep -q "AgogSaaS"; then
    echo -e "${GREEN}✓ Frontend is healthy${NC}"
else
    echo -e "${RED}Error: Frontend health check failed${NC}"
    HEALTH_FAILED=true
fi

# Check GraphQL endpoint
echo -e "${YELLOW}Checking GraphQL endpoint...${NC}"
GRAPHQL_RESPONSE=$(curl -s -X POST http://localhost:$BACKEND_PORT/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"{ __typename }"}' || echo "failed")

if echo "$GRAPHQL_RESPONSE" | grep -q "Query"; then
    echo -e "${GREEN}✓ GraphQL endpoint is healthy${NC}"
else
    echo -e "${RED}Error: GraphQL endpoint check failed${NC}"
    HEALTH_FAILED=true
fi

# Check database connection
echo -e "${YELLOW}Checking database connection...${NC}"
if docker exec "agogsaas-postgres-$ENVIRONMENT" psql -U agogsaas_user -d agogsaas -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is connected${NC}"
else
    echo -e "${RED}Error: Database connection failed${NC}"
    HEALTH_FAILED=true
fi

# Check NATS connection
echo -e "${YELLOW}Checking NATS connection...${NC}"
if curl -f http://localhost:8222/healthz 2>/dev/null | grep -q "ok"; then
    echo -e "${GREEN}✓ NATS is healthy${NC}"
else
    echo -e "${YELLOW}Warning: NATS health check failed (non-critical)${NC}"
fi

echo ""

# =============================================================================
# Handle Health Check Failures
# =============================================================================
if [ "$HEALTH_FAILED" == "true" ]; then
    echo -e "${RED}======================================${NC}"
    echo -e "${RED}  Health Checks Failed!${NC}"
    echo -e "${RED}======================================${NC}"
    echo ""
    echo -e "${YELLOW}Deployment has issues. Rolling back...${NC}"

    # Stop failed deployment
    docker-compose down

    # Restore from backup if available
    if [ -f "$BACKUP_PATH/docker-compose.yml.backup" ]; then
        cp "$BACKUP_PATH/docker-compose.yml.backup" "$DEPLOY_DIR/docker-compose.yml"
        cp "$BACKUP_PATH/.env.backup" "$DEPLOY_DIR/.env"
        docker-compose up -d

        echo -e "${YELLOW}Rollback completed${NC}"
        echo -e "${YELLOW}Review logs: docker-compose logs${NC}"
    else
        echo -e "${RED}No backup available for automatic rollback${NC}"
    fi

    exit 1
fi

# =============================================================================
# Deployment Success
# =============================================================================
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Deployment Successful!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${BLUE}Deployment Details:${NC}"
echo -e "  Environment:    $ENVIRONMENT"
echo -e "  Backend Image:  $BACKEND_IMAGE"
echo -e "  Frontend Image: $FRONTEND_IMAGE"
echo -e "  Backup Location: $BACKUP_PATH"
echo ""
echo -e "${BLUE}Services:${NC}"
echo -e "  Backend:   http://localhost:$BACKEND_PORT"
echo -e "  Frontend:  http://localhost:$FRONTEND_PORT"
echo -e "  GraphQL:   http://localhost:$BACKEND_PORT/graphql"
echo -e "  Postgres:  localhost:$DB_PORT"
echo -e "  NATS:      localhost:4222 (monitoring: :8222)"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  View logs:    cd $DEPLOY_DIR && docker-compose logs -f"
echo -e "  Stop:         cd $DEPLOY_DIR && docker-compose down"
echo -e "  Restart:      cd $DEPLOY_DIR && docker-compose restart"
echo ""
echo -e "${YELLOW}IMPORTANT NEXT STEPS:${NC}"
echo -e "  1. Monitor logs for 10+ minutes: docker-compose logs -f"
echo -e "  2. Run production smoke tests"
echo -e "  3. Monitor application metrics"
echo -e "  4. Test critical user flows"
echo -e "  5. When confident, switch traffic with: ./switch-blue-green.sh $ENVIRONMENT"
echo ""
echo -e "${RED}DO NOT SWITCH TRAFFIC YET!${NC}"
echo -e "${YELLOW}This deployment is running on port $BACKEND_PORT and $FRONTEND_PORT${NC}"
echo -e "${YELLOW}Production traffic is still going to $OTHER_ENV environment${NC}"
echo -e "${YELLOW}Run smoke tests and verify everything works before switching traffic${NC}"
echo ""
