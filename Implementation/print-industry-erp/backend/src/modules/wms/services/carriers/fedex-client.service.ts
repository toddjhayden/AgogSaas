import { Injectable, Logger } from '@nestjs/common';
import {
  ICarrierClient,
  Address,
  AddressValidationResult,
  RateQuote,
  ShipmentRequest,
  ShipmentConfirmation,
  ManifestConfirmation,
  TrackingEvent,
  TrackingStatus,
  ConnectionStatus
} from '../../interfaces/carrier-client.interface';
import { FedExApiClient, FedExCredentials } from '../fedex-api.client';

/**
 * FedEx Carrier Client
 *
 * REQ-1767925582663-ieqg0: Complete FedEx Carrier Integration & Multi-Carrier Network
 *
 * Production-ready implementation of FedEx Ship API v1 integration.
 *
 * Features:
 * - OAuth2 authentication with automatic token refresh
 * - Full support for FedEx service types (Ground, Express, 2Day, etc.)
 * - Address validation
 * - Rate shopping
 * - Label generation
 * - Tracking
 * - End-of-day manifest (Close API)
 */
@Injectable()
export class FedExClientService implements ICarrierClient {
  private readonly logger = new Logger(FedExClientService.name);
  private credentials: FedExCredentials | null = null;

  constructor(private readonly fedexApiClient: FedExApiClient) {}

  /**
   * Configures this client instance with FedEx credentials
   * Called by CarrierClientFactoryService when loading tenant-specific config
   */
  configure(credentials: FedExCredentials): void {
    this.credentials = credentials;
    this.logger.log(`FedEx client configured for account ${credentials.accountNumber}`);
  }

  private ensureConfigured(): FedExCredentials {
    if (!this.credentials) {
      throw new Error('FedEx client not configured. Call configure() with credentials first.');
    }
    return this.credentials;
  }

  getCarrierCode(): string {
    return 'FEDEX';
  }

  getCarrierName(): string {
    return 'FedEx';
  }

  async validateAddress(address: Address): Promise<AddressValidationResult> {
    const creds = this.ensureConfigured();

    try {
      const result = await this.fedexApiClient.validateAddress(creds, {
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country
      });

      // Map FedEx API response to our interface
      const resolvedAddresses = result.output?.resolvedAddresses || [];
      if (resolvedAddresses.length > 0) {
        const fedexAddress = resolvedAddresses[0];
        return {
          isValid: true,
          validatedAddress: {
            name: address.name,
            addressLine1: fedexAddress.streetLines?.[0] || address.addressLine1,
            addressLine2: fedexAddress.streetLines?.[1],
            city: fedexAddress.city || address.city,
            state: fedexAddress.stateOrProvinceCode || address.state,
            postalCode: fedexAddress.postalCode || address.postalCode,
            country: fedexAddress.countryCode || address.country
          },
          suggestions: [],
          errors: []
        };
      }

      return {
        isValid: false,
        errors: [{ code: 'INVALID_ADDRESS', message: 'Address could not be validated', field: 'address' }]
      };
    } catch (error: any) {
      this.logger.error(`FedEx address validation failed: ${error.message}`);
      return {
        isValid: false,
        errors: [{ code: 'API_ERROR', message: error.message, field: 'address' }]
      };
    }
  }

  async getRates(shipment: ShipmentRequest): Promise<RateQuote[]> {
    const creds = this.ensureConfigured();

    try {
      const fedexShipment = {
        shipper: this.mapAddressToFedEx(shipment.shipFrom),
        recipient: this.mapAddressToFedEx(shipment.shipTo),
        packages: shipment.packages.map(pkg => ({
          weight: pkg.weight,
          weightUnit: pkg.weightUnit,
          dimensions: pkg.length && pkg.width && pkg.height ? {
            length: pkg.length,
            width: pkg.width,
            height: pkg.height,
            unit: pkg.dimensionUnit || 'IN'
          } : undefined
        }))
      };

      const result = await this.fedexApiClient.getRates(creds, fedexShipment);

      // Map FedEx rate response to our interface
      const rateReplyDetails = result.output?.rateReplyDetails || [];
      return rateReplyDetails.map((rate: any) => {
        const totalCharges = rate.ratedShipmentDetails?.[0]?.totalNetCharge || 0;
        const serviceType = rate.serviceType || 'UNKNOWN';

        return {
          carrierCode: 'FEDEX',
          carrierName: 'FedEx',
          serviceType,
          serviceName: this.getServiceName(serviceType),
          totalCost: parseFloat(totalCharges),
          currency: 'USD',
          transitDays: rate.commit?.transitDays,
          estimatedDeliveryDate: rate.commit?.dateDetail?.dayFormat ? new Date(rate.commit.dateDetail.dayFormat) : undefined,
          guaranteedDelivery: rate.commit?.commitmentCategory === 'GUARANTEED',
          breakdown: {
            baseRate: parseFloat(rate.ratedShipmentDetails?.[0]?.shipmentRateDetail?.totalBaseCharge || 0),
            fuelSurcharge: parseFloat(rate.ratedShipmentDetails?.[0]?.shipmentRateDetail?.totalFuelSurcharge || 0),
          }
        };
      });
    } catch (error: any) {
      this.logger.error(`FedEx rate quote failed: ${error.message}`);
      throw error;
    }
  }

