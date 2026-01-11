/**
 * Imposition Engine - Core Differentiator for AgogSaaS
 *
 * Sheet optimization algorithms for ALL packaging types:
 * - Corrugated: Die layout optimization (complex shapes)
 * - Commercial: Sheet optimization (rectangular layouts)
 * - Labels: Web roll optimization (continuous)
 * - Flexible: Rotogravure cylinder optimization (repeat patterns)
 *
 * This is what sets us apart from competitors.
 * Integrates with material_consumption tracking for closed-loop waste reduction.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

interface ImpositionInput {
  designWidth: number;
  designHeight: number;
  bleed: number;
  pressId: string;
  quantity: number;
  packagingType: 'CORRUGATED' | 'COMMERCIAL' | 'LABELS' | 'FLEXIBLE';
  grainDirection?: 'LONG' | 'SHORT' | 'IRRELEVANT';
  grainPreference?: 'WITH_GRAIN' | 'AGAINST_GRAIN' | 'EITHER';
}

interface PressSpecifications {
  sheetWidth: number;
  sheetHeight: number;
  gripperMargin: number;
  sideMargins: number;
  gutter: number;
  pressType: 'sheetfed' | 'web' | 'digital';
}

interface ImpositionLayout {
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  across: number;
  down: number;
  unitsPerSheet: number;
  sheetsNeeded: number;
  wastePercentage: number;
  expectedMaterialWeight: number;
  expectedMaterialArea: number;
  layoutPattern: 'GRID' | 'WORK_AND_TURN' | 'WORK_AND_TUMBLE';
  alternativeLayouts?: ImpositionLayout[];
}

@Injectable()
export class ImpositionEngineService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  /**
   * MAIN ENTRY POINT - Calculate optimal imposition layout
   */
  async calculateImposition(input: ImpositionInput): Promise<ImpositionLayout> {
    // Get press specifications
    const press = await this.getPressSpecifications(input.pressId);

    // Route to packaging-specific algorithm
    switch (input.packagingType) {
      case 'CORRUGATED':
        return this.calculateCorrugatedImposition(input, press);
      case 'COMMERCIAL':
        return this.calculateCommercialImposition(input, press);
      case 'LABELS':
        return this.calculateLabelsImposition(input, press);
      case 'FLEXIBLE':
        return this.calculateFlexibleImposition(input, press);
      default:
        throw new Error(`Unsupported packaging type: ${input.packagingType}`);
    }
  }

  /**
   * COMMERCIAL PRINTING - Rectangular sheet optimization (simplest)
   * Used for: Brochures, flyers, business cards, postcards
   */
  private calculateCommercialImposition(
    input: ImpositionInput,
    press: PressSpecifications
  ): ImpositionLayout {
    const startTime = Date.now();

    // Calculate usable area (account for gripper and margins)
    const usableWidth = press.sheetWidth - press.gripperMargin - (2 * press.sideMargins);
    const usableHeight = press.sheetHeight - press.gripperMargin - (2 * press.sideMargins);

    // Design dimensions with bleed
    const designWithBleedWidth = input.designWidth + (2 * input.bleed);
    const designWithBleedHeight = input.designHeight + (2 * input.bleed);

    // Try portrait orientation
    const acrossPortrait = Math.floor(
      (usableWidth + press.gutter) / (designWithBleedWidth + press.gutter)
    );
    const downPortrait = Math.floor(
      (usableHeight + press.gutter) / (designWithBleedHeight + press.gutter)
    );
    const countPortrait = acrossPortrait * downPortrait;

    // Try landscape orientation
    const acrossLandscape = Math.floor(
      (usableWidth + press.gutter) / (designWithBleedHeight + press.gutter)
    );
    const downLandscape = Math.floor(
      (usableHeight + press.gutter) / (designWithBleedWidth + press.gutter)
    );
    const countLandscape = acrossLandscape * downLandscape;

    // Apply grain direction constraints
    let orientation: 'PORTRAIT' | 'LANDSCAPE';
    let across: number;
    let down: number;
    let unitsPerSheet: number;

    if (input.grainPreference === 'WITH_GRAIN' && input.grainDirection === 'LONG') {
      // Force landscape to align with grain
      orientation = 'LANDSCAPE';
      across = acrossLandscape;
      down = downLandscape;
      unitsPerSheet = countLandscape;
    } else if (input.grainPreference === 'WITH_GRAIN' && input.grainDirection === 'SHORT') {
      // Force portrait to align with grain
      orientation = 'PORTRAIT';
      across = acrossPortrait;
      down = downPortrait;
      unitsPerSheet = countPortrait;
    } else {
      // Choose orientation with most units per sheet
      if (countPortrait >= countLandscape) {
        orientation = 'PORTRAIT';
        across = acrossPortrait;
        down = downPortrait;
        unitsPerSheet = countPortrait;
      } else {
        orientation = 'LANDSCAPE';
        across = acrossLandscape;
        down = downLandscape;
        unitsPerSheet = countLandscape;
      }
    }

    // Calculate waste
    const totalSheetArea = press.sheetWidth * press.sheetHeight;
    const designArea = input.designWidth * input.designHeight;
    const usedArea = unitsPerSheet * designArea;
    const wastePercentage = ((totalSheetArea - usedArea) / totalSheetArea) * 100;

    // Calculate sheets needed (with industry standard 10% overs)
    const quantityWithOvers = input.quantity * 1.10;
    const sheetsNeeded = Math.ceil(quantityWithOvers / unitsPerSheet);

    // Material estimation (assume standard 80lb text weight for now)
    const sheetWeightLbs = (totalSheetArea / 144) * (80 / 500) * 20; // Simplified
    const expectedMaterialWeight = sheetsNeeded * sheetWeightLbs;
    const expectedMaterialArea = sheetsNeeded * totalSheetArea;

    const calculationTimeMs = Date.now() - startTime;

    console.log(`[Imposition] Commercial layout calculated in ${calculationTimeMs}ms:`);
    console.log(`  Design: ${input.designWidth}" × ${input.designHeight}"`);
    console.log(`  Sheet: ${press.sheetWidth}" × ${press.sheetHeight}"`);
    console.log(`  Layout: ${across} across × ${down} down = ${unitsPerSheet} per sheet`);
    console.log(`  Waste: ${wastePercentage.toFixed(2)}%`);
    console.log(`  Sheets needed: ${sheetsNeeded} for ${input.quantity} units`);

    return {
      orientation,
      across,
      down,
      unitsPerSheet,
      sheetsNeeded,
      wastePercentage,
      expectedMaterialWeight,
      expectedMaterialArea,
      layoutPattern: 'GRID',
    };
  }

  /**
   * CORRUGATED - Die layout optimization (complex shapes, not rectangles)
   * Used for: Boxes, displays, cartons with die-cut shapes
   *
   * More complex than commercial because:
   * - Non-rectangular shapes (custom die designs)
   * - Flute direction matters (affects crush strength)
   * - Nesting algorithms to minimize waste
   */
  private calculateCorrugatedImposition(
    input: ImpositionInput,
    press: PressSpecifications
  ): ImpositionLayout {
    // For MVP: Use simplified rectangular bounding box approach
    // TODO Phase 2: Implement true polygon nesting algorithms

    console.log('[Imposition] Corrugated layout - using rectangular bounding box (Phase 1)');

    // Use commercial algorithm as starting point
    const baseLayout = this.calculateCommercialImposition(input, press);

    // Adjust for flute direction constraints
    // Corrugated must run with flute direction perpendicular to press direction
    // This affects orientation choice

    return {
      ...baseLayout,
      layoutPattern: 'GRID', // For now, will add CUT_AND_STACK in Phase 2
    };
  }

  /**
   * LABELS - Web roll optimization (continuous, not sheets)
   * Used for: Product labels, shipping labels, stickers
   *
   * Different from sheet-fed because:
   * - Continuous web (roll), not discrete sheets
   * - Multiple labels across web width
   * - Repeat length matters (waste between repeats)
   * - Web tension affects registration
   */
  private calculateLabelsImposition(
    input: ImpositionInput,
    press: PressSpecifications
  ): ImpositionLayout {
    console.log('[Imposition] Labels layout - web roll optimization');

    // For web presses, "sheet" is actually one repeat length
    const webWidth = press.sheetWidth; // Web width
    const repeatLength = press.sheetHeight; // One repeat cycle

    // Labels across web (limited by web width)
    const labelsAcrossWeb = Math.floor(
      (webWidth - 2 * press.sideMargins + press.gutter) /
      (input.designWidth + 2 * input.bleed + press.gutter)
    );

    // Labels down repeat (multiple rows in one repeat)
    const labelsDownRepeat = Math.floor(
      (repeatLength + press.gutter) /
      (input.designHeight + 2 * input.bleed + press.gutter)
    );

    const labelsPerRepeat = labelsAcrossWeb * labelsDownRepeat;

    // Calculate repeats needed
    const repeatsNeeded = Math.ceil(input.quantity * 1.10 / labelsPerRepeat);

    // Material usage (linear feet of web)
    const totalWebLengthFeet = (repeatsNeeded * repeatLength) / 12;
    const webAreaSqFt = (webWidth / 12) * totalWebLengthFeet;

    // Waste calculation
    const labelArea = input.designWidth * input.designHeight;
    const usedArea = input.quantity * labelArea;
    const totalArea = webAreaSqFt * 144; // Convert to sq in
    const wastePercentage = ((totalArea - usedArea) / totalArea) * 100;

    console.log(`  Web width: ${webWidth}"`);
    console.log(`  Labels across: ${labelsAcrossWeb}`);
    console.log(`  Labels per repeat: ${labelsPerRepeat}`);
    console.log(`  Repeats needed: ${repeatsNeeded}`);
    console.log(`  Total web length: ${totalWebLengthFeet.toFixed(2)} ft`);

    return {
      orientation: 'PORTRAIT', // Not really applicable for web, but required field
      across: labelsAcrossWeb,
      down: labelsDownRepeat,
      unitsPerSheet: labelsPerRepeat,
      sheetsNeeded: repeatsNeeded,
      wastePercentage,
      expectedMaterialWeight: webAreaSqFt * 2.5, // Assume label stock weight
      expectedMaterialArea: webAreaSqFt,
      layoutPattern: 'GRID',
    };
  }

  /**
   * FLEXIBLE PACKAGING - Rotogravure cylinder optimization
   * Used for: Bags, pouches, wrappers (potato chip bags, candy wrappers)
   *
   * Most complex because:
   * - Cylinder circumference dictates repeat pattern
   * - Multiple colors (separate cylinders per color)
   * - Register marks critical (multi-color alignment)
   * - Seam allowances required
   */
  private calculateFlexibleImposition(
    input: ImpositionInput,
    press: PressSpecifications
  ): ImpositionLayout {
    console.log('[Imposition] Flexible packaging - rotogravure optimization');

    // For MVP: Simplified web-based calculation
    // TODO Phase 2: Add cylinder circumference constraints

    // Use labels algorithm as base (both are web-based)
    const baseLayout = this.calculateLabelsImposition(input, press);

    // Adjust for seam allowances (flexible packaging needs seal edges)
    const seamAllowance = 0.5; // inches
    // Reduce across count to account for seam

    return {
      ...baseLayout,
      // Will add cylinder-specific logic in Phase 2
    };
  }

  /**
   * Get press specifications from database
   */
  private async getPressSpecifications(pressId: string): Promise<PressSpecifications> {
    const result = await this.pool.query(
      `SELECT
        max_sheet_width,
        max_sheet_height,
        gripper_margin,
        side_margins,
        gutter,
        press_type
       FROM work_centers
       WHERE id = $1`,
      [pressId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Press not found: ${pressId}`);
    }

    const press = result.rows[0];

    return {
      sheetWidth: parseFloat(press.max_sheet_width) || 40,
      sheetHeight: parseFloat(press.max_sheet_height) || 28,
      gripperMargin: parseFloat(press.gripper_margin) || 0.5,
      sideMargins: parseFloat(press.side_margins) || 0.25,
      gutter: parseFloat(press.gutter) || 0.25,
      pressType: press.press_type || 'sheetfed',
    };
  }

  /**
   * Save imposition layout to database
   */
  async saveImpositionLayout(
    tenantId: string,
    salesOrderLineId: string,
    input: ImpositionInput,
    layout: ImpositionLayout
  ): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO imposition_layouts (
        tenant_id,
        sales_order_line_id,
        design_width,
        design_height,
        bleed,
        press_id,
        packaging_type,
        orientation,
        across,
        down,
        units_per_sheet,
        sheets_needed,
        waste_percentage,
        expected_material_area,
        expected_material_weight,
        layout_pattern,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'CALCULATED')
      RETURNING id`,
      [
        tenantId,
        salesOrderLineId,
        input.designWidth,
        input.designHeight,
        input.bleed,
        input.pressId,
        input.packagingType,
        layout.orientation,
        layout.across,
        layout.down,
        layout.unitsPerSheet,
        layout.sheetsNeeded,
        layout.wastePercentage,
        layout.expectedMaterialArea,
        layout.expectedMaterialWeight,
        layout.layoutPattern,
      ]
    );

    const layoutId = result.rows[0].id;
    console.log(`[Imposition] Layout saved: ${layoutId}`);

    return layoutId;
  }
}
