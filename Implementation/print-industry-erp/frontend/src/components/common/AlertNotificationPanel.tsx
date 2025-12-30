import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import { useMutation } from '@apollo/client';
import { ACKNOWLEDGE_ALERT, RESOLVE_ALERT } from '../../graphql/queries/vendorScorecard';

export interface VendorAlert {
  id: string;
  vendorId: string;
  vendorCode?: string;
  vendorName?: string;
  alertType: 'CRITICAL' | 'WARNING' | 'TREND';
  alertCategory: 'OTD' | 'QUALITY' | 'RATING' | 'COMPLIANCE';
  alertMessage: string;
  metricValue?: number;
  thresholdValue?: number;
  alertStatus: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  acknowledgedAt?: string;
  acknowledgedByUserId?: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  dismissalReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AlertNotificationPanelProps {
  alerts: VendorAlert[];
  tenantId: string;
  onAlertUpdate?: () => void;
  maxHeight?: number;
  className?: string;
}

const SEVERITY_CONFIG = {
  CRITICAL: {
    icon: AlertTriangle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
    badgeColor: 'bg-red-100 text-red-800'
  },
  WARNING: {
    icon: AlertCircle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    iconColor: 'text-yellow-600',
    badgeColor: 'bg-yellow-100 text-yellow-800'
  },
  TREND: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
    badgeColor: 'bg-blue-100 text-blue-800'
  }
};

/**
 * AlertNotificationPanel - Displays and manages vendor performance alerts
 *
 * Features:
 * - Color-coded by severity (CRITICAL/WARNING/INFO)
 * - Acknowledge action (mark as seen)
 * - Resolve action (close with resolution notes)
 * - Filter by status and severity
 * - Auto-refresh after actions
 *
 * Alert Types:
 * - THRESHOLD_BREACH: Performance dropped below threshold
 * - TIER_CHANGE: Vendor tier classification changed
 * - ESG_RISK: ESG risk level increased
 * - REVIEW_DUE: Audit or review overdue
 */
