/**
 * Payment Service
 * REQ-STRATEGIC-AUTO-1767066329940
 *
 * Handles payment processing and application to invoices
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  CreatePaymentDto,
  ApplyPaymentDto,
  UnapplyPaymentDto,
  VoidPaymentDto,
  Payment,
  PaymentApplication,
} from '../dto/payment.dto';
import { CreateJournalEntryDto } from '../dto/journal-entry.dto';
import { JournalEntryService } from './journal-entry.service';
import {
  PaymentNotFoundException,
  InsufficientPaymentAmountException,
  PaymentApplicationNotFoundException,
  InvoiceNotFoundException,
} from '../exceptions/finance.exceptions';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly journalEntryService: JournalEntryService,
  ) {}

  /**
   * Create payment with optional auto-application to invoices
   */
  async createPayment(dto: CreatePaymentDto, userId: string): Promise<Payment> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const paymentNumber = dto.paymentNumber || await this.generatePaymentNumber(client, dto.tenantId, dto.paymentType);
      const period = this.getPeriodFromDate(dto.paymentDate);
      const exchangeRate = dto.exchangeRate || await this.getExchangeRate(client, dto.tenantId, dto.currencyCode, dto.paymentDate);

      let unappliedAmount = dto.amount;

      // Create payment header
      const paymentResult = await client.query(
        `INSERT INTO payments (
          tenant_id, facility_id, payment_type, customer_id, vendor_id,
          payment_number, payment_date, deposit_date, amount, currency_code,
          exchange_rate, payment_method, check_number, transaction_id,
          paid_by_name, bank_account_id, unapplied_amount, period_year,
          period_month, status, notes, reference_number, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING *`,
        [
          dto.tenantId, dto.facilityId, dto.paymentType, dto.customerId, dto.vendorId,
          paymentNumber, dto.paymentDate, dto.depositDate, dto.amount, dto.currencyCode,
          exchangeRate, dto.paymentMethod, dto.checkNumber, dto.transactionId,
          dto.paidByName, dto.bankAccountId, unappliedAmount, period.year,
          period.month, 'DRAFT', dto.notes, dto.referenceNumber, userId,
        ],
      );

      const payment = paymentResult.rows[0];

      // Auto-apply to invoices if specified
      if (dto.applyToInvoices && dto.applyToInvoices.length > 0) {
        for (const application of dto.applyToInvoices) {
          if (unappliedAmount >= application.amountToApply) {
            await this.applyPaymentInternal(
              client,
              payment.id,
              application.invoiceId,
              application.amountToApply,
              dto.paymentDate,
              userId,
            );
            unappliedAmount -= application.amountToApply;
          }
        }

        // Update unapplied amount
        await client.query(
          `UPDATE payments SET unapplied_amount = $1 WHERE id = $2`,
          [unappliedAmount, payment.id],
        );
      }

      // Post to GL if requested
      if (dto.postToGL) {
        await this.postPaymentToGL(client, payment, dto, userId);
        await client.query(
          `UPDATE payments SET status = 'POSTED' WHERE id = $1`,
          [payment.id],
        );
      }

      await this.logPaymentAudit(client, dto.tenantId, payment.id, 'CREATE', userId);
      await client.query('COMMIT');

      this.logger.log(`Created payment ${paymentNumber}`);
      return this.mapPaymentRow(paymentResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create payment: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`, (error instanceof Error ? error.stack : undefined));
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Apply payment to invoice
   */
  async applyPayment(dto: ApplyPaymentDto, userId: string): Promise<PaymentApplication> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      const application = await this.applyPaymentInternal(
        client,
        dto.paymentId,
        dto.invoiceId,
        dto.amountToApply,
        dto.appliedDate,
        userId,
      );
      await client.query('COMMIT');
      return application;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Internal payment application logic (used within transactions)
   */
  private async applyPaymentInternal(
    client: PoolClient,
    paymentId: string,
    invoiceId: string,
    amountToApply: number,
    appliedDate: Date,
    userId: string,
  ): Promise<PaymentApplication> {
    // Get payment
    const paymentResult = await client.query(
      `SELECT * FROM payments WHERE id = $1`,
      [paymentId],
    );
    if (paymentResult.rows.length === 0) {
      throw new PaymentNotFoundException(paymentId);
    }
    const payment = paymentResult.rows[0];

    // Get invoice
    const invoiceResult = await client.query(
      `SELECT * FROM invoices WHERE id = $1`,
      [invoiceId],
    );
    if (invoiceResult.rows.length === 0) {
      throw new InvoiceNotFoundException(invoiceId);
    }
    const invoice = invoiceResult.rows[0];

    // Check sufficient unapplied amount
    if (payment.unapplied_amount < amountToApply) {
      throw new InsufficientPaymentAmountException(payment.unapplied_amount, amountToApply);
    }

    // Create payment application
    const applicationResult = await client.query(
      `INSERT INTO payment_applications (
        tenant_id, payment_id, invoice_id, amount_applied, applied_date, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'APPLIED', $6)
      RETURNING *`,
      [payment.tenant_id, paymentId, invoiceId, amountToApply, appliedDate, userId],
    );

    // Update payment unapplied amount
    await client.query(
      `UPDATE payments SET unapplied_amount = unapplied_amount - $1 WHERE id = $2`,
      [amountToApply, paymentId],
    );

    // Update invoice paid amount and balance
    await client.query(
      `UPDATE invoices SET
        paid_amount = paid_amount + $1,
        balance_due = balance_due - $1,
        payment_status = CASE
          WHEN balance_due - $1 <= 0 THEN 'PAID'
          WHEN paid_amount + $1 > 0 THEN 'PARTIAL'
          ELSE payment_status
        END
       WHERE id = $2`,
      [amountToApply, invoiceId],
    );

    this.logger.log(`Applied $${amountToApply} from payment ${payment.payment_number} to invoice ${invoice.invoice_number}`);
    return this.mapPaymentApplicationRow(applicationResult.rows[0]);
  }

  /**
   * Post payment to GL
   */
  private async postPaymentToGL(
    client: PoolClient,
    payment: any,
    dto: CreatePaymentDto,
    userId: string,
  ): Promise<void> {
    const isCustomerPayment = dto.paymentType === 'CUSTOMER_PAYMENT';

    const lines: any[] = [];

    if (isCustomerPayment) {
      // DR: Cash/Bank
      lines.push({
        accountId: await this.getCashAccount(client, dto.tenantId, dto.bankAccountId),
        debitAmount: dto.amount,
        creditAmount: 0,
        description: `Payment ${payment.payment_number}`,
      });

      // CR: Accounts Receivable
      lines.push({
        accountId: await this.getARAccount(client, dto.tenantId),
        debitAmount: 0,
        creditAmount: dto.amount,
        description: `Payment ${payment.payment_number}`,
      });
    } else {
      // DR: Accounts Payable
      lines.push({
        accountId: await this.getAPAccount(client, dto.tenantId),
        debitAmount: dto.amount,
        creditAmount: 0,
        description: `Payment ${payment.payment_number}`,
      });

      // CR: Cash/Bank
      lines.push({
        accountId: await this.getCashAccount(client, dto.tenantId, dto.bankAccountId),
        debitAmount: 0,
        creditAmount: dto.amount,
        description: `Payment ${payment.payment_number}`,
      });
    }

    const jeDto: CreateJournalEntryDto = {
      tenantId: dto.tenantId,
      facilityId: dto.facilityId,
      periodYear: payment.period_year,
      periodMonth: payment.period_month,
      entryDate: dto.paymentDate,
      entryType: 'SYSTEM',
      description: `${isCustomerPayment ? 'Customer Payment' : 'Vendor Payment'} ${payment.payment_number}`,
      lines,
      referenceNumber: payment.payment_number,
    };

    await this.journalEntryService.createJournalEntry(jeDto, userId);
  }

  private async getCashAccount(client: PoolClient, tenantId: string, bankAccountId?: string): Promise<string> {
    if (bankAccountId) {
      const result = await client.query(
        `SELECT gl_account_id FROM bank_accounts WHERE id = $1 AND tenant_id = $2`,
        [bankAccountId, tenantId],
      );
      if (result.rows.length > 0 && result.rows[0].gl_account_id) {
        return result.rows[0].gl_account_id;
      }
    }

    const result = await client.query(
      `SELECT id FROM chart_of_accounts
       WHERE tenant_id = $1 AND account_type = 'ASSET' AND account_subtype = 'CASH'
       AND is_active = true AND deleted_at IS NULL
       ORDER BY account_number LIMIT 1`,
      [tenantId],
    );
    return result.rows[0]?.id || '00000000-0000-0000-0000-000000000000';
  }

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

  private async generatePaymentNumber(client: PoolClient, tenantId: string, paymentType: string): Promise<string> {
    const prefix = paymentType === 'CUSTOMER_PAYMENT' ? 'PMT' : 'VPMT';
    const result = await client.query(
      `SELECT COUNT(*) as count FROM payments WHERE tenant_id = $1 AND payment_type = $2`,
      [tenantId, paymentType],
    );
    const count = parseInt(result.rows[0].count) + 1;
    return `${prefix}-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
  }

  private async getExchangeRate(client: PoolClient, tenantId: string, currencyCode: string, date: Date): Promise<number> {
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

  private getPeriodFromDate(date: Date): { year: number; month: number } {
    const d = new Date(date);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  private async logPaymentAudit(client: PoolClient, tenantId: string, entityId: string, action: string, userId: string): Promise<void> {
    await client.query(
      `INSERT INTO finance_audit_log (tenant_id, entity_type, entity_id, action, changed_by)
       VALUES ($1, 'PAYMENT', $2, $3, $4)`,
      [tenantId, entityId, action, userId],
    );
  }

  private mapPaymentRow(row: any): Payment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      paymentType: row.payment_type,
      customerId: row.customer_id,
      vendorId: row.vendor_id,
      paymentNumber: row.payment_number,
      paymentDate: row.payment_date,
      depositDate: row.deposit_date,
      amount: parseFloat(row.amount),
      currencyCode: row.currency_code,
      exchangeRate: parseFloat(row.exchange_rate),
      paymentMethod: row.payment_method,
      checkNumber: row.check_number,
      transactionId: row.transaction_id,
      paidByName: row.paid_by_name,
      bankAccountId: row.bank_account_id,
      unappliedAmount: parseFloat(row.unapplied_amount),
      periodYear: row.period_year,
      periodMonth: row.period_month,
      journalEntryId: row.journal_entry_id,
      status: row.status,
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

  private mapPaymentApplicationRow(row: any): PaymentApplication {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      paymentId: row.payment_id,
      invoiceId: row.invoice_id,
      amountApplied: parseFloat(row.amount_applied),
      appliedDate: row.applied_date,
      journalEntryId: row.journal_entry_id,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }
}
