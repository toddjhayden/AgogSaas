import { Module } from '@nestjs/common';
import { QualityGateService } from './services/quality-gate.service';

/**
 * Code Quality Module
 * Provides quality gates and code review automation services
 * REQ-STRATEGIC-AUTO-1767108044307
 */
@Module({
  providers: [QualityGateService],
  exports: [QualityGateService],
})
export class CodeQualityModule {}
