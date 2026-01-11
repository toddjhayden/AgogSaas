/**
 * Security Module
 * REQ-DEVOPS-SECURITY-1767150339448
 * REQ-STRATEGIC-AUTO-1767452038783 - Secrets Rotation & Credential Management
 * REQ-1767508090235-mvcn3 - Multi-Tenant Row-Level Security Implementation
 * REQ-1767924916114-xhhll - Comprehensive Audit Logging
 *
 * Provides comprehensive security monitoring and audit capabilities:
 * - Security event logging and correlation
 * - Threat pattern detection
 * - Incident management
 * - Compliance audit trail
 * - Real-time security dashboards
 * - Secrets rotation and secure credential management
 * - Automated credential rotation
 * - Row-Level Security (RLS) policy management and monitoring
 * - Comprehensive audit logging with mutations support
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SecurityAuditService } from './services/security-audit.service';
import { SecurityAuditMutationsService } from './services/security-audit-mutations.service';
import { SecurityAuditResolver } from '../../graphql/resolvers/security-audit.resolver';
import { SecretsManagerService } from './services/secrets-manager.service';
import { CredentialRotationService } from './services/credential-rotation.service';
import { SecretsManagementResolver } from '../../graphql/resolvers/secrets-management.resolver';
import { RLSManagementService } from './services/rls-management.service';
import { RLSManagementResolver } from '../../graphql/resolvers/rls-management.resolver';

@Module({
  imports: [DatabaseModule],
  providers: [
    SecurityAuditService,
    SecurityAuditMutationsService,
    SecurityAuditResolver,
    SecretsManagerService,
    CredentialRotationService,
    SecretsManagementResolver,
    RLSManagementService,
    RLSManagementResolver,
  ],
  exports: [
    SecurityAuditService,
    SecurityAuditMutationsService,
    SecurityAuditResolver,
    SecretsManagerService,
    CredentialRotationService,
    SecretsManagementResolver,
    RLSManagementService,
    RLSManagementResolver,
  ],
})
export class SecurityModule {}
