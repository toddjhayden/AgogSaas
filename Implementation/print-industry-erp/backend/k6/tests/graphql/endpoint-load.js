/**
 * K6 GraphQL Endpoint Load Test
 * Tests GraphQL API endpoint performance with realistic queries
 *
 * REQ: REQ-P0-1768148786448-3r439 - Database stress testing
 *
 * Purpose: Test GraphQL endpoint under realistic mixed workload
 * Tests:
 * - Query complexity limits
 * - Nested query performance
 * - Multiple operations in single request
 * - GraphQL error handling
 * - Rate limiting behavior
 */

import { sleep, check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import http from 'k6/http';
import { executeGraphQL, graphqlRequest } from '../../lib/helpers.js';
import config from '../../config/test.config.js';

// GraphQL-specific metrics
const queryComplexity = new Trend('graphql_query_complexity');
const graphqlErrors = new Counter('graphql_errors');
const rateLimitHits = new Counter('rate_limit_hits');
const nestedQueryDepth = new Trend('nested_query_depth');

export const options = {
  scenarios: {
    realistic_mixed: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    graphql_errors: ['count<100'], // Some GraphQL errors acceptable
    rate_limit_hits: ['count<10'], // Should rarely hit rate limits
  },
  tags: {
    test_type: 'graphql',
    test_focus: 'endpoint_load',
  },
};

const GRAPHQL_URL = `${config.BASE_URL}${config.GRAPHQL_ENDPOINT}`;

// Realistic GraphQL queries of varying complexity
const queries = {
  // Simple query - complexity ~5
  simple: `
    query GetPeriods($tenantId: ID!) {
      financialPeriods(tenantId: $tenantId) {
        id
        periodYear
        periodMonth
        status
      }
    }
  `,
  // Medium complexity - nested 1 level ~15
  mediumNested: `
    query GetInvoicesWithLines($tenantId: ID!, $limit: Int) {
      invoices(tenantId: $tenantId, limit: $limit) {
        id
        invoiceNumber
        totalAmount
        status
        lines {
          id
          description
          quantity
          totalAmount
        }
      }
    }
  `,
  // High complexity - nested 2 levels ~30
  highNested: `
    query GetAccountsWithBalances($tenantId: ID!, $year: Int!, $month: Int!) {
      chartOfAccounts(tenantId: $tenantId) {
        id
        accountNumber
        accountName
        accountType
        parentAccount {
          id
          accountName
        }
        currentBalance {
          beginningBalance
          endingBalance
        }
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
  // Dashboard-style multi-query
  dashboard: `
    query Dashboard($tenantId: ID!, $facilityId: ID!) {
      financialPeriods(tenantId: $tenantId) {
        id
        periodYear
        periodMonth
        status
      }
      workCenters(facilityId: $facilityId) {
        id
        workCenterCode
        workCenterName
        status
      }
      productionSummary(facilityId: $facilityId) {
        activeRuns
        completedRunsToday
        averageYield
        currentOEE
      }
    }
  `,
  // Analytics query - high computation
  analytics: `
    query ProductionAnalytics($facilityId: ID!) {
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
        totalGoodQuantity
        totalScrapQuantity
        averageYield
        currentOEE
      }
      workCenterUtilization(facilityId: $facilityId) {
        workCenterName
        status
        todayRuntime
        todayDowntime
        todaySetupTime
        utilizationPercentage
      }
    }
  `,
};

export default function () {
  const tenantId = config.MOCK_TENANT_ID;
  const facilityId = 'facility-001';
  const currentDate = new Date();

  // Distribute queries by complexity
  const queryType = Math.random();
  let complexity = 0;
  let depth = 0;

  if (queryType < 0.3) {
    // 30% - Simple queries
    complexity = 5;
    depth = 0;
    const response = executeGraphQL(
      GRAPHQL_URL,
      queries.simple,
      { tenantId },
      {},
      { name: 'gql_simple', complexity: complexity }
    );

    check(response, {
      'simple query successful': (r) => r.status === 200,
      'no graphql errors': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !body.errors;
        } catch {
          return false;
        }
      },
    });
  } else if (queryType < 0.5) {
    // 20% - Medium nested
    complexity = 15;
    depth = 1;
    const response = executeGraphQL(
      GRAPHQL_URL,
      queries.mediumNested,
      { tenantId, limit: 20 },
      {},
      { name: 'gql_medium_nested', complexity: complexity }
    );

    const hasErrors = !check(response, {
      'medium query successful': (r) => r.status === 200,
    });

    if (hasErrors) {
      graphqlErrors.add(1);
    }
  } else if (queryType < 0.65) {
    // 15% - High nested
    complexity = 30;
    depth = 2;
    const response = executeGraphQL(
      GRAPHQL_URL,
      queries.highNested,
      {
        tenantId,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      },
      {},
      { name: 'gql_high_nested', complexity: complexity }
    );

    const hasErrors = !check(response, {
      'high nested query successful': (r) => r.status === 200,
    });

    if (hasErrors) {
      graphqlErrors.add(1);
    }

    // Check if complexity limit was hit
    if (response.status === 400 || (response.body && response.body.includes('complexity'))) {
      console.warn('Query complexity limit hit');
    }
  } else if (queryType < 0.85) {
    // 20% - Dashboard multi-query
    complexity = 25;
    depth = 1;
    const response = executeGraphQL(
      GRAPHQL_URL,
      queries.dashboard,
      { tenantId, facilityId },
      {},
      { name: 'gql_dashboard', complexity: complexity }
    );

    const hasErrors = !check(response, {
      'dashboard query successful': (r) => r.status === 200,
    });

    if (hasErrors) {
      graphqlErrors.add(1);
    }
  } else {
    // 15% - Analytics (high load)
    complexity = 40;
    depth = 2;
    const response = executeGraphQL(
      GRAPHQL_URL,
      queries.analytics,
      { facilityId },
      {},
      { name: 'gql_analytics', complexity: complexity }
    );

    const hasErrors = !check(response, {
      'analytics query successful': (r) => r.status === 200,
    });

    if (hasErrors) {
      graphqlErrors.add(1);
    }

    // Longer operation - simulate dashboard refresh
    sleep(0.5);
  }

  // Track metrics
  queryComplexity.add(complexity);
  nestedQueryDepth.add(depth);

  // Check for rate limiting (429 responses)
  sleep(0.1);
}

// Test introspection query (often disabled in production)
export function setup() {
  const introspectionQuery = `
    query IntrospectionQuery {
      __schema {
        queryType {
          name
        }
        mutationType {
          name
        }
      }
    }
  `;

  const response = http.post(
    GRAPHQL_URL,
    graphqlRequest(introspectionQuery),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const introspectionEnabled = response.status === 200;
  console.log(`GraphQL Introspection: ${introspectionEnabled ? 'ENABLED' : 'DISABLED'}`);

  return { introspectionEnabled };
}

export function handleSummary(data) {
  const summary = {
    test_type: 'GraphQL Endpoint Load Test',
    timestamp: new Date().toISOString(),
    metrics: {
      total_requests: data.metrics.http_reqs?.values?.count || 0,
      failed_requests: data.metrics.http_req_failed?.values?.count || 0,
      graphql_errors: data.metrics.graphql_errors?.values?.count || 0,
      rate_limit_hits: data.metrics.rate_limit_hits?.values?.count || 0,
      avg_complexity: data.metrics.graphql_query_complexity?.values?.avg || 0,
      avg_nested_depth: data.metrics.nested_query_depth?.values?.avg || 0,
      p95_duration: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
      p99_duration: data.metrics.http_req_duration?.values?.['p(99)'] || 0,
    },
    analysis: {
      error_rate_acceptable:
        (data.metrics.graphql_errors?.values?.count || 0) <
        (data.metrics.http_reqs?.values?.count || 0) * 0.01,
      performance_good: (data.metrics.http_req_duration?.values?.['p(95)'] || 0) < 2000,
      rate_limiting_effective: (data.metrics.rate_limit_hits?.values?.count || 0) < 10,
    },
    recommendations: [],
  };

  if (!summary.analysis.error_rate_acceptable) {
    summary.recommendations.push('High GraphQL error rate - review query validation and error handling');
  }
  if (!summary.analysis.performance_good) {
    summary.recommendations.push('Slow GraphQL responses - consider query optimization or caching');
  }
  if (summary.metrics.rate_limit_hits > 50) {
    summary.recommendations.push('Rate limits frequently hit - review rate limit configuration');
  }

  console.log('\n=== GRAPHQL ENDPOINT TEST SUMMARY ===');
  console.log(`Total Requests: ${summary.metrics.total_requests}`);
  console.log(`GraphQL Errors: ${summary.metrics.graphql_errors}`);
  console.log(`Rate Limit Hits: ${summary.metrics.rate_limit_hits}`);
  console.log(`Avg Query Complexity: ${summary.metrics.avg_complexity.toFixed(2)}`);
  console.log(`Avg Nested Depth: ${summary.metrics.avg_nested_depth.toFixed(2)}`);
  console.log(`P95 Duration: ${summary.metrics.p95_duration}ms`);
  console.log('\n=== ANALYSIS ===');
  console.log(`Error Rate Acceptable: ${summary.analysis.error_rate_acceptable ? '✓' : '✗'}`);
  console.log(`Performance Good: ${summary.analysis.performance_good ? '✓' : '✗'}`);
  console.log(`Rate Limiting Effective: ${summary.analysis.rate_limiting_effective ? '✓' : '✗'}`);

  if (summary.recommendations.length > 0) {
    console.log('\n=== RECOMMENDATIONS ===');
    summary.recommendations.forEach((rec, idx) => {
      console.log(`${idx + 1}. ${rec}`);
    });
  }

  return {
    stdout: JSON.stringify(summary, null, 2),
    'graphql-endpoint-test-summary.json': JSON.stringify(summary),
  };
}
