import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import {
  MaterialRequirement,
  NetRequirement,
  InventoryLevels,
  OnOrderItem,
  MRPEngineError,
  MRPErrorCode,
} from '../dto/mrp-types';

/**
 * Inventory Netting Service
 *
 * Calculates net material requirements by netting gross requirements against:
 * - On-hand inventory
 * - Allocated inventory
 * - On-order quantities (POs and production orders)
 *
 * Uses batch queries to avoid N+1 query problem (per Sylvia's recommendation)
 *
 * @author Roy (Backend Developer)
 * @requirement REQ-STRATEGIC-AUTO-1767084329264
 */
@Injectable()
export class InventoryNettingService {
  private readonly logger = new Logger(InventoryNettingService.name);

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /**
   * Calculate net requirements by netting gross requirements against inventory
   *
   * @param tenantId - Tenant identifier
   * @param facilityId - Facility identifier
   * @param grossRequirements - Array of gross material requirements from BOM explosion
   * @returns Array of net requirements (only materials that need to be ordered)
   */
  async calculateNetRequirements(
    tenantId: string,
    facilityId: string,
    grossRequirements: MaterialRequirement[],
  ): Promise<NetRequirement[]> {
    this.logger.log(
      `Calculating net requirements for ${grossRequirements.length} gross requirements`,
    );

    const netRequirements: NetRequirement[] = [];

    // Group requirements by material
    const requirementsByMaterial =
      this.groupByMaterial(grossRequirements);

    // Extract unique material IDs
    const uniqueMaterialIds = Array.from(requirementsByMaterial.keys());

    this.logger.log(
      `Processing ${uniqueMaterialIds.length} unique materials`,
    );

    // BATCH QUERY 1: Get all inventory levels in one query (avoid N+1)
    const inventoryLevelsMap = await this.getBatchInventoryLevels(
      tenantId,
      facilityId,
      uniqueMaterialIds,
    );

    // BATCH QUERY 2: Get all on-order schedules in one query (avoid N+1)
    const onOrderScheduleMap = await this.getBatchOnOrderSchedule(
      tenantId,
      facilityId,
      uniqueMaterialIds,
    );

    // Process each material
    for (const [materialId, requirements] of requirementsByMaterial) {
      const inventory = inventoryLevelsMap.get(materialId) || {
        onHandQuantity: 0,
        allocatedQuantity: 0,
      };

      const onOrderSchedule = onOrderScheduleMap.get(materialId) || [];

      // Sort requirements by date
      const sortedRequirements = requirements.sort(
        (a, b) =>
          a.requiredDate.getTime() - b.requiredDate.getTime(),
      );

      // Simulate inventory over time
      let projectedOnHand =
        inventory.onHandQuantity - inventory.allocatedQuantity;

      for (const req of sortedRequirements) {
        // Add receipts scheduled before this requirement
        const receiptsBeforeDate = onOrderSchedule.filter(
          (o) => o.dueDate <= req.requiredDate,
        );
        const receiptsQuantity = receiptsBeforeDate.reduce(
          (sum, r) => sum + r.quantity,
          0,
        );
        projectedOnHand += receiptsQuantity;

        // Remove those receipts from future consideration
        onOrderSchedule.splice(
          0,
          onOrderSchedule.findIndex(
            (o) => o.dueDate > req.requiredDate,
          ),
        );

        // Calculate net requirement
        const netQuantity = Math.max(
          0,
          req.grossQuantity - projectedOnHand,
        );

        if (netQuantity > 0) {
          netRequirements.push({
            materialId,
            materialCode: req.materialCode,
            grossQuantity: req.grossQuantity,
            projectedOnHand,
            netQuantity,
            requiredDate: req.requiredDate,
            peggingChain: req.peggingChain,
          });
        }

        // Update projected on-hand
        projectedOnHand -= req.grossQuantity;
      }
    }

    this.logger.log(
      `Net requirements calculated: ${netRequirements.length} materials need to be ordered`,
    );

    return netRequirements;
  }

  /**
   * Group requirements by material ID
   *
   * @param requirements - Array of material requirements
   * @returns Map of material ID to array of requirements
   */
  private groupByMaterial(
    requirements: MaterialRequirement[],
  ): Map<string, MaterialRequirement[]> {
    const grouped = new Map<string, MaterialRequirement[]>();

    for (const req of requirements) {
      if (!grouped.has(req.materialId)) {
        grouped.set(req.materialId, []);
      }
      grouped.get(req.materialId)!.push(req);
    }

    return grouped;
  }

  /**
   * Get inventory levels for multiple materials in a single query (BATCH)
   *
   * @param tenantId - Tenant identifier
   * @param facilityId - Facility identifier
   * @param materialIds - Array of material IDs
   * @returns Map of material ID to inventory levels
   */
  private async getBatchInventoryLevels(
    tenantId: string,
    facilityId: string,
    materialIds: string[],
  ): Promise<Map<string, InventoryLevels>> {
    if (materialIds.length === 0) {
      return new Map();
    }

    try {
      const result = await this.pool.query(
        `
        SELECT
          it.material_id,
          COALESCE(SUM(
            CASE
              WHEN it.transaction_type IN ('RECEIPT', 'ADJUSTMENT', 'CYCLE_COUNT')
              THEN it.quantity
              ELSE -it.quantity
            END
          ), 0) AS on_hand_quantity,
          0 AS allocated_quantity -- TODO: Calculate from reservations in Phase 2
        FROM inventory_transactions it
        WHERE it.tenant_id = $1
          AND it.facility_id = $2
          AND it.material_id = ANY($3)
          AND it.status = 'COMPLETED'
        GROUP BY it.material_id
        `,
        [tenantId, facilityId, materialIds],
      );

      const map = new Map<string, InventoryLevels>();
      result.rows.forEach((row) => {
        map.set(row.material_id, {
          onHandQuantity: parseFloat(row.on_hand_quantity),
          allocatedQuantity: parseFloat(row.allocated_quantity),
        });
      });

      return map;
    } catch (error) {
      this.logger.error(
        `Failed to get batch inventory levels`,
        error,
      );
      throw new MRPEngineError(
        MRPErrorCode.INVENTORY_QUERY_FAILED,
        `Failed to retrieve inventory levels: ${error.message}`,
        undefined,
        undefined,
        true, // retryable
      );
    }
  }

