/**
 * Routing Management Service
 *
 * Handles routing template management and routing expansion to production runs.
 * Critical service for automated production planning.
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328658
 * Author: Roy (Backend Architect)
 * Date: 2025-12-29
 */

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';

export interface RoutingTemplate {
  id: string;
  tenantId: string;
  routingCode: string;
  routingName: string;
  routingVersion: number;
  productCategory?: string;
  isActive: boolean;
  description?: string;
}

export interface RoutingOperation {
  id: string;
  tenantId: string;
  routingId: string;
  operationId: string;
  sequenceNumber: number;
  setupTimeMinutes?: number;
  runTimePerUnitSeconds?: number;
  workCenterId?: string;
  yieldPercentage: number;
  scrapPercentage: number;
  isConcurrent: boolean;
  predecessorOperationId?: string;
  description?: string;
  workInstructions?: string;
}

export interface ProductionRun {
  id: string;
  productionOrderId: string;
  workCenterId: string;
  operationId: string;
  targetQuantity: number;
  sequenceNumber: number;
}

@Injectable()
export class RoutingManagementService {
  constructor(
    @Inject('DATABASE_POOL') private readonly pool: Pool
  ) {}

  /**
   * Get routing template by ID
   */
  async getRoutingTemplate(routingId: string, tenantId: string): Promise<RoutingTemplate | null> {
    const result = await this.pool.query(
      `SELECT * FROM routing_templates
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [routingId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRoutingTemplateRow(result.rows[0]);
  }

  /**
   * Get routing template by code
   */
  async getRoutingTemplateByCode(
    routingCode: string,
    tenantId: string,
    version?: number
  ): Promise<RoutingTemplate | null> {
    let query = `SELECT * FROM routing_templates
                 WHERE routing_code = $1 AND tenant_id = $2 AND deleted_at IS NULL`;
    const params: any[] = [routingCode, tenantId];

    if (version !== undefined) {
      query += ` AND routing_version = $3`;
      params.push(version);
    } else {
      query += ` ORDER BY routing_version DESC LIMIT 1`; // Get latest version
    }

    const result = await this.pool.query(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRoutingTemplateRow(result.rows[0]);
  }

  /**
   * Get all operations for a routing (ordered by sequence)
   */
  async getRoutingOperations(routingId: string, tenantId: string): Promise<RoutingOperation[]> {
    const result = await this.pool.query(
      `SELECT * FROM routing_operations
       WHERE routing_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       ORDER BY sequence_number`,
      [routingId, tenantId]
    );

    return result.rows.map(this.mapRoutingOperationRow);
  }

  /**
   * Expand routing to production runs
   *
   * CRITICAL FUNCTION for automated production planning.
   * Takes a routing template and generates sequenced production runs
   * for a production order, accounting for yield and scrap.
   *
   * @param routingId - Routing template ID
   * @param productionOrderId - Production order to create runs for
   * @param targetQuantity - Final target quantity (finished goods)
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param userId - User ID for audit trail
   * @returns Array of created production run IDs
   */
  async expandRouting(
    routingId: string,
    productionOrderId: string,
    targetQuantity: number,
    tenantId: string,
    userId: string
  ): Promise<string[]> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Set tenant context for RLS
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      // 1. Get routing template
      const routingResult = await client.query(
        `SELECT * FROM routing_templates
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [routingId, tenantId]
      );

      if (routingResult.rows.length === 0) {
        throw new NotFoundException(`Routing template ${routingId} not found`);
      }

      // 2. Get routing operations (ordered by sequence)
      const operationsResult = await client.query(
        `SELECT ro.*, o.operation_name, o.default_work_center_id
         FROM routing_operations ro
         JOIN operations o ON o.id = ro.operation_id
         WHERE ro.routing_id = $1 AND ro.tenant_id = $2 AND ro.deleted_at IS NULL
         ORDER BY ro.sequence_number`,
        [routingId, tenantId]
      );

      if (operationsResult.rows.length === 0) {
        throw new Error(`Routing ${routingId} has no operations defined`);
      }

      // 3. Get production order details
      const poResult = await client.query(
        `SELECT facility_id FROM production_orders
         WHERE id = $1 AND tenant_id = $2`,
        [productionOrderId, tenantId]
      );

      if (poResult.rows.length === 0) {
        throw new NotFoundException(`Production order ${productionOrderId} not found`);
      }

      const facilityId = poResult.rows[0].facility_id;

      // 4. Calculate required quantities with yield/scrap (reverse pass)
      const operations = operationsResult.rows;
      const quantities: number[] = [];

      // Start from final operation and work backwards
      let requiredQty = targetQuantity;
      for (let i = operations.length - 1; i >= 0; i--) {
        const op = operations[i];
        const yieldPercent = parseFloat(op.yield_percentage || '100');
        const scrapPercent = parseFloat(op.scrap_percentage || '0');

        // Calculate input quantity needed to achieve required output
        // Formula: inputQty = outputQty / (yieldPercent / 100)
        const inputQty = Math.ceil(requiredQty / (yieldPercent / 100));

        quantities[i] = inputQty;
        requiredQty = inputQty; // This becomes input for previous operation
      }

      // 5. Create production runs (forward pass)
      const productionRunIds: string[] = [];

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const runQuantity = quantities[i];

        // Determine work center (routing override > operation default)
        const workCenterId = op.work_center_id || op.default_work_center_id;

        if (!workCenterId) {
          throw new Error(
            `Operation ${op.operation_name} (seq ${op.sequence_number}) has no work center assigned`
          );
        }

        // Generate production run number
        const runNumber = `RUN-${Date.now()}-${i + 1}`;

        // Create production run
        const runResult = await client.query(
          `INSERT INTO production_runs (
            tenant_id,
            facility_id,
            production_run_number,
            production_order_id,
            work_center_id,
            operation_id,
            target_quantity,
            unit_of_measure,
            sequence_number,
            status,
            created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id`,
          [
            tenantId,
            facilityId,
            runNumber,
            productionOrderId,
            workCenterId,
            op.operation_id,
            runQuantity,
            'PIECES', // Default unit
            op.sequence_number,
            'SCHEDULED',
            userId
          ]
        );

        productionRunIds.push(runResult.rows[0].id);
      }

