/**
 * Nodemailer Email Provider
 * Implements IEmailProvider using nodemailer for SMTP email delivery
 *
 * REQ: REQ-STRATEGIC-AUTO-1767103864617
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { IEmailProvider } from '../email.interface';

@Injectable()
export class NodemailerProvider implements IEmailProvider {
  private readonly logger = new Logger(NodemailerProvider.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('EMAIL_FROM') || 'noreply@agog.com';

    // Initialize SMTP transporter
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT') || 465,
      secure: true, // Use TLS
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    // Verify connection on initialization
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (error) {
      this.logger.error('SMTP connection failed:', error);
      this.logger.warn('Email service will continue but emails may fail to send');
    }
  }

  async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
        text,
      });

      this.logger.log(`Email sent successfully to ${to}: ${subject}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw new Error(`Email delivery failed: ${errorMessage}`);
    }
  }
}
