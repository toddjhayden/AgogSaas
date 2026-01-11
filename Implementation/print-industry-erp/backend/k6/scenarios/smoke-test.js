/**
 * K6 Smoke Test
 * Minimal load test to verify system is functioning
 *
 * REQ: REQ-P0-1768148786448-3r439 - Database stress testing
 *
 * Purpose: Verify that the system can handle minimal load
 * Expected: 1-2 VUs for 30 seconds
 * Success Criteria: All requests succeed, response times under threshold
 */

import { sleep } from 'k6';
import { executeGraphQL, healthCheck } from '../lib/helpers.js';
import config from '../config/test.config.js';

export const options = {
  vus: 2,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    http_req_duration: ['p(95)<1000'], // 95% under 1 second
  },
  tags: {
    test_type: 'smoke',
  },
};

const GRAPHQL_URL = `${config.BASE_URL}${config.GRAPHQL_ENDPOINT}`;

// Simple queries to test basic functionality
const queries = {
  health: `
    query HealthCheck {
      __typename
    }
  `,
  workCenters: `
    query GetWorkCenters($facilityId: ID!) {
      workCenters(facilityId: $facilityId) {
        id
        workCenterCode
        workCenterName
        status
      }
    }
  `,
  chartOfAccounts: `
    query GetChartOfAccounts($tenantId: ID!) {
      chartOfAccounts(tenantId: $tenantId) {
        id
        accountNumber
        accountName
        accountType
      }
    }
  `,
  financialPeriods: `
    query GetFinancialPeriods($tenantId: ID!) {
      financialPeriods(tenantId: $tenantId) {
        id
        periodYear
        periodMonth
        status
      }
    }
  `,
};

export default function () {
  // Health check
  healthCheck(config.BASE_URL);

  // Test basic GraphQL queries
  executeGraphQL(GRAPHQL_URL, queries.health, {}, {}, { name: 'health_check' });
  sleep(0.5);

  executeGraphQL(
    GRAPHQL_URL,
    queries.workCenters,
    { facilityId: 'facility-001' },
    {},
    { name: 'get_work_centers' }
  );
  sleep(0.5);

  executeGraphQL(
    GRAPHQL_URL,
    queries.chartOfAccounts,
    { tenantId: config.MOCK_TENANT_ID },
    {},
    { name: 'get_chart_of_accounts' }
  );
  sleep(0.5);

  executeGraphQL(
    GRAPHQL_URL,
    queries.financialPeriods,
    { tenantId: config.MOCK_TENANT_ID },
    {},
    { name: 'get_financial_periods' }
  );
  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
    'smoke-test-summary.json': JSON.stringify(data),
  };
}
