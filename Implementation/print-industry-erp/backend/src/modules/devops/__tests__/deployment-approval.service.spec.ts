import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentApprovalService } from '../services/deployment-approval.service';
import { DatabaseService } from '../../../database/database.service';
import { DevOpsAlertingService } from '../../wms/services/devops-alerting.service';
import { HealthMonitorService } from '../../monitoring/services/health-monitor.service';

/**
 * DeploymentApprovalService Integration Tests
 *
 * Tests the deployment approval workflow including:
 * - Creating deployments
 * - Submitting for approval
 * - Multi-level approval workflow
 * - Rejection and delegation
 * - Health check integration
 */
describe('DeploymentApprovalService', () => {
  let service: DeploymentApprovalService;
  let mockDb: Partial<DatabaseService>;
  let mockAlerting: Partial<DevOpsAlertingService>;
  let mockHealthMonitor: Partial<HealthMonitorService>;

  beforeEach(async () => {
    // Mock DatabaseService
    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      transaction: jest.fn((callback) => callback(mockDb)),
    };

    // Mock DevOpsAlertingService
    mockAlerting = {
      sendAlert: jest.fn().mockResolvedValue(undefined),
    };

    // Mock HealthMonitorService
    mockHealthMonitor = {
      getSystemHealth: jest.fn().mockResolvedValue({
        overallStatus: 'OPERATIONAL',
        components: {
          database: { status: 'OPERATIONAL' },
          cache: { status: 'OPERATIONAL' },
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentApprovalService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
        {
          provide: DevOpsAlertingService,
          useValue: mockAlerting,
        },
        {
          provide: HealthMonitorService,
          useValue: mockHealthMonitor,
        },
      ],
    }).compile();

    service = module.get<DeploymentApprovalService>(DeploymentApprovalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDeployment', () => {
    it('should create a new deployment request', async () => {
      const mockDeploymentRow = {
        id: 'dep-123',
        tenant_id: 'default',
        deployment_number: 'DEPLOY-000001',
        title: 'Production Hotfix v1.2.3',
        environment: 'PRODUCTION',
        version: '1.2.3',
        deployed_by: 'user123',
        status: 'DRAFT',
        urgency: 'CRITICAL',
        auto_rollback_enabled: true,
        created_at: new Date(),
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ deployment_number: 'DEPLOY-000001' }] })
        .mockResolvedValueOnce({ rows: [mockDeploymentRow] });

      const result = await service.createDeployment({
        tenantId: 'default',
        title: 'Production Hotfix v1.2.3',
        environment: 'PRODUCTION',
        version: '1.2.3',
        deployedBy: 'user123',
        urgency: 'CRITICAL',
      });

      expect(result).toBeDefined();
      expect(result.deploymentNumber).toBe('DEPLOY-000001');
      expect(result.status).toBe('DRAFT');
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('submitForApproval', () => {
    it('should submit deployment for approval and assign first approver', async () => {
      const mockDeployment = {
        id: 'dep-123',
        tenant_id: 'default',
        deployment_number: 'DEPLOY-000001',
        status: 'DRAFT',
        environment: 'PRODUCTION',
        urgency: 'CRITICAL',
        title: 'Production Hotfix',
      };

      const mockWorkflow = {
        id: 'wf-123',
        workflow_name: 'Production Standard Approval',
        default_sla_hours: 24,
      };

      const mockStep = {
        step_number: 1,
        approver_role: 'devops_lead',
        sla_hours: 8,
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockDeployment] }) // Lock deployment
        .mockResolvedValueOnce({ rows: [mockWorkflow] }) // Get workflow
        .mockResolvedValueOnce({ rows: [mockStep] }) // Get first step
        .mockResolvedValueOnce({ rows: [] }) // Update deployment
        .mockResolvedValueOnce({ rows: [] }) // Create history
        .mockResolvedValueOnce({ rows: [{ ...mockDeployment, status: 'PENDING_APPROVAL' }] }); // Get updated

      const result = await service.submitForApproval('dep-123', 'user123', 'default');

      expect(result).toBeDefined();
      expect(mockAlerting.sendAlert).toHaveBeenCalled();
    });
  });

  describe('approveDeployment', () => {
    it('should approve deployment and move to next step', async () => {
      const mockDeployment = {
        id: 'dep-123',
        tenant_id: 'default',
        deployment_number: 'DEPLOY-000001',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user123',
        current_approval_step: 1,
        current_approval_workflow_id: 'wf-123',
        environment: 'PRODUCTION',
        urgency: 'CRITICAL',
        title: 'Production Hotfix',
      };

      const mockWorkflow = {
        id: 'wf-123',
        default_sla_hours: 24,
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockDeployment] }) // Lock deployment
        .mockResolvedValueOnce({ rows: [mockWorkflow] }) // Get workflow
        .mockResolvedValueOnce({ rows: [{ total: '3' }] }) // Get total steps
        .mockResolvedValueOnce({ rows: [{ step_number: 2, approver_role: 'eng_manager', sla_hours: 8 }] }) // Next step
        .mockResolvedValueOnce({ rows: [] }) // Update deployment
        .mockResolvedValueOnce({ rows: [] }) // Create history
        .mockResolvedValueOnce({ rows: [{ ...mockDeployment, current_approval_step: 2 }] }); // Get updated

      const result = await service.approveDeployment('dep-123', 'user123', 'default');

      expect(result).toBeDefined();
      expect(mockAlerting.sendAlert).toHaveBeenCalled();
    });

    it('should mark deployment as APPROVED on final approval', async () => {
      const mockDeployment = {
        id: 'dep-123',
        tenant_id: 'default',
        deployment_number: 'DEPLOY-000001',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user123',
        current_approval_step: 3,
        current_approval_workflow_id: 'wf-123',
        environment: 'PRODUCTION',
        urgency: 'CRITICAL',
        title: 'Production Hotfix',
      };

      const mockWorkflow = {
        id: 'wf-123',
        default_sla_hours: 24,
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockDeployment] }) // Lock deployment
        .mockResolvedValueOnce({ rows: [mockWorkflow] }) // Get workflow
        .mockResolvedValueOnce({ rows: [{ total: '3' }] }) // Get total steps
        .mockResolvedValueOnce({ rows: [] }) // Update to APPROVED
        .mockResolvedValueOnce({ rows: [] }) // Create history
        .mockResolvedValueOnce({ rows: [{ ...mockDeployment, status: 'APPROVED' }] }); // Get updated

      const result = await service.approveDeployment('dep-123', 'user123', 'default');

      expect(result).toBeDefined();
      expect(mockAlerting.sendAlert).toHaveBeenCalled();
    });
  });

  describe('rejectDeployment', () => {
    it('should reject deployment and create history entry', async () => {
      const mockDeployment = {
        id: 'dep-123',
        tenant_id: 'default',
        deployment_number: 'DEPLOY-000001',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user123',
        current_approval_step: 1,
        environment: 'PRODUCTION',
        title: 'Production Hotfix',
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockDeployment] }) // Lock deployment
        .mockResolvedValueOnce({ rows: [] }) // Update to REJECTED
        .mockResolvedValueOnce({ rows: [] }) // Create history
        .mockResolvedValueOnce({ rows: [{ ...mockDeployment, status: 'REJECTED' }] }); // Get updated

      const result = await service.rejectDeployment(
        'dep-123',
        'user123',
        'default',
        'Security vulnerability found'
      );

      expect(result).toBeDefined();
      expect(mockAlerting.sendAlert).toHaveBeenCalled();
    });
  });

  describe('delegateApproval', () => {
    it('should delegate approval to another user', async () => {
      const mockDeployment = {
        id: 'dep-123',
        tenant_id: 'default',
        deployment_number: 'DEPLOY-000001',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user123',
        current_approval_step: 1,
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockDeployment] }) // Lock deployment
        .mockResolvedValueOnce({ rows: [] }) // Update approver
        .mockResolvedValueOnce({ rows: [] }) // Create history
        .mockResolvedValueOnce({ rows: [{ ...mockDeployment, pending_approver_id: 'user456' }] }); // Get updated

      const result = await service.delegateApproval(
        'dep-123',
        'user123',
        'user456',
        'default',
        'Out of office'
      );

      expect(result).toBeDefined();
      expect(mockAlerting.sendAlert).toHaveBeenCalled();
    });
  });

  describe('runHealthCheck', () => {
    it('should run health check and record PASSED status', async () => {
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Update deployment
        .mockResolvedValueOnce({ rows: [] }); // Create history

      const result = await service.runHealthCheck('dep-123', 'default', 'PRE_DEPLOYMENT');

      expect(result).toBeDefined();
      expect(result.status).toBe('PASSED');
      expect(mockHealthMonitor.getSystemHealth).toHaveBeenCalled();
    });

    it('should detect FAILED health check and send alert', async () => {
      (mockHealthMonitor.getSystemHealth as jest.Mock).mockResolvedValue({
        overallStatus: 'DEGRADED',
        components: {
          database: { status: 'OPERATIONAL' },
          cache: { status: 'DEGRADED' },
        },
      });

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Update deployment
        .mockResolvedValueOnce({ rows: [] }); // Create history

      const result = await service.runHealthCheck('dep-123', 'default', 'PRE_DEPLOYMENT');

      expect(result.status).toBe('FAILED');
      expect(mockAlerting.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'CRITICAL',
          source: 'deployment-health-check',
        })
      );
    });
  });

  describe('getMyPendingApprovals', () => {
    it('should return pending approvals for user', async () => {
      const mockApprovals = [
        {
          deployment_id: 'dep-123',
          deployment_number: 'DEPLOY-000001',
          tenant_id: 'default',
          title: 'Production Hotfix',
          environment: 'PRODUCTION',
          urgency: 'CRITICAL',
          urgency_level: 'URGENT',
          is_overdue: true,
        },
      ];

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: mockApprovals });

      const result = await service.getMyPendingApprovals('default', 'user123', {
        environment: 'PRODUCTION',
      });

      expect(result).toHaveLength(1);
      expect(result[0].urgency).toBe('CRITICAL');
    });
  });

  describe('getApprovalStats', () => {
    it('should return approval statistics', async () => {
      const mockStats = {
        total_pending: 5,
        critical_pending: 2,
        overdue_count: 1,
        warning_count: 2,
        production_pending: 3,
        staging_pending: 2,
        approved_last_24h: 10,
        rejected_last_24h: 1,
        deployed_last_24h: 8,
      };

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [mockStats] });

      const result = await service.getApprovalStats('default');

      expect(result.total_pending).toBe(5);
      expect(result.critical_pending).toBe(2);
    });
  });
});
