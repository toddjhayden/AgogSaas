import React, { useState } from 'react';
import { useMutation, useLazyQuery, useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Package,
  DollarSign,
  Truck,
  MapPin,
  CheckCircle,
  XCircle,
  Loader,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { CREATE_SHIPMENT } from '../../graphql/mutations/shipping';
import { GET_RATE_QUOTES, GET_CARRIER_INTEGRATIONS } from '../../graphql/queries/shipping';

interface CreateShipmentModalProps {
  onClose: () => void;
  onComplete: () => void;
}

interface ShipmentPackage {
  sequenceNumber: number;
  weight: number;
  weightUnit: string;
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit?: string;
}

interface RateQuote {
  serviceType: string;
  serviceName: string;
  carrierCode: string;
  carrierName: string;
  totalCost: number;
  currency: string;
  transitDays?: number;
  estimatedDeliveryDate?: string;
  guaranteedDelivery: boolean;
}

export const CreateShipmentModal: React.FC<CreateShipmentModalProps> = ({
  onClose,
  onComplete,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [selectedRate, setSelectedRate] = useState<RateQuote | null>(null);

  const [formData, setFormData] = useState({
    facilityId: '1',
    customerId: '',
    shipToName: '',
    shipToAddressLine1: '',
    shipToAddressLine2: '',
    shipToCity: '',
    shipToState: '',
    shipToPostalCode: '',
    shipToCountry: 'US',
    shipToPhone: '',
    shipToEmail: '',
    isResidential: false,
    packages: [
      {
        sequenceNumber: 1,
        weight: 0,
        weightUnit: 'LB',
      },
    ] as ShipmentPackage[],
  });

  const { data: carriersData } = useQuery(GET_CARRIER_INTEGRATIONS, {
    variables: { tenantId: '1' },
  });

  const [getRates, { data: ratesData, loading: loadingRates }] = useLazyQuery(GET_RATE_QUOTES, {
    onError: (error) => {
      alert(t('shipping.rateQuoteError', { error: error.message }));
    },
  });

  const [createShipment, { loading: creating }] = useMutation(CREATE_SHIPMENT, {
    onCompleted: () => {
      onComplete();
    },
    onError: (error) => {
      alert(t('shipping.createShipmentError', { error: error.message }));
    },
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePackageChange = (index: number, field: string, value: any) => {
    const newPackages = [...formData.packages];
    newPackages[index] = { ...newPackages[index], [field]: value };
    setFormData((prev) => ({ ...prev, packages: newPackages }));
  };

  const handleAddPackage = () => {
    setFormData((prev) => ({
      ...prev,
      packages: [
        ...prev.packages,
        {
          sequenceNumber: prev.packages.length + 1,
          weight: 0,
          weightUnit: 'LB',
        },
      ],
    }));
  };

  const handleRemovePackage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      packages: prev.packages.filter((_, i) => i !== index),
    }));
  };

  const handleGetRates = async () => {
    await getRates({
      variables: {
        input: {
          facilityId: formData.facilityId,
          shipToAddressLine1: formData.shipToAddressLine1,
          shipToCity: formData.shipToCity,
          shipToState: formData.shipToState,
          shipToPostalCode: formData.shipToPostalCode,
          shipToCountry: formData.shipToCountry,
          isResidential: formData.isResidential,
          packages: formData.packages,
        },
      },
    });
    setStep(2);
  };

  const handleSelectRate = (rate: RateQuote) => {
    setSelectedRate(rate);
    setStep(3);
  };

  const handleCreateShipment = async () => {
    if (!selectedRate) return;

    const carrier = carriersData?.carrierIntegrations?.find(
      (c: any) => c.carrierCode === selectedRate.carrierCode
    );

    await createShipment({
      variables: {
        input: {
          facilityId: formData.facilityId,
          customerId: formData.customerId || '1',
          carrierIntegrationId: carrier?.id,
          serviceLevel: selectedRate.serviceType,
          shipToName: formData.shipToName,
          shipToAddressLine1: formData.shipToAddressLine1,
          shipToAddressLine2: formData.shipToAddressLine2,
          shipToCity: formData.shipToCity,
          shipToState: formData.shipToState,
          shipToPostalCode: formData.shipToPostalCode,
          shipToCountry: formData.shipToCountry,
          shipToPhone: formData.shipToPhone,
          shipToEmail: formData.shipToEmail,
          isResidential: formData.isResidential,
          packages: formData.packages,
          lines: [],
        },
      },
    });
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('shipping.destinationAddress')}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('shipping.recipientName')}
            </label>
            <input
              type="text"
              value={formData.shipToName}
              onChange={(e) => handleInputChange('shipToName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('shipping.addressLine1')}
            </label>
            <input
              type="text"
              value={formData.shipToAddressLine1}
              onChange={(e) => handleInputChange('shipToAddressLine1', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('shipping.addressLine2')}
            </label>
            <input
              type="text"
              value={formData.shipToAddressLine2}
              onChange={(e) => handleInputChange('shipToAddressLine2', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('shipping.city')}
              </label>
              <input
                type="text"
                value={formData.shipToCity}
                onChange={(e) => handleInputChange('shipToCity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('shipping.state')}
              </label>
              <input
                type="text"
                value={formData.shipToState}
                onChange={(e) => handleInputChange('shipToState', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('shipping.postalCode')}
              </label>
              <input
                type="text"
                value={formData.shipToPostalCode}
                onChange={(e) => handleInputChange('shipToPostalCode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('shipping.country')}
              </label>
              <select
                value={formData.shipToCountry}
                onChange={(e) => handleInputChange('shipToCountry', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="MX">Mexico</option>
              </select>
            </div>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isResidential}
              onChange={(e) => handleInputChange('isResidential', e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700">
              {t('shipping.residentialAddress')}
            </label>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">{t('shipping.packages')}</h3>
          <button
            onClick={handleAddPackage}
            className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('shipping.addPackage')}
          </button>
        </div>
        <div className="space-y-3">
          {formData.packages.map((pkg, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700">
                  {t('shipping.package')} {index + 1}
                </span>
                {formData.packages.length > 1 && (
                  <button
                    onClick={() => handleRemovePackage(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {t('shipping.weight')}
                  </label>
                  <input
                    type="number"
                    value={pkg.weight}
                    onChange={(e) =>
                      handlePackageChange(index, 'weight', parseFloat(e.target.value))
                    }
                    step="0.1"
                    min="0"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {t('shipping.weightUnit')}
                  </label>
                  <select
                    value={pkg.weightUnit}
                    onChange={(e) => handlePackageChange(index, 'weightUnit', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="LB">LB</option>
                    <option value="KG">KG</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">{t('shipping.selectService')}</h3>
        {loadingRates && <Loader className="h-5 w-5 animate-spin text-primary-600" />}
      </div>

      {ratesData?.getRateQuotes?.map((rate: RateQuote, index: number) => (
        <button
          key={index}
          onClick={() => handleSelectRate(rate)}
          className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-primary-500 hover:shadow-md transition-all"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <Package className="h-5 w-5 text-gray-600" />
                <div>
                  <div className="font-medium text-gray-900">{rate.serviceName}</div>
                  <div className="text-sm text-gray-600">{rate.carrierName}</div>
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                {rate.transitDays && (
                  <span className="flex items-center">
                    <Truck className="h-4 w-4 mr-1" />
                    {rate.transitDays} {t('shipping.days')}
                  </span>
                )}
                {rate.guaranteedDelivery && (
                  <span className="flex items-center text-green-600">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t('shipping.guaranteed')}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                ${rate.totalCost.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">{rate.currency}</div>
            </div>
          </div>
        </button>
      ))}

      {!loadingRates && (!ratesData?.getRateQuotes || ratesData.getRateQuotes.length === 0) && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">{t('shipping.noRatesAvailable')}</p>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('shipping.reviewShipment')}
        </h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              {t('shipping.destination')}
            </h4>
            <div className="text-sm text-gray-900">
              <p>{formData.shipToName}</p>
              <p>{formData.shipToAddressLine1}</p>
              {formData.shipToAddressLine2 && <p>{formData.shipToAddressLine2}</p>}
              <p>
                {formData.shipToCity}, {formData.shipToState} {formData.shipToPostalCode}
              </p>
              <p>{formData.shipToCountry}</p>
            </div>
          </div>

          {selectedRate && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {t('shipping.selectedService')}
              </h4>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{selectedRate.serviceName}</p>
                  <p className="text-sm text-gray-600">{selectedRate.carrierName}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    ${selectedRate.totalCost.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">{selectedRate.currency}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">{t('shipping.packages')}</h4>
            <div className="space-y-1">
              {formData.packages.map((pkg, index) => (
                <p key={index} className="text-sm text-gray-900">
                  {t('shipping.package')} {index + 1}: {pkg.weight} {pkg.weightUnit}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {t('shipping.createShipment')}
                </h2>
                <p className="text-sm text-gray-600">
                  {step === 1 && t('shipping.step1Title')}
                  {step === 2 && t('shipping.step2Title')}
                  {step === 3 && t('shipping.step3Title')}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle className="h-6 w-6" />
            </button>
          </div>

          <div className="flex items-center mt-6">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`flex-1 h-2 rounded-full ${
                    s <= step ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                />
                {s < 3 && <div className="w-2" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="p-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-between">
          <button
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {step === 1 ? t('common.cancel') : t('common.back')}
          </button>

          {step === 1 && (
            <button
              onClick={handleGetRates}
              disabled={loadingRates}
              className="px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {loadingRates ? (
                <>
                  <Loader className="inline h-4 w-4 mr-2 animate-spin" />
                  {t('shipping.gettingRates')}
                </>
              ) : (
                <>
                  <DollarSign className="inline h-4 w-4 mr-2" />
                  {t('shipping.getRates')}
                </>
              )}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleCreateShipment}
              disabled={creating}
              className="px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader className="inline h-4 w-4 mr-2 animate-spin" />
                  {t('common.creating')}
                </>
              ) : (
                <>
                  <CheckCircle className="inline h-4 w-4 mr-2" />
                  {t('shipping.createShipment')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
