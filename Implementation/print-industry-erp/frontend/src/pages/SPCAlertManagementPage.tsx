/**
 * SPC Alert Management Page
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328664 - Quality Management & SPC
 * Created: 2025-12-29
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  XCircle,
} from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { useAppStore } from '../store/appStore';
import {
  GET_SPC_ALERTS,
  ACKNOWLEDGE_SPC_ALERT,
  RESOLVE_SPC_ALERT,
} from '../graphql/queries/spc';
import { DEFAULTS } from '../constants/defaults';

interface SPCAlert {
  id: string;
  alertTimestamp: string;
  parameterCode: string;
  parameterName: string;
  ruleType: string;
  ruleDescription: string | null;
  measuredValue: number | null;
  controlLimitViolated: number | null;
  deviationFromCenter: number | null;
  sigmaLevel: number | null;
  severity: string;
  status: string;
  acknowledgedByUserId: string | null;
  acknowledgedAt: string | null;
  rootCause: string | null;
  correctiveAction: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export const SPCAlertManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const selectedFacility = useAppStore((state) => state.preferences.selectedFacility);
  const currentUser = { id: DEFAULTS.USER_ID }; // TODO: Replace with actual user from auth context
  const [filterStatus, setFilterStatus] = useState<string>('OPEN');
  const [selectedAlert, setSelectedAlert] = useState<SPCAlert | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');

  const { data, loading, refetch } = useQuery<{
    spcAlerts: SPCAlert[];
  }>(GET_SPC_ALERTS, {
    variables: {
      filter: {
        tenantId: selectedFacility || DEFAULTS.TENANT_ID,
        facilityId: selectedFacility,
        status: filterStatus === 'ALL' ? undefined : filterStatus,
        limit: 100,
      },
    },
    skip: !selectedFacility,
  });

  const [acknowledgeAlert] = useMutation(ACKNOWLEDGE_SPC_ALERT, {
    onCompleted: () => {
      refetch();
    },
  });

  const [resolveAlert] = useMutation(RESOLVE_SPC_ALERT, {
    onCompleted: () => {
      refetch();
      setShowResolveModal(false);
      setSelectedAlert(null);
      setRootCause('');
      setCorrectiveAction('');
    },
  });

  const alerts = data?.spcAlerts || [];

  const handleAcknowledge = async (alertId: string) => {
    if (!currentUser?.id) return;

    try {
      await acknowledgeAlert({
        variables: {
          id: alertId,
          userId: currentUser.id,
        },
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const handleResolve = async () => {
    if (!selectedAlert || !currentUser?.id || !rootCause || !correctiveAction) {
      return;
    }

    try {
      await resolveAlert({
        variables: {
          id: selectedAlert.id,
          userId: currentUser.id,
          rootCause,
          correctiveAction,
        },
      });
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      CRITICAL: 'bg-error-100 text-error-800',
      HIGH: 'bg-warning-100 text-warning-800',
      MEDIUM: 'bg-primary-100 text-primary-800',
      LOW: 'bg-gray-100 text-gray-800',
    };
    return colors[severity as keyof typeof colors] || colors.LOW;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      OPEN: 'bg-error-100 text-error-800',
      ACKNOWLEDGED: 'bg-warning-100 text-warning-800',
      INVESTIGATING: 'bg-primary-100 text-primary-800',
      RESOLVED: 'bg-success-100 text-success-800',
      FALSE_ALARM: 'bg-gray-100 text-gray-800',
    };
    return colors[status as keyof typeof colors] || colors.OPEN;
  };

  const columns = [
    {
      key: 'alertTimestamp',
      header: t('spc.alertTime'),
      render: (alert: SPCAlert) =>
        new Date(alert.alertTimestamp).toLocaleString(),
    },
    {
      key: 'parameterName',
      header: t('spc.parameter'),
    },
    {
      key: 'ruleType',
      header: t('spc.ruleViolated'),
      render: (alert: SPCAlert) => (
        <div className="text-sm">
          <div className="font-mono">{alert.ruleType.replace(/_/g, ' ')}</div>
          {alert.ruleDescription && (
            <div className="text-xs text-gray-500 mt-1">
              {alert.ruleDescription}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'severity',
      header: t('spc.severity'),
      render: (alert: SPCAlert) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityBadge(
            alert.severity
          )}`}
        >
          {alert.severity}
        </span>
      ),
    },
    {
      key: 'measuredValue',
      header: t('spc.value'),
      render: (alert: SPCAlert) => (
        <div className="text-sm">
          <div>{alert.measuredValue?.toFixed(3) || '-'}</div>
          {alert.sigmaLevel && (
            <div className="text-xs text-gray-500">
              {alert.sigmaLevel.toFixed(2)}σ
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('spc.status'),
      render: (alert: SPCAlert) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
            alert.status
          )}`}
        >
          {alert.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (alert: SPCAlert) => (
        <div className="flex space-x-2">
          {alert.status === 'OPEN' && (
            <button
              onClick={() => handleAcknowledge(alert.id)}
              className="text-primary-600 hover:text-primary-800 text-sm font-medium"
            >
              {t('spc.acknowledge')}
            </button>
          )}
          {(alert.status === 'ACKNOWLEDGED' || alert.status === 'INVESTIGATING') && (
            <button
              onClick={() => {
                setSelectedAlert(alert);
                setShowResolveModal(true);
              }}
              className="text-success-600 hover:text-success-800 text-sm font-medium"
            >
              {t('spc.resolve')}
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('spc.alertManagement')}
          </h1>
          <Breadcrumb />
        </div>
        <FacilitySelector />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-l-4 border-error-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('spc.openAlerts')}
              </p>
              <p className="text-3xl font-bold text-error-600 mt-2">
                {alerts.filter((a) => a.status === 'OPEN').length}
              </p>
            </div>
            <AlertTriangle className="h-10 w-10 text-error-500" />
          </div>
        </div>

        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('spc.acknowledged')}
              </p>
              <p className="text-3xl font-bold text-warning-600 mt-2">
                {alerts.filter((a) => a.status === 'ACKNOWLEDGED').length}
              </p>
            </div>
            <Clock className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('spc.resolved')}
              </p>
              <p className="text-3xl font-bold text-success-600 mt-2">
                {alerts.filter((a) => a.status === 'RESOLVED').length}
              </p>
            </div>
            <CheckCircle className="h-10 w-10 text-success-500" />
          </div>
        </div>

        <div className="card border-l-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('spc.falseAlarms')}
              </p>
              <p className="text-3xl font-bold text-gray-600 mt-2">
                {alerts.filter((a) => a.status === 'FALSE_ALARM').length}
              </p>
            </div>
            <XCircle className="h-10 w-10 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <div className="flex space-x-2">
            {['ALL', 'OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    filterStatus === status
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('spc.alerts')}
        </h3>
        <DataTable
          data={alerts}
          columns={columns}
          emptyMessage={t('spc.noAlerts')}
        />
      </div>

      {/* Resolve Modal */}
      {showResolveModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {t('spc.resolveAlert')}
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">
                  <strong>{t('spc.parameter')}:</strong>{' '}
                  {selectedAlert.parameterName}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>{t('spc.ruleViolated')}:</strong>{' '}
                  {selectedAlert.ruleType}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>{t('spc.alertTime')}:</strong>{' '}
                  {new Date(selectedAlert.alertTimestamp).toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('spc.rootCause')}
                </label>
                <textarea
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder={t('spc.enterRootCause')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('spc.correctiveAction')}
                </label>
                <textarea
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder={t('spc.enterCorrectiveAction')}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowResolveModal(false);
                    setSelectedAlert(null);
                    setRootCause('');
                    setCorrectiveAction('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleResolve}
                  disabled={!rootCause || !correctiveAction}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {t('spc.resolveAlert')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SPCAlertManagementPage;
