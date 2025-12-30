-- =====================================================
-- FLYWAY MIGRATION V0.0.43
-- =====================================================
-- Purpose: Create Customer Portal & Self-Service Ordering Infrastructure
-- REQ: REQ-STRATEGIC-AUTO-1767048328659
-- Tables: customer_users, refresh_tokens, artwork_files, proofs, customer_activity_log
-- Dependencies: V0.0.6 (customers table), V0.0.2 (users table)
-- Created: 2025-12-29
-- Research: CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328659.md
-- Critique: SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328659.md
-- =====================================================

-- ============================================
-- TABLE: customer_users
-- ============================================
-- Purpose: Customer portal user accounts (separate from internal users)
-- Security: Multi-factor authentication, password hashing, account lockout
-- Realm: CUSTOMER (external users)

CREATE TABLE customer_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    customer_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    -- Authentication
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    -- bcrypt hash with salt rounds >= 10

    sso_provider VARCHAR(50),
    -- GOOGLE, MICROSOFT (SSO integration for enterprise customers)
    sso_user_id VARCHAR(255),

    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),

    -- MFA (Multi-Factor Authentication)
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    -- TOTP secret for authenticator apps
    mfa_backup_codes JSONB,
    -- Array of backup codes for account recovery

    -- Customer-specific roles
    role VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER_USER',
    -- CUSTOMER_ADMIN: Can manage other customer users, approve quotes/orders
    -- CUSTOMER_USER: Can view orders and request quotes
    -- APPROVER: Can approve quotes and orders (workflow approval)

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMPTZ,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,

    -- Security (account lockout after failed attempts)
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    last_login_ip VARCHAR(50),
    password_changed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Preferences
    preferred_language VARCHAR(10) DEFAULT 'en-US',
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false}'::JSONB,

    -- GDPR compliance
    marketing_consent BOOLEAN DEFAULT FALSE,
    marketing_consent_date TIMESTAMPTZ,
    marketing_consent_ip VARCHAR(50),
    data_retention_consent BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    -- Internal user who created this customer user
    deleted_at TIMESTAMPTZ,
    -- Soft delete for GDPR compliance

    UNIQUE(customer_id, email),
    CONSTRAINT fk_customer_users_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_customer_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT chk_customer_users_sso CHECK (
        (password_hash IS NOT NULL AND sso_provider IS NULL) OR
        (password_hash IS NULL AND sso_provider IS NOT NULL)
    ),
    CONSTRAINT chk_customer_users_role CHECK (role IN ('CUSTOMER_ADMIN', 'CUSTOMER_USER', 'APPROVER'))
);

