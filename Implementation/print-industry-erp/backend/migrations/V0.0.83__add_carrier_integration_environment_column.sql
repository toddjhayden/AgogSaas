-- =====================================================
-- FLYWAY MIGRATION V0.0.83
-- =====================================================
-- Purpose: Add environment column to carrier_integrations and missing columns for carrier integration
-- Tables: carrier_integrations, shipments
-- Dependencies: V0.0.4 (WMS core)
-- Created: 2026-01-10
-- Requirement: REQ-1767925582663-ieqg0 - Complete FedEx Carrier Integration & Multi-Carrier Network
-- =====================================================

-- =====================================================
-- ALTER TABLE: carrier_integrations
-- =====================================================
-- Add environment column to distinguish TEST vs PRODUCTION API endpoints

ALTER TABLE carrier_integrations
ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'TEST';

COMMENT ON COLUMN carrier_integrations.environment IS 'API environment: TEST or PRODUCTION';

-- Update existing records to default to TEST for safety
UPDATE carrier_integrations
SET environment = 'TEST'
WHERE environment IS NULL;

-- Add NOT NULL constraint after populating
ALTER TABLE carrier_integrations
ALTER COLUMN environment SET NOT NULL;

-- =====================================================
-- ALTER TABLE: shipments
-- =====================================================
-- Add missing columns used by carrier integration code

-- Add ship_to_email for customer notifications
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS ship_to_email VARCHAR(255);

COMMENT ON COLUMN shipments.ship_to_email IS 'Customer email for shipment notifications';

-- Rename carrier_service_code to service_level for consistency with code
ALTER TABLE shipments
RENAME COLUMN carrier_service_code TO service_level;

-- Rename carrier_service_name to carrier_name for clarity
ALTER TABLE shipments
RENAME COLUMN carrier_service_name TO carrier_name;

-- Rename total_packages to number_of_packages for consistency with code
ALTER TABLE shipments
RENAME COLUMN total_packages TO number_of_packages;

-- Rename total_weight_lbs to total_weight for clarity (unit stored separately)
ALTER TABLE shipments
RENAME COLUMN total_weight_lbs TO total_weight;

-- Rename shipping_cost to freight for consistency with code
ALTER TABLE shipments
RENAME COLUMN shipping_cost TO freight;

-- Rename insurance_cost to insurance for consistency
ALTER TABLE shipments
RENAME COLUMN insurance_cost TO insurance;

-- Rename shipping_label_url to label_url for brevity
ALTER TABLE shipments
RENAME COLUMN shipping_label_url TO label_url;

-- Add total_cost column for total shipment cost (freight + insurance + surcharges)
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(18,4);

COMMENT ON COLUMN shipments.total_cost IS 'Total shipment cost including freight, insurance, and surcharges';

-- Add shipping_notes column for special instructions
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS shipping_notes TEXT;

COMMENT ON COLUMN shipments.shipping_notes IS 'Special shipping instructions or notes';

-- =====================================================
-- ALTER TABLE: tracking_events
-- =====================================================
-- Align column names with code expectations

-- Rename event_code to carrier_event_code for clarity
ALTER TABLE tracking_events
RENAME COLUMN event_code TO carrier_event_code;

-- Rename event_description to event_description (already correct)
-- Rename event_timestamp to event_date for consistency with code
ALTER TABLE tracking_events
RENAME COLUMN event_timestamp TO event_date;

-- Rename event_city to location_city for consistency
ALTER TABLE tracking_events
RENAME COLUMN event_city TO location_city;

-- Rename event_state to location_state for consistency
ALTER TABLE tracking_events
RENAME COLUMN event_state TO location_state;

-- Rename event_country to location_country for consistency
ALTER TABLE tracking_events
RENAME COLUMN event_country TO location_country;

-- Rename is_exception to exception_flag for consistency
ALTER TABLE tracking_events
RENAME COLUMN is_exception TO exception_flag;

-- Add event_type column for standardized status codes
ALTER TABLE tracking_events
ADD COLUMN IF NOT EXISTS event_type VARCHAR(50);

COMMENT ON COLUMN tracking_events.event_type IS 'Standardized event type: LABEL_CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION, RETURNED, CANCELLED';

-- Add location_postal_code for full address tracking
ALTER TABLE tracking_events
ADD COLUMN IF NOT EXISTS location_postal_code VARCHAR(20);

COMMENT ON COLUMN tracking_events.location_postal_code IS 'Postal code of event location';

-- =====================================================
-- Update Indexes
-- =====================================================

-- Drop old index on renamed column
DROP INDEX IF EXISTS idx_tracking_events_timestamp;

-- Create new index on renamed column
CREATE INDEX IF NOT EXISTS idx_tracking_events_event_date ON tracking_events(event_date);

-- Add index on event_type for filtering
CREATE INDEX IF NOT EXISTS idx_tracking_events_event_type ON tracking_events(event_type);

-- =====================================================
-- Grant Permissions
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agogsaas_user') THEN
    -- Permissions already granted in V0.0.4, no additional grants needed
    NULL;
  END IF;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration V0.0.83 completed: Carrier integration enhancements';
  RAISE NOTICE '  - Added carrier_integrations.environment column (TEST/PRODUCTION)';
  RAISE NOTICE '  - Added shipments.ship_to_email column';
  RAISE NOTICE '  - Added shipments.total_cost column';
  RAISE NOTICE '  - Added shipments.shipping_notes column';
  RAISE NOTICE '  - Renamed shipments columns for code consistency';
  RAISE NOTICE '  - Added tracking_events.event_type column';
  RAISE NOTICE '  - Added tracking_events.location_postal_code column';
  RAISE NOTICE '  - Renamed tracking_events columns for code consistency';
  RAISE NOTICE '  - Updated indexes for renamed columns';
END $$;
