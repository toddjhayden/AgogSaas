/**
 * Cost Allocation Service
 * REQ-1767541724200-2fb1a: Cost Allocation Engine for Accurate Job Profitability
 *
 * Comprehensive service for overhead allocation and cost distribution to jobs
 * Supports multiple allocation methods: Direct, Step-Down, Reciprocal, Activity-Based
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  CostPool,
  CostDriver,
  AllocationRule,
  AllocationRun,
  JobCostAllocation,
  DriverMeasurement,
  CreateCostPoolInput,
  UpdateCostPoolInput,
  CreateCostDriverInput,
  UpdateCostDriverInput,
  CreateAllocationRuleInput,
  UpdateAllocationRuleInput,
  CreateDriverMeasurementInput,
  RunAllocationInput,
  CostPoolFilters,
  CostDriverFilters,
  AllocationRuleFilters,
  AllocationRunFilters,
  JobCostAllocationFilters,
  DriverMeasurementFilters,
  CostPoolResult,
  CostPoolListResult,
  CostDriverResult,
  CostDriverListResult,
  AllocationRuleResult,
  AllocationRuleListResult,
  AllocationRunResult,
  AllocationRunListResult,
  JobCostAllocationListResult,
  DriverMeasurementResult,
  DriverMeasurementListResult,
  AllocationSummary,
  AllocationRunStatus,
  AllocationType,
} from '../interfaces/cost-allocation.interface';

@Injectable()
export class CostAllocationService {
  private readonly logger = new Logger(CostAllocationService.name);

  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  // =====================================================
  // COST POOL MANAGEMENT
  // =====================================================

  async createCostPool(
    tenantId: string,
    input: CreateCostPoolInput
  ): Promise<CostPoolResult> {
    try {
      const query = `
        INSERT INTO cost_pools (
          tenant_id, pool_code, pool_name, description, pool_type,
          cost_behavior, source_account_id, current_pool_amount,
          period_year, period_month, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const result = await this.db.query(query, [
        tenantId,
        input.poolCode,
        input.poolName,
        input.description,
        input.poolType,
        input.costBehavior,
        input.sourceAccountId,
        input.currentPoolAmount ?? 0,
        input.periodYear,
        input.periodMonth,
        input.isActive ?? true,
        input.createdBy,
      ]);

      this.logger.log(`Created cost pool: ${input.poolCode}`);

      return {
        success: true,
        costPool: this.mapCostPool(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error creating cost pool: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async updateCostPool(
    poolId: string,
    tenantId: string,
    input: UpdateCostPoolInput
  ): Promise<CostPoolResult> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.poolName !== undefined) {
        updates.push(`pool_name = $${paramIndex++}`);
        params.push(input.poolName);
      }
      if (input.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(input.description);
      }
      if (input.currentPoolAmount !== undefined) {
        updates.push(`current_pool_amount = $${paramIndex++}`);
        params.push(input.currentPoolAmount);
      }
      if (input.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(input.isActive);
      }
      if (input.updatedBy) {
        updates.push(`updated_by = $${paramIndex++}`);
        params.push(input.updatedBy);
      }

      if (updates.length === 0) {
        return {
          success: false,
          error: 'No fields to update',
        };
      }

      params.push(poolId, tenantId);
      const query = `
        UPDATE cost_pools
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await this.db.query(query, params);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Cost pool not found',
        };
      }

      this.logger.log(`Updated cost pool: ${poolId}`);

      return {
        success: true,
        costPool: this.mapCostPool(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error updating cost pool: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getCostPool(poolId: string, tenantId: string): Promise<CostPoolResult> {
    try {
      const query = `SELECT * FROM cost_pools WHERE id = $1 AND tenant_id = $2`;
      const result = await this.db.query(query, [poolId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Cost pool not found',
        };
      }

      return {
        success: true,
        costPool: this.mapCostPool(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting cost pool: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async listCostPools(
    filters: CostPoolFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<CostPoolListResult> {
    try {
      let query = `SELECT * FROM cost_pools WHERE tenant_id = $1`;
      const params: any[] = [filters.tenantId];
      let paramIndex = 2;

      if (filters.poolType) {
        query += ` AND pool_type = $${paramIndex++}`;
        params.push(filters.poolType);
      }
      if (filters.isActive !== undefined) {
        query += ` AND is_active = $${paramIndex++}`;
        params.push(filters.isActive);
      }
      if (filters.periodYear) {
        query += ` AND period_year = $${paramIndex++}`;
        params.push(filters.periodYear);
      }
      if (filters.periodMonth) {
        query += ` AND period_month = $${paramIndex++}`;
        params.push(filters.periodMonth);
      }

      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await this.db.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].total);

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);

      return {
        costPools: result.rows.map(row => this.mapCostPool(row)),
        totalCount,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing cost pools: ${errorMessage}`);
      return {
        costPools: [],
        totalCount: 0,
      };
    }
  }

  // =====================================================
  // COST DRIVER MANAGEMENT
  // =====================================================

  async createCostDriver(
    tenantId: string,
    input: CreateCostDriverInput
  ): Promise<CostDriverResult> {
    try {
      const query = `
        INSERT INTO cost_drivers (
          tenant_id, driver_code, driver_name, description, driver_type,
          unit_of_measure, calculation_method, source_table, source_column,
          source_query, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const result = await this.db.query(query, [
        tenantId,
        input.driverCode,
        input.driverName,
        input.description,
        input.driverType,
        input.unitOfMeasure,
        input.calculationMethod,
        input.sourceTable,
        input.sourceColumn,
        input.sourceQuery,
        input.isActive ?? true,
        input.createdBy,
      ]);

      this.logger.log(`Created cost driver: ${input.driverCode}`);

      return {
        success: true,
        costDriver: this.mapCostDriver(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error creating cost driver: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async updateCostDriver(
    driverId: string,
    tenantId: string,
    input: UpdateCostDriverInput
  ): Promise<CostDriverResult> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.driverName !== undefined) {
        updates.push(`driver_name = $${paramIndex++}`);
        params.push(input.driverName);
      }
      if (input.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(input.description);
      }
      if (input.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(input.isActive);
      }
      if (input.updatedBy) {
        updates.push(`updated_by = $${paramIndex++}`);
        params.push(input.updatedBy);
      }

      if (updates.length === 0) {
        return {
          success: false,
          error: 'No fields to update',
        };
      }

      params.push(driverId, tenantId);
      const query = `
        UPDATE cost_drivers
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await this.db.query(query, params);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Cost driver not found',
        };
      }

      this.logger.log(`Updated cost driver: ${driverId}`);

      return {
        success: true,
        costDriver: this.mapCostDriver(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error updating cost driver: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getCostDriver(driverId: string, tenantId: string): Promise<CostDriverResult> {
    try {
      const query = `SELECT * FROM cost_drivers WHERE id = $1 AND tenant_id = $2`;
      const result = await this.db.query(query, [driverId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Cost driver not found',
        };
      }

      return {
        success: true,
        costDriver: this.mapCostDriver(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting cost driver: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async listCostDrivers(
    filters: CostDriverFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<CostDriverListResult> {
    try {
      let query = `SELECT * FROM cost_drivers WHERE tenant_id = $1`;
      const params: any[] = [filters.tenantId];
      let paramIndex = 2;

      if (filters.driverType) {
        query += ` AND driver_type = $${paramIndex++}`;
        params.push(filters.driverType);
      }
      if (filters.isActive !== undefined) {
        query += ` AND is_active = $${paramIndex++}`;
        params.push(filters.isActive);
      }

      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await this.db.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].total);

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);

      return {
        costDrivers: result.rows.map(row => this.mapCostDriver(row)),
        totalCount,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing cost drivers: ${errorMessage}`);
      return {
        costDrivers: [],
        totalCount: 0,
      };
    }
  }

  // =====================================================
  // ALLOCATION RULE MANAGEMENT
  // =====================================================

  async createAllocationRule(
    tenantId: string,
    input: CreateAllocationRuleInput
  ): Promise<AllocationRuleResult> {
    try {
      const query = `
        INSERT INTO allocation_rules (
          tenant_id, rule_code, rule_name, description, cost_pool_id,
          cost_driver_id, allocation_method, target_type, target_cost_category,
          rate_type, predetermined_rate, allocation_filters, allocation_priority,
          effective_from, effective_to, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;

      const result = await this.db.query(query, [
        tenantId,
        input.ruleCode,
        input.ruleName,
        input.description,
        input.costPoolId,
        input.costDriverId,
        input.allocationMethod,
        input.targetType,
        input.targetCostCategory,
        input.rateType,
        input.predeterminedRate,
        input.allocationFilters ? JSON.stringify(input.allocationFilters) : null,
        input.allocationPriority ?? 0,
        input.effectiveFrom,
        input.effectiveTo,
        input.isActive ?? true,
        input.createdBy,
      ]);

      this.logger.log(`Created allocation rule: ${input.ruleCode}`);

      return {
        success: true,
        allocationRule: this.mapAllocationRule(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error creating allocation rule: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async updateAllocationRule(
    ruleId: string,
    tenantId: string,
    input: UpdateAllocationRuleInput
  ): Promise<AllocationRuleResult> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.ruleName !== undefined) {
        updates.push(`rule_name = $${paramIndex++}`);
        params.push(input.ruleName);
      }
      if (input.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(input.description);
      }
      if (input.predeterminedRate !== undefined) {
        updates.push(`predetermined_rate = $${paramIndex++}`);
        params.push(input.predeterminedRate);
      }
      if (input.allocationFilters !== undefined) {
        updates.push(`allocation_filters = $${paramIndex++}`);
        params.push(JSON.stringify(input.allocationFilters));
      }
      if (input.allocationPriority !== undefined) {
        updates.push(`allocation_priority = $${paramIndex++}`);
        params.push(input.allocationPriority);
      }
      if (input.effectiveTo !== undefined) {
        updates.push(`effective_to = $${paramIndex++}`);
        params.push(input.effectiveTo);
      }
      if (input.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(input.isActive);
      }
      if (input.updatedBy) {
        updates.push(`updated_by = $${paramIndex++}`);
        params.push(input.updatedBy);
      }

      if (updates.length === 0) {
        return {
          success: false,
          error: 'No fields to update',
        };
      }

      params.push(ruleId, tenantId);
      const query = `
        UPDATE allocation_rules
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await this.db.query(query, params);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Allocation rule not found',
        };
      }

      this.logger.log(`Updated allocation rule: ${ruleId}`);

      return {
        success: true,
        allocationRule: this.mapAllocationRule(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error updating allocation rule: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getAllocationRule(ruleId: string, tenantId: string): Promise<AllocationRuleResult> {
    try {
      const query = `SELECT * FROM allocation_rules WHERE id = $1 AND tenant_id = $2`;
      const result = await this.db.query(query, [ruleId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Allocation rule not found',
        };
      }

      return {
        success: true,
        allocationRule: this.mapAllocationRule(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting allocation rule: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async listAllocationRules(
    filters: AllocationRuleFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<AllocationRuleListResult> {
    try {
      let query = `SELECT * FROM allocation_rules WHERE tenant_id = $1`;
      const params: any[] = [filters.tenantId];
      let paramIndex = 2;

      if (filters.costPoolId) {
        query += ` AND cost_pool_id = $${paramIndex++}`;
        params.push(filters.costPoolId);
      }
      if (filters.costDriverId) {
        query += ` AND cost_driver_id = $${paramIndex++}`;
        params.push(filters.costDriverId);
      }
      if (filters.isActive !== undefined) {
        query += ` AND is_active = $${paramIndex++}`;
        params.push(filters.isActive);
      }
      if (filters.effectiveDate) {
        query += ` AND effective_from <= $${paramIndex} AND (effective_to IS NULL OR effective_to >= $${paramIndex})`;
        params.push(filters.effectiveDate);
        paramIndex++;
      }

      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await this.db.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].total);

      query += ` ORDER BY allocation_priority, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);

      return {
        allocationRules: result.rows.map(row => this.mapAllocationRule(row)),
        totalCount,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing allocation rules: ${errorMessage}`);
      return {
        allocationRules: [],
        totalCount: 0,
      };
    }
  }

  // =====================================================
  // DRIVER MEASUREMENT MANAGEMENT
  // =====================================================

  async createDriverMeasurement(
    tenantId: string,
    input: CreateDriverMeasurementInput
  ): Promise<DriverMeasurementResult> {
    try {
      const query = `
        INSERT INTO driver_measurements (
          tenant_id, job_id, cost_driver_id, period_year, period_month,
          measurement_date, measured_quantity, unit_of_measure,
          measurement_source, source_id, source_reference, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const result = await this.db.query(query, [
        tenantId,
        input.jobId,
        input.costDriverId,
        input.periodYear,
        input.periodMonth,
        input.measurementDate,
        input.measuredQuantity,
        input.unitOfMeasure,
        input.measurementSource,
        input.sourceId,
        input.sourceReference,
        input.notes,
        input.createdBy,
      ]);

      this.logger.log(`Created driver measurement for job ${input.jobId}`);

      return {
        success: true,
        driverMeasurement: this.mapDriverMeasurement(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error creating driver measurement: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async listDriverMeasurements(
    filters: DriverMeasurementFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<DriverMeasurementListResult> {
    try {
      let query = `SELECT * FROM driver_measurements WHERE tenant_id = $1`;
      const params: any[] = [filters.tenantId];
      let paramIndex = 2;

      if (filters.jobId) {
        query += ` AND job_id = $${paramIndex++}`;
        params.push(filters.jobId);
      }
      if (filters.costDriverId) {
        query += ` AND cost_driver_id = $${paramIndex++}`;
        params.push(filters.costDriverId);
      }
      if (filters.periodYear) {
        query += ` AND period_year = $${paramIndex++}`;
        params.push(filters.periodYear);
      }
      if (filters.periodMonth) {
        query += ` AND period_month = $${paramIndex++}`;
        params.push(filters.periodMonth);
      }
      if (filters.measurementSource) {
        query += ` AND measurement_source = $${paramIndex++}`;
        params.push(filters.measurementSource);
      }

      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await this.db.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].total);

      query += ` ORDER BY measurement_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);

      return {
        measurements: result.rows.map(row => this.mapDriverMeasurement(row)),
        totalCount,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing driver measurements: ${errorMessage}`);
      return {
        measurements: [],
        totalCount: 0,
      };
    }
  }

  // =====================================================
  // ALLOCATION EXECUTION
  // =====================================================

  async runAllocation(
    tenantId: string,
    input: RunAllocationInput
  ): Promise<AllocationRunResult> {
    const client = await this.db.connect();
    const startTime = Date.now();

    try {
      await client.query('BEGIN');

      // Create allocation run record
      const runNumber = `ALLOC-${input.periodYear}-${String(input.periodMonth).padStart(2, '0')}-${Date.now()}`;

      const createRunQuery = `
        INSERT INTO allocation_runs (
          tenant_id, run_number, run_description, period_year, period_month,
          allocation_type, included_pools, included_jobs, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const runResult = await client.query(createRunQuery, [
        tenantId,
        runNumber,
        input.runDescription,
        input.periodYear,
        input.periodMonth,
        input.allocationType,
        input.includedPools,
        input.includedJobs,
        AllocationRunStatus.RUNNING,
        input.createdBy,
      ]);

      const allocationRunId = runResult.rows[0].id;

      // Get active allocation rules
      const rulesQuery = `
        SELECT ar.*, cp.current_pool_amount, cd.driver_code
        FROM allocation_rules ar
        INNER JOIN cost_pools cp ON cp.id = ar.cost_pool_id
        INNER JOIN cost_drivers cd ON cd.id = ar.cost_driver_id
        WHERE ar.tenant_id = $1
          AND ar.is_active = TRUE
          AND ar.effective_from <= CURRENT_DATE
          AND (ar.effective_to IS NULL OR ar.effective_to >= CURRENT_DATE)
        ORDER BY ar.allocation_priority
      `;

      const rulesResult = await client.query(rulesQuery, [tenantId]);

      let totalPoolsProcessed = 0;
      let totalAmountAllocated = 0;
      let totalJobsAffected = 0;
      let totalAllocationsCreated = 0;

      // Process each allocation rule
      for (const rule of rulesResult.rows) {
        try {
          // Calculate allocation rate using database function
          const rateQuery = `
            SELECT calculate_allocation_rate($1, $2, $3, $4) as rate
          `;

          const rateResult = await client.query(rateQuery, [
            rule.cost_pool_id,
            rule.cost_driver_id,
            input.periodYear,
            input.periodMonth,
          ]);

          const allocationRate = parseFloat(rateResult.rows[0].rate || '0');

          // Get driver measurements for jobs in period
          const measurementsQuery = `
            SELECT dm.job_id, dm.measured_quantity,
                   SUM(dm.measured_quantity) OVER() as total_quantity
            FROM driver_measurements dm
            INNER JOIN job_costs jc ON jc.job_id = dm.job_id AND jc.tenant_id = dm.tenant_id
            WHERE dm.tenant_id = $1
              AND dm.cost_driver_id = $2
              AND dm.period_year = $3
              AND dm.period_month = $4
          `;

          const measurementsResult = await client.query(measurementsQuery, [
            tenantId,
            rule.cost_driver_id,
            input.periodYear,
            input.periodMonth,
          ]);

          // Allocate to each job
          for (const measurement of measurementsResult.rows) {
            const allocateQuery = `
              SELECT allocate_costs_to_job($1, $2, $3, $4, $5, $6)
            `;

            await client.query(allocateQuery, [
              allocationRunId,
              measurement.job_id,
              rule.id,
              parseFloat(measurement.measured_quantity),
              parseFloat(measurement.total_quantity),
              allocationRate,
            ]);

            const allocatedAmount = parseFloat(measurement.measured_quantity) * allocationRate;
            totalAmountAllocated += allocatedAmount;
            totalAllocationsCreated++;
          }

          totalJobsAffected += measurementsResult.rows.length;
          totalPoolsProcessed++;
        } catch (ruleError: unknown) {
          const ruleErrorMessage = ruleError instanceof Error ? ruleError.message : 'Unknown error';
          this.logger.warn(`Failed to process allocation rule ${rule.rule_code}: ${ruleErrorMessage}`);
          // Continue with next rule instead of failing entire run
        }
      }

      // Update allocation run with results
      const endTime = Date.now();
      const executionDuration = endTime - startTime;

      const updateRunQuery = `
        UPDATE allocation_runs
        SET status = $1,
            completed_at = NOW(),
            execution_duration_ms = $2,
            total_pools_processed = $3,
            total_amount_allocated = $4,
            total_jobs_affected = $5,
            total_allocations_created = $6
        WHERE id = $7
        RETURNING *
      `;

      const finalResult = await client.query(updateRunQuery, [
        AllocationRunStatus.COMPLETED,
        executionDuration,
        totalPoolsProcessed,
        totalAmountAllocated,
        totalJobsAffected,
        totalAllocationsCreated,
        allocationRunId,
      ]);

      await client.query('COMMIT');

      this.logger.log(
        `Allocation run ${runNumber} completed: ${totalAllocationsCreated} allocations, ` +
        `$${totalAmountAllocated.toFixed(2)} allocated to ${totalJobsAffected} jobs`
      );

      return {
        success: true,
        allocationRun: this.mapAllocationRun(finalResult.rows[0]),
      };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error running allocation: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      client.release();
    }
  }

  async getAllocationRun(runId: string, tenantId: string): Promise<AllocationRunResult> {
    try {
      const result = await this.db.query(
        `SELECT * FROM allocation_runs WHERE id = $1 AND tenant_id = $2`,
        [runId, tenantId]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Allocation run not found',
        };
      }

      return {
        success: true,
        allocationRun: this.mapAllocationRun(result.rows[0]),
      };
    } catch (error: unknown) {
      this.logger.error(`Error fetching allocation run: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch allocation run',
      };
    }
  }

  async listAllocationRuns(
    filters: AllocationRunFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<AllocationRunListResult> {
    try {
      let query = `SELECT * FROM allocation_runs WHERE tenant_id = $1`;
      const params: any[] = [filters.tenantId];
      let paramIndex = 2;

      if (filters.periodYear) {
        query += ` AND period_year = $${paramIndex++}`;
        params.push(filters.periodYear);
      }
      if (filters.periodMonth) {
        query += ` AND period_month = $${paramIndex++}`;
        params.push(filters.periodMonth);
      }
      if (filters.status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(filters.status);
      }
      if (filters.fromDate) {
        query += ` AND started_at >= $${paramIndex++}`;
        params.push(filters.fromDate);
      }
      if (filters.toDate) {
        query += ` AND started_at <= $${paramIndex++}`;
        params.push(filters.toDate);
      }

      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await this.db.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].total);

      query += ` ORDER BY started_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);

      return {
        allocationRuns: result.rows.map(row => this.mapAllocationRun(row)),
        totalCount,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing allocation runs: ${errorMessage}`);
      return {
        allocationRuns: [],
        totalCount: 0,
      };
    }
  }

  async listJobCostAllocations(
    filters: JobCostAllocationFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<JobCostAllocationListResult> {
    try {
      let query = `SELECT * FROM job_cost_allocations WHERE tenant_id = $1`;
      const params: any[] = [filters.tenantId];
      let paramIndex = 2;

      if (filters.jobId) {
        query += ` AND job_id = $${paramIndex++}`;
        params.push(filters.jobId);
      }
      if (filters.jobCostId) {
        query += ` AND job_cost_id = $${paramIndex++}`;
        params.push(filters.jobCostId);
      }
      if (filters.allocationRunId) {
        query += ` AND allocation_run_id = $${paramIndex++}`;
        params.push(filters.allocationRunId);
      }
      if (filters.costPoolId) {
        query += ` AND cost_pool_id = $${paramIndex++}`;
        params.push(filters.costPoolId);
      }

      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await this.db.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].total);

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);

      return {
        allocations: result.rows.map(row => this.mapJobCostAllocation(row)),
        totalCount,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing job cost allocations: ${errorMessage}`);
      return {
        allocations: [],
        totalCount: 0,
      };
    }
  }

  // =====================================================
  // DELETE METHODS
  // =====================================================

  async deleteCostPool(poolId: string, tenantId: string): Promise<CostPoolResult> {
    try {
      // Check if pool is referenced in allocation rules
      const checkQuery = `
        SELECT COUNT(*) as count FROM allocation_rules
        WHERE tenant_id = $1 AND cost_pool_id = $2 AND is_active = true
      `;
      const checkResult = await this.db.query(checkQuery, [tenantId, poolId]);

      if (parseInt(checkResult.rows[0].count) > 0) {
        return {
          success: false,
          error: 'Cannot delete cost pool: it is referenced by active allocation rules',
        };
      }

      const query = `
        UPDATE cost_pools
        SET is_active = false, updated_at = NOW(), updated_by = 'SYSTEM'
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `;

      const result = await this.db.query(query, [poolId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Cost pool not found',
        };
      }

      this.logger.log(`Deleted cost pool ${poolId}`);
      return {
        success: true,
        costPool: this.mapCostPool(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error deleting cost pool: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async deleteCostDriver(driverId: string, tenantId: string): Promise<CostDriverResult> {
    try {
      // Check if driver is referenced in allocation rules
      const checkQuery = `
        SELECT COUNT(*) as count FROM allocation_rules
        WHERE tenant_id = $1 AND cost_driver_id = $2 AND is_active = true
      `;
      const checkResult = await this.db.query(checkQuery, [tenantId, driverId]);

      if (parseInt(checkResult.rows[0].count) > 0) {
        return {
          success: false,
          error: 'Cannot delete cost driver: it is referenced by active allocation rules',
        };
      }

      const query = `
        UPDATE cost_drivers
        SET is_active = false, updated_at = NOW(), updated_by = 'SYSTEM'
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `;

      const result = await this.db.query(query, [driverId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Cost driver not found',
        };
      }

      this.logger.log(`Deleted cost driver ${driverId}`);
      return {
        success: true,
        costDriver: this.mapCostDriver(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error deleting cost driver: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async deleteAllocationRule(ruleId: string, tenantId: string): Promise<AllocationRuleResult> {
    try {
      const query = `
        UPDATE allocation_rules
        SET is_active = false, effective_to = NOW(), updated_at = NOW(), updated_by = 'SYSTEM'
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `;

      const result = await this.db.query(query, [ruleId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Allocation rule not found',
        };
      }

      this.logger.log(`Deleted allocation rule ${ruleId}`);
      return {
        success: true,
        allocationRule: this.mapAllocationRule(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error deleting allocation rule: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // =====================================================
  // ADDITIONAL QUERY METHODS
  // =====================================================

  async getDriverMeasurement(measurementId: string, tenantId: string): Promise<DriverMeasurementResult> {
    try {
      const query = `
        SELECT * FROM driver_measurements
        WHERE id = $1 AND tenant_id = $2
      `;

      const result = await this.db.query(query, [measurementId, tenantId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Driver measurement not found',
        };
      }

      return {
        success: true,
        driverMeasurement: this.mapDriverMeasurement(result.rows[0]),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting driver measurement: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getAllocationSummary(
    tenantId: string,
    jobId: string,
    periodYear: number,
    periodMonth: number
  ): Promise<AllocationSummary | null> {
    try {
      const query = `
        SELECT
          jc.job_id,
          jc.period_year,
          jc.period_month,
          COUNT(DISTINCT jca.allocation_run_id) as total_runs,
          COUNT(DISTINCT jca.cost_pool_id) as pools_allocated,
          SUM(jca.allocated_amount) as total_allocated,
          MIN(jca.created_at) as first_allocation,
          MAX(jca.created_at) as last_allocation
        FROM job_cost_allocations jca
        JOIN jobs jc ON jc.id = jca.job_id AND jc.tenant_id = jca.tenant_id
        WHERE jca.tenant_id = $1
          AND jca.job_id = $2
          AND jc.period_year = $3
          AND jc.period_month = $4
        GROUP BY jc.job_id, jc.period_year, jc.period_month
      `;

      const result = await this.db.query(query, [tenantId, jobId, periodYear, periodMonth]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        jobId: row.job_id,
        jobCostId: row.job_cost_id,
        allocationMonth: new Date(periodYear, periodMonth - 1, 1),
        totalAllocationRuns: parseInt(row.total_runs || '0'),
        totalPoolsAllocated: parseInt(row.pools_allocated || '0'),
        totalAllocatedAmount: parseFloat(row.total_allocated || '0'),
        overheadAllocated: parseFloat(row.overhead_allocated || '0'),
        equipmentAllocated: parseFloat(row.equipment_allocated || '0'),
        otherAllocated: parseFloat(row.other_allocated || '0'),
        lastAllocationDate: row.last_allocation ? new Date(row.last_allocation) : new Date(),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting allocation summary: ${errorMessage}`);
      return null;
    }
  }

  async reverseAllocationRun(runId: string, userId: string, tenantId: string): Promise<AllocationRunResult> {
    try {
      // Start transaction
      const client = await this.db.connect();

      try {
        await client.query('BEGIN');

        // Check if run exists and is not already reversed
        const checkQuery = `
          SELECT * FROM allocation_runs
          WHERE id = $1 AND tenant_id = $2 AND is_reversed = false
        `;
        const checkResult = await client.query(checkQuery, [runId, tenantId]);

        if (checkResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return {
            success: false,
            error: 'Allocation run not found or already reversed',
          };
        }

        // Delete all allocations from this run
        await client.query(
          'DELETE FROM job_cost_allocations WHERE allocation_run_id = $1 AND tenant_id = $2',
          [runId, tenantId]
        );

        // Mark run as reversed
        const updateQuery = `
          UPDATE allocation_runs
          SET is_reversed = true, reversed_at = NOW(), reversed_by = $1
          WHERE id = $2 AND tenant_id = $3
          RETURNING *
        `;
        const updateResult = await client.query(updateQuery, [userId, runId, tenantId]);

        await client.query('COMMIT');

        this.logger.log(`Reversed allocation run ${runId}`);
        return {
          success: true,
          allocationRun: this.mapAllocationRun(updateResult.rows[0]),
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error reversing allocation run: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private mapCostPool(row: any): CostPool {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      poolCode: row.pool_code,
      poolName: row.pool_name,
      description: row.description ?? undefined,
      poolType: row.pool_type,
      costBehavior: row.cost_behavior,
      sourceAccountId: row.source_account_id ?? undefined,
      currentPoolAmount: parseFloat(row.current_pool_amount || '0'),
      periodYear: row.period_year ?? undefined,
      periodMonth: row.period_month ?? undefined,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      createdBy: row.created_by ?? undefined,
      updatedAt: new Date(row.updated_at),
      updatedBy: row.updated_by ?? undefined,
    };
  }

  private mapCostDriver(row: any): CostDriver {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      driverCode: row.driver_code,
      driverName: row.driver_name,
      description: row.description ?? undefined,
      driverType: row.driver_type,
      unitOfMeasure: row.unit_of_measure,
      calculationMethod: row.calculation_method,
      sourceTable: row.source_table ?? undefined,
      sourceColumn: row.source_column ?? undefined,
      sourceQuery: row.source_query ?? undefined,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      createdBy: row.created_by ?? undefined,
      updatedAt: new Date(row.updated_at),
      updatedBy: row.updated_by ?? undefined,
    };
  }

  private mapAllocationRule(row: any): AllocationRule {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ruleCode: row.rule_code,
      ruleName: row.rule_name,
      description: row.description ?? undefined,
      costPoolId: row.cost_pool_id,
      costDriverId: row.cost_driver_id,
      allocationMethod: row.allocation_method,
      targetType: row.target_type,
      targetCostCategory: row.target_cost_category,
      rateType: row.rate_type,
      predeterminedRate: row.predetermined_rate != null ? parseFloat(row.predetermined_rate) : undefined,
      allocationFilters: row.allocation_filters ?? undefined,
      allocationPriority: row.allocation_priority || 0,
      effectiveFrom: new Date(row.effective_from),
      effectiveTo: row.effective_to ? new Date(row.effective_to) : undefined,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      createdBy: row.created_by ?? undefined,
      updatedAt: new Date(row.updated_at),
      updatedBy: row.updated_by ?? undefined,
    };
  }

  private mapAllocationRun(row: any): AllocationRun {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      runNumber: row.run_number,
      runDescription: row.run_description ?? undefined,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      allocationType: row.allocation_type,
      includedPools: row.included_pools ?? undefined,
      includedJobs: row.included_jobs ?? undefined,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      executionDurationMs: row.execution_duration_ms != null ? parseInt(row.execution_duration_ms) : undefined,
      status: row.status,
      totalPoolsProcessed: row.total_pools_processed || 0,
      totalAmountAllocated: parseFloat(row.total_amount_allocated || '0'),
      totalJobsAffected: row.total_jobs_affected || 0,
      totalAllocationsCreated: row.total_allocations_created || 0,
      errorMessage: row.error_message ?? undefined,
      errorDetails: row.error_details ?? undefined,
      isReversed: Boolean(row.is_reversed),
      reversedAt: row.reversed_at ? new Date(row.reversed_at) : undefined,
      reversedBy: row.reversed_by ?? undefined,
      reversalRunId: row.reversal_run_id ?? undefined,
      createdBy: row.created_by ?? undefined,
    };
  }

  private mapJobCostAllocation(row: any): JobCostAllocation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      allocationRunId: row.allocation_run_id,
      jobCostId: row.job_cost_id,
      jobId: row.job_id,
      costPoolId: row.cost_pool_id,
      allocationRuleId: row.allocation_rule_id,
      costDriverId: row.cost_driver_id,
      driverQuantity: parseFloat(row.driver_quantity || '0'),
      totalDriverQuantity: parseFloat(row.total_driver_quantity || '0'),
      allocationRate: parseFloat(row.allocation_rate || '0'),
      allocationPercentage: row.allocation_percentage != null ? parseFloat(row.allocation_percentage) : undefined,
      allocatedAmount: parseFloat(row.allocated_amount || '0'),
      costCategory: row.cost_category,
      allocationMetadata: row.allocation_metadata ?? undefined,
      createdAt: new Date(row.created_at),
    };
  }

  private mapDriverMeasurement(row: any): DriverMeasurement {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      jobId: row.job_id,
      costDriverId: row.cost_driver_id,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      measurementDate: new Date(row.measurement_date),
      measuredQuantity: parseFloat(row.measured_quantity || '0'),
      unitOfMeasure: row.unit_of_measure,
      measurementSource: row.measurement_source,
      sourceId: row.source_id ?? undefined,
      sourceReference: row.source_reference ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by ?? undefined,
      updatedAt: new Date(row.updated_at),
      updatedBy: row.updated_by ?? undefined,
    };
  }
}
