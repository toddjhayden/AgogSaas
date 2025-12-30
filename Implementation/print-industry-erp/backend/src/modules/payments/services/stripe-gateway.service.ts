/**
 * Stripe Gateway Service
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * Handles all Stripe payment gateway operations including:
 * - Card payment processing
 * - ACH payment processing
 * - Payment method management
 * - Customer management
 * - Refund processing
 * - Webhook signature validation
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import Stripe from 'stripe';
import {
  ProcessCardPaymentDto,
  ProcessACHPaymentDto,
  SavePaymentMethodDto,
  VerifyBankAccountDto,
  PaymentResult,
  PaymentGatewayTransaction,
  CustomerPaymentMethod,
  CreatePaymentGatewayTransactionDto,
  PaymentTransactionType,
  PaymentTransactionStatus,
  PaymentGatewayProvider,
  PaymentMethodType,
} from '../dto/payment-gateway.dto';
import {
  StripeApiException,
  PaymentMethodNotFoundException,
  BankAccountNotVerifiedException,
  WebhookSignatureException,
  DuplicatePaymentException,
} from '../exceptions/payment-gateway.exceptions';

@Injectable()
export class StripeGatewayService {
  private readonly logger = new Logger(StripeGatewayService.name);
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly db: Pool,
  ) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY not configured in environment variables');
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-12-18' as any,
      timeout: 30000, // 30 second timeout
      maxNetworkRetries: 2,
      telemetry: false, // Disable Stripe telemetry for privacy
    });

    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';

    this.logger.log('Stripe Gateway Service initialized successfully');
  }

  /**
   * Process card payment via Stripe
   */
  async processCardPayment(dto: ProcessCardPaymentDto): Promise<PaymentResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await this.setTenantContext(client, dto.tenantId);

      // Generate idempotency key
      const idempotencyKey = this.generateIdempotencyKey(dto.tenantId, dto.customerId);

      // Check for duplicate payment
      const existingTransaction = await this.checkDuplicateTransaction(client, idempotencyKey);
      if (existingTransaction) {
        await client.query('COMMIT');
        return {
          success: true,
          gatewayTransaction: existingTransaction,
          errorMessage: 'Duplicate payment - original transaction returned',
        };
      }

      // Get or create Stripe customer
      const stripeCustomer = await this.getOrCreateStripeCustomer(client, dto.tenantId, dto.customerId);

      // Create PaymentIntent
      const paymentIntent = await this.retryWithBackoff(async () => {
        return this.stripe.paymentIntents.create({
          amount: Math.round(dto.amount * 100), // Convert to cents
          currency: dto.currencyCode.toLowerCase(),
          customer: stripeCustomer.id,
          payment_method: dto.paymentMethodId,
          confirm: true,
          payment_method_types: ['card'],
          description: `Payment for invoices: ${dto.invoiceIds.join(', ')}`,
          metadata: {
            tenant_id: dto.tenantId,
            customer_id: dto.customerId,
            invoice_ids: dto.invoiceIds.join(','),
            facility_id: dto.facilityId || '',
          },
        }, {
          idempotencyKey,
        });
      });

      // Log gateway transaction
      const gatewayTransaction = await this.logGatewayTransaction(client, {
        tenantId: dto.tenantId,
        gatewayProvider: PaymentGatewayProvider.STRIPE,
        gatewayTransactionId: paymentIntent.id,
        gatewayCustomerId: stripeCustomer.id,
        gatewayPaymentMethodId: dto.paymentMethodId,
        transactionType: PaymentTransactionType.CHARGE,
        amount: dto.amount,
        currencyCode: dto.currencyCode,
        status: this.mapStripeStatus(paymentIntent.status),
        customerId: dto.customerId,
        gatewayRawResponse: paymentIntent,
        idempotencyKey,
        userId: dto.userId,
      });

      // Save payment method if requested
      if (dto.savePaymentMethod && paymentIntent.status === 'succeeded') {
        await this.savePaymentMethod(client, {
          tenantId: dto.tenantId,
          customerId: dto.customerId,
          paymentMethodId: dto.paymentMethodId,
          userId: dto.userId,
        }, stripeCustomer.id);
      }

      await client.query('COMMIT');

      return {
        success: paymentIntent.status === 'succeeded',
        gatewayTransaction,
        requiresAction: paymentIntent.status === 'requires_action',
        clientSecret: paymentIntent.client_secret || undefined,
        errorMessage: paymentIntent.status !== 'succeeded' ? 'Payment requires additional action' : undefined,
      };

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Card payment failed: ${error.message}`, error.stack);
      return this.handleStripeError(error);
    } finally {
      client.release();
    }
  }

  /**
   * Process ACH payment via Stripe
   */
  async processACHPayment(dto: ProcessACHPaymentDto): Promise<PaymentResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await this.setTenantContext(client, dto.tenantId);

      // Verify bank account is verified
      const paymentMethod = await this.getPaymentMethod(client, dto.bankAccountId);
      if (!paymentMethod || !paymentMethod.verified) {
        throw new BankAccountNotVerifiedException(dto.bankAccountId);
      }

      // Generate idempotency key
      const idempotencyKey = this.generateIdempotencyKey(dto.tenantId, dto.customerId);

      // Get Stripe customer
      const stripeCustomerId = paymentMethod.gatewayCustomerId;
      if (!stripeCustomerId) {
        throw new Error('Stripe customer not found for payment method');
      }

      // Create ACH PaymentIntent
      const paymentIntent = await this.retryWithBackoff(async () => {
        return this.stripe.paymentIntents.create({
          amount: Math.round(dto.amount * 100),
          currency: dto.currencyCode.toLowerCase(),
          customer: stripeCustomerId,
          payment_method: dto.bankAccountId,
          payment_method_types: ['us_bank_account'],
          confirm: true,
          description: `ACH payment for invoices: ${dto.invoiceIds.join(', ')}`,
          metadata: {
            tenant_id: dto.tenantId,
            customer_id: dto.customerId,
            invoice_ids: dto.invoiceIds.join(','),
          },
        }, {
          idempotencyKey,
        });
      });

      // Log gateway transaction
      const gatewayTransaction = await this.logGatewayTransaction(client, {
        tenantId: dto.tenantId,
        gatewayProvider: PaymentGatewayProvider.STRIPE,
        gatewayTransactionId: paymentIntent.id,
        gatewayCustomerId: stripeCustomerId,
        gatewayPaymentMethodId: dto.bankAccountId,
        transactionType: PaymentTransactionType.CHARGE,
        amount: dto.amount,
        currencyCode: dto.currencyCode,
        status: PaymentTransactionStatus.PENDING, // ACH takes 3-5 days
        customerId: dto.customerId,
        gatewayRawResponse: paymentIntent,
        idempotencyKey,
        userId: dto.userId,
      });

      await client.query('COMMIT');

      return {
        success: true,
        gatewayTransaction,
        requiresAction: false,
        errorMessage: 'ACH payment initiated. Funds will clear in 3-5 business days.',
      };

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`ACH payment failed: ${error.message}`, error.stack);
      return this.handleStripeError(error);
    } finally {
      client.release();
    }
  }

  /**
   * Save payment method for customer
   */
  async savePaymentMethod(
    client: PoolClient,
    dto: SavePaymentMethodDto,
    stripeCustomerId: string,
  ): Promise<CustomerPaymentMethod> {
    try {
      // Retrieve payment method from Stripe
      const stripePaymentMethod = await this.stripe.paymentMethods.retrieve(dto.paymentMethodId);

      // Attach to customer if not already attached
      if (stripePaymentMethod.customer !== stripeCustomerId) {
        await this.stripe.paymentMethods.attach(dto.paymentMethodId, {
          customer: stripeCustomerId,
        });
      }

      // Prepare display information
      let displayName = '';
      let cardBrand: string | undefined;
      let cardLast4: string | undefined;
      let cardExpMonth: number | undefined;
      let cardExpYear: number | undefined;
      let cardFunding: string | undefined;
      let bankLast4: string | undefined;
      let bankName: string | undefined;
      let paymentMethodType = PaymentMethodType.CARD;

      if (stripePaymentMethod.type === 'card' && stripePaymentMethod.card) {
        cardBrand = stripePaymentMethod.card.brand?.toUpperCase();
        cardLast4 = stripePaymentMethod.card.last4;
        cardExpMonth = stripePaymentMethod.card.exp_month;
        cardExpYear = stripePaymentMethod.card.exp_year;
        cardFunding = stripePaymentMethod.card.funding?.toUpperCase();
        displayName = `${cardBrand} ending in ${cardLast4}`;
        paymentMethodType = PaymentMethodType.CARD;
      } else if (stripePaymentMethod.type === 'us_bank_account' && stripePaymentMethod.us_bank_account) {
        bankLast4 = stripePaymentMethod.us_bank_account.last4;
        bankName = stripePaymentMethod.us_bank_account.bank_name || undefined;
        displayName = `${bankName || 'Bank account'} ending in ${bankLast4}`;
        paymentMethodType = PaymentMethodType.ACH;
      }

      // Insert payment method into database
      const result = await client.query(
        `INSERT INTO customer_payment_methods (
          tenant_id, customer_id, payment_method_type, is_default,
          gateway_provider, gateway_payment_method_id, gateway_customer_id,
          display_name, card_brand, card_last4, card_exp_month, card_exp_year, card_funding,
          bank_last4, bank_name, is_active, verified, fingerprint, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (gateway_payment_method_id) WHERE deleted_at IS NULL
        DO UPDATE SET
          is_default = EXCLUDED.is_default,
          updated_at = NOW(),
          updated_by = EXCLUDED.created_by
        RETURNING *`,
        [
          dto.tenantId,
          dto.customerId,
          paymentMethodType,
          dto.setAsDefault || false,
          PaymentGatewayProvider.STRIPE,
          dto.paymentMethodId,
          stripeCustomerId,
          displayName,
          cardBrand,
          cardLast4,
          cardExpMonth,
          cardExpYear,
          cardFunding,
          bankLast4,
          bankName,
          true,
          paymentMethodType === PaymentMethodType.CARD, // Cards are verified by default
          stripePaymentMethod.card?.fingerprint || stripePaymentMethod.us_bank_account?.fingerprint,
          dto.userId,
        ],
      );

      this.logger.log(`Payment method saved: ${dto.paymentMethodId} for customer ${dto.customerId}`);
      return result.rows[0];

    } catch (error) {
      this.logger.error(`Failed to save payment method: ${error.message}`, error.stack);
      throw new StripeApiException(`Failed to save payment method: ${error.message}`, error);
    }
  }

  /**
   * Verify bank account with micro-deposits
   */
  async verifyBankAccount(dto: VerifyBankAccountDto): Promise<CustomerPaymentMethod> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await this.setTenantContext(client, dto.tenantId);

      // Get payment method
      const paymentMethod = await this.getPaymentMethod(client, dto.bankAccountId);
      if (!paymentMethod) {
        throw new PaymentMethodNotFoundException(dto.bankAccountId);
      }

      // Verify micro-deposits with Stripe
      await this.stripe.paymentMethods.verifyMicrodeposits(dto.bankAccountId, {
        amounts: dto.amounts.map(a => Math.round(a * 100)), // Convert to cents
      });

      // Update verification status
      const result = await client.query(
        `UPDATE customer_payment_methods
        SET verified = true, verification_date = NOW(), verification_method = 'MICRO_DEPOSITS', updated_at = NOW(), updated_by = $1
        WHERE id = $2 AND tenant_id = $3
        RETURNING *`,
        [dto.userId, paymentMethod.id, dto.tenantId],
      );

      await client.query('COMMIT');

      this.logger.log(`Bank account verified: ${dto.bankAccountId}`);
      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Bank account verification failed: ${error.message}`, error.stack);
      throw new StripeApiException(`Bank account verification failed: ${error.message}`, error);
    } finally {
      client.release();
    }
  }

  /**
   * Create refund
   */
  async createRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<Stripe.Refund> {
    try {
      const refund = await this.retryWithBackoff(async () => {
        return this.stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: amount ? Math.round(amount * 100) : undefined, // Full refund if not specified
          reason: reason as any,
        });
      });

      this.logger.log(`Refund created: ${refund.id} for PaymentIntent ${paymentIntentId}`);
      return refund;

    } catch (error) {
      this.logger.error(`Refund creation failed: ${error.message}`, error.stack);
      throw new StripeApiException(`Refund creation failed: ${error.message}`, error);
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    try {
      if (!this.webhookSecret) {
        this.logger.warn('Webhook secret not configured - skipping signature validation');
        return true; // Allow in dev mode
      }

      this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      return true;
    } catch (error) {
      this.logger.error(`Webhook signature validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Construct webhook event from payload
   */
  constructWebhookEvent(payload: string, signature: string): Stripe.Event {
    try {
      if (!this.webhookSecret) {
        return JSON.parse(payload);
      }

      return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      this.logger.error(`Failed to construct webhook event: ${error.message}`);
      throw new WebhookSignatureException();
    }
  }

  /**
   * Get or create Stripe customer
   */
  private async getOrCreateStripeCustomer(
    client: PoolClient,
    tenantId: string,
    customerId: string,
  ): Promise<Stripe.Customer> {
    // Check if customer already has a Stripe customer ID
    const existingMethod = await client.query(
      `SELECT gateway_customer_id FROM customer_payment_methods
      WHERE tenant_id = $1 AND customer_id = $2 AND gateway_customer_id IS NOT NULL
      LIMIT 1`,
      [tenantId, customerId],
    );

    if (existingMethod.rows.length > 0) {
      const stripeCustomerId = existingMethod.rows[0].gateway_customer_id;
      return this.stripe.customers.retrieve(stripeCustomerId) as Promise<Stripe.Customer>;
    }

    // Get customer email from database
    const customerResult = await client.query(
      `SELECT email, company_name FROM customers WHERE id = $1 AND tenant_id = $2`,
      [customerId, tenantId],
    );

    if (customerResult.rows.length === 0) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const customer = customerResult.rows[0];

    // Create Stripe customer
    const stripeCustomer = await this.stripe.customers.create({
      email: customer.email,
      name: customer.company_name,
      metadata: {
        tenant_id: tenantId,
        customer_id: customerId,
      },
    });

    this.logger.log(`Stripe customer created: ${stripeCustomer.id} for customer ${customerId}`);
    return stripeCustomer;
  }

  /**
   * Log gateway transaction
   */
  private async logGatewayTransaction(
    client: PoolClient,
    dto: CreatePaymentGatewayTransactionDto,
  ): Promise<PaymentGatewayTransaction> {
    const result = await client.query(
      `INSERT INTO payment_gateway_transactions (
        tenant_id, payment_id, gateway_provider, gateway_transaction_id,
        gateway_customer_id, gateway_payment_method_id, transaction_type,
        amount, currency_code, status, customer_id, gateway_raw_response,
        idempotency_key, error_message, error_code, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        dto.tenantId,
        dto.paymentId,
        dto.gatewayProvider,
        dto.gatewayTransactionId,
        dto.gatewayCustomerId,
        dto.gatewayPaymentMethodId,
        dto.transactionType,
        dto.amount,
        dto.currencyCode,
        dto.status,
        dto.customerId,
        dto.gatewayRawResponse,
        dto.idempotencyKey,
        dto.errorMessage,
        dto.errorCode,
        dto.userId,
      ],
    );

    return result.rows[0];
  }

  /**
   * Get payment method
   */
  private async getPaymentMethod(client: PoolClient, paymentMethodId: string): Promise<CustomerPaymentMethod | null> {
    const result = await client.query(
      `SELECT * FROM customer_payment_methods WHERE gateway_payment_method_id = $1 AND deleted_at IS NULL`,
      [paymentMethodId],
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Check for duplicate transaction
   */
  private async checkDuplicateTransaction(
    client: PoolClient,
    idempotencyKey: string,
  ): Promise<PaymentGatewayTransaction | null> {
    const result = await client.query(
      `SELECT * FROM payment_gateway_transactions WHERE idempotency_key = $1`,
      [idempotencyKey],
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Set tenant context for RLS
   */
  private async setTenantContext(client: PoolClient, tenantId: string): Promise<void> {
    await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
  }

  /**
   * Generate idempotency key
   */
  private generateIdempotencyKey(tenantId: string, customerId: string): string {
    const timestamp = Date.now();
    return `${tenantId}_${customerId}_${timestamp}`;
  }

  /**
   * Map Stripe payment status to internal status
   */
  private mapStripeStatus(stripeStatus: string): PaymentTransactionStatus {
    const statusMap: Record<string, PaymentTransactionStatus> = {
      'requires_payment_method': PaymentTransactionStatus.PENDING,
      'requires_confirmation': PaymentTransactionStatus.PENDING,
      'requires_action': PaymentTransactionStatus.PENDING,
      'processing': PaymentTransactionStatus.PROCESSING,
      'requires_capture': PaymentTransactionStatus.PENDING,
      'canceled': PaymentTransactionStatus.CANCELED,
      'succeeded': PaymentTransactionStatus.SUCCEEDED,
    };

    return statusMap[stripeStatus] || PaymentTransactionStatus.PENDING;
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const isRateLimit = error instanceof Stripe.errors.StripeRateLimitError;
        const isNetworkError = error instanceof Stripe.errors.StripeConnectionError;

        if ((isRateLimit || isNetworkError) && attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt - 1);
          this.logger.warn(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Handle Stripe errors
   */
  private handleStripeError(error: any): PaymentResult {
    let errorMessage = 'Payment processing failed';
    let errorCode = 'UNKNOWN_ERROR';

    if (error instanceof Stripe.errors.StripeCardError) {
      errorMessage = error.message;
      errorCode = error.code || 'CARD_ERROR';
    } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      errorMessage = 'Invalid payment request';
      errorCode = 'INVALID_REQUEST';
    } else if (error instanceof Stripe.errors.StripeAPIError) {
      errorMessage = 'Payment gateway error';
      errorCode = 'GATEWAY_ERROR';
    } else if (error instanceof Stripe.errors.StripeConnectionError) {
      errorMessage = 'Network connection error';
      errorCode = 'NETWORK_ERROR';
    } else if (error instanceof Stripe.errors.StripeAuthenticationError) {
      errorMessage = 'Payment gateway authentication error';
      errorCode = 'AUTH_ERROR';
    } else if (error instanceof BankAccountNotVerifiedException) {
      errorMessage = error.message;
      errorCode = 'BANK_NOT_VERIFIED';
    }

    return {
      success: false,
      errorMessage,
      errorCode,
    };
  }
}
