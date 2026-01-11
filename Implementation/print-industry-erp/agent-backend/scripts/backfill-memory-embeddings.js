#!/usr/bin/env node

/**
 * Backfill Memory Embeddings Script
 *
 * Purpose: Generate embeddings for existing memories that have zero vectors
 * Runtime: node
 * Usage: node scripts/backfill-memory-embeddings.js
 *
 * Requires:
 *   - PostgreSQL running with agent_memory database
 *   - Ollama container running with nomic-embed-text model
 *   - DATABASE_URL environment variable (or uses default)
 *   - OLLAMA_URL environment variable (or uses default)
 */

const { Pool } = require('pg');
const axios = require('axios');

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://agogsaas_user:changeme@localhost:5433/agogsaas';
// Host-side script uses HOST_OLLAMA_URL (localhost), not Docker-internal OLLAMA_URL
const OLLAMA_URL = process.env.HOST_OLLAMA_URL || 'http://localhost:11434';
const BATCH_SIZE = 10;
const EMBEDDING_MODEL = 'nomic-embed-text';
const EMBEDDING_DIMENSIONS = 768;

// Create zero vector for comparison
const ZERO_VECTOR = Array(EMBEDDING_DIMENSIONS).fill(0);

async function generateEmbedding(text) {
  try {
    // nomic-embed-text has 2048 token limit (~1500 chars safely)
    const truncatedText = text.substring(0, 1500);
    const response = await axios.post(
      `${OLLAMA_URL}/api/embeddings`,
      {
        model: EMBEDDING_MODEL,
        prompt: truncatedText,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000, // 60 second timeout for batch processing
      }
    );
    return response.data.embedding;
  } catch (error) {
    console.error(`[ERROR] Failed to generate embedding: ${error.message}`);
    return null;
  }
}

async function checkOllamaModel() {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`);
    const models = response.data.models || [];
    const hasModel = models.some(m => m.name.startsWith(EMBEDDING_MODEL));
    if (!hasModel) {
      console.error(`[ERROR] Model '${EMBEDDING_MODEL}' not found in Ollama.`);
      console.error(`Run: docker exec agogsaas-agents-ollama ollama pull ${EMBEDDING_MODEL}`);
      return false;
    }
    console.log(`[OK] Model '${EMBEDDING_MODEL}' is available.`);
    return true;
  } catch (error) {
    console.error(`[ERROR] Cannot connect to Ollama at ${OLLAMA_URL}: ${error.message}`);
    return false;
  }
}

async function isZeroVector(embedding) {
  if (!embedding) return true;
  // Check if all values are 0
  return embedding.every(v => v === 0);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Memory Embeddings Backfill Script');
  console.log('='.repeat(60));
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Ollama: ${OLLAMA_URL}`);
  console.log(`Model: ${EMBEDDING_MODEL}`);
  console.log('='.repeat(60));

  // Check Ollama model availability
  const modelReady = await checkOllamaModel();
  if (!modelReady) {
    process.exit(1);
  }

  // Connect to database
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  try {
    // Test connection
    const testResult = await pool.query('SELECT 1 as test');
    console.log('[OK] Database connection successful.');

    // Count total memories
    const countResult = await pool.query('SELECT COUNT(*) as total FROM memories');
    const totalMemories = parseInt(countResult.rows[0].total, 10);
    console.log(`[INFO] Total memories in database: ${totalMemories}`);

    // Find memories with zero/null embeddings
    // We need to check for embeddings that are all zeros
    const zeroCheckResult = await pool.query(`
      SELECT id, agent_id, content, embedding
      FROM memories
      WHERE embedding IS NULL
         OR embedding = $1::vector
      ORDER BY created_at ASC
    `, [JSON.stringify(ZERO_VECTOR)]);

    const memoriesToUpdate = zeroCheckResult.rows;
    console.log(`[INFO] Memories needing embeddings: ${memoriesToUpdate.length}`);

    if (memoriesToUpdate.length === 0) {
      console.log('[OK] All memories already have embeddings!');
      await pool.end();
      return;
    }

    // Process in batches
    let processed = 0;
    let success = 0;
    let failed = 0;

    console.log(`\n[START] Processing ${memoriesToUpdate.length} memories in batches of ${BATCH_SIZE}...\n`);

    for (let i = 0; i < memoriesToUpdate.length; i += BATCH_SIZE) {
      const batch = memoriesToUpdate.slice(i, i + BATCH_SIZE);

      for (const memory of batch) {
        processed++;
        const progress = `[${processed}/${memoriesToUpdate.length}]`;

        // Generate embedding
        const embedding = await generateEmbedding(memory.content);

        if (embedding && embedding.length === EMBEDDING_DIMENSIONS) {
          // Update memory with embedding
          await pool.query(
            `UPDATE memories SET embedding = $1::vector WHERE id = $2`,
            [JSON.stringify(embedding), memory.id]
          );
          success++;
          console.log(`${progress} OK: ${memory.agent_id} - ${memory.content.substring(0, 50)}...`);
        } else {
          failed++;
          console.error(`${progress} FAIL: ${memory.id}`);
        }
      }

      // Small delay between batches to avoid overwhelming Ollama
      if (i + BATCH_SIZE < memoriesToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('BACKFILL COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total processed: ${processed}`);
    console.log(`Successful: ${success}`);
    console.log(`Failed: ${failed}`);
    console.log('='.repeat(60));

    await pool.end();

  } catch (error) {
    console.error('[FATAL] Error during backfill:', error.message);
    await pool.end();
    process.exit(1);
  }
}

main().catch(console.error);
