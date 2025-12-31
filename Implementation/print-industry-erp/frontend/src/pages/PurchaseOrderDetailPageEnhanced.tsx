import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Printer,
  Download,
  Package,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { ApprovalActionModal } from '../components/approval/ApprovalActionModal';
import { ApprovalHistoryTimeline } from '../components/approval/ApprovalHistoryTimeline';
import {
  GET_PURCHASE_ORDER,
  UPDATE_PURCHASE_ORDER,
  CLOSE_PURCHASE_ORDER,
} from '../graphql/queries/purchaseOrders';
import {
  GET_APPROVAL_HISTORY,
  APPROVE_PO_WORKFLOW_STEP,
  REJECT_PO,
  SUBMIT_PO_FOR_APPROVAL,
} from '../graphql/queries/approvals';

interface PurchaseOrderLine {
  id: string;
  lineNumber: number;
  materialCode: string;
  description: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityRemaining: number;
  unitOfMeasure: string;
  unitPrice: number;
  lineAmount: number;
  status: string;
  requestedDeliveryDate?: string;
  promisedDeliveryDate?: string;
}

interface PurchaseOrder {
  id: string;
  tenantId: string;
  facilityId: string;
  poNumber: string;
  purchaseOrderDate: string;
  vendorId: string;
  poCurrencyCode: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  status: string;
  requiresApproval: boolean;
  approvedByUserId?: string;
  approvedAt?: string;
  requestedDeliveryDate?: string;
  promisedDeliveryDate?: string;
  paymentTerms?: string;
  notes?: string;
  lines: PurchaseOrderLine[];

  // New workflow fields from Roy's backend
  currentApprovalWorkflowId?: string;
  currentApprovalStepNumber?: number;
  approvalStartedAt?: string;
  approvalCompletedAt?: string;
  pendingApproverUserId?: string;
  approvalProgress?: {
    currentStep: number;
    totalSteps: number;
    percentComplete: number;
    nextApproverUserId?: string;
    nextApproverName?: string;
    slaDeadline?: string;
    hoursRemaining?: number;
    isOverdue: boolean;
  };

  createdAt: string;
  updatedAt?: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  ISSUED: 'bg-blue-100 text-blue-800',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-800',
  PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
};

const lineStatusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
};

