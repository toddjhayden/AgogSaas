import React, { useState } from 'react';
import { useMutation, useLazyQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Package,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  ArrowRight,
  ArrowLeft,
  Wifi,
} from 'lucide-react';
import {
  CREATE_CARRIER_INTEGRATION,
  UPDATE_CARRIER_INTEGRATION,
} from '../../graphql/mutations/shipping';
import { TEST_CARRIER_CONNECTION } from '../../graphql/queries/shipping';

interface FedExSetupWizardProps {
  existingCarrier?: any;
  onClose: () => void;
  onComplete: () => void;
}

interface FormData {
  carrierName: string;
  accountNumber: string;
  apiKey: string;
  secretKey: string;
  environment: 'TEST' | 'PRODUCTION';
  facilityId: string;
  labelFormat: 'PDF' | 'PNG' | 'ZPL';
}

export const FedExSetupWizard: React.FC<FedExSetupWizardProps> = ({
  existingCarrier,
  onClose,
  onComplete,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    carrierName: existingCarrier?.carrierName || 'FedEx',
    accountNumber: existingCarrier?.accountNumber || '',
    apiKey: '',
    secretKey: '',
    environment: 'TEST',
    facilityId: '1', // Default facility
    labelFormat: 'PDF',
  });
  const [testResult, setTestResult] = useState<any>(null);

  const [createCarrier, { loading: creating }] = useMutation(CREATE_CARRIER_INTEGRATION, {
    onCompleted: () => {
      onComplete();
    },
    onError: (error) => {
      alert(t('shipping.createCarrierError', { error: error.message }));
    },
  });

  const [updateCarrier, { loading: updating }] = useMutation(UPDATE_CARRIER_INTEGRATION, {
    onCompleted: () => {
      onComplete();
    },
    onError: (error) => {
      alert(t('shipping.updateCarrierError', { error: error.message }));
    },
  });

  const [testConnection, { loading: testing }] = useLazyQuery(TEST_CARRIER_CONNECTION, {
    onCompleted: (data) => {
      setTestResult(data.testCarrierConnection);
      if (data.testCarrierConnection.isConnected) {
        setStep(4);
      }
    },
    onError: (error) => {
      setTestResult({ isConnected: false, error: error.message });
    },
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleTestConnection = async () => {
    if (existingCarrier) {
      await testConnection({
        variables: {
          id: existingCarrier.id,
          tenantId: '1',
        },
      });
    }
  };

  const handleSubmit = async () => {
    const input = {
      facilityId: formData.facilityId,
      carrierCode: 'FEDEX',
      carrierName: formData.carrierName,
      carrierType: 'PARCEL',
      accountNumber: formData.accountNumber,
      apiKey: formData.apiKey,
      secretKey: formData.secretKey,
      labelFormat: formData.labelFormat,
      isActive: true,
    };

    if (existingCarrier) {
      await updateCarrier({
        variables: {
          id: existingCarrier.id,
          input,
        },
      });
    } else {
      await createCarrier({
        variables: { input },
      });
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('shipping.fedex.basicInformation')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipping.carrierName')}
                  </label>
                  <input
                    type="text"
                    value={formData.carrierName}
                    onChange={(e) => handleInputChange('carrierName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    placeholder="FedEx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipping.fedex.accountNumber')}
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 font-mono"
                    placeholder="123456789"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t('shipping.fedex.accountNumberHelp')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipping.environment')}
                  </label>
                  <select
                    value={formData.environment}
                    onChange={(e) => handleInputChange('environment', e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="TEST">{t('shipping.environments.test')}</option>
                    <option value="PRODUCTION">{t('shipping.environments.production')}</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {t('shipping.fedex.environmentHelp')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('shipping.fedex.apiCredentials')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipping.fedex.apiKey')}
                  </label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => handleInputChange('apiKey', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 font-mono"
                    placeholder="your-api-key"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t('shipping.fedex.apiKeyHelp')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipping.fedex.secretKey')}
                  </label>
                  <input
                    type="password"
                    value={formData.secretKey}
                    onChange={(e) => handleInputChange('secretKey', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 font-mono"
                    placeholder="your-secret-key"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t('shipping.fedex.secretKeyHelp')}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">{t('shipping.fedex.credentialsSecurity')}</p>
                      <p className="text-blue-700">{t('shipping.fedex.credentialsSecurityNote')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('shipping.fedex.preferences')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipping.labelFormat')}
                  </label>
                  <select
                    value={formData.labelFormat}
                    onChange={(e) => handleInputChange('labelFormat', e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="PDF">{t('shipping.labelFormats.pdf')}</option>
                    <option value="PNG">{t('shipping.labelFormats.png')}</option>
                    <option value="ZPL">{t('shipping.labelFormats.zpl')}</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {t('shipping.fedex.labelFormatHelp')}
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    {t('shipping.fedex.supportedFeatures')}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-700">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      {t('shipping.fedex.feature.rateQuotes')}
                    </div>
                    <div className="flex items-center text-sm text-gray-700">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      {t('shipping.fedex.feature.labelGeneration')}
                    </div>
                    <div className="flex items-center text-sm text-gray-700">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      {t('shipping.fedex.feature.tracking')}
                    </div>
                    <div className="flex items-center text-sm text-gray-700">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      {t('shipping.fedex.feature.addressValidation')}
                    </div>
                    <div className="flex items-center text-sm text-gray-700">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      {t('shipping.fedex.feature.endOfDay')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('shipping.fedex.reviewConfiguration')}
              </h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {t('shipping.carrierName')}:
                  </span>
                  <span className="text-sm text-gray-900">{formData.carrierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {t('shipping.fedex.accountNumber')}:
                  </span>
                  <span className="text-sm text-gray-900 font-mono">{formData.accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {t('shipping.environment')}:
                  </span>
                  <span className="text-sm text-gray-900">
                    {t(`shipping.environments.${formData.environment.toLowerCase()}`)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {t('shipping.labelFormat')}:
                  </span>
                  <span className="text-sm text-gray-900">
                    {t(`shipping.labelFormats.${formData.labelFormat.toLowerCase()}`)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {t('shipping.fedex.credentials')}:
                  </span>
                  <span className="text-sm text-green-600 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t('shipping.configured')}
                  </span>
                </div>
              </div>

              {existingCarrier && (
                <div className="mt-4">
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {testing ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        {t('shipping.testingConnection')}
                      </>
                    ) : (
                      <>
                        <Wifi className="h-4 w-4 mr-2" />
                        {t('shipping.testConnection')}
                      </>
                    )}
                  </button>

                  {testResult && (
                    <div
                      className={`mt-4 p-4 rounded-lg border ${
                        testResult.isConnected
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start">
                        {testResult.isConnected ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
                        )}
                        <div className="text-sm">
                          <p
                            className={`font-medium ${
                              testResult.isConnected ? 'text-green-800' : 'text-red-800'
                            }`}
                          >
                            {testResult.isConnected
                              ? t('shipping.connectionSuccess')
                              : t('shipping.connectionFailed')}
                          </p>
                          {testResult.error && (
                            <p className="text-red-700 mt-1">{testResult.error}</p>
                          )}
                          {testResult.apiVersion && (
                            <p className="text-green-700 mt-1">
                              API Version: {testResult.apiVersion}
                            </p>
                          )}
                          {testResult.responseTimeMs && (
                            <p className="text-green-700">
                              Response Time: {testResult.responseTimeMs}ms
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {existingCarrier
                    ? t('shipping.fedex.editIntegration')
                    : t('shipping.fedex.setupIntegration')}
                </h2>
                <p className="text-sm text-gray-600">{t('shipping.fedex.wizardSubtitle')}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center mt-6">
            {[1, 2, 3, 4].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`flex-1 h-2 rounded-full ${
                    s <= step ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                />
                {s < 4 && <div className="w-2" />}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>{t('shipping.fedex.step1')}</span>
            <span>{t('shipping.fedex.step2')}</span>
            <span>{t('shipping.fedex.step3')}</span>
            <span>{t('shipping.fedex.step4')}</span>
          </div>
        </div>

        <div className="p-6">{renderStep()}</div>

        <div className="p-6 border-t border-gray-200 flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              {t('common.next')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={creating || updating}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {creating || updating ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {existingCarrier ? t('common.update') : t('common.create')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
