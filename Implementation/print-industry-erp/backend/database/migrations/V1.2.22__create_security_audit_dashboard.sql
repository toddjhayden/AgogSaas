-- =====================================================
-- Security Audit Dashboard Infrastructure
-- REQ-DEVOPS-SECURITY-1767150339448
-- =====================================================
-- Creates comprehensive security audit tracking and analytics
-- for real-time threat detection and compliance reporting
-- =====================================================

-- Security Audit Event Types
CREATE TYPE security_event_type AS ENUM (
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGOUT',
    'PASSWORD_CHANGE',
    'PASSWORD_RESET',
    'PERMISSION_DENIED',
    'ZONE_ACCESS_GRANTED',
    'ZONE_ACCESS_DENIED',
    'SUSPICIOUS_ACTIVITY',
    'DATA_EXPORT',
    'DATA_MODIFICATION',
    'CONFIG_CHANGE',
    'USER_CREATED',
    'USER_MODIFIED',
    'USER_DELETED',
    'ROLE_CHANGED',
    'API_KEY_CREATED',
    'API_KEY_REVOKED',
    'SESSION_TIMEOUT',
    'CONCURRENT_SESSION',
    'BRUTE_FORCE_ATTEMPT'
);

-- Security Risk Levels
CREATE TYPE security_risk_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- =====================================================
-- SECURITY AUDIT EVENTS
-- =====================================================
-- Centralized security event logging with correlation
CREATE TABLE security_audit_events (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id),

    -- Event identification
    event_type security_event_type NOT NULL,
    event_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    correlation_id UUID, -- For linking related events

    -- Actor information
    user_id INTEGER REFERENCES users(user_id),
    username VARCHAR(255),
    ip_address INET NOT NULL,
    user_agent TEXT,
    session_id VARCHAR(255),

    -- Target information
    target_resource VARCHAR(500), -- e.g., "users/123", "zones/vault"
    target_type VARCHAR(100), -- e.g., "USER", "ZONE", "API_KEY"

    -- Event details
    risk_level security_risk_level NOT NULL DEFAULT 'LOW',
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    metadata JSONB, -- Additional context

    -- Geographic/location data
    country_code CHAR(2),
    city VARCHAR(255),
    location POINT, -- lat/long for geo mapping

    -- Threat detection
    anomaly_score NUMERIC(5,2), -- 0-100 anomaly score
    flagged_suspicious BOOLEAN DEFAULT FALSE,
    auto_blocked BOOLEAN DEFAULT FALSE,

    -- Audit trail
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Indexes for performance
    CONSTRAINT security_audit_events_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id)
        ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX idx_security_audit_events_tenant
    ON security_audit_events(tenant_id, event_timestamp DESC);
CREATE INDEX idx_security_audit_events_user
    ON security_audit_events(user_id, event_timestamp DESC);
CREATE INDEX idx_security_audit_events_ip
    ON security_audit_events(ip_address, event_timestamp DESC);
CREATE INDEX idx_security_audit_events_type
    ON security_audit_events(event_type, event_timestamp DESC);
CREATE INDEX idx_security_audit_events_risk
    ON security_audit_events(risk_level, event_timestamp DESC)
    WHERE flagged_suspicious = TRUE;
CREATE INDEX idx_security_audit_events_correlation
    ON security_audit_events(correlation_id)
    WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_security_audit_events_metadata
    ON security_audit_events USING GIN(metadata);

-- =====================================================
-- SECURITY THREAT PATTERNS
-- =====================================================
-- Configurable threat detection patterns
CREATE TABLE security_threat_patterns (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id),

    -- Pattern definition
    pattern_name VARCHAR(255) NOT NULL,
    pattern_description TEXT,
    severity security_risk_level NOT NULL,

    -- Detection criteria (flexible JSONB rules)
    detection_rules JSONB NOT NULL,
    -- Example: {
    --   "event_type": "LOGIN_FAILED",
    --   "threshold": 5,
    --   "time_window_minutes": 10,
    --   "conditions": {"same_ip": true}
    -- }

    -- Actions when pattern detected
    auto_block BOOLEAN DEFAULT FALSE,
    alert_channels JSONB, -- ["EMAIL", "SLACK", "PAGERDUTY"]

    -- Pattern lifecycle
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by_user_id INTEGER REFERENCES users(user_id),
    updated_by_user_id INTEGER REFERENCES users(user_id),

    CONSTRAINT security_threat_patterns_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_security_threat_patterns_tenant
    ON security_threat_patterns(tenant_id)
    WHERE enabled = TRUE;

