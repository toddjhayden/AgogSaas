-- =====================================================
-- QUALITY + HR + IOT + SECURITY + MARKETPLACE + IMPOSITION MODULE
-- =====================================================
-- Purpose: All remaining critical modules for complete system
-- Tables: 30+ covering quality, HR, IoT, security, marketplace, imposition
-- Created: 2025-12-16
-- Author: Roy (Backend Architect)
-- =====================================================

-- =====================================================
-- QUALITY MODULE (5 tables)
-- =====================================================

CREATE TABLE quality_standards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    standard_code VARCHAR(50) NOT NULL,
    standard_name VARCHAR(255) NOT NULL,
    standard_type VARCHAR(50),
    -- ISO_9001, ISO_13485, AS9100, G7_GRACOL, FSC, SFI, etc.

    description TEXT,
    requirements JSONB,
    certification_body VARCHAR(255),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_quality_standard_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_quality_standard_code UNIQUE (tenant_id, standard_code)
);

CREATE INDEX idx_quality_standards_tenant ON quality_standards(tenant_id);
CREATE INDEX idx_quality_standards_type ON quality_standards(standard_type);

CREATE TABLE inspection_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    template_code VARCHAR(50) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    inspection_type VARCHAR(50),
    -- INCOMING, IN_PROCESS, FINAL, FIRST_ARTICLE, etc.

    product_id UUID,
    material_id UUID,
    operation_id UUID,

    inspection_points JSONB,
    -- [{point: 'Dimension Check', spec: 'Width', min: 10.0, max: 10.1, uom: 'inches'}, ...]

    sampling_plan VARCHAR(50),
    -- FULL, AQL_2.5, AQL_4.0, etc.

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_inspection_template_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_inspection_template_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_inspection_template_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT fk_inspection_template_operation FOREIGN KEY (operation_id) REFERENCES operations(id),
    CONSTRAINT uq_inspection_template_code UNIQUE (tenant_id, template_code)
);

CREATE INDEX idx_inspection_templates_tenant ON inspection_templates(tenant_id);
CREATE INDEX idx_inspection_templates_type ON inspection_templates(inspection_type);

CREATE TABLE quality_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    inspection_number VARCHAR(50) UNIQUE NOT NULL,
    inspection_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    inspection_type VARCHAR(50) NOT NULL,

    inspection_template_id UUID,

    -- References
    purchase_order_id UUID,
    production_run_id UUID,
    lot_number VARCHAR(100),

    -- Inspector
    inspector_user_id UUID NOT NULL,

    -- Results
    sample_size INTEGER,
    defects_found INTEGER DEFAULT 0,
    pass_fail VARCHAR(10),
    -- PASS, FAIL

    inspection_results JSONB,
    -- [{point: 'Width', measured: 10.05, spec_min: 10.0, spec_max: 10.1, result: 'PASS'}, ...]

    -- Disposition
    disposition VARCHAR(50),
    -- ACCEPT, REJECT, REWORK, USE_AS_IS, QUARANTINE

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_quality_inspection_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_quality_inspection_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_quality_inspection_template FOREIGN KEY (inspection_template_id) REFERENCES inspection_templates(id),
    CONSTRAINT fk_quality_inspection_inspector FOREIGN KEY (inspector_user_id) REFERENCES users(id),
    CONSTRAINT chk_quality_inspection_pass_fail CHECK (pass_fail IN ('PASS', 'FAIL'))
);

CREATE INDEX idx_quality_inspections_tenant ON quality_inspections(tenant_id);
CREATE INDEX idx_quality_inspections_date ON quality_inspections(inspection_date);
CREATE INDEX idx_quality_inspections_type ON quality_inspections(inspection_type);
CREATE INDEX idx_quality_inspections_pass_fail ON quality_inspections(pass_fail);

CREATE TABLE quality_defects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    defect_number VARCHAR(50) UNIQUE NOT NULL,
    quality_inspection_id UUID,
    production_run_id UUID,

    defect_code VARCHAR(50),
    defect_description TEXT NOT NULL,
    defect_severity VARCHAR(20),
    -- CRITICAL, MAJOR, MINOR

    quantity_affected DECIMAL(18,4),
    root_cause TEXT,

    corrective_action TEXT,
    preventive_action TEXT,

    responsible_user_id UUID,
    due_date DATE,
    completion_date DATE,

    status VARCHAR(20) DEFAULT 'OPEN',
    -- OPEN, IN_PROGRESS, RESOLVED, VERIFIED, CLOSED

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_quality_defect_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_quality_defect_inspection FOREIGN KEY (quality_inspection_id) REFERENCES quality_inspections(id),
    CONSTRAINT fk_quality_defect_production_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
    CONSTRAINT fk_quality_defect_responsible FOREIGN KEY (responsible_user_id) REFERENCES users(id)
);

