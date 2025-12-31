import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Download,
  Calendar,
  Mail,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
} from 'lucide-react';
import { EXPORT_REPORT, CANCEL_EXPORT } from '../graphql/queries/analytics';
import { Breadcrumb } from '../components/layout/Breadcrumb';

/**
 * REQ-STRATEGIC-AUTO-1767048328662: Advanced Reporting & Business Intelligence Suite
 * Report Builder - Multi-format report export with filters
 */

type ReportType =
  | 'VENDOR_PRODUCTION_IMPACT'
  | 'CUSTOMER_PROFITABILITY'
  | 'ORDER_CYCLE_ANALYSIS'
  | 'MATERIAL_FLOW'
  | 'VENDOR_SCORECARD'
  | 'BIN_UTILIZATION'
  | 'INVENTORY_FORECAST'
  | 'PRODUCTION_OEE'
  | 'FINANCIAL_SUMMARY'
  | 'EXECUTIVE_DASHBOARD'
  | 'KPI_SUMMARY';

type ExportFormat = 'PDF' | 'EXCEL' | 'CSV' | 'JSON';

type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

interface ExportJob {
  jobId: string;
  status: ExportStatus;
  reportType: ReportType;
  format: ExportFormat;
  downloadUrl?: string;
  expiresAt?: string;
  requestedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export const ReportBuilderPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('EXECUTIVE_DASHBOARD');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('PDF');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [customTitle, setCustomTitle] = useState('');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [emailTo, setEmailTo] = useState('');
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);

  const [exportReport, { loading: exporting }] = useMutation(EXPORT_REPORT);
  const [cancelExport] = useMutation(CANCEL_EXPORT);

  const handleExport = async () => {
    try {
      const { data } = await exportReport({
        variables: {
          input: {
            reportType: selectedReportType,
            format: selectedFormat,
            startDate: new Date(dateRange.startDate).toISOString(),
            endDate: new Date(dateRange.endDate).toISOString(),
            filters: {},
            customTitle: customTitle || undefined,
            includeCharts,
            emailTo: emailTo || undefined,
          },
        },
      });

      if (data?.exportReport) {
        setExportJobs([data.exportReport, ...exportJobs]);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleCancelExport = async (jobId: string) => {
    try {
      await cancelExport({ variables: { jobId } });
      setExportJobs(exportJobs.filter((job) => job.jobId !== jobId));
    } catch (error) {
      console.error('Cancel failed:', error);
    }
  };

  const getStatusIcon = (status: ExportStatus) => {
    switch (status) {
      case 'PENDING':
      case 'PROCESSING':
        return <Clock className="h-5 w-5 text-yellow-500 animate-spin" />;
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'FAILED':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'EXPIRED':
        return <X className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ExportStatus) => {
    switch (status) {
      case 'PENDING':
      case 'PROCESSING':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800';
    }
  };

  const reportTypes: { value: ReportType; label: string }[] = [
    { value: 'EXECUTIVE_DASHBOARD', label: t('analytics.reports.executiveDashboard') },
    { value: 'KPI_SUMMARY', label: t('analytics.reports.kpiSummary') },
    { value: 'VENDOR_PRODUCTION_IMPACT', label: t('analytics.reports.vendorProduction') },
    { value: 'CUSTOMER_PROFITABILITY', label: t('analytics.reports.customerProfit') },
    { value: 'ORDER_CYCLE_ANALYSIS', label: t('analytics.reports.orderCycle') },
    { value: 'MATERIAL_FLOW', label: t('analytics.reports.materialFlow') },
    { value: 'VENDOR_SCORECARD', label: t('analytics.reports.vendorScorecard') },
    { value: 'BIN_UTILIZATION', label: t('analytics.reports.binUtilization') },
    { value: 'INVENTORY_FORECAST', label: t('analytics.reports.inventoryForecast') },
    { value: 'PRODUCTION_OEE', label: t('analytics.reports.productionOEE') },
    { value: 'FINANCIAL_SUMMARY', label: t('analytics.reports.financial') },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('analytics.reportBuilder')}</h1>
          <Breadcrumb />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Type Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('analytics.reportConfig')}
            </h2>

            <div className="space-y-4">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('analytics.reportType')}
                </label>
                <select
                  value={selectedReportType}
                  onChange={(e) => setSelectedReportType(e.target.value as ReportType)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {reportTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Export Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('analytics.exportFormat')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['PDF', 'EXCEL', 'CSV', 'JSON'] as ExportFormat[]).map((format) => (
                    <button
                      key={format}
                      onClick={() => setSelectedFormat(format)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedFormat === format
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    {t('analytics.startDate')}
                  </label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    {t('analytics.endDate')}
                  </label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Custom Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('analytics.customTitle')} ({t('analytics.optional')})
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={t('analytics.customTitlePlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Options */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {t('analytics.includeCharts')}
                  </span>
                </label>
              </div>

              {/* Email Delivery */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="h-4 w-4 inline mr-1" />
                  {t('analytics.emailTo')} ({t('analytics.optional')})
                </label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder={t('analytics.emailPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {exporting ? (
                  <>
                    <Clock className="h-5 w-5 animate-spin" />
                    {t('analytics.generating')}
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    {t('analytics.generateReport')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Export Jobs Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('analytics.exportJobs')}
            </h2>

            {exportJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('analytics.noExportJobs')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {exportJobs.map((job) => (
                  <div
                    key={job.jobId}
                    className="border border-gray-200 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <span className="font-medium text-sm">{job.reportType}</span>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                          job.status
                        )}`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600">
                      <div>Format: {job.format}</div>
                      <div>Requested: {new Date(job.requestedAt).toLocaleString()}</div>
                      {job.completedAt && (
                        <div>Completed: {new Date(job.completedAt).toLocaleString()}</div>
                      )}
                    </div>

                    {job.status === 'COMPLETED' && job.downloadUrl && (
                      <a
                        href={job.downloadUrl}
                        className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                        download
                      >
                        <Download className="h-4 w-4" />
                        {t('analytics.download')}
                      </a>
                    )}

                    {job.status === 'FAILED' && job.errorMessage && (
                      <div className="text-xs text-red-600">{job.errorMessage}</div>
                    )}

                    {(job.status === 'PENDING' || job.status === 'PROCESSING') && (
                      <button
                        onClick={() => handleCancelExport(job.jobId)}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        {t('analytics.cancel')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportBuilderPage;
