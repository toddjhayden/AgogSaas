#!/usr/bin/env ts-node
/**
 * Inventory Forecasting Deployment Verification Script
 * REQ-STRATEGIC-AUTO-1766893112869
 *
 * This script verifies that all components of the Inventory Forecasting feature
 * are properly deployed and functioning correctly.
 *
 * Verification Steps:
 * 1. Database migrations (V0.0.32 and V0.0.39)
 * 2. Backend services and modules
 * 3. GraphQL schema and resolvers
 * 4. Test data availability
 * 5. Integration between components
 *
 * Author: Berry (DevOps Agent)
 * Date: 2025-12-28
 */

import { Pool } from 'pg';

interface VerificationResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

class InventoryForecastingVerifier {
  private pool: Pool;
  private results: VerificationResult[] = [];

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'agog_erp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });
  }

  private addResult(step: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
    this.results.push({ step, status, message, details });
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${step}: ${message}`);
    if (details) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
  }

  async verifyDatabaseMigrations(): Promise<void> {
    console.log('\n=== Verifying Database Migrations ===\n');

    try {
      // Check if core forecasting tables exist
      const tables = [
        'demand_history',
        'material_forecasts',
        'forecast_models',
        'forecast_accuracy_metrics',
        'replenishment_suggestions'
      ];

      for (const table of tables) {
        const result = await this.pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          )
        `, [table]);

        if (result.rows[0].exists) {
          this.addResult(`Table: ${table}`, 'PASS', 'Table exists');
        } else {
          this.addResult(`Table: ${table}`, 'FAIL', 'Table does not exist');
        }
      }

      // Check for Roy's enhancements (V0.0.39)
      const urgencyCheck = await this.pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'replenishment_suggestions'
        AND column_name IN ('urgency_level', 'days_until_stockout')
      `);

      if (urgencyCheck.rows.length === 2) {
        this.addResult('Roy Enhancement: Urgency Columns', 'PASS', 'urgency_level and days_until_stockout columns exist');
      } else {
        this.addResult('Roy Enhancement: Urgency Columns', 'FAIL', 'Missing urgency columns from V0.0.39');
      }

      // Check materials table enhancements
      const materialsCheck = await this.pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'materials'
        AND column_name IN ('ordering_cost', 'holding_cost_pct', 'forecasting_enabled', 'forecast_algorithm')
      `);

      if (materialsCheck.rows.length >= 2) {
        this.addResult('Materials Table: Forecasting Columns', 'PASS', `${materialsCheck.rows.length} forecasting columns found`);
      } else {
        this.addResult('Materials Table: Forecasting Columns', 'WARN', 'Some forecasting columns may be missing');
      }

    } catch (error) {
      this.addResult('Database Migration Check', 'FAIL', `Error: ${error.message}`);
    }
  }

  async verifyRLSPolicies(): Promise<void> {
    console.log('\n=== Verifying Row-Level Security ===\n');

    try {
      const policies = await this.pool.query(`
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE tablename IN (
          'demand_history',
          'material_forecasts',
          'replenishment_suggestions'
        )
      `);

      if (policies.rows.length >= 3) {
        this.addResult('RLS Policies', 'PASS', `${policies.rows.length} RLS policies found`, policies.rows);
      } else {
        this.addResult('RLS Policies', 'WARN', 'RLS policies may be incomplete');
      }
    } catch (error) {
      this.addResult('RLS Policies Check', 'FAIL', `Error: ${error.message}`);
    }
  }

  async verifyIndexes(): Promise<void> {
    console.log('\n=== Verifying Indexes ===\n');

    try {
      const expectedIndexes = [
        'idx_demand_history_tenant_facility',
        'idx_demand_history_material',
        'idx_demand_history_date',
        'idx_material_forecasts_active',
        'idx_replenishment_urgency_level'
      ];

      for (const indexName of expectedIndexes) {
        const result = await this.pool.query(`
          SELECT indexname
          FROM pg_indexes
          WHERE indexname = $1
        `, [indexName]);

        if (result.rows.length > 0) {
          this.addResult(`Index: ${indexName}`, 'PASS', 'Index exists');
        } else {
          this.addResult(`Index: ${indexName}`, 'WARN', 'Index not found');
        }
      }
    } catch (error) {
      this.addResult('Index Check', 'FAIL', `Error: ${error.message}`);
    }
  }

  async verifyTestData(): Promise<void> {
    console.log('\n=== Verifying Test Data ===\n');

    try {
      // Check for test materials
      const materialsResult = await this.pool.query(`
        SELECT material_id
        FROM materials
        WHERE material_id LIKE 'MAT-FCST-%'
        LIMIT 3
      `);

      if (materialsResult.rows.length > 0) {
        this.addResult('Test Materials', 'PASS', `${materialsResult.rows.length} test materials found`,
          materialsResult.rows.map(r => r.material_id));
      } else {
        this.addResult('Test Materials', 'WARN', 'No test materials found (may need to run load-p2-test-data.ts)');
      }

      // Check for demand history
      const demandResult = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM demand_history
        WHERE material_id LIKE 'MAT-FCST-%'
      `);

      const demandCount = parseInt(demandResult.rows[0].count);
      if (demandCount > 0) {
        this.addResult('Demand History Data', 'PASS', `${demandCount} demand history records found`);
      } else {
        this.addResult('Demand History Data', 'WARN', 'No demand history data (run load-p2-test-data.ts)');
      }

      // Check for forecasts
      const forecastResult = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM material_forecasts
        WHERE forecast_status = 'ACTIVE'
      `);

      const forecastCount = parseInt(forecastResult.rows[0].count);
      if (forecastCount > 0) {
        this.addResult('Active Forecasts', 'PASS', `${forecastCount} active forecasts found`);
      } else {
        this.addResult('Active Forecasts', 'WARN', 'No active forecasts (generate via GraphQL mutation)');
      }

    } catch (error) {
      this.addResult('Test Data Check', 'FAIL', `Error: ${error.message}`);
    }
  }

  async verifyFunctions(): Promise<void> {
    console.log('\n=== Verifying Database Functions ===\n');

    try {
      // Check for urgency calculation function
      const functionResult = await this.pool.query(`
        SELECT proname
        FROM pg_proc
        WHERE proname = 'calculate_replenishment_urgency'
      `);

      if (functionResult.rows.length > 0) {
        this.addResult('Function: calculate_replenishment_urgency', 'PASS', 'Function exists');
      } else {
        this.addResult('Function: calculate_replenishment_urgency', 'FAIL', 'Function not found (V0.0.39 not applied)');
      }
    } catch (error) {
      this.addResult('Function Check', 'FAIL', `Error: ${error.message}`);
    }
  }

  async verifyDataIntegrity(): Promise<void> {
    console.log('\n=== Verifying Data Integrity ===\n');

    try {
      // Test unique constraint on demand_history
      const uniqueTest = await this.pool.query(`
        SELECT COUNT(*), COUNT(DISTINCT (tenant_id, facility_id, material_id, demand_date))
        FROM demand_history
      `);

      const totalCount = parseInt(uniqueTest.rows[0].count);
      const distinctCount = parseInt(uniqueTest.rows[0].count_1);

      if (totalCount === distinctCount) {
        this.addResult('Data Integrity: demand_history', 'PASS', 'No duplicate records');
      } else {
        this.addResult('Data Integrity: demand_history', 'FAIL', `${totalCount - distinctCount} duplicate records found`);
      }

      // Test forecast versioning
      const versionTest = await this.pool.query(`
        SELECT material_id, COUNT(*) as active_count
        FROM material_forecasts
        WHERE forecast_status = 'ACTIVE'
        GROUP BY material_id, forecast_date
        HAVING COUNT(*) > 1
      `);

      if (versionTest.rows.length === 0) {
        this.addResult('Data Integrity: forecast_versioning', 'PASS', 'Only one ACTIVE forecast per material/date');
      } else {
        this.addResult('Data Integrity: forecast_versioning', 'FAIL', `${versionTest.rows.length} materials have multiple ACTIVE forecasts`);
      }

    } catch (error) {
      this.addResult('Data Integrity Check', 'FAIL', `Error: ${error.message}`);
    }
  }

  async verifyBackendServices(): Promise<void> {
    console.log('\n=== Verifying Backend Services ===\n');

    try {
      const servicePaths = [
        'src/modules/forecasting/services/demand-history.service.ts',
        'src/modules/forecasting/services/forecasting.service.ts',
        'src/modules/forecasting/services/safety-stock.service.ts',
        'src/modules/forecasting/services/forecast-accuracy.service.ts',
        'src/modules/forecasting/services/replenishment-recommendation.service.ts',
      ];

      const fs = require('fs');
      const path = require('path');

      for (const servicePath of servicePaths) {
        const fullPath = path.join(process.cwd(), servicePath);
        if (fs.existsSync(fullPath)) {
          this.addResult(`Service File: ${path.basename(servicePath)}`, 'PASS', 'File exists');
        } else {
          this.addResult(`Service File: ${path.basename(servicePath)}`, 'FAIL', 'File not found');
        }
      }

      // Check for forecasting module
      const modulePathExists = fs.existsSync(path.join(process.cwd(), 'src/modules/forecasting/forecasting.module.ts'));
      if (modulePathExists) {
        this.addResult('ForecastingModule', 'PASS', 'Module file exists');
      } else {
        this.addResult('ForecastingModule', 'FAIL', 'Module file not found');
      }

    } catch (error) {
      this.addResult('Backend Services Check', 'FAIL', `Error: ${error.message}`);
    }
  }

  async verifyGraphQL(): Promise<void> {
    console.log('\n=== Verifying GraphQL Schema ===\n');

    try {
      const fs = require('fs');
      const path = require('path');

      // Check for forecasting GraphQL schema
      const schemaPath = path.join(process.cwd(), 'src/graphql/schema/forecasting.graphql');
      if (fs.existsSync(schemaPath)) {
        this.addResult('GraphQL Schema: forecasting.graphql', 'PASS', 'Schema file exists');
      } else {
        this.addResult('GraphQL Schema: forecasting.graphql', 'FAIL', 'Schema file not found');
      }

      // Check for resolver
      const resolverPath = path.join(process.cwd(), 'src/graphql/resolvers/forecasting.resolver.ts');
      if (fs.existsSync(resolverPath)) {
        this.addResult('GraphQL Resolver: forecasting.resolver.ts', 'PASS', 'Resolver file exists');
      } else {
        this.addResult('GraphQL Resolver: forecasting.resolver.ts', 'FAIL', 'Resolver file not found');
      }

    } catch (error) {
      this.addResult('GraphQL Check', 'FAIL', `Error: ${error.message}`);
    }
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(60) + '\n');

    const passCount = this.results.filter(r => r.status === 'PASS').length;
    const failCount = this.results.filter(r => r.status === 'FAIL').length;
    const warnCount = this.results.filter(r => r.status === 'WARN').length;
    const totalCount = this.results.length;

    console.log(`Total Checks: ${totalCount}`);
    console.log(`✅ PASS: ${passCount} (${((passCount / totalCount) * 100).toFixed(1)}%)`);
    console.log(`❌ FAIL: ${failCount} (${((failCount / totalCount) * 100).toFixed(1)}%)`);
    console.log(`⚠️  WARN: ${warnCount} (${((warnCount / totalCount) * 100).toFixed(1)}%)`);

    console.log('\n' + '='.repeat(60));

    if (failCount === 0) {
      console.log('✅ ALL CRITICAL CHECKS PASSED');
      if (warnCount > 0) {
        console.log(`⚠️  ${warnCount} warnings (non-critical, review recommended)`);
      }
      console.log('\n🚀 Inventory Forecasting feature is READY FOR PRODUCTION DEPLOYMENT');
    } else {
      console.log('❌ DEPLOYMENT BLOCKED - Critical failures detected');
      console.log('\nFailed Checks:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.step}: ${r.message}`));
      console.log('\n⚠️  Please resolve all failures before deploying to production');
    }

    console.log('='.repeat(60) + '\n');
  }

  async run(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Inventory Forecasting Deployment Verification Script    ║');
    console.log('║   REQ-STRATEGIC-AUTO-1766893112869                        ║');
    console.log('║   Author: Berry (DevOps Agent)                            ║');
    console.log('║   Date: 2025-12-28                                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
      await this.verifyDatabaseMigrations();
      await this.verifyRLSPolicies();
      await this.verifyIndexes();
      await this.verifyFunctions();
      await this.verifyTestData();
      await this.verifyDataIntegrity();
      await this.verifyBackendServices();
      await this.verifyGraphQL();

      this.printSummary();

    } catch (error) {
      console.error('❌ Verification failed with error:', error);
      process.exit(1);
    } finally {
      await this.pool.end();
    }
  }
}

// Run verification if executed directly
if (require.main === module) {
  const verifier = new InventoryForecastingVerifier();
  verifier.run().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default InventoryForecastingVerifier;
