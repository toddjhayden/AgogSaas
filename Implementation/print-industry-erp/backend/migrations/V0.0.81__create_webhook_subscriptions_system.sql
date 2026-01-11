/**
 * Webhook Subscriptions & Event Delivery System
 * REQ-1767925582664-n6du5
 *
 * Generic webhook system allowing tenants to subscribe to application events
 * and receive notifications via HTTP POST to their endpoints.
 *
 * Features:
 * - Multi-tenant webhook subscriptions
 * - Event type filtering
 * - Retry logic with exponential backoff
 * - Delivery tracking and audit trail
 * - Signature verification for security
 * - Rate limiting per subscription
 */

-- =====================================================
-- WEBHOOK SUBSCRIPTIONS
-- =====================================================

CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Subscription Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  endpoint_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Event Filtering
  event_types TEXT[] NOT NULL, -- Array of event types to subscribe to (e.g., 'invoice.created', 'payment.received')
  event_filters JSONB, -- Optional filters for event data (e.g., {"status": "PAID", "amount_gte": 1000})

  -- Security
  secret_key VARCHAR(255) NOT NULL, -- HMAC secret for signature verification
  signature_header VARCHAR(100) NOT NULL DEFAULT 'X-Webhook-Signature',
  signature_algorithm VARCHAR(50) NOT NULL DEFAULT 'sha256', -- sha256, sha512

  -- Retry Configuration
  max_retry_attempts INTEGER NOT NULL DEFAULT 5,
  retry_backoff_multiplier DECIMAL(3,2) NOT NULL DEFAULT 2.0, -- Exponential backoff multiplier
  initial_retry_delay_seconds INTEGER NOT NULL DEFAULT 60, -- Initial retry delay (60 seconds)
  max_retry_delay_seconds INTEGER NOT NULL DEFAULT 3600, -- Max retry delay (1 hour)

  -- Rate Limiting
  max_events_per_minute INTEGER, -- NULL = no limit
  max_events_per_hour INTEGER, -- NULL = no limit
  max_events_per_day INTEGER, -- NULL = no limit

  -- Request Configuration
  timeout_seconds INTEGER NOT NULL DEFAULT 30,
  custom_headers JSONB, -- Additional HTTP headers to include

  -- Statistics
  total_events_sent BIGINT NOT NULL DEFAULT 0,
  total_events_failed BIGINT NOT NULL DEFAULT 0,
  last_successful_delivery_at TIMESTAMPTZ,
  last_failed_delivery_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,

  -- Health Status
  health_status VARCHAR(50) NOT NULL DEFAULT 'HEALTHY', -- HEALTHY, DEGRADED, FAILING, SUSPENDED
  health_checked_at TIMESTAMPTZ,
  auto_disabled_at TIMESTAMPTZ, -- Automatically disabled after too many failures
  auto_disabled_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT webhook_subscriptions_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT webhook_subscriptions_url_check CHECK (endpoint_url ~ '^https?://'),
  CONSTRAINT webhook_subscriptions_event_types_check CHECK (array_length(event_types, 1) > 0),
  CONSTRAINT webhook_subscriptions_retry_attempts_check CHECK (max_retry_attempts >= 0 AND max_retry_attempts <= 10),
  CONSTRAINT webhook_subscriptions_timeout_check CHECK (timeout_seconds > 0 AND timeout_seconds <= 300),
  CONSTRAINT webhook_subscriptions_health_status_check CHECK (health_status IN ('HEALTHY', 'DEGRADED', 'FAILING', 'SUSPENDED'))
);

