-- =====================================================
-- WAREHOUSE MANAGEMENT SYSTEM (WMS) MODULE
-- =====================================================
-- Purpose: Complete WMS with inventory tracking, wave processing, 3PL management
-- Tables: 13 (inventory_locations, inventory_transactions, lots, wave_processing, wave_lines,
--         pick_lists, shipments, shipment_lines, carrier_integrations, tracking_events,
--         kit_definitions, kit_components, inventory_reservations)
-- Created: 2025-12-16
-- Author: Roy (Backend Architect)
-- =====================================================

-- =====================================================
-- TABLE: inventory_locations
-- =====================================================
-- Purpose: Physical warehouse locations (racks, bins, zones)

CREATE TABLE inventory_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Location identification
    location_code VARCHAR(50) NOT NULL,
    location_name VARCHAR(255),
    barcode VARCHAR(100),

    -- Location hierarchy
    zone_code VARCHAR(50),
    aisle_code VARCHAR(50),
    rack_code VARCHAR(50),
    shelf_code VARCHAR(50),
    bin_code VARCHAR(50),

    -- Location type
    location_type VARCHAR(50),
    -- RECEIVING, PUTAWAY, PICK_FACE, RESERVE, PACKING, SHIPPING, QUARANTINE, RETURNS

    -- ABC classification (for cycle counting frequency)
    abc_classification VARCHAR(1),
    -- A = weekly, B = monthly, C = quarterly

    -- Physical dimensions
    length_inches DECIMAL(10,2),
    width_inches DECIMAL(10,2),
    height_inches DECIMAL(10,2),
    max_weight_lbs DECIMAL(12,2),
    cubic_feet DECIMAL(12,4),

    -- Security zone (5-tier security)
    security_zone VARCHAR(20) DEFAULT 'STANDARD',
    -- STANDARD, RESTRICTED, SECURE, HIGH_SECURITY, VAULT

    -- Temperature control
    temperature_controlled BOOLEAN DEFAULT FALSE,
    temperature_min_f DECIMAL(6,2),
    temperature_max_f DECIMAL(6,2),

    -- Picking optimization
    pick_sequence INTEGER,
    pick_zone VARCHAR(50),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    blocked_reason TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_inventory_location_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_inventory_location_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT uq_inventory_location_code UNIQUE (tenant_id, facility_id, location_code)
);

CREATE INDEX idx_inventory_locations_tenant ON inventory_locations(tenant_id);
CREATE INDEX idx_inventory_locations_facility ON inventory_locations(facility_id);
CREATE INDEX idx_inventory_locations_zone ON inventory_locations(zone_code);
CREATE INDEX idx_inventory_locations_type ON inventory_locations(location_type);
CREATE INDEX idx_inventory_locations_security ON inventory_locations(security_zone);
CREATE INDEX idx_inventory_locations_abc ON inventory_locations(abc_classification);

COMMENT ON TABLE inventory_locations IS 'Physical warehouse locations with 5-tier security zones';

-- =====================================================
-- TABLE: lots
-- =====================================================
-- Purpose: Lot/batch tracking for traceability

CREATE TABLE lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Lot identification
    lot_number VARCHAR(100) NOT NULL,
    material_id UUID NOT NULL,
    -- Links to materials table

    -- Quantity
    original_quantity DECIMAL(18,4) NOT NULL,
    current_quantity DECIMAL(18,4) NOT NULL,
    available_quantity DECIMAL(18,4) NOT NULL,
    allocated_quantity DECIMAL(18,4) DEFAULT 0,
    unit_of_measure VARCHAR(20),

    -- Location
    location_id UUID,

    -- Traceability
    vendor_lot_number VARCHAR(100),
    purchase_order_id UUID,
    production_run_id UUID,
    received_date DATE,
    manufactured_date DATE,
    expiration_date DATE,

    -- Quality
    quality_status VARCHAR(20) DEFAULT 'RELEASED',
    -- QUARANTINE, PENDING_INSPECTION, RELEASED, REJECTED, HOLD

    quality_inspection_id UUID,
    quality_notes TEXT,

    -- Customer ownership (for 3PL)
    customer_id UUID,
    is_customer_owned BOOLEAN DEFAULT FALSE,

    -- Certifications (FDA, FSC, etc.)
    certifications JSONB,
    -- {fda_compliant: true, fsc_certified: true, lot_certifications: [...]}

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_lot_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_lot_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_lot_location FOREIGN KEY (location_id) REFERENCES inventory_locations(id),
    CONSTRAINT uq_lot_number UNIQUE (tenant_id, facility_id, lot_number)
);

