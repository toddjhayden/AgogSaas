/**
 * Quality Gate Validator Utility
 * Provides validation functions for agent deliverables
 * REQ-STRATEGIC-AUTO-1767108044307
 *
 * This utility can be used by autonomous agents to validate their code
 * before publishing deliverables to NATS.
 */

import { Pool } from 'pg';
import {
  QualityGateValidation,
  ValidationStatus,
  QualityMetrics,
} from '../interfaces/quality-metrics.interface';

export interface AgentChanges {
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
}

export interface ValidationResult {
  passed: boolean;
  validationId: string;
  status: ValidationStatus;
  checks: {
    linting: { passed: boolean; errors: string[] };
    typeChecking: { passed: boolean; errors: string[] };
    unitTests: { passed: boolean; failures: string[] };
    complexity: { passed: boolean; violations: string[] };
    coverage: { passed: boolean; failures: string[] };
    security: { passed: boolean; violations: string[] };
  };
  recommendations: string[];
  validationDurationMs: number;
}

/**
 * Validates an agent deliverable against quality gates
 * This is an async job that runs in the background (not inline)
 *
 * @param pool - PostgreSQL connection pool
 * @param reqNumber - Requirement number
 * @param agentName - Name of the agent
 * @param changes - Files changed by the agent
 * @param deliverableUrl - NATS URL of the deliverable
 * @param timeoutMs - Validation timeout (default: 5 minutes)
 * @returns Validation result
 */
export async function validateAgentDeliverable(
  pool: Pool,
  reqNumber: string,
  agentName: string,
  changes: AgentChanges,
  deliverableUrl?: string,
  timeoutMs: number = 5 * 60 * 1000, // 5 minutes
): Promise<ValidationResult> {
  const startTime = Date.now();

  // Create validation record
  const createQuery = `
    INSERT INTO quality_gate_validations (
      req_number, agent_name, deliverable_url,
      status, validation_started_at,
      files_created, files_modified, files_deleted
    )
    VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
    RETURNING id
  `;

  const createResult = await pool.query(createQuery, [
    reqNumber,
    agentName,
    deliverableUrl,
    ValidationStatus.PENDING,
    changes.filesCreated,
    changes.filesModified,
    changes.filesDeleted,
  ]);

  const validationId = createResult.rows[0].id;

  try {
    // Run validation checks (with timeout)
    const validationPromise = runValidationChecks(
      pool,
      reqNumber,
      agentName,
      changes,
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Validation timeout')), timeoutMs);
    });

    const checks = await Promise.race([validationPromise, timeoutPromise]);

    // Determine overall status
    let status: ValidationStatus = ValidationStatus.PASSED;
    let overallPassed = true;

    if (!checks.linting.passed) {
      status = ValidationStatus.FAILED_LINTING;
      overallPassed = false;
    } else if (!checks.unitTests.passed) {
      status = ValidationStatus.FAILED_TESTS;
      overallPassed = false;
    } else if (!checks.complexity.passed) {
      status = ValidationStatus.FAILED_COMPLEXITY;
      overallPassed = false;
    } else if (!checks.coverage.passed) {
      status = ValidationStatus.FAILED_COVERAGE;
      overallPassed = false;
    } else if (!checks.security.passed) {
      status = ValidationStatus.FAILED_SECURITY;
      overallPassed = false;
    }

    // Generate recommendations
    const recommendations = generateRecommendations(checks);

    // Calculate duration
    const validationDurationMs = Date.now() - startTime;

    // Update validation record
    const updateQuery = `
      UPDATE quality_gate_validations
      SET
        status = $2,
        validation_completed_at = NOW(),
        validation_duration_ms = $3,
        linting_passed = $4,
        linting_errors = $5,
        type_checking_passed = $6,
        type_checking_errors = $7,
        unit_tests_passed = $8,
        unit_test_failures = $9,
        complexity_check_passed = $10,
        complexity_violations = $11,
        coverage_check_passed = $12,
        coverage_failures = $13,
        security_check_passed = $14,
        security_violations = $15,
        overall_passed = $16,
        recommendations = $17
      WHERE id = $1
    `;

    await pool.query(updateQuery, [
      validationId,
      status,
      validationDurationMs,
      checks.linting.passed,
      checks.linting.errors,
      checks.typeChecking.passed,
      checks.typeChecking.errors,
      checks.unitTests.passed,
      checks.unitTests.failures,
      checks.complexity.passed,
      checks.complexity.violations,
      checks.coverage.passed,
      checks.coverage.failures,
      checks.security.passed,
      checks.security.violations,
      overallPassed,
      recommendations,
    ]);

    return {
      passed: overallPassed,
      validationId,
      status,
      checks,
      recommendations,
      validationDurationMs,
    };
  } catch (error) {
    // Handle timeout or error
    const status =
      error.message === 'Validation timeout'
        ? ValidationStatus.TIMEOUT
        : ValidationStatus.ERROR;

    const validationDurationMs = Date.now() - startTime;

    const updateQuery = `
      UPDATE quality_gate_validations
      SET
        status = $2,
        validation_completed_at = NOW(),
        validation_duration_ms = $3,
        overall_passed = FALSE,
        failure_reasons = $4
      WHERE id = $1
    `;

    await pool.query(updateQuery, [
      validationId,
      status,
      validationDurationMs,
      [error.message],
    ]);

    throw error;
  }
}

