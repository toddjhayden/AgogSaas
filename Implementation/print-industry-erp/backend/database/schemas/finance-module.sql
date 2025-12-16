-- =====================================================
-- FINANCE MODULE
-- =====================================================
-- Purpose: Multi-currency GL/AR/AP, consolidated financial reporting
-- Tables: 10 (chart_of_accounts, journal_entries, journal_entry_lines, gl_balances,
--         exchange_rates, invoices, invoice_lines, payments, cost_allocations, financial_periods)
-- Created: 2025-12-16
-- Author: Roy (Backend Architect)
-- =====================================================

-- =====================================================
-- TABLE: financial_periods
-- =====================================================
-- Purpose: Accounting periods for period close and reporting

CREATE TABLE financial_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Period identification
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    -- 1-12
    period_name VARCHAR(50),
    -- 'January 2025', 'Q1 2025', 'FY2025'

    -- Dates
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'OPEN',
    -- OPEN, CLOSING, CLOSED, LOCKED

    -- Close tracking
    closed_by_user_id UUID,
    closed_at TIMESTAMPTZ,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_financial_period_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_financial_period_closed_by FOREIGN KEY (closed_by_user_id) REFERENCES users(id),
    CONSTRAINT uq_financial_period UNIQUE (tenant_id, period_year, period_month),
    CONSTRAINT chk_period_month CHECK (period_month BETWEEN 1 AND 12)
);

CREATE INDEX idx_financial_periods_tenant ON financial_periods(tenant_id);
CREATE INDEX idx_financial_periods_year_month ON financial_periods(period_year, period_month);
CREATE INDEX idx_financial_periods_status ON financial_periods(status);

COMMENT ON TABLE financial_periods IS 'Accounting periods for month-end close and reporting';

-- =====================================================
-- TABLE: chart_of_accounts
-- =====================================================
-- Purpose: Chart of accounts (GL account master)

CREATE TABLE chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Account identification
    account_number VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Account type
    account_type VARCHAR(50) NOT NULL,
    -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE, COST_OF_GOODS_SOLD

    account_subtype VARCHAR(50),
    -- CURRENT_ASSET, FIXED_ASSET, CURRENT_LIABILITY, LONG_TERM_LIABILITY, etc.

    -- Hierarchy
    parent_account_id UUID,
    account_level INTEGER DEFAULT 1,
    is_header BOOLEAN DEFAULT FALSE,
    -- Header accounts for grouping (not postable)

    -- Financial statements
    balance_sheet_section VARCHAR(50),
    -- ASSETS, LIABILITIES, EQUITY
    income_statement_section VARCHAR(50),
    -- REVENUE, COGS, OPERATING_EXPENSES, OTHER_INCOME_EXPENSE

    -- Normal balance
    normal_balance VARCHAR(10),
    -- DEBIT, CREDIT

    -- Currency
    functional_currency_code VARCHAR(3),
    -- Account's default currency

    allow_foreign_currency BOOLEAN DEFAULT FALSE,
    -- Can this account have transactions in other currencies?

    -- Restrictions
    allow_manual_entry BOOLEAN DEFAULT TRUE,
    requires_department BOOLEAN DEFAULT FALSE,
    requires_project BOOLEAN DEFAULT FALSE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    date_opened DATE,
    date_closed DATE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_coa_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_coa_parent FOREIGN KEY (parent_account_id) REFERENCES chart_of_accounts(id),
    CONSTRAINT uq_coa_account_number UNIQUE (tenant_id, account_number),
    CONSTRAINT chk_coa_normal_balance CHECK (normal_balance IN ('DEBIT', 'CREDIT'))
);

CREATE INDEX idx_coa_tenant ON chart_of_accounts(tenant_id);
CREATE INDEX idx_coa_account_type ON chart_of_accounts(account_type);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_account_id);
CREATE INDEX idx_coa_active ON chart_of_accounts(is_active);

COMMENT ON TABLE chart_of_accounts IS 'Chart of accounts with multi-currency support and hierarchy';

-- =====================================================
-- TABLE: exchange_rates
-- =====================================================
-- Purpose: Daily exchange rates for multi-currency transactions

CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Exchange rate
    from_currency_code VARCHAR(3) NOT NULL,
    to_currency_code VARCHAR(3) NOT NULL,
    rate_date DATE NOT NULL,

    -- Rate
    exchange_rate DECIMAL(18,8) NOT NULL,
    -- 1 USD = 1.35 CAD => rate = 1.35

    -- Rate type
    rate_type VARCHAR(20) DEFAULT 'DAILY',
    -- DAILY, MONTHLY_AVERAGE, SPOT, CONTRACT

    -- Source
    rate_source VARCHAR(50),
    -- MANUAL, AUTO_IMPORT, API_XE, API_OANDA, etc.

    is_manual BOOLEAN DEFAULT FALSE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_exchange_rate_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_exchange_rate UNIQUE (tenant_id, from_currency_code, to_currency_code, rate_date, rate_type)
);

CREATE INDEX idx_exchange_rates_tenant ON exchange_rates(tenant_id);
CREATE INDEX idx_exchange_rates_from_currency ON exchange_rates(from_currency_code);
CREATE INDEX idx_exchange_rates_to_currency ON exchange_rates(to_currency_code);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(rate_date);

COMMENT ON TABLE exchange_rates IS 'Daily exchange rates for multi-currency transactions';

-- =====================================================
-- TABLE: journal_entries
-- =====================================================
-- Purpose: Journal entry headers (double-entry accounting)

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID,

    -- Entry identification
    entry_number VARCHAR(50) UNIQUE NOT NULL,
    entry_date DATE NOT NULL,
    period_id UUID NOT NULL,

    -- Entry type
    entry_type VARCHAR(50) NOT NULL,
    -- MANUAL, AUTO_AR, AUTO_AP, AUTO_INVENTORY, AUTO_PAYROLL, CLOSING, ADJUSTMENT

    -- Description
    description TEXT,
    reference VARCHAR(255),

    -- Source documents
    source_document_type VARCHAR(50),
    -- INVOICE, PAYMENT, RECEIPT, SHIPMENT, ADJUSTMENT, etc.
    source_document_id UUID,

    -- Multi-currency
    functional_currency_code VARCHAR(3) NOT NULL,
    -- Tenant's base currency

    -- Reversal
    is_reversal BOOLEAN DEFAULT FALSE,
    reversed_entry_id UUID,
    reversal_date DATE,

    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT, POSTED, REVERSED

    posted_at TIMESTAMPTZ,
    posted_by_user_id UUID,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_journal_entry_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_journal_entry_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_journal_entry_period FOREIGN KEY (period_id) REFERENCES financial_periods(id),
    CONSTRAINT fk_journal_entry_reversed FOREIGN KEY (reversed_entry_id) REFERENCES journal_entries(id),
    CONSTRAINT fk_journal_entry_posted_by FOREIGN KEY (posted_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_journal_entries_tenant ON journal_entries(tenant_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_period ON journal_entries(period_id);
CREATE INDEX idx_journal_entries_type ON journal_entries(entry_type);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);

COMMENT ON TABLE journal_entries IS 'Journal entry headers for double-entry accounting';

-- =====================================================
-- TABLE: journal_entry_lines
-- =====================================================
-- Purpose: Individual debit/credit lines within journal entries

CREATE TABLE journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Journal entry linkage
    journal_entry_id UUID NOT NULL,
    line_number INTEGER NOT NULL,

    -- Account
    account_id UUID NOT NULL,

    -- Debit/Credit
    debit_amount DECIMAL(18,4) DEFAULT 0,
    credit_amount DECIMAL(18,4) DEFAULT 0,

    -- Multi-currency
    transaction_currency_code VARCHAR(3) NOT NULL,
    -- Currency of the transaction

    transaction_debit_amount DECIMAL(18,4) DEFAULT 0,
    transaction_credit_amount DECIMAL(18,4) DEFAULT 0,
    -- Amounts in transaction currency

    exchange_rate DECIMAL(18,8),
    -- Rate used for conversion to functional currency

    -- Dimensions (for cost allocation)
    department_code VARCHAR(50),
    project_code VARCHAR(50),
    cost_center_code VARCHAR(50),
    location_code VARCHAR(50),

    -- Description
    line_description TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_journal_line_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_journal_line_entry FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
    CONSTRAINT fk_journal_line_account FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id),
    CONSTRAINT chk_journal_line_debit_credit CHECK (
        (debit_amount = 0 AND credit_amount != 0) OR
        (debit_amount != 0 AND credit_amount = 0)
    )
);

CREATE INDEX idx_journal_lines_tenant ON journal_entry_lines(tenant_id);
CREATE INDEX idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_entry_lines(account_id);

COMMENT ON TABLE journal_entry_lines IS 'Journal entry lines with multi-currency support and cost dimensions';

-- =====================================================
-- TABLE: gl_balances
-- =====================================================
-- Purpose: GL account balances (period-end snapshots for performance)

