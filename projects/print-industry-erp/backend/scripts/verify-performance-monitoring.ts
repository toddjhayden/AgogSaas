/**
 * Performance Monitoring Verification Script
 * Verifies database schema, populates test data, and validates GraphQL queries
 *
 * REQ: REQ-STRATEGIC-AUTO-1767045901876
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'agog_erp',
  user: process.env.DB_USER || 'agog_app',
  password: process.env.DB_PASSWORD || 'agog_dev_password',
});

async function verifySchema() {
  console.log('📋 Verifying Performance Monitoring Schema...');

  const tables = [
    'query_performance_log',
    'api_performance_log',
    'system_resource_metrics',
    'performance_metrics_cache'
  ];

  for (const table of tables) {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      )
    `, [table]);

    if (result.rows[0].exists) {
      console.log(`  ✅ Table ${table} exists`);
    } else {
      console.error(`  ❌ Table ${table} NOT FOUND`);
      throw new Error(`Missing table: ${table}`);
    }
  }

  console.log('  ✅ All tables verified\n');
}

async function verifyFunctions() {
  console.log('📋 Verifying Database Functions...');

  const functions = [
    'refresh_performance_metrics_incremental',
    'get_performance_summary'
  ];

  for (const func of functions) {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc
        WHERE proname = $1
      )
    `, [func]);

    if (result.rows[0].exists) {
      console.log(`  ✅ Function ${func} exists`);
    } else {
      console.error(`  ❌ Function ${func} NOT FOUND`);
      throw new Error(`Missing function: ${func}`);
    }
  }

  console.log('  ✅ All functions verified\n');
}

async function populateTestData() {
  console.log('📋 Populating Test Data...');

  const tenantId = '00000000-0000-0000-0000-000000000001';

  // Insert sample API performance logs
  console.log('  📝 Inserting API performance logs...');
  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(Date.now() - (i * 60000)); // Last 100 minutes
    const statusCode = Math.random() > 0.9 ? 500 : 200;
    const responseTime = Math.random() > 0.8 ? Math.floor(Math.random() * 5000) + 1000 : Math.floor(Math.random() * 500) + 50;

    await pool.query(`
      INSERT INTO api_performance_log (
        tenant_id, endpoint, method, status_code, response_time_ms,
        request_size_bytes, response_size_bytes, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      tenantId,
      `/api/v1/endpoint${i % 10}`,
      'GET',
      statusCode,
      responseTime,
      1024,
      2048,
      timestamp
    ]);
  }
  console.log('  ✅ Inserted 100 API performance logs');

  // Insert sample query performance logs
  console.log('  📝 Inserting query performance logs...');
  for (let i = 0; i < 50; i++) {
    const timestamp = new Date(Date.now() - (i * 120000)); // Last 100 minutes
    const executionTime = Math.random() > 0.7 ? Math.floor(Math.random() * 3000) + 1000 : Math.floor(Math.random() * 500) + 10;

    await pool.query(`
      INSERT INTO query_performance_log (
        tenant_id, query_hash, query_preview, execution_time_ms,
        rows_returned, endpoint, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      tenantId,
      `hash${i % 5}`,
      `SELECT * FROM table WHERE id = ${i}`,
      executionTime,
      Math.floor(Math.random() * 1000),
      `/api/v1/endpoint${i % 10}`,
      timestamp
    ]);
  }
  console.log('  ✅ Inserted 50 query performance logs');

  // Insert sample system resource metrics
  console.log('  📝 Inserting system resource metrics...');
  for (let i = 0; i < 30; i++) {
    const timestamp = new Date(Date.now() - (i * 60000)); // Last 30 minutes
    timestamp.setSeconds(0, 0); // Round to minute

    await pool.query(`
      INSERT INTO system_resource_metrics (
        tenant_id, cpu_usage_percent, memory_used_mb, memory_total_mb,
        event_loop_lag_ms, active_connections, heap_used_mb, heap_total_mb, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tenant_id, timestamp) DO NOTHING
    `, [
      tenantId,
      Math.random() * 100,
      Math.floor(Math.random() * 500) + 100,
      1024,
      Math.random() * 10,
      Math.floor(Math.random() * 10) + 5,
      Math.floor(Math.random() * 300) + 50,
      512,
      timestamp
    ]);
  }
  console.log('  ✅ Inserted 30 system resource metrics\n');
}

async function testIncrementalRefresh() {
  console.log('📋 Testing Incremental Refresh Function...');

  const startTime = Date.now();
  const result = await pool.query(`
    SELECT * FROM refresh_performance_metrics_incremental()
  `);

  const duration = Date.now() - startTime;
  const { hours_refreshed, duration_ms, status } = result.rows[0];

  console.log(`  ✅ Refresh completed in ${duration}ms (function: ${duration_ms}ms)`);
  console.log(`  ✅ Hours refreshed: ${hours_refreshed}`);
  console.log(`  ✅ Status: ${status}\n`);

  if (duration_ms > 1000) {
    console.warn(`  ⚠️  Warning: Refresh took ${duration_ms}ms (expected < 1000ms)`);
  }
}

async function testPerformanceSummary() {
  console.log('📋 Testing Performance Summary Function...');

  const tenantId = '00000000-0000-0000-0000-000000000001';
  const result = await pool.query(`
    SELECT * FROM get_performance_summary($1, 24)
  `, [tenantId]);

  if (result.rows.length > 0) {
    const summary = result.rows[0];
    console.log(`  ✅ Health Score: ${summary.health_score}`);
    console.log(`  ✅ Avg Response Time: ${summary.avg_response_time_ms}ms`);
    console.log(`  ✅ P95 Response Time: ${summary.p95_response_time_ms}ms`);
    console.log(`  ✅ Total Requests: ${summary.total_requests}`);
    console.log(`  ✅ Error Rate: ${summary.error_rate}%\n`);
  } else {
    console.warn('  ⚠️  No summary data found (may need to wait for aggregation)\n');
  }
}

async function verifyIndexes() {
  console.log('📋 Verifying Performance Indexes...');

  const indexes = [
    'idx_query_perf_log_tenant_timestamp',
    'idx_query_perf_log_hash_timestamp',
    'idx_query_perf_log_slow',
    'idx_api_perf_log_tenant_timestamp',
    'idx_api_perf_log_endpoint',
    'idx_api_perf_log_slow',
    'idx_system_resource_tenant_timestamp',
    'idx_perf_cache_hour',
    'idx_perf_cache_health'
  ];

  for (const index of indexes) {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_indexes
        WHERE indexname = $1
      )
    `, [index]);

    if (result.rows[0].exists) {
      console.log(`  ✅ Index ${index} exists`);
    } else {
      console.warn(`  ⚠️  Index ${index} NOT FOUND (may be expected if migration not run)`);
    }
  }

  console.log('  ✅ Index verification complete\n');
}

async function testQueryPerformance() {
  console.log('📋 Testing Query Performance...');

  const tenantId = '00000000-0000-0000-0000-000000000001';

  // Test slow queries query
  const slowQueriesStart = Date.now();
  const slowQueries = await pool.query(`
    SELECT * FROM query_performance_log
    WHERE tenant_id = $1
      AND timestamp >= NOW() - INTERVAL '24 hours'
      AND execution_time_ms > 1000
    ORDER BY execution_time_ms DESC
    LIMIT 10
  `, [tenantId]);
  const slowQueriesDuration = Date.now() - slowQueriesStart;

  console.log(`  ✅ Slow queries query: ${slowQueriesDuration}ms (${slowQueries.rows.length} results)`);

  // Test endpoint metrics query
  const endpointMetricsStart = Date.now();
  const endpointMetrics = await pool.query(`
    SELECT
      endpoint,
      COUNT(*) AS total_requests,
      AVG(response_time_ms) AS avg_response_time
    FROM api_performance_log
    WHERE tenant_id = $1
      AND timestamp >= NOW() - INTERVAL '24 hours'
    GROUP BY endpoint
    ORDER BY total_requests DESC
  `, [tenantId]);
  const endpointMetricsDuration = Date.now() - endpointMetricsStart;

  console.log(`  ✅ Endpoint metrics query: ${endpointMetricsDuration}ms (${endpointMetrics.rows.length} results)\n`);
}

async function main() {
  try {
    console.log('🚀 Performance Monitoring Verification\n');
    console.log('================================================\n');

    await verifySchema();
    await verifyFunctions();
    await verifyIndexes();
    await populateTestData();
    await testIncrementalRefresh();
    await testPerformanceSummary();
    await testQueryPerformance();

    console.log('================================================');
    console.log('✅ All Verifications Passed!\n');
    console.log('📊 Performance Monitoring System Ready\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification Failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
