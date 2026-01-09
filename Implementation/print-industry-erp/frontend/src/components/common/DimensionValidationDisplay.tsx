import React from 'react';
import { CheckCircle, XCircle, Package, AlertTriangle } from 'lucide-react';

/**
 * Dimension Validation Display Component
 * REQ-STRATEGIC-AUTO-1766527796497 - Marcus's Implementation
 * Author: Jen (Frontend Developer)
 *
 * Purpose: Visual display of 3D dimension validation results
 * Shows whether an item fits in a bin with rotation logic
 */

interface DimensionValidationDisplayProps {
  itemDimensions: {
    lengthInches: number;
    widthInches: number;
    heightInches: number;
    cubicFeet?: number;
    weightLbs?: number;
  };
  binDimensions?: {
    lengthInches: number;
    widthInches: number;
    heightInches: number;
    totalCubicFeet?: number;
    maxWeightLbs?: number;
  };
  capacityCheck?: {
    canFit: boolean;
    dimensionCheck: boolean;
    weightCheck: boolean;
    cubicCheck: boolean;
    violationReasons?: string[];
  };
  showRotationHint?: boolean;
}

export const DimensionValidationDisplay: React.FC<DimensionValidationDisplayProps> = ({
  itemDimensions,
  binDimensions,
  capacityCheck,
  showRotationHint = true,
}) => {
  // If no bin dimensions or capacity check, show item dimensions only
  if (!binDimensions || !capacityCheck) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Package className="h-5 w-5 text-gray-600" />
          <h4 className="font-semibold text-gray-900">Item Dimensions</h4>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Length:</span>
            <span className="ml-2 font-semibold">{itemDimensions.lengthInches.toFixed(1)}&quot;</span>
          </div>
          <div>
            <span className="text-gray-600">Width:</span>
            <span className="ml-2 font-semibold">{itemDimensions.widthInches.toFixed(1)}&quot;</span>
          </div>
          <div>
            <span className="text-gray-600">Height:</span>
            <span className="ml-2 font-semibold">{itemDimensions.heightInches.toFixed(1)}&quot;</span>
          </div>
        </div>
        {itemDimensions.cubicFeet && (
          <div className="mt-2 text-sm">
            <span className="text-gray-600">Volume:</span>
            <span className="ml-2 font-semibold">{itemDimensions.cubicFeet.toFixed(2)} ft³</span>
          </div>
        )}
        {itemDimensions.weightLbs && (
          <div className="mt-1 text-sm">
            <span className="text-gray-600">Weight:</span>
            <span className="ml-2 font-semibold">{itemDimensions.weightLbs.toFixed(1)} lbs</span>
          </div>
        )}
      </div>
    );
  }

  // Determine overall status
  const dimensionFits = capacityCheck.dimensionCheck;
  const weightFits = capacityCheck.weightCheck;
  const cubicFits = capacityCheck.cubicCheck;
  const overallFits = capacityCheck.canFit;

  // Color coding
  const dimensionColor = dimensionFits ? 'text-success-600' : 'text-danger-600';
  const dimensionBg = dimensionFits ? 'bg-success-50 border-success-200' : 'bg-danger-50 border-danger-200';

  return (
    <div className={`border rounded-lg p-4 ${dimensionBg}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Package className="h-5 w-5 text-gray-700" />
          <h4 className="font-semibold text-gray-900">3D Dimension Validation</h4>
        </div>
        {overallFits ? (
          <div className="flex items-center space-x-2 text-success-600">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold">Fits</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-danger-600">
            <XCircle className="h-5 w-5" />
            <span className="font-semibold">Does Not Fit</span>
          </div>
        )}
      </div>

      {/* Dimension Comparison */}
      <div className="space-y-3">
        {/* Length */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-gray-600 w-20">Length:</span>
            <span className="font-semibold">{itemDimensions.lengthInches.toFixed(1)}&quot;</span>
            <span className="text-gray-400">≤</span>
            <span className="font-semibold">{binDimensions.lengthInches.toFixed(1)}&quot;</span>
          </div>
          {itemDimensions.lengthInches <= binDimensions.lengthInches ? (
            <CheckCircle className="h-4 w-4 text-success-600" />
          ) : (
            <XCircle className="h-4 w-4 text-danger-600" />
          )}
        </div>

        {/* Width */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-gray-600 w-20">Width:</span>
            <span className="font-semibold">{itemDimensions.widthInches.toFixed(1)}&quot;</span>
            <span className="text-gray-400">≤</span>
            <span className="font-semibold">{binDimensions.widthInches.toFixed(1)}&quot;</span>
          </div>
          {itemDimensions.widthInches <= binDimensions.widthInches ? (
            <CheckCircle className="h-4 w-4 text-success-600" />
          ) : (
            <XCircle className="h-4 w-4 text-danger-600" />
          )}
        </div>

        {/* Height */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-gray-600 w-20">Height:</span>
            <span className="font-semibold">{itemDimensions.heightInches.toFixed(1)}&quot;</span>
            <span className="text-gray-400">≤</span>
            <span className="font-semibold">{binDimensions.heightInches.toFixed(1)}&quot;</span>
          </div>
          {itemDimensions.heightInches <= binDimensions.heightInches ? (
            <CheckCircle className="h-4 w-4 text-success-600" />
          ) : (
            <XCircle className="h-4 w-4 text-danger-600" />
          )}
        </div>
      </div>

      {/* Capacity Checks */}
      <div className="mt-4 pt-4 border-t border-gray-300 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Physical Dimensions:</span>
          <div className="flex items-center space-x-2">
            {dimensionFits ? (
              <>
                <CheckCircle className="h-4 w-4 text-success-600" />
                <span className={dimensionColor}>Pass</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-danger-600" />
                <span className={dimensionColor}>Fail</span>
              </>
            )}
          </div>
        </div>

        {itemDimensions.cubicFeet && binDimensions.totalCubicFeet && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Cubic Volume:</span>
            <div className="flex items-center space-x-2">
              {cubicFits ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success-600" />
                  <span className="text-success-600">Pass</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-danger-600" />
                  <span className="text-danger-600">Fail</span>
                </>
              )}
              <span className="text-gray-500 text-xs">
                ({itemDimensions.cubicFeet.toFixed(1)} / {binDimensions.totalCubicFeet.toFixed(1)} ft³)
              </span>
            </div>
          </div>
        )}

        {itemDimensions.weightLbs && binDimensions.maxWeightLbs && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Weight:</span>
            <div className="flex items-center space-x-2">
              {weightFits ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success-600" />
                  <span className="text-success-600">Pass</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-danger-600" />
                  <span className="text-danger-600">Fail</span>
                </>
              )}
              <span className="text-gray-500 text-xs">
                ({itemDimensions.weightLbs.toFixed(0)} / {binDimensions.maxWeightLbs.toFixed(0)} lbs)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Rotation Hint */}
      {showRotationHint && !dimensionFits && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <AlertTriangle className="h-4 w-4 text-warning-600 mt-0.5 flex-shrink-0" />
            <p>
              <strong>Note:</strong> Item can be rotated during placement. The algorithm checks all orientations to find a fit.
            </p>
          </div>
        </div>
      )}

      {/* Violation Reasons */}
      {capacityCheck.violationReasons && capacityCheck.violationReasons.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <h5 className="text-sm font-semibold text-danger-700 mb-2">Validation Issues:</h5>
          <ul className="list-disc list-inside space-y-1 text-sm text-danger-600">
            {capacityCheck.violationReasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
