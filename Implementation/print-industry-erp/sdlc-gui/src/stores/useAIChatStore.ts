/**
 * AI Chat Store
 * Multi-provider AI chat with SDLC context integration
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AIProviderConfig,
  AIProviderType,
  ChatMessage,
  ChatSession,
  SDLCContextOptions,
  SDLCContextData,
} from '../types/ai-providers';
import { AI_PROVIDERS as PROVIDERS } from '../types/ai-providers';

// Comparison response type
interface ComparisonResponse {
  providerId: string;
  providerName: string;
  content: string;
  model: string;
  timestamp: Date;
  isLoading: boolean;
  error?: string;
}

interface AIChatStore {
  // Provider state
  providers: AIProviderConfig[];
  activeProviderId: string | null;

  // Chat state
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  // Comparison mode state
  comparisonMode: boolean;
  comparisonResponses: ComparisonResponse[];
  comparisonQuery: string;

  // SDLC Context
  sdlcContext: SDLCContextOptions;
  contextData: SDLCContextData | null;

  // Provider actions
  addProvider: (type: AIProviderType, apiKey: string) => void;
  updateProvider: (id: string, updates: Partial<AIProviderConfig>) => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string) => void;
  setDefaultProvider: (id: string) => void;

  // Chat actions
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  newSession: () => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;

  // Comparison actions
  setComparisonMode: (enabled: boolean) => void;
  sendComparisonMessage: (content: string, providerIds: string[]) => Promise<void>;
  clearComparison: () => void;

  // SDLC Context actions
  updateSDLCContext: (options: Partial<SDLCContextOptions>) => void;
  fetchSDLCContext: () => Promise<void>;

  // Utility
  getActiveProvider: () => AIProviderConfig | null;
  getProviderMeta: (type: AIProviderType) => typeof PROVIDERS[number] | undefined;
}

const DEFAULT_SDLC_CONTEXT: SDLCContextOptions = {
  includeEntities: true,
  includeColumns: false,
  includeRequests: true,
  includeRecommendations: true,
  includeBlockers: true,
  maxContextItems: 20,
};

// API endpoint mapping for different providers
const getProviderEndpoint = (provider: AIProviderConfig): string => {
  if (provider.endpoint) return provider.endpoint;
  const meta = PROVIDERS.find(p => p.type === provider.type);
  return meta?.defaultEndpoint || '';
};

// Request options type
interface ProviderRequest {
  url: string;
  options: RequestInit;
  parseResponse: (data: unknown) => string;
}

// Build request for different providers
const buildProviderRequest = (
  provider: AIProviderConfig,
  messages: ChatMessage[],
  systemPrompt: string
): ProviderRequest => {
  const endpoint = getProviderEndpoint(provider);

  switch (provider.type) {
    case 'anthropic':
      return {
        url: endpoint,
        options: {
          method: 'POST',
          headers: {
            'x-api-key': provider.apiKey || '',
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: provider.model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: messages.map(m => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content,
            })).filter(m => m.role !== 'system'),
          }),
        },
        parseResponse: (data: unknown) => {
          const d = data as { content?: Array<{ text?: string }> };
          return d.content?.[0]?.text || 'No response received.';
        },
      };

    case 'openai':
    case 'azure-openai':
      return {
        url: endpoint,
        options: {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.apiKey || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map(m => ({ role: m.role, content: m.content })),
            ],
          }),
        },
        parseResponse: (data: unknown) => {
          const d = data as { choices?: Array<{ message?: { content?: string } }> };
          return d.choices?.[0]?.message?.content || 'No response received.';
        },
      };

    case 'google-gemini': {
      const geminiEndpoint = `${endpoint}/${provider.model}:generateContent?key=${provider.apiKey || ''}`;
      return {
        url: geminiEndpoint,
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\n\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}` },
                ],
              },
            ],
          }),
        },
        parseResponse: (data: unknown) => {
          const d = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          return d.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.';
        },
      };
    }

    case 'deepseek':
      return {
        url: endpoint,
        options: {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.apiKey || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map(m => ({ role: m.role, content: m.content })),
            ],
          }),
        },
        parseResponse: (data: unknown) => {
          const d = data as { choices?: Array<{ message?: { content?: string } }> };
          return d.choices?.[0]?.message?.content || 'No response received.';
        },
      };

    case 'github-copilot':
    default:
      // GitHub Copilot with fallback to Models API
      return {
        url: endpoint,
        options: {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.apiKey || ''}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map(m => ({ role: m.role, content: m.content })),
            ],
            stream: false,
          }),
        },
        parseResponse: (data: unknown) => {
          const d = data as { choices?: Array<{ message?: { content?: string } }> };
          return d.choices?.[0]?.message?.content || 'No response received.';
        },
      };
  }
};

export const useAIChatStore = create<AIChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      providers: [],
      activeProviderId: null,
      sessions: [],
      currentSessionId: null,
      messages: [],
      isLoading: false,
      error: null,
      comparisonMode: false,
      comparisonResponses: [],
      comparisonQuery: '',
      sdlcContext: DEFAULT_SDLC_CONTEXT,
      contextData: null,

      // Provider actions
      addProvider: (type: AIProviderType, apiKey: string) => {
        const meta = PROVIDERS.find(p => p.type === type);
        if (!meta) return;

        const newProvider: AIProviderConfig = {
          id: `${type}-${Date.now()}`,
          type,
          name: meta.displayName,
          apiKey,
          model: meta.availableModels[0]?.id || '',
          endpoint: meta.defaultEndpoint,
          enabled: true,
          isDefault: get().providers.length === 0,
        };

        set(state => ({
          providers: [...state.providers, newProvider],
          activeProviderId: state.activeProviderId || newProvider.id,
        }));
      },

      updateProvider: (id: string, updates: Partial<AIProviderConfig>) => {
        set(state => ({
          providers: state.providers.map(p =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      removeProvider: (id: string) => {
        set(state => {
          const newProviders = state.providers.filter(p => p.id !== id);
          const wasActive = state.activeProviderId === id;
          const wasDefault = state.providers.find(p => p.id === id)?.isDefault;

          // If removed was default, make first remaining provider default
          if (wasDefault && newProviders.length > 0) {
            newProviders[0].isDefault = true;
          }

          return {
            providers: newProviders,
            activeProviderId: wasActive
              ? newProviders.find(p => p.isDefault)?.id || newProviders[0]?.id || null
              : state.activeProviderId,
          };
        });
      },

      setActiveProvider: (id: string) => {
        set({ activeProviderId: id, error: null });
      },

      setDefaultProvider: (id: string) => {
        set(state => ({
          providers: state.providers.map(p => ({
            ...p,
            isDefault: p.id === id,
          })),
        }));
      },

      // Chat actions
      sendMessage: async (content: string) => {
        const { activeProviderId, providers, messages, sdlcContext, contextData } = get();
        const provider = providers.find(p => p.id === activeProviderId);

        if (!provider || !provider.apiKey) {
          set({ error: 'No active provider configured. Please add an AI provider in settings.' });
          return;
        }

        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };

        set({
          messages: [...messages, userMessage],
          isLoading: true,
          error: null,
        });

        try {
          // Build system prompt with SDLC context
          let systemPrompt = 'You are a helpful AI assistant integrated into an SDLC (Software Development Lifecycle) management tool. Help users with their development workflow, code questions, and project management tasks.';

          if (contextData) {
            const contextParts: string[] = [];

            if (sdlcContext.includeEntities && contextData.entities?.length) {
              contextParts.push(`\n\nEntities in the system:\n${contextData.entities.slice(0, sdlcContext.maxContextItems).map(e => `- ${e.name} (${e.type}, ${e.status})`).join('\n')}`);
            }

            if (sdlcContext.includeRequests && contextData.requests?.length) {
              contextParts.push(`\n\nActive Requests:\n${contextData.requests.slice(0, sdlcContext.maxContextItems).map(r => `- [${r.priority}] ${r.title} (${r.status})`).join('\n')}`);
            }

            if (sdlcContext.includeRecommendations && contextData.recommendations?.length) {
              contextParts.push(`\n\nRecommendations:\n${contextData.recommendations.slice(0, sdlcContext.maxContextItems).map(r => `- ${r.title} (${r.status})`).join('\n')}`);
            }

            if (sdlcContext.includeBlockers && contextData.blockers?.length) {
              contextParts.push(`\n\nBlockers:\n${contextData.blockers.slice(0, sdlcContext.maxContextItems).map(b => `- ${b.title} (blocked by: ${b.blockedBy})`).join('\n')}`);
            }

            if (contextParts.length > 0) {
              systemPrompt += '\n\nCurrent SDLC Context:' + contextParts.join('');
            }
          }

          const request = buildProviderRequest(provider, [...get().messages], systemPrompt);

          const response = await fetch(request.url, request.options);

          if (!response.ok) {
            // Try fallback for GitHub Copilot
            if (provider.type === 'github-copilot') {
              const fallbackResponse = await fetch('https://models.inference.ai.azure.com/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${provider.apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: provider.model,
                  messages: [
                    { role: 'system', content: systemPrompt },
                    ...get().messages.map(m => ({ role: m.role, content: m.content })),
                  ],
                }),
              });

              if (!fallbackResponse.ok) {
                throw new Error('Failed to get AI response. Please check your API key permissions.');
              }

              const data = await fallbackResponse.json();
              const assistantContent = data.choices?.[0]?.message?.content || 'No response received.';

              const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: assistantContent,
                timestamp: new Date(),
                providerId: provider.id,
                model: provider.model,
              };

              set(state => ({
                messages: [...state.messages, assistantMessage],
                isLoading: false,
              }));
              return;
            }

            throw new Error(`API request failed: ${response.statusText}`);
          }

          const data = await response.json();
          const assistantContent = request.parseResponse(data);

          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date(),
            providerId: provider.id,
            model: provider.model,
          };

          set(state => ({
            messages: [...state.messages, assistantMessage],
            isLoading: false,
          }));

          // Update session
          const { currentSessionId, sessions } = get();
          if (currentSessionId) {
            const updatedSessions = sessions.map(s =>
              s.id === currentSessionId
                ? { ...s, messages: get().messages, updatedAt: new Date() }
                : s
            );
            set({ sessions: updatedSessions });
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to send message';
          set({ isLoading: false, error: message });
        }
      },

      clearMessages: () => {
        set({ messages: [], currentSessionId: null, error: null });
      },

      newSession: () => {
        const { messages, activeProviderId } = get();
        if (messages.length === 0) return;

        const newSession: ChatSession = {
          id: `session-${Date.now()}`,
          title: messages[0]?.content.slice(0, 50) || 'New Chat',
          messages,
          providerId: activeProviderId || '',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set(state => ({
          sessions: [newSession, ...state.sessions].slice(0, 50), // Keep last 50 sessions
          currentSessionId: newSession.id,
        }));
      },

      loadSession: (sessionId: string) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) {
          set({
            currentSessionId: sessionId,
            messages: session.messages,
            error: null,
          });
        }
      },

      deleteSession: (sessionId: string) => {
        set(state => ({
          sessions: state.sessions.filter(s => s.id !== sessionId),
          currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
          messages: state.currentSessionId === sessionId ? [] : state.messages,
        }));
      },

      // SDLC Context actions
      updateSDLCContext: (options: Partial<SDLCContextOptions>) => {
        set(state => ({
          sdlcContext: { ...state.sdlcContext, ...options },
        }));
      },

      fetchSDLCContext: async () => {
        const { sdlcContext } = get();

        try {
          const contextData: SDLCContextData = {};

          // Fetch data from SDLC API based on context options
          const baseUrl = 'http://localhost:5100/api';

          if (sdlcContext.includeEntities) {
            const res = await fetch(`${baseUrl}/entities?limit=${sdlcContext.maxContextItems}`);
            if (res.ok) {
              const data = await res.json();
              contextData.entities = data.map((e: { name: string; entity_type: string; status: string }) => ({
                name: e.name,
                type: e.entity_type,
                status: e.status,
              }));
            }
          }

          if (sdlcContext.includeRequests) {
            const res = await fetch(`${baseUrl}/requests?limit=${sdlcContext.maxContextItems}`);
            if (res.ok) {
              const data = await res.json();
              contextData.requests = data.map((r: { id: string; title: string; status: string; priority: string }) => ({
                id: r.id,
                title: r.title,
                status: r.status,
                priority: r.priority,
              }));
            }
          }

          if (sdlcContext.includeRecommendations) {
            const res = await fetch(`${baseUrl}/recommendations?limit=${sdlcContext.maxContextItems}`);
            if (res.ok) {
              const data = await res.json();
              contextData.recommendations = data.map((r: { id: string; title: string; status: string }) => ({
                id: r.id,
                title: r.title,
                status: r.status,
              }));
            }
          }

          set({ contextData });
        } catch (error) {
          console.error('Failed to fetch SDLC context:', error);
        }
      },

      // Comparison actions
      setComparisonMode: (enabled: boolean) => {
        set({ comparisonMode: enabled });
        if (!enabled) {
          set({ comparisonResponses: [], comparisonQuery: '' });
        }
      },

      sendComparisonMessage: async (content: string, providerIds: string[]) => {
        const { providers, sdlcContext, contextData } = get();
        const selectedProviders = providers.filter(p => providerIds.includes(p.id) && p.apiKey);

        if (selectedProviders.length === 0) {
          set({ error: 'No valid providers selected for comparison' });
          return;
        }

        // Initialize comparison responses with loading state
        const initialResponses: ComparisonResponse[] = selectedProviders.map(p => ({
          providerId: p.id,
          providerName: p.name,
          content: '',
          model: p.model,
          timestamp: new Date(),
          isLoading: true,
        }));

        set({
          comparisonResponses: initialResponses,
          comparisonQuery: content,
          error: null,
        });

        // Build system prompt with SDLC context
        let systemPrompt = 'You are a helpful AI assistant integrated into an SDLC (Software Development Lifecycle) management tool. Help users with their development workflow, code questions, and project management tasks.';

        if (contextData) {
          const contextParts: string[] = [];

          if (sdlcContext.includeEntities && contextData.entities?.length) {
            contextParts.push(`\n\nEntities in the system:\n${contextData.entities.slice(0, sdlcContext.maxContextItems).map(e => `- ${e.name} (${e.type}, ${e.status})`).join('\n')}`);
          }

          if (sdlcContext.includeRequests && contextData.requests?.length) {
            contextParts.push(`\n\nActive Requests:\n${contextData.requests.slice(0, sdlcContext.maxContextItems).map(r => `- [${r.priority}] ${r.title} (${r.status})`).join('\n')}`);
          }

          if (contextParts.length > 0) {
            systemPrompt += '\n\nCurrent SDLC Context:' + contextParts.join('');
          }
        }

        // Send requests to all providers in parallel
        const promises = selectedProviders.map(async (provider) => {
          try {
            const request = buildProviderRequest(provider, [{ id: 'user-1', role: 'user', content, timestamp: new Date() }], systemPrompt);
            let response = await fetch(request.url, request.options);

            // Fallback for GitHub Copilot
            if (!response.ok && provider.type === 'github-copilot') {
              response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${provider.apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: provider.model,
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content },
                  ],
                }),
              });
            }

            if (!response.ok) {
              throw new Error(`API request failed: ${response.statusText}`);
            }

            const data = await response.json();
            const assistantContent = request.parseResponse(data);

            // Update this provider's response
            set(state => ({
              comparisonResponses: state.comparisonResponses.map(r =>
                r.providerId === provider.id
                  ? { ...r, content: assistantContent, isLoading: false }
                  : r
              ),
            }));
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get response';
            set(state => ({
              comparisonResponses: state.comparisonResponses.map(r =>
                r.providerId === provider.id
                  ? { ...r, error: message, isLoading: false }
                  : r
              ),
            }));
          }
        });

        await Promise.all(promises);
      },

      clearComparison: () => {
        set({ comparisonResponses: [], comparisonQuery: '' });
      },

      // Utility
      getActiveProvider: () => {
        const { providers, activeProviderId } = get();
        return providers.find(p => p.id === activeProviderId) || null;
      },

      getProviderMeta: (type: AIProviderType) => {
        return PROVIDERS.find(p => p.type === type);
      },
    }),
    {
      name: 'ai-chat-storage',
      partialize: (state) => ({
        providers: state.providers.map(p => ({ ...p, apiKey: p.apiKey })), // Store tokens
        activeProviderId: state.activeProviderId,
        sessions: state.sessions.slice(0, 20), // Keep last 20 sessions
        sdlcContext: state.sdlcContext,
      }),
    }
  )
);
