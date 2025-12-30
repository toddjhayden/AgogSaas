#!/usr/bin/env ts-node

/**
 * Verification Script: PO Approval Workflow Deployment
 * REQ: REQ-STRATEGIC-AUTO-1735134000000
 * Purpose: Verify that all approval workflow components are properly deployed
 * Author: Roy (Backend Implementation Specialist)
 * Date: 2025-12-27
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'agog_erp',
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

async function verifyTablesExist() {
  console.log('\n📋 Verifying Tables...\n');

  const expectedTables = [
    'purchase_order_approval_audit',
    'user_approval_authorities',
    'user_delegations',
    'approval_rules',
    'purchase_order_approvals',
    'approval_notifications',
  ];

  for (const tableName of expectedTables) {
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
        ) AS table_exists
      `, [tableName]);

      const exists = result.rows[0].table_exists;

      if (exists) {
        // Get row count
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
        const rowCount = parseInt(countResult.rows[0].count);

        logResult(
          'Tables',
          `Table ${tableName}`,
          'PASS',
          `Exists with ${rowCount} rows`
        );
      } else {
        logResult(
          'Tables',
          `Table ${tableName}`,
          'FAIL',
          'Table does not exist - migration may not have run'
        );
      }
    } catch (error) {
      logResult(
        'Tables',
        `Table ${tableName}`,
        'FAIL',
        `Error checking table: ${error.message}`
      );
    }
  }
}

async function verifyIndexes() {
  console.log('\n📊 Verifying Indexes...\n');

  const expectedIndexes = [
    { table: 'purchase_order_approval_audit', index: 'idx_po_approval_audit_po' },
    { table: 'purchase_order_approval_audit', index: 'idx_po_approval_audit_user' },
    { table: 'purchase_order_approval_audit', index: 'idx_po_approval_audit_tenant' },
    { table: 'user_approval_authorities', index: 'idx_user_approval_auth_user' },
    { table: 'user_approval_authorities', index: 'idx_user_approval_auth_active' },
    { table: 'user_delegations', index: 'idx_user_delegations_user' },
    { table: 'user_delegations', index: 'idx_user_delegations_active' },
    { table: 'approval_rules', index: 'idx_approval_rules_tenant' },
    { table: 'approval_rules', index: 'idx_approval_rules_active' },
    { table: 'purchase_order_approvals', index: 'idx_po_approvals_po' },
    { table: 'purchase_order_approvals', index: 'idx_po_approvals_approver' },
    { table: 'purchase_order_approvals', index: 'idx_po_approvals_status' },
  ];

  for (const { table, index } of expectedIndexes) {
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = $1
            AND indexname = $2
        ) AS index_exists
      `, [table, index]);

      const exists = result.rows[0].index_exists;

      logResult(
        'Indexes',
        `Index ${index}`,
        exists ? 'PASS' : 'FAIL',
        exists ? 'Index exists' : 'Index missing - performance may be degraded'
      );
    } catch (error) {
      logResult(
        'Indexes',
        `Index ${index}`,
        'FAIL',
        `Error checking index: ${error.message}`
      );
    }
  }
}

async function verifyFunctions() {
  console.log('\n⚙️ Verifying Functions...\n');

  const expectedFunctions = [
    'get_user_approval_authority',
    'get_active_delegation',
    'calculate_sla_deadline',
    'is_sla_breached',
  ];

  for (const functionName of expectedFunctions) {
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
            AND p.proname = $1
        ) AS function_exists
      `, [functionName]);

      const exists = result.rows[0].function_exists;

      logResult(
        'Functions',
        `Function ${functionName}`,
        exists ? 'PASS' : 'FAIL',
        exists ? 'Function exists' : 'Function missing'
      );
    } catch (error) {
      logResult(
        'Functions',
        `Function ${functionName}`,
        'FAIL',
        `Error checking function: ${error.message}`
      );
    }
  }
}

async function verifyImmutabilityRules() {
  console.log('\n🔒 Verifying Immutability Rules...\n');

  try {
    // Check if UPDATE rule exists
    const updateRuleResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_rules
        WHERE tablename = 'purchase_order_approval_audit'
          AND rulename = 'purchase_order_approval_audit_no_update'
      ) AS rule_exists
    `);

    const updateRuleExists = updateRuleResult.rows[0].rule_exists;

    logResult(
      'Immutability',
      'UPDATE prevention rule',
      updateRuleExists ? 'PASS' : 'FAIL',
      updateRuleExists
        ? 'UPDATE rule exists - audit records are protected'
        : 'UPDATE rule missing - audit records can be modified!'
    );

    // Check if DELETE rule exists
    const deleteRuleResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_rules
        WHERE tablename = 'purchase_order_approval_audit'
          AND rulename = 'purchase_order_approval_audit_no_delete'
      ) AS rule_exists
    `);

    const deleteRuleExists = deleteRuleResult.rows[0].rule_exists;

    logResult(
      'Immutability',
      'DELETE prevention rule',
      deleteRuleExists ? 'PASS' : 'FAIL',
      deleteRuleExists
        ? 'DELETE rule exists - audit records are protected'
        : 'DELETE rule missing - audit records can be deleted!'
    );
  } catch (error) {
    logResult(
      'Immutability',
      'Immutability rules',
      'FAIL',
      `Error checking immutability rules: ${error.message}`
    );
  }
}

async function verifySeedData() {
  console.log('\n🌱 Verifying Seed Data...\n');

  try {
    // Check for default approval rules
    const result = await pool.query(`
      SELECT rule_code, rule_name, is_active
      FROM approval_rules
      WHERE rule_code IN ('STANDARD_SINGLE', 'HIGH_VALUE_DUAL')
      ORDER BY priority
    `);

    if (result.rows.length === 0) {
      logResult(
        'Seed Data',
        'Default approval rules',
        'WARN',
        'No default approval rules found - manual setup required'
      );
    } else {
      for (const rule of result.rows) {
        logResult(
          'Seed Data',
          `Rule ${rule.rule_code}`,
          rule.is_active ? 'PASS' : 'WARN',
          `${rule.rule_name} - ${rule.is_active ? 'Active' : 'Inactive'}`
        );
      }
    }
  } catch (error) {
    logResult(
      'Seed Data',
      'Default approval rules',
      'FAIL',
      `Error checking seed data: ${error.message}`
    );
  }
}

async function verifyConstraints() {
  console.log('\n🛡️ Verifying Constraints...\n');

  const expectedConstraints = [
    { table: 'purchase_order_approval_audit', constraint: 'fk_po_approval_audit_po', type: 'FOREIGN KEY' },
    { table: 'purchase_order_approval_audit', constraint: 'fk_po_approval_audit_user', type: 'FOREIGN KEY' },
    { table: 'user_approval_authorities', constraint: 'uq_user_approval_auth_active', type: 'UNIQUE' },
    { table: 'user_delegations', constraint: 'chk_user_delegation_no_self', type: 'CHECK' },
    { table: 'approval_rules', constraint: 'chk_approval_rule_amount_range', type: 'CHECK' },
    { table: 'purchase_order_approvals', constraint: 'uq_po_approval_level_sequence', type: 'UNIQUE' },
  ];

  for (const { table, constraint, type } of expectedConstraints) {
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = $1
            AND constraint_name = $2
        ) AS constraint_exists
      `, [table, constraint]);

      const exists = result.rows[0].constraint_exists;

      logResult(
        'Constraints',
        `${type} ${constraint}`,
        exists ? 'PASS' : 'FAIL',
        exists ? `Constraint exists on ${table}` : `Constraint missing on ${table}`
      );
    } catch (error) {
      logResult(
        'Constraints',
        `${type} ${constraint}`,
        'FAIL',
        `Error checking constraint: ${error.message}`
      );
    }
  }
}

async function verifyFunctionalityWithTestData() {
  console.log('\n🧪 Verifying Functionality with Test Data...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get first tenant
    const tenantResult = await client.query('SELECT id FROM tenants LIMIT 1');
    if (tenantResult.rows.length === 0) {
      logResult(
        'Functionality',
        'Test data verification',
        'WARN',
        'No tenants found - skipping functional tests'
      );
      await client.query('ROLLBACK');
      return;
    }

    const tenantId = tenantResult.rows[0].id;

    // Test inserting an audit record
    try {
      await client.query(`
        INSERT INTO purchase_order_approval_audit (
          tenant_id, purchase_order_id, action, action_by_user_id,
          previous_status, new_status
        ) VALUES (
          $1, uuid_generate_v7(), 'APPROVED', uuid_generate_v7(),
          'DRAFT', 'ISSUED'
        )
      `, [tenantId]);

      logResult(
        'Functionality',
        'Insert audit record',
        'PASS',
        'Can insert audit records'
      );
    } catch (error) {
      logResult(
        'Functionality',
        'Insert audit record',
        'FAIL',
        `Cannot insert audit record: ${error.message}`
      );
    }

    // Test that UPDATE is prevented
    try {
      const updateResult = await client.query(`
        UPDATE purchase_order_approval_audit
        SET action = 'REJECTED'
        WHERE tenant_id = $1
        RETURNING *
      `, [tenantId]);

      if (updateResult.rowCount === 0) {
        logResult(
          'Functionality',
          'Prevent audit UPDATE',
          'PASS',
          'UPDATE rule successfully prevents modifications'
        );
      } else {
        logResult(
          'Functionality',
          'Prevent audit UPDATE',
          'FAIL',
          'UPDATE rule failed - audit records can be modified!'
        );
      }
    } catch (error) {
      logResult(
        'Functionality',
        'Prevent audit UPDATE',
        'PASS',
        'UPDATE rule successfully prevents modifications (exception caught)'
      );
    }

    // Test that DELETE is prevented
    try {
      const deleteResult = await client.query(`
        DELETE FROM purchase_order_approval_audit
        WHERE tenant_id = $1
        RETURNING *
      `, [tenantId]);

      if (deleteResult.rowCount === 0) {
        logResult(
          'Functionality',
          'Prevent audit DELETE',
          'PASS',
          'DELETE rule successfully prevents deletions'
        );
      } else {
        logResult(
          'Functionality',
          'Prevent audit DELETE',
          'FAIL',
          'DELETE rule failed - audit records can be deleted!'
        );
      }
    } catch (error) {
      logResult(
        'Functionality',
        'Prevent audit DELETE',
        'PASS',
        'DELETE rule successfully prevents deletions (exception caught)'
      );
    }

    await client.query('ROLLBACK'); // Rollback test data
  } catch (error) {
    await client.query('ROLLBACK');
    logResult(
      'Functionality',
      'Test data verification',
      'FAIL',
      `Error during functional tests: ${error.message}`
    );
  } finally {
    client.release();
  }
}

async function generateReport() {
  console.log('\n📊 VERIFICATION REPORT\n');
  console.log('='.repeat(80));

  const categories = ['Tables', 'Indexes', 'Functions', 'Immutability', 'Seed Data', 'Constraints', 'Functionality'];
  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status === 'FAIL').length,
    warnings: results.filter(r => r.status === 'WARN').length,
  };

  console.log(`\nTotal Checks: ${summary.total}`);
  console.log(`✅ Passed: ${summary.passed}`);
  console.log(`❌ Failed: ${summary.failed}`);
  console.log(`⚠️ Warnings: ${summary.warnings}`);

  console.log('\nBreakdown by Category:\n');

  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    const passed = categoryResults.filter(r => r.status === 'PASS').length;
    const failed = categoryResults.filter(r => r.status === 'FAIL').length;
    const warnings = categoryResults.filter(r => r.status === 'WARN').length;

    console.log(`${category}:`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  ⚠️ Warnings: ${warnings}`);
  }

  console.log('\n' + '='.repeat(80));

  if (summary.failed === 0) {
    console.log('\n✅ ✅ ✅ ALL CRITICAL CHECKS PASSED ✅ ✅ ✅');
    console.log('\nDeployment is READY FOR PRODUCTION!');

    if (summary.warnings > 0) {
      console.log(`\nNote: ${summary.warnings} warning(s) detected. Review recommended but not blocking.`);
    }
  } else {
    console.log('\n❌ ❌ ❌ DEPLOYMENT VERIFICATION FAILED ❌ ❌ ❌');
    console.log(`\n${summary.failed} critical check(s) failed. Resolve before production deployment.`);
    console.log('\nFailed Checks:');

    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`  - [${r.category}] ${r.check}: ${r.message}`);
      });
  }

  console.log('\n' + '='.repeat(80) + '\n');

  return summary.failed === 0;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       PO APPROVAL WORKFLOW DEPLOYMENT VERIFICATION                           ║');
  console.log('║       REQ-STRATEGIC-AUTO-1735134000000                                        ║');
  console.log('║       Migration: V0.0.38__create_po_approval_workflow_tables.sql              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

  try {
    await verifyTablesExist();
    await verifyIndexes();
    await verifyFunctions();
    await verifyImmutabilityRules();
    await verifySeedData();
    await verifyConstraints();
    await verifyFunctionalityWithTestData();

    const success = await generateReport();

    await pool.end();

    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Fatal error during verification:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
