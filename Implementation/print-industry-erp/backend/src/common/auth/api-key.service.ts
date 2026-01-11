/**
 * API Key Service
 * REQ-1767925582664-oqb5y - REST API Framework for External Integrations
 *
 * Manages API key generation, validation, and lifecycle
 */

import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import { createHash, randomBytes } from 'crypto';

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKeyId?: string;
  tenantId?: string;
  scopes?: string[];
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
  rateLimitPerDay?: number;
  allowedIps?: string[];
  error?: string;
}

export interface ApiKeyDetails {
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

export interface CreateApiKeyDto {
  tenantId: string;
  name: string;
  description?: string;
  scopes: string[];
  allowedIps?: string[];
  allowedOrigins?: string[];
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
  rateLimitPerDay?: number;
  expiresAt?: Date;
  createdBy?: string;
}

@Injectable()
export class ApiKeyService {
  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * Generate a new API key
   * Returns the full key (only shown once)
   */
  async generateApiKey(dto: CreateApiKeyDto): Promise<{ apiKey: string; details: ApiKeyDetails }> {
    // Generate random API key
    const randomPart = randomBytes(32).toString('hex');
    const prefix = 'ak_live_';
    const apiKey = `${prefix}${randomPart}`;

    // Hash the key for storage
    const keyHash = this.hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 20); // Store first 20 chars for identification

    const client = await this.db.connect();
    try {
      const result = await client.query(
        `INSERT INTO api_keys (
          tenant_id, key_hash, key_prefix, name, description,
          scopes, allowed_ips, allowed_origins,
          rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
          expires_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, tenant_id, key_prefix, name, description, scopes,
                  allowed_ips, allowed_origins, rate_limit_per_minute,
                  rate_limit_per_hour, rate_limit_per_day, is_active,
                  expires_at, created_at`,
        [
          dto.tenantId,
          keyHash,
          keyPrefix,
          dto.name,
          dto.description,
          dto.scopes,
          dto.allowedIps,
          dto.allowedOrigins,
          dto.rateLimitPerMinute || 60,
          dto.rateLimitPerHour || 3600,
          dto.rateLimitPerDay || 100000,
          dto.expiresAt,
          dto.createdBy,
        ]
      );

      const row = result.rows[0];
      const details: ApiKeyDetails = {
        id: row.id,
        tenantId: row.tenant_id,
        keyPrefix: row.key_prefix,
        name: row.name,
        description: row.description,
        scopes: row.scopes,
        allowedIps: row.allowed_ips,
        allowedOrigins: row.allowed_origins,
        rateLimitPerMinute: row.rate_limit_per_minute,
        rateLimitPerHour: row.rate_limit_per_hour,
        rateLimitPerDay: row.rate_limit_per_day,
        isActive: row.is_active,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      };

      return { apiKey, details };
    } finally {
      client.release();
    }
  }

