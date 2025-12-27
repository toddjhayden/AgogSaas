/**
 * PROCUREMENT DATA TRANSFER OBJECTS (DTOs)
 *
 * Purpose: Input validation for procurement-related GraphQL mutations
 * Ensures data integrity and prevents invalid inputs
 *
 * Validation Rules:
 * - Year: 2020-2100 (reasonable business range)
 * - Month: 1-12 (valid calendar months)
 * - Scores: 0.0-5.0 (5-star rating system)
 * - TopN: 1-100 (reasonable ranking limit)
 *
 * Usage:
 * ```typescript
 * import { validateCalculatePerformanceInput } from './common/validation/procurement-dtos';
 *
 * @Mutation('calculateVendorPerformance')
 * async calculateVendorPerformance(
 *   @Args('tenantId') tenantId: string,
 *   @Args('vendorId') vendorId: string,
 *   @Args('year') year: number,
 *   @Args('month') month: number,
 *   @Context() context: any
 * ) {
 *   // Validate inputs
 *   validateCalculatePerformanceInput({ year, month });
 *
 *   // Validate tenant access
 *   validateTenantAccess(context, tenantId);
 *
 *   // Execute mutation
 *   return this.vendorPerformanceService.calculateVendorPerformance(...);
 * }
 * ```
 */

/**
 * Custom exception class for validation errors
 * (Plain JavaScript - no framework dependencies)
 */
export class BadRequestException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestException';
  }
}

/**
 * Input validation for calculateVendorPerformance mutation
 */
export interface CalculatePerformanceInput {
  year: number;
  month: number;
}

/**
 * Validates inputs for vendor performance calculation
 *
 * @param input - Object containing year and month
 * @throws BadRequestException if validation fails
 */
export function validateCalculatePerformanceInput(input: CalculatePerformanceInput): void {
  const { year, month } = input;

  // Validate year
  if (!Number.isInteger(year)) {
    throw new BadRequestException('Year must be an integer');
  }

  if (year < 2020 || year > 2100) {
    throw new BadRequestException('Year must be between 2020 and 2100');
  }

  // Validate month
  if (!Number.isInteger(month)) {
    throw new BadRequestException('Month must be an integer');
  }

  if (month < 1 || month > 12) {
    throw new BadRequestException('Month must be between 1 and 12');
  }
}

/**
 * Input validation for vendor comparison report query
 */
export interface VendorComparisonInput {
  year: number;
  month: number;
  topN?: number;
}

/**
 * Validates inputs for vendor comparison report
 *
 * @param input - Object containing year, month, and optional topN
 * @throws BadRequestException if validation fails
 */
export function validateVendorComparisonInput(input: VendorComparisonInput): void {
  const { year, month, topN } = input;

  // Validate year and month using shared function
  validateCalculatePerformanceInput({ year, month });

  // Validate topN if provided
  if (topN !== undefined && topN !== null) {
    if (!Number.isInteger(topN)) {
      throw new BadRequestException('TopN must be an integer');
    }

    if (topN < 1 || topN > 100) {
      throw new BadRequestException('TopN must be between 1 and 100');
    }
  }
}

/**
 * Input validation for updating vendor performance scores
 */
export interface UpdatePerformanceScoresInput {
  priceCompetitivenessScore?: number;
  responsivenessScore?: number;
}

/**
 * Validates inputs for updating vendor performance scores
 *
 * @param input - Object containing optional price and responsiveness scores
 * @throws BadRequestException if validation fails
 */
