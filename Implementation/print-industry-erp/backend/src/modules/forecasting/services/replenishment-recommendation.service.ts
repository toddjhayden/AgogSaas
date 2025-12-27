import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { ForecastingService } from './forecasting.service';
import { SafetyStockService } from './safety-stock.service';
import { SuggestionStatus, UrgencyLevel, CalculationMethod, ForecastStatus } from '../dto/forecast.types';

/**
 * REPLENISHMENT RECOMMENDATION SERVICE
 *
 * Purpose: Generate automated purchase order recommendations based on:
 * - Demand forecasts
 * - Current inventory levels
 * - Safety stock requirements
 * - Lead times
 *
 * Features:
 * - Calculate projected stockout dates
 * - Determine replenishment urgency
 * - Recommend order quantities
 * - Suggest order timing
 *
 * REQ: REQ-STRATEGIC-AUTO-1766718736461 - Inventory Forecasting
 */

export interface ReplenishmentRecommendation {
  suggestionId: string;
  tenantId: string;
  facilityId: string;
  materialId: string;
  preferredVendorId?: string;
  suggestionGenerationTimestamp: Date;
  suggestionStatus: SuggestionStatus;
  currentOnHandQuantity: number;
  currentAllocatedQuantity: number;
  currentAvailableQuantity: number;
  currentOnOrderQuantity: number;
  safetyStockQuantity: number;
  reorderPointQuantity: number;
  economicOrderQuantity: number;
  forecastedDemand30Days: number;
  forecastedDemand60Days?: number;
  forecastedDemand90Days?: number;
  projectedStockoutDate?: Date;
  recommendedOrderQuantity: number;
  recommendedOrderUom: string;
  recommendedOrderDate: Date;
  recommendedDeliveryDate?: Date;
  estimatedUnitCost?: number;
  estimatedTotalCost?: number;
  vendorLeadTimeDays?: number;
  suggestionReason: string;
  calculationMethod: CalculationMethod;
  urgencyLevel?: UrgencyLevel;
  daysUntilStockout?: number;
  createdAt: Date;
}

export interface GenerateRecommendationsInput {
  tenantId: string;
  facilityId: string;
  materialIds?: string[];
  urgencyLevelFilter?: UrgencyLevel;
}

