/**
 * Imposition Engine GraphQL API
 *
 * Exposes imposition calculation for sales quoting and production planning.
 * This is the competitive differentiator - accurate material estimation.
 */

import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { ImpositionEngineService } from './imposition-engine.service';

@Resolver()
export class ImpositionResolver {
  constructor(private impositionEngine: ImpositionEngineService) {}

  /**
   * Calculate imposition layout
   * Used during quoting to estimate material usage accurately
   */
  @Mutation(() => ImpositionLayoutType)
  async calculateImposition(
    @Args('input') input: CalculateImpositionInput
  ): Promise<ImpositionLayoutType> {
    const layout = await this.impositionEngine.calculateImposition({
      designWidth: input.designWidth,
      designHeight: input.designHeight,
      bleed: input.bleed || 0.125,
      pressId: input.pressId,
      quantity: input.quantity,
      packagingType: input.packagingType,
      grainDirection: input.grainDirection,
      grainPreference: input.grainPreference,
    });

    // Save to database if salesOrderLineId provided
    if (input.salesOrderLineId) {
      await this.impositionEngine.saveImpositionLayout(
        input.tenantId,
        input.salesOrderLineId,
        {
          designWidth: input.designWidth,
          designHeight: input.designHeight,
          bleed: input.bleed || 0.125,
          pressId: input.pressId,
          quantity: input.quantity,
          packagingType: input.packagingType,
        },
        layout
      );
    }

    return layout;
  }

  /**
   * Get saved imposition layouts for a sales order
   */
  @Query(() => [ImpositionLayoutType])
  async impositionLayouts(
    @Args('salesOrderId') salesOrderId: string
  ): Promise<ImpositionLayoutType[]> {
    // Implementation: Query imposition_layouts table
    // Returns all layouts for a sales order
    return [];
  }
}

// ========== GraphQL Types ==========

/**
 * Input for calculating imposition
 */
class CalculateImpositionInput {
  tenantId: string;
  salesOrderLineId?: string;
  designWidth: number;
  designHeight: number;
  bleed?: number;
  pressId: string;
  quantity: number;
  packagingType: 'CORRUGATED' | 'COMMERCIAL' | 'LABELS' | 'FLEXIBLE';
  grainDirection?: 'LONG' | 'SHORT' | 'IRRELEVANT';
  grainPreference?: 'WITH_GRAIN' | 'AGAINST_GRAIN' | 'EITHER';
}

/**
 * Calculated imposition layout
 */
class ImpositionLayoutType {
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  across: number;
  down: number;
  unitsPerSheet: number;
  sheetsNeeded: number;
  wastePercentage: number;
  expectedMaterialWeight: number;
  expectedMaterialArea: number;
  layoutPattern: 'GRID' | 'WORK_AND_TURN' | 'WORK_AND_TUMBLE';
}
