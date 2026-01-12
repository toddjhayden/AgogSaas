/**
 * Stage Tracker Service
 * Tracks workflow progress through stages to ensure work flows to DONE
 *
 * See: .claude/plans/wip-limit-enforcement.md Part 4
 */

import { SDLCApiClient, createSDLCApiClient } from '../api/sdlc-api.client';

export interface StageEntry {
  reqNumber: string;
  stage: string;
  enteredAt: number;
  exitedAt?: number;
  durationMinutes?: number;
}

export interface StuckWork {
  reqNumber: string;
  title: string;
  stage: string;
  stuckMinutes: number;
  expectedMaxMinutes: number;
}

export interface StageMetrics {
  stage: string;
  currentCount: number;
  avgDurationMinutes: number;
  maxDurationMinutes: number;
  stuckCount: number;
}

export class StageTrackerService {
  private apiClient: SDLCApiClient | null = null;

  // In-memory stage tracking (persisted entries for current session)
  private stageEntries: Map<string, StageEntry> = new Map();

  // Historical data for metrics
  private completedEntries: StageEntry[] = [];

  // Stage timeout thresholds (minutes)
  private readonly STAGE_TIMEOUTS: Record<string, number> = {
    research: 120,     // 2 hours
    critique: 60,      // 1 hour
    backend: 240,      // 4 hours
    frontend: 240,     // 4 hours
    qa: 120,           // 2 hours
    statistics: 30     // 30 minutes
  };

  // Standard workflow stages in order
  private readonly WORKFLOW_STAGES = [
    'research',
    'critique',
    'backend',
    'frontend',
    'qa',
    'statistics'
  ];

  constructor() {
    this.apiClient = createSDLCApiClient();
  }

  /**
   * Record entry into a workflow stage
   */
  recordStageEntry(reqNumber: string, stage: string): void {
    const key = `${reqNumber}:${stage}`;

    // Exit any previous stage first
    this.exitAllStagesForReq(reqNumber);

    // Record new entry
    this.stageEntries.set(key, {
      reqNumber,
      stage,
      enteredAt: Date.now()
    });

    console.log(`[StageTracker] ${reqNumber} entered stage: ${stage}`);
  }

  /**
   * Record exit from a workflow stage
   */
  recordStageExit(reqNumber: string, stage: string): void {
    const key = `${reqNumber}:${stage}`;
    const entry = this.stageEntries.get(key);

    if (entry) {
      entry.exitedAt = Date.now();
      entry.durationMinutes = Math.round((entry.exitedAt - entry.enteredAt) / 1000 / 60);

      // Move to completed for metrics
      this.completedEntries.push({ ...entry });

      // Remove from active
      this.stageEntries.delete(key);

      console.log(`[StageTracker] ${reqNumber} exited stage: ${stage} (${entry.durationMinutes} min)`);
    }
  }

  /**
   * Exit all stages for a request (used when starting new stage)
   */
  private exitAllStagesForReq(reqNumber: string): void {
    for (const [key, entry] of this.stageEntries.entries()) {
      if (entry.reqNumber === reqNumber) {
        this.recordStageExit(reqNumber, entry.stage);
      }
    }
  }

