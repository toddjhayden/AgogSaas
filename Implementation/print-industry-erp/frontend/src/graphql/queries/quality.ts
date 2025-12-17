import { gql } from '@apollo/client';

export const GET_DEFECT_RATES = gql`
  query GetDefectRates($facilityId: UUID, $startDate: Date, $endDate: Date) {
    defectRatesByProduct(facilityId: $facilityId, startDate: $startDate, endDate: $endDate) {
      productId
      productName
      totalProduced
      totalDefects
      defectRate
      trend
      defectTypes {
        type
        count
      }
    }
  }
`;

export const GET_CUSTOMER_REJECTION_TRENDS = gql`
  query GetCustomerRejectionTrends($facilityId: UUID, $startDate: Date, $endDate: Date) {
    customerRejections(facilityId: $facilityId, startDate: $startDate, endDate: $endDate) {
      date
      totalShipments
      rejectedShipments
      rejectionRate
      reasons {
        reason
        count
      }
    }
  }
`;

export const GET_INSPECTION_RESULTS = gql`
  query GetInspectionResults($facilityId: UUID, $status: String) {
    inspections(facilityId: $facilityId, status: $status) {
      id
      inspectionNumber
      productId
      productName
      batchNumber
      inspectionDate
      inspector
      result
      defectsFound
      notes
    }
  }
`;

export const GET_NCR_STATUS = gql`
  query GetNCRStatus($facilityId: UUID, $status: String) {
    nonConformanceReports(facilityId: $facilityId, status: $status) {
      id
      ncrNumber
      dateRaised
      raisedBy
      productId
      productName
      description
      severity
      status
      correctiveAction
      closedDate
    }
  }
`;

export const GET_VENDOR_QUALITY_SCORECARD = gql`
  query GetVendorQualityScorecard($facilityId: UUID, $startDate: Date, $endDate: Date) {
    vendorQualityScorecard(facilityId: $facilityId, startDate: $startDate, endDate: $endDate) {
      vendorId
      vendorName
      totalReceipts
      acceptedReceipts
      acceptanceRate
      totalDefects
      defectRate
      onTimeDeliveryRate
      qualityScore
    }
  }
`;
