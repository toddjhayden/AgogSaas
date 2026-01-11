-- V0.0.82: Create Centralized Notification System
-- REQ: REQ-1767925582665-67qxb
-- Purpose: Unified notification management for all system alerts and messages

-- ============================================================================
-- NOTIFICATION TYPES
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  default_channel VARCHAR(20) DEFAULT 'IN_APP',
  can_disable BOOLEAN DEFAULT TRUE,
  priority VARCHAR(20) DEFAULT 'NORMAL',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE notification_types IS 'Defines all possible notification types in the system';
COMMENT ON COLUMN notification_types.code IS 'Unique identifier code (e.g., VENDOR_ALERT, MAINTENANCE_ALERT)';
COMMENT ON COLUMN notification_types.default_channel IS 'Default delivery channel: EMAIL, IN_APP, SMS, NATS';
COMMENT ON COLUMN notification_types.can_disable IS 'Whether users can disable this notification type';
COMMENT ON COLUMN notification_types.priority IS 'CRITICAL, HIGH, NORMAL, LOW';

-- ============================================================================
-- NOTIFICATION TEMPLATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID,
  notification_type_id UUID NOT NULL REFERENCES notification_types(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  subject_template TEXT,
  body_template TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_notification_templates_tenant_type ON notification_templates(tenant_id, notification_type_id);
CREATE INDEX idx_notification_templates_channel ON notification_templates(channel);

COMMENT ON TABLE notification_templates IS 'Templates for notification messages across different channels';
COMMENT ON COLUMN notification_templates.channel IS 'EMAIL, IN_APP, SMS, NATS';
COMMENT ON COLUMN notification_templates.variables IS 'Array of variable names used in template (e.g., ["vendorName", "alertMessage"])';

-- ============================================================================
-- USER NOTIFICATION PREFERENCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  notification_type_id UUID NOT NULL REFERENCES notification_types(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, user_id, notification_type_id, channel)
);

CREATE INDEX idx_user_notification_prefs_user ON user_notification_preferences(tenant_id, user_id);
CREATE INDEX idx_user_notification_prefs_type ON user_notification_preferences(notification_type_id);

COMMENT ON TABLE user_notification_preferences IS 'User-specific notification channel preferences';
COMMENT ON COLUMN user_notification_preferences.quiet_hours_start IS 'Do not send notifications during this time range';

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  notification_type_id UUID NOT NULL REFERENCES notification_types(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'INFO',
  priority VARCHAR(20) DEFAULT 'NORMAL',
  category VARCHAR(50),
  source_entity_type VARCHAR(50),
  source_entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user ON notifications(tenant_id, user_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type_id);
CREATE INDEX idx_notifications_unread ON notifications(tenant_id, user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_source ON notifications(source_entity_type, source_entity_id);

COMMENT ON TABLE notifications IS 'Central repository for all user notifications';
COMMENT ON COLUMN notifications.severity IS 'CRITICAL, WARNING, INFO';
COMMENT ON COLUMN notifications.priority IS 'CRITICAL, HIGH, NORMAL, LOW';
COMMENT ON COLUMN notifications.category IS 'Grouping category (e.g., VENDOR, MAINTENANCE, FINANCE)';
COMMENT ON COLUMN notifications.source_entity_type IS 'Type of source entity (e.g., VendorAlert, MaintenanceAlert)';
COMMENT ON COLUMN notifications.source_entity_id IS 'ID of the source entity';
COMMENT ON COLUMN notifications.metadata IS 'Additional context data (action links, details, etc.)';

-- ============================================================================
-- NOTIFICATION DELIVERIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  recipient_address VARCHAR(255),
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  external_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_deliveries_notification ON notification_deliveries(notification_id);
CREATE INDEX idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX idx_notification_deliveries_channel ON notification_deliveries(channel);
CREATE INDEX idx_notification_deliveries_pending ON notification_deliveries(status, channel) WHERE status = 'PENDING';

COMMENT ON TABLE notification_deliveries IS 'Tracks delivery attempts for each notification across channels';
COMMENT ON COLUMN notification_deliveries.channel IS 'EMAIL, IN_APP, SMS, NATS';
COMMENT ON COLUMN notification_deliveries.status IS 'PENDING, SENDING, DELIVERED, FAILED, SKIPPED';
COMMENT ON COLUMN notification_deliveries.recipient_address IS 'Email address, phone number, or NATS topic';
COMMENT ON COLUMN notification_deliveries.external_id IS 'External service message ID (e.g., SendGrid ID)';

-- ============================================================================
-- NOTIFICATION EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_events_notification ON notification_events(notification_id);
CREATE INDEX idx_notification_events_type ON notification_events(event_type);
CREATE INDEX idx_notification_events_created ON notification_events(created_at DESC);

COMMENT ON TABLE notification_events IS 'Audit trail for notification lifecycle events';
COMMENT ON COLUMN notification_events.event_type IS 'CREATED, READ, ARCHIVED, DELIVERED, FAILED, etc.';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

-- User notification preferences policies
CREATE POLICY user_notification_preferences_tenant_isolation ON user_notification_preferences
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY user_notification_preferences_own_only ON user_notification_preferences
  USING (user_id::TEXT = current_setting('app.current_user_id', TRUE));

-- Notifications policies
CREATE POLICY notifications_tenant_isolation ON notifications
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY notifications_own_only ON notifications
  USING (user_id::TEXT = current_setting('app.current_user_id', TRUE));

-- Notification deliveries policies (via notification)
CREATE POLICY notification_deliveries_tenant_isolation ON notification_deliveries
  USING (
    EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.id = notification_deliveries.notification_id
        AND n.tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE)
    )
  );

