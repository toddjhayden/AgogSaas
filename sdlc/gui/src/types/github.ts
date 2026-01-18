/**
 * GitHub AI Chat Types
 */

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface GitHubSettings {
  token: string | null;
  model: 'gpt-4o' | 'gpt-4o-mini' | 'o1-preview' | 'o1-mini' | 'claude-3.5-sonnet';
  enabled: boolean;
}

export interface GitHubAuthState {
  user: GitHubUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ChatState {
  messages: ChatMessage[];
  isEnabled: boolean;
  isPanelOpen: boolean;
  isLoading: boolean;
  error: string | null;
}
