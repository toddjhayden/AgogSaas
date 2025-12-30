-- =====================================================
-- FLYWAY MIGRATION V0.0.45
-- =====================================================
-- Purpose: Fix Finance Module Schema Gaps
-- Description: Add missing columns and tables identified in research/critique
-- Related: REQ-STRATEGIC-AUTO-1767066329940
-- Created: 2025-12-29
-- =====================================================

-- =====================================================
-- FIX INVOICES TABLE
-- =====================================================
-- Add missing columns referenced in GraphQL schema

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) DEFAULT 'CUSTOMER_INVOICE',
  ADD COLUMN IF NOT EXISTS period_year INTEGER,
  ADD COLUMN IF NOT EXISTS period_month INTEGER,
  ADD COLUMN IF NOT EXISTS balance_due DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'UNPAID';

-- Add check constraint for invoice_type
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoice_type CHECK (
    invoice_type IN ('CUSTOMER_INVOICE', 'VENDOR_BILL', 'CREDIT_MEMO', 'DEBIT_MEMO')
  );

-- Add check constraint for payment_status
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoice_payment_status CHECK (
    payment_status IN ('UNPAID', 'PARTIAL', 'PAID', 'OVERPAID')
  );

-- Add check constraint for period_month
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoice_period_month CHECK (
    period_month IS NULL OR period_month BETWEEN 1 AND 12
  );

-- Create index for invoice aging queries
CREATE INDEX IF NOT EXISTS idx_invoices_due_date_status
  ON invoices(due_date, status)
  WHERE deleted_at IS NULL;

-- Create index for period-based queries
CREATE INDEX IF NOT EXISTS idx_invoices_period
  ON invoices(period_year, period_month)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN invoices.invoice_type IS 'Type of invoice: CUSTOMER_INVOICE, VENDOR_BILL, CREDIT_MEMO, DEBIT_MEMO';
COMMENT ON COLUMN invoices.period_year IS 'Fiscal year for accounting period assignment';
COMMENT ON COLUMN invoices.period_month IS 'Fiscal month (1-12) for accounting period assignment';
COMMENT ON COLUMN invoices.balance_due IS 'Outstanding amount (total - paid_amount)';
COMMENT ON COLUMN invoices.paid_amount IS 'Total amount paid against this invoice';
COMMENT ON COLUMN invoices.payment_status IS 'Payment status: UNPAID, PARTIAL, PAID, OVERPAID';

-- =====================================================
-- FIX PAYMENTS TABLE
-- =====================================================
-- Add missing columns referenced in GraphQL schema

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS period_year INTEGER,
  ADD COLUMN IF NOT EXISTS period_month INTEGER,
  ADD COLUMN IF NOT EXISTS paid_by_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS check_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS deposit_date DATE,
  ADD COLUMN IF NOT EXISTS unapplied_amount DECIMAL(18,4) DEFAULT 0;

-- Add check constraint for period_month
ALTER TABLE payments
  ADD CONSTRAINT chk_payment_period_month CHECK (
    period_month IS NULL OR period_month BETWEEN 1 AND 12
  );

-- Create index for period-based queries
CREATE INDEX IF NOT EXISTS idx_payments_period
  ON payments(period_year, period_month)
  WHERE deleted_at IS NULL;

-- Create index for bank reconciliation
CREATE INDEX IF NOT EXISTS idx_payments_deposit_date
  ON payments(deposit_date)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN payments.period_year IS 'Fiscal year for accounting period assignment';
COMMENT ON COLUMN payments.period_month IS 'Fiscal month (1-12) for accounting period assignment';
COMMENT ON COLUMN payments.paid_by_name IS 'Name on check or payment instrument';
COMMENT ON COLUMN payments.check_number IS 'Check number (for check payments)';
COMMENT ON COLUMN payments.transaction_id IS 'Bank transaction ID or reference number';
COMMENT ON COLUMN payments.deposit_date IS 'Date payment was deposited to bank';
COMMENT ON COLUMN payments.unapplied_amount IS 'Amount not yet applied to invoices';

-- =====================================================
-- CREATE PAYMENT APPLICATIONS TABLE
-- =====================================================
-- Junction table to track payment application to invoices
-- Critical for AR/AP workflow

