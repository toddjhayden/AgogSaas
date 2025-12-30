-- Migration: Create Code Quality & Quality Gates Infrastructure
-- Version: V0.0.61
-- Description: Implements database schema for automated code review and quality gates integration
-- Reference: REQ-STRATEGIC-AUTO-1767108044307

-- =====================================================
-- 1. Quality Metrics Storage
-- =====================================================

CREATE TABLE IF NOT EXISTS quality_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    req_number VARCHAR(100) NOT NULL,
    commit_sha VARCHAR(40) NOT NULL,
    branch VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Coverage Metrics
    line_coverage DECIMAL(5,2),
    branch_coverage DECIMAL(5,2),
    function_coverage DECIMAL(5,2),
    statement_coverage DECIMAL(5,2),

    -- Complexity Metrics
    max_complexity INTEGER,
    avg_complexity DECIMAL(5,2),
    complexity_violations JSONB DEFAULT '[]'::JSONB,

    -- Linting Metrics
    lint_errors INTEGER DEFAULT 0,
    lint_warnings INTEGER DEFAULT 0,
    lint_issues JSONB DEFAULT '[]'::JSONB,

    -- Security Metrics
    critical_vulnerabilities INTEGER DEFAULT 0,
    high_vulnerabilities INTEGER DEFAULT 0,
    medium_vulnerabilities INTEGER DEFAULT 0,
    low_vulnerabilities INTEGER DEFAULT 0,
    vulnerabilities JSONB DEFAULT '[]'::JSONB,

    -- Performance Metrics
    build_time_ms INTEGER,
    bundle_size_kb INTEGER,
    avg_test_duration_ms INTEGER,

    -- Quality Gate Status
    quality_gate_passed BOOLEAN NOT NULL DEFAULT FALSE,
    blocked_reasons TEXT[],

    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,

    CONSTRAINT quality_metrics_req_commit_unique UNIQUE (req_number, commit_sha)
);

CREATE INDEX idx_quality_metrics_req_number ON quality_metrics(req_number);
CREATE INDEX idx_quality_metrics_commit_sha ON quality_metrics(commit_sha);
CREATE INDEX idx_quality_metrics_created_at ON quality_metrics(created_at DESC);
CREATE INDEX idx_quality_metrics_gate_passed ON quality_metrics(quality_gate_passed);

COMMENT ON TABLE quality_metrics IS 'Stores code quality metrics for each commit/requirement';
COMMENT ON COLUMN quality_metrics.complexity_violations IS 'Array of {file, function, complexity, threshold} objects';
COMMENT ON COLUMN quality_metrics.lint_issues IS 'Array of {file, line, rule, message, severity} objects';
COMMENT ON COLUMN quality_metrics.vulnerabilities IS 'Array of {package, severity, title, cve} objects';

-- =====================================================
-- 2. Quality Gate Configurations
-- =====================================================

CREATE TABLE IF NOT EXISTS quality_gate_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    -- Coverage Thresholds
    min_line_coverage DECIMAL(5,2) DEFAULT 70.0,
    min_branch_coverage DECIMAL(5,2) DEFAULT 65.0,
    min_function_coverage DECIMAL(5,2) DEFAULT 75.0,
    min_new_code_coverage DECIMAL(5,2) DEFAULT 90.0,

    -- Complexity Thresholds
    max_cyclomatic_complexity INTEGER DEFAULT 10,
    max_cognitive_complexity INTEGER DEFAULT 15,
    max_lines_per_function INTEGER DEFAULT 50,
    max_file_length INTEGER DEFAULT 300,

    -- Security Thresholds
    max_critical_vulnerabilities INTEGER DEFAULT 0,
    max_high_vulnerabilities INTEGER DEFAULT 2,

    -- Performance Thresholds
    max_bundle_size_kb INTEGER DEFAULT 600,
    max_api_response_p95_ms INTEGER DEFAULT 800,
    max_slow_query_ms INTEGER DEFAULT 3000,
    max_ci_pipeline_minutes INTEGER DEFAULT 30,

    -- Code Quality Thresholds
    max_code_smells INTEGER DEFAULT 50,
    max_technical_debt_ratio DECIMAL(5,2) DEFAULT 7.0,
    max_duplicated_code_pct DECIMAL(5,2) DEFAULT 3.0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_quality_gate_configs_enabled ON quality_gate_configs(enabled) WHERE enabled = TRUE;

