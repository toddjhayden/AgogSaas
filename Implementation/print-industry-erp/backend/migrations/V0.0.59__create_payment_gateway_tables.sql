--
-- PAYMENT GATEWAY INTEGRATION - STRIPE & ACH
-- REQ-STRATEGIC-AUTO-1767084329261
-- Date: 2025-12-30
-- Author: Roy (Backend Developer)
--
-- This migration creates all tables required for payment gateway integration
-- including the CRITICAL payment_applications table that existing code depends on.
--

-- =============================================================================
-- TABLE 1: PAYMENT_APPLICATIONS (CRITICAL - Code already depends on this!)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    payment_id UUID NOT NULL,
    invoice_id UUID NOT NULL,

    -- Application Details
    amount_applied DECIMAL(18,4) NOT NULL,
    applied_date DATE NOT NULL,

    -- GL Tracking
    journal_entry_id UUID,

    -- Status
    status VARCHAR(20) DEFAULT 'APPLIED',

    -- Notes
    notes TEXT,

    -- Audit Trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT fk_payment_application_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_payment_application_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_application_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_application_journal FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
    CONSTRAINT chk_payment_application_amount_positive CHECK (amount_applied > 0),
    CONSTRAINT chk_payment_application_status CHECK (status IN ('APPLIED', 'UNAPPLIED', 'REVERSED'))
);

-- Indexes for payment_applications
CREATE INDEX idx_payment_applications_tenant ON payment_applications(tenant_id);
CREATE INDEX idx_payment_applications_payment ON payment_applications(payment_id);
CREATE INDEX idx_payment_applications_invoice ON payment_applications(invoice_id);
CREATE INDEX idx_payment_applications_date ON payment_applications(applied_date);
CREATE INDEX idx_payment_applications_active ON payment_applications(tenant_id, payment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_applications_lookup ON payment_applications(tenant_id, invoice_id, status) WHERE deleted_at IS NULL;

-- Unique constraint: prevent duplicate applications
CREATE UNIQUE INDEX idx_payment_applications_unique ON payment_applications(payment_id, invoice_id)
WHERE deleted_at IS NULL AND status = 'APPLIED';

COMMENT ON TABLE payment_applications IS 'Links payments to invoices/bills for application tracking';
COMMENT ON COLUMN payment_applications.amount_applied IS 'Amount of payment applied to this invoice';
COMMENT ON COLUMN payment_applications.status IS 'APPLIED: active application, UNAPPLIED: reversed, REVERSED: GL entry reversed';

-- =============================================================================
-- TABLE 2: BANK_ACCOUNTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID,

    -- Account Details
    account_name VARCHAR(200) NOT NULL,
    account_number_masked VARCHAR(20),  -- Last 4 digits only (e.g., ****1234)
    bank_name VARCHAR(200),
    routing_number_masked VARCHAR(20),  -- Last 4 digits only
    account_type VARCHAR(20),  -- CHECKING, SAVINGS, MONEY_MARKET

    -- GL Integration
    gl_account_id UUID NOT NULL,  -- Link to chart_of_accounts (cash account)

    -- Gateway Integration
    is_gateway_account BOOLEAN DEFAULT false,
    gateway_provider VARCHAR(50),  -- STRIPE, PAYPAL, SQUARE
    gateway_account_id VARCHAR(255),  -- External account ID

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,

    -- Audit Trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT fk_bank_account_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_bank_account_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_bank_account_gl_account FOREIGN KEY (gl_account_id) REFERENCES chart_of_accounts(id),
    CONSTRAINT chk_bank_account_masked_format CHECK (
        account_number_masked IS NULL OR
        account_number_masked ~ '^\*+\d{4}$'
    ),
    CONSTRAINT chk_bank_account_gateway CHECK (
        (is_gateway_account = false AND gateway_provider IS NULL AND gateway_account_id IS NULL) OR
        (is_gateway_account = true AND gateway_provider IS NOT NULL)
    ),
    CONSTRAINT chk_bank_account_type CHECK (
        account_type IN ('CHECKING', 'SAVINGS', 'MONEY_MARKET', 'BUSINESS_CHECKING', 'BUSINESS_SAVINGS')
    ),
    CONSTRAINT chk_bank_account_gateway_provider CHECK (
        gateway_provider IS NULL OR gateway_provider IN ('STRIPE', 'PAYPAL', 'SQUARE', 'BRAINTREE')
    )
);

