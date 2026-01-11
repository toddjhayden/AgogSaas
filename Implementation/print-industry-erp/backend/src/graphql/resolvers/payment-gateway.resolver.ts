/**
 * Payment Gateway GraphQL Resolver
 * REQ-STRATEGIC-AUTO-1767084329261
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Pool } from 'pg';
import { Logger, Inject } from '@nestjs/common';
import { PaymentGatewayService } from '../../modules/payments/services/payment-gateway.service';
import { StripeGatewayService } from '../../modules/payments/services/stripe-gateway.service';
import {
  ProcessCardPaymentDto,
  ProcessACHPaymentDto,
  SavePaymentMethodDto,
  VerifyBankAccountDto,
  RefundPaymentDto,
  PaymentGatewayProvider,
} from '../../modules/payments/dto/payment-gateway.dto';

@Resolver()
export class PaymentGatewayResolver {
  private readonly logger = new Logger(PaymentGatewayResolver.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly paymentGateway: PaymentGatewayService,
    private readonly stripeGateway: StripeGatewayService,
  ) {}

  // =====================================================
  // QUERIES
  // =====================================================

  @Query()
  async customerPaymentMethods(
    @Args('tenantId') tenantId: string,
    @Args('customerId') customerId: string,
    @Context() context: any,
  ) {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      const result = await client.query(
        `SELECT * FROM customer_payment_methods
        WHERE tenant_id = $1 AND customer_id = $2 AND is_active = true AND deleted_at IS NULL
        ORDER BY is_default DESC, created_at DESC`,
        [tenantId, customerId],
      );

      return result.rows;

    } finally {
      client.release();
    }
  }

  @Query()
  async paymentGatewayTransaction(
    @Args('id') id: string,
    @Context() context: any,
  ) {
    const client = await this.db.connect();

    try {
      const result = await client.query(
        `SELECT * FROM payment_gateway_transactions WHERE id = $1`,
        [id],
      );

      return result.rows.length > 0 ? result.rows[0] : null;

    } finally {
      client.release();
    }
  }

  @Query()
  async paymentGatewayTransactions(
    @Args('tenantId') tenantId: string,
    @Args('customerId', { nullable: true }) customerId: string | null,
    @Args('status', { nullable: true }) status: string | null,
    @Args('startDate', { nullable: true }) startDate: string | null,
    @Args('endDate', { nullable: true }) endDate: string | null,
    @Args('limit', { nullable: true, defaultValue: 100 }) limit: number,
    @Args('offset', { nullable: true, defaultValue: 0 }) offset: number,
    @Context() context: any,
  ) {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      let query = `SELECT * FROM payment_gateway_transactions WHERE tenant_id = $1`;
      const params: any[] = [tenantId];
      let paramIndex = 2;

      if (customerId) {
        query += ` AND customer_id = $${paramIndex}`;
        params.push(customerId);
        paramIndex++;
      }

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND initiated_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND initiated_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY initiated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await client.query(query, params);
      return result.rows;

    } finally {
      client.release();
    }
  }

  // =====================================================
  // MUTATIONS
  // =====================================================

  @Mutation()
  async processCardPayment(
    @Args('input') input: ProcessCardPaymentDto,
    @Context() context: any,
  ) {
    this.logger.log(`Processing card payment for customer ${input.customerId}`);

    // TODO: Add authentication and authorization checks
    // const userId = context.req.user?.id;

    const result = await this.paymentGateway.processCardPayment(
      PaymentGatewayProvider.STRIPE,
      {
        ...input,
        userId: 'SYSTEM', // TODO: Get from context
      },
    );

    return result;
  }

  @Mutation()
  async processACHPayment(
    @Args('input') input: ProcessACHPaymentDto,
    @Context() context: any,
  ) {
    this.logger.log(`Processing ACH payment for customer ${input.customerId}`);

    const result = await this.paymentGateway.processACHPayment(
      PaymentGatewayProvider.STRIPE,
      {
        ...input,
        userId: 'SYSTEM', // TODO: Get from context
      },
    );

    return result;
  }

  @Mutation()
  async savePaymentMethod(
    @Args('input') input: SavePaymentMethodDto,
    @Context() context: any,
  ) {
    this.logger.log(`Saving payment method for customer ${input.customerId}`);

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [input.tenantId]);

      // Get or create Stripe customer
      const customerResult = await client.query(
        `SELECT gateway_customer_id FROM customer_payment_methods
        WHERE tenant_id = $1 AND customer_id = $2 AND gateway_customer_id IS NOT NULL
        LIMIT 1`,
        [input.tenantId, input.customerId],
      );

      let stripeCustomerId: string;

      if (customerResult.rows.length > 0) {
        stripeCustomerId = customerResult.rows[0].gateway_customer_id;
      } else {
        // Get customer details
        const customer = await client.query(
          `SELECT email, company_name FROM customers WHERE id = $1 AND tenant_id = $2`,
          [input.customerId, input.tenantId],
        );

        if (customer.rows.length === 0) {
          throw new Error(`Customer not found: ${input.customerId}`);
        }

        // Create Stripe customer (using Stripe service)
        const stripeCustomer = await (this.stripeGateway as any).stripe.customers.create({
          email: customer.rows[0].email,
          name: customer.rows[0].company_name,
          metadata: {
            tenant_id: input.tenantId,
            customer_id: input.customerId,
          },
        });

        stripeCustomerId = stripeCustomer.id;
      }

      const paymentMethod = await this.stripeGateway.savePaymentMethod(
        client,
        {
          ...input,
          userId: 'SYSTEM', // TODO: Get from context
        },
        stripeCustomerId,
      );

      await client.query('COMMIT');
      return paymentMethod;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  @Mutation()
  async removePaymentMethod(
    @Args('tenantId') tenantId: string,
    @Args('paymentMethodId') paymentMethodId: string,
    @Context() context: any,
  ) {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // Soft delete payment method
      const result = await client.query(
        `UPDATE customer_payment_methods
        SET deleted_at = NOW(), updated_at = NOW(), updated_by = $1
        WHERE id = $2 AND tenant_id = $3
        RETURNING id`,
        ['SYSTEM', paymentMethodId, tenantId], // TODO: Get user ID from context
      );

      if (result.rows.length === 0) {
        throw new Error(`Payment method not found: ${paymentMethodId}`);
      }

      this.logger.log(`Payment method removed: ${paymentMethodId}`);
      return true;

    } finally {
      client.release();
    }
  }

  @Mutation()
  async verifyBankAccount(
    @Args('input') input: VerifyBankAccountDto,
    @Context() context: any,
  ) {
    this.logger.log(`Verifying bank account for customer ${input.customerId}`);

    const result = await this.stripeGateway.verifyBankAccount({
      ...input,
      userId: 'SYSTEM', // TODO: Get from context
    });

    return result;
  }

  @Mutation()
  async refundPayment(
    @Args('input') input: RefundPaymentDto,
    @Context() context: any,
  ) {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [input.tenantId]);

      // Get payment and gateway transaction
      const paymentResult = await client.query(
        `SELECT p.*, pgt.gateway_transaction_id, pgt.gateway_provider
        FROM payments p
        JOIN payment_gateway_transactions pgt ON p.id = pgt.payment_id
        WHERE p.id = $1 AND p.tenant_id = $2
        LIMIT 1`,
        [input.paymentId, input.tenantId],
      );

      if (paymentResult.rows.length === 0) {
        throw new Error(`Payment not found: ${input.paymentId}`);
      }

      const payment = paymentResult.rows[0];

      // Create refund via payment gateway
      const refund = await this.paymentGateway.createRefund(
        payment.gateway_provider,
        payment.gateway_transaction_id,
        input.amount,
        input.reason,
      );

      // Log refund transaction
      await client.query(
        `INSERT INTO payment_gateway_transactions (
          tenant_id, payment_id, gateway_provider, gateway_transaction_id,
          transaction_type, amount, currency_code, status, gateway_raw_response,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          input.tenantId,
          input.paymentId,
          payment.gateway_provider,
          refund.id,
          'REFUND',
          input.amount || payment.payment_amount,
          payment.payment_currency_code,
          'SUCCEEDED',
          refund,
          'SYSTEM', // TODO: Get from context
        ],
      );

      // TODO: Reverse payment applications (integrate with PaymentService)

      await client.query('COMMIT');

      return {
        success: true,
        gatewayTransaction: {
          id: refund.id,
          status: 'SUCCEEDED',
          transactionType: 'REFUND',
        },
      };

    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Refund failed: ${errorMessage}`, errorStack);

      return {
        success: false,
        errorMessage,
      };

    } finally {
      client.release();
    }
  }
}