CREATE INDEX idx_lots_tenant ON lots(tenant_id);
CREATE INDEX idx_lots_facility ON lots(facility_id);
CREATE INDEX idx_lots_material ON lots(material_id);
CREATE INDEX idx_lots_location ON lots(location_id);
CREATE INDEX idx_lots_quality_status ON lots(quality_status);
CREATE INDEX idx_lots_expiration ON lots(expiration_date);
CREATE INDEX idx_lots_customer ON lots(customer_id) WHERE customer_id IS NOT NULL;

COMMENT ON TABLE lots IS 'Lot/batch tracking with quality status and traceability';

-- =====================================================
-- TABLE: inventory_transactions
-- =====================================================
-- Purpose: All inventory movements (receipts, issues, transfers, adjustments)

CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Transaction identification
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    -- RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, CYCLE_COUNT, RETURN, SCRAP

    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Material
    material_id UUID NOT NULL,
    lot_number VARCHAR(100),

    -- Quantity
    quantity DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    -- Location
    from_location_id UUID,
    to_location_id UUID,

    -- Reference documents
    purchase_order_id UUID,
    sales_order_id UUID,
    production_run_id UUID,
    shipment_id UUID,
    cycle_count_id UUID,

    -- Reason
    reason_code VARCHAR(50),
    reason_description TEXT,

    -- Cost (for financial integration)
    unit_cost DECIMAL(18,4),
    total_cost DECIMAL(18,4),

    -- User
    performed_by_user_id UUID NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'COMPLETED',
    -- PENDING, COMPLETED, REVERSED

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_inventory_transaction_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_inventory_transaction_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_inventory_transaction_from_location FOREIGN KEY (from_location_id) REFERENCES inventory_locations(id),
    CONSTRAINT fk_inventory_transaction_to_location FOREIGN KEY (to_location_id) REFERENCES inventory_locations(id),
    CONSTRAINT fk_inventory_transaction_user FOREIGN KEY (performed_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_inventory_transactions_tenant ON inventory_transactions(tenant_id);
CREATE INDEX idx_inventory_transactions_facility ON inventory_transactions(facility_id);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(transaction_date);
CREATE INDEX idx_inventory_transactions_material ON inventory_transactions(material_id);
CREATE INDEX idx_inventory_transactions_lot ON inventory_transactions(lot_number);

COMMENT ON TABLE inventory_transactions IS 'Complete inventory movement history (receipts, issues, transfers, adjustments)';

-- =====================================================
-- TABLE: wave_processing
-- =====================================================
-- Purpose: Wave creation and management (manufacturing + pick/ship waves)

CREATE TABLE wave_processing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Wave identification
    wave_number VARCHAR(50) UNIQUE NOT NULL,
    wave_name VARCHAR(255),

    -- Wave type
    wave_type VARCHAR(50) NOT NULL,
    -- MANUFACTURING, PICK_SHIP, CARRIER_SPECIFIC

    wave_strategy VARCHAR(50),
    -- DAILY_MORNING, DAILY_AFTERNOON, CARRIER_CUTOFF, ZONE_BASED, PRIORITY_BASED

    -- Carrier specific (for pick/ship waves)
    carrier_code VARCHAR(50),
    -- UPS, FEDEX, USPS

    -- Scheduling
    wave_date DATE NOT NULL,
    planned_start_time TIMESTAMPTZ,
    planned_end_time TIMESTAMPTZ,
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,

    -- Grouping criteria
    grouping_rules JSONB,
    -- {priority: 'URGENT', ship_method: 'UPS_GROUND', zone: 'A', ...}

    -- Metrics
    total_orders INTEGER DEFAULT 0,
    total_lines INTEGER DEFAULT 0,
    total_picks INTEGER DEFAULT 0,
    completed_picks INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(20) DEFAULT 'PLANNED',
    -- PLANNED, RELEASED, IN_PROGRESS, COMPLETED, CANCELLED

    -- Performance
    efficiency_percentage DECIMAL(8,4),
    pick_accuracy_percentage DECIMAL(8,4),

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_wave_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_wave_facility FOREIGN KEY (facility_id) REFERENCES facilities(id)
);

