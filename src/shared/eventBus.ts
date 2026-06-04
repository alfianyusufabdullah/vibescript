import type { AgentStatus } from './types';

export interface AgentStatusEvent {
  status: AgentStatus;
  role?: string;
}

export interface ToolStartEvent {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  name: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

export interface AgentErrorEvent {
  error: string;
  role?: string;
}

export interface SessionChangeEvent {
  sessionId: string;
  action: 'created' | 'saved' | 'loaded' | 'deleted';
}

export interface AgentEventMap extends EventMap {
  'tool:start': [ToolStartEvent];
  'tool:result': [ToolResultEvent];
  'agent:status': [AgentStatusEvent];
  'agent:error': [AgentErrorEvent];
  'session:change': [SessionChangeEvent];
}

type EventHandler<T extends unknown[]> = (...args: T) => void;

export interface EventMap {
  [key: string]: unknown[];
}

export class EventBus<T extends EventMap> {
  private listeners = new Map<keyof T, Set<EventHandler<unknown[]>>>();

  on<K extends keyof T>(event: K, handler: EventHandler<T[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown[]>);
    return () => {
      this.listeners.get(event)?.delete(handler as EventHandler<unknown[]>);
    };
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (e) {
          console.error(`[EventBus] Error in handler for "${String(event)}":`, e);
        }
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus<AgentEventMap>();
