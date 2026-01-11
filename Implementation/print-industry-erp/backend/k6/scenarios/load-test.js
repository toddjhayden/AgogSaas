/**
 * K6 Load Test
 * Standard load test to verify system performance under normal load
 *
 * REQ: REQ-P0-1768148786448-3r439 - Database stress testing
 *
 * Purpose: Test system performance under expected production load
 * Expected: Ramp from 0 to 50 VUs over 5 minutes
 * Success Criteria: Response times acceptable, error rate < 1%
 */

import { sleep } from 'k6';
import { executeGraphQL, executeMutation, randomSleep, testData } from '../lib/helpers.js';
import config from '../config/test.config.js';

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '1m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // 95% under 2s, 99% under 5s
    http_reqs: ['rate>30'], // At least 30 requests per second
  },
  tags: {
    test_type: 'load',
  },
};

const GRAPHQL_URL = `${config.BASE_URL}${config.GRAPHQL_ENDPOINT}`;

// Read queries
const queries = {
  productionOrders: `
    query GetProductionOrders($facilityId: ID!, $limit: Int) {
      productionOrders(facilityId: $facilityId, limit: $limit) {
        edges {
          node {
            id
            productionOrderNumber
            status
            quantityOrdered
            quantityCompleted
            dueDate
          }
        }
      }
    }
  `,
  productionRuns: `
    query GetProductionRuns($facilityId: ID, $limit: Int) {
      productionRuns(facilityId: $facilityId, limit: $limit) {
        id
        productionRunNumber
        status
        targetQuantity
        goodQuantity
        scrapQuantity
      }
    }
  `,
  invoices: `
    query GetInvoices($tenantId: ID!, $limit: Int) {
      invoices(tenantId: $tenantId, limit: $limit) {
        id
        invoiceNumber
        invoiceType
        totalAmount
        paidAmount
        status
      }
    }
  `,
  glBalances: `
    query GetGLBalances($tenantId: ID!, $year: Int!, $month: Int!) {
      glBalances(tenantId: $tenantId, year: $year, month: $month) {
        id
        accountId
        beginningBalance
        debitAmount
        creditAmount
        endingBalance
      }
    }
  `,
  oeeCalculations: `
    query GetOEECalculations($workCenterId: ID!, $startDate: Date!, $endDate: Date!) {
      oeeCalculations(workCenterId: $workCenterId, startDate: $startDate, endDate: $endDate) {
        id
        calculationDate
        availabilityPercent
        performancePercent
        qualityPercent
        oeePercent
      }
    }
  `,
};

// Write mutations
const mutations = {
  createJournalEntry: `
    mutation CreateJournalEntry($input: CreateJournalEntryInput!) {
      createJournalEntry(input: $input) {
        id
        journalEntryNumber
        status
      }
    }
  `,
  logEquipmentStatus: `
    mutation LogEquipmentStatus($input: LogEquipmentStatusInput!) {
      logEquipmentStatus(input: $input) {
        id
        status
        statusStartTime
      }
    }
  `,
};

export default function () {
  const tenantId = config.MOCK_TENANT_ID;
  const facilityId = 'facility-001';

  // Mix of read operations (80% reads, 20% writes)
  const operation = Math.random();

  if (operation < 0.2) {
    // 20% - Query production orders
    executeGraphQL(
      GRAPHQL_URL,
      queries.productionOrders,
      { facilityId, limit: 20 },
      {},
      { name: 'query_production_orders' }
    );
  } else if (operation < 0.4) {
    // 20% - Query production runs
    executeGraphQL(
      GRAPHQL_URL,
      queries.productionRuns,
      { facilityId, limit: 20 },
      {},
      { name: 'query_production_runs' }
    );
  } else if (operation < 0.6) {
    // 20% - Query invoices
    executeGraphQL(
      GRAPHQL_URL,
      queries.invoices,
      { tenantId, limit: 20 },
      {},
      { name: 'query_invoices' }
    );
  } else if (operation < 0.7) {
    // 10% - Query GL balances
    const currentDate = new Date();
    executeGraphQL(
      GRAPHQL_URL,
      queries.glBalances,
      {
        tenantId,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      },
      {},
      { name: 'query_gl_balances' }
    );
  } else if (operation < 0.8) {
    // 10% - Query OEE calculations
    executeGraphQL(
      GRAPHQL_URL,
      queries.oeeCalculations,
      {
        workCenterId: 'wc-001',
        startDate: testData.recentDate(),
        endDate: testData.currentDate(),
      },
      {},
      { name: 'query_oee_calculations' }
    );
  } else if (operation < 0.9) {
    // 10% - Create journal entry
    executeMutation(
      GRAPHQL_URL,
      mutations.createJournalEntry,
      {
        input: {
          entryType: 'STANDARD',
          entryDate: testData.currentDate(),
          postingDate: testData.currentDate(),
          description: `Load test journal entry ${Date.now()}`,
          lines: [
            {
              accountId: 'acc-1000',
              debitAmount: 1000.0,
              creditAmount: 0.0,
            },
            {
              accountId: 'acc-2000',
              debitAmount: 0.0,
              creditAmount: 1000.0,
            },
          ],
        },
      },
      {},
      { name: 'create_journal_entry' }
    );
  } else {
    // 10% - Log equipment status
    executeMutation(
      GRAPHQL_URL,
      mutations.logEquipmentStatus,
      {
        input: {
          workCenterId: 'wc-001',
          status: 'IN_USE',
          notes: `Load test status log ${Date.now()}`,
        },
      },
      {},
      { name: 'log_equipment_status' }
    );
  }

  randomSleep(100, 500);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
    'load-test-summary.json': JSON.stringify(data),
  };
}
