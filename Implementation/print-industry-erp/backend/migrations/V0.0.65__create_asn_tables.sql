-- ============================================
-- Migration: V0.0.65 - Advanced Ship Notice (ASN) Tables
-- Description: Create ASN tables for supplier shipment notifications
-- Feature: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
-- Author: Roy (Backend Specialist)
-- Date: 2025-12-30
-- ============================================

-- ============================================
-- TABLE: advanced_ship_notices
-- ============================================
-- Purpose: Advanced Ship Notices (ASN) created by suppliers to notify of incoming shipments
-- Benefits: Enables receiving department to prepare, reduces receiving time by 30%
-- EDI Mapping: EDI 856 (Ship Notice/Manifest)

CREATE TABLE advanced_ship_notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  purchase_order_id UUID NOT NULL,

  -- ASN identification
  asn_number VARCHAR(50) NOT NULL,   -- Auto-generated: ASN-YYYYMMDD-NNNN
  po_number VARCHAR(50) NOT NULL,    -- Reference to PO number

  -- Shipment details
  carrier_code VARCHAR(20) NOT NULL, -- FEDEX, UPS, USPS, DHL, OTHER
  carrier_service VARCHAR(100),      -- Ground, Express, Freight, etc.
  tracking_number VARCHAR(100),
  pro_number VARCHAR(50),            -- Freight PRO number

  -- Dates
  expected_delivery_date DATE NOT NULL,
  actual_ship_date DATE NOT NULL,
  estimated_arrival_date DATE,

  -- Package details
  package_count INTEGER NOT NULL DEFAULT 1,
  total_weight DECIMAL(10,2),
  weight_unit VARCHAR(10) DEFAULT 'LBS',  -- LBS, KG
  total_volume DECIMAL(10,2),
  volume_unit VARCHAR(10),                -- CUFT, CBM

  -- Shipping addresses (denormalized for history)
  ship_from_address JSONB,          -- {name, address1, city, state, zip, country}
  ship_to_address JSONB,

  -- Documents (S3/Azure Blob URLs)
  packing_slip_url TEXT,
  bill_of_lading_url TEXT,
  commercial_invoice_url TEXT,
  other_documents JSONB,             -- Array of {type, url, filename}

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'CREATED',
  -- CREATED: ASN created by supplier
  -- SUBMITTED: ASN submitted to buyer
  -- IN_TRANSIT: Shipment picked up by carrier
  -- RECEIVED: Shipment received at facility
  -- CLOSED: Receiving completed
  -- CANCELLED: ASN cancelled

  -- Receiving information (populated upon receipt)
  received_at TIMESTAMPTZ,
  received_by UUID,                  -- User who received shipment
  receiving_notes TEXT,
  receiving_discrepancies JSONB,     -- Array of {line_id, expected, actual, reason}

  -- Supplier user who created ASN
  created_by_supplier_user_id UUID,

  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT fk_asn_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_asn_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_asn_purchase_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_asn_created_by FOREIGN KEY (created_by_supplier_user_id) REFERENCES supplier_users(id),
  CONSTRAINT chk_asn_status CHECK (status IN ('CREATED', 'SUBMITTED', 'IN_TRANSIT', 'RECEIVED', 'CLOSED', 'CANCELLED')),
  CONSTRAINT chk_asn_weight_unit CHECK (weight_unit IN ('LBS', 'KG')),
  UNIQUE(tenant_id, asn_number)
);

-- Indexes
CREATE INDEX idx_asn_tenant ON advanced_ship_notices(tenant_id);
CREATE INDEX idx_asn_vendor ON advanced_ship_notices(vendor_id);
CREATE INDEX idx_asn_po ON advanced_ship_notices(purchase_order_id);
CREATE INDEX idx_asn_number ON advanced_ship_notices(asn_number);
CREATE INDEX idx_asn_tracking ON advanced_ship_notices(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX idx_asn_status ON advanced_ship_notices(status);
CREATE INDEX idx_asn_expected_delivery ON advanced_ship_notices(expected_delivery_date);
CREATE INDEX idx_asn_created_at ON advanced_ship_notices(created_at DESC);

-- RLS
ALTER TABLE advanced_ship_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY asn_tenant_isolation ON advanced_ship_notices
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================
-- TABLE: asn_lines
-- ============================================
-- Purpose: Line items in ASN (maps to PO lines)
-- Receiving: Enables line-level receiving and discrepancy tracking

CREATE TABLE asn_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  asn_id UUID NOT NULL,
  po_line_id UUID NOT NULL,

  -- Item identification
  material_id UUID,
  sku VARCHAR(100),
  description TEXT,

  -- Quantities
  quantity_shipped DECIMAL(10,2) NOT NULL,
  quantity_ordered DECIMAL(10,2),
  unit_of_measure VARCHAR(20),

  -- Lot/serial tracking
  lot_number VARCHAR(100),
  serial_numbers JSONB,              -- Array of serial numbers
  expiration_date DATE,              -- For perishable materials

  -- Package details
  package_number INTEGER,            -- Which package this line is in (1-N)
  weight DECIMAL(10,2),
  weight_unit VARCHAR(10),

  -- Receiving (populated upon receipt)
  quantity_received DECIMAL(10,2),
  quantity_rejected DECIMAL(10,2),
  rejection_reason VARCHAR(100),
  rejection_notes TEXT,

  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_asn_lines_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_asn_lines_asn FOREIGN KEY (asn_id) REFERENCES advanced_ship_notices(id) ON DELETE CASCADE,
  CONSTRAINT fk_asn_lines_po_line FOREIGN KEY (po_line_id) REFERENCES purchase_order_lines(id)
);

