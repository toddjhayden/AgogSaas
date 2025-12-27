import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Vendor Tier Classification Service
 *
 * Implements automated vendor tier assignment based on spend analysis:
 * - STRATEGIC: Top 15% of vendors (PERCENT_RANK >= 85) OR mission_critical flag
 * - PREFERRED: 60th-85th percentile (next 25% of vendors)
 * - TRANSACTIONAL: Bottom 60% of vendors (PERCENT_RANK < 60)
 *
 * BUG-008 FIX: Uses PERCENT_RANK() SQL function for correct percentile calculation.
 * Uses hysteresis logic to prevent tier oscillation for boundary vendors.
 */

export interface TierClassificationResult {
  tier: 'STRATEGIC' | 'PREFERRED' | 'TRANSACTIONAL';
  totalSpend: number;
  percentileRank: number;
  previousTier?: string;
  tierChanged: boolean;
}

export interface VendorTierReclassificationResult {
  strategicCount: number;
  preferredCount: number;
  transactionalCount: number;
  tierChanges: Array<{
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    oldTier: string;
    newTier: string;
    totalSpend: number;
    percentileRank: number;
  }>;
  totalVendorsAnalyzed: number;
  executionTime: number;
}

@Injectable()
export class VendorTierClassificationService {
  // BUG-008 FIX: Updated hysteresis thresholds to use PERCENT_RANK (0-100 scale)
  // PERCENT_RANK 0 = lowest spend, 100 = highest spend
  // Hysteresis thresholds to prevent tier oscillation
  private readonly STRATEGIC_PROMOTION_THRESHOLD = 85.0;  // Promote to Strategic at 85th percentile (top 15%)
  private readonly STRATEGIC_DEMOTION_THRESHOLD = 87.0;   // Demote from Strategic at 87th percentile
  private readonly PREFERRED_PROMOTION_THRESHOLD = 60.0;  // Promote to Preferred at 60th percentile
  private readonly PREFERRED_DEMOTION_THRESHOLD = 58.0;   // Demote from Preferred at 58th percentile

  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * Classify vendor tier based on 12-month spend analysis
   *
   * Algorithm:
   * 1. Calculate total spend for this vendor (last 12 months)
   * 2. Calculate total spend for all vendors (last 12 months)
   * 3. Determine percentile ranking (top X%)
   * 4. Assign tier based on thresholds with hysteresis
   * 5. Update vendor_performance.vendor_tier and tier_classification_date
   * 6. Return tier classification result
   */
  async classifyVendorTier(
    tenantId: string,
    vendorId: string
  ): Promise<TierClassificationResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // BUG-008 FIX: Use PERCENT_RANK() SQL function for correct percentile calculation
      // PERCENT_RANK() returns 0 (lowest) to 1 (highest), so we convert to 0-100 scale
      // Top 15% of vendors (by spend) have PERCENT_RANK >= 0.85 (85th percentile)
      const percentileResult = await client.query(`
        WITH vendor_spend AS (
          SELECT
            vendor_id,
            COALESCE(SUM(total_amount), 0) as total_spend
          FROM purchase_orders
          WHERE tenant_id = $1
            AND order_date >= CURRENT_DATE - INTERVAL '12 months'
            AND status NOT IN ('CANCELLED', 'DRAFT')
          GROUP BY vendor_id
        ),
        vendor_ranks AS (
          SELECT
            vendor_id,
            total_spend,
            PERCENT_RANK() OVER (ORDER BY total_spend ASC) as percentile_rank
          FROM vendor_spend
        )
        SELECT
          total_spend,
          percentile_rank * 100 as percentile_rank_pct
        FROM vendor_ranks
        WHERE vendor_id = $2
      `, [tenantId, vendorId]);

      let vendorSpend = 0;
      let percentileRank = 0;

      if (percentileResult.rows.length > 0) {
        vendorSpend = parseFloat(percentileResult.rows[0].total_spend);
        percentileRank = parseFloat(percentileResult.rows[0].percentile_rank_pct);
      }

