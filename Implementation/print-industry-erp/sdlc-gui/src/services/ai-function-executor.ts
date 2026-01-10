/**
 * AI Function Executor Service
 * Executes SDLC functions called by AI providers
 */

import { MUTATION_FUNCTION_NAMES } from '@/types/ai-functions';
import { useSDLCSettingsStore } from '@/stores/useSDLCSettingsStore';

// Get API base URL from settings store (includes /agent suffix for agent endpoints)
function getSDLCApiBase(): string {
  const storeUrl = useSDLCSettingsStore.getState().apiUrl;
  return storeUrl ? `${storeUrl}/agent` : '/api/agent';
}

export interface FunctionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Check if a function requires user confirmation before execution
 */
export function requiresConfirmation(functionName: string): boolean {
  return MUTATION_FUNCTION_NAMES.includes(functionName);
}

/**
 * Generate a human-readable confirmation message for a mutation
 */
export function getConfirmationMessage(call: FunctionCall): string {
  const { name, args } = call;

  switch (name) {
    case 'updateRequestPriority':
      return `Change priority of ${args.reqNumber} to "${args.priority}"?`;

    case 'setTopPriority':
      return `Set ${args.reqNumber} as THE top priority (catastrophic + workflow focus)?`;

    case 'setWorkflowFocus':
      return `Focus ${args.percentEffort}% of workflow effort on ${args.reqNumber}${args.duration ? ` for ${args.duration}` : ''}?`;

    case 'optimizePriorities':
      return `Automatically optimize priorities for ${args.hoursAvailable} hours with goal: ${args.goal}?`;

    case 'addBlocker':
      return `Add blocker: ${args.blockedReq} is blocked by ${args.blockingReq}?`;

    case 'removeBlocker':
      return `Remove blocker relationship between ${args.blockedReq} and ${args.blockingReq}?`;

    case 'createRecommendation':
      return `Create recommendation: "${args.title}" (${args.urgency} urgency)?`;

    case 'updateRequestPhase':
      return `Move ${args.reqNumber} to phase "${args.phase}"?`;

    default:
      return `Execute ${name} with provided parameters?`;
  }
}

/**
 * Execute an SDLC function
 */
