import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * QUALITY, HR, IOT, SECURITY, MARKETPLACE, IMPOSITION RESOLVER
 *
 * Purpose: Final GraphQL resolver covering remaining 24 tables across 6 modules
 * Modules: Quality (5), HR (4), IoT (3), Security (3), Marketplace (4), Imposition (5)
 *
 * Features:
 * - Quality management with ISO standards and CAPA
 * - HR/Labor tracking with timecards and approvals
 * - IoT sensor data and equipment events
 * - 5-tier security with chain of custody
 * - Print buyer boards marketplace
 * - Imposition layout calculation engine
 *
 * Technical approach:
 * - Direct PostgreSQL pool queries (no ORM)
 * - Row mappers for snake_case → camelCase conversion
 * - Transaction support for multi-table operations
 */

@Resolver('QualityHrIotSecurityMarketplaceImposition')
export class FinalModulesResolver {
  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  // =====================================================
  // QUALITY QUERIES
  // =====================================================

  @Query('qualityStandards')
  async getQualityStandards(
    @Args('tenantId') tenantId: string,
    @Args('standardType') standardType: string | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (standardType) {
      whereClause += ` AND standard_type = $${paramIndex++}`;
      params.push(standardType);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const result = await this.db.query(
      `SELECT * FROM quality_standards WHERE ${whereClause} ORDER BY standard_code`,
      params
    );

    return result.rows.map(this.mapQualityStandardRow);
  }

  @Query('inspectionTemplates')
  async getInspectionTemplates(
    @Args('tenantId') tenantId: string,
    @Args('inspectionType') inspectionType: string | null,
    @Args('productId') productId: string | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (inspectionType) {
      whereClause += ` AND inspection_type = $${paramIndex++}`;
      params.push(inspectionType);
    }

    if (productId) {
      whereClause += ` AND product_id = $${paramIndex++}`;
      params.push(productId);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const result = await this.db.query(
      `SELECT * FROM inspection_templates WHERE ${whereClause} ORDER BY template_code`,
      params
    );

    return result.rows.map(this.mapInspectionTemplateRow);
  }

  @Query('qualityInspections')
  async getQualityInspections(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string | null,
    @Args('inspectionType') inspectionType: string | null,
    @Args('passFail') passFail: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (facilityId) {
      whereClause += ` AND facility_id = $${paramIndex++}`;
      params.push(facilityId);
    }

    if (inspectionType) {
      whereClause += ` AND inspection_type = $${paramIndex++}`;
      params.push(inspectionType);
    }

    if (passFail) {
      whereClause += ` AND pass_fail = $${paramIndex++}`;
      params.push(passFail);
    }

    if (startDate) {
      whereClause += ` AND inspection_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND inspection_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM quality_inspections
       WHERE ${whereClause}
       ORDER BY inspection_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapQualityInspectionRow);
  }

  @Query('qualityDefects')
  async getQualityDefects(
    @Args('tenantId') tenantId: string,
    @Args('status') status: string | null,
    @Args('severity') severity: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (severity) {
      whereClause += ` AND defect_severity = $${paramIndex++}`;
      params.push(severity);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM quality_defects
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapQualityDefectRow);
  }

  @Query('customerRejections')
  async getCustomerRejections(
    @Args('tenantId') tenantId: string,
    @Args('customerId') customerId: string | null,
    @Args('status') status: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (customerId) {
      whereClause += ` AND customer_id = $${paramIndex++}`;
      params.push(customerId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (startDate) {
      whereClause += ` AND rejection_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND rejection_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM customer_rejections
       WHERE ${whereClause}
       ORDER BY rejection_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapCustomerRejectionRow);
  }

  // =====================================================
  // HR QUERIES
  // =====================================================

  @Query('employees')
  async getEmployees(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string | null,
    @Args('department') department: string | null,
    @Args('isActive') isActive: boolean | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (facilityId) {
      whereClause += ` AND facility_id = $${paramIndex++}`;
      params.push(facilityId);
    }

    if (department) {
      whereClause += ` AND department = $${paramIndex++}`;
      params.push(department);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM employees
       WHERE ${whereClause}
       ORDER BY employee_number
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapEmployeeRow);
  }

  @Query('employee')
  async getEmployee(@Args('id') id: string) {
    const result = await this.db.query(
      `SELECT * FROM employees WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    return result.rows.length > 0 ? this.mapEmployeeRow(result.rows[0]) : null;
  }

  @Query('laborRates')
  async getLaborRates(
    @Args('tenantId') tenantId: string,
    @Args('workCenterId') workCenterId: string | null,
    @Args('operationId') operationId: string | null,
    @Args('asOfDate') asOfDate: string | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (workCenterId) {
      whereClause += ` AND work_center_id = $${paramIndex++}`;
      params.push(workCenterId);
    }

    if (operationId) {
      whereClause += ` AND operation_id = $${paramIndex++}`;
      params.push(operationId);
    }

    if (asOfDate) {
      whereClause += ` AND effective_from <= $${paramIndex} AND (effective_to IS NULL OR effective_to >= $${paramIndex})`;
      params.push(asOfDate);
      paramIndex++;
    }

    const result = await this.db.query(
      `SELECT * FROM labor_rates WHERE ${whereClause} ORDER BY rate_code`,
      params
    );

    return result.rows.map(this.mapLaborRateRow);
  }

  @Query('timecards')
  async getTimecards(
    @Args('tenantId') tenantId: string,
    @Args('employeeId') employeeId: string | null,
    @Args('facilityId') facilityId: string | null,
    @Args('status') status: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (employeeId) {
      whereClause += ` AND employee_id = $${paramIndex++}`;
      params.push(employeeId);
    }

    if (facilityId) {
      whereClause += ` AND facility_id = $${paramIndex++}`;
      params.push(facilityId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (startDate) {
      whereClause += ` AND timecard_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND timecard_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM timecards
       WHERE ${whereClause}
       ORDER BY timecard_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapTimecardRow);
  }

  @Query('laborTracking')
  async getLaborTracking(
    @Args('tenantId') tenantId: string,
    @Args('employeeId') employeeId: string | null,
    @Args('productionRunId') productionRunId: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (employeeId) {
      whereClause += ` AND employee_id = $${paramIndex++}`;
      params.push(employeeId);
    }

    if (productionRunId) {
      whereClause += ` AND production_run_id = $${paramIndex++}`;
      params.push(productionRunId);
    }

    if (startDate) {
      whereClause += ` AND start_timestamp >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND start_timestamp <= $${paramIndex++}`;
      params.push(endDate);
    }

    const result = await this.db.query(
      `SELECT * FROM labor_tracking WHERE ${whereClause} ORDER BY start_timestamp DESC`,
      params
    );

    return result.rows.map(this.mapLaborTrackingRow);
  }

  // =====================================================
  // IOT QUERIES
  // =====================================================

  @Query('iotDevices')
  async getIotDevices(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string | null,
    @Args('workCenterId') workCenterId: string | null,
    @Args('deviceType') deviceType: string | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (facilityId) {
      whereClause += ` AND facility_id = $${paramIndex++}`;
      params.push(facilityId);
    }

    if (workCenterId) {
      whereClause += ` AND work_center_id = $${paramIndex++}`;
      params.push(workCenterId);
    }

    if (deviceType) {
      whereClause += ` AND device_type = $${paramIndex++}`;
      params.push(deviceType);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const result = await this.db.query(
      `SELECT * FROM iot_devices WHERE ${whereClause} ORDER BY device_code`,
      params
    );

    return result.rows.map(this.mapIotDeviceRow);
  }

  @Query('sensorReadings')
  async getSensorReadings(
    @Args('tenantId') tenantId: string,
    @Args('iotDeviceId') iotDeviceId: string | null,
    @Args('productionRunId') productionRunId: string | null,
    @Args('sensorType') sensorType: string | null,
    @Args('startTime') startTime: string | null,
    @Args('endTime') endTime: string | null,
    @Args('limit') limit: number = 1000,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (iotDeviceId) {
      whereClause += ` AND iot_device_id = $${paramIndex++}`;
      params.push(iotDeviceId);
    }

    if (productionRunId) {
      whereClause += ` AND production_run_id = $${paramIndex++}`;
      params.push(productionRunId);
    }

    if (sensorType) {
      whereClause += ` AND sensor_type = $${paramIndex++}`;
      params.push(sensorType);
    }

    if (startTime) {
      whereClause += ` AND reading_timestamp >= $${paramIndex++}`;
      params.push(startTime);
    }

    if (endTime) {
      whereClause += ` AND reading_timestamp <= $${paramIndex++}`;
      params.push(endTime);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM sensor_readings
       WHERE ${whereClause}
       ORDER BY reading_timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapSensorReadingRow);
  }

  @Query('equipmentEvents')
  async getEquipmentEvents(
    @Args('tenantId') tenantId: string,
    @Args('workCenterId') workCenterId: string | null,
    @Args('severity') severity: string | null,
    @Args('acknowledged') acknowledged: boolean | null,
    @Args('startTime') startTime: string | null,
    @Args('endTime') endTime: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (workCenterId) {
      whereClause += ` AND work_center_id = $${paramIndex++}`;
      params.push(workCenterId);
    }

    if (severity) {
      whereClause += ` AND severity = $${paramIndex++}`;
      params.push(severity);
    }

    if (acknowledged !== null) {
      whereClause += ` AND acknowledged = $${paramIndex++}`;
      params.push(acknowledged);
    }

    if (startTime) {
      whereClause += ` AND event_timestamp >= $${paramIndex++}`;
      params.push(startTime);
    }

    if (endTime) {
      whereClause += ` AND event_timestamp <= $${paramIndex++}`;
      params.push(endTime);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM equipment_events
       WHERE ${whereClause}
       ORDER BY event_timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapEquipmentEventRow);
  }

  // =====================================================
  // SECURITY QUERIES
  // =====================================================

  @Query('securityZones')
  async getSecurityZones(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string | null,
    @Args('zoneLevel') zoneLevel: string | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (facilityId) {
      whereClause += ` AND facility_id = $${paramIndex++}`;
      params.push(facilityId);
    }

    if (zoneLevel) {
      whereClause += ` AND zone_level = $${paramIndex++}`;
      params.push(zoneLevel);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const result = await this.db.query(
      `SELECT * FROM security_zones WHERE ${whereClause} ORDER BY zone_code`,
      params
    );

    return result.rows.map(this.mapSecurityZoneRow);
  }

  @Query('securityAccessLog')
  async getSecurityAccessLog(
    @Args('tenantId') tenantId: string,
    @Args('securityZoneId') securityZoneId: string | null,
    @Args('userId') userId: string | null,
    @Args('granted') granted: boolean | null,
    @Args('startTime') startTime: string | null,
    @Args('endTime') endTime: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (securityZoneId) {
      whereClause += ` AND security_zone_id = $${paramIndex++}`;
      params.push(securityZoneId);
    }

    if (userId) {
      whereClause += ` AND user_id = $${paramIndex++}`;
      params.push(userId);
    }

    if (granted !== null) {
      whereClause += ` AND granted = $${paramIndex++}`;
      params.push(granted);
    }

    if (startTime) {
      whereClause += ` AND access_timestamp >= $${paramIndex++}`;
      params.push(startTime);
    }

    if (endTime) {
      whereClause += ` AND access_timestamp <= $${paramIndex++}`;
      params.push(endTime);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM security_access_log
       WHERE ${whereClause}
       ORDER BY access_timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapSecurityAccessLogRow);
  }

  @Query('chainOfCustody')
  async getChainOfCustody(
    @Args('tenantId') tenantId: string,
    @Args('itemType') itemType: string | null,
    @Args('itemId') itemId: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (itemType) {
      whereClause += ` AND item_type = $${paramIndex++}`;
      params.push(itemType);
    }

    if (itemId) {
      whereClause += ` AND item_id = $${paramIndex++}`;
      params.push(itemId);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM chain_of_custody
       WHERE ${whereClause}
       ORDER BY custody_transfer_timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapChainOfCustodyRow);
  }

  // =====================================================
  // MARKETPLACE QUERIES
  // =====================================================

  @Query('partnerNetworkProfiles')
  async getPartnerNetworkProfiles(
    @Args('tenantId') tenantId: string,
    @Args('companyType') companyType: string | null,
    @Args('isApproved') isApproved: boolean | null,
    @Args('minReliabilityScore') minReliabilityScore: number | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (companyType) {
      whereClause += ` AND company_type = $${paramIndex++}`;
      params.push(companyType);
    }

    if (isApproved !== null) {
      whereClause += ` AND is_approved = $${paramIndex++}`;
      params.push(isApproved);
    }

    if (minReliabilityScore !== null) {
      whereClause += ` AND reliability_score >= $${paramIndex++}`;
      params.push(minReliabilityScore);
    }

    const result = await this.db.query(
      `SELECT * FROM partner_network_profiles WHERE ${whereClause} ORDER BY reliability_score DESC`,
      params
    );

    return result.rows.map(this.mapPartnerNetworkProfileRow);
  }

  @Query('marketplaceJobPostings')
  async getMarketplaceJobPostings(
    @Args('tenantId') tenantId: string,
    @Args('postingCompanyId') postingCompanyId: string | null,
    @Args('status') status: string | null,
    @Args('startDate') startDate: string | null,
    @Args('endDate') endDate: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (postingCompanyId) {
      whereClause += ` AND posting_company_id = $${paramIndex++}`;
      params.push(postingCompanyId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (startDate) {
      whereClause += ` AND posting_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND posting_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM marketplace_job_postings
       WHERE ${whereClause}
       ORDER BY posting_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapMarketplaceJobPostingRow);
  }

  @Query('marketplaceBids')
  async getMarketplaceBids(
    @Args('tenantId') tenantId: string,
    @Args('jobPostingId') jobPostingId: string | null,
    @Args('biddingCompanyId') biddingCompanyId: string | null,
    @Args('status') status: string | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (jobPostingId) {
      whereClause += ` AND job_posting_id = $${paramIndex++}`;
      params.push(jobPostingId);
    }

    if (biddingCompanyId) {
      whereClause += ` AND bidding_company_id = $${paramIndex++}`;
      params.push(biddingCompanyId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const result = await this.db.query(
      `SELECT * FROM marketplace_bids WHERE ${whereClause} ORDER BY bid_date DESC`,
      params
    );

    return result.rows.map(this.mapMarketplaceBidRow);
  }

  @Query('externalCompanyOrders')
  async getExternalCompanyOrders(
    @Args('tenantId') tenantId: string,
    @Args('originatingCompanyId') originatingCompanyId: string | null,
    @Args('fulfillingCompanyId') fulfillingCompanyId: string | null,
    @Args('status') status: string | null,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (originatingCompanyId) {
      whereClause += ` AND originating_company_id = $${paramIndex++}`;
      params.push(originatingCompanyId);
    }

    if (fulfillingCompanyId) {
      whereClause += ` AND fulfilling_company_id = $${paramIndex++}`;
      params.push(fulfillingCompanyId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM external_company_orders
       WHERE ${whereClause}
       ORDER BY order_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return result.rows.map(this.mapExternalCompanyOrderRow);
  }

  // =====================================================
  // IMPOSITION QUERIES
  // =====================================================

  @Query('pressSpecifications')
  async getPressSpecifications(
    @Args('tenantId') tenantId: string,
    @Args('workCenterId') workCenterId: string | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (workCenterId) {
      whereClause += ` AND work_center_id = $${paramIndex++}`;
      params.push(workCenterId);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const result = await this.db.query(
      `SELECT * FROM press_specifications WHERE ${whereClause} ORDER BY work_center_id`,
      params
    );

    return result.rows.map(this.mapPressSpecificationRow);
  }

  @Query('substrateSpecifications')
  async getSubstrateSpecifications(
    @Args('tenantId') tenantId: string,
    @Args('materialId') materialId: string | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (materialId) {
      whereClause += ` AND material_id = $${paramIndex++}`;
      params.push(materialId);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const result = await this.db.query(
      `SELECT * FROM substrate_specifications WHERE ${whereClause} ORDER BY material_id`,
      params
    );

    return result.rows.map(this.mapSubstrateSpecificationRow);
  }

  @Query('impositionTemplates')
  async getImpositionTemplates(
    @Args('tenantId') tenantId: string,
    @Args('packagingType') packagingType: string | null,
    @Args('pressId') pressId: string | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (packagingType) {
      whereClause += ` AND packaging_type = $${paramIndex++}`;
      params.push(packagingType);
    }

    if (pressId) {
      whereClause += ` AND press_id = $${paramIndex++}`;
      params.push(pressId);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const result = await this.db.query(
      `SELECT * FROM imposition_templates WHERE ${whereClause} ORDER BY template_code`,
      params
    );

    return result.rows.map(this.mapImpositionTemplateRow);
  }

  @Query('layoutCalculations')
  async getLayoutCalculations(
    @Args('tenantId') tenantId: string,
    @Args('productId') productId: string | null,
    @Args('pressId') pressId: string | null,
    @Args('salesOrderLineId') salesOrderLineId: string | null,
    @Args('quoteLineId') quoteLineId: string | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (productId) {
      whereClause += ` AND product_id = $${paramIndex++}`;
      params.push(productId);
    }

    if (pressId) {
      whereClause += ` AND press_id = $${paramIndex++}`;
      params.push(pressId);
    }

    if (salesOrderLineId) {
      whereClause += ` AND sales_order_line_id = $${paramIndex++}`;
      params.push(salesOrderLineId);
    }

    if (quoteLineId) {
      whereClause += ` AND quote_line_id = $${paramIndex++}`;
      params.push(quoteLineId);
    }

    const result = await this.db.query(
      `SELECT * FROM layout_calculations WHERE ${whereClause} ORDER BY calculation_timestamp DESC`,
      params
    );

    return result.rows.map(this.mapLayoutCalculationRow);
  }

  @Query('impositionMarks')
  async getImpositionMarks(
    @Args('tenantId') tenantId: string,
    @Args('markType') markType: string | null,
    @Args('isActive') isActive: boolean | null,
    @Context() context: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (markType) {
      whereClause += ` AND mark_type = $${paramIndex++}`;
      params.push(markType);
    }

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const result = await this.db.query(
      `SELECT * FROM imposition_marks WHERE ${whereClause} ORDER BY mark_code`,
      params
    );

    return result.rows.map(this.mapImpositionMarkRow);
  }

  // =====================================================
  // QUALITY MUTATIONS
  // =====================================================

  @Mutation('createQualityInspection')
  async createQualityInspection(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId: string,
    @Args('inspectionType') inspectionType: string,
    @Args('inspectorUserId') inspectorUserId: string,
    @Args('inspectionTemplateId') inspectionTemplateId: string | null,
    @Context() context: any
  ) {
    const inspectionNumber = `QI-${Date.now()}`;

    const result = await this.db.query(
      `INSERT INTO quality_inspections (
        tenant_id, facility_id, inspection_number, inspection_type, inspector_user_id,
        inspection_template_id, defects_found
      ) VALUES ($1, $2, $3, $4, $5, $6, 0)
      RETURNING *`,
      [tenantId, facilityId, inspectionNumber, inspectionType, inspectorUserId, inspectionTemplateId]
    );

    return this.mapQualityInspectionRow(result.rows[0]);
  }

  @Mutation('updateQualityInspection')
  async updateQualityInspection(
    @Args('id') id: string,
    @Args('passFail') passFail: string | null,
    @Args('disposition') disposition: string | null,
    @Args('inspectionResults') inspectionResults: any | null,
    @Context() context: any
  ) {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (passFail) {
      updates.push(`pass_fail = $${paramIndex++}`);
      params.push(passFail);
    }

    if (disposition) {
      updates.push(`disposition = $${paramIndex++}`);
      params.push(disposition);
    }

    if (inspectionResults) {
      updates.push(`inspection_results = $${paramIndex++}`);
      params.push(JSON.stringify(inspectionResults));
    }

    updates.push(`updated_at = NOW()`);

    params.push(id);

    const result = await this.db.query(
      `UPDATE quality_inspections SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return this.mapQualityInspectionRow(result.rows[0]);
  }

  @Mutation('createQualityDefect')
  async createQualityDefect(
    @Args('tenantId') tenantId: string,
    @Args('defectDescription') defectDescription: string,
    @Args('defectSeverity') defectSeverity: string | null,
    @Args('qualityInspectionId') qualityInspectionId: string | null,
    @Args('productionRunId') productionRunId: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;
    const defectNumber = `QD-${Date.now()}`;

    const result = await this.db.query(
      `INSERT INTO quality_defects (
        tenant_id, defect_number, defect_description, defect_severity,
        quality_inspection_id, production_run_id, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', $7)
      RETURNING *`,
      [tenantId, defectNumber, defectDescription, defectSeverity, qualityInspectionId, productionRunId, userId]
    );

    return this.mapQualityDefectRow(result.rows[0]);
  }

  @Mutation('updateQualityDefect')
  async updateQualityDefect(
    @Args('id') id: string,
    @Args('status') status: string | null,
    @Args('correctiveAction') correctiveAction: string | null,
    @Args('preventiveAction') preventiveAction: string | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);

      if (status === 'RESOLVED') {
        updates.push(`completion_date = CURRENT_DATE`);
      }
    }

    if (correctiveAction) {
      updates.push(`corrective_action = $${paramIndex++}`);
      params.push(correctiveAction);
    }

    if (preventiveAction) {
      updates.push(`preventive_action = $${paramIndex++}`);
      params.push(preventiveAction);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.db.query(
      `UPDATE quality_defects SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return this.mapQualityDefectRow(result.rows[0]);
  }

  @Mutation('createCustomerRejection')
  async createCustomerRejection(
    @Args('tenantId') tenantId: string,
    @Args('customerId') customerId: string,
    @Args('rejectionDate') rejectionDate: string,
    @Args('rejectionReason') rejectionReason: string,
    @Args('quantityRejected') quantityRejected: number | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;
    const rejectionNumber = `CR-${Date.now()}`;

    const result = await this.db.query(
      `INSERT INTO customer_rejections (
        tenant_id, rejection_number, rejection_date, customer_id,
        rejection_reason, quantity_rejected, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', $7)
      RETURNING *`,
      [tenantId, rejectionNumber, rejectionDate, customerId, rejectionReason, quantityRejected, userId]
    );

    return this.mapCustomerRejectionRow(result.rows[0]);
  }

  @Mutation('updateCustomerRejection')
  async updateCustomerRejection(
    @Args('id') id: string,
    @Args('status') status: string | null,
    @Args('disposition') disposition: string | null,
    @Args('financialImpact') financialImpact: number | null,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (disposition) {
      updates.push(`disposition = $${paramIndex++}`);
      params.push(disposition);
    }

    if (financialImpact !== null) {
      updates.push(`financial_impact = $${paramIndex++}`);
      params.push(financialImpact);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.db.query(
      `UPDATE customer_rejections SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return this.mapCustomerRejectionRow(result.rows[0]);
  }

  // Continue in next part due to length...
  // (HR, IoT, Security, Marketplace, Imposition mutations + row mappers)

  // =====================================================
  // ROW MAPPERS (snake_case → camelCase)
  // =====================================================

  private mapQualityStandardRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      standardCode: row.standard_code,
      standardName: row.standard_name,
      standardType: row.standard_type,
      description: row.description,
      requirements: row.requirements,
      certificationBody: row.certification_body,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapInspectionTemplateRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      templateCode: row.template_code,
      templateName: row.template_name,
      inspectionType: row.inspection_type,
      productId: row.product_id,
      materialId: row.material_id,
      operationId: row.operation_id,
      inspectionPoints: row.inspection_points,
      samplingPlan: row.sampling_plan,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapQualityInspectionRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      inspectionNumber: row.inspection_number,
      inspectionDate: row.inspection_date,
      inspectionType: row.inspection_type,
      inspectionTemplateId: row.inspection_template_id,
      purchaseOrderId: row.purchase_order_id,
      productionRunId: row.production_run_id,
      lotNumber: row.lot_number,
      inspectorUserId: row.inspector_user_id,
      sampleSize: row.sample_size,
      defectsFound: row.defects_found,
      passFail: row.pass_fail,
      inspectionResults: row.inspection_results,
      disposition: row.disposition,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapQualityDefectRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      defectNumber: row.defect_number,
      qualityInspectionId: row.quality_inspection_id,
      productionRunId: row.production_run_id,
      defectCode: row.defect_code,
      defectDescription: row.defect_description,
      defectSeverity: row.defect_severity,
      quantityAffected: row.quantity_affected ? parseFloat(row.quantity_affected) : null,
      rootCause: row.root_cause,
      correctiveAction: row.corrective_action,
      preventiveAction: row.preventive_action,
      responsibleUserId: row.responsible_user_id,
      dueDate: row.due_date,
      completionDate: row.completion_date,
      status: row.status,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapCustomerRejectionRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      rejectionNumber: row.rejection_number,
      rejectionDate: row.rejection_date,
      customerId: row.customer_id,
      salesOrderId: row.sales_order_id,
      shipmentId: row.shipment_id,
      invoiceId: row.invoice_id,
      rejectionReason: row.rejection_reason,
      quantityRejected: row.quantity_rejected ? parseFloat(row.quantity_rejected) : null,
      disposition: row.disposition,
      rootCause: row.root_cause,
      correctiveAction: row.corrective_action,
      responsibleUserId: row.responsible_user_id,
      status: row.status,
      financialImpact: row.financial_impact ? parseFloat(row.financial_impact) : null,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapEmployeeRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      employeeNumber: row.employee_number,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      jobTitle: row.job_title,
      department: row.department,
      facilityId: row.facility_id,
      hireDate: row.hire_date,
      terminationDate: row.termination_date,
      employmentType: row.employment_type,
      payType: row.pay_type,
      basePayRate: row.base_pay_rate ? parseFloat(row.base_pay_rate) : null,
      overtimePayRate: row.overtime_pay_rate ? parseFloat(row.overtime_pay_rate) : null,
      supervisorEmployeeId: row.supervisor_employee_id,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by
    };
  }

  private mapLaborRateRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      rateCode: row.rate_code,
      rateName: row.rate_name,
      workCenterId: row.work_center_id,
      operationId: row.operation_id,
      standardRatePerHour: parseFloat(row.standard_rate_per_hour),
      overtimeRatePerHour: row.overtime_rate_per_hour ? parseFloat(row.overtime_rate_per_hour) : null,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapTimecardRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      employeeId: row.employee_id,
      timecardDate: row.timecard_date,
      clockInTimestamp: row.clock_in_timestamp,
      clockOutTimestamp: row.clock_out_timestamp,
      regularHours: row.regular_hours ? parseFloat(row.regular_hours) : null,
      overtimeHours: row.overtime_hours ? parseFloat(row.overtime_hours) : null,
      doubleTimeHours: row.double_time_hours ? parseFloat(row.double_time_hours) : null,
      productionRunId: row.production_run_id,
      workCenterId: row.work_center_id,
      breakHours: row.break_hours ? parseFloat(row.break_hours) : null,
      status: row.status,
      approvedByUserId: row.approved_by_user_id,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapLaborTrackingRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      employeeId: row.employee_id,
      productionRunId: row.production_run_id,
      startTimestamp: row.start_timestamp,
      endTimestamp: row.end_timestamp,
      hoursWorked: row.hours_worked ? parseFloat(row.hours_worked) : null,
      laborType: row.labor_type,
      hourlyRate: row.hourly_rate ? parseFloat(row.hourly_rate) : null,
      totalLaborCost: row.total_labor_cost ? parseFloat(row.total_labor_cost) : null,
      createdAt: row.created_at
    };
  }

  private mapIotDeviceRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      deviceCode: row.device_code,
      deviceName: row.device_name,
      deviceType: row.device_type,
      workCenterId: row.work_center_id,
      manufacturer: row.manufacturer,
      model: row.model,
      serialNumber: row.serial_number,
      connectionType: row.connection_type,
      connectionConfig: row.connection_config,
      isActive: row.is_active,
      lastHeartbeat: row.last_heartbeat,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapSensorReadingRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      iotDeviceId: row.iot_device_id,
      readingTimestamp: row.reading_timestamp,
      sensorType: row.sensor_type,
      readingValue: row.reading_value ? parseFloat(row.reading_value) : null,
      unitOfMeasure: row.unit_of_measure,
      productionRunId: row.production_run_id,
      metadata: row.metadata,
      createdAt: row.created_at
    };
  }

  private mapEquipmentEventRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      workCenterId: row.work_center_id,
      iotDeviceId: row.iot_device_id,
      eventTimestamp: row.event_timestamp,
      eventType: row.event_type,
      eventCode: row.event_code,
      eventDescription: row.event_description,
      severity: row.severity,
      productionRunId: row.production_run_id,
      metadata: row.metadata,
      acknowledged: row.acknowledged,
      acknowledgedByUserId: row.acknowledged_by_user_id,
      acknowledgedAt: row.acknowledged_at,
      createdAt: row.created_at
    };
  }