-- =====================================================
-- SECURITY INCIDENTS
-- =====================================================
-- Detected security incidents requiring investigation
CREATE TABLE security_incidents (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id),

    -- Incident identification
    incident_number VARCHAR(50) UNIQUE NOT NULL, -- e.g., "SEC-2024-001234"
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Classification
    incident_type security_event_type NOT NULL,
    severity security_risk_level NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE

    -- Associated events
    related_event_ids BIGINT[], -- Array of security_audit_events.id
    threat_pattern_id INTEGER REFERENCES security_threat_patterns(id),

    -- Impact assessment
    affected_users INTEGER[], -- Array of user IDs
    affected_resources TEXT[],
    estimated_impact TEXT,

    -- Response tracking
    assigned_to_user_id INTEGER REFERENCES users(user_id),
    resolution_notes TEXT,
    remediation_actions JSONB,

    -- Timeline
    detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,

    -- Audit trail
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by_user_id INTEGER REFERENCES users(user_id),
    updated_by_user_id INTEGER REFERENCES users(user_id),

    CONSTRAINT security_incidents_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_security_incidents_tenant
    ON security_incidents(tenant_id, detected_at DESC);
CREATE INDEX idx_security_incidents_status
    ON security_incidents(status, severity DESC);
CREATE INDEX idx_security_incidents_assigned
    ON security_incidents(assigned_to_user_id)
    WHERE status IN ('OPEN', 'INVESTIGATING');

-- =====================================================
-- SECURITY COMPLIANCE AUDIT LOG
-- =====================================================
-- Audit trail for compliance requirements (SOC2, GDPR, ISO27001)
CREATE TABLE security_compliance_audit (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id),

    -- Compliance framework
    framework VARCHAR(50) NOT NULL, -- SOC2, GDPR, ISO27001, HIPAA
    control_id VARCHAR(100) NOT NULL, -- e.g., "CC6.1", "Article 32"
    control_description TEXT,

    -- Audit event
    audit_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_description TEXT NOT NULL,
    event_type VARCHAR(100) NOT NULL,

    -- Evidence
    evidence_type VARCHAR(100), -- SCREENSHOT, LOG, DOCUMENT, CONFIG
    evidence_location TEXT, -- File path or URL
    evidence_metadata JSONB,

    -- Responsible party
    performed_by_user_id INTEGER REFERENCES users(user_id),
    reviewed_by_user_id INTEGER REFERENCES users(user_id),

    -- Status
    compliance_status VARCHAR(50) DEFAULT 'COMPLIANT', -- COMPLIANT, NON_COMPLIANT, REMEDIATED
    findings TEXT,

    -- Audit trail
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT security_compliance_audit_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_security_compliance_audit_tenant
    ON security_compliance_audit(tenant_id, audit_timestamp DESC);
CREATE INDEX idx_security_compliance_framework
    ON security_compliance_audit(framework, control_id);
CREATE INDEX idx_security_compliance_status
    ON security_compliance_audit(compliance_status)
    WHERE compliance_status = 'NON_COMPLIANT';

