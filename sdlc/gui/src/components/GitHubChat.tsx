/**
 * GitHub AI Chat Panel
 * VS Code-style chat interface for AI assistance
 */

import { useState, useRef, useEffect } from 'react';
import {
  X, Send, Trash2, Settings, Bot, User, Loader2, AlertCircle,
  MessageSquare, History, Plus, ChevronDown, Github, Key
} from 'lucide-react';
import { useGitHubStore } from '../stores/useGitHubStore';
import type { ChatMessage } from '../types/github';

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface GitHubChatPanelProps {
  onOpenSettings: () => void;
  onClose: () => void;
}

export function GitHubChatPanel({ onOpenSettings, onClose }: GitHubChatPanelProps) {
  const [input, setInput] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('github-chat-sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    error,
    isAuthenticated,
    user,
    settings,
    sendMessage,
    clearMessages,
  } = useGitHubStore();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Save current session when messages change
  useEffect(() => {
    if (messages.length > 0 && isAuthenticated) {
      if (currentSessionId) {
        // Update existing session
        setSessions(prev => {
          const updated = prev.map(s =>
            s.id === currentSessionId
              ? { ...s, messages, updatedAt: new Date(), title: messages[0]?.content.slice(0, 50) || 'New Chat' }
              : s
          );
          localStorage.setItem('github-chat-sessions', JSON.stringify(updated));
          return updated;
        });
      } else {
        // Create new session
        const newSession: ChatSession = {
          id: `session-${Date.now()}`,
          title: messages[0]?.content.slice(0, 50) || 'New Chat',
          messages,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setCurrentSessionId(newSession.id);
        setSessions(prev => {
          const updated = [newSession, ...prev];
          localStorage.setItem('github-chat-sessions', JSON.stringify(updated));
          return updated;
        });
      }
    }
  }, [messages, currentSessionId, isAuthenticated]);

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

  const handleNewChat = () => {
    clearMessages();
    setCurrentSessionId(null);
    setShowSessions(false);
  };

  const handleLoadSession = (session: ChatSession) => {
    // For now, just show the session - actual loading would need store support
    setCurrentSessionId(session.id);
    setShowSessions(false);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      localStorage.setItem('github-chat-sessions', JSON.stringify(updated));
      return updated;
    });
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      clearMessages();
    }
  };

  return (
    <div className="w-96 border-l border-slate-200 bg-white flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <Bot size={18} className="text-blue-600" />
          </div>
          <div>
            <span className="font-semibold text-slate-800">AI Assistant</span>
            {isAuthenticated && (
              <span className="ml-2 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                Connected
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="New chat"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setShowSessions(!showSessions)}
            className={`p-1.5 rounded transition-colors ${
              showSessions
                ? 'text-blue-600 bg-blue-50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
            }`}
            title="Chat history"
          >
            <History size={16} />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Session History Dropdown */}
      {showSessions && (
        <div className="border-b border-slate-200 bg-slate-50 max-h-64 overflow-y-auto">
          <div className="p-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase px-2 mb-2">Recent Sessions</h3>
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-400 px-2 py-4 text-center">No chat history</p>
            ) : (
              <div className="space-y-1">
                {sessions.slice(0, 10).map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleLoadSession(session)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      currentSessionId === session.id
                        ? 'bg-blue-100 text-blue-800'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{session.title}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Not Authenticated State */}
      {!isAuthenticated ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Github size={32} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Connect GitHub</h3>
          <p className="text-sm text-slate-500 mb-6">
            Connect your GitHub account to start chatting with AI assistants.
          </p>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Key size={16} />
            Configure Token
          </button>
          <p className="text-xs text-slate-400 mt-4">
            Requires a GitHub Personal Access Token
          </p>
        </div>
      ) : (
        <>
          {/* User info bar */}
          {user && (
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-slate-600 font-medium">{user.login}</span>
              </div>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                {settings.model}
              </span>
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center mt-12">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={28} className="text-blue-400" />
                </div>
                <h3 className="font-medium text-slate-700 mb-1">Start a conversation</h3>
                <p className="text-sm text-slate-500 max-w-[250px] mx-auto">
                  Ask questions about your workflow, get help with code, or discuss project tasks.
                </p>
                <div className="mt-6 space-y-2">
                  <p className="text-xs text-slate-400">Try asking:</p>
                  {[
                    "What's the status of my project?",
                    "Help me write a SQL query",
                    "Explain this error message",
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(suggestion)}
                      className="block w-full text-left text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      "{suggestion}"
                    </button>
                  ))}
                </div>
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
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    <p className={`text-xs mt-1.5 ${
                      message.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                      <User size={16} className="text-white" />
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
                <div className="bg-slate-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3">
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-slate-200 p-4 bg-slate-50">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message AI assistant..."
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
            <p className="text-xs text-slate-400 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// Floating Chat Button Component
interface ChatButtonProps {
  onClick: () => void;
  isOpen: boolean;
  hasUnread?: boolean;
}

export function ChatButton({ onClick, isOpen, hasUnread }: ChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all z-50 ${
        isOpen
          ? 'bg-slate-700 text-white rotate-0'
          : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
      }`}
      title={isOpen ? 'Close AI Chat' : 'Open AI Chat'}
    >
      {isOpen ? (
        <ChevronDown size={24} />
      ) : (
        <>
          <MessageSquare size={24} />
          {hasUnread && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
          )}
        </>
      )}
    </button>
  );
}
