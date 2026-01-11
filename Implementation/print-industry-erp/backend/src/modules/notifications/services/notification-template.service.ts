/**
 * Notification Template Service
 * REQ: REQ-1767925582665-67qxb
 *
 * Manages notification templates and variable substitution.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);

  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * Render a template with variables
   */
  async renderTemplate(
    tenantId: string | null,
    notificationTypeCode: string,
    channel: string,
    variables: Record<string, any>,
  ): Promise<{ subject: string; body: string }> {
    const client = await this.db.connect();

    try {
      if (tenantId) {
        await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
      }

      // 1. Get template (tenant-specific first, then global)
      const result = await client.query(
        `SELECT nt.subject_template, nt.body_template
         FROM notification_templates nt
         JOIN notification_types ntype ON ntype.id = nt.notification_type_id
         WHERE ntype.code = $1
           AND nt.channel = $2
           AND nt.is_active = TRUE
           AND (nt.tenant_id = $3 OR nt.tenant_id IS NULL)
         ORDER BY nt.tenant_id DESC NULLS LAST
         LIMIT 1`,
        [notificationTypeCode, channel, tenantId],
      );

      if (result.rows.length === 0) {
        this.logger.warn(
          `No template found for ${notificationTypeCode}/${channel}, using default`,
        );
        return {
          subject: variables.title || 'Notification',
          body: variables.message || '',
        };
      }

      const template = result.rows[0];

      // 2. Render subject and body with variable substitution
      const subject = this.substituteVariables(
        template.subject_template || '',
        variables,
      );
      const body = this.substituteVariables(template.body_template, variables);

      return { subject, body };
    } finally {
      client.release();
    }
  }

  /**
   * Substitute variables in template
   * Variables are in format {{variableName}}
   */
  private substituteVariables(
    template: string,
    variables: Record<string, any>,
  ): string {
    if (!template) return '';

    let result = template;

    // Replace all {{variableName}} with actual values
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      const replacement = value !== null && value !== undefined ? String(value) : '';
      result = result.replace(regex, replacement);
    }

    // Remove any unreplaced variables
    result = result.replace(/{{[^}]+}}/g, '');

    return result;
  }

  /**
   * Create or update template
   */
  async upsertTemplate(
    tenantId: string | null,
    notificationTypeCode: string,
    channel: string,
    subjectTemplate: string,
    bodyTemplate: string,
    variables: string[],
  ): Promise<string> {
    const client = await this.db.connect();

    try {
      if (tenantId) {
        await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
      }

      // Get notification type ID
      const typeResult = await client.query(
        `SELECT id FROM notification_types WHERE code = $1`,
        [notificationTypeCode],
      );

      if (typeResult.rows.length === 0) {
        throw new Error(`Notification type ${notificationTypeCode} not found`);
      }

      const notificationTypeId = typeResult.rows[0].id;

      // Upsert template
      const result = await client.query(
        `INSERT INTO notification_templates
         (tenant_id, notification_type_id, channel, subject_template, body_template, variables)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, notification_type_id, channel)
         DO UPDATE SET
           subject_template = EXCLUDED.subject_template,
           body_template = EXCLUDED.body_template,
           variables = EXCLUDED.variables,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          tenantId,
          notificationTypeId,
          channel,
          subjectTemplate,
          bodyTemplate,
          JSON.stringify(variables),
        ],
      );

      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  /**
   * Get template by notification type and channel
   */
  async getTemplate(
    tenantId: string | null,
    notificationTypeCode: string,
    channel: string,
  ): Promise<any> {
    const client = await this.db.connect();

    try {
      if (tenantId) {
        await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
      }

      const result = await client.query(
        `SELECT nt.*
         FROM notification_templates nt
         JOIN notification_types ntype ON ntype.id = nt.notification_type_id
         WHERE ntype.code = $1
           AND nt.channel = $2
           AND (nt.tenant_id = $3 OR nt.tenant_id IS NULL)
         ORDER BY nt.tenant_id DESC NULLS LAST
         LIMIT 1`,
        [notificationTypeCode, channel, tenantId],
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } finally {
      client.release();
    }
  }
}