-- Indexes for fast lookups
CREATE INDEX idx_customer_users_email ON customer_users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_customer_users_customer_id ON customer_users(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customer_users_tenant_id ON customer_users(tenant_id);
CREATE INDEX idx_customer_users_verification_token ON customer_users(email_verification_token) WHERE email_verification_token IS NOT NULL;
CREATE INDEX idx_customer_users_reset_token ON customer_users(password_reset_token) WHERE password_reset_token IS NOT NULL;
CREATE INDEX idx_customer_users_sso ON customer_users(sso_provider, sso_user_id) WHERE sso_provider IS NOT NULL;

-- Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE customer_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_users_tenant_isolation ON customer_users
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON TABLE customer_users IS 'Customer portal user accounts (separate authentication realm from internal users)';
COMMENT ON COLUMN customer_users.password_hash IS 'bcrypt hash with salt rounds >= 10';
COMMENT ON COLUMN customer_users.mfa_enabled IS 'Multi-factor authentication enabled (TOTP via authenticator app)';
COMMENT ON COLUMN customer_users.role IS 'CUSTOMER_ADMIN, CUSTOMER_USER, or APPROVER';
COMMENT ON COLUMN customer_users.failed_login_attempts IS 'Account locked after 5 failed attempts (security best practice)';

-- ============================================
-- TABLE: refresh_tokens
-- ============================================
-- Purpose: JWT refresh token storage for secure token rotation
-- Strategy: Short-lived access tokens (30min) + long-lived refresh tokens (14 days)
-- Security: Tokens are hashed before storage, revocable on logout

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    user_id UUID,
    -- Internal user (employees)
    customer_user_id UUID,
    -- Customer portal user
    tenant_id UUID NOT NULL,

    -- Token security
    token_hash VARCHAR(255) NOT NULL,
    -- bcrypt hash of refresh token (prevents token theft from database)

    -- Session metadata
    user_agent TEXT,
    ip_address VARCHAR(50),
    device_fingerprint VARCHAR(255),

    -- Token lifecycle
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    -- Set on logout or security event
    revoked_reason VARCHAR(100),
    -- PASSWORD_CHANGE, MANUAL_LOGOUT, SECURITY_BREACH, ADMIN_REVOKE

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one user type per token
    CHECK (
        (user_id IS NOT NULL AND customer_user_id IS NULL) OR
        (user_id IS NULL AND customer_user_id IS NOT NULL)
    ),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_customer_user FOREIGN KEY (customer_user_id) REFERENCES customer_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Indexes
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_refresh_tokens_customer_user_id ON refresh_tokens(customer_user_id) WHERE customer_user_id IS NOT NULL;
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_tenant_id ON refresh_tokens(tenant_id);

-- RLS Policy
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY refresh_tokens_tenant_isolation ON refresh_tokens
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for secure token rotation (access token 30min, refresh token 14 days)';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'bcrypt hash of refresh token (not stored in plaintext)';

-- ============================================
-- TABLE: artwork_files
-- ============================================
-- Purpose: Customer-uploaded artwork for quotes and orders
-- Storage: AWS S3 or Azure Blob Storage (presigned URLs)
-- Security: Virus scanning required before marking CLEAN

CREATE TABLE artwork_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    uploaded_by_customer_user_id UUID,

    -- Linked to order or quote (one or the other, not both)
    sales_order_id UUID,
    quote_id UUID,

    -- File metadata
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    -- pdf, jpg, jpeg, png, ai, eps, psd, tif, tiff
    storage_url TEXT NOT NULL,
    -- S3/Azure presigned URL

    -- Content validation
    mime_type VARCHAR(100),
    file_hash VARCHAR(64),
    -- SHA-256 hash for integrity verification

    -- Security: Virus scanning
    virus_scan_status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, SCANNING, CLEAN, INFECTED, SCAN_FAILED
    virus_scan_at TIMESTAMPTZ,
    virus_scan_result TEXT,
    -- Details from ClamAV or VirusTotal

    -- Lifecycle
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    -- Auto-delete after 90 days (S3 lifecycle policy)
    deleted_at TIMESTAMPTZ,

    -- Ensure one link (order OR quote)
    CHECK (
        (sales_order_id IS NOT NULL AND quote_id IS NULL) OR
        (sales_order_id IS NULL AND quote_id IS NOT NULL)
    ),
    CONSTRAINT fk_artwork_files_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_artwork_files_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_artwork_files_customer_user FOREIGN KEY (uploaded_by_customer_user_id) REFERENCES customer_users(id),
    CONSTRAINT fk_artwork_files_sales_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_artwork_files_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    CONSTRAINT chk_artwork_files_virus_status CHECK (virus_scan_status IN ('PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'SCAN_FAILED'))
);

-- Indexes
CREATE INDEX idx_artwork_files_customer_id ON artwork_files(customer_id);
CREATE INDEX idx_artwork_files_sales_order_id ON artwork_files(sales_order_id);
CREATE INDEX idx_artwork_files_quote_id ON artwork_files(quote_id);
CREATE INDEX idx_artwork_files_virus_status ON artwork_files(virus_scan_status);
CREATE INDEX idx_artwork_files_tenant_id ON artwork_files(tenant_id);

-- RLS Policy
ALTER TABLE artwork_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY artwork_files_tenant_isolation ON artwork_files
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON TABLE artwork_files IS 'Customer-uploaded artwork for quotes and orders (stored in S3/Azure with virus scanning)';
COMMENT ON COLUMN artwork_files.virus_scan_status IS 'PENDING → SCANNING → CLEAN/INFECTED (ClamAV or VirusTotal)';

-- ============================================
-- TABLE: proofs
-- ============================================
-- Purpose: Digital proof approval workflow for customer review
-- Flow: Internal user uploads proof → Customer reviews → APPROVED/REVISION_REQUESTED

CREATE TABLE proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    sales_order_id UUID NOT NULL,
    sales_order_line_number INTEGER NOT NULL,

    -- Proof details
    proof_url TEXT NOT NULL,
    -- S3/Azure URL to PDF or image
    version INTEGER NOT NULL DEFAULT 1,
    -- Increments with each revision
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
    -- PENDING_REVIEW, APPROVED, REVISION_REQUESTED, SUPERSEDED

    -- Customer action
    reviewed_by_customer_user_id UUID,
    reviewed_at TIMESTAMPTZ,
    customer_comments TEXT,
    approval_signature TEXT,
    -- Digital signature or IP address for audit

    -- Internal action (if revision requested)
    revision_notes TEXT,
    -- Customer feedback for prepress team
    revision_completed_by UUID,
    -- Internal user who uploaded revised proof
    revision_completed_at TIMESTAMPTZ,

    -- Notifications
    notification_sent_at TIMESTAMPTZ,
    notification_opened_at TIMESTAMPTZ,
    -- Email tracking

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    -- Internal user who uploaded proof

    CONSTRAINT fk_proofs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_proofs_sales_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_proofs_sales_order_line FOREIGN KEY (sales_order_id, sales_order_line_number) REFERENCES sales_order_lines(sales_order_id, line_number),
    CONSTRAINT fk_proofs_customer_user FOREIGN KEY (reviewed_by_customer_user_id) REFERENCES customer_users(id),
    CONSTRAINT fk_proofs_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_proofs_revision_by FOREIGN KEY (revision_completed_by) REFERENCES users(id),
    CONSTRAINT chk_proofs_status CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'SUPERSEDED'))
);

