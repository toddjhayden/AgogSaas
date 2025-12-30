#!/usr/bin/env ts-node
/**
 * Deployment Verification Script: PO Approval Workflow
 * REQ: REQ-STRATEGIC-AUTO-1735409486000
 * Agent: Berry (DevOps Specialist)
 * Date: 2024-12-28
 *
 * Purpose: Verify complete deployment of PO Approval Workflow feature
 * - Database schema (tables, views, functions)
 * - Backend service and GraphQL API
 * - Frontend components
 * - Critical bug verification (missing columns)
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'agogsaas',
  user: process.env.DB_USER || 'agogsaas_user',
  password: process.env.DB_PASSWORD || 'changeme'
});

interface VerificationResult {
  category: string;
  testName: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
}

const results: VerificationResult[] = [];

function addResult(category: string, testName: string, status: 'PASS' | 'FAIL' | 'WARNING', details: string) {
  results.push({ category, testName, status, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${category}] ${testName}: ${details}`);
}

async function verifyDatabaseSchema() {
  console.log('\n=== DATABASE SCHEMA VERIFICATION ===\n');

  try {
    // 1. Verify po_approval_workflows table exists
    const workflowsTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'po_approval_workflows'
      );
    `);
    addResult(
      'Database Schema',
      'po_approval_workflows table',
      workflowsTable.rows[0].exists ? 'PASS' : 'FAIL',
      workflowsTable.rows[0].exists ? 'Table exists' : 'Table missing'
    );

    // 2. Verify po_approval_workflow_steps table exists
    const stepsTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'po_approval_workflow_steps'
      );
    `);
    addResult(
      'Database Schema',
      'po_approval_workflow_steps table',
      stepsTable.rows[0].exists ? 'PASS' : 'FAIL',
      stepsTable.rows[0].exists ? 'Table exists' : 'Table missing'
    );

    // 3. Verify po_approval_history table exists
    const historyTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'po_approval_history'
      );
    `);
    addResult(
      'Database Schema',
      'po_approval_history table',
      historyTable.rows[0].exists ? 'PASS' : 'FAIL',
      historyTable.rows[0].exists ? 'Table exists' : 'Table missing'
    );

    // 4. Verify user_approval_authority table exists
    const authorityTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_approval_authority'
      );
    `);
    addResult(
      'Database Schema',
      'user_approval_authority table',
      authorityTable.rows[0].exists ? 'PASS' : 'FAIL',
      authorityTable.rows[0].exists ? 'Table exists' : 'Table missing'
    );

    // 5. Verify purchase_orders extended columns
    const poColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'purchase_orders'
      AND column_name IN (
        'current_approval_workflow_id',
        'current_approval_step_number',
        'approval_started_at',
        'approval_completed_at',
        'pending_approver_user_id',
        'workflow_snapshot'
      )
      ORDER BY column_name;
    `);
    const expectedColumns = 6;
    const actualColumns = poColumns.rows.length;
    addResult(
      'Database Schema',
      'purchase_orders extended columns',
      actualColumns === expectedColumns ? 'PASS' : 'FAIL',
      `${actualColumns} of ${expectedColumns} columns exist: ${poColumns.rows.map(r => r.column_name).join(', ')}`
    );

    // 6. CRITICAL: Verify buyer_user_id exists (BUG-001)
    const buyerColumn = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'purchase_orders'
        AND column_name = 'buyer_user_id'
      );
    `);
    addResult(
      'Database Schema',
      'buyer_user_id column (BUG-001)',
      buyerColumn.rows[0].exists ? 'PASS' : 'FAIL',
      buyerColumn.rows[0].exists ? 'Column exists - BUG-001 resolved' : 'Column missing - CRITICAL BUG'
    );

    // 7. CRITICAL: Verify approved_by_user_id exists (BUG-002)
    const approvedByColumn = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'purchase_orders'
        AND column_name = 'approved_by_user_id'
      );
    `);
    addResult(
      'Database Schema',
      'approved_by_user_id column (BUG-002)',
      approvedByColumn.rows[0].exists ? 'PASS' : 'FAIL',
      approvedByColumn.rows[0].exists ? 'Column exists - BUG-002 resolved' : 'Column missing - CRITICAL BUG'
    );

    // 8. Verify v_approval_queue view exists
    const approvalQueueView = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name = 'v_approval_queue'
      );
    `);
    addResult(
      'Database Schema',
      'v_approval_queue view',
      approvalQueueView.rows[0].exists ? 'PASS' : 'FAIL',
      approvalQueueView.rows[0].exists ? 'View exists' : 'View missing'
    );

    // 9. Verify get_applicable_workflow function exists
    const workflowFunction = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'get_applicable_workflow'
      );
    `);
    addResult(
      'Database Schema',
      'get_applicable_workflow function',
      workflowFunction.rows[0].exists ? 'PASS' : 'FAIL',
      workflowFunction.rows[0].exists ? 'Function exists' : 'Function missing'
    );

    // 10. Verify create_approval_history_entry function exists
    const historyFunction = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'create_approval_history_entry'
      );
    `);
    addResult(
      'Database Schema',
      'create_approval_history_entry function',
      historyFunction.rows[0].exists ? 'PASS' : 'FAIL',
      historyFunction.rows[0].exists ? 'Function exists' : 'Function missing'
    );

    // 11. Verify indexes
    const indexes = await pool.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN (
        'po_approval_workflows',
        'po_approval_workflow_steps',
        'po_approval_history',
        'user_approval_authority'
      );
    `);
    const indexCount = parseInt(indexes.rows[0].count);
    addResult(
      'Database Schema',
      'Indexes created',
      indexCount >= 10 ? 'PASS' : 'WARNING',
      `${indexCount} indexes found (expected: ~15)`
    );

  } catch (error: any) {
    addResult('Database Schema', 'Schema verification', 'FAIL', `Error: ${error.message}`);
  }
}

async function verifyBackendFiles() {
  console.log('\n=== BACKEND FILES VERIFICATION ===\n');

  const fs = require('fs');
  const path = require('path');

  const backendRoot = path.join(__dirname, '..');

  // 1. Verify approval-workflow.service.ts exists
  const servicePath = path.join(backendRoot, 'src/modules/procurement/services/approval-workflow.service.ts');
  addResult(
    'Backend Files',
    'approval-workflow.service.ts',
    fs.existsSync(servicePath) ? 'PASS' : 'FAIL',
    fs.existsSync(servicePath) ? 'File exists' : 'File missing'
  );

  // 2. Verify po-approval-workflow.graphql exists
  const schemaPath = path.join(backendRoot, 'src/graphql/schema/po-approval-workflow.graphql');
  addResult(
    'Backend Files',
    'po-approval-workflow.graphql',
    fs.existsSync(schemaPath) ? 'PASS' : 'FAIL',
    fs.existsSync(schemaPath) ? 'File exists' : 'File missing'
  );

  // 3. Verify po-approval-workflow.resolver.ts exists
  const resolverPath = path.join(backendRoot, 'src/graphql/resolvers/po-approval-workflow.resolver.ts');
  addResult(
    'Backend Files',
    'po-approval-workflow.resolver.ts',
    fs.existsSync(resolverPath) ? 'PASS' : 'FAIL',
    fs.existsSync(resolverPath) ? 'File exists' : 'File missing'
  );

  // 4. Verify migration file exists
  const migrationPath = path.join(backendRoot, 'migrations/V0.0.38__add_po_approval_workflow.sql');
  addResult(
    'Backend Files',
    'V0.0.38 migration',
    fs.existsSync(migrationPath) ? 'PASS' : 'FAIL',
    fs.existsSync(migrationPath) ? 'Migration file exists' : 'Migration file missing'
  );
}

async function verifyFrontendFiles() {
  console.log('\n=== FRONTEND FILES VERIFICATION ===\n');

  const fs = require('fs');
  const path = require('path');

  const frontendRoot = path.join(__dirname, '../../frontend');

  // 1. Verify MyApprovalsPage.tsx exists
  const approvalsPagePath = path.join(frontendRoot, 'src/pages/MyApprovalsPage.tsx');
  addResult(
    'Frontend Files',
    'MyApprovalsPage.tsx',
    fs.existsSync(approvalsPagePath) ? 'PASS' : 'FAIL',
    fs.existsSync(approvalsPagePath) ? 'File exists' : 'File missing'
  );

  // 2. Verify approvals.ts queries exist
  const queriesPath = path.join(frontendRoot, 'src/graphql/queries/approvals.ts');
  addResult(
    'Frontend Files',
    'approvals.ts queries',
    fs.existsSync(queriesPath) ? 'PASS' : 'FAIL',
    fs.existsSync(queriesPath) ? 'File exists' : 'File missing'
  );
}

async function verifyDeploymentReadiness() {
  console.log('\n=== DEPLOYMENT READINESS VERIFICATION ===\n');

  const fs = require('fs');
  const path = require('path');

  // 1. Verify Docker Compose file exists
  const dockerComposePath = path.join(__dirname, '../../docker-compose.app.yml');
  addResult(
    'Deployment',
    'docker-compose.app.yml',
    fs.existsSync(dockerComposePath) ? 'PASS' : 'FAIL',
    fs.existsSync(dockerComposePath) ? 'Docker Compose file exists' : 'Docker Compose file missing'
  );

  // 2. Verify backend Dockerfile exists
  const backendDockerfilePath = path.join(__dirname, '../Dockerfile');
  addResult(
    'Deployment',
    'Backend Dockerfile',
    fs.existsSync(backendDockerfilePath) ? 'PASS' : 'FAIL',
    fs.existsSync(backendDockerfilePath) ? 'Dockerfile exists' : 'Dockerfile missing'
  );

  // 3. Verify frontend Dockerfile exists
  const frontendDockerfilePath = path.join(__dirname, '../../frontend/Dockerfile');
  addResult(
    'Deployment',
    'Frontend Dockerfile',
    fs.existsSync(frontendDockerfilePath) ? 'PASS' : 'FAIL',
    fs.existsSync(frontendDockerfilePath) ? 'Dockerfile exists' : 'Dockerfile missing'
  );
}

async function verifySampleData() {
  console.log('\n=== SAMPLE DATA VERIFICATION ===\n');

  try {
    // Check if sample workflows exist
    const workflows = await pool.query(`
      SELECT COUNT(*) as count
      FROM po_approval_workflows
      WHERE workflow_name LIKE 'Sample%'
      OR workflow_name LIKE 'Standard%'
      OR workflow_name LIKE 'Executive%';
    `);
    const workflowCount = parseInt(workflows.rows[0].count);
    addResult(
      'Sample Data',
      'Sample workflows',
      workflowCount > 0 ? 'WARNING' : 'PASS',
      workflowCount > 0
        ? `${workflowCount} sample workflows found - should be moved to seed script`
        : 'No sample workflows in migration (correct)'
    );
  } catch (error: any) {
    addResult('Sample Data', 'Sample data check', 'WARNING', `Could not verify: ${error.message}`);
  }
}

async function generateReport() {
  console.log('\n=== VERIFICATION SUMMARY ===\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`\nSuccess Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n=== FAILED TESTS ===\n');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => console.log(`❌ [${r.category}] ${r.testName}: ${r.details}`));
  }

  if (warnings > 0) {
    console.log('\n=== WARNINGS ===\n');
    results
      .filter(r => r.status === 'WARNING')
      .forEach(r => console.log(`⚠️  [${r.category}] ${r.testName}: ${r.details}`));
  }

  console.log('\n=== DEPLOYMENT RECOMMENDATION ===\n');

  const criticalFailures = results.filter(
    r => r.status === 'FAIL' &&
    (r.testName.includes('BUG-001') || r.testName.includes('BUG-002'))
  );

  if (failed === 0) {
    console.log('✅ RECOMMENDATION: READY FOR PRODUCTION DEPLOYMENT');
    console.log('   All verification tests passed.');
    console.log('   The PO Approval Workflow feature is fully deployed and operational.');
  } else if (criticalFailures.length > 0) {
    console.log('❌ RECOMMENDATION: DEPLOYMENT BLOCKED');
    console.log('   Critical bugs found (missing database columns).');
    console.log('   Fix critical issues before deploying to production.');
  } else if (failed <= 2) {
    console.log('⚠️  RECOMMENDATION: READY FOR STAGING DEPLOYMENT');
    console.log('   Minor issues found. Deploy to staging for testing.');
    console.log('   Address failures before production deployment.');
  } else {
    console.log('❌ RECOMMENDATION: NOT READY FOR DEPLOYMENT');
    console.log('   Multiple verification tests failed.');
    console.log('   Review and fix all failures before deploying.');
  }

  console.log('\n=== NEXT STEPS ===\n');
  console.log('1. Review failed tests and warnings above');
  console.log('2. Fix any critical issues (BUG-001, BUG-002)');
  console.log('3. Re-run this verification script');
  console.log('4. Deploy to staging environment');
  console.log('5. Conduct end-to-end testing');
  console.log('6. Deploy to production');
}

async function main() {
  console.log('========================================');
  console.log('PO APPROVAL WORKFLOW - DEPLOYMENT VERIFICATION');
  console.log('REQ: REQ-STRATEGIC-AUTO-1735409486000');
  console.log('Agent: Berry (DevOps Specialist)');
  console.log('Date: 2024-12-28');
  console.log('========================================');

  try {
    await verifyDatabaseSchema();
    await verifyBackendFiles();
    await verifyFrontendFiles();
    await verifyDeploymentReadiness();
    await verifySampleData();
    await generateReport();
  } catch (error: any) {
    console.error('\n❌ VERIFICATION FAILED:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }

  // Exit with error code if any tests failed
  const failed = results.filter(r => r.status === 'FAIL').length;
  process.exit(failed > 0 ? 1 : 0);
}

main();
