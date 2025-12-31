/**
 * Security Event Filter DTO
 * REQ-DEVOPS-SECURITY-1767150339448
 *
 * Validates input for security event filtering
 * SECURITY HARDENING: Added input validation (Marcus - DevOps Security Architect)
 */

import { IsOptional, IsEnum, IsNumber, IsString, IsBoolean, IsIP, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ZONE_ACCESS_GRANTED = 'ZONE_ACCESS_GRANTED',
  ZONE_ACCESS_DENIED = 'ZONE_ACCESS_DENIED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  USER_CREATED = 'USER_CREATED',
  USER_MODIFIED = 'USER_MODIFIED',
  USER_DELETED = 'USER_DELETED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  CONCURRENT_SESSION = 'CONCURRENT_SESSION',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
}

export enum SecurityRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class SecurityEventFilterDto {
  @IsOptional()
  @IsEnum(SecurityEventType, { each: true })
  eventTypes?: SecurityEventType[];

  @IsOptional()
  @IsEnum(SecurityRiskLevel, { each: true })
  riskLevels?: SecurityRiskLevel[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  userId?: number;

  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  success?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  flaggedSuspicious?: boolean;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @IsString()
  searchQuery?: string;
}
