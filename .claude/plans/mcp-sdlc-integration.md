# MCP/Function Calling Integration Plan: AI + SDLC

## Overview

Enable natural language commands in AI Assist to interact with SDLC database through function calling.

**User's desired interactions from sdlc.agog.fyi:**
- "Change REQ-X priority to catastrophic"
- "Focus all workflow effort on REQ-X"
- "What's blocked by REQ-X?"
- "Prioritize unblocked work for 8 hours"
- "Do easiest work this weekend"
- "When will REQ-X be finished?"
- "Optimize priorities for weekend productivity"
- "What did Customer XLX request? Prioritize their needs."

---

## Phase 1: Core Function Definitions

### 1.1 Query Functions (Read-Only)

```typescript
// sdlc-gui/src/types/ai-functions.ts

export interface SDLCFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export const sdlcQueryFunctions: SDLCFunction[] = [
  {
    name: 'getRequestDetails',
    description: 'Get full details of a specific request by its REQ number',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The request number (e.g., REQ-P0-BUILD-1767507808-DB)'
        }
      },
      required: ['reqNumber']
    }
  },
  {
    name: 'getBlockedByRequest',
    description: 'Get all requests that are blocked by a specific request',
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
    name: 'getBlockingRequest',
    description: 'Get all requests that are blocking a specific request',
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
    name: 'getUnblockedWork',
    description: 'Get all unblocked requests sorted by priority, optionally filtered by estimated hours',
    parameters: {
      type: 'object',
      properties: {
        maxHours: {
          type: 'number',
          description: 'Maximum estimated hours of work to return (optional)'
        },
        sortBy: {
          type: 'string',
          enum: ['priority', 'effort_asc', 'effort_desc', 'age'],
          description: 'How to sort results: priority (default), effort_asc (easiest first), effort_desc (hardest first), age (oldest first)'
        }
      },
      required: []
    }
  },
  {
    name: 'getRequestsBySource',
    description: 'Get all requests created from a specific source/customer',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Customer name, ticket ID, or source identifier'
        }
      },
      required: ['source']
    }
  },
  {
    name: 'estimateCompletion',
    description: 'Estimate when a request will be completed based on current velocity and blockers',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The request number to estimate'
        }
      },
      required: ['reqNumber']
    }
  },
  {
    name: 'getWorkloadAnalysis',
    description: 'Analyze current workload and capacity for a time period',
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
    name: 'getBlockerChain',
    description: 'Get the full chain of blockers for a request (recursive)',
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
  }
];
```

### 1.2 Mutation Functions (Write Operations)

```typescript
export const sdlcMutationFunctions: SDLCFunction[] = [
  {
    name: 'updateRequestPriority',
    description: 'Change the priority of a request',
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
          description: 'Reason for the priority change (optional)'
        }
      },
      required: ['reqNumber', 'priority']
    }
  },
  {
    name: 'setTopPriority',
    description: 'Flag a request as THE most important thing to work on (sets catastrophic + adds workflow directive)',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The request to prioritize'
        },
        reason: {
          type: 'string',
          description: 'Why this is top priority'
        }
      },
      required: ['reqNumber']
    }
  },
  {
    name: 'setWorkflowFocus',
    description: 'Direct the workflow system to focus a percentage of effort on a specific request',
    parameters: {
      type: 'object',
      properties: {
        reqNumber: {
          type: 'string',
          description: 'The request to focus on'
        },
        percentEffort: {
          type: 'number',
          description: 'Percentage of workflow effort (0-100)'
        },
        duration: {
          type: 'string',
          description: 'How long to maintain this focus (e.g., "8 hours", "weekend", "until done")'
        }
      },
      required: ['reqNumber', 'percentEffort']
    }
  },
  {
    name: 'createRecommendation',
    description: 'Create a new recommendation for the system',
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
          description: 'Urgency level'
        },
        affectedBus: {
          type: 'array',
          description: 'Business units affected'
        }
      },
      required: ['title', 'description', 'urgency']
    }
  },
  {
    name: 'optimizePriorities',
    description: 'Automatically reorder priorities to maximize output for a given timeframe and goal',
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
          description: 'Optimization goal: max_items (most items done), max_impact (highest value), unblock_critical (resolve blockers), customer_focus (specific customer needs)'
        },
        customerFilter: {
          type: 'string',
          description: 'Customer name to prioritize (if goal is customer_focus)'
        }
      },
      required: ['hoursAvailable', 'goal']
    }
  },
  {
    name: 'addBlocker',
    description: 'Add a blocking relationship between requests',
    parameters: {
      type: 'object',
      properties: {
        blockedReq: {
          type: 'string',
          description: 'Request that is blocked'
        },
        blockingReq: {
          type: 'string',
          description: 'Request that is doing the blocking'
        },
        reason: {
          type: 'string',
          description: 'Why this blocker exists'
        }
      },
      required: ['blockedReq', 'blockingReq']
    }
  },
  {
    name: 'removeBlocker',
    description: 'Remove a blocking relationship (marks blocker as resolved)',
    parameters: {
      type: 'object',
      properties: {
        blockedReq: {
          type: 'string',
          description: 'Request that was blocked'
        },
        blockingReq: {
          type: 'string',
          description: 'Request that was doing the blocking'
        }
      },
      required: ['blockedReq', 'blockingReq']
    }
  }
];
```

