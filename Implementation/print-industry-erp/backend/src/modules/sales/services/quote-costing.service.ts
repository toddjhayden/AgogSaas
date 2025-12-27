/**
 * Quote Costing Service
 * REQ-STRATEGIC-AUTO-1735125600000: Sales Quote Automation
 *
 * Calculates product costs using BOM explosion, material costing, and setup cost
 * amortization. Supports multiple costing methods (FIFO, LIFO, AVERAGE, STANDARD).
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import {
  CostCalculationInput,
  CostCalculationResult,
  CostMethod,
  CostComponent,
  BOMExplosionInput,
  BOMExplosionResult,
  BOMLevel,
  BOMComponent,
  MaterialRequirement,
  MaterialCostInput,
  MaterialCostResult,
  MaterialCostSource,
  SetupCostInput,
  SetupCostResult
} from '../interfaces/quote-costing.interface';

@Injectable()
export class QuoteCostingService {
  private readonly MAX_BOM_DEPTH = 5; // Prevent infinite loops
  private readonly DEFAULT_SETUP_HOURS = 1; // Default setup time
  private readonly DEFAULT_LABOR_RATE = 50; // Default labor rate per hour

  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * Calculate total cost for a product including BOM explosion and setup costs
   */
  async calculateProductCost(input: CostCalculationInput): Promise<CostCalculationResult> {
    const asOfDate = input.asOfDate || new Date();

    // First, try to get standard cost from product table
    const productResult = await this.db.query(
      `SELECT
        product_code,
        product_name,
        standard_material_cost,
        standard_labor_cost,
        standard_overhead_cost,
        standard_total_cost,
        standard_production_time_hours
      FROM products
      WHERE id = $1 AND tenant_id = $2 AND is_current_version = true`,
      [input.productId, input.tenantId]
    );

    if (productResult.rows.length === 0) {
      throw new Error(`Product ${input.productId} not found`);
    }

    const product = productResult.rows[0];

    // Check if product has standard costs defined
    const hasStandardCost = product.standard_total_cost !== null;

    let costResult: CostCalculationResult;

    if (hasStandardCost && !this.shouldUseBOMExplosion(input.productId)) {
      // Use standard cost (faster, simpler)
      const materialCost = parseFloat(product.standard_material_cost) || 0;
      const laborCost = parseFloat(product.standard_labor_cost) || 0;
      const overheadCost = parseFloat(product.standard_overhead_cost) || 0;
      const unitCost = parseFloat(product.standard_total_cost) || 0;

      // Calculate setup cost
      const setupCost = await this.calculateSetupCost({
        productId: input.productId,
        quantity: input.quantity,
        tenantId: input.tenantId
      });

      costResult = {
        unitCost: unitCost + setupCost.setupCostPerUnit,
        totalCost: (unitCost * input.quantity) + setupCost.fixedSetupCost,
        materialCost: materialCost * input.quantity,
        laborCost: laborCost * input.quantity,
        overheadCost: overheadCost * input.quantity,
        setupCost: setupCost.fixedSetupCost,
        setupCostPerUnit: setupCost.setupCostPerUnit,
        costBreakdown: [
          {
            componentType: 'Material',
            componentId: input.productId,
            componentCode: product.product_code,
            componentName: product.product_name,
            quantity: input.quantity,
            unitOfMeasure: 'EA',
            unitCost: materialCost,
            totalCost: materialCost * input.quantity,
            scrapPercentage: 0
          }
        ],
        costMethod: CostMethod.STANDARD_COST
      };
    } else {
      // Use BOM explosion for detailed costing
      const bomExplosion = await this.explodeBOM({
        productId: input.productId,
        quantity: input.quantity,
        tenantId: input.tenantId,
        maxDepth: this.MAX_BOM_DEPTH
      });

      const setupCost = await this.calculateSetupCost({
        productId: input.productId,
        quantity: input.quantity,
        tenantId: input.tenantId
      });

      const materialCost = bomExplosion.totalMaterialRequirements.reduce(
        (sum, req) => sum + req.totalCost,
        0
      );

      const laborCost = parseFloat(product.standard_labor_cost) * input.quantity || 0;
      const overheadCost = parseFloat(product.standard_overhead_cost) * input.quantity || 0;

      const totalCost = materialCost + laborCost + overheadCost + setupCost.fixedSetupCost;
      const unitCost = totalCost / input.quantity;

      costResult = {
        unitCost,
        totalCost,
        materialCost,
        laborCost,
        overheadCost,
        setupCost: setupCost.fixedSetupCost,
        setupCostPerUnit: setupCost.setupCostPerUnit,
        costBreakdown: this.buildCostBreakdown(bomExplosion),
        bomExplosion,
        costMethod: CostMethod.BOM_EXPLOSION
      };
    }

    return costResult;
  }

  /**
   * Explode BOM to get all material requirements
   */
  async explodeBOM(input: BOMExplosionInput): Promise<BOMExplosionResult> {
    const maxDepth = Math.min(input.maxDepth || this.MAX_BOM_DEPTH, this.MAX_BOM_DEPTH);

    const productResult = await this.db.query(
      `SELECT product_code, product_name FROM products WHERE id = $1 AND tenant_id = $2`,
      [input.productId, input.tenantId]
    );

    if (productResult.rows.length === 0) {
      throw new Error(`Product ${input.productId} not found`);
    }

    const product = productResult.rows[0];

    const levels: BOMLevel[] = [];
    const materialRequirements = new Map<string, MaterialRequirement>();

    await this.explodeBOMRecursive(
      input.productId,
      input.quantity,
      input.tenantId,
      1,
      maxDepth,
      levels,
      materialRequirements
    );

    return {
      productId: input.productId,
      productCode: product.product_code,
      productName: product.product_name,
      quantity: input.quantity,
      levels,
      totalMaterialRequirements: Array.from(materialRequirements.values()),
      explosionDepth: levels.length
    };
  }

  /**
   * Recursive BOM explosion with depth limiting
   */
  private async explodeBOMRecursive(
    productId: string,
    quantity: number,
    tenantId: string,
    currentDepth: number,
    maxDepth: number,
    levels: BOMLevel[],
    materialRequirements: Map<string, MaterialRequirement>
  ): Promise<void> {
    if (currentDepth > maxDepth) {
      return; // Prevent infinite recursion
    }

    // Get BOM components for this product
    const bomQuery = `
      SELECT
        bom.id,
        bom.component_material_id,
        bom.quantity_per_parent,
        bom.unit_of_measure,
        bom.scrap_percentage,
        m.material_code,
        m.material_name,
        m.material_type,
        m.standard_cost,
        m.costing_method
      FROM bill_of_materials bom
      JOIN materials m ON m.id = bom.component_material_id
      WHERE bom.parent_product_id = $1
        AND bom.tenant_id = $2
        AND bom.is_active = true
      ORDER BY bom.sequence_number
    `;

    const bomResult = await this.db.query(bomQuery, [productId, tenantId]);

    if (bomResult.rows.length === 0) {
      return; // No BOM components
    }

    const levelComponents: BOMComponent[] = [];

    for (const row of bomResult.rows) {
      const scrapPercentage = parseFloat(row.scrap_percentage) || 0;
      const scrapMultiplier = 1 + (scrapPercentage / 100);
      const quantityWithScrap = parseFloat(row.quantity_per_parent) * quantity * scrapMultiplier;

      const materialCost = await this.getMaterialCost({
        materialId: row.component_material_id,
        quantity: quantityWithScrap,
        tenantId
      });

      const component: BOMComponent = {
        componentMaterialId: row.component_material_id,
        componentCode: row.material_code,
        componentName: row.material_name,
        componentType: row.material_type,
        quantityPerParent: parseFloat(row.quantity_per_parent),
        scrapPercentage,
        totalQuantityRequired: quantityWithScrap,
        unitOfMeasure: row.unit_of_measure,
        unitCost: materialCost.unitCost,
        totalCost: materialCost.totalCost,
        hasNestedBOM: false // Will check later
      };

      levelComponents.push(component);

      // Add to total material requirements
      const existingReq = materialRequirements.get(row.component_material_id);
      if (existingReq) {
        existingReq.totalQuantity += quantityWithScrap;
        existingReq.totalCost += materialCost.totalCost;
      } else {
        materialRequirements.set(row.component_material_id, {
          materialId: row.component_material_id,
          materialCode: row.material_code,
          materialName: row.material_name,
          totalQuantity: quantityWithScrap,
          unitOfMeasure: row.unit_of_measure,
          unitCost: materialCost.unitCost,
          totalCost: materialCost.totalCost,
          costingMethod: row.costing_method
        });
      }

      // Check if this material is also a product with its own BOM (nested BOM)
      const nestedBOMCheck = await this.db.query(
        `SELECT COUNT(*) as count FROM bill_of_materials
         WHERE parent_product_id = $1 AND tenant_id = $2 AND is_active = true`,
        [row.component_material_id, tenantId]
      );

      if (parseInt(nestedBOMCheck.rows[0].count) > 0) {
        component.hasNestedBOM = true;
        // Recursively explode nested BOM
        await this.explodeBOMRecursive(
          row.component_material_id,
          quantityWithScrap,
          tenantId,
          currentDepth + 1,
          maxDepth,
          levels,
          materialRequirements
        );
      }
    }

    // Add this level to levels array
    const existingLevel = levels.find(l => l.level === currentDepth);
    if (existingLevel) {
      existingLevel.components.push(...levelComponents);
    } else {
      levels.push({
        level: currentDepth,
        components: levelComponents
      });
    }
  }

  /**
   * Get material cost using configured costing method
   */
  async getMaterialCost(input: MaterialCostInput): Promise<MaterialCostResult> {
    const materialQuery = `
      SELECT
        material_code,
        standard_cost,
        average_cost,
        last_cost,
        costing_method
      FROM materials
      WHERE id = $1 AND tenant_id = $2 AND is_current_version = true
    `;

    const result = await this.db.query(materialQuery, [input.materialId, input.tenantId]);

    if (result.rows.length === 0) {
      throw new Error(`Material ${input.materialId} not found`);
    }

    const material = result.rows[0];
    const costingMethod = material.costing_method;

    let unitCost: number;
    let costSource: MaterialCostSource;

    switch (costingMethod) {
      case 'STANDARD':
        unitCost = parseFloat(material.standard_cost) || 0;
        costSource = MaterialCostSource.STANDARD_COST;
        break;
      case 'AVERAGE':
        unitCost = parseFloat(material.average_cost) || parseFloat(material.standard_cost) || 0;
        costSource = MaterialCostSource.AVERAGE_COST;
        break;
      case 'FIFO':
      case 'LIFO':
        // For now, fall back to standard cost
        // In production, would query inventory transactions
        unitCost = parseFloat(material.standard_cost) || 0;
        costSource = MaterialCostSource.STANDARD_COST;
        break;
      default:
        unitCost = parseFloat(material.standard_cost) || 0;
        costSource = MaterialCostSource.STANDARD_COST;
    }

    return {
      materialId: input.materialId,
      materialCode: material.material_code,
      unitCost,
      totalCost: unitCost * input.quantity,
      costingMethod,
      costSource
    };
  }

  /**
   * Calculate setup cost amortized across quantity
   */
  async calculateSetupCost(input: SetupCostInput): Promise<SetupCostResult> {
    const productQuery = `
      SELECT standard_production_time_hours
      FROM products
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.db.query(productQuery, [input.productId, input.tenantId]);

    const setupTimeHours = result.rows.length > 0
      ? parseFloat(result.rows[0].standard_production_time_hours) || this.DEFAULT_SETUP_HOURS
      : this.DEFAULT_SETUP_HOURS;

    const setupLaborRate = this.DEFAULT_LABOR_RATE;
    const fixedSetupCost = setupTimeHours * setupLaborRate;
    const setupCostPerUnit = fixedSetupCost / input.quantity;

    return {
      fixedSetupCost,
      setupCostPerUnit,
      setupTimeHours,
      setupLaborRate
    };
  }

  /**
   * Determine if BOM explosion should be used instead of standard cost
   */
  private async shouldUseBOMExplosion(productId: string): Promise<boolean> {
    // Always use BOM explosion for now
    // In production, could check a flag on the product or product category
    return false; // Use standard cost by default for performance
  }

  /**
   * Build cost breakdown from BOM explosion
   */
  private buildCostBreakdown(bomExplosion: BOMExplosionResult): CostComponent[] {
    const breakdown: CostComponent[] = [];

    for (const level of bomExplosion.levels) {
      for (const component of level.components) {
        breakdown.push({
          componentType: component.componentType,
          componentId: component.componentMaterialId,
          componentCode: component.componentCode,
          componentName: component.componentName,
          quantity: component.totalQuantityRequired,
          unitOfMeasure: component.unitOfMeasure,
          unitCost: component.unitCost,
          totalCost: component.totalCost,
          scrapPercentage: component.scrapPercentage
        });
      }
    }

    return breakdown;
  }
}