CREATE INDEX idx_quality_defects_tenant ON quality_defects(tenant_id);
CREATE INDEX idx_quality_defects_status ON quality_defects(status);
CREATE INDEX idx_quality_defects_severity ON quality_defects(defect_severity);

CREATE TABLE customer_rejections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    rejection_number VARCHAR(50) UNIQUE NOT NULL,
    rejection_date DATE NOT NULL,
    customer_id UUID NOT NULL,

    sales_order_id UUID,
    shipment_id UUID,
    invoice_id UUID,

    rejection_reason TEXT NOT NULL,
    quantity_rejected DECIMAL(18,4),

    disposition VARCHAR(50),
    -- CREDIT, REPLACEMENT, REWORK, SCRAP

    root_cause TEXT,
    corrective_action TEXT,

    responsible_user_id UUID,

    status VARCHAR(20) DEFAULT 'OPEN',
    -- OPEN, IN_PROGRESS, RESOLVED, CLOSED

    financial_impact DECIMAL(18,4),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_customer_rejection_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_customer_rejection_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_customer_rejection_sales_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
    CONSTRAINT fk_customer_rejection_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id),
    CONSTRAINT fk_customer_rejection_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    CONSTRAINT fk_customer_rejection_responsible FOREIGN KEY (responsible_user_id) REFERENCES users(id)
);

CREATE INDEX idx_customer_rejections_tenant ON customer_rejections(tenant_id);
CREATE INDEX idx_customer_rejections_customer ON customer_rejections(customer_id);
CREATE INDEX idx_customer_rejections_status ON customer_rejections(status);

-- =====================================================
-- HR MODULE (4 tables)
-- =====================================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    employee_number VARCHAR(50) NOT NULL,
    user_id UUID,
    -- Links to users table if employee has system access

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,

    email VARCHAR(255),
    phone VARCHAR(50),

    job_title VARCHAR(100),
    department VARCHAR(100),
    facility_id UUID,

    hire_date DATE,
    termination_date DATE,

    employment_type VARCHAR(50),
    -- FULL_TIME, PART_TIME, CONTRACT, SEASONAL

    pay_type VARCHAR(20),
    -- HOURLY, SALARY

    base_pay_rate DECIMAL(18,4),
    overtime_pay_rate DECIMAL(18,4),

    supervisor_employee_id UUID,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_employee_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_employee_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_employee_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_employee_supervisor FOREIGN KEY (supervisor_employee_id) REFERENCES employees(id),
    CONSTRAINT uq_employee_number UNIQUE (tenant_id, employee_number)
);

CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_facility ON employees(facility_id);
CREATE INDEX idx_employees_active ON employees(is_active);

CREATE TABLE labor_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    rate_code VARCHAR(50) NOT NULL,
    rate_name VARCHAR(255) NOT NULL,

    work_center_id UUID,
    operation_id UUID,

    standard_rate_per_hour DECIMAL(18,4) NOT NULL,
    overtime_rate_per_hour DECIMAL(18,4),

    effective_from DATE NOT NULL,
    effective_to DATE,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_labor_rate_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_labor_rate_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_labor_rate_operation FOREIGN KEY (operation_id) REFERENCES operations(id),
    CONSTRAINT uq_labor_rate_code UNIQUE (tenant_id, rate_code, effective_from)
);

CREATE INDEX idx_labor_rates_tenant ON labor_rates(tenant_id);
CREATE INDEX idx_labor_rates_dates ON labor_rates(effective_from, effective_to);

CREATE TABLE timecards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    employee_id UUID NOT NULL,
    timecard_date DATE NOT NULL,

    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,

    regular_hours DECIMAL(10,2),
    overtime_hours DECIMAL(10,2),
    double_time_hours DECIMAL(10,2),

    production_run_id UUID,
    work_center_id UUID,

    break_hours DECIMAL(10,2) DEFAULT 0,

    status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, APPROVED, REJECTED

    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_timecard_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_timecard_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_timecard_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    CONSTRAINT fk_timecard_production_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
    CONSTRAINT fk_timecard_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_timecard_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_timecards_tenant ON timecards(tenant_id);
