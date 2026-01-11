/**
 * Notifications Module
 * REQ: REQ-1767925582665-67qxb
 *
 * Centralized notification system for all application alerts and messages.
 * Supports multiple delivery channels (email, in-app, NATS) with user preferences.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { NotificationService } from './services/notification.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { EmailNotificationChannel } from './channels/email-notification.channel';
import { InAppNotificationChannel } from './channels/in-app-notification.channel';
import { NatsNotificationChannel } from './channels/nats-notification.channel';
import { NotificationResolver } from './notification.resolver';
import { AlertNotificationHelper } from './helpers/alert-notification.helper';

@Module({
  imports: [DatabaseModule],
  providers: [
    NotificationService,
    NotificationDeliveryService,
    NotificationTemplateService,
    NotificationPreferencesService,
    EmailNotificationChannel,
    InAppNotificationChannel,
    NatsNotificationChannel,
    NotificationResolver,
    AlertNotificationHelper,
  ],
  exports: [
    NotificationService,
    NotificationDeliveryService,
    NotificationTemplateService,
    NotificationPreferencesService,
    AlertNotificationHelper,
  ],
})
export class NotificationsModule {}
