/**
 * Quote Collaboration Service
 * REQ-STRATEGIC-AUTO-1767108044308: Real-Time Collaboration & Live Editing for Quotes
 *
 * Provides real-time collaboration features for quotes including:
 * - Optimistic locking with version control
 * - Change tracking and audit trail
 * - Presence detection
 * - Conflict detection and resolution
 *
 * Security: Implements Sylvia's critical security requirements
 * - Tenant isolation via RLS
 * - Explicit version checking
 * - Field-level change tracking
 */

import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

// =====================================================
// INTERFACES
// =====================================================

export interface VersionedQuoteUpdate {
  quoteId: string;
  tenantId: string;
  userId: string;
  expectedVersion: number;
  changes: Partial<{
    notes: string;
    termsAndConditions: string;
    expirationDate: Date;
    status: string;
  }>;
  sessionId?: string;
}

export interface VersionedQuoteLineUpdate {
  lineId: string;
  tenantId: string;
  userId: string;
  expectedVersion: number;
  changes: Partial<{
    quantity: number;
    unitPrice: number;
    discountPercentage: number;
    description: string;
    leadTimeDays: number;
    promisedDeliveryDate: Date;
  }>;
  sessionId?: string;
}

export interface QuoteChangeRecord {
  id: string;
  quoteId: string;
  quoteLineId?: string;
  changedBy: string;
  changedAt: Date;
  entityType: 'QUOTE' | 'QUOTE_LINE';
  fieldName: string;
  oldValue: any;
  newValue: any;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  wasConflict: boolean;
  conflictResolution?: 'ACCEPTED' | 'REJECTED' | 'MERGED';
  entityVersionBefore: number;
  entityVersionAfter: number;
}

export interface ActiveSession {
  sessionId: string;
  quoteId: string;
  userId: string;
  userName: string;
  userEmail: string;
  joinedAt: Date;
  lastHeartbeat: Date;
  currentLineId?: string;
  currentField?: string;
  cursorPosition?: number;
  isEditing: boolean;
  status: 'VIEWING' | 'EDITING' | 'IDLE';
}

export interface ConflictDetails {
  message: string;
  expectedVersion: number;
  actualVersion: number;
  conflictingChanges: Array<{
    field: string;
    yourValue: any;
    currentValue: any;
    lastChangedBy: string;
    lastChangedAt: Date;
  }>;
}

// =====================================================
// CUSTOM EXCEPTIONS
// =====================================================

export class QuoteVersionConflictException extends ConflictException {
  constructor(
    public readonly details: ConflictDetails
  ) {
    super({
      message: 'Quote has been modified by another user',
      code: 'QUOTE_VERSION_CONFLICT',
      details
    });
  }
}

export class QuoteLineVersionConflictException extends ConflictException {
  constructor(
    public readonly details: ConflictDetails
  ) {
    super({
      message: 'Quote line has been modified by another user',
      code: 'QUOTE_LINE_VERSION_CONFLICT',
      details
    });
  }
}

// =====================================================
// SERVICE IMPLEMENTATION
// =====================================================

