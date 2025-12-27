/**
 * VENDOR TIER CLASSIFICATION SERVICE - UNIT TESTS
 *
 * Test Coverage:
 * - classifyVendorTier(): spend analysis, percentile ranking, tier assignment
 * - updateVendorTier(): manual override, alert generation
 * - reclassifyAllVendors(): batch processing, hysteresis logic
 * - determineTier(): hysteresis boundary conditions
 *
 * Testing Strategy:
 * - Mock database Pool for isolated unit tests
 * - Test hysteresis logic with boundary vendors
 * - Verify tier change alert generation
 * - Validate spend calculation accuracy
 */

import { VendorTierClassificationService } from '../vendor-tier-classification.service';
import type { Pool, PoolClient } from 'pg';

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

describe('VendorTierClassificationService', () => {
  let service: VendorTierClassificationService;
  let mockPool: Pool;
  let mockClient: any;

  beforeEach(() => {
    mockPool = createMockPool();
    service = new VendorTierClassificationService(mockPool);
    mockClient = null;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyVendorTier', () => {
    it('should classify vendor as STRATEGIC when in top 15% of spend', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ total_spend: '150000' }] }) // Vendor spend
          .mockResolvedValueOnce({ rows: [{ total_spend: '1000000' }] }) // Total spend
          .mockResolvedValueOnce({ rows: [{ mission_critical: false, current_tier: null }] }) // Current vendor
          .mockResolvedValueOnce({ rows: [] }) // UPDATE vendor_performance
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const result = await service.classifyVendorTier('tenant-1', 'vendor-1');

      expect(result.tier).toBe('STRATEGIC');
      expect(result.totalSpend).toBe(150000);
      expect(result.percentileRank).toBe(15); // 150k / 1M = 15%
      expect(result.tierChanged).toBe(false); // No previous tier
    });

    it('should classify vendor as PREFERRED when in 15-40% of spend', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ total_spend: '250000' }] }) // Vendor spend (25%)
          .mockResolvedValueOnce({ rows: [{ total_spend: '1000000' }] }) // Total spend
          .mockResolvedValueOnce({ rows: [{ mission_critical: false, current_tier: null }] }) // Current vendor
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const result = await service.classifyVendorTier('tenant-1', 'vendor-2');

      expect(result.tier).toBe('PREFERRED');
      expect(result.percentileRank).toBe(25);
    });

    it('should classify vendor as TRANSACTIONAL when above 40% of spend', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ total_spend: '450000' }] }) // Vendor spend (45%)
          .mockResolvedValueOnce({ rows: [{ total_spend: '1000000' }] }) // Total spend
          .mockResolvedValueOnce({ rows: [{ mission_critical: false, current_tier: null }] }) // Current vendor
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const result = await service.classifyVendorTier('tenant-1', 'vendor-3');

      expect(result.tier).toBe('TRANSACTIONAL');
      expect(result.percentileRank).toBe(45);
    });

    it('should always classify mission-critical vendors as STRATEGIC', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ total_spend: '50000' }] }) // Vendor spend (5% - normally TRANSACTIONAL)
          .mockResolvedValueOnce({ rows: [{ total_spend: '1000000' }] }) // Total spend
          .mockResolvedValueOnce({ rows: [{ mission_critical: true, current_tier: null }] }) // Mission critical!
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const result = await service.classifyVendorTier('tenant-1', 'vendor-mission');

      expect(result.tier).toBe('STRATEGIC');
      expect(result.percentileRank).toBe(5); // Low spend but mission critical
    });

    it('should apply hysteresis to prevent tier oscillation (STRATEGIC → PREFERRED)', async () => {
      // Vendor at 14% spend (below 15% promotion threshold but above 13% demotion threshold)
      // Currently STRATEGIC, should STAY STRATEGIC due to hysteresis
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ total_spend: '140000' }] }) // 14%
          .mockResolvedValueOnce({ rows: [{ total_spend: '1000000' }] })
          .mockResolvedValueOnce({ rows: [{ mission_critical: false, current_tier: 'STRATEGIC' }] }) // Currently STRATEGIC
          .mockResolvedValueOnce({ rows: [] }) // UPDATE (should not generate alert - no change)
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const result = await service.classifyVendorTier('tenant-1', 'vendor-boundary');

      expect(result.tier).toBe('STRATEGIC'); // Stays STRATEGIC
      expect(result.tierChanged).toBe(false);
    });

    it('should demote from STRATEGIC when spend drops below 13%', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ total_spend: '120000' }] }) // 12% - below demotion threshold
          .mockResolvedValueOnce({ rows: [{ total_spend: '1000000' }] })
          .mockResolvedValueOnce({ rows: [{ mission_critical: false, current_tier: 'STRATEGIC' }] })
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }) // INSERT alert
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const result = await service.classifyVendorTier('tenant-1', 'vendor-demotion');

      expect(result.tier).toBe('PREFERRED'); // Demoted
      expect(result.previousTier).toBe('STRATEGIC');
      expect(result.tierChanged).toBe(true);
    });

    it('should throw error if vendor not found', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ total_spend: '100000' }] })
          .mockResolvedValueOnce({ rows: [{ total_spend: '1000000' }] })
          .mockResolvedValueOnce({ rows: [] }), // Vendor not found
        release: jest.fn()
      });

      await expect(service.classifyVendorTier('tenant-1', 'invalid-vendor'))
        .rejects
        .toThrow('Vendor invalid-vendor not found');
    });
  });

  describe('updateVendorTier', () => {
    it('should manually override vendor tier with reason', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ vendor_tier: 'PREFERRED', notes: '' }] }) // Current tier
          .mockResolvedValueOnce({ rows: [] }) // UPDATE vendor_performance
          .mockResolvedValueOnce({ rows: [] }) // INSERT alert
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      await service.updateVendorTier(
        'tenant-1',
        'vendor-1',
        'STRATEGIC',
        'Strategic partnership negotiated for exclusive supply agreement',
        'user-123'
      );

      const mockClient = await mockPool.connect();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE vendor_performance'),
        expect.arrayContaining(['STRATEGIC', 'user-123'])
      );
    });

    it('should throw error for invalid tier value', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }), // SET LOCAL
        release: jest.fn()
      });

      await expect(service.updateVendorTier(
        'tenant-1',
        'vendor-1',
        'INVALID_TIER' as any,
        'Test reason',
        'user-123'
      )).rejects.toThrow('Invalid tier value');
    });

    it('should generate TIER_CHANGE alert when tier changes', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ vendor_tier: 'TRANSACTIONAL', notes: '' }] })
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }) // INSERT alert (should be called)
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      await service.updateVendorTier(
        'tenant-1',
        'vendor-1',
        'STRATEGIC',
        'Quality improvement plan successful',
        'user-123'
      );

      const mockClient = await mockPool.connect();
      const alertCall = (mockClient.query as jest.Mock).mock.calls.find(call =>
        call[0]?.includes('INSERT INTO vendor_performance_alerts')
      );

      expect(alertCall).toBeDefined();
    });

    it('should not generate alert when tier stays the same', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [{ vendor_tier: 'STRATEGIC', notes: '' }] })
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          // No alert INSERT expected
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      await service.updateVendorTier(
        'tenant-1',
        'vendor-1',
        'STRATEGIC', // Same tier
        'Reconfirming strategic status',
        'user-123'
      );

      const mockClient = await mockPool.connect();
      const alertCall = (mockClient.query as jest.Mock).mock.calls.find(call =>
        call[0]?.includes('INSERT INTO vendor_performance_alerts')
      );

      expect(alertCall).toBeUndefined();
    });
  });

  describe('reclassifyAllVendors', () => {
    it('should reclassify all vendors and return summary', async () => {
      const mockVendors = [
        { vendor_id: 'v1', vendor_code: 'V001', vendor_name: 'Vendor 1', mission_critical: false, current_tier: null, total_spend: '500000' }, // STRATEGIC (50%)
        { vendor_id: 'v2', vendor_code: 'V002', vendor_name: 'Vendor 2', mission_critical: false, current_tier: null, total_spend: '300000' }, // PREFERRED (30%)
        { vendor_id: 'v3', vendor_code: 'V003', vendor_name: 'Vendor 3', mission_critical: false, current_tier: null, total_spend: '200000' }  // TRANSACTIONAL (20%)
      ];

      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: mockVendors }) // Get all vendors
          .mockResolvedValueOnce({ rows: [] }) // UPDATE v1
          .mockResolvedValueOnce({ rows: [] }) // UPDATE v2
          .mockResolvedValueOnce({ rows: [] }) // UPDATE v3
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const result = await service.reclassifyAllVendors('tenant-1');

      expect(result.strategicCount).toBe(1); // v1
      expect(result.preferredCount).toBe(1); // v2
      expect(result.transactionalCount).toBe(1); // v3
      expect(result.totalVendorsAnalyzed).toBe(3);
      expect(result.tierChanges.length).toBe(0); // All new classifications, no changes
    });

    it('should detect and track tier changes', async () => {
      const mockVendors = [
        { vendor_id: 'v1', vendor_code: 'V001', vendor_name: 'Vendor 1', mission_critical: false, current_tier: 'PREFERRED', total_spend: '500000' }, // Should promote to STRATEGIC
        { vendor_id: 'v2', vendor_code: 'V002', vendor_name: 'Vendor 2', mission_critical: false, current_tier: 'STRATEGIC', total_spend: '100000' }  // Should demote to TRANSACTIONAL
      ];

      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: mockVendors }) // Get all vendors
          .mockResolvedValueOnce({ rows: [] }) // UPDATE v1
          .mockResolvedValueOnce({ rows: [] }) // INSERT alert v1
          .mockResolvedValueOnce({ rows: [] }) // UPDATE v2
          .mockResolvedValueOnce({ rows: [] }) // INSERT alert v2
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const result = await service.reclassifyAllVendors('tenant-1');

      expect(result.tierChanges.length).toBe(2);
      expect(result.tierChanges[0].oldTier).toBe('PREFERRED');
      expect(result.tierChanges[0].newTier).toBe('STRATEGIC');
      expect(result.tierChanges[1].oldTier).toBe('STRATEGIC');
      expect(result.tierChanges[1].newTier).toBe('TRANSACTIONAL');
    });

    it('should apply hysteresis logic in batch reclassification', async () => {
      // Vendor at 14% spend, currently STRATEGIC
      // Should STAY STRATEGIC due to hysteresis (demotion threshold is 13%)
      const mockVendors = [
        { vendor_id: 'v1', vendor_code: 'V001', vendor_name: 'Vendor 1', mission_critical: false, current_tier: 'STRATEGIC', total_spend: '140000' } // 14% of 1M
      ];

      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: mockVendors }) // Get all vendors
          // No UPDATE or alert calls expected (tier unchanged)
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const result = await service.reclassifyAllVendors('tenant-1');

      expect(result.strategicCount).toBe(1); // Still STRATEGIC
      expect(result.tierChanges.length).toBe(0); // No change
    });

    it('should handle empty vendor list gracefully', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockResolvedValueOnce({ rows: [] }) // Get all vendors (empty)
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      });

      const result = await service.reclassifyAllVendors('tenant-1');

      expect(result.totalVendorsAnalyzed).toBe(0);
      expect(result.strategicCount).toBe(0);
      expect(result.preferredCount).toBe(0);
      expect(result.transactionalCount).toBe(0);
      expect(result.tierChanges.length).toBe(0);
    });

    it('should rollback on error', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
          .mockRejectedValueOnce(new Error('Database connection lost')), // Error during query
        release: jest.fn()
      });

      await expect(service.reclassifyAllVendors('tenant-1'))
        .rejects
        .toThrow('Database connection lost');

      const mockClient = await mockPool.connect();
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
