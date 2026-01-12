#!/bin/bash
# ============================================================================
# Estimating & Job Costing Module Rollback Script
# REQ-STRATEGIC-AUTO-1767048328661
# ============================================================================
#
# This script rolls back the Estimating & Job Costing module deployment by
# dropping all tables, views, and functions in reverse order.
#
# ⚠️  WARNING: This will DELETE ALL DATA in the following tables:
#   - job_costs, job_cost_updates
#   - estimates, estimate_operations, estimate_materials
#   - jobs, cost_centers, standard_costs
#
# Author: Berry (DevOps Specialist)
# Date: 2025-12-29
# ============================================================================

set -e
set -u

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-agogsaas}"
DB_USER="${DB_USER:-agogsaas_user}"
DB_PASSWORD="${DB_PASSWORD:-changeme}"

LOG_DIR="$(dirname "$0")/../logs"
LOG_FILE="${LOG_DIR}/rollback-estimating-job-costing-$(date +%Y%m%d_%H%M%S).log"

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
# Confirmation Prompt
# ============================================================================

echo ""
echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║               ⚠️  ROLLBACK WARNING ⚠️                      ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}This script will DELETE ALL DATA from the following tables:${NC}"
echo ""
echo "  • job_costs"
echo "  • job_cost_updates"
echo "  • estimates"
echo "  • estimate_operations"
echo "  • estimate_materials"
echo "  • jobs"
echo "  • cost_centers"
echo "  • standard_costs"
echo ""
echo "  • Materialized view: job_cost_variance_summary"
echo "  • 6+ database functions"
echo ""
echo -e "${YELLOW}This action CANNOT be undone!${NC}"
echo ""
echo "Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

# Require confirmation
read -p "Type 'ROLLBACK' to confirm (or Ctrl+C to cancel): " confirmation

if [ "${confirmation}" != "ROLLBACK" ]; then
    log_error "Rollback cancelled (confirmation did not match)"
    exit 1
fi

log "Starting rollback of Estimating & Job Costing Module..."
log "======================================================"

# Check database connectivity
log "Checking database connectivity..."
if PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "Database connection successful"
else
    log_error "Cannot connect to database"
    exit 1
fi

# ============================================================================
# Rollback V0.0.42 - Job Costing Tables
# ============================================================================

log ""
log "Rolling back V0.0.42 - Job Costing Tables"
log "========================================="

# Drop materialized view
log "Dropping materialized view job_cost_variance_summary..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP MATERIALIZED VIEW IF EXISTS job_cost_variance_summary CASCADE;
EOF
log_success "Materialized view dropped"

# Drop tables (reverse order)
log "Dropping job_cost_updates table..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP TABLE IF EXISTS job_cost_updates CASCADE;
EOF
log_success "Table job_cost_updates dropped"

log "Dropping job_costs table..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP TABLE IF EXISTS job_costs CASCADE;
EOF
log_success "Table job_costs dropped"

