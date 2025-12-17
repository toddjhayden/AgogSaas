import { gql } from '@apollo/client';

export const GET_INVENTORY_LEVELS = gql`
  query GetInventoryLevels($facilityId: UUID, $locationId: UUID) {
    inventoryLevels(facilityId: $facilityId, locationId: $locationId) {
      materialId
      materialName
      locationId
      locationName
      quantity
      unit
      minQuantity
      maxQuantity
      status
      lastUpdated
    }
  }
`;

export const GET_WAVE_PROCESSING_STATUS = gql`
  query GetWaveProcessingStatus($facilityId: UUID) {
    waves(facilityId: $facilityId) {
      id
      waveNumber
      status
      totalOrders
      pickedOrders
      totalLines
      pickedLines
      pickAccuracy
      startTime
      completionTime
    }
  }
`;

export const GET_PICK_ACCURACY_RATE = gql`
  query GetPickAccuracyRate($facilityId: UUID, $startDate: Date, $endDate: Date) {
    pickAccuracy(facilityId: $facilityId, startDate: $startDate, endDate: $endDate) {
      date
      totalPicks
      accuratePicks
      accuracyRate
      errors {
        errorType
        count
      }
    }
  }
`;

export const GET_SHIPMENT_TRACKING = gql`
  query GetShipmentTracking($facilityId: UUID, $status: String) {
    shipments(facilityId: $facilityId, status: $status) {
      id
      shipmentNumber
      orderId
      carrier
      trackingNumber
      status
      scheduledDate
      actualShipDate
      destination
      items {
        productName
        quantity
      }
    }
  }
`;

export const GET_3PL_PERFORMANCE = gql`
  query Get3PLPerformance($facilityId: UUID, $startDate: Date, $endDate: Date) {
    thirdPartyLogisticsPerformance(
      facilityId: $facilityId
      startDate: $startDate
      endDate: $endDate
    ) {
      providerId
      providerName
      totalShipments
      onTimeShipments
      onTimeRate
      averageDeliveryTime
      damageRate
      costPerShipment
    }
  }
`;
