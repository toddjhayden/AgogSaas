import { gql } from '@apollo/client';

/**
 * GraphQL queries for Code Quality & Quality Gates
 * REQ-STRATEGIC-AUTO-1767108044307
 */

// Quality Metrics Queries
export const GET_QUALITY_METRICS = gql`
  query GetQualityMetrics($reqNumber: String!) {
    qualityMetrics(reqNumber: $reqNumber) {
      reqNumber
      commitSha
      branch
      author
      timestamp
      coverage {
        line
        branch
        function
        statement
      }
      complexity {
        max
        avg
        violations {
          file
          function
          complexity
          threshold
        }
      }
      linting {
        errors
        warnings
        issues {
          file
          line
          rule
          message
          severity
        }
      }
      security {
        critical
        high
        medium
        low
        vulnerabilities {
          package
          severity
          title
          cve
        }
      }
      performance {
        buildTime
        bundleSize
        avgTestDuration
      }
      qualityGatePassed
      blockedReasons
    }
  }
`;

export const GET_LATEST_QUALITY_METRICS = gql`
  query GetLatestQualityMetrics($reqNumber: String!) {
    latestQualityMetrics(reqNumber: $reqNumber) {
      reqNumber
      commitSha
      branch
      author
      timestamp
      coverage {
        line
        branch
        function
        statement
      }
      complexity {
        max
        avg
        violations {
          file
          function
          complexity
          threshold
        }
      }
      linting {
        errors
        warnings
        issues {
          file
          line
          rule
          message
          severity
        }
      }
      security {
        critical
        high
        medium
        low
        vulnerabilities {
          package
          severity
          title
          cve
        }
      }
      performance {
        buildTime
        bundleSize
        avgTestDuration
      }
      qualityGatePassed
      blockedReasons
    }
  }
`;

export const GET_QUALITY_METRICS_TRENDS = gql`
  query GetQualityMetricsTrends($limit: Int = 100) {
    qualityMetricsTrends(limit: $limit) {
      reqNumber
      commitSha
      createdAt
      lineCoverage
      maxComplexity
      totalLintIssues
      criticalSecurityIssues
      qualityGatePassed
      statusSummary
    }
  }
`;

// Quality Gate Configuration
export const GET_ACTIVE_QUALITY_GATE_CONFIG = gql`
  query GetActiveQualityGateConfig {
    activeQualityGateConfig {
      id
      name
      description
      enabled
      minLineCoverage
      minBranchCoverage
      minFunctionCoverage
      minNewCodeCoverage
      maxCyclomaticComplexity
      maxCognitiveComplexity
      maxLinesPerFunction
      maxFileLength
      maxCriticalVulnerabilities
      maxHighVulnerabilities
      maxBundleSizeKb
      maxApiResponseP95Ms
      maxSlowQueryMs
      maxCiPipelineMinutes
      maxCodeSmells
      maxTechnicalDebtRatio
      maxDuplicatedCodePct
    }
  }
`;

export const GET_QUALITY_GATE_STATUS = gql`
  query GetQualityGateStatus($reqNumber: String!) {
    qualityGateStatus(reqNumber: $reqNumber) {
      passed
      gates {
        name
        passed
        threshold
        actualValue
        severity
      }
    }
  }
`;

// Quality Gate Validations
export const GET_QUALITY_GATE_VALIDATION = gql`
  query GetQualityGateValidation($id: ID!) {
    qualityGateValidation(id: $id) {
      id
      reqNumber
      agentName
      deliverableUrl
      status
      validationStartedAt
      validationCompletedAt
      validationDurationMs
      lintingPassed
      lintingErrors
      typeCheckingPassed
      typeCheckingErrors
      unitTestsPassed
      unitTestFailures
      complexityCheckPassed
      complexityViolations
      coverageCheckPassed
      coverageFailures
      securityCheckPassed
      securityViolations
      overallPassed
      failureReasons
      recommendations
      filesCreated
      filesModified
      filesDeleted
      createdAt
    }
  }
`;

export const GET_QUALITY_GATE_VALIDATIONS = gql`
  query GetQualityGateValidations(
    $reqNumber: String
    $agentName: String
    $status: ValidationStatus
    $limit: Int = 50
  ) {
    qualityGateValidations(
      reqNumber: $reqNumber
      agentName: $agentName
      status: $status
      limit: $limit
    ) {
      id
      reqNumber
      agentName
      deliverableUrl
      status
      validationStartedAt
      validationCompletedAt
      validationDurationMs
      lintingPassed
      typeCheckingPassed
      unitTestsPassed
      complexityCheckPassed
      coverageCheckPassed
      securityCheckPassed
      overallPassed
      failureReasons
      recommendations
      filesCreated
      filesModified
      filesDeleted
      createdAt
    }
  }
`;

