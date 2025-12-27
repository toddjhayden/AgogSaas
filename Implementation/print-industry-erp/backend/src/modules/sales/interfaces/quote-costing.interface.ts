/**
 * Quote Costing Service Interfaces
 * REQ-STRATEGIC-AUTO-1735125600000: Sales Quote Automation
 *
 * Defines interfaces for automated product cost calculation including
 * BOM explosion, material costing, and setup cost amortization.
 */

export interface CostCalculationInput {
  productId: string;
  quantity: number;
  tenantId: string;
  asOfDate?: Date;
}

export interface CostCalculationResult {
  unitCost: number;
  totalCost: number;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  setupCost: number;
  setupCostPerUnit: number;
  costBreakdown: CostComponent[];
  bomExplosion?: BOMExplosionResult;
  costMethod: CostMethod;
}

export enum CostMethod {
  STANDARD_COST = 'STANDARD_COST',
  BOM_EXPLOSION = 'BOM_EXPLOSION',
  FIFO = 'FIFO',
  LIFO = 'LIFO',
  AVERAGE = 'AVERAGE'
}

export interface CostComponent {
  componentType: string;
  componentId: string;
  componentCode: string;
  componentName: string;
  quantity: number;
  unitOfMeasure: string;
  unitCost: number;
  totalCost: number;
  scrapPercentage: number;
}

export interface BOMExplosionInput {
  productId: string;
  quantity: number;
  tenantId: string;
  maxDepth?: number; // Default: 5 levels to prevent infinite loops
}

export interface BOMExplosionResult {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  levels: BOMLevel[];
  totalMaterialRequirements: MaterialRequirement[];
  explosionDepth: number;
}

export interface BOMLevel {
  level: number;
  components: BOMComponent[];
}

export interface BOMComponent {
  componentMaterialId: string;
  componentCode: string;
  componentName: string;
  componentType: string;
  quantityPerParent: number;
  scrapPercentage: number;
  totalQuantityRequired: number; // After scrap adjustment
  unitOfMeasure: string;
  unitCost: number;
  totalCost: number;
  hasNestedBOM: boolean;
}

export interface MaterialRequirement {
  materialId: string;
  materialCode: string;
  materialName: string;
  totalQuantity: number;
  unitOfMeasure: string;
  unitCost: number;
  totalCost: number;
  costingMethod: string;
}

export interface MaterialCostInput {
  materialId: string;
  quantity: number;
  tenantId: string;
  asOfDate?: Date;
}

export interface MaterialCostResult {
  materialId: string;
  materialCode: string;
  unitCost: number;
  totalCost: number;
  costingMethod: string;
  costSource: MaterialCostSource;
}

export enum MaterialCostSource {
  STANDARD_COST = 'STANDARD_COST',
  AVERAGE_COST = 'AVERAGE_COST',
  LAST_COST = 'LAST_COST',
  FIFO_COST = 'FIFO_COST',
  LIFO_COST = 'LIFO_COST'
}

export interface SetupCostInput {
  productId: string;
  quantity: number;
  tenantId: string;
}

export interface SetupCostResult {
  fixedSetupCost: number;
  setupCostPerUnit: number;
  setupTimeHours: number;
  setupLaborRate: number;
}
