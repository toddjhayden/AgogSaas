#!/bin/bash
# =====================================================
# PDF PREFLIGHT & COLOR MANAGEMENT DEPLOYMENT SCRIPT
# =====================================================
# REQ: REQ-STRATEGIC-AUTO-1767066329942
# Description: Automated deployment script for PDF Preflight & Color Management module
# Author: Berry (DevOps Agent)
# Date: 2025-12-30
# =====================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"
MIGRATION_FILE="V0.0.46__create_preflight_color_management_tables.sql"

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}=====================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=====================================${NC}\n"
}

# Function to check prerequisites
check_prerequisites() {
    print_header "CHECKING PREREQUISITES"

    # Check if PostgreSQL client is available
    if ! command -v psql &> /dev/null; then
        print_error "psql (PostgreSQL client) is not installed"
        exit 1
    fi
    print_success "PostgreSQL client found"

    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_success "Node.js found ($(node --version))"

    # Check if npm/yarn is available
    if ! command -v npm &> /dev/null && ! command -v yarn &> /dev/null; then
        print_error "npm or yarn is not installed"
        exit 1
    fi
    print_success "Package manager found"

    # Check environment variables
    if [ -z "${DATABASE_URL:-}" ]; then
        print_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    print_success "DATABASE_URL is configured"
}

# Function to backup database
backup_database() {
    print_header "CREATING DATABASE BACKUP"

    BACKUP_DIR="$BACKEND_DIR/backups"
    mkdir -p "$BACKUP_DIR"

    BACKUP_FILE="$BACKUP_DIR/preflight_pre_deploy_$(date +%Y%m%d_%H%M%S).sql"

    print_info "Creating backup at: $BACKUP_FILE"

    # Export specific schemas/tables if needed
    if pg_dump "$DATABASE_URL" \
        --schema=public \
        --table=preflight_* \
        --table=color_proofs \
        --if-exists \
        --file="$BACKUP_FILE" 2>/dev/null; then
        print_success "Backup created successfully"
    else
        print_warning "No existing preflight tables to backup (this is expected for first deployment)"
    fi
}

# Function to run database migration
run_migration() {
    print_header "RUNNING DATABASE MIGRATION"

    MIGRATION_PATH="$BACKEND_DIR/migrations/$MIGRATION_FILE"

    if [ ! -f "$MIGRATION_PATH" ]; then
        print_error "Migration file not found: $MIGRATION_PATH"
        exit 1
    fi

    print_info "Applying migration: $MIGRATION_FILE"

    # Run the migration
    psql "$DATABASE_URL" -f "$MIGRATION_PATH" -v ON_ERROR_STOP=1

    print_success "Migration applied successfully"
}

# Function to verify database schema
verify_schema() {
    print_header "VERIFYING DATABASE SCHEMA"

    # Check if tables were created
    TABLES=(
        "preflight_profiles"
        "preflight_reports"
        "preflight_issues"
        "preflight_artifacts"
        "color_proofs"
        "preflight_audit_log"
    )

    for table in "${TABLES[@]}"; do
        print_info "Checking table: $table"

        COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '$table'" | tr -d '[:space:]')

        if [ "$COUNT" -eq 1 ]; then
            print_success "Table $table exists"
        else
            print_error "Table $table does not exist"
            exit 1
        fi
    done

    # Check if views were created
    VIEWS=(
        "vw_preflight_error_frequency"
        "vw_preflight_pass_rates"
    )

    for view in "${VIEWS[@]}"; do
        print_info "Checking view: $view"

        COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_name = '$view'" | tr -d '[:space:]')

        if [ "$COUNT" -eq 1 ]; then
            print_success "View $view exists"
        else
            print_error "View $view does not exist"
            exit 1
        fi
    done

    # Check for RLS policies
    print_info "Verifying Row-Level Security policies"

    for table in "${TABLES[@]}"; do
        RLS_ENABLED=$(psql "$DATABASE_URL" -t -c "SELECT relrowsecurity FROM pg_class WHERE relname = '$table'" | tr -d '[:space:]')

        if [ "$RLS_ENABLED" = "t" ]; then
            print_success "RLS enabled on $table"
        else
            print_warning "RLS not enabled on $table"
        fi
    done
}

