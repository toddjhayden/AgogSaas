/**
 * Webhook Management Controller
 * REQ-1767925582664-oqb5y - REST API Framework for External Integrations
 *
 * Manages webhook configurations and monitors deliveries
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
import { WebhookService, WebhookConfig, WebhookDelivery } from '../services/webhook.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    tenantId: string;
    email: string;
  };
}

interface CreateWebhookDto {
  name: string;
  url: string;
  secret?: string;
  enabledEvents: string[];
  customHeaders?: Record<string, string>;
  retryEnabled?: boolean;
  maxRetries?: number;
  retryDelaySeconds?: number;
  verifySsl?: boolean;
  timeoutSeconds?: number;
}

interface UpdateWebhookDto {
  name?: string;
  url?: string;
  enabledEvents?: string[];
  customHeaders?: Record<string, string>;
  isActive?: boolean;
}

@Controller('api/v1/admin/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhookManagementController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Create a new webhook
   * POST /api/v1/admin/webhooks
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWebhook(
    @Body() dto: CreateWebhookDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<WebhookConfig> {
    return this.webhookService.createWebhook({
      tenantId: req.user.tenantId,
      ...dto,
    });
  }

  /**
   * List all webhooks
   * GET /api/v1/admin/webhooks
   */
  @Get()
  async listWebhooks(@Req() req: AuthenticatedRequest): Promise<WebhookConfig[]> {
    return this.webhookService.listWebhooks(req.user.tenantId);
  }

  /**
   * Get webhook deliveries
   * GET /api/v1/admin/webhooks/:id/deliveries
   */
  @Get(':id/deliveries')
  async getDeliveries(
    @Param('id') id: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ): Promise<WebhookDelivery[]> {
    return this.webhookService.getDeliveries(id, parseInt(limit), parseInt(offset));
  }

  /**
   * Test webhook
   * POST /api/v1/admin/webhooks/:id/test
   */
  @Post(':id/test')
  async testWebhook(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    // Trigger a test webhook event
    await this.webhookService.triggerWebhook(
      req.user.tenantId,
      'webhook.test',
      id,
      {
        message: 'This is a test webhook',
        timestamp: new Date().toISOString(),
        testId: id,
      }
    );

    return { message: 'Test webhook triggered' };
  }
}
