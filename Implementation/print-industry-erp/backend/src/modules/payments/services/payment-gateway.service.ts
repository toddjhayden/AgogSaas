/**
 * Payment Gateway Service (Abstraction Layer)
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * Provides a unified interface for multiple payment gateways
 * Currently supports: Stripe
 * Future: PayPal, Square, Braintree
 */

import { Injectable, Logger } from '@nestjs/common';
import { StripeGatewayService } from './stripe-gateway.service';
import {
  ProcessCardPaymentDto,
  ProcessACHPaymentDto,
  SavePaymentMethodDto,
  VerifyBankAccountDto,
  RefundPaymentDto,
  PaymentResult,
  PaymentGatewayProvider,
} from '../dto/payment-gateway.dto';

/**
 * Interface that all payment gateway providers must implement
 */
export interface IPaymentGatewayProvider {
  processCardPayment(dto: ProcessCardPaymentDto): Promise<PaymentResult>;
  processACHPayment(dto: ProcessACHPaymentDto): Promise<PaymentResult>;
  savePaymentMethod(client: any, dto: SavePaymentMethodDto, stripeCustomerId: string): Promise<any>;
  verifyBankAccount(dto: VerifyBankAccountDto): Promise<any>;
  createRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<any>;
  validateWebhookSignature(payload: string, signature: string): boolean;
  constructWebhookEvent(payload: string, signature: string): any;
}

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private providers: Map<string, IPaymentGatewayProvider> = new Map();

  constructor(
    private readonly stripeGateway: StripeGatewayService,
  ) {
    // Register payment gateway providers
    this.providers.set(PaymentGatewayProvider.STRIPE, this.stripeGateway as any);
    this.logger.log(`Registered payment gateway providers: ${Array.from(this.providers.keys()).join(', ')}`);
  }

  /**
   * Process card payment through specified gateway
   */
  async processCardPayment(
    provider: string,
    dto: ProcessCardPaymentDto,
  ): Promise<PaymentResult> {
    const gateway = this.getProvider(provider);
    this.logger.log(`Processing card payment via ${provider}`);
    return gateway.processCardPayment(dto);
  }

  /**
   * Process ACH payment through specified gateway
   */
  async processACHPayment(
    provider: string,
    dto: ProcessACHPaymentDto,
  ): Promise<PaymentResult> {
    const gateway = this.getProvider(provider);
    this.logger.log(`Processing ACH payment via ${provider}`);
    return gateway.processACHPayment(dto);
  }

  /**
   * Verify bank account
   */
  async verifyBankAccount(
    provider: string,
    dto: VerifyBankAccountDto,
  ): Promise<any> {
    const gateway = this.getProvider(provider);
    return gateway.verifyBankAccount(dto);
  }

  /**
   * Create refund
   */
  async createRefund(
    provider: string,
    paymentIntentId: string,
    amount?: number,
    reason?: string,
  ): Promise<any> {
    const gateway = this.getProvider(provider);
    this.logger.log(`Creating refund via ${provider} for payment ${paymentIntentId}`);
    return gateway.createRefund(paymentIntentId, amount, reason);
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(provider: string, payload: string, signature: string): boolean {
    const gateway = this.getProvider(provider);
    return gateway.validateWebhookSignature(payload, signature);
  }

  /**
   * Construct webhook event
   */
  constructWebhookEvent(provider: string, payload: string, signature: string): any {
    const gateway = this.getProvider(provider);
    return gateway.constructWebhookEvent(payload, signature);
  }

  /**
   * Get payment gateway provider
   */
  private getProvider(provider: string): IPaymentGatewayProvider {
    const gateway = this.providers.get(provider);
    if (!gateway) {
      throw new Error(`Payment gateway provider not supported: ${provider}`);
    }
    return gateway;
  }

  /**
   * Get list of supported providers
   */
  getSupportedProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
