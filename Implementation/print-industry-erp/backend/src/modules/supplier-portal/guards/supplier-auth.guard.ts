/**
 * Supplier Authentication Guard
 * Validates JWT tokens for supplier portal access
 *
 * REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
 */

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import { SupplierJwtPayload } from '../services/supplier-auth.service';

@Injectable()
export class SupplierAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject('DATABASE_POOL') private readonly dbPool: Pool,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const { req } = gqlContext.getContext();

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify and decode JWT
      const payload = this.jwtService.verify<SupplierJwtPayload>(token);

      // Validate token type (must be access token)
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify supplier user still exists and is active
      const userResult = await this.dbPool.query(
        `SELECT su.*, v.vendor_code, v.vendor_name, v.is_active as vendor_active
         FROM supplier_users su
         JOIN vendors v ON su.vendor_id = v.id
         WHERE su.id = $1
           AND su.tenant_id = $2
           AND su.deleted_at IS NULL`,
        [payload.sub, payload.tenantId],
      );

      if (userResult.rows.length === 0) {
        throw new UnauthorizedException('Supplier user not found');
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        throw new UnauthorizedException('Supplier account is disabled');
      }

      if (!user.vendor_active) {
        throw new UnauthorizedException('Vendor account is not active');
      }

      // Attach user context to request
      req.supplierUser = {
        id: user.id,
        vendorId: user.vendor_id,
        tenantId: user.tenant_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        vendorCode: user.vendor_code,
        vendorName: user.vendor_name,
      };

      // Set tenant context for RLS
      await this.dbPool.query(
        `SELECT set_config('app.current_tenant_id', $1, false)`,
        [payload.tenantId],
      );

      return true;
    } catch (error) {
      const errorName = error instanceof Error && 'name' in error ? (error as any).name : '';
      if (errorName === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      } else if (errorName === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }
      throw error;
    }
  }
}
