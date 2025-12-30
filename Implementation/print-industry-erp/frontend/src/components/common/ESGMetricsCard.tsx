import React from 'react';
import { Leaf, Users, Shield, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

export interface ESGMetrics {
  // Environmental
  carbonFootprintTonsCO2e?: number;
  carbonFootprintTrend?: 'IMPROVING' | 'STABLE' | 'WORSENING';
  wasteReductionPercentage?: number;
  renewableEnergyPercentage?: number;
  packagingSustainabilityScore?: number;

  // Social
  laborPracticesScore?: number;
  humanRightsComplianceScore?: number;
  diversityScore?: number;
  workerSafetyRating?: number;

  // Governance
  ethicsComplianceScore?: number;
  antiCorruptionScore?: number;
  supplyChainTransparencyScore?: number;

  // Overall
  esgOverallScore?: number;
  esgRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

  // Metadata
  lastAuditDate?: string;
  nextAuditDueDate?: string;
}

export interface ESGMetricsCardProps {
  metrics: ESGMetrics | null | undefined;
  showDetails?: boolean;
  className?: string;
}

const getTrendIcon = (trend: string | undefined) => {
  switch (trend) {
    case 'IMPROVING':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'WORSENING':
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    case 'STABLE':
      return <Minus className="h-4 w-4 text-blue-600" />;
    default:
      return null;
  }
};

const getRiskLevelBadge = (riskLevel: string | undefined) => {
  if (!riskLevel) return null;

  const config = {
    LOW: { bg: 'bg-green-100', text: 'text-green-800', label: 'Low Risk' },
    MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medium Risk' },
    HIGH: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'High Risk' },
    CRITICAL: { bg: 'bg-red-100', text: 'text-red-800', label: 'Critical Risk' },
    UNKNOWN: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Unknown' }
  }[riskLevel] || { bg: 'bg-gray-100', text: 'text-gray-800', label: riskLevel };

  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.bg, config.text)}>
      {config.label}
    </span>
  );
};

const formatStarRating = (score: number | undefined) => {
  if (score === undefined || score === null) return 'N/A';
  return `${score.toFixed(1)} / 5.0`;
};

const formatPercentage = (value: number | undefined) => {
  if (value === undefined || value === null) return 'N/A';
  return `${value.toFixed(1)}%`;
};

const formatNumber = (value: number | undefined) => {
  if (value === undefined || value === null) return 'N/A';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

/**
 * ESGMetricsCard - Displays Environmental, Social, and Governance metrics
 *
 * Features:
 * - Three-pillar ESG breakdown (Environmental, Social, Governance)
 * - Carbon footprint with trend indicators
 * - Overall ESG score (0-5 stars)
 * - Risk level badge (LOW/MEDIUM/HIGH/CRITICAL)
 * - Audit date tracking
 * - Expandable detail view
 *
 * Based on EcoVadis framework and EU CSRD compliance requirements
 */
export const ESGMetricsCard: React.FC<ESGMetricsCardProps> = ({
  metrics,
  showDetails = true,
  className
}) => {
  if (!metrics) {
    return (
      <div className={clsx('card border-l-4 border-gray-300', className)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">ESG Metrics</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            No Data Available
          </span>
        </div>
        <p className="text-sm text-gray-600">ESG metrics have not been recorded for this vendor.</p>
      </div>
    );
  }

  return (
    <div className={clsx('card border-l-4 border-green-500', className)}>
      {/* Header with Overall Score */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">ESG Metrics</h3>
          <p className="text-sm text-gray-600">Environmental, Social & Governance</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-green-600">{formatStarRating(metrics.esgOverallScore)}</div>
          <p className="text-xs text-gray-500 mt-1">Overall ESG Score</p>
          <div className="mt-2">{getRiskLevelBadge(metrics.esgRiskLevel)}</div>
        </div>
      </div>

      {/* Three Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Environmental */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold text-gray-900">Environmental</h4>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Carbon Footprint</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-gray-900">
                  {formatNumber(metrics.carbonFootprintTonsCO2e)} t CO<sub>2</sub>e
                </span>
                {getTrendIcon(metrics.carbonFootprintTrend)}
              </div>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Waste Reduction</span>
              <span className="text-sm font-medium text-gray-900">{formatPercentage(metrics.wasteReductionPercentage)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Renewable Energy</span>
              <span className="text-sm font-medium text-gray-900">{formatPercentage(metrics.renewableEnergyPercentage)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Packaging Score</span>
              <span className="text-sm font-medium text-gray-900">{formatStarRating(metrics.packagingSustainabilityScore)}</span>
            </div>
          </div>
        </div>

        {/* Social */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-blue-600" />
            <h4 className="font-semibold text-gray-900">Social</h4>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Labor Practices</span>
              <span className="text-sm font-medium text-gray-900">{formatStarRating(metrics.laborPracticesScore)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Human Rights</span>
              <span className="text-sm font-medium text-gray-900">{formatStarRating(metrics.humanRightsComplianceScore)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Diversity</span>
              <span className="text-sm font-medium text-gray-900">{formatStarRating(metrics.diversityScore)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Worker Safety</span>
              <span className="text-sm font-medium text-gray-900">{formatStarRating(metrics.workerSafetyRating)}</span>
            </div>
          </div>
        </div>

        {/* Governance */}
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-purple-600" />
            <h4 className="font-semibold text-gray-900">Governance</h4>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Ethics Compliance</span>
              <span className="text-sm font-medium text-gray-900">{formatStarRating(metrics.ethicsComplianceScore)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Anti-Corruption</span>
              <span className="text-sm font-medium text-gray-900">{formatStarRating(metrics.antiCorruptionScore)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Supply Chain Transparency</span>
              <span className="text-sm font-medium text-gray-900">{formatStarRating(metrics.supplyChainTransparencyScore)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Information */}
      {(metrics.lastAuditDate || metrics.nextAuditDueDate) && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.lastAuditDate && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Last Audit</p>
                <p className="text-sm font-medium text-gray-900">{new Date(metrics.lastAuditDate).toLocaleDateString()}</p>
              </div>
            )}

            {metrics.nextAuditDueDate && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Next Audit Due</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{new Date(metrics.nextAuditDueDate).toLocaleDateString()}</p>
                  {new Date(metrics.nextAuditDueDate) < new Date() && (
                    <AlertTriangle className="h-4 w-4 text-red-600" title="Audit overdue" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
