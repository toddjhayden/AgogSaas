-- =====================================================
-- PDF PREFLIGHT & COLOR MANAGEMENT MODULE
-- =====================================================
-- REQ: REQ-STRATEGIC-AUTO-1767066329942 - PDF Preflight & Color Management
-- Created: 2025-12-30
-- Description: Database schema for PDF preflight validation and color management
--
-- Following Sylvia's architectural recommendations:
-- - Structured preflight_issues table (not just JSONB)
-- - Blob storage references (not inline storage)
-- - Profile versioning support
-- - Internationalization support via error codes
-- =====================================================

-- =====================================================
-- PREFLIGHT PROFILES
-- =====================================================
-- Defines validation rules for different PDF standards (PDF/X-1a, PDF/X-3, etc.)

CREATE TABLE preflight_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Profile identification
    profile_name VARCHAR(100) NOT NULL,
    profile_type VARCHAR(50) NOT NULL,
    -- PDF_X_1A, PDF_X_3, PDF_X_4, CUSTOM

    -- Version management (per Sylvia's recommendation)
    version INTEGER NOT NULL DEFAULT 1,
    version_notes TEXT,
    superseded_by UUID,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,

    -- Validation rules (JSONB for flexibility)
    rules JSONB NOT NULL,
    -- Example structure:
    -- {
    --   "pdf_version": {"required": "1.3", "max_version": "1.4"},
    --   "color_space": {"allowed": ["CMYK", "GRAY"]},
    --   "images": {"min_resolution_dpi": 300, "max_resolution_dpi": 2400},
    --   "fonts": {"must_be_embedded": true},
    --   "bleed": {"required": true, "min_bleed_inches": 0.125},
    --   "ink_coverage": {"max_total_coverage_percent": 320}
    -- }

    -- Profile settings
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT fk_profiles_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_profiles_superseded FOREIGN KEY (superseded_by)
        REFERENCES preflight_profiles(id) ON DELETE SET NULL,
    CONSTRAINT chk_profile_type CHECK (profile_type IN (
        'PDF_X_1A', 'PDF_X_3', 'PDF_X_4', 'CUSTOM'
    ))
);