  /**
   * Get the next stage in the workflow
   */
  getNextStage(currentStage: string): string | null {
    const currentIndex = this.WORKFLOW_STAGES.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex >= this.WORKFLOW_STAGES.length - 1) {
      return null; // No next stage or invalid stage
    }
    return this.WORKFLOW_STAGES[currentIndex + 1];
  }

  /**
   * Check for work stuck in stages
   */
  async checkForStuckWork(): Promise<StuckWork[]> {
    const stuck: StuckWork[] = [];
    const now = Date.now();

    for (const [key, entry] of this.stageEntries.entries()) {
      const timeout = this.STAGE_TIMEOUTS[entry.stage] || 120;
      const durationMinutes = Math.round((now - entry.enteredAt) / 1000 / 60);

      if (durationMinutes > timeout) {
        // Get title from API if available
        let title = entry.reqNumber;
        if (this.apiClient) {
          try {
            const req = await this.apiClient.getRequest(entry.reqNumber);
            if (req) {
              title = req.title;
            }
          } catch {
            // Use reqNumber as title
          }
        }

        stuck.push({
          reqNumber: entry.reqNumber,
          title,
          stage: entry.stage,
          stuckMinutes: durationMinutes,
          expectedMaxMinutes: timeout
        });
      }
    }

    return stuck;
  }

  /**
   * Get current stage for a request
   */
  getCurrentStage(reqNumber: string): string | null {
    for (const [key, entry] of this.stageEntries.entries()) {
      if (entry.reqNumber === reqNumber) {
        return entry.stage;
      }
    }
    return null;
  }

  /**
   * Get metrics for all stages
   */
  getStageMetrics(): StageMetrics[] {
    const metrics: StageMetrics[] = [];
    const now = Date.now();

    for (const stage of this.WORKFLOW_STAGES) {
      // Count currently in stage
      const currentInStage = Array.from(this.stageEntries.values())
        .filter(e => e.stage === stage);

      // Get completed entries for this stage
      const completedInStage = this.completedEntries
        .filter(e => e.stage === stage && e.durationMinutes !== undefined);

      // Calculate averages
      const avgDuration = completedInStage.length > 0
        ? completedInStage.reduce((sum, e) => sum + (e.durationMinutes || 0), 0) / completedInStage.length
        : 0;

      const maxDuration = completedInStage.length > 0
        ? Math.max(...completedInStage.map(e => e.durationMinutes || 0))
        : 0;

      // Count stuck
      const timeout = this.STAGE_TIMEOUTS[stage] || 120;
      const stuckCount = currentInStage.filter(e => {
        const durationMinutes = (now - e.enteredAt) / 1000 / 60;
        return durationMinutes > timeout;
      }).length;

      metrics.push({
        stage,
        currentCount: currentInStage.length,
        avgDurationMinutes: Math.round(avgDuration),
        maxDurationMinutes: Math.round(maxDuration),
        stuckCount
      });
    }

    return metrics;
  }

  /**
   * Get count of items in each stage
   */
  getStageCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const stage of this.WORKFLOW_STAGES) {
      counts[stage] = 0;
    }

    for (const entry of this.stageEntries.values()) {
      if (counts[entry.stage] !== undefined) {
        counts[entry.stage]++;
      }
    }

    return counts;
  }

  /**
   * Mark a workflow as complete (exited all stages)
   */
  markComplete(reqNumber: string): void {
    // Exit any remaining stages
    this.exitAllStagesForReq(reqNumber);
    console.log(`[StageTracker] ${reqNumber} marked complete`);
  }

  /**
   * Clear tracking for a request (e.g., cancelled)
   */
  clearTracking(reqNumber: string): void {
    for (const [key, entry] of this.stageEntries.entries()) {
      if (entry.reqNumber === reqNumber) {
        this.stageEntries.delete(key);
      }
    }
  }

  /**
   * Get summary stats for logging
   */
  getSummary(): string {
    const counts = this.getStageCounts();
    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

    const parts = this.WORKFLOW_STAGES
      .map(s => `${s}:${counts[s]}`)
      .join(' | ');

    return `[StageTracker] Active workflows: ${total} (${parts})`;
  }

  /**
   * Log current status
   */
  logStatus(): void {
    console.log(this.getSummary());

    // Check for stuck work
    this.checkForStuckWork().then(stuck => {
      if (stuck.length > 0) {
        console.log(`[StageTracker] WARNING: ${stuck.length} workflows stuck:`);
        for (const s of stuck) {
          console.log(`  - ${s.reqNumber} in ${s.stage} for ${s.stuckMinutes} min (max: ${s.expectedMaxMinutes})`);
        }
      }
    });
  }
}

// Export singleton instance
let instance: StageTrackerService | null = null;

export function getStageTrackerService(): StageTrackerService {
  if (!instance) {
    instance = new StageTrackerService();
  }
  return instance;
}