COMMENT ON TABLE quality_gate_configs IS 'Configurable quality gate thresholds';

-- Insert default configuration
INSERT INTO quality_gate_configs (name, description) VALUES
('default', 'Default quality gate configuration following Sylvia''s revised thresholds')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 3. Quality Gate Validation Results
-- =====================================================

CREATE TYPE validation_status AS ENUM (
    'PENDING',
    'PASSED',
    'FAILED_LINTING',
    'FAILED_TESTS',
    'FAILED_COMPLEXITY',
    'FAILED_COVERAGE',
    'FAILED_SECURITY',
    'TIMEOUT',
    'ERROR'
);

CREATE TABLE IF NOT EXISTS quality_gate_validations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    req_number VARCHAR(100) NOT NULL,
    agent_name VARCHAR(50) NOT NULL,
    deliverable_url TEXT,

    -- Validation Status
    status validation_status NOT NULL DEFAULT 'PENDING',
    quality_gate_config_id UUID REFERENCES quality_gate_configs(id),

    -- Validation Results
    validation_started_at TIMESTAMPTZ,
    validation_completed_at TIMESTAMPTZ,
    validation_duration_ms INTEGER,

    -- Individual Check Results
    linting_passed BOOLEAN,
    linting_errors TEXT[],

    type_checking_passed BOOLEAN,
    type_checking_errors TEXT[],

    unit_tests_passed BOOLEAN,
    unit_test_failures TEXT[],

    complexity_check_passed BOOLEAN,
    complexity_violations TEXT[],

    coverage_check_passed BOOLEAN,
    coverage_failures TEXT[],

    security_check_passed BOOLEAN,
    security_violations TEXT[],

    -- Overall Results
    overall_passed BOOLEAN NOT NULL DEFAULT FALSE,
    failure_reasons TEXT[],
    recommendations TEXT[],

    -- Files Changed
    files_created TEXT[],
    files_modified TEXT[],
    files_deleted TEXT[],

    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quality_gate_validations_req ON quality_gate_validations(req_number);
CREATE INDEX idx_quality_gate_validations_agent ON quality_gate_validations(agent_name);
CREATE INDEX idx_quality_gate_validations_status ON quality_gate_validations(status);
CREATE INDEX idx_quality_gate_validations_created_at ON quality_gate_validations(created_at DESC);

COMMENT ON TABLE quality_gate_validations IS 'Stores validation results for agent deliverables';
COMMENT ON COLUMN quality_gate_validations.validation_duration_ms IS 'Time taken to complete validation (target: <2 minutes = 120,000ms)';

-- =====================================================
-- 4. Quality Gate Bypass Tracking (Emergency Use)
-- =====================================================

CREATE TABLE IF NOT EXISTS quality_gate_bypasses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    req_number VARCHAR(100) NOT NULL,
    validation_id UUID REFERENCES quality_gate_validations(id),

    -- Bypass Details
    bypass_reason TEXT NOT NULL,
    bypassed_by UUID NOT NULL,
    approved_by UUID[], -- Requires 2 approvals (Product Owner + Tech Lead)

    -- Violations Bypassed
    bypassed_violations TEXT[] NOT NULL,

    -- Follow-up
    follow_up_issue_number VARCHAR(100),
    follow_up_due_date TIMESTAMPTZ,
    follow_up_completed BOOLEAN DEFAULT FALSE,

    -- Post-mortem
    postmortem_completed BOOLEAN DEFAULT FALSE,
    postmortem_url TEXT,

    -- Timestamps
    bypassed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_quality_gate_bypasses_req ON quality_gate_bypasses(req_number);