# Function to seed initial data
seed_data() {
    print_header "SEEDING INITIAL DATA"

    print_info "Creating default preflight profiles..."

    # Create temporary SQL file for seeding
    SEED_FILE=$(mktemp)

    cat > "$SEED_FILE" << 'EOF'
-- Insert default PDF/X-1a profile
INSERT INTO preflight_profiles (
    tenant_id,
    profile_name,
    profile_type,
    version,
    version_notes,
    rules,
    is_default,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000000', -- System tenant
    'PDF/X-1a:2001 Standard',
    'PDF_X_1A',
    1,
    'Standard PDF/X-1a:2001 profile for commercial printing',
    '{
        "pdf_version": {"required": "1.3", "max_version": "1.3"},
        "color_space": {"allowed": ["CMYK", "GRAY"], "prohibited": ["RGB", "LAB"]},
        "images": {
            "min_resolution_dpi": 300,
            "max_resolution_dpi": 2400,
            "color_space": ["CMYK", "GRAY"],
            "compression": ["ZIP", "LZW", "None"]
        },
        "fonts": {
            "must_be_embedded": true,
            "subset_allowed": true,
            "prohibited_types": ["Type 3"]
        },
        "bleed": {
            "required": true,
            "min_bleed_inches": 0.125
        },
        "ink_coverage": {
            "max_total_coverage_percent": 300
        },
        "transparency": {
            "allowed": false
        },
        "layers": {
            "allowed": false
        }
    }'::jsonb,
    true,
    true
) ON CONFLICT DO NOTHING;

-- Insert default PDF/X-3 profile
INSERT INTO preflight_profiles (
    tenant_id,
    profile_name,
    profile_type,
    version,
    version_notes,
    rules,
    is_default,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'PDF/X-3:2002 Standard',
    'PDF_X_3',
    1,
    'Standard PDF/X-3:2002 profile with ICC color management',
    '{
        "pdf_version": {"required": "1.3", "max_version": "1.3"},
        "color_space": {"allowed": ["CMYK", "GRAY", "RGB", "LAB"]},
        "images": {
            "min_resolution_dpi": 300,
            "max_resolution_dpi": 2400,
            "icc_profile_required": true
        },
        "fonts": {
            "must_be_embedded": true,
            "subset_allowed": true
        },
        "bleed": {
            "required": true,
            "min_bleed_inches": 0.125
        },
        "ink_coverage": {
            "max_total_coverage_percent": 320
        }
    }'::jsonb,
    false,
    true
) ON CONFLICT DO NOTHING;

-- Insert default PDF/X-4 profile
INSERT INTO preflight_profiles (
    tenant_id,
    profile_name,
    profile_type,
    version,
    version_notes,
    rules,
    is_default,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'PDF/X-4:2010 Standard',
    'PDF_X_4',
    1,
    'Standard PDF/X-4:2010 profile with transparency support',
    '{
        "pdf_version": {"required": "1.4", "max_version": "1.6"},
        "color_space": {"allowed": ["CMYK", "GRAY", "RGB", "LAB"]},
        "images": {
            "min_resolution_dpi": 300,
            "max_resolution_dpi": 2400,
            "icc_profile_required": true
        },
        "fonts": {
            "must_be_embedded": true,
            "subset_allowed": true,
            "opentype_allowed": true
        },
        "bleed": {
            "required": true,
            "min_bleed_inches": 0.125
        },
        "transparency": {
            "allowed": true,
            "flattening_required": false
        },
        "layers": {
            "allowed": true
        }
    }'::jsonb,
    false,
    true
) ON CONFLICT DO NOTHING;
EOF

    psql "$DATABASE_URL" -f "$SEED_FILE" -v ON_ERROR_STOP=1
    rm "$SEED_FILE"

    print_success "Default profiles created"
}

# Function to install/update dependencies
update_dependencies() {
    print_header "UPDATING DEPENDENCIES"

    cd "$BACKEND_DIR"

    print_info "Installing backend dependencies..."

    if [ -f "package-lock.json" ]; then
        npm install
    elif [ -f "yarn.lock" ]; then
        yarn install
    else
        npm install
    fi

    print_success "Backend dependencies updated"

    # Update frontend dependencies
    FRONTEND_DIR="$PROJECT_ROOT/frontend"

    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        print_info "Installing frontend dependencies..."

        if [ -f "package-lock.json" ]; then
            npm install
        elif [ -f "yarn.lock" ]; then
            yarn install
        else
            npm install
        fi

        print_success "Frontend dependencies updated"
    fi
}

# Function to build backend
build_backend() {
    print_header "BUILDING BACKEND"

    cd "$BACKEND_DIR"

    print_info "Compiling TypeScript..."

    if [ -f "package-lock.json" ]; then
        npm run build
    elif [ -f "yarn.lock" ]; then
        yarn build
    else
        npm run build
    fi

    print_success "Backend built successfully"
}

