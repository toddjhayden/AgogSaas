/**
 * Sales Quote Automation Deployment Verification Script
 * REQ-STRATEGIC-AUTO-1766627757384
 *
 * Verifies that the Sales Quote Automation system is properly deployed:
 * - Database schema and RLS policies
 * - NestJS services and dependency injection
 * - GraphQL schema and resolvers
 * - Integration with existing modules
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface VerificationResult {
  category: string;
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

function logResult(result: VerificationResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
  console.log(`${icon} [${result.status}] ${result.category} - ${result.check}: ${result.message}`);
  if (result.details) {
    console.log(`  Details:`, result.details);
  }
}

async function verifyDatabase(pool: Pool) {
  console.log('\n=== DATABASE VERIFICATION ===\n');

  // Check quotes table exists
  try {
    const quotesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'quotes'
      ) as exists
    `);

    logResult({
      category: 'Database',
      check: 'Quotes Table',
      status: quotesCheck.rows[0].exists ? 'PASS' : 'FAIL',
      message: quotesCheck.rows[0].exists ? 'quotes table exists' : 'quotes table not found',
    });
  } catch (error) {
    logResult({
      category: 'Database',
      check: 'Quotes Table',
      status: 'FAIL',
      message: `Error checking quotes table: ${error.message}`,
    });
  }

  // Check quote_lines table exists
  try {
    const quoteLinesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'quote_lines'
      ) as exists
    `);

    logResult({
      category: 'Database',
      check: 'Quote Lines Table',
      status: quoteLinesCheck.rows[0].exists ? 'PASS' : 'FAIL',
      message: quoteLinesCheck.rows[0].exists ? 'quote_lines table exists' : 'quote_lines table not found',
    });
  } catch (error) {
    logResult({
      category: 'Database',
      check: 'Quote Lines Table',
      status: 'FAIL',
      message: `Error checking quote_lines table: ${error.message}`,
    });
  }

  // Check pricing_rules table exists
  try {
    const pricingRulesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'pricing_rules'
      ) as exists
    `);

    logResult({
      category: 'Database',
      check: 'Pricing Rules Table',
      status: pricingRulesCheck.rows[0].exists ? 'PASS' : 'FAIL',
      message: pricingRulesCheck.rows[0].exists ? 'pricing_rules table exists' : 'pricing_rules table not found',
    });
  } catch (error) {
    logResult({
      category: 'Database',
      check: 'Pricing Rules Table',
      status: 'FAIL',
      message: `Error checking pricing_rules table: ${error.message}`,
    });
  }

  // Check customer_pricing table exists
  try {
    const customerPricingCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'customer_pricing'
      ) as exists
    `);

    logResult({
      category: 'Database',
      check: 'Customer Pricing Table',
      status: customerPricingCheck.rows[0].exists ? 'PASS' : 'FAIL',
      message: customerPricingCheck.rows[0].exists ? 'customer_pricing table exists' : 'customer_pricing table not found',
    });
  } catch (error) {
    logResult({
      category: 'Database',
      check: 'Customer Pricing Table',
      status: 'FAIL',
      message: `Error checking customer_pricing table: ${error.message}`,
    });
  }

  // Check RLS policies
  try {
    const rlsCheck = await pool.query(`
      SELECT
        schemaname,
        tablename,
        policyname
      FROM pg_policies
      WHERE tablename IN ('quotes', 'quote_lines', 'pricing_rules', 'customer_pricing')
      ORDER BY tablename, policyname
    `);

    const expectedPolicies = ['quotes', 'quote_lines', 'pricing_rules', 'customer_pricing'];
    const foundTables = new Set(rlsCheck.rows.map(r => r.tablename));
    const missingPolicies = expectedPolicies.filter(t => !foundTables.has(t));

    logResult({
      category: 'Security',
      check: 'RLS Policies',
      status: missingPolicies.length === 0 ? 'PASS' : 'FAIL',
      message: missingPolicies.length === 0
        ? `All RLS policies in place (${rlsCheck.rows.length} policies)`
        : `Missing RLS policies for: ${missingPolicies.join(', ')}`,
      details: rlsCheck.rows,
    });
  } catch (error) {
    logResult({
      category: 'Security',
      check: 'RLS Policies',
      status: 'FAIL',
      message: `Error checking RLS policies: ${error.message}`,
    });
  }

  // Check indexes
  try {
    const indexCheck = await pool.query(`
      SELECT
        tablename,
        indexname
      FROM pg_indexes
      WHERE tablename IN ('quotes', 'quote_lines', 'pricing_rules', 'customer_pricing')
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);

    logResult({
      category: 'Performance',
      check: 'Database Indexes',
      status: indexCheck.rows.length >= 8 ? 'PASS' : 'WARN',
      message: `Found ${indexCheck.rows.length} indexes`,
      details: indexCheck.rows.map(r => `${r.tablename}.${r.indexname}`),
    });
  } catch (error) {
    logResult({
      category: 'Performance',
      check: 'Database Indexes',
      status: 'WARN',
      message: `Error checking indexes: ${error.message}`,
    });
  }

  // Check foreign key constraints
  try {
    const fkCheck = await pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('quotes', 'quote_lines', 'pricing_rules', 'customer_pricing')
      ORDER BY tc.table_name, tc.constraint_name
    `);

    logResult({
      category: 'Database',
      check: 'Foreign Key Constraints',
      status: fkCheck.rows.length >= 4 ? 'PASS' : 'WARN',
      message: `Found ${fkCheck.rows.length} foreign key constraints`,
      details: fkCheck.rows.map(r => `${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}`),
    });
  } catch (error) {
    logResult({
      category: 'Database',
      check: 'Foreign Key Constraints',
      status: 'WARN',
      message: `Error checking foreign keys: ${error.message}`,
    });
  }
}

async function verifyServices() {
  console.log('\n=== SERVICE VERIFICATION ===\n');

  // Check if service files exist
  const fs = require('fs');
  const path = require('path');

  const serviceFiles = [
    'src/modules/sales/services/quote-management.service.ts',
    'src/modules/sales/services/quote-pricing.service.ts',
    'src/modules/sales/services/pricing-rule-engine.service.ts',
    'src/modules/sales/services/quote-costing.service.ts',
  ];

  serviceFiles.forEach((file) => {
    const filePath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(filePath);

    logResult({
      category: 'Services',
      check: path.basename(file),
      status: exists ? 'PASS' : 'FAIL',
      message: exists ? 'Service file exists' : 'Service file not found',
    });

    if (exists) {
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for @Injectable decorator
      const hasInjectable = content.includes('@Injectable()');
      logResult({
        category: 'NestJS',
        check: `${path.basename(file)} - DI`,
        status: hasInjectable ? 'PASS' : 'FAIL',
        message: hasInjectable ? '@Injectable() decorator present' : '@Injectable() decorator missing',
      });

      // Check for manual 'new' instantiation (anti-pattern)
      const hasManualNew = /= new \w+Service\(/.test(content);
      logResult({
        category: 'NestJS',
        check: `${path.basename(file)} - DI Pattern`,
        status: hasManualNew ? 'WARN' : 'PASS',
        message: hasManualNew
          ? 'Manual service instantiation detected (should use DI)'
          : 'No manual service instantiation',
      });
    }
  });

  // Check SalesModule
  const salesModulePath = path.join(__dirname, '..', 'src/modules/sales/sales.module.ts');
  if (fs.existsSync(salesModulePath)) {
    const content = fs.readFileSync(salesModulePath, 'utf8');

    const hasQuoteManagement = content.includes('QuoteManagementService');
    const hasQuotePricing = content.includes('QuotePricingService');
    const hasPricingRuleEngine = content.includes('PricingRuleEngineService');
    const hasQuoteCosting = content.includes('QuoteCostingService');

    logResult({
      category: 'NestJS Module',
      check: 'SalesModule Providers',
      status: hasQuoteManagement && hasQuotePricing && hasPricingRuleEngine && hasQuoteCosting ? 'PASS' : 'FAIL',
      message: `Services registered: ${[
        hasQuoteManagement && 'QuoteManagement',
        hasQuotePricing && 'QuotePricing',
        hasPricingRuleEngine && 'PricingRuleEngine',
        hasQuoteCosting && 'QuoteCosting',
      ]
        .filter(Boolean)
        .join(', ')}`,
    });
  } else {
    logResult({
      category: 'NestJS Module',
      check: 'SalesModule',
      status: 'FAIL',
      message: 'SalesModule file not found',
    });
  }
}

async function verifyGraphQL() {
  console.log('\n=== GRAPHQL VERIFICATION ===\n');

  const fs = require('fs');
  const path = require('path');

  // Check GraphQL schema file
  const schemaPath = path.join(__dirname, '..', 'src/graphql/schema/sales-quote-automation.graphql');
  if (fs.existsSync(schemaPath)) {
    const content = fs.readFileSync(schemaPath, 'utf8');

    const mutations = [
      'addQuoteLine',
      'updateQuoteLine',
      'deleteQuoteLine',
      'recalculateQuote',
      'validateQuoteMargin',
    ];

    mutations.forEach((mutation) => {
      const hasMutation = content.includes(mutation);
      logResult({
        category: 'GraphQL Schema',
        check: `Mutation: ${mutation}`,
        status: hasMutation ? 'PASS' : 'WARN',
        message: hasMutation ? 'Mutation defined' : 'Mutation not found in schema',
      });
    });

    const queries = ['previewQuoteLinePricing', 'previewProductCost'];

    queries.forEach((query) => {
      const hasQuery = content.includes(query);
      logResult({
        category: 'GraphQL Schema',
        check: `Query: ${query}`,
        status: hasQuery ? 'PASS' : 'WARN',
        message: hasQuery ? 'Query defined' : 'Query not found in schema',
      });
    });
  } else {
    logResult({
      category: 'GraphQL Schema',
      check: 'sales-quote-automation.graphql',
      status: 'FAIL',
      message: 'GraphQL schema file not found',
    });
  }

  // Check resolver
  const resolverPath = path.join(__dirname, '..', 'src/graphql/resolvers/quote-automation.resolver.ts');
  if (fs.existsSync(resolverPath)) {
    const content = fs.readFileSync(resolverPath, 'utf8');

    const hasResolver = content.includes('@Resolver');
    logResult({
      category: 'GraphQL Resolver',
      check: 'QuoteAutomationResolver',
      status: hasResolver ? 'PASS' : 'FAIL',
      message: hasResolver ? '@Resolver decorator present' : 'Resolver not properly decorated',
    });

    // Check for proper DI in resolver
    const hasManualNew = /= new \w+Service\(/.test(content);
    logResult({
      category: 'GraphQL Resolver',
      check: 'Resolver DI Pattern',
      status: hasManualNew ? 'WARN' : 'PASS',
      message: hasManualNew
        ? 'Manual service instantiation detected (should use DI)'
        : 'No manual service instantiation',
    });
  } else {
    logResult({
      category: 'GraphQL Resolver',
      check: 'quote-automation.resolver.ts',
      status: 'FAIL',
      message: 'Resolver file not found',
    });
  }
}

async function verifyTests() {
  console.log('\n=== TEST VERIFICATION ===\n');

  const fs = require('fs');
  const path = require('path');

  const testFiles = [
    'src/modules/sales/__tests__/pricing-rule-engine.service.test.ts',
  ];

  testFiles.forEach((file) => {
    const filePath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(filePath);

    logResult({
      category: 'Tests',
      check: path.basename(file),
      status: exists ? 'PASS' : 'WARN',
      message: exists ? 'Test file exists' : 'Test file not found',
    });
  });
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   SALES QUOTE AUTOMATION - DEPLOYMENT VERIFICATION            ║');
  console.log('║   REQ-STRATEGIC-AUTO-1766627757384                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await verifyDatabase(pool);
    await verifyServices();
    await verifyGraphQL();
    await verifyTests();

    // Generate summary
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   VERIFICATION SUMMARY                                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const warned = results.filter((r) => r.status === 'WARN').length;
    const total = results.length;

    console.log(`Total Checks: ${total}`);
    console.log(`✓ Passed: ${passed}`);
    console.log(`✗ Failed: ${failed}`);
    console.log(`⚠ Warnings: ${warned}`);

    const passRate = ((passed / total) * 100).toFixed(1);
    console.log(`\nPass Rate: ${passRate}%`);

    if (failed === 0) {
      console.log('\n✅ DEPLOYMENT VERIFICATION PASSED');
      console.log('\nSales Quote Automation is ready for production deployment.');
      process.exit(0);
    } else {
      console.log('\n❌ DEPLOYMENT VERIFICATION FAILED');
      console.log(`\nPlease address ${failed} failing check(s) before deployment.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ VERIFICATION ERROR:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
