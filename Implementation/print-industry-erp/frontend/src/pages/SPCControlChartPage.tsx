/**
 * SPC Control Chart Page - Individual Parameter Control Chart
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328664 - Quality Management & SPC
 * Created: 2025-12-29
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@apollo/client';
import { useParams } from 'react-router-dom';
import {
  TrendingUp,
  AlertTriangle,
  Info,
  Activity,
  Target,
} from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { useAppStore } from '../store/appStore';
import {
  GET_SPC_CONTROL_CHART_DATA,
  GET_SPC_CONTROL_LIMITS,
  GET_SPC_PROCESS_CAPABILITY,
} from '../graphql/queries/spc';
import { DEFAULTS } from '../constants/defaults';

interface ControlChartDataPoint {
  id: string;
  measurementTimestamp: string;
  measuredValue: number;
  subgroupNumber: number | null;
  measurementQuality: string;
  dataSource: string;
}

interface ControlLimits {
  id: string;
  parameterCode: string;
  parameterName: string;
  chartType: string;
  upperControlLimit: number;
  centerLine: number;
  lowerControlLimit: number | null;
  upperSpecLimit: number | null;
  lowerSpecLimit: number | null;
  targetValue: number | null;
  processMean: number | null;
  processStdDev: number | null;
}

interface ProcessCapability {
  cp: number | null;
  cpk: number | null;
  pp: number | null;
  ppk: number | null;
  capabilityStatus: string;
  isCapable: boolean;
  isCentered: boolean;
  expectedPpmTotal: number | null;
  sigmaLevel: number | null;
  recommendations: string | null;
}

export const SPCControlChartPage: React.FC = () => {
  const { t } = useTranslation();
  const { parameterCode } = useParams<{ parameterCode: string }>();
  const selectedFacility = useAppStore((state) => state.preferences.selectedFacility);
  const [dateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  });

  const { data: chartData, loading: chartLoading } = useQuery<{
    spcControlChartData: ControlChartDataPoint[];
  }>(GET_SPC_CONTROL_CHART_DATA, {
    variables: {
      filter: {
        tenantId: selectedFacility || DEFAULTS.TENANT_ID,
        facilityId: selectedFacility,
        parameterCode,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        measurementQuality: 'VERIFIED',
        limit: 500,
      },
    },
    skip: !selectedFacility || !parameterCode,
  });

  const { data: limitsData, loading: limitsLoading } = useQuery<{
    spcControlLimits: ControlLimits;
  }>(GET_SPC_CONTROL_LIMITS, {
    variables: {
      tenantId: selectedFacility || DEFAULTS.TENANT_ID,
      parameterCode,
    },
    skip: !selectedFacility || !parameterCode,
  });

  const { data: capabilityData, loading: capabilityLoading } = useQuery<{
    spcProcessCapability: ProcessCapability;
  }>(GET_SPC_PROCESS_CAPABILITY, {
    variables: {
      input: {
        tenantId: selectedFacility || DEFAULTS.TENANT_ID,
        facilityId: selectedFacility,
        parameterCode,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
    },
    skip: !selectedFacility || !parameterCode,
  });

  const dataPoints = chartData?.spcControlChartData || [];
  const limits = limitsData?.spcControlLimits;
  const capability = capabilityData?.spcProcessCapability;

  const chartDataWithLimits = useMemo(() => {
    if (!dataPoints.length || !limits) return [];

    return dataPoints.map((point) => ({
      timestamp: new Date(point.measurementTimestamp).toLocaleString(),
      value: point.measuredValue,
      ucl: limits.upperControlLimit,
      cl: limits.centerLine,
      lcl: limits.lowerControlLimit || 0,
      usl: limits.upperSpecLimit,
      lsl: limits.lowerSpecLimit,
    }));
  }, [dataPoints, limits]);

  const getCapabilityColor = (status: string) => {
    switch (status) {
      case 'EXCELLENT':
        return 'text-success-600 bg-success-100';
      case 'ADEQUATE':
        return 'text-primary-600 bg-primary-100';
      case 'MARGINAL':
        return 'text-warning-600 bg-warning-100';
      case 'POOR':
        return 'text-error-600 bg-error-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (chartLoading || limitsLoading || capabilityLoading) {
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
            {limits?.parameterName || parameterCode}
          </h1>
          <Breadcrumb />
        </div>
        <FacilitySelector />
      </div>

      {/* Control Limits Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-l-4 border-error-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('spc.upperControlLimit')}
              </p>
              <p className="text-2xl font-bold text-error-600 mt-2">
                {limits?.upperControlLimit.toFixed(3) || '-'}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-error-500" />
          </div>
        </div>

        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('spc.centerLine')}</p>
              <p className="text-2xl font-bold text-primary-600 mt-2">
                {limits?.centerLine.toFixed(3) || '-'}
              </p>
            </div>
            <Target className="h-8 w-8 text-primary-500" />
          </div>
        </div>

        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('spc.lowerControlLimit')}
              </p>
              <p className="text-2xl font-bold text-success-600 mt-2">
                {limits?.lowerControlLimit?.toFixed(3) || '-'}
              </p>
            </div>
            <Activity className="h-8 w-8 text-success-500" />
          </div>
        </div>

        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('spc.chartType')}</p>
              <p className="text-xl font-bold text-warning-600 mt-2">
                {limits?.chartType || '-'}
              </p>
            </div>
            <Info className="h-8 w-8 text-warning-500" />
          </div>
        </div>
      </div>

      {/* Control Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('spc.controlChart')}
        </h3>
        <Chart
          type="line"
          data={chartDataWithLimits}
          xKey="timestamp"
          yKey="value"
          title={limits?.parameterName}
          colors={['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ef4444', '#10b981']}
          height={400}
          options={{
            lines: [
              { key: 'value', label: t('spc.measuredValue'), color: '#3b82f6' },
              { key: 'ucl', label: 'UCL', color: '#ef4444', style: 'dashed' },
              { key: 'cl', label: 'CL', color: '#10b981', style: 'dashed' },
              { key: 'lcl', label: 'LCL', color: '#f59e0b', style: 'dashed' },
            ],
          }}
        />
      </div>

      {/* Process Capability */}
      {capability && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('spc.processCapability')}
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('spc.cpk')}</span>
                <span className="text-2xl font-bold text-primary-600">
                  {capability.cpk?.toFixed(2) || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('spc.cp')}</span>
                <span className="text-xl font-semibold">
                  {capability.cp?.toFixed(2) || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('spc.ppk')}</span>
                <span className="text-xl font-semibold">
                  {capability.ppk?.toFixed(2) || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('spc.pp')}</span>
                <span className="text-xl font-semibold">
                  {capability.pp?.toFixed(2) || '-'}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{t('spc.status')}</span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getCapabilityColor(
                      capability.capabilityStatus
                    )}`}
                  >
                    {capability.capabilityStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('spc.performanceMetrics')}
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('spc.sigmaLevel')}</span>
                <span className="text-xl font-semibold">
                  {capability.sigmaLevel?.toFixed(2)}σ
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('spc.expectedPpm')}</span>
                <span className="text-xl font-semibold">
                  {capability.expectedPpmTotal?.toFixed(0) || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('spc.centered')}</span>
                <span className="text-sm">
                  {capability.isCentered ? (
                    <span className="text-success-600 font-medium">
                      {t('common.yes')}
                    </span>
                  ) : (
                    <span className="text-warning-600 font-medium">
                      {t('common.no')}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('spc.capable')}</span>
                <span className="text-sm">
                  {capability.isCapable ? (
                    <span className="text-success-600 font-medium">
                      {t('common.yes')}
                    </span>
                  ) : (
                    <span className="text-error-600 font-medium">
                      {t('common.no')}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {capability?.recommendations && (
        <div className="card bg-blue-50 border border-blue-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <h4 className="text-lg font-semibold text-blue-900 mb-2">
                {t('spc.recommendations')}
              </h4>
              <p className="text-blue-800">{capability.recommendations}</p>
            </div>
          </div>
        </div>
      )}

      {/* Process Statistics */}
      {limits && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('spc.processStatistics')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">{t('spc.processMean')}</p>
              <p className="text-xl font-semibold mt-1">
                {limits.processMean?.toFixed(3) || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('spc.processStdDev')}</p>
              <p className="text-xl font-semibold mt-1">
                {limits.processStdDev?.toFixed(3) || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('spc.upperSpecLimit')}</p>
              <p className="text-xl font-semibold mt-1">
                {limits.upperSpecLimit?.toFixed(3) || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('spc.lowerSpecLimit')}</p>
              <p className="text-xl font-semibold mt-1">
                {limits.lowerSpecLimit?.toFixed(3) || '-'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SPCControlChartPage;
