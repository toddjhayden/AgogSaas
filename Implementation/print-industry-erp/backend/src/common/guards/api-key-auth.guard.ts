/**
 * API Key Authentication Guard
 * REQ-1767925582664-oqb5y - REST API Framework for External Integrations
 *
 * Validates API keys from request headers and enforces rate limiting
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { ApiKeyService } from '../auth/api-key.service';

// Metadata key for required scope
export const REQUIRED_SCOPE_KEY = 'requiredScope';

// Decorator to specify required scope
export const RequireScope = (scope: string) => {
  const { SetMetadata } = require('@nestjs/common');
  return SetMetadata(REQUIRED_SCOPE_KEY, scope);
};

// Extended request interface with API key context
export interface ApiKeyAuthRequest extends Request {
  apiKey?: {
    id: string;
    tenantId: string;
    scopes: string[];
  };
}

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyAuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    // Extract API key from header
    const apiKey = this.extractApiKey(request);
    if (!apiKey) {
      throw new UnauthorizedException('API key is required. Provide it via X-API-Key header.');
    }

    // Get request IP
    const requestIp = this.getRequestIp(request);

    // Validate API key
    const startTime = Date.now();
    const validation = await this.apiKeyService.validateApiKey(apiKey, requestIp);

    if (!validation.valid) {
      // Log failed attempt
      await this.logApiAccess(request, response, {
        apiKeyId: 'unknown',
        tenantId: 'unknown',
        responseStatus: 401,
        responseTimeMs: Date.now() - startTime,
        errorCode: 'INVALID_API_KEY',
        errorMessage: validation.error || 'Invalid API key',
      });

      throw new UnauthorizedException(validation.error || 'Invalid API key');
    }

    // Check rate limits
    const rateLimitCheck = await this.apiKeyService.checkRateLimit(
      validation.apiKeyId!,
      validation.rateLimitPerMinute!,
      validation.rateLimitPerHour!,
      validation.rateLimitPerDay!,
    );

    if (!rateLimitCheck.allowed) {
      // Set rate limit headers
      response.setHeader('X-RateLimit-Limit', validation.rateLimitPerMinute!);
      response.setHeader('X-RateLimit-Remaining', '0');
      response.setHeader('X-RateLimit-Reset', Date.now() + rateLimitCheck.retryAfter! * 1000);
      response.setHeader('Retry-After', rateLimitCheck.retryAfter!);

      // Log rate limit hit
      await this.logApiAccess(request, response, {
        apiKeyId: validation.apiKeyId!,
        tenantId: validation.tenantId!,
        responseStatus: 429,
        responseTimeMs: Date.now() - startTime,
        rateLimitHit: true,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorMessage: 'Rate limit exceeded',
      });

      throw new HttpException(
        {
          statusCode: 429,
          message: 'Rate limit exceeded',
          retryAfter: rateLimitCheck.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check required scope
    const requiredScope = this.reflector.get<string>(REQUIRED_SCOPE_KEY, context.getHandler());
    if (requiredScope) {
      const hasScope = this.apiKeyService.hasScope(validation.scopes!, requiredScope);

      if (!hasScope) {
        // Log insufficient scope
        await this.logApiAccess(request, response, {
          apiKeyId: validation.apiKeyId!,
          tenantId: validation.tenantId!,
          responseStatus: 403,
          responseTimeMs: Date.now() - startTime,
          scopeRequired: requiredScope,
          scopeGranted: false,
          errorCode: 'INSUFFICIENT_SCOPE',
          errorMessage: `Required scope: ${requiredScope}`,
        });

        throw new HttpException(
          {
            statusCode: 403,
            message: 'Insufficient permissions',
            requiredScope,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Attach API key context to request
    request.apiKey = {
      id: validation.apiKeyId!,
      tenantId: validation.tenantId!,
      scopes: validation.scopes!,
    };

    // Set rate limit headers for successful request
    response.setHeader('X-RateLimit-Limit', validation.rateLimitPerMinute!);

    return true;
  }

  /**
   * Extract API key from request headers
   */
  private extractApiKey(request: Request): string | null {
    // Check X-API-Key header (preferred)
    const headerKey = request.headers['x-api-key'] as string;
    if (headerKey) {
      return headerKey;
    }

    // Check Authorization header with "Bearer" scheme
    const authHeader = request.headers['authorization'] as string;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token.startsWith('ak_')) {
        return token;
      }
    }

    return null;
  }

  /**
   * Get request IP address
   */
  private getRequestIp(request: Request): string {
    // Check X-Forwarded-For header (proxy/load balancer)
    const forwardedFor = request.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    // Check X-Real-IP header
    const realIp = request.headers['x-real-ip'] as string;
    if (realIp) {
      return realIp;
    }

    // Fallback to socket IP
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  /**
   * Log API access after request completes
   */
  private async logApiAccess(
    request: Request,
    response: Response,
    overrides: {
      apiKeyId: string;
      tenantId: string;
      responseStatus: number;
      responseTimeMs: number;
      rateLimitHit?: boolean;
      scopeRequired?: string;
      scopeGranted?: boolean;
      errorCode?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    try {
      await this.apiKeyService.logApiAccess({
        tenantId: overrides.tenantId,
        apiKeyId: overrides.apiKeyId,
        requestMethod: request.method,
        requestPath: request.path,
        requestQuery: request.url.includes('?') ? request.url.split('?')[1] : undefined,
        requestHeaders: request.headers as Record<string, any>,
        requestBodySize: request.headers['content-length']
          ? parseInt(request.headers['content-length'] as string)
          : undefined,
        requestIp: this.getRequestIp(request),
        requestUserAgent: request.headers['user-agent'],
        responseStatus: overrides.responseStatus,
        responseTimeMs: overrides.responseTimeMs,
        rateLimitHit: overrides.rateLimitHit,
        scopeRequired: overrides.scopeRequired,
        scopeGranted: overrides.scopeGranted,
        errorCode: overrides.errorCode,
        errorMessage: overrides.errorMessage,
      });
    } catch (error) {
      // Don't fail the request if logging fails
      console.error('Failed to log API access:', error);
    }
  }
}
