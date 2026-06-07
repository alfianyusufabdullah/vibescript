import React, { useEffect } from 'react';
import { useSettingsStore } from './stores/settingsStore';
import { useEditorStore } from './stores/editorStore';
import { useChatStore } from './stores/chatStore';
import { useUiStore } from './stores/uiStore';
import { FloatingButton } from './components/FloatingButton';
import { OffcanvasShell } from './components/OffcanvasShell';

export const App: React.FC = () => {
  const { initialized: settingsInitialized, loadSettings } = useSettingsStore();
  const { initialized: uiInitialized, loadUiState } = useUiStore();
  const { scriptId, detectActiveTab, fetchContext } = useEditorStore();
  const { loadHistory } = useChatStore();

  useEffect(() => {
    loadSettings();
    loadUiState();
  }, [loadSettings, loadUiState]);

  useEffect(() => {
    const init = async () => {
      await detectActiveTab();
      await fetchContext();
    };

    if (settingsInitialized && uiInitialized) {
      init();
      window.addEventListener('focus', init);
      return () => {
        window.removeEventListener('focus', init);
      };
    }
  }, [settingsInitialized, uiInitialized, detectActiveTab, fetchContext]);

  useEffect(() => {
    if (settingsInitialized && scriptId) {
      loadHistory(scriptId);
    }
  }, [settingsInitialized, scriptId, loadHistory]);

  if (!settingsInitialized || !uiInitialized) {
    return null;
  }

  return (
    <div className="font-sans text-zinc-900 antialiased selection:bg-zinc-200 selection:text-zinc-900">
      <FloatingButton />
      <OffcanvasShell />
    </div>
  );
};

export default App;
