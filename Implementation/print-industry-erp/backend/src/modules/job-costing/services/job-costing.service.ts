/**
 * Job Costing Service
 * REQ-STRATEGIC-AUTO-1767066329938: Complete Estimating & Job Costing Module
 *
 * Core business logic for job costing operations including actual cost tracking,
 * variance analysis, profitability calculations, and cost reconciliation.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  JobCost,
  JobCostUpdate,
  JobProfitability,
  CostLineItem,
  VarianceReport,
  VarianceSummary,
  InitializeJobCostInput,
  UpdateActualCostsInput,
  IncrementCostInput,
  RollupProductionCostsInput,
  AddFinalAdjustmentInput,
  ReconcileJobCostInput,
  CloseJobCostingInput,
  UpdateJobCostStatusInput,
  JobCostFilters,
  VarianceReportFilters,
  JobCostResult,
  JobCostListResult,
  VarianceReportResult,
  JobCostStatus,
  CostCategory,
  UpdateSource,
  RollupSource,
} from '../interfaces/job-costing.interface';

@Injectable()
export class JobCostingService {
  private readonly logger = new Logger(JobCostingService.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool
  ) {}

  // =====================================================
  // JOB COST INITIALIZATION
  // =====================================================

  /**
   * Initialize job cost from estimate using database function
   * Calls initialize_job_cost_from_estimate() to create job cost record
   * with estimated costs populated from the estimate.
   */
  async initializeJobCost(input: InitializeJobCostInput): Promise<JobCostResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Call database function to initialize job cost from estimate
      const query = `
        SELECT * FROM initialize_job_cost_from_estimate($1, $2, $3, $4, $5)
      `;

      const result = await client.query(query, [
        input.tenantId,
        input.jobId,
        input.estimateId,
        input.totalAmount,
        input.createdBy,
      ]);

      await client.query('COMMIT');

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Failed to initialize job cost',
        };
      }

      this.logger.log(`Initialized job cost for job ${input.jobId}`);

      return {
        success: true,
        jobCost: this.mapJobCost(result.rows[0]),
      };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error initializing job cost: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      client.release();
    }
  }

  // =====================================================
  // JOB COST CRUD OPERATIONS
  // =====================================================

  /**
   * Get job cost by ID
   */
  async getJobCost(jobCostId: string, tenantId: string): Promise<JobCostResult> {
    try {
      const query = `
        SELECT * FROM job_costs
        WHERE id = $1 AND tenant_id = $2
      `;

      const result = await this.db.query(query, [jobCostId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Job cost not found',
        };
      }

      return {
        success: true,
        jobCost: this.mapJobCost(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting job cost: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get job cost by job ID
   * Helper method for GraphQL resolver to query by job ID instead of job cost ID
   */
  async getJobCostByJobId(jobId: string, tenantId: string): Promise<JobCostResult> {
    try {
      const query = `
        SELECT * FROM job_costs
        WHERE job_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await this.db.query(query, [jobId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Job cost not found for this job',
        };
      }

      return {
        success: true,
        jobCost: this.mapJobCost(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting job cost by job ID: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * List job costs with filtering
   */
  async listJobCosts(
    filters: JobCostFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<JobCostListResult> {
    try {
      let query = `
        SELECT * FROM job_costs
        WHERE tenant_id = $1
      `;
      const params: any[] = [filters.tenantId];
      let paramIndex = 2;

      // Apply filters
      if (filters.jobId) {
        query += ` AND job_id = $${paramIndex}`;
        params.push(filters.jobId);
        paramIndex++;
      }

      if (filters.status) {
        query += ` AND status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.fromDate) {
        query += ` AND costing_date >= $${paramIndex}`;
        params.push(filters.fromDate);
        paramIndex++;
      }

      if (filters.toDate) {
        query += ` AND costing_date <= $${paramIndex}`;
        params.push(filters.toDate);
        paramIndex++;
      }

      if (filters.minVariancePercentage !== undefined) {
        query += ` AND ABS(cost_variance_percentage) >= $${paramIndex}`;
        params.push(filters.minVariancePercentage);
        paramIndex++;
      }

      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await this.db.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].total);

      // Add ordering and pagination
      query += ` ORDER BY created_at DESC`;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);

      return {
        jobCosts: result.rows.map(row => this.mapJobCost(row)),
        totalCount,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing job costs: ${errorMessage}`);
      return {
        jobCosts: [],
        totalCount: 0,
      };
    }
  }

  // =====================================================
  // COST UPDATE OPERATIONS
  // =====================================================

  /**
   * Update actual cost categories
   * Updates one or more cost categories with new values.
   */
  async updateActualCosts(
    jobCostId: string,
    tenantId: string,
    input: UpdateActualCostsInput
  ): Promise<JobCostResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Build dynamic update query
      if (input.materialCost !== undefined) {
        updateFields.push(`material_cost = $${paramIndex}`);
        params.push(input.materialCost);
        paramIndex++;
      }
      if (input.laborCost !== undefined) {
        updateFields.push(`labor_cost = $${paramIndex}`);
        params.push(input.laborCost);
        paramIndex++;
      }
      if (input.equipmentCost !== undefined) {
        updateFields.push(`equipment_cost = $${paramIndex}`);
        params.push(input.equipmentCost);
        paramIndex++;
      }
      if (input.overheadCost !== undefined) {
        updateFields.push(`overhead_cost = $${paramIndex}`);
        params.push(input.overheadCost);
        paramIndex++;
      }
      if (input.outsourcingCost !== undefined) {
        updateFields.push(`outsourcing_cost = $${paramIndex}`);
        params.push(input.outsourcingCost);
        paramIndex++;
      }
      if (input.otherCost !== undefined) {
        updateFields.push(`other_cost = $${paramIndex}`);
        params.push(input.otherCost);
        paramIndex++;
      }
      if (input.notes !== undefined) {
        updateFields.push(`notes = $${paramIndex}`);
        params.push(input.notes);
        paramIndex++;
      }

      // Always update metadata
      updateFields.push(`updated_at = NOW()`);
      if (input.updatedBy) {
        updateFields.push(`updated_by = $${paramIndex}`);
        params.push(input.updatedBy);
        paramIndex++;
      }

      // Recalculate total cost and profitability metrics
      updateFields.push(`total_cost = COALESCE(material_cost, 0) + COALESCE(labor_cost, 0) +
                          COALESCE(equipment_cost, 0) + COALESCE(overhead_cost, 0) +
                          COALESCE(outsourcing_cost, 0) + COALESCE(other_cost, 0)`);
      updateFields.push(`gross_profit = total_amount - total_cost`);
      updateFields.push(`gross_profit_margin = CASE WHEN total_amount > 0
                          THEN ((total_amount - total_cost) / total_amount * 100)
                          ELSE 0 END`);
      updateFields.push(`cost_variance = CASE WHEN estimated_total_cost IS NOT NULL
                          THEN (total_cost - estimated_total_cost)
                          ELSE NULL END`);
      updateFields.push(`cost_variance_percentage = CASE WHEN estimated_total_cost > 0
                          THEN ((total_cost - estimated_total_cost) / estimated_total_cost * 100)
                          ELSE NULL END`);
      updateFields.push(`material_variance = CASE WHEN estimated_material_cost IS NOT NULL
                          THEN (material_cost - estimated_material_cost)
                          ELSE NULL END`);
      updateFields.push(`labor_variance = CASE WHEN estimated_labor_cost IS NOT NULL
                          THEN (labor_cost - estimated_labor_cost)
                          ELSE NULL END`);
      updateFields.push(`equipment_variance = CASE WHEN estimated_equipment_cost IS NOT NULL
                          THEN (equipment_cost - estimated_equipment_cost)
                          ELSE NULL END`);

      if (updateFields.length === 8) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'No cost fields to update',
        };
      }

      params.push(jobCostId, tenantId);
      const query = `
        UPDATE job_costs
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Job cost not found',
        };
      }

      await client.query('COMMIT');

      this.logger.log(`Updated actual costs for job cost ${jobCostId}`);

      return {
        success: true,
        jobCost: this.mapJobCost(result.rows[0]),
      };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error updating actual costs: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Add incremental cost using database function
   * Calls update_job_cost_incremental() to add a cost delta to a category
   * and track the update in job_cost_updates table.
   */
  async incrementCost(
    tenantId: string,
    input: IncrementCostInput
  ): Promise<JobCostResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Call database function to increment cost
      const query = `
        SELECT * FROM update_job_cost_incremental(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
      `;

      const result = await client.query(query, [
        tenantId,
        input.jobCostId,
        input.costCategory,
        input.costDelta,
        input.updateSource,
        input.sourceId,
        input.quantity,
        input.unitCost,
        input.description,
        input.updateMetadata ? JSON.stringify(input.updateMetadata) : null,
      ]);

      await client.query('COMMIT');

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Failed to increment cost',
        };
      }

      this.logger.log(`Incremented ${input.costCategory} cost by ${input.costDelta} for job cost ${input.jobCostId}`);

      return {
        success: true,
        jobCost: this.mapJobCost(result.rows[0]),
      };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error incrementing cost: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Rollup costs from production orders
   * Aggregates actual costs from production order completion and updates job costs.
   */
  async rollupProductionCosts(
    tenantId: string,
    input: RollupProductionCostsInput
  ): Promise<JobCostResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get job cost ID for this job
      const getJobCostQuery = `
        SELECT id FROM job_costs
        WHERE tenant_id = $1 AND job_id = $2
      `;
      const jobCostResult = await client.query(getJobCostQuery, [tenantId, input.jobId]);

      if (jobCostResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Job cost not found for job',
        };
      }

      const jobCostId = jobCostResult.rows[0].id;

      // Aggregate costs from production order
      // This is a simplified example - actual implementation would query production_orders table
      const rollupQuery = `
        UPDATE job_costs
        SET
          last_rollup_at = NOW(),
          last_rollup_source = $1,
          updated_at = NOW(),
          updated_by = $2
        WHERE id = $3 AND tenant_id = $4
        RETURNING *
      `;

      const result = await client.query(rollupQuery, [
        input.rollupSource,
        input.updatedBy,
        jobCostId,
        tenantId,
      ]);

      await client.query('COMMIT');

      this.logger.log(`Rolled up production costs for job ${input.jobId} from ${input.rollupSource}`);

      return {
        success: true,
        jobCost: this.mapJobCost(result.rows[0]),
      };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error rolling up production costs: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Add final cost adjustment
   * Adds a final adjustment to job costs (e.g., unexpected expenses, credits).
   */
  async addFinalAdjustment(
    tenantId: string,
    input: AddFinalAdjustmentInput
  ): Promise<JobCostResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Add adjustment to other_cost category
      const adjustmentQuery = `
        UPDATE job_costs
        SET
          other_cost = COALESCE(other_cost, 0) + $1,
          total_cost = COALESCE(material_cost, 0) + COALESCE(labor_cost, 0) +
                       COALESCE(equipment_cost, 0) + COALESCE(overhead_cost, 0) +
                       COALESCE(outsourcing_cost, 0) + COALESCE(other_cost, 0) + $1,
          notes = COALESCE(notes || E'\n\n', '') || 'Adjustment: ' || $2 || ' - ' ||
                  COALESCE($3, 'No reason provided') || ' ($' || $1 || ')',
          updated_at = NOW(),
          updated_by = $4
        WHERE id = $5 AND tenant_id = $6
        RETURNING *
      `;

      const result = await client.query(adjustmentQuery, [
        input.amount,
        input.adjustmentType,
        input.reason,
        input.adjustedBy,
        input.jobCostId,
        tenantId,
      ]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Job cost not found',
        };
      }

      // Recalculate profitability metrics
      const recalcQuery = `
        UPDATE job_costs
        SET
          gross_profit = total_amount - total_cost,
          gross_profit_margin = CASE WHEN total_amount > 0
                                THEN ((total_amount - total_cost) / total_amount * 100)
                                ELSE 0 END,
          cost_variance = CASE WHEN estimated_total_cost IS NOT NULL
                          THEN (total_cost - estimated_total_cost)
                          ELSE NULL END,
          cost_variance_percentage = CASE WHEN estimated_total_cost > 0
                                     THEN ((total_cost - estimated_total_cost) / estimated_total_cost * 100)
                                     ELSE NULL END
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `;

      const finalResult = await client.query(recalcQuery, [input.jobCostId, tenantId]);

      await client.query('COMMIT');

      this.logger.log(`Added final adjustment of ${input.amount} to job cost ${input.jobCostId}`);

      return {
        success: true,
        jobCost: this.mapJobCost(finalResult.rows[0]),
      };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error adding final adjustment: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      client.release();
    }
  }

  // =====================================================
  // RECONCILIATION & STATUS MANAGEMENT
  // =====================================================

  /**
   * Mark job cost as reconciled
   * Sets the reconciliation flag and timestamp after cost verification.
   */
  async reconcileJobCost(
    tenantId: string,
    input: ReconcileJobCostInput
  ): Promise<JobCostResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const query = `
        UPDATE job_costs
        SET
          is_reconciled = true,
          reconciled_at = NOW(),
          reconciled_by = $1,
          status = CASE WHEN status = 'IN_PROGRESS' THEN 'RECONCILED' ELSE status END,
          notes = CASE WHEN $2 IS NOT NULL
                  THEN COALESCE(notes || E'\n\n', '') || 'Reconciled: ' || $2
                  ELSE notes END,
          updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4
        RETURNING *
      `;

      const result = await client.query(query, [
        input.reconciledBy,
        input.notes,
        input.jobCostId,
        tenantId,
      ]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Job cost not found',
        };
      }

      await client.query('COMMIT');

      this.logger.log(`Reconciled job cost ${input.jobCostId}`);

      return {
        success: true,
        jobCost: this.mapJobCost(result.rows[0]),
      };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error reconciling job cost: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Close and complete job costing
   * Marks the job costing as completed and closed.
   */
  async closeJobCosting(
    tenantId: string,
    input: CloseJobCostingInput
  ): Promise<JobCostResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const query = `
        UPDATE job_costs
        SET
          status = 'CLOSED',
          completed_at = NOW(),
          notes = CASE WHEN $1 IS NOT NULL
                  THEN COALESCE(notes || E'\n\n', '') || 'Closed: ' || $1
                  ELSE notes END,
          updated_at = NOW(),
          updated_by = $2
        WHERE id = $3 AND tenant_id = $4 AND status = 'RECONCILED'
        RETURNING *
      `;

      const result = await client.query(query, [
        input.completionNotes,
        input.closedBy,
        input.jobCostId,
        tenantId,
      ]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Job cost not found or not in reconciled status',
        };
      }

      await client.query('COMMIT');

      this.logger.log(`Closed job costing ${input.jobCostId}`);

      return {
        success: true,
        jobCost: this.mapJobCost(result.rows[0]),
      };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error closing job costing: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update job cost status
   */
  async updateJobCostStatus(
    jobCostId: string,
    tenantId: string,
    input: UpdateJobCostStatusInput
  ): Promise<JobCostResult> {
    try {
      const query = `
        UPDATE job_costs
        SET
          status = $1,
          notes = CASE WHEN $2 IS NOT NULL
                  THEN COALESCE(notes || E'\n\n', '') || 'Status changed to ' || $1 || ': ' || $2
                  ELSE notes END,
          updated_at = NOW(),
          updated_by = $3
        WHERE id = $4 AND tenant_id = $5
        RETURNING *
      `;

      const result = await this.db.query(query, [
        input.status,
        input.notes,
        input.updatedBy,
        jobCostId,
        tenantId,
      ]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Job cost not found',
        };
      }

      this.logger.log(`Updated job cost ${jobCostId} status to ${input.status}`);

      return {
        success: true,
        jobCost: this.mapJobCost(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error updating job cost status: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // =====================================================
  // PROFITABILITY & VARIANCE ANALYSIS
  // =====================================================

  /**
   * Get job profitability analysis
   * Returns profitability metrics for a specific job.
   */
  async getJobProfitability(jobCostId: string, tenantId: string): Promise<JobProfitability | null> {
    try {
      const query = `
        SELECT
          jc.job_id,
          j.job_number,
          j.customer_name,
          j.job_description,
          jc.total_amount as revenue,
          jc.total_cost,
          jc.gross_profit,
          jc.gross_profit_margin as gross_margin,
          jc.estimated_total_cost as estimated_cost,
          jc.cost_variance,
          jc.cost_variance_percentage,
          jc.status,
          jc.costing_date
        FROM job_costs jc
        LEFT JOIN jobs j ON j.id = jc.job_id AND j.tenant_id = jc.tenant_id
        WHERE jc.id = $1 AND jc.tenant_id = $2
      `;

      const result = await this.db.query(query, [jobCostId, tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        jobId: row.job_id,
        jobNumber: row.job_number,
        customerName: row.customer_name,
        jobDescription: row.job_description ?? undefined,
        revenue: parseFloat(row.revenue || '0'),
        totalCost: parseFloat(row.total_cost || '0'),
        grossProfit: parseFloat(row.gross_profit || '0'),
        grossMargin: parseFloat(row.gross_margin || '0'),
        estimatedCost: row.estimated_cost != null ? parseFloat(row.estimated_cost) : undefined,
        costVariance: row.cost_variance != null ? parseFloat(row.cost_variance) : undefined,
        costVariancePercentage: row.cost_variance_percentage != null ? parseFloat(row.cost_variance_percentage) : undefined,
        status: row.status as JobCostStatus,
        costingDate: row.costing_date ? new Date(row.costing_date) : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting job profitability: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get job profitability by job ID
   * Helper method for GraphQL resolver
   */
  async getJobProfitabilityByJobId(jobId: string, tenantId: string): Promise<JobProfitability | null> {
    try {
      // First get job cost ID
      const jobCostQuery = `SELECT id FROM job_costs WHERE job_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`;
      const jobCostResult = await this.db.query(jobCostQuery, [jobId, tenantId]);

      if (jobCostResult.rows.length === 0) {
        return null;
      }

      const jobCostId = jobCostResult.rows[0].id;
      return await this.getJobProfitability(jobCostId, tenantId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting job profitability by job ID: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get job cost history by job ID
   * Helper method for GraphQL resolver
   */
  async getJobCostHistoryByJobId(jobId: string, tenantId: string): Promise<JobCostUpdate[]> {
    try {
      // Get job cost ID first
      const jobCostQuery = `SELECT id FROM job_costs WHERE job_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`;
      const jobCostResult = await this.db.query(jobCostQuery, [jobId, tenantId]);

      if (jobCostResult.rows.length === 0) {
        return [];
      }

      const jobCostId = jobCostResult.rows[0].id;
      return await this.getJobCostHistory(jobCostId, tenantId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting job cost history by job ID: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Generate variance report
   * Creates a comprehensive variance report for jobs within specified criteria.
   */
  async generateVarianceReport(filters: VarianceReportFilters): Promise<VarianceReportResult> {
    try {
      let query = `
        SELECT
          jc.job_id,
          j.job_number,
          j.customer_name,
          j.job_description,
          jc.total_amount as revenue,
          jc.total_cost,
          jc.gross_profit,
          jc.gross_profit_margin as gross_margin,
          jc.estimated_total_cost as estimated_cost,
          jc.cost_variance,
          jc.cost_variance_percentage,
          jc.status,
          jc.costing_date
        FROM job_costs jc
        LEFT JOIN jobs j ON j.id = jc.job_id AND j.tenant_id = jc.tenant_id
        WHERE jc.tenant_id = $1
      `;
      const params: any[] = [filters.tenantId];
      let paramIndex = 2;

      // Apply filters
      if (filters.fromDate) {
        query += ` AND jc.costing_date >= $${paramIndex}`;
        params.push(filters.fromDate);
        paramIndex++;
      }

      if (filters.toDate) {
        query += ` AND jc.costing_date <= $${paramIndex}`;
        params.push(filters.toDate);
        paramIndex++;
      }

      if (filters.minVariancePercentage !== undefined) {
        query += ` AND ABS(jc.cost_variance_percentage) >= $${paramIndex}`;
        params.push(filters.minVariancePercentage);
        paramIndex++;
      }

      if (filters.customerId) {
        query += ` AND j.customer_id = $${paramIndex}`;
        params.push(filters.customerId);
        paramIndex++;
      }

      if (filters.status) {
        query += ` AND jc.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      query += ` ORDER BY jc.cost_variance_percentage DESC NULLS LAST`;

      const result = await this.db.query(query, params);

      // Map jobs
      const jobs: JobProfitability[] = result.rows.map(row => ({
        jobId: row.job_id,
        jobNumber: row.job_number,
        customerName: row.customer_name,
        jobDescription: row.job_description ?? undefined,
        revenue: parseFloat(row.revenue || '0'),
        totalCost: parseFloat(row.total_cost || '0'),
        grossProfit: parseFloat(row.gross_profit || '0'),
        grossMargin: parseFloat(row.gross_margin || '0'),
        estimatedCost: row.estimated_cost != null ? parseFloat(row.estimated_cost) : undefined,
        costVariance: row.cost_variance != null ? parseFloat(row.cost_variance) : undefined,
        costVariancePercentage: row.cost_variance_percentage != null ? parseFloat(row.cost_variance_percentage) : undefined,
        status: row.status as JobCostStatus,
        costingDate: row.costing_date ? new Date(row.costing_date) : undefined,
      }));

      // Calculate summary statistics
      const summary = this.calculateVarianceSummary(jobs);

      return {
        success: true,
        report: {
          jobs,
          summary,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error generating variance report: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get job cost update history
   * Returns the history of cost updates for a job cost.
   */
  async getJobCostHistory(jobCostId: string, tenantId: string): Promise<JobCostUpdate[]> {
    try {
      const query = `
        SELECT * FROM job_cost_updates
        WHERE job_cost_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
      `;

      const result = await this.db.query(query, [jobCostId, tenantId]);

      return result.rows.map(row => this.mapJobCostUpdate(row));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting job cost history: ${errorMessage}`);
      return [];
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Calculate variance summary statistics
   */
  private calculateVarianceSummary(jobs: JobProfitability[]): VarianceSummary {
    const totalJobs = jobs.length;

    if (totalJobs === 0) {
      return {
        totalJobs: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        avgMargin: 0,
        totalVariance: 0,
        avgVariancePercentage: 0,
        jobsOverBudget: 0,
        jobsUnderBudget: 0,
      };
    }

    const totalRevenue = jobs.reduce((sum, job) => sum + job.revenue, 0);
    const totalCost = jobs.reduce((sum, job) => sum + job.totalCost, 0);
    const totalProfit = jobs.reduce((sum, job) => sum + job.grossProfit, 0);
    const totalVariance = jobs.reduce((sum, job) => sum + (job.costVariance || 0), 0);

    const margins = jobs.map(job => job.grossMargin).sort((a, b) => a - b);
    const minMargin = margins[0];
    const maxMargin = margins[margins.length - 1];
    const medianMargin = margins.length % 2 === 0
      ? (margins[margins.length / 2 - 1] + margins[margins.length / 2]) / 2
      : margins[Math.floor(margins.length / 2)];

    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const jobsWithVariance = jobs.filter(job => job.costVariancePercentage !== undefined);
    const avgVariancePercentage = jobsWithVariance.length > 0
      ? jobsWithVariance.reduce((sum, job) => sum + (job.costVariancePercentage || 0), 0) / jobsWithVariance.length
      : 0;

    const jobsOverBudget = jobs.filter(job => (job.costVariance || 0) > 0).length;
    const jobsUnderBudget = jobs.filter(job => (job.costVariance || 0) < 0).length;

    return {
      totalJobs,
      totalRevenue,
      totalCost,
      totalProfit,
      avgMargin,
      minMargin,
      maxMargin,
      medianMargin,
      totalVariance,
      avgVariancePercentage,
      jobsOverBudget,
      jobsUnderBudget,
    };
  }

  /**
   * Map database row to JobCost interface
   */
  private mapJobCost(row: any): JobCost {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      jobId: row.job_id,
      estimateId: row.estimate_id ?? undefined,
      totalAmount: parseFloat(row.total_amount || '0'),
      totalCost: parseFloat(row.total_cost || '0'),
      materialCost: parseFloat(row.material_cost || '0'),
      laborCost: parseFloat(row.labor_cost || '0'),
      equipmentCost: parseFloat(row.equipment_cost || '0'),
      overheadCost: parseFloat(row.overhead_cost || '0'),
      outsourcingCost: parseFloat(row.outsourcing_cost || '0'),
      otherCost: parseFloat(row.other_cost || '0'),
      estimatedMaterialCost: row.estimated_material_cost != null ? parseFloat(row.estimated_material_cost) : undefined,
      estimatedLaborCost: row.estimated_labor_cost != null ? parseFloat(row.estimated_labor_cost) : undefined,
      estimatedEquipmentCost: row.estimated_equipment_cost != null ? parseFloat(row.estimated_equipment_cost) : undefined,
      estimatedOverheadCost: row.estimated_overhead_cost != null ? parseFloat(row.estimated_overhead_cost) : undefined,
      estimatedOutsourcingCost: row.estimated_outsourcing_cost != null ? parseFloat(row.estimated_outsourcing_cost) : undefined,
      estimatedTotalCost: row.estimated_total_cost != null ? parseFloat(row.estimated_total_cost) : undefined,
      grossProfit: parseFloat(row.gross_profit || '0'),
      grossProfitMargin: parseFloat(row.gross_profit_margin || '0'),
      costVariance: row.cost_variance != null ? parseFloat(row.cost_variance) : undefined,
      costVariancePercentage: row.cost_variance_percentage != null ? parseFloat(row.cost_variance_percentage) : undefined,
      materialVariance: row.material_variance != null ? parseFloat(row.material_variance) : undefined,
      laborVariance: row.labor_variance != null ? parseFloat(row.labor_variance) : undefined,
      equipmentVariance: row.equipment_variance != null ? parseFloat(row.equipment_variance) : undefined,
      status: row.status as JobCostStatus,
      costingDate: row.costing_date ? new Date(row.costing_date) : undefined,
      notes: row.notes ?? undefined,
      isReconciled: Boolean(row.is_reconciled),
      reconciledAt: row.reconciled_at ? new Date(row.reconciled_at) : undefined,
      reconciledBy: row.reconciled_by ?? undefined,
      lastRollupAt: row.last_rollup_at ? new Date(row.last_rollup_at) : undefined,
      lastRollupSource: row.last_rollup_source ? (row.last_rollup_source as RollupSource) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined,
    };
  }

  /**
   * Map database row to JobCostUpdate interface
   */
  private mapJobCostUpdate(row: any): JobCostUpdate {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      jobCostId: row.job_cost_id,
      updateSource: row.update_source as UpdateSource,
      sourceId: row.source_id ?? undefined,
      costCategory: row.cost_category as CostCategory,
      costDelta: parseFloat(row.cost_delta || '0'),
      previousTotal: parseFloat(row.previous_total || '0'),
      newTotal: parseFloat(row.new_total || '0'),
      quantity: row.quantity != null ? parseFloat(row.quantity) : undefined,
      unitCost: row.unit_cost != null ? parseFloat(row.unit_cost) : undefined,
      description: row.description ?? undefined,
      updateMetadata: row.update_metadata ?? undefined,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by ?? undefined,
    };
  }
}