CREATE TABLE gl_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Account and period
    account_id UUID NOT NULL,
    period_id UUID NOT NULL,

    -- Balances (functional currency)
    beginning_balance DECIMAL(18,4) DEFAULT 0,
    period_debits DECIMAL(18,4) DEFAULT 0,
    period_credits DECIMAL(18,4) DEFAULT 0,
    ending_balance DECIMAL(18,4) DEFAULT 0,

    -- Multi-currency tracking
    currency_code VARCHAR(3) NOT NULL,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_gl_balance_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_gl_balance_account FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id),
    CONSTRAINT fk_gl_balance_period FOREIGN KEY (period_id) REFERENCES financial_periods(id),
    CONSTRAINT uq_gl_balance UNIQUE (tenant_id, account_id, period_id, currency_code)
);

CREATE INDEX idx_gl_balances_tenant ON gl_balances(tenant_id);
CREATE INDEX idx_gl_balances_account ON gl_balances(account_id);
CREATE INDEX idx_gl_balances_period ON gl_balances(period_id);

COMMENT ON TABLE gl_balances IS 'Period-end GL account balance snapshots for reporting performance';

-- =====================================================
-- TABLE: invoices
-- =====================================================
-- Purpose: Customer invoices (AR)

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID,

    -- Invoice identification
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,

    -- Customer
    customer_id UUID NOT NULL,
    billing_entity_id UUID,

    bill_to_name VARCHAR(255),
    bill_to_address_line1 VARCHAR(255),
    bill_to_address_line2 VARCHAR(255),
    bill_to_city VARCHAR(100),
    bill_to_state VARCHAR(100),
    bill_to_postal_code VARCHAR(20),
    bill_to_country VARCHAR(100),

    -- Reference
    sales_order_id UUID,
    shipment_id UUID,
    purchase_order_number VARCHAR(100),
    -- Customer's PO number

    -- Currency
    invoice_currency_code VARCHAR(3) NOT NULL,
    functional_currency_code VARCHAR(3) NOT NULL,
    exchange_rate DECIMAL(18,8),

    -- Amounts (in invoice currency)
    subtotal DECIMAL(18,4) DEFAULT 0,
    tax_amount DECIMAL(18,4) DEFAULT 0,
    shipping_amount DECIMAL(18,4) DEFAULT 0,
    discount_amount DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) NOT NULL,

    -- Amounts (in functional currency)
    functional_subtotal DECIMAL(18,4) DEFAULT 0,
    functional_tax_amount DECIMAL(18,4) DEFAULT 0,
    functional_total_amount DECIMAL(18,4) NOT NULL,

    -- Payment tracking
    amount_paid DECIMAL(18,4) DEFAULT 0,
    amount_due DECIMAL(18,4),

    -- Payment terms
    payment_terms VARCHAR(50),
    -- NET_30, NET_60, 2/10_NET_30, etc.

    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED, VOID

    -- GL integration
    journal_entry_id UUID,

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    voided_at TIMESTAMPTZ,
    voided_by UUID,

    CONSTRAINT fk_invoice_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_invoice_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_invoice_billing_entity FOREIGN KEY (billing_entity_id) REFERENCES billing_entities(id),
    CONSTRAINT fk_invoice_journal_entry FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_sales_order ON invoices(sales_order_id);

COMMENT ON TABLE invoices IS 'Customer invoices (AR) with multi-currency support';

-- =====================================================
-- TABLE: invoice_lines
-- =====================================================
-- Purpose: Line items within customer invoices

CREATE TABLE invoice_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Invoice linkage
    invoice_id UUID NOT NULL,
    line_number INTEGER NOT NULL,

    -- Reference
    sales_order_line_id UUID,

    -- Product/Material
    material_id UUID,
    product_code VARCHAR(100),
    description TEXT NOT NULL,

    -- Quantity
    quantity DECIMAL(18,4),
    unit_of_measure VARCHAR(20),

    -- Price (in invoice currency)
    unit_price DECIMAL(18,4),
    line_amount DECIMAL(18,4) NOT NULL,
    tax_amount DECIMAL(18,4) DEFAULT 0,

    -- GL account
    revenue_account_id UUID,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_invoice_line_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_invoice_line_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    CONSTRAINT fk_invoice_line_revenue_account FOREIGN KEY (revenue_account_id) REFERENCES chart_of_accounts(id)
);

CREATE INDEX idx_invoice_lines_tenant ON invoice_lines(tenant_id);
CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id);
CREATE INDEX idx_invoice_lines_material ON invoice_lines(material_id);