CREATE INDEX idx_quality_gate_bypasses_date ON quality_gate_bypasses(bypassed_at DESC);
CREATE INDEX idx_quality_gate_bypasses_unresolved ON quality_gate_bypasses(follow_up_completed) WHERE follow_up_completed = FALSE;

COMMENT ON TABLE quality_gate_bypasses IS 'Tracks emergency quality gate bypasses (must be <5% of deployments)';
COMMENT ON COLUMN quality_gate_bypasses.approved_by IS 'Requires 2 approvals: Product Owner + Tech Lead';

-- =====================================================
-- 5. Agent Quality Scores
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_quality_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    agent_name VARCHAR(50) NOT NULL,
    time_period VARCHAR(20) NOT NULL, -- 'weekly', 'monthly', 'quarterly'
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Quality Metrics
    total_deliverables INTEGER NOT NULL DEFAULT 0,
    passed_quality_gates INTEGER NOT NULL DEFAULT 0,
    failed_quality_gates INTEGER NOT NULL DEFAULT 0,
    bypassed_quality_gates INTEGER NOT NULL DEFAULT 0,

    -- Pass Rates
    quality_gate_pass_rate DECIMAL(5,2),
    avg_quality_score DECIMAL(5,2),

    -- Coverage Trends
    avg_line_coverage DECIMAL(5,2),
    avg_branch_coverage DECIMAL(5,2),

    -- Complexity Trends
    avg_complexity DECIMAL(5,2),
    complexity_violation_count INTEGER DEFAULT 0,

    -- Security Trends
    total_vulnerabilities_found INTEGER DEFAULT 0,
    critical_vulnerabilities_found INTEGER DEFAULT 0,

    -- Performance Trends
    avg_validation_time_ms INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT agent_quality_scores_unique UNIQUE (agent_name, time_period, period_start)
);

CREATE INDEX idx_agent_quality_scores_agent ON agent_quality_scores(agent_name);
CREATE INDEX idx_agent_quality_scores_period ON agent_quality_scores(period_start DESC);

COMMENT ON TABLE agent_quality_scores IS 'Aggregated quality metrics per agent over time';

-- =====================================================
-- 6. GraphQL Schema Compatibility Tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS graphql_schema_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    req_number VARCHAR(100) NOT NULL,
    commit_sha VARCHAR(40) NOT NULL,

    -- Schema Change Detection
    breaking_changes JSONB DEFAULT '[]'::JSONB,
    dangerous_changes JSONB DEFAULT '[]'::JSONB,
    safe_changes JSONB DEFAULT '[]'::JSONB,

    -- Compatibility Status
    is_breaking BOOLEAN NOT NULL DEFAULT FALSE,
    frontend_compatible BOOLEAN NOT NULL DEFAULT TRUE,

    -- Schema Versions
    previous_schema_hash VARCHAR(64),
    new_schema_hash VARCHAR(64) NOT NULL,

    -- Validation
    validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validated_by VARCHAR(255),

    -- Contract Tests
    contract_tests_passed BOOLEAN,
    contract_test_results JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_graphql_schema_changes_req ON graphql_schema_changes(req_number);
CREATE INDEX idx_graphql_schema_changes_breaking ON graphql_schema_changes(is_breaking) WHERE is_breaking = TRUE;
CREATE INDEX idx_graphql_schema_changes_date ON graphql_schema_changes(validated_at DESC);

COMMENT ON TABLE graphql_schema_changes IS 'Tracks GraphQL schema changes and compatibility';
COMMENT ON COLUMN graphql_schema_changes.breaking_changes IS 'Array of breaking schema changes that require frontend updates';

-- =====================================================
-- 7. CI/CD Performance Metrics
-- =====================================================