---

## Phase 2: Function Executor Service

### 2.1 Frontend Function Executor

```typescript
// sdlc-gui/src/services/ai-function-executor.ts

import * as api from '@/api/sdlc-client';

type FunctionResult = {
  success: boolean;
  data?: any;
  error?: string;
};

export async function executeSDLCFunction(
  functionName: string,
  args: Record<string, any>
): Promise<FunctionResult> {

  switch (functionName) {
    // Query functions
    case 'getRequestDetails':
      return await api.getRequestByNumber(args.reqNumber);

    case 'getBlockedByRequest':
      return await api.getBlockedByRequest(args.reqNumber);

    case 'getBlockingRequest':
      return await api.getBlockersForRequest(args.reqNumber);

    case 'getUnblockedWork':
      return await api.getUnblockedWork({
        maxHours: args.maxHours,
        sortBy: args.sortBy || 'priority'
      });

    case 'getRequestsBySource':
      return await api.searchRequestsBySource(args.source);

    case 'estimateCompletion':
      return await api.estimateRequestCompletion(args.reqNumber);

    case 'getWorkloadAnalysis':
      return await api.analyzeWorkload(args.hoursAvailable);

    case 'getBlockerChain':
      return await api.getBlockerChain(args.reqNumber);

    // Mutation functions
    case 'updateRequestPriority':
      return await api.updateRequestPriority(args.reqNumber, args.priority, args.reason);

    case 'setTopPriority':
      return await api.setTopPriority(args.reqNumber, args.reason);

    case 'setWorkflowFocus':
      return await api.setWorkflowFocus(args.reqNumber, args.percentEffort, args.duration);

    case 'createRecommendation':
      return await api.createRecommendation(args);

    case 'optimizePriorities':
      return await api.optimizePriorities(args);

    case 'addBlocker':
      return await api.addBlocker(args.blockedReq, args.blockingReq, args.reason);

    case 'removeBlocker':
      return await api.removeBlocker(args.blockedReq, args.blockingReq);

    default:
      return { success: false, error: `Unknown function: ${functionName}` };
  }
}
```

---

## Phase 3: AI Chat Integration

### 3.1 Update useAIChatStore

```typescript
// Add to useAIChatStore.ts

interface AIMessage {
  // ... existing fields
  functionCalls?: {
    name: string;
    args: Record<string, any>;
    result?: any;
  }[];
}

// Add function calling to sendMessage
const sendMessageWithFunctions = async (
  content: string,
  providerId: string
): Promise<void> => {
  // 1. Build prompt with function definitions
  const functionsPrompt = buildFunctionsSystemPrompt(sdlcFunctions);

  // 2. Send to provider with function calling enabled
  const response = await callProviderWithFunctions(providerId, content, sdlcFunctions);

  // 3. If response contains function calls, execute them
  if (response.functionCalls) {
    for (const call of response.functionCalls) {
      const result = await executeSDLCFunction(call.name, call.args);
      call.result = result;
    }

    // 4. Send results back to AI for final response
    const finalResponse = await callProviderWithResults(providerId, response.functionCalls);

    // 5. Add to messages
    addMessage({
      role: 'assistant',
      content: finalResponse.content,
      functionCalls: response.functionCalls
    });
  }
};
```

### 3.2 Provider-Specific Function Calling

```typescript
// Provider-specific function calling formats

// OpenAI/GPT format
const openAIFunctions = sdlcFunctions.map(fn => ({
  type: 'function',
  function: {
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters
  }
}));

// Anthropic/Claude format (uses tools)
const claudeTools = sdlcFunctions.map(fn => ({
  name: fn.name,
  description: fn.description,
  input_schema: fn.parameters
}));

// Google Gemini format
const geminiFunctions = {
  function_declarations: sdlcFunctions.map(fn => ({
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters
  }))
};
```

---

## Phase 4: Backend API Additions

### 4.1 New Endpoints Needed

