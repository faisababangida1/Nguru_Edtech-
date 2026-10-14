/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Crown, Sparkles, Check, ChevronDown, Shield, Info } from 'lucide-react';
import { Tier } from '../types';

interface TierBadgeProps {
  currentTier: Tier;
  onSelectTier: (tier: Tier) => void;
  specificUsageToday?: number;
}

export const TierBadge: React.FC<TierBadgeProps> = ({
  currentTier,
  onSelectTier,
  specificUsageToday = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const tierDetails = {
    free: {
      name: 'Free Tier',
      tag: 'Free',
      color: 'bg-slate-800 text-slate-300 border-slate-700',
      activeCoursesLimit: 1,
      specificDailyLimit: 2,
      features: ['1 Active Course Roadmap', '2 Specific Gap Searches/day', 'Basic Diagnostic Tests']
    },
    go: {
      name: 'Nguru Go',
      tag: 'Go',
      color: 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm',
      activeCoursesLimit: 5,
      specificDailyLimit: 'Unlimited',
      features: ['5 Active Courses', 'Unlimited Specific Mode', 'Persistent Learner DNA', 'Adaptive Re-Routing']
    },
    pro: {
      name: 'Nguru Pro',
      tag: 'Pro',
      color: 'bg-gradient-to-r from-amber-500/20 to-emerald-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
      activeCoursesLimit: 'Unlimited',
      specificDailyLimit: 'Unlimited',
      features: ['Unlimited Everything', 'Precision Timestamp Pinpointing', 'Deep Cognitive DNA Analysis', 'Priority Reality-Check Prescriptions']
    }
  };

  const current = tierDetails[currentTier];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${current.color} hover:brightness-110`}
        title="Click to preview & test subscription tiers"
      >
        {currentTier === 'pro' ? (
          <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        )}
        <span>{current.name}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Subscription Limits Demo</span>
              </span>
              <span className="text-[10px] text-slate-500">Test switcher</span>
            </div>

            <div className="mt-3 space-y-2.5">
              {(['free', 'go', 'pro'] as Tier[]).map((tierKey) => {
                const info = tierDetails[tierKey];
                const isSelected = currentTier === tierKey;
                return (
                  <div
                    key={tierKey}
                    onClick={() => {
                      onSelectTier(tierKey);
                      setIsOpen(false);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500 ring-1 ring-indigo-500/50 shadow-md'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        {tierKey === 'pro' && <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                        {info.name}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>

                    <ul className="text-[11px] text-slate-400 space-y-0.5 mt-1.5">
                      {info.features.map((f, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span className="text-indigo-400">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Today&apos;s Specific Searches:</span>
              <span className="font-mono font-semibold text-slate-200">
                {specificUsageToday} {currentTier === 'free' ? '/ 2' : '(Unlimited)'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
