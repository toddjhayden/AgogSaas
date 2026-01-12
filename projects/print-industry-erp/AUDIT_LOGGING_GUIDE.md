# Comprehensive Audit Logging System
## REQ-1767924916114-xhhll

This document provides a complete overview of the comprehensive audit logging system implemented in the AGOG SAAS Print Industry ERP platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Security Features](#security-features)
7. [Compliance](#compliance)
8. [Usage Guide](#usage-guide)
9. [API Reference](#api-reference)
10. [Performance Considerations](#performance-considerations)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The comprehensive audit logging system provides enterprise-grade security monitoring, threat detection, and compliance reporting capabilities. It automatically logs all system mutations, tracks user activities, detects anomalies, and provides real-time security insights.

### Key Features

- **Automatic Mutation Logging**: All GraphQL mutations are automatically logged without requiring explicit code changes
- **Risk Assessment**: Automatic risk level calculation (LOW, MEDIUM, HIGH, CRITICAL) based on operation type
- **Anomaly Detection**: Anomaly scoring for suspicious operations
- **Threat Detection**: Configurable threat patterns with auto-blocking capability
- **Incident Management**: Full incident lifecycle tracking with assignments and resolution notes
- **Compliance Reporting**: Compliance audit trail supporting SOC2, GDPR, ISO27001, HIPAA
- **Geographic Tracking**: Location-based security analysis
- **Multi-Tenant Isolation**: Row-Level Security (RLS) policies ensure proper tenant isolation
- **Real-Time Monitoring**: Live dashboard with auto-refresh capabilities

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  SecurityAuditDashboard.tsx                           │ │
│  │  - Overview Metrics                                   │ │
│  │  - Security Events Table                              │ │
│  │  - Incident Management                                │ │
│  │  - Threat Pattern Configuration                       │ │
│  │  - Geographic Visualization                           │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
                   GraphQL API Layer
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     Backend Layer                           │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  AuditLoggingInterceptor (Global)                     │ │
│  │  - Intercepts all GraphQL mutations                   │ │
│  │  - Extracts user/tenant/IP context                    │ │
│  │  - Calculates risk levels                             │ │
│  │  - Async logging to database                          │ │
│  └───────────────────────────────────────────────────────┘ │
│                            ↓                                │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  SecurityAuditService                                 │ │
│  │  - Query audit events                                 │ │
│  │  - Security analytics                                 │ │
│  │  - Threat detection                                   │ │
│  └───────────────────────────────────────────────────────┘ │
│                            ↓                                │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  SecurityAuditResolver                                │ │
│  │  - GraphQL query/mutation handlers                    │ │
│  │  - RBAC enforcement                                   │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     Database Layer                          │
│  - security_audit_events (main audit log)                  │
│  - security_threat_patterns (threat detection rules)       │
│  - security_incidents (incident tracking)                  │
│  - compliance_audit_entries (compliance reporting)         │
│  - RLS policies for tenant isolation                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Table: `security_audit_events`

Main audit log table storing all security events.

```sql
CREATE TABLE security_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    event_type security_event_type NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    correlation_id UUID,
    user_id UUID REFERENCES users(id),
    username VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    target_resource VARCHAR(500),
    target_type VARCHAR(100),
    risk_level security_risk_level NOT NULL DEFAULT 'LOW',
    success BOOLEAN NOT NULL DEFAULT TRUE,
    failure_reason TEXT,
    metadata JSONB,
    country_code VARCHAR(2),
    city VARCHAR(255),
    location GEOGRAPHY(POINT),
    anomaly_score NUMERIC(5,2),
    flagged_suspicious BOOLEAN DEFAULT FALSE,
    auto_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_security_events_tenant_timestamp` - (tenant_id, event_timestamp DESC)
- `idx_security_events_user` - (tenant_id, user_id, event_timestamp DESC)
- `idx_security_events_ip` - (tenant_id, ip_address)
- `idx_security_events_type_risk` - (tenant_id, event_type, risk_level)
- `idx_security_events_suspicious` - (tenant_id, flagged_suspicious, event_timestamp DESC)
- `idx_security_events_correlation` - (correlation_id)

### Table: `security_threat_patterns`

Configurable threat detection rules.

```sql
CREATE TABLE security_threat_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    pattern_name VARCHAR(255) NOT NULL,
    pattern_description TEXT,
    severity security_risk_level NOT NULL,
    detection_rules JSONB NOT NULL,
    match_count INTEGER DEFAULT 0,
    auto_block BOOLEAN DEFAULT FALSE,
    alert_channels JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);
```

### Table: `security_incidents`

Security incident tracking and management.

```sql
CREATE TABLE security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    incident_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    incident_type VARCHAR(100) NOT NULL,
    severity security_risk_level NOT NULL,
    status incident_status NOT NULL DEFAULT 'OPEN',
    assigned_to UUID REFERENCES users(id),
    related_events JSONB,
    remediation_actions TEXT[],
    resolution_notes TEXT,
    detected_at TIMESTAMPTZ NOT NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);
```

### Table: `compliance_audit_entries`

Compliance-specific audit trail.

```sql
CREATE TABLE compliance_audit_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    compliance_framework VARCHAR(100) NOT NULL,
    control_id VARCHAR(100) NOT NULL,
    control_name VARCHAR(500),
    audit_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    auditor_id UUID REFERENCES users(id),
    auditor_name VARCHAR(255),
    compliance_status compliance_status NOT NULL,
    findings TEXT,
    evidence JSONB,
    remediation_plan TEXT,
    next_audit_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## Backend Implementation

### 1. AuditLoggingInterceptor

**File**: `backend/src/common/interceptors/audit-logging.interceptor.ts`

Global NestJS interceptor that automatically logs all GraphQL mutations.

**Key Features:**
- Intercepts all GraphQL mutations (CREATE, UPDATE, DELETE operations)
- Extracts user context (tenant, user ID, username) from JWT token
- Captures IP address, user agent, session ID
- Calculates risk level based on operation type
- Assigns anomaly scores for suspicious operations
- Async, non-blocking logging
- Error handling prevents audit failures from blocking operations

**Risk Level Calculation:**
```typescript
HIGH/CRITICAL:
- User deletion/modification
- Permission/role changes
- Configuration changes
- Security-related mutations

MEDIUM:
- Data modifications
- Record deletions
- Sensitive data operations

LOW:
- Record creation
- Standard updates
- Read operations
```

### 2. SecurityAuditService

**File**: `backend/src/modules/security/services/security-audit.service.ts`

Provides query capabilities for audit events and security analytics.

**Key Methods:**
- `getSecurityOverview(timeRange)` - Dashboard metrics and statistics
- `getSecurityAuditEvents(filter, pagination)` - Query audit events with filtering
- `getSuspiciousIPs(timeRange)` - Identify suspicious IP addresses
- `getUserSecurityTimeline(userId, timeRange)` - Per-user audit trail
- `getSecurityIncidents(filter)` - Query security incidents
- `getThreatPatterns()` - Get configured threat detection patterns
- `getSecurityMetricsTimeSeries(timeRange)` - Time-series analytics
- `getGeographicAccessMap(timeRange)` - Geographic distribution analysis

### 3. SecurityAuditMutationsService

**File**: `backend/src/modules/security/services/security-audit-mutations.service.ts`

Handles security incident management and threat pattern configuration.

**Key Methods:**
- `createSecurityIncident(input)` - Create new security incident
- `updateSecurityIncident(id, input)` - Update incident details/status
- `upsertThreatPattern(input)` - Create/update threat detection pattern
- `toggleThreatPattern(id, enabled)` - Enable/disable threat pattern
- `logSecurityEvent(input)` - Manual security event logging
- `addComplianceAuditEntry(input)` - Add compliance audit record

### 4. SecurityAuditResolver

**File**: `backend/src/graphql/resolvers/security-audit.resolver.ts`

GraphQL resolver with RBAC enforcement.

**Required Roles:**
- `SECURITY_ADMIN` - Full access to all security features
- `SECURITY_ANALYST` - Read-only access to security events
- `ADMIN` - Full system access

---

## Frontend Implementation

### 1. SecurityAuditDashboard Component

**File**: `frontend/src/pages/SecurityAuditDashboard.tsx`

Comprehensive security monitoring dashboard.

**Features:**
- **Overview Cards**: Security score, total events, authentication metrics, active incidents
- **Tabbed Interface**:
  - Security Events - Filterable event log
  - Incidents - Active incident tracking
  - Threat Patterns - Threat detection configuration
  - Suspicious Activity - Suspicious IPs and users
  - Geographic Access - Location-based analysis
- **Real-Time Updates**: Auto-refresh every 30 seconds
- **Filtering**: By risk level, event type, status, suspicious flag
- **Pagination**: Cursor-based pagination for large datasets

### 2. GraphQL Queries

**File**: `frontend/src/graphql/queries/securityAudit.ts`

**Queries:**
- `GET_SECURITY_OVERVIEW` - Dashboard overview metrics
- `GET_SECURITY_AUDIT_EVENTS` - Security events with filtering/pagination
- `GET_SUSPICIOUS_IPS` - Suspicious IP identification
- `GET_USER_SECURITY_TIMELINE` - User-specific audit trail
- `GET_SECURITY_INCIDENTS` - Incident management
- `GET_THREAT_PATTERNS` - Threat detection patterns
- `GET_COMPLIANCE_AUDIT_TRAIL` - Compliance reporting
- `GET_GEOGRAPHIC_ACCESS_MAP` - Geographic analysis
- `GET_SECURITY_METRICS_TIME_SERIES` - Time-series analytics

**Mutations:**
- `CREATE_SECURITY_INCIDENT` - Create security incident
- `UPDATE_SECURITY_INCIDENT` - Update incident
- `UPSERT_THREAT_PATTERN` - Configure threat pattern
- `TOGGLE_THREAT_PATTERN` - Enable/disable pattern
- `LOG_SECURITY_EVENT` - Manual event logging
- `ADD_COMPLIANCE_AUDIT_ENTRY` - Add compliance entry

### 3. Navigation Integration

**Security Audit Dashboard** is accessible via:
- **Route**: `/security/audit`
- **Sidebar Menu**: "Security Audit" (ShieldAlert icon)
- **i18n Key**: `nav.securityAudit`

---

## Security Features

### 1. Row-Level Security (RLS)

All tables enforce tenant isolation via RLS policies:

```sql
CREATE POLICY security_events_tenant_isolation
ON security_audit_events
USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### 2. Automatic Mutation Logging

All GraphQL mutations are automatically logged without requiring explicit code changes. The `AuditLoggingInterceptor` intercepts all mutations globally.

### 3. Anomaly Detection

The system calculates anomaly scores based on:
- Failed login attempts from same IP
- Multiple permission denials
- Unusual access patterns
- Geographic anomalies
- Time-based anomalies

### 4. Threat Detection Patterns

Configurable threat patterns support:
- Pattern matching rules (JSONB format)
- Severity levels (LOW, MEDIUM, HIGH, CRITICAL)
- Auto-blocking capability
- Alert channel configuration
- Enable/disable toggle

### 5. Authentication & Authorization

- **JWT-based authentication** via `JwtAuthGuard`
- **Role-Based Access Control (RBAC)** via `RolesGuard`
- **Required Roles**: SECURITY_ADMIN, SECURITY_ANALYST, ADMIN

---

## Compliance

The audit logging system supports compliance with:

### SOC2 Type II
- Complete audit trail of all system changes
- User authentication and authorization logging
- Data access tracking
- Change management logging

### GDPR
- User data access logging
- Data modification tracking
- Data export logging
- Right to erasure audit trail

### ISO 27001
- Access control logging
- Security incident tracking
- Configuration change management
- Threat detection and response

### HIPAA
- Protected Health Information (PHI) access logging
- User authentication tracking
- Data modification audit trail
- Security incident management

---

## Usage Guide

### Accessing the Security Audit Dashboard

1. Navigate to `/security/audit` or click **Security Audit** in the sidebar
2. Select desired time range (Last Hour, 6 Hours, 24 Hours, 7 Days, 30 Days)
3. View overview metrics and explore different tabs

### Viewing Security Events

1. Go to **Security Events** tab
2. Apply filters:
   - Risk Level (CRITICAL, HIGH, MEDIUM, LOW)
   - Event Type (LOGIN_SUCCESS, LOGIN_FAILED, etc.)
   - Status (Success/Failed)
   - Suspicious (Flagged/Normal)
3. Use pagination controls for large datasets

### Managing Security Incidents

1. Go to **Incidents** tab
2. View active incidents with severity, status, and assignment
3. Click incident to view details
4. Update incident status, assign to team members, add resolution notes

### Configuring Threat Patterns

1. Go to **Threat Patterns** tab
2. View existing patterns with match counts
3. Toggle patterns on/off
4. Configure auto-blocking for high-severity patterns

### Monitoring Suspicious Activity

1. Go to **Suspicious Activity** tab
2. View suspicious IPs with event counts, failed logins, risk scores
3. View suspicious users with flagged reasons
4. Block suspicious IPs if needed

### Analyzing Geographic Access

1. Go to **Geographic Access** tab
2. View access distribution by country
3. Identify unusual geographic patterns
4. Monitor failed logins by location

---

## API Reference

### Query: securityOverview

Get security dashboard overview metrics.

```graphql
query GetSecurityOverview($timeRange: SecurityTimeRange!) {
  securityOverview(timeRange: $timeRange) {
    securityScore
    totalEvents
    criticalEvents
    highRiskEvents
    suspiciousEvents
    blockedEvents
    loginAttempts
    failedLogins
    successRate
    activeIncidents
    topThreats {
      patternName
      severity
      occurrences
    }
    suspiciousUsers {
      userId
      username
      riskScore
    }
  }
}
```

### Query: securityAuditEvents

Query security audit events with filtering and pagination.

```graphql
query GetSecurityAuditEvents(
  $filter: SecurityEventFilter
  $pagination: PaginationInput
) {
  securityAuditEvents(filter: $filter, pagination: $pagination) {
    edges {
      node {
        id
        eventType
        eventTimestamp
        userId
        username
        ipAddress
        riskLevel
        success
        flaggedSuspicious
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Mutation: createSecurityIncident

Create a new security incident.

```graphql
mutation CreateSecurityIncident($input: CreateSecurityIncidentInput!) {
  createSecurityIncident(input: $input) {
    id
    incidentNumber
    title
    severity
    status
    detectedAt
  }
}
```

### Mutation: upsertThreatPattern

Create or update a threat detection pattern.

```graphql
mutation UpsertThreatPattern($input: ThreatPatternInput!) {
  upsertThreatPattern(input: $input) {
    id
    patternName
    severity
    detectionRules
    autoBlock
    enabled
  }
}
```

---

## Performance Considerations

### 1. Async Logging

The `AuditLoggingInterceptor` uses async logging to prevent blocking mutations:

```typescript
// Async logging - don't block the response
this.logAuditEvent(eventData).catch((error) => {
  this.logger.error(`Failed to log audit event: ${error.message}`);
});
```

### 2. Database Indexes

Multiple indexes optimize query performance:
- Tenant + timestamp for time-range queries
- Tenant + user + timestamp for user-specific queries
- Tenant + IP address for IP-based queries
- Tenant + event type + risk level for filtered queries
- Tenant + suspicious flag for anomaly detection

### 3. Query Timeout Protection

The `SecurityAuditService` implements query timeout protection (10s default):

```typescript
const queryTimeout = 10000; // 10 seconds
await this.pool.query('SET statement_timeout = $1', [queryTimeout]);
```

### 4. Pagination

All list queries use cursor-based pagination to handle large datasets efficiently.

### 5. Auto-Refresh

Dashboard auto-refreshes every 30 seconds using Apollo's `pollInterval`:

```typescript
pollInterval: 30000 // 30 seconds
```

---

## Troubleshooting

### Issue: Audit events not appearing

**Possible Causes:**
1. Interceptor not registered globally
2. Database connection issue
3. RLS policy blocking access

**Solutions:**
1. Verify `AuditLoggingInterceptor` is registered in `app.module.ts`
2. Check database connectivity
3. Verify `app.current_tenant_id` is set correctly in database session

### Issue: Dashboard not loading

**Possible Causes:**
1. GraphQL query timeout
2. Missing authentication token
3. Insufficient permissions

**Solutions:**
1. Check query timeout settings (default 10s)
2. Verify JWT token is valid and not expired
3. Ensure user has SECURITY_ADMIN, SECURITY_ANALYST, or ADMIN role

### Issue: Slow query performance

**Possible Causes:**
1. Missing indexes
2. Large dataset without pagination
3. Complex filtering

**Solutions:**
1. Verify all indexes are created (see migration V1.2.22)
2. Use pagination for large datasets
3. Optimize filter combinations

### Issue: Suspicious activity not being flagged

**Possible Causes:**
1. Anomaly detection thresholds too high
2. Threat patterns not configured
3. Patterns disabled

**Solutions:**
1. Review and adjust anomaly score calculation
2. Configure threat detection patterns
3. Enable relevant threat patterns

---

## Related Files

### Backend
- `backend/src/common/interceptors/audit-logging.interceptor.ts` - Global audit interceptor
- `backend/src/modules/security/services/security-audit.service.ts` - Query service
- `backend/src/modules/security/services/security-audit-mutations.service.ts` - Mutation service
- `backend/src/graphql/resolvers/security-audit.resolver.ts` - GraphQL resolver
- `backend/src/graphql/schema/security-audit.graphql` - GraphQL schema
- `backend/database/migrations/V1.2.22__create_security_audit_dashboard.sql` - Database schema

### Frontend
- `frontend/src/pages/SecurityAuditDashboard.tsx` - Main dashboard component
- `frontend/src/graphql/queries/securityAudit.ts` - GraphQL queries/mutations
- `frontend/src/i18n/locales/en-US.json` - English translations
- `frontend/src/i18n/locales/zh-CN.json` - Chinese translations
- `frontend/src/App.tsx` - Route configuration (line 229)
- `frontend/src/components/layout/Sidebar.tsx` - Navigation menu (line 120)

---

## Future Enhancements

Potential future enhancements to consider:

1. **Machine Learning-based Anomaly Detection** - Use ML models for more sophisticated anomaly detection
2. **Real-Time Alerting** - WebSocket-based real-time alerts for critical events
3. **Advanced Threat Intelligence** - Integration with external threat intelligence feeds
4. **Automated Response** - Automatic remediation actions for certain threat types
5. **Audit Report Export** - PDF/Excel export for compliance reporting
6. **User Behavior Analytics (UBA)** - Advanced behavioral analysis for insider threat detection
7. **SIEM Integration** - Integration with external SIEM platforms (Splunk, ELK, etc.)

---

## Conclusion

The comprehensive audit logging system provides enterprise-grade security monitoring with:
- ✅ Automatic mutation logging
- ✅ Real-time threat detection
- ✅ Incident management
- ✅ Compliance reporting
- ✅ Multi-tenant isolation
- ✅ Performance optimization
- ✅ User-friendly dashboard

For additional support or questions, please contact the security team.

---

**Last Updated**: 2026-01-11
**Version**: 1.0.0
**Requirement**: REQ-1767924916114-xhhll
