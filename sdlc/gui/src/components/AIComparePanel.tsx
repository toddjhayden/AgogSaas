/**
 * AI Comparison Panel
 * Side-by-side comparison view for multiple AI providers
 */

import { useState, useRef } from 'react';
import {
  X, Send, Trash2, Settings, Bot, Loader2, AlertCircle,
  Copy, Check, Columns, Github, Sparkles, Gem, Search, Cloud,
} from 'lucide-react';
import { useAIChatStore } from '../stores/useAIChatStore';
import type { AIProviderType } from '../types/ai-providers';

// Icon mapping for providers
const providerIcons: Record<AIProviderType, typeof Github> = {
  'github-copilot': Github,
  'anthropic': Bot,
  'openai': Sparkles,
  'google-gemini': Gem,
  'deepseek': Search,
  'azure-openai': Cloud,
};

interface AIComparePanelProps {
  onClose: () => void;
  onOpenSettings: () => void;
}

export function AIComparePanel({ onClose, onOpenSettings }: AIComparePanelProps) {
  const [input, setInput] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    providers,
    comparisonResponses,
    comparisonQuery,
    error,
    sendComparisonMessage,
    clearComparison,
  } = useAIChatStore();

  const availableProviders = providers.filter(p => p.apiKey);
  const isLoading = comparisonResponses.some(r => r.isLoading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || selectedProviders.length === 0) return;

    const message = input.trim();
    setInput('');
    await sendComparisonMessage(message, selectedProviders);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleProvider = (providerId: string) => {
    setSelectedProviders(prev =>
      prev.includes(providerId)
        ? prev.filter(id => id !== providerId)
        : [...prev, providerId]
    );
  };

  const copyToClipboard = async (content: string, providerId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(providerId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getProviderIcon = (type: AIProviderType) => {
    return providerIcons[type] || Bot;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-0 md:p-4">
      <div className="bg-white md:rounded-xl shadow-2xl w-full md:max-w-6xl h-full md:h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 safe-top">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="p-1.5 md:p-2 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex-shrink-0">
              <Columns size={18} className="md:w-5 md:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-800 text-sm md:text-base">Compare AI</h2>
              <p className="text-xs text-slate-500 hidden md:block">Send the same prompt to multiple providers</p>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Provider Selection */}
        <div className="px-4 md:px-6 py-2 md:py-3 border-b border-slate-200 bg-slate-50">
          <p className="text-xs font-medium text-slate-600 mb-2">Select providers:</p>
          <div className="flex flex-wrap gap-1.5 md:gap-2 overflow-x-auto">
            {availableProviders.length === 0 ? (
              <p className="text-sm text-slate-400">
                No providers configured.{' '}
                <button onClick={onOpenSettings} className="text-blue-600 hover:underline">
                  Add one
                </button>
              </p>
            ) : (
              availableProviders.map((provider) => {
                const Icon = getProviderIcon(provider.type);
                const isSelected = selectedProviders.includes(provider.id);
                return (
                  <button
                    key={provider.id}
                    onClick={() => toggleProvider(provider.id)}
                    className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm transition-colors flex-shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{provider.name}</span>
                    <span className="text-xs opacity-70 hidden md:inline">({provider.model})</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Comparison Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {comparisonQuery ? (
            <>
              {/* Query Display */}
              <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
                <p className="text-xs font-medium text-blue-600 mb-1">Your question:</p>
                <p className="text-sm text-blue-800">{comparisonQuery}</p>
              </div>

              {/* Responses Grid */}
              <div className="flex-1 overflow-auto p-4">
                <div className={`grid gap-4 h-full ${
                  comparisonResponses.length === 1 ? 'grid-cols-1' :
                  comparisonResponses.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                  comparisonResponses.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                }`}>
                  {comparisonResponses.map((response) => {
                    const provider = providers.find(p => p.id === response.providerId);
                    const Icon = provider ? getProviderIcon(provider.type) : Bot;

                    return (
                      <div
                        key={response.providerId}
                        className="border border-slate-200 rounded-lg flex flex-col overflow-hidden"
                      >
                        {/* Response Header */}
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <Icon size={16} className="text-slate-600" />
                            <span className="font-medium text-sm text-slate-800">
                              {response.providerName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">{response.model}</span>
                            {response.content && !response.isLoading && (
                              <button
                                onClick={() => copyToClipboard(response.content, response.providerId)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                title="Copy response"
                              >
                                {copiedId === response.providerId ? (
                                  <Check size={14} className="text-green-500" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Response Content */}
                        <div className="flex-1 overflow-auto p-4">
                          {response.isLoading ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="flex items-center gap-2 text-slate-500">
                                <Loader2 size={20} className="animate-spin" />
                                <span className="text-sm">Thinking...</span>
                              </div>
                            </div>
                          ) : response.error ? (
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3">
                              <AlertCircle size={16} />
                              <span className="text-sm">{response.error}</span>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {response.content}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <Columns size={48} className="text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">
                  Compare AI Responses
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Select multiple AI providers above and send a message to see how each one responds.
                  This helps you compare different models for accuracy, style, and capabilities.
                </p>
                <div className="space-y-2 text-sm text-slate-400">
                  <p>Try questions like:</p>
                  <ul className="space-y-1">
                    <li>"Explain the difference between REST and GraphQL"</li>
                    <li>"Write a function to validate email addresses"</li>
                    <li>"What are the best practices for database indexing?"</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-200 p-3 md:p-4 bg-slate-50 safe-bottom">
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 md:gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedProviders.length === 0
                    ? "Select providers above..."
                    : `Ask ${selectedProviders.length} provider${selectedProviders.length > 1 ? 's' : ''}...`
                }
                className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 pr-14 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                rows={2}
                disabled={isLoading || selectedProviders.length === 0}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || selectedProviders.length === 0}
                className="absolute right-2 bottom-2 p-2.5 md:p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </div>

            {comparisonResponses.length > 0 && (
              <button
                type="button"
                onClick={clearComparison}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-end"
                title="Clear comparison"
              >
                <Trash2 size={20} />
              </button>
            )}
          </form>

          <p className="text-xs text-slate-400 mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