CREATE INDEX idx_wave_processing_tenant ON wave_processing(tenant_id);
CREATE INDEX idx_wave_processing_facility ON wave_processing(facility_id);
CREATE INDEX idx_wave_processing_type ON wave_processing(wave_type);
CREATE INDEX idx_wave_processing_status ON wave_processing(status);
CREATE INDEX idx_wave_processing_date ON wave_processing(wave_date);
CREATE INDEX idx_wave_processing_carrier ON wave_processing(carrier_code);

COMMENT ON TABLE wave_processing IS 'Wave management: manufacturing waves + pick/ship waves (carrier-specific)';

-- =====================================================
-- TABLE: wave_lines
-- =====================================================
-- Purpose: Individual order lines within a wave

CREATE TABLE wave_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Wave linkage
    wave_id UUID NOT NULL,

    -- Order linkage
    sales_order_id UUID,
    sales_order_line_id UUID,
    production_order_id UUID,

    -- Material
    material_id UUID NOT NULL,
    lot_number VARCHAR(100),

    -- Quantity
    quantity_required DECIMAL(18,4) NOT NULL,
    quantity_picked DECIMAL(18,4) DEFAULT 0,
    quantity_short DECIMAL(18,4) DEFAULT 0,

    -- Location
    pick_location_id UUID,

    -- Picker
    picker_user_id UUID,

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, ASSIGNED, PICKING, PICKED, SHORT, CANCELLED

    -- Timing
    assigned_at TIMESTAMPTZ,
    picked_at TIMESTAMPTZ,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_wave_line_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_wave_line_wave FOREIGN KEY (wave_id) REFERENCES wave_processing(id),
    CONSTRAINT fk_wave_line_location FOREIGN KEY (pick_location_id) REFERENCES inventory_locations(id),
    CONSTRAINT fk_wave_line_picker FOREIGN KEY (picker_user_id) REFERENCES users(id)
);

CREATE INDEX idx_wave_lines_tenant ON wave_lines(tenant_id);
CREATE INDEX idx_wave_lines_wave ON wave_lines(wave_id);
CREATE INDEX idx_wave_lines_status ON wave_lines(status);
CREATE INDEX idx_wave_lines_picker ON wave_lines(picker_user_id);

COMMENT ON TABLE wave_lines IS 'Individual order lines within wave (for pick task assignment)';

-- =====================================================
-- TABLE: pick_lists
-- =====================================================
-- Purpose: Picking task lists for warehouse operators

CREATE TABLE pick_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Pick list identification
    pick_list_number VARCHAR(50) UNIQUE NOT NULL,
    wave_id UUID,

    -- Picker
    picker_user_id UUID NOT NULL,

    -- Pick strategy
    pick_strategy VARCHAR(50),
    -- DISCRETE, BATCH, ZONE, CLUSTER

    -- Timing
    assigned_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Performance
    total_picks INTEGER,
    completed_picks INTEGER,
    pick_accuracy_percentage DECIMAL(8,4),

    -- Status
    status VARCHAR(20) DEFAULT 'ASSIGNED',
    -- ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_pick_list_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_pick_list_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_pick_list_wave FOREIGN KEY (wave_id) REFERENCES wave_processing(id),
    CONSTRAINT fk_pick_list_picker FOREIGN KEY (picker_user_id) REFERENCES users(id)
);

CREATE INDEX idx_pick_lists_tenant ON pick_lists(tenant_id);
CREATE INDEX idx_pick_lists_facility ON pick_lists(facility_id);
CREATE INDEX idx_pick_lists_wave ON pick_lists(wave_id);
CREATE INDEX idx_pick_lists_picker ON pick_lists(picker_user_id);
CREATE INDEX idx_pick_lists_status ON pick_lists(status);

COMMENT ON TABLE pick_lists IS 'Picking task lists: discrete, batch, zone, cluster picking';

-- =====================================================
-- TABLE: carrier_integrations
-- =====================================================
-- Purpose: Carrier account configuration (FedEx, UPS, USPS)

CREATE TABLE carrier_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Carrier
    carrier_code VARCHAR(50) NOT NULL,
    -- FEDEX, UPS, USPS, DHL, etc.

    carrier_name VARCHAR(255) NOT NULL,

    -- Account
    carrier_account_number VARCHAR(100) NOT NULL,
    billing_account_number VARCHAR(100),

    -- API credentials
    api_endpoint VARCHAR(500),
    api_username VARCHAR(255),
    api_password_encrypted TEXT,
    api_key_encrypted TEXT,
    oauth_token_encrypted TEXT,

    -- Services
    available_services JSONB,
    -- [{code: 'GROUND', name: 'Ground', transit_days: 5}, ...]

    -- Preferences
    default_service_code VARCHAR(50),
    label_format VARCHAR(20) DEFAULT 'PDF',
    -- PDF, PNG, ZPL

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_connection_test TIMESTAMPTZ,
    connection_status VARCHAR(20),
    -- CONNECTED, DISCONNECTED, ERROR

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_carrier_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_carrier_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT uq_carrier_account UNIQUE (tenant_id, facility_id, carrier_code, carrier_account_number)
);

