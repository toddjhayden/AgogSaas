/**
 * In-App Notification Channel
 * REQ: REQ-1767925582665-67qxb
 *
 * Delivers notifications within the application (already stored in database).
 */

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class InAppNotificationChannel {
  private readonly logger = new Logger(InAppNotificationChannel.name);

  /**
   * Send notification via in-app (no-op since notification is already in database)
   */
  async send(
    recipientAddress: string,
    subject: string,
    body: string,
    metadata?: Record<string, any>,
  ): Promise<string | null> {
    // In-app notifications are already stored in the notifications table
    // This channel just logs successful delivery
    this.logger.log(`In-app notification delivered to user ${recipientAddress}`);
    return null; // No external ID for in-app
  }
}
