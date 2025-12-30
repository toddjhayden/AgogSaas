/**
 * Payments Module
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * Payment Gateway Integration Module
 * - Stripe payment processing
 * - ACH payment processing
 * - Payment method management
 * - Webhook handling
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Pool } from 'pg';

// Services
import { StripeGatewayService } from './services/stripe-gateway.service';
import { PaymentGatewayService } from './services/payment-gateway.service';
import { WebhookHandlerService } from './services/webhook-handler.service';

// Controllers
import { WebhookController } from './controllers/webhook.controller';

// Resolvers
import { PaymentGatewayResolver } from '../../graphql/resolvers/payment-gateway.resolver';

// Import payment service from finance module
import { PaymentService } from '../finance/services/payment.service';
import { JournalEntryService } from '../finance/services/journal-entry.service';

@Module({
  imports: [
    ConfigModule,
  ],
  controllers: [
    WebhookController,
  ],
  providers: [
    // Database connection
    {
      provide: Pool,
      useFactory: () => {
        return new Pool({
          connectionString: process.env.DATABASE_URL,
          max: 20,
        });
      },
    },

    // Payment gateway services
    StripeGatewayService,
    PaymentGatewayService,
    WebhookHandlerService,

    // Finance services (dependencies)
    PaymentService,
    JournalEntryService,

    // GraphQL Resolver
    PaymentGatewayResolver,
  ],
  exports: [
    StripeGatewayService,
    PaymentGatewayService,
    WebhookHandlerService,
  ],
})
export class PaymentsModule {}
