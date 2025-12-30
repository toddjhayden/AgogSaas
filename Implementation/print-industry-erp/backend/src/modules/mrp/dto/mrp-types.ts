/**
 * MRP Engine Type Definitions
 * REQ-STRATEGIC-AUTO-1767084329264
 */

export enum MRPRunType {
  REGENERATIVE = 'REGENERATIVE',
  NET_CHANGE = 'NET_CHANGE',
  SIMULATION = 'SIMULATION',
}

export enum MRPRunStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  COMPLETED_WITH_WARNINGS = 'COMPLETED_WITH_WARNINGS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum PlannedOrderType {
  PURCHASE = 'PURCHASE',
  PRODUCTION = 'PRODUCTION',
  TRANSFER = 'TRANSFER',
}

export enum PlannedOrderStatus {
  PLANNED = 'PLANNED',
  FIRMED = 'FIRMED',
  CONVERTED = 'CONVERTED',
  CANCELLED = 'CANCELLED',
}

export enum LotSizingMethod {
  LOT_FOR_LOT = 'LOT_FOR_LOT',
  FIXED_ORDER_QUANTITY = 'FIXED_ORDER_QUANTITY',
  EOQ = 'EOQ',
  PERIOD_ORDER_QUANTITY = 'PERIOD_ORDER_QUANTITY',
  MIN_MAX = 'MIN_MAX',
}

export enum DemandSourceType {
  SALES_ORDER = 'SALES_ORDER',
  PRODUCTION_ORDER = 'PRODUCTION_ORDER',
  FORECAST = 'FORECAST',
  SAFETY_STOCK = 'SAFETY_STOCK',
  PARENT_PLANNED_ORDER = 'PARENT_PLANNED_ORDER',
}

export enum ActionType {
  EXPEDITE = 'EXPEDITE',
  DE_EXPEDITE = 'DE_EXPEDITE',
  INCREASE_QUANTITY = 'INCREASE_QUANTITY',
  DECREASE_QUANTITY = 'DECREASE_QUANTITY',
  CANCEL = 'CANCEL',
  NEW_ORDER = 'NEW_ORDER',
  CAPACITY_WARNING = 'CAPACITY_WARNING',
}

export enum ImpactLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum ActionMessageStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
}

export enum MRPErrorCode {
  CIRCULAR_BOM = 'CIRCULAR_BOM',
  INVALID_LEAD_TIME = 'INVALID_LEAD_TIME',
  MISSING_BOM = 'MISSING_BOM',
  INVENTORY_QUERY_FAILED = 'INVENTORY_QUERY_FAILED',
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
  CONCURRENCY_CONFLICT = 'CONCURRENCY_CONFLICT',
  MAX_DEPTH_EXCEEDED = 'MAX_DEPTH_EXCEEDED',
}

// ============================================================================
// BOM Explosion Types
// ============================================================================

export interface BOMComponent {
  id: string;
  materialId: string;
  materialCode: string;
  quantityPerParent: number;
  scrapPercentage: number;
  leadTimeDays: number;
  safetyLeadTimeDays: number;
  isManufactured: boolean;
  isPhantom: boolean;
  sequenceNumber: number;
}

export interface BOMNode {
  productId: string;
  quantity: number;
  dueDate: Date;
  level: number;
  peggingChain: PeggingChainItem[];
}

export interface PeggingChainItem {
  productId: string;
  quantity: number;
}

export interface MaterialRequirement {
  mrpRunId: string;
  materialId: string;
  materialCode: string;
  grossQuantity: number;
  requiredDate: Date;
  demandSource: {
    type: string;
    productId: string;
    parentQuantity: number;
    bomLevel: number;
  };
  peggingChain: PeggingChainItem[];
}

// ============================================================================
// Inventory Netting Types
// ============================================================================

export interface InventoryLevels {
  onHandQuantity: number;
  allocatedQuantity: number;
}

export interface OnOrderItem {
  materialId: string;
  quantity: number;
  dueDate: Date;
  orderType: 'PO' | 'PRODUCTION_ORDER';
  orderId: string;
}

