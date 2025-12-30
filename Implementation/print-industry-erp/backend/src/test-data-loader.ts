/**
 * P2 Forecasting Test Data Loader
 * Run via backend API to bypass psql authentication issues
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class TestDataLoader {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async loadP2TestData(): Promise<{ success: boolean; message: string; recordsCreated: number }> {
    const client = await this.pool.connect();

    try {
      console.log('Starting P2 test data load...');

      // Define test IDs
      const testTenantId = '018d0001-0000-7000-8000-000000000001';
      const testFacilityId = '018d0001-0001-7000-8000-000000000001';
      const testMaterial1Id = '018d0001-0002-7000-8000-000000000001';
      const testMaterial2Id = '018d0001-0003-7000-8000-000000000001';
      const testMaterial3Id = '018d0001-0004-7000-8000-000000000001';

      // 1. Create test tenant
      await client.query(`
        INSERT INTO tenants (id, tenant_code, tenant_name, status)
        VALUES ($1::uuid, 'FCST001', 'Forecasting Test Tenant', 'ACTIVE')
        ON CONFLICT (id) DO NOTHING
      `, [testTenantId]);

      // 2. Create test facility
      await client.query(`
        INSERT INTO facilities (
          id, tenant_id, facility_code, facility_name, facility_type, timezone,
          address_line1, city, postal_code, country, is_active, is_manufacturing
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          'FCST-FAC001',
          'Forecasting Test Facility',
          'MANUFACTURING',
          'America/New_York',
          '123 Test St',
          'Test City',
          '12345',
          'USA',
          true,
          true
        )
        ON CONFLICT (id) DO NOTHING
      `, [testFacilityId, testTenantId]);

      // 3. Create test materials
      await client.query(`
        INSERT INTO materials (
          id, tenant_id, material_code, material_name, material_type,
          primary_uom, costing_method, is_lot_tracked, is_serialized,
          requires_inspection, fda_compliant, food_contact_approved, fsc_certified,
          is_active, is_purchasable, is_sellable, is_manufacturable
        )
        VALUES
          (
            $1::uuid, $4::uuid, 'MAT-FCST-001',
            'Test Material - Moving Average', 'RAW_MATERIAL',
            'EA', 'FIFO', false, false,
            false, false, false, false,
            true, true, false, false
          ),
          (
            $2::uuid, $4::uuid, 'MAT-FCST-002',
            'Test Material - Exponential Smoothing', 'RAW_MATERIAL',
            'EA', 'FIFO', false, false,
            false, false, false, false,
            true, true, false, false
          ),
          (
            $3::uuid, $4::uuid, 'MAT-FCST-003',
            'Test Material - Holt-Winters', 'RAW_MATERIAL',
            'EA', 'FIFO', false, false,
            false, false, false, false,
            true, true, false, false
          )
        ON CONFLICT (id) DO NOTHING
      `, [testMaterial1Id, testMaterial2Id, testMaterial3Id, testTenantId]);

      // 4. Load demand history for MAT-FCST-001 (90 days)
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
          $1::uuid,
          $2::uuid,
          $3::uuid,
          (CURRENT_DATE - n),
          EXTRACT(YEAR FROM (CURRENT_DATE - n))::INT,
          EXTRACT(MONTH FROM (CURRENT_DATE - n))::INT,
          EXTRACT(WEEK FROM (CURRENT_DATE - n))::INT,
          EXTRACT(DOW FROM (CURRENT_DATE - n))::INT,
          EXTRACT(QUARTER FROM (CURRENT_DATE - n))::INT,
          false,
          false,
          (95 + (random() * 10))::DECIMAL,
          'EA',
          (95 + (random() * 10))::DECIMAL,
          0::DECIMAL,
          0::DECIMAL,
          0::DECIMAL,
          false,
          CURRENT_TIMESTAMP
        FROM generate_series(1, 90) n
        WHERE NOT EXISTS (
          SELECT 1 FROM demand_history
          WHERE material_id = $3::uuid
          AND demand_date = (CURRENT_DATE - n)
        )
      `, [testTenantId, testFacilityId, testMaterial1Id]);

      // 5. Load demand history for MAT-FCST-002 (90 days - trending)
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
          $1::uuid,
          $2::uuid,
          $3::uuid,
          (CURRENT_DATE - n),
          EXTRACT(YEAR FROM (CURRENT_DATE - n))::INT,
          EXTRACT(MONTH FROM (CURRENT_DATE - n))::INT,
          EXTRACT(WEEK FROM (CURRENT_DATE - n))::INT,
          EXTRACT(DOW FROM (CURRENT_DATE - n))::INT,
          EXTRACT(QUARTER FROM (CURRENT_DATE - n))::INT,
          false,
          false,
          (80 + ((90 - n) * 0.44) + (random() * 5))::DECIMAL,
          'EA',
          (80 + ((90 - n) * 0.44) + (random() * 5))::DECIMAL,
          0::DECIMAL,
          0::DECIMAL,
          0::DECIMAL,
          false,
          CURRENT_TIMESTAMP
        FROM generate_series(1, 90) n
        WHERE NOT EXISTS (
          SELECT 1 FROM demand_history
          WHERE material_id = $3::uuid
          AND demand_date = (CURRENT_DATE - n)
        )
      `, [testTenantId, testFacilityId, testMaterial2Id]);

      // 6. Load demand history for MAT-FCST-003 (365 days - seasonal)
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
          $1::uuid,
          $2::uuid,
          $3::uuid,
          (CURRENT_DATE - n),
          EXTRACT(YEAR FROM (CURRENT_DATE - n))::INT,
          EXTRACT(MONTH FROM (CURRENT_DATE - n))::INT,
          EXTRACT(WEEK FROM (CURRENT_DATE - n))::INT,
          EXTRACT(DOW FROM (CURRENT_DATE - n))::INT,
          EXTRACT(QUARTER FROM (CURRENT_DATE - n))::INT,
          false,
          CASE WHEN n % 90 < 7 THEN true ELSE false END,
          (100 + (50 * SIN((n * 3.14159 / 90))))::DECIMAL,
          'EA',
          (100 + (50 * SIN((n * 3.14159 / 90))))::DECIMAL,
          0::DECIMAL,
          0::DECIMAL,
          0::DECIMAL,
          CASE WHEN n % 90 < 7 THEN true ELSE false END,
          CURRENT_TIMESTAMP
        FROM generate_series(1, 365) n
        WHERE NOT EXISTS (
          SELECT 1 FROM demand_history
          WHERE material_id = $3::uuid
          AND demand_date = (CURRENT_DATE - n)
        )
      `, [testTenantId, testFacilityId, testMaterial3Id]);

      // Verify data
      const result = await client.query(`
        SELECT
          m.material_code,
          COUNT(dh.demand_history_id) as record_count
        FROM materials m
        LEFT JOIN demand_history dh ON m.id = dh.material_id
        WHERE m.tenant_id = $1::uuid
        GROUP BY m.material_code
        ORDER BY m.material_code
      `, [testTenantId]);

      const totalRecords = result.rows.reduce((sum, row) => sum + parseInt(row.record_count), 0);

      return {
        success: true,
        message: `Test data loaded successfully. Created ${totalRecords} demand history records.`,
        recordsCreated: totalRecords
      };

    } catch (error) {
      console.error('Error loading test data:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
