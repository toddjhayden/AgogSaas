/**
 * Estimating Module Interfaces
 * REQ-STRATEGIC-AUTO-1767066329938: Complete Estimating & Job Costing Module
 *
 * TypeScript interfaces for estimating operations including estimates,
 * operations, materials, and cost calculations.
 */

// =====================================================
// ENUMS
// =====================================================

export enum EstimateStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CONVERTED_TO_QUOTE = 'CONVERTED_TO_QUOTE',
  EXPIRED = 'EXPIRED',
}

export enum OperationType {
  PREPRESS = 'PREPRESS',
  PRINTING = 'PRINTING',
  FINISHING = 'FINISHING',
  BINDING = 'BINDING',
  PACKING = 'PACKING',
  SHIPPING = 'SHIPPING',
  OUTSOURCED = 'OUTSOURCED',
  OTHER = 'OTHER',
}

export enum DependencyType {
  FINISH_TO_START = 'FINISH_TO_START',
  START_TO_START = 'START_TO_START',
  FINISH_TO_FINISH = 'FINISH_TO_FINISH',
}

export enum CostCalculationMethod {
  STANDARD_COST = 'STANDARD_COST',
  CURRENT_COST = 'CURRENT_COST',
  VENDOR_QUOTE = 'VENDOR_QUOTE',
  MANUAL = 'MANUAL',
}

export enum MaterialCategory {
  SUBSTRATE = 'SUBSTRATE',
  INK = 'INK',
  COATING = 'COATING',
  PLATE = 'PLATE',
  ADHESIVE = 'ADHESIVE',
  PACKAGING = 'PACKAGING',
  OTHER = 'OTHER',
}

export enum CostSource {
  STANDARD = 'STANDARD',
  CURRENT = 'CURRENT',
  VENDOR_QUOTE = 'VENDOR_QUOTE',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
}

// =====================================================
// ESTIMATE INTERFACES
// =====================================================

export interface Estimate {
  id: string;
  tenantId: string;
  estimateNumber: string;
  estimateDate: Date;
  revisionNumber: number;
  parentEstimateId?: string;

  // Customer/Job Info
  customerId?: string;
  customerName?: string;
  customerContact?: string;
  customerEmail?: string;
  jobDescription: string;
  quantityEstimated: number;
  productSpecification?: any;

  // Cost Summary
  totalMaterialCost: number;
  totalLaborCost: number;
  totalEquipmentCost: number;
  totalOverheadCost: number;
  totalOutsourcingCost: number;
  totalCost: number;

  // Pricing
  suggestedPrice?: number;
  targetMarginPercentage?: number;
  markupPercentage?: number;

  // Time Estimates
  estimatedLeadTimeDays?: number;
  estimatedProductionHours?: number;

  // Status
  status: EstimateStatus;

  // Template
  isTemplate: boolean;
  templateName?: string;

  // Conversion
  convertedToQuoteId?: string;
  convertedAt?: Date;
  convertedBy?: string;

  // Notes
  internalNotes?: string;
  customerNotes?: string;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface EstimateOperation {
  id: string;
  tenantId: string;
  estimateId: string;

  // Sequencing
  sequenceNumber: number;
  operationType: OperationType;
  operationDescription?: string;

  // Resources
  equipmentId?: string;
  workCenterId?: string;

  // Time
  setupTimeHours?: number;
  runTimeHours?: number;
  totalTimeHours?: number;
  runRatePerHour?: number;

  // Labor
  laborHours?: number;
  laborRatePerHour?: number;
  numberOfOperators?: number;

  // Costs
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  overheadCost: number;
  outsourcingCost: number;
  operationTotalCost: number;

  // Outsourcing
  isOutsourced: boolean;
  vendorId?: string;
  vendorQuoteAmount?: number;

  // Dependencies
  predecessorOperationId?: string;
  dependencyType?: DependencyType;

  // Standard Cost Reference
  standardCostId?: string;
  costCalculationMethod?: CostCalculationMethod;

  // Specifications
  operationSpecifications?: any;

  // Audit
  createdAt: Date;
}

export interface EstimateMaterial {
  id: string;
  tenantId: string;
  estimateId: string;
  estimateOperationId?: string;

  // Material Info
  materialId: string;
  materialCode: string;
  materialName: string;
  materialCategory?: MaterialCategory;

