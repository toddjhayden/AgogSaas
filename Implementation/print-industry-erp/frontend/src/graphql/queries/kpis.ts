import { gql } from '@apollo/client';

export const GET_ALL_KPIS = gql`
  query GetAllKPIs($facilityId: UUID, $category: String) {
    kpis(facilityId: $facilityId, category: $category) {
      id
      name_en
      name_zh
      category
      currentValue
      targetValue
      unit
      trend
      trendPercent
      formula
      updatedAt
      sparklineData
    }
  }
`;

export const GET_KPI_BY_ID = gql`
  query GetKPIById($id: UUID!) {
    kpi(id: $id) {
      id
      name_en
      name_zh
      category
      currentValue
      targetValue
      unit
      trend
      trendPercent
      formula
      description_en
      description_zh
      updatedAt
      historicalData {
        timestamp
        value
      }
    }
  }
`;

export const GET_TOP_KPIS = gql`
  query GetTopKPIs($facilityId: UUID, $limit: Int = 10) {
    topKPIs(facilityId: $facilityId, limit: $limit) {
      id
      name_en
      name_zh
      currentValue
      targetValue
      unit
      trend
      trendPercent
      sparklineData
    }
  }
`;

export const GET_KPI_CATEGORIES = gql`
  query GetKPICategories {
    kpiCategories {
      name
      count
    }
  }
`;
