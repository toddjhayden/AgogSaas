/**
 * Customer JWT Strategy
 * Validates JWT tokens for customer portal users
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328659
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { CustomerJwtPayload } from '../customer-auth.service';

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly dbPool: Pool,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('CUSTOMER_JWT_SECRET'),
    });
  }

  async validate(payload: CustomerJwtPayload) {
    // Verify payload type is access token
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Verify user still exists and is active
    const result = await this.dbPool.query(
      `SELECT cu.id, cu.customer_id, cu.tenant_id, cu.email, cu.role, cu.is_active, cu.is_email_verified
       FROM customer_users cu
       WHERE cu.id = $1 AND cu.deleted_at IS NULL`,
      [payload.sub],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('User not found');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new UnauthorizedException('Account is disabled');
    }

    if (!user.is_email_verified) {
      throw new UnauthorizedException('Email verification required');
    }

    // Return user object (available in @CurrentUser() decorator)
    return {
      userId: user.id,
      customerId: user.customer_id,
      tenantId: user.tenant_id,
      email: user.email,
      roles: [user.role],
    };
  }
}
