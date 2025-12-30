/**
 * Email Template Service
 * Manages email templates for customer portal authentication
 *
 * REQ: REQ-STRATEGIC-AUTO-1767103864617
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailTemplate,
  VerificationEmailData,
  PasswordResetEmailData,
  SecurityAlertEmailData,
} from './email.interface';

@Injectable()
export class EmailTemplateService {
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Render email verification template
   */
  renderVerificationEmail(email: string, data: VerificationEmailData): EmailTemplate {
    const { token, firstName } = data;
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    const subject = 'Verify Your Email Address - AGOG Print ERP';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; border-radius: 5px; padding: 30px; margin-bottom: 20px;">
          <h1 style="color: #2c3e50; margin-bottom: 20px;">Welcome to AGOG Print ERP!</h1>
          ${firstName ? `<p>Hi ${firstName},</p>` : '<p>Hello,</p>'}
          <p>Thank you for registering for the AGOG Print ERP Customer Portal. To complete your registration, please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email Address</a>
          </div>
          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #666; word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 3px;">${verifyUrl}</p>
          <p style="color: #d9534f; margin-top: 20px;"><strong>This link will expire in 24 hours.</strong></p>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">If you did not create an account, please ignore this email.</p>
        </div>
        <div style="font-size: 12px; color: #999; text-align: center;">
          <p>&copy; ${new Date().getFullYear()} AGOG Print ERP. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to AGOG Print ERP!

${firstName ? `Hi ${firstName},` : 'Hello,'}

Thank you for registering for the AGOG Print ERP Customer Portal. To complete your registration, please verify your email address by visiting the following link:

${verifyUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

© ${new Date().getFullYear()} AGOG Print ERP. All rights reserved.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Render password reset email template
   */
  renderPasswordResetEmail(email: string, data: PasswordResetEmailData): EmailTemplate {
    const { token, firstName } = data;
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    const subject = 'Password Reset Request - AGOG Print ERP';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; border-radius: 5px; padding: 30px; margin-bottom: 20px;">
          <h1 style="color: #2c3e50; margin-bottom: 20px;">Password Reset Request</h1>
          ${firstName ? `<p>Hi ${firstName},</p>` : '<p>Hello,</p>'}
          <p>You requested a password reset for your AGOG Print ERP Customer Portal account. Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>
          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #666; word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 3px;">${resetUrl}</p>
          <p style="color: #d9534f; margin-top: 20px;"><strong>This link will expire in 1 hour.</strong></p>
          <p style="font-size: 14px; color: #666; margin-top: 30px;"><strong>If you did not request this password reset, please ignore this email.</strong> Your password will remain unchanged.</p>
        </div>
        <div style="font-size: 12px; color: #999; text-align: center;">
          <p>&copy; ${new Date().getFullYear()} AGOG Print ERP. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
Password Reset Request

${firstName ? `Hi ${firstName},` : 'Hello,'}

You requested a password reset for your AGOG Print ERP Customer Portal account. Visit the following link to reset your password:

${resetUrl}

This link will expire in 1 hour.

If you did not request this password reset, please ignore this email. Your password will remain unchanged.

© ${new Date().getFullYear()} AGOG Print ERP. All rights reserved.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Render security alert email template
   */
  renderSecurityAlertEmail(email: string, data: SecurityAlertEmailData): EmailTemplate {
    const { alertType, firstName, ipAddress, timestamp } = data;

    let title: string;
    let message: string;
    let color: string;

    switch (alertType) {
      case 'ACCOUNT_LOCKED':
        title = 'Account Locked Due to Failed Login Attempts';
        message = `Your account has been locked due to multiple failed login attempts. The account will be automatically unlocked in 30 minutes.`;
        color = '#dc3545';
        break;
      case 'PASSWORD_CHANGED':
        title = 'Password Changed Successfully';
        message = `Your password was recently changed. If you did not make this change, please contact support immediately.`;
        color = '#28a745';
        break;
      case 'MFA_ENABLED':
        title = 'Multi-Factor Authentication Enabled';
        message = `Multi-factor authentication has been enabled on your account. You will now need to provide a verification code when logging in.`;
        color = '#007bff';
        break;
      case 'MFA_DISABLED':
        title = 'Multi-Factor Authentication Disabled';
        message = `Multi-factor authentication has been disabled on your account. Your account security may be reduced.`;
        color = '#ffc107';
        break;
    }

    const subject = `Security Alert: ${title} - AGOG Print ERP`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Security Alert</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; border-radius: 5px; padding: 30px; margin-bottom: 20px; border-left: 5px solid ${color};">
          <h1 style="color: ${color}; margin-bottom: 20px;">🔒 Security Alert</h1>
          ${firstName ? `<p>Hi ${firstName},</p>` : '<p>Hello,</p>'}
          <h2 style="color: #2c3e50; font-size: 18px;">${title}</h2>
          <p>${message}</p>
          ${ipAddress ? `<p style="font-size: 14px; color: #666;"><strong>IP Address:</strong> ${ipAddress}</p>` : ''}
          <p style="font-size: 14px; color: #666;"><strong>Time:</strong> ${timestamp.toLocaleString()}</p>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">If this activity was not performed by you, please contact our support team immediately.</p>
        </div>
        <div style="font-size: 12px; color: #999; text-align: center;">
          <p>&copy; ${new Date().getFullYear()} AGOG Print ERP. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
Security Alert: ${title}

${firstName ? `Hi ${firstName},` : 'Hello,'}

${message}

${ipAddress ? `IP Address: ${ipAddress}` : ''}
Time: ${timestamp.toLocaleString()}

If this activity was not performed by you, please contact our support team immediately.

© ${new Date().getFullYear()} AGOG Print ERP. All rights reserved.
    `.trim();

    return { subject, html, text };
  }
}
