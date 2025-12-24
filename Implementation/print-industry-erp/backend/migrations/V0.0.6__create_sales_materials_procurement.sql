-- =====================================================
-- FLYWAY MIGRATION V1.0.6
-- =====================================================
-- Purpose: Create sales, materials, and procurement modules
-- Tables: 17 (materials, products, bill_of_materials, vendors, materials_suppliers,
--         purchase_orders, purchase_order_lines, vendor_contracts, vendor_performance,
--         customers, customer_products, customer_pricing, quotes, quote_lines,
--         sales_orders, sales_order_lines, pricing_rules)
-- Dependencies: V1.0.2 (core multitenant), V1.0.3 (operations), V1.0.5 (finance)
-- Created: 2025-12-16
-- =====================================================


-- =====================================================

-- =====================================================
-- MATERIALS SECTION
-- =====================================================

-- =====================================================
-- TABLE: materials
-- =====================================================
-- Purpose: Master material data (raw materials, substrates, inks, etc.)

CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Material identification
    material_code VARCHAR(100) NOT NULL,
    material_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Material type
    material_type VARCHAR(50) NOT NULL,
    -- RAW_MATERIAL, SUBSTRATE, INK, COATING, ADHESIVE, FINISHED_GOOD, WIP, KIT, etc.

    material_category VARCHAR(50),
    -- PAPER, CARDBOARD, PLASTIC, METAL, etc.

    -- Unit of measure
    primary_uom VARCHAR(20) NOT NULL,
    -- SHEETS, ROLLS, LBS, KG, GALLONS, PIECES, etc.

    secondary_uom VARCHAR(20),
    uom_conversion_factor DECIMAL(18,8),

    -- Dimensions (for substrates)
    width_inches DECIMAL(10,4),
    height_inches DECIMAL(10,4),
    thickness_inches DECIMAL(10,6),
    weight_lbs_per_unit DECIMAL(12,4),

    -- Substrate specifications
    basis_weight_lbs INTEGER,
    -- Paper weight (e.g., 80lb text)
    caliper_inches DECIMAL(10,6),
    finish VARCHAR(50),
    -- GLOSS, MATTE, UNCOATED, SATIN
    grain_direction VARCHAR(20),
    -- LONG, SHORT

    -- Inventory management
    is_lot_tracked BOOLEAN DEFAULT FALSE,
    is_serialized BOOLEAN DEFAULT FALSE,
    shelf_life_days INTEGER,

    -- ABC classification (for cycle counting)
    abc_classification VARCHAR(1),

    -- Costs (standard cost)
    standard_cost DECIMAL(18,4),
    cost_currency_code VARCHAR(3) DEFAULT 'USD',
    last_cost DECIMAL(18,4),
    average_cost DECIMAL(18,4),

    -- Costing method
    costing_method VARCHAR(20) DEFAULT 'AVERAGE',
    -- FIFO, LIFO, AVERAGE, STANDARD

    -- Purchasing
    default_vendor_id UUID,
    lead_time_days INTEGER,
    minimum_order_quantity DECIMAL(18,4),
    order_multiple DECIMAL(18,4),

    -- Safety stock
    safety_stock_quantity DECIMAL(18,4),
    reorder_point DECIMAL(18,4),
    economic_order_quantity DECIMAL(18,4),

    -- Quality & compliance
    requires_inspection BOOLEAN DEFAULT FALSE,
    fda_compliant BOOLEAN DEFAULT FALSE,
    food_contact_approved BOOLEAN DEFAULT FALSE,
    fsc_certified BOOLEAN DEFAULT FALSE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_purchasable BOOLEAN DEFAULT TRUE,
    is_sellable BOOLEAN DEFAULT FALSE,
    is_manufacturable BOOLEAN DEFAULT FALSE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_material_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_material_code UNIQUE (tenant_id, material_code)
);

CREATE INDEX idx_materials_tenant ON materials(tenant_id);
CREATE INDEX idx_materials_type ON materials(material_type);
CREATE INDEX idx_materials_category ON materials(material_category);
CREATE INDEX idx_materials_active ON materials(is_active);
CREATE INDEX idx_materials_abc ON materials(abc_classification);

COMMENT ON TABLE materials IS 'Master material data: raw materials, substrates, inks, finished goods';

