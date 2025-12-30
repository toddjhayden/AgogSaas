/**
 * Authentication Module
 * Provides authentication services for internal ERP users
 *
 * REQ: REQ-STRATEGIC-AUTO-1767066329944
 * Security: GraphQL Authorization & Tenant Isolation
 */

import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DatabaseModule } from '../../database/database.module';

@Global() // Make guards available globally
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'change-me-in-production',
        signOptions: {
          expiresIn: '1h', // 1 hour for access tokens
        },
      }),
    }),
    DatabaseModule,
  ],
  providers: [JwtStrategy],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
