import { Pool } from 'pg';
import {
  BinUtilizationOptimizationHybridService,
  HybridAlgorithmStrategy,
  SKUAffinityMetrics
} from '../bin-utilization-optimization-hybrid.service';
import { ItemDimensions, BinCapacity } from '../bin-utilization-optimization.service';

/**
 * Test Suite: Bin Utilization Optimization Hybrid Service
 * REQ-STRATEGIC-AUTO-1766568547079: Optimize Bin Utilization Algorithm
 *
 * Tests for:
 * 1. Hybrid FFD/BFD algorithm selection
 * 2. SKU affinity scoring
 * 3. Security (multi-tenancy isolation)
 * 4. Input validation
 * 5. Performance optimizations
 *
 * Target Coverage: 80%+
 */

describe('BinUtilizationOptimizationHybridService', () => {
  let service: BinUtilizationOptimizationHybridService;
  let mockPool: jest.Mocked<Pool>;

  const MOCK_TENANT_ID = 'tenant-123';
  const MOCK_FACILITY_ID = 'facility-456';
  const MOCK_MATERIAL_ID = 'material-789';

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
      totalCount: 10,
      idleCount: 5,
      waitingCount: 0,
    } as unknown as jest.Mocked<Pool>;

    service = new BinUtilizationOptimizationHybridService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // ALGORITHM SELECTION TESTS
  // ==========================================================================

  describe('selectAlgorithm', () => {
    it('should select FFD for high variance + small items', () => {
      const items = [
        { totalVolume: 10, totalWeight: 100 },
        { totalVolume: 50, totalWeight: 200 },
        { totalVolume: 100, totalWeight: 300 },
      ];

      const candidateLocations: BinCapacity[] = [
        createMockLocation({ totalCubicFeet: 500, utilizationPercentage: 50 }),
      ];

      const strategy = service.selectAlgorithm(items, candidateLocations);

      expect(strategy.algorithm).toBe('FFD');
      expect(strategy.reason).toContain('High volume variance');
      expect(strategy.volumeVariance).toBeGreaterThan(2.0);
    });

    it('should select BFD for low variance + high utilization', () => {
      const items = [
        { totalVolume: 45, totalWeight: 100 },
        { totalVolume: 50, totalWeight: 110 },
        { totalVolume: 55, totalWeight: 120 },
      ];

      const candidateLocations: BinCapacity[] = [
        createMockLocation({ totalCubicFeet: 100, utilizationPercentage: 75 }),
      ];

      const strategy = service.selectAlgorithm(items, candidateLocations);

      expect(strategy.algorithm).toBe('BFD');
      expect(strategy.reason).toContain('Low volume variance');
      expect(strategy.volumeVariance).toBeLessThan(0.5);
      expect(strategy.avgBinUtilization).toBeGreaterThan(70);
    });

    it('should select HYBRID for mixed characteristics', () => {
      const items = [
        { totalVolume: 20, totalWeight: 100 },
        { totalVolume: 60, totalWeight: 200 },
        { totalVolume: 80, totalWeight: 300 },
      ];

      const candidateLocations: BinCapacity[] = [
        createMockLocation({ totalCubicFeet: 200, utilizationPercentage: 50 }),
      ];

      const strategy = service.selectAlgorithm(items, candidateLocations);

      expect(strategy.algorithm).toBe('HYBRID');
      expect(strategy.reason).toContain('Mixed item sizes');
    });

    it('should calculate variance correctly', () => {
      const items = [
        { totalVolume: 10, totalWeight: 100 },
        { totalVolume: 10, totalWeight: 100 },
        { totalVolume: 10, totalWeight: 100 },
      ];

      const candidateLocations: BinCapacity[] = [
        createMockLocation({ totalCubicFeet: 100, utilizationPercentage: 50 }),
      ];

      const strategy = service.selectAlgorithm(items, candidateLocations);

      // Zero variance for identical volumes
      expect(strategy.volumeVariance).toBe(0);
    });
  });

  // ==========================================================================
  // BATCH PUTAWAY HYBRID TESTS
  // ==========================================================================

  describe('suggestBatchPutawayHybrid', () => {
    beforeEach(() => {
      // Mock material properties query
      mockPool.query.mockImplementation((query: string) => {
        if (query.includes('FROM materials')) {
          return Promise.resolve({
            rows: [{
              material_id: MOCK_MATERIAL_ID,
              material_code: 'MAT-001',
              description: 'Test Material',
              weight_lbs_per_unit: 10,
              width_inches: 12,
              height_inches: 12,
              thickness_inches: 1,
              cubic_feet: 1,
              abc_classification: 'A',
              facility_id: MOCK_FACILITY_ID,
              temperature_controlled: false,
              security_zone: 'STANDARD',
            }],
            rowCount: 1,
          } as any);
        }

        // Mock candidate locations query
        if (query.includes('FROM inventory_locations')) {
          return Promise.resolve({
            rows: [{
              location_id: 'loc-1',
              location_code: 'A-01-01',
              location_type: 'RACK',
              total_cubic_feet: 100,
              used_cubic_feet: 30,
              available_cubic_feet: 70,
              max_weight_lbs: 1000,
              current_weight_lbs: 200,
              available_weight_lbs: 800,
              utilization_percentage: 30,
              abc_classification: 'A',
              pick_sequence: 10,
              temperature_controlled: false,
              security_zone: 'STANDARD',
              aisle_code: 'A01',
              zone_code: 'Z1',
            }],
            rowCount: 1,
          } as any);
        }

        // Mock aisle congestion query
        if (query.includes('aisle_code')) {
          return Promise.resolve({ rows: [], rowCount: 0 } as any);
        }

        // Mock affinity query
        if (query.includes('co_picks')) {
          return Promise.resolve({ rows: [], rowCount: 0 } as any);
        }

        // Mock nearby materials query
        if (query.includes('nearby')) {
          return Promise.resolve({ rows: [], rowCount: 0 } as any);
        }

        return Promise.resolve({ rows: [], rowCount: 0 } as any);
      });
    });

    it('should apply FFD sorting for FFD strategy', async () => {
      const items = [
        { materialId: MOCK_MATERIAL_ID, lotNumber: 'LOT-1', quantity: 10 },
        { materialId: MOCK_MATERIAL_ID, lotNumber: 'LOT-2', quantity: 50 },
        { materialId: MOCK_MATERIAL_ID, lotNumber: 'LOT-3', quantity: 100 },
      ];

      const recommendations = await service.suggestBatchPutawayHybrid(items, MOCK_TENANT_ID);

      expect(recommendations.size).toBe(3);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should enforce tenant isolation', async () => {
      const items = [
        { materialId: MOCK_MATERIAL_ID, lotNumber: 'LOT-1', quantity: 10 },
      ];

      await service.suggestBatchPutawayHybrid(items, MOCK_TENANT_ID);

      // Verify tenant_id is used in queries
      const calls = mockPool.query.mock.calls;
      const materialQuery = calls.find(call => call[0].includes('FROM materials'));
      expect(materialQuery).toBeDefined();
      expect(materialQuery![1]).toContain(MOCK_TENANT_ID);

      const locationQuery = calls.find(call => call[0].includes('FROM inventory_locations'));
      expect(locationQuery).toBeDefined();
      expect(locationQuery![1]).toContain(MOCK_TENANT_ID);
    });

    it('should validate input bounds', async () => {
      const invalidItems = [
        { materialId: MOCK_MATERIAL_ID, lotNumber: 'LOT-1', quantity: -10 },
      ];

      await expect(
        service.suggestBatchPutawayHybrid(invalidItems, MOCK_TENANT_ID)
      ).rejects.toThrow('Input validation failed');
    });

    it('should handle empty batches gracefully', async () => {
      const emptyItems: any[] = [];

      const recommendations = await service.suggestBatchPutawayHybrid(emptyItems, MOCK_TENANT_ID);

      expect(recommendations.size).toBe(0);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should reject extreme quantity values', async () => {
      const items = [
        { materialId: MOCK_MATERIAL_ID, lotNumber: 'LOT-1', quantity: 2000000 },
      ];

      await expect(
        service.suggestBatchPutawayHybrid(items, MOCK_TENANT_ID)
      ).rejects.toThrow('exceeds maximum limit');
    });

    it('should reject NaN and Infinity dimensions', async () => {
      const items = [
        {
          materialId: MOCK_MATERIAL_ID,
          lotNumber: 'LOT-1',
          quantity: 10,
          dimensions: {
            lengthInches: 12,
            widthInches: 12,
            heightInches: 12,
            cubicFeet: Infinity,
            weightLbsPerUnit: 10,
          },
        },
      ];

      await expect(
        service.suggestBatchPutawayHybrid(items, MOCK_TENANT_ID)
      ).rejects.toThrow('must be a valid finite number');
    });
  });

  // ==========================================================================
  // SKU AFFINITY TESTS
  // ==========================================================================

  describe('calculateAffinityScore', () => {
    it('should return 0 for no nearby materials', async () => {
      const score = await service.calculateAffinityScore(MOCK_MATERIAL_ID, []);

      expect(score).toBe(0);
    });

    it('should use cached affinity data when available', async () => {
      // Pre-load cache
      const mockAffinity: SKUAffinityMetrics = {
        materialId: MOCK_MATERIAL_ID,
        affinityMaterials: [
          {
            materialId: 'material-999',
            materialCode: 'MAT-999',
            coPickCount: 50,
            affinityScore: 0.5,
          },
        ],
        totalCoPickOrders: 50,
      };

      // Access private cache via type assertion
      (service as any).affinityCache.set(MOCK_MATERIAL_ID, mockAffinity);
      (service as any).affinityCacheExpiry = Date.now() + 60000;

      const nearbyMaterials = [{ material_id: 'material-999', material_code: 'MAT-999' }];

      const score = await service.calculateAffinityScore(MOCK_MATERIAL_ID, nearbyMaterials);

      expect(score).toBe(0.5);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should query database when cache is expired', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { material_b: 'material-999', co_pick_count: 50, affinity_score: 0.5 },
        ],
        rowCount: 1,
      } as any);

      const nearbyMaterials = [{ material_id: 'material-999', material_code: 'MAT-999' }];

      const score = await service.calculateAffinityScore(MOCK_MATERIAL_ID, nearbyMaterials);

      expect(score).toBe(0.5);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should normalize affinity scores to 0-1 range', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { material_b: 'material-999', co_pick_count: 150, affinity_score: 1.0 },
        ],
        rowCount: 1,
      } as any);

      const nearbyMaterials = [{ material_id: 'material-999', material_code: 'MAT-999' }];

      const score = await service.calculateAffinityScore(MOCK_MATERIAL_ID, nearbyMaterials);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const nearbyMaterials = [{ material_id: 'material-999', material_code: 'MAT-999' }];

      const score = await service.calculateAffinityScore(MOCK_MATERIAL_ID, nearbyMaterials);

      expect(score).toBe(0);
    });
  });

  describe('loadAffinityDataBatch', () => {
    it('should pre-load affinity for all materials in single query', async () => {
      const materialIds = ['mat-1', 'mat-2', 'mat-3'];

      mockPool.query.mockResolvedValue({
        rows: [
          {
            material_a: 'mat-1',
            material_b: 'mat-2',
            material_code: 'MAT-2',
            co_pick_count: 30,
            affinity_score: 0.3,
          },
        ],
        rowCount: 1,
      } as any);

      await service.loadAffinityDataBatch(materialIds);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][1]).toEqual([materialIds]);
    });

    it('should cache results for 24 hours', async () => {
      const materialIds = ['mat-1'];

      mockPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any);

      const beforeTime = Date.now();
      await service.loadAffinityDataBatch(materialIds);
      const afterTime = Date.now();

      const cacheExpiry = (service as any).affinityCacheExpiry;
      const expectedExpiry = beforeTime + 24 * 60 * 60 * 1000;

      expect(cacheExpiry).toBeGreaterThanOrEqual(expectedExpiry);
      expect(cacheExpiry).toBeLessThanOrEqual(afterTime + 24 * 60 * 60 * 1000 + 100);
    });

    it('should filter out low-frequency co-picks (< 3)', async () => {
      const materialIds = ['mat-1'];

      mockPool.query.mockResolvedValue({
        rows: [
          {
            material_a: 'mat-1',
            material_b: 'mat-2',
            material_code: 'MAT-2',
            co_pick_count: 2, // Below threshold
            affinity_score: 0.02,
          },
        ],
        rowCount: 1,
      } as any);

      await service.loadAffinityDataBatch(materialIds);

      // Verify query includes threshold filter
      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain('co_pick_count >= 3');
    });

    it('should skip loading if cache is still valid', async () => {
      (service as any).affinityCacheExpiry = Date.now() + 60000;
      (service as any).affinityCache.set('mat-1', {
        materialId: 'mat-1',
        affinityMaterials: [],
        totalCoPickOrders: 0,
      });

      await service.loadAffinityDataBatch(['mat-1']);

      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // SECURITY TESTS
  // ==========================================================================

  describe('Security', () => {
    it('should prevent cross-tenant location access', async () => {
      const items = [
        { materialId: MOCK_MATERIAL_ID, lotNumber: 'LOT-1', quantity: 10 },
      ];

      mockPool.query.mockResolvedValue({
        rows: [{
          material_id: MOCK_MATERIAL_ID,
          facility_id: MOCK_FACILITY_ID,
          abc_classification: 'A',
        }],
      } as any);

      await service.suggestBatchPutawayHybrid(items, MOCK_TENANT_ID);

      // Verify all location queries include tenant_id filter
      const locationQueries = mockPool.query.mock.calls.filter(
        call => call[0].includes('FROM inventory_locations')
      );

      locationQueries.forEach(call => {
        const query = call[0] as string;
        expect(query).toContain('il.tenant_id = $2');
        expect(call[1]).toContain(MOCK_TENANT_ID);
      });
    });

    it('should validate tenant ownership of materials', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const items = [
        { materialId: 'unauthorized-material', lotNumber: 'LOT-1', quantity: 10 },
      ];

      await expect(
        service.suggestBatchPutawayHybrid(items, MOCK_TENANT_ID)
      ).rejects.toThrow('not found or access denied');
    });

    it('should reject requests without tenantId', async () => {
      const items = [
        { materialId: MOCK_MATERIAL_ID, lotNumber: 'LOT-1', quantity: 10 },
      ];

      // TypeScript should catch this, but test runtime behavior
      await expect(
        (service.suggestBatchPutawayHybrid as any)(items, undefined)
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  function createMockLocation(overrides: Partial<BinCapacity> = {}): BinCapacity {
    return {
      locationId: 'loc-1',
      locationCode: 'A-01-01',
      locationType: 'RACK',
      totalCubicFeet: 100,
      usedCubicFeet: 30,
      availableCubicFeet: 70,
      maxWeightLbs: 1000,
      currentWeightLbs: 200,
      availableWeightLbs: 800,
      utilizationPercentage: 30,
      abcClassification: 'A',
      pickSequence: 10,
      temperatureControlled: false,
      securityZone: 'STANDARD',
      aisleCode: 'A01',
      zoneCode: 'Z1',
      ...overrides,
    };
  }
});
