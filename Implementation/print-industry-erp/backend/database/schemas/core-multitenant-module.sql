-- =====================================================
-- CORE MULTI-TENANT MODULE
-- =====================================================
-- Purpose: Foundation tables for multi-tenant SaaS architecture
-- Tables: 5 (tenants, billing_entities, facilities, users, currencies)
-- Created: 2025-12-16
-- Author: Roy (Backend Architect)
-- =====================================================

-- =====================================================
-- TABLE: tenants
-- =====================================================
-- Purpose: Multi-tenant isolation - each customer gets their own tenant
-- SCD Type 2: Full history tracking with effective dating

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),

    -- Tenant identification
    tenant_code VARCHAR(50) UNIQUE NOT NULL,
    tenant_name VARCHAR(255) NOT NULL,
    legal_entity_name VARCHAR(255),

    -- Subscription tier (feature flags)
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'STARTER',
    -- STARTER: Basic features
    -- PROFESSIONAL: Advanced manufacturing features
    -- ENTERPRISE: Full feature set + multi-region

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    -- ACTIVE, SUSPENDED, TRIAL, CANCELLED

    -- Contact information
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),

    -- Address
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(100),

    -- Tax information
    tax_id VARCHAR(100),
    tax_exempt BOOLEAN DEFAULT FALSE,

    -- Configuration
    default_currency_code VARCHAR(3) DEFAULT 'USD',
    default_timezone VARCHAR(100) DEFAULT 'America/New_York',
    default_language VARCHAR(10) DEFAULT 'en-US',

    -- Feature flags (JSONB for flexibility)
    enabled_features JSONB DEFAULT '[]'::JSONB,
    custom_configuration JSONB DEFAULT '{}'::JSONB,

    -- Usage tracking
    user_limit INTEGER,
    facility_limit INTEGER,
    storage_limit_gb INTEGER,

    -- SCD Type 2 temporal tracking
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    is_current BOOLEAN DEFAULT TRUE,
    version_number INTEGER DEFAULT 1,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT chk_tenant_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED')),
    CONSTRAINT chk_tenant_tier CHECK (subscription_tier IN ('STARTER', 'PROFESSIONAL', 'ENTERPRISE'))
);

CREATE INDEX idx_tenants_code ON tenants(tenant_code);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_tier ON tenants(subscription_tier);
CREATE INDEX idx_tenants_current ON tenants(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_tenants_effective ON tenants(effective_from, effective_to);

COMMENT ON TABLE tenants IS 'Core multi-tenant table - isolates customer data with SCD Type 2 history';
COMMENT ON COLUMN tenants.subscription_tier IS 'STARTER/PROFESSIONAL/ENTERPRISE - controls feature access';
COMMENT ON COLUMN tenants.enabled_features IS 'JSON array of feature flags for granular control';

-- =====================================================
-- TABLE: billing_entities
-- =====================================================
-- Purpose: Separate billing entities for complex organizations
-- Relationship: 1 tenant can have many billing entities

CREATE TABLE billing_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Billing entity identification
    entity_code VARCHAR(50) NOT NULL,
    entity_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),

    -- Contact
    billing_contact_name VARCHAR(255),
    billing_contact_email VARCHAR(255) NOT NULL,
    billing_contact_phone VARCHAR(50),

    -- Billing address
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL,

    -- Tax information
    tax_id VARCHAR(100),
    vat_number VARCHAR(100),
    tax_exempt BOOLEAN DEFAULT FALSE,
    tax_exemption_certificate TEXT,

    -- Payment terms
    payment_terms VARCHAR(50) DEFAULT 'NET_30',
    -- NET_30, NET_60, 2/10_NET_30, etc.
    credit_limit DECIMAL(18,2),

    -- Currency
    billing_currency_code VARCHAR(3) DEFAULT 'USD',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_billing_entity_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_billing_entity_code UNIQUE (tenant_id, entity_code)
);

CREATE INDEX idx_billing_entities_tenant ON billing_entities(tenant_id);
CREATE INDEX idx_billing_entities_code ON billing_entities(entity_code);
CREATE INDEX idx_billing_entities_active ON billing_entities(is_active);

COMMENT ON TABLE billing_entities IS 'Separate billing entities for complex multi-entity organizations';
COMMENT ON COLUMN billing_entities.payment_terms IS 'Payment terms: NET_30, NET_60, 2/10_NET_30, etc.';

-- =====================================================
-- TABLE: facilities
-- =====================================================
-- Purpose: Physical locations (warehouses, manufacturing plants, sales offices)
-- Relationship: 1 tenant can have many facilities

CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Facility identification
    facility_code VARCHAR(50) NOT NULL,
    facility_name VARCHAR(255) NOT NULL,
    facility_type VARCHAR(50) NOT NULL,
    -- WAREHOUSE, MANUFACTURING, SALES_OFFICE, DISTRIBUTION_CENTER, 3PL_WAREHOUSE

    -- Contact
    manager_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),

    -- Address
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL,

    -- Geographic coordinates (for logistics)
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),

    -- Facility capabilities
    is_warehouse BOOLEAN DEFAULT FALSE,
    is_manufacturing BOOLEAN DEFAULT FALSE,
    is_sales_office BOOLEAN DEFAULT FALSE,

    -- Warehouse specific
    total_square_feet DECIMAL(12,2),
    usable_square_feet DECIMAL(12,2),
    dock_doors_count INTEGER,

    -- Manufacturing specific
    production_capacity JSONB,
    -- {daily_units: 10000, equipment_count: 5, shifts: 3}

    -- Operating hours
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    operating_hours JSONB,
    -- {monday: {open: '08:00', close: '17:00'}, ...}

    -- Multi-region deployment
    deployment_region VARCHAR(50),
    -- US_EAST, EU_CENTRAL, APAC

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    opened_date DATE,
    closed_date DATE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_facility_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_facility_code UNIQUE (tenant_id, facility_code),
    CONSTRAINT chk_facility_type CHECK (facility_type IN ('WAREHOUSE', 'MANUFACTURING', 'SALES_OFFICE', 'DISTRIBUTION_CENTER', '3PL_WAREHOUSE'))
);