-- =====================================================
-- TABLE: products
-- =====================================================
-- Purpose: Finished goods / sellable products

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Product identification
    product_code VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Product category
    product_category VARCHAR(50),
    -- LABELS, CORRUGATED_BOX, FOLDING_CARTON, COMMERCIAL_PRINT, FLEXIBLE_PACKAGING, etc.

    -- Master material linkage
    material_id UUID,
    -- Products ARE materials (type = FINISHED_GOOD)

    -- Packaging type (for imposition engine)
    packaging_type VARCHAR(50),
    -- CORRUGATED, COMMERCIAL, LABELS, FLEXIBLE

    -- Design specifications
    design_width_inches DECIMAL(10,4),
    design_height_inches DECIMAL(10,4),
    design_bleed_inches DECIMAL(10,4) DEFAULT 0.125,

    -- Manufacturing
    default_routing_id UUID,
    standard_production_time_hours DECIMAL(10,2),

    -- Costs
    standard_material_cost DECIMAL(18,4),
    standard_labor_cost DECIMAL(18,4),
    standard_overhead_cost DECIMAL(18,4),
    standard_total_cost DECIMAL(18,4),

    -- Pricing
    list_price DECIMAL(18,4),
    price_currency_code VARCHAR(3) DEFAULT 'USD',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_product_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_product_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT uq_product_code UNIQUE (tenant_id, product_code)
);

CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_category ON products(product_category);
CREATE INDEX idx_products_packaging_type ON products(packaging_type);
CREATE INDEX idx_products_active ON products(is_active);

COMMENT ON TABLE products IS 'Finished goods products with manufacturing and pricing data';

-- =====================================================
-- TABLE: bill_of_materials
-- =====================================================
-- Purpose: Product BOMs (components required to make finished goods)

CREATE TABLE bill_of_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Parent product
    parent_product_id UUID NOT NULL,

    -- Component
    component_material_id UUID NOT NULL,
    component_description TEXT,

    -- Quantity
    quantity_per_parent DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    -- Scrap allowance
    scrap_percentage DECIMAL(8,4) DEFAULT 0,

    -- Sequence
    sequence_number INTEGER,

    -- Operation
    operation_id UUID,
    -- Which operation consumes this component

    -- Substitution
    is_substitutable BOOLEAN DEFAULT FALSE,
    substitute_material_id UUID,

    -- Effective dating
    effective_from DATE,
    effective_to DATE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_bom_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_bom_parent FOREIGN KEY (parent_product_id) REFERENCES products(id),
    CONSTRAINT fk_bom_component FOREIGN KEY (component_material_id) REFERENCES materials(id),
    CONSTRAINT fk_bom_substitute FOREIGN KEY (substitute_material_id) REFERENCES materials(id),
    CONSTRAINT fk_bom_operation FOREIGN KEY (operation_id) REFERENCES operations(id)
);

CREATE INDEX idx_bom_tenant ON bill_of_materials(tenant_id);
CREATE INDEX idx_bom_parent ON bill_of_materials(parent_product_id);
CREATE INDEX idx_bom_component ON bill_of_materials(component_material_id);
CREATE INDEX idx_bom_active ON bill_of_materials(is_active);

COMMENT ON TABLE bill_of_materials IS 'Product BOMs with scrap allowance and substitution support';

-- =====================================================
-- PROCUREMENT SECTION
-- =====================================================

-- =====================================================
-- TABLE: vendors
-- =====================================================
-- Purpose: Vendor/supplier master data

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Vendor identification
    vendor_code VARCHAR(50) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),

    -- Vendor type
    vendor_type VARCHAR(50),
    -- MATERIAL_SUPPLIER, TRADE_PRINTER, SERVICE_PROVIDER, MRO_SUPPLIER, etc.

    -- Contact
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),

    -- Tax information
    tax_id VARCHAR(100),

    -- Payment terms
    payment_terms VARCHAR(50) DEFAULT 'NET_30',
    payment_currency_code VARCHAR(3) DEFAULT 'USD',

    -- Performance
    on_time_delivery_percentage DECIMAL(8,4),
    quality_rating_percentage DECIMAL(8,4),
    overall_rating DECIMAL(3,1),
    -- 1-5 stars

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_vendor_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_vendor_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES users(id),
    CONSTRAINT uq_vendor_code UNIQUE (tenant_id, vendor_code)
);

