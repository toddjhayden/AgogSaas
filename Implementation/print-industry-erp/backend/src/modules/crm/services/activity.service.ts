/**
 * Activity Service
 *
 * Handles CRM activity tracking including:
 * - Activity logging (calls, emails, meetings, demos)
 * - Timeline tracking
 * - Engagement metrics
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import {
  Activity,
  CreateActivityInput,
} from '../interfaces/crm.interfaces';

@Injectable()
export class ActivityService {
  constructor(private readonly pool: Pool) {}

  /**
   * Create a new activity
   */
  async createActivity(
    tenantId: string,
    userId: string,
    input: CreateActivityInput,
  ): Promise<Activity> {
    const query = `
      INSERT INTO crm_activities (
        tenant_id,
        activity_type,
        activity_subject,
        activity_description,
        opportunity_id,
        contact_id,
        customer_id,
        activity_date,
        duration_minutes,
        owner_user_id,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      tenantId,
      input.activityType,
      input.activitySubject,
      input.activityDescription || null,
      input.opportunityId || null,
      input.contactId || null,
      input.customerId || null,
      input.activityDate || new Date(),
      input.durationMinutes || null,
      input.ownerUserId,
      userId,
    ];

    const result = await this.pool.query(query, values);
    const activity = this.mapRowToActivity(result.rows[0]);

    // Update last activity dates on related records
    if (input.opportunityId) {
      await this.updateOpportunityLastActivity(tenantId, input.opportunityId);
    }
    if (input.contactId) {
      await this.updateContactLastActivity(tenantId, input.contactId, input.activityType);
    }

    return activity;
  }

  /**
   * Get activity by ID
   */
  async getActivityById(tenantId: string, activityId: string): Promise<Activity> {
    const query = `
      SELECT *
      FROM crm_activities
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
    `;

    const result = await this.pool.query(query, [tenantId, activityId]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Activity with ID ${activityId} not found`);
    }

    return this.mapRowToActivity(result.rows[0]);
  }

  /**
   * Get activities for an opportunity
   */
  async getActivitiesByOpportunity(
    tenantId: string,
    opportunityId: string,
  ): Promise<Activity[]> {
    const query = `
      SELECT *
      FROM crm_activities
      WHERE tenant_id = $1
        AND opportunity_id = $2
        AND deleted_at IS NULL
      ORDER BY activity_date DESC
    `;

    const result = await this.pool.query(query, [tenantId, opportunityId]);
    return result.rows.map(row => this.mapRowToActivity(row));
  }

  /**
   * Get activities for a contact
   */
  async getActivitiesByContact(
    tenantId: string,
    contactId: string,
  ): Promise<Activity[]> {
    const query = `
      SELECT *
      FROM crm_activities
      WHERE tenant_id = $1
        AND contact_id = $2
        AND deleted_at IS NULL
      ORDER BY activity_date DESC
    `;

    const result = await this.pool.query(query, [tenantId, contactId]);
    return result.rows.map(row => this.mapRowToActivity(row));
  }

  /**
   * Get activities for a customer
   */
  async getActivitiesByCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<Activity[]> {
    const query = `
      SELECT *
      FROM crm_activities
      WHERE tenant_id = $1
        AND customer_id = $2
        AND deleted_at IS NULL
      ORDER BY activity_date DESC
    `;

    const result = await this.pool.query(query, [tenantId, customerId]);
    return result.rows.map(row => this.mapRowToActivity(row));
  }

  /**
   * Get activities by owner (sales rep)
   */
  async getActivitiesByOwner(
    tenantId: string,
    ownerUserId: string,
    limit = 50,
  ): Promise<Activity[]> {
    const query = `
      SELECT *
      FROM crm_activities
      WHERE tenant_id = $1
        AND owner_user_id = $2
        AND deleted_at IS NULL
      ORDER BY activity_date DESC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [tenantId, ownerUserId, limit]);
    return result.rows.map(row => this.mapRowToActivity(row));
  }

  /**
   * Get recent activities across all entities
   */
  async getRecentActivities(
    tenantId: string,
    ownerUserId?: string,
    limit = 20,
  ): Promise<Activity[]> {
    let query = `
      SELECT *
      FROM crm_activities
      WHERE tenant_id = $1
        AND deleted_at IS NULL
    `;

    const values: any[] = [tenantId];

    if (ownerUserId) {
      query += ` AND owner_user_id = $2`;
      values.push(ownerUserId);
      query += ` ORDER BY activity_date DESC LIMIT $3`;
      values.push(limit);
    } else {
      query += ` ORDER BY activity_date DESC LIMIT $2`;
      values.push(limit);
    }

    const result = await this.pool.query(query, values);
    return result.rows.map(row => this.mapRowToActivity(row));
  }

  /**
   * Mark activity as completed
   */
  async markActivityCompleted(
    tenantId: string,
    activityId: string,
    userId: string,
    outcome?: string,
    nextSteps?: string,
  ): Promise<Activity> {
    const query = `
      UPDATE crm_activities
      SET is_completed = TRUE,
          outcome = COALESCE($4, outcome),
          next_steps = COALESCE($5, next_steps),
          updated_at = NOW(),
          updated_by = $3
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      tenantId,
      activityId,
      userId,
      outcome || null,
      nextSteps || null,
    ]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Activity with ID ${activityId} not found`);
    }

    return this.mapRowToActivity(result.rows[0]);
  }

  /**
   * Track email engagement
   */
  async trackEmailEngagement(
    tenantId: string,
    activityId: string,
    eventType: 'opened' | 'clicked',
  ): Promise<void> {
    const field = eventType === 'opened' ? 'email_opened' : 'email_clicked';

    const query = `
      UPDATE crm_activities
      SET ${field} = TRUE,
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
    `;

    await this.pool.query(query, [tenantId, activityId]);
  }

  /**
   * Get activity summary for a time period
   */
  async getActivitySummary(
    tenantId: string,
    ownerUserId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const query = `
      SELECT
        activity_type,
        COUNT(*) AS activity_count,
        SUM(duration_minutes) AS total_minutes,
        COUNT(*) FILTER (WHERE is_completed = TRUE) AS completed_count
      FROM crm_activities
      WHERE tenant_id = $1
        AND owner_user_id = $2
        AND activity_date >= $3
        AND activity_date <= $4
        AND deleted_at IS NULL
      GROUP BY activity_type
      ORDER BY activity_count DESC
    `;

    const result = await this.pool.query(query, [
      tenantId,
      ownerUserId,
      startDate,
      endDate,
    ]);

    return result.rows;
  }

  /**
   * Update opportunity last activity
   */
  private async updateOpportunityLastActivity(
    tenantId: string,
    opportunityId: string,
  ): Promise<void> {
    const query = `
      UPDATE crm_opportunities
      SET last_activity_date = NOW(),
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
    `;

    await this.pool.query(query, [tenantId, opportunityId]);
  }

  /**
   * Update contact last activity
   */
  private async updateContactLastActivity(
    tenantId: string,
    contactId: string,
    activityType: string,
  ): Promise<void> {
    const query = `
      UPDATE crm_contacts
      SET last_contact_date = NOW(),
          last_contact_type = $3,
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
    `;

    await this.pool.query(query, [tenantId, contactId, activityType]);
  }

  /**
   * Soft delete activity
   */
  async deleteActivity(
    tenantId: string,
    activityId: string,
    userId: string,
  ): Promise<void> {
    const query = `
      UPDATE crm_activities
      SET deleted_at = NOW(),
          deleted_by = $3
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
    `;

    const result = await this.pool.query(query, [tenantId, activityId, userId]);

    if (result.rowCount === 0) {
      throw new NotFoundException(`Activity with ID ${activityId} not found`);
    }
  }

  /**
   * Map database row to Activity interface
   */
  private mapRowToActivity(row: any): Activity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      activityType: row.activity_type,
      activitySubject: row.activity_subject,
      activityDescription: row.activity_description,
      opportunityId: row.opportunity_id,
      contactId: row.contact_id,
      customerId: row.customer_id,
      activityDate: row.activity_date,
      durationMinutes: row.duration_minutes,
      location: row.location,
      attendees: row.attendees,
      externalAttendees: row.external_attendees,
      outcome: row.outcome,
      nextSteps: row.next_steps,
      emailSent: row.email_sent,
      emailOpened: row.email_opened,
      emailClicked: row.email_clicked,
      ownerUserId: row.owner_user_id,
      attachmentUrls: row.attachment_urls,
      isCompleted: row.is_completed,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
    };
  }
}
