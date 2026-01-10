/**
 * SDLC Control API Client
 * Communicates with the SDLC Control REST API
 */

import type {
  ApiResponse,
  SDLCHealthStatus,
  EntityRegistryEntry,
  EntityDependency,
  ExecutionPlan,
  GeneratedDiagram,
  DiagramType,
  KanbanColumn,
} from '@/types';
import { useSDLCSettingsStore } from '@/stores/useSDLCSettingsStore';

// Get API base URL from settings store (falls back to env var or default)
function getApiBase(): string {
  const storeUrl = useSDLCSettingsStore.getState().apiUrl;
  // The store URL is the full API URL (e.g., https://api.agog.fyi/api)
  // For agent endpoints, we need to append /agent
  return storeUrl ? `${storeUrl}/agent` : (import.meta.env.VITE_API_URL || '/api/agent');
}

// Note: Legacy API_BASE constant removed - now using getApiBase() for dynamic URL from settings

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const apiBase = getApiBase();
    const response = await fetch(`${apiBase}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': 'sdlc-gui',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// =============================================================================
// Health
// =============================================================================

export async function getHealth(): Promise<ApiResponse<SDLCHealthStatus>> {
  return fetchApi<SDLCHealthStatus>('/health');
}

// =============================================================================
// Version
// =============================================================================

export interface VersionInfo {
  api: {
    version: string;
    commit: string;
    buildDate: string;
    revision: string;
  };
  database: {
    version: string;
    migrationsApplied: string;
  };
}

export async function getVersion(): Promise<ApiResponse<VersionInfo>> {
  return fetchApi<VersionInfo>('/version');
}

// =============================================================================
// Entity Registry
// =============================================================================

export async function registerEntity(
  entity: Omit<EntityRegistryEntry, 'id' | 'createdAt'>
): Promise<ApiResponse<EntityRegistryEntry>> {
  return fetchApi<EntityRegistryEntry>('/entity/register', {
    method: 'POST',
    body: JSON.stringify(entity),
  });
}

// =============================================================================
// Dependencies
// =============================================================================

export async function addDependency(
  dependency: Omit<EntityDependency, 'id'>
): Promise<ApiResponse<EntityDependency>> {
  return fetchApi<EntityDependency>('/dependency/add', {
    method: 'POST',
    body: JSON.stringify(dependency),
  });
}

export async function getDependencyGraph(): Promise<
  ApiResponse<{ nodes: EntityRegistryEntry[]; edges: EntityDependency[] }>
> {
  return fetchApi('/dependency-graph');
}

export async function detectCycles(): Promise<
  ApiResponse<{ hasCycles: boolean; cycles: string[][] }>
> {
  return fetchApi('/cycles');
}

// =============================================================================
// Execution Order
// =============================================================================

export async function getExecutionOrder(
  entities: string[]
): Promise<ApiResponse<ExecutionPlan>> {
  return fetchApi<ExecutionPlan>('/execution-order', {
    method: 'POST',
    body: JSON.stringify({ entities }),
  });
}

// =============================================================================
// Impact Analysis
// =============================================================================

export async function analyzeImpact(
  entityName: string
): Promise<ApiResponse<{ entity: string; dependents: string[]; crossBuImpacts: string[] }>> {
  return fetchApi(`/impact/${encodeURIComponent(entityName)}`);
}

export async function getCrossBuMatrix(): Promise<
  ApiResponse<Record<string, Record<string, number>>>
> {
  return fetchApi('/cross-bu-matrix');
}

// =============================================================================
// Column Validation
// =============================================================================

export async function validateColumn(
  column: {
    name: string;
    table: string;
    semanticType: string;
    dataType: string;
    referencesTable?: string;
  },
  requestingBu: string
): Promise<ApiResponse<{ isValid: boolean; reason?: string }>> {
  return fetchApi('/column/validate', {
    method: 'POST',
    body: JSON.stringify({ column, requestingBu }),
  });
}

export async function getColumnStats(): Promise<
  ApiResponse<{ total: number; byType: Record<string, number>; byBu: Record<string, number> }>
> {
  return fetchApi('/column-stats');
}

// =============================================================================
// Migration Validation
// =============================================================================

export async function validateMigration(
  sql: string,
  requestingBu: string
): Promise<ApiResponse<{ isValid: boolean; errors: string[]; warnings: string[] }>> {
  return fetchApi('/migration/validate', {
    method: 'POST',
    body: JSON.stringify({ sql, requestingBu }),
  });
}

// =============================================================================
// Kanban Board
// =============================================================================

export async function getKanbanBoard(): Promise<
  ApiResponse<{ columns: KanbanColumn[] }>
> {
  return fetchApi('/kanban');
}

// =============================================================================
// Phase Transitions
// =============================================================================

export async function validateTransition(
  fromPhase: string,
  toPhase: string,
  requestId?: string
): Promise<ApiResponse<{ isValid: boolean; reason?: string }>> {
  return fetchApi('/transition/validate', {
    method: 'POST',
    body: JSON.stringify({ fromPhase, toPhase, requestId }),
  });
}

export async function getPhaseStats(): Promise<
  ApiResponse<{ phases: { code: string; name: string; count: number; wipLimit?: number }[] }>
> {
  return fetchApi('/phase-stats');
}

// =============================================================================
// Diagrams
// =============================================================================

export async function generateDiagram(
  type: DiagramType,
  scope?: string
): Promise<ApiResponse<GeneratedDiagram>> {
  return fetchApi<GeneratedDiagram>('/diagrams/generate', {
    method: 'POST',
    body: JSON.stringify({ type, scope }),
  });
}

export async function generateAllDiagrams(): Promise<
  ApiResponse<{ count: number; diagrams: GeneratedDiagram[] }>
> {
  return fetchApi('/diagrams/generate-all', {
    method: 'POST',
  });
}

export async function getDiagram(
  type: DiagramType,
  scope?: string
): Promise<ApiResponse<GeneratedDiagram>> {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  return fetchApi<GeneratedDiagram>(`/diagrams/${type}${query}`);
}

// =============================================================================
// Requests & Recommendations
// =============================================================================

export interface RequestItem {
  id: string;
  reqNumber: string;
  title: string;
  description?: string;
  type: string;
  priority: string;
  primaryBu: string;
  currentPhase: string;
  assignedTo?: string;
  isBlocked?: boolean;
  tags: string[];
  source: string;
  createdAt: string;
  updatedAt: string;
  category: 'request' | 'recommendation';
}

export interface Recommendation {
  id: string;
  recNumber: string;
  title: string;
  description?: string;
  rationale?: string;
  expectedBenefits?: string;
  recommendedBy: string;
  type: string;
  urgency: string;
  impactLevel: string;
  affectedBus: string[];
  status: string;
  sourceReq?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getAllRequests(): Promise<
  ApiResponse<{
    requests: RequestItem[];
    summary: {
      totalRequests: number;
      totalRecommendations: number;
      total: number;
    };
  }>
> {
  return fetchApi('/requests');
}

export async function getRecommendations(
  status?: string,
  urgency?: string
): Promise<ApiResponse<{ recommendations: Recommendation[]; total: number }>> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (urgency) params.append('urgency', urgency);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi(`/recommendations${query}`);
}

export async function getRequestStats(): Promise<
  ApiResponse<{
    byPhase: Record<string, number>;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  }>
> {
  return fetchApi('/request-stats');
}

// =============================================================================
// Recommendation Status Updates
// =============================================================================

export type RecommendationStatus = 'pending' | 'approved' | 'in_progress' | 'done' | 'rejected' | 'failed';

export async function updateRecommendationStatus(
  id: string,
  status: RecommendationStatus,
  reviewedBy?: string,
  notes?: string
): Promise<ApiResponse<Recommendation>> {
  return fetchApi<Recommendation>(`/recommendations/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, reviewedBy, notes }),
  });
}

