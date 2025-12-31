/**
 * Security Audit GraphQL Queries
 * REQ-DEVOPS-SECURITY-1767150339448
 */

import { gql } from '@apollo/client';

export const GET_SECURITY_OVERVIEW = gql`
  query GetSecurityOverview($timeRange: SecurityTimeRange!) {
    securityOverview(timeRange: $timeRange) {
      timeRange
      securityScore
      trend
      totalEvents
      criticalEvents
      highRiskEvents
      suspiciousEvents
      blockedEvents
      loginAttempts
      failedLogins
      successRate
      bruteForceAttempts
      permissionDenials
      zoneAccessEvents
      unauthorizedAccessAttempts
      dataExports
      dataModifications
      configChanges
      activeIncidents
      openInvestigations
      topThreats {
        patternName
        severity
        occurrences
        lastOccurrence
      }
      uniqueCountries
      uniqueIPAddresses
      topCountries {
        countryCode
        countryName
        accessCount
        percentage
      }
      activeUsers
      suspiciousUsers {
        userId
        username
        suspiciousEventCount
        riskScore
        lastSuspiciousActivity
        flaggedReasons
      }
      complianceScore
      nonCompliantControls
    }
  }
`;

export const GET_SECURITY_AUDIT_EVENTS = gql`
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
          correlationId
          userId
          username
          ipAddress
          userAgent
          sessionId
          targetResource
          targetType
          riskLevel
          success
          failureReason
          metadata
          countryCode
          city
          location {
            latitude
            longitude
          }
          anomalyScore
          flaggedSuspicious
          autoBlocked
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_SUSPICIOUS_IPS = gql`
  query GetSuspiciousIPs($hours: Int, $limit: Int) {
    suspiciousIPs(hours: $hours, limit: $limit) {
      ipAddress
      eventCount
      failedLoginCount
      suspiciousEventCount
      riskScore
      countries
      blocked
    }
  }
`;

export const GET_USER_SECURITY_TIMELINE = gql`
  query GetUserSecurityTimeline($userId: ID!, $hours: Int) {
    userSecurityTimeline(userId: $userId, hours: $hours) {
      id
      eventType
      eventTimestamp
      ipAddress
      success
      riskLevel
      targetResource
      metadata
      flaggedSuspicious
    }
  }
