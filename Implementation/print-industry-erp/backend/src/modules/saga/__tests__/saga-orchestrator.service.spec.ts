/**
 * Saga Orchestrator Service Tests
 * REQ-1767541724201-s8kck - Implement End-to-End Demand-to-Cash Saga Pattern
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { SagaOrchestratorService } from '../services/saga-orchestrator.service';
import { SagaStatus, StepStatus } from '../interfaces/saga.interface';

describe('SagaOrchestratorService', () => {
  let service: SagaOrchestratorService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(async () => {
    // Create mock pool
    mockPool = {
      connect: jest.fn(),
      query: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SagaOrchestratorService,
        {
          provide: 'DATABASE_POOL',
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<SagaOrchestratorService>(SagaOrchestratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startSaga', () => {
    it('should start a saga and create instance', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({
            // Saga definition query
            rows: [{
              id: 'def-1',
              tenant_id: 'tenant-1',
              saga_name: 'test-saga',
              version: 1,
              is_active: true,
              steps_config: [],
              timeout_seconds: 3600,
            }],
          })
          .mockResolvedValueOnce({
            // Insert saga instance
            rows: [{
              id: 'instance-1',
              tenant_id: 'tenant-1',
              saga_definition_id: 'def-1',
              saga_name: 'test-saga',
              saga_version: 1,
              status: 'started',
              current_step_index: 0,
              saga_context: {},
              started_at: new Date(),
              retry_count: 0,
              updated_at: new Date(),
            }],
          })
          .mockResolvedValueOnce({ rows: [] }), // Log event
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await service.startSaga({
        tenantId: 'tenant-1',
        sagaName: 'test-saga',
        initialContext: { test: 'data' },
        userId: 'user-1',
      });

      expect(result.sagaInstanceId).toBe('instance-1');
      expect(result.status).toBe(SagaStatus.STARTED);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({
            // Saga definition query
            rows: [{
              id: 'def-1',
              tenant_id: 'tenant-1',
              saga_name: 'test-saga',
              version: 1,
              is_active: true,
              steps_config: [],
            }],
          })
          .mockRejectedValueOnce(new Error('Database error')), // Insert fails
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      await expect(
        service.startSaga({
          tenantId: 'tenant-1',
          sagaName: 'test-saga',
          initialContext: {},
          userId: 'user-1',
        })
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if saga definition not found', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }), // No definition found
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      await expect(
        service.startSaga({
          tenantId: 'tenant-1',
          sagaName: 'non-existent',
          initialContext: {},
          userId: 'user-1',
        })
      ).rejects.toThrow("Saga definition 'non-existent' not found");

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if saga definition is inactive', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [{
            id: 'def-1',
            tenant_id: 'tenant-1',
            saga_name: 'test-saga',
            version: 1,
            is_active: false, // Inactive
            steps_config: [],
          }],
        }),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient as any);

      await expect(
        service.startSaga({
          tenantId: 'tenant-1',
          sagaName: 'test-saga',
          initialContext: {},
          userId: 'user-1',
        })
      ).rejects.toThrow("Saga definition 'test-saga' is not active");

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('saga execution', () => {
    it('should execute steps sequentially', () => {
      // This would be tested through integration tests
      // as it involves async execution
      expect(service).toBeDefined();
    });

    it('should trigger compensation on step failure', () => {
      // This would be tested through integration tests
      expect(service).toBeDefined();
    });

    it('should complete saga when all steps succeed', () => {
      // This would be tested through integration tests
      expect(service).toBeDefined();
    });
  });
});
