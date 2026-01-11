import { gql } from '@apollo/client';

/**
 * Shipping GraphQL Queries
 * REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
 */

export const GET_SHIPMENTS = gql`
  query GetShipments(
    $tenantId: ID!
    $facilityId: ID
    $status: ShipmentStatus
    $startDate: Date
    $endDate: Date
    $trackingNumber: String
  ) {
    shipments(
      tenantId: $tenantId
      facilityId: $facilityId
      status: $status
      startDate: $startDate
      endDate: $endDate
      trackingNumber: $trackingNumber
    ) {
      id
      shipmentNumber
      status
      carrierName
      serviceLevel
      trackingNumber
      shipToName
      shipToCity
      shipToState
      shipToCountry
      shipmentDate
      estimatedDeliveryDate
      actualDeliveryDate
      numberOfPackages
      totalWeight
      totalCost
      createdAt
    }
  }
`;

export const GET_SHIPMENT = gql`
  query GetShipment($id: ID!, $tenantId: ID!) {
    shipment(id: $id, tenantId: $tenantId) {
      id
      tenantId
      facilityId
      shipmentNumber
      salesOrderId
      waveId
      carrierIntegrationId
      carrierName
      serviceLevel
      trackingNumber
      proNumber
      shipToName
      shipToAddressLine1
      shipToAddressLine2
      shipToCity
      shipToState
      shipToPostalCode
      shipToCountry
      shipToPhone
      shipToEmail
      shipmentDate
      estimatedDeliveryDate
      actualDeliveryDate
      numberOfPackages
      totalWeight
      totalVolume
      freight
      insurance
      otherCharges
      totalCost
      status
      bolNumber
      bolDocument
      commercialInvoice
      shippingNotes
      deliveryNotes
      createdAt
      createdBy
      updatedAt
      updatedBy
      lines {
        id
        lineNumber
        materialCode
        materialDescription
        quantityShipped
        unitOfMeasure
        packageNumber
        weight
        volume
        lotNumber
      }
      trackingEvents {
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
      }
      carrier {
        id
        carrierCode
        carrierName
        carrierType
        supportsTracking
        supportsRateQuotes
        supportsLabelGeneration
      }
    }
  }
`;

export const GET_CARRIER_INTEGRATIONS = gql`
  query GetCarrierIntegrations($tenantId: ID!) {
    carrierIntegrations(tenantId: $tenantId) {
      id
      tenantId
      carrierCode
      carrierName
      carrierType
      apiEndpoint
      apiVersion
      accountNumber
      serviceMapping
      credentialsConfigured
      supportsTracking
      supportsRateQuotes
      supportsLabelGeneration
      isActive
      createdAt
      createdBy
      updatedAt
      updatedBy
    }
  }
`;

export const GET_TRACKING_EVENTS = gql`
  query GetTrackingEvents($shipmentId: ID!, $tenantId: ID!) {
    shipment(id: $shipmentId, tenantId: $tenantId) {
      id
      trackingNumber
      trackingEvents {
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
  }
`;

export const GET_CARRIER_INTEGRATION = gql`
  query GetCarrierIntegration($id: ID!, $tenantId: ID!) {
    carrierIntegration(id: $id, tenantId: $tenantId) {
      id
      tenantId
      facilityId
      carrierCode
      carrierName
      carrierType
      apiEndpoint
      apiVersion
      accountNumber
      serviceMapping {
        code
        name
        transitDays
        guaranteedDelivery
      }
      credentialsConfigured
      supportsTracking
      supportsRateQuotes
      supportsLabelGeneration
      isActive
      connectionStatus
      lastConnectionTest
      createdAt
      createdBy
      updatedAt
      updatedBy
    }
  }
`;

export const TEST_CARRIER_CONNECTION = gql`
  query TestCarrierConnection($id: ID!, $tenantId: ID!) {
    testCarrierConnection(id: $id, tenantId: $tenantId) {
      isConnected
      apiVersion
      responseTimeMs
      error
      testedAt
    }
  }
`;

export const GET_RATE_QUOTES = gql`
  query GetRateQuotes($input: RateShopInput!) {
    getRateQuotes(input: $input) {
      serviceType
      serviceName
      carrierCode
      carrierName
      totalCost
      currency
      baseRate
      fuelSurcharge
      insurance
      residential
      saturday
      otherCharges
      transitDays
      estimatedDeliveryDate
      guaranteedDelivery
      quotedAt
    }
  }
`;

export const VALIDATE_ADDRESS = gql`
  query ValidateAddress($input: ValidateAddressInput!, $carrierCode: CarrierCode) {
    validateAddress(input: $input, carrierCode: $carrierCode) {
      isValid
      validatedAddress {
        name
        addressLine1
        addressLine2
        city
        state
        postalCode
        country
        isResidential
      }
      suggestions {
        name
        addressLine1
        addressLine2
        city
        state
        postalCode
        country
        isResidential
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const TRACK_SHIPMENT = gql`
  query TrackShipment($trackingNumber: String!, $carrierCode: CarrierCode!) {
    trackShipment(trackingNumber: $trackingNumber, carrierCode: $carrierCode) {
      id
      eventDate
      eventType
      eventDescription
      city
      state
      country
      postalCode
      carrierEventCode
      exceptionFlag
      exceptionReason
      signedBy
      createdAt
    }
  }
`;