export function validateUpdatePerformanceScoresInput(
  input: UpdatePerformanceScoresInput
): void {
  const { priceCompetitivenessScore, responsivenessScore } = input;

  // Validate price competitiveness score if provided
  if (priceCompetitivenessScore !== undefined && priceCompetitivenessScore !== null) {
    if (typeof priceCompetitivenessScore !== 'number') {
      throw new BadRequestException('Price competitiveness score must be a number');
    }

    if (priceCompetitivenessScore < 0 || priceCompetitivenessScore > 5) {
      throw new BadRequestException('Price competitiveness score must be between 0.0 and 5.0');
    }
  }

  // Validate responsiveness score if provided
  if (responsivenessScore !== undefined && responsivenessScore !== null) {
    if (typeof responsivenessScore !== 'number') {
      throw new BadRequestException('Responsiveness score must be a number');
    }

    if (responsivenessScore < 0 || responsivenessScore > 5) {
      throw new BadRequestException('Responsiveness score must be between 0.0 and 5.0');
    }
  }

  // At least one score must be provided
  if (
    (priceCompetitivenessScore === undefined || priceCompetitivenessScore === null) &&
    (responsivenessScore === undefined || responsivenessScore === null)
  ) {
    throw new BadRequestException(
      'At least one score (price competitiveness or responsiveness) must be provided'
    );
  }
}

/**
 * Input validation for ESG Metrics recording
 */
export interface ESGMetricsInput {
  vendorId: string;
  evaluationPeriodYear: number;
  evaluationPeriodMonth: number;
  // Environmental metrics
  carbonFootprintTonsCO2e?: number;
  carbonFootprintTrend?: 'IMPROVING' | 'STABLE' | 'WORSENING';
  wasteReductionPercentage?: number;
  renewableEnergyPercentage?: number;
  packagingSustainabilityScore?: number;
  environmentalCertifications?: any;
  // Social metrics
  laborPracticesScore?: number;
  humanRightsComplianceScore?: number;
  diversityScore?: number;
  workerSafetyRating?: number;
  socialCertifications?: any;
  // Governance metrics
  ethicsComplianceScore?: number;
  antiCorruptionScore?: number;
  supplyChainTransparencyScore?: number;
  governanceCertifications?: any;
  // Overall ESG
  esgOverallScore?: number;
  esgRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  // Metadata
  dataSource?: string;
  lastAuditDate?: string;
  nextAuditDueDate?: string;
  notes?: string;
}

/**
 * Validates inputs for recording ESG metrics
 */
export function validateESGMetricsInput(input: ESGMetricsInput): void {
  // Validate vendor ID
  if (!input.vendorId || typeof input.vendorId !== 'string') {
    throw new BadRequestException('Valid vendor ID required');
  }

  // Validate evaluation period
  validateCalculatePerformanceInput({
    year: input.evaluationPeriodYear,
    month: input.evaluationPeriodMonth
  });

  // Validate percentage fields (0-100)
  const percentageFields = [
    { name: 'wasteReductionPercentage', value: input.wasteReductionPercentage },
    { name: 'renewableEnergyPercentage', value: input.renewableEnergyPercentage }
  ];

  for (const field of percentageFields) {
    if (field.value !== undefined && field.value !== null) {
      if (typeof field.value !== 'number' || field.value < 0 || field.value > 100) {
        throw new BadRequestException(`${field.name} must be between 0 and 100`);
      }
    }
  }

  // Validate score fields (0-5)
  const scoreFields = [
    { name: 'packagingSustainabilityScore', value: input.packagingSustainabilityScore },
    { name: 'laborPracticesScore', value: input.laborPracticesScore },
    { name: 'humanRightsComplianceScore', value: input.humanRightsComplianceScore },
    { name: 'diversityScore', value: input.diversityScore },
    { name: 'workerSafetyRating', value: input.workerSafetyRating },
    { name: 'ethicsComplianceScore', value: input.ethicsComplianceScore },
    { name: 'antiCorruptionScore', value: input.antiCorruptionScore },
    { name: 'supplyChainTransparencyScore', value: input.supplyChainTransparencyScore },
    { name: 'esgOverallScore', value: input.esgOverallScore }
  ];

  for (const field of scoreFields) {
    if (field.value !== undefined && field.value !== null) {
      if (typeof field.value !== 'number' || field.value < 0 || field.value > 5) {
        throw new BadRequestException(`${field.name} must be between 0 and 5`);
      }
    }
  }

  // Validate carbon footprint (non-negative)
  if (input.carbonFootprintTonsCO2e !== undefined && input.carbonFootprintTonsCO2e !== null) {
    if (typeof input.carbonFootprintTonsCO2e !== 'number' || input.carbonFootprintTonsCO2e < 0) {
      throw new BadRequestException('carbonFootprintTonsCO2e must be non-negative');
    }
  }

  // Validate carbon trend enum
  if (input.carbonFootprintTrend !== undefined && input.carbonFootprintTrend !== null) {
    const validTrends = ['IMPROVING', 'STABLE', 'WORSENING'];
    if (!validTrends.includes(input.carbonFootprintTrend)) {
      throw new BadRequestException(
        `carbonFootprintTrend must be one of: ${validTrends.join(', ')}`
      );
    }
  }

  // Validate ESG risk level enum
  if (input.esgRiskLevel !== undefined && input.esgRiskLevel !== null) {
    const validRiskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'];
    if (!validRiskLevels.includes(input.esgRiskLevel)) {
      throw new BadRequestException(
        `esgRiskLevel must be one of: ${validRiskLevels.join(', ')}`
      );
    }
  }

  // Validate date formats (YYYY-MM-DD)
  const dateFields = [
    { name: 'lastAuditDate', value: input.lastAuditDate },
    { name: 'nextAuditDueDate', value: input.nextAuditDueDate }
  ];

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  for (const field of dateFields) {
    if (field.value !== undefined && field.value !== null) {
      if (!dateRegex.test(field.value)) {
        throw new BadRequestException(`${field.name} must be in YYYY-MM-DD format`);
      }
    }
  }
}