CREATE INDEX idx_vendors_tenant ON vendors(tenant_id);
CREATE INDEX idx_vendors_type ON vendors(vendor_type);
CREATE INDEX idx_vendors_active ON vendors(is_active);
CREATE INDEX idx_vendors_approved ON vendors(is_approved);

COMMENT ON TABLE vendors IS 'Vendor/supplier master data with performance tracking';

-- =====================================================
-- TABLE: materials_suppliers
-- =====================================================
-- Purpose: Material-specific vendor pricing and lead times

CREATE TABLE materials_suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Material and vendor
    material_id UUID NOT NULL,
    vendor_id UUID NOT NULL,

    -- Pricing
    is_preferred_vendor BOOLEAN DEFAULT FALSE,
    vendor_material_code VARCHAR(100),
    vendor_material_name VARCHAR(255),

    unit_price DECIMAL(18,4),
    price_currency_code VARCHAR(3) DEFAULT 'USD',
    price_uom VARCHAR(20),

    -- Quantity breaks
    price_breaks JSONB,
    -- [{min_qty: 1000, price: 10.50}, {min_qty: 5000, price: 9.75}, ...]

    -- Lead time
    lead_time_days INTEGER,

    -- Minimum order
    minimum_order_quantity DECIMAL(18,4),
    order_multiple DECIMAL(18,4),

    -- Effective dating
    effective_from DATE,
    effective_to DATE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_materials_supplier_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_materials_supplier_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT fk_materials_supplier_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    CONSTRAINT uq_material_vendor UNIQUE (tenant_id, material_id, vendor_id, effective_from)
);

CREATE INDEX idx_materials_suppliers_tenant ON materials_suppliers(tenant_id);
CREATE INDEX idx_materials_suppliers_material ON materials_suppliers(material_id);
CREATE INDEX idx_materials_suppliers_vendor ON materials_suppliers(vendor_id);
CREATE INDEX idx_materials_suppliers_preferred ON materials_suppliers(is_preferred_vendor);

COMMENT ON TABLE materials_suppliers IS 'Material-specific vendor pricing with quantity breaks';

-- =====================================================
-- TABLE: purchase_orders
-- =====================================================
-- Purpose: Purchase orders to vendors

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- PO identification
    po_number VARCHAR(50) UNIQUE NOT NULL,
    po_date DATE NOT NULL,
    vendor_id UUID NOT NULL,

    -- Ship to facility
    ship_to_facility_id UUID,
    ship_to_address TEXT,

    -- Bill to
    billing_entity_id UUID,

    -- Buyer
    buyer_user_id UUID,

    -- Currency
    po_currency_code VARCHAR(3) NOT NULL,
    exchange_rate DECIMAL(18,8),

    -- Amounts (in PO currency)
    subtotal DECIMAL(18,4) DEFAULT 0,
    tax_amount DECIMAL(18,4) DEFAULT 0,
    shipping_amount DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) NOT NULL,

    -- Payment terms
    payment_terms VARCHAR(50),

    -- Delivery
    requested_delivery_date DATE,
    promised_delivery_date DATE,

    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT, ISSUED, ACKNOWLEDGED, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED

    -- Approval
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,

    -- GL integration
    journal_entry_id UUID,

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_po_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_po_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_po_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    CONSTRAINT fk_po_ship_to_facility FOREIGN KEY (ship_to_facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_po_billing_entity FOREIGN KEY (billing_entity_id) REFERENCES billing_entities(id),
    CONSTRAINT fk_po_buyer FOREIGN KEY (buyer_user_id) REFERENCES users(id),
    CONSTRAINT fk_po_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_po_journal_entry FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);

