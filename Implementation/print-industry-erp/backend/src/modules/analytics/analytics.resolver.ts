/**
 * Analytics GraphQL Resolver
 * Handles cross-domain analytics queries and export operations
 * REQ-STRATEGIC-AUTO-1767048328662
 */

import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { AnalyticsService } from './services/analytics.service';
import { ExportService, ExportReportInput } from './services/export.service';

@Resolver()
export class AnalyticsResolver {
  private readonly logger = new Logger(AnalyticsResolver.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly exportService: ExportService,
  ) {}

  // =========================================================================
  // CROSS-DOMAIN ANALYTICS QUERIES
  // =========================================================================

  @Query('vendorProductionImpact')
  async vendorProductionImpact(
    @Args('vendorId') vendorId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Args('tenantId') tenantId: string,
  ) {
    this.logger.log(
      `Query: vendorProductionImpact for vendor ${vendorId} (tenant: ${tenantId})`,
    );

    return this.analyticsService.getVendorProductionImpact(
      vendorId,
      startDate,
      endDate,
      tenantId,
    );
  }

  @Query('customerProfitability')
  async customerProfitability(
    @Args('customerId') customerId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Args('tenantId') tenantId: string,
    @Args('includeWarehouseCosts') includeWarehouseCosts?: boolean,
    @Args('includeQualityCosts') includeQualityCosts?: boolean,
  ) {
    this.logger.log(
      `Query: customerProfitability for customer ${customerId} (tenant: ${tenantId})`,
    );

    return this.analyticsService.getCustomerProfitability(
      customerId,
      startDate,
      endDate,
      tenantId,
      includeWarehouseCosts,
      includeQualityCosts,
    );
  }

  @Query('orderCycleAnalysis')
  async orderCycleAnalysis(
    @Args('orderId') orderId: string,
    @Args('tenantId') tenantId: string,
  ) {
    this.logger.log(
      `Query: orderCycleAnalysis for order ${orderId} (tenant: ${tenantId})`,
    );

    return this.analyticsService.getOrderCycleAnalysis(orderId, tenantId);
  }

  @Query('materialFlowAnalysis')
  async materialFlowAnalysis(
    @Args('materialId') materialId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Args('tenantId') tenantId: string,
  ) {
    this.logger.log(
      `Query: materialFlowAnalysis for material ${materialId} (tenant: ${tenantId})`,
    );

    return this.analyticsService.getMaterialFlowAnalysis(
      materialId,
      startDate,
      endDate,
      tenantId,
    );
  }

  // =========================================================================
  // AGGREGATIONS
  // =========================================================================

  @Query('executiveKPISummary')
  async executiveKPISummary(
    @Args('tenantId') tenantId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Args('facilityId') facilityId?: string,
  ) {
    this.logger.log(
      `Query: executiveKPISummary for tenant ${tenantId} (facility: ${facilityId || 'all'})`,
    );

    return this.analyticsService.getExecutiveKPISummary(
      tenantId,
      startDate,
      endDate,
      facilityId,
    );
  }

  @Query('trendAnalysis')
  async trendAnalysis(
    @Args('metric') metric: string,
    @Args('period') period: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId?: string,
  ) {
    this.logger.log(
      `Query: trendAnalysis for metric ${metric} (tenant: ${tenantId})`,
    );

    return this.analyticsService.getTrendAnalysis(
      metric,
      period,
      startDate,
      endDate,
      tenantId,
      facilityId,
    );
  }

  // =========================================================================
  // EXPORT OPERATIONS
  // =========================================================================

  @Mutation('exportReport')
  async exportReport(@Args('input') input: ExportReportInput) {
    this.logger.log(
      `Mutation: exportReport for ${input.reportType} in ${input.format} format`,
    );

    return this.exportService.exportReport(input);
  }

  @Query('exportStatus')
  async exportStatus(@Args('exportId') exportId: string) {
    this.logger.log(`Query: exportStatus for export ${exportId}`);

    return this.exportService.getExportStatus(exportId);
  }

  @Mutation('cancelExport')
  async cancelExport(@Args('exportId') exportId: string) {
    this.logger.log(`Mutation: cancelExport for export ${exportId}`);

    return this.exportService.cancelExport(exportId);
  }
}