CREATE INDEX idx_timecards_employee ON timecards(employee_id);
CREATE INDEX idx_timecards_date ON timecards(timecard_date);
CREATE INDEX idx_timecards_status ON timecards(status);

CREATE TABLE labor_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    employee_id UUID NOT NULL,
    production_run_id UUID NOT NULL,

    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,

    hours_worked DECIMAL(10,2),
    labor_type VARCHAR(20),
    -- SETUP, RUN, CLEANUP, REWORK

    hourly_rate DECIMAL(18,4),
    total_labor_cost DECIMAL(18,4),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_labor_tracking_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_labor_tracking_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    CONSTRAINT fk_labor_tracking_production_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id)
);

CREATE INDEX idx_labor_tracking_tenant ON labor_tracking(tenant_id);
CREATE INDEX idx_labor_tracking_employee ON labor_tracking(employee_id);
CREATE INDEX idx_labor_tracking_production_run ON labor_tracking(production_run_id);

-- =====================================================
-- IOT MODULE (3 tables)
-- =====================================================

CREATE TABLE iot_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    device_code VARCHAR(50) NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50),
    -- SENSOR, PRESS_COUNTER, TEMPERATURE_MONITOR, SCALE, etc.

    work_center_id UUID,

    manufacturer VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),

    connection_type VARCHAR(50),
    -- MQTT, REST_API, OPC_UA, MODBUS, etc.

    connection_config JSONB,

    is_active BOOLEAN DEFAULT TRUE,
    last_heartbeat TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_iot_device_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_iot_device_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_iot_device_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT uq_iot_device_code UNIQUE (tenant_id, facility_id, device_code)
);

CREATE INDEX idx_iot_devices_tenant ON iot_devices(tenant_id);
CREATE INDEX idx_iot_devices_facility ON iot_devices(facility_id);
CREATE INDEX idx_iot_devices_work_center ON iot_devices(work_center_id);

CREATE TABLE sensor_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    iot_device_id UUID NOT NULL,
    reading_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    sensor_type VARCHAR(50),
    -- TEMPERATURE, HUMIDITY, PRESSURE, SPEED, COUNT, WEIGHT, etc.

    reading_value DECIMAL(18,4),
    unit_of_measure VARCHAR(20),

    production_run_id UUID,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_sensor_reading_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_sensor_reading_device FOREIGN KEY (iot_device_id) REFERENCES iot_devices(id),
    CONSTRAINT fk_sensor_reading_production_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id)
);

CREATE INDEX idx_sensor_readings_tenant ON sensor_readings(tenant_id);
CREATE INDEX idx_sensor_readings_device ON sensor_readings(iot_device_id);
CREATE INDEX idx_sensor_readings_timestamp ON sensor_readings(reading_timestamp);

CREATE TABLE equipment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    work_center_id UUID NOT NULL,
    iot_device_id UUID,

    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    -- STARTUP, SHUTDOWN, ERROR, WARNING, MAINTENANCE_REQUIRED, etc.

    event_code VARCHAR(50),
    event_description TEXT,

    severity VARCHAR(20),
    -- INFO, WARNING, ERROR, CRITICAL

    production_run_id UUID,

    metadata JSONB,

    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by_user_id UUID,
    acknowledged_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_equipment_event_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_equipment_event_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_equipment_event_device FOREIGN KEY (iot_device_id) REFERENCES iot_devices(id),
    CONSTRAINT fk_equipment_event_production_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
    CONSTRAINT fk_equipment_event_acknowledged_by FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_equipment_events_tenant ON equipment_events(tenant_id);
CREATE INDEX idx_equipment_events_work_center ON equipment_events(work_center_id);
CREATE INDEX idx_equipment_events_timestamp ON equipment_events(event_timestamp);
CREATE INDEX idx_equipment_events_severity ON equipment_events(severity);

-- =====================================================
-- SECURITY MODULE (5-tier zones, access control, chain of custody)
-- =====================================================