CREATE INDEX idx_carrier_integrations_tenant ON carrier_integrations(tenant_id);
CREATE INDEX idx_carrier_integrations_facility ON carrier_integrations(facility_id);
CREATE INDEX idx_carrier_integrations_carrier ON carrier_integrations(carrier_code);
CREATE INDEX idx_carrier_integrations_active ON carrier_integrations(is_active);

COMMENT ON TABLE carrier_integrations IS 'Carrier API configurations: FedEx, UPS, USPS, DHL';

-- =====================================================
-- TABLE: shipments
-- =====================================================
-- Purpose: Outbound shipments to customers

CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Shipment identification
    shipment_number VARCHAR(50) UNIQUE NOT NULL,
    sales_order_id UUID,
    wave_id UUID,

    -- Customer
    customer_id UUID NOT NULL,
    ship_to_name VARCHAR(255),
    ship_to_address_line1 VARCHAR(255),
    ship_to_address_line2 VARCHAR(255),
    ship_to_city VARCHAR(100),
    ship_to_state VARCHAR(100),
    ship_to_postal_code VARCHAR(20),
    ship_to_country VARCHAR(100),
    ship_to_phone VARCHAR(50),

    -- Carrier
    carrier_id UUID,
    carrier_service_code VARCHAR(50),
    carrier_service_name VARCHAR(255),
    tracking_number VARCHAR(100),

    -- Shipping details
    ship_date DATE,
    requested_ship_date DATE,
    estimated_delivery_date DATE,
    actual_delivery_date DATE,

    -- Package details
    total_packages INTEGER DEFAULT 1,
    total_weight_lbs DECIMAL(12,4),
    dimensions_json JSONB,
    -- [{package: 1, length: 12, width: 10, height: 8, weight: 5}, ...]

    -- Costs
    shipping_cost DECIMAL(18,4),
    insurance_cost DECIMAL(18,4),

    -- Documents
    shipping_label_url TEXT,
    packing_slip_url TEXT,
    commercial_invoice_url TEXT,
    -- For international shipments

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, PICKED, PACKED, SHIPPED, IN_TRANSIT, DELIVERED, EXCEPTION, CANCELLED

    -- Packer
    packed_by_user_id UUID,
    packed_at TIMESTAMPTZ,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_shipment_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_shipment_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_shipment_wave FOREIGN KEY (wave_id) REFERENCES wave_processing(id),
    CONSTRAINT fk_shipment_carrier FOREIGN KEY (carrier_id) REFERENCES carrier_integrations(id),
    CONSTRAINT fk_shipment_packer FOREIGN KEY (packed_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_shipments_tenant ON shipments(tenant_id);
CREATE INDEX idx_shipments_facility ON shipments(facility_id);
CREATE INDEX idx_shipments_customer ON shipments(customer_id);
CREATE INDEX idx_shipments_wave ON shipments(wave_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_ship_date ON shipments(ship_date);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);

COMMENT ON TABLE shipments IS 'Outbound shipments with carrier integration and tracking';

-- =====================================================
-- TABLE: shipment_lines
-- =====================================================
-- Purpose: Line items within shipments

CREATE TABLE shipment_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Shipment linkage
    shipment_id UUID NOT NULL,
    sales_order_line_id UUID,

    -- Material
    material_id UUID NOT NULL,
    product_description TEXT,
    lot_number VARCHAR(100),

    -- Quantity
    quantity_shipped DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    -- Value (for customs)
    unit_value DECIMAL(18,4),
    total_value DECIMAL(18,4),

    -- International shipping
    hs_code VARCHAR(20),
    -- Harmonized System tariff code
    country_of_origin VARCHAR(100),

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_shipment_line_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_shipment_line_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id)
);

CREATE INDEX idx_shipment_lines_tenant ON shipment_lines(tenant_id);
CREATE INDEX idx_shipment_lines_shipment ON shipment_lines(shipment_id);
CREATE INDEX idx_shipment_lines_material ON shipment_lines(material_id);

