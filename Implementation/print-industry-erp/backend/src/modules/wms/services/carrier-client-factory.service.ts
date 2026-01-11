import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICarrierClient, ICarrierClientFactory } from '../interfaces/carrier-client.interface';
import { FedExClientService } from './carriers/fedex-client.service';
import { UPSClientService } from './carriers/ups-client.service';
import { Pool } from 'pg';
import { CredentialEncryptionService } from './credential-encryption.service';

/**
 * Carrier Client Factory Service
 *
 * REQ-1767925582663-ieqg0: Complete FedEx Carrier Integration & Multi-Carrier Network
 *
 * Provides centralized carrier client creation and management.
 * Implements:
 * - Strategy Pattern for carrier selection
 * - Lazy loading of carrier credentials
 * - Client caching for performance
 * - Dynamic carrier registration
 * - Credential decryption and configuration
 *
 * Supported Carriers:
 * - FedEx (production-ready with FedEx Ship API v1)
 * - UPS (mock implementation, ready for UPS API integration)
 *
 * Future Carriers:
 * - USPS
 * - DHL
 * - Canada Post
 * - Custom carriers
 */
@Injectable()
export class CarrierClientFactoryService implements ICarrierClientFactory {
  private readonly logger = new Logger(CarrierClientFactoryService.name);
  private clientCache = new Map<string, ICarrierClient>();
  private carrierConfigs = new Map<string, any>();

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly credentialService: CredentialEncryptionService,
    private readonly fedexClient: FedExClientService,
    private readonly upsClient: UPSClientService,
  ) {
    // Register available carrier clients
    this.registerCarrier('FEDEX', this.fedexClient);
    this.registerCarrier('UPS', this.upsClient);
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
   * @returns Configured carrier client with decrypted credentials
   */
  async getClientForIntegration(
    tenantId: string,
    carrierIntegrationId: string
  ): Promise<ICarrierClient> {
    // Load carrier integration from database
    const result = await this.db.query(
      `SELECT carrier_code, api_endpoint, carrier_account_number,
              api_key_encrypted, api_password_encrypted, oauth_token_encrypted,
              service_level_mapping, environment
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
    const carrierCode = config.carrier_code.toUpperCase();

    // Get base carrier client
    const client = this.getClient(carrierCode);

    // Decrypt and configure carrier-specific credentials
    try {
      if (carrierCode === 'FEDEX') {
        const apiKey = config.api_key_encrypted
          ? await this.credentialService.decrypt(config.api_key_encrypted, carrierIntegrationId)
          : '';
        const secretKey = config.api_password_encrypted
          ? await this.credentialService.decrypt(config.api_password_encrypted, carrierIntegrationId)
          : '';

        (client as FedExClientService).configure({
          apiKey,
          secretKey,
          accountNumber: config.carrier_account_number,
          environment: config.environment === 'PRODUCTION' ? 'PRODUCTION' : 'TEST',
        });

        this.logger.log(`Configured FedEx client for carrier integration ${carrierIntegrationId}`);
      } else if (carrierCode === 'UPS') {
        const clientId = config.api_key_encrypted
          ? await this.credentialService.decrypt(config.api_key_encrypted, carrierIntegrationId)
          : '';
        const clientSecret = config.api_password_encrypted
          ? await this.credentialService.decrypt(config.api_password_encrypted, carrierIntegrationId)
          : '';

        (client as UPSClientService).configure({
          clientId,
          clientSecret,
          accountNumber: config.carrier_account_number,
          environment: config.environment === 'PRODUCTION' ? 'PRODUCTION' : 'TEST',
        });

        this.logger.log(`Configured UPS client for carrier integration ${carrierIntegrationId}`);
      } else {
        this.logger.warn(`No configuration handler for carrier: ${carrierCode}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to configure carrier client: ${error.message}`);
      throw new Error(`Failed to configure ${carrierCode} client: ${error.message}`);
    }

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
