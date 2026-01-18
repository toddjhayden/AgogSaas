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

// Provider-specific model options (not exhaustive due to dynamic models)
export interface ProviderModels {
  'github-copilot': string; // Many models available via GitHub Models
  'anthropic': string; // Claude models
  'openai': string; // GPT models
  'google-gemini': string; // Gemini models
  'deepseek': string; // DeepSeek models
  'azure-openai': string; // Custom deployment names
}

// Dynamic model info for fetched models
export interface DynamicModelInfo {
  id: string;
  name: string;
  description: string;
  provider?: string;
  contextLength?: number;
  capabilities?: string[];
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
  fetchedModels?: DynamicModelInfo[]; // Models fetched from provider API
  modelsLastFetched?: Date;
}

// Provider metadata (display info)
export interface AIProviderMeta {
  type: AIProviderType;
  displayName: string;
  description: string;
  iconName: string;
  defaultEndpoint: string;
  modelsEndpoint?: string; // API endpoint to fetch available models
  tokenPlaceholder: string;
  tokenHelpUrl: string;
  supportsModelFetching: boolean; // Whether we can dynamically fetch models
  fallbackModels: Array<{
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
    displayName: 'GitHub Models',
    description: 'Access to multiple AI models via GitHub',
    iconName: 'Github',
    defaultEndpoint: 'https://models.inference.ai.azure.com/chat/completions',
    modelsEndpoint: 'https://models.github.ai/catalog/models',
    tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    tokenHelpUrl: 'https://github.com/settings/tokens/new?scopes=copilot,read:user',
    supportsModelFetching: true,
    fallbackModels: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI - Most capable' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'OpenAI - Fast' },
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
    supportsModelFetching: false, // Anthropic doesn't have a public models endpoint
    fallbackModels: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced performance' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Fast and capable' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest model' },
    ],
  },
  {
    type: 'openai',
    displayName: 'OpenAI',
    description: 'GPT models from OpenAI',
    iconName: 'Sparkles',
    defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    modelsEndpoint: 'https://api.openai.com/v1/models',
    tokenPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
    tokenHelpUrl: 'https://platform.openai.com/api-keys',
    supportsModelFetching: true,
    fallbackModels: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable multimodal' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient' },
    ],
  },
  {
    type: 'google-gemini',
    displayName: 'Google Gemini',
    description: 'Google\'s Gemini models',
    iconName: 'Gem',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    tokenPlaceholder: 'AIzaSyxxxxxxxxxxxxxxxxxx',
    tokenHelpUrl: 'https://aistudio.google.com/app/apikey',
    supportsModelFetching: true,
    fallbackModels: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Latest fast model' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable' },
    ],
  },
  {
    type: 'deepseek',
    displayName: 'DeepSeek',
    description: 'DeepSeek AI models',
    iconName: 'Search',
    defaultEndpoint: 'https://api.deepseek.com/chat/completions',
    modelsEndpoint: 'https://api.deepseek.com/models',
    tokenPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
    tokenHelpUrl: 'https://platform.deepseek.com/api_keys',
    supportsModelFetching: true,
    fallbackModels: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'Latest general purpose' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Advanced reasoning' },
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
    supportsModelFetching: false, // Requires custom endpoint configuration
    fallbackModels: [
      { id: 'custom', name: 'Custom Deployment', description: 'Your Azure deployment' },
    ],
  },
];
