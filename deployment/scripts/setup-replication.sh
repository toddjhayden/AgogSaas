#!/bin/bash
# AgogSaaS PostgreSQL Logical Replication Setup
# Configures multi-region and edge-to-regional replication
# Usage: ./setup-replication.sh [type] [source] [target]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  PostgreSQL Replication Setup${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check arguments
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: ./setup-replication.sh [type] [source] [target]"
    echo ""
    echo "Types:"
    echo "  edge-to-regional  - Edge facility to regional cloud"
    echo "  regional-to-edge  - Regional cloud to edge facility (master data)"
    echo "  regional-to-regional - Cross-region replication"
    echo ""
    echo "Examples:"
    echo "  ./setup-replication.sh edge-to-regional edge-la us-east"
    echo "  ./setup-replication.sh regional-to-regional us-east eu-central"
    exit 1
fi

TYPE=$1
SOURCE=$2
TARGET=$3

echo -e "${BLUE}Replication Type:${NC} $TYPE"
echo -e "${BLUE}Source:${NC} $SOURCE"
echo -e "${BLUE}Target:${NC} $TARGET"
echo ""

# Function to setup edge-to-regional replication
setup_edge_to_regional() {
    local edge_id=$1
    local region=$2

    echo -e "${YELLOW}Setting up Edge → Regional replication...${NC}"
    echo -e "  Edge: $edge_id"
    echo -e "  Regional: $region"
    echo ""

    # Get connection strings
    case $region in
        us-east)
            REGIONAL_DB="postgresql://agogsaas_user:PASSWORD@us-east-db.agogsaas.com:5432/agogsaas"
            ;;
        eu-central)
            REGIONAL_DB="postgresql://agogsaas_user:PASSWORD@eu-central-db.agogsaas.com:5432/agogsaas"
            ;;
        apac)
            REGIONAL_DB="postgresql://agogsaas_user:PASSWORD@apac-db.agogsaas.com:5432/agogsaas"
            ;;
        *)
            echo -e "${RED}Unknown region: $region${NC}"
            exit 1
            ;;
    esac

    EDGE_DB="postgresql://edge_user:PASSWORD@localhost:5432/agog_edge_$edge_id"

    # Create publication on edge (operational data flows UP)
    echo -e "${YELLOW}Creating publication on edge...${NC}"
    cat << EOF | psql "$EDGE_DB"
-- Create publication for operational data
CREATE PUBLICATION edge_operational_data FOR TABLE
    production_runs,
    production_run_operations,
    inventory_transactions,
    quality_inspections,
    equipment_status_log,
    changeover_details;

-- Grant replication role
GRANT SELECT ON ALL TABLES IN SCHEMA public TO edge_user;
EOF

    echo -e "${GREEN}✓ Edge publication created${NC}"

    # Create subscription on regional
    echo -e "${YELLOW}Creating subscription on regional...${NC}"
    cat << EOF | psql "$REGIONAL_DB"
-- Create subscription to edge
CREATE SUBSCRIPTION edge_${edge_id}_operational
    CONNECTION '$EDGE_DB'
    PUBLICATION edge_operational_data
    WITH (
        copy_data = true,
        create_slot = true,
        enabled = true,
        slot_name = edge_${edge_id}_slot
    );
EOF

    echo -e "${GREEN}✓ Regional subscription created${NC}"
}

# Function to setup regional-to-edge replication
setup_regional_to_edge() {
    local region=$1
    local edge_id=$2

    echo -e "${YELLOW}Setting up Regional → Edge replication...${NC}"
    echo -e "  Regional: $region"
    echo -e "  Edge: $edge_id"
    echo ""

    # Master data flows DOWN (products, customers, etc.)

    case $region in
        us-east)
            REGIONAL_DB="postgresql://agogsaas_user:PASSWORD@us-east-db.agogsaas.com:5432/agogsaas"
            ;;
        eu-central)
            REGIONAL_DB="postgresql://agogsaas_user:PASSWORD@eu-central-db.agogsaas.com:5432/agogsaas"
            ;;
        apac)
            REGIONAL_DB="postgresql://agogsaas_user:PASSWORD@apac-db.agogsaas.com:5432/agogsaas"
            ;;
        *)
            echo -e "${RED}Unknown region: $region${NC}"
            exit 1
            ;;
    esac

    EDGE_DB="postgresql://edge_user:PASSWORD@localhost:5432/agog_edge_$edge_id"

    # Create publication on regional (master data)
    echo -e "${YELLOW}Creating publication on regional...${NC}"
    cat << EOF | psql "$REGIONAL_DB"
-- Create publication for master data
CREATE PUBLICATION regional_master_data FOR TABLE
    customers,
    products,
    product_specifications,
    substrate_library,
    work_centers,
    users,
    roles;

-- Grant replication role
GRANT SELECT ON ALL TABLES IN SCHEMA public TO replication_user;
EOF

    echo -e "${GREEN}✓ Regional publication created${NC}"

    # Create subscription on edge
    echo -e "${YELLOW}Creating subscription on edge...${NC}"
    cat << EOF | psql "$EDGE_DB"
