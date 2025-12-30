/**
 * Code Quality Metrics Interfaces
 * REQ-STRATEGIC-AUTO-1767108044307
 */

export interface QualityMetrics {
  reqNumber: string;
  commitSha: string;
  branch: string;
  author: string;
  timestamp: Date;
  coverage: CoverageMetrics;
  complexity: ComplexityMetrics;
  linting: LintingMetrics;
  security: SecurityMetrics;
  performance: PerformanceMetrics;
  qualityGatePassed: boolean;
  blockedReasons: string[];
}

export interface CoverageMetrics {
  line: number;
  branch: number;
  function: number;
  statement: number;
}

export interface ComplexityMetrics {
  max: number;
  avg: number;
  violations: ComplexityViolation[];
}

export interface ComplexityViolation {
  file: string;
  function: string;
  complexity: number;
  threshold: number;
}

export interface LintingMetrics {
  errors: number;
  warnings: number;
  issues: LintIssue[];
}

export interface LintIssue {
  file: string;
  line: number;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SecurityMetrics {
  critical: number;
  high: number;
  medium: number;
  low: number;
  vulnerabilities: SecurityVulnerability[];
}

export interface SecurityVulnerability {
  package: string;
  severity: string;
  title: string;
  cve?: string;
}

export interface PerformanceMetrics {
  buildTime: number;
  bundleSize?: number;
  avgTestDuration?: number;
}

export enum ValidationStatus {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED_LINTING = 'FAILED_LINTING',
  FAILED_TESTS = 'FAILED_TESTS',
  FAILED_COMPLEXITY = 'FAILED_COMPLEXITY',
  FAILED_COVERAGE = 'FAILED_COVERAGE',
  FAILED_SECURITY = 'FAILED_SECURITY',
  TIMEOUT = 'TIMEOUT',
  ERROR = 'ERROR'
}

export interface QualityGateValidation {
  id: string;
  reqNumber: string;
  agentName: string;
  deliverableUrl?: string;
  status: ValidationStatus;
  validationStartedAt?: Date;
  validationCompletedAt?: Date;
  validationDurationMs?: number;
  lintingPassed?: boolean;
  lintingErrors?: string[];
  typeCheckingPassed?: boolean;
  typeCheckingErrors?: string[];
  unitTestsPassed?: boolean;
  unitTestFailures?: string[];
  complexityCheckPassed?: boolean;
  complexityViolations?: string[];
  coverageCheckPassed?: boolean;
  coverageFailures?: string[];
  securityCheckPassed?: boolean;
  securityViolations?: string[];
  overallPassed: boolean;
  failureReasons?: string[];
  recommendations?: string[];
  filesCreated?: string[];
  filesModified?: string[];
  filesDeleted?: string[];
}

export interface QualityGateConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  minLineCoverage: number;
  minBranchCoverage: number;
  minFunctionCoverage: number;
  minNewCodeCoverage: number;
  maxCyclomaticComplexity: number;
  maxCognitiveComplexity: number;
  maxLinesPerFunction: number;
  maxFileLength: number;
  maxCriticalVulnerabilities: number;
  maxHighVulnerabilities: number;
  maxBundleSizeKb: number;
  maxApiResponseP95Ms: number;
  maxSlowQueryMs: number;
  maxCiPipelineMinutes: number;
  maxCodeSmells: number;
  maxTechnicalDebtRatio: number;
  maxDuplicatedCodePct: number;
}

export interface AgentQualityScore {
  agentName: string;
  timePeriod: 'weekly' | 'monthly' | 'quarterly';
  periodStart: Date;
  periodEnd: Date;
  totalDeliverables: number;
  passedQualityGates: number;
  failedQualityGates: number;
  bypassedQualityGates: number;
  qualityGatePassRate: number;
  avgQualityScore: number;
  avgLineCoverage: number;
  avgBranchCoverage: number;
  avgComplexity: number;
  complexityViolationCount: number;
  totalVulnerabilitiesFound: number;
  criticalVulnerabilitiesFound: number;
  avgValidationTimeMs: number;
}

export interface GraphQLSchemaChange {
  reqNumber: string;
  commitSha: string;
  breakingChanges: SchemaChange[];
  dangerousChanges: SchemaChange[];
  safeChanges: SchemaChange[];
  isBreaking: boolean;
  frontendCompatible: boolean;
  previousSchemaHash?: string;
  newSchemaHash: string;
  validatedAt: Date;
  validatedBy?: string;
  contractTestsPassed?: boolean;
  contractTestResults?: Record<string, any>;
}

export interface SchemaChange {
  type: string;
  description: string;
  path?: string;
}

export interface QualityGateBypass {
  id: string;
  reqNumber: string;
  validationId?: string;
  bypassReason: string;
  bypassedBy: string;
  approvedBy: string[];
  bypassedViolations: string[];
  followUpIssueNumber?: string;
  followUpDueDate?: Date;
  followUpCompleted: boolean;
  postmortemCompleted: boolean;
  postmortemUrl?: string;
  bypassedAt: Date;
  resolvedAt?: Date;
}

export interface CIPipelineMetrics {
  reqNumber?: string;
  commitSha: string;
  branch: string;
  pipelineId: string;
  pipelineUrl?: string;
  pipelineType: 'fast_feedback' | 'comprehensive';
  startedAt: Date;
  completedAt?: Date;
  totalDurationSeconds?: number;
  lintDurationSeconds?: number;
  testDurationSeconds?: number;
  buildDurationSeconds?: number;
  securityScanDurationSeconds?: number;
  qualityAnalysisDurationSeconds?: number;
  cacheHitRate?: number;
  cacheSizeMb?: number;
  status: 'success' | 'failure' | 'cancelled';
  failedJobs?: string[];
}