export async function executeSDLCFunction(call: FunctionCall): Promise<FunctionResult> {
  const { name, args } = call;

  try {
    switch (name) {
      // ========== QUERY FUNCTIONS ==========

      case 'getRequestDetails':
        return await fetchAPI(`/requests/${args.reqNumber}`);

      case 'getBlockedByRequest':
        return await fetchAPI(`/requests/${args.reqNumber}/blocked-by`);

      case 'getBlockersForRequest':
        return await fetchAPI(`/blockers/${args.reqNumber}`);

      case 'getBlockerChain':
        return await fetchAPI(`/requests/${args.reqNumber}/blocker-chain`);

      case 'getUnblockedWork': {
        const params = new URLSearchParams();
        if (args.maxHours) params.append('maxHours', String(args.maxHours));
        if (args.sortBy) params.append('sortBy', String(args.sortBy));
        if (args.limit) params.append('limit', String(args.limit));
        const query = params.toString() ? `?${params.toString()}` : '';
        return await fetchAPI(`/requests/unblocked${query}`);
      }

      case 'getRequestsByCustomer':
        return await fetchAPI(`/requests/by-customer/${encodeURIComponent(String(args.customerName))}`);

      case 'estimateCompletion':
        return await fetchAPI(`/requests/${args.reqNumber}/estimate`);

      case 'analyzeWorkload':
        return await fetchAPI(`/workload/analyze?hours=${args.hoursAvailable}`);

      case 'getRequestsByPriority': {
        const includeBlocked = args.includeBlocked !== false ? 'true' : 'false';
        return await fetchAPI(`/requests/by-priority/${args.priority}?includeBlocked=${includeBlocked}`);
      }

      case 'getRequestsByPhase':
        return await fetchAPI(`/requests/by-phase/${args.phase}`);

      case 'searchRequests': {
        const limit = args.limit || 20;
        return await fetchAPI(`/requests/search?q=${encodeURIComponent(String(args.query))}&limit=${limit}`);
      }

      case 'getBiggestBottleneck':
        return await fetchAPI('/requests/biggest-bottleneck');

      case 'getHighestImpactRecommendation': {
        const urgencyParam = args.urgency ? `?urgency=${args.urgency}` : '';
        return await fetchAPI(`/recommendations/highest-impact${urgencyParam}`);
      }

      case 'getRecsForFeature': {
        const statusParam = args.status || 'pending';
        return await fetchAPI(`/recommendations/for-feature?feature=${encodeURIComponent(String(args.feature))}&status=${statusParam}`);
      }

      // ========== MUTATION FUNCTIONS ==========

      case 'updateRequestPriority':
        return await postAPI(`/requests/${args.reqNumber}/priority`, {
          priority: args.priority,
          reason: args.reason,
          updatedBy: 'ai-assist'
        });

      case 'setTopPriority':
        return await postAPI(`/requests/${args.reqNumber}/top-priority`, {
          reason: args.reason,
          updatedBy: 'ai-assist'
        });

      case 'setWorkflowFocus':
        return await postAPI('/workflow/focus', {
          reqNumber: args.reqNumber,
          percentEffort: args.percentEffort,
          duration: args.duration,
          createdBy: 'ai-assist'
        });

      case 'optimizePriorities':
        return await postAPI('/workflow/optimize-priorities', {
          hoursAvailable: args.hoursAvailable,
          goal: args.goal,
          customerName: args.customerName,
          createdBy: 'ai-assist'
        });

      case 'addBlocker':
        return await postAPI('/blockers', {
          blockedReq: args.blockedReq,
          blockingReq: args.blockingReq,
          reason: args.reason,
          createdBy: 'ai-assist'
        });

      case 'removeBlocker':
        return await deleteAPI(`/blockers/${args.blockedReq}/${args.blockingReq}`);

      case 'createRecommendation':
        return await postAPI('/recommendations', {
          title: args.title,
          description: args.description,
          urgency: args.urgency,
          affectedBus: args.affectedBus || [],
          createdBy: 'ai-assist'
        });

      case 'updateRequestPhase':
        return await postAPI(`/requests/${args.reqNumber}/phase`, {
          phase: args.phase,
          reason: args.reason,
          updatedBy: 'ai-assist'
        });

      // ========== WORKFLOW FUNCTIONS ==========

      case 'getWorkflowStatus':
        return await fetchAPI('/workflow/status');

      case 'focusOnBlockerChain':
        return await postAPI('/workflow/focus/blocker-chain', {
          reqNumber: args.reqNumber,
          reason: args.reason,
          createdBy: 'ai-assist'
        });

      case 'focusOnCustomer':
        return await postAPI('/workflow/directive', {
          directiveType: 'focus',
          displayName: `Customer focus: ${args.customerName}`,
          targetType: 'customer',
          targetValue: args.customerName,
          exclusive: true,
          autoRestore: true,
          createdBy: 'ai-assist',
          reason: args.reason
        });

      case 'focusOnEasyWork':
        return await postAPI('/workflow/directive', {
          directiveType: 'focus',
          displayName: `Easy work focus (< ${args.maxHours}h tasks)`,
          targetType: 'filter',
          filterCriteria: {
            maxHours: args.maxHours,
            unblocked: true
          },
          expiresAt: args.expiresAt,
          exclusive: true,
          autoRestore: true,
          createdBy: 'ai-assist',
          reason: args.reason || 'Easy work push'
        });

      case 'setWorkflowDirective':
        return await postAPI('/workflow/directive', {
          directiveType: 'focus',
          displayName: args.displayName,
          targetType: args.targetType,
          targetValue: args.targetValue,
          exclusive: args.exclusive !== false,
          expiresAt: args.expiresAt,
          autoRestore: true,
          createdBy: 'ai-assist',
          reason: args.reason
        });

      case 'clearWorkflowFocus':
        return await postAPI('/workflow/focus/clear', {
          reason: args.reason || 'Cleared by user via AI assist'
        });

      case 'checkIfNeeded':
        return await fetchAPI(`/requests/${args.reqNumber}/check-needed`);

      default:
        return {
          success: false,
          error: `Unknown function: ${name}`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchAPI(path: string): Promise<FunctionResult> {
  try {
    const apiBase = getSDLCApiBase();
    const response = await fetch(`${apiBase}${path}`);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API error (${response.status}): ${errorText}`
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

async function postAPI(path: string, body: unknown): Promise<FunctionResult> {
  try {
    const apiBase = getSDLCApiBase();
    const response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API error (${response.status}): ${errorText}`
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

async function deleteAPI(path: string): Promise<FunctionResult> {
  try {
    const apiBase = getSDLCApiBase();
    const response = await fetch(`${apiBase}${path}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API error (${response.status}): ${errorText}`
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

// ============================================================================
// BATCH EXECUTION
// ============================================================================

export interface ExecutedFunctionCall extends FunctionCall {
  result: FunctionResult;
  executedAt: Date;
  confirmed?: boolean;
}

/**
 * Execute multiple function calls in sequence
 * Stops if any mutation is not confirmed
 */
export async function executeFunctionCalls(
  calls: FunctionCall[],
  confirmMutation: (call: FunctionCall, message: string) => Promise<boolean>
): Promise<ExecutedFunctionCall[]> {
  const results: ExecutedFunctionCall[] = [];

  for (const call of calls) {
    // Check if confirmation is needed
    if (requiresConfirmation(call.name)) {
      const message = getConfirmationMessage(call);
      const confirmed = await confirmMutation(call, message);

      if (!confirmed) {
        results.push({
          ...call,
          result: { success: false, error: 'User cancelled operation' },
          executedAt: new Date(),
          confirmed: false
        });
        continue;
      }
    }

    // Execute the function
    const result = await executeSDLCFunction(call);
    results.push({
      ...call,
      result,
      executedAt: new Date(),
      confirmed: requiresConfirmation(call.name) ? true : undefined
    });
  }

  return results;
}