-- =====================================================
-- MATERIALIZED VIEW: SECURITY METRICS SUMMARY
-- =====================================================
-- Real-time security dashboard metrics (1-hour aggregation)
CREATE MATERIALIZED VIEW security_metrics_summary AS
SELECT
    tenant_id,
    DATE_TRUNC('hour', event_timestamp) as metric_hour,

    -- Event counts by type
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE event_type LIKE 'LOGIN%') as login_events,
    COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED') as failed_logins,
    COUNT(*) FILTER (WHERE event_type = 'PERMISSION_DENIED') as permission_denials,
    COUNT(*) FILTER (WHERE event_type LIKE 'ZONE_ACCESS%') as zone_access_events,
    COUNT(*) FILTER (WHERE event_type = 'DATA_EXPORT') as data_exports,

    -- Risk metrics
    COUNT(*) FILTER (WHERE risk_level = 'CRITICAL') as critical_events,
    COUNT(*) FILTER (WHERE risk_level = 'HIGH') as high_risk_events,
    COUNT(*) FILTER (WHERE flagged_suspicious = TRUE) as suspicious_events,
    COUNT(*) FILTER (WHERE auto_blocked = TRUE) as auto_blocked_events,

    -- Unique metrics
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ip_addresses,
    COUNT(DISTINCT session_id) as unique_sessions,

    -- Geographic diversity
    COUNT(DISTINCT country_code) as countries_accessed_from,

    -- Anomaly metrics
    AVG(anomaly_score) FILTER (WHERE anomaly_score IS NOT NULL) as avg_anomaly_score,
    MAX(anomaly_score) as max_anomaly_score,

    -- Success/failure rates
    ROUND(100.0 * COUNT(*) FILTER (WHERE success = TRUE) / NULLIF(COUNT(*), 0), 2) as success_rate_percent,

    -- Last updated
    NOW() as last_updated
FROM security_audit_events
WHERE event_timestamp >= NOW() - INTERVAL '7 days'
GROUP BY tenant_id, DATE_TRUNC('hour', event_timestamp);

CREATE UNIQUE INDEX idx_security_metrics_summary_pk
    ON security_metrics_summary(tenant_id, metric_hour);
CREATE INDEX idx_security_metrics_summary_hour
    ON security_metrics_summary(metric_hour DESC);

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_security_metrics_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY security_metrics_summary;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECURITY DASHBOARD HELPER FUNCTIONS
-- =====================================================

