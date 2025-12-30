/**
 * Sales Quote Automation Verification Script
 * REQ-STRATEGIC-AUTO-1766911112767
 *
 * Verifies that the Sales Quote Automation system is properly deployed
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'agog_erp',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres'
});

interface VerificationResult {
  category: string;
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
}

async function verify(): Promise<void> {
  const results: VerificationResult[] = [];
  const client = await pool.connect();

  try {
    console.log('='.repeat(60));
    console.log('SALES QUOTE AUTOMATION VERIFICATION');
    console.log('REQ-STRATEGIC-AUTO-1766911112767');
    console.log('='.repeat(60));
    console.log('');

    // 1. Check database tables
    console.log('1. Checking Database Tables...');
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('quotes', 'quote_lines', 'pricing_rules', 'customer_pricing')
      ORDER BY table_name
    `);

    const expectedTables = ['customer_pricing', 'pricing_rules', 'quote_lines', 'quotes'];
    const foundTables = tableCheck.rows.map(r => r.table_name);

    for (const table of expectedTables) {
      if (foundTables.includes(table)) {
        results.push({
          category: 'Database',
          check: `Table: ${table}`,
          status: 'PASS',
          details: 'Table exists'
        });
      } else {
        results.push({
          category: 'Database',
          check: `Table: ${table}`,
          status: 'FAIL',
          details: 'Table not found'
        });
      }
    }

    // 2. Check RLS policies
    console.log('2. Checking Row-Level Security Policies...');
    const rlsCheck = await client.query(`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('quotes', 'quote_lines', 'pricing_rules', 'customer_pricing')
    `);

    if (rlsCheck.rowCount && rlsCheck.rowCount >= 4) {
      results.push({
        category: 'Security',
        check: 'RLS Policies',
        status: 'PASS',
        details: `${rlsCheck.rowCount} policies found`
      });
    } else {
      results.push({
        category: 'Security',
        check: 'RLS Policies',
        status: 'WARN',
        details: `Only ${rlsCheck.rowCount || 0} policies found (expected 4+)`
      });
    }

    // 3. Check quote_lines schema
    console.log('3. Checking Quote Lines Schema...');
    const columnsCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'quote_lines'
        AND column_name IN (
          'id', 'tenant_id', 'quote_id', 'line_number', 'product_id',
          'quantity_quoted', 'unit_price', 'line_amount', 'discount_percentage',
          'discount_amount', 'unit_cost', 'line_cost', 'line_margin', 'margin_percentage'
        )
      ORDER BY column_name
    `);

    if (columnsCheck.rowCount && columnsCheck.rowCount >= 14) {
      results.push({
        category: 'Schema',
        check: 'Quote Lines Columns',
        status: 'PASS',
        details: `${columnsCheck.rowCount} key columns found`
      });
    } else {
      results.push({
        category: 'Schema',
        check: 'Quote Lines Columns',
        status: 'FAIL',
        details: `Only ${columnsCheck.rowCount || 0} columns found (expected 14+)`
      });
    }

    // 4. Check pricing_rules schema
    console.log('4. Checking Pricing Rules Schema...');
    const pricingRulesCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pricing_rules'
        AND column_name IN (
          'id', 'tenant_id', 'rule_code', 'rule_name', 'rule_type',
          'priority', 'conditions', 'pricing_action', 'action_value',
          'effective_from', 'effective_to', 'is_active'
        )
      ORDER BY column_name
    `);

    if (pricingRulesCheck.rowCount && pricingRulesCheck.rowCount >= 12) {
      results.push({
        category: 'Schema',
        check: 'Pricing Rules Columns',
        status: 'PASS',
        details: `${pricingRulesCheck.rowCount} key columns found`
      });
    } else {
      results.push({
        category: 'Schema',
        check: 'Pricing Rules Columns',
        status: 'FAIL',
        details: `Only ${pricingRulesCheck.rowCount || 0} columns found (expected 12+)`
      });
    }

    // 5. Check indexes
    console.log('5. Checking Database Indexes...');
    const indexCheck = await client.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('quotes', 'quote_lines', 'pricing_rules', 'customer_pricing')
    `);

    if (indexCheck.rowCount && indexCheck.rowCount >= 8) {
      results.push({
        category: 'Performance',
        check: 'Database Indexes',
        status: 'PASS',
        details: `${indexCheck.rowCount} indexes found`
      });
    } else {
      results.push({
        category: 'Performance',
        check: 'Database Indexes',
        status: 'WARN',
        details: `Only ${indexCheck.rowCount || 0} indexes found (expected 8+)`
      });
    }

    // 6. Test quote creation (if tables exist)
    if (foundTables.includes('quotes') && foundTables.includes('quote_lines')) {
      console.log('6. Testing Quote Creation...');
      try {
        // This is just a schema test - we won't actually insert
        const createQuoteTest = await client.query(`
          SELECT
            column_name,
            is_nullable,
            data_type
          FROM information_schema.columns
          WHERE table_name = 'quotes'
            AND column_name IN ('tenant_id', 'customer_id', 'quote_date')
        `);

        if (createQuoteTest.rowCount === 3) {
          results.push({
            category: 'Functionality',
            check: 'Quote Creation Schema',
            status: 'PASS',
            details: 'Required fields present'
          });
        } else {
          results.push({
            category: 'Functionality',
            check: 'Quote Creation Schema',
            status: 'FAIL',
            details: 'Missing required fields'
          });
        }
      } catch (error: any) {
        results.push({
          category: 'Functionality',
          check: 'Quote Creation Schema',
          status: 'FAIL',
          details: error.message
        });
      }
    }

    // Print results
    console.log('');
    console.log('='.repeat(60));
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(60));
    console.log('');

    const groupedResults: { [key: string]: VerificationResult[] } = {};
    results.forEach(result => {
      if (!groupedResults[result.category]) {
        groupedResults[result.category] = [];
      }
      groupedResults[result.category].push(result);
    });

    for (const [category, categoryResults] of Object.entries(groupedResults)) {
      console.log(`${category}:`);
      categoryResults.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
        console.log(`  ${icon} ${result.check}: ${result.details}`);
      });
      console.log('');
    }

    // Summary
    const passed = results.filter(r => r.status === 'PASS').length;
    const warned = results.filter(r => r.status === 'WARN').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Checks: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Warnings: ${warned}`);
    console.log(`Failed: ${failed}`);
    console.log('');

    if (failed === 0 && warned === 0) {
      console.log('✅ ALL CHECKS PASSED - Sales Quote Automation is fully deployed');
    } else if (failed === 0) {
      console.log('⚠️  PASSED WITH WARNINGS - Sales Quote Automation is functional');
    } else {
      console.log('❌ VERIFICATION FAILED - Some components are missing');
    }

    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ Verification failed with error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
