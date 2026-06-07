import { useState, useCallback, useEffect } from 'react';
import type { AgentSession } from '../../shared/types';
import { useChatStore } from '../stores/chatStore';
import { sessionManager } from '../services/sessionManager';

export function useSessionManager(scriptId: string | null, agentStatus: string) {
  const messages = useChatStore((s) => s.messages);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const sid = scriptId || 'global';

  const loadSessions = useCallback(async () => {
    const sessList = await sessionManager.listSessions(sid);
    setSessions(sessList);
  }, [sid]);

  useEffect(() => {
    loadSessions();
  }, [scriptId, agentStatus, loadSessions]);

  const handleNewSession = useCallback(async () => {
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
    useChatStore.getState().setMessages([]);
    try {
      const newSess = await sessionManager.startNewSession(sid, 'build');
      sessionManager.setCurrentSession(newSess.id);
      await sessionManager.deactivateOtherSessions(sid, newSess.id);
    } catch (err) {
      console.error('[VibeScript] Failed to create new session:', err);
    }
    await loadSessions();
  }, [sid, messages, loadSessions]);

  const handleSwitchSession = useCallback(async (sess: AgentSession) => {
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
  }, [sid, messages, loadSessions]);

  const handleDeleteSession = useCallback(async (e: React.MouseEvent, sessId: string) => {
    e.stopPropagation();
    await sessionManager.deleteSession(sid, sessId);
    const wasCurrentSession = sessionManager.getCurrentSessionId() === sessId;
    if (wasCurrentSession) {
      useChatStore.getState().setMessages([]);
      sessionManager.setCurrentSession(null);
    }
    await loadSessions();
  }, [sid, loadSessions]);

  const handleRenameSession = useCallback(async (sessId: string, newLabel: string) => {
    const trimmedLabel = newLabel.trim();
    if (trimmedLabel) {
      await sessionManager.renameSession(sid, sessId, trimmedLabel);
      await loadSessions();
    }
    setRenamingSessionId(null);
  }, [sid, loadSessions]);

  return {
    sessions,
    renamingSessionId,
    renameValue,
    setRenamingSessionId,
    setRenameValue,
    handleNewSession,
    handleSwitchSession,
    handleDeleteSession,
    handleRenameSession,
    loadSessions,
  };
}
