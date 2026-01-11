import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Injectable, UseGuards, Logger } from '@nestjs/common';
import { CarrierIntegrationService } from '../../modules/wms/services/carrier-integration.service';
import { ShippingService } from '../../modules/wms/services/shipping.service';
import { CarrierClientFactoryService } from '../../modules/wms/services/carrier-client-factory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { getTenantIdFromContext, getUserIdFromContext } from '../../common/security/tenant-validation';

/**
 * Shipping Resolver
 *
 * REQ-1767925582663-ieqg0: FedEx Carrier Integration & Multi-Carrier Network
 *
 * GraphQL resolver for shipping and carrier integration operations.
 * Handles carrier configuration, rate shopping, shipment creation, and tracking.
 *
 * Security:
 * - All mutations require JWT authentication
 * - Multi-tenant isolation enforced via context.req.user.tenantId
 * - Role-based access control for sensitive operations
 */

@Injectable()
@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShippingResolver {
  private readonly logger = new Logger(ShippingResolver.name);

  constructor(
    private readonly carrierIntegrationService: CarrierIntegrationService,
    private readonly shippingService: ShippingService,
    private readonly carrierClientFactory: CarrierClientFactoryService,
  ) {}

  // =====================================================
  // CARRIER INTEGRATION QUERIES
  // =====================================================

  @Query('carrierIntegrations')
  async getCarrierIntegrations(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId?: string,
  ) {
    this.logger.log(`Getting carrier integrations for tenant ${tenantId}`);
    const integrations = await this.carrierIntegrationService.findAll(tenantId, facilityId);

    return integrations.map((ci) => ({
      id: ci.id,
      tenantId: ci.tenantId,
      facilityId: ci.facilityId,
      carrierCode: ci.carrierCode,
      carrierName: ci.carrierName,
      carrierType: ci.carrierType,
      apiEndpoint: ci.apiEndpoint,
      apiVersion: ci.apiVersion,
      accountNumber: ci.accountNumber,
      serviceMapping: ci.serviceMapping,
      credentialsConfigured: true, // Always true if record exists
      supportsTracking: true,
      supportsRateQuotes: true,
      supportsLabelGeneration: true,
      isActive: ci.isActive,
      connectionStatus: ci.connectionStatus,
      lastConnectionTest: ci.lastConnectionTest,
      createdAt: ci.createdAt,
      createdBy: ci.createdBy,
      updatedAt: ci.updatedAt,
      updatedBy: ci.updatedBy,
    }));
  }

  @Query('carrierIntegration')
  async getCarrierIntegration(
    @Args('id') id: string,
    @Args('tenantId') tenantId: string,
  ) {
    const ci = await this.carrierIntegrationService.findById(id, tenantId);

    return {
      id: ci.id,
      tenantId: ci.tenantId,
      facilityId: ci.facilityId,
      carrierCode: ci.carrierCode,
      carrierName: ci.carrierName,
      carrierType: ci.carrierType,
      apiEndpoint: ci.apiEndpoint,
      apiVersion: ci.apiVersion,
      accountNumber: ci.accountNumber,
      serviceMapping: ci.serviceMapping,
      credentialsConfigured: true,
      supportsTracking: true,
      supportsRateQuotes: true,
      supportsLabelGeneration: true,
      isActive: ci.isActive,
      connectionStatus: ci.connectionStatus,
      lastConnectionTest: ci.lastConnectionTest,
      createdAt: ci.createdAt,
      createdBy: ci.createdBy,
      updatedAt: ci.updatedAt,
      updatedBy: ci.updatedBy,
    };
  }

  @Query('testCarrierConnection')
  async testCarrierConnection(
    @Args('id') id: string,
    @Args('tenantId') tenantId: string,
  ) {
    const carrier = await this.carrierIntegrationService.findById(id, tenantId);
    const client = this.carrierClientFactory.getClient(carrier.carrierCode);

    const result = await client.testConnection();

    // Update connection status in database
    await this.carrierIntegrationService.updateConnectionStatus(
      id,
      tenantId,
      result.isConnected ? 'CONNECTED' : 'ERROR',
    );

    return {
      isConnected: result.isConnected,
      apiVersion: result.apiVersion,
      responseTimeMs: result.responseTimeMs,
      error: result.error,
      testedAt: new Date(),
    };
  }

  // =====================================================
  // RATE SHOPPING QUERIES
  // =====================================================

  @Query('getRateQuotes')
  async getRateQuotes(@Args('input') input: any, @Context() context: any) {
    const tenantId = getTenantIdFromContext(context);

    const quotes = await this.shippingService.getRateQuotes(
      tenantId,
      input.facilityId,
      {
        shipToAddressLine1: input.shipToAddressLine1,
        shipToCity: input.shipToCity,
        shipToState: input.shipToState,
        shipToPostalCode: input.shipToPostalCode,
        shipToCountry: input.shipToCountry,
        isResidential: input.isResidential,
        packages: input.packages,
      },
      input.carrierCodes,
    );

    return quotes.map((quote) => ({
      serviceType: quote.serviceType,
      serviceName: quote.serviceName,
      carrierCode: quote.carrierCode || 'FEDEX',
      carrierName: quote.carrierName || 'FedEx',
      totalCost: quote.totalCost,
      currency: quote.currency,
      baseRate: quote.breakdown?.baseRate,
      fuelSurcharge: quote.breakdown?.fuelSurcharge,
      insurance: quote.breakdown?.insurance,
      residential: quote.breakdown?.residential,
      saturday: quote.breakdown?.saturday,
      otherCharges: quote.breakdown?.other,
      transitDays: quote.transitDays,
      estimatedDeliveryDate: quote.estimatedDeliveryDate,
      guaranteedDelivery: quote.guaranteedDelivery,
      quotedAt: new Date(),
    }));
  }

  @Query('validateAddress')
  async validateAddress(
    @Args('input') input: any,
    @Args('carrierCode') carrierCode?: string,
  ) {
    // Use first available carrier or specified carrier
    const targetCarrierCode = carrierCode || 'FEDEX';
    const client = this.carrierClientFactory.getClient(targetCarrierCode);

    const result = await client.validateAddress({
      name: '',
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country,
    });

    return {
      isValid: result.isValid,
      validatedAddress: result.validatedAddress
        ? {
            name: result.validatedAddress.name,
            addressLine1: result.validatedAddress.addressLine1,
            addressLine2: result.validatedAddress.addressLine2,
            city: result.validatedAddress.city,
            state: result.validatedAddress.state,
            postalCode: result.validatedAddress.postalCode,
            country: result.validatedAddress.country,
            isResidential: result.validatedAddress.isResidential,
          }
        : null,
      suggestions: result.suggestions || [],
      errors: result.errors || [],
    };
  }

  // =====================================================
  // CARRIER INTEGRATION MUTATIONS
  // =====================================================

  @Mutation('createCarrierIntegration')
  @Roles('ADMIN', 'WAREHOUSE_MANAGER')
  async createCarrierIntegration(@Args('input') input: any, @Context() context: any) {
    const tenantId = getTenantIdFromContext(context);
    const userId = getUserIdFromContext(context);

    const carrier = await this.carrierIntegrationService.create(tenantId, userId, {
      facilityId: input.facilityId,
      carrierCode: input.carrierCode,
      carrierName: input.carrierName,
      carrierType: input.carrierType,
      apiEndpoint: input.apiEndpoint,
      apiVersion: input.apiVersion,
      accountNumber: input.accountNumber,
      billingAccountNumber: input.billingAccountNumber,
      apiUsername: input.apiUsername,
      apiPassword: input.apiPassword,
      apiKey: input.apiKey,
      oauthToken: input.oauthToken,
      serviceMapping: input.serviceMapping,
      defaultServiceCode: input.defaultServiceCode,
      labelFormat: input.labelFormat,
      isActive: input.isActive,
    });

    return {
      id: carrier.id,
      carrierCode: carrier.carrierCode,
      carrierName: carrier.carrierName,
      carrierType: carrier.carrierType,
      apiEndpoint: carrier.apiEndpoint,
      accountNumber: carrier.accountNumber,
      credentialsConfigured: true,
      isActive: carrier.isActive,
      createdAt: carrier.createdAt,
    };
  }

  @Mutation('updateCarrierIntegration')
  @Roles('ADMIN', 'WAREHOUSE_MANAGER')
  async updateCarrierIntegration(
    @Args('id') id: string,
    @Args('input') input: any,
    @Context() context: any,
  ) {
    const tenantId = getTenantIdFromContext(context);
    const userId = getUserIdFromContext(context);

    const carrier = await this.carrierIntegrationService.update(id, tenantId, userId, {
      carrierName: input.carrierName,
      apiEndpoint: input.apiEndpoint,
      apiVersion: input.apiVersion,
      accountNumber: input.accountNumber,
      apiUsername: input.apiUsername,
      apiPassword: input.apiPassword,
      apiKey: input.apiKey,
      oauthToken: input.oauthToken,
      serviceMapping: input.serviceMapping,
      defaultServiceCode: input.defaultServiceCode,
      labelFormat: input.labelFormat,
      isActive: input.isActive,
    });

    return {
      id: carrier.id,
      carrierName: carrier.carrierName,
      apiEndpoint: carrier.apiEndpoint,
      isActive: carrier.isActive,
      updatedAt: carrier.updatedAt,
    };
  }

  @Mutation('deleteCarrierIntegration')
  @Roles('ADMIN')
  async deleteCarrierIntegration(@Args('id') id: string, @Context() context: any) {
    const tenantId = getTenantIdFromContext(context);
    return await this.carrierIntegrationService.delete(id, tenantId);
  }

  // =====================================================
  // SHIPMENT MUTATIONS
  // =====================================================

  @Mutation('createShipment')
  @Roles('ADMIN', 'WAREHOUSE_MANAGER', 'SHIPPING_CLERK')
  async createShipment(@Args('input') input: any, @Context() context: any) {
    const tenantId = getTenantIdFromContext(context);
    const userId = getUserIdFromContext(context);

    const shipment = await this.shippingService.createShipment(tenantId, userId, {
      facilityId: input.facilityId,
      salesOrderId: input.salesOrderId,
      carrierIntegrationId: input.carrierIntegrationId,
      serviceLevel: input.serviceLevel,
      customerId: input.customerId,
      shipToName: input.shipToName,
      shipToAddressLine1: input.shipToAddressLine1,
      shipToAddressLine2: input.shipToAddressLine2,
      shipToCity: input.shipToCity,
      shipToState: input.shipToState,
      shipToPostalCode: input.shipToPostalCode,
      shipToCountry: input.shipToCountry,
      shipToPhone: input.shipToPhone,
      shipToEmail: input.shipToEmail,
      isResidential: input.isResidential,
      packages: input.packages,
      lines: input.lines,
      insuranceValue: input.insuranceValue,
      signatureRequired: input.signatureRequired,
      saturdayDelivery: input.saturdayDelivery,
      shippingNotes: input.shippingNotes,
    });

    return {
      id: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      status: shipment.status,
    };
  }

  @Mutation('manifestShipment')
  @Roles('ADMIN', 'WAREHOUSE_MANAGER', 'SHIPPING_CLERK')
  async manifestShipment(@Args('id') id: string, @Context() context: any) {
    const tenantId = getTenantIdFromContext(context);
    const result = await this.shippingService.manifestShipment(id, tenantId);

    return {
      id: result.id,
      trackingNumber: result.trackingNumber,
      labelUrl: result.labelUrl,
      totalCost: result.totalCost,
      status: 'MANIFESTED',
    };
  }

  @Mutation('refreshTracking')
  @Roles('ADMIN', 'WAREHOUSE_MANAGER', 'SHIPPING_CLERK')
  async refreshTracking(@Args('shipmentId') shipmentId: string, @Context() context: any) {
    const tenantId = getTenantIdFromContext(context);
    const events = await this.shippingService.refreshTracking(shipmentId, tenantId);

    return events.map((event) => ({
      eventDate: event.timestamp,
      eventType: event.status,
      eventDescription: event.statusDescription,
      city: event.location?.city,
      state: event.location?.state,
      country: event.location?.country,
      carrierEventCode: event.statusCode,
      exceptionFlag: !!event.exceptionCode,
      exceptionReason: event.exceptionDescription,
      createdAt: new Date(),
    }));
  }

  // =====================================================
  // NEW MUTATIONS - Missing Implementation
  // =====================================================

  @Mutation('voidShipment')
  @Roles('ADMIN', 'WAREHOUSE_MANAGER')
  async voidShipment(@Args('id') id: string, @Context() context: any) {
    const tenantId = getTenantIdFromContext(context);
    await this.shippingService.voidShipment(id, tenantId);
    return true;
  }

  @Mutation('updateShipmentStatus')
  @Roles('ADMIN', 'WAREHOUSE_MANAGER', 'SHIPPING_CLERK')
  async updateShipmentStatus(
    @Args('id') id: string,
    @Args('status') status: string,
    @Args('notes') notes: string,
    @Context() context: any,
  ) {
    const tenantId = getTenantIdFromContext(context);
    await this.shippingService.updateShipmentStatus(id, tenantId, status, notes);
    return await this.shippingService.getShipmentById(id, tenantId);
  }

  @Mutation('createManifest')
  @Roles('ADMIN', 'WAREHOUSE_MANAGER')
  async createManifest(
    @Args('shipmentIds') shipmentIds: string[],
    @Args('carrierIntegrationId') carrierIntegrationId: string,
    @Context() context: any,
  ) {
    const tenantId = getTenantIdFromContext(context);
    return await this.shippingService.createManifest(shipmentIds, carrierIntegrationId, tenantId);
  }

  // =====================================================
  // NEW QUERIES - Missing Implementation
  // =====================================================

  @Query('shipments')
  async getShipments(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId?: string,
    @Args('status') status?: string,
    @Args('startDate') startDate?: Date,
    @Args('endDate') endDate?: Date,
    @Args('trackingNumber') trackingNumber?: string,
    @Context() context?: any,
  ) {
    const userTenantId = getTenantIdFromContext(context);

    // Security: Validate that requested tenantId matches user's tenant
    if (tenantId !== userTenantId) {
      throw new Error('Access denied. You do not have permission to access data for another tenant.');
    }

    return await this.shippingService.findShipments(tenantId, {
      facilityId,
      status,
      startDate,
      endDate,
      trackingNumber,
    });
  }
}
