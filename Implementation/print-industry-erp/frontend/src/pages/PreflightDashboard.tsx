import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@apollo/client';
import {
  FileCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Settings,
} from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { Chart } from '../components/common/Chart';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { ColumnDef } from '@tanstack/react-table';
import clsx from 'clsx';
import { useAppStore } from '../store/appStore';
import {
  GET_PREFLIGHT_REPORTS,
  GET_PREFLIGHT_STATISTICS,
  GET_PREFLIGHT_ERROR_FREQUENCY,
} from '../graphql/queries/preflight';

interface PreflightReport {
  id: string;
  jobId?: string;
  estimateId?: string;
  status: 'QUEUED' | 'PROCESSING' | 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' | 'ERROR';
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  pdfMetadata?: {
    filename: string;
    fileSizeBytes: number;
    pageCount: number;
    pdfVersion: string;
  };
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  validatedAt?: string;
  processingTimeMs?: number;
  createdAt: string;
  updatedAt: string;
}

interface PreflightStatistics {
  totalReports: number;
  passRate: number;
  passWithWarningsRate: number;
  failRate: number;
  errorRate: number;
  avgProcessingTimeMs: number;
  totalErrors: number;
  totalWarnings: number;
  reportsLast30Days: number;
  reportsLast7Days: number;
}

interface ErrorFrequency {
  errorCode: string;
  errorMessage: string;
  count: number;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
}