      // 4. Get current vendor tier and mission_critical flag
      const currentVendorResult = await client.query(`
        SELECT
          v.mission_critical,
          vp.vendor_tier as current_tier
        FROM vendors v
        LEFT JOIN vendor_performance vp ON vp.vendor_id = v.id AND vp.tenant_id = v.tenant_id
        WHERE v.id = $1
          AND v.tenant_id = $2
          AND v.is_current_version = TRUE
        LIMIT 1
      `, [vendorId, tenantId]);

      if (currentVendorResult.rows.length === 0) {
        throw new Error(`Vendor ${vendorId} not found for tenant ${tenantId}`);
      }

      const missionCritical = currentVendorResult.rows[0].mission_critical;
      const currentTier = currentVendorResult.rows[0].current_tier;

      // 5. Assign tier based on thresholds with hysteresis
      const newTier = this.determineTier(percentileRank, currentTier, missionCritical);

      // 6. Update vendor_performance table with new tier
      const tierChanged = currentTier !== newTier;

      if (tierChanged || !currentTier) {
        await client.query(`
          UPDATE vendor_performance
          SET
            vendor_tier = $1,
            tier_classification_date = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE tenant_id = $2
            AND vendor_id = $3
        `, [newTier, tenantId, vendorId]);

        // Generate TIER_CHANGE alert if tier actually changed (not initial classification)
        if (tierChanged && currentTier) {
          await this.generateTierChangeAlert(client, tenantId, vendorId, currentTier, newTier, vendorSpend, percentileRank);
        }
      }

      await client.query('COMMIT');

