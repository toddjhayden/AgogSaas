import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import {
  PlannedOrderInput,
  PlannedOrderResult,
  PlannedOrderType,
  PlannedOrderStatus,
  LotSizingMethod,
} from '../dto/mrp-types';

/**
 * Planned Order Service
 *
 * Manages planned orders (intermediate state before firming to PO/production orders)
 *
 * @author Roy (Backend Developer)
 * @requirement REQ-STRATEGIC-AUTO-1767084329264
 */
@Injectable()
export class PlannedOrderService {
  private readonly logger = new Logger(PlannedOrderService.name);

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /**
   * Bulk create planned orders
   *
   * @param plannedOrders - Array of planned order inputs
   * @param mrpRunId - MRP run identifier
   * @returns Array of created planned orders
   */
  async bulkCreatePlannedOrders(
    plannedOrders: PlannedOrderInput[],
    mrpRunId: string,
  ): Promise<PlannedOrderResult[]> {
    if (plannedOrders.length === 0) {
      return [];
    }

    this.logger.log(
      `Creating ${plannedOrders.length} planned orders for MRP run ${mrpRunId}`,
    );

    const client = await this.pool.connect();
    const results: PlannedOrderResult[] = [];

    try {
      await client.query('BEGIN');

      for (const po of plannedOrders) {
        // Determine order type (purchase vs production)
        const orderType = await this.determineOrderType(
          po.materialId,
          client,
        );

        // Calculate order date (required date - lead time)
        const { orderDate, leadTimeDays } =
          await this.calculateOrderDate(
            po.materialId,
            po.requiredDate,
            client,
          );

        // Get vendor or work center
        const { vendorId, workCenterId } =
          await this.determineSource(
            po.materialId,
            orderType,
            client,
          );

        // Get costing
        const { unitCost, totalCost } = await this.estimateCost(
          po.materialId,
          po.netQuantity,
          vendorId,
          client,
        );

        // Get lot sizing method
        const lotSizingMethod = await this.getLotSizingMethod(
          po.materialId,
          client,
        );

        // Generate planned order number
        const plannedOrderNumber =
          await this.generatePlannedOrderNumber(
            po.tenantId,
            orderType,
            client,
          );

        // Get unit of measure
        const unitOfMeasure = await this.getUnitOfMeasure(
          po.materialId,
          client,
        );

        // Insert planned order
        const result = await client.query(
          `
          INSERT INTO planned_orders (
            tenant_id, facility_id, mrp_run_id,
            planned_order_number, order_type, material_id, material_code,
            quantity, unit_of_measure, required_date, order_date,
            vendor_id, work_center_id,
            estimated_unit_cost, estimated_total_cost,
            lot_sizing_method, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'PLANNED'
          ) RETURNING id
          `,
          [
            po.tenantId,
            po.facilityId,
            mrpRunId,
            plannedOrderNumber,
            orderType,
            po.materialId,
            po.materialCode,
            po.netQuantity,
            unitOfMeasure,
            po.requiredDate,
            orderDate,
            vendorId,
            workCenterId,
            unitCost,
            totalCost,
            lotSizingMethod,
          ],
        );

        results.push({
          id: result.rows[0].id,
          plannedOrderNumber,
          orderType,
          materialId: po.materialId,
          materialCode: po.materialCode,
          quantity: po.netQuantity,
          unitOfMeasure,
          requiredDate: po.requiredDate,
          orderDate,
          vendorId,
          workCenterId,
          estimatedUnitCost: unitCost,
          estimatedTotalCost: totalCost,
          lotSizingMethod,
          status: PlannedOrderStatus.PLANNED,
        });
      }

      await client.query('COMMIT');

      this.logger.log(
        `Successfully created ${results.length} planned orders`,
      );

      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create planned orders`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Determine order type (purchase vs production)
   */
  private async determineOrderType(
    materialId: string,
    client: any,
  ): Promise<PlannedOrderType> {
    const result = await client.query(
      `SELECT is_manufacturable, is_purchasable FROM materials WHERE id = $1`,
      [materialId],
    );

    if (result.rows.length === 0) {
      return PlannedOrderType.PURCHASE;
    }

    const { is_manufacturable, is_purchasable } = result.rows[0];

    if (is_manufacturable && !is_purchasable) {
      return PlannedOrderType.PRODUCTION;
    } else if (is_purchasable) {
      return PlannedOrderType.PURCHASE;
    } else {
      return PlannedOrderType.PURCHASE; // Default
    }
  }

  /**
   * Calculate order date (required date - lead time)
   */
  private async calculateOrderDate(
    materialId: string,
    requiredDate: Date,
    client: any,
  ): Promise<{ orderDate: Date; leadTimeDays: number }> {
    const result = await client.query(
      `SELECT COALESCE(lead_time_days, 0) AS lead_time_days FROM materials WHERE id = $1`,
      [materialId],
    );

    const leadTimeDays =
      result.rows[0]?.lead_time_days || 0;

    const orderDate = new Date(requiredDate);
    orderDate.setDate(orderDate.getDate() - leadTimeDays);

    return { orderDate, leadTimeDays };
  }

  /**
   * Determine vendor or work center source
   */
  private async determineSource(
    materialId: string,
    orderType: PlannedOrderType,
    client: any,
  ): Promise<{ vendorId?: string; workCenterId?: string }> {
    if (orderType === PlannedOrderType.PURCHASE) {
      // Get preferred vendor
      const result = await client.query(
        `
        SELECT vendor_id
        FROM materials_suppliers
        WHERE material_id = $1 AND is_preferred = TRUE
        ORDER BY lead_time_days ASC
        LIMIT 1
        `,
        [materialId],
      );

      return {
        vendorId: result.rows[0]?.vendor_id,
        workCenterId: undefined,
      };
    } else if (orderType === PlannedOrderType.PRODUCTION) {
      // Get default work center from routing (TODO: implement in Phase 2)
      return {
        vendorId: undefined,
        workCenterId: undefined,
      };
    }

    return { vendorId: undefined, workCenterId: undefined };
  }

  /**
   * Estimate cost
   */
  private async estimateCost(
    materialId: string,
    quantity: number,
    vendorId: string | undefined,
    client: any,
  ): Promise<{ unitCost: number; totalCost: number }> {
    // Try to get vendor-specific price
    if (vendorId) {
      const result = await client.query(
        `
        SELECT unit_price
        FROM materials_suppliers
        WHERE material_id = $1 AND vendor_id = $2
        ORDER BY minimum_order_quantity DESC
        LIMIT 1
        `,
        [materialId, vendorId],
      );

      if (result.rows.length > 0) {
        const unitCost = parseFloat(result.rows[0].unit_price);
        return { unitCost, totalCost: unitCost * quantity };
      }
    }

    // Fall back to standard cost
    const result = await client.query(
      `SELECT COALESCE(standard_cost, average_cost, 0) AS cost FROM materials WHERE id = $1`,
      [materialId],
    );

    const unitCost = parseFloat(result.rows[0]?.cost || '0');
    return { unitCost, totalCost: unitCost * quantity };
  }

  /**
   * Get lot sizing method
   */
  private async getLotSizingMethod(
    materialId: string,
    client: any,
  ): Promise<LotSizingMethod> {
    const result = await client.query(
      `SELECT lot_sizing_method FROM materials WHERE id = $1`,
      [materialId],
    );

    return (
      (result.rows[0]
        ?.lot_sizing_method as LotSizingMethod) ||
      LotSizingMethod.LOT_FOR_LOT
    );
  }

  /**
   * Get unit of measure
   */
  private async getUnitOfMeasure(
    materialId: string,
    client: any,
  ): Promise<string> {
    const result = await client.query(
      `SELECT unit_of_measure FROM materials WHERE id = $1`,
      [materialId],
    );

    return result.rows[0]?.unit_of_measure || 'EA';
  }

  /**
   * Generate planned order number
   */
  private async generatePlannedOrderNumber(
    tenantId: string,
    orderType: PlannedOrderType,
    client: any,
  ): Promise<string> {
    const prefix =
      orderType === PlannedOrderType.PURCHASE ? 'PL-PO' : 'PL-PR';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Get next sequence number for this month
    const result = await client.query(
      `
      SELECT COUNT(*) + 1 AS next_seq
      FROM planned_orders
      WHERE tenant_id = $1
        AND order_type = $2
        AND EXTRACT(YEAR FROM created_at) = $3
        AND EXTRACT(MONTH FROM created_at) = $4
      `,
      [tenantId, orderType, year, month],
    );

    const seq = String(result.rows[0].next_seq).padStart(5, '0');

    return `${prefix}-${year}${month}-${seq}`;
  }
}