  async getRate(shipment: ShipmentRequest, serviceType: string): Promise<RateQuote> {
    const creds = this.ensureConfigured();

    try {
      const fedexShipment = {
        shipper: this.mapAddressToFedEx(shipment.shipFrom),
        recipient: this.mapAddressToFedEx(shipment.shipTo),
        packages: shipment.packages.map(pkg => ({
          weight: pkg.weight,
          weightUnit: pkg.weightUnit,
          dimensions: pkg.length && pkg.width && pkg.height ? {
            length: pkg.length,
            width: pkg.width,
            height: pkg.height,
            unit: pkg.dimensionUnit || 'IN'
          } : undefined
        })),
        serviceType
      };

      const result = await this.fedexApiClient.getRates(creds, fedexShipment);
      const rates = await this.getRates(shipment);
      const rate = rates.find(r => r.serviceType === serviceType);

      if (!rate) {
        throw new Error(`Service type ${serviceType} not available`);
      }

      return rate;
    } catch (error: any) {
      this.logger.error(`FedEx single rate quote failed: ${error.message}`);
      throw error;
    }
  }

  async createShipment(shipment: ShipmentRequest): Promise<ShipmentConfirmation> {
    const creds = this.ensureConfigured();

    try {
      const fedexShipment = {
        shipper: this.mapAddressToFedEx(shipment.shipFrom),
        recipient: this.mapAddressToFedEx(shipment.shipTo),
        packages: shipment.packages.map(pkg => ({
          weight: pkg.weight,
          weightUnit: pkg.weightUnit,
          dimensions: pkg.length && pkg.width && pkg.height ? {
            length: pkg.length,
            width: pkg.width,
            height: pkg.height,
            unit: pkg.dimensionUnit || 'IN'
          } : undefined
        })),
        serviceType: shipment.serviceType,
        labelFormat: 'PDF',
        labelStockType: 'PAPER_85X11_TOP_HALF_LABEL'
      };

      const result = await this.fedexApiClient.createShipment(creds, fedexShipment);

      // Extract tracking numbers and labels from FedEx response
      const completedShipment = result.output?.transactionShipments?.[0]?.completedShipmentDetail;
      const masterTrackingNumber = completedShipment?.masterTrackingNumber || '';
      const pieceResponses = completedShipment?.completedPackageDetails || [];

      return {
        shipmentId: shipment.shipmentId,
        carrierShipmentId: masterTrackingNumber,
        trackingNumber: masterTrackingNumber,
        labelFormat: 'PDF',
        labelData: pieceResponses[0]?.label?.encodedLabel || '',
        labelUrl: pieceResponses[0]?.label?.url,
        totalCost: parseFloat(completedShipment?.shipmentRating?.totalNetCharge || '0'),
        currency: 'USD',
        packages: pieceResponses.map((pkg: any, idx: number) => ({
          sequenceNumber: idx + 1,
          trackingNumber: pkg.trackingNumber || masterTrackingNumber,
          labelData: pkg.label?.encodedLabel
        }))
      };
    } catch (error: any) {
      this.logger.error(`FedEx create shipment failed: ${error.message}`);
      throw error;
    }
  }

  async voidShipment(trackingNumber: string): Promise<void> {
    const creds = this.ensureConfigured();

    try {
      await this.fedexApiClient.voidShipment(creds, trackingNumber);
      this.logger.log(`Voided FedEx shipment ${trackingNumber}`);
    } catch (error: any) {
      this.logger.error(`FedEx void shipment failed: ${error.message}`);
      throw error;
    }
  }

  async createManifest(shipmentIds: string[]): Promise<ManifestConfirmation> {
    const creds = this.ensureConfigured();

    try {
      const shipDate = new Date();
      const result = await this.fedexApiClient.createManifest(creds, shipDate);

      return {
        manifestId: `MANIFEST-${Date.now()}`,
        carrierManifestId: result.output?.manifestId || '',
        manifestDate: shipDate,
        shipmentCount: shipmentIds.length,
        totalWeight: 0, // FedEx doesn't return this in manifest response
        documentFormat: 'PDF',
        documentData: result.output?.encodedLabel || '',
        documentUrl: result.output?.url
      };
    } catch (error: any) {
      this.logger.error(`FedEx create manifest failed: ${error.message}`);
      throw error;
    }
  }

