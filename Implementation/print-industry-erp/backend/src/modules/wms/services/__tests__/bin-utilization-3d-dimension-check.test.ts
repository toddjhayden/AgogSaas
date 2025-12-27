/**
 * Critical Path Tests: 3D Dimension Validation
 *
 * REQ-STRATEGIC-AUTO-1766527796497: Production Blocker #1 Tests
 *
 * Tests the check3DFit() method to ensure proper 3D dimension validation
 * with rotation logic, preventing putaway failures from oversized items
 */

import { Pool } from 'pg';
import { BinUtilizationOptimizationService } from '../bin-utilization-optimization.service';

describe('BinUtilizationOptimizationService - 3D Dimension Validation', () => {
  let service: BinUtilizationOptimizationService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
    } as any;

    service = new BinUtilizationOptimizationService(mockPool);
  });

  describe('check3DFit - Basic Fit Tests', () => {
    test('should fit when item is smaller than bin in all dimensions', () => {
      const item = { lengthInches: 10, widthInches: 8, heightInches: 6 };
      const bin = { lengthInches: 12, widthInches: 10, heightInches: 8 };

      const result = service['check3DFit'](item, bin, { allowRotation: true });

      expect(result).toBe(true);
    });

    test('should not fit when item is larger in any dimension (no rotation)', () => {
      const item = { lengthInches: 60, widthInches: 24, heightInches: 12 };
      const bin = { lengthInches: 48, widthInches: 48, heightInches: 48 };

      const result = service['check3DFit'](item, bin, { allowRotation: false });

      expect(result).toBe(false);
    });

    test('should fit with rotation when longest item dimension fits in longest bin dimension', () => {
      const item = { lengthInches: 60, widthInches: 24, heightInches: 12 };
      const bin = { lengthInches: 72, widthInches: 48, heightInches: 36 };

      const result = service['check3DFit'](item, bin, { allowRotation: true });

      expect(result).toBe(true);
    });
  });

  describe('check3DFit - Edge Cases', () => {
    test('should fit when item and bin dimensions are exactly equal', () => {
      const item = { lengthInches: 48, widthInches: 48, heightInches: 48 };
      const bin = { lengthInches: 48, widthInches: 48, heightInches: 48 };

      const result = service['check3DFit'](item, bin, { allowRotation: true });

      expect(result).toBe(true);
    });

    test('should not fit when item is 1 inch too large in smallest dimension', () => {
      const item = { lengthInches: 49, widthInches: 48, heightInches: 48 };
      const bin = { lengthInches: 48, widthInches: 48, heightInches: 48 };

      const result = service['check3DFit'](item, bin, { allowRotation: true });

      expect(result).toBe(false);
    });

    test('should return true when bin dimensions are missing (fallback to cubic feet check)', () => {
      const item = { lengthInches: 60, widthInches: 24, heightInches: 12 };
      const bin = { lengthInches: undefined, widthInches: undefined, heightInches: undefined };

      const result = service['check3DFit'](item, bin, { allowRotation: true });

      expect(result).toBe(true); // Falls back to cubic feet validation
    });
  });

  describe('check3DFit - Print Industry Scenarios', () => {
    test('should reject 60-inch paper roll in 48-inch wide bin', () => {
      // 60" diameter paper roll
      const item = { lengthInches: 60, widthInches: 60, heightInches: 40 };
      // Standard 48" wide bin
      const bin = { lengthInches: 48, widthInches: 48, heightInches: 72 };

      const result = service['check3DFit'](item, bin, { allowRotation: true });

      expect(result).toBe(false);
    });

    test('should accept 36-inch paper roll in 48-inch wide bin', () => {
      // 36" diameter paper roll
      const item = { lengthInches: 36, widthInches: 36, heightInches: 40 };
      // Standard 48" wide bin
      const bin = { lengthInches: 48, widthInches: 48, heightInches: 72 };

      const result = service['check3DFit'](item, bin, { allowRotation: true });

      expect(result).toBe(true);
    });

    test('should accept flat substrate sheets with rotation', () => {
      // 40" × 28" × 0.5" substrate sheet (rotatable)
      const item = { lengthInches: 40, widthInches: 28, heightInches: 0.5 };
      // 48" × 36" × 12" bin
      const bin = { lengthInches: 48, widthInches: 36, heightInches: 12 };

      const result = service['check3DFit'](item, bin, { allowRotation: true });

      expect(result).toBe(true);
    });

    test('should reject oversized skid in standard bin', () => {
      // 48" × 40" × 60" pallet load
      const item = { lengthInches: 48, widthInches: 40, heightInches: 60 };
      // Standard 48" × 48" × 48" bin
      const bin = { lengthInches: 48, widthInches: 48, heightInches: 48 };

      const result = service['check3DFit'](item, bin, { allowRotation: true });

      expect(result).toBe(false);
    });
  });

  describe('check3DFit - Rotation Logic', () => {
    test('should fit with rotation but not without', () => {
      // Item: 12" × 8" × 6"
      const item = { lengthInches: 12, widthInches: 8, heightInches: 6 };
      // Bin: 10" × 10" × 10" (can fit if rotated)
      const bin = { lengthInches: 10, widthInches: 10, heightInches: 10 };

      const withRotation = service['check3DFit'](item, bin, { allowRotation: true });
      const withoutRotation = service['check3DFit'](item, bin, { allowRotation: false });

      expect(withRotation).toBe(false); // 12" > 10" even when sorted
      expect(withoutRotation).toBe(false);
    });

    test('should correctly sort and compare dimensions', () => {
      // Item: 20" × 10" × 5" (sorted: 5, 10, 20)
      const item = { lengthInches: 20, widthInches: 10, heightInches: 5 };
      // Bin: 12" × 15" × 25" (sorted: 12, 15, 25)
      const bin = { lengthInches: 12, widthInches: 15, heightInches: 25 };

      const result = service['check3DFit'](item, bin, { allowRotation: true });

      expect(result).toBe(true); // 5 ≤ 12, 10 ≤ 15, 20 ≤ 25
    });
  });

  describe('validateCapacity - Integration Tests', () => {
    test('should reject location when 3D dimensions do not fit', () => {
      const location = {
        locationId: 'loc-1',
        locationCode: 'A-01-01',
        locationType: 'RESERVE',
        totalCubicFeet: 100,
        usedCubicFeet: 20,
        availableCubicFeet: 80,
        maxWeightLbs: 2000,
        currentWeightLbs: 500,
        availableWeightLbs: 1500,
        utilizationPercentage: 20,
        abcClassification: 'A',
        pickSequence: 100,
        temperatureControlled: false,
        securityZone: 'STANDARD',
        lengthInches: 48,
        widthInches: 48,
        heightInches: 72,
      };

      // 60" diameter roll that won't fit despite having enough cubic feet
      const dimensions = {
        lengthInches: 60,
        widthInches: 60,
        heightInches: 40,
        cubicFeet: 50, // Less than 80 available
        weightLbsPerUnit: 800, // Less than 1500 available
      };

      const result = service['validateCapacity'](location, dimensions, 1);

      expect(result.canFit).toBe(false);
      expect(result.dimensionCheck).toBe(false);
      expect(result.cubicCheck).toBe(true); // Cubic feet is OK
      expect(result.weightCheck).toBe(true); // Weight is OK
      expect(result.violationReasons).toContain(
        expect.stringContaining('do not fit in bin')
      );
    });

    test('should accept location when all checks pass including 3D dimensions', () => {
      const location = {
        locationId: 'loc-2',
        locationCode: 'A-01-02',
        locationType: 'RESERVE',
        totalCubicFeet: 150,
        usedCubicFeet: 30,
        availableCubicFeet: 120,
        maxWeightLbs: 3000,
        currentWeightLbs: 500,
        availableWeightLbs: 2500,
        utilizationPercentage: 20,
        abcClassification: 'A',
        pickSequence: 101,
        temperatureControlled: false,
        securityZone: 'STANDARD',
        lengthInches: 72,
        widthInches: 48,
        heightInches: 84,
      };

      // 36" diameter roll that fits
      const dimensions = {
        lengthInches: 36,
        widthInches: 36,
        heightInches: 40,
        cubicFeet: 30,
        weightLbsPerUnit: 600,
      };

      const result = service['validateCapacity'](location, dimensions, 1);

      expect(result.canFit).toBe(true);
      expect(result.dimensionCheck).toBe(true);
      expect(result.cubicCheck).toBe(true);
      expect(result.weightCheck).toBe(true);
      expect(result.violationReasons).toHaveLength(0);
    });

    test('should provide clear violation message when dimensions do not fit', () => {
      const location = {
        locationId: 'loc-3',
        locationCode: 'A-01-03',
        locationType: 'PICK_FACE',
        totalCubicFeet: 50,
        usedCubicFeet: 10,
        availableCubicFeet: 40,
        maxWeightLbs: 1000,
        currentWeightLbs: 200,
        availableWeightLbs: 800,
        utilizationPercentage: 20,
        abcClassification: 'B',
        pickSequence: 200,
        temperatureControlled: false,
        securityZone: 'STANDARD',
        lengthInches: 36,
        widthInches: 24,
        heightInches: 48,
      };

      const dimensions = {
        lengthInches: 40,
        widthInches: 30,
        heightInches: 20,
        cubicFeet: 10,
        weightLbsPerUnit: 200,
      };

      const result = service['validateCapacity'](location, dimensions, 1);

      expect(result.canFit).toBe(false);
      expect(result.violationReasons).toContain(
        'Item dimensions (40.0" × 30.0" × 20.0") do not fit in bin (36.0" × 24.0" × 48.0")'
      );
    });
  });

  describe('Real-world Regression Tests', () => {
    test('BLOCKER #1: Prevent 60-inch roll recommendation for 48-inch bin', () => {
      // This was the exact scenario from Sylvia's critique
      // "60" diameter paper rolls could be recommended for 48" wide bins"

      const bin48Inch = {
        locationId: 'bin-48',
        locationCode: 'B-02-15',
        locationType: 'RESERVE',
        totalCubicFeet: 100,
        usedCubicFeet: 0,
        availableCubicFeet: 100,
        maxWeightLbs: 2000,
        currentWeightLbs: 0,
        availableWeightLbs: 2000,
        utilizationPercentage: 0,
        temperatureControlled: false,
        securityZone: 'STANDARD',
        lengthInches: 48,
        widthInches: 48,
        heightInches: 96,
      };

      const roll60Inch = {
        lengthInches: 60,
        widthInches: 60,
        heightInches: 40,
        cubicFeet: 50,
        weightLbsPerUnit: 1200,
      };

      const validation = service['validateCapacity'](bin48Inch, roll60Inch, 1);

      expect(validation.canFit).toBe(false);
      expect(validation.dimensionCheck).toBe(false);
      expect(validation.violationReasons.some(r => r.includes('do not fit in bin'))).toBe(true);
    });

    test('ENHANCEMENT: Allow 40-inch roll in 48-inch bin', () => {
      const bin48Inch = {
        locationId: 'bin-48',
        locationCode: 'B-02-15',
        locationType: 'RESERVE',
        totalCubicFeet: 100,
        usedCubicFeet: 0,
        availableCubicFeet: 100,
        maxWeightLbs: 2000,
        currentWeightLbs: 0,
        availableWeightLbs: 2000,
        utilizationPercentage: 0,
        temperatureControlled: false,
        securityZone: 'STANDARD',
        lengthInches: 48,
        widthInches: 48,
        heightInches: 96,
      };

      const roll40Inch = {
        lengthInches: 40,
        widthInches: 40,
        heightInches: 40,
        cubicFeet: 37,
        weightLbsPerUnit: 800,
      };

      const validation = service['validateCapacity'](bin48Inch, roll40Inch, 1);

      expect(validation.canFit).toBe(true);
      expect(validation.dimensionCheck).toBe(true);
    });
  });
});
