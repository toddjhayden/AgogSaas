import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import {
  NetRequirement,
  PlannedOrderInput,
  LotSizingMethod,
  LotSizingConfig,
} from '../dto/mrp-types';

/**
 * Lot Sizing Service
 *
 * Applies lot sizing rules to net requirements to determine planned order quantities.
 *
 * Supported Methods:
 * - LOT_FOR_LOT: Order exact net requirement (minimize inventory)
 * - FIXED_ORDER_QUANTITY: Order fixed quantity
 * - EOQ: Economic Order Quantity (balance ordering vs holding costs)
 * - PERIOD_ORDER_QUANTITY: Cover N periods of demand
 * - MIN_MAX: Reorder to max when inventory drops below min
 *
 * @author Roy (Backend Developer)
 * @requirement REQ-STRATEGIC-AUTO-1767084329264
 */
@Injectable()
export class LotSizingService {
  private readonly logger = new Logger(LotSizingService.name);

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /**
   * Apply lot sizing rules to net requirements
   *
   * @param tenantId - Tenant identifier
   * @param facilityId - Facility identifier
   * @param netRequirements - Array of net requirements
   * @returns Array of planned order inputs with lot-sized quantities
   */
  async applyLotSizing(
    tenantId: string,
    facilityId: string,
    netRequirements: NetRequirement[],
  ): Promise<PlannedOrderInput[]> {
    this.logger.log(
      `Applying lot sizing to ${netRequirements.length} net requirements`,
    );

    const plannedOrders: PlannedOrderInput[] = [];

    // Get lot sizing configurations for all materials
    const materialIds = [
      ...new Set(netRequirements.map((r) => r.materialId)),
    ];
    const lotSizingConfigs =
      await this.getBatchLotSizingConfigs(materialIds);

    for (const req of netRequirements) {
      const config = lotSizingConfigs.get(req.materialId);

      if (!config) {
        this.logger.warn(
          `No lot sizing config found for material ${req.materialCode}, using LOT_FOR_LOT`,
        );
        plannedOrders.push({
          tenantId,
          facilityId,
          mrpRunId: req.materialId, // Will be set by caller
          materialId: req.materialId,
          materialCode: req.materialCode,
          netQuantity: req.netQuantity,
          requiredDate: req.requiredDate,
          peggingChain: req.peggingChain,
        });
        continue;
      }

      const lotSizedQuantity = this.calculateLotSize(
        req.netQuantity,
        config,
      );

      plannedOrders.push({
        tenantId,
        facilityId,
        mrpRunId: req.materialId, // Will be set by caller
        materialId: req.materialId,
        materialCode: req.materialCode,
        netQuantity: lotSizedQuantity,
        requiredDate: req.requiredDate,
        peggingChain: req.peggingChain,
      });
    }

    this.logger.log(
      `Lot sizing complete: ${plannedOrders.length} planned orders generated`,
    );

    return plannedOrders;
  }

  /**
   * Calculate lot size based on method
   *
   * @param netQuantity - Net requirement quantity
   * @param config - Lot sizing configuration
   * @returns Lot-sized quantity
   */
  private calculateLotSize(
    netQuantity: number,
    config: LotSizingConfig,
  ): number {
    switch (config.method) {
      case LotSizingMethod.LOT_FOR_LOT:
        return this.lotForLot(netQuantity, config);

      case LotSizingMethod.FIXED_ORDER_QUANTITY:
        return this.fixedOrderQuantity(netQuantity, config);

      case LotSizingMethod.EOQ:
        return this.economicOrderQuantity(netQuantity, config);

      case LotSizingMethod.PERIOD_ORDER_QUANTITY:
        // POQ requires future demand forecast - implement in Phase 2
        return this.lotForLot(netQuantity, config);

      case LotSizingMethod.MIN_MAX:
        // Min-Max requires min/max levels - implement in Phase 2
        return this.lotForLot(netQuantity, config);

      default:
        this.logger.warn(
          `Unknown lot sizing method ${config.method}, using LOT_FOR_LOT`,
        );
        return this.lotForLot(netQuantity, config);
    }
  }

