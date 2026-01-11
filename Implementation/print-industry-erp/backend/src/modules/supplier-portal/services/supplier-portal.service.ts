/**
 * Supplier Portal Service
 * Handles supplier portal business logic (dashboard, POs, ASNs, performance)
 *
 * REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class SupplierPortalService {
  constructor(@Inject('DATABASE_POOL') private readonly dbPool: Pool) {}

  /**
   * Get supplier dashboard metrics
   */
  async getSupplierDashboard(vendorId: string, tenantId: string): Promise<any> {
    // Get open PO metrics
    const poMetrics = await this.dbPool.query(
      `SELECT
         COUNT(*) as open_po_count,
         COALESCE(SUM(total_amount), 0) as open_po_total_value
       FROM purchase_orders
       WHERE vendor_id = $1
         AND tenant_id = $2
         AND status IN ('APPROVED', 'SENT_TO_VENDOR', 'ACKNOWLEDGED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED')
         AND deleted_at IS NULL`,
      [vendorId, tenantId],
    );

    // Get pending ASN count
    const asnMetrics = await this.dbPool.query(
      `SELECT COUNT(*) as pending_asn_count
       FROM advanced_ship_notices
       WHERE vendor_id = $1
         AND tenant_id = $2
         AND status IN ('CREATED', 'SUBMITTED', 'IN_TRANSIT')
         AND deleted_at IS NULL`,
      [vendorId, tenantId],
    );

    // Get current performance rating
    const performanceResult = await this.dbPool.query(
      `SELECT
         overall_rating,
         on_time_delivery_percentage,
         quality_acceptance_percentage,
         vendor_tier
       FROM vendor_performance
       WHERE vendor_id = $1
         AND tenant_id = $2
         AND year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
         AND month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
       ORDER BY created_at DESC
       LIMIT 1`,
      [vendorId, tenantId],
    );

    // Get vendor tier if no performance data
    let vendorTier = 'TRANSACTIONAL';
    let performanceRating = null;
    let otdPercentage = null;
    let qualityPercentage = null;

    if (performanceResult.rows.length > 0) {
      const perf = performanceResult.rows[0];
      vendorTier = perf.vendor_tier || 'TRANSACTIONAL';
      performanceRating = perf.overall_rating;
      otdPercentage = perf.on_time_delivery_percentage;
      qualityPercentage = perf.quality_acceptance_percentage;
    } else {
      // Get vendor tier from vendors table
      const vendorResult = await this.dbPool.query(
        `SELECT vendor_tier FROM vendors WHERE id = $1`,
        [vendorId],
      );
      if (vendorResult.rows.length > 0) {
        vendorTier = vendorResult.rows[0].vendor_tier || 'TRANSACTIONAL';
      }
    }

    // Get recent alerts (last 5 active alerts)
    const alertsResult = await this.dbPool.query(
      `SELECT
         id, alert_type, alert_category, message, status, created_at,
         metric_value, threshold_value
       FROM vendor_performance_alerts
       WHERE vendor_id = $1
         AND tenant_id = $2
         AND status IN ('ACTIVE', 'ACKNOWLEDGED')
       ORDER BY created_at DESC
       LIMIT 5`,
      [vendorId, tenantId],
    );

    // Get recent activity (last 10 activities)
    const activityResult = await this.dbPool.query(
      `SELECT id, activity_type, activity_details, created_at
       FROM supplier_activity_log
       WHERE vendor_id = $1
         AND tenant_id = $2
       ORDER BY created_at DESC
       LIMIT 10`,
      [vendorId, tenantId],
    );

    // Get recent purchase orders (last 5)
    const recentPOs = await this.dbPool.query(
      `SELECT
         po.id,
         po.po_number,
         po.po_date,
         po.requested_delivery_date,
         po.status,
         po.total_amount,
         po.currency,
         (SELECT COUNT(*) FROM purchase_order_lines WHERE purchase_order_id = po.id) as line_count,
         EXISTS(SELECT 1 FROM po_acknowledgments WHERE purchase_order_id = po.id) as is_acknowledged,
         EXISTS(SELECT 1 FROM advanced_ship_notices WHERE purchase_order_id = po.id) as has_asn
       FROM purchase_orders po
       WHERE po.vendor_id = $1
         AND po.tenant_id = $2
         AND po.deleted_at IS NULL
       ORDER BY po.po_date DESC
       LIMIT 5`,
      [vendorId, tenantId],
    );

    return {
      openPOCount: parseInt(poMetrics.rows[0].open_po_count),
      openPOTotalValue: parseFloat(poMetrics.rows[0].open_po_total_value),
      pendingASNCount: parseInt(asnMetrics.rows[0].pending_asn_count),
      pendingShipmentCount: parseInt(asnMetrics.rows[0].pending_asn_count), // Same as pending ASN for now
      currentPerformanceRating: performanceRating,
      onTimeDeliveryPercentage: otdPercentage,
      qualityAcceptancePercentage: qualityPercentage,
      vendorTier,
      recentAlerts: alertsResult.rows.map(alert => ({
        id: alert.id,
        alertType: alert.alert_type,
        alertCategory: alert.alert_category,
        message: alert.message,
        status: alert.status,
        createdAt: alert.created_at,
        metricValue: alert.metric_value,
        thresholdValue: alert.threshold_value,
      })),
      recentActivity: activityResult.rows.map(activity => ({
        id: activity.id,
        activityType: activity.activity_type,
        activityDetails: activity.activity_details,
        createdAt: activity.created_at,
      })),
      recentPurchaseOrders: recentPOs.rows.map(po => ({
        id: po.id,
        poNumber: po.po_number,
        poDate: po.po_date,
        requestedDeliveryDate: po.requested_delivery_date,
        status: po.status,
        totalAmount: parseFloat(po.total_amount),
        currency: po.currency,
        lineCount: parseInt(po.line_count),
        isAcknowledged: po.is_acknowledged,
        hasASN: po.has_asn,
      })),
    };
  }

  /**
   * Get supplier purchase orders with filtering and pagination
   */
  async getSupplierPurchaseOrders(
    vendorId: string,
    tenantId: string,
    filters: {
      status?: string[];
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ nodes: any[]; totalCount: number }> {
    const { status, fromDate, toDate, limit = 50, offset = 0 } = filters;

    let whereConditions = ['po.vendor_id = $1', 'po.tenant_id = $2', 'po.deleted_at IS NULL'];
    const params: any[] = [vendorId, tenantId];
    let paramIndex = 3;

    if (status && status.length > 0) {
      whereConditions.push(`po.status = ANY($${paramIndex})`);
      params.push(status);
      paramIndex++;
    }

    if (fromDate) {
      whereConditions.push(`po.po_date >= $${paramIndex}`);
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      whereConditions.push(`po.po_date <= $${paramIndex}`);
      params.push(toDate);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await this.dbPool.query(
      `SELECT COUNT(*) as total FROM purchase_orders po WHERE ${whereClause}`,
      params,
    );

    const totalCount = parseInt(countResult.rows[0].total);

    // Get paginated results
    const result = await this.dbPool.query(
      `SELECT
         po.id,
         po.po_number,
         po.po_date,
         po.requested_delivery_date,
         po.status,
         po.total_amount,
         po.currency,
         (SELECT COUNT(*) FROM purchase_order_lines WHERE purchase_order_id = po.id) as line_count,
         EXISTS(SELECT 1 FROM po_acknowledgments WHERE purchase_order_id = po.id) as is_acknowledged,
         EXISTS(SELECT 1 FROM advanced_ship_notices WHERE purchase_order_id = po.id) as has_asn
       FROM purchase_orders po
       WHERE ${whereClause}
       ORDER BY po.po_date DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      nodes: result.rows.map(po => ({
        id: po.id,
        poNumber: po.po_number,
        poDate: po.po_date,
        requestedDeliveryDate: po.requested_delivery_date,
        status: po.status,
        totalAmount: parseFloat(po.total_amount),
        currency: po.currency,
        lineCount: parseInt(po.line_count),
        isAcknowledged: po.is_acknowledged,
        hasASN: po.has_asn,
      })),
      totalCount,
    };
  }

  /**
   * Get detailed purchase order information
   */
  async getSupplierPurchaseOrder(
    vendorId: string,
    tenantId: string,
    poNumber: string,
  ): Promise<any> {
    // Get PO header
    const poResult = await this.dbPool.query(
      `SELECT
         po.*,
         f.facility_code, f.facility_name,
         f.address1 as ship_address1, f.address2 as ship_address2,
         f.city as ship_city, f.state as ship_state, f.postal_code as ship_postal_code, f.country as ship_country,
         u.username as buyer_name, u.email as buyer_email, u.phone as buyer_phone
       FROM purchase_orders po
       LEFT JOIN facilities f ON po.ship_to_facility_id = f.id
       LEFT JOIN users u ON po.created_by = u.id
       WHERE po.vendor_id = $1
         AND po.tenant_id = $2
         AND po.po_number = $3
         AND po.deleted_at IS NULL`,
      [vendorId, tenantId, poNumber],
    );

    if (poResult.rows.length === 0) {
      throw new NotFoundException(`Purchase order ${poNumber} not found`);
    }

    const po = poResult.rows[0];

    // Get PO lines
    const linesResult = await this.dbPool.query(
      `SELECT
         pol.*,
         m.sku, m.description as material_description
       FROM purchase_order_lines pol
       LEFT JOIN materials m ON pol.material_id = m.id
       WHERE pol.purchase_order_id = $1
       ORDER BY pol.line_number`,
      [po.id],
    );

    // Get acknowledgment
    const ackResult = await this.dbPool.query(
      `SELECT
         pa.*,
         su.first_name, su.last_name, su.email
       FROM po_acknowledgments pa
       LEFT JOIN supplier_users su ON pa.acknowledged_by_supplier_user_id = su.id
       WHERE pa.purchase_order_id = $1`,
      [po.id],
    );

    // Get ASNs
    const asnsResult = await this.dbPool.query(
      `SELECT * FROM advanced_ship_notices
       WHERE purchase_order_id = $1
       ORDER BY created_at DESC`,
      [po.id],
    );

    return {
      id: po.id,
      poNumber: po.po_number,
      poDate: po.po_date,
      requestedDeliveryDate: po.requested_delivery_date,
      promisedDeliveryDate: po.promised_delivery_date,
      status: po.status,
      buyerName: po.buyer_name,
      buyerEmail: po.buyer_email,
      buyerPhone: po.buyer_phone,
      buyerNotes: po.notes,
      shipToFacility: {
        id: po.ship_to_facility_id,
        facilityCode: po.facility_code,
        facilityName: po.facility_name,
        address: {
          address1: po.ship_address1,
          address2: po.ship_address2,
          city: po.ship_city,
          state: po.ship_state,
          postalCode: po.ship_postal_code,
          country: po.ship_country,
        },
      },
      shipToAddress: {
        address1: po.ship_address1,
        address2: po.ship_address2,
        city: po.ship_city,
        state: po.ship_state,
        postalCode: po.ship_postal_code,
        country: po.ship_country,
      },
      shippingMethod: po.shipping_method,
      lines: linesResult.rows.map(line => ({
        id: line.id,
        lineNumber: line.line_number,
        materialId: line.material_id,
        sku: line.sku,
        description: line.material_description || line.description,
        quantity: parseFloat(line.quantity),
        unitPrice: parseFloat(line.unit_price),
        unitOfMeasure: line.unit_of_measure,
        extendedPrice: parseFloat(line.extended_price),
        requestedDate: line.requested_date,
        promisedDate: line.promised_date,
        quantityReceived: parseFloat(line.quantity_received || 0),
        quantityRemaining: parseFloat(line.quantity) - parseFloat(line.quantity_received || 0),
      })),
      subtotal: parseFloat(po.subtotal),
      taxAmount: parseFloat(po.tax_amount || 0),
      shippingAmount: parseFloat(po.shipping_amount || 0),
      totalAmount: parseFloat(po.total_amount),
      currency: po.currency,
      acknowledgment: ackResult.rows.length > 0 ? {
        id: ackResult.rows[0].id,
        acknowledgedAt: ackResult.rows[0].acknowledged_at,
        promisedDeliveryDate: ackResult.rows[0].promised_delivery_date,
        acknowledgmentStatus: ackResult.rows[0].acknowledgment_status,
        acknowledgmentNotes: ackResult.rows[0].acknowledgment_notes,
        proposedChanges: ackResult.rows[0].proposed_changes,
      } : null,
      asns: asnsResult.rows.map(asn => ({
        id: asn.id,
        asnNumber: asn.asn_number,
        status: asn.status,
        expectedDeliveryDate: asn.expected_delivery_date,
        trackingNumber: asn.tracking_number,
      })),
      createdAt: po.created_at,
      updatedAt: po.updated_at,
    };
  }

  /**
   * Acknowledge a purchase order
   */
  async acknowledgePurchaseOrder(
    vendorId: string,
    tenantId: string,
    supplierUserId: string,
    input: {
      poNumber: string;
      promisedDeliveryDate?: Date;
      expectedLeadTimeDays?: number;
      acknowledgmentStatus: string;
      acknowledgmentNotes?: string;
      proposedChanges?: any[];
    },
  ): Promise<any> {
    // Verify PO exists and belongs to this vendor
    const poResult = await this.dbPool.query(
      `SELECT id FROM purchase_orders
       WHERE po_number = $1 AND vendor_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [input.poNumber, vendorId, tenantId],
    );

    if (poResult.rows.length === 0) {
      throw new NotFoundException(`Purchase order ${input.poNumber} not found`);
    }

    const poId = poResult.rows[0].id;

    // Check if already acknowledged
    const existingAck = await this.dbPool.query(
      `SELECT id FROM po_acknowledgments WHERE purchase_order_id = $1`,
      [poId],
    );

    if (existingAck.rows.length > 0) {
      throw new BadRequestException('Purchase order already acknowledged');
    }

    // Insert acknowledgment
    const ackResult = await this.dbPool.query(
      `INSERT INTO po_acknowledgments (
        tenant_id, purchase_order_id, vendor_id, acknowledged_by_supplier_user_id,
        promised_delivery_date, expected_lead_time_days, acknowledgment_status,
        acknowledgment_notes, proposed_changes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        tenantId,
        poId,
        vendorId,
        supplierUserId,
        input.promisedDeliveryDate,
        input.expectedLeadTimeDays,
        input.acknowledgmentStatus,
        input.acknowledgmentNotes,
        input.proposedChanges ? JSON.stringify(input.proposedChanges) : null,
      ],
    );

    // Update PO status to ACKNOWLEDGED
    await this.dbPool.query(
      `UPDATE purchase_orders
       SET status = 'ACKNOWLEDGED',
           promised_delivery_date = COALESCE($1, promised_delivery_date),
           updated_at = NOW()
       WHERE id = $2`,
      [input.promisedDeliveryDate, poId],
    );

    return {
      id: ackResult.rows[0].id,
      purchaseOrderId: poId,
      poNumber: input.poNumber,
      acknowledgedAt: ackResult.rows[0].acknowledged_at,
      promisedDeliveryDate: ackResult.rows[0].promised_delivery_date,
      expectedLeadTimeDays: ackResult.rows[0].expected_lead_time_days,
      acknowledgmentStatus: ackResult.rows[0].acknowledgment_status,
      acknowledgmentNotes: ackResult.rows[0].acknowledgment_notes,
      proposedChanges: ackResult.rows[0].proposed_changes,
    };
  }

  /**
   * Create Advanced Ship Notice (ASN)
   */
  async createASN(
    vendorId: string,
    tenantId: string,
    supplierUserId: string,
    input: {
      poNumber: string;
      carrierCode: string;
      carrierService?: string;
      trackingNumber?: string;
      proNumber?: string;
      expectedDeliveryDate: Date;
      actualShipDate: Date;
      packageCount: number;
      totalWeight?: number;
      weightUnit?: string;
      totalVolume?: number;
      volumeUnit?: string;
      lines: any[];
      packingSlipUrl?: string;
      billOfLadingUrl?: string;
      commercialInvoiceUrl?: string;
    },
  ): Promise<any> {
    // Verify PO exists and belongs to this vendor
    const poResult = await this.dbPool.query(
      `SELECT id FROM purchase_orders
       WHERE po_number = $1 AND vendor_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [input.poNumber, vendorId, tenantId],
    );

    if (poResult.rows.length === 0) {
      throw new NotFoundException(`Purchase order ${input.poNumber} not found`);
    }

    const poId = poResult.rows[0].id;

    // Insert ASN (asn_number will be auto-generated by trigger)
    const asnResult = await this.dbPool.query(
      `INSERT INTO advanced_ship_notices (
        tenant_id, vendor_id, purchase_order_id, po_number,
        carrier_code, carrier_service, tracking_number, pro_number,
        expected_delivery_date, actual_ship_date,
        package_count, total_weight, weight_unit, total_volume, volume_unit,
        packing_slip_url, bill_of_lading_url, commercial_invoice_url,
        status, created_by_supplier_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        tenantId,
        vendorId,
        poId,
        input.poNumber,
        input.carrierCode,
        input.carrierService,
        input.trackingNumber,
        input.proNumber,
        input.expectedDeliveryDate,
        input.actualShipDate,
        input.packageCount,
        input.totalWeight,
        input.weightUnit || 'LBS',
        input.totalVolume,
        input.volumeUnit,
        input.packingSlipUrl,
        input.billOfLadingUrl,
        input.commercialInvoiceUrl,
        'CREATED',
        supplierUserId,
      ],
    );

    const asn = asnResult.rows[0];

    // Insert ASN lines
    for (const line of input.lines) {
      await this.dbPool.query(
        `INSERT INTO asn_lines (
          tenant_id, asn_id, po_line_id,
          quantity_shipped, lot_number, serial_numbers, expiration_date,
          package_number, weight, weight_unit
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          tenantId,
          asn.id,
          line.poLineId,
          line.quantityShipped,
          line.lotNumber,
          line.serialNumbers ? JSON.stringify(line.serialNumbers) : null,
          line.expirationDate,
          line.packageNumber,
          line.weight,
          line.weightUnit,
        ],
      );
    }

    return {
      id: asn.id,
      asnNumber: asn.asn_number,
      purchaseOrderId: poId,
      poNumber: input.poNumber,
      carrierCode: asn.carrier_code,
      carrierService: asn.carrier_service,
      trackingNumber: asn.tracking_number,
      proNumber: asn.pro_number,
      expectedDeliveryDate: asn.expected_delivery_date,
      actualShipDate: asn.actual_ship_date,
      packageCount: asn.package_count,
      totalWeight: asn.total_weight,
      weightUnit: asn.weight_unit,
      totalVolume: asn.total_volume,
      volumeUnit: asn.volume_unit,
      status: asn.status,
      createdAt: asn.created_at,
    };
  }
}
