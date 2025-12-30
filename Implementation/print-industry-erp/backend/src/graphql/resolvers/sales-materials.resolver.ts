import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { VendorPerformanceService } from '../../modules/procurement/services/vendor-performance.service';
import { validateTenantAccess } from '../../common/security/tenant-validation';
import {
  validateCalculatePerformanceInput,
  validateVendorComparisonInput,
  validateUpdatePerformanceScoresInput,
} from '../../common/validation/procurement-dtos';

/**
 * SALES, MATERIALS, AND PROCUREMENT RESOLVER
 *
 * Purpose: GraphQL resolver for materials management, procurement, and sales
 * Tables: 17 (materials, products, bill_of_materials, vendors, materials_suppliers,
 *         purchase_orders, purchase_order_lines, vendor_contracts, vendor_performance,
 *         customers, customer_products, customer_pricing, quotes, quote_lines,
 *         sales_orders, sales_order_lines, pricing_rules)
 *
 * Features:
 * - Materials management with ABC classification and costing
 * - Product master with BOM and manufacturing specs
 * - Vendor management with performance tracking
 * - Purchase order workflow with approval
 * - Customer master with credit management
 * - Quote-to-order conversion workflow
 * - Sales order lifecycle management
 * - Dynamic pricing rules engine
 *
 * Technical approach:
 * - Direct PostgreSQL pool queries (no ORM)
 * - Row mappers for snake_case → camelCase conversion
 * - Transaction support for multi-table operations
 * - Dynamic WHERE clause building for flexible filtering
 */

@Resolver('SalesMaterialsProcurement')
export class SalesMaterialsResolver {
  private readonly vendorPerformanceService: VendorPerformanceService;

  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {
    this.vendorPerformanceService = new VendorPerformanceService(db);
  }

  // =====================================================
  // MATERIALS QUERIES
  // =====================================================

  @Query('materials')
  async getMaterials(
    @Args('tenantId') tenantId: string,
    @Args('materialType') materialType: string | null,
    @Args('materialCategory') materialCategory: string | null,
    @Args('abcClassification') abcClassification: string | null,
    @Args('isActive') isActive: boolean | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (materialType) {
      whereClause += ` AND material_type = $${paramIndex++}`;
      params.push(materialType);
    }

    if (materialCategory) {
      whereClause += ` AND material_category = $${paramIndex++}`;
      params.push(materialCategory);
    }

    if (abcClassification) {
      whereClause += ` AND abc_classification = $${paramIndex++}`;
      params.push(abcClassification);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM materials
       WHERE ${whereClause}
       ORDER BY material_code
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapMaterialRow);
  }