  /**
   * Validate an API key
   */
  async validateApiKey(apiKey: string, requestIp?: string): Promise<ApiKeyValidationResult> {
    if (!apiKey || !apiKey.startsWith('ak_')) {
      return { valid: false, error: 'Invalid API key format' };
    }

    const keyHash = this.hashApiKey(apiKey);

    const client = await this.db.connect();
    try {
      const result = await client.query(
        `SELECT id, tenant_id, scopes, allowed_ips, allowed_origins,
                rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                is_active, expires_at
         FROM api_keys
         WHERE key_hash = $1
           AND is_active = true
           AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [keyHash]
      );

      if (result.rows.length === 0) {
        return { valid: false, error: 'Invalid or expired API key' };
      }

      const row = result.rows[0];

      // Check IP whitelist if configured
      if (row.allowed_ips && row.allowed_ips.length > 0 && requestIp) {
        const ipAllowed = row.allowed_ips.some((allowedIp: string) => {
          // Support CIDR notation check (simplified)
          return requestIp === allowedIp || requestIp.startsWith(allowedIp.split('/')[0]);
        });

        if (!ipAllowed) {
          return { valid: false, error: 'Request IP not allowed' };
        }
      }

      return {
        valid: true,
        apiKeyId: row.id,
        tenantId: row.tenant_id,
        scopes: row.scopes,
        rateLimitPerMinute: row.rate_limit_per_minute,
        rateLimitPerHour: row.rate_limit_per_hour,
        rateLimitPerDay: row.rate_limit_per_day,
        allowedIps: row.allowed_ips,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Check if API key has required scope
   */
  hasScope(scopes: string[], requiredScope: string): boolean {
    if (!scopes || scopes.length === 0) {
      return false;
    }

    // Check for wildcard scope
    if (scopes.includes('*')) {
      return true;
    }

    // Check for exact scope match
    if (scopes.includes(requiredScope)) {
      return true;
    }

    // Check for wildcard resource (e.g., 'read:*' matches 'read:orders')
    const scopeParts = requiredScope.split(':');
    if (scopeParts.length === 2) {
      const wildcardScope = `${scopeParts[0]}:*`;
      if (scopes.includes(wildcardScope)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Log API access
   */
  async logApiAccess(data: {
    tenantId: string;
    apiKeyId: string;
    requestMethod: string;
    requestPath: string;
    requestQuery?: string;
    requestHeaders?: Record<string, any>;
    requestBodySize?: number;
    requestIp: string;
    requestUserAgent?: string;
    responseStatus: number;
    responseBodySize?: number;
    responseTimeMs: number;
    rateLimitHit?: boolean;
    scopeRequired?: string;
    scopeGranted?: boolean;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    const client = await this.db.connect();
    try {
      // Filter sensitive headers
      const filteredHeaders = this.filterSensitiveHeaders(data.requestHeaders);

      await client.query(
        `INSERT INTO api_access_log (
          tenant_id, api_key_id, request_method, request_path,
          request_query, request_headers, request_body_size,
          request_ip, request_user_agent, response_status,
          response_body_size, response_time_ms, rate_limit_hit,
          scope_required, scope_granted, error_code, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          data.tenantId,
          data.apiKeyId,
          data.requestMethod,
          data.requestPath,
          data.requestQuery,
          JSON.stringify(filteredHeaders),
          data.requestBodySize,
          data.requestIp,
          data.requestUserAgent,
          data.responseStatus,
          data.responseBodySize,
          data.responseTimeMs,
          data.rateLimitHit || false,
          data.scopeRequired,
          data.scopeGranted !== false,
          data.errorCode,
          data.errorMessage,
        ]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(
    apiKeyId: string,
    rateLimitPerMinute: number,
    rateLimitPerHour: number,
    rateLimitPerDay: number
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const client = await this.db.connect();
    try {
      // Check minute bucket
      const minuteResult = await client.query(
        `SELECT request_count FROM api_rate_limit_buckets
         WHERE api_key_id = $1
           AND bucket_type = 'minute'
           AND bucket_timestamp = date_trunc('minute', CURRENT_TIMESTAMP)`,
        [apiKeyId]
      );

      if (minuteResult.rows.length > 0 && minuteResult.rows[0].request_count >= rateLimitPerMinute) {
        return { allowed: false, retryAfter: 60 };
      }

      // Check hour bucket
      const hourResult = await client.query(
        `SELECT request_count FROM api_rate_limit_buckets
         WHERE api_key_id = $1
           AND bucket_type = 'hour'
           AND bucket_timestamp = date_trunc('hour', CURRENT_TIMESTAMP)`,
        [apiKeyId]
      );

      if (hourResult.rows.length > 0 && hourResult.rows[0].request_count >= rateLimitPerHour) {
        return { allowed: false, retryAfter: 3600 };
      }

      // Check day bucket
      const dayResult = await client.query(
        `SELECT request_count FROM api_rate_limit_buckets
         WHERE api_key_id = $1
           AND bucket_type = 'day'
           AND bucket_timestamp = date_trunc('day', CURRENT_TIMESTAMP)`,
        [apiKeyId]
      );

      if (dayResult.rows.length > 0 && dayResult.rows[0].request_count >= rateLimitPerDay) {
        return { allowed: false, retryAfter: 86400 };
      }

      return { allowed: true };
    } finally {
      client.release();
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(apiKeyId: string, tenantId: string, revokedBy?: string, reason?: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query(
        `UPDATE api_keys
         SET is_active = false,
             revoked_at = CURRENT_TIMESTAMP,
             revoked_by = $3,
             revoke_reason = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2`,
        [apiKeyId, tenantId, revokedBy, reason]
      );
    } finally {
      client.release();
    }
  }

  /**
   * List API keys for a tenant
   */
  async listApiKeys(tenantId: string, includeRevoked: boolean = false): Promise<ApiKeyDetails[]> {
    const client = await this.db.connect();
    try {
      const whereClause = includeRevoked ? '' : 'AND is_active = true AND revoked_at IS NULL';

      const result = await client.query(
        `SELECT id, tenant_id, key_prefix, name, description, scopes,
                allowed_ips, allowed_origins, rate_limit_per_minute,
                rate_limit_per_hour, rate_limit_per_day, is_active,
                expires_at, last_used_at, created_at
         FROM api_keys
         WHERE tenant_id = $1 ${whereClause}
         ORDER BY created_at DESC`,
        [tenantId]
      );

      return result.rows.map(row => ({
        id: row.id,
        tenantId: row.tenant_id,
        keyPrefix: row.key_prefix,
        name: row.name,
        description: row.description,
        scopes: row.scopes,
        allowedIps: row.allowed_ips,
        allowedOrigins: row.allowed_origins,
        rateLimitPerMinute: row.rate_limit_per_minute,
        rateLimitPerHour: row.rate_limit_per_hour,
        rateLimitPerDay: row.rate_limit_per_day,
        isActive: row.is_active,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Hash API key for secure storage
   */
  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Filter sensitive headers from logging
   */
  private filterSensitiveHeaders(headers?: Record<string, any>): Record<string, any> {
    if (!headers) return {};

    const filtered = { ...headers };
    const sensitiveKeys = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

    for (const key of sensitiveKeys) {
      if (filtered[key]) {
        filtered[key] = '[REDACTED]';
      }
    }

    return filtered;
  }
}
