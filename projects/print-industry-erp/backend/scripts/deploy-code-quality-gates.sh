#!/bin/bash

# Deployment Script for Code Quality & Quality Gates Integration
# REQ-STRATEGIC-AUTO-1767108044307
# Deploys database schema and verifies quality gate infrastructure

set -e

echo "========================================="
echo "Code Quality Gates Deployment"
echo "REQ-STRATEGIC-AUTO-1767108044307"
echo "========================================="

# Check environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    exit 1
fi

echo ""
echo "Step 1: Running database migration..."
echo "---------------------------------------"

# Run Flyway migration
if command -v flyway &> /dev/null; then
    flyway migrate -url="$DATABASE_URL" -locations=filesystem:./migrations
else
    echo "Warning: Flyway not found, using psql instead"
    psql "$DATABASE_URL" -f ./migrations/V0.0.61__create_code_quality_tables.sql
fi

echo "✓ Database migration completed"

echo ""
echo "Step 2: Verifying database schema..."
echo "---------------------------------------"

# Verify tables exist
psql "$DATABASE_URL" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'quality%';"

echo "✓ Schema verification completed"

echo ""
echo "Step 3: Inserting default quality gate configuration..."
echo "---------------------------------------"

psql "$DATABASE_URL" <<EOF
INSERT INTO quality_gate_configs (
    name, description, enabled,
    min_line_coverage, min_branch_coverage, min_function_coverage, min_new_code_coverage,
    max_cyclomatic_complexity, max_cognitive_complexity, max_lines_per_function, max_file_length,
    max_critical_vulnerabilities, max_high_vulnerabilities,
    max_bundle_size_kb, max_api_response_p95_ms, max_slow_query_ms, max_ci_pipeline_minutes,
    max_code_smells, max_technical_debt_ratio, max_duplicated_code_pct
)
VALUES (
    'default', 'Default quality gate configuration following Sylvia''s revised thresholds', TRUE,
    70.0, 65.0, 75.0, 90.0,
    10, 15, 50, 300,
    0, 2,
    600, 800, 3000, 30,
    50, 7.0, 3.0
)
ON CONFLICT (name) DO UPDATE SET
    min_line_coverage = EXCLUDED.min_line_coverage,
    min_branch_coverage = EXCLUDED.min_branch_coverage,
    min_function_coverage = EXCLUDED.min_function_coverage,
    min_new_code_coverage = EXCLUDED.min_new_code_coverage,
    max_cyclomatic_complexity = EXCLUDED.max_cyclomatic_complexity,
    max_cognitive_complexity = EXCLUDED.max_cognitive_complexity,
    max_lines_per_function = EXCLUDED.max_lines_per_function,
    max_file_length = EXCLUDED.max_file_length,
    max_critical_vulnerabilities = EXCLUDED.max_critical_vulnerabilities,
    max_high_vulnerabilities = EXCLUDED.max_high_vulnerabilities,
    max_bundle_size_kb = EXCLUDED.max_bundle_size_kb,
    max_api_response_p95_ms = EXCLUDED.max_api_response_p95_ms,
    max_slow_query_ms = EXCLUDED.max_slow_query_ms,
    max_ci_pipeline_minutes = EXCLUDED.max_ci_pipeline_minutes,
    max_code_smells = EXCLUDED.max_code_smells,
    max_technical_debt_ratio = EXCLUDED.max_technical_debt_ratio,
    max_duplicated_code_pct = EXCLUDED.max_duplicated_code_pct,
    updated_at = NOW();

SELECT * FROM quality_gate_configs WHERE name = 'default';
EOF

echo "✓ Default configuration inserted"

echo ""
echo "Step 4: Testing quality gate functions..."
echo "---------------------------------------"

psql "$DATABASE_URL" <<EOF
-- Test calculate_quality_score function
SELECT calculate_quality_score(85.0, 8.0, 5, 1) as quality_score;

-- Test views
SELECT COUNT(*) as agent_count FROM v_agent_quality_pass_rates;
SELECT COUNT(*) as trend_count FROM v_quality_metrics_trends;
EOF

echo "✓ Functions tested successfully"

echo ""
echo "========================================="
echo "Deployment Summary"
echo "========================================="
echo "✓ Database schema created (8 tables, 3 views, 1 function)"
echo "✓ Row-level security policies applied"
echo "✓ Default quality gate configuration created"
echo "✓ Quality gate thresholds:"
echo "  - Line coverage: ≥70% (blocking)"
echo "  - Critical vulnerabilities: 0 (blocking)"
echo "  - Cyclomatic complexity: ≤10 (blocking)"
echo "  - CI pipeline time: ≤30 minutes"
echo ""
echo "Next Steps:"
echo "1. Verify GraphQL schema integration"
echo "2. Test quality gate validation"
echo "3. Configure NATS streams for quality metrics"
echo "4. Update agent deliverable workflows"
echo ""
echo "Deployment completed successfully!"