-- Indexes
CREATE INDEX idx_webhook_subscriptions_tenant_active ON webhook_subscriptions(tenant_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_webhook_subscriptions_event_types ON webhook_subscriptions USING GIN(event_types) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_webhook_subscriptions_health ON webhook_subscriptions(health_status) WHERE deleted_at IS NULL AND is_active = true;

-- RLS Policies
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_subscriptions_tenant_isolation ON webhook_subscriptions
  FOR ALL
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

COMMENT ON TABLE webhook_subscriptions IS 'Tenant webhook subscriptions for receiving application events';

-- =====================================================
-- WEBHOOK EVENTS
-- =====================================================

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Event Details
  event_type VARCHAR(255) NOT NULL, -- e.g., 'invoice.created', 'payment.received', 'order.shipped'
  event_version VARCHAR(20) NOT NULL DEFAULT '1.0',
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Event Data
  event_data JSONB NOT NULL, -- The actual event payload
  event_metadata JSONB, -- Additional metadata (user_id, ip_address, etc.)

  -- Source
  source_entity_type VARCHAR(100), -- e.g., 'invoice', 'payment', 'order'
  source_entity_id UUID, -- Reference to the entity that triggered the event

  -- Delivery Tracking
  total_subscriptions_matched INTEGER NOT NULL DEFAULT 0,
  total_deliveries_succeeded INTEGER NOT NULL DEFAULT 0,
  total_deliveries_failed INTEGER NOT NULL DEFAULT 0,
  total_deliveries_pending INTEGER NOT NULL DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT webhook_events_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_webhook_events_tenant_type ON webhook_events(tenant_id, event_type, event_timestamp DESC);
CREATE INDEX idx_webhook_events_source ON webhook_events(source_entity_type, source_entity_id) WHERE source_entity_id IS NOT NULL;
CREATE INDEX idx_webhook_events_timestamp ON webhook_events(event_timestamp DESC);
CREATE INDEX idx_webhook_events_data ON webhook_events USING GIN(event_data); -- For JSONB queries

-- RLS Policies
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_events_tenant_isolation ON webhook_events
  FOR ALL
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

COMMENT ON TABLE webhook_events IS 'Application events published to webhook subscriptions';

-- =====================================================
-- WEBHOOK DELIVERIES
-- =====================================================

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- References
  subscription_id UUID NOT NULL,
  event_id UUID NOT NULL,

  -- Delivery Details
  attempt_number INTEGER NOT NULL DEFAULT 1,
  delivery_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SENDING, SUCCEEDED, FAILED, ABANDONED

  -- Request/Response
  request_url TEXT NOT NULL,
  request_headers JSONB,
  request_body JSONB NOT NULL,
  request_signature VARCHAR(255), -- HMAC signature sent with request

  response_status_code INTEGER,
  response_headers JSONB,
  response_body TEXT,
  response_time_ms INTEGER,

  -- Error Tracking
  error_message TEXT,
  error_code VARCHAR(100),
  error_details JSONB,

  -- Retry Scheduling
  next_retry_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,

  -- Timing
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT webhook_deliveries_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT webhook_deliveries_subscription_fk FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  CONSTRAINT webhook_deliveries_event_fk FOREIGN KEY (event_id) REFERENCES webhook_events(id) ON DELETE CASCADE,
  CONSTRAINT webhook_deliveries_attempt_check CHECK (attempt_number > 0 AND attempt_number <= 10),
  CONSTRAINT webhook_deliveries_status_check CHECK (delivery_status IN ('PENDING', 'SENDING', 'SUCCEEDED', 'FAILED', 'ABANDONED'))
);

