import { gql } from '@apollo/client';

// =====================================================
// EDGE MONITORING GRAPHQL QUERIES
// =====================================================

export const GET_EDGE_FLEET_HEALTH = gql`
  query GetEdgeFleetHealth {
    edgeFleetHealth {
      totalFacilities
      onlineCount
      offlineCount
      escalatedCount
      avgCpuUsage
      avgMemoryUsage
      avgDiskUsage
      avgNetworkLatency
      availabilityPercentage
      activeCriticalAlerts
      lastUpdated
    }
  }
`;

export const GET_FACILITY_EDGE_STATUSES = gql`
  query GetFacilityEdgeStatuses(
    $region: String
    $status: String
    $limit: Int
    $offset: Int
  ) {
    facilityEdgeStatuses(
      region: $region
      status: $status
      limit: $limit
      offset: $offset
    ) {
      facilityId
      facilityCode
      facilityName
      region
      mode
      edgeVpnHostname
      online
      offlineSince
      lastSync
      status
      offlineMinutes
      cpuUsage
      memoryUsage
      diskUsage
      networkLatency
      servicesStatus
      escalated
      escalationTier
      edgeVersion
      dockerVersion
      postgresVersion
      activeContactsCount
      alerts24h
      unresolvedCriticalAlerts
      lastStatusUpdate
    }
  }
`;

export const GET_FACILITY_STATUS = gql`
  query GetFacilityStatus($facilityId: ID!) {
    facilityStatus(facilityId: $facilityId) {
      id
      facilityId
      online
      offlineSince
      lastSync
      escalated
      escalatedAt
      escalationTier
      cpuUsage
      memoryUsage
      diskUsage
      networkLatency
      servicesStatus
      edgeVersion
      dockerVersion
      postgresVersion
      createdAt
      updatedAt
    }
  }
`;

export const GET_FACILITY_CONTACTS = gql`
  query GetFacilityContacts(
    $facilityId: ID
    $notificationsEnabled: Boolean
    $limit: Int
    $offset: Int
  ) {
    facilityContacts(
      facilityId: $facilityId
      notificationsEnabled: $notificationsEnabled
      limit: $limit
      offset: $offset
    ) {
      id
      facilityId
      name
      email
      phone
      role
      notificationsEnabled
      smsEnabled
      phoneCallEnabled
      emailEnabled
      isPrimary
      notificationPriority
      availableHours
      timezone
      createdAt
      createdByUserId
      updatedAt
      updatedByUserId
    }
  }
`;

export const GET_EDGE_HEALTH_METRICS = gql`
  query GetEdgeHealthMetrics(
    $facilityId: ID!
    $startDate: String
    $endDate: String
    $limit: Int
    $offset: Int
  ) {
    edgeHealthMetrics(
      facilityId: $facilityId
      startDate: $startDate
      endDate: $endDate
      limit: $limit
      offset: $offset
    ) {
      id
      facilityId
      metricTimestamp
      cpuUsage
      memoryUsage
      diskUsage
      networkLatency
      apiResponseTime
      databaseConnections
      queueDepth
      diskFreeGb
      memoryFreeMb
      bytesSentMb
      bytesReceivedMb
      packetsLost
      containersRunning
      containersStopped
      edgeVersion
      uptimeSeconds
    }
  }
`;

export const GET_EDGE_ALERTS = gql`
  query GetEdgeAlerts(
    $facilityId: ID
    $alertType: String
    $severity: String
    $acknowledged: Boolean
    $resolved: Boolean
    $startDate: String
    $endDate: String
    $limit: Int
    $offset: Int
  ) {
    edgeAlerts(
      facilityId: $facilityId
      alertType: $alertType
      severity: $severity
      acknowledged: $acknowledged
      resolved: $resolved
      startDate: $startDate
      endDate: $endDate
      limit: $limit
      offset: $offset
    ) {
      id
      facilityId
      alertType
      severity
      message
      actions
      sentAt
      channelsSent
      deliveryStatus
      acknowledged
      acknowledgedByUserId
      acknowledgedAt
      resolved
      resolvedAt
      resolutionNotes
      escalationTier
      escalatedAt
      offlineDurationMinutes
      metricSnapshot
    }
  }
`;

export const GET_EDGE_ALERTS_DASHBOARD = gql`
  query GetEdgeAlertsDashboard(
    $facilityId: ID
    $severity: String
    $acknowledged: Boolean
    $resolved: Boolean
    $limit: Int
    $offset: Int
  ) {
    edgeAlertsDashboard(
      facilityId: $facilityId
      severity: $severity
      acknowledged: $acknowledged
      resolved: $resolved
      limit: $limit
      offset: $offset
    ) {
      id
      facilityId
      facilityCode
      facilityName
      region
      alertType
      severity
      message
      sentAt
      acknowledged
      acknowledgedAt
      acknowledgedByUsername
      resolved
      resolvedAt
      resolutionNotes
      escalationTier
      offlineDurationMinutes
      minutesSinceAlert
      channelsSent
      deliveryStatus
    }
  }
`;

// =====================================================
// MUTATIONS
// =====================================================

export const CREATE_FACILITY_CONTACT = gql`
  mutation CreateFacilityContact($input: CreateFacilityContactInput!) {
    createFacilityContact(input: $input) {
      id
      facilityId
      name
      email
      phone
      role
      notificationsEnabled
      smsEnabled
      phoneCallEnabled
      emailEnabled
      isPrimary
      notificationPriority
      availableHours
      timezone
      createdAt
    }
  }
`;

export const UPDATE_FACILITY_CONTACT = gql`
  mutation UpdateFacilityContact($id: ID!, $input: UpdateFacilityContactInput!) {
    updateFacilityContact(id: $id, input: $input) {
      id
      facilityId
      name
      email
      phone
      role
      notificationsEnabled
      smsEnabled
      phoneCallEnabled
      emailEnabled
      isPrimary
      notificationPriority
      availableHours
      timezone
      updatedAt
    }
  }
`;

export const DELETE_FACILITY_CONTACT = gql`
  mutation DeleteFacilityContact($id: ID!) {
    deleteFacilityContact(id: $id)
  }
`;

export const ACKNOWLEDGE_EDGE_ALERT = gql`
  mutation AcknowledgeEdgeAlert($id: ID!, $input: AcknowledgeAlertInput!) {
    acknowledgeEdgeAlert(id: $id, input: $input) {
      id
      acknowledged
      acknowledgedAt
      acknowledgedByUserId
    }
  }
`;

export const RESOLVE_EDGE_ALERT = gql`
  mutation ResolveEdgeAlert($id: ID!, $input: ResolveAlertInput!) {
    resolveEdgeAlert(id: $id, input: $input) {
      id
      resolved
      resolvedAt
      resolutionNotes
    }
  }
`;

export const TRIGGER_FACILITY_HEALTH_CHECK = gql`
  mutation TriggerFacilityHealthCheck($facilityId: ID!) {
    triggerFacilityHealthCheck(facilityId: $facilityId) {
      id
      facilityId
      online
      lastSync
      updatedAt
    }
  }
`;

export const ESCALATE_FACILITY_ALERT = gql`
  mutation EscalateFacilityAlert($facilityId: ID!) {
    escalateFacilityAlert(facilityId: $facilityId) {
      id
      facilityId
      escalated
      escalatedAt
      escalationTier
    }
  }
`;
