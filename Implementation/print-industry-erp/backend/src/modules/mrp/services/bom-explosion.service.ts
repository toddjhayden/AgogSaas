import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import {
  BOMComponent,
  BOMNode,
  MaterialRequirement,
  MRPEngineError,
  MRPErrorCode,
  PeggingChainItem,
} from '../dto/mrp-types';

/**
 * BOM Explosion Service
 *
 * Implements iterative BFS (Breadth-First Search) algorithm for multi-level BOM explosion
 * to avoid stack overflow issues with deep BOMs.
 *
 * Key Features:
 * - Iterative BFS traversal (no recursion)
 * - Circular BOM detection
 * - Max depth safety check (50 levels)
 * - Scrap percentage calculation at each level
 * - Lead time offsetting
 * - Phantom assembly handling
 *
 * @author Roy (Backend Developer)
 * @requirement REQ-STRATEGIC-AUTO-1767084329264
 */
@Injectable()
export class BOMExplosionService {
  private readonly logger = new Logger(BOMExplosionService.name);
  private readonly MAX_BOM_DEPTH = 50;

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /**
   * Explode BOM using iterative BFS algorithm
   *
   * @param productId - Product to explode
   * @param parentQuantity - Quantity of parent product
   * @param dueDate - Due date for parent product
   * @param mrpRunId - MRP run identifier
   * @returns Array of material requirements at all BOM levels
   */
  async explodeBOM(
    productId: string,
    parentQuantity: number,
    dueDate: Date,
    mrpRunId: string,
  ): Promise<MaterialRequirement[]> {
    this.logger.log(
      `Starting BOM explosion for product ${productId}, quantity ${parentQuantity}`,
    );

    const requirements: MaterialRequirement[] = [];

    // Use a queue instead of recursion (BFS)
    const queue: BOMNode[] = [
      {
        productId,
        quantity: parentQuantity,
        dueDate,
        level: 0,
        peggingChain: [],
      },
    ];

    // Track visited nodes to prevent infinite loops (circular BOMs)
    const visited = new Set<string>();

    let nodesProcessed = 0;

    while (queue.length > 0) {
      const node = queue.shift()!;
      nodesProcessed++;

      // Prevent infinite loops from circular BOMs
      const nodeKey = `${node.productId}-${node.level}`;
      if (visited.has(nodeKey)) {
        this.logger.warn(
          `Circular BOM detected at product ${node.productId}, level ${node.level}`,
        );
        continue;
      }
      visited.add(nodeKey);

      // Max depth safety check
      if (node.level > this.MAX_BOM_DEPTH) {
        throw new MRPEngineError(
          MRPErrorCode.MAX_DEPTH_EXCEEDED,
          `BOM depth exceeds maximum of ${this.MAX_BOM_DEPTH} levels at product ${node.productId}`,
          node.productId,
        );
      }

      // Get BOM components for this product
      const bomComponents = await this.getBOMComponents(node.productId);

      if (bomComponents.length === 0 && node.level === 0) {
        throw new MRPEngineError(
          MRPErrorCode.MISSING_BOM,
          `No BOM found for product ${node.productId}`,
          node.productId,
        );
      }

      for (const component of bomComponents) {
        // Calculate gross requirement with scrap allowance
        const grossQuantity =
          node.quantity *
          component.quantityPerParent *
          (1 + component.scrapPercentage / 100);

        // Offset by lead time (backward scheduling)
        const requiredDate = this.offsetByLeadTime(
          node.dueDate,
          component.leadTimeDays,
          component.safetyLeadTimeDays,
        );

        // Create material requirement
        const requirement: MaterialRequirement = {
          mrpRunId,
          materialId: component.materialId,
          materialCode: component.materialCode,
          grossQuantity,
          requiredDate,
          demandSource: {
            type:
              node.level === 0 ? 'PRODUCTION_ORDER' : 'PARENT_COMPONENT',
            productId: node.productId,
            parentQuantity: node.quantity,
            bomLevel: node.level,
          },
          peggingChain: [
            ...node.peggingChain,
            {
              productId: node.productId,
              quantity: node.quantity,
            },
          ],
        };

        requirements.push(requirement);

        // If component is manufactured (not phantom), add to queue for further explosion
        if (component.isManufactured && !component.isPhantom) {
          queue.push({
            productId: component.materialId,
            quantity: grossQuantity,
            dueDate: requiredDate,
            level: node.level + 1,
            peggingChain: requirement.peggingChain,
          });
        }
      }
    }

    this.logger.log(
      `BOM explosion complete: ${nodesProcessed} nodes processed, ${requirements.length} requirements generated`,
    );

    return requirements;
  }

