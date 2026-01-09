import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Users,
  Search,
  Filter,
  History,
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { DataTable } from '../components/common/DataTable';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import {
  GET_MY_PENDING_APPROVALS,
  GET_PO_APPROVAL_HISTORY,
} from '../graphql/queries/poApproval';
import {
  APPROVE_PO_WORKFLOW_STEP,
  REJECT_PO,
  DELEGATE_APPROVAL,
} from '../graphql/mutations/poApproval';

interface PendingApprovalItem {
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
  urgencyLevel: string;
  requesterUserId?: string;
  requesterName?: string;
  createdAt: string;
  updatedAt?: string;
}

export const POApprovalPage: React.FC = () => {
  const { t } = useTranslation();
  useAppStore();
  const user = useAuthStore((state: { user: any }) => state.user);

  const [filters, setFilters] = useState({
    urgencyLevel: '',
    amountMin: '',
    amountMax: '',
    searchTerm: '',
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PendingApprovalItem | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [showDelegationDialog, setShowDelegationDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [delegateToUserId, setDelegateToUserId] = useState('');

  // Fetch pending approvals
  const { data, loading, error, refetch } = useQuery(GET_MY_PENDING_APPROVALS, {
    variables: {
      tenantId: user?.tenantId,
      userId: user?.id,
      amountMin: filters.amountMin ? parseFloat(filters.amountMin) : undefined,
      amountMax: filters.amountMax ? parseFloat(filters.amountMax) : undefined,
      urgencyLevel: filters.urgencyLevel || undefined,
    },
    skip: !user?.tenantId || !user?.id,
    pollInterval: 60000, // Poll every minute
  });

  // Fetch approval history when viewing details
  const {
    data: historyData,
    loading: historyLoading,
    refetch: refetchHistory,
  } = useQuery(GET_PO_APPROVAL_HISTORY, {
    variables: {
      purchaseOrderId: selectedPO?.purchaseOrderId,
      tenantId: user?.tenantId,
    },
    skip: !selectedPO || !showHistoryDialog,
  });

  // Mutations
  const [approvePO, { loading: approving }] = useMutation(APPROVE_PO_WORKFLOW_STEP, {
    onCompleted: () => {
      refetch();
      setShowApprovalDialog(false);
      setSelectedPO(null);
      setComments('');
      alert(t('PO approved successfully'));
    },
    onError: (error) => {
      alert(t('Failed to approve PO: ') + error.message);
    },
  });

  const [rejectPO, { loading: rejecting }] = useMutation(REJECT_PO, {
    onCompleted: () => {
      refetch();
      setShowRejectionDialog(false);
      setSelectedPO(null);
      setRejectionReason('');
      alert(t('PO rejected successfully'));
    },
    onError: (error) => {
      alert(t('Failed to reject PO: ') + error.message);
    },
  });

  const [delegateApproval, { loading: delegating }] = useMutation(DELEGATE_APPROVAL, {
    onCompleted: () => {
      refetch();
      setShowDelegationDialog(false);
      setSelectedPO(null);
      setDelegateToUserId('');
      setComments('');
      alert(t('Approval delegated successfully'));
    },
    onError: (error) => {
      alert(t('Failed to delegate approval: ') + error.message);
    },
  });

  const approvals: PendingApprovalItem[] = data?.getMyPendingApprovals || [];
  const approvalHistory = historyData?.getPOApprovalHistory || [];

  // Filter approvals
  const filteredApprovals = approvals.filter((approval) => {
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      return (
        approval.poNumber.toLowerCase().includes(searchLower) ||
        approval.vendorName.toLowerCase().includes(searchLower) ||
        approval.requesterName?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Handlers
  const handleApprove = () => {
    if (!selectedPO) return;
    approvePO({
      variables: {
        purchaseOrderId: selectedPO.purchaseOrderId,
        approvedByUserId: user?.id,
        tenantId: user?.tenantId,
        comments: comments || undefined,
      },
    });
  };

  const handleReject = () => {
    if (!selectedPO || !rejectionReason.trim()) {
      alert(t('Please provide a rejection reason'));
      return;
    }
    rejectPO({
      variables: {
        purchaseOrderId: selectedPO.purchaseOrderId,
        rejectedByUserId: user?.id,
        tenantId: user?.tenantId,
        rejectionReason,
      },
    });
  };

  const handleDelegate = () => {
    if (!selectedPO || !delegateToUserId) {
      alert(t('Please select a user to delegate to'));
      return;
    }
    delegateApproval({
      variables: {
        purchaseOrderId: selectedPO.purchaseOrderId,
        delegatedByUserId: user?.id,
        delegatedToUserId: delegateToUserId,
        tenantId: user?.tenantId,
        comments: comments || undefined,
      },
    });
  };

  const handleViewHistory = (approval: PendingApprovalItem) => {
    setSelectedPO(approval);
    setShowHistoryDialog(true);
    refetchHistory();
  };

  // Urgency badge
  const getUrgencyBadge = (urgency: string, isOverdue: boolean) => {
    if (isOverdue) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {t('Overdue')}
        </span>
      );
    }
    switch (urgency) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
            {t('Urgent')}
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
            {t('Warning')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            {t('Normal')}
          </span>
        );
    }
  };

  // Action column
  const getActionColumn = (approval: PendingApprovalItem) => (
    <div className="flex space-x-2">
      <button
        onClick={() => {
          setSelectedPO(approval);
          setShowApprovalDialog(true);
        }}
        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        title={t('Approve')}
      >
        <CheckCircle className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          setSelectedPO(approval);
          setShowRejectionDialog(true);
        }}
        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
        title={t('Reject')}
      >
        <XCircle className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          setSelectedPO(approval);
          setShowDelegationDialog(true);
        }}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        title={t('Delegate')}
      >
        <Users className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleViewHistory(approval)}
        className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
        title={t('View History')}
      >
        <History className="w-4 h-4" />
      </button>
    </div>
  );

  const columns = [
    {
      key: 'urgency',
      header: t('Priority'),
      render: (row: PendingApprovalItem) => getUrgencyBadge(row.urgencyLevel, row.isOverdue),
    },
    { key: 'poNumber', header: t('PO Number') },
    { key: 'vendorName', header: t('Vendor') },
    { key: 'facilityName', header: t('Facility') },
    {
      key: 'totalAmount',
      header: t('Amount'),
      render: (row: PendingApprovalItem) =>
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: row.poCurrencyCode || 'USD',
        }).format(row.totalAmount),
    },
    { key: 'currentStepName', header: t('Current Step') },
    {
      key: 'requesterName',
      header: t('Requester'),
      render: (row: PendingApprovalItem) => row.requesterName || '-',
    },
    {
      key: 'hoursRemaining',
      header: t('SLA'),
      render: (row: PendingApprovalItem) => {
        if (!row.hoursRemaining) return '-';
        const hours = Math.floor(row.hoursRemaining);
        return row.isOverdue
          ? `${t('Overdue by')} ${Math.abs(hours)}h`
          : `${hours}h ${t('remaining')}`;
      },
    },
    {
      key: 'actions',
      header: t('Actions'),
      render: (row: PendingApprovalItem) => getActionColumn(row),
    },
  ];

  // Summary stats
  const totalPending = approvals.length;
  const overdueCount = approvals.filter((a) => a.isOverdue).length;
  const urgentCount = approvals.filter((a) => a.urgencyLevel === 'URGENT').length;
  const totalValue = approvals.reduce((sum, a) => sum + a.totalAmount, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Breadcrumb
        items={[
          { label: t('Home'), path: '/' },
          { label: t('My PO Approvals'), path: '/po-approvals' },
        ]}
      />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('Purchase Order Approvals')}
        </h1>
        <p className="text-gray-600">{t('Review and approve pending purchase orders')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('Total Pending')}</p>
              <p className="text-2xl font-bold text-gray-900">{totalPending}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('Overdue')}</p>
              <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('Urgent')}</p>
              <p className="text-2xl font-bold text-orange-600">{urgentCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('Total Value')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  notation: 'compact',
                }).format(totalValue)}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <Filter className="w-4 h-4 mr-2" />
          {t('Filters')}
        </button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Search')}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                placeholder={t('PO#, Vendor, Requester...')}
                className="w-full pl-10 pr-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Urgency')}
            </label>
            <select
              value={filters.urgencyLevel}
              onChange={(e) => setFilters({ ...filters, urgencyLevel: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">{t('All')}</option>
              <option value="URGENT">{t('Urgent')}</option>
              <option value="WARNING">{t('Warning')}</option>
              <option value="NORMAL">{t('Normal')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Min Amount')}
            </label>
            <input
              type="number"
              value={filters.amountMin}
              onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Max Amount')}
            </label>
            <input
              type="number"
              value={filters.amountMax}
              onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })}
              placeholder="999999"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Data Table */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
          {t('Error loading approvals: ') + error.message}
        </div>
      )}

      <DataTable
        data={filteredApprovals}
        columns={columns}
        loading={loading}
        emptyMessage={t('No pending approvals')}
      />

      {/* Approval Dialog */}
      {showApprovalDialog && selectedPO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">{t('Approve Purchase Order')}</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                {t('PO Number')}: <strong>{selectedPO.poNumber}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-2">
                {t('Vendor')}: <strong>{selectedPO.vendorName}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {t('Amount')}:{' '}
                <strong>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: selectedPO.poCurrencyCode || 'USD',
                  }).format(selectedPO.totalAmount)}
                </strong>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Comments (Optional)')}
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                placeholder={t('Add any comments...')}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowApprovalDialog(false);
                  setSelectedPO(null);
                  setComments('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={approving}
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                disabled={approving}
              >
                {approving ? t('Approving...') : t('Approve')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Dialog */}
      {showRejectionDialog && selectedPO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">{t('Reject Purchase Order')}</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                {t('PO Number')}: <strong>{selectedPO.poNumber}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {t('Vendor')}: <strong>{selectedPO.vendorName}</strong>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Rejection Reason')} <span className="text-red-600">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                placeholder={t('Please provide a reason for rejection...')}
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRejectionDialog(false);
                  setSelectedPO(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={rejecting}
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={rejecting || !rejectionReason.trim()}
              >
                {rejecting ? t('Rejecting...') : t('Reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delegation Dialog */}
      {showDelegationDialog && selectedPO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">{t('Delegate Approval')}</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                {t('PO Number')}: <strong>{selectedPO.poNumber}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {t('Vendor')}: <strong>{selectedPO.vendorName}</strong>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Delegate To User ID')} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={delegateToUserId}
                onChange={(e) => setDelegateToUserId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg mb-3"
                placeholder={t('Enter user ID...')}
                required
              />
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Comments (Optional)')}
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                placeholder={t('Add any comments...')}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDelegationDialog(false);
                  setSelectedPO(null);
                  setDelegateToUserId('');
                  setComments('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={delegating}
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleDelegate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={delegating || !delegateToUserId.trim()}
              >
                {delegating ? t('Delegating...') : t('Delegate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Dialog */}
      {showHistoryDialog && selectedPO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {t('Approval History')} - {selectedPO.poNumber}
            </h2>
            {historyLoading ? (
              <div className="text-center py-8">{t('Loading history...')}</div>
            ) : approvalHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">{t('No history available')}</div>
            ) : (
              <div className="space-y-4">
                {approvalHistory.map((entry: unknown) => (
                  <div key={entry.id} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {entry.action === 'APPROVED' && (
                            <CheckCircle className="inline w-5 h-5 text-green-600 mr-1" />
                          )}
                          {entry.action === 'REJECTED' && (
                            <XCircle className="inline w-5 h-5 text-red-600 mr-1" />
                          )}
                          {entry.action === 'DELEGATED' && (
                            <Users className="inline w-5 h-5 text-blue-600 mr-1" />
                          )}
                          {entry.stepName || entry.action}
                        </p>
                        <p className="text-sm text-gray-600">
                          {t('By')}: {entry.actionByUserName || entry.actionByUserId}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(entry.actionDate).toLocaleString()}
                        </p>
                        {entry.comments && (
                          <p className="text-sm text-gray-700 mt-2 italic">"{entry.comments}"</p>
                        )}
                        {entry.rejectionReason && (
                          <p className="text-sm text-red-700 mt-2">
                            {t('Reason')}: {entry.rejectionReason}
                          </p>
                        )}
                        {entry.delegatedToUserName && (
                          <p className="text-sm text-blue-700 mt-2">
                            {t('Delegated to')}: {entry.delegatedToUserName}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {entry.wasEscalated && (
                          <span className="inline-block px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                            {t('Escalated')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowHistoryDialog(false);
                  setSelectedPO(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