/**
 * Run individual validation checks
 */
async function runValidationChecks(
  pool: Pool,
  reqNumber: string,
  agentName: string,
  changes: AgentChanges,
): Promise<ValidationResult['checks']> {
  // In a real implementation, this would:
  // 1. Run ESLint on modified files
  // 2. Run TypeScript type checking
  // 3. Run unit tests for changed modules
  // 4. Check cyclomatic complexity
  // 5. Check code coverage
  // 6. Run security scans

  // For now, return a placeholder implementation
  // This would be integrated with actual linting/testing tools

  const checks = {
    linting: {
      passed: true,
      errors: [],
    },
    typeChecking: {
      passed: true,
      errors: [],
    },
    unitTests: {
      passed: true,
      failures: [],
    },
    complexity: {
      passed: true,
      violations: [],
    },
    coverage: {
      passed: true,
      failures: [],
    },
    security: {
      passed: true,
      violations: [],
    },
  };

  // TODO: Implement actual validation logic
  // This would call external tools like:
  // - ESLint CLI
  // - TypeScript compiler
  // - Jest/Vitest test runner
  // - ESLint complexity plugin
  // - Jest coverage reporter
  // - Trivy security scanner

  return checks;
}

/**
 * Generate recommendations based on validation results
 */
function generateRecommendations(
  checks: ValidationResult['checks'],
): string[] {
  const recommendations: string[] = [];

  if (!checks.linting.passed) {
    recommendations.push(
      'Fix linting errors by running: npm run lint -- --fix',
    );
  }

  if (!checks.typeChecking.passed) {
    recommendations.push(
      'Fix type errors by enabling strict mode incrementally',
    );
  }

  if (!checks.unitTests.passed) {
    recommendations.push('Add unit tests for new/modified functions');
  }

  if (!checks.complexity.passed) {
    recommendations.push(
      'Reduce complexity by breaking down complex functions into smaller ones',
    );
  }

  if (!checks.coverage.passed) {
    recommendations.push(
      'Increase code coverage to meet the 70% minimum threshold',
    );
  }

  if (!checks.security.passed) {
    recommendations.push(
      'Fix security vulnerabilities by updating dependencies: npm audit fix',
    );
  }

  return recommendations;
}

/**
 * Check if agent can bypass quality gates (emergency use only)
 */
export async function canBypassQualityGate(
  pool: Pool,
  reqNumber: string,
  bypassReason: string,
): Promise<boolean> {
  // Check bypass rate - must be <5% of deployments
  const bypassRateQuery = `
    SELECT
      COUNT(*) FILTER (WHERE bypassed_at >= NOW() - INTERVAL '30 days') as recent_bypasses,
      (SELECT COUNT(*) FROM quality_gate_validations WHERE validation_completed_at >= NOW() - INTERVAL '30 days') as recent_validations
    FROM quality_gate_bypasses
  `;

  const result = await pool.query(bypassRateQuery);
  const { recent_bypasses, recent_validations } = result.rows[0];

  const bypassRate = (recent_bypasses / recent_validations) * 100;

  // Only allow bypass if rate is <5% and reason is valid
  const emergencyKeywords = [
    'production down',
    'critical security',
    'hotfix',
    'emergency',
  ];
  const isEmergency = emergencyKeywords.some((keyword) =>
    bypassReason.toLowerCase().includes(keyword),
  );

  return bypassRate < 5 && isEmergency;
}

/**
 * Request quality gate bypass (requires 2 approvals)
 */
export async function requestQualityGateBypass(
  pool: Pool,
  reqNumber: string,
  validationId: string,
  bypassReason: string,
  bypassedBy: string,
  bypassedViolations: string[],
): Promise<string> {
  const query = `
    INSERT INTO quality_gate_bypasses (
      req_number, validation_id, bypass_reason,
      bypassed_by, approved_by, bypassed_violations
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;

  const result = await pool.query(query, [
    reqNumber,
    validationId,
    bypassReason,
    bypassedBy,
    [], // No approvals yet
    bypassedViolations,
  ]);

  return result.rows[0].id;
}