-- ============================================================================
-- DEFAULT NOTIFICATION TYPES
-- ============================================================================
INSERT INTO notification_types (code, name, description, default_channel, can_disable, priority) VALUES
  ('VENDOR_PERFORMANCE_ALERT', 'Vendor Performance Alert', 'Alerts from vendor performance monitoring', 'IN_APP', TRUE, 'NORMAL'),
  ('VENDOR_ESG_ALERT', 'Vendor ESG Alert', 'ESG risk and audit alerts', 'EMAIL', FALSE, 'HIGH'),
  ('PREDICTIVE_MAINTENANCE_ALERT', 'Predictive Maintenance Alert', 'AI-driven maintenance predictions', 'EMAIL', FALSE, 'CRITICAL'),
  ('APPROVAL_REQUEST', 'Approval Request', 'Purchase order and workflow approvals', 'EMAIL', FALSE, 'HIGH'),
  ('APPROVAL_DECISION', 'Approval Decision', 'Notification of approval/rejection', 'IN_APP', TRUE, 'NORMAL'),
  ('DEPLOYMENT_ALERT', 'Deployment Alert', 'DevOps deployment notifications', 'IN_APP', TRUE, 'NORMAL'),
  ('SYSTEM_ALERT', 'System Alert', 'Critical system errors and warnings', 'EMAIL', FALSE, 'CRITICAL'),
  ('INVOICE_REMINDER', 'Invoice Reminder', 'Payment due date reminders', 'EMAIL', TRUE, 'NORMAL'),
  ('ORDER_STATUS_CHANGE', 'Order Status Change', 'Purchase order status updates', 'IN_APP', TRUE, 'NORMAL'),
  ('QUALITY_ALERT', 'Quality Alert', 'SPC and quality control alerts', 'EMAIL', FALSE, 'HIGH'),
  ('INVENTORY_ALERT', 'Inventory Alert', 'Low stock and reorder alerts', 'IN_APP', TRUE, 'NORMAL'),
  ('WORKFLOW_TASK_ASSIGNED', 'Workflow Task Assigned', 'New task assignments', 'EMAIL', TRUE, 'NORMAL'),
  ('WORKFLOW_TASK_COMPLETED', 'Workflow Task Completed', 'Task completion notifications', 'IN_APP', TRUE, 'LOW');

