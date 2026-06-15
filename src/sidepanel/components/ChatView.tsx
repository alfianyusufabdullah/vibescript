import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useEditorStore } from '../stores/editorStore';
import { useAgentStore } from '../stores/agentStore';
import { MessageBubble } from './MessageBubble';
import { MentionInput } from './MentionInput';
import { AgentRunningBubble, AgentErrorBubble } from './AgentStatusBubble';
import { QuestionCard } from './QuestionCard';
import { SessionPopover } from './SessionPopover';
import { pairSteps } from '../utils/agent';
import { Send, Trash2, Code, Sparkles, FileWarning, Loader2, Copy, Check } from 'lucide-react';
import { Button } from './ui/button';
import { useSessionManager } from '../hooks/useSessionManager';
import { useChatInput } from '../hooks/useChatInput';

const MAX_TEXTAREA_HEIGHT_PX = 120;
const SCROLL_NEAR_BOTTOM_THRESHOLD = 80;

function formatConversationForExport(messages: ReturnType<typeof useChatStore.getState>['messages']): string {
  return messages.map((message) => {
    const role = message.role === 'user' ? 'User' : 'AI Assistant';
    const hasSteps = message.agentSteps?.length;

    const steps = hasSteps
      ? '\n\n[Tool Execution Log]\n' +
        message.agentSteps!
          .map((step) => {
            if (step.type === 'tool_call') {
              return step.toolCalls
                ?.map((tc) => `  [Tool] ${tc.name}(${JSON.stringify(tc.arguments)})`)
                .join('\n');
            }
            if (step.type === 'tool_result') {
              return step.toolResults
                ?.map((tr) => `  [${tr.success ? 'OK' : 'FAIL'}] ${tr.name}: ${tr.output || tr.error || ''}`)
                .join('\n');
            }
            return '';
          })
          .filter(Boolean)
          .join('\n')
      : '';

    return `[${role}]\n${message.content}${steps}`;
  }).join('\n\n---\n\n');
}

