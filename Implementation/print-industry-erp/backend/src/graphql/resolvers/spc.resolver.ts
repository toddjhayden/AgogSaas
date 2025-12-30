/**
 * SPC GraphQL Resolver
 *
 * Handles GraphQL queries and mutations for Statistical Process Control
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328664 - Quality Management & SPC
 * Created: 2025-12-29
 */

import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
@Resolver()
export class SPCResolver {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /**
   * Query: Get control chart data for a parameter
   */
  @Query('spcControlChartData')
  async getSPCControlChartData(
    @Args('filter') filter: any,
  ): Promise<any[]> {
    const {
      tenantId,
      facilityId,
      parameterCode,
      chartType,
      startDate,
      endDate,
      productionRunId,
      workCenterId,
      measurementQuality,
      limit = 1000,
    } = filter;

    let query = `
      SELECT *
      FROM spc_control_chart_data
      WHERE tenant_id = $1
        AND parameter_code = $2
    `;

    const params: any[] = [tenantId, parameterCode];
    let paramCount = 2;

    if (facilityId) {
      query += ` AND facility_id = $${++paramCount}`;
      params.push(facilityId);
    }

    if (chartType) {
      query += ` AND chart_type = $${++paramCount}`;
      params.push(chartType);
    }

    if (startDate) {
      query += ` AND measurement_timestamp >= $${++paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND measurement_timestamp <= $${++paramCount}`;
      params.push(endDate);
    }

    if (productionRunId) {
      query += ` AND production_run_id = $${++paramCount}`;
      params.push(productionRunId);
    }

    if (workCenterId) {
      query += ` AND work_center_id = $${++paramCount}`;
      params.push(workCenterId);
    }

    if (measurementQuality) {
      query += ` AND measurement_quality = $${++paramCount}`;
      params.push(measurementQuality);
    }

    query += `
      ORDER BY measurement_timestamp DESC
      LIMIT $${++paramCount}
    `;
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Query: Get control limits for a parameter
   */
  @Query('spcControlLimits')
  async getSPCControlLimits(
    @Args('tenantId') tenantId: string,
    @Args('parameterCode') parameterCode: string,
    @Args('productId') productId?: string,
    @Args('workCenterId') workCenterId?: string,
    @Args('asOfDate') asOfDate?: string,
  ): Promise<any> {
    let query = `
      SELECT *
      FROM spc_control_limits
      WHERE tenant_id = $1
        AND parameter_code = $2
        AND is_active = true
    `;

    const params: any[] = [tenantId, parameterCode];
    let paramCount = 2;

    if (productId) {
      query += ` AND product_id = $${++paramCount}`;
      params.push(productId);
    }

    if (workCenterId) {
      query += ` AND work_center_id = $${++paramCount}`;
      params.push(workCenterId);
    }

    if (asOfDate) {
      query += `
        AND effective_from <= $${++paramCount}
        AND (effective_to IS NULL OR effective_to >= $${paramCount})
      `;
      params.push(asOfDate);
    } else {
      query += ` AND effective_to IS NULL`;
    }

    query += ` ORDER BY effective_from DESC LIMIT 1`;

    const result = await this.pool.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Query: Get all active control limits for a tenant
   */
  @Query('spcAllControlLimits')
  async getAllSPCControlLimits(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId?: string,
    @Args('isActive') isActive: boolean = true,
  ): Promise<any[]> {
    let query = `
      SELECT *
      FROM spc_control_limits
      WHERE tenant_id = $1
        AND is_active = $2
    `;

    const params: any[] = [tenantId, isActive];
    let paramCount = 2;

    if (facilityId) {
      query += ` AND facility_id = $${++paramCount}`;
      params.push(facilityId);
    }

    query += ` ORDER BY parameter_code, effective_from DESC`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Query: Get SPC alerts
   */
  @Query('spcAlerts')
  async getSPCAlerts(@Args('filter') filter: any): Promise<any[]> {
    const {
      tenantId,
      facilityId,
      status,
      severity,
      startDate,
      endDate,
      parameterCode,
      workCenterId,
      limit = 100,
    } = filter;

    let query = `
      SELECT *
      FROM spc_out_of_control_alerts
      WHERE tenant_id = $1
    `;

    const params: any[] = [tenantId];
    let paramCount = 1;

    if (facilityId) {
      query += ` AND facility_id = $${++paramCount}`;
      params.push(facilityId);
    }

    if (status) {
      query += ` AND status = $${++paramCount}`;
      params.push(status);
    }

    if (severity) {
      query += ` AND severity = $${++paramCount}`;
      params.push(severity);
    }

    if (parameterCode) {
      query += ` AND parameter_code = $${++paramCount}`;
      params.push(parameterCode);
    }

    if (workCenterId) {
      query += ` AND work_center_id = $${++paramCount}`;
      params.push(workCenterId);
    }

    if (startDate) {
      query += ` AND alert_timestamp >= $${++paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND alert_timestamp <= $${++paramCount}`;
      params.push(endDate);
    }

    query += `
      ORDER BY alert_timestamp DESC
      LIMIT $${++paramCount}
    `;
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Mutation: Record manual SPC measurement
   */
  @Mutation('recordSPCMeasurement')
  async recordSPCMeasurement(@Args('input') input: any): Promise<any> {
    const query = `
      INSERT INTO spc_control_chart_data (
        tenant_id,
        facility_id,
        parameter_code,
        parameter_name,
        parameter_type,
        chart_type,
        measured_value,
        measurement_unit,
        production_run_id,
        work_center_id,
        product_id,
        measurement_method,
        measurement_device_id,
        operator_user_id,
        quality_inspection_id,
        lot_number,
        data_source,
        measurement_quality
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'VERIFIED')
      RETURNING *
    `;

    const params = [
      input.tenantId,
      input.facilityId,
      input.parameterCode,
      input.parameterName,
      input.parameterType,
      input.chartType,
      input.measuredValue,
      input.measurementUnit,
      input.productionRunId,
      input.workCenterId,
      input.productId,
      input.measurementMethod,
      input.measurementDeviceId,
      input.operatorUserId,
      input.qualityInspectionId,
      input.lotNumber,
      input.dataSource,
    ];

    const result = await this.pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Mutation: Create control limits
   */
  @Mutation('createSPCControlLimits')
  async createSPCControlLimits(@Args('input') input: any): Promise<any> {
    const query = `
      INSERT INTO spc_control_limits (
        tenant_id,
        facility_id,
        parameter_code,
        parameter_name,
        chart_type,
        product_id,
        work_center_id,
        material_id,
        upper_spec_limit,
        lower_spec_limit,
        target_value,
        upper_control_limit,
        center_line,
        lower_control_limit,
        process_mean,
        process_std_dev,
        process_range,
        calculation_method,
        effective_from,
        recalculation_frequency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `;

    const params = [
      input.tenantId,
      input.facilityId,
      input.parameterCode,
      input.parameterName,
      input.chartType,
      input.productId,
      input.workCenterId,
      input.materialId,
      input.upperSpecLimit,
      input.lowerSpecLimit,
      input.targetValue,
      input.upperControlLimit,
      input.centerLine,
      input.lowerControlLimit,
      input.processMean,
      input.processStdDev,
      input.processRange,
      input.calculationMethod,
      input.effectiveFrom,
      input.recalculationFrequency,
    ];

    const result = await this.pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Mutation: Acknowledge SPC alert
   */
  @Mutation('acknowledgeSPCAlert')
  async acknowledgeSPCAlert(
    @Args('id') id: string,
    @Args('userId') userId: string,
  ): Promise<any> {
    const query = `
      UPDATE spc_out_of_control_alerts
      SET
        status = 'ACKNOWLEDGED',
        acknowledged_by_user_id = $2,
        acknowledged_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [id, userId]);
    return result.rows[0];
  }

  /**
   * Mutation: Resolve SPC alert
   */
  @Mutation('resolveSPCAlert')
  async resolveSPCAlert(
    @Args('id') id: string,
    @Args('userId') userId: string,
    @Args('rootCause') rootCause: string,
    @Args('correctiveAction') correctiveAction: string,
  ): Promise<any> {
    const query = `
      UPDATE spc_out_of_control_alerts
      SET
        status = 'RESOLVED',
        root_cause = $2,
        corrective_action = $3,
        resolved_by_user_id = $4,
        resolved_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      id,
      rootCause,
      correctiveAction,
      userId,
    ]);
    return result.rows[0];
  }
}