  async closeManifest(manifestId: string): Promise<void> {
    // FedEx automatically closes manifests at end of day
    // No explicit close API call needed
    this.logger.log(`FedEx manifest ${manifestId} will auto-close at end of day`);
  }

  async getTrackingUpdates(trackingNumber: string): Promise<TrackingEvent[]> {
    const creds = this.ensureConfigured();

    try {
      const result = await this.fedexApiClient.track(creds, trackingNumber);

      const trackResults = result.output?.completeTrackResults?.[0]?.trackResults || [];
      const events: TrackingEvent[] = [];

      for (const trackResult of trackResults) {
        const scanEvents = trackResult.scanEvents || [];
        for (const event of scanEvents) {
          events.push({
            timestamp: new Date(event.date || Date.now()),
            status: this.mapFedExStatusToTracking(event.eventType),
            statusCode: event.eventType || '',
            statusDescription: event.eventDescription || '',
            location: {
              city: event.scanLocation?.city,
              state: event.scanLocation?.stateOrProvinceCode,
              country: event.scanLocation?.countryCode,
              postalCode: event.scanLocation?.postalCode
            },
            exceptionCode: event.exceptionCode,
            exceptionDescription: event.exceptionDescription
          });
        }
      }

      return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error: any) {
      this.logger.error(`FedEx tracking failed: ${error.message}`);
      throw error;
    }
  }

  async getCurrentStatus(trackingNumber: string): Promise<TrackingEvent> {
    const events = await this.getTrackingUpdates(trackingNumber);
    if (events.length === 0) {
      throw new Error(`No tracking information found for ${trackingNumber}`);
    }
    return events[events.length - 1];
  }

  async testConnection(): Promise<ConnectionStatus> {
    const creds = this.ensureConfigured();

    try {
      const result = await this.fedexApiClient.testConnection(creds);
      return {
        isConnected: result.success,
        apiVersion: 'Ship API v1',
        lastTestTime: new Date(),
        responseTimeMs: result.responseTimeMs,
        error: result.message
      };
    } catch (error: any) {
      return {
        isConnected: false,
        lastTestTime: new Date(),
        error: error.message
      };
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private mapAddressToFedEx(address: Address): any {
    return {
      contact: {
        personName: address.name,
        phoneNumber: address.phone,
        emailAddress: address.email
      },
      address: {
        streetLines: [address.addressLine1, address.addressLine2].filter(Boolean),
        city: address.city,
        stateOrProvinceCode: address.state,
        postalCode: address.postalCode,
        countryCode: address.country,
        residential: address.isResidential || false
      }
    };
  }

  private getServiceName(serviceType: string): string {
    const serviceNames: Record<string, string> = {
      'FEDEX_GROUND': 'FedEx Ground',
      'FEDEX_2DAY': 'FedEx 2Day',
      'FEDEX_2DAY_AM': 'FedEx 2Day A.M.',
      'FEDEX_EXPRESS_SAVER': 'FedEx Express Saver',
      'STANDARD_OVERNIGHT': 'FedEx Standard Overnight',
      'PRIORITY_OVERNIGHT': 'FedEx Priority Overnight',
      'FIRST_OVERNIGHT': 'FedEx First Overnight',
      'FEDEX_INTERNATIONAL_ECONOMY': 'FedEx International Economy',
      'FEDEX_INTERNATIONAL_PRIORITY': 'FedEx International Priority',
      'FEDEX_INTERNATIONAL_FIRST': 'FedEx International First'
    };

    return serviceNames[serviceType] || serviceType;
  }

  private mapFedExStatusToTracking(fedexStatus: string): TrackingStatus {
    const statusMap: Record<string, TrackingStatus> = {
      'OC': TrackingStatus.LABEL_CREATED,
      'PU': TrackingStatus.PICKED_UP,
      'IT': TrackingStatus.IN_TRANSIT,
      'AR': TrackingStatus.IN_TRANSIT,
      'DP': TrackingStatus.IN_TRANSIT,
      'OD': TrackingStatus.OUT_FOR_DELIVERY,
      'DL': TrackingStatus.DELIVERED,
      'EX': TrackingStatus.EXCEPTION,
      'RT': TrackingStatus.RETURNED,
      'CA': TrackingStatus.CANCELLED
    };

    return statusMap[fedexStatus] || TrackingStatus.IN_TRANSIT;
  }
}