export const AlertNotificationPanel: React.FC<AlertNotificationPanelProps> = ({
  alerts,
  tenantId,
  onAlertUpdate,
  maxHeight = 600,
  className
}) => {
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [resolutionNotes, setResolutionNotes] = useState<{ [key: string]: string }>({});
  const [acknowledgeNotes, setAcknowledgeNotes] = useState<{ [key: string]: string }>({});

  const [acknowledgeAlert, { loading: acknowledging }] = useMutation(ACKNOWLEDGE_ALERT);
  const [resolveAlert, { loading: resolving }] = useMutation(RESOLVE_ALERT);

  const toggleExpand = (alertId: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert({
        variables: {
          tenantId,
          input: {
            alertId,
            acknowledgedByUserId: 'current-user-id' // TODO: Get from auth context
          }
        }
      });

      setAcknowledgeNotes((prev) => {
        const updated = { ...prev };
        delete updated[alertId];
        return updated;
      });

      onAlertUpdate?.();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolve = async (alertId: string) => {
    const notes = resolutionNotes[alertId];
    if (!notes || notes.trim().length < 10) {
      alert('Please provide resolution notes (minimum 10 characters)');
      return;
    }

    try {
      await resolveAlert({
        variables: {
          tenantId,
          input: {
            alertId,
            resolvedByUserId: 'current-user-id', // TODO: Get from auth context
            resolutionNotes: notes
          }
        }
      });

      setResolutionNotes((prev) => {
        const updated = { ...prev };
        delete updated[alertId];
        return updated;
      });

      setExpandedAlerts((prev) => {
        const updated = new Set(prev);
        updated.delete(alertId);
        return updated;
      });

      onAlertUpdate?.();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  if (!alerts || alerts.length === 0) {
    return (
      <div className={clsx('card', className)}>
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Performance Alerts</h3>
        </div>
        <div className="text-center py-8 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-green-900">No Active Alerts</p>
          <p className="text-xs text-green-700 mt-1">All vendors are performing within acceptable thresholds</p>
        </div>
      </div>
    );
  }

  const openAlerts = alerts.filter((a) => a.alertStatus === 'ACTIVE');
  const criticalCount = openAlerts.filter((a) => a.alertType === 'CRITICAL').length;
  const warningCount = openAlerts.filter((a) => a.alertType === 'WARNING').length;

  return (
    <div className={clsx('card', className)}>
      {/* Header with Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">Performance Alerts</h3>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {warningCount} Warning
            </span>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-3" style={{ maxHeight, overflowY: 'auto' }}>
        {alerts.map((alert) => {
          const config = SEVERITY_CONFIG[alert.alertType];
          const Icon = config.icon;
          const isExpanded = expandedAlerts.has(alert.id);

          return (
            <div key={alert.id} className={clsx('rounded-lg border p-4', config.bgColor, config.borderColor)}>
              {/* Alert Header */}
              <div className="flex items-start gap-3">
                <Icon className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', config.iconColor)} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.badgeColor)}>
                          {alert.alertType}
                        </span>
                        <span className="text-xs text-gray-500">{alert.alertCategory}</span>
                      </div>

                      <p className="text-sm font-medium text-gray-900 mb-1">{alert.alertMessage}</p>

                      {alert.vendorName && (
                        <p className="text-xs text-gray-600">
                          Vendor: <span className="font-medium">{alert.vendorName}</span> ({alert.vendorCode})
                        </p>
                      )}

                      {alert.alertCategory && (
                        <div className="text-xs text-gray-600 mt-1">
                          {alert.alertCategory}: {alert.metricValue?.toFixed(1)}
                          {alert.thresholdValue && ` (Threshold: ${alert.thresholdValue.toFixed(1)})`}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => toggleExpand(alert.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                    >
                      {isExpanded ? 'Hide Actions' : 'Show Actions'}
                    </button>
                  </div>

                  {/* Expanded Actions */}
                  {isExpanded && alert.alertStatus === 'ACTIVE' && (
                    <div className="mt-4 space-y-3 bg-white rounded-lg p-3 border border-gray-200">
                      {/* Acknowledge Section */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">Acknowledge Alert (Optional Notes)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={acknowledgeNotes[alert.id] || ''}
                            onChange={(e) => setAcknowledgeNotes((prev) => ({ ...prev, [alert.id]: e.target.value }))}
                            placeholder="e.g., Reviewed, investigating root cause..."
                            className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={acknowledging}
                            className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                          >
                            {acknowledging ? 'Saving...' : 'Acknowledge'}
                          </button>
                        </div>
                      </div>

                      {/* Resolve Section (CRITICAL alerts require notes) */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">
                          Resolve Alert {alert.alertType === 'CRITICAL' && <span className="text-red-600">*</span>}
                        </label>
                        <div className="space-y-2">
                          <textarea
                            value={resolutionNotes[alert.id] || ''}
                            onChange={(e) => setResolutionNotes((prev) => ({ ...prev, [alert.id]: e.target.value }))}
                            placeholder="Resolution notes (min 10 characters)..."
                            rows={2}
                            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <button
                            onClick={() => handleResolve(alert.id)}
                            disabled={resolving}
                            className="w-full px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                          >
                            {resolving ? 'Saving...' : 'Resolve Alert'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Acknowledged/Resolved Status */}
                  {alert.alertStatus === 'ACKNOWLEDGED' && (
                    <div className="mt-2 text-xs text-gray-600">
                      Acknowledged {alert.acknowledgedAt && `on ${new Date(alert.acknowledgedAt).toLocaleString()}`}
                    </div>
                  )}

                  {alert.alertStatus === 'RESOLVED' && (
                    <div className="mt-2 text-xs text-green-700">
                      Resolved {alert.resolvedAt && `on ${new Date(alert.resolvedAt).toLocaleString()}`}
                      {alert.dismissalReason && `: ${alert.dismissalReason}`}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500 mt-2 text-right">
                {new Date(alert.createdAt).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
