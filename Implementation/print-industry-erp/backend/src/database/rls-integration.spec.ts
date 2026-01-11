/**
 * Row-Level Security Integration Tests
 * REQ: REQ-1767508090235-mvcn3 - Multi-Tenant Row-Level Security Implementation
 *
 * These tests verify that RLS policies correctly isolate tenant data.
 * They run against a real PostgreSQL database (test environment).
 *
 * Prerequisites:
 * - Test database with all migrations applied
 * - Test tenants created
 * - RLS policies enabled
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DatabaseService } from './database.service';
import { DatabaseModule } from './database.module';
import { randomUUID } from 'crypto';

/**
 * NOTE: These are integration tests that require a real database.
 * They are skipped by default. To run:
 * 1. Start test database: docker-compose -f docker-compose.test.yml up -d
 * 2. Run tests: npm test -- rls-integration.spec.ts
 */
describe('RLS Integration Tests', () => {
  let module: TestingModule;
  let db: DatabaseService;
  let pool: Pool;

  const tenant1Id = randomUUID();
  const tenant2Id = randomUUID();
  const user1Id = randomUUID();
  const user2Id = randomUUID();

  beforeAll(async () => {
    // Skip if no test database configured
    if (!process.env.TEST_DATABASE_URL) {
      console.warn('⚠️  Skipping RLS integration tests - TEST_DATABASE_URL not set');
      return;
    }

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        DatabaseModule,
      ],
    }).compile();

    db = module.get<DatabaseService>(DatabaseService);
    pool = module.get<Pool>('DATABASE_POOL');

    // Create test tenants
    await setupTestData();
  });

  afterAll(async () => {
    if (module) {
      // Cleanup test data
      await cleanupTestData();
      await module.close();
    }
  });

  /**
   * Setup test tenants and facilities
   */
  async function setupTestData() {
    await db.querySystem(`
      INSERT INTO tenants (id, name, slug, subscription_tier, created_at)
      VALUES
        ($1, 'Test Tenant 1', 'test-tenant-1', 'ENTERPRISE', CURRENT_TIMESTAMP),
        ($2, 'Test Tenant 2', 'test-tenant-2', 'ENTERPRISE', CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `, [tenant1Id, tenant2Id]);

    await db.querySystem(`
      INSERT INTO facilities (id, tenant_id, name, code, created_at)
      VALUES
        (gen_random_uuid(), $1, 'Facility 1', 'FAC1', CURRENT_TIMESTAMP),
        (gen_random_uuid(), $2, 'Facility 2', 'FAC2', CURRENT_TIMESTAMP)
      ON CONFLICT DO NOTHING
    `, [tenant1Id, tenant2Id]);
  }

  /**
   * Cleanup test data
   */
  async function cleanupTestData() {
    await db.querySystem('DELETE FROM tenants WHERE id IN ($1, $2)', [tenant1Id, tenant2Id]);
  }

  describe('Invoice RLS Policies', () => {
    let invoice1Id: string;
    let invoice2Id: string;

    beforeEach(async () => {
      // Create test invoices for both tenants
      const facility1 = await db.querySystem(
        'SELECT id FROM facilities WHERE tenant_id = $1 LIMIT 1',
        [tenant1Id]
      );
      const facility2 = await db.querySystem(
        'SELECT id FROM facilities WHERE tenant_id = $1 LIMIT 1',
        [tenant2Id]
      );

      const result1 = await db.query(
        { tenantId: tenant1Id },
        `INSERT INTO invoices (
          id, tenant_id, facility_id, invoice_type, invoice_number,
          invoice_date, due_date, status, payment_status,
          currency_code, exchange_rate, total_amount, balance_due,
          created_by
        ) VALUES (
          gen_random_uuid(), $1, $2, 'AR', 'INV-001',
          CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'DRAFT', 'UNPAID',
          'USD', 1.0, 1000.00, 1000.00,
          'test-user'
        ) RETURNING id`,
        [tenant1Id, facility1.rows[0].id]
      );
      invoice1Id = result1.rows[0].id;

      const result2 = await db.query(
        { tenantId: tenant2Id },
        `INSERT INTO invoices (
          id, tenant_id, facility_id, invoice_type, invoice_number,
          invoice_date, due_date, status, payment_status,
          currency_code, exchange_rate, total_amount, balance_due,
          created_by
        ) VALUES (
          gen_random_uuid(), $1, $2, 'AR', 'INV-002',
          CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'DRAFT', 'UNPAID',
          'USD', 1.0, 2000.00, 2000.00,
          'test-user'
        ) RETURNING id`,
        [tenant2Id, facility2.rows[0].id]
      );
      invoice2Id = result2.rows[0].id;
    });

    afterEach(async () => {
      // Cleanup invoices
      await db.querySystem('DELETE FROM invoices WHERE id IN ($1, $2)', [invoice1Id, invoice2Id]);
    });

    it('should only return invoices for current tenant', async () => {
      // Query as tenant1
      const result1 = await db.query(
        { tenantId: tenant1Id },
        'SELECT id, tenant_id FROM invoices ORDER BY created_at DESC'
      );

      // Should only see tenant1's invoice
      expect(result1.rows).toHaveLength(1);
      expect(result1.rows[0].id).toBe(invoice1Id);
      expect(result1.rows[0].tenant_id).toBe(tenant1Id);

      // Query as tenant2
      const result2 = await db.query(
        { tenantId: tenant2Id },
        'SELECT id, tenant_id FROM invoices ORDER BY created_at DESC'
      );

      // Should only see tenant2's invoice
      expect(result2.rows).toHaveLength(1);
      expect(result2.rows[0].id).toBe(invoice2Id);
      expect(result2.rows[0].tenant_id).toBe(tenant2Id);
    });

    it('should not allow reading other tenant data by ID', async () => {
      // Try to read tenant2's invoice as tenant1
      const result = await db.query(
        { tenantId: tenant1Id },
        'SELECT * FROM invoices WHERE id = $1',
        [invoice2Id]
      );

      // Should return no rows
      expect(result.rows).toHaveLength(0);
    });

    it('should not allow updating other tenant data', async () => {
      // Try to update tenant2's invoice as tenant1
      const result = await db.query(
        { tenantId: tenant1Id },
        'UPDATE invoices SET status = $1 WHERE id = $2',
        ['POSTED', invoice2Id]
      );

      // Should affect 0 rows
      expect(result.rowCount).toBe(0);

      // Verify invoice wasn't updated
      const checkResult = await db.query(
        { tenantId: tenant2Id },
        'SELECT status FROM invoices WHERE id = $1',
        [invoice2Id]
      );
      expect(checkResult.rows[0].status).toBe('DRAFT');
    });

    it('should not allow deleting other tenant data', async () => {
      // Try to delete tenant2's invoice as tenant1
      const result = await db.query(
        { tenantId: tenant1Id },
        'DELETE FROM invoices WHERE id = $1',
        [invoice2Id]
      );

      // Should affect 0 rows
      expect(result.rowCount).toBe(0);

      // Verify invoice still exists
      const checkResult = await db.query(
        { tenantId: tenant2Id },
        'SELECT id FROM invoices WHERE id = $1',
        [invoice2Id]
      );
      expect(checkResult.rows).toHaveLength(1);
    });

    it('should not allow inserting data for other tenant', async () => {
      const facility2 = await db.querySystem(
        'SELECT id FROM facilities WHERE tenant_id = $1 LIMIT 1',
        [tenant2Id]
      );

      // Try to insert invoice for tenant2 as tenant1
      await expect(
        db.query(
          { tenantId: tenant1Id },
          `INSERT INTO invoices (
            id, tenant_id, facility_id, invoice_type, invoice_number,
            invoice_date, due_date, status, payment_status,
            currency_code, exchange_rate, total_amount, balance_due,
            created_by
          ) VALUES (
            gen_random_uuid(), $1, $2, 'AR', 'INV-EVIL',
            CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'DRAFT', 'UNPAID',
            'USD', 1.0, 9999.00, 9999.00,
            'evil-user'
          )`,
          [tenant2Id, facility2.rows[0].id]
        )
      ).rejects.toThrow(); // Should fail RLS WITH CHECK policy
    });
  });

  describe('API Keys RLS Policies', () => {
    let apiKey1Id: string;
    let apiKey2Id: string;

    beforeEach(async () => {
      // Create API keys for both tenants
      const result1 = await db.query(
        { tenantId: tenant1Id },
        `INSERT INTO api_keys (
          id, tenant_id, key_hash, key_prefix, name,
          scopes, created_by
        ) VALUES (
          gen_random_uuid(), $1, 'hash1', 'ak_test_1', 'Test Key 1',
          ARRAY['read:invoices'], 'test-user'
        ) RETURNING id`,
        [tenant1Id]
      );
      apiKey1Id = result1.rows[0].id;

      const result2 = await db.query(
        { tenantId: tenant2Id },
        `INSERT INTO api_keys (
          id, tenant_id, key_hash, key_prefix, name,
          scopes, created_by
        ) VALUES (
          gen_random_uuid(), $1, 'hash2', 'ak_test_2', 'Test Key 2',
          ARRAY['read:invoices'], 'test-user'
        ) RETURNING id`,
        [tenant2Id]
      );
      apiKey2Id = result2.rows[0].id;
    });

    afterEach(async () => {
      await db.querySystem('DELETE FROM api_keys WHERE id IN ($1, $2)', [apiKey1Id, apiKey2Id]);
    });

    it('should only return API keys for current tenant', async () => {
      const result = await db.query(
        { tenantId: tenant1Id },
        'SELECT id, tenant_id FROM api_keys'
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(apiKey1Id);
    });

    it('should not allow accessing other tenant API keys', async () => {
      const result = await db.query(
        { tenantId: tenant1Id },
        'SELECT * FROM api_keys WHERE id = $1',
        [apiKey2Id]
      );

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Notification Templates RLS Policies', () => {
    let template1Id: string;
    let template2Id: string;
    let systemTemplateId: string;

    beforeEach(async () => {
      // Create notification type
      await db.querySystem(`
        INSERT INTO notification_types (id, code, name, default_channel)
        VALUES (gen_random_uuid(), 'TEST_NOTIFICATION', 'Test Notification', 'EMAIL')
        ON CONFLICT (code) DO NOTHING
      `);

      const notifType = await db.querySystem(
        "SELECT id FROM notification_types WHERE code = 'TEST_NOTIFICATION'"
      );
      const typeId = notifType.rows[0].id;

      // Create tenant-specific templates
      const result1 = await db.query(
        { tenantId: tenant1Id },
        `INSERT INTO notification_templates (
          id, tenant_id, notification_type_id, channel, body_template
        ) VALUES (
          gen_random_uuid(), $1, $2, 'EMAIL', 'Tenant 1 template'
        ) RETURNING id`,
        [tenant1Id, typeId]
      );
      template1Id = result1.rows[0].id;

      const result2 = await db.query(
        { tenantId: tenant2Id },
        `INSERT INTO notification_templates (
          id, tenant_id, notification_type_id, channel, body_template
        ) VALUES (
          gen_random_uuid(), $1, $2, 'EMAIL', 'Tenant 2 template'
        ) RETURNING id`,
        [tenant2Id, typeId]
      );
      template2Id = result2.rows[0].id;

      // Create system-wide template (NULL tenant_id)
      const result3 = await db.querySystem(
        `INSERT INTO notification_templates (
          id, tenant_id, notification_type_id, channel, body_template
        ) VALUES (
          gen_random_uuid(), NULL, $1, 'EMAIL', 'System template'
        ) RETURNING id`,
        [typeId]
      );
      systemTemplateId = result3.rows[0].id;
    });

    afterEach(async () => {
      await db.querySystem(
        'DELETE FROM notification_templates WHERE id IN ($1, $2, $3)',
        [template1Id, template2Id, systemTemplateId]
      );
    });

    it('should return both system and tenant templates', async () => {
      const result = await db.query(
        { tenantId: tenant1Id },
        'SELECT id, tenant_id FROM notification_templates ORDER BY created_at'
      );

      // Should see system template + tenant1's template
      expect(result.rows.length).toBeGreaterThanOrEqual(2);

      const ids = result.rows.map(r => r.id);
      expect(ids).toContain(template1Id); // Tenant 1's template
      expect(ids).toContain(systemTemplateId); // System template
      expect(ids).not.toContain(template2Id); // Not tenant 2's template
    });

    it('should not allow creating system templates from tenant context', async () => {
      const notifType = await db.querySystem(
        "SELECT id FROM notification_types WHERE code = 'TEST_NOTIFICATION'"
      );

      // Try to create system template (tenant_id = NULL) as tenant
      await expect(
        db.query(
          { tenantId: tenant1Id },
          `INSERT INTO notification_templates (
            id, tenant_id, notification_type_id, channel, body_template
          ) VALUES (
            gen_random_uuid(), NULL, $1, 'EMAIL', 'Fake system template'
          )`,
          [notifType.rows[0].id]
        )
      ).rejects.toThrow(); // Should fail RLS WITH CHECK policy
    });
  });

  describe('Transaction Isolation', () => {
    it('should maintain tenant context across transaction', async () => {
      const facility = await db.querySystem(
        'SELECT id FROM facilities WHERE tenant_id = $1 LIMIT 1',
        [tenant1Id]
      );

      const result = await db.transaction(
        { tenantId: tenant1Id },
        async (client) => {
          // Insert invoice
          const invoiceResult = await client.query(
            `INSERT INTO invoices (
              id, tenant_id, facility_id, invoice_type, invoice_number,
              invoice_date, due_date, status, payment_status,
              currency_code, exchange_rate, total_amount, balance_due,
              created_by
            ) VALUES (
              gen_random_uuid(), $1, $2, 'AR', 'INV-TXN',
              CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'DRAFT', 'UNPAID',
              'USD', 1.0, 500.00, 500.00,
              'test-user'
            ) RETURNING id`,
            [tenant1Id, facility.rows[0].id]
          );

          // Query should only see own invoice
          const queryResult = await client.query(
            'SELECT COUNT(*) as count FROM invoices'
          );

          return {
            invoiceId: invoiceResult.rows[0].id,
            count: parseInt(queryResult.rows[0].count),
          };
        }
      );

      expect(result.invoiceId).toBeDefined();
      expect(result.count).toBeGreaterThanOrEqual(1);

      // Cleanup
      await db.querySystem('DELETE FROM invoices WHERE id = $1', [result.invoiceId]);
    });
  });
});
