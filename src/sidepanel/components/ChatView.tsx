import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useEditorStore, type FileInfo } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { useAgentStore } from '../stores/agentStore';
import { MessageBubble } from './MessageBubble';
import { MentionInput } from './MentionInput';
import { CombinedToolItem } from './ToolExecutionLog';
import { pairSteps } from '../utils/agent';
import { Send, Trash2, Code, Sparkles, FileWarning, Loader2, StopCircle, Copy, Check } from 'lucide-react';
import { Button } from './ui/button';
import { preprocessStreamingMarkdown } from '../utils/markdown';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { CodeAttachment } from '../../shared/types';

export const ChatView: React.FC = () => {
  const { messages, isLoading, error, clearHistory } = useChatStore();
  const {
    currentContext,
    scriptId,
    isActiveTabAppsScript,
    fetchContext
  } = useEditorStore();
  const { provider, apiKeys, models } = useSettingsStore();
  const { draftInput, setDraftInput } = useUiStore();
  const {
    status: agentStatus,
    steps: agentSteps,
    error: agentError,
    currentStepText,
    cancel: cancelAgent,
    reset: resetAgent
  } = useAgentStore();

  const isAgentRunning = agentStatus === 'thinking' || agentStatus === 'executing_tools';
  const [copied, setCopied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteTriggerIndex, setAutocompleteTriggerIndex] = useState(0);
  const [openFilesList, setOpenFilesList] = useState<FileInfo[]>([]);

  const pairedAgentSteps = useMemo(() => {
    return pairSteps(agentSteps);
  }, [agentSteps]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, agentSteps, currentStepText]);

  // Poll active file context on mount and when input gets focus
  useEffect(() => {
    fetchContext();
    const pollInterval = setInterval(() => {
      fetchContext();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [fetchContext]);

  const fetchOpenFiles = async () => {
    const files = await useEditorStore.getState().listOpenFiles();
    setOpenFilesList(files || []);
  };

  const filteredFiles = useMemo(() => {
    if (!autocompleteQuery) return openFilesList;
    return openFilesList.filter((f) =>
      f.name.toLowerCase().includes(autocompleteQuery.toLowerCase())
    );
  }, [openFilesList, autocompleteQuery]);

  const selectFile = async (fileName: string) => {
    const context = await useEditorStore.getState().readFileByName(fileName);
    if (context) {
      useEditorStore.getState().addAttachment({
        filename: fileName,
        content: context.code
      });
    }

    const text = textareaRef.current?.value || '';
    const before = text.substring(0, autocompleteTriggerIndex);
    const after = text.substring(textareaRef.current?.selectionStart || 0);
    const mentionString = `@${fileName}`;
    const newText = before + mentionString + ' ' + after;
    setDraftInput(newText);
    setShowAutocomplete(false);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = before.length + mentionString.length + 1;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  };

  const handleSend = async () => {
    if (!draftInput.trim() || isLoading || isAgentRunning) return;

    const apiKey = apiKeys[provider];
    const model = models[provider];

    if (!apiKey) {
      alert(`API Key for ${provider.toUpperCase()} is not set. Please go to Settings tab to enter it.`);
      return;
    }

    // If agent just finished, reset state before new run
    if (agentStatus === 'done' || agentStatus === 'error' || agentStatus === 'cancelled') {
      resetAgent();
    }

    const prompt = draftInput.trim();
    const activeScriptId = scriptId || 'global';

    // Parse inline mentions: e.g. @Code.gs:10-20 or @Code.gs
    const mentionsRegex = /@([a-zA-Z0-9_\-.]+)(?::(\d+)(?:-(\d+))?)?/g;
    let match;
    const finalAttachments: CodeAttachment[] = [];
    const processedKeys = new Set<string>();

    const fetchPromises: Promise<void>[] = [];
    while ((match = mentionsRegex.exec(prompt)) !== null) {
      const filename = match[1];
      const lineStart = match[2] ? parseInt(match[2], 10) : undefined;
      const lineEnd = match[3] ? parseInt(match[3], 10) : undefined;
      const key = `${filename}:${lineStart || ''}-${lineEnd || ''}`;

      if (!processedKeys.has(key)) {
        processedKeys.add(key);

        // Check if we have this exact attachment cached in draftAttachments
        const cached = useEditorStore.getState().draftAttachments.find(
          a => a.filename === filename && a.lineStart === lineStart && a.lineEnd === lineEnd
        );

        if (cached) {
          finalAttachments.push(cached);
        } else {
          // If not cached (e.g. they typed it manually), fetch it
          fetchPromises.push(
            (async () => {
              try {
                const context = await useEditorStore.getState().readFileByName(filename);
                if (context && context.code) {
                  let content = context.code;
                  if (lineStart !== undefined) {
                    const lines = content.split('\n');
                    const startIdx = Math.max(0, lineStart - 1);
                    const endIdx = lineEnd !== undefined ? Math.min(lines.length, lineEnd) : lines.length;
                    content = lines.slice(startIdx, endIdx).join('\n');
                  }
                  finalAttachments.push({
                    filename,
                    lineStart,
                    lineEnd,
                    content
                  });
                }
              } catch (e) {
                console.error(`Failed to read file ${filename} for mention:`, e);
              }
            })()
          );
        }
      }
    }

    if (fetchPromises.length > 0) {
      await Promise.all(fetchPromises);
    }

    // Clear draft attachments in the store
    useEditorStore.getState().clearAttachments();

    // Show user message immediately with resolved attachments
    useChatStore.getState().addUserMessage(activeScriptId, prompt, finalAttachments);

    // Start agent
    useAgentStore.getState().run(prompt, {
      provider,
      apiKey,
      model,
      editorContext: currentContext ? { ...currentContext, scriptId } : null,
      scriptId: activeScriptId,
      attachments: finalAttachments
    });
    
    setDraftInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleCopyHistory = () => {
    const text = messages.map(msg => {
      const role = msg.role === 'user' ? 'User' : 'AI Assistant';
      const steps = msg.agentSteps?.length
        ? '\n\n[Tool Execution Log]\n' + msg.agentSteps.map(s => {
            if (s.type === 'tool_call') {
              return s.toolCalls?.map(tc => `  [Tool] ${tc.name}(${JSON.stringify(tc.arguments)})`).join('\n');
            }
            if (s.type === 'tool_result') {
              return s.toolResults?.map(tr => `  [${tr.success ? 'OK' : 'FAIL'}] ${tr.name}: ${tr.output || tr.error || ''}`).join('\n');
            }
            return '';
          }).filter(Boolean).join('\n')
        : '';
      return `[${role}]\n${msg.content}${steps}`;
    }).join('\n\n---\n\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex(prev => (prev + 1) % filteredFiles.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex(prev => (prev - 1 + filteredFiles.length) % filteredFiles.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selectFile(filteredFiles[autocompleteIndex].name);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowAutocomplete(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (value: string) => {
    setDraftInput(value);

    const selectionStart = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, selectionStart);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_\-.]*)$/);

    if (match) {
      setShowAutocomplete(true);
      setAutocompleteQuery(match[1]);
      setAutocompleteTriggerIndex(selectionStart - match[1].length - 1);
      setAutocompleteIndex(0);
      fetchOpenFiles();
    } else {
      setShowAutocomplete(false);
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
      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 && !isAgentRunning && agentStatus !== 'done' ? (
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

        {/* Agent running indicator */}
        {isAgentRunning && (
          <div className="flex flex-col gap-1 w-full animate-fade-in items-start">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 px-1 font-medium tracking-tight">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span className="text-zinc-700 font-semibold">
                {agentStatus === 'thinking' ? 'AI Assistant (thinking)' : 'AI Assistant (executing tools)'}
              </span>
              <button
                onClick={cancelAgent}
                className="ml-2 flex items-center gap-0.5 text-[10px] text-red-650 hover:text-red-700 hover:underline cursor-pointer"
              >
                <StopCircle className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>

            <div className="max-w-[88%] w-full rounded-lg px-3.5 py-2.5 bg-white border border-zinc-200 rounded-tl-none shadow-sm space-y-3">
              {pairedAgentSteps.length === 0 && !currentStepText ? (
                <div className="flex items-center gap-2 text-zinc-500 text-[11.5px] py-0.5 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                  Thinking...
                </div>
              ) : (
                <>
                  {pairedAgentSteps.map((step, idx) => (
                    <React.Fragment key={idx}>
                      {step.content && <MarkdownRenderer content={step.content} />}
                      {step.toolCalls.length > 0 && (
                        <div className="space-y-1.5 my-1.5">
                          {step.toolCalls.map((tc, i) => {
                            const result = step.toolResults.find(r => r.name === tc.name) || step.toolResults[i];
                            return (
                              <CombinedToolItem
                                key={i}
                                toolCall={tc}
                                toolResult={result}
                                isComplete={step.isComplete}
                                expanded={idx === pairedAgentSteps.length - 1}
                                onToggle={() => {}}
                              />
                            );
                          })}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  {currentStepText && (
                    <MarkdownRenderer
                      content={preprocessStreamingMarkdown(currentStepText, true)}
                    />
                  )}
                  {agentStatus === 'thinking' && !currentStepText && (
                    <div className="flex items-center gap-2 text-zinc-500 text-[11px] py-0.5 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                      Thinking...
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Agent error */}
        {agentStatus === 'error' && !isAgentRunning && (
          <div className="flex flex-col gap-1 w-full animate-fade-in items-start">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 px-1 font-medium tracking-tight">
              <Sparkles className="w-3.5 h-3.5 text-red-500" />
              <span className="text-zinc-700 font-semibold">AI Assistant (failed)</span>
            </div>

            <div className="max-w-[88%] w-full rounded-lg px-3.5 py-2.5 bg-white border border-zinc-200 rounded-tl-none shadow-sm space-y-3">
              {pairedAgentSteps.map((step, idx) => (
                <React.Fragment key={idx}>
                  {step.content && <MarkdownRenderer content={step.content} />}
                  {step.toolCalls.length > 0 && (
                    <div className="space-y-1.5 my-1.5">
                      {step.toolCalls.map((tc, i) => {
                        const result = step.toolResults.find(r => r.name === tc.name) || step.toolResults[i];
                        return (
                          <CombinedToolItem
                            key={i}
                            toolCall={tc}
                            toolResult={result}
                            isComplete={step.isComplete}
                            expanded={idx === pairedAgentSteps.length - 1}
                            onToggle={() => {}}
                          />
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              ))}

              <div className="p-3 rounded-md border border-red-200 bg-red-50 text-[11px] font-medium leading-relaxed text-red-800">
                <span className="font-bold text-red-650 mr-1">Agent Error:</span> {agentError}
              </div>
            </div>
          </div>
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
        {showAutocomplete && filteredFiles.length > 0 && (
          <div className="absolute left-4 bottom-[calc(100%-8px)] mb-2 w-64 bg-white border border-zinc-250 rounded-lg shadow-lg overflow-hidden z-50 max-h-48 overflow-y-auto">
            <div className="px-2.5 py-1.5 text-[9px] font-bold text-zinc-400 border-b border-zinc-100 uppercase tracking-wider bg-zinc-50/50">
              Mention File
            </div>
            {filteredFiles.map((file, idx) => (
              <button
                key={file.name}
                type="button"
                onClick={() => selectFile(file.name)}
                className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-[11.5px] transition-colors border-b border-zinc-50 last:border-0 ${
                  idx === autocompleteIndex ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-650 hover:bg-zinc-50'
                }`}
              >
                <span className="font-medium truncate">{file.name}</span>
                {file.isActive && (
                  <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold scale-90">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

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
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCopyHistory}
                variant="ghost"
                size="sm"
                className="text-[10px] h-auto p-0 hover:bg-transparent text-zinc-400 hover:text-zinc-700 flex items-center gap-1 font-medium uppercase tracking-wide cursor-pointer"
                title="Copy chat history to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-650" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                onClick={() => clearHistory(activeScriptId)}
                variant="ghost"
                size="sm"
                className="text-[10px] h-auto p-0 hover:bg-transparent text-zinc-400 hover:text-zinc-700 flex items-center gap-1 font-medium uppercase tracking-wide cursor-pointer"
                title="Clear chat history for this project"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset History
              </Button>
            </div>
          )}
        </div>


        {/* Input Text Area */}
        <div className="relative flex items-end bg-zinc-100/50 border border-zinc-200 focus-within:border-zinc-350 focus-within:bg-white rounded-lg overflow-hidden px-3 py-2 transition-all duration-150 shadow-sm">
          <MentionInput
            textareaRef={textareaRef}
            value={draftInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isActiveTabAppsScript ? "Ask AI or say 'create a function to...'" : "Connect Apps Script to start coding..."}
            disabled={!isActiveTabAppsScript && messages.length === 0}
            className="w-full text-xs text-zinc-900 placeholder-zinc-400"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !draftInput.trim()}
            size="icon"
            className="absolute right-2 bottom-2 h-7 w-7 rounded-md cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
