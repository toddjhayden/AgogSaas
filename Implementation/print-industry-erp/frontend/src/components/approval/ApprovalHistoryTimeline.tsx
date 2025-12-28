import React from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  XCircle,
  Send,
  ArrowRightLeft,
  AlertTriangle,
  MessageSquare,
  Clock
} from 'lucide-react';
import { GET_APPROVAL_HISTORY } from '../../graphql/queries/approvals';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ApprovalHistoryTimelineProps {
  purchaseOrderId: string;
  tenantId: string;
}

interface ApprovalHistoryEntry {
  id: string;
  purchaseOrderId: string;
  workflowId?: string;
  stepId?: string;
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'DELEGATED' | 'ESCALATED' | 'REQUESTED_CHANGES' | 'CANCELLED';
  actionByUserId: string;
  actionByUserName?: string;
  actionDate: string;
  stepNumber?: number;
  stepName?: string;
  comments?: string;
  rejectionReason?: string;
  delegatedFromUserId?: string;
  delegatedFromUserName?: string;
  delegatedToUserId?: string;
  delegatedToUserName?: string;
  slaDeadline?: string;
  wasEscalated: boolean;
  createdAt: string;
}

const actionConfig = {
  SUBMITTED: {
    icon: Send,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Submitted for Approval',
  },
  APPROVED: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Approved',
  },
  REJECTED: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Rejected',
  },
  DELEGATED: {
    icon: ArrowRightLeft,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Delegated',
  },
  ESCALATED: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Escalated',
  },
  REQUESTED_CHANGES: {
    icon: MessageSquare,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Changes Requested',
  },
  CANCELLED: {
    icon: XCircle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Cancelled',
  },
};

export const ApprovalHistoryTimeline: React.FC<ApprovalHistoryTimelineProps> = ({
  purchaseOrderId,
  tenantId
}) => {
  const { t } = useTranslation();

  const { data, loading, error } = useQuery(GET_APPROVAL_HISTORY, {
    variables: { purchaseOrderId, tenantId },
    skip: !purchaseOrderId || !tenantId,
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-4 bg-red-50 rounded-lg">
        <p className="font-medium">{t('common.error')}</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  const history: ApprovalHistoryEntry[] = data?.getPOApprovalHistory || [];

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="h-12 w-12 mx-auto mb-2 text-gray-400" />
        <p>{t('approvals.noHistoryYet')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {history.map((entry, index) => {
        const config = actionConfig[entry.action];
        const Icon = config.icon;
        const isLast = index === history.length - 1;

        return (
          <div key={entry.id} className="relative">
            {!isLast && (
              <div
                className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200"
                style={{ height: 'calc(100% + 1.5rem)' }}
              />
            )}

            <div className="flex items-start space-x-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center z-10`}>
                <Icon className={`h-5 w-5 ${config.color}`} />
              </div>

              <div className="flex-1 pb-8">
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {config.label}
                        {entry.stepName && (
                          <span className="text-gray-600 ml-2">
                            - {entry.stepName}
                          </span>
                        )}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {entry.actionByUserName || 'Unknown User'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {new Date(entry.actionDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(entry.actionDate).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  {entry.stepNumber && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium mb-2">
                      Step {entry.stepNumber}
                    </div>
                  )}

                  {entry.comments && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-100">
                      <p className="text-xs font-medium text-blue-900 mb-1">Comments:</p>
                      <p className="text-sm text-blue-800">{entry.comments}</p>
                    </div>
                  )}

                  {entry.rejectionReason && (
                    <div className="mt-3 p-3 bg-red-50 rounded-md border border-red-100">
                      <p className="text-xs font-medium text-red-900 mb-1">Rejection Reason:</p>
                      <p className="text-sm text-red-800">{entry.rejectionReason}</p>
                    </div>
                  )}

                  {entry.action === 'DELEGATED' && (entry.delegatedFromUserName || entry.delegatedToUserName) && (
                    <div className="mt-3 p-3 bg-purple-50 rounded-md border border-purple-100">
                      <p className="text-xs font-medium text-purple-900 mb-1">Delegation Details:</p>
                      <p className="text-sm text-purple-800">
                        From: {entry.delegatedFromUserName || 'Unknown'}
                        {' → '}
                        To: {entry.delegatedToUserName || 'Unknown'}
                      </p>
                    </div>
                  )}

                  {entry.slaDeadline && (
                    <div className="mt-3 flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>
                        SLA Deadline: {new Date(entry.slaDeadline).toLocaleString()}
                      </span>
                      {entry.wasEscalated && (
                        <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full">
                          Escalated
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
