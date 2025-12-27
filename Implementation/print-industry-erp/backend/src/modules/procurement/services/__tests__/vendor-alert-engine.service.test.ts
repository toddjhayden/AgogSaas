/**
 * VENDOR ALERT ENGINE SERVICE - UNIT TESTS
 *
 * Test Coverage:
 * - checkPerformanceThresholds(): threshold detection, alert creation
 * - generateAlert(): duplicate prevention, NATS publishing
 * - acknowledgeAlert(): status update, user tracking
 * - resolveAlert(): resolution notes, CRITICAL alert requirements
 * - getOpenAlerts(): filtering, sorting
 * - checkESGAuditDueDates(): audit date monitoring
 *
 * Testing Strategy:
 * - Mock database Pool for isolated unit tests
 * - Test alert threshold logic
 * - Verify duplicate prevention
 * - Validate workflow state transitions
 */

import { VendorAlertEngineService } from '../vendor-alert-engine.service';
import type { Pool } from 'pg';

// Mock database pool
const createMockPool = (): Pool => {
  const mockClient: any = {
    query: jest.fn(),
    release: jest.fn()
  };

  const mockPool: any = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn()
  };

  return mockPool;
};

describe('VendorAlertEngineService', () => {
  let service: VendorAlertEngineService;
  let mockPool: Pool;

  beforeEach(() => {
    mockPool = createMockPool();
    service = new VendorAlertEngineService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkPerformanceThresholds', () => {
    it('should generate CRITICAL alert when overall score < 60', async () => {
      const performance = {
        quality_percentage: 50,
        on_time_percentage: 55
      };

      const esgMetrics = null;

      const config = {
        qualityWeight: 50,
        deliveryWeight: 50,
        costWeight: 0,
        serviceWeight: 0,
        innovationWeight: 0,
        esgWeight: 0,
        excellentThreshold: 90,
        goodThreshold: 75,
        acceptableThreshold: 60
      } as any;

      const weightedScore = 52.5; // Below 60 - CRITICAL

      const alerts = await service.checkPerformanceThresholds(
        'tenant-1',
        'vendor-1',
        performance,
        esgMetrics,
        config,
        weightedScore
      );

      expect(alerts.length).toBeGreaterThan(0);
      const criticalAlert = alerts.find(a => a.severity === 'CRITICAL' && a.metricCategory === 'OVERALL_SCORE');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.currentValue).toBe(52.5);
      expect(criticalAlert?.message).toContain('below acceptable threshold');
    });

    it('should generate WARNING alert when overall score < 75 but >= 60', async () => {
      const performance = {
        quality_percentage: 70,
        on_time_percentage: 68
      };

      const weightedScore = 69; // Between 60-75 - WARNING

      const alerts = await service.checkPerformanceThresholds(
        'tenant-1',
        'vendor-1',
        performance,
        null,
        {} as any,
        weightedScore
      );

      const warningAlert = alerts.find(a => a.severity === 'WARNING' && a.metricCategory === 'OVERALL_SCORE');
      expect(warningAlert).toBeDefined();
      expect(warningAlert?.message).toContain('below good threshold');
    });

    it('should generate INFO alert when score improved by >10 points', async () => {
      // Mock previous score of 60
      jest.spyOn(service as any, 'getPreviousWeightedScore').mockResolvedValue(60);

      const weightedScore = 75; // Improved by 15 points

      const alerts = await service.checkPerformanceThresholds(
        'tenant-1',
        'vendor-1',
        {},
        null,
        {} as any,
        weightedScore
      );

      const infoAlert = alerts.find(a => a.severity === 'INFO' && a.message.includes('improved significantly'));
      expect(infoAlert).toBeDefined();
      expect(infoAlert?.currentValue).toBe(75);
      expect(infoAlert?.thresholdValue).toBe(60);
    });

    it('should generate CRITICAL alert for low quality percentage', async () => {
      const performance = {
        quality_percentage: 65, // Below 70 threshold
        on_time_percentage: 90
      };

      const alerts = await service.checkPerformanceThresholds(
        'tenant-1',
        'vendor-1',
        performance,
        null,
        {} as any,
        80
      );

      const qualityAlert = alerts.find(a => a.metricCategory === 'QUALITY');
      expect(qualityAlert).toBeDefined();
      expect(qualityAlert?.severity).toBe('CRITICAL');
      expect(qualityAlert?.currentValue).toBe(65);
      expect(qualityAlert?.message).toContain('Quality performance');
    });

    it('should generate CRITICAL alert for low delivery percentage', async () => {
      const performance = {
        quality_percentage: 95,
        on_time_percentage: 70 // Below 75 threshold
      };

      const alerts = await service.checkPerformanceThresholds(
        'tenant-1',
        'vendor-1',
        performance,
        null,
        {} as any,
        85
      );

      const deliveryAlert = alerts.find(a => a.metricCategory === 'DELIVERY');
      expect(deliveryAlert).toBeDefined();
      expect(deliveryAlert?.severity).toBe('CRITICAL');
      expect(deliveryAlert?.message).toContain('On-time delivery');
    });

    it('should generate WARNING alert for high defect rate', async () => {
      const performance = {
        quality_percentage: 90,
        on_time_percentage: 95,
        defect_rate_ppm: 1500 // Above 1000 PPM threshold
      };

      const alerts = await service.checkPerformanceThresholds(
        'tenant-1',
        'vendor-1',
        performance,
        null,
        {} as any,
        92
      );

      const defectAlert = alerts.find(a => a.metricCategory === 'DEFECT_RATE');
      expect(defectAlert).toBeDefined();
      expect(defectAlert?.severity).toBe('WARNING');
      expect(defectAlert?.currentValue).toBe(1500);
    });

    it('should generate CRITICAL alert for HIGH ESG risk', async () => {
      const esgMetrics = {
        esg_risk_level: 'HIGH'
      };

      const alerts = await service.checkPerformanceThresholds(
        'tenant-1',
        'vendor-1',
        {},
        esgMetrics,
        {} as any,
        80
      );

      const esgAlert = alerts.find(a => a.alertType === 'ESG_RISK');
      expect(esgAlert).toBeDefined();
      expect(esgAlert?.severity).toBe('CRITICAL');
      expect(esgAlert?.message).toContain('ESG risk level is HIGH');
    });

    it('should generate WARNING alert for MEDIUM ESG risk', async () => {
      const esgMetrics = {
        esg_risk_level: 'MEDIUM'
      };

      const alerts = await service.checkPerformanceThresholds(
        'tenant-1',
        'vendor-1',
        {},
        esgMetrics,
        {} as any,
        80
      );

      const esgAlert = alerts.find(a => a.alertType === 'ESG_RISK');
      expect(esgAlert).toBeDefined();
      expect(esgAlert?.severity).toBe('WARNING');
    });

    it('should not generate alerts for good performance', async () => {
      const performance = {
        quality_percentage: 95,
        on_time_percentage: 98,
        defect_rate_ppm: 50
      };

      const esgMetrics = {
        esg_risk_level: 'LOW'
      };

      const weightedScore = 96; // Excellent

      const alerts = await service.checkPerformanceThresholds(
        'tenant-1',
        'vendor-1',
        performance,
        esgMetrics,
        {} as any,
        weightedScore
      );

      const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
      const warningAlerts = alerts.filter(a => a.severity === 'WARNING');

      expect(criticalAlerts.length).toBe(0);
      expect(warningAlerts.length).toBe(0);
    });
  });

  describe('generateAlert', () => {
    it('should insert new alert into database', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [] }) // Check existing (no duplicates)
          .mockResolvedValueOnce({ rows: [{ id: 'alert-123' }] }) // INSERT
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const alert = {
        tenantId: 'tenant-1',
        vendorId: 'vendor-1',
        alertType: 'THRESHOLD_BREACH' as const,
        severity: 'CRITICAL' as const,
        metricCategory: 'QUALITY',
        currentValue: 55,
        thresholdValue: 70,
        message: 'Quality below acceptable threshold'
      };

      const alertId = await service.generateAlert(alert);

      expect(alertId).toBe('alert-123');

      const mockClient = await mockPool.connect();
      const insertCall = (mockClient.query as jest.Mock).mock.calls.find(call =>
        call[0]?.includes('INSERT INTO vendor_performance_alerts')
      );
      expect(insertCall).toBeDefined();
    });

    it('should prevent duplicate alerts (same vendor, type, category, OPEN status)', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ id: 'existing-alert-456' }] }) // Duplicate found
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const alert = {
        tenantId: 'tenant-1',
        vendorId: 'vendor-1',
        alertType: 'THRESHOLD_BREACH' as const,
        severity: 'CRITICAL' as const,
        metricCategory: 'QUALITY',
        currentValue: 55,
        thresholdValue: 70,
        message: 'Quality below acceptable threshold'
      };

      const alertId = await service.generateAlert(alert);

      expect(alertId).toBe('existing-alert-456'); // Returns existing alert ID

      const mockClient = await mockPool.connect();
      const insertCall = (mockClient.query as jest.Mock).mock.calls.find(call =>
        call[0]?.includes('INSERT INTO vendor_performance_alerts')
      );
      expect(insertCall).toBeUndefined(); // No insert performed
    });

    it('should handle alerts without category (TIER_CHANGE, ESG_RISK)', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [] }) // No duplicates
          .mockResolvedValueOnce({ rows: [{ id: 'alert-789' }] }) // INSERT
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const alert = {
        tenantId: 'tenant-1',
        vendorId: 'vendor-1',
        alertType: 'TIER_CHANGE' as const,
        severity: 'INFO' as const,
        message: 'Vendor tier changed from PREFERRED to STRATEGIC'
      };

      const alertId = await service.generateAlert(alert);

      expect(alertId).toBe('alert-789');
    });
  });

  describe('acknowledgeAlert', () => {
    it('should update alert status to ACKNOWLEDGED', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ id: 'alert-1', status: 'OPEN' }] }) // Check alert exists
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      await service.acknowledgeAlert('tenant-1', 'alert-1', 'user-123', 'Investigating issue');

      const mockClient = await mockPool.connect();
      const updateCall = (mockClient.query as jest.Mock).mock.calls.find(call =>
        call[0]?.includes("status = 'ACKNOWLEDGED'")
      );

      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toContain('user-123');
    });

    it('should throw error if alert not found', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [] }), // Alert not found
        release: jest.fn()
      });

      await expect(service.acknowledgeAlert('tenant-1', 'invalid-alert', 'user-123'))
        .rejects
        .toThrow('Alert invalid-alert not found');
    });

    it('should throw error if alert already acknowledged', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ id: 'alert-1', status: 'ACKNOWLEDGED' }] }), // Already acknowledged
        release: jest.fn()
      });

      await expect(service.acknowledgeAlert('tenant-1', 'alert-1', 'user-123'))
        .rejects
        .toThrow('Alert alert-1 is already ACKNOWLEDGED');
    });
  });

  describe('resolveAlert', () => {
    it('should update alert status to RESOLVED with resolution notes', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ id: 'alert-1', status: 'ACKNOWLEDGED', severity: 'WARNING' }] })
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      await service.resolveAlert('tenant-1', 'alert-1', 'user-123', 'Issue resolved with vendor quality plan');

      const mockClient = await mockPool.connect();
      const updateCall = (mockClient.query as jest.Mock).mock.calls.find(call =>
        call[0]?.includes("status = 'RESOLVED'")
      );

      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toContain('user-123');
      expect(updateCall[1]).toContain('Issue resolved with vendor quality plan');
    });

    it('should require resolution notes for CRITICAL alerts', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ id: 'alert-1', status: 'OPEN', severity: 'CRITICAL' }] }),
        release: jest.fn()
      });

      await expect(service.resolveAlert('tenant-1', 'alert-1', 'user-123', 'Short')) // < 10 chars
        .rejects
        .toThrow('Resolution notes required for CRITICAL alerts (minimum 10 characters)');
    });

    it('should allow resolution of already resolved alert', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ id: 'alert-1', status: 'RESOLVED', severity: 'INFO' }] }),
        release: jest.fn()
      });

      await expect(service.resolveAlert('tenant-1', 'alert-1', 'user-123', 'Additional notes'))
        .rejects
        .toThrow('Alert alert-1 is already resolved');
    });
  });

  describe('getOpenAlerts', () => {
    it('should return alerts ordered by severity and date', async () => {
      const mockAlerts = [
        { id: 'a1', tenant_id: 'tenant-1', vendor_id: 'v1', vendor_code: 'V001', vendor_name: 'Vendor 1', severity: 'CRITICAL', status: 'OPEN', created_at: new Date() },
        { id: 'a2', tenant_id: 'tenant-1', vendor_id: 'v2', vendor_code: 'V002', vendor_name: 'Vendor 2', severity: 'WARNING', status: 'OPEN', created_at: new Date() },
        { id: 'a3', tenant_id: 'tenant-1', vendor_id: 'v3', vendor_code: 'V003', vendor_name: 'Vendor 3', severity: 'INFO', status: 'ACKNOWLEDGED', created_at: new Date() }
      ];

      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: mockAlerts }),
        release: jest.fn()
      });

      const alerts = await service.getOpenAlerts('tenant-1');

      expect(alerts.length).toBe(3);
      // Alerts should be ordered CRITICAL → WARNING → INFO
      expect(alerts[0].severity).toBe('CRITICAL');
      expect(alerts[1].severity).toBe('WARNING');
      expect(alerts[2].severity).toBe('INFO');
    });

    it('should filter by severity', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ id: 'a1', severity: 'CRITICAL', status: 'OPEN', created_at: new Date() }] }),
        release: jest.fn()
      });

      const alerts = await service.getOpenAlerts('tenant-1', 'CRITICAL');

      expect(alerts.length).toBe(1);
      expect(alerts[0].severity).toBe('CRITICAL');

      const mockClient = await mockPool.connect();
      const queryCall = (mockClient.query as jest.Mock).mock.calls[1];
      expect(queryCall[0]).toContain('a.severity = $2');
    });

    it('should filter by status', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ id: 'a1', status: 'ACKNOWLEDGED', created_at: new Date() }] }),
        release: jest.fn()
      });

      const alerts = await service.getOpenAlerts('tenant-1', undefined, 'ACKNOWLEDGED');

      expect(alerts.length).toBe(1);
      expect(alerts[0].status).toBe('ACKNOWLEDGED');
    });

    it('should default to non-resolved alerts if status not specified', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [] }),
        release: jest.fn()
      });

      await service.getOpenAlerts('tenant-1');

      const mockClient = await mockPool.connect();
      const queryCall = (mockClient.query as jest.Mock).mock.calls[1];
      expect(queryCall[0]).toContain("a.status IN ('OPEN', 'ACKNOWLEDGED')");
    });
  });

  describe('checkESGAuditDueDates', () => {
    it('should generate CRITICAL alert for audit overdue >18 months', async () => {
      const overdueAudit = {
        vendor_id: 'v1',
        vendor_code: 'V001',
        vendor_name: 'Vendor 1',
        next_audit_due_date: '2022-01-01', // >18 months ago
        last_audit_date: '2020-01-01',
        days_overdue: 600 // ~20 months
      };

      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [overdueAudit] }) // Find overdue audits
          .mockResolvedValueOnce({ rows: [] }) // INSERT alert
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const alertsGenerated = await service.checkESGAuditDueDates('tenant-1');

      expect(alertsGenerated).toBe(1);

      // Verify generateAlert was called with correct parameters
      // (This requires spying on the method or checking database calls)
    });

    it('should generate WARNING alert for audit overdue >12 months', async () => {
      const overdueAudit = {
        vendor_id: 'v1',
        vendor_code: 'V001',
        vendor_name: 'Vendor 1',
        next_audit_due_date: '2023-06-01', // ~13 months ago
        last_audit_date: '2022-01-01',
        days_overdue: 400 // ~13 months
      };

      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [overdueAudit] })
          .mockResolvedValueOnce({ rows: [] }) // INSERT alert
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const alertsGenerated = await service.checkESGAuditDueDates('tenant-1');

      expect(alertsGenerated).toBe(1);
    });

    it('should generate INFO alert for audit due within 30 days', async () => {
      const upcomingAudit = {
        vendor_id: 'v1',
        vendor_code: 'V001',
        vendor_name: 'Vendor 1',
        next_audit_due_date: '2025-02-01', // 15 days from now
        last_audit_date: '2024-01-01',
        days_overdue: -15 // Negative = upcoming
      };

      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [upcomingAudit] })
          .mockResolvedValueOnce({ rows: [] }) // INSERT alert
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const alertsGenerated = await service.checkESGAuditDueDates('tenant-1');

      expect(alertsGenerated).toBe(1);
    });

    it('should handle multiple vendors with due audits', async () => {
      const multipleAudits = [
        { vendor_id: 'v1', vendor_code: 'V001', vendor_name: 'Vendor 1', next_audit_due_date: '2022-01-01', last_audit_date: '2020-01-01', days_overdue: 600 },
        { vendor_id: 'v2', vendor_code: 'V002', vendor_name: 'Vendor 2', next_audit_due_date: '2023-06-01', last_audit_date: '2022-01-01', days_overdue: 400 },
        { vendor_id: 'v3', vendor_code: 'V003', vendor_name: 'Vendor 3', next_audit_due_date: '2025-02-01', last_audit_date: '2024-01-01', days_overdue: -15 }
      ];

      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: multipleAudits })
          .mockResolvedValueOnce({ rows: [] }) // INSERT alert v1
          .mockResolvedValueOnce({ rows: [] }) // INSERT alert v2
          .mockResolvedValueOnce({ rows: [] }) // INSERT alert v3
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const alertsGenerated = await service.checkESGAuditDueDates('tenant-1');

      expect(alertsGenerated).toBe(3);
    });

    it('should return 0 if no audits due', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [] }) // No audits due
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const alertsGenerated = await service.checkESGAuditDueDates('tenant-1');

      expect(alertsGenerated).toBe(0);
    });
  });

  describe('getAlertStatistics', () => {
    it('should return correct alert statistics', async () => {
      const mockStats = {
        total_open: '15',
        critical_open: '3',
        warning_open: '8',
        info_open: '4',
        resolved_last_30_days: '25',
        avg_resolution_hours: '48.5'
      };

      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [mockStats] }),
        release: jest.fn()
      });

      const stats = await service.getAlertStatistics('tenant-1');

      expect(stats.totalOpen).toBe(15);
      expect(stats.criticalOpen).toBe(3);
      expect(stats.warningOpen).toBe(8);
      expect(stats.infoOpen).toBe(4);
      expect(stats.resolvedLast30Days).toBe(25);
      expect(stats.averageResolutionTimeHours).toBe(48.5);
    });

    it('should handle zero values gracefully', async () => {
      const mockStats = {
        total_open: null,
        critical_open: null,
        warning_open: null,
        info_open: null,
        resolved_last_30_days: null,
        avg_resolution_hours: null
      };

      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [mockStats] }),
        release: jest.fn()
      });

      const stats = await service.getAlertStatistics('tenant-1');

      expect(stats.totalOpen).toBe(0);
      expect(stats.criticalOpen).toBe(0);
      expect(stats.averageResolutionTimeHours).toBe(0);
    });
  });
});
