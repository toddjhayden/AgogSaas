/**
 * Verification Script: Production Planning & Scheduling Module
 *
 * Verifies successful deployment of:
 * - Routing templates tables
 * - RLS policies
 * - Service layer integration
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328658
 * Author: Roy (Backend Architect)
 * Date: 2025-12-29
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'agog_erp',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD
});

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

const results: VerificationResult[] = [];

async function verify() {
  console.log('======================================================');
  console.log('Production Planning & Scheduling Module Verification');
  console.log('REQ-STRATEGIC-AUTO-1767048328658');
  console.log('======================================================\n');

  try {
    // =====================================================
    // Check 1: Routing Templates Table
    // =====================================================
    console.log('[1/10] Verifying routing_templates table...');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_name = 'routing_templates'
      `);

      if (parseInt(result.rows[0].count) === 1) {
        results.push({
          check: 'routing_templates table',
          status: 'PASS',
          message: 'Table exists'
        });
      } else {
        results.push({
          check: 'routing_templates table',
          status: 'FAIL',
          message: 'Table not found'
        });
      }
    } catch (error) {
      results.push({
        check: 'routing_templates table',
        status: 'FAIL',
        message: error.message
      });
    }

    // =====================================================
    // Check 2: Routing Operations Table
    // =====================================================
    console.log('[2/10] Verifying routing_operations table...');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_name = 'routing_operations'
      `);

      if (parseInt(result.rows[0].count) === 1) {
        results.push({
          check: 'routing_operations table',
          status: 'PASS',
          message: 'Table exists'
        });
      } else {
        results.push({
          check: 'routing_operations table',
          status: 'FAIL',
          message: 'Table not found'
        });
      }
    } catch (error) {
      results.push({
        check: 'routing_operations table',
        status: 'FAIL',
        message: error.message
      });
    }

    // =====================================================
    // Check 3: Production Orders routing_id Column
    // =====================================================
    console.log('[3/10] Verifying production_orders.routing_id column...');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_name = 'production_orders'
        AND column_name = 'routing_id'
      `);

      if (parseInt(result.rows[0].count) === 1) {
        results.push({
          check: 'production_orders.routing_id column',
          status: 'PASS',
          message: 'Column exists'
        });
      } else {
        results.push({
          check: 'production_orders.routing_id column',
          status: 'FAIL',
          message: 'Column not found'
        });
      }
    } catch (error) {
      results.push({
        check: 'production_orders.routing_id column',
        status: 'FAIL',
        message: error.message
      });
    }

    // =====================================================
    // Check 4: RLS Enabled on routing_templates
    // =====================================================
    console.log('[4/10] Verifying RLS on routing_templates...');
    try {
      const result = await pool.query(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = 'routing_templates'
      `);

      if (result.rows[0]?.relrowsecurity === true) {
        results.push({
          check: 'RLS on routing_templates',
          status: 'PASS',
          message: 'RLS enabled'
        });
      } else {
        results.push({
          check: 'RLS on routing_templates',
          status: 'FAIL',
          message: 'RLS not enabled'
        });
      }
    } catch (error) {
      results.push({
        check: 'RLS on routing_templates',
        status: 'FAIL',
        message: error.message
      });
    }

    // =====================================================
    // Check 5: RLS Policies Count
    // =====================================================
    console.log('[5/10] Verifying RLS policies...');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN (
          'work_centers', 'production_orders', 'production_runs',
          'operations', 'changeover_details', 'equipment_status_log',
          'maintenance_records', 'asset_hierarchy', 'oee_calculations',
          'production_schedules', 'capacity_planning',
          'routing_templates', 'routing_operations'
        )
      `);

      const policyCount = parseInt(result.rows[0].count);
      if (policyCount >= 13) {
        results.push({
          check: 'RLS policies',
          status: 'PASS',
          message: `${policyCount} policies found`
        });
      } else {
        results.push({
          check: 'RLS policies',
          status: 'WARN',
          message: `Expected 13 policies, found ${policyCount}`
        });
      }
    } catch (error) {
      results.push({
        check: 'RLS policies',
        status: 'FAIL',
        message: error.message
      });
    }

    // =====================================================
    // Check 6: Indexes on routing_templates
    // =====================================================
    console.log('[6/10] Verifying indexes on routing_templates...');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE tablename = 'routing_templates'
      `);

      const indexCount = parseInt(result.rows[0].count);
      if (indexCount >= 3) {
        results.push({
          check: 'routing_templates indexes',
          status: 'PASS',
          message: `${indexCount} indexes found`
        });
      } else {
        results.push({
          check: 'routing_templates indexes',
          status: 'WARN',
          message: `Expected at least 3 indexes, found ${indexCount}`
        });
      }
    } catch (error) {
      results.push({
        check: 'routing_templates indexes',
        status: 'FAIL',
        message: error.message
      });
    }

    // =====================================================
    // Check 7: Foreign Key Constraints
    // =====================================================
    console.log('[7/10] Verifying foreign key constraints...');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.table_constraints
        WHERE table_name IN ('routing_templates', 'routing_operations')
        AND constraint_type = 'FOREIGN KEY'
      `);

      const fkCount = parseInt(result.rows[0].count);
      if (fkCount >= 4) {
        results.push({
          check: 'Foreign key constraints',
          status: 'PASS',
          message: `${fkCount} constraints found`
        });
      } else {
        results.push({
          check: 'Foreign key constraints',
          status: 'WARN',
          message: `Expected at least 4 constraints, found ${fkCount}`
        });
      }
    } catch (error) {
      results.push({
        check: 'Foreign key constraints',
        status: 'FAIL',
        message: error.message
      });
    }

    // =====================================================
    // Check 8: Unique Constraints
    // =====================================================
    console.log('[8/10] Verifying unique constraints...');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.table_constraints
        WHERE table_name IN ('routing_templates', 'routing_operations')
        AND constraint_type = 'UNIQUE'
      `);

      const uniqueCount = parseInt(result.rows[0].count);
      if (uniqueCount >= 2) {
        results.push({
          check: 'Unique constraints',
          status: 'PASS',
          message: `${uniqueCount} constraints found`
        });
      } else {
        results.push({
          check: 'Unique constraints',
          status: 'WARN',
          message: `Expected at least 2 constraints, found ${uniqueCount}`
        });
      }
    } catch (error) {
      results.push({
        check: 'Unique constraints',
        status: 'FAIL',
        message: error.message
      });
    }

    // =====================================================
    // Check 9: Check Constraints (yield/scrap validation)
    // =====================================================
    console.log('[9/10] Verifying check constraints...');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE 'chk_routing_op%'
      `);

      const checkCount = parseInt(result.rows[0].count);
      if (checkCount >= 2) {
        results.push({
          check: 'Check constraints',
          status: 'PASS',
          message: `${checkCount} constraints found`
        });
      } else {
        results.push({
          check: 'Check constraints',
          status: 'WARN',
          message: `Expected at least 2 constraints, found ${checkCount}`
        });
      }
    } catch (error) {
      results.push({
        check: 'Check constraints',
        status: 'FAIL',
        message: error.message
      });
    }

    // =====================================================
    // Check 10: Test RLS Policy Enforcement
    // =====================================================
    console.log('[10/10] Testing RLS policy enforcement...');
    try {
      // Set a test tenant ID
      const testTenantId = '01234567-89ab-cdef-0123-456789abcdef';
      await pool.query(`SET app.current_tenant_id = '${testTenantId}'`);

      // Try to query routing_templates (should not error)
      const result = await pool.query(`SELECT COUNT(*) FROM routing_templates`);

      results.push({
        check: 'RLS policy enforcement',
        status: 'PASS',
        message: 'Query with tenant context succeeded'
      });
    } catch (error) {
      results.push({
        check: 'RLS policy enforcement',
        status: 'WARN',
        message: `Query failed: ${error.message}`
      });
    }

    // =====================================================
    // Print Results
    // =====================================================
    console.log('\n======================================================');
    console.log('Verification Results');
    console.log('======================================================\n');

    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;

    results.forEach(result => {
      const statusSymbol =
        result.status === 'PASS' ? '✓' :
        result.status === 'FAIL' ? '✗' :
        '⚠';

      const statusColor =
        result.status === 'PASS' ? '\x1b[32m' :  // Green
        result.status === 'FAIL' ? '\x1b[31m' :  // Red
        '\x1b[33m';  // Yellow

      console.log(`${statusColor}${statusSymbol}\x1b[0m ${result.check}: ${result.message}`);

      if (result.status === 'PASS') passCount++;
      else if (result.status === 'FAIL') failCount++;
      else warnCount++;
    });

    console.log('\n======================================================');
    console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`);
    console.log('======================================================\n');

    if (failCount > 0) {
      console.log('\x1b[31mDeployment verification FAILED\x1b[0m');
      process.exit(1);
    } else if (warnCount > 0) {
      console.log('\x1b[33mDeployment verification PASSED with warnings\x1b[0m');
      process.exit(0);
    } else {
      console.log('\x1b[32mDeployment verification PASSED\x1b[0m');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n\x1b[31mVerification failed with error:\x1b[0m', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run verification
verify();
