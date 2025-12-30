import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import {
  QualityGateConfig,
  QualityGateValidation,
  QualityMetrics,
  ValidationStatus,
  AgentQualityScore,
} from '../interfaces/quality-metrics.interface';

/**
 * Quality Gate Service
 * Implements quality gate validation and enforcement
 * REQ-STRATEGIC-AUTO-1767108044307
 */
@Injectable()
export class QualityGateService {
  private readonly logger = new Logger(QualityGateService.name);

  constructor(private readonly pool: Pool) {}

  /**
   * Get active quality gate configuration
   */
  async getActiveConfig(): Promise<QualityGateConfig | null> {
    const query = `
      SELECT
        id, name, description, enabled,
        min_line_coverage as "minLineCoverage",
        min_branch_coverage as "minBranchCoverage",
        min_function_coverage as "minFunctionCoverage",
        min_new_code_coverage as "minNewCodeCoverage",
        max_cyclomatic_complexity as "maxCyclomaticComplexity",
        max_cognitive_complexity as "maxCognitiveComplexity",
        max_lines_per_function as "maxLinesPerFunction",
        max_file_length as "maxFileLength",
        max_critical_vulnerabilities as "maxCriticalVulnerabilities",
        max_high_vulnerabilities as "maxHighVulnerabilities",
        max_bundle_size_kb as "maxBundleSizeKb",
        max_api_response_p95_ms as "maxApiResponseP95Ms",
        max_slow_query_ms as "maxSlowQueryMs",
        max_ci_pipeline_minutes as "maxCiPipelineMinutes",
        max_code_smells as "maxCodeSmells",
        max_technical_debt_ratio as "maxTechnicalDebtRatio",
        max_duplicated_code_pct as "maxDuplicatedCodePct"
      FROM quality_gate_configs
      WHERE enabled = TRUE
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query);
    return result.rows[0] || null;
  }

  /**
   * Validate quality metrics against quality gates
   */
  async validateQualityMetrics(
    metrics: QualityMetrics,
    config?: QualityGateConfig,
  ): Promise<{ passed: boolean; violations: string[] }> {
    const activeConfig = config || (await this.getActiveConfig());
    if (!activeConfig) {
      this.logger.warn('No active quality gate configuration found');
      return { passed: true, violations: [] };
    }

    const violations: string[] = [];

    // Coverage checks
    if (metrics.coverage.line < activeConfig.minLineCoverage) {
      violations.push(
        `Line coverage ${metrics.coverage.line}% is below threshold ${activeConfig.minLineCoverage}%`,
      );
    }

    if (metrics.coverage.branch < activeConfig.minBranchCoverage) {
      violations.push(
        `Branch coverage ${metrics.coverage.branch}% is below threshold ${activeConfig.minBranchCoverage}%`,
      );
    }

    if (metrics.coverage.function < activeConfig.minFunctionCoverage) {
      violations.push(
        `Function coverage ${metrics.coverage.function}% is below threshold ${activeConfig.minFunctionCoverage}%`,
      );
    }

    // Complexity checks
    if (metrics.complexity.max > activeConfig.maxCyclomaticComplexity) {
      violations.push(
        `Maximum complexity ${metrics.complexity.max} exceeds threshold ${activeConfig.maxCyclomaticComplexity}`,
      );
    }

    // Linting checks
    if (metrics.linting.errors > 0) {
      violations.push(
        `Found ${metrics.linting.errors} linting errors (must be 0)`,
      );
    }

    // Security checks
    if (
      metrics.security.critical > activeConfig.maxCriticalVulnerabilities
    ) {
      violations.push(
        `Found ${metrics.security.critical} critical vulnerabilities (max: ${activeConfig.maxCriticalVulnerabilities})`,
      );
    }

    if (metrics.security.high > activeConfig.maxHighVulnerabilities) {
      violations.push(
        `Found ${metrics.security.high} high vulnerabilities (max: ${activeConfig.maxHighVulnerabilities})`,
      );
    }

    // Performance checks (if available)
    if (
      metrics.performance.bundleSize &&
      metrics.performance.bundleSize > activeConfig.maxBundleSizeKb
    ) {
      violations.push(
        `Bundle size ${metrics.performance.bundleSize}KB exceeds threshold ${activeConfig.maxBundleSizeKb}KB`,
      );
    }

    const passed = violations.length === 0;

    this.logger.log(
      `Quality gate validation for ${metrics.reqNumber}: ${passed ? 'PASSED' : 'FAILED'} (${violations.length} violations)`,
    );

    return { passed, violations };
  }

  /**
   * Store quality metrics in database
   */
  async storeQualityMetrics(metrics: QualityMetrics): Promise<string> {
    const query = `
      INSERT INTO quality_metrics (
        req_number, commit_sha, branch, author, created_at,
        line_coverage, branch_coverage, function_coverage, statement_coverage,
        max_complexity, avg_complexity, complexity_violations,
        lint_errors, lint_warnings, lint_issues,
        critical_vulnerabilities, high_vulnerabilities, medium_vulnerabilities, low_vulnerabilities, vulnerabilities,
        build_time_ms, bundle_size_kb, avg_test_duration_ms,
        quality_gate_passed, blocked_reasons
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23,
        $24, $25
      )
      ON CONFLICT (req_number, commit_sha) DO UPDATE SET
        line_coverage = EXCLUDED.line_coverage,
        branch_coverage = EXCLUDED.branch_coverage,
        function_coverage = EXCLUDED.function_coverage,
        statement_coverage = EXCLUDED.statement_coverage,
        max_complexity = EXCLUDED.max_complexity,
        avg_complexity = EXCLUDED.avg_complexity,
        complexity_violations = EXCLUDED.complexity_violations,
        lint_errors = EXCLUDED.lint_errors,
        lint_warnings = EXCLUDED.lint_warnings,
        lint_issues = EXCLUDED.lint_issues,
        critical_vulnerabilities = EXCLUDED.critical_vulnerabilities,
        high_vulnerabilities = EXCLUDED.high_vulnerabilities,
        medium_vulnerabilities = EXCLUDED.medium_vulnerabilities,
        low_vulnerabilities = EXCLUDED.low_vulnerabilities,
        vulnerabilities = EXCLUDED.vulnerabilities,
        build_time_ms = EXCLUDED.build_time_ms,
        bundle_size_kb = EXCLUDED.bundle_size_kb,
        avg_test_duration_ms = EXCLUDED.avg_test_duration_ms,
        quality_gate_passed = EXCLUDED.quality_gate_passed,
        blocked_reasons = EXCLUDED.blocked_reasons
      RETURNING id
    `;

    const result = await this.pool.query(query, [
      metrics.reqNumber,
      metrics.commitSha,
      metrics.branch,
      metrics.author,
      metrics.timestamp,
      metrics.coverage.line,
      metrics.coverage.branch,
      metrics.coverage.function,
      metrics.coverage.statement,
      metrics.complexity.max,
      metrics.complexity.avg,
      JSON.stringify(metrics.complexity.violations),
      metrics.linting.errors,
      metrics.linting.warnings,
      JSON.stringify(metrics.linting.issues),
      metrics.security.critical,
      metrics.security.high,
      metrics.security.medium,
      metrics.security.low,
      JSON.stringify(metrics.security.vulnerabilities),
      metrics.performance.buildTime,
      metrics.performance.bundleSize,
      metrics.performance.avgTestDuration,
      metrics.qualityGatePassed,
      metrics.blockedReasons,
    ]);

    return result.rows[0].id;
  }

  /**
   * Create quality gate validation record
   */
  async createValidation(
    validation: Partial<QualityGateValidation>,
  ): Promise<string> {
    const query = `
      INSERT INTO quality_gate_validations (
        req_number, agent_name, deliverable_url, status,
        linting_passed, linting_errors,
        type_checking_passed, type_checking_errors,
        unit_tests_passed, unit_test_failures,
        complexity_check_passed, complexity_violations,
        coverage_check_passed, coverage_failures,
        security_check_passed, security_violations,
        overall_passed, failure_reasons, recommendations,
        files_created, files_modified, files_deleted
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8,
        $9, $10,
        $11, $12,
        $13, $14,
        $15, $16,
        $17, $18, $19,
        $20, $21, $22
      )
      RETURNING id
    `;

    const result = await this.pool.query(query, [
      validation.reqNumber,
      validation.agentName,
      validation.deliverableUrl,
      validation.status || ValidationStatus.PENDING,
      validation.lintingPassed,
      validation.lintingErrors,
      validation.typeCheckingPassed,
      validation.typeCheckingErrors,
      validation.unitTestsPassed,
      validation.unitTestFailures,
      validation.complexityCheckPassed,
      validation.complexityViolations,
      validation.coverageCheckPassed,
      validation.coverageFailures,
      validation.securityCheckPassed,
      validation.securityViolations,
      validation.overallPassed || false,
      validation.failureReasons,
      validation.recommendations,
      validation.filesCreated,
      validation.filesModified,
      validation.filesDeleted,
    ]);

    return result.rows[0].id;
  }

  /**
   * Update validation record with results
   */
  async updateValidation(
    validationId: string,
    updates: Partial<QualityGateValidation>,
  ): Promise<void> {
    const query = `
      UPDATE quality_gate_validations
      SET
        status = COALESCE($2, status),
        validation_started_at = COALESCE($3, validation_started_at),
        validation_completed_at = COALESCE($4, validation_completed_at),
        validation_duration_ms = COALESCE($5, validation_duration_ms),
        linting_passed = COALESCE($6, linting_passed),
        linting_errors = COALESCE($7, linting_errors),
        type_checking_passed = COALESCE($8, type_checking_passed),
        type_checking_errors = COALESCE($9, type_checking_errors),
        unit_tests_passed = COALESCE($10, unit_tests_passed),
        unit_test_failures = COALESCE($11, unit_test_failures),
        complexity_check_passed = COALESCE($12, complexity_check_passed),
        complexity_violations = COALESCE($13, complexity_violations),
        coverage_check_passed = COALESCE($14, coverage_check_passed),
        coverage_failures = COALESCE($15, coverage_failures),
        security_check_passed = COALESCE($16, security_check_passed),
        security_violations = COALESCE($17, security_violations),
        overall_passed = COALESCE($18, overall_passed),
        failure_reasons = COALESCE($19, failure_reasons),
        recommendations = COALESCE($20, recommendations)
      WHERE id = $1
    `;

    await this.pool.query(query, [
      validationId,
      updates.status,
      updates.validationStartedAt,
      updates.validationCompletedAt,
      updates.validationDurationMs,
      updates.lintingPassed,
      updates.lintingErrors,
      updates.typeCheckingPassed,
      updates.typeCheckingErrors,
      updates.unitTestsPassed,
      updates.unitTestFailures,
      updates.complexityCheckPassed,
      updates.complexityViolations,
      updates.coverageCheckPassed,
      updates.coverageFailures,
      updates.securityCheckPassed,
      updates.securityViolations,
      updates.overallPassed,
      updates.failureReasons,
      updates.recommendations,
    ]);
  }

  /**
   * Get quality metrics for a requirement
   */
  async getQualityMetrics(reqNumber: string): Promise<QualityMetrics[]> {
    const query = `
      SELECT
        req_number as "reqNumber",
        commit_sha as "commitSha",
        branch,
        author,
        created_at as timestamp,
        line_coverage,
        branch_coverage,
        function_coverage,
        statement_coverage,
        max_complexity,
        avg_complexity,
        complexity_violations,
        lint_errors,
        lint_warnings,
        lint_issues,
        critical_vulnerabilities,
        high_vulnerabilities,
        medium_vulnerabilities,
        low_vulnerabilities,
        vulnerabilities,
        build_time_ms,
        bundle_size_kb,
        avg_test_duration_ms,
        quality_gate_passed as "qualityGatePassed",
        blocked_reasons as "blockedReasons"
      FROM quality_metrics
      WHERE req_number = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [reqNumber]);

