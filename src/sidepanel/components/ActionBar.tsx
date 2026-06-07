import React from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useAgentStore } from '../stores/agentStore';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { HelpCircle, Wrench, RefreshCw, MessageSquareCode } from 'lucide-react';
import { Button } from './ui/button';

export const ActionBar: React.FC = () => {
  const { fetchContext } = useEditorStore();
  const { isLoading } = useChatStore();
  const { run: runAgent, status: agentStatus } = useAgentStore();
  const { provider, apiKeys, models } = useSettingsStore();

  const handleAction = async (actionType: 'explain' | 'fix' | 'refactor' | 'comments') => {
    const isAgentRunning = agentStatus === 'thinking' || agentStatus === 'executing_tools';
    if (isLoading || isAgentRunning) return;

    const context = await fetchContext();
    if (!context) {
      alert('Could not retrieve code from active Apps Script editor. Please make sure you have the Apps Script editor open and focused.');
      return;
    }

    const codeToProcess = context.selectedText || context.code;
    const isSelection = !!context.selectedText;
    const scopeText = isSelection ? 'selected text' : 'active file';

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

    const scriptId = context.position ? 'current' : 'global';
    useChatStore.getState().addUserMessage(scriptId, prompt, []);
    runAgent(prompt, {
      provider,
      apiKey,
      model,
      editorContext: context,
      scriptId,
      attachments: [],
    });
  };

  const actions = [
    { type: 'explain', label: 'Explain Code', icon: HelpCircle },
    { type: 'fix', label: 'Fix Errors', icon: Wrench },
    { type: 'refactor', label: 'Refactor Code', icon: RefreshCw },
    { type: 'comments', label: 'Add JSDoc', icon: MessageSquareCode }
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-50 border-b border-zinc-200">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.type}
            disabled={isLoading}
            variant="outline"
            onClick={() => handleAction(action.type)}
            className="h-8 justify-center gap-1.5 text-[11px] font-sans font-medium text-zinc-700 bg-white"
          >
            <Icon className="w-3.5 h-3.5 text-zinc-500" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
};
