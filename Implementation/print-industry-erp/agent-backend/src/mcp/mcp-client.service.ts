import { Pool } from 'pg';
import axios from 'axios';

interface Memory {
  id?: string;
  agent_id: string;
  memory_type: string;
  content: string;
  embedding?: number[];
  metadata?: any;
  created_at?: Date;
  accessed_at?: Date;
  access_count?: number;
  relevance_score?: number;
}

interface SearchOptions {
  query: string;
  agent_id?: string;
  memory_types?: string[];
  limit?: number;
  min_relevance?: number;
}

export class MCPMemoryClient {
  private pool: Pool;
  private ollamaUrl: string;

  constructor() {
    // Use DATABASE_URL connection string (set by docker-compose)
    const connectionString = process.env.DATABASE_URL || 'postgresql://agogsaas_user:changeme@localhost:5433/agogsaas';
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  }

  /**
   * Store a new memory
   */
  async storeMemory(memory: Memory): Promise<string> {
    // Generate embedding for semantic search
    const embedding = await this.generateEmbedding(memory.content);

    const result = await this.pool.query(
      `INSERT INTO memories (agent_id, memory_type, content, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        memory.agent_id,
        memory.memory_type,
        memory.content,
        JSON.stringify(embedding),
        JSON.stringify(memory.metadata || {}),
      ]
    );

    console.log(`[MCP] Stored memory for ${memory.agent_id}: ${memory.memory_type}`);
    return result.rows[0].id;
  }

  /**
   * Search memories using semantic search
   */
  async searchMemories(options: SearchOptions): Promise<Memory[]> {
    const { query, agent_id, memory_types, limit = 5, min_relevance = 0.7 } = options;

    // Generate embedding for search query
    const queryEmbedding = await this.generateEmbedding(query);

    let sql = `
      SELECT
        id, agent_id, memory_type, content, metadata,
        created_at, accessed_at, access_count, relevance_score,
        1 - (embedding <=> $1::vector) as similarity
      FROM memories
      WHERE 1=1
    `;

    const params: any[] = [JSON.stringify(queryEmbedding)];
    let paramIndex = 2;

    if (agent_id) {
      sql += ` AND agent_id = $${paramIndex}`;
      params.push(agent_id);
      paramIndex++;
    }

    if (memory_types && memory_types.length > 0) {
      sql += ` AND memory_type = ANY($${paramIndex})`;
      params.push(memory_types);
      paramIndex++;
    }

    sql += `
      ORDER BY similarity DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await this.pool.query(sql, params);

    // Filter by minimum relevance
    const memories = result.rows
      .filter((row: any) => row.similarity >= min_relevance)
      .map((row: any) => ({
        id: row.id,
        agent_id: row.agent_id,
        memory_type: row.memory_type,
        content: row.content,
        metadata: row.metadata,
        created_at: row.created_at,
        accessed_at: row.accessed_at,
        access_count: row.access_count,
        relevance_score: row.similarity,
      }));

    console.log(`[MCP] Found ${memories.length} relevant memories for query: "${query.substring(0, 50)}..."`);
    return memories;
  }

  /**
   * Get agent's recent memories
   */
  async getAgentMemories(agentId: string, limit: number = 10): Promise<Memory[]> {
    const result = await this.pool.query(
      `SELECT * FROM memories
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [agentId, limit]
    );

    return result.rows;
  }

  /**
   * Generate embedding using Ollama (FREE, local)
   * Uses nomic-embed-text model (768 dimensions)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.ollamaUrl) {
      console.warn('[MCP] No Ollama URL, returning zero vector');
      return Array(768).fill(0);
    }

    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/embeddings`,
        {
          model: 'nomic-embed-text',
          prompt: text.substring(0, 8000), // Limit to 8K tokens
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      return response.data.embedding;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error('[MCP] Model not found. Pull it with: docker exec agogsaas-ollama ollama pull nomic-embed-text');
      } else {
        console.error('[MCP] Failed to generate embedding:', error.message);
      }
      return Array(768).fill(0);
    }
  }

  /**
   * Update memory relevance score based on usage
   */
  async updateMemoryRelevance(memoryId: string, score: number): Promise<void> {
    await this.pool.query(
      `UPDATE memories SET relevance_score = $1 WHERE id = $2`,
      [score, memoryId]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