  // Quantity
  quantityRequired: number;
  unitOfMeasure: string;
  scrapPercentage?: number;
  quantityWithScrap?: number;

  // Cost
  unitCost: number;
  totalCost: number;
  costSource?: CostSource;

  // Vendor
  preferredVendorId?: string;
  preferredVendorName?: string;

  // Substitution
  substituteMaterialId?: string;
  isSubstitute: boolean;

  // Specifications
  materialSpecifications?: any;

  // Audit
  createdAt: Date;
}

// =====================================================
// INPUT TYPES (GraphQL Inputs)
// =====================================================

export interface CreateEstimateInput {
  tenantId: string;
  customerId?: string;
  customerName?: string;
  customerContact?: string;
  customerEmail?: string;
  jobDescription: string;
  quantityEstimated: number;
  productSpecification?: any;
  targetMarginPercentage?: number;
  estimatedLeadTimeDays?: number;
  internalNotes?: string;
  customerNotes?: string;
  createdBy?: string;
}

export interface UpdateEstimateInput {
  customerName?: string;
  customerContact?: string;
  customerEmail?: string;
  jobDescription?: string;
  quantityEstimated?: number;
  productSpecification?: any;
  targetMarginPercentage?: number;
  estimatedLeadTimeDays?: number;
  internalNotes?: string;
  customerNotes?: string;
  updatedBy?: string;
}

export interface AddOperationInput {
  tenantId: string;
  estimateId: string;
  sequenceNumber: number;
  operationType: OperationType;
  operationDescription?: string;
  equipmentId?: string;
  workCenterId?: string;
  setupTimeHours?: number;
  runTimeHours?: number;
  runRatePerHour?: number;
  laborHours?: number;
  laborRatePerHour?: number;
  numberOfOperators?: number;
  isOutsourced?: boolean;
  vendorId?: string;
  vendorQuoteAmount?: number;
  standardCostId?: string;
  costCalculationMethod?: CostCalculationMethod;
  operationSpecifications?: any;
}

export interface UpdateOperationInput {
  sequenceNumber?: number;
  operationDescription?: string;
  equipmentId?: string;
  workCenterId?: string;
  setupTimeHours?: number;
  runTimeHours?: number;
  runRatePerHour?: number;
  laborHours?: number;
  laborRatePerHour?: number;
  numberOfOperators?: number;
  isOutsourced?: boolean;
  vendorId?: string;
  vendorQuoteAmount?: number;
  operationSpecifications?: any;
}

export interface AddMaterialInput {
  tenantId: string;
  estimateId: string;
  estimateOperationId?: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  materialCategory?: MaterialCategory;
  quantityRequired: number;
  unitOfMeasure: string;
  scrapPercentage?: number;
  unitCost: number;
  costSource?: CostSource;
  preferredVendorId?: string;
  preferredVendorName?: string;
  materialSpecifications?: any;
}

export interface UpdateMaterialInput {
  quantityRequired?: number;
  scrapPercentage?: number;
  unitCost?: number;
  preferredVendorId?: string;
  materialSpecifications?: any;
}

export interface CreateRevisionInput {
  estimateId: string;
  revisionNotes?: string;
  createdBy?: string;
}

export interface ConvertToQuoteInput {
  estimateId: string;
  quoteCurrencyCode?: string;
  salesRepUserId?: string;
  termsAndConditions?: string;
  convertedBy?: string;
}

export interface ApplyTemplateInput {
  templateId: string;
  tenantId: string;
  customerId?: string;
  customerName?: string;
  jobDescription: string;
  quantityEstimated: number;
  createdBy?: string;
}

// =====================================================
// FILTER TYPES
// =====================================================

export interface EstimateFilters {
  tenantId: string;
  customerId?: string;
  status?: EstimateStatus;
  fromDate?: Date;
  toDate?: Date;
  isTemplate?: boolean;
  searchTerm?: string;
}

// =====================================================
// RESULT TYPES
// =====================================================

export interface EstimateResult {
  success: boolean;
  estimate?: Estimate;
  error?: string;
}

export interface EstimateOperationResult {
  success: boolean;
  operation?: EstimateOperation;
  error?: string;
}

export interface EstimateMaterialResult {
  success: boolean;
  material?: EstimateMaterial;
  error?: string;
}

export interface EstimateListResult {
  estimates: Estimate[];
  totalCount: number;
}
