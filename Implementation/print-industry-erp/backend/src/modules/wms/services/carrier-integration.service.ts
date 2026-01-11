import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { CredentialEncryptionService } from './credential-encryption.service';

/**
 * Carrier Integration Service
 *
 * REQ-1767925582663-ieqg0: FedEx Carrier Integration & Multi-Carrier Network
 *
 * Manages carrier integration configurations in the database.
 * Handles CRUD operations for carrier accounts, credentials, and service mappings.
 *
 * Features:
 * - Secure credential storage with encryption
 * - Multi-tenant isolation
 * - Facility-level carrier configuration
 * - Service mapping management
 * - Connection health monitoring
 */

export interface CarrierIntegration {
  id: string;
  tenantId: string;
  facilityId: string;
  carrierCode: string;
  carrierName: string;
  carrierType: string;
  apiEndpoint?: string;
  apiVersion?: string;
  accountNumber: string;
  billingAccountNumber?: string;
  serviceMapping?: any;
  defaultServiceCode?: string;
  labelFormat?: string;
  isActive: boolean;
  connectionStatus?: string;
  lastConnectionTest?: Date;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface CreateCarrierIntegrationInput {
  facilityId: string;
  carrierCode: string;
  carrierName: string;
  carrierType: string;
  apiEndpoint?: string;
  apiVersion?: string;
  accountNumber: string;
  billingAccountNumber?: string;
  apiUsername?: string;
  apiPassword?: string;
  apiKey?: string;
  oauthToken?: string;
  serviceMapping?: any;
  defaultServiceCode?: string;
  labelFormat?: string;
  isActive?: boolean;
}

export interface UpdateCarrierIntegrationInput {
  carrierName?: string;
  apiEndpoint?: string;
  apiVersion?: string;
  accountNumber?: string;
  apiUsername?: string;
  apiPassword?: string;
  apiKey?: string;
  oauthToken?: string;
  serviceMapping?: any;
  defaultServiceCode?: string;
  labelFormat?: string;
  isActive?: boolean;
}

@Injectable()
export class CarrierIntegrationService {
  private pool: Pool;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly credentialEncryption: CredentialEncryptionService,
  ) {
    this.pool = this.databaseService.getPool();
  }

  /**
   * Get all carrier integrations for a tenant
   */
  async findAll(tenantId: string, facilityId?: string): Promise<CarrierIntegration[]> {
    const query = facilityId
      ? `
        SELECT
          id, tenant_id, facility_id, carrier_code, carrier_name, carrier_account_number as account_number,
          billing_account_number, api_endpoint, available_services as service_mapping,
          default_service_code, label_format, is_active, connection_status,
          last_connection_test, created_at, created_by, updated_at, updated_by
        FROM carrier_integrations
        WHERE tenant_id = $1 AND facility_id = $2
        ORDER BY carrier_name
      `
      : `
        SELECT
          id, tenant_id, facility_id, carrier_code, carrier_name, carrier_account_number as account_number,
          billing_account_number, api_endpoint, available_services as service_mapping,
          default_service_code, label_format, is_active, connection_status,
          last_connection_test, created_at, created_by, updated_at, updated_by
        FROM carrier_integrations
        WHERE tenant_id = $1
        ORDER BY carrier_name
      `;

    const params = facilityId ? [tenantId, facilityId] : [tenantId];
    const result = await this.pool.query(query, params);

    return result.rows.map((row) => this.mapRowToCarrierIntegration(row));
  }

