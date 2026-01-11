/**
 * Orphan Cleanup Service
 * Detects and recovers orphaned workflows (IN_PROGRESS with no agent activity)
 *
 * See: .claude/plans/wip-limit-enforcement.md Part 3
 */

import { SDLCApiClient, createSDLCApiClient } from '../api/sdlc-api.client';
import { getStageTrackerService } from './stage-tracker.service';

export interface OrphanedWorkflow {
  reqNumber: string;
  title: string;
  assignedTo: string | null;
  lastActivity: number | null;
  stuckDuration: number; // milliseconds
}

export class OrphanCleanupService {
  private apiClient: SDLCApiClient | null = null;
  private isRunning = false;

  // Threshold for considering a workflow orphaned (1 hour no activity)
  private readonly ORPHAN_THRESHOLD_MS = 60 * 60 * 1000;

  // Track known active workflows and their last activity
  private workflowActivity: Map<string, number> = new Map();

  constructor() {
    this.apiClient = createSDLCApiClient();
  }

  /**
   * Start the orphan cleanup daemon
   * Runs every 15 minutes to check for orphaned workflows
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[OrphanCleanup] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[OrphanCleanup] Starting orphan cleanup service');

    // Run immediately on start
    await this.runCleanupCycle();

    // Then run every 15 minutes
    setInterval(async () => {
      if (this.isRunning) {
        await this.runCleanupCycle();
      }
    }, 15 * 60 * 1000);
  }

  /**
   * Stop the orphan cleanup daemon
   */
  stop(): void {
    this.isRunning = false;
    console.log('[OrphanCleanup] Stopped');
  }

  /**
   * Update activity timestamp for a workflow
   * Called by orchestrator when workflow activity is detected
   */
  updateActivity(reqNumber: string): void {
    this.workflowActivity.set(reqNumber, Date.now());
  }

  /**
   * Run a single cleanup cycle
   */
  async runCleanupCycle(): Promise<void> {
    console.log('[OrphanCleanup] Running cleanup cycle...');

    try {
      const orphans = await this.detectOrphans();

      if (orphans.length === 0) {
        console.log('[OrphanCleanup] No orphaned workflows detected');
        return;
      }

      console.log(`[OrphanCleanup] Found ${orphans.length} orphaned workflows`);

      for (const orphan of orphans) {
        await this.recoverOrphan(orphan);
      }

      console.log(`[OrphanCleanup] Cleanup cycle complete - recovered ${orphans.length} workflows`);
    } catch (error: any) {
      console.error(`[OrphanCleanup] Cleanup cycle failed: ${error.message}`);
    }
  }

  /**
   * Detect orphaned workflows
   * An orphan is a workflow that:
   * - Is in IN_PROGRESS phase
   * - Has no assigned agent, OR
   * - Has no activity for ORPHAN_THRESHOLD_MS
   */
  async detectOrphans(): Promise<OrphanedWorkflow[]> {
    if (!this.apiClient) {
      console.error('[OrphanCleanup] No API client configured');
      return [];
    }

    const orphans: OrphanedWorkflow[] = [];

    try {
      // Get all IN_PROGRESS requests
      const requests = await this.apiClient.getRequests({ phase: 'in_progress' });

      for (const req of requests) {
        const isOrphan = await this.isOrphaned(req);

        if (isOrphan.orphaned) {
          orphans.push({
            reqNumber: req.reqNumber,
            title: req.title,
            assignedTo: req.assignedTo || null,
            lastActivity: this.workflowActivity.get(req.reqNumber) || null,
            stuckDuration: isOrphan.stuckDuration
          });
        }
      }
    } catch (error: any) {
      console.error(`[OrphanCleanup] Failed to detect orphans: ${error.message}`);
    }

    return orphans;
  }

  /**
   * Check if a specific request is orphaned
   */
  private async isOrphaned(req: { reqNumber: string; assignedTo?: string; updatedAt: string }): Promise<{ orphaned: boolean; stuckDuration: number }> {
    const now = Date.now();

    // Check 1: No agent assigned
    if (!req.assignedTo) {
      const updatedAt = new Date(req.updatedAt).getTime();
      const stuckDuration = now - updatedAt;

      // Only consider orphaned if stuck for threshold period
      if (stuckDuration > this.ORPHAN_THRESHOLD_MS) {
        return { orphaned: true, stuckDuration };
      }
    }

    // Check 2: No recent activity
    const lastActivity = this.workflowActivity.get(req.reqNumber);
    if (lastActivity) {
      const stuckDuration = now - lastActivity;
      if (stuckDuration > this.ORPHAN_THRESHOLD_MS) {
        return { orphaned: true, stuckDuration };
      }
    } else {
      // No tracked activity - use updatedAt from database
      const updatedAt = new Date(req.updatedAt).getTime();
      const stuckDuration = now - updatedAt;

      if (stuckDuration > this.ORPHAN_THRESHOLD_MS) {
        return { orphaned: true, stuckDuration };
      }
    }

    return { orphaned: false, stuckDuration: 0 };
  }

  /**
   * Recover an orphaned workflow by moving it back to backlog
   */
  private async recoverOrphan(orphan: OrphanedWorkflow): Promise<void> {
    if (!this.apiClient) {
      return;
    }

    const stuckMinutes = Math.round(orphan.stuckDuration / 1000 / 60);
    console.log(`[OrphanCleanup] Recovering orphan: ${orphan.reqNumber} (stuck ${stuckMinutes} min, assigned: ${orphan.assignedTo || 'none'})`);

    try {
      // Move back to backlog with cleared assignment
      await this.apiClient.updateRequestStatus(orphan.reqNumber, {
        phase: 'backlog',
        isBlocked: false,
        blockedReason: undefined,
        assignedTo: undefined
      });

      // Clear activity tracking
      this.workflowActivity.delete(orphan.reqNumber);

      // Clear stage tracking
      getStageTrackerService().clearTracking(orphan.reqNumber);

      console.log(`[OrphanCleanup] OK: ${orphan.reqNumber} -> backlog`);
    } catch (error: any) {
      console.error(`[OrphanCleanup] Failed to recover ${orphan.reqNumber}: ${error.message}`);
    }
  }

  /**
   * Get current orphan count (for monitoring)
   */
  async getOrphanCount(): Promise<number> {
    const orphans = await this.detectOrphans();
    return orphans.length;
  }

  /**
   * Manual cleanup trigger (for testing or admin use)
   */
  async manualCleanup(): Promise<{ recovered: number; failed: number }> {
    const orphans = await this.detectOrphans();
    let recovered = 0;
    let failed = 0;

    for (const orphan of orphans) {
      try {
        await this.recoverOrphan(orphan);
        recovered++;
      } catch {
        failed++;
      }
    }

    return { recovered, failed };
  }
}

// Export singleton instance
let instance: OrphanCleanupService | null = null;

export function getOrphanCleanupService(): OrphanCleanupService {
  if (!instance) {
    instance = new OrphanCleanupService();
  }
  return instance;
}
