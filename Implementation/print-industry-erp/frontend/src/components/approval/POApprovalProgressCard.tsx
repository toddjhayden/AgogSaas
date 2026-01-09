import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Clock, AlertCircle, User, ArrowRight } from 'lucide-react';

interface ApprovalProgress {
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
  nextApproverUserId?: string;
  nextApproverName?: string;
  slaDeadline?: string;
  hoursRemaining?: number;
  isOverdue: boolean;
}

interface POApprovalProgressCardProps {
  progress: ApprovalProgress;
  workflowName?: string;
  approvalType?: 'SEQUENTIAL' | 'PARALLEL' | 'ANY_ONE';
}

export const POApprovalProgressCard: React.FC<POApprovalProgressCardProps> = ({
  progress,
  workflowName,
  approvalType,
}) => {
  const { t } = useTranslation();

  const getApprovalTypeIcon = () => {
    switch (approvalType) {
      case 'SEQUENTIAL':
        return <ArrowRight className="h-4 w-4" />;
      case 'PARALLEL':
        return <CheckCircle className="h-4 w-4" />;
      case 'ANY_ONE':
        return <User className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    if (progress.isOverdue) return 'red';
    if (progress.hoursRemaining && progress.hoursRemaining < 24) return 'yellow';
    return 'green';
  };

  const statusColor = getStatusColor();

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <h3 className="text-lg font-bold">{t('approvals.approvalProgress')}</h3>
          </div>
          {approvalType && (
            <div className="flex items-center space-x-1 bg-white bg-opacity-20 rounded-full px-3 py-1">
              {getApprovalTypeIcon()}
              <span className="text-xs font-medium">{t(`approvals.${approvalType.toLowerCase()}`)}</span>
            </div>
          )}
        </div>
        {workflowName && (
          <p className="text-sm text-primary-100 mt-1">{workflowName}</p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-4">
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>
              {t('approvals.step')} {progress.currentStep} {t('common.of')} {progress.totalSteps}
            </span>
            <span className="font-medium text-primary-600">
              {progress.percentComplete.toFixed(0)}% {t('common.complete')}
            </span>
          </div>

          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>

            {/* Step indicators */}
            <div className="absolute top-0 left-0 w-full h-3 flex justify-between px-1">
              {Array.from({ length: progress.totalSteps }).map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full mt-0.5 ${
                    index < progress.currentStep
                      ? 'bg-green-500'
                      : index === progress.currentStep
                      ? 'bg-yellow-500'
                      : 'bg-gray-300'
                  }`}
                  title={`Step ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Next Approver */}
        {progress.nextApproverName && (
          <div className="flex items-center space-x-2 py-3 px-4 bg-blue-50 rounded-lg border border-blue-200">
            <User className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-900">{t('approvals.nextApprover')}</p>
              <p className="text-sm font-bold text-blue-700">{progress.nextApproverName}</p>
            </div>
          </div>
        )}

        {/* SLA Status */}
        {progress.slaDeadline && (
          <div className={`flex items-center space-x-2 py-3 px-4 bg-${statusColor}-50 rounded-lg border border-${statusColor}-200 mt-3`}>
            {progress.isOverdue ? (
              <AlertCircle className={`h-5 w-5 text-${statusColor}-600`} />
            ) : (
              <Clock className={`h-5 w-5 text-${statusColor}-600`} />
            )}
            <div className="flex-1">
              {progress.isOverdue ? (
                <>
                  <p className="text-xs font-medium text-red-900">{t('approvals.slaStatus')}</p>
                  <p className="text-sm font-bold text-red-700">{t('approvals.overdue')}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-gray-700">{t('approvals.timeRemaining')}</p>
                  <p className="text-sm font-bold text-gray-900">
                    {Math.round(progress.hoursRemaining || 0)}h {t('approvals.remaining')}
                  </p>
                </>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600">{t('approvals.slaDeadline')}</p>
              <p className="text-xs font-medium text-gray-900">
                {new Date(progress.slaDeadline).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer with step breakdown */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>{t('approvals.completed')}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span>{t('approvals.inProgress')}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-gray-300"></div>
              <span>{t('approvals.pending')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
