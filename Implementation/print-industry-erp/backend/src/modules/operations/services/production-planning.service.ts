/**
 * Production Planning Service
 *
 * Handles MRP/MPS calculations, production order generation, and capacity planning.
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328658
 * Author: Roy (Backend Architect)
 * Date: 2025-12-29
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { RoutingManagementService } from './routing-management.service';

export interface ProductionOrder {
  id: string;
  tenantId: string;
  facilityId: string;
  productionOrderNumber: string;
  salesOrderId?: string;
  salesOrderLineId?: string;
  productId: string;
  quantityOrdered: number;
  quantityCompleted: number;
  status: string;
  dueDate?: Date;
  priority: number;
  routingId?: string;
}

export interface MaterialRequirement {
  productId: string;
  productCode: string;
  productName: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortfall: number;
  requiredDate: Date;
}

export interface CapacityFeasibility {
  isFeasible: boolean;
  bottlenecks: BottleneckAnalysis[];
  estimatedCompletionDate?: Date;
  warnings: string[];
}

export interface BottleneckAnalysis {
  workCenterId: string;
  workCenterName: string;
  availableHours: number;
  requiredHours: number;
  utilizationPercent: number;
  isBottleneck: boolean;
}

@Injectable()
export class ProductionPlanningService {
  constructor(
    @Inject('DATABASE_POOL') private readonly pool: Pool,
    private readonly routingService: RoutingManagementService
  ) {}

  /**
   * Generate production orders from sales orders
   *
   * Automatically creates production orders for make-to-order (MTO) sales orders.
   *
   * @param salesOrderIds - Array of sales order IDs to convert
   * @param tenantId - Tenant ID
   * @param userId - User ID for audit trail
   * @returns Array of created production order IDs
   */
  async generateProductionOrders(
    salesOrderIds: string[],
    tenantId: string,
    userId: string
  ): Promise<string[]> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      const productionOrderIds: string[] = [];

      for (const salesOrderId of salesOrderIds) {
        // Get sales order lines
        const soLinesResult = await client.query(
          `SELECT
            sol.id as line_id,
            sol.product_id,
            sol.quantity,
            sol.unit_of_measure,
            so.facility_id,
            so.expected_delivery_date,
            p.product_code,
            p.product_name
           FROM sales_order_lines sol
           JOIN sales_orders so ON so.id = sol.sales_order_id
           JOIN products p ON p.id = sol.product_id
           WHERE so.id = $1
           AND so.tenant_id = $2
           AND sol.deleted_at IS NULL`,
          [salesOrderId, tenantId]
        );

        // Create production order for each line
        for (const line of soLinesResult.rows) {
          const poNumber = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          const result = await client.query(
            `INSERT INTO production_orders (
              tenant_id,
              facility_id,
              production_order_number,
              sales_order_id,
              sales_order_line_id,
              product_id,
              product_code,
              product_description,
              quantity_ordered,
              unit_of_measure,
              manufacturing_strategy,
              priority,
              due_date,
              status,
              created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id`,
            [
              tenantId,
              line.facility_id,
              poNumber,
              salesOrderId,
              line.line_id,
              line.product_id,
              line.product_code,
              line.product_name,
              line.quantity,
              line.unit_of_measure,
              'MTO', // Make-to-order
              5, // Normal priority
              line.expected_delivery_date,
              'PLANNED',
              userId
            ]
          );

          productionOrderIds.push(result.rows[0].id);
        }
      }

      await client.query('COMMIT');
      return productionOrderIds;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate material requirements for a production order (MRP)
   *
   * @param productionOrderId - Production order ID
   * @param tenantId - Tenant ID
   * @returns Material requirements with shortfall analysis
   */
  async calculateMaterialRequirements(
    productionOrderId: string,
    tenantId: string
  ): Promise<MaterialRequirement[]> {
    // Get production order
    const poResult = await this.pool.query(
      `SELECT * FROM production_orders
       WHERE id = $1 AND tenant_id = $2`,
      [productionOrderId, tenantId]
    );

    if (poResult.rows.length === 0) {
      throw new Error(`Production order ${productionOrderId} not found`);
    }

    const po = poResult.rows[0];

    // Get BOM (Bill of Materials) for product
    const bomResult = await this.pool.query(
      `SELECT
        bom.component_product_id,
        bom.quantity_per_unit,
        p.product_code,
        p.product_name,
        p.unit_of_measure
       FROM bill_of_materials bom
       JOIN products p ON p.id = bom.component_product_id
       WHERE bom.product_id = $1
       AND bom.tenant_id = $2
       AND bom.is_active = TRUE
       AND bom.deleted_at IS NULL`,
      [po.product_id, tenantId]
    );

    const requirements: MaterialRequirement[] = [];

    for (const bomItem of bomResult.rows) {
      const requiredQty = parseFloat(bomItem.quantity_per_unit) * parseFloat(po.quantity_ordered);

      // Get available inventory
      const inventoryResult = await this.pool.query(
        `SELECT COALESCE(SUM(quantity_on_hand), 0) as available
         FROM inventory
         WHERE product_id = $1
         AND tenant_id = $2
         AND facility_id = $3`,
        [bomItem.component_product_id, tenantId, po.facility_id]
      );

      const availableQty = parseFloat(inventoryResult.rows[0]?.available || '0');
      const shortfall = Math.max(0, requiredQty - availableQty);

      requirements.push({
        productId: bomItem.component_product_id,
        productCode: bomItem.product_code,
        productName: bomItem.product_name,
        requiredQuantity: requiredQty,
        availableQuantity: availableQty,
        shortfall: shortfall,
        requiredDate: po.due_date || new Date()
      });
    }

    return requirements;
  }

  /**
   * Check capacity feasibility for a production order
   *
   * Determines if there is sufficient work center capacity to meet due date.
   *
   * @param productionOrderId - Production order ID
   * @param tenantId - Tenant ID
   * @returns Feasibility analysis with bottleneck identification
   */
  async checkCapacityFeasibility(
    productionOrderId: string,
    tenantId: string
  ): Promise<CapacityFeasibility> {
    // Get production order
    const poResult = await this.pool.query(
      `SELECT * FROM production_orders
       WHERE id = $1 AND tenant_id = $2`,
      [productionOrderId, tenantId]
    );

    if (poResult.rows.length === 0) {
      throw new Error(`Production order ${productionOrderId} not found`);
    }

    const po = poResult.rows[0];

    if (!po.routing_id) {
      return {
        isFeasible: false,
        bottlenecks: [],
        warnings: ['No routing assigned to production order']
      };
    }

    // Get routing operations
    const operations = await this.routingService.getRoutingOperations(po.routing_id, tenantId);

    const bottlenecks: BottleneckAnalysis[] = [];
    const warnings: string[] = [];
    let totalLeadTimeDays = 0;

    // Analyze capacity for each operation
    for (const op of operations) {
      const workCenterId = op.workCenterId;

      if (!workCenterId) {
        warnings.push(`Operation ${op.sequenceNumber} has no work center assigned`);
        continue;
      }

      // Calculate required hours for this operation
      const setupHours = (op.setupTimeMinutes || 0) / 60;
      const runHours = ((op.runTimePerUnitSeconds || 0) * parseFloat(po.quantity_ordered)) / 3600;
      const totalHours = setupHours + runHours;

      // Get work center available capacity (simplified - assumes 8 hours/day)
      const availableHoursPerDay = 8;

      // Get work center current load
      const loadResult = await this.pool.query(
        `SELECT COALESCE(SUM(
          (EXTRACT(EPOCH FROM (scheduled_end_time - scheduled_start_time)) / 3600)
        ), 0) as scheduled_hours
         FROM production_schedules
         WHERE work_center_id = $1
         AND schedule_date >= CURRENT_DATE
         AND schedule_date <= CURRENT_DATE + INTERVAL '30 days'
         AND deleted_at IS NULL`,
        [workCenterId]
      );

      const scheduledHours = parseFloat(loadResult.rows[0]?.scheduled_hours || '0');
      const availableHours = (availableHoursPerDay * 30) - scheduledHours; // 30-day window

      const utilizationPercent = ((scheduledHours + totalHours) / (availableHoursPerDay * 30)) * 100;
      const isBottleneck = utilizationPercent > 90;

      bottlenecks.push({
        workCenterId: workCenterId,
        workCenterName: `Work Center ${workCenterId}`,
        availableHours: availableHours,
        requiredHours: totalHours,
        utilizationPercent: utilizationPercent,
        isBottleneck: isBottleneck
      });

      // Estimate lead time
      const operationDays = Math.ceil(totalHours / availableHoursPerDay);
      totalLeadTimeDays += operationDays;

      if (isBottleneck) {
        warnings.push(
          `Work center ${workCenterId} is at ${utilizationPercent.toFixed(1)}% utilization (bottleneck)`
        );
      }
    }

    const estimatedCompletionDate = new Date();
    estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + totalLeadTimeDays);

    const hasBottlenecks = bottlenecks.some(b => b.isBottleneck);
    const isFeasible = !hasBottlenecks || (po.due_date && estimatedCompletionDate <= new Date(po.due_date));

    return {
      isFeasible,
      bottlenecks,
      estimatedCompletionDate,
      warnings
    };
  }

  /**
   * Calculate lead time for a production order
   *
   * @param productionOrderId - Production order ID
   * @param tenantId - Tenant ID
   * @returns Estimated lead time in days
   */
  async calculateLeadTime(productionOrderId: string, tenantId: string): Promise<number> {
    const feasibility = await this.checkCapacityFeasibility(productionOrderId, tenantId);

    if (feasibility.estimatedCompletionDate) {
      const leadTimeDays = Math.ceil(
        (feasibility.estimatedCompletionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return Math.max(0, leadTimeDays);
    }

    return 0;
  }
}
