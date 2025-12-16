#!/bin/bash
# AgogSaaS Blue-Green Traffic Switch Script
# Zero-downtime cutover between Blue and Green environments
# Usage: ./switch-blue-green.sh [target-environment]

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
echo -e "${BLUE}  AgogSaaS Blue-Green Switch${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Target environment required${NC}"
    echo "Usage: ./switch-blue-green.sh [target-environment]"
    echo "Target: blue or green"
    exit 1
fi

TARGET=$1

# Validate target
case $TARGET in
    blue|green)
        ;;
    *)
        echo -e "${RED}Error: Invalid target. Use 'blue' or 'green'${NC}"
        exit 1
        ;;
esac

# Determine current active
if [ "$TARGET" == "blue" ]; then
    CURRENT="green"
else
    CURRENT="blue"
fi

echo -e "${YELLOW}Current Active:${NC} $CURRENT"
echo -e "${YELLOW}Switching To:${NC} $TARGET"
echo ""

# Safety check - require confirmation
echo -e "${RED}WARNING: This will switch production traffic!${NC}"
echo -e "${YELLOW}Are you sure you want to proceed? (yes/no)${NC}"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Aborted.${NC}"
    exit 0
fi

# Pre-switch health checks
echo -e "${YELLOW}Running pre-switch health checks...${NC}"

check_health() {
    local env=$1
    local backend_port=$2
    local frontend_port=$3

    echo -e "${BLUE}Checking $env environment...${NC}"

    # Backend health
    if ! curl -f "http://localhost:$backend_port/health" &> /dev/null; then
        echo -e "${RED}✗ $env backend not healthy${NC}"
        return 1
    fi
    echo -e "${GREEN}✓ $env backend healthy${NC}"

    # Frontend health
    if ! curl -f "http://localhost:$frontend_port" &> /dev/null; then
        echo -e "${RED}✗ $env frontend not healthy${NC}"
        return 1
    fi
    echo -e "${GREEN}✓ $env frontend healthy${NC}"

    # Database health
    local db_port
    if [ "$env" == "blue" ]; then
        db_port=5432
    else
        db_port=5433
    fi

    cd "$REGIONAL_DIR"
    local db_container="regional-postgres-$env"
    if ! docker-compose -f docker-compose.regional.yml exec -T "postgres-$env" pg_isready &> /dev/null; then
        echo -e "${RED}✗ $env database not healthy${NC}"
        return 1
    fi
    echo -e "${GREEN}✓ $env database healthy${NC}"

    return 0
}

# Check target environment health
if ! check_health "$TARGET" "$([ "$TARGET" == "blue" ] && echo 4001 || echo 4002)" "$([ "$TARGET" == "blue" ] && echo 3001 || echo 3002)"; then
    echo -e "${RED}Target environment ($TARGET) is not healthy. Aborting switch.${NC}"
    exit 1
fi

echo ""

# Smoke test target environment
echo -e "${YELLOW}Running smoke tests on $TARGET environment...${NC}"

BACKEND_PORT=$([ "$TARGET" == "blue" ] && echo 4001 || echo 4002)
SMOKE_TEST_RESULT=$(curl -s "http://localhost:$BACKEND_PORT/health" | grep -o '"status":"healthy"' || echo "failed")

if [ "$SMOKE_TEST_RESULT" == "failed" ]; then
    echo -e "${RED}Smoke tests failed. Aborting switch.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Smoke tests passed${NC}"
echo ""

# Update nginx configuration
echo -e "${YELLOW}Updating nginx configuration...${NC}"

NGINX_CONFIG="$REGIONAL_DIR/nginx/blue-green.conf"

if [ ! -f "$NGINX_CONFIG" ]; then
    echo -e "${RED}Error: nginx config not found at $NGINX_CONFIG${NC}"
    exit 1
fi

# Backup current config
cp "$NGINX_CONFIG" "$NGINX_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"

# Update upstream configuration
if [ "$TARGET" == "blue" ]; then
    sed -i.bak 's/server backend.agogsaas-green:4000/server backend.agogsaas-blue:4000/g' "$NGINX_CONFIG"
    sed -i.bak 's/server frontend.agogsaas-green:80/server frontend.agogsaas-blue:80/g' "$NGINX_CONFIG"
else
    sed -i.bak 's/server backend.agogsaas-blue:4000/server backend.agogsaas-green:4000/g' "$NGINX_CONFIG"
    sed -i.bak 's/server frontend.agogsaas-blue:80/server frontend.agogsaas-green:80/g' "$NGINX_CONFIG"
fi

echo -e "${GREEN}✓ nginx configuration updated${NC}"

# Reload nginx
echo -e "${YELLOW}Reloading nginx...${NC}"
cd "$REGIONAL_DIR"
docker-compose -f docker-compose.regional.yml exec nginx nginx -s reload

echo -e "${GREEN}✓ nginx reloaded${NC}"
echo ""

# Update environment variable
echo -e "${YELLOW}Updating active environment variable...${NC}"

if [ -f "$REGIONAL_DIR/.env" ]; then
    sed -i.bak "s/ACTIVE_ENVIRONMENT=.*/ACTIVE_ENVIRONMENT=$TARGET/" "$REGIONAL_DIR/.env"
    echo -e "${GREEN}✓ Environment variable updated${NC}"
fi

# Post-switch verification
echo -e "${YELLOW}Running post-switch verification...${NC}"
sleep 3

# Check nginx is routing to correct backend
NGINX_RESPONSE=$(curl -s http://localhost:80/health || echo "failed")
if [ "$NGINX_RESPONSE" == "failed" ]; then
    echo -e "${RED}Post-switch verification failed!${NC}"
    echo -e "${YELLOW}Rolling back...${NC}"

    # Restore backup
    mv "$NGINX_CONFIG.backup."* "$NGINX_CONFIG"
    docker-compose -f docker-compose.regional.yml exec nginx nginx -s reload

    echo -e "${YELLOW}Rolled back to $CURRENT environment${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Post-switch verification passed${NC}"
echo ""

# Success
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Switch Successful!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${BLUE}Traffic Status:${NC}"
echo -e "  Previous Active: ${RED}$CURRENT${NC}"
echo -e "  Current Active: ${GREEN}$TARGET${NC}"
echo ""
echo -e "${BLUE}Monitoring:${NC}"
echo -e "  Load Balancer: http://localhost:80"
echo -e "  $TARGET Backend: http://localhost:$([ "$TARGET" == "blue" ] && echo 4001 || echo 4002)"
echo -e "  $TARGET Frontend: http://localhost:$([ "$TARGET" == "blue" ] && echo 3001 || echo 3002)"
echo -e "  Grafana: http://localhost:3000"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Monitor for 24 hours"
echo -e "  2. Watch error rates in Grafana"
echo -e "  3. Check logs: docker-compose logs -f"
echo -e "  4. If issues occur, rollback with: ./switch-blue-green.sh $CURRENT"
echo ""
echo -e "${BLUE}Rollback Command:${NC}"
echo -e "  ./switch-blue-green.sh $CURRENT"
echo ""

echo -e "${GREEN}Blue-Green switch complete!${NC}"