COMMENT ON TABLE invoice_lines IS 'Line items within customer invoices';

-- =====================================================
-- TABLE: payments
-- =====================================================
-- Purpose: Customer payments (AR) and vendor payments (AP)

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID,

    -- Payment identification
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    payment_date DATE NOT NULL,

    -- Payment type
    payment_type VARCHAR(20) NOT NULL,
    -- CUSTOMER_PAYMENT (AR), VENDOR_PAYMENT (AP)

    -- Customer or Vendor
    customer_id UUID,
    vendor_id UUID,

    -- Payment method
    payment_method VARCHAR(50) NOT NULL,
    -- CASH, CHECK, ACH, WIRE, CREDIT_CARD, etc.

    reference_number VARCHAR(100),
    -- Check number, ACH confirmation, etc.

    -- Currency
    payment_currency_code VARCHAR(3) NOT NULL,
    functional_currency_code VARCHAR(3) NOT NULL,
    exchange_rate DECIMAL(18,8),

    -- Amounts (in payment currency)
    payment_amount DECIMAL(18,4) NOT NULL,

    -- Amounts (in functional currency)
    functional_payment_amount DECIMAL(18,4) NOT NULL,

    -- Applied amount (to invoices/bills)
    applied_amount DECIMAL(18,4) DEFAULT 0,
    unapplied_amount DECIMAL(18,4),

    -- Bank account
    bank_account_id UUID,

    -- GL integration
    journal_entry_id UUID,

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, CLEARED, VOID

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_payment_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_payment_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_payment_journal_entry FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
    CONSTRAINT chk_payment_type CHECK (payment_type IN ('CUSTOMER_PAYMENT', 'VENDOR_PAYMENT')),
    CONSTRAINT chk_payment_customer_or_vendor CHECK (
        (payment_type = 'CUSTOMER_PAYMENT' AND customer_id IS NOT NULL AND vendor_id IS NULL) OR
        (payment_type = 'VENDOR_PAYMENT' AND vendor_id IS NOT NULL AND customer_id IS NULL)
    )
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_customer ON payments(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_payments_vendor ON payments(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_type ON payments(payment_type);
CREATE INDEX idx_payments_status ON payments(status);

COMMENT ON TABLE payments IS 'Customer payments (AR) and vendor payments (AP) with multi-currency';

-- =====================================================
-- TABLE: cost_allocations
-- =====================================================
-- Purpose: Cost allocation rules and tracking (for job costing, overhead allocation)

CREATE TABLE cost_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Allocation
    allocation_date DATE NOT NULL,
    allocation_period_id UUID,

    -- Source
    source_type VARCHAR(50) NOT NULL,
    -- PRODUCTION_RUN, SALES_ORDER, DEPARTMENT, OVERHEAD_POOL

    source_id UUID,
    source_description TEXT,

    -- Cost category
    cost_category VARCHAR(50) NOT NULL,
    -- MATERIAL, LABOR, OVERHEAD, FREIGHT, etc.

    -- Account
    debit_account_id UUID NOT NULL,
    credit_account_id UUID NOT NULL,

    -- Amount (functional currency)
    allocation_amount DECIMAL(18,4) NOT NULL,

    -- Allocation method
    allocation_method VARCHAR(50),
    -- DIRECT, MACHINE_HOURS, LABOR_HOURS, SQUARE_FOOTAGE, UNITS_PRODUCED, etc.

    allocation_basis DECIMAL(18,4),
    -- e.g., 100 machine hours

    -- GL integration
    journal_entry_id UUID,

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_cost_allocation_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_cost_allocation_period FOREIGN KEY (allocation_period_id) REFERENCES financial_periods(id),
    CONSTRAINT fk_cost_allocation_debit_account FOREIGN KEY (debit_account_id) REFERENCES chart_of_accounts(id),
    CONSTRAINT fk_cost_allocation_credit_account FOREIGN KEY (credit_account_id) REFERENCES chart_of_accounts(id),
    CONSTRAINT fk_cost_allocation_journal_entry FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);

CREATE INDEX idx_cost_allocations_tenant ON cost_allocations(tenant_id);
CREATE INDEX idx_cost_allocations_date ON cost_allocations(allocation_date);
CREATE INDEX idx_cost_allocations_period ON cost_allocations(allocation_period_id);
CREATE INDEX idx_cost_allocations_source_type ON cost_allocations(source_type);
CREATE INDEX idx_cost_allocations_category ON cost_allocations(cost_category);

COMMENT ON TABLE cost_allocations IS 'Cost allocation tracking for job costing and overhead distribution';
