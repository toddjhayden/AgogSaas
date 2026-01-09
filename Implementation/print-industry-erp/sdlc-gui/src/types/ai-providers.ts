/**
 * AI Provider Types
 * Support for multiple AI providers with SDLC context integration
 */

// Supported AI Providers
export type AIProviderType =
  | 'github-copilot'
  | 'anthropic'
  | 'openai'
  | 'google-gemini'
  | 'deepseek'
  | 'azure-openai';

// Provider-specific model options
export interface ProviderModels {
  'github-copilot': 'gpt-4o' | 'gpt-4o-mini' | 'o1-preview' | 'o1-mini' | 'claude-3.5-sonnet';
  'anthropic': 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514' | 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022';
  'openai': 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'o1-preview' | 'o1-mini';
  'google-gemini': 'gemini-2.0-flash' | 'gemini-1.5-pro' | 'gemini-1.5-flash';
  'deepseek': 'deepseek-chat' | 'deepseek-coder';
  'azure-openai': string; // Custom deployment names
}

// Provider configuration
export interface AIProviderConfig {
  id: string;
  type: AIProviderType;
  name: string;
  apiKey: string | null;
  model: string;
  endpoint?: string; // Custom endpoint for self-hosted or Azure
  enabled: boolean;
  isDefault: boolean;
}

// Provider metadata (display info)
export interface AIProviderMeta {
  type: AIProviderType;
  displayName: string;
  description: string;
  iconName: string;
  defaultEndpoint: string;
  tokenPlaceholder: string;
  tokenHelpUrl: string;
  availableModels: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

// SDLC Context options
export interface SDLCContextOptions {
  includeEntities: boolean;
  includeColumns: boolean;
  includeRequests: boolean;
  includeRecommendations: boolean;
  includeBlockers: boolean;
  maxContextItems: number;
}

// Chat message with provider info
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  providerId?: string;
  model?: string;
  isStreaming?: boolean;
}

// Chat session
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
}

// AI Chat Store State
export interface AIChatState {
  providers: AIProviderConfig[];
  activeProviderId: string | null;
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sdlcContext: SDLCContextOptions;
}

// Provider status (for UI display)
export interface ProviderStatus {
  id: string;
  type: AIProviderType;
  name: string;
  isConnected: boolean;
  isDefault: boolean;
  lastUsed?: Date;
}

// SDLC Context data passed to AI
export interface SDLCContextData {
  entities?: Array<{ name: string; type: string; status: string }>;
  columns?: Array<{ name: string; entity: string; dataType: string }>;
  requests?: Array<{ id: string; title: string; status: string; priority: string }>;
  recommendations?: Array<{ id: string; title: string; status: string }>;
  blockers?: Array<{ id: string; title: string; blockedBy: string }>;
}

// Provider definitions with metadata
export const AI_PROVIDERS: AIProviderMeta[] = [
  {
    type: 'github-copilot',
    displayName: 'GitHub Copilot',
    description: 'AI-powered code completion and chat',
    iconName: 'Github',
    defaultEndpoint: 'https://api.githubcopilot.com/chat/completions',
    tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    tokenHelpUrl: 'https://github.com/settings/tokens/new?scopes=copilot,read:user',
    availableModels: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient' },
      { id: 'o1-preview', name: 'o1-preview', description: 'Advanced reasoning' },
      { id: 'o1-mini', name: 'o1-mini', description: 'Reasoning optimized' },
      { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic model via GitHub' },
    ],
  },
  {
    type: 'anthropic',
    displayName: 'Claude AI',
    description: 'Anthropic\'s Claude models',
    iconName: 'Bot',
    defaultEndpoint: 'https://api.anthropic.com/v1/messages',
    tokenPlaceholder: 'sk-ant-xxxxxxxxxxxxxxxxxxxx',
    tokenHelpUrl: 'https://console.anthropic.com/settings/keys',
    availableModels: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest balanced model' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Previous generation' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient' },
    ],
  },
  {
    type: 'openai',
    displayName: 'OpenAI',
    description: 'GPT models from OpenAI',
    iconName: 'Sparkles',
    defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    tokenPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
    tokenHelpUrl: 'https://platform.openai.com/api-keys',
    availableModels: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High performance' },
      { id: 'o1-preview', name: 'o1-preview', description: 'Advanced reasoning' },
      { id: 'o1-mini', name: 'o1-mini', description: 'Reasoning optimized' },
    ],
  },
  {
    type: 'google-gemini',
    displayName: 'Google Gemini',
    description: 'Google\'s Gemini models',
    iconName: 'Gem',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    tokenPlaceholder: 'AIzaSyxxxxxxxxxxxxxxxxxx',
    tokenHelpUrl: 'https://aistudio.google.com/app/apikey',
    availableModels: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Latest fast model' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient' },
    ],
  },
  {
    type: 'deepseek',
    displayName: 'DeepSeek',
    description: 'DeepSeek AI models',
    iconName: 'Search',
    defaultEndpoint: 'https://api.deepseek.com/chat/completions',
    tokenPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
    tokenHelpUrl: 'https://platform.deepseek.com/api_keys',
    availableModels: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'General purpose' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', description: 'Code specialized' },
    ],
  },
  {
    type: 'azure-openai',
    displayName: 'Azure OpenAI',
    description: 'OpenAI models via Azure',
    iconName: 'Cloud',
    defaultEndpoint: '',
    tokenPlaceholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    tokenHelpUrl: 'https://portal.azure.com/#blade/Microsoft_Azure_ProjectOxford/CognitiveServicesHub',
    availableModels: [
      { id: 'custom', name: 'Custom Deployment', description: 'Your Azure deployment' },
    ],
  },
];
