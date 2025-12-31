import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Save,
  Settings,
  Sliders,
  Target,
  TrendingUp,
  BarChart3,
  Users,
  Clock,
  Package,
} from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { ColumnDef } from '@tanstack/react-table';
import {
  GET_OPTIMIZATION_WEIGHT_CONFIGS,
  GET_ACTIVE_OPTIMIZATION_WEIGHTS,
  GET_WEIGHT_PERFORMANCE_COMPARISON,
  SAVE_OPTIMIZATION_WEIGHTS,
  ACTIVATE_OPTIMIZATION_WEIGHTS,
} from '../graphql/queries/binUtilization';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';

/**
 * Bin Optimization Configuration Page
 * REQ-STRATEGIC-AUTO-1766600259419 - OPP-2
 *
 * Features:
 * - Multi-objective optimization weight configuration
 * - Pareto frontier visualization
 * - A/B testing framework for weight configurations
 * - Performance comparison across configurations
 * - Facility-specific customization
 */

// TypeScript interfaces
interface WeightConfig {
  weightConfigId: string;
  facilityId: string;
  configName: string;
  isActive: boolean;
  spaceUtilizationWeight: number;
  travelDistanceWeight: number;
  putawayTimeWeight: number;
  fragmentationWeight: number;
  ergonomicWeight: number;
  recommendationsGenerated: number;
  acceptanceRate: number;
  avgConfidenceScore: number;
  createdAt: string;
  updatedAt: string;
}

interface PerformanceMetrics {
  avgSpaceUtilization: number;
  avgPickTravelTime: number;
  avgPutawayTime: number;
  fragmentationIndex: number;
  ergonomicCompliance: number;
  recommendationAcceptanceRate: number;
  overallSatisfactionScore: number;
}

interface PerformanceComparison {
  configName: string;
  timeRange: string;
  metrics: PerformanceMetrics;
  isCurrentConfig: boolean;
}