export async function approveRecommendation(
  id: string,
  reviewedBy: string,
  notes?: string
): Promise<ApiResponse<Recommendation>> {
  return updateRecommendationStatus(id, 'approved', reviewedBy, notes);
}

export async function rejectRecommendation(
  id: string,
  reviewedBy: string,
  reason: string
): Promise<ApiResponse<Recommendation>> {
  return updateRecommendationStatus(id, 'rejected', reviewedBy, reason);
}

export async function moveRecommendationToPhase(
  id: string,
  phase: RecommendationStatus
): Promise<ApiResponse<Recommendation>> {
  return updateRecommendationStatus(id, phase);
}

// =============================================================================
// Request Blockers (Dependency Graph)
// =============================================================================

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

export async function getBlockers(reqNumber: string): Promise<ApiResponse<BlockerInfo>> {
  return fetchApi<BlockerInfo>(`/blockers/${encodeURIComponent(reqNumber)}`);
}

export async function getDeepestUnblocked(limit: number = 10): Promise<
  ApiResponse<{ requests: DeepestUnblockedRequest[]; count: number }>
> {
  return fetchApi(`/deepest-unblocked?limit=${limit}`);
}

export async function addBlocker(
  blockedReqNumber: string,
  blockingReqNumber: string,
  reason?: string
): Promise<ApiResponse<{ blockerId: string }>> {
  return fetchApi('/blockers', {
    method: 'POST',
    body: JSON.stringify({ blockedReqNumber, blockingReqNumber, reason }),
  });
}

export async function removeBlocker(
  blockedReqNumber: string,
  blockingReqNumber: string
): Promise<ApiResponse<{ removed: boolean }>> {
  return fetchApi(`/blockers/${encodeURIComponent(blockedReqNumber)}/${encodeURIComponent(blockingReqNumber)}`, {
    method: 'DELETE',
  });
}

// =============================================================================
// Workflow Directives
// =============================================================================

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

export async function getWorkflowStatus(): Promise<ApiResponse<WorkflowStatus>> {
  return fetchApi<WorkflowStatus>('/workflow/status');
}

export async function clearWorkflowFocus(reason?: string): Promise<ApiResponse<{ cleared: boolean }>> {
  return fetchApi<{ cleared: boolean }>('/workflow/focus/clear', {
    method: 'POST',
    body: JSON.stringify({ reason: reason || 'Cleared from GUI' }),
  });
}

// Get all requests with their blocker info for the graph
export async function getBlockerGraph(): Promise<
  ApiResponse<{ requests: (RequestItem & { blockedBy: string[]; blocking: string[] })[] }>
> {
  // First get all requests
  const requestsResponse = await getAllRequests();
  if (!requestsResponse.success || !requestsResponse.data) {
    return { success: false, error: requestsResponse.error };
  }

  // Then get blocker info for each that might have blockers
  const requests = requestsResponse.data.requests;
  const enrichedRequests = await Promise.all(
    requests.map(async (req) => {
      if (req.isBlocked || req.category === 'request') {
        const blockerInfo = await getBlockers(req.reqNumber);
        if (blockerInfo.success && blockerInfo.data) {
          return {
            ...req,
            blockedBy: blockerInfo.data.blockedBy || [],
            blocking: blockerInfo.data.blocking || [],
          };
        }
      }
      return { ...req, blockedBy: [], blocking: [] };
    })
  );

  return {
    success: true,
    data: { requests: enrichedRequests },
  };
}
