import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  MessageSquare,
  UserPlus,
  Clock,
  AlertTriangle,
  Package,
  DollarSign,
  Calendar,
  FileText,
  User,
} from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { useAuth } from '../hooks/useAuth';
import {
  GET_PURCHASE_ORDER,
} from '../graphql/queries/purchaseOrders';
import {
  GET_PO_APPROVAL_HISTORY,
} from '../graphql/queries/poApproval';
import {
  APPROVE_PO_WORKFLOW_STEP,
  REJECT_PO,
  REQUEST_PO_CHANGES,
  DELEGATE_APPROVAL,
  SUBMIT_PO_FOR_APPROVAL,
} from '../graphql/mutations/poApproval';

interface ApprovalHistoryEntry {
  id: string;
  action: string;
  actionByUserName?: string;
  actionDate: string;
  stepNumber?: number;
  stepName?: string;
  comments?: string;
  rejectionReason?: string;
  delegatedToUserName?: string;
  wasEscalated: boolean;
}

export const PurchaseOrderApprovalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userId, tenantId } = useAuth();

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [showDelegateModal, setShowDelegateModal] = useState(false);

  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [changeRequest, setChangeRequest] = useState('');
  const [delegateUserId, setDelegateUserId] = useState('');

  const { data: poData, loading: poLoading, error: poError, refetch: refetchPO } = useQuery(
    GET_PURCHASE_ORDER,
    {
      variables: { id },
    }
  );

  const { data: historyData, loading: historyLoading, refetch: refetchHistory } = useQuery(
    GET_PO_APPROVAL_HISTORY,
    {
      variables: {
        purchaseOrderId: id,
        tenantId,
      },
    }
  );

  const [submitForApproval] = useMutation(SUBMIT_PO_FOR_APPROVAL, {
    onCompleted: () => {
      refetchPO();
      refetchHistory();
    },
  });

  const [approvePO] = useMutation(APPROVE_PO_WORKFLOW_STEP, {
    onCompleted: () => {
      setShowApproveModal(false);
      setApprovalComments('');
      refetchPO();
      refetchHistory();
    },
  });

  const [rejectPO] = useMutation(REJECT_PO, {
    onCompleted: () => {
      setShowRejectModal(false);
      setRejectionReason('');
      refetchPO();
      refetchHistory();
    },
  });

  const [requestChanges] = useMutation(REQUEST_PO_CHANGES, {
    onCompleted: () => {
      setShowChangesModal(false);
      setChangeRequest('');
      refetchPO();
      refetchHistory();
    },
  });

  const [delegateApproval] = useMutation(DELEGATE_APPROVAL, {
    onCompleted: () => {
      setShowDelegateModal(false);
      setDelegateUserId('');
      refetchPO();
      refetchHistory();
    },
  });

  if (poLoading) return <LoadingSpinner />;
  if (poError) return <div className="text-red-600">{t('common.error')}: {poError.message}</div>;

  const po = poData?.purchaseOrder;
  const approvalHistory: ApprovalHistoryEntry[] = historyData?.getPOApprovalHistory || [];

  if (!po) {
    return <div className="text-red-600">{t('procurement.poNotFound')}</div>;
  }

  const canApprove = po.status === 'PENDING_APPROVAL' && po.pendingApproverUserId === userId;
  const canSubmitForApproval = po.status === 'DRAFT' && po.requiresApproval;

  const handleSubmitForApproval = async () => {
    if (window.confirm(t('approvals.confirmSubmitForApproval'))) {
      await submitForApproval({
        variables: {
          purchaseOrderId: id,
          submittedByUserId: userId,
          tenantId,
        },
      });
    }
  };

  const handleApprove = async () => {
    await approvePO({
      variables: {
        purchaseOrderId: id,
        approvedByUserId: userId,
        tenantId,
        comments: approvalComments.trim() || undefined,
      },
    });
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert(t('approvals.rejectionReasonRequired'));
      return;
    }

    await rejectPO({
      variables: {
        purchaseOrderId: id,
        rejectedByUserId: userId,
        tenantId,
        rejectionReason: rejectionReason.trim(),
      },
    });
  };

  const handleRequestChanges = async () => {
    if (!changeRequest.trim()) {
      alert(t('approvals.changeRequestRequired'));
      return;
    }

    await requestChanges({
      variables: {
        purchaseOrderId: id,
        requestedByUserId: userId,
        tenantId,
        changeRequest: changeRequest.trim(),
      },
    });
  };

  const handleDelegate = async () => {
    if (!delegateUserId.trim()) {
      alert(t('approvals.delegateUserRequired'));
      return;
    }

    await delegateApproval({
      variables: {
        purchaseOrderId: id,
        delegatedByUserId: userId,
        delegatedToUserId: delegateUserId.trim(),
        tenantId,
        comments: `Delegated from PO Approval Page`,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/procurement/purchase-orders')}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('procurement.purchaseOrder')} {po.poNumber}
            </h1>
            <Breadcrumb />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {canSubmitForApproval && (
            <button
              onClick={handleSubmitForApproval}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              {t('approvals.submitForApproval')}
            </button>
          )}
        </div>
      </div>

      {/* Approval Progress Bar */}
      {po.approvalProgress && (
        <div className="card">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{t('approvals.approvalProgress')}</h3>
              <span className="text-sm text-gray-600">
                {t('approvals.step')} {po.approvalProgress.currentStep} {t('common.of')}{' '}
                {po.approvalProgress.totalSteps}
              </span>
            </div>

            <div className="relative">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${po.approvalProgress.percentComplete}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                <span>{po.approvalProgress.percentComplete.toFixed(0)}% {t('common.complete')}</span>
                {po.approvalProgress.nextApproverName && (
                  <span className="flex items-center">
                    <User className="h-3 w-3 mr-1" />
                    {t('approvals.nextApprover')}: {po.approvalProgress.nextApproverName}
                  </span>
                )}
              </div>
            </div>

            {po.approvalProgress.slaDeadline && (
              <div className="mt-4 flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Clock className={`h-4 w-4 ${po.approvalProgress.isOverdue ? 'text-red-600' : 'text-yellow-600'}`} />
                  <span className={`text-sm ${po.approvalProgress.isOverdue ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                    {po.approvalProgress.isOverdue
                      ? t('approvals.overdue')
                      : `${Math.round(po.approvalProgress.hoursRemaining || 0)}h ${t('approvals.remaining')}`
                    }
                  </span>
                </div>
                <span className="text-sm text-gray-600">
                  {t('approvals.slaDeadline')}: {new Date(po.approvalProgress.slaDeadline).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval Actions */}
      {canApprove && (
        <div className="card border-l-4 border-yellow-500">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{t('approvals.actionRequired')}</h3>
                  <p className="text-sm text-gray-600">{t('approvals.pendingYourApproval')}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowApproveModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('approvals.approve')}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {t('approvals.reject')}
                </button>
                <button
                  onClick={() => setShowChangesModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t('approvals.requestChanges')}
                </button>
                <button
                  onClick={() => setShowDelegateModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('approvals.delegate')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PO Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('procurement.totalAmount')}</p>
                <p className="text-2xl font-bold text-primary-600 mt-2">
                  {po.poCurrencyCode} {po.totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-primary-500" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('procurement.orderDate')}</p>
                <p className="text-lg font-bold text-gray-900 mt-2">
                  {new Date(po.purchaseOrderDate).toLocaleDateString()}
                </p>
              </div>
              <Calendar className="h-10 w-10 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('procurement.lineItems')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{po.lines.length}</p>
              </div>
              <Package className="h-10 w-10 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{t('procurement.lineItems')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.line')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.material')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.description')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.quantity')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.unitPrice')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.lineTotal')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {po.lines.map((line: unknown) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{line.lineNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{line.materialCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{line.description}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {line.quantityOrdered} {line.unitOfMeasure}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {po.poCurrencyCode} {line.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {po.poCurrencyCode} {line.lineAmount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Approval History */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{t('approvals.approvalHistory')}</h3>
          {historyLoading ? (
            <LoadingSpinner />
          ) : approvalHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-4">{t('approvals.noHistory')}</p>
          ) : (
            <div className="space-y-4">
              {approvalHistory.map((entry) => (
                <div key={entry.id} className="border-l-4 border-primary-500 pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{entry.actionByUserName || t('common.unknown')}</span>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {entry.action}
                        </span>
                        {entry.wasEscalated && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            {t('approvals.escalated')}
                          </span>
                        )}
                      </div>
                      {entry.stepName && (
                        <p className="text-sm text-gray-600 mt-1">
                          {t('approvals.step')} {entry.stepNumber}: {entry.stepName}
                        </p>
                      )}
                      {entry.comments && (
                        <p className="text-sm text-gray-600 mt-1">{entry.comments}</p>
                      )}
                      {entry.rejectionReason && (
                        <p className="text-sm text-red-600 mt-1">
                          {t('approvals.rejectionReason')}: {entry.rejectionReason}
                        </p>
                      )}
                      {entry.delegatedToUserName && (
                        <p className="text-sm text-blue-600 mt-1">
                          {t('approvals.delegatedTo')}: {entry.delegatedToUserName}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(entry.actionDate).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{t('approvals.approvePO')}</h3>
              <button
                onClick={() => setShowApproveModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                {t('approvals.confirmApprovePO')} <strong>{po.poNumber}</strong>
              </p>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.comments')} ({t('common.optional')})
              </label>
              <textarea
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                placeholder={t('approvals.commentsPlaceholder')}
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {t('approvals.confirmApprove')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{t('approvals.rejectPO')}</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                {t('approvals.rejectingPO')}: <strong>{po.poNumber}</strong>
              </p>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.rejectionReason')} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                placeholder={t('approvals.rejectionReasonPlaceholder')}
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('approvals.confirmReject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Changes Modal */}
      {showChangesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{t('approvals.requestChanges')}</h3>
              <button
                onClick={() => setShowChangesModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                {t('approvals.requestingChangesFor')}: <strong>{po.poNumber}</strong>
              </p>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.changeRequest')} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={changeRequest}
                onChange={(e) => setChangeRequest(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                placeholder={t('approvals.changeRequestPlaceholder')}
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowChangesModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={!changeRequest.trim()}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('approvals.confirmRequestChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delegate Modal */}
      {showDelegateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{t('approvals.delegateApproval')}</h3>
              <button
                onClick={() => setShowDelegateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                {t('approvals.delegatingPO')}: <strong>{po.poNumber}</strong>
              </p>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.delegateUser')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={delegateUserId}
                onChange={(e) => setDelegateUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('approvals.delegateUserPlaceholder')}
              />
              <p className="text-xs text-gray-500 mt-1">{t('approvals.delegateUserHint')}</p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDelegateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelegate}
                disabled={!delegateUserId.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('approvals.confirmDelegate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