-- Indexes for bank_accounts
CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);
CREATE INDEX idx_bank_accounts_facility ON bank_accounts(facility_id);
CREATE INDEX idx_bank_accounts_active ON bank_accounts(tenant_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_bank_accounts_gl_account ON bank_accounts(gl_account_id);

-- Unique constraint: only one default bank account per tenant
CREATE UNIQUE INDEX idx_bank_accounts_default ON bank_accounts(tenant_id, is_default)
WHERE is_default = true AND is_active = true AND deleted_at IS NULL;

COMMENT ON TABLE bank_accounts IS 'Bank accounts for payment processing and reconciliation';
COMMENT ON COLUMN bank_accounts.account_number_masked IS 'Last 4 digits only - NEVER store full account number';
COMMENT ON COLUMN bank_accounts.is_gateway_account IS 'True if this account is connected to a payment gateway (Stripe, PayPal, etc.)';

-- =============================================================================
-- TABLE 3: CUSTOMER_PAYMENT_METHODS (PCI-Compliant Tokenized Storage)
-- =============================================================================

CREATE TABLE IF NOT EXISTS customer_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,

    -- Payment Method Details
    payment_method_type VARCHAR(50) NOT NULL,  -- CARD, ACH, BANK_ACCOUNT, DIGITAL_WALLET
    is_default BOOLEAN DEFAULT false,

    -- Gateway Integration (TOKENIZED - PCI COMPLIANT)
    gateway_provider VARCHAR(50) NOT NULL,  -- STRIPE, PAYPAL, etc.
    gateway_payment_method_id VARCHAR(255) NOT NULL,  -- Stripe PaymentMethod ID (pm_xxx)
    gateway_customer_id VARCHAR(255),  -- Stripe Customer ID (cus_xxx)

    -- Masked Display Info (NO SENSITIVE DATA STORED)
    display_name VARCHAR(200),  -- e.g., "Visa ending in 4242"

    -- Card Information (Last 4 Only)
    card_brand VARCHAR(50),  -- VISA, MASTERCARD, AMEX, DISCOVER
    card_last4 VARCHAR(4),
    card_exp_month INT,
    card_exp_year INT,
    card_funding VARCHAR(20),  -- CREDIT, DEBIT, PREPAID

    -- Bank Account Information (Last 4 Only)
    bank_last4 VARCHAR(4),
    bank_name VARCHAR(200),
    bank_account_type VARCHAR(20),  -- CHECKING, SAVINGS

    -- Verification Status
    is_active BOOLEAN DEFAULT true,
    verified BOOLEAN DEFAULT false,
    verification_date TIMESTAMPTZ,
    verification_method VARCHAR(50),  -- MICRO_DEPOSITS, INSTANT_VERIFICATION, MANUAL

    -- Security
    fingerprint VARCHAR(255),  -- Gateway-provided fingerprint for duplicate detection

    -- Audit Trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT fk_payment_method_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_payment_method_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    CONSTRAINT chk_payment_method_type CHECK (
        payment_method_type IN ('CARD', 'ACH', 'BANK_ACCOUNT', 'DIGITAL_WALLET', 'DEBIT_CARD')
    ),
    CONSTRAINT chk_payment_method_card_expiration CHECK (
        (card_exp_month IS NULL AND card_exp_year IS NULL) OR
        (card_exp_month BETWEEN 1 AND 12 AND card_exp_year >= EXTRACT(YEAR FROM CURRENT_DATE))
    ),
    CONSTRAINT chk_payment_method_card_brand CHECK (
        card_brand IS NULL OR card_brand IN ('VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'DINERS', 'JCB', 'UNIONPAY')
    ),
    CONSTRAINT chk_payment_method_card_funding CHECK (
        card_funding IS NULL OR card_funding IN ('CREDIT', 'DEBIT', 'PREPAID', 'UNKNOWN')
    ),
    CONSTRAINT chk_payment_method_gateway CHECK (
        gateway_provider IN ('STRIPE', 'PAYPAL', 'SQUARE', 'BRAINTREE', 'AUTHORIZE_NET')
    ),
    CONSTRAINT chk_payment_method_verification CHECK (
        verification_method IS NULL OR verification_method IN ('MICRO_DEPOSITS', 'INSTANT_VERIFICATION', 'MANUAL', 'PLAID')
    )
);

-- Indexes for customer_payment_methods
CREATE INDEX idx_payment_methods_tenant ON customer_payment_methods(tenant_id);
CREATE INDEX idx_payment_methods_customer ON customer_payment_methods(customer_id);
CREATE INDEX idx_payment_methods_active ON customer_payment_methods(tenant_id, customer_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_methods_verified ON customer_payment_methods(customer_id, verified) WHERE is_active = true AND deleted_at IS NULL;

-- Unique constraint: gateway payment method ID must be unique
CREATE UNIQUE INDEX idx_payment_methods_gateway ON customer_payment_methods(gateway_payment_method_id) WHERE deleted_at IS NULL;

-- Unique constraint: only one default payment method per customer
CREATE UNIQUE INDEX idx_payment_methods_customer_default ON customer_payment_methods(customer_id)
WHERE is_default = true AND is_active = true AND deleted_at IS NULL;

COMMENT ON TABLE customer_payment_methods IS 'PCI-compliant storage of tokenized customer payment methods (cards, bank accounts)';
COMMENT ON COLUMN customer_payment_methods.gateway_payment_method_id IS 'Tokenized payment method ID from gateway - NEVER store actual card/account numbers';
COMMENT ON COLUMN customer_payment_methods.card_last4 IS 'Last 4 digits only - for display purposes';
COMMENT ON COLUMN customer_payment_methods.verified IS 'For ACH: whether bank account has been verified via micro-deposits or instant verification';

-- =============================================================================
-- TABLE 4: PAYMENT_GATEWAY_TRANSACTIONS (Transaction Log & Audit Trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_gateway_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    payment_id UUID,  -- Link to payments table after successful processing

    -- Gateway Details
    gateway_provider VARCHAR(50) NOT NULL,  -- STRIPE, PAYPAL
    gateway_transaction_id VARCHAR(255) NOT NULL,  -- Stripe PaymentIntent ID (pi_xxx)
    gateway_customer_id VARCHAR(255),
    gateway_payment_method_id VARCHAR(255),

    -- Transaction Details
    transaction_type VARCHAR(50) NOT NULL,  -- CHARGE, REFUND, AUTHORIZATION, CAPTURE
    amount DECIMAL(18,4) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL,  -- PENDING, PROCESSING, SUCCEEDED, FAILED, CANCELED, REFUNDED

    -- Customer Info
    customer_id UUID,
    customer_email VARCHAR(255),

    -- Gateway Response
    gateway_response_code VARCHAR(50),
    gateway_response_message TEXT,
    gateway_raw_response JSONB,  -- Full webhook payload or API response

    -- Fees
    gateway_fee_amount DECIMAL(18,4),
    net_amount DECIMAL(18,4),

    -- Idempotency (Prevent Duplicate Processing)
    idempotency_key VARCHAR(255),

    -- Webhook Tracking
    webhook_event_id VARCHAR(255),
    webhook_received_at TIMESTAMPTZ,

    -- Dates
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Error Handling
    error_message TEXT,
    error_code VARCHAR(100),
    retry_count INT DEFAULT 0,
    last_retry_at TIMESTAMPTZ,

    -- Audit Trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    -- Constraints
    CONSTRAINT fk_gateway_transaction_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_gateway_transaction_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
    CONSTRAINT fk_gateway_transaction_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT chk_gateway_transaction_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_gateway_transaction_type CHECK (
        transaction_type IN ('CHARGE', 'REFUND', 'AUTHORIZATION', 'CAPTURE', 'VOID', 'ADJUSTMENT')
    ),
    CONSTRAINT chk_gateway_transaction_status CHECK (
        status IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'REFUNDED', 'DISPUTED')
    ),
    CONSTRAINT chk_gateway_transaction_provider CHECK (
        gateway_provider IN ('STRIPE', 'PAYPAL', 'SQUARE', 'BRAINTREE', 'AUTHORIZE_NET')
    )
);

-- Indexes for payment_gateway_transactions
CREATE INDEX idx_gateway_transactions_tenant ON payment_gateway_transactions(tenant_id);
CREATE INDEX idx_gateway_transactions_payment ON payment_gateway_transactions(payment_id);
CREATE INDEX idx_gateway_transactions_customer ON payment_gateway_transactions(customer_id);
CREATE INDEX idx_gateway_transactions_status ON payment_gateway_transactions(status);
CREATE INDEX idx_gateway_transactions_date ON payment_gateway_transactions(initiated_at);
CREATE INDEX idx_gateway_transactions_lookup ON payment_gateway_transactions(tenant_id, customer_id, status, initiated_at DESC);
CREATE INDEX idx_gateway_transactions_reporting ON payment_gateway_transactions(tenant_id, status, initiated_at DESC) INCLUDE (amount, currency_code);

-- Unique constraint: gateway transaction ID must be unique
CREATE UNIQUE INDEX idx_gateway_transactions_gateway_id ON payment_gateway_transactions(gateway_provider, gateway_transaction_id);

-- Unique constraint: idempotency key per provider (prevent duplicate processing)
CREATE UNIQUE INDEX idx_gateway_transactions_idempotency ON payment_gateway_transactions(gateway_provider, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Unique constraint: webhook event ID (prevent duplicate webhook processing)
CREATE UNIQUE INDEX idx_gateway_transactions_webhook ON payment_gateway_transactions(webhook_event_id)
WHERE webhook_event_id IS NOT NULL;

COMMENT ON TABLE payment_gateway_transactions IS 'Complete audit trail of all payment gateway transactions (Stripe, PayPal, etc.)';
COMMENT ON COLUMN payment_gateway_transactions.gateway_transaction_id IS 'External transaction ID from payment gateway (e.g., Stripe PaymentIntent ID)';
COMMENT ON COLUMN payment_gateway_transactions.idempotency_key IS 'Prevents duplicate transaction processing - format: {tenantId}_{paymentId}_{timestamp}';
COMMENT ON COLUMN payment_gateway_transactions.gateway_raw_response IS 'Full JSON response from gateway for debugging and audit';
COMMENT ON COLUMN payment_gateway_transactions.webhook_event_id IS 'Stripe Event ID to prevent duplicate webhook processing';

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all payment gateway tables
ALTER TABLE payment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_gateway_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: payment_applications
CREATE POLICY payment_applications_isolation ON payment_applications
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::uuid);

CREATE POLICY payment_applications_isolation_insert ON payment_applications
FOR INSERT
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::uuid);

-- RLS Policy: bank_accounts
CREATE POLICY bank_accounts_isolation ON bank_accounts
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::uuid);

CREATE POLICY bank_accounts_isolation_insert ON bank_accounts
FOR INSERT
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::uuid);

-- RLS Policy: customer_payment_methods
CREATE POLICY customer_payment_methods_isolation ON customer_payment_methods
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::uuid);

CREATE POLICY customer_payment_methods_isolation_insert ON customer_payment_methods
FOR INSERT
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::uuid);

-- RLS Policy: payment_gateway_transactions
CREATE POLICY payment_gateway_transactions_isolation ON payment_gateway_transactions
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::uuid);

CREATE POLICY payment_gateway_transactions_isolation_insert ON payment_gateway_transactions
FOR INSERT
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::uuid);

-- =============================================================================
-- GRANT PERMISSIONS (Application User)
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON payment_applications TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_accounts TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_payment_methods TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_gateway_transactions TO app_user;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

COMMENT ON SCHEMA public IS 'Payment Gateway Integration (Stripe & ACH) - REQ-STRATEGIC-AUTO-1767084329261 - Migration V0.0.59';
