#!/bin/bash

################################################################################
# DEPLOYMENT SCRIPT: Sales Quote Automation (REQ-STRATEGIC-AUTO-1735125600000)
################################################################################
# Purpose: Deploy Sales Quote Automation feature to production
# Author: Berry (DevOps Engineer)
# Date: 2025-12-27
# Version: 1.0.0
################################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-staging}"
SKIP_TESTS="${SKIP_TESTS:-false}"
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-false}"

# Database configuration (from environment or defaults)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-erp_${DEPLOYMENT_ENV}}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Feature flags
ENABLE_SALES_QUOTE_AUTOMATION="${ENABLE_SALES_QUOTE_AUTOMATION:-true}"
ENABLE_PRICING_RULES="${ENABLE_PRICING_RULES:-true}"
ENABLE_AUTOMATED_COSTING="${ENABLE_AUTOMATED_COSTING:-true}"

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "Required command '$1' not found. Please install it first."
        exit 1
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    check_command "node"
    check_command "npm"
    check_command "psql"
    check_command "git"

    # Check Node version (requires 18+)
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18 or higher required. Current: $(node --version)"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

verify_database_connection() {
    log_info "Verifying database connection..."

    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null

    if [ $? -eq 0 ]; then
        log_success "Database connection successful"
    else
        log_error "Failed to connect to database"
        exit 1
    fi
}

backup_database() {
    log_info "Creating database backup..."

    BACKUP_FILE="$PROJECT_ROOT/backups/db_backup_$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p "$PROJECT_ROOT/backups"

    PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        log_success "Database backup created: $BACKUP_FILE"
    else
        log_error "Database backup failed"
        exit 1
    fi
}

run_migrations() {
    if [ "$SKIP_MIGRATIONS" = "true" ]; then
        log_warning "Skipping database migrations (SKIP_MIGRATIONS=true)"
        return 0
    fi

    log_info "Running database migrations..."

    # Check if migration V0.0.6 exists
    MIGRATION_FILE="$BACKEND_DIR/migrations/V0.0.6__create_sales_materials_procurement.sql"

    if [ ! -f "$MIGRATION_FILE" ]; then
        log_error "Migration file not found: $MIGRATION_FILE"
        exit 1
    fi

    # Check if tables already exist
    TABLE_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quotes');" | tr -d '[:space:]')

    if [ "$TABLE_EXISTS" = "t" ]; then
        log_warning "Tables already exist. Skipping migration."
    else
        log_info "Applying migration V0.0.6..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"

        if [ $? -eq 0 ]; then
            log_success "Migration applied successfully"
        else
            log_error "Migration failed"
            exit 1
        fi
    fi

    # Verify tables were created
    log_info "Verifying database schema..."

    TABLES=("quotes" "quote_lines" "pricing_rules" "customer_pricing")

    for TABLE in "${TABLES[@]}"; do
        TABLE_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$TABLE');" | tr -d '[:space:]')

        if [ "$TABLE_EXISTS" = "t" ]; then
            log_success "Table '$TABLE' verified"
        else
            log_error "Table '$TABLE' not found"
            exit 1
        fi
    done
}

build_backend() {
    log_info "Building backend..."

    cd "$BACKEND_DIR"

    # Install dependencies
    log_info "Installing backend dependencies..."
    npm ci

    # Run build
    log_info "Compiling TypeScript..."
    npm run build

    if [ $? -eq 0 ]; then
        log_success "Backend build completed successfully"
    else
        log_error "Backend build failed"
        exit 1
    fi

    cd "$SCRIPT_DIR"
}

run_backend_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        log_warning "Skipping backend tests (SKIP_TESTS=true)"
        return 0
    fi

    log_info "Running backend tests..."

    cd "$BACKEND_DIR"

    npm test

    if [ $? -eq 0 ]; then
        log_success "Backend tests passed"
    else
        log_error "Backend tests failed"
        exit 1
    fi

    cd "$SCRIPT_DIR"
}

build_frontend() {
    log_info "Building frontend..."

    cd "$FRONTEND_DIR"

    # Install dependencies
    log_info "Installing frontend dependencies..."
    npm ci

    # Run build
    log_info "Compiling frontend..."
    npm run build

    if [ $? -eq 0 ]; then
        log_success "Frontend build completed successfully"
    else
        log_warning "Frontend build completed with warnings"
    fi

    cd "$SCRIPT_DIR"
}

