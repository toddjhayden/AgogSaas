/**
 * API Logging Interceptor
 * REQ-1767925582664-oqb5y - REST API Framework for External Integrations
 *
 * Logs all API requests and responses for audit and analytics
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiKeyService } from '../auth/api-key.service';
import { ApiKeyAuthRequest } from '../guards/api-key-auth.guard';

@Injectable()
export class ApiLoggingInterceptor implements NestInterceptor {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<ApiKeyAuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Skip logging if no API key context (not an API request)
    if (!request.apiKey) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (responseBody) => {
        const responseTimeMs = Date.now() - startTime;
        const responseBodySize = responseBody ? JSON.stringify(responseBody).length : 0;

        // Log successful request
        await this.logApiAccess(request, response, {
          responseStatus: response.statusCode,
          responseBodySize,
          responseTimeMs,
        });

        // Set response time header
        response.setHeader('X-Response-Time', `${responseTimeMs}ms`);
      }),
      catchError(async (error) => {
        const responseTimeMs = Date.now() - startTime;

        // Log error request
        await this.logApiAccess(request, response, {
          responseStatus: error.status || 500,
          responseTimeMs,
          errorCode: error.name,
          errorMessage: error.message,
        });

        // Set response time header
        response.setHeader('X-Response-Time', `${responseTimeMs}ms`);

        throw error;
      }),
    );
  }

  /**
   * Log API access
   */
  private async logApiAccess(
    request: ApiKeyAuthRequest,
    response: Response,
    overrides: {
      responseStatus: number;
      responseBodySize?: number;
      responseTimeMs: number;
      errorCode?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    try {
      if (!request.apiKey) return;

      await this.apiKeyService.logApiAccess({
        tenantId: request.apiKey.tenantId,
        apiKeyId: request.apiKey.id,
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
        responseBodySize: overrides.responseBodySize,
        responseTimeMs: overrides.responseTimeMs,
        errorCode: overrides.errorCode,
        errorMessage: overrides.errorMessage,
      });
    } catch (error) {
      // Don't fail the request if logging fails
      console.error('Failed to log API access:', error);
    }
  }

  /**
   * Get request IP address
   */
  private getRequestIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers['x-real-ip'] as string;
    if (realIp) {
      return realIp;
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
