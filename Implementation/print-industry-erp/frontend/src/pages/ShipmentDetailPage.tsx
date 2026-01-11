import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Package,
  Truck,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle,
  Send,
  XCircle,
} from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { GET_SHIPMENT } from '../graphql/queries/shipping';
import {
  MANIFEST_SHIPMENT,
  UPDATE_SHIPMENT_STATUS,
  VOID_SHIPMENT,
  REFRESH_TRACKING,
} from '../graphql/mutations/shipping';

// Type definitions for shipment data
interface ShipmentLine {
  id: string;
  lineNumber: number;
  materialCode: string;
  materialDescription?: string;
  quantityShipped: number;
  unitOfMeasure: string;
  packageNumber?: string;
  weight?: number;
}

interface TrackingEvent {
  id: string;
  eventDescription: string;
  eventDate: string;
  city?: string;
  state?: string;
  exceptionFlag?: boolean;
  exceptionReason?: string;
}

const statusColors: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-800',
  PACKED: 'bg-blue-100 text-blue-800',
  MANIFESTED: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-blue-100 text-blue-800',
  IN_TRANSIT: 'bg-yellow-100 text-yellow-800',
  OUT_FOR_DELIVERY: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-green-100 text-green-800',
  EXCEPTION: 'bg-red-100 text-red-800',
  RETURNED: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export const ShipmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [showManifestConfirm, setShowManifestConfirm] = useState(false);

  const tenantId = '1';

  const { data, loading, error, refetch } = useQuery(GET_SHIPMENT, {
    variables: { id, tenantId },
    skip: !id,
  });

  const [manifestShipment, { loading: manifesting }] = useMutation(MANIFEST_SHIPMENT, {
    onCompleted: () => {
      refetch();
      setShowManifestConfirm(false);
    },
    onError: (error) => {
      alert(t('shipping.manifestError', { error: error.message }));
    },
  });

  const [updateStatus, { loading: updatingStatus }] = useMutation(UPDATE_SHIPMENT_STATUS, {
    onCompleted: () => {
      refetch();
    },
    onError: (error) => {
      alert(t('shipping.statusUpdateError', { error: error.message }));
    },
  });

  const [voidShipment, { loading: voiding }] = useMutation(VOID_SHIPMENT, {
    onCompleted: () => {
      refetch();
    },
    onError: (error) => {
      alert(t('shipping.voidError', { error: error.message }));
    },
  });

  const [refreshTracking, { loading: refreshing }] = useMutation(REFRESH_TRACKING, {
    onCompleted: () => {
      refetch();
    },
    onError: (error) => {
      alert(t('shipping.refreshTrackingError', { error: error.message }));
    },
  });

  if (loading) {
    return (
      <div className="p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !data?.shipment) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
          <div>
            <h3 className="text-red-800 font-medium">{t('common.error')}</h3>
            <p className="text-red-600 text-sm">
              {error?.message || t('shipping.shipmentNotFound')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const shipment = data.shipment;

  const handleManifest = () => {
    manifestShipment({
      variables: { id },
    });
  };

  const handleCancelShipment = () => {
    if (confirm(t('shipping.confirmCancel'))) {
      updateStatus({
        variables: {
          id,
          status: 'CANCELLED',
          notes: 'Cancelled by user',
        },
      });
    }
  };

  const handleVoidShipment = () => {
    if (confirm(t('shipping.confirmVoid'))) {
      voidShipment({
        variables: { id },
      });
    }
  };

  const handleRefreshTracking = () => {
    refreshTracking({
      variables: { shipmentId: id },
    });
  };

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          { label: t('nav.wms'), path: '/wms' },
          { label: t('nav.shipments'), path: '/wms/shipments' },
          { label: shipment.shipmentNumber, path: `/wms/shipments/${id}` },
        ]}
      />

      {/* Header */}
      <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center">
              <Package className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{shipment.shipmentNumber}</h1>
                <p className="text-gray-600 mt-1">{t('shipping.shipmentDetails')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                statusColors[shipment.status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {t(`shipping.statuses.${shipment.status}`)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex space-x-3">
          {shipment.status === 'DRAFT' && (
            <button
              onClick={() => setShowManifestConfirm(true)}
              disabled={manifesting}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400"
            >
              <Send className="h-4 w-4 mr-2" />
              {manifesting ? t('shipping.manifesting') : t('shipping.manifestShipment')}
            </button>
          )}
          {shipment.status === 'MANIFESTED' && (
            <button
              onClick={handleVoidShipment}
              disabled={voiding}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {voiding ? t('shipping.voiding') : t('shipping.voidShipment')}
            </button>
          )}
          {(shipment.status === 'DRAFT' || shipment.status === 'READY_TO_SHIP') && (
            <button
              onClick={handleCancelShipment}
              disabled={updatingStatus}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {t('shipping.cancelShipment')}
            </button>
          )}
          {shipment.trackingNumber && (
            <button
              onClick={handleRefreshTracking}
              disabled={refreshing}
              className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100"
            >
              <Truck className="h-4 w-4 mr-2" />
              {refreshing ? t('shipping.refreshing') : t('shipping.refreshTracking')}
            </button>
          )}
        </div>
      </div>

      {/* Manifest Confirmation Modal */}
      {showManifestConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {t('shipping.confirmManifest')}
            </h3>
            <p className="text-gray-600 mb-6">{t('shipping.confirmManifestDescription')}</p>
            <div className="flex space-x-3">
              <button
                onClick={handleManifest}
                disabled={manifesting}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400"
              >
                {manifesting ? t('shipping.manifesting') : t('shipping.confirm')}
              </button>
              <button
                onClick={() => setShowManifestConfirm(false)}
                disabled={manifesting}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Shipment Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carrier Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Truck className="h-5 w-5 mr-2 text-primary-600" />
              {t('shipping.carrierInformation')}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">{t('shipping.carrier')}</p>
                <p className="text-base font-medium text-gray-900">
                  {shipment.carrierName || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('shipping.serviceLevel')}</p>
                <p className="text-base font-medium text-gray-900">
                  {shipment.serviceLevel || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('shipping.trackingNumber')}</p>
                {shipment.trackingNumber ? (
                  <p className="text-base font-mono font-medium text-primary-600">
                    {shipment.trackingNumber}
                  </p>
                ) : (
                  <p className="text-base text-gray-400">-</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('shipping.proNumber')}</p>
                <p className="text-base font-medium text-gray-900">{shipment.proNumber || '-'}</p>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-primary-600" />
              {t('shipping.shippingAddress')}
            </h2>
            <div className="space-y-1">
              <p className="text-base font-medium text-gray-900">{shipment.shipToName}</p>
              <p className="text-gray-700">{shipment.shipToAddressLine1}</p>
              {shipment.shipToAddressLine2 && (
                <p className="text-gray-700">{shipment.shipToAddressLine2}</p>
              )}
              <p className="text-gray-700">
                {shipment.shipToCity}, {shipment.shipToState} {shipment.shipToPostalCode}
              </p>
              <p className="text-gray-700">{shipment.shipToCountry}</p>
              {shipment.shipToPhone && (
                <p className="text-gray-700">
                  {t('shipping.phone')}: {shipment.shipToPhone}
                </p>
              )}
              {shipment.shipToEmail && (
                <p className="text-gray-700">
                  {t('shipping.email')}: {shipment.shipToEmail}
                </p>
              )}
            </div>
          </div>

          {/* Shipment Lines */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Package className="h-5 w-5 mr-2 text-primary-600" />
              {t('shipping.shipmentLines')}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('shipping.line')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('shipping.material')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('shipping.quantity')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('shipping.package')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('shipping.weight')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shipment.lines.map((line: ShipmentLine) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{line.lineNumber}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {line.materialCode}
                          </span>
                          <span className="text-xs text-gray-500">{line.materialDescription}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {line.quantityShipped} {line.unitOfMeasure}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {line.packageNumber || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {line.weight ? `${line.weight} lbs` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tracking Events */}
          {shipment.trackingEvents && shipment.trackingEvents.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-primary-600" />
                {t('shipping.trackingHistory')}
              </h2>
              <div className="space-y-4">
                {shipment.trackingEvents.map((event: TrackingEvent, index: number) => (
                  <div key={event.id} className="flex">
                    <div className="flex flex-col items-center mr-4">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          event.exceptionFlag ? 'bg-red-100' : 'bg-green-100'
                        }`}
                      >
                        {event.exceptionFlag ? (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      {index < shipment.trackingEvents.length - 1 && (
                        <div className="w-0.5 h-full bg-gray-300 my-1"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-gray-900">{event.eventDescription}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(event.eventDate).toLocaleString()}
                        {event.city &&
                          ` • ${event.city}${event.state ? `, ${event.state}` : ''}`}
                      </p>
                      {event.exceptionFlag && event.exceptionReason && (
                        <p className="text-xs text-red-600 mt-1">{event.exceptionReason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Dates */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-primary-600" />
              {t('shipping.dates')}
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">{t('shipping.shipmentDate')}</p>
                <p className="text-base font-medium text-gray-900">
                  {new Date(shipment.shipmentDate).toLocaleDateString()}
                </p>
              </div>
              {shipment.estimatedDeliveryDate && (
                <div>
                  <p className="text-sm text-gray-600">{t('shipping.estimatedDelivery')}</p>
                  <p className="text-base font-medium text-gray-900">
                    {new Date(shipment.estimatedDeliveryDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {shipment.actualDeliveryDate && (
                <div>
                  <p className="text-sm text-gray-600">{t('shipping.actualDelivery')}</p>
                  <p className="text-base font-medium text-green-600">
                    {new Date(shipment.actualDeliveryDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Package Details */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Package className="h-5 w-5 mr-2 text-primary-600" />
              {t('shipping.packageDetails')}
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">{t('shipping.numberOfPackages')}</p>
                <p className="text-base font-medium text-gray-900">{shipment.numberOfPackages}</p>
              </div>
              {shipment.totalWeight && (
                <div>
                  <p className="text-sm text-gray-600">{t('shipping.totalWeight')}</p>
                  <p className="text-base font-medium text-gray-900">
                    {shipment.totalWeight} lbs
                  </p>
                </div>
              )}
              {shipment.totalVolume && (
                <div>
                  <p className="text-sm text-gray-600">{t('shipping.totalVolume')}</p>
                  <p className="text-base font-medium text-gray-900">
                    {shipment.totalVolume} cu ft
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Costs */}
          {shipment.totalCost && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-primary-600" />
                {t('shipping.costs')}
              </h2>
              <div className="space-y-3">
                {shipment.freight && (
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">{t('shipping.freight')}</p>
                    <p className="text-base font-medium text-gray-900">
                      ${shipment.freight.toFixed(2)}
                    </p>
                  </div>
                )}
                {shipment.insurance && (
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">{t('shipping.insurance')}</p>
                    <p className="text-base font-medium text-gray-900">
                      ${shipment.insurance.toFixed(2)}
                    </p>
                  </div>
                )}
                {shipment.otherCharges && (
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">{t('shipping.otherCharges')}</p>
                    <p className="text-base font-medium text-gray-900">
                      ${shipment.otherCharges.toFixed(2)}
                    </p>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between">
                  <p className="text-base font-bold text-gray-900">{t('shipping.totalCost')}</p>
                  <p className="text-base font-bold text-gray-900">
                    ${shipment.totalCost.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Documents */}
          {(shipment.bolDocument || shipment.commercialInvoice) && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-primary-600" />
                {t('shipping.documents')}
              </h2>
              <div className="space-y-2">
                {shipment.bolDocument && (
                  <a
                    href={shipment.bolDocument}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-primary-600 hover:text-primary-800"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {t('shipping.billOfLading')}
                  </a>
                )}
                {shipment.commercialInvoice && (
                  <a
                    href={shipment.commercialInvoice}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-primary-600 hover:text-primary-800"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {t('shipping.commercialInvoice')}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {(shipment.shippingNotes || shipment.deliveryNotes) && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{t('shipping.notes')}</h2>
              <div className="space-y-3">
                {shipment.shippingNotes && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {t('shipping.shippingNotes')}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{shipment.shippingNotes}</p>
                  </div>
                )}
                {shipment.deliveryNotes && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {t('shipping.deliveryNotes')}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{shipment.deliveryNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
