import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Circle, Clock, XCircle, AlertCircle } from 'lucide-react';

export interface ApprovalStep {
  stepNumber: number;
  stepName?: string;
  requiredRole?: string;
  requiredUserId?: string;
  approverName?: string;
  approvalLimit?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  approvedAt?: string;
  approvedBy?: string;
  slaHours?: number;
  slaDaysRemaining?: number;
}

interface ApprovalWorkflowProgressProps {
  steps: ApprovalStep[];
  currentStep: number;
  isComplete: boolean;
  workflowStatus?: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
}

export const ApprovalWorkflowProgress: React.FC<ApprovalWorkflowProgressProps> = ({
  steps,
  currentStep,
  isComplete,
  workflowStatus,
}) => {
  const { t } = useTranslation();

  const getStepIcon = (step: ApprovalStep) => {
    switch (step.status) {
      case 'APPROVED':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="h-6 w-6 text-red-600" />;
      case 'IN_PROGRESS':
        return <Clock className="h-6 w-6 text-blue-600 animate-pulse" />;
      case 'SKIPPED':
        return <Circle className="h-6 w-6 text-gray-400" />;
      case 'PENDING':
      default:
        return <Circle className="h-6 w-6 text-gray-300" />;
    }
  };

  const getStepColor = (step: ApprovalStep, index: number) => {
    if (step.status === 'APPROVED') return 'border-green-500 bg-green-50';
    if (step.status === 'REJECTED') return 'border-red-500 bg-red-50';
    if (step.status === 'IN_PROGRESS' || index + 1 === currentStep)
      return 'border-blue-500 bg-blue-50';
    if (step.status === 'SKIPPED') return 'border-gray-300 bg-gray-50';
    return 'border-gray-200 bg-white';
  };

  const getStatusBadge = () => {
    if (!workflowStatus) return null;

    const badges = {
      PENDING: { color: 'bg-gray-100 text-gray-800', text: t('approvals.status.pending') },
      IN_PROGRESS: { color: 'bg-blue-100 text-blue-800', text: t('approvals.status.inProgress') },
      APPROVED: { color: 'bg-green-100 text-green-800', text: t('approvals.status.approved') },
      REJECTED: { color: 'bg-red-100 text-red-800', text: t('approvals.status.rejected') },
      CANCELLED: { color: 'bg-gray-100 text-gray-600', text: t('approvals.status.cancelled') },
    };

    const badge = badges[workflowStatus];
    if (!badge) return null;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">{t('approvals.approvalWorkflow')}</h3>
        {getStatusBadge()}
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{t('approvals.progress')}</span>
          <span className="text-sm text-gray-500">
            {steps.filter((s) => s.status === 'APPROVED').length} / {steps.length}{' '}
            {t('approvals.stepsApproved')}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              isComplete ? 'bg-green-600' : 'bg-blue-600'
            }`}
            style={{
              width: `${(steps.filter((s) => s.status === 'APPROVED').length / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.stepNumber}
            className={`p-4 rounded-lg border-2 transition-all ${getStepColor(step, index)} ${
              index + 1 === currentStep ? 'ring-2 ring-blue-300 ring-offset-2' : ''
            }`}
          >
            <div className="flex items-start space-x-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">{getStepIcon(step)}</div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-gray-900">
                      {t('approvals.step')} {step.stepNumber}
                    </span>
                    {step.stepName && (
                      <span className="text-sm text-gray-600">- {step.stepName}</span>
                    )}
                  </div>
                  {index + 1 === currentStep && step.status === 'IN_PROGRESS' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {t('approvals.currentStep')}
                    </span>
                  )}
                </div>

                {/* Approver Info */}
                <div className="text-sm text-gray-600 space-y-1">
                  {step.approverName ? (
                    <p>
                      <span className="font-medium">{t('approvals.approver')}:</span>{' '}
                      {step.approverName}
                      {step.requiredRole && (
                        <span className="text-xs ml-2 px-2 py-0.5 rounded bg-gray-200">
                          {step.requiredRole}
                        </span>
                      )}
                    </p>
                  ) : step.requiredRole ? (
                    <p>
                      <span className="font-medium">{t('approvals.requiredRole')}:</span>{' '}
                      {step.requiredRole}
                    </p>
                  ) : null}

                  {step.approvalLimit && (
                    <p className="text-xs text-gray-500">
                      {t('approvals.approvalLimit')}: ${step.approvalLimit.toLocaleString()}
                    </p>
                  )}

                  {step.approvedAt && step.approvedBy && (
                    <p className="text-xs text-green-700">
                      ✓ {t('approvals.approvedBy')} {step.approvedBy}{' '}
                      {t('approvals.on')} {new Date(step.approvedAt).toLocaleString()}
                    </p>
                  )}

                  {/* SLA Warning */}
                  {step.status === 'IN_PROGRESS' &&
                    step.slaDaysRemaining !== undefined &&
                    step.slaDaysRemaining < 2 && (
                      <div className="flex items-center space-x-1 text-xs text-orange-600 mt-2">
                        <AlertCircle className="h-3 w-3" />
                        <span>
                          {t('approvals.slaWarning')}: {step.slaDaysRemaining}{' '}
                          {t('approvals.daysRemaining')}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Completion Message */}
      {isComplete && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            <p className="text-sm font-medium text-green-800">
              {t('approvals.workflowComplete')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
