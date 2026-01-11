/**
 * Orders REST API Controller
 * REQ-1767925582664-oqb5y - REST API Framework for External Integrations
 *
 * External API endpoints for order management
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Pool } from 'pg';
import { ApiKeyAuthGuard, ApiKeyAuthRequest, RequireScope } from '../../../common/guards/api-key-auth.guard';

interface OrderDto {
  id: string;
  orderNumber: string;
  customerId: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: Date;
  items: OrderItemDto[];
}

interface OrderItemDto {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface CreateOrderDto {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  metadata?: Record<string, any>;
}

interface UpdateOrderStatusDto {
  status: string;
  notes?: string;
}

@Controller('api/v1/orders')
@UseGuards(ApiKeyAuthGuard)
export class OrdersApiController {
  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * List orders with pagination and filtering
   * GET /api/v1/orders
   * Required scope: read:orders
   */
  @Get()
  @RequireScope('read:orders')
  async listOrders(
    @Req() req: ApiKeyAuthRequest,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ): Promise<{ data: OrderDto[]; pagination: { limit: number; offset: number; total: number } }> {
    const client = await this.db.connect();
    try {
      // Set tenant context
      await client.query('SET app.current_tenant_id = $1', [req.apiKey!.tenantId]);

      // Build query
      let whereClause = '1=1';
      const params: any[] = [];

      if (status) {
        params.push(status);
        whereClause += ` AND status = $${params.length}`;
      }

      if (customerId) {
        params.push(customerId);
        whereClause += ` AND customer_id = $${params.length}`;
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM sales_orders WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0]?.total || '0');

      // Get paginated results
      params.push(parseInt(limit), parseInt(offset));
      const result = await client.query(
        `SELECT id, order_number, customer_id, status, total_amount,
                currency, created_at
         FROM sales_orders
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const orders: OrderDto[] = result.rows.map(row => ({
        id: row.id,
        orderNumber: row.order_number,
        customerId: row.customer_id,
        status: row.status,
        totalAmount: parseFloat(row.total_amount),
        currency: row.currency || 'USD',
        createdAt: row.created_at,
        items: [], // Would be populated with a join or separate query
      }));

      return {
        data: orders,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total,
        },
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get order by ID
   * GET /api/v1/orders/:id
   * Required scope: read:orders
   */
  @Get(':id')
  @RequireScope('read:orders')
  async getOrder(
    @Param('id') id: string,
    @Req() req: ApiKeyAuthRequest,
  ): Promise<OrderDto> {
    const client = await this.db.connect();
    try {
      await client.query('SET app.current_tenant_id = $1', [req.apiKey!.tenantId]);

      const result = await client.query(
        `SELECT id, order_number, customer_id, status, total_amount,
                currency, created_at
         FROM sales_orders
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        orderNumber: row.order_number,
        customerId: row.customer_id,
        status: row.status,
        totalAmount: parseFloat(row.total_amount),
        currency: row.currency || 'USD',
        createdAt: row.created_at,
        items: [], // Would be populated with order items query
      };
    } finally {
      client.release();
    }
  }

  /**
   * Create a new order
   * POST /api/v1/orders
   * Required scope: write:orders
   */
  @Post()
  @RequireScope('write:orders')
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Body() dto: CreateOrderDto,
    @Req() req: ApiKeyAuthRequest,
  ): Promise<OrderDto> {
    const client = await this.db.connect();
    try {
      await client.query('SET app.current_tenant_id = $1', [req.apiKey!.tenantId]);
      await client.query('BEGIN');

      // Calculate total
      const totalAmount = dto.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

      // Create order
      const orderResult = await client.query(
        `INSERT INTO sales_orders (
          tenant_id, customer_id, status, total_amount, currency, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, order_number, customer_id, status, total_amount, currency, created_at`,
        [req.apiKey!.tenantId, dto.customerId, 'pending', totalAmount, 'USD', JSON.stringify(dto.metadata || {})]
      );

      const order = orderResult.rows[0];

      // Create order items
      for (const item of dto.items) {
        await client.query(
          `INSERT INTO sales_order_items (
            tenant_id, order_id, product_id, quantity, unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.apiKey!.tenantId, order.id, item.productId, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
        );
      }

      await client.query('COMMIT');

      return {
        id: order.id,
        orderNumber: order.order_number,
        customerId: order.customer_id,
        status: order.status,
        totalAmount: parseFloat(order.total_amount),
        currency: order.currency,
        createdAt: order.created_at,
        items: dto.items.map(item => ({
          id: '', // Would be returned from insert
          productId: item.productId,
          productName: '', // Would be fetched
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
        })),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update order status
   * PUT /api/v1/orders/:id/status
   * Required scope: write:orders
   */
  @Put(':id/status')
  @RequireScope('write:orders')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: ApiKeyAuthRequest,
  ): Promise<OrderDto> {
    const client = await this.db.connect();
    try {
      await client.query('SET app.current_tenant_id = $1', [req.apiKey!.tenantId]);

      const result = await client.query(
        `UPDATE sales_orders
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, order_number, customer_id, status, total_amount, currency, created_at`,
        [dto.status, id]
      );

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        orderNumber: row.order_number,
        customerId: row.customer_id,
        status: row.status,
        totalAmount: parseFloat(row.total_amount),
        currency: row.currency,
        createdAt: row.created_at,
        items: [],
      };
    } finally {
      client.release();
    }
  }
}