      await client.query('COMMIT');

      return productionRunIds;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate yield requirements
   *
   * Given a target quantity and operation yield percentage,
   * calculate how many units need to be started to achieve target.
   *
   * @param targetQuantity - Desired output quantity
   * @param yieldPercentage - Expected yield percentage (0-100)
   * @returns Required input quantity
   */
  calculateYieldRequirements(targetQuantity: number, yieldPercentage: number): number {
    if (yieldPercentage <= 0 || yieldPercentage > 100) {
      throw new Error(`Invalid yield percentage: ${yieldPercentage}. Must be between 0 and 100.`);
    }

    return Math.ceil(targetQuantity / (yieldPercentage / 100));
  }

  /**
   * Validate routing sequence
   *
   * Checks for circular dependencies and invalid predecessor references.
   */
  async validateRoutingSequence(routingId: string, tenantId: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const operations = await this.getRoutingOperations(routingId, tenantId);
    const errors: string[] = [];

    // Check for duplicate sequence numbers
    const sequenceNumbers = operations.map(op => op.sequenceNumber);
    const duplicates = sequenceNumbers.filter((num, index) => sequenceNumbers.indexOf(num) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate sequence numbers found: ${duplicates.join(', ')}`);
    }

    // Check for invalid predecessor references
    const operationIds = new Set(operations.map(op => op.id));
    for (const op of operations) {
      if (op.predecessorOperationId && !operationIds.has(op.predecessorOperationId)) {
        errors.push(
          `Operation ${op.sequenceNumber} references invalid predecessor: ${op.predecessorOperationId}`
        );
      }
    }

    // Check for circular dependencies (simplified)
    for (const op of operations) {
      if (op.predecessorOperationId === op.id) {
        errors.push(`Operation ${op.sequenceNumber} cannot be its own predecessor`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // =====================================================
  // MAPPERS
  // =====================================================

  private mapRoutingTemplateRow(row: any): RoutingTemplate {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      routingCode: row.routing_code,
      routingName: row.routing_name,
      routingVersion: row.routing_version,
      productCategory: row.product_category,
      isActive: row.is_active,
      description: row.description
    };
  }

  private mapRoutingOperationRow(row: any): RoutingOperation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      routingId: row.routing_id,
      operationId: row.operation_id,
      sequenceNumber: row.sequence_number,
      setupTimeMinutes: row.setup_time_minutes,
      runTimePerUnitSeconds: row.run_time_per_unit_seconds,
      workCenterId: row.work_center_id,
      yieldPercentage: parseFloat(row.yield_percentage || '100'),
      scrapPercentage: parseFloat(row.scrap_percentage || '0'),
      isConcurrent: row.is_concurrent,
      predecessorOperationId: row.predecessor_operation_id,
      description: row.description,
      workInstructions: row.work_instructions
    };
  }
}
