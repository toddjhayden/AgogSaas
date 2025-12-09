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
  private embeddingApiKey: string;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'wms',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    this.embeddingApiKey = process.env.OPENAI_API_KEY || '';
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
      .filter(row => row.similarity >= min_relevance)
      .map(row => ({
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
   * Generate embedding using OpenAI API
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingApiKey) {
      console.warn('[MCP] No OpenAI API key, returning zero vector');
      return Array(1536).fill(0);
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model: 'text-embedding-3-small',
          input: text.substring(0, 8000), // Limit to 8K tokens
        },
        {
          headers: {
            'Authorization': `Bearer ${this.embeddingApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('[MCP] Failed to generate embedding:', error);
      return Array(1536).fill(0);
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
