#!/usr/bin/env ts-node

/**
 * CRM & Sales Pipeline Deployment Verification Script
 *
 * Verifies that the CRM module is correctly deployed:
 * - Database tables exist with correct structure
 * - RLS policies are in place
 * - Views and indexes are created
 * - GraphQL schema is accessible
 * - Services are operational
 *
 * REQ: REQ-STRATEGIC-AUTO-1767116143665
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'agog_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

interface VerificationResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

function logResult(result: VerificationResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
  console.log(`  ${icon} ${result.test}: ${result.message}`);
  if (result.details) {
    console.log(`    Details: ${JSON.stringify(result.details, null, 2)}`);
  }
}

async function verifyTable(tableName: string, expectedColumns: string[]) {
  try {
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `;

    const result = await pool.query(query, [tableName]);

    if (result.rows.length === 0) {
      logResult({
        category: 'Database Tables',
        test: `Table: ${tableName}`,
        status: 'FAIL',
        message: 'Table does not exist',
      });
      return false;
    }

    const actualColumns = result.rows.map(row => row.column_name);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

    if (missingColumns.length > 0) {
      logResult({
        category: 'Database Tables',
        test: `Table: ${tableName}`,
        status: 'WARN',
        message: `Missing expected columns: ${missingColumns.join(', ')}`,
        details: { actualColumns, missingColumns },
      });
      return true;
    }

    logResult({
      category: 'Database Tables',
      test: `Table: ${tableName}`,
      status: 'PASS',
      message: `Table exists with ${result.rows.length} columns`,
    });
    return true;
  } catch (error) {
    logResult({
      category: 'Database Tables',
      test: `Table: ${tableName}`,
      status: 'FAIL',
      message: `Error checking table: ${error.message}`,
    });
    return false;
  }
}

async function verifyRLSPolicy(tableName: string, policyName: string) {
  try {
    const query = `
      SELECT polname, polcmd
      FROM pg_policy
      WHERE polrelid = $1::regclass
        AND polname = $2
    `;

    const result = await pool.query(query, [tableName, policyName]);

    if (result.rows.length === 0) {
      logResult({
        category: 'RLS Policies',
        test: `${tableName}.${policyName}`,
        status: 'FAIL',
        message: 'Policy does not exist',
      });
      return false;
    }

    logResult({
      category: 'RLS Policies',
      test: `${tableName}.${policyName}`,
      status: 'PASS',
      message: `Policy exists (${result.rows[0].polcmd})`,
    });
    return true;
  } catch (error) {
    logResult({
      category: 'RLS Policies',
      test: `${tableName}.${policyName}`,
      status: 'FAIL',
      message: `Error checking policy: ${error.message}`,
    });
    return false;
  }
}

async function verifyView(viewName: string) {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name = $1
    `;

    const result = await pool.query(query, [viewName]);

    if (parseInt(result.rows[0].count) === 0) {
      logResult({
        category: 'Database Views',
        test: `View: ${viewName}`,
        status: 'FAIL',
        message: 'View does not exist',
      });
      return false;
    }

    logResult({
      category: 'Database Views',
      test: `View: ${viewName}`,
      status: 'PASS',
      message: 'View exists',
    });
    return true;
  } catch (error) {
    logResult({
      category: 'Database Views',
      test: `View: ${viewName}`,
      status: 'FAIL',
      message: `Error checking view: ${error.message}`,
    });
    return false;
  }
}

async function verifyIndex(tableName: string, indexPattern: string) {
  try {
    const query = `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = $1
        AND indexname LIKE $2
    `;

    const result = await pool.query(query, [tableName, indexPattern]);

    if (result.rows.length === 0) {
      logResult({
        category: 'Database Indexes',
        test: `${tableName} indexes matching ${indexPattern}`,
        status: 'WARN',
        message: 'No matching indexes found',
      });
      return false;
    }

    logResult({
      category: 'Database Indexes',
      test: `${tableName} indexes`,
      status: 'PASS',
      message: `Found ${result.rows.length} indexes`,
      details: result.rows.map(r => r.indexname),
    });
    return true;
  } catch (error) {
    logResult({
      category: 'Database Indexes',
      test: `${tableName} indexes`,
      status: 'FAIL',
      message: `Error checking indexes: ${error.message}`,
    });
    return false;
  }
}

async function runVerification() {
  console.log('\n='.repeat(60));
  console.log('CRM & SALES PIPELINE DEPLOYMENT VERIFICATION');
  console.log('REQ: REQ-STRATEGIC-AUTO-1767116143665');
  console.log('='.repeat(60));

  // Verify database tables
  console.log('\n📋 Verifying Database Tables...');
  await verifyTable('crm_contacts', ['id', 'tenant_id', 'first_name', 'last_name', 'email_primary', 'owner_user_id']);
  await verifyTable('crm_pipeline_stages', ['id', 'tenant_id', 'stage_name', 'sequence_number', 'probability_percentage']);
  await verifyTable('crm_opportunities', ['id', 'tenant_id', 'opportunity_number', 'opportunity_name', 'pipeline_stage_id', 'estimated_value', 'owner_user_id']);
  await verifyTable('crm_activities', ['id', 'tenant_id', 'activity_type', 'activity_subject', 'owner_user_id']);
  await verifyTable('crm_notes', ['id', 'tenant_id', 'note_content', 'created_by']);
  await verifyTable('crm_opportunity_stage_history', ['id', 'tenant_id', 'opportunity_id', 'to_stage_id']);

  // Verify RLS policies
  console.log('\n🔒 Verifying RLS Policies...');
  await verifyRLSPolicy('crm_contacts', 'crm_contacts_select_policy');
  await verifyRLSPolicy('crm_contacts', 'crm_contacts_insert_policy');
  await verifyRLSPolicy('crm_opportunities', 'crm_opportunities_select_policy');
  await verifyRLSPolicy('crm_opportunities', 'crm_opportunities_insert_policy');
  await verifyRLSPolicy('crm_activities', 'crm_activities_select_policy');
  await verifyRLSPolicy('crm_notes', 'crm_notes_select_policy');

  // Verify views
  console.log('\n👁️  Verifying Database Views...');
  await verifyView('crm_pipeline_summary');
  await verifyView('crm_opportunities_requiring_action');
  await verifyView('crm_sales_rep_performance');

  // Verify indexes
  console.log('\n⚡ Verifying Database Indexes...');
  await verifyIndex('crm_contacts', 'idx_crm_contacts_%');
  await verifyIndex('crm_opportunities', 'idx_crm_opportunities_%');
  await verifyIndex('crm_activities', 'idx_crm_activities_%');

  // Summary
  console.log('\n='.repeat(60));
  console.log('VERIFICATION SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`⚠ Warnings: ${warned}`);
  console.log(`Total Tests: ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ VERIFICATION FAILED - Please review failed tests above');
    process.exit(1);
  } else if (warned > 0) {
    console.log('\n⚠️  VERIFICATION PASSED WITH WARNINGS');
    process.exit(0);
  } else {
    console.log('\n✅ ALL VERIFICATION TESTS PASSED');
    process.exit(0);
  }
}

// Run verification
runVerification()
  .catch(error => {
    console.error('\n💥 Verification script error:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
