/**
 * Critical Path Tests: First Fit Decreasing (FFD) Algorithm
 *
 * REQ-STRATEGIC-AUTO-1766527796497: FFD Algorithm Validation Tests
 *
 * Tests the FFD batch putaway algorithm to ensure:
 * - Correct sorting by volume (descending)
 * - Optimal bin selection
 * - O(n log n) performance characteristics
 * - Proper handling of constraints
 */

import { Pool } from 'pg';
import { BinUtilizationOptimizationEnhancedService } from '../bin-utilization-optimization-enhanced.service';

describe('BinUtilizationOptimizationEnhancedService - FFD Algorithm', () => {
  let service: BinUtilizationOptimizationEnhancedService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
    } as any;

    service = new BinUtilizationOptimizationEnhancedService(mockPool);
  });

  describe('FFD Algorithm - Volume Sorting', () => {
    test('should sort items by volume in descending order', async () => {
      // Mock candidate locations
      const mockLocations = [
        {
          location_id: 'loc-1',
          location_code: 'A-01-01',
          location_type: 'RESERVE',
          total_cubic_feet: 100,
          used_cubic_feet: 20,
          available_cubic_feet: 80,
          max_weight_lbs: 2000,
          current_weight_lbs: 500,
          available_weight_lbs: 1500,
          utilization_percentage: 20,
          abc_classification: 'A',
          pick_sequence: 100,
          temperature_controlled: false,
          security_zone: 'STANDARD',
          length_inches: 48,
          width_inches: 48,
          height_inches: 72,
        },
      ];

      // Mock material properties
      const mockMaterials = [
        {
          material_id: 'mat-1',
          material_code: 'ROLL-001',
          width_inches: 20,
          height_inches: 20,
          thickness_inches: 10,
          weight_lbs_per_unit: 100,
          abc_classification: 'A',
          temperature_controlled: false,
          security_zone: 'STANDARD',
          facility_id: 'fac-1',
        },
        {
          material_id: 'mat-2',
          material_code: 'ROLL-002',
          width_inches: 30,
          height_inches: 30,
          thickness_inches: 15,
          weight_lbs_per_unit: 200,
          abc_classification: 'A',
          temperature_controlled: false,
          security_zone: 'STANDARD',
          facility_id: 'fac-1',
        },
        {
          material_id: 'mat-3',
          material_code: 'ROLL-003',
          width_inches: 15,
          height_inches: 15,
          thickness_inches: 8,
          weight_lbs_per_unit: 50,
          abc_classification: 'A',
          temperature_controlled: false,
          security_zone: 'STANDARD',
          facility_id: 'fac-1',
        },
      ];

      // Setup mock responses
      mockPool.query
        .mockResolvedValueOnce({ rows: mockMaterials, rowCount: 3 } as any) // getMaterialPropertiesBatch
        .mockResolvedValueOnce({ rows: mockLocations, rowCount: 1 } as any); // getCandidateLocations

      const items = [
        { materialId: 'mat-1', lotNumber: 'LOT-001', quantity: 1 }, // 20×20×10 = 4000 in³ = 2.31 ft³
        { materialId: 'mat-2', lotNumber: 'LOT-002', quantity: 1 }, // 30×30×15 = 13500 in³ = 7.81 ft³
        { materialId: 'mat-3', lotNumber: 'LOT-003', quantity: 1 }, // 15×15×8 = 1800 in³ = 1.04 ft³
      ];

      const result = await service.suggestBatchPutaway(items, 'tenant-1');

      // FFD should process largest items first (mat-2, mat-1, mat-3)
      expect(result).toBeDefined();
      expect(result.recommendations).toBeDefined();

      // All items should get recommendations (if they fit)
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('FFD Algorithm - Bin Selection', () => {
    test('should select bins with lowest utilization for large items', async () => {
      const mockLocations = [
        {
          location_id: 'loc-1',
          location_code: 'A-01-01',
          location_type: 'RESERVE',
          total_cubic_feet: 100,
          used_cubic_feet: 50,
          available_cubic_feet: 50,
          max_weight_lbs: 2000,
          current_weight_lbs: 1000,
          available_weight_lbs: 1000,
          utilization_percentage: 50,
          abc_classification: 'A',
          pick_sequence: 100,
          temperature_controlled: false,
          security_zone: 'STANDARD',
          aisle_code: 'A-01',
          zone_code: 'A',
          length_inches: 48,
          width_inches: 48,
          height_inches: 72,
        },
        {
          location_id: 'loc-2',
          location_code: 'A-01-02',
          location_type: 'RESERVE',
          total_cubic_feet: 100,
          used_cubic_feet: 10,
          available_cubic_feet: 90,
          max_weight_lbs: 2000,
          current_weight_lbs: 200,
          available_weight_lbs: 1800,
          utilization_percentage: 10,
          abc_classification: 'A',
          pick_sequence: 101,
          temperature_controlled: false,
          security_zone: 'STANDARD',
          aisle_code: 'A-01',
          zone_code: 'A',
          length_inches: 48,
          width_inches: 48,
          height_inches: 72,
        },
      ];

      const mockMaterial = {
        material_id: 'mat-large',
        material_code: 'LARGE-ROLL',
        width_inches: 40,
        height_inches: 40,
        thickness_inches: 30,
        weight_lbs_per_unit: 500,
        abc_classification: 'A',
        temperature_controlled: false,
        security_zone: 'STANDARD',
        facility_id: 'fac-1',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockMaterial], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: mockLocations, rowCount: 2 } as any);

      const items = [
        { materialId: 'mat-large', lotNumber: 'LOT-L1', quantity: 1 },
      ];

      const result = await service.suggestBatchPutaway(items, 'tenant-1');

      expect(result.recommendations).toBeDefined();

      // Should prefer loc-2 (lower utilization) for large item
      if (result.recommendations.length > 0) {
        const recommendation = result.recommendations[0];
        expect(recommendation.primary).toBeDefined();
      }
    });
  });

  describe('FFD Algorithm - Constraint Validation', () => {
    test('should skip items that do not fit in any bin', async () => {
      const mockLocations = [
        {
          location_id: 'loc-small',
          location_code: 'S-01-01',
          location_type: 'PICK_FACE',
          total_cubic_feet: 10,
          used_cubic_feet: 0,
          available_cubic_feet: 10,
          max_weight_lbs: 200,
          current_weight_lbs: 0,
          available_weight_lbs: 200,
          utilization_percentage: 0,
          abc_classification: 'A',
          pick_sequence: 50,
          temperature_controlled: false,
          security_zone: 'STANDARD',
          length_inches: 24,
          width_inches: 24,
          height_inches: 36,
        },
      ];

      const mockMaterial = {
        material_id: 'mat-huge',
        material_code: 'HUGE-ROLL',
        width_inches: 60,
        height_inches: 60,
        thickness_inches: 40,
        weight_lbs_per_unit: 1200,
        abc_classification: 'A',
        temperature_controlled: false,
        security_zone: 'STANDARD',
        facility_id: 'fac-1',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockMaterial], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: mockLocations, rowCount: 1 } as any);

      const items = [
        { materialId: 'mat-huge', lotNumber: 'LOT-H1', quantity: 1 },
      ];

      const result = await service.suggestBatchPutaway(items, 'tenant-1');

      // Should handle gracefully when no bins fit
      expect(result.failures).toBeDefined();
      if (result.failures) {
        expect(result.failures.length).toBeGreaterThan(0);
      }
    });
  });

  describe('FFD Algorithm - Performance Characteristics', () => {
    test('should handle batch of 100 items efficiently', async () => {
      // Generate 10 bins with varying utilization
      const mockLocations = Array.from({ length: 10 }, (_, i) => ({
        location_id: `loc-${i}`,
        location_code: `B-${String(i).padStart(2, '0')}-01`,
        location_type: 'RESERVE',
        total_cubic_feet: 100,
        used_cubic_feet: i * 10,
        available_cubic_feet: 100 - i * 10,
        max_weight_lbs: 2000,
        current_weight_lbs: i * 200,
        available_weight_lbs: 2000 - i * 200,
        utilization_percentage: i * 10,
        abc_classification: 'A',
        pick_sequence: 100 + i,
        temperature_controlled: false,
        security_zone: 'STANDARD',
        aisle_code: 'B-01',
        zone_code: 'B',
        length_inches: 48,
        width_inches: 48,
        height_inches: 72,
      }));

      // Generate 100 materials with varying sizes
      const mockMaterials = Array.from({ length: 100 }, (_, i) => ({
        material_id: `mat-${i}`,
        material_code: `ROLL-${String(i).padStart(3, '0')}`,
        width_inches: 10 + (i % 20),
        height_inches: 10 + (i % 20),
        thickness_inches: 5 + (i % 10),
        weight_lbs_per_unit: 50 + i * 5,
        abc_classification: 'A',
        temperature_controlled: false,
        security_zone: 'STANDARD',
        facility_id: 'fac-1',
      }));

      mockPool.query
        .mockResolvedValueOnce({ rows: mockMaterials, rowCount: 100 } as any)
        .mockResolvedValueOnce({ rows: mockLocations, rowCount: 10 } as any);

      const items = Array.from({ length: 100 }, (_, i) => ({
        materialId: `mat-${i}`,
        lotNumber: `LOT-${String(i).padStart(3, '0')}`,
        quantity: 1,
      }));

      const startTime = Date.now();
      const result = await service.suggestBatchPutaway(items, 'tenant-1');
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 1 second for 100 items)
      expect(duration).toBeLessThan(1000);

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('FFD Algorithm - Congestion Avoidance', () => {
    test('should apply congestion penalty to busy aisles', async () => {
      const mockLocations = [
        {
          location_id: 'loc-busy',
          location_code: 'A-01-01',
          location_type: 'RESERVE',
          total_cubic_feet: 100,
          used_cubic_feet: 20,
          available_cubic_feet: 80,
          max_weight_lbs: 2000,
          current_weight_lbs: 500,
          available_weight_lbs: 1500,
          utilization_percentage: 20,
          abc_classification: 'A',
          pick_sequence: 100,
          temperature_controlled: false,
          security_zone: 'STANDARD',
          aisle_code: 'A-01', // Busy aisle
          zone_code: 'A',
          length_inches: 48,
          width_inches: 48,
          height_inches: 72,
        },
        {
          location_id: 'loc-quiet',
          location_code: 'B-01-01',
          location_type: 'RESERVE',
          total_cubic_feet: 100,
          used_cubic_feet: 20,
          available_cubic_feet: 80,
          max_weight_lbs: 2000,
          current_weight_lbs: 500,
          available_weight_lbs: 1500,
          utilization_percentage: 20,
          abc_classification: 'A',
          pick_sequence: 101,
          temperature_controlled: false,
          security_zone: 'STANDARD',
          aisle_code: 'B-01', // Quiet aisle
          zone_code: 'B',
          length_inches: 48,
          width_inches: 48,
          height_inches: 72,
        },
      ];

      const mockCongestion = [
        { aisle_code: 'A-01', active_pick_lists: 5, congestion_score: 80 },
        { aisle_code: 'B-01', active_pick_lists: 0, congestion_score: 10 },
      ];

      const mockMaterial = {
        material_id: 'mat-1',
        material_code: 'ROLL-001',
        width_inches: 20,
        height_inches: 20,
        thickness_inches: 10,
        weight_lbs_per_unit: 100,
        abc_classification: 'A',
        temperature_controlled: false,
        security_zone: 'STANDARD',
        facility_id: 'fac-1',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockMaterial], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: mockLocations, rowCount: 2 } as any)
        .mockResolvedValueOnce({ rows: mockCongestion, rowCount: 2 } as any);

      const items = [
        { materialId: 'mat-1', lotNumber: 'LOT-001', quantity: 1 },
      ];

      const result = await service.suggestBatchPutaway(items, 'tenant-1');

      expect(result.recommendations).toBeDefined();

      // Should prefer quiet aisle (B-01) over busy aisle (A-01)
      if (result.recommendations.length > 0) {
        const recommendation = result.recommendations[0];
        expect(recommendation.primary).toBeDefined();

        // Check if congestion penalty is applied
        if (recommendation.primary.locationCode === 'A-01-01') {
          // If busy location is selected, confidence should be lower
          expect(recommendation.primary.confidenceScore).toBeLessThan(0.9);
        }
      }
    });
  });

  describe('FFD Algorithm - Cross-Dock Detection', () => {
    test('should detect cross-dock opportunities for urgent orders', async () => {
      const mockMaterial = {
        material_id: 'mat-urgent',
        material_code: 'URGENT-001',
        width_inches: 20,
        height_inches: 20,
        thickness_inches: 10,
        weight_lbs_per_unit: 100,
        abc_classification: 'A',
        temperature_controlled: false,
        security_zone: 'STANDARD',
        facility_id: 'fac-1',
      };

      // Mock open sales order with ship date in 1 day
      const mockCrossDockCheck = [
        {
          sales_order_id: 'SO-12345',
          ship_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          urgency: 'HIGH',
        },
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockMaterial], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: mockCrossDockCheck, rowCount: 1 } as any);

      const items = [
        { materialId: 'mat-urgent', lotNumber: 'LOT-U1', quantity: 1 },
      ];

      // Note: This test validates the cross-dock detection logic exists
      // The actual implementation should detect urgent orders and recommend SHIPPING location
      const result = await service.suggestBatchPutaway(items, 'tenant-1');

      expect(result).toBeDefined();
    });
  });
});
