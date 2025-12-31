/**
 * Payment Management Page
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * Main page for managing payment gateways (Stripe, ACH), payment methods, and viewing transaction history
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { CreditCard, Building2, History, Plus, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { StripeCardPaymentForm } from '../components/payments/StripeCardPaymentForm';
import { ACHPaymentForm } from '../components/payments/ACHPaymentForm';
import { PaymentTransactionHistory } from '../components/payments/PaymentTransactionHistory';
import {
  GET_CUSTOMER_PAYMENT_METHODS,
  GET_PAYMENT_GATEWAY_TRANSACTIONS,
  REMOVE_PAYMENT_METHOD,
} from '../graphql/queries/paymentGateway';
import { useAppStore } from '../store/appStore';

type PaymentView = 'overview' | 'make-payment' | 'add-card' | 'add-ach' | 'transactions';
type PaymentType = 'card' | 'ach';

export const PaymentManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<PaymentView>('overview');
  const [_selectedPaymentMethodId, _setSelectedPaymentMethodId] = useState<string>();
  const [paymentType, setPaymentType] = useState<PaymentType>('card');

  // TODO: Get from auth context
  const tenantId = useAppStore((state) => state.preferences?.selectedFacility) || '1';
  const customerId = '1'; // TODO: Get from user context or invoice selection

  // Demo invoice data - in production, this would come from invoice selection
  const demoInvoiceIds = ['invoice-1'];
  const demoAmount = 1250.00;
  const demoCurrency = 'USD';

  // Fetch customer payment methods
  const {
    data: paymentMethodsData,
    loading: paymentMethodsLoading,
    refetch: refetchPaymentMethods,
  } = useQuery(GET_CUSTOMER_PAYMENT_METHODS, {
    variables: { tenantId, customerId },
    skip: !tenantId || !customerId,
  });

  // Fetch payment transactions
  const {
    data: transactionsData,
    loading: transactionsLoading,
    refetch: refetchTransactions,
  } = useQuery(GET_PAYMENT_GATEWAY_TRANSACTIONS, {
    variables: {
      tenantId,
      customerId,
      limit: 50,
      offset: 0,
    },
    skip: !tenantId,
  });

  // Remove payment method mutation
  const [removePaymentMethod] = useMutation(REMOVE_PAYMENT_METHOD, {
    onCompleted: () => {
      toast.success(t('payments.paymentMethodRemoved'));
      refetchPaymentMethods();
    },
    onError: (error) => {
      toast.error(error.message || t('payments.failedToRemovePaymentMethod'));
    },
  });

  const handlePaymentSuccess = (_result: any) => {
    toast.success(t('payments.paymentSuccessful'));
    setCurrentView('overview');
    refetchTransactions();
  };

  const handlePaymentError = (error: Error) => {
    toast.error(error.message || t('payments.paymentFailed'));
  };

  const handleRemovePaymentMethod = async (methodId: string) => {
    if (window.confirm(t('payments.confirmRemovePaymentMethod'))) {
      await removePaymentMethod({
        variables: { tenantId, paymentMethodId: methodId },
      });
    }
  };

  const paymentMethods = paymentMethodsData?.customerPaymentMethods || [];
  const transactions = transactionsData?.paymentGatewayTransactions || [];

  // Overview View
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('payments.savedPaymentMethods')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {paymentMethods.length}
              </p>
            </div>
            <CreditCard className="h-8 w-8 text-primary-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('payments.totalTransactions')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {transactions.length}
              </p>
            </div>
            <History className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('payments.successfulPayments')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {transactions.filter((t: any) => t.status === 'SUCCEEDED').length}
              </p>
            </div>
            <RefreshCw className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('payments.quickActions')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setCurrentView('make-payment')}
            className="flex items-center justify-center space-x-3 p-4 border-2 border-primary-600 rounded-lg hover:bg-primary-50 transition-all text-primary-600 font-medium"
          >
            <CreditCard className="h-5 w-5" />
            <span>{t('payments.makePayment')}</span>
          </button>
          <button
            onClick={() => setCurrentView('transactions')}
            className="flex items-center justify-center space-x-3 p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all text-gray-700 font-medium"
          >
            <History className="h-5 w-5" />
            <span>{t('payments.viewTransactionHistory')}</span>
          </button>
        </div>
      </div>

      {/* Saved Payment Methods */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('payments.savedPaymentMethods')}
          </h3>
          <button
            onClick={() => setCurrentView('add-card')}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{t('payments.addPaymentMethod')}</span>
          </button>
        </div>

        {paymentMethodsLoading ? (
          <LoadingSpinner />
        ) : paymentMethods.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <p>{t('payments.noSavedPaymentMethods')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method: any) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {method.paymentMethodType === 'CARD' ? (
                    <CreditCard className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Building2 className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {method.paymentMethodType === 'CARD'
                        ? `${method.cardBrand?.toUpperCase()} •••• ${method.cardLast4}`
                        : `${method.bankName} •••• ${method.bankLast4}`}
                    </div>
                    {method.isDefault && (
                      <span className="text-xs text-blue-600">{t('payments.default')}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemovePaymentMethod(method.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Make Payment View
  const renderMakePayment = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        {t('payments.makePayment')}
      </h3>

      {/* Payment Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('payments.selectPaymentType')}
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setPaymentType('card')}
            className={`flex items-center justify-center space-x-3 p-4 border-2 rounded-lg transition-all ${
              paymentType === 'card'
                ? 'border-primary-600 bg-primary-50 text-primary-600'
                : 'border-gray-300 text-gray-700 hover:border-gray-400'
            }`}
          >
            <CreditCard className="h-5 w-5" />
            <span className="font-medium">{t('payments.creditDebitCard')}</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentType('ach')}
            className={`flex items-center justify-center space-x-3 p-4 border-2 rounded-lg transition-all ${
              paymentType === 'ach'
                ? 'border-primary-600 bg-primary-50 text-primary-600'
                : 'border-gray-300 text-gray-700 hover:border-gray-400'
            }`}
          >
            <Building2 className="h-5 w-5" />
            <span className="font-medium">{t('payments.achBankTransfer')}</span>
          </button>
        </div>
      </div>

      {/* Payment Form */}
      <div className="border-t pt-6">
        {paymentType === 'card' ? (
          <StripeCardPaymentForm
            tenantId={tenantId}
            customerId={customerId}
            invoiceIds={demoInvoiceIds}
            amount={demoAmount}
            currencyCode={demoCurrency}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onCancel={() => setCurrentView('overview')}
          />
        ) : (
          <ACHPaymentForm
            tenantId={tenantId}
            customerId={customerId}
            invoiceIds={demoInvoiceIds}
            amount={demoAmount}
            currencyCode={demoCurrency}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onCancel={() => setCurrentView('overview')}
          />
        )}
      </div>
    </div>
  );

  // Transaction History View
  const renderTransactions = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('payments.transactionHistory')}
        </h3>
        <button
          onClick={() => setCurrentView('overview')}
          className="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          {t('common.back')}
        </button>
      </div>
      <PaymentTransactionHistory
        transactions={transactions}
        loading={transactionsLoading}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: t('nav.dashboard'), path: '/dashboard' },
          { label: t('nav.finance'), path: '/finance' },
          { label: t('payments.paymentManagement'), path: '/finance/payments' },
        ]}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('payments.paymentManagement')}
        </h1>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          <button
            onClick={() => setCurrentView('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              currentView === 'overview'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('payments.overview')}
          </button>
          <button
            onClick={() => setCurrentView('make-payment')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              currentView === 'make-payment'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('payments.makePayment')}
          </button>
          <button
            onClick={() => setCurrentView('transactions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              currentView === 'transactions'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('payments.transactions')}
          </button>
        </nav>
      </div>

      {/* Content */}
      {currentView === 'overview' && renderOverview()}
      {currentView === 'make-payment' && renderMakePayment()}
      {currentView === 'transactions' && renderTransactions()}
    </div>
  );
};