/**
 * Input validation for Scorecard Configuration
 */
export interface ScorecardConfigInput {
  configName: string;
  vendorType?: string;
  vendorTier?: 'STRATEGIC' | 'PREFERRED' | 'TRANSACTIONAL';
  // Metric weights (must sum to 100)
  qualityWeight: number;
  deliveryWeight: number;
  costWeight: number;
  serviceWeight: number;
  innovationWeight: number;
  esgWeight: number;
  // Thresholds
  excellentThreshold: number;
  goodThreshold: number;
  acceptableThreshold: number;
  // Review frequency
  reviewFrequencyMonths: number;
  // Effective date
  effectiveFromDate: string;
}

/**
 * Validates inputs for scorecard configuration
 */
export function validateScorecardConfigInput(input: ScorecardConfigInput): void {
  // Validate config name
  if (!input.configName || typeof input.configName !== 'string' || input.configName.trim().length === 0) {
    throw new BadRequestException('configName is required and must be non-empty');
  }

  if (input.configName.length > 100) {
    throw new BadRequestException('configName must not exceed 100 characters');
  }

  // Validate vendor tier enum
  if (input.vendorTier !== undefined && input.vendorTier !== null) {
    const validTiers = ['STRATEGIC', 'PREFERRED', 'TRANSACTIONAL'];
    if (!validTiers.includes(input.vendorTier)) {
      throw new BadRequestException(`vendorTier must be one of: ${validTiers.join(', ')}`);
    }
  }

  // Validate metric weights (0-100 each)
  const weights = [
    { name: 'qualityWeight', value: input.qualityWeight },
    { name: 'deliveryWeight', value: input.deliveryWeight },
    { name: 'costWeight', value: input.costWeight },
    { name: 'serviceWeight', value: input.serviceWeight },
    { name: 'innovationWeight', value: input.innovationWeight },
    { name: 'esgWeight', value: input.esgWeight }
  ];

  for (const weight of weights) {
    if (weight.value === undefined || weight.value === null) {
      throw new BadRequestException(`${weight.name} is required`);
    }
    if (typeof weight.value !== 'number' || weight.value < 0 || weight.value > 100) {
      throw new BadRequestException(`${weight.name} must be between 0 and 100`);
    }
  }

  // Validate weights sum to 100
  const weightSum = input.qualityWeight + input.deliveryWeight + input.costWeight +
                    input.serviceWeight + input.innovationWeight + input.esgWeight;

  if (Math.abs(weightSum - 100) > 0.01) {
    throw new BadRequestException(
      `Metric weights must sum to exactly 100% (current sum: ${weightSum.toFixed(2)}%)`
    );
  }

  // Validate thresholds (0-100, ascending order)
  const thresholds = [
    { name: 'acceptableThreshold', value: input.acceptableThreshold },
    { name: 'goodThreshold', value: input.goodThreshold },
    { name: 'excellentThreshold', value: input.excellentThreshold }
  ];

  for (const threshold of thresholds) {
    if (threshold.value === undefined || threshold.value === null) {
      throw new BadRequestException(`${threshold.name} is required`);
    }
    if (!Number.isInteger(threshold.value) || threshold.value < 0 || threshold.value > 100) {
      throw new BadRequestException(`${threshold.name} must be an integer between 0 and 100`);
    }
  }

  // Validate threshold order
  if (input.acceptableThreshold >= input.goodThreshold ||
      input.goodThreshold >= input.excellentThreshold) {
    throw new BadRequestException(
      'Thresholds must be in ascending order: acceptable < good < excellent'
    );
  }

  // Validate review frequency (1-12 months)
  if (input.reviewFrequencyMonths === undefined || input.reviewFrequencyMonths === null) {
    throw new BadRequestException('reviewFrequencyMonths is required');
  }
  if (!Number.isInteger(input.reviewFrequencyMonths) ||
      input.reviewFrequencyMonths < 1 ||
      input.reviewFrequencyMonths > 12) {
    throw new BadRequestException('reviewFrequencyMonths must be an integer between 1 and 12');
  }

  // Validate effective date format
  if (!input.effectiveFromDate || typeof input.effectiveFromDate !== 'string') {
    throw new BadRequestException('effectiveFromDate is required');
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(input.effectiveFromDate)) {
    throw new BadRequestException('effectiveFromDate must be in YYYY-MM-DD format');
  }
}

