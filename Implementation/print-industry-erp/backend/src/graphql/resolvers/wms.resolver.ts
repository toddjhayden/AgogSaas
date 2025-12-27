import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { BinUtilizationOptimizationService } from '../../modules/wms/services/bin-utilization-optimization.service';

/**
 * WMS GraphQL Resolver
 *
 * Handles warehouse management operations:
 * - Inventory Locations (physical locations with 5-tier security)
 * - Lots (batch tracking with traceability)
 * - Inventory Transactions (all movements)
 * - Wave Processing (efficient picking workflows)
 * - Pick Lists (warehouse worker assignments)
 * - Shipments (outbound shipping with 3PL integration)
 * - Carrier Integrations (UPS, FedEx, DHL, etc.)
 * - Kit Definitions (assemblies and bundles)
 * - Inventory Reservations (soft/hard allocations)
 * - Bin Utilization Optimization (intelligent placement)
 */

@Resolver('WMS')
export class WMSResolver {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly binOptimizationService: BinUtilizationOptimizationService
  ) {}

  // =====================================================
  // INVENTORY LOCATION QUERIES
  // =====================================================

  @Query('inventoryLocation')
  async getInventoryLocation(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM inventory_locations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Inventory location ${id} not found`);
    }

    return this.mapInventoryLocationRow(result.rows[0]);
  }

  @Query('inventoryLocations')
  async getInventoryLocations(
    @Args('facilityId') facilityId: string,
    @Args('zone') zone: string | null,
    @Args('locationType') locationType: string | null,
    @Args('securityZone') securityZone: string | null,
    @Args('availableOnly') availableOnly: boolean = false,
    @Context() context: any
  ) {
    let whereClause = `facility_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [facilityId];
    let paramIndex = 2;

    if (zone) {
      whereClause += ` AND zone_code = $${paramIndex++}`;
      params.push(zone);
    }

    if (locationType) {
      whereClause += ` AND location_type = $${paramIndex++}`;
      params.push(locationType);
    }

    if (securityZone) {
      whereClause += ` AND security_zone = $${paramIndex++}`;
      params.push(securityZone);
    }

    if (availableOnly) {
      whereClause += ` AND is_available = TRUE`;
    }

    const result = await this.db.query(
      `SELECT * FROM inventory_locations
       WHERE ${whereClause}
       ORDER BY zone_code, aisle_code, rack_code, shelf_code, bin_code`,
      params
    );

    return result.rows.map(this.mapInventoryLocationRow);
  }

  // =====================================================
  // LOT QUERIES
  // =====================================================

  @Query('lot')
  async getLot(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM lots WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Lot ${id} not found`);
    }

    return this.mapLotRow(result.rows[0]);
  }

  @Query('lots')
  async getLots(
    @Args('facilityId') facilityId: string,
    @Args('materialId') materialId: string | null,
    @Args('locationId') locationId: string | null,
    @Args('qualityStatus') qualityStatus: string | null,
    @Args('expiringBefore') expiringBefore: string | null,
    @Context() context: any
  ) {
    let whereClause = `facility_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [facilityId];
    let paramIndex = 2;

    if (materialId) {
      whereClause += ` AND material_id = $${paramIndex++}`;
      params.push(materialId);
    }

    if (locationId) {
      whereClause += ` AND location_id = $${paramIndex++}`;
      params.push(locationId);
    }

    if (qualityStatus) {
      whereClause += ` AND quality_status = $${paramIndex++}`;
      params.push(qualityStatus);
    }

    if (expiringBefore) {
      whereClause += ` AND expiration_date <= $${paramIndex++}`;
      params.push(expiringBefore);
    }

    const result = await this.db.query(
      `SELECT * FROM lots
       WHERE ${whereClause}
       ORDER BY expiration_date NULLS LAST, received_date DESC`,
      params
    );

    return result.rows.map(this.mapLotRow);
  }

  // =====================================================
  // INVENTORY TRANSACTION QUERIES
  // =====================================================

  @Query('inventoryTransactions')
  async getInventoryTransactions(
    @Args('facilityId') facilityId: string,
    @Args('materialId') materialId: string | null,
    @Args('locationId') locationId: string | null,
    @Args('transactionType') transactionType: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `facility_id = $1`;
    const params: any[] = [facilityId];
    let paramIndex = 2;

    if (materialId) {
      whereClause += ` AND material_id = $${paramIndex++}`;
      params.push(materialId);
    }

    if (locationId) {
      whereClause += ` AND (from_location_id = $${paramIndex} OR to_location_id = $${paramIndex})`;
      params.push(locationId);
      paramIndex++;
    }

    if (transactionType) {
      whereClause += ` AND transaction_type = $${paramIndex++}`;
      params.push(transactionType);
    }

    if (startDate) {
      whereClause += ` AND transaction_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND transaction_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    const result = await this.db.query(
      `SELECT * FROM inventory_transactions
       WHERE ${whereClause}
       ORDER BY transaction_date DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return result.rows.map(this.mapInventoryTransactionRow);
  }

  // =====================================================
  // INVENTORY SUMMARY QUERY
  // =====================================================

  @Query('inventorySummary')
  async getInventorySummary(
    @Args('facilityId') facilityId: string,
    @Args('materialId') materialId: string | null,
    @Args('locationId') locationId: string | null,
    @Context() context: any
  ) {
    let whereClause = `l.facility_id = $1 AND l.deleted_at IS NULL`;
    const params: any[] = [facilityId];
    let paramIndex = 2;

    if (materialId) {
      whereClause += ` AND l.material_id = $${paramIndex++}`;
      params.push(materialId);
    }

    if (locationId) {
      whereClause += ` AND l.location_id = $${paramIndex++}`;
      params.push(locationId);
    }

    const result = await this.db.query(
      `SELECT
        l.material_id,
        m.material_code,
        m.description as material_description,
        l.location_id,
        loc.location_code,
        SUM(l.quantity_on_hand) as on_hand_quantity,
        SUM(l.quantity_available) as quantity_available,
        SUM(l.quantity_allocated) as quantity_allocated,
        l.unit_of_measure,
        MAX(l.updated_at) as last_count_date
       FROM lots l
       LEFT JOIN materials m ON m.id = l.material_id
       LEFT JOIN inventory_locations loc ON loc.id = l.location_id
       WHERE ${whereClause}
       GROUP BY l.material_id, m.material_code, m.description, l.location_id, loc.location_code, l.unit_of_measure
       ORDER BY m.material_code, loc.location_code`,
      params
    );

    return result.rows.map(row => ({
      materialId: row.material_id,
      materialCode: row.material_code,
      materialDescription: row.material_description,
      locationId: row.location_id,
      locationCode: row.location_code,
      onHandQuantity: parseFloat(row.on_hand_quantity),
      quantityAvailable: parseFloat(row.quantity_available),
      quantityAllocated: parseFloat(row.quantity_allocated),
      unitOfMeasure: row.unit_of_measure,
      lastCountDate: row.last_count_date
    }));
  }

  // =====================================================
  // WAVE QUERIES
  // =====================================================

  @Query('wave')
  async getWave(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM wave_processing WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Wave ${id} not found`);
    }

    return this.mapWaveRow(result.rows[0]);
  }

  @Query('waves')
  async getWaves(
    @Args('facilityId') facilityId: string,
    @Args('status') status: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Context() context: any
  ) {
    let whereClause = `facility_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [facilityId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (startDate) {
      whereClause += ` AND planned_release_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND planned_release_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    const result = await this.db.query(
      `SELECT * FROM wave_processing
       WHERE ${whereClause}
       ORDER BY planned_release_date DESC`,
      params
    );

    return result.rows.map(this.mapWaveRow);
  }

  // =====================================================
  // PICK LIST QUERIES
  // =====================================================

  @Query('pickList')
  async getPickList(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM pick_lists WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Pick list ${id} not found`);
    }

    return this.mapPickListRow(result.rows[0]);
  }

  @Query('pickLists')
  async getPickLists(
    @Args('facilityId') facilityId: string,
    @Args('assignedUserId') assignedUserId: string | null,
    @Args('waveId') waveId: string | null,
    @Args('status') status: string | null,
    @Context() context: any
  ) {
    let whereClause = `facility_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [facilityId];
    let paramIndex = 2;

    if (assignedUserId) {
      whereClause += ` AND assigned_user_id = $${paramIndex++}`;
      params.push(assignedUserId);
    }

    if (waveId) {
      whereClause += ` AND wave_id = $${paramIndex++}`;
      params.push(waveId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const result = await this.db.query(
      `SELECT * FROM pick_lists
       WHERE ${whereClause}
       ORDER BY assigned_at DESC`,
      params
    );

    return result.rows.map(this.mapPickListRow);
  }

  // =====================================================
  // SHIPMENT QUERIES
  // =====================================================

  @Query('shipment')
  async getShipment(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM shipments WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Shipment ${id} not found`);
    }

    return this.mapShipmentRow(result.rows[0]);
  }

  @Query('shipments')
  async getShipments(
    @Args('facilityId') facilityId: string,
    @Args('status') status: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Args('trackingNumber') trackingNumber: string | null,
    @Context() context: any
  ) {
    let whereClause = `facility_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [facilityId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (startDate) {
      whereClause += ` AND shipment_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND shipment_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    if (trackingNumber) {
      whereClause += ` AND tracking_number = $${paramIndex++}`;
      params.push(trackingNumber);
    }

    const result = await this.db.query(
      `SELECT * FROM shipments
       WHERE ${whereClause}
       ORDER BY shipment_date DESC`,
      params
    );

    return result.rows.map(this.mapShipmentRow);
  }

  // =====================================================
  // CARRIER INTEGRATION QUERIES
  // =====================================================

  @Query('carrierIntegrations')
  async getCarrierIntegrations(@Args('tenantId') tenantId: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM carrier_integrations
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY carrier_name`,
      [tenantId]
    );

    return result.rows.map(this.mapCarrierIntegrationRow);
  }

  // =====================================================
  // KIT DEFINITION QUERIES
  // =====================================================

  @Query('kitDefinition')
  async getKitDefinition(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM kit_definitions WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Kit definition ${id} not found`);
    }

    return this.mapKitDefinitionRow(result.rows[0]);
  }

  @Query('kitDefinitions')
  async getKitDefinitions(@Args('tenantId') tenantId: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM kit_definitions
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY kit_code`,
      [tenantId]
    );

    return result.rows.map(this.mapKitDefinitionRow);
  }

  // =====================================================
  // INVENTORY RESERVATION QUERIES
  // =====================================================

  @Query('inventoryReservations')
  async getInventoryReservations(
    @Args('facilityId') facilityId: string,
    @Args('materialId') materialId: string | null,
    @Args('salesOrderId') salesOrderId: string | null,
    @Context() context: any
  ) {
    let whereClause = `facility_id = $1 AND status = 'ACTIVE'`;
    const params: any[] = [facilityId];
    let paramIndex = 2;

    if (materialId) {
      whereClause += ` AND material_id = $${paramIndex++}`;
      params.push(materialId);
    }

    if (salesOrderId) {
      whereClause += ` AND sales_order_id = $${paramIndex++}`;
      params.push(salesOrderId);
    }

    const result = await this.db.query(
      `SELECT * FROM inventory_reservations
       WHERE ${whereClause}
       ORDER BY reserved_date DESC`,
      params
    );

    return result.rows.map(this.mapInventoryReservationRow);
  }

  // =====================================================
  // MUTATIONS - INVENTORY LOCATION
  // =====================================================

  @Mutation('createInventoryLocation')
  async createInventoryLocation(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO inventory_locations (
        tenant_id, facility_id, location_code, location_name,
        zone_code, aisle_code, rack_code, location_type,
        security_zone, pick_sequence, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        tenantId,
        input.facilityId,
        input.locationCode,
        input.locationName,
        input.zoneCode,
        input.aisleCode,
        input.rackCode,
        input.locationType,
        input.securityZone || 'STANDARD',
        input.pickSequence,
        userId
      ]
    );

    return this.mapInventoryLocationRow(result.rows[0]);
  }

  @Mutation('updateInventoryLocation')
  async updateInventoryLocation(
    @Args('id') id: string,
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.locationName !== undefined) {
      updates.push(`location_name = $${paramIndex++}`);
      values.push(input.locationName);
    }

    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.isActive);
    }

    if (input.isAvailable !== undefined) {
      updates.push(`is_available = $${paramIndex++}`);
      values.push(input.isAvailable);
    }

    if (input.blockedReason !== undefined) {
      updates.push(`blocked_reason = $${paramIndex++}`);
      values.push(input.blockedReason);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);
    values.push(id);

    const result = await this.db.query(
      `UPDATE inventory_locations SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Inventory location ${id} not found`);
    }

    return this.mapInventoryLocationRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - LOT
  // =====================================================

  @Mutation('createLot')
  async createLot(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO lots (
        tenant_id, facility_id, lot_number, material_id,
        original_quantity, quantity_on_hand, quantity_available,
        unit_of_measure, location_id, received_date, expiration_date,
        quality_status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        tenantId,
        input.facilityId,
        input.lotNumber,
        input.materialId,
        input.originalQuantity,
        input.originalQuantity,
        input.originalQuantity,
        input.unitOfMeasure,
        input.locationId,
        input.receivedDate,
        input.expirationDate,
        input.qualityStatus || 'RELEASED',
        userId
      ]
    );

    return this.mapLotRow(result.rows[0]);
  }

  @Mutation('updateLotQuantity')
  async updateLotQuantity(
    @Args('id') id: string,
    @Args('newQuantity') newQuantity: number,
    @Args('reason') reason: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE lots
       SET quantity_on_hand = $1,
           quantity_available = $1 - quantity_allocated,
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [newQuantity, userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Lot ${id} not found`);
    }

    return this.mapLotRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - INVENTORY TRANSACTION
  // =====================================================

  @Mutation('recordInventoryTransaction')
  async recordInventoryTransaction(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    // Generate transaction number
    const transNumber = `TXN-${Date.now()}`;

    const result = await this.db.query(
      `INSERT INTO inventory_transactions (
        tenant_id, facility_id, transaction_number, transaction_type,
        material_id, lot_number, quantity, unit_of_measure,
        from_location_id, to_location_id, reason_code, notes,
        performed_by, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        tenantId,
        input.facilityId,
        transNumber,
        input.transactionType,
        input.materialId,
        input.lotNumber,
        input.quantity,
        input.unitOfMeasure,
        input.fromLocationId,
        input.toLocationId,
        input.reasonCode,
        input.notes,
        userId,
        userId
      ]
    );

    // TODO: Update lot quantities based on transaction type

    return this.mapInventoryTransactionRow(result.rows[0]);
  }

  @Mutation('performCycleCount')
  async performCycleCount(
    @Args('locationId') locationId: string,
    @Args('materialId') materialId: string,
    @Args('countedQuantity') countedQuantity: number,
    @Args('notes') notes: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    // Get current quantity
    const lotResult = await this.db.query(
      `SELECT * FROM lots
       WHERE material_id = $1 AND location_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [materialId, locationId]
    );

    if (lotResult.rows.length === 0) {
      throw new Error('No lot found for this material and location');
    }

    const lot = lotResult.rows[0];
    const variance = countedQuantity - parseFloat(lot.quantity_on_hand);

    // Record cycle count transaction
    const transNumber = `CC-${Date.now()}`;

    const result = await this.db.query(
      `INSERT INTO inventory_transactions (
        tenant_id, facility_id, transaction_number, transaction_type,
        material_id, lot_number, quantity, unit_of_measure,
        to_location_id, reason_code, notes, performed_by, created_by
      ) VALUES ($1, $2, $3, 'CYCLE_COUNT', $4, $5, $6, $7, $8, 'CYCLE_COUNT', $9, $10, $11)
      RETURNING *`,
      [
        tenantId,
        lot.facility_id,
        transNumber,
        materialId,
        lot.lot_number,
        variance,
        lot.unit_of_measure,
        locationId,
        notes,
        userId,
        userId
      ]
    );

    // Update lot quantity
    await this.db.query(
      `UPDATE lots SET quantity_on_hand = $1, quantity_available = $1 - quantity_allocated
       WHERE id = $2`,
      [countedQuantity, lot.id]
    );

    return this.mapInventoryTransactionRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - WAVE
  // =====================================================

  @Mutation('createWave')
  async createWave(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO wave_processing (
        tenant_id, facility_id, wave_number, wave_type,
        picking_strategy, priority, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PLANNED', $7)
      RETURNING *`,
      [
        tenantId,
        input.facilityId,
        input.waveNumber,
        input.waveType,
        input.pickingStrategy,
        input.priority || 5,
        userId
      ]
    );

    // TODO: Create wave lines from sales order lines

    return this.mapWaveRow(result.rows[0]);
  }

  @Mutation('releaseWave')
  async releaseWave(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE wave_processing
       SET status = 'RELEASED',
           actual_release_date = NOW(),
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Wave ${id} not found`);
    }

    return this.mapWaveRow(result.rows[0]);
  }

  @Mutation('completeWave')
  async completeWave(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE wave_processing
       SET status = 'COMPLETED',
           actual_completion_date = NOW(),
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Wave ${id} not found`);
    }

    return this.mapWaveRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - PICK LIST
  // =====================================================

  @Mutation('createPickList')
  async createPickList(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    // Get facility from wave
    const waveResult = await this.db.query(
      `SELECT facility_id FROM wave_processing WHERE id = $1`,
      [input.waveId]
    );

    if (waveResult.rows.length === 0) {
      throw new Error('Wave not found');
    }

    const pickListNumber = `PL-${Date.now()}`;

    const result = await this.db.query(
      `INSERT INTO pick_lists (
        tenant_id, facility_id, pick_list_number, wave_id,
        assigned_user_id, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'ASSIGNED', $6)
      RETURNING *`,
      [
        tenantId,
        waveResult.rows[0].facility_id,
        pickListNumber,
        input.waveId,
        input.assignedUserId,
        userId
      ]
    );

    return this.mapPickListRow(result.rows[0]);
  }

  @Mutation('startPickList')
  async startPickList(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE pick_lists
       SET status = 'IN_PROGRESS',
           started_at = NOW(),
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Pick list ${id} not found`);
    }

    return this.mapPickListRow(result.rows[0]);
  }

  @Mutation('completePickList')
  async completePickList(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE pick_lists
       SET status = 'COMPLETED',
           completed_at = NOW(),
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Pick list ${id} not found`);
    }

    return this.mapPickListRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - SHIPMENT
  // =====================================================

  @Mutation('createShipment')
  async createShipment(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const shipmentNumber = `SHP-${Date.now()}`;

    const result = await this.db.query(
      `INSERT INTO shipments (
        tenant_id, facility_id, shipment_number, sales_order_id,
        wave_id, carrier_integration_id, ship_to_name,
        ship_to_address_line1, ship_to_city, ship_to_postal_code,
        ship_to_country, shipment_date, number_of_packages, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PLANNED', $14)
      RETURNING *`,
      [
        tenantId,
        input.facilityId,
        shipmentNumber,
        input.salesOrderId,
        input.waveId,
        input.carrierIntegrationId,
        input.shipToName,
        input.shipToAddressLine1,
        input.shipToCity,
        input.shipToPostalCode,
        input.shipToCountry,
        input.shipDate,
        input.numberOfPackages,
        userId
      ]
    );

    return this.mapShipmentRow(result.rows[0]);
  }

  @Mutation('manifestShipment')
  async manifestShipment(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    // TODO: Call carrier API to manifest and get tracking number

    const result = await this.db.query(
      `UPDATE shipments
       SET status = 'MANIFESTED',
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Shipment ${id} not found`);
    }

    return this.mapShipmentRow(result.rows[0]);
  }

  @Mutation('shipShipment')
  async shipShipment(
    @Args('id') id: string,
    @Args('trackingNumber') trackingNumber: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE shipments
       SET status = 'SHIPPED',
           tracking_number = COALESCE($1, tracking_number),
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [trackingNumber, userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Shipment ${id} not found`);
    }

    return this.mapShipmentRow(result.rows[0]);
  }

  @Mutation('updateShipmentStatus')
  async updateShipmentStatus(
    @Args('id') id: string,
    @Args('status') status: string,
    @Args('notes') notes: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE shipments
       SET status = $1,
           delivery_notes = COALESCE($2, delivery_notes),
           updated_at = NOW(),
           updated_by = $3
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING *`,
      [status, notes, userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Shipment ${id} not found`);
    }

    return this.mapShipmentRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - CARRIER
  // =====================================================

  @Mutation('createCarrierIntegration')
  async createCarrierIntegration(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO carrier_integrations (
        tenant_id, carrier_code, carrier_name, carrier_type,
        api_endpoint, account_number, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        tenantId,
        input.carrierCode,
        input.carrierName,
        input.carrierType,
        input.apiEndpoint,
        input.accountNumber,
        userId
      ]
    );

    return this.mapCarrierIntegrationRow(result.rows[0]);
  }

  @Mutation('updateCarrierIntegration')
  async updateCarrierIntegration(
    @Args('id') id: string,
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.carrierName !== undefined) {
      updates.push(`carrier_name = $${paramIndex++}`);
      values.push(input.carrierName);
    }

    if (input.apiEndpoint !== undefined) {
      updates.push(`api_endpoint = $${paramIndex++}`);
      values.push(input.apiEndpoint);
    }

    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.isActive);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);
    values.push(id);

    const result = await this.db.query(
      `UPDATE carrier_integrations SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Carrier integration ${id} not found`);
    }

    return this.mapCarrierIntegrationRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - KIT
  // =====================================================

  @Mutation('createKitDefinition')
  async createKitDefinition(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Create kit definition
      const kitResult = await client.query(
        `INSERT INTO kit_definitions (
          tenant_id, kit_code, kit_name, description, kit_type, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          tenantId,
          input.kitCode,
          input.kitName,
          input.description,
          input.kitType,
          userId
        ]
      );

      const kitId = kitResult.rows[0].id;

      // Create kit components
      for (let i = 0; i < input.components.length; i++) {
        const comp = input.components[i];
        await client.query(
          `INSERT INTO kit_components (
            tenant_id, kit_id, line_number, component_material_id,
            quantity_per, unit_of_measure, is_required, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            tenantId,
            kitId,
            i + 1,
            comp.componentMaterialId,
            comp.quantityPer,
            comp.unitOfMeasure,
            comp.isRequired !== false,
            userId
          ]
        );
      }

      await client.query('COMMIT');

      return this.mapKitDefinitionRow(kitResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // MUTATIONS - RESERVATION
  // =====================================================

  @Mutation('reserveInventory')
  async reserveInventory(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO inventory_reservations (
        tenant_id, facility_id, material_id, lot_number,
        quantity_reserved, sales_order_id, reservation_type,
        expiration_date, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9)
      RETURNING *`,
      [
        tenantId,
        input.facilityId,
        input.materialId,
        input.lotNumber,
        input.quantityReserved,
        input.salesOrderId,
        input.reservationType,
        input.expirationDate,
        userId
      ]
    );

    // TODO: Update lot quantity_allocated

    return this.mapInventoryReservationRow(result.rows[0]);
  }

  @Mutation('releaseReservation')
  async releaseReservation(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE inventory_reservations
       SET status = 'RELEASED',
           released_at = NOW(),
           released_by = $1
       WHERE id = $2
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Reservation ${id} not found`);
    }

    // TODO: Update lot quantity_allocated

    return this.mapInventoryReservationRow(result.rows[0]);
  }

  // =====================================================
  // MAPPERS
  // =====================================================

  private mapInventoryLocationRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      locationCode: row.location_code,
      locationName: row.location_name,
      barcode: row.barcode,
      zoneCode: row.zone_code,
      aisleCode: row.aisle_code,
      rackCode: row.rack_code,
      shelfCode: row.shelf_code,
      binCode: row.bin_code,
      locationType: row.location_type,
      abcClassification: row.abc_classification,
      lengthInches: row.length_inches,
      widthInches: row.width_inches,
      heightInches: row.height_inches,
      maxWeightLbs: row.max_weight_lbs,
      cubicFeet: row.cubic_feet,
      securityZone: row.security_zone,
      temperatureControlled: row.temperature_controlled,
      temperatureMinF: row.temperature_min_f,
      temperatureMaxF: row.temperature_max_f,
      pickSequence: row.pick_sequence,
      pickZone: row.pick_zone,
      isActive: row.is_active,
      isAvailable: row.is_available,
      blockedReason: row.blocked_reason,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapLotRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      lotNumber: row.lot_number,
      materialId: row.material_id,
      originalQuantity: row.original_quantity,
      quantityOnHand: row.quantity_on_hand,
      quantityAvailable: row.quantity_available,
      quantityAllocated: row.quantity_allocated,
      unitOfMeasure: row.unit_of_measure,
      locationId: row.location_id,
      vendorLotNumber: row.vendor_lot_number,
      purchaseOrderId: row.purchase_order_id,
      productionRunId: row.production_run_id,
      receivedDate: row.received_date,
      manufacturedDate: row.manufactured_date,
      expirationDate: row.expiration_date,
      qualityStatus: row.quality_status,
      qualityInspectionId: row.quality_inspection_id,
      qualityNotes: row.quality_notes,
      customerId: row.customer_id,
      isCustomerOwned: row.is_customer_owned,
      certifications: row.certifications,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapInventoryTransactionRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      transactionNumber: row.transaction_number,
      transactionType: row.transaction_type,
      transactionDate: row.transaction_date,
      materialId: row.material_id,
      lotNumber: row.lot_number,
      quantity: row.quantity,
      unitOfMeasure: row.unit_of_measure,
      fromLocationId: row.from_location_id,
      toLocationId: row.to_location_id,
      purchaseOrderId: row.purchase_order_id,
      salesOrderId: row.sales_order_id,
      productionRunId: row.production_run_id,
      shipmentId: row.shipment_id,
      cycleCountId: row.cycle_count_id,
      reasonCode: row.reason_code,
      notes: row.notes,
      performedBy: row.performed_by,
      createdAt: row.created_at,
      createdBy: row.created_by
    };
  }

  private mapWaveRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      waveNumber: row.wave_number,
      waveType: row.wave_type,
      plannedReleaseDate: row.planned_release_date,
      actualReleaseDate: row.actual_release_date,
      plannedCompletionDate: row.planned_completion_date,
      actualCompletionDate: row.actual_completion_date,
      status: row.status,
      pickingStrategy: row.picking_strategy,
      pickZone: row.pick_zone,
      priority: row.priority,
      assignedUserId: row.assigned_user_id,
      assignedUserName: row.assigned_user_name,
      totalLines: row.total_lines,
      totalQuantity: row.total_quantity,
      pickedLines: row.picked_lines,
      pickedQuantity: row.picked_quantity,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapPickListRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      pickListNumber: row.pick_list_number,
      waveId: row.wave_id,
      assignedUserId: row.assigned_user_id,
      assignedUserName: row.assigned_user_name,
      assignedAt: row.assigned_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      totalLines: row.total_lines,
      pickedLines: row.picked_lines,
      equipmentId: row.equipment_id,
      equipmentType: row.equipment_type,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapShipmentRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      shipmentNumber: row.shipment_number,
      salesOrderId: row.sales_order_id,
      waveId: row.wave_id,
      carrierIntegrationId: row.carrier_integration_id,
      carrierName: row.carrier_name,
      serviceLevel: row.service_level,
      trackingNumber: row.tracking_number,
      proNumber: row.pro_number,
      shipToName: row.ship_to_name,
      shipToAddressLine1: row.ship_to_address_line1,
      shipToAddressLine2: row.ship_to_address_line2,
      shipToCity: row.ship_to_city,
      shipToState: row.ship_to_state,
      shipToPostalCode: row.ship_to_postal_code,
      shipToCountry: row.ship_to_country,
      shipToPhone: row.ship_to_phone,
      shipToEmail: row.ship_to_email,
      shipmentDate: row.shipment_date,
      estimatedDeliveryDate: row.estimated_delivery_date,
      actualDeliveryDate: row.actual_delivery_date,
      numberOfPackages: row.number_of_packages,
      totalWeight: row.total_weight,
      totalVolume: row.total_volume,
      freight: row.freight_cost,
      insurance: row.insurance_cost,
      otherCharges: row.other_charges,
      totalCost: row.total_shipping_cost,
      status: row.status,
      bolNumber: row.bol_number,
      bolDocument: row.bol_document_url,
      commercialInvoice: row.commercial_invoice_url,
      shippingNotes: row.shipping_notes,
      deliveryNotes: row.delivery_notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapCarrierIntegrationRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      carrierCode: row.carrier_code,
      carrierName: row.carrier_name,
      carrierType: row.carrier_type,
      apiEndpoint: row.api_endpoint,
      apiVersion: row.api_version,
      accountNumber: row.account_number,
      serviceMapping: row.service_level_mapping,
      credentialsConfigured: !!row.api_credentials,
      supportsTracking: row.supports_tracking,
      supportsRateQuotes: row.supports_rate_quotes,
      supportsLabelGeneration: row.supports_label_generation,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapKitDefinitionRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      kitCode: row.kit_code,
      kitName: row.kit_name,
      description: row.description,
      kitType: row.kit_type,
      isStocked: row.is_stocked,
      leadTimeDays: row.lead_time_days,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapInventoryReservationRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      materialId: row.material_id,
      lotNumber: row.lot_number,
      quantityReserved: row.quantity_reserved,
      unitOfMeasure: row.unit_of_measure,
      locationId: row.location_id,
      salesOrderId: row.sales_order_id,
      salesOrderLineId: row.sales_order_line_id,
      productionOrderId: row.production_order_id,
      reservationType: row.reservation_type,
      reservedDate: row.reserved_date,
      expirationDate: row.expiration_date,
      status: row.status,
      createdAt: row.created_at,
      createdBy: row.created_by,
      releasedAt: row.released_at,
      releasedBy: row.released_by
    };
  }

  // =====================================================
  // BIN UTILIZATION OPTIMIZATION QUERIES
  // =====================================================

  @Query('suggestPutawayLocation')
  async suggestPutawayLocation(
    @Args('materialId') materialId: string,
    @Args('lotNumber') lotNumber: string,
    @Args('quantity') quantity: number,
    @Args('dimensions') dimensions: any | null,
    @Context() context: any
  ) {
    const result = await this.binOptimizationService.suggestPutawayLocation(
      materialId,
      lotNumber,
      quantity,
      dimensions
    );

    return {
      primary: result.primary,
      alternatives: result.alternatives,
      capacityCheck: result.capacityCheck,
    };
  }

  @Query('analyzeBinUtilization')
  async analyzeBinUtilization(
    @Args('facilityId') facilityId: string,
    @Args('locationId') locationId: string | null,
    @Context() context: any
  ) {
    const metrics = await this.binOptimizationService.calculateBinUtilization(
      facilityId,
      locationId || undefined
    );

    return metrics;
  }

  @Query('getOptimizationRecommendations')
  async getOptimizationRecommendations(
    @Args('facilityId') facilityId: string,
    @Args('threshold') threshold: number = 0.3,
    @Context() context: any
  ) {
    const recommendations = await this.binOptimizationService.generateOptimizationRecommendations(
      facilityId,
      threshold
    );

    return recommendations;
  }

  @Query('analyzeWarehouseUtilization')
  async analyzeWarehouseUtilization(
    @Args('facilityId') facilityId: string,
    @Args('zoneCode') zoneCode: string | null,
    @Context() context: any
  ) {
    const analysis = await this.binOptimizationService.analyzeWarehouseUtilization(
      facilityId,
      zoneCode || undefined
    );

    return {
      facilityId: analysis.facilityId,
      totalLocations: analysis.totalLocations,
      activeLocations: analysis.activeLocations,
      averageUtilization: analysis.averageUtilization,
      utilizationByZone: analysis.utilizationByZone,
      underutilizedLocations: analysis.underutilizedLocations,
      overutilizedLocations: analysis.overutilizedLocations,
      recommendations: analysis.recommendations,
    };
  }
}
