/**
 * Phase Manager Service
 * Manages SDLC Kanban phases and transitions
 *
 * Key features:
 * - Get available phases
 * - Validate phase transitions
 * - Track request phase history
 * - Enforce WIP limits
 * - Handle approval workflows
 */

import { getSDLCDatabase, SDLCDatabaseService } from './sdlc-database.service';

// ============================================================================
// Types
// ============================================================================

export interface SDLCPhase {
  id: string;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  phaseType: 'queue' | 'active' | 'gate' | 'waiting' | 'terminal';
  wipLimit: number | null;
  allowedNextPhases: string[];
  requiresApproval: boolean;
  autoAssignOnEnter: boolean;
  isActive: boolean;
  isTerminal: boolean;
  color: string;
  icon: string | null;
}

export interface PhaseTransition {
  id: string;
  fromPhase: string;
  toPhase: string;
  requiresApproval: boolean;
  approvalRoles: string[];
  autoTransitionOn: string | null;
  notifyOnTransition: boolean;
  notificationTemplate: string | null;
}

export interface TransitionValidation {
  isValid: boolean;
  requiresApproval: boolean;
  reason: string;
  blockedBy?: string;
}

export interface PhaseStats {
  phaseCode: string;
  phaseName: string;
  currentCount: number;
  wipLimit: number | null;
  isAtCapacity: boolean;
}

// ============================================================================
// Service
// ============================================================================

export class PhaseManagerService {
  private db: SDLCDatabaseService;

  constructor() {
    this.db = getSDLCDatabase();
  }

  // ==========================================================================
  // Phase Operations
  // ==========================================================================

  /**
   * Get all active phases
   */
  async getAllPhases(): Promise<SDLCPhase[]> {
    const query = `
      SELECT * FROM sdlc_phases
      WHERE is_active = TRUE
      ORDER BY display_order
    `;
    const results = await this.db.query<any>(query);
    return results.map(this.mapPhaseRow);
  }

  /**
   * Get phase by code
   */
  async getPhase(code: string): Promise<SDLCPhase | null> {
    const query = 'SELECT * FROM sdlc_phases WHERE code = $1';
    const result = await this.db.queryOne<any>(query, [code]);
    return result ? this.mapPhaseRow(result) : null;
  }

  /**
   * Get phases by type
   */
  async getPhasesByType(phaseType: SDLCPhase['phaseType']): Promise<SDLCPhase[]> {
    const query = `
      SELECT * FROM sdlc_phases
      WHERE phase_type = $1 AND is_active = TRUE
      ORDER BY display_order
    `;
    const results = await this.db.query<any>(query, [phaseType]);
    return results.map(this.mapPhaseRow);
  }

  /**
   * Get terminal phases (done, cancelled)
   */
  async getTerminalPhases(): Promise<SDLCPhase[]> {
    const query = `
      SELECT * FROM sdlc_phases
      WHERE is_terminal = TRUE AND is_active = TRUE
      ORDER BY display_order
    `;
    const results = await this.db.query<any>(query);
    return results.map(this.mapPhaseRow);
  }

  /**
   * Get allowed next phases from a given phase
   */
  async getAllowedTransitions(fromPhase: string): Promise<PhaseTransition[]> {
    const query = `
      SELECT * FROM phase_transitions
      WHERE from_phase = $1
      ORDER BY to_phase
    `;
    const results = await this.db.query<any>(query, [fromPhase]);
    return results.map(this.mapTransitionRow);
  }

  // ==========================================================================
  // Transition Validation
  // ==========================================================================

  /**
   * Validate if a transition is allowed
   */
  async validateTransition(
    fromPhase: string,
    toPhase: string,
    requestId?: string
  ): Promise<TransitionValidation> {
    // Get source phase
    const source = await this.getPhase(fromPhase);
    if (!source) {
      return {
        isValid: false,
        requiresApproval: false,
        reason: `Source phase not found: ${fromPhase}`,
      };
    }

    // Check if source is terminal
    if (source.isTerminal) {
      return {
        isValid: false,
        requiresApproval: false,
        reason: `Cannot transition from terminal phase: ${fromPhase}`,
      };
    }

    // Get target phase
    const target = await this.getPhase(toPhase);
    if (!target) {
      return {
        isValid: false,
        requiresApproval: false,
        reason: `Target phase not found: ${toPhase}`,
      };
    }

    // Check if transition exists
    const query = `
      SELECT * FROM phase_transitions
      WHERE from_phase = $1 AND to_phase = $2
    `;
    const transition = await this.db.queryOne<any>(query, [fromPhase, toPhase]);

    if (!transition) {
      return {
        isValid: false,
        requiresApproval: false,
        reason: `Transition from ${fromPhase} to ${toPhase} is not allowed`,
      };
    }

    // Check WIP limit on target phase
    if (target.wipLimit) {
      const currentCount = await this.getPhaseCount(toPhase);
      if (currentCount >= target.wipLimit) {
        return {
          isValid: false,
          requiresApproval: false,
          reason: `Target phase ${toPhase} is at WIP limit (${currentCount}/${target.wipLimit})`,
          blockedBy: 'wip_limit',
        };
      }
    }

    // Transition is valid
    return {
      isValid: true,
      requiresApproval: transition.requires_approval,
      reason: transition.requires_approval
        ? `Transition to ${toPhase} requires approval`
        : `Transition to ${toPhase} is allowed`,
    };
  }

