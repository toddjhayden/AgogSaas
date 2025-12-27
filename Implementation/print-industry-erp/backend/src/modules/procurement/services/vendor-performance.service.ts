import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * VENDOR PERFORMANCE SERVICE
 *
 * Purpose: Calculate and track vendor performance metrics for procurement optimization
 *
 * Key Features:
 * - Automated monthly performance calculation
 * - On-time delivery tracking (OTD%)
 * - Quality acceptance rate (QAR%)
 * - Price competitiveness scoring
 * - Responsiveness scoring
 * - Overall vendor rating (weighted composite)
 * - Historical trend analysis
 * - SCD Type 2 integration for vendor changes
 *
 * Performance Metrics:
 * 1. On-Time Delivery %: (on_time_deliveries / total_deliveries) * 100
 * 2. Quality Acceptance %: (quality_acceptances / (quality_acceptances + quality_rejections)) * 100
 * 3. Price Competitiveness: 1-5 stars (manual input or calculated vs market)
 * 4. Responsiveness: 1-5 stars (manual input based on communication)
 * 5. Overall Rating: Weighted average of all metrics
 *
 * Calculation Triggers:
 * - Manual: calculateVendorPerformance(vendorId, year, month)
 * - Automated: Scheduled job runs monthly to calculate previous month
 * - Event-driven: PO receipt triggers recalculation
 *
 * Integration Points:
 * - Purchase Orders: Tracks PO count and value
 * - Receiving: Tracks on-time vs late deliveries
 * - Quality Inspections: Tracks acceptance vs rejection rates
 * - Vendor Master: Updates vendor summary ratings via SCD Type 2
 */

export interface VendorPerformanceMetrics {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  evaluationPeriodYear: number;
  evaluationPeriodMonth: number;

  // Purchase order metrics
  totalPosIssued: number;
  totalPosValue: number;

  // Delivery metrics
  onTimeDeliveries: number;
  totalDeliveries: number;
  onTimePercentage: number;

  // Quality metrics
  qualityAcceptances: number;
  qualityRejections: number;
  qualityPercentage: number;

  // Scoring metrics (1-5 stars)
  priceCompetitivenessScore: number;
  responsivenessScore: number;
  overallRating: number;

  notes?: string;
}

export interface VendorScorecard {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  currentRating: number;

  // Vendor tier classification
  vendorTier?: string; // STRATEGIC, PREFERRED, TRANSACTIONAL
  tierClassificationDate?: string;

  // 12-month rolling metrics
  rollingOnTimePercentage: number;
  rollingQualityPercentage: number;
  rollingAvgRating: number;

  // Trend indicators
  trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING';
  monthsTracked: number;

  // Recent performance
  lastMonthRating: number;
  last3MonthsAvgRating: number;
  last6MonthsAvgRating: number;

  // ESG metrics (if available)
  esgOverallScore?: number;
  esgRiskLevel?: string;

  // Performance history
  monthlyPerformance: VendorPerformanceMetrics[];
}

export interface VendorESGMetrics {
  id?: string;
  tenantId: string;
  vendorId: string;
  evaluationPeriodYear: number;
  evaluationPeriodMonth: number;

  // Environmental metrics
  carbonFootprintTonsCO2e?: number;
  carbonFootprintTrend?: 'IMPROVING' | 'STABLE' | 'WORSENING';
  wasteReductionPercentage?: number;
  renewableEnergyPercentage?: number;
  packagingSustainabilityScore?: number;
  environmentalCertifications?: any; // JSONB

  // Social metrics
  laborPracticesScore?: number;
  humanRightsComplianceScore?: number;
  diversityScore?: number;
  workerSafetyRating?: number;
  socialCertifications?: any; // JSONB

  // Governance metrics
  ethicsComplianceScore?: number;
  antiCorruptionScore?: number;
  supplyChainTransparencyScore?: number;
  governanceCertifications?: any; // JSONB

  // Overall ESG
  esgOverallScore?: number;
  esgRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

  // Metadata
  dataSource?: string;
  lastAuditDate?: string;
  nextAuditDueDate?: string;
  notes?: string;
}

export interface ScorecardConfig {
  id?: string;
  tenantId: string;
  configName: string;
  vendorType?: string;
  vendorTier?: string;

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

  // Active/versioning
  isActive: boolean;
  effectiveFromDate: string;
  effectiveToDate?: string;
}

export interface VendorComparisonReport {
  evaluationPeriodYear: number;
  evaluationPeriodMonth: number;
  vendorType?: string;

  topPerformers: Array<{
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    overallRating: number;
    onTimePercentage: number;
    qualityPercentage: number;
  }>;