CREATE INDEX idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_facility ON purchase_orders(facility_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_date ON purchase_orders(po_date);

COMMENT ON TABLE purchase_orders IS 'Purchase orders to vendors with approval workflow';

-- =====================================================
-- TABLE: purchase_order_lines
-- =====================================================
-- Purpose: Line items within purchase orders

CREATE TABLE purchase_order_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- PO linkage
    purchase_order_id UUID NOT NULL,
    line_number INTEGER NOT NULL,

    -- Material
    material_id UUID NOT NULL,
    material_code VARCHAR(100),
    description TEXT,

    -- Quantity
    quantity_ordered DECIMAL(18,4) NOT NULL,
    quantity_received DECIMAL(18,4) DEFAULT 0,
    quantity_remaining DECIMAL(18,4),
    unit_of_measure VARCHAR(20),

    -- Price (in PO currency)
    unit_price DECIMAL(18,4) NOT NULL,
    line_amount DECIMAL(18,4) NOT NULL,

    -- Delivery
    requested_delivery_date DATE,
    promised_delivery_date DATE,

    -- GL account
    expense_account_id UUID,

    -- Receiving
    allow_over_receipt BOOLEAN DEFAULT FALSE,
    over_receipt_tolerance_percentage DECIMAL(8,4) DEFAULT 10.0,

    -- Status
    status VARCHAR(20) DEFAULT 'OPEN',
    -- OPEN, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_po_line_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_po_line_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    CONSTRAINT fk_po_line_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT fk_po_line_expense_account FOREIGN KEY (expense_account_id) REFERENCES chart_of_accounts(id)
);

CREATE INDEX idx_po_lines_tenant ON purchase_order_lines(tenant_id);
CREATE INDEX idx_po_lines_po ON purchase_order_lines(purchase_order_id);
CREATE INDEX idx_po_lines_material ON purchase_order_lines(material_id);
CREATE INDEX idx_po_lines_status ON purchase_order_lines(status);

COMMENT ON TABLE purchase_order_lines IS 'PO line items with receiving tracking';

-- =====================================================
-- TABLE: vendor_contracts
-- =====================================================
-- Purpose: Long-term vendor agreements with pricing

CREATE TABLE vendor_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Contract identification
    contract_number VARCHAR(50) NOT NULL,
    contract_name VARCHAR(255) NOT NULL,
    vendor_id UUID NOT NULL,

    -- Term
    start_date DATE NOT NULL,
    end_date DATE,
    auto_renew BOOLEAN DEFAULT FALSE,

    -- Pricing
    pricing_terms TEXT,
    volume_commitment DECIMAL(18,4),
    currency_code VARCHAR(3) DEFAULT 'USD',

    -- Payment terms
    payment_terms VARCHAR(50),

    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT, ACTIVE, EXPIRED, CANCELLED

    -- Documents
    contract_document_url TEXT,

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_vendor_contract_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_vendor_contract_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    CONSTRAINT uq_vendor_contract_number UNIQUE (tenant_id, contract_number)
);

CREATE INDEX idx_vendor_contracts_tenant ON vendor_contracts(tenant_id);
CREATE INDEX idx_vendor_contracts_vendor ON vendor_contracts(vendor_id);
CREATE INDEX idx_vendor_contracts_status ON vendor_contracts(status);
CREATE INDEX idx_vendor_contracts_dates ON vendor_contracts(start_date, end_date);

COMMENT ON TABLE vendor_contracts IS 'Long-term vendor agreements with pricing and terms';

-- =====================================================
-- TABLE: vendor_performance
-- =====================================================
-- Purpose: Vendor performance scorecard tracking

CREATE TABLE vendor_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Vendor and period
    vendor_id UUID NOT NULL,
    evaluation_period_year INTEGER NOT NULL,
    evaluation_period_month INTEGER NOT NULL,

    -- Metrics
    total_pos_issued INTEGER DEFAULT 0,
    total_pos_value DECIMAL(18,4) DEFAULT 0,

    on_time_deliveries INTEGER DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    on_time_percentage DECIMAL(8,4),

    quality_acceptances INTEGER DEFAULT 0,
    quality_rejections INTEGER DEFAULT 0,
    quality_percentage DECIMAL(8,4),

    price_competitiveness_score DECIMAL(3,1),
    -- 1-5 stars

    responsiveness_score DECIMAL(3,1),
    -- 1-5 stars

    overall_rating DECIMAL(3,1),
    -- Calculated: average of all scores

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_vendor_performance_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_vendor_performance_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    CONSTRAINT uq_vendor_performance UNIQUE (tenant_id, vendor_id, evaluation_period_year, evaluation_period_month)
);

CREATE INDEX idx_vendor_performance_tenant ON vendor_performance(tenant_id);
CREATE INDEX idx_vendor_performance_vendor ON vendor_performance(vendor_id);
CREATE INDEX idx_vendor_performance_period ON vendor_performance(evaluation_period_year, evaluation_period_month);

COMMENT ON TABLE vendor_performance IS 'Monthly vendor performance scorecards';

