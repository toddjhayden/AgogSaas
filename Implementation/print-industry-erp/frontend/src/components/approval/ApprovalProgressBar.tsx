import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Circle, Clock, User } from 'lucide-react';

interface ApprovalProgressBarProps {
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
  status: string;
}

export const ApprovalProgressBar: React.FC<ApprovalProgressBarProps> = ({
  approvalProgress,
  status
}) => {
  const { t } = useTranslation();

  if (!approvalProgress) {
    return null;
  }

  const { currentStep, totalSteps, percentComplete, nextApproverName, slaDeadline, hoursRemaining, isOverdue } = approvalProgress;

  const getStepStatus = (stepNumber: number): 'completed' | 'current' | 'pending' => {
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'current';
    return 'pending';
  };

  const getUrgencyColor = () => {
    if (isOverdue) return 'text-red-600 bg-red-50 border-red-200';
    if (hoursRemaining !== undefined && hoursRemaining < 24) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">
            {t('approvals.approvalProgress')}
          </h3>
          <p className="text-sm text-gray-500">
            Step {currentStep} of {totalSteps}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary-600">
            {Math.round(percentComplete)}%
          </div>
          <div className="text-xs text-gray-500">
            {t('approvals.complete')}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-out"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between items-center relative">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNumber) => {
          const stepStatus = getStepStatus(stepNumber);

          return (
            <div key={stepNumber} className="flex flex-col items-center flex-1">
              <div className="relative flex items-center justify-center">
                {stepStatus === 'completed' ? (
                  <CheckCircle className="h-8 w-8 text-green-600 fill-current" />
                ) : stepStatus === 'current' ? (
                  <div className="relative">
                    <Circle className="h-8 w-8 text-primary-600 fill-current" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-3 w-3 bg-white rounded-full animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <Circle className="h-8 w-8 text-gray-300" />
                )}
              </div>
              <div className="mt-2 text-center">
                <div
                  className={`text-xs font-medium ${
                    stepStatus === 'completed'
                      ? 'text-green-600'
                      : stepStatus === 'current'
                      ? 'text-primary-600'
                      : 'text-gray-400'
                  }`}
                >
                  Step {stepNumber}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Next Approver Info */}
      {nextApproverName && status === 'PENDING_APPROVAL' && (
        <div className={`p-4 rounded-lg border ${getUrgencyColor()}`}>
          <div className="flex items-center space-x-3">
            <User className="h-5 w-5" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {t('approvals.awaitingApproval')}
              </p>
              <p className="text-sm">
                {nextApproverName}
              </p>
            </div>
            {slaDeadline && (
              <div className="text-right">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <p className="text-xs font-medium">
                    {isOverdue
                      ? t('approvals.overdue')
                      : hoursRemaining !== undefined
                      ? `${Math.round(hoursRemaining)}h remaining`
                      : 'In progress'}
                  </p>
                </div>
                <p className="text-xs">
                  Due: {new Date(slaDeadline).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed Status */}
      {status === 'APPROVED' && (
        <div className="p-4 rounded-lg border border-green-200 bg-green-50">
          <div className="flex items-center space-x-3 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm font-medium">
              {t('approvals.allApprovalsComplete')}
            </p>
          </div>
        </div>
      )}

      {/* Rejected Status */}
      {status === 'REJECTED' && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50">
          <div className="flex items-center space-x-3 text-red-700">
            <Circle className="h-5 w-5" />
            <p className="text-sm font-medium">
              {t('approvals.rejected')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
