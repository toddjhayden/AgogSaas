#!/bin/bash
# Initialize all databases for agent-backend
# This script runs on first container startup

set -e

echo "Creating databases if they don't exist..."

# Create agent_memory database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE agent_memory'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'agent_memory')\gexec
EOSQL

# Create orchestrator database (for workflow state)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE orchestrator'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orchestrator')\gexec
EOSQL

echo "Databases created successfully!"
