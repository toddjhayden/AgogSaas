/**
 * Password Service
 * Shared bcrypt utilities for password hashing and validation
 * Used by both internal auth and customer portal auth
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328659
 * Security: bcrypt with salt rounds >= 10 (industry standard)
 */

import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 10; // Industry standard for bcrypt

  /**
   * Hash a password using bcrypt
   * @param password Plain text password
   * @returns bcrypt hash
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Validate a password against a hash
   * @param password Plain text password
   * @param hash bcrypt hash
   * @returns true if password matches hash
   */
  async validatePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Alias for validatePassword - used by supplier portal
   * @param password Plain text password
   * @param hash bcrypt hash
   * @returns true if password matches hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return this.validatePassword(password, hash);
  }

  /**
   * Verify TOTP code for MFA
   * TODO: Implement proper TOTP verification with speakeasy or similar
   * @param code TOTP code from authenticator app
   * @param secret User's TOTP secret
   * @returns true if code is valid
   */
  verifyTOTP(code: string, secret: string): boolean {
    // STUB: Always returns false until TOTP is properly implemented
    // TODO: Use speakeasy.totp.verify() or similar TOTP library
    console.warn('TOTP verification not implemented - returning false');
    return false;
  }

  /**
   * Validate password complexity
   * Requirements:
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   *
   * @param password Plain text password
   * @returns Error message or null if valid
   */
  validatePasswordComplexity(password: string): string | null {
    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }

    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }

    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }

    return null;
  }

  /**
   * Generate a random token for password reset or email verification
   * @returns Random token (32 bytes as hex string)
   */
  generateToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }
}
