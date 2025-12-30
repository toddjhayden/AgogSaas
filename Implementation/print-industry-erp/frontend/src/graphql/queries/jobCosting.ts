import { gql } from '@apollo/client';

// =====================================================
// FRAGMENTS
// =====================================================

export const JOB_COST_FRAGMENT = gql`
  fragment JobCostFields on JobCost {
    id
    tenantId
    jobId
    estimateId
    totalAmount
    totalCost
    materialCost
    laborCost
    equipmentCost
    overheadCost
    outsourcingCost
    otherCost
    estimatedMaterialCost
    estimatedLaborCost
    estimatedEquipmentCost
    estimatedOverheadCost
    estimatedOutsourcingCost
    estimatedTotalCost
    grossProfit
    grossProfitMargin
    costVariance
    costVariancePercentage
    materialVariance
    laborVariance
    equipmentVariance
    status
    costingDate
    notes
    isReconciled
    reconciledAt
    reconciledBy
    lastRollupAt
    lastRollupSource
    createdAt
    updatedAt
    completedAt
    createdBy
    updatedBy
  }
`;

export const COST_LINE_ITEM_FRAGMENT = gql`
  fragment CostLineItemFields on CostLineItem {
    costCategory
    estimatedCost
    actualCost
    variance
    variancePercentage
  }
`;

export const JOB_COST_UPDATE_FRAGMENT = gql`
  fragment JobCostUpdateFields on JobCostUpdate {
    id
    tenantId
    jobCostId
    updateSource
    sourceId
    costCategory
    costDelta
    previousTotal
    newTotal
    quantity
    unitCost
    description
    createdAt
    createdBy
  }
`;

export const JOB_PROFITABILITY_FRAGMENT = gql`
  fragment JobProfitabilityFields on JobProfitability {
    jobId
    jobNumber
    customerName
    jobDescription
    revenue
    totalCost
    grossProfit
    grossMargin
    estimatedCost
    costVariance
    costVariancePercentage
    status
    costingDate
  }
`;

// =====================================================
// QUERIES
// =====================================================

export const GET_JOB_COST = gql`
  ${JOB_COST_FRAGMENT}
  ${COST_LINE_ITEM_FRAGMENT}
  query GetJobCost($jobCostId: ID!, $tenantId: ID!) {
    jobCost(jobCostId: $jobCostId, tenantId: $tenantId) {
      ...JobCostFields
      job {
        id
        jobNumber
        customerName
        status
      }
      estimate {
        id
        estimateNumber
        estimateDate
      }
      costBreakdown {
        ...CostLineItemFields
      }
    }
  }
`;

export const GET_JOB_COSTS = gql`
  ${JOB_COST_FRAGMENT}
  query GetJobCosts($filters: JobCostFilters, $limit: Int, $offset: Int) {
    jobCosts(filters: $filters, limit: $limit, offset: $offset) {
      ...JobCostFields
      jobNumber
      job {
        id
        jobNumber
        customerName
      }
    }
  }
`;

export const GET_JOB_PROFITABILITY = gql`
  ${JOB_PROFITABILITY_FRAGMENT}
  query GetJobProfitability($jobId: ID!, $tenantId: ID!) {
    jobProfitability(jobId: $jobId, tenantId: $tenantId) {
      ...JobProfitabilityFields
    }
  }
`;

export const GET_VARIANCE_REPORT = gql`
  ${JOB_PROFITABILITY_FRAGMENT}
  query GetVarianceReport($filters: VarianceReportFilters) {
    varianceReport(filters: $filters) {
      jobs {
        ...JobProfitabilityFields
      }
      summary {
        totalJobs
        totalRevenue
        totalCost
        totalProfit
        avgMargin
        minMargin
        maxMargin
        medianMargin
        totalVariance
        jobsOverBudget
        jobsUnderBudget
        jobsOnBudget
      }
    }
  }
`;

export const GET_JOB_COST_HISTORY = gql`
  ${JOB_COST_UPDATE_FRAGMENT}
  query GetJobCostHistory($jobCostId: ID!, $tenantId: ID!) {
    jobCostHistory(jobCostId: $jobCostId, tenantId: $tenantId) {
      ...JobCostUpdateFields
    }
  }
`;

// =====================================================
// MUTATIONS
// =====================================================

export const INITIALIZE_JOB_COST = gql`
  ${JOB_COST_FRAGMENT}
  mutation InitializeJobCost($input: InitializeJobCostInput!) {
    initializeJobCost(input: $input) {
      ...JobCostFields
    }
  }
`;

export const UPDATE_ACTUAL_COSTS = gql`
  ${JOB_COST_FRAGMENT}
  mutation UpdateActualCosts($jobCostId: ID!, $tenantId: ID!, $input: ActualCostInput!) {
    updateActualCosts(jobCostId: $jobCostId, tenantId: $tenantId, input: $input) {
      ...JobCostFields
    }
  }
`;

export const INCREMENT_COST = gql`
  ${JOB_COST_FRAGMENT}
  mutation IncrementCost($input: IncrementalCostInput!) {
    incrementCost(input: $input) {
      ...JobCostFields
    }
  }
`;

export const ROLLUP_PRODUCTION_COSTS = gql`
  ${JOB_COST_FRAGMENT}
  mutation RollupProductionCosts($input: RollupProductionCostsInput!) {
    rollupProductionCosts(input: $input) {
      ...JobCostFields
    }
  }
`;

export const ADD_FINAL_ADJUSTMENT = gql`
  ${JOB_COST_FRAGMENT}
  mutation AddFinalAdjustment($input: AddFinalAdjustmentInput!) {
    addFinalAdjustment(input: $input) {
      ...JobCostFields
    }
  }
`;

export const RECONCILE_JOB_COST = gql`
  ${JOB_COST_FRAGMENT}
  mutation ReconcileJobCost($input: ReconcileJobCostInput!) {
    reconcileJobCost(input: $input) {
      ...JobCostFields
    }
  }
`;

export const CLOSE_JOB_COSTING = gql`
  ${JOB_COST_FRAGMENT}
  mutation CloseJobCosting($input: CloseJobCostingInput!) {
    closeJobCosting(input: $input) {
      ...JobCostFields
    }
  }
`;

export const UPDATE_JOB_COST_STATUS = gql`
  ${JOB_COST_FRAGMENT}
  mutation UpdateJobCostStatus($jobCostId: ID!, $tenantId: ID!, $input: UpdateJobCostStatusInput!) {
    updateJobCostStatus(jobCostId: $jobCostId, tenantId: $tenantId, input: $input) {
      ...JobCostFields
    }
  }
`;

// =====================================================
// SUBSCRIPTIONS
// =====================================================

export const JOB_COST_UPDATED_SUBSCRIPTION = gql`
  ${JOB_COST_FRAGMENT}
  subscription JobCostUpdated($jobId: ID!) {
    jobCostUpdated(jobId: $jobId) {
      ...JobCostFields
    }
  }
`;

export const VARIANCE_ALERT_SUBSCRIPTION = gql`
  subscription VarianceAlert($threshold: Float!) {
    varianceAlert(threshold: $threshold) {
      jobId
      jobNumber
      costCategory
      variancePercentage
      threshold
      timestamp
    }
  }
`;
