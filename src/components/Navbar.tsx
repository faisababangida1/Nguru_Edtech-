/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, Crosshair, CheckSquare, User, Crown } from 'lucide-react';
import { NguruLogo } from './NguruLogo';
import { Tier } from '../types';

export type MainTab = 'learn' | 'specific' | 'test' | 'account';

interface NavbarProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  currentTier: Tier;
  onOpenUpgradeModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentTier,
  onOpenUpgradeModal,
}) => {
  const tabs = [
    { id: 'learn' as MainTab, label: 'Learn', icon: BookOpen },
    { id: 'specific' as MainTab, label: 'Specific', icon: Crosshair },
    { id: 'test' as MainTab, label: 'Test', icon: CheckSquare },
    { id: 'account' as MainTab, label: 'Account & Pro', icon: User },
  ];

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Official Brand Logo */}
          <button
            onClick={() => onTabChange('learn')}
            className="text-left focus:outline-none"
          >
            <NguruLogo size={36} />
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-[#003380] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#003380]' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5">
            {currentTier === 'free' ? (
              <button
                onClick={onOpenUpgradeModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#003380] to-[#0047AB] hover:from-[#002966] hover:to-[#003380] shadow-xs transition-all"
              >
                <Crown className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>Upgrade Pro</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-[#003380]/10 text-[#003380] border border-[#003380]/20">
                <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{currentTier === 'pro' ? 'Pro Member' : 'Go Member'}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (4 clean tabs) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-lg px-2 py-1.5 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[11px] font-semibold transition-colors ${
                isActive
                  ? 'text-[#003380]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div
                className={`p-1 rounded-md mb-0.5 ${
                  isActive ? 'bg-[#003380]/10' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#003380]' : 'text-slate-500'}`} />
              </div>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
