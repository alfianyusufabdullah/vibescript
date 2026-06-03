import React, { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { PROVIDERS } from '../../shared/constants';
import type { Provider } from '../../shared/types';
import { Key, Settings as SettingsIcon, ShieldAlert, Check, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';

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
    <div className="flex flex-col h-full bg-zinc-50 text-zinc-800 p-4 overflow-y-auto gap-4">
      {/* Title */}
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-200">
        <SettingsIcon className="w-4 h-4 text-zinc-500" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">Workspace Settings</h2>
      </div>

      {/* Info Alert */}
      <Card className="bg-white border-zinc-200">
        <CardContent className="flex gap-3 p-3 text-xs text-zinc-650 leading-relaxed">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
          <div>
            <span className="font-semibold text-zinc-900">Bring Your Own Key (BYOK)</span>. Keys are stored locally in your extension's container (`chrome.storage.local`) and called directly from your browser. Your credentials are never uploaded to third-party proxy servers.
          </div>
        </CardContent>
      </Card>

      {/* Provider Selection */}
      <div className="flex flex-col gap-2">
        <Label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
          Active AI Provider
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => {
            const isSelected = provider === p;
            return (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all duration-150 cursor-pointer shadow-sm ${
                  isSelected
                    ? 'border-zinc-900 bg-white text-zinc-950'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800'
                }`}
              >
                <span className="text-xs font-medium">{PROVIDERS[p].name}</span>
                <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-zinc-500 font-medium' : 'text-zinc-400'}`}>
                  {models[p] ? models[p].split('-').slice(0, 2).join(' ') : 'Default'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* API Key configuration per provider */}
      <div className="flex flex-col gap-3 mt-1">
        <Label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
          API Credentials & Models
        </Label>

        {(Object.keys(PROVIDERS) as Provider[]).map((p) => {
          const config = PROVIDERS[p];
          const isCurrent = provider === p;

          return (
            <Card
              key={p}
              className={`transition-all duration-150 ${
                isCurrent
                  ? 'border-zinc-200 bg-white shadow-sm'
                  : 'border-transparent bg-zinc-100/40 opacity-50 hover:opacity-100 hover:border-zinc-200 hover:bg-zinc-100/60'
              }`}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5 uppercase tracking-wide">
                    <Key className="w-3.5 h-3.5 text-zinc-400" />
                    {config.name}
                  </span>
                  {isCurrent && (
                    <span className="text-[8px] text-zinc-650 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded font-semibold tracking-wider uppercase">
                      Active
                    </span>
                  )}
                </div>

                {/* API Key Input */}
                <div className="flex flex-col gap-1.5 mb-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">Secret Key</Label>
                    {saveStatus[p] && (
                      <span className="text-[9px] text-emerald-600 flex items-center gap-0.5 font-semibold uppercase animate-pulse">
                        <Check className="w-3 h-3" /> Auto-Saved
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <Input
                      type={showKeys[p] ? 'text' : 'password'}
                      value={apiKeys[p] || ''}
                      placeholder="sk-••••••••••••••••••••"
                      onChange={(e) => handleKeyChange(p, e.target.value)}
                      className="w-full text-xs font-mono h-8 pr-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleKeyVisibility(p)}
                      className="absolute right-0 h-8 w-8 text-zinc-400 hover:text-zinc-650 hover:bg-transparent"
                    >
                      {showKeys[p] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Model Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">Model Selection</Label>
                  <select
                    value={models[p] || config.defaultModel}
                    onChange={(e) => setModel(p, e.target.value)}
                    className="w-full text-xs bg-white border border-zinc-200 focus:border-zinc-300 rounded-md px-2.5 py-1.5 text-zinc-700 outline-none cursor-pointer transition-colors"
                  >
                    {config.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer Branding */}
      <div className="text-[9px] text-zinc-400 text-center mt-auto pt-4 border-t border-zinc-200 flex items-center justify-center gap-1">
        VibeScript v1.0.0 — Created with Antigravity
      </div>
    </div>
  );
};

