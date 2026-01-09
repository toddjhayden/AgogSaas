/**
 * Settings Page
 * Configuration for GitHub AI Chat and other settings
 */

import { useState } from 'react';
import {
  Settings,
  Github,
  Bot,
  Key,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { useGitHubStore } from '../stores/useGitHubStore';

export function SettingsPage() {
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);

  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    isEnabled,
    settings,
    setToken,
    logout,
    toggleEnabled,
    updateSettings,
  } = useGitHubStore();

  const handleSaveToken = async () => {
    if (tokenInput.trim()) {
      await setToken(tokenInput.trim());
      setTokenInput('');
    }
  };

  const models = [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable' },
    { id: 'o1-mini', name: 'o1-mini', description: 'Reasoning optimized' },
    { id: 'o1-preview', name: 'o1-preview', description: 'Advanced reasoning' },
    { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic model' },
  ] as const;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={28} className="text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
      </div>

      {/* GitHub AI Chat Section */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Github size={24} className="text-slate-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">GitHub AI Chat</h2>
              <p className="text-sm text-slate-500">Connect GitHub for AI-powered assistance</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-slate-700 font-medium">Connection Status</span>
              {isAuthenticated ? (
                <span className="flex items-center gap-1 text-green-600 text-sm bg-green-50 px-2 py-1 rounded">
                  <Check size={14} />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-500 text-sm bg-slate-100 px-2 py-1 rounded">
                  <X size={14} />
                  Not connected
                </span>
              )}
            </div>
            {isAuthenticated && user && (
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-slate-700">{user.login}</span>
                <button
                  onClick={logout}
                  className="ml-2 p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Disconnect"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Token Input */}
          {!isAuthenticated && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-slate-700 font-medium flex items-center gap-2">
                  <Key size={16} />
                  GitHub Personal Access Token
                </span>
                <p className="text-sm text-slate-500 mt-1">
                  Create a token with <code className="bg-slate-100 px-1 rounded">copilot</code> or <code className="bg-slate-100 px-1 rounded">read:user</code> scope
                </p>
              </label>
              <div className="flex gap-2">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={handleSaveToken}
                  disabled={!tokenInput.trim() || isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isLoading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Connect
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              <a
                href="https://github.com/settings/tokens/new?scopes=copilot,read:user&description=SDLC%20GUI%20AI%20Chat"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm"
              >
                Create a new token
                <ExternalLink size={14} />
              </a>
            </div>
          )}

          {/* Chat Enable Toggle */}
          <div className="flex items-center justify-between py-3 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <Bot size={20} className="text-slate-600" />
              <div>
                <span className="text-slate-700 font-medium">Enable AI Chat Panel</span>
                <p className="text-sm text-slate-500">Show chat panel in sidebar</p>
              </div>
            </div>
            <button
              onClick={toggleEnabled}
              disabled={!isAuthenticated}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isEnabled ? 'bg-blue-600' : 'bg-slate-300'
              } ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  isEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Model Selection */}
          {isAuthenticated && (
            <div className="py-3 border-t border-slate-200">
              <label className="block mb-3">
                <span className="text-slate-700 font-medium">AI Model</span>
                <p className="text-sm text-slate-500">Select the model for chat responses</p>
              </label>
              <div className="grid grid-cols-1 gap-2">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => updateSettings({ model: model.id })}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                      settings.model === model.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-left">
                      <span className="font-medium text-slate-800">{model.name}</span>
                      <p className="text-sm text-slate-500">{model.description}</p>
                    </div>
                    {settings.model === model.id && (
                      <Check size={20} className="text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Additional Settings Section (placeholder for future) */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">General Settings</h2>
        </div>
        <div className="p-6">
          <p className="text-slate-500 text-sm">Additional settings coming soon...</p>
        </div>
      </div>
    </div>
  );
}
