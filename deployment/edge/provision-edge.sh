#!/bin/bash
# AgogSaaS Edge Provisioning Script
# Automated edge computer setup and cloud registration
# Usage: ./provision-edge.sh [facility-id] [tenant-id] [region]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AgogSaaS Edge Provisioning${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check arguments
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: ./provision-edge.sh [facility-id] [tenant-id] [region]"
    echo ""
    echo "Example: ./provision-edge.sh facility-la-001 acme-corp US-EAST"
    echo ""
    echo "Regions: US-EAST, EU-CENTRAL, APAC"
    exit 1
fi

FACILITY_ID=$1
TENANT_ID=$2
REGION=$3

echo -e "${BLUE}Configuration:${NC}"
echo -e "  Facility ID: $FACILITY_ID"
echo -e "  Tenant ID: $TENANT_ID"
echo -e "  Region: $REGION"
echo ""

# Set regional cloud URL
case $REGION in
    US-EAST)
        REGIONAL_CLOUD_URL="https://us-east.agogsaas.com"
        ;;
    EU-CENTRAL)
        REGIONAL_CLOUD_URL="https://eu-central.agogsaas.com"
        ;;
    APAC)
        REGIONAL_CLOUD_URL="https://apac.agogsaas.com"
        ;;
    *)
        echo -e "${RED}Invalid region. Use US-EAST, EU-CENTRAL, or APAC${NC}"
        exit 1
        ;;
esac

echo -e "${BLUE}Regional Cloud:${NC} $REGIONAL_CLOUD_URL"
echo ""

# =============================================================================
# Step 1: System Requirements Check
# =============================================================================
echo -e "${YELLOW}Step 1: Checking system requirements...${NC}"

# Check OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo -e "${GREEN}✓ Linux detected${NC}"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${GREEN}✓ macOS detected${NC}"
else
    echo -e "${RED}✗ Unsupported OS: $OSTYPE${NC}"
    exit 1
fi

# Check memory
TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}' 2>/dev/null || sysctl -n hw.memsize | awk '{print $1/1024/1024/1024}' 2>/dev/null)
if [ -z "$TOTAL_MEM" ]; then
    TOTAL_MEM=8  # Default if can't detect
fi

echo -e "  Total Memory: ${TOTAL_MEM}GB"
if [ "$TOTAL_MEM" -lt 8 ]; then
    echo -e "${RED}✗ Insufficient memory. Need at least 8GB${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Memory check passed${NC}"

# Check disk space
DISK_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
echo -e "  Available Disk: ${DISK_SPACE}GB"
if [ "$DISK_SPACE" -lt 100 ]; then
    echo -e "${YELLOW}⚠ Low disk space. Recommended: 256GB+ available${NC}"
fi
echo -e "${GREEN}✓ Disk check passed${NC}"

echo ""

# =============================================================================
# Step 2: Install Docker
# =============================================================================
echo -e "${YELLOW}Step 2: Installing Docker...${NC}"

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓ Docker already installed: $DOCKER_VERSION${NC}"
else
    echo -e "${YELLOW}Installing Docker...${NC}"

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Install Docker on Linux
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        echo -e "${GREEN}✓ Docker installed${NC}"
        echo -e "${YELLOW}Note: You may need to log out and back in for Docker permissions${NC}"
    else
        echo -e "${RED}Please install Docker Desktop for macOS manually${NC}"
        exit 1
    fi
fi

# Install Docker Compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo -e "${GREEN}✓ Docker Compose already installed: $COMPOSE_VERSION${NC}"
else
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
fi

echo ""

# =============================================================================
# Step 3: Download Edge Configuration
# =============================================================================
echo -e "${YELLOW}Step 3: Downloading edge configuration...${NC}"

EDGE_DIR="/opt/agogsaas/edge"
sudo mkdir -p "$EDGE_DIR"
sudo chown -R $USER:$USER /opt/agogsaas

# Download docker-compose file
echo -e "${YELLOW}Downloading docker-compose.edge.yml...${NC}"
curl -fsSL "$REGIONAL_CLOUD_URL/downloads/docker-compose.edge.yml" -o "$EDGE_DIR/docker-compose.edge.yml" || {
    echo -e "${RED}Failed to download from cloud. Using local copy...${NC}"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cp "$SCRIPT_DIR/docker-compose.edge.yml" "$EDGE_DIR/docker-compose.edge.yml"
}

echo -e "${GREEN}✓ Configuration downloaded${NC}"

# =============================================================================
# Step 4: Configure Environment
# =============================================================================
echo -e "${YELLOW}Step 4: Configuring environment...${NC}"

# Generate random passwords
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)
CLOUD_API_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-40)

# Create .env file
cat > "$EDGE_DIR/.env" << EOF
# AgogSaaS Edge Configuration
# Generated: $(date)

# Facility Information
FACILITY_ID=$FACILITY_ID
TENANT_ID=$TENANT_ID
REGION=$REGION

# Database
EDGE_DB_NAME=agog_edge
EDGE_DB_USER=edge_user
EDGE_DB_PASSWORD=$DB_PASSWORD
EDGE_DB_PORT=5432

# Regional Cloud Connection
REGIONAL_CLOUD_URL=$REGIONAL_CLOUD_URL
REGIONAL_CLOUD_API_KEY=$CLOUD_API_KEY

# Security
JWT_SECRET=$JWT_SECRET

# Sync Configuration
SYNC_INTERVAL=30
SYNC_BATCH_SIZE=1000

