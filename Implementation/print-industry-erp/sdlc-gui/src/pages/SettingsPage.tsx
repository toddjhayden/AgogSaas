/**
 * Settings Page
 * Configuration for AI Providers and SDLC Context integration
 */

import { useState, useEffect } from 'react';
import {
  Settings,
  Github,
  Bot,
  Key,
  Check,
  ExternalLink,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Database,
  Sparkles,
  Cloud,
  Search,
  Gem,
  RefreshCw,
  Loader2,
  Server,
  AlertTriangle,
  CheckCircle,
  GitCommit,
  Package,
} from 'lucide-react';
import { useAIChatStore } from '../stores/useAIChatStore';
import { AI_PROVIDERS, type AIProviderType } from '../types/ai-providers';
import { useSDLCSettingsStore } from '../stores/useSDLCSettingsStore';
import { getVersion, type VersionInfo } from '../api/sdlc-client';
import { GUI_VERSION, GUI_COMMIT, GUI_REVISION } from '../config/version';

// Icon mapping for providers
const providerIcons: Record<AIProviderType, typeof Github> = {
  'github-copilot': Github,
  'anthropic': Bot,
  'openai': Sparkles,
  'google-gemini': Gem,
  'deepseek': Search,
  'azure-openai': Cloud,
};

export function SettingsPage() {
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [newProviderType, setNewProviderType] = useState<AIProviderType | null>(null);
  const [newProviderToken, setNewProviderToken] = useState('');
  const [showNewToken, setShowNewToken] = useState(false);
  const [apiVersion, setApiVersion] = useState<VersionInfo | null>(null);
  const [versionLoading, setVersionLoading] = useState(true);

  const {
    providers,
    activeProviderId,
    sdlcContext,
    isLoadingModels,
    addProvider,
    updateProvider,
    removeProvider,
    setActiveProvider,
    setDefaultProvider,
    updateSDLCContext,
    fetchSDLCContext,
    fetchModelsForProvider,
  } = useAIChatStore();

  // Fetch API version on mount
  useEffect(() => {
    const fetchVersion = async () => {
      setVersionLoading(true);
      const result = await getVersion();
      if (result.success && result.data) {
        setApiVersion(result.data);
      }
      setVersionLoading(false);
    };
    fetchVersion();
  }, []);

  const handleAddProvider = () => {
    if (newProviderType && newProviderToken.trim()) {
      addProvider(newProviderType, newProviderToken.trim());
      setNewProviderType(null);
      setNewProviderToken('');
      setShowNewToken(false);
    }
  };

  const getProviderMeta = (type: AIProviderType) => {
    return AI_PROVIDERS.find(p => p.type === type);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={28} className="text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
      </div>

      {/* System Revision Section - At the top */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Package size={24} className="text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">System Revisions</h2>
              <p className="text-sm text-slate-500">Version alignment for SDLC Control components</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* GUI Revision */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <GitCommit size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-800">GUI Revision</span>
              </div>
              <div className="font-mono text-lg text-blue-900">{GUI_VERSION}</div>
              <div className="font-mono text-xs text-blue-600 mt-1">{GUI_COMMIT}</div>
            </div>

            {/* API Revision */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Server size={16} className="text-purple-600" />
                <span className="text-sm font-medium text-purple-800">API Revision</span>
              </div>
              {versionLoading ? (
                <div className="flex items-center gap-2 text-purple-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : apiVersion ? (
                <>
                  <div className="font-mono text-lg text-purple-900">{apiVersion.api.version}</div>
                  <div className="font-mono text-xs text-purple-600 mt-1">{apiVersion.api.commit}</div>
                </>
              ) : (
                <div className="text-sm text-purple-600">Unavailable</div>
              )}
            </div>

            {/* Database Revision */}
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Database size={16} className="text-green-600" />
                <span className="text-sm font-medium text-green-800">DB Revision</span>
              </div>
              {versionLoading ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : apiVersion ? (
                <>
                  <div className="font-mono text-lg text-green-900">{apiVersion.database.version}</div>
                  <div className="font-mono text-xs text-green-600 mt-1">migrations applied</div>
                </>
              ) : (
                <div className="text-sm text-green-600">Unavailable</div>
              )}
            </div>
          </div>

          {/* Full revision string for copy/paste */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs text-slate-500 mb-1">Full Revision String</div>
            <code className="text-sm text-slate-700 font-mono">
              GUI:{GUI_REVISION} | API:{apiVersion?.api.revision || '...'} | DB:{apiVersion?.database.version || '...'}
            </code>
          </div>
        </div>
      </div>

      {/* AI Providers Section */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg">
                <Bot size={24} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">AI Providers</h2>
                <p className="text-sm text-slate-500">Connect multiple AI services for chat assistance</p>
              </div>
            </div>
            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {providers.length} configured
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Configured Providers */}
          {providers.map((provider) => {
            const meta = getProviderMeta(provider.type);
            const Icon = providerIcons[provider.type];
            const isExpanded = expandedProvider === provider.id;

            return (
              <div
                key={provider.id}
                className={`border rounded-lg transition-all ${
                  provider.id === activeProviderId
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200'
                }`}
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      provider.id === activeProviderId ? 'bg-blue-200' : 'bg-slate-100'
                    }`}>
                      <Icon size={20} className={
                        provider.id === activeProviderId ? 'text-blue-700' : 'text-slate-600'
                      } />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{provider.name}</span>
                        {provider.isDefault && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                        {provider.id === activeProviderId && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-slate-500">{provider.model}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      provider.apiKey ? 'bg-green-500' : 'bg-slate-300'
                    }`} />
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-200 pt-4">
                    {/* Model Selection */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Model
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={provider.model}
                          onChange={(e) => updateProvider(provider.id, { model: e.target.value })}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isLoadingModels[provider.id]}
                        >
                          {/* Use fetched models if available, otherwise fallback models */}
                          {(provider.fetchedModels && provider.fetchedModels.length > 0
                            ? provider.fetchedModels
                            : meta?.fallbackModels || []
                          ).map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}{model.description ? ` - ${model.description}` : ''}
                            </option>
                          ))}
                        </select>
                        {meta?.supportsModelFetching && (
                          <button
                            onClick={() => fetchModelsForProvider(provider.id)}
                            disabled={isLoadingModels[provider.id]}
                            className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                            title="Refresh available models"
                          >
                            {isLoadingModels[provider.id] ? (
                              <Loader2 size={18} className="animate-spin text-slate-500" />
                            ) : (
                              <RefreshCw size={18} className="text-slate-500" />
                            )}
                          </button>
                        )}
                      </div>
                      {provider.fetchedModels && provider.fetchedModels.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          {provider.fetchedModels.length} models available
                          {provider.modelsLastFetched && (
                            <> · Last updated {new Date(provider.modelsLastFetched).toLocaleDateString()}</>
                          )}
                        </p>
                      )}
                      {!provider.fetchedModels && meta?.supportsModelFetching && (
                        <p className="text-xs text-amber-600 mt-1">
                          Click refresh to load available models from {meta.displayName}
                        </p>
                      )}
                    </div>

                    {/* Custom Endpoint (for Azure) */}
                    {provider.type === 'azure-openai' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Endpoint URL
                        </label>
                        <input
                          type="text"
                          value={provider.endpoint || ''}
                          onChange={(e) => updateProvider(provider.id, { endpoint: e.target.value })}
                          placeholder="https://your-resource.openai.azure.com/..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        {!provider.isDefault && (
                          <button
                            onClick={() => setDefaultProvider(provider.id)}
                            className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded hover:bg-blue-50"
                          >
                            Set as Default
                          </button>
                        )}
                        {provider.id !== activeProviderId && (
                          <button
                            onClick={() => setActiveProvider(provider.id)}
                            className="text-sm text-slate-600 hover:text-slate-700 px-3 py-1.5 rounded hover:bg-slate-100"
                          >
                            Use for Chat
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => removeProvider(provider.id)}
                        className="text-sm text-red-600 hover:text-red-700 px-3 py-1.5 rounded hover:bg-red-50 flex items-center gap-1"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add New Provider */}
          {!newProviderType ? (
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6">
              <p className="text-sm text-slate-600 mb-4 text-center">
                Add a new AI provider to use for chat
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {AI_PROVIDERS.map((providerMeta) => {
                  const Icon = providerIcons[providerMeta.type];
                  const isConfigured = providers.some(p => p.type === providerMeta.type);

                  return (
                    <button
                      key={providerMeta.type}
                      onClick={() => !isConfigured && setNewProviderType(providerMeta.type)}
                      disabled={isConfigured}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                        isConfigured
                          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-sm font-medium">{providerMeta.displayName}</span>
                      {isConfigured && <Check size={14} className="ml-auto text-green-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="border border-blue-300 bg-blue-50 rounded-lg p-6">
              {(() => {
                const meta = getProviderMeta(newProviderType);
                const Icon = providerIcons[newProviderType];
                return (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-200 rounded-lg">
                        <Icon size={20} className="text-blue-700" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-800">{meta?.displayName}</h3>
                        <p className="text-sm text-slate-500">{meta?.description}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block">
                        <span className="text-slate-700 font-medium flex items-center gap-2">
                          <Key size={16} />
                          API Key
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type={showNewToken ? 'text' : 'password'}
                          value={newProviderToken}
                          onChange={(e) => setNewProviderToken(e.target.value)}
                          placeholder={meta?.tokenPlaceholder}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <button
                          onClick={() => setShowNewToken(!showNewToken)}
                          className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-white transition-colors"
                        >
                          {showNewToken ? 'Hide' : 'Show'}
                        </button>
                      </div>

                      <a
                        href={meta?.tokenHelpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm"
                      >
                        Get an API key
                        <ExternalLink size={14} />
                      </a>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          onClick={() => {
                            setNewProviderType(null);
                            setNewProviderToken('');
                            setShowNewToken(false);
                          }}
                          className="px-4 py-2 text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddProvider}
                          disabled={!newProviderToken.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Plus size={16} />
                          Add Provider
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* SDLC Context Integration */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Database size={24} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">SDLC Context</h2>
              <p className="text-sm text-slate-500">Include project data in AI conversations</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            When enabled, AI providers will receive context about your SDLC data to provide more relevant assistance.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'includeEntities', label: 'Entities', desc: 'Tables, views, and data models' },
              { key: 'includeColumns', label: 'Columns', desc: 'Column definitions and metadata' },
              { key: 'includeRequests', label: 'Requests', desc: 'Active feature requests and bugs' },
              { key: 'includeRecommendations', label: 'Recommendations', desc: 'AI recommendations and suggestions' },
              { key: 'includeBlockers', label: 'Blockers', desc: 'Current blockers and dependencies' },
            ].map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
              >
                <div>
                  <span className="font-medium text-slate-800">{label}</span>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <button
                  onClick={() => updateSDLCContext({ [key]: !sdlcContext[key as keyof typeof sdlcContext] })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    sdlcContext[key as keyof typeof sdlcContext] ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      sdlcContext[key as keyof typeof sdlcContext] ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Max Context Items
              </label>
              <p className="text-xs text-slate-500">Limit items sent to AI per category</p>
            </div>
            <select
              value={sdlcContext.maxContextItems}
              onChange={(e) => updateSDLCContext({ maxContextItems: parseInt(e.target.value) })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10 items</option>
              <option value={20}>20 items</option>
              <option value={50}>50 items</option>
              <option value={100}>100 items</option>
            </select>
          </div>

          <button
            onClick={fetchSDLCContext}
            className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Refresh Context Data
          </button>
        </div>
      </div>

      {/* SDLC API Configuration */}
      <SDLCAPISettings />
    </div>
  );
}

/**
 * SDLC API Settings Component
 */
function SDLCAPISettings() {
  const {
    apiUrl,
    apiHealth,
    isCheckingHealth,
    setApiUrl,
    checkApiHealth,
  } = useSDLCSettingsStore();

  const [customUrl, setCustomUrl] = useState(apiUrl);
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Check health on mount
  useEffect(() => {
    checkApiHealth();
  }, [checkApiHealth]);

  // Sync custom URL with store
  useEffect(() => {
    setCustomUrl(apiUrl);
  }, [apiUrl]);

  const handlePresetSelect = (url: string) => {
    setApiUrl(url);
    setShowCustomInput(false);
  };

  const handleCustomUrlSave = () => {
    if (customUrl.trim()) {
      setApiUrl(customUrl.trim());
    }
  };

  const presets = [
    { label: 'Production (VPS)', url: 'https://api.agog.fyi/api' },
    { label: 'Local Development', url: 'http://localhost:5100/api' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Server size={24} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">SDLC API</h2>
              <p className="text-sm text-slate-500">Configure the backend API connection</p>
            </div>
          </div>
          {/* Health Status Badge */}
          <div className="flex items-center gap-2">
            {isCheckingHealth ? (
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Checking...
              </span>
            ) : apiHealth.isHealthy ? (
              <span className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                <CheckCircle size={14} />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full">
                <AlertTriangle size={14} />
                Disconnected
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Current URL Display */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-500 mb-1">Current API URL</div>
          <code className="text-sm text-slate-800 font-mono break-all">{apiUrl}</code>
        </div>

        {/* Preset Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Quick Select
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.url}
                onClick={() => handlePresetSelect(preset.url)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                  apiUrl === preset.url
                    ? 'border-purple-300 bg-purple-50 text-purple-800'
                    : 'border-slate-200 hover:border-purple-200 hover:bg-purple-50'
                }`}
              >
                <div>
                  <div className="font-medium text-sm">{preset.label}</div>
                  <div className="text-xs text-slate-500 font-mono">{preset.url}</div>
                </div>
                {apiUrl === preset.url && <Check size={16} className="text-purple-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* Custom URL Input */}
        <div>
          <button
            onClick={() => setShowCustomInput(!showCustomInput)}
            className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            {showCustomInput ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showCustomInput ? 'Hide custom URL' : 'Use custom URL'}
          </button>

          {showCustomInput && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://your-api.example.com/api"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
              />
              <button
                onClick={handleCustomUrlSave}
                disabled={!customUrl.trim() || customUrl === apiUrl}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-sm"
              >
                Save
              </button>
            </div>
          )}
        </div>

        {/* Health Details */}
        {apiHealth.lastCheck && (
          <div className="border-t border-slate-200 pt-4">
            <div className="text-sm font-medium text-slate-700 mb-2">Connection Status</div>
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-2 rounded border ${apiHealth.database ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-xs text-slate-500">Database</div>
                <div className={`font-medium ${apiHealth.database ? 'text-green-700' : 'text-red-700'}`}>
                  {apiHealth.database ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              <div className={`p-2 rounded border ${apiHealth.nats ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="text-xs text-slate-500">NATS (Events)</div>
                <div className={`font-medium ${apiHealth.nats ? 'text-green-700' : 'text-amber-700'}`}>
                  {apiHealth.nats ? 'Connected' : 'Disconnected'}
                </div>
              </div>
            </div>
            {apiHealth.error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-700">{apiHealth.error}</div>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Last checked: {new Date(apiHealth.lastCheck).toLocaleTimeString()}
              </span>
              <button
                onClick={checkApiHealth}
                disabled={isCheckingHealth}
                className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <RefreshCw size={14} className={isCheckingHealth ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
