import { Resolver, Query, Mutation, Args, Context, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Operations GraphQL Resolver
 *
 * Handles queries and mutations for production operations:
 * - Work Centers (manufacturing equipment)
 * - Production Orders
 * - Operations (operation types)
 * - Production Runs (actual execution)
 * - OEE Calculations
 * - Maintenance Records
 * - Production Scheduling
 */

@Resolver('Operations')
export class OperationsResolver {
  constructor(private readonly db: Pool) {}

  // =====================================================
  // WORK CENTER QUERIES
  // =====================================================

  @Query('workCenter')
  async getWorkCenter(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const result = await this.db.query(
      `SELECT * FROM work_centers WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Work center ${id} not found`);
    }

    return this.mapWorkCenterRow(result.rows[0]);
  }

  @Query('workCenters')
  async getWorkCenters(
    @Args('facilityId') facilityId: string,
    @Args('status') status: string | null,
    @Context() context: any
  ) {
    let query = `SELECT * FROM work_centers WHERE facility_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [facilityId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY work_center_code`;

    const result = await this.db.query(query, params);
    return result.rows.map(this.mapWorkCenterRow);
  }

  // =====================================================
  // PRODUCTION ORDER QUERIES
  // =====================================================

  @Query('productionOrder')
  async getProductionOrder(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const result = await this.db.query(
      `SELECT * FROM production_orders WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Production order ${id} not found`);
    }

    return this.mapProductionOrderRow(result.rows[0]);
  }

  @Query('productionOrders')
  async getProductionOrders(
    @Args('facilityId') facilityId: string,
    @Args('status') status: string | null,
    @Args('dueAfter') dueAfter: string | null,
    @Args('dueBefore') dueBefore: string | null,
    @Args('limit') limit: number = 50,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `facility_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [facilityId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (dueAfter) {
      whereClause += ` AND due_date >= $${paramIndex++}`;
      params.push(dueAfter);
    }

    if (dueBefore) {
      whereClause += ` AND due_date <= $${paramIndex++}`;
      params.push(dueBefore);
    }

    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM production_orders WHERE ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get page of orders
    const result = await this.db.query(
      `SELECT * FROM production_orders
       WHERE ${whereClause}
       ORDER BY due_date, priority
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const edges = result.rows.map((row, index) => ({
      node: this.mapProductionOrderRow(row),
      cursor: Buffer.from(`${offset + index}`).toString('base64')
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: (offset + limit) < totalCount,
        hasPreviousPage: offset > 0,
        startCursor: edges.length > 0 ? edges[0].cursor : null,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
      },
      totalCount
    };
  }

  // =====================================================
  // PRODUCTION RUN QUERIES
  // =====================================================

  @Query('productionRun')
  async getProductionRun(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const result = await this.db.query(
      `SELECT * FROM production_runs WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Production run ${id} not found`);
    }

    return this.mapProductionRunRow(result.rows[0]);
  }

  @Query('productionRuns')
  async getProductionRuns(
    @Args('facilityId') facilityId: string | null,
    @Args('workCenterId') workCenterId: string | null,
    @Args('status') status: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `deleted_at IS NULL`;
    const params: any[] = [];
    let paramIndex = 1;

    if (facilityId) {
      whereClause += ` AND facility_id = $${paramIndex++}`;
      params.push(facilityId);
    }

    if (workCenterId) {
      whereClause += ` AND work_center_id = $${paramIndex++}`;
      params.push(workCenterId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (startDate) {
      whereClause += ` AND run_start_time >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND run_start_time <= $${paramIndex++}`;
      params.push(endDate);
    }

    const result = await this.db.query(
      `SELECT * FROM production_runs
       WHERE ${whereClause}
       ORDER BY run_start_time DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return result.rows.map(this.mapProductionRunRow);
  }

  // =====================================================
  // OPERATION QUERIES
  // =====================================================

  @Query('operation')
  async getOperation(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const result = await this.db.query(
      `SELECT * FROM operations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Operation ${id} not found`);
    }

    return this.mapOperationRow(result.rows[0]);
  }

  @Query('operations')
  async getOperations(
    @Args('tenantId') tenantId: string,
    @Args('type') type: string | null,
    @Context() context: any
  ) {
    let query = `SELECT * FROM operations WHERE tenant_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [tenantId];

    if (type) {
      query += ` AND operation_type = $2`;
      params.push(type);
    }

    query += ` ORDER BY operation_code`;

    const result = await this.db.query(query, params);
    return result.rows.map(this.mapOperationRow);
  }

  // =====================================================
  // OEE CALCULATIONS QUERIES
  // =====================================================

  @Query('oeeCalculations')
  async getOEECalculations(
    @Args('workCenterId') workCenterId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Context() context: any
  ) {
    const result = await this.db.query(
      `SELECT * FROM oee_calculations
       WHERE work_center_id = $1
       AND calculation_date >= $2
       AND calculation_date <= $3
       ORDER BY calculation_date, shift_number`,
      [workCenterId, startDate, endDate]
    );

    return result.rows.map(this.mapOEECalculationRow);
  }

  // =====================================================
  // PRODUCTION SCHEDULE QUERIES
  // =====================================================

  @Query('productionSchedule')
  async getProductionSchedule(
    @Args('workCenterId') workCenterId: string | null,
    @Args('facilityId') facilityId: string | null,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Context() context: any
  ) {
    let whereClause = `schedule_date >= $1 AND schedule_date <= $2`;
    const params: any[] = [startDate, endDate];
    let paramIndex = 3;

    if (workCenterId) {
      whereClause += ` AND work_center_id = $${paramIndex++}`;
      params.push(workCenterId);
    }

    if (facilityId) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM work_centers wc
        WHERE wc.id = production_schedules.work_center_id
        AND wc.facility_id = $${paramIndex++}
      )`;
      params.push(facilityId);
    }

    const result = await this.db.query(
      `SELECT * FROM production_schedules
       WHERE ${whereClause}
       ORDER BY scheduled_start_time`,
      params
    );

    return result.rows.map(this.mapProductionScheduleRow);
  }

  // =====================================================
  // MAINTENANCE RECORDS QUERIES
  // =====================================================

  @Query('maintenanceRecords')
  async getMaintenanceRecords(
    @Args('workCenterId') workCenterId: string,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Args('type') type: string | null,
    @Context() context: any
  ) {
    let whereClause = `work_center_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [workCenterId];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND maintenance_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND maintenance_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    if (type) {
      whereClause += ` AND maintenance_type = $${paramIndex++}`;
      params.push(type);
    }

    const result = await this.db.query(
      `SELECT * FROM maintenance_records
       WHERE ${whereClause}
       ORDER BY maintenance_date DESC`,
      params
    );

    return result.rows.map(this.mapMaintenanceRecordRow);
  }

  // =====================================================
  // CAPACITY PLANNING QUERIES
  // =====================================================

  @Query('capacityPlanning')
  async getCapacityPlanning(
    @Args('facilityId') facilityId: string | null,
    @Args('workCenterId') workCenterId: string | null,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Context() context: any
  ) {
    let whereClause = `start_date >= $1 AND end_date <= $2 AND deleted_at IS NULL`;
    const params: any[] = [startDate, endDate];
    let paramIndex = 3;

    if (facilityId) {
      whereClause += ` AND facility_id = $${paramIndex++}`;
      params.push(facilityId);
    }

    if (workCenterId) {
      whereClause += ` AND work_center_id = $${paramIndex++}`;
      params.push(workCenterId);
    }

    const result = await this.db.query(
      `SELECT * FROM capacity_planning
       WHERE ${whereClause}
       ORDER BY start_date`,
      params
    );

    return result.rows.map(this.mapCapacityPlanningRow);
  }

  // =====================================================
  // MUTATIONS - WORK CENTER
  // =====================================================

  @Mutation('createWorkCenter')
  async createWorkCenter(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO work_centers (
        tenant_id, facility_id, work_center_code, work_center_name,
        work_center_type, manufacturer, model, serial_number,
        production_rate_per_hour, hourly_rate, setup_cost, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        tenantId,
        input.facilityId,
        input.workCenterCode,
        input.workCenterName,
        input.workCenterType,
        input.manufacturer,
        input.model,
        input.serialNumber,
        input.productionRatePerHour,
        input.hourlyRate,
        input.setupCost,
        userId
      ]
    );

    return this.mapWorkCenterRow(result.rows[0]);
  }

  @Mutation('updateWorkCenter')
  async updateWorkCenter(
    @Args('id') id: string,
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.workCenterName !== undefined) {
      updates.push(`work_center_name = $${paramIndex++}`);
      values.push(input.workCenterName);
    }

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }

    if (input.productionRatePerHour !== undefined) {
      updates.push(`production_rate_per_hour = $${paramIndex++}`);
      values.push(input.productionRatePerHour);
    }

    if (input.hourlyRate !== undefined) {
      updates.push(`hourly_rate = $${paramIndex++}`);
      values.push(input.hourlyRate);
    }

    if (input.lastMaintenanceDate !== undefined) {
      updates.push(`last_maintenance_date = $${paramIndex++}`);
      values.push(input.lastMaintenanceDate);
    }

    if (input.nextMaintenanceDate !== undefined) {
      updates.push(`next_maintenance_date = $${paramIndex++}`);
      values.push(input.nextMaintenanceDate);
    }

    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.isActive);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);
    values.push(id);

    const result = await this.db.query(
      `UPDATE work_centers SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Work center ${id} not found`);
    }

    return this.mapWorkCenterRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - PRODUCTION ORDER
  // =====================================================

  @Mutation('createProductionOrder')
  async createProductionOrder(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO production_orders (
        tenant_id, facility_id, production_order_number, sales_order_id,
        sales_order_line_id, product_id, quantity_ordered, unit_of_measure,
        manufacturing_strategy, priority, due_date, special_instructions,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        tenantId,
        input.facilityId,
        input.productionOrderNumber,
        input.salesOrderId,
        input.salesOrderLineId,
        input.productId,
        input.quantityOrdered,
        input.unitOfMeasure,
        input.manufacturingStrategy,
        input.priority || 5,
        input.dueDate,
        input.specialInstructions,
        userId
      ]
    );

    return this.mapProductionOrderRow(result.rows[0]);
  }

  @Mutation('updateProductionOrder')
  async updateProductionOrder(
    @Args('id') id: string,
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.quantityOrdered !== undefined) {
      updates.push(`quantity_ordered = $${paramIndex++}`);
      values.push(input.quantityOrdered);
    }

    if (input.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(input.priority);
    }

    if (input.dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(input.dueDate);
    }

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }

    if (input.plannedStartDate !== undefined) {
      updates.push(`planned_start_date = $${paramIndex++}`);
      values.push(input.plannedStartDate);
    }

    if (input.plannedCompletionDate !== undefined) {
      updates.push(`planned_completion_date = $${paramIndex++}`);
      values.push(input.plannedCompletionDate);
    }

    if (input.specialInstructions !== undefined) {
      updates.push(`special_instructions = $${paramIndex++}`);
      values.push(input.specialInstructions);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);
    values.push(id);

    const result = await this.db.query(
      `UPDATE production_orders SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Production order ${id} not found`);
    }

    return this.mapProductionOrderRow(result.rows[0]);
  }

  @Mutation('releaseProductionOrder')
  async releaseProductionOrder(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE production_orders
       SET status = 'RELEASED',
           actual_start_date = NOW(),
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Production order ${id} not found`);
    }

    return this.mapProductionOrderRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - PRODUCTION RUN
  // =====================================================

  @Mutation('createProductionRun')
  async createProductionRun(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    // Generate production run number
    const runNumber = `RUN-${Date.now()}`;

    // Get facility_id from production order
    const poResult = await this.db.query(
      `SELECT facility_id FROM production_orders WHERE id = $1`,
      [input.productionOrderId]
    );

    if (poResult.rows.length === 0) {
      throw new Error(`Production order ${input.productionOrderId} not found`);
    }

    const result = await this.db.query(
      `INSERT INTO production_runs (
        tenant_id, facility_id, production_run_number, production_order_id,
        work_center_id, operation_id, target_quantity, unit_of_measure,
        operator_user_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        tenantId,
        poResult.rows[0].facility_id,
        runNumber,
        input.productionOrderId,
        input.workCenterId,
        input.operationId,
        input.targetQuantity,
        input.unitOfMeasure,
        input.operatorUserId,
        userId
      ]
    );

    return this.mapProductionRunRow(result.rows[0]);
  }

  @Mutation('startProductionRun')
  async startProductionRun(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE production_runs
       SET status = 'RUNNING',
           run_start_time = NOW(),
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Production run ${id} not found`);
    }

    return this.mapProductionRunRow(result.rows[0]);
  }

  @Mutation('completeProductionRun')
  async completeProductionRun(
    @Args('id') id: string,
    @Args('goodQuantity') goodQuantity: number,
    @Args('scrapQuantity') scrapQuantity: number,
    @Args('notes') notes: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE production_runs
       SET status = 'COMPLETED',
           run_end_time = NOW(),
           good_quantity = $1,
           scrap_quantity = $2,
           notes = $3,
           updated_at = NOW(),
           updated_by = $4
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING *`,
      [goodQuantity, scrapQuantity, notes, userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Production run ${id} not found`);
    }

    return this.mapProductionRunRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - OPERATION
  // =====================================================

  @Mutation('createOperation')
  async createOperation(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO operations (
        tenant_id, operation_code, operation_name, operation_type,
        default_work_center_id, setup_time_minutes, run_time_per_unit_seconds,
        setup_cost, cost_per_unit, description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        tenantId,
        input.operationCode,
        input.operationName,
        input.operationType,
        input.defaultWorkCenterId,
        input.setupTimeMinutes,
        input.runTimePerUnitSeconds,
        input.setupCost,
        input.costPerUnit,
        input.description,
        userId
      ]
    );

    return this.mapOperationRow(result.rows[0]);
  }

  @Mutation('updateOperation')
  async updateOperation(
    @Args('id') id: string,
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.operationName !== undefined) {
      updates.push(`operation_name = $${paramIndex++}`);
      values.push(input.operationName);
    }

    if (input.defaultWorkCenterId !== undefined) {
      updates.push(`default_work_center_id = $${paramIndex++}`);
      values.push(input.defaultWorkCenterId);
    }

    if (input.setupTimeMinutes !== undefined) {
      updates.push(`setup_time_minutes = $${paramIndex++}`);
      values.push(input.setupTimeMinutes);
    }

    if (input.runTimePerUnitSeconds !== undefined) {
      updates.push(`run_time_per_unit_seconds = $${paramIndex++}`);
      values.push(input.runTimePerUnitSeconds);
    }

    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.isActive);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);
    values.push(id);

    const result = await this.db.query(
      `UPDATE operations SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Operation ${id} not found`);
    }

    return this.mapOperationRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - OTHER
  // =====================================================

  @Mutation('logEquipmentStatus')
  async logEquipmentStatus(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO equipment_status_log (
        tenant_id, work_center_id, status, status_start_time,
        reason, notes, created_by
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6)
      RETURNING *`,
      [
        tenantId,
        input.workCenterId,
        input.status,
        input.reason,
        input.notes,
        userId
      ]
    );

    return this.mapEquipmentStatusLogRow(result.rows[0]);
  }

  @Mutation('createMaintenanceRecord')
  async createMaintenanceRecord(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO maintenance_records (
        tenant_id, work_center_id, maintenance_type, maintenance_date,
        scheduled_date, description, technician_name, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        tenantId,
        input.workCenterId,
        input.maintenanceType,
        input.maintenanceDate,
        input.scheduledDate,
        input.description,
        input.technicianName,
        userId
      ]
    );

    return this.mapMaintenanceRecordRow(result.rows[0]);
  }

  @Mutation('calculateOEE')
  async calculateOEE(
    @Args('workCenterId') workCenterId: string,
    @Args('calculationDate') calculationDate: string,
    @Args('shiftNumber') shiftNumber: number | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    // TODO: Implement actual OEE calculation logic
    // This is a placeholder that calculates basic OEE from production runs

    const result = await this.db.query(
      `SELECT
        COALESCE(SUM(good_quantity), 0) as total_good,
        COALESCE(SUM(scrap_quantity), 0) as total_scrap,
        COALESCE(SUM(actual_run_minutes), 0) as total_runtime
       FROM production_runs
       WHERE work_center_id = $1
       AND DATE(run_start_time) = $2
       AND deleted_at IS NULL`,
      [workCenterId, calculationDate]
    );

    const data = result.rows[0];
    const totalPieces = parseFloat(data.total_good) + parseFloat(data.total_scrap);
    const goodPieces = parseFloat(data.total_good);

    // Simple OEE calculation (placeholder)
    const availabilityPercent = 85.0;
    const performancePercent = 90.0;
    const qualityPercent = totalPieces > 0 ? (goodPieces / totalPieces) * 100 : 0;
    const oeePercent = (availabilityPercent * performancePercent * qualityPercent) / 10000;

    const insertResult = await this.db.query(
      `INSERT INTO oee_calculations (
        tenant_id, work_center_id, calculation_date, shift_number,
        availability_percent, performance_percent, quality_percent, oee_percent,
        planned_production_time, downtime, operating_time,
        total_pieces, good_pieces, reject_pieces,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        tenantId,
        workCenterId,
        calculationDate,
        shiftNumber,
        availabilityPercent,
        performancePercent,
        qualityPercent,
        oeePercent,
        480, // 8 hours = 480 minutes
        72,  // placeholder
        408, // placeholder
        totalPieces,
        goodPieces,
        totalPieces - goodPieces,
        userId
      ]
    );

    return this.mapOEECalculationRow(insertResult.rows[0]);
  }

  // =====================================================
  // MAPPERS
  // =====================================================

  private mapWorkCenterRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      workCenterCode: row.work_center_code,
      workCenterName: row.work_center_name,
      workCenterType: row.work_center_type,
      manufacturer: row.manufacturer,
      model: row.model,
      serialNumber: row.serial_number,
      assetTag: row.asset_tag,
      sheetWidthMax: row.sheet_width_max,
      sheetHeightMax: row.sheet_height_max,
      sheetWidthMin: row.sheet_width_min,
      sheetHeightMin: row.sheet_height_min,
      dimensionUnit: row.dimension_unit,
      gripperMargin: row.gripper_margin,
      sideMargins: row.side_margins,
      maxColors: row.max_colors,
      productionRatePerHour: row.production_rate_per_hour,
      productionUnit: row.production_unit,
      hourlyRate: row.hourly_rate,
      setupCost: row.setup_cost,
      costPerUnit: row.cost_per_unit,
      lastMaintenanceDate: row.last_maintenance_date,
      nextMaintenanceDate: row.next_maintenance_date,
      maintenanceIntervalDays: row.maintenance_interval_days,
      status: row.status,
      isActive: row.is_active,
      operatingCalendar: row.operating_calendar,
      capabilities: row.capabilities,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapProductionOrderRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      productionOrderNumber: row.production_order_number,
      salesOrderId: row.sales_order_id,
      salesOrderLineId: row.sales_order_line_id,
      productId: row.product_id,
      productCode: row.product_code,
      productDescription: row.product_description,
      quantityOrdered: row.quantity_ordered,
      quantityCompleted: row.quantity_completed,
      quantityScrap: row.quantity_scrapped,
      unitOfMeasure: row.unit_of_measure,
      manufacturingStrategy: row.manufacturing_strategy,
      priority: row.priority,
      dueDate: row.due_date,
      plannedStartDate: row.planned_start_date,
      plannedCompletionDate: row.planned_completion_date,
      actualStartDate: row.actual_start_date,
      actualCompletionDate: row.actual_completion_date,
      status: row.status,
      routingId: row.routing_id,
      estimatedMaterialCost: row.estimated_material_cost,
      estimatedLaborCost: row.estimated_labor_cost,
      estimatedOverheadCost: row.estimated_overhead_cost,
      actualMaterialCost: row.actual_material_cost,
      actualLaborCost: row.actual_labor_cost,
      actualOverheadCost: row.actual_overhead_cost,
      specialInstructions: row.special_instructions,
      qualityRequirements: row.quality_requirements,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapProductionRunRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      productionRunNumber: row.production_run_number,
      productionOrderId: row.production_order_id,
      workCenterId: row.work_center_id,
      operationId: row.operation_id,
      operatorUserId: row.operator_user_id,
      operatorName: row.operator_name,
      setupStartTime: row.setup_start_time,
      setupEndTime: row.setup_end_time,
      runStartTime: row.run_start_time,
      runEndTime: row.run_end_time,
      targetQuantity: row.target_quantity,
      goodQuantity: row.good_quantity,
      scrapQuantity: row.scrap_quantity,
      unitOfMeasure: row.unit_of_measure,
      actualSetupMinutes: row.actual_setup_minutes,
      actualRunMinutes: row.actual_run_minutes,
      downtime: row.downtime_minutes,
      downtimeReason: row.downtime_reason,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapOperationRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      operationCode: row.operation_code,
      operationName: row.operation_name,
      operationType: row.operation_type,
      defaultWorkCenterId: row.default_work_center_id,
      setupTimeMinutes: row.setup_time_minutes,
      runTimePerUnitSeconds: row.run_time_per_unit_seconds,
      setupCost: row.setup_cost,
      costPerUnit: row.cost_per_unit,
      inspectionRequired: row.inspection_required,
      inspectionTemplateId: row.inspection_template_id,
      description: row.description,
      workInstructions: row.work_instructions,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapOEECalculationRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      workCenterId: row.work_center_id,
      calculationDate: row.calculation_date,
      shiftNumber: row.shift_number,
      availabilityPercent: row.availability_percent,
      performancePercent: row.performance_percent,
      qualityPercent: row.quality_percent,
      oeePercent: row.oee_percent,
      plannedProductionTime: row.planned_production_time,
      downtime: row.downtime,
      operatingTime: row.operating_time,
      idealCycleTime: row.ideal_cycle_time,
      totalPieces: row.total_pieces,
      goodPieces: row.good_pieces,
      rejectPieces: row.reject_pieces,
      availabilityLoss: row.availability_loss,
      performanceLoss: row.performance_loss,
      qualityLoss: row.quality_loss,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by
    };
  }

  private mapProductionScheduleRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      scheduleDate: row.schedule_date,
      shiftNumber: row.shift_number,
      workCenterId: row.work_center_id,
      productionOrderId: row.production_order_id,
      operationId: row.operation_id,
      scheduledStartTime: row.scheduled_start_time,
      scheduledEndTime: row.scheduled_end_time,
      durationMinutes: row.duration_minutes,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapMaintenanceRecordRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      workCenterId: row.work_center_id,
      maintenanceType: row.maintenance_type,
      maintenanceDate: row.maintenance_date,
      scheduledDate: row.scheduled_date,
      completedDate: row.completed_date,
      downtime: row.downtime_minutes,
      description: row.description,
      workPerformed: row.work_performed,
      partsReplaced: row.parts_replaced,
      costLabor: row.cost_labor,
      costParts: row.cost_parts,
      technicianName: row.technician_name,
      technicianUserId: row.technician_user_id,
      nextMaintenanceDate: row.next_maintenance_date,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapEquipmentStatusLogRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      workCenterId: row.work_center_id,
      status: row.status,
      statusStartTime: row.status_start_time,
      statusEndTime: row.status_end_time,
      durationMinutes: row.duration_minutes,
      reason: row.reason,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by
    };
  }

  private mapCapacityPlanningRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      planName: row.plan_name,
      planType: row.plan_type,
      startDate: row.start_date,
      endDate: row.end_date,
      workCenterId: row.work_center_id,
      facilityId: row.facility_id,
      totalCapacityHours: row.total_capacity_hours,
      utilizationPercent: row.utilization_percent,
      demandForecast: row.demand_forecast,
      capacityBreakdown: row.capacity_breakdown,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }
}
