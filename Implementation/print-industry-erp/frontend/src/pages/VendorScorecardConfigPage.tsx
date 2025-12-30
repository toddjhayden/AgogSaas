/**
 * VENDOR SCORECARD CONFIGURATION PAGE
 *
 * Purpose: Configure weighted scorecard system for vendor performance evaluation
 * Feature: REQ-STRATEGIC-AUTO-1766689933757 - Vendor Scorecards Configuration
 * Author: Jen (Frontend Developer)
 * Date: 2025-12-26
 *
 * Features:
 * - Create/edit scorecard configurations
 * - Weight sliders with live validation (must sum to 100%)
 * - Threshold inputs for performance tiers
 * - Vendor type/tier filtering
 * - Active/inactive configuration management
 * - Effective date range controls
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Settings, Save, Plus, Edit2, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { DataTable } from '../components/common/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import {
  GET_VENDOR_SCORECARD_CONFIGS,
  UPSERT_SCORECARD_CONFIG,
} from '../graphql/queries/vendorScorecard';

interface ScorecardConfig {
  id: string;
  tenantId: string;
  configName: string;
  vendorType: string | null;
  vendorTier: 'STRATEGIC' | 'PREFERRED' | 'TRANSACTIONAL' | null;
  qualityWeight: number;
  deliveryWeight: number;
  costWeight: number;
  serviceWeight: number;
  innovationWeight: number;
  esgWeight: number;
  excellentThreshold: number;
  goodThreshold: number;
  acceptableThreshold: number;
  reviewFrequencyMonths: number;
  isActive: boolean;
  effectiveFromDate: string;
  effectiveToDate: string | null;
}

interface WeightInputs {
  qualityWeight: number;
  deliveryWeight: number;
  costWeight: number;
  serviceWeight: number;
  innovationWeight: number;
  esgWeight: number;
}

export const VendorScorecardConfigPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = 'tenant-default-001'; // TODO: Get from auth context

  const [isEditing, setIsEditing] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ScorecardConfig | null>(null);
  const [configName, setConfigName] = useState('');
  const [vendorType, setVendorType] = useState<string>('');
  const [vendorTier, setVendorTier] = useState<'STRATEGIC' | 'PREFERRED' | 'TRANSACTIONAL' | ''>('');

  const [weights, setWeights] = useState<WeightInputs>({
    qualityWeight: 25,
    deliveryWeight: 25,
    costWeight: 20,
    serviceWeight: 15,
    innovationWeight: 10,
    esgWeight: 5,
  });

  const [excellentThreshold, setExcellentThreshold] = useState(90);
  const [goodThreshold, setGoodThreshold] = useState(75);
  const [acceptableThreshold, setAcceptableThreshold] = useState(60);
  const [reviewFrequencyMonths, setReviewFrequencyMonths] = useState(12);
  const [isActive, setIsActive] = useState(true);
  const [effectiveFromDate, setEffectiveFromDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Fetch existing configurations
  const { data: configsData, loading, refetch } = useQuery<{
    getScorecardConfigs: ScorecardConfig[];
  }>(GET_VENDOR_SCORECARD_CONFIGS, {
    variables: { tenantId },
  });

  const [upsertConfig, { loading: saving }] = useMutation(UPSERT_SCORECARD_CONFIG);

  const configs = configsData?.getScorecardConfigs || [];

  // Calculate total weight
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const weightValid = totalWeight === 100;

  // Update weight
  const updateWeight = (key: keyof WeightInputs, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, value)) }));
  };

  // Auto-balance weights to sum to 100%
  const balanceWeights = () => {
    const total = totalWeight;
    if (total === 0) return;

    const scale = 100 / total;
    setWeights({
      qualityWeight: Math.round(weights.qualityWeight * scale),
      deliveryWeight: Math.round(weights.deliveryWeight * scale),
      costWeight: Math.round(weights.costWeight * scale),
      serviceWeight: Math.round(weights.serviceWeight * scale),
      innovationWeight: Math.round(weights.innovationWeight * scale),
      esgWeight: Math.round(weights.esgWeight * scale),
    });
  };

  // Reset form
  const resetForm = () => {
    setIsEditing(false);
    setEditingConfig(null);
    setConfigName('');
    setVendorType('');
    setVendorTier('');
    setWeights({
      qualityWeight: 25,
      deliveryWeight: 25,
      costWeight: 20,
      serviceWeight: 15,
      innovationWeight: 10,
      esgWeight: 5,
    });
    setExcellentThreshold(90);
    setGoodThreshold(75);
    setAcceptableThreshold(60);
    setReviewFrequencyMonths(12);
    setIsActive(true);
    setEffectiveFromDate(new Date().toISOString().split('T')[0]);
  };

  // Load configuration for editing
  const loadConfig = (config: ScorecardConfig) => {
    setIsEditing(true);
    setEditingConfig(config);
    setConfigName(config.configName);
    setVendorType(config.vendorType || '');
    setVendorTier(config.vendorTier || '');
    setWeights({
      qualityWeight: config.qualityWeight,
      deliveryWeight: config.deliveryWeight,
      costWeight: config.costWeight,
      serviceWeight: config.serviceWeight,
      innovationWeight: config.innovationWeight,
      esgWeight: config.esgWeight,
    });
    setExcellentThreshold(config.excellentThreshold);
    setGoodThreshold(config.goodThreshold);
    setAcceptableThreshold(config.acceptableThreshold);
    setReviewFrequencyMonths(config.reviewFrequencyMonths);
    setIsActive(config.isActive);
    setEffectiveFromDate(config.effectiveFromDate.split('T')[0]);
  };

  // Save configuration
  const handleSave = async () => {
    if (!configName.trim()) {
      alert('Please provide a configuration name');
      return;
    }

    if (!weightValid) {
      alert('Weights must sum to 100%. Use "Auto-Balance" button to fix.');
      return;
    }

    if (excellentThreshold <= goodThreshold || goodThreshold <= acceptableThreshold) {
      alert('Thresholds must be: Excellent > Good > Acceptable');
      return;
    }

    try {
      await upsertConfig({
        variables: {
          config: {
            tenantId,
            configName: configName.trim(),
            vendorType: vendorType || null,
            vendorTier: vendorTier || null,
            ...weights,
            excellentThreshold,
            goodThreshold,
            acceptableThreshold,
            reviewFrequencyMonths,
            isActive,
            effectiveFromDate,
            effectiveToDate: null,
          },
          userId: 'current-user-id', // TODO: Get from auth context
        },
      });

      alert('Configuration saved successfully!');
      resetForm();
      refetch();
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert('Failed to save configuration. Please try again.');
    }
  };

  // Table columns
  const columns: ColumnDef<ScorecardConfig>[] = [
    {
      accessorKey: 'configName',
      header: 'Configuration Name',
    },
    {
      accessorKey: 'vendorType',
      header: 'Vendor Type',
      cell: (info) => info.getValue() || 'All',
    },
    {
      accessorKey: 'vendorTier',
      header: 'Vendor Tier',
      cell: (info) => info.getValue() || 'All',
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: (info) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            info.getValue()
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {info.getValue() ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      accessorKey: 'effectiveFromDate',
      header: 'Effective From',
      cell: (info) => new Date(info.getValue() as string).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <button
          onClick={() => loadConfig(info.row.original)}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
        >
          <Edit2 className="w-4 h-4 inline mr-1" />
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Procurement', path: '/procurement/purchase-orders' },
          { label: 'Vendor Scorecards', path: '/procurement/vendor-scorecard-enhanced' },
          { label: 'Configuration', path: '/procurement/vendor-scorecard-config' },
        ]}
      />

      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scorecard Configuration</h1>
          <p className="text-gray-600 mt-2">
            Configure weighted scoring system for vendor performance evaluation
          </p>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          {isEditing ? (
            <>
              <Trash2 className="w-5 h-5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              New Configuration
            </>
          )}
        </button>
      </div>

      {/* Configuration Form */}
      {isEditing && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-primary-600" />
            <h2 className="text-xl font-bold text-gray-900">
              {editingConfig ? 'Edit Configuration' : 'New Configuration'}
            </h2>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Configuration Name *
              </label>
              <input
                type="text"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="e.g., Standard Scorecard 2025"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Type (Optional)
              </label>
              <input
                type="text"
                value={vendorType}
                onChange={(e) => setVendorType(e.target.value)}
                placeholder="e.g., MATERIAL, SERVICE"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Tier (Optional)
              </label>
              <select
                value={vendorTier}
                onChange={(e) => setVendorTier(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Tiers</option>
                <option value="STRATEGIC">Strategic</option>
                <option value="PREFERRED">Preferred</option>
                <option value="TRANSACTIONAL">Transactional</option>
              </select>
            </div>
          </div>

          {/* Weight Sliders */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Category Weights</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={balanceWeights}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Auto-Balance
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Total:</span>
                  <span
                    className={`text-lg font-bold ${
                      weightValid ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {totalWeight}%
                  </span>
                  {weightValid ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(weights).map(([key, value]) => (
                <div key={key} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 capitalize">
                      {key.replace('Weight', '')}
                    </label>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) =>
                        updateWeight(key as keyof WeightInputs, parseFloat(e.target.value) || 0)
                      }
                      min="0"
                      max="100"
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <input
                    type="range"
                    value={value}
                    onChange={(e) =>
                      updateWeight(key as keyof WeightInputs, parseFloat(e.target.value))
                    }
                    min="0"
                    max="100"
                    step="1"
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>{value}%</span>
                    <span>100%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Thresholds */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Excellent Threshold (0-100)
              </label>
              <input
                type="number"
                value={excellentThreshold}
                onChange={(e) => setExcellentThreshold(parseInt(e.target.value) || 0)}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Good Threshold (0-100)
              </label>
              <input
                type="number"
                value={goodThreshold}
                onChange={(e) => setGoodThreshold(parseInt(e.target.value) || 0)}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Acceptable Threshold (0-100)
              </label>
              <input
                type="number"
                value={acceptableThreshold}
                onChange={(e) => setAcceptableThreshold(parseInt(e.target.value) || 0)}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Additional Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Review Frequency (Months)
              </label>
              <input
                type="number"
                value={reviewFrequencyMonths}
                onChange={(e) => setReviewFrequencyMonths(parseInt(e.target.value) || 12)}
                min="1"
                max="24"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Effective From Date
              </label>
              <input
                type="date"
                value={effectiveFromDate}
                onChange={(e) => setEffectiveFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center pt-7">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Active Configuration</span>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={resetForm}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !weightValid}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* Existing Configurations Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Existing Configurations</h2>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading configurations...</p>
          </div>
        ) : configs.length > 0 ? (
          <DataTable data={configs} columns={columns} />
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Configurations</h3>
            <p className="text-gray-600">Create your first scorecard configuration to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};
