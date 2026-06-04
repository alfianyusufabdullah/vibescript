import type { AgentSession, ChatMessage, AgentStep, TokenUsage } from '../../shared/types';
import { eventBus } from '../../shared/eventBus';

const SESSION_PREFIX = 'vibescript_session_';
const SESSION_INDEX_SUFFIX = '_index';
const MAX_SESSIONS_PER_SCRIPT = 10;

export class SessionManager {
  private currentSessionId: string | null = null;

  async createSession(
    scriptId: string,
    label: string,
    agentRole: string
  ): Promise<AgentSession> {
    const session: AgentSession = {
      id: this.generateId(),
      scriptId,
      label,
      status: 'active',
      agentRole,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      steps: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };

    await this.saveSession(session);
    await this.addToIndex(scriptId, session.id);
    await this.pruneOldSessions(scriptId);

    eventBus.emit('session:change', { sessionId: session.id, action: 'created' });
    this.currentSessionId = session.id;
    return session;
  }

  async saveSession(session: AgentSession): Promise<void> {
    session.updatedAt = Date.now();
    const key = `${SESSION_PREFIX}${session.scriptId}_${session.id}`;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: session });
    }
  }

  async loadSession(scriptId: string, sessionId: string): Promise<AgentSession | null> {
    const key = `${SESSION_PREFIX}${scriptId}_${sessionId}`;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get([key]);
      const session = result[key] as AgentSession | undefined;
      if (session) {
        this.currentSessionId = session.id;
        eventBus.emit('session:change', { sessionId: session.id, action: 'loaded' });
        return session;
      }
    }
    return null;
  }

  async deleteSession(scriptId: string, sessionId: string): Promise<void> {
    const key = `${SESSION_PREFIX}${scriptId}_${sessionId}`;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove([key]);
      await this.removeFromIndex(scriptId, sessionId);
      eventBus.emit('session:change', { sessionId, action: 'deleted' });
    }
  }

  async listSessions(scriptId: string): Promise<AgentSession[]> {
    const ids = await this.getSessionIndex(scriptId);
    if (ids.length === 0) return [];

    const keys = ids.map((id) => `${SESSION_PREFIX}${scriptId}_${id}`);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(keys);
      const sessions: AgentSession[] = [];
      for (const id of ids) {
        const session = result[`${SESSION_PREFIX}${scriptId}_${id}`] as AgentSession | undefined;
        if (session) sessions.push(session);
      }
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return [];
  }

  async updateSessionMessages(
    session: AgentSession,
    messages: ChatMessage[],
    steps: AgentStep[],
    tokenUsage: TokenUsage
  ): Promise<void> {
    session.messages = messages;
    session.steps = steps;
    session.tokenUsage = tokenUsage;
    await this.saveSession(session);
    eventBus.emit('session:change', { sessionId: session.id, action: 'saved' });
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  setCurrentSession(sessionId: string | null): void {
    this.currentSessionId = sessionId;
  }

  async deactivateOtherSessions(scriptId: string, activeSessionId: string): Promise<void> {
    const all = await this.listSessions(scriptId);
    for (const sess of all) {
      if (sess.id !== activeSessionId && sess.status === 'active') {
        sess.status = 'paused';
        await this.saveSession(sess);
      }
    }
  }

  async renameSession(scriptId: string, sessionId: string, newLabel: string): Promise<void> {
    const session = await this.loadSession(scriptId, sessionId);
    if (session) {
      session.label = newLabel;
      await this.saveSession(session);
    }
  }

  async startNewSession(scriptId: string, roleId: string): Promise<AgentSession> {
    const existing = await this.listSessions(scriptId);
    const session = await this.createSession(scriptId, `Session ${existing.length + 1}`, roleId);
    return session;
  }

  private async getSessionIndex(scriptId: string): Promise<string[]> {
    const key = `${SESSION_PREFIX}${scriptId}${SESSION_INDEX_SUFFIX}`;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get([key]);
      return (result[key] as string[]) || [];
    }
    return [];
  }

  private async addToIndex(scriptId: string, sessionId: string): Promise<void> {
    const ids = await this.getSessionIndex(scriptId);
    if (!ids.includes(sessionId)) {
      ids.push(sessionId);
      const key = `${SESSION_PREFIX}${scriptId}${SESSION_INDEX_SUFFIX}`;
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [key]: ids });
      }
    }
  }

  private async removeFromIndex(scriptId: string, sessionId: string): Promise<void> {
    let ids = await this.getSessionIndex(scriptId);
    ids = ids.filter((id) => id !== sessionId);
    const key = `${SESSION_PREFIX}${scriptId}${SESSION_INDEX_SUFFIX}`;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: ids });
    }
  }

  private async pruneOldSessions(scriptId: string): Promise<void> {
    const ids = await this.getSessionIndex(scriptId);
    if (ids.length <= MAX_SESSIONS_PER_SCRIPT) return;

    const sessions = await this.listSessions(scriptId);
    const completed = sessions
      .filter((s) => s.status === 'completed' || s.status === 'error')
      .sort((a, b) => a.updatedAt - b.updatedAt);

    const toRemove = sessions.length - MAX_SESSIONS_PER_SCRIPT;
    for (let i = 0; i < Math.min(toRemove, completed.length); i++) {
      await this.deleteSession(scriptId, completed[i].id);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const sessionManager = new SessionManager();