CREATE TABLE security_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    zone_code VARCHAR(50) NOT NULL,
    zone_name VARCHAR(255) NOT NULL,
    zone_level VARCHAR(20) NOT NULL,
    -- STANDARD, RESTRICTED, SECURE, HIGH_SECURITY, VAULT

    description TEXT,

    -- Access requirements
    requires_badge BOOLEAN DEFAULT TRUE,
    requires_biometric BOOLEAN DEFAULT FALSE,
    requires_dual_control BOOLEAN DEFAULT FALSE,
    requires_escort BOOLEAN DEFAULT FALSE,

    minimum_clearance_level VARCHAR(20),

    access_hours JSONB,
    -- {monday: {start: '08:00', end: '17:00'}, ...}

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_security_zone_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_security_zone_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT uq_security_zone_code UNIQUE (tenant_id, facility_id, zone_code),
    CONSTRAINT chk_security_zone_level CHECK (zone_level IN ('STANDARD', 'RESTRICTED', 'SECURE', 'HIGH_SECURITY', 'VAULT'))
);

CREATE INDEX idx_security_zones_tenant ON security_zones(tenant_id);
CREATE INDEX idx_security_zones_facility ON security_zones(facility_id);
CREATE INDEX idx_security_zones_level ON security_zones(zone_level);

CREATE TABLE security_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    security_zone_id UUID NOT NULL,
    user_id UUID NOT NULL,

    access_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    access_type VARCHAR(20),
    -- ENTRY, EXIT

    access_method VARCHAR(50),
    -- BADGE, BIOMETRIC, PIN, DUAL_CONTROL

    verification_user_id UUID,
    -- For dual control

    granted BOOLEAN NOT NULL,
    denial_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_security_access_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_security_access_zone FOREIGN KEY (security_zone_id) REFERENCES security_zones(id),
    CONSTRAINT fk_security_access_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_security_access_verification_user FOREIGN KEY (verification_user_id) REFERENCES users(id)
);

CREATE INDEX idx_security_access_log_tenant ON security_access_log(tenant_id);
CREATE INDEX idx_security_access_log_zone ON security_access_log(security_zone_id);
CREATE INDEX idx_security_access_log_user ON security_access_log(user_id);
CREATE INDEX idx_security_access_log_timestamp ON security_access_log(access_timestamp);

CREATE TABLE chain_of_custody (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    item_type VARCHAR(50) NOT NULL,
    -- LOT, SHIPMENT, DOCUMENT, etc.
    item_id UUID NOT NULL,

    custody_transfer_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    from_user_id UUID,
    to_user_id UUID NOT NULL,

    from_location_id UUID,
    to_location_id UUID NOT NULL,

    verification_method VARCHAR(50),
    -- SIGNATURE, BIOMETRIC, BADGE, WITNESS

    witness_user_id UUID,

    tamper_evident_seal_id VARCHAR(100),
    seal_intact BOOLEAN DEFAULT TRUE,

    transfer_reason TEXT,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_chain_of_custody_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_chain_of_custody_from_user FOREIGN KEY (from_user_id) REFERENCES users(id),
    CONSTRAINT fk_chain_of_custody_to_user FOREIGN KEY (to_user_id) REFERENCES users(id),
    CONSTRAINT fk_chain_of_custody_from_location FOREIGN KEY (from_location_id) REFERENCES inventory_locations(id),
    CONSTRAINT fk_chain_of_custody_to_location FOREIGN KEY (to_location_id) REFERENCES inventory_locations(id),
    CONSTRAINT fk_chain_of_custody_witness FOREIGN KEY (witness_user_id) REFERENCES users(id)
);

CREATE INDEX idx_chain_of_custody_tenant ON chain_of_custody(tenant_id);
CREATE INDEX idx_chain_of_custody_item ON chain_of_custody(item_type, item_id);
CREATE INDEX idx_chain_of_custody_timestamp ON chain_of_custody(custody_transfer_timestamp);

-- =====================================================
-- MARKETPLACE MODULE (Print Buyer Boards - 4 CRITICAL tables)
-- =====================================================

