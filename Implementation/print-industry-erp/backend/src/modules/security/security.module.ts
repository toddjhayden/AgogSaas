/**
 * Security Module
 * REQ-DEVOPS-SECURITY-1767150339448
 *
 * Provides comprehensive security monitoring and audit capabilities:
 * - Security event logging and correlation
 * - Threat pattern detection
 * - Incident management
 * - Compliance audit trail
 * - Real-time security dashboards
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SecurityAuditService } from './services/security-audit.service';
import { SecurityAuditResolver } from '../../graphql/resolvers/security-audit.resolver';

@Module({
  imports: [DatabaseModule],
  providers: [
    SecurityAuditService,
    SecurityAuditResolver,
  ],
  exports: [
    SecurityAuditService,
    SecurityAuditResolver,
  ],
})
export class SecurityModule {}
