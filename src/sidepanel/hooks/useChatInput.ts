import { useState, useMemo, useCallback, type RefObject } from 'react';
import type { CodeAttachment } from '../../shared/types';
import { useEditorStore, type FileInfo } from '../stores/editorStore';
import { useUiStore } from '../stores/uiStore';
import { useAgentStore } from '../stores/agentStore';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { AGENT_ROLES } from '../../shared/agents';

interface UseChatInputOptions {
  scriptId: string | null;
  currentContext: ReturnType<typeof useEditorStore.getState>['currentContext'];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  agentStatus: string;
}

const MENTION_REGEX = /@([a-zA-Z0-9_\-.]+)(?::(\d+)(?:-(\d+))?)?/g;

/**
 * Scans `text` for `@filename` (with optional `:lineStart-lineEnd` range) mentions,
 * fetches each file's content via `fetchFn`, and returns the resolved attachments.
 * Results are de-duplicated by `filename:lineStart-lineEnd` key.
 */
async function parseAndFetchMentions(
  text: string,
  fetchFn: (filename: string) => Promise<{ code: string } | null>
): Promise<CodeAttachment[]> {
  const finalAttachments: CodeAttachment[] = [];
  const processedKeys = new Set<string>();
  const fetchPromises: Promise<void>[] = [];

  // Reset lastIndex so the regex starts from the beginning each call
  MENTION_REGEX.lastIndex = 0;
  let match;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const filename = match[1];
    const lineStart = match[2] ? parseInt(match[2], 10) : undefined;
    const lineEnd = match[3] ? parseInt(match[3], 10) : undefined;
    const dedupeKey = `${filename}:${lineStart ?? ''}-${lineEnd ?? ''}`;

    if (processedKeys.has(dedupeKey)) {
      continue;
    }
    processedKeys.add(dedupeKey);

    const cached = useEditorStore.getState().draftAttachments.find(
      (a) => a.filename === filename && a.lineStart === lineStart && a.lineEnd === lineEnd
    );
    if (cached) {
      finalAttachments.push(cached);
    } else {
      fetchPromises.push(
        (async () => {
          try {
            const context = await fetchFn(filename);
            if (context && context.code) {
              let content = context.code;
              if (lineStart !== undefined) {
                const lines = content.split('\n');
                const startIdx = Math.max(0, lineStart - 1);
                const endIdx = lineEnd !== undefined ? Math.min(lines.length, lineEnd) : lines.length;
                content = lines.slice(startIdx, endIdx).join('\n');
              }
              finalAttachments.push({ filename, lineStart, lineEnd, content });
            }
          } catch (e) {
            console.error(`Failed to read file ${filename} for mention:`, e);
          }
        })()
      );
    }
  }

  if (fetchPromises.length > 0) {
    await Promise.all(fetchPromises);
  }
  return finalAttachments;
}

export function useChatInput({ scriptId, currentContext, textareaRef, agentStatus }: UseChatInputOptions) {
  const { provider, apiKeys, models } = useSettingsStore();
  const { draftInput, setDraftInput } = useUiStore();
  const { reset: resetAgent } = useAgentStore();

  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteTriggerIndex, setAutocompleteTriggerIndex] = useState(0);
  const [openFilesList, setOpenFilesList] = useState<FileInfo[]>([]);

  const filteredFiles = useMemo(() => {
    if (!autocompleteQuery) return openFilesList;
    return openFilesList.filter((f) => f.name.toLowerCase().includes(autocompleteQuery.toLowerCase()));
  }, [openFilesList, autocompleteQuery]);

  const filteredAgents = useMemo(() => {
    if (!autocompleteQuery) return Object.values(AGENT_ROLES);
    return Object.values(AGENT_ROLES).filter((r) => r.id.toLowerCase().includes(autocompleteQuery.toLowerCase()));
  }, [autocompleteQuery]);

  const fetchOpenFiles = useCallback(async () => {
    const files = await useEditorStore.getState().listOpenFiles();
    setOpenFilesList(files || []);
  }, []);

  const selectFile = useCallback(async (fileName: string) => {
    const context = await useEditorStore.getState().readFileByName(fileName);
    if (context) {
      useEditorStore.getState().addAttachment({ filename: fileName, content: context.code });
    }
    const text = textareaRef.current?.value || '';
    const before = text.substring(0, autocompleteTriggerIndex);
    const after = text.substring(textareaRef.current?.selectionStart || 0);
    const mentionString = `@${fileName}`;
    const newText = `${before}${mentionString} ${after}`;
    setDraftInput(newText);
    setShowAutocomplete(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = before.length + mentionString.length + 1;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  }, [textareaRef, autocompleteTriggerIndex, setDraftInput]);

  const handleSend = useCallback(async () => {
    const { isLoading } = useChatStore.getState();
    // cancel is extracted here for type-checking but agent cancellation is handled
    // by the component layer via AgentStore; it is not invoked directly in this hook.
    const { status, cancel: _cancelAgent } = useAgentStore.getState();
    const isAgentRunning = status === 'thinking' || status === 'executing_tools';
    if (!draftInput.trim() || isLoading || isAgentRunning) {
      return;
    }

    const apiKey = apiKeys[provider];
    const model = models[provider];

    if (!apiKey) {
      alert(`API Key for ${provider.toUpperCase()} is not set. Please go to Settings tab to enter it.`);
      return;
    }

    if (agentStatus === 'done' || agentStatus === 'error' || agentStatus === 'cancelled') {
      resetAgent();
    }

    const prompt = draftInput.trim();
    const activeScriptId = scriptId || 'global';

    const finalAttachments = await parseAndFetchMentions(
      prompt,
      (filename) => useEditorStore.getState().readFileByName(filename)
    );

    useEditorStore.getState().clearAttachments();
    useChatStore.getState().addUserMessage(activeScriptId, prompt, finalAttachments);

    useAgentStore.getState().run(prompt, {
      provider,
      apiKey,
      model,
      editorContext: currentContext ? { ...currentContext, scriptId } : null,
      scriptId: activeScriptId,
      attachments: finalAttachments,
    });

    setDraftInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [draftInput, provider, apiKeys, models, agentStatus, scriptId, currentContext, textareaRef, setDraftInput, resetAgent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex((p) => (p + 1) % filteredFiles.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex((p) => (p - 1 + filteredFiles.length) % filteredFiles.length);
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
  }, [showAutocomplete, filteredFiles, autocompleteIndex, selectFile, handleSend]);

  const handleInputChange = useCallback((value: string) => {
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
  }, [textareaRef, setDraftInput, fetchOpenFiles]);

  return {
    draftInput,
    showAutocomplete,
    autocompleteQuery,
    autocompleteIndex,
    autocompleteTriggerIndex,
    filteredFiles,
    filteredAgents,
    setDraftInput,
    setShowAutocomplete,
    setAutocompleteIndex,
    selectFile,
    handleSend,
    handleKeyDown,
    handleInputChange,
  };
}