CREATE TABLE partner_network_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    company_code VARCHAR(50) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    company_type VARCHAR(50),
    -- PRINTER, CONVERTER, TRADE_SHOP, BROKER, etc.

    capabilities JSONB,
    -- {equipment: ['OFFSET_40', 'DIGITAL'], certifications: ['FSC', 'G7'], max_sheet_size: '40x60'}

    geographic_coverage JSONB,
    -- {regions: ['US_NORTHEAST', 'US_SOUTHEAST'], countries: ['USA', 'CAN']}

    reliability_score DECIMAL(3,1),
    -- 1-5 stars

    on_time_delivery_percentage DECIMAL(8,4),
    quality_rating_percentage DECIMAL(8,4),

    total_jobs_completed INTEGER DEFAULT 0,
    total_revenue_generated DECIMAL(18,4) DEFAULT 0,

    is_active BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_partner_network_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_partner_network_company UNIQUE (tenant_id, company_code)
);

CREATE INDEX idx_partner_network_profiles_tenant ON partner_network_profiles(tenant_id);
CREATE INDEX idx_partner_network_profiles_type ON partner_network_profiles(company_type);
CREATE INDEX idx_partner_network_profiles_reliability ON partner_network_profiles(reliability_score);

CREATE TABLE marketplace_job_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    posting_number VARCHAR(50) UNIQUE NOT NULL,
    posting_date DATE NOT NULL,
    expiration_date DATE,

    posting_company_id UUID NOT NULL,
    -- Company posting excess demand

    job_description TEXT NOT NULL,
    quantity DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    product_specifications JSONB,
    -- {product_type: 'LABEL', substrate: 'PAPER', colors: 4, size: '4x6', ...}

    required_delivery_date DATE,
    required_certifications JSONB,
    -- ['FSC', 'G7', 'ISO_9001']

    estimated_budget DECIMAL(18,4),
    budget_currency_code VARCHAR(3) DEFAULT 'USD',

    status VARCHAR(20) DEFAULT 'OPEN',
    -- OPEN, BIDS_RECEIVED, AWARDED, CANCELLED, COMPLETED

    awarded_to_company_id UUID,
    awarded_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_marketplace_posting_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_marketplace_posting_company FOREIGN KEY (posting_company_id) REFERENCES partner_network_profiles(id),
    CONSTRAINT fk_marketplace_posting_awarded_to FOREIGN KEY (awarded_to_company_id) REFERENCES partner_network_profiles(id)
);

CREATE INDEX idx_marketplace_postings_tenant ON marketplace_job_postings(tenant_id);
CREATE INDEX idx_marketplace_postings_company ON marketplace_job_postings(posting_company_id);
CREATE INDEX idx_marketplace_postings_status ON marketplace_job_postings(status);
CREATE INDEX idx_marketplace_postings_date ON marketplace_job_postings(posting_date);

CREATE TABLE marketplace_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    bid_number VARCHAR(50) UNIQUE NOT NULL,
    job_posting_id UUID NOT NULL,

    bidding_company_id UUID NOT NULL,
    -- Company B bidding on Company A's job

    bid_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    bid_amount DECIMAL(18,4) NOT NULL,
    bid_currency_code VARCHAR(3) DEFAULT 'USD',

    promised_delivery_date DATE,

    capabilities_match JSONB,
    -- {equipment: true, certifications: true, capacity: true}

    bid_notes TEXT,

    status VARCHAR(20) DEFAULT 'SUBMITTED',
    -- SUBMITTED, ACCEPTED, REJECTED, WITHDRAWN

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_marketplace_bid_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_marketplace_bid_posting FOREIGN KEY (job_posting_id) REFERENCES marketplace_job_postings(id),
    CONSTRAINT fk_marketplace_bid_company FOREIGN KEY (bidding_company_id) REFERENCES partner_network_profiles(id)
);

CREATE INDEX idx_marketplace_bids_tenant ON marketplace_bids(tenant_id);
CREATE INDEX idx_marketplace_bids_posting ON marketplace_bids(job_posting_id);
CREATE INDEX idx_marketplace_bids_company ON marketplace_bids(bidding_company_id);
CREATE INDEX idx_marketplace_bids_status ON marketplace_bids(status);