-- Get top suspicious IPs in time range
CREATE OR REPLACE FUNCTION get_top_suspicious_ips(
    p_tenant_id INTEGER,
    p_hours INTEGER DEFAULT 24,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    ip_address INET,
    event_count BIGINT,
    failed_login_count BIGINT,
    suspicious_event_count BIGINT,
    risk_score NUMERIC,
    countries TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sae.ip_address,
        COUNT(*) as event_count,
        COUNT(*) FILTER (WHERE sae.event_type = 'LOGIN_FAILED') as failed_login_count,
        COUNT(*) FILTER (WHERE sae.flagged_suspicious = TRUE) as suspicious_event_count,
        ROUND(AVG(sae.anomaly_score), 2) as risk_score,
        ARRAY_AGG(DISTINCT sae.country_code) FILTER (WHERE sae.country_code IS NOT NULL) as countries
    FROM security_audit_events sae
    WHERE sae.tenant_id = p_tenant_id
        AND sae.event_timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY sae.ip_address
    HAVING COUNT(*) FILTER (WHERE sae.flagged_suspicious = TRUE OR sae.event_type = 'LOGIN_FAILED') > 0
    ORDER BY suspicious_event_count DESC, failed_login_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get user activity timeline for investigation
CREATE OR REPLACE FUNCTION get_user_security_timeline(
    p_tenant_id INTEGER,
    p_user_id INTEGER,
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    event_timestamp TIMESTAMP,
    event_type security_event_type,
    ip_address INET,
    success BOOLEAN,
    risk_level security_risk_level,
    target_resource VARCHAR(500),
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sae.event_timestamp,
        sae.event_type,
        sae.ip_address,
        sae.success,
        sae.risk_level,
        sae.target_resource,
        sae.metadata
    FROM security_audit_events sae
    WHERE sae.tenant_id = p_tenant_id
        AND sae.user_id = p_user_id
        AND sae.event_timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
    ORDER BY sae.event_timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED DEFAULT THREAT PATTERNS
-- =====================================================

-- Insert default threat detection patterns
INSERT INTO security_threat_patterns (
    tenant_id,
    pattern_name,
    pattern_description,
    severity,
    detection_rules,
    auto_block,
    alert_channels,
    enabled
) VALUES
    -- Brute force detection
    (1, 'Brute Force Login Attempt',
     'Detects multiple failed login attempts from same IP',
     'HIGH',
     '{"event_type": "LOGIN_FAILED", "threshold": 5, "time_window_minutes": 10, "conditions": {"same_ip": true}}'::JSONB,
     TRUE,
     '["EMAIL", "SLACK"]'::JSONB,
     TRUE),

    -- Impossible travel
    (1, 'Impossible Travel Pattern',
     'Detects logins from geographically distant locations in short time',
     'CRITICAL',
     '{"event_type": "LOGIN_SUCCESS", "threshold": 2, "time_window_minutes": 60, "conditions": {"geographic_distance_km": 500}}'::JSONB,
     FALSE,
     '["EMAIL", "SLACK", "PAGERDUTY"]'::JSONB,
     TRUE),

    -- Unusual data export
    (1, 'Bulk Data Export',
     'Detects unusually large data exports',
     'HIGH',
     '{"event_type": "DATA_EXPORT", "threshold": 1, "conditions": {"export_size_mb": 100}}'::JSONB,
     FALSE,
     '["EMAIL", "SLACK"]'::JSONB,
     TRUE),

    -- Privilege escalation attempt
    (1, 'Permission Escalation Attempt',
     'Detects multiple permission denied events suggesting privilege escalation',
     'HIGH',
     '{"event_type": "PERMISSION_DENIED", "threshold": 10, "time_window_minutes": 30, "conditions": {"same_user": true}}'::JSONB,
     FALSE,
     '["EMAIL", "SLACK"]'::JSONB,
     TRUE),

    -- After-hours vault access
    (1, 'After-Hours Vault Access',
     'Detects vault zone access outside business hours',
     'MEDIUM',
     '{"event_type": "ZONE_ACCESS_GRANTED", "conditions": {"zone_type": "VAULT", "business_hours": false}}'::JSONB,
     FALSE,
     '["EMAIL"]'::JSONB,
     TRUE);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE security_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_threat_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_compliance_audit ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy for security_audit_events
CREATE POLICY security_audit_events_tenant_isolation
    ON security_audit_events
    USING (tenant_id = current_setting('app.current_tenant_id')::INTEGER);

-- Tenant isolation policy for security_threat_patterns
CREATE POLICY security_threat_patterns_tenant_isolation
    ON security_threat_patterns
    USING (tenant_id = current_setting('app.current_tenant_id')::INTEGER);

-- Tenant isolation policy for security_incidents
CREATE POLICY security_incidents_tenant_isolation
    ON security_incidents
    USING (tenant_id = current_setting('app.current_tenant_id')::INTEGER);

-- Tenant isolation policy for security_compliance_audit
CREATE POLICY security_compliance_audit_tenant_isolation
    ON security_compliance_audit
    USING (tenant_id = current_setting('app.current_tenant_id')::INTEGER);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE security_audit_events IS
    'REQ-DEVOPS-SECURITY-1767150339448: Centralized security event logging with threat detection and correlation capabilities';

COMMENT ON TABLE security_threat_patterns IS
    'REQ-DEVOPS-SECURITY-1767150339448: Configurable threat detection patterns for automated security monitoring';

COMMENT ON TABLE security_incidents IS
    'REQ-DEVOPS-SECURITY-1767150339448: Security incidents detected through pattern matching requiring investigation';

COMMENT ON TABLE security_compliance_audit IS
    'REQ-DEVOPS-SECURITY-1767150339448: Compliance audit trail for SOC2, GDPR, ISO27001, and other frameworks';

COMMENT ON MATERIALIZED VIEW security_metrics_summary IS
    'REQ-DEVOPS-SECURITY-1767150339448: Hourly aggregated security metrics for dashboard performance';

COMMENT ON FUNCTION get_top_suspicious_ips IS
    'REQ-DEVOPS-SECURITY-1767150339448: Returns top suspicious IP addresses based on failed logins and flagged events';

COMMENT ON FUNCTION get_user_security_timeline IS
    'REQ-DEVOPS-SECURITY-1767150339448: Returns security event timeline for a specific user for investigation purposes';
