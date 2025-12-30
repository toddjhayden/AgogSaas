/**
 * Job Costing Module Interfaces
 * REQ-STRATEGIC-AUTO-1767066329938: Complete Estimating & Job Costing Module
 *
 * TypeScript interfaces for job costing operations including actual costs,
 * variance analysis, and profitability tracking.
 */

// =====================================================
// ENUMS
// =====================================================

export enum JobCostStatus {
  INITIALIZED = 'INITIALIZED',
  IN_PROGRESS = 'IN_PROGRESS',
  RECONCILED = 'RECONCILED',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

export enum CostCategory {
  MATERIAL = 'MATERIAL',
  LABOR = 'LABOR',
  EQUIPMENT = 'EQUIPMENT',
  OVERHEAD = 'OVERHEAD',
  OUTSOURCING = 'OUTSOURCING',
  OTHER = 'OTHER',
}

export enum UpdateSource {
  MATERIAL_CONSUMPTION = 'MATERIAL_CONSUMPTION',
  LABOR_TRACKING = 'LABOR_TRACKING',
  EQUIPMENT_USAGE = 'EQUIPMENT_USAGE',
  OVERHEAD_ALLOCATION = 'OVERHEAD_ALLOCATION',
  VENDOR_INVOICE = 'VENDOR_INVOICE',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
}

export enum RollupSource {
  PRODUCTION_ORDER = 'PRODUCTION_ORDER',
  INVENTORY_TRANSACTION = 'INVENTORY_TRANSACTION',
  LABOR_TIMESHEET = 'LABOR_TIMESHEET',
  EQUIPMENT_LOG = 'EQUIPMENT_LOG',
  MANUAL_ENTRY = 'MANUAL_ENTRY',
}

// =====================================================
// JOB COST INTERFACES
// =====================================================

export interface JobCost {
  id: string;
  tenantId: string;
  jobId: string;
  estimateId?: string;

  // Revenue
  totalAmount: number;

  // Actual Costs
  totalCost: number;
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  overheadCost: number;
  outsourcingCost: number;
  otherCost: number;

  // Estimated Costs
  estimatedMaterialCost?: number;
  estimatedLaborCost?: number;
  estimatedEquipmentCost?: number;
  estimatedOverheadCost?: number;
  estimatedOutsourcingCost?: number;
  estimatedTotalCost?: number;

  // Profitability Metrics (Calculated)
  grossProfit: number;
  grossProfitMargin: number;
  costVariance?: number;
  costVariancePercentage?: number;
  materialVariance?: number;
  laborVariance?: number;
  equipmentVariance?: number;

  // Status
  status: JobCostStatus;
  costingDate?: Date;
  notes?: string;

  // Reconciliation
  isReconciled: boolean;
  reconciledAt?: Date;
  reconciledBy?: string;

  // Rollup Tracking
  lastRollupAt?: Date;
  lastRollupSource?: RollupSource;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface JobCostUpdate {
  id: string;
  tenantId: string;
  jobCostId: string;

  // Update Info
  updateSource: UpdateSource;
  sourceId?: string;
  costCategory: CostCategory;
  costDelta: number;

  // Before/After
  previousTotal: number;
  newTotal: number;

  // Details
  quantity?: number;
  unitCost?: number;
  description?: string;
  updateMetadata?: any;

  // Audit
  createdAt: Date;
  createdBy?: string;
}

export interface JobProfitability {
  jobId: string;
  jobNumber: string;
  customerName: string;
  jobDescription?: string;

  // Financial Metrics
  revenue: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;

  // Variance
  estimatedCost?: number;
  costVariance?: number;
  costVariancePercentage?: number;

  // Status
  status: JobCostStatus;
  costingDate?: Date;
}

export interface CostLineItem {
  costCategory: CostCategory;
  estimatedCost: number;
  actualCost: number;
  variance: number;
  variancePercentage: number;
}

export interface CostAdjustment {
  adjustmentType: string;
  amount: number;
  reason?: string;
  adjustedBy?: string;
  adjustedAt?: Date;
}

export interface VarianceReport {
  jobs: JobProfitability[];
  summary: VarianceSummary;
}

export interface VarianceSummary {
  totalJobs: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number;
  minMargin?: number;
  maxMargin?: number;
  medianMargin?: number;
  totalVariance: number;
  avgVariancePercentage: number;
  jobsOverBudget: number;
  jobsUnderBudget: number;
}

// =====================================================
// INPUT TYPES (GraphQL Inputs)
// =====================================================

export interface InitializeJobCostInput {
  tenantId: string;
  jobId: string;
  estimateId?: string;
  totalAmount: number;
  createdBy?: string;
}

export interface UpdateActualCostsInput {
  materialCost?: number;
  laborCost?: number;
  equipmentCost?: number;
  overheadCost?: number;
  outsourcingCost?: number;
  otherCost?: number;
  notes?: string;
  updatedBy?: string;
}

export interface IncrementCostInput {
  jobCostId: string;
  costCategory: CostCategory;
  costDelta: number;
  updateSource: UpdateSource;
  sourceId?: string;
  quantity?: number;
  unitCost?: number;
  description?: string;
  updateMetadata?: any;
  createdBy?: string;
}

export interface RollupProductionCostsInput {
  jobId: string;
  productionOrderId: string;
  rollupSource: RollupSource;
  updatedBy?: string;
}

export interface AddFinalAdjustmentInput {
  jobCostId: string;
  adjustmentType: string;
  amount: number;
  reason?: string;
  adjustedBy?: string;
}

export interface ReconcileJobCostInput {
  jobCostId: string;
  notes?: string;
  reconciledBy?: string;
}

export interface CloseJobCostingInput {
  jobCostId: string;
  completionNotes?: string;
  closedBy?: string;
}

export interface UpdateJobCostStatusInput {
  status: JobCostStatus;
  notes?: string;
  updatedBy?: string;
}

// =====================================================
// FILTER TYPES
// =====================================================

export interface JobCostFilters {
  tenantId: string;
  jobId?: string;
  status?: JobCostStatus;
  fromDate?: Date;
  toDate?: Date;
  minVariancePercentage?: number;
}

export interface VarianceReportFilters {
  tenantId: string;
  fromDate?: Date;
  toDate?: Date;
  minVariancePercentage?: number;
  customerId?: string;
  status?: JobCostStatus;
}

// =====================================================
// RESULT TYPES
// =====================================================

export interface JobCostResult {
  success: boolean;
  jobCost?: JobCost;
  error?: string;
}

export interface JobCostListResult {
  jobCosts: JobCost[];
  totalCount: number;
}

export interface VarianceReportResult {
  success: boolean;
  report?: VarianceReport;
  error?: string;
}
