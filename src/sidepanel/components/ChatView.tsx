import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useEditorStore, type FileInfo } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { useAgentStore } from '../stores/agentStore';
import { MessageBubble } from './MessageBubble';
import { MentionInput } from './MentionInput';
import { CombinedToolItem } from './ToolExecutionLog';
import { pairSteps } from '../utils/agent';
import { Send, Trash2, Code, Sparkles, FileWarning, Loader2, StopCircle, Copy, Check, ChevronDown, Brain, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { preprocessStreamingMarkdown } from '../utils/markdown';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { CodeAttachment } from '../../shared/types';
import type { AgentSession } from '../../shared/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { AGENT_ROLES } from '../../shared/agents';
import { sessionManager } from '../services/sessionManager';


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
    currentRole,
    reasoningText,
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
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Load sessions for current project
  const loadSessions = useCallback(async () => {
    const sid = scriptId || 'global';
    const sessList = await sessionManager.listSessions(sid);
    setSessions(sessList);
  }, [scriptId]);

  useEffect(() => {
    loadSessions();
  }, [scriptId, agentStatus, loadSessions]);

  const handleNewSession = useCallback(async () => {
    const sid = scriptId || 'global';
    // save current session messages
    try {
      const currentId = sessionManager.getCurrentSessionId();
      if (currentId) {
        const sess = await sessionManager.loadSession(sid, currentId);
        if (sess) {
          sess.status = 'paused';
          await sessionManager.updateSessionMessages(sess, messages, [], { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
        }
      }
    } catch (err) {
      console.error('[VibeScript] Failed to save current session:', err);
    }
    // clear chat and create new session
    useChatStore.getState().setMessages([]);
    try {
      const newSess = await sessionManager.startNewSession(sid, 'build');
      sessionManager.setCurrentSession(newSess.id);
      await sessionManager.deactivateOtherSessions(sid, newSess.id);
    } catch (err) {
      console.error('[VibeScript] Failed to create new session:', err);
    }
    await loadSessions();
  }, [scriptId, messages, loadSessions]);

  const handleSwitchSession = useCallback(async (sess: AgentSession) => {
    const sid = scriptId || 'global';
    // save current session as paused
    try {
      const currentId = sessionManager.getCurrentSessionId();
      if (currentId && currentId !== sess.id) {
        const currentSess = await sessionManager.loadSession(sid, currentId);
        if (currentSess) {
          currentSess.status = 'paused';
          await sessionManager.updateSessionMessages(currentSess, messages, [], { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
        }
      }
    } catch (err) {
      console.error('[VibeScript] Failed to pause current session:', err);
    }
    // load selected session
    try {
      await sessionManager.deactivateOtherSessions(sid, sess.id);
      const loaded = await sessionManager.loadSession(sid, sess.id);
      if (loaded) {
        loaded.status = 'active';
        await sessionManager.saveSession(loaded);
        useChatStore.getState().setMessages(loaded.messages || []);
      }
    } catch (err) {
      console.error('[VibeScript] Failed to switch session:', err);
    }
    await loadSessions();
  }, [scriptId, messages, loadSessions]);

  const handleDeleteSession = useCallback(async (e: React.MouseEvent, sessId: string) => {
    e.stopPropagation();
    const sid = scriptId || 'global';
    await sessionManager.deleteSession(sid, sessId);
    // if deleted current session, clear chat
    if (sessionManager.getCurrentSessionId() === sessId) {
      useChatStore.getState().setMessages([]);
      sessionManager.setCurrentSession(null);
    }
    await loadSessions();
  }, [scriptId, loadSessions]);

  const handleRenameSession = useCallback(async (sessId: string, newLabel: string) => {
    if (newLabel.trim()) {
      const sid = scriptId || 'global';
      await sessionManager.renameSession(sid, sessId, newLabel.trim());
      await loadSessions();
    }
    setRenamingSessionId(null);
  }, [scriptId, loadSessions]);

  const pairedAgentSteps = useMemo(() => {
    return pairSteps(agentSteps);
  }, [agentSteps]);

  // Auto-scroll to bottom — instant during streaming so it keeps up, smooth for message transitions
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isAgentRunning ? 'instant' : 'smooth' });
  }, [messages, isLoading, agentSteps, currentStepText, reasoningText, isAgentRunning]);

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

  const filteredAgents = useMemo(() => {
    if (!autocompleteQuery) return Object.values(AGENT_ROLES);
    return Object.values(AGENT_ROLES).filter((r) =>
      r.id.toLowerCase().includes(autocompleteQuery.toLowerCase())
    );
  }, [autocompleteQuery]);

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
      const query = match[1].toLowerCase();
      const agentMatch = Object.values(AGENT_ROLES).find((r) => r.id.startsWith(query));
      if (agentMatch && query.length > 0) {
        // Agent mentions don't need file autocomplete
        setShowAutocomplete(true);
        setAutocompleteQuery(match[1]);
        setAutocompleteTriggerIndex(selectionStart - match[1].length - 1);
        setAutocompleteIndex(0);
        fetchOpenFiles();
      } else {
        setShowAutocomplete(true);
        setAutocompleteQuery(match[1]);
        setAutocompleteTriggerIndex(selectionStart - match[1].length - 1);
        setAutocompleteIndex(0);
        fetchOpenFiles();
      }
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
              <Sparkles className={`w-3.5 h-3.5 ${currentRole?.id === 'explore' ? 'text-blue-500' : currentRole?.id === 'plan' ? 'text-purple-500' : 'text-amber-500'} animate-pulse`} />
              <span className="text-zinc-700 font-semibold">
                {currentRole?.label || 'AI Assistant'} {agentStatus === 'thinking' ? '(thinking)' : '(executing tools)'}
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
              {pairedAgentSteps.length === 0 && !currentStepText && !reasoningText ? (
                <div className="flex items-center gap-2 text-zinc-500 text-[11.5px] py-0.5 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                  Thinking...
                </div>
              ) : (
                <>
                  {pairedAgentSteps.map((step, idx) => (
                    <React.Fragment key={idx}>
                      {step.reasoningText && (
                        <details open className="group text-[11px]">
                          <summary className="flex items-center gap-1.5 cursor-pointer text-zinc-500 hover:text-zinc-700 font-medium select-none">
                            <ChevronDown className="w-3 h-3 group-open:rotate-0 -rotate-90 transition-transform" />
                            <Brain className="w-3.5 h-3.5" />
                            Thinking
                          </summary>
                          <div className="mt-1.5 p-2.5 rounded-md bg-zinc-50 border border-zinc-200 text-zinc-600 text-[10.5px] leading-relaxed">
                            <MarkdownRenderer content={step.reasoningText} />
                          </div>
                        </details>
                      )}
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
                  {reasoningText && (
                    <details open className="group text-[11px]">
                      <summary className="flex items-center gap-1.5 cursor-pointer text-zinc-500 hover:text-zinc-700 font-medium select-none">
                        <ChevronDown className="w-3 h-3 group-open:rotate-0 -rotate-90 transition-transform" />
                        <Brain className="w-3.5 h-3.5" />
                        Thinking
                      </summary>
                      <div className="mt-1.5 p-2.5 rounded-md bg-zinc-50 border border-zinc-200 text-zinc-600 text-[10.5px] leading-relaxed">
                        <MarkdownRenderer content={reasoningText} />
                      </div>
                    </details>
                  )}
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
              <span className="text-zinc-700 font-semibold">{currentRole?.label || 'AI Assistant'} (failed)</span>
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
        {showAutocomplete && (filteredFiles.length > 0 || filteredAgents.length > 0) && (
          <div className="absolute left-0 bottom-[calc(100%+8px)] z-50 w-72 bg-popover border border-border rounded-md shadow-md overflow-hidden max-h-56 overflow-y-auto p-1">
            {filteredAgents.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider bg-popover">
                  Agents
                </div>
                {filteredAgents.map((agent, idx) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      const text = textareaRef.current?.value || '';
                      const before = text.substring(0, autocompleteTriggerIndex);
                      const after = text.substring(textareaRef.current?.selectionStart || 0);
                      const mentionString = `@${agent.id}`;
                      const newText = before + mentionString + ' ' + after;
                      setDraftInput(newText);
                      setShowAutocomplete(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 flex items-center justify-between text-xs transition-colors rounded-sm cursor-pointer ${
                      idx === autocompleteIndex ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground hover:bg-accent/50 hover:text-accent-foreground'
                    }`}
                  >
                    <span className="truncate">{agent.label}</span>
                    <span className="text-[9px] text-muted-foreground truncate max-w-[140px]">{agent.description}</span>
                  </button>
                ))}
              </>
            )}
            {filteredFiles.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider bg-popover">
                  Files
                </div>
                {filteredFiles.map((file, idx) => (
                  <button
                    key={file.name}
                    type="button"
                    onClick={() => selectFile(file.name)}
                    className={`w-full text-left px-2 py-1.5 flex items-center justify-between text-xs transition-colors rounded-sm cursor-pointer ${
                      idx === autocompleteIndex ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground hover:bg-accent/50 hover:text-accent-foreground'
                    }`}
                  >
                    <span className="truncate">{file.name}</span>
                    {file.isActive && (
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-250 px-1.5 py-0.5 rounded font-semibold scale-90">
                        Active
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Top Control Bar (Status & Sessional Management) */}
        <div className="flex items-center justify-between px-1 text-[11px]">
          {/* Connection Status Badge */}
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

          {/* Sessional Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewSession}
              className="text-[10px] text-zinc-400 hover:text-zinc-700 flex items-center gap-1 font-semibold uppercase tracking-wide cursor-pointer bg-transparent border-0 p-0 transition-colors"
              title="New session"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
            {sessions.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-[10px] text-zinc-400 hover:text-zinc-700 flex items-center gap-1 font-semibold uppercase tracking-wide cursor-pointer bg-transparent border-0 p-0 transition-colors">
                    {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" side="bottom" className="w-64 p-1 max-h-80 overflow-y-auto">
                  <div className="sticky top-0 px-2 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider bg-popover border-b border-border mb-1">
                    Sessions
                  </div>
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="group flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground text-foreground"
                      onClick={() => handleSwitchSession(sess)}
                    >
                      {renamingSessionId === sess.id ? (
                        <input
                          autoFocus
                          className="flex-1 text-xs px-1.5 py-0.5 border border-border rounded bg-background text-foreground outline-none"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameSession(sess.id, renameValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSession(sess.id, renameValue);
                            if (e.key === 'Escape') setRenamingSessionId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="flex-1 truncate font-medium"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setRenamingSessionId(sess.id);
                            setRenameValue(sess.label);
                          }}
                          title="Double-click to rename"
                        >
                          {sess.label}
                        </span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${
                        sess.status === 'active' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                        'bg-zinc-100 text-zinc-500'
                      }`}>
                        {sess.status}
                      </span>
                      <button
                        onClick={(e) => handleDeleteSession(e, sess.id)}
                        className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-red-100 text-zinc-400 hover:text-red-600 transition-all cursor-pointer border-0 bg-transparent"
                        title="Delete session"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Input Card Container */}
        <div className="flex flex-col bg-zinc-100/50 border border-zinc-200 focus-within:border-zinc-350 focus-within:bg-white rounded-lg overflow-hidden transition-all duration-150 shadow-sm p-2 gap-1.5">
          <MentionInput
            textareaRef={textareaRef}
            value={draftInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isActiveTabAppsScript ? "Ask AI or say 'create a function to...'" : "Connect Apps Script to start coding..."}
            disabled={!isActiveTabAppsScript && messages.length === 0}
            className="w-full min-h-[44px] text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none resize-none bg-transparent border-0 p-0"
          />

          {/* Action Toolbar */}
          <div className="flex items-center justify-between mt-0.5">
            {/* Left Actions: Copy & Reset */}
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

            {/* Right Actions: Send */}
            <Button
              onClick={handleSend}
              disabled={isLoading || !draftInput.trim()}
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
