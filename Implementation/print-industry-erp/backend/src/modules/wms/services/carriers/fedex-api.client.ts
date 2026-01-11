import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * FedEx API Client - Production Implementation
 *
 * REQ-1767925582663-ieqg0: FedEx Carrier Integration & Multi-Carrier Network
 *
 * Implements FedEx Ship API v1 with OAuth2 authentication.
 *
 * Features:
 * - OAuth2 token management with auto-refresh
 * - Ship API integration (rate quotes, label generation)
 * - Track API integration
 * - Address validation
 * - End-of-day manifest (Close API)
 *
 * API Documentation:
 * https://developer.fedex.com/api/en-us/catalog/ship/docs.html
 */

export interface FedExCredentials {
  apiKey: string;
  secretKey: string;
  accountNumber: string;
  meterNumber?: string;
  environment: 'TEST' | 'PRODUCTION';
}

export interface FedExOAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  expires_at: Date;
}

@Injectable()
export class FedExApiClient {
  private readonly logger = new Logger(FedExApiClient.name);

  private readonly endpoints = {
    TEST: 'https://apis-sandbox.fedex.com',
    PRODUCTION: 'https://apis.fedex.com',
  };

  private tokenCache = new Map<string, FedExOAuthToken>();

  constructor(private readonly httpService: HttpService) {}

