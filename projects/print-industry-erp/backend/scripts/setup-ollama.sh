#!/bin/bash
# Setup Ollama with nomic-embed-text model for Layer 4 Memory

set -e

echo "[Ollama] Pulling nomic-embed-text model (768 dimensions)..."
echo "[Ollama] This may take a few minutes on first run (~274MB download)"

# Wait for Ollama to be ready
max_retries=30
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    if curl -s http://ollama:11434/api/tags > /dev/null 2>&1; then
        echo "[Ollama] Service is ready!"
        break
    fi
    retry_count=$((retry_count + 1))
    echo "[Ollama] Waiting for service... ($retry_count/$max_retries)"
    sleep 2
done

if [ $retry_count -eq $max_retries ]; then
    echo "[Ollama] ERROR: Service not ready after $max_retries attempts"
    exit 1
fi

# Pull the embedding model
curl -X POST http://ollama:11434/api/pull -d '{
  "name": "nomic-embed-text"
}'

echo ""
echo "[Ollama] Model ready! Layer 4 (Memory) is now operational."
echo "[Ollama] Embedding dimension: 768"
echo "[Ollama] Model: nomic-embed-text (optimized for semantic search)"
