/**
 * Pagination DTO
 * REQ-DEVOPS-SECURITY-1767150339448
 *
 * Validates pagination parameters
 * SECURITY HARDENING: Added input validation (Marcus - DevOps Security Architect)
 */

import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  first?: number;

  @IsOptional()
  @IsString()
  after?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  last?: number;

  @IsOptional()
  @IsString()
  before?: string;
}
