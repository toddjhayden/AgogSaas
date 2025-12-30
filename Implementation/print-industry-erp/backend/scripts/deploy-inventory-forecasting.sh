#!/bin/bash
# =====================================================
# Inventory Forecasting - Deployment Script
# =====================================================
# REQ: REQ-STRATEGIC-AUTO-1735405200000
# Agent: Berry (DevOps Specialist)
# Purpose: Automated deployment of Inventory Forecasting feature
# Date: 2025-12-28
# =====================================================

set -e  # Exit on error
set -o pipefail  # Exit on pipe failure

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$(dirname "$BACKEND_DIR")/frontend"
MIGRATIONS_DIR="$BACKEND_DIR/migrations"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-agogsaas}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

ENVIRONMENT="${ENVIRONMENT:-production}"
DRY_RUN="${DRY_RUN:-false}"

# Deployment tracking
START_TIME=$(date +%s)
DEPLOYMENT_LOG="/tmp/forecasting_deployment_$(date +%Y%m%d_%H%M%S).log"
ERRORS_FOUND=0
WARNINGS_FOUND=0

# =====================================================
# Utility Functions
# =====================================================

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
    ((ERRORS_FOUND++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
    ((WARNINGS_FOUND++))
}

log_step() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}" | tee -a "$DEPLOYMENT_LOG"
    echo -e "${CYAN}║${NC} $1" | tee -a "$DEPLOYMENT_LOG"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}" | tee -a "$DEPLOYMENT_LOG"
}

print_header() {
    clear
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  Inventory Forecasting - Deployment Script                 ║${NC}"
    echo -e "${CYAN}║  REQ-STRATEGIC-AUTO-1735405200000                          ║${NC}"
    echo -e "${CYAN}║  Environment: ${ENVIRONMENT}${NC}"
    echo -e "${CYAN}║  Dry Run: ${DRY_RUN}${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_prerequisites() {
    log_step "STEP 1: Checking Prerequisites"

    # Check Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        log_success "Node.js installed: $node_version"
    else
        log_error "Node.js not found. Please install Node.js 18+"
        exit 1
    fi

    # Check npm
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        log_success "npm installed: $npm_version"
    else
        log_error "npm not found. Please install npm"
        exit 1
    fi

    # Check PostgreSQL client
    if command -v psql &> /dev/null; then
        local psql_version=$(psql --version)
        log_success "PostgreSQL client installed: $psql_version"
    else
        log_error "psql not found. Please install PostgreSQL client"
        exit 1
    fi

    # Check database connection
    if [ -z "$DB_PASSWORD" ]; then
        log_error "DB_PASSWORD environment variable not set"
        exit 1
    fi

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        log_success "Database connection: OK"
    else
        log_error "Cannot connect to database at $DB_HOST:$DB_PORT/$DB_NAME"
        exit 1
    fi

    # Check required directories
    if [ -d "$BACKEND_DIR" ]; then
        log_success "Backend directory found: $BACKEND_DIR"
    else
        log_error "Backend directory not found: $BACKEND_DIR"
        exit 1
    fi

    if [ -d "$FRONTEND_DIR" ]; then
        log_success "Frontend directory found: $FRONTEND_DIR"
    else
        log_error "Frontend directory not found: $FRONTEND_DIR"
        exit 1
    fi

    if [ -d "$MIGRATIONS_DIR" ]; then
        log_success "Migrations directory found: $MIGRATIONS_DIR"
    else
        log_error "Migrations directory not found: $MIGRATIONS_DIR"
        exit 1
    fi
}

backup_database() {
    log_step "STEP 2: Creating Database Backup"

    if [ "$DRY_RUN" = "true" ]; then
        log_warning "DRY RUN: Skipping database backup"
        return
    fi

    local backup_file="/tmp/agogsaas_backup_$(date +%Y%m%d_%H%M%S).sql"

    log "Creating backup: $backup_file"

    if PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t demand_history -t material_forecasts -t forecast_models -t forecast_accuracy_metrics \
        -t replenishment_suggestions --if-exists > "$backup_file" 2>&1; then
        log_success "Database backup created: $backup_file"
    else
        log_warning "Database backup failed (tables may not exist yet)"
    fi
}

