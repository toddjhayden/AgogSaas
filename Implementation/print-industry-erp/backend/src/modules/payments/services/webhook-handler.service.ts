/**
 * Webhook Handler Service
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * Handles webhook events from Stripe including:
 * - Payment success/failure
 * - Refunds
 * - Disputes
 * - Payment method updates
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import Stripe from 'stripe';
import { StripeGatewayService } from './stripe-gateway.service';
import { PaymentService } from '../../finance/services/payment.service';
import {
  PaymentTransactionStatus,
  PaymentGatewayProvider,
  CreatePaymentGatewayTransactionDto,
  PaymentTransactionType,
} from '../dto/payment-gateway.dto';

@Injectable()
export class WebhookHandlerService {
  private readonly logger = new Logger(WebhookHandlerService.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly stripeGateway: StripeGatewayService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Process Stripe webhook event
   */
  async processStripeWebhook(event: Stripe.Event): Promise<void> {
    const client = await this.db.connect();

    try {
      // Check if event already processed (idempotency)
      const existing = await this.checkEventProcessed(client, event.id);
      if (existing) {
        this.logger.warn(`Duplicate webhook event ${event.id} - already processed`);
        return;
      }

      this.logger.log(`Processing webhook event: ${event.type} (${event.id})`);

      // Route to appropriate handler based on event type
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(client, event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(client, event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(client, event.data.object as Stripe.PaymentIntent);
          break;

        case 'charge.succeeded':
          await this.handleChargeSucceeded(client, event.data.object as Stripe.Charge);
          break;

        case 'charge.failed':
          await this.handleChargeFailed(client, event.data.object as Stripe.Charge);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(client, event.data.object as Stripe.Charge);
          break;

        case 'charge.dispute.created':
          await this.handleDisputeCreated(client, event.data.object as Stripe.Dispute);
          break;

        case 'charge.dispute.closed':
          await this.handleDisputeClosed(client, event.data.object as Stripe.Dispute);
          break;

        case 'customer.source.created':
          await this.handleCustomerSourceCreated(client, event.data.object as any);
          break;

        case 'customer.source.deleted':
          await this.handleCustomerSourceDeleted(client, event.data.object as any);
          break;

        default:
          this.logger.log(`Unhandled webhook event type: ${event.type}`);
      }

      this.logger.log(`Webhook event processed successfully: ${event.type} (${event.id})`);

    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`, (error instanceof Error ? error.stack : undefined));
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle payment_intent.succeeded event
   */
  private async handlePaymentIntentSucceeded(
    client: PoolClient,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    await client.query('BEGIN');

    try {
      const metadata = paymentIntent.metadata;
      const tenantId = metadata.tenant_id;
      const customerId = metadata.customer_id;
      const invoiceIds = metadata.invoice_ids ? metadata.invoice_ids.split(',') : [];

      if (!tenantId || !customerId) {
        throw new Error('Missing tenant_id or customer_id in payment intent metadata');
      }

      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // Update existing gateway transaction or create new one
      const existingTxn = await client.query(
        `SELECT id, payment_id FROM payment_gateway_transactions
        WHERE gateway_transaction_id = $1 AND gateway_provider = $2`,
        [paymentIntent.id, PaymentGatewayProvider.STRIPE],
      );

      if (existingTxn.rows.length > 0) {
        // Update existing transaction
        await client.query(
          `UPDATE payment_gateway_transactions
          SET status = $1, completed_at = NOW(), gateway_raw_response = $2, updated_at = NOW()
          WHERE id = $3`,
          [PaymentTransactionStatus.SUCCEEDED, paymentIntent, existingTxn.rows[0].id],
        );

        // If payment already created, just update invoice status
        if (existingTxn.rows[0].payment_id) {
          await this.updateInvoiceStatuses(client, invoiceIds, 'PAID');
        }
      } else {
        // Create payment record if this is a new payment (e.g., from webhook retry)
        const amount = paymentIntent.amount / 100; // Convert from cents
        const currencyCode = paymentIntent.currency.toUpperCase();

        // Create payment using PaymentService
        const payment = await this.paymentService.createPayment({
          tenantId,
          customerId,
          paymentType: 'CUSTOMER_PAYMENT',
          paymentMethod: 'CREDIT_CARD',
          paymentDate: new Date(),
          amount,
          currencyCode,
          transactionId: paymentIntent.id,
          referenceNumber: paymentIntent.id,
          notes: `Payment via Stripe - ${paymentIntent.id}`,
          invoiceIds, // Auto-apply to invoices
        }, 'SYSTEM');

        // Log gateway transaction
        await client.query(
          `INSERT INTO payment_gateway_transactions (
            tenant_id, payment_id, gateway_provider, gateway_transaction_id,
            gateway_customer_id, gateway_payment_method_id, transaction_type,
            amount, currency_code, status, customer_id, gateway_raw_response,
            webhook_event_id, webhook_received_at, completed_at, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), $14)`,
          [
            tenantId,
            payment.id,
            PaymentGatewayProvider.STRIPE,
            paymentIntent.id,
            paymentIntent.customer,
            paymentIntent.payment_method,
            PaymentTransactionType.CHARGE,
            amount,
            currencyCode,
            PaymentTransactionStatus.SUCCEEDED,
            customerId,
            paymentIntent,
            paymentIntent.id, // Use payment intent ID as webhook event ID
            'SYSTEM',
          ],
        );
      }

      await client.query('COMMIT');
      this.logger.log(`Payment succeeded: ${paymentIntent.id}`);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Handle payment_intent.payment_failed event
   */
  private async handlePaymentIntentFailed(
    client: PoolClient,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    await client.query('BEGIN');

    try {
      const metadata = paymentIntent.metadata;
      const tenantId = metadata.tenant_id;
      const invoiceIds = metadata.invoice_ids ? metadata.invoice_ids.split(',') : [];

      if (!tenantId) {
        throw new Error('Missing tenant_id in payment intent metadata');
      }

      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // Update gateway transaction status
      await client.query(
        `UPDATE payment_gateway_transactions
        SET status = $1, error_message = $2, gateway_raw_response = $3, updated_at = NOW()
        WHERE gateway_transaction_id = $4 AND gateway_provider = $5`,
        [
          PaymentTransactionStatus.FAILED,
          paymentIntent.last_payment_error?.message || 'Payment failed',
          paymentIntent,
          paymentIntent.id,
          PaymentGatewayProvider.STRIPE,
        ],
      );

      // Mark invoices as overdue if they were unpaid
      await this.updateInvoiceStatuses(client, invoiceIds, 'OVERDUE');

      await client.query('COMMIT');
      this.logger.log(`Payment failed: ${paymentIntent.id}`);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Handle payment_intent.canceled event
   */
  private async handlePaymentIntentCanceled(
    client: PoolClient,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    await client.query('BEGIN');

    try {
      // Update gateway transaction status
      await client.query(
        `UPDATE payment_gateway_transactions
        SET status = $1, gateway_raw_response = $2, updated_at = NOW()
        WHERE gateway_transaction_id = $3 AND gateway_provider = $4`,
        [
          PaymentTransactionStatus.CANCELED,
          paymentIntent,
          paymentIntent.id,
          PaymentGatewayProvider.STRIPE,
        ],
      );

      await client.query('COMMIT');
      this.logger.log(`Payment canceled: ${paymentIntent.id}`);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Handle charge.succeeded event (for ACH payments)
   */
  private async handleChargeSucceeded(
    client: PoolClient,
    charge: Stripe.Charge,
  ): Promise<void> {
    // Update payment status to CLEARED (especially important for ACH)
    await client.query(
      `UPDATE payments
      SET status = 'CLEARED', updated_at = NOW()
      WHERE transaction_id = $1 AND status = 'PENDING'`,
      [charge.payment_intent],
    );

    this.logger.log(`Charge succeeded: ${charge.id}`);
  }

  /**
   * Handle charge.failed event
   */
  private async handleChargeFailed(
    client: PoolClient,
    charge: Stripe.Charge,
  ): Promise<void> {
    this.logger.error(`Charge failed: ${charge.id} - ${charge.failure_message}`);

    // Update gateway transaction with failure details
    await client.query(
      `UPDATE payment_gateway_transactions
      SET status = $1, error_message = $2, updated_at = NOW()
      WHERE gateway_transaction_id = $3`,
      [
        PaymentTransactionStatus.FAILED,
        charge.failure_message,
        charge.id,
      ],
    );
  }

  /**
   * Handle charge.refunded event
   */
  private async handleChargeRefunded(
    client: PoolClient,
    charge: Stripe.Charge,
  ): Promise<void> {
    await client.query('BEGIN');

    try {
      // Update gateway transaction status
      await client.query(
        `UPDATE payment_gateway_transactions
        SET status = $1, gateway_raw_response = $2, updated_at = NOW()
        WHERE gateway_transaction_id = $3`,
        [
          PaymentTransactionStatus.REFUNDED,
          charge,
          charge.payment_intent,
        ],
      );

      // Reverse payment applications (handled by PaymentService.refundPayment)
      this.logger.log(`Charge refunded: ${charge.id}`);

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Handle charge.dispute.created event
   */
  private async handleDisputeCreated(
    client: PoolClient,
    dispute: Stripe.Dispute,
  ): Promise<void> {
    this.logger.warn(`Dispute created: ${dispute.id} for charge ${dispute.charge}`);

    // Update gateway transaction
    await client.query(
      `UPDATE payment_gateway_transactions
      SET status = $1, error_message = $2, updated_at = NOW()
      WHERE gateway_transaction_id = $3`,
      [
        PaymentTransactionStatus.DISPUTED,
        `Dispute: ${dispute.reason}`,
        dispute.payment_intent,
      ],
    );

    // TODO: Send notification to accounting team
  }

  /**
   * Handle charge.dispute.closed event
   */
  private async handleDisputeClosed(
    client: PoolClient,
    dispute: Stripe.Dispute,
  ): Promise<void> {
    const status = dispute.status === 'won' ? PaymentTransactionStatus.SUCCEEDED : PaymentTransactionStatus.FAILED;

    await client.query(
      `UPDATE payment_gateway_transactions
      SET status = $1, error_message = $2, updated_at = NOW()
      WHERE gateway_transaction_id = $3`,
      [
        status,
        `Dispute ${dispute.status}: ${dispute.reason}`,
        dispute.payment_intent,
      ],
    );

    this.logger.log(`Dispute closed: ${dispute.id} - ${dispute.status}`);
  }

  /**
   * Handle customer.source.created event
   */
  private async handleCustomerSourceCreated(
    client: PoolClient,
    source: any,
  ): Promise<void> {
    this.logger.log(`Customer source created: ${source.id}`);
    // Payment method is already saved via savePaymentMethod
  }

  /**
   * Handle customer.source.deleted event
   */
  private async handleCustomerSourceDeleted(
    client: PoolClient,
    source: any,
  ): Promise<void> {
    // Soft delete payment method
    await client.query(
      `UPDATE customer_payment_methods
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE gateway_payment_method_id = $1`,
      [source.id],
    );

    this.logger.log(`Customer source deleted: ${source.id}`);
  }

  /**
   * Check if webhook event already processed (idempotency)
   */
  private async checkEventProcessed(client: PoolClient, eventId: string): Promise<boolean> {
    const result = await client.query(
      `SELECT id FROM payment_gateway_transactions WHERE webhook_event_id = $1`,
      [eventId],
    );

    return result.rows.length > 0;
  }

  /**
   * Update invoice statuses
   */
  private async updateInvoiceStatuses(
    client: PoolClient,
    invoiceIds: string[],
    status: string,
  ): Promise<void> {
    if (invoiceIds.length === 0) return;

    await client.query(
      `UPDATE invoices SET payment_status = $1, updated_at = NOW()
      WHERE id = ANY($2::uuid[])`,
      [status, invoiceIds],
    );
  }
}