/**
 * Input validation for Vendor Tier Update
 */
export interface UpdateVendorTierInput {
  vendorId: string;
  tier: 'STRATEGIC' | 'PREFERRED' | 'TRANSACTIONAL';
  reason: string;
}

/**
 * Validates inputs for updating vendor tier
 */
export function validateUpdateVendorTierInput(input: UpdateVendorTierInput): void {
  // Validate vendor ID
  if (!input.vendorId || typeof input.vendorId !== 'string') {
    throw new BadRequestException('Valid vendor ID required');
  }

  // Validate tier enum
  const validTiers = ['STRATEGIC', 'PREFERRED', 'TRANSACTIONAL'];
  if (!validTiers.includes(input.tier)) {
    throw new BadRequestException(`tier must be one of: ${validTiers.join(', ')}`);
  }

  // Validate reason (min 10 characters)
  if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length < 10) {
    throw new BadRequestException('reason is required (minimum 10 characters)');
  }

  if (input.reason.length > 500) {
    throw new BadRequestException('reason must not exceed 500 characters');
  }
}

/**
 * Input validation for Alert Acknowledgment
 */
export interface AcknowledgeAlertInput {
  alertId: string;
  notes?: string;
}

/**
 * Validates inputs for acknowledging alerts
 */
export function validateAcknowledgeAlertInput(input: AcknowledgeAlertInput): void {
  // Validate alert ID
  if (!input.alertId || typeof input.alertId !== 'string') {
    throw new BadRequestException('Valid alert ID required');
  }

  // Validate notes if provided
  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== 'string') {
      throw new BadRequestException('notes must be a string');
    }
    if (input.notes.length > 500) {
      throw new BadRequestException('notes must not exceed 500 characters');
    }
  }
}

/**
 * Input validation for Alert Resolution
 */
export interface ResolveAlertInput {
  alertId: string;
  resolution: string;
}

/**
 * Validates inputs for resolving alerts
 */
export function validateResolveAlertInput(input: ResolveAlertInput): void {
  // Validate alert ID
  if (!input.alertId || typeof input.alertId !== 'string') {
    throw new BadRequestException('Valid alert ID required');
  }

  // Validate resolution (required, min 1 character)
  if (!input.resolution || typeof input.resolution !== 'string' || input.resolution.trim().length === 0) {
    throw new BadRequestException('resolution notes required (minimum 1 character)');
  }

  if (input.resolution.length > 1000) {
    throw new BadRequestException('resolution notes must not exceed 1000 characters');
  }
}
