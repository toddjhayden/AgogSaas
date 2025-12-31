import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentApprovalService } from '../services/deployment-approval.service';
import { DatabaseService } from '../../../database/database.service';
import { DevOpsAlertingService } from '../../wms/services/devops-alerting.service';
import { HealthMonitorService } from '../../monitoring/services/health-monitor.service';

/**
 * Deployment Approval QA Test Suite
 *
 * Comprehensive QA tests covering:
 * 1. Multi-tenant isolation (CRITICAL)
 * 2. Authorization and permissions
 * 3. SLA tracking and urgency calculations
 * 4. Workflow state management
 * 5. Health check integration
 * 6. Audit trail completeness
 * 7. Data integrity
 *
 * QA Engineer: Billy
 * REQ: REQ-DEVOPS-DEPLOY-APPROVAL-1767150339448
 */
describe('Deployment Approval Workflow - QA Test Suite', () => {
  let service: DeploymentApprovalService;
  let mockDb: Partial<DatabaseService>;
  let mockAlerting: Partial<DevOpsAlertingService>;
  let mockHealthMonitor: Partial<HealthMonitorService>;

  beforeEach(async () => {
    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      transaction: jest.fn((callback) => callback(mockDb)),
    };

    mockAlerting = {
      sendAlert: jest.fn().mockResolvedValue(undefined),
    };

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

  // ============================================================================
  // CRITICAL: MULTI-TENANT ISOLATION TESTS
  // ============================================================================
  describe('QA-MT-001: Multi-Tenant Isolation', () => {
    it('should prevent tenant A from accessing tenant B deployments', async () => {
      const tenantADeployments = [
        {
          deployment_id: 'dep-tenant-a-1',
          tenant_id: 'tenant-a',
          deployment_number: 'DEPLOY-000001',
          title: 'Tenant A Deployment',
          pending_approver_id: 'user-a',
        },
      ];

      const tenantBDeployments = [
        {
          deployment_id: 'dep-tenant-b-1',
          tenant_id: 'tenant-b',
          deployment_number: 'DEPLOY-000001',
          title: 'Tenant B Deployment',
          pending_approver_id: 'user-b',
        },
      ];

      // Test 1: User from tenant A queries their pending approvals
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: tenantADeployments });
      const resultA = await service.getMyPendingApprovals('tenant-a', 'user-a');
      expect(resultA).toHaveLength(1);
      expect(resultA[0].tenantId).toBe('tenant-a');

      // Test 2: User from tenant B queries their pending approvals
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: tenantBDeployments });
      const resultB = await service.getMyPendingApprovals('tenant-b', 'user-b');
      expect(resultB).toHaveLength(1);
      expect(resultB[0].tenantId).toBe('tenant-b');

      // Test 3: Verify queries include tenant_id filter
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        expect.arrayContaining(['tenant-a', 'user-a'])
      );
    });

    it('should prevent cross-tenant deployment approval', async () => {
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user-a',
        current_approval_step: 1,
        current_approval_workflow_id: 'wf-123',
      };

      // User from tenant B tries to approve tenant A's deployment
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // No deployment found

      await expect(
        service.approveDeployment('dep-123', 'user-b', 'tenant-b')
      ).rejects.toThrow('Deployment not found');

      // Verify query includes tenant_id filter
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $2'),
        ['dep-123', 'tenant-b']
      );
    });

    it('should prevent cross-tenant deployment history access', async () => {
      const historyTenantA = [
        {
          id: 'hist-1',
          deployment_id: 'dep-123',
          tenant_id: 'tenant-a',
          action: 'APPROVED',
        },
      ];

      // Tenant B tries to access tenant A's deployment history
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      const result = await service.getApprovalHistory('dep-123', 'tenant-b');
      expect(result).toHaveLength(0);

      // Verify query includes tenant_id filter
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $2'),
        ['dep-123', 'tenant-b']
      );
    });
  });

  // ============================================================================
  // AUTHORIZATION AND PERMISSIONS TESTS
  // ============================================================================
  describe('QA-AUTH-001: Authorization Validation', () => {
    it('should reject approval from unauthorized user', async () => {
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user-correct',
        current_approval_step: 1,
        current_approval_workflow_id: 'wf-123',
      };

      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [deployment] });

      await expect(
        service.approveDeployment('dep-123', 'user-wrong', 'tenant-a')
      ).rejects.toThrow('User is not authorized to approve this step');
    });

    it('should reject delegation from unauthorized user', async () => {
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user-correct',
        current_approval_step: 1,
      };

      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [deployment] });

      await expect(
        service.delegateApproval('dep-123', 'user-wrong', 'user-new', 'tenant-a')
      ).rejects.toThrow('User is not authorized to delegate this approval');
    });

    it('should only allow current approver to reject deployment', async () => {
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user-correct',
        current_approval_step: 1,
      };

      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [deployment] });

      await expect(
        service.rejectDeployment('dep-123', 'user-wrong', 'tenant-a', 'Security issue')
      ).rejects.toThrow('User is not authorized to reject this deployment');
    });
  });

  // ============================================================================
  // WORKFLOW STATE MANAGEMENT TESTS
  // ============================================================================
  describe('QA-WF-001: Workflow State Transitions', () => {
    it('should only allow submission from DRAFT or REJECTED status', async () => {
      const deploymentPending = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'PENDING_APPROVAL',
        environment: 'PRODUCTION',
        urgency: 'MEDIUM',
      };

      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [deploymentPending] });

      await expect(
        service.submitForApproval('dep-123', 'user123', 'tenant-a')
      ).rejects.toThrow('Cannot submit deployment with status PENDING_APPROVAL');
    });

    it('should only allow approval from PENDING_APPROVAL status', async () => {
      const deploymentDraft = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'DRAFT',
        pending_approver_id: 'user123',
        current_approval_step: 1,
      };

      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [deploymentDraft] });

      await expect(
        service.approveDeployment('dep-123', 'user123', 'tenant-a')
      ).rejects.toThrow('Deployment is not pending approval');
    });

    it('should track multi-level approval workflow correctly', async () => {
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user-step1',
        current_approval_step: 1,
        current_approval_workflow_id: 'wf-123',
        environment: 'PRODUCTION',
        urgency: 'MEDIUM',
        title: 'Test Deployment',
      };

      const workflow = { id: 'wf-123', default_sla_hours: 24 };

      // Step 1 approval
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [deployment] }) // Lock
        .mockResolvedValueOnce({ rows: [workflow] }) // Get workflow
        .mockResolvedValueOnce({ rows: [{ total: '3' }] }) // Total steps
        .mockResolvedValueOnce({
          rows: [{ step_number: 2, approver_role: 'eng_manager', sla_hours: 8 }],
        }) // Next step
        .mockResolvedValueOnce({ rows: [] }) // Update
        .mockResolvedValueOnce({ rows: [] }) // History
        .mockResolvedValueOnce({ rows: [{ ...deployment, current_approval_step: 2 }] }); // Get updated

      const result = await service.approveDeployment('dep-123', 'user-step1', 'tenant-a');

      expect(result.currentApprovalStep).toBe(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('current_approval_step = $1'),
        expect.anything()
      );
    });
  });

  // ============================================================================
  // SLA TRACKING AND URGENCY TESTS
  // ============================================================================
  describe('QA-SLA-001: SLA Tracking and Urgency Calculations', () => {
    it('should calculate SLA deadline correctly based on workflow step', async () => {
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'DRAFT',
        environment: 'PRODUCTION',
        urgency: 'CRITICAL',
      };

      const workflow = {
        id: 'wf-123',
        default_sla_hours: 24,
      };

      const step = {
        step_number: 1,
        approver_role: 'devops_lead',
        sla_hours: 8,
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [deployment] })
        .mockResolvedValueOnce({ rows: [workflow] })
        .mockResolvedValueOnce({ rows: [step] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...deployment, status: 'PENDING_APPROVAL' }] });

      await service.submitForApproval('dep-123', 'user123', 'tenant-a');

      // Verify SLA deadline is set (8 hours from now)
      const updateCall = (mockDb.query as jest.Mock).mock.calls.find((call) =>
        call[0].includes('sla_deadline = $3')
      );
      expect(updateCall).toBeDefined();
      const slaDeadline = new Date(updateCall[1][2]);
      const expectedDeadline = new Date();
      expectedDeadline.setHours(expectedDeadline.getHours() + 8);

      // Allow 1 minute tolerance
      expect(Math.abs(slaDeadline.getTime() - expectedDeadline.getTime())).toBeLessThan(60000);
    });

    it('should filter pending approvals by urgency level', async () => {
      const approvals = [
        {
          deployment_id: 'dep-1',
          tenant_id: 'tenant-a',
          urgency: 'CRITICAL',
          urgency_level: 'URGENT',
          is_overdue: true,
        },
        {
          deployment_id: 'dep-2',
          tenant_id: 'tenant-a',
          urgency: 'HIGH',
          urgency_level: 'WARNING',
          is_overdue: false,
        },
      ];

      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [approvals[0]] });

      const result = await service.getMyPendingApprovals('tenant-a', 'user123', {
        urgencyLevel: 'URGENT',
      });

      expect(result).toHaveLength(1);
      expect(result[0].urgencyLevel).toBe('URGENT');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('urgency_level = $3'),
        expect.arrayContaining(['tenant-a', 'user123', 'URGENT'])
      );
    });
  });

  // ============================================================================
  // HEALTH CHECK INTEGRATION TESTS
  // ============================================================================
  describe('QA-HC-001: Health Check Integration', () => {
    it('should record PASSED health check status', async () => {
      (mockHealthMonitor.getSystemHealth as jest.Mock).mockResolvedValue({
        overallStatus: 'OPERATIONAL',
        components: {
          database: { status: 'OPERATIONAL' },
          cache: { status: 'OPERATIONAL' },
          api: { status: 'OPERATIONAL' },
        },
      });

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.runHealthCheck('dep-123', 'tenant-a', 'PRE_DEPLOYMENT');

      expect(result.status).toBe('PASSED');
      expect(result.checkType).toBe('PRE_DEPLOYMENT');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('pre_deployment_health_check = $1'),
        ['PASSED', 'dep-123']
      );
    });

    it('should record FAILED health check and send critical alert', async () => {
      (mockHealthMonitor.getSystemHealth as jest.Mock).mockResolvedValue({
        overallStatus: 'CRITICAL',
        components: {
          database: { status: 'OPERATIONAL' },
          cache: { status: 'DEGRADED' },
          api: { status: 'OUTAGE' },
        },
      });

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.runHealthCheck('dep-123', 'tenant-a', 'POST_DEPLOYMENT');

      expect(result.status).toBe('FAILED');
      expect(mockAlerting.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'CRITICAL',
          source: 'deployment-health-check',
          message: expect.stringContaining('FAILED'),
        })
      );
    });
  });

  // ============================================================================
  // AUDIT TRAIL COMPLETENESS TESTS
  // ============================================================================
  describe('QA-AUDIT-001: Audit Trail Completeness', () => {
    it('should create audit entry on deployment submission', async () => {
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'DRAFT',
        environment: 'PRODUCTION',
        urgency: 'MEDIUM',
        deployment_number: 'DEPLOY-000001',
      };

      const workflow = { id: 'wf-123', default_sla_hours: 24 };
      const step = { step_number: 1, approver_role: 'devops', sla_hours: 8 };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [deployment] })
        .mockResolvedValueOnce({ rows: [workflow] })
        .mockResolvedValueOnce({ rows: [step] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // CREATE HISTORY
        .mockResolvedValueOnce({ rows: [deployment] });

      await service.submitForApproval('dep-123', 'user123', 'tenant-a');

      const historyCall = (mockDb.query as jest.Mock).mock.calls.find((call) =>
        call[0].includes('INSERT INTO deployment_approval_history')
      );

      expect(historyCall).toBeDefined();
      expect(historyCall[1]).toEqual(
        expect.arrayContaining(['dep-123', 'tenant-a', 'SUBMITTED', 'user123', 1])
      );
    });

    it('should create audit entry on approval', async () => {
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user123',
        current_approval_step: 3,
        current_approval_workflow_id: 'wf-123',
      };

      const workflow = { id: 'wf-123', default_sla_hours: 24 };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [deployment] })
        .mockResolvedValueOnce({ rows: [workflow] })
        .mockResolvedValueOnce({ rows: [{ total: '3' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // CREATE HISTORY
        .mockResolvedValueOnce({ rows: [{ ...deployment, status: 'APPROVED' }] });

      await service.approveDeployment('dep-123', 'user123', 'tenant-a', 'Looks good');

      const historyCall = (mockDb.query as jest.Mock).mock.calls.find((call) =>
        call[0].includes('INSERT INTO deployment_approval_history')
      );

      expect(historyCall).toBeDefined();
      expect(historyCall[1]).toEqual(
        expect.arrayContaining(['dep-123', 'tenant-a', 'APPROVED', 'user123', 3, 'Looks good'])
      );
    });

    it('should create audit entry on delegation', async () => {
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user123',
        current_approval_step: 1,
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [deployment] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // CREATE HISTORY with delegation
        .mockResolvedValueOnce({ rows: [{ ...deployment, pending_approver_id: 'user456' }] });

      await service.delegateApproval('dep-123', 'user123', 'user456', 'tenant-a', 'Out of office');

      const historyCall = (mockDb.query as jest.Mock).mock.calls.find((call) =>
        call[0].includes('delegated_to_user_id')
      );

      expect(historyCall).toBeDefined();
      expect(historyCall[1]).toEqual(
        expect.arrayContaining([
          'dep-123',
          'tenant-a',
          'DELEGATED',
          'user123',
          1,
          'user456',
          'Out of office',
        ])
      );
    });
  });

  // ============================================================================
  // DATA INTEGRITY TESTS
  // ============================================================================
  describe('QA-DATA-001: Data Integrity', () => {
    it('should validate deployment status is valid enum value', async () => {
      // This test ensures only valid status values are accepted
      const validStatuses = [
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'IN_PROGRESS',
        'DEPLOYED',
        'FAILED',
        'ROLLED_BACK',
        'CANCELLED',
      ];

      // Service methods should only produce valid status values
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'PENDING_APPROVAL',
        pending_approver_id: 'user123',
        current_approval_step: 1,
        current_approval_workflow_id: 'wf-123',
      };

      const workflow = { id: 'wf-123', default_sla_hours: 24 };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [deployment] })
        .mockResolvedValueOnce({ rows: [workflow] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...deployment, status: 'APPROVED' }] });

      const result = await service.approveDeployment('dep-123', 'user123', 'tenant-a');

      expect(validStatuses).toContain(result.status);
    });

    it('should maintain referential integrity for workflow relationships', async () => {
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'DRAFT',
        environment: 'PRODUCTION',
        urgency: 'MEDIUM',
      };

      // Workflow not found scenario
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [deployment] })
        .mockResolvedValueOnce({ rows: [] }); // No workflow found

      await expect(service.submitForApproval('dep-123', 'user123', 'tenant-a')).rejects.toThrow(
        'No active workflow found'
      );
    });

    it('should prevent approval without workflow steps configured', async () => {
      const deployment = {
        id: 'dep-123',
        tenant_id: 'tenant-a',
        status: 'DRAFT',
        environment: 'PRODUCTION',
        urgency: 'MEDIUM',
      };

      const workflow = { id: 'wf-123', default_sla_hours: 24 };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [deployment] })
        .mockResolvedValueOnce({ rows: [workflow] })
        .mockResolvedValueOnce({ rows: [] }); // No steps configured

      await expect(service.submitForApproval('dep-123', 'user123', 'tenant-a')).rejects.toThrow(
        'Workflow has no approval steps configured'
      );
    });
  });

  // ============================================================================
  // DEPLOYMENT STATISTICS TESTS
  // ============================================================================
  describe('QA-STATS-001: Deployment Statistics', () => {
    it('should return accurate approval statistics', async () => {
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

      const result = await service.getApprovalStats('tenant-a');

      expect(result).toMatchObject(mockStats);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('get_deployment_approval_stats'),
        ['tenant-a']
      );
    });
  });
});
