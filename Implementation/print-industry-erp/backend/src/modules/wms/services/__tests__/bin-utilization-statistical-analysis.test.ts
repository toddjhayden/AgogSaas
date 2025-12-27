/**
 * Statistical Analysis Service Tests
 *
 * Purpose: Comprehensive testing of statistical methods and calculations
 * Author: Priya (Statistical Analysis Expert)
 * Requirement: REQ-STRATEGIC-AUTO-1766545799451
 *
 * Test Coverage:
 * - Descriptive statistics calculations
 * - Outlier detection methods (IQR, Z-score, Modified Z-score)
 * - Correlation analysis (Pearson, Spearman)
 * - Confidence interval calculations
 * - Statistical significance testing
 * - Edge cases and boundary conditions
 */

import { Pool } from 'pg';
import { BinUtilizationStatisticalAnalysisService } from '../bin-utilization-statistical-analysis.service';

describe('BinUtilizationStatisticalAnalysisService', () => {
  let service: BinUtilizationStatisticalAnalysisService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {
      connect: jest.fn(),
      query: jest.fn(),
    } as any;

    service = new BinUtilizationStatisticalAnalysisService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateStatisticalMetrics', () => {
    it('should calculate comprehensive statistical metrics', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      // Mock query results for statistical calculations
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            avg_volume_utilization: 75.5,
            stddev_volume_utilization: 12.3,
            median_volume_utilization: 76.0,
            p25_volume_utilization: 65.0,
            p75_volume_utilization: 85.0,
            p95_volume_utilization: 92.0,
            avg_weight_utilization: 70.2,
            stddev_weight_utilization: 10.5,
            total_recommendations: 150,
            accepted_recommendations: 135,
            rejected_recommendations: 15,
            acceptance_rate: 0.9,
            avg_confidence_score: 0.875,
            stddev_confidence_score: 0.095,
            median_confidence_score: 0.890,
            locations_optimal: 85,
            locations_underutilized: 10,
            locations_overutilized: 5,
            target_achievement_rate: 0.85,
            ml_model_accuracy: 0.92,
            sample_size: 150
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            metric_id: 'test-metric-id',
            measurement_timestamp: new Date()
          }]
        });

      const result = await service.calculateStatisticalMetrics(
        'tenant-123',
        'facility-456',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-789'
      );

      // Verify statistical calculations
      expect(result.acceptanceRate).toBe(0.9);
      expect(result.avgVolumeUtilization).toBe(75.5);
      expect(result.stdDevVolumeUtilization).toBe(12.3);
      expect(result.medianVolumeUtilization).toBe(76.0);
      expect(result.p25VolumeUtilization).toBe(65.0);
      expect(result.p75VolumeUtilization).toBe(85.0);
      expect(result.p95VolumeUtilization).toBe(92.0);

      // Verify statistical significance (n >= 30)
      expect(result.sampleSize).toBe(150);
      expect(result.isStatisticallySignificant).toBe(true);

      // Verify confidence intervals are calculated
      expect(result.confidenceInterval95Lower).toBeGreaterThanOrEqual(0);
      expect(result.confidenceInterval95Upper).toBeLessThanOrEqual(1);
      expect(result.confidenceInterval95Lower).toBeLessThan(result.confidenceInterval95Upper);

      // Verify ML metrics
      expect(result.mlModelAccuracy).toBe(0.92);
      expect(result.mlModelF1Score).toBeGreaterThan(0);

      // Verify client release
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle small sample sizes correctly', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            avg_volume_utilization: 75.0,
            stddev_volume_utilization: 15.0,
            median_volume_utilization: 75.0,
            p25_volume_utilization: 65.0,
            p75_volume_utilization: 85.0,
            p95_volume_utilization: 90.0,
            avg_weight_utilization: 70.0,
            stddev_weight_utilization: 12.0,
            total_recommendations: 15, // Small sample
            accepted_recommendations: 12,
            rejected_recommendations: 3,
            acceptance_rate: 0.8,
            avg_confidence_score: 0.85,
            stddev_confidence_score: 0.1,
            median_confidence_score: 0.87,
            locations_optimal: 50,
            locations_underutilized: 20,
            locations_overutilized: 10,
            target_achievement_rate: 0.625,
            ml_model_accuracy: 0.85,
            sample_size: 15
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            metric_id: 'test-metric-id',
            measurement_timestamp: new Date()
          }]
        });

      const result = await service.calculateStatisticalMetrics(
        'tenant-123',
        'facility-456',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-789'
      );

      // Small sample should not be statistically significant
      expect(result.sampleSize).toBe(15);
      expect(result.isStatisticallySignificant).toBe(false);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle zero recommendations gracefully', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            avg_volume_utilization: 0,
            stddev_volume_utilization: 0,
            median_volume_utilization: 0,
            p25_volume_utilization: 0,
            p75_volume_utilization: 0,
            p95_volume_utilization: 0,
            avg_weight_utilization: 0,
            stddev_weight_utilization: 0,
            total_recommendations: 0,
            accepted_recommendations: 0,
            rejected_recommendations: 0,
            acceptance_rate: 0,
            avg_confidence_score: 0,
            stddev_confidence_score: 0,
            median_confidence_score: 0,
            locations_optimal: 0,
            locations_underutilized: 0,
            locations_overutilized: 0,
            target_achievement_rate: 0,
            ml_model_accuracy: 0,
            sample_size: 0
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            metric_id: 'test-metric-id',
            measurement_timestamp: new Date()
          }]
        });

      const result = await service.calculateStatisticalMetrics(
        'tenant-123',
        'facility-456',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-789'
      );

      expect(result.totalRecommendationsGenerated).toBe(0);
      expect(result.acceptanceRate).toBe(0);
      expect(result.isStatisticallySignificant).toBe(false);

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('detectOutliers', () => {
    it('should detect outliers using IQR method', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      // Mock outlier detection results
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              location_id: 'loc-1',
              metric_value: 95.5,
              lower_bound: 40.0,
              upper_bound: 90.0,
              z_score: 0,
              outlier_type: 'HIGH',
              severity: 'MODERATE'
            },
            {
              location_id: 'loc-2',
              metric_value: 15.0,
              lower_bound: 40.0,
              upper_bound: 90.0,
              z_score: 0,
              outlier_type: 'LOW',
              severity: 'SEVERE'
            }
          ]
        });

      // Mock insert queries
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            outlier_id: 'outlier-1',
            detection_timestamp: new Date()
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            outlier_id: 'outlier-2',
            detection_timestamp: new Date()
          }]
        });

      const result = await service.detectOutliers(
        'tenant-123',
        'facility-456',
        'volume_utilization',
        'IQR'
      );

      expect(result).toHaveLength(2);

      // First outlier (HIGH)
      expect(result[0].metricValue).toBe(95.5);
      expect(result[0].outlierType).toBe('HIGH');
      expect(result[0].outlierSeverity).toBe('MODERATE');
      expect(result[0].requiresInvestigation).toBe(false);

      // Second outlier (LOW, SEVERE)
      expect(result[1].metricValue).toBe(15.0);
      expect(result[1].outlierType).toBe('LOW');
      expect(result[1].outlierSeverity).toBe('SEVERE');
      expect(result[1].requiresInvestigation).toBe(true);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should detect outliers using Z-score method', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              location_id: 'loc-1',
              metric_value: 110.0,
              lower_bound: 40.0,
              upper_bound: 90.0,
              z_score: 3.5,
              outlier_type: 'HIGH',
              severity: 'SEVERE'
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{
            outlier_id: 'outlier-1',
            detection_timestamp: new Date()
          }]
        });

      const result = await service.detectOutliers(
        'tenant-123',
        'facility-456',
        'volume_utilization',
        'Z_SCORE'
      );

      expect(result).toHaveLength(1);
      expect(result[0].zScore).toBe(3.5);
      expect(result[0].outlierSeverity).toBe('SEVERE');
      expect(result[0].requiresInvestigation).toBe(true);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should detect outliers using Modified Z-score method', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              location_id: 'loc-1',
              metric_value: 120.0,
              lower_bound: 35.0,
              upper_bound: 95.0,
              z_score: 4.2,
              outlier_type: 'HIGH',
              severity: 'EXTREME'
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{
            outlier_id: 'outlier-1',
            detection_timestamp: new Date()
          }]
        });

      const result = await service.detectOutliers(
        'tenant-123',
        'facility-456',
        'volume_utilization',
        'MODIFIED_Z_SCORE'
      );

      expect(result).toHaveLength(1);
      expect(result[0].zScore).toBe(4.2);
      expect(result[0].outlierSeverity).toBe('EXTREME');
      expect(result[0].requiresInvestigation).toBe(true);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return empty array when no outliers detected', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await service.detectOutliers(
        'tenant-123',
        'facility-456',
        'volume_utilization',
        'IQR'
      );

      expect(result).toHaveLength(0);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('analyzeCorrelation', () => {
    it('should calculate strong positive correlation', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            pearson_corr: 0.85,
            spearman_corr: 0.82,
            slope: 0.75,
            intercept: 0.15,
            r_squared: 0.72,
            sample_size: 200
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            correlation_id: 'corr-1',
            analysis_date: new Date()
          }]
        });

      const result = await service.analyzeCorrelation(
        'tenant-123',
        'facility-456',
        'confidence_score',
        'acceptance_rate'
      );

      expect(result.pearsonCorrelation).toBe(0.85);
      expect(result.spearmanCorrelation).toBe(0.82);
      expect(result.correlationStrength).toBe('VERY_STRONG');
      expect(result.relationshipType).toBe('POSITIVE');
      expect(result.rSquared).toBe(0.72);
      expect(result.isSignificant).toBe(true);

      expect(result.interpretation).toContain('VERY_STRONG');
      expect(result.interpretation).toContain('positive');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should calculate moderate negative correlation', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            pearson_corr: -0.45,
            spearman_corr: -0.48,
            slope: -0.32,
            intercept: 0.85,
            r_squared: 0.20,
            sample_size: 150
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            correlation_id: 'corr-1',
            analysis_date: new Date()
          }]
        });

      const result = await service.analyzeCorrelation(
        'tenant-123',
        'facility-456',
        'utilization',
        'reslotting_frequency'
      );

      expect(result.pearsonCorrelation).toBe(-0.45);
      expect(result.correlationStrength).toBe('MODERATE');
      expect(result.relationshipType).toBe('NEGATIVE');
      expect(result.rSquared).toBe(0.20);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should identify weak/no correlation', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            pearson_corr: 0.08,
            spearman_corr: 0.05,
            slope: 0.02,
            intercept: 0.50,
            r_squared: 0.006,
            sample_size: 100
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            correlation_id: 'corr-1',
            analysis_date: new Date()
          }]
        });

      const result = await service.analyzeCorrelation(
        'tenant-123',
        'facility-456',
        'feature_x',
        'feature_y'
      );

      expect(result.pearsonCorrelation).toBe(0.08);
      expect(result.correlationStrength).toBe('VERY_WEAK');
      expect(result.relationshipType).toBe('NONE');
      expect(result.isSignificant).toBe(false);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle null correlation (no variation)', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            pearson_corr: null,
            spearman_corr: null,
            slope: null,
            intercept: null,
            r_squared: null,
            sample_size: 50
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            correlation_id: 'corr-1',
            analysis_date: new Date()
          }]
        });

      const result = await service.analyzeCorrelation(
        'tenant-123',
        'facility-456',
        'constant_feature',
        'another_constant'
      );

      expect(result.pearsonCorrelation).toBe(0);
      expect(result.correlationStrength).toBe('VERY_WEAK');
      expect(result.relationshipType).toBe('NONE');

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getStatisticalSummary', () => {
    it('should return statistical summary with trends', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Refresh materialized view
        .mockResolvedValueOnce({
          rows: [{
            tenant_id: 'tenant-123',
            facility_id: 'facility-456',
            last_update: new Date('2024-01-31'),
            algorithm_version: 'V2.0_ENHANCED',
            current_acceptance_rate: 0.92,
            current_avg_utilization: 78.5,
            current_std_dev_utilization: 10.2,
            current_target_achievement: 0.88,
            current_ml_accuracy: 0.94,
            current_sample_size: 250,
            is_statistically_significant: true,
            utilization_trend_slope: 0.0005,
            utilization_trend_direction: 'IMPROVING',
            acceptance_trend_slope: 0.0003,
            acceptance_trend_direction: 'IMPROVING',
            measurements_in_30d: 30,
            first_measurement: new Date('2024-01-01'),
            last_measurement: new Date('2024-01-31'),
            active_outliers: 3,
            critical_outliers: 1
          }]
        });

      const result = await service.getStatisticalSummary(
        'tenant-123',
        'facility-456'
      );

      expect(result).not.toBeNull();
      expect(result!.currentAcceptanceRate).toBe(0.92);
      expect(result!.currentAvgUtilization).toBe(78.5);
      expect(result!.utilizationTrendDirection).toBe('IMPROVING');
      expect(result!.acceptanceTrendDirection).toBe('IMPROVING');
      expect(result!.isStatisticallySignificant).toBe(true);
      expect(result!.measurementsIn30d).toBe(30);
      expect(result!.activeOutliers).toBe(3);
      expect(result!.criticalOutliers).toBe(1);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return null when no data exists', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Refresh
        .mockResolvedValueOnce({ rows: [] }); // No data

      const result = await service.getStatisticalSummary(
        'tenant-123',
        'facility-456'
      );

      expect(result).toBeNull();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should identify declining trends', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            tenant_id: 'tenant-123',
            facility_id: 'facility-456',
            last_update: new Date(),
            algorithm_version: 'V2.0_ENHANCED',
            current_acceptance_rate: 0.75,
            current_avg_utilization: 65.0,
            current_std_dev_utilization: 15.0,
            current_target_achievement: 0.70,
            current_ml_accuracy: 0.80,
            current_sample_size: 100,
            is_statistically_significant: true,
            utilization_trend_slope: -0.0008,
            utilization_trend_direction: 'DECLINING',
            acceptance_trend_slope: -0.0005,
            acceptance_trend_direction: 'DECLINING',
            measurements_in_30d: 25,
            first_measurement: new Date('2024-01-01'),
            last_measurement: new Date('2024-01-30'),
            active_outliers: 8,
            critical_outliers: 4
          }]
        });

      const result = await service.getStatisticalSummary(
        'tenant-123',
        'facility-456'
      );

      expect(result!.utilizationTrendDirection).toBe('DECLINING');
      expect(result!.acceptanceTrendDirection).toBe('DECLINING');
      expect(result!.criticalOutliers).toBe(4);

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should release client on error', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);
      mockClient.query.mockRejectedValue(new Error('Database error'));

      await expect(
        service.calculateStatisticalMetrics(
          'tenant-123',
          'facility-456',
          new Date(),
          new Date(),
          'user-789'
        )
      ).rejects.toThrow('Database error');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(
        service.detectOutliers('tenant-123', 'facility-456', 'metric', 'IQR')
      ).rejects.toThrow('Connection failed');
    });
  });
});
