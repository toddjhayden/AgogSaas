/**
 * Maintenance Recommendation Service
 * REQ: REQ-STRATEGIC-AUTO-1767108044310
 *
 * Generates and manages AI-driven maintenance optimization recommendations
 * based on equipment health trends, failure history, and cost-benefit analysis.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';

export interface CreateRecommendationInput {
  tenantId: string;
  facilityId: string;
  workCenterId: string;
  recommendationType: string;
  recommendedMaintenanceStrategy: string;
  recommendedIntervalDays?: number;
  recommendedIntervalHours?: number;
  triggerConditions?: any[];
  projectedCostSavings: number;
  detailedAnalysis: string;
  justification: string;
  benefits?: string;
  risks?: string;
}

@Injectable()
export class MaintenanceRecommendationService {
  private readonly logger = new Logger(MaintenanceRecommendationService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new maintenance optimization recommendation
   */
  async createRecommendation(input: CreateRecommendationInput): Promise<any> {
    this.logger.log(`Creating maintenance recommendation for work center ${input.workCenterId}`);

    // Generate recommendation number
    const recommendationNumber = await this.generateRecommendationNumber(input.tenantId);

    const query = `
      INSERT INTO maintenance_recommendations (
        tenant_id, facility_id, recommendation_number,
        recommendation_date, work_center_id, recommendation_type,
        recommended_maintenance_strategy,
        recommended_interval_days, recommended_interval_hours,
        trigger_conditions, projected_cost_savings,
        detailed_analysis, justification, benefits, risks,
        approval_status, implementation_status, is_active
      ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      input.tenantId,
      input.facilityId,
      recommendationNumber,
      input.workCenterId,
      input.recommendationType,
      input.recommendedMaintenanceStrategy,
      input.recommendedIntervalDays || null,
      input.recommendedIntervalHours || null,
      JSON.stringify(input.triggerConditions || []),
      input.projectedCostSavings,
      input.detailedAnalysis,
      input.justification,
      input.benefits || null,
      input.risks || null,
      'PENDING',
      'NOT_STARTED',
      true,
    ]);

    return result.rows[0];
  }

  /**
   * Generate unique recommendation number
   */
  private async generateRecommendationNumber(tenantId: string): Promise<string> {
    const query = `
      SELECT COUNT(*) as count
      FROM maintenance_recommendations
      WHERE tenant_id = $1
        AND recommendation_date >= DATE_TRUNC('year', CURRENT_DATE)
    `;

    const result = await this.db.query(query, [tenantId]);
    const count = parseInt(result.rows[0]?.count || '0') + 1;

    const year = new Date().getFullYear();
    return `REC-${year}-${count.toString().padStart(5, '0')}`;
  }

  /**
   * Approve a recommendation
   */
  async approveRecommendation(
    recommendationId: string,
    approvedByUserId: string,
    notes?: string,
  ): Promise<any> {
    this.logger.log(`Approving recommendation ${recommendationId}`);

    const query = `
      UPDATE maintenance_recommendations
      SET approval_status = 'APPROVED',
          approved_by_user_id = $1,
          approved_at = NOW(),
          validation_notes = COALESCE($2, validation_notes),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const result = await this.db.query(query, [approvedByUserId, notes || null, recommendationId]);

    if (!result.rows || result.rows.length === 0) {
      throw new NotFoundException(`Recommendation ${recommendationId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Reject a recommendation
   */
  async rejectRecommendation(
    recommendationId: string,
    rejectedByUserId: string,
    reason: string,
  ): Promise<any> {
    this.logger.log(`Rejecting recommendation ${recommendationId}`);

    const query = `
      UPDATE maintenance_recommendations
      SET approval_status = 'REJECTED',
          approved_by_user_id = $1,
          approved_at = NOW(),
          rejection_reason = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const result = await this.db.query(query, [rejectedByUserId, reason, recommendationId]);

    if (!result.rows || result.rows.length === 0) {
      throw new NotFoundException(`Recommendation ${recommendationId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Start implementation of a recommendation
   */
  async startImplementation(
    recommendationId: string,
    implementedByUserId: string,
    startDate?: Date,
  ): Promise<any> {
    this.logger.log(`Starting implementation of recommendation ${recommendationId}`);

    const query = `
      UPDATE maintenance_recommendations
      SET implementation_status = 'IN_PROGRESS',
          implementation_started_at = COALESCE($1, NOW()),
          implemented_by_user_id = $2,
          updated_at = NOW()
      WHERE id = $3
        AND approval_status = 'APPROVED'
      RETURNING *
    `;

    const result = await this.db.query(query, [
      startDate || null,
      implementedByUserId,
      recommendationId,
    ]);

    if (!result.rows || result.rows.length === 0) {
      throw new NotFoundException(
        `Recommendation ${recommendationId} not found or not approved`,
      );
    }

    return result.rows[0];
  }

  /**
   * Complete implementation of a recommendation
   */
  async completeImplementation(recommendationId: string): Promise<any> {
    this.logger.log(`Completing implementation of recommendation ${recommendationId}`);

    const query = `
      UPDATE maintenance_recommendations
      SET implementation_status = 'COMPLETED',
          implementation_completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
        AND implementation_status = 'IN_PROGRESS'
      RETURNING *
    `;

    const result = await this.db.query(query, [recommendationId]);

    if (!result.rows || result.rows.length === 0) {
      throw new NotFoundException(
        `Recommendation ${recommendationId} not found or not in progress`,
      );
    }

    return result.rows[0];
  }

  /**
   * Validate recommendation results
   */
  async validateRecommendation(
    recommendationId: string,
    validation: {
      actualCostSavings?: number;
      actualDowntimeReductionHours?: number;
      actualFailureReductionPercent?: number;
      notes?: string;
    },
  ): Promise<any> {
    this.logger.log(`Validating recommendation ${recommendationId}`);

    const query = `
      UPDATE maintenance_recommendations
      SET actual_cost_savings = $1,
          actual_downtime_reduction_hours = $2,
          actual_failure_reduction_percent = $3,
          results_validated = TRUE,
          validation_date = CURRENT_DATE,
          validation_notes = $4,
          updated_at = NOW()
      WHERE id = $5
        AND implementation_status = 'COMPLETED'
      RETURNING *
    `;

    const result = await this.db.query(query, [
      validation.actualCostSavings || null,
      validation.actualDowntimeReductionHours || null,
      validation.actualFailureReductionPercent || null,
      validation.notes || null,
      recommendationId,
    ]);

    if (!result.rows || result.rows.length === 0) {
      throw new NotFoundException(
        `Recommendation ${recommendationId} not found or not completed`,
      );
    }

    return result.rows[0];
  }

  /**
   * Get recommendation by ID
   */
  async getRecommendation(recommendationId: string): Promise<any> {
    const query = `
      SELECT
        mr.*,
        wc.work_center_name,
        wc.work_center_code
      FROM maintenance_recommendations mr
      JOIN work_centers wc ON mr.work_center_id = wc.id
      WHERE mr.id = $1
    `;

    const result = await this.db.query(query, [recommendationId]);

    if (!result.rows || result.rows.length === 0) {
      throw new NotFoundException(`Recommendation ${recommendationId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Get recommendations with filters
   */
  async getRecommendations(
    tenantId: string,
    filters?: {
      workCenterId?: string;
      facilityId?: string;
      recommendationType?: string;
      approvalStatus?: string;
      implementationStatus?: string;
      limit?: number;
    },
  ): Promise<any[]> {
    let query = `
      SELECT
        mr.*,
        wc.work_center_name,
        wc.work_center_code
      FROM maintenance_recommendations mr
      JOIN work_centers wc ON mr.work_center_id = wc.id
      WHERE mr.tenant_id = $1
        AND mr.is_active = TRUE
    `;

    const params: any[] = [tenantId];

    if (filters?.workCenterId) {
      params.push(filters.workCenterId);
      query += ` AND mr.work_center_id = $${params.length}`;
    }

    if (filters?.facilityId) {
      params.push(filters.facilityId);
      query += ` AND mr.facility_id = $${params.length}`;
    }

    if (filters?.recommendationType) {
      params.push(filters.recommendationType);
      query += ` AND mr.recommendation_type = $${params.length}`;
    }

    if (filters?.approvalStatus) {
      params.push(filters.approvalStatus);
      query += ` AND mr.approval_status = $${params.length}`;
    }

    if (filters?.implementationStatus) {
      params.push(filters.implementationStatus);
      query += ` AND mr.implementation_status = $${params.length}`;
    }

    query += ` ORDER BY mr.recommendation_date DESC`;

    if (filters?.limit) {
      params.push(filters.limit);
      query += ` LIMIT $${params.length}`;
    } else {
      query += ` LIMIT 100`;
    }

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Generate interval optimization recommendation
   */
  async generateIntervalOptimization(
    tenantId: string,
    facilityId: string,
    workCenterId: string,
  ): Promise<any> {
    this.logger.log(`Generating interval optimization for work center ${workCenterId}`);

    // Analyze historical data
    const analysisQuery = `
      SELECT
        AVG(time_between_failures_hours) as avg_tbf,
        STDDEV(time_between_failures_hours) as stddev_tbf,
        COUNT(*) as failure_count,
        AVG(repair_duration_hours) as avg_repair_time
      FROM (
        SELECT
          EXTRACT(EPOCH FROM (lead_timestamp - status_start)) / 3600.0 as time_between_failures_hours,
          duration_minutes / 60.0 as repair_duration_hours
        FROM (
          SELECT
            status_start,
            duration_minutes,
            LEAD(status_start) OVER (ORDER BY status_start) as lead_timestamp
          FROM equipment_status_log
          WHERE work_center_id = $1
            AND status = 'NON_PRODUCTIVE_BREAKDOWN'
            AND status_start > NOW() - INTERVAL '1 year'
        ) failures
      ) failure_analysis
    `;

    const analysis = await this.db.query(analysisQuery, [workCenterId]);

    if (!analysis.rows || analysis.rows.length === 0 || !analysis.rows[0].avg_tbf) {
      throw new Error('Insufficient historical data for interval optimization');
    }

    const avgTBF = parseFloat(analysis.rows[0].avg_tbf);
    const failureCount = parseInt(analysis.rows[0].failure_count || '0');

    // Calculate recommended interval (80% of average TBF for safety margin)
    const recommendedIntervalHours = Math.floor(avgTBF * 0.8);
    const recommendedIntervalDays = Math.floor(recommendedIntervalHours / 24);

    // Estimate cost savings
    const avgRepairTime = parseFloat(analysis.rows[0].avg_repair_time || '8');
    const downtimeCostPerHour = 500; // Assume $500/hour downtime cost
    const maintenanceCost = 200; // Assume $200 per maintenance

    const currentAnnualCost = failureCount * (avgRepairTime * downtimeCostPerHour);
    const projectedFailures = Math.max(1, failureCount * 0.6); // 40% reduction expected
    const projectedAnnualCost =
      projectedFailures * (avgRepairTime * downtimeCostPerHour) +
      (365 / recommendedIntervalDays) * maintenanceCost;
    const projectedCostSavings = currentAnnualCost - projectedAnnualCost;

    // Create recommendation
    return this.createRecommendation({
      tenantId,
      facilityId,
      workCenterId,
      recommendationType: 'INTERVAL_ADJUSTMENT',
      recommendedMaintenanceStrategy: 'TIME_BASED_PREVENTIVE',
      recommendedIntervalDays,
      recommendedIntervalHours,
      projectedCostSavings,
      detailedAnalysis: `Based on analysis of ${failureCount} failures over the past year, the average time between failures is ${avgTBF.toFixed(1)} hours. Implementing a preventive maintenance interval of ${recommendedIntervalDays} days (${recommendedIntervalHours} hours) with a 20% safety margin is recommended to reduce unexpected failures.`,
      justification: `Current reactive maintenance approach results in approximately ${failureCount} failures per year with an average repair time of ${avgRepairTime.toFixed(1)} hours. Proactive maintenance at the recommended interval can reduce failures by an estimated 40% while maintaining predictable maintenance schedules.`,
      benefits: `- Reduced unplanned downtime\n- More predictable maintenance costs\n- Extended equipment lifespan\n- Improved production reliability`,
      risks: `- Initial increase in maintenance frequency\n- Requires scheduling coordination\n- May need additional spare parts inventory`,
    });
  }
}
