-- ============================================================================
-- V0.0.31: Create AI Error Log Table
-- ============================================================================
-- Purpose: Log errors from AI function calls for human review
-- The SDLC owner can review errors and decide to:
--   - Dismiss (known limitation)
--   - Promote to REQ (actual bug needing fix)
-- ============================================================================

-- AI Error Log table
CREATE TABLE IF NOT EXISTS ai_error_log (
    id SERIAL PRIMARY KEY,

    -- Error details
    function_name VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    error_code VARCHAR(50),

    -- Context for debugging
    context JSONB DEFAULT '{}',

    -- User/session info
    session_id VARCHAR(100),
    user_query TEXT,

    -- Resolution tracking
    dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP,
    dismissed_reason TEXT,
    promoted_to_req VARCHAR(50),  -- REQ number if promoted
    promoted_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_ai_error_log_function ON ai_error_log(function_name);
CREATE INDEX idx_ai_error_log_created ON ai_error_log(created_at DESC);
CREATE INDEX idx_ai_error_log_dismissed ON ai_error_log(dismissed) WHERE dismissed = FALSE;

-- Comments
COMMENT ON TABLE ai_error_log IS 'Log of AI function call errors for human review';
COMMENT ON COLUMN ai_error_log.function_name IS 'Name of the AI function that failed';
COMMENT ON COLUMN ai_error_log.error_message IS 'Error message returned';
COMMENT ON COLUMN ai_error_log.context IS 'Additional context (args, response, etc.)';
COMMENT ON COLUMN ai_error_log.dismissed IS 'True if error was reviewed and dismissed';
COMMENT ON COLUMN ai_error_log.promoted_to_req IS 'REQ number if error was promoted to a request';

-- ============================================================================
-- Helper function to log an error
-- ============================================================================
CREATE OR REPLACE FUNCTION log_ai_error(
    p_function_name VARCHAR(100),
    p_error_message TEXT,
    p_error_code VARCHAR(50) DEFAULT NULL,
    p_context JSONB DEFAULT '{}',
    p_session_id VARCHAR(100) DEFAULT NULL,
    p_user_query TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO ai_error_log (
        function_name,
        error_message,
        error_code,
        context,
        session_id,
        user_query
    ) VALUES (
        p_function_name,
        p_error_message,
        p_error_code,
        p_context,
        p_session_id,
        p_user_query
    ) RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper function to dismiss an error
-- ============================================================================
CREATE OR REPLACE FUNCTION dismiss_ai_error(
    p_error_id INTEGER,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE ai_error_log
    SET dismissed = TRUE,
        dismissed_at = NOW(),
        dismissed_reason = p_reason
    WHERE id = p_error_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper function to promote error to REQ
-- ============================================================================
CREATE OR REPLACE FUNCTION promote_ai_error_to_req(
    p_error_id INTEGER,
    p_req_number VARCHAR(50)
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE ai_error_log
    SET promoted_to_req = p_req_number,
        promoted_at = NOW(),
        dismissed = TRUE,
        dismissed_at = NOW(),
        dismissed_reason = 'Promoted to REQ'
    WHERE id = p_error_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- View for pending errors (not dismissed, not promoted)
-- ============================================================================
CREATE OR REPLACE VIEW ai_errors_pending AS
SELECT
    id,
    function_name,
    error_message,
    error_code,
    context,
    user_query,
    created_at,
    COUNT(*) OVER (PARTITION BY function_name) as occurrence_count
FROM ai_error_log
WHERE dismissed = FALSE
ORDER BY created_at DESC;

COMMENT ON VIEW ai_errors_pending IS 'AI errors pending review, with occurrence count per function';