CREATE TABLE IF NOT EXISTS ci_pipeline_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    req_number VARCHAR(100),
    commit_sha VARCHAR(40) NOT NULL,
    branch VARCHAR(255) NOT NULL,

    -- Pipeline Execution
    pipeline_id VARCHAR(255) NOT NULL,
    pipeline_url TEXT,
    pipeline_type VARCHAR(50) NOT NULL, -- 'fast_feedback', 'comprehensive'

    -- Timing Metrics
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    total_duration_seconds INTEGER,

    -- Job Timings
    lint_duration_seconds INTEGER,
    test_duration_seconds INTEGER,
    build_duration_seconds INTEGER,
    security_scan_duration_seconds INTEGER,
    quality_analysis_duration_seconds INTEGER,

    -- Cache Performance
    cache_hit_rate DECIMAL(5,2),
    cache_size_mb INTEGER,

    -- Status
    status VARCHAR(50) NOT NULL, -- 'success', 'failure', 'cancelled'
    failed_jobs TEXT[],

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ci_pipeline_metrics_req ON ci_pipeline_metrics(req_number);
CREATE INDEX idx_ci_pipeline_metrics_commit ON ci_pipeline_metrics(commit_sha);
CREATE INDEX idx_ci_pipeline_metrics_date ON ci_pipeline_metrics(started_at DESC);
CREATE INDEX idx_ci_pipeline_metrics_type ON ci_pipeline_metrics(pipeline_type);

COMMENT ON TABLE ci_pipeline_metrics IS 'Tracks CI/CD pipeline performance (target: <30 minutes)';

-- =====================================================
-- 8. Views for Reporting
-- =====================================================

-- Quality Gate Pass Rate by Agent
CREATE OR REPLACE VIEW v_agent_quality_pass_rates AS
SELECT
    agent_name,
    COUNT(*) as total_validations,
    SUM(CASE WHEN overall_passed THEN 1 ELSE 0 END) as passed_validations,
    SUM(CASE WHEN NOT overall_passed THEN 1 ELSE 0 END) as failed_validations,
    ROUND(100.0 * SUM(CASE WHEN overall_passed THEN 1 ELSE 0 END) / COUNT(*), 2) as pass_rate_pct,
    AVG(validation_duration_ms) as avg_validation_time_ms
FROM quality_gate_validations
WHERE validation_completed_at IS NOT NULL
GROUP BY agent_name;

COMMENT ON VIEW v_agent_quality_pass_rates IS 'Quality gate pass rates per agent';

-- Recent Quality Metrics Trends
CREATE OR REPLACE VIEW v_quality_metrics_trends AS
SELECT
    req_number,
    commit_sha,
    created_at,
    line_coverage,
    max_complexity,
    lint_errors + lint_warnings as total_lint_issues,
    critical_vulnerabilities + high_vulnerabilities as critical_security_issues,
    quality_gate_passed,
    CASE
        WHEN quality_gate_passed THEN 'PASSED'
        WHEN ARRAY_LENGTH(blocked_reasons, 1) > 0 THEN 'FAILED: ' || ARRAY_TO_STRING(blocked_reasons, ', ')
        ELSE 'PENDING'
    END as status_summary
FROM quality_metrics
ORDER BY created_at DESC
LIMIT 100;

COMMENT ON VIEW v_quality_metrics_trends IS 'Recent quality metrics for dashboard display';

-- Quality Gate Bypass Rate (Must be <5%)
CREATE OR REPLACE VIEW v_quality_gate_bypass_rate AS
SELECT
    DATE_TRUNC('month', bypassed_at) as month,
    COUNT(*) as total_bypasses,
    COUNT(*) FILTER (WHERE follow_up_completed) as resolved_bypasses,
    COUNT(*) FILTER (WHERE NOT follow_up_completed) as unresolved_bypasses,
    ROUND(100.0 * COUNT(*) FILTER (WHERE postmortem_completed) / COUNT(*), 2) as postmortem_completion_rate
FROM quality_gate_bypasses
GROUP BY DATE_TRUNC('month', bypassed_at)
ORDER BY month DESC;

COMMENT ON VIEW v_quality_gate_bypass_rate IS 'Monthly bypass rate tracking (target: <5% of deployments)';

-- =====================================================
-- 9. Helper Functions
-- =====================================================

