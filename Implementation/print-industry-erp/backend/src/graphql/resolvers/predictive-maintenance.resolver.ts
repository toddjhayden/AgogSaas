/**
 * Predictive Maintenance GraphQL Resolver
 * REQ: REQ-STRATEGIC-AUTO-1767108044310
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { EquipmentHealthScoreService } from '../../modules/predictive-maintenance/services/equipment-health-score.service';
import { PredictiveAlertService } from '../../modules/predictive-maintenance/services/predictive-alert.service';
import { ModelManagementService } from '../../modules/predictive-maintenance/services/model-management.service';
import { MaintenanceRecommendationService } from '../../modules/predictive-maintenance/services/maintenance-recommendation.service';
import { DatabaseService } from '../../common/database/database.service';

@Resolver()
export class PredictiveMaintenanceResolver {
  constructor(
    private readonly healthScoreService: EquipmentHealthScoreService,
    private readonly alertService: PredictiveAlertService,
    private readonly modelService: ModelManagementService,
    private readonly recommendationService: MaintenanceRecommendationService,
    private readonly db: DatabaseService,
  ) {}

  // ============================================
  // EQUIPMENT HEALTH QUERIES
  // ============================================

  @Query()
  async equipmentHealthScores(
    @Args('workCenterId') workCenterId?: string,
    @Args('facilityId') facilityId?: string,
    @Args('healthStatus') healthStatus?: string,
    @Args('trendDirection') trendDirection?: string,
    @Args('startDate') startDate?: Date,
    @Args('endDate') endDate?: Date,
    @Args('limit') limit?: number,
    @Context() context?: any,
  ): Promise<any[]> {
    const tenantId = context?.req?.tenantId || 'default-tenant';

    let query = `
      SELECT
        ehs.*,
        wc.work_center_name,
        wc.work_center_code
      FROM equipment_health_scores ehs
      JOIN work_centers wc ON ehs.work_center_id = wc.id
      WHERE ehs.tenant_id = $1
    `;

    const params: any[] = [tenantId];

    if (workCenterId) {
      params.push(workCenterId);
      query += ` AND ehs.work_center_id = $${params.length}`;
    }

    if (facilityId) {
      params.push(facilityId);
      query += ` AND ehs.facility_id = $${params.length}`;
    }

    if (healthStatus) {
      params.push(healthStatus);
      query += ` AND ehs.health_status = $${params.length}`;
    }

    if (trendDirection) {
      params.push(trendDirection);
      query += ` AND ehs.trend_direction = $${params.length}`;
    }

    if (startDate && endDate) {
      params.push(startDate, endDate);
      query += ` AND ehs.score_timestamp BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    query += ` ORDER BY ehs.score_timestamp DESC`;

    if (limit) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    } else {
      query += ` LIMIT 100`;
    }

    const result = await this.db.query(query, params);
    return result.rows;
  }

  @Query()
  async equipmentHealthScore(@Args('id') id: string): Promise<any> {
    const query = `
      SELECT
        ehs.*,
        wc.work_center_name,
        wc.work_center_code
      FROM equipment_health_scores ehs
      JOIN work_centers wc ON ehs.work_center_id = wc.id
      WHERE ehs.id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  @Query()
  async latestEquipmentHealthScore(@Args('workCenterId') workCenterId: string): Promise<any> {
    return this.healthScoreService.getLatestHealthScore(workCenterId);
  }

  // ============================================
  // ALERT QUERIES
  // ============================================

  @Query()
  async predictiveMaintenanceAlerts(
    @Args('workCenterId') workCenterId?: string,
    @Args('facilityId') facilityId?: string,
    @Args('status') status?: string,
    @Args('severity') severity?: string,
    @Args('urgency') urgency?: string,
    @Args('alertType') alertType?: string,
    @Args('startDate') startDate?: Date,
    @Args('endDate') endDate?: Date,
    @Args('limit') limit?: number,
    @Context() context?: any,
  ): Promise<any[]> {
    const tenantId = context?.req?.tenantId || 'default-tenant';

    let query = `
      SELECT
        pma.*,
        wc.work_center_name,
        wc.work_center_code
      FROM predictive_maintenance_alerts pma
      JOIN work_centers wc ON pma.work_center_id = wc.id
      WHERE pma.tenant_id = $1
    `;

    const params: any[] = [tenantId];

    if (workCenterId) {
      params.push(workCenterId);
      query += ` AND pma.work_center_id = $${params.length}`;
    }

    if (facilityId) {
      params.push(facilityId);
      query += ` AND pma.facility_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND pma.status = $${params.length}`;
    }

    if (severity) {
      params.push(severity);
      query += ` AND pma.severity = $${params.length}`;
    }

    if (urgency) {
      params.push(urgency);
      query += ` AND pma.urgency = $${params.length}`;
    }

    if (alertType) {
      params.push(alertType);
      query += ` AND pma.alert_type = $${params.length}`;
    }

    if (startDate && endDate) {
      params.push(startDate, endDate);
      query += ` AND pma.alert_timestamp BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    query += ` ORDER BY pma.severity DESC, pma.alert_timestamp DESC`;

    if (limit) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    } else {
      query += ` LIMIT 100`;
    }

    const result = await this.db.query(query, params);
    return result.rows;
  }

  @Query()
  async predictiveMaintenanceAlert(@Args('id') id: string): Promise<any> {
    const query = `
      SELECT
        pma.*,
        wc.work_center_name,
        wc.work_center_code
      FROM predictive_maintenance_alerts pma
      JOIN work_centers wc ON pma.work_center_id = wc.id
      WHERE pma.id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  // ============================================
  // DASHBOARD QUERY
  // ============================================

  @Query()
  async predictiveMaintenanceDashboard(
    @Args('facilityId') facilityId?: string,
    @Args('timeRange') timeRange?: string,
    @Context() context?: any,
  ): Promise<any> {
    const tenantId = context?.req?.tenantId || 'default-tenant';

    // Get total equipment count
    const totalEquipmentQuery = `
      SELECT COUNT(DISTINCT id) as total
      FROM work_centers
      WHERE tenant_id = $1
        AND is_active = TRUE
    `;
    const totalEquipment = await this.db.query(totalEquipmentQuery, [tenantId]);

    // Get equipment by health status
    const healthStatusQuery = `
      SELECT
        health_status as status,
        COUNT(*) as count
      FROM (
        SELECT DISTINCT ON (work_center_id)
          health_status
        FROM equipment_health_scores
        WHERE tenant_id = $1
        ORDER BY work_center_id, score_timestamp DESC
      ) latest_scores
      GROUP BY health_status
    `;
    const healthStatus = await this.db.query(healthStatusQuery, [tenantId]);

    // Get average health score
    const avgHealthQuery = `
      SELECT AVG(overall_health_score) as avg_score
      FROM (
        SELECT DISTINCT ON (work_center_id)
          overall_health_score
        FROM equipment_health_scores
        WHERE tenant_id = $1
        ORDER BY work_center_id, score_timestamp DESC
      ) latest_scores
    `;
    const avgHealth = await this.db.query(avgHealthQuery, [tenantId]);

    // Get active alerts
    const activeAlertsQuery = `
      SELECT COUNT(*) as count
      FROM predictive_maintenance_alerts
      WHERE tenant_id = $1
        AND status IN ('OPEN', 'ACKNOWLEDGED')
    `;
    const activeAlerts = await this.db.query(activeAlertsQuery, [tenantId]);

    // Get alerts by severity
    const alertsBySeverity = await this.alertService.getAlertsBySeverity(tenantId);

    return {
      tenantId,
      facilityId,
      totalEquipment: parseInt(totalEquipment.rows[0]?.total || '0'),
      equipmentByHealthStatus: healthStatus.rows,
      averageHealthScore: parseFloat(avgHealth.rows[0]?.avg_score || '100'),
      totalActiveAlerts: parseInt(activeAlerts.rows[0]?.count || '0'),
      alertsBySeverity,
      predictedFailuresNext7Days: 0, // TODO: Implement
      predictedFailuresNext30Days: 0,
      predictedFailuresNext90Days: 0,
      activeRecommendations: 0,
      potentialAnnualSavings: 0,
      averageRoi: 0,
      totalModelsDeployed: 0,
      averageModelAccuracy: 0,
      recentAlerts: [],
      recentHealthScores: [],
      upcomingMaintenance: [],
      asOfTimestamp: new Date(),
    };
  }

  // ============================================
  // MUTATIONS
  // ============================================

  @Mutation()
  async calculateEquipmentHealthScore(
    @Args('workCenterId') workCenterId: string,
    @Context() context: any,
  ): Promise<any> {
    const tenantId = context?.req?.tenantId || 'default-tenant';
    const facilityId = context?.req?.facilityId || 'default-facility';

    const healthScore = await this.healthScoreService.calculateHealthScore(
      tenantId,
      facilityId,
      workCenterId,
    );

    // Generate alert if health score is concerning
    if (healthScore.overallHealthScore < 70) {
      await this.alertService.generateAlertFromHealthScore(
        tenantId,
        facilityId,
        workCenterId,
        healthScore.overallHealthScore,
        healthScore.riskFactors,
      );
    }

    return healthScore;
  }

  @Mutation()
  async acknowledgePredictiveMaintenanceAlert(
    @Args('alertId') alertId: string,
    @Args('notes') notes?: string,
    @Context() context?: any,
  ): Promise<any> {
    const userId = context?.req?.userId || 'default-user';

    await this.alertService.acknowledgeAlert(alertId, userId, notes);

    return this.predictiveMaintenanceAlert(alertId);
  }

  @Mutation()
  async resolvePredictiveMaintenanceAlert(
    @Args('alertId') alertId: string,
    @Args('resolutionType') resolutionType: string,
    @Args('actualFailureOccurred') actualFailureOccurred: boolean,
    @Args('actualFailureDate') actualFailureDate?: Date,
    @Args('notes') notes?: string,
    @Context() context?: any,
  ): Promise<any> {
    const userId = context?.req?.userId || 'default-user';

    await this.alertService.resolveAlert(
      alertId,
      userId,
      resolutionType,
      actualFailureOccurred,
      notes,
    );

    return this.predictiveMaintenanceAlert(alertId);
  }

  // ============================================
  // MODEL QUERIES & MUTATIONS
  // ============================================

  @Query()
  async predictiveMaintenanceModels(
    @Args('modelType') modelType?: string,
    @Args('deploymentStatus') deploymentStatus?: string,
    @Args('isActive') isActive?: boolean,
    @Context() context?: any,
  ): Promise<any[]> {
    const tenantId = context?.req?.tenantId || 'default-tenant';

    return this.modelService.getModels(tenantId, {
      modelType,
      deploymentStatus,
      isActive,
    });
  }

  @Query()
  async predictiveMaintenanceModel(@Args('id') id: string): Promise<any> {
    return this.modelService.getModel(id);
  }

  @Mutation()
  async createPredictiveMaintenanceModel(
    @Args('input') input: any,
    @Context() context: any,
  ): Promise<any> {
    const tenantId = context?.req?.tenantId || 'default-tenant';
    const facilityId = context?.req?.facilityId || null;

    return this.modelService.createModel({
      tenantId,
      facilityId,
      ...input,
    });
  }

  @Mutation()
  async updatePredictiveMaintenanceModel(
    @Args('id') id: string,
    @Args('input') input: any,
  ): Promise<any> {
    return this.modelService.updateModel(id, input);
  }

  @Mutation()
  async deployPredictiveMaintenanceModel(
    @Args('id') id: string,
    @Args('environment') environment: string,
    @Context() context: any,
  ): Promise<any> {
    const userId = context?.req?.userId || 'default-user';

    return this.modelService.deployModel(id, environment, userId);
  }

  @Mutation()
  async retrainPredictiveMaintenanceModel(
    @Args('id') id: string,
    @Args('trainingDataStart') trainingDataStart: Date,
    @Args('trainingDataEnd') trainingDataEnd: Date,
  ): Promise<any> {
    // Record training initiated
    await this.modelService.recordTraining(id, trainingDataStart, trainingDataEnd, 0, {});

    // In production, this would trigger an ML training pipeline
    // For now, we just return the model
    return this.modelService.getModel(id);
  }

  // ============================================
  // RECOMMENDATION QUERIES & MUTATIONS
  // ============================================

  @Query()
  async maintenanceRecommendations(
    @Args('workCenterId') workCenterId?: string,
    @Args('facilityId') facilityId?: string,
    @Args('recommendationType') recommendationType?: string,
    @Args('approvalStatus') approvalStatus?: string,
    @Args('implementationStatus') implementationStatus?: string,
    @Args('limit') limit?: number,
    @Context() context?: any,
  ): Promise<any[]> {
    const tenantId = context?.req?.tenantId || 'default-tenant';

    return this.recommendationService.getRecommendations(tenantId, {
      workCenterId,
      facilityId,
      recommendationType,
      approvalStatus,
      implementationStatus,
      limit,
    });
  }

  @Query()
  async maintenanceRecommendation(@Args('id') id: string): Promise<any> {
    return this.recommendationService.getRecommendation(id);
  }

  @Mutation()
  async createMaintenanceRecommendation(
    @Args('input') input: any,
    @Context() context: any,
  ): Promise<any> {
    const tenantId = context?.req?.tenantId || 'default-tenant';
    const facilityId = context?.req?.facilityId || 'default-facility';

    return this.recommendationService.createRecommendation({
      tenantId,
      facilityId,
      ...input,
    });
  }

  @Mutation()
  async approveMaintenanceRecommendation(
    @Args('id') id: string,
    @Args('notes') notes?: string,
    @Context() context?: any,
  ): Promise<any> {
    const userId = context?.req?.userId || 'default-user';

    return this.recommendationService.approveRecommendation(id, userId, notes);
  }

  @Mutation()
  async rejectMaintenanceRecommendation(
    @Args('id') id: string,
    @Args('reason') reason: string,
    @Context() context?: any,
  ): Promise<any> {
    const userId = context?.req?.userId || 'default-user';

    return this.recommendationService.rejectRecommendation(id, userId, reason);
  }

  @Mutation()
  async implementMaintenanceRecommendation(
    @Args('id') id: string,
    @Args('startDate') startDate?: Date,
    @Context() context?: any,
  ): Promise<any> {
    const userId = context?.req?.userId || 'default-user';

    return this.recommendationService.startImplementation(id, userId, startDate);
  }

  @Mutation()
  async validateMaintenanceRecommendation(
    @Args('id') id: string,
    @Args('actualCostSavings') actualCostSavings?: number,
    @Args('actualDowntimeReductionHours') actualDowntimeReductionHours?: number,
    @Args('actualFailureReductionPercent') actualFailureReductionPercent?: number,
    @Args('notes') notes?: string,
  ): Promise<any> {
    return this.recommendationService.validateRecommendation(id, {
      actualCostSavings,
      actualDowntimeReductionHours,
      actualFailureReductionPercent,
      notes,
    });
  }

  // ============================================
  // ANALYTICS QUERIES
  // ============================================

  @Query()
  async equipmentHealthTrends(
    @Args('workCenterId') workCenterId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Args('aggregation') aggregation?: string,
  ): Promise<any[]> {
    return this.healthScoreService.getHealthScoreTrends(workCenterId, startDate, endDate);
  }

  @Query()
  async failurePredictionAccuracy(
    @Args('modelId') modelId?: string,
    @Args('startDate') startDate?: Date,
    @Args('endDate') endDate?: Date,
  ): Promise<any> {
    // TODO: Implement model accuracy tracking
    return {
      modelId,
      modelName: 'Default Model',
      totalPredictions: 0,
      accuratePredictions: 0,
      earlyPredictions: 0,
      latePredictions: 0,
      incorrectPredictions: 0,
      accuracyPercentage: 0,
      averageErrorHours: 0,
    };
  }
}
