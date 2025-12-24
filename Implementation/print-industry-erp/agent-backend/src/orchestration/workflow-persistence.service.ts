/**
 * Workflow Persistence Service
 * Stores workflow state in PostgreSQL instead of in-memory Map
 * Ensures workflows survive container restarts
 */

import { Pool, PoolClient } from 'pg';

export interface PersistedWorkflow {
  reqNumber: string;
  title: string;
  assignedTo: string;
  status: 'pending' | 'running' | 'blocked' | 'complete' | 'failed';
  currentStage: number;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  metadata: Record<string, any>;
}

export class WorkflowPersistenceService {
  private pool: Pool;

  constructor() {
    const dbUrl = process.env.DATABASE_URL || 'postgresql://agent_user:agent_dev_password_2024@agent-postgres:5432/agent_memory';
    this.pool = new Pool({ connectionString: dbUrl });
  }

  /**
   * Create new workflow
   */
  async createWorkflow(workflow: {
    reqNumber: string;
    title: string;
    assignedTo: string;
    currentStage?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const query = `
      INSERT INTO agent_workflows (req_number, title, assigned_to, status, current_stage, metadata)
      VALUES ($1, $2, $3, 'running', $4, $5)
      ON CONFLICT (req_number) DO UPDATE
        SET status = 'running',
            current_stage = EXCLUDED.current_stage,
            updated_at = NOW()
    `;

    await this.pool.query(query, [
      workflow.reqNumber,
      workflow.title,
      workflow.assignedTo,
      workflow.currentStage || 0,
      JSON.stringify(workflow.metadata || {})
    ]);

    console.log(`[WorkflowPersistence] Created/updated workflow: ${workflow.reqNumber}`);
  }

  /**
   * Get workflow by req number
   */
  async getWorkflow(reqNumber: string): Promise<PersistedWorkflow | null> {
    const query = 'SELECT * FROM agent_workflows WHERE req_number = $1';
    const result = await this.pool.query(query, [reqNumber]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      reqNumber: row.req_number,
      title: row.title,
      assignedTo: row.assigned_to,
      status: row.status,
      currentStage: row.current_stage,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      metadata: row.metadata || {}
    };
  }

  /**
   * Update workflow stage
   */
  async updateStage(reqNumber: string, stage: number): Promise<void> {
    const query = `
      UPDATE agent_workflows
      SET current_stage = $1, updated_at = NOW()
      WHERE req_number = $2
    `;

    await this.pool.query(query, [stage, reqNumber]);
    console.log(`[WorkflowPersistence] Updated ${reqNumber} to stage ${stage}`);
  }

  /**
   * Mark workflow as complete
   */
  async completeWorkflow(reqNumber: string): Promise<void> {
    const query = `
      UPDATE agent_workflows
      SET status = 'complete', completed_at = NOW(), updated_at = NOW()
      WHERE req_number = $1
    `;

    await this.pool.query(query, [reqNumber]);
    console.log(`[WorkflowPersistence] Completed workflow: ${reqNumber}`);
  }

  /**
   * Mark workflow as blocked
   */
  async blockWorkflow(reqNumber: string, reason: string): Promise<void> {
    const query = `
      UPDATE agent_workflows
      SET status = 'blocked',
          metadata = metadata || jsonb_build_object('block_reason', $2),
          updated_at = NOW()
      WHERE req_number = $1
    `;

    await this.pool.query(query, [reqNumber, reason]);
    console.log(`[WorkflowPersistence] Blocked workflow: ${reqNumber} - ${reason}`);
  }

  /**
   * Get all running workflows
   */
  async getRunningWorkflows(): Promise<PersistedWorkflow[]> {
    const query = "SELECT * FROM agent_workflows WHERE status = 'running' ORDER BY started_at ASC";
    const result = await this.pool.query(query);

    return result.rows.map(row => ({
      reqNumber: row.req_number,
      title: row.title,
      assignedTo: row.assigned_to,
      status: row.status,
      currentStage: row.current_stage,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      metadata: row.metadata || {}
    }));
  }

  /**
   * Recover workflows on startup
   * Returns workflows that were running when container crashed
   */
  async recoverWorkflows(): Promise<PersistedWorkflow[]> {
    console.log('[WorkflowPersistence] Recovering workflows from database...');

    const running = await this.getRunningWorkflows();

    console.log(`[WorkflowPersistence] Found ${running.length} running workflows to recover`);
    return running;
  }

  /**
   * Cleanup old completed workflows
   */
  async cleanup(): Promise<number> {
    const query = `
      DELETE FROM agent_workflows
      WHERE status = 'complete'
        AND completed_at < NOW() - INTERVAL '90 days'
      RETURNING req_number
    `;

    const result = await this.pool.query(query);
    const count = result.rowCount || 0;

    if (count > 0) {
      console.log(`[WorkflowPersistence] Cleaned up ${count} old workflows`);
    }

    return count;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
