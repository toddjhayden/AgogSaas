/**
 * Supplier Portal GraphQL Resolver
 * Handles supplier portal queries and mutations
 *
 * REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SupplierAuthGuard } from '../../modules/supplier-portal/guards/supplier-auth.guard';
import { SupplierPortalService } from '../../modules/supplier-portal/services/supplier-portal.service';

@Resolver()
@UseGuards(SupplierAuthGuard)
export class SupplierPortalResolver {
  constructor(private readonly supplierPortalService: SupplierPortalService) {}

  /**
   * Get supplier dashboard metrics
   */
  @Query()
  async supplierDashboard(@Context() context: any) {
    const { supplierUser } = context.req;
    return this.supplierPortalService.getSupplierDashboard(
      supplierUser.vendorId,
      supplierUser.tenantId,
    );
  }

  /**
   * Get list of purchase orders for supplier
   */
  @Query()
  async supplierPurchaseOrders(
    @Args('status') status: string[] | undefined,
    @Args('fromDate') fromDate: Date | undefined,
    @Args('toDate') toDate: Date | undefined,
    @Args('limit') limit: number = 50,
    @Args('offset') offset: number = 0,
    @Context() context: any,
  ) {
    const { supplierUser } = context.req;
    const result = await this.supplierPortalService.getSupplierPurchaseOrders(
      supplierUser.vendorId,
      supplierUser.tenantId,
      { status, fromDate, toDate, limit, offset },
    );

    return {
      nodes: result.nodes,
      totalCount: result.totalCount,
      pageInfo: {
        hasNextPage: offset + limit < result.totalCount,
        hasPreviousPage: offset > 0,
        totalPages: Math.ceil(result.totalCount / limit),
      },
    };
  }

  /**
   * Get detailed purchase order information
   */
  @Query()
  async supplierPurchaseOrder(
    @Args('poNumber') poNumber: string,
    @Context() context: any,
  ) {
    const { supplierUser } = context.req;
    return this.supplierPortalService.getSupplierPurchaseOrder(
      supplierUser.vendorId,
      supplierUser.tenantId,
      poNumber,
    );
  }

  /**
   * Acknowledge a purchase order
   */
  @Mutation()
  async acknowledgePurchaseOrder(
    @Args('input') input: any,
    @Context() context: any,
  ) {
    const { supplierUser } = context.req;
    return this.supplierPortalService.acknowledgePurchaseOrder(
      supplierUser.vendorId,
      supplierUser.tenantId,
      supplierUser.id,
      input,
    );
  }

  /**
   * Create an Advanced Ship Notice (ASN)
   */
  @Mutation()
  async createAdvancedShipNotice(
    @Args('input') input: any,
    @Context() context: any,
  ) {
    const { supplierUser } = context.req;
    return this.supplierPortalService.createASN(
      supplierUser.vendorId,
      supplierUser.tenantId,
      supplierUser.id,
      input,
    );
  }
}