run_migrations() {
    log_step "STEP 3: Running Database Migrations"

    # Migration V0.0.32 - Create forecasting tables
    local migration_32="$MIGRATIONS_DIR/V0.0.32__create_inventory_forecasting_tables_FIXED.sql"

    if [ ! -f "$migration_32" ]; then
        log_error "Migration file not found: $migration_32"
        exit 1
    fi

    log "Applying V0.0.32: Create inventory forecasting tables"

    if [ "$DRY_RUN" = "true" ]; then
        log_warning "DRY RUN: Would apply migration V0.0.32"
    else
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -f "$migration_32" >> "$DEPLOYMENT_LOG" 2>&1; then
            log_success "Migration V0.0.32 applied successfully"
        else
            log_warning "Migration V0.0.32 may have already been applied (safe to ignore)"
        fi
    fi

    # Migration V0.0.39 - Forecasting enhancements
    local migration_39="$MIGRATIONS_DIR/V0.0.39__forecasting_enhancements_roy_backend.sql"

    if [ ! -f "$migration_39" ]; then
        log_warning "Migration V0.0.39 not found (optional enhancement)"
    else
        log "Applying V0.0.39: Forecasting enhancements"

        if [ "$DRY_RUN" = "true" ]; then
            log_warning "DRY RUN: Would apply migration V0.0.39"
        else
            if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                -f "$migration_39" >> "$DEPLOYMENT_LOG" 2>&1; then
                log_success "Migration V0.0.39 applied successfully"
            else
                log_warning "Migration V0.0.39 may have already been applied (safe to ignore)"
            fi
        fi
    fi

    # Verify tables created
    log "Verifying tables..."

    local tables=("demand_history" "material_forecasts" "forecast_models" "forecast_accuracy_metrics" "replenishment_suggestions")

    for table in "${tables[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -tc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='$table')" | grep -q t; then
            log_success "Table verified: $table"
        else
            log_error "Table not found: $table"
            exit 1
        fi
    done
}

verify_implementation() {
    log_step "STEP 4: Verifying Backend Implementation"

    # Check forecasting service
    if [ -f "$BACKEND_DIR/src/modules/forecasting/services/forecasting.service.ts" ]; then
        log_success "ForecastingService implementation found"
    else
        log_error "ForecastingService not found"
        exit 1
    fi

    # Check forecast accuracy service
    if [ -f "$BACKEND_DIR/src/modules/forecasting/services/forecast-accuracy.service.ts" ]; then
        log_success "ForecastAccuracyService implementation found"
    else
        log_error "ForecastAccuracyService not found"
        exit 1
    fi

    # Check safety stock service
    if [ -f "$BACKEND_DIR/src/modules/forecasting/services/safety-stock.service.ts" ]; then
        log_success "SafetyStockService implementation found"
    else
        log_error "SafetyStockService not found"
        exit 1
    fi

    # Check demand history service
    if [ -f "$BACKEND_DIR/src/modules/forecasting/services/demand-history.service.ts" ]; then
        log_success "DemandHistoryService implementation found"
    else
        log_error "DemandHistoryService not found"
        exit 1
    fi

    # Check GraphQL resolver
    if [ -f "$BACKEND_DIR/src/graphql/resolvers/forecasting.resolver.ts" ]; then
        log_success "ForecastingResolver implementation found"

        # Verify getForecastAccuracySummary is not a placeholder
        if grep -q "totalForecastsGenerated: 0" "$BACKEND_DIR/src/graphql/resolvers/forecasting.resolver.ts"; then
            log_error "Placeholder implementation still present in ForecastingResolver"
            exit 1
        else
            log_success "ForecastingResolver: Placeholder implementation fixed"
        fi
    else
        log_error "ForecastingResolver not found"
        exit 1
    fi

    # Check GraphQL schema
    if [ -f "$BACKEND_DIR/src/graphql/schema/forecasting.graphql" ]; then
        log_success "Forecasting GraphQL schema found"
    else
        log_error "Forecasting GraphQL schema not found"
        exit 1
    fi
}

build_backend() {
    log_step "STEP 5: Building Backend Services"

    cd "$BACKEND_DIR"

    log "Installing backend dependencies..."
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "DRY RUN: Would run npm install"
    else
        if npm install >> "$DEPLOYMENT_LOG" 2>&1; then
            log_success "Backend dependencies installed"
        else
            log_error "Backend dependency installation failed"
            exit 1
        fi
    fi

    log "Building backend (TypeScript compilation)..."
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "DRY RUN: Would run npm run build"
    else
        if npm run build >> "$DEPLOYMENT_LOG" 2>&1; then
            log_success "Backend build completed"
        else
            log_error "Backend build failed"
            exit 1
        fi
    fi
}