-- ============================================================================
-- DEFAULT EMAIL TEMPLATES
-- ============================================================================
INSERT INTO notification_templates (notification_type_id, channel, subject_template, body_template, variables) VALUES
  (
    (SELECT id FROM notification_types WHERE code = 'VENDOR_PERFORMANCE_ALERT'),
    'EMAIL',
    'Vendor Alert: {{vendorName}} - {{severity}}',
    '<h2>Vendor Performance Alert</h2>
<p><strong>Vendor:</strong> {{vendorName}} ({{vendorCode}})</p>
<p><strong>Severity:</strong> {{severity}}</p>
<p><strong>Alert Type:</strong> {{alertType}}</p>
<p><strong>Message:</strong></p>
<p>{{message}}</p>
<p><strong>Current Value:</strong> {{currentValue}}</p>
<p><strong>Threshold:</strong> {{thresholdValue}}</p>
<hr>
<p><a href="{{actionUrl}}">View Alert Details</a></p>',
    '["vendorName", "vendorCode", "severity", "alertType", "message", "currentValue", "thresholdValue", "actionUrl"]'::jsonb
  ),
  (
    (SELECT id FROM notification_types WHERE code = 'PREDICTIVE_MAINTENANCE_ALERT'),
    'EMAIL',
    'Maintenance Alert: {{workCenterName}} - {{urgency}}',
    '<h2>Predictive Maintenance Alert</h2>
<p><strong>Equipment:</strong> {{workCenterName}}</p>
<p><strong>Urgency:</strong> {{urgency}}</p>
<p><strong>Predicted Failure Mode:</strong> {{failureMode}}</p>
<p><strong>Failure Probability:</strong> {{failureProbability}}%</p>
<p><strong>Estimated Time to Failure:</strong> {{timeToFailure}} hours</p>
<p><strong>Recommended Action:</strong></p>
<p>{{recommendedAction}}</p>
<hr>
<p><a href="{{actionUrl}}">View Maintenance Alert</a></p>',
    '["workCenterName", "urgency", "failureMode", "failureProbability", "timeToFailure", "recommendedAction", "actionUrl"]'::jsonb
  ),
  (
    (SELECT id FROM notification_types WHERE code = 'APPROVAL_REQUEST'),
    'EMAIL',
    'Approval Required: {{entityType}} #{{entityNumber}}',
    '<h2>Approval Request</h2>
<p><strong>Type:</strong> {{entityType}}</p>
<p><strong>Number:</strong> {{entityNumber}}</p>
<p><strong>Amount:</strong> {{amount}}</p>
<p><strong>Requester:</strong> {{requesterName}}</p>
<p><strong>Due Date:</strong> {{dueDate}}</p>
<p><strong>Description:</strong></p>
<p>{{description}}</p>
<hr>
<p><a href="{{actionUrl}}">Review and Approve</a></p>',
    '["entityType", "entityNumber", "amount", "requesterName", "dueDate", "description", "actionUrl"]'::jsonb
  );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE,
      read_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_notification_id
    AND is_read = FALSE;

  -- Log event
  INSERT INTO notification_events (notification_id, event_type)
  VALUES (p_notification_id, 'READ');
END;
$$ LANGUAGE plpgsql;

-- Function to archive notification
CREATE OR REPLACE FUNCTION archive_notification(
  p_notification_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_archived = TRUE,
      archived_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_notification_id
    AND is_archived = FALSE;

  -- Log event
  INSERT INTO notification_events (notification_id, event_type)
  VALUES (p_notification_id, 'ARCHIVED');
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM notifications
    WHERE expires_at IS NOT NULL
      AND expires_at < CURRENT_TIMESTAMP
      AND is_archived = TRUE
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT ON notification_types TO app_user;
GRANT SELECT, INSERT, UPDATE ON notification_templates TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_notification_preferences TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO app_user;
GRANT SELECT, INSERT, UPDATE ON notification_deliveries TO app_user;
GRANT SELECT, INSERT ON notification_events TO app_user;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
