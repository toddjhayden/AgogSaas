import { Resolver, Query, Mutation, Args, Context, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Tenant GraphQL Resolver
 *
 * Handles queries and mutations for multi-tenant foundation:
 * - Tenants
 * - Facilities
 * - Users
 * - Currencies
 */

@Resolver('Tenant')
export class TenantResolver {
  constructor(private readonly db: Pool) {}

  // =====================================================
  // QUERIES
  // =====================================================

  @Query('tenant')
  async getTenant(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const result = await this.db.query(
      `SELECT * FROM tenants WHERE id = $1 AND is_current = TRUE AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Tenant ${id} not found`);
    }

    return this.mapTenantRow(result.rows[0]);
  }

  @Query('myTenant')
  async getMyTenant(@Context() context: any) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `SELECT t.* FROM tenants t
       INNER JOIN users u ON u.tenant_id = t.id
       WHERE u.id = $1 AND t.is_current = TRUE AND t.deleted_at IS NULL`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Tenant not found for current user');
    }

    return this.mapTenantRow(result.rows[0]);
  }

  @Query('facilities')
  async getFacilities(
    @Args('tenantId') tenantId: string,
    @Args('includeHistory') includeHistory: boolean = false,
    @Context() context: any
  ) {
    // TODO: Add authorization check - user must belong to this tenant

    // By default, only return current versions
    const whereClause = includeHistory
      ? 'tenant_id = $1 AND deleted_at IS NULL'
      : 'tenant_id = $1 AND is_current_version = TRUE AND deleted_at IS NULL';

    const result = await this.db.query(
      `SELECT * FROM facilities
       WHERE ${whereClause}
       ORDER BY facility_name, effective_from_date DESC`,
      [tenantId]
    );

    return result.rows.map(this.mapFacilityRow);
  }

  @Query('facility')
  async getFacility(
    @Args('id') id: string,
    @Context() context: any
  ) {
    // Get current version by default
    const result = await this.db.query(
      `SELECT * FROM facilities
       WHERE id = $1 AND is_current_version = TRUE AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Facility ${id} not found`);
    }

    return this.mapFacilityRow(result.rows[0]);
  }

  @Query('facilityAsOf')
  async getFacilityAsOf(
    @Args('facilityCode') facilityCode: string,
    @Args('tenantId') tenantId: string,
    @Args('asOfDate') asOfDate: string,
    @Context() context: any
  ) {
    // Query for facility version valid on asOfDate
    const result = await this.db.query(
      `SELECT * FROM facilities
       WHERE tenant_id = $1
         AND facility_code = $2
         AND effective_from_date <= $3
         AND (effective_to_date IS NULL OR effective_to_date >= $3)
         AND deleted_at IS NULL
       ORDER BY effective_from_date DESC
       LIMIT 1`,
      [tenantId, facilityCode, asOfDate]
    );

    if (result.rows.length === 0) {
      throw new Error(`Facility ${facilityCode} not found as of ${asOfDate}`);
    }

    return this.mapFacilityRow(result.rows[0]);
  }

  @Query('facilityHistory')
  async getFacilityHistory(
    @Args('facilityCode') facilityCode: string,
    @Args('tenantId') tenantId: string,
    @Context() context: any
  ) {
    // Get all versions of this facility
    const result = await this.db.query(
      `SELECT * FROM facilities
       WHERE tenant_id = $1
         AND facility_code = $2
         AND deleted_at IS NULL
       ORDER BY effective_from_date DESC`,
      [tenantId, facilityCode]
    );

    return result.rows.map(this.mapFacilityRow);
  }

  @Query('me')
  async getCurrentUser(@Context() context: any) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Current user not found');
    }

    return this.mapUserRow(result.rows[0]);
  }

  @Query('users')
  async getUsers(
    @Args('tenantId') tenantId: string,
    @Args('limit') limit: number = 50,
    @Args('offset') offset: number = 0,
    @Context() context: any
  ) {
    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [tenantId]
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get page of users
    const result = await this.db.query(
      `SELECT * FROM users
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );

    const edges = result.rows.map((row, index) => ({
      node: this.mapUserRow(row),
      cursor: Buffer.from(`${offset + index}`).toString('base64')
    }));

    const hasNextPage = (offset + limit) < totalCount;
    const hasPreviousPage = offset > 0;

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
        startCursor: edges.length > 0 ? edges[0].cursor : null,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
      },
      totalCount
    };
  }

  @Query('currencies')
  async getCurrencies() {
    const result = await this.db.query(
      `SELECT * FROM currencies WHERE is_active = TRUE ORDER BY currency_code`
    );

    return result.rows.map(this.mapCurrencyRow);
  }

  // =====================================================
  // MUTATIONS
  // =====================================================

  @Mutation('createTenant')
  async createTenant(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `INSERT INTO tenants (
        tenant_code, tenant_name, legal_entity_name,
        subscription_tier, primary_contact_email,
        default_currency_code, default_language,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        input.tenantCode,
        input.tenantName,
        input.legalEntityName,
        input.subscriptionTier,
        input.primaryContactEmail,
        input.defaultCurrencyCode || 'USD',
        input.defaultLanguage || 'en-US',
        userId
      ]
    );

    return this.mapTenantRow(result.rows[0]);
  }

  @Mutation('updateTenant')
  async updateTenant(
    @Args('id') id: string,
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.tenantName !== undefined) {
      updates.push(`tenant_name = $${paramIndex++}`);
      values.push(input.tenantName);
    }

    if (input.legalEntityName !== undefined) {
      updates.push(`legal_entity_name = $${paramIndex++}`);
      values.push(input.legalEntityName);
    }

    if (input.subscriptionTier !== undefined) {
      updates.push(`subscription_tier = $${paramIndex++}`);
      values.push(input.subscriptionTier);
    }

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }

    if (input.enabledFeatures !== undefined) {
      updates.push(`enabled_features = $${paramIndex++}`);
      values.push(JSON.stringify(input.enabledFeatures));
    }

    // Add audit fields
    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);

    // Add WHERE clause
    values.push(id);

    const result = await this.db.query(
      `UPDATE tenants SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND is_current = TRUE AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Tenant ${id} not found or already updated`);
    }

    return this.mapTenantRow(result.rows[0]);
  }

  @Mutation('createFacility')
  async createFacility(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `INSERT INTO facilities (
        tenant_id, facility_code, facility_name, facility_type,
        address_line1, city, postal_code, country,
        deployment_region, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        input.tenantId,
        input.facilityCode,
        input.facilityName,
        input.facilityType,
        input.addressLine1,
        input.city,
        input.postalCode,
        input.country,
        input.deploymentRegion,
        userId
      ]
    );

    return this.mapFacilityRow(result.rows[0]);
  }

  @Mutation('createUser')
  async createUser(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const createdBy = context.req.user.id;

    const result = await this.db.query(
      `INSERT INTO users (
        tenant_id, username, email, first_name, last_name,
        roles, security_clearance_level, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        input.tenantId,
        input.username,
        input.email,
        input.firstName,
        input.lastName,
        JSON.stringify(input.roles || []),
        input.securityClearanceLevel,
        createdBy
      ]
    );

    return this.mapUserRow(result.rows[0]);
  }

  @Mutation('updateMyPreferences')
  async updateMyPreferences(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.preferredLanguage) {
      updates.push(`preferred_language = $${paramIndex++}`);
      values.push(input.preferredLanguage);
    }

    if (input.preferredTimezone) {
      updates.push(`preferred_timezone = $${paramIndex++}`);
      values.push(input.preferredTimezone);
    }

    if (input.preferredCurrencyCode) {
      updates.push(`preferred_currency_code = $${paramIndex++}`);
      values.push(input.preferredCurrencyCode);
    }

    if (input.uiTheme) {
      updates.push(`ui_theme = $${paramIndex++}`);
      values.push(input.uiTheme);
    }

    if (input.defaultFacilityId) {
      updates.push(`default_facility_id = $${paramIndex++}`);
      values.push(input.defaultFacilityId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await this.db.query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return this.mapUserRow(result.rows[0]);
  }

  // =====================================================
  // FIELD RESOLVERS (for relationships)
  // =====================================================

  @Resolver('Tenant')
  async facilities(@Context() tenant: any) {
    const result = await this.db.query(
      `SELECT * FROM facilities
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY facility_name`,
      [tenant.id]
    );

    return result.rows.map(this.mapFacilityRow);
  }

  @Resolver('Tenant')
  async users(@Context() tenant: any) {
    const result = await this.db.query(
      `SELECT * FROM users
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 100`,
      [tenant.id]
    );

    return result.rows.map(this.mapUserRow);
  }

  @Resolver('User')
  async tenant(@Context() user: any) {
    const result = await this.db.query(
      `SELECT * FROM tenants
       WHERE id = $1 AND is_current = TRUE AND deleted_at IS NULL`,
      [user.tenantId]
    );

    return result.rows.length > 0 ? this.mapTenantRow(result.rows[0]) : null;
  }

  @Resolver('User')
  async defaultFacility(@Context() user: any) {
    if (!user.defaultFacilityId) return null;

    const result = await this.db.query(
      `SELECT * FROM facilities WHERE id = $1 AND deleted_at IS NULL`,
      [user.defaultFacilityId]
    );

    return result.rows.length > 0 ? this.mapFacilityRow(result.rows[0]) : null;
  }

  // =====================================================
  // MAPPERS (database row → GraphQL type)
  // =====================================================

  private mapTenantRow(row: any) {
    return {
      id: row.id,
      tenantCode: row.tenant_code,
      tenantName: row.tenant_name,
      legalEntityName: row.legal_entity_name,
      subscriptionTier: row.subscription_tier,
      status: row.status,
      primaryContactName: row.primary_contact_name,
      primaryContactEmail: row.primary_contact_email,
      primaryContactPhone: row.primary_contact_phone,
      billingAddressLine1: row.billing_address_line1,
      billingAddressLine2: row.billing_address_line2,
      billingCity: row.billing_city,
      billingState: row.billing_state,
      billingPostalCode: row.billing_postal_code,
      billingCountry: row.billing_country,
      taxId: row.tax_id,
      taxExempt: row.tax_exempt,
      defaultCurrencyCode: row.default_currency_code,
      defaultTimezone: row.default_timezone,
      defaultLanguage: row.default_language,
      enabledFeatures: row.enabled_features || [],
      customConfiguration: row.custom_configuration || {},
      userLimit: row.user_limit,
      facilityLimit: row.facility_limit,
      storageLimitGb: row.storage_limit_gb,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      isCurrent: row.is_current,
      versionNumber: row.version_number,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapFacilityRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityCode: row.facility_code,
      facilityName: row.facility_name,
      facilityType: row.facility_type,
      managerName: row.manager_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      country: row.country,
      latitude: row.latitude,
      longitude: row.longitude,
      isWarehouse: row.is_warehouse,
      isManufacturing: row.is_manufacturing,
      isSalesOffice: row.is_sales_office,
      totalSquareFeet: row.total_square_feet,
      usableSquareFeet: row.usable_square_feet,
      dockDoorsCount: row.dock_doors_count,
      productionCapacity: row.production_capacity,
      timezone: row.timezone,
      operatingHours: row.operating_hours,
      deploymentRegion: row.deployment_region,
      isActive: row.is_active,
      openedDate: row.opened_date,
      closedDate: row.closed_date,
      // SCD Type 2 fields
      effectiveFromDate: row.effective_from_date,
      effectiveToDate: row.effective_to_date,
      isCurrentVersion: row.is_current_version,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapUserRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      username: row.username,
      email: row.email,
      ssoProvider: row.sso_provider,
      ssoUserId: row.sso_user_id,
      mfaEnabled: row.mfa_enabled,
      biometricEnrolled: row.biometric_enrolled,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name,
      phone: row.phone,
      mobile: row.mobile,
      employeeId: row.employee_id,
      defaultFacilityId: row.default_facility_id,
      preferredLanguage: row.preferred_language,
      preferredTimezone: row.preferred_timezone,
      preferredCurrencyCode: row.preferred_currency_code,
      uiTheme: row.ui_theme,
      roles: row.roles || [],
      permissions: row.permissions || [],
      securityClearanceLevel: row.security_clearance_level,
      isActive: row.is_active,
      isLocked: row.is_locked,
      failedLoginAttempts: row.failed_login_attempts,
      lastLoginAt: row.last_login_at,
      passwordChangedAt: row.password_changed_at,
      passwordExpiresAt: row.password_expires_at,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapCurrencyRow(row: any) {
    return {
      id: row.id,
      currencyCode: row.currency_code,
      currencyName: row.currency_name,
      currencySymbol: row.currency_symbol,
      decimalPlaces: row.decimal_places,
      thousandsSeparator: row.thousands_separator,
      decimalSeparator: row.decimal_separator,
      symbolPosition: row.symbol_position,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