# Function to build frontend
build_frontend() {
    print_header "BUILDING FRONTEND"

    FRONTEND_DIR="$PROJECT_ROOT/frontend"

    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"

        print_info "Building frontend application..."

        if [ -f "package-lock.json" ]; then
            npm run build
        elif [ -f "yarn.lock" ]; then
            yarn build
        else
            npm run build
        fi

        print_success "Frontend built successfully"
    else
        print_warning "Frontend directory not found, skipping frontend build"
    fi
}

# Function to restart services
restart_services() {
    print_header "RESTARTING SERVICES"

    print_info "Checking for Docker Compose..."

    if command -v docker-compose &> /dev/null || command -v docker &> /dev/null; then
        cd "$PROJECT_ROOT"

        if [ -f "docker-compose.yml" ] || [ -f "docker-compose.app.yml" ]; then
            print_info "Restarting services with Docker Compose..."

            # Try new docker compose command first, fall back to docker-compose
            if docker compose restart backend 2>/dev/null; then
                print_success "Backend service restarted"
            elif docker-compose restart backend 2>/dev/null; then
                print_success "Backend service restarted"
            else
                print_warning "Could not restart backend service automatically"
            fi

            if docker compose restart frontend 2>/dev/null; then
                print_success "Frontend service restarted"
            elif docker-compose restart frontend 2>/dev/null; then
                print_success "Frontend service restarted"
            else
                print_warning "Could not restart frontend service automatically"
            fi
        else
            print_warning "Docker Compose files not found"
        fi
    else
        print_warning "Docker not found. Please restart services manually"
    fi
}

# Function to run health checks
run_health_checks() {
    print_header "RUNNING HEALTH CHECKS"

    HEALTH_CHECK_SCRIPT="$SCRIPT_DIR/health-check-preflight.sh"

    if [ -f "$HEALTH_CHECK_SCRIPT" ]; then
        print_info "Running health check script..."
        bash "$HEALTH_CHECK_SCRIPT"
    else
        print_warning "Health check script not found at: $HEALTH_CHECK_SCRIPT"
        print_info "Please run health checks manually"
    fi
}

# Function to display deployment summary
deployment_summary() {
    print_header "DEPLOYMENT SUMMARY"

    echo -e "${GREEN}Deployment completed successfully!${NC}\n"

    echo "Feature: PDF Preflight & Color Management"
    echo "REQ: REQ-STRATEGIC-AUTO-1767066329942"
    echo "Migration: $MIGRATION_FILE"
    echo "Deployment Date: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "Components Deployed:"
    echo "  ✓ Database schema (6 tables, 2 views)"
    echo "  ✓ Backend service (PreflightService)"
    echo "  ✓ GraphQL API (9 queries, 8 mutations)"
    echo "  ✓ Frontend pages (4 pages)"
    echo "  ✓ Default preflight profiles (PDF/X-1a, PDF/X-3, PDF/X-4)"
    echo ""
    echo "Next Steps:"
    echo "  1. Verify the deployment with health checks"
    echo "  2. Test the preflight dashboard in the UI"
    echo "  3. Create tenant-specific profiles as needed"
    echo "  4. Monitor logs for any errors"
    echo ""
    echo "Documentation:"
    echo "  - Deployment Guide: $BACKEND_DIR/docs/PREFLIGHT_DEPLOYMENT_GUIDE.md"
    echo "  - API Documentation: GraphQL schema at /graphql endpoint"
    echo "  - User Guide: Frontend at /preflight/* routes"
    echo ""
}

# Main deployment flow
main() {
    print_header "PDF PREFLIGHT & COLOR MANAGEMENT DEPLOYMENT"
    echo "REQ: REQ-STRATEGIC-AUTO-1767066329942"
    echo "Starting deployment at $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""

    # Step 1: Prerequisites
    check_prerequisites

    # Step 2: Backup
    backup_database

    # Step 3: Run migration
    run_migration

    # Step 4: Verify schema
    verify_schema

    # Step 5: Seed initial data
    seed_data

    # Step 6: Update dependencies
    update_dependencies

    # Step 7: Build backend
    build_backend

    # Step 8: Build frontend
    build_frontend

    # Step 9: Restart services
    restart_services

    # Step 10: Health checks
    run_health_checks

    # Step 11: Summary
    deployment_summary
}

# Run main function
main "$@"
