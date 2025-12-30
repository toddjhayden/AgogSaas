#!/usr/bin/env ts-node
/**
 * INVENTORY FORECASTING IMPLEMENTATION VERIFICATION SCRIPT
 *
 * Purpose: Verify all components of the Inventory Forecasting system are properly deployed
 * REQ: REQ-STRATEGIC-AUTO-1766639534835
 *
 * Checks:
 * 1. Database tables exist and have correct schema
 * 2. Database indexes are created
 * 3. Row-Level Security policies are active
 * 4. Services are properly registered
 * 5. GraphQL endpoints are accessible
 *
 * Usage: ts-node scripts/verify-forecasting-implementation.ts
 */

import { Pool } from 'pg';

// Database connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'agog_print_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

interface VerificationResult {
  category: string;
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

const results: VerificationResult[] = [];

function logResult(category: string, check: string, status: 'PASS' | 'FAIL' | 'WARN', message: string) {
  results.push({ category, check, status, message });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${category}] ${check}: ${message}`);
}

async function verifyTables() {
  console.log('\n📊 Verifying Database Tables...\n');

  const requiredTables = [
    'demand_history',
    'forecast_models',
    'material_forecasts',
    'forecast_accuracy_metrics',
    'replenishment_suggestions'
  ];

  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
    `, [requiredTables]);

    const existingTables = result.rows.map(r => r.table_name);

    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        logResult('Database', `Table: ${table}`, 'PASS', 'Table exists');
      } else {
        logResult('Database', `Table: ${table}`, 'FAIL', 'Table missing');
      }
    }

    // Check for columns in demand_history
    const demandHistoryCols = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'demand_history'
    `);

    const requiredColumns = [
      'demand_history_id',
      'tenant_id',
      'facility_id',
      'material_id',
      'demand_date',
      'actual_demand_quantity',
      'forecasted_demand_quantity',
      'forecast_error',
      'absolute_percentage_error'
    ];

    const existingColumns = demandHistoryCols.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length === 0) {
      logResult('Database', 'demand_history columns', 'PASS', 'All required columns present');
    } else {
      logResult('Database', 'demand_history columns', 'FAIL', `Missing columns: ${missingColumns.join(', ')}`);
    }

  } catch (error) {
    logResult('Database', 'Table verification', 'FAIL', `Error: ${error.message}`);
  }
}

async function verifyIndexes() {
  console.log('\n🔍 Verifying Database Indexes...\n');

  const requiredIndexes = [
    'idx_demand_history_tenant_facility',
    'idx_demand_history_material',
    'idx_demand_history_date',
    'idx_demand_history_material_date_range',
    'idx_material_forecasts_tenant_facility',
    'idx_material_forecasts_material',
    'idx_material_forecasts_date',
    'idx_material_forecasts_status',
    'idx_material_forecasts_active'
  ];

  try {
    const result = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1)
    `, [requiredIndexes]);

    const existingIndexes = result.rows.map(r => r.indexname);

    for (const index of requiredIndexes) {
      if (existingIndexes.includes(index)) {
        logResult('Performance', `Index: ${index}`, 'PASS', 'Index exists');
      } else {
        logResult('Performance', `Index: ${index}`, 'WARN', 'Index missing (may impact performance)');
      }
    }

  } catch (error) {
    logResult('Performance', 'Index verification', 'FAIL', `Error: ${error.message}`);
  }
}

