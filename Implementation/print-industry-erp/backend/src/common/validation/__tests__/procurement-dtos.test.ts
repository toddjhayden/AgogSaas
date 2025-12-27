/**
 * UNIT TESTS: Procurement Input Validation
 *
 * Purpose: Test input validation for vendor performance GraphQL mutations
 * Feature: REQ-STRATEGIC-AUTO-1766657618088 - Vendor Scorecards
 * Author: Roy (Backend specialist)
 * Date: 2025-12-25
 *
 * Coverage:
 * - validateCalculatePerformanceInput() - Year/month validation
 * - validateVendorComparisonInput() - Year/month/topN validation
 * - validateUpdatePerformanceScoresInput() - Score range validation
 *
 * Validation Test Scenarios:
 * - ✅ Valid inputs within acceptable ranges
 * - ❌ Invalid types (non-integer, non-number)
 * - ❌ Out of range values (year, month, scores)
 * - ❌ Missing required fields
 */

import { BadRequestException } from '@nestjs/common';
import {
  validateCalculatePerformanceInput,
  validateVendorComparisonInput,
  validateUpdatePerformanceScoresInput,
} from '../procurement-dtos';

describe('Procurement Input Validation', () => {
  describe('validateCalculatePerformanceInput', () => {
    describe('Valid inputs', () => {
      it('should pass for valid year and month', () => {
        expect(() => {
          validateCalculatePerformanceInput({ year: 2024, month: 12 });
        }).not.toThrow();
      });

      it('should pass for minimum valid year (2020)', () => {
        expect(() => {
          validateCalculatePerformanceInput({ year: 2020, month: 1 });
        }).not.toThrow();
      });

      it('should pass for maximum valid year (2100)', () => {
        expect(() => {
          validateCalculatePerformanceInput({ year: 2100, month: 12 });
        }).not.toThrow();
      });

      it('should pass for all valid months (1-12)', () => {
        for (let month = 1; month <= 12; month++) {
          expect(() => {
            validateCalculatePerformanceInput({ year: 2024, month });
          }).not.toThrow();
        }
      });
    });

    describe('Invalid year', () => {
      it('should throw BadRequestException for non-integer year', () => {
        expect(() => {
          validateCalculatePerformanceInput({ year: 2024.5, month: 6 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateCalculatePerformanceInput({ year: 2024.5, month: 6 });
        }).toThrow('Year must be an integer');
      });

      it('should throw BadRequestException for year below 2020', () => {
        expect(() => {
          validateCalculatePerformanceInput({ year: 2019, month: 6 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateCalculatePerformanceInput({ year: 2019, month: 6 });
        }).toThrow('Year must be between 2020 and 2100');
      });

      it('should throw BadRequestException for year above 2100', () => {
        expect(() => {
          validateCalculatePerformanceInput({ year: 2101, month: 6 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateCalculatePerformanceInput({ year: 2101, month: 6 });
        }).toThrow('Year must be between 2020 and 2100');
      });

      it('should throw BadRequestException for invalid year (9999)', () => {
        expect(() => {
          validateCalculatePerformanceInput({ year: 9999, month: 6 });
        }).toThrow('Year must be between 2020 and 2100');
      });
    });

    describe('Invalid month', () => {
      it('should throw BadRequestException for non-integer month', () => {
        expect(() => {
          validateCalculatePerformanceInput({ year: 2024, month: 6.5 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateCalculatePerformanceInput({ year: 2024, month: 6.5 });
        }).toThrow('Month must be an integer');
      });

      it('should throw BadRequestException for month below 1', () => {
        expect(() => {
          validateCalculatePerformanceInput({ year: 2024, month: 0 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateCalculatePerformanceInput({ year: 2024, month: 0 });
        }).toThrow('Month must be between 1 and 12');
      });

      it('should throw BadRequestException for month above 12', () => {
        expect(() => {
          validateCalculatePerformanceInput({ year: 2024, month: 13 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateCalculatePerformanceInput({ year: 2024, month: 13 });
        }).toThrow('Month must be between 1 and 12');
      });

      it('should throw BadRequestException for invalid month (99)', () => {
        expect(() => {
          validateCalculatePerformanceInput({ year: 2024, month: 99 });
        }).toThrow('Month must be between 1 and 12');
      });
    });
  });

  describe('validateVendorComparisonInput', () => {
    describe('Valid inputs', () => {
      it('should pass for valid year, month, and topN', () => {
        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 12, topN: 5 });
        }).not.toThrow();
      });

      it('should pass for minimum topN (1)', () => {
        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 12, topN: 1 });
        }).not.toThrow();
      });

      it('should pass for maximum topN (100)', () => {
        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 12, topN: 100 });
        }).not.toThrow();
      });

      it('should pass when topN is not provided', () => {
        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 12 });
        }).not.toThrow();
      });

      it('should pass when topN is null', () => {
        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 12, topN: null });
        }).not.toThrow();
      });
    });

    describe('Invalid topN', () => {
      it('should throw BadRequestException for non-integer topN', () => {
        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 12, topN: 5.5 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 12, topN: 5.5 });
        }).toThrow('TopN must be an integer');
      });

      it('should throw BadRequestException for topN below 1', () => {
        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 12, topN: 0 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 12, topN: 0 });
        }).toThrow('TopN must be between 1 and 100');
      });

      it('should throw BadRequestException for topN above 100', () => {
        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 12, topN: 101 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 12, topN: 101 });
        }).toThrow('TopN must be between 1 and 100');
      });
    });

    describe('Inherits year/month validation', () => {
      it('should throw for invalid year', () => {
        expect(() => {
          validateVendorComparisonInput({ year: 2019, month: 6, topN: 5 });
        }).toThrow('Year must be between 2020 and 2100');
      });

      it('should throw for invalid month', () => {
        expect(() => {
          validateVendorComparisonInput({ year: 2024, month: 13, topN: 5 });
        }).toThrow('Month must be between 1 and 12');
      });
    });
  });

  describe('validateUpdatePerformanceScoresInput', () => {
    describe('Valid inputs', () => {
      it('should pass for valid price competitiveness score', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({ priceCompetitivenessScore: 4.5 });
        }).not.toThrow();
      });

      it('should pass for valid responsiveness score', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({ responsivenessScore: 3.8 });
        }).not.toThrow();
      });

      it('should pass for both scores', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({
            priceCompetitivenessScore: 4.5,
            responsivenessScore: 3.8,
          });
        }).not.toThrow();
      });

      it('should pass for minimum score (0.0)', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({ priceCompetitivenessScore: 0.0 });
        }).not.toThrow();
      });

      it('should pass for maximum score (5.0)', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({ responsivenessScore: 5.0 });
        }).not.toThrow();
      });
    });

    describe('Invalid price competitiveness score', () => {
      it('should throw BadRequestException for non-number score', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({ priceCompetitivenessScore: '4.5' as any });
        }).toThrow(BadRequestException);

        expect(() => {
          validateUpdatePerformanceScoresInput({ priceCompetitivenessScore: '4.5' as any });
        }).toThrow('Price competitiveness score must be a number');
      });

      it('should throw BadRequestException for score below 0', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({ priceCompetitivenessScore: -0.1 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateUpdatePerformanceScoresInput({ priceCompetitivenessScore: -0.1 });
        }).toThrow('Price competitiveness score must be between 0.0 and 5.0');
      });

      it('should throw BadRequestException for score above 5.0', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({ priceCompetitivenessScore: 5.1 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateUpdatePerformanceScoresInput({ priceCompetitivenessScore: 5.1 });
        }).toThrow('Price competitiveness score must be between 0.0 and 5.0');
      });

      it('should throw BadRequestException for score of 6.0', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({ priceCompetitivenessScore: 6.0 });
        }).toThrow('Price competitiveness score must be between 0.0 and 5.0');
      });
    });

    describe('Invalid responsiveness score', () => {
      it('should throw BadRequestException for non-number score', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({ responsivenessScore: 'high' as any });
        }).toThrow(BadRequestException);

        expect(() => {
          validateUpdatePerformanceScoresInput({ responsivenessScore: 'high' as any });
        }).toThrow('Responsiveness score must be a number');
      });

      it('should throw BadRequestException for score below 0', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({ responsivenessScore: -1.0 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateUpdatePerformanceScoresInput({ responsivenessScore: -1.0 });
        }).toThrow('Responsiveness score must be between 0.0 and 5.0');
      });

      it('should throw BadRequestException for score above 5.0', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({ responsivenessScore: 5.5 });
        }).toThrow(BadRequestException);

        expect(() => {
          validateUpdatePerformanceScoresInput({ responsivenessScore: 5.5 });
        }).toThrow('Responsiveness score must be between 0.0 and 5.0');
      });
    });

    describe('Missing scores', () => {
      it('should throw BadRequestException when no scores provided', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({});
        }).toThrow(BadRequestException);

        expect(() => {
          validateUpdatePerformanceScoresInput({});
        }).toThrow('At least one score (price competitiveness or responsiveness) must be provided');
      });

      it('should throw BadRequestException when both scores are null', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({
            priceCompetitivenessScore: null,
            responsivenessScore: null,
          });
        }).toThrow(BadRequestException);

        expect(() => {
          validateUpdatePerformanceScoresInput({
            priceCompetitivenessScore: null,
            responsivenessScore: null,
          });
        }).toThrow('At least one score (price competitiveness or responsiveness) must be provided');
      });

      it('should throw BadRequestException when both scores are undefined', () => {
        expect(() => {
          validateUpdatePerformanceScoresInput({
            priceCompetitivenessScore: undefined,
            responsivenessScore: undefined,
          });
        }).toThrow('At least one score (price competitiveness or responsiveness) must be provided');
      });
    });
  });
});
