/**
 * Security Audit GraphQL Resolver
 * REQ-DEVOPS-SECURITY-1767150339448
 * REQ-1767924916114-xhhll - Comprehensive Audit Logging
 *
 * Provides GraphQL API for security audit dashboard:
 * - Security overview and metrics
 * - Event logging and querying
 * - Threat pattern management
 * - Incident management
 * - Compliance audit trail
 *
 * SECURITY HARDENING (Marcus - DevOps Security Architect):
 * - Added JwtAuthGuard for authentication
 * - Added RolesGuard for RBAC (SECURITY_ADMIN, SECURITY_ANALYST)
 * - Removed tenant fallback defaults
 * - Added proper tenant context validation
 *
 * COMPREHENSIVE AUDIT LOGGING (Cynthia - Research):
 * - Implemented all 6 mutation operations
 * - Added compliance audit trail query
 * - All mutations require user context for audit trail
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import { SecurityAuditService } from '../../modules/security/services/security-audit.service';
import { SecurityAuditMutationsService } from '../../modules/security/services/security-audit-mutations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SECURITY_ADMIN', 'SECURITY_ANALYST', 'ADMIN')
export class SecurityAuditResolver {
  constructor(
    private readonly securityAuditService: SecurityAuditService,
    private readonly securityAuditMutationsService: SecurityAuditMutationsService,
  ) {}

  @Query()
  async securityOverview(
    @Args('timeRange') timeRange: string,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    return this.securityAuditService.getSecurityOverview(tenantId, timeRange);
  }

  @Query()
  async securityAuditEvents(
    @Args('filter') filter: any,
    @Args('pagination') pagination: any,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    return this.securityAuditService.getSecurityAuditEvents(tenantId, filter, pagination);
  }

  @Query()
  async suspiciousIPs(
    @Args('hours') hours: number,
    @Args('limit') limit: number,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    return this.securityAuditService.getSuspiciousIPs(tenantId, hours, limit);
  }

  @Query()
  async userSecurityTimeline(
    @Args('userId') userId: number,
    @Args('hours') hours: number,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    return this.securityAuditService.getUserSecurityTimeline(tenantId, userId, hours);
  }

  @Query()
  async securityIncidents(
    @Args('status') status: string[],
    @Args('severity') severity: string[],
    @Args('pagination') pagination: any,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    return this.securityAuditService.getSecurityIncidents(tenantId, { status, severity }, pagination);
  }

  @Query()
  async securityIncident(
    @Args('id') id: number,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    return this.securityAuditService.getSecurityIncident(tenantId, id);
  }

  @Query()
  async threatPatterns(
    @Args('enabled') enabled: boolean,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    return this.securityAuditService.getThreatPatterns(tenantId, enabled);
  }

  @Query()
  async complianceAuditTrail(
    @Args('framework') framework: string,
    @Args('controlId') controlId: string,
    @Args('status') status: string,
    @Args('pagination') pagination: any,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    return this.securityAuditService.getComplianceAuditTrail(
      tenantId,
      { framework, controlId, status },
      pagination,
    );
  }

  @Query()
  async securityMetricsTimeSeries(
    @Args('timeRange') timeRange: string,
    @Args('interval') interval: string,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    return this.securityAuditService.getSecurityMetricsTimeSeries(tenantId, timeRange, interval);
  }

  @Query()
  async geographicAccessMap(
    @Args('hours') hours: number,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    return this.securityAuditService.getGeographicAccessMap(tenantId, hours);
  }

  // =====================================================
  // MUTATIONS (Fully Implemented - REQ-1767924916114-xhhll)
  // =====================================================

  @Mutation()
  async createSecurityIncident(
    @Args('input') input: any,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    const userId = context.req.user?.userId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    if (!userId) {
      throw new UnauthorizedException('User context required');
    }

    return this.securityAuditMutationsService.createSecurityIncident(tenantId, input, userId);
  }

  @Mutation()
  async updateSecurityIncident(
    @Args('id') id: number,
    @Args('input') input: any,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    const userId = context.req.user?.userId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    if (!userId) {
      throw new UnauthorizedException('User context required');
    }

    return this.securityAuditMutationsService.updateSecurityIncident(tenantId, id, input, userId);
  }

  @Mutation()
  async upsertThreatPattern(
    @Args('input') input: any,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    const userId = context.req.user?.userId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    if (!userId) {
      throw new UnauthorizedException('User context required');
    }

    return this.securityAuditMutationsService.upsertThreatPattern(tenantId, input, userId);
  }

  @Mutation()
  async toggleThreatPattern(
    @Args('id') id: number,
    @Args('enabled') enabled: boolean,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    const userId = context.req.user?.userId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    if (!userId) {
      throw new UnauthorizedException('User context required');
    }

    return this.securityAuditMutationsService.toggleThreatPattern(tenantId, id, enabled, userId);
  }

  @Mutation()
  async logSecurityEvent(
    @Args('input') input: any,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    const userId = context.req.user?.userId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    if (!userId) {
      throw new UnauthorizedException('User context required');
    }

    return this.securityAuditMutationsService.logSecurityEvent(tenantId, input, userId);
  }

  @Mutation()
  async addComplianceAuditEntry(
    @Args('input') input: any,
    @Context() context: any,
  ) {
    const tenantId = context.req.tenantId;
    const userId = context.req.user?.userId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }
    if (!userId) {
      throw new UnauthorizedException('User context required');
    }

    return this.securityAuditMutationsService.addComplianceAuditEntry(tenantId, input, userId);
  }
}
