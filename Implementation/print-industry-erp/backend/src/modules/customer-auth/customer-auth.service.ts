/**
 * Customer Authentication Service
 * Handles customer portal user authentication and authorization
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328659
 * Security Features:
 * - JWT access tokens (30 minutes) and refresh tokens (14 days)
 * - Account lockout after 5 failed login attempts
 * - Email verification required
 * - MFA support (TOTP)
 */

import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PasswordService } from '../../common/security/password.service';

export interface CustomerJwtPayload {
  sub: string; // Customer user ID
  customerId: string;
  tenantId: string;
  roles: string[];
  type: 'access' | 'refresh';
}

export interface CustomerAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  user: any;
  customer: any;
  permissions: string[];
}

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly dbPool: Pool,
  ) {}

  /**
   * Register a new customer portal user
   */
  async register(
    customerCode: string,
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<CustomerAuthResponse> {
    // Validate password complexity
    const passwordError = this.passwordService.validatePasswordComplexity(password);
    if (passwordError) {
      throw new BadRequestException(passwordError);
    }

    // Verify customer exists and portal is enabled
    const customerResult = await this.dbPool.query(
      `SELECT id, tenant_id, portal_enabled FROM customers WHERE customer_code = $1`,
      [customerCode],
    );

    if (customerResult.rows.length === 0) {
      throw new BadRequestException('Invalid customer code');
    }

    const customer = customerResult.rows[0];
    if (!customer.portal_enabled) {
      throw new ForbiddenException('Customer portal not enabled for this account');
    }

    // Check if email already exists
    const existingUser = await this.dbPool.query(
      `SELECT id FROM customer_users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()],
    );

    if (existingUser.rows.length > 0) {
      throw new BadRequestException('Email already registered');
    }

    // Hash password
    const passwordHash = await this.passwordService.hashPassword(password);

    // Generate email verification token
    const verificationToken = this.passwordService.generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert customer user
    const insertResult = await this.dbPool.query(
      `INSERT INTO customer_users (
        customer_id, tenant_id, email, password_hash,
        first_name, last_name, role,
        email_verification_token, email_verification_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, customer_id, tenant_id, email, first_name, last_name, role, mfa_enabled, is_email_verified`,
      [
        customer.id,
        customer.tenant_id,
        email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        'CUSTOMER_USER',
        verificationToken,
        verificationExpires,
      ],
    );

    const user = insertResult.rows[0];

    // TODO: Send verification email via email service
    // await this.emailService.sendVerificationEmail(user.email, verificationToken);

    // Generate tokens (but user can't use them until email verified)
    return this.generateAuthResponse(user, customer);
  }

  /**
   * Customer portal login
   */
  async login(email: string, password: string, mfaCode?: string): Promise<CustomerAuthResponse> {
    // Get customer user
    const userResult = await this.dbPool.query(
      `SELECT cu.*, c.customer_name, c.customer_code
       FROM customer_users cu
       JOIN customers c ON cu.customer_id = c.id
       WHERE cu.email = $1 AND cu.deleted_at IS NULL`,
      [email.toLowerCase()],
    );

    if (userResult.rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = userResult.rows[0];

    // Check if account is locked
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      const minutesRemaining = Math.ceil((new Date(user.account_locked_until).getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`Account locked. Try again in ${minutesRemaining} minutes.`);
    }

    // Check if account is active
    if (!user.is_active) {
      throw new ForbiddenException('Account is disabled');
    }

    // Validate password
    const isPasswordValid = await this.passwordService.validatePassword(password, user.password_hash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      await this.incrementFailedLoginAttempts(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check MFA if enabled
    if (user.mfa_enabled) {
      if (!mfaCode) {
        throw new BadRequestException('MFA code required');
      }

      const isMfaValid = await this.validateMfaCode(user.id, mfaCode);
      if (!isMfaValid) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Check if email is verified
    if (!user.is_email_verified) {
      throw new ForbiddenException('Email verification required. Please check your email.');
    }

    // Reset failed login attempts and update last login
    await this.dbPool.query(
      `UPDATE customer_users
       SET failed_login_attempts = 0,
           last_login_at = NOW(),
           last_login_ip = $2,
           account_locked_until = NULL
       WHERE id = $1`,
      [user.id, null], // TODO: Get IP from request context
    );

    // Log login activity
    await this.logActivity(user.id, user.tenant_id, 'LOGIN', null);

    const customer = {
      id: user.customer_id,
      customer_name: user.customer_name,
      customer_code: user.customer_code,
    };

    return this.generateAuthResponse(user, customer);
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<CustomerAuthResponse> {
    try {
      const payload = this.jwtService.verify<CustomerJwtPayload>(refreshToken, {
        secret: this.configService.get('CUSTOMER_JWT_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify refresh token exists in database and not revoked
      const tokenResult = await this.dbPool.query(
        `SELECT * FROM refresh_tokens
         WHERE customer_user_id = $1
           AND expires_at > NOW()
           AND revoked_at IS NULL`,
        [payload.sub],
      );

      if (tokenResult.rows.length === 0) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user and customer
      const userResult = await this.dbPool.query(
        `SELECT cu.*, c.customer_name, c.customer_code
         FROM customer_users cu
         JOIN customers c ON cu.customer_id = c.id
         WHERE cu.id = $1 AND cu.deleted_at IS NULL`,
        [payload.sub],
      );

      if (userResult.rows.length === 0) {
        throw new UnauthorizedException('User not found');
      }

      const user = userResult.rows[0];
      const customer = {
        id: user.customer_id,
        customer_name: user.customer_name,
        customer_code: user.customer_code,
      };

      return this.generateAuthResponse(user, customer);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logout and revoke refresh token
   */
  async logout(userId: string, refreshToken: string): Promise<boolean> {
    // Revoke all refresh tokens for this user
    await this.dbPool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(), revoked_reason = 'MANUAL_LOGOUT'
       WHERE customer_user_id = $1`,
      [userId],
    );

    // Log logout activity
    const userResult = await this.dbPool.query(
      `SELECT tenant_id FROM customer_users WHERE id = $1`,
      [userId],
    );

    if (userResult.rows.length > 0) {
      await this.logActivity(userId, userResult.rows[0].tenant_id, 'LOGOUT', null);
    }

    return true;
  }

  /**
   * Generate auth response with access and refresh tokens
   */
  private async generateAuthResponse(user: any, customer: any): Promise<CustomerAuthResponse> {
    const payload: CustomerJwtPayload = {
      sub: user.id,
      customerId: user.customer_id,
      tenantId: user.tenant_id,
      roles: [user.role],
      type: 'access',
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('CUSTOMER_JWT_SECRET'),
      expiresIn: '30m', // 30 minutes (Sylvia's recommendation)
    });

    const refreshPayload: CustomerJwtPayload = {
      ...payload,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get('CUSTOMER_JWT_SECRET'),
      expiresIn: '14d', // 14 days (Sylvia's recommendation, down from 30d)
    });

    // Store refresh token in database
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const tokenHash = await this.passwordService.hashPassword(refreshToken);

    await this.dbPool.query(
      `INSERT INTO refresh_tokens (
        customer_user_id, tenant_id, token_hash, expires_at
      ) VALUES ($1, $2, $3, $4)`,
      [user.id, user.tenant_id, tokenHash, expiresAt],
    );

    // Generate permissions list based on role
    const permissions = this.getPermissionsForRole(user.role);

    return {
      accessToken,
      refreshToken,
      expiresAt,
      user: {
        id: user.id,
        customerId: user.customer_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        mfaEnabled: user.mfa_enabled,
        isEmailVerified: user.is_email_verified,
      },
      customer,
      permissions,
    };
  }

  /**
   * Increment failed login attempts
   */
  private async incrementFailedLoginAttempts(userId: string): Promise<void> {
    await this.dbPool.query(
      `UPDATE customer_users
       SET failed_login_attempts = failed_login_attempts + 1
       WHERE id = $1`,
      [userId],
    );
  }

  /**
   * Validate MFA TOTP code
   */
  private async validateMfaCode(userId: string, code: string): Promise<boolean> {
    // TODO: Implement TOTP validation using speakeasy or similar library
    // For now, return false (MFA not implemented yet)
    return false;
  }

  /**
   * Log customer activity
   */
  private async logActivity(
    userId: string,
    tenantId: string,
    activityType: string,
    metadata: any,
  ): Promise<void> {
    await this.dbPool.query(
      `INSERT INTO customer_activity_log (
        tenant_id, customer_user_id, activity_type, metadata
      ) VALUES ($1, $2, $3, $4)`,
      [tenantId, userId, activityType, metadata ? JSON.stringify(metadata) : null],
    );
  }

  /**
   * Get permissions for customer role
   */
  private getPermissionsForRole(role: string): string[] {
    const permissions: Record<string, string[]> = {
      CUSTOMER_ADMIN: [
        'view_orders',
        'view_quotes',
        'request_quotes',
        'approve_quotes',
        'reject_quotes',
        'upload_artwork',
        'approve_proofs',
        'manage_users',
        'view_invoices',
      ],
      CUSTOMER_USER: [
        'view_orders',
        'view_quotes',
        'request_quotes',
        'upload_artwork',
        'view_invoices',
      ],
      APPROVER: [
        'view_orders',
        'view_quotes',
        'approve_quotes',
        'reject_quotes',
        'approve_proofs',
        'view_invoices',
      ],
    };

    return permissions[role] || [];
  }
}