      return {
        tier: newTier,
        totalSpend: vendorSpend,
        percentileRank,
        previousTier: currentTier,
        tierChanged
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Manual tier override with approval tracking
   *
   * Allows procurement managers to manually override tier classification
   * with justification (e.g., strategic partnership, quality concerns, etc.)
   */
  async updateVendorTier(
    tenantId: string,
    vendorId: string,
    tier: 'STRATEGIC' | 'PREFERRED' | 'TRANSACTIONAL',
    reason: string,
    userId: string
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // 1. Validate tier value (enum constraint will also validate)
      if (!['STRATEGIC', 'PREFERRED', 'TRANSACTIONAL'].includes(tier)) {
        throw new Error(`Invalid tier value: ${tier}`);
      }

      // 2. Get current vendor_performance record
      const currentResult = await client.query(`
        SELECT vendor_tier, notes
        FROM vendor_performance
        WHERE tenant_id = $1 AND vendor_id = $2
      `, [tenantId, vendorId]);

      if (currentResult.rows.length === 0) {
        throw new Error(`Vendor performance record not found for vendor ${vendorId}`);
      }

      const currentTier = currentResult.rows[0].vendor_tier;
      const currentNotes = currentResult.rows[0].notes || '';

      // 3. Update vendor_tier, tier_override_by_user_id
      const overrideNote = `[${new Date().toISOString()}] Manual tier override from ${currentTier || 'UNCLASSIFIED'} to ${tier} by user ${userId}. Reason: ${reason}`;
      const updatedNotes = currentNotes ? `${currentNotes}\n${overrideNote}` : overrideNote;

      await client.query(`
        UPDATE vendor_performance
        SET
          vendor_tier = $1,
          tier_classification_date = CURRENT_TIMESTAMP,
          tier_override_by_user_id = $2,
          notes = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $4 AND vendor_id = $5
      `, [tier, userId, updatedNotes, tenantId, vendorId]);

      // 4. Generate TIER_CHANGE alert (via direct insert, not requiring alert engine service)
      if (currentTier !== tier) {
        await this.generateTierChangeAlert(client, tenantId, vendorId, currentTier, tier, null, null, 'MANUAL_OVERRIDE', reason);
      }

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Batch reclassification for all vendors (weekly scheduled job)
   *
   * Processes all active vendors and reclassifies tiers based on spend analysis.
   * Uses hysteresis logic to prevent oscillation for boundary vendors.
   */
  async reclassifyAllVendors(
    tenantId: string
  ): Promise<VendorTierReclassificationResult> {
    const startTime = Date.now();
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // BUG-008 FIX: Use PERCENT_RANK() for batch reclassification
      // 1. Get all active vendors with their current tiers, spend, and percentile rank
      const vendorsResult = await client.query(`
        WITH vendor_spend AS (
          SELECT
            vendor_id,
            COALESCE(SUM(total_amount), 0) as total_spend
          FROM purchase_orders
          WHERE tenant_id = $1
            AND order_date >= CURRENT_DATE - INTERVAL '12 months'
            AND status NOT IN ('CANCELLED', 'DRAFT')
          GROUP BY vendor_id
        ),
        vendor_ranks AS (
          SELECT
            vendor_id,
            total_spend,
            PERCENT_RANK() OVER (ORDER BY total_spend ASC) * 100 as percentile_rank
          FROM vendor_spend
        )
        SELECT
          v.id as vendor_id,
          v.vendor_code,
          v.vendor_name,
          v.mission_critical,
          vp.vendor_tier as current_tier,
          COALESCE(vr.total_spend, 0) as total_spend,
          COALESCE(vr.percentile_rank, 0) as percentile_rank
        FROM vendors v
        LEFT JOIN vendor_performance vp ON vp.vendor_id = v.id AND vp.tenant_id = v.tenant_id
        LEFT JOIN vendor_ranks vr ON vr.vendor_id = v.id
        WHERE v.tenant_id = $1
          AND v.is_current_version = TRUE
          AND v.status = 'ACTIVE'
        ORDER BY total_spend DESC
      `, [tenantId]);

      const vendors = vendorsResult.rows;

      // 2. Rank vendors by spend percentile and assign tiers
      const tierChanges: any[] = [];
      let strategicCount = 0;
      let preferredCount = 0;
      let transactionalCount = 0;

      for (const vendor of vendors) {
        const vendorSpend = parseFloat(vendor.total_spend);
        const percentileRank = parseFloat(vendor.percentile_rank);

        // Determine new tier with hysteresis
        const newTier = this.determineTier(percentileRank, vendor.current_tier, vendor.mission_critical);

        // Update tier counts
        if (newTier === 'STRATEGIC') strategicCount++;
        else if (newTier === 'PREFERRED') preferredCount++;
        else transactionalCount++;

        // Detect tier changes
        if (vendor.current_tier !== newTier) {
          tierChanges.push({
            vendorId: vendor.vendor_id,
            vendorCode: vendor.vendor_code,
            vendorName: vendor.vendor_name,
            oldTier: vendor.current_tier || 'UNCLASSIFIED',
            newTier,
            totalSpend: vendorSpend,
            percentileRank
          });

          // Update vendor_performance table
          await client.query(`
            UPDATE vendor_performance
            SET
              vendor_tier = $1,
              tier_classification_date = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE tenant_id = $2 AND vendor_id = $3
          `, [newTier, tenantId, vendor.vendor_id]);

          // Generate TIER_CHANGE alert
          await this.generateTierChangeAlert(
            client,
            tenantId,
            vendor.vendor_id,
            vendor.current_tier,
            newTier,
            vendorSpend,
            percentileRank
          );
        }
      }

      await client.query('COMMIT');

      const executionTime = Date.now() - startTime;

      return {
        strategicCount,
        preferredCount,
        transactionalCount,
        tierChanges,
        totalVendorsAnalyzed: vendors.length,
        executionTime
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Determine vendor tier using hysteresis logic
   *
   * BUG-008 FIX: Corrected logic to use PERCENT_RANK (0-100 scale)
   * - PERCENT_RANK 0 = lowest spend vendor
   * - PERCENT_RANK 100 = highest spend vendor
   * - Top 15% of vendors = PERCENT_RANK >= 85
   * - Next 25% (60th-85th percentile) = PREFERRED
   * - Bottom 60% = TRANSACTIONAL
   *
   * Hysteresis prevents tier oscillation for vendors near boundaries:
   * - Strategic: Promote at 85%, demote at 87% (stay strategic once there)
   * - Preferred: Promote at 60%, demote at 58%
   */
  private determineTier(
    percentileRank: number,
    currentTier: string | null,
    missionCritical: boolean
  ): 'STRATEGIC' | 'PREFERRED' | 'TRANSACTIONAL' {
    // Mission-critical vendors are always STRATEGIC
    if (missionCritical) {
      return 'STRATEGIC';
    }

    // If no current tier, use standard thresholds (no hysteresis)
    if (!currentTier) {
      if (percentileRank >= 85.0) {
        return 'STRATEGIC';  // Top 15% of vendors
      } else if (percentileRank >= 60.0) {
        return 'PREFERRED';  // 60th-85th percentile (next 25%)
      } else {
        return 'TRANSACTIONAL';  // Bottom 60%
      }
    }

    // Apply hysteresis logic to prevent tier oscillation
    if (currentTier === 'STRATEGIC') {
      // Stay strategic unless spend drops below 87th percentile (demotion threshold)
      if (percentileRank < 87.0) {
        return percentileRank >= 60.0 ? 'PREFERRED' : 'TRANSACTIONAL';
      }
      return 'STRATEGIC';
    }

    if (currentTier === 'PREFERRED') {
      // Promote to strategic if above 85th percentile
      if (percentileRank >= 85.0) {
        return 'STRATEGIC';
      }
      // Demote to transactional if below 58th percentile (demotion threshold)
      if (percentileRank < 58.0) {
        return 'TRANSACTIONAL';
      }
      return 'PREFERRED';
    }

    // Current tier is TRANSACTIONAL
    // Promote to preferred if above 60th percentile
    if (percentileRank >= 60.0) {
      // Check if should be strategic (above 85th percentile)
      if (percentileRank >= 85.0) {
        return 'STRATEGIC';
      }
      return 'PREFERRED';
    }

    return 'TRANSACTIONAL';
  }

  /**
   * Generate TIER_CHANGE alert
   */
  private async generateTierChangeAlert(
    client: any,
    tenantId: string,
    vendorId: string,
    oldTier: string,
    newTier: string,
    totalSpend: number | null,
    percentileRank: number | null,
    alertType: 'AUTOMATED' | 'MANUAL_OVERRIDE' = 'AUTOMATED',
    manualReason?: string
  ): Promise<void> {
    const severity = this.determineTierChangeSeverity(oldTier, newTier);

    let message = '';
    if (alertType === 'MANUAL_OVERRIDE') {
      message = `Vendor tier manually changed from ${oldTier} to ${newTier}. Reason: ${manualReason}`;
    } else {
      message = `Vendor tier automatically reclassified from ${oldTier} to ${newTier} based on 12-month spend analysis.`;
      if (totalSpend !== null && percentileRank !== null) {
        message += ` Total spend: $${totalSpend.toLocaleString()}, Percentile rank: ${percentileRank.toFixed(2)}%`;
      }
    }

    await client.query(`
      INSERT INTO vendor_performance_alerts (
        id,
        tenant_id,
        vendor_id,
        alert_type,
        severity,
        metric_category,
        current_value,
        message,
        status,
        created_at
      ) VALUES (
        uuid_generate_v7(),
        $1,
        $2,
        'TIER_CHANGE',
        $3,
        'TIER_CLASSIFICATION',
        $4,
        $5,
        'OPEN',
        CURRENT_TIMESTAMP
      )
    `, [tenantId, vendorId, severity, percentileRank, message]);
  }

  /**
   * Determine severity of tier change alert
   */
  private determineTierChangeSeverity(
    oldTier: string | null,
    newTier: string
  ): 'INFO' | 'WARNING' | 'CRITICAL' {
    // Promotion to STRATEGIC is important (INFO)
    if (newTier === 'STRATEGIC' && oldTier !== 'STRATEGIC') {
      return 'INFO';
    }

    // Demotion from STRATEGIC is concerning (WARNING)
    if (oldTier === 'STRATEGIC' && newTier !== 'STRATEGIC') {
      return 'WARNING';
    }

    // Demotion to TRANSACTIONAL is concerning (WARNING)
    if (newTier === 'TRANSACTIONAL' && oldTier !== 'TRANSACTIONAL') {
      return 'WARNING';
    }

    // All other changes are INFO
    return 'INFO';
  }
}