export const PreflightDashboard: React.FC = () => {
  const { t } = useTranslation();
  const selectedFacility = useAppStore((state) => state.preferences.selectedFacility);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch preflight reports
  const { data: reportsData, loading: reportsLoading } = useQuery(GET_PREFLIGHT_REPORTS, {
    variables: {
      tenantId: selectedFacility || '1',
      limit: 50,
      offset: 0,
    },
    skip: !selectedFacility,
  });

  // Fetch statistics
  const { data: statsData } = useQuery(GET_PREFLIGHT_STATISTICS, {
    variables: {
      tenantId: selectedFacility || '1',
    },
    skip: !selectedFacility,
  });

  // Fetch error frequency
  const { data: errorFreqData } = useQuery(GET_PREFLIGHT_ERROR_FREQUENCY, {
    variables: {
      tenantId: selectedFacility || '1',
      limit: 10,
    },
    skip: !selectedFacility,
  });

  const reports: PreflightReport[] = reportsData?.preflightReports || [];
  const statistics: PreflightStatistics | undefined = statsData?.preflightStatistics;
  const errorFrequency: ErrorFrequency[] = errorFreqData?.preflightErrorFrequency || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle className="h-4 w-4" />;
      case 'PASS_WITH_WARNINGS':
        return <AlertTriangle className="h-4 w-4" />;
      case 'FAIL':
        return <XCircle className="h-4 w-4" />;
      case 'QUEUED':
      case 'PROCESSING':
        return <Clock className="h-4 w-4" />;
      case 'ERROR':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PASS':
        return 'bg-success-100 text-success-700';
      case 'PASS_WITH_WARNINGS':
        return 'bg-warning-100 text-warning-700';
      case 'FAIL':
        return 'bg-danger-100 text-danger-700';
      case 'QUEUED':
        return 'bg-gray-100 text-gray-700';
      case 'PROCESSING':
        return 'bg-info-100 text-info-700';
      case 'ERROR':
        return 'bg-danger-100 text-danger-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const columns: ColumnDef<PreflightReport>[] = [
    {
      accessorKey: 'pdfMetadata.filename',
      header: 'File Name',
      cell: (info) => {
        const filename = info.getValue() as string;
        return <span className="font-medium text-primary-600">{filename || 'Unknown'}</span>;
      },
    },
    {
      accessorKey: 'jobId',
      header: 'Job ID',
      cell: (info) => {
        const jobId = info.getValue() as string;
        return jobId ? <span className="text-sm">{jobId}</span> : <span className="text-gray-400">-</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        return (
          <span className={clsx('inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', getStatusColor(status))}>
            {getStatusIcon(status)}
            <span className="ml-1">{status.replace(/_/g, ' ')}</span>
          </span>
        );
      },
    },
    {
      accessorKey: 'totalErrors',
      header: 'Errors',
      cell: (info) => {
        const errors = info.getValue() as number;
        return errors > 0 ? (
          <span className="text-danger-600 font-semibold">{errors}</span>
        ) : (
          <span className="text-gray-400">0</span>
        );
      },
    },
    {
      accessorKey: 'totalWarnings',
      header: 'Warnings',
      cell: (info) => {
        const warnings = info.getValue() as number;
        return warnings > 0 ? (
          <span className="text-warning-600 font-semibold">{warnings}</span>
        ) : (
          <span className="text-gray-400">0</span>
        );
      },
    },
    {
      accessorKey: 'pdfMetadata.pageCount',
      header: 'Pages',
      cell: (info) => {
        const pageCount = info.getValue() as number;
        return pageCount || <span className="text-gray-400">-</span>;
      },
    },
    {
      accessorKey: 'processingTimeMs',
      header: 'Processing Time',
      cell: (info) => {
        const timeMs = info.getValue() as number;
        if (!timeMs) return <span className="text-gray-400">-</span>;
        const timeSec = (timeMs / 1000).toFixed(2);
        return <span className="text-sm">{timeSec}s</span>;
      },
    },
    {
      accessorKey: 'validatedAt',
      header: 'Validated',
      cell: (info) => {
        const validatedAt = info.getValue() as string;
        if (!validatedAt) return <span className="text-gray-400">-</span>;
        return <span className="text-sm">{new Date(validatedAt).toLocaleString()}</span>;
      },
    },
  ];

  const filteredReports =
    statusFilter === 'all' ? reports : reports.filter((report) => report.status === statusFilter);

  const statusChartData = statistics
    ? [
        { status: 'Pass', count: Math.round((statistics.passRate / 100) * statistics.totalReports) },
        { status: 'Pass w/ Warnings', count: Math.round((statistics.passWithWarningsRate / 100) * statistics.totalReports) },
        { status: 'Fail', count: Math.round((statistics.failRate / 100) * statistics.totalReports) },
        { status: 'Error', count: Math.round((statistics.errorRate / 100) * statistics.totalReports) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('preflight.title', 'PDF Preflight & Color Management')}</h1>
          <Breadcrumb />
        </div>
        <div className="flex items-center space-x-3">
          <button className="btn-secondary">
            <Settings className="h-4 w-4 mr-2" />
            {t('preflight.manageProfiles', 'Manage Profiles')}
          </button>
          <button className="btn-primary">
            <Upload className="h-4 w-4 mr-2" />
            {t('preflight.uploadPdf', 'Upload PDF')}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('preflight.passRate', 'Pass Rate')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {statistics ? `${statistics.passRate.toFixed(1)}%` : '-'}
              </p>
            </div>
            <CheckCircle className="h-10 w-10 text-success-500" />
          </div>
        </div>

        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('preflight.warningsRate', 'Warnings Rate')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {statistics ? `${statistics.passWithWarningsRate.toFixed(1)}%` : '-'}
              </p>
            </div>
            <AlertTriangle className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        <div className="card border-l-4 border-danger-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('preflight.failRate', 'Fail Rate')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {statistics ? `${statistics.failRate.toFixed(1)}%` : '-'}
              </p>
            </div>
            <XCircle className="h-10 w-10 text-danger-500" />
          </div>
        </div>

        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('preflight.totalReports', 'Total Reports')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {statistics ? statistics.totalReports : '-'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {statistics ? `${statistics.reportsLast7Days} this week` : '-'}
              </p>
            </div>
            <FileCheck className="h-10 w-10 text-primary-500" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart
          type="bar"
          data={statusChartData}
          xKey="status"
          yKey="count"
          title={t('preflight.statusDistribution', 'Status Distribution')}
          colors={['#22c55e', '#eab308', '#ef4444', '#f97316']}
          height={300}
        />

        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {t('preflight.topErrors', 'Top Validation Errors')}
          </h2>
          <div className="space-y-3">
            {errorFrequency.length > 0 ? (
              errorFrequency.slice(0, 5).map((error, index) => (
                <div key={index} className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{error.errorMessage}</p>
                    <p className="text-xs text-gray-500">{error.errorCode}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span
                      className={clsx(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        error.severity === 'CRITICAL' && 'bg-danger-100 text-danger-700',
                        error.severity === 'MAJOR' && 'bg-warning-100 text-warning-700',
                        error.severity === 'MINOR' && 'bg-info-100 text-info-700'
                      )}
                    >
                      {error.severity}
                    </span>
                    <span className="font-bold text-gray-900">{error.count}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">{t('preflight.noErrors', 'No errors recorded')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t('preflight.recentReports', 'Recent Preflight Reports')}</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {t('preflight.all', 'All')}
            </button>
            <button
              onClick={() => setStatusFilter('PASS')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === 'PASS' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {t('preflight.pass', 'Pass')}
            </button>
            <button
              onClick={() => setStatusFilter('PASS_WITH_WARNINGS')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === 'PASS_WITH_WARNINGS' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {t('preflight.warnings', 'Warnings')}
            </button>
            <button
              onClick={() => setStatusFilter('FAIL')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === 'FAIL' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {t('preflight.fail', 'Fail')}
            </button>
          </div>
        </div>
        {reportsLoading ? (
          <div className="card flex items-center justify-center py-12">
            <div className="text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500">{t('preflight.loading', 'Loading reports...')}</p>
            </div>
          </div>
        ) : filteredReports.length > 0 ? (
          <DataTable data={filteredReports} columns={columns} pageSize={10} />
        ) : (
          <div className="card text-center py-12">
            <FileCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('preflight.noReports', 'No preflight reports found')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
