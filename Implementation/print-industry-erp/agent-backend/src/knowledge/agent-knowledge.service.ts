/**
 * Agent Knowledge Service
 *
 * Manages persistent agent knowledge across 4 tables:
 * 1. agent_learnings - Lessons agents learn to avoid repeating mistakes
 * 2. strategic_decisions - Decisions made by agents (APPROVE/REJECT/DEFER)
 * 3. nats_deliverable_cache - Cached deliverables for quick lookup
 * 4. workflow_state - Current state tracking (migrating from redundant table)
 */

import { Pool } from 'pg';

// ============================================================================
// Interfaces
// ============================================================================

export interface AgentLearning {
  id?: string;
  agent_id: string;
  learning_type: 'pattern' | 'anti_pattern' | 'best_practice' | 'gotcha' | 'optimization';
  title: string;
  description: string;
  example_context?: string;
  confidence_score: number;
  times_applied: number;
  times_failed: number;
  created_at?: Date;
  last_applied_at?: Date;
}

export interface StrategicDecision {
  id?: string;
  req_number: string;
  agent: string;
  decision: 'APPROVE' | 'REQUEST_CHANGES' | 'ESCALATE_HUMAN' | 'DEFER';
  reasoning: string;
  instructions_for_roy?: string;
  instructions_for_jen?: string;
  priority_fixes?: string[];
  deferred_items?: string[];
  business_context?: string;
  created_at?: Date;
}

export interface CachedDeliverable {
  id?: string;
  req_number: string;
  agent: string;
  stage: number;
  deliverable: any;
  created_at?: Date;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class AgentKnowledgeService {
  private pool: Pool;

  constructor() {
    const dbUrl = process.env.DATABASE_URL || 'postgresql://agent_user:agent_dev_password_2024@agent-postgres:5432/agent_memory';
    this.pool = new Pool({ connectionString: dbUrl });
  }

  // ==========================================================================
  // AGENT LEARNINGS - Store and retrieve lessons
  // ==========================================================================

  /**
   * Store a new learning that agents can reference in future work
   */
  async storeLearning(learning: AgentLearning): Promise<string> {
    const query = `
      INSERT INTO agent_learnings
        (agent_id, learning_type, title, description, example_context, confidence_score)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const result = await this.pool.query(query, [
      learning.agent_id,
      learning.learning_type,
      learning.title,
      learning.description,
      learning.example_context || null,
      learning.confidence_score
    ]);

    console.log(`[AgentKnowledge] Stored learning: ${learning.title} (${learning.learning_type})`);
    return result.rows[0].id;
  }

  /**
   * Get relevant learnings for an agent before starting work
   * Filters by agent, type, and minimum confidence
   */
  async getLearningsForAgent(
    agentId: string,
    options?: {
      learning_types?: string[];
      min_confidence?: number;
      limit?: number;
    }
  ): Promise<AgentLearning[]> {
    let query = `
      SELECT * FROM agent_learnings
      WHERE agent_id = $1
    `;
    const params: any[] = [agentId];

    if (options?.learning_types && options.learning_types.length > 0) {
      query += ` AND learning_type = ANY($${params.length + 1})`;
      params.push(options.learning_types);
    }

    if (options?.min_confidence) {
      query += ` AND confidence_score >= $${params.length + 1}`;
      params.push(options.min_confidence);
    }

    query += ` ORDER BY confidence_score DESC, times_applied DESC`;

    if (options?.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Search learnings by keyword across all agents
   */
  async searchLearnings(keyword: string, limit: number = 10): Promise<AgentLearning[]> {
    const query = `
      SELECT * FROM agent_learnings
      WHERE title ILIKE $1 OR description ILIKE $1
      ORDER BY confidence_score DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [`%${keyword}%`, limit]);
    return result.rows;
  }

  /**
   * Record that a learning was applied (success or failure)
   */
  async recordLearningApplication(learningId: string, success: boolean): Promise<void> {
    const query = success
      ? `UPDATE agent_learnings
         SET times_applied = times_applied + 1,
             last_applied_at = NOW(),
             confidence_score = LEAST(1.0, confidence_score + 0.05)
         WHERE id = $1`
      : `UPDATE agent_learnings
         SET times_failed = times_failed + 1,
             confidence_score = GREATEST(0.0, confidence_score - 0.1)
         WHERE id = $1`;

    await this.pool.query(query, [learningId]);
  }

  // ==========================================================================
  // STRATEGIC DECISIONS - Store and retrieve agent decisions
  // ==========================================================================

