# Centralized Notification System

**REQ:** REQ-1767925582665-67qxb

## Overview

The Centralized Notification System provides a unified way to send notifications across the application through multiple delivery channels (Email, In-App, NATS) with user preferences and template management.

## Architecture

### Components

1. **NotificationService** - Core service for creating and managing notifications
2. **NotificationDeliveryService** - Handles delivery through multiple channels
3. **NotificationTemplateService** - Manages notification templates and variable substitution
4. **NotificationPreferencesService** - Manages user notification preferences and quiet hours
5. **AlertNotificationHelper** - Helper functions to integrate existing alert services

### Delivery Channels

- **EMAIL** - Email delivery using SMTP (Nodemailer)
- **IN_APP** - In-application notifications (stored in database)
- **NATS** - Real-time messaging via NATS pub/sub

## Database Schema

### Core Tables

- `notification_types` - Defines all notification types
- `notification_templates` - Templates for each notification type and channel
- `notifications` - Central repository for all notifications
- `notification_deliveries` - Tracks delivery attempts across channels
- `notification_events` - Audit trail for notification lifecycle
- `user_notification_preferences` - User-specific channel preferences and quiet hours

## Usage

### Basic Notification Creation

```typescript
import { NotificationService } from './modules/notifications/services/notification.service';

// Inject the service
constructor(private readonly notificationService: NotificationService) {}

// Create a notification
const notificationId = await this.notificationService.createNotification({
  tenantId: 'tenant-123',
  userId: 'user-456',
  notificationTypeCode: 'VENDOR_PERFORMANCE_ALERT',
  title: 'Vendor Alert: Acme Corp',
  message: 'Quality performance is below acceptable threshold',
  severity: 'WARNING',
  priority: 'HIGH',
  category: 'VENDOR',
  sourceEntityType: 'VendorAlert',
  sourceEntityId: 'vendor-789',
  metadata: {
    vendorCode: 'ACME',
    metricCategory: 'QUALITY',
    currentValue: 65,
    thresholdValue: 70,
  },
  expiresInHours: 720, // 30 days
  channels: ['EMAIL', 'IN_APP'],
  templateVariables: {
    vendorName: 'Acme Corp',
    vendorCode: 'ACME',
    severity: 'WARNING',
    message: 'Quality performance is below acceptable threshold',
    currentValue: '65.0',
    thresholdValue: '70.0',
    actionUrl: '/vendors/vendor-789/alerts',
  },
});
```

### Using Alert Helper (Recommended for Existing Services)

```typescript
import { AlertNotificationHelper } from './modules/notifications/helpers/alert-notification.helper';

// Inject the helper
constructor(private readonly alertHelper: AlertNotificationHelper) {}

// Vendor performance alert
await this.alertHelper.notifyVendorAlert(
  tenantId,
  userId,
  {
    vendorId: 'vendor-123',
    vendorName: 'Acme Corp',
    vendorCode: 'ACME',
    alertType: 'THRESHOLD_BREACH',
    severity: 'WARNING',
    message: 'Quality performance is below acceptable threshold',
    currentValue: 65,
    thresholdValue: 70,
    metricCategory: 'QUALITY',
  }
);

// Predictive maintenance alert
await this.alertHelper.notifyMaintenanceAlert(
  tenantId,
  userId,
  {
    workCenterId: 'wc-456',
    workCenterName: 'Printing Press #2',
    urgency: 'URGENT',
    predictedFailureMode: 'BEARING_FAILURE',
    failureProbability: 0.85,
    timeToFailureHours: 72,
    recommendedAction: 'Schedule maintenance within 24-48 hours',
  }
);

// Approval request
await this.alertHelper.notifyApprovalRequest(
  tenantId,
  userId,
  {
    entityType: 'Purchase Order',
    entityId: 'po-789',
    entityNumber: 'PO-2024-001',
    amount: '$15,000.00',
    requesterName: 'John Smith',
    dueDate: '2024-01-15',
    description: 'Office supplies and equipment',
  }
);
```

### GraphQL Queries and Mutations

