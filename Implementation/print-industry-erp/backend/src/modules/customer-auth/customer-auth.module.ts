/**
 * Customer Authentication Module
 * Provides authentication services for customer portal users
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328659
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';
import { PasswordService } from '../../common/security/password.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'customer-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('CUSTOMER_JWT_SECRET') || 'customer-secret-change-me',
        signOptions: {
          expiresIn: '30m', // 30 minutes for access tokens
        },
      }),
    }),
    DatabaseModule,
  ],
  providers: [
    CustomerAuthService,
    CustomerJwtStrategy,
    PasswordService,
  ],
  exports: [CustomerAuthService, PasswordService],
})
export class CustomerAuthModule {}
