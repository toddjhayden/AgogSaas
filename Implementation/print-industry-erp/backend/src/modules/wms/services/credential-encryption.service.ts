import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Credential Encryption Service
 *
 * REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations
 * Priority 1 - MUST-HAVE architectural requirement from Sylvia's critique
 *
 * Provides secure encryption/decryption of carrier API credentials using AES-256-GCM.
 * Implements:
 * - Industry-standard AES-256-GCM encryption
 * - Audit trail for all credential access
 * - Rate limiting to detect credential exfiltration attempts
 * - Credential rotation mechanisms
 *
 * Security Features:
 * - Uses environment-based encryption keys (production should use AWS KMS/Azure Key Vault)
 * - Authenticated encryption with GCM mode
 * - Timing-safe comparison for signatures
 * - Comprehensive audit logging
 *
 * Production Deployment:
 * - Replace ENCRYPTION_KEY env var with AWS Secrets Manager or Azure Key Vault
 * - Implement automatic key rotation every 90 days
 * - Add HSM integration for key storage
 * - Implement rate limiting per credential to detect exfiltration
 */
@Injectable()
export class CredentialEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits for GCM
  private readonly authTagLength = 16; // 128 bits authentication tag

  // Access tracking for audit and rate limiting
  private accessLog: Map<string, { count: number; lastAccess: Date }> = new Map();
  private readonly maxAccessesPerMinute = 100; // Rate limit threshold

  constructor() {
    this.validateConfiguration();
  }

  /**
   * Validates that encryption keys are properly configured
   * In production, this should verify connection to key management service
   */
  private validateConfiguration(): void {
    const key = process.env.CARRIER_CREDENTIAL_ENCRYPTION_KEY;

    if (!key) {
      console.warn(
        'CARRIER_CREDENTIAL_ENCRYPTION_KEY not configured. Using default key for development only. ' +
        'NEVER use default keys in production!'
      );
    }

    // Validate key length if provided
    if (key && Buffer.from(key, 'hex').length !== this.keyLength) {
      throw new Error(
        `Encryption key must be ${this.keyLength} bytes (${this.keyLength * 2} hex characters)`
      );
    }
  }

  /**
   * Gets the encryption key from environment or key management service
   * In production, this should retrieve keys from AWS KMS, Azure Key Vault, or HashiCorp Vault
   */
  private getEncryptionKey(): Buffer {
    const envKey = process.env.CARRIER_CREDENTIAL_ENCRYPTION_KEY;

    if (envKey) {
      return Buffer.from(envKey, 'hex');
    }

    // Development-only default key (NEVER use in production)
    // In production, throw error if no key is configured
    console.warn('Using development encryption key - NOT SAFE FOR PRODUCTION');
    return Buffer.from('0'.repeat(this.keyLength * 2), 'hex');
  }

  /**
   * Encrypts plaintext credentials
   *
   * @param plaintext - The credential to encrypt (API key, password, token, etc.)
   * @param carrierId - Carrier ID for audit logging
   * @returns Base64-encoded encrypted credential with IV and auth tag
   *
   * Format: base64(iv:authTag:ciphertext)
   */
  async encrypt(plaintext: string, carrierId: string): Promise<string> {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty credential');
    }

    try {
      // Generate random IV for this encryption
      const iv = randomBytes(this.ivLength);
      const key = this.getEncryptionKey();

      // Create cipher
      const cipher = createCipheriv(this.algorithm, key, iv);

      // Encrypt the plaintext
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine IV + authTag + encrypted data
      const combined = Buffer.concat([iv, authTag, encrypted]);

      // Log encryption event for audit
      await this.logCredentialAccess(carrierId, 'ENCRYPT');

      // Return base64-encoded result
      return combined.toString('base64');
    } catch (error) {
      console.error(`Credential encryption failed for carrier ${carrierId}:`, error);
      throw new Error('Failed to encrypt credential');
    }
  }

  /**
   * Decrypts encrypted credentials
   *
   * @param ciphertext - Base64-encoded encrypted credential
   * @param carrierId - Carrier ID for audit logging and rate limiting
   * @returns Decrypted plaintext credential
   */
  async decrypt(ciphertext: string, carrierId: string): Promise<string> {
    if (!ciphertext) {
      throw new Error('Cannot decrypt empty ciphertext');
    }

    // Rate limit check - prevent credential exfiltration
    await this.checkRateLimit(carrierId);

    try {
      // Decode base64
      const combined = Buffer.from(ciphertext, 'base64');

      // Extract IV, auth tag, and encrypted data
      const iv = combined.subarray(0, this.ivLength);
      const authTag = combined.subarray(this.ivLength, this.ivLength + this.authTagLength);
      const encrypted = combined.subarray(this.ivLength + this.authTagLength);

      const key = this.getEncryptionKey();

      // Create decipher
      const decipher = createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      // Log decryption event for audit
      await this.logCredentialAccess(carrierId, 'DECRYPT');

      return decrypted.toString('utf8');
    } catch (error) {
      console.error(`Credential decryption failed for carrier ${carrierId}:`, error);
      // Alert security team - could indicate tampering or key rotation needed
      await this.alertSecurityTeam(carrierId, 'DECRYPTION_FAILED');
      throw new Error('Failed to decrypt credential');
    }
  }

  /**
   * Rotates credentials for a carrier
   * Should be called automatically every 90 days
   *
   * @param carrierId - Carrier to rotate credentials for
   * @param newPlaintext - New credential value
   * @returns Encrypted new credential
   */
  async rotateCredentials(carrierId: string, newPlaintext: string): Promise<string> {
    // Log rotation event
    await this.logCredentialAccess(carrierId, 'ROTATE');

    // Encrypt new credential
    const encrypted = await this.encrypt(newPlaintext, carrierId);

    // In production, publish event to trigger credential update in carrier system
    console.log(`Credentials rotated for carrier ${carrierId}`);

    return encrypted;
  }

  /**
   * Checks rate limit for credential decryption
   * Prevents credential exfiltration attacks
   */
  private async checkRateLimit(carrierId: string): Promise<void> {
    const now = new Date();
    const access = this.accessLog.get(carrierId);

    if (!access) {
      this.accessLog.set(carrierId, { count: 1, lastAccess: now });
      return;
    }

    // Reset counter if more than 1 minute has passed
    const timeDiff = now.getTime() - access.lastAccess.getTime();
    if (timeDiff > 60000) {
      this.accessLog.set(carrierId, { count: 1, lastAccess: now });
      return;
    }

    // Check if rate limit exceeded
    if (access.count >= this.maxAccessesPerMinute) {
      await this.alertSecurityTeam(carrierId, 'RATE_LIMIT_EXCEEDED');
      throw new Error(
        `Rate limit exceeded for carrier ${carrierId}. ` +
        `Maximum ${this.maxAccessesPerMinute} decryptions per minute allowed.`
      );
    }

    // Increment counter
    access.count++;
    access.lastAccess = now;
  }

  /**
   * Logs credential access for audit trail
   * In production, send to SIEM system (Splunk, Datadog, etc.)
   */
  private async logCredentialAccess(
    carrierId: string,
    operation: 'ENCRYPT' | 'DECRYPT' | 'ROTATE'
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      carrierId,
      operation,
      // In production, add: userId, ipAddress, requestId
    };

    // TODO: Send to audit logging system
    console.log('CREDENTIAL_ACCESS_AUDIT:', JSON.stringify(logEntry));
  }

  /**
   * Alerts security team of suspicious activity
   * In production, integrate with PagerDuty, Slack, or email alerts
   */
  private async alertSecurityTeam(
    carrierId: string,
    reason: 'DECRYPTION_FAILED' | 'RATE_LIMIT_EXCEEDED'
  ): Promise<void> {
    const alert = {
      timestamp: new Date().toISOString(),
      severity: 'HIGH',
      carrierId,
      reason,
      message: reason === 'DECRYPTION_FAILED'
        ? 'Credential decryption failed - possible tampering or key rotation needed'
        : 'Rate limit exceeded - possible credential exfiltration attempt'
    };

    // TODO: Send to alerting system
    console.error('SECURITY_ALERT:', JSON.stringify(alert));
  }

  /**
   * Verifies credential integrity using timing-safe comparison
   * Used for webhook signature verification
   */
  verifySignature(expected: string, actual: string): boolean {
    try {
      const expectedBuffer = Buffer.from(expected);
      const actualBuffer = Buffer.from(actual);

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Generates a secure random token for webhook verification
   */
  generateWebhookSecret(): string {
    return randomBytes(32).toString('hex');
  }
}
