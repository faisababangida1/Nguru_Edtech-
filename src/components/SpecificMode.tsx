/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Crosshair,
  Sparkles,
  ArrowRight,
  Clock,
  Play,
  CheckCircle,
  Lightbulb,
  Layers,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { SpecificGapResult, LearnerDNA, Tier } from '../types';
import { apiClient } from '../services/apiClient';
import { storageService } from '../services/storageService';
import { NguruVideoPlayer } from './NguruVideoPlayer';

interface SpecificModeProps {
  dna: LearnerDNA;
  currentTier: Tier;
  specificUsageToday: number;
  onIncrementUsage: () => void;
  onOpenUpgradeModal: () => void;
  initialUnderstood?: string;
  initialMissingLink?: string;
}

export const SpecificMode: React.FC<SpecificModeProps> = ({
  dna,
  currentTier,
  specificUsageToday,
  onIncrementUsage,
  onOpenUpgradeModal,
  initialUnderstood = '',
  initialMissingLink = '',
}) => {
  const [understood, setUnderstood] = useState(initialUnderstood);
  const [missingLink, setMissingLink] = useState(initialMissingLink);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpecificGapResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLimitReached = currentTier === 'free' && specificUsageToday >= 2;

  const handleRunGapFiller = async (u = understood, m = missingLink) => {
    if (!u.trim() || !m.trim()) {
      setError('Please provide both what you already understand and your exact question.');
      return;
    }

    if (isLimitReached) {
      onOpenUpgradeModal();
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await apiClient.runGapFiller(u, m, dna);
      setResult(res);
      onIncrementUsage();
    } catch (err) {
      console.error(err);
      setError('Unable to analyze conceptual bridge. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadExample1 = () => {
    const u = 'I understand technical analysis, support and resistance lines, and candlestick charts.';
    const m = 'Why do false breakouts happen so frequently right after a key resistance level is broken?';
    setUnderstood(u);
    setMissingLink(m);
    handleRunGapFiller(u, m);
  };

  const loadExample2 = () => {
    const u = 'I understand electromagnetism, wavelengths, and basic cellular telecommunications.';
    const m = 'How do radio waves physically penetrate 8-inch solid concrete walls without being completely absorbed?';
    setUnderstood(u);
    setMissingLink(m);
    handleRunGapFiller(u, m);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#003380] text-xs font-bold border border-blue-200">
          <Crosshair className="w-3.5 h-3.5 text-[#003380]" />
          <span>Precision Gap-Filler</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-[#003380] tracking-tight">
          Stuck on one confusing piece?
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Skip hours of introductory videos. Tell us what you already grasp and the exact point where it feels like &ldquo;magic&rdquo;.
        </p>

        {/* Quick Example Chips */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Try an example:</span>
          <button
            onClick={loadExample1}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium shadow-xs transition-colors"
          >
            Chart False Breakouts
          </button>
          <button
            onClick={loadExample2}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium shadow-xs transition-colors"
          >
            Radio Waves Through Walls
          </button>
        </div>
      </div>

      {/* Dual Input Form */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-blue-100 text-[#003380] flex items-center justify-center text-xs">
                1
              </span>
              <span>What do you already understand about this topic?</span>
            </label>
            <textarea
              rows={4}
              value={understood}
              onChange={(e) => setUnderstood(e.target.value)}
              placeholder="e.g. I know how to read stock charts, recognize trendlines, and place orders, but..."
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#003380] focus:bg-white resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center text-xs">
                2
              </span>
              <span>What specific part is confusing you?</span>
            </label>
            <textarea
              rows={4}
              value={missingLink}
              onChange={(e) => setMissingLink(e.target.value)}
              placeholder="e.g. Why does price surge above resistance only to immediately collapse into a trap?"
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#003380] focus:bg-white resize-none"
            />
          </div>

        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            Daily searches used: <strong className="text-slate-800">{specificUsageToday}</strong> {currentTier === 'free' ? '/ 2 (Free Plan)' : '(Unlimited)'}
          </div>

          <button
            onClick={() => handleRunGapFiller()}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#003380] hover:bg-[#002966] disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            {loading ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Finding Exact Lesson...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Find Targeted Video & Explanation</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          
          {/* Plain English Conceptual Bridge */}
          <div className="p-6 sm:p-8 rounded-3xl bg-blue-50/70 border border-blue-200 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#003380] border border-blue-200 text-xs font-bold">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Key Revelation</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              {result.ahaMoment}
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {result.conceptualBridge}
            </p>
          </div>

          {/* 3-Bullet Bridge Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {result.bridgeSummary.map((bullet, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                <span className="w-6 h-6 rounded-lg bg-blue-50 text-[#003380] font-bold text-xs flex items-center justify-center">
                  {idx + 1}
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {bullet}
                </p>
              </div>
            ))}
          </div>

          {/* Targeted Video Player */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Targeted Video Recommendation
                </h4>
                <p className="text-xs text-slate-500">
                  Cued to the segment resolving this exact missing link.
                </p>
              </div>
              {result.recommendedVideo.timestampLabel && (
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                  Cued to: {result.recommendedVideo.timestampLabel}
                </span>
              )}
            </div>

            <NguruVideoPlayer
              videoId={result.recommendedVideo.videoId}
              title={result.recommendedVideo.title}
              channelTitle={result.recommendedVideo.channel}
              startSeconds={result.recommendedVideo.startSeconds}
            />

            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 shadow-xs">
              <strong className="text-slate-900 block mb-0.5">Why this video addresses your gap:</strong>
              {result.recommendedVideo.whyThisSection}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
