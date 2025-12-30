import { gql } from '@apollo/client';

/**
 * GraphQL queries for Bin Utilization Health Monitoring
 * REQ-STRATEGIC-AUTO-1766516759426
 * Phase 3A: Critical Fixes & Foundation - Health Monitoring System
 */

/**
 * Query to get comprehensive health status of bin optimization system
 */
export const GET_BIN_OPTIMIZATION_HEALTH = gql`
  query GetBinOptimizationHealth {
    getBinOptimizationHealth {
      status
      timestamp
      checks {
        materializedViewFreshness {
          status
          message
          lastRefresh
        }
        mlModelAccuracy {
          status
          message
          accuracy
          sampleSize
        }
        congestionCacheHealth {
          status
          message
          aisleCount
        }
        databasePerformance {
          status
          message
          queryTimeMs
        }
        algorithmPerformance {
          status
          message
          processingTimeMs
          note
        }
        fragmentationMonitoring {
          status
          message
          fragmentationIndex
          fragmentationLevel
          requiresConsolidation
        }
      }
    }
  }
`;
