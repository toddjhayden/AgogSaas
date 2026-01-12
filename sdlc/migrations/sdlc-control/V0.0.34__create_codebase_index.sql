-- SDLC Codebase Index Tables
-- Two separate indexes:
-- 1. sdlc_codebase_index (agent_memory schema) - SDLC platform code itself
-- 2. project_codebase_index (sdlc_control schema) - Managed project code

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Project Codebase Index (for managed projects like AGOG)
-- Each project has its own entries keyed by project_id
CREATE TABLE IF NOT EXISTS project_codebase_index (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL,      -- e.g., 'agog-print-erp'
    file_path TEXT NOT NULL,                -- Relative path from project root
    file_type VARCHAR(50),                  -- 'typescript', 'tsx', 'json', etc.
    content_hash VARCHAR(64),               -- SHA-256 of file content

    -- Code structure (extracted by AST parsing)
    exports JSONB DEFAULT '[]',             -- Exported functions, classes, types
    imports JSONB DEFAULT '[]',             -- Import statements
    dependencies JSONB DEFAULT '[]',        -- Package dependencies referenced

    -- Semantic info
    summary TEXT,                           -- AI-generated summary of file purpose
    embedding vector(384),                  -- nomic-embed-text embedding (384 dims)

    -- Metadata
    line_count INTEGER,
    size_bytes INTEGER,
    last_modified TIMESTAMPTZ,
    indexed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique file per project
    CONSTRAINT unique_project_file UNIQUE (project_id, file_path)
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_project_codebase_embedding
ON project_codebase_index USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_project_codebase_project_id
ON project_codebase_index (project_id);

-- Index for file type filtering
CREATE INDEX IF NOT EXISTS idx_project_codebase_file_type
ON project_codebase_index (file_type);

-- SDLC Platform Codebase Index (for SDLC system itself)
-- This goes in agent_memory schema but we create it here for consistency
-- Run this in agent_memory database as well
DO $$
BEGIN
    -- Create the table for SDLC platform code
    CREATE TABLE IF NOT EXISTS sdlc_codebase_index (
        id SERIAL PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,     -- Relative path from sdlc/
        file_type VARCHAR(50),
        content_hash VARCHAR(64),

        -- Code structure
        exports JSONB DEFAULT '[]',
        imports JSONB DEFAULT '[]',

        -- Semantic info
        summary TEXT,
        embedding vector(384),

        -- Metadata
        line_count INTEGER,
        size_bytes INTEGER,
        last_modified TIMESTAMPTZ,
        indexed_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Vector index for SDLC codebase
    CREATE INDEX IF NOT EXISTS idx_sdlc_codebase_embedding
    ON sdlc_codebase_index USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);
EXCEPTION
    WHEN duplicate_table THEN
        NULL; -- Table already exists, ignore
END $$;

-- Comment on tables
COMMENT ON TABLE project_codebase_index IS 'Vector-searchable index of managed project codebases';
COMMENT ON TABLE sdlc_codebase_index IS 'Vector-searchable index of SDLC platform code';

-- Insert metadata about the index
INSERT INTO project_codebase_index (project_id, file_path, file_type, summary, indexed_at)
VALUES ('_system', '_metadata', 'system', 'Codebase index initialized', NOW())
ON CONFLICT (project_id, file_path) DO UPDATE SET indexed_at = NOW();
