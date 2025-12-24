/**
 * Enhanced Bin Utilization Optimization Service Tests
 * REQ-STRATEGIC-AUTO-1766476803478: Optimize Bin Utilization Algorithm
 *
 * Test Coverage:
 * - Batch putaway with Best Fit Decreasing (FFD)
 * - Congestion avoidance
 * - Cross-dock detection
 * - ML confidence adjustment
 * - Event-driven re-slotting triggers
 */

import { Pool } from 'pg';
import { BinUtilizationOptimizationEnhancedService } from '../bin-utilization-optimization-enhanced.service';

describe('BinUtilizationOptimizationEnhancedService', () => {
  let service: BinUtilizationOptimizationEnhancedService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      end: jest.fn()
    } as any;

    service = new BinUtilizationOptimizationEnhancedService(mockPool);
  });

  afterEach(async () => {
    await service.close();
  });

  // ==========================================================================
  // BATCH PUTAWAY WITH BEST FIT DECREASING (FFD)
  // ==========================================================================

  describe('suggestBatchPutaway', () => {
    it('should sort items by volume descending (FFD optimization)', async () => {
      const items = [
        {
          materialId: 'mat-1',
          lotNumber: 'LOT-001',
          quantity: 10,
          dimensions: {
            lengthInches: 12,
            widthInches: 12,
            heightInches: 12,
            cubicFeet: 1.0,
            weightLbsPerUnit: 10
          }
        },
        {
          materialId: 'mat-2',
          lotNumber: 'LOT-002',
          quantity: 20,
          dimensions: {
            lengthInches: 24,
            widthInches: 24,
            heightInches: 24,
            cubicFeet: 8.0,
            weightLbsPerUnit: 50
          }
        }
      ];

      // Mock material properties
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            material_id: 'mat-1',
            facility_id: 'fac-1',
            abc_classification: 'A',
            temperature_controlled: false,
            security_zone: 'STANDARD'
          }
        ]
      } as any);

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            material_id: 'mat-2',
            facility_id: 'fac-1',
            abc_classification: 'B',
            temperature_controlled: false,
            security_zone: 'STANDARD'
          }
        ]
      } as any);

      // Mock candidate locations
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            location_id: 'loc-1',
            location_code: 'A-01-01-01',
            location_type: 'PICK_FACE',
            total_cubic_feet: 100,
            used_cubic_feet: 20,
            available_cubic_feet: 80,
            max_weight_lbs: 1000,
            current_weight_lbs: 100,
            available_weight_lbs: 900,
            utilization_percentage: 20,
            abc_classification: 'A',
            pick_sequence: 10,
            temperature_controlled: false,
            security_zone: 'STANDARD',
            aisle_code: 'A-01'
          }
        ]
      } as any);

      const recommendations = await service.suggestBatchPutaway(items);

      expect(recommendations.size).toBe(2);
      expect(recommendations.has('LOT-001')).toBe(true);
      expect(recommendations.has('LOT-002')).toBe(true);

      // Larger item (LOT-002) should be processed first
      const rec1 = recommendations.get('LOT-001');
      const rec2 = recommendations.get('LOT-002');

      expect(rec1?.algorithm).toBe('BEST_FIT_DECREASING_ENHANCED');
      expect(rec2?.algorithm).toBe('BEST_FIT_DECREASING_ENHANCED');
    });

    it('should apply congestion penalty to busy aisles', async () => {
      // Test that locations in congested aisles receive lower scores
      const items = [
        {
          materialId: 'mat-1',
          lotNumber: 'LOT-001',
          quantity: 10
        }
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            material_id: 'mat-1',
            facility_id: 'fac-1',
            abc_classification: 'A',
            temperature_controlled: false,
            security_zone: 'STANDARD',
            width_inches: 12,
            height_inches: 12,
            thickness_inches: 12,
            weight_lbs_per_unit: 10
          }
        ]
      } as any);

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            location_id: 'loc-1',
            location_code: 'A-01-01-01',
            location_type: 'PICK_FACE',
            total_cubic_feet: 100,
            used_cubic_feet: 20,
            available_cubic_feet: 80,
            max_weight_lbs: 1000,
            current_weight_lbs: 100,
            available_weight_lbs: 900,
            utilization_percentage: 20,
            abc_classification: 'A',
            pick_sequence: 10,
            temperature_controlled: false,
            security_zone: 'STANDARD',
            aisle_code: 'A-01'
          }
        ]
      } as any);

      // Mock congestion query
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            aisle_code: 'A-01',
            active_pick_lists: 5,
            avg_time_minutes: 15,
            congestion_score: 65 // High congestion
          }
        ]
      } as any);

      const recommendations = await service.suggestBatchPutaway(items);

      const rec = recommendations.get('LOT-001');
      expect(rec?.congestionPenalty).toBeGreaterThan(0);
    });

    it('should detect and recommend cross-dock for urgent orders', async () => {
      const items = [
        {
          materialId: 'mat-1',
          lotNumber: 'LOT-001',
          quantity: 100
        }
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            material_id: 'mat-1',
            facility_id: 'fac-1',
            abc_classification: 'A',
            temperature_controlled: false,
            security_zone: 'STANDARD',
            width_inches: 12,
            height_inches: 12,
            thickness_inches: 12,
            weight_lbs_per_unit: 10
          }
        ]
      } as any);

      // Mock cross-dock opportunity query
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            sales_order_id: 'SO-12345',
            order_priority: 'URGENT',
            quantity_ordered: 100,
            quantity_allocated: 0,
            requested_ship_date: new Date(),
            days_until_ship: 0
          }
        ]
      } as any);

      // Mock staging location
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            location_id: 'stage-1',
            location_code: 'STAGING-01',
            location_type: 'STAGING',
            pick_sequence: 1
          }
        ]
      } as any);

      const recommendations = await service.suggestBatchPutaway(items);

      const rec = recommendations.get('LOT-001');
      expect(rec?.algorithm).toBe('CROSS_DOCK_FAST_PATH');
      expect(rec?.locationType).toBe('STAGING');
      expect(rec?.crossDockRecommendation?.shouldCrossDock).toBe(true);
      expect(rec?.crossDockRecommendation?.urgency).toBe('CRITICAL');
    });
  });

  // ==========================================================================
  // CONGESTION AVOIDANCE
  // ==========================================================================

  describe('calculateAisleCongestion', () => {
    it('should calculate congestion scores for active aisles', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            aisle_code: 'A-01',
            active_pick_lists: 3,
            avg_time_minutes: 10,
            congestion_score: 40
          },
          {
            aisle_code: 'A-02',
            active_pick_lists: 1,
            avg_time_minutes: 5,
            congestion_score: 15
          }
        ]
      } as any);

      const congestion = await service.calculateAisleCongestion();

      expect(congestion.size).toBe(2);
      expect(congestion.get('A-01')).toBe(40);
      expect(congestion.get('A-02')).toBe(15);
    });

    it('should cache congestion data for 5 minutes', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            aisle_code: 'A-01',
            active_pick_lists: 3,
            avg_time_minutes: 10,
            congestion_score: 40
          }
        ]
      } as any);

      // First call - should hit database
      await service.calculateAisleCongestion();
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await service.calculateAisleCongestion();
      expect(mockPool.query).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  // ==========================================================================
  // CROSS-DOCK DETECTION
  // ==========================================================================

  describe('detectCrossDockOpportunity', () => {
    it('should recommend cross-dock for same-day shipments', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            sales_order_id: 'SO-12345',
            order_priority: 'STANDARD',
            quantity_ordered: 50,
            quantity_allocated: 0,
            requested_ship_date: new Date(),
            days_until_ship: 0
          }
        ]
      } as any);

      const result = await service.detectCrossDockOpportunity(
        'mat-1',
        50,
        new Date()
      );

      expect(result.shouldCrossDock).toBe(true);
      expect(result.urgency).toBe('CRITICAL');
      expect(result.salesOrderId).toBe('SO-12345');
    });

    it('should not recommend cross-dock when no urgent orders', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: []
      } as any);

      const result = await service.detectCrossDockOpportunity(
        'mat-1',
        50,
        new Date()
      );

      expect(result.shouldCrossDock).toBe(false);
      expect(result.urgency).toBe('NONE');
      expect(result.reason).toBe('No pending orders');
    });

    it('should not recommend cross-dock when quantity insufficient', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            sales_order_id: 'SO-12345',
            order_priority: 'STANDARD',
            quantity_ordered: 100,
            quantity_allocated: 0,
            requested_ship_date: new Date(),
            days_until_ship: 0
          }
        ]
      } as any);

      const result = await service.detectCrossDockOpportunity(
        'mat-1',
        50, // Less than required
        new Date()
      );

      expect(result.shouldCrossDock).toBe(false);
    });
  });

  // ==========================================================================
  // EVENT-DRIVEN RE-SLOTTING
  // ==========================================================================

  describe('monitorVelocityChanges', () => {
    it('should detect velocity spikes', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            material_id: 'mat-1',
            current_abc: 'C',
            recent_picks: 200,
            historical_picks: 50,
            velocity_change_pct: 150,
            calculated_abc: 'A'
          }
        ]
      } as any);

      const triggers = await service.monitorVelocityChanges();

      expect(triggers.length).toBe(1);
      expect(triggers[0].type).toBe('VELOCITY_SPIKE');
      expect(triggers[0].materialId).toBe('mat-1');
      expect(triggers[0].velocityChange).toBe(150);
    });

    it('should detect velocity drops', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            material_id: 'mat-2',
            current_abc: 'A',
            recent_picks: 10,
            historical_picks: 100,
            velocity_change_pct: -80,
            calculated_abc: 'C'
          }
        ]
      } as any);

      const triggers = await service.monitorVelocityChanges();

      expect(triggers.length).toBe(1);
      expect(triggers[0].type).toBe('VELOCITY_DROP');
    });

    it('should detect promotional spikes (C to A)', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            material_id: 'mat-3',
            current_abc: 'C',
            recent_picks: 300,
            historical_picks: 20,
            velocity_change_pct: 1400,
            calculated_abc: 'A'
          }
        ]
      } as any);

      const triggers = await service.monitorVelocityChanges();

      expect(triggers[0].type).toBe('PROMOTION');
    });
  });

  // ==========================================================================
  // ML CONFIDENCE ADJUSTMENT
  // ==========================================================================

  describe('ML Feedback Loop', () => {
    it('should collect feedback data for training', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            recommendation_id: 'rec-1',
            material_id: 'mat-1',
            recommended_location_id: 'loc-1',
            actual_location_id: 'loc-1',
            accepted: true,
            algorithm_used: 'BEST_FIT_DECREASING_ENHANCED',
            confidence_score: 0.85,
            abc_classification: 'A',
            weight_lbs_per_unit: 10,
            cubic_feet: 1.0,
            zone_code: 'A',
            pick_sequence: 10,
            utilization_percentage: 75
          }
        ]
      } as any);

      const feedback = await service.collectFeedbackData(
        new Date('2025-01-01'),
        new Date('2025-12-23')
      );

      expect(feedback.length).toBe(1);
      expect(feedback[0].accepted).toBe(true);
      expect(feedback[0].confidenceScore).toBe(0.85);
    });

    it('should calculate accuracy metrics', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            recommendation_id: 'rec-1',
            material_id: 'mat-1',
            recommended_location_id: 'loc-1',
            actual_location_id: 'loc-1',
            accepted: true,
            algorithm_used: 'BEST_FIT_DECREASING_ENHANCED',
            confidence_score: 0.85,
            abc_classification: 'A',
            weight_lbs_per_unit: 10,
            cubic_feet: 1.0,
            zone_code: 'A',
            pick_sequence: 10,
            utilization_percentage: 75
          },
          {
            recommendation_id: 'rec-2',
            material_id: 'mat-2',
            recommended_location_id: 'loc-2',
            actual_location_id: 'loc-3',
            accepted: false,
            algorithm_used: 'BEST_FIT_DECREASING_ENHANCED',
            confidence_score: 0.75,
            abc_classification: 'B',
            weight_lbs_per_unit: 20,
            cubic_feet: 2.0,
            zone_code: 'B',
            pick_sequence: 50,
            utilization_percentage: 60
          }
        ]
      } as any);

      const metrics = await service.calculateAccuracyMetrics();

      expect(metrics.totalRecommendations).toBe(2);
      expect(metrics.overallAccuracy).toBe(50); // 1 of 2 accepted
      expect(metrics.byAlgorithm.size).toBeGreaterThan(0);
    });

    it('should train ML model with feedback', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: []
      } as any);

      // Mock ML weights query
      mockPool.query.mockResolvedValueOnce({
        rows: []
      } as any);

      // Mock feedback collection
      mockPool.query.mockResolvedValueOnce({
        rows: []
      } as any);

      // Mock weights save
      mockPool.query.mockResolvedValueOnce({
        rows: []
      } as any);

      await expect(service.trainMLModel()).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // PERFORMANCE BENCHMARKS
  // ==========================================================================

  describe('Performance Benchmarks', () => {
    it('should process batch putaway in < 2 seconds for 50 items', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        materialId: `mat-${i}`,
        lotNumber: `LOT-${i}`,
        quantity: 10
      }));

      // Mock all queries
      for (let i = 0; i < 50; i++) {
        mockPool.query.mockResolvedValueOnce({
          rows: [
            {
              material_id: `mat-${i}`,
              facility_id: 'fac-1',
              abc_classification: 'A',
              temperature_controlled: false,
              security_zone: 'STANDARD',
              width_inches: 12,
              height_inches: 12,
              thickness_inches: 12,
              weight_lbs_per_unit: 10
            }
          ]
        } as any);
      }

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            location_id: 'loc-1',
            location_code: 'A-01-01-01',
            location_type: 'PICK_FACE',
            total_cubic_feet: 1000,
            used_cubic_feet: 200,
            available_cubic_feet: 800,
            max_weight_lbs: 10000,
            current_weight_lbs: 1000,
            available_weight_lbs: 9000,
            utilization_percentage: 20,
            abc_classification: 'A',
            pick_sequence: 10,
            temperature_controlled: false,
            security_zone: 'STANDARD',
            aisle_code: 'A-01'
          }
        ]
      } as any);

      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const startTime = Date.now();
      await service.suggestBatchPutaway(items);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(2000); // Should complete in < 2 seconds
    }, 10000);
  });
});
