/**
 * GitHub AI Chat Panel
 * VS Code-style chat interface for AI assistance
 */

import { useState, useRef, useEffect } from 'react';
import { X, Send, Trash2, Settings, Bot, User, Loader2, AlertCircle } from 'lucide-react';
import { useGitHubStore } from '../stores/useGitHubStore';

interface GitHubChatProps {
  onOpenSettings: () => void;
}

export function GitHubChat({ onOpenSettings }: GitHubChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isEnabled,
    isPanelOpen,
    isLoading,
    error,
    isAuthenticated,
    user,
    togglePanel,
    sendMessage,
    clearMessages,
  } = useGitHubStore();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isPanelOpen) {
      inputRef.current?.focus();
    }
  }, [isPanelOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!isEnabled || !isPanelOpen) {
    return null;
  }

  return (
    <div className="w-80 border-l border-slate-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-blue-600" />
          <span className="font-medium text-slate-800">GitHub AI Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
            title="Clear messages"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={togglePanel}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* User info bar */}
      {isAuthenticated && user && (
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-2 text-sm">
          <img
            src={user.avatar_url}
            alt={user.login}
            className="w-5 h-5 rounded-full"
          />
          <span className="text-slate-600">{user.login}</span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 mt-8">
            <Bot size={48} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm">Start a conversation with AI</p>
            <p className="text-xs text-slate-400 mt-1">
              Ask questions about your workflow, code, or get help with tasks
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bot size={16} className="text-blue-600" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                  <User size={16} className="text-slate-600" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot size={16} className="text-blue-600" />
            </div>
            <div className="bg-slate-100 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI anything..."
            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            disabled={isLoading || !isAuthenticated}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !isAuthenticated}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        {!isAuthenticated && (
          <p className="text-xs text-slate-500 mt-2">
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-blue-600 hover:underline"
            >
              Configure GitHub token
            </button>
            {' '}to start chatting
          </p>
        )}
      </form>
    </div>
  );
}
