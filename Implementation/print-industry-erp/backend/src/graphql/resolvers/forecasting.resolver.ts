import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { DemandHistoryService, RecordDemandInput } from '../../modules/forecasting/services/demand-history.service';
import { ForecastingService, GenerateForecastInput } from '../../modules/forecasting/services/forecasting.service';
import { SafetyStockService } from '../../modules/forecasting/services/safety-stock.service';
import { ForecastAccuracyService, CalculateAccuracyInput } from '../../modules/forecasting/services/forecast-accuracy.service';
import { ReplenishmentRecommendationService } from '../../modules/forecasting/services/replenishment-recommendation.service';
import {
  MaterialForecast,
  DemandHistoryRecord,
  ForecastAccuracyMetrics,
  SafetyStockCalculation,
  ReplenishmentRecommendation,
  ForecastAccuracySummary,
  ForecastStatus,
  UrgencyLevel,
} from '../../modules/forecasting/dto/forecast.types';

/**
 * FORECASTING RESOLVER
 *
 * Purpose: GraphQL API for inventory forecasting functionality
 *
 * Endpoints:
 * - Queries: getDemandHistory, getMaterialForecasts, calculateSafetyStock
 * - Mutations: generateForecasts, recordDemand, backfillDemandHistory
 *
 * REQ: REQ-STRATEGIC-AUTO-1766675619639 - Inventory Forecasting
 */

// Input types (not exposed to GraphQL schema, used internally)
interface CalculateSafetyStockInput {
  tenantId: string;
  facilityId: string;
  materialId: string;
  serviceLevel?: number;
}

interface GenerateRecommendationsInput {
  tenantId: string;
  facilityId: string;
  materialIds?: string[];
  urgencyLevelFilter?: UrgencyLevel;
}

@Resolver()
export class ForecastingResolver {
  constructor(
    private demandHistoryService: DemandHistoryService,
    private forecastingService: ForecastingService,
    private safetyStockService: SafetyStockService,
    private forecastAccuracyService: ForecastAccuracyService,
    private replenishmentRecommendationService: ReplenishmentRecommendationService
  ) {}

  // ============================================================================
  // QUERIES
  // ============================================================================

  @Query(() => [DemandHistoryRecord])
  async getDemandHistory(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string,
    @Args('materialId') materialId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date
  ): Promise<DemandHistoryRecord[]> {
    return this.demandHistoryService.getDemandHistory(
      tenantId,
      facilityId,
      materialId,
      startDate,
      endDate
    );
  }

  @Query(() => [MaterialForecast])
  async getMaterialForecasts(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string,
    @Args('materialId') materialId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Args('forecastStatus', { nullable: true }) forecastStatus?: ForecastStatus
  ): Promise<MaterialForecast[]> {
    return this.forecastingService.getMaterialForecasts(
      tenantId,
      facilityId,
      materialId,
      startDate,
      endDate,
      forecastStatus
    );
  }

  @Query(() => SafetyStockCalculation)
  async calculateSafetyStock(
    @Args('input') input: CalculateSafetyStockInput
  ): Promise<SafetyStockCalculation> {
    return this.safetyStockService.calculateSafetyStock(
      input.tenantId,
      input.facilityId,
      input.materialId,
      input.serviceLevel || 0.95
    );
  }

  @Query(() => [ForecastAccuracySummary])
  async getForecastAccuracySummary(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string,
    @Args('materialIds', { type: () => [String], nullable: true }) materialIds?: string[]
  ): Promise<ForecastAccuracySummary[]> {
    const summaries: ForecastAccuracySummary[] = [];

    if (!materialIds || materialIds.length === 0) {
      return summaries;
    }

    // Calculate date ranges for different periods
    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);
    const last60Days = new Date(now);
    last60Days.setDate(last60Days.getDate() - 60);
    const last90Days = new Date(now);
    last90Days.setDate(last90Days.getDate() - 90);

