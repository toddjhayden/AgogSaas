import { Injectable, Inject } from '@nestjs/common';
import { ICarrierClient, ICarrierClientFactory } from '../interfaces/carrier-client.interface';
import { FedExClientService } from './carriers/fedex-client.service';
import { Pool } from 'pg';
import { CredentialEncryptionService } from './credential-encryption.service';

/**
 * Carrier Client Factory Service
 *
 * REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
 * Strategy Pattern implementation from Sylvia's critique
 *
 * Provides centralized carrier client creation and management.
 * Implements:
 * - Strategy Pattern for carrier selection
 * - Lazy loading of carrier credentials
 * - Client caching for performance
 * - Dynamic carrier registration
 *
 * Supported Carriers (Phase 1):
 * - FedEx (mock implementation)
 *
 * Future Carriers:
 * - UPS
 * - USPS
 * - DHL
 * - Canada Post
 * - Custom carriers
 */
@Injectable()
export class CarrierClientFactoryService implements ICarrierClientFactory {
  private clientCache = new Map<string, ICarrierClient>();
  private carrierConfigs = new Map<string, any>();

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly credentialService: CredentialEncryptionService,
    private readonly fedexClient: FedExClientService
  ) {
    // Register available carrier clients
    this.registerCarrier('FEDEX', this.fedexClient);
  }

  /**
   * Gets a carrier client by carrier code
   *
   * @param carrierCode - Carrier identifier (FEDEX, UPS, etc.)
   * @returns Configured carrier client
   * @throws Error if carrier is not supported
   */
  getClient(carrierCode: string): ICarrierClient {
    const normalizedCode = carrierCode.toUpperCase();

    // Check if client is cached
    if (this.clientCache.has(normalizedCode)) {
      return this.clientCache.get(normalizedCode)!;
    }

    throw new Error(
      `Carrier ${carrierCode} is not supported. ` +
      `Supported carriers: ${Array.from(this.clientCache.keys()).join(', ')}`
    );
  }

  /**
   * Gets carrier client for a tenant's carrier integration
   *
   * @param tenantId - Tenant identifier
   * @param carrierIntegrationId - Carrier integration ID from database
   * @returns Configured carrier client
   */
  async getClientForIntegration(
    tenantId: string,
    carrierIntegrationId: string
  ): Promise<ICarrierClient> {
    // Load carrier integration from database
    const result = await this.db.query(
      `SELECT carrier_code, api_endpoint, api_username,
              api_password_encrypted, api_key_encrypted, oauth_token_encrypted,
              account_number, service_level_mapping
       FROM carrier_integrations
       WHERE id = $1 AND tenant_id = $2 AND is_active = true AND deleted_at IS NULL`,
      [carrierIntegrationId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error(
        `Carrier integration ${carrierIntegrationId} not found or inactive for tenant ${tenantId}`
      );
    }

    const config = result.rows[0];
    const carrierCode = config.carrier_code;

    // Get base carrier client
    const client = this.getClient(carrierCode);

    // TODO: Configure client with tenant-specific credentials
    // For now, return unconfigured client (works for mock implementations)
    // In production:
    // 1. Decrypt credentials using credentialService
    // 2. Set credentials on client
    // 3. Configure API endpoint if custom
    // 4. Set account number
    // 5. Cache configured client

    return client;
  }

  /**
   * Gets all available carrier clients
   */
  getAllClients(): ICarrierClient[] {
    return Array.from(this.clientCache.values());
  }

  /**
   * Checks if a carrier is supported
   */
  isCarrierSupported(carrierCode: string): boolean {
    return this.clientCache.has(carrierCode.toUpperCase());
  }

  /**
   * Registers a carrier client
   * Used internally and can be used for dynamic carrier registration
   */
  private registerCarrier(carrierCode: string, client: ICarrierClient): void {
    this.clientCache.set(carrierCode.toUpperCase(), client);
    console.log(`Registered carrier client: ${carrierCode}`);
  }

  /**
   * Gets supported carrier codes
   */
  getSupportedCarriers(): string[] {
    return Array.from(this.clientCache.keys());
  }

  /**
   * Gets carrier capabilities
   */
  getCarrierCapabilities(carrierCode: string): {
    supportsAddressValidation: boolean;
    supportsRateQuotes: boolean;
    supportsLabelGeneration: boolean;
    supportsTracking: boolean;
    supportsManifesting: boolean;
    supportsInternational: boolean;
  } {
    // For now, all mock carriers support all features
    // In production, query carrier_integrations table for actual capabilities
    return {
      supportsAddressValidation: true,
      supportsRateQuotes: true,
      supportsLabelGeneration: true,
      supportsTracking: true,
      supportsManifesting: true,
      supportsInternational: false // Phase 2 feature
    };
  }
}
