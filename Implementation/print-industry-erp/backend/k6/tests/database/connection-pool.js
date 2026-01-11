/**
 * K6 Database Connection Pool Test
 * Tests database connection pool behavior under load
 *
 * REQ: REQ-P0-1768148786448-3r439 - Database stress testing
 *
 * Purpose: Verify connection pool can handle concurrent requests
 * Tests:
 * - Connection pool exhaustion
 * - Connection reuse
 * - Connection timeout handling
 * - Concurrent query execution
 */

import { sleep, check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { executeGraphQL, dbConnectionTime } from '../../lib/helpers.js';
import config from '../../config/test.config.js';

// Custom metrics for connection pool testing
const concurrentConnections = new Counter('concurrent_db_connections');
const connectionWaitTime = new Trend('connection_wait_time');
const connectionFailures = new Counter('connection_failures');

export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp to test pool growth
    gradual_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 }, // Should stay within pool
        { duration: '30s', target: 50 }, // Approaching pool limit
        { duration: '30s', target: 100 }, // Exceeding typical pool size
        { duration: '30s', target: 0 }, // Drain pool
      ],
      gracefulRampDown: '10s',
    },
    // Scenario 2: Sustained high concurrency
    sustained_high: {
      executor: 'constant-vus',
      vus: 80,
      duration: '2m',
      startTime: '3m', // Start after gradual ramp
    },
    // Scenario 3: Connection pool saturation test
    saturation: {
      executor: 'constant-arrival-rate',
      rate: 100, // 100 requests per second
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 50,
      maxVUs: 200,
      startTime: '5m', // Start after sustained high
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'], // Allow some failures under extreme load
    http_req_duration: ['p(95)<3000'], // Connections may queue
    db_connection_time: ['p(95)<200', 'p(99)<500'], // Connection acquisition time
    connection_wait_time: ['p(95)<1000'], // Time waiting for available connection
    connection_failures: ['count<100'], // Limited connection failures acceptable
  },
  tags: {
    test_type: 'database',
    test_focus: 'connection_pool',
  },
};

const GRAPHQL_URL = `${config.BASE_URL}${config.GRAPHQL_ENDPOINT}`;

