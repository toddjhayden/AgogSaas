/**
 * Runtime Dependency Health GraphQL Queries
 * REQ: REQ-AUDIT-1767982074
 * Author: Jen (Frontend Developer)
 * Date: 2026-01-09
 *
 * GraphQL queries for runtime dependency health monitoring
 */

import { gql } from '@apollo/client';

// =====================================================
// RUNTIME DEPENDENCY HEALTH QUERIES
// =====================================================

export const GET_RUNTIME_DEPENDENCY_HEALTH = gql`
  query GetRuntimeDependencyHealth {
    runtimeDependencyHealth {
      timestamp
      status
      healthyCount
      unhealthyCount
      criticalFailures
      exitRequired
      dependencies {
        name
        status
        latencyMs
        error
        critical
        details
      }
    }
  }
`;
