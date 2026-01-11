/**
 * K6 Database Query Performance Test
 * Tests query performance under various conditions
 *
 * REQ: REQ-P0-1768148786448-3r439 - Database stress testing
 *
 * Purpose: Identify slow queries and performance bottlenecks
 * Tests:
 * - Simple vs complex query performance
 * - Query with indexes vs without
 * - Query with joins
 * - Aggregation query performance
 * - Full-text search performance
 */

import { sleep, check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { executeGraphQL, dbQueryDuration } from '../../lib/helpers.js';
import config from '../../config/test.config.js';

// Query-specific metrics
const simpleQueryDuration = new Trend('simple_query_duration');
const complexQueryDuration = new Trend('complex_query_duration');
const joinQueryDuration = new Trend('join_query_duration');
const aggregationQueryDuration = new Trend('aggregation_query_duration');
const slowQueries = new Counter('slow_queries'); // Queries > 1 second

export const options = {
  scenarios: {
    // Test different query types with consistent load
    query_performance: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    simple_query_duration: ['p(95)<100', 'p(99)<200'], // Simple queries should be very fast
    complex_query_duration: ['p(95)<500', 'p(99)<1000'], // Complex queries can be slower
    join_query_duration: ['p(95)<800', 'p(99)<1500'], // Joins take longer
    aggregation_query_duration: ['p(95)<1000', 'p(99)<2000'], // Aggregations are expensive
    slow_queries: ['count<50'], // Should have few slow queries
  },
  tags: {
    test_type: 'database',
    test_focus: 'query_performance',
  },
};

const GRAPHQL_URL = `${config.BASE_URL}${config.GRAPHQL_ENDPOINT}`;

const queries = {
  // Simple indexed query - should be very fast
  simpleIndexed: `
    query SimpleIndexed($id: ID!) {
      financialPeriod(id: $id) {
        id
        periodYear
        periodMonth
      }
    }
  `,
  // Simple table scan
  simpleScan: `
    query SimpleScan($tenantId: ID!) {
      financialPeriods(tenantId: $tenantId) {
        id
        periodYear
        periodMonth
        status
      }
    }
  `,
  // Query with single join
  singleJoin: `
    query SingleJoin($tenantId: ID!) {
      chartOfAccounts(tenantId: $tenantId) {
        id
        accountNumber
        accountName
        parentAccount {
          id
          accountName
        }
      }
    }
  `,
  // Query with multiple joins
  multipleJoins: `
    query MultipleJoins($tenantId: ID!, $limit: Int) {
      invoices(tenantId: $tenantId, limit: $limit) {
        id
        invoiceNumber
        totalAmount
        lines {
          id
          description
          totalAmount
        }
        payments {
          id
          paymentAmount
        }
      }
    }
  `,
  // Aggregation query
  aggregation: `
    query Aggregation($tenantId: ID!, $year: Int!, $month: Int!) {
      trialBalance(tenantId: $tenantId, year: $year, month: $month) {
        accountNumber
        accountName
        debitAmount
        creditAmount
      }
    }
  `,
  // Complex analytical query
  complexAnalytical: `
    query ComplexAnalytical($facilityId: ID!) {
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
        workCenterType
        activeRuns
        completedRunsToday
        averageYield
        currentOEE
      }
    }
  `,
  // Time-series query (common for analytics)
  timeSeries: `
    query TimeSeries($workCenterId: ID!, $startDate: Date!, $endDate: Date!) {
      oeeCalculations(
        workCenterId: $workCenterId
        startDate: $startDate
        endDate: $endDate
      ) {
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

export default function () {
  const tenantId = config.MOCK_TENANT_ID;
  const facilityId = 'facility-001';
  const currentDate = new Date();

  // Distribute queries to test different performance characteristics
  const queryType = Math.random();
  let startTime, duration, response;

  if (queryType < 0.15) {
    // 15% - Simple indexed lookup
    startTime = new Date();
    response = executeGraphQL(
      GRAPHQL_URL,
      queries.simpleIndexed,
      { id: 'period-001' },
      {},
      { name: 'perf_simple_indexed' }
    );
    duration = new Date() - startTime;
    simpleQueryDuration.add(duration);

    check(response, { 'simple indexed query successful': (r) => r.status === 200 });
  } else if (queryType < 0.3) {
    // 15% - Simple table scan
    startTime = new Date();
    response = executeGraphQL(
      GRAPHQL_URL,
      queries.simpleScan,
      { tenantId },
      {},
      { name: 'perf_simple_scan' }
    );
    duration = new Date() - startTime;
    simpleQueryDuration.add(duration);

    check(response, { 'simple scan query successful': (r) => r.status === 200 });
  } else if (queryType < 0.45) {
    // 15% - Single join
    startTime = new Date();
    response = executeGraphQL(
      GRAPHQL_URL,
      queries.singleJoin,
      { tenantId },
      {},
      { name: 'perf_single_join' }
    );
    duration = new Date() - startTime;
    joinQueryDuration.add(duration);

    check(response, { 'single join query successful': (r) => r.status === 200 });
  } else if (queryType < 0.6) {
    // 15% - Multiple joins
    startTime = new Date();
    response = executeGraphQL(
      GRAPHQL_URL,
      queries.multipleJoins,
      { tenantId, limit: 20 },
      {},
      { name: 'perf_multiple_joins' }
    );
    duration = new Date() - startTime;
    joinQueryDuration.add(duration);
    complexQueryDuration.add(duration);

    check(response, { 'multiple joins query successful': (r) => r.status === 200 });
  } else if (queryType < 0.75) {
    // 15% - Aggregation
    startTime = new Date();
    response = executeGraphQL(
      GRAPHQL_URL,
      queries.aggregation,
      {
        tenantId,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      },
      {},
      { name: 'perf_aggregation' }
    );
    duration = new Date() - startTime;
    aggregationQueryDuration.add(duration);
    complexQueryDuration.add(duration);

    check(response, { 'aggregation query successful': (r) => r.status === 200 });
  } else if (queryType < 0.9) {
    // 15% - Complex analytical
    startTime = new Date();
    response = executeGraphQL(
      GRAPHQL_URL,
      queries.complexAnalytical,
      { facilityId },
      {},
      { name: 'perf_complex_analytical' }
    );
    duration = new Date() - startTime;
    complexQueryDuration.add(duration);

    check(response, { 'complex analytical query successful': (r) => r.status === 200 });
  } else {
    // 10% - Time-series
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    startTime = new Date();
    response = executeGraphQL(
      GRAPHQL_URL,
      queries.timeSeries,
      {
        workCenterId: 'wc-001',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      {},
      { name: 'perf_time_series' }
    );
    duration = new Date() - startTime;
    complexQueryDuration.add(duration);

    check(response, { 'time-series query successful': (r) => r.status === 200 });
  }

  // Track slow queries (> 1 second)
  if (duration > 1000) {
    slowQueries.add(1);
    console.warn(`Slow query detected: ${duration}ms`);
  }

  dbQueryDuration.add(duration);

  sleep(0.2);
}

export function handleSummary(data) {
  const summary = {
    test_type: 'Database Query Performance Test',
    timestamp: new Date().toISOString(),
    metrics: {
      total_queries: data.metrics.db_queries_total?.values?.count || 0,
      slow_queries: data.metrics.slow_queries?.values?.count || 0,
      simple_query_p95: data.metrics.simple_query_duration?.values?.['p(95)'] || 0,
      simple_query_p99: data.metrics.simple_query_duration?.values?.['p(99)'] || 0,
      complex_query_p95: data.metrics.complex_query_duration?.values?.['p(95)'] || 0,
      complex_query_p99: data.metrics.complex_query_duration?.values?.['p(99)'] || 0,
      join_query_p95: data.metrics.join_query_duration?.values?.['p(95)'] || 0,
      aggregation_p95: data.metrics.aggregation_query_duration?.values?.['p(95)'] || 0,
      overall_p95: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
    },
    analysis: {
      simple_queries_fast: (data.metrics.simple_query_duration?.values?.['p(95)'] || 0) < 100,
      complex_queries_acceptable: (data.metrics.complex_query_duration?.values?.['p(95)'] || 0) < 500,
      slow_query_count_acceptable: (data.metrics.slow_queries?.values?.count || 0) < 50,
      overall_performance_good: (data.metrics.http_req_duration?.values?.['p(95)'] || 0) < 1000,
    },
    recommendations: [],
  };

  // Generate recommendations
  if (!summary.analysis.simple_queries_fast) {
    summary.recommendations.push('Simple queries are slow - check indexes on primary/foreign keys');
  }
  if (!summary.analysis.complex_queries_acceptable) {
    summary.recommendations.push('Complex queries need optimization - consider query rewriting or caching');
  }
  if (!summary.analysis.slow_query_count_acceptable) {
    summary.recommendations.push(
      'High number of slow queries detected - enable slow query logging and investigate'
    );
  }

  console.log('\n=== QUERY PERFORMANCE TEST SUMMARY ===');
  console.log(`Total Queries: ${summary.metrics.total_queries}`);
  console.log(`Slow Queries: ${summary.metrics.slow_queries}`);
  console.log(`Simple Query P95: ${summary.metrics.simple_query_p95}ms`);
  console.log(`Complex Query P95: ${summary.metrics.complex_query_p95}ms`);
  console.log(`Join Query P95: ${summary.metrics.join_query_p95}ms`);
  console.log(`Aggregation P95: ${summary.metrics.aggregation_p95}ms`);
  console.log('\n=== ANALYSIS ===');
  console.log(`Simple Queries Fast: ${summary.analysis.simple_queries_fast ? '✓' : '✗'}`);
  console.log(`Complex Queries Acceptable: ${summary.analysis.complex_queries_acceptable ? '✓' : '✗'}`);
  console.log(`Slow Query Count OK: ${summary.analysis.slow_query_count_acceptable ? '✓' : '✗'}`);
  console.log(`Overall Performance Good: ${summary.analysis.overall_performance_good ? '✓' : '✗'}`);

  if (summary.recommendations.length > 0) {
    console.log('\n=== RECOMMENDATIONS ===');
    summary.recommendations.forEach((rec, idx) => {
      console.log(`${idx + 1}. ${rec}`);
    });
  }

  return {
    stdout: JSON.stringify(summary, null, 2),
    'query-performance-test-summary.json': JSON.stringify(summary),
  };
}
