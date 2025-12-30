import { gql } from '@apollo/client';

// =====================================================
// FRAGMENTS
// =====================================================

export const ESTIMATE_FRAGMENT = gql`
  fragment EstimateFields on Estimate {
    id
    tenantId
    estimateNumber
    estimateDate
    revisionNumber
    parentEstimateId
    customerId
    customerName
    jobDescription
    quantityEstimated
    totalMaterialCost
    totalLaborCost
    totalEquipmentCost
    totalOverheadCost
    totalOutsourcingCost
    totalCost
    suggestedPrice
    targetMarginPercentage
    markupPercentage
    estimatedLeadTimeDays
    estimatedProductionHours
    status
    isTemplate
    templateName
    convertedToQuoteId
    convertedAt
    internalNotes
    customerNotes
    createdAt
    updatedAt
    createdBy
    updatedBy
    approvedBy
    approvedAt
  }
`;

export const ESTIMATE_OPERATION_FRAGMENT = gql`
  fragment EstimateOperationFields on EstimateOperation {
    id
    tenantId
    estimateId
    sequenceNumber
    operationType
    operationDescription
    equipmentId
    workCenterId
    setupTimeHours
    runTimeHours
    totalTimeHours
    runRatePerHour
    laborHours
    laborRatePerHour
    numberOfOperators
    materialCost
    laborCost
    equipmentCost
    overheadCost
    outsourcingCost
    operationTotalCost
    isOutsourced
    vendorId
    vendorQuoteAmount
    standardCostId
    costCalculationMethod
    createdAt
  }
`;

export const ESTIMATE_MATERIAL_FRAGMENT = gql`
  fragment EstimateMaterialFields on EstimateMaterial {
    id
    tenantId
    estimateId
    estimateOperationId
    materialId
    materialCode
    materialName
    materialCategory
    quantityRequired
    unitOfMeasure
    scrapPercentage
    quantityWithScrap
    unitCost
    totalCost
    costSource
    preferredVendorId
    preferredVendorName
    isSubstitute
    createdAt
  }
`;

// =====================================================
// QUERIES
// =====================================================

export const GET_ESTIMATE = gql`
  ${ESTIMATE_FRAGMENT}
  ${ESTIMATE_OPERATION_FRAGMENT}
  ${ESTIMATE_MATERIAL_FRAGMENT}
  query GetEstimate($estimateId: ID!) {
    estimate(estimateId: $estimateId) {
      ...EstimateFields
      operations {
        ...EstimateOperationFields
      }
      materials {
        ...EstimateMaterialFields
      }
    }
  }
`;

export const GET_ESTIMATES = gql`
  ${ESTIMATE_FRAGMENT}
  query GetEstimates($filters: EstimateFilters, $limit: Int, $offset: Int) {
    estimates(filters: $filters, limit: $limit, offset: $offset) {
      ...EstimateFields
    }
  }
`;

export const GET_ESTIMATE_BY_NUMBER = gql`
  ${ESTIMATE_FRAGMENT}
  ${ESTIMATE_OPERATION_FRAGMENT}
  ${ESTIMATE_MATERIAL_FRAGMENT}
  query GetEstimateByNumber($estimateNumber: String!, $revisionNumber: Int) {
    estimateByNumber(estimateNumber: $estimateNumber, revisionNumber: $revisionNumber) {
      ...EstimateFields
      operations {
        ...EstimateOperationFields
      }
      materials {
        ...EstimateMaterialFields
      }
    }
  }
`;

export const GET_ESTIMATE_TEMPLATES = gql`
  ${ESTIMATE_FRAGMENT}
  query GetEstimateTemplates {
    estimateTemplates {
      ...EstimateFields
    }
  }
`;

// =====================================================
// MUTATIONS
// =====================================================

export const CREATE_ESTIMATE = gql`
  ${ESTIMATE_FRAGMENT}
  mutation CreateEstimate($input: CreateEstimateInput!) {
    createEstimate(input: $input) {
      ...EstimateFields
    }
  }
`;

export const UPDATE_ESTIMATE = gql`
  ${ESTIMATE_FRAGMENT}
  mutation UpdateEstimate($estimateId: ID!, $input: UpdateEstimateInput!) {
    updateEstimate(estimateId: $estimateId, input: $input) {
      ...EstimateFields
    }
  }
`;

