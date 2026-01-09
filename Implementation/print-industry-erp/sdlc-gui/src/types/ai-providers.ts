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
    displayName: 'GitHub Models',
    description: 'Access to multiple AI models via GitHub',
    iconName: 'Github',
    defaultEndpoint: 'https://models.inference.ai.azure.com/chat/completions',
    tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    tokenHelpUrl: 'https://github.com/settings/tokens/new?scopes=copilot,read:user',
    availableModels: [
      // OpenAI Models
      { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI - Most capable multimodal' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'OpenAI - Fast and efficient' },
      { id: 'o1', name: 'o1', description: 'OpenAI - Advanced reasoning' },
      { id: 'o1-mini', name: 'o1 Mini', description: 'OpenAI - Compact reasoning' },
      { id: 'o1-preview', name: 'o1 Preview', description: 'OpenAI - Preview reasoning' },
      { id: 'o3-mini', name: 'o3 Mini', description: 'OpenAI - Latest mini model' },
      // Anthropic Models via GitHub
      { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic - Balanced' },
      { id: 'claude-3-5-sonnet-v2', name: 'Claude 3.5 Sonnet v2', description: 'Anthropic - Latest' },
      // Meta Llama Models
      { id: 'Meta-Llama-3.1-405B-Instruct', name: 'Llama 3.1 405B', description: 'Meta - Largest open model' },
      { id: 'Meta-Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B', description: 'Meta - High performance' },
      { id: 'Meta-Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', description: 'Meta - Efficient' },
      { id: 'Llama-3.2-90B-Vision-Instruct', name: 'Llama 3.2 90B Vision', description: 'Meta - Multimodal' },
      { id: 'Llama-3.2-11B-Vision-Instruct', name: 'Llama 3.2 11B Vision', description: 'Meta - Vision capable' },
      { id: 'Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B', description: 'Meta - Latest iteration' },
      // Mistral Models
      { id: 'Mistral-large-2411', name: 'Mistral Large', description: 'Mistral - Most capable' },
      { id: 'Mistral-Nemo', name: 'Mistral Nemo', description: 'Mistral - Efficient' },
      { id: 'Mistral-small', name: 'Mistral Small', description: 'Mistral - Compact' },
      { id: 'Ministral-3B', name: 'Ministral 3B', description: 'Mistral - Tiny but capable' },
      // Microsoft Phi Models
      { id: 'Phi-4', name: 'Phi-4', description: 'Microsoft - Latest Phi model' },
      { id: 'Phi-3.5-MoE-instruct', name: 'Phi-3.5 MoE', description: 'Microsoft - Mixture of experts' },
      { id: 'Phi-3.5-mini-instruct', name: 'Phi-3.5 Mini', description: 'Microsoft - Small footprint' },
      { id: 'Phi-3.5-vision-instruct', name: 'Phi-3.5 Vision', description: 'Microsoft - Vision capable' },
      { id: 'Phi-3-medium-128k-instruct', name: 'Phi-3 Medium 128K', description: 'Microsoft - Long context' },
      // Cohere Models
      { id: 'Cohere-command-r-plus-08-2024', name: 'Command R+', description: 'Cohere - Enterprise RAG' },
      { id: 'Cohere-command-r-08-2024', name: 'Command R', description: 'Cohere - RAG optimized' },
      // AI21 Models
      { id: 'AI21-Jamba-1.5-Large', name: 'Jamba 1.5 Large', description: 'AI21 - Large model' },
      { id: 'AI21-Jamba-1.5-Mini', name: 'Jamba 1.5 Mini', description: 'AI21 - Efficient' },
      // DeepSeek via GitHub
      { id: 'DeepSeek-V3', name: 'DeepSeek V3', description: 'DeepSeek - General purpose' },
      { id: 'DeepSeek-R1', name: 'DeepSeek R1', description: 'DeepSeek - Reasoning' },
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
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Latest flagship model' },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced performance' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'High capability' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Fast and capable' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest model' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Previous flagship' },
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
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable multimodal' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High performance' },
      { id: 'o1', name: 'o1', description: 'Advanced reasoning' },
      { id: 'o1-mini', name: 'o1 Mini', description: 'Compact reasoning' },
      { id: 'o1-preview', name: 'o1 Preview', description: 'Preview reasoning' },
      { id: 'o3-mini', name: 'o3 Mini', description: 'Latest reasoning model' },
      { id: 'gpt-4', name: 'GPT-4', description: 'Original GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and affordable' },
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
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp', description: 'Experimental - Latest capabilities' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Latest fast model' },
      { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Thinking', description: 'Experimental - Reasoning' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable' },
      { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro Latest', description: 'Latest Pro version' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient' },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', description: 'Compact and fast' },
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
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'Latest general purpose' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Advanced reasoning' },
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
