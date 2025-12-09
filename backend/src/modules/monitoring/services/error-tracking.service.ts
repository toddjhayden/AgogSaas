import { Pool } from 'pg';
import { connect, NatsConnection } from 'nats';

export interface SystemError {
  id: string;
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED';
  message: string;
  stackTrace?: string;
  component: string;
  userId?: string;
  tenantId?: string;
  firstOccurred: Date;
  lastOccurred: Date;
  occurrenceCount: number;
  assignedTo?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  metadata?: any;
}

export interface ErrorQueryOptions {
  severity?: string;
  status?: string;
  component?: string;
  limit?: number;
  offset?: number;
}

export class ErrorTrackingService {
  private pool: Pool;
  private nc?: NatsConnection;

  constructor(pool: Pool) {
    this.pool = pool;
    this.initializeNATS();
  }

  private async initializeNATS() {
    try {
      this.nc = await connect({
        servers: process.env.NATS_URL || 'nats://localhost:4222',
      });
      console.log('[ErrorTracking] Connected to NATS');
    } catch (error) {
      console.error('[ErrorTracking] Failed to connect to NATS:', error);
    }
  }

  /**
   * Get errors with filtering
   */
  async getErrors(options: ErrorQueryOptions): Promise<SystemError[]> {
    let sql = `
      SELECT * FROM system_errors
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options.severity) {
      sql += ` AND severity = $${paramIndex}`;
      params.push(options.severity);
      paramIndex++;
    }

    if (options.status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    if (options.component) {
      sql += ` AND component = $${paramIndex}`;
      params.push(options.component);
      paramIndex++;
    }

    sql += ` ORDER BY last_occurred DESC LIMIT $${paramIndex}`;
    params.push(options.limit || 50);
    paramIndex++;

    sql += ` OFFSET $${paramIndex}`;
    params.push(options.offset || 0);

    try {
      const result = await this.pool.query(sql, params);
      return result.rows.map(this.mapRow);
    } catch (error) {
      console.error('[ErrorTracking] Failed to get errors:', error);
      return [];
    }
  }

  /**
   * Get error by ID
   */
  async getErrorById(id: string): Promise<SystemError | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM system_errors WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) return null;
      return this.mapRow(result.rows[0]);
    } catch (error) {
      console.error('[ErrorTracking] Failed to get error by ID:', error);
      return null;
    }
  }

  /**
   * Create new error
   */
  async createError(error: Partial<SystemError>): Promise<SystemError> {
    const result = await this.pool.query(
      `INSERT INTO system_errors
        (severity, status, message, stack_trace, component, user_id, tenant_id, metadata, occurrence_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
       RETURNING *`,
      [
        error.severity,
        'OPEN',
        error.message,
        error.stackTrace,
        error.component,
        error.userId,
        error.tenantId,
        JSON.stringify(error.metadata || {}),
      ]
    );

    const newError = this.mapRow(result.rows[0]);

    // Publish to NATS
    if (this.nc) {
      await this.nc.publish(
        'wms.monitoring.errors.created',
        JSON.stringify(newError)
      );
      await this.nc.publish(
        `wms.monitoring.errors.created.${error.severity}`,
        JSON.stringify(newError)
      );
    }

    console.log(`[ErrorTracking] Created ${error.severity} error: ${error.message}`);
    return newError;
  }

  /**
   * Update error status
   */
  async updateErrorStatus(
    id: string,
    status: string,
    assignedTo?: string,
    resolutionNotes?: string
  ): Promise<SystemError> {
    const result = await this.pool.query(
      `UPDATE system_errors
       SET status = $1, assigned_to = $2, resolution_notes = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, assignedTo, resolutionNotes, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Error ${id} not found`);
    }

    const error = this.mapRow(result.rows[0]);

    // Publish to NATS
    if (this.nc) {
      await this.nc.publish(
        'wms.monitoring.errors.updated',
        JSON.stringify(error)
      );
    }

    return error;
  }

  /**
   * Resolve error
   */
  async resolveError(
    id: string,
    resolvedBy: string,
    resolutionNotes: string
  ): Promise<SystemError> {
    const result = await this.pool.query(
      `UPDATE system_errors
       SET status = 'RESOLVED', resolved_by = $1, resolved_at = NOW(),
           resolution_notes = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [resolvedBy, resolutionNotes, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Error ${id} not found`);
    }

    const error = this.mapRow(result.rows[0]);

    // Publish to NATS
    if (this.nc) {
      await this.nc.publish(
        'wms.monitoring.errors.resolved',
        JSON.stringify(error)
      );
    }

    console.log(`[ErrorTracking] Resolved error ${id} by ${resolvedBy}`);
    return error;
  }

  /**
   * Get error statistics
   */
  async getStats() {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('OPEN', 'IN_PROGRESS')) as open_errors,
        COUNT(*) FILTER (WHERE severity = 'CRITICAL' AND
          first_occurred > NOW() - INTERVAL '24 hours') as critical_errors_24h
      FROM system_errors
    `);

    return {
      openErrors: parseInt(result.rows[0].open_errors || '0'),
      criticalErrors24h: parseInt(result.rows[0].critical_errors_24h || '0'),
    };
  }

  /**
   * Map database row to SystemError
   */
  private mapRow(row: any): SystemError {
    return {
      id: row.id,
      severity: row.severity,
      status: row.status,
      message: row.message,
      stackTrace: row.stack_trace,
      component: row.component,
      userId: row.user_id,
      tenantId: row.tenant_id,
      firstOccurred: row.first_occurred,
      lastOccurred: row.last_occurred,
      occurrenceCount: row.occurrence_count,
      assignedTo: row.assigned_to,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      resolutionNotes: row.resolution_notes,
      metadata: row.metadata,
    };
  }

  async close() {
    if (this.nc) {
      await this.nc.close();
    }
  }
}
