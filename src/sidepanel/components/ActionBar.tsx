import React from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { HelpCircle, Wrench, RefreshCw, MessageSquareCode } from 'lucide-react';

export const ActionBar: React.FC = () => {
  const { fetchContext } = useEditorStore();
  const { sendMessage, isLoading } = useChatStore();
  const { provider, apiKeys, models } = useSettingsStore();

  const handleAction = async (actionType: 'explain' | 'fix' | 'refactor' | 'comments') => {
    if (isLoading) return;

    // 1. Fetch current editor state
    const context = await fetchContext();
    if (!context) {
      alert('Could not retrieve code from active Apps Script editor. Please make sure you have the Apps Script editor open and focused.');
      return;
    }

    const codeToProcess = context.selectedText || context.code;
    const isSelection = !!context.selectedText;
    const scopeText = isSelection ? 'selected text' : 'active file';

    // 2. Formulate prompt based on action
    let prompt = '';
    
    switch (actionType) {
      case 'explain':
        prompt = `Explain the following code from my Apps Script editor (${scopeText}). Highlight how it works and any important API calls:\n\n\`\`\`javascript\n${codeToProcess}\n\`\`\``;
        break;
      case 'fix':
        prompt = `Analyze the following code from my Apps Script editor (${scopeText}). Check for any syntax errors, potential runtime bugs, or incorrect Apps Script API usages, and fix them. Return only the corrected code inside a javascript block:\n\n\`\`\`javascript\n${codeToProcess}\n\`\`\``;
        break;
      case 'refactor':
        prompt = `Refactor the following code from my Apps Script editor (${scopeText}) to improve readability, performance, and structure. Ensure you follow Google Apps Script best practices (like caching and minimizing external API calls). Return the refactored code inside a javascript block:\n\n\`\`\`javascript\n${codeToProcess}\n\`\`\``;
        break;
      case 'comments':
        prompt = `Add clean, professional JSDoc comments to functions and descriptive inline comments inside the code block below from my Apps Script editor (${scopeText}). Return the commented code inside a javascript block:\n\n\`\`\`javascript\n${codeToProcess}\n\`\`\``;
        break;
    }

    const apiKey = apiKeys[provider];
    const model = models[provider];

    // 3. Send message to AI
    sendMessage(prompt, {
      provider,
      apiKey,
      model,
      editorContext: {
        ...context,
        scriptId: context.position ? 'current' : 'global' // pass a dummy identifier to group chat
      }
    });
  };

  const actions = [
    { type: 'explain', label: 'Explain Code', icon: HelpCircle },
    { type: 'fix', label: 'Fix Errors', icon: Wrench },
    { type: 'refactor', label: 'Refactor Code', icon: RefreshCw },
    { type: 'comments', label: 'Add JSDoc', icon: MessageSquareCode }
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-950/20 border-b border-zinc-850">
      {actions.map((act) => {
        const Icon = act.icon;
        return (
          <button
            key={act.type}
            disabled={isLoading}
            onClick={() => handleAction(act.type)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-zinc-800 text-[11px] font-medium text-zinc-300 bg-[#09090b] hover:bg-zinc-900 hover:text-zinc-50 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon className="w-3.5 h-3.5 text-zinc-400" />
            {act.label}
          </button>
        );
      })}
    </div>
  );
};
