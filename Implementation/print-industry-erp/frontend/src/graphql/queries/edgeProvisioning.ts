import { gql } from '@apollo/client';

// Fragment for IoT Device fields
export const IOT_DEVICE_FRAGMENT = gql`
  fragment IotDeviceFields on IotDevice {
    id
    tenantId
    facilityId
    deviceCode
    deviceName
    deviceType
    workCenterId
    manufacturer
    model
    serialNumber
    firmwareVersion
    ipAddress
    macAddress
    connectionType
    connectionConfig
    hardwareProfile
    isActive
    isOnline
    lastHeartbeat
    lastSyncTime
    healthStatus
    cpuUsage
    memoryUsage
    diskUsage
    networkLatency
    tags
    metadata
    createdAt
    updatedAt
    createdByUserId
    updatedByUserId
  }
`;

// Fragment for Equipment Event fields
export const EQUIPMENT_EVENT_FRAGMENT = gql`
  fragment EquipmentEventFields on EquipmentEvent {
    id
    tenantId
    workCenterId
    iotDeviceId
    eventTimestamp
    eventType
    eventCode
    eventDescription
    severity
    productionRunId
    metadata
    acknowledged
    acknowledgedByUserId
    acknowledgedAt
    resolutionNotes
    createdAt
  }
`;

// Fragment for Sensor Reading fields
export const SENSOR_READING_FRAGMENT = gql`
  fragment SensorReadingFields on SensorReading {
    id
    tenantId
    iotDeviceId
    readingTimestamp
    sensorType
    readingValue
    unitOfMeasure
    productionRunId
    qualityStatus
    alertThresholdMin
    alertThresholdMax
    metadata
    createdAt
  }
`;

// Query to get all IoT devices (edge computers) for a facility
export const GET_IOT_DEVICES = gql`
  ${IOT_DEVICE_FRAGMENT}
  query GetIotDevices(
    $tenantId: ID!
    $facilityId: ID
    $workCenterId: ID
    $deviceType: String
    $isActive: Boolean
    $healthStatus: String
    $searchTerm: String
    $limit: Int
    $offset: Int
  ) {
    iotDevices(
      tenantId: $tenantId
      facilityId: $facilityId
      workCenterId: $workCenterId
      deviceType: $deviceType
      isActive: $isActive
      healthStatus: $healthStatus
      searchTerm: $searchTerm
      limit: $limit
      offset: $offset
    ) {
      ...IotDeviceFields
    }
  }
`;

// Query to get a single IoT device by ID
export const GET_IOT_DEVICE = gql`
  ${IOT_DEVICE_FRAGMENT}
  query GetIotDevice($id: ID!) {
    iotDevice(id: $id) {
      ...IotDeviceFields
    }
  }
`;

// Query to get IoT device statistics
export const GET_IOT_DEVICE_STATS = gql`
  query GetIotDeviceStats($tenantId: ID!, $facilityId: ID) {
    iotDeviceStats(tenantId: $tenantId, facilityId: $facilityId) {
      totalDevices
      activeDevices
      onlineDevices
      offlineDevices
      healthyDevices
      warningDevices
      criticalDevices
      devicesByType {
        deviceType
        count
      }
      devicesByFacility {
        facilityId
        facilityName
        count
      }
      avgCpuUsage
      avgMemoryUsage
      avgDiskUsage
      avgNetworkLatency
    }
  }
`;

// Query to get equipment events for monitoring
export const GET_EQUIPMENT_EVENTS = gql`
  ${EQUIPMENT_EVENT_FRAGMENT}
  query GetEquipmentEvents(
    $tenantId: ID!
    $iotDeviceId: ID
    $workCenterId: ID
    $severity: EventSeverity
    $acknowledged: Boolean
    $startTime: DateTime
    $endTime: DateTime
    $limit: Int
    $offset: Int
  ) {
    equipmentEvents(
      tenantId: $tenantId
      iotDeviceId: $iotDeviceId
      workCenterId: $workCenterId
      severity: $severity
      acknowledged: $acknowledged
      startTime: $startTime
      endTime: $endTime
      limit: $limit
      offset: $offset
    ) {
      ...EquipmentEventFields
    }
  }
`;

// Query to get sensor readings from edge devices
export const GET_SENSOR_READINGS = gql`
  ${SENSOR_READING_FRAGMENT}
  query GetSensorReadings(
    $tenantId: ID!
    $iotDeviceId: ID
    $productionRunId: ID
    $sensorType: String
    $startTime: DateTime
    $endTime: DateTime
    $limit: Int
    $offset: Int
  ) {
    sensorReadings(
      tenantId: $tenantId
      iotDeviceId: $iotDeviceId
      productionRunId: $productionRunId
      sensorType: $sensorType
      startTime: $startTime
      endTime: $endTime
      limit: $limit
      offset: $offset
    ) {
      ...SensorReadingFields
    }
  }
`;

