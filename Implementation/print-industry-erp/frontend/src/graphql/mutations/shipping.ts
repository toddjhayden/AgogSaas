import { gql } from '@apollo/client';

/**
 * Shipping GraphQL Mutations
 * REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
 */

export const CREATE_SHIPMENT = gql`
  mutation CreateShipment($input: CreateShipmentInput!) {
    createShipment(input: $input) {
      id
      shipmentNumber
      status
      carrierName
      shipToName
      shipToAddressLine1
      shipToCity
      shipToPostalCode
      shipToCountry
      shipmentDate
      numberOfPackages
      createdAt
    }
  }
`;

export const MANIFEST_SHIPMENT = gql`
  mutation ManifestShipment($id: ID!) {
    manifestShipment(id: $id) {
      id
      shipmentNumber
      status
      trackingNumber
      carrierName
      serviceLevel
      totalCost
      estimatedDeliveryDate
      updatedAt
    }
  }
`;

export const SHIP_SHIPMENT = gql`
  mutation ShipShipment($id: ID!, $trackingNumber: String) {
    shipShipment(id: $id, trackingNumber: $trackingNumber) {
      id
      shipmentNumber
      status
      trackingNumber
      actualDeliveryDate
      updatedAt
    }
  }
`;

export const UPDATE_SHIPMENT_STATUS = gql`
  mutation UpdateShipmentStatus($id: ID!, $status: ShipmentStatus!, $notes: String) {
    updateShipmentStatus(id: $id, status: $status, notes: $notes) {
      id
      shipmentNumber
      status
      deliveryNotes
      updatedAt
    }
  }
`;

export const CREATE_CARRIER_INTEGRATION = gql`
  mutation CreateCarrierIntegration($input: CreateCarrierIntegrationInput!) {
    createCarrierIntegration(input: $input) {
      id
      carrierCode
      carrierName
      carrierType
      apiEndpoint
      accountNumber
      credentialsConfigured
      isActive
      createdAt
    }
  }
`;

export const UPDATE_CARRIER_INTEGRATION = gql`
  mutation UpdateCarrierIntegration($id: ID!, $input: UpdateCarrierIntegrationInput!) {
    updateCarrierIntegration(id: $id, input: $input) {
      id
      carrierName
      apiEndpoint
      isActive
      updatedAt
    }
  }
`;

export const DELETE_CARRIER_INTEGRATION = gql`
  mutation DeleteCarrierIntegration($id: ID!) {
    deleteCarrierIntegration(id: $id)
  }
`;

export const VOID_SHIPMENT = gql`
  mutation VoidShipment($id: ID!) {
    voidShipment(id: $id)
  }
`;

export const CREATE_MANIFEST = gql`
  mutation CreateManifest($shipmentIds: [ID!]!, $carrierIntegrationId: ID!) {
    createManifest(shipmentIds: $shipmentIds, carrierIntegrationId: $carrierIntegrationId) {
      manifestId
      carrierManifestId
      manifestDate
      shipmentCount
      totalWeight
      documentUrl
    }
  }
`;

export const REFRESH_TRACKING = gql`
  mutation RefreshTracking($shipmentId: ID!) {
    refreshTracking(shipmentId: $shipmentId) {
      id
      eventDate
      eventType
      eventDescription
      city
      state
      country
      carrierEventCode
      exceptionFlag
      exceptionReason
      createdAt
    }
  }
`;
