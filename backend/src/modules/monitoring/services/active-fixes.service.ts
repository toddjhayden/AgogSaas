import * as fs from 'fs/promises';
import * as path from 'path';

export interface ActiveFix {
  reqNumber: string;
  title: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'REQUESTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETE' | 'CANCELLED';
  owner: string;
  requestedAt: Date;
  estimatedCompletion?: Date;
  description?: string;
  blockers?: string[];
  notes?: string;
}

export interface ActiveFixQueryOptions {
  owner?: string;
  status?: string;
  priority?: string;
}

export class ActiveFixesService {
  private ownerRequestsPath: string;
  private fixes: Map<string, ActiveFix> = new Map();
  private lastParsed: Date = new Date(0);

  constructor() {
    this.ownerRequestsPath = path.join(process.cwd(), 'OWNER_REQUESTS.md');
    this.parseOwnerRequests();

    // Re-parse every 30 seconds to catch updates
    setInterval(() => this.parseOwnerRequests(), 30000);
  }

  /**
   * Parse OWNER_REQUESTS.md file
   */
  private async parseOwnerRequests(): Promise<void> {
    try {
      const content = await fs.readFile(this.ownerRequestsPath, 'utf-8');
      const lines = content.split('\n');

      let currentSection = '';
      let currentFix: Partial<ActiveFix> | null = null;

      for (const line of lines) {
        // Detect section headers
        if (line.startsWith('## ')) {
          currentSection = line.substring(3).trim();
        }

        // Detect request entries (e.g., "### REQ-008: Title")
        const reqMatch = line.match(/^### (REQ-\d+): (.+)$/);
        if (reqMatch) {
          // Save previous fix if exists
          if (currentFix && currentFix.reqNumber) {
            this.fixes.set(currentFix.reqNumber, currentFix as ActiveFix);
          }

          // Start new fix
          currentFix = {
            reqNumber: reqMatch[1],
            title: reqMatch[2],
            priority: this.inferPriority(currentSection),
            status: this.inferStatus(currentSection),
            owner: 'unknown',
            requestedAt: new Date(),
          };
        }

        // Parse fix details
        if (currentFix && line.startsWith('- **')) {
          const fieldMatch = line.match(/^- \*\*(.+?):\*\* (.+)$/);
          if (fieldMatch) {
            const [, field, value] = fieldMatch;

            switch (field.toLowerCase()) {
              case 'owner':
              case 'assigned to':
                currentFix.owner = value.toLowerCase();
                break;
              case 'priority':
                currentFix.priority = value.toUpperCase() as any;
                break;
              case 'status':
                currentFix.status = value.toUpperCase().replace(/ /g, '_') as any;
                break;
              case 'requested':
                currentFix.requestedAt = new Date(value);
                break;
              case 'est. completion':
              case 'estimated completion':
                currentFix.estimatedCompletion = new Date(value);
                break;
              case 'description':
                currentFix.description = value;
                break;
              case 'notes':
                currentFix.notes = value;
                break;
              case 'blockers':
                currentFix.blockers = value.split(',').map((b) => b.trim());
                break;
            }
          }
        }

        // Multi-line description
        if (currentFix && line.trim() && !line.startsWith('#') && !line.startsWith('-')) {
          if (!currentFix.description) {
            currentFix.description = line.trim();
          } else {
            currentFix.description += ' ' + line.trim();
          }
        }
      }

      // Save last fix
      if (currentFix && currentFix.reqNumber) {
        this.fixes.set(currentFix.reqNumber, currentFix as ActiveFix);
      }

      this.lastParsed = new Date();
      console.log(`[ActiveFixes] Parsed ${this.fixes.size} fixes from OWNER_REQUESTS.md`);
    } catch (error) {
      console.error('[ActiveFixes] Failed to parse OWNER_REQUESTS.md:', error);
    }
  }

  /**
   * Infer priority from section name
   */
  private inferPriority(section: string): ActiveFix['priority'] {
    const lower = section.toLowerCase();
    if (lower.includes('critical') || lower.includes('urgent')) return 'CRITICAL';
    if (lower.includes('high')) return 'HIGH';
    if (lower.includes('low')) return 'LOW';
    return 'MEDIUM';
  }

  /**
   * Infer status from section name
   */
  private inferStatus(section: string): ActiveFix['status'] {
    const lower = section.toLowerCase();
    if (lower.includes('complete') || lower.includes('done')) return 'COMPLETE';
    if (lower.includes('blocked')) return 'BLOCKED';
    if (lower.includes('in progress') || lower.includes('active')) return 'IN_PROGRESS';
    if (lower.includes('cancelled')) return 'CANCELLED';
    return 'REQUESTED';
  }

  /**
   * Get active fixes with filtering
   */
  async getActiveFixes(options: ActiveFixQueryOptions): Promise<ActiveFix[]> {
    const fixes = Array.from(this.fixes.values());

    return fixes.filter((fix) => {
      if (options.owner && fix.owner.toLowerCase() !== options.owner.toLowerCase()) {
        return false;
      }

      if (options.status && fix.status !== options.status) {
        return false;
      }

      if (options.priority && fix.priority !== options.priority) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get fix by request number
   */
  async getFixByReqNumber(reqNumber: string): Promise<ActiveFix | null> {
    return this.fixes.get(reqNumber) || null;
  }

  /**
   * Force re-parse of OWNER_REQUESTS.md
   */
  async refresh(): Promise<void> {
    await this.parseOwnerRequests();
  }
}