```typescript
// Add to sdlc-api.server.ts

// GET /api/agent/requests/:reqNumber/blocked-by
// Returns all requests blocked by this request

// GET /api/agent/requests/:reqNumber/blocker-chain
// Returns recursive chain of all blockers

// GET /api/agent/requests/search?source=XLX
// Search requests by source/customer

// GET /api/agent/unblocked-work?maxHours=8&sortBy=effort_asc
// Get unblocked work filtered and sorted

// GET /api/agent/requests/:reqNumber/estimate
// Estimate completion based on velocity

// GET /api/agent/workload-analysis?hours=16
// Analyze what can be done in given hours

// POST /api/agent/workflow-focus
// Set workflow focus directive

// POST /api/agent/optimize-priorities
// Auto-optimize priorities for timeframe
```

### 4.2 New Database Fields (Migration)

```sql
-- V0.0.30__add_workflow_directives.sql

-- Track workflow focus directives
CREATE TABLE workflow_directives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  directive_type VARCHAR(50) NOT NULL, -- 'focus', 'pause', 'expedite'
  target_request_id UUID REFERENCES owner_requests(id),
  percent_effort INTEGER CHECK (percent_effort >= 0 AND percent_effort <= 100),
  duration_hours INTEGER,
  expires_at TIMESTAMPTZ,
  created_by VARCHAR(100), -- 'ai-assist' or user ID
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track request sources for customer queries
ALTER TABLE owner_requests
ADD COLUMN IF NOT EXISTS source VARCHAR(255),
ADD COLUMN IF NOT EXISTS source_customer VARCHAR(255),
ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(6,2);

-- Index for source queries
CREATE INDEX IF NOT EXISTS idx_requests_source_customer
ON owner_requests(source_customer);
```

---

## Phase 5: UI Enhancements

### 5.1 Function Call Display in Chat

```tsx
// Show function calls in chat UI
{message.functionCalls && (
  <div className="mt-2 space-y-2">
    {message.functionCalls.map((call, idx) => (
      <div key={idx} className="bg-slate-100 rounded-lg p-3 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <Zap size={14} className="text-amber-500" />
          <span className="font-mono">{call.name}</span>
        </div>
        {call.result && (
          <div className="mt-2 text-xs text-slate-500">
            {call.result.success ? '✓ Success' : '✗ Failed'}
          </div>
        )}
      </div>
    ))}
  </div>
)}
```

### 5.2 Safety Confirmations for Mutations

```tsx
// Confirm before executing mutations
const MUTATION_FUNCTIONS = [
  'updateRequestPriority',
  'setTopPriority',
  'setWorkflowFocus',
  'createRecommendation',
  'optimizePriorities',
  'addBlocker',
  'removeBlocker'
];

// Before executing:
if (MUTATION_FUNCTIONS.includes(call.name)) {
  const confirmed = await confirmMutation(call);
  if (!confirmed) {
    call.result = { success: false, error: 'User cancelled' };
    continue;
  }
}
```

---

## Implementation Order

### Sprint 1: Foundation (Query Functions)
1. Create `ai-functions.ts` with function definitions
2. Add new query endpoints to backend
3. Create `ai-function-executor.ts`
4. Update AI chat to include functions in context

### Sprint 2: Provider Integration
1. Add function calling support for each provider
2. Handle provider-specific formats
3. Parse function calls from responses
4. Execute and return results

### Sprint 3: Mutation Functions
1. Add mutation endpoints to backend
2. Create workflow_directives table
3. Add confirmation dialogs for mutations
4. Add source/customer fields to requests

### Sprint 4: Advanced Features
1. Completion estimation algorithm
2. Priority optimization algorithm
3. Workload analysis
4. Customer-focused queries

---

## Example Conversation Flow

**User:** "What's blocking REQ-P0-BUILD-1767507808-DB?"

**AI (internally):** Calls `getBlockingRequest({ reqNumber: "REQ-P0-BUILD-1767507808-DB" })`

**Function Result:**
```json
{
  "success": true,
  "data": [
    { "reqNumber": "REQ-INFRA-123", "title": "Database migration pending", "priority": "high" },
    { "reqNumber": "REQ-SEC-456", "title": "Security review required", "priority": "critical" }
  ]
}
```

**AI Response:** "REQ-P0-BUILD-1767507808-DB is blocked by 2 items:
1. **REQ-INFRA-123** (high) - Database migration pending
2. **REQ-SEC-456** (critical) - Security review required

The critical security review should be addressed first. Would you like me to prioritize REQ-SEC-456?"

---

## Security Considerations

1. **Authentication**: AI functions run with current user's permissions
2. **Audit Trail**: All AI-initiated mutations logged with `created_by: 'ai-assist'`
3. **Confirmation**: Mutation operations require user confirmation
4. **Rate Limiting**: Prevent AI from making excessive API calls
5. **Scope Limits**: AI cannot delete requests or modify completed work