-- Indexes
CREATE INDEX idx_preflight_profiles_tenant ON preflight_profiles(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_preflight_profiles_active ON preflight_profiles(tenant_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_preflight_profiles_type ON preflight_profiles(profile_type) WHERE deleted_at IS NULL;

COMMENT ON TABLE preflight_profiles IS 'REQ-STRATEGIC-AUTO-1767066329942: Preflight validation profiles for PDF/X standards and custom rules';
COMMENT ON COLUMN preflight_profiles.version IS 'Version number for profile history tracking';
COMMENT ON COLUMN preflight_profiles.superseded_by IS 'Points to newer version of this profile';

-- =====================================================
-- PREFLIGHT REPORTS
-- =====================================================
-- Results from PDF validation against a preflight profile

CREATE TABLE preflight_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- References
    job_id UUID,
    estimate_id UUID,
    artwork_file_id UUID NOT NULL,

    -- File information
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT,
    file_hash VARCHAR(64),  -- SHA-256 for duplicate detection

    -- Preflight profile used
    preflight_profile_id UUID NOT NULL,
    profile_version INTEGER NOT NULL,  -- Snapshot of version used

    -- Overall status
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    -- QUEUED, PROCESSING, PASS, PASS_WITH_WARNINGS, FAIL, ERROR

    -- Validation results summary
    total_errors INTEGER DEFAULT 0,
    total_warnings INTEGER DEFAULT 0,
    total_info INTEGER DEFAULT 0,

    -- PDF metadata
    pdf_version VARCHAR(20),
    page_count INTEGER,
    color_space VARCHAR(50),
    -- CMYK, RGB, SPOT, MIXED

    -- Color analysis
    icc_profile_embedded VARCHAR(255),
    spot_colors JSONB,
    -- [{name: 'PANTONE 185 C', lab: {l: 50, a: 65, b: 48}}]
    max_ink_coverage NUMERIC(10,4),

    -- Image analysis
    total_images INTEGER,
    min_image_resolution_dpi INTEGER,
    avg_image_resolution_dpi INTEGER,

    -- Font analysis
    fonts_embedded BOOLEAN,
    font_list JSONB,

    -- Dimensions
    trim_width_inches NUMERIC(10,4),
    trim_height_inches NUMERIC(10,4),
    bleed_inches NUMERIC(10,4),

    -- Processing metrics
    processing_time_ms INTEGER,
    processed_at TIMESTAMPTZ,

    -- Approval workflow
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejected_by UUID,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    approval_notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT fk_preflight_reports_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_preflight_reports_profile FOREIGN KEY (preflight_profile_id)
        REFERENCES preflight_profiles(id) ON DELETE RESTRICT,
    CONSTRAINT chk_report_status CHECK (status IN (
        'QUEUED', 'PROCESSING', 'PASS', 'PASS_WITH_WARNINGS', 'FAIL', 'ERROR'
    ))
);

-- Indexes
CREATE INDEX idx_preflight_reports_tenant ON preflight_reports(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_preflight_reports_job ON preflight_reports(job_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_preflight_reports_status ON preflight_reports(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_preflight_reports_file_hash ON preflight_reports(file_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_preflight_reports_created ON preflight_reports(created_at DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE preflight_reports IS 'REQ-STRATEGIC-AUTO-1767066329942: PDF preflight validation reports';
COMMENT ON COLUMN preflight_reports.profile_version IS 'Snapshot of profile version at validation time';
COMMENT ON COLUMN preflight_reports.file_hash IS 'SHA-256 hash for duplicate detection and integrity';

-- =====================================================
-- PREFLIGHT ISSUES
-- =====================================================
-- Structured storage of validation errors/warnings (per Sylvia's recommendation)

CREATE TABLE preflight_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    preflight_report_id UUID NOT NULL,

    -- Issue classification
    issue_type VARCHAR(20) NOT NULL,
    -- ERROR, WARNING, INFO

    -- Standardized error codes (for i18n support)
    error_code VARCHAR(100) NOT NULL,
    -- MISSING_BLEED, LOW_RES_IMAGE, FONT_NOT_EMBEDDED, HIGH_INK_COVERAGE, etc.

    severity VARCHAR(20),
    -- CRITICAL, MAJOR, MINOR

    -- Location
    page_number INTEGER,
    element_type VARCHAR(50),
    -- IMAGE, FONT, COLORSPACE, GEOMETRY, TRANSPARENCY

    -- Error details
    message TEXT NOT NULL,
    suggested_fix TEXT,

    -- Element identification
    element_name VARCHAR(255),
    element_metadata JSONB,
    -- Flexible storage for error-specific data
    -- Examples:
    -- {"actual_dpi": 250, "required_dpi": 300} for LOW_RES_IMAGE
    -- {"page": 3, "image": "logo.jpg"} for element reference

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_preflight_issues_report FOREIGN KEY (preflight_report_id)
        REFERENCES preflight_reports(id) ON DELETE CASCADE,
    CONSTRAINT chk_issue_type CHECK (issue_type IN ('ERROR', 'WARNING', 'INFO')),
    CONSTRAINT chk_severity CHECK (severity IN ('CRITICAL', 'MAJOR', 'MINOR'))
);

-- Indexes for analytics
CREATE INDEX idx_preflight_issues_report ON preflight_issues(preflight_report_id);
CREATE INDEX idx_preflight_issues_error_code ON preflight_issues(error_code);
CREATE INDEX idx_preflight_issues_severity ON preflight_issues(severity);
CREATE INDEX idx_preflight_issues_type ON preflight_issues(issue_type);
CREATE INDEX idx_preflight_issues_created ON preflight_issues(created_at DESC);

-- Index for common analytics query
CREATE INDEX idx_preflight_issues_analytics
    ON preflight_issues(error_code, created_at)
    WHERE issue_type = 'ERROR';

COMMENT ON TABLE preflight_issues IS 'REQ-STRATEGIC-AUTO-1767066329942: Structured preflight validation issues for analytics';
COMMENT ON COLUMN preflight_issues.error_code IS 'Standardized error code for i18n message lookup';

-- =====================================================
-- PREFLIGHT ARTIFACTS
-- =====================================================
-- Blob storage references for generated artifacts (per Sylvia's recommendation)

CREATE TABLE preflight_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    preflight_report_id UUID NOT NULL,

    -- Artifact type
    artifact_type VARCHAR(50) NOT NULL,
    -- ANNOTATED_PDF, SOFT_PROOF, DIGITAL_PROOF, COLOR_SEPARATION, THUMBNAIL

    -- Blob storage location
    storage_provider VARCHAR(20) DEFAULT 'S3',
    storage_bucket VARCHAR(255),
    storage_key VARCHAR(500),
    storage_url TEXT,  -- Presigned URL (expires after 1 hour)

    -- File metadata
    file_size_bytes BIGINT,
    file_format VARCHAR(20),
    content_hash VARCHAR(64),  -- SHA-256 for integrity

    -- Lifecycle management (per Sylvia's recommendation)
    storage_tier VARCHAR(20) DEFAULT 'STANDARD',
    -- STANDARD, INFREQUENT_ACCESS, GLACIER, DEEP_ARCHIVE
    tier_transitioned_at TIMESTAMPTZ,

    -- Retention policy
    expires_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT fk_preflight_artifacts_report FOREIGN KEY (preflight_report_id)
        REFERENCES preflight_reports(id) ON DELETE CASCADE,
    CONSTRAINT chk_artifact_type CHECK (artifact_type IN (
        'ANNOTATED_PDF', 'SOFT_PROOF', 'DIGITAL_PROOF',
        'COLOR_SEPARATION', 'THUMBNAIL'
    )),
    CONSTRAINT chk_storage_tier CHECK (storage_tier IN (
        'STANDARD', 'INFREQUENT_ACCESS', 'GLACIER', 'DEEP_ARCHIVE'
    ))
);

-- Indexes
CREATE INDEX idx_preflight_artifacts_report ON preflight_artifacts(preflight_report_id);
CREATE INDEX idx_preflight_artifacts_type ON preflight_artifacts(artifact_type);
CREATE INDEX idx_preflight_artifacts_lifecycle
    ON preflight_artifacts(storage_tier, created_at)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE preflight_artifacts IS 'REQ-STRATEGIC-AUTO-1767066329942: Blob storage references for preflight artifacts with lifecycle management';
COMMENT ON COLUMN preflight_artifacts.storage_tier IS 'S3 storage tier for cost optimization';

-- =====================================================
-- COLOR PROOFS
-- =====================================================
-- Color accuracy validation and proof approval workflow

CREATE TABLE color_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    job_id UUID NOT NULL,
    preflight_report_id UUID,

    -- Proof generation
    proof_type VARCHAR(50) NOT NULL,
    -- SOFT_PROOF, DIGITAL_PROOF, CONTRACT_PROOF
    proof_file_url TEXT,
    proof_generated_at TIMESTAMPTZ,

    -- Color management settings
    target_icc_profile VARCHAR(255),
    rendering_intent VARCHAR(50),
    -- PERCEPTUAL, RELATIVE_COLORIMETRIC, SATURATION, ABSOLUTE_COLORIMETRIC

    -- Delta E measurements (color accuracy)
    delta_e_measurements JSONB,
    -- [{color_name: 'PANTONE 185 C', target_lab: {...}, actual_lab: {...}, delta_e: 2.3}]
    avg_delta_e NUMERIC(10,4),
    max_delta_e NUMERIC(10,4),

    -- Approval workflow
    status VARCHAR(20) DEFAULT 'pending',
    -- pending, approved, rejected, revision_requested
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejected_by UUID,
    rejected_at TIMESTAMPTZ,
    rejection_notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT fk_color_proofs_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_color_proofs_report FOREIGN KEY (preflight_report_id)
        REFERENCES preflight_reports(id) ON DELETE SET NULL,
    CONSTRAINT chk_proof_type CHECK (proof_type IN (
        'SOFT_PROOF', 'DIGITAL_PROOF', 'CONTRACT_PROOF'
    )),
    CONSTRAINT chk_proof_status CHECK (status IN (
        'pending', 'approved', 'rejected', 'revision_requested'
    )),
    CONSTRAINT chk_rendering_intent CHECK (rendering_intent IN (
        'PERCEPTUAL', 'RELATIVE_COLORIMETRIC', 'SATURATION', 'ABSOLUTE_COLORIMETRIC'
    ) OR rendering_intent IS NULL)
);

-- Indexes
CREATE INDEX idx_color_proofs_tenant ON color_proofs(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_color_proofs_job ON color_proofs(job_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_color_proofs_status ON color_proofs(status) WHERE deleted_at IS NULL;

COMMENT ON TABLE color_proofs IS 'REQ-STRATEGIC-AUTO-1767066329942: Color proof generation and approval workflow';
COMMENT ON COLUMN color_proofs.delta_e_measurements IS 'Color accuracy measurements (ΔE) for proof validation';

-- =====================================================
-- PREFLIGHT AUDIT LOG
-- =====================================================
-- Audit trail for preflight operations

CREATE TABLE preflight_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    preflight_report_id UUID NOT NULL,

    -- Action tracking
    action VARCHAR(50) NOT NULL,
    -- CREATED, VALIDATED, APPROVED, REJECTED, REGENERATED, PROFILE_CHANGED

    -- Actor
    performed_by UUID NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Details
    notes TEXT,
    metadata JSONB,

    -- Constraints
    CONSTRAINT fk_preflight_audit_report FOREIGN KEY (preflight_report_id)
        REFERENCES preflight_reports(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_preflight_audit_report ON preflight_audit_log(preflight_report_id);
CREATE INDEX idx_preflight_audit_performed ON preflight_audit_log(performed_at DESC);

COMMENT ON TABLE preflight_audit_log IS 'REQ-STRATEGIC-AUTO-1767066329942: Audit trail for preflight operations';

-- =====================================================
-- RLS POLICIES
-- =====================================================
-- Row-level security for multi-tenant isolation

ALTER TABLE preflight_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE preflight_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE preflight_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE preflight_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE color_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE preflight_audit_log ENABLE ROW LEVEL SECURITY;

-- Preflight profiles RLS
CREATE POLICY preflight_profiles_tenant_isolation ON preflight_profiles
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Preflight reports RLS
CREATE POLICY preflight_reports_tenant_isolation ON preflight_reports
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Preflight issues RLS (via report)
CREATE POLICY preflight_issues_tenant_isolation ON preflight_issues
    USING (EXISTS (
        SELECT 1 FROM preflight_reports pr
        WHERE pr.id = preflight_issues.preflight_report_id
        AND pr.tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
    ));

-- Preflight artifacts RLS (via report)
CREATE POLICY preflight_artifacts_tenant_isolation ON preflight_artifacts
    USING (EXISTS (
        SELECT 1 FROM preflight_reports pr
        WHERE pr.id = preflight_artifacts.preflight_report_id
        AND pr.tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
    ));

-- Color proofs RLS
CREATE POLICY color_proofs_tenant_isolation ON color_proofs
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Preflight audit log RLS (via report)
CREATE POLICY preflight_audit_log_tenant_isolation ON preflight_audit_log
    USING (EXISTS (
        SELECT 1 FROM preflight_reports pr
        WHERE pr.id = preflight_audit_log.preflight_report_id
        AND pr.tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
    ));

-- =====================================================
-- DEFAULT DATA
-- =====================================================
-- Create default preflight profiles for common PDF/X standards

-- Insert default PDF/X-1a profile
INSERT INTO preflight_profiles (
    tenant_id,
    profile_name,
    profile_type,
    rules,
    is_default,
    description
)
SELECT
    id as tenant_id,
    'PDF/X-1a:2001 (CMYK Offset)' as profile_name,
    'PDF_X_1A' as profile_type,
    jsonb_build_object(
        'pdf_version', jsonb_build_object('required', '1.3', 'max_version', '1.4'),
        'color_space', jsonb_build_object('allowed', jsonb_build_array('CMYK', 'GRAY')),
        'images', jsonb_build_object('min_resolution_dpi', 300, 'max_resolution_dpi', 2400),
        'fonts', jsonb_build_object('must_be_embedded', true),
        'bleed', jsonb_build_object('required', true, 'min_bleed_inches', 0.125),
        'ink_coverage', jsonb_build_object('max_total_coverage_percent', 320)
    ) as rules,
    true as is_default,
    'Industry-standard PDF/X-1a profile for CMYK offset printing' as description
FROM tenants
WHERE deleted_at IS NULL;

-- =====================================================
-- ANALYTICS VIEWS
-- =====================================================

-- Top preflight errors by frequency
CREATE OR REPLACE VIEW vw_preflight_error_frequency AS
SELECT
    pi.error_code,
    pi.severity,
    COUNT(*) as error_count,
    COUNT(DISTINCT pr.tenant_id) as tenant_count,
    MAX(pi.created_at) as last_occurrence,
    jsonb_agg(DISTINCT pi.message) as example_messages
FROM preflight_issues pi
JOIN preflight_reports pr ON pi.preflight_report_id = pr.id
WHERE pi.issue_type = 'ERROR'
  AND pi.created_at > NOW() - INTERVAL '30 days'
  AND pr.deleted_at IS NULL
GROUP BY pi.error_code, pi.severity
ORDER BY error_count DESC;

COMMENT ON VIEW vw_preflight_error_frequency IS 'REQ-STRATEGIC-AUTO-1767066329942: Top preflight errors by frequency (last 30 days)';

-- Preflight pass/fail rates by tenant
CREATE OR REPLACE VIEW vw_preflight_pass_rates AS
SELECT
    tenant_id,
    COUNT(*) as total_reports,
    COUNT(*) FILTER (WHERE status = 'PASS') as passed,
    COUNT(*) FILTER (WHERE status = 'PASS_WITH_WARNINGS') as passed_with_warnings,
    COUNT(*) FILTER (WHERE status = 'FAIL') as failed,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'PASS') / NULLIF(COUNT(*), 0), 2) as pass_rate_percent,
    AVG(processing_time_ms) as avg_processing_time_ms
FROM preflight_reports
WHERE deleted_at IS NULL
  AND created_at > NOW() - INTERVAL '30 days'
  AND status IN ('PASS', 'PASS_WITH_WARNINGS', 'FAIL')
GROUP BY tenant_id;

COMMENT ON VIEW vw_preflight_pass_rates IS 'REQ-STRATEGIC-AUTO-1767066329942: Preflight pass/fail rates by tenant (last 30 days)';
