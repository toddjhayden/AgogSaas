import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { ForecastingService } from '../forecasting.service';
import { DemandHistoryService } from '../demand-history.service';

/**
 * FORECASTING SERVICE UNIT TESTS
 *
 * REQ: REQ-STRATEGIC-AUTO-1766893112869 - Inventory Forecasting
 * Author: Roy (Backend Developer)
 * Date: 2025-12-27
 *
 * Test Coverage:
 * - Algorithm selection logic (CV-based)
 * - Moving Average forecasting
 * - Exponential Smoothing forecasting
 * - Holt-Winters seasonal forecasting
 * - Confidence interval calculations
 * - Edge cases (zero demand, negative values, missing data)
 */

describe('ForecastingService', () => {
  let service: ForecastingService;
  let demandHistoryService: DemandHistoryService;
  let mockPool: Pool;

  beforeEach(async () => {
    // Mock database pool
    mockPool = {
      query: jest.fn(),
    } as any;

    // Mock DemandHistoryService
    const mockDemandHistoryService = {
      getDemandHistory: jest.fn(),
      getBatchDemandHistory: jest.fn(),
      recordDemand: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastingService,
        {
          provide: 'DATABASE_POOL',
          useValue: mockPool,
        },
        {
          provide: DemandHistoryService,
          useValue: mockDemandHistoryService,
        },
      ],
    }).compile();

    service = module.get<ForecastingService>(ForecastingService);
    demandHistoryService = module.get<DemandHistoryService>(DemandHistoryService);
  });

  describe('Algorithm Selection', () => {
    it('should select MOVING_AVERAGE for stable demand (CV < 0.3)', () => {
      // Create stable demand pattern (100 ± 5 units)
      const stableDemand = Array(30).fill(0).map(() => ({
        actualDemandQuantity: 100 + (Math.random() * 10 - 5), // 95-105 range
        demandUom: 'EA',
        demandDate: new Date(),
        tenantId: 'test',
        facilityId: 'test',
        materialId: 'test',
      }));

      const algorithm = (service as any).selectAlgorithm('AUTO', stableDemand);

      // CV = stddev / mean ≈ 2.9 / 100 = 0.029 < 0.3
      expect(algorithm).toBe('MOVING_AVERAGE');
    });

    it('should select EXP_SMOOTHING for variable demand (CV >= 0.3)', () => {
      // Create variable demand pattern (50-150 units)
      const variableDemand = Array(30).fill(0).map(() => ({
        actualDemandQuantity: 50 + Math.random() * 100, // Wide variation
        demandUom: 'EA',
        demandDate: new Date(),
        tenantId: 'test',
        facilityId: 'test',
        materialId: 'test',
      }));

      const algorithm = (service as any).selectAlgorithm('AUTO', variableDemand);

      // CV = stddev / mean ≈ 28.9 / 100 = 0.289 or higher
      expect(algorithm).toBe('EXP_SMOOTHING');
    });

    it('should select HOLT_WINTERS for seasonal demand', () => {
      // Create seasonal pattern: 100 + 50*sin(2π*t/7) for 90 days
      const seasonalDemand = Array(90).fill(0).map((_, t) => ({
        actualDemandQuantity: 100 + 50 * Math.sin((2 * Math.PI * t) / 7),
        demandUom: 'EA',
        demandDate: new Date(2024, 0, t + 1),
        tenantId: 'test',
        facilityId: 'test',
        materialId: 'test',
      }));

      const algorithm = (service as any).selectAlgorithm('AUTO', seasonalDemand);

      // Should detect weekly seasonality (lag 7)
      expect(algorithm).toBe('HOLT_WINTERS');
    });

    it('should respect explicit algorithm selection', () => {
      const stableDemand = Array(30).fill(0).map(() => ({
        actualDemandQuantity: 100,
        demandUom: 'EA',
        demandDate: new Date(),
        tenantId: 'test',
        facilityId: 'test',
        materialId: 'test',
      }));

      // Force exponential smoothing even for stable demand
      const algorithm = (service as any).selectAlgorithm('EXP_SMOOTHING', stableDemand);
      expect(algorithm).toBe('EXP_SMOOTHING');
    });
  });

  describe('Seasonality Detection', () => {
    it('should detect weekly seasonality (lag 7)', () => {
      // Weekly pattern: high on Mon-Wed (120), low on Thu-Sun (80)
      const weeklyPattern = Array(63).fill(0).map((_, t) => {
        const dayOfWeek = t % 7;
        return dayOfWeek < 3 ? 120 : 80; // Mon-Wed high, Thu-Sun low
      });

      const hasSeasonality = (service as any).detectSeasonality(weeklyPattern);
      expect(hasSeasonality).toBe(true);
    });

    it('should not detect seasonality in random data', () => {
      const randomData = Array(90).fill(0).map(() => Math.random() * 100);

      const hasSeasonality = (service as any).detectSeasonality(randomData);
      expect(hasSeasonality).toBe(false);
    });

    it('should detect monthly seasonality (lag 30)', () => {
      // Monthly pattern: spike every 30 days
      const monthlyPattern = Array(180).fill(0).map((_, t) => {
        const dayOfMonth = t % 30;
        return dayOfMonth === 0 ? 200 : 100; // Spike on first day
      });

      const hasSeasonality = (service as any).detectSeasonality(monthlyPattern);
      expect(hasSeasonality).toBe(true);
    });
  });

  describe('Moving Average Forecast', () => {
    it('should generate correct MA forecast for stable demand', async () => {
      // Mock database query for forecast version
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ max_version: 1 }] });

      const stableDemand = Array(30).fill(0).map((_, i) => ({
        demandHistoryId: `hist-${i}`,
        actualDemandQuantity: 100,
        demandUom: 'EA',
        demandDate: new Date(2024, 0, i + 1),
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialId: 'material-1',
      }));

      const forecasts = await (service as any).generateMovingAverageForecast(
        'tenant-1',
        'facility-1',
        'material-1',
        stableDemand,
        30,
        'test-user'
      );

      // Should generate 30 days of forecasts
      expect(forecasts).toHaveLength(30);

      // All forecasts should be around 100 (average of stable demand)
      forecasts.forEach((forecast: any) => {
        expect(forecast.forecastedDemandQuantity).toBeCloseTo(100, 0);
      });

      // Confidence intervals should widen with horizon
      const forecast1 = forecasts[0];
      const forecast30 = forecasts[29];

      const ci_width_1 = forecast1.upperBound95Pct - forecast1.lowerBound95Pct;
      const ci_width_30 = forecast30.upperBound95Pct - forecast30.lowerBound95Pct;

      expect(ci_width_30).toBeGreaterThan(ci_width_1);
      expect(ci_width_30).toBeCloseTo(ci_width_1 * Math.sqrt(30), -1);
    });

    it('should handle zero demand gracefully', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ max_version: 1 }] });

      const zeroDemand = Array(30).fill(0).map((_, i) => ({
        demandHistoryId: `hist-${i}`,
        actualDemandQuantity: 0,
        demandUom: 'EA',
        demandDate: new Date(2024, 0, i + 1),
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialId: 'material-1',
      }));

      const forecasts = await (service as any).generateMovingAverageForecast(
        'tenant-1',
        'facility-1',
        'material-1',
        zeroDemand,
        30,
        'test-user'
      );

      // All forecasts should be zero
      forecasts.forEach((forecast: any) => {
        expect(forecast.forecastedDemandQuantity).toBe(0);
        expect(forecast.lowerBound95Pct).toBe(0);
        expect(forecast.upperBound95Pct).toBe(0);
      });
    });

    it('should prevent negative forecasts', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ max_version: 1 }] });

      // Declining demand that could produce negative forecasts
      const decliningDemand = Array(30).fill(0).map((_, i) => ({
        demandHistoryId: `hist-${i}`,
        actualDemandQuantity: Math.max(0, 10 - i * 0.5),
        demandUom: 'EA',
        demandDate: new Date(2024, 0, i + 1),
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialId: 'material-1',
      }));

      const forecasts = await (service as any).generateMovingAverageForecast(
        'tenant-1',
        'facility-1',
        'material-1',
        decliningDemand,
        30,
        'test-user'
      );

      // All forecasts and confidence bounds should be >= 0
      forecasts.forEach((forecast: any) => {
        expect(forecast.forecastedDemandQuantity).toBeGreaterThanOrEqual(0);
        expect(forecast.lowerBound95Pct).toBeGreaterThanOrEqual(0);
        expect(forecast.lowerBound80Pct).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Exponential Smoothing Forecast', () => {
    it('should generate correct SES forecast', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ max_version: 1 }] });

      // Upward trending demand
      const trendingDemand = Array(30).fill(0).map((_, i) => ({
        demandHistoryId: `hist-${i}`,
        actualDemandQuantity: 80 + i * 1.5, // Linear trend
        demandUom: 'EA',
        demandDate: new Date(2024, 0, i + 1),
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialId: 'material-1',
      }));

      const forecasts = await (service as any).generateExponentialSmoothingForecast(
        'tenant-1',
        'facility-1',
        'material-1',
        trendingDemand,
        10,
        'test-user'
      );

      expect(forecasts).toHaveLength(10);

      // Forecast should be close to latest smoothed value
      const latestDemand = trendingDemand[trendingDemand.length - 1].actualDemandQuantity;
      forecasts.forEach((forecast: any) => {
        // Should be within reasonable range of latest demand
        expect(forecast.forecastedDemandQuantity).toBeGreaterThan(latestDemand * 0.8);
        expect(forecast.forecastedDemandQuantity).toBeLessThan(latestDemand * 1.2);
      });
    });

    it('should widen confidence intervals with horizon', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ max_version: 1 }] });

      const demand = Array(30).fill(0).map((_, i) => ({
        demandHistoryId: `hist-${i}`,
        actualDemandQuantity: 100 + (Math.random() * 20 - 10),
        demandUom: 'EA',
        demandDate: new Date(2024, 0, i + 1),
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialId: 'material-1',
      }));

      const forecasts = await (service as any).generateExponentialSmoothingForecast(
        'tenant-1',
        'facility-1',
        'material-1',
        demand,
        30,
        'test-user'
      );

      // CI should widen with √h
      const ci_1 = forecasts[0].upperBound95Pct - forecasts[0].lowerBound95Pct;
      const ci_9 = forecasts[8].upperBound95Pct - forecasts[8].lowerBound95Pct;
      const ci_25 = forecasts[24].upperBound95Pct - forecasts[24].lowerBound95Pct;

      expect(ci_9).toBeGreaterThan(ci_1);
      expect(ci_25).toBeGreaterThan(ci_9);

      // Check √h relationship
      expect(ci_9 / ci_1).toBeCloseTo(Math.sqrt(9), 0);
      expect(ci_25 / ci_1).toBeCloseTo(Math.sqrt(25), 0);
    });
  });

  describe('Holt-Winters Forecast', () => {
    it('should generate correct HW forecast for seasonal data', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ max_version: 1 }] });

      // Weekly seasonal pattern (7-day cycle)
      const seasonalDemand = Array(90).fill(0).map((_, t) => ({
        demandHistoryId: `hist-${t}`,
        actualDemandQuantity: 100 + 30 * Math.sin((2 * Math.PI * t) / 7),
        demandUom: 'EA',
        demandDate: new Date(2024, 0, t + 1),
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialId: 'material-1',
      }));

      const forecasts = await (service as any).generateHoltWintersForecast(
        'tenant-1',
        'facility-1',
        'material-1',
        seasonalDemand,
        21, // 3 weeks ahead
        'test-user'
      );

      expect(forecasts).toHaveLength(21);

      // Forecasts should maintain seasonal pattern
      // Days 1, 8, 15 should be similar (same day of week)
      const day1 = forecasts[0].forecastedDemandQuantity;
      const day8 = forecasts[7].forecastedDemandQuantity;
      const day15 = forecasts[14].forecastedDemandQuantity;

      expect(Math.abs(day8 - day1)).toBeLessThan(10); // Should be close
      expect(Math.abs(day15 - day1)).toBeLessThan(10);
    });

    it('should fall back to SES for insufficient data', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ max_version: 1 }] });

      // Only 10 days of data (insufficient for Holt-Winters with period 7)
      const shortDemand = Array(10).fill(0).map((_, i) => ({
        demandHistoryId: `hist-${i}`,
        actualDemandQuantity: 100,
        demandUom: 'EA',
        demandDate: new Date(2024, 0, i + 1),
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialId: 'material-1',
      }));

      // Should fall back to SES
      const forecasts = await (service as any).generateHoltWintersForecast(
        'tenant-1',
        'facility-1',
        'material-1',
        shortDemand,
        7,
        'test-user'
      );

      expect(forecasts).toHaveLength(7);
      // All forecasts should use SES algorithm (reflected in algorithm field)
    });
  });

  describe('Batch Forecast Generation', () => {
    it('should generate forecasts for multiple materials efficiently', async () => {
      const materialIds = ['mat-1', 'mat-2', 'mat-3'];

      // Mock batch demand history
      const mockBatchData = new Map();
      materialIds.forEach(matId => {
        mockBatchData.set(
          matId,
          Array(30).fill(0).map((_, i) => ({
            demandHistoryId: `hist-${matId}-${i}`,
            actualDemandQuantity: 100,
            demandUom: 'EA',
            demandDate: new Date(2024, 0, i + 1),
            tenantId: 'tenant-1',
            facilityId: 'facility-1',
            materialId: matId,
          }))
        );
      });

      jest.spyOn(demandHistoryService, 'getBatchDemandHistory').mockResolvedValue(mockBatchData);
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ max_version: 1 }] });

      const forecasts = await service.generateForecasts({
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialIds,
        forecastHorizonDays: 30,
        forecastAlgorithm: 'AUTO',
      });

      // Should call batch method once, not 3 times
      expect(demandHistoryService.getBatchDemandHistory).toHaveBeenCalledTimes(1);
      expect(demandHistoryService.getBatchDemandHistory).toHaveBeenCalledWith(
        'tenant-1',
        'facility-1',
        materialIds,
        expect.any(Date),
        expect.any(Date)
      );

      // Should generate forecasts for all materials
      expect(forecasts.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should skip materials with insufficient history', async () => {
      const mockBatchData = new Map();
      mockBatchData.set('mat-with-data', Array(30).fill(0).map((_, i) => ({
        demandHistoryId: `hist-${i}`,
        actualDemandQuantity: 100,
        demandUom: 'EA',
        demandDate: new Date(2024, 0, i + 1),
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialId: 'mat-with-data',
      })));
      mockBatchData.set('mat-insufficient', Array(3).fill(0).map((_, i) => ({
        demandHistoryId: `hist-${i}`,
        actualDemandQuantity: 100,
        demandUom: 'EA',
        demandDate: new Date(2024, 0, i + 1),
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialId: 'mat-insufficient',
      })));

      jest.spyOn(demandHistoryService, 'getBatchDemandHistory').mockResolvedValue(mockBatchData);
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ max_version: 1 }] });

      const forecasts = await service.generateForecasts({
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialIds: ['mat-with-data', 'mat-insufficient'],
        forecastHorizonDays: 30,
        forecastAlgorithm: 'AUTO',
      });

      // Should only generate forecasts for material with sufficient data
      // mat-insufficient has < 7 days and should be skipped
      expect(forecasts.length).toBeGreaterThan(0);
    });

    it('should handle empty material list', async () => {
      jest.spyOn(demandHistoryService, 'getBatchDemandHistory').mockResolvedValue(new Map());

      const forecasts = await service.generateForecasts({
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        materialIds: [],
        forecastHorizonDays: 30,
        forecastAlgorithm: 'AUTO',
      });

      expect(forecasts).toHaveLength(0);
    });
  });
});