  bottomPerformers: Array<{
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    overallRating: number;
    onTimePercentage: number;
    qualityPercentage: number;
  }>;

  averageMetrics: {
    avgOnTimePercentage: number;
    avgQualityPercentage: number;
    avgOverallRating: number;
    totalVendorsEvaluated: number;
  };
}

@Injectable()
export class VendorPerformanceService {
  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * Calculate vendor performance for a specific period
   * This is the main calculation engine that aggregates PO and receipt data
   */
  async calculateVendorPerformance(
    tenantId: string,
    vendorId: string,
    year: number,
    month: number
  ): Promise<VendorPerformanceMetrics> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 1. Get vendor info (current version for display)
      const vendorResult = await client.query(
        `SELECT vendor_code, vendor_name
         FROM vendors
         WHERE id = $1 AND tenant_id = $2 AND is_current_version = TRUE`,
        [vendorId, tenantId]
      );

      if (vendorResult.rows.length === 0) {
        throw new Error(`Vendor ${vendorId} not found`);
      }

      const vendor = vendorResult.rows[0];

      // 2. Calculate date range for the evaluation period
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last day of month

      // 3. Count POs issued in this period
      const poStatsResult = await client.query(
        `SELECT
          COUNT(*) AS total_pos_issued,
          COALESCE(SUM(total_amount), 0) AS total_pos_value
         FROM purchase_orders
         WHERE tenant_id = $1
           AND vendor_id = $2
           AND purchase_order_date >= $3::date
           AND purchase_order_date <= $4::date
           AND status != 'CANCELLED'`,
        [tenantId, vendorId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
      );

      const poStats = poStatsResult.rows[0];

      // 4. Calculate delivery performance
      // For simplicity, we'll consider a PO "delivered on time" if:
      // - Status is RECEIVED or CLOSED
      // - Last receipt date <= promised_delivery_date (or <= requested + buffer if no promise)
      // NOTE: This is a simplified calculation. In production, you'd track actual receipt dates
      // from a separate receiving_transactions table

      const deliveryStatsResult = await client.query(
        `SELECT
          COUNT(*) AS total_deliveries,
          COUNT(*) FILTER (
            WHERE status IN ('RECEIVED', 'CLOSED')
            AND (
              -- If we have a promised date, check against it
              (promised_delivery_date IS NOT NULL AND updated_at::date <= promised_delivery_date)
              OR
              -- Otherwise, allow 7 days buffer from requested date
              (promised_delivery_date IS NULL AND requested_delivery_date IS NOT NULL
               AND updated_at::date <= requested_delivery_date + INTERVAL '7 days')
            )
          ) AS on_time_deliveries
         FROM purchase_orders
         WHERE tenant_id = $1
           AND vendor_id = $2
           AND purchase_order_date >= $3::date
           AND purchase_order_date <= $4::date
           AND status IN ('PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED')`,
        [tenantId, vendorId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
      );

      const deliveryStats = deliveryStatsResult.rows[0];
      const totalDeliveries = parseInt(deliveryStats.total_deliveries) || 0;
      const onTimeDeliveries = parseInt(deliveryStats.on_time_deliveries) || 0;
      const onTimePercentage = totalDeliveries > 0
        ? (onTimeDeliveries / totalDeliveries) * 100
        : null;

      // 5. Calculate quality metrics
      // NOTE: This would ideally come from a quality_inspections table
      // For now, we'll use placeholder logic based on receipt variances
      // In production, track actual quality accepts/rejects per receipt

      const qualityStatsResult = await client.query(
        `SELECT
          COUNT(*) FILTER (
            WHERE status IN ('RECEIVED', 'CLOSED')
          ) AS quality_acceptances,
          COUNT(*) FILTER (
            WHERE status = 'CANCELLED'
            AND notes ILIKE '%quality%'
          ) AS quality_rejections
         FROM purchase_orders
         WHERE tenant_id = $1
           AND vendor_id = $2
           AND purchase_order_date >= $3::date
           AND purchase_order_date <= $4::date`,
        [tenantId, vendorId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
      );

      const qualityStats = qualityStatsResult.rows[0];
      const qualityAcceptances = parseInt(qualityStats.quality_acceptances) || 0;
      const qualityRejections = parseInt(qualityStats.quality_rejections) || 0;
      const totalQualityEvents = qualityAcceptances + qualityRejections;
      const qualityPercentage = totalQualityEvents > 0
        ? (qualityAcceptances / totalQualityEvents) * 100
        : null;

      // 6. Calculate price competitiveness score (placeholder - would compare to market data)
      // For now, default to 3.0 stars (neutral)
      const priceCompetitivenessScore = 3.0;

      // 7. Calculate responsiveness score (placeholder - would track communication metrics)
      // For now, default to 3.0 stars (neutral)
      const responsivenessScore = 3.0;

      // 8. Calculate overall rating (weighted average)
      // Weights: OTD 40%, Quality 40%, Price 10%, Responsiveness 10%
      let overallRating = null;
      if (onTimePercentage !== null && qualityPercentage !== null) {
        const otdStars = (onTimePercentage / 100) * 5;
        const qualityStars = (qualityPercentage / 100) * 5;

        overallRating = (
          (otdStars * 0.4) +
          (qualityStars * 0.4) +
          (priceCompetitivenessScore * 0.1) +
          (responsivenessScore * 0.1)
        );

        // Round to 1 decimal place
        overallRating = Math.round(overallRating * 10) / 10;
      }

      // 9. Upsert vendor_performance record
      const performanceResult = await client.query(
        `INSERT INTO vendor_performance (
          tenant_id, vendor_id, evaluation_period_year, evaluation_period_month,
          total_pos_issued, total_pos_value,
          on_time_deliveries, total_deliveries, on_time_percentage,
          quality_acceptances, quality_rejections, quality_percentage,
          price_competitiveness_score, responsiveness_score, overall_rating,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        ON CONFLICT (tenant_id, vendor_id, evaluation_period_year, evaluation_period_month)
        DO UPDATE SET
          total_pos_issued = EXCLUDED.total_pos_issued,
          total_pos_value = EXCLUDED.total_pos_value,
          on_time_deliveries = EXCLUDED.on_time_deliveries,
          total_deliveries = EXCLUDED.total_deliveries,
          on_time_percentage = EXCLUDED.on_time_percentage,
          quality_acceptances = EXCLUDED.quality_acceptances,
          quality_rejections = EXCLUDED.quality_rejections,
          quality_percentage = EXCLUDED.quality_percentage,
          price_competitiveness_score = EXCLUDED.price_competitiveness_score,
          responsiveness_score = EXCLUDED.responsiveness_score,
          overall_rating = EXCLUDED.overall_rating,
          updated_at = NOW()
        RETURNING *`,
        [
          tenantId, vendorId, year, month,
          poStats.total_pos_issued, parseFloat(poStats.total_pos_value),
          onTimeDeliveries, totalDeliveries, onTimePercentage,
          qualityAcceptances, qualityRejections, qualityPercentage,
          priceCompetitivenessScore, responsivenessScore, overallRating
        ]
      );

      // 10. Update vendor master summary metrics (using SCD Type 2)
      // We'll update the CURRENT version's summary fields
      if (overallRating !== null && onTimePercentage !== null && qualityPercentage !== null) {
        await client.query(
          `UPDATE vendors
           SET
             on_time_delivery_percentage = $1,
             quality_rating_percentage = $2,
             overall_rating = $3,
             updated_at = NOW()
           WHERE tenant_id = $4
             AND id = $5
             AND is_current_version = TRUE`,
          [onTimePercentage, qualityPercentage, overallRating, tenantId, vendorId]
        );
      }

      await client.query('COMMIT');

      return {
        vendorId,
        vendorCode: vendor.vendor_code,
        vendorName: vendor.vendor_name,
        evaluationPeriodYear: year,
        evaluationPeriodMonth: month,
        totalPosIssued: parseInt(poStats.total_pos_issued),
        totalPosValue: parseFloat(poStats.total_pos_value),
        onTimeDeliveries,
        totalDeliveries,
        onTimePercentage: onTimePercentage !== null ? Math.round(onTimePercentage * 100) / 100 : 0,
        qualityAcceptances,
        qualityRejections,
        qualityPercentage: qualityPercentage !== null ? Math.round(qualityPercentage * 100) / 100 : 0,
        priceCompetitivenessScore,
        responsivenessScore,
        overallRating: overallRating || 0
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate performance for all active vendors in a period
   */
  async calculateAllVendorsPerformance(
    tenantId: string,
    year: number,
    month: number
  ): Promise<VendorPerformanceMetrics[]> {
    // Get all active vendors
    const vendorsResult = await this.db.query(
      `SELECT id FROM vendors
       WHERE tenant_id = $1
         AND is_active = TRUE
         AND is_current_version = TRUE`,
      [tenantId]
    );

    const results: VendorPerformanceMetrics[] = [];

    for (const vendor of vendorsResult.rows) {
      try {
        const metrics = await this.calculateVendorPerformance(
          tenantId,
          vendor.id,
          year,
          month
        );
        results.push(metrics);
      } catch (error) {
        console.error(`Error calculating performance for vendor ${vendor.id}:`, error);
        // Continue with other vendors
      }
    }

    return results;
  }

  /**
   * Get vendor scorecard with 12-month rolling metrics and trends
   */
  async getVendorScorecard(
    tenantId: string,
    vendorId: string
  ): Promise<VendorScorecard> {
    // Get vendor info
    const vendorResult = await this.db.query(
      `SELECT vendor_code, vendor_name, overall_rating
       FROM vendors
       WHERE id = $1 AND tenant_id = $2 AND is_current_version = TRUE`,
      [vendorId, tenantId]
    );

    if (vendorResult.rows.length === 0) {
      throw new Error(`Vendor ${vendorId} not found`);
    }

    const vendor = vendorResult.rows[0];

    // Get last 12 months of performance data
    const performanceResult = await this.db.query(
      `SELECT *
       FROM vendor_performance
       WHERE tenant_id = $1 AND vendor_id = $2
       ORDER BY evaluation_period_year DESC, evaluation_period_month DESC
       LIMIT 12`,
      [tenantId, vendorId]
    );

    const monthlyPerformance = performanceResult.rows.map(row => ({
      vendorId: row.vendor_id,
      vendorCode: vendor.vendor_code,
      vendorName: vendor.vendor_name,
      evaluationPeriodYear: row.evaluation_period_year,
      evaluationPeriodMonth: row.evaluation_period_month,
      totalPosIssued: row.total_pos_issued || 0,
      totalPosValue: parseFloat(row.total_pos_value) || 0,
      onTimeDeliveries: row.on_time_deliveries || 0,
      totalDeliveries: row.total_deliveries || 0,
      onTimePercentage: parseFloat(row.on_time_percentage) || 0,
      qualityAcceptances: row.quality_acceptances || 0,
      qualityRejections: row.quality_rejections || 0,
      qualityPercentage: parseFloat(row.quality_percentage) || 0,
      priceCompetitivenessScore: parseFloat(row.price_competitiveness_score) || 0,
      responsivenessScore: parseFloat(row.responsiveness_score) || 0,
      overallRating: parseFloat(row.overall_rating) || 0,
      notes: row.notes
    }));

    // Calculate rolling metrics
    const rollingOnTimePercentage = monthlyPerformance.length > 0
      ? monthlyPerformance.reduce((sum, m) => sum + m.onTimePercentage, 0) / monthlyPerformance.length
      : 0;

    const rollingQualityPercentage = monthlyPerformance.length > 0
      ? monthlyPerformance.reduce((sum, m) => sum + m.qualityPercentage, 0) / monthlyPerformance.length
      : 0;

    const rollingAvgRating = monthlyPerformance.length > 0
      ? monthlyPerformance.reduce((sum, m) => sum + m.overallRating, 0) / monthlyPerformance.length
      : 0;

    // Calculate trend
    const lastMonthRating = monthlyPerformance.length > 0 ? monthlyPerformance[0].overallRating : 0;
    const last3MonthsAvgRating = monthlyPerformance.slice(0, 3).length > 0
      ? monthlyPerformance.slice(0, 3).reduce((sum, m) => sum + m.overallRating, 0) / Math.min(3, monthlyPerformance.length)
      : 0;
    const last6MonthsAvgRating = monthlyPerformance.slice(0, 6).length > 0
      ? monthlyPerformance.slice(0, 6).reduce((sum, m) => sum + m.overallRating, 0) / Math.min(6, monthlyPerformance.length)
      : 0;

    // Determine trend direction
    let trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
    if (monthlyPerformance.length >= 3) {
      const recentAvg = last3MonthsAvgRating;
      const olderAvg = monthlyPerformance.slice(3, 6).length > 0
        ? monthlyPerformance.slice(3, 6).reduce((sum, m) => sum + m.overallRating, 0) / Math.min(3, monthlyPerformance.slice(3, 6).length)
        : recentAvg;

      const change = recentAvg - olderAvg;
      if (change > 0.3) {
        trendDirection = 'IMPROVING';
      } else if (change < -0.3) {
        trendDirection = 'DECLINING';
      }
    }

    return {
      vendorId,
      vendorCode: vendor.vendor_code,
      vendorName: vendor.vendor_name,
      currentRating: parseFloat(vendor.overall_rating) || 0,
      rollingOnTimePercentage: Math.round(rollingOnTimePercentage * 100) / 100,
      rollingQualityPercentage: Math.round(rollingQualityPercentage * 100) / 100,
      rollingAvgRating: Math.round(rollingAvgRating * 10) / 10,
      trendDirection,
      monthsTracked: monthlyPerformance.length,
      lastMonthRating: Math.round(lastMonthRating * 10) / 10,
      last3MonthsAvgRating: Math.round(last3MonthsAvgRating * 10) / 10,
      last6MonthsAvgRating: Math.round(last6MonthsAvgRating * 10) / 10,
      monthlyPerformance
    };
  }

  /**
   * Get vendor comparison report for a period
   */
  async getVendorComparisonReport(
    tenantId: string,
    year: number,
    month: number,
    vendorType?: string,
    topN: number = 5
  ): Promise<VendorComparisonReport> {
    let whereClause = 'vp.tenant_id = $1 AND vp.evaluation_period_year = $2 AND vp.evaluation_period_month = $3';
    const params: any[] = [tenantId, year, month];

    if (vendorType) {
      whereClause += ' AND v.vendor_type = $4';
      params.push(vendorType);
    }

    // Get all vendor performance for the period
    const performanceResult = await this.db.query(
      `SELECT
        vp.vendor_id,
        v.vendor_code,
        v.vendor_name,
        vp.overall_rating,
        vp.on_time_percentage,
        vp.quality_percentage
       FROM vendor_performance vp
       JOIN vendors v ON vp.vendor_id = v.id AND v.is_current_version = TRUE
       WHERE ${whereClause}
       ORDER BY vp.overall_rating DESC`,
      params
    );

    const allVendors = performanceResult.rows.map(row => ({
      vendorId: row.vendor_id,
      vendorCode: row.vendor_code,
      vendorName: row.vendor_name,
      overallRating: parseFloat(row.overall_rating) || 0,
      onTimePercentage: parseFloat(row.on_time_percentage) || 0,
      qualityPercentage: parseFloat(row.quality_percentage) || 0
    }));

    // Calculate averages
    const avgOnTimePercentage = allVendors.length > 0
      ? allVendors.reduce((sum, v) => sum + v.onTimePercentage, 0) / allVendors.length
      : 0;

    const avgQualityPercentage = allVendors.length > 0
      ? allVendors.reduce((sum, v) => sum + v.qualityPercentage, 0) / allVendors.length
      : 0;

    const avgOverallRating = allVendors.length > 0
      ? allVendors.reduce((sum, v) => sum + v.overallRating, 0) / allVendors.length
      : 0;

    return {
      evaluationPeriodYear: year,
      evaluationPeriodMonth: month,
      vendorType,
      topPerformers: allVendors.slice(0, topN),
      bottomPerformers: allVendors.slice(-topN).reverse(),
      averageMetrics: {
        avgOnTimePercentage: Math.round(avgOnTimePercentage * 100) / 100,
        avgQualityPercentage: Math.round(avgQualityPercentage * 100) / 100,
        avgOverallRating: Math.round(avgOverallRating * 10) / 10,
        totalVendorsEvaluated: allVendors.length
      }
    };
  }

  /**
   * Record ESG metrics for a vendor in a specific period
   */
  async recordESGMetrics(
    esgMetrics: VendorESGMetrics
  ): Promise<VendorESGMetrics> {
    const result = await this.db.query(
      `INSERT INTO vendor_esg_metrics (
        tenant_id, vendor_id, evaluation_period_year, evaluation_period_month,
        carbon_footprint_tons_co2e, carbon_footprint_trend,
        waste_reduction_percentage, renewable_energy_percentage, packaging_sustainability_score,
        environmental_certifications,
        labor_practices_score, human_rights_compliance_score, diversity_score, worker_safety_rating,
        social_certifications,
        ethics_compliance_score, anti_corruption_score, supply_chain_transparency_score,
        governance_certifications,
        esg_overall_score, esg_risk_level,
        data_source, last_audit_date, next_audit_due_date, notes,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW()
      )
      ON CONFLICT (tenant_id, vendor_id, evaluation_period_year, evaluation_period_month)
      DO UPDATE SET
        carbon_footprint_tons_co2e = EXCLUDED.carbon_footprint_tons_co2e,
        carbon_footprint_trend = EXCLUDED.carbon_footprint_trend,
        waste_reduction_percentage = EXCLUDED.waste_reduction_percentage,
        renewable_energy_percentage = EXCLUDED.renewable_energy_percentage,
        packaging_sustainability_score = EXCLUDED.packaging_sustainability_score,
        environmental_certifications = EXCLUDED.environmental_certifications,
        labor_practices_score = EXCLUDED.labor_practices_score,
        human_rights_compliance_score = EXCLUDED.human_rights_compliance_score,
        diversity_score = EXCLUDED.diversity_score,
        worker_safety_rating = EXCLUDED.worker_safety_rating,
        social_certifications = EXCLUDED.social_certifications,
        ethics_compliance_score = EXCLUDED.ethics_compliance_score,
        anti_corruption_score = EXCLUDED.anti_corruption_score,
        supply_chain_transparency_score = EXCLUDED.supply_chain_transparency_score,
        governance_certifications = EXCLUDED.governance_certifications,
        esg_overall_score = EXCLUDED.esg_overall_score,
        esg_risk_level = EXCLUDED.esg_risk_level,
        data_source = EXCLUDED.data_source,
        last_audit_date = EXCLUDED.last_audit_date,
        next_audit_due_date = EXCLUDED.next_audit_due_date,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *`,
      [
        esgMetrics.tenantId,
        esgMetrics.vendorId,
        esgMetrics.evaluationPeriodYear,
        esgMetrics.evaluationPeriodMonth,
        esgMetrics.carbonFootprintTonsCO2e,
        esgMetrics.carbonFootprintTrend,
        esgMetrics.wasteReductionPercentage,
        esgMetrics.renewableEnergyPercentage,
        esgMetrics.packagingSustainabilityScore,
        esgMetrics.environmentalCertifications ? JSON.stringify(esgMetrics.environmentalCertifications) : null,
        esgMetrics.laborPracticesScore,
        esgMetrics.humanRightsComplianceScore,
        esgMetrics.diversityScore,
        esgMetrics.workerSafetyRating,
        esgMetrics.socialCertifications ? JSON.stringify(esgMetrics.socialCertifications) : null,
        esgMetrics.ethicsComplianceScore,
        esgMetrics.antiCorruptionScore,
        esgMetrics.supplyChainTransparencyScore,
        esgMetrics.governanceCertifications ? JSON.stringify(esgMetrics.governanceCertifications) : null,
        esgMetrics.esgOverallScore,
        esgMetrics.esgRiskLevel,
        esgMetrics.dataSource,
        esgMetrics.lastAuditDate,
        esgMetrics.nextAuditDueDate,
        esgMetrics.notes
      ]
    );

    return this.mapESGMetricsRow(result.rows[0]);
  }

  /**
   * Get ESG metrics for a vendor
   */
  async getVendorESGMetrics(
    tenantId: string,
    vendorId: string,
    year?: number,
    month?: number
  ): Promise<VendorESGMetrics[]> {
    let query = `SELECT * FROM vendor_esg_metrics WHERE tenant_id = $1 AND vendor_id = $2`;
    const params: any[] = [tenantId, vendorId];

    if (year && month) {
      query += ` AND evaluation_period_year = $3 AND evaluation_period_month = $4`;
      params.push(year, month);
    }

    query += ` ORDER BY evaluation_period_year DESC, evaluation_period_month DESC LIMIT 12`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapESGMetricsRow(row));
  }

  /**
   * Get active scorecard configuration for a vendor
   */
  async getScorecardConfig(
    tenantId: string,
    vendorType?: string,
    vendorTier?: string
  ): Promise<ScorecardConfig | null> {
    let query = `
      SELECT * FROM vendor_scorecard_config
      WHERE tenant_id = $1
        AND is_active = TRUE
        AND effective_from_date <= CURRENT_DATE
        AND (effective_to_date IS NULL OR effective_to_date >= CURRENT_DATE)
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Try to find exact match first (vendor type AND tier)
    if (vendorType && vendorTier) {
      query += ` AND vendor_type = $${paramIndex} AND vendor_tier = $${paramIndex + 1}`;
      params.push(vendorType, vendorTier);
      paramIndex += 2;
    } else if (vendorType) {
      query += ` AND vendor_type = $${paramIndex} AND vendor_tier IS NULL`;
      params.push(vendorType);
      paramIndex += 1;
    } else if (vendorTier) {
      query += ` AND vendor_tier = $${paramIndex} AND vendor_type IS NULL`;
      params.push(vendorTier);
      paramIndex += 1;
    } else {
      query += ` AND vendor_type IS NULL AND vendor_tier IS NULL`;
    }

    query += ` ORDER BY effective_from_date DESC LIMIT 1`;

    const result = await this.db.query(query, params);

    if (result.rows.length === 0) {
      // Fallback to default config (no vendor type/tier specified)
      const defaultResult = await this.db.query(
        `SELECT * FROM vendor_scorecard_config
         WHERE tenant_id = $1
           AND is_active = TRUE
           AND vendor_type IS NULL
           AND vendor_tier IS NULL
           AND effective_from_date <= CURRENT_DATE
           AND (effective_to_date IS NULL OR effective_to_date >= CURRENT_DATE)
         ORDER BY effective_from_date DESC
         LIMIT 1`,
        [tenantId]
      );

      if (defaultResult.rows.length === 0) {
        return null;
      }

      return this.mapScorecardConfigRow(defaultResult.rows[0]);
    }

    return this.mapScorecardConfigRow(result.rows[0]);
  }

  /**
   * Calculate weighted score based on config
   */
  calculateWeightedScore(
    performance: any,
    esgMetrics: VendorESGMetrics | null,
    config: ScorecardConfig
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    // Quality score (0-100 scale from percentage)
    if (performance.qualityPercentage !== null && performance.qualityPercentage !== undefined) {
      totalScore += performance.qualityPercentage * (config.qualityWeight / 100);
      totalWeight += config.qualityWeight;
    }

    // Delivery score (0-100 scale from on-time percentage)
    if (performance.onTimePercentage !== null && performance.onTimePercentage !== undefined) {
      totalScore += performance.onTimePercentage * (config.deliveryWeight / 100);
      totalWeight += config.deliveryWeight;
    }

    // Cost score (0-100 scale, 100 - TCO index deviation)
    // If TCO index < 100 (below average cost), score is higher
    if (performance.totalCostOfOwnershipIndex !== null && performance.totalCostOfOwnershipIndex !== undefined) {
      const costScore = Math.max(0, Math.min(100, 200 - performance.totalCostOfOwnershipIndex));
      totalScore += costScore * (config.costWeight / 100);
      totalWeight += config.costWeight;
    }

    // Service score (average of service metrics, converted to 0-100 scale)
    const serviceMetrics = [
      performance.responsivenessScore,
      performance.communicationScore,
      performance.issueResolutionRate
    ].filter(m => m !== null && m !== undefined);

    if (serviceMetrics.length > 0) {
      const avgServiceScore = serviceMetrics.reduce((sum, m) => sum + m, 0) / serviceMetrics.length;
      // Convert 0-5 star rating to 0-100 scale, or use percentage directly
      const serviceScore = avgServiceScore <= 5 ? (avgServiceScore / 5) * 100 : avgServiceScore;
      totalScore += serviceScore * (config.serviceWeight / 100);
      totalWeight += config.serviceWeight;
    }

    // Innovation score (0-5 stars converted to 0-100 scale)
    if (performance.innovationScore !== null && performance.innovationScore !== undefined) {
      const innovationScore = (performance.innovationScore / 5) * 100;
      totalScore += innovationScore * (config.innovationWeight / 100);
      totalWeight += config.innovationWeight;
    }

    // ESG score (0-5 stars converted to 0-100 scale)
    if (esgMetrics && esgMetrics.esgOverallScore !== null && esgMetrics.esgOverallScore !== undefined) {
      const esgScore = (esgMetrics.esgOverallScore / 5) * 100;
      totalScore += esgScore * (config.esgWeight / 100);
      totalWeight += config.esgWeight;
    }

    // Normalize score if not all metrics available
    if (totalWeight === 0) {
      return 0;
    }

    // Return weighted average normalized to original 100% scale
    return (totalScore / totalWeight) * 100;
  }

  /**
   * Get vendor scorecard with ESG metrics (enhanced version)
   */
  async getVendorScorecardEnhanced(
    tenantId: string,
    vendorId: string
  ): Promise<VendorScorecard> {
    // Get basic scorecard
    const scorecard = await this.getVendorScorecard(tenantId, vendorId);

    // Get most recent performance record to extract vendor tier
    const latestPerformance = await this.db.query(
      `SELECT vendor_tier, tier_classification_date
       FROM vendor_performance
       WHERE tenant_id = $1 AND vendor_id = $2
       ORDER BY evaluation_period_year DESC, evaluation_period_month DESC
       LIMIT 1`,
      [tenantId, vendorId]
    );

    if (latestPerformance.rows.length > 0) {
      scorecard.vendorTier = latestPerformance.rows[0].vendor_tier;
      scorecard.tierClassificationDate = latestPerformance.rows[0].tier_classification_date;
    }

    // Get most recent ESG metrics
    const esgMetrics = await this.getVendorESGMetrics(tenantId, vendorId);
    if (esgMetrics.length > 0) {
      scorecard.esgOverallScore = esgMetrics[0].esgOverallScore;
      scorecard.esgRiskLevel = esgMetrics[0].esgRiskLevel;
    }

    return scorecard;
  }

  /**
   * Create or update scorecard configuration
   */
  async upsertScorecardConfig(
    config: ScorecardConfig,
    userId?: string
  ): Promise<ScorecardConfig> {
    const result = await this.db.query(
      `INSERT INTO vendor_scorecard_config (
        tenant_id, config_name, vendor_type, vendor_tier,
        quality_weight, delivery_weight, cost_weight, service_weight, innovation_weight, esg_weight,
        excellent_threshold, good_threshold, acceptable_threshold,
        review_frequency_months,
        is_active, effective_from_date,
        created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), $17)
      RETURNING *`,
      [
        config.tenantId,
        config.configName,
        config.vendorType,
        config.vendorTier,
        config.qualityWeight,
        config.deliveryWeight,
        config.costWeight,
        config.serviceWeight,
        config.innovationWeight,
        config.esgWeight,
        config.excellentThreshold,
        config.goodThreshold,
        config.acceptableThreshold,
        config.reviewFrequencyMonths,
        config.isActive,
        config.effectiveFromDate,
        userId
      ]
    );

    return this.mapScorecardConfigRow(result.rows[0]);
  }

  /**
   * Get all active scorecard configurations for a tenant
   */
  async getScorecardConfigs(tenantId: string): Promise<ScorecardConfig[]> {
    const result = await this.db.query(
      `SELECT * FROM vendor_scorecard_config
       WHERE tenant_id = $1 AND is_active = TRUE
       ORDER BY config_name, effective_from_date DESC`,
      [tenantId]
    );

    return result.rows.map(row => this.mapScorecardConfigRow(row));
  }

  // Helper methods for row mapping

  private mapESGMetricsRow(row: any): VendorESGMetrics {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      vendorId: row.vendor_id,
      evaluationPeriodYear: row.evaluation_period_year,
      evaluationPeriodMonth: row.evaluation_period_month,
      carbonFootprintTonsCO2e: row.carbon_footprint_tons_co2e ? parseFloat(row.carbon_footprint_tons_co2e) : undefined,
      carbonFootprintTrend: row.carbon_footprint_trend,
      wasteReductionPercentage: row.waste_reduction_percentage ? parseFloat(row.waste_reduction_percentage) : undefined,
      renewableEnergyPercentage: row.renewable_energy_percentage ? parseFloat(row.renewable_energy_percentage) : undefined,
      packagingSustainabilityScore: row.packaging_sustainability_score ? parseFloat(row.packaging_sustainability_score) : undefined,
      environmentalCertifications: row.environmental_certifications,
      laborPracticesScore: row.labor_practices_score ? parseFloat(row.labor_practices_score) : undefined,
      humanRightsComplianceScore: row.human_rights_compliance_score ? parseFloat(row.human_rights_compliance_score) : undefined,
      diversityScore: row.diversity_score ? parseFloat(row.diversity_score) : undefined,
      workerSafetyRating: row.worker_safety_rating ? parseFloat(row.worker_safety_rating) : undefined,
      socialCertifications: row.social_certifications,
      ethicsComplianceScore: row.ethics_compliance_score ? parseFloat(row.ethics_compliance_score) : undefined,
      antiCorruptionScore: row.anti_corruption_score ? parseFloat(row.anti_corruption_score) : undefined,
      supplyChainTransparencyScore: row.supply_chain_transparency_score ? parseFloat(row.supply_chain_transparency_score) : undefined,
      governanceCertifications: row.governance_certifications,
      esgOverallScore: row.esg_overall_score ? parseFloat(row.esg_overall_score) : undefined,
      esgRiskLevel: row.esg_risk_level,
      dataSource: row.data_source,
      lastAuditDate: row.last_audit_date,
      nextAuditDueDate: row.next_audit_due_date,
      notes: row.notes
    };
  }

  private mapScorecardConfigRow(row: any): ScorecardConfig {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      configName: row.config_name,
      vendorType: row.vendor_type,
      vendorTier: row.vendor_tier,
      qualityWeight: parseFloat(row.quality_weight),
      deliveryWeight: parseFloat(row.delivery_weight),
      costWeight: parseFloat(row.cost_weight),
      serviceWeight: parseFloat(row.service_weight),
      innovationWeight: parseFloat(row.innovation_weight),
      esgWeight: parseFloat(row.esg_weight),
      excellentThreshold: row.excellent_threshold,
      goodThreshold: row.good_threshold,
      acceptableThreshold: row.acceptable_threshold,
      reviewFrequencyMonths: row.review_frequency_months,
      isActive: row.is_active,
      effectiveFromDate: row.effective_from_date,
      effectiveToDate: row.effective_to_date
    };
  }
}
