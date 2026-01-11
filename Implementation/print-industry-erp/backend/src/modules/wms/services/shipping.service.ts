import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { CarrierIntegrationService } from './carrier-integration.service';
import { CarrierClientFactoryService } from './carrier-client-factory.service';
import { CarrierApiRateLimiterService } from './carrier-rate-limiter.service';
import { ICarrierClient, ShipmentRequest, RateQuote, TrackingEvent } from '../interfaces/carrier-client.interface';

/**
 * Shipping Service
 *
 * REQ-1767925582663-ieqg0: FedEx Carrier Integration & Multi-Carrier Network
 *
 * High-level service for managing shipments across multiple carriers.
 * Orchestrates carrier integration, rate shopping, label generation, and tracking.
 *
 * Features:
 * - Multi-carrier rate shopping
 * - Shipment creation with automatic label generation
 * - Tracking updates
 * - End-of-day manifesting
 * - Carrier failover
 */

export interface CreateShipmentInput {
  facilityId: string;
  salesOrderId?: string;
  carrierIntegrationId: string;
  serviceLevel: string;
  customerId: string;
  shipToName: string;
  shipToAddressLine1: string;
  shipToAddressLine2?: string;
  shipToCity: string;
  shipToState?: string;
  shipToPostalCode: string;
  shipToCountry: string;
  shipToPhone?: string;
  shipToEmail?: string;
  isResidential?: boolean;
  packages: Array<{
    sequenceNumber: number;
    weight: number;
    weightUnit: string;
    length?: number;
    width?: number;
    height?: number;
    dimensionUnit?: string;
    insuranceValue?: number;
  }>;
  lines: Array<{
    salesOrderLineId?: string;
    materialId: string;
    quantityShipped: number;
    unitOfMeasure: string;
    packageNumber?: number;
    lotNumber?: string;
  }>;
  insuranceValue?: number;
  signatureRequired?: boolean;
  saturdayDelivery?: boolean;
  shippingNotes?: string;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private pool: Pool;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly carrierIntegrationService: CarrierIntegrationService,
    private readonly carrierClientFactory: CarrierClientFactoryService,
    private readonly rateLimiter: CarrierApiRateLimiterService,
  ) {
    this.pool = this.databaseService.getPool();
  }

  /**
   * Create a new shipment (DRAFT status)
   */
  async createShipment(
    tenantId: string,
    userId: string,
    input: CreateShipmentInput,
  ): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get carrier integration
      const carrier = await this.carrierIntegrationService.findById(
        input.carrierIntegrationId,
        tenantId,
      );

      if (!carrier.isActive) {
        throw new BadRequestException('Carrier integration is not active');
      }

      // Generate shipment number
      const shipmentNumber = await this.generateShipmentNumber(client, tenantId);

      // Insert shipment
      const shipmentQuery = `
        INSERT INTO shipments (
          tenant_id, facility_id, shipment_number, sales_order_id,
          carrier_id, carrier_name, service_level,
          customer_id, ship_to_name, ship_to_address_line1, ship_to_address_line2,
          ship_to_city, ship_to_state, ship_to_postal_code, ship_to_country,
          ship_to_phone, ship_to_email,
          number_of_packages, total_weight,
          status, shipping_notes, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        ) RETURNING id
      `;

      const totalWeight = input.packages.reduce((sum, pkg) => sum + pkg.weight, 0);

      const shipmentResult = await client.query(shipmentQuery, [
        tenantId,
        input.facilityId,
        shipmentNumber,
        input.salesOrderId || null,
        carrier.id,
        carrier.carrierName,
        input.serviceLevel,
        input.customerId,
        input.shipToName,
        input.shipToAddressLine1,
        input.shipToAddressLine2 || null,
        input.shipToCity,
        input.shipToState || null,
        input.shipToPostalCode,
        input.shipToCountry,
        input.shipToPhone || null,
        input.shipToEmail || null,
        input.packages.length,
        totalWeight,
        'DRAFT',
        input.shippingNotes || null,
        userId,
      ]);

      const shipmentId = shipmentResult.rows[0].id;

      // Insert shipment lines
      for (const line of input.lines) {
        const lineQuery = `
          INSERT INTO shipment_lines (
            tenant_id, shipment_id, sales_order_line_id, material_id,
            quantity_shipped, unit_of_measure, package_number, lot_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        await client.query(lineQuery, [
          tenantId,
          shipmentId,
          line.salesOrderLineId || null,
          line.materialId,
          line.quantityShipped,
          line.unitOfMeasure,
          line.packageNumber || 1,
          line.lotNumber || null,
        ]);
      }

      await client.query('COMMIT');

      this.logger.log(`Created shipment ${shipmentNumber} for tenant ${tenantId}`);

      return {
        id: shipmentId,
        shipmentNumber,
        status: 'DRAFT',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create shipment: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Manifest shipment (create label and get tracking number)
   */
  async manifestShipment(shipmentId: string, tenantId: string): Promise<any> {
    const shipment = await this.getShipmentById(shipmentId, tenantId);

    if (shipment.status !== 'DRAFT' && shipment.status !== 'READY_TO_SHIP') {
      throw new BadRequestException('Shipment must be in DRAFT or READY_TO_SHIP status');
    }

    // Get carrier client
    const carrier = await this.carrierIntegrationService.findById(
      shipment.carrier_id,
      tenantId,
    );

    const carrierClient = this.carrierClientFactory.getClient(carrier.carrierCode);

    // Get facility information for shipFrom address
    const facilityQuery = `
      SELECT facility_name, address_line1, address_line2, city, state, postal_code, country, contact_phone, contact_email
      FROM facilities
      WHERE id = $1 AND tenant_id = $2
    `;
    const facilityResult = await this.pool.query(facilityQuery, [shipment.facility_id, tenantId]);

    if (facilityResult.rows.length === 0) {
      throw new NotFoundException(`Facility ${shipment.facility_id} not found`);
    }

    const facility = facilityResult.rows[0];

    // Build shipment request
    const shipmentRequest: ShipmentRequest = {
      tenantId,
      facilityId: shipment.facility_id,
      shipmentId: shipment.id,
      serviceType: shipment.service_level,
      shipFrom: {
        name: facility.facility_name,
        addressLine1: facility.address_line1,
        addressLine2: facility.address_line2 || undefined,
        city: facility.city,
        state: facility.state || undefined,
        postalCode: facility.postal_code,
        country: facility.country,
        phone: facility.contact_phone || undefined,
        email: facility.contact_email || undefined,
      },
      shipTo: {
        name: shipment.ship_to_name,
        addressLine1: shipment.ship_to_address_line1,
        addressLine2: shipment.ship_to_address_line2,
        city: shipment.ship_to_city,
        state: shipment.ship_to_state,
        postalCode: shipment.ship_to_postal_code,
        country: shipment.ship_to_country,
        phone: shipment.ship_to_phone,
        email: shipment.ship_to_email,
        isResidential: true,
      },
      packages: [
        {
          sequenceNumber: 1,
          weight: shipment.total_weight || 5,
          weightUnit: 'LBS',
        },
      ],
    };

    // Create shipment with carrier (with rate limiting)
    const confirmation = await this.rateLimiter.executeWithRateLimit(
      carrier.carrierCode,
      10, // High priority
      () => carrierClient.createShipment(shipmentRequest),
    );

    // Update shipment in database
    const updateQuery = `
      UPDATE shipments
      SET
        status = 'MANIFESTED',
        tracking_number = $1,
        label_url = $2,
        freight = $3,
        total_cost = $4,
        updated_at = NOW()
      WHERE id = $5 AND tenant_id = $6
    `;

    await this.pool.query(updateQuery, [
      confirmation.trackingNumber,
      confirmation.labelUrl,
      confirmation.totalCost,
      confirmation.totalCost,
      shipmentId,
      tenantId,
    ]);

    this.logger.log(
      `Manifested shipment ${shipment.shipment_number}, tracking: ${confirmation.trackingNumber}`,
    );

    return {
      id: shipmentId,
      trackingNumber: confirmation.trackingNumber,
      labelUrl: confirmation.labelUrl,
      totalCost: confirmation.totalCost,
    };
  }

  /**
   * Get rate quotes from multiple carriers
   */
  async getRateQuotes(
    tenantId: string,
    facilityId: string,
    shipment: {
      shipToAddressLine1: string;
      shipToCity: string;
      shipToState?: string;
      shipToPostalCode: string;
      shipToCountry: string;
      isResidential?: boolean;
      packages: Array<{
        weight: number;
        weightUnit: string;
      }>;
    },
    carrierCodes?: string[],
  ): Promise<RateQuote[]> {
    // Get active carriers for facility
    const carriers = await this.carrierIntegrationService.findAll(tenantId, facilityId);
    const activeCarriers = carriers.filter((c) => c.isActive);

    // Filter by carrier codes if specified
    const targetCarriers = carrierCodes
      ? activeCarriers.filter((c) => carrierCodes.includes(c.carrierCode))
      : activeCarriers;

    if (targetCarriers.length === 0) {
      throw new NotFoundException('No active carriers found');
    }

    // Build shipment request
    const shipmentRequest: ShipmentRequest = {
      tenantId,
      facilityId,
      shipmentId: 'RATE_QUOTE',
      serviceType: 'GROUND',
      shipFrom: {
        name: 'Warehouse',
        addressLine1: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'US',
      },
      shipTo: {
        name: 'Customer',
        addressLine1: shipment.shipToAddressLine1,
        city: shipment.shipToCity,
        state: shipment.shipToState,
        postalCode: shipment.shipToPostalCode,
        country: shipment.shipToCountry,
        isResidential: shipment.isResidential,
      },
      packages: shipment.packages.map((pkg, idx) => ({
        sequenceNumber: idx + 1,
        weight: pkg.weight,
        weightUnit: pkg.weightUnit as 'LBS' | 'KG',
      })),
    };

    // Get rates from each carrier (in parallel with rate limiting)
    const ratePromises = targetCarriers.map(async (carrier) => {
      try {
        const client = this.carrierClientFactory.getClient(carrier.carrierCode);

        const rates = await this.rateLimiter.executeWithRateLimit(
          carrier.carrierCode,
          5, // Normal priority
          () => client.getRates(shipmentRequest),
        );

        return rates;
      } catch (error) {
        this.logger.warn(
          `Failed to get rates from ${carrier.carrierName}: ${error}`,
        );
        return [];
      }
    });

    const allRates = await Promise.all(ratePromises);

    // Flatten and sort by cost
    return allRates.flat().sort((a, b) => a.totalCost - b.totalCost);
  }

  /**
   * Refresh tracking events for a shipment
   */
  async refreshTracking(shipmentId: string, tenantId: string): Promise<TrackingEvent[]> {
    const shipment = await this.getShipmentById(shipmentId, tenantId);

    if (!shipment.tracking_number) {
      throw new BadRequestException('Shipment has no tracking number');
    }

    const carrier = await this.carrierIntegrationService.findById(
      shipment.carrier_id,
      tenantId,
    );

    const carrierClient = this.carrierClientFactory.getClient(carrier.carrierCode);

    // Get tracking updates from carrier (with rate limiting)
    const events = await this.rateLimiter.executeWithRateLimit(
      carrier.carrierCode,
      3, // Lower priority
      () => carrierClient.getTrackingUpdates(shipment.tracking_number),
    );

    // Store events in database
    for (const event of events) {
      await this.storeTrackingEvent(shipmentId, tenantId, event);
    }

    return events;
  }

  /**
   * Get shipment by ID
   * Made public for resolver access - REQ-1767925582663-ieqg0
   */
  async getShipmentById(shipmentId: string, tenantId: string): Promise<any> {
    const query = `
      SELECT * FROM shipments
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [shipmentId, tenantId]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Store tracking event
   */
  private async storeTrackingEvent(
    shipmentId: string,
    tenantId: string,
    event: TrackingEvent,
  ): Promise<void> {
    const query = `
      INSERT INTO tracking_events (
        tenant_id, shipment_id, event_date, event_type, event_description,
        location_city, location_state, location_country,
        carrier_event_code, exception_flag
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT DO NOTHING
    `;

    await this.pool.query(query, [
      tenantId,
      shipmentId,
      event.timestamp,
      event.status,
      event.statusDescription,
      event.location?.city || null,
      event.location?.state || null,
      event.location?.country || null,
      event.statusCode,
      event.exceptionCode ? true : false,
    ]);
  }

  /**
   * Generate unique shipment number
   */
  private async generateShipmentNumber(client: any, tenantId: string): Promise<string> {
    const prefix = 'SHP';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const query = `
      SELECT COUNT(*) as count
      FROM shipments
      WHERE tenant_id = $1 AND shipment_number LIKE $2
    `;

    const result = await client.query(query, [tenantId, `${prefix}${date}%`]);
    const count = parseInt(result.rows[0].count, 10) + 1;

    return `${prefix}${date}${count.toString().padStart(4, '0')}`;
  }

  /**
   * Void shipment (cancel with carrier and update status)
   * NEW METHOD - REQ-1767925582663-ieqg0
   */
  async voidShipment(shipmentId: string, tenantId: string): Promise<void> {
    const shipment = await this.getShipmentById(shipmentId, tenantId);

    // Validate shipment can be voided
    if (shipment.status !== 'MANIFESTED' && shipment.status !== 'SHIPPED') {
      throw new BadRequestException('Only MANIFESTED or SHIPPED shipments can be voided');
    }

    if (!shipment.tracking_number) {
      throw new BadRequestException('Shipment must have a tracking number to be voided');
    }

    // Get carrier client
    const carrier = await this.carrierIntegrationService.findById(
      shipment.carrier_id,
      tenantId,
    );

    const carrierClient = this.carrierClientFactory.getClient(carrier.carrierCode);

    // Void shipment with carrier API
    try {
      await this.rateLimiter.executeWithRateLimit(
        carrier.carrierCode,
        10, // High priority
        () => carrierClient.voidShipment(shipment.tracking_number),
      );

      // Update shipment status in database
      await this.updateShipmentStatus(shipmentId, tenantId, 'CANCELLED', 'Shipment voided by user');

      this.logger.log(`Voided shipment ${shipment.shipment_number} for tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to void shipment ${shipment.shipment_number}: ${error}`);
      throw new BadRequestException(
        `Failed to void shipment with carrier: ${error.message}`,
      );
    }
  }

  /**
   * Update shipment status
   * NEW METHOD - REQ-1767925582663-ieqg0
   */
  async updateShipmentStatus(
    shipmentId: string,
    tenantId: string,
    status: string,
    notes?: string,
  ): Promise<void> {
    const query = `
      UPDATE shipments
      SET status = $1, delivery_notes = $2, updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4
    `;

    const result = await this.pool.query(query, [status, notes, shipmentId, tenantId]);

    if (result.rowCount === 0) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    this.logger.log(`Updated shipment ${shipmentId} status to ${status}`);
  }

  /**
   * Create manifest for multiple shipments (end-of-day close)
   * NEW METHOD - REQ-1767925582663-ieqg0
   */
  async createManifest(
    shipmentIds: string[],
    carrierIntegrationId: string,
    tenantId: string,
  ): Promise<any> {
    // Get carrier
    const carrier = await this.carrierIntegrationService.findById(
      carrierIntegrationId,
      tenantId,
    );

    // Get all shipments
    const shipments = await this.getShipmentsByIds(shipmentIds, tenantId);

    // Validate all shipments are MANIFESTED
    const invalidShipments = shipments.filter((s) => s.status !== 'MANIFESTED');
    if (invalidShipments.length > 0) {
      throw new BadRequestException(
        `${invalidShipments.length} shipments are not in MANIFESTED status`,
      );
    }

    // Validate all shipments use the same carrier
    const wrongCarrier = shipments.filter((s) => s.carrier_id !== carrier.id);
    if (wrongCarrier.length > 0) {
      throw new BadRequestException(
        `All shipments must use the same carrier (${carrier.carrierName})`,
      );
    }

    // Create manifest with carrier
    const carrierClient = this.carrierClientFactory.getClient(carrier.carrierCode);
    const trackingNumbers = shipments.map((s) => s.tracking_number);

    try {
      const manifest = await this.rateLimiter.executeWithRateLimit(
        carrier.carrierCode,
        10, // High priority
        () => carrierClient.createManifest(trackingNumbers),
      );

      this.logger.log(
        `Created manifest ${manifest.manifestId} for ${shipmentIds.length} shipments`,
      );

      return {
        manifestId: manifest.manifestId,
        carrierManifestId: manifest.carrierManifestId,
        manifestDate: manifest.manifestDate,
        shipmentCount: shipmentIds.length,
        totalWeight: manifest.totalWeight,
        documentUrl: manifest.documentUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to create manifest: ${error}`);
      throw new BadRequestException(`Failed to create manifest with carrier: ${error.message}`);
    }
  }

  /**
   * Get shipments by IDs
   * NEW METHOD - REQ-1767925582663-ieqg0
   */
  async getShipmentsByIds(shipmentIds: string[], tenantId: string): Promise<any[]> {
    const query = `
      SELECT * FROM shipments
      WHERE id = ANY($1) AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [shipmentIds, tenantId]);
    return result.rows;
  }

  /**
   * Find shipments with filters
   * NEW METHOD - REQ-1767925582663-ieqg0
   */
  async findShipments(
    tenantId: string,
    filters: {
      facilityId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      trackingNumber?: string;
    },
  ): Promise<any[]> {
    let query = `
      SELECT * FROM shipments
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.facilityId) {
      params.push(filters.facilityId);
      query += ` AND facility_id = $${paramIndex++}`;
    }

    if (filters.status) {
      params.push(filters.status);
      query += ` AND status = $${paramIndex++}`;
    }

    if (filters.startDate) {
      params.push(filters.startDate);
      query += ` AND created_at >= $${paramIndex++}`;
    }

    if (filters.endDate) {
      params.push(filters.endDate);
      query += ` AND created_at <= $${paramIndex++}`;
    }

    if (filters.trackingNumber) {
      params.push(filters.trackingNumber);
      query += ` AND tracking_number = $${paramIndex++}`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }
}
