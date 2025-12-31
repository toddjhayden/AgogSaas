import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  Package,
  User,
  FileText,
} from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import {
  GET_PRODUCTION_RUN,
  START_PRODUCTION_RUN,
  COMPLETE_PRODUCTION_RUN,
} from '../graphql/queries/productionPlanning';

interface ProductionRun {
  id: string;
  productionRunNumber: string;
  productionOrderId: string;
  workCenterId: string;
  operationId: string;
  operatorName?: string;
  setupStartTime?: string;
  setupEndTime?: string;
  startTimestamp?: string;
  endTimestamp?: string;
  targetQuantity: number;
  goodQuantity: number;
  scrapQuantity: number;
  unitOfMeasure: string;
  actualSetupMinutes?: number;
  actualRunMinutes?: number;
  downtime?: number;
  downtimeReason?: string;
  status: string;
  notes?: string;
  productionOrder: {
    id: string;
    productionOrderNumber: string;
    productCode: string;
    productDescription: string;
    specialInstructions?: string;
  };
  workCenter: {
    id: string;
    workCenterCode: string;
    workCenterName: string;
  };
  operation: {
    id: string;
    operationCode: string;
    operationName: string;
    operationType: string;
    workInstructions?: string;
  };
}

const statusColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_SETUP: 'bg-yellow-100 text-yellow-800',
  RUNNING: 'bg-green-100 text-green-800',
  PAUSED: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
};