// Agent Quality Scores
export const GET_AGENT_QUALITY_SCORES = gql`
  query GetAgentQualityScores($agentName: String, $timePeriod: String = "monthly") {
    agentQualityScores(agentName: $agentName, timePeriod: $timePeriod) {
      agentName
      timePeriod
      periodStart
      periodEnd
      totalDeliverables
      passedQualityGates
      failedQualityGates
      bypassedQualityGates
      qualityGatePassRate
      avgQualityScore
      avgLineCoverage
      avgBranchCoverage
      avgComplexity
      complexityViolationCount
      totalVulnerabilitiesFound
      criticalVulnerabilitiesFound
      avgValidationTimeMs
    }
  }
`;

export const GET_AGENT_QUALITY_PASS_RATES = gql`
  query GetAgentQualityPassRates {
    agentQualityPassRates {
      agentName
      totalValidations
      passedValidations
      failedValidations
      passRatePct
      avgValidationTimeMs
    }
  }
`;

// Quality Gate Bypasses
export const GET_QUALITY_GATE_BYPASSES = gql`
  query GetQualityGateBypasses(
    $reqNumber: String
    $unresolvedOnly: Boolean = false
    $limit: Int = 50
  ) {
    qualityGateBypasses(
      reqNumber: $reqNumber
      unresolvedOnly: $unresolvedOnly
      limit: $limit
    ) {
      id
      reqNumber
      validationId
      bypassReason
      bypassedBy
      approvedBy
      bypassedViolations
      followUpIssueNumber
      followUpDueDate
      followUpCompleted
      postmortemCompleted
      postmortemUrl
      bypassedAt
      resolvedAt
    }
  }
`;

export const GET_QUALITY_GATE_BYPASS_RATES = gql`
  query GetQualityGateBypassRates {
    qualityGateBypassRates {
      month
      totalBypasses
      resolvedBypasses
      unresolvedBypasses
      postmortemCompletionRate
    }
  }
`;

// GraphQL Schema Changes
export const GET_GRAPHQL_SCHEMA_CHANGES = gql`
  query GetGraphQLSchemaChanges(
    $reqNumber: String
    $breakingOnly: Boolean = false
    $limit: Int = 50
  ) {
    graphqlSchemaChanges(
      reqNumber: $reqNumber
      breakingOnly: $breakingOnly
      limit: $limit
    ) {
      id
      reqNumber
      commitSha
      breakingChanges {
        type
        description
        path
      }
      dangerousChanges {
        type
        description
        path
      }
      safeChanges {
        type
        description
        path
      }
      isBreaking
      frontendCompatible
      previousSchemaHash
      newSchemaHash
      validatedAt
      validatedBy
      contractTestsPassed
    }
  }
`;

// CI/CD Pipeline Metrics
export const GET_CI_PIPELINE_METRICS = gql`
  query GetCIPipelineMetrics(
    $reqNumber: String
    $pipelineType: PipelineType
    $limit: Int = 50
  ) {
    ciPipelineMetrics(
      reqNumber: $reqNumber
      pipelineType: $pipelineType
      limit: $limit
    ) {
      id
      reqNumber
      commitSha
      branch
      pipelineId
      pipelineUrl
      pipelineType
      startedAt
      completedAt
      totalDurationSeconds
      lintDurationSeconds
      testDurationSeconds
      buildDurationSeconds
      securityScanDurationSeconds
      qualityAnalysisDurationSeconds
      cacheHitRate
      cacheSizeMb
      status
      failedJobs
    }
  }
`;

// Mutations
export const SUBMIT_QUALITY_METRICS = gql`
  mutation SubmitQualityMetrics($metrics: QualityMetricsInput!) {
    submitQualityMetrics(metrics: $metrics) {
      reqNumber
      commitSha
      branch
      author
      timestamp
      qualityGatePassed
      blockedReasons
    }
  }
`;

export const REQUEST_QUALITY_GATE_BYPASS = gql`
  mutation RequestQualityGateBypass(
    $reqNumber: String!
    $validationId: String
    $reason: String!
    $bypassedViolations: [String!]!
  ) {
    requestQualityGateBypass(
      reqNumber: $reqNumber
      validationId: $validationId
      reason: $reason
      bypassedViolations: $bypassedViolations
    ) {
      id
      reqNumber
      validationId
      bypassReason
      bypassedBy
      approvedBy
      bypassedViolations
      bypassedAt
    }
  }
`;

export const APPROVE_QUALITY_GATE_BYPASS = gql`
  mutation ApproveQualityGateBypass($bypassId: ID!, $approverId: String!) {
    approveQualityGateBypass(bypassId: $bypassId, approverId: $approverId) {
      id
      reqNumber
      validationId
      bypassReason
      bypassedBy
      approvedBy
      bypassedViolations
      bypassedAt
    }
  }
`;
