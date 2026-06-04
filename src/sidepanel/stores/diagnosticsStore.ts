import { create } from 'zustand';

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
  clearLogs: () => set({ logs: [] })
}));
