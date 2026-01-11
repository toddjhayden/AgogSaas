/**
 * Three-Way Match Service
 *
 * REQ: REQ-1767541724201-qwcfk - Build Procurement 3-Way Match Exception Handling
 *
 * Implements the complete 3-way match validation process for procurement:
 * - Purchase Order (PO) ↔ Goods Receipt (GRN) ↔ Vendor Bill (Invoice)
 * - Automatic variance detection (quantity and price)
 * - Tolerance-based auto-approval
 * - Exception handling and escalation
 * - Audit trail for all match decisions
 *
 * Matching Algorithm:
 * 1. Retrieve PO, GRN(s), and vendor bill with all line items
 * 2. Match line items by material_id and po_line_id
 * 3. Calculate quantity variances (billed vs received vs ordered)
 * 4. Calculate price variances (billed vs PO price)
 * 5. Apply tolerance thresholds from configuration
 * 6. Classify variances by severity (LOW, MEDIUM, HIGH, CRITICAL)
 * 7. Auto-approve if all variances within tolerance
 * 8. Route for manual approval if exceptions exist
 * 9. Create detailed variance records for review
 *
 * Dependencies per Rule #1:
 * - Database (PostgreSQL)
 * - NATS (for event publishing)
 * If dependencies fail, service MUST EXIT (no graceful degradation)
 */