CREATE INDEX idx_facilities_tenant ON facilities(tenant_id);
CREATE INDEX idx_facilities_code ON facilities(facility_code);
CREATE INDEX idx_facilities_type ON facilities(facility_type);
CREATE INDEX idx_facilities_active ON facilities(is_active);
CREATE INDEX idx_facilities_region ON facilities(deployment_region);
CREATE INDEX idx_facilities_coordinates ON facilities(latitude, longitude);

COMMENT ON TABLE facilities IS 'Physical locations: warehouses, manufacturing plants, sales offices';
COMMENT ON COLUMN facilities.facility_type IS 'WAREHOUSE, MANUFACTURING, SALES_OFFICE, DISTRIBUTION_CENTER, 3PL_WAREHOUSE';
COMMENT ON COLUMN facilities.deployment_region IS 'Multi-region: US_EAST, EU_CENTRAL, APAC';

-- =====================================================
-- TABLE: users
-- =====================================================
-- Purpose: User accounts with role-based access control
-- Relationship: 1 tenant can have many users

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- User identification
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,

    -- Authentication
    password_hash VARCHAR(255),
    -- NULL if using SSO (OAuth, SAML)

    sso_provider VARCHAR(50),
    -- GOOGLE, MICROSOFT, OKTA, etc.
    sso_user_id VARCHAR(255),

    -- MFA
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),

    -- Biometric (for vault access)
    biometric_enrolled BOOLEAN DEFAULT FALSE,
    biometric_fingerprint_hash VARCHAR(255),

    -- Personal information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(255),

    -- Contact
    phone VARCHAR(50),
    mobile VARCHAR(50),

    -- Employee linkage
    employee_id UUID,
    -- Links to employees table if user is an employee

    -- Default facility
    default_facility_id UUID,

    -- Preferences
    preferred_language VARCHAR(10) DEFAULT 'en-US',
    preferred_timezone VARCHAR(100) DEFAULT 'America/New_York',
    preferred_currency_code VARCHAR(3) DEFAULT 'USD',
    ui_theme VARCHAR(20) DEFAULT 'LIGHT',
    -- LIGHT, DARK

    -- Role-based access control
    roles JSONB DEFAULT '[]'::JSONB,
    -- ['ADMIN', 'CSR', 'PRODUCTION_MANAGER', 'WAREHOUSE_MANAGER', etc.]

    permissions JSONB DEFAULT '[]'::JSONB,
    -- Granular permissions if needed

    -- Security clearance (for 5-tier security zones)
    security_clearance_level VARCHAR(20),
    -- STANDARD, RESTRICTED, SECURE, HIGH_SECURITY, VAULT

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    failed_login_attempts INTEGER DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    password_expires_at TIMESTAMPTZ,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_user_default_facility FOREIGN KEY (default_facility_id) REFERENCES facilities(id),
    CONSTRAINT chk_user_clearance CHECK (security_clearance_level IN ('STANDARD', 'RESTRICTED', 'SECURE', 'HIGH_SECURITY', 'VAULT'))
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_clearance ON users(security_clearance_level);
CREATE INDEX idx_users_roles ON users USING GIN(roles);

COMMENT ON TABLE users IS 'User accounts with RBAC, MFA, biometric support for 5-tier security';
COMMENT ON COLUMN users.security_clearance_level IS '5-tier: STANDARD, RESTRICTED, SECURE, HIGH_SECURITY, VAULT';
COMMENT ON COLUMN users.roles IS 'JSON array of roles: ADMIN, CSR, PRODUCTION_MANAGER, etc.';

-- =====================================================
-- TABLE: currencies
-- =====================================================
-- Purpose: Multi-currency support with exchange rates
-- Relationship: 1 tenant can use many currencies

CREATE TABLE currencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),

    -- Currency identification
    currency_code VARCHAR(3) UNIQUE NOT NULL,
    -- USD, CAD, MXN, EUR, THB, etc.

    currency_name VARCHAR(100) NOT NULL,
    currency_symbol VARCHAR(10),

    -- Display formatting
    decimal_places INTEGER DEFAULT 2,
    thousands_separator VARCHAR(5) DEFAULT ',',
    decimal_separator VARCHAR(5) DEFAULT '.',
    symbol_position VARCHAR(10) DEFAULT 'BEFORE',
    -- BEFORE, AFTER

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_currencies_code ON currencies(currency_code);
CREATE INDEX idx_currencies_active ON currencies(is_active);

COMMENT ON TABLE currencies IS 'Currency master data for multi-currency support';
COMMENT ON COLUMN currencies.currency_code IS 'ISO 4217 currency code: USD, EUR, CAD, etc.';

-- =====================================================
-- INITIAL DATA: Standard currencies
-- =====================================================

INSERT INTO currencies (currency_code, currency_name, currency_symbol, decimal_places) VALUES
('USD', 'US Dollar', '$', 2),
('CAD', 'Canadian Dollar', 'CA$', 2),
('MXN', 'Mexican Peso', 'MX$', 2),
('EUR', 'Euro', '€', 2),
('GBP', 'British Pound', '£', 2),
('THB', 'Thai Baht', '฿', 2),
('CNY', 'Chinese Yuan', '¥', 2),
('JPY', 'Japanese Yen', '¥', 0)
ON CONFLICT (currency_code) DO NOTHING;
