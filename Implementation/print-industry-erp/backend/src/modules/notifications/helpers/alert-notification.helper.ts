/**
 * Alert Notification Helper
 * REQ: REQ-1767925582665-67qxb
 *
 * Helper functions to integrate existing alert services with the notification system.
 */

import { Injectable } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class AlertNotificationHelper {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Create notification from vendor performance alert
   */
  async notifyVendorAlert(
    tenantId: string,
    userId: string,
    alert: {
      vendorId: string;
      vendorName: string;
      vendorCode: string;
      alertType: string;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      message: string;
      currentValue?: number;
      thresholdValue?: number;
      metricCategory?: string;
    },
  ): Promise<string> {
    const severityMap = {
      CRITICAL: 'CRITICAL' as const,
      WARNING: 'WARNING' as const,
      INFO: 'INFO' as const,
    };

    return this.notificationService.createNotification({
      tenantId,
      userId,
      notificationTypeCode:
        alert.alertType === 'ESG_RISK'
          ? 'VENDOR_ESG_ALERT'
          : 'VENDOR_PERFORMANCE_ALERT',
      title: `Vendor Alert: ${alert.vendorName}`,
      message: alert.message,
      severity: severityMap[alert.severity],
      priority: alert.severity === 'CRITICAL' ? 'HIGH' : 'NORMAL',
      category: 'VENDOR',
      sourceEntityType: 'VendorAlert',
      sourceEntityId: alert.vendorId,
      metadata: {
        vendorId: alert.vendorId,
        vendorCode: alert.vendorCode,
        alertType: alert.alertType,
        metricCategory: alert.metricCategory,
        currentValue: alert.currentValue,
        thresholdValue: alert.thresholdValue,
      },
      expiresInHours: 720, // 30 days
      templateVariables: {
        vendorName: alert.vendorName,
        vendorCode: alert.vendorCode,
        severity: alert.severity,
        alertType: alert.alertType,
        message: alert.message,
        currentValue: alert.currentValue?.toFixed(1) || 'N/A',
        thresholdValue: alert.thresholdValue?.toFixed(1) || 'N/A',
        actionUrl: `/vendors/${alert.vendorId}/alerts`,
      },
    });
  }

  /**
   * Create notification from predictive maintenance alert
   */
  async notifyMaintenanceAlert(
    tenantId: string,
    userId: string,
    alert: {
      workCenterId: string;
      workCenterName: string;
      urgency: string;
      predictedFailureMode: string;
      failureProbability: number;
      timeToFailureHours: number;
      recommendedAction: string;
    },
  ): Promise<string> {
    const urgencyToSeverity: Record<string, 'CRITICAL' | 'WARNING' | 'INFO'> = {
      IMMEDIATE: 'CRITICAL',
      URGENT: 'CRITICAL',
      SOON: 'WARNING',
      ROUTINE: 'INFO',
    };

    return this.notificationService.createNotification({
      tenantId,
      userId,
      notificationTypeCode: 'PREDICTIVE_MAINTENANCE_ALERT',
      title: `Maintenance Alert: ${alert.workCenterName}`,
      message: `${alert.predictedFailureMode} predicted. ${alert.recommendedAction}`,
      severity: urgencyToSeverity[alert.urgency] || 'WARNING',
      priority: alert.urgency === 'IMMEDIATE' ? 'CRITICAL' : 'HIGH',
      category: 'MAINTENANCE',
      sourceEntityType: 'MaintenanceAlert',
      sourceEntityId: alert.workCenterId,
      metadata: {
        workCenterId: alert.workCenterId,
        urgency: alert.urgency,
        predictedFailureMode: alert.predictedFailureMode,
        failureProbability: alert.failureProbability,
        timeToFailureHours: alert.timeToFailureHours,
      },
      expiresInHours: alert.timeToFailureHours,
      templateVariables: {
        workCenterName: alert.workCenterName,
        urgency: alert.urgency,
        failureMode: alert.predictedFailureMode,
        failureProbability: (alert.failureProbability * 100).toFixed(1),
        timeToFailure: alert.timeToFailureHours.toFixed(0),
        recommendedAction: alert.recommendedAction,
        actionUrl: `/maintenance/work-centers/${alert.workCenterId}/alerts`,
      },
    });
  }

  /**
   * Create notification for approval request
   */
  async notifyApprovalRequest(
    tenantId: string,
    userId: string,
    request: {
      entityType: string;
      entityId: string;
      entityNumber: string;
      amount: string;
      requesterName: string;
      dueDate: string;
      description: string;
    },
  ): Promise<string> {
    return this.notificationService.createNotification({
      tenantId,
      userId,
      notificationTypeCode: 'APPROVAL_REQUEST',
      title: `Approval Required: ${request.entityType} #${request.entityNumber}`,
      message: `${request.requesterName} has requested approval for ${request.entityType} #${request.entityNumber} (${request.amount})`,
      severity: 'INFO',
      priority: 'HIGH',
      category: 'APPROVAL',
      sourceEntityType: request.entityType,
      sourceEntityId: request.entityId,
      metadata: {
        amount: request.amount,
        requesterName: request.requesterName,
        dueDate: request.dueDate,
      },
      templateVariables: {
        entityType: request.entityType,
        entityNumber: request.entityNumber,
        amount: request.amount,
        requesterName: request.requesterName,
        dueDate: request.dueDate,
        description: request.description,
        actionUrl: `/approvals/${request.entityId}`,
      },
    });
  }

  /**
   * Create notification for quality alert
   */
  async notifyQualityAlert(
    tenantId: string,
    userId: string,
    alert: {
      processId: string;
      processName: string;
      metric: string;
      value: number;
      controlLimit: number;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      message: string;
    },
  ): Promise<string> {
    return this.notificationService.createNotification({
      tenantId,
      userId,
      notificationTypeCode: 'QUALITY_ALERT',
      title: `Quality Alert: ${alert.processName}`,
      message: alert.message,
      severity: alert.severity,
      priority: alert.severity === 'CRITICAL' ? 'HIGH' : 'NORMAL',
      category: 'QUALITY',
      sourceEntityType: 'QualityAlert',
      sourceEntityId: alert.processId,
      metadata: {
        processId: alert.processId,
        metric: alert.metric,
        value: alert.value,
        controlLimit: alert.controlLimit,
      },
      expiresInHours: 168, // 7 days
    });
  }

  /**
   * Create notification for system alert
   */
  async notifySystemAlert(
    tenantId: string,
    userId: string,
    alert: {
      title: string;
      message: string;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      component?: string;
    },
  ): Promise<string> {
    return this.notificationService.createNotification({
      tenantId,
      userId,
      notificationTypeCode: 'SYSTEM_ALERT',
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      priority: alert.severity === 'CRITICAL' ? 'CRITICAL' : 'NORMAL',
      category: 'SYSTEM',
      metadata: {
        component: alert.component,
      },
      expiresInHours: 24,
    });
  }
}
