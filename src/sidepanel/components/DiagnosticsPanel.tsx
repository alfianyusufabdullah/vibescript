import React from 'react';
import { useDiagnosticsStore } from '../stores/diagnosticsStore';

export const DiagnosticsPanel: React.FC = () => {
  const { logs, clearLogs } = useDiagnosticsStore();

  return (
    <div className="flex flex-col gap-2 bg-zinc-950 text-zinc-100 p-3 rounded-lg font-mono text-[10px] max-h-60 overflow-y-auto border border-zinc-800">
      <div className="flex justify-between pb-1 border-b border-zinc-800 mb-1">
        <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">Live Extension Logs</span>
        <button
          onClick={clearLogs}
          className="text-zinc-400 hover:text-white transition-colors cursor-pointer uppercase tracking-wider text-[9px]"
        >
          Clear
        </button>
      </div>
      {logs.length === 0 ? (
        <div className="text-zinc-650 italic">No diagnostic events recorded.</div>
      ) : (
        logs.map((log, index) => {
          const color =
            log.type === 'error' ? 'text-rose-400' :
            log.type === 'success' ? 'text-emerald-400' :
            log.type === 'warn' ? 'text-amber-400' :
            'text-zinc-300';
          return (
            <div key={index} className="flex gap-2 leading-relaxed">
              <span className="text-zinc-600 select-none">[{log.timestamp}]</span>
              <span className={color}>{log.message}</span>
            </div>
          );
        })
      )}
    </div>
  );
};