-- Indexes
CREATE INDEX idx_proofs_sales_order_id ON proofs(sales_order_id);
CREATE INDEX idx_proofs_status ON proofs(status);
CREATE INDEX idx_proofs_customer_user_id ON proofs(reviewed_by_customer_user_id);
CREATE INDEX idx_proofs_version ON proofs(sales_order_id, version);
CREATE INDEX idx_proofs_tenant_id ON proofs(tenant_id);

-- RLS Policy
ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY proofs_tenant_isolation ON proofs
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON TABLE proofs IS 'Digital proof approval workflow for customer review';
COMMENT ON COLUMN proofs.status IS 'PENDING_REVIEW → APPROVED or REVISION_REQUESTED → SUPERSEDED (new version)';

-- ============================================
-- TABLE: customer_activity_log
-- ============================================
-- Purpose: Audit log for customer portal activity (security, compliance, analytics)
-- Use Cases: Security monitoring, customer behavior analytics, GDPR compliance

CREATE TABLE customer_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    customer_user_id UUID NOT NULL,

    -- Activity classification
    activity_type VARCHAR(50) NOT NULL,
    -- LOGIN, LOGOUT, LOGIN_FAILED, VIEW_ORDER, VIEW_QUOTE, APPROVE_QUOTE, REJECT_QUOTE,
    -- REQUEST_QUOTE, UPLOAD_ARTWORK, APPROVE_PROOF, REQUEST_REVISION, DOWNLOAD_INVOICE,
    -- PASSWORD_CHANGE, MFA_ENROLL, MFA_DISABLE, PROFILE_UPDATE, etc.

    -- Context
    sales_order_id UUID,
    quote_id UUID,
    proof_id UUID,

    -- Session metadata
    ip_address VARCHAR(50),
    user_agent TEXT,
    session_id VARCHAR(255),
    geolocation JSONB,
    -- {"city": "Toronto", "country": "CA", "lat": 43.65, "lon": -79.38}

    -- Activity-specific data (flexible JSON)
    metadata JSONB,
    -- Example: {"quote_number": "Q-2025-001", "amount": 5000.00, "reason": "Price too high"}

    -- Security flags
    is_suspicious BOOLEAN DEFAULT FALSE,
    -- Flagged by anomaly detection
    security_notes TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_customer_activity_log_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_customer_activity_log_user FOREIGN KEY (customer_user_id) REFERENCES customer_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_activity_log_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_customer_activity_log_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL,
    CONSTRAINT fk_customer_activity_log_proof FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE SET NULL
);

