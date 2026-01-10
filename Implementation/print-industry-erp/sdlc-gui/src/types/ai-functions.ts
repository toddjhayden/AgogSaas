/**
 * AI Function Definitions for SDLC Operations
 * These functions are exposed to AI providers for natural language SDLC interaction
 */

export interface SDLCFunctionParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface SDLCFunction {
  name: string;
  description: string;
  category: 'query' | 'mutation';
  parameters: {
    type: 'object';
    properties: Record<string, SDLCFunctionParameter>;
    required: string[];
  };
}

// ============================================================================
// QUERY FUNCTIONS (Read-Only)
// ============================================================================

export const queryFunctions: SDLCFunction[] = [
  {
    name: 'getRequestDetails',
    description: 'Get full details of a specific request by its REQ number including title, priority, phase, blockers, and metadata',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The request number (e.g., REQ-P0-BUILD-1767507808-DB, REQ-SDLC-1234567890)'
        }
      },
      required: ['reqNumber']
    }
  },
  {
    name: 'getBlockedByRequest',
    description: 'Get all requests that are blocked BY a specific request (items waiting on this request)',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The blocking request number'
        }
      },
      required: ['reqNumber']
    }
  },
  {
    name: 'getBlockersForRequest',
    description: 'Get all requests that are blocking a specific request (what this request is waiting on)',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The blocked request number'
        }
      },
      required: ['reqNumber']
    }
  },
  {
    name: 'getBlockerChain',
    description: 'Get the full recursive chain of all blockers for a request, showing the complete dependency tree',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The request to trace blockers for'
        }
      },
      required: ['reqNumber']
    }
  },
  {
    name: 'getUnblockedWork',
    description: 'Get all unblocked requests that can be worked on, sorted by priority or effort',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        maxHours: {
          type: 'number',
          description: 'Maximum estimated hours of work to return (optional, filters by estimated_hours field)'
        },
        sortBy: {
          type: 'string',
          enum: ['priority', 'effort_asc', 'effort_desc', 'age'],
          description: 'How to sort: priority (highest first), effort_asc (easiest first), effort_desc (hardest first), age (oldest first). Default: priority'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return (default: 20)'
        }
      },
      required: []
    }
  },
  {
    name: 'getRequestsByCustomer',
    description: 'Get all requests created for or by a specific customer/source',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        customerName: {
          type: 'string',
          description: 'Customer name or source identifier to search for'
        }
      },
      required: ['customerName']
    }
  },
  {
    name: 'estimateCompletion',
    description: 'Estimate when a request will be completed based on current velocity, blockers, and workload',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The request number to estimate completion for'
        }
      },
      required: ['reqNumber']
    }
  },
  {
    name: 'analyzeWorkload',
    description: 'Analyze current workload and what can realistically be completed in a given timeframe',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        hoursAvailable: {
          type: 'number',
          description: 'Hours available for work (e.g., 8 for a day, 16 for weekend)'
        }
      },
      required: ['hoursAvailable']
    }
  },
  {
    name: 'getRequestsByPriority',
    description: 'Get all requests of a specific priority level',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical', 'catastrophic'],
          description: 'Priority level to filter by'
        },
        includeBlocked: {
          type: 'boolean',
          description: 'Whether to include blocked requests (default: true)'
        }
      },
      required: ['priority']
    }
  },
  {
    name: 'getRequestsByPhase',
    description: 'Get all requests in a specific workflow phase',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          description: 'Phase code (e.g., backlog, ready, in_progress, review, done)'
        }
      },
      required: ['phase']
    }
  },
  {
    name: 'searchRequests',
    description: 'Search requests by title, description, or tags',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to match against title, description, or tags'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 20)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'getBiggestBottleneck',
    description: 'Find the request that is blocking the most other work - the biggest bottleneck in the system',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getHighestImpactRecommendation',
    description: 'Find the recommendation that would have the biggest impact if implemented',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        urgency: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Filter by urgency level (optional)'
        }
      },
      required: []
    }
  },
  {
    name: 'getRecsForFeature',
    description: 'Find all recommendations related to a specific feature or area (e.g., WMS, inventory, invoicing) that need approval',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        feature: {
          type: 'string',
          description: 'Feature area to search for (e.g., WMS, warehouse, inventory, invoicing, quotes)'
        },
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'all'],
          description: 'Filter by status (default: pending)'
        }
      },
      required: ['feature']
    }
  }
];

// ============================================================================
// MUTATION FUNCTIONS (Write Operations - Require Confirmation)
// ============================================================================

// ============================================================================
// WORKFLOW DIRECTIVE FUNCTIONS
// ============================================================================

