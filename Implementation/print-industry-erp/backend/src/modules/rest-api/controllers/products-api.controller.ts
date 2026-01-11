/**
 * Products REST API Controller
 * REQ-1767925582664-oqb5y - REST API Framework for External Integrations
 *
 * External API endpoints for product catalog management
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

interface ProductDto {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  currency: string;
  stockQuantity?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateProductDto {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  currency?: string;
  stockQuantity?: number;
  metadata?: Record<string, any>;
}

interface UpdateProductDto {
  name?: string;
  description?: string;
  category?: string;
  unitPrice?: number;
  stockQuantity?: number;
  isActive?: boolean;
}

@Controller('api/v1/products')
@UseGuards(ApiKeyAuthGuard)
export class ProductsApiController {
  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * List products with pagination and filtering
   * GET /api/v1/products
   * Required scope: read:products
   */
  @Get()
  @RequireScope('read:products')
  async listProducts(
    @Req() req: ApiKeyAuthRequest,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ): Promise<{ data: ProductDto[]; pagination: { limit: number; offset: number; total: number } }> {
    const client = await this.db.connect();
    try {
      await client.query('SET app.current_tenant_id = $1', [req.apiKey!.tenantId]);

      let whereClause = '1=1';
      const params: any[] = [];

      if (category) {
        params.push(category);
        whereClause += ` AND category = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        whereClause += ` AND (name ILIKE $${params.length} OR sku ILIKE $${params.length})`;
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM products WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0]?.total || '0');

      // Get paginated results
      params.push(parseInt(limit), parseInt(offset));
      const result = await client.query(
        `SELECT id, sku, name, description, category, unit_price,
                currency, stock_quantity, is_active, created_at, updated_at
         FROM products
         WHERE ${whereClause}
         ORDER BY name
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const products: ProductDto[] = result.rows.map(row => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        description: row.description,
        category: row.category,
        unitPrice: parseFloat(row.unit_price),
        currency: row.currency || 'USD',
        stockQuantity: row.stock_quantity,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return {
        data: products,
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
   * Get product by ID or SKU
   * GET /api/v1/products/:idOrSku
   * Required scope: read:products
   */
  @Get(':idOrSku')
  @RequireScope('read:products')
  async getProduct(
    @Param('idOrSku') idOrSku: string,
    @Req() req: ApiKeyAuthRequest,
  ): Promise<ProductDto> {
    const client = await this.db.connect();
    try {
      await client.query('SET app.current_tenant_id = $1', [req.apiKey!.tenantId]);

      const result = await client.query(
        `SELECT id, sku, name, description, category, unit_price,
                currency, stock_quantity, is_active, created_at, updated_at
         FROM products
         WHERE id = $1 OR sku = $1`,
        [idOrSku]
      );

      if (result.rows.length === 0) {
        throw new Error('Product not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        sku: row.sku,
        name: row.name,
        description: row.description,
        category: row.category,
        unitPrice: parseFloat(row.unit_price),
        currency: row.currency || 'USD',
        stockQuantity: row.stock_quantity,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Create a new product
   * POST /api/v1/products
   * Required scope: write:products
   */
  @Post()
  @RequireScope('write:products')
  @HttpCode(HttpStatus.CREATED)
  async createProduct(
    @Body() dto: CreateProductDto,
    @Req() req: ApiKeyAuthRequest,
  ): Promise<ProductDto> {
    const client = await this.db.connect();
    try {
      await client.query('SET app.current_tenant_id = $1', [req.apiKey!.tenantId]);

      const result = await client.query(
        `INSERT INTO products (
          tenant_id, sku, name, description, category, unit_price,
          currency, stock_quantity, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, sku, name, description, category, unit_price,
                  currency, stock_quantity, is_active, created_at, updated_at`,
        [
          req.apiKey!.tenantId,
          dto.sku,
          dto.name,
          dto.description,
          dto.category,
          dto.unitPrice,
          dto.currency || 'USD',
          dto.stockQuantity || 0,
          JSON.stringify(dto.metadata || {}),
        ]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        sku: row.sku,
        name: row.name,
        description: row.description,
        category: row.category,
        unitPrice: parseFloat(row.unit_price),
        currency: row.currency,
        stockQuantity: row.stock_quantity,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update a product
   * PUT /api/v1/products/:id
   * Required scope: write:products
   */
  @Put(':id')
  @RequireScope('write:products')
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: ApiKeyAuthRequest,
  ): Promise<ProductDto> {
    const client = await this.db.connect();
    try {
      await client.query('SET app.current_tenant_id = $1', [req.apiKey!.tenantId]);

      // Build dynamic update query
      const updates: string[] = [];
      const params: any[] = [id];

      if (dto.name !== undefined) {
        params.push(dto.name);
        updates.push(`name = $${params.length}`);
      }
      if (dto.description !== undefined) {
        params.push(dto.description);
        updates.push(`description = $${params.length}`);
      }
      if (dto.category !== undefined) {
        params.push(dto.category);
        updates.push(`category = $${params.length}`);
      }
      if (dto.unitPrice !== undefined) {
        params.push(dto.unitPrice);
        updates.push(`unit_price = $${params.length}`);
      }
      if (dto.stockQuantity !== undefined) {
        params.push(dto.stockQuantity);
        updates.push(`stock_quantity = $${params.length}`);
      }
      if (dto.isActive !== undefined) {
        params.push(dto.isActive);
        updates.push(`is_active = $${params.length}`);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');

      const result = await client.query(
        `UPDATE products
         SET ${updates.join(', ')}
         WHERE id = $1
         RETURNING id, sku, name, description, category, unit_price,
                   currency, stock_quantity, is_active, created_at, updated_at`,
        params
      );

      if (result.rows.length === 0) {
        throw new Error('Product not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        sku: row.sku,
        name: row.name,
        description: row.description,
        category: row.category,
        unitPrice: parseFloat(row.unit_price),
        currency: row.currency,
        stockQuantity: row.stock_quantity,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Check product availability
   * GET /api/v1/products/:id/availability
   * Required scope: read:products
   */
  @Get(':id/availability')
  @RequireScope('read:products')
  async checkAvailability(
    @Param('id') id: string,
    @Query('quantity') quantity: string = '1',
    @Req() req: ApiKeyAuthRequest,
  ): Promise<{ available: boolean; stockQuantity: number; requestedQuantity: number }> {
    const client = await this.db.connect();
    try {
      await client.query('SET app.current_tenant_id = $1', [req.apiKey!.tenantId]);

      const result = await client.query(
        `SELECT stock_quantity FROM products WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Product not found');
      }

      const stockQuantity = result.rows[0].stock_quantity || 0;
      const requestedQuantity = parseInt(quantity);

      return {
        available: stockQuantity >= requestedQuantity,
        stockQuantity,
        requestedQuantity,
      };
    } finally {
      client.release();
    }
  }
}