    return result.rows.map((row) => ({
      reqNumber: row.reqNumber,
      commitSha: row.commitSha,
      branch: row.branch,
      author: row.author,
      timestamp: row.timestamp,
      coverage: {
        line: row.line_coverage,
        branch: row.branch_coverage,
        function: row.function_coverage,
        statement: row.statement_coverage,
      },
      complexity: {
        max: row.max_complexity,
        avg: row.avg_complexity,
        violations: row.complexity_violations || [],
      },
      linting: {
        errors: row.lint_errors,
        warnings: row.lint_warnings,
        issues: row.lint_issues || [],
      },
      security: {
        critical: row.critical_vulnerabilities,
        high: row.high_vulnerabilities,
        medium: row.medium_vulnerabilities,
        low: row.low_vulnerabilities,
        vulnerabilities: row.vulnerabilities || [],
      },
      performance: {
        buildTime: row.build_time_ms,
        bundleSize: row.bundle_size_kb,
        avgTestDuration: row.avg_test_duration_ms,
      },
      qualityGatePassed: row.qualityGatePassed,
      blockedReasons: row.blockedReasons || [],
    }));
  }

  /**
   * Get agent quality scores
   */
  async getAgentQualityScores(
    agentName?: string,
    timePeriod: 'weekly' | 'monthly' | 'quarterly' = 'monthly',
  ): Promise<AgentQualityScore[]> {
    const query = `
      SELECT
        agent_name as "agentName",
        time_period as "timePeriod",
        period_start as "periodStart",
        period_end as "periodEnd",
        total_deliverables as "totalDeliverables",
        passed_quality_gates as "passedQualityGates",
        failed_quality_gates as "failedQualityGates",
        bypassed_quality_gates as "bypassedQualityGates",
        quality_gate_pass_rate as "qualityGatePassRate",
        avg_quality_score as "avgQualityScore",
        avg_line_coverage as "avgLineCoverage",
        avg_branch_coverage as "avgBranchCoverage",
        avg_complexity as "avgComplexity",
        complexity_violation_count as "complexityViolationCount",
        total_vulnerabilities_found as "totalVulnerabilitiesFound",
        critical_vulnerabilities_found as "criticalVulnerabilitiesFound",
        avg_validation_time_ms as "avgValidationTimeMs"
      FROM agent_quality_scores
      WHERE ($1::text IS NULL OR agent_name = $1)
        AND time_period = $2
      ORDER BY period_start DESC
      LIMIT 12
    `;

    const result = await this.pool.query(query, [agentName, timePeriod]);
    return result.rows;
  }

  /**
   * Calculate and store agent quality scores for a period
   */
  async calculateAgentQualityScores(
    periodStart: Date,
    periodEnd: Date,
    timePeriod: 'weekly' | 'monthly' | 'quarterly',
  ): Promise<void> {
    // Get all agents who had validations in this period
    const agentsQuery = `
      SELECT DISTINCT agent_name
      FROM quality_gate_validations
      WHERE validation_completed_at BETWEEN $1 AND $2
    `;

    const agentsResult = await this.pool.query(agentsQuery, [
      periodStart,
      periodEnd,
    ]);

    for (const { agent_name } of agentsResult.rows) {
      await this.calculateAgentScore(
        agent_name,
        periodStart,
        periodEnd,
        timePeriod,
      );
    }
  }

  private async calculateAgentScore(
    agentName: string,
    periodStart: Date,
    periodEnd: Date,
    timePeriod: 'weekly' | 'monthly' | 'quarterly',
  ): Promise<void> {
    const query = `
      INSERT INTO agent_quality_scores (
        agent_name, time_period, period_start, period_end,
        total_deliverables, passed_quality_gates, failed_quality_gates, bypassed_quality_gates,
        quality_gate_pass_rate, avg_quality_score,
        avg_line_coverage, avg_branch_coverage,
        avg_complexity, complexity_violation_count,
        total_vulnerabilities_found, critical_vulnerabilities_found,
        avg_validation_time_ms
      )
      SELECT
        $1 as agent_name,
        $2 as time_period,
        $3 as period_start,
        $4 as period_end,
        COUNT(*) as total_deliverables,
        SUM(CASE WHEN overall_passed THEN 1 ELSE 0 END) as passed_quality_gates,
        SUM(CASE WHEN NOT overall_passed THEN 1 ELSE 0 END) as failed_quality_gates,
        0 as bypassed_quality_gates, -- TODO: Calculate from bypasses table
        ROUND(100.0 * SUM(CASE WHEN overall_passed THEN 1 ELSE 0 END) / COUNT(*), 2) as quality_gate_pass_rate,
        NULL as avg_quality_score, -- TODO: Calculate from metrics
        NULL as avg_line_coverage,
        NULL as avg_branch_coverage,
        NULL as avg_complexity,
        0 as complexity_violation_count,
        0 as total_vulnerabilities_found,
        0 as critical_vulnerabilities_found,
        AVG(validation_duration_ms) as avg_validation_time_ms
      FROM quality_gate_validations
      WHERE agent_name = $1
        AND validation_completed_at BETWEEN $3 AND $4
      ON CONFLICT (agent_name, time_period, period_start) DO UPDATE SET
        total_deliverables = EXCLUDED.total_deliverables,
        passed_quality_gates = EXCLUDED.passed_quality_gates,
        failed_quality_gates = EXCLUDED.failed_quality_gates,
        quality_gate_pass_rate = EXCLUDED.quality_gate_pass_rate,
        avg_validation_time_ms = EXCLUDED.avg_validation_time_ms
    `;

    await this.pool.query(query, [agentName, timePeriod, periodStart, periodEnd]);
  }
}