  /**
   * Get a single carrier integration by ID
   */
  async findById(id: string, tenantId: string): Promise<CarrierIntegration> {
    const query = `
      SELECT
        id, tenant_id, facility_id, carrier_code, carrier_name, carrier_account_number as account_number,
        billing_account_number, api_endpoint, available_services as service_mapping,
        default_service_code, label_format, is_active, connection_status,
        last_connection_test, created_at, created_by, updated_at, updated_by
      FROM carrier_integrations
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [id, tenantId]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Carrier integration ${id} not found`);
    }

    return this.mapRowToCarrierIntegration(result.rows[0]);
  }

  /**
   * Get carrier integration by carrier code and facility
   */
  async findByCarrierCode(
    tenantId: string,
    facilityId: string,
    carrierCode: string,
  ): Promise<CarrierIntegration | null> {
    const query = `
      SELECT
        id, tenant_id, facility_id, carrier_code, carrier_name, carrier_account_number as account_number,
        billing_account_number, api_endpoint, available_services as service_mapping,
        default_service_code, label_format, is_active, connection_status,
        last_connection_test, created_at, created_by, updated_at, updated_by
      FROM carrier_integrations
      WHERE tenant_id = $1 AND facility_id = $2 AND carrier_code = $3 AND is_active = true
      LIMIT 1
    `;

    const result = await this.pool.query(query, [tenantId, facilityId, carrierCode]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCarrierIntegration(result.rows[0]);
  }

  /**
   * Create a new carrier integration
   */
  async create(
    tenantId: string,
    userId: string,
    input: CreateCarrierIntegrationInput,
  ): Promise<CarrierIntegration> {
    // Encrypt credentials if provided
    const apiPasswordEncrypted = input.apiPassword
      ? await this.credentialEncryption.encrypt(input.apiPassword)
      : null;
    const apiKeyEncrypted = input.apiKey
      ? await this.credentialEncryption.encrypt(input.apiKey)
      : null;
    const oauthTokenEncrypted = input.oauthToken
      ? await this.credentialEncryption.encrypt(input.oauthToken)
      : null;

    const query = `
      INSERT INTO carrier_integrations (
        tenant_id, facility_id, carrier_code, carrier_name,
        carrier_account_number, billing_account_number,
        api_endpoint, api_username, api_password_encrypted, api_key_encrypted, oauth_token_encrypted,
        available_services, default_service_code, label_format,
        is_active, connection_status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, tenant_id, facility_id, carrier_code, carrier_name,
                carrier_account_number as account_number, billing_account_number,
                api_endpoint, available_services as service_mapping,
                default_service_code, label_format, is_active, connection_status,
                created_at, created_by
    `;

    const result = await this.pool.query(query, [
      tenantId,
      input.facilityId,
      input.carrierCode,
      input.carrierName,
      input.accountNumber,
      input.billingAccountNumber || null,
      input.apiEndpoint || null,
      input.apiUsername || null,
      apiPasswordEncrypted,
      apiKeyEncrypted,
      oauthTokenEncrypted,
      input.serviceMapping ? JSON.stringify(input.serviceMapping) : null,
      input.defaultServiceCode || null,
      input.labelFormat || 'PDF',
      input.isActive !== false,
      'PENDING',
      userId,
    ]);

    return this.mapRowToCarrierIntegration(result.rows[0]);
  }

  /**
   * Update an existing carrier integration
   */
  async update(
    id: string,
    tenantId: string,
    userId: string,
    input: UpdateCarrierIntegrationInput,
  ): Promise<CarrierIntegration> {
    // Verify carrier exists
    await this.findById(id, tenantId);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.carrierName !== undefined) {
      updates.push(`carrier_name = $${paramIndex++}`);
      values.push(input.carrierName);
    }

    if (input.apiEndpoint !== undefined) {
      updates.push(`api_endpoint = $${paramIndex++}`);
      values.push(input.apiEndpoint);
    }

    if (input.apiVersion !== undefined) {
      updates.push(`api_version = $${paramIndex++}`);
      values.push(input.apiVersion);
    }

    if (input.accountNumber !== undefined) {
      updates.push(`carrier_account_number = $${paramIndex++}`);
      values.push(input.accountNumber);
    }

    if (input.apiUsername !== undefined) {
      updates.push(`api_username = $${paramIndex++}`);
      values.push(input.apiUsername);
    }

    if (input.apiPassword !== undefined) {
      const encrypted = await this.credentialEncryption.encrypt(input.apiPassword);
      updates.push(`api_password_encrypted = $${paramIndex++}`);
      values.push(encrypted);
    }

    if (input.apiKey !== undefined) {
      const encrypted = await this.credentialEncryption.encrypt(input.apiKey);
      updates.push(`api_key_encrypted = $${paramIndex++}`);
      values.push(encrypted);
    }

    if (input.oauthToken !== undefined) {
      const encrypted = await this.credentialEncryption.encrypt(input.oauthToken);
      updates.push(`oauth_token_encrypted = $${paramIndex++}`);
      values.push(encrypted);
    }

    if (input.serviceMapping !== undefined) {
      updates.push(`available_services = $${paramIndex++}`);
      values.push(JSON.stringify(input.serviceMapping));
    }

    if (input.defaultServiceCode !== undefined) {
      updates.push(`default_service_code = $${paramIndex++}`);
      values.push(input.defaultServiceCode);
    }

    if (input.labelFormat !== undefined) {
      updates.push(`label_format = $${paramIndex++}`);
      values.push(input.labelFormat);
    }

    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.isActive);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);

    values.push(id, tenantId);

    const query = `
      UPDATE carrier_integrations
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++}
      RETURNING id, tenant_id, facility_id, carrier_code, carrier_name,
                carrier_account_number as account_number, billing_account_number,
                api_endpoint, available_services as service_mapping,
                default_service_code, label_format, is_active, connection_status,
                last_connection_test, updated_at, updated_by
    `;

    const result = await this.pool.query(query, values);

    return this.mapRowToCarrierIntegration(result.rows[0]);
  }

  /**
   * Delete a carrier integration (soft delete)
   */
  async delete(id: string, tenantId: string): Promise<boolean> {
    const query = `
      DELETE FROM carrier_integrations
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [id, tenantId]);

    return result.rowCount > 0;
  }

  /**
   * Update connection status
   */
  async updateConnectionStatus(
    id: string,
    tenantId: string,
    status: string,
  ): Promise<void> {
    const query = `
      UPDATE carrier_integrations
      SET connection_status = $1, last_connection_test = NOW()
      WHERE id = $2 AND tenant_id = $3
    `;

    await this.pool.query(query, [status, id, tenantId]);
  }

  /**
   * Get decrypted credentials for API calls
   * WARNING: Only call this when actually making API requests
   */
  async getCredentials(id: string, tenantId: string): Promise<{
    apiUsername?: string;
    apiPassword?: string;
    apiKey?: string;
    oauthToken?: string;
  }> {
    const query = `
      SELECT api_username, api_password_encrypted, api_key_encrypted, oauth_token_encrypted
      FROM carrier_integrations
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [id, tenantId]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Carrier integration ${id} not found`);
    }

    const row = result.rows[0];

    return {
      apiUsername: row.api_username,
      apiPassword: row.api_password_encrypted
        ? await this.credentialEncryption.decrypt(row.api_password_encrypted)
        : undefined,
      apiKey: row.api_key_encrypted
        ? await this.credentialEncryption.decrypt(row.api_key_encrypted)
        : undefined,
      oauthToken: row.oauth_token_encrypted
        ? await this.credentialEncryption.decrypt(row.oauth_token_encrypted)
        : undefined,
    };
  }

  /**
   * Map database row to CarrierIntegration object
   */
  private mapRowToCarrierIntegration(row: any): CarrierIntegration {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      carrierCode: row.carrier_code,
      carrierName: row.carrier_name,
      carrierType: this.inferCarrierType(row.carrier_code),
      apiEndpoint: row.api_endpoint,
      apiVersion: row.api_version,
      accountNumber: row.account_number,
      billingAccountNumber: row.billing_account_number,
      serviceMapping: row.service_mapping,
      defaultServiceCode: row.default_service_code,
      labelFormat: row.label_format,
      isActive: row.is_active,
      connectionStatus: row.connection_status,
      lastConnectionTest: row.last_connection_test,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
  }

  /**
   * Infer carrier type from carrier code
   */
  private inferCarrierType(carrierCode: string): string {
    const typeMap: Record<string, string> = {
      FEDEX: 'PARCEL',
      UPS: 'PARCEL',
      USPS: 'PARCEL',
      DHL: 'PARCEL',
      FREIGHT: 'LTL',
    };

    return typeMap[carrierCode] || 'PARCEL';
  }
}