-- Calculate Quality Score (0-100)
CREATE OR REPLACE FUNCTION calculate_quality_score(
    p_line_coverage DECIMAL,
    p_complexity DECIMAL,
    p_lint_issues INTEGER,
    p_vulnerabilities INTEGER
) RETURNS INTEGER AS $$
DECLARE
    coverage_score INTEGER;
    complexity_score INTEGER;
    lint_score INTEGER;
    security_score INTEGER;
    total_score INTEGER;
BEGIN
    -- Coverage Score (0-30 points)
    coverage_score := LEAST(30, ROUND(p_line_coverage * 0.3));

    -- Complexity Score (0-25 points, inverse)
    complexity_score := GREATEST(0, 25 - ROUND(p_complexity * 2.5));

    -- Linting Score (0-25 points, inverse)
    lint_score := GREATEST(0, 25 - p_lint_issues);

    -- Security Score (0-20 points, inverse)
    security_score := GREATEST(0, 20 - (p_vulnerabilities * 5));

    total_score := coverage_score + complexity_score + lint_score + security_score;

    RETURN LEAST(100, total_score);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_quality_score IS 'Calculates overall quality score (0-100) from metrics';

-- =====================================================
-- 10. Row-Level Security Policies
-- =====================================================

-- Enable RLS on quality tables
ALTER TABLE quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_gate_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_gate_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_gate_bypasses ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE graphql_schema_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_pipeline_metrics ENABLE ROW LEVEL SECURITY;

-- Policies for quality_metrics (all authenticated users can read, system can write)
CREATE POLICY quality_metrics_select_policy ON quality_metrics
    FOR SELECT USING (
        CURRENT_SETTING('app.current_tenant_id', TRUE)::UUID IS NOT NULL
    );

CREATE POLICY quality_metrics_insert_policy ON quality_metrics
    FOR INSERT WITH CHECK (
        CURRENT_SETTING('app.current_tenant_id', TRUE)::UUID IS NOT NULL
    );

-- Policies for quality_gate_configs (admin only for updates)
CREATE POLICY quality_gate_configs_select_policy ON quality_gate_configs
    FOR SELECT USING (TRUE); -- All can read configs

-- Policies for quality_gate_validations (read-only for most, system writes)
CREATE POLICY quality_gate_validations_select_policy ON quality_gate_validations
    FOR SELECT USING (
        CURRENT_SETTING('app.current_tenant_id', TRUE)::UUID IS NOT NULL
    );

CREATE POLICY quality_gate_validations_insert_policy ON quality_gate_validations
    FOR INSERT WITH CHECK (
        CURRENT_SETTING('app.current_tenant_id', TRUE)::UUID IS NOT NULL
    );

-- Similar policies for other tables...
CREATE POLICY quality_gate_bypasses_select_policy ON quality_gate_bypasses
    FOR SELECT USING (TRUE);

CREATE POLICY agent_quality_scores_select_policy ON agent_quality_scores
    FOR SELECT USING (TRUE);

CREATE POLICY graphql_schema_changes_select_policy ON graphql_schema_changes
    FOR SELECT USING (TRUE);

CREATE POLICY ci_pipeline_metrics_select_policy ON ci_pipeline_metrics
    FOR SELECT USING (TRUE);

-- Grant permissions
GRANT SELECT ON quality_metrics TO authenticated;
GRANT SELECT ON quality_gate_configs TO authenticated;
GRANT SELECT ON quality_gate_validations TO authenticated;
GRANT SELECT ON quality_gate_bypasses TO authenticated;
GRANT SELECT ON agent_quality_scores TO authenticated;
GRANT SELECT ON graphql_schema_changes TO authenticated;
GRANT SELECT ON ci_pipeline_metrics TO authenticated;

GRANT SELECT ON v_agent_quality_pass_rates TO authenticated;
GRANT SELECT ON v_quality_metrics_trends TO authenticated;
GRANT SELECT ON v_quality_gate_bypass_rate TO authenticated;