@Injectable()
export class QuoteCollaborationService {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool
  ) {}

  // =====================================================
  // OPTIMISTIC LOCKING - QUOTE HEADER UPDATES
  // =====================================================

  /**
   * Update quote header with optimistic locking
   * Throws QuoteVersionConflictException if version mismatch
   */
  async updateQuoteWithVersionCheck(
    input: VersionedQuoteUpdate
  ): Promise<any> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Set tenant context for RLS
      await client.query(
        `SET LOCAL app.current_tenant_id = $1`,
        [input.tenantId]
      );

      // Get current quote state
      const currentQuoteResult = await client.query(
        `SELECT * FROM quotes WHERE id = $1 AND tenant_id = $2`,
        [input.quoteId, input.tenantId]
      );

      if (currentQuoteResult.rows.length === 0) {
        throw new NotFoundException(`Quote ${input.quoteId} not found`);
      }

      const currentQuote = currentQuoteResult.rows[0];

      // Check version (CRITICAL: Optimistic locking)
      if (currentQuote.version !== input.expectedVersion) {
        // Get details of conflicting changes
        const conflicts = await this.getRecentQuoteChanges(
          client,
          input.quoteId,
          input.expectedVersion
        );

        throw new QuoteVersionConflictException({
          message: 'Quote has been modified by another user',
          expectedVersion: input.expectedVersion,
          actualVersion: currentQuote.version,
          conflictingChanges: conflicts
        });
      }

      // Build update query dynamically based on changes
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (input.changes.notes !== undefined) {
        updateFields.push(`notes = $${paramIndex++}`);
        updateValues.push(input.changes.notes);
      }

      if (input.changes.termsAndConditions !== undefined) {
        updateFields.push(`terms_and_conditions = $${paramIndex++}`);
        updateValues.push(input.changes.termsAndConditions);
      }

      if (input.changes.expirationDate !== undefined) {
        updateFields.push(`expiration_date = $${paramIndex++}`);
        updateValues.push(input.changes.expirationDate);
      }

      if (input.changes.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(input.changes.status);
      }

      // Always update metadata
      updateFields.push(`updated_at = NOW()`);
      updateFields.push(`updated_by = $${paramIndex++}`);
      updateValues.push(input.userId);

      // Update quote (trigger will auto-increment version)
      const updateQuery = `
        UPDATE quotes
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex++}
          AND tenant_id = $${paramIndex++}
          AND version = $${paramIndex++}
        RETURNING *
      `;

      updateValues.push(input.quoteId, input.tenantId, input.expectedVersion);

      const updateResult = await client.query(updateQuery, updateValues);

      if (updateResult.rows.length === 0) {
        // Concurrent modification detected
        throw new QuoteVersionConflictException({
          message: 'Concurrent modification detected during update',
          expectedVersion: input.expectedVersion,
          actualVersion: currentQuote.version + 1,
          conflictingChanges: []
        });
      }

      const updatedQuote = updateResult.rows[0];

      // Record changes in audit trail
      await this.recordQuoteChanges(
        client,
        input.quoteId,
        input.tenantId,
        input.userId,
        currentQuote,
        input.changes,
        input.sessionId,
        currentQuote.version,
        updatedQuote.version
      );

      await client.query('COMMIT');

      return {
        quote: updatedQuote,
        previousVersion: currentQuote.version,
        newVersion: updatedQuote.version
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // OPTIMISTIC LOCKING - QUOTE LINE UPDATES
  // =====================================================

  /**
   * Update quote line with optimistic locking
   * Throws QuoteLineVersionConflictException if version mismatch
   */
  async updateQuoteLineWithVersionCheck(
    input: VersionedQuoteLineUpdate
  ): Promise<any> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Set tenant context for RLS
      await client.query(
        `SET LOCAL app.current_tenant_id = $1`,
        [input.tenantId]
      );

      // Get current line state
      const currentLineResult = await client.query(
        `SELECT * FROM quote_lines WHERE id = $1 AND tenant_id = $2`,
        [input.lineId, input.tenantId]
      );

      if (currentLineResult.rows.length === 0) {
        throw new NotFoundException(`Quote line ${input.lineId} not found`);
      }

      const currentLine = currentLineResult.rows[0];

      // Check version (CRITICAL: Optimistic locking)
      if (currentLine.version !== input.expectedVersion) {
        const conflicts = await this.getRecentQuoteLineChanges(
          client,
          input.lineId,
          input.expectedVersion
        );

        throw new QuoteLineVersionConflictException({
          message: 'Quote line has been modified by another user',
          expectedVersion: input.expectedVersion,
          actualVersion: currentLine.version,
          conflictingChanges: conflicts
        });
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (input.changes.quantity !== undefined) {
        updateFields.push(`quantity = $${paramIndex++}`);
        updateValues.push(input.changes.quantity);
      }

      if (input.changes.unitPrice !== undefined) {
        updateFields.push(`unit_price = $${paramIndex++}`);
        updateValues.push(input.changes.unitPrice);
      }

      if (input.changes.discountPercentage !== undefined) {
        updateFields.push(`discount_percentage = $${paramIndex++}`);
        updateValues.push(input.changes.discountPercentage);
      }

      if (input.changes.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(input.changes.description);
      }

      if (input.changes.leadTimeDays !== undefined) {
        updateFields.push(`lead_time_days = $${paramIndex++}`);
        updateValues.push(input.changes.leadTimeDays);
      }

      if (input.changes.promisedDeliveryDate !== undefined) {
        updateFields.push(`promised_delivery_date = $${paramIndex++}`);
        updateValues.push(input.changes.promisedDeliveryDate);
      }

      // Recalculate line amount if quantity or price changed
      if (input.changes.quantity !== undefined || input.changes.unitPrice !== undefined) {
        const newQuantity = input.changes.quantity ?? currentLine.quantity;
        const newUnitPrice = input.changes.unitPrice ?? currentLine.unit_price;
        const lineAmount = newQuantity * newUnitPrice;
        updateFields.push(`line_amount = $${paramIndex++}`);
        updateValues.push(lineAmount);
      }

      // Always update metadata
      updateFields.push(`updated_at = NOW()`);
      updateFields.push(`updated_by = $${paramIndex++}`);
      updateValues.push(input.userId);

      // Update line (trigger will auto-increment version)
      const updateQuery = `
        UPDATE quote_lines
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex++}
          AND tenant_id = $${paramIndex++}
          AND version = $${paramIndex++}
        RETURNING *
      `;

      updateValues.push(input.lineId, input.tenantId, input.expectedVersion);

      const updateResult = await client.query(updateQuery, updateValues);

      if (updateResult.rows.length === 0) {
        throw new QuoteLineVersionConflictException({
          message: 'Concurrent modification detected during update',
          expectedVersion: input.expectedVersion,
          actualVersion: currentLine.version + 1,
          conflictingChanges: []
        });
      }

      const updatedLine = updateResult.rows[0];

      // Record changes in audit trail
      await this.recordQuoteLineChanges(
        client,
        updatedLine.quote_id,
        input.lineId,
        input.tenantId,
        input.userId,
        currentLine,
        input.changes,
        input.sessionId,
        currentLine.version,
        updatedLine.version
      );

      // Recalculate quote totals if line changed
      await this.recalculateQuoteTotals(client, updatedLine.quote_id, input.tenantId);

      await client.query('COMMIT');

      return {
        line: updatedLine,
        previousVersion: currentLine.version,
        newVersion: updatedLine.version
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // CHANGE TRACKING
  // =====================================================

  private async recordQuoteChanges(
    client: PoolClient,
    quoteId: string,
    tenantId: string,
    userId: string,
    oldQuote: any,
    changes: any,
    sessionId: string | undefined,
    versionBefore: number,
    versionAfter: number
  ): Promise<void> {
    const changeRecords: any[] = [];

    // Track each field change
    for (const [field, newValue] of Object.entries(changes)) {
      const oldValue = oldQuote[field === 'termsAndConditions' ? 'terms_and_conditions' : field];

      if (oldValue !== newValue) {
        changeRecords.push({
          quoteId,
          tenantId,
          userId,
          entityType: 'QUOTE',
          fieldName: field,
          oldValue: JSON.stringify(oldValue),
          newValue: JSON.stringify(newValue),
          sessionId,
          versionBefore,
          versionAfter
        });
      }
    }

    // Insert all change records
    for (const record of changeRecords) {
      await client.query(
        `INSERT INTO quote_changes (
          tenant_id, quote_id, changed_by, entity_type, field_name,
          old_value, new_value, change_type, session_id,
          entity_version_before, entity_version_after
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'UPDATE', $8, $9, $10)`,
        [
          record.tenantId, record.quoteId, record.userId, record.entityType,
          record.fieldName, record.oldValue, record.newValue, record.sessionId,
          record.versionBefore, record.versionAfter
        ]
      );
    }
  }

  private async recordQuoteLineChanges(
    client: PoolClient,
    quoteId: string,
    lineId: string,
    tenantId: string,
    userId: string,
    oldLine: any,
    changes: any,
    sessionId: string | undefined,
    versionBefore: number,
    versionAfter: number
  ): Promise<void> {
    const changeRecords: any[] = [];

    // Map camelCase to snake_case
    const fieldMapping: Record<string, string> = {
      unitPrice: 'unit_price',
      discountPercentage: 'discount_percentage',
      leadTimeDays: 'lead_time_days',
      promisedDeliveryDate: 'promised_delivery_date'
    };

    // Track each field change
    for (const [field, newValue] of Object.entries(changes)) {
      const dbField = fieldMapping[field] || field;
      const oldValue = oldLine[dbField];

      if (oldValue !== newValue) {
        changeRecords.push({
          quoteId,
          lineId,
          tenantId,
          userId,
          entityType: 'QUOTE_LINE',
          fieldName: field,
          oldValue: JSON.stringify(oldValue),
          newValue: JSON.stringify(newValue),
          sessionId,
          versionBefore,
          versionAfter
        });
      }
    }

    // Insert all change records
    for (const record of changeRecords) {
      await client.query(
        `INSERT INTO quote_changes (
          tenant_id, quote_id, quote_line_id, changed_by, entity_type, field_name,
          old_value, new_value, change_type, session_id,
          entity_version_before, entity_version_after
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'UPDATE', $9, $10, $11)`,
        [
          record.tenantId, record.quoteId, record.lineId, record.userId,
          record.entityType, record.fieldName, record.oldValue, record.newValue,
          record.sessionId, record.versionBefore, record.versionAfter
        ]
      );
    }
  }

  private async getRecentQuoteChanges(
    client: PoolClient,
    quoteId: string,
    sinceVersion: number
  ): Promise<any[]> {
    const result = await client.query(
      `SELECT
        field_name,
        new_value,
        changed_by,
        changed_at
      FROM quote_changes
      WHERE quote_id = $1
        AND entity_version_after > $2
        AND entity_type = 'QUOTE'
      ORDER BY changed_at DESC`,
      [quoteId, sinceVersion]
    );

    return result.rows.map(row => ({
      field: row.field_name,
      currentValue: JSON.parse(row.new_value),
      lastChangedBy: row.changed_by,
      lastChangedAt: row.changed_at,
      yourValue: null // Caller will fill this in
    }));
  }

  private async getRecentQuoteLineChanges(
    client: PoolClient,
    lineId: string,
    sinceVersion: number
  ): Promise<any[]> {
    const result = await client.query(
      `SELECT
        field_name,
        new_value,
        changed_by,
        changed_at
      FROM quote_changes
      WHERE quote_line_id = $1
        AND entity_version_after > $2
        AND entity_type = 'QUOTE_LINE'
      ORDER BY changed_at DESC`,
      [lineId, sinceVersion]
    );

    return result.rows.map(row => ({
      field: row.field_name,
      currentValue: JSON.parse(row.new_value),
      lastChangedBy: row.changed_by,
      lastChangedAt: row.changed_at,
      yourValue: null
    }));
  }

  // =====================================================
  // QUOTE TOTALS RECALCULATION
  // =====================================================

  private async recalculateQuoteTotals(
    client: PoolClient,
    quoteId: string,
    tenantId: string
  ): Promise<void> {
    // Recalculate quote totals from lines
    await client.query(
      `UPDATE quotes
       SET
         subtotal = (
           SELECT COALESCE(SUM(line_amount), 0)
           FROM quote_lines
           WHERE quote_id = $1 AND tenant_id = $2
         ),
         total_amount = (
           SELECT COALESCE(SUM(line_amount), 0)
           FROM quote_lines
           WHERE quote_id = $1 AND tenant_id = $2
         ) + tax_amount + shipping_amount - discount_amount
       WHERE id = $1 AND tenant_id = $2`,
      [quoteId, tenantId]
    );
  }

  // =====================================================
  // PRESENCE TRACKING
  // =====================================================

  /**
   * Join a quote editing session
   */
  async joinQuoteSession(
    sessionId: string,
    quoteId: string,
    tenantId: string,
    userId: string,
    userName: string,
    userEmail: string
  ): Promise<ActiveSession> {
    const client = await this.db.connect();

    try {
      await client.query(
        `SET LOCAL app.current_tenant_id = $1`,
        [tenantId]
      );

      // Upsert session (in case of reconnect)
      const result = await client.query(
        `INSERT INTO active_quote_sessions (
          session_id, quote_id, tenant_id, user_id, user_name, user_email,
          joined_at, last_heartbeat, status
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 'VIEWING')
        ON CONFLICT (session_id) DO UPDATE SET
          last_heartbeat = NOW(),
          status = 'VIEWING'
        RETURNING *`,
        [sessionId, quoteId, tenantId, userId, userName, userEmail]
      );

      return this.mapToActiveSession(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Leave a quote editing session
   */
  async leaveQuoteSession(sessionId: string, tenantId: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query(
        `SET LOCAL app.current_tenant_id = $1`,
        [tenantId]
      );

      await client.query(
        `DELETE FROM active_quote_sessions WHERE session_id = $1`,
        [sessionId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update session heartbeat
   */
  async updateSessionHeartbeat(
    sessionId: string,
    tenantId: string,
    currentLineId?: string,
    currentField?: string,
    cursorPosition?: number,
    isEditing?: boolean
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query(
        `SET LOCAL app.current_tenant_id = $1`,
        [tenantId]
      );

      await client.query(
        `UPDATE active_quote_sessions
         SET
           last_heartbeat = NOW(),
           current_line_id = COALESCE($2, current_line_id),
           current_field = COALESCE($3, current_field),
           cursor_position = COALESCE($4, cursor_position),
           is_editing = COALESCE($5, is_editing),
           status = CASE
             WHEN $5 = TRUE THEN 'EDITING'
             ELSE 'VIEWING'
           END
         WHERE session_id = $1`,
        [sessionId, currentLineId, currentField, cursorPosition, isEditing]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get all active sessions for a quote
   */
  async getActiveQuoteSessions(
    quoteId: string,
    tenantId: string
  ): Promise<ActiveSession[]> {
    const client = await this.db.connect();

    try {
      await client.query(
        `SET LOCAL app.current_tenant_id = $1`,
        [tenantId]
      );

      const result = await client.query(
        `SELECT *
         FROM active_quote_sessions
         WHERE quote_id = $1
           AND last_heartbeat > NOW() - INTERVAL '30 seconds'
         ORDER BY joined_at`,
        [quoteId]
      );

      return result.rows.map(row => this.mapToActiveSession(row));
    } finally {
      client.release();
    }
  }

  /**
   * Cleanup stale sessions (called by scheduled job)
   */
  async cleanupStaleSessions(): Promise<number> {
    const client = await this.db.connect();

    try {
      const result = await client.query(
        `SELECT cleanup_stale_quote_sessions()`
      );

      return result.rows[0].cleanup_stale_quote_sessions;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // CHANGE HISTORY QUERIES
  // =====================================================

  /**
   * Get change history for a quote
   */
  async getQuoteChangeHistory(
    quoteId: string,
    tenantId: string,
    limit: number = 50
  ): Promise<QuoteChangeRecord[]> {
    const client = await this.db.connect();

    try {
      await client.query(
        `SET LOCAL app.current_tenant_id = $1`,
        [tenantId]
      );

      const result = await client.query(
        `SELECT *
         FROM quote_changes
         WHERE quote_id = $1
         ORDER BY changed_at DESC
         LIMIT $2`,
        [quoteId, limit]
      );

      return result.rows.map(row => this.mapToChangeRecord(row));
    } finally {
      client.release();
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private mapToActiveSession(row: any): ActiveSession {
    return {
      sessionId: row.session_id,
      quoteId: row.quote_id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      joinedAt: row.joined_at,
      lastHeartbeat: row.last_heartbeat,
      currentLineId: row.current_line_id,
      currentField: row.current_field,
      cursorPosition: row.cursor_position,
      isEditing: row.is_editing,
      status: row.status
    };
  }

  private mapToChangeRecord(row: any): QuoteChangeRecord {
    return {
      id: row.id,
      quoteId: row.quote_id,
      quoteLineId: row.quote_line_id,
      changedBy: row.changed_by,
      changedAt: row.changed_at,
      entityType: row.entity_type,
      fieldName: row.field_name,
      oldValue: row.old_value ? JSON.parse(row.old_value) : null,
      newValue: row.new_value ? JSON.parse(row.new_value) : null,
      changeType: row.change_type,
      wasConflict: row.was_conflict,
      conflictResolution: row.conflict_resolution,
      entityVersionBefore: row.entity_version_before,
      entityVersionAfter: row.entity_version_after
    };
  }
}
