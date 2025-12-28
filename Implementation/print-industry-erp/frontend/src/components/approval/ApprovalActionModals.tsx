import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle, XCircle, ArrowRightLeft } from 'lucide-react';
import {
  APPROVE_PO_WORKFLOW_STEP,
  REJECT_PO,
  DELEGATE_APPROVAL,
} from '../../graphql/queries/approvals';

interface ApprovalActionModalsProps {
  purchaseOrderId: string;
  tenantId: string;
  currentUserId: string;
  poNumber: string;
  onSuccess: () => void;
}

type ModalType = 'approve' | 'reject' | 'delegate' | null;

export const ApprovalActionModals: React.FC<ApprovalActionModalsProps> = ({
  purchaseOrderId,
  tenantId,
  currentUserId,
  poNumber,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [delegateToUserId, setDelegateToUserId] = useState('');

  const [approvePO, { loading: approvingPO }] = useMutation(APPROVE_PO_WORKFLOW_STEP, {
    onCompleted: () => {
      setActiveModal(null);
      setComments('');
      onSuccess();
    },
  });

  const [rejectPO, { loading: rejectingPO }] = useMutation(REJECT_PO, {
    onCompleted: () => {
      setActiveModal(null);
      setRejectionReason('');
      onSuccess();
    },
  });

  const [delegateApproval, { loading: delegatingApproval }] = useMutation(DELEGATE_APPROVAL, {
    onCompleted: () => {
      setActiveModal(null);
      setDelegateToUserId('');
      setComments('');
      onSuccess();
    },
  });

  const handleApprove = async () => {
    await approvePO({
      variables: {
        purchaseOrderId,
        approvedByUserId: currentUserId,
        tenantId,
        comments: comments || undefined,
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
        purchaseOrderId,
        rejectedByUserId: currentUserId,
        tenantId,
        rejectionReason,
      },
    });
  };

  const handleDelegate = async () => {
    if (!delegateToUserId) {
      alert(t('approvals.delegateUserRequired'));
      return;
    }

    await delegateApproval({
      variables: {
        purchaseOrderId,
        delegatedByUserId: currentUserId,
        delegatedToUserId: delegateToUserId,
        tenantId,
        comments: comments || undefined,
      },
    });
  };

  const closeModal = () => {
    setActiveModal(null);
    setComments('');
    setRejectionReason('');
    setDelegateToUserId('');
  };

  const renderModal = () => {
    if (!activeModal) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:p-0">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            onClick={closeModal}
          />

          {/* Modal */}
          <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Approve Modal */}
            {activeModal === 'approve' && (
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {t('approvals.approvePO')}
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      {t('approvals.approveConfirmation', { poNumber })}
                    </p>
                  </div>
                  <div className="mt-4">
                    <label htmlFor="approve-comments" className="block text-sm font-medium text-gray-700 text-left">
                      {t('approvals.comments')} ({t('common.optional')})
                    </label>
                    <textarea
                      id="approve-comments"
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      placeholder={t('approvals.addCommentsPlaceholder')}
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="button"
                    disabled={approvingPO}
                    onClick={handleApprove}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                  >
                    {approvingPO ? t('common.processing') : t('approvals.approve')}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Reject Modal */}
            {activeModal === 'reject' && (
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {t('approvals.rejectPO')}
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      {t('approvals.rejectConfirmation', { poNumber })}
                    </p>
                  </div>
                  <div className="mt-4">
                    <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700 text-left">
                      {t('approvals.rejectionReason')} <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="reject-reason"
                      rows={4}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                      placeholder={t('approvals.rejectionReasonPlaceholder')}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="button"
                    disabled={rejectingPO || !rejectionReason.trim()}
                    onClick={handleReject}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                  >
                    {rejectingPO ? t('common.processing') : t('approvals.reject')}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Delegate Modal */}
            {activeModal === 'delegate' && (
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-purple-100">
                  <ArrowRightLeft className="h-6 w-6 text-purple-600" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {t('approvals.delegateApproval')}
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      {t('approvals.delegateConfirmation', { poNumber })}
                    </p>
                  </div>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label htmlFor="delegate-user" className="block text-sm font-medium text-gray-700 text-left">
                        {t('approvals.delegateTo')} <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        id="delegate-user"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                        placeholder={t('approvals.enterUserId')}
                        value={delegateToUserId}
                        onChange={(e) => setDelegateToUserId(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="delegate-comments" className="block text-sm font-medium text-gray-700 text-left">
                        {t('approvals.comments')} ({t('common.optional')})
                      </label>
                      <textarea
                        id="delegate-comments"
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                        placeholder={t('approvals.addCommentsPlaceholder')}
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="button"
                    disabled={delegatingApproval || !delegateToUserId}
                    onClick={handleDelegate}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                  >
                    {delegatingApproval ? t('common.processing') : t('approvals.delegate')}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={() => setActiveModal('approve')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <CheckCircle className="h-5 w-5 mr-2" />
          {t('approvals.approve')}
        </button>
        <button
          onClick={() => setActiveModal('reject')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <XCircle className="h-5 w-5 mr-2" />
          {t('approvals.reject')}
        </button>
        <button
          onClick={() => setActiveModal('delegate')}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <ArrowRightLeft className="h-5 w-5 mr-2" />
          {t('approvals.delegate')}
        </button>
      </div>

      {/* Modal Render */}
      {renderModal()}
    </>
  );
};
