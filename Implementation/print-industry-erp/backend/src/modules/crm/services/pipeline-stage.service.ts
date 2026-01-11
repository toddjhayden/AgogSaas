/**
 * Pipeline Stage Service
 *
 * Handles sales pipeline stage configuration and management
 */

import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PipelineStage } from '../interfaces/crm.interfaces';

@Injectable()
export class PipelineStageService {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /**
   * Get all pipeline stages for a tenant
   */
  async getPipelineStages(tenantId: string): Promise<PipelineStage[]> {
    const query = `
      SELECT *
      FROM crm_pipeline_stages
      WHERE tenant_id = $1
        AND is_active = TRUE
      ORDER BY sequence_number
    `;

    const result = await this.pool.query(query, [tenantId]);
    return result.rows.map(row => this.mapRowToPipelineStage(row));
  }

  /**
   * Get pipeline stage by ID
   */
  async getPipelineStageById(
    tenantId: string,
    stageId: string,
  ): Promise<PipelineStage> {
    const query = `
      SELECT *
      FROM crm_pipeline_stages
      WHERE tenant_id = $1
        AND id = $2
    `;

    const result = await this.pool.query(query, [tenantId, stageId]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Pipeline stage with ID ${stageId} not found`);
    }

    return this.mapRowToPipelineStage(result.rows[0]);
  }

  /**
   * Initialize default pipeline stages for a new tenant
   */
  async initializeDefaultStages(tenantId: string, userId: string): Promise<void> {
    const defaultStages = [
      {
        name: 'Lead',
        description: 'Initial contact or inquiry',
        sequence: 1,
        probability: 10,
      },
      {
        name: 'Qualified',
        description: 'Lead has been qualified (BANT)',
        sequence: 2,
        probability: 20,
      },
      {
        name: 'Needs Analysis',
        description: 'Understanding customer requirements',
        sequence: 3,
        probability: 30,
      },
      {
        name: 'Proposal',
        description: 'Proposal or quote submitted',
        sequence: 4,
        probability: 50,
      },
      {
        name: 'Negotiation',
        description: 'In active negotiation',
        sequence: 5,
        probability: 70,
      },
      {
        name: 'Closed Won',
        description: 'Deal won',
        sequence: 6,
        probability: 100,
        isClosedWon: true,
      },
      {
        name: 'Closed Lost',
        description: 'Deal lost',
        sequence: 7,
        probability: 0,
        isClosedLost: true,
      },
    ];

    for (const stage of defaultStages) {
      const query = `
        INSERT INTO crm_pipeline_stages (
          tenant_id,
          stage_name,
          stage_description,
          sequence_number,
          probability_percentage,
          is_closed_won,
          is_closed_lost,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      await this.pool.query(query, [
        tenantId,
        stage.name,
        stage.description,
        stage.sequence,
        stage.probability,
        stage.isClosedWon || false,
        stage.isClosedLost || false,
        userId,
      ]);
    }
  }

  /**
   * Map database row to PipelineStage interface
   */
  private mapRowToPipelineStage(row: any): PipelineStage {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      stageName: row.stage_name,
      stageDescription: row.stage_description,
      sequenceNumber: row.sequence_number,
      probabilityPercentage: row.probability_percentage,
      isClosedWon: row.is_closed_won,
      isClosedLost: row.is_closed_lost,
      requiredFields: row.required_fields,
      autoActions: row.auto_actions,
      targetDaysInStage: row.target_days_in_stage,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
  }
}
