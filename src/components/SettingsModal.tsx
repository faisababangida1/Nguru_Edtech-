/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Key, Shield, Check, RefreshCw, AlertTriangle, ExternalLink, Database } from 'lucide-react';
import { storageService } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetData,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (isOpen) {
      storageService.getYouTubeApiKey().then(setApiKey);
      setSavedSuccess(false);
      setConfirmReset(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await storageService.saveYouTubeApiKey(apiKey);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleClear = async () => {
    await storageService.saveYouTubeApiKey('');
    setApiKey('');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">App Settings & Keys</h3>
              <p className="text-xs text-slate-400">Configure external APIs and modular storage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6">
          {/* YouTube Data API Key */}
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center justify-between">
                <span>YouTube Data API v3 Key (Optional)</span>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-normal"
                >
                  <span>Get Google Cloud Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200/90 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Zero Setup Friction:</span>
              </div>
              <p className="text-[11px] text-indigo-200/80 leading-relaxed">
                If provided, Nguru queries live YouTube Data API v3 for embeddable videos.
                If empty, Nguru automatically uses the <strong>Gemini 3.8 Flash</strong> engine with verified educational YouTube embeds so the entire platform is 100% operational immediately!
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleClear}
                disabled={!apiKey}
                className="text-xs text-slate-400 hover:text-rose-400 disabled:opacity-30 transition-colors"
              >
                Clear Key
              </button>
              <div className="flex items-center gap-2">
                {savedSuccess && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Saved!
                  </span>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </form>

          {/* Modular Storage Architecture Note */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Storage Abstraction Layer</span>
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Nguru uses a decoupled asynchronous storage service (<code>src/services/storageService.ts</code>).
              It currently mirrors all Learner DNA state, active courses, and delusion calibration to local storage, ready to plug into DynamoDB or PostgreSQL without UI changes.
            </p>
          </div>

          {/* Reset Demo Data */}
          <div className="pt-4 border-t border-slate-800">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Preloaded Demo Courses & Learner DNA</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-2 text-center">
                <p className="text-xs text-rose-200">
                  Are you sure? This restores the initial Jollof Rice & Electromagnetism profiles.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onResetData();
                      setConfirmReset(false);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    Confirm Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