import { Injectable, Logger, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

interface RequestContext {
  tenantId: string;
  userId: string;
  username?: string;
}

interface ThreeWayMatchInput {
  purchaseOrderId: string;
  goodsReceiptId?: string;      // Optional - may have multiple GRNs
  vendorBillId: string;
}

interface ThreeWayMatchResult {
  matchResultId: string;
  matchNumber: string;
  matchResult: string;          // MATCHED, QUANTITY_VARIANCE, PRICE_VARIANCE, etc.
  confidenceScore: number;
  totalQuantityVariance: number;
  totalPriceVariance: number;
  totalAmountVariance: number;
  lineItemsMatched: number;
  lineItemsWithExceptions: number;
  totalLineItems: number;
  status: string;               // PENDING_REVIEW, AUTO_APPROVED, etc.
  variances: LineVariance[];
}

interface LineVariance {
  lineNumber: number;
  materialId: string;
  materialCode: string;
  description: string;
  poQuantityOrdered: number;
  grnQuantityReceived: number | null;
  grnQuantityAccepted: number | null;
  billQuantityBilled: number;
  quantityVariance: number;
  quantityVariancePercentage: number;
  quantityWithinTolerance: boolean;
  poUnitPrice: number;
  billUnitPrice: number;
  priceVariance: number;
  priceVariancePercentage: number;
  priceWithinTolerance: boolean;
  amountVariance: number;
  varianceType: string;
  severity: string;
}

interface ToleranceConfig {
  id: string;
  quantityTolerancePercentage: number;
  quantityToleranceAmount: number | null;
  priceTolerancePercentage: number;
  priceToleranceAmount: number | null;
  amountTolerancePercentage: number | null;
  amountToleranceAmount: number | null;
  autoApproveUnderAmount: number | null;
  escalationThresholdPercentage: number;
  escalationThresholdAmount: number;
}

@Injectable()
export class ThreeWayMatchService {
  private readonly logger = new Logger(ThreeWayMatchService.name);

  constructor(private readonly pool: Pool) {
    // Verify dependencies per Rule #1
    if (!this.pool) {
      this.logger.error('FATAL: Database pool not available');
      process.exit(1);
    }
  }

  /**
   * Perform 3-way match validation
   *
   * Algorithm:
   * 1. Validate all documents exist
   * 2. Load tolerance configuration
   * 3. Match line items by material/PO line
   * 4. Calculate variances (quantity, price, amount)
   * 5. Classify severity based on tolerances
   * 6. Auto-approve or route for review
   * 7. Create match result and variance records
   * 8. Update vendor bill status
   */
  async performThreeWayMatch(
    input: ThreeWayMatchInput,
    context: RequestContext,
  ): Promise<ThreeWayMatchResult> {
    this.validateContext(context);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_tenant_id = $1', [context.tenantId]);

      // 1. Validate documents exist and belong to tenant
      const { po, grn, bill } = await this.validateDocuments(client, input, context.tenantId);

      // 2. Load tolerance configuration
      const toleranceConfig = await this.getToleranceConfig(
        client,
        context.tenantId,
        po.vendor_id,
        po.facility_id,
      );

      // 3. Load all line items
      const poLines = await this.getPOLines(client, input.purchaseOrderId);
      const grnLines = input.goodsReceiptId
        ? await this.getGRNLines(client, input.goodsReceiptId)
        : [];
      const billLines = await this.getBillLines(client, input.vendorBillId);

      if (billLines.length === 0) {
        throw new BadRequestException('Vendor bill has no line items');
      }

      // 4. Match and calculate variances
      const variances: LineVariance[] = [];
      let lineItemsMatched = 0;
      let lineItemsWithExceptions = 0;

      for (const billLine of billLines) {
        const poLine = poLines.find((pl) => pl.id === billLine.po_line_id);
        if (!poLine) {
          throw new BadRequestException(
            `Bill line ${billLine.line_number} references PO line ${billLine.po_line_id} not found in PO`,
          );
        }

        const grnLine = grnLines.find((gl) => gl.po_line_id === billLine.po_line_id);

        const variance = this.calculateLineVariance(
          billLine,
          poLine,
          grnLine,
          toleranceConfig,
        );

        variances.push(variance);

        if (variance.varianceType === 'NONE') {
          lineItemsMatched++;
        } else {
          lineItemsWithExceptions++;
        }
      }

      // 5. Calculate overall match result
      const matchResult = this.determineOverallMatchResult(variances);
      const confidenceScore = this.calculateConfidenceScore(variances);

      // 6. Aggregate variance totals
      const totalQuantityVariance = variances.reduce(
        (sum, v) => sum + Math.abs(v.quantityVariance),
        0,
      );
      const totalPriceVariance = variances.reduce(
        (sum, v) => sum + Math.abs(v.priceVariance),
        0,
      );
      const totalAmountVariance = variances.reduce(
        (sum, v) => sum + v.amountVariance,
        0,
      );

      // 7. Determine status (auto-approve or require review)
      const status = this.determineMatchStatus(
        variances,
        totalAmountVariance,
        toleranceConfig,
      );

      // 8. Create match result record
      const matchResultId = await this.createMatchResult(
        client,
        {
          tenantId: context.tenantId,
          purchaseOrderId: input.purchaseOrderId,
          goodsReceiptId: input.goodsReceiptId,
          vendorBillId: input.vendorBillId,
          matchResult,
          confidenceScore,
          totalQuantityVariance,
          totalPriceVariance,
          totalAmountVariance,
          lineItemsMatched,
          lineItemsWithExceptions,
          totalLineItems: billLines.length,
          status,
          matchedByUserId: context.userId,
          quantityToleranceConfigId: toleranceConfig.id,
          priceToleranceConfigId: toleranceConfig.id,
        },
      );

      // 9. Create variance records
      await this.createVarianceRecords(client, matchResultId, context.tenantId, variances);

      // 10. Update vendor bill with match result
      await this.updateVendorBillMatchStatus(
        client,
        input.vendorBillId,
        matchResultId,
        matchResult,
        status,
      );

      await client.query('COMMIT');

      // Fetch generated match number
      const matchNumberResult = await client.query(
        'SELECT match_number FROM three_way_match_results WHERE id = $1',
        [matchResultId],
      );
      const matchNumber = matchNumberResult.rows[0].match_number;

      this.logger.log(
        `3-way match completed: ${matchNumber}, Status: ${status}, Result: ${matchResult}, Confidence: ${confidenceScore}%`,
      );

      return {
        matchResultId,
        matchNumber,
        matchResult,
        confidenceScore,
        totalQuantityVariance,
        totalPriceVariance,
        totalAmountVariance,
        lineItemsMatched,
        lineItemsWithExceptions,
        totalLineItems: billLines.length,
        status,
        variances,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`3-way match failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate line-level variance with tolerance checking
   */
  private calculateLineVariance(
    billLine: any,
    poLine: any,
    grnLine: any | undefined,
    tolerance: ToleranceConfig,
  ): LineVariance {
    // Use GRN quantity if available, otherwise fall back to PO quantity
    const quantityReceived = grnLine ? grnLine.quantity_received : null;
    const quantityAccepted = grnLine ? grnLine.quantity_accepted : null;
    const referenceQuantity = quantityAccepted ?? quantityReceived ?? poLine.quantity_ordered;

    // Quantity variance: billed - received (or ordered if no GRN)
    const quantityVariance = billLine.quantity_billed - referenceQuantity;
    const quantityVariancePercentage =
      referenceQuantity > 0 ? (quantityVariance / referenceQuantity) * 100 : 0;

    // Check quantity tolerance
    const quantityWithinTolerance = this.isWithinQuantityTolerance(
      Math.abs(quantityVariance),
      Math.abs(quantityVariancePercentage),
      billLine.line_amount,
      tolerance,
    );

    // Price variance: billed price - PO price
    const priceVariance = billLine.unit_price - poLine.unit_price;
    const priceVariancePercentage =
      poLine.unit_price > 0 ? (priceVariance / poLine.unit_price) * 100 : 0;

    // Check price tolerance
    const priceWithinTolerance = this.isWithinPriceTolerance(
      Math.abs(priceVariance),
      Math.abs(priceVariancePercentage),
      billLine.line_amount,
      tolerance,
    );

    // Amount variance
    const poLineAmount = poLine.quantity_ordered * poLine.unit_price;
    const amountVariance = billLine.line_amount - poLineAmount;

    // Determine variance type
    const varianceType = this.classifyVarianceType(
      quantityVariance,
      priceVariance,
      quantityWithinTolerance,
      priceWithinTolerance,
    );

    // Determine severity
    const severity = this.determineSeverity(
      quantityVariancePercentage,
      priceVariancePercentage,
      amountVariance,
      tolerance,
    );

    return {
      lineNumber: billLine.line_number,
      materialId: billLine.material_id,
      materialCode: billLine.material_code,
      description: billLine.description,
      poQuantityOrdered: poLine.quantity_ordered,
      grnQuantityReceived: quantityReceived,
      grnQuantityAccepted: quantityAccepted,
      billQuantityBilled: billLine.quantity_billed,
      quantityVariance,
      quantityVariancePercentage,
      quantityWithinTolerance,
      poUnitPrice: poLine.unit_price,
      billUnitPrice: billLine.unit_price,
      priceVariance,
      priceVariancePercentage,
      priceWithinTolerance,
      amountVariance,
      varianceType,
      severity,
    };
  }

  /**
   * Check if quantity variance is within tolerance
   */
  private isWithinQuantityTolerance(
    absVariance: number,
    absPercentage: number,
    lineAmount: number,
    tolerance: ToleranceConfig,
  ): boolean {
    // Check percentage tolerance
    if (absPercentage <= tolerance.quantityTolerancePercentage) {
      return true;
    }

    // Check absolute amount tolerance (if configured)
    if (tolerance.quantityToleranceAmount !== null) {
      if (absVariance <= tolerance.quantityToleranceAmount) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if price variance is within tolerance
   */
  private isWithinPriceTolerance(
    absVariance: number,
    absPercentage: number,
    lineAmount: number,
    tolerance: ToleranceConfig,
  ): boolean {
    // Check percentage tolerance
    if (absPercentage <= tolerance.priceTolerancePercentage) {
      return true;
    }

    // Check absolute amount tolerance (if configured)
    if (tolerance.priceToleranceAmount !== null) {
      if (absVariance <= tolerance.priceToleranceAmount) {
        return true;
      }
    }

    return false;
  }

  /**
   * Classify variance type
   */
  private classifyVarianceType(
    quantityVariance: number,
    priceVariance: number,
    quantityWithinTolerance: boolean,
    priceWithinTolerance: boolean,
  ): string {
    const hasQuantityVariance = !quantityWithinTolerance;
    const hasPriceVariance = !priceWithinTolerance;

    if (!hasQuantityVariance && !hasPriceVariance) {
      return 'NONE';
    }

    if (hasQuantityVariance && hasPriceVariance) {
      return 'QUANTITY_AND_PRICE';
    }

    if (hasQuantityVariance) {
      return quantityVariance > 0 ? 'QUANTITY_OVER' : 'QUANTITY_UNDER';
    }

    if (hasPriceVariance) {
      return priceVariance > 0 ? 'PRICE_INCREASE' : 'PRICE_DECREASE';
    }

    return 'NONE';
  }

  /**
   * Determine variance severity
   */
  private determineSeverity(
    quantityVariancePercentage: number,
    priceVariancePercentage: number,
    amountVariance: number,
    tolerance: ToleranceConfig,
  ): string {
    const absQuantityPct = Math.abs(quantityVariancePercentage);
    const absPricePct = Math.abs(priceVariancePercentage);
    const absAmountVariance = Math.abs(amountVariance);

    // CRITICAL: Exceeds escalation thresholds
    if (
      absQuantityPct > tolerance.escalationThresholdPercentage * 2 ||
      absPricePct > tolerance.escalationThresholdPercentage * 2 ||
      absAmountVariance > tolerance.escalationThresholdAmount * 2
    ) {
      return 'CRITICAL';
    }

    // HIGH: Exceeds escalation thresholds
    if (
      absQuantityPct > tolerance.escalationThresholdPercentage ||
      absPricePct > tolerance.escalationThresholdPercentage ||
      absAmountVariance > tolerance.escalationThresholdAmount
    ) {
      return 'HIGH';
    }

    // MEDIUM: Exceeds tolerance but below escalation
    if (
      absQuantityPct > tolerance.quantityTolerancePercentage ||
      absPricePct > tolerance.priceTolerancePercentage
    ) {
      return 'MEDIUM';
    }

    // LOW: Within tolerance
    return 'LOW';
  }

  /**
   * Determine overall match result
   */
  private determineOverallMatchResult(variances: LineVariance[]): string {
    const hasQuantityVariance = variances.some(
      (v) => ['QUANTITY_OVER', 'QUANTITY_UNDER', 'QUANTITY_AND_PRICE'].includes(v.varianceType),
    );
    const hasPriceVariance = variances.some(
      (v) => ['PRICE_INCREASE', 'PRICE_DECREASE', 'QUANTITY_AND_PRICE'].includes(v.varianceType),
    );

    if (!hasQuantityVariance && !hasPriceVariance) {
      return 'MATCHED';
    }

    if (hasQuantityVariance && hasPriceVariance) {
      return 'BOTH_VARIANCE';
    }

    if (hasQuantityVariance) {
      return 'QUANTITY_VARIANCE';
    }

    return 'PRICE_VARIANCE';
  }

  /**
   * Calculate confidence score (0-100)
   * 100 = perfect match, decreases with variance severity
   */
  private calculateConfidenceScore(variances: LineVariance[]): number {
    if (variances.length === 0) return 100;

    let totalScore = 0;
    for (const variance of variances) {
      let lineScore = 100;

      // Deduct points based on severity
      switch (variance.severity) {
        case 'LOW':
          lineScore -= 5;
          break;
        case 'MEDIUM':
          lineScore -= 20;
          break;
        case 'HIGH':
          lineScore -= 40;
          break;
        case 'CRITICAL':
          lineScore -= 60;
          break;
      }

      totalScore += Math.max(0, lineScore);
    }

    return Math.round(totalScore / variances.length);
  }

  /**
   * Determine match status (auto-approve or require review)
   */
  private determineMatchStatus(
    variances: LineVariance[],
    totalAmountVariance: number,
    tolerance: ToleranceConfig,
  ): string {
    // Check for CRITICAL or HIGH severity variances - require escalation
    const hasCritical = variances.some((v) => v.severity === 'CRITICAL');
    const hasHigh = variances.some((v) => v.severity === 'HIGH');

    if (hasCritical) {
      return 'ESCALATED';
    }

    if (hasHigh) {
      return 'PENDING_REVIEW';
    }

    // Check for MEDIUM severity - require review
    const hasMedium = variances.some((v) => v.severity === 'MEDIUM');
    if (hasMedium) {
      return 'PENDING_REVIEW';
    }

    // All variances are LOW or NONE - check auto-approval threshold
    if (
      tolerance.autoApproveUnderAmount !== null &&
      Math.abs(totalAmountVariance) < tolerance.autoApproveUnderAmount
    ) {
      return 'AUTO_APPROVED';
    }

    // Default to requiring review
    return 'PENDING_REVIEW';
  }

  /**
   * Validate request context
   */
  private validateContext(context: RequestContext): void {
    if (!context.tenantId || !context.userId) {
      throw new UnauthorizedException('Valid tenant and user context required');
    }
  }

  /**
   * Validate all documents exist and belong to tenant
   */
  private async validateDocuments(client: any, input: ThreeWayMatchInput, tenantId: string) {
    // Validate PO
    const poResult = await client.query(
      'SELECT id, tenant_id, vendor_id, facility_id, status FROM purchase_orders WHERE id = $1 AND tenant_id = $2',
      [input.purchaseOrderId, tenantId],
    );

    if (poResult.rows.length === 0) {
      throw new NotFoundException('Purchase order not found');
    }

    const po = poResult.rows[0];

    // Validate GRN (if provided)
    let grn = null;
    if (input.goodsReceiptId) {
      const grnResult = await client.query(
        'SELECT id, tenant_id, purchase_order_id, status FROM goods_receipts WHERE id = $1 AND tenant_id = $2',
        [input.goodsReceiptId, tenantId],
      );

      if (grnResult.rows.length === 0) {
        throw new NotFoundException('Goods receipt not found');
      }

      grn = grnResult.rows[0];

      // Verify GRN belongs to same PO
      if (grn.purchase_order_id !== input.purchaseOrderId) {
        throw new BadRequestException('Goods receipt does not belong to specified purchase order');
      }
    }

    // Validate vendor bill
    const billResult = await client.query(
      'SELECT id, tenant_id, purchase_order_id, vendor_id, status FROM vendor_bills WHERE id = $1 AND tenant_id = $2',
      [input.vendorBillId, tenantId],
    );

    if (billResult.rows.length === 0) {
      throw new NotFoundException('Vendor bill not found');
    }

    const bill = billResult.rows[0];

    // Verify bill references same PO
    if (bill.purchase_order_id && bill.purchase_order_id !== input.purchaseOrderId) {
      throw new BadRequestException('Vendor bill does not reference specified purchase order');
    }

    // Verify bill is from same vendor as PO
    if (bill.vendor_id !== po.vendor_id) {
      throw new BadRequestException('Vendor bill is not from same vendor as purchase order');
    }

    return { po, grn, bill };
  }

  /**
   * Get tolerance configuration
   * Searches in priority order: vendor-specific > material category > vendor tier > default
   */
  private async getToleranceConfig(
    client: any,
    tenantId: string,
    vendorId: string,
    facilityId: string,
  ): Promise<ToleranceConfig> {
    const result = await client.query(
      `
      SELECT
        id,
        quantity_tolerance_percentage,
        quantity_tolerance_amount,
        price_tolerance_percentage,
        price_tolerance_amount,
        amount_tolerance_percentage,
        amount_tolerance_amount,
        auto_approve_under_amount,
        escalation_threshold_percentage,
        escalation_threshold_amount
      FROM three_way_match_tolerance_config
      WHERE tenant_id = $1
        AND is_active = TRUE
        AND (effective_from IS NULL OR effective_from <= CURRENT_DATE)
        AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
        AND (
          $2 = ANY(applies_to_vendor_ids)
          OR applies_to_facility_ids IS NULL
          OR $3 = ANY(applies_to_facility_ids)
        )
      ORDER BY priority DESC, created_at DESC
      LIMIT 1
      `,
      [tenantId, vendorId, facilityId],
    );

    if (result.rows.length > 0) {
      const config = result.rows[0];
      return {
        id: config.id,
        quantityTolerancePercentage: parseFloat(config.quantity_tolerance_percentage),
        quantityToleranceAmount: config.quantity_tolerance_amount
          ? parseFloat(config.quantity_tolerance_amount)
          : null,
        priceTolerancePercentage: parseFloat(config.price_tolerance_percentage),
        priceToleranceAmount: config.price_tolerance_amount
          ? parseFloat(config.price_tolerance_amount)
          : null,
        amountTolerancePercentage: config.amount_tolerance_percentage
          ? parseFloat(config.amount_tolerance_percentage)
          : null,
        amountToleranceAmount: config.amount_tolerance_amount
          ? parseFloat(config.amount_tolerance_amount)
          : null,
        autoApproveUnderAmount: config.auto_approve_under_amount
          ? parseFloat(config.auto_approve_under_amount)
          : null,
        escalationThresholdPercentage: parseFloat(config.escalation_threshold_percentage),
        escalationThresholdAmount: parseFloat(config.escalation_threshold_amount),
      };
    }

    // Return default tolerances if no config found
    this.logger.warn(`No tolerance config found for tenant ${tenantId}, using defaults`);
    return {
      id: null,
      quantityTolerancePercentage: 5.0,
      quantityToleranceAmount: null,
      priceTolerancePercentage: 3.0,
      priceToleranceAmount: null,
      amountTolerancePercentage: null,
      amountToleranceAmount: 100.0,
      autoApproveUnderAmount: 500.0,
      escalationThresholdPercentage: 10.0,
      escalationThresholdAmount: 500.0,
    };
  }

  /**
   * Get PO lines
   */
  private async getPOLines(client: any, purchaseOrderId: string): Promise<any[]> {
    const result = await client.query(
      `
      SELECT
        id,
        line_number,
        material_id,
        material_code,
        description,
        quantity_ordered,
        unit_price,
        line_amount,
        unit_of_measure
      FROM purchase_order_lines
      WHERE purchase_order_id = $1
      ORDER BY line_number
      `,
      [purchaseOrderId],
    );

    return result.rows;
  }

  /**
   * Get GRN lines
   */
  private async getGRNLines(client: any, goodsReceiptId: string): Promise<any[]> {
    const result = await client.query(
      `
      SELECT
        id,
        line_number,
        po_line_id,
        material_id,
        quantity_ordered,
        quantity_received,
        quantity_accepted,
        quantity_rejected,
        disposition,
        has_variance
      FROM goods_receipt_lines
      WHERE grn_id = $1
      ORDER BY line_number
      `,
      [goodsReceiptId],
    );

    return result.rows;
  }

  /**
   * Get vendor bill lines
   */
  private async getBillLines(client: any, vendorBillId: string): Promise<any[]> {
    const result = await client.query(
      `
      SELECT
        id,
        line_number,
        po_line_id,
        material_id,
        material_code,
        description,
        quantity_billed,
        unit_price,
        line_amount,
        unit_of_measure
      FROM vendor_bill_lines
      WHERE vendor_bill_id = $1
      ORDER BY line_number
      `,
      [vendorBillId],
    );

    return result.rows;
  }

  /**
   * Create match result record
   */
  private async createMatchResult(client: any, data: any): Promise<string> {
    const result = await client.query(
      `
      INSERT INTO three_way_match_results (
        tenant_id,
        purchase_order_id,
        goods_receipt_id,
        vendor_bill_id,
        match_result,
        confidence_score,
        total_quantity_variance,
        total_price_variance,
        total_amount_variance,
        line_items_matched,
        line_items_with_exceptions,
        total_line_items,
        status,
        matched_by_user_id,
        quantity_tolerance_config_id,
        price_tolerance_config_id,
        created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id
      `,
      [
        data.tenantId,
        data.purchaseOrderId,
        data.goodsReceiptId || null,
        data.vendorBillId,
        data.matchResult,
        data.confidenceScore,
        data.totalQuantityVariance,
        data.totalPriceVariance,
        data.totalAmountVariance,
        data.lineItemsMatched,
        data.lineItemsWithExceptions,
        data.totalLineItems,
        data.status,
        data.matchedByUserId,
        data.quantityToleranceConfigId || null,
        data.priceToleranceConfigId || null,
        data.matchedByUserId,
      ],
    );

    return result.rows[0].id;
  }

  /**
   * Create variance records for all lines
   */
  private async createVarianceRecords(
    client: any,
    matchResultId: string,
    tenantId: string,
    variances: LineVariance[],
  ): Promise<void> {
    for (const variance of variances) {
      // Find corresponding document line IDs from the original data
      const poLineResult = await client.query(
        'SELECT id FROM purchase_order_lines WHERE material_id = $1 AND line_number = $2',
        [variance.materialId, variance.lineNumber],
      );

      const billLineResult = await client.query(
        'SELECT id FROM vendor_bill_lines WHERE material_id = $1 AND line_number = $2',
        [variance.materialId, variance.lineNumber],
      );

      const grnLineResult =
        variance.grnQuantityReceived !== null
          ? await client.query(
              'SELECT id FROM goods_receipt_lines WHERE material_id = $1 AND line_number = $2',
              [variance.materialId, variance.lineNumber],
            )
          : { rows: [] };

      await client.query(
        `
        INSERT INTO three_way_match_line_variances (
          tenant_id,
          match_result_id,
          line_number,
          po_line_id,
          grn_line_id,
          bill_line_id,
          material_id,
          material_code,
          description,
          po_quantity_ordered,
          grn_quantity_received,
          grn_quantity_accepted,
          bill_quantity_billed,
          unit_of_measure,
          quantity_variance,
          quantity_variance_percentage,
          quantity_within_tolerance,
          po_unit_price,
          bill_unit_price,
          price_variance,
          price_variance_percentage,
          price_within_tolerance,
          po_line_amount,
          bill_line_amount,
          amount_variance,
          variance_type,
          severity,
          resolution_status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        )
        `,
        [
          tenantId,
          matchResultId,
          variance.lineNumber,
          poLineResult.rows[0]?.id || null,
          grnLineResult.rows[0]?.id || null,
          billLineResult.rows[0]?.id || null,
          variance.materialId,
          variance.materialCode,
          variance.description,
          variance.poQuantityOrdered,
          variance.grnQuantityReceived,
          variance.grnQuantityAccepted,
          variance.billQuantityBilled,
          'EA', // Default unit of measure
          variance.quantityVariance,
          variance.quantityVariancePercentage,
          variance.quantityWithinTolerance,
          variance.poUnitPrice,
          variance.billUnitPrice,
          variance.priceVariance,
          variance.priceVariancePercentage,
          variance.priceWithinTolerance,
          variance.poQuantityOrdered * variance.poUnitPrice,
          variance.billQuantityBilled * variance.billUnitPrice,
          variance.amountVariance,
          variance.varianceType,
          variance.severity,
          'PENDING',
        ],
      );
    }
  }

  /**
   * Update vendor bill with match result
   */
  private async updateVendorBillMatchStatus(
    client: any,
    vendorBillId: string,
    matchResultId: string,
    matchResult: string,
    status: string,
  ): Promise<void> {
    // Determine match_status for vendor bill
    let matchStatus: string;
    if (matchResult === 'MATCHED') {
      matchStatus = 'MATCHED';
    } else if (
      matchResult === 'QUANTITY_VARIANCE' ||
      matchResult === 'PRICE_VARIANCE' ||
      matchResult === 'BOTH_VARIANCE'
    ) {
      matchStatus = 'PARTIAL_MATCH';
    } else {
      matchStatus = 'EXCEPTION';
    }

    // Determine bill status
    let billStatus: string;
    if (status === 'AUTO_APPROVED') {
      billStatus = 'APPROVED';
    } else if (status === 'ESCALATED') {
      billStatus = 'ON_HOLD';
    } else {
      billStatus = 'EXCEPTION';
    }

    await client.query(
      `
      UPDATE vendor_bills
      SET
        match_result_id = $1,
        match_status = $2,
        status = $3,
        updated_at = NOW()
      WHERE id = $4
      `,
      [matchResultId, matchStatus, billStatus, vendorBillId],
    );
  }

  /**
   * Approve a match result (manual approval after review)
   */
  async approveMatchResult(
    matchResultId: string,
    approvalNotes: string,
    context: RequestContext,
  ): Promise<void> {
    this.validateContext(context);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_tenant_id = $1', [context.tenantId]);

      // Update match result
      await client.query(
        `
        UPDATE three_way_match_results
        SET
          status = 'APPROVED',
          approved_by_user_id = $1,
          approved_at = NOW(),
          approval_notes = $2,
          updated_at = NOW(),
          updated_by_user_id = $1
        WHERE id = $3 AND tenant_id = $4
        `,
        [context.userId, approvalNotes, matchResultId, context.tenantId],
      );

      // Update vendor bill status to approved
      await client.query(
        `
        UPDATE vendor_bills
        SET
          status = 'APPROVED',
          updated_at = NOW(),
          updated_by_user_id = $1
        WHERE match_result_id = $2 AND tenant_id = $3
        `,
        [context.userId, matchResultId, context.tenantId],
      );

      await client.query('COMMIT');

      this.logger.log(`Match result ${matchResultId} approved by ${context.username}`);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to approve match result: ${error.message}`, error.stack);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject a match result (requires correction)
   */
  async rejectMatchResult(
    matchResultId: string,
    reviewNotes: string,
    context: RequestContext,
  ): Promise<void> {
    this.validateContext(context);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_tenant_id = $1', [context.tenantId]);

      // Update match result
      await client.query(
        `
        UPDATE three_way_match_results
        SET
          status = 'REJECTED',
          reviewed_by_user_id = $1,
          reviewed_at = NOW(),
          review_notes = $2,
          updated_at = NOW(),
          updated_by_user_id = $1
        WHERE id = $3 AND tenant_id = $4
        `,
        [context.userId, reviewNotes, matchResultId, context.tenantId],
      );

      // Update vendor bill status to on_hold
      await client.query(
        `
        UPDATE vendor_bills
        SET
          status = 'ON_HOLD',
          updated_at = NOW(),
          updated_by_user_id = $1
        WHERE match_result_id = $2 AND tenant_id = $3
        `,
        [context.userId, matchResultId, context.tenantId],
      );

      await client.query('COMMIT');

      this.logger.log(`Match result ${matchResultId} rejected by ${context.username}`);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to reject match result: ${error.message}`, error.stack);
      throw error;
    } finally {
      client.release();
    }
  }
}
