-- Migration: V0.0.30 - Add Index on vendor_performance.vendor_tier
-- Author: Roy (Backend Developer)
-- Date: 2025-12-26
-- Requirement: REQ-STRATEGIC-AUTO-1766689933757
-- Purpose: Optimize tier classification queries
-- Addresses: BUG-015 - Missing index causes slow tier queries

-- =====================================================
-- BUG-015 RESOLUTION: VENDOR TIER INDEX
-- =====================================================
-- Problem: Tier classification queries scan entire vendor_performance table
-- Impact: 1200ms query time for tier-based filtering
-- Solution: Add composite index on (tenant_id, vendor_tier)
-- Expected improvement: 1200ms → 80ms (15x faster)
-- =====================================================

-- Create index on vendor_tier for fast tier-based filtering
-- Partial index excludes NULL tiers (vendors not yet classified)
CREATE INDEX IF NOT EXISTS idx_vendor_performance_tier
  ON vendor_performance(tenant_id, vendor_tier)
  WHERE vendor_tier IS NOT NULL;

-- Create index on tier_classification_date for recency queries
CREATE INDEX IF NOT EXISTS idx_vendor_performance_tier_date
  ON vendor_performance(tenant_id, tier_classification_date DESC)
  WHERE tier_classification_date IS NOT NULL;

-- Analyze the table to update query planner statistics
ANALYZE vendor_performance;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Query 1: Verify index created
-- Expected: 2 rows (idx_vendor_performance_tier, idx_vendor_performance_tier_date)
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'vendor_performance' AND indexname LIKE '%tier%';

-- Query 2: Test performance improvement
-- Expected: Index scan instead of sequential scan
-- EXPLAIN ANALYZE
-- SELECT vendor_id, vendor_tier, tier_classification_date
-- FROM vendor_performance
-- WHERE tenant_id = 'tenant-default-001' AND vendor_tier = 'STRATEGIC';

-- Query 3: Verify partial index usage
-- Expected: Only vendors with non-null tiers included
-- SELECT COUNT(*) FROM vendor_performance WHERE vendor_tier IS NOT NULL;
-- =====================================================
