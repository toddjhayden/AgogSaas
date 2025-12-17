import { gql } from '@apollo/client';

export const GET_PL_SUMMARY = gql`
  query GetPLSummary($facilityId: UUID, $startDate: Date, $endDate: Date, $currency: String) {
    profitAndLoss(
      facilityId: $facilityId
      startDate: $startDate
      endDate: $endDate
      currency: $currency
    ) {
      revenue
      costOfGoodsSold
      grossProfit
      grossProfitMargin
      operatingExpenses
      operatingIncome
      operatingMargin
      netIncome
      netMargin
      currency
    }
  }
`;

export const GET_AR_AGING = gql`
  query GetARAging($facilityId: UUID, $asOfDate: Date) {
    accountsReceivableAging(facilityId: $facilityId, asOfDate: $asOfDate) {
      customerId
      customerName
      current
      days30
      days60
      days90
      days90Plus
      total
      currency
    }
  }
`;

export const GET_AP_AGING = gql`
  query GetAPAging($facilityId: UUID, $asOfDate: Date) {
    accountsPayableAging(facilityId: $facilityId, asOfDate: $asOfDate) {
      vendorId
      vendorName
      current
      days30
      days60
      days90
      days90Plus
      total
      currency
    }
  }
`;

export const GET_CASH_FLOW_FORECAST = gql`
  query GetCashFlowForecast($facilityId: UUID, $startDate: Date, $endDate: Date) {
    cashFlowForecast(facilityId: $facilityId, startDate: $startDate, endDate: $endDate) {
      date
      beginningBalance
      cashInflows {
        source
        amount
      }
      cashOutflows {
        category
        amount
      }
      netCashFlow
      endingBalance
    }
  }
`;

export const GET_MULTI_ENTITY_CONSOLIDATION = gql`
  query GetMultiEntityConsolidation($entityIds: [UUID!]!, $startDate: Date, $endDate: Date) {
    consolidatedFinancials(entityIds: $entityIds, startDate: $startDate, endDate: $endDate) {
      entityId
      entityName
      revenue
      expenses
      netIncome
      assets
      liabilities
      equity
      currency
    }
  }
`;
