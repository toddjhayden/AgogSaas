/**
 * Database Service Unit Tests
 * REQ: REQ-1767508090235-mvcn3 - Multi-Tenant Row-Level Security Implementation
 *
 * Tests for tenant context management and RLS enforcement
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Pool, PoolClient } from 'pg';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: jest.Mocked<PoolClient>;

  beforeEach(async () => {
    // Create mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    } as any;

    // Create mock pool
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn(),
      totalCount: 10,
      idleCount: 5,
      waitingCount: 0,
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: 'DATABASE_POOL',
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('query', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    const userId = '789e4567-e89b-12d3-a456-426614174000';

    it('should set tenant context before executing query', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockClient.query.mockResolvedValue(mockResult as any);

      await service.query(
        { tenantId },
        'SELECT * FROM invoices',
        []
      );

      // Verify tenant context was set
      expect(mockClient.query).toHaveBeenNthCalledWith(
        1,
        'SET LOCAL app.current_tenant_id = $1',
        [tenantId]
      );

      // Verify query was executed
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        'SELECT * FROM invoices',
        []
      );

      // Verify client was released
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should set user context when userId provided', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockClient.query.mockResolvedValue(mockResult as any);

      await service.query(
        { tenantId, userId },
        'INSERT INTO invoices (...) VALUES (...)',
        []
      );

      // Verify tenant context was set
      expect(mockClient.query).toHaveBeenNthCalledWith(
        1,
        'SET LOCAL app.current_tenant_id = $1',
        [tenantId]
      );

      // Verify user context was set
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        'SET LOCAL app.current_user_id = $1',
        [userId]
      );

      // Verify query was executed
      expect(mockClient.query).toHaveBeenNthCalledWith(
        3,
        'INSERT INTO invoices (...) VALUES (...)',
        []
      );
    });

    it('should release client even if query fails', async () => {
      mockClient.query.mockRejectedValue(new Error('Query failed'));

      await expect(
        service.query({ tenantId }, 'SELECT * FROM invoices')
      ).rejects.toThrow('Query failed');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return query results', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'Invoice 1' }],
        rowCount: 1,
      };
      mockClient.query.mockResolvedValue(mockResult as any);

      const result = await service.query(
        { tenantId },
        'SELECT * FROM invoices'
      );

      expect(result).toEqual(mockResult);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('transaction', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';

    it('should wrap callback in transaction with tenant context', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockClient.query.mockResolvedValue(mockResult as any);

      const callback = jest.fn().mockResolvedValue({ success: true });

      await service.transaction({ tenantId }, callback);

      // Verify BEGIN
      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');

      // Verify tenant context
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        'SET LOCAL app.current_tenant_id = $1',
        [tenantId]
      );

      // Verify callback was called with client
      expect(callback).toHaveBeenCalledWith(mockClient);

      // Verify COMMIT
      expect(mockClient.query).toHaveBeenNthCalledWith(3, 'COMMIT');

      // Verify client was released
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on callback error', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockClient.query.mockResolvedValue(mockResult as any);

      const callback = jest.fn().mockRejectedValue(new Error('Callback failed'));

      await expect(
        service.transaction({ tenantId }, callback)
      ).rejects.toThrow('Callback failed');

      // Verify BEGIN was called
      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');

      // Verify ROLLBACK was called
      expect(mockClient.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');

      // Verify client was released
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return callback result', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockClient.query.mockResolvedValue(mockResult as any);

      const expectedResult = { id: 1, name: 'Invoice 1' };
      const callback = jest.fn().mockResolvedValue(expectedResult);

      const result = await service.transaction({ tenantId }, callback);

      expect(result).toEqual(expectedResult);
    });

    it('should allow multiple queries in transaction', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockClient.query.mockResolvedValue(mockResult as any);

      await service.transaction({ tenantId }, async (client) => {
        await client.query('INSERT INTO invoices ...');
        await client.query('INSERT INTO invoice_lines ...');
        await client.query('UPDATE invoice_totals ...');
      });

      // Verify BEGIN, SET LOCAL, 3 queries, COMMIT
      expect(mockClient.query).toHaveBeenCalledTimes(6);
      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(3, 'INSERT INTO invoices ...');
      expect(mockClient.query).toHaveBeenNthCalledWith(4, 'INSERT INTO invoice_lines ...');
      expect(mockClient.query).toHaveBeenNthCalledWith(5, 'UPDATE invoice_totals ...');
      expect(mockClient.query).toHaveBeenNthCalledWith(6, 'COMMIT');
    });
  });

  describe('querySystem', () => {
    it('should execute query without tenant context', async () => {
      const mockResult = { rows: [{ count: 100 }], rowCount: 1 };
      mockPool.query.mockResolvedValue(mockResult as any);

      const result = await service.querySystem(
        'SELECT COUNT(*) as count FROM invoices'
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM invoices',
        undefined
      );
      expect(result).toEqual(mockResult);

      // Verify no tenant context was set
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('should execute query with parameters', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockPool.query.mockResolvedValue(mockResult as any);

      await service.querySystem(
        'SELECT * FROM system_config WHERE key = $1',
        ['max_connections']
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM system_config WHERE key = $1',
        ['max_connections']
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when database is accessible', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ health: 1 }] } as any);

      const result = await service.healthCheck();

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1 as health');
    });

    it('should return false when database is not accessible', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection failed'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', () => {
      const stats = service.getPoolStats();

      expect(stats).toEqual({
        totalConnections: 10,
        idleConnections: 5,
        waitingClients: 0,
      });
    });
  });

  describe('getClient', () => {
    it('should return a database client', async () => {
      const client = await service.getClient();

      expect(client).toBe(mockClient);
      expect(mockPool.connect).toHaveBeenCalled();
    });
  });

  describe('getPool', () => {
    it('should return the connection pool', () => {
      const pool = service.getPool();

      expect(pool).toBe(mockPool);
    });
  });

  describe('error handling', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';

    it('should handle connection errors', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(
        service.query({ tenantId }, 'SELECT * FROM invoices')
      ).rejects.toThrow('Connection failed');
    });

    it('should handle tenant context setup errors', async () => {
      mockClient.query
        .mockRejectedValueOnce(new Error('Invalid tenant ID'))
        .mockResolvedValue({ rows: [] } as any);

      await expect(
        service.query({ tenantId }, 'SELECT * FROM invoices')
      ).rejects.toThrow('Failed to set tenant context');

      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