export const workflowFunctions: SDLCFunction[] = [
  {
    name: 'getWorkflowStatus',
    description: 'Get current workflow status - whether normal or focused on specific work',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'focusOnBlockerChain',
    description: 'Focus all workflow on a blocker chain. Agents will only work on REQs connected to the target via blocking relationships.',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The REQ number to focus the blocker chain on'
        },
        reason: {
          type: 'string',
          description: 'Why this focus is being set'
        }
      },
      required: ['reqNumber']
    }
  },
  {
    name: 'focusOnCustomer',
    description: 'Focus all workflow on a specific customer. Agents will prioritize REQs from this customer.',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        customerName: {
          type: 'string',
          description: 'Customer name to prioritize'
        },
        reason: {
          type: 'string',
          description: 'Why this focus is being set'
        }
      },
      required: ['customerName']
    }
  },
  {
    name: 'focusOnEasyWork',
    description: 'Focus workflow on easy/quick tasks (e.g., for weekend push). Only works on items under specified hours.',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        maxHours: {
          type: 'number',
          description: 'Maximum hours per task (e.g., 2 for quick tasks)'
        },
        expiresAt: {
          type: 'string',
          description: 'When to end this focus (ISO date string, e.g., "2026-01-12T18:00:00Z")'
        },
        reason: {
          type: 'string',
          description: 'Why this focus is being set (e.g., "Weekend push")'
        }
      },
      required: ['maxHours']
    }
  },
  {
    name: 'setWorkflowDirective',
    description: 'Set a custom workflow directive. Flexible targeting by tag, BU, priority, or custom filter.',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        displayName: {
          type: 'string',
          description: 'Human-readable name for this directive'
        },
        targetType: {
          type: 'string',
          description: 'What to target: tag, bu, priority, or filter'
        },
        targetValue: {
          type: 'string',
          description: 'The specific target value'
        },
        exclusive: {
          type: 'boolean',
          description: 'If true, only work on targeted items. If false, prioritize but allow other work.'
        },
        expiresAt: {
          type: 'string',
          description: 'When to auto-clear this directive (ISO date string)'
        },
        reason: {
          type: 'string',
          description: 'Why this directive is being set'
        }
      },
      required: ['displayName', 'targetType', 'targetValue']
    }
  },
  {
    name: 'clearWorkflowFocus',
    description: 'Clear current workflow focus and return to normal operations',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why the focus is being cleared'
        }
      },
      required: []
    }
  },
  {
    name: 'checkIfNeeded',
    description: 'Check if a REQ is still needed by searching for similar completed work in embeddings',
    category: 'query',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The REQ number to check'
        }
      },
      required: ['reqNumber']
    }
  }
];

export const mutationFunctions: SDLCFunction[] = [
  {
    name: 'updateRequestPriority',
    description: 'Change the priority of a request',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The request number to update'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical', 'catastrophic'],
          description: 'The new priority level'
        },
        reason: {
          type: 'string',
          description: 'Reason for the priority change (recommended for audit trail)'
        }
      },
      required: ['reqNumber', 'priority']
    }
  },
  {
    name: 'setTopPriority',
    description: 'Flag a request as THE most important thing to work on. Sets priority to catastrophic and creates a workflow focus directive.',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The request to make top priority'
        },
        reason: {
          type: 'string',
          description: 'Why this is the top priority'
        }
      },
      required: ['reqNumber']
    }
  },
  {
    name: 'setWorkflowFocus',
    description: 'Direct the workflow system to focus a percentage of agent effort on a specific request',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The request to focus on'
        },
        percentEffort: {
          type: 'number',
          description: 'Percentage of workflow effort to allocate (0-100)'
        },
        duration: {
          type: 'string',
          description: 'How long to maintain focus (e.g., "8 hours", "weekend", "until_done")'
        }
      },
      required: ['reqNumber', 'percentEffort']
    }
  },
  {
    name: 'optimizePriorities',
    description: 'Automatically reorder priorities to maximize output for a given timeframe and goal',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        hoursAvailable: {
          type: 'number',
          description: 'Hours available for work'
        },
        goal: {
          type: 'string',
          enum: ['max_items', 'max_impact', 'unblock_critical', 'customer_focus'],
          description: 'Optimization goal: max_items (complete most items), max_impact (highest value items), unblock_critical (resolve blockers for critical items), customer_focus (prioritize specific customer)'
        },
        customerName: {
          type: 'string',
          description: 'Customer name to prioritize (required if goal is customer_focus)'
        }
      },
      required: ['hoursAvailable', 'goal']
    }
  },
  {
    name: 'addBlocker',
    description: 'Add a blocking relationship between two requests',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        blockedReq: {
          type: 'string',
          description: 'Request number that is blocked'
        },
        blockingReq: {
          type: 'string',
          description: 'Request number that is doing the blocking'
        },
        reason: {
          type: 'string',
          description: 'Why this blocking relationship exists'
        }
      },
      required: ['blockedReq', 'blockingReq']
    }
  },
  {
    name: 'removeBlocker',
    description: 'Remove a blocking relationship (marks the blocker as resolved)',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        blockedReq: {
          type: 'string',
          description: 'Request number that was blocked'
        },
        blockingReq: {
          type: 'string',
          description: 'Request number that was blocking'
        }
      },
      required: ['blockedReq', 'blockingReq']
    }
  },
  {
    name: 'createRecommendation',
    description: 'Create a new recommendation for the system to consider',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Recommendation title'
        },
        description: {
          type: 'string',
          description: 'Detailed recommendation description'
        },
        urgency: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Urgency level of the recommendation'
        },
        affectedBus: {
          type: 'array',
          items: { type: 'string' },
          description: 'Business units affected by this recommendation'
        }
      },
      required: ['title', 'description', 'urgency']
    }
  },
  {
    name: 'updateRequestPhase',
    description: 'Move a request to a different workflow phase',
    category: 'mutation',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The request number to update'
        },
        phase: {
          type: 'string',
          description: 'The new phase code (e.g., ready, in_progress, review, done)'
        },
        reason: {
          type: 'string',
          description: 'Reason for the phase change'
        }
      },
      required: ['reqNumber', 'phase']
    }
  }
];