  /**
   * Get OAuth2 access token (cached with auto-refresh)
   */
  async getAccessToken(credentials: FedExCredentials): Promise<string> {
    const cacheKey = credentials.apiKey;
    const cached = this.tokenCache.get(cacheKey);

    // Return cached token if still valid (with 5 min buffer)
    if (cached && cached.expires_at > new Date(Date.now() + 5 * 60 * 1000)) {
      return cached.access_token;
    }

    // Request new token
    const baseUrl = this.endpoints[credentials.environment];
    const url = `${baseUrl}/oauth/token`;

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.apiKey,
      client_secret: credentials.secretKey,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      const token: FedExOAuthToken = {
        access_token: response.data.access_token,
        token_type: response.data.token_type,
        expires_in: response.data.expires_in,
        scope: response.data.scope,
        expires_at: new Date(Date.now() + response.data.expires_in * 1000),
      };

      this.tokenCache.set(cacheKey, token);
      this.logger.log(`FedEx OAuth token acquired, expires in ${token.expires_in}s`);

      return token.access_token;
    } catch (error: any) {
      this.logger.error(`FedEx OAuth error: ${error.message}`, error.stack);
      throw new Error(`Failed to get FedEx access token: ${error.message}`);
    }
  }

  /**
   * Validate shipping address
   */
  async validateAddress(
    credentials: FedExCredentials,
    address: {
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state?: string;
      postalCode: string;
      country: string;
    },
  ): Promise<any> {
    const token = await this.getAccessToken(credentials);
    const baseUrl = this.endpoints[credentials.environment];
    const url = `${baseUrl}/address/v1/addresses/resolve`;

    const payload = {
      addressesToValidate: [
        {
          address: {
            streetLines: [address.addressLine1, address.addressLine2].filter(Boolean),
            city: address.city,
            stateOrProvinceCode: address.state,
            postalCode: address.postalCode,
            countryCode: address.country,
          },
        },
      ],
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`FedEx address validation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get rate quotes for shipment
   */
  async getRates(
    credentials: FedExCredentials,
    shipment: {
      shipper: any;
      recipient: any;
      packages: any[];
      serviceType?: string;
    },
  ): Promise<any> {
    const token = await this.getAccessToken(credentials);
    const baseUrl = this.endpoints[credentials.environment];
    const url = `${baseUrl}/rate/v1/rates/quotes`;

    const payload = {
      accountNumber: {
        value: credentials.accountNumber,
      },
      requestedShipment: {
        shipper: shipment.shipper,
        recipient: shipment.recipient,
        serviceType: shipment.serviceType,
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        rateRequestType: ['LIST', 'ACCOUNT'],
        requestedPackageLineItems: shipment.packages.map((pkg, idx) => ({
          sequenceNumber: idx + 1,
          weight: {
            units: pkg.weightUnit || 'LB',
            value: pkg.weight,
          },
          dimensions: pkg.dimensions
            ? {
                length: pkg.dimensions.length,
                width: pkg.dimensions.width,
                height: pkg.dimensions.height,
                units: pkg.dimensions.unit || 'IN',
              }
            : undefined,
        })),
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`FedEx rate quote error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create shipment and generate label
   */
  async createShipment(
    credentials: FedExCredentials,
    shipment: {
      shipper: any;
      recipient: any;
      packages: any[];
      serviceType: string;
      labelFormat?: string;
      labelStockType?: string;
    },
  ): Promise<any> {
    const token = await this.getAccessToken(credentials);
    const baseUrl = this.endpoints[credentials.environment];
    const url = `${baseUrl}/ship/v1/shipments`;

    const payload = {
      labelResponseOptions: 'URL_ONLY',
      requestedShipment: {
        shipper: shipment.shipper,
        recipients: [shipment.recipient],
        shipDatestamp: new Date().toISOString().split('T')[0],
        serviceType: shipment.serviceType,
        packagingType: 'YOUR_PACKAGING',
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        blockInsightVisibility: false,
        shippingChargesPayment: {
          paymentType: 'SENDER',
        },
        labelSpecification: {
          imageType: shipment.labelFormat || 'PDF',
          labelStockType: shipment.labelStockType || 'PAPER_85X11_TOP_HALF_LABEL',
        },
        requestedPackageLineItems: shipment.packages.map((pkg, idx) => ({
          sequenceNumber: idx + 1,
          weight: {
            units: pkg.weightUnit || 'LB',
            value: pkg.weight,
          },
          dimensions: pkg.dimensions
            ? {
                length: pkg.dimensions.length,
                width: pkg.dimensions.width,
                height: pkg.dimensions.height,
                units: pkg.dimensions.unit || 'IN',
              }
            : undefined,
        })),
      },
      accountNumber: {
        value: credentials.accountNumber,
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`FedEx create shipment error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Void/cancel shipment
   */
  async voidShipment(
    credentials: FedExCredentials,
    trackingNumber: string,
  ): Promise<any> {
    const token = await this.getAccessToken(credentials);
    const baseUrl = this.endpoints[credentials.environment];
    const url = `${baseUrl}/ship/v1/shipments/cancel`;

    const payload = {
      accountNumber: {
        value: credentials.accountNumber,
      },
      trackingNumber: trackingNumber,
      deletionControl: 'DELETE_ALL_PACKAGES',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.put(url, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`FedEx void shipment error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get tracking information
   */
  async track(
    credentials: FedExCredentials,
    trackingNumber: string,
  ): Promise<any> {
    const token = await this.getAccessToken(credentials);
    const baseUrl = this.endpoints[credentials.environment];
    const url = `${baseUrl}/track/v1/trackingnumbers`;

    const payload = {
      includeDetailedScans: true,
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber: trackingNumber,
          },
        },
      ],
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`FedEx tracking error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create end-of-day manifest (Close)
   */
  async createManifest(
    credentials: FedExCredentials,
    shipDate: Date,
  ): Promise<any> {
    const token = await this.getAccessToken(credentials);
    const baseUrl = this.endpoints[credentials.environment];
    const url = `${baseUrl}/ship/v1/shipments/groundclose`;

    const payload = {
      accountNumber: {
        value: credentials.accountNumber,
      },
      closeDate: shipDate.toISOString().split('T')[0],
      closeDocumentSpecification: {
        closeDocumentTypes: ['COD'],
        op900Detail: {
          format: {
            imageType: 'PDF',
            stockType: 'PAPER_LETTER',
          },
        },
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`FedEx manifest error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test connection to FedEx API
   */
  async testConnection(credentials: FedExCredentials): Promise<{
    success: boolean;
    message: string;
    responseTimeMs: number;
  }> {
    const startTime = Date.now();

    try {
      await this.getAccessToken(credentials);
      const responseTimeMs = Date.now() - startTime;

      return {
        success: true,
        message: 'Connection successful',
        responseTimeMs,
      };
    } catch (error: any) {
      const responseTimeMs = Date.now() - startTime;

      return {
        success: false,
        message: error.message,
        responseTimeMs,
      };
    }
  }
}