// Mutation to create a new IoT device (edge computer)
export const CREATE_IOT_DEVICE = gql`
  ${IOT_DEVICE_FRAGMENT}
  mutation CreateIotDevice(
    $tenantId: ID!
    $facilityId: ID!
    $deviceCode: String!
    $deviceName: String!
    $deviceType: String
    $workCenterId: ID
    $manufacturer: String
    $model: String
    $serialNumber: String
    $firmwareVersion: String
    $ipAddress: String
    $macAddress: String
    $connectionType: String
    $connectionConfig: JSON
    $hardwareProfile: String
    $tags: [String]
    $metadata: JSON
  ) {
    createIotDevice(
      tenantId: $tenantId
      facilityId: $facilityId
      deviceCode: $deviceCode
      deviceName: $deviceName
      deviceType: $deviceType
      workCenterId: $workCenterId
      manufacturer: $manufacturer
      model: $model
      serialNumber: $serialNumber
      firmwareVersion: $firmwareVersion
      ipAddress: $ipAddress
      macAddress: $macAddress
      connectionType: $connectionType
      connectionConfig: $connectionConfig
      hardwareProfile: $hardwareProfile
      tags: $tags
      metadata: $metadata
    ) {
      ...IotDeviceFields
    }
  }
`;

// Mutation to update an IoT device
export const UPDATE_IOT_DEVICE = gql`
  ${IOT_DEVICE_FRAGMENT}
  mutation UpdateIotDevice(
    $id: ID!
    $deviceName: String
    $isActive: Boolean
    $manufacturer: String
    $model: String
    $serialNumber: String
    $firmwareVersion: String
    $ipAddress: String
    $macAddress: String
    $connectionType: String
    $connectionConfig: JSON
    $hardwareProfile: String
    $workCenterId: ID
    $tags: [String]
    $metadata: JSON
  ) {
    updateIotDevice(
      id: $id
      deviceName: $deviceName
      isActive: $isActive
      manufacturer: $manufacturer
      model: $model
      serialNumber: $serialNumber
      firmwareVersion: $firmwareVersion
      ipAddress: $ipAddress
      macAddress: $macAddress
      connectionType: $connectionType
      connectionConfig: $connectionConfig
      hardwareProfile: $hardwareProfile
      workCenterId: $workCenterId
      tags: $tags
      metadata: $metadata
    ) {
      ...IotDeviceFields
    }
  }
`;

// Mutation to delete an IoT device
export const DELETE_IOT_DEVICE = gql`
  mutation DeleteIotDevice($id: ID!) {
    deleteIotDevice(id: $id) {
      success
      message
    }
  }
`;

// Mutation to reboot an IoT device
export const REBOOT_IOT_DEVICE = gql`
  ${IOT_DEVICE_FRAGMENT}
  mutation RebootIotDevice($id: ID!) {
    rebootIotDevice(id: $id) {
      ...IotDeviceFields
    }
  }
`;

// Mutation to update device firmware
export const UPDATE_DEVICE_FIRMWARE = gql`
  ${IOT_DEVICE_FRAGMENT}
  mutation UpdateDeviceFirmware($id: ID!, $firmwareVersion: String!) {
    updateDeviceFirmware(id: $id, firmwareVersion: $firmwareVersion) {
      ...IotDeviceFields
    }
  }
`;

// Mutation to sync device configuration
export const SYNC_DEVICE_CONFIG = gql`
  ${IOT_DEVICE_FRAGMENT}
  mutation SyncDeviceConfig($id: ID!) {
    syncDeviceConfig(id: $id) {
      ...IotDeviceFields
    }
  }
`;

// Mutation to acknowledge equipment events
export const ACKNOWLEDGE_EQUIPMENT_EVENT = gql`
  ${EQUIPMENT_EVENT_FRAGMENT}
  mutation AcknowledgeEquipmentEvent(
    $id: ID!
    $acknowledgedByUserId: ID!
    $resolutionNotes: String
  ) {
    acknowledgeEquipmentEvent(
      id: $id
      acknowledgedByUserId: $acknowledgedByUserId
      resolutionNotes: $resolutionNotes
    ) {
      ...EquipmentEventFields
    }
  }
`;

// Mutation to bulk update IoT devices
export const BULK_UPDATE_IOT_DEVICES = gql`
  mutation BulkUpdateIotDevices(
    $deviceIds: [ID!]!
    $isActive: Boolean
    $tags: [String]
  ) {
    bulkUpdateIotDevices(
      deviceIds: $deviceIds
      isActive: $isActive
      tags: $tags
    ) {
      success
      message
      updatedCount
    }
  }
`;