COMMENT ON TABLE shipment_lines IS 'Line items within shipments with international shipping support';

-- =====================================================
-- TABLE: tracking_events
-- =====================================================
-- Purpose: Carrier tracking events (webhooks from FedEx/UPS/USPS)

CREATE TABLE tracking_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Shipment linkage
    shipment_id UUID NOT NULL,
    tracking_number VARCHAR(100) NOT NULL,

    -- Event
    event_code VARCHAR(50),
    event_description TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL,

    -- Location
    event_city VARCHAR(100),
    event_state VARCHAR(100),
    event_country VARCHAR(100),

    -- Status
    is_delivered BOOLEAN DEFAULT FALSE,
    is_exception BOOLEAN DEFAULT FALSE,

    -- Raw carrier response
    raw_response JSONB,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_tracking_event_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_tracking_event_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id)
);

CREATE INDEX idx_tracking_events_tenant ON tracking_events(tenant_id);
CREATE INDEX idx_tracking_events_shipment ON tracking_events(shipment_id);
CREATE INDEX idx_tracking_events_tracking_number ON tracking_events(tracking_number);
CREATE INDEX idx_tracking_events_timestamp ON tracking_events(event_timestamp);

COMMENT ON TABLE tracking_events IS 'Carrier tracking events from FedEx/UPS/USPS webhooks';

-- =====================================================
-- TABLE: kit_definitions
-- =====================================================
-- Purpose: Multi-component kits (assemblies)

CREATE TABLE kit_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Kit identification
    kit_code VARCHAR(50) NOT NULL,
    kit_name VARCHAR(255) NOT NULL,
    kit_description TEXT,

    -- Master material (the kit itself)
    kit_material_id UUID NOT NULL,

    -- Assembly
    assembly_lead_time_days INTEGER,
    assembly_instructions TEXT,

    -- Quality
    inspection_required BOOLEAN DEFAULT FALSE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_kit_definition_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_kit_code UNIQUE (tenant_id, kit_code)
);

CREATE INDEX idx_kit_definitions_tenant ON kit_definitions(tenant_id);
CREATE INDEX idx_kit_definitions_material ON kit_definitions(kit_material_id);

COMMENT ON TABLE kit_definitions IS 'Multi-component kit master definitions';

-- =====================================================
-- TABLE: kit_components
-- =====================================================
-- Purpose: Components within kits (BOM for kits)

CREATE TABLE kit_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Kit linkage
    kit_id UUID NOT NULL,

    -- Component
    component_material_id UUID NOT NULL,
    component_description TEXT,

    -- Quantity
    quantity_per_kit DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    -- Sequence
    sequence_number INTEGER,

    -- Substitution
    is_substitutable BOOLEAN DEFAULT FALSE,
    substitute_material_id UUID,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_kit_component_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_kit_component_kit FOREIGN KEY (kit_id) REFERENCES kit_definitions(id)
);

CREATE INDEX idx_kit_components_tenant ON kit_components(tenant_id);
CREATE INDEX idx_kit_components_kit ON kit_components(kit_id);
CREATE INDEX idx_kit_components_material ON kit_components(component_material_id);

COMMENT ON TABLE kit_components IS 'Components within kits (multi-level BOM support)';

-- =====================================================
-- TABLE: inventory_reservations
-- =====================================================
-- Purpose: Inventory allocations (soft reservations)

CREATE TABLE inventory_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Reservation
    material_id UUID NOT NULL,
    lot_number VARCHAR(100),
    location_id UUID,

    -- Quantity
    quantity_reserved DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    -- Reference
    sales_order_id UUID,
    production_order_id UUID,
    shipment_id UUID,

    -- Expiration
    reservation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiration_date TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE',
    -- ACTIVE, FULFILLED, EXPIRED, CANCELLED

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_inventory_reservation_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_inventory_reservation_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_inventory_reservation_location FOREIGN KEY (location_id) REFERENCES inventory_locations(id)
);

CREATE INDEX idx_inventory_reservations_tenant ON inventory_reservations(tenant_id);
CREATE INDEX idx_inventory_reservations_facility ON inventory_reservations(facility_id);
CREATE INDEX idx_inventory_reservations_material ON inventory_reservations(material_id);
CREATE INDEX idx_inventory_reservations_status ON inventory_reservations(status);
CREATE INDEX idx_inventory_reservations_expiration ON inventory_reservations(expiration_date);

COMMENT ON TABLE inventory_reservations IS 'Inventory soft allocations for sales and production orders';