    for (const materialId of materialIds) {
      try {
        // Get metrics for different time periods
        const metrics30 = await this.forecastAccuracyService.getAccuracyMetrics(
          tenantId,
          facilityId,
          materialId,
          last30Days,
          now
        );

        const metrics60 = await this.forecastAccuracyService.getAccuracyMetrics(
          tenantId,
          facilityId,
          materialId,
          last60Days,
          now
        );

        const metrics90 = await this.forecastAccuracyService.getAccuracyMetrics(
          tenantId,
          facilityId,
          materialId,
          last90Days,
          now
        );

        // Calculate averages for each period
        const avg30Mape = metrics30.length > 0
          ? metrics30.reduce((sum, m) => sum + (m.mape || 0), 0) / metrics30.length
          : undefined;

        const avg60Mape = metrics60.length > 0
          ? metrics60.reduce((sum, m) => sum + (m.mape || 0), 0) / metrics60.length
          : undefined;

        const avg90Mape = metrics90.length > 0
          ? metrics90.reduce((sum, m) => sum + (m.mape || 0), 0) / metrics90.length
          : undefined;

        const avg30Bias = metrics30.length > 0
          ? metrics30.reduce((sum, m) => sum + (m.bias || 0), 0) / metrics30.length
          : undefined;

        const avg60Bias = metrics60.length > 0
          ? metrics60.reduce((sum, m) => sum + (m.bias || 0), 0) / metrics60.length
          : undefined;

        const avg90Bias = metrics90.length > 0
          ? metrics90.reduce((sum, m) => sum + (m.bias || 0), 0) / metrics90.length
          : undefined;

        // Get total forecasts and demand records count
        const totalForecasts = metrics90.reduce((sum, m) => sum + m.sampleSize, 0);
        const totalDemand = metrics90.reduce((sum, m) => sum + m.sampleSize, 0);

        // Get most recent forecast info
        const recentForecasts = await this.forecastingService.getMaterialForecasts(
          tenantId,
          facilityId,
          materialId,
          last30Days,
          now,
          ForecastStatus.ACTIVE
        );

        const currentAlgorithm = recentForecasts.length > 0
          ? recentForecasts[0].forecastAlgorithm
          : undefined;

        const lastForecastDate = recentForecasts.length > 0
          ? recentForecasts[0].forecastGenerationTimestamp
          : undefined;

        summaries.push({
          materialId,
          last30DaysMape: avg30Mape,
          last60DaysMape: avg60Mape,
          last90DaysMape: avg90Mape,
          last30DaysBias: avg30Bias,
          last60DaysBias: avg60Bias,
          last90DaysBias: avg90Bias,
          totalForecastsGenerated: totalForecasts,
          totalActualDemandRecorded: totalDemand,
          currentForecastAlgorithm: currentAlgorithm,
          lastForecastGenerationDate: lastForecastDate
        });
      } catch (error) {
        // If error fetching metrics for a material, return empty summary for that material
        console.error(`Error fetching forecast accuracy summary for material ${materialId}:`, error);
        summaries.push({
          materialId,
          totalForecastsGenerated: 0,
          totalActualDemandRecorded: 0
        });
      }
    }

    return summaries;
  }

  @Query(() => [ForecastAccuracyMetrics])
  async getForecastAccuracyMetrics(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string,
    @Args('materialId') materialId: string,
    @Args('periodStart', { nullable: true }) periodStart?: Date,
    @Args('periodEnd', { nullable: true }) periodEnd?: Date
  ): Promise<ForecastAccuracyMetrics[]> {
    return this.forecastAccuracyService.getAccuracyMetrics(
      tenantId,
      facilityId,
      materialId,
      periodStart,
      periodEnd
    );
  }

  @Query(() => [ReplenishmentRecommendation])
  async getReplenishmentRecommendations(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string,
    @Args('status', { nullable: true }) status?: string,
    @Args('materialId', { nullable: true }) materialId?: string
  ): Promise<ReplenishmentRecommendation[]> {
    return this.replenishmentRecommendationService.getRecommendations(
      tenantId,
      facilityId,
      { status, materialId }
    );
  }

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  @Mutation(() => [MaterialForecast])
  async generateForecasts(
    @Args('input') input: GenerateForecastInput
  ): Promise<MaterialForecast[]> {
    // TODO: Extract user from context
    const createdBy = 'system';

    return this.forecastingService.generateForecasts(input, createdBy);
  }

  @Mutation(() => DemandHistoryRecord)
  async recordDemand(
    @Args('input') input: RecordDemandInput
  ): Promise<DemandHistoryRecord> {
    // TODO: Extract user from context
    const createdBy = 'system';

    return this.demandHistoryService.recordDemand(input, createdBy);
  }

  @Mutation(() => Number)
  async backfillDemandHistory(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date
  ): Promise<number> {
    return this.demandHistoryService.backfillDemandHistory(
      tenantId,
      facilityId,
      startDate,
      endDate
    );
  }

  @Mutation(() => ForecastAccuracyMetrics)
  async calculateForecastAccuracy(
    @Args('input') input: CalculateAccuracyInput
  ): Promise<ForecastAccuracyMetrics> {
    // TODO: Extract user from context
    const createdBy = 'system';

    return this.forecastAccuracyService.calculateAccuracyMetrics(input, createdBy);
  }

  @Mutation(() => [ReplenishmentRecommendation])
  async generateReplenishmentRecommendations(
    @Args('input') input: GenerateRecommendationsInput
  ): Promise<ReplenishmentRecommendation[]> {
    // TODO: Extract user from context
    const createdBy = 'system';

    return this.replenishmentRecommendationService.generateRecommendations(input, createdBy);
  }
}
