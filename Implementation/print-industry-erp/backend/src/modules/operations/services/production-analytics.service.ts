/**
 * Production Analytics Service
 *
 * Provides real-time and historical production analytics for dashboards.
 * Implements efficient aggregation queries for:
 * - Production run summaries by facility/work center
 * - Real-time OEE metrics and trends
 * - Equipment utilization analysis
 * - Production throughput and quality metrics
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328660 - Real-Time Production Analytics Dashboard
 * Created: 2025-12-29
 * Author: Roy (Backend Architect)
 *
 * Architecture Notes:
 * - Uses optimized database views with covering indexes
 * - Supports facility-level and work-center-level aggregation
 * - Implements time-range filtering for historical analysis
 * - Provides near-real-time data (polling-based, can be enhanced with subscriptions later)
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export interface ProductionSummary {
  facilityId: string;
  workCenterId?: string;
  workCenterName?: string;
  workCenterType?: string;
  activeRuns: number;
  scheduledRuns: number;
  completedRunsToday: number;
  totalGoodQuantity: number;
  totalScrapQuantity: number;
  totalReworkQuantity: number;
  averageYield: number;
  currentOEE?: number;
  asOfTimestamp: Date;
}

export interface ProductionRunSummary {
  id: string;
  productionRunNumber: string;
  productionOrderNumber: string;
  workCenterName: string;
  operatorName: string;
  status: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  quantityPlanned: number;
  quantityGood: number;
  quantityScrap: number;
  quantityRework: number;
  progressPercentage: number;
  setupTimeMinutes?: number;
  runTimeMinutes?: number;
  downtimeMinutes?: number;
  currentOEE?: number;
}

export interface OEETrend {
  workCenterId: string;
  workCenterName: string;
  calculationDate: Date;
  shift?: string;
  availabilityPercentage: number;
  performancePercentage: number;
  qualityPercentage: number;
  oeePercentage: number;
  targetOEEPercentage: number;
}

export interface WorkCenterUtilization {
  workCenterId: string;
  workCenterName: string;
  workCenterType: string;
  status: string;
  currentProductionRunId?: string;
  currentProductionRunNumber?: string;
  currentOEE?: number;
  todayRuntime: number;
  todayDowntime: number;
  todaySetupTime: number;
  utilizationPercentage: number;
  activeRunProgress?: number;
}

export interface ProductionAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  type: string;
  workCenterId?: string;
  workCenterName?: string;
  productionRunId?: string;
  productionRunNumber?: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

@Injectable()
export class ProductionAnalyticsService {
  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * Get production summary for a facility (aggregated across all work centers)
   */
  async getFacilitySummary(
    tenantId: string,
    facilityId: string,
  ): Promise<ProductionSummary> {
    const query = `
      SELECT
        $2::uuid as facility_id,
        COUNT(*) FILTER (WHERE pr.status = 'IN_PROGRESS') as active_runs,
        COUNT(*) FILTER (WHERE pr.status = 'SCHEDULED') as scheduled_runs,
        COUNT(*) FILTER (WHERE pr.status = 'COMPLETED' AND pr.actual_start >= CURRENT_DATE) as completed_runs_today,
        COALESCE(SUM(pr.quantity_good), 0) as total_good_quantity,
        COALESCE(SUM(pr.quantity_scrap), 0) as total_scrap_quantity,
        COALESCE(SUM(pr.quantity_rework), 0) as total_rework_quantity,
        CASE
          WHEN SUM(pr.quantity_planned) > 0
          THEN (SUM(pr.quantity_good) / NULLIF(SUM(pr.quantity_planned), 0)) * 100
          ELSE 0
        END as average_yield,
        (
          SELECT AVG(oee_percentage)
          FROM oee_calculations
          WHERE tenant_id = $1
            AND facility_id = $2
            AND calculation_date = CURRENT_DATE
        ) as current_oee,
        NOW() as as_of_timestamp
      FROM production_runs pr
      WHERE pr.tenant_id = $1
        AND pr.facility_id = $2
        AND pr.actual_start >= CURRENT_DATE
    `;

    const result = await this.db.query(query, [tenantId, facilityId]);

    if (result.rows.length === 0) {
      return {
        facilityId,
        activeRuns: 0,
        scheduledRuns: 0,
        completedRunsToday: 0,
        totalGoodQuantity: 0,
        totalScrapQuantity: 0,
        totalReworkQuantity: 0,
        averageYield: 0,
        asOfTimestamp: new Date(),
      };
    }

    const row = result.rows[0];
    return {
      facilityId: row.facility_id,
      activeRuns: parseInt(row.active_runs, 10),
      scheduledRuns: parseInt(row.scheduled_runs, 10),
      completedRunsToday: parseInt(row.completed_runs_today, 10),
      totalGoodQuantity: parseFloat(row.total_good_quantity),
      totalScrapQuantity: parseFloat(row.total_scrap_quantity),
      totalReworkQuantity: parseFloat(row.total_rework_quantity),
      averageYield: parseFloat(row.average_yield),
      currentOEE: row.current_oee ? parseFloat(row.current_oee) : undefined,
      asOfTimestamp: row.as_of_timestamp,
    };
  }

  /**
   * Get production summary by work center
   */
  async getWorkCenterSummaries(
    tenantId: string,
    facilityId: string,
  ): Promise<ProductionSummary[]> {
    const query = `
      SELECT
        pr.facility_id,
        pr.work_center_id,
        wc.work_center_name,
        wc.work_center_type,
        COUNT(*) FILTER (WHERE pr.status = 'IN_PROGRESS') as active_runs,
        COUNT(*) FILTER (WHERE pr.status = 'SCHEDULED') as scheduled_runs,
        COUNT(*) FILTER (WHERE pr.status = 'COMPLETED' AND pr.actual_start >= CURRENT_DATE) as completed_runs_today,
        COALESCE(SUM(pr.quantity_good), 0) as total_good_quantity,
        COALESCE(SUM(pr.quantity_scrap), 0) as total_scrap_quantity,
        COALESCE(SUM(pr.quantity_rework), 0) as total_rework_quantity,
        CASE
          WHEN SUM(pr.quantity_planned) > 0
          THEN (SUM(pr.quantity_good) / NULLIF(SUM(pr.quantity_planned), 0)) * 100
          ELSE 0
        END as average_yield,
        (
          SELECT oee_percentage
          FROM oee_calculations
          WHERE tenant_id = $1
            AND facility_id = $2
            AND work_center_id = pr.work_center_id
            AND calculation_date = CURRENT_DATE
          ORDER BY created_at DESC
          LIMIT 1
        ) as current_oee,
        NOW() as as_of_timestamp
      FROM production_runs pr
      JOIN work_centers wc ON pr.work_center_id = wc.id
      WHERE pr.tenant_id = $1
        AND pr.facility_id = $2
        AND pr.actual_start >= CURRENT_DATE
        AND wc.deleted_at IS NULL
      GROUP BY pr.facility_id, pr.work_center_id, wc.work_center_name, wc.work_center_type
      ORDER BY wc.work_center_code
    `;

    const result = await this.db.query(query, [tenantId, facilityId]);

    return result.rows.map((row) => ({
      facilityId: row.facility_id,
      workCenterId: row.work_center_id,
      workCenterName: row.work_center_name,
      workCenterType: row.work_center_type,
      activeRuns: parseInt(row.active_runs, 10),
      scheduledRuns: parseInt(row.scheduled_runs, 10),
      completedRunsToday: parseInt(row.completed_runs_today, 10),
      totalGoodQuantity: parseFloat(row.total_good_quantity),
      totalScrapQuantity: parseFloat(row.total_scrap_quantity),
      totalReworkQuantity: parseFloat(row.total_rework_quantity),
      averageYield: parseFloat(row.average_yield),
      currentOEE: row.current_oee ? parseFloat(row.current_oee) : undefined,
      asOfTimestamp: row.as_of_timestamp,
    }));
  }

  /**
   * Get active and recent production runs with full details
   */
  async getProductionRunSummaries(
    tenantId: string,
    facilityId: string,
    workCenterId?: string,
    status?: string,
    limit: number = 50,
  ): Promise<ProductionRunSummary[]> {
    let whereClause = `pr.tenant_id = $1 AND pr.facility_id = $2`;
    const params: any[] = [tenantId, facilityId];
    let paramIndex = 3;

    if (workCenterId) {
      whereClause += ` AND pr.work_center_id = $${paramIndex++}`;
      params.push(workCenterId);
    }

    if (status) {
      whereClause += ` AND pr.status = $${paramIndex++}`;
      params.push(status);
    } else {
      // Default: show active, scheduled, and recently completed
      whereClause += ` AND (
        pr.status IN ('IN_PROGRESS', 'SCHEDULED', 'PAUSED')
        OR (pr.status = 'COMPLETED' AND pr.actual_end >= NOW() - INTERVAL '24 hours')
      )`;
    }

    const query = `
      SELECT
        pr.id,
        pr.production_run_number,
        po.production_order_number,
        wc.work_center_name,
        COALESCE(u.display_name, pr.operator_name, 'Unassigned') as operator_name,
        pr.status,
        pr.scheduled_start,
        pr.scheduled_end,
        pr.actual_start,
        pr.actual_end,
        pr.quantity_planned,
        pr.quantity_good,
        pr.quantity_scrap,
        pr.quantity_rework,
        CASE
          WHEN pr.quantity_planned > 0
          THEN (pr.quantity_good / NULLIF(pr.quantity_planned, 0)) * 100
          ELSE 0
        END as progress_percentage,
        pr.setup_time_minutes,
        pr.run_time_minutes,
        pr.downtime_minutes,
        (
          SELECT oee_percentage
          FROM oee_calculations
          WHERE work_center_id = pr.work_center_id
            AND calculation_date = CURRENT_DATE
          ORDER BY created_at DESC
          LIMIT 1
        ) as current_oee
      FROM production_runs pr
      JOIN production_orders po ON pr.production_order_id = po.id
      JOIN work_centers wc ON pr.work_center_id = wc.id
      LEFT JOIN users u ON pr.operator_user_id = u.id
      WHERE ${whereClause}
      ORDER BY
        CASE pr.status
          WHEN 'IN_PROGRESS' THEN 1
          WHEN 'PAUSED' THEN 2
          WHEN 'SCHEDULED' THEN 3
          WHEN 'COMPLETED' THEN 4
          ELSE 5
        END,
        pr.scheduled_start ASC
      LIMIT $${paramIndex}
    `;

    params.push(limit);
    const result = await this.db.query(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      productionRunNumber: row.production_run_number,
      productionOrderNumber: row.production_order_number,
      workCenterName: row.work_center_name,
      operatorName: row.operator_name,
      status: row.status,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      actualStart: row.actual_start,
      actualEnd: row.actual_end,
      quantityPlanned: parseFloat(row.quantity_planned),
      quantityGood: parseFloat(row.quantity_good),
      quantityScrap: parseFloat(row.quantity_scrap),
      quantityRework: parseFloat(row.quantity_rework),
      progressPercentage: parseFloat(row.progress_percentage),
      setupTimeMinutes: row.setup_time_minutes
        ? parseFloat(row.setup_time_minutes)
        : undefined,
      runTimeMinutes: row.run_time_minutes
        ? parseFloat(row.run_time_minutes)
        : undefined,
      downtimeMinutes: row.downtime_minutes
        ? parseFloat(row.downtime_minutes)
        : undefined,
      currentOEE: row.current_oee ? parseFloat(row.current_oee) : undefined,
    }));
  }

  /**
   * Get OEE trends for work centers over time
   */
  async getOEETrends(
    tenantId: string,
    facilityId: string,
    workCenterId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<OEETrend[]> {
    let whereClause = `oee.tenant_id = $1 AND oee.facility_id = $2`;
    const params: any[] = [tenantId, facilityId];
    let paramIndex = 3;

    if (workCenterId) {
      whereClause += ` AND oee.work_center_id = $${paramIndex++}`;
      params.push(workCenterId);
    }

    if (startDate) {
      whereClause += ` AND oee.calculation_date >= $${paramIndex++}`;
      params.push(startDate);
    } else {
      // Default to last 30 days
      whereClause += ` AND oee.calculation_date >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    if (endDate) {
      whereClause += ` AND oee.calculation_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    const query = `
      SELECT
        oee.work_center_id,
        wc.work_center_name,
        oee.calculation_date,
        oee.shift,
        oee.availability_percentage,
        oee.performance_percentage,
        oee.quality_percentage,
        oee.oee_percentage,
        oee.target_oee_percentage
      FROM oee_calculations oee
      JOIN work_centers wc ON oee.work_center_id = wc.id
      WHERE ${whereClause}
        AND wc.deleted_at IS NULL
      ORDER BY oee.calculation_date DESC, wc.work_center_name, oee.shift
    `;

    const result = await this.db.query(query, params);

    return result.rows.map((row) => ({
      workCenterId: row.work_center_id,
      workCenterName: row.work_center_name,
      calculationDate: row.calculation_date,
      shift: row.shift,
      availabilityPercentage: parseFloat(row.availability_percentage),
      performancePercentage: parseFloat(row.performance_percentage),
      qualityPercentage: parseFloat(row.quality_percentage),
      oeePercentage: parseFloat(row.oee_percentage),
      targetOEEPercentage: parseFloat(row.target_oee_percentage),
    }));
  }

  /**
   * Get work center utilization with current status
   */
  async getWorkCenterUtilization(
    tenantId: string,
    facilityId: string,
  ): Promise<WorkCenterUtilization[]> {
    const query = `
      SELECT
        wc.id as work_center_id,
        wc.work_center_name,
        wc.work_center_type,
        wc.status,
        current_run.id as current_production_run_id,
        current_run.production_run_number as current_production_run_number,
        (
          SELECT oee_percentage
          FROM oee_calculations
          WHERE work_center_id = wc.id
            AND calculation_date = CURRENT_DATE
          ORDER BY created_at DESC
          LIMIT 1
        ) as current_oee,
        COALESCE(today_stats.runtime_minutes, 0) as today_runtime,
        COALESCE(today_stats.downtime_minutes, 0) as today_downtime,
        COALESCE(today_stats.setup_time_minutes, 0) as today_setup_time,
        CASE
          WHEN COALESCE(today_stats.runtime_minutes, 0) + COALESCE(today_stats.downtime_minutes, 0) + COALESCE(today_stats.setup_time_minutes, 0) > 0
          THEN (COALESCE(today_stats.runtime_minutes, 0) /
                NULLIF(COALESCE(today_stats.runtime_minutes, 0) + COALESCE(today_stats.downtime_minutes, 0) + COALESCE(today_stats.setup_time_minutes, 0), 0)) * 100
          ELSE 0
        END as utilization_percentage,
        CASE
          WHEN current_run.quantity_planned > 0
          THEN (current_run.quantity_good / NULLIF(current_run.quantity_planned, 0)) * 100
          ELSE NULL
        END as active_run_progress
      FROM work_centers wc
      LEFT JOIN LATERAL (
        SELECT id, production_run_number, quantity_planned, quantity_good
        FROM production_runs
        WHERE work_center_id = wc.id
          AND status = 'IN_PROGRESS'
        ORDER BY actual_start DESC
        LIMIT 1
      ) current_run ON true
      LEFT JOIN LATERAL (
        SELECT
          SUM(run_time_minutes) as runtime_minutes,
          SUM(downtime_minutes) as downtime_minutes,
          SUM(setup_time_minutes) as setup_time_minutes
        FROM production_runs
        WHERE work_center_id = wc.id
          AND actual_start >= CURRENT_DATE
          AND status IN ('IN_PROGRESS', 'COMPLETED')
      ) today_stats ON true
      WHERE wc.tenant_id = $1
        AND wc.facility_id = $2
        AND wc.deleted_at IS NULL
        AND wc.is_active = true
      ORDER BY wc.work_center_code
    `;

    const result = await this.db.query(query, [tenantId, facilityId]);

    return result.rows.map((row) => ({
      workCenterId: row.work_center_id,
      workCenterName: row.work_center_name,
      workCenterType: row.work_center_type,
      status: row.status,
      currentProductionRunId: row.current_production_run_id || undefined,
      currentProductionRunNumber: row.current_production_run_number || undefined,
      currentOEE: row.current_oee ? parseFloat(row.current_oee) : undefined,
      todayRuntime: parseFloat(row.today_runtime),
      todayDowntime: parseFloat(row.today_downtime),
      todaySetupTime: parseFloat(row.today_setup_time),
      utilizationPercentage: parseFloat(row.utilization_percentage),
      activeRunProgress: row.active_run_progress
        ? parseFloat(row.active_run_progress)
        : undefined,
    }));
  }

  /**
   * Generate production alerts based on current conditions
   */
  async getProductionAlerts(
    tenantId: string,
    facilityId: string,
  ): Promise<ProductionAlert[]> {
    const alerts: ProductionAlert[] = [];

    // Query for low OEE alerts
    const oeeQuery = `
      SELECT
        oee.work_center_id,
        wc.work_center_name,
        oee.oee_percentage,
        oee.target_oee_percentage,
        oee.created_at
      FROM oee_calculations oee
      JOIN work_centers wc ON oee.work_center_id = wc.id
      WHERE oee.tenant_id = $1
        AND oee.facility_id = $2
        AND oee.calculation_date = CURRENT_DATE
        AND oee.oee_percentage < (oee.target_oee_percentage * 0.9)
        AND wc.deleted_at IS NULL
      ORDER BY oee.oee_percentage ASC
    `;

    const oeeResult = await this.db.query(oeeQuery, [tenantId, facilityId]);

    oeeResult.rows.forEach((row) => {
      const severity =
        parseFloat(row.oee_percentage) < parseFloat(row.target_oee_percentage) * 0.7
          ? 'CRITICAL'
          : 'WARNING';

      alerts.push({
        id: `oee-${row.work_center_id}-${Date.now()}`,
        severity: severity as 'CRITICAL' | 'WARNING' | 'INFO',
        type: 'LOW_OEE',
        workCenterId: row.work_center_id,
        workCenterName: row.work_center_name,
        message: `OEE at ${parseFloat(row.oee_percentage).toFixed(1)}% (target: ${parseFloat(row.target_oee_percentage).toFixed(1)}%)`,
        timestamp: row.created_at,
        acknowledged: false,
      });
    });

    // Query for equipment down alerts
    const downQuery = `
      SELECT
        wc.id as work_center_id,
        wc.work_center_name,
        esl.status_start
      FROM work_centers wc
      JOIN equipment_status_log esl ON wc.id = esl.work_center_id
      WHERE wc.tenant_id = $1
        AND wc.facility_id = $2
        AND wc.status = 'DOWN'
        AND esl.status LIKE 'NON_PRODUCTIVE_BREAKDOWN%'
        AND esl.status_end IS NULL
        AND wc.deleted_at IS NULL
      ORDER BY esl.status_start DESC
    `;

    const downResult = await this.db.query(downQuery, [tenantId, facilityId]);

    downResult.rows.forEach((row) => {
      alerts.push({
        id: `down-${row.work_center_id}-${Date.now()}`,
        severity: 'CRITICAL',
        type: 'EQUIPMENT_DOWN',
        workCenterId: row.work_center_id,
        workCenterName: row.work_center_name,
        message: `Equipment down since ${new Date(row.status_start).toLocaleTimeString()}`,
        timestamp: row.status_start,
        acknowledged: false,
      });
    });

    // Query for high scrap rate alerts
    const scrapQuery = `
      SELECT
        pr.id as production_run_id,
        pr.production_run_number,
        pr.work_center_id,
        wc.work_center_name,
        pr.quantity_scrap,
        pr.quantity_planned,
        pr.updated_at
      FROM production_runs pr
      JOIN work_centers wc ON pr.work_center_id = wc.id
      WHERE pr.tenant_id = $1
        AND pr.facility_id = $2
        AND pr.status = 'IN_PROGRESS'
        AND pr.quantity_planned > 0
        AND (pr.quantity_scrap / NULLIF(pr.quantity_planned, 0)) > 0.10
        AND wc.deleted_at IS NULL
      ORDER BY (pr.quantity_scrap / pr.quantity_planned) DESC
    `;

    const scrapResult = await this.db.query(scrapQuery, [tenantId, facilityId]);

    scrapResult.rows.forEach((row) => {
      const scrapRate =
        (parseFloat(row.quantity_scrap) / parseFloat(row.quantity_planned)) * 100;

      alerts.push({
        id: `scrap-${row.production_run_id}-${Date.now()}`,
        severity: scrapRate > 15 ? 'CRITICAL' : 'WARNING',
        type: 'QUALITY_ISSUE',
        workCenterId: row.work_center_id,
        workCenterName: row.work_center_name,
        productionRunId: row.production_run_id,
        productionRunNumber: row.production_run_number,
        message: `High scrap rate: ${scrapRate.toFixed(1)}%`,
        timestamp: row.updated_at,
        acknowledged: false,
      });
    });

    // Sort alerts by severity and timestamp
    alerts.sort((a, b) => {
      const severityOrder = { CRITICAL: 1, WARNING: 2, INFO: 3 };
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    return alerts;
  }
}
