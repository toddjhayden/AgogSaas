import React from 'react';
import { DollarSign, TrendingUp, Calendar, Target, CheckCircle } from 'lucide-react';

/**
 * ROI Metrics Card Component
 * REQ-STRATEGIC-AUTO-1766527796497 - Sylvia's Critique Recommendations
 * Author: Jen (Frontend Developer)
 *
 * Purpose: Display Return on Investment metrics for bin optimization features
 * Shows cost, benefits, payback period, and 3-year NPV
 */

interface ROIMetricsCardProps {
  title: string;
  description?: string;
  investmentCost: number;
  annualBenefit: number;
  implementationHours: number;
  paybackMonths: number;
  threeYearNPV?: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'DEFER';
  status?: 'COMPLETED' | 'IN_PROGRESS' | 'PLANNED' | 'DEFERRED';
  expectedImpact?: string;
  timeline?: string;
}

export const ROIMetricsCard: React.FC<ROIMetricsCardProps> = ({
  title,
  description,
  investmentCost,
  annualBenefit,
  implementationHours,
  paybackMonths,
  threeYearNPV,
  priority,
  status = 'PLANNED',
  expectedImpact,
  timeline,
}) => {
  // Calculate ROI percentage
  const roiPercent = annualBenefit > 0 ? ((annualBenefit - investmentCost) / investmentCost) * 100 : 0;

  // Priority color coding
  const priorityColors = {
    CRITICAL: 'bg-danger-100 text-danger-800 border-danger-300',
    HIGH: 'bg-warning-100 text-warning-800 border-warning-300',
    MEDIUM: 'bg-primary-100 text-primary-800 border-primary-300',
    LOW: 'bg-gray-100 text-gray-800 border-gray-300',
    DEFER: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const statusColors = {
    COMPLETED: 'bg-success-100 text-success-800 border-success-300',
    IN_PROGRESS: 'bg-primary-100 text-primary-800 border-primary-300',
    PLANNED: 'bg-gray-100 text-gray-700 border-gray-300',
    DEFERRED: 'bg-gray-50 text-gray-500 border-gray-200',
  };

  const cardBorderColor =
    priority === 'CRITICAL' ? 'border-danger-500' :
    priority === 'HIGH' ? 'border-warning-500' :
    priority === 'MEDIUM' ? 'border-primary-500' :
    'border-gray-300';

  return (
    <div className={`card border-l-4 ${cardBorderColor} hover:shadow-lg transition-shadow`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>
        <div className="flex flex-col items-end space-y-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${priorityColors[priority]}`}>
            {priority}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[status]}`}>
            {status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Expected Impact */}
      {expectedImpact && (
        <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Target className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-primary-900">Expected Impact</p>
              <p className="text-sm text-primary-700 mt-1">{expectedImpact}</p>
            </div>
          </div>
        </div>
      )}

      {/* ROI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Investment Cost */}
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-2 mb-1">
            <DollarSign className="h-4 w-4 text-gray-600" />
            <span className="text-xs text-gray-600 font-medium">Investment</span>
          </div>
          <p className="text-lg font-bold text-gray-900">
            ${investmentCost.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {implementationHours}h @ $150/hr
          </p>
        </div>

        {/* Annual Benefit */}
        <div className="bg-success-50 p-3 rounded-lg border border-success-200">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="h-4 w-4 text-success-600" />
            <span className="text-xs text-gray-600 font-medium">Annual Benefit</span>
          </div>
          <p className="text-lg font-bold text-success-700">
            ${annualBenefit.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Per year savings
          </p>
        </div>

        {/* Payback Period */}
        <div className="bg-primary-50 p-3 rounded-lg border border-primary-200">
          <div className="flex items-center space-x-2 mb-1">
            <Calendar className="h-4 w-4 text-primary-600" />
            <span className="text-xs text-gray-600 font-medium">Payback</span>
          </div>
          <p className="text-lg font-bold text-primary-700">
            {paybackMonths.toFixed(1)} mo
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {paybackMonths < 6 ? 'Excellent' : paybackMonths < 12 ? 'Good' : 'Moderate'}
          </p>
        </div>

        {/* ROI % */}
        <div className={`p-3 rounded-lg border ${
          roiPercent > 200 ? 'bg-success-50 border-success-200' :
          roiPercent > 100 ? 'bg-primary-50 border-primary-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center space-x-2 mb-1">
            <CheckCircle className="h-4 w-4 text-gray-600" />
            <span className="text-xs text-gray-600 font-medium">ROI (Year 1)</span>
          </div>
          <p className={`text-lg font-bold ${
            roiPercent > 200 ? 'text-success-700' :
            roiPercent > 100 ? 'text-primary-700' :
            'text-gray-700'
          }`}>
            {roiPercent.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Return on investment
          </p>
        </div>
      </div>

      {/* 3-Year NPV */}
      {threeYearNPV && threeYearNPV > 0 && (
        <div className="mb-4 p-3 bg-success-50 border border-success-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-success-900">3-Year Net Present Value</p>
              <p className="text-xs text-success-700 mt-1">Assuming 15% discount rate</p>
            </div>
            <p className="text-2xl font-bold text-success-700">
              ${threeYearNPV.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline && (
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="font-medium">Timeline:</span>
            <span>{timeline}</span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * ROI Summary Dashboard Component
 * Displays multiple ROI cards with summary metrics
 */

interface ROISummaryDashboardProps {
  roiItems: ROIMetricsCardProps[];
  title?: string;
  showSummary?: boolean;
}

export const ROISummaryDashboard: React.FC<ROISummaryDashboardProps> = ({
  roiItems,
  title = 'Investment Prioritization & ROI Analysis',
  showSummary = true,
}) => {
  // Calculate totals
  const totalInvestment = roiItems.reduce((sum, item) => sum + item.investmentCost, 0);
  const totalAnnualBenefit = roiItems.reduce((sum, item) => sum + item.annualBenefit, 0);
  const totalROI = totalAnnualBenefit > 0 ? ((totalAnnualBenefit - totalInvestment) / totalInvestment) * 100 : 0;
  const avgPayback = roiItems.reduce((sum, item) => sum + item.paybackMonths, 0) / roiItems.length;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      {showSummary && (
        <div className="card bg-gradient-to-r from-primary-50 to-success-50 border-2 border-primary-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="h-5 w-5 text-gray-600" />
                <span className="text-sm text-gray-600 font-medium">Total Investment</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                ${totalInvestment.toLocaleString()}
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-success-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="h-5 w-5 text-success-600" />
                <span className="text-sm text-gray-600 font-medium">Annual Return</span>
              </div>
              <p className="text-2xl font-bold text-success-700">
                ${totalAnnualBenefit.toLocaleString()}
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-primary-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="h-5 w-5 text-primary-600" />
                <span className="text-sm text-gray-600 font-medium">Avg Payback</span>
              </div>
              <p className="text-2xl font-bold text-primary-700">
                {avgPayback.toFixed(1)} mo
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-success-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Target className="h-5 w-5 text-success-600" />
                <span className="text-sm text-gray-600 font-medium">Portfolio ROI</span>
              </div>
              <p className="text-2xl font-bold text-success-700">
                {totalROI.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ROI Cards Grid */}
      <div className="grid grid-cols-1 gap-6">
        {roiItems.map((item, index) => (
          <ROIMetricsCard key={index} {...item} />
        ))}
      </div>
    </div>
  );
};
