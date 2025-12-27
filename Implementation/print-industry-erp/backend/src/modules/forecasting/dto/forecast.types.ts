import { ObjectType, Field, Int, Float, registerEnumType } from '@nestjs/graphql';

/**
 * GraphQL Object Type Definitions for Forecasting Module
 * Phase 2 NestJS Migration
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum ForecastHorizonType {
  SHORT_TERM = 'SHORT_TERM',
  MEDIUM_TERM = 'MEDIUM_TERM',
  LONG_TERM = 'LONG_TERM',
}

export enum ForecastAlgorithm {
  MOVING_AVERAGE = 'MOVING_AVERAGE',
  EXP_SMOOTHING = 'EXP_SMOOTHING',
  HOLT_WINTERS = 'HOLT_WINTERS',
  SARIMA = 'SARIMA',
  LIGHTGBM = 'LIGHTGBM',
}

export enum ForecastStatus {
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  REJECTED = 'REJECTED',
}

export enum AggregationLevel {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
}

export enum CalculationMethod {
  BASIC = 'BASIC',
  DEMAND_VARIABILITY = 'DEMAND_VARIABILITY',
  LEAD_TIME_VARIABILITY = 'LEAD_TIME_VARIABILITY',
  COMBINED_VARIABILITY = 'COMBINED_VARIABILITY',
  FORECAST_BASED = 'FORECAST_BASED',
  REORDER_POINT = 'REORDER_POINT',
  MIN_MAX = 'MIN_MAX',
  EOQ = 'EOQ',
}

export enum SuggestionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CONVERTED_TO_PO = 'CONVERTED_TO_PO',
  EXPIRED = 'EXPIRED',
}

export enum UrgencyLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Register enums with GraphQL
registerEnumType(ForecastHorizonType, { name: 'ForecastHorizonType' });
registerEnumType(ForecastAlgorithm, { name: 'ForecastAlgorithm' });
registerEnumType(ForecastStatus, { name: 'ForecastStatus' });
registerEnumType(AggregationLevel, { name: 'AggregationLevel' });
registerEnumType(CalculationMethod, { name: 'CalculationMethod' });
registerEnumType(SuggestionStatus, { name: 'SuggestionStatus' });
registerEnumType(UrgencyLevel, { name: 'UrgencyLevel' });

// ============================================================================
// OBJECT TYPES
// ============================================================================

@ObjectType()
export class MaterialForecast {
  @Field()
  forecastId: string;

  @Field()
  tenantId: string;

  @Field()
  facilityId: string;

  @Field()
  materialId: string;

  @Field({ nullable: true })
  forecastModelId?: string;

  @Field()
  forecastGenerationTimestamp: Date;

  @Field(() => Int)
  forecastVersion: number;

  @Field(() => ForecastHorizonType)
  forecastHorizonType: ForecastHorizonType;

  @Field(() => ForecastAlgorithm)
  forecastAlgorithm: ForecastAlgorithm;

  @Field()
  forecastDate: Date;

  @Field(() => Int)
  forecastYear: number;

  @Field(() => Int)
  forecastMonth: number;

  @Field(() => Int)
  forecastWeekOfYear: number;

  @Field(() => Float)
  forecastedDemandQuantity: number;

  @Field()
  forecastUom: string;

  @Field(() => Float, { nullable: true })
  lowerBound80Pct?: number;

  @Field(() => Float, { nullable: true })
  upperBound80Pct?: number;

  @Field(() => Float, { nullable: true })
  lowerBound95Pct?: number;

  @Field(() => Float, { nullable: true })
  upperBound95Pct?: number;

  @Field(() => Float, { nullable: true })
  modelConfidenceScore?: number;

  @Field()
  isManuallyOverridden: boolean;

  @Field(() => Float, { nullable: true })
  manualOverrideQuantity?: number;

  @Field({ nullable: true })
  manualOverrideBy?: string;

  @Field({ nullable: true })
  manualOverrideReason?: string;

  @Field(() => ForecastStatus)
  forecastStatus: ForecastStatus;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class DemandHistoryRecord {
  @Field()
  demandHistoryId: string;

  @Field()
  tenantId: string;

  @Field()
  facilityId: string;

  @Field()
  materialId: string;

  @Field()
  demandDate: Date;

  @Field(() => Int)
  year: number;

  @Field(() => Int)
  month: number;

  @Field(() => Int)
  weekOfYear: number;

  @Field(() => Int)
  dayOfWeek: number;

  @Field(() => Int)
  quarter: number;

  @Field()
  isHoliday: boolean;

  @Field()
  isPromotionalPeriod: boolean;

  @Field(() => Float)
  actualDemandQuantity: number;

  @Field(() => Float, { nullable: true })
  forecastedDemandQuantity?: number;

  @Field()
  demandUom: string;

  @Field(() => Float)
  salesOrderDemand: number;

  @Field(() => Float)
  productionOrderDemand: number;

  @Field(() => Float)
  transferOrderDemand: number;

  @Field(() => Float)
  scrapAdjustment: number;

  @Field(() => Float, { nullable: true })
  avgUnitPrice?: number;

  @Field(() => Float, { nullable: true })
  promotionalDiscountPct?: number;

  @Field()
  marketingCampaignActive: boolean;

  @Field(() => Float, { nullable: true })
  forecastError?: number;

  @Field(() => Float, { nullable: true })
  absolutePercentageError?: number;

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  createdBy?: string;
}

@ObjectType()
export class ForecastAccuracyMetrics {
  @Field()
  metricId: string;

  @Field()
  tenantId: string;

  @Field()
  facilityId: string;

  @Field()
  materialId: string;

  @Field({ nullable: true })
  forecastModelId?: string;

  @Field()
  measurementPeriodStart: Date;

  @Field()
  measurementPeriodEnd: Date;

  @Field(() => AggregationLevel)
  aggregationLevel: AggregationLevel;

  @Field(() => Float, { nullable: true })
  mape?: number;

  @Field(() => Float, { nullable: true })
  rmse?: number;

  @Field(() => Float, { nullable: true })
  mae?: number;

  @Field(() => Float, { nullable: true })
  mad?: number;

  @Field(() => Float, { nullable: true })
  bias?: number;

  @Field(() => Float, { nullable: true })
  trackingSignal?: number;

  @Field(() => Int)
  sampleSize: number;

  @Field(() => Float)
  totalActualDemand: number;

  @Field(() => Float)
  totalForecastedDemand: number;

  @Field()
  isWithinTolerance: boolean;

  @Field(() => Float)
  targetMapeThreshold: number;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class SafetyStockCalculation {
  @Field()
  materialId: string;

  @Field(() => Float)
  safetyStockQuantity: number;

  @Field(() => Float)
  reorderPoint: number;

  @Field(() => Float)
  economicOrderQuantity: number;

  @Field(() => CalculationMethod)
  calculationMethod: CalculationMethod;

  @Field(() => Float)
  avgDailyDemand: number;

  @Field(() => Float)
  demandStdDev: number;

  @Field(() => Float)
  avgLeadTimeDays: number;

  @Field(() => Float)
  leadTimeStdDev: number;

  @Field(() => Float)
  serviceLevel: number;

  @Field(() => Float)
  zScore: number;
}

@ObjectType()
export class ReplenishmentRecommendation {
  @Field()
  suggestionId: string;

  @Field()
  tenantId: string;

  @Field()
  facilityId: string;

  @Field()
  materialId: string;

  @Field({ nullable: true })
  preferredVendorId?: string;

  @Field()
  suggestionGenerationTimestamp: Date;

  @Field(() => SuggestionStatus)
  suggestionStatus: SuggestionStatus;

  @Field(() => Float)
  currentOnHandQuantity: number;

  @Field(() => Float)
  currentAllocatedQuantity: number;

  @Field(() => Float)
  currentAvailableQuantity: number;

  @Field(() => Float)
  currentOnOrderQuantity: number;

  @Field(() => Float)
  safetyStockQuantity: number;

  @Field(() => Float)
  reorderPointQuantity: number;

  @Field(() => Float)
  economicOrderQuantity: number;

  @Field(() => Float)
  forecastedDemand30Days: number;

  @Field(() => Float, { nullable: true })
  forecastedDemand60Days?: number;

  @Field(() => Float, { nullable: true })
  forecastedDemand90Days?: number;

  @Field({ nullable: true })
  projectedStockoutDate?: Date;

  @Field(() => Float)
  recommendedOrderQuantity: number;

  @Field()
  recommendedOrderUom: string;

  @Field()
  recommendedOrderDate: Date;

  @Field({ nullable: true })
  recommendedDeliveryDate?: Date;

  @Field(() => Float, { nullable: true })
  estimatedUnitCost?: number;

  @Field(() => Float, { nullable: true })
  estimatedTotalCost?: number;

  @Field(() => Int, { nullable: true })
  vendorLeadTimeDays?: number;

  @Field()
  suggestionReason: string;

  @Field(() => CalculationMethod)
  calculationMethod: CalculationMethod;

  @Field(() => UrgencyLevel, { nullable: true })
  urgencyLevel?: UrgencyLevel;

  @Field(() => Int, { nullable: true })
  daysUntilStockout?: number;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class ForecastAccuracySummary {
  @Field()
  materialId: string;

  @Field(() => Float, { nullable: true })
  last30DaysMape?: number;

  @Field(() => Float, { nullable: true })
  last60DaysMape?: number;

  @Field(() => Float, { nullable: true })
  last90DaysMape?: number;

  @Field(() => Float, { nullable: true })
  last30DaysBias?: number;

  @Field(() => Float, { nullable: true })
  last60DaysBias?: number;

  @Field(() => Float, { nullable: true })
  last90DaysBias?: number;

  @Field(() => Int)
  totalForecastsGenerated: number;

  @Field(() => Int)
  totalActualDemandRecorded: number;

  @Field({ nullable: true })
  currentForecastAlgorithm?: string;

  @Field({ nullable: true })
  lastForecastGenerationDate?: Date;
}