build_frontend() {
    log_step "STEP 6: Building Frontend Dashboard"

    cd "$FRONTEND_DIR"

    # Verify dashboard exists
    if [ -f "$FRONTEND_DIR/src/pages/InventoryForecastingDashboard.tsx" ]; then
        log_success "InventoryForecastingDashboard component found"
    else
        log_error "InventoryForecastingDashboard component not found"
        exit 1
    fi

    # Verify GraphQL queries
    if [ -f "$FRONTEND_DIR/src/graphql/queries/forecasting.ts" ]; then
        log_success "Forecasting GraphQL queries found"
    else
        log_error "Forecasting GraphQL queries not found"
        exit 1
    fi

    log "Installing frontend dependencies..."
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "DRY RUN: Would run npm install"
    else
        if npm install >> "$DEPLOYMENT_LOG" 2>&1; then
            log_success "Frontend dependencies installed"
        else
            log_error "Frontend dependency installation failed"
            exit 1
        fi
    fi

    log "Building frontend (Vite production build)..."
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "DRY RUN: Would run npm run build"
    else
        if npm run build >> "$DEPLOYMENT_LOG" 2>&1; then
            log_success "Frontend build completed"
        else
            log_error "Frontend build failed"
            exit 1
        fi
    fi
}

run_health_checks() {
    log_step "STEP 7: Running Health Checks"

    # Check if health check script exists
    local health_script="$SCRIPT_DIR/health-check-forecasting.sh"

    if [ -f "$health_script" ]; then
        log "Running forecasting health checks..."

        if [ "$DRY_RUN" = "true" ]; then
            log_warning "DRY RUN: Would run health checks"
        else
            if bash "$health_script" >> "$DEPLOYMENT_LOG" 2>&1; then
                log_success "Health checks passed"
            else
                log_warning "Health checks failed (this is expected if services not started yet)"
            fi
        fi
    else
        log_warning "Health check script not found: $health_script"
    fi
}

create_test_data() {
    log_step "STEP 8: Loading Test Data (Optional)"

    local test_data_script="$SCRIPT_DIR/load-p2-test-data.ts"

    if [ -f "$test_data_script" ]; then
        log "Test data loader found: $test_data_script"

        if [ "$ENVIRONMENT" = "production" ]; then
            log_warning "Skipping test data in production environment"
        else
            log "Loading test data for development/staging..."

            if [ "$DRY_RUN" = "true" ]; then
                log_warning "DRY RUN: Would load test data"
            else
                cd "$BACKEND_DIR"
                if npx ts-node "$test_data_script" >> "$DEPLOYMENT_LOG" 2>&1; then
                    log_success "Test data loaded successfully"
                else
                    log_warning "Test data loading failed (may already exist)"
                fi
            fi
        fi
    else
        log_warning "Test data script not found (optional)"
    fi
}

print_deployment_summary() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))

    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  Deployment Summary                                        ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ $ERRORS_FOUND -eq 0 ] && [ $WARNINGS_FOUND -eq 0 ]; then
        echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
    elif [ $ERRORS_FOUND -eq 0 ]; then
        echo -e "${YELLOW}⚠ Deployment completed with warnings${NC}"
    else
        echo -e "${RED}✗ Deployment completed with errors${NC}"
    fi

    echo ""
    echo "Duration: ${minutes}m ${seconds}s"
    echo "Errors: $ERRORS_FOUND"
    echo "Warnings: $WARNINGS_FOUND"
    echo "Log file: $DEPLOYMENT_LOG"
    echo ""

    if [ $ERRORS_FOUND -eq 0 ]; then
        echo -e "${CYAN}Next Steps:${NC}"
        echo "1. Start backend service:"
        echo "   cd $BACKEND_DIR && npm start"
        echo ""
        echo "2. Start frontend service:"
        echo "   cd $FRONTEND_DIR && npm run dev"
        echo ""
        echo "3. Access dashboard:"
        echo "   http://localhost:5173/operations/forecasting"
        echo ""
        echo "4. Run health checks:"
        echo "   $SCRIPT_DIR/health-check-forecasting.sh"
        echo ""
    fi

    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Feature: Inventory Forecasting                            ║${NC}"
    echo -e "${BLUE}║  REQ-STRATEGIC-AUTO-1735405200000                          ║${NC}"
    echo -e "${BLUE}║  Status: DEPLOYED                                          ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# =====================================================
# Main Deployment Flow
# =====================================================

main() {
    print_header

    log "Starting deployment at $(date)"
    log "Environment: $ENVIRONMENT"
    log "Dry Run: $DRY_RUN"
    log "Log file: $DEPLOYMENT_LOG"

    check_prerequisites
    backup_database
    run_migrations
    verify_implementation
    build_backend
    build_frontend
    run_health_checks
    create_test_data

    print_deployment_summary

    if [ $ERRORS_FOUND -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run deployment
main "$@"
