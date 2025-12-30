/**
 * Quote Management Service
 * REQ-STRATEGIC-AUTO-1735125600000: Sales Quote Automation
 *
 * Orchestrates quote and quote line CRUD operations with automated pricing,
 * costing, and margin calculations. Provides the main business logic layer
 * for sales quote automation.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  CreateQuoteInput,
  UpdateQuoteInput,
  QuoteResult,
  AddQuoteLineInput,
  UpdateQuoteLineInput,
  QuoteLineResult,
  DeleteQuoteLineInput,
  RecalculateQuoteInput,
  QuoteStatus,
  QuoteValidationResult,
  ValidationError,
  ValidationWarning,
  MarginValidationInput,
  MarginValidationResult,
  ApprovalLevel
} from '../interfaces/quote-management.interface';
import { QuotePricingService } from './quote-pricing.service';

@Injectable()
export class QuoteManagementService {
  // Business rule thresholds (should be configurable)
  private readonly MINIMUM_MARGIN_PERCENTAGE = 15; // Minimum acceptable margin
  private readonly MANAGER_APPROVAL_THRESHOLD = 20; // Margin < 20% requires manager approval
  private readonly VP_APPROVAL_THRESHOLD = 10; // Margin < 10% requires VP approval

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly pricingService: QuotePricingService
  ) {}

  /**
   * Create a new quote with empty lines
   */
  async createQuote(input: CreateQuoteInput): Promise<QuoteResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Generate quote number
      const quoteNumber = await this.generateQuoteNumber(client, input.tenantId, input.quoteDate);

      // Insert quote header
      const quoteQuery = `
        INSERT INTO quotes (
          tenant_id,
          facility_id,
          quote_number,
          quote_date,
          expiration_date,
          customer_id,
          contact_name,
          contact_email,
          sales_rep_user_id,
          quote_currency_code,
          subtotal,
          tax_amount,
          shipping_amount,
          discount_amount,
          total_amount,
          total_cost,
          margin_amount,
          margin_percentage,
          status,
          notes,
          terms_and_conditions,
          created_at,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          0, 0, 0, 0, 0, 0, 0, 0, 'DRAFT',
          $11, $12, CURRENT_TIMESTAMP, $13
        )
        RETURNING *
      `;

      const quoteResult = await client.query(quoteQuery, [
        input.tenantId,
        input.facilityId,
        quoteNumber,
        input.quoteDate,
        input.expirationDate,
        input.customerId,
        input.contactName,
        input.contactEmail,
        input.salesRepUserId,
        input.quoteCurrencyCode,
        input.notes,
        input.termsAndConditions,
        input.createdBy
      ]);

      await client.query('COMMIT');

      return this.mapQuoteRow(quoteResult.rows[0], []);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update quote header fields
   */
  async updateQuote(input: UpdateQuoteInput): Promise<QuoteResult> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    if (input.status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      updateValues.push(input.status);
    }

    if (input.expirationDate !== undefined) {
      updateFields.push(`expiration_date = $${paramCount++}`);
      updateValues.push(input.expirationDate);
    }

    if (input.contactName !== undefined) {
      updateFields.push(`contact_name = $${paramCount++}`);
      updateValues.push(input.contactName);
    }

    if (input.contactEmail !== undefined) {
      updateFields.push(`contact_email = $${paramCount++}`);
      updateValues.push(input.contactEmail);
    }

    if (input.notes !== undefined) {
      updateFields.push(`notes = $${paramCount++}`);
      updateValues.push(input.notes);
    }

    if (input.termsAndConditions !== undefined) {
      updateFields.push(`terms_and_conditions = $${paramCount++}`);
      updateValues.push(input.termsAndConditions);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateFields.push(`updated_by = $${paramCount++}`);
    updateValues.push(input.updatedBy);

    updateValues.push(input.quoteId);

    const query = `
      UPDATE quotes
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.db.query(query, updateValues);

    if (result.rows.length === 0) {
      throw new Error(`Quote ${input.quoteId} not found`);
    }

    return this.getQuote(input.quoteId);
  }

  /**
   * Add a quote line with automated pricing and costing
   */
  async addQuoteLine(input: AddQuoteLineInput): Promise<QuoteLineResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get quote details
      const quoteQuery = `
        SELECT tenant_id, customer_id, quote_date, quote_currency_code
        FROM quotes
        WHERE id = $1
      `;
      const quoteResult = await client.query(quoteQuery, [input.quoteId]);

      if (quoteResult.rows.length === 0) {
        throw new Error(`Quote ${input.quoteId} not found`);
      }

      const quote = quoteResult.rows[0];

      // Get next line number
      const lineNumberQuery = `
        SELECT COALESCE(MAX(line_number), 0) + 1 as next_line_number
        FROM quote_lines
        WHERE quote_id = $1
      `;
      const lineNumberResult = await client.query(lineNumberQuery, [input.quoteId]);
      const lineNumber = lineNumberResult.rows[0].next_line_number;

      // Get product details
      const productQuery = `
        SELECT product_code, product_name
        FROM products
        WHERE id = $1 AND tenant_id = $2 AND is_current_version = true
      `;
      const productResult = await client.query(productQuery, [input.productId, quote.tenant_id]);

      if (productResult.rows.length === 0) {
        throw new Error(`Product ${input.productId} not found`);
      }

      const product = productResult.rows[0];

      // Calculate pricing (unless manual override provided)
      let pricingResult;

      if (input.manualUnitPrice !== undefined) {
        // Use manual price, but still calculate cost
        pricingResult = await this.pricingService.calculateQuoteLinePricing({
          productId: input.productId,
          quantity: input.quantityQuoted,
          customerId: quote.customer_id,
          quoteDate: quote.quote_date,
          tenantId: quote.tenant_id
        });

        // Override with manual price
        pricingResult = this.pricingService.applyManualPriceOverride(
          pricingResult,
          input.manualUnitPrice,
          input.quantityQuoted
        );
      } else {
        pricingResult = await this.pricingService.calculateQuoteLinePricing({
          productId: input.productId,
          quantity: input.quantityQuoted,
          customerId: quote.customer_id,
          quoteDate: quote.quote_date,
          tenantId: quote.tenant_id
        });
      }

      // Insert quote line
      const lineQuery = `
        INSERT INTO quote_lines (
          tenant_id,
          quote_id,
          line_number,
          product_id,
          product_code,
          description,
          quantity_quoted,
          unit_of_measure,
          unit_price,
          line_amount,
          discount_percentage,
          discount_amount,
          unit_cost,
          line_cost,
          line_margin,
          margin_percentage,
          manufacturing_strategy,
          lead_time_days,
          promised_delivery_date,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          CURRENT_TIMESTAMP
        )
        RETURNING *
      `;

      const lineResult = await client.query(lineQuery, [
        quote.tenant_id,
        input.quoteId,
        lineNumber,
        input.productId,
        product.product_code,
        input.description || product.product_name,
        input.quantityQuoted,
        input.unitOfMeasure || 'EA',
        pricingResult.unitPrice,
        pricingResult.lineAmount,
        pricingResult.discountPercentage,
        pricingResult.discountAmount,
        pricingResult.unitCost,
        pricingResult.lineCost,
        pricingResult.lineMargin,
        pricingResult.marginPercentage,
        input.manufacturingStrategy,
        input.leadTimeDays,
        input.promisedDeliveryDate
      ]);

      // Recalculate quote totals
      await this.recalculateQuoteTotalsInternal(client, input.quoteId, quote.tenant_id);

      await client.query('COMMIT');

      return this.mapQuoteLineRow(lineResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update an existing quote line
   */
  async updateQuoteLine(input: UpdateQuoteLineInput): Promise<QuoteLineResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get current quote line
      const currentLineQuery = `
        SELECT ql.*, q.tenant_id, q.customer_id, q.quote_date
        FROM quote_lines ql
        JOIN quotes q ON q.id = ql.quote_id
        WHERE ql.id = $1
      `;
      const currentLineResult = await client.query(currentLineQuery, [input.quoteLineId]);

      if (currentLineResult.rows.length === 0) {
        throw new Error(`Quote line ${input.quoteLineId} not found`);
      }

      const currentLine = currentLineResult.rows[0];

      // Determine if pricing needs to be recalculated
      const quantityChanged = input.quantityQuoted !== undefined && input.quantityQuoted !== currentLine.quantity_quoted;
      const manualPriceProvided = input.manualUnitPrice !== undefined;

      let pricingResult;

      if (quantityChanged || manualPriceProvided) {
        const quantity = input.quantityQuoted !== undefined ? input.quantityQuoted : currentLine.quantity_quoted;

        pricingResult = await this.pricingService.calculateQuoteLinePricing({
          productId: currentLine.product_id,
          quantity,
          customerId: currentLine.customer_id,
          quoteDate: currentLine.quote_date,
          tenantId: currentLine.tenant_id
        });

        if (manualPriceProvided) {
          pricingResult = this.pricingService.applyManualPriceOverride(
            pricingResult,
            input.manualUnitPrice!,
            quantity
          );
        }
      }

      // Build update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramCount = 1;

      if (input.quantityQuoted !== undefined) {
        updateFields.push(`quantity_quoted = $${paramCount++}`);
        updateValues.push(input.quantityQuoted);
      }

      if (pricingResult) {
        updateFields.push(`unit_price = $${paramCount++}`);
        updateValues.push(pricingResult.unitPrice);
        updateFields.push(`line_amount = $${paramCount++}`);
        updateValues.push(pricingResult.lineAmount);
        updateFields.push(`discount_percentage = $${paramCount++}`);
        updateValues.push(pricingResult.discountPercentage);
        updateFields.push(`discount_amount = $${paramCount++}`);
        updateValues.push(pricingResult.discountAmount);
        updateFields.push(`unit_cost = $${paramCount++}`);
        updateValues.push(pricingResult.unitCost);
        updateFields.push(`line_cost = $${paramCount++}`);
        updateValues.push(pricingResult.lineCost);
        updateFields.push(`line_margin = $${paramCount++}`);
        updateValues.push(pricingResult.lineMargin);
        updateFields.push(`margin_percentage = $${paramCount++}`);
        updateValues.push(pricingResult.marginPercentage);
      }

      if (input.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        updateValues.push(input.description);
      }

      if (input.manufacturingStrategy !== undefined) {
        updateFields.push(`manufacturing_strategy = $${paramCount++}`);
        updateValues.push(input.manufacturingStrategy);
      }

      if (input.leadTimeDays !== undefined) {
        updateFields.push(`lead_time_days = $${paramCount++}`);
        updateValues.push(input.leadTimeDays);
      }

      if (input.promisedDeliveryDate !== undefined) {
        updateFields.push(`promised_delivery_date = $${paramCount++}`);
        updateValues.push(input.promisedDeliveryDate);
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(input.quoteLineId);

      const updateQuery = `
        UPDATE quote_lines
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, updateValues);

      // Recalculate quote totals
      await this.recalculateQuoteTotalsInternal(client, currentLine.quote_id, currentLine.tenant_id);

      await client.query('COMMIT');

      return this.mapQuoteLineRow(updateResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a quote line and recalculate totals
   */
  async deleteQuoteLine(input: DeleteQuoteLineInput): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get quote ID and tenant ID before deleting
      const lineQuery = `
        SELECT quote_id, tenant_id FROM quote_lines WHERE id = $1
      `;
      const lineResult = await client.query(lineQuery, [input.quoteLineId]);

      if (lineResult.rows.length === 0) {
        throw new Error(`Quote line ${input.quoteLineId} not found`);
      }

      const { quote_id, tenant_id } = lineResult.rows[0];

      // Delete the line
      await client.query(`DELETE FROM quote_lines WHERE id = $1`, [input.quoteLineId]);

      // Recalculate quote totals
      await this.recalculateQuoteTotalsInternal(client, quote_id, tenant_id);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Recalculate all pricing and costs for a quote
   */
  async recalculateQuote(input: RecalculateQuoteInput): Promise<QuoteResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get quote details
      const quoteQuery = `
        SELECT id, tenant_id, customer_id, quote_date
        FROM quotes
        WHERE id = $1
      `;
      const quoteResult = await client.query(quoteQuery, [input.quoteId]);

      if (quoteResult.rows.length === 0) {
        throw new Error(`Quote ${input.quoteId} not found`);
      }

      const quote = quoteResult.rows[0];

      // Get all quote lines
      const linesQuery = `
        SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY line_number
      `;
      const linesResult = await client.query(linesQuery, [input.quoteId]);

      // Recalculate each line
      for (const line of linesResult.rows) {
        const pricingResult = await this.pricingService.calculateQuoteLinePricing({
          productId: line.product_id,
          quantity: parseFloat(line.quantity_quoted),
          customerId: quote.customer_id,
          quoteDate: quote.quote_date,
          tenantId: quote.tenant_id
        });

        await client.query(
          `UPDATE quote_lines
           SET unit_price = $1, line_amount = $2, discount_percentage = $3,
               discount_amount = $4, unit_cost = $5, line_cost = $6,
               line_margin = $7, margin_percentage = $8, updated_at = CURRENT_TIMESTAMP
           WHERE id = $9`,
          [
            pricingResult.unitPrice,
            pricingResult.lineAmount,
            pricingResult.discountPercentage,
            pricingResult.discountAmount,
            pricingResult.unitCost,
            pricingResult.lineCost,
            pricingResult.lineMargin,
            pricingResult.marginPercentage,
            line.id
          ]
        );
      }

      // Recalculate quote totals
      await this.recalculateQuoteTotalsInternal(client, input.quoteId, quote.tenant_id);

      await client.query('COMMIT');

      return this.getQuote(input.quoteId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get complete quote with lines
   */
  async getQuote(quoteId: string): Promise<QuoteResult> {
    const quoteQuery = `SELECT * FROM quotes WHERE id = $1`;
    const quoteResult = await this.db.query(quoteQuery, [quoteId]);

    if (quoteResult.rows.length === 0) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    const linesQuery = `SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY line_number`;
    const linesResult = await this.db.query(linesQuery, [quoteId]);

    const lines = linesResult.rows.map(row => this.mapQuoteLineRow(row));

    return this.mapQuoteRow(quoteResult.rows[0], lines);
  }

  /**
   * Validate quote margin requirements
   */
  async validateMargin(input: MarginValidationInput): Promise<MarginValidationResult> {
    const marginPercentage = input.lineMarginPercentage || 0;

    const isValid = marginPercentage >= this.MINIMUM_MARGIN_PERCENTAGE;
    const requiresApproval = marginPercentage < this.MANAGER_APPROVAL_THRESHOLD;

    let approvalLevel: ApprovalLevel | null = null;

    if (marginPercentage < this.VP_APPROVAL_THRESHOLD) {
      approvalLevel = ApprovalLevel.SALES_VP;
    } else if (marginPercentage < this.MANAGER_APPROVAL_THRESHOLD) {
      approvalLevel = ApprovalLevel.SALES_MANAGER;
    }

    return {
      isValid,
      minimumMarginPercentage: this.MINIMUM_MARGIN_PERCENTAGE,
      actualMarginPercentage: marginPercentage,
      requiresApproval,
      approvalLevel
    };
  }

  /**
   * Internal helper to recalculate quote totals
   */
  private async recalculateQuoteTotalsInternal(
    client: PoolClient,
    quoteId: string,
    tenantId: string
  ): Promise<void> {
    const totals = await this.pricingService.calculateQuoteTotals({
      quoteId,
      tenantId
    });

    await client.query(
      `UPDATE quotes
       SET subtotal = $1, discount_amount = $2, total_amount = $3,
           total_cost = $4, margin_amount = $5, margin_percentage = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [
        totals.subtotal,
        totals.discountAmount,
        totals.totalAmount,
        totals.totalCost,
        totals.marginAmount,
        totals.marginPercentage,
        quoteId
      ]
    );
  }

  /**
   * Generate unique quote number
   */
  private async generateQuoteNumber(
    client: PoolClient,
    tenantId: string,
    quoteDate: Date
  ): Promise<string> {
    const year = quoteDate.getFullYear();
    const prefix = `QT-${year}-`;

    const result = await client.query(
      `SELECT quote_number FROM quotes
       WHERE tenant_id = $1 AND quote_number LIKE $2
       ORDER BY quote_number DESC
       LIMIT 1`,
      [tenantId, `${prefix}%`]
    );

    let sequenceNumber = 1;

    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].quote_number;
      const lastSequence = parseInt(lastNumber.split('-')[2]);
      sequenceNumber = lastSequence + 1;
    }

    return `${prefix}${sequenceNumber.toString().padStart(6, '0')}`;
  }

  /**
   * Map database row to QuoteResult
   */
  private mapQuoteRow(row: any, lines: QuoteLineResult[]): QuoteResult {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      quoteNumber: row.quote_number,
      quoteDate: row.quote_date,
      expirationDate: row.expiration_date,
      customerId: row.customer_id,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      salesRepUserId: row.sales_rep_user_id,
      quoteCurrencyCode: row.quote_currency_code,
      subtotal: parseFloat(row.subtotal) || 0,
      taxAmount: parseFloat(row.tax_amount) || 0,
      shippingAmount: parseFloat(row.shipping_amount) || 0,
      discountAmount: parseFloat(row.discount_amount) || 0,
      totalAmount: parseFloat(row.total_amount) || 0,
      totalCost: parseFloat(row.total_cost) || 0,
      marginAmount: parseFloat(row.margin_amount) || 0,
      marginPercentage: parseFloat(row.margin_percentage) || 0,
      status: row.status as QuoteStatus,
      convertedToSalesOrderId: row.converted_to_sales_order_id,
      convertedAt: row.converted_at,
      notes: row.notes,
      termsAndConditions: row.terms_and_conditions,
      lines,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  /**
   * Map database row to QuoteLineResult
   */
  private mapQuoteLineRow(row: any): QuoteLineResult {
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
      discountPercentage: parseFloat(row.discount_percentage) || 0,
      discountAmount: parseFloat(row.discount_amount) || 0,
      unitCost: parseFloat(row.unit_cost) || 0,
      lineCost: parseFloat(row.line_cost) || 0,
      lineMargin: parseFloat(row.line_margin) || 0,
      marginPercentage: parseFloat(row.margin_percentage) || 0,
      manufacturingStrategy: row.manufacturing_strategy,
      leadTimeDays: row.lead_time_days,
      promisedDeliveryDate: row.promised_delivery_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
