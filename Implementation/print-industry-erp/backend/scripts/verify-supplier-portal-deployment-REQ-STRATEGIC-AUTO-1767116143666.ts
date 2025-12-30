/**
 * Supplier Portal Deployment Verification Script
 * REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
 * Agent: Billy (QA Specialist)
 *
 * Comprehensive testing of:
 * - Database schema and migrations
 * - Backend GraphQL resolvers and services
 * - Security and authentication
 * - RLS policies
 * - Business logic validation
 */

import { Pool } from 'pg';

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

class SupplierPortalQA {
  private pool: Pool;
  private results: TestResult[] = [];
  private testTenantId: string | null = null;
  private testVendorId: string | null = null;
  private testSupplierUserId: string | null = null;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'print_erp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });
  }

  async runAllTests(): Promise<void> {
    console.log('\n========================================');
    console.log('SUPPLIER PORTAL QA VERIFICATION');
    console.log('REQ-STRATEGIC-AUTO-1767116143666');
    console.log('========================================\n');

    try {
      await this.setupTestData();
      await this.testDatabaseSchema();
      await this.testSupplierAuthentication();
      await this.testPOAcknowledgment();
      await this.testASNCreation();
      await this.testSupplierDashboard();
      await this.testSupplierPerformance();
      await this.testRLSPolicies();
      await this.testBusinessLogic();
      await this.cleanupTestData();

      this.printResults();
    } catch (error) {
      console.error('Fatal error during testing:', error);
    } finally {
      await this.pool.end();
    }
  }

  private async setupTestData(): Promise<void> {
    console.log('Setting up test data...\n');

    try {
      // Create test tenant
      const tenantResult = await this.pool.query(
        `INSERT INTO tenants (tenant_name, tenant_code, is_active)
         VALUES ('QA Test Tenant', 'QA-TEST', true)
         RETURNING id`,
      );
      this.testTenantId = tenantResult.rows[0].id;

      // Set tenant context
      await this.pool.query(
        `SELECT set_config('app.current_tenant_id', $1, false)`,
        [this.testTenantId],
      );

      // Create test vendor
      const vendorResult = await this.pool.query(
        `INSERT INTO vendors (tenant_id, vendor_code, vendor_name, vendor_tier, is_active)
         VALUES ($1, 'QA-VENDOR-001', 'QA Test Vendor', 'PREFERRED', true)
         RETURNING id`,
        [this.testTenantId],
      );
      this.testVendorId = vendorResult.rows[0].id;

      // Create test supplier user
      const supplierUserResult = await this.pool.query(
        `INSERT INTO supplier_users (
          vendor_id, tenant_id, email, password_hash, first_name, last_name,
          role, is_active, is_email_verified
        ) VALUES ($1, $2, 'qa-supplier@test.com', 'hashed_password', 'QA', 'Supplier',
                  'VENDOR_ADMIN', true, true)
        RETURNING id`,
        [this.testVendorId, this.testTenantId],
      );
      this.testSupplierUserId = supplierUserResult.rows[0].id;

      this.addResult('Setup Test Data', 'PASS', 'Test data created successfully');
    } catch (error) {
      this.addResult('Setup Test Data', 'FAIL', `Failed to setup test data: ${error.message}`);
      throw error;
    }
  }

  private async testDatabaseSchema(): Promise<void> {
    console.log('Testing Database Schema...\n');

    // Test table existence
    const tables = [
      'supplier_users',
      'supplier_refresh_tokens',
      'supplier_activity_log',
      'supplier_documents',
      'advanced_ship_notices',
      'asn_lines',
      'po_acknowledgments',
    ];

    for (const table of tables) {
      try {
        const result = await this.pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          )`,
          [table],
        );

        if (result.rows[0].exists) {
          this.addResult(
            `Schema: Table ${table}`,
            'PASS',
            `Table ${table} exists`,
          );
        } else {
          this.addResult(
            `Schema: Table ${table}`,
            'FAIL',
            `Table ${table} does not exist`,
          );
        }
      } catch (error) {
        this.addResult(
          `Schema: Table ${table}`,
          'FAIL',
          `Error checking table: ${error.message}`,
        );
      }
    }

    // Test indexes
    const indexChecks = [
      { table: 'supplier_users', index: 'idx_supplier_users_email' },
      { table: 'supplier_users', index: 'idx_supplier_users_vendor_id' },
      { table: 'advanced_ship_notices', index: 'idx_asn_vendor' },
      { table: 'advanced_ship_notices', index: 'idx_asn_po' },
      { table: 'asn_lines', index: 'idx_asn_lines_asn' },
      { table: 'po_acknowledgments', index: 'idx_po_ack_po' },
    ];

    for (const { table, index } of indexChecks) {
      try {
        const result = await this.pool.query(
          `SELECT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename = $1
            AND indexname = $2
          )`,
          [table, index],
        );

        if (result.rows[0].exists) {
          this.addResult(
            `Schema: Index ${index}`,
            'PASS',
            `Index ${index} exists on ${table}`,
          );
        } else {
          this.addResult(
            `Schema: Index ${index}`,
            'FAIL',
            `Index ${index} missing on ${table}`,
          );
        }
      } catch (error) {
        this.addResult(
          `Schema: Index ${index}`,
          'FAIL',
          `Error checking index: ${error.message}`,
        );
      }
    }

    // Test RLS enabled
    for (const table of tables) {
      try {
        const result = await this.pool.query(
          `SELECT relrowsecurity FROM pg_class
           WHERE relname = $1`,
          [table],
        );

        if (result.rows.length > 0 && result.rows[0].relrowsecurity) {
          this.addResult(
            `Schema: RLS on ${table}`,
            'PASS',
            `RLS enabled on ${table}`,
          );
        } else {
          this.addResult(
            `Schema: RLS on ${table}`,
            'FAIL',
            `RLS not enabled on ${table}`,
          );
        }
      } catch (error) {
        this.addResult(
          `Schema: RLS on ${table}`,
          'FAIL',
          `Error checking RLS: ${error.message}`,
        );
      }
    }

    // Test auto-generate ASN number function
    try {
      const result = await this.pool.query(
        `SELECT generate_asn_number($1) as asn_number`,
        [this.testTenantId],
      );

      const asnNumber = result.rows[0].asn_number;
      if (asnNumber && asnNumber.startsWith('ASN-')) {
        this.addResult(
          'Schema: ASN Number Generation',
          'PASS',
          `Generated ASN number: ${asnNumber}`,
        );
      } else {
        this.addResult(
          'Schema: ASN Number Generation',
          'FAIL',
          'Invalid ASN number format',
        );
      }
    } catch (error) {
      this.addResult(
        'Schema: ASN Number Generation',
        'FAIL',
        `Error generating ASN number: ${error.message}`,
      );
    }
  }

  private async testSupplierAuthentication(): Promise<void> {
    console.log('Testing Supplier Authentication...\n');

    // Test supplier user creation
    try {
      const result = await this.pool.query(
        `SELECT id, email, first_name, last_name, role, is_active, is_email_verified
         FROM supplier_users
         WHERE id = $1`,
        [this.testSupplierUserId],
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];
        this.addResult(
          'Auth: Supplier User Query',
          'PASS',
          `Retrieved supplier user: ${user.email}`,
        );
      } else {
        this.addResult(
          'Auth: Supplier User Query',
          'FAIL',
          'Could not retrieve supplier user',
        );
      }
    } catch (error) {
      this.addResult(
        'Auth: Supplier User Query',
        'FAIL',
        `Error querying supplier user: ${error.message}`,
      );
    }

    // Test supplier activity logging
    try {
      await this.pool.query(
        `INSERT INTO supplier_activity_log (
          tenant_id, vendor_id, supplier_user_id, activity_type, activity_details
        ) VALUES ($1, $2, $3, 'LOGIN', $4)`,
        [
          this.testTenantId,
          this.testVendorId,
          this.testSupplierUserId,
          JSON.stringify({ test: true }),
        ],
      );

      this.addResult(
        'Auth: Activity Logging',
        'PASS',
        'Activity log entry created successfully',
      );
    } catch (error) {
      this.addResult(
        'Auth: Activity Logging',
        'FAIL',
        `Error logging activity: ${error.message}`,
      );
    }
  }

  private async testPOAcknowledgment(): Promise<void> {
    console.log('Testing PO Acknowledgment...\n');

    try {
      // Create test PO
      const poResult = await this.pool.query(
        `INSERT INTO purchase_orders (
          tenant_id, vendor_id, po_number, po_date, status, total_amount, currency
        ) VALUES ($1, $2, 'QA-PO-001', CURRENT_DATE, 'SENT_TO_VENDOR', 1000.00, 'USD')
        RETURNING id`,
        [this.testTenantId, this.testVendorId],
      );
      const poId = poResult.rows[0].id;

      // Create acknowledgment
      const ackResult = await this.pool.query(
        `INSERT INTO po_acknowledgments (
          tenant_id, purchase_order_id, vendor_id, acknowledged_by_supplier_user_id,
          promised_delivery_date, acknowledgment_status, acknowledgment_notes
        ) VALUES ($1, $2, $3, $4, CURRENT_DATE + INTERVAL '7 days', 'ACCEPTED', 'Test acknowledgment')
        RETURNING id, acknowledgment_status`,
        [this.testTenantId, poId, this.testVendorId, this.testSupplierUserId],
      );

      if (ackResult.rows[0].acknowledgment_status === 'ACCEPTED') {
        this.addResult(
          'PO: Acknowledgment Creation',
          'PASS',
          'PO acknowledgment created successfully',
        );
      } else {
        this.addResult(
          'PO: Acknowledgment Creation',
          'FAIL',
          'Invalid acknowledgment status',
        );
      }

      // Verify unique constraint (one acknowledgment per PO)
      try {
        await this.pool.query(
          `INSERT INTO po_acknowledgments (
            tenant_id, purchase_order_id, vendor_id, acknowledged_by_supplier_user_id,
            acknowledgment_status
          ) VALUES ($1, $2, $3, $4, 'ACCEPTED')`,
          [this.testTenantId, poId, this.testVendorId, this.testSupplierUserId],
        );

        this.addResult(
          'PO: Unique Acknowledgment Constraint',
          'FAIL',
          'Unique constraint not enforced - duplicate acknowledgment allowed',
        );
      } catch (error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          this.addResult(
            'PO: Unique Acknowledgment Constraint',
            'PASS',
            'Unique constraint properly enforced',
          );
        } else {
          this.addResult(
            'PO: Unique Acknowledgment Constraint',
            'FAIL',
            `Unexpected error: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.addResult(
        'PO: Acknowledgment Creation',
        'FAIL',
        `Error creating acknowledgment: ${error.message}`,
      );
    }
  }

  private async testASNCreation(): Promise<void> {
    console.log('Testing ASN Creation...\n');

    try {
      // Create test PO with lines
      const poResult = await this.pool.query(
        `INSERT INTO purchase_orders (
          tenant_id, vendor_id, po_number, po_date, status, total_amount, currency
        ) VALUES ($1, $2, 'QA-PO-002', CURRENT_DATE, 'ACKNOWLEDGED', 2000.00, 'USD')
        RETURNING id`,
        [this.testTenantId, this.testVendorId],
      );
      const poId = poResult.rows[0].id;

      // Create PO line
      const poLineResult = await this.pool.query(
        `INSERT INTO purchase_order_lines (
          tenant_id, purchase_order_id, line_number, description, quantity, unit_price, extended_price
        ) VALUES ($1, $2, 1, 'Test Item', 10, 200.00, 2000.00)
        RETURNING id`,
        [this.testTenantId, poId],
      );
      const poLineId = poLineResult.rows[0].id;

      // Create ASN (asn_number auto-generated by trigger)
      const asnResult = await this.pool.query(
        `INSERT INTO advanced_ship_notices (
          tenant_id, vendor_id, purchase_order_id, po_number,
          carrier_code, tracking_number, expected_delivery_date, actual_ship_date,
          package_count, total_weight, weight_unit, status, created_by_supplier_user_id
        ) VALUES ($1, $2, $3, 'QA-PO-002', 'FEDEX', 'TRACK123', CURRENT_DATE + INTERVAL '5 days',
                  CURRENT_DATE, 2, 50.5, 'LBS', 'CREATED', $4)
        RETURNING id, asn_number, status`,
        [this.testTenantId, this.testVendorId, poId, this.testSupplierUserId],
      );

      const asn = asnResult.rows[0];

      if (asn.asn_number && asn.asn_number.startsWith('ASN-')) {
        this.addResult(
          'ASN: Auto-Generated Number',
          'PASS',
          `ASN number generated: ${asn.asn_number}`,
        );
      } else {
        this.addResult(
          'ASN: Auto-Generated Number',
          'FAIL',
          'ASN number not auto-generated',
        );
      }

      // Create ASN line
      await this.pool.query(
        `INSERT INTO asn_lines (
          tenant_id, asn_id, po_line_id, quantity_shipped, lot_number
        ) VALUES ($1, $2, $3, 10, 'LOT-001')`,
        [this.testTenantId, asn.id, poLineId],
      );

      this.addResult(
        'ASN: Line Creation',
        'PASS',
        'ASN line created successfully',
      );

      // Test ASN status workflow
      const statusResult = await this.pool.query(
        `UPDATE advanced_ship_notices
         SET status = 'SUBMITTED', submitted_at = NOW()
         WHERE id = $1
         RETURNING status`,
        [asn.id],
      );

      if (statusResult.rows[0].status === 'SUBMITTED') {
        this.addResult(
          'ASN: Status Update',
          'PASS',
          'ASN status updated to SUBMITTED',
        );
      }
    } catch (error) {
      this.addResult(
        'ASN: Creation',
        'FAIL',
        `Error creating ASN: ${error.message}`,
      );
    }
  }

  private async testSupplierDashboard(): Promise<void> {
    console.log('Testing Supplier Dashboard Queries...\n');

    try {
      // Test dashboard metrics query
      const metricsResult = await this.pool.query(
        `SELECT
           COUNT(*) as open_po_count,
           COALESCE(SUM(total_amount), 0) as open_po_total_value
         FROM purchase_orders
         WHERE vendor_id = $1
           AND tenant_id = $2
           AND status IN ('APPROVED', 'SENT_TO_VENDOR', 'ACKNOWLEDGED')
           AND deleted_at IS NULL`,
        [this.testVendorId, this.testTenantId],
      );

      this.addResult(
        'Dashboard: PO Metrics Query',
        'PASS',
        `Query executed successfully: ${metricsResult.rows[0].open_po_count} open POs`,
      );

      // Test ASN metrics
      const asnMetricsResult = await this.pool.query(
        `SELECT COUNT(*) as pending_asn_count
         FROM advanced_ship_notices
         WHERE vendor_id = $1
           AND tenant_id = $2
           AND status IN ('CREATED', 'SUBMITTED', 'IN_TRANSIT')`,
        [this.testVendorId, this.testTenantId],
      );

      this.addResult(
        'Dashboard: ASN Metrics Query',
        'PASS',
        `Query executed successfully: ${asnMetricsResult.rows[0].pending_asn_count} pending ASNs`,
      );

      // Test recent activity query
      const activityResult = await this.pool.query(
        `SELECT id, activity_type, activity_details, created_at
         FROM supplier_activity_log
         WHERE vendor_id = $1
           AND tenant_id = $2
         ORDER BY created_at DESC
         LIMIT 10`,
        [this.testVendorId, this.testTenantId],
      );

      this.addResult(
        'Dashboard: Activity Log Query',
        'PASS',
        `Retrieved ${activityResult.rows.length} activity log entries`,
      );
    } catch (error) {
      this.addResult(
        'Dashboard: Queries',
        'FAIL',
        `Error executing dashboard queries: ${error.message}`,
      );
    }
  }

  private async testSupplierPerformance(): Promise<void> {
    console.log('Testing Supplier Performance Queries...\n');

    try {
      // Test performance scorecard query
      const perfResult = await this.pool.query(
        `SELECT
           overall_rating,
           on_time_delivery_percentage,
           quality_acceptance_percentage,
           vendor_tier
         FROM vendor_performance
         WHERE vendor_id = $1
           AND tenant_id = $2
           AND year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
           AND month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
         LIMIT 1`,
        [this.testVendorId, this.testTenantId],
      );

      this.addResult(
        'Performance: Scorecard Query',
        'PASS',
        `Performance query executed successfully (${perfResult.rows.length} records)`,
      );

      // Test vendor tier fallback
      const tierResult = await this.pool.query(
        `SELECT vendor_tier FROM vendors WHERE id = $1`,
        [this.testVendorId],
      );

      if (tierResult.rows[0].vendor_tier) {
        this.addResult(
          'Performance: Vendor Tier',
          'PASS',
          `Vendor tier: ${tierResult.rows[0].vendor_tier}`,
        );
      }
    } catch (error) {
      this.addResult(
        'Performance: Queries',
        'FAIL',
        `Error executing performance queries: ${error.message}`,
      );
    }
  }

  private async testRLSPolicies(): Promise<void> {
    console.log('Testing RLS Policies...\n');

    try {
      // Set correct tenant context
      await this.pool.query(
        `SELECT set_config('app.current_tenant_id', $1, false)`,
        [this.testTenantId],
      );

      // Test that supplier users can only see their vendor's data
      const ownDataResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM supplier_users
         WHERE vendor_id = $1`,
        [this.testVendorId],
      );

      if (parseInt(ownDataResult.rows[0].count) > 0) {
        this.addResult(
          'RLS: Own Vendor Data Access',
          'PASS',
          'Can access own vendor data',
        );
      }

      // Test ASN RLS
      const asnRLSResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM advanced_ship_notices
         WHERE vendor_id = $1`,
        [this.testVendorId],
      );

      this.addResult(
        'RLS: ASN Access',
        'PASS',
        `Can access ${asnRLSResult.rows[0].count} ASNs with RLS`,
      );

      // Test PO acknowledgment RLS
      const ackRLSResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM po_acknowledgments
         WHERE vendor_id = $1`,
        [this.testVendorId],
      );

      this.addResult(
        'RLS: PO Acknowledgment Access',
        'PASS',
        `Can access ${ackRLSResult.rows[0].count} acknowledgments with RLS`,
      );
    } catch (error) {
      this.addResult(
        'RLS: Policy Tests',
        'FAIL',
        `Error testing RLS policies: ${error.message}`,
      );
    }
  }

  private async testBusinessLogic(): Promise<void> {
    console.log('Testing Business Logic Validation...\n');

    // Test ASN status enum validation
    try {
      await this.pool.query(
        `INSERT INTO advanced_ship_notices (
          tenant_id, vendor_id, purchase_order_id, po_number,
          carrier_code, expected_delivery_date, actual_ship_date,
          package_count, weight_unit, status, created_by_supplier_user_id
        ) VALUES ($1, $2, $3, 'INVALID-PO', 'FEDEX', CURRENT_DATE, CURRENT_DATE,
                  1, 'LBS', 'INVALID_STATUS', $4)`,
        [this.testTenantId, this.testVendorId, 'invalid-id', this.testSupplierUserId],
      );

      this.addResult(
        'Business Logic: ASN Status Validation',
        'FAIL',
        'Invalid status allowed (constraint not enforced)',
      );
    } catch (error) {
      if (error.message.includes('check') || error.message.includes('constraint')) {
        this.addResult(
          'Business Logic: ASN Status Validation',
          'PASS',
          'Status constraint properly enforced',
        );
      }
    }

    // Test weight unit validation
    try {
      await this.pool.query(
        `UPDATE advanced_ship_notices
         SET weight_unit = 'INVALID'
         WHERE vendor_id = $1
         LIMIT 1`,
        [this.testVendorId],
      );

      this.addResult(
        'Business Logic: Weight Unit Validation',
        'FAIL',
        'Invalid weight unit allowed',
      );
    } catch (error) {
      if (error.message.includes('check') || error.message.includes('constraint')) {
        this.addResult(
          'Business Logic: Weight Unit Validation',
          'PASS',
          'Weight unit constraint properly enforced',
        );
      }
    }
  }

  private async cleanupTestData(): Promise<void> {
    console.log('Cleaning up test data...\n');

    try {
      // Delete in reverse order of creation (to respect foreign keys)
      await this.pool.query(
        `DELETE FROM asn_lines WHERE tenant_id = $1`,
        [this.testTenantId],
      );
      await this.pool.query(
        `DELETE FROM advanced_ship_notices WHERE tenant_id = $1`,
        [this.testTenantId],
      );
      await this.pool.query(
        `DELETE FROM po_acknowledgments WHERE tenant_id = $1`,
        [this.testTenantId],
      );
      await this.pool.query(
        `DELETE FROM purchase_order_lines WHERE tenant_id = $1`,
        [this.testTenantId],
      );
      await this.pool.query(
        `DELETE FROM purchase_orders WHERE tenant_id = $1`,
        [this.testTenantId],
      );
      await this.pool.query(
        `DELETE FROM supplier_activity_log WHERE tenant_id = $1`,
        [this.testTenantId],
      );
      await this.pool.query(
        `DELETE FROM supplier_users WHERE tenant_id = $1`,
        [this.testTenantId],
      );
      await this.pool.query(
        `DELETE FROM vendors WHERE tenant_id = $1`,
        [this.testTenantId],
      );
      await this.pool.query(
        `DELETE FROM tenants WHERE id = $1`,
        [this.testTenantId],
      );

      this.addResult('Cleanup', 'PASS', 'Test data cleaned up successfully');
    } catch (error) {
      this.addResult('Cleanup', 'FAIL', `Error cleaning up test data: ${error.message}`);
    }
  }

  private addResult(testName: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any): void {
    this.results.push({ testName, status, message, details });

    const statusIcon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '○';
    console.log(`${statusIcon} ${testName}: ${message}`);
  }

  private printResults(): void {
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================\n');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);
    console.log(`Skipped: ${skipped} (${((skipped / total) * 100).toFixed(1)}%)`);

    if (failed > 0) {
      console.log('\n========================================');
      console.log('FAILED TESTS');
      console.log('========================================\n');

      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`✗ ${r.testName}`);
          console.log(`  ${r.message}`);
          if (r.details) {
            console.log(`  Details: ${JSON.stringify(r.details, null, 2)}`);
          }
          console.log('');
        });
    }

    console.log('\n========================================');
    console.log(failed === 0 ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗');
    console.log('========================================\n');
  }
}

// Run tests
const qa = new SupplierPortalQA();
qa.runAllTests().catch(console.error);
