/**
 * Opportunity Service
 *
 * Handles CRM opportunity (sales pipeline) management including:
 * - Opportunity CRUD operations
 * - Pipeline stage movement tracking
 * - Weighted value calculations
 * - Win/loss analysis
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import {
  Opportunity,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  OpportunityStageHistory,
} from '../interfaces/crm.interfaces';

@Injectable()
export class OpportunityService {
  constructor(private readonly pool: Pool) {}

  /**
   * Create a new opportunity
   */
  async createOpportunity(
    tenantId: string,
    userId: string,
    input: CreateOpportunityInput,
  ): Promise<Opportunity> {
    // Generate opportunity number
    const opportunityNumber = await this.generateOpportunityNumber(tenantId);

    const query = `
      INSERT INTO crm_opportunities (
        tenant_id,
        opportunity_number,
        opportunity_name,
        description,
        customer_id,
        primary_contact_id,
        pipeline_stage_id,
        estimated_value,
        currency_code,
        expected_close_date,
        opportunity_type,
        lead_source,
        owner_user_id,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      tenantId,
      opportunityNumber,
      input.opportunityName,
      input.description || null,
      input.customerId || null,
      input.primaryContactId || null,
      input.pipelineStageId,
      input.estimatedValue,
      input.currencyCode || 'USD',
      input.expectedCloseDate || null,
      input.opportunityType || null,
      input.leadSource || null,
      input.ownerUserId,
      userId,
    ];

    const result = await this.pool.query(query, values);
    const opportunity = this.mapRowToOpportunity(result.rows[0]);

    // Record initial stage history
    await this.recordStageChange(
      tenantId,
      opportunity.id,
      null,
      input.pipelineStageId,
      userId,
      'Initial stage',
    );

    return opportunity;
  }

  /**
   * Update an existing opportunity
   */
  async updateOpportunity(
    tenantId: string,
    userId: string,
    input: UpdateOpportunityInput,
  ): Promise<Opportunity> {
    // Get current opportunity to check for stage change
    const currentOpp = await this.getOpportunityById(tenantId, input.id);

    const updates: string[] = [];
    const values: any[] = [tenantId, input.id];
    let paramCount = 3;

    if (input.opportunityName !== undefined) {
      updates.push(`opportunity_name = $${paramCount++}`);
      values.push(input.opportunityName);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(input.description);
    }
    if (input.estimatedValue !== undefined) {
      updates.push(`estimated_value = $${paramCount++}`);
      values.push(input.estimatedValue);
    }
    if (input.probabilityPercentage !== undefined) {
      updates.push(`probability_percentage = $${paramCount++}`);
      values.push(input.probabilityPercentage);
    }
    if (input.expectedCloseDate !== undefined) {
      updates.push(`expected_close_date = $${paramCount++}`);
      values.push(input.expectedCloseDate);
    }
    if (input.nextActionDate !== undefined) {
      updates.push(`next_action_date = $${paramCount++}`);
      values.push(input.nextActionDate);
    }
    if (input.nextActionDescription !== undefined) {
      updates.push(`next_action_description = $${paramCount++}`);
      values.push(input.nextActionDescription);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(input.status);

      if (input.status === 'WON' || input.status === 'LOST') {
        updates.push(`actual_close_date = NOW()`);
      }
    }
    if (input.lostReason !== undefined) {
      updates.push(`lost_reason = $${paramCount++}`);
      values.push(input.lostReason);
    }
    if (input.lostReasonNotes !== undefined) {
      updates.push(`lost_reason_notes = $${paramCount++}`);
      values.push(input.lostReasonNotes);
    }

    // Handle stage change
    if (input.pipelineStageId !== undefined && input.pipelineStageId !== currentOpp.pipelineStageId) {
      updates.push(`pipeline_stage_id = $${paramCount++}`);
      values.push(input.pipelineStageId);
      updates.push(`stage_entered_at = NOW()`);

      // Record stage change
      await this.recordStageChange(
        tenantId,
        input.id,
        currentOpp.pipelineStageId,
        input.pipelineStageId,
        userId,
      );
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramCount++}`);
    values.push(userId);

    const query = `
      UPDATE crm_opportunities
      SET ${updates.join(', ')}
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Opportunity with ID ${input.id} not found`);
    }

    return this.mapRowToOpportunity(result.rows[0]);
  }

  /**
   * Get opportunity by ID
   */
  async getOpportunityById(tenantId: string, opportunityId: string): Promise<Opportunity> {
    const query = `
      SELECT *
      FROM crm_opportunities
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
    `;

    const result = await this.pool.query(query, [tenantId, opportunityId]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Opportunity with ID ${opportunityId} not found`);
    }

    return this.mapRowToOpportunity(result.rows[0]);
  }

  /**
   * Get opportunities by customer
   */
  async getOpportunitiesByCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<Opportunity[]> {
    const query = `
      SELECT o.*
      FROM crm_opportunities o
      WHERE o.tenant_id = $1
        AND o.customer_id = $2
        AND o.deleted_at IS NULL
      ORDER BY o.created_at DESC
    `;

    const result = await this.pool.query(query, [tenantId, customerId]);
    return result.rows.map(row => this.mapRowToOpportunity(row));
  }

  /**
   * Get opportunities by owner (sales rep)
   */
  async getOpportunitiesByOwner(
    tenantId: string,
    ownerUserId: string,
    status?: string,
  ): Promise<Opportunity[]> {
    let query = `
      SELECT o.*
      FROM crm_opportunities o
      WHERE o.tenant_id = $1
        AND o.owner_user_id = $2
        AND o.deleted_at IS NULL
    `;

    const values: any[] = [tenantId, ownerUserId];

    if (status) {
      query += ` AND o.status = $3`;
      values.push(status);
    }

    query += ` ORDER BY o.expected_close_date NULLS LAST, o.created_at DESC`;

    const result = await this.pool.query(query, values);
    return result.rows.map(row => this.mapRowToOpportunity(row));
  }

  /**
   * Get opportunities by pipeline stage
   */
  async getOpportunitiesByStage(
    tenantId: string,
    pipelineStageId: string,
  ): Promise<Opportunity[]> {
    const query = `
      SELECT o.*
      FROM crm_opportunities o
      WHERE o.tenant_id = $1
        AND o.pipeline_stage_id = $2
        AND o.status = 'OPEN'
        AND o.deleted_at IS NULL
      ORDER BY o.estimated_value DESC, o.expected_close_date NULLS LAST
    `;

    const result = await this.pool.query(query, [tenantId, pipelineStageId]);
    return result.rows.map(row => this.mapRowToOpportunity(row));
  }

  /**
   * Get pipeline summary
   */
  async getPipelineSummary(tenantId: string, ownerUserId?: string) {
    let query = `
      SELECT
        s.id AS stage_id,
        s.stage_name,
        s.sequence_number,
        COUNT(o.id) AS opportunity_count,
        COALESCE(SUM(o.estimated_value), 0) AS total_value,
        COALESCE(SUM(o.weighted_value), 0) AS total_weighted_value,
        COALESCE(AVG(o.probability_percentage), 0) AS avg_probability
      FROM crm_pipeline_stages s
      LEFT JOIN crm_opportunities o
        ON s.id = o.pipeline_stage_id
        AND o.tenant_id = s.tenant_id
        AND o.status = 'OPEN'
        AND o.deleted_at IS NULL
    `;

    const values: any[] = [tenantId];

    if (ownerUserId) {
      query += ` AND o.owner_user_id = $2`;
      values.push(ownerUserId);
    }

    query += `
      WHERE s.tenant_id = $1
        AND s.is_active = TRUE
      GROUP BY s.id, s.stage_name, s.sequence_number
      ORDER BY s.sequence_number
    `;

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Get opportunities requiring action
   */
  async getOpportunitiesRequiringAction(
    tenantId: string,
    ownerUserId?: string,
  ): Promise<Opportunity[]> {
    let query = `
      SELECT *
      FROM crm_opportunities_requiring_action
      WHERE tenant_id = $1
    `;

    const values: any[] = [tenantId];

    if (ownerUserId) {
      query += ` AND owner_user_id = $2`;
      values.push(ownerUserId);
    }

    const result = await this.pool.query(query, values);
    return result.rows.map(row => this.mapRowToOpportunity(row));
  }

  /**
   * Get stage history for an opportunity
   */
  async getStageHistory(
    tenantId: string,
    opportunityId: string,
  ): Promise<OpportunityStageHistory[]> {
    const query = `
      SELECT
        h.*,
        fs.stage_name AS from_stage_name,
        ts.stage_name AS to_stage_name
      FROM crm_opportunity_stage_history h
      LEFT JOIN crm_pipeline_stages fs ON h.from_stage_id = fs.id
      INNER JOIN crm_pipeline_stages ts ON h.to_stage_id = ts.id
      WHERE h.tenant_id = $1
        AND h.opportunity_id = $2
      ORDER BY h.stage_changed_at DESC
    `;

    const result = await this.pool.query(query, [tenantId, opportunityId]);
    return result.rows;
  }

  /**
   * Record stage change in history
   */
  private async recordStageChange(
    tenantId: string,
    opportunityId: string,
    fromStageId: string | null,
    toStageId: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    // Calculate days in previous stage
    let daysInPreviousStage: number | null = null;
    if (fromStageId) {
      const daysQuery = `
        SELECT EXTRACT(DAY FROM NOW() - stage_entered_at)::INTEGER AS days
        FROM crm_opportunities
        WHERE id = $1
      `;
      const daysResult = await this.pool.query(daysQuery, [opportunityId]);
      daysInPreviousStage = daysResult.rows[0]?.days || null;
    }

    const query = `
      INSERT INTO crm_opportunity_stage_history (
        tenant_id,
        opportunity_id,
        from_stage_id,
        to_stage_id,
        days_in_previous_stage,
        changed_by_user_id,
        change_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await this.pool.query(query, [
      tenantId,
      opportunityId,
      fromStageId,
      toStageId,
      daysInPreviousStage,
      userId,
      reason || null,
    ]);
  }

  /**
   * Generate unique opportunity number
   */
  private async generateOpportunityNumber(tenantId: string): Promise<string> {
    const prefix = 'OPP';
    const year = new Date().getFullYear();

    const query = `
      SELECT COUNT(*) + 1 AS next_number
      FROM crm_opportunities
      WHERE tenant_id = $1
        AND opportunity_number LIKE $2
    `;

    const result = await this.pool.query(query, [
      tenantId,
      `${prefix}-${year}-%`,
    ]);

    const nextNumber = result.rows[0].next_number;
    return `${prefix}-${year}-${String(nextNumber).padStart(5, '0')}`;
  }

  /**
   * Soft delete opportunity
   */
  async deleteOpportunity(
    tenantId: string,
    opportunityId: string,
    userId: string,
  ): Promise<void> {
    const query = `
      UPDATE crm_opportunities
      SET deleted_at = NOW(),
          deleted_by = $3
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
    `;

    const result = await this.pool.query(query, [tenantId, opportunityId, userId]);

    if (result.rowCount === 0) {
      throw new NotFoundException(`Opportunity with ID ${opportunityId} not found`);
    }
  }

  /**
   * Map database row to Opportunity interface
   */
  private mapRowToOpportunity(row: any): Opportunity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      opportunityNumber: row.opportunity_number,
      opportunityName: row.opportunity_name,
      description: row.description,
      customerId: row.customer_id,
      primaryContactId: row.primary_contact_id,
      pipelineStageId: row.pipeline_stage_id,
      stageEnteredAt: row.stage_entered_at,
      estimatedValue: parseFloat(row.estimated_value),
      currencyCode: row.currency_code,
      probabilityPercentage: row.probability_percentage,
      weightedValue: row.weighted_value ? parseFloat(row.weighted_value) : undefined,
      expectedCloseDate: row.expected_close_date,
      actualCloseDate: row.actual_close_date,
      opportunityType: row.opportunity_type,
      leadSource: row.lead_source,
      productCategories: row.product_categories,
      primaryProductId: row.primary_product_id,
      competitors: row.competitors,
      ourCompetitiveAdvantage: row.our_competitive_advantage,
      decisionMakers: row.decision_makers,
      decisionCriteria: row.decision_criteria,
      budgetConfirmed: row.budget_confirmed,
      authorityConfirmed: row.authority_confirmed,
      needConfirmed: row.need_confirmed,
      timelineConfirmed: row.timeline_confirmed,
      ownerUserId: row.owner_user_id,
      teamMembers: row.team_members,
      lastActivityDate: row.last_activity_date,
      nextActionDate: row.next_action_date,
      nextActionDescription: row.next_action_description,
      status: row.status,
      lostReason: row.lost_reason,
      lostReasonNotes: row.lost_reason_notes,
      quoteId: row.quote_id,
      salesOrderId: row.sales_order_id,
      tags: row.tags,
      customFields: row.custom_fields,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
    };
  }
}
