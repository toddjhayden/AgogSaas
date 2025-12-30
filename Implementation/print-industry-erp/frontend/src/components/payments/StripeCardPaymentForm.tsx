/**
 * Stripe Card Payment Form Component
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * Form for processing card payments via Stripe
 * Note: This component requires @stripe/stripe-js and @stripe/react-stripe-js packages
 * Implementation assumes Stripe Elements integration
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client';
import { CreditCard, Lock, AlertCircle } from 'lucide-react';
import { PROCESS_CARD_PAYMENT } from '../../graphql/queries/paymentGateway';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface StripeCardPaymentFormProps {
  tenantId: string;
  customerId: string;
  invoiceIds: string[];
  amount: number;
  currencyCode: string;
  facilityId?: string;
  onSuccess: (paymentResult: any) => void;
  onError: (error: Error) => void;
  onCancel: () => void;
}

export const StripeCardPaymentForm: React.FC<StripeCardPaymentFormProps> = ({
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
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [notes, setNotes] = useState('');
  const [stripePaymentMethodId, setStripePaymentMethodId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [processCardPayment, { loading }] = useMutation(PROCESS_CARD_PAYMENT, {
    onCompleted: (data) => {
      if (data.processCardPayment.success) {
        onSuccess(data.processCardPayment);
      } else {
        onError(
          new Error(data.processCardPayment.errorMessage || t('payments.paymentFailed'))
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
    setIsProcessing(true);

    // In a real implementation, you would:
    // 1. Use Stripe Elements to collect card details
    // 2. Create a PaymentMethod using stripe.createPaymentMethod()
    // 3. Get the payment method ID from Stripe
    // 4. Pass it to the mutation below

    // For demo purposes, we're assuming the payment method ID is already obtained
    if (!stripePaymentMethodId) {
      onError(new Error(t('payments.pleaseEnterCardDetails')));
      setIsProcessing(false);
      return;
    }

    await processCardPayment({
      variables: {
        input: {
          tenantId,
          customerId,
          invoiceIds,
          amount,
          currencyCode,
          paymentMethodId: stripePaymentMethodId,
          savePaymentMethod,
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
          <CreditCard className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('payments.creditDebitCard')}
          </h3>
          <p className="text-sm text-gray-500">{t('payments.securePaymentProcessing')}</p>
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

      {/* Card Details Section */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          {t('payments.cardDetails')}
        </label>

        {/* Stripe Elements would be mounted here */}
        <div className="border border-gray-300 rounded-lg p-4 bg-white">
          <div className="space-y-3">
            {/* Card Number */}
            <div>
              <input
                type="text"
                placeholder={t('payments.cardNumber')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                onChange={(e) => {
                  // Mock: In real implementation, Stripe Elements handles this
                  // This is just for demonstration
                  setStripePaymentMethodId('pm_' + e.target.value);
                }}
              />
            </div>

            {/* Expiry and CVC */}
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder={t('payments.expiryDate')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder={t('payments.cvc')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Cardholder Name */}
            <input
              type="text"
              placeholder={t('payments.cardholderName')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Save Payment Method Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="savePaymentMethod"
            checked={savePaymentMethod}
            onChange={(e) => setSavePaymentMethod(e.target.checked)}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="savePaymentMethod" className="ml-2 text-sm text-gray-700">
            {t('payments.saveCardForFutureUse')}
          </label>
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

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
        <Lock className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">{t('payments.securePayment')}</p>
          <p className="text-blue-700">{t('payments.securePaymentDescription')}</p>
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
          disabled={loading || isProcessing}
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
              {t('payments.payNow')}
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
