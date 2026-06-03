import React from 'react';
import { useUiStore } from '../stores/uiStore';
import { Sparkles } from 'lucide-react';

export const FloatingButton: React.FC = () => {
  const { isPanelOpen, togglePanel } = useUiStore();

  if (isPanelOpen) return null;

  return (
    <button
      onClick={togglePanel}
      className="fixed bottom-5 right-5 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer shadow-xl transition-all duration-300 z-[999999] border hover:scale-105 active:scale-95 bg-zinc-50 border-zinc-200 text-zinc-950 hover:bg-zinc-200 shadow-zinc-950/10"
      title="Open VibeScript Panel"
    >
      <Sparkles className="w-5 h-5 animate-pulse" />
    </button>
  );
};