export const ProductionRunExecutionPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [goodQty, setGoodQty] = useState<number>(0);
  const [scrapQty, setScrapQty] = useState<number>(0);
  const [completionNotes, setCompletionNotes] = useState<string>('');

  const { data, loading, error, refetch } = useQuery(GET_PRODUCTION_RUN, {
    variables: { id },
    pollInterval: 5000, // Refresh every 5 seconds
  });

  const [startProductionRun, { loading: startLoading }] = useMutation(START_PRODUCTION_RUN, {
    onCompleted: () => {
      refetch();
    },
    onError: (err) => {
      alert(`Error starting production run: ${err.message}`);
    },
  });

  const [completeProductionRun, { loading: completeLoading }] = useMutation(
    COMPLETE_PRODUCTION_RUN,
    {
      onCompleted: () => {
        alert(t('production.runCompletedSuccessfully'));
        navigate('/operations/production-planning');
      },
      onError: (err) => {
        alert(`Error completing production run: ${err.message}`);
      },
    }
  );

  const handleStart = () => {
    if (window.confirm(t('production.confirmStartRun'))) {
      startProductionRun({ variables: { id } });
    }
  };

  const handleComplete = () => {
    if (goodQty + scrapQty === 0) {
      alert(t('production.enterQuantities'));
      return;
    }

    if (window.confirm(t('production.confirmCompleteRun'))) {
      completeProductionRun({
        variables: {
          id,
          goodQuantity: goodQty,
          scrapQuantity: scrapQty,
          notes: completionNotes || null,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !data?.productionRun) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('common.error')}</h3>
          <p className="text-gray-600">{error?.message || t('production.runNotFound')}</p>
        </div>
      </div>
    );
  }

  const run: ProductionRun = data.productionRun;
  const progressPercent =
    run.targetQuantity > 0 ? (run.goodQuantity / run.targetQuantity) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb
            items={[
              { label: t('nav.operations'), path: '/operations' },
              { label: t('nav.productionPlanning'), path: '/operations/production-planning' },
              {
                label: run.productionRunNumber,
                path: `/operations/production-runs/${id}`,
              },
            ]}
          />
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {t('production.runExecution')} - {run.productionRunNumber}
          </h1>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            statusColors[run.status] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {t(`production.runStatuses.${run.status}`)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Production Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Production Order Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('production.productionOrder')}
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">{t('production.orderNumber')}</p>
                <p className="font-medium text-gray-900">
                  {run.productionOrder.productionOrderNumber}
                </p>
              </div>
              <div>
                <p className="text-gray-600">{t('production.productCode')}</p>
                <p className="font-medium text-gray-900">{run.productionOrder.productCode}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600">{t('production.productDescription')}</p>
                <p className="font-medium text-gray-900">
                  {run.productionOrder.productDescription}
                </p>
              </div>
            </div>
            {run.productionOrder.specialInstructions && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-md border border-yellow-200">
                <p className="text-sm font-semibold text-yellow-900 mb-1">
                  {t('production.specialInstructions')}
                </p>
                <p className="text-sm text-yellow-800">{run.productionOrder.specialInstructions}</p>
              </div>
            )}
          </div>

          {/* Work Center & Operation Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('production.operationDetails')}
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">{t('production.workCenter')}</p>
                <p className="font-medium text-gray-900">{run.workCenter.workCenterName}</p>
                <p className="text-xs text-gray-500">{run.workCenter.workCenterCode}</p>
              </div>
              <div>
                <p className="text-gray-600">{t('production.operation')}</p>
                <p className="font-medium text-gray-900">{run.operation.operationName}</p>
                <p className="text-xs text-gray-500">
                  {t(`production.operationTypes.${run.operation.operationType}`)}
                </p>
              </div>
              {run.operatorName && (
                <div className="col-span-2">
                  <p className="text-gray-600 flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {t('production.operator')}
                  </p>
                  <p className="font-medium text-gray-900">{run.operatorName}</p>
                </div>
              )}
            </div>
            {run.operation.workInstructions && (
              <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  {t('production.workInstructions')}
                </p>
                <p className="text-sm text-blue-800 whitespace-pre-wrap">
                  {run.operation.workInstructions}
                </p>
              </div>
            )}
          </div>

          {/* Quantity Tracking */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('production.quantityTracking')}
            </h2>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">{t('production.progress')}</span>
                <span className="font-medium text-gray-900">
                  {progressPercent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600">
                  {run.goodQuantity.toLocaleString()} {run.unitOfMeasure}
                </span>
                <span className="text-gray-600">
                  {run.targetQuantity.toLocaleString()} {run.unitOfMeasure}
                </span>
              </div>
            </div>

            {/* Current Quantities */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 rounded-md p-3 border border-blue-200">
                <p className="text-sm text-blue-800 mb-1">{t('production.targetQuantity')}</p>
                <p className="text-2xl font-bold text-blue-900">
                  {run.targetQuantity.toLocaleString()}
                </p>
                <p className="text-xs text-blue-700">{run.unitOfMeasure}</p>
              </div>
              <div className="bg-green-50 rounded-md p-3 border border-green-200">
                <p className="text-sm text-green-800 mb-1">{t('production.goodQuantity')}</p>
                <p className="text-2xl font-bold text-green-900">
                  {run.goodQuantity.toLocaleString()}
                </p>
                <p className="text-xs text-green-700">{run.unitOfMeasure}</p>
              </div>
              <div className="bg-red-50 rounded-md p-3 border border-red-200">
                <p className="text-sm text-red-800 mb-1">{t('production.scrapQuantity')}</p>
                <p className="text-2xl font-bold text-red-900">
                  {run.scrapQuantity.toLocaleString()}
                </p>
                <p className="text-xs text-red-700">{run.unitOfMeasure}</p>
              </div>
            </div>

            {/* Completion Form (only visible when RUNNING) */}
            {run.status === 'RUNNING' && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-md font-semibold text-gray-900 mb-3">
                  {t('production.completeRun')}
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('production.goodQuantity')}
                    </label>
                    <input
                      type="number"
                      value={goodQty}
                      onChange={(e) => setGoodQty(parseFloat(e.target.value) || 0)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      placeholder="0"
                      min="0"
                      step="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('production.scrapQuantity')}
                    </label>
                    <input
                      type="number"
                      value={scrapQty}
                      onChange={(e) => setScrapQty(parseFloat(e.target.value) || 0)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      placeholder="0"
                      min="0"
                      step="1"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('production.notes')}
                  </label>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    rows={3}
                    placeholder={t('production.notesPlaceholder')}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Actions & Timeline */}
        <div className="space-y-6">
          {/* Action Buttons */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('production.actions')}
            </h2>
            <div className="space-y-3">
              {run.status === 'SCHEDULED' && (
                <button
                  onClick={handleStart}
                  disabled={startLoading}
                  className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                >
                  <Play className="h-5 w-5 mr-2" />
                  {startLoading ? t('common.loading') : t('production.startRun')}
                </button>
              )}

              {run.status === 'RUNNING' && (
                <button
                  onClick={handleComplete}
                  disabled={completeLoading}
                  className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  {completeLoading ? t('common.loading') : t('production.completeRun')}
                </button>
              )}

              <button
                onClick={() => navigate('/operations/production-planning')}
                className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                {t('common.backToDashboard')}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('production.timeline')}
            </h2>
            <div className="space-y-4">
              {run.setupStartTime && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-yellow-500 rounded-full mt-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {t('production.setupStarted')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(run.setupStartTime).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {run.startTimestamp && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {t('production.productionStarted')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(run.startTimestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {run.endTimestamp && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {t('production.productionCompleted')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(run.endTimestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Duration Info */}
            {run.actualSetupMinutes !== undefined && run.actualSetupMinutes > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('production.setupTime')}</span>
                  <span className="font-medium text-gray-900">
                    {run.actualSetupMinutes.toFixed(0)} {t('production.minutes')}
                  </span>
                </div>
              </div>
            )}
            {run.actualRunMinutes !== undefined && run.actualRunMinutes > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('production.runTime')}</span>
                  <span className="font-medium text-gray-900">
                    {run.actualRunMinutes.toFixed(0)} {t('production.minutes')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
