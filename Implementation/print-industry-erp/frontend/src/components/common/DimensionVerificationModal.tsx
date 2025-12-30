import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Package, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { VERIFY_MATERIAL_DIMENSIONS } from '../../graphql/queries/wmsDataQuality';

/**
 * Dimension Verification Modal Component
 * REQ-STRATEGIC-AUTO-1766545799451
 * Author: Jen (Frontend Developer)
 *
 * Purpose: UI for warehouse staff to verify material dimensions on first receipt
 */

interface DimensionVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string;
  materialCode: string;
  facilityId: string;
  masterDimensions?: {
    cubicFeet?: number;
    weightLbs?: number;
    widthInches?: number;
    heightInches?: number;
    thicknessInches?: number;
  };
  onVerificationComplete?: () => void;
}

interface VerificationResult {
  verificationId: string;
  success: boolean;
  cubicFeetVariancePct: number;
  weightVariancePct: number;
  varianceThresholdExceeded: boolean;
  autoUpdatedMasterData: boolean;
  verificationStatus: 'VERIFIED' | 'VARIANCE_DETECTED' | 'MASTER_DATA_UPDATED';
  message: string;
}

export const DimensionVerificationModal: React.FC<DimensionVerificationModalProps> = ({
  isOpen,
  onClose,
  materialId,
  materialCode,
  facilityId,
  masterDimensions,
  onVerificationComplete,
}) => {
  const [measuredCubicFeet, setMeasuredCubicFeet] = useState<string>('');
  const [measuredWeightLbs, setMeasuredWeightLbs] = useState<string>('');
  const [measuredWidthInches, setMeasuredWidthInches] = useState<string>('');
  const [measuredHeightInches, setMeasuredHeightInches] = useState<string>('');
  const [measuredThicknessInches, setMeasuredThicknessInches] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const [verifyDimensions, { loading }] = useMutation<{
    verifyMaterialDimensions: VerificationResult;
  }>(VERIFY_MATERIAL_DIMENSIONS, {
    onCompleted: (data) => {
      setVerificationResult(data.verifyMaterialDimensions);
      if (onVerificationComplete) {
        onVerificationComplete();
      }
    },
    onError: (error) => {
      alert(`Verification failed: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cubicFeet = parseFloat(measuredCubicFeet);
    const weightLbs = parseFloat(measuredWeightLbs);

    if (isNaN(cubicFeet) || isNaN(weightLbs)) {
      alert('Please enter valid numeric values for cubic feet and weight');
      return;
    }

    verifyDimensions({
      variables: {
        input: {
          facilityId,
          materialId,
          measuredCubicFeet: cubicFeet,
          measuredWeightLbs: weightLbs,
          measuredWidthInches: measuredWidthInches ? parseFloat(measuredWidthInches) : undefined,
          measuredHeightInches: measuredHeightInches
            ? parseFloat(measuredHeightInches)
            : undefined,
          measuredThicknessInches: measuredThicknessInches
            ? parseFloat(measuredThicknessInches)
            : undefined,
          notes: notes || undefined,
        },
      },
    });
  };

  const handleClose = () => {
    setMeasuredCubicFeet('');
    setMeasuredWeightLbs('');
    setMeasuredWidthInches('');
    setMeasuredHeightInches('');
    setMeasuredThicknessInches('');
    setNotes('');
    setVerificationResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Package className="h-6 w-6 text-primary-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Verify Material Dimensions</h2>
              <p className="text-sm text-gray-600 mt-1">Material: {materialCode}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Verification Result */}
        {verificationResult ? (
          <div className="p-6">
            <div
              className={`rounded-lg p-4 mb-4 ${
                verificationResult.verificationStatus === 'VERIFIED'
                  ? 'bg-success-50 border border-success-200'
                  : verificationResult.verificationStatus === 'MASTER_DATA_UPDATED'
                  ? 'bg-primary-50 border border-primary-200'
                  : 'bg-warning-50 border border-warning-200'
              }`}
            >
              <div className="flex items-start space-x-3">
                {verificationResult.verificationStatus === 'VERIFIED' ? (
                  <CheckCircle className="h-6 w-6 text-success-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle
                    className={`h-6 w-6 flex-shrink-0 mt-0.5 ${
                      verificationResult.verificationStatus === 'MASTER_DATA_UPDATED'
                        ? 'text-primary-600'
                        : 'text-warning-600'
                    }`}
                  />
                )}
                <div className="flex-1">
                  <h3
                    className={`font-semibold mb-2 ${
                      verificationResult.verificationStatus === 'VERIFIED'
                        ? 'text-success-900'
                        : verificationResult.verificationStatus === 'MASTER_DATA_UPDATED'
                        ? 'text-primary-900'
                        : 'text-warning-900'
                    }`}
                  >
                    {verificationResult.verificationStatus === 'VERIFIED'
                      ? 'Dimensions Verified'
                      : verificationResult.verificationStatus === 'MASTER_DATA_UPDATED'
                      ? 'Master Data Updated'
                      : 'Variance Detected - Review Required'}
                  </h3>
                  <p
                    className={`text-sm ${
                      verificationResult.verificationStatus === 'VERIFIED'
                        ? 'text-success-800'
                        : verificationResult.verificationStatus === 'MASTER_DATA_UPDATED'
                        ? 'text-primary-800'
                        : 'text-warning-800'
                    }`}
                  >
                    {verificationResult.message}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-white rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Cubic Feet Variance</p>
                  <p
                    className={`text-lg font-bold ${
                      Math.abs(verificationResult.cubicFeetVariancePct) < 5
                        ? 'text-success-600'
                        : Math.abs(verificationResult.cubicFeetVariancePct) < 10
                        ? 'text-warning-600'
                        : 'text-danger-600'
                    }`}
                  >
                    {verificationResult.cubicFeetVariancePct > 0 ? '+' : ''}
                    {verificationResult.cubicFeetVariancePct.toFixed(2)}%
                  </p>
                </div>
                <div className="bg-white rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Weight Variance</p>
                  <p
                    className={`text-lg font-bold ${
                      Math.abs(verificationResult.weightVariancePct) < 5
                        ? 'text-success-600'
                        : Math.abs(verificationResult.weightVariancePct) < 10
                        ? 'text-warning-600'
                        : 'text-danger-600'
                    }`}
                  >
                    {verificationResult.weightVariancePct > 0 ? '+' : ''}
                    {verificationResult.weightVariancePct.toFixed(2)}%
                  </p>
                </div>
              </div>

              {verificationResult.autoUpdatedMasterData && (
                <div className="mt-3 p-3 bg-primary-100 rounded border border-primary-300">
                  <p className="text-sm text-primary-900">
                    ✓ Master data has been automatically updated with the measured dimensions
                    (variance was within acceptable threshold of 10%)
                  </p>
                </div>
              )}

              {verificationResult.varianceThresholdExceeded && (
                <div className="mt-3 p-3 bg-warning-100 rounded border border-warning-300">
                  <p className="text-sm text-warning-900">
                    ⚠ Variance exceeds 10% threshold. Manual review required. Please contact your
                    supervisor to update master data.
                  </p>
                </div>
              )}
            </div>

            <button onClick={handleClose} className="btn btn-primary w-full">
              Close
            </button>
          </div>
        ) : (
          /* Verification Form */
          <form onSubmit={handleSubmit} className="p-6">
            {/* Master Data Reference */}
            {masterDimensions && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Master Data (for reference)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {masterDimensions.cubicFeet && (
                    <div>
                      <span className="text-gray-600">Cubic Feet:</span>
                      <span className="ml-2 font-medium">
                        {masterDimensions.cubicFeet.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {masterDimensions.weightLbs && (
                    <div>
                      <span className="text-gray-600">Weight (lbs):</span>
                      <span className="ml-2 font-medium">
                        {masterDimensions.weightLbs.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {masterDimensions.widthInches && (
                    <div>
                      <span className="text-gray-600">Width (in):</span>
                      <span className="ml-2 font-medium">
                        {masterDimensions.widthInches.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {masterDimensions.heightInches && (
                    <div>
                      <span className="text-gray-600">Height (in):</span>
                      <span className="ml-2 font-medium">
                        {masterDimensions.heightInches.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {masterDimensions.thicknessInches && (
                    <div>
                      <span className="text-gray-600">Thickness (in):</span>
                      <span className="ml-2 font-medium">
                        {masterDimensions.thicknessInches.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Measured Dimensions */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Measured Dimensions</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cubic Feet <span className="text-danger-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={measuredCubicFeet}
                    onChange={(e) => setMeasuredCubicFeet(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    required
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (lbs) <span className="text-danger-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={measuredWeightLbs}
                    onChange={(e) => setMeasuredWeightLbs(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    required
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Width (in)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={measuredWidthInches}
                    onChange={(e) => setMeasuredWidthInches(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (in)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={measuredHeightInches}
                    onChange={(e) => setMeasuredHeightInches(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thickness (in)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={measuredThicknessInches}
                    onChange={(e) => setMeasuredThicknessInches(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  rows={3}
                  placeholder="Add any additional notes about this verification..."
                />
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 bg-primary-50 border border-primary-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-primary-900">
                  <p className="font-medium mb-1">Variance Threshold: 10%</p>
                  <p className="text-primary-800">
                    If measured dimensions are within 10% of master data, the system will
                    automatically update the master data. Variances greater than 10% require manual
                    supervisor review.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex space-x-3">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary flex-1"
              >
                {loading ? 'Verifying...' : 'Verify Dimensions'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