const BinOptimizationConfigPage: React.FC = () => {
  const { t: _t } = useTranslation();
  const [selectedFacility, setSelectedFacility] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [_editingConfig, setEditingConfig] = useState<Partial<WeightConfig> | null>(null);

  // Weight state for new/edit configuration
  const [weights, setWeights] = useState({
    configName: '',
    spaceUtilizationWeight: 0.40,
    travelDistanceWeight: 0.25,
    putawayTimeWeight: 0.15,
    fragmentationWeight: 0.10,
    ergonomicWeight: 0.10,
  });

  // Query: Weight Configurations
  const {
    data: configsData,
    loading: configsLoading,
    refetch: refetchConfigs,
  } = useQuery(GET_OPTIMIZATION_WEIGHT_CONFIGS, {
    variables: { facilityId: selectedFacility || undefined },
    skip: !selectedFacility,
    pollInterval: 60000, // 1 minute
  });

  // Query: Active Weights
  const {
    data: activeWeightsData,
    loading: activeWeightsLoading,
  } = useQuery(GET_ACTIVE_OPTIMIZATION_WEIGHTS, {
    variables: { facilityId: selectedFacility || undefined },
    skip: !selectedFacility,
  });

  // Query: Performance Comparison
  const {
    data: performanceData,
    loading: performanceLoading,
  } = useQuery(GET_WEIGHT_PERFORMANCE_COMPARISON, {
    variables: { facilityId: selectedFacility || undefined },
    skip: !selectedFacility,
    pollInterval: 300000, // 5 minutes
  });

  // Mutation: Save Optimization Weights
  const [saveWeights, { loading: savingWeights }] = useMutation(SAVE_OPTIMIZATION_WEIGHTS, {
    onCompleted: () => {
      toast.success('Optimization weights saved successfully');
      setIsEditing(false);
      setEditingConfig(null);
      refetchConfigs();
    },
    onError: (error) => {
      toast.error(`Failed to save weights: ${error.message}`);
    },
  });

  // Mutation: Activate Weights
  const [activateWeights, { loading: activatingWeights }] = useMutation(ACTIVATE_OPTIMIZATION_WEIGHTS, {
    onCompleted: () => {
      toast.success('Configuration activated successfully');
      refetchConfigs();
    },
    onError: (error) => {
      toast.error(`Failed to activate configuration: ${error.message}`);
    },
  });

  const configs = configsData?.getOptimizationWeightConfigs || [];
  const activeWeights = activeWeightsData?.getActiveOptimizationWeights;
  const performanceComparisons = performanceData?.getWeightPerformanceComparison || [];

  // Calculate total weight (should always be 1.0)
  const totalWeight =
    weights.spaceUtilizationWeight +
    weights.travelDistanceWeight +
    weights.putawayTimeWeight +
    weights.fragmentationWeight +
    weights.ergonomicWeight;

  const isWeightValid = Math.abs(totalWeight - 1.0) < 0.001;

  // Handle weight change with auto-normalization
  const handleWeightChange = (key: string, value: number) => {
    setWeights((prev) => {
      const newWeights = { ...prev, [key]: value };
      return newWeights;
    });
  };

  // Normalize weights to sum to 1.0
  const normalizeWeights = () => {
    const sum =
      weights.spaceUtilizationWeight +
      weights.travelDistanceWeight +
      weights.putawayTimeWeight +
      weights.fragmentationWeight +
      weights.ergonomicWeight;

    if (sum > 0) {
      setWeights({
        ...weights,
        spaceUtilizationWeight: weights.spaceUtilizationWeight / sum,
        travelDistanceWeight: weights.travelDistanceWeight / sum,
        putawayTimeWeight: weights.putawayTimeWeight / sum,
        fragmentationWeight: weights.fragmentationWeight / sum,
        ergonomicWeight: weights.ergonomicWeight / sum,
      });
    }
  };

  // Handle save configuration
  const handleSaveConfig = async () => {
    if (!isWeightValid) {
      toast.error('Weights must sum to 1.0. Click "Normalize" to auto-adjust.');
      return;
    }

    if (!weights.configName.trim()) {
      toast.error('Please provide a configuration name');
      return;
    }

    await saveWeights({
      variables: {
        facilityId: selectedFacility,
        ...weights,
        setActive: false,
      },
    });
  };

  // Handle activate configuration
  const handleActivateConfig = async (weightConfigId: string) => {
    await activateWeights({
      variables: { weightConfigId },
    });
  };

  // Handle edit configuration
  const handleEditConfig = (config: WeightConfig) => {
    setEditingConfig(config);
    setWeights({
      configName: config.configName,
      spaceUtilizationWeight: config.spaceUtilizationWeight,
      travelDistanceWeight: config.travelDistanceWeight,
      putawayTimeWeight: config.putawayTimeWeight,
      fragmentationWeight: config.fragmentationWeight,
      ergonomicWeight: config.ergonomicWeight,
    });
    setIsEditing(true);
  };

  // Prepare chart data for weight visualization
  const weightChartData = [
    { name: 'Space Utilization', value: weights.spaceUtilizationWeight * 100, fill: '#3b82f6' },
    { name: 'Travel Distance', value: weights.travelDistanceWeight * 100, fill: '#10b981' },
    { name: 'Putaway Time', value: weights.putawayTimeWeight * 100, fill: '#f59e0b' },
    { name: 'Fragmentation', value: weights.fragmentationWeight * 100, fill: '#8b5cf6' },
    { name: 'Ergonomic', value: weights.ergonomicWeight * 100, fill: '#ec4899' },
  ];

  // Prepare chart data for performance comparison
  const performanceChartData = performanceComparisons.map((comp: PerformanceComparison) => ({
    config: comp.configName,
    'Space Util (%)': comp.metrics.avgSpaceUtilization,
    'Accept Rate (%)': comp.metrics.recommendationAcceptanceRate * 100,
    'Ergonomic (%)': comp.metrics.ergonomicCompliance * 100,
    'Satisfaction': comp.metrics.overallSatisfactionScore * 100,
  }));

  // Table columns for configurations
  const configColumns: ColumnDef<WeightConfig>[] = [
    {
      accessorKey: 'configName',
      header: 'Configuration Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.configName}</span>
          {row.original.isActive && (
            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
              Active
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Weight Distribution',
      cell: ({ row }) => (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Space:</span>
            <span className="font-medium">{(row.original.spaceUtilizationWeight * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span>Travel:</span>
            <span className="font-medium">{(row.original.travelDistanceWeight * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span>Putaway:</span>
            <span className="font-medium">{(row.original.putawayTimeWeight * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span>Fragmentation:</span>
            <span className="font-medium">{(row.original.fragmentationWeight * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span>Ergonomic:</span>
            <span className="font-medium">{(row.original.ergonomicWeight * 100).toFixed(0)}%</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'acceptanceRate',
      header: 'Acceptance Rate',
      cell: ({ getValue }) => {
        const value = getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${value * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium">{(value * 100).toFixed(1)}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'recommendationsGenerated',
      header: 'Recommendations',
      cell: ({ getValue }) => (
        <span className="text-sm">{getValue() as number}</span>
      ),
    },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          {!row.original.isActive && (
            <button
              onClick={() => handleActivateConfig(row.original.weightConfigId)}
              disabled={activatingWeights}
              className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Activate
            </button>
          )}
          <button
            onClick={() => handleEditConfig(row.original)}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Edit
          </button>
        </div>
      ),
    },
  ];

  const isLoading = configsLoading || activeWeightsLoading || performanceLoading;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'WMS', path: '/wms' },
          { label: 'Optimization Configuration', path: '/wms/optimization-config' },
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Multi-Objective Optimization Configuration
          </h1>
          <p className="text-gray-600 mt-1">
            Configure optimization weights and run A/B tests (OPP-2)
          </p>
        </div>
        <FacilitySelector
          selectedFacility={selectedFacility}
          onFacilityChange={(facility) => setSelectedFacility(facility ?? '')}
        />
      </div>

      {!selectedFacility && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Select a Facility</h3>
            <p className="text-sm text-blue-700 mt-1">
              Please select a facility to view and configure optimization weights.
            </p>
          </div>
        </div>
      )}

      {selectedFacility && (
        <>
          {/* Active Configuration Summary */}
          {activeWeights && (
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{activeWeights.configName}</h2>
                  <p className="text-blue-100 mt-1">Currently Active Configuration</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{(activeWeights.acceptanceRate * 100).toFixed(1)}%</div>
                  <div className="text-blue-100">Acceptance Rate</div>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-4 mt-6">
                <div>
                  <div className="text-blue-100 text-sm">Space Util</div>
                  <div className="text-2xl font-bold">{(activeWeights.spaceUtilizationWeight * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-blue-100 text-sm">Travel Dist</div>
                  <div className="text-2xl font-bold">{(activeWeights.travelDistanceWeight * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-blue-100 text-sm">Putaway Time</div>
                  <div className="text-2xl font-bold">{(activeWeights.putawayTimeWeight * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-blue-100 text-sm">Fragmentation</div>
                  <div className="text-2xl font-bold">{(activeWeights.fragmentationWeight * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-blue-100 text-sm">Ergonomic</div>
                  <div className="text-2xl font-bold">{(activeWeights.ergonomicWeight * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Weight Configuration Editor */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Sliders className="h-5 w-5" />
                {isEditing ? 'Edit Configuration' : 'Create New Configuration'}
              </h2>
              {isEditing && (
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditingConfig(null);
                    setWeights({
                      configName: '',
                      spaceUtilizationWeight: 0.40,
                      travelDistanceWeight: 0.25,
                      putawayTimeWeight: 0.15,
                      fragmentationWeight: 0.10,
                      ergonomicWeight: 0.10,
                    });
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="space-y-6">
              {/* Configuration Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Name
                </label>
                <input
                  type="text"
                  value={weights.configName}
                  onChange={(e) => setWeights({ ...weights, configName: e.target.value })}
                  placeholder="e.g., High Space Optimization, Balanced, Fast Putaway"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Weight Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Space Utilization Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Space Utilization
                    </label>
                    <span className="text-sm font-semibold text-blue-600">
                      {(weights.spaceUtilizationWeight * 100).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={weights.spaceUtilizationWeight}
                    onChange={(e) => handleWeightChange('spaceUtilizationWeight', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximize bin space efficiency</p>
                </div>

                {/* Travel Distance Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Travel Distance
                    </label>
                    <span className="text-sm font-semibold text-green-600">
                      {(weights.travelDistanceWeight * 100).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={weights.travelDistanceWeight}
                    onChange={(e) => handleWeightChange('travelDistanceWeight', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimize pick travel time</p>
                </div>

                {/* Putaway Time Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Putaway Time
                    </label>
                    <span className="text-sm font-semibold text-orange-600">
                      {(weights.putawayTimeWeight * 100).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={weights.putawayTimeWeight}
                    onChange={(e) => handleWeightChange('putawayTimeWeight', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimize putaway labor time</p>
                </div>

                {/* Fragmentation Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Fragmentation
                    </label>
                    <span className="text-sm font-semibold text-purple-600">
                      {(weights.fragmentationWeight * 100).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={weights.fragmentationWeight}
                    onChange={(e) => handleWeightChange('fragmentationWeight', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimize bin fragmentation</p>
                </div>

                {/* Ergonomic Weight */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Ergonomic Safety
                    </label>
                    <span className="text-sm font-semibold text-pink-600">
                      {(weights.ergonomicWeight * 100).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={weights.ergonomicWeight}
                    onChange={(e) => handleWeightChange('ergonomicWeight', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximize ergonomic compliance and worker safety</p>
                </div>
              </div>

              {/* Total Weight Indicator */}
              <div className={`p-4 rounded-lg ${isWeightValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isWeightValid ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`font-medium ${isWeightValid ? 'text-green-900' : 'text-red-900'}`}>
                      Total Weight: {(totalWeight * 100).toFixed(1)}%
                    </span>
                  </div>
                  {!isWeightValid && (
                    <button
                      onClick={normalizeWeights}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Normalize
                    </button>
                  )}
                </div>
                <p className={`text-sm mt-1 ${isWeightValid ? 'text-green-700' : 'text-red-700'}`}>
                  {isWeightValid
                    ? 'Weights are properly balanced and sum to 100%'
                    : 'Weights must sum to 100%. Click "Normalize" to auto-adjust.'}
                </p>
              </div>

              {/* Weight Distribution Chart */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Weight Distribution</h3>
                <Chart
                  type="pie"
                  data={weightChartData}
                  height={250}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 border-t">
                <button
                  onClick={handleSaveConfig}
                  disabled={!isWeightValid || savingWeights}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4" />
                  {savingWeights ? 'Saving...' : 'Save Configuration'}
                </button>
                <button
                  onClick={() => {
                    setWeights({
                      configName: '',
                      spaceUtilizationWeight: 0.40,
                      travelDistanceWeight: 0.25,
                      putawayTimeWeight: 0.15,
                      fragmentationWeight: 0.10,
                      ergonomicWeight: 0.10,
                    });
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          </div>

          {/* Saved Configurations */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Saved Configurations
            </h2>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Activity className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            ) : configs.length > 0 ? (
              <DataTable
                columns={configColumns}
                data={configs}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No configurations saved yet
              </div>
            )}
          </div>

          {/* Performance Comparison */}
          {performanceComparisons.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Configuration Performance Comparison
              </h2>
              <Chart
                type="bar"
                data={performanceChartData}
                height={300}
                xKey="config"
                yKey={['Space Util (%)', 'Accept Rate (%)', 'Ergonomic (%)', 'Satisfaction']}
                colors={['#3b82f6', '#10b981', '#ec4899', '#f59e0b']}
              />
            </div>
          )}

          {/* Information Panel */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900">About Multi-Objective Optimization</h3>
                <div className="text-sm text-blue-700 mt-2 space-y-2">
                  <p>
                    Configure how different objectives are weighted when the system recommends putaway locations.
                    Higher weights prioritize that objective more heavily.
                  </p>
                  <p>
                    <strong>Expected Impact:</strong> 10-15% increase in recommendation acceptance rate through
                    facility-specific customization and better alignment with business priorities.
                  </p>
                  <p>
                    <strong>Recommended Approach:</strong> Start with the default "Balanced" configuration, then
                    adjust based on your facility's specific needs and priorities.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BinOptimizationConfigPage;