```graphql
# Get my notifications
query {
  myNotifications(unreadOnly: true, limit: 20) {
    notifications {
      id
      title
      message
      severity
      priority
      isRead
      createdAt
    }
    total
    hasMore
  }
}

# Get unread count
query {
  myUnreadCount
}

# Mark notification as read
mutation {
  markNotificationRead(id: "notification-123")
}

# Update notification preferences
mutation {
  updateNotificationPreference(input: {
    notificationTypeCode: "VENDOR_PERFORMANCE_ALERT"
    channel: "EMAIL"
    isEnabled: false
  })
}

# Set quiet hours
mutation {
  setQuietHours(input: {
    startTime: "22:00:00"
    endTime: "08:00:00"
  })
}
```

## Notification Types

Pre-configured notification types:

- `VENDOR_PERFORMANCE_ALERT` - Vendor performance monitoring alerts
- `VENDOR_ESG_ALERT` - ESG risk and audit alerts
- `PREDICTIVE_MAINTENANCE_ALERT` - AI-driven maintenance predictions
- `APPROVAL_REQUEST` - Purchase order and workflow approvals
- `APPROVAL_DECISION` - Approval/rejection notifications
- `DEPLOYMENT_ALERT` - DevOps deployment notifications
- `SYSTEM_ALERT` - Critical system errors and warnings
- `INVOICE_REMINDER` - Payment due date reminders
- `ORDER_STATUS_CHANGE` - Purchase order status updates
- `QUALITY_ALERT` - SPC and quality control alerts
- `INVENTORY_ALERT` - Low stock and reorder alerts
- `WORKFLOW_TASK_ASSIGNED` - New task assignments
- `WORKFLOW_TASK_COMPLETED` - Task completion notifications

## Integration with Existing Services

### Vendor Alert Engine Integration

The vendor alert engine already publishes to NATS. To integrate with the centralized notification system:

```typescript
import { AlertNotificationHelper } from '../notifications/helpers/alert-notification.helper';

constructor(
  @Inject('DATABASE_POOL') private readonly db: Pool,
  private readonly alertHelper: AlertNotificationHelper, // Add this
) {}

async generateAlert(alert: PerformanceAlert): Promise<string> {
  // ... existing code to save alert to database ...

  // Get users who should be notified (e.g., procurement managers)
  const usersToNotify = await this.getUsersToNotify(alert.tenantId);

  // Send notifications to all relevant users
  for (const userId of usersToNotify) {
    await this.alertHelper.notifyVendorAlert(
      alert.tenantId,
      userId,
      {
        vendorId: alert.vendorId,
        vendorName: vendorInfo.name,
        vendorCode: vendorInfo.code,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        currentValue: alert.currentValue,
        thresholdValue: alert.thresholdValue,
        metricCategory: alert.metricCategory,
      }
    );
  }

  return alertId;
}
```

## Template Management

Templates use {{variableName}} syntax for variable substitution:

```typescript
// Create/update a template
await templateService.upsertTemplate(
  tenantId,
  'VENDOR_PERFORMANCE_ALERT',
  'EMAIL',
  'Vendor Alert: {{vendorName}} - {{severity}}',
  `<h2>Vendor Performance Alert</h2>
   <p><strong>Vendor:</strong> {{vendorName}} ({{vendorCode}})</p>
   <p><strong>Severity:</strong> {{severity}}</p>
   <p><strong>Message:</strong> {{message}}</p>
   <hr>
   <p><a href="{{actionUrl}}">View Alert Details</a></p>`,
  ['vendorName', 'vendorCode', 'severity', 'message', 'actionUrl']
);
```

## User Preferences

Users can:
- Enable/disable specific notification types per channel
- Set quiet hours (notifications won't be sent during these hours, except CRITICAL priority)
- Configure which channels to use (EMAIL, IN_APP, NATS)

## Delivery Tracking

All delivery attempts are tracked in `notification_deliveries`:
- Status: PENDING, SENDING, DELIVERED, FAILED, SKIPPED
- Attempt count and timestamps
- Error messages for failed deliveries
- External service IDs (e.g., email message IDs)

## Audit Trail

All notification events are logged in `notification_events`:
- CREATED - Notification created
- READ - User marked as read
- ARCHIVED - User archived notification
- DELIVERED - Successfully delivered through a channel
- FAILED - Delivery failed

## Row Level Security (RLS)

All notification tables enforce RLS policies for tenant isolation and user access control.

## Future Enhancements

- SMS delivery channel
- Push notification support
- Notification aggregation (batch multiple similar notifications)
- Smart notification scheduling
- Machine learning for optimal delivery times
- Notification analytics and insights