export interface NetRequirement {
  materialId: string;
  materialCode: string;
  grossQuantity: number;
  projectedOnHand: number;
  netQuantity: number;
  requiredDate: Date;
  peggingChain: PeggingChainItem[];
}

// ============================================================================
// Lot Sizing Types
// ============================================================================

export interface LotSizingConfig {
  method: LotSizingMethod;
  fixedOrderQuantity?: number;
  periodOrderQuantityDays?: number;
  minimumOrderQuantity?: number;
  orderMultiple?: number;
  economicOrderQuantity?: number;
}

export interface PlannedOrderInput {
  tenantId: string;
  facilityId: string;
  mrpRunId: string;
  materialId: string;
  materialCode: string;
  netQuantity: number;
  requiredDate: Date;
  peggingChain: PeggingChainItem[];
}

export interface PlannedOrderResult {
  id: string;
  plannedOrderNumber: string;
  orderType: PlannedOrderType;
  materialId: string;
  materialCode: string;
  quantity: number;
  unitOfMeasure: string;
  requiredDate: Date;
  orderDate: Date;
  vendorId?: string;
  workCenterId?: string;
  estimatedUnitCost: number;
  estimatedTotalCost: number;
  lotSizingMethod: LotSizingMethod;
  status: PlannedOrderStatus;
}

// ============================================================================
// Demand Source Types
// ============================================================================

export interface DemandSource {
  type: DemandSourceType;
  productId: string;
  quantity: number;
  dueDate: Date;
  priority: 'FIRM' | 'FORECAST';
  salesOrderId?: string;
  salesOrderLineId?: string;
  productionOrderId?: string;
  forecastId?: string;
}

// ============================================================================
// Capacity Requirements Planning Types
// ============================================================================

export interface BottleneckAnalysis {
  workCenterId: string;
  workCenterName: string;
  requiredHours: number;
  availableHours: number;
  utilizationPercent: number;
  isBottleneck: boolean;
}

export interface CapacityFeasibility {
  isFeasible: boolean;
  bottlenecks: BottleneckAnalysis[];
  warnings: string[];
}

// ============================================================================
// Action Message Types
// ============================================================================

export interface SalesOrderImpact {
  salesOrderNumber: string;
  customerName: string;
  dueDate: Date;
  impactDescription?: string;
}

export interface ActionMessageInput {
  tenantId: string;
  facilityId: string;
  mrpRunId: string;
  actionType: ActionType;
  orderType: string;
  materialId: string;
  materialCode: string;
  currentQuantity?: number;
  recommendedQuantity?: number;
  currentDueDate?: Date;
  recommendedDueDate?: Date;
  impactLevel: ImpactLevel;
  affectedSalesOrders: SalesOrderImpact[];
  reasonCode: string;
  reasonDescription?: string;
}

// ============================================================================
// MRP Run Result Types
// ============================================================================

export interface MRPRunResult {
  mrpRunId: string;
  status: MRPRunStatus;
  plannedOrders: PlannedOrderResult[];
  actionMessages: ActionMessageResult[];
  capacityAnalysis?: CapacityFeasibility;
}

export interface ActionMessageResult {
  id: string;
  actionMessageNumber: string;
  actionType: ActionType;
  orderType: string;
  materialId: string;
  materialCode: string;
  currentQuantity?: number;
  recommendedQuantity?: number;
  currentDueDate?: Date;
  recommendedDueDate?: Date;
  impactLevel: ImpactLevel;
  affectedSalesOrders: SalesOrderImpact[];
  reasonCode: string;
  reasonDescription?: string;
  status: ActionMessageStatus;
}

// ============================================================================
// MRP Engine Error
// ============================================================================

export class MRPEngineError extends Error {
  constructor(
    public code: MRPErrorCode,
    public message: string,
    public productId?: string,
    public materialId?: string,
    public isRetryable: boolean = false,
  ) {
    super(message);
    this.name = 'MRPEngineError';
    Object.setPrototypeOf(this, MRPEngineError.prototype);
  }
}
