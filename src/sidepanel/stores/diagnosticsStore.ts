import { create } from 'zustand';
import { eventBus } from '../../shared/eventBus';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warn';
}

interface DiagnosticsState {
  logs: LogEntry[];
  addLog: (message: string, type?: 'info' | 'error' | 'success' | 'warn') => void;
  clearLogs: () => void;
}

export const useDiagnosticsStore = create<DiagnosticsState>((set) => ({
  logs: [],

  addLog: (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    set((state) => ({
      logs: [{ timestamp, message, type }, ...state.logs].slice(0, 100)
    }));
  },

  clearLogs: () => {
    set({ logs: [] });
  }
}));

const diagnosticsSubs = new Set<() => void>();

export function subscribeDiagnostics(): void {
  if (diagnosticsSubs.size > 0) {
    return;
  }

  diagnosticsSubs.add(
    eventBus.on('tool:start', (data) => {
      useDiagnosticsStore.getState().addLog(`Tool: ${data.name}`, 'info');
    })
  );
  diagnosticsSubs.add(
    eventBus.on('tool:result', (data) => {
      const status = data.success ? 'success' : 'error';
      useDiagnosticsStore.getState().addLog(
        `Tool ${data.name}: ${data.success ? 'OK' : 'FAIL'} (${data.duration}ms)`,
        status
      );
    })
  );
  diagnosticsSubs.add(
    eventBus.on('agent:status', (data) => {
      useDiagnosticsStore.getState().addLog(
        `Agent: ${data.status}${data.role ? ` (${data.role})` : ''}`,
        'info'
      );
    })
  );
  diagnosticsSubs.add(
    eventBus.on('agent:error', (data) => {
      useDiagnosticsStore.getState().addLog(`Error: ${data.error}`, 'error');
    })
  );
  diagnosticsSubs.add(
    eventBus.on('session:change', (data) => {
      useDiagnosticsStore.getState().addLog(
        `Session ${data.action}: ${data.sessionId}`,
        'info'
      );
    })
  );
}

export function unsubscribeDiagnostics(): void {
  for (const unsub of diagnosticsSubs) {
    unsub();
  }
  diagnosticsSubs.clear();
}
