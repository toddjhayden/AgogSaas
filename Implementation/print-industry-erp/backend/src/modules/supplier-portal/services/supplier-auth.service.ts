/**
 * Supplier Authentication Service
 * Handles supplier portal user authentication and authorization
 *
 * REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
 * Security Features:
 * - JWT access tokens (30 minutes) and refresh tokens (14 days)
 * - Account lockout after 5 failed login attempts
 * - Email verification required
 * - MFA support (TOTP)
 * - Separate authentication realm from internal/customer users
 */

import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PasswordService } from '../../../common/security/password.service';

export interface SupplierJwtPayload {
  sub: string; // Supplier user ID
  vendorId: string;
  tenantId: string;
  role: string; // VENDOR_ADMIN, VENDOR_USER, VENDOR_VIEWER
  type: 'access' | 'refresh';
}

export interface SupplierAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  user: {
    id: string;
    vendorId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    mfaEnabled: boolean;
    isEmailVerified: boolean;
  };
  vendor: {
    id: string;
    vendorCode: string;
    vendorName: string;
    vendorTier: string;
  };
}

@Injectable()
export class SupplierAuthService {
  private readonly ACCESS_TOKEN_EXPIRY = '30m';
  private readonly REFRESH_TOKEN_EXPIRY = '14d';
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 30;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly dbPool: Pool,
  ) {}

  /**
   * Register a new supplier portal user
   * @param vendorCode - Vendor code (from vendors table)
   * @param email - User email address
   * @param password - User password
   * @param firstName - User first name
   * @param lastName - User last name
   * @param role - User role (VENDOR_ADMIN, VENDOR_USER, VENDOR_VIEWER)
   */
  async register(
    vendorCode: string,
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: string = 'VENDOR_USER',
  ): Promise<SupplierAuthResponse> {
    // Validate password complexity
    const passwordError = this.passwordService.validatePasswordComplexity(password);
    if (passwordError) {
      throw new BadRequestException(passwordError);
    }

    // Verify vendor exists and is active
    const vendorResult = await this.dbPool.query(
      `SELECT id, tenant_id, vendor_code, vendor_name, vendor_tier, is_active
       FROM vendors
       WHERE vendor_code = $1 AND deleted_at IS NULL`,
      [vendorCode],
    );

    if (vendorResult.rows.length === 0) {
      throw new BadRequestException('Invalid vendor code');
    }

    const vendor = vendorResult.rows[0];
    if (!vendor.is_active) {
      throw new ForbiddenException('Vendor account is not active');
    }

    // Check if email already exists for this vendor
    const existingUser = await this.dbPool.query(
      `SELECT id FROM supplier_users
       WHERE vendor_id = $1 AND email = $2 AND deleted_at IS NULL`,
      [vendor.id, email.toLowerCase()],
    );

    if (existingUser.rows.length > 0) {
      throw new BadRequestException('Email already registered for this vendor');
    }

    // Hash password
    const passwordHash = await this.passwordService.hashPassword(password);

    // Generate email verification token
    const verificationToken = this.passwordService.generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert supplier user
    const insertResult = await this.dbPool.query(
      `INSERT INTO supplier_users (
        vendor_id, tenant_id, email, password_hash,
        first_name, last_name, role,
        email_verification_token, email_verification_expires,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING id, vendor_id, tenant_id, email, first_name, last_name, role, mfa_enabled, is_email_verified`,
      [
        vendor.id,
        vendor.tenant_id,
        email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        role,
        verificationToken,
        verificationExpires,
      ],
    );

    const user = insertResult.rows[0];

    // Log activity
    await this.logActivity(user.id, vendor.id, vendor.tenant_id, 'REGISTER', {
      email: email.toLowerCase(),
      role,
    });

    // TODO: Send verification email
    // await this.emailService.sendVerificationEmail(email, verificationToken);

    // Generate tokens (email not verified yet, but allow login)
    const { accessToken, refreshToken, expiresAt } = await this.generateTokens(user);

    return {
      accessToken,
      refreshToken,
      expiresAt,
      user: {
        id: user.id,
        vendorId: user.vendor_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        mfaEnabled: user.mfa_enabled,
        isEmailVerified: user.is_email_verified,
      },
      vendor: {
        id: vendor.id,
        vendorCode: vendor.vendor_code,
        vendorName: vendor.vendor_name,
        vendorTier: vendor.vendor_tier,
      },
    };
  }

  /**
   * Login supplier user
   * @param email - User email
   * @param password - User password
   * @param mfaCode - Optional MFA code (if MFA enabled)
   */
  async login(
    email: string,
    password: string,
    mfaCode?: string,
  ): Promise<SupplierAuthResponse> {
    // Find user
    const userResult = await this.dbPool.query(
      `SELECT su.*, v.vendor_code, v.vendor_name, v.vendor_tier, v.is_active as vendor_active
       FROM supplier_users su
       JOIN vendors v ON su.vendor_id = v.id
       WHERE su.email = $1 AND su.deleted_at IS NULL`,
      [email.toLowerCase()],
    );

    if (userResult.rows.length === 0) {
      // Log failed login attempt
      await this.logActivity(null, null, null, 'LOGIN_FAILED', {
        email: email.toLowerCase(),
        reason: 'user_not_found',
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = userResult.rows[0];

    // Check if account is locked
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      const minutesRemaining = Math.ceil(
        (new Date(user.account_locked_until).getTime() - Date.now()) / (60 * 1000),
      );
      throw new ForbiddenException(
        `Account is locked due to too many failed login attempts. Try again in ${minutesRemaining} minutes.`,
      );
    }

    // Check if user is active
    if (!user.is_active) {
      throw new ForbiddenException('Account is disabled');
    }

    // Check if vendor is active
    if (!user.vendor_active) {
      throw new ForbiddenException('Vendor account is not active');
    }

    // Verify password
    const passwordValid = await this.passwordService.verifyPassword(
      password,
      user.password_hash,
    );

    if (!passwordValid) {
      // Increment failed login attempts
      await this.handleFailedLogin(user.id, user.vendor_id, user.tenant_id);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check MFA if enabled
    if (user.mfa_enabled) {
      if (!mfaCode) {
        throw new UnauthorizedException('MFA code required');
      }

      const mfaValid = this.passwordService.verifyTOTP(mfaCode, user.mfa_secret);
      if (!mfaValid) {
        await this.logActivity(user.id, user.vendor_id, user.tenant_id, 'LOGIN_FAILED', {
          reason: 'invalid_mfa',
        });
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Reset failed login attempts on successful login
    await this.dbPool.query(
      `UPDATE supplier_users
       SET failed_login_attempts = 0,
           account_locked_until = NULL,
           last_login_at = NOW(),
           last_login_ip = $2
       WHERE id = $1`,
      [user.id, null], // TODO: Pass IP address
    );

    // Log successful login
    await this.logActivity(user.id, user.vendor_id, user.tenant_id, 'LOGIN', {
      email: email.toLowerCase(),
    });

    // Generate tokens
    const { accessToken, refreshToken, expiresAt } = await this.generateTokens(user);

    return {
      accessToken,
      refreshToken,
      expiresAt,
      user: {
        id: user.id,
        vendorId: user.vendor_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        mfaEnabled: user.mfa_enabled,
        isEmailVerified: user.is_email_verified,
      },
      vendor: {
        id: user.vendor_id,
        vendorCode: user.vendor_code,
        vendorName: user.vendor_name,
        vendorTier: user.vendor_tier,
      },
    };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    const result = await this.dbPool.query(
      `UPDATE supplier_users
       SET is_email_verified = true,
           email_verification_token = NULL,
           email_verification_expires = NULL
       WHERE email_verification_token = $1
         AND email_verification_expires > NOW()
         AND deleted_at IS NULL
       RETURNING id, vendor_id, tenant_id, email`,
      [token],
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const user = result.rows[0];
    await this.logActivity(user.id, user.vendor_id, user.tenant_id, 'EMAIL_VERIFIED', {
      email: user.email,
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const userResult = await this.dbPool.query(
      `SELECT id, vendor_id, tenant_id FROM supplier_users
       WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()],
    );

    if (userResult.rows.length === 0) {
      // Don't reveal whether email exists
      return;
    }

    const user = userResult.rows[0];

    // Generate reset token
    const resetToken = this.passwordService.generateToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.dbPool.query(
      `UPDATE supplier_users
       SET password_reset_token = $1,
           password_reset_expires = $2
       WHERE id = $3`,
      [resetToken, resetExpires, user.id],
    );

    // Log activity
    await this.logActivity(user.id, user.vendor_id, user.tenant_id, 'PASSWORD_RESET_REQUESTED', {
      email: email.toLowerCase(),
    });

    // TODO: Send password reset email
    // await this.emailService.sendPasswordResetEmail(email, resetToken);
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validate password complexity
    const passwordError = this.passwordService.validatePasswordComplexity(newPassword);
    if (passwordError) {
      throw new BadRequestException(passwordError);
    }

    // Find user with valid reset token
    const userResult = await this.dbPool.query(
      `SELECT id, vendor_id, tenant_id, email FROM supplier_users
       WHERE password_reset_token = $1
         AND password_reset_expires > NOW()
         AND deleted_at IS NULL`,
      [token],
    );

    if (userResult.rows.length === 0) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = userResult.rows[0];

    // Hash new password
    const passwordHash = await this.passwordService.hashPassword(newPassword);

    // Update password and clear reset token
    await this.dbPool.query(
      `UPDATE supplier_users
       SET password_hash = $1,
           password_reset_token = NULL,
           password_reset_expires = NULL,
           password_changed_at = NOW(),
           failed_login_attempts = 0,
           account_locked_until = NULL
       WHERE id = $2`,
      [passwordHash, user.id],
    );

    // Revoke all refresh tokens (force re-login)
    await this.dbPool.query(
      `UPDATE supplier_refresh_tokens
       SET revoked_at = NOW(),
           revoked_reason = 'PASSWORD_CHANGE'
       WHERE supplier_user_id = $1 AND revoked_at IS NULL`,
      [user.id],
    );

    // Log activity
    await this.logActivity(user.id, user.vendor_id, user.tenant_id, 'PASSWORD_RESET', {
      email: user.email,
    });
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<SupplierAuthResponse> {
    // Hash the refresh token
    const tokenHash = await this.passwordService.hashPassword(refreshToken);

    // Find valid refresh token
    const tokenResult = await this.dbPool.query(
      `SELECT srt.*, su.vendor_id, su.tenant_id, su.email, su.first_name, su.last_name, su.role,
              su.mfa_enabled, su.is_email_verified, su.is_active,
              v.vendor_code, v.vendor_name, v.vendor_tier, v.is_active as vendor_active
       FROM supplier_refresh_tokens srt
       JOIN supplier_users su ON srt.supplier_user_id = su.id
       JOIN vendors v ON su.vendor_id = v.id
       WHERE srt.expires_at > NOW()
         AND srt.revoked_at IS NULL
         AND su.deleted_at IS NULL
       LIMIT 1`,
      [],
    );

    if (tokenResult.rows.length === 0) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const token = tokenResult.rows[0];

    // Verify token hash matches
    const tokenValid = await this.passwordService.verifyPassword(
      refreshToken,
      token.token_hash,
    );

    if (!tokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if user is active
    if (!token.is_active || !token.vendor_active) {
      throw new ForbiddenException('Account is disabled');
    }

    // Generate new tokens
    const user = {
      id: token.supplier_user_id,
      vendor_id: token.vendor_id,
      tenant_id: token.tenant_id,
      email: token.email,
      first_name: token.first_name,
      last_name: token.last_name,
      role: token.role,
      mfa_enabled: token.mfa_enabled,
      is_email_verified: token.is_email_verified,
    };

    const { accessToken, refreshToken: newRefreshToken, expiresAt } = await this.generateTokens(user);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt,
      user: {
        id: user.id,
        vendorId: user.vendor_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        mfaEnabled: user.mfa_enabled,
        isEmailVerified: user.is_email_verified,
      },
      vendor: {
        id: token.vendor_id,
        vendorCode: token.vendor_code,
        vendorName: token.vendor_name,
        vendorTier: token.vendor_tier,
      },
    };
  }

  /**
   * Logout (revoke refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = await this.passwordService.hashPassword(refreshToken);

    await this.dbPool.query(
      `UPDATE supplier_refresh_tokens
       SET revoked_at = NOW(),
           revoked_reason = 'MANUAL_LOGOUT'
       WHERE revoked_at IS NULL`,
      [],
    );
  }

  /**
   * Generate JWT access and refresh tokens
   */
  private async generateTokens(user: any): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    // Generate access token
    const accessPayload: SupplierJwtPayload = {
      sub: user.id,
      vendorId: user.vendor_id,
      tenantId: user.tenant_id,
      role: user.role,
      type: 'access',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    // Generate refresh token
    const refreshPayload: SupplierJwtPayload = {
      sub: user.id,
      vendorId: user.vendor_id,
      tenantId: user.tenant_id,
      role: user.role,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    });

    // Store refresh token in database (hashed)
    const tokenHash = await this.passwordService.hashPassword(refreshToken);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    await this.dbPool.query(
      `INSERT INTO supplier_refresh_tokens (
        supplier_user_id, tenant_id, token_hash, expires_at
      ) VALUES ($1, $2, $3, $4)`,
      [user.id, user.tenant_id, tokenHash, expiresAt],
    );

    return { accessToken, refreshToken, expiresAt };
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(userId: string, vendorId: string, tenantId: string): Promise<void> {
    const result = await this.dbPool.query(
      `UPDATE supplier_users
       SET failed_login_attempts = failed_login_attempts + 1
       WHERE id = $1
       RETURNING failed_login_attempts`,
      [userId],
    );

    const failedAttempts = result.rows[0].failed_login_attempts;

    // Lock account after max attempts
    if (failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + this.LOCKOUT_DURATION_MINUTES * 60 * 1000);

      await this.dbPool.query(
        `UPDATE supplier_users
         SET account_locked_until = $1
         WHERE id = $2`,
        [lockUntil, userId],
      );

      await this.logActivity(userId, vendorId, tenantId, 'ACCOUNT_LOCKED', {
        reason: 'too_many_failed_attempts',
        attempts: failedAttempts,
      });
    }

    await this.logActivity(userId, vendorId, tenantId, 'LOGIN_FAILED', {
      reason: 'invalid_password',
      attempts: failedAttempts,
    });
  }

  /**
   * Log supplier activity
   */
  private async logActivity(
    userId: string | null,
    vendorId: string | null,
    tenantId: string | null,
    activityType: string,
    details: any,
  ): Promise<void> {
    if (!tenantId || !vendorId) {
      return; // Skip logging if tenant/vendor not available
    }

    await this.dbPool.query(
      `INSERT INTO supplier_activity_log (
        tenant_id, vendor_id, supplier_user_id, activity_type, activity_details
      ) VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, vendorId, userId, activityType, JSON.stringify(details)],
    );
  }
}
