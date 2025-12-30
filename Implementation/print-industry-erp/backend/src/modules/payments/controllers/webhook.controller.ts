/**
 * Webhook Controller
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * Handles incoming webhook requests from payment gateways
 */

import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhookHandlerService } from '../services/webhook-handler.service';
import { PaymentGatewayService } from '../services/payment-gateway.service';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookHandler: WebhookHandlerService,
    private readonly paymentGateway: PaymentGatewayService,
  ) {}

  /**
   * Handle Stripe webhook events
   * POST /webhooks/stripe
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    try {
      // Get raw body (must be string for signature validation)
      const payload = (req as any).rawBody || JSON.stringify(req.body);

      // Validate webhook signature
      const isValid = this.paymentGateway.validateWebhookSignature('STRIPE', payload, signature);
      if (!isValid) {
        this.logger.error('Invalid Stripe webhook signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }

      // Construct event
      const event = this.paymentGateway.constructWebhookEvent('STRIPE', payload, signature);

      this.logger.log(`Received Stripe webhook: ${event.type} (${event.id})`);

      // Process webhook asynchronously (don't block response)
      setImmediate(async () => {
        try {
          await this.webhookHandler.processStripeWebhook(event);
        } catch (error) {
          this.logger.error(`Webhook processing error: ${error.message}`, error.stack);
        }
      });

      // Return 200 OK immediately (within 5 seconds requirement)
      return { received: true };

    } catch (error) {
      this.logger.error(`Webhook handling failed: ${error.message}`, error.stack);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Still return 200 to prevent Stripe from retrying
      return { received: false };
    }
  }

  /**
   * Handle PayPal webhook events (future implementation)
   * POST /webhooks/paypal
   */
  @Post('paypal')
  @HttpCode(HttpStatus.OK)
  async handlePayPalWebhook(
    @Body() payload: any,
    @Headers('paypal-transmission-sig') signature: string,
  ): Promise<{ received: boolean }> {
    this.logger.log('PayPal webhook endpoint - not yet implemented');
    return { received: false };
  }
}
