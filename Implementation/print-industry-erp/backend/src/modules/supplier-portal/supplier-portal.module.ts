/**
 * Supplier Portal Module
 * Handles supplier portal features (authentication, POs, ASNs, performance)
 *
 * REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { SupplierAuthService } from './services/supplier-auth.service';
import { SupplierPortalService } from './services/supplier-portal.service';
import { SupplierAuthGuard } from './guards/supplier-auth.guard';
import { PasswordService } from '../../common/security/password.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'supplier-portal-secret-key',
        signOptions: {
          issuer: 'print-erp-supplier-portal',
          audience: 'supplier-portal',
        },
      }),
    }),
  ],
  providers: [
    SupplierAuthService,
    SupplierPortalService,
    SupplierAuthGuard,
    PasswordService,
    {
      provide: Pool,
      useFactory: (configService: ConfigService) => {
        return new Pool({
          host: configService.get<string>('DB_HOST') || 'localhost',
          port: configService.get<number>('DB_PORT') || 5432,
          database: configService.get<string>('DB_NAME') || 'print_erp',
          user: configService.get<string>('DB_USER') || 'postgres',
          password: configService.get<string>('DB_PASSWORD') || 'postgres',
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    SupplierAuthService,
    SupplierPortalService,
    SupplierAuthGuard,
  ],
})
export class SupplierPortalModule {}
