-- ============================================================================
-- V0.0.37: Blocker Analysis Functions
-- Functions for finding priority requests based on blocking relationships
-- ============================================================================

-- Function to get requests that are unblocked but are blocking other requests
-- These should be prioritized to unblock downstream work
CREATE OR REPLACE FUNCTION get_deepest_unblocked_requests(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  req_number VARCHAR(100),
  title VARCHAR(500),
  priority VARCHAR(20),
  current_phase VARCHAR(50),
  blocks_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.req_number,
    r.title,
    r.priority,
    r.current_phase,
    COUNT(rb.id) AS blocks_count
  FROM owner_requests r
  LEFT JOIN request_blockers rb ON rb.blocking_request_id = r.id
  WHERE r.is_blocked = false  -- Request is not blocked itself
    AND r.current_phase NOT IN ('done', 'cancelled')  -- Not completed
  GROUP BY r.id, r.req_number, r.title, r.priority, r.current_phase
  HAVING COUNT(rb.id) > 0  -- Is blocking at least one other request
  ORDER BY
    COUNT(rb.id) DESC,  -- Most blocking first
    CASE r.priority
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_deepest_unblocked_requests IS 'Returns unblocked requests that are blocking other requests, sorted by impact';
