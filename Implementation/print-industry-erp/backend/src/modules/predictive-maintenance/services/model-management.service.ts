/**
 * Predictive Maintenance Model Management Service
 * REQ: REQ-STRATEGIC-AUTO-1767108044310
 *
 * Manages ML models for predictive maintenance:
 * - Model creation and versioning
 * - Model deployment and lifecycle
 * - Performance monitoring
 * - Retraining workflows
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../common/database/database.service';

export interface ModelMetrics {
  accuracyScore?: number;
  precisionScore?: number;
  recallScore?: number;
  f1Score?: number;
  aucRoc?: number;
  meanAbsoluteError?: number;
  falsePositiveRate?: number;
  falseNegativeRate?: number;
}

export interface CreateModelInput {
  tenantId: string;
  facilityId?: string;
  modelCode: string;
  modelName: string;
  modelType: string;
  algorithm: string;
  workCenterId?: string;
  workCenterType?: string;
  failureMode?: string;
  predictionHorizonHours: number;
  modelParameters: any;
  featureSet: any[];
  description?: string;
  methodology?: string;
}

@Injectable()
export class ModelManagementService {
  private readonly logger = new Logger(ModelManagementService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new predictive maintenance model
   */
  async createModel(input: CreateModelInput): Promise<any> {
    this.logger.log(`Creating model: ${input.modelName}`);

    const query = `
      INSERT INTO predictive_maintenance_models (
        tenant_id, facility_id, model_code, model_name,
        model_type, algorithm, work_center_id, work_center_type,
        failure_mode, prediction_horizon_hours,
        model_parameters, feature_set,
        model_version, deployment_status,
        description, methodology, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      input.tenantId,
      input.facilityId || null,
      input.modelCode,
      input.modelName,
      input.modelType,
      input.algorithm,
      input.workCenterId || null,
      input.workCenterType || null,
      input.failureMode || null,
      input.predictionHorizonHours,
      JSON.stringify(input.modelParameters),
      JSON.stringify(input.featureSet),
      '1.0.0',
      'DEVELOPMENT',
      input.description || null,
      input.methodology || null,
      true,
    ]);

    return result.rows[0];
  }

  /**
   * Update model metadata
   */
  async updateModel(
    modelId: string,
    updates: {
      modelName?: string;
      modelParameters?: any;
      featureSet?: any[];
      description?: string;
      methodology?: string;
      isActive?: boolean;
    },
  ): Promise<any> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.modelName !== undefined) {
      updateFields.push(`model_name = $${paramIndex++}`);
      values.push(updates.modelName);
    }

    if (updates.modelParameters !== undefined) {
      updateFields.push(`model_parameters = $${paramIndex++}`);
      values.push(JSON.stringify(updates.modelParameters));
    }

    if (updates.featureSet !== undefined) {
      updateFields.push(`feature_set = $${paramIndex++}`);
      values.push(JSON.stringify(updates.featureSet));
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (updates.methodology !== undefined) {
      updateFields.push(`methodology = $${paramIndex++}`);
      values.push(updates.methodology);
    }

    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = NOW()`);

    const query = `
      UPDATE predictive_maintenance_models
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(modelId);

    const result = await this.db.query(query, values);

    if (!result.rows || result.rows.length === 0) {
      throw new NotFoundException(`Model ${modelId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Deploy model to an environment
   */
  async deployModel(
    modelId: string,
    environment: string,
    deployedByUserId: string,
  ): Promise<any> {
    this.logger.log(`Deploying model ${modelId} to ${environment}`);

    // If deploying to production, deactivate other production models
    if (environment === 'PRODUCTION') {
      await this.deactivateProductionModels(modelId);
    }

    const query = `
      UPDATE predictive_maintenance_models
      SET deployment_status = $1,
          deployed_at = NOW(),
          deployed_by_user_id = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const result = await this.db.query(query, [environment, deployedByUserId, modelId]);

    if (!result.rows || result.rows.length === 0) {
      throw new NotFoundException(`Model ${modelId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Deactivate other production models
   */
  private async deactivateProductionModels(excludeModelId: string): Promise<void> {
    const query = `
      UPDATE predictive_maintenance_models
      SET deployment_status = 'DEPRECATED',
          is_active = FALSE,
          updated_at = NOW()
      WHERE deployment_status = 'PRODUCTION'
        AND id != $1
    `;

    await this.db.query(query, [excludeModelId]);
  }

  /**
   * Record model training
   */
  async recordTraining(
    modelId: string,
    trainingDataStart: Date,
    trainingDataEnd: Date,
    trainingSampleCount: number,
    metrics: ModelMetrics,
  ): Promise<void> {
    const query = `
      UPDATE predictive_maintenance_models
      SET training_data_start = $1,
          training_data_end = $2,
          training_sample_count = $3,
          accuracy_score = $4,
          precision_score = $5,
          recall_score = $6,
          f1_score = $7,
          auc_roc = $8,
          mean_absolute_error = $9,
          false_positive_rate = $10,
          false_negative_rate = $11,
          last_retrained_at = NOW(),
          updated_at = NOW()
      WHERE id = $12
    `;

    await this.db.query(query, [
      trainingDataStart,
      trainingDataEnd,
      trainingSampleCount,
      metrics.accuracyScore || null,
      metrics.precisionScore || null,
      metrics.recallScore || null,
      metrics.f1Score || null,
      metrics.aucRoc || null,
      metrics.meanAbsoluteError || null,
      metrics.falsePositiveRate || null,
      metrics.falseNegativeRate || null,
      modelId,
    ]);
  }

  /**
   * Record prediction for model performance tracking
   */
  async recordPrediction(modelId: string): Promise<void> {
    const query = `
      UPDATE predictive_maintenance_models
      SET last_prediction_at = NOW(),
          prediction_count_total = COALESCE(prediction_count_total, 0) + 1,
          updated_at = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [modelId]);
  }

  /**
   * Get model by ID
   */
  async getModel(modelId: string): Promise<any> {
    const query = `
      SELECT *
      FROM predictive_maintenance_models
      WHERE id = $1
    `;

    const result = await this.db.query(query, [modelId]);

    if (!result.rows || result.rows.length === 0) {
      throw new NotFoundException(`Model ${modelId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Get models by criteria
   */
  async getModels(
    tenantId: string,
    filters?: {
      modelType?: string;
      deploymentStatus?: string;
      isActive?: boolean;
    },
  ): Promise<any[]> {
    let query = `
      SELECT *
      FROM predictive_maintenance_models
      WHERE tenant_id = $1
    `;

    const params: any[] = [tenantId];

    if (filters?.modelType) {
      params.push(filters.modelType);
      query += ` AND model_type = $${params.length}`;
    }

    if (filters?.deploymentStatus) {
      params.push(filters.deploymentStatus);
      query += ` AND deployment_status = $${params.length}`;
    }

    if (filters?.isActive !== undefined) {
      params.push(filters.isActive);
      query += ` AND is_active = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get production model for a work center
   */
  async getProductionModelForWorkCenter(
    tenantId: string,
    workCenterId: string,
  ): Promise<any | null> {
    const query = `
      SELECT *
      FROM predictive_maintenance_models
      WHERE tenant_id = $1
        AND work_center_id = $2
        AND deployment_status = 'PRODUCTION'
        AND is_active = TRUE
      ORDER BY deployed_at DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [tenantId, workCenterId]);
    return result.rows[0] || null;
  }
}
