/**
 * SDLC API Client
 * HTTP client for interacting with the cloud-hosted SDLC Control API
 *
 * Used by the Strategic Orchestrator when SDLC_API_URL is configured
 * to poll the cloud API instead of connecting directly to the database.
 */

export interface SDLCApiClientConfig {
  baseUrl: string;
  agentId?: string;
  timeout?: number;
}

export interface OwnerRequest {
  id: string;
  reqNumber: string;
  title: string;
  description?: string;
  requestType?: string;
  priority: string;
  primaryBu?: string;
  currentPhase: string;
  assignedTo?: string;
  isBlocked?: boolean;
  blockedReason?: string;
  tags?: string[];
  source?: string;
  sourceReference?: string;
  affectedBus?: string[];
  affectedEntities?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequestInput {
  reqNumber: string;
  title: string;
  description?: string;
  requestType?: string;
  priority?: string;
  primaryBu?: string;
  assignedTo?: string;
  tags?: string[];
  source?: string;
  sourceReference?: string;
  affectedBus?: string[];
  affectedEntities?: string[];
}

export interface UpdateStatusInput {
  phase?: string;
  isBlocked?: boolean;
  blockedReason?: string;
  assignedTo?: string;
}

export interface BlockerInfo {
  reqNumber: string;
  title: string;
  currentPhase: string;
  isBlocked: boolean;
  blockerCount: number;
  blockedBy: string[];
  blocking: string[];
}

export interface DeepestUnblockedRequest {
  reqNumber: string;
  title: string;
  priority: string;
  currentPhase: string;
  depth: number;
  blocksCount: number;
}

export interface WorkflowDirective {
  id: string;
  directiveType: string;
  displayName: string;
  targetType?: string;
  targetValue?: string;
  targetReqNumbers?: string[];
  filterCriteria?: Record<string, unknown>;
  expiresAt?: string;
  autoRestore: boolean;
  exclusive: boolean;
  totalItems: number;
  completedItems: number;
  createdBy: string;
  reason?: string;
  activatedAt: string;
}

export interface WorkflowStatus {
  hasActiveDirective: boolean;
  directive?: WorkflowDirective;
}

export interface BoardConfiguration {
  id: string;
  boardCode: string;
  boardName: string;
  description?: string;
  routingTags: string[];
  routingMode: 'any' | 'all';
  displayOrder: number;
  color: string;
  icon?: string;
  visibleToAgents: string[];
  managedByBu?: string;
  showAllPhases: boolean;
  allowedPhases: string[];
  autoAssignAgent?: string;
  status: 'draft' | 'published' | 'archived';
  boardVersion: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export interface Tag {
  tagName: string;
  description?: string;
  category: 'domain' | 'technology' | 'workflow' | 'priority' | 'other';
  color: string;
  usageCount: number;
  status: 'active' | 'deprecated' | 'archived';
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface BoardStats {
  boardCode: string;
  boardName: string;
  status: string;
  routingTags: string[];
  requestCount: number;
  backlogCount: number;
  inProgressCount: number;
  completedCount: number;
  blockedCount: number;
}

export interface TagStats {
  tagName: string;
  category: string;
  color: string;
  status: string;
  registryCount: number;
  actualUsageCount: number;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class SDLCApiClient {
  private baseUrl: string;
  private agentId: string;
  private timeout: number;

  constructor(config: SDLCApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.agentId = config.agentId || 'orchestrator';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Make an HTTP request to the API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': this.agentId,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      return data as ApiResponse<T>;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return { success: false, error: `Request timeout after ${this.timeout}ms` };
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Check API health
   */
  async healthCheck(): Promise<boolean> {
    const response = await this.request<any>('GET', '/api/agent/health');
    // API returns { database: true } or { database: 'connected' }
    const dbOk = response.data?.database === true || response.data?.database === 'connected';
    return response.success && dbOk;
  }

  /**
   * Get all owner requests (with optional filtering)
   */
  async getRequests(filters?: {
    phase?: string;
    priority?: string;
    assignedTo?: string;
    isBlocked?: boolean;
  }): Promise<OwnerRequest[]> {
    const params = new URLSearchParams();
    if (filters?.phase) params.set('phase', filters.phase);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.assignedTo) params.set('assignedTo', filters.assignedTo);
    if (filters?.isBlocked !== undefined) params.set('isBlocked', String(filters.isBlocked));

    const queryString = params.toString();
    const path = queryString ? `/api/agent/requests?${queryString}` : '/api/agent/requests';

    const response = await this.request<{ requests: OwnerRequest[] }>('GET', path);
    return response.data?.requests || [];
  }

  /**
   * Get actionable requests (backlog, research, review, approved, in_progress - not blocked)
   * Returns requests mapped to legacy status format for orchestrator compatibility
   */
  async getActionableRequests(): Promise<Array<{
    reqNumber: string;
    title: string;
    status: string;
    assignedTo: string | null;
    priority: string;
  }>> {
    const response = await this.request<{ requests: any[] }>('GET', '/api/agent/requests');

    if (!response.success || !response.data?.requests) {
      return [];
    }

    // Phase to status mapping (same as in strategic-orchestrator)
    const PHASE_TO_STATUS: Record<string, string> = {
      'backlog': 'NEW',
      'research': 'NEW',
      'review': 'PENDING',
      'approved': 'PENDING',
      'in_progress': 'IN_PROGRESS',
      'blocked': 'BLOCKED',
      'qa': 'IN_PROGRESS',
      'staging': 'IN_PROGRESS',
      'done': 'COMPLETE',
      'cancelled': 'CANCELLED',
    };

    return response.data.requests
      .filter(r =>
        ['backlog', 'research', 'review', 'approved', 'in_progress'].includes(r.currentPhase) &&
        !r.isBlocked
      )
      .map(r => ({
        reqNumber: r.reqNumber,
        title: r.title,
        status: PHASE_TO_STATUS[r.currentPhase] || 'NEW',
        assignedTo: r.assignedTo || null,
        priority: r.priority,
      }));
  }

  /**
   * Get a single request by reqNumber
   */
  async getRequest(reqNumber: string): Promise<OwnerRequest | null> {
    const response = await this.request<OwnerRequest>('GET', `/api/agent/requests/${reqNumber}`);
    return response.success ? response.data || null : null;
  }

  /**
   * Check if a request exists by reqNumber
   */
  async requestExists(reqNumber: string): Promise<boolean> {
    const response = await this.request<OwnerRequest>('GET', `/api/agent/requests/${reqNumber}`);
    return response.success && !!response.data;
  }

  /**
   * Check if a request with the given title already exists
   * Used to prevent duplicate recommendations for the same feature
   */
  async requestExistsByTitle(title: string): Promise<boolean> {
    const response = await this.request<{ exists: boolean }>('GET', `/api/agent/requests/by-title/${encodeURIComponent(title)}`);
    return response.success && response.data?.exists === true;
  }

  /**
   * Update request approval fields (for recommendations requiring approval)
   */
  async updateRequestApproval(reqNumber: string, updates: {
    requiresApproval?: boolean;
    approvalStatus?: string;
    recommendedByAgent?: string;
    rationale?: string;
    expectedBenefits?: string;
    impactLevel?: string;
  }): Promise<boolean> {
    const response = await this.request<any>(
      'PUT',
      `/api/agent/requests/${reqNumber}/approval`,
      updates
    );

    if (!response.success) {
      console.error(`[SDLCApiClient] Failed to update approval for ${reqNumber}: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Approve a request (moves to backlog and enters workflow)
   */
  async approveRequest(reqNumber: string, approvedBy: string, notes?: string): Promise<boolean> {
    const response = await this.request<any>(
      'POST',
      `/api/agent/requests/${reqNumber}/approve`,
      { approvedBy, notes }
    );

    if (!response.success) {
      console.error(`[SDLCApiClient] Failed to approve ${reqNumber}: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Reject a request
   */
  async rejectRequest(reqNumber: string, rejectedBy: string, reason: string): Promise<boolean> {
    const response = await this.request<any>(
      'POST',
      `/api/agent/requests/${reqNumber}/reject`,
      { rejectedBy, reason }
    );

    if (!response.success) {
      console.error(`[SDLCApiClient] Failed to reject ${reqNumber}: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Defer a request to a later date
   */
  async deferRequest(reqNumber: string, deferredBy: string, until: Date, reason: string): Promise<boolean> {
    const response = await this.request<any>(
      'POST',
      `/api/agent/requests/${reqNumber}/defer`,
      { deferredBy, until: until.toISOString(), reason }
    );

    if (!response.success) {
      console.error(`[SDLCApiClient] Failed to defer ${reqNumber}: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Create a new owner request
   */
  async createRequest(input: CreateRequestInput): Promise<OwnerRequest | null> {
    const response = await this.request<OwnerRequest>('POST', '/api/agent/requests', input);

    if (!response.success) {
      console.error(`[SDLCApiClient] Failed to create request: ${response.error}`);
      return null;
    }

    return response.data || null;
  }

  /**
   * Update request status/phase
   */
  async updateRequestStatus(
    reqNumber: string,
    updates: UpdateStatusInput
  ): Promise<boolean> {
    const response = await this.request<any>(
      'PUT',
      `/api/agent/requests/${reqNumber}/status`,
      updates
    );

    if (!response.success) {
      console.error(`[SDLCApiClient] Failed to update status for ${reqNumber}: ${response.error}`);
      return false;
    }

    return true;
  }

  /**
   * Update request phase (convenience method)
   * Maps legacy status codes to SDLC phases
   */
  async updateRequestPhase(
    reqNumber: string,
    legacyStatus: string,
    reason?: string
  ): Promise<boolean> {
    // Map legacy status to SDLC phase
    const STATUS_TO_PHASE: Record<string, string> = {
      'NEW': 'backlog',
      'PENDING': 'review',
      'IN_PROGRESS': 'in_progress',
      'BLOCKED': 'blocked',
      'COMPLETE': 'done',
      'CANCELLED': 'cancelled',
    };

    const phase = STATUS_TO_PHASE[legacyStatus] || 'backlog';
    const isBlocked = legacyStatus === 'BLOCKED';

    return this.updateRequestStatus(reqNumber, {
      phase,
      isBlocked,
      blockedReason: isBlocked ? reason : undefined,
    });
  }

  /**
   * Get kanban board data
   */
  async getKanbanData(): Promise<any> {
    const response = await this.request<any>('GET', '/api/agent/kanban');
    return response.success ? response.data : null;
  }

  /**
   * Get phase statistics
   */
  async getPhaseStats(): Promise<any> {
    const response = await this.request<any>('GET', '/api/agent/phase-stats');
    return response.success ? response.data : null;
  }

  /**
   * Get request statistics
   */
  async getRequestStats(): Promise<any> {
    const response = await this.request<any>('GET', '/api/agent/request-stats');
    return response.success ? response.data : null;
  }

  /**
   * Get recommendations (for approved recommendations polling)
   */
  async getRecommendations(filters?: {
    status?: string;
    convertedToRequestId?: boolean;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);

    const queryString = params.toString();
    const path = queryString ? `/api/agent/recommendations?${queryString}` : '/api/agent/recommendations';

    const response = await this.request<{ recommendations: any[] }>('GET', path);

    if (!response.success || !response.data?.recommendations) {
      return [];
    }

    // Filter for unconverted recommendations if requested
    let recommendations = response.data.recommendations;
    if (filters?.convertedToRequestId === false) {
      recommendations = recommendations.filter(r => !r.convertedToRequestId);
    }

    return recommendations;
  }

  /**
   * Create a new recommendation
   */
  async createRecommendation(input: {
    recNumber: string;
    title: string;
    description?: string;
    rationale?: string;
    expectedBenefits?: string;
    recommendedBy?: string;
    type?: string;
    urgency?: string;
    impactLevel?: string;
    affectedBus?: string[];
    sourceReq?: string;
  }): Promise<{ id: string; recNumber: string } | null> {
    const response = await this.request<{ id: string; recNumber: string }>(
      'POST',
      '/api/agent/recommendations',
      input
    );

    if (!response.success) {
      if (response.error?.includes('already exists')) {
        console.log(`[SDLCApiClient] Recommendation already exists: ${input.recNumber}`);
        return null;
      }
      console.error(`[SDLCApiClient] Failed to create recommendation: ${response.error}`);
      return null;
    }

    return response.data || null;
  }

  /**
   * Check if recommendation exists by recNumber
   */
  async recommendationExists(recNumber: string): Promise<boolean> {
    const recommendations = await this.getRecommendations();
    return recommendations.some(r => r.recNumber === recNumber);
  }

  /**
   * Update recommendation status
   */
  async updateRecommendationStatus(
    id: string,
    status: string,
    reviewedBy?: string,
    convertedToRequestId?: string
  ): Promise<boolean> {
    const response = await this.request<any>(
      'PUT',
      `/api/agent/recommendations/${id}/status`,
      { status, reviewedBy, convertedToRequestId }
    );
    return response.success;
  }

  // =========================================================================
  // Request Blocker Methods (Many-to-Many Blocking Relationships)
  // =========================================================================

  /**
   * Add a blocking relationship between requests
   * @param blockedReqNumber - The request that is blocked
   * @param blockingReqNumber - The request that is blocking it
   * @param reason - Optional reason for the block
   */
  async addBlocker(
    blockedReqNumber: string,
    blockingReqNumber: string,
    reason?: string
  ): Promise<{ blockerId: string } | null> {
    const response = await this.request<{ blockerId: string }>(
      'POST',
      '/api/agent/blockers',
      { blockedReqNumber, blockingReqNumber, reason }
    );

    if (!response.success) {
      console.error(`[SDLCApiClient] Failed to add blocker: ${response.error}`);
      return null;
    }

    return response.data || null;
  }

  /**
   * Get blockers for a specific request
   */
  async getBlockers(reqNumber: string): Promise<BlockerInfo | null> {
    const response = await this.request<BlockerInfo>(
      'GET',
      `/api/agent/blockers/${reqNumber}`
    );

    if (!response.success) {
      if (!response.error?.includes('not found')) {
        console.error(`[SDLCApiClient] Failed to get blockers: ${response.error}`);
      }
      return null;
    }

    return response.data || null;
  }

  /**
   * Resolve blockers when a request completes
   * Called automatically when request moves to 'done' phase
   */
  async resolveBlockers(reqNumber: string): Promise<number> {
    const response = await this.request<{ resolvedCount: number }>(
      'POST',
      `/api/agent/blockers/resolve/${reqNumber}`
    );

    if (!response.success) {
      console.error(`[SDLCApiClient] Failed to resolve blockers: ${response.error}`);
      return 0;
    }

    return response.data?.resolvedCount || 0;
  }

  /**
   * Get deepest unblocked requests for orchestrator prioritization
   * Returns requests that:
   * - Are not blocked themselves
   * - Block other requests (so completing them unblocks others)
   * - Prioritized by how many requests they unblock
   */
  async getDeepestUnblocked(limit: number = 10): Promise<DeepestUnblockedRequest[]> {
    const response = await this.request<{ requests: DeepestUnblockedRequest[] }>(
      'GET',
      `/api/agent/deepest-unblocked?limit=${limit}`
    );

    if (!response.success) {
      console.error(`[SDLCApiClient] Failed to get deepest unblocked: ${response.error}`);
      return [];
    }

    return response.data?.requests || [];
  }

  /**
   * Remove a specific blocking relationship
   */
  async removeBlocker(
    blockedReqNumber: string,
    blockingReqNumber: string
  ): Promise<boolean> {
    const response = await this.request<{ removed: boolean }>(
      'DELETE',
      `/api/agent/blockers/${blockedReqNumber}/${blockingReqNumber}`
    );

    if (!response.success) {
      console.error(`[SDLCApiClient] Failed to remove blocker: ${response.error}`);
      return false;
    }

    return response.data?.removed || false;
  }

  /**
   * Helper: Mark a request as blocked by another and create the blocking relationship
   * Convenience method that combines addBlocker + updateRequestStatus
   */
  async blockRequestBy(
    blockedReqNumber: string,
    blockingReqNumber: string,
    reason?: string
  ): Promise<boolean> {
    // Add the blocker relationship (this also marks the request as blocked)
    const result = await this.addBlocker(blockedReqNumber, blockingReqNumber, reason);
    return result !== null;
  }

  // =========================================================================
  // Workflow Directive Methods
  // =========================================================================

  /**
   * Get the current active workflow directive (if any)
   * Used by orchestrator to filter work queue when in focus mode
   */
  async getWorkflowStatus(): Promise<WorkflowStatus> {
    const response = await this.request<WorkflowStatus>(
      'GET',
      '/api/workflow/status'
    );

    if (!response.success || !response.data) {
      return { hasActiveDirective: false };
    }

    return response.data;
  }

  /**
   * Check if a specific request is in scope of the active directive
   * Returns true if no directive is active or if the request is in scope
   */
  async isReqInScope(reqNumber: string): Promise<boolean> {
    const response = await this.request<{ inScope: boolean }>(
      'GET',
      `/api/workflow/in-scope/${reqNumber}`
    );

    // Default to true if we can't determine (fail open)
    if (!response.success) {
      return true;
    }

    return response.data?.inScope ?? true;
  }

  /**
   * Update directive progress (items completed)
   */
  async updateDirectiveProgress(directiveId: string, completedItems: number): Promise<boolean> {
    const response = await this.request<any>(
      'PUT',
      `/api/workflow/directive/${directiveId}/progress`,
      { completedItems }
    );

    return response.success;
  }

  // =========================================================================
  // Board Configuration Methods (REQ-SDLC-1767972294)
  // =========================================================================

  /**
   * Get all published boards
   */
  async getBoards(): Promise<BoardConfiguration[]> {
    const response = await this.request<{ boards: BoardConfiguration[] }>(
      'GET',
      '/api/agent/boards'
    );

    return response.data?.boards || [];
  }

  /**
   * Get a specific board by code
   */
  async getBoard(boardCode: string): Promise<BoardConfiguration | null> {
    const response = await this.request<{ board: BoardConfiguration }>(
      'GET',
      `/api/agent/boards/${boardCode}`
    );

    return response.data?.board || null;
  }

  /**
   * Get requests for a specific board
   */
  async getBoardRequests(boardCode: string): Promise<OwnerRequest[]> {
    const response = await this.request<{ requests: OwnerRequest[]; board: BoardConfiguration }>(
      'GET',
      `/api/agent/boards/${boardCode}/requests`
    );

    return response.data?.requests || [];
  }

  /**
   * Create a new board (draft status)
   */
  async createBoard(board: {
    boardCode: string;
    boardName: string;
    description?: string;
    routingTags?: string[];
    routingMode?: 'any' | 'all';
    displayOrder?: number;
    color?: string;
    icon?: string;
    visibleToAgents?: string[];
    managedByBu?: string;
    showAllPhases?: boolean;
    allowedPhases?: string[];
    autoAssignAgent?: string;
    createdBy?: string;
  }): Promise<boolean> {
    const response = await this.request<{ boardCode: string; status: string }>(
      'POST',
      '/api/agent/boards',
      board
    );

    return response.success;
  }

  /**
   * Publish a board (move from draft to published)
   */
  async publishBoard(boardCode: string, publishedBy?: string): Promise<boolean> {
    const response = await this.request<any>(
      'POST',
      `/api/agent/boards/${boardCode}/publish`,
      { publishedBy }
    );

    return response.success;
  }

  /**
   * Archive a board
   */
  async archiveBoard(boardCode: string, archivedBy?: string): Promise<boolean> {
    const response = await this.request<any>(
      'POST',
      `/api/agent/boards/${boardCode}/archive`,
      { archivedBy }
    );

    return response.success;
  }

  /**
   * Get board statistics
   */
  async getBoardStats(): Promise<BoardStats[]> {
    const response = await this.request<{ stats: BoardStats[] }>(
      'GET',
      '/api/agent/boards/stats'
    );

    return response.data?.stats || [];
  }

  // =========================================================================
  // Tag Management Methods (REQ-SDLC-1767972294)
  // =========================================================================

  /**
   * Get all active tags
   */
  async getTags(category?: string, status?: string): Promise<Tag[]> {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (status) params.set('status', status);

    const path = `/api/agent/tags${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.request<{ tags: Tag[] }>('GET', path);

    return response.data?.tags || [];
  }

  /**
   * Get tag usage statistics
   */
  async getTagStats(): Promise<TagStats[]> {
    const response = await this.request<{ stats: TagStats[] }>(
      'GET',
      '/api/agent/tags/stats'
    );

    return response.data?.stats || [];
  }

  /**
   * Create a new tag
   */
  async createTag(tag: {
    tagName: string;
    description?: string;
    category?: string;
    color?: string;
    requiresApproval?: boolean;
    createdBy?: string;
  }): Promise<boolean> {
    const response = await this.request<{ tagName: string }>(
      'POST',
      '/api/agent/tags',
      tag
    );

    return response.success;
  }

  /**
   * Approve a tag
   */
  async approveTag(tagName: string, approvedBy?: string): Promise<boolean> {
    const response = await this.request<any>(
      'POST',
      `/api/agent/tags/${tagName}/approve`,
      { approvedBy }
    );

    return response.success;
  }

  /**
   * Update tags on a request
   */
  async updateRequestTags(reqNumber: string, tags: string[]): Promise<boolean> {
    const response = await this.request<{ reqNumber: string; tags: string[] }>(
      'PUT',
      `/api/agent/requests/${reqNumber}/tags`,
      { tags }
    );

    return response.success;
  }

  /**
   * Update tags on a recommendation
   */
  async updateRecommendationTags(recNumber: string, tags: string[]): Promise<boolean> {
    const response = await this.request<{ recNumber: string; tags: string[] }>(
      'PUT',
      `/api/agent/recommendations/${recNumber}/tags`,
      { tags }
    );

    return response.success;
  }
}

/**
 * Factory function to create an SDLCApiClient from environment variables
 */
export function createSDLCApiClient(): SDLCApiClient | null {
  const apiUrl = process.env.SDLC_API_URL;

  if (!apiUrl) {
    return null;
  }

  return new SDLCApiClient({
    baseUrl: apiUrl,
    agentId: process.env.SDLC_AGENT_ID || 'orchestrator',
    timeout: parseInt(process.env.SDLC_API_TIMEOUT || '30000', 10),
  });
}