-- =====================================================
-- SALES SECTION
-- =====================================================

-- =====================================================
-- TABLE: customers
-- =====================================================
-- Purpose: Customer master data

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Customer identification
    customer_code VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),

    -- Customer type
    customer_type VARCHAR(50),
    -- DIRECT, DISTRIBUTOR, RESELLER, END_USER, etc.

    -- Contact
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),

    -- Billing address
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(100),

    -- Shipping address (default)
    shipping_address_line1 VARCHAR(255),
    shipping_address_line2 VARCHAR(255),
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    shipping_country VARCHAR(100),

    -- Tax information
    tax_id VARCHAR(100),
    tax_exempt BOOLEAN DEFAULT FALSE,
    tax_exemption_certificate_url TEXT,

    -- Payment terms
    payment_terms VARCHAR(50) DEFAULT 'NET_30',
    credit_limit DECIMAL(18,4),
    billing_currency_code VARCHAR(3) DEFAULT 'USD',

    -- Sales rep
    sales_rep_user_id UUID,

    -- Customer service rep
    csr_user_id UUID,

    -- Pricing tier
    pricing_tier VARCHAR(50),
    -- STANDARD, VOLUME, PREFERRED, CONTRACT, etc.

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    credit_hold BOOLEAN DEFAULT FALSE,

    -- Performance
    lifetime_revenue DECIMAL(18,4) DEFAULT 0,
    ytd_revenue DECIMAL(18,4) DEFAULT 0,
    average_order_value DECIMAL(18,4),

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_customer_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_customer_sales_rep FOREIGN KEY (sales_rep_user_id) REFERENCES users(id),
    CONSTRAINT fk_customer_csr FOREIGN KEY (csr_user_id) REFERENCES users(id),
    CONSTRAINT uq_customer_code UNIQUE (tenant_id, customer_code)
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_type ON customers(customer_type);
CREATE INDEX idx_customers_active ON customers(is_active);
CREATE INDEX idx_customers_sales_rep ON customers(sales_rep_user_id);

COMMENT ON TABLE customers IS 'Customer master data with credit management and sales assignments';

-- =====================================================
-- TABLE: customer_products
-- =====================================================
-- Purpose: Customer-specific product information

CREATE TABLE customer_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Customer and product
    customer_id UUID NOT NULL,
    product_id UUID NOT NULL,

    -- Customer's identifiers
    customer_product_code VARCHAR(100),
    customer_product_name VARCHAR(255),

    -- Specifications
    specifications JSONB,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_customer_product_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_customer_product_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_customer_product_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT uq_customer_product UNIQUE (tenant_id, customer_id, product_id)
);

CREATE INDEX idx_customer_products_tenant ON customer_products(tenant_id);
CREATE INDEX idx_customer_products_customer ON customer_products(customer_id);
CREATE INDEX idx_customer_products_product ON customer_products(product_id);

COMMENT ON TABLE customer_products IS 'Customer-specific product codes and specifications';

-- =====================================================
-- TABLE: customer_pricing
-- =====================================================
-- Purpose: Customer-specific pricing agreements

CREATE TABLE customer_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Customer and product
    customer_id UUID NOT NULL,
    product_id UUID NOT NULL,

    -- Pricing
    unit_price DECIMAL(18,4) NOT NULL,
    price_currency_code VARCHAR(3) DEFAULT 'USD',
    price_uom VARCHAR(20),

    -- Quantity breaks
    minimum_quantity DECIMAL(18,4),
    price_breaks JSONB,

    -- Effective dating
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_customer_pricing_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_customer_pricing_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_customer_pricing_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_customer_pricing_tenant ON customer_pricing(tenant_id);
CREATE INDEX idx_customer_pricing_customer ON customer_pricing(customer_id);
CREATE INDEX idx_customer_pricing_product ON customer_pricing(product_id);
CREATE INDEX idx_customer_pricing_dates ON customer_pricing(effective_from, effective_to);

COMMENT ON TABLE customer_pricing IS 'Customer-specific pricing with quantity breaks';

-- =====================================================
-- TABLE: quotes
-- =====================================================
-- Purpose: Sales quotes/estimates

CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID,

    -- Quote identification
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    quote_date DATE NOT NULL,
    expiration_date DATE,

    -- Customer
    customer_id UUID NOT NULL,
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),

    -- Sales rep
    sales_rep_user_id UUID,

    -- Currency
    quote_currency_code VARCHAR(3) NOT NULL,

    -- Amounts
    subtotal DECIMAL(18,4) DEFAULT 0,
    tax_amount DECIMAL(18,4) DEFAULT 0,
    shipping_amount DECIMAL(18,4) DEFAULT 0,
    discount_amount DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) NOT NULL,

    -- Margin
    total_cost DECIMAL(18,4),
    margin_amount DECIMAL(18,4),
    margin_percentage DECIMAL(8,4),

    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT, ISSUED, ACCEPTED, REJECTED, EXPIRED, CONVERTED_TO_ORDER

    -- Conversion
    converted_to_sales_order_id UUID,
    converted_at TIMESTAMPTZ,

    -- Notes
    notes TEXT,
    terms_and_conditions TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_quote_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_quote_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_quote_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_quote_sales_rep FOREIGN KEY (sales_rep_user_id) REFERENCES users(id)
);

CREATE INDEX idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_date ON quotes(quote_date);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_sales_rep ON quotes(sales_rep_user_id);

COMMENT ON TABLE quotes IS 'Sales quotes with margin calculation and conversion tracking';

-- =====================================================
-- TABLE: quote_lines
-- =====================================================
-- Purpose: Line items within quotes

CREATE TABLE quote_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Quote linkage
    quote_id UUID NOT NULL,
    line_number INTEGER NOT NULL,

    -- Product
    product_id UUID NOT NULL,
    product_code VARCHAR(100),
    description TEXT,

    -- Quantity
    quantity DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    -- Pricing
    unit_price DECIMAL(18,4) NOT NULL,
    line_amount DECIMAL(18,4) NOT NULL,
    discount_percentage DECIMAL(8,4),
    discount_amount DECIMAL(18,4),

    -- Costing
    unit_cost DECIMAL(18,4),
    line_cost DECIMAL(18,4),
    line_margin DECIMAL(18,4),
    margin_percentage DECIMAL(8,4),

    -- Manufacturing strategy
    manufacturing_strategy VARCHAR(50),

    -- Lead time
    lead_time_days INTEGER,
    promised_delivery_date DATE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_quote_line_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_quote_line_quote FOREIGN KEY (quote_id) REFERENCES quotes(id),
    CONSTRAINT fk_quote_line_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_quote_lines_tenant ON quote_lines(tenant_id);
CREATE INDEX idx_quote_lines_quote ON quote_lines(quote_id);
CREATE INDEX idx_quote_lines_product ON quote_lines(product_id);

COMMENT ON TABLE quote_lines IS 'Quote line items with costing and margin tracking';

-- =====================================================
-- TABLE: sales_orders
-- =====================================================
-- Purpose: Customer sales orders

CREATE TABLE sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Order identification
    sales_order_number VARCHAR(50) UNIQUE NOT NULL,
    order_date DATE NOT NULL,
    customer_id UUID NOT NULL,

    -- Customer reference
    customer_po_number VARCHAR(100),

    -- Contact
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),

    -- Ship to address
    ship_to_name VARCHAR(255),
    ship_to_address_line1 VARCHAR(255),
    ship_to_address_line2 VARCHAR(255),
    ship_to_city VARCHAR(100),
    ship_to_state VARCHAR(100),
    ship_to_postal_code VARCHAR(20),
    ship_to_country VARCHAR(100),

    -- Sales rep
    sales_rep_user_id UUID,

    -- Currency
    order_currency_code VARCHAR(3) NOT NULL,
    exchange_rate DECIMAL(18,8),

    -- Amounts (in order currency)
    subtotal DECIMAL(18,4) DEFAULT 0,
    tax_amount DECIMAL(18,4) DEFAULT 0,
    shipping_amount DECIMAL(18,4) DEFAULT 0,
    discount_amount DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) NOT NULL,

    -- Payment terms
    payment_terms VARCHAR(50),

    -- Delivery
    requested_delivery_date DATE,
    promised_delivery_date DATE,

    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT, CONFIRMED, IN_PRODUCTION, SHIPPED, DELIVERED, INVOICED, CANCELLED, ON_HOLD

    -- Priority
    priority INTEGER DEFAULT 5,

    -- Quote reference
    quote_id UUID,

    -- Notes
    notes TEXT,
    special_instructions TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_sales_order_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_sales_order_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_sales_order_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_sales_order_sales_rep FOREIGN KEY (sales_rep_user_id) REFERENCES users(id),
    CONSTRAINT fk_sales_order_quote FOREIGN KEY (quote_id) REFERENCES quotes(id)
);