# Ollama (disable for low-end hardware)
OLLAMA_ENABLED=false

# Node Environment
NODE_ENV=production
EOF

echo -e "${GREEN}✓ Environment configured${NC}"
echo ""

# =============================================================================
# Step 5: Network Configuration
# =============================================================================
echo -e "${YELLOW}Step 5: Configuring network...${NC}"

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || ipconfig getifaddr en0 2>/dev/null || echo "unknown")
echo -e "  Local IP: $LOCAL_IP"

# Test regional cloud connectivity
echo -e "  Testing cloud connectivity..."
if curl -f -m 10 "$REGIONAL_CLOUD_URL/health" &> /dev/null; then
    echo -e "${GREEN}✓ Regional cloud reachable${NC}"
else
    echo -e "${YELLOW}⚠ Cannot reach regional cloud (will retry during sync)${NC}"
fi

echo ""

# =============================================================================
# Step 6: Pull Docker Images
# =============================================================================
echo -e "${YELLOW}Step 6: Pulling Docker images...${NC}"

cd "$EDGE_DIR"
docker-compose -f docker-compose.edge.yml pull

echo -e "${GREEN}✓ Docker images pulled${NC}"
echo ""

# =============================================================================
# Step 7: Start Services
# =============================================================================
echo -e "${YELLOW}Step 7: Starting edge services...${NC}"

docker-compose -f docker-compose.edge.yml up -d

echo -e "${GREEN}✓ Services started${NC}"
echo ""

# =============================================================================
# Step 8: Health Check
# =============================================================================
echo -e "${YELLOW}Step 8: Waiting for services to be healthy...${NC}"

sleep 15

MAX_RETRIES=30
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:4000/health &> /dev/null; then
        echo -e "${GREEN}✓ Backend healthy${NC}"
        break
    fi
    RETRY=$((RETRY + 1))
    echo -e "${YELLOW}Waiting... ($RETRY/$MAX_RETRIES)${NC}"
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo -e "${RED}✗ Services failed to start${NC}"
    echo -e "${YELLOW}Check logs: docker-compose -f $EDGE_DIR/docker-compose.edge.yml logs${NC}"
    exit 1
fi

# =============================================================================
# Step 9: Register with Regional Cloud
# =============================================================================
echo -e "${YELLOW}Step 9: Registering with regional cloud...${NC}"

REGISTER_PAYLOAD=$(cat <<EOF
{
  "facilityId": "$FACILITY_ID",
  "tenantId": "$TENANT_ID",
  "region": "$REGION",
  "ipAddress": "$LOCAL_IP",
  "apiKey": "$CLOUD_API_KEY",
  "version": "1.0.0"
}
EOF
)

REGISTER_RESPONSE=$(curl -s -X POST "$REGIONAL_CLOUD_URL/api/edge/register" \
    -H "Content-Type: application/json" \
    -d "$REGISTER_PAYLOAD" || echo '{"error":"failed"}')

if echo "$REGISTER_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Registered with regional cloud${NC}"
else
    echo -e "${YELLOW}⚠ Could not register (will retry automatically)${NC}"
fi

echo ""

# =============================================================================
# Step 10: Setup Systemd Service (Linux only)
# =============================================================================
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo -e "${YELLOW}Step 10: Setting up auto-start service...${NC}"

    sudo tee /etc/systemd/system/agogsaas-edge.service > /dev/null <<EOF
[Unit]
Description=AgogSaaS Edge Services
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$EDGE_DIR
ExecStart=/usr/local/bin/docker-compose -f docker-compose.edge.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.edge.yml down
User=$USER

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable agogsaas-edge.service
    echo -e "${GREEN}✓ Auto-start configured${NC}"
    echo ""
fi

# =============================================================================
# Provisioning Complete
# =============================================================================
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Edge Provisioning Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Installation Summary:${NC}"
echo -e "  Facility ID: $FACILITY_ID"
echo -e "  Tenant ID: $TENANT_ID"
echo -e "  Region: $REGION"
echo -e "  Installation Directory: $EDGE_DIR"
echo ""
echo -e "${BLUE}Services:${NC}"
echo -e "  Backend API: http://localhost:4000"
echo -e "  Health Check: http://localhost:4000/health"
echo -e "  PostgreSQL: localhost:5432"
echo -e "  NATS: http://localhost:8222"
echo ""
echo -e "${BLUE}Management Commands:${NC}"
echo -e "  View logs: docker-compose -f $EDGE_DIR/docker-compose.edge.yml logs -f"
echo -e "  Stop: docker-compose -f $EDGE_DIR/docker-compose.edge.yml down"
echo -e "  Restart: docker-compose -f $EDGE_DIR/docker-compose.edge.yml restart"
echo -e "  Status: docker-compose -f $EDGE_DIR/docker-compose.edge.yml ps"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  Config file: $EDGE_DIR/.env"
echo -e "  DB Password: ${GREEN}[saved in .env]${NC}"
echo -e "  Cloud API Key: ${GREEN}[saved in .env]${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Verify health: curl http://localhost:4000/health"
echo -e "  2. Monitor logs: docker-compose -f $EDGE_DIR/docker-compose.edge.yml logs -f"
echo -e "  3. Configure network firewall (if needed)"
echo -e "  4. Setup VPN to regional cloud (recommended)"
echo ""
echo -e "${GREEN}Edge provisioning complete!${NC}"
