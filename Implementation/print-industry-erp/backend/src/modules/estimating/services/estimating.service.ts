/**
 * Estimating Service
 * REQ-STRATEGIC-AUTO-1767066329938: Complete Estimating & Job Costing Module
 *
 * Core business logic for estimating operations including CRUD operations,
 * cost calculations, versioning, template management, and quote conversion.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  Estimate,
  EstimateOperation,
  EstimateMaterial,
  CreateEstimateInput,
  UpdateEstimateInput,
  AddOperationInput,
  UpdateOperationInput,
  AddMaterialInput,
  UpdateMaterialInput,
  CreateRevisionInput,
  ConvertToQuoteInput,
  ApplyTemplateInput,
  EstimateFilters,
  EstimateResult,
  EstimateOperationResult,
  EstimateMaterialResult,
  EstimateListResult,
  EstimateStatus,
} from '../interfaces/estimating.interface';

@Injectable()
export class EstimatingService {
  private readonly logger = new Logger(EstimatingService.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool
  ) {}

  // =====================================================
  // ESTIMATE CRUD OPERATIONS
  // =====================================================

  /**
   * Create a new estimate with default values
   */
  async createEstimate(input: CreateEstimateInput): Promise<EstimateResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Generate estimate number
      const estimateNumber = await this.generateEstimateNumber(client, input.tenantId);

      const query = `
        INSERT INTO estimates (
          tenant_id,
          estimate_number,
          estimate_date,
          revision_number,
          customer_id,
          customer_name,
          customer_contact,
          customer_email,
          job_description,
          quantity_estimated,
          product_specification,
          target_margin_percentage,
          estimated_lead_time_days,
          total_material_cost,
          total_labor_cost,
          total_equipment_cost,
          total_overhead_cost,
          total_outsourcing_cost,
          total_cost,
          status,
          is_template,
          internal_notes,
          customer_notes,
          created_at,
          created_by,
          updated_at
        ) VALUES (
          $1, $2, CURRENT_DATE, 1, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          0, 0, 0, 0, 0, 0, 'DRAFT', false, $12, $13, NOW(), $14, NOW()
        )
        RETURNING *
      `;

      const result = await client.query(query, [
        input.tenantId,
        estimateNumber,
        input.customerId,
        input.customerName,
        input.customerContact,
        input.customerEmail,
        input.jobDescription,
        input.quantityEstimated,
        input.productSpecification ? JSON.stringify(input.productSpecification) : null,
        input.targetMarginPercentage || 30.0, // Default 30% margin
        input.estimatedLeadTimeDays,
        input.internalNotes,
        input.customerNotes,
        input.createdBy,
      ]);

      await client.query('COMMIT');

      this.logger.log(`Created estimate ${estimateNumber} for tenant ${input.tenantId}`);

      return {
        success: true,
        estimate: this.mapEstimate(result.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Error creating estimate: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get estimate by ID
   */
  async getEstimate(estimateId: string, tenantId: string): Promise<EstimateResult> {
    try {
      const query = `
        SELECT * FROM estimates
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      `;

      const result = await this.db.query(query, [estimateId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Estimate not found',
        };
      }

      return {
        success: true,
        estimate: this.mapEstimate(result.rows[0]),
      };
    } catch (error) {
      this.logger.error(`Error getting estimate: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get estimate by estimate number
   */
  async getEstimateByNumber(estimateNumber: string, tenantId: string): Promise<EstimateResult> {
    try {
      const query = `
        SELECT * FROM estimates
        WHERE estimate_number = $1 AND tenant_id = $2 AND deleted_at IS NULL
      `;

      const result = await this.db.query(query, [estimateNumber, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Estimate not found',
        };
      }

      return {
        success: true,
        estimate: this.mapEstimate(result.rows[0]),
      };
    } catch (error) {
      this.logger.error(`Error getting estimate by number: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * List estimates with filtering
   */
  async listEstimates(
    filters: EstimateFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<EstimateListResult> {
    try {
      let query = `
        SELECT * FROM estimates
        WHERE tenant_id = $1 AND deleted_at IS NULL
      `;
      const params: any[] = [filters.tenantId];
      let paramIndex = 2;

      // Apply filters
      if (filters.customerId) {
        query += ` AND customer_id = $${paramIndex}`;
        params.push(filters.customerId);
        paramIndex++;
      }

      if (filters.status) {
        query += ` AND status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.isTemplate !== undefined) {
        query += ` AND is_template = $${paramIndex}`;
        params.push(filters.isTemplate);
        paramIndex++;
      }

      if (filters.fromDate) {
        query += ` AND estimate_date >= $${paramIndex}`;
        params.push(filters.fromDate);
        paramIndex++;
      }

      if (filters.toDate) {
        query += ` AND estimate_date <= $${paramIndex}`;
        params.push(filters.toDate);
        paramIndex++;
      }

      if (filters.searchTerm) {
        query += ` AND (
          job_description ILIKE $${paramIndex} OR
          customer_name ILIKE $${paramIndex} OR
          estimate_number ILIKE $${paramIndex}
        )`;
        params.push(`%${filters.searchTerm}%`);
        paramIndex++;
      }

      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await this.db.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].total);

      // Add ordering and pagination
      query += ` ORDER BY estimate_date DESC, created_at DESC`;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);

      return {
        estimates: result.rows.map(row => this.mapEstimate(row)),
        totalCount,
      };
    } catch (error) {
      this.logger.error(`Error listing estimates: ${error.message}`);
      return {
        estimates: [],
        totalCount: 0,
      };
    }
  }

  /**
   * Update estimate details
   */
  async updateEstimate(
    estimateId: string,
    tenantId: string,
    input: UpdateEstimateInput
  ): Promise<EstimateResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Build dynamic update query
      if (input.customerName !== undefined) {
        updateFields.push(`customer_name = $${paramIndex}`);
        params.push(input.customerName);
        paramIndex++;
      }
      if (input.customerContact !== undefined) {
        updateFields.push(`customer_contact = $${paramIndex}`);
        params.push(input.customerContact);
        paramIndex++;
      }
      if (input.customerEmail !== undefined) {
        updateFields.push(`customer_email = $${paramIndex}`);
        params.push(input.customerEmail);
        paramIndex++;
      }
      if (input.jobDescription !== undefined) {
        updateFields.push(`job_description = $${paramIndex}`);
        params.push(input.jobDescription);
        paramIndex++;
      }
      if (input.quantityEstimated !== undefined) {
        updateFields.push(`quantity_estimated = $${paramIndex}`);
        params.push(input.quantityEstimated);
        paramIndex++;
      }
      if (input.productSpecification !== undefined) {
        updateFields.push(`product_specification = $${paramIndex}`);
        params.push(JSON.stringify(input.productSpecification));
        paramIndex++;
      }
      if (input.targetMarginPercentage !== undefined) {
        updateFields.push(`target_margin_percentage = $${paramIndex}`);
        params.push(input.targetMarginPercentage);
        paramIndex++;
      }
      if (input.estimatedLeadTimeDays !== undefined) {
        updateFields.push(`estimated_lead_time_days = $${paramIndex}`);
        params.push(input.estimatedLeadTimeDays);
        paramIndex++;
      }
      if (input.internalNotes !== undefined) {
        updateFields.push(`internal_notes = $${paramIndex}`);
        params.push(input.internalNotes);
        paramIndex++;
      }
      if (input.customerNotes !== undefined) {
        updateFields.push(`customer_notes = $${paramIndex}`);
        params.push(input.customerNotes);
        paramIndex++;
      }

      // Always update metadata
      updateFields.push(`updated_at = NOW()`);
      if (input.updatedBy) {
        updateFields.push(`updated_by = $${paramIndex}`);
        params.push(input.updatedBy);
        paramIndex++;
      }

      if (updateFields.length === 1) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'No fields to update',
        };
      }

      params.push(estimateId, tenantId);
      const query = `
        UPDATE estimates
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Estimate not found',
        };
      }

      await client.query('COMMIT');

      this.logger.log(`Updated estimate ${estimateId}`);

      return {
        success: true,
        estimate: this.mapEstimate(result.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Error updating estimate: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Delete estimate (soft delete)
   */
  async deleteEstimate(estimateId: string, tenantId: string, deletedBy?: string): Promise<boolean> {
    try {
      const query = `
        UPDATE estimates
        SET deleted_at = NOW(), deleted_by = $1
        WHERE id = $2 AND tenant_id = $3
        RETURNING id
      `;

      const result = await this.db.query(query, [deletedBy, estimateId, tenantId]);

      if (result.rows.length > 0) {
        this.logger.log(`Deleted estimate ${estimateId}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error deleting estimate: ${error.message}`);
      return false;
    }
  }

  // =====================================================
  // OPERATION MANAGEMENT
  // =====================================================

  /**
   * Add operation to estimate
   */
  async addOperation(input: AddOperationInput): Promise<EstimateOperationResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO estimate_operations (
          tenant_id,
          estimate_id,
          sequence_number,
          operation_type,
          operation_description,
          equipment_id,
          work_center_id,
          setup_time_hours,
          run_time_hours,
          total_time_hours,
          run_rate_per_hour,
          labor_hours,
          labor_rate_per_hour,
          number_of_operators,
          material_cost,
          labor_cost,
          equipment_cost,
          overhead_cost,
          outsourcing_cost,
          operation_total_cost,
          is_outsourced,
          vendor_id,
          vendor_quote_amount,
          standard_cost_id,
          cost_calculation_method,
          operation_specifications,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          0, 0, 0, 0, 0, 0, $15, $16, $17, $18, $19, $20, NOW()
        )
        RETURNING *
      `;

      const totalTimeHours = (input.setupTimeHours || 0) + (input.runTimeHours || 0);

      const result = await client.query(query, [
        input.tenantId,
        input.estimateId,
        input.sequenceNumber,
        input.operationType,
        input.operationDescription,
        input.equipmentId,
        input.workCenterId,
        input.setupTimeHours,
        input.runTimeHours,
        totalTimeHours,
        input.runRatePerHour,
        input.laborHours,
        input.laborRatePerHour,
        input.numberOfOperators || 1,
        input.isOutsourced || false,
        input.vendorId,
        input.vendorQuoteAmount,
        input.standardCostId,
        input.costCalculationMethod,
        input.operationSpecifications ? JSON.stringify(input.operationSpecifications) : null,
      ]);

      // Trigger cost recalculation
      await this.recalculateEstimateCosts(client, input.estimateId, input.tenantId);

      await client.query('COMMIT');

      this.logger.log(`Added operation to estimate ${input.estimateId}`);

      return {
        success: true,
        operation: this.mapEstimateOperation(result.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Error adding operation: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update operation
   */
  async updateOperation(
    operationId: string,
    tenantId: string,
    input: UpdateOperationInput
  ): Promise<EstimateOperationResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Build dynamic update
      if (input.sequenceNumber !== undefined) {
        updateFields.push(`sequence_number = $${paramIndex}`);
        params.push(input.sequenceNumber);
        paramIndex++;
      }
      if (input.operationDescription !== undefined) {
        updateFields.push(`operation_description = $${paramIndex}`);
        params.push(input.operationDescription);
        paramIndex++;
      }
      if (input.equipmentId !== undefined) {
        updateFields.push(`equipment_id = $${paramIndex}`);
        params.push(input.equipmentId);
        paramIndex++;
      }
      if (input.workCenterId !== undefined) {
        updateFields.push(`work_center_id = $${paramIndex}`);
        params.push(input.workCenterId);
        paramIndex++;
      }
      if (input.setupTimeHours !== undefined) {
        updateFields.push(`setup_time_hours = $${paramIndex}`);
        params.push(input.setupTimeHours);
        paramIndex++;
      }
      if (input.runTimeHours !== undefined) {
        updateFields.push(`run_time_hours = $${paramIndex}`);
        params.push(input.runTimeHours);
        paramIndex++;
      }
      if (input.runRatePerHour !== undefined) {
        updateFields.push(`run_rate_per_hour = $${paramIndex}`);
        params.push(input.runRatePerHour);
        paramIndex++;
      }
      if (input.laborHours !== undefined) {
        updateFields.push(`labor_hours = $${paramIndex}`);
        params.push(input.laborHours);
        paramIndex++;
      }
      if (input.laborRatePerHour !== undefined) {
        updateFields.push(`labor_rate_per_hour = $${paramIndex}`);
        params.push(input.laborRatePerHour);
        paramIndex++;
      }
      if (input.numberOfOperators !== undefined) {
        updateFields.push(`number_of_operators = $${paramIndex}`);
        params.push(input.numberOfOperators);
        paramIndex++;
      }
      if (input.isOutsourced !== undefined) {
        updateFields.push(`is_outsourced = $${paramIndex}`);
        params.push(input.isOutsourced);
        paramIndex++;
      }
      if (input.vendorId !== undefined) {
        updateFields.push(`vendor_id = $${paramIndex}`);
        params.push(input.vendorId);
        paramIndex++;
      }
      if (input.vendorQuoteAmount !== undefined) {
        updateFields.push(`vendor_quote_amount = $${paramIndex}`);
        params.push(input.vendorQuoteAmount);
        paramIndex++;
      }
      if (input.operationSpecifications !== undefined) {
        updateFields.push(`operation_specifications = $${paramIndex}`);
        params.push(JSON.stringify(input.operationSpecifications));
        paramIndex++;
      }

      // Recalculate total time if setup or run time changed
      if (input.setupTimeHours !== undefined || input.runTimeHours !== undefined) {
        updateFields.push(`total_time_hours = COALESCE(setup_time_hours, 0) + COALESCE(run_time_hours, 0)`);
      }

      if (updateFields.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'No fields to update',
        };
      }

      params.push(operationId, tenantId);
      const query = `
        UPDATE estimate_operations
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Operation not found',
        };
      }

      // Trigger cost recalculation
      const estimateId = result.rows[0].estimate_id;
      await this.recalculateEstimateCosts(client, estimateId, tenantId);

      await client.query('COMMIT');

      this.logger.log(`Updated operation ${operationId}`);

      return {
        success: true,
        operation: this.mapEstimateOperation(result.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Error updating operation: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Delete operation
   */
  async deleteOperation(operationId: string, tenantId: string): Promise<boolean> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get estimate ID before deleting
      const getEstimateQuery = `
        SELECT estimate_id FROM estimate_operations
        WHERE id = $1 AND tenant_id = $2
      `;
      const estimateResult = await client.query(getEstimateQuery, [operationId, tenantId]);

      if (estimateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const estimateId = estimateResult.rows[0].estimate_id;

      // Delete operation (cascade deletes materials)
      const deleteQuery = `
        DELETE FROM estimate_operations
        WHERE id = $1 AND tenant_id = $2
      `;
      await client.query(deleteQuery, [operationId, tenantId]);

      // Recalculate estimate costs
      await this.recalculateEstimateCosts(client, estimateId, tenantId);

      await client.query('COMMIT');

      this.logger.log(`Deleted operation ${operationId}`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Error deleting operation: ${error.message}`);
      return false;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // MATERIAL MANAGEMENT
  // =====================================================

  /**
   * Add material to estimate operation
   */
  async addMaterial(input: AddMaterialInput): Promise<EstimateMaterialResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Calculate quantity with scrap
      const scrapPercentage = input.scrapPercentage || 0;
      const quantityWithScrap = input.quantityRequired * (1 + scrapPercentage / 100);
      const totalCost = quantityWithScrap * input.unitCost;

      const query = `
        INSERT INTO estimate_materials (
          tenant_id,
          estimate_id,
          estimate_operation_id,
          material_id,
          material_code,
          material_name,
          material_category,
          quantity_required,
          unit_of_measure,
          scrap_percentage,
          quantity_with_scrap,
          unit_cost,
          total_cost,
          cost_source,
          preferred_vendor_id,
          preferred_vendor_name,
          is_substitute,
          material_specifications,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, false, $17, NOW()
        )
        RETURNING *
      `;

      const result = await client.query(query, [
        input.tenantId,
        input.estimateId,
        input.estimateOperationId,
        input.materialId,
        input.materialCode,
        input.materialName,
        input.materialCategory,
        input.quantityRequired,
        input.unitOfMeasure,
        scrapPercentage,
        quantityWithScrap,
        input.unitCost,
        totalCost,
        input.costSource || 'STANDARD',
        input.preferredVendorId,
        input.preferredVendorName,
        input.materialSpecifications ? JSON.stringify(input.materialSpecifications) : null,
      ]);

      // Trigger cost recalculation
      await this.recalculateEstimateCosts(client, input.estimateId, input.tenantId);

      await client.query('COMMIT');

      this.logger.log(`Added material to estimate ${input.estimateId}`);

      return {
        success: true,
        material: this.mapEstimateMaterial(result.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Error adding material: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update material
   */
  async updateMaterial(
    materialId: string,
    tenantId: string,
    input: UpdateMaterialInput
  ): Promise<EstimateMaterialResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.quantityRequired !== undefined) {
        updateFields.push(`quantity_required = $${paramIndex}`);
        params.push(input.quantityRequired);
        paramIndex++;
      }
      if (input.scrapPercentage !== undefined) {
        updateFields.push(`scrap_percentage = $${paramIndex}`);
        params.push(input.scrapPercentage);
        paramIndex++;
      }
      if (input.unitCost !== undefined) {
        updateFields.push(`unit_cost = $${paramIndex}`);
        params.push(input.unitCost);
        paramIndex++;
      }
      if (input.preferredVendorId !== undefined) {
        updateFields.push(`preferred_vendor_id = $${paramIndex}`);
        params.push(input.preferredVendorId);
        paramIndex++;
      }
      if (input.materialSpecifications !== undefined) {
        updateFields.push(`material_specifications = $${paramIndex}`);
        params.push(JSON.stringify(input.materialSpecifications));
        paramIndex++;
      }

      // Recalculate quantity with scrap and total cost
      updateFields.push(`quantity_with_scrap = quantity_required * (1 + COALESCE(scrap_percentage, 0) / 100)`);
      updateFields.push(`total_cost = quantity_with_scrap * unit_cost`);

      if (updateFields.length === 2) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'No fields to update',
        };
      }

      params.push(materialId, tenantId);
      const query = `
        UPDATE estimate_materials
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Material not found',
        };
      }

      // Trigger cost recalculation
      const estimateId = result.rows[0].estimate_id;
      await this.recalculateEstimateCosts(client, estimateId, tenantId);

      await client.query('COMMIT');

      this.logger.log(`Updated material ${materialId}`);

      return {
        success: true,
        material: this.mapEstimateMaterial(result.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Error updating material: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Delete material
   */
  async deleteMaterial(materialId: string, tenantId: string): Promise<boolean> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get estimate ID before deleting
      const getEstimateQuery = `
        SELECT estimate_id FROM estimate_materials
        WHERE id = $1 AND tenant_id = $2
      `;
      const estimateResult = await client.query(getEstimateQuery, [materialId, tenantId]);

      if (estimateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const estimateId = estimateResult.rows[0].estimate_id;

      // Delete material
      const deleteQuery = `
        DELETE FROM estimate_materials
        WHERE id = $1 AND tenant_id = $2
      `;
      await client.query(deleteQuery, [materialId, tenantId]);

      // Recalculate estimate costs
      await this.recalculateEstimateCosts(client, estimateId, tenantId);

      await client.query('COMMIT');

      this.logger.log(`Deleted material ${materialId}`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Error deleting material: ${error.message}`);
      return false;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // COST CALCULATION
  // =====================================================

  /**
   * Recalculate estimate costs by calling database function
   */
  private async recalculateEstimateCosts(
    client: PoolClient,
    estimateId: string,
    tenantId: string
  ): Promise<void> {
    try {
      // Call the database rollup function
      await client.query('SELECT rollup_estimate_costs($1, $2)', [estimateId, tenantId]);

      this.logger.log(`Recalculated costs for estimate ${estimateId}`);
    } catch (error) {
      this.logger.error(`Error recalculating estimate costs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Public method to trigger cost recalculation
   */
  async recalculateEstimate(estimateId: string, tenantId: string): Promise<EstimateResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      await this.recalculateEstimateCosts(client, estimateId, tenantId);

      const query = `
        SELECT * FROM estimates
        WHERE id = $1 AND tenant_id = $2
      `;
      const result = await client.query(query, [estimateId, tenantId]);

      await client.query('COMMIT');

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Estimate not found',
        };
      }

      return {
        success: true,
        estimate: this.mapEstimate(result.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Error recalculating estimate: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      client.release();
    }
  }

  // =====================================================
  // WORKFLOW OPERATIONS
  // =====================================================

  /**
   * Approve estimate
   */
  async approveEstimate(
    estimateId: string,
    tenantId: string,
    approvedBy?: string
  ): Promise<EstimateResult> {
    try {
      const query = `
        UPDATE estimates
        SET status = 'APPROVED', approved_at = NOW(), approved_by = $1, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND status = 'PENDING_REVIEW'
        RETURNING *
      `;

      const result = await this.db.query(query, [approvedBy, estimateId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Estimate not found or not in pending review status',
        };
      }

      this.logger.log(`Approved estimate ${estimateId}`);

      return {
        success: true,
        estimate: this.mapEstimate(result.rows[0]),
      };
    } catch (error) {
      this.logger.error(`Error approving estimate: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reject estimate
   */
  async rejectEstimate(
    estimateId: string,
    tenantId: string,
    reason?: string,
    rejectedBy?: string
  ): Promise<EstimateResult> {
    try {
      const query = `
        UPDATE estimates
        SET status = 'REJECTED',
            internal_notes = COALESCE(internal_notes || E'\n\n', '') || 'Rejected: ' || COALESCE($1, 'No reason provided'),
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $3 AND tenant_id = $4 AND status = 'PENDING_REVIEW'
        RETURNING *
      `;

      const result = await this.db.query(query, [reason, rejectedBy, estimateId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Estimate not found or not in pending review status',
        };
      }

      this.logger.log(`Rejected estimate ${estimateId}`);

      return {
        success: true,
        estimate: this.mapEstimate(result.rows[0]),
      };
    } catch (error) {
      this.logger.error(`Error rejecting estimate: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Generate unique estimate number
   */
  private async generateEstimateNumber(client: PoolClient, tenantId: string): Promise<string> {
    const date = new Date();
    const datePrefix = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Get next sequence number for today
    const query = `
      SELECT COUNT(*) as count
      FROM estimates
      WHERE tenant_id = $1 AND estimate_number LIKE $2
    `;

    const result = await client.query(query, [tenantId, `EST-${datePrefix}-%`]);
    const count = parseInt(result.rows[0].count) + 1;

    return `EST-${datePrefix}-${String(count).padStart(4, '0')}`;
  }

  /**
   * Map database row to Estimate interface
   */
  private mapEstimate(row: any): Estimate {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      estimateNumber: row.estimate_number,
      estimateDate: row.estimate_date,
      revisionNumber: row.revision_number,
      parentEstimateId: row.parent_estimate_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerContact: row.customer_contact,
      customerEmail: row.customer_email,
      jobDescription: row.job_description,
      quantityEstimated: row.quantity_estimated,
      productSpecification: row.product_specification,
      totalMaterialCost: parseFloat(row.total_material_cost),
      totalLaborCost: parseFloat(row.total_labor_cost),
      totalEquipmentCost: parseFloat(row.total_equipment_cost),
      totalOverheadCost: parseFloat(row.total_overhead_cost),
      totalOutsourcingCost: parseFloat(row.total_outsourcing_cost),
      totalCost: parseFloat(row.total_cost),
      suggestedPrice: row.suggested_price ? parseFloat(row.suggested_price) : undefined,
      targetMarginPercentage: row.target_margin_percentage ? parseFloat(row.target_margin_percentage) : undefined,
      markupPercentage: row.markup_percentage ? parseFloat(row.markup_percentage) : undefined,
      estimatedLeadTimeDays: row.estimated_lead_time_days,
      estimatedProductionHours: row.estimated_production_hours ? parseFloat(row.estimated_production_hours) : undefined,
      status: row.status as EstimateStatus,
      isTemplate: row.is_template,
      templateName: row.template_name,
      convertedToQuoteId: row.converted_to_quote_id,
      convertedAt: row.converted_at,
      convertedBy: row.converted_by,
      internalNotes: row.internal_notes,
      customerNotes: row.customer_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
    };
  }

  /**
   * Map database row to EstimateOperation interface
   */
  private mapEstimateOperation(row: any): EstimateOperation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      estimateId: row.estimate_id,
      sequenceNumber: row.sequence_number,
      operationType: row.operation_type as OperationType,
      operationDescription: row.operation_description,
      equipmentId: row.equipment_id,
      workCenterId: row.work_center_id,
      setupTimeHours: row.setup_time_hours ? parseFloat(row.setup_time_hours) : undefined,
      runTimeHours: row.run_time_hours ? parseFloat(row.run_time_hours) : undefined,
      totalTimeHours: row.total_time_hours ? parseFloat(row.total_time_hours) : undefined,
      runRatePerHour: row.run_rate_per_hour ? parseFloat(row.run_rate_per_hour) : undefined,
      laborHours: row.labor_hours ? parseFloat(row.labor_hours) : undefined,
      laborRatePerHour: row.labor_rate_per_hour ? parseFloat(row.labor_rate_per_hour) : undefined,
      numberOfOperators: row.number_of_operators,
      materialCost: parseFloat(row.material_cost),
      laborCost: parseFloat(row.labor_cost),
      equipmentCost: parseFloat(row.equipment_cost),
      overheadCost: parseFloat(row.overhead_cost),
      outsourcingCost: parseFloat(row.outsourcing_cost),
      operationTotalCost: parseFloat(row.operation_total_cost),
      isOutsourced: row.is_outsourced,
      vendorId: row.vendor_id,
      vendorQuoteAmount: row.vendor_quote_amount ? parseFloat(row.vendor_quote_amount) : undefined,
      predecessorOperationId: row.predecessor_operation_id,
      dependencyType: row.dependency_type as DependencyType,
      standardCostId: row.standard_cost_id,
      costCalculationMethod: row.cost_calculation_method as CostCalculationMethod,
      operationSpecifications: row.operation_specifications,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to EstimateMaterial interface
   */
  private mapEstimateMaterial(row: any): EstimateMaterial {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      estimateId: row.estimate_id,
      estimateOperationId: row.estimate_operation_id,
      materialId: row.material_id,
      materialCode: row.material_code,
      materialName: row.material_name,
      materialCategory: row.material_category as MaterialCategory,
      quantityRequired: parseFloat(row.quantity_required),
      unitOfMeasure: row.unit_of_measure,
      scrapPercentage: row.scrap_percentage ? parseFloat(row.scrap_percentage) : undefined,
      quantityWithScrap: row.quantity_with_scrap ? parseFloat(row.quantity_with_scrap) : undefined,
      unitCost: parseFloat(row.unit_cost),
      totalCost: parseFloat(row.total_cost),
      costSource: row.cost_source as CostSource,
      preferredVendorId: row.preferred_vendor_id,
      preferredVendorName: row.preferred_vendor_name,
      substituteMaterialId: row.substitute_material_id,
      isSubstitute: row.is_substitute,
      materialSpecifications: row.material_specifications,
      createdAt: row.created_at,
    };
  }
}
