import React, { useEffect, useState } from 'react';
import { useSettingsStore } from './stores/settingsStore';
import { useEditorStore } from './stores/editorStore';
import { useChatStore } from './stores/chatStore';
import { ChatView } from './components/ChatView';
import { SettingsView } from './components/SettingsView';
import { MessageSquare, Settings as SettingsIcon, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const { initialized, loadSettings } = useSettingsStore();
  const { scriptId, detectActiveTab, fetchContext } = useEditorStore();
  const { loadHistory } = useChatStore();
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');

  // Load API Keys & Config on startup
  useEffect(() => {
    loadSettings();
  }, []);

  // Sync tab context
  useEffect(() => {
    const init = async () => {
      await detectActiveTab();
      await fetchContext();
    };

    if (initialized) {
      init();
      // Listen for window focus to refresh editor context
      window.addEventListener('focus', init);
      return () => window.removeEventListener('focus', init);
    }
  }, [initialized]);

  // Load chat history when scriptId is resolved
  useEffect(() => {
    if (initialized && scriptId) {
      loadHistory(scriptId);
    }
  }, [initialized, scriptId]);

  if (!initialized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#09090b] text-zinc-400">
        <div className="flex flex-col items-center gap-2 animate-pulse">
          <Sparkles className="w-5 h-5 text-zinc-400" />
          <span className="text-[11px] font-medium tracking-wider uppercase text-zinc-500">Initializing...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#09090b] text-zinc-50 font-sans selection:bg-zinc-800 selection:text-zinc-100">
      {/* Header Banner - Shadcn style */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#09090b] border-b border-zinc-850">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-zinc-200" />
          <span className="text-xs font-bold tracking-tight text-zinc-100">
            VibeScript
          </span>
        </div>

        {/* Segmented Tab Selector - Shadcn/UI Toggle Group style */}
        <div className="flex items-center bg-[#18181b] p-0.5 rounded-lg border border-zinc-850">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-[#27272a] text-zinc-50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#27272a] text-zinc-50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      </header>

      {/* Main Tab Area */}
      <main className="flex-1 overflow-hidden bg-transparent">
        {activeTab === 'chat' ? <ChatView /> : <SettingsView />}
      </main>
    </div>
  );
};
export default App;
