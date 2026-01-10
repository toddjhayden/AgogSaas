/**
 * AI Function Handler
 * Handles function calling for AI chat - both native and prompt-based
 */

import {
  allSDLCFunctions,
  toPromptBasedFunctions,
  parseFunctionCallsFromText,
  MUTATION_FUNCTION_NAMES,
  type ParsedFunctionCall,
} from '@/types/ai-functions';
import {
  executeSDLCFunction,
  getConfirmationMessage,
  type ExecutedFunctionCall,
} from './ai-function-executor';

// Providers that support native function calling
const NATIVE_FUNCTION_PROVIDERS = ['openai', 'anthropic', 'google-gemini', 'deepseek', 'azure-openai'];

// GitHub Models that support function calling
const GITHUB_FUNCTION_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4'];

export interface FunctionCallResult {
  functionCalls: ExecutedFunctionCall[];
  pendingConfirmations: Array<{
    call: ParsedFunctionCall;
    message: string;
  }>;
}

/**
 * Check if a provider+model combination supports native function calling
 */
export function supportsNativeFunctionCalling(providerType: string, model: string): boolean {
  if (NATIVE_FUNCTION_PROVIDERS.includes(providerType)) {
    return true;
  }

  // GitHub Models - check specific model
  if (providerType === 'github-copilot') {
    return GITHUB_FUNCTION_MODELS.some(m => model.toLowerCase().includes(m));
  }

  return false;
}

/**
 * Build system prompt with function calling instructions
 * For models that don't support native function calling
 */
export function buildFunctionSystemPrompt(basePrompt: string): string {
  const functionInstructions = toPromptBasedFunctions(allSDLCFunctions);

  return `${basePrompt}

---
SDLC FUNCTION CALLING
---
${functionInstructions}`;
}

/**
 * Process AI response for function calls (prompt-based)
 * Extracts function calls from text response
 */
export function extractFunctionCalls(responseText: string): ParsedFunctionCall[] {
  return parseFunctionCallsFromText(responseText);
}

/**
 * Execute function calls with confirmation for mutations
 */
export async function executeFunctionCallsWithConfirmation(
  calls: ParsedFunctionCall[],
  onConfirmMutation: (call: ParsedFunctionCall, message: string) => Promise<boolean>
): Promise<ExecutedFunctionCall[]> {
  const results: ExecutedFunctionCall[] = [];

  for (const call of calls) {
    // Check if mutation requires confirmation
    if (MUTATION_FUNCTION_NAMES.includes(call.name)) {
      const message = getConfirmationMessage({ name: call.name, args: call.args as Record<string, unknown> });
      const confirmed = await onConfirmMutation(call, message);

      if (!confirmed) {
        results.push({
          name: call.name,
          args: call.args as Record<string, unknown>,
          result: { success: false, error: 'User cancelled operation' },
          executedAt: new Date(),
          confirmed: false,
        });
        continue;
      }
    }

    // Execute the function
    const result = await executeSDLCFunction({
      name: call.name,
      args: call.args as Record<string, unknown>,
    });

    results.push({
      name: call.name,
      args: call.args as Record<string, unknown>,
      result,
      executedAt: new Date(),
      confirmed: MUTATION_FUNCTION_NAMES.includes(call.name) ? true : undefined,
    });
  }

  return results;
}

/**
 * Format function results for display in chat
 */
export function formatFunctionResultsForChat(executedCalls: ExecutedFunctionCall[]): string {
  if (executedCalls.length === 0) return '';

  const parts = executedCalls.map(call => {
    const status = call.result.success ? '✓' : '✗';
    const resultSummary = call.result.success
      ? summarizeResult(call.name, call.result.data)
      : `Error: ${call.result.error}`;

    return `**${status} ${call.name}**\n${resultSummary}`;
  });

  return `\n\n---\n**Function Results:**\n${parts.join('\n\n')}`;
}

/**
 * Summarize function result data for display
 */
function summarizeResult(functionName: string, data: unknown): string {
  if (!data) return 'No data returned';

  const d = data as Record<string, unknown>;

  switch (functionName) {
    case 'getRequestDetails':
      return `Request: ${d.reqNumber} - ${d.title} (${d.priority})`;

    case 'getBlockedByRequest':
      const blocked = d.blockedItems as Array<{ reqNumber: string; title: string }>;
      if (!blocked?.length) return 'No items are blocked by this request.';
      return `Blocking ${blocked.length} items:\n${blocked.map(b => `  - ${b.reqNumber}: ${b.title}`).join('\n')}`;

    case 'getBlockersForRequest':
      const blockers = d.blockers as Array<{ reqNumber: string; title: string }>;
      if (!blockers?.length) return 'This request has no blockers.';
      return `Blocked by ${blockers.length} items:\n${blockers.map(b => `  - ${b.reqNumber}: ${b.title}`).join('\n')}`;

    case 'getUnblockedWork':
      const requests = d.requests as Array<{ reqNumber: string; title: string; priority: string }>;
      if (!requests?.length) return 'No unblocked work available.';
      return `${requests.length} unblocked items:\n${requests.slice(0, 5).map(r => `  - [${r.priority}] ${r.reqNumber}: ${r.title}`).join('\n')}${requests.length > 5 ? `\n  ... and ${requests.length - 5} more` : ''}`;

    case 'estimateCompletion':
      const est = d.estimate as { estimatedCompletionDate: string; totalHours: number; note: string };
      return `Estimated completion: ${est?.estimatedCompletionDate} (~${est?.totalHours}h)\n${est?.note || ''}`;

    case 'analyzeWorkload':
      const analysis = d.analysis as { canCompleteCount: number; canComplete: Array<{ reqNumber: string }> };
      return `Can complete ${analysis?.canCompleteCount || 0} items in ${d.hoursAvailable}h`;

    case 'updateRequestPriority':
    case 'setTopPriority':
      return `${d.reqNumber} priority updated to ${d.newPriority || d.priority}`;

    case 'searchRequests':
      const results = d.results as Array<{ reqNumber: string; title: string }>;
      if (!results?.length) return 'No matching requests found.';
      return `Found ${results.length} results:\n${results.slice(0, 5).map(r => `  - ${r.reqNumber}: ${r.title}`).join('\n')}`;

    default:
      // Generic summary
      if (typeof d.count === 'number') return `${d.count} items`;
      if (typeof d.message === 'string') return d.message;
      return JSON.stringify(data, null, 2).slice(0, 200);
  }
}

/**
 * Build follow-up message with function results
 * Sent back to AI to continue conversation
 */
export function buildFollowUpMessage(executedCalls: ExecutedFunctionCall[]): string {
  const results = executedCalls.map(call => {
    if (!call.result.success) {
      return `Function ${call.name} failed: ${call.result.error}`;
    }
    return `Function ${call.name} result:\n${JSON.stringify(call.result.data, null, 2)}`;
  });

  return `I executed the following SDLC functions:\n\n${results.join('\n\n')}\n\nPlease summarize the results for the user in a helpful way.`;
}
