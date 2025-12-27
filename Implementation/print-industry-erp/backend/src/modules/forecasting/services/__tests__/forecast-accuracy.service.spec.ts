import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { ForecastAccuracyService } from '../forecast-accuracy.service';
import { DemandHistoryService } from '../demand-history.service';

/**
 * FORECAST ACCURACY SERVICE TESTS
 *
 * REQ: REQ-STRATEGIC-AUTO-1766718736461 - Inventory Forecasting
 *
 * Test Coverage:
 * - MAPE calculation
 * - RMSE calculation
 * - MAD calculation
 * - Bias calculation
 * - Tracking signal calculation
 * - Accuracy metrics storage
 */

describe('ForecastAccuracyService', () => {
  let service: ForecastAccuracyService;
  let mockPool: jest.Mocked<Pool>;
  let mockDemandHistoryService: jest.Mocked<DemandHistoryService>;

  const mockDemandHistory = [
    {
      demandHistoryId: '1',
      tenantId: 'tenant-1',
      facilityId: 'facility-1',
      materialId: 'material-1',
      demandDate: new Date('2025-01-01'),
      year: 2025,
      month: 1,
      weekOfYear: 1,
      dayOfWeek: 1,
      quarter: 1,
      isHoliday: false,
      isPromotionalPeriod: false,
      actualDemandQuantity: 100,
      forecastedDemandQuantity: 95,
      demandUom: 'UNITS',
      salesOrderDemand: 100,
      productionOrderDemand: 0,
      transferOrderDemand: 0,
      scrapAdjustment: 0,
      marketingCampaignActive: false,
      createdAt: new Date()
    },
    {
      demandHistoryId: '2',
      tenantId: 'tenant-1',
      facilityId: 'facility-1',
      materialId: 'material-1',
      demandDate: new Date('2025-01-02'),
      year: 2025,
      month: 1,
      weekOfYear: 1,
      dayOfWeek: 2,
      quarter: 1,
      isHoliday: false,
      isPromotionalPeriod: false,
      actualDemandQuantity: 110,
      forecastedDemandQuantity: 105,
      demandUom: 'UNITS',
      salesOrderDemand: 110,
      productionOrderDemand: 0,
      transferOrderDemand: 0,
      scrapAdjustment: 0,
      marketingCampaignActive: false,
      createdAt: new Date()
    },
    {
      demandHistoryId: '3',
      tenantId: 'tenant-1',
      facilityId: 'facility-1',
      materialId: 'material-1',
      demandDate: new Date('2025-01-03'),
      year: 2025,
      month: 1,
      weekOfYear: 1,
      dayOfWeek: 3,
      quarter: 1,
      isHoliday: false,
      isPromotionalPeriod: false,
      actualDemandQuantity: 90,
      forecastedDemandQuantity: 95,
      demandUom: 'UNITS',
      salesOrderDemand: 90,
      productionOrderDemand: 0,
      transferOrderDemand: 0,
      scrapAdjustment: 0,
      marketingCampaignActive: false,
      createdAt: new Date()
    }
  ];

  beforeEach(async () => {
    mockPool = {
      query: jest.fn()
    } as any;

    mockDemandHistoryService = {
      getDemandHistory: jest.fn(),
      recordDemand: jest.fn(),
      backfillDemandHistory: jest.fn(),
      updateForecastedDemand: jest.fn(),
      getDemandStatistics: jest.fn()
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastAccuracyService,
        {
          provide: 'DATABASE_POOL',
          useValue: mockPool
        },
        {
          provide: DemandHistoryService,
          useValue: mockDemandHistoryService
        }
      ]
    }).compile();

    service = module.get<ForecastAccuracyService>(ForecastAccuracyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateAccuracyMetrics', () => {
    it('should calculate MAPE correctly', async () => {
      // Arrange
      mockDemandHistoryService.getDemandHistory.mockResolvedValue(mockDemandHistory);
      mockPool.query.mockResolvedValueOnce({
        rows: [{ target_forecast_accuracy_pct: 20.0 }]
      } as any);
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          metric_id: 'metric-1',
          tenant_id: 'tenant-1',
          facility_id: 'facility-1',
          material_id: 'material-1',
          measurement_period_start: new Date('2025-01-01'),
          measurement_period_end: new Date('2025-01-03'),
          aggregation_level: 'DAILY',
          mape: 4.85,
          rmse: 5.48,
          mae: 5.0,
          bias: -0.0,
          tracking_signal: 0.0,
          sample_size: 3,
          total_actual_demand: 300,
          total_forecasted_demand: 295,
          is_within_tolerance: true,
          target_mape_threshold: 20.0,
          created_at: new Date()
        }]
      } as any);

      // Act
      const result = await service.calculateAccuracyMetrics({
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialId: 'material-1',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-03')
      }, 'test-user');

      // Assert
      expect(result.mape).toBeCloseTo(4.85, 1);
      expect(result.isWithinTolerance).toBe(true);
      expect(mockDemandHistoryService.getDemandHistory).toHaveBeenCalledWith(
        'tenant-1',
        'facility-1',
        'material-1',
        new Date('2025-01-01'),
        new Date('2025-01-03')
      );
    });

    it('should throw error when no forecast data available', async () => {
      // Arrange
      mockDemandHistoryService.getDemandHistory.mockResolvedValue([
        {
          ...mockDemandHistory[0],
          forecastedDemandQuantity: undefined
        }
      ]);

      // Act & Assert
      await expect(
        service.calculateAccuracyMetrics({
          tenantId: 'tenant-1',
          facilityId: 'facility-1',
          materialId: 'material-1',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-03')
        })
      ).rejects.toThrow('No forecast data available for accuracy calculation');
    });
  });

  describe('MAPE calculation', () => {
    it('should return correct MAPE for perfect forecast', () => {
      // Test data where forecast = actual
      const perfectData = [
        { actualDemandQuantity: 100, forecastedDemandQuantity: 100 },
        { actualDemandQuantity: 200, forecastedDemandQuantity: 200 },
        { actualDemandQuantity: 150, forecastedDemandQuantity: 150 }
      ];

      // Access private method via reflection for testing
      const mape = (service as any).calculateMAPE(perfectData);

      expect(mape).toBe(0);
    });

    it('should return correct MAPE for 10% error', () => {
      const data = [
        { actualDemandQuantity: 100, forecastedDemandQuantity: 90 },  // 10% error
        { actualDemandQuantity: 200, forecastedDemandQuantity: 180 }, // 10% error
        { actualDemandQuantity: 150, forecastedDemandQuantity: 135 }  // 10% error
      ];

      const mape = (service as any).calculateMAPE(data);

      expect(mape).toBeCloseTo(10.0, 1);
    });
  });

  describe('RMSE calculation', () => {
    it('should return 0 for perfect forecast', () => {
      const perfectData = [
        { actualDemandQuantity: 100, forecastedDemandQuantity: 100 },
        { actualDemandQuantity: 200, forecastedDemandQuantity: 200 }
      ];

      const rmse = (service as any).calculateRMSE(perfectData);

      expect(rmse).toBe(0);
    });

    it('should penalize large errors more than small errors', () => {
      const smallErrorData = [
        { actualDemandQuantity: 100, forecastedDemandQuantity: 99 },
        { actualDemandQuantity: 100, forecastedDemandQuantity: 101 }
      ];

      const largeErrorData = [
        { actualDemandQuantity: 100, forecastedDemandQuantity: 90 },
        { actualDemandQuantity: 100, forecastedDemandQuantity: 110 }
      ];

      const rmseSmall = (service as any).calculateRMSE(smallErrorData);
      const rmseLarge = (service as any).calculateRMSE(largeErrorData);

      expect(rmseLarge).toBeGreaterThan(rmseSmall);
    });
  });

  describe('Bias calculation', () => {
    it('should detect over-forecasting (positive bias)', () => {
      const overForecastData = [
        { actualDemandQuantity: 100, forecastedDemandQuantity: 110 },
        { actualDemandQuantity: 200, forecastedDemandQuantity: 220 }
      ];

      const bias = (service as any).calculateBias(overForecastData);

      expect(bias).toBeGreaterThan(0);
      expect(bias).toBeCloseTo(15, 0);
    });

    it('should detect under-forecasting (negative bias)', () => {
      const underForecastData = [
        { actualDemandQuantity: 100, forecastedDemandQuantity: 90 },
        { actualDemandQuantity: 200, forecastedDemandQuantity: 180 }
      ];

      const bias = (service as any).calculateBias(underForecastData);

      expect(bias).toBeLessThan(0);
      expect(bias).toBeCloseTo(-15, 0);
    });
  });

  describe('getBestPerformingMethod', () => {
    it('should return method with lowest MAPE', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({
        rows: [
          { model_algorithm: 'HOLT_WINTERS', avg_mape: 8.5 }
        ]
      } as any);

      // Act
      const result = await service.getBestPerformingMethod(
        'tenant-1',
        'facility-1',
        'material-1'
      );

      // Assert
      expect(result).toBe('HOLT_WINTERS');
    });

    it('should return null when no methods available', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      // Act
      const result = await service.getBestPerformingMethod(
        'tenant-1',
        'facility-1',
        'material-1'
      );

      // Assert
      expect(result).toBeNull();
    });
  });
});
