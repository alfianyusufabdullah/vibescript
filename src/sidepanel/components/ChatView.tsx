import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { MessageBubble } from './MessageBubble';
import { ActionBar } from './ActionBar';
import { Send, Trash2, Code, Sparkles, FileWarning, Loader2 } from 'lucide-react';

export const ChatView: React.FC = () => {
  const { messages, isLoading, error, sendMessage, clearHistory } = useChatStore();
  const { currentContext, scriptId, isActiveTabAppsScript, fetchContext } = useEditorStore();
  const { provider, apiKeys, models } = useSettingsStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Poll active file context on mount and when input gets focus
  useEffect(() => {
    fetchContext();
    const pollInterval = setInterval(() => {
      fetchContext();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    const apiKey = apiKeys[provider];
    const model = models[provider];

    if (!apiKey) {
      alert(`API Key for ${provider.toUpperCase()} is not set. Please go to Settings tab to enter it.`);
      return;
    }

    sendMessage(input.trim(), {
      provider,
      apiKey,
      model,
      editorContext: currentContext ? { ...currentContext, scriptId } : null
    });
    
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Dynamic height adjustment
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const activeScriptId = scriptId || 'global';

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-zinc-50 overflow-hidden">
      {/* Action Chips */}
      <ActionBar />

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center my-auto px-5 py-8 animate-fade-in">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-zinc-400" />
            </div>
            <h3 className="text-xs font-semibold text-zinc-200 mb-1 uppercase tracking-wider">
              AI Assistant Workspace
            </h3>
            <p className="text-[11px] text-zinc-400 max-w-[220px] leading-relaxed mb-4">
              Describe your task or click a quick action above to write, fix, or optimize your Google Apps Script.
            </p>
            {isActiveTabAppsScript ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-900/40 text-[10px] text-zinc-300 font-medium">
                <Code className="w-3.5 h-3.5 text-emerald-500" />
                Linked to active editor
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-900/40 text-[10px] text-zinc-400 font-medium">
                <FileWarning className="w-3.5 h-3.5 text-zinc-500" />
                Focus editor to link context
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {isLoading && (
          <div className="flex items-start gap-2 animate-fade-in">
            <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
            </div>
            <div className="bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 px-3 py-2 rounded-md max-w-[85%] font-medium">
              Formulating code...
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-md border border-red-900/50 bg-red-950/20 text-red-450 text-[11px] font-medium leading-relaxed">
            <span className="font-bold text-red-400 mr-1">Error:</span> {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer input section */}
      <div className="p-4 bg-[#09090b] border-t border-zinc-850 flex flex-col gap-2.5">
        {/* Context Attachment Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px]">
            {isActiveTabAppsScript ? (
              <span className="flex items-center gap-1.5 text-zinc-300 font-medium bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active Connection
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-500 font-medium bg-zinc-900/20 border border-zinc-800/40 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-650" />
                Disconnected
              </span>
            )}
          </div>

          {messages.length > 0 && (
            <button
              onClick={() => clearHistory(activeScriptId)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors font-medium uppercase tracking-wide"
              title="Clear chat history for this project"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset History
            </button>
          )}
        </div>

        {/* Input Text Area */}
        <div className="relative flex items-end bg-zinc-900/30 border border-zinc-800 focus-within:border-zinc-700 rounded-lg overflow-hidden px-3 py-2 transition-all duration-150">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isActiveTabAppsScript ? "Ask AI or say 'create a function to...'" : "Connect Apps Script to start coding..."}
            disabled={!isActiveTabAppsScript && messages.length === 0}
            className="w-full text-xs bg-transparent border-0 outline-none resize-none text-zinc-100 placeholder-zinc-500 leading-relaxed pr-9 py-0.5 max-h-[120px] focus:ring-0 focus:outline-none"
            style={{ height: 'auto' }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 bottom-2 p-1.5 rounded-md bg-zinc-50 hover:bg-zinc-200 text-zinc-950 disabled:opacity-20 disabled:hover:bg-zinc-50 transition-all duration-150 cursor-pointer shadow-sm"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