  /**
   * Lot-for-Lot: Order exact net requirement
   *
   * @param netQuantity - Net requirement
   * @param config - Lot sizing config
   * @returns Lot-sized quantity
   */
  private lotForLot(
    netQuantity: number,
    config: LotSizingConfig,
  ): number {
    let quantity = netQuantity;

    // Apply minimum order quantity
    if (
      config.minimumOrderQuantity &&
      quantity < config.minimumOrderQuantity
    ) {
      quantity = config.minimumOrderQuantity;
    }

    // Apply order multiple
    if (config.orderMultiple && config.orderMultiple > 1) {
      quantity =
        Math.ceil(quantity / config.orderMultiple) *
        config.orderMultiple;
    }

    return quantity;
  }

  /**
   * Fixed Order Quantity: Order fixed quantity
   *
   * @param netQuantity - Net requirement
   * @param config - Lot sizing config
   * @returns Lot-sized quantity
   */
  private fixedOrderQuantity(
    netQuantity: number,
    config: LotSizingConfig,
  ): number {
    if (!config.fixedOrderQuantity || config.fixedOrderQuantity <= 0) {
      this.logger.warn(
        'Fixed order quantity not configured, using LOT_FOR_LOT',
      );
      return this.lotForLot(netQuantity, config);
    }

    // Order enough fixed quantities to cover net requirement
    const numOrders = Math.ceil(
      netQuantity / config.fixedOrderQuantity,
    );
    return numOrders * config.fixedOrderQuantity;
  }

  /**
   * Economic Order Quantity: Balance ordering costs vs holding costs
   *
   * EOQ Formula: √(2 * D * S / H)
   * Where:
   *   D = Annual demand
   *   S = Order cost per order
   *   H = Holding cost per unit per year
   *
   * @param netQuantity - Net requirement
   * @param config - Lot sizing config
   * @returns Lot-sized quantity
   */
  private economicOrderQuantity(
    netQuantity: number,
    config: LotSizingConfig,
  ): number {
    if (
      !config.economicOrderQuantity ||
      config.economicOrderQuantity <= 0
    ) {
      this.logger.warn(
        'Economic order quantity not configured, using LOT_FOR_LOT',
      );
      return this.lotForLot(netQuantity, config);
    }

    // Use pre-calculated EOQ from material master
    let quantity = config.economicOrderQuantity;

    // If net requirement > EOQ, order multiple of EOQ
    if (netQuantity > quantity) {
      const numOrders = Math.ceil(netQuantity / quantity);
      quantity = numOrders * quantity;
    }

    // Apply minimum order quantity
    if (
      config.minimumOrderQuantity &&
      quantity < config.minimumOrderQuantity
    ) {
      quantity = config.minimumOrderQuantity;
    }

    // Apply order multiple
    if (config.orderMultiple && config.orderMultiple > 1) {
      quantity =
        Math.ceil(quantity / config.orderMultiple) *
        config.orderMultiple;
    }

    return quantity;
  }

  /**
   * Get lot sizing configurations for multiple materials (BATCH)
   *
   * @param materialIds - Array of material IDs
   * @returns Map of material ID to lot sizing config
   */
  private async getBatchLotSizingConfigs(
    materialIds: string[],
  ): Promise<Map<string, LotSizingConfig>> {
    if (materialIds.length === 0) {
      return new Map();
    }

    try {
      const result = await this.pool.query(
        `
        SELECT
          id AS material_id,
          lot_sizing_method,
          fixed_order_quantity,
          period_order_quantity_days,
          minimum_order_quantity,
          order_multiple,
          economic_order_quantity
        FROM materials
        WHERE id = ANY($1)
        `,
        [materialIds],
      );

      const map = new Map<string, LotSizingConfig>();

      result.rows.forEach((row) => {
        map.set(row.material_id, {
          method:
            (row.lot_sizing_method as LotSizingMethod) ||
            LotSizingMethod.LOT_FOR_LOT,
          fixedOrderQuantity: row.fixed_order_quantity
            ? parseFloat(row.fixed_order_quantity)
            : undefined,
          periodOrderQuantityDays: row.period_order_quantity_days
            ? parseInt(row.period_order_quantity_days, 10)
            : undefined,
          minimumOrderQuantity: row.minimum_order_quantity
            ? parseFloat(row.minimum_order_quantity)
            : undefined,
          orderMultiple: row.order_multiple
            ? parseFloat(row.order_multiple)
            : undefined,
          economicOrderQuantity: row.economic_order_quantity
            ? parseFloat(row.economic_order_quantity)
            : undefined,
        });
      });

      return map;
    } catch (error) {
      this.logger.error(
        `Failed to get batch lot sizing configs`,
        error,
      );
      return new Map();
    }
  }
}
