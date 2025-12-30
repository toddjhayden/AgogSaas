#!/bin/bash
# REQ-STRATEGIC-AUTO-1766568547079: Deployment Verification Script
# Agent: Berry (DevOps Specialist)
# Purpose: Quick verification of bin optimization deployment
# Updated: 2025-12-27

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-agogsaas}"
DB_USER="${DB_USER:-postgres}"
API_URL="${API_URL:-http://localhost:4000}"

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Bin Optimization Deployment Verification                  ║${NC}"
    echo -e "${BLUE}║  REQ-STRATEGIC-AUTO-1766568547079                          ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_database_objects() {
    echo -e "${BLUE}[CHECK]${NC} Verifying Database Objects..."

    # Check materialized view
    local matview=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_matviews WHERE matviewname = 'bin_utilization_cache';
    " 2>/dev/null | xargs)

    if [ "$matview" -eq 1 ]; then
        echo -e "  ${GREEN}✓${NC} Materialized view 'bin_utilization_cache' exists"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} Materialized view 'bin_utilization_cache' missing"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi

    # Check critical tables
    local tables=(
        "putaway_recommendations"
        "ml_model_weights"
        "aisle_congestion_metrics"
        "material_velocity_analysis"
        "capacity_validation_failures"
        "material_dimension_verifications"
        "cross_dock_cancellations"
        "bin_optimization_statistical_metrics"
        "bin_optimization_outliers"
    )

    for table in "${tables[@]}"; do
        local exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = '$table'
            );
        " 2>/dev/null | xargs)

        if [ "$exists" = "t" ]; then
            echo -e "  ${GREEN}✓${NC} Table '$table' exists"
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
        else
            echo -e "  ${YELLOW}⚠${NC} Table '$table' missing (may be optional)"
            CHECKS_WARNING=$((CHECKS_WARNING + 1))
        fi
    done

    # Check triggers
    local triggers=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM information_schema.triggers
        WHERE trigger_name IN ('trigger_lots_refresh_bin_cache', 'trigger_inventory_tx_refresh_bin_cache');
    " 2>/dev/null | xargs)

    if [ "$triggers" -eq 2 ]; then
        echo -e "  ${GREEN}✓${NC} All triggers configured ($triggers/2)"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "  ${YELLOW}⚠${NC} Expected 2 triggers, found $triggers"
        CHECKS_WARNING=$((CHECKS_WARNING + 1))
    fi

    # Check functions
    local function_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM pg_proc WHERE proname = 'scheduled_refresh_bin_utilization';
    " 2>/dev/null | xargs)

    if [ "$function_exists" -eq 1 ]; then
        echo -e "  ${GREEN}✓${NC} Cache refresh function exists"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} Cache refresh function missing"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi

    echo ""
}

check_cache_status() {
    echo -e "${BLUE}[CHECK]${NC} Verifying Cache Status..."

    # Check cache data
    local cache_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM bin_utilization_cache;
    " 2>/dev/null | xargs)

    if [ "$cache_count" -gt 0 ]; then
        echo -e "  ${GREEN}✓${NC} Cache contains $cache_count entries"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))

        # Check cache age
        local cache_age=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_updated)))/60, 1)
            FROM bin_utilization_cache;
        " 2>/dev/null | xargs)

        if (( $(echo "$cache_age < 15" | bc -l) )); then
            echo -e "  ${GREEN}✓${NC} Cache is fresh (${cache_age} minutes old)"
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
        else
            echo -e "  ${YELLOW}⚠${NC} Cache age: ${cache_age} minutes (consider refresh)"
            CHECKS_WARNING=$((CHECKS_WARNING + 1))
        fi
    else
        echo -e "  ${YELLOW}⚠${NC} Cache is empty (run initial refresh)"
        CHECKS_WARNING=$((CHECKS_WARNING + 1))
    fi

    echo ""
}

check_graphql_schema() {
    echo -e "${BLUE}[CHECK]${NC} Verifying GraphQL Schemas..."

    local schema_files=(
        "src/graphql/schema/wms.graphql"
        "src/graphql/schema/wms-optimization.graphql"
        "src/graphql/schema/wms-data-quality.graphql"
    )

    for schema_file in "${schema_files[@]}"; do
        if [ -f "$schema_file" ]; then
            echo -e "  ${GREEN}✓${NC} Schema file exists: $schema_file"
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
        else
            echo -e "  ${RED}✗${NC} Schema file missing: $schema_file"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
        fi
    done

    echo ""
}

check_services() {
    echo -e "${BLUE}[CHECK]${NC} Verifying Backend Services..."

    local services=(
        "src/modules/wms/services/bin-utilization-optimization.service.ts"
        "src/modules/wms/services/bin-utilization-optimization-enhanced.service.ts"
        "src/modules/wms/services/bin-optimization-health.service.ts"
        "src/modules/wms/services/bin-optimization-health-enhanced.service.ts"
        "src/modules/wms/services/bin-optimization-data-quality.service.ts"
        "src/modules/wms/services/bin-utilization-statistical-analysis.service.ts"
        "src/modules/wms/services/bin-fragmentation-monitoring.service.ts"
    )

    for service_file in "${services[@]}"; do
        if [ -f "$service_file" ]; then
            echo -e "  ${GREEN}✓${NC} Service exists: $(basename $service_file)"
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
        else
            echo -e "  ${RED}✗${NC} Service missing: $(basename $service_file)"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
        fi
    done

    echo ""
}

