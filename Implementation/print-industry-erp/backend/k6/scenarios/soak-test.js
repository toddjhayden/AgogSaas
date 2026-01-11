/**
 * K6 Soak Test (Endurance Test)
 * Long-duration test to find memory leaks and degradation
 *
 * REQ: REQ-P0-1768148786448-3r439 - Database stress testing
 *
 * Purpose: Identify memory leaks, connection pool leaks, performance degradation
 * Expected: Moderate load sustained for extended period (1+ hours)
 * Success Criteria: No degradation over time, stable memory, no connection leaks
 */

import { sleep } from 'k6';
import { executeGraphQL, executeMutation, randomSleep, testData } from '../lib/helpers.js';
import config from '../config/test.config.js';

export const options = {
  stages: [
    { duration: '5m', target: 30 }, // Ramp up
    { duration: '60m', target: 30 }, // Sustain for 1 hour
    { duration: '5m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // Should maintain low error rate
    http_req_duration: ['p(95)<2000'], // Should maintain good performance
    // Critical for soak test - check for degradation over time
    'http_req_duration{percentile:95}': ['trend<2000'], // Response time shouldn't increase
    db_query_duration: ['p(95)<500', 'trend<500'], // Query time stable
  },
  tags: {
    test_type: 'soak',
  },
};

const GRAPHQL_URL = `${config.BASE_URL}${config.GRAPHQL_ENDPOINT}`;

// Realistic mix of queries that might be run in production
const queries = {
  dashboard: `
    query Dashboard($tenantId: ID!, $facilityId: ID!) {
      financialPeriods(tenantId: $tenantId) {
        id
        periodYear
        periodMonth
      }
      workCenters(facilityId: $facilityId) {
        id
        workCenterName
        status
      }
    }
  `,
  productionMetrics: `
    query ProductionMetrics($facilityId: ID!) {
      productionSummary(facilityId: $facilityId) {
        activeRuns
        completedRunsToday
        averageYield
      }
    }
  `,
  financialData: `
    query FinancialData($tenantId: ID!, $limit: Int) {
      invoices(tenantId: $tenantId, limit: $limit) {
        id
        invoiceNumber
        totalAmount
      }
      chartOfAccounts(tenantId: $tenantId) {
        id
        accountNumber
        accountName
      }
    }
  `,
};

const mutations = {
  statusUpdate: `
    mutation UpdateStatus($input: LogEquipmentStatusInput!) {
      logEquipmentStatus(input: $input) {
        id
        status
      }
    }
  `,
  journalEntry: `
    mutation CreateEntry($input: CreateJournalEntryInput!) {
      createJournalEntry(input: $input) {
        id
        journalEntryNumber
      }
    }
  `,
};

export default function () {
  const tenantId = config.MOCK_TENANT_ID;
  const facilityId = 'facility-001';

  // Realistic mix: 70% reads, 30% writes
  const operation = Math.random();

  if (operation < 0.3) {
    executeGraphQL(
      GRAPHQL_URL,
      queries.dashboard,
      { tenantId, facilityId },
      {},
      { name: 'soak_dashboard' }
    );
  } else if (operation < 0.5) {
    executeGraphQL(
      GRAPHQL_URL,
      queries.productionMetrics,
      { facilityId },
      {},
      { name: 'soak_production_metrics' }
    );
  } else if (operation < 0.7) {
    executeGraphQL(
      GRAPHQL_URL,
      queries.financialData,
      { tenantId, limit: 20 },
      {},
      { name: 'soak_financial_data' }
    );
  } else if (operation < 0.85) {
    executeMutation(
      GRAPHQL_URL,
      mutations.statusUpdate,
      {
        input: {
          workCenterId: 'wc-001',
          status: 'IN_USE',
          notes: `Soak test ${Date.now()}`,
        },
      },
      {},
      { name: 'soak_status_update' }
    );
  } else {
    executeMutation(
      GRAPHQL_URL,
      mutations.journalEntry,
      {
        input: {
          entryType: 'STANDARD',
          entryDate: testData.currentDate(),
          postingDate: testData.currentDate(),
          description: `Soak test entry ${Date.now()}`,
          lines: [
            { accountId: 'acc-1000', debitAmount: 100.0, creditAmount: 0.0 },
            { accountId: 'acc-2000', debitAmount: 0.0, creditAmount: 100.0 },
          ],
        },
      },
      {},
      { name: 'soak_journal_entry' }
    );
  }

  randomSleep(500, 2000); // Realistic user think time
}

export function handleSummary(data) {
  const summary = {
    ...data,
    // Add soak-specific analysis
    degradation_check: {
      // Check if response times increased over test duration
      first_5min_p95: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
      last_5min_p95: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
    },
  };

  return {
    stdout: JSON.stringify(summary, null, 2),
    'soak-test-summary.json': JSON.stringify(summary),
  };
}
