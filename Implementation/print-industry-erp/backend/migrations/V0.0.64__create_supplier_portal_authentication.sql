-- ============================================
-- Migration: V0.0.64 - Supplier Portal Authentication
-- Description: Create supplier user authentication and activity logging tables
-- Feature: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
-- Author: Roy (Backend Specialist)
-- Date: 2025-12-30
-- ============================================

-- ============================================
-- TABLE: supplier_users
-- ============================================
-- Purpose: Supplier portal user accounts (separate authentication realm from internal/customer users)
-- Pattern: Mirror customer_users table structure for consistency
-- Security: Separate realm with vendor-specific roles and RLS policies

CREATE TABLE supplier_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  vendor_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Authentication
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),        -- bcrypt with salt rounds >= 10
  sso_provider VARCHAR(50),          -- GOOGLE, MICROSOFT (for enterprise suppliers)
  sso_user_id VARCHAR(255),

  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(50),
  job_title VARCHAR(100),            -- Purchasing Manager, Logistics Coordinator, etc.

  -- MFA (Multi-Factor Authentication)
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),           -- TOTP secret for authenticator apps
  mfa_backup_codes JSONB,            -- Encrypted backup codes array

  -- Supplier-specific roles
  role VARCHAR(50) NOT NULL DEFAULT 'VENDOR_USER',
  -- VENDOR_ADMIN: Can manage other vendor users, view all POs
  -- VENDOR_USER: Can view assigned POs, create ASNs
  -- VENDOR_VIEWER: Read-only access to performance data

  -- Account status
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

  -- User preferences
  preferred_language VARCHAR(10) DEFAULT 'en-US',
  timezone VARCHAR(100) DEFAULT 'America/New_York',
  notification_preferences JSONB DEFAULT '{"email": true, "sms": false}'::JSONB,

  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,                   -- Internal user who created this supplier user
  deleted_at TIMESTAMPTZ,            -- Soft delete

  UNIQUE(vendor_id, email),
  CONSTRAINT fk_supplier_users_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
  CONSTRAINT fk_supplier_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT chk_supplier_users_role CHECK (role IN ('VENDOR_ADMIN', 'VENDOR_USER', 'VENDOR_VIEWER'))
);

