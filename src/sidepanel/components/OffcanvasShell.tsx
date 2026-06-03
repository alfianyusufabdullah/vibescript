import React, { useEffect, useState, useCallback } from 'react';
import { useUiStore } from '../stores/uiStore';
import { ChatView } from './ChatView';
import { SettingsView } from './SettingsView';
import { MessageSquare, Settings as SettingsIcon, Sparkles, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

const updateIdeLayout = (isOpen: boolean, isInitial: boolean) => {
  const children = Array.from(document.body.children);
  children.forEach((child) => {
    // Skip vibescript root, script tags, style/link tags, and overlays that shouldn't shrink
    if (
      child.id === 'vibescript-root' ||
      child.tagName === 'SCRIPT' ||
      child.tagName === 'STYLE' ||
      child.tagName === 'LINK'
    ) {
      return;
    }

    if (isOpen) {
      if (isInitial) {
        child.classList.add('vibescript-no-transition');
      } else {
        child.classList.remove('vibescript-no-transition');
        child.classList.add('vibescript-ide-transition');
      }
      child.classList.add('vibescript-ide-shrunk');
    } else {
      if (isInitial) {
        child.classList.add('vibescript-no-transition');
      } else {
        child.classList.remove('vibescript-no-transition');
        child.classList.add('vibescript-ide-transition');
      }
      child.classList.remove('vibescript-ide-shrunk');
    }
  });
};

export const OffcanvasShell: React.FC = () => {
  const { isPanelOpen, activeTab, setActiveTab, panelWidth, setPanelWidth, setPanelOpen } = useUiStore();
  const [isInitial, setIsInitial] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Sync dynamic stylesheet for ide-shrunk with current panel width
  useEffect(() => {
    let style = document.getElementById('vibescript-dynamic-shrunk-styles') as HTMLStyleElement;
    if (!style) {
      style = document.createElement('style');
      style.id = 'vibescript-dynamic-shrunk-styles';
      document.head.appendChild(style);
    }
    style.textContent = `
      .vibescript-ide-shrunk {
        right: ${panelWidth}px !important;
        width: calc(100% - ${panelWidth}px) !important;
      }
    `;
  }, [panelWidth]);

  useEffect(() => {
    // Update the position/width of IDE elements dynamically
    updateIdeLayout(isPanelOpen, isInitial);

    if (isPanelOpen) {
      document.body.classList.add('vibescript-panel-open');
    } else {
      document.body.classList.remove('vibescript-panel-open');
    }

    if (isInitial) {
      // Force an immediate Monaco resize for the initial layout bounds
      window.dispatchEvent(new Event('resize'));
      
      const timer = setTimeout(() => {
        document.body.classList.remove('vibescript-no-transition');
        // Clean up no-transition from other body children
        const children = Array.from(document.body.children);
        children.forEach((child) => {
          child.classList.remove('vibescript-no-transition');
        });
        setIsInitial(false);
      }, 50);
      return () => clearTimeout(timer);
    }

    // Trigger window resize event repeatedly during transition to force Monaco resize
    const interval = setInterval(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      window.dispatchEvent(new Event('resize'));
    }, 350); // clear after transition completes

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isPanelOpen, isInitial]);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsDragging(true);
    document.body.classList.add('vibescript-no-transition');

    const startWidth = useUiStore.getState().panelWidth;
    const startX = mouseDownEvent.clientX;

    const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
      const deltaX = startX - mouseMoveEvent.clientX;
      const newWidth = startWidth + deltaX;
      // Clamp width between 280px and 800px (or viewport width minus 100px)
      const clampedWidth = Math.max(280, Math.min(newWidth, window.innerWidth - 100, 800));
      setPanelWidth(clampedWidth);
      window.dispatchEvent(new Event('resize'));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.classList.remove('vibescript-no-transition');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [setPanelWidth]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(val) => setActiveTab(val as 'chat' | 'settings')}
      className={`fixed top-0 right-0 h-screen bg-white border-l border-solid border-zinc-200 shadow-2xl flex flex-col z-[999990] select-none ${
        isInitial ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
      }`}
      style={{
        width: `${panelWidth}px`,
        transform: isPanelOpen ? 'translateX(0)' : 'translateX(100%)'
      }}
    >
      {/* Resizer Handle */}
      <div
        onMouseDown={startResizing}
        className={`absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-zinc-300 active:bg-zinc-400 transition-colors z-[999999] ${
          isDragging ? 'bg-zinc-400' : 'bg-transparent'
        }`}
      />

      {/* Header Banner - Shadcn style */}
      <header className="flex items-center justify-between px-4 py-3.5 bg-white border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-zinc-700" />
          <span className="text-xl font-bold tracking-tight text-zinc-900 font-sans">
            VibeScript
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Tab Selector - Shadcn/UI Tabs List style */}
          <TabsList>
            <TabsTrigger value="chat" className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5">
              <SettingsIcon className="w-3.5 h-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Close Panel Button */}
          <button
            onClick={() => setPanelOpen(false)}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Close VibeScript Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Tab Area */}
      <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col mt-0">
        <ChatView />
      </TabsContent>
      <TabsContent value="settings" className="flex-1 min-h-0 overflow-y-auto mt-0">
        <SettingsView />
      </TabsContent>
    </Tabs>
  );
};

