import { Module } from '@nestjs/common';
import { ForecastingResolver } from '../../graphql/resolvers/forecasting.resolver';
import { ForecastingService } from './services/forecasting.service';
import { DemandHistoryService } from './services/demand-history.service';
import { ForecastAccuracyService } from './services/forecast-accuracy.service';
import { SafetyStockService } from './services/safety-stock.service';
import { ReplenishmentRecommendationService } from './services/replenishment-recommendation.service';

/**
 * FORECASTING MODULE
 *
 * Purpose: Inventory demand forecasting and replenishment planning
 *
 * Features:
 * - Demand history tracking
 * - Statistical forecasting (MA, EXP_SMOOTHING, HOLT_WINTERS)
 * - Forecast accuracy tracking (MAPE, RMSE, MAE, Bias)
 * - Safety stock calculation
 * - Replenishment recommendations
 *
 * Phase 2 NestJS Migration:
 * - Converted all services to use @Injectable()
 * - Registered resolver and services in module
 * - Integrated with DatabaseModule for dependency injection
 *
 * REQ: REQ-STRATEGIC-AUTO-1766675619639 - Inventory Forecasting
 */
@Module({
  providers: [
    // GraphQL Resolver
    ForecastingResolver,

    // Core Services
    ForecastingService,
    DemandHistoryService,
    ForecastAccuracyService,
    SafetyStockService,
    ReplenishmentRecommendationService,
  ],
  exports: [
    // Export services for use in other modules
    ForecastingService,
    DemandHistoryService,
    ForecastAccuracyService,
    SafetyStockService,
    ReplenishmentRecommendationService,
  ],
})
export class ForecastingModule {}