CREATE TABLE external_company_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    order_number VARCHAR(50) UNIQUE NOT NULL,
    order_date DATE NOT NULL,

    originating_company_id UUID NOT NULL,
    -- Company A (outsourcing)

    fulfilling_company_id UUID NOT NULL,
    -- Company B (fulfilling)

    job_posting_id UUID,
    marketplace_bid_id UUID,

    order_description TEXT,
    quantity DECIMAL(18,4) NOT NULL,

    order_amount DECIMAL(18,4) NOT NULL,
    order_currency_code VARCHAR(3) DEFAULT 'USD',

    delivery_date DATE,
    actual_delivery_date DATE,

    status VARCHAR(20) DEFAULT 'CONFIRMED',
    -- CONFIRMED, IN_PRODUCTION, SHIPPED, DELIVERED, INVOICED, PAID, CANCELLED

    quality_rating DECIMAL(3,1),
    -- 1-5 stars (after completion)

    on_time BOOLEAN,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_external_order_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_external_order_originating FOREIGN KEY (originating_company_id) REFERENCES partner_network_profiles(id),
    CONSTRAINT fk_external_order_fulfilling FOREIGN KEY (fulfilling_company_id) REFERENCES partner_network_profiles(id),
    CONSTRAINT fk_external_order_posting FOREIGN KEY (job_posting_id) REFERENCES marketplace_job_postings(id),
    CONSTRAINT fk_external_order_bid FOREIGN KEY (marketplace_bid_id) REFERENCES marketplace_bids(id)
);

CREATE INDEX idx_external_orders_tenant ON external_company_orders(tenant_id);
CREATE INDEX idx_external_orders_originating ON external_company_orders(originating_company_id);
CREATE INDEX idx_external_orders_fulfilling ON external_company_orders(fulfilling_company_id);
CREATE INDEX idx_external_orders_status ON external_company_orders(status);

-- =====================================================
-- IMPOSITION ENGINE MODULE (5 tables - already have imposition_layouts from FULL_SYSTEM_SCHEMA_DESIGN.md)
-- =====================================================

CREATE TABLE press_specifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    work_center_id UUID NOT NULL,

    max_sheet_width DECIMAL(10,4) NOT NULL,
    max_sheet_height DECIMAL(10,4) NOT NULL,
    min_sheet_width DECIMAL(10,4) NOT NULL,
    min_sheet_height DECIMAL(10,4) NOT NULL,

    gripper_margin DECIMAL(10,4) DEFAULT 0.5,
    side_margins DECIMAL(10,4) DEFAULT 0.25,
    max_image_width DECIMAL(10,4),
    max_image_height DECIMAL(10,4),

    max_colors INTEGER,
    supports_perfecting BOOLEAN DEFAULT FALSE,

    substrate_types JSONB,
    -- ['PAPER', 'CARDBOARD', 'PLASTIC']

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_press_spec_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_press_spec_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT uq_press_spec_work_center UNIQUE (tenant_id, work_center_id)
);

CREATE INDEX idx_press_specs_tenant ON press_specifications(tenant_id);
CREATE INDEX idx_press_specs_work_center ON press_specifications(work_center_id);

CREATE TABLE substrate_specifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    material_id UUID NOT NULL,

    width_inches DECIMAL(10,4),
    height_inches DECIMAL(10,4),
    caliper_inches DECIMAL(10,6),
    basis_weight_lbs INTEGER,

    grain_direction VARCHAR(20),
    -- LONG, SHORT, IRRELEVANT

    finish VARCHAR(50),
    -- GLOSS, MATTE, UNCOATED

    coating_type VARCHAR(50),
    recyclable BOOLEAN DEFAULT TRUE,
    fsc_certified BOOLEAN DEFAULT FALSE,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_substrate_spec_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_substrate_spec_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT uq_substrate_spec_material UNIQUE (tenant_id, material_id)
);

CREATE INDEX idx_substrate_specs_tenant ON substrate_specifications(tenant_id);
CREATE INDEX idx_substrate_specs_material ON substrate_specifications(material_id);

CREATE TABLE imposition_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    template_code VARCHAR(50) NOT NULL,
    template_name VARCHAR(255) NOT NULL,

    packaging_type VARCHAR(50),
    -- CORRUGATED, COMMERCIAL, LABELS, FLEXIBLE

    press_id UUID,

    default_across INTEGER,
    default_down INTEGER,
    default_gutter DECIMAL(10,4) DEFAULT 0.25,

    layout_pattern VARCHAR(50),
    -- GRID, WORK_AND_TURN, WORK_AND_TUMBLE, CUT_AND_STACK

    template_config JSONB,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_imposition_template_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_imposition_template_press FOREIGN KEY (press_id) REFERENCES work_centers(id),
    CONSTRAINT uq_imposition_template_code UNIQUE (tenant_id, template_code)
);

