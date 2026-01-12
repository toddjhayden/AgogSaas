/**
 * REQ Sync Service
 * Bridges OWNER_REQUESTS.md (agent workflow) to SDLC Control database
 *
 * This service syncs requests from the markdown file (used by Strategic Orchestrator
 * and agent workflows) to the database (used by SDLC Control GUI Kanban board).
 *
 * Key features:
 * - Parse OWNER_REQUESTS.md markdown format
 * - Upsert requests to owner_requests table
 * - Map markdown status to Kanban phases
 * - Preserve request history and comments
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSDLCDatabase, SDLCDatabaseService } from './sdlc-database.service';

// ============================================================================
// Types
// ============================================================================

export interface ParsedRequest {
  reqNumber: string;
  title: string;
  status: string;
  deferredReason?: string;
  owner: string;
  priority: string;
  businessValue: string;
  generatedBy?: string;
  generatedAt?: string;
  riceScore?: {
    reach: number;
    impact: number;
    confidence: number;
    effort: number;
    total: number;
  };
  requirements: string[];
  affectedFiles?: string[];
  successCriteria?: string[];
  rawContent: string;
}

export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

// ============================================================================
// Status to Phase Mapping
// ============================================================================

const STATUS_TO_PHASE: Record<string, string> = {
  'NEW': 'backlog',
  'PENDING': 'backlog',
  'DEFERRED': 'backlog',
  'APPROVED': 'ready',
  'IN_PROGRESS': 'in-progress',
  'BLOCKED': 'blocked',
  'ESCALATED': 'blocked',
  'IN_REVIEW': 'review',
  'TESTING': 'testing',
  'COMPLETE': 'done',
  'DONE': 'done',
  'CANCELLED': 'cancelled',
};

const PRIORITY_MAP: Record<string, string> = {
  'P0': 'critical',
  'P1': 'high',
  'P2': 'medium',
  'P3': 'low',
};

// ============================================================================
// Service
// ============================================================================

export class ReqSyncService {
  private db: SDLCDatabaseService;
  private ownerRequestsPath: string;

  constructor() {
    this.db = getSDLCDatabase();
    this.ownerRequestsPath = process.env.OWNER_REQUESTS_PATH ||
      path.resolve(__dirname, '..', '..', '..', '..', '..', 'project-spirit', 'owner_requests', 'OWNER_REQUESTS.md');
  }

  // ==========================================================================
  // Main Sync Operations
  // ==========================================================================

  /**
   * Full sync - parse markdown and update database
   */
  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      total: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: [],
    };

    try {
      // Parse markdown file
      const requests = await this.parseOwnerRequestsMd();
      result.total = requests.length;

      console.log(`[ReqSync] Parsed ${requests.length} requests from OWNER_REQUESTS.md`);

      // Sync each request to database
      for (const req of requests) {
        try {
          const syncStatus = await this.upsertRequest(req);
          if (syncStatus === 'created') result.created++;
          else if (syncStatus === 'updated') result.updated++;
          else result.unchanged++;
        } catch (error: any) {
          result.errors.push(`${req.reqNumber}: ${error.message}`);
        }
      }

      console.log(`[ReqSync] Sync complete: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged`);

    } catch (error: any) {
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }

  /**
   * Watch for changes and sync
   */
  startWatching(intervalMs: number = 30000): NodeJS.Timer {
    console.log(`[ReqSync] Starting file watcher (interval: ${intervalMs}ms)`);

    // Initial sync
    this.syncAll();

    // Watch for changes
    return setInterval(() => {
      this.syncAll();
    }, intervalMs);
  }

  // ==========================================================================
  // Parsing
  // ==========================================================================

  /**
   * Parse OWNER_REQUESTS.md into structured requests
   */
  async parseOwnerRequestsMd(): Promise<ParsedRequest[]> {
    if (!fs.existsSync(this.ownerRequestsPath)) {
      console.warn(`[ReqSync] OWNER_REQUESTS.md not found at: ${this.ownerRequestsPath}`);
      return [];
    }

    const content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');
    const requests: ParsedRequest[] = [];

    // Split by request headers (### REQ-...)
    const reqPattern = /### (REQ-[A-Z0-9-]+):\s*(.+?)(?=\n---|\n### REQ-|$)/gs;
    let match;

    while ((match = reqPattern.exec(content)) !== null) {
      const reqNumber = match[1];
      const section = match[0];

      try {
        const parsed = this.parseRequestSection(reqNumber, section);
        if (parsed) {
          requests.push(parsed);
        }
      } catch (error: any) {
        console.warn(`[ReqSync] Failed to parse ${reqNumber}: ${error.message}`);
      }
    }

    return requests;
  }

  /**
   * Parse a single request section
   */
  private parseRequestSection(reqNumber: string, section: string): ParsedRequest | null {
    // Extract title from header
    const titleMatch = section.match(/### REQ-[A-Z0-9-]+:\s*(.+)/);
    if (!titleMatch) return null;

    const title = titleMatch[1].trim();

    // Extract fields using regex patterns
    const status = this.extractField(section, 'Status') || 'NEW';
    const deferredReason = this.extractField(section, 'Deferred Reason');
    const owner = this.extractField(section, 'Owner') || 'unassigned';
    const priority = this.extractField(section, 'Priority') || 'P2';
    const businessValue = this.extractField(section, 'Business Value') || '';
    const generatedBy = this.extractField(section, 'Generated By');
    const generatedAt = this.extractField(section, 'Generated At');

    // Parse RICE score if present
    const riceScore = this.parseRiceScore(section);

    // Parse requirements list
    const requirements = this.parseListSection(section, 'Requirements');

    // Parse affected files
    const affectedFiles = this.parseListSection(section, 'Affected Files') ||
                         this.parseListSection(section, 'Affected Page');

    // Parse success criteria
    const successCriteria = this.parseListSection(section, 'Success Criteria');

    return {
      reqNumber,
      title,
      status,
      deferredReason,
      owner,
      priority,
      businessValue,
      generatedBy,
      generatedAt,
      riceScore,
      requirements,
      affectedFiles,
      successCriteria,
      rawContent: section,
    };
  }

  /**
   * Extract a single field value
   */
  private extractField(section: string, fieldName: string): string | undefined {
    const pattern = new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(.+?)(?=\\n\\*\\*|\\n\\n|$)`, 'i');
    const match = section.match(pattern);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Parse a list section (- item\n- item)
   */
  private parseListSection(section: string, sectionName: string): string[] {
    const pattern = new RegExp(`\\*\\*${sectionName}\\*\\*:\\s*\\n((?:[-*]\\s*.+\\n?)+)`, 'i');
    const match = section.match(pattern);

    if (!match) return [];

    return match[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }

  /**
   * Parse RICE score
   */
  private parseRiceScore(section: string): ParsedRequest['riceScore'] | undefined {
    const riceMatch = section.match(/\*\*RICE Score\*\*:\s*Reach:\s*(\d+)\s*\|\s*Impact:\s*(\d+)\s*\|\s*Confidence:\s*(\d+)\s*\|\s*Effort:\s*(\d+)\s*\|\s*\*\*Total:\s*([\d.]+)\*\*/i);

    if (!riceMatch) return undefined;

    return {
      reach: parseInt(riceMatch[1]),
      impact: parseInt(riceMatch[2]),
      confidence: parseInt(riceMatch[3]),
      effort: parseInt(riceMatch[4]),
      total: parseFloat(riceMatch[5]),
    };
  }

  // ==========================================================================
  // Database Operations
  // ==========================================================================

  /**
   * Upsert a request to the database
   */
  private async upsertRequest(req: ParsedRequest): Promise<'created' | 'updated' | 'unchanged'> {
    // Check if request exists
    const existing = await this.db.queryOne<any>(
      'SELECT id, title, current_phase, priority FROM owner_requests WHERE req_number = $1',
      [req.reqNumber]
    );

    const phase = STATUS_TO_PHASE[req.status.toUpperCase()] || 'backlog';
    const priority = PRIORITY_MAP[req.priority] || 'medium';

    // Determine request type from req number
    let requestType = 'feature';
    if (req.reqNumber.includes('-FIX-') || req.reqNumber.includes('-TS-FIX-')) {
      requestType = 'bugfix';
    } else if (req.reqNumber.includes('-STRATEGIC-')) {
      requestType = 'feature';
    } else if (req.reqNumber.includes('-TEST-')) {
      requestType = 'enhancement';
    } else if (req.reqNumber.includes('-I18N-')) {
      requestType = 'enhancement';
    }

    // Determine if blocked
    const isBlocked = req.status.toUpperCase() === 'BLOCKED' ||
                     req.status.toUpperCase() === 'ESCALATED' ||
                     req.status.toUpperCase() === 'DEFERRED';
    const blockedReason = isBlocked ? (req.deferredReason || req.status) : null;

    if (existing) {
      // Check if update needed
      const needsUpdate = existing.title !== req.title ||
                         existing.current_phase !== phase ||
                         existing.priority !== priority;

      if (!needsUpdate) {
        return 'unchanged';
      }

      // Update existing
      await this.db.query(`
        UPDATE owner_requests SET
          title = $1,
          description = $2,
          current_phase = $3,
          priority = $4,
          request_type = $5,
          source = $6,
          is_blocked = $7,
          blocked_reason = $8,
          tags = $9,
          updated_at = NOW()
        WHERE req_number = $10
      `, [
        req.title,
        req.businessValue,
        phase,
        priority,
        requestType,
        req.generatedBy || 'product_owner',
        isBlocked,
        blockedReason,
        req.requirements.slice(0, 5), // First 5 requirements as tags
        req.reqNumber,
      ]);

      return 'updated';

    } else {
      // Create new
      await this.db.query(`
        INSERT INTO owner_requests (
          req_number, title, description, request_type, priority,
          current_phase, source, is_blocked, blocked_reason, tags,
          created_by, created_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12
        )
      `, [
        req.reqNumber,
        req.title,
        req.businessValue,
        requestType,
        priority,
        phase,
        req.generatedBy || 'product_owner',
        isBlocked,
        blockedReason,
        req.requirements.slice(0, 5),
        req.generatedBy || 'system',
        req.generatedAt ? new Date(req.generatedAt) : new Date(),
      ]);

      return 'created';
    }
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    markdownCount: number;
    databaseCount: number;
    lastSyncAt: Date | null;
    outOfSync: string[];
  }> {
    const mdRequests = await this.parseOwnerRequestsMd();
    const dbResult = await this.db.queryOne<any>('SELECT COUNT(*) as count FROM owner_requests');

    // Find requests in markdown but not in database
    const mdNumbers = new Set(mdRequests.map(r => r.reqNumber));
    const dbRequests = await this.db.query<any>('SELECT req_number FROM owner_requests');
    const dbNumbers = new Set(dbRequests.map(r => r.req_number));

    const outOfSync: string[] = [];
    for (const num of mdNumbers) {
      if (!dbNumbers.has(num)) {
        outOfSync.push(`${num} (in MD, not in DB)`);
      }
    }
    for (const num of dbNumbers) {
      if (!mdNumbers.has(num)) {
        outOfSync.push(`${num} (in DB, not in MD)`);
      }
    }

    return {
      markdownCount: mdRequests.length,
      databaseCount: parseInt(dbResult?.count || '0'),
      lastSyncAt: new Date(), // Would track this in a metadata table
      outOfSync,
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: ReqSyncService | null = null;

export function getReqSyncService(): ReqSyncService {
  if (!instance) {
    instance = new ReqSyncService();
  }
  return instance;
}
