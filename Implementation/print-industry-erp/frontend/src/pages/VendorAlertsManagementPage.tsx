/**
 * VENDOR ALERTS MANAGEMENT PAGE
 *
 * Purpose: Centralized vendor performance alerts management and monitoring
 * Feature: REQ-STRATEGIC-AUTO-1735262800000 - Vendor Scorecards
 * Author: Jen (Frontend Developer)
 * Date: 2026-01-03
 *
 * Features:
 * - Real-time performance alerts dashboard
 * - Filter by status, type, category, severity
 * - Acknowledge, resolve, and dismiss alerts
 * - Alert history and audit trail
 * - Vendor-specific alert filtering
 * - Severity-based prioritization
 * - Bulk actions support
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
// import { useTranslation } from 'react-i18next'; // TODO: Re-enable when translations are implemented
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingDown,
  Filter,
  Bell,
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { DataTable } from '../components/common/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import {
  GET_VENDOR_PERFORMANCE_ALERTS,
  ACKNOWLEDGE_ALERT,
  RESOLVE_ALERT,
  DISMISS_ALERT,
} from '../graphql/queries/vendorScorecard';
import { GET_VENDORS } from '../graphql/queries/purchaseOrders';

// TypeScript interfaces
interface VendorPerformanceAlert {
  id: string;
  tenantId: string;
  vendorId: string;
  alertType: 'THRESHOLD_BREACH' | 'TIER_CHANGE' | 'ESG_RISK' | 'REVIEW_DUE';
  alertCategory:
    | 'OTD'
    | 'QUALITY'
    | 'RATING'
    | 'COMPLIANCE'
    | 'ESG_RISK'
    | 'TIER_CLASSIFICATION'
    | 'OVERALL_SCORE'
    | 'DELIVERY'
    | 'COST'
    | 'SERVICE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  alertMessage: string;
  metricValue: number | null;
  thresholdValue: number | null;
  alertStatus: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  acknowledgedAt: string | null;
  acknowledgedByUserId: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  dismissalReason: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface Vendor {
  id: string;
  vendorCode: string;
  vendorName: string;
}

export const VendorAlertsManagementPage: React.FC = () => {
  // const { t } = useTranslation(); // TODO: Use translations instead of hardcoded strings
  const tenantId = 'tenant-default-001'; // TODO: Get from auth context
  const currentUserId = 'current-user-id'; // TODO: Get from auth context

  // Filter state
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('');

  // Modal state
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<VendorPerformanceAlert | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [dismissalReason, setDismissalReason] = useState('');

  // Fetch vendors for filter dropdown
  const { data: vendorsData } = useQuery<{ vendors: Vendor[] }>(GET_VENDORS, {
    variables: { tenantId, isActive: true, isApproved: true, limit: 100 },
  });

  // Fetch alerts
  const { data: alertsData, loading, refetch } = useQuery<{
    getVendorPerformanceAlerts: VendorPerformanceAlert[];
  }>(GET_VENDOR_PERFORMANCE_ALERTS, {
    variables: {
      tenantId,
      vendorId: selectedVendorId || undefined,
      alertStatus: selectedStatus || undefined,
      alertType: selectedType || undefined,
      alertCategory: selectedCategory || undefined,
      severity: selectedSeverity || undefined,
    },
    pollInterval: 30000, // Poll every 30 seconds for real-time updates
  });

  // Mutations
  const [acknowledgeAlert] = useMutation(ACKNOWLEDGE_ALERT);
  const [resolveAlert] = useMutation(RESOLVE_ALERT);
  const [dismissAlert] = useMutation(DISMISS_ALERT);

  const vendors = vendorsData?.vendors || [];
  const alerts = alertsData?.getVendorPerformanceAlerts || [];

  // Get vendor name helper
  const getVendorName = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor ? `${vendor.vendorCode} - ${vendor.vendorName}` : vendorId;
  };

  // Severity badge styling
  const getSeverityBadge = (severity: string) => {
    const styles = {
      INFO: 'bg-blue-100 text-blue-800',
      WARNING: 'bg-yellow-100 text-yellow-800',
      CRITICAL: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[severity as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {severity}
      </span>
    );
  };

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const styles = {
      ACTIVE: 'bg-red-100 text-red-800',
      ACKNOWLEDGED: 'bg-yellow-100 text-yellow-800',
      RESOLVED: 'bg-green-100 text-green-800',
      DISMISSED: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  // Handle acknowledge alert
  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert({
        variables: {
          tenantId,
          input: {
            alertId,
            acknowledgedByUserId: currentUserId,
          },
        },
      });
      refetch();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      alert('Failed to acknowledge alert. Please try again.');
    }
  };

  // Handle resolve alert
  const handleResolve = async () => {
    if (!selectedAlert) return;

    try {
      await resolveAlert({
        variables: {
          tenantId,
          input: {
            alertId: selectedAlert.id,
            resolvedByUserId: currentUserId,
            resolutionNotes,
          },
        },
      });
      setResolveModalOpen(false);
      setSelectedAlert(null);
      setResolutionNotes('');
      refetch();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      alert('Failed to resolve alert. Please try again.');
    }
  };

  // Handle dismiss alert
  const handleDismiss = async () => {
    if (!selectedAlert) return;

    if (!dismissalReason.trim()) {
      alert('Please provide a dismissal reason');
      return;
    }

    try {
      await dismissAlert({
        variables: {
          tenantId,
          input: {
            alertId: selectedAlert.id,
            dismissalReason,
          },
        },
      });
      setDismissModalOpen(false);
      setSelectedAlert(null);
      setDismissalReason('');
      refetch();
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
      alert('Failed to dismiss alert. Please try again.');
    }
  };

  // Alert statistics
  const activeCount = alerts.filter((a) => a.alertStatus === 'ACTIVE').length;
  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const acknowledgedCount = alerts.filter((a) => a.alertStatus === 'ACKNOWLEDGED').length;
  const resolvedCount = alerts.filter((a) => a.alertStatus === 'RESOLVED').length;

  // Table columns
  const columns: ColumnDef<VendorPerformanceAlert>[] = [
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: (info) => getSeverityBadge(info.getValue() as string),
    },
    {
      accessorKey: 'vendorId',
      header: 'Vendor',
      cell: (info) => getVendorName(info.getValue() as string),
    },
    {
      accessorKey: 'alertType',
      header: 'Type',
      cell: (info) => (info.getValue() as string).replace(/_/g, ' '),
    },
    {
      accessorKey: 'alertCategory',
      header: 'Category',
      cell: (info) => (info.getValue() as string).replace(/_/g, ' '),
    },
    {
      accessorKey: 'alertMessage',
      header: 'Message',
      cell: (info) => (
        <div className="max-w-md truncate" title={info.getValue() as string}>
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: 'metricValue',
      header: 'Metric',
      cell: (info) => {
        const value = info.getValue() as number | null;
        const threshold = info.row.original.thresholdValue;
        if (value === null) return '-';
        return (
          <div className="text-sm">
            <div className="font-medium">{value.toFixed(2)}</div>
            {threshold && (
              <div className="text-gray-500 text-xs">Threshold: {threshold.toFixed(2)}</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'alertStatus',
      header: 'Status',
      cell: (info) => getStatusBadge(info.getValue() as string),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: (info) => new Date(info.getValue() as string).toLocaleString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const alert = info.row.original;
        const canAcknowledge = alert.alertStatus === 'ACTIVE';
        const canResolve = ['ACTIVE', 'ACKNOWLEDGED'].includes(alert.alertStatus);

        return (
          <div className="flex gap-2">
            {canAcknowledge && (
              <button
                onClick={() => handleAcknowledge(alert.id)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                title="Acknowledge"
              >
                <CheckCircle className="w-4 h-4 inline mr-1" />
                Ack
              </button>
            )}
            {canResolve && (
              <button
                onClick={() => {
                  setSelectedAlert(alert);
                  setResolveModalOpen(true);
                }}
                className="text-green-600 hover:text-green-800 text-sm font-medium"
                title="Resolve"
              >
                <CheckCircle className="w-4 h-4 inline mr-1" />
                Resolve
              </button>
            )}
            {canResolve && (
              <button
                onClick={() => {
                  setSelectedAlert(alert);
                  setDismissModalOpen(true);
                }}
                className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                title="Dismiss"
              >
                <XCircle className="w-4 h-4 inline mr-1" />
                Dismiss
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Procurement', path: '/procurement/purchase-orders' },
          { label: 'Vendor Scorecards', path: '/procurement/vendor-scorecard-enhanced' },
          { label: 'Alerts Management', path: '/procurement/vendor-alerts' },
        ]}
      />

      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary-600" />
            Vendor Performance Alerts
          </h1>
          <p className="text-gray-600 mt-2">
            Monitor and manage vendor performance alerts and threshold breaches
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600 font-medium">Active Alerts</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{activeCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600 font-medium">Critical</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{criticalCount}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600 font-medium">Acknowledged</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{acknowledgedCount}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600 font-medium">Resolved</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{resolvedCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.vendorCode} - {vendor.vendorName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              <option value="THRESHOLD_BREACH">Threshold Breach</option>
              <option value="TIER_CHANGE">Tier Change</option>
              <option value="ESG_RISK">ESG Risk</option>
              <option value="REVIEW_DUE">Review Due</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Categories</option>
              <option value="OTD">On-Time Delivery</option>
              <option value="QUALITY">Quality</option>
              <option value="RATING">Rating</option>
              <option value="COMPLIANCE">Compliance</option>
              <option value="ESG_RISK">ESG Risk</option>
              <option value="TIER_CLASSIFICATION">Tier Classification</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Severities</option>
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Performance Alerts ({alerts.length})
          </h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading alerts...</p>
            </div>
          ) : alerts.length > 0 ? (
            <DataTable data={alerts} columns={columns} />
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Alerts</h3>
              <p className="text-gray-600">All vendor performance metrics are within acceptable thresholds.</p>
            </div>
          )}
        </div>
      </div>

      {/* Resolve Modal */}
      {resolveModalOpen && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Resolve Alert</h3>
            <p className="text-sm text-gray-600 mb-4">{selectedAlert.alertMessage}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resolution Notes (Optional)
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={4}
                placeholder="Describe how this alert was resolved..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setResolveModalOpen(false);
                  setSelectedAlert(null);
                  setResolutionNotes('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Resolve Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dismiss Modal */}
      {dismissModalOpen && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Dismiss Alert</h3>
            <p className="text-sm text-gray-600 mb-4">{selectedAlert.alertMessage}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dismissal Reason *
              </label>
              <textarea
                value={dismissalReason}
                onChange={(e) => setDismissalReason(e.target.value)}
                rows={4}
                placeholder="Please provide a reason for dismissing this alert..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setDismissModalOpen(false);
                  setSelectedAlert(null);
                  setDismissalReason('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Dismiss Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
