/**
 * REST API Module
 * REQ-1767925582664-oqb5y - REST API Framework for External Integrations
 *
 * Provides REST API endpoints for external integrations with:
 * - API key authentication
 * - Rate limiting
 * - Request/response logging
 * - OpenAPI/Swagger documentation
 */

import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../../database/database.module';
import { ApiKeyService } from '../../common/auth/api-key.service';
import { ApiKeyAuthGuard } from '../../common/guards/api-key-auth.guard';
import { ApiLoggingInterceptor } from '../../common/interceptors/api-logging.interceptor';

// Controllers
import { ApiKeyManagementController } from './controllers/api-key-management.controller';
import { OrdersApiController } from './controllers/orders-api.controller';
import { ProductsApiController } from './controllers/products-api.controller';
import { WebhookManagementController } from './controllers/webhook-management.controller';

// Services
import { WebhookService } from './services/webhook.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    ApiKeyManagementController,
    OrdersApiController,
    ProductsApiController,
    WebhookManagementController,
  ],
  providers: [
    ApiKeyService,
    WebhookService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiLoggingInterceptor,
    },
  ],
  exports: [ApiKeyService, WebhookService],
})
export class RestApiModule {}
