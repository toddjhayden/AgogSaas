/**
 * SPC Dashboard - Statistical Process Control Overview
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328664 - Quality Management & SPC
 * Created: 2025-12-29
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@apollo/client';
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  AlertCircle,
  Target,
} from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { DataTable } from '../components/common/DataTable';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { useAppStore } from '../store/appStore';
import { GET_SPC_DASHBOARD_SUMMARY, GET_SPC_ALERTS } from '../graphql/queries/spc';
import { DEFAULTS } from '../constants/defaults';

interface AlertsByRuleType {
  ruleType: string;
  count: number;
}

interface ParameterSummary {
  parameterCode: string;
  parameterName: string;
  currentCpk: number | null;
  alertCount: number;
  status: string;
}

interface SPCDashboardSummary {
  totalParametersMonitored: number;
  parametersInControl: number;
  parametersOutOfControl: number;
  openAlerts: number;
  criticalAlerts: number;
  avgCpk: number | null;
  avgCp: number | null;
  capableProcesses: number;
  marginalProcesses: number;
  poorProcesses: number;
  alertsByRuleType: AlertsByRuleType[];
  topParameters: ParameterSummary[];
}

interface SPCAlert {
  id: string;
  alertTimestamp: string;
  parameterCode: string;
  parameterName: string;
  ruleType: string;
  severity: string;
  status: string;
  measuredValue: number | null;
  sigmaLevel: number | null;
}

export const SPCDashboard: React.FC = () => {
  const { t } = useTranslation();
  const selectedFacility = useAppStore((state) => state.preferences.selectedFacility);
  const [dateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const { data: summaryData, loading: summaryLoading } = useQuery<{
    spcDashboardSummary: SPCDashboardSummary;
  }>(GET_SPC_DASHBOARD_SUMMARY, {
    variables: {
      tenantId: selectedFacility || DEFAULTS.TENANT_ID,
      facilityId: selectedFacility || 'default-facility',
      dateRange,
    },
    skip: !selectedFacility,
  });

  const { data: alertsData, loading: alertsLoading } = useQuery<{
    spcAlerts: SPCAlert[];
  }>(GET_SPC_ALERTS, {
    variables: {
      filter: {
        tenantId: selectedFacility || DEFAULTS.TENANT_ID,
        facilityId: selectedFacility,
        status: 'OPEN',
        limit: 10,
      },
    },
    skip: !selectedFacility,
  });

  const summary = summaryData?.spcDashboardSummary;
  const alerts = alertsData?.spcAlerts || [];

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'IN_CONTROL':
        return 'text-success-600';
      case 'OUT_OF_CONTROL':
        return 'text-error-600';
      case 'WARNING':
        return 'text-warning-600';
      default:
        return 'text-gray-600';
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

  const alertColumns = [
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
        <span className="text-sm font-mono">{alert.ruleType.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'severity',
      header: t('spc.severity'),
      render: (alert: SPCAlert) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityBadge(alert.severity)}`}>
          {alert.severity}
        </span>
      ),
    },
    {
      key: 'sigmaLevel',
      header: t('spc.sigmaLevel'),
      render: (alert: SPCAlert) =>
        alert.sigmaLevel ? `${alert.sigmaLevel.toFixed(2)}σ` : '-',
    },
    {
      key: 'status',
      header: t('spc.status'),
      render: (alert: SPCAlert) => (
        <span className="text-sm">{alert.status}</span>
      ),
    },
  ];

  const parameterColumns = [
    {
      key: 'parameterName',
      header: t('spc.parameter'),
    },
    {
      key: 'currentCpk',
      header: t('spc.cpk'),
      render: (param: ParameterSummary) =>
        param.currentCpk ? param.currentCpk.toFixed(2) : '-',
    },
    {
      key: 'alertCount',
      header: t('spc.alerts'),
      render: (param: ParameterSummary) => (
        <span className={param.alertCount > 0 ? 'text-warning-600 font-semibold' : ''}>
          {param.alertCount}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('spc.status'),
      render: (param: ParameterSummary) => (
        <span className={getStatusColor(param.status)}>{param.status}</span>
      ),
    },
  ];

  if (summaryLoading || alertsLoading) {
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
          <h1 className="text-3xl font-bold text-gray-900">{t('spc.title')}</h1>
          <Breadcrumb />
        </div>
        <FacilitySelector />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('spc.parametersMonitored')}
              </p>
              <p className="text-3xl font-bold text-primary-600 mt-2">
                {summary?.totalParametersMonitored || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {summary?.parametersInControl || 0} {t('spc.inControl')}
              </p>
            </div>
            <Activity className="h-10 w-10 text-primary-500" />
          </div>
        </div>

        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('spc.avgCpk')}</p>
              <p className="text-3xl font-bold text-success-600 mt-2">
                {summary?.avgCpk?.toFixed(2) || '-'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Cp: {summary?.avgCp?.toFixed(2) || '-'}
              </p>
            </div>
            <Target className="h-10 w-10 text-success-500" />
          </div>
        </div>

        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('spc.openAlerts')}</p>
              <p className="text-3xl font-bold text-warning-600 mt-2">
                {summary?.openAlerts || 0}
              </p>
              <p className="text-xs text-error-600 mt-1">
                {summary?.criticalAlerts || 0} {t('spc.critical')}
              </p>
            </div>
            <AlertTriangle className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        <div className="card border-l-4 border-info-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('spc.capableProcesses')}
              </p>
              <p className="text-3xl font-bold text-info-600 mt-2">
                {summary?.capableProcesses || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {summary?.marginalProcesses || 0} {t('spc.marginal')}, {summary?.poorProcesses || 0} {t('spc.poor')}
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-info-500" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Process Capability Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('spc.processCapabilityDistribution')}
          </h3>
          <Chart
            type="pie"
            data={[
              { name: t('spc.excellent'), value: summary?.capableProcesses || 0 },
              { name: t('spc.marginal'), value: summary?.marginalProcesses || 0 },
              { name: t('spc.poor'), value: summary?.poorProcesses || 0 },
            ]}
            xKey="name"
            yKey="value"
            colors={['#10b981', '#f59e0b', '#ef4444']}
            height={300}
          />
        </div>

        {/* Alerts by Rule Type */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('spc.alertsByRuleType')}
          </h3>
          <Chart
            type="bar"
            data={(summary?.alertsByRuleType || []).map((item) => ({
              rule: item.ruleType.replace(/_/g, ' '),
              count: item.count,
            }))}
            xKey="rule"
            yKey="count"
            colors={['#3b82f6']}
            height={300}
          />
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('spc.recentAlerts')}
          </h3>
          <AlertCircle className="h-5 w-5 text-warning-500" />
        </div>
        <DataTable
          data={alerts}
          columns={alertColumns}
          emptyMessage={t('spc.noOpenAlerts')}
        />
      </div>

      {/* Top Parameters Requiring Attention */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('spc.topParameters')}
          </h3>
          <BarChart3 className="h-5 w-5 text-primary-500" />
        </div>
        <DataTable
          data={summary?.topParameters || []}
          columns={parameterColumns}
          emptyMessage={t('spc.noParametersMonitored')}
        />
      </div>
    </div>
  );
};

export default SPCDashboard;