CREATE TABLE IF NOT EXISTS payment_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  -- Link to payment and invoice
  payment_id UUID NOT NULL,
  invoice_id UUID NOT NULL,

  -- Application details
  amount_applied DECIMAL(18,4) NOT NULL,
  applied_date DATE NOT NULL,

  -- GL posting
  journal_entry_id UUID,

  -- Status
  status VARCHAR(20) DEFAULT 'APPLIED',
  -- APPLIED, UNAPPLIED, REVERSED

  -- Notes
  notes TEXT,

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,

  CONSTRAINT fk_payment_application_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_payment_application_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
  CONSTRAINT fk_payment_application_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_payment_application_journal_entry FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
  CONSTRAINT chk_payment_application_amount CHECK (amount_applied > 0),
  CONSTRAINT chk_payment_application_status CHECK (status IN ('APPLIED', 'UNAPPLIED', 'REVERSED'))
);

CREATE INDEX idx_payment_applications_tenant ON payment_applications(tenant_id);
CREATE INDEX idx_payment_applications_payment ON payment_applications(payment_id);
CREATE INDEX idx_payment_applications_invoice ON payment_applications(invoice_id);
CREATE INDEX idx_payment_applications_date ON payment_applications(applied_date);

COMMENT ON TABLE payment_applications IS 'Tracks application of payments to specific invoices for AR/AP';
COMMENT ON COLUMN payment_applications.amount_applied IS 'Amount of payment applied to this invoice';
COMMENT ON COLUMN payment_applications.applied_date IS 'Date payment was applied to invoice';
COMMENT ON COLUMN payment_applications.status IS 'Application status: APPLIED, UNAPPLIED, REVERSED';

-- =====================================================
-- CREATE BANK ACCOUNTS TABLE
-- =====================================================
-- Bank account master for payment processing

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID,

  -- Bank account details
  account_number VARCHAR(50) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255),
  routing_number VARCHAR(50),

  -- Account type
  account_type VARCHAR(20) DEFAULT 'CHECKING',
  -- CHECKING, SAVINGS, CREDIT_CARD, LINE_OF_CREDIT

  -- Currency
  currency_code VARCHAR(3) NOT NULL,

  -- GL link
  gl_account_id UUID,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  date_opened DATE,
  date_closed DATE,

  -- Current balance (for reconciliation)
  current_balance DECIMAL(18,4) DEFAULT 0,
  last_reconciled_date DATE,
  last_reconciled_balance DECIMAL(18,4),

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,

  CONSTRAINT fk_bank_account_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_bank_account_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  CONSTRAINT fk_bank_account_gl_account FOREIGN KEY (gl_account_id) REFERENCES chart_of_accounts(id),
  CONSTRAINT chk_bank_account_type CHECK (account_type IN ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'LINE_OF_CREDIT'))
);

CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);
CREATE INDEX idx_bank_accounts_facility ON bank_accounts(facility_id);
CREATE INDEX idx_bank_accounts_active ON bank_accounts(is_active);
CREATE INDEX idx_bank_accounts_gl_account ON bank_accounts(gl_account_id);

COMMENT ON TABLE bank_accounts IS 'Bank account master for payment processing and reconciliation';

-- =====================================================
-- CREATE CUSTOMERS TABLE
-- =====================================================
-- Customer master for AR invoices (referenced in aging reports)

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  -- Customer identification
  customer_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,

  -- Contact info
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),

  -- Address
  billing_address_line1 VARCHAR(255),
  billing_address_line2 VARCHAR(255),
  billing_city VARCHAR(100),
  billing_state VARCHAR(50),
  billing_postal_code VARCHAR(20),
  billing_country VARCHAR(3),

  -- Terms
  payment_terms VARCHAR(50) DEFAULT 'NET_30',
  -- NET_30, NET_60, 2_10_NET_30, etc.
  credit_limit DECIMAL(18,4),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  customer_since DATE,

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,

  CONSTRAINT fk_customer_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT uq_customer_number UNIQUE (tenant_id, customer_number)
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_number ON customers(customer_number);
CREATE INDEX idx_customers_name ON customers(customer_name);
CREATE INDEX idx_customers_active ON customers(is_active);

COMMENT ON TABLE customers IS 'Customer master for AR invoicing and payment tracking';

-- Link existing invoices to customers
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS customer_id UUID;

ALTER TABLE invoices
  ADD CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES customers(id);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);