  @Query('material')
  async getMaterial(@Args('id') id: string) {
    const result = await this.db.query(
      `SELECT * FROM materials WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    return result.rows.length > 0 ? this.mapMaterialRow(result.rows[0]) : null;
  }

  @Query('materialByCode')
  async getMaterialByCode(
    @Args('tenantId') tenantId: string,
    @Args('materialCode') materialCode: string
  ) {
    const result = await this.db.query(
      `SELECT * FROM materials WHERE tenant_id = $1 AND material_code = $2 AND deleted_at IS NULL`,
      [tenantId, materialCode]
    );

    return result.rows.length > 0 ? this.mapMaterialRow(result.rows[0]) : null;
  }

  // =====================================================
  // PRODUCTS QUERIES
  // =====================================================

  @Query('products')
  async getProducts(
    @Args('tenantId') tenantId: string,
    @Args('productCategory') productCategory: string | null,
    @Args('packagingType') packagingType: string | null,
    @Args('isActive') isActive: boolean | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (productCategory) {
      whereClause += ` AND product_category = $${paramIndex++}`;
      params.push(productCategory);
    }

    if (packagingType) {
      whereClause += ` AND packaging_type = $${paramIndex++}`;
      params.push(packagingType);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM products
       WHERE ${whereClause}
       ORDER BY product_code
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapProductRow);
  }

  @Query('product')
  async getProduct(@Args('id') id: string) {
    const result = await this.db.query(
      `SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    return result.rows.length > 0 ? this.mapProductRow(result.rows[0]) : null;
  }

  @Query('productByCode')
  async getProductByCode(
    @Args('tenantId') tenantId: string,
    @Args('productCode') productCode: string
  ) {
    const result = await this.db.query(
      `SELECT * FROM products WHERE tenant_id = $1 AND product_code = $2 AND deleted_at IS NULL`,
      [tenantId, productCode]
    );

    return result.rows.length > 0 ? this.mapProductRow(result.rows[0]) : null;
  }

  // =====================================================
  // BOM QUERIES
  // =====================================================

  @Query('billOfMaterials')
  async getBillOfMaterials(
    @Args('tenantId') tenantId: string,
    @Args('parentProductId') parentProductId: string | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (parentProductId) {
      whereClause += ` AND parent_product_id = $${paramIndex++}`;
      params.push(parentProductId);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const result = await this.db.query(
      `SELECT * FROM bill_of_materials
       WHERE ${whereClause}
       ORDER BY parent_product_id, sequence_number`,
      params
    );

    return result.rows.map(this.mapBillOfMaterialRow);
  }

  // =====================================================
  // VENDORS QUERIES
  // =====================================================

  @Query('vendors')
  async getVendors(
    @Args('tenantId') tenantId: string,
    @Args('vendorType') vendorType: string | null,
    @Args('isActive') isActive: boolean | null,
    @Args('isApproved') isApproved: boolean | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (vendorType) {
      whereClause += ` AND vendor_type = $${paramIndex++}`;
      params.push(vendorType);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    if (isApproved !== null) {
      whereClause += ` AND is_approved = $${paramIndex++}`;
      params.push(isApproved);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM vendors
       WHERE ${whereClause}
       ORDER BY vendor_code
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapVendorRow);
  }

  @Query('vendor')
  async getVendor(@Args('id') id: string) {
    const result = await this.db.query(
      `SELECT * FROM vendors WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    return result.rows.length > 0 ? this.mapVendorRow(result.rows[0]) : null;
  }

  @Query('vendorByCode')
  async getVendorByCode(
    @Args('tenantId') tenantId: string,
    @Args('vendorCode') vendorCode: string
  ) {
    const result = await this.db.query(
      `SELECT * FROM vendors WHERE tenant_id = $1 AND vendor_code = $2 AND is_current_version = TRUE AND deleted_at IS NULL`,
      [tenantId, vendorCode]
    );

    return result.rows.length > 0 ? this.mapVendorRow(result.rows[0]) : null;
  }

  @Query('vendorAsOf')
  async getVendorAsOf(
    @Args('vendorCode') vendorCode: string,
    @Args('tenantId') tenantId: string,
    @Args('asOfDate') asOfDate: string
  ) {
    const result = await this.db.query(
      `SELECT * FROM vendors
       WHERE tenant_id = $1
         AND vendor_code = $2
         AND effective_from_date <= $3::date
         AND (effective_to_date IS NULL OR effective_to_date >= $3::date)
         AND deleted_at IS NULL
       ORDER BY effective_from_date DESC
       LIMIT 1`,
      [tenantId, vendorCode, asOfDate]
    );

    return result.rows.length > 0 ? this.mapVendorRow(result.rows[0]) : null;
  }

  @Query('vendorHistory')
  async getVendorHistory(
    @Args('vendorCode') vendorCode: string,
    @Args('tenantId') tenantId: string
  ) {
    const result = await this.db.query(
      `SELECT * FROM vendors
       WHERE tenant_id = $1
         AND vendor_code = $2
         AND deleted_at IS NULL
       ORDER BY effective_from_date DESC`,
      [tenantId, vendorCode]
    );

    return result.rows.map(this.mapVendorRow);
  }

  // =====================================================
  // MATERIAL SUPPLIERS QUERIES
  // =====================================================

  @Query('materialSuppliers')
  async getMaterialSuppliers(
    @Args('tenantId') tenantId: string,
    @Args('materialId') materialId: string | null,
    @Args('vendorId') vendorId: string | null,
    @Args('isPreferredVendor') isPreferredVendor: boolean | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (materialId) {
      whereClause += ` AND material_id = $${paramIndex++}`;
      params.push(materialId);
    }

    if (vendorId) {
      whereClause += ` AND vendor_id = $${paramIndex++}`;
      params.push(vendorId);
    }

    if (isPreferredVendor !== null) {
      whereClause += ` AND is_preferred_vendor = $${paramIndex++}`;
      params.push(isPreferredVendor);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const result = await this.db.query(
      `SELECT * FROM materials_suppliers
       WHERE ${whereClause}
       ORDER BY material_id, is_preferred_vendor DESC, unit_price`,
      params
    );

    return result.rows.map(this.mapMaterialSupplierRow);
  }

  // =====================================================
  // PURCHASE ORDERS QUERIES
  // =====================================================

  @Query('purchaseOrders')
  async getPurchaseOrders(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string | null,
    @Args('vendorId') vendorId: string | null,
    @Args('status') status: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (facilityId) {
      whereClause += ` AND facility_id = $${paramIndex++}`;
      params.push(facilityId);
    }

    if (vendorId) {
      whereClause += ` AND vendor_id = $${paramIndex++}`;
      params.push(vendorId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (startDate) {
      whereClause += ` AND purchase_order_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND purchase_order_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM purchase_orders
       WHERE ${whereClause}
       ORDER BY purchase_order_date DESC, po_number DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapPurchaseOrderRow);
  }

  @Query('purchaseOrder')
  async getPurchaseOrder(@Args('id') id: string) {
    const result = await this.db.query(
      `SELECT * FROM purchase_orders WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const po = this.mapPurchaseOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM purchase_order_lines WHERE purchase_order_id = $1 ORDER BY line_number`,
      [id]
    );

    po.lines = linesResult.rows.map(this.mapPurchaseOrderLineRow);

    return po;
  }

  @Query('purchaseOrderByNumber')
  async getPurchaseOrderByNumber(@Args('poNumber') poNumber: string) {
    const result = await this.db.query(
      `SELECT * FROM purchase_orders WHERE po_number = $1`,
      [poNumber]
    );

    if (result.rows.length === 0) return null;

    const po = this.mapPurchaseOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM purchase_order_lines WHERE purchase_order_id = $1 ORDER BY line_number`,
      [po.id]
    );

    po.lines = linesResult.rows.map(this.mapPurchaseOrderLineRow);

    return po;
  }

  // =====================================================
  // VENDOR CONTRACTS QUERIES
  // =====================================================

  @Query('vendorContracts')
  async getVendorContracts(
    @Args('tenantId') tenantId: string,
    @Args('vendorId') vendorId: string | null,
    @Args('status') status: string | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (vendorId) {
      whereClause += ` AND vendor_id = $${paramIndex++}`;
      params.push(vendorId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const result = await this.db.query(
      `SELECT * FROM vendor_contracts
       WHERE ${whereClause}
       ORDER BY start_date DESC`,
      params
    );

    return result.rows.map(this.mapVendorContractRow);
  }

  // =====================================================
  // VENDOR PERFORMANCE QUERIES
  // =====================================================

  @Query('vendorPerformance')
  async getVendorPerformance(
    @Args('tenantId') tenantId: string,
    @Args('vendorId') vendorId: string | null,
    @Args('year') year: number | null,
    @Args('month') month: number | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (vendorId) {
      whereClause += ` AND vendor_id = $${paramIndex++}`;
      params.push(vendorId);
    }

    if (year) {
      whereClause += ` AND evaluation_period_year = $${paramIndex++}`;
      params.push(year);
    }

    if (month) {
      whereClause += ` AND evaluation_period_month = $${paramIndex++}`;
      params.push(month);
    }

    const result = await this.db.query(
      `SELECT * FROM vendor_performance
       WHERE ${whereClause}
       ORDER BY evaluation_period_year DESC, evaluation_period_month DESC`,
      params
    );

    return result.rows.map(this.mapVendorPerformanceRow);
  }

  // REMOVED: vendorScorecard and vendorComparisonReport queries - now in vendor-performance.resolver.ts

  // =====================================================
  // CUSTOMERS QUERIES
  // =====================================================

  @Query('customers')
  async getCustomers(
    @Args('tenantId') tenantId: string,
    @Args('customerType') customerType: string | null,
    @Args('isActive') isActive: boolean | null,
    @Args('salesRepUserId') salesRepUserId: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (customerType) {
      whereClause += ` AND customer_type = $${paramIndex++}`;
      params.push(customerType);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    if (salesRepUserId) {
      whereClause += ` AND sales_rep_user_id = $${paramIndex++}`;
      params.push(salesRepUserId);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM customers
       WHERE ${whereClause}
       ORDER BY customer_code
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapCustomerRow);
  }

  @Query('customer')
  async getCustomer(@Args('id') id: string) {
    const result = await this.db.query(
      `SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    return result.rows.length > 0 ? this.mapCustomerRow(result.rows[0]) : null;
  }

  @Query('customerByCode')
  async getCustomerByCode(
    @Args('tenantId') tenantId: string,
    @Args('customerCode') customerCode: string
  ) {
    const result = await this.db.query(
      `SELECT * FROM customers WHERE tenant_id = $1 AND customer_code = $2 AND deleted_at IS NULL`,
      [tenantId, customerCode]
    );

    return result.rows.length > 0 ? this.mapCustomerRow(result.rows[0]) : null;
  }

  // =====================================================
  // CUSTOMER PRODUCTS QUERIES
  // =====================================================

  @Query('customerProducts')
  async getCustomerProducts(
    @Args('tenantId') tenantId: string,
    @Args('customerId') customerId: string | null,
    @Args('productId') productId: string | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (customerId) {
      whereClause += ` AND customer_id = $${paramIndex++}`;
      params.push(customerId);
    }

    if (productId) {
      whereClause += ` AND product_id = $${paramIndex++}`;
      params.push(productId);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const result = await this.db.query(
      `SELECT * FROM customer_products WHERE ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return result.rows.map(this.mapCustomerProductRow);
  }

  // =====================================================
  // CUSTOMER PRICING QUERIES
  // =====================================================

  @Query('customerPricing')
  async getCustomerPricing(
    @Args('tenantId') tenantId: string,
    @Args('customerId') customerId: string | null,
    @Args('productId') productId: string | null,
    @Args('asOfDate') asOfDate: string | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (customerId) {
      whereClause += ` AND customer_id = $${paramIndex++}`;
      params.push(customerId);
    }

    if (productId) {
      whereClause += ` AND product_id = $${paramIndex++}`;
      params.push(productId);
    }

    if (asOfDate) {
      whereClause += ` AND effective_from <= $${paramIndex} AND (effective_to IS NULL OR effective_to >= $${paramIndex})`;
      params.push(asOfDate);
      paramIndex++;
    }

    const result = await this.db.query(
      `SELECT * FROM customer_pricing WHERE ${whereClause} ORDER BY effective_from DESC`,
      params
    );

    return result.rows.map(this.mapCustomerPricingRow);
  }

  // =====================================================
  // QUOTES QUERIES
  // =====================================================

  @Query('quotes')
  async getQuotes(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string | null,
    @Args('customerId') customerId: string | null,
    @Args('status') status: string | null,
    @Args('salesRepUserId') salesRepUserId: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `q.tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (facilityId) {
      whereClause += ` AND q.facility_id = $${paramIndex++}`;
      params.push(facilityId);
    }

    if (customerId) {
      whereClause += ` AND q.customer_id = $${paramIndex++}`;
      params.push(customerId);
    }

    if (status) {
      whereClause += ` AND q.status = $${paramIndex++}`;
      params.push(status);
    }

    if (salesRepUserId) {
      whereClause += ` AND q.sales_rep_user_id = $${paramIndex++}`;
      params.push(salesRepUserId);
    }

    if (startDate) {
      whereClause += ` AND q.quote_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND q.quote_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT
         q.*,
         c.customer_name,
         f.facility_name,
         u.full_name as sales_rep_name
       FROM quotes q
       LEFT JOIN customers c ON q.customer_id = c.id
       LEFT JOIN facilities f ON q.facility_id = f.id
       LEFT JOIN users u ON q.sales_rep_user_id = u.id
       WHERE ${whereClause}
       ORDER BY q.quote_date DESC, q.quote_number DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapQuoteRow);
  }

  @Query('quote')
  async getQuote(@Args('id') id: string) {
    const result = await this.db.query(
      `SELECT
         q.*,
         c.customer_name,
         f.facility_name,
         u.full_name as sales_rep_name
       FROM quotes q
       LEFT JOIN customers c ON q.customer_id = c.id
       LEFT JOIN facilities f ON q.facility_id = f.id
       LEFT JOIN users u ON q.sales_rep_user_id = u.id
       WHERE q.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const quote = this.mapQuoteRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY line_number`,
      [id]
    );

    quote.lines = linesResult.rows.map(this.mapQuoteLineRow);

    return quote;
  }

  @Query('quoteByNumber')
  async getQuoteByNumber(@Args('quoteNumber') quoteNumber: string) {
    const result = await this.db.query(
      `SELECT
         q.*,
         c.customer_name,
         f.facility_name,
         u.full_name as sales_rep_name
       FROM quotes q
       LEFT JOIN customers c ON q.customer_id = c.id
       LEFT JOIN facilities f ON q.facility_id = f.id
       LEFT JOIN users u ON q.sales_rep_user_id = u.id
       WHERE q.quote_number = $1`,
      [quoteNumber]
    );

    if (result.rows.length === 0) return null;

    const quote = this.mapQuoteRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY line_number`,
      [quote.id]
    );

    quote.lines = linesResult.rows.map(this.mapQuoteLineRow);

    return quote;
  }

  // =====================================================
  // SALES ORDERS QUERIES
  // =====================================================

  @Query('salesOrders')
  async getSalesOrders(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string | null,
    @Args('customerId') customerId: string | null,
    @Args('status') status: string | null,
    @Args('salesRepUserId') salesRepUserId: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (facilityId) {
      whereClause += ` AND facility_id = $${paramIndex++}`;
      params.push(facilityId);
    }

    if (customerId) {
      whereClause += ` AND customer_id = $${paramIndex++}`;
      params.push(customerId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (salesRepUserId) {
      whereClause += ` AND sales_rep_user_id = $${paramIndex++}`;
      params.push(salesRepUserId);
    }

    if (startDate) {
      whereClause += ` AND order_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND order_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM sales_orders
       WHERE ${whereClause}
       ORDER BY order_date DESC, sales_order_number DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapSalesOrderRow);
  }

  @Query('salesOrder')
  async getSalesOrder(@Args('id') id: string) {
    const result = await this.db.query(
      `SELECT * FROM sales_orders WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const salesOrder = this.mapSalesOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM sales_order_lines WHERE sales_order_id = $1 ORDER BY line_number`,
      [id]
    );

    salesOrder.lines = linesResult.rows.map(this.mapSalesOrderLineRow);

    return salesOrder;
  }

  @Query('salesOrderByNumber')
  async getSalesOrderByNumber(@Args('salesOrderNumber') salesOrderNumber: string) {
    const result = await this.db.query(
      `SELECT * FROM sales_orders WHERE sales_order_number = $1`,
      [salesOrderNumber]
    );

    if (result.rows.length === 0) return null;

    const salesOrder = this.mapSalesOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM sales_order_lines WHERE sales_order_id = $1 ORDER BY line_number`,
      [salesOrder.id]
    );

    salesOrder.lines = linesResult.rows.map(this.mapSalesOrderLineRow);

    return salesOrder;
  }

  // =====================================================
  // PRICING RULES QUERIES
  // =====================================================

  @Query('pricingRules')
  async getPricingRules(
    @Args('tenantId') tenantId: string,
    @Args('ruleType') ruleType: string | null,
    @Args('isActive') isActive: boolean | null,
    @Args('asOfDate') asOfDate: string | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (ruleType) {
      whereClause += ` AND rule_type = $${paramIndex++}`;
      params.push(ruleType);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    if (asOfDate) {
      whereClause += ` AND effective_from <= $${paramIndex} AND (effective_to IS NULL OR effective_to >= $${paramIndex})`;
      params.push(asOfDate);
      paramIndex++;
    }

    const result = await this.db.query(
      `SELECT * FROM pricing_rules WHERE ${whereClause} ORDER BY priority, rule_code`,
      params
    );

    return result.rows.map(this.mapPricingRuleRow);
  }

  // =====================================================
  // MATERIALS MUTATIONS
  // =====================================================

  @Mutation('createMaterial')
  async createMaterial(
    @Args('tenantId') tenantId: string,
    @Args('materialCode') materialCode: string,
    @Args('materialName') materialName: string,
    @Args('materialType') materialType: string,
    @Args('description') description: string | null,
    @Args('primaryUom') primaryUom: string,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `INSERT INTO materials (
        tenant_id, material_code, material_name, material_type, description, primary_uom,
        costing_method, is_active, is_purchasable, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'AVERAGE', TRUE, TRUE, $7)
      RETURNING *`,
      [tenantId, materialCode, materialName, materialType, description, primaryUom, userId]
    );

    return this.mapMaterialRow(result.rows[0]);
  }

  @Mutation('updateMaterial')
  async updateMaterial(
    @Args('id') id: string,
    @Args('materialName') materialName: string | null,
    @Args('description') description: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (materialName) {
      updates.push(`material_name = $${paramIndex++}`);
      params.push(materialName);
    }

    if (description !== null) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.db.query(
      `UPDATE materials SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return this.mapMaterialRow(result.rows[0]);
  }

  @Mutation('deleteMaterial')
  async deleteMaterial(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    await this.db.query(
      `UPDATE materials SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
      [userId, id]
    );

    return true;
  }

  // =====================================================
  // PRODUCTS MUTATIONS
  // =====================================================

  @Mutation('createProduct')
  async createProduct(
    @Args('tenantId') tenantId: string,
    @Args('productCode') productCode: string,
    @Args('productName') productName: string,
    @Args('description') description: string | null,
    @Args('productCategory') productCategory: string | null,
    @Args('materialId') materialId: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `INSERT INTO products (
        tenant_id, product_code, product_name, description, product_category,
        material_id, design_bleed_inches, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 0.125, TRUE, $7)
      RETURNING *`,
      [tenantId, productCode, productName, description, productCategory, materialId, userId]
    );

    return this.mapProductRow(result.rows[0]);
  }

  @Mutation('updateProduct')
  async updateProduct(
    @Args('id') id: string,
    @Args('productName') productName: string | null,
    @Args('description') description: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (productName) {
      updates.push(`product_name = $${paramIndex++}`);
      params.push(productName);
    }

    if (description !== null) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.db.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return this.mapProductRow(result.rows[0]);
  }

  @Mutation('deleteProduct')
  async deleteProduct(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    await this.db.query(
      `UPDATE products SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
      [userId, id]
    );

    return true;
  }

  // =====================================================
  // BOM MUTATIONS
  // =====================================================

  @Mutation('createBillOfMaterial')
  async createBillOfMaterial(
    @Args('tenantId') tenantId: string,
    @Args('parentProductId') parentProductId: string,
    @Args('componentMaterialId') componentMaterialId: string,
    @Args('quantityPerParent') quantityPerParent: number,
    @Args('unitOfMeasure') unitOfMeasure: string | null,
    @Args('scrapPercentage') scrapPercentage: number | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `INSERT INTO bill_of_materials (
        tenant_id, parent_product_id, component_material_id, quantity_per_parent,
        unit_of_measure, scrap_percentage, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
      RETURNING *`,
      [tenantId, parentProductId, componentMaterialId, quantityPerParent, unitOfMeasure, scrapPercentage || 0, userId]
    );

    return this.mapBillOfMaterialRow(result.rows[0]);
  }

  @Mutation('updateBillOfMaterial')
  async updateBillOfMaterial(
    @Args('id') id: string,
    @Args('quantityPerParent') quantityPerParent: number | null,
    @Args('scrapPercentage') scrapPercentage: number | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (quantityPerParent !== null) {
      updates.push(`quantity_per_parent = $${paramIndex++}`);
      params.push(quantityPerParent);
    }

    if (scrapPercentage !== null) {
      updates.push(`scrap_percentage = $${paramIndex++}`);
      params.push(scrapPercentage);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.db.query(
      `UPDATE bill_of_materials SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return this.mapBillOfMaterialRow(result.rows[0]);
  }

  @Mutation('deleteBillOfMaterial')
  async deleteBillOfMaterial(@Args('id') id: string, @Context() context: any) {
    await this.db.query(`DELETE FROM bill_of_materials WHERE id = $1`, [id]);
    return true;
  }

  // =====================================================
  // VENDORS MUTATIONS
  // =====================================================

  @Mutation('createVendor')
  async createVendor(
    @Args('tenantId') tenantId: string,
    @Args('vendorCode') vendorCode: string,
    @Args('vendorName') vendorName: string,
    @Args('vendorType') vendorType: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `INSERT INTO vendors (
        tenant_id, vendor_code, vendor_name, vendor_type, payment_terms,
        is_active, is_approved, created_by
      ) VALUES ($1, $2, $3, $4, 'NET_30', TRUE, FALSE, $5)
      RETURNING *`,
      [tenantId, vendorCode, vendorName, vendorType, userId]
    );

    return this.mapVendorRow(result.rows[0]);
  }

  @Mutation('updateVendor')
  async updateVendor(
    @Args('id') id: string,
    @Args('vendorName') vendorName: string | null,
    @Args('primaryContactEmail') primaryContactEmail: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (vendorName) {
      updates.push(`vendor_name = $${paramIndex++}`);
      params.push(vendorName);
    }

    if (primaryContactEmail) {
      updates.push(`primary_contact_email = $${paramIndex++}`);
      params.push(primaryContactEmail);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.db.query(
      `UPDATE vendors SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return this.mapVendorRow(result.rows[0]);
  }

  @Mutation('approveVendor')
  async approveVendor(
    @Args('id') id: string,
    @Args('approvedByUserId') approvedByUserId: string,
    @Context() context: any
  ) {
    const result = await this.db.query(
      `UPDATE vendors
       SET is_approved = TRUE, approved_by_user_id = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approvedByUserId, id]
    );

    return this.mapVendorRow(result.rows[0]);
  }

  @Mutation('deleteVendor')
  async deleteVendor(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    await this.db.query(
      `UPDATE vendors SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
      [userId, id]
    );

    return true;
  }

  // =====================================================
  // PURCHASE ORDERS MUTATIONS
  // =====================================================

  @Mutation('createPurchaseOrder')
  async createPurchaseOrder(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string,
    @Args('vendorId') vendorId: string,
    @Args('poDate') poDate: string,
    @Args('poCurrencyCode') poCurrencyCode: string,
    @Args('totalAmount') totalAmount: number,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    // Generate PO number
    const poNumber = `PO-${Date.now()}`;

    const result = await this.db.query(
      `INSERT INTO purchase_orders (
        tenant_id, facility_id, po_number, purchase_order_date, vendor_id, po_currency_code,
        total_amount, status, requires_approval, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', TRUE, $8)
      RETURNING *`,
      [tenantId, facilityId, poNumber, poDate, vendorId, poCurrencyCode, totalAmount, userId]
    );

    const po = this.mapPurchaseOrderRow(result.rows[0]);
    po.lines = [];
    return po;
  }

  @Mutation('updatePurchaseOrder')
  async updatePurchaseOrder(
    @Args('id') id: string,
    @Args('status') status: string | null,
    @Args('promisedDeliveryDate') promisedDeliveryDate: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (promisedDeliveryDate) {
      updates.push(`promised_delivery_date = $${paramIndex++}`);
      params.push(promisedDeliveryDate);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.db.query(
      `UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    const po = this.mapPurchaseOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM purchase_order_lines WHERE purchase_order_id = $1 ORDER BY line_number`,
      [id]
    );

    po.lines = linesResult.rows.map(this.mapPurchaseOrderLineRow);

    return po;
  }

  @Mutation('approvePurchaseOrder')
  async approvePurchaseOrder(
    @Args('id') id: string,
    @Args('approvedByUserId') approvedByUserId: string,
    @Context() context: any
  ) {
    const result = await this.db.query(
      `UPDATE purchase_orders
       SET status = 'ISSUED', approved_by_user_id = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approvedByUserId, id]
    );

    const po = this.mapPurchaseOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM purchase_order_lines WHERE purchase_order_id = $1 ORDER BY line_number`,
      [id]
    );

    po.lines = linesResult.rows.map(this.mapPurchaseOrderLineRow);

    return po;
  }

  @Mutation('receivePurchaseOrder')
  async receivePurchaseOrder(
    @Args('id') id: string,
    @Args('receiptDetails') receiptDetails: any,
    @Context() context: any
  ) {
    // TODO: Implement receiving logic (update quantities, create inventory transactions)
    // For now, just update status to RECEIVED

    const result = await this.db.query(
      `UPDATE purchase_orders SET status = 'RECEIVED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    const po = this.mapPurchaseOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM purchase_order_lines WHERE purchase_order_id = $1 ORDER BY line_number`,
      [id]
    );

    po.lines = linesResult.rows.map(this.mapPurchaseOrderLineRow);

    return po;
  }

  @Mutation('closePurchaseOrder')
  async closePurchaseOrder(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `UPDATE purchase_orders SET status = 'CLOSED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    const po = this.mapPurchaseOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM purchase_order_lines WHERE purchase_order_id = $1 ORDER BY line_number`,
      [id]
    );

    po.lines = linesResult.rows.map(this.mapPurchaseOrderLineRow);

    return po;
  }

  // =====================================================
  // VENDOR PERFORMANCE MUTATIONS
  // =====================================================

  @Mutation('calculateVendorPerformance')
  async calculateVendorPerformance(
    @Args('tenantId') tenantId: string,
    @Args('vendorId') vendorId: string,
    @Args('year') year: number,
    @Args('month') month: number,
    @Context() context: any
  ) {
    // Security: Validate tenant access
    validateTenantAccess(context, tenantId);

    // Validation: Check year and month ranges
    validateCalculatePerformanceInput({ year, month });

    return this.vendorPerformanceService.calculateVendorPerformance(
      tenantId,
      vendorId,
      year,
      month
    );
  }

  @Mutation('calculateAllVendorsPerformance')
  async calculateAllVendorsPerformance(
    @Args('tenantId') tenantId: string,
    @Args('year') year: number,
    @Args('month') month: number,
    @Context() context: any
  ) {
    // Security: Validate tenant access
    validateTenantAccess(context, tenantId);

    // Validation: Check year and month ranges
    validateCalculatePerformanceInput({ year, month });

    return this.vendorPerformanceService.calculateAllVendorsPerformance(
      tenantId,
      year,
      month
    );
  }

  @Mutation('updateVendorPerformanceScores')
  async updateVendorPerformanceScores(
    @Args('id') id: string,
    @Args('priceCompetitivenessScore') priceCompetitivenessScore: number | null,
    @Args('responsivenessScore') responsivenessScore: number | null,
    @Args('notes') notes: string | null,
    @Context() context: any
  ) {
    // Validation: Check score ranges
    validateUpdatePerformanceScoresInput({
      priceCompetitivenessScore,
      responsivenessScore,
    });

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (priceCompetitivenessScore !== null) {
      updates.push(`price_competitiveness_score = $${paramIndex++}`);
      params.push(priceCompetitivenessScore);
    }

    if (responsivenessScore !== null) {
      updates.push(`responsiveness_score = $${paramIndex++}`);
      params.push(responsivenessScore);
    }

    if (notes !== null) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }

    // Recalculate overall rating if we updated any scores
    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      params.push(id);

      const result = await this.db.query(
        `UPDATE vendor_performance
         SET ${updates.join(', ')},
             overall_rating = (
               (COALESCE((on_time_percentage / 100.0 * 5), 0) * 0.4) +
               (COALESCE((quality_percentage / 100.0 * 5), 0) * 0.4) +
               (COALESCE(price_competitiveness_score, 0) * 0.1) +
               (COALESCE(responsiveness_score, 0) * 0.1)
             )
         WHERE id = $${paramIndex}
         RETURNING *`,
        params
      );

      return this.mapVendorPerformanceRow(result.rows[0]);
    }

    // If no updates, just return the existing record
    const result = await this.db.query(
      `SELECT * FROM vendor_performance WHERE id = $1`,
      [id]
    );

    return this.mapVendorPerformanceRow(result.rows[0]);
  }

  // =====================================================
  // CUSTOMERS MUTATIONS
  // =====================================================

  @Mutation('createCustomer')
  async createCustomer(
    @Args('tenantId') tenantId: string,
    @Args('customerCode') customerCode: string,
    @Args('customerName') customerName: string,
    @Args('customerType') customerType: string | null,
    @Args('billingCurrencyCode') billingCurrencyCode: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `INSERT INTO customers (
        tenant_id, customer_code, customer_name, customer_type, payment_terms,
        billing_currency_code, is_active, tax_exempt, credit_hold, created_by
      ) VALUES ($1, $2, $3, $4, 'NET_30', $5, TRUE, FALSE, FALSE, $6)
      RETURNING *`,
      [tenantId, customerCode, customerName, customerType, billingCurrencyCode || 'USD', userId]
    );

    return this.mapCustomerRow(result.rows[0]);
  }

  @Mutation('updateCustomer')
  async updateCustomer(
    @Args('id') id: string,
    @Args('customerName') customerName: string | null,
    @Args('primaryContactEmail') primaryContactEmail: string | null,
    @Args('creditLimit') creditLimit: number | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (customerName) {
      updates.push(`customer_name = $${paramIndex++}`);
      params.push(customerName);
    }

    if (primaryContactEmail) {
      updates.push(`primary_contact_email = $${paramIndex++}`);
      params.push(primaryContactEmail);
    }

    if (creditLimit !== null) {
      updates.push(`credit_limit = $${paramIndex++}`);
      params.push(creditLimit);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.db.query(
      `UPDATE customers SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return this.mapCustomerRow(result.rows[0]);
  }

  @Mutation('deleteCustomer')
  async deleteCustomer(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    await this.db.query(
      `UPDATE customers SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
      [userId, id]
    );

    return true;
  }

  // =====================================================
  // QUOTES MUTATIONS
  // =====================================================

  @Mutation('createQuote')
  async createQuote(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string | null,
    @Args('customerId') customerId: string,
    @Args('quoteDate') quoteDate: string,
    @Args('quoteCurrencyCode') quoteCurrencyCode: string,
    @Args('totalAmount') totalAmount: number,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    // Generate quote number
    const quoteNumber = `QT-${Date.now()}`;

    const result = await this.db.query(
      `INSERT INTO quotes (
        tenant_id, facility_id, quote_number, quote_date, customer_id,
        quote_currency_code, total_amount, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', $8)
      RETURNING *`,
      [tenantId, facilityId, quoteNumber, quoteDate, customerId, quoteCurrencyCode, totalAmount, userId]
    );

    const quote = this.mapQuoteRow(result.rows[0]);
    quote.lines = [];
    return quote;
  }

  @Mutation('updateQuote')
  async updateQuote(
    @Args('id') id: string,
    @Args('status') status: string | null,
    @Args('expirationDate') expirationDate: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (expirationDate) {
      updates.push(`expiration_date = $${paramIndex++}`);
      params.push(expirationDate);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.db.query(
      `UPDATE quotes SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    const quote = this.mapQuoteRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY line_number`,
      [id]
    );

    quote.lines = linesResult.rows.map(this.mapQuoteLineRow);

    return quote;
  }

  @Mutation('convertQuoteToSalesOrder')
  async convertQuoteToSalesOrder(
    @Args('quoteId') quoteId: string,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Get quote
      const quoteResult = await client.query(
        `SELECT * FROM quotes WHERE id = $1`,
        [quoteId]
      );

      if (quoteResult.rows.length === 0) {
        throw new Error('Quote not found');
      }

      const quote = quoteResult.rows[0];

      // Generate sales order number
      const salesOrderNumber = `SO-${Date.now()}`;

      // Create sales order
      const soResult = await client.query(
        `INSERT INTO sales_orders (
          tenant_id, facility_id, sales_order_number, order_date, customer_id,
          sales_rep_user_id, order_currency_code, subtotal, tax_amount,
          shipping_amount, discount_amount, total_amount, status, quote_id, created_by
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, $11, 'DRAFT', $12, $13)
        RETURNING *`,
        [
          quote.tenant_id, quote.facility_id, salesOrderNumber, quote.customer_id,
          quote.sales_rep_user_id, quote.quote_currency_code, quote.subtotal,
          quote.tax_amount, quote.shipping_amount, quote.discount_amount,
          quote.total_amount, quoteId, userId
        ]
      );

      const salesOrder = soResult.rows[0];

      // Copy quote lines to sales order lines
      const quoteLinesResult = await client.query(
        `SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY line_number`,
        [quoteId]
      );

      for (const quoteLine of quoteLinesResult.rows) {
        await client.query(
          `INSERT INTO sales_order_lines (
            tenant_id, sales_order_id, line_number, product_id, product_code,
            description, quantity_ordered, unit_of_measure, unit_price, line_amount,
            discount_percentage, discount_amount, manufacturing_strategy,
            requested_delivery_date, promised_delivery_date, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'OPEN')`,
          [
            quote.tenant_id, salesOrder.id, quoteLine.line_number, quoteLine.product_id,
            quoteLine.product_code, quoteLine.description, quoteLine.quantity,
            quoteLine.unit_of_measure, quoteLine.unit_price, quoteLine.line_amount,
            quoteLine.discount_percentage, quoteLine.discount_amount,
            quoteLine.manufacturing_strategy, null, quoteLine.promised_delivery_date
          ]
        );
      }

      // Update quote status
      await client.query(
        `UPDATE quotes
         SET status = 'CONVERTED_TO_ORDER', converted_to_sales_order_id = $1, converted_at = NOW()
         WHERE id = $2`,
        [salesOrder.id, quoteId]
      );

      await client.query('COMMIT');

      // Return the new sales order
      return this.getSalesOrder(salesOrder.id);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // SALES ORDERS MUTATIONS
  // =====================================================

  @Mutation('createSalesOrder')
  async createSalesOrder(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string,
    @Args('customerId') customerId: string,
    @Args('orderDate') orderDate: string,
    @Args('orderCurrencyCode') orderCurrencyCode: string,
    @Args('totalAmount') totalAmount: number,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    // Generate sales order number
    const salesOrderNumber = `SO-${Date.now()}`;

    const result = await this.db.query(
      `INSERT INTO sales_orders (
        tenant_id, facility_id, sales_order_number, order_date, customer_id,
        order_currency_code, total_amount, status, priority, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', 5, $8)
      RETURNING *`,
      [tenantId, facilityId, salesOrderNumber, orderDate, customerId, orderCurrencyCode, totalAmount, userId]
    );

    const salesOrder = this.mapSalesOrderRow(result.rows[0]);
    salesOrder.lines = [];
    return salesOrder;
  }

  @Mutation('updateSalesOrder')
  async updateSalesOrder(
    @Args('id') id: string,
    @Args('status') status: string | null,
    @Args('promisedDeliveryDate') promisedDeliveryDate: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (promisedDeliveryDate) {
      updates.push(`promised_delivery_date = $${paramIndex++}`);
      params.push(promisedDeliveryDate);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.db.query(
      `UPDATE sales_orders SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    const salesOrder = this.mapSalesOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM sales_order_lines WHERE sales_order_id = $1 ORDER BY line_number`,
      [id]
    );

    salesOrder.lines = linesResult.rows.map(this.mapSalesOrderLineRow);

    return salesOrder;
  }

  @Mutation('confirmSalesOrder')
  async confirmSalesOrder(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `UPDATE sales_orders SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    const salesOrder = this.mapSalesOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM sales_order_lines WHERE sales_order_id = $1 ORDER BY line_number`,
      [id]
    );

    salesOrder.lines = linesResult.rows.map(this.mapSalesOrderLineRow);

    return salesOrder;
  }

  @Mutation('shipSalesOrder')
  async shipSalesOrder(
    @Args('id') id: string,
    @Args('shipmentDetails') shipmentDetails: any,
    @Context() context: any
  ) {
    // TODO: Implement shipping logic (create shipment records, update quantities)
    // For now, just update status to SHIPPED

    const result = await this.db.query(
      `UPDATE sales_orders SET status = 'SHIPPED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    const salesOrder = this.mapSalesOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM sales_order_lines WHERE sales_order_id = $1 ORDER BY line_number`,
      [id]
    );

    salesOrder.lines = linesResult.rows.map(this.mapSalesOrderLineRow);

    return salesOrder;
  }

  @Mutation('cancelSalesOrder')
  async cancelSalesOrder(
    @Args('id') id: string,
    @Args('reason') reason: string | null,
    @Context() context: any
  ) {
    const result = await this.db.query(
      `UPDATE sales_orders SET status = 'CANCELLED', notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [reason, id]
    );

    const salesOrder = this.mapSalesOrderRow(result.rows[0]);

    // Load lines
    const linesResult = await this.db.query(
      `SELECT * FROM sales_order_lines WHERE sales_order_id = $1 ORDER BY line_number`,
      [id]
    );

    salesOrder.lines = linesResult.rows.map(this.mapSalesOrderLineRow);

    return salesOrder;
  }

  // =====================================================
  // PRICING RULES MUTATIONS
  // =====================================================

  @Mutation('createPricingRule')
  async createPricingRule(
    @Args('tenantId') tenantId: string,
    @Args('ruleCode') ruleCode: string,
    @Args('ruleName') ruleName: string,
    @Args('ruleType') ruleType: string,
    @Args('pricingAction') pricingAction: string,
    @Args('actionValue') actionValue: number,
    @Args('effectiveFrom') effectiveFrom: string,
    @Args('conditions') conditions: any | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `INSERT INTO pricing_rules (
        tenant_id, rule_code, rule_name, rule_type, priority, conditions,
        pricing_action, action_value, effective_from, is_active, created_by
      ) VALUES ($1, $2, $3, $4, 10, $5, $6, $7, $8, TRUE, $9)
      RETURNING *`,
      [tenantId, ruleCode, ruleName, ruleType, JSON.stringify(conditions || {}), pricingAction, actionValue, effectiveFrom, userId]
    );

    return this.mapPricingRuleRow(result.rows[0]);
  }

  @Mutation('updatePricingRule')
  async updatePricingRule(
    @Args('id') id: string,
    @Args('ruleName') ruleName: string | null,
    @Args('actionValue') actionValue: number | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (ruleName) {
      updates.push(`rule_name = $${paramIndex++}`);
      params.push(ruleName);
    }

    if (actionValue !== null) {
      updates.push(`action_value = $${paramIndex++}`);
      params.push(actionValue);
    }

    if (isActive !== null) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(isActive);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.db.query(
      `UPDATE pricing_rules SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return this.mapPricingRuleRow(result.rows[0]);
  }

  @Mutation('deletePricingRule')
  async deletePricingRule(@Args('id') id: string, @Context() context: any) {
    await this.db.query(`DELETE FROM pricing_rules WHERE id = $1`, [id]);
    return true;
  }

  // =====================================================
  // ROW MAPPERS (snake_case → camelCase)
  // =====================================================

  private mapMaterialRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      materialCode: row.material_code,
      materialName: row.material_name,
      description: row.description,
      materialType: row.material_type,
      materialCategory: row.material_category,
      primaryUom: row.primary_uom,
      secondaryUom: row.secondary_uom,
      uomConversionFactor: row.uom_conversion_factor ? parseFloat(row.uom_conversion_factor) : null,
      widthInches: row.width_inches ? parseFloat(row.width_inches) : null,
      heightInches: row.height_inches ? parseFloat(row.height_inches) : null,
      thicknessInches: row.thickness_inches ? parseFloat(row.thickness_inches) : null,
      weightLbsPerUnit: row.weight_lbs_per_unit ? parseFloat(row.weight_lbs_per_unit) : null,
      basisWeightLbs: row.basis_weight_lbs,
      caliperInches: row.caliper_inches ? parseFloat(row.caliper_inches) : null,
      finish: row.finish,
      grainDirection: row.grain_direction,
      isLotTracked: row.is_lot_tracked,
      isSerialized: row.is_serialized,
      shelfLifeDays: row.shelf_life_days,
      abcClassification: row.abc_classification,
      standardCost: row.standard_cost ? parseFloat(row.standard_cost) : null,
      costCurrencyCode: row.cost_currency_code,
      lastCost: row.last_cost ? parseFloat(row.last_cost) : null,
      averageCost: row.average_cost ? parseFloat(row.average_cost) : null,
      costingMethod: row.costing_method,
      defaultVendorId: row.default_vendor_id,
      leadTimeDays: row.lead_time_days,
      minimumOrderQuantity: row.minimum_order_quantity ? parseFloat(row.minimum_order_quantity) : null,
      orderMultiple: row.order_multiple ? parseFloat(row.order_multiple) : null,
      safetyStockQuantity: row.safety_stock_quantity ? parseFloat(row.safety_stock_quantity) : null,
      reorderPoint: row.reorder_point ? parseFloat(row.reorder_point) : null,
      economicOrderQuantity: row.economic_order_quantity ? parseFloat(row.economic_order_quantity) : null,
      requiresInspection: row.requires_inspection,
      fdaCompliant: row.fda_compliant,
      foodContactApproved: row.food_contact_approved,
      fscCertified: row.fsc_certified,
      isActive: row.is_active,
      isPurchasable: row.is_purchasable,
      isSellable: row.is_sellable,
      isManufacturable: row.is_manufacturable,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by
    };
  }

  private mapProductRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productCode: row.product_code,
      productName: row.product_name,
      description: row.description,
      productCategory: row.product_category,
      materialId: row.material_id,
      packagingType: row.packaging_type,
      designWidthInches: row.design_width_inches ? parseFloat(row.design_width_inches) : null,
      designHeightInches: row.design_height_inches ? parseFloat(row.design_height_inches) : null,
      designBleedInches: row.design_bleed_inches ? parseFloat(row.design_bleed_inches) : null,
      defaultRoutingId: row.default_routing_id,
      standardProductionTimeHours: row.standard_production_time_hours ? parseFloat(row.standard_production_time_hours) : null,
      standardMaterialCost: row.standard_material_cost ? parseFloat(row.standard_material_cost) : null,
      standardLaborCost: row.standard_labor_cost ? parseFloat(row.standard_labor_cost) : null,
      standardOverheadCost: row.standard_overhead_cost ? parseFloat(row.standard_overhead_cost) : null,
      standardTotalCost: row.standard_total_cost ? parseFloat(row.standard_total_cost) : null,
      listPrice: row.list_price ? parseFloat(row.list_price) : null,
      priceCurrencyCode: row.price_currency_code,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by
    };
  }

  private mapBillOfMaterialRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      parentProductId: row.parent_product_id,
      componentMaterialId: row.component_material_id,
      componentDescription: row.component_description,
      quantityPerParent: parseFloat(row.quantity_per_parent),
      unitOfMeasure: row.unit_of_measure,
      scrapPercentage: row.scrap_percentage ? parseFloat(row.scrap_percentage) : null,
      sequenceNumber: row.sequence_number,
      operationId: row.operation_id,
      isSubstitutable: row.is_substitutable,
      substituteMaterialId: row.substitute_material_id,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapVendorRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      vendorCode: row.vendor_code,
      vendorName: row.vendor_name,
      legalName: row.legal_name,
      vendorType: row.vendor_type,
      primaryContactName: row.primary_contact_name,
      primaryContactEmail: row.primary_contact_email,
      primaryContactPhone: row.primary_contact_phone,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      country: row.country,
      taxId: row.tax_id,
      paymentTerms: row.payment_terms,
      paymentCurrencyCode: row.payment_currency_code,
      onTimeDeliveryPercentage: row.on_time_delivery_percentage ? parseFloat(row.on_time_delivery_percentage) : null,
      qualityRatingPercentage: row.quality_rating_percentage ? parseFloat(row.quality_rating_percentage) : null,
      overallRating: row.overall_rating ? parseFloat(row.overall_rating) : null,
      isActive: row.is_active,
      isApproved: row.is_approved,
      approvedByUserId: row.approved_by_user_id,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by
    };
  }

