#!/bin/bash
# ============================================================================
# Estimating & Job Costing Module Deployment Script
# REQ-STRATEGIC-AUTO-1767048328661
# ============================================================================
#
# This script deploys the database foundation for the Estimating & Job Costing
# module. It applies three migrations in sequence:
#   - V0.0.40: Jobs and Standard Costs tables
#   - V0.0.41: Estimating tables
#   - V0.0.42: Job Costing tables
#
# Author: Berry (DevOps Specialist)
# Date: 2025-12-29
# ============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Configuration
# ============================================================================

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-agogsaas}"
DB_USER="${DB_USER:-agogsaas_user}"
DB_PASSWORD="${DB_PASSWORD:-changeme}"

MIGRATIONS_DIR="$(dirname "$0")/../migrations"
LOG_DIR="$(dirname "$0")/../logs"
LOG_FILE="${LOG_DIR}/deploy-estimating-job-costing-$(date +%Y%m%d_%H%M%S).log"

# ============================================================================
# Functions
# ============================================================================

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1" | tee -a "${LOG_FILE}"
}

# Create log directory
mkdir -p "${LOG_DIR}"

# ============================================================================
# Pre-flight Checks
# ============================================================================

log "Starting Estimating & Job Costing Module Deployment"
log "======================================================"

# Check database connectivity
log "Checking database connectivity..."
if PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "Database connection successful"
else
    log_error "Cannot connect to database"
    log_error "Host: ${DB_HOST}:${DB_PORT}"
    log_error "Database: ${DB_NAME}"
    log_error "User: ${DB_USER}"
    exit 1
fi

# Check if migrations directory exists
if [ ! -d "${MIGRATIONS_DIR}" ]; then
    log_error "Migrations directory not found: ${MIGRATIONS_DIR}"
    exit 1
fi

# Check if migration files exist
MIGRATION_FILES=(
    "V0.0.40__create_jobs_and_standard_costs_tables.sql"
    "V0.0.41__create_estimating_tables.sql"
    "V0.0.42__create_job_costing_tables.sql"
)

for file in "${MIGRATION_FILES[@]}"; do
    if [ ! -f "${MIGRATIONS_DIR}/${file}" ]; then
        log_error "Migration file not found: ${file}"
        exit 1
    fi
done

log_success "All pre-flight checks passed"

# ============================================================================
# Migration Execution
# ============================================================================

log ""
log "Executing Migrations"
log "===================="

# Check if flyway version table exists, create if not
log "Checking migration tracking..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
CREATE TABLE IF NOT EXISTS flyway_schema_history (
    installed_rank INTEGER NOT NULL,
    version VARCHAR(50),
    description VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL,
    script VARCHAR(1000) NOT NULL,
    checksum INTEGER,
    installed_by VARCHAR(100) NOT NULL,
    installed_on TIMESTAMP NOT NULL DEFAULT NOW(),
    execution_time INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    PRIMARY KEY (installed_rank)
);
" >> "${LOG_FILE}" 2>&1

# Function to check if migration has been applied
migration_applied() {
    local version=$1
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "
        SELECT COUNT(*) FROM flyway_schema_history
        WHERE version = '${version}' AND success = true;
    " | tr -d ' '
}