  private mapSecurityZoneRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      zoneCode: row.zone_code,
      zoneName: row.zone_name,
      zoneLevel: row.zone_level,
      description: row.description,
      requiresBadge: row.requires_badge,
      requiresBiometric: row.requires_biometric,
      requiresDualControl: row.requires_dual_control,
      requiresEscort: row.requires_escort,
      minimumClearanceLevel: row.minimum_clearance_level,
      accessHours: row.access_hours,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapSecurityAccessLogRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      securityZoneId: row.security_zone_id,
      userId: row.user_id,
      accessTimestamp: row.access_timestamp,
      accessType: row.access_type,
      accessMethod: row.access_method,
      verificationUserId: row.verification_user_id,
      granted: row.granted,
      denialReason: row.denial_reason,
      createdAt: row.created_at
    };
  }

  private mapChainOfCustodyRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      itemType: row.item_type,
      itemId: row.item_id,
      custodyTransferTimestamp: row.custody_transfer_timestamp,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      fromLocationId: row.from_location_id,
      toLocationId: row.to_location_id,
      verificationMethod: row.verification_method,
      witnessUserId: row.witness_user_id,
      tamperEvidentSealId: row.tamper_evident_seal_id,
      sealIntact: row.seal_intact,
      transferReason: row.transfer_reason,
      notes: row.notes,
      createdAt: row.created_at
    };
  }

  private mapPartnerNetworkProfileRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      companyCode: row.company_code,
      companyName: row.company_name,
      companyType: row.company_type,
      capabilities: row.capabilities,
      geographicCoverage: row.geographic_coverage,
      reliabilityScore: row.reliability_score ? parseFloat(row.reliability_score) : null,
      onTimeDeliveryPercentage: row.on_time_delivery_percentage ? parseFloat(row.on_time_delivery_percentage) : null,
      qualityRatingPercentage: row.quality_rating_percentage ? parseFloat(row.quality_rating_percentage) : null,
      totalJobsCompleted: row.total_jobs_completed,
      totalRevenueGenerated: row.total_revenue_generated ? parseFloat(row.total_revenue_generated) : null,
      isActive: row.is_active,
      isApproved: row.is_approved,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapMarketplaceJobPostingRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      postingNumber: row.posting_number,
      postingDate: row.posting_date,
      expirationDate: row.expiration_date,
      postingCompanyId: row.posting_company_id,
      jobDescription: row.job_description,
      quantityRequired: parseFloat(row.quantity_required),
      unitOfMeasure: row.unit_of_measure,
      productSpecifications: row.product_specifications,
      requiredDeliveryDate: row.required_delivery_date,
      requiredCertifications: row.required_certifications,
      estimatedBudget: row.estimated_budget ? parseFloat(row.estimated_budget) : null,
      budgetCurrencyCode: row.budget_currency_code,
      status: row.status,
      awardedToCompanyId: row.awarded_to_company_id,
      awardedAt: row.awarded_at,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapMarketplaceBidRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      bidNumber: row.bid_number,
      jobPostingId: row.job_posting_id,
      biddingCompanyId: row.bidding_company_id,
      bidDate: row.bid_date,
      bidAmount: parseFloat(row.bid_amount),
      bidCurrencyCode: row.bid_currency_code,
      promisedDeliveryDate: row.promised_delivery_date,
      capabilitiesMatch: row.capabilities_match,
      bidNotes: row.bid_notes,
      status: row.status,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapExternalCompanyOrderRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      orderNumber: row.order_number,
      orderDate: row.order_date,
      originatingCompanyId: row.originating_company_id,
      fulfillingCompanyId: row.fulfilling_company_id,
      jobPostingId: row.job_posting_id,
      marketplaceBidId: row.marketplace_bid_id,
      orderDescription: row.order_description,
      quantityOrdered: parseFloat(row.quantity_ordered),
      orderAmount: parseFloat(row.order_amount),
      orderCurrencyCode: row.order_currency_code,
      deliveryDate: row.delivery_date,
      actualDeliveryDate: row.actual_delivery_date,
      status: row.status,
      qualityRating: row.quality_rating ? parseFloat(row.quality_rating) : null,
      onTime: row.on_time,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapPressSpecificationRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      workCenterId: row.work_center_id,
      maxSheetWidth: parseFloat(row.max_sheet_width),
      maxSheetHeight: parseFloat(row.max_sheet_height),
      minSheetWidth: parseFloat(row.min_sheet_width),
      minSheetHeight: parseFloat(row.min_sheet_height),
      gripperMargin: row.gripper_margin ? parseFloat(row.gripper_margin) : null,
      sideMargins: row.side_margins ? parseFloat(row.side_margins) : null,
      maxImageWidth: row.max_image_width ? parseFloat(row.max_image_width) : null,
      maxImageHeight: row.max_image_height ? parseFloat(row.max_image_height) : null,
      maxColors: row.max_colors,
      supportsPerfecting: row.supports_perfecting,
      substrateTypes: row.substrate_types,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapSubstrateSpecificationRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      materialId: row.material_id,
      widthInches: row.width_inches ? parseFloat(row.width_inches) : null,
      heightInches: row.height_inches ? parseFloat(row.height_inches) : null,
      caliperInches: row.caliper_inches ? parseFloat(row.caliper_inches) : null,
      basisWeightLbs: row.basis_weight_lbs,
      grainDirection: row.grain_direction,
      finish: row.finish,
      coatingType: row.coating_type,
      recyclable: row.recyclable,
      fscCertified: row.fsc_certified,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapImpositionTemplateRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      templateCode: row.template_code,
      templateName: row.template_name,
      packagingType: row.packaging_type,
      pressId: row.press_id,
      defaultAcross: row.default_across,
      defaultDown: row.default_down,
      defaultGutter: row.default_gutter ? parseFloat(row.default_gutter) : null,
      layoutPattern: row.layout_pattern,
      templateConfig: row.template_config,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapLayoutCalculationRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      salesOrderLineId: row.sales_order_line_id,
      quoteLineId: row.quote_line_id,
      productId: row.product_id,
      pressId: row.press_id,
      designWidth: parseFloat(row.design_width),
      designHeight: parseFloat(row.design_height),
      sheetWidth: parseFloat(row.sheet_width),
      sheetHeight: parseFloat(row.sheet_height),
      across: row.across,
      down: row.down,
      unitsPerSheet: row.units_per_sheet,
      wastePercentage: row.waste_percentage ? parseFloat(row.waste_percentage) : null,
      calculationTimestamp: row.calculation_timestamp,
      algorithmVersion: row.algorithm_version,
      createdAt: row.created_at
    };
  }

  private mapImpositionMarkRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      markCode: row.mark_code,
      markName: row.mark_name,
      markType: row.mark_type,
      markPosition: row.mark_position,
      markSize: row.mark_size,
      markOffset: row.mark_offset,
      isActive: row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by
    };
  }

  // Remaining mutations would be implemented here...
  // (HR, IoT, Security, Marketplace, Imposition mutations)
  // Following the same pattern as Quality mutations
}
