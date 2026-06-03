import React, { useRef, useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { MessageBubble } from './MessageBubble';
import { ActionBar } from './ActionBar';
import { Send, Trash2, Code, Sparkles, FileWarning, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

export const ChatView: React.FC = () => {
  const { messages, isLoading, error, sendMessage, clearHistory } = useChatStore();
  const { currentContext, scriptId, isActiveTabAppsScript, fetchContext } = useEditorStore();
  const { provider, apiKeys, models } = useSettingsStore();
  const { draftInput, setDraftInput } = useUiStore();

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
  }, [fetchContext]);

  const handleSend = () => {
    if (!draftInput.trim() || isLoading) return;

    const apiKey = apiKeys[provider];
    const model = models[provider];

    if (!apiKey) {
      alert(`API Key for ${provider.toUpperCase()} is not set. Please go to Settings tab to enter it.`);
      return;
    }

    sendMessage(draftInput.trim(), {
      provider,
      apiKey,
      model,
      editorContext: currentContext ? { ...currentContext, scriptId } : null
    });
    
    setDraftInput('');
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
    setDraftInput(e.target.value);
    // Dynamic height adjustment
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  // Adjust height on initial mount/draft load
  useEffect(() => {
    if (textareaRef.current && draftInput) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [draftInput]);

  const activeScriptId = scriptId || 'global';

  return (
    <div className="flex flex-col h-full bg-zinc-50 text-zinc-900 overflow-hidden">
      {/* Action Chips */}
      <ActionBar />

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center my-auto px-5 py-8 animate-fade-in">
            <div className="w-10 h-10 rounded-lg bg-white border border-zinc-200 flex items-center justify-center mb-4 shadow-sm">
              <Sparkles className="w-5 h-5 text-zinc-500" />
            </div>
            <h3 className="text-xs font-semibold text-zinc-700 mb-1 uppercase tracking-wider">
              AI Assistant Workspace
            </h3>
            <p className="text-[11px] text-zinc-500 max-w-[220px] leading-relaxed mb-4">
              Describe your task or click a quick action above to write, fix, or optimize your Google Apps Script.
            </p>
            {isActiveTabAppsScript ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-200 bg-white text-[10px] text-zinc-700 font-medium shadow-sm">
                <Code className="w-3.5 h-3.5 text-emerald-600" />
                Linked to active editor
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-200 bg-white text-[10px] text-zinc-400 font-medium shadow-sm">
                <FileWarning className="w-3.5 h-3.5 text-zinc-400" />
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
            <div className="w-6 h-6 rounded-md bg-white border border-zinc-200 flex items-center justify-center shadow-sm">
              <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
            </div>
            <div className="bg-zinc-100 border border-zinc-200 text-[11px] text-zinc-600 px-3 py-2 rounded-md max-w-[85%] font-medium">
              Formulating code...
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-md border border-red-200 bg-red-50 text-red-750 text-[11px] font-medium leading-relaxed">
            <span className="font-bold text-red-600 mr-1">Error:</span> {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer input section */}
      <div className="p-4 bg-white border-t border-zinc-200 flex flex-col gap-2.5">
        {/* Context Attachment Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px]">
            {isActiveTabAppsScript ? (
              <span className="flex items-center gap-1.5 text-zinc-700 font-medium bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active Connection
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-500 font-medium bg-zinc-100/50 border border-zinc-200 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                Disconnected
              </span>
            )}
          </div>

          {messages.length > 0 && (
            <Button
              onClick={() => clearHistory(activeScriptId)}
              variant="ghost"
              size="sm"
              className="text-[10px] h-auto p-0 hover:bg-transparent text-zinc-400 hover:text-zinc-700 flex items-center gap-1 font-medium uppercase tracking-wide"
              title="Clear chat history for this project"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset History
            </Button>
          )}
        </div>

        {/* Input Text Area */}
        <div className="relative flex items-end bg-zinc-100/50 border border-zinc-200 focus-within:border-zinc-350 focus-within:bg-white rounded-lg overflow-hidden px-3 py-2 transition-all duration-150 shadow-sm">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draftInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isActiveTabAppsScript ? "Ask AI or say 'create a function to...'" : "Connect Apps Script to start coding..."}
            disabled={!isActiveTabAppsScript && messages.length === 0}
            className="w-full text-xs bg-transparent border-0 outline-none resize-none text-zinc-900 placeholder-zinc-400 leading-relaxed pr-9 py-0.5 max-h-[120px] focus:ring-0 focus:outline-none"
            style={{ height: 'auto' }}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !draftInput.trim()}
            size="icon"
            className="absolute right-2 bottom-2 h-7 w-7 rounded-md cursor-pointer"
          >
            <Send className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};
