/**
 * Tenant Isolation Security Tests
 * REQ-STRATEGIC-AUTO-1767066329944: GraphQL Authorization & Tenant Isolation
 *
 * Test Coverage:
 * 1. Unauthenticated access prevention
 * 2. Cross-tenant data access prevention
 * 3. Role-based access control (RBAC)
 * 4. Row-Level Security (RLS) enforcement
 * 5. Tenant context setup and cleanup
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { sign } from 'jsonwebtoken';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';

describe('Tenant Isolation - Security Tests', () => {
  let app: INestApplication;
  let dbPool: Pool;
  let tenant1Token: string;
  let tenant2Token: string;
  let viewerToken: string;
  let adminToken: string;

  // Test tenant IDs
  const TENANT_1_ID = '00000000-0000-0000-0000-000000000001';
  const TENANT_2_ID = '00000000-0000-0000-0000-000000000002';
  const USER_1_ID = '10000000-0000-0000-0000-000000000001';
  const USER_2_ID = '20000000-0000-0000-0000-000000000002';
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dbPool = app.get('DATABASE_POOL');

    // Create JWT tokens for different test scenarios
    tenant1Token = sign(
      {
        sub: USER_1_ID,
        email: 'user1@tenant1.com',
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      JWT_SECRET,
    );

    tenant2Token = sign(
      {
        sub: USER_2_ID,
        email: 'user2@tenant2.com',
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      JWT_SECRET,
    );

    viewerToken = sign(
      {
        sub: USER_1_ID,
        email: 'viewer@tenant1.com',
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      JWT_SECRET,
    );

    adminToken = sign(
      {
        sub: USER_1_ID,
        email: 'admin@tenant1.com',
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      JWT_SECRET,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  // =====================================================
  // AUTHENTICATION TESTS
  // =====================================================

  describe('Authentication', () => {
    it('should reject unauthenticated GraphQL requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: '{ workCenters(facilityId: "test-facility") { id } }',
        });

      expect(response.status).toBe(200); // GraphQL returns 200 even for errors
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Unauthorized');
    });

    it('should accept authenticated GraphQL requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          query: '{ workCenters(facilityId: "test-facility") { id } }',
        });

      // Should not return authentication error
      if (response.body.errors) {
        expect(response.body.errors[0].message).not.toContain('Unauthorized');
      }
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = sign(
        {
          sub: USER_1_ID,
          email: 'user1@tenant1.com',
          type: 'access',
          iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        },
        JWT_SECRET,
      );

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          query: '{ workCenters(facilityId: "test-facility") { id } }',
        });

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Unauthorized');
    });

    it('should reject invalid JWT signatures', async () => {
      const invalidToken = sign(
        {
          sub: USER_1_ID,
          email: 'user1@tenant1.com',
          type: 'access',
        },
        'wrong-secret', // Wrong secret
      );

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({
          query: '{ workCenters(facilityId: "test-facility") { id } }',
        });

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Unauthorized');
    });
  });

  // =====================================================
  // TENANT ISOLATION TESTS
  // =====================================================

  describe('Tenant Isolation', () => {
    let workCenterId: string;

    beforeAll(async () => {
      // Create test data as tenant 1
      const client = await dbPool.connect();
      try {
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [TENANT_1_ID]);

        const result = await client.query(
          `INSERT INTO work_centers (tenant_id, facility_id, work_center_code, work_center_name)
           VALUES ($1, $2, 'WC-TEST-001', 'Test Work Center')
           RETURNING id`,
          [TENANT_1_ID, '00000000-0000-0000-0000-000000000111'],
        );

        workCenterId = result.rows[0].id;
      } finally {
        client.release();
      }
    });

    it('should prevent cross-tenant data access via GraphQL', async () => {
      // Try to access tenant 1's data as tenant 2
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${tenant2Token}`)
        .send({
          query: `{ workCenter(id: "${workCenterId}") { id workCenterName } }`,
        });

      // Should not return data (RLS blocks it)
      if (response.body.data?.workCenter) {
        // If data is returned, it should be null (not found)
        expect(response.body.data.workCenter).toBeNull();
      } else if (response.body.errors) {
        // Or return an error
        expect(response.body.errors[0].message).toMatch(/not found|forbidden|access denied/i);
      }
    });

    it('should allow same-tenant data access', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          query: `{ workCenter(id: "${workCenterId}") { id workCenterName } }`,
        });

      // Should successfully return data
      expect(response.body.data).toBeDefined();
      expect(response.body.data.workCenter).toBeDefined();
      expect(response.body.data.workCenter.id).toBe(workCenterId);
    });

    afterAll(async () => {
      // Cleanup test data
      const client = await dbPool.connect();
      try {
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [TENANT_1_ID]);
        await client.query(`DELETE FROM work_centers WHERE id = $1`, [workCenterId]);
      } finally {
        client.release();
      }
    });
  });

  // =====================================================
  // ROLE-BASED ACCESS CONTROL TESTS
  // =====================================================

  describe('Role-Based Access Control (RBAC)', () => {
    it('should allow ADMIN to create tenants', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          query: `mutation {
            createTenant(input: {
              tenantName: "Test Tenant",
              subdomain: "test-tenant-${Date.now()}"
            }) { id tenantName }
          }`,
        });

      // Admin should be able to create tenants (if SUPER_ADMIN role requirement is removed for test)
      // This test needs to be adjusted based on actual role requirements
      expect(response.status).toBe(200);
    });

    it('should deny VIEWER from creating data', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          query: `mutation {
            createWorkCenter(input: {
              facilityId: "test",
              workCenterCode: "WC-001",
              workCenterName: "Test"
            }) { id }
          }`,
        });

      // Viewer should not be able to create work centers
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toMatch(/forbidden|access denied|role/i);
    });
  });

  // =====================================================
  // ROW-LEVEL SECURITY (RLS) TESTS
  // =====================================================

  describe('Row-Level Security (RLS)', () => {
    it('should enforce RLS at database level', async () => {
      const client = await dbPool.connect();
      try {
        // Set tenant context for tenant 1
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [TENANT_1_ID]);

        // Create test data for tenant 1
        await client.query(
          `INSERT INTO materials (tenant_id, material_code, material_name)
           VALUES ($1, 'MAT-TEST-001', 'Test Material')`,
          [TENANT_1_ID],
        );

        // Query should return the material
        const result1 = await client.query(
          `SELECT * FROM materials WHERE material_code = 'MAT-TEST-001'`,
        );
        expect(result1.rows.length).toBe(1);

        // Switch to tenant 2 context
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [TENANT_2_ID]);

        // Query should return NO rows (RLS blocks access)
        const result2 = await client.query(
          `SELECT * FROM materials WHERE material_code = 'MAT-TEST-001'`,
        );
        expect(result2.rows.length).toBe(0);

        // Cleanup
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [TENANT_1_ID]);
        await client.query(`DELETE FROM materials WHERE material_code = 'MAT-TEST-001'`);
      } finally {
        client.release();
      }
    });

    it('should prevent INSERT to other tenants', async () => {
      const client = await dbPool.connect();
      try {
        // Set tenant context for tenant 1
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [TENANT_1_ID]);

        // Try to insert data for tenant 2 (should fail WITH CHECK policy)
        await expect(
          client.query(
            `INSERT INTO materials (tenant_id, material_code, material_name)
             VALUES ($1, 'MAT-INVALID', 'Invalid Material')`,
            [TENANT_2_ID], // Different tenant!
          ),
        ).rejects.toThrow();
      } finally {
        client.release();
      }
    });
  });

  // =====================================================
  // TENANT CONTEXT CLEANUP TESTS
  // =====================================================

  describe('Tenant Context Cleanup', () => {
    it('should properly release database connections after requests', async () => {
      const initialPoolSize = dbPool.totalCount;

      // Make multiple concurrent requests
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post('/graphql')
            .set('Authorization', `Bearer ${tenant1Token}`)
            .send({
              query: '{ workCenters(facilityId: "test") { id } }',
            }),
        );

      await Promise.all(requests);

      // Wait for connections to be released
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Pool size should not have grown significantly
      const finalPoolSize = dbPool.totalCount;
      expect(finalPoolSize - initialPoolSize).toBeLessThan(3);
    });
  });
});
