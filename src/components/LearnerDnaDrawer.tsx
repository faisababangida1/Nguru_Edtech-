/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  Dna,
  Zap,
  Target,
  Brain,
  ShieldAlert,
  CheckCircle,
  History,
  Sparkles,
  ArrowRight,
  Eye,
  Sliders,
  Layers,
  Flame
} from 'lucide-react';
import { LearnerDNA, BlindSpot } from '../types';

interface LearnerDnaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dna: LearnerDNA;
  onResolveBlindSpot: (spotId: string) => void;
  onSelectTopicForTest?: (topic: string) => void;
}

export const LearnerDnaDrawer: React.FC<LearnerDnaDrawerProps> = ({
  isOpen,
  onClose,
  dna,
  onResolveBlindSpot,
  onSelectTopicForTest,
}) => {
  if (!isOpen) return null;

  const activeBlindSpots = dna.blindSpots.filter((s) => s.status === 'active');
  const resolvedBlindSpots = dna.blindSpots.filter((s) => s.status === 'resolved');

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm transition-opacity">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                  <Dna className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Learner DNA Profile
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Live Evolving
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Zero video bloat. Only lightweight cognitive metadata.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 divide-y divide-slate-800/80">
            
            {/* Top Stat Gauges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Comprehension</span>
                  <Brain className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">
                  {dna.comprehensionAverage}%
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${dna.comprehensionAverage}%` }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Calibration Index</span>
                  <Target className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">
                  {dna.delusionCalibrationScore}/100
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {dna.delusionCalibrationScore > 80
                    ? 'High Self-Awareness'
                    : 'Watch out for Blind Spots'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Interactions</span>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">
                  {dna.videosWatchedCount}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {dna.totalQuizzesTaken} diagnostic checks taken
                </p>
              </div>
            </div>

            {/* Cognitive Style & Formats */}
            <div className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  Preferred Formats & Pacing
                </h4>
                <span className="text-[11px] text-slate-500 capitalize">
                  Pacing: <strong className="text-slate-300">{dna.pacing}</strong>
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {dna.preferredStyles.map((style, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    {style}
                  </span>
                ))}
              </div>
            </div>

            {/* Active Illusion of Competence / Blind Spots */}
            <div className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Identified Blind Spots ({activeBlindSpots.length} Active)
                </h4>
              </div>

              {activeBlindSpots.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center">
                  <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-slate-300">No Active Blind Spots</p>
                  <p className="text-[11px] text-slate-500">
                    Your confidence matches your actual test retrieval accuracy!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeBlindSpots.map((spot) => (
                    <div
                      key={spot.id}
                      className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {spot.topic}
                          </span>
                          <h5 className="text-xs font-semibold text-slate-200 mt-1">
                            {spot.concept}
                          </h5>
                        </div>
                        <button
                          onClick={() => onResolveBlindSpot(spot.id)}
                          className="shrink-0 text-[11px] px-2.5 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>Resolve</span>
                        </button>
                      </div>
                      <p className="text-xs text-amber-200/90 italic">
                        &ldquo;{spot.misconception}&rdquo;
                      </p>
                      {spot.realityCheckTitle && (
                        <div className="pt-1.5 border-t border-amber-500/20 flex items-center justify-between text-[11px] text-amber-300/80">
                          <span className="truncate max-w-[80%]">
                            Reality Check: {spot.realityCheckTitle}
                          </span>
                          {onSelectTopicForTest && (
                            <button
                              onClick={() => {
                                onSelectTopicForTest(spot.topic);
                                onClose();
                              }}
                              className="text-indigo-400 hover:text-indigo-300 font-semibold"
                            >
                              Test Now
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {resolvedBlindSpots.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    <span>{resolvedBlindSpots.length} misconception(s) previously conquered.</span>
                  </p>
                </div>
              )}
            </div>

            {/* Liked & Disliked Traits Tags */}
            <div className="pt-6 space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-emerald-400" />
                Active Adaptation Rules
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <p className="text-[11px] font-semibold text-emerald-400 mb-2 flex items-center gap-1">
                    <span>Prioritize (+Liked)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dna.likedTraits.length === 0 ? (
                      <span className="text-xs text-slate-500">None logged yet</span>
                    ) : (
                      dna.likedTraits.map((trait, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        >
                          {trait}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <p className="text-[11px] font-semibold text-rose-400 mb-2 flex items-center gap-1">
                    <span>Filter Out (-Avoided)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dna.dislikedTraits.length === 0 ? (
                      <span className="text-xs text-slate-500">None logged yet</span>
                    ) : (
                      dna.dislikedTraits.map((trait, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20"
                        >
                          {trait}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* DNA Evolution Audit Trail */}
            <div className="pt-6 space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-400" />
                Live Evolution Audit Trail
              </h4>
              <div className="space-y-2">
                {dna.evolutionLog.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs flex items-start gap-2.5"
                  >
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 shrink-0">
                      {log.date}
                    </span>
                    <div className="flex-1">
                      <p className="text-slate-200 font-medium">{log.change}</p>
                      <p className="text-[11px] text-slate-500">Trigger: {log.trigger}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Synced locally to modular storage</span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
