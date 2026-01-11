/**
 * Email Notification Channel
 * REQ: REQ-1767925582665-67qxb
 *
 * Delivers notifications via email using the existing email provider.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailNotificationChannel {
  private readonly logger = new Logger(EmailNotificationChannel.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('EMAIL_FROM') || 'noreply@agog.com';

    // Initialize SMTP transporter
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT') || 465,
      secure: true,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  /**
   * Send notification via email
   */
  async send(
    recipientAddress: string,
    subject: string,
    body: string,
    metadata?: Record<string, any>,
  ): Promise<string | null> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: recipientAddress,
        subject,
        html: body,
        text: this.stripHtml(body),
      });

      this.logger.log(`Email sent to ${recipientAddress}: ${subject}`);

      return info.messageId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${recipientAddress}:`, error);
      throw new Error(`Email delivery failed: ${errorMessage}`);
    }
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}
