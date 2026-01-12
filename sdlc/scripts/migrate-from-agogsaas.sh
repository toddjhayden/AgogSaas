#!/bin/bash
# SDLC Migration Script
# Migrates from agogsaas-agents-* containers to sdlc-* containers
# Run this ONCE when transitioning from old to new structure

set -e

echo "=== SDLC Migration Script ==="
echo ""

# Step 1: Stop old containers
echo "[1/5] Stopping old containers..."
docker stop agogsaas-agents-nats agogsaas-agents-postgres agogsaas-agents-ollama agogsaas-agents-backend 2>/dev/null || true

# Step 2: Copy volume data (preserves data while renaming)
echo "[2/5] Copying volume data..."

# Postgres data
docker volume create sdlc_postgres_data 2>/dev/null || true
docker run --rm \
  -v agogsaas_agents_postgres_data:/from:ro \
  -v sdlc_postgres_data:/to \
  alpine sh -c "cp -a /from/. /to/" 2>/dev/null || echo "  Postgres: No existing data or already migrated"

# NATS data
docker volume create sdlc_nats_data 2>/dev/null || true
docker run --rm \
  -v agogsaas_agents_nats_data:/from:ro \
  -v sdlc_nats_data:/to \
  alpine sh -c "cp -a /from/. /to/" 2>/dev/null || echo "  NATS: No existing data or already migrated"

# Ollama data (models)
docker volume create sdlc_ollama_data 2>/dev/null || true
docker run --rm \
  -v agogsaas_agents_ollama_data:/from:ro \
  -v sdlc_ollama_data:/to \
  alpine sh -c "cp -a /from/. /to/" 2>/dev/null || echo "  Ollama: No existing data or already migrated"

echo ""
echo "[3/5] Creating SDLC network..."
docker network create sdlc_network 2>/dev/null || true

echo ""
echo "[4/5] Starting new SDLC containers..."
cd "$(dirname "$0")/.."
docker-compose up -d

echo ""
echo "[5/5] Verifying containers..."
docker ps --filter "name=sdlc-" --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Old containers are stopped but NOT removed."
echo "Old volumes are preserved as backup."
echo ""
echo "To remove old containers and volumes after verification:"
echo "  docker rm agogsaas-agents-nats agogsaas-agents-postgres agogsaas-agents-ollama agogsaas-agents-backend"
echo "  docker volume rm agogsaas_agents_nats_data agogsaas_agents_postgres_data agogsaas_agents_ollama_data agogsaas_agents_backend_node_modules"
echo ""
