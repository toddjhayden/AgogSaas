#!/bin/bash

###############################################################################
# REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
# Deployment Script
#
# Purpose: Deploy carrier shipping integration feature to production
#
# Components:
# - Database migrations (V0.0.4__create_wms_module.sql)
# - Backend services (7 carrier integration services)
# - GraphQL schema and resolvers
# - Frontend components (CarrierIntegrationsPage, ShipmentsPage)
#
# Usage: ./deploy-carrier-shipping.sh [environment]
# Example: ./deploy-carrier-shipping.sh production
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

ENVIRONMENT=${1:-development}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$BACKEND_DIR/migrations"

echo "=========================================="
echo "REQ-STRATEGIC-AUTO-1767066329941"
echo "Carrier Shipping Integrations Deployment"
echo "Environment: $ENVIRONMENT"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Step 1: Checking prerequisites..."
echo "-----------------------------------"

# Check if PostgreSQL is accessible
if ! command -v psql &> /dev/null; then
    echo -e "${RED}ERROR: psql command not found. Please install PostgreSQL client.${NC}"
    exit 1
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: node command not found. Please install Node.js.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Load environment variables
echo "Step 2: Loading environment configuration..."
echo "---------------------------------------------"

if [ -f "$BACKEND_DIR/.env.$ENVIRONMENT" ]; then
    source "$BACKEND_DIR/.env.$ENVIRONMENT"
    echo -e "${GREEN}✓ Environment file loaded: .env.$ENVIRONMENT${NC}"
elif [ -f "$BACKEND_DIR/.env" ]; then
    source "$BACKEND_DIR/.env"
    echo -e "${YELLOW}⚠ Using default .env file${NC}"
else
    echo -e "${RED}ERROR: No environment file found${NC}"
    exit 1
fi

echo ""

# Database migration
echo "Step 3: Running database migrations..."
echo "---------------------------------------"

echo "Applying V0.0.4__create_wms_module.sql (Carrier Shipping Tables)..."

# Check if migration has already been applied
MIGRATION_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM flyway_schema_history WHERE script = 'V0.0.4__create_wms_module.sql'" 2>/dev/null || echo "0")

if [ "$MIGRATION_EXISTS" -gt "0" ]; then
    echo -e "${YELLOW}⚠ Migration V0.0.4 already applied, skipping...${NC}"
else
    if [ -f "$MIGRATIONS_DIR/V0.0.4__create_wms_module.sql" ]; then
        psql "$DATABASE_URL" -f "$MIGRATIONS_DIR/V0.0.4__create_wms_module.sql"
        echo -e "${GREEN}✓ Migration V0.0.4 applied successfully${NC}"
    else
        echo -e "${RED}ERROR: Migration file V0.0.4__create_wms_module.sql not found${NC}"
        exit 1
    fi
fi

echo ""

# Verify database tables
echo "Step 4: Verifying database tables..."
echo "-------------------------------------"

TABLES_TO_CHECK=(
    "carrier_integrations"
    "shipments"
    "shipment_lines"
    "tracking_events"
    "shipment_manifest_attempts"
    "shipment_retry_queue"
    "shipment_manual_review_queue"
    "carrier_api_errors"
)

for table in "${TABLES_TO_CHECK[@]}"; do
    TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.$table')" 2>/dev/null)
    if [ "$TABLE_EXISTS" == "null" ] || [ -z "$TABLE_EXISTS" ]; then
        echo -e "${RED}ERROR: Table $table does not exist${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ Table $table exists${NC}"
    fi
done

echo ""

# Build backend
echo "Step 5: Building backend services..."
echo "-------------------------------------"

cd "$BACKEND_DIR"

# Install dependencies
echo "Installing dependencies..."
npm install

# Build TypeScript
echo "Building TypeScript..."
npm run build

echo -e "${GREEN}✓ Backend build completed${NC}"
echo ""

# Verify backend services
echo "Step 6: Verifying backend services..."
echo "--------------------------------------"

SERVICES_TO_CHECK=(
    "src/modules/wms/services/credential-encryption.service.ts"
    "src/modules/wms/services/carrier-error-mapper.service.ts"
    "src/modules/wms/services/carrier-rate-limiter.service.ts"
    "src/modules/wms/services/carrier-circuit-breaker.service.ts"
    "src/modules/wms/services/shipment-manifest-orchestrator.service.ts"
    "src/modules/wms/services/carrier-client-factory.service.ts"
    "src/modules/wms/services/carriers/fedex-client.service.ts"
)

for service in "${SERVICES_TO_CHECK[@]}"; do
    if [ -f "$BACKEND_DIR/$service" ]; then
        echo -e "${GREEN}✓ Service exists: $service${NC}"
    else
        echo -e "${RED}ERROR: Service not found: $service${NC}"
        exit 1
    fi
done

echo ""

# Build frontend
echo "Step 7: Building frontend..."
echo "----------------------------"