CREATE INDEX idx_imposition_templates_tenant ON imposition_templates(tenant_id);
CREATE INDEX idx_imposition_templates_packaging_type ON imposition_templates(packaging_type);

CREATE TABLE layout_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    sales_order_line_id UUID,
    quote_line_id UUID,

    product_id UUID NOT NULL,
    press_id UUID NOT NULL,

    design_width DECIMAL(10,4) NOT NULL,
    design_height DECIMAL(10,4) NOT NULL,

    sheet_width DECIMAL(10,4) NOT NULL,
    sheet_height DECIMAL(10,4) NOT NULL,

    across INTEGER NOT NULL,
    down INTEGER NOT NULL,
    units_per_sheet INTEGER NOT NULL,

    waste_percentage DECIMAL(8,4),

    calculation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    algorithm_version VARCHAR(50),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_layout_calc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_layout_calc_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_layout_calc_press FOREIGN KEY (press_id) REFERENCES work_centers(id)
);

CREATE INDEX idx_layout_calculations_tenant ON layout_calculations(tenant_id);
CREATE INDEX idx_layout_calculations_product ON layout_calculations(product_id);
CREATE INDEX idx_layout_calculations_press ON layout_calculations(press_id);

CREATE TABLE imposition_marks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    mark_code VARCHAR(50) NOT NULL,
    mark_name VARCHAR(255) NOT NULL,
    mark_type VARCHAR(50),
    -- REGISTRATION, COLOR_BAR, CUT_MARK, FOLD_MARK, BLEED_MARK

    mark_position VARCHAR(50),
    -- TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT, CENTER

    mark_size JSONB,
    -- {width: 0.25, height: 0.25, unit: 'inches'}

    mark_offset JSONB,
    -- {x: 0.125, y: 0.125, unit: 'inches'}

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_imposition_mark_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_imposition_mark_code UNIQUE (tenant_id, mark_code)
);

CREATE INDEX idx_imposition_marks_tenant ON imposition_marks(tenant_id);
CREATE INDEX idx_imposition_marks_type ON imposition_marks(mark_type);

COMMENT ON TABLE quality_standards IS 'Quality standards: ISO 9001, ISO 13485, G7, FSC, etc.';
COMMENT ON TABLE inspection_templates IS 'Quality inspection templates with sampling plans';
COMMENT ON TABLE quality_inspections IS 'Quality inspections: incoming, in-process, final';
COMMENT ON TABLE quality_defects IS 'Quality defects with CAPA (corrective/preventive action)';
COMMENT ON TABLE customer_rejections IS 'Customer rejections with financial impact tracking';
COMMENT ON TABLE employees IS 'Employee master data with pay rates';
COMMENT ON TABLE labor_rates IS 'Labor rates by work center and operation';
COMMENT ON TABLE timecards IS 'Employee timecards with approval workflow';
COMMENT ON TABLE labor_tracking IS 'Production labor tracking by job';
COMMENT ON TABLE iot_devices IS 'IoT devices: sensors, press counters, monitors';
COMMENT ON TABLE sensor_readings IS 'Real-time sensor data from equipment';
COMMENT ON TABLE equipment_events IS 'Equipment events: errors, warnings, maintenance alerts';
COMMENT ON TABLE security_zones IS '5-tier security zones: STANDARD → VAULT';
COMMENT ON TABLE security_access_log IS 'Security access audit log with biometric and dual control';
COMMENT ON TABLE chain_of_custody IS 'Chain of custody tracking for secure items';
COMMENT ON TABLE partner_network_profiles IS 'Partner network directory with reliability scores';
COMMENT ON TABLE marketplace_job_postings IS 'Print buyer boards: Company A posts excess demand';
COMMENT ON TABLE marketplace_bids IS 'Partner bids on marketplace job postings';
COMMENT ON TABLE external_company_orders IS 'Company A → Company B outsourcing orders';
COMMENT ON TABLE press_specifications IS 'Press technical specifications for imposition engine';
COMMENT ON TABLE substrate_specifications IS 'Substrate specifications for material selection';
COMMENT ON TABLE imposition_templates IS 'Reusable imposition templates by packaging type';
COMMENT ON TABLE layout_calculations IS 'Imposition layout calculation history';
COMMENT ON TABLE imposition_marks IS 'Registration marks, color bars, cut marks, etc.';
