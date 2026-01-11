/**
 * Notification Resolver
 * REQ: REQ-1767925582665-67qxb
 *
 * GraphQL resolver for notification queries and mutations.
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationService } from './services/notification.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';

@Resolver('Notification')
@UseGuards(JwtAuthGuard)
export class NotificationResolver {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Query('myNotifications')
  async getMyNotifications(
    @Args('unreadOnly') unreadOnly: boolean,
    @Args('limit') limit: number,
    @Args('offset') offset: number,
    @Args('category') category: string,
    @Args('severity') severity: string,
    @Context() context: any,
  ) {
    const { tenantId, userId } = context.req.user;

    const result = await this.notificationService.getUserNotifications(
      tenantId,
      userId,
      {
        unreadOnly,
        limit,
        offset,
        category,
        severity,
      },
    );

    return {
      notifications: result.notifications,
      total: result.total,
      hasMore: result.total > (offset || 0) + (limit || 50),
    };
  }

  @Query('myUnreadCount')
  async getMyUnreadCount(@Context() context: any) {
    const { tenantId, userId } = context.req.user;
    return this.notificationService.getUnreadCount(tenantId, userId);
  }

  @Query('myNotificationStats')
  async getMyNotificationStats(@Context() context: any) {
    const { tenantId, userId } = context.req.user;

    const total = await this.notificationService.getUserNotifications(
      tenantId,
      userId,
      {},
    );
    const unread = await this.notificationService.getUnreadCount(tenantId, userId);

    const criticalResult = await this.notificationService.getUserNotifications(
      tenantId,
      userId,
      { severity: 'CRITICAL', unreadOnly: true },
    );
    const warningResult = await this.notificationService.getUserNotifications(
      tenantId,
      userId,
      { severity: 'WARNING', unreadOnly: true },
    );
    const infoResult = await this.notificationService.getUserNotifications(
      tenantId,
      userId,
      { severity: 'INFO', unreadOnly: true },
    );

    return {
      unreadCount: unread,
      totalCount: total.total,
      criticalCount: criticalResult.total,
      warningCount: warningResult.total,
      infoCount: infoResult.total,
    };
  }

  @Query('notification')
  async getNotification(@Args('id') id: string, @Context() context: any) {
    const { tenantId } = context.req.user;
    return this.notificationService.getNotificationById(tenantId, id);
  }

  @Query('myNotificationPreferences')
  async getMyNotificationPreferences(@Context() context: any) {
    const { tenantId, userId } = context.req.user;
    return this.preferencesService.getUserPreferences(tenantId, userId);
  }

  @Mutation('createNotification')
  async createNotification(@Args('input') input: any, @Context() context: any) {
    const { tenantId } = context.req.user;

    const notificationId = await this.notificationService.createNotification({
      tenantId,
      ...input,
    });

    return this.notificationService.getNotificationById(tenantId, notificationId);
  }

  @Mutation('markNotificationRead')
  async markNotificationRead(@Args('id') id: string, @Context() context: any) {
    const { tenantId, userId } = context.req.user;
    await this.notificationService.markAsRead(tenantId, userId, id);
    return true;
  }

  @Mutation('markAllNotificationsRead')
  async markAllNotificationsRead(@Context() context: any) {
    const { tenantId, userId } = context.req.user;
    return this.notificationService.markAllAsRead(tenantId, userId);
  }

  @Mutation('archiveNotification')
  async archiveNotification(@Args('id') id: string, @Context() context: any) {
    const { tenantId, userId } = context.req.user;
    await this.notificationService.archiveNotification(tenantId, userId, id);
    return true;
  }

  @Mutation('deleteNotification')
  async deleteNotification(@Args('id') id: string, @Context() context: any) {
    const { tenantId, userId } = context.req.user;
    await this.notificationService.deleteNotification(tenantId, userId, id);
    return true;
  }

  @Mutation('updateNotificationPreference')
  async updateNotificationPreference(
    @Args('input') input: any,
    @Context() context: any,
  ) {
    const { tenantId, userId } = context.req.user;
    await this.preferencesService.updatePreference(
      tenantId,
      userId,
      input.notificationTypeCode,
      input.channel,
      input.isEnabled,
    );
    return true;
  }

  @Mutation('setQuietHours')
  async setQuietHours(@Args('input') input: any, @Context() context: any) {
    const { tenantId, userId } = context.req.user;
    await this.preferencesService.setQuietHours(
      tenantId,
      userId,
      input.startTime,
      input.endTime,
    );
    return true;
  }
}
