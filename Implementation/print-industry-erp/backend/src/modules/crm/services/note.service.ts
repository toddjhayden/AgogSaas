/**
 * Note Service
 *
 * Handles CRM notes attached to various entities
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { Note, CreateNoteInput } from '../interfaces/crm.interfaces';

@Injectable()
export class NoteService {
  constructor(private readonly pool: Pool) {}

  /**
   * Create a new note
   */
  async createNote(
    tenantId: string,
    userId: string,
    input: CreateNoteInput,
  ): Promise<Note> {
    // Validate that at least one parent entity is specified
    if (
      !input.opportunityId &&
      !input.contactId &&
      !input.customerId &&
      !input.activityId
    ) {
      throw new BadRequestException(
        'Note must be attached to at least one entity (opportunity, contact, customer, or activity)',
      );
    }

    const query = `
      INSERT INTO crm_notes (
        tenant_id,
        note_title,
        note_content,
        opportunity_id,
        contact_id,
        customer_id,
        activity_id,
        note_type,
        is_pinned,
        is_private,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      tenantId,
      input.noteTitle || null,
      input.noteContent,
      input.opportunityId || null,
      input.contactId || null,
      input.customerId || null,
      input.activityId || null,
      input.noteType || null,
      input.isPinned || false,
      input.isPrivate || false,
      userId,
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToNote(result.rows[0]);
  }

  /**
   * Get note by ID
   */
  async getNoteById(tenantId: string, noteId: string, userId: string): Promise<Note> {
    const query = `
      SELECT *
      FROM crm_notes
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND (is_private = FALSE OR created_by = $3)
    `;

    const result = await this.pool.query(query, [tenantId, noteId, userId]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Note with ID ${noteId} not found`);
    }

    return this.mapRowToNote(result.rows[0]);
  }

  /**
   * Get notes for an opportunity
   */
  async getNotesByOpportunity(
    tenantId: string,
    opportunityId: string,
    userId: string,
  ): Promise<Note[]> {
    const query = `
      SELECT *
      FROM crm_notes
      WHERE tenant_id = $1
        AND opportunity_id = $2
        AND deleted_at IS NULL
        AND (is_private = FALSE OR created_by = $3)
      ORDER BY is_pinned DESC, created_at DESC
    `;

    const result = await this.pool.query(query, [tenantId, opportunityId, userId]);
    return result.rows.map(row => this.mapRowToNote(row));
  }

  /**
   * Get notes for a contact
   */
  async getNotesByContact(
    tenantId: string,
    contactId: string,
    userId: string,
  ): Promise<Note[]> {
    const query = `
      SELECT *
      FROM crm_notes
      WHERE tenant_id = $1
        AND contact_id = $2
        AND deleted_at IS NULL
        AND (is_private = FALSE OR created_by = $3)
      ORDER BY is_pinned DESC, created_at DESC
    `;

    const result = await this.pool.query(query, [tenantId, contactId, userId]);
    return result.rows.map(row => this.mapRowToNote(row));
  }

  /**
   * Get notes for a customer
   */
  async getNotesByCustomer(
    tenantId: string,
    customerId: string,
    userId: string,
  ): Promise<Note[]> {
    const query = `
      SELECT *
      FROM crm_notes
      WHERE tenant_id = $1
        AND customer_id = $2
        AND deleted_at IS NULL
        AND (is_private = FALSE OR created_by = $3)
      ORDER BY is_pinned DESC, created_at DESC
    `;

    const result = await this.pool.query(query, [tenantId, customerId, userId]);
    return result.rows.map(row => this.mapRowToNote(row));
  }

  /**
   * Toggle note pin status
   */
  async togglePinNote(
    tenantId: string,
    noteId: string,
    userId: string,
  ): Promise<Note> {
    const query = `
      UPDATE crm_notes
      SET is_pinned = NOT is_pinned,
          updated_at = NOW(),
          updated_by = $3
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.pool.query(query, [tenantId, noteId, userId]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Note with ID ${noteId} not found`);
    }

    return this.mapRowToNote(result.rows[0]);
  }

  /**
   * Update note content
   */
  async updateNote(
    tenantId: string,
    noteId: string,
    userId: string,
    noteContent: string,
    noteTitle?: string,
  ): Promise<Note> {
    const query = `
      UPDATE crm_notes
      SET note_content = $3,
          note_title = COALESCE($4, note_title),
          updated_at = NOW(),
          updated_by = $5
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND created_by = $5
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      tenantId,
      noteId,
      noteContent,
      noteTitle || null,
      userId,
    ]);

    if (result.rows.length === 0) {
      throw new NotFoundException(
        `Note with ID ${noteId} not found or you don't have permission to update it`,
      );
    }

    return this.mapRowToNote(result.rows[0]);
  }

  /**
   * Soft delete note
   */
  async deleteNote(
    tenantId: string,
    noteId: string,
    userId: string,
  ): Promise<void> {
    const query = `
      UPDATE crm_notes
      SET deleted_at = NOW(),
          deleted_by = $3
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND created_by = $3
    `;

    const result = await this.pool.query(query, [tenantId, noteId, userId]);

    if (result.rowCount === 0) {
      throw new NotFoundException(
        `Note with ID ${noteId} not found or you don't have permission to delete it`,
      );
    }
  }

  /**
   * Map database row to Note interface
   */
  private mapRowToNote(row: any): Note {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      noteTitle: row.note_title,
      noteContent: row.note_content,
      opportunityId: row.opportunity_id,
      contactId: row.contact_id,
      customerId: row.customer_id,
      activityId: row.activity_id,
      noteType: row.note_type,
      isPinned: row.is_pinned,
      isPrivate: row.is_private,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
    };
  }
}
