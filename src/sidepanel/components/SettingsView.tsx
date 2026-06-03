import React, { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { PROVIDERS } from '../../shared/constants';
import type { Provider } from '../../shared/types';
import { Key, Settings as SettingsIcon, ShieldAlert, Check, Eye, EyeOff } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { provider, apiKeys, models, setProvider, setApiKey, setModel } = useSettingsStore();
  const [showKeys, setShowKeys] = useState<Record<Provider, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
    deepseek: false
  });
  const [saveStatus, setSaveStatus] = useState<Record<Provider, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
    deepseek: false
  });

  const toggleKeyVisibility = (p: Provider) => {
    setShowKeys(prev => ({ ...prev, [p]: !prev[p] }));
  };

  const handleKeyChange = (p: Provider, val: string) => {
    setApiKey(p, val);
    setSaveStatus(prev => ({ ...prev, [p]: true }));
    setTimeout(() => {
      setSaveStatus(prev => ({ ...prev, [p]: false }));
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-zinc-200 p-4 overflow-y-auto gap-4">
      {/* Title */}
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-850">
        <SettingsIcon className="w-4 h-4 text-zinc-400" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-350">Workspace Settings</h2>
      </div>

      {/* Info Alert */}
      <div className="flex gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/20 text-xs text-zinc-400 leading-relaxed shadow-sm">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-zinc-500" />
        <div>
          <span className="font-semibold text-zinc-200">Bring Your Own Key (BYOK)</span>. Keys are stored locally in your extension's container (`chrome.storage.local`) and called directly from your browser. Your credentials are never uploaded to third-party proxy servers.
        </div>
      </div>

      {/* Provider Selection */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
          Active AI Provider
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => {
            const isSelected = provider === p;
            return (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'border-zinc-650 bg-zinc-900 text-zinc-50 shadow-sm'
                    : 'border-zinc-800 bg-zinc-950/20 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <span className="text-xs font-medium">{PROVIDERS[p].name}</span>
                <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-zinc-400 font-medium' : 'text-zinc-500'}`}>
                  {models[p] ? models[p].split('-').slice(0, 2).join(' ') : 'Default'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* API Key configuration per provider */}
      <div className="flex flex-col gap-3 mt-1">
        <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
          API Credentials & Models
        </label>

        {(Object.keys(PROVIDERS) as Provider[]).map((p) => {
          const config = PROVIDERS[p];
          const isCurrent = provider === p;

          return (
            <div
              key={p}
              className={`p-3 rounded-lg border transition-all duration-150 ${
                isCurrent
                  ? 'border-zinc-850 bg-zinc-900/25 shadow-sm'
                  : 'border-transparent bg-zinc-950/10 opacity-50 hover:opacity-100 hover:border-zinc-850 hover:bg-zinc-950/20'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wide">
                  <Key className="w-3.5 h-3.5 text-zinc-500" />
                  {config.name}
                </span>
                {isCurrent && (
                  <span className="text-[8px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-semibold tracking-wider uppercase">
                    Active
                  </span>
                )}
              </div>

              {/* API Key Input */}
              <div className="flex flex-col gap-1 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">Secret Key</span>
                  {saveStatus[p] && (
                    <span className="text-[9px] text-emerald-500 flex items-center gap-0.5 font-semibold uppercase animate-pulse">
                      <Check className="w-3 h-3" /> Auto-Saved
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showKeys[p] ? 'text' : 'password'}
                    value={apiKeys[p] || ''}
                    placeholder={`sk-••••••••••••••••••••`}
                    onChange={(e) => handleKeyChange(p, e.target.value)}
                    className="w-full text-xs bg-transparent border border-zinc-800 focus:border-zinc-700 rounded-md pl-3 pr-8 py-1.5 text-zinc-200 placeholder-zinc-650 outline-none transition-colors focus:ring-1 focus:ring-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() => toggleKeyVisibility(p)}
                    className="absolute right-2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showKeys[p] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Model Dropdown */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">Model Selection</span>
                <select
                  value={models[p] || config.defaultModel}
                  onChange={(e) => setModel(p, e.target.value)}
                  className="w-full text-xs bg-[#09090b] border border-zinc-800 focus:border-zinc-700 rounded-md px-2.5 py-1.5 text-zinc-350 outline-none cursor-pointer transition-colors"
                >
                  {config.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Branding */}
      <div className="text-[9px] text-zinc-600 text-center mt-auto pt-4 border-t border-zinc-900 flex items-center justify-center gap-1">
        VibeScript v1.0.0 — Created with Antigravity
      </div>
    </div>
  );
};
