/**
 * VENDOR PERFORMANCE GRAPHQL RESOLVER
 *
 * Purpose: GraphQL API for vendor performance tracking and scorecard management
 * Feature: REQ-STRATEGIC-AUTO-1766627342634 - Vendor Scorecards
 * Author: Roy (Backend Developer)
 * Date: 2025-12-26
 *
 * Provides comprehensive vendor scorecard capabilities:
 * - Performance metrics calculation and tracking
 * - ESG (Environmental, Social, Governance) metrics
 * - Configurable weighted scoring
 * - Automated performance alerts
 * - Vendor tier segmentation
 * - Historical trend analysis
 *
 * Related Files:
 * - backend/src/modules/procurement/services/vendor-performance.service.ts
 * - backend/src/graphql/schema/vendor-performance.graphql
 * - backend/migrations/V0.0.26__enhance_vendor_scorecards.sql
 * - backend/migrations/V0.0.29__vendor_scorecard_enhancements_phase1.sql
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { VendorPerformanceService } from '../../modules/procurement/services/vendor-performance.service';

interface GqlContext {
  pool: Pool;
  userId?: string;
  tenantId?: string;
}

/**
 * Authentication and authorization helper functions
 */
function requireAuth(context: GqlContext, operation: string): void {
  if (!context.userId) {
    throw new Error(`Unauthorized: Authentication required for ${operation}`);
  }
}

function requireTenantMatch(context: GqlContext, requestedTenantId: string, operation: string): void {
  if (!context.tenantId) {
    throw new Error(`Unauthorized: Tenant context required for ${operation}`);
  }
  if (context.tenantId !== requestedTenantId) {
    throw new Error(`Forbidden: Cross-tenant access denied for ${operation}`);
  }
}

function validatePermission(context: GqlContext, permission: string, operation: string): void {
  // Note: This is a basic implementation. In production, you would check against
  // a permission service or database that maps users to their permissions
  // For now, we ensure the user is authenticated and has tenant context
  requireAuth(context, operation);
  // TODO: Implement actual permission checking against user roles/permissions table
  // Example: const hasPermission = await checkUserPermission(context.userId, permission);
  // if (!hasPermission) throw new Error(`Forbidden: ${permission} permission required for ${operation}`);
}

/**
 * Map alert database row to GraphQL type
 * BUG-001/BUG-002 FIX: Added severity field mapping
 */
function mapAlertRow(row: any): any {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    vendorId: row.vendor_id,
    alertType: row.alert_type,
    alertCategory: row.alert_category,
    severity: row.severity,  // BUG-002 FIX: Map severity field
    alertMessage: row.alert_message || row.message,  // Support both column names
    metricValue: row.metric_value ? parseFloat(row.metric_value) : null,
    thresholdValue: row.threshold_value ? parseFloat(row.threshold_value) : null,
    alertStatus: row.alert_status || row.status,  // Support both column names
    acknowledgedAt: row.acknowledged_at ? row.acknowledged_at.toISOString() : null,
    acknowledgedByUserId: row.acknowledged_by_user_id,
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    resolvedByUserId: row.resolved_by_user_id,
    dismissalReason: row.dismissal_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null
  };
}

@Resolver()
export class VendorPerformanceResolver {
  constructor(
    @Inject('DATABASE_POOL') private readonly pool: Pool,
    private readonly vendorPerformanceService: VendorPerformanceService,
  ) {}

  /**
   * QUERIES
   */

  /**
   * Get vendor scorecard with 12-month rolling metrics
   */
  @Query()
  async getVendorScorecard(
    @Args('tenantId') tenantId: string,
    @Args('vendorId') vendorId: string,
    @Context() context: GqlContext
  ) {
    const service = new VendorPerformanceService(this.pool);
    return await service.getVendorScorecard(tenantId, vendorId);
  }

  /**
   * Get vendor scorecard with ESG integration (enhanced version)
   */
  @Query()
  async getVendorScorecardEnhanced(
    @Args('tenantId') tenantId: string,
    @Args('vendorId') vendorId: string,
    @Context() context: GqlContext
  ) {
    const service = new VendorPerformanceService(this.pool);
    return await service.getVendorScorecardEnhanced(tenantId, vendorId);
  }