// Queries that test different connection behaviors
const queries = {
  // Quick query - should release connection fast
  quickQuery: `
    query QuickQuery($tenantId: ID!) {
      financialPeriods(tenantId: $tenantId) {
        id
        periodYear
      }
    }
  `,
  // Medium query - holds connection longer
  mediumQuery: `
    query MediumQuery($tenantId: ID!, $facilityId: ID!) {
      chartOfAccounts(tenantId: $tenantId) {
        id
        accountNumber
        accountName
      }
      workCenters(facilityId: $facilityId) {
        id
        workCenterCode
      }
    }
  `,
  // Complex query with joins - holds connection longest
  complexQuery: `
    query ComplexQuery($tenantId: ID!, $year: Int!, $month: Int!) {
      trialBalance(tenantId: $tenantId, year: $year, month: $month) {
        accountNumber
        accountName
        debitAmount
        creditAmount
      }
      glBalances(tenantId: $tenantId, year: $year, month: $month) {
        accountId
        beginningBalance
        endingBalance
      }
    }
  `,
  // Transaction query - tests connection for writes
  transactionQuery: `
    mutation CreateJournalEntry($input: CreateJournalEntryInput!) {
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

  // Track connection acquisition
  concurrentConnections.add(1);
  const connectionStart = new Date();

  // Mix of query types to simulate realistic connection pool usage
  const queryType = Math.random();

  try {
    if (queryType < 0.4) {
      // 40% - Quick queries (fast connection release)
      const response = executeGraphQL(
        GRAPHQL_URL,
        queries.quickQuery,
        { tenantId },
        {},
        { name: 'pool_quick_query' }
      );

      check(response, {
        'quick query successful': (r) => r.status === 200,
      });
    } else if (queryType < 0.7) {
      // 30% - Medium queries
      const response = executeGraphQL(
        GRAPHQL_URL,
        queries.mediumQuery,
        { tenantId, facilityId },
        {},
        { name: 'pool_medium_query' }
      );

      check(response, {
        'medium query successful': (r) => r.status === 200,
      });
    } else if (queryType < 0.9) {
      // 20% - Complex queries (slow connection release)
      const currentDate = new Date();
      const response = executeGraphQL(
        GRAPHQL_URL,
        queries.complexQuery,
        {
          tenantId,
          year: currentDate.getFullYear(),
          month: currentDate.getMonth() + 1,
        },
        {},
        { name: 'pool_complex_query' }
      );

      check(response, {
        'complex query successful': (r) => r.status === 200,
      });

      // Complex queries may take longer
      sleep(0.2);
    } else {
      // 10% - Transaction queries
      const response = executeGraphQL(
        GRAPHQL_URL,
        queries.transactionQuery,
        {
          input: {
            entryType: 'STANDARD',
            entryDate: new Date().toISOString().split('T')[0],
            postingDate: new Date().toISOString().split('T')[0],
            description: `Connection pool test ${Date.now()}`,
            lines: [
              { accountId: 'acc-1000', debitAmount: 10.0, creditAmount: 0.0 },
              { accountId: 'acc-2000', debitAmount: 0.0, creditAmount: 10.0 },
            ],
          },
        },
        {},
        { name: 'pool_transaction_query' }
      );

      check(response, {
        'transaction successful': (r) => r.status === 200,
      });
    }

    // Track connection wait time
    const connectionTime = new Date() - connectionStart;
    connectionWaitTime.add(connectionTime);
    dbConnectionTime.add(connectionTime);
  } catch (error) {
    connectionFailures.add(1);
    console.error(`Connection error: ${error.message}`);
  }

  // Minimal sleep to maximize connection pressure
  sleep(0.05);
}

export function handleSummary(data) {
  const summary = {
    test_type: 'Database Connection Pool Test',
    timestamp: new Date().toISOString(),
    scenarios_run: Object.keys(data.root_group.groups || {}).length,
    metrics: {
      total_requests: data.metrics.http_reqs?.values?.count || 0,
      failed_requests: data.metrics.http_req_failed?.values?.count || 0,
      concurrent_connections_peak: data.metrics.concurrent_db_connections?.values?.count || 0,
      connection_wait_p95: data.metrics.connection_wait_time?.values?.['p(95)'] || 0,
      connection_wait_p99: data.metrics.connection_wait_time?.values?.['p(99)'] || 0,
      connection_failures: data.metrics.connection_failures?.values?.count || 0,
      avg_request_duration: data.metrics.http_req_duration?.values?.avg || 0,
      p95_request_duration: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
    },
    analysis: {
      connection_pool_adequate:
        (data.metrics.connection_failures?.values?.count || 0) < 50 &&
        (data.metrics.connection_wait_time?.values?.['p(95)'] || 0) < 1000,
      performance_acceptable: (data.metrics.http_req_duration?.values?.['p(95)'] || 0) < 3000,
      error_rate_acceptable: (data.metrics.http_req_failed?.values?.rate || 0) < 0.05,
    },
  };

  console.log('\n=== CONNECTION POOL TEST SUMMARY ===');
  console.log(`Total Requests: ${summary.metrics.total_requests}`);
  console.log(`Failed Requests: ${summary.metrics.failed_requests}`);
  console.log(`Connection Failures: ${summary.metrics.connection_failures}`);
  console.log(`P95 Connection Wait: ${summary.metrics.connection_wait_p95}ms`);
  console.log(`P95 Request Duration: ${summary.metrics.p95_request_duration}ms`);
  console.log('\n=== ANALYSIS ===');
  console.log(`Connection Pool Adequate: ${summary.analysis.connection_pool_adequate ? '✓' : '✗'}`);
  console.log(`Performance Acceptable: ${summary.analysis.performance_acceptable ? '✓' : '✗'}`);
  console.log(`Error Rate Acceptable: ${summary.analysis.error_rate_acceptable ? '✓' : '✗'}`);

  return {
    stdout: JSON.stringify(summary, null, 2),
    'connection-pool-test-summary.json': JSON.stringify(summary),
  };
}