`;

export const GET_SECURITY_INCIDENTS = gql`
  query GetSecurityIncidents(
    $status: [IncidentStatus!]
    $severity: [SecurityRiskLevel!]
    $pagination: PaginationInput
  ) {
    securityIncidents(status: $status, severity: $severity, pagination: $pagination) {
      edges {
        node {
          id
          incidentNumber
          title
          description
          incidentType
          severity
          status
          relatedEventIds
          affectedResources
          estimatedImpact
          assignedTo {
            id
            username
          }
          resolutionNotes
          detectedAt
          acknowledgedAt
          resolvedAt
          createdAt
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_SECURITY_INCIDENT = gql`
  query GetSecurityIncident($id: ID!) {
    securityIncident(id: $id) {
      id
      incidentNumber
      title
      description
      incidentType
      severity
      status
      relatedEventIds
      relatedEvents {
        id
        eventType
        eventTimestamp
        username
        ipAddress
        riskLevel
        success
      }
      affectedUsers {
        id
        username
        email
      }
      affectedResources
      estimatedImpact
      assignedTo {
        id
        username
        email
      }
      resolutionNotes
      remediationActions
      detectedAt
      acknowledgedAt
      resolvedAt
      createdAt
      updatedAt
      createdBy {
        id
        username
      }
      updatedBy {
        id
        username
      }
    }
  }
`;

export const GET_THREAT_PATTERNS = gql`
  query GetThreatPatterns($enabled: Boolean) {
    threatPatterns(enabled: $enabled) {
      id
      patternName
      patternDescription
      severity
      detectionRules
      matchCount
      autoBlock
      alertChannels
      enabled
      createdAt
      updatedAt
      createdBy {
        id
        username
      }
      updatedBy {
        id
        username
      }
    }
  }
`;

export const GET_SECURITY_METRICS_TIME_SERIES = gql`
  query GetSecurityMetricsTimeSeries($timeRange: SecurityTimeRange!, $interval: String) {
    securityMetricsTimeSeries(timeRange: $timeRange, interval: $interval) {
      timestamp
      totalEvents
      loginEvents
      failedLogins
      permissionDenials
      zoneAccessEvents
      dataExports
      criticalEvents
      highRiskEvents
      suspiciousEvents
      autoBlockedEvents
      uniqueUsers
      uniqueIPAddresses
      uniqueSessions
      avgAnomalyScore
      maxAnomalyScore
      successRatePercent
    }
  }
`;

export const GET_GEOGRAPHIC_ACCESS_MAP = gql`
  query GetGeographicAccessMap($hours: Int) {
    geographicAccessMap(hours: $hours) {
      countryCode
      countryName
      accessCount
      failedLoginCount
      suspiciousEventCount
      uniqueUsers
      location {
        latitude
        longitude
      }
    }
  }
`;

export const GET_COMPLIANCE_AUDIT_TRAIL = gql`
  query GetComplianceAuditTrail(
    $framework: String
    $controlId: String
    $status: ComplianceStatus
    $pagination: PaginationInput
  ) {
    complianceAuditTrail(
      framework: $framework
      controlId: $controlId
      status: $status
      pagination: $pagination
    ) {
      edges {
        node {
          id
          framework
          controlId
          controlDescription
          auditTimestamp
          eventDescription
          eventType
          evidenceType
          evidenceLocation
          performedBy {
            id
            username
          }
          reviewedBy {
            id
            username
          }
          complianceStatus
          findings
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

// =====================================================
// MUTATIONS
// =====================================================

export const CREATE_SECURITY_INCIDENT = gql`
  mutation CreateSecurityIncident($input: CreateSecurityIncidentInput!) {
    createSecurityIncident(input: $input) {
      id
      incidentNumber
      title
      description
      incidentType
      severity
      status
      detectedAt
      createdAt
    }
  }
`;

export const UPDATE_SECURITY_INCIDENT = gql`
  mutation UpdateSecurityIncident(
    $id: ID!
    $input: UpdateSecurityIncidentInput!
  ) {
    updateSecurityIncident(id: $id, input: $input) {
      id
      incidentNumber
      title
      description
      severity
      status
      assignedTo {
        id
        username
      }
      resolutionNotes
      remediationActions
      acknowledgedAt
      resolvedAt
      updatedAt
      updatedBy {
        id
        username
      }
    }
  }
`;

export const UPSERT_THREAT_PATTERN = gql`
  mutation UpsertThreatPattern($input: ThreatPatternInput!) {
    upsertThreatPattern(input: $input) {
      id
      patternName
      patternDescription
      severity
      detectionRules
      matchCount
      autoBlock
      alertChannels
      enabled
      updatedAt
      updatedBy {
        id
        username
      }
    }
  }
`;

export const TOGGLE_THREAT_PATTERN = gql`
  mutation ToggleThreatPattern($id: ID!, $enabled: Boolean!) {
    toggleThreatPattern(id: $id, enabled: $enabled) {
      id
      patternName
      enabled
      updatedAt
      updatedBy {
        id
        username
      }
    }
  }
`;

export const LOG_SECURITY_EVENT = gql`
  mutation LogSecurityEvent($input: LogSecurityEventInput!) {
    logSecurityEvent(input: $input) {
      id
      eventType
      eventTimestamp
      userId
      username
      ipAddress
      targetResource
      riskLevel
      success
      createdAt
    }
  }
`;

export const ADD_COMPLIANCE_AUDIT_ENTRY = gql`
  mutation AddComplianceAuditEntry($input: ComplianceAuditInput!) {
    addComplianceAuditEntry(input: $input) {
      id
      framework
      controlId
      auditTimestamp
      eventDescription
      complianceStatus
      createdAt
    }
  }
`;