  /**
   * Get BOM components for a product
   *
   * @param productId - Product ID
   * @returns Array of BOM components
   */
  private async getBOMComponents(
    productId: string,
  ): Promise<BOMComponent[]> {
    try {
      const result = await this.pool.query<BOMComponent>(
        `
        SELECT
          bom.id,
          bom.component_material_id AS "materialId",
          m.material_code AS "materialCode",
          bom.quantity_per_parent AS "quantityPerParent",
          COALESCE(bom.scrap_percentage, 0) AS "scrapPercentage",
          COALESCE(m.lead_time_days, 0) AS "leadTimeDays",
          COALESCE(m.safety_lead_time_days, 0) AS "safetyLeadTimeDays",
          COALESCE(m.is_manufacturable, FALSE) AS "isManufactured",
          COALESCE(m.is_phantom, FALSE) AS "isPhantom",
          COALESCE(bom.sequence_number, 0) AS "sequenceNumber"
        FROM bill_of_materials bom
        JOIN materials m ON m.id = bom.component_material_id
        WHERE bom.parent_product_id = $1
          AND bom.is_active = TRUE
          AND (bom.effective_from IS NULL OR bom.effective_from <= CURRENT_DATE)
          AND (bom.effective_to IS NULL OR bom.effective_to >= CURRENT_DATE)
        ORDER BY bom.sequence_number
        `,
        [productId],
      );

      return result.rows;
    } catch (error) {
      this.logger.error(
        `Failed to get BOM components for product ${productId}`,
        error,
      );
      const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error);

      throw new MRPEngineError(
        MRPErrorCode.DATABASE_TIMEOUT,
        `Failed to retrieve BOM components: ${errorMessage}`,
        productId,
        undefined,
        true, // retryable
      );
    }
  }

  /**
   * Offset date by lead time (backward scheduling)
   *
   * @param dueDate - Parent due date
   * @param leadTimeDays - Material lead time
   * @param safetyLeadTimeDays - Safety lead time buffer
   * @returns Required date for component
   */
  private offsetByLeadTime(
    dueDate: Date,
    leadTimeDays: number,
    safetyLeadTimeDays: number,
  ): Date {
    if (leadTimeDays < 0) {
      throw new MRPEngineError(
        MRPErrorCode.INVALID_LEAD_TIME,
        `Lead time cannot be negative: ${leadTimeDays} days`,
      );
    }

    const totalLeadTime = leadTimeDays + safetyLeadTimeDays;
    const requiredDate = new Date(dueDate);
    requiredDate.setDate(requiredDate.getDate() - totalLeadTime);

    return requiredDate;
  }

  /**
   * Explode BOM with routing integration for operation-level material requirements
   *
   * @param productId - Product to explode
   * @param quantity - Quantity
   * @param dueDate - Due date
   * @param mrpRunId - MRP run ID
   * @returns Array of material requirements with operation-level detail
   */
  async explodeBOMWithRouting(
    productId: string,
    quantity: number,
    dueDate: Date,
    mrpRunId: string,
  ): Promise<MaterialRequirement[]> {
    // TODO: Implement routing integration in Phase 2
    // For now, use standard BOM explosion
    return this.explodeBOM(productId, quantity, dueDate, mrpRunId);
  }
}