@Injectable()
export class ReplenishmentRecommendationService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private forecastingService: ForecastingService,
    private safetyStockService: SafetyStockService
  ) {}

  /**
   * Generate replenishment recommendations for materials
   */
  async generateRecommendations(
    input: GenerateRecommendationsInput,
    createdBy?: string
  ): Promise<ReplenishmentRecommendation[]> {
    // Get materials to evaluate
    let materialIds = input.materialIds;
    if (!materialIds || materialIds.length === 0) {
      materialIds = await this.getActiveMaterialIds(input.tenantId, input.facilityId);
    }

    const recommendations: ReplenishmentRecommendation[] = [];

    for (const materialId of materialIds) {
      try {
        const recommendation = await this.generateSingleRecommendation(
          input.tenantId,
          input.facilityId,
          materialId,
          createdBy
        );

        if (recommendation) {
          // Filter by urgency if specified
          if (!input.urgencyLevelFilter || recommendation.urgencyLevel === input.urgencyLevelFilter) {
            recommendations.push(recommendation);
          }
        }
      } catch (error) {
        console.error(`Error generating recommendation for material ${materialId}:`, error);
        // Continue with next material
      }
    }

    return recommendations;
  }

  /**
   * Generate recommendation for a single material
   */
  private async generateSingleRecommendation(
    tenantId: string,
    facilityId: string,
    materialId: string,
    createdBy?: string
  ): Promise<ReplenishmentRecommendation | null> {
    // Get current inventory levels
    const inventoryLevels = await this.getCurrentInventoryLevels(tenantId, facilityId, materialId);

    // Get demand forecasts
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);

    const forecasts = await this.forecastingService.getMaterialForecasts(
      tenantId,
      facilityId,
      materialId,
      startDate,
      endDate,
      ForecastStatus.ACTIVE
    );

    if (forecasts.length === 0) {
      // No forecasts available - skip this material
      return null;
    }

    // Calculate aggregated forecast demands
    const forecastedDemand30Days = this.sumForecastDemand(forecasts, 30);
    const forecastedDemand60Days = this.sumForecastDemand(forecasts, 60);
    const forecastedDemand90Days = this.sumForecastDemand(forecasts, 90);

    // Calculate safety stock and reorder point
    const safetyStockCalc = await this.safetyStockService.calculateSafetyStock(
      tenantId,
      facilityId,
      materialId,
      0.95 // 95% service level
    );

    // Get material info
    const materialInfo = await this.getMaterialInfo(materialId);

    // Calculate projected stockout date
    const projectedStockoutDate = this.calculateStockoutDate(
      inventoryLevels.availableQuantity,
      forecasts,
      safetyStockCalc.safetyStockQuantity
    );

    // Calculate days until stockout
    const daysUntilStockout = projectedStockoutDate
      ? Math.ceil((projectedStockoutDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))
      : null;

    // Determine if replenishment is needed
    const needsReplenishment = this.shouldRecommendReplenishment(
      inventoryLevels.availableQuantity,
      inventoryLevels.onOrderQuantity,
      safetyStockCalc.reorderPoint,
      forecastedDemand30Days
    );

    if (!needsReplenishment) {
      return null;
    }

    // Calculate recommended order quantity
    const recommendedOrderQty = this.calculateOrderQuantity(
      inventoryLevels.availableQuantity,
      inventoryLevels.onOrderQuantity,
      forecastedDemand90Days,
      safetyStockCalc.economicOrderQuantity,
      materialInfo.minimumOrderQuantity,
      materialInfo.orderMultiple
    );

    // Determine urgency level
    const urgencyLevel = this.determineUrgencyLevel(
      daysUntilStockout,
      inventoryLevels.availableQuantity,
      safetyStockCalc.safetyStockQuantity
    );

    // Calculate recommended order date
    const recommendedOrderDate = this.calculateOrderDate(
      projectedStockoutDate,
      materialInfo.leadTimeDays
    );

    // Calculate estimated delivery date
    const recommendedDeliveryDate = new Date(recommendedOrderDate);
    recommendedDeliveryDate.setDate(recommendedDeliveryDate.getDate() + materialInfo.leadTimeDays);

    // Build suggestion reason
    const suggestionReason = this.buildSuggestionReason(
      inventoryLevels.availableQuantity,
      safetyStockCalc.reorderPoint,
      forecastedDemand30Days,
      daysUntilStockout
    );

    // Insert recommendation into database
    const recommendation = await this.insertRecommendation({
      tenantId,
      facilityId,
      materialId,
      preferredVendorId: materialInfo.preferredVendorId,
      currentOnHandQuantity: inventoryLevels.onHandQuantity,
      currentAllocatedQuantity: inventoryLevels.allocatedQuantity,
      currentAvailableQuantity: inventoryLevels.availableQuantity,
      currentOnOrderQuantity: inventoryLevels.onOrderQuantity,
      safetyStockQuantity: safetyStockCalc.safetyStockQuantity,
      reorderPointQuantity: safetyStockCalc.reorderPoint,
      economicOrderQuantity: safetyStockCalc.economicOrderQuantity,
      forecastedDemand30Days,
      forecastedDemand60Days,
      forecastedDemand90Days,
      projectedStockoutDate,
      recommendedOrderQuantity: recommendedOrderQty,
      recommendedOrderUom: materialInfo.primaryUom,
      recommendedOrderDate,
      recommendedDeliveryDate,
      estimatedUnitCost: materialInfo.lastCost,
      estimatedTotalCost: materialInfo.lastCost ? materialInfo.lastCost * recommendedOrderQty : undefined,
      vendorLeadTimeDays: materialInfo.leadTimeDays,
      suggestionReason,
      calculationMethod: CalculationMethod.FORECAST_BASED,
      urgencyLevel,
      daysUntilStockout,
      createdBy
    });

    return recommendation;
  }

  /**
   * Get current inventory levels for a material
   */
  private async getCurrentInventoryLevels(
    tenantId: string,
    facilityId: string,
    materialId: string
  ): Promise<{
    onHandQuantity: number;
    allocatedQuantity: number;
    availableQuantity: number;
    onOrderQuantity: number;
  }> {
    // Get inventory from lots
    const inventoryQuery = `
      SELECT
        COALESCE(SUM(current_quantity), 0) as on_hand_quantity,
        COALESCE(SUM(allocated_quantity), 0) as allocated_quantity,
        COALESCE(SUM(available_quantity), 0) as available_quantity
      FROM lots
      WHERE tenant_id = $1
        AND facility_id = $2
        AND material_id = $3
        AND quality_status = 'RELEASED'
        AND deleted_at IS NULL
    `;

    const inventoryResult = await this.pool.query(inventoryQuery, [tenantId, facilityId, materialId]);

    // Get on-order quantity from open purchase orders
    const onOrderQuery = `
      SELECT COALESCE(SUM(pol.quantity - pol.received_quantity), 0) as on_order_quantity
      FROM purchase_order_lines pol
      JOIN purchase_orders po ON pol.purchase_order_id = po.id
      WHERE po.tenant_id = $1
        AND po.facility_id = $2
        AND pol.material_id = $3
        AND po.status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'IN_TRANSIT')
        AND pol.deleted_at IS NULL
        AND po.deleted_at IS NULL
    `;

    const onOrderResult = await this.pool.query(onOrderQuery, [tenantId, facilityId, materialId]);

    const inv = inventoryResult.rows[0];
    const onOrder = onOrderResult.rows[0];

    return {
      onHandQuantity: parseFloat(inv.on_hand_quantity || 0),
      allocatedQuantity: parseFloat(inv.allocated_quantity || 0),
      availableQuantity: parseFloat(inv.available_quantity || 0),
      onOrderQuantity: parseFloat(onOrder.on_order_quantity || 0)
    };
  }

  /**
   * Get material information
   */
  private async getMaterialInfo(materialId: string): Promise<{
    primaryUom: string;
    minimumOrderQuantity: number;
    orderMultiple: number;
    leadTimeDays: number;
    lastCost?: number;
    preferredVendorId?: string;
  }> {
    const query = `
      SELECT
        m.primary_uom,
        m.minimum_order_quantity,
        m.order_multiple,
        m.lead_time_days,
        m.last_cost,
        (
          SELECT ms.vendor_id
          FROM materials_suppliers ms
          WHERE ms.material_id = m.id
            AND ms.is_preferred = TRUE
            AND ms.deleted_at IS NULL
          ORDER BY ms.created_at DESC
          LIMIT 1
        ) as preferred_vendor_id
      FROM materials m
      WHERE m.id = $1
        AND m.deleted_at IS NULL
    `;

    const result = await this.pool.query(query, [materialId]);
    const row = result.rows[0] || {};

    return {
      primaryUom: row.primary_uom || 'UNITS',
      minimumOrderQuantity: parseFloat(row.minimum_order_quantity || 1),
      orderMultiple: parseFloat(row.order_multiple || 1),
      leadTimeDays: parseInt(row.lead_time_days || 14, 10),
      lastCost: row.last_cost ? parseFloat(row.last_cost) : undefined,
      preferredVendorId: row.preferred_vendor_id
    };
  }

  /**
   * Sum forecast demand for specified number of days
   */
  private sumForecastDemand(forecasts: any[], days: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    return forecasts
      .filter(f => new Date(f.forecastDate) <= cutoffDate)
      .reduce((sum, f) => sum + f.forecastedDemandQuantity, 0);
  }

  /**
   * Calculate projected stockout date
   */
  private calculateStockoutDate(
    currentAvailable: number,
    forecasts: any[],
    safetyStock: number
  ): Date | undefined {
    let remainingInventory = currentAvailable;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const forecast of forecasts) {
      remainingInventory -= forecast.forecastedDemandQuantity;

      if (remainingInventory < safetyStock) {
        return new Date(forecast.forecastDate);
      }
    }

    return undefined; // No stockout projected
  }

  /**
   * Determine if replenishment should be recommended
   */
  private shouldRecommendReplenishment(
    availableQty: number,
    onOrderQty: number,
    reorderPoint: number,
    forecastedDemand30Days: number
  ): boolean {
    const projectedInventory = availableQty + onOrderQty;

    // Recommend if below reorder point or projected to run out in 30 days
    return projectedInventory < reorderPoint || projectedInventory < forecastedDemand30Days;
  }

  /**
   * Calculate recommended order quantity
   */
  private calculateOrderQuantity(
    availableQty: number,
    onOrderQty: number,
    forecastedDemand90Days: number,
    eoq: number,
    moq: number,
    orderMultiple: number
  ): number {
    // Target: Have enough inventory for 90 days of demand
    const targetInventory = forecastedDemand90Days;
    const currentAndOnOrder = availableQty + onOrderQty;
    const shortfall = Math.max(0, targetInventory - currentAndOnOrder);

    // Start with EOQ or shortfall, whichever is larger
    let orderQty = Math.max(eoq, shortfall);

    // Apply MOQ constraint
    if (orderQty < moq) {
      orderQty = moq;
    }

    // Round up to order multiple
    if (orderMultiple > 1) {
      orderQty = Math.ceil(orderQty / orderMultiple) * orderMultiple;
    }

    return orderQty;
  }

  /**
   * Determine urgency level
   */
  private determineUrgencyLevel(
    daysUntilStockout: number | null,
    availableQty: number,
    safetyStock: number
  ): UrgencyLevel {
    // CRITICAL: Below safety stock or stockout imminent (< 7 days)
    if (availableQty < safetyStock || (daysUntilStockout !== null && daysUntilStockout < 7)) {
      return UrgencyLevel.CRITICAL;
    }

    // HIGH: Stockout in 7-14 days
    if (daysUntilStockout !== null && daysUntilStockout < 14) {
      return UrgencyLevel.HIGH;
    }

    // MEDIUM: Stockout in 14-30 days
    if (daysUntilStockout !== null && daysUntilStockout < 30) {
      return UrgencyLevel.MEDIUM;
    }

    // LOW: Stockout > 30 days
    return UrgencyLevel.LOW;
  }

  /**
   * Calculate recommended order date
   */
  private calculateOrderDate(stockoutDate: Date | undefined, leadTimeDays: number): Date {
    if (!stockoutDate) {
      // No stockout projected - order today
      return new Date();
    }

    // Order lead time before stockout (with 2-day buffer)
    const orderDate = new Date(stockoutDate);
    orderDate.setDate(orderDate.getDate() - leadTimeDays - 2);

    // Don't allow dates in the past
    const today = new Date();
    if (orderDate < today) {
      return today;
    }

    return orderDate;
  }

  /**
   * Build human-readable suggestion reason
   */
  private buildSuggestionReason(
    availableQty: number,
    reorderPoint: number,
    forecastedDemand30Days: number,
    daysUntilStockout: number | null
  ): string {
    const reasons: string[] = [];

    if (availableQty < reorderPoint) {
      reasons.push(`Inventory (${availableQty.toFixed(2)}) below reorder point (${reorderPoint.toFixed(2)})`);
    }

    if (availableQty < forecastedDemand30Days) {
      reasons.push(`Current inventory insufficient for 30-day forecast (${forecastedDemand30Days.toFixed(2)})`);
    }

    if (daysUntilStockout !== null && daysUntilStockout < 30) {
      reasons.push(`Projected stockout in ${daysUntilStockout} days`);
    }

    return reasons.join('. ') || 'Proactive replenishment based on forecast.';
  }

  /**
   * Get active material IDs for a facility
   */
  private async getActiveMaterialIds(tenantId: string, facilityId: string): Promise<string[]> {
    const query = `
      SELECT DISTINCT m.id
      FROM materials m
      WHERE m.tenant_id = $1
        AND m.forecasting_enabled = TRUE
        AND m.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM lots l
          WHERE l.material_id = m.id
            AND l.facility_id = $2
            AND l.deleted_at IS NULL
        )
      ORDER BY m.id
    `;

    const result = await this.pool.query(query, [tenantId, facilityId]);
    return result.rows.map(row => row.id);
  }

  /**
   * Insert recommendation into database
   */
  private async insertRecommendation(data: {
    tenantId: string;
    facilityId: string;
    materialId: string;
    preferredVendorId?: string;
    currentOnHandQuantity: number;
    currentAllocatedQuantity: number;
    currentAvailableQuantity: number;
    currentOnOrderQuantity: number;
    safetyStockQuantity: number;
    reorderPointQuantity: number;
    economicOrderQuantity: number;
    forecastedDemand30Days: number;
    forecastedDemand60Days?: number;
    forecastedDemand90Days?: number;
    projectedStockoutDate?: Date;
    recommendedOrderQuantity: number;
    recommendedOrderUom: string;
    recommendedOrderDate: Date;
    recommendedDeliveryDate?: Date;
    estimatedUnitCost?: number;
    estimatedTotalCost?: number;
    vendorLeadTimeDays?: number;
    suggestionReason: string;
    calculationMethod: CalculationMethod;
    urgencyLevel?: UrgencyLevel;
    daysUntilStockout?: number | null;
    createdBy?: string;
  }): Promise<ReplenishmentRecommendation> {
    const query = `
      INSERT INTO replenishment_suggestions (
        tenant_id, facility_id, material_id, preferred_vendor_id,
        suggestion_generation_timestamp, suggestion_status,
        current_on_hand_quantity, current_allocated_quantity, current_available_quantity, current_on_order_quantity,
        safety_stock_quantity, reorder_point_quantity, economic_order_quantity,
        forecasted_demand_30_days, forecasted_demand_60_days, forecasted_demand_90_days,
        projected_stockout_date,
        recommended_order_quantity, recommended_order_uom, recommended_order_date, recommended_delivery_date,
        estimated_unit_cost, estimated_total_cost, vendor_lead_time_days,
        suggestion_reason, calculation_method,
        created_by
      ) VALUES (
        $1, $2, $3, $4,
        CURRENT_TIMESTAMP, 'PENDING',
        $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15,
        $16, $17, $18, $19,
        $20, $21, $22,
        $23, $24,
        $25
      )
      RETURNING
        suggestion_id, tenant_id, facility_id, material_id, preferred_vendor_id,
        suggestion_generation_timestamp, suggestion_status,
        current_on_hand_quantity, current_allocated_quantity, current_available_quantity, current_on_order_quantity,
        safety_stock_quantity, reorder_point_quantity, economic_order_quantity,
        forecasted_demand_30_days, forecasted_demand_60_days, forecasted_demand_90_days,
        projected_stockout_date,
        recommended_order_quantity, recommended_order_uom, recommended_order_date, recommended_delivery_date,
        estimated_unit_cost, estimated_total_cost, vendor_lead_time_days,
        suggestion_reason, calculation_method,
        created_at
    `;

    const values = [
      data.tenantId,
      data.facilityId,
      data.materialId,
      data.preferredVendorId,
      data.currentOnHandQuantity,
      data.currentAllocatedQuantity,
      data.currentAvailableQuantity,
      data.currentOnOrderQuantity,
      data.safetyStockQuantity,
      data.reorderPointQuantity,
      data.economicOrderQuantity,
      data.forecastedDemand30Days,
      data.forecastedDemand60Days,
      data.forecastedDemand90Days,
      data.projectedStockoutDate,
      data.recommendedOrderQuantity,
      data.recommendedOrderUom,
      data.recommendedOrderDate,
      data.recommendedDeliveryDate,
      data.estimatedUnitCost,
      data.estimatedTotalCost,
      data.vendorLeadTimeDays,
      data.suggestionReason,
      data.calculationMethod,
      data.createdBy
    ];

    const result = await this.pool.query(query, values);
    const row = result.rows[0];

    return {
      ...this.mapRowToRecommendation(row),
      urgencyLevel: data.urgencyLevel,
      daysUntilStockout: data.daysUntilStockout !== null ? data.daysUntilStockout : undefined
    };
  }

  /**
   * Get replenishment recommendations
   */
  async getRecommendations(
    tenantId: string,
    facilityId: string,
    options?: {
      status?: string;
      urgencyLevel?: string;
      materialId?: string;
    }
  ): Promise<ReplenishmentRecommendation[]> {
    let query = `
      SELECT
        suggestion_id, tenant_id, facility_id, material_id, preferred_vendor_id,
        suggestion_generation_timestamp, suggestion_status,
        current_on_hand_quantity, current_allocated_quantity, current_available_quantity, current_on_order_quantity,
        safety_stock_quantity, reorder_point_quantity, economic_order_quantity,
        forecasted_demand_30_days, forecasted_demand_60_days, forecasted_demand_90_days,
        projected_stockout_date,
        recommended_order_quantity, recommended_order_uom, recommended_order_date, recommended_delivery_date,
        estimated_unit_cost, estimated_total_cost, vendor_lead_time_days,
        suggestion_reason, calculation_method,
        created_at
      FROM replenishment_suggestions
      WHERE tenant_id = $1
        AND facility_id = $2
        AND deleted_at IS NULL
    `;

    const values: any[] = [tenantId, facilityId];

    if (options?.status) {
      query += ` AND suggestion_status = $${values.length + 1}`;
      values.push(options.status);
    }

    if (options?.materialId) {
      query += ` AND material_id = $${values.length + 1}`;
      values.push(options.materialId);
    }

    query += ` ORDER BY projected_stockout_date ASC NULLS LAST, created_at DESC`;

    const result = await this.pool.query(query, values);
    return result.rows.map(row => this.mapRowToRecommendation(row));
  }

  /**
   * Map database row to ReplenishmentRecommendation
   */
  private mapRowToRecommendation(row: any): ReplenishmentRecommendation {
    // Calculate urgency and days until stockout
    const projectedStockoutDate = row.projected_stockout_date ? new Date(row.projected_stockout_date) : undefined;
    const daysUntilStockout = projectedStockoutDate
      ? Math.ceil((projectedStockoutDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))
      : undefined;

    const availableQty = parseFloat(row.current_available_quantity);
    const safetyStock = parseFloat(row.safety_stock_quantity);

    const urgencyLevel = this.determineUrgencyLevel(daysUntilStockout || null, availableQty, safetyStock);

    return {
      suggestionId: row.suggestion_id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      materialId: row.material_id,
      preferredVendorId: row.preferred_vendor_id,
      suggestionGenerationTimestamp: row.suggestion_generation_timestamp,
      suggestionStatus: row.suggestion_status as SuggestionStatus,
      currentOnHandQuantity: parseFloat(row.current_on_hand_quantity),
      currentAllocatedQuantity: parseFloat(row.current_allocated_quantity),
      currentAvailableQuantity: availableQty,
      currentOnOrderQuantity: parseFloat(row.current_on_order_quantity),
      safetyStockQuantity: safetyStock,
      reorderPointQuantity: parseFloat(row.reorder_point_quantity),
      economicOrderQuantity: parseFloat(row.economic_order_quantity),
      forecastedDemand30Days: parseFloat(row.forecasted_demand_30_days),
      forecastedDemand60Days: row.forecasted_demand_60_days ? parseFloat(row.forecasted_demand_60_days) : undefined,
      forecastedDemand90Days: row.forecasted_demand_90_days ? parseFloat(row.forecasted_demand_90_days) : undefined,
      projectedStockoutDate,
      recommendedOrderQuantity: parseFloat(row.recommended_order_quantity),
      recommendedOrderUom: row.recommended_order_uom,
      recommendedOrderDate: row.recommended_order_date,
      recommendedDeliveryDate: row.recommended_delivery_date,
      estimatedUnitCost: row.estimated_unit_cost ? parseFloat(row.estimated_unit_cost) : undefined,
      estimatedTotalCost: row.estimated_total_cost ? parseFloat(row.estimated_total_cost) : undefined,
      vendorLeadTimeDays: row.vendor_lead_time_days,
      suggestionReason: row.suggestion_reason,
      calculationMethod: row.calculation_method as CalculationMethod,
      urgencyLevel,
      daysUntilStockout,
      createdAt: row.created_at
    };
  }
}