  /**
   * Store a strategic decision made by an agent
   */
  async storeDecision(decision: StrategicDecision): Promise<string> {
    const query = `
      INSERT INTO strategic_decisions
        (req_number, agent, decision, reasoning, instructions_for_roy,
         instructions_for_jen, priority_fixes, deferred_items, business_context)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    const result = await this.pool.query(query, [
      decision.req_number,
      decision.agent,
      decision.decision,
      decision.reasoning,
      decision.instructions_for_roy || null,
      decision.instructions_for_jen || null,
      decision.priority_fixes || null,
      decision.deferred_items || null,
      decision.business_context || null
    ]);

    console.log(`[AgentKnowledge] Stored decision: ${decision.req_number} - ${decision.decision} by ${decision.agent}`);
    return result.rows[0].id;
  }

  /**
   * Get decisions for a specific request
   */
  async getDecisionsForRequest(reqNumber: string): Promise<StrategicDecision[]> {
    const query = `
      SELECT * FROM strategic_decisions
      WHERE req_number = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [reqNumber]);
    return result.rows;
  }

  /**
   * Get the latest decision for a request
   */
  async getLatestDecision(reqNumber: string): Promise<StrategicDecision | null> {
    const query = `
      SELECT * FROM strategic_decisions
      WHERE req_number = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [reqNumber]);
    return result.rows[0] || null;
  }

  /**
   * Get all decisions by a specific agent
   */
  async getDecisionsByAgent(agent: string, limit: number = 50): Promise<StrategicDecision[]> {
    const query = `
      SELECT * FROM strategic_decisions
      WHERE agent = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [agent, limit]);
    return result.rows;
  }

  /**
   * Check if a request was previously rejected (for learning)
   */
  async wasRequestRejected(reqNumber: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count FROM strategic_decisions
      WHERE req_number = $1 AND decision = 'REQUEST_CHANGES'
    `;

    const result = await this.pool.query(query, [reqNumber]);
    return parseInt(result.rows[0].count) > 0;
  }

  // ==========================================================================
  // NATS DELIVERABLE CACHE - Cache and retrieve deliverables
  // ==========================================================================

  /**
   * Cache a deliverable from NATS
   */
  async cacheDeliverable(cache: CachedDeliverable): Promise<void> {
    const query = `
      INSERT INTO nats_deliverable_cache
        (req_number, agent, stage, deliverable)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (req_number, agent, stage)
      DO UPDATE SET deliverable = $4, created_at = NOW()
    `;

    await this.pool.query(query, [
      cache.req_number,
      cache.agent,
      cache.stage,
      JSON.stringify(cache.deliverable)
    ]);

    console.log(`[AgentKnowledge] Cached deliverable: ${cache.req_number} - ${cache.agent} (stage ${cache.stage})`);
  }

  /**
   * Get cached deliverable for a specific request/agent/stage
   */
  async getCachedDeliverable(
    reqNumber: string,
    agent: string,
    stage: number
  ): Promise<CachedDeliverable | null> {
    const query = `
      SELECT * FROM nats_deliverable_cache
      WHERE req_number = $1 AND agent = $2 AND stage = $3
    `;

    const result = await this.pool.query(query, [reqNumber, agent, stage]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      req_number: row.req_number,
      agent: row.agent,
      stage: row.stage,
      deliverable: row.deliverable,
      created_at: row.created_at
    };
  }

  /**
   * Get all cached deliverables for a request
   */
  async getAllDeliverablesForRequest(reqNumber: string): Promise<CachedDeliverable[]> {
    const query = `
      SELECT * FROM nats_deliverable_cache
      WHERE req_number = $1
      ORDER BY stage ASC
    `;

    const result = await this.pool.query(query, [reqNumber]);
    return result.rows.map(row => ({
      id: row.id,
      req_number: row.req_number,
      agent: row.agent,
      stage: row.stage,
      deliverable: row.deliverable,
      created_at: row.created_at
    }));
  }

  /**
   * Search deliverables by content
   */
  async searchDeliverables(keyword: string, limit: number = 20): Promise<CachedDeliverable[]> {
    const query = `
      SELECT * FROM nats_deliverable_cache
      WHERE deliverable::text ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [`%${keyword}%`, limit]);
    return result.rows;
  }

  // ==========================================================================
  // CROSS-TABLE QUERIES - Useful aggregations
  // ==========================================================================

  /**
   * Get full context for a request (decisions, deliverables, learnings)
   */
  async getFullRequestContext(reqNumber: string): Promise<{
    decisions: StrategicDecision[];
    deliverables: CachedDeliverable[];
    relevantLearnings: AgentLearning[];
  }> {
    const [decisions, deliverables] = await Promise.all([
      this.getDecisionsForRequest(reqNumber),
      this.getAllDeliverablesForRequest(reqNumber)
    ]);

    // Get learnings relevant to this request's domain
    const relevantLearnings = await this.searchLearnings(
      reqNumber.includes('SALES') ? 'sales' :
      reqNumber.includes('INVENTORY') ? 'inventory' :
      reqNumber.includes('WMS') ? 'warehouse' : 'feature',
      5
    );

    return { decisions, deliverables, relevantLearnings };
  }

  /**
   * Get agent performance summary
   */
  async getAgentPerformanceSummary(agentId: string): Promise<{
    total_learnings: number;
    avg_confidence: number;
    total_decisions: number;
    approval_rate: number;
  }> {
    const learningsQuery = `
      SELECT COUNT(*) as count, AVG(confidence_score) as avg_confidence
      FROM agent_learnings WHERE agent_id = $1
    `;
    const decisionsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE decision = 'APPROVE') as approvals
      FROM strategic_decisions WHERE agent = $1
    `;

    const [learnings, decisions] = await Promise.all([
      this.pool.query(learningsQuery, [agentId]),
      this.pool.query(decisionsQuery, [agentId])
    ]);

    const totalDecisions = parseInt(decisions.rows[0].total) || 0;
    const approvals = parseInt(decisions.rows[0].approvals) || 0;

    return {
      total_learnings: parseInt(learnings.rows[0].count) || 0,
      avg_confidence: parseFloat(learnings.rows[0].avg_confidence) || 0,
      total_decisions: totalDecisions,
      approval_rate: totalDecisions > 0 ? approvals / totalDecisions : 0
    };
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Cleanup old cached deliverables (older than 30 days)
   */
  async cleanupOldDeliverables(daysOld: number = 30): Promise<number> {
    const query = `
      DELETE FROM nats_deliverable_cache
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      RETURNING id
    `;
    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
export const agentKnowledge = new AgentKnowledgeService();