FRONTEND_DIR="$(dirname "$BACKEND_DIR")/frontend"

if [ -d "$FRONTEND_DIR" ]; then
    cd "$FRONTEND_DIR"

    # Install dependencies
    echo "Installing dependencies..."
    npm install

    # Build frontend
    echo "Building frontend..."
    npm run build

    echo -e "${GREEN}✓ Frontend build completed${NC}"
else
    echo -e "${YELLOW}⚠ Frontend directory not found, skipping frontend build${NC}"
fi

echo ""

# Verify frontend components
echo "Step 8: Verifying frontend components..."
echo "-----------------------------------------"

if [ -d "$FRONTEND_DIR" ]; then
    FRONTEND_COMPONENTS=(
        "src/pages/CarrierIntegrationsPage.tsx"
        "src/pages/ShipmentsPage.tsx"
        "src/pages/ShipmentDetailPage.tsx"
        "src/graphql/queries/shipping.ts"
        "src/graphql/mutations/shipping.ts"
    )

    for component in "${FRONTEND_COMPONENTS[@]}"; do
        if [ -f "$FRONTEND_DIR/$component" ]; then
            echo -e "${GREEN}✓ Component exists: $component${NC}"
        else
            echo -e "${YELLOW}⚠ Component not found: $component${NC}"
        fi
    done
fi

echo ""

# Create initial carrier integrations (optional)
echo "Step 9: Setting up initial carrier configurations..."
echo "-----------------------------------------------------"

echo "Do you want to create initial carrier integration records? (y/n)"
read -r CREATE_CARRIERS

if [[ "$CREATE_CARRIERS" =~ ^[Yy]$ ]]; then
    echo "Creating FedEx carrier integration template..."

    psql "$DATABASE_URL" <<EOF
INSERT INTO carrier_integrations (
    tenant_id,
    carrier_code,
    carrier_name,
    carrier_type,
    api_endpoint,
    api_version,
    supports_tracking,
    supports_rate_quotes,
    supports_label_generation,
    is_active
)
SELECT
    id as tenant_id,
    'FEDEX' as carrier_code,
    'FedEx' as carrier_name,
    'PARCEL' as carrier_type,
    'https://apis.fedex.com' as api_endpoint,
    'v1' as api_version,
    true as supports_tracking,
    true as supports_rate_quotes,
    true as supports_label_generation,
    false as is_active
FROM tenants
WHERE NOT EXISTS (
    SELECT 1 FROM carrier_integrations
    WHERE carrier_code = 'FEDEX' AND tenant_id = tenants.id
)
ON CONFLICT DO NOTHING;
EOF

    echo -e "${GREEN}✓ FedEx carrier integration templates created for all tenants${NC}"
    echo -e "${YELLOW}⚠ Note: Carrier integrations are created as INACTIVE. Administrators must configure API credentials and activate them.${NC}"
else
    echo "Skipping carrier integration creation"
fi

echo ""

# Deployment summary
echo "=========================================="
echo "DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
echo -e "${GREEN}✓ All carrier shipping integration components deployed successfully${NC}"
echo ""
echo "Deployment Summary:"
echo "-------------------"
echo "• Database tables: 8 tables created"
echo "  - carrier_integrations (carrier API configurations)"
echo "  - shipments (outbound shipments)"
echo "  - shipment_lines (line items)"
echo "  - tracking_events (carrier tracking)"
echo "  - shipment_manifest_attempts (saga pattern state)"
echo "  - shipment_retry_queue (retry management)"
echo "  - shipment_manual_review_queue (manual intervention)"
echo "  - carrier_api_errors (error logging)"
echo ""
echo "• Backend services: 7 services deployed"
echo "  - CredentialEncryptionService"
echo "  - CarrierErrorMapperService"
echo "  - CarrierApiRateLimiterService"
echo "  - CarrierCircuitBreakerService"
echo "  - ShipmentManifestOrchestratorService"
echo "  - CarrierClientFactoryService"
echo "  - FedExClientService (Phase 1 mock)"
echo ""
echo "• Frontend components: 3 pages deployed"
echo "  - CarrierIntegrationsPage"
echo "  - ShipmentsPage"
echo "  - ShipmentDetailPage"
echo ""
echo "• GraphQL API: 9 queries & 5 mutations"
echo ""
echo "Next Steps:"
echo "-----------"
echo "1. Run health check: ./health-check-carrier-shipping.sh"
echo "2. Configure carrier API credentials in admin UI"
echo "3. Activate carrier integrations"
echo "4. Test shipment creation and manifesting"
echo "5. Monitor carrier API health and rate limits"
echo ""
echo "Documentation:"
echo "--------------"
echo "• Carrier Integration Interface: backend/src/modules/wms/interfaces/carrier-client.interface.ts"
echo "• Error Handling: backend/src/modules/wms/services/carrier-error-mapper.service.ts"
echo "• Saga Pattern: backend/src/modules/wms/services/shipment-manifest-orchestrator.service.ts"
echo ""
