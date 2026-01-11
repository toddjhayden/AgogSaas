/**
 * Cost Allocation Interfaces
 * REQ-1767541724200-2fb1a: Cost Allocation Engine for Accurate Job Profitability
 */

// =====================================================
// ENUMS
// =====================================================

export enum AllocationType {
  DIRECT = 'DIRECT',
  STEP_DOWN = 'STEP_DOWN',
  RECIPROCAL = 'RECIPROCAL',
  ACTIVITY_BASED = 'ACTIVITY_BASED',
}

export enum AllocationRunStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// =====================================================
// CORE ENTITIES
// =====================================================

export interface CostPool {
  id: string;
  tenantId: string;
  poolCode: string;
  poolName: string;
  description?: string;
  poolType: string; // 'overhead', 'equipment', 'facility', 'other'
  costBehavior: string; // 'fixed', 'variable', 'mixed'
  sourceAccountId?: string;
  currentPoolAmount: number;
  periodYear?: number;
  periodMonth?: number;
  isActive: boolean;
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  updatedBy?: string;
}

export interface CostDriver {
  id: string;
  tenantId: string;
  driverCode: string;
  driverName: string;
  description?: string;
  driverType: string; // 'quantity', 'hours', 'weight', 'area', 'count', 'custom'
  unitOfMeasure: string;
  calculationMethod: string; // 'direct', 'formula', 'query'
  sourceTable?: string;
  sourceColumn?: string;
  sourceQuery?: string;
  isActive: boolean;
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  updatedBy?: string;
}

export interface AllocationRule {
  id: string;
  tenantId: string;
  ruleCode: string;
  ruleName: string;
  description?: string;
  costPoolId: string;
  costDriverId: string;
  allocationMethod: string; // 'direct', 'step_down', 'reciprocal', 'activity_based'
  targetType: string; // 'job', 'department', 'work_center', 'product_line'
  targetCostCategory: string; // 'overhead', 'labor', 'material', 'equipment'
  rateType: string; // 'predetermined', 'actual', 'standard'
  predeterminedRate?: number;
  allocationFilters?: any;
  allocationPriority: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  updatedBy?: string;
}

export interface AllocationRun {
  id: string;
  tenantId: string;
  runNumber: string;
  runDescription?: string;
  periodYear: number;
  periodMonth: number;
  allocationType: AllocationType;
  includedPools?: string[];
  includedJobs?: string[];
  startedAt: Date;
  completedAt?: Date;
  executionDurationMs?: number;
  status: AllocationRunStatus;
  totalPoolsProcessed: number;
  totalAmountAllocated: number;
  totalJobsAffected: number;
  totalAllocationsCreated: number;
  errorMessage?: string;
  errorDetails?: any;
  isReversed: boolean;
  reversedAt?: Date;
  reversedBy?: string;
  reversalRunId?: string;
  createdBy?: string;
}

export interface JobCostAllocation {
  id: string;
  tenantId: string;
  allocationRunId: string;
  jobCostId: string;
  jobId: string;
  costPoolId: string;
  allocationRuleId: string;
  costDriverId: string;
  driverQuantity: number;
  totalDriverQuantity: number;
  allocationRate: number;
  allocationPercentage?: number;
  allocatedAmount: number;
  costCategory: string;
  allocationMetadata?: any;
  createdAt: Date;
}

export interface DriverMeasurement {
  id: string;
  tenantId: string;
  jobId: string;
  costDriverId: string;
  periodYear: number;
  periodMonth: number;
  measurementDate: Date;
  measuredQuantity: number;
  unitOfMeasure: string;
  measurementSource: string; // 'manual', 'job_tracking', 'production', 'time_entry'
  sourceId?: string;
  sourceReference?: string;
  notes?: string;
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  updatedBy?: string;
}

// =====================================================
// INPUT TYPES
// =====================================================

export interface CreateCostPoolInput {
  poolCode: string;
  poolName: string;
  description?: string;
  poolType: string;
  costBehavior: string;
  sourceAccountId?: string;
  currentPoolAmount?: number;
  periodYear?: number;
  periodMonth?: number;
  isActive?: boolean;
  createdBy?: string;
}

export interface UpdateCostPoolInput {
  poolName?: string;
  description?: string;
  currentPoolAmount?: number;
  isActive?: boolean;
  updatedBy?: string;
}