export const DELETE_ESTIMATE = gql`
  mutation DeleteEstimate($estimateId: ID!) {
    deleteEstimate(estimateId: $estimateId)
  }
`;

export const ADD_ESTIMATE_OPERATION = gql`
  ${ESTIMATE_OPERATION_FRAGMENT}
  mutation AddEstimateOperation($input: AddEstimateOperationInput!) {
    addEstimateOperation(input: $input) {
      ...EstimateOperationFields
    }
  }
`;

export const UPDATE_ESTIMATE_OPERATION = gql`
  ${ESTIMATE_OPERATION_FRAGMENT}
  mutation UpdateEstimateOperation($operationId: ID!, $input: UpdateEstimateOperationInput!) {
    updateEstimateOperation(operationId: $operationId, input: $input) {
      ...EstimateOperationFields
    }
  }
`;

export const DELETE_ESTIMATE_OPERATION = gql`
  mutation DeleteEstimateOperation($operationId: ID!) {
    deleteEstimateOperation(operationId: $operationId)
  }
`;

export const ADD_ESTIMATE_MATERIAL = gql`
  ${ESTIMATE_MATERIAL_FRAGMENT}
  mutation AddEstimateMaterial($input: AddEstimateMaterialInput!) {
    addEstimateMaterial(input: $input) {
      ...EstimateMaterialFields
    }
  }
`;

export const DELETE_ESTIMATE_MATERIAL = gql`
  mutation DeleteEstimateMaterial($materialId: ID!) {
    deleteEstimateMaterial(materialId: $materialId)
  }
`;

export const RECALCULATE_ESTIMATE = gql`
  ${ESTIMATE_FRAGMENT}
  ${ESTIMATE_OPERATION_FRAGMENT}
  ${ESTIMATE_MATERIAL_FRAGMENT}
  mutation RecalculateEstimate($estimateId: ID!) {
    recalculateEstimate(estimateId: $estimateId) {
      ...EstimateFields
      operations {
        ...EstimateOperationFields
      }
      materials {
        ...EstimateMaterialFields
      }
    }
  }
`;

export const CREATE_ESTIMATE_REVISION = gql`
  ${ESTIMATE_FRAGMENT}
  mutation CreateEstimateRevision($estimateId: ID!) {
    createEstimateRevision(estimateId: $estimateId) {
      ...EstimateFields
    }
  }
`;

export const CONVERT_ESTIMATE_TO_QUOTE = gql`
  mutation ConvertEstimateToQuote($estimateId: ID!, $quoteInput: ConvertToQuoteInput!) {
    convertEstimateToQuote(estimateId: $estimateId, quoteInput: $quoteInput) {
      id
      quoteNumber
      customerId
      quotedAmount
      status
    }
  }
`;

export const CREATE_ESTIMATE_TEMPLATE = gql`
  ${ESTIMATE_FRAGMENT}
  mutation CreateEstimateTemplate($estimateId: ID!, $templateName: String!) {
    createEstimateTemplate(estimateId: $estimateId, templateName: $templateName) {
      ...EstimateFields
    }
  }
`;

export const APPLY_ESTIMATE_TEMPLATE = gql`
  ${ESTIMATE_FRAGMENT}
  ${ESTIMATE_OPERATION_FRAGMENT}
  ${ESTIMATE_MATERIAL_FRAGMENT}
  mutation ApplyEstimateTemplate($estimateId: ID!, $templateId: ID!) {
    applyEstimateTemplate(estimateId: $estimateId, templateId: $templateId) {
      ...EstimateFields
      operations {
        ...EstimateOperationFields
      }
      materials {
        ...EstimateMaterialFields
      }
    }
  }
`;

export const APPROVE_ESTIMATE = gql`
  ${ESTIMATE_FRAGMENT}
  mutation ApproveEstimate($estimateId: ID!) {
    approveEstimate(estimateId: $estimateId) {
      ...EstimateFields
    }
  }
`;

export const REJECT_ESTIMATE = gql`
  ${ESTIMATE_FRAGMENT}
  mutation RejectEstimate($estimateId: ID!, $reason: String) {
    rejectEstimate(estimateId: $estimateId, reason: $reason) {
      ...EstimateFields
    }
  }
`;
