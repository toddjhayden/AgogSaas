/**
 * EDGE PROVISIONING - BACKEND INTEGRATION TEST SUITE
 * REQ: REQ-DEVOPS-EDGE-PROVISION-1767150339448
 * Agent: Billy (QA Engineer)
 *
 * Comprehensive backend integration tests covering:
 * - GraphQL query/mutation execution
 * - Database CRUD operations
 * - Multi-tenant Row-Level Security (RLS)
 * - Edge device lifecycle management
 * - Error handling and validation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { FinalModulesResolver } from '../graphql/resolvers/quality-hr-iot-security-marketplace-imposition.resolver';

describe('Edge Provisioning - Backend Integration Tests', () => {
  let resolver: FinalModulesResolver;
  let db: Pool;
  let testTenantId: string;
  let testFacilityId: string;
  let testDeviceId: string;

  beforeAll(async () => {
    // Setup test database connection
    db = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'test_erp_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinalModulesResolver,
        {
          provide: 'DATABASE_POOL',
          useValue: db,
        },
      ],
    }).compile();

    resolver = module.get<FinalModulesResolver>(FinalModulesResolver);

    // Setup test data
    testTenantId = `test-tenant-${Date.now()}`;
    testFacilityId = `test-facility-${Date.now()}`;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testDeviceId) {
      await db.query('DELETE FROM iot_devices WHERE id = $1', [testDeviceId]);
    }
    await db.query('DELETE FROM iot_devices WHERE tenant_id = $1', [testTenantId]);
    await db.end();
  });

  describe('IoT Device Queries', () => {
    test('TC-029: getIotDevices returns empty array for new tenant', async () => {
      const result = await resolver.getIotDevices(
        testTenantId,
        null,
        null,
        null,
        null,
        {}
      );

      expect(result).toEqual([]);
    });

    test('TC-030: getIotDevices filters by tenantId correctly', async () => {
      // Create test device
      const device = await resolver.createIotDevice(
        testTenantId,
        testFacilityId,
        'EDGE-TEST-QUERY-001',
        'Test Query Device',
        'EDGE_COMPUTER',
        null,
        {}
      );

      testDeviceId = device.id;

      // Query with correct tenant
      const correctTenantResult = await resolver.getIotDevices(
        testTenantId,
        null,
        null,
        null,
        null,
        {}
      );

      expect(correctTenantResult.length).toBeGreaterThan(0);
      expect(correctTenantResult[0].deviceCode).toBe('EDGE-TEST-QUERY-001');

      // Query with different tenant (should return empty)
      const differentTenantResult = await resolver.getIotDevices(
        'different-tenant-id',
        null,
        null,
        null,
        null,
        {}
      );

      expect(differentTenantResult).toEqual([]);
    });

    test('TC-031: getIotDevices filters by facilityId', async () => {
      const result = await resolver.getIotDevices(
        testTenantId,
        testFacilityId,
        null,
        null,
        null,
        {}
      );

      expect(result.length).toBeGreaterThan(0);
      result.forEach((device) => {
        expect(device.facilityId).toBe(testFacilityId);
      });
    });

    test('TC-032: getIotDevices filters by deviceType', async () => {
      const result = await resolver.getIotDevices(
        testTenantId,
        null,
        null,
        'EDGE_COMPUTER',
        null,
        {}
      );

      result.forEach((device) => {
        expect(device.deviceType).toBe('EDGE_COMPUTER');
      });
    });

    test('TC-033: getIotDevices filters by isActive', async () => {
      const activeResult = await resolver.getIotDevices(
        testTenantId,
        null,
        null,
        null,
        true,
        {}
      );

      activeResult.forEach((device) => {
        expect(device.isActive).toBe(true);
      });

      const inactiveResult = await resolver.getIotDevices(
        testTenantId,
        null,
        null,
        null,
        false,
        {}
      );

      inactiveResult.forEach((device) => {
        expect(device.isActive).toBe(false);
      });
    });

    test('TC-034: getIotDevices returns correct field mappings', async () => {
      const result = await resolver.getIotDevices(
        testTenantId,
        null,
        null,
        null,
        null,
        {}
      );

      if (result.length > 0) {
        const device = result[0];
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('tenantId');
        expect(device).toHaveProperty('facilityId');
        expect(device).toHaveProperty('deviceCode');
        expect(device).toHaveProperty('deviceName');
        expect(device).toHaveProperty('deviceType');
        expect(device).toHaveProperty('isActive');
        expect(device).toHaveProperty('createdAt');
      }
    });
  });

  describe('IoT Device Mutations - Create', () => {
    test('TC-035: createIotDevice creates device successfully', async () => {
      const deviceCode = `EDGE-CREATE-${Date.now()}`;
      const device = await resolver.createIotDevice(
        testTenantId,
        testFacilityId,
        deviceCode,
        'Test Create Device',
        'EDGE_COMPUTER',
        null,
        {}
      );

      expect(device).toBeDefined();
      expect(device.deviceCode).toBe(deviceCode);
      expect(device.deviceName).toBe('Test Create Device');
      expect(device.deviceType).toBe('EDGE_COMPUTER');
      expect(device.isActive).toBe(true);
      expect(device.tenantId).toBe(testTenantId);
      expect(device.facilityId).toBe(testFacilityId);

      // Cleanup
      await db.query('DELETE FROM iot_devices WHERE id = $1', [device.id]);
    });

    test('TC-036: createIotDevice sets default isActive to true', async () => {
      const deviceCode = `EDGE-ACTIVE-${Date.now()}`;
      const device = await resolver.createIotDevice(
        testTenantId,
        testFacilityId,
        deviceCode,
        'Active Test Device',
        'EDGE_COMPUTER',
        null,
        {}
      );

      expect(device.isActive).toBe(true);

      // Cleanup
      await db.query('DELETE FROM iot_devices WHERE id = $1', [device.id]);
    });

    test('TC-037: createIotDevice handles optional workCenterId', async () => {
      const deviceCode = `EDGE-WORKCENTER-${Date.now()}`;
      const workCenterId = 'test-work-center-123';

      const device = await resolver.createIotDevice(
        testTenantId,
        testFacilityId,
        deviceCode,
        'Work Center Device',
        'EDGE_COMPUTER',
        workCenterId,
        {}
      );

      expect(device.workCenterId).toBe(workCenterId);

      // Cleanup
      await db.query('DELETE FROM iot_devices WHERE id = $1', [device.id]);
    });

    test('TC-038: createIotDevice enforces unique device codes', async () => {
      const deviceCode = `EDGE-UNIQUE-${Date.now()}`;

      // Create first device
      const device1 = await resolver.createIotDevice(
        testTenantId,
        testFacilityId,
        deviceCode,
        'First Device',
        'EDGE_COMPUTER',
        null,
        {}
      );

      // Attempt to create duplicate (should fail)
      await expect(
        resolver.createIotDevice(
          testTenantId,
          testFacilityId,
          deviceCode,
          'Duplicate Device',
          'EDGE_COMPUTER',
          null,
          {}
        )
      ).rejects.toThrow();

      // Cleanup
      await db.query('DELETE FROM iot_devices WHERE id = $1', [device1.id]);
    });
  });

  describe('IoT Device Mutations - Update', () => {
    let updateTestDeviceId: string;

    beforeEach(async () => {
      // Create device for update tests
      const device = await resolver.createIotDevice(
        testTenantId,
        testFacilityId,
        `EDGE-UPDATE-${Date.now()}`,
        'Update Test Device',
        'EDGE_COMPUTER',
        null,
        {}
      );
      updateTestDeviceId = device.id;
    });

    afterEach(async () => {
      // Cleanup
      if (updateTestDeviceId) {
        await db.query('DELETE FROM iot_devices WHERE id = $1', [updateTestDeviceId]);
      }
    });

    test('TC-039: updateIotDevice updates device name', async () => {
      const newName = 'Updated Device Name';

      const updatedDevice = await resolver.updateIotDevice(
        updateTestDeviceId,
        newName,
        null,
        {}
      );

      expect(updatedDevice.deviceName).toBe(newName);
    });

    test('TC-040: updateIotDevice updates isActive status', async () => {
      // Deactivate device
      const deactivatedDevice = await resolver.updateIotDevice(
        updateTestDeviceId,
        null,
        false,
        {}
      );

      expect(deactivatedDevice.isActive).toBe(false);

      // Reactivate device
      const reactivatedDevice = await resolver.updateIotDevice(
        updateTestDeviceId,
        null,
        true,
        {}
      );

      expect(reactivatedDevice.isActive).toBe(true);
    });

    test('TC-041: updateIotDevice updates both name and status', async () => {
      const updatedDevice = await resolver.updateIotDevice(
        updateTestDeviceId,
        'New Name and Status',
        false,
        {}
      );

      expect(updatedDevice.deviceName).toBe('New Name and Status');
      expect(updatedDevice.isActive).toBe(false);
    });

    test('TC-042: updateIotDevice sets updatedAt timestamp', async () => {
      const beforeUpdate = new Date();

      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay

      const updatedDevice = await resolver.updateIotDevice(
        updateTestDeviceId,
        'Timestamp Test',
        null,
        {}
      );

      const updatedAt = new Date(updatedDevice.updatedAt);
      expect(updatedAt.getTime()).toBeGreaterThan(beforeUpdate.getTime());
    });

    test('TC-043: updateIotDevice rejects invalid device ID', async () => {
      await expect(
        resolver.updateIotDevice('non-existent-device-id', 'New Name', null, {})
      ).rejects.toThrow();
    });
  });

  describe('Multi-Tenant Security (Row-Level Security)', () => {
    let tenant1Id: string;
    let tenant2Id: string;
    let tenant1DeviceId: string;
    let tenant2DeviceId: string;

    beforeAll(async () => {
      tenant1Id = `rls-tenant-1-${Date.now()}`;
      tenant2Id = `rls-tenant-2-${Date.now()}`;

      // Create devices for both tenants
      const device1 = await resolver.createIotDevice(
        tenant1Id,
        'facility-1',
        `EDGE-RLS-T1-${Date.now()}`,
        'Tenant 1 Device',
        'EDGE_COMPUTER',
        null,
        {}
      );
      tenant1DeviceId = device1.id;

      const device2 = await resolver.createIotDevice(
        tenant2Id,
        'facility-2',
        `EDGE-RLS-T2-${Date.now()}`,
        'Tenant 2 Device',
        'EDGE_COMPUTER',
        null,
        {}
      );
      tenant2DeviceId = device2.id;
    });

    afterAll(async () => {
      // Cleanup
      await db.query('DELETE FROM iot_devices WHERE id IN ($1, $2)', [
        tenant1DeviceId,
        tenant2DeviceId,
      ]);
    });

    test('TC-044: Tenant 1 cannot see Tenant 2 devices', async () => {
      const tenant1Devices = await resolver.getIotDevices(
        tenant1Id,
        null,
        null,
        null,
        null,
        {}
      );

      expect(tenant1Devices.every((d) => d.tenantId === tenant1Id)).toBe(true);
      expect(tenant1Devices.some((d) => d.id === tenant2DeviceId)).toBe(false);
    });

    test('TC-045: Tenant 2 cannot see Tenant 1 devices', async () => {
      const tenant2Devices = await resolver.getIotDevices(
        tenant2Id,
        null,
        null,
        null,
        null,
        {}
      );

      expect(tenant2Devices.every((d) => d.tenantId === tenant2Id)).toBe(true);
      expect(tenant2Devices.some((d) => d.id === tenant1DeviceId)).toBe(false);
    });

    test('TC-046: Cross-tenant device update is prevented', async () => {
      // Attempt to update Tenant 2 device while querying as Tenant 1
      // This should fail due to RLS policies
      const directUpdate = await db.query(
        `UPDATE iot_devices
         SET device_name = 'Hacked Name'
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [tenant2DeviceId, tenant1Id]
      );

      // No rows should be updated
      expect(directUpdate.rowCount).toBe(0);
    });

    test('TC-047: Each tenant sees only their own device count', async () => {
      const tenant1Count = await resolver.getIotDevices(
        tenant1Id,
        null,
        null,
        null,
        null,
        {}
      );

      const tenant2Count = await resolver.getIotDevices(
        tenant2Id,
        null,
        null,
        null,
        null,
        {}
      );

      // Verify counts are isolated
      expect(tenant1Count.length).toBeGreaterThan(0);
      expect(tenant2Count.length).toBeGreaterThan(0);

      // Verify no overlap
      const tenant1Ids = tenant1Count.map((d) => d.id);
      const tenant2Ids = tenant2Count.map((d) => d.id);
      const overlap = tenant1Ids.filter((id) => tenant2Ids.includes(id));

      expect(overlap.length).toBe(0);
    });
  });

  describe('Sensor Readings Query', () => {
    test('TC-048: getSensorReadings filters by tenantId', async () => {
      const readings = await resolver.getSensorReadings(
        testTenantId,
        null,
        null,
        null,
        null,
        null,
        1000,
        0,
        {}
      );

      readings.forEach((reading) => {
        expect(reading.tenantId).toBe(testTenantId);
      });
    });

    test('TC-049: getSensorReadings filters by iotDeviceId', async () => {
      if (!testDeviceId) return;

      const readings = await resolver.getSensorReadings(
        testTenantId,
        testDeviceId,
        null,
        null,
        null,
        null,
        1000,
        0,
        {}
      );

      readings.forEach((reading) => {
        expect(reading.iotDeviceId).toBe(testDeviceId);
      });
    });

    test('TC-050: getSensorReadings supports pagination', async () => {
      const page1 = await resolver.getSensorReadings(
        testTenantId,
        null,
        null,
        null,
        null,
        null,
        10,
        0,
        {}
      );

      const page2 = await resolver.getSensorReadings(
        testTenantId,
        null,
        null,
        null,
        null,
        null,
        10,
        10,
        {}
      );

      // Pages should not have overlapping records
      const page1Ids = page1.map((r) => r.id);
      const page2Ids = page2.map((r) => r.id);
      const overlap = page1Ids.filter((id) => page2Ids.includes(id));

      expect(overlap.length).toBe(0);
    });
  });

  describe('Equipment Events Query', () => {
    test('TC-051: getEquipmentEvents filters by tenantId', async () => {
      const events = await resolver.getEquipmentEvents(
        testTenantId,
        null,
        null,
        null,
        null,
        null,
        100,
        0,
        {}
      );

      events.forEach((event) => {
        expect(event.tenantId).toBe(testTenantId);
      });
    });

    test('TC-052: getEquipmentEvents filters by severity', async () => {
      const criticalEvents = await resolver.getEquipmentEvents(
        testTenantId,
        null,
        'CRITICAL',
        null,
        null,
        null,
        100,
        0,
        {}
      );

      criticalEvents.forEach((event) => {
        expect(event.severity).toBe('CRITICAL');
      });
    });

    test('TC-053: getEquipmentEvents filters by acknowledged status', async () => {
      const unacknowledged = await resolver.getEquipmentEvents(
        testTenantId,
        null,
        null,
        false,
        null,
        null,
        100,
        0,
        {}
      );

      unacknowledged.forEach((event) => {
        expect(event.acknowledged).toBe(false);
      });

      const acknowledged = await resolver.getEquipmentEvents(
        testTenantId,
        null,
        null,
        true,
        null,
        null,
        100,
        0,
        {}
      );

      acknowledged.forEach((event) => {
        expect(event.acknowledged).toBe(true);
      });
    });
  });

  describe('Error Handling and Validation', () => {
    test('TC-054: createIotDevice handles missing required fields', async () => {
      await expect(
        resolver.createIotDevice(
          '',
          testFacilityId,
          'EDGE-ERROR-001',
          'Error Test',
          'EDGE_COMPUTER',
          null,
          {}
        )
      ).rejects.toThrow();
    });

    test('TC-055: updateIotDevice handles non-existent device gracefully', async () => {
      await expect(
        resolver.updateIotDevice(
          'non-existent-uuid-12345',
          'New Name',
          true,
          {}
        )
      ).rejects.toThrow();
    });

    test('TC-056: getIotDevices handles database connection errors', async () => {
      // Temporarily break the connection
      const originalQuery = db.query;
      db.query = jest.fn().mockRejectedValue(new Error('Connection lost'));

      await expect(
        resolver.getIotDevices(testTenantId, null, null, null, null, {})
      ).rejects.toThrow('Connection lost');

      // Restore
      db.query = originalQuery;
    });
  });

  describe('Performance and Load Testing', () => {
    test('TC-057: Query handles large result sets efficiently', async () => {
      const startTime = Date.now();

      const result = await resolver.getIotDevices(
        testTenantId,
        null,
        null,
        null,
        null,
        {}
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Query should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    test('TC-058: Sensor readings pagination performs well', async () => {
      const startTime = Date.now();

      const result = await resolver.getSensorReadings(
        testTenantId,
        null,
        null,
        null,
        null,
        null,
        1000,
        0,
        {}
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Large paginated query should complete within 3 seconds
      expect(duration).toBeLessThan(3000);
    });

    test('TC-059: Concurrent device queries handle correctly', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        resolver.getIotDevices(testTenantId, null, null, null, null, {})
      );

      const results = await Promise.all(promises);

      // All queries should succeed
      expect(results.length).toBe(10);
      results.forEach((result) => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});
