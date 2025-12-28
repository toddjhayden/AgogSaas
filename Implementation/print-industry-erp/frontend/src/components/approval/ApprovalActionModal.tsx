import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, X, MessageSquare } from 'lucide-react';

export interface ApprovalActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (comments?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  actionType: 'APPROVE' | 'REJECT';
  poNumber: string;
  amount: number;
  currency: string;
  vendor?: string;
}

export const ApprovalActionModal: React.FC<ApprovalActionModalProps> = ({
  isOpen,
  onClose,
  onApprove,
  onReject,
  actionType,
  poNumber,
  amount,
  currency,
  vendor,
}) => {
  const { t } = useTranslation();
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (actionType === 'APPROVE') {
        await onApprove(comments || undefined);
      } else {
        if (!comments.trim()) {
          setError(t('approvals.rejectionReasonRequired'));
          setIsSubmitting(false);
          return;
        }
        await onReject(comments);
      }
      setComments('');
      onClose();
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div
          className={`p-6 border-b ${
            actionType === 'APPROVE'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {actionType === 'APPROVE' ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
              <div>
                <h2
                  className={`text-2xl font-bold ${
                    actionType === 'APPROVE' ? 'text-green-900' : 'text-red-900'
                  }`}
                >
                  {actionType === 'APPROVE'
                    ? t('approvals.approvePurchaseOrder')
                    : t('approvals.rejectPurchaseOrder')}
                </h2>
                <p
                  className={`text-sm ${
                    actionType === 'APPROVE' ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {poNumber}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* PO Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-gray-900 mb-3">{t('approvals.orderDetails')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">{t('procurement.poNumber')}</p>
                <p className="font-medium text-gray-900">{poNumber}</p>
              </div>
              {vendor && (
                <div>
                  <p className="text-sm text-gray-600">{t('procurement.vendor')}</p>
                  <p className="font-medium text-gray-900">{vendor}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">{t('procurement.totalAmount')}</p>
                <p className="font-bold text-lg text-purple-600">
                  {currency} {amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Warning for high-value POs */}
          {amount > 25000 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex items-start">
                <MessageSquare className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    {t('approvals.highValueWarning')}
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    {t('approvals.highValueWarningDetails')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Comments/Reason Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {actionType === 'APPROVE' ? (
                <>
                  {t('approvals.comments')} <span className="text-gray-400">({t('common.optional')})</span>
                </>
              ) : (
                <>
                  {t('approvals.rejectionReason')} <span className="text-red-600">*</span>
                </>
              )}
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none ${
                actionType === 'APPROVE'
                  ? 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                  : 'border-red-300 focus:ring-red-500 focus:border-red-500'
              }`}
              placeholder={
                actionType === 'APPROVE'
                  ? t('approvals.commentsPlaceholder')
                  : t('approvals.rejectionReasonPlaceholder')
              }
            />
            {actionType === 'REJECT' && (
              <p className="text-xs text-gray-500 mt-1">
                {t('approvals.rejectionReasonHint')}
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Confirmation Message */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <p className="text-sm text-blue-700">
              {actionType === 'APPROVE'
                ? t('approvals.approveConfirmationMessage')
                : t('approvals.rejectConfirmationMessage')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (actionType === 'REJECT' && !comments.trim())}
            className={`px-6 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 ${
              actionType === 'APPROVE'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {t('common.processing')}
              </span>
            ) : (
              <>
                {actionType === 'APPROVE' ? (
                  <>
                    <CheckCircle className="inline h-4 w-4 mr-2" />
                    {t('approvals.confirmApprove')}
                  </>
                ) : (
                  <>
                    <XCircle className="inline h-4 w-4 mr-2" />
                    {t('approvals.confirmReject')}
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