check_frontend_components() {
    echo -e "${BLUE}[CHECK]${NC} Verifying Frontend Components..."

    local frontend_files=(
        "../frontend/src/pages/BinUtilizationDashboard.tsx"
        "../frontend/src/pages/BinUtilizationEnhancedDashboard.tsx"
        "../frontend/src/pages/BinOptimizationHealthDashboard.tsx"
        "../frontend/src/graphql/queries/binUtilization.ts"
        "../frontend/src/graphql/queries/binUtilizationHealth.ts"
    )

    for frontend_file in "${frontend_files[@]}"; do
        if [ -f "$frontend_file" ]; then
            echo -e "  ${GREEN}✓${NC} Frontend component exists: $(basename $frontend_file)"
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
        else
            echo -e "  ${RED}✗${NC} Frontend component missing: $(basename $frontend_file)"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
        fi
    done

    echo ""
}

check_docker_infrastructure() {
    echo -e "${BLUE}[CHECK]${NC} Verifying Docker Infrastructure..."

    if [ -f "../docker-compose.app.yml" ]; then
        echo -e "  ${GREEN}✓${NC} docker-compose.app.yml exists"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} docker-compose.app.yml missing"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi

    if [ -f "Dockerfile" ]; then
        echo -e "  ${GREEN}✓${NC} Backend Dockerfile exists"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} Backend Dockerfile missing"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi

    if [ -f "../frontend/Dockerfile" ]; then
        echo -e "  ${GREEN}✓${NC} Frontend Dockerfile exists"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} Frontend Dockerfile missing"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi

    echo ""
}

check_deployment_scripts() {
    echo -e "${BLUE}[CHECK]${NC} Verifying Deployment Scripts..."

    local scripts=(
        "scripts/deploy-bin-optimization.sh"
        "scripts/health-check.sh"
        "scripts/monitor-bin-optimization.sh"
        "scripts/test-bin-optimization-health.ts"
    )

    for script in "${scripts[@]}"; do
        if [ -f "$script" ]; then
            echo -e "  ${GREEN}✓${NC} Script exists: $(basename $script)"
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
        else
            echo -e "  ${YELLOW}⚠${NC} Script missing: $(basename $script)"
            CHECKS_WARNING=$((CHECKS_WARNING + 1))
        fi
    done

    echo ""
}

check_migrations() {
    echo -e "${BLUE}[CHECK]${NC} Verifying Database Migrations..."

    local migrations=(
        "V0.0.15__add_bin_utilization_tracking.sql"
        "V0.0.16__optimize_bin_utilization_algorithm.sql"
        "V0.0.18__add_bin_optimization_triggers.sql"
        "V0.0.20__fix_bin_optimization_data_quality.sql"
        "V0.0.21__fix_uuid_generate_v7_casting.sql"
        "V0.0.22__bin_utilization_statistical_analysis.sql"
        "V0.0.23__fix_bin_utilization_refresh_performance.sql"
        "V0.0.24__add_bin_optimization_indexes.sql"
        "V0.0.28__add_bin_fragmentation_monitoring.sql"
        "V0.0.29__add_3d_vertical_proximity_optimization.sql"
    )

    for migration in "${migrations[@]}"; do
        if [ -f "migrations/$migration" ]; then
            echo -e "  ${GREEN}✓${NC} Migration exists: $migration"
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
        else
            echo -e "  ${RED}✗${NC} Migration missing: $migration"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
        fi
    done

    echo ""
}

print_summary() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  VERIFICATION SUMMARY                                      ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${GREEN}✓ Passed:${NC} $CHECKS_PASSED"
    echo -e "  ${YELLOW}⚠ Warnings:${NC} $CHECKS_WARNING"
    echo -e "  ${RED}✗ Failed:${NC} $CHECKS_FAILED"
    echo ""

    if [ $CHECKS_FAILED -eq 0 ]; then
        echo -e "${GREEN}Deployment verification: PASSED${NC}"
        echo -e "System is ready for production deployment."
        echo ""
        echo "Next steps:"
        echo "  1. Review warnings and address if necessary"
        echo "  2. Run: ./scripts/deploy-bin-optimization.sh"
        echo "  3. Monitor: ./scripts/monitor-bin-optimization.sh"
        echo "  4. Health check: ./scripts/health-check.sh"
        echo ""
        exit 0
    else
        echo -e "${RED}Deployment verification: FAILED${NC}"
        echo -e "Please resolve the failed checks before deploying."
        echo ""
        exit 1
    fi
}

# Main execution
main() {
    print_header

    # Navigate to backend directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
    cd "$BACKEND_DIR"

    check_database_objects
    check_cache_status
    check_graphql_schema
    check_services
    check_frontend_components
    check_docker_infrastructure
    check_deployment_scripts
    check_migrations

    print_summary
}

main "$@"
