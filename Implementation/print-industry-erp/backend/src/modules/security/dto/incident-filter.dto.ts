/**
 * Incident Filter DTO
 * REQ-DEVOPS-SECURITY-1767150339448
 *
 * Validates input for incident filtering
 * SECURITY HARDENING: Added input validation (Marcus - DevOps Security Architect)
 */

import { IsOptional, IsEnum } from 'class-validator';
import { SecurityRiskLevel } from './security-event-filter.dto';

export enum IncidentStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  CLOSED = 'CLOSED',
}

export class IncidentFilterDto {
  @IsOptional()
  @IsEnum(IncidentStatus, { each: true })
  status?: IncidentStatus[];

  @IsOptional()
  @IsEnum(SecurityRiskLevel, { each: true })
  severity?: SecurityRiskLevel[];
}