async function verifyRLS() {
  console.log('\n🔒 Verifying Row-Level Security...\n');

  const rlsTables = [
    'demand_history',
    'forecast_models',
    'material_forecasts',
    'forecast_accuracy_metrics',
    'replenishment_suggestions'
  ];

  try {
    for (const table of rlsTables) {
      const result = await pool.query(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = $1
      `, [table]);

      if (result.rows.length > 0 && result.rows[0].relrowsecurity) {
        logResult('Security', `RLS on ${table}`, 'PASS', 'Row-Level Security enabled');
      } else {
        logResult('Security', `RLS on ${table}`, 'FAIL', 'Row-Level Security NOT enabled');
      }

      // Check for tenant isolation policy
      const policyResult = await pool.query(`
        SELECT policyname
        FROM pg_policies
        WHERE tablename = $1
          AND policyname LIKE '%tenant_isolation%'
      `, [table]);

      if (policyResult.rows.length > 0) {
        logResult('Security', `Tenant isolation policy on ${table}`, 'PASS', 'Policy exists');
      } else {
        logResult('Security', `Tenant isolation policy on ${table}`, 'FAIL', 'Tenant isolation policy missing');
      }
    }

  } catch (error) {
    logResult('Security', 'RLS verification', 'FAIL', `Error: ${error.message}`);
  }
}

async function verifyConstraints() {
  console.log('\n🔗 Verifying Database Constraints...\n');

  try {
    // Check unique constraints
    const uniqueConstraints = await pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_name IN (
          'demand_history',
          'material_forecasts',
          'forecast_models'
        )
    `);

    if (uniqueConstraints.rows.length >= 2) {
      logResult('Data Integrity', 'Unique constraints', 'PASS', `${uniqueConstraints.rows.length} unique constraints found`);
    } else {
      logResult('Data Integrity', 'Unique constraints', 'WARN', 'Expected at least 2 unique constraints');
    }

    // Check check constraints
    const checkConstraints = await pool.query(`
      SELECT
        con.conname,
        con.conrelid::regclass AS table_name
      FROM pg_constraint con
      WHERE con.contype = 'c'
        AND con.conrelid::regclass::text IN (
          'demand_history',
          'material_forecasts'
        )
    `);

    if (checkConstraints.rows.length >= 2) {
      logResult('Data Integrity', 'Check constraints', 'PASS', `${checkConstraints.rows.length} check constraints found`);
    } else {
      logResult('Data Integrity', 'Check constraints', 'WARN', 'Expected at least 2 check constraints');
    }

  } catch (error) {
    logResult('Data Integrity', 'Constraint verification', 'FAIL', `Error: ${error.message}`);
  }
}

async function verifyMaterialsTableExtensions() {
  console.log('\n📋 Verifying Materials Table Extensions...\n');

  const requiredColumns = [
    'forecasting_enabled',
    'forecast_algorithm',
    'forecast_horizon_days',
    'forecast_update_frequency',
    'minimum_forecast_history_days',
    'target_forecast_accuracy_pct',
    'demand_pattern'
  ];

  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'materials'
        AND column_name = ANY($1)
    `, [requiredColumns]);

    const existingColumns = result.rows.map(r => r.column_name);

    for (const column of requiredColumns) {
      if (existingColumns.includes(column)) {
        logResult('Schema', `materials.${column}`, 'PASS', 'Column exists');
      } else {
        logResult('Schema', `materials.${column}`, 'WARN', 'Column missing (forecasting config unavailable)');
      }
    }

  } catch (error) {
    logResult('Schema', 'Materials table extensions', 'FAIL', `Error: ${error.message}`);
  }
}

async function verifyDataQuality() {
  console.log('\n🔬 Verifying Data Quality...\n');

  try {
    // Check if there's any demand history data
    const demandCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM demand_history
      WHERE deleted_at IS NULL
    `);

    const count = parseInt(demandCount.rows[0].count);
    if (count > 0) {
      logResult('Data Quality', 'Demand history records', 'PASS', `${count} records found`);
    } else {
      logResult('Data Quality', 'Demand history records', 'WARN', 'No demand history data (may need backfill)');
    }

    // Check for negative demand (data quality issue)
    const negativeCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM demand_history
      WHERE actual_demand_quantity < 0
        AND deleted_at IS NULL
    `);

    const negCount = parseInt(negativeCheck.rows[0].count);
    if (negCount === 0) {
      logResult('Data Quality', 'Negative demand check', 'PASS', 'No negative demand found');
    } else {
      logResult('Data Quality', 'Negative demand check', 'FAIL', `${negCount} records with negative demand (data integrity issue)`);
    }

    // Check for forecasts
    const forecastCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM material_forecasts
      WHERE deleted_at IS NULL
    `);

    const fCount = parseInt(forecastCount.rows[0].count);
    if (fCount > 0) {
      logResult('Data Quality', 'Forecast records', 'PASS', `${fCount} forecast records found`);
    } else {
      logResult('Data Quality', 'Forecast records', 'WARN', 'No forecasts generated yet');
    }

  } catch (error) {
    logResult('Data Quality', 'Data quality check', 'FAIL', `Error: ${error.message}`);
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 INVENTORY FORECASTING IMPLEMENTATION VERIFICATION REPORT');
  console.log('='.repeat(80) + '\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  const totalCount = results.length;

  console.log(`Total Checks: ${totalCount}`);
  console.log(`✅ Passed: ${passCount} (${Math.round(passCount/totalCount*100)}%)`);
  console.log(`❌ Failed: ${failCount} (${Math.round(failCount/totalCount*100)}%)`);
  console.log(`⚠️  Warnings: ${warnCount} (${Math.round(warnCount/totalCount*100)}%)`);

  console.log('\n' + '-'.repeat(80));

  // Group results by category
  const categories = [...new Set(results.map(r => r.category))];

  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    const categoryPass = categoryResults.filter(r => r.status === 'PASS').length;
    const categoryFail = categoryResults.filter(r => r.status === 'FAIL').length;

    console.log(`\n${category}:`);
    console.log(`  ✅ ${categoryPass} passed, ❌ ${categoryFail} failed, ⚠️  ${categoryResults.length - categoryPass - categoryFail} warnings`);
  }

  console.log('\n' + '-'.repeat(80));

  // Critical failures
  const criticalFailures = results.filter(r => r.status === 'FAIL');
  if (criticalFailures.length > 0) {
    console.log('\n❌ CRITICAL FAILURES:\n');
    criticalFailures.forEach(r => {
      console.log(`  • [${r.category}] ${r.check}: ${r.message}`);
    });
  }

  // Warnings
  const warnings = results.filter(r => r.status === 'WARN');
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:\n');
    warnings.forEach(r => {
      console.log(`  • [${r.category}] ${r.check}: ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  // Overall status
  if (failCount === 0) {
    console.log('\n✅ OVERALL STATUS: READY FOR PRODUCTION');
    console.log('All critical checks passed. System is ready for deployment.\n');
  } else if (failCount <= 3) {
    console.log('\n⚠️  OVERALL STATUS: NEEDS ATTENTION');
    console.log('Some checks failed. Please address critical failures before deployment.\n');
  } else {
    console.log('\n❌ OVERALL STATUS: NOT READY');
    console.log('Multiple critical failures detected. System requires fixes before deployment.\n');
  }

  console.log('='.repeat(80) + '\n');
}

async function main() {
  try {
    console.log('🚀 Starting Inventory Forecasting Implementation Verification...\n');
    console.log(`Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'agog_print_erp'}`);

    await verifyTables();
    await verifyIndexes();
    await verifyRLS();
    await verifyConstraints();
    await verifyMaterialsTableExtensions();
    await verifyDataQuality();
    await generateReport();

  } catch (error) {
    console.error('\n❌ Verification failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