-- Indexes (high-traffic table, optimize for time-series queries)
CREATE INDEX idx_customer_activity_log_user_id ON customer_activity_log(customer_user_id);
CREATE INDEX idx_customer_activity_log_created_at ON customer_activity_log(created_at DESC);
CREATE INDEX idx_customer_activity_log_activity_type ON customer_activity_log(activity_type);
CREATE INDEX idx_customer_activity_log_tenant_id ON customer_activity_log(tenant_id);
CREATE INDEX idx_customer_activity_log_ip_address ON customer_activity_log(ip_address);
CREATE INDEX idx_customer_activity_log_suspicious ON customer_activity_log(is_suspicious) WHERE is_suspicious = TRUE;

-- RLS Policy
ALTER TABLE customer_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_activity_log_tenant_isolation ON customer_activity_log
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON TABLE customer_activity_log IS 'Audit log for customer portal activity (security, compliance, analytics)';
COMMENT ON COLUMN customer_activity_log.is_suspicious IS 'Flagged by anomaly detection (unusual IP, rapid requests, etc.)';

-- ============================================
-- Enhance existing tables for customer portal
-- ============================================

-- Add customer portal tracking to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS submitted_by_customer_user_id UUID REFERENCES customer_users(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_po_number VARCHAR(100);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_requested_delivery_date DATE;

-- Add customer portal tracking to sales_orders table
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS placed_by_customer_user_id UUID REFERENCES customer_users(id);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS portal_order BOOLEAN DEFAULT FALSE;

-- Add portal enablement to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_welcome_email_sent_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_enabled_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_disabled_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN quotes.submitted_by_customer_user_id IS 'Customer portal user who submitted the quote request';
COMMENT ON COLUMN sales_orders.placed_by_customer_user_id IS 'Customer portal user who placed the order';
COMMENT ON COLUMN customers.portal_enabled IS 'Whether this customer has access to the self-service portal';

-- ============================================
-- Cleanup Functions
-- ============================================

-- Function: Cleanup expired tokens and unverified accounts
CREATE OR REPLACE FUNCTION cleanup_expired_customer_portal_data() RETURNS void AS $$
BEGIN
    -- Delete expired refresh tokens
    DELETE FROM refresh_tokens WHERE expires_at < NOW();

    -- Delete unverified customer users after 7 days
    DELETE FROM customer_users
    WHERE is_email_verified = FALSE
      AND created_at < NOW() - INTERVAL '7 days'
      AND email_verification_expires < NOW();

    -- Delete expired password reset tokens
    UPDATE customer_users
    SET password_reset_token = NULL, password_reset_expires = NULL
    WHERE password_reset_expires < NOW();

    -- Log cleanup activity
    RAISE NOTICE 'Customer portal cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_customer_portal_data IS 'Cleanup expired tokens and unverified accounts (run daily via cron)';

-- Function: Lock customer account after failed login attempts
CREATE OR REPLACE FUNCTION lock_customer_account_on_failed_login() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.failed_login_attempts >= 5 THEN
        NEW.account_locked_until := NOW() + INTERVAL '30 minutes';
        NEW.is_active := FALSE;

        -- Log security event
        INSERT INTO customer_activity_log (
            tenant_id, customer_user_id, activity_type, ip_address, metadata, is_suspicious
        ) VALUES (
            NEW.tenant_id, NEW.id, 'ACCOUNT_LOCKED', NEW.last_login_ip,
            jsonb_build_object('failed_attempts', NEW.failed_login_attempts),
            TRUE
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-lock account after 5 failed login attempts
CREATE TRIGGER trg_lock_customer_account_on_failed_login
    BEFORE UPDATE ON customer_users
    FOR EACH ROW
    WHEN (NEW.failed_login_attempts >= 5 AND OLD.failed_login_attempts < 5)
    EXECUTE FUNCTION lock_customer_account_on_failed_login();

COMMENT ON FUNCTION lock_customer_account_on_failed_login IS 'Auto-lock customer account after 5 failed login attempts (30-minute lockout)';

-- ============================================
-- Initial Data: Sample customer portal configuration
-- ============================================

-- Note: Actual customer portal users will be created via registration API
-- This migration only creates the infrastructure

-- ============================================
-- End of Migration V0.0.43
-- ============================================