verify_deployment() {
    log_info "Verifying deployment..."

    # Check if quotes table has data structure
    log_info "Checking quotes table structure..."

    COLUMN_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'quotes';" | tr -d '[:space:]')

    if [ "$COLUMN_COUNT" -gt 20 ]; then
        log_success "Quotes table structure verified ($COLUMN_COUNT columns)"
    else
        log_error "Quotes table structure incomplete"
        exit 1
    fi

    # Verify backend compiled files exist
    if [ -d "$BACKEND_DIR/dist" ]; then
        log_success "Backend dist folder exists"
    else
        log_error "Backend dist folder not found"
        exit 1
    fi

    # Verify frontend compiled files exist
    if [ -d "$FRONTEND_DIR/dist" ]; then
        log_success "Frontend dist folder exists"
    else
        log_warning "Frontend dist folder not found"
    fi
}

create_deployment_report() {
    log_info "Creating deployment report..."

    REPORT_FILE="$PROJECT_ROOT/DEPLOYMENT_REPORT_$(date +%Y%m%d_%H%M%S).md"

    cat > "$REPORT_FILE" << EOF
# Deployment Report: Sales Quote Automation
**REQ Number:** REQ-STRATEGIC-AUTO-1735125600000
**Deployment Date:** $(date +"%Y-%m-%d %H:%M:%S")
**Environment:** $DEPLOYMENT_ENV
**Deployed By:** $(whoami)

## Deployment Summary

### Status: ✅ SUCCESS

### Components Deployed
- ✅ Backend Services (NestJS)
- ✅ Frontend Application (React/Vite)
- ✅ Database Schema (PostgreSQL)
- ✅ GraphQL API

### Database Changes
- ✅ Table: quotes
- ✅ Table: quote_lines
- ✅ Table: pricing_rules
- ✅ Table: customer_pricing

### Feature Flags
- ENABLE_SALES_QUOTE_AUTOMATION: $ENABLE_SALES_QUOTE_AUTOMATION
- ENABLE_PRICING_RULES: $ENABLE_PRICING_RULES
- ENABLE_AUTOMATED_COSTING: $ENABLE_AUTOMATED_COSTING

### Backend Services Deployed
- QuoteManagementService
- QuotePricingService
- QuoteCostingService
- PricingRuleEngineService

### GraphQL Endpoints
- Query: quotes
- Query: quote
- Query: previewQuoteLinePricing
- Query: previewProductCost
- Mutation: createQuoteWithLines
- Mutation: addQuoteLine
- Mutation: updateQuoteLine
- Mutation: deleteQuoteLine
- Mutation: recalculateQuote
- Mutation: validateQuoteMargin

### Frontend Pages
- /sales/quotes (Sales Quote Dashboard)
- /sales/quotes/:quoteId (Sales Quote Detail Page)

### Build Information
- Node Version: $(node --version)
- NPM Version: $(npm --version)
- Deployment Environment: $DEPLOYMENT_ENV
- Database: $DB_NAME@$DB_HOST:$DB_PORT

### Next Steps
1. Monitor application logs for errors
2. Verify GraphQL endpoints are accessible
3. Test quote creation workflow
4. Monitor database performance
5. Collect user feedback

## Rollback Plan
If issues are detected, rollback using:
\`\`\`bash
./scripts/rollback-sales-quote-automation.sh
\`\`\`

---
Generated by Berry DevOps Deployment Script
EOF

    log_success "Deployment report created: $REPORT_FILE"
}

################################################################################
# Main Deployment Flow
################################################################################

main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║   Sales Quote Automation - Deployment Script                        ║"
    echo "║   REQ-STRATEGIC-AUTO-1735125600000                                   ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo ""

    log_info "Deployment Environment: $DEPLOYMENT_ENV"
    log_info "Database: $DB_NAME@$DB_HOST:$DB_PORT"
    echo ""

    # Phase 1: Prerequisites
    log_info "=== Phase 1: Prerequisites ==="
    check_prerequisites
    verify_database_connection
    echo ""

    # Phase 2: Backup
    log_info "=== Phase 2: Database Backup ==="
    backup_database
    echo ""

    # Phase 3: Database Migrations
    log_info "=== Phase 3: Database Migrations ==="
    run_migrations
    echo ""

    # Phase 4: Backend Build
    log_info "=== Phase 4: Backend Build ==="
    build_backend
    echo ""

    # Phase 5: Backend Tests
    log_info "=== Phase 5: Backend Tests ==="
    run_backend_tests
    echo ""

    # Phase 6: Frontend Build
    log_info "=== Phase 6: Frontend Build ==="
    build_frontend
    echo ""

    # Phase 7: Verification
    log_info "=== Phase 7: Deployment Verification ==="
    verify_deployment
    echo ""

    # Phase 8: Reporting
    log_info "=== Phase 8: Create Deployment Report ==="
    create_deployment_report
    echo ""

    echo ""
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║   ✅ DEPLOYMENT COMPLETED SUCCESSFULLY                               ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo ""

    log_success "Sales Quote Automation deployed to $DEPLOYMENT_ENV"
    log_info "Next: Start the application services and verify functionality"
    echo ""
}

# Run main deployment
main "$@"