CREATE INDEX idx_sales_orders_tenant ON sales_orders(tenant_id);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_facility ON sales_orders(facility_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_date ON sales_orders(order_date);
CREATE INDEX idx_sales_orders_delivery_date ON sales_orders(promised_delivery_date);

COMMENT ON TABLE sales_orders IS 'Customer sales orders with multi-currency support';

-- =====================================================
-- TABLE: sales_order_lines
-- =====================================================
-- Purpose: Line items within sales orders

CREATE TABLE sales_order_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Sales order linkage
    sales_order_id UUID NOT NULL,
    line_number INTEGER NOT NULL,

    -- Product
    product_id UUID NOT NULL,
    product_code VARCHAR(100),
    description TEXT,

    -- Quantity
    quantity_ordered DECIMAL(18,4) NOT NULL,
    quantity_shipped DECIMAL(18,4) DEFAULT 0,
    quantity_invoiced DECIMAL(18,4) DEFAULT 0,
    unit_of_measure VARCHAR(20),

    -- Pricing (in order currency)
    unit_price DECIMAL(18,4) NOT NULL,
    line_amount DECIMAL(18,4) NOT NULL,
    discount_percentage DECIMAL(8,4),
    discount_amount DECIMAL(18,4),

    -- Manufacturing strategy
    manufacturing_strategy VARCHAR(50),

    -- Production
    production_order_id UUID,

    -- Delivery
    requested_delivery_date DATE,
    promised_delivery_date DATE,

    -- Imposition layout
    imposition_layout_id UUID,

    -- Status
    status VARCHAR(20) DEFAULT 'OPEN',
    -- OPEN, IN_PRODUCTION, SHIPPED, INVOICED, CLOSED, CANCELLED

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_sales_order_line_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_sales_order_line_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
    CONSTRAINT fk_sales_order_line_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_sales_order_line_production_order FOREIGN KEY (production_order_id) REFERENCES production_orders(id)
);

CREATE INDEX idx_sales_order_lines_tenant ON sales_order_lines(tenant_id);
CREATE INDEX idx_sales_order_lines_order ON sales_order_lines(sales_order_id);
CREATE INDEX idx_sales_order_lines_product ON sales_order_lines(product_id);
CREATE INDEX idx_sales_order_lines_status ON sales_order_lines(status);

COMMENT ON TABLE sales_order_lines IS 'Sales order line items with production and fulfillment tracking';

-- =====================================================
-- TABLE: pricing_rules
-- =====================================================
-- Purpose: Dynamic pricing rules engine

CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Rule identification
    rule_code VARCHAR(50) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Rule type
    rule_type VARCHAR(50) NOT NULL,
    -- VOLUME_DISCOUNT, CUSTOMER_TIER, PRODUCT_CATEGORY, SEASONAL, PROMOTIONAL, etc.

    -- Priority
    priority INTEGER DEFAULT 10,
    -- Lower number = higher priority

    -- Conditions (JSONB for flexibility)
    conditions JSONB,
    -- {customer_tier: 'VOLUME', min_quantity: 1000, product_category: 'LABELS', ...}

    -- Pricing action
    pricing_action VARCHAR(50),
    -- PERCENTAGE_DISCOUNT, FIXED_DISCOUNT, FIXED_PRICE, MARKUP_PERCENTAGE, etc.

    action_value DECIMAL(18,4),

    -- Effective dating
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_pricing_rule_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_pricing_rule_code UNIQUE (tenant_id, rule_code)
);

CREATE INDEX idx_pricing_rules_tenant ON pricing_rules(tenant_id);
CREATE INDEX idx_pricing_rules_type ON pricing_rules(rule_type);
CREATE INDEX idx_pricing_rules_priority ON pricing_rules(priority);
CREATE INDEX idx_pricing_rules_dates ON pricing_rules(effective_from, effective_to);
CREATE INDEX idx_pricing_rules_active ON pricing_rules(is_active);

COMMENT ON TABLE pricing_rules IS 'Dynamic pricing rules engine with flexible conditions';