  /**
   * Get vendor performance for a specific period
   */
  @Query()
  async getVendorPerformance(
    @Args('tenantId') tenantId: string,
    @Args('vendorId') vendorId: string,
    @Args('year') year: number,
    @Args('month') month: number,
    @Context() context: GqlContext
  ) {
    const service = new VendorPerformanceService(this.pool);
    return await service.calculateVendorPerformance(
      tenantId,
      vendorId,
      year,
      month
    );
  }

  /**
   * Get vendor comparison report (top/bottom performers)
   */
  @Query()
  async getVendorComparisonReport(
    @Args('tenantId') tenantId: string,
    @Args('year') year: number,
    @Args('month') month: number,
    @Args('vendorType', { nullable: true }) vendorType?: string,
    @Args('topN', { nullable: true }) topN?: number,
  ) {
    const service = new VendorPerformanceService(this.pool);
    return await service.getVendorComparisonReport(
      tenantId,
      year,
      month,
      vendorType,
      topN || 5
    );
  }

  /**
   * Get ESG metrics for a vendor
   */
  @Query()
  async getVendorESGMetrics(
    @Args('tenantId') tenantId: string,
    @Args('vendorId') vendorId: string,
    @Args('year', { nullable: true }) year?: number,
    @Args('month', { nullable: true }) month?: number,
  ) {
    const service = new VendorPerformanceService(this.pool);
    return await service.getVendorESGMetrics(
      tenantId,
      vendorId,
      year,
      month
    );
  }

  /**
   * Get active scorecard configuration
   */
  @Query()
  async getScorecardConfig(
    @Args('tenantId') tenantId: string,
    @Args('vendorType', { nullable: true }) vendorType?: string,
    @Args('vendorTier', { nullable: true }) vendorTier?: string,
  ) {
    const service = new VendorPerformanceService(this.pool);
    return await service.getScorecardConfig(
      tenantId,
      vendorType,
      vendorTier
    );
  }

  /**
   * Get all scorecard configurations for a tenant
   */
  @Query()
  async getScorecardConfigs(
    @Args('tenantId') tenantId: string,
  ) {
    const service = new VendorPerformanceService(this.pool);
    return await service.getScorecardConfigs(tenantId);
  }

  /**
   * Get performance alerts with optional filtering
   */
  @Query()
  async getVendorPerformanceAlerts(
    @Args('tenantId') tenantId: string,
    @Args('vendorId', { nullable: true }) vendorId?: string,
    @Args('alertStatus', { nullable: true }) alertStatus?: string,
    @Args('alertType', { nullable: true }) alertType?: string,
    @Args('alertCategory', { nullable: true }) alertCategory?: string,
  ) {
    let whereClause = 'tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (vendorId) {
      whereClause += ` AND vendor_id = $${paramIndex++}`;
      params.push(vendorId);
    }

    if (alertStatus) {
      whereClause += ` AND alert_status = $${paramIndex++}`;
      params.push(alertStatus);
    }

    if (alertType) {
      whereClause += ` AND alert_type = $${paramIndex++}`;
      params.push(alertType);
    }

    if (alertCategory) {
      whereClause += ` AND alert_category = $${paramIndex++}`;
      params.push(alertCategory);
    }

    const result = await this.pool.query(
      `SELECT * FROM vendor_performance_alerts
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT 100`,
      params
    );

