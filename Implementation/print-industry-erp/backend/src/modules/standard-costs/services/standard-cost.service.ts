/**
 * Standard Cost Service
 * REQ-STRATEGIC-AUTO-1767048328661: Estimating & Job Costing Module
 *
 * Manages standard cost master data for materials, operations, labor, and overhead.
 * Standard costs are used as baseline for estimating and variance analysis.
 */

import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

export interface StandardCost {
  id: string;
  tenantId: string;
  costObjectType: string;
  costObjectId?: string;
  costObjectCode: string;
  costObjectDescription?: string;
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  overheadCost: number;
  totalStandardCost: number;
  costPerUnit: string;
  costCenterId?: string;
  glAccount?: string;
  valueCategory: string;
  financialImpactCategory?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isCurrent: boolean;
  calculationMethod?: string;
  assumptions?: string;
  varianceThresholdPercent?: number;
  confidenceLevel?: string;
  dataSource?: string;
  lastReviewedDate?: Date;
  reviewFrequencyDays?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface CostCenter {
  id: string;
  tenantId: string;
  costCenterCode: string;
  costCenterName: string;
  costCenterType: string;
  parentCostCenterId?: string;
  glAccountPrefix?: string;
  budgetAmount?: number;
  budgetPeriod?: string;
  overheadAllocationMethod?: string;
  overheadRate?: number;
  overheadRateUnit?: string;
  managerId?: string;
  siteId?: string;
  facilityId?: string;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStandardCostInput {
  costObjectType: string;
  costObjectId?: string;
  costObjectCode: string;
  costObjectDescription?: string;
  materialCost?: number;
  laborCost?: number;
  equipmentCost?: number;
  overheadCost?: number;
  totalStandardCost: number;
  costPerUnit: string;
  costCenterId?: string;
  glAccount?: string;
  valueCategory?: string;
  financialImpactCategory?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  calculationMethod?: string;
  assumptions?: string;
  varianceThresholdPercent?: number;
  confidenceLevel?: string;
  dataSource?: string;
  reviewFrequencyDays?: number;
}

export interface UpdateStandardCostInput {
  costObjectDescription?: string;
  materialCost?: number;
  laborCost?: number;
  equipmentCost?: number;
  overheadCost?: number;
  totalStandardCost?: number;
  costPerUnit?: string;
  costCenterId?: string;
  glAccount?: string;
  valueCategory?: string;
  financialImpactCategory?: string;
  effectiveTo?: Date;
  calculationMethod?: string;
  assumptions?: string;
  varianceThresholdPercent?: number;
  confidenceLevel?: string;
  dataSource?: string;
}

export interface CreateCostCenterInput {
  costCenterCode: string;
  costCenterName: string;
  costCenterType: string;
  parentCostCenterId?: string;
  glAccountPrefix?: string;
  budgetAmount?: number;
  budgetPeriod?: string;
  overheadAllocationMethod?: string;
  overheadRate?: number;
  overheadRateUnit?: string;
  managerId?: string;
  siteId?: string;
  facilityId?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

@Injectable()
export class StandardCostService {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
  ) {}

  /**
   * Get current standard cost for a cost object
   */
  async getCurrentStandardCost(
    tenantId: string,
    costObjectType: string,
    costObjectCode: string,
  ): Promise<StandardCost | null> {
    const result = await this.db.query(
      `SELECT * FROM get_current_standard_cost($1, $2, $3)`,
      [tenantId, costObjectType, costObjectCode],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToStandardCost(result.rows[0]);
  }

  /**
   * Get standard cost by ID
   */
  async getStandardCostById(
    tenantId: string,
    standardCostId: string,
  ): Promise<StandardCost> {
    const result = await this.db.query(
      `SELECT * FROM standard_costs WHERE id = $1 AND tenant_id = $2`,
      [standardCostId, tenantId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Standard cost ${standardCostId} not found`);
    }

    return this.mapToStandardCost(result.rows[0]);
  }

  /**
   * List standard costs with filtering
   */
  async listStandardCosts(
    tenantId: string,
    filters?: {
      costObjectType?: string;
      isCurrent?: boolean;
      costCenterId?: string;
      effectiveDate?: Date;
    },
  ): Promise<StandardCost[]> {
    let query = `SELECT * FROM standard_costs WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters?.costObjectType) {
      query += ` AND cost_object_type = $${paramIndex}`;
      params.push(filters.costObjectType);
      paramIndex++;
    }

    if (filters?.isCurrent !== undefined) {
      query += ` AND is_current = $${paramIndex}`;
      params.push(filters.isCurrent);
      paramIndex++;
    }

    if (filters?.costCenterId) {
      query += ` AND cost_center_id = $${paramIndex}`;
      params.push(filters.costCenterId);
      paramIndex++;
    }

    if (filters?.effectiveDate) {
      query += ` AND effective_from <= $${paramIndex} AND (effective_to IS NULL OR effective_to >= $${paramIndex})`;
      params.push(filters.effectiveDate);
      paramIndex++;
    }

    query += ` ORDER BY cost_object_type, cost_object_code, effective_from DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToStandardCost(row));
  }

  /**
   * Create new standard cost
   */
  async createStandardCost(
    tenantId: string,
    input: CreateStandardCostInput,
    createdBy?: string,
  ): Promise<StandardCost> {
    // Expire previous current standard cost if exists
    if (input.effectiveFrom) {
      await this.db.query(
        `UPDATE standard_costs
         SET is_current = FALSE,
             effective_to = $1
         WHERE tenant_id = $2
           AND cost_object_type = $3
           AND cost_object_code = $4
           AND is_current = TRUE
           AND effective_from < $1`,
        [input.effectiveFrom, tenantId, input.costObjectType, input.costObjectCode],
      );
    }

    const result = await this.db.query(
      `INSERT INTO standard_costs (
        tenant_id, cost_object_type, cost_object_id, cost_object_code, cost_object_description,
        material_cost, labor_cost, equipment_cost, overhead_cost, total_standard_cost,
        cost_per_unit, cost_center_id, gl_account, value_category, financial_impact_category,
        effective_from, effective_to, is_current, calculation_method, assumptions,
        variance_threshold_percent, confidence_level, data_source, review_frequency_days,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, TRUE, $18, $19,
        $20, $21, $22, $23, $24
      ) RETURNING *`,
      [
        tenantId,
        input.costObjectType,
        input.costObjectId,
        input.costObjectCode,
        input.costObjectDescription,
        input.materialCost || 0,
        input.laborCost || 0,
        input.equipmentCost || 0,
        input.overheadCost || 0,
        input.totalStandardCost,
        input.costPerUnit,
        input.costCenterId,
        input.glAccount,
        input.valueCategory || 'value_added',
        input.financialImpactCategory,
        input.effectiveFrom,
        input.effectiveTo,
        input.calculationMethod,
        input.assumptions,
        input.varianceThresholdPercent || 10.0,
        input.confidenceLevel,
        input.dataSource,
        input.reviewFrequencyDays || 365,
        createdBy,
      ],
    );

    return this.mapToStandardCost(result.rows[0]);
  }

  /**
   * Update standard cost
   */
  async updateStandardCost(
    tenantId: string,
    standardCostId: string,
    input: UpdateStandardCostInput,
    updatedBy?: string,
  ): Promise<StandardCost> {
    const updates: string[] = [];
    const params: any[] = [standardCostId, tenantId];
    let paramIndex = 3;

    if (input.costObjectDescription !== undefined) {
      updates.push(`cost_object_description = $${paramIndex}`);
      params.push(input.costObjectDescription);
      paramIndex++;
    }

    if (input.materialCost !== undefined) {
      updates.push(`material_cost = $${paramIndex}`);
      params.push(input.materialCost);
      paramIndex++;
    }

    if (input.laborCost !== undefined) {
      updates.push(`labor_cost = $${paramIndex}`);
      params.push(input.laborCost);
      paramIndex++;
    }

    if (input.equipmentCost !== undefined) {
      updates.push(`equipment_cost = $${paramIndex}`);
      params.push(input.equipmentCost);
      paramIndex++;
    }

    if (input.overheadCost !== undefined) {
      updates.push(`overhead_cost = $${paramIndex}`);
      params.push(input.overheadCost);
      paramIndex++;
    }

    if (input.totalStandardCost !== undefined) {
      updates.push(`total_standard_cost = $${paramIndex}`);
      params.push(input.totalStandardCost);
      paramIndex++;
    }

    if (input.costPerUnit !== undefined) {
      updates.push(`cost_per_unit = $${paramIndex}`);
      params.push(input.costPerUnit);
      paramIndex++;
    }

    if (input.effectiveTo !== undefined) {
      updates.push(`effective_to = $${paramIndex}`);
      params.push(input.effectiveTo);
      paramIndex++;
    }

    if (input.calculationMethod !== undefined) {
      updates.push(`calculation_method = $${paramIndex}`);
      params.push(input.calculationMethod);
      paramIndex++;
    }

    if (input.assumptions !== undefined) {
      updates.push(`assumptions = $${paramIndex}`);
      params.push(input.assumptions);
      paramIndex++;
    }

    if (updatedBy) {
      updates.push(`updated_by = $${paramIndex}`);
      params.push(updatedBy);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const result = await this.db.query(
      `UPDATE standard_costs SET ${updates.join(', ')}
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Standard cost ${standardCostId} not found`);
    }

    return this.mapToStandardCost(result.rows[0]);
  }

  /**
   * Expire standard cost (set effective_to date)
   */
  async expireStandardCost(
    tenantId: string,
    standardCostId: string,
    effectiveTo: Date,
  ): Promise<void> {
    const result = await this.db.query(
      `UPDATE standard_costs
       SET effective_to = $1,
           is_current = FALSE
       WHERE id = $2 AND tenant_id = $3`,
      [effectiveTo, standardCostId, tenantId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException(`Standard cost ${standardCostId} not found`);
    }
  }

  /**
   * Get cost center by ID
   */
  async getCostCenterById(
    tenantId: string,
    costCenterId: string,
  ): Promise<CostCenter> {
    const result = await this.db.query(
      `SELECT * FROM cost_centers WHERE id = $1 AND tenant_id = $2`,
      [costCenterId, tenantId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Cost center ${costCenterId} not found`);
    }

    return this.mapToCostCenter(result.rows[0]);
  }

  /**
   * Get cost center by code
   */
  async getCostCenterByCode(
    tenantId: string,
    costCenterCode: string,
  ): Promise<CostCenter | null> {
    const result = await this.db.query(
      `SELECT * FROM cost_centers WHERE cost_center_code = $1 AND tenant_id = $2`,
      [costCenterCode, tenantId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToCostCenter(result.rows[0]);
  }

  /**
   * List cost centers
   */
  async listCostCenters(
    tenantId: string,
    filters?: {
      costCenterType?: string;
      isActive?: boolean;
    },
  ): Promise<CostCenter[]> {
    let query = `SELECT * FROM cost_centers WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters?.costCenterType) {
      query += ` AND cost_center_type = $${paramIndex}`;
      params.push(filters.costCenterType);
      paramIndex++;
    }

    if (filters?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(filters.isActive);
      paramIndex++;
    }

    query += ` ORDER BY cost_center_code`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToCostCenter(row));
  }

  /**
   * Create cost center
   */
  async createCostCenter(
    tenantId: string,
    input: CreateCostCenterInput,
    createdBy?: string,
  ): Promise<CostCenter> {
    const result = await this.db.query(
      `INSERT INTO cost_centers (
        tenant_id, cost_center_code, cost_center_name, cost_center_type,
        parent_cost_center_id, gl_account_prefix, budget_amount, budget_period,
        overhead_allocation_method, overhead_rate, overhead_rate_unit,
        manager_id, site_id, facility_id, is_active, effective_from, effective_to,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE, $15, $16, $17
      ) RETURNING *`,
      [
        tenantId,
        input.costCenterCode,
        input.costCenterName,
        input.costCenterType,
        input.parentCostCenterId,
        input.glAccountPrefix,
        input.budgetAmount,
        input.budgetPeriod,
        input.overheadAllocationMethod,
        input.overheadRate,
        input.overheadRateUnit,
        input.managerId,
        input.siteId,
        input.facilityId,
        input.effectiveFrom,
        input.effectiveTo,
        createdBy,
      ],
    );

    return this.mapToCostCenter(result.rows[0]);
  }

  /**
   * Calculate overhead rate for cost center
   */
  async calculateOverheadRate(
    tenantId: string,
    costCenterId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    // This is a placeholder - actual implementation would depend on
    // how overhead is tracked in the system (from GL, cost allocations, etc.)
    const costCenter = await this.getCostCenterById(tenantId, costCenterId);

    // Return configured rate if available
    if (costCenter.overheadRate) {
      return costCenter.overheadRate;
    }

    // Otherwise would calculate from actual costs
    // For now, return default rate
    return 0;
  }

  /**
   * Bulk import standard costs
   */
  async bulkImportStandardCosts(
    tenantId: string,
    standardCosts: CreateStandardCostInput[],
    createdBy?: string,
  ): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];

    for (const input of standardCosts) {
      try {
        await this.createStandardCost(tenantId, input, createdBy);
        imported++;
      } catch (error) {
        errors.push(
          `Failed to import ${input.costObjectCode}: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`,
        );
      }
    }

    return { imported, errors };
  }

  private mapToStandardCost(row: any): StandardCost {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      costObjectType: row.cost_object_type,
      costObjectId: row.cost_object_id,
      costObjectCode: row.cost_object_code,
      costObjectDescription: row.cost_object_description,
      materialCost: parseFloat(row.material_cost),
      laborCost: parseFloat(row.labor_cost),
      equipmentCost: parseFloat(row.equipment_cost),
      overheadCost: parseFloat(row.overhead_cost),
      totalStandardCost: parseFloat(row.total_standard_cost),
      costPerUnit: row.cost_per_unit,
      costCenterId: row.cost_center_id,
      glAccount: row.gl_account,
      valueCategory: row.value_category,
      financialImpactCategory: row.financial_impact_category,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      isCurrent: row.is_current,
      calculationMethod: row.calculation_method,
      assumptions: row.assumptions,
      varianceThresholdPercent: row.variance_threshold_percent ? parseFloat(row.variance_threshold_percent) : undefined,
      confidenceLevel: row.confidence_level,
      dataSource: row.data_source,
      lastReviewedDate: row.last_reviewed_date,
      reviewFrequencyDays: row.review_frequency_days,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
    };
  }

  private mapToCostCenter(row: any): CostCenter {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      costCenterCode: row.cost_center_code,
      costCenterName: row.cost_center_name,
      costCenterType: row.cost_center_type,
      parentCostCenterId: row.parent_cost_center_id,
      glAccountPrefix: row.gl_account_prefix,
      budgetAmount: row.budget_amount ? parseFloat(row.budget_amount) : undefined,
      budgetPeriod: row.budget_period,
      overheadAllocationMethod: row.overhead_allocation_method,
      overheadRate: row.overhead_rate ? parseFloat(row.overhead_rate) : undefined,
      overheadRateUnit: row.overhead_rate_unit,
      managerId: row.manager_id,
      siteId: row.site_id,
      facilityId: row.facility_id,
      isActive: row.is_active,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
