/**
 * GraphQL Security Module
 * REQ-1767925582666-3sc6l: Implement GraphQL Query Complexity Control & Security Hardening
 *
 * Provides centralized GraphQL security services and configuration
 */

import { Module, Global } from '@nestjs/common';
import { ComplexityConfigService } from './complexity-config.service';
import { DatabaseModule } from '../../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ComplexityConfigService],
  exports: [ComplexityConfigService],
})
export class GraphQLSecurityModule {}
