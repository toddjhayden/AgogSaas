/**
 * K6 Test Helpers
 * Common utilities and helper functions for k6 tests
 *
 * REQ: REQ-P0-1768148786448-3r439 - Database stress testing
 */

import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import http from 'k6/http';

// Custom metrics for database operations
export const dbQueryDuration = new Trend('db_query_duration', true);
export const dbConnectionTime = new Trend('db_connection_time', true);
export const dbWriteDuration = new Trend('db_write_duration', true);
export const dbQueryErrors = new Rate('db_query_errors');
export const dbConnectionErrors = new Rate('db_connection_errors');
export const dbQueriesTotal = new Counter('db_queries_total');
export const dbWritesTotal = new Counter('db_writes_total');

/**
 * Generate GraphQL request payload
 */
export function graphqlRequest(query, variables = {}, operationName = null) {
  return JSON.stringify({
    query,
    variables,
    operationName,
  });
}

/**
 * Execute GraphQL query with metrics tracking
 */
export function executeGraphQL(endpoint, query, variables = {}, headers = {}, tags = {}) {
  const payload = graphqlRequest(query, variables);

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'x-tenant-id': headers['x-tenant-id'] || 'tenant-001',
    'x-user-id': headers['x-user-id'] || 'user-001',
  };

  const mergedHeaders = { ...defaultHeaders, ...headers };

  const startTime = new Date();
  const response = http.post(endpoint, payload, {
    headers: mergedHeaders,
    tags: { name: tags.name || 'graphql_query', ...tags },
  });
  const duration = new Date() - startTime;

  // Track query metrics
  dbQueriesTotal.add(1);
  dbQueryDuration.add(duration);

  // Check for GraphQL errors
  const hasErrors = check(response, {
    'status is 200': (r) => r.status === 200,
    'no graphql errors': (r) => {
      if (!r.body) return false;
      try {
        const body = JSON.parse(r.body);
        return !body.errors || body.errors.length === 0;
      } catch (e) {
        return false;
      }
    },
  });

  if (!hasErrors) {
    dbQueryErrors.add(1);
  }

  return response;
}

/**
 * Execute GraphQL mutation with write metrics tracking
 */
export function executeMutation(endpoint, mutation, variables = {}, headers = {}, tags = {}) {
  const payload = graphqlRequest(mutation, variables);

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'x-tenant-id': headers['x-tenant-id'] || 'tenant-001',
    'x-user-id': headers['x-user-id'] || 'user-001',
  };

  const mergedHeaders = { ...defaultHeaders, ...headers };

  const startTime = new Date();
  const response = http.post(endpoint, payload, {
    headers: mergedHeaders,
    tags: { name: tags.name || 'graphql_mutation', type: 'write', ...tags },
  });
  const duration = new Date() - startTime;

  // Track write metrics
  dbWritesTotal.add(1);
  dbWriteDuration.add(duration);

  // Check for GraphQL errors
  const hasErrors = check(response, {
    'mutation status is 200': (r) => r.status === 200,
    'no mutation errors': (r) => {
      if (!r.body) return false;
      try {
        const body = JSON.parse(r.body);
        return !body.errors || body.errors.length === 0;
      } catch (e) {
        return false;
      }
    },
  });

  if (!hasErrors) {
    dbQueryErrors.add(1);
  }

  return response;
}

/**
 * Generate random tenant ID for multi-tenancy testing
 */
export function randomTenantId() {
  return `tenant-${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`;
}

/**
 * Generate random facility ID
 */
export function randomFacilityId() {
  return `facility-${Math.floor(Math.random() * 20).toString().padStart(2, '0')}`;
}

/**
 * Generate random user ID
 */
export function randomUserId() {
  return `user-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
}

/**
 * Random sleep between requests (adds jitter)
 */
export function randomSleep(minMs = 100, maxMs = 1000) {
  const sleepTime = (Math.random() * (maxMs - minMs) + minMs) / 1000;
  sleep(sleepTime);
}

/**
 * Parse GraphQL response and extract data
 */
export function parseGraphQLResponse(response) {
  if (!response || !response.body) {
    return { data: null, errors: ['Empty response'] };
  }

  try {
    const body = JSON.parse(response.body);
    return {
      data: body.data || null,
      errors: body.errors || null,
    };
  } catch (e) {
    return { data: null, errors: ['Failed to parse response: ' + e.message] };
  }
}

/**
 * Health check helper
 */
export function healthCheck(baseUrl) {
  const response = http.get(`${baseUrl}/health`);
  return check(response, {
    'health check passed': (r) => r.status === 200,
  });
}

/**
 * Generate test data helpers
 */
export const testData = {
  // Generate random production order number
  productionOrderNumber() {
    return `PO-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  },

  // Generate random invoice number
  invoiceNumber() {
    return `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  },

  // Generate random journal entry number
  journalEntryNumber() {
    return `JE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  },

  // Generate random work center code
  workCenterCode() {
    return `WC-${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`;
  },

  // Generate random date within last 30 days
  recentDate() {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    return date.toISOString().split('T')[0];
  },

  // Generate current date
  currentDate() {
    return new Date().toISOString().split('T')[0];
  },

  // Generate future date (within 90 days)
  futureDate() {
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(Math.random() * 90));
    return date.toISOString().split('T')[0];
  },
};
