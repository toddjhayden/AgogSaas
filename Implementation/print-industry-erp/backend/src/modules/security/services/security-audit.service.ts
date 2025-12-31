/**
 * Security Audit Service
 * REQ-DEVOPS-SECURITY-1767150339448
 *
 * Provides comprehensive security audit functionality including:
 * - Security event logging and correlation
 * - Threat pattern detection
 * - Incident management
 * - Compliance audit trail
 * - Real-time security metrics
 *
 * SECURITY HARDENING (Marcus - DevOps Security Architect):
 * - Added query timeout protection (10s default)
 * - Added error logging and monitoring
 */

import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);
  private readonly QUERY_TIMEOUT_MS = 10000; // 10 seconds

  constructor(
    @Inject('DATABASE_POOL')
    private readonly pool: Pool,
  ) {}

  /**
   * Execute query with timeout protection
   * SECURITY: Prevents long-running queries from blocking workers
   */
  private async executeQuery<T = any>(
    query: string,
    params: any[],
    timeoutMs: number = this.QUERY_TIMEOUT_MS,
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await this.pool.query({
        text: query,
        values: params,
        timeout: timeoutMs,
      });
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        this.logger.warn(`Slow query detected: ${duration}ms`);
      }
      return result.rows as T;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Query failed after ${duration}ms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get security overview dashboard metrics
   */
  async getSecurityOverview(tenantId: number, timeRange: string) {
    const hours = this.getHoursFromTimeRange(timeRange);

    const query = `
      WITH event_stats AS (
        SELECT
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE risk_level = 'CRITICAL') as critical_events,
          COUNT(*) FILTER (WHERE risk_level = 'HIGH') as high_risk_events,
          COUNT(*) FILTER (WHERE flagged_suspicious = TRUE) as suspicious_events,
          COUNT(*) FILTER (WHERE auto_blocked = TRUE) as blocked_events,
          COUNT(*) FILTER (WHERE event_type LIKE 'LOGIN%') as login_attempts,
          COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED') as failed_logins,
          COUNT(*) FILTER (WHERE event_type = 'PERMISSION_DENIED') as permission_denials,
          COUNT(*) FILTER (WHERE event_type LIKE 'ZONE_ACCESS%') as zone_access_events,
          COUNT(*) FILTER (WHERE event_type = 'ZONE_ACCESS_DENIED') as unauthorized_access_attempts,
          COUNT(*) FILTER (WHERE event_type = 'DATA_EXPORT') as data_exports,
          COUNT(*) FILTER (WHERE event_type = 'DATA_MODIFICATION') as data_modifications,
          COUNT(*) FILTER (WHERE event_type = 'CONFIG_CHANGE') as config_changes,
          COUNT(*) FILTER (WHERE event_type = 'BRUTE_FORCE_ATTEMPT') as brute_force_attempts,
          COUNT(DISTINCT country_code) as unique_countries,
          COUNT(DISTINCT ip_address) as unique_ip_addresses,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as active_users,
          ROUND(100.0 * COUNT(*) FILTER (WHERE success = TRUE) / NULLIF(COUNT(*) FILTER (WHERE event_type LIKE 'LOGIN%'), 0), 2) as success_rate
        FROM security_audit_events
        WHERE tenant_id = $1
          AND event_timestamp >= NOW() - ($2 || ' hours')::INTERVAL
      ),
      incident_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE status IN ('OPEN', 'INVESTIGATING')) as active_incidents,
          COUNT(*) FILTER (WHERE status = 'INVESTIGATING') as open_investigations
        FROM security_incidents
        WHERE tenant_id = $1
          AND detected_at >= NOW() - ($2 || ' hours')::INTERVAL
      ),
      top_threats AS (
        SELECT
          stp.pattern_name,
          stp.severity,
          COUNT(sae.id) as occurrences,
          MAX(sae.event_timestamp) as last_occurrence
        FROM security_threat_patterns stp
        LEFT JOIN security_audit_events sae
          ON sae.tenant_id = stp.tenant_id
          AND sae.flagged_suspicious = TRUE
          AND sae.event_timestamp >= NOW() - ($2 || ' hours')::INTERVAL
        WHERE stp.tenant_id = $1
          AND stp.enabled = TRUE
        GROUP BY stp.id, stp.pattern_name, stp.severity
        HAVING COUNT(sae.id) > 0
        ORDER BY COUNT(sae.id) DESC
        LIMIT 5
      ),
      top_countries AS (
        SELECT
          country_code,
          COUNT(*) as access_count
        FROM security_audit_events
        WHERE tenant_id = $1
          AND event_timestamp >= NOW() - ($2 || ' hours')::INTERVAL
          AND country_code IS NOT NULL
        GROUP BY country_code
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ),
      suspicious_users AS (
        SELECT
          user_id,
          username,
          COUNT(*) as suspicious_event_count,
          ROUND(AVG(anomaly_score), 2) as risk_score,
          MAX(event_timestamp) as last_suspicious_activity,
          ARRAY_AGG(DISTINCT event_type::TEXT) as flagged_reasons
        FROM security_audit_events
        WHERE tenant_id = $1
          AND event_timestamp >= NOW() - ($2 || ' hours')::INTERVAL
          AND flagged_suspicious = TRUE
          AND user_id IS NOT NULL
        GROUP BY user_id, username
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ),
      compliance_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE compliance_status = 'NON_COMPLIANT') as non_compliant_controls
        FROM security_compliance_audit
        WHERE tenant_id = $1
          AND audit_timestamp >= NOW() - ($2 || ' hours')::INTERVAL
      )
      SELECT
        es.*,
        is.active_incidents,
        is.open_investigations,
        COALESCE(cs.non_compliant_controls, 0) as non_compliant_controls,
        (
          SELECT json_agg(json_build_object(
            'patternName', pattern_name,
            'severity', severity,
            'occurrences', occurrences,
            'lastOccurrence', last_occurrence
          ))
          FROM top_threats
        ) as top_threats,
        (
          SELECT json_agg(json_build_object(
            'countryCode', country_code,
            'accessCount', access_count,
            'percentage', ROUND(100.0 * access_count / NULLIF(es.total_events, 0), 2)
          ))
          FROM top_countries
        ) as top_countries,
        (
          SELECT json_agg(json_build_object(
            'userId', user_id,
            'username', username,
            'suspiciousEventCount', suspicious_event_count,
            'riskScore', risk_score,
            'lastSuspiciousActivity', last_suspicious_activity,
            'flaggedReasons', flagged_reasons
          ))
          FROM suspicious_users
        ) as suspicious_users
      FROM event_stats es
      CROSS JOIN incident_stats is
      CROSS JOIN compliance_stats cs
    `;

    const result = await this.pool.query(query, [tenantId, hours]);
    const row = result.rows[0];

    // Calculate security score (0-100)
    const securityScore = this.calculateSecurityScore(row);
    const trend = this.calculateTrend(row);
    const complianceScore = this.calculateComplianceScore(row);

    return {
      timeRange,
      securityScore,
      trend,
      totalEvents: parseInt(row.total_events),
      criticalEvents: parseInt(row.critical_events),
      highRiskEvents: parseInt(row.high_risk_events),
      suspiciousEvents: parseInt(row.suspicious_events),
      blockedEvents: parseInt(row.blocked_events),
      loginAttempts: parseInt(row.login_attempts),
      failedLogins: parseInt(row.failed_logins),
      successRate: parseFloat(row.success_rate) || 0,
      bruteForceAttempts: parseInt(row.brute_force_attempts),
      permissionDenials: parseInt(row.permission_denials),
      zoneAccessEvents: parseInt(row.zone_access_events),
      unauthorizedAccessAttempts: parseInt(row.unauthorized_access_attempts),
      dataExports: parseInt(row.data_exports),
      dataModifications: parseInt(row.data_modifications),
      configChanges: parseInt(row.config_changes),
      activeIncidents: parseInt(row.active_incidents),
      openInvestigations: parseInt(row.open_investigations),
      topThreats: row.top_threats || [],
      uniqueCountries: parseInt(row.unique_countries),
      uniqueIPAddresses: parseInt(row.unique_ip_addresses),
      topCountries: row.top_countries || [],
      activeUsers: parseInt(row.active_users),
      suspiciousUsers: row.suspicious_users || [],
      complianceScore,
      nonCompliantControls: parseInt(row.non_compliant_controls),
    };
  }

  /**
   * Get paginated security audit events
   */
  async getSecurityAuditEvents(
    tenantId: number,
    filter: any = {},
    pagination: any = {},
  ) {
    const { first = 50, after } = pagination;
    const offset = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;

    let whereClause = 'WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filter.eventTypes?.length) {
      whereClause += ` AND event_type = ANY($${paramIndex}::security_event_type[])`;
      params.push(filter.eventTypes);
      paramIndex++;
    }

    if (filter.riskLevels?.length) {
      whereClause += ` AND risk_level = ANY($${paramIndex}::security_risk_level[])`;
      params.push(filter.riskLevels);
      paramIndex++;
    }

    if (filter.userId) {
      whereClause += ` AND user_id = $${paramIndex}`;
      params.push(filter.userId);
      paramIndex++;
    }

    if (filter.ipAddress) {
      whereClause += ` AND ip_address = $${paramIndex}`;
      params.push(filter.ipAddress);
      paramIndex++;
    }

    if (filter.success !== undefined) {
      whereClause += ` AND success = $${paramIndex}`;
      params.push(filter.success);
      paramIndex++;
    }

    if (filter.flaggedSuspicious !== undefined) {
      whereClause += ` AND flagged_suspicious = $${paramIndex}`;
      params.push(filter.flaggedSuspicious);
      paramIndex++;
    }

    if (filter.startDate) {
      whereClause += ` AND event_timestamp >= $${paramIndex}`;
      params.push(filter.startDate);
      paramIndex++;
    }

    if (filter.endDate) {
      whereClause += ` AND event_timestamp <= $${paramIndex}`;
      params.push(filter.endDate);
      paramIndex++;
    }

    if (filter.searchQuery) {
      whereClause += ` AND (username ILIKE $${paramIndex} OR target_resource ILIKE $${paramIndex} OR failure_reason ILIKE $${paramIndex})`;
      params.push(`%${filter.searchQuery}%`);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) FROM security_audit_events ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    const query = `
      SELECT *
      FROM security_audit_events
      ${whereClause}
      ORDER BY event_timestamp DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    params.push(first + 1, offset); // Get one extra to check for next page

    const result = await this.pool.query(query, params);
    const hasNextPage = result.rows.length > first;
    const edges = result.rows.slice(0, first).map((row, index) => ({
      node: this.mapSecurityEvent(row),
      cursor: Buffer.from((offset + index).toString()).toString('base64'),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: offset > 0,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount,
    };
  }

  /**
   * Get top suspicious IP addresses
   */
  async getSuspiciousIPs(tenantId: number, hours: number = 24, limit: number = 10) {
    const query = `
      SELECT * FROM get_top_suspicious_ips($1, $2, $3)
    `;

    const result = await this.pool.query(query, [tenantId, hours, limit]);
    return result.rows.map(row => ({
      ipAddress: row.ip_address,
      eventCount: parseInt(row.event_count),
      failedLoginCount: parseInt(row.failed_login_count),
      suspiciousEventCount: parseInt(row.suspicious_event_count),
      riskScore: parseFloat(row.risk_score) || 0,
      countries: row.countries || [],
      blocked: parseInt(row.suspicious_event_count) >= 10, // Auto-block threshold
    }));
  }

  /**
   * Get user security activity timeline
   */
  async getUserSecurityTimeline(tenantId: number, userId: number, hours: number = 24) {
    const query = `
      SELECT * FROM get_user_security_timeline($1, $2, $3)
    `;

    const result = await this.pool.query(query, [tenantId, userId, hours]);
    return result.rows.map(row => this.mapSecurityEvent(row));
  }

  /**
   * Get security incidents with filtering
   */
  async getSecurityIncidents(
    tenantId: number,
    filter: any = {},
    pagination: any = {},
  ) {
    const { first = 50, after } = pagination;
    const offset = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;

    let whereClause = 'WHERE si.tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filter.status?.length) {
      whereClause += ` AND si.status = ANY($${paramIndex})`;
      params.push(filter.status);
      paramIndex++;
    }

    if (filter.severity?.length) {
      whereClause += ` AND si.severity = ANY($${paramIndex}::security_risk_level[])`;
      params.push(filter.severity);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) FROM security_incidents si ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    const query = `
      SELECT
        si.*,
        u_assigned.username as assigned_username,
        u_created.username as created_username,
        u_updated.username as updated_username
      FROM security_incidents si
      LEFT JOIN users u_assigned ON si.assigned_to_user_id = u_assigned.user_id
      LEFT JOIN users u_created ON si.created_by_user_id = u_created.user_id
      LEFT JOIN users u_updated ON si.updated_by_user_id = u_updated.user_id
      ${whereClause}
      ORDER BY si.detected_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    params.push(first + 1, offset);

    const result = await this.pool.query(query, params);
    const hasNextPage = result.rows.length > first;
    const edges = result.rows.slice(0, first).map((row, index) => ({
      node: this.mapSecurityIncident(row),
      cursor: Buffer.from((offset + index).toString()).toString('base64'),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: offset > 0,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount,
    };
  }

  /**
   * Get single security incident details
   */
  async getSecurityIncident(tenantId: number, id: number) {
    const query = `
      SELECT
        si.*,
        u_assigned.username as assigned_username,
        u_created.username as created_username,
        u_updated.username as updated_username
      FROM security_incidents si
      LEFT JOIN users u_assigned ON si.assigned_to_user_id = u_assigned.user_id
      LEFT JOIN users u_created ON si.created_by_user_id = u_created.user_id
      LEFT JOIN users u_updated ON si.updated_by_user_id = u_updated.user_id
      WHERE si.id = $1 AND si.tenant_id = $2
    `;

    const result = await this.pool.query(query, [id, tenantId]);
    if (result.rows.length === 0) {
      throw new Error(`Security incident ${id} not found`);
    }

    return this.mapSecurityIncident(result.rows[0]);
  }

  /**
   * Get threat detection patterns
   */
  async getThreatPatterns(tenantId: number, enabled?: boolean) {
    let query = `
      SELECT
        stp.*,
        u_created.username as created_username,
        u_updated.username as updated_username,
        (
          SELECT COUNT(*)
          FROM security_audit_events sae
          WHERE sae.tenant_id = stp.tenant_id
            AND sae.flagged_suspicious = TRUE
            AND sae.event_timestamp >= NOW() - INTERVAL '7 days'
        ) as match_count
      FROM security_threat_patterns stp
      LEFT JOIN users u_created ON stp.created_by_user_id = u_created.user_id
      LEFT JOIN users u_updated ON stp.updated_by_user_id = u_updated.user_id
      WHERE stp.tenant_id = $1
    `;

    const params: any[] = [tenantId];
    if (enabled !== undefined) {
      query += ` AND stp.enabled = $2`;
      params.push(enabled);
    }

    query += ` ORDER BY stp.severity DESC, stp.pattern_name`;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapThreatPattern(row));
  }

  /**
   * Get security metrics time series
   */
  async getSecurityMetricsTimeSeries(tenantId: number, timeRange: string, interval: string = '1h') {
    const hours = this.getHoursFromTimeRange(timeRange);

    const query = `
      SELECT * FROM security_metrics_summary
      WHERE tenant_id = $1
        AND metric_hour >= NOW() - ($2 || ' hours')::INTERVAL
      ORDER BY metric_hour ASC
    `;

    const result = await this.pool.query(query, [tenantId, hours]);
    return result.rows.map(row => ({
      timestamp: row.metric_hour,
      totalEvents: parseInt(row.total_events),
      loginEvents: parseInt(row.login_events),
      failedLogins: parseInt(row.failed_logins),
      permissionDenials: parseInt(row.permission_denials),
      zoneAccessEvents: parseInt(row.zone_access_events),
      dataExports: parseInt(row.data_exports),
      criticalEvents: parseInt(row.critical_events),
      highRiskEvents: parseInt(row.high_risk_events),
      suspiciousEvents: parseInt(row.suspicious_events),
      autoBlockedEvents: parseInt(row.auto_blocked_events),
      uniqueUsers: parseInt(row.unique_users),
      uniqueIPAddresses: parseInt(row.unique_ip_addresses),
      uniqueSessions: parseInt(row.unique_sessions),
      avgAnomalyScore: parseFloat(row.avg_anomaly_score) || null,
      maxAnomalyScore: parseFloat(row.max_anomaly_score) || null,
      successRatePercent: parseFloat(row.success_rate_percent) || 0,
    }));
  }

  /**
   * Get geographic access map data
   */
  async getGeographicAccessMap(tenantId: number, hours: number = 24) {
    const query = `
      SELECT
        country_code,
        COUNT(*) as access_count,
        COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED') as failed_login_count,
        COUNT(*) FILTER (WHERE flagged_suspicious = TRUE) as suspicious_event_count,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_users
      FROM security_audit_events
      WHERE tenant_id = $1
        AND event_timestamp >= NOW() - ($2 || ' hours')::INTERVAL
        AND country_code IS NOT NULL
      GROUP BY country_code
      ORDER BY access_count DESC
    `;

    const result = await this.pool.query(query, [tenantId, hours]);
    return result.rows.map(row => ({
      countryCode: row.country_code,
      countryName: this.getCountryName(row.country_code),
      accessCount: parseInt(row.access_count),
      failedLoginCount: parseInt(row.failed_login_count),
      suspiciousEventCount: parseInt(row.suspicious_event_count),
      uniqueUsers: parseInt(row.unique_users),
      location: null, // TODO: Add country coordinates lookup
    }));
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private getHoursFromTimeRange(timeRange: string): number {
    const map: { [key: string]: number } = {
      LAST_HOUR: 1,
      LAST_6_HOURS: 6,
      LAST_24_HOURS: 24,
      LAST_7_DAYS: 168,
      LAST_30_DAYS: 720,
    };
    return map[timeRange] || 24;
  }

  private calculateSecurityScore(data: any): number {
    // Calculate security score based on various factors (0-100)
    let score = 100;

    // Deduct points for critical events
    score -= Math.min(parseInt(data.critical_events) * 10, 30);

    // Deduct points for high risk events
    score -= Math.min(parseInt(data.high_risk_events) * 5, 20);

    // Deduct points for suspicious events
    score -= Math.min(parseInt(data.suspicious_events) * 2, 20);

    // Deduct points for failed login rate
    const failedLoginRate = parseInt(data.failed_logins) / Math.max(parseInt(data.login_attempts), 1);
    score -= Math.min(failedLoginRate * 30, 15);

    // Deduct points for active incidents
    score -= Math.min(parseInt(data.active_incidents) * 5, 15);

    return Math.max(0, Math.min(100, score));
  }

  private calculateTrend(data: any): string {
    const score = this.calculateSecurityScore(data);

    if (score >= 90) return 'IMPROVING';
    if (score >= 70) return 'STABLE';
    if (score >= 50) return 'DEGRADING';
    return 'CRITICAL';
  }

  private calculateComplianceScore(data: any): number {
    // Simple compliance score - can be enhanced with actual compliance data
    const nonCompliant = parseInt(data.non_compliant_controls) || 0;
    if (nonCompliant === 0) return 100;
    if (nonCompliant <= 2) return 85;
    if (nonCompliant <= 5) return 70;
    if (nonCompliant <= 10) return 50;
    return 30;
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
      location: row.location ? {
        latitude: row.location.x,
        longitude: row.location.y,
      } : null,
      anomalyScore: row.anomaly_score ? parseFloat(row.anomaly_score) : null,
      flaggedSuspicious: row.flagged_suspicious,
      autoBlocked: row.auto_blocked,
      createdAt: row.created_at,
    };
  }

  private mapSecurityIncident(row: any): any {
    return {
      id: row.id,
      incidentNumber: row.incident_number,
      title: row.title,
      description: row.description,
      incidentType: row.incident_type,
      severity: row.severity,
      status: row.status,
      relatedEventIds: row.related_event_ids || [],
      affectedUsers: [], // TODO: Populate from affected_users array
      affectedResources: row.affected_resources || [],
      estimatedImpact: row.estimated_impact,
      assignedTo: row.assigned_to_user_id ? {
        id: row.assigned_to_user_id,
        username: row.assigned_username,
      } : null,
      resolutionNotes: row.resolution_notes,
      remediationActions: row.remediation_actions,
      detectedAt: row.detected_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by_user_id ? {
        id: row.created_by_user_id,
        username: row.created_username,
      } : null,
      updatedBy: row.updated_by_user_id ? {
        id: row.updated_by_user_id,
        username: row.updated_username,
      } : null,
    };
  }

  private mapThreatPattern(row: any): any {
    return {
      id: row.id,
      patternName: row.pattern_name,
      patternDescription: row.pattern_description,
      severity: row.severity,
      detectionRules: row.detection_rules,
      matchCount: parseInt(row.match_count) || 0,
      autoBlock: row.auto_block,
      alertChannels: row.alert_channels || [],
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by_user_id ? {
        id: row.created_by_user_id,
        username: row.created_username,
      } : null,
      updatedBy: row.updated_by_user_id ? {
        id: row.updated_by_user_id,
        username: row.updated_username,
      } : null,
    };
  }

  private getCountryName(code: string): string {
    // TODO: Add full country name mapping
    const countryMap: { [key: string]: string } = {
      US: 'United States',
      GB: 'United Kingdom',
      CA: 'Canada',
      DE: 'Germany',
      FR: 'France',
      JP: 'Japan',
      CN: 'China',
      IN: 'India',
    };
    return countryMap[code] || code;
  }
}
