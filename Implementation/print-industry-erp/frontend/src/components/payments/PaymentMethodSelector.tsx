/**
 * Payment Method Selector Component
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * Allows users to select from saved payment methods or add new ones
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Building2, CheckCircle, Plus } from 'lucide-react';

export interface PaymentMethod {
  id: string;
  paymentMethodType: string;
  isDefault: boolean;
  displayName?: string;
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  bankLast4?: string;
  bankName?: string;
  bankAccountType?: string;
  verified: boolean;
}

interface PaymentMethodSelectorProps {
  paymentMethods: PaymentMethod[];
  selectedMethodId?: string;
  onSelectMethod: (methodId: string) => void;
  onAddNewMethod: () => void;
  loading?: boolean;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  paymentMethods,
  selectedMethodId,
  onSelectMethod,
  onAddNewMethod,
  loading = false,
}) => {
  const { t } = useTranslation();

  const renderCardInfo = (method: PaymentMethod) => {
    if (method.paymentMethodType === 'CARD') {
      return (
        <div className="flex items-center space-x-3">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <div>
            <div className="font-medium text-gray-900">
              {method.cardBrand?.toUpperCase()} •••• {method.cardLast4}
            </div>
            <div className="text-sm text-gray-500">
              {t('payments.expiresOn')}: {method.cardExpMonth}/{method.cardExpYear}
            </div>
          </div>
        </div>
      );
    }

    if (method.paymentMethodType === 'ACH' || method.paymentMethodType === 'BANK_ACCOUNT') {
      return (
        <div className="flex items-center space-x-3">
          <Building2 className="h-5 w-5 text-gray-400" />
          <div>
            <div className="font-medium text-gray-900">
              {method.bankName} •••• {method.bankLast4}
            </div>
            <div className="text-sm text-gray-500">
              {method.bankAccountType ? t(`payments.${method.bankAccountType.toLowerCase()}`) : 'Bank Account'}
              {method.verified && (
                <span className="ml-2 inline-flex items-center text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {t('payments.verified')}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-3">
        <div className="font-medium text-gray-900">{method.displayName || method.paymentMethodType}</div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-16 bg-gray-200 rounded-lg"></div>
        <div className="h-16 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('payments.selectPaymentMethod')}
      </label>

      {paymentMethods.map((method) => (
        <div
          key={method.id}
          onClick={() => onSelectMethod(method.id)}
          className={`
            relative flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all
            ${
              selectedMethodId === method.id
                ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                : 'border-gray-300 hover:border-gray-400 bg-white'
            }
          `}
        >
          <div className="flex-1">{renderCardInfo(method)}</div>

          {method.isDefault && (
            <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {t('payments.default')}
            </span>
          )}

          {selectedMethodId === method.id && (
            <div className="absolute top-3 right-3">
              <CheckCircle className="h-5 w-5 text-primary-600" />
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={onAddNewMethod}
        className="w-full flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all text-gray-600 hover:text-primary-600"
      >
        <Plus className="h-5 w-5" />
        <span className="font-medium">{t('payments.addNewPaymentMethod')}</span>
      </button>
    </div>
  );
};