-- Indexes
CREATE INDEX idx_webhook_deliveries_subscription ON webhook_deliveries(subscription_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(event_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(delivery_status, next_retry_at) WHERE delivery_status IN ('PENDING', 'FAILED');
CREATE INDEX idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE next_retry_at IS NOT NULL AND delivery_status = 'FAILED';

-- RLS Policies
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_deliveries_tenant_isolation ON webhook_deliveries
  FOR ALL
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

COMMENT ON TABLE webhook_deliveries IS 'Webhook delivery attempts and responses';

-- =====================================================
-- WEBHOOK EVENT TYPES CATALOG
-- =====================================================

CREATE TABLE webhook_event_types (
  event_type VARCHAR(255) PRIMARY KEY,

  -- Metadata
  category VARCHAR(100) NOT NULL, -- e.g., 'finance', 'sales', 'inventory', 'production'
  display_name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,

  -- Versioning
  current_version VARCHAR(20) NOT NULL DEFAULT '1.0',
  deprecated BOOLEAN NOT NULL DEFAULT false,
  deprecated_at TIMESTAMPTZ,
  replacement_event_type VARCHAR(255),

  -- Schema
  payload_schema JSONB, -- JSON Schema for event payload
  example_payload JSONB, -- Example event data

  -- Usage
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  total_events_published BIGINT NOT NULL DEFAULT 0,
  last_published_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT webhook_event_types_replacement_fk FOREIGN KEY (replacement_event_type) REFERENCES webhook_event_types(event_type)
);

-- Indexes
CREATE INDEX idx_webhook_event_types_category ON webhook_event_types(category, is_enabled) WHERE deprecated = false;

COMMENT ON TABLE webhook_event_types IS 'Catalog of available webhook event types';

-- =====================================================
-- WEBHOOK DELIVERY LOGS (for debugging)
-- =====================================================

CREATE TABLE webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  delivery_id UUID NOT NULL,

  -- Log Entry
  log_level VARCHAR(20) NOT NULL, -- DEBUG, INFO, WARN, ERROR
  log_message TEXT NOT NULL,
  log_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT webhook_delivery_logs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT webhook_delivery_logs_delivery_fk FOREIGN KEY (delivery_id) REFERENCES webhook_deliveries(id) ON DELETE CASCADE,
  CONSTRAINT webhook_delivery_logs_level_check CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR'))
);

-- Indexes
CREATE INDEX idx_webhook_delivery_logs_delivery ON webhook_delivery_logs(delivery_id, created_at DESC);
CREATE INDEX idx_webhook_delivery_logs_level ON webhook_delivery_logs(log_level, created_at DESC) WHERE log_level IN ('WARN', 'ERROR');

-- RLS Policies
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_delivery_logs_tenant_isolation ON webhook_delivery_logs
  FOR ALL
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

COMMENT ON TABLE webhook_delivery_logs IS 'Detailed logs for webhook delivery debugging';

-- =====================================================
-- SEED DATA - Standard Event Types
-- =====================================================

INSERT INTO webhook_event_types (event_type, category, display_name, description, payload_schema) VALUES
-- Finance Events
('invoice.created', 'finance', 'Invoice Created', 'Triggered when a new invoice is created', '{"type": "object", "properties": {"invoice_id": {"type": "string"}, "customer_id": {"type": "string"}, "total_amount": {"type": "number"}}}'),
('invoice.updated', 'finance', 'Invoice Updated', 'Triggered when an invoice is updated', '{"type": "object", "properties": {"invoice_id": {"type": "string"}, "changes": {"type": "object"}}}'),
('invoice.voided', 'finance', 'Invoice Voided', 'Triggered when an invoice is voided', '{"type": "object", "properties": {"invoice_id": {"type": "string"}, "reason": {"type": "string"}}}'),
('payment.received', 'finance', 'Payment Received', 'Triggered when a payment is received', '{"type": "object", "properties": {"payment_id": {"type": "string"}, "invoice_id": {"type": "string"}, "amount": {"type": "number"}}}'),
('payment.failed', 'finance', 'Payment Failed', 'Triggered when a payment attempt fails', '{"type": "object", "properties": {"payment_id": {"type": "string"}, "error": {"type": "string"}}}'),

-- Sales Events
('quote.created', 'sales', 'Quote Created', 'Triggered when a new quote is created', '{"type": "object", "properties": {"quote_id": {"type": "string"}, "customer_id": {"type": "string"}}}'),
('quote.approved', 'sales', 'Quote Approved', 'Triggered when a quote is approved', '{"type": "object", "properties": {"quote_id": {"type": "string"}, "approved_by": {"type": "string"}}}'),
('quote.converted', 'sales', 'Quote Converted to Order', 'Triggered when a quote is converted to an order', '{"type": "object", "properties": {"quote_id": {"type": "string"}, "order_id": {"type": "string"}}}'),
('order.created', 'sales', 'Order Created', 'Triggered when a new order is created', '{"type": "object", "properties": {"order_id": {"type": "string"}, "customer_id": {"type": "string"}}}'),
('order.updated', 'sales', 'Order Updated', 'Triggered when an order is updated', '{"type": "object", "properties": {"order_id": {"type": "string"}, "changes": {"type": "object"}}}'),

-- Production Events
('job.created', 'production', 'Job Created', 'Triggered when a production job is created', '{"type": "object", "properties": {"job_id": {"type": "string"}, "order_id": {"type": "string"}}}'),
('job.started', 'production', 'Job Started', 'Triggered when a production job starts', '{"type": "object", "properties": {"job_id": {"type": "string"}, "started_at": {"type": "string"}}}'),
('job.completed', 'production', 'Job Completed', 'Triggered when a production job is completed', '{"type": "object", "properties": {"job_id": {"type": "string"}, "completed_at": {"type": "string"}}}'),

-- Inventory Events
('inventory.low_stock', 'inventory', 'Low Stock Alert', 'Triggered when inventory falls below minimum threshold', '{"type": "object", "properties": {"item_id": {"type": "string"}, "current_quantity": {"type": "number"}, "minimum_quantity": {"type": "number"}}}'),
('inventory.received', 'inventory', 'Inventory Received', 'Triggered when inventory is received', '{"type": "object", "properties": {"item_id": {"type": "string"}, "quantity": {"type": "number"}, "po_id": {"type": "string"}}}'),

-- Shipping Events
('shipment.created', 'shipping', 'Shipment Created', 'Triggered when a shipment is created', '{"type": "object", "properties": {"shipment_id": {"type": "string"}, "order_id": {"type": "string"}}}'),
('shipment.shipped', 'shipping', 'Shipment Shipped', 'Triggered when a shipment is shipped', '{"type": "object", "properties": {"shipment_id": {"type": "string"}, "tracking_number": {"type": "string"}}}'),
('shipment.delivered', 'shipping', 'Shipment Delivered', 'Triggered when a shipment is delivered', '{"type": "object", "properties": {"shipment_id": {"type": "string"}, "delivered_at": {"type": "string"}}}');

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

/**
 * Function to calculate next retry delay based on exponential backoff
 */
CREATE OR REPLACE FUNCTION calculate_next_retry_delay(
  p_retry_count INTEGER,
  p_initial_delay_seconds INTEGER,
  p_backoff_multiplier DECIMAL,
  p_max_delay_seconds INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_delay_seconds INTEGER;
BEGIN
  -- Calculate exponential backoff: initial_delay * (multiplier ^ retry_count)
  v_delay_seconds := LEAST(
    p_initial_delay_seconds * POWER(p_backoff_multiplier, p_retry_count),
    p_max_delay_seconds
  )::INTEGER;

  RETURN v_delay_seconds;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_next_retry_delay IS 'Calculate next retry delay using exponential backoff';

/**
 * Function to update webhook subscription health status
 */
CREATE OR REPLACE FUNCTION update_webhook_subscription_health() RETURNS TRIGGER AS $$
BEGIN
  -- Update subscription statistics based on delivery result
  IF NEW.delivery_status = 'SUCCEEDED' THEN
    UPDATE webhook_subscriptions
    SET
      total_events_sent = total_events_sent + 1,
      last_successful_delivery_at = NEW.completed_at,
      consecutive_failures = 0,
      health_status = CASE
        WHEN health_status = 'SUSPENDED' THEN 'DEGRADED' -- Recover from suspension
        ELSE 'HEALTHY'
      END,
      health_checked_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.subscription_id;

  ELSIF NEW.delivery_status = 'FAILED' OR NEW.delivery_status = 'ABANDONED' THEN
    UPDATE webhook_subscriptions
    SET
      total_events_failed = total_events_failed + 1,
      last_failed_delivery_at = NEW.completed_at,
      consecutive_failures = consecutive_failures + 1,
      health_status = CASE
        WHEN consecutive_failures + 1 >= 50 THEN 'SUSPENDED'
        WHEN consecutive_failures + 1 >= 20 THEN 'FAILING'
        WHEN consecutive_failures + 1 >= 10 THEN 'DEGRADED'
        ELSE health_status
      END,
      -- Auto-disable after 50 consecutive failures
      is_active = CASE
        WHEN consecutive_failures + 1 >= 50 THEN false
        ELSE is_active
      END,
      auto_disabled_at = CASE
        WHEN consecutive_failures + 1 >= 50 THEN NOW()
        ELSE auto_disabled_at
      END,
      auto_disabled_reason = CASE
        WHEN consecutive_failures + 1 >= 50 THEN '50 consecutive delivery failures'
        ELSE auto_disabled_reason
      END,
      health_checked_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.subscription_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_delivery_health_update
  AFTER UPDATE OF delivery_status ON webhook_deliveries
  FOR EACH ROW
  WHEN (NEW.delivery_status IN ('SUCCEEDED', 'FAILED', 'ABANDONED'))
  EXECUTE FUNCTION update_webhook_subscription_health();

COMMENT ON TRIGGER webhook_delivery_health_update ON webhook_deliveries IS 'Update subscription health metrics after delivery completion';

/**
 * Function to update event delivery statistics
 */
CREATE OR REPLACE FUNCTION update_webhook_event_stats() RETURNS TRIGGER AS $$
BEGIN
  UPDATE webhook_events
  SET
    total_deliveries_succeeded = CASE WHEN NEW.delivery_status = 'SUCCEEDED' THEN total_deliveries_succeeded + 1 ELSE total_deliveries_succeeded END,
    total_deliveries_failed = CASE WHEN NEW.delivery_status IN ('FAILED', 'ABANDONED') THEN total_deliveries_failed + 1 ELSE total_deliveries_failed END,
    total_deliveries_pending = CASE WHEN NEW.delivery_status = 'PENDING' THEN total_deliveries_pending + 1 ELSE total_deliveries_pending END
  WHERE id = NEW.event_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_delivery_event_stats_update
  AFTER INSERT OR UPDATE OF delivery_status ON webhook_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_event_stats();

COMMENT ON TRIGGER webhook_delivery_event_stats_update ON webhook_deliveries IS 'Update event statistics after delivery status changes';
