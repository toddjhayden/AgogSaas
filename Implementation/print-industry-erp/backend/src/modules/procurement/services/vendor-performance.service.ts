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

  // Performance history
  monthlyPerformance: VendorPerformanceMetrics[];
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
}
