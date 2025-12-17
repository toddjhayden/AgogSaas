import { gql } from '@apollo/client';

export const GET_PRODUCTION_RUNS = gql`
  query GetProductionRuns($facilityId: UUID, $status: String) {
    productionRuns(facilityId: $facilityId, status: $status) {
      id
      workOrderNumber
      productName
      quantity
      status
      startTime
      endTime
      workCenter
      operator
      progress
    }
  }
`;

export const GET_WORK_CENTER_STATUS = gql`
  query GetWorkCenterStatus($facilityId: UUID) {
    workCenters(facilityId: $facilityId) {
      id
      name
      status
      currentJob
      utilization
      oee
      availability
      performance
      quality
    }
  }
`;

export const GET_OEE_BY_PRESS = gql`
  query GetOEEByPress($facilityId: UUID, $startDate: Date, $endDate: Date) {
    oeeByPress(facilityId: $facilityId, startDate: $startDate, endDate: $endDate) {
      pressId
      pressName
      oee
      availability
      performance
      quality
      trend
    }
  }
`;

export const GET_MATERIAL_CONSUMPTION = gql`
  query GetMaterialConsumption($facilityId: UUID, $productionRunId: UUID) {
    materialConsumption(facilityId: $facilityId, productionRunId: $productionRunId) {
      materialId
      materialName
      plannedQuantity
      actualQuantity
      variance
      variancePercent
      unit
    }
  }
`;

export const GET_CHANGEOVER_TRACKING = gql`
  query GetChangeoverTracking($facilityId: UUID, $startDate: Date, $endDate: Date) {
    changeovers(facilityId: $facilityId, startDate: $startDate, endDate: $endDate) {
      id
      workCenter
      fromProduct
      toProduct
      startTime
      endTime
      duration
      targetDuration
      status
    }
  }
`;
