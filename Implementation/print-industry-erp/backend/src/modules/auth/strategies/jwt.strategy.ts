/**
 * Internal User JWT Strategy
 * Validates JWT tokens for internal ERP users (employees, managers, admins)
 *
 * REQ: REQ-STRATEGIC-AUTO-1767066329944
 * Security: GraphQL Authorization & Tenant Isolation
 */

import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface ValidatedUser {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
  securityClearanceLevel: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @Inject('DATABASE_POOL') private readonly dbPool: Pool,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET') || 'change-me-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    // Verify payload type is access token
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Verify user exists and is active
    const result = await this.dbPool.query(
      `SELECT id, tenant_id, email, roles, permissions,
              security_clearance_level, is_active
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [payload.sub],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('User not found');
    }

    const user = result.rows[0];

    // Check if user account is active
    if (!user.is_active) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Verify user has a tenant association
    if (!user.tenant_id) {
      throw new UnauthorizedException('User must be associated with a tenant');
    }

    // Return validated user object (available via context.req.user)
    return {
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      roles: user.roles || [],
      permissions: user.permissions || [],
      securityClearanceLevel: user.security_clearance_level,
    };
  }
}