-- =====================================================
-- CREATE VENDORS TABLE
-- =====================================================
-- Vendor master for AP bills (referenced in aging reports)

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  -- Vendor identification
  vendor_number VARCHAR(50) NOT NULL,
  vendor_name VARCHAR(255) NOT NULL,

  -- Contact info
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  country VARCHAR(3),

  -- Terms
  payment_terms VARCHAR(50) DEFAULT 'NET_30',

  -- Tax info
  tax_id VARCHAR(50),
  is_1099_vendor BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  vendor_since DATE,

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,

  CONSTRAINT fk_vendor_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT uq_vendor_number UNIQUE (tenant_id, vendor_number)
);

CREATE INDEX idx_vendors_tenant ON vendors(tenant_id);
CREATE INDEX idx_vendors_number ON vendors(vendor_number);
CREATE INDEX idx_vendors_name ON vendors(vendor_name);
CREATE INDEX idx_vendors_active ON vendors(is_active);
CREATE INDEX idx_vendors_1099 ON vendors(is_1099_vendor);

COMMENT ON TABLE vendors IS 'Vendor master for AP bills and payment tracking';

-- Link existing invoices to vendors
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS vendor_id UUID;

ALTER TABLE invoices
  ADD CONSTRAINT fk_invoice_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id);

CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_id);

-- =====================================================
-- CREATE JOURNAL ENTRY APPROVALS TABLE
-- =====================================================
-- Track approvals for manual journal entries

CREATE TABLE IF NOT EXISTS journal_entry_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  -- Journal entry
  journal_entry_id UUID NOT NULL,

  -- Approval details
  approver_user_id UUID NOT NULL,
  approval_status VARCHAR(20) NOT NULL,
  -- PENDING, APPROVED, REJECTED

  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_je_approval_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_je_approval_journal_entry FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
  CONSTRAINT fk_je_approval_approver FOREIGN KEY (approver_user_id) REFERENCES users(id),
  CONSTRAINT chk_je_approval_status CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX idx_journal_entry_approvals_tenant ON journal_entry_approvals(tenant_id);
CREATE INDEX idx_journal_entry_approvals_journal_entry ON journal_entry_approvals(journal_entry_id);
CREATE INDEX idx_journal_entry_approvals_approver ON journal_entry_approvals(approver_user_id);
CREATE INDEX idx_journal_entry_approvals_status ON journal_entry_approvals(approval_status);

COMMENT ON TABLE journal_entry_approvals IS 'Approval workflow for manual journal entries';

-- =====================================================
-- CREATE FINANCE AUDIT LOG TABLE
-- =====================================================
-- Comprehensive audit trail for financial transactions

CREATE TABLE IF NOT EXISTS finance_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  -- Entity reference
  entity_type VARCHAR(50) NOT NULL,
  -- INVOICE, PAYMENT, JOURNAL_ENTRY, GL_BALANCE, etc.
  entity_id UUID,

  -- Action
  action VARCHAR(50) NOT NULL,
  -- CREATE, UPDATE, DELETE, VOID, POST, REVERSE, CLOSE, etc.

  -- Changes
  old_values JSONB,
  new_values JSONB,

  -- User context
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  -- Additional context
  notes TEXT,

  CONSTRAINT fk_finance_audit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_finance_audit_user FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX idx_finance_audit_log_tenant ON finance_audit_log(tenant_id);
CREATE INDEX idx_finance_audit_log_entity ON finance_audit_log(entity_type, entity_id);
CREATE INDEX idx_finance_audit_log_changed_by ON finance_audit_log(changed_by);
CREATE INDEX idx_finance_audit_log_changed_at ON finance_audit_log(changed_at);

COMMENT ON TABLE finance_audit_log IS 'Comprehensive audit trail for all financial transactions';

-- =====================================================
-- ADD PERFORMANCE INDEXES
-- =====================================================

-- Index for GL balance rollup performance
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_date
  ON journal_entry_lines(account_id, created_at)
  WHERE deleted_at IS NULL;

-- Index for cost allocation queries
CREATE INDEX IF NOT EXISTS idx_cost_allocations_job
  ON cost_allocations(job_id)
  WHERE deleted_at IS NULL;

-- Index for multi-currency queries
CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
  ON exchange_rates(from_currency_code, to_currency_code, rate_date);

-- =====================================================
-- UPDATE COMMENTS
-- =====================================================

COMMENT ON COLUMN invoices.customer_id IS 'Customer for AR invoices (references customers table)';
COMMENT ON COLUMN invoices.vendor_id IS 'Vendor for AP bills (references vendors table)';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
