import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import {
  AlertTriangle,
  XCircle,
  CheckCircle,
  Info,
  Download,
  ThumbsUp,
  ThumbsDown,
  Palette,
  Image as ImageIcon,
  FileText,
  Clock,
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  GET_PREFLIGHT_REPORT,
  GET_PREFLIGHT_ISSUES,
  APPROVE_PREFLIGHT_REPORT,
  REJECT_PREFLIGHT_REPORT,
} from '../graphql/queries/preflight';

export const PreflightReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  // Fetch report details
  const { data: reportData, loading: reportLoading, refetch } = useQuery(GET_PREFLIGHT_REPORT, {
    variables: { id },
    skip: !id,
  });

  // Fetch issues
  const { data: issuesData } = useQuery(GET_PREFLIGHT_ISSUES, {
    variables: { reportId: id },
    skip: !id,
  });

  const [approveReport] = useMutation(APPROVE_PREFLIGHT_REPORT, {
    onCompleted: () => {
      toast.success(t('preflight.reportApproved', 'Report approved successfully'));
      setShowApprovalModal(false);
      setApprovalNotes('');
      refetch();
    },
    onError: (error) => {
      toast.error(t('preflight.approvalError', 'Failed to approve report: ') + error.message);
    },
  });

  const [rejectReport] = useMutation(REJECT_PREFLIGHT_REPORT, {
    onCompleted: () => {
      toast.success(t('preflight.reportRejected', 'Report rejected successfully'));
      setShowRejectionModal(false);
      setRejectionReason('');
      refetch();
    },
    onError: (error) => {
      toast.error(t('preflight.rejectionError', 'Failed to reject report: ') + error.message);
    },
  });

  const handleApprove = async () => {
    await approveReport({
      variables: {
        id,
        notes: approvalNotes || undefined,
      },
    });
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error(t('preflight.rejectionReasonRequired', 'Rejection reason is required'));
      return;
    }
    await rejectReport({
      variables: {
        id,
        reason: rejectionReason,
      },
    });
  };

  const report = reportData?.preflightReport;
  const issues = issuesData?.preflightIssues || [];

  const errors = issues.filter((i: any) => i.issueType === 'ERROR');
  const warnings = issues.filter((i: any) => i.issueType === 'WARNING');
  // Info issues could be displayed if needed: issues.filter((i: any) => i.issueType === 'INFO')

  if (reportLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500">{t('preflight.loading', 'Loading report...')}</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">{t('preflight.reportNotFound', 'Report not found')}</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle className="h-8 w-8 text-success-500" />;
      case 'PASS_WITH_WARNINGS':
        return <AlertTriangle className="h-8 w-8 text-warning-500" />;
      case 'FAIL':
        return <XCircle className="h-8 w-8 text-danger-500" />;
      default:
        return <Clock className="h-8 w-8 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PASS':
        return 'bg-success-100 text-success-700 border-success-300';
      case 'PASS_WITH_WARNINGS':
        return 'bg-warning-100 text-warning-700 border-warning-300';
      case 'FAIL':
        return 'bg-danger-100 text-danger-700 border-danger-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-danger-100 text-danger-700';
      case 'MAJOR':
        return 'bg-warning-100 text-warning-700';
      case 'MINOR':
        return 'bg-info-100 text-info-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('preflight.reportDetail', 'Preflight Report Detail')}
          </h1>
          <Breadcrumb />
        </div>
        <div className="flex items-center space-x-3">
          {report.status === 'PASS' || report.status === 'PASS_WITH_WARNINGS' ? (
            <>
              <button className="btn-danger" onClick={() => setShowRejectionModal(true)}>
                <ThumbsDown className="h-4 w-4 mr-2" />
                {t('preflight.reject', 'Reject')}
              </button>
              <button className="btn-success" onClick={() => setShowApprovalModal(true)}>
                <ThumbsUp className="h-4 w-4 mr-2" />
                {t('preflight.approve', 'Approve')}
              </button>
            </>
          ) : null}
          <button className="btn-secondary">
            <Download className="h-4 w-4 mr-2" />
            {t('preflight.downloadReport', 'Download Report')}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={clsx('card border-2', getStatusColor(report.status))}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {getStatusIcon(report.status)}
            <div>
              <h2 className="text-2xl font-bold">{report.status.replace(/_/g, ' ')}</h2>
              <p className="text-sm mt-1">
                {report.pdfMetadata?.filename || 'Unknown File'} - {report.pdfMetadata?.pageCount || 0} pages
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">
              {t('preflight.validated', 'Validated')}: {new Date(report.validatedAt || report.createdAt).toLocaleString()}
            </p>
            {report.processingTimeMs && (
              <p className="text-sm text-gray-600">
                {t('preflight.processingTime', 'Processing Time')}: {(report.processingTimeMs / 1000).toFixed(2)}s
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card border-l-4 border-danger-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('preflight.errors', 'Errors')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{report.totalErrors}</p>
            </div>
            <XCircle className="h-10 w-10 text-danger-500" />
          </div>
        </div>

        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('preflight.warnings', 'Warnings')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{report.totalWarnings}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        <div className="card border-l-4 border-info-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('preflight.info', 'Info')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{report.totalInfo}</p>
            </div>
            <Info className="h-10 w-10 text-info-500" />
          </div>
        </div>
      </div>

      {/* PDF Metadata */}
      {report.pdfMetadata && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            {t('preflight.pdfMetadata', 'PDF Metadata')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">{t('preflight.filename', 'Filename')}</p>
              <p className="font-medium">{report.pdfMetadata.filename}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('preflight.fileSize', 'File Size')}</p>
              <p className="font-medium">{(report.pdfMetadata.fileSizeBytes / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('preflight.pages', 'Pages')}</p>
              <p className="font-medium">{report.pdfMetadata.pageCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('preflight.pdfVersion', 'PDF Version')}</p>
              <p className="font-medium">{report.pdfMetadata.pdfVersion}</p>
            </div>
            {report.pdfMetadata.dimensions && (
              <>
                <div>
                  <p className="text-sm text-gray-600">{t('preflight.dimensions', 'Dimensions')}</p>
                  <p className="font-medium">
                    {report.pdfMetadata.dimensions.widthInches.toFixed(2)}" x{' '}
                    {report.pdfMetadata.dimensions.heightInches.toFixed(2)}"
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Color Analysis */}
      {report.colorAnalysis && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Palette className="h-5 w-5 mr-2" />
            {t('preflight.colorAnalysis', 'Color Analysis')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">{t('preflight.colorSpaces', 'Color Spaces')}</p>
              <p className="font-medium">{report.colorAnalysis.colorSpaces?.join(', ') || 'N/A'}</p>
            </div>
            {report.colorAnalysis.hasSpotColors && (
              <div>
                <p className="text-sm text-gray-600">{t('preflight.spotColors', 'Spot Colors')}</p>
                <p className="font-medium">{report.colorAnalysis.spotColorNames?.join(', ') || 'None'}</p>
              </div>
            )}
            {report.colorAnalysis.cmykCoverage && (
              <div className="col-span-2">
                <p className="text-sm text-gray-600 mb-2">{t('preflight.cmykCoverage', 'CMYK Coverage')}</p>
                <div className="grid grid-cols-5 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">C:</span> {report.colorAnalysis.cmykCoverage.cyan?.toFixed(1)}%
                  </div>
                  <div>
                    <span className="text-gray-600">M:</span> {report.colorAnalysis.cmykCoverage.magenta?.toFixed(1)}%
                  </div>
                  <div>
                    <span className="text-gray-600">Y:</span> {report.colorAnalysis.cmykCoverage.yellow?.toFixed(1)}%
                  </div>
                  <div>
                    <span className="text-gray-600">K:</span> {report.colorAnalysis.cmykCoverage.black?.toFixed(1)}%
                  </div>
                  <div>
                    <span className="text-gray-600 font-semibold">Total:</span>{' '}
                    <span className={report.colorAnalysis.cmykCoverage.total > 320 ? 'text-danger-600 font-bold' : ''}>
                      {report.colorAnalysis.cmykCoverage.total?.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Analysis */}
      {report.imageAnalysis && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <ImageIcon className="h-5 w-5 mr-2" />
            {t('preflight.imageAnalysis', 'Image Analysis')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">{t('preflight.totalImages', 'Total Images')}</p>
              <p className="font-medium">{report.imageAnalysis.totalImages}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('preflight.minResolution', 'Min Resolution')}</p>
              <p className="font-medium">{report.imageAnalysis.minResolutionDpi} DPI</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('preflight.avgResolution', 'Avg Resolution')}</p>
              <p className="font-medium">{report.imageAnalysis.avgResolutionDpi} DPI</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('preflight.lowResImages', 'Low Res Images')}</p>
              <p className={clsx('font-medium', report.imageAnalysis.lowResImageCount > 0 && 'text-danger-600')}>
                {report.imageAnalysis.lowResImageCount}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Issues List */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {t('preflight.issues', 'Validation Issues')} ({issues.length})
        </h2>
        <div className="space-y-3">
          {/* Errors */}
          {errors.length > 0 && (
            <div>
              <h3 className="font-semibold text-danger-700 mb-2 flex items-center">
                <XCircle className="h-4 w-4 mr-2" />
                {t('preflight.errors', 'Errors')} ({errors.length})
              </h3>
              {errors.map((issue: any, index: number) => (
                <div key={index} className="border-l-4 border-danger-500 bg-danger-50 p-3 mb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', getSeverityColor(issue.severity))}>
                          {issue.severity}
                        </span>
                        <span className="text-xs text-gray-500">{issue.errorCode}</span>
                        {issue.pageNumber && (
                          <span className="text-xs text-gray-500">Page {issue.pageNumber}</span>
                        )}
                      </div>
                      <p className="font-medium text-sm">{issue.errorMessage}</p>
                      {issue.suggestedFix && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Fix:</span> {issue.suggestedFix}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div>
              <h3 className="font-semibold text-warning-700 mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                {t('preflight.warnings', 'Warnings')} ({warnings.length})
              </h3>
              {warnings.map((issue: any, index: number) => (
                <div key={index} className="border-l-4 border-warning-500 bg-warning-50 p-3 mb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', getSeverityColor(issue.severity))}>
                          {issue.severity}
                        </span>
                        <span className="text-xs text-gray-500">{issue.errorCode}</span>
                        {issue.pageNumber && (
                          <span className="text-xs text-gray-500">Page {issue.pageNumber}</span>
                        )}
                      </div>
                      <p className="font-medium text-sm">{issue.errorMessage}</p>
                      {issue.suggestedFix && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Fix:</span> {issue.suggestedFix}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {issues.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-success-500 mx-auto mb-2" />
              <p className="text-gray-500">{t('preflight.noIssues', 'No validation issues found')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">{t('preflight.approveReport', 'Approve Report')}</h2>
            <p className="text-gray-600 mb-4">
              {t('preflight.approveConfirm', 'Are you sure you want to approve this preflight report?')}
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 mb-4"
              rows={3}
              placeholder={t('preflight.approvalNotes', 'Optional notes...')}
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
            />
            <div className="flex justify-end space-x-3">
              <button className="btn-secondary" onClick={() => setShowApprovalModal(false)}>
                Cancel
              </button>
              <button className="btn-success" onClick={handleApprove}>
                <ThumbsUp className="h-4 w-4 mr-2" />
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">{t('preflight.rejectReport', 'Reject Report')}</h2>
            <p className="text-gray-600 mb-4">
              {t('preflight.rejectConfirm', 'Please provide a reason for rejecting this report:')}
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 mb-4"
              rows={3}
              placeholder={t('preflight.rejectionReason', 'Rejection reason (required)...')}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
            />
            <div className="flex justify-end space-x-3">
              <button className="btn-secondary" onClick={() => setShowRejectionModal(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleReject}>
                <ThumbsDown className="h-4 w-4 mr-2" />
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