    return result.rows.map(mapAlertRow);
  }

  /**
   * MUTATIONS
   */

  /**
   * Calculate vendor performance for a specific period
   */
  @Mutation()
  async calculateVendorPerformance(
    @Args('tenantId') tenantId: string,
    @Args('vendorId') vendorId: string,
    @Args('year') year: number,
    @Args('month') month: number,
  ) {
    const service = new VendorPerformanceService(this.pool);
    return await service.calculateVendorPerformance(
      tenantId,
      vendorId,
      year,
      month
    );
  }

  /**
   * Calculate performance for all active vendors in a period
   */
  @Mutation()
  async calculateAllVendorsPerformance(
    @Args('tenantId') tenantId: string,
    @Args('year') year: number,
    @Args('month') month: number,
  ) {
    const service = new VendorPerformanceService(this.pool);
    return await service.calculateAllVendorsPerformance(
      tenantId,
      year,
      month
    );
  }

  /**
   * Update vendor performance scores manually
   */
  @Mutation()
  async updateVendorPerformanceScores(
    @Args('tenantId') tenantId: string,
    @Args('vendorId') vendorId: string,
    @Args('year') year: number,
    @Args('month') month: number,
    @Args('scores') scores: any,
  ) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Build update fields
      const updateFields: string[] = [];
      const params: any[] = [tenantId, vendorId, year, month];
      let paramIndex = 5;

      if (scores.priceCompetitivenessScore !== undefined && scores.priceCompetitivenessScore !== null) {
        updateFields.push(`price_competitiveness_score = $${paramIndex++}`);
        params.push(scores.priceCompetitivenessScore);
      }

      if (scores.responsivenessScore !== undefined && scores.responsivenessScore !== null) {
        updateFields.push(`responsiveness_score = $${paramIndex++}`);
        params.push(scores.responsivenessScore);
      }

      if (scores.innovationScore !== undefined && scores.innovationScore !== null) {
        updateFields.push(`innovation_score = $${paramIndex++}`);
        params.push(scores.innovationScore);
      }

      if (scores.communicationScore !== undefined && scores.communicationScore !== null) {
        updateFields.push(`communication_score = $${paramIndex++}`);
        params.push(scores.communicationScore);
      }

      if (scores.qualityAuditScore !== undefined && scores.qualityAuditScore !== null) {
        updateFields.push(`quality_audit_score = $${paramIndex++}`);
        params.push(scores.qualityAuditScore);
      }

      if (scores.notes !== undefined && scores.notes !== null) {
        updateFields.push(`notes = $${paramIndex++}`);
        params.push(scores.notes);
      }

      if (updateFields.length === 0) {
        throw new Error('No scores provided for update');
      }

      // Add updated_at
      updateFields.push('updated_at = NOW()');

      // Update the record
      const result = await client.query(
        `UPDATE vendor_performance
         SET ${updateFields.join(', ')}
         WHERE tenant_id = $1
           AND vendor_id = $2
           AND evaluation_period_year = $3
           AND evaluation_period_month = $4
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        throw new Error('Performance record not found. Calculate performance first.');
      }

      await client.query('COMMIT');

      // Recalculate to update overall rating
      const service = new VendorPerformanceService(this.pool);
      return await service.calculateVendorPerformance(
        tenantId,
        vendorId,
        year,
        month
      );

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record ESG metrics for a vendor
   */
  @Mutation()
  async recordESGMetrics(
    @Args('esgMetrics') esgMetrics: any,
    @Context() context: GqlContext
  ) {
    // BUG-017 FIX: Add authentication and authorization
    requireAuth(context, 'recordESGMetrics');
    requireTenantMatch(context, esgMetrics.tenantId, 'recordESGMetrics');
    validatePermission(context, 'vendor:esg:write', 'recordESGMetrics');

    const service = new VendorPerformanceService(this.pool);
    return await service.recordESGMetrics(esgMetrics);
  }

  /**
   * Create or update scorecard configuration
   */
  @Mutation()
  async upsertScorecardConfig(
    @Args('config') config: any,
    @Args('userId', { nullable: true }) userId?: string,
    @Context() context?: GqlContext
  ) {
    // BUG-017 FIX: Add authentication and authorization
    if (context) {
      requireAuth(context, 'upsertScorecardConfig');
      requireTenantMatch(context, config.tenantId, 'upsertScorecardConfig');
      validatePermission(context, 'vendor:config:write', 'upsertScorecardConfig');
    }

    const service = new VendorPerformanceService(this.pool);
    return await service.upsertScorecardConfig(config, userId || context?.userId);
  }

  /**
   * Update vendor tier classification
   */
  @Mutation()
  async updateVendorTier(
    @Args('tenantId') tenantId: string,
    @Args('input') input: any,
    @Context() context: GqlContext
  ) {
    // BUG-017 FIX: Add authentication and authorization
    requireAuth(context, 'updateVendorTier');
    requireTenantMatch(context, tenantId, 'updateVendorTier');
    validatePermission(context, 'vendor:tier:update', 'updateVendorTier');

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Update vendor tier
      await client.query(
        `UPDATE vendors
         SET vendor_tier = $1,
             tier_calculation_basis = $2,
             updated_at = NOW()
         WHERE id = $3
           AND tenant_id = $4
           AND is_current_version = TRUE`,
        [
          input.vendorTier,
          input.tierCalculationBasis ? JSON.stringify(input.tierCalculationBasis) : null,
          input.vendorId,
          tenantId
        ]
      );

      // Update tier in latest performance record
      await client.query(
        `UPDATE vendor_performance
         SET vendor_tier = $1,
             tier_classification_date = NOW(),
             updated_at = NOW()
         WHERE vendor_id = $2
           AND tenant_id = $3
           AND (evaluation_period_year, evaluation_period_month) = (
             SELECT evaluation_period_year, evaluation_period_month
             FROM vendor_performance
             WHERE vendor_id = $2 AND tenant_id = $3
             ORDER BY evaluation_period_year DESC, evaluation_period_month DESC
             LIMIT 1
           )`,
        [input.vendorTier, input.vendorId, tenantId]
      );

      await client.query('COMMIT');

      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Acknowledge a performance alert
   */
  @Mutation()
  async acknowledgeAlert(
    @Args('tenantId') tenantId: string,
    @Args('input') input: any,
    @Context() context: GqlContext
  ) {
    // BUG-017 FIX: Add authentication and authorization
    requireAuth(context, 'acknowledgeAlert');
    requireTenantMatch(context, tenantId, 'acknowledgeAlert');
    validatePermission(context, 'vendor:alert:write', 'acknowledgeAlert');

    const result = await this.pool.query(
      `UPDATE vendor_performance_alerts
       SET alert_status = 'ACKNOWLEDGED',
           acknowledged_at = NOW(),
           acknowledged_by_user_id = $1,
           updated_at = NOW()
       WHERE id = $2
         AND tenant_id = $3
         AND alert_status = 'ACTIVE'
       RETURNING *`,
      [input.acknowledgedByUserId, input.alertId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Alert not found or already acknowledged');
    }

    return mapAlertRow(result.rows[0]);
  }

  /**
   * Resolve a performance alert
   */
  @Mutation()
  async resolveAlert(
    @Args('tenantId') tenantId: string,
    @Args('input') input: any,
    @Context() context: GqlContext
  ) {
    // BUG-017 FIX: Add authentication and authorization
    requireAuth(context, 'resolveAlert');
    requireTenantMatch(context, tenantId, 'resolveAlert');
    validatePermission(context, 'vendor:alert:write', 'resolveAlert');

    const result = await this.pool.query(
      `UPDATE vendor_performance_alerts
       SET alert_status = 'RESOLVED',
           resolved_at = NOW(),
           resolved_by_user_id = $1,
           dismissal_reason = $2,
           updated_at = NOW()
       WHERE id = $3
         AND tenant_id = $4
         AND alert_status IN ('ACTIVE', 'ACKNOWLEDGED')
       RETURNING *`,
      [input.resolvedByUserId, input.resolutionNotes, input.alertId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Alert not found or already resolved');
    }

    return mapAlertRow(result.rows[0]);
  }

  /**
   * Dismiss a performance alert
   */
  @Mutation()
  async dismissAlert(
    @Args('tenantId') tenantId: string,
    @Args('input') input: any,
  ) {
    const result = await this.pool.query(
      `UPDATE vendor_performance_alerts
       SET alert_status = 'DISMISSED',
           dismissal_reason = $1,
           updated_at = NOW()
       WHERE id = $2
         AND tenant_id = $3
         AND alert_status IN ('ACTIVE', 'ACKNOWLEDGED')
       RETURNING *`,
      [input.dismissalReason, input.alertId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Alert not found or already dismissed');
    }

    return mapAlertRow(result.rows[0]);
  }
}
