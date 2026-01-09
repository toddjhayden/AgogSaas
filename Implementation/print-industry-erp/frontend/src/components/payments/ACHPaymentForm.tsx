/**
 * ACH Payment Form Component
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * Form for processing ACH/Bank Account payments via Stripe
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client';
import { Building2, Lock, AlertCircle, Clock } from 'lucide-react';
import { PROCESS_ACH_PAYMENT } from '../../graphql/queries/paymentGateway';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ACHPaymentFormProps {
  tenantId: string;
  customerId: string;
  invoiceIds: string[];
  amount: number;
  currencyCode: string;
  facilityId?: string;
  onSuccess: (paymentResult: unknown) => void;
  onError: (error: Error) => void;
  onCancel: () => void;
}

export const ACHPaymentForm: React.FC<ACHPaymentFormProps> = ({
  tenantId,
  customerId,
  invoiceIds,
  amount,
  currencyCode,
  facilityId,
  onSuccess,
  onError,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');
  const [stripeBankAccountId, setStripeBankAccountId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [processACHPayment, { loading }] = useMutation(PROCESS_ACH_PAYMENT, {
    onCompleted: (data) => {
      if (data.processACHPayment.success) {
        onSuccess(data.processACHPayment);
      } else {
        onError(
          new Error(data.processACHPayment.errorMessage || t('payments.paymentFailed'))
        );
      }
      setIsProcessing(false);
    },
    onError: (error) => {
      onError(error);
      setIsProcessing(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreedToTerms) {
      onError(new Error(t('payments.mustAgreeToTerms')));
      return;
    }

    setIsProcessing(true);

    // In a real implementation, you would:
    // 1. Use Stripe Elements to collect bank account details
    // 2. Create a Bank Account token using stripe.createToken('bank_account', ...)
    // 3. Get the bank account ID from Stripe
    // 4. Pass it to the mutation below

    // For demo purposes, we're assuming the bank account ID is already obtained
    if (!stripeBankAccountId) {
      onError(new Error(t('payments.pleaseEnterBankDetails')));
      setIsProcessing(false);
      return;
    }

    await processACHPayment({
      variables: {
        input: {
          tenantId,
          customerId,
          invoiceIds,
          amount,
          currencyCode,
          bankAccountId: stripeBankAccountId,
          facilityId,
          notes: notes || undefined,
        },
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 pb-4 border-b">
        <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full">
          <Building2 className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('payments.achBankTransfer')}
          </h3>
          <p className="text-sm text-gray-500">{t('payments.directBankPayment')}</p>
        </div>
      </div>

      {/* Payment Amount Display */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">{t('payments.paymentAmount')}</span>
          <span className="text-2xl font-bold text-gray-900">
            {currencyCode} {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* ACH Processing Time Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
        <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">{t('payments.achProcessingTime')}</p>
          <p className="text-blue-700">{t('payments.achProcessingDescription')}</p>
        </div>
      </div>

      {/* Bank Account Details Section */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          {t('payments.bankAccountDetails')}
        </label>

        {/* Stripe Bank Account Elements would be mounted here */}
        <div className="border border-gray-300 rounded-lg p-4 bg-white">
          <div className="space-y-3">
            {/* Account Holder Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('payments.accountHolderName')}
              </label>
              <input
                type="text"
                placeholder={t('payments.accountHolderNamePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Routing Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('payments.routingNumber')}
              </label>
              <input
                type="text"
                placeholder={t('payments.routingNumberPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                maxLength={9}
              />
            </div>

            {/* Account Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('payments.accountNumber')}
              </label>
              <input
                type="text"
                placeholder={t('payments.accountNumberPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                onChange={(e) => {
                  // Mock: In real implementation, Stripe handles this
                  setStripeBankAccountId('ba_' + e.target.value);
                }}
              />
            </div>

            {/* Account Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('payments.accountType')}
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="checking">{t('payments.checking')}</option>
                <option value="savings">{t('payments.savings')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Notes (Optional) */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
          {t('payments.notes')} ({t('common.optional')})
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder={t('payments.addNotes')}
        />
      </div>

      {/* ACH Authorization Agreement */}
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
        <div className="flex items-start">
          <input
            type="checkbox"
            id="achTerms"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-1"
          />
          <label htmlFor="achTerms" className="ml-3 text-sm text-gray-700">
            <span className="font-medium">{t('payments.achAuthorizationTitle')}</span>
            <p className="mt-1 text-gray-600">{t('payments.achAuthorizationText')}</p>
          </label>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
        <Lock className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">{t('payments.securePayment')}</p>
          <p className="text-blue-700">{t('payments.bankSecurityDescription')}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading || isProcessing}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={loading || isProcessing || !agreedToTerms}
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading || isProcessing ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="ml-2">{t('payments.processing')}</span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 mr-2" />
              {t('payments.authorizePayment')}
            </>
          )}
        </button>
      </div>

      {/* Implementation Note */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start space-x-2">
        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
        <div className="text-sm text-yellow-800">
          <p className="font-medium">{t('payments.implementationNote')}</p>
          <p className="text-yellow-700">
            {t('payments.stripeElementsRequired')}
          </p>
        </div>
      </div>
    </form>
  );
};