export interface CreateCostDriverInput {
  driverCode: string;
  driverName: string;
  description?: string;
  driverType: string;
  unitOfMeasure: string;
  calculationMethod: string;
  sourceTable?: string;
  sourceColumn?: string;
  sourceQuery?: string;
  isActive?: boolean;
  createdBy?: string;
}

export interface UpdateCostDriverInput {
  driverName?: string;
  description?: string;
  isActive?: boolean;
  updatedBy?: string;
}

export interface CreateAllocationRuleInput {
  ruleCode: string;
  ruleName: string;
  description?: string;
  costPoolId: string;
  costDriverId: string;
  allocationMethod: string;
  targetType: string;
  targetCostCategory: string;
  rateType: string;
  predeterminedRate?: number;
  allocationFilters?: any;
  allocationPriority?: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive?: boolean;
  createdBy?: string;
}

export interface UpdateAllocationRuleInput {
  ruleName?: string;
  description?: string;
  predeterminedRate?: number;
  allocationFilters?: any;
  allocationPriority?: number;
  effectiveTo?: Date;
  isActive?: boolean;
  updatedBy?: string;
}

export interface CreateDriverMeasurementInput {
  jobId: string;
  costDriverId: string;
  periodYear: number;
  periodMonth: number;
  measurementDate: Date;
  measuredQuantity: number;
  unitOfMeasure: string;
  measurementSource: string;
  sourceId?: string;
  sourceReference?: string;
  notes?: string;
  createdBy?: string;
}

export interface RunAllocationInput {
  runDescription?: string;
  periodYear: number;
  periodMonth: number;
  allocationType: AllocationType;
  includedPools?: string[];
  includedJobs?: string[];
  createdBy?: string;
}

// =====================================================
// FILTER TYPES
// =====================================================

export interface CostPoolFilters {
  tenantId: string;
  poolType?: string;
  isActive?: boolean;
  periodYear?: number;
  periodMonth?: number;
}

export interface CostDriverFilters {
  tenantId: string;
  driverType?: string;
  isActive?: boolean;
}

export interface AllocationRuleFilters {
  tenantId: string;
  costPoolId?: string;
  costDriverId?: string;
  isActive?: boolean;
  effectiveDate?: Date;
}

export interface AllocationRunFilters {
  tenantId: string;
  periodYear?: number;
  periodMonth?: number;
  status?: AllocationRunStatus;
  fromDate?: Date;
  toDate?: Date;
}

export interface JobCostAllocationFilters {
  tenantId: string;
  jobId?: string;
  jobCostId?: string;
  allocationRunId?: string;
  costPoolId?: string;
  periodYear?: number;
  periodMonth?: number;
}

export interface DriverMeasurementFilters {
  tenantId: string;
  jobId?: string;
  costDriverId?: string;
  periodYear?: number;
  periodMonth?: number;
  measurementSource?: string;
}

// =====================================================
// RESULT TYPES
// =====================================================

export interface CostPoolResult {
  success: boolean;
  costPool?: CostPool;
  error?: string;
}

export interface CostPoolListResult {
  costPools: CostPool[];
  totalCount: number;
}

export interface CostDriverResult {
  success: boolean;
  costDriver?: CostDriver;
  error?: string;
}

export interface CostDriverListResult {
  costDrivers: CostDriver[];
  totalCount: number;
}

export interface AllocationRuleResult {
  success: boolean;
  allocationRule?: AllocationRule;
  error?: string;
}

export interface AllocationRuleListResult {
  allocationRules: AllocationRule[];
  totalCount: number;
}

export interface AllocationRunResult {
  success: boolean;
  allocationRun?: AllocationRun;
  error?: string;
}

export interface AllocationRunListResult {
  allocationRuns: AllocationRun[];
  totalCount: number;
}

export interface JobCostAllocationListResult {
  allocations: JobCostAllocation[];
  totalCount: number;
}

export interface DriverMeasurementResult {
  success: boolean;
  driverMeasurement?: DriverMeasurement;
  error?: string;
}

export interface DriverMeasurementListResult {
  measurements: DriverMeasurement[];
  totalCount: number;
}

export interface AllocationSummary {
  jobId: string;
  jobCostId?: string;
  allocationMonth: Date;
  totalAllocationRuns: number;
  totalPoolsAllocated: number;
  totalAllocatedAmount: number;
  overheadAllocated: number;
  equipmentAllocated: number;
  otherAllocated: number;
  lastAllocationDate: Date;
}
