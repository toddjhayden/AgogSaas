#!/usr/bin/env ts-node

/**
 * Load P2 Forecasting Test Data
 *
 * This script loads test data for P2 Inventory Forecasting testing.
 * It creates 3 test materials with different demand patterns:
 * - MAT-FCST-001: Stable demand (95-105 units/day) - 90 days
 * - MAT-FCST-002: Trending demand (80→120 units) - 90 days
 * - MAT-FCST-003: Seasonal demand (50-150 units) - 365 days
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://agogsaas_user:vhSczdyNPGiSF8arQKVUf5PXXIxtpgW+@localhost:5433/agogsaas';

async function loadTestData() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1,
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully\n');

    console.log('Creating test tenant...');
    await client.query(`
      INSERT INTO tenants (tenant_id, tenant_code, tenant_name, is_active)
      VALUES ('test-forecast-001', 'FCST001', 'Forecasting Test Tenant', true)
      ON CONFLICT (tenant_id) DO NOTHING
    `);
    console.log('✅ Test tenant created\n');

    console.log('Creating test facility...');
    await client.query(`
      INSERT INTO facilities (facility_id, tenant_id, facility_code, facility_name, facility_type, time_zone, is_active)
      VALUES (
        'facility-forecast-001',
        'test-forecast-001',
        'FCST-FAC001',
        'Forecasting Test Facility',
        'MANUFACTURING',
        'America/New_York',
        true
      )
      ON CONFLICT (facility_id) DO NOTHING
    `);
    console.log('✅ Test facility created\n');

    console.log('Creating test materials...');
    await client.query(`
      INSERT INTO materials (
        id, tenant_id, material_code, material_name, material_type,
        primary_uom, costing_method, is_lot_tracked, is_serialized,
        requires_inspection, fda_compliant, food_contact_approved, fsc_certified,
        is_active, is_purchasable, is_sellable, is_manufacturable,
        effective_from_date, is_current_version
      )
      VALUES
        (
          'material-fcst-001', 'test-forecast-001', 'MAT-FCST-001',
          'Test Material - Moving Average', 'RAW_MATERIAL',
          'EA', 'FIFO', false, false,
          false, false, false, false,
          true, true, false, false,
          CURRENT_DATE, true
        ),
        (
          'material-fcst-002', 'test-forecast-001', 'MAT-FCST-002',
          'Test Material - Exponential Smoothing', 'RAW_MATERIAL',
          'EA', 'FIFO', false, false,
          false, false, false, false,
          true, true, false, false,
          CURRENT_DATE, true
        ),
        (
          'material-fcst-003', 'test-forecast-001', 'MAT-FCST-003',
          'Test Material - Holt-Winters', 'RAW_MATERIAL',
          'EA', 'FIFO', false, false,
          false, false, false, false,
          true, true, false, false,
          CURRENT_DATE, true
        )
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ 3 test materials created\n');

    console.log('Loading demand history for MAT-FCST-001 (Moving Average - 90 days)...');
    await client.query(`
      INSERT INTO demand_history (
        demand_history_id, tenant_id, facility_id, material_id,
        demand_date, year, month, week_of_year, day_of_week, quarter,
        is_holiday, is_promotional_period,
        actual_demand_quantity, demand_uom,
        sales_order_demand, production_order_demand, transfer_order_demand, scrap_adjustment,
        marketing_campaign_active,
        created_at
      )
      SELECT
        uuid_generate_v7(),
        'test-forecast-001',
        'facility-forecast-001',
        'material-fcst-001',
        (CURRENT_DATE - n || ' days')::DATE,
        EXTRACT(YEAR FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(MONTH FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(WEEK FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(DOW FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(QUARTER FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        false,
        false,
        (95 + (random() * 10))::DECIMAL,
        'EA',
        (95 + (random() * 10))::DECIMAL,
        0,
        0,
        0,
        false,
        CURRENT_TIMESTAMP
      FROM generate_series(1, 90) n
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ 90 demand records created for MAT-FCST-001\n');

    console.log('Loading demand history for MAT-FCST-002 (Exp Smoothing - 90 days)...');
    await client.query(`
      INSERT INTO demand_history (
        demand_history_id, tenant_id, facility_id, material_id,
        demand_date, year, month, week_of_year, day_of_week, quarter,
        is_holiday, is_promotional_period,
        actual_demand_quantity, demand_uom,
        sales_order_demand, production_order_demand, transfer_order_demand, scrap_adjustment,
        marketing_campaign_active,
        created_at
      )
      SELECT
        uuid_generate_v7(),
        'test-forecast-001',
        'facility-forecast-001',
        'material-fcst-002',
        (CURRENT_DATE - n || ' days')::DATE,
        EXTRACT(YEAR FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(MONTH FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(WEEK FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(DOW FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(QUARTER FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        false,
        false,
        (80 + ((90 - n) * 0.44) + (random() * 5))::DECIMAL,
        'EA',
        (80 + ((90 - n) * 0.44) + (random() * 5))::DECIMAL,
        0,
        0,
        0,
        false,
        CURRENT_TIMESTAMP
      FROM generate_series(1, 90) n
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ 90 demand records created for MAT-FCST-002\n');

    console.log('Loading demand history for MAT-FCST-003 (Holt-Winters - 365 days)...');
    await client.query(`
      INSERT INTO demand_history (
        demand_history_id, tenant_id, facility_id, material_id,
        demand_date, year, month, week_of_year, day_of_week, quarter,
        is_holiday, is_promotional_period,
        actual_demand_quantity, demand_uom,
        sales_order_demand, production_order_demand, transfer_order_demand, scrap_adjustment,
        marketing_campaign_active,
        created_at
      )
      SELECT
        uuid_generate_v7(),
        'test-forecast-001',
        'facility-forecast-001',
        'material-fcst-003',
        (CURRENT_DATE - n || ' days')::DATE,
        EXTRACT(YEAR FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(MONTH FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(WEEK FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(DOW FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        EXTRACT(QUARTER FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
        false,
        CASE WHEN n % 90 < 7 THEN true ELSE false END,
        (100 + (50 * SIN((n * 3.14159 / 90))))::DECIMAL,
        'EA',
        (100 + (50 * SIN((n * 3.14159 / 90))))::DECIMAL,
        0,
        0,
        0,
        CASE WHEN n % 90 < 7 THEN true ELSE false END,
        CURRENT_TIMESTAMP
      FROM generate_series(1, 365) n
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ 365 demand records created for MAT-FCST-003\n');

    // Verify data loaded
    console.log('Verifying test data...');
    const result = await client.query(`
      SELECT
        m.material_code,
        m.material_name,
        COUNT(dh.demand_history_id) as demand_records,
        MIN(dh.demand_date) as earliest_date,
        MAX(dh.demand_date) as latest_date,
        ROUND(AVG(dh.actual_demand_quantity)::NUMERIC, 2) as avg_demand
      FROM materials m
      LEFT JOIN demand_history dh ON m.id = dh.material_id
      WHERE m.tenant_id = 'test-forecast-001'
      GROUP BY m.material_code, m.material_name
      ORDER BY m.material_code
    `);

    console.log('\n✅ Test Data Verification:');
    console.log('═'.repeat(100));
    console.log('Material Code    | Material Name                          | Records | Avg Demand');
    console.log('─'.repeat(100));
    result.rows.forEach(row => {
      console.log(
        `${row.material_code.padEnd(16)} | ${row.material_name.padEnd(38)} | ${String(row.demand_records).padStart(7)} | ${String(row.avg_demand).padStart(10)}`
      );
    });
    console.log('═'.repeat(100));

    const totalRecords = result.rows.reduce((sum, row) => sum + parseInt(row.demand_records), 0);
    console.log(`\nTotal demand history records: ${totalRecords}`);
    console.log('Expected: 545 records (90 + 90 + 365)');

    if (totalRecords === 545) {
      console.log('\n✅ TEST DATA LOADED SUCCESSFULLY!\n');
    } else {
      console.log(`\n⚠️  Warning: Expected 545 records but got ${totalRecords}\n`);
    }

    client.release();
    await pool.end();

  } catch (error) {
    console.error('\n❌ Error loading test data:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
loadTestData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
