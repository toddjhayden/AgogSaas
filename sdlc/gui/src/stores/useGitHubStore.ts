/**
 * GitHub AI Chat Store
 * Manages GitHub authentication and chat state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GitHubUser, ChatMessage, GitHubSettings, GitHubAuthState, ChatState } from '../types/github';

interface GitHubStore extends GitHubAuthState, ChatState {
  settings: GitHubSettings;

  // Auth actions
  setToken: (token: string) => Promise<void>;
  logout: () => void;

  // Chat actions
  togglePanel: () => void;
  toggleEnabled: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;

  // Settings actions
  updateSettings: (settings: Partial<GitHubSettings>) => void;
}

const GITHUB_API_BASE = 'https://api.github.com';

export const useGitHubStore = create<GitHubStore>()(
  persist(
    (set, get) => ({
      // Auth state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Chat state
      messages: [],
      isEnabled: false, // Disabled by default
      isPanelOpen: false,

      // Settings
      settings: {
        token: null,
        model: 'gpt-4o-mini',
        enabled: false,
      },

      // Auth actions
      setToken: async (token: string) => {
        set({ isLoading: true, error: null });

        try {
          // Validate token by fetching user info
          const response = await fetch(`${GITHUB_API_BASE}/user`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          });

          if (!response.ok) {
            throw new Error('Invalid GitHub token');
          }

          const user: GitHubUser = await response.json();

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            settings: { ...get().settings, token },
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Authentication failed';
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: message,
            settings: { ...get().settings, token: null },
          });
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          messages: [],
          isEnabled: false,
          isPanelOpen: false,
          settings: {
            token: null,
            model: 'gpt-4o-mini',
            enabled: false,
          },
        });
      },

      // Chat actions
      togglePanel: () => {
        const { isEnabled, isPanelOpen } = get();
        if (isEnabled) {
          set({ isPanelOpen: !isPanelOpen });
        }
      },

      toggleEnabled: () => {
        const { isEnabled, isAuthenticated, settings } = get();
        if (isAuthenticated) {
          const newEnabled = !isEnabled;
          set({
            isEnabled: newEnabled,
            isPanelOpen: newEnabled,
            settings: { ...settings, enabled: newEnabled },
          });
        }
      },

      sendMessage: async (content: string) => {
        const { messages, settings, isEnabled, isAuthenticated } = get();

        if (!isEnabled || !isAuthenticated || !settings.token) {
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
          // Use GitHub Copilot Chat API (Models API)
          const response = await fetch('https://api.githubcopilot.com/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${settings.token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              model: settings.model,
              messages: [
                {
                  role: 'system',
                  content: 'You are a helpful AI assistant integrated into an SDLC (Software Development Lifecycle) management tool. Help users with their development workflow, code questions, and project management tasks.',
                },
                ...get().messages.map(m => ({
                  role: m.role,
                  content: m.content,
                })),
                { role: 'user', content },
              ],
              stream: false,
            }),
          });

          if (!response.ok) {
            // Fallback: Try using standard GitHub Models API
            const modelsResponse = await fetch('https://models.inference.ai.azure.com/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${settings.token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: settings.model,
                messages: [
                  {
                    role: 'system',
                    content: 'You are a helpful AI assistant integrated into an SDLC management tool.',
                  },
                  { role: 'user', content },
                ],
              }),
            });

            if (!modelsResponse.ok) {
              throw new Error('Failed to get AI response. Please check your GitHub token permissions.');
            }

            const data = await modelsResponse.json();
            const assistantContent = data.choices?.[0]?.message?.content || 'No response received.';

            const assistantMessage: ChatMessage = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: assistantContent,
              timestamp: new Date(),
            };

            set(state => ({
              messages: [...state.messages, assistantMessage],
              isLoading: false,
            }));
            return;
          }

          const data = await response.json();
          const assistantContent = data.choices?.[0]?.message?.content || 'No response received.';

          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date(),
          };

          set(state => ({
            messages: [...state.messages, assistantMessage],
            isLoading: false,
          }));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to send message';
          set({ isLoading: false, error: message });
        }
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      // Settings actions
      updateSettings: (newSettings: Partial<GitHubSettings>) => {
        set(state => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },
    }),
    {
      name: 'github-ai-chat-storage',
      partialize: (state) => ({
        settings: state.settings,
        isEnabled: state.isEnabled,
      }),
    }
  )
);