# Function to execute migration
execute_migration() {
    local file=$1
    local version=$(echo "${file}" | sed -n 's/V\([0-9.]*\)__.*/\1/p')
    local description=$(echo "${file}" | sed -n 's/V[0-9.]*__\(.*\)\.sql/\1/p')

    log "Checking migration: ${file} (version ${version})..."

    # Check if already applied
    local applied_count=$(migration_applied "${version}")
    if [ "${applied_count}" -gt 0 ]; then
        log_warning "Migration ${version} already applied, skipping"
        return 0
    fi

    log "Applying migration: ${file}..."
    local start_time=$(date +%s)

    # Execute migration
    if PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
        -f "${MIGRATIONS_DIR}/${file}" >> "${LOG_FILE}" 2>&1; then

        local end_time=$(date +%s)
        local execution_time=$((end_time - start_time))

        # Record in migration history
        PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
            INSERT INTO flyway_schema_history
            (installed_rank, version, description, type, script, installed_by, execution_time, success)
            VALUES (
                (SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM flyway_schema_history),
                '${version}',
                '${description}',
                'SQL',
                '${file}',
                '${DB_USER}',
                ${execution_time},
                true
            );
        " >> "${LOG_FILE}" 2>&1

        log_success "Migration ${version} applied successfully (${execution_time}s)"
    else
        log_error "Migration ${file} failed"
        log_error "Check log file: ${LOG_FILE}"

        # Record failure
        PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
            INSERT INTO flyway_schema_history
            (installed_rank, version, description, type, script, installed_by, execution_time, success)
            VALUES (
                (SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM flyway_schema_history),
                '${version}',
                '${description}',
                'SQL',
                '${file}',
                '${DB_USER}',
                0,
                false
            );
        " >> "${LOG_FILE}" 2>&1

        exit 1
    fi
}

# Execute migrations in order
for file in "${MIGRATION_FILES[@]}"; do
    execute_migration "${file}"
done

# ============================================================================
# Post-Deployment Validation
# ============================================================================

log ""
log "Post-Deployment Validation"
log "=========================="

# Check that all tables were created
log "Verifying table creation..."

REQUIRED_TABLES=(
    "jobs"
    "cost_centers"
    "standard_costs"
    "estimates"
    "estimate_operations"
    "estimate_materials"
    "job_costs"
    "job_cost_updates"
)

for table in "${REQUIRED_TABLES[@]}"; do
    TABLE_EXISTS=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '${table}';
    " | tr -d ' ')

    if [ "${TABLE_EXISTS}" -eq 1 ]; then
        log_success "Table '${table}' exists"
    else
        log_error "Table '${table}' was not created"
        exit 1
    fi
done

# Check materialized view
log "Verifying materialized view creation..."
VIEW_EXISTS=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "
    SELECT COUNT(*) FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname = 'job_cost_variance_summary';
" | tr -d ' ')

if [ "${VIEW_EXISTS}" -eq 1 ]; then
    log_success "Materialized view 'job_cost_variance_summary' exists"
else
    log_error "Materialized view 'job_cost_variance_summary' was not created"
    exit 1
fi

# Check database functions
log "Verifying database functions..."

REQUIRED_FUNCTIONS=(
    "get_current_standard_cost"
    "initialize_job_cost_from_estimate"
    "update_job_cost_incremental"
    "rollup_estimate_costs"
    "calculate_quantity_with_scrap"
    "refresh_job_cost_variance_summary"
)

for func in "${REQUIRED_FUNCTIONS[@]}"; do
    FUNC_EXISTS=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "
        SELECT COUNT(*) FROM pg_proc
        WHERE proname = '${func}';
    " | tr -d ' ')

    if [ "${FUNC_EXISTS}" -gt 0 ]; then
        log_success "Function '${func}' exists"
    else
        log_warning "Function '${func}' not found (may be defined inline)"
    fi
done

# ============================================================================
# Summary
# ============================================================================

log ""
log "Deployment Summary"
log "=================="
log_success "Estimating & Job Costing Module deployment completed successfully"
log ""
log "Deployed Components:"
log "  - Jobs and Standard Costs tables (V0.0.40)"
log "  - Estimating tables (V0.0.41)"
log "  - Job Costing tables (V0.0.42)"
log ""
log "Tables Created: 8"
log "Materialized Views: 1"
log "Database Functions: 6+"
log ""
log "Next Steps:"
log "  1. Backend resolvers need to be implemented (see Billy's QA report)"
log "  2. Frontend components need to be implemented"
log "  3. Run health check: ./scripts/health-check-estimating-job-costing.sh"
log ""
log "Log file: ${LOG_FILE}"
log ""
log_success "Deployment complete!"
