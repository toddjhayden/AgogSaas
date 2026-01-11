/**
 * Smoke Test Service
 * Core service for running automated smoke tests
 * REQ: REQ-STRATEGIC-AUTO-1767045901874 - Deployment Health Verification & Smoke Tests
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export interface SmokeTestResult {
  testName: string;
  category: string;
  status: 'PASS' | 'FAIL';
  duration: number;
  message: string;
  error?: string;
  critical: boolean;
}

export interface SmokeTestReport {
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  criticalFailed: number;
  duration: number;
  results: SmokeTestResult[];
  overallStatus: 'ALL_PASSED' | 'SOME_FAILED' | 'CRITICAL_FAILED';
}

@Injectable()
export class SmokeTestService {
  constructor(
    @Inject('DATABASE_POOL') private readonly pool: Pool,
  ) {}

  /**
   * Run all smoke tests
   */
  async runAllTests(): Promise<SmokeTestReport> {
    const startTime = Date.now();
    const results: SmokeTestResult[] = [];

    // Database smoke tests
    results.push(...await this.runDatabaseTests());

    // Feature smoke tests
    results.push(...await this.runFeatureTests());

    // Integration smoke tests
    results.push(...await this.runIntegrationTests());

    const duration = Date.now() - startTime;
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const criticalFailed = results.filter(r => r.status === 'FAIL' && r.critical).length;

    let overallStatus: 'ALL_PASSED' | 'SOME_FAILED' | 'CRITICAL_FAILED';
    if (criticalFailed > 0) {
      overallStatus = 'CRITICAL_FAILED';
    } else if (failed > 0) {
      overallStatus = 'SOME_FAILED';
    } else {
      overallStatus = 'ALL_PASSED';
    }

    return {
      timestamp: new Date(),
      totalTests: results.length,
      passed,
      failed,
      criticalFailed,
      duration,
      results,
      overallStatus,
    };
  }

  /**
   * Run critical smoke tests only
   */
  async runCriticalTests(): Promise<SmokeTestReport> {
    const startTime = Date.now();
    const results: SmokeTestResult[] = [];

    // Critical database tests
    results.push(await this.testDatabaseConnection());
    results.push(await this.testCriticalTablesExist());

    // Critical feature tests
    results.push(await this.testBinUtilizationQuery());
    results.push(await this.testForecastingQuery());
    results.push(await this.testQuoteAutomationQuery());

    const duration = Date.now() - startTime;
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const criticalFailed = results.filter(r => r.status === 'FAIL' && r.critical).length;

    return {
      timestamp: new Date(),
      totalTests: results.length,
      passed,
      failed,
      criticalFailed,
      duration,
      results,
      overallStatus: failed > 0 ? 'CRITICAL_FAILED' : 'ALL_PASSED',
    };
  }

  /**
   * Run database smoke tests
   */
  private async runDatabaseTests(): Promise<SmokeTestResult[]> {
    return [
      await this.testDatabaseConnection(),
      await this.testCriticalTablesExist(),
      await this.testDatabaseExtensions(),
      await this.testRLSPolicies(),
    ];
  }

  /**
   * Run feature smoke tests
   */
  private async runFeatureTests(): Promise<SmokeTestResult[]> {
    return [
      await this.testBinUtilizationQuery(),
      await this.testForecastingQuery(),
      await this.testQuoteAutomationQuery(),
      await this.testVendorScorecardsQuery(),
      await this.testPurchaseOrdersQuery(),
    ];
  }

  /**
   * Run integration smoke tests
   */
  private async runIntegrationTests(): Promise<SmokeTestResult[]> {
    return [
      await this.testMaterialDataIntegrity(),
      await this.testTenantIsolation(),
    ];
  }

  // ========================================
  // Database Smoke Tests
  // ========================================

  private async testDatabaseConnection(): Promise<SmokeTestResult> {
    const start = Date.now();
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      return {
        testName: 'Database Connection',
        category: 'Database',
        status: 'PASS',
        duration: Date.now() - start,
        message: 'Database connection successful',
        critical: true,
      };
    } catch (error) {
      return {
        testName: 'Database Connection',
        category: 'Database',
        status: 'FAIL',
        duration: Date.now() - start,
        message: 'Database connection failed',
        error: (error instanceof Error ? error.message : String(error)),
        critical: true,
      };
    }
  }

  private async testCriticalTablesExist(): Promise<SmokeTestResult> {
    const start = Date.now();
    const criticalTables = [
      'tenants',
      'users',
      'facilities',
      'materials',
      'bins',
      'bin_utilization_olap',
      'demand_history',
      'material_forecasts',
      'quote_configurations',
      'purchase_orders',
    ];

    try {
      const result = await this.pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ANY($1)
      `, [criticalTables]);

      const foundTables = result.rows.map(r => r.table_name);
      const missingTables = criticalTables.filter(t => !foundTables.includes(t));

      if (missingTables.length === 0) {
        return {
          testName: 'Critical Tables Exist',
          category: 'Database',
          status: 'PASS',
          duration: Date.now() - start,
          message: `All ${criticalTables.length} critical tables exist`,
          critical: true,
        };
      } else {
        return {
          testName: 'Critical Tables Exist',
          category: 'Database',
          status: 'FAIL',
          duration: Date.now() - start,
          message: `Missing tables: ${missingTables.join(', ')}`,
          critical: true,
        };
      }
    } catch (error) {
      return {
        testName: 'Critical Tables Exist',
        category: 'Database',
        status: 'FAIL',
        duration: Date.now() - start,
        message: 'Failed to check tables',
        error: (error instanceof Error ? error.message : String(error)),
        critical: true,
      };
    }
  }

  private async testDatabaseExtensions(): Promise<SmokeTestResult> {
    const start = Date.now();
    const requiredExtensions = ['uuid-ossp', 'pgcrypto', 'pg_trgm'];

    try {
      const result = await this.pool.query(`
        SELECT extname
        FROM pg_extension
        WHERE extname = ANY($1)
      `, [requiredExtensions]);

      const foundExtensions = result.rows.map(r => r.extname);
      const missingExtensions = requiredExtensions.filter(e => !foundExtensions.includes(e));

      if (missingExtensions.length === 0) {
        return {
          testName: 'Database Extensions',
          category: 'Database',
          status: 'PASS',
          duration: Date.now() - start,
          message: `All required extensions installed`,
          critical: false,
        };
      } else {
        return {
          testName: 'Database Extensions',
          category: 'Database',
          status: 'FAIL',
          duration: Date.now() - start,
          message: `Missing extensions: ${missingExtensions.join(', ')}`,
          critical: false,
        };
      }
    } catch (error) {
      return {
        testName: 'Database Extensions',
        category: 'Database',
        status: 'FAIL',
        duration: Date.now() - start,
        message: 'Failed to check extensions',
        error: (error instanceof Error ? error.message : String(error)),
        critical: false,
      };
    }
  }

  private async testRLSPolicies(): Promise<SmokeTestResult> {
    const start = Date.now();

    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as policy_count
        FROM pg_policies
      `);

      const policyCount = parseInt(result.rows[0].policy_count);

      if (policyCount > 0) {
        return {
          testName: 'RLS Policies',
          category: 'Database',
          status: 'PASS',
          duration: Date.now() - start,
          message: `${policyCount} RLS policies active`,
          critical: false,
        };
      } else {
        return {
          testName: 'RLS Policies',
          category: 'Database',
          status: 'FAIL',
          duration: Date.now() - start,
          message: 'No RLS policies found',
          critical: false,
        };
      }
    } catch (error) {
      return {
        testName: 'RLS Policies',
        category: 'Database',
        status: 'FAIL',
        duration: Date.now() - start,
        message: 'Failed to check RLS policies',
        error: (error instanceof Error ? error.message : String(error)),
        critical: false,
      };
    }
  }

  // ========================================
  // Feature Smoke Tests
  // ========================================

  private async testBinUtilizationQuery(): Promise<SmokeTestResult> {
    const start = Date.now();

    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as bin_count
        FROM bins
        LIMIT 1
      `);

      return {
        testName: 'Bin Utilization Query',
        category: 'WMS',
        status: 'PASS',
        duration: Date.now() - start,
        message: 'Bin utilization query successful',
        critical: true,
      };
    } catch (error) {
      return {
        testName: 'Bin Utilization Query',
        category: 'WMS',
        status: 'FAIL',
        duration: Date.now() - start,
        message: 'Bin utilization query failed',
        error: (error instanceof Error ? error.message : String(error)),
        critical: true,
      };
    }
  }

  private async testForecastingQuery(): Promise<SmokeTestResult> {
    const start = Date.now();

    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as forecast_count
        FROM material_forecasts
        LIMIT 1
      `);

      return {
        testName: 'Forecasting Query',
        category: 'Forecasting',
        status: 'PASS',
        duration: Date.now() - start,
        message: 'Forecasting query successful',
        critical: true,
      };
    } catch (error) {
      return {
        testName: 'Forecasting Query',
        category: 'Forecasting',
        status: 'FAIL',
        duration: Date.now() - start,
        message: 'Forecasting query failed',
        error: (error instanceof Error ? error.message : String(error)),
        critical: true,
      };
    }
  }

  private async testQuoteAutomationQuery(): Promise<SmokeTestResult> {
    const start = Date.now();

    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as quote_count
        FROM quote_configurations
        LIMIT 1
      `);

      return {
        testName: 'Quote Automation Query',
        category: 'Sales',
        status: 'PASS',
        duration: Date.now() - start,
        message: 'Quote automation query successful',
        critical: true,
      };
    } catch (error) {
      return {
        testName: 'Quote Automation Query',
        category: 'Sales',
        status: 'FAIL',
        duration: Date.now() - start,
        message: 'Quote automation query failed',
        error: (error instanceof Error ? error.message : String(error)),
        critical: true,
      };
    }
  }

  private async testVendorScorecardsQuery(): Promise<SmokeTestResult> {
    const start = Date.now();

    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as vendor_count
        FROM vendors
        LIMIT 1
      `);

      return {
        testName: 'Vendor Scorecards Query',
        category: 'Procurement',
        status: 'PASS',
        duration: Date.now() - start,
        message: 'Vendor scorecards query successful',
        critical: false,
      };
    } catch (error) {
      return {
        testName: 'Vendor Scorecards Query',
        category: 'Procurement',
        status: 'FAIL',
        duration: Date.now() - start,
        message: 'Vendor scorecards query failed',
        error: (error instanceof Error ? error.message : String(error)),
        critical: false,
      };
    }
  }

  private async testPurchaseOrdersQuery(): Promise<SmokeTestResult> {
    const start = Date.now();

    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as po_count
        FROM purchase_orders
        LIMIT 1
      `);

      return {
        testName: 'Purchase Orders Query',
        category: 'Procurement',
        status: 'PASS',
        duration: Date.now() - start,
        message: 'Purchase orders query successful',
        critical: false,
      };
    } catch (error) {
      return {
        testName: 'Purchase Orders Query',
        category: 'Procurement',
        status: 'FAIL',
        duration: Date.now() - start,
        message: 'Purchase orders query failed',
        error: (error instanceof Error ? error.message : String(error)),
        critical: false,
      };
    }
  }

  // ========================================
  // Integration Smoke Tests
  // ========================================

  private async testMaterialDataIntegrity(): Promise<SmokeTestResult> {
    const start = Date.now();

    try {
      // Check for orphaned records
      const result = await this.pool.query(`
        SELECT
          (SELECT COUNT(*) FROM bins WHERE material_id NOT IN (SELECT material_id FROM materials)) as orphaned_bins,
          (SELECT COUNT(*) FROM demand_history WHERE material_id NOT IN (SELECT material_id FROM materials)) as orphaned_demand
      `);

      const orphanedBins = parseInt(result.rows[0].orphaned_bins);
      const orphanedDemand = parseInt(result.rows[0].orphaned_demand);

      if (orphanedBins === 0 && orphanedDemand === 0) {
        return {
          testName: 'Material Data Integrity',
          category: 'Integration',
          status: 'PASS',
          duration: Date.now() - start,
          message: 'No orphaned material references',
          critical: false,
        };
      } else {
        return {
          testName: 'Material Data Integrity',
          category: 'Integration',
          status: 'FAIL',
          duration: Date.now() - start,
          message: `Found ${orphanedBins} orphaned bins, ${orphanedDemand} orphaned demand records`,
          critical: false,
        };
      }
    } catch (error) {
      return {
        testName: 'Material Data Integrity',
        category: 'Integration',
        status: 'FAIL',
        duration: Date.now() - start,
        message: 'Failed to check data integrity',
        error: (error instanceof Error ? error.message : String(error)),
        critical: false,
      };
    }
  }

  private async testTenantIsolation(): Promise<SmokeTestResult> {
    const start = Date.now();

    try {
      // Verify tenant_id columns exist on critical tables
      const result = await this.pool.query(`
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_name = 'tenant_id'
        AND table_name IN ('materials', 'bins', 'facilities', 'purchase_orders', 'demand_history')
        GROUP BY table_name
      `);

      const tablesWithTenantId = result.rows.map(r => r.table_name);

      if (tablesWithTenantId.length >= 4) {
        return {
          testName: 'Tenant Isolation',
          category: 'Integration',
          status: 'PASS',
          duration: Date.now() - start,
          message: `${tablesWithTenantId.length} tables have tenant_id column`,
          critical: false,
        };
      } else {
        return {
          testName: 'Tenant Isolation',
          category: 'Integration',
          status: 'FAIL',
          duration: Date.now() - start,
          message: `Only ${tablesWithTenantId.length} tables have tenant_id column`,
          critical: false,
        };
      }
    } catch (error) {
      return {
        testName: 'Tenant Isolation',
        category: 'Integration',
        status: 'FAIL',
        duration: Date.now() - start,
        message: 'Failed to check tenant isolation',
        error: (error instanceof Error ? error.message : String(error)),
        critical: false,
      };
    }
  }
}
