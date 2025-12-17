#!/bin/bash

# =====================================================
# Generate Flyway Migrations from Schema Files
# =====================================================
# Purpose: Convert Roy's schema files into numbered Flyway migrations
# Usage: ./generate-migrations.sh
# =====================================================

SCHEMA_DIR="Implementation/print-industry-erp/backend/database/schemas"
MIGRATION_DIR="Implementation/print-industry-erp/backend/migrations"

echo "🔨 Generating Flyway migrations from schema files..."
echo ""

# Migration version counter (start at V1.0.3, since V1.0.0, V1.0.1, V1.0.2 exist)
VERSION_MAJOR=1
VERSION_MINOR=0
VERSION_PATCH=3

# Function to create migration file
create_migration() {
    local schema_file=$1
    local migration_name=$2
    local description=$3

    local version="V${VERSION_MAJOR}.${VERSION_MINOR}.${VERSION_PATCH}"
    local migration_file="${MIGRATION_DIR}/${version}__${migration_name}.sql"

    echo "📄 Creating ${version}__${migration_name}.sql"

    # Copy schema file to migration with header
    cat > "$migration_file" << EOF
-- =====================================================
-- FLYWAY MIGRATION ${version}
-- =====================================================
-- Purpose: ${description}
-- Source: ${schema_file}
-- Created: $(date +%Y-%m-%d)
-- =====================================================

EOF

    # Append schema content (remove the header comments from original)
    sed '1,/-- =====/d' "$SCHEMA_DIR/$schema_file" >> "$migration_file"

    # Increment patch version
    VERSION_PATCH=$((VERSION_PATCH + 1))
}

# =====================================================
# Create migrations in dependency order (per MASTER_TABLE_INDEX)
# =====================================================

# V1.0.3: Operations Module
create_migration "operations-module.sql" \
    "create_operations_module" \
    "Production orders, runs, work centers, OEE tracking (11 tables)"

# V1.0.4: WMS Module
create_migration "wms-module.sql" \
    "create_wms_module" \
    "Warehouse management, inventory, wave processing (13 tables)"

# V1.0.5: Finance Module
create_migration "finance-module.sql" \
    "create_finance_module" \
    "GL, AR, AP, multi-currency, multi-entity (10 tables)"

# V1.0.6: Sales, Materials, Procurement Module
create_migration "sales-materials-procurement-module.sql" \
    "create_sales_materials_procurement" \
    "Sales, materials, BOM, procurement (17 tables)"

# V1.0.7: Quality, HR, IoT, Security, Marketplace, Imposition Module
create_migration "quality-hr-iot-security-marketplace-imposition-module.sql" \
    "create_quality_hr_iot_security_marketplace_imposition" \
    "Quality, HR, IoT, Security, Marketplace, Imposition (30 tables)"

echo ""
echo "✅ Migration generation complete!"
echo ""
echo "📊 Summary:"
echo "   - 5 new migrations created (V1.0.3 through V1.0.7)"
echo "   - Total: 81 tables (across all migrations)"
echo "   - Location: ${MIGRATION_DIR}/"
echo ""
echo "🚀 To apply migrations:"
echo "   docker exec agogsaas-backend npm run migration:run"
echo ""
