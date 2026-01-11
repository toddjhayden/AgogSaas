/**
 * K6 Spike Test
 * Sudden load spike test to verify system elasticity
 *
 * REQ: REQ-P0-1768148786448-3r439 - Database stress testing
 *
 * Purpose: Test system's ability to handle sudden traffic spikes
 * Expected: Sudden jump from low to very high load
 * Success Criteria: System handles spike without crashes, recovers quickly
 */

import { sleep } from 'k6';
import { executeGraphQL, executeMutation, testData } from '../lib/helpers.js';
import config from '../config/test.config.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Normal load
    { duration: '1m', target: 200 }, // SPIKE!
    { duration: '30s', target: 200 }, // Sustain spike
    { duration: '1m', target: 10 }, // Return to normal
    { duration: '30s', target: 0 }, // Scale down
  ],
  thresholds: {
    http_req_failed: ['rate<0.1'], // Allow up to 10% errors during spike
    http_req_duration: ['p(95)<8000'], // Lenient during spike
  },
  tags: {
    test_type: 'spike',
  },
};

const GRAPHQL_URL = `${config.BASE_URL}${config.GRAPHQL_ENDPOINT}`;

const queries = {
  quickRead: `
    query QuickRead($tenantId: ID!) {
      financialPeriods(tenantId: $tenantId) {
        id
        periodYear
        periodMonth
        status
      }
    }
  `,
  mediumComplexity: `
    query MediumComplexity($tenantId: ID!, $limit: Int) {
      invoices(tenantId: $tenantId, limit: $limit) {
        id
        invoiceNumber
        totalAmount
        status
        lines {
          id
          description
          totalAmount
        }
      }
    }
  `,
};

const mutations = {
  quickWrite: `
    mutation LogStatus($input: LogEquipmentStatusInput!) {
      logEquipmentStatus(input: $input) {
        id
      }
    }
  `,
};

export default function () {
  const tenantId = config.MOCK_TENANT_ID;

  // Mostly reads during spike to simulate real traffic pattern
  const operation = Math.random();

  if (operation < 0.5) {
    executeGraphQL(
      GRAPHQL_URL,
      queries.quickRead,
      { tenantId },
      {},
      { name: 'spike_quick_read' }
    );
  } else if (operation < 0.8) {
    executeGraphQL(
      GRAPHQL_URL,
      queries.mediumComplexity,
      { tenantId, limit: 10 },
      {},
      { name: 'spike_medium_read' }
    );
  } else {
    executeMutation(
      GRAPHQL_URL,
      mutations.quickWrite,
      {
        input: {
          workCenterId: 'wc-001',
          status: 'IN_USE',
        },
      },
      {},
      { name: 'spike_quick_write' }
    );
  }

  sleep(0.1); // Minimal sleep during spike
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
    'spike-test-summary.json': JSON.stringify(data),
  };
}