  /**
   * Get on-order schedule for multiple materials in a single query (BATCH)
   *
   * @param tenantId - Tenant identifier
   * @param facilityId - Facility identifier
   * @param materialIds - Array of material IDs
   * @returns Map of material ID to array of on-order items
   */
  private async getBatchOnOrderSchedule(
    tenantId: string,
    facilityId: string,
    materialIds: string[],
  ): Promise<Map<string, OnOrderItem[]>> {
    if (materialIds.length === 0) {
      return new Map();
    }

    try {
      const result = await this.pool.query(
        `
        -- Purchase Orders
        SELECT
          pol.material_id,
          pol.quantity_ordered - COALESCE(pol.quantity_received, 0) AS quantity,
          po.promised_delivery_date AS due_date,
          'PO'::TEXT AS order_type,
          po.id AS order_id
        FROM purchase_order_lines pol
        JOIN purchase_orders po ON po.id = pol.purchase_order_id
        WHERE pol.tenant_id = $1
          AND po.facility_id = $2
          AND pol.material_id = ANY($3)
          AND pol.status IN ('OPEN', 'PARTIALLY_RECEIVED')
          AND po.status NOT IN ('CANCELLED', 'CLOSED')
          AND pol.quantity_ordered > COALESCE(pol.quantity_received, 0)

        UNION ALL

        -- Production Orders
        SELECT
          prod_ord.product_id AS material_id,
          prod_ord.quantity_ordered - COALESCE(prod_ord.quantity_completed, 0) AS quantity,
          prod_ord.planned_completion_date AS due_date,
          'PRODUCTION_ORDER'::TEXT AS order_type,
          prod_ord.id AS order_id
        FROM production_orders prod_ord
        WHERE prod_ord.tenant_id = $1
          AND prod_ord.facility_id = $2
          AND prod_ord.product_id = ANY($3)
          AND prod_ord.status IN ('PLANNED', 'RELEASED', 'IN_PROGRESS')
          AND prod_ord.quantity_ordered > COALESCE(prod_ord.quantity_completed, 0)

        ORDER BY due_date
        `,
        [tenantId, facilityId, materialIds],
      );

      const map = new Map<string, OnOrderItem[]>();

      result.rows.forEach((row) => {
        if (!map.has(row.material_id)) {
          map.set(row.material_id, []);
        }

        map.get(row.material_id)!.push({
          materialId: row.material_id,
          quantity: parseFloat(row.quantity),
          dueDate: new Date(row.due_date),
          orderType: row.order_type as 'PO' | 'PRODUCTION_ORDER',
          orderId: row.order_id,
        });
      });

      return map;
    } catch (error) {
      this.logger.error(
        `Failed to get batch on-order schedule`,
        error,
      );
      throw new MRPEngineError(
        MRPErrorCode.DATABASE_TIMEOUT,
        `Failed to retrieve on-order schedule: ${error.message}`,
        undefined,
        undefined,
        true, // retryable
      );
    }
  }

  /**
   * Get inventory levels with lot tracking detail
   *
   * @param tenantId - Tenant identifier
   * @param facilityId - Facility identifier
   * @param materialId - Material identifier
   * @returns Inventory levels with lot detail
   */
  async getInventoryLevelsWithLotTracking(
    tenantId: string,
    facilityId: string,
    materialId: string,
  ): Promise<{
    totalAvailable: number;
    lotDetails: Array<{
      lotNumber: string;
      currentQuantity: number;
      availableQuantity: number;
      allocatedQuantity: number;
      expirationDate: Date | null;
      qualityStatus: string;
      locationCode: string;
    }>;
  }> {
    try {
      const result = await this.pool.query(
        `
        SELECT
          l.lot_number,
          l.current_quantity,
          l.available_quantity,
          l.allocated_quantity,
          l.expiration_date,
          l.quality_status,
          il.location_code
        FROM lots l
        JOIN inventory_locations il ON il.id = l.location_id
        WHERE l.tenant_id = $1
          AND l.facility_id = $2
          AND l.material_id = $3
          AND l.quality_status = 'RELEASED'
          AND l.is_active = TRUE
        ORDER BY l.expiration_date ASC NULLS LAST
        `,
        [tenantId, facilityId, materialId],
      );

      const totalAvailable = result.rows.reduce(
        (sum, r) => sum + parseFloat(r.available_quantity),
        0,
      );

      return {
        totalAvailable,
        lotDetails: result.rows.map((row) => ({
          lotNumber: row.lot_number,
          currentQuantity: parseFloat(row.current_quantity),
          availableQuantity: parseFloat(row.available_quantity),
          allocatedQuantity: parseFloat(row.allocated_quantity),
          expirationDate: row.expiration_date
            ? new Date(row.expiration_date)
            : null,
          qualityStatus: row.quality_status,
          locationCode: row.location_code,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get inventory levels with lot tracking for material ${materialId}`,
        error,
      );
      throw new MRPEngineError(
        MRPErrorCode.INVENTORY_QUERY_FAILED,
        `Failed to retrieve lot tracking details: ${error.message}`,
        undefined,
        materialId,
        true,
      );
    }
  }
}