-- Indexes for performance
CREATE INDEX idx_supplier_users_email ON supplier_users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_users_vendor_id ON supplier_users(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_users_tenant_id ON supplier_users(tenant_id);
CREATE INDEX idx_supplier_users_email_verification ON supplier_users(email_verification_token) WHERE email_verification_token IS NOT NULL;
CREATE INDEX idx_supplier_users_password_reset ON supplier_users(password_reset_token) WHERE password_reset_token IS NOT NULL;

-- RLS (Row-Level Security) for multi-tenant isolation
ALTER TABLE supplier_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_users_tenant_isolation ON supplier_users
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================
-- TABLE: supplier_refresh_tokens
-- ============================================
-- Purpose: Store refresh tokens for supplier JWT authentication
-- Security: Tokens are hashed (bcrypt), not stored in plaintext

CREATE TABLE supplier_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  supplier_user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Token security
  token_hash VARCHAR(255) NOT NULL,  -- bcrypt hash (not plaintext)
  expires_at TIMESTAMPTZ NOT NULL,   -- 14 days from creation
  revoked_at TIMESTAMPTZ,
  revoked_reason VARCHAR(100),       -- PASSWORD_CHANGE, MANUAL_LOGOUT, SUSPICIOUS_ACTIVITY, etc.

  -- Session context
  ip_address VARCHAR(50),
  user_agent TEXT,

  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_supplier_refresh_tokens_user FOREIGN KEY (supplier_user_id) REFERENCES supplier_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_supplier_refresh_tokens_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Indexes
CREATE INDEX idx_supplier_refresh_tokens_user ON supplier_refresh_tokens(supplier_user_id);
CREATE INDEX idx_supplier_refresh_tokens_expires ON supplier_refresh_tokens(expires_at);
CREATE INDEX idx_supplier_refresh_tokens_token_hash ON supplier_refresh_tokens(token_hash) WHERE revoked_at IS NULL;

-- RLS
ALTER TABLE supplier_refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_refresh_tokens_tenant_isolation ON supplier_refresh_tokens
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================
-- TABLE: supplier_activity_log
-- ============================================
-- Purpose: Comprehensive audit trail for all supplier portal actions
-- Compliance: Supports security audits and compliance requirements

CREATE TABLE supplier_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  supplier_user_id UUID,

  -- Activity details
  activity_type VARCHAR(50) NOT NULL,
  -- LOGIN, LOGOUT, LOGIN_FAILED, VIEW_PO, ACKNOWLEDGE_PO, CREATE_ASN,
  -- UPLOAD_DOCUMENT, VIEW_PERFORMANCE, UPDATE_PROFILE, etc.
  activity_details JSONB,

  -- Session context
  ip_address VARCHAR(50),
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_supplier_activity_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_supplier_activity_user FOREIGN KEY (supplier_user_id) REFERENCES supplier_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_supplier_activity_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Indexes for audit queries
CREATE INDEX idx_supplier_activity_vendor ON supplier_activity_log(vendor_id);
CREATE INDEX idx_supplier_activity_user ON supplier_activity_log(supplier_user_id);
CREATE INDEX idx_supplier_activity_created ON supplier_activity_log(created_at DESC);
CREATE INDEX idx_supplier_activity_type ON supplier_activity_log(activity_type);
CREATE INDEX idx_supplier_activity_tenant ON supplier_activity_log(tenant_id);

-- RLS
ALTER TABLE supplier_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_activity_log_tenant_isolation ON supplier_activity_log
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================
-- TABLE: supplier_documents
-- ============================================
-- Purpose: Store supplier-uploaded documents (packing slips, invoices, certificates, etc.)
-- Integration: Links to S3/Azure Blob Storage

CREATE TABLE supplier_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  supplier_user_id UUID NOT NULL,

  -- Document classification
  document_type VARCHAR(50) NOT NULL,
  -- PACKING_SLIP, BILL_OF_LADING, INVOICE, CERTIFICATE, ISO_CERT, FDA_CERT,
  -- FSC_CERT, SDS (Safety Data Sheet), OTHER
  document_category VARCHAR(50),     -- COMPLIANCE, SHIPPING, FINANCIAL, QUALITY

  -- Document metadata
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),
  storage_url TEXT NOT NULL,         -- S3/Azure Blob URL
  storage_bucket VARCHAR(255),
  storage_key VARCHAR(500),

  -- Business context
  purchase_order_id UUID,
  shipment_id UUID,
  asn_id UUID,

  -- Document details
  title VARCHAR(255),
  description TEXT,
  document_number VARCHAR(100),      -- Invoice number, BOL number, etc.
  document_date DATE,
  expiration_date DATE,              -- For certificates

  -- Security
  virus_scan_status VARCHAR(20) DEFAULT 'PENDING',
  -- PENDING, SCANNING, CLEAN, INFECTED, SCAN_ERROR
  virus_scan_at TIMESTAMPTZ,

  -- Audit trail
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT fk_supplier_documents_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_supplier_documents_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_supplier_documents_user FOREIGN KEY (supplier_user_id) REFERENCES supplier_users(id),
  CONSTRAINT fk_supplier_documents_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT chk_supplier_documents_virus_scan CHECK (virus_scan_status IN ('PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'SCAN_ERROR'))
);

-- Indexes
CREATE INDEX idx_supplier_documents_vendor ON supplier_documents(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_documents_user ON supplier_documents(supplier_user_id);
CREATE INDEX idx_supplier_documents_type ON supplier_documents(document_type);
CREATE INDEX idx_supplier_documents_po ON supplier_documents(purchase_order_id);
CREATE INDEX idx_supplier_documents_uploaded ON supplier_documents(uploaded_at DESC);
CREATE INDEX idx_supplier_documents_expiration ON supplier_documents(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX idx_supplier_documents_virus_scan ON supplier_documents(virus_scan_status);

-- RLS
ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_documents_tenant_isolation ON supplier_documents
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE supplier_users IS 'Supplier portal user accounts with authentication and MFA support';
COMMENT ON COLUMN supplier_users.role IS 'VENDOR_ADMIN: Full access, VENDOR_USER: Standard access, VENDOR_VIEWER: Read-only';
COMMENT ON COLUMN supplier_users.mfa_secret IS 'TOTP secret for 2FA authenticator apps';
COMMENT ON COLUMN supplier_users.failed_login_attempts IS 'Account locks after 5 failed attempts';

COMMENT ON TABLE supplier_refresh_tokens IS 'JWT refresh tokens for supplier authentication (14-day expiration)';
COMMENT ON COLUMN supplier_refresh_tokens.token_hash IS 'bcrypt hash of refresh token (not plaintext)';

COMMENT ON TABLE supplier_activity_log IS 'Comprehensive audit trail for all supplier portal activities';
COMMENT ON COLUMN supplier_activity_log.activity_type IS 'Type of activity performed (LOGIN, VIEW_PO, CREATE_ASN, etc.)';

COMMENT ON TABLE supplier_documents IS 'Supplier-uploaded documents with virus scanning and expiration tracking';
COMMENT ON COLUMN supplier_documents.virus_scan_status IS 'Document virus scan status (ClamAV integration)';
