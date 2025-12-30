/**
 * Email Provider Interface
 * Abstraction layer for email delivery providers
 *
 * REQ: REQ-STRATEGIC-AUTO-1767103864617
 * Allows swapping email providers without code changes
 */

export interface IEmailProvider {
  /**
   * Send a raw email
   */
  sendEmail(to: string, subject: string, html: string, text: string): Promise<void>;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface VerificationEmailData {
  token: string;
  verifyUrl: string;
  firstName?: string;
}

export interface PasswordResetEmailData {
  token: string;
  resetUrl: string;
  firstName?: string;
}

export interface SecurityAlertEmailData {
  alertType: 'ACCOUNT_LOCKED' | 'PASSWORD_CHANGED' | 'MFA_ENABLED' | 'MFA_DISABLED';
  firstName?: string;
  ipAddress?: string;
  timestamp: Date;
}
