import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { QualityGateService } from '../../modules/code-quality/services/quality-gate.service';
import { Pool } from 'pg';
import {
  QualityMetrics,
  QualityGateConfig,
  QualityGateValidation,
  AgentQualityScore,
  ValidationStatus,
} from '../../modules/code-quality/interfaces/quality-metrics.interface';

/**
 * Code Quality GraphQL Resolver
 * REQ-STRATEGIC-AUTO-1767108044307
 */
@Resolver()
export class CodeQualityResolver {
  constructor(
    private readonly qualityGateService: QualityGateService,
    private readonly pool: Pool,
  ) {}

  // =====================================================
  // Quality Metrics Queries
  // =====================================================

  @Query()
  async qualityMetrics(
    @Args('reqNumber') reqNumber: string,
  ): Promise<QualityMetrics[]> {
    return this.qualityGateService.getQualityMetrics(reqNumber);
  }

  @Query()
  async latestQualityMetrics(
    @Args('reqNumber') reqNumber: string,
  ): Promise<QualityMetrics | null> {
    const metrics = await this.qualityGateService.getQualityMetrics(reqNumber);
    return metrics.length > 0 ? metrics[0] : null;
  }

  @Query()
  async qualityMetricsTrends(
    @Args('limit', { defaultValue: 100 }) limit: number,
  ): Promise<any[]> {
    const query = `
      SELECT
        req_number as "reqNumber",
        commit_sha as "commitSha",
        created_at as "createdAt",
        line_coverage as "lineCoverage",
        max_complexity as "maxComplexity",
        (lint_errors + lint_warnings) as "totalLintIssues",
        (critical_vulnerabilities + high_vulnerabilities) as "criticalSecurityIssues",
        quality_gate_passed as "qualityGatePassed",
        CASE
          WHEN quality_gate_passed THEN 'PASSED'
          WHEN ARRAY_LENGTH(blocked_reasons, 1) > 0 THEN 'FAILED: ' || ARRAY_TO_STRING(blocked_reasons, ', ')
          ELSE 'PENDING'
        END as "statusSummary"
      FROM quality_metrics
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  // =====================================================
  // Quality Gate Configuration
  // =====================================================

  @Query()
  async activeQualityGateConfig(): Promise<QualityGateConfig | null> {
    return this.qualityGateService.getActiveConfig();
  }

  @Query()
  async qualityGateStatus(
    @Args('reqNumber') reqNumber: string,
  ): Promise<{ passed: boolean; gates: any[] }> {
    const metrics = await this.latestQualityMetrics(reqNumber);
    if (!metrics) {
      return { passed: false, gates: [] };
    }

    const config = await this.qualityGateService.getActiveConfig();
    if (!config) {
      return { passed: true, gates: [] };
    }

    const validation = await this.qualityGateService.validateQualityMetrics(
      metrics,
      config,
    );

    const gates = [
      {
        name: 'Line Coverage',
        passed: metrics.coverage.line >= config.minLineCoverage,
        threshold: config.minLineCoverage,
        actualValue: metrics.coverage.line,
        severity:
          metrics.coverage.line < config.minLineCoverage ? 'HIGH' : 'LOW',
      },
      {
        name: 'Branch Coverage',
        passed: metrics.coverage.branch >= config.minBranchCoverage,
        threshold: config.minBranchCoverage,
        actualValue: metrics.coverage.branch,
        severity:
          metrics.coverage.branch < config.minBranchCoverage
            ? 'MEDIUM'
            : 'LOW',
      },
      {
        name: 'Cyclomatic Complexity',
        passed: metrics.complexity.max <= config.maxCyclomaticComplexity,
        threshold: config.maxCyclomaticComplexity,
        actualValue: metrics.complexity.max,
        severity:
          metrics.complexity.max > config.maxCyclomaticComplexity
            ? 'HIGH'
            : 'LOW',
      },
      {
        name: 'Linting Errors',
        passed: metrics.linting.errors === 0,
        threshold: 0,
        actualValue: metrics.linting.errors,
        severity: metrics.linting.errors > 0 ? 'CRITICAL' : 'LOW',
      },
      {
        name: 'Critical Vulnerabilities',
        passed:
          metrics.security.critical <= config.maxCriticalVulnerabilities,
        threshold: config.maxCriticalVulnerabilities,
        actualValue: metrics.security.critical,
        severity:
          metrics.security.critical > config.maxCriticalVulnerabilities
            ? 'CRITICAL'
            : 'LOW',
      },
    ];

    return {
      passed: validation.passed,
      gates,
    };
  }

  // =====================================================
  // Quality Gate Validations
  // =====================================================

  @Query()
  async qualityGateValidation(
    @Args('id') id: string,
  ): Promise<QualityGateValidation | null> {
    const query = `
      SELECT
        id, req_number as "reqNumber", agent_name as "agentName",
        deliverable_url as "deliverableUrl", status,
        validation_started_at as "validationStartedAt",
        validation_completed_at as "validationCompletedAt",
        validation_duration_ms as "validationDurationMs",
        linting_passed as "lintingPassed",
        linting_errors as "lintingErrors",
        type_checking_passed as "typeCheckingPassed",
        type_checking_errors as "typeCheckingErrors",
        unit_tests_passed as "unitTestsPassed",
        unit_test_failures as "unitTestFailures",
        complexity_check_passed as "complexityCheckPassed",
        complexity_violations as "complexityViolations",
        coverage_check_passed as "coverageCheckPassed",
        coverage_failures as "coverageFailures",
        security_check_passed as "securityCheckPassed",
        security_violations as "securityViolations",
        overall_passed as "overallPassed",
        failure_reasons as "failureReasons",
        recommendations,
        files_created as "filesCreated",
        files_modified as "filesModified",
        files_deleted as "filesDeleted",
        created_at as "createdAt"
      FROM quality_gate_validations
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  @Query()
  async qualityGateValidations(
    @Args('reqNumber', { nullable: true }) reqNumber?: string,
    @Args('agentName', { nullable: true }) agentName?: string,
    @Args('status', { nullable: true }) status?: ValidationStatus,
    @Args('limit', { defaultValue: 50 }) limit: number = 50,
  ): Promise<QualityGateValidation[]> {
    const conditions = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (reqNumber) {
      conditions.push(`req_number = $${paramIndex++}`);
      params.push(reqNumber);
    }

    if (agentName) {
      conditions.push(`agent_name = $${paramIndex++}`);
      params.push(agentName);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    params.push(limit);

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        id, req_number as "reqNumber", agent_name as "agentName",
        deliverable_url as "deliverableUrl", status,
        validation_started_at as "validationStartedAt",
        validation_completed_at as "validationCompletedAt",
        validation_duration_ms as "validationDurationMs",
        linting_passed as "lintingPassed",
        linting_errors as "lintingErrors",
        type_checking_passed as "typeCheckingPassed",
        type_checking_errors as "typeCheckingErrors",
        unit_tests_passed as "unitTestsPassed",
        unit_test_failures as "unitTestFailures",
        complexity_check_passed as "complexityCheckPassed",
        complexity_violations as "complexityViolations",
        coverage_check_passed as "coverageCheckPassed",
        coverage_failures as "coverageFailures",
        security_check_passed as "securityCheckPassed",
        security_violations as "securityViolations",
        overall_passed as "overallPassed",
        failure_reasons as "failureReasons",
        recommendations,
        files_created as "filesCreated",
        files_modified as "filesModified",
        files_deleted as "filesDeleted",
        created_at as "createdAt"
      FROM quality_gate_validations
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}
    `;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // =====================================================
  // Agent Quality Scores
  // =====================================================

  @Query()
  async agentQualityScores(
    @Args('agentName', { nullable: true }) agentName?: string,
    @Args('timePeriod', { defaultValue: 'monthly' })
    timePeriod: 'weekly' | 'monthly' | 'quarterly' = 'monthly',
  ): Promise<AgentQualityScore[]> {
    return this.qualityGateService.getAgentQualityScores(
      agentName,
      timePeriod,
    );
  }

  @Query()
  async agentQualityPassRates(): Promise<any[]> {
    const query = `
      SELECT
        agent_name as "agentName",
        total_validations as "totalValidations",
        passed_validations as "passedValidations",
        failed_validations as "failedValidations",
        pass_rate_pct as "passRatePct",
        avg_validation_time_ms as "avgValidationTimeMs"
      FROM v_agent_quality_pass_rates
      ORDER BY pass_rate_pct DESC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  // =====================================================
  // Quality Gate Bypasses
  // =====================================================

  @Query()
  async qualityGateBypasses(
    @Args('reqNumber', { nullable: true }) reqNumber?: string,
    @Args('unresolvedOnly', { defaultValue: false }) unresolvedOnly = false,
    @Args('limit', { defaultValue: 50 }) limit = 50,
  ): Promise<any[]> {
    const conditions = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (reqNumber) {
      conditions.push(`req_number = $${paramIndex++}`);
      params.push(reqNumber);
    }

    if (unresolvedOnly) {
      conditions.push(`follow_up_completed = FALSE`);
    }

    params.push(limit);

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        id, req_number as "reqNumber",
        validation_id as "validationId",
        bypass_reason as "bypassReason",
        bypassed_by as "bypassedBy",
        approved_by as "approvedBy",
        bypassed_violations as "bypassedViolations",
        follow_up_issue_number as "followUpIssueNumber",
        follow_up_due_date as "followUpDueDate",
        follow_up_completed as "followUpCompleted",
        postmortem_completed as "postmortemCompleted",
        postmortem_url as "postmortemUrl",
        bypassed_at as "bypassedAt",
        resolved_at as "resolvedAt"
      FROM quality_gate_bypasses
      ${whereClause}
      ORDER BY bypassed_at DESC
      LIMIT $${paramIndex}
    `;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  @Query()
  async qualityGateBypassRates(): Promise<any[]> {
    const query = `
      SELECT
        month,
        total_bypasses as "totalBypasses",
        resolved_bypasses as "resolvedBypasses",
        unresolved_bypasses as "unresolvedBypasses",
        postmortem_completion_rate as "postmortemCompletionRate"
      FROM v_quality_gate_bypass_rate
      ORDER BY month DESC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  // =====================================================
  // GraphQL Schema Changes
  // =====================================================

  @Query()
  async graphqlSchemaChanges(
    @Args('reqNumber', { nullable: true }) reqNumber?: string,
    @Args('breakingOnly', { defaultValue: false }) breakingOnly = false,
    @Args('limit', { defaultValue: 50 }) limit = 50,
  ): Promise<any[]> {
    const conditions = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (reqNumber) {
      conditions.push(`req_number = $${paramIndex++}`);
      params.push(reqNumber);
    }

    if (breakingOnly) {
      conditions.push(`is_breaking = TRUE`);
    }

    params.push(limit);

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        id, req_number as "reqNumber", commit_sha as "commitSha",
        breaking_changes as "breakingChanges",
        dangerous_changes as "dangerousChanges",
        safe_changes as "safeChanges",
        is_breaking as "isBreaking",
        frontend_compatible as "frontendCompatible",
        previous_schema_hash as "previousSchemaHash",
        new_schema_hash as "newSchemaHash",
        validated_at as "validatedAt",
        validated_by as "validatedBy",
        contract_tests_passed as "contractTestsPassed",
        contract_test_results as "contractTestResults"
      FROM graphql_schema_changes
      ${whereClause}
      ORDER BY validated_at DESC
      LIMIT $${paramIndex}
    `;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // =====================================================
  // CI/CD Pipeline Metrics
  // =====================================================

  @Query()
  async ciPipelineMetrics(
    @Args('reqNumber', { nullable: true }) reqNumber?: string,
    @Args('pipelineType', { nullable: true })
    pipelineType?: 'fast_feedback' | 'comprehensive',
    @Args('limit', { defaultValue: 50 }) limit = 50,
  ): Promise<any[]> {
    const conditions = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (reqNumber) {
      conditions.push(`req_number = $${paramIndex++}`);
      params.push(reqNumber);
    }

    if (pipelineType) {
      conditions.push(`pipeline_type = $${paramIndex++}`);
      params.push(pipelineType);
    }

    params.push(limit);

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        id, req_number as "reqNumber", commit_sha as "commitSha",
        branch, pipeline_id as "pipelineId", pipeline_url as "pipelineUrl",
        pipeline_type as "pipelineType", started_at as "startedAt",
        completed_at as "completedAt", total_duration_seconds as "totalDurationSeconds",
        lint_duration_seconds as "lintDurationSeconds",
        test_duration_seconds as "testDurationSeconds",
        build_duration_seconds as "buildDurationSeconds",
        security_scan_duration_seconds as "securityScanDurationSeconds",
        quality_analysis_duration_seconds as "qualityAnalysisDurationSeconds",
        cache_hit_rate as "cacheHitRate", cache_size_mb as "cacheSizeMb",
        status, failed_jobs as "failedJobs"
      FROM ci_pipeline_metrics
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT $${paramIndex}
    `;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // =====================================================
  // Mutations
  // =====================================================

  @Mutation()
  async submitQualityMetrics(
    @Args('metrics') metricsInput: any,
  ): Promise<QualityMetrics> {
    const metrics: QualityMetrics = {
      ...metricsInput,
      timestamp: new Date(),
      qualityGatePassed: false,
      blockedReasons: [],
    };

    // Validate against quality gates
    const validation =
      await this.qualityGateService.validateQualityMetrics(metrics);
    metrics.qualityGatePassed = validation.passed;
    metrics.blockedReasons = validation.violations;

    // Store metrics
    await this.qualityGateService.storeQualityMetrics(metrics);

    return metrics;
  }

  @Mutation()
  async requestQualityGateBypass(
    @Args('reqNumber') reqNumber: string,
    @Args('validationId', { nullable: true }) validationId?: string,
    @Args('reason') reason?: string,
    @Args('bypassedViolations') bypassedViolations?: string[],
  ): Promise<any> {
    const query = `
      INSERT INTO quality_gate_bypasses (
        req_number, validation_id, bypass_reason,
        bypassed_by, approved_by, bypassed_violations
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id, req_number as "reqNumber",
        validation_id as "validationId",
        bypass_reason as "bypassReason",
        bypassed_by as "bypassedBy",
        approved_by as "approvedBy",
        bypassed_violations as "bypassedViolations",
        bypassed_at as "bypassedAt"
    `;

    const result = await this.pool.query(query, [
      reqNumber,
      validationId,
      reason,
      'system', // TODO: Get from auth context
      [],
      bypassedViolations,
    ]);

    return result.rows[0];
  }

  @Mutation()
  async approveQualityGateBypass(
    @Args('bypassId') bypassId: string,
    @Args('approverId') approverId: string,
  ): Promise<any> {
    const query = `
      UPDATE quality_gate_bypasses
      SET approved_by = array_append(approved_by, $2)
      WHERE id = $1
      RETURNING
        id, req_number as "reqNumber",
        validation_id as "validationId",
        bypass_reason as "bypassReason",
        bypassed_by as "bypassedBy",
        approved_by as "approvedBy",
        bypassed_violations as "bypassedViolations",
        bypassed_at as "bypassedAt"
    `;

    const result = await this.pool.query(query, [bypassId, approverId]);
    return result.rows[0];
  }
}