export const ChatView: React.FC = () => {
  const { messages, isLoading, error, clearHistory } = useChatStore();
  const { currentContext, scriptId, isActiveTabAppsScript, fetchContext } = useEditorStore();
  const agentStatus = useAgentStore((s) => s.status);
  const agentSteps = useAgentStore((s) => s.steps);
  const agentError = useAgentStore((s) => s.error);
  const currentStepText = useAgentStore((s) => s.currentStepText);
  const currentRole = useAgentStore((s) => s.currentRole);
  const reasoningText = useAgentStore((s) => s.reasoningText);
  const pendingToolCallName = useAgentStore((s) => s.pendingToolCallName);
  const pendingQuestion = useAgentStore((s) => s.pendingQuestion);
  const cancelAgent = useAgentStore((s) => s.cancel);
  const resolveQuestion = useAgentStore((s) => s.resolveQuestion);

  const isAgentRunning = agentStatus === 'thinking' || agentStatus === 'executing_tools' || agentStatus === 'waiting_for_input';
  const [copied, setCopied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pairedAgentSteps = useMemo(() => pairSteps(agentSteps), [agentSteps]);

  const sessionMgr = useSessionManager(scriptId, agentStatus);
  const chatInput = useChatInput({ scriptId, currentContext, textareaRef, agentStatus });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_NEAR_BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isAgentRunning ? 'instant' : 'smooth' });
  }, [isAgentRunning]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, agentSteps, scrollToBottom]);

  useEffect(() => {
    if (!isAgentRunning) return;
    let rafId: number;
    const tick = () => {
      if (isNearBottom()) {
        scrollToBottom();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isAgentRunning, scrollToBottom, isNearBottom]);

  useEffect(() => {
    fetchContext();
    const pollInterval = setInterval(() => {
      fetchContext();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [fetchContext]);

  useEffect(() => {
    if (textareaRef.current && chatInput.draftInput) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
    }
  }, [chatInput.draftInput]);

  const activeScriptId = scriptId || 'global';

  const handleCopyHistory = () => {
    const text = formatConversationForExport(messages);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 text-zinc-900 overflow-hidden">
      {/* Message List */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 && !isAgentRunning && agentStatus !== 'done' ? (
          <div className="flex flex-col items-center justify-center text-center my-auto px-5 py-8 animate-fade-in">
            <div className="w-10 h-10 rounded-lg bg-white border border-zinc-200 flex items-center justify-center mb-4 shadow-sm">
              <Sparkles className="w-5 h-5 text-zinc-500" />
            </div>
            <h3 className="text-xs font-semibold text-zinc-700 mb-1 uppercase tracking-wider">AI Assistant Workspace</h3>
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
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}

        {isAgentRunning && (
          <AgentRunningBubble
            pairedAgentSteps={pairedAgentSteps}
            currentStepText={currentStepText}
            reasoningText={reasoningText}
            agentStatus={agentStatus}
            currentRole={currentRole}
            pendingToolCallName={pendingToolCallName}
            onCancel={cancelAgent}
          />
        )}

        {agentStatus === 'error' && !isAgentRunning && (
          <AgentErrorBubble
            pairedAgentSteps={pairedAgentSteps}
            agentError={agentError}
            currentRole={currentRole}
          />
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
            <span className="font-bold text-red-650 mr-1">Error:</span> {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer input section */}
      <div className="p-4 bg-white border-t border-zinc-200 flex flex-col gap-2.5 relative">
        {/* Autocomplete Dropdown */}
        {chatInput.showAutocomplete && (chatInput.filteredFiles.length > 0 || chatInput.filteredAgents.length > 0) && (
          <div className="absolute left-0 bottom-[calc(100%+8px)] z-50 w-72 bg-popover border border-border rounded-md shadow-md overflow-hidden max-h-56 overflow-y-auto p-1">
            {chatInput.filteredAgents.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider bg-popover">Agents</div>
                {chatInput.filteredAgents.map((agent, idx) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      const text = textareaRef.current?.value || '';
                      const before = text.substring(0, chatInput.autocompleteTriggerIndex);
                      const after = text.substring(textareaRef.current?.selectionStart || 0);
                      const newText = `${before}@${agent.id} ${after}`;
                      chatInput.setDraftInput(newText);
                      chatInput.setShowAutocomplete(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 flex items-center justify-between text-xs transition-colors rounded-sm cursor-pointer ${
                      idx === chatInput.autocompleteIndex
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-foreground hover:bg-accent/50 hover:text-accent-foreground'
                    }`}
                  >
                    <span className="truncate">{agent.label}</span>
                    <span className="text-[9px] text-muted-foreground truncate max-w-[140px]">{agent.description}</span>
                  </button>
                ))}
              </>
            )}
            {chatInput.filteredFiles.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider bg-popover">Files</div>
                {chatInput.filteredFiles.map((file, idx) => (
                  <button
                    key={file.name}
                    type="button"
                    onClick={() => chatInput.selectFile(file.name)}
                    className={`w-full text-left px-2 py-1.5 flex items-center justify-between text-xs transition-colors rounded-sm cursor-pointer ${
                      idx === chatInput.autocompleteIndex
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-foreground hover:bg-accent/50 hover:text-accent-foreground'
                    }`}
                  >
                    <span className="truncate">{file.name}</span>
                    {file.isActive && (
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-250 px-1.5 py-0.5 rounded font-semibold scale-90">Active</span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Status & Session Bar */}
        <div className="flex items-center justify-between px-1 text-[11px]">
          <div className="flex items-center gap-2">
            {isActiveTabAppsScript ? (
              <span
                className="flex items-center gap-1.5 text-zinc-700 font-medium bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md"
                title={currentContext?.filename || 'Connected to editor'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected: {currentContext?.filename || 'No active file'}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-500 font-medium bg-zinc-100/50 border border-zinc-200 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                Disconnected
              </span>
            )}
          </div>
          <SessionPopover
            sessions={sessionMgr.sessions}
            renamingSessionId={sessionMgr.renamingSessionId}
            renameValue={sessionMgr.renameValue}
            setRenamingSessionId={sessionMgr.setRenamingSessionId}
            setRenameValue={sessionMgr.setRenameValue}
            onNew={sessionMgr.handleNewSession}
            onSwitch={sessionMgr.handleSwitchSession}
            onDelete={sessionMgr.handleDeleteSession}
            onRename={sessionMgr.handleRenameSession}
          />
        </div>

        {/* Question panel — expands above the chatbox when agent is waiting */}
        {pendingQuestion && (
          <QuestionCard
            question={pendingQuestion.text}
            options={pendingQuestion.options}
            onSubmit={resolveQuestion}
          />
        )}

        {/* Input Card */}
        <div className="flex flex-col bg-zinc-100/50 border border-zinc-200 focus-within:border-zinc-350 focus-within:bg-white rounded-lg overflow-hidden transition-all duration-150 shadow-sm p-2 gap-1.5">
          <MentionInput
            textareaRef={textareaRef}
            value={chatInput.draftInput}
            onChange={chatInput.handleInputChange}
            onKeyDown={chatInput.handleKeyDown}
            placeholder={isActiveTabAppsScript ? "Ask AI or say 'create a function to...'" : "Connect Apps Script to start coding..."}
            disabled={(!isActiveTabAppsScript && messages.length === 0) || !!pendingQuestion}
            className="w-full min-h-[44px] text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none resize-none bg-transparent border-0 p-0"
          />
          <div className="flex items-center justify-between mt-0.5">
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <>
                  <Button
                    onClick={handleCopyHistory}
                    variant="ghost"
                    size="sm"
                    className="text-[10px] h-7 px-2 hover:bg-zinc-200/50 text-zinc-500 hover:text-zinc-900 flex items-center gap-1 font-medium cursor-pointer"
                    title="Copy chat history to clipboard"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-650" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    onClick={() => clearHistory(activeScriptId)}
                    variant="ghost"
                    size="sm"
                    className="text-[10px] h-7 px-2 hover:bg-zinc-200/50 text-zinc-500 hover:text-zinc-900 flex items-center gap-1 font-medium cursor-pointer"
                    title="Clear chat history for this project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Reset History
                  </Button>
                </>
              )}
            </div>
            <Button
              onClick={chatInput.handleSend}
              disabled={isLoading || !chatInput.draftInput.trim() || !!pendingQuestion}
              size="sm"
              className="h-7 px-3 rounded-md cursor-pointer flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5 mr-0.5" />
              <span className="text-[11px] font-medium">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
