/**
 * K6 Test Configuration
 * Base configuration for k6 load tests
 *
 * REQ: REQ-P0-1768148786448-3r439 - Database stress testing
 */

export const config = {
  // Backend API Configuration
  BASE_URL: __ENV.BASE_URL || 'http://localhost:4000',
  GRAPHQL_ENDPOINT: '/graphql',

  // Database Configuration (for direct DB tests)
  DB_HOST: __ENV.DB_HOST || 'localhost',
  DB_PORT: __ENV.DB_PORT || '5433',
  DB_NAME: __ENV.DB_NAME || 'agogsaas',
  DB_USER: __ENV.DB_USER || 'agogsaas_user',
  DB_PASSWORD: __ENV.DB_PASSWORD || 'vhSczdyNPGiSF8arQKVUf5PXXIxtpgW+',

  // Test Authentication
  MOCK_USER_ID: __ENV.MOCK_USER_ID || 'user-001',
  MOCK_TENANT_ID: __ENV.MOCK_TENANT_ID || 'tenant-001',
  JWT_TOKEN: __ENV.JWT_TOKEN || '',

  // Test Configuration
  ITERATIONS: parseInt(__ENV.ITERATIONS || '100'),
  DURATION: __ENV.DURATION || '30s',

  // Performance Thresholds
  THRESHOLDS: {
    http_req_failed: ['rate<0.01'], // http errors should be less than 1%
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // 95% of requests should be below 2s, 99% below 5s
    http_reqs: ['rate>50'], // should handle at least 50 requests per second

    // Database-specific thresholds
    db_query_duration: ['p(95)<500', 'p(99)<1000'], // Database queries should be fast
    db_connection_time: ['p(95)<100', 'p(99)<200'], // Connection should be quick
    db_write_duration: ['p(95)<1000', 'p(99)<2000'], // Writes can be slower
  },
};

export default config;
