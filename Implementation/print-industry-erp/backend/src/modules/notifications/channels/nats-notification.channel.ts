/**
 * NATS Notification Channel
 * REQ: REQ-1767925582665-67qxb
 *
 * Delivers notifications via NATS messaging for real-time updates.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { connect, NatsConnection, JSONCodec } from 'nats';

@Injectable()
export class NatsNotificationChannel implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsNotificationChannel.name);
  private nc?: NatsConnection;
  private jc = JSONCodec();

  async onModuleInit() {
    try {
      const natsUrl = process.env.NATS_URL || 'nats://nats:4222';
      const user = process.env.NATS_USER;
      const pass = process.env.NATS_PASSWORD;

      this.nc = await connect({
        servers: natsUrl,
        user,
        pass,
        name: 'notification-nats-channel',
      });

      this.logger.log('Connected to NATS for notification delivery');
    } catch (error: any) {
      this.logger.error('Failed to connect to NATS:', error.message);
      this.logger.error('NATS notification channel will not be available');
      process.exit(1);
    }
  }

  async onModuleDestroy() {
    if (this.nc) {
      await this.nc.close();
    }
  }

  /**
   * Send notification via NATS
   */
  async send(
    recipientAddress: string,
    subject: string,
    body: string,
    metadata?: Record<string, any>,
  ): Promise<string | null> {
    if (!this.nc) {
      this.logger.error('NATS connection not available');
      process.exit(1);
    }

    try {
      const payload = {
        subject,
        body,
        metadata,
        timestamp: new Date().toISOString(),
      };

      this.nc.publish(recipientAddress, this.jc.encode(payload));

      this.logger.log(`NATS notification published to ${recipientAddress}`);

      return null; // NATS doesn't return external ID
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to publish to NATS topic ${recipientAddress}:`, error);
      throw new Error(`NATS delivery failed: ${errorMessage}`);
    }
  }
}