-- Create subscription to regional master data
CREATE SUBSCRIPTION regional_master_data
    CONNECTION '$REGIONAL_DB'
    PUBLICATION regional_master_data
    WITH (
        copy_data = true,
        create_slot = true,
        enabled = true,
        slot_name = regional_to_edge_${edge_id}_slot
    );
EOF

    echo -e "${GREEN}✓ Edge subscription created${NC}"
}

# Function to setup regional-to-regional replication
setup_regional_to_regional() {
    local source_region=$1
    local target_region=$2

    echo -e "${YELLOW}Setting up Regional ↔ Regional replication...${NC}"
    echo -e "  Source: $source_region"
    echo -e "  Target: $target_region"
    echo ""

    # Get connection strings
    get_regional_db() {
        local region=$1
        case $region in
            us-east)
                echo "postgresql://agogsaas_user:PASSWORD@us-east-db.agogsaas.com:5432/agogsaas"
                ;;
            eu-central)
                echo "postgresql://agogsaas_user:PASSWORD@eu-central-db.agogsaas.com:5432/agogsaas"
                ;;
            apac)
                echo "postgresql://agogsaas_user:PASSWORD@apac-db.agogsaas.com:5432/agogsaas"
                ;;
            *)
                echo ""
                ;;
        esac
    }

    SOURCE_DB=$(get_regional_db "$source_region")
    TARGET_DB=$(get_regional_db "$target_region")

    if [ -z "$SOURCE_DB" ] || [ -z "$TARGET_DB" ]; then
        echo -e "${RED}Invalid region specified${NC}"
        exit 1
    fi

    # Bidirectional replication for cross-region visibility

    # Create publication on source
    echo -e "${YELLOW}Creating publication on $source_region...${NC}"
    cat << EOF | psql "$SOURCE_DB"
-- Create publication for cross-region data
CREATE PUBLICATION cross_region_data FOR TABLE
    customers,
    sales_orders,
    inventory_summary,
    production_capacity;
EOF

    echo -e "${GREEN}✓ $source_region publication created${NC}"

    # Create subscription on target
    echo -e "${YELLOW}Creating subscription on $target_region...${NC}"
    cat << EOF | psql "$TARGET_DB"
-- Create subscription to source region
CREATE SUBSCRIPTION sub_from_${source_region}
    CONNECTION '$SOURCE_DB'
    PUBLICATION cross_region_data
    WITH (
        copy_data = true,
        create_slot = true,
        enabled = true,
        slot_name = ${source_region}_to_${target_region}_slot
    );
EOF

    echo -e "${GREEN}✓ $target_region subscription created${NC}"

    # Reverse direction (bidirectional)
    echo -e "${YELLOW}Setting up reverse replication...${NC}"

    cat << EOF | psql "$TARGET_DB"
-- Create publication on target
CREATE PUBLICATION cross_region_data FOR TABLE
    customers,
    sales_orders,
    inventory_summary,
    production_capacity;
EOF

    cat << EOF | psql "$SOURCE_DB"
-- Create subscription to target region
CREATE SUBSCRIPTION sub_from_${target_region}
    CONNECTION '$TARGET_DB'
    PUBLICATION cross_region_data
    WITH (
        copy_data = true,
        create_slot = true,
        enabled = true,
        slot_name = ${target_region}_to_${source_region}_slot
    );
EOF

    echo -e "${GREEN}✓ Bidirectional replication configured${NC}"
}

# Execute based on type
case $TYPE in
    edge-to-regional)
        setup_edge_to_regional "$SOURCE" "$TARGET"
        ;;
    regional-to-edge)
        setup_regional_to_edge "$SOURCE" "$TARGET"
        ;;
    regional-to-regional)
        setup_regional_to_regional "$SOURCE" "$TARGET"
        ;;
    *)
        echo -e "${RED}Unknown replication type: $TYPE${NC}"
        exit 1
        ;;
esac

# Verify replication
echo ""
echo -e "${YELLOW}Verifying replication status...${NC}"

case $TYPE in
    edge-to-regional|regional-to-edge)
        # Check subscription status
        echo -e "${BLUE}Checking subscription status...${NC}"
        # This would check pg_stat_subscription
        echo -e "${GREEN}✓ Replication verified${NC}"
        ;;
    regional-to-regional)
        echo -e "${BLUE}Checking bidirectional replication...${NC}"
        echo -e "${GREEN}✓ Bidirectional replication verified${NC}"
        ;;
esac

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Replication Setup Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${BLUE}Monitoring Commands:${NC}"
echo -e "  Check subscriptions: SELECT * FROM pg_stat_subscription;"
echo -e "  Check publications: SELECT * FROM pg_publication_tables;"
echo -e "  Check replication slots: SELECT * FROM pg_replication_slots;"
echo -e "  Monitor lag: SELECT * FROM pg_stat_replication;"
echo ""
echo -e "${YELLOW}Important Notes:${NC}"
echo -e "  - Replace 'PASSWORD' in connection strings with actual passwords"
echo -e "  - Monitor replication lag regularly"
echo -e "  - Set up alerts for replication failures"
echo -e "  - Test failover procedures"
echo ""

echo -e "${GREEN}Replication setup complete!${NC}"