  private mapMaterialSupplierRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      materialId: row.material_id,
      vendorId: row.vendor_id,
      isPreferredVendor: row.is_preferred_vendor,
      vendorMaterialCode: row.vendor_material_code,
      vendorMaterialName: row.vendor_material_name,
      unitPrice: row.unit_price ? parseFloat(row.unit_price) : null,
      priceCurrencyCode: row.price_currency_code,
      priceUom: row.price_uom,
      priceBreaks: row.price_breaks,
      leadTimeDays: row.lead_time_days,
      minimumOrderQuantity: row.minimum_order_quantity ? parseFloat(row.minimum_order_quantity) : null,
      orderMultiple: row.order_multiple ? parseFloat(row.order_multiple) : null,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapPurchaseOrderRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      poNumber: row.po_number,
      purchaseOrderDate: row.purchase_order_date,
      vendorId: row.vendor_id,
      shipToFacilityId: row.ship_to_facility_id,
      shipToAddress: row.ship_to_address,
      billingEntityId: row.billing_entity_id,
      buyerUserId: row.buyer_user_id,
      poCurrencyCode: row.po_currency_code,
      exchangeRate: row.exchange_rate ? parseFloat(row.exchange_rate) : null,
      subtotal: row.subtotal ? parseFloat(row.subtotal) : null,
      taxAmount: row.tax_amount ? parseFloat(row.tax_amount) : null,
      shippingAmount: row.shipping_amount ? parseFloat(row.shipping_amount) : null,
      totalAmount: parseFloat(row.total_amount),
      paymentTerms: row.payment_terms,
      requestedDeliveryDate: row.requested_delivery_date,
      promisedDeliveryDate: row.promised_delivery_date,
      status: row.status,
      requiresApproval: row.requires_approval,
      approvedByUserId: row.approved_by_user_id,
      approvedAt: row.approved_at,
      journalEntryId: row.journal_entry_id,
      notes: row.notes,
      lines: [],
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapPurchaseOrderLineRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      purchaseOrderId: row.purchase_order_id,
      lineNumber: row.line_number,
      materialId: row.material_id,
      materialCode: row.material_code,
      description: row.description,
      quantityOrdered: parseFloat(row.quantity_ordered),
      quantityReceived: row.quantity_received ? parseFloat(row.quantity_received) : null,
      quantityRemaining: row.quantity_remaining ? parseFloat(row.quantity_remaining) : null,
      unitOfMeasure: row.unit_of_measure,
      unitPrice: parseFloat(row.unit_price),
      lineAmount: parseFloat(row.line_amount),
      requestedDeliveryDate: row.requested_delivery_date,
      promisedDeliveryDate: row.promised_delivery_date,
      expenseAccountId: row.expense_account_id,
      allowOverReceipt: row.allow_over_receipt,
      overReceiptTolerancePercentage: row.over_receipt_tolerance_percentage ? parseFloat(row.over_receipt_tolerance_percentage) : null,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapVendorContractRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contractNumber: row.contract_number,
      contractName: row.contract_name,
      vendorId: row.vendor_id,
      startDate: row.start_date,
      endDate: row.end_date,
      autoRenew: row.auto_renew,
      pricingTerms: row.pricing_terms,
      volumeCommitment: row.volume_commitment ? parseFloat(row.volume_commitment) : null,
      currencyCode: row.currency_code,
      paymentTerms: row.payment_terms,
      status: row.status,
      contractDocumentUrl: row.contract_document_url,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapVendorPerformanceRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      vendorId: row.vendor_id,
      evaluationPeriodYear: row.evaluation_period_year,
      evaluationPeriodMonth: row.evaluation_period_month,
      totalPosIssued: row.total_pos_issued,
      totalPosValue: row.total_pos_value ? parseFloat(row.total_pos_value) : null,
      onTimeDeliveries: row.on_time_deliveries,
      totalDeliveries: row.total_deliveries,
      onTimePercentage: row.on_time_percentage ? parseFloat(row.on_time_percentage) : null,
      qualityAcceptances: row.quality_acceptances,
      qualityRejections: row.quality_rejections,
      qualityPercentage: row.quality_percentage ? parseFloat(row.quality_percentage) : null,
      priceCompetitivenessScore: row.price_competitiveness_score ? parseFloat(row.price_competitiveness_score) : null,
      responsivenessScore: row.responsiveness_score ? parseFloat(row.responsiveness_score) : null,
      overallRating: row.overall_rating ? parseFloat(row.overall_rating) : null,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapCustomerRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      customerCode: row.customer_code,
      customerName: row.customer_name,
      legalName: row.legal_name,
      customerType: row.customer_type,
      primaryContactName: row.primary_contact_name,
      primaryContactEmail: row.primary_contact_email,
      primaryContactPhone: row.primary_contact_phone,
      billingAddressLine1: row.billing_address_line1,
      billingAddressLine2: row.billing_address_line2,
      billingCity: row.billing_city,
      billingState: row.billing_state,
      billingPostalCode: row.billing_postal_code,
      billingCountry: row.billing_country,
      shippingAddressLine1: row.shipping_address_line1,
      shippingAddressLine2: row.shipping_address_line2,
      shippingCity: row.shipping_city,
      shippingState: row.shipping_state,
      shippingPostalCode: row.shipping_postal_code,
      shippingCountry: row.shipping_country,
      taxId: row.tax_id,
      taxExempt: row.tax_exempt,
      taxExemptionCertificateUrl: row.tax_exemption_certificate_url,
      paymentTerms: row.payment_terms,
      creditLimit: row.credit_limit ? parseFloat(row.credit_limit) : null,
      billingCurrencyCode: row.billing_currency_code,
      salesRepUserId: row.sales_rep_user_id,
      csrUserId: row.csr_user_id,
      pricingTier: row.pricing_tier,
      isActive: row.is_active,
      creditHold: row.credit_hold,
      lifetimeRevenue: row.lifetime_revenue ? parseFloat(row.lifetime_revenue) : null,
      ytdRevenue: row.ytd_revenue ? parseFloat(row.ytd_revenue) : null,
      averageOrderValue: row.average_order_value ? parseFloat(row.average_order_value) : null,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by
    };
  }

  private mapCustomerProductRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      productId: row.product_id,
      customerProductCode: row.customer_product_code,
      customerProductName: row.customer_product_name,
      specifications: row.specifications,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapCustomerPricingRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      productId: row.product_id,
      unitPrice: parseFloat(row.unit_price),
      priceCurrencyCode: row.price_currency_code,
      priceUom: row.price_uom,
      minimumQuantity: row.minimum_quantity ? parseFloat(row.minimum_quantity) : null,
      priceBreaks: row.price_breaks,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapQuoteRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      quoteNumber: row.quote_number,
      quoteDate: row.quote_date,
      expirationDate: row.expiration_date,
      customerId: row.customer_id,
      customerName: row.customer_name,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      salesRepUserId: row.sales_rep_user_id,
      salesRepName: row.sales_rep_name,
      facilityName: row.facility_name,
      quoteCurrencyCode: row.quote_currency_code,
      subtotal: row.subtotal ? parseFloat(row.subtotal) : null,
      taxAmount: row.tax_amount ? parseFloat(row.tax_amount) : null,
      shippingAmount: row.shipping_amount ? parseFloat(row.shipping_amount) : null,
      discountAmount: row.discount_amount ? parseFloat(row.discount_amount) : null,
      totalAmount: parseFloat(row.total_amount),
      totalCost: row.total_cost ? parseFloat(row.total_cost) : null,
      marginAmount: row.margin_amount ? parseFloat(row.margin_amount) : null,
      marginPercentage: row.margin_percentage ? parseFloat(row.margin_percentage) : null,
      status: row.status,
      convertedToSalesOrderId: row.converted_to_sales_order_id,
      convertedAt: row.converted_at,
      notes: row.notes,
      termsAndConditions: row.terms_and_conditions,
      lines: [],
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapQuoteLineRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      quoteId: row.quote_id,
      lineNumber: row.line_number,
      productId: row.product_id,
      productCode: row.product_code,
      description: row.description,
      quantityQuoted: parseFloat(row.quantity_quoted),
      unitOfMeasure: row.unit_of_measure,
      unitPrice: parseFloat(row.unit_price),
      lineAmount: parseFloat(row.line_amount),
      discountPercentage: row.discount_percentage ? parseFloat(row.discount_percentage) : null,
      discountAmount: row.discount_amount ? parseFloat(row.discount_amount) : null,
      unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
      lineCost: row.line_cost ? parseFloat(row.line_cost) : null,
      lineMargin: row.line_margin ? parseFloat(row.line_margin) : null,
      marginPercentage: row.margin_percentage ? parseFloat(row.margin_percentage) : null,
      manufacturingStrategy: row.manufacturing_strategy,
      leadTimeDays: row.lead_time_days,
      promisedDeliveryDate: row.promised_delivery_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapSalesOrderRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      salesOrderNumber: row.sales_order_number,
      orderDate: row.order_date,
      customerId: row.customer_id,
      customerPoNumber: row.customer_po_number,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      shipToName: row.ship_to_name,
      shipToAddressLine1: row.ship_to_address_line1,
      shipToAddressLine2: row.ship_to_address_line2,
      shipToCity: row.ship_to_city,
      shipToState: row.ship_to_state,
      shipToPostalCode: row.ship_to_postal_code,
      shipToCountry: row.ship_to_country,
      salesRepUserId: row.sales_rep_user_id,
      orderCurrencyCode: row.order_currency_code,
      exchangeRate: row.exchange_rate ? parseFloat(row.exchange_rate) : null,
      subtotal: row.subtotal ? parseFloat(row.subtotal) : null,
      taxAmount: row.tax_amount ? parseFloat(row.tax_amount) : null,
      shippingAmount: row.shipping_amount ? parseFloat(row.shipping_amount) : null,
      discountAmount: row.discount_amount ? parseFloat(row.discount_amount) : null,
      totalAmount: parseFloat(row.total_amount),
      paymentTerms: row.payment_terms,
      requestedDeliveryDate: row.requested_delivery_date,
      promisedDeliveryDate: row.promised_delivery_date,
      status: row.status,
      priority: row.priority,
      quoteId: row.quote_id,
      notes: row.notes,
      specialInstructions: row.special_instructions,
      lines: [],
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapSalesOrderLineRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      salesOrderId: row.sales_order_id,
      lineNumber: row.line_number,
      productId: row.product_id,
      productCode: row.product_code,
      description: row.description,
      quantityOrdered: parseFloat(row.quantity_ordered),
      quantityShipped: row.quantity_shipped ? parseFloat(row.quantity_shipped) : null,
      quantityInvoiced: row.quantity_invoiced ? parseFloat(row.quantity_invoiced) : null,
      unitOfMeasure: row.unit_of_measure,
      unitPrice: parseFloat(row.unit_price),
      lineAmount: parseFloat(row.line_amount),
      discountPercentage: row.discount_percentage ? parseFloat(row.discount_percentage) : null,
      discountAmount: row.discount_amount ? parseFloat(row.discount_amount) : null,
      manufacturingStrategy: row.manufacturing_strategy,
      productionOrderId: row.production_order_id,
      requestedDeliveryDate: row.requested_delivery_date,
      promisedDeliveryDate: row.promised_delivery_date,
      impositionLayoutId: row.imposition_layout_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapPricingRuleRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ruleCode: row.rule_code,
      ruleName: row.rule_name,
      description: row.description,
      ruleType: row.rule_type,
      priority: row.priority,
      conditions: row.conditions,
      pricingAction: row.pricing_action,
      actionValue: parseFloat(row.action_value),
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }
}
