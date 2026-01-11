/**
 * API Key DTOs
 * REQ-1767925582664-oqb5y - REST API Framework for External Integrations
 */

import { IsString, IsArray, IsOptional, IsNumber, IsBoolean, IsDateString, MinLength, MaxLength, Min, Max } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  scopes: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedOrigins?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000000)
  rateLimitPerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000000)
  rateLimitPerDay?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedOrigins?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RevokeApiKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ApiKeyResponseDto {
  id: string;
  tenantId: string;
  keyPrefix: string;
  name: string;
  description?: string;
  scopes: string[];
  allowedIps?: string[];
  allowedOrigins?: string[];
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

export class CreateApiKeyResponseDto extends ApiKeyResponseDto {
  apiKey: string; // Only returned once on creation
}

export class ApiAccessLogDto {
  id: string;
  apiKeyId: string;
  requestMethod: string;
  requestPath: string;
  requestIp: string;
  responseStatus: number;
  responseTimeMs: number;
  rateLimitHit: boolean;
  createdAt: Date;
}

export class RateLimitUsageDto {
  currentCount: number;
  limitValue: number;
  usagePercentage: number;
  bucketType: 'minute' | 'hour' | 'day';
}
