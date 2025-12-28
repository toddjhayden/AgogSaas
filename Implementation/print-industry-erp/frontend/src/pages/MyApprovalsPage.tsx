import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle, FileText, Filter, Calendar, User, MessageSquare, UserX } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/common/DataTable';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { useAuth } from '../hooks/useAuth';
import {
  GET_MY_PENDING_APPROVALS,
  APPROVE_PO_WORKFLOW_STEP,
  REJECT_PO,
  REQUEST_PO_CHANGES,
  DELEGATE_APPROVAL
} from '../graphql/queries/approvals';

interface PendingApproval {
  purchaseOrderId: string;
  tenantId: string;
  poNumber: string;
  poDate: string;
  vendorId: string;
  vendorName: string;
  facilityId: string;
  facilityName: string;
  totalAmount: number;
  poCurrencyCode: string;
  status: string;
  requestedDeliveryDate?: string;
  currentApprovalWorkflowId?: string;
  currentApprovalStepNumber?: number;
  currentStepName?: string;
  approvalStartedAt: string;
  pendingApproverUserId: string;
  slaHoursPerStep?: number;
  slaDeadline?: string;
  hoursRemaining?: number;
  isOverdue: boolean;
  urgencyLevel: 'URGENT' | 'WARNING' | 'NORMAL';
  requesterUserId?: string;
  requesterName?: string;
  createdAt: string;
  updatedAt?: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  ISSUED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const urgencyColors: Record<string, string> = {
  URGENT: 'border-l-4 border-red-500',
  WARNING: 'border-l-4 border-yellow-500',
  NORMAL: 'border-l-4 border-blue-500',
};

export const MyApprovalsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userId, tenantId } = useAuth();
  const [amountFilter, setAmountFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<'URGENT' | 'WARNING' | 'NORMAL' | ''>('');

  // Modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PendingApproval | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [changeRequest, setChangeRequest] = useState('');
  const [approvalComments, setApprovalComments] = useState('');
  const [delegateUserId, setDelegateUserId] = useState('');

  const { data, loading, error, refetch } = useQuery(GET_MY_PENDING_APPROVALS, {
    variables: {
      tenantId,
      userId,
      urgencyLevel: urgencyFilter || undefined,
    },
    pollInterval: 30000, // Poll every 30 seconds for real-time updates
  });

  const [approvePO] = useMutation(APPROVE_PO_WORKFLOW_STEP, {
    onCompleted: () => {
      refetch();
    },
  });

  const [rejectPO] = useMutation(REJECT_PO, {
    onCompleted: () => {
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedPO(null);
      refetch();
    },
  });

  const [requestChanges] = useMutation(REQUEST_PO_CHANGES, {
    onCompleted: () => {
      setShowChangesModal(false);
      setChangeRequest('');
      setSelectedPO(null);
      refetch();
    },
  });

  const [delegateApproval] = useMutation(DELEGATE_APPROVAL, {
    onCompleted: () => {
      setShowDelegateModal(false);
      setDelegateUserId('');
      setSelectedPO(null);
      refetch();
    },
  });

  const pendingApprovals: PendingApproval[] = useMemo(() => {
    if (!data?.getMyPendingApprovals) return [];

    let filtered = data.getMyPendingApprovals;

    // Apply amount filter
    if (amountFilter === 'UNDER_5K') {
      filtered = filtered.filter((po: PendingApproval) => po.totalAmount < 5000);
    } else if (amountFilter === '5K_TO_25K') {
      filtered = filtered.filter((po: PendingApproval) => po.totalAmount >= 5000 && po.totalAmount <= 25000);
    } else if (amountFilter === 'OVER_25K') {
      filtered = filtered.filter((po: PendingApproval) => po.totalAmount > 25000);
    }

    return filtered;
  }, [data, amountFilter]);

  const handleQuickApprove = async (poId: string) => {
    if (window.confirm(t('approvals.confirmQuickApprove'))) {
      await approvePO({
        variables: {
          purchaseOrderId: poId,
          approvedByUserId: userId,
          tenantId,
          comments: 'Quick approval from My Approvals dashboard',
        },
      });
    }
  };

  const handleReject = (po: PendingApproval) => {
    setSelectedPO(po);
    setShowRejectModal(true);
  };

  const handleRequestChanges = (po: PendingApproval) => {
    setSelectedPO(po);
    setShowChangesModal(true);
  };

  const handleDelegate = (po: PendingApproval) => {
    setSelectedPO(po);
    setShowDelegateModal(true);
  };

  const confirmReject = async () => {
    if (!selectedPO || !rejectionReason.trim()) {
      alert(t('approvals.rejectionReasonRequired'));
      return;
    }

    await rejectPO({
      variables: {
        purchaseOrderId: selectedPO.purchaseOrderId,
        rejectedByUserId: userId,
        tenantId,
        rejectionReason: rejectionReason.trim(),
      },
    });
  };

  const confirmRequestChanges = async () => {
    if (!selectedPO || !changeRequest.trim()) {
      alert(t('approvals.changeRequestRequired'));
      return;
    }

    await requestChanges({
      variables: {
        purchaseOrderId: selectedPO.purchaseOrderId,
        requestedByUserId: userId,
        tenantId,
        changeRequest: changeRequest.trim(),
      },
    });
  };

  const confirmDelegate = async () => {
    if (!selectedPO || !delegateUserId.trim()) {
      alert(t('approvals.delegateUserRequired'));
      return;
    }

    await delegateApproval({
      variables: {
        purchaseOrderId: selectedPO.purchaseOrderId,
        delegatedByUserId: userId,
        delegatedToUserId: delegateUserId.trim(),
        tenantId,
        comments: `Delegated from My Approvals dashboard`,
      },
    });
  };

  const columns = useMemo<ColumnDef<PendingApproval>[]>(
    () => [
      {
        accessorKey: 'urgencyLevel',
        header: '',
        cell: ({ row }) => {
          const urgency = row.original.urgencyLevel;
          return (
            <div className="flex items-center">
              {urgency === 'URGENT' && <AlertCircle className="h-5 w-5 text-red-600" />}
              {urgency === 'WARNING' && <Clock className="h-5 w-5 text-yellow-600" />}
              {urgency === 'NORMAL' && <Clock className="h-5 w-5 text-blue-600" />}
            </div>
          );
        },
      },
      {
        accessorKey: 'poNumber',
        header: t('procurement.poNumber'),
        cell: ({ row }) => (
          <button
            onClick={() => navigate(`/procurement/purchase-orders/${row.original.purchaseOrderId}`)}
            className="text-primary-600 hover:text-primary-800 font-medium"
          >
            {row.original.poNumber}
          </button>
        ),
      },
      {
        accessorKey: 'vendorName',
        header: t('procurement.vendor'),
        cell: ({ row }) => row.original.vendorName || '-',
      },
      {
        accessorKey: 'facilityName',
        header: t('procurement.facility'),
        cell: ({ row }) => row.original.facilityName || '-',
      },
      {
        accessorKey: 'currentStepName',
        header: t('approvals.currentStep'),
        cell: ({ row }) => row.original.currentStepName || '-',
      },
      {
        accessorKey: 'totalAmount',
        header: t('procurement.totalAmount'),
        cell: ({ row }) => (
          <span className={row.original.totalAmount > 25000 ? 'font-bold text-purple-600' : ''}>
            {row.original.poCurrencyCode} {row.original.totalAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        accessorKey: 'hoursRemaining',
        header: t('approvals.timeRemaining'),
        cell: ({ row }) => {
          const hours = row.original.hoursRemaining || 0;
          const isOverdue = row.original.isOverdue;
          return (
            <span className={isOverdue ? 'text-red-600 font-bold' : hours < 24 ? 'text-yellow-600' : ''}>
              {isOverdue ? t('approvals.overdue') : `${Math.round(hours)}h`}
            </span>
          );
        },
      },
      {
        accessorKey: 'requesterName',
        header: t('approvals.requester'),
        cell: ({ row }) => (
          <div className="flex items-center space-x-1">
            <User className="h-4 w-4 text-gray-400" />
            <span>{row.original.requesterName || '-'}</span>
          </div>
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => (
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleQuickApprove(row.original.purchaseOrderId)}
              className="inline-flex items-center px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
              title={t('approvals.quickApprove')}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              {t('approvals.approve')}
            </button>
            <button
              onClick={() => handleReject(row.original)}
              className="inline-flex items-center px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
              title={t('approvals.reject')}
            >
              <XCircle className="h-3 w-3 mr-1" />
              {t('approvals.reject')}
            </button>
            <button
              onClick={() => handleRequestChanges(row.original)}
              className="inline-flex items-center px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors"
              title={t('approvals.requestChanges')}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              {t('approvals.changes')}
            </button>
            <button
              onClick={() => navigate(`/procurement/purchase-orders/${row.original.purchaseOrderId}`)}
              className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              title={t('approvals.viewDetails')}
            >
              <FileText className="h-3 w-3 mr-1" />
              {t('approvals.review')}
            </button>
          </div>
        ),
      },
    ],
    [t, navigate, userId, tenantId]
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600">{t('common.error')}: {error.message}</div>;

  const urgentCount = pendingApprovals.filter((po) => po.urgencyLevel === 'URGENT').length;
  const warningCount = pendingApprovals.filter((po) => po.urgencyLevel === 'WARNING').length;
  const overdueCount = pendingApprovals.filter((po) => po.isOverdue).length;
  const totalValue = pendingApprovals.reduce((sum, po) => sum + po.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('approvals.myApprovals')}</h1>
        <Breadcrumb />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('approvals.pendingTotal')}</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{pendingApprovals.length}</p>
            </div>
            <Clock className="h-10 w-10 text-yellow-500" />
          </div>
        </div>

        <div className="card border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('approvals.urgent')}</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{urgentCount}</p>
              <p className="text-xs text-gray-500 mt-1">{t('approvals.overdueSLA')}</p>
            </div>
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div className="card border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('approvals.needsAttention')}</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{warningCount}</p>
              <p className="text-xs text-gray-500 mt-1">{t('approvals.approaching SLA')}</p>
            </div>
            <Calendar className="h-10 w-10 text-orange-500" />
          </div>
        </div>

        <div className="card border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('approvals.totalValue')}</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <FileText className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={amountFilter}
            onChange={(e) => setAmountFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{t('approvals.allAmounts')}</option>
            <option value="UNDER_5K">{t('approvals.under5k')}</option>
            <option value="5K_TO_25K">{t('approvals.5kTo25k')}</option>
            <option value="OVER_25K">{t('approvals.over25k')}</option>
          </select>

          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{t('approvals.allUrgencies')}</option>
            <option value="URGENT">{t('approvals.urgent')}</option>
            <option value="WARNING">{t('approvals.warning')}</option>
            <option value="NORMAL">{t('approvals.normal')}</option>
          </select>

          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </button>
        </div>

        <div className="text-sm text-gray-500">
          {t('approvals.autoRefresh')}: {t('approvals.every30Seconds')}
        </div>
      </div>

      {/* Pending Approvals Table */}
      <div className="card">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('approvals.pendingMyApproval')}</h2>
          <DataTable columns={columns} data={pendingApprovals} searchable exportable />
        </div>
      </div>

      {/* Help Text */}
      {pendingApprovals.length === 0 && (
        <div className="card p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">{t('approvals.noApprovals')}</h3>
          <p className="text-gray-600">{t('approvals.allCaughtUp')}</p>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedPO && (
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
              <p className="text-sm text-gray-600 mb-2">
                {t('approvals.rejectingPO')}: <strong>{selectedPO.poNumber}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-2">
                {t('procurement.vendor')}: <strong>{selectedPO.vendorName}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {t('procurement.totalAmount')}: <strong>{selectedPO.poCurrencyCode} {selectedPO.totalAmount.toLocaleString()}</strong>
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
                onClick={confirmReject}
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
      {showChangesModal && selectedPO && (
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
              <p className="text-sm text-gray-600 mb-2">
                {t('approvals.requestingChangesFor')}: <strong>{selectedPO.poNumber}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-2">
                {t('procurement.vendor')}: <strong>{selectedPO.vendorName}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {t('procurement.totalAmount')}: <strong>{selectedPO.poCurrencyCode} {selectedPO.totalAmount.toLocaleString()}</strong>
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
                onClick={confirmRequestChanges}
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
      {showDelegateModal && selectedPO && (
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
              <p className="text-sm text-gray-600 mb-2">
                {t('approvals.delegatingPO')}: <strong>{selectedPO.poNumber}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {t('procurement.totalAmount')}: <strong>{selectedPO.poCurrencyCode} {selectedPO.totalAmount.toLocaleString()}</strong>
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
                onClick={confirmDelegate}
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