// ============================================================================
// COMBINED FUNCTIONS
// ============================================================================

export const allSDLCFunctions: SDLCFunction[] = [...queryFunctions, ...workflowFunctions, ...mutationFunctions];

// Function names that require user confirmation before execution
export const MUTATION_FUNCTION_NAMES = [
  ...mutationFunctions.map(f => f.name),
  ...workflowFunctions.filter(f => f.category === 'mutation').map(f => f.name)
];

// ============================================================================
// PROVIDER-SPECIFIC FORMATS
// ============================================================================

/**
 * Convert to OpenAI function calling format
 */
export function toOpenAITools(functions: SDLCFunction[]) {
  return functions.map(fn => ({
    type: 'function' as const,
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters
    }
  }));
}

/**
 * Convert to Anthropic/Claude tool use format
 */
export function toClaudeTools(functions: SDLCFunction[]) {
  return functions.map(fn => ({
    name: fn.name,
    description: fn.description,
    input_schema: fn.parameters
  }));
}

/**
 * Convert to Google Gemini function declarations format
 */
export function toGeminiTools(functions: SDLCFunction[]) {
  return {
    function_declarations: functions.map(fn => ({
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters
    }))
  };
}

/**
 * Generate prompt-based function description for models without native function calling
 */
export function toPromptBasedFunctions(functions: SDLCFunction[]): string {
  const functionDescriptions = functions.map(fn => {
    const params = Object.entries(fn.parameters.properties)
      .map(([name, prop]) => {
        const required = fn.parameters.required.includes(name) ? ' (required)' : ' (optional)';
        const enumValues = prop.enum ? ` [${prop.enum.join(', ')}]` : '';
        return `    - ${name}: ${prop.description}${enumValues}${required}`;
      })
      .join('\n');

    return `${fn.name}: ${fn.description}\n  Parameters:\n${params}`;
  }).join('\n\n');

  return `You have access to SDLC functions to query and modify the software development lifecycle database.

When you need to use a function, respond with a JSON block in this exact format:
\`\`\`json
{"function": "functionName", "args": {"param1": "value1", "param2": "value2"}}
\`\`\`

After I execute the function, I'll provide the result and you can continue your response.

Available functions:

${functionDescriptions}

IMPORTANT:
- For mutation functions (updateRequestPriority, setTopPriority, setWorkflowFocus, optimizePriorities, addBlocker, removeBlocker, createRecommendation, updateRequestPhase), I will ask for user confirmation before executing.
- Always explain what you're about to do before calling a function.
- If a function returns an error, explain the issue and suggest alternatives.`;
}

// ============================================================================
// FUNCTION CALL PARSING
// ============================================================================

export interface ParsedFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Parse function calls from model response (for prompt-based fallback)
 */
export function parseFunctionCallsFromText(text: string): ParsedFunctionCall[] {
  const calls: ParsedFunctionCall[] = [];

  // Match JSON blocks with function calls
  const jsonBlockRegex = /```json\s*\n?([\s\S]*?)\n?```/g;
  let match;

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.function && typeof parsed.function === 'string') {
        calls.push({
          name: parsed.function,
          args: parsed.args || {}
        });
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  // Also try to find inline JSON (not in code blocks)
  const inlineJsonRegex = /\{"function"\s*:\s*"(\w+)"\s*,\s*"args"\s*:\s*(\{[^}]*\})\}/g;
  while ((match = inlineJsonRegex.exec(text)) !== null) {
    try {
      const args = JSON.parse(match[2]);
      calls.push({
        name: match[1],
        args
      });
    } catch {
      // Invalid JSON, skip
    }
  }

  return calls;
}
