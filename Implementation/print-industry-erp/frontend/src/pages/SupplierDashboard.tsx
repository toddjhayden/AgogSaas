/**
 * Supplier Dashboard
 * REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
 *
 * Main dashboard for suppliers showing:
 * - Open POs summary
 * - Performance metrics
 * - Recent alerts
 * - Recent activity
 */

import React from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Package,
  FileText,
  CheckCircle,
  Clock,
  DollarSign,
} from 'lucide-react';
import { GET_SUPPLIER_DASHBOARD } from '../graphql/queries/supplierPortal';
import Chart from '../components/common/Chart';

const SupplierDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, loading, error } = useQuery(GET_SUPPLIER_DASHBOARD, {
    pollInterval: 30000, // Refresh every 30 seconds
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <p className="text-sm text-red-700">{t('error.loadingDashboard')}</p>
            <p className="text-xs text-red-600 mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const dashboard = data?.supplierDashboard;

  // Format currency
  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Get tier badge color
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'STRATEGIC':
        return 'bg-purple-100 text-purple-800';
      case 'PREFERRED':
        return 'bg-blue-100 text-blue-800';
      case 'TRANSACTIONAL':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get alert type badge color
  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800';
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800';
      case 'TREND':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get PO status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT_TO_VENDOR':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACKNOWLEDGED':
        return 'bg-blue-100 text-blue-800';
      case 'IN_TRANSIT':
        return 'bg-indigo-100 text-indigo-800';
      case 'PARTIALLY_RECEIVED':
        return 'bg-purple-100 text-purple-800';
      case 'RECEIVED':
        return 'bg-green-100 text-green-800';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t('supplierPortal.dashboard.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t('supplierPortal.dashboard.subtitle')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Open POs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('supplierPortal.dashboard.openPOs')}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {dashboard?.openPOCount || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {formatCurrency(dashboard?.openPOTotalValue || 0)}
              </p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Pending ASNs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('supplierPortal.dashboard.pendingASNs')}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {dashboard?.pendingASNCount || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t('supplierPortal.dashboard.awaiting')}
              </p>
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <Package className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* On-Time Delivery */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('supplierPortal.dashboard.onTimeDelivery')}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatPercentage(dashboard?.onTimeDeliveryPercentage || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t('supplierPortal.dashboard.last12Months')}
              </p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Quality Rating */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('supplierPortal.dashboard.qualityRating')}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatPercentage(dashboard?.qualityAcceptancePercentage || 0)}
              </p>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierColor(
                    dashboard?.vendorTier
                  )}`}
                >
                  {dashboard?.vendorTier || 'N/A'}
                </span>
              </div>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Alerts */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('supplierPortal.dashboard.recentAlerts')}
              </h2>
            </div>
            <div className="p-6">
              {dashboard?.recentAlerts && dashboard.recentAlerts.length > 0 ? (
                <div className="space-y-4">
                  {dashboard.recentAlerts.map((alert: any) => (
                    <div
                      key={alert.id}
                      className="border-l-4 border-yellow-400 bg-yellow-50 p-4"
                    >
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getAlertTypeColor(
                                alert.alertType
                              )}`}
                            >
                              {alert.alertType}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(alert.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 mt-2">
                            {alert.message}
                          </p>
                          {alert.actionItems && alert.actionItems.length > 0 && (
                            <ul className="mt-2 text-xs text-gray-600 list-disc list-inside">
                              {alert.actionItems.map((item: string, idx: number) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
                  <p className="text-sm">{t('supplierPortal.dashboard.noAlerts')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Purchase Orders */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('supplierPortal.dashboard.recentPOs')}
              </h2>
              <button
                onClick={() => navigate('/supplier/purchase-orders')}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {t('common.viewAll')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('supplierPortal.purchaseOrders.poNumber')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('supplierPortal.purchaseOrders.date')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('supplierPortal.purchaseOrders.deliveryDate')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('supplierPortal.purchaseOrders.amount')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.status')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dashboard?.recentPurchaseOrders &&
                  dashboard.recentPurchaseOrders.length > 0 ? (
                    dashboard.recentPurchaseOrders.map((po: any) => (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() =>
                              navigate(`/supplier/purchase-orders/${po.poNumber}`)
                            }
                            className="text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            {po.poNumber}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(po.poDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {po.requestedDeliveryDate
                            ? new Date(po.requestedDeliveryDate).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(po.totalAmount, po.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              po.status
                            )}`}
                          >
                            {po.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            {!po.isAcknowledged && (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/supplier/purchase-orders/${po.poNumber}/acknowledge`
                                  )
                                }
                                className="text-blue-600 hover:text-blue-900"
                              >
                                {t('supplierPortal.purchaseOrders.acknowledge')}
                              </button>
                            )}
                            {po.isAcknowledged && !po.hasASN && (
                              <button
                                onClick={() =>
                                  navigate(`/supplier/asn/create?po=${po.poNumber}`)
                                }
                                className="text-green-600 hover:text-green-900"
                              >
                                {t('supplierPortal.asn.create')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-sm text-gray-500"
                      >
                        {t('supplierPortal.dashboard.noPOs')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('supplierPortal.dashboard.recentActivity')}
          </h2>
        </div>
        <div className="p-6">
          {dashboard?.recentActivity && dashboard.recentActivity.length > 0 ? (
            <div className="flow-root">
              <ul className="-mb-8">
                {dashboard.recentActivity.map((activity: any, idx: number) => (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {idx !== dashboard.recentActivity.length - 1 && (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                            <Clock className="h-4 w-4 text-white" />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div>
                            <p className="text-sm text-gray-900 font-medium">
                              {activity.activityType.replace(/_/g, ' ')}
                            </p>
                            <p className="mt-0.5 text-sm text-gray-500">
                              {new Date(activity.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-center py-8 text-sm text-gray-500">
              {t('supplierPortal.dashboard.noActivity')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierDashboard;
