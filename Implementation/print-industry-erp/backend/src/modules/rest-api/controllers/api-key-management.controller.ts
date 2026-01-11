/**
 * API Key Management Controller
 * REQ-1767925582664-oqb5y - REST API Framework for External Integrations
 *
 * Manages API keys for external integrations
 * This controller uses JWT auth (not API key auth) since it's for managing API keys
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ApiKeyService } from '../../../common/auth/api-key.service';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  RevokeApiKeyDto,
  ApiKeyResponseDto,
  CreateApiKeyResponseDto,
  ApiAccessLogDto,
  RateLimitUsageDto,
} from '../dto/api-key.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    tenantId: string;
    email: string;
  };
}

@Controller('api/v1/admin/api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyManagementController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * Create a new API key
   * POST /api/v1/admin/api-keys
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createApiKey(
    @Body() dto: CreateApiKeyDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CreateApiKeyResponseDto> {
    const result = await this.apiKeyService.generateApiKey({
      tenantId: req.user.tenantId,
      name: dto.name,
      description: dto.description,
      scopes: dto.scopes,
      allowedIps: dto.allowedIps,
      allowedOrigins: dto.allowedOrigins,
      rateLimitPerMinute: dto.rateLimitPerMinute,
      rateLimitPerHour: dto.rateLimitPerHour,
      rateLimitPerDay: dto.rateLimitPerDay,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      createdBy: req.user.userId,
    });

    return {
      ...result.details,
      apiKey: result.apiKey,
    };
  }

  /**
   * List all API keys for the tenant
   * GET /api/v1/admin/api-keys
   */
  @Get()
  async listApiKeys(
    @Req() req: AuthenticatedRequest,
    @Query('includeRevoked') includeRevoked?: string,
  ): Promise<ApiKeyResponseDto[]> {
    return this.apiKeyService.listApiKeys(
      req.user.tenantId,
      includeRevoked === 'true',
    );
  }

  /**
   * Get API key details
   * GET /api/v1/admin/api-keys/:id
   */
  @Get(':id')
  async getApiKey(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiKeyResponseDto> {
    const keys = await this.apiKeyService.listApiKeys(req.user.tenantId, true);
    const key = keys.find(k => k.id === id);

    if (!key) {
      throw new Error('API key not found');
    }

    return key;
  }

  /**
   * Revoke an API key
   * DELETE /api/v1/admin/api-keys/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeApiKey(
    @Param('id') id: string,
    @Body() dto: RevokeApiKeyDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.apiKeyService.revokeApiKey(
      id,
      req.user.tenantId,
      req.user.userId,
      dto.reason,
    );
  }

  /**
   * Get API key usage statistics
   * GET /api/v1/admin/api-keys/:id/usage
   */
  @Get(':id/usage')
  async getApiKeyUsage(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    minute: RateLimitUsageDto;
    hour: RateLimitUsageDto;
    day: RateLimitUsageDto;
  }> {
    // This would call a new method on ApiKeyService to get usage stats
    // For now, return placeholder
    return {
      minute: {
        currentCount: 0,
        limitValue: 60,
        usagePercentage: 0,
        bucketType: 'minute',
      },
      hour: {
        currentCount: 0,
        limitValue: 3600,
        usagePercentage: 0,
        bucketType: 'hour',
      },
      day: {
        currentCount: 0,
        limitValue: 100000,
        usagePercentage: 0,
        bucketType: 'day',
      },
    };
  }
}
