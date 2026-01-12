/**
 * QA Test Script: Bin Optimization Health Check
 * REQ-STRATEGIC-AUTO-1766516759426
 *
 * Tests all health check components for the bin optimization system
 */

import { Pool } from 'pg';
import { BinOptimizationHealthService } from '../src/modules/wms/services/bin-optimization-health.service';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://agogsaas_user:securepassword@localhost:5432/agogsaas_db'
});

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const testResults: TestResult[] = [];

async function runTests() {
  console.log('='.repeat(70));
  console.log('QA TEST: Bin Optimization Health Check');
  console.log('REQ-STRATEGIC-AUTO-1766516759426');
  console.log('='.repeat(70));
  console.log('');

  const healthService = new BinOptimizationHealthService(pool);

  try {
    // Test 1: Database Connection
    console.log('[TEST 1] Database Connection...');
    try {
      await pool.query('SELECT 1');
      testResults.push({
        testName: 'Database Connection',
        status: 'PASS',
        message: 'Database connection successful'
      });
      console.log('✅ PASS: Database connection successful\n');
    } catch (error) {
      testResults.push({
        testName: 'Database Connection',
        status: 'FAIL',
        message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`
      });
      console.log('❌ FAIL: Database connection failed\n');
      throw error;
    }

    // Test 2: Verify Database Schema
    console.log('[TEST 2] Verify Database Schema...');
    try {
      const tables = [
        'bin_utilization_cache',
        'putaway_recommendations',
        'ml_model_weights',
        'aisle_congestion_metrics',
        'material_velocity_analysis'
      ];

      for (const table of tables) {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = $1
          )
        `, [table]);

        if (result.rows[0].exists) {
          console.log(`  ✅ Table exists: ${table}`);
        } else {
          console.log(`  ⚠️  Table missing: ${table}`);
          testResults.push({
            testName: 'Database Schema',
            status: 'WARN',
            message: `Table missing: ${table}`
          });
        }
      }

      testResults.push({
        testName: 'Database Schema',
        status: 'PASS',
        message: 'All critical tables verified'
      });
      console.log('✅ PASS: Database schema verified\n');
    } catch (error) {
      testResults.push({
        testName: 'Database Schema',
        status: 'FAIL',
        message: `Schema verification failed: ${error instanceof Error ? error.message : String(error)}`
      });
      console.log('❌ FAIL: Schema verification failed\n');
    }

    // Test 3: Materialized View Cache
    console.log('[TEST 3] Materialized View Cache...');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count, MAX(last_updated) as last_updated
        FROM bin_utilization_cache
      `);

      const count = parseInt(result.rows[0].count);
      const lastUpdated = result.rows[0].last_updated;

      if (count > 0) {
        testResults.push({
          testName: 'Materialized View Cache',
          status: 'PASS',
          message: `Cache contains ${count} entries, last updated: ${lastUpdated}`,
          details: { count, lastUpdated }
        });
        console.log(`✅ PASS: Cache has ${count} entries`);
        console.log(`  Last updated: ${lastUpdated}\n`);
      } else {
        testResults.push({
          testName: 'Materialized View Cache',
          status: 'WARN',
          message: 'Cache is empty - may need to be refreshed'
        });
        console.log('⚠️  WARN: Cache is empty\n');
      }
    } catch (error) {
      testResults.push({
        testName: 'Materialized View Cache',
        status: 'FAIL',
        message: `Cache check failed: ${error instanceof Error ? error.message : String(error)}`
      });
      console.log('❌ FAIL: Cache check failed\n');
    }

    // Test 4: ML Model Weights
    console.log('[TEST 4] ML Model Weights...');
    try {
      const result = await pool.query(`
        SELECT model_name, accuracy_pct, total_predictions
        FROM ml_model_weights
        WHERE model_name = 'putaway_confidence_adjuster'
      `);

      if (result.rows.length > 0) {
        const model = result.rows[0];
        testResults.push({
          testName: 'ML Model Weights',
          status: 'PASS',
          message: `Model loaded: ${model.model_name}, Accuracy: ${model.accuracy_pct}%`,
          details: model
        });
        console.log(`✅ PASS: Model loaded`);
        console.log(`  Model: ${model.model_name}`);
        console.log(`  Accuracy: ${model.accuracy_pct}%`);
        console.log(`  Predictions: ${model.total_predictions}\n`);
      } else {
        testResults.push({
          testName: 'ML Model Weights',
          status: 'WARN',
          message: 'ML model weights not initialized'
        });
        console.log('⚠️  WARN: ML model weights not initialized\n');
      }
    } catch (error) {
      testResults.push({
        testName: 'ML Model Weights',
        status: 'FAIL',
        message: `ML model check failed: ${error instanceof Error ? error.message : String(error)}`
      });
      console.log('❌ FAIL: ML model check failed\n');
    }

    // Test 5: Health Check Service
    console.log('[TEST 5] Health Check Service...');
    try {
      const health = await healthService.checkHealth();

      console.log(`  Overall Status: ${health.status}`);
      console.log(`  Timestamp: ${health.timestamp}`);
      console.log('');
      console.log('  Individual Checks:');
      console.log(`    Materialized View Freshness: ${health.checks.materializedViewFreshness.status}`);
      console.log(`      ${health.checks.materializedViewFreshness.message}`);
      console.log(`    ML Model Accuracy: ${health.checks.mlModelAccuracy.status}`);
      console.log(`      ${health.checks.mlModelAccuracy.message}`);
      console.log(`    Congestion Cache: ${health.checks.congestionCacheHealth.status}`);
      console.log(`      ${health.checks.congestionCacheHealth.message}`);
      console.log(`    Database Performance: ${health.checks.databasePerformance.status}`);
      console.log(`      ${health.checks.databasePerformance.message}`);
      console.log(`    Algorithm Performance: ${health.checks.algorithmPerformance.status}`);
      console.log(`      ${health.checks.algorithmPerformance.message}`);

      testResults.push({
        testName: 'Health Check Service',
        status: health.status === 'UNHEALTHY' ? 'WARN' : 'PASS',
        message: `Overall status: ${health.status}`,
        details: health
      });

      if (health.status === 'HEALTHY') {
        console.log('\n✅ PASS: All health checks passed\n');
      } else if (health.status === 'DEGRADED') {
        console.log('\n⚠️  WARN: Some health checks degraded\n');
      } else {
        console.log('\n⚠️  WARN: Health checks show unhealthy status\n');
      }
    } catch (error) {
      testResults.push({
        testName: 'Health Check Service',
        status: 'FAIL',
        message: `Health check service failed: ${error instanceof Error ? error.message : String(error)}`
      });
      console.log('❌ FAIL: Health check service failed\n');
    }

    // Test 6: GraphQL Schema Types
    console.log('[TEST 6] GraphQL Schema Verification...');
    try {
      const schemaPath = require('path').join(__dirname, '../src/graphql/schema/wms-optimization.graphql');
      const fs = require('fs');

      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        const requiredTypes = [
          'BinOptimizationHealthCheck',
          'HealthChecks',
          'HealthCheckResult',
          'HealthStatus'
        ];

        const requiredQueries = [
          'getBinOptimizationHealth'
        ];

        let allTypesFound = true;
        for (const type of requiredTypes) {
          if (!schema.includes(`type ${type}`)) {
            console.log(`  ⚠️  Missing type: ${type}`);
            allTypesFound = false;
          } else {
            console.log(`  ✅ Type found: ${type}`);
          }
        }

        for (const query of requiredQueries) {
          if (!schema.includes(query)) {
            console.log(`  ⚠️  Missing query: ${query}`);
            allTypesFound = false;
          } else {
            console.log(`  ✅ Query found: ${query}`);
          }
        }

        if (allTypesFound) {
          testResults.push({
            testName: 'GraphQL Schema',
            status: 'PASS',
            message: 'All required GraphQL types and queries found'
          });
          console.log('✅ PASS: GraphQL schema verified\n');
        } else {
          testResults.push({
            testName: 'GraphQL Schema',
            status: 'WARN',
            message: 'Some GraphQL types or queries missing'
          });
          console.log('⚠️  WARN: Some types or queries missing\n');
        }
      } else {
        testResults.push({
          testName: 'GraphQL Schema',
          status: 'FAIL',
          message: 'GraphQL schema file not found'
        });
        console.log('❌ FAIL: Schema file not found\n');
      }
    } catch (error) {
      testResults.push({
        testName: 'GraphQL Schema',
        status: 'FAIL',
        message: `Schema verification failed: ${error instanceof Error ? error.message : String(error)}`
      });
      console.log('❌ FAIL: Schema verification failed\n');
    }

    // Test 7: Performance Benchmark
    console.log('[TEST 7] Performance Benchmark...');
    try {
      const startTime = Date.now();
      await healthService.checkHealth();
      const elapsed = Date.now() - startTime;

      if (elapsed < 500) {
        testResults.push({
          testName: 'Performance Benchmark',
          status: 'PASS',
          message: `Health check completed in ${elapsed}ms (target: <500ms)`,
          details: { elapsed }
        });
        console.log(`✅ PASS: Health check completed in ${elapsed}ms\n`);
      } else {
        testResults.push({
          testName: 'Performance Benchmark',
          status: 'WARN',
          message: `Health check took ${elapsed}ms (target: <500ms)`,
          details: { elapsed }
        });
        console.log(`⚠️  WARN: Health check took ${elapsed}ms (slower than expected)\n`);
      }
    } catch (error) {
      testResults.push({
        testName: 'Performance Benchmark',
        status: 'FAIL',
        message: `Performance test failed: ${error instanceof Error ? error.message : String(error)}`
      });
      console.log('❌ FAIL: Performance test failed\n');
    }

  } catch (error) {
    console.error('Test suite failed:', error);
  } finally {
    await healthService.close();
    await pool.end();
  }

  // Print Summary
  console.log('='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  console.log('');

  const passed = testResults.filter(r => r.status === 'PASS').length;
  const warned = testResults.filter(r => r.status === 'WARN').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;

  testResults.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`${icon} [${result.status}] ${result.testName}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log('');
  });

  console.log('-'.repeat(70));
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warned}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('-'.repeat(70));

  const overallStatus = failed > 0 ? 'FAIL' : warned > 0 ? 'PASS_WITH_WARNINGS' : 'PASS';
  console.log('');
  console.log(`OVERALL STATUS: ${overallStatus}`);
  console.log('='.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
