/**
 * Contact Service
 *
 * Handles CRM contact management operations including:
 * - Contact CRUD operations
 * - Contact search and filtering
 * - Engagement tracking
 * - GDPR compliance
 */

import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import {
  Contact,
  CreateContactInput,
  UpdateContactInput,
} from '../interfaces/crm.interfaces';

@Injectable()
export class ContactService {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /**
   * Create a new contact
   */
  async createContact(
    tenantId: string,
    userId: string,
    input: CreateContactInput,
  ): Promise<Contact> {
    const query = `
      INSERT INTO crm_contacts (
        tenant_id,
        first_name,
        last_name,
        middle_name,
        suffix,
        customer_id,
        job_title,
        department,
        email_primary,
        email_secondary,
        phone_office,
        phone_mobile,
        phone_home,
        contact_type,
        lead_source,
        owner_user_id,
        notes,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const values = [
      tenantId,
      input.firstName,
      input.lastName,
      input.middleName || null,
      input.suffix || null,
      input.customerId || null,
      input.jobTitle || null,
      input.department || null,
      input.emailPrimary || null,
      input.emailSecondary || null,
      input.phoneOffice || null,
      input.phoneMobile || null,
      input.phoneHome || null,
      input.contactType || null,
      input.leadSource || null,
      input.ownerUserId || userId,
      input.notes || null,
      userId,
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToContact(result.rows[0]);
  }

  /**
   * Update an existing contact
   */
  async updateContact(
    tenantId: string,
    userId: string,
    input: UpdateContactInput,
  ): Promise<Contact> {
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [tenantId, input.id];
    let paramCount = 3;

    if (input.firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(input.firstName);
    }
    if (input.lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(input.lastName);
    }
    if (input.jobTitle !== undefined) {
      updates.push(`job_title = $${paramCount++}`);
      values.push(input.jobTitle);
    }
    if (input.emailPrimary !== undefined) {
      updates.push(`email_primary = $${paramCount++}`);
      values.push(input.emailPrimary);
    }
    if (input.phoneMobile !== undefined) {
      updates.push(`phone_mobile = $${paramCount++}`);
      values.push(input.phoneMobile);
    }
    if (input.nextFollowUpDate !== undefined) {
      updates.push(`next_follow_up_date = $${paramCount++}`);
      values.push(input.nextFollowUpDate);
    }
    if (input.ownerUserId !== undefined) {
      updates.push(`owner_user_id = $${paramCount++}`);
      values.push(input.ownerUserId);
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(input.notes);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramCount++}`);
    values.push(userId);