export const PurchaseOrderDetailPageEnhanced: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [approvalModalType, setApprovalModalType] = useState<'APPROVE' | 'REJECT' | null>(null);
  useState(true); // Workflow details display state for future use

  // TODO: Get userId from auth context
  const userId = '1';

  const { data, loading, error, refetch } = useQuery(GET_PURCHASE_ORDER, {
    variables: { id },
    skip: !id,
  });

  // Get tenantId from PO data
  const tenantId = data?.purchaseOrder?.tenantId || '1';

  // Query approval history
  const { data: historyData } = useQuery(GET_APPROVAL_HISTORY, {
    variables: { purchaseOrderId: id, tenantId },
    skip: !id || !data?.purchaseOrder,
  });

  const [submitForApproval] = useMutation(SUBMIT_PO_FOR_APPROVAL, {
    onCompleted: () => refetch(),
  });

  const [approvePO] = useMutation(APPROVE_PO_WORKFLOW_STEP, {
    onCompleted: () => {
      setApprovalModalType(null);
      refetch();
    },
  });

  const [rejectPO] = useMutation(REJECT_PO, {
    onCompleted: () => {
      setApprovalModalType(null);
      refetch();
    },
  });

  const [updatePO] = useMutation(UPDATE_PURCHASE_ORDER, {
    onCompleted: () => refetch(),
  });

  const [closePO] = useMutation(CLOSE_PURCHASE_ORDER, {
    onCompleted: () => refetch(),
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600">{t('common.error')}: {error.message}</div>;
  if (!data?.purchaseOrder) return <div>{t('procurement.poNotFound')}</div>;

  const po: PurchaseOrder = data.purchaseOrder;

  const handleSubmitForApproval = async () => {
    if (window.confirm(t('approvals.confirmSubmitForApproval'))) {
      await submitForApproval({
        variables: {
          purchaseOrderId: po.id,
          submittedByUserId: userId,
          tenantId: po.tenantId,
        },
      });
    }
  };

  const handleApprove = async (comments?: string) => {
    await approvePO({
      variables: {
        purchaseOrderId: po.id,
        approvedByUserId: userId,
        tenantId: po.tenantId,
        comments,
      },
    });
  };

  const handleReject = async (reason: string) => {
    await rejectPO({
      variables: {
        purchaseOrderId: po.id,
        rejectedByUserId: userId,
        tenantId: po.tenantId,
        rejectionReason: reason,
      },
    });
  };

  const handleStatusChange = (newStatus: string) => {
    updatePO({
      variables: {
        id: po.id,
        status: newStatus,
      },
    });
  };

  const handleClose = () => {
    closePO({
      variables: {
        id: po.id,
      },
    });
  };

  // Determine what actions can be taken based on workflow status
  const isPendingWorkflowApproval = po.status === 'PENDING_APPROVAL';
  const isApproved = po.status === 'APPROVED';
  // isRejected status available if needed: po.status === 'REJECTED'
  const isDraft = po.status === 'DRAFT';

  const canSubmitForApproval = isDraft && po.requiresApproval && !po.currentApprovalWorkflowId;
  const canApprove = isPendingWorkflowApproval && po.pendingApproverUserId === userId;
  const canReject = isPendingWorkflowApproval && po.pendingApproverUserId === userId;
  const canIssue = isApproved || (po.approvedAt && isDraft && !po.requiresApproval);
  const canClose = po.status === 'RECEIVED';

  const approvalHistory = historyData?.getPOApprovalHistory || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/procurement/purchase-orders')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('procurement.backToList')}</span>
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{po.poNumber}</h1>
            <Breadcrumb />
          </div>
          <div className="flex items-center space-x-3">
            <span
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                statusColors[po.status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {t(`procurement.statuses.${po.status}`)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-3">
        {canSubmitForApproval && (
          <button
            onClick={handleSubmitForApproval}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Package className="h-4 w-4" />
            <span>{t('approvals.submitForApproval')}</span>
          </button>
        )}
        {canApprove && (
          <button
            onClick={() => setApprovalModalType('APPROVE')}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <CheckCircle className="h-4 w-4" />
            <span>{t('approvals.approve')}</span>
          </button>
        )}
        {canReject && (
          <button
            onClick={() => setApprovalModalType('REJECT')}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <XCircle className="h-4 w-4" />
            <span>{t('approvals.reject')}</span>
          </button>
        )}
        {canIssue && (
          <button
            onClick={() => handleStatusChange('ISSUED')}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Package className="h-4 w-4" />
            <span>{t('procurement.issue')}</span>
          </button>
        )}
        {canClose && (
          <button
            onClick={handleClose}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <XCircle className="h-4 w-4" />
            <span>{t('procurement.close')}</span>
          </button>
        )}
        <button
          onClick={() => window.print()}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Printer className="h-4 w-4" />
          <span>{t('procurement.print')}</span>
        </button>
        <button
          onClick={() => alert('Export PDF functionality')}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>{t('procurement.exportPDF')}</span>
        </button>
      </div>

      {/* Approval Status Alert */}
      {po.requiresApproval && !po.approvedAt && (
        <div className="card bg-yellow-50 border-l-4 border-yellow-400">
          <div className="flex items-center space-x-3">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                {t('approvals.pendingApprovalRequired')}
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                {t('approvals.poRequiresApprovalBeforeIssuing')}
              </p>
            </div>
            {canApprove && (
              <button
                onClick={() => setApprovalModalType('APPROVE')}
                className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
              >
                {t('approvals.reviewNow')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Approval Workflow Section - NEW */}
      {(po.requiresApproval || po.currentApprovalWorkflowId) && (
        <div className="space-y-6">
          {/* Approval Progress Card */}
          {po.approvalProgress && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {t('approvals.approvalWorkflow')}
              </h2>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{t('approvals.progress')}</span>
                  <span className="text-sm text-gray-500">
                    {po.approvalProgress.currentStep} / {po.approvalProgress.totalSteps}{' '}
                    {t('approvals.stepsApproved')}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-500 bg-blue-600"
                    style={{ width: `${po.approvalProgress.percentComplete}%` }}
                  />
                </div>
              </div>

              {/* Current Step Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">{t('approvals.currentStep')}</p>
                  <p className="font-medium text-gray-900">
                    {po.approvalProgress.currentStep} {t('approvals.of')} {po.approvalProgress.totalSteps}
                  </p>
                </div>
                {po.approvalProgress.nextApproverName && (
                  <div>
                    <p className="text-sm text-gray-600">{t('approvals.nextApprover')}</p>
                    <p className="font-medium text-gray-900">{po.approvalProgress.nextApproverName}</p>
                  </div>
                )}
                {po.approvalProgress.slaDeadline && (
                  <div>
                    <p className="text-sm text-gray-600">{t('approvals.slaDeadline')}</p>
                    <p className={`font-medium ${po.approvalProgress.isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                      {po.approvalProgress.isOverdue ? (
                        <span className="flex items-center space-x-1">
                          <AlertCircle className="h-4 w-4" />
                          <span>{t('approvals.overdue')}</span>
                        </span>
                      ) : (
                        <span>
                          {new Date(po.approvalProgress.slaDeadline).toLocaleString()}
                          {po.approvalProgress.hoursRemaining !== undefined && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({Math.round(po.approvalProgress.hoursRemaining)}h {t('approvals.remaining')})
                            </span>
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Approval History Timeline */}
          {approvalHistory.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {t('approvals.approvalHistory')}
              </h2>
              <ApprovalHistoryTimeline
                purchaseOrderId={po.id}
                tenantId={po.tenantId}
              />
            </div>
          )}
        </div>
      )}

      {/* PO Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('procurement.orderDetails')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">{t('procurement.poNumber')}</p>
              <p className="font-medium text-gray-900">{po.poNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('procurement.poDate')}</p>
              <p className="font-medium text-gray-900">
                {new Date(po.purchaseOrderDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('procurement.requestedDelivery')}</p>
              <p className="font-medium text-gray-900">
                {po.requestedDeliveryDate
                  ? new Date(po.requestedDeliveryDate).toLocaleDateString()
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('procurement.promisedDelivery')}</p>
              <p className="font-medium text-gray-900">
                {po.promisedDeliveryDate
                  ? new Date(po.promisedDeliveryDate).toLocaleDateString()
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('procurement.paymentTerms')}</p>
              <p className="font-medium text-gray-900">{po.paymentTerms || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('procurement.currency')}</p>
              <p className="font-medium text-gray-900">{po.poCurrencyCode}</p>
            </div>
          </div>
          {po.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">{t('procurement.notes')}</p>
              <p className="text-sm text-gray-900">{po.notes}</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="card bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('procurement.summary')}</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('procurement.subtotal')}</span>
              <span className="font-medium text-gray-900">
                {po.poCurrencyCode} {po.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('procurement.tax')}</span>
              <span className="font-medium text-gray-900">
                {po.poCurrencyCode} {po.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('procurement.shipping')}</span>
              <span className="font-medium text-gray-900">
                {po.poCurrencyCode} {po.shippingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-gray-300">
              <span className="text-base font-semibold text-gray-900">{t('procurement.total')}</span>
              <span className="text-lg font-bold text-primary-600">
                {po.poCurrencyCode} {po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {po.approvedAt && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">{t('procurement.approved')}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {new Date(po.approvedAt).toLocaleDateString()} {new Date(po.approvedAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('procurement.lineItems')}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.line')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.materialCode')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.description')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.qtyOrdered')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.qtyReceived')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.unitPrice')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.lineTotal')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.status')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {po.lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {line.lineNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {line.materialCode}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{line.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {line.quantityOrdered} {line.unitOfMeasure}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {line.quantityReceived} {line.unitOfMeasure}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {po.poCurrencyCode} {line.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    {po.poCurrencyCode} {line.lineAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        lineStatusColors[line.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {t(`procurement.lineStatuses.${line.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Action Modal */}
      {approvalModalType && (
        <ApprovalActionModal
          isOpen={true}
          onClose={() => setApprovalModalType(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          actionType={approvalModalType}
          poNumber={po.poNumber}
          amount={po.totalAmount}
          currency={po.poCurrencyCode}
        />
      )}
    </div>
  );
};