-- Indexes
CREATE INDEX idx_asn_lines_asn ON asn_lines(asn_id);
CREATE INDEX idx_asn_lines_po_line ON asn_lines(po_line_id);
CREATE INDEX idx_asn_lines_material ON asn_lines(material_id);
CREATE INDEX idx_asn_lines_lot ON asn_lines(lot_number) WHERE lot_number IS NOT NULL;

-- RLS
ALTER TABLE asn_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY asn_lines_tenant_isolation ON asn_lines
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================
-- TABLE: po_acknowledgments
-- ============================================
-- Purpose: Track supplier acknowledgments of purchase orders
-- Workflow: Supplier confirms PO and provides promised delivery date

CREATE TABLE po_acknowledgments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  purchase_order_id UUID NOT NULL,
  vendor_id UUID NOT NULL,

  -- Acknowledgment details
  acknowledged_by_supplier_user_id UUID,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Delivery commitment
  promised_delivery_date DATE,
  expected_lead_time_days INTEGER,

  -- Status
  acknowledgment_status VARCHAR(20) NOT NULL DEFAULT 'ACCEPTED',
  -- ACCEPTED: Supplier accepts PO as-is
  -- PARTIAL: Supplier can only fulfill partial quantities
  -- BACKORDERED: Items are backordered
  -- REJECTED: Supplier rejects PO
  -- PRICE_CHANGE: Supplier proposes price change

  -- Notes and changes
  acknowledgment_notes TEXT,
  proposed_changes JSONB,            -- Array of {line_id, field, old_value, new_value, reason}

  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_po_ack_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_po_ack_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_po_ack_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_po_ack_supplier_user FOREIGN KEY (acknowledged_by_supplier_user_id) REFERENCES supplier_users(id),
  CONSTRAINT chk_po_ack_status CHECK (acknowledgment_status IN ('ACCEPTED', 'PARTIAL', 'BACKORDERED', 'REJECTED', 'PRICE_CHANGE')),
  UNIQUE(purchase_order_id)          -- One acknowledgment per PO
);

-- Indexes
CREATE INDEX idx_po_ack_po ON po_acknowledgments(purchase_order_id);
CREATE INDEX idx_po_ack_vendor ON po_acknowledgments(vendor_id);
CREATE INDEX idx_po_ack_status ON po_acknowledgments(acknowledgment_status);
CREATE INDEX idx_po_ack_acknowledged_at ON po_acknowledgments(acknowledged_at DESC);

-- RLS
ALTER TABLE po_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_ack_tenant_isolation ON po_acknowledgments
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================
-- FUNCTION: generate_asn_number
-- ============================================
-- Purpose: Auto-generate ASN numbers in format ASN-YYYYMMDD-NNNN

CREATE OR REPLACE FUNCTION generate_asn_number(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_date_part VARCHAR(8);
  v_sequence_part INTEGER;
  v_asn_number VARCHAR(50);
BEGIN
  -- Get current date in YYYYMMDD format
  v_date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Get next sequence number for today
  SELECT COALESCE(MAX(SUBSTRING(asn_number FROM 13)::INTEGER), 0) + 1
  INTO v_sequence_part
  FROM advanced_ship_notices
  WHERE tenant_id = p_tenant_id
    AND asn_number LIKE 'ASN-' || v_date_part || '-%';

  -- Format: ASN-YYYYMMDD-NNNN
  v_asn_number := 'ASN-' || v_date_part || '-' || LPAD(v_sequence_part::TEXT, 4, '0');

  RETURN v_asn_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: auto_generate_asn_number
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_asn_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.asn_number IS NULL THEN
    NEW.asn_number := generate_asn_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_generate_asn_number
  BEFORE INSERT ON advanced_ship_notices
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_asn_number();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE advanced_ship_notices IS 'Advanced Ship Notices (ASN) from suppliers notifying of incoming shipments (EDI 856)';
COMMENT ON COLUMN advanced_ship_notices.asn_number IS 'Auto-generated ASN number: ASN-YYYYMMDD-NNNN';
COMMENT ON COLUMN advanced_ship_notices.status IS 'ASN lifecycle: CREATED → SUBMITTED → IN_TRANSIT → RECEIVED → CLOSED';
COMMENT ON COLUMN advanced_ship_notices.receiving_discrepancies IS 'Array of receiving variances: {line_id, expected, actual, reason}';

COMMENT ON TABLE asn_lines IS 'Line items in ASN with lot/serial tracking and receiving quantities';
COMMENT ON COLUMN asn_lines.package_number IS 'Which package (1-N) contains this line item for multi-package shipments';

COMMENT ON TABLE po_acknowledgments IS 'Supplier acknowledgments of purchase orders with delivery commitments';
COMMENT ON COLUMN po_acknowledgments.acknowledgment_status IS 'ACCEPTED, PARTIAL, BACKORDERED, REJECTED, or PRICE_CHANGE';
COMMENT ON COLUMN po_acknowledgments.proposed_changes IS 'Array of supplier-proposed changes to PO: {line_id, field, old_value, new_value, reason}';

COMMENT ON FUNCTION generate_asn_number(UUID) IS 'Auto-generate ASN number: ASN-YYYYMMDD-NNNN with daily sequence';
