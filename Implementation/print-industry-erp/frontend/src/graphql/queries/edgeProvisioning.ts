import { gql } from '@apollo/client';

// Query to get all IoT devices (edge computers) for a facility
export const GET_IOT_DEVICES = gql`
  query GetIotDevices(
    $tenantId: ID!
    $facilityId: ID
    $workCenterId: ID
    $deviceType: String
    $isActive: Boolean
  ) {
    iotDevices(
      tenantId: $tenantId
      facilityId: $facilityId
      workCenterId: $workCenterId
      deviceType: $deviceType
      isActive: $isActive
    ) {
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
      connectionType
      connectionConfig
      isActive
      lastHeartbeat
      createdAt
      updatedAt
    }
  }
`;

// Query to get equipment events for monitoring
export const GET_EQUIPMENT_EVENTS = gql`
  query GetEquipmentEvents(
    $tenantId: ID!
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
      workCenterId: $workCenterId
      severity: $severity
      acknowledged: $acknowledged
      startTime: $startTime
      endTime: $endTime
      limit: $limit
      offset: $offset
    ) {
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
      createdAt
    }
  }
`;

// Query to get sensor readings from edge devices
export const GET_SENSOR_READINGS = gql`
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
      id
      tenantId
      iotDeviceId
      readingTimestamp
      sensorType
      readingValue
      unitOfMeasure
      productionRunId
      metadata
      createdAt
    }
  }
`;

// Mutation to create a new IoT device (edge computer)
export const CREATE_IOT_DEVICE = gql`
  mutation CreateIotDevice(
    $tenantId: ID!
    $facilityId: ID!
    $deviceCode: String!
    $deviceName: String!
    $deviceType: String
    $workCenterId: ID
  ) {
    createIotDevice(
      tenantId: $tenantId
      facilityId: $facilityId
      deviceCode: $deviceCode
      deviceName: $deviceName
      deviceType: $deviceType
      workCenterId: $workCenterId
    ) {
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
      connectionType
      connectionConfig
      isActive
      lastHeartbeat
      createdAt
      updatedAt
    }
  }
`;

// Mutation to update an IoT device
export const UPDATE_IOT_DEVICE = gql`
  mutation UpdateIotDevice(
    $id: ID!
    $deviceName: String
    $isActive: Boolean
  ) {
    updateIotDevice(
      id: $id
      deviceName: $deviceName
      isActive: $isActive
    ) {
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
      connectionType
      connectionConfig
      isActive
      lastHeartbeat
      createdAt
      updatedAt
    }
  }
`;

// Mutation to acknowledge equipment events
export const ACKNOWLEDGE_EQUIPMENT_EVENT = gql`
  mutation AcknowledgeEquipmentEvent(
    $id: ID!
    $acknowledgedByUserId: ID!
  ) {
    acknowledgeEquipmentEvent(
      id: $id
      acknowledgedByUserId: $acknowledgedByUserId
    ) {
      id
      tenantId
      workCenterId
      iotDeviceId
      eventTimestamp
      eventType
      eventCode
      eventDescription
      severity
      acknowledged
      acknowledgedByUserId
      acknowledgedAt
      createdAt
    }
  }
`;
