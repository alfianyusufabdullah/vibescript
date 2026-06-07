import React from 'react';
import { ChevronDown, Trash2, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import type { AgentSession } from '../../shared/types';

interface SessionPopoverProps {
  sessions: AgentSession[];
  renamingSessionId: string | null;
  renameValue: string;
  setRenamingSessionId: (id: string | null) => void;
  setRenameValue: (v: string) => void;
  onNew: () => void;
  onSwitch: (sess: AgentSession) => void;
  onDelete: (e: React.MouseEvent, sessId: string) => void;
  onRename: (sessId: string, newLabel: string) => void;
}

export const SessionPopover: React.FC<SessionPopoverProps> = ({
  sessions,
  renamingSessionId,
  renameValue,
  setRenamingSessionId,
  setRenameValue,
  onNew,
  onSwitch,
  onDelete,
  onRename,
}) => (
  <div className="flex items-center gap-3">
    <button
      onClick={onNew}
      className="text-[10px] text-zinc-400 hover:text-zinc-700 flex items-center gap-1 font-semibold uppercase tracking-wide cursor-pointer bg-transparent border-0 p-0 transition-colors"
      title="New session"
    >
      <Plus className="w-3 h-3" />
      New
    </button>

    {sessions.length > 0 && (
      <Popover>
        <PopoverTrigger asChild>
          <button className="text-[10px] text-zinc-400 hover:text-zinc-700 flex items-center gap-1 font-semibold uppercase tracking-wide cursor-pointer bg-transparent border-0 p-0 transition-colors">
            {`${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-64 p-1 max-h-80 overflow-y-auto">
          <div className="sticky top-0 px-2 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider bg-popover border-b border-border mb-1">
            Sessions
          </div>
          {sessions.map((session) => {
            const statusClassName =
              session.status === 'active'
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-zinc-100 text-zinc-500';

            return (
              <div
                key={session.id}
                className="group flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground text-foreground"
                onClick={() => onSwitch(session)}
              >
                {renamingSessionId === session.id ? (
                  <input
                    autoFocus
                    className="flex-1 text-xs px-1.5 py-0.5 border border-border rounded bg-background text-foreground outline-none"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => onRename(session.id, renameValue)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRename(session.id, renameValue);
                      }
                      if (e.key === 'Escape') {
                        setRenamingSessionId(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="flex-1 truncate font-medium"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenamingSessionId(session.id);
                      setRenameValue(session.label);
                    }}
                    title="Double-click to rename"
                  >
                    {session.label}
                  </span>
                )}
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${statusClassName}`}>
                  {session.status}
                </span>
                <button
                  onClick={(e) => onDelete(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-red-100 text-zinc-400 hover:text-red-600 transition-all cursor-pointer border-0 bg-transparent"
                  title="Delete session"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </PopoverContent>
      </Popover>
    )}
  </div>
);
