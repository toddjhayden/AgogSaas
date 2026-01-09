import { useCallback } from 'react';
import type {
  RollbackEligibleDeployment,
  HealthCheckStatus,
} from '../types/rollback';

/**
 * Custom hook for calculating deployment health scores
 *
 * Provides consistent health score calculation logic across all components.
 * Extracted from RollbackDecisionPage component for reusability and testability.
 *
 * REQ-DEVOPS-ROLLBACK-1767150339448 - P2 Improvement
 *
 * Health Score Algorithm:
 * - Base score: 100
 * - Error rate penalty: -10 points per 1% error rate
 * - Success rate cap: Score cannot exceed success rate percentage
 * - Failed health check penalty: -30 points
 * - Final score: Clamped between 0 and 100
 *
 * @example
 * const { calculateHealthScore, getHealthScoreColor, getHealthScoreLabel } = useHealthScore();
 *
 * const score = calculateHealthScore(deployment);
 * const color = getHealthScoreColor(score);
 * const label = getHealthScoreLabel(score);
 */
export const useHealthScore = () => {
  /**
   * Calculate health score for a deployment
   *
   * @param deployment - Rollback-eligible deployment data
   * @returns Health score between 0 and 100
   */
  const calculateHealthScore = useCallback(
    (deployment: RollbackEligibleDeployment): number => {
      let score = 100;

      // Penalize for error rate (10 points per 1% error rate)
      if (deployment.currentErrorRatePercent !== null) {
        score -= deployment.currentErrorRatePercent * 10;
      }

      // Cap score at success rate if available
      if (deployment.currentSuccessRatePercent !== null) {
        score = Math.min(score, deployment.currentSuccessRatePercent);
      }

      // Large penalty for failed post-deployment health check
      if (deployment.postDeploymentHealthCheck === 'FAILED') {
        score -= 30;
      }

      // Clamp score between 0 and 100
      return Math.max(0, Math.min(100, score));
    },
    []
  );

  /**
   * Get color for health score visualization
   *
   * @param score - Health score (0-100)
   * @returns Material-UI color name
   */
  const getHealthScoreColor = useCallback(
    (score: number): 'success' | 'warning' | 'error' => {
      if (score >= 90) return 'success';
      if (score >= 70) return 'warning';
      return 'error';
    },
    []
  );

  /**
   * Get text label for health score
   *
   * @param score - Health score (0-100)
   * @returns Human-readable label
   */
  const getHealthScoreLabel = useCallback((score: number): string => {
    if (score >= 90) return 'Healthy';
    if (score >= 70) return 'Warning';
    if (score >= 50) return 'Degraded';
    return 'Critical';
  }, []);

  /**
   * Get color for health check status
   *
   * @param status - Health check status
   * @returns Material-UI color name
   */
  const getHealthCheckColor = useCallback(
    (
      status: HealthCheckStatus
    ): 'success' | 'error' | 'warning' | 'default' => {
      switch (status) {
        case 'PASSED':
          return 'success';
        case 'FAILED':
          return 'error';
        case 'PENDING':
          return 'warning';
        default:
          return 'default';
      }
    },
    []
  );

  /**
   * Determine if deployment should be flagged for rollback
   *
   * @param deployment - Rollback-eligible deployment data
   * @returns True if health score is below warning threshold
   */
  const shouldFlagForRollback = useCallback(
    (deployment: RollbackEligibleDeployment): boolean => {
      const score = calculateHealthScore(deployment);
      return score < 70; // Below warning threshold
    },
    [calculateHealthScore]
  );

  return {
    calculateHealthScore,
    getHealthScoreColor,
    getHealthScoreLabel,
    getHealthCheckColor,
    shouldFlagForRollback,
  };
};