    const query = `
      UPDATE crm_contacts
      SET ${updates.join(', ')}
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Contact with ID ${input.id} not found`);
    }

    return this.mapRowToContact(result.rows[0]);
  }

  /**
   * Get contact by ID
   */
  async getContactById(tenantId: string, contactId: string): Promise<Contact> {
    const query = `
      SELECT *
      FROM crm_contacts
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
    `;

    const result = await this.pool.query(query, [tenantId, contactId]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Contact with ID ${contactId} not found`);
    }

    return this.mapRowToContact(result.rows[0]);
  }

  /**
   * Get contacts by customer
   */
  async getContactsByCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<Contact[]> {
    const query = `
      SELECT *
      FROM crm_contacts
      WHERE tenant_id = $1
        AND customer_id = $2
        AND deleted_at IS NULL
      ORDER BY is_active DESC, last_name, first_name
    `;

    const result = await this.pool.query(query, [tenantId, customerId]);
    return result.rows.map(row => this.mapRowToContact(row));
  }

  /**
   * Get contacts by owner (sales rep)
   */
  async getContactsByOwner(
    tenantId: string,
    ownerUserId: string,
  ): Promise<Contact[]> {
    const query = `
      SELECT *
      FROM crm_contacts
      WHERE tenant_id = $1
        AND owner_user_id = $2
        AND deleted_at IS NULL
      ORDER BY is_active DESC, last_name, first_name
    `;

    const result = await this.pool.query(query, [tenantId, ownerUserId]);
    return result.rows.map(row => this.mapRowToContact(row));
  }

  /**
   * Search contacts
   */
  async searchContacts(
    tenantId: string,
    searchTerm: string,
  ): Promise<Contact[]> {
    const query = `
      SELECT *
      FROM crm_contacts
      WHERE tenant_id = $1
        AND deleted_at IS NULL
        AND (
          first_name ILIKE $2
          OR last_name ILIKE $2
          OR email_primary ILIKE $2
          OR company_size ILIKE $2
        )
      ORDER BY is_active DESC, last_name, first_name
      LIMIT 50
    `;

    const searchPattern = `%${searchTerm}%`;
    const result = await this.pool.query(query, [tenantId, searchPattern]);
    return result.rows.map(row => this.mapRowToContact(row));
  }

  /**
   * Get contacts requiring follow-up
   */
  async getContactsRequiringFollowUp(
    tenantId: string,
    ownerUserId?: string,
  ): Promise<Contact[]> {
    let query = `
      SELECT *
      FROM crm_contacts
      WHERE tenant_id = $1
        AND deleted_at IS NULL
        AND is_active = TRUE
        AND next_follow_up_date IS NOT NULL
        AND next_follow_up_date <= NOW() + INTERVAL '7 days'
    `;

    const values: any[] = [tenantId];

    if (ownerUserId) {
      query += ` AND owner_user_id = $2`;
      values.push(ownerUserId);
    }

    query += ` ORDER BY next_follow_up_date`;

    const result = await this.pool.query(query, values);
    return result.rows.map(row => this.mapRowToContact(row));
  }

  /**
   * Update contact engagement score
   */
  async updateEngagementScore(
    tenantId: string,
    contactId: string,
    score: number,
  ): Promise<void> {
    const query = `
      UPDATE crm_contacts
      SET engagement_score = $3,
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
    `;

    await this.pool.query(query, [tenantId, contactId, score]);
  }

  /**
   * Record contact interaction
   */
  async recordInteraction(
    tenantId: string,
    contactId: string,
    interactionType: string,
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

    await this.pool.query(query, [tenantId, contactId, interactionType]);
  }

  /**
   * Soft delete contact
   */
  async deleteContact(
    tenantId: string,
    contactId: string,
    userId: string,
  ): Promise<void> {
    const query = `
      UPDATE crm_contacts
      SET deleted_at = NOW(),
          deleted_by = $3
      WHERE tenant_id = $1
        AND id = $2
        AND deleted_at IS NULL
    `;

    const result = await this.pool.query(query, [tenantId, contactId, userId]);

    if (result.rowCount === 0) {
      throw new NotFoundException(`Contact with ID ${contactId} not found`);
    }
  }

  /**
   * Map database row to Contact interface
   */
  private mapRowToContact(row: any): Contact {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      firstName: row.first_name,
      lastName: row.last_name,
      middleName: row.middle_name,
      suffix: row.suffix,
      customerId: row.customer_id,
      jobTitle: row.job_title,
      department: row.department,
      emailPrimary: row.email_primary,
      emailSecondary: row.email_secondary,
      phoneOffice: row.phone_office,
      phoneMobile: row.phone_mobile,
      phoneHome: row.phone_home,
      linkedinUrl: row.linkedin_url,
      twitterHandle: row.twitter_handle,
      websiteUrl: row.website_url,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      country: row.country,
      contactType: row.contact_type,
      leadSource: row.lead_source,
      industry: row.industry,
      companySize: row.company_size,
      preferredContactMethod: row.preferred_contact_method,
      communicationFrequency: row.communication_frequency,
      timezone: row.timezone,
      languageCode: row.language_code,
      interests: row.interests,
      painPoints: row.pain_points,
      buyingAuthority: row.buying_authority,
      lastContactDate: row.last_contact_date,
      lastContactType: row.last_contact_type,
      nextFollowUpDate: row.next_follow_up_date,
      engagementScore: row.engagement_score,
      ownerUserId: row.owner_user_id,
      isActive: row.is_active,
      doNotContact: row.do_not_contact,
      emailOptOut: row.email_opt_out,
      marketingConsent: row.marketing_consent,
      marketingConsentDate: row.marketing_consent_date,
      marketingConsentSource: row.marketing_consent_source,
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