# Drop functions
log "Dropping job costing functions..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP FUNCTION IF EXISTS refresh_job_cost_variance_summary() CASCADE;
DROP FUNCTION IF EXISTS update_job_cost_incremental(UUID, VARCHAR, DECIMAL, VARCHAR, VARCHAR, JSONB, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS initialize_job_cost_from_estimate(UUID, UUID) CASCADE;
EOF
log_success "Job costing functions dropped"

# Remove from migration history
log "Removing V0.0.42 from migration history..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
    DELETE FROM flyway_schema_history WHERE version = '0.0.42';
" >> "${LOG_FILE}" 2>&1
log_success "V0.0.42 migration history removed"

# ============================================================================
# Rollback V0.0.41 - Estimating Tables
# ============================================================================

log ""
log "Rolling back V0.0.41 - Estimating Tables"
log "========================================"

# Drop tables (reverse order - materials, operations, estimates)
log "Dropping estimate_materials table..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP TABLE IF EXISTS estimate_materials CASCADE;
EOF
log_success "Table estimate_materials dropped"

log "Dropping estimate_operations table..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP TABLE IF EXISTS estimate_operations CASCADE;
EOF
log_success "Table estimate_operations dropped"

log "Dropping estimates table..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP TABLE IF EXISTS estimates CASCADE;
EOF
log_success "Table estimates dropped"

# Drop functions
log "Dropping estimating functions..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP FUNCTION IF EXISTS rollup_estimate_costs(UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_quantity_with_scrap(DECIMAL, DECIMAL) CASCADE;
EOF
log_success "Estimating functions dropped"

# Drop triggers
log "Dropping estimating triggers (if they exist as standalone)..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
-- Triggers are dropped with tables via CASCADE
EOF
log_success "Estimating triggers dropped"

# Remove from migration history
log "Removing V0.0.41 from migration history..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
    DELETE FROM flyway_schema_history WHERE version = '0.0.41';
" >> "${LOG_FILE}" 2>&1
log_success "V0.0.41 migration history removed"

# ============================================================================
# Rollback V0.0.40 - Jobs and Standard Costs Tables
# ============================================================================

log ""
log "Rolling back V0.0.40 - Jobs and Standard Costs Tables"
log "====================================================="

# Drop tables (reverse order)
log "Dropping standard_costs table..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP TABLE IF EXISTS standard_costs CASCADE;
EOF
log_success "Table standard_costs dropped"

log "Dropping cost_centers table..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP TABLE IF EXISTS cost_centers CASCADE;
EOF
log_success "Table cost_centers dropped"

log "Dropping jobs table..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP TABLE IF EXISTS jobs CASCADE;
EOF
log_success "Table jobs dropped"

# Drop functions
log "Dropping standard cost functions..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" << 'EOF' >> "${LOG_FILE}" 2>&1
DROP FUNCTION IF EXISTS get_current_standard_cost(UUID, VARCHAR, VARCHAR) CASCADE;
EOF
log_success "Standard cost functions dropped"

# Remove from migration history
log "Removing V0.0.40 from migration history..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
    DELETE FROM flyway_schema_history WHERE version = '0.0.40';
" >> "${LOG_FILE}" 2>&1
log_success "V0.0.40 migration history removed"

# ============================================================================
# Verification
# ============================================================================

log ""
log "Verifying Rollback"
log "=================="

# Check that tables no longer exist
TABLES=(
    "jobs"
    "cost_centers"
    "standard_costs"
    "estimates"
    "estimate_operations"
    "estimate_materials"
    "job_costs"
    "job_cost_updates"
)

ALL_DROPPED=true

for table in "${TABLES[@]}"; do
    TABLE_EXISTS=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '${table}';
    " | tr -d ' ')

    if [ "${TABLE_EXISTS}" -eq 0 ]; then
        log_success "Table '${table}' successfully removed"
    else
        log_error "Table '${table}' still exists!"
        ALL_DROPPED=false
    fi
done

# Check materialized view
VIEW_EXISTS=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "
    SELECT COUNT(*) FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname = 'job_cost_variance_summary';
" | tr -d ' ')

if [ "${VIEW_EXISTS}" -eq 0 ]; then
    log_success "Materialized view 'job_cost_variance_summary' successfully removed"
else
    log_error "Materialized view 'job_cost_variance_summary' still exists!"
    ALL_DROPPED=false
fi

# ============================================================================
# Summary
# ============================================================================

log ""
log "Rollback Summary"
log "================"

if [ "${ALL_DROPPED}" = true ]; then
    log_success "All components successfully rolled back"
    log ""
    log "Removed Components:"
    log "  - 8 database tables"
    log "  - 1 materialized view"
    log "  - 6+ database functions"
    log "  - All related triggers and policies"
    log ""
    log "Migration history cleaned"
    log "Log file: ${LOG_FILE}"
    log ""
    log_success "Rollback complete!"
    exit 0
else
    log_error "Rollback incomplete - some components still exist"
    log_error "Check log file: ${LOG_FILE}"
    exit 1
fi