  /**
   * Get current count of requests in a phase
   */
  async getPhaseCount(phaseCode: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM owner_requests
      WHERE current_phase = $1
    `;
    const result = await this.db.queryOne<any>(query, [phaseCode]);
    return parseInt(result?.count || '0');
  }

  /**
   * Get phase statistics
   */
  async getPhaseStats(): Promise<PhaseStats[]> {
    const query = `
      SELECT
        p.code as phase_code,
        p.name as phase_name,
        p.wip_limit,
        COUNT(r.id) as current_count
      FROM sdlc_phases p
      LEFT JOIN owner_requests r ON r.current_phase = p.code
      WHERE p.is_active = TRUE
      GROUP BY p.id, p.code, p.name, p.wip_limit, p.display_order
      ORDER BY p.display_order
    `;

    const results = await this.db.query<any>(query);
    return results.map((row) => ({
      phaseCode: row.phase_code,
      phaseName: row.phase_name,
      currentCount: parseInt(row.current_count || '0'),
      wipLimit: row.wip_limit,
      isAtCapacity: row.wip_limit ? parseInt(row.current_count) >= row.wip_limit : false,
    }));
  }

  // ==========================================================================
  // Kanban Board Data
  // ==========================================================================

  /**
   * Get Kanban board view with requests grouped by phase
   */
  async getKanbanBoard(): Promise<
    Map<
      string,
      {
        phase: SDLCPhase;
        requests: any[];
        stats: PhaseStats;
      }
    >
  > {
    const phases = await this.getAllPhases();
    const stats = await this.getPhaseStats();
    const statsMap = new Map(stats.map((s) => [s.phaseCode, s]));

    const board = new Map<
      string,
      {
        phase: SDLCPhase;
        requests: any[];
        stats: PhaseStats;
      }
    >();

    for (const phase of phases) {
      // Get requests in this phase
      const query = `
        SELECT
          r.*,
          bu.name as bu_name
        FROM owner_requests r
        LEFT JOIN business_units bu ON bu.code = r.primary_bu
        WHERE r.current_phase = $1
        ORDER BY r.priority DESC, r.created_at ASC
      `;
      const requests = await this.db.query<any>(query, [phase.code]);

      board.set(phase.code, {
        phase,
        requests,
        stats: statsMap.get(phase.code) || {
          phaseCode: phase.code,
          phaseName: phase.name,
          currentCount: 0,
          wipLimit: phase.wipLimit,
          isAtCapacity: false,
        },
      });
    }

    return board;
  }

  // ==========================================================================
  // Phase Workflow
  // ==========================================================================

  /**
   * Get the default initial phase
   */
  async getInitialPhase(): Promise<SDLCPhase | null> {
    const phases = await this.getAllPhases();
    return phases.length > 0 ? phases[0] : null;
  }

  /**
   * Get the workflow path for a request type
   */
  async getWorkflowPath(
    fromPhase: string,
    toPhase: string
  ): Promise<{ phases: string[]; transitions: PhaseTransition[] } | null> {
    // BFS to find shortest path
    const visited = new Set<string>();
    const queue: { phase: string; path: string[]; transitions: PhaseTransition[] }[] = [
      { phase: fromPhase, path: [fromPhase], transitions: [] },
    ];

    while (queue.length > 0) {
      const { phase, path, transitions } = queue.shift()!;

      if (phase === toPhase) {
        return { phases: path, transitions };
      }

      if (visited.has(phase)) continue;
      visited.add(phase);

      const nextTransitions = await this.getAllowedTransitions(phase);
      for (const trans of nextTransitions) {
        if (!visited.has(trans.toPhase)) {
          queue.push({
            phase: trans.toPhase,
            path: [...path, trans.toPhase],
            transitions: [...transitions, trans],
          });
        }
      }
    }

    return null; // No path found
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private mapPhaseRow(row: any): SDLCPhase {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      displayOrder: row.display_order,
      phaseType: row.phase_type,
      wipLimit: row.wip_limit,
      allowedNextPhases: row.allowed_next_phases || [],
      requiresApproval: row.requires_approval,
      autoAssignOnEnter: row.auto_assign_on_enter,
      isActive: row.is_active,
      isTerminal: row.is_terminal,
      color: row.color,
      icon: row.icon,
    };
  }

  private mapTransitionRow(row: any): PhaseTransition {
    return {
      id: row.id,
      fromPhase: row.from_phase,
      toPhase: row.to_phase,
      requiresApproval: row.requires_approval,
      approvalRoles: row.approval_roles || [],
      autoTransitionOn: row.auto_transition_on,
      notifyOnTransition: row.notify_on_transition,
      notificationTemplate: row.notification_template,
    };
  }
}
