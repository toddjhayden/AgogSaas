/**
 * Security Audit Mutations Service
 * REQ-1767924916114-xhhll - Comprehensive Audit Logging
 *
 * Handles all mutation operations for security audit system:
 * - Security incident management (create, update)
 * - Threat pattern management (upsert, toggle)
 * - Manual security event logging
 * - Compliance audit entry creation
 *
 * SECURITY:
 * - All operations require tenant_id validation
 * - User context required for audit trail (created_by_user_id, updated_by_user_id)
 * - RLS policies enforce tenant isolation
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';

@Injectable()
export class SecurityAuditMutationsService {
  private readonly logger = new Logger(SecurityAuditMutationsService.name);

  constructor(
    @Inject('DATABASE_POOL')
    private readonly pool: Pool,
  ) {}

  /**
   * Create a new security incident
   */
  async createSecurityIncident(
    tenantId: number,
    input: {
      title: string;
      description: string;
      incidentType: string;
      severity: string;
      relatedEventIds?: number[];
      affectedUsers?: number[];
      affectedResources?: string[];
      estimatedImpact?: string;
      assignedToUserId?: number;
    },
    userId: number,
  ): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Generate incident number: INC-YYYYMMDD-NNNN
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countResult = await client.query(
        `SELECT COUNT(*) FROM security_incidents WHERE tenant_id = $1 AND incident_number LIKE $2`,
        [tenantId, `INC-${datePrefix}-%`],
      );
      const count = parseInt(countResult.rows[0].count) + 1;
      const incidentNumber = `INC-${datePrefix}-${String(count).padStart(4, '0')}`;

      const query = `
        INSERT INTO security_incidents (
          tenant_id,
          incident_number,
          title,
          description,
          incident_type,
          severity,
          status,
          related_event_ids,
          affected_users,
          affected_resources,
          estimated_impact,
          assigned_to_user_id,
          detected_at,
          created_by_user_id,
          updated_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $13)
        RETURNING *
      `;

      const result = await client.query(query, [
        tenantId,
        incidentNumber,
        input.title,
        input.description,
        input.incidentType,
        input.severity,
        'OPEN', // Initial status
        input.relatedEventIds || [],
        input.affectedUsers || [],
        input.affectedResources || [],
        input.estimatedImpact || null,
        input.assignedToUserId || null,
        userId,
      ]);

      await client.query('COMMIT');

      this.logger.log(`Created security incident: ${incidentNumber} by user ${userId} in tenant ${tenantId}`);

      return this.mapIncident(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create security incident: ${error.message}`, {
        tenantId,
        userId,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update an existing security incident
   */
  async updateSecurityIncident(
    tenantId: number,
    id: number,
    input: {
      title?: string;
      description?: string;
      status?: string;
      severity?: string;
      assignedToUserId?: number;
      resolutionNotes?: string;
      remediationActions?: any;
    },
    userId: number,
  ): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Build dynamic UPDATE query
      const updates: string[] = [];
      const params: any[] = [id, tenantId];
      let paramIndex = 3;

      if (input.title !== undefined) {
        updates.push(`title = $${paramIndex}`);
        params.push(input.title);
        paramIndex++;
      }

      if (input.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(input.description);
        paramIndex++;
      }

      if (input.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        params.push(input.status);
        paramIndex++;

        // Set status-specific timestamps
        if (input.status === 'INVESTIGATING') {
          updates.push(`acknowledged_at = NOW()`);
        } else if (['RESOLVED', 'FALSE_POSITIVE', 'CLOSED'].includes(input.status)) {
          updates.push(`resolved_at = NOW()`);
        }
      }

      if (input.severity !== undefined) {
        updates.push(`severity = $${paramIndex}`);
        params.push(input.severity);
        paramIndex++;
      }

      if (input.assignedToUserId !== undefined) {
        updates.push(`assigned_to_user_id = $${paramIndex}`);
        params.push(input.assignedToUserId);
        paramIndex++;
      }

      if (input.resolutionNotes !== undefined) {
        updates.push(`resolution_notes = $${paramIndex}`);
        params.push(input.resolutionNotes);
        paramIndex++;
      }

      if (input.remediationActions !== undefined) {
        updates.push(`remediation_actions = $${paramIndex}`);
        params.push(JSON.stringify(input.remediationActions));
        paramIndex++;
      }

      // Always update updated_by and updated_at
      updates.push(`updated_by_user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
      updates.push(`updated_at = NOW()`);

      if (updates.length === 2) {
        // Only updated_by and updated_at, no actual changes
        throw new BadRequestException('No fields to update');
      }

      const query = `
        UPDATE security_incidents
        SET ${updates.join(', ')}
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `;

      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        throw new NotFoundException(`Security incident ${id} not found`);
      }

      await client.query('COMMIT');

      this.logger.log(`Updated security incident ${id} by user ${userId} in tenant ${tenantId}`);

      return this.mapIncident(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to update security incident ${id}: ${error.message}`, {
        tenantId,
        userId,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Upsert (create or update) a threat pattern
   */
  async upsertThreatPattern(
    tenantId: number,
    input: {
      id?: number;
      patternName: string;
      patternDescription: string;
      severity: string;
      detectionRules: any;
      autoBlock: boolean;
      alertChannels?: string[];
      enabled?: boolean;
    },
    userId: number,
  ): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      if (input.id) {
        // UPDATE existing pattern
        const query = `
          UPDATE security_threat_patterns
          SET
            pattern_name = $1,
            pattern_description = $2,
            severity = $3,
            detection_rules = $4,
            auto_block = $5,
            alert_channels = $6,
            enabled = $7,
            updated_by_user_id = $8,
            updated_at = NOW()
          WHERE id = $9 AND tenant_id = $10
          RETURNING *
        `;

        const result = await client.query(query, [
          input.patternName,
          input.patternDescription,
          input.severity,
          JSON.stringify(input.detectionRules),
          input.autoBlock,
          JSON.stringify(input.alertChannels || []),
          input.enabled !== undefined ? input.enabled : true,
          userId,
          input.id,
          tenantId,
        ]);

        if (result.rows.length === 0) {
          throw new NotFoundException(`Threat pattern ${input.id} not found`);
        }

        await client.query('COMMIT');
        this.logger.log(`Updated threat pattern ${input.id} by user ${userId} in tenant ${tenantId}`);

        return this.mapThreatPattern(result.rows[0]);
      } else {
        // INSERT new pattern
        const query = `
          INSERT INTO security_threat_patterns (
            tenant_id,
            pattern_name,
            pattern_description,
            severity,
            detection_rules,
            auto_block,
            alert_channels,
            enabled,
            created_by_user_id,
            updated_by_user_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
          RETURNING *
        `;

        const result = await client.query(query, [
          tenantId,
          input.patternName,
          input.patternDescription,
          input.severity,
          JSON.stringify(input.detectionRules),
          input.autoBlock,
          JSON.stringify(input.alertChannels || []),
          input.enabled !== undefined ? input.enabled : true,
          userId,
        ]);

        await client.query('COMMIT');
        this.logger.log(`Created threat pattern "${input.patternName}" by user ${userId} in tenant ${tenantId}`);

        return this.mapThreatPattern(result.rows[0]);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to upsert threat pattern: ${error.message}`, {
        tenantId,
        userId,
        patternName: input.patternName,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Toggle threat pattern enabled/disabled state
   */
  async toggleThreatPattern(
    tenantId: number,
    id: number,
    enabled: boolean,
    userId: number,
  ): Promise<any> {
    const client = await this.pool.connect();

    try {
      const query = `
        UPDATE security_threat_patterns
        SET
          enabled = $1,
          updated_by_user_id = $2,
          updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4
        RETURNING *
      `;

      const result = await client.query(query, [enabled, userId, id, tenantId]);

      if (result.rows.length === 0) {
        throw new NotFoundException(`Threat pattern ${id} not found`);
      }

      this.logger.log(`${enabled ? 'Enabled' : 'Disabled'} threat pattern ${id} by user ${userId} in tenant ${tenantId}`);

      return this.mapThreatPattern(result.rows[0]);
    } catch (error) {
      this.logger.error(`Failed to toggle threat pattern ${id}: ${error.message}`, {
        tenantId,
        userId,
        enabled,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Manually log a security event
   */
  async logSecurityEvent(
    tenantId: number,
    input: {
      eventType: string;
      userId?: number;
      username?: string;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      targetResource?: string;
      targetType?: string;
      riskLevel: string;
      success: boolean;
      failureReason?: string;
      metadata?: any;
      correlationId?: string;
    },
    performedByUserId: number,
  ): Promise<any> {
    const client = await this.pool.connect();

    try {
      const query = `
        INSERT INTO security_audit_events (
          tenant_id,
          event_type,
          event_timestamp,
          correlation_id,
          user_id,
          username,
          ip_address,
          user_agent,
          session_id,
          target_resource,
          target_type,
          risk_level,
          success,
          failure_reason,
          metadata,
          anomaly_score,
          flagged_suspicious
        ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

      // Generate correlation_id if not provided
      const correlationId = input.correlationId || this.generateUUID();

      // Simple anomaly scoring (can be enhanced with ML)
      const anomalyScore = this.calculateAnomalyScore(input);
      const flaggedSuspicious = anomalyScore > 70;

      const result = await client.query(query, [
        tenantId,
        input.eventType,
        correlationId,
        input.userId || null,
        input.username || null,
        input.ipAddress || null,
        input.userAgent || null,
        input.sessionId || null,
        input.targetResource || null,
        input.targetType || null,
        input.riskLevel,
        input.success,
        input.failureReason || null,
        JSON.stringify(input.metadata || {}),
        anomalyScore,
        flaggedSuspicious,
      ]);

      this.logger.log(`Logged security event ${input.eventType} by user ${performedByUserId} in tenant ${tenantId}`, {
        eventType: input.eventType,
        riskLevel: input.riskLevel,
        flaggedSuspicious,
      });

      return this.mapSecurityEvent(result.rows[0]);
    } catch (error) {
      this.logger.error(`Failed to log security event: ${error.message}`, {
        tenantId,
        userId: performedByUserId,
        eventType: input.eventType,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Add a compliance audit entry
   */
  async addComplianceAuditEntry(
    tenantId: number,
    input: {
      framework: string;
      controlId: string;
      controlDescription: string;
      eventDescription: string;
      eventType: string;
      evidenceType?: string;
      evidenceLocation?: string;
      evidenceMetadata?: any;
      reviewedByUserId?: number;
      complianceStatus: string;
      findings?: string;
    },
    performedByUserId: number,
  ): Promise<any> {
    const client = await this.pool.connect();

    try {
      const query = `
        INSERT INTO security_compliance_audit (
          tenant_id,
          framework,
          control_id,
          control_description,
          audit_timestamp,
          event_description,
          event_type,
          evidence_type,
          evidence_location,
          evidence_metadata,
          performed_by_user_id,
          reviewed_by_user_id,
          compliance_status,
          findings
        ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const result = await client.query(query, [
        tenantId,
        input.framework,
        input.controlId,
        input.controlDescription,
        input.eventDescription,
        input.eventType,
        input.evidenceType || null,
        input.evidenceLocation || null,
        JSON.stringify(input.evidenceMetadata || {}),
        performedByUserId,
        input.reviewedByUserId || null,
        input.complianceStatus,
        input.findings || null,
      ]);

      this.logger.log(`Added compliance audit entry for ${input.framework}:${input.controlId} by user ${performedByUserId} in tenant ${tenantId}`);

      return this.mapComplianceEntry(result.rows[0]);
    } catch (error) {
      this.logger.error(`Failed to add compliance audit entry: ${error.message}`, {
        tenantId,
        userId: performedByUserId,
        framework: input.framework,
        controlId: input.controlId,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private calculateAnomalyScore(input: any): number {
    let score = 0;

    // High risk level = higher anomaly score
    const riskScores: { [key: string]: number } = {
      CRITICAL: 90,
      HIGH: 70,
      MEDIUM: 40,
      LOW: 10,
    };
    score += riskScores[input.riskLevel] || 0;

    // Failed events are more suspicious
    if (!input.success) {
      score += 20;
    }

    // Certain event types are inherently more suspicious
    const suspiciousEventTypes = [
      'PERMISSION_DENIED',
      'ZONE_ACCESS_DENIED',
      'BRUTE_FORCE_ATTEMPT',
      'DATA_EXPORT',
      'CONFIG_CHANGE',
      'PRIVILEGE_ESCALATION',
    ];
    if (suspiciousEventTypes.includes(input.eventType)) {
      score += 15;
    }

    return Math.min(100, score);
  }

  private mapIncident(row: any): any {
    return {
      id: row.id,
      incidentNumber: row.incident_number,
      title: row.title,
      description: row.description,
      incidentType: row.incident_type,
      severity: row.severity,
      status: row.status,
      relatedEventIds: row.related_event_ids || [],
      affectedUsers: row.affected_users || [],
      affectedResources: row.affected_resources || [],
      estimatedImpact: row.estimated_impact,
      assignedToUserId: row.assigned_to_user_id,
      resolutionNotes: row.resolution_notes,
      remediationActions: row.remediation_actions,
      detectedAt: row.detected_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
    };
  }

  private mapThreatPattern(row: any): any {
    return {
      id: row.id,
      patternName: row.pattern_name,
      patternDescription: row.pattern_description,
      severity: row.severity,
      detectionRules: row.detection_rules,
      autoBlock: row.auto_block,
      alertChannels: row.alert_channels || [],
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
    };
  }

  private mapSecurityEvent(row: any): any {
    return {
      id: row.id,
      eventType: row.event_type,
      eventTimestamp: row.event_timestamp,
      correlationId: row.correlation_id,
      userId: row.user_id,
      username: row.username,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      sessionId: row.session_id,
      targetResource: row.target_resource,
      targetType: row.target_type,
      riskLevel: row.risk_level,
      success: row.success,
      failureReason: row.failure_reason,
      metadata: row.metadata,
      countryCode: row.country_code,
      city: row.city,
      location: row.location,
      anomalyScore: row.anomaly_score,
      flaggedSuspicious: row.flagged_suspicious,
      autoBlocked: row.auto_blocked,
      createdAt: row.created_at,
    };
  }

  private mapComplianceEntry(row: any): any {
    return {
      id: row.id,
      framework: row.framework,
      controlId: row.control_id,
      controlDescription: row.control_description,
      auditTimestamp: row.audit_timestamp,
      eventDescription: row.event_description,
      eventType: row.event_type,
      evidenceType: row.evidence_type,
      evidenceLocation: row.evidence_location,
      evidenceMetadata: row.evidence_metadata,
      performedByUserId: row.performed_by_user_id,
      reviewedByUserId: row.reviewed_by_user_id,
      complianceStatus: row.compliance_status,
      findings: row.findings,
      createdAt: row.created_at,
    };
  }
}
