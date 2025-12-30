/**
 * Invoice Service
 * REQ-STRATEGIC-AUTO-1767066329940
 *
 * Handles AR/AP invoice creation with GL posting
 */

import { Injectable, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  VoidInvoiceDto,
  Invoice,
} from '../dto/invoice.dto';
import {
  CreateJournalEntryDto,
  CreateJournalEntryLineDto,
} from '../dto/journal-entry.dto';
import { JournalEntryService } from './journal-entry.service';
import {
  InvoiceNotFoundException,
  InvoiceAlreadyPaidException,
  InvoiceAlreadyVoidedException,
  InvoiceTotalMismatchException,
  CustomerNotFoundException,
  VendorNotFoundException,
  CustomerInactiveException,
  VendorInactiveException,
} from '../exceptions/finance.exceptions';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly db: Pool,
    private readonly journalEntryService: JournalEntryService,
  ) {}

  /**
   * Create invoice with optional GL posting
   */
  async createInvoice(dto: CreateInvoiceDto, userId: string): Promise<Invoice> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Validate customer/vendor
      if (dto.customerId) {
        await this.validateCustomer(client, dto.tenantId, dto.customerId);
      }
      if (dto.vendorId) {
        await this.validateVendor(client, dto.tenantId, dto.vendorId);
      }

      // Validate invoice totals
      this.validateInvoiceTotals(dto);

      // Generate invoice number if not provided
      const invoiceNumber = dto.invoiceNumber || await this.generateInvoiceNumber(client, dto.tenantId, dto.invoiceType);

      // Determine period from invoice date
      const period = this.getPeriodFromDate(dto.invoiceDate);

      // Get exchange rate if not provided
      const exchangeRate = dto.exchangeRate || await this.getExchangeRate(client, dto.tenantId, dto.currencyCode, dto.invoiceDate);

      // Calculate balance due
      const balanceDue = dto.totalAmount;

      // Create invoice header
      const invoiceResult = await client.query(
        `INSERT INTO invoices (
          tenant_id, facility_id, invoice_type, customer_id, vendor_id,
          invoice_number, invoice_date, due_date, status, payment_status,
          currency_code, exchange_rate, subtotal, tax_amount, shipping_amount,
          discount_amount, total_amount, paid_amount, balance_due,
          period_year, period_month, notes, reference_number, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        RETURNING *`,
        [
          dto.tenantId,
          dto.facilityId,
          dto.invoiceType,
          dto.customerId,
          dto.vendorId,
          invoiceNumber,
          dto.invoiceDate,
          dto.dueDate,
          'DRAFT',
          'UNPAID',
          dto.currencyCode,
          exchangeRate,
          dto.subtotal,
          dto.taxAmount || 0,
          dto.shippingAmount || 0,
          dto.discountAmount || 0,
          dto.totalAmount,
          0, // paid_amount starts at 0
          balanceDue,
          period.year,
          period.month,
          dto.notes,
          dto.referenceNumber,
          userId,
        ],
      );

      const invoice = invoiceResult.rows[0];

      // Create invoice lines
      for (const line of dto.lines) {
        await client.query(
          `INSERT INTO invoice_lines (
            tenant_id, invoice_id, description, quantity, unit_price,
            amount, account_id, tax_amount, discount_amount, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            dto.tenantId,
            invoice.id,
            line.description,
            line.quantity,
            line.unitPrice,
            line.amount,
            line.accountId,
            line.taxAmount || 0,
            line.discountAmount || 0,
            userId,
          ],
        );
      }

      // Post to GL if requested
      if (dto.postToGL) {
        const journalEntry = await this.postInvoiceToGL(client, invoice, dto, userId);

        // Update invoice with journal entry ID and status
        await client.query(
          `UPDATE invoices SET journal_entry_id = $1, status = 'POSTED', updated_by = $2, updated_at = NOW()
           WHERE id = $3`,
          [journalEntry.id, userId, invoice.id],
        );

        invoice.journal_entry_id = journalEntry.id;
        invoice.status = 'POSTED';
      }

      // Audit log
      await this.logInvoiceAudit(client, dto.tenantId, invoice.id, 'CREATE', userId);

      await client.query('COMMIT');

      this.logger.log(`Created invoice ${invoiceNumber} for tenant ${dto.tenantId}`);

      return this.mapInvoiceRow(invoice);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create invoice: ${error.message}`, error.stack);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update invoice (can only update draft invoices)
   */
  async updateInvoice(
    invoiceId: string,
    dto: UpdateInvoiceDto,
    userId: string,
  ): Promise<Invoice> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get invoice
      const invoiceResult = await client.query(
        `SELECT * FROM invoices WHERE id = $1 AND deleted_at IS NULL`,
        [invoiceId],
      );

      if (invoiceResult.rows.length === 0) {
        throw new InvoiceNotFoundException(invoiceId);
      }

      const invoice = invoiceResult.rows[0];

      // Can only update draft invoices
      if (invoice.status !== 'DRAFT') {
        throw new InvoiceAlreadyPaidException(invoiceId);
      }

      // Update invoice
      const updateResult = await client.query(
        `UPDATE invoices SET
          invoice_date = COALESCE($1, invoice_date),
          due_date = COALESCE($2, due_date),
          notes = COALESCE($3, notes),
          reference_number = COALESCE($4, reference_number),
          updated_by = $5,
          updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [dto.invoiceDate, dto.dueDate, dto.notes, dto.referenceNumber, userId, invoiceId],
      );

      // Audit log
      await this.logInvoiceAudit(client, invoice.tenant_id, invoiceId, 'UPDATE', userId);

      await client.query('COMMIT');

      this.logger.log(`Updated invoice ${invoice.invoice_number}`);

      return this.mapInvoiceRow(updateResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to update invoice: ${error.message}`, error.stack);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Void invoice with GL reversal
   */
  async voidInvoice(
    invoiceId: string,
    dto: VoidInvoiceDto,
    userId: string,
  ): Promise<Invoice> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get invoice
      const invoiceResult = await client.query(
        `SELECT * FROM invoices WHERE id = $1 AND deleted_at IS NULL`,
        [invoiceId],
      );

      if (invoiceResult.rows.length === 0) {
        throw new InvoiceNotFoundException(invoiceId);
      }

      const invoice = invoiceResult.rows[0];

      // Check if already voided
      if (invoice.status === 'VOID') {
        throw new InvoiceAlreadyVoidedException(invoiceId);
      }

      // Check if paid
      if (invoice.paid_amount > 0) {
        throw new InvoiceAlreadyPaidException(invoiceId);
      }

      // Reverse GL entry if posted and reversal requested
      if (dto.reverseGL && invoice.journal_entry_id) {
        await this.journalEntryService.reverseJournalEntry(
          {
            journalEntryId: invoice.journal_entry_id,
            reversalDate: dto.voidDate,
            description: `Void invoice ${invoice.invoice_number}: ${dto.reason}`,
          },
          userId,
        );
      }

      // Update invoice status
      const voidResult = await client.query(
        `UPDATE invoices SET
          status = 'VOID',
          payment_status = 'VOID',
          updated_by = $1,
          updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [userId, invoiceId],
      );

      // Audit log
      await this.logInvoiceAudit(client, invoice.tenant_id, invoiceId, 'VOID', userId, { reason: dto.reason });

      await client.query('COMMIT');

      this.logger.log(`Voided invoice ${invoice.invoice_number}`);

      return this.mapInvoiceRow(voidResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to void invoice: ${error.message}`, error.stack);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Post invoice to GL
   */
  private async postInvoiceToGL(
    client: PoolClient,
    invoice: any,
    dto: CreateInvoiceDto,
    userId: string,
  ): Promise<any> {
    const lines: CreateJournalEntryLineDto[] = [];

    // Determine AR/AP account based on invoice type
    const isCustomerInvoice = dto.invoiceType === 'CUSTOMER_INVOICE';
    const isVendorBill = dto.invoiceType === 'VENDOR_BILL';

    if (isCustomerInvoice) {
      // DR: Accounts Receivable (increase asset)
      lines.push({
        accountId: await this.getARAccount(client, dto.tenantId),
        debitAmount: dto.totalAmount,
        creditAmount: 0,
        description: `AR - Invoice ${invoice.invoice_number}`,
      });

      // CR: Revenue accounts (from invoice lines)
      for (const line of dto.lines) {
        if (line.accountId) {
          lines.push({
            accountId: line.accountId,
            debitAmount: 0,
            creditAmount: line.amount,
            description: line.description,
          });
        }
      }

      // CR: Tax liability (if applicable)
      if (dto.taxAmount && dto.taxAmount > 0) {
        lines.push({
          accountId: await this.getTaxLiabilityAccount(client, dto.tenantId),
          debitAmount: 0,
          creditAmount: dto.taxAmount,
          description: 'Sales Tax',
        });
      }
    } else if (isVendorBill) {
      // DR: Expense accounts (from invoice lines)
      for (const line of dto.lines) {
        if (line.accountId) {
          lines.push({
            accountId: line.accountId,
            debitAmount: line.amount,
            creditAmount: 0,
            description: line.description,
          });
        }
      }

      // DR: Tax (if applicable)
      if (dto.taxAmount && dto.taxAmount > 0) {
        lines.push({
          accountId: await this.getTaxExpenseAccount(client, dto.tenantId),
          debitAmount: dto.taxAmount,
          creditAmount: 0,
          description: 'Tax Expense',
        });
      }

      // CR: Accounts Payable (increase liability)
      lines.push({
        accountId: await this.getAPAccount(client, dto.tenantId),
        debitAmount: 0,
        creditAmount: dto.totalAmount,
        description: `AP - Bill ${invoice.invoice_number}`,
      });
    }

    const jeDto: CreateJournalEntryDto = {
      tenantId: dto.tenantId,
      facilityId: dto.facilityId,
      periodYear: invoice.period_year,
      periodMonth: invoice.period_month,
      entryDate: dto.invoiceDate,
      entryType: 'SYSTEM',
      description: `${isCustomerInvoice ? 'Customer Invoice' : 'Vendor Bill'} ${invoice.invoice_number}`,
      lines,
      referenceNumber: invoice.invoice_number,
    };

    return await this.journalEntryService.createJournalEntry(jeDto, userId);
  }

  /**
   * Validate invoice totals match
   */
  private validateInvoiceTotals(dto: CreateInvoiceDto): void {
    const calculatedSubtotal = dto.lines.reduce((sum, line) => sum + line.amount, 0);
    const calculatedTotal = calculatedSubtotal + (dto.taxAmount || 0) + (dto.shippingAmount || 0) - (dto.discountAmount || 0);

    // Allow for small rounding differences
    if (Math.abs(dto.subtotal - calculatedSubtotal) > 0.01) {
      throw new InvoiceTotalMismatchException(calculatedSubtotal, dto.subtotal);
    }

    if (Math.abs(dto.totalAmount - calculatedTotal) > 0.01) {
      throw new InvoiceTotalMismatchException(calculatedTotal, dto.totalAmount);
    }
  }

  /**
   * Validate customer exists and is active
   */
  private async validateCustomer(client: PoolClient, tenantId: string, customerId: string): Promise<void> {
    const result = await client.query(
      `SELECT * FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [customerId, tenantId],
    );

    if (result.rows.length === 0) {
      throw new CustomerNotFoundException(customerId);
    }

    if (!result.rows[0].is_active) {
      throw new CustomerInactiveException(result.rows[0].customer_number);
    }
  }

  /**
   * Validate vendor exists and is active
   */
  private async validateVendor(client: PoolClient, tenantId: string, vendorId: string): Promise<void> {
    const result = await client.query(
      `SELECT * FROM vendors WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [vendorId, tenantId],
    );

    if (result.rows.length === 0) {
      throw new VendorNotFoundException(vendorId);
    }

    if (!result.rows[0].is_active) {
      throw new VendorInactiveException(result.rows[0].vendor_number);
    }
  }

  /**
   * Get AR account for tenant
   */
  private async getARAccount(client: PoolClient, tenantId: string): Promise<string> {
    const result = await client.query(
      `SELECT id FROM chart_of_accounts
       WHERE tenant_id = $1 AND account_type = 'ASSET' AND account_subtype = 'ACCOUNTS_RECEIVABLE'
       AND is_active = true AND deleted_at IS NULL
       ORDER BY account_number LIMIT 1`,
      [tenantId],
    );
    return result.rows[0]?.id || '00000000-0000-0000-0000-000000000000';
  }

  /**
   * Get AP account for tenant
   */
  private async getAPAccount(client: PoolClient, tenantId: string): Promise<string> {
    const result = await client.query(
      `SELECT id FROM chart_of_accounts
       WHERE tenant_id = $1 AND account_type = 'LIABILITY' AND account_subtype = 'ACCOUNTS_PAYABLE'
       AND is_active = true AND deleted_at IS NULL
       ORDER BY account_number LIMIT 1`,
      [tenantId],
    );
    return result.rows[0]?.id || '00000000-0000-0000-0000-000000000000';
  }

  /**
   * Get tax liability account
   */
  private async getTaxLiabilityAccount(client: PoolClient, tenantId: string): Promise<string> {
    const result = await client.query(
      `SELECT id FROM chart_of_accounts
       WHERE tenant_id = $1 AND account_type = 'LIABILITY' AND account_name ILIKE '%tax%'
       AND is_active = true AND deleted_at IS NULL
       ORDER BY account_number LIMIT 1`,
      [tenantId],
    );
    return result.rows[0]?.id || '00000000-0000-0000-0000-000000000000';
  }

  /**
   * Get tax expense account
   */
  private async getTaxExpenseAccount(client: PoolClient, tenantId: string): Promise<string> {
    const result = await client.query(
      `SELECT id FROM chart_of_accounts
       WHERE tenant_id = $1 AND account_type = 'EXPENSE' AND account_name ILIKE '%tax%'
       AND is_active = true AND deleted_at IS NULL
       ORDER BY account_number LIMIT 1`,
      [tenantId],
    );
    return result.rows[0]?.id || '00000000-0000-0000-0000-000000000000';
  }

  /**
   * Generate invoice number
   */
  private async generateInvoiceNumber(client: PoolClient, tenantId: string, invoiceType: string): Promise<string> {
    const prefix = invoiceType === 'CUSTOMER_INVOICE' ? 'INV' : 'BILL';
    const result = await client.query(
      `SELECT COUNT(*) as count FROM invoices WHERE tenant_id = $1 AND invoice_type = $2`,
      [tenantId, invoiceType],
    );
    const count = parseInt(result.rows[0].count) + 1;
    return `${prefix}-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
  }

  /**
   * Get exchange rate for currency on date
   */
  private async getExchangeRate(client: PoolClient, tenantId: string, currencyCode: string, date: Date): Promise<number> {
    // If base currency, rate is 1.0
    if (currencyCode === 'USD') return 1.0;

    const result = await client.query(
      `SELECT exchange_rate FROM exchange_rates
       WHERE tenant_id = $1 AND from_currency_code = 'USD' AND to_currency_code = $2
       AND rate_date <= $3
       ORDER BY rate_date DESC LIMIT 1`,
      [tenantId, currencyCode, date],
    );

    return result.rows[0]?.exchange_rate || 1.0;
  }

  /**
   * Get period from date
   */
  private getPeriodFromDate(date: Date): { year: number; month: number } {
    const d = new Date(date);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  /**
   * Log invoice audit trail
   */
  private async logInvoiceAudit(
    client: PoolClient,
    tenantId: string,
    entityId: string,
    action: string,
    userId: string,
    additionalData?: any,
  ): Promise<void> {
    await client.query(
      `INSERT INTO finance_audit_log (tenant_id, entity_type, entity_id, action, changed_by, new_values)
       VALUES ($1, 'INVOICE', $2, $3, $4, $5)`,
      [tenantId, entityId, action, userId, additionalData ? JSON.stringify(additionalData) : null],
    );
  }

  /**
   * Map database row to Invoice DTO
   */
  private mapInvoiceRow(row: any): Invoice {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      invoiceType: row.invoice_type,
      customerId: row.customer_id,
      vendorId: row.vendor_id,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      status: row.status,
      paymentStatus: row.payment_status,
      currencyCode: row.currency_code,
      exchangeRate: parseFloat(row.exchange_rate),
      subtotal: parseFloat(row.subtotal),
      taxAmount: parseFloat(row.tax_amount),
      shippingAmount: parseFloat(row.shipping_amount),
      discountAmount: parseFloat(row.discount_amount),
      totalAmount: parseFloat(row.total_amount),
      paidAmount: parseFloat(row.paid_amount),
      balanceDue: parseFloat(row.balance_due),
      periodYear: row.period_year,
      periodMonth: row.period_month,
      journalEntryId: row.journal_entry_id,
      notes: row.notes,
      referenceNumber: row.reference_number,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
    };
  }
}
