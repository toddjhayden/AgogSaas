/**
 * K6 Stress Test
 * High load test to find system breaking points
 *
 * REQ: REQ-P0-1768148786448-3r439 - Database stress testing
 *
 * Purpose: Identify system limits and breaking points
 * Expected: Ramp from 0 to 200 VUs to push beyond normal capacity
 * Success Criteria: System gracefully handles overload, recovers when load decreases
 */

import { sleep } from 'k6';
import { executeGraphQL, executeMutation, randomSleep, testData, randomTenantId } from '../lib/helpers.js';
import config from '../config/test.config.js';

export const options = {
  stages: [
    { duration: '2m', target: 50 }, // Warm up
    { duration: '3m', target: 100 }, // Ramp to normal load
    { duration: '5m', target: 200 }, // Stress: push beyond normal
    { duration: '3m', target: 200 }, // Sustain stress
    { duration: '2m', target: 50 }, // Recover
    { duration: '1m', target: 0 }, // Scale down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // Allow up to 5% errors under stress
    http_req_duration: ['p(95)<5000', 'p(99)<10000'], // More lenient thresholds
    http_reqs: ['rate>50'], // Still expect reasonable throughput
  },
  tags: {
    test_type: 'stress',
  },
};

const GRAPHQL_URL = `${config.BASE_URL}${config.GRAPHQL_ENDPOINT}`;

// Heavy queries that stress the database
const queries = {
  complexProductionAnalytics: `
    query ComplexProductionAnalytics($facilityId: ID!) {
      productionSummary(facilityId: $facilityId) {
        activeRuns
        scheduledRuns
        completedRunsToday
        totalGoodQuantity
        totalScrapQuantity
        averageYield
        currentOEE
      }
      workCenterSummaries(facilityId: $facilityId) {
        workCenterName
        activeRuns
        completedRunsToday
        averageYield
        currentOEE
      }
      workCenterUtilization(facilityId: $facilityId) {
        workCenterName
        status
        todayRuntime
        todayDowntime
        utilizationPercentage
      }
    }
  `,
  financialReports: `
    query FinancialReports($tenantId: ID!, $year: Int!, $month: Int!) {
      trialBalance(tenantId: $tenantId, year: $year, month: $month) {
        accountNumber
        accountName
        debitAmount
        creditAmount
      }
      glBalances(tenantId: $tenantId, year: $year, month: $month) {
        accountId
        beginningBalance
        debitAmount
        creditAmount
        endingBalance
      }
    }
  `,
  multiEntityQuery: `
    query MultiEntityQuery($tenantId: ID!, $facilityId: ID!) {
      chartOfAccounts(tenantId: $tenantId) {
        id
        accountNumber
        accountName
      }
      workCenters(facilityId: $facilityId) {
        id
        workCenterCode
        workCenterName
      }
      operations(tenantId: $tenantId) {
        id
        operationCode
        operationName
      }
    }
  `,
};

// Complex mutations
const mutations = {
  createProductionOrder: `
    mutation CreateProductionOrder($input: CreateProductionOrderInput!) {
      createProductionOrder(input: $input) {
        id
        productionOrderNumber
        status
      }
    }
  `,
  createInvoice: `
    mutation CreateInvoice($input: CreateInvoiceInput!) {
      createInvoice(input: $input) {
        id
        invoiceNumber
        totalAmount
      }
    }
  `,
  createJournalEntry: `
    mutation CreateJournalEntry($input: CreateJournalEntryInput!) {
      createJournalEntry(input: $input) {
        id
        journalEntryNumber
      }
    }
  `,
};

export default function () {
  const tenantId = randomTenantId(); // Use different tenants to test multi-tenancy
  const facilityId = 'facility-001';
  const currentDate = new Date();

  // Mix of operations with heavier database load
  const operation = Math.random();

  if (operation < 0.3) {
    // 30% - Complex production analytics
    executeGraphQL(
      GRAPHQL_URL,
      queries.complexProductionAnalytics,
      { facilityId },
      { 'x-tenant-id': tenantId },
      { name: 'complex_production_analytics' }
    );
  } else if (operation < 0.5) {
    // 20% - Financial reports (joins multiple tables)
    executeGraphQL(
      GRAPHQL_URL,
      queries.financialReports,
      {
        tenantId,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      },
      { 'x-tenant-id': tenantId },
      { name: 'financial_reports' }
    );
  } else if (operation < 0.7) {
    // 20% - Multi-entity query
    executeGraphQL(
      GRAPHQL_URL,
      queries.multiEntityQuery,
      { tenantId, facilityId },
      { 'x-tenant-id': tenantId },
      { name: 'multi_entity_query' }
    );
  } else if (operation < 0.8) {
    // 10% - Create production order
    executeMutation(
      GRAPHQL_URL,
      mutations.createProductionOrder,
      {
        input: {
          facilityId,
          productionOrderNumber: testData.productionOrderNumber(),
          productId: 'product-001',
          quantityOrdered: Math.floor(Math.random() * 1000) + 100,
          unitOfMeasure: 'PIECES',
          priority: Math.floor(Math.random() * 5) + 1,
          dueDate: testData.futureDate(),
        },
      },
      { 'x-tenant-id': tenantId },
      { name: 'create_production_order' }
    );
  } else if (operation < 0.9) {
    // 10% - Create invoice
    executeMutation(
      GRAPHQL_URL,
      mutations.createInvoice,
      {
        input: {
          invoiceType: 'CUSTOMER_INVOICE',
          billToName: 'Test Customer',
          invoiceDate: testData.currentDate(),
          dueDate: testData.futureDate(),
          currencyCode: 'USD',
          lines: [
            {
              description: 'Stress test line item',
              quantity: 100,
              unitPrice: 10.0,
              lineAmount: 1000.0,
            },
          ],
        },
      },
      { 'x-tenant-id': tenantId },
      { name: 'create_invoice' }
    );
  } else {
    // 10% - Create journal entry with multiple lines
    const lineCount = Math.floor(Math.random() * 10) + 5; // 5-15 lines
    const lines = [];
    let totalDebit = 0;

    for (let i = 0; i < lineCount - 1; i++) {
      const amount = Math.random() * 1000;
      totalDebit += amount;
      lines.push({
        accountId: `acc-${1000 + i}`,
        debitAmount: amount,
        creditAmount: 0.0,
      });
    }

    // Last line balances the entry
    lines.push({
      accountId: 'acc-9999',
      debitAmount: 0.0,
      creditAmount: totalDebit,
    });

    executeMutation(
      GRAPHQL_URL,
      mutations.createJournalEntry,
      {
        input: {
          entryType: 'STANDARD',
          entryDate: testData.currentDate(),
          postingDate: testData.currentDate(),
          description: `Stress test journal entry ${Date.now()}`,
          lines,
        },
      },
      { 'x-tenant-id': tenantId },
      { name: 'create_complex_journal_entry' }
    );
  }

  randomSleep(50, 300); // Less sleep under stress
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
    'stress-test-summary.json': JSON.stringify(data),
  };
}
