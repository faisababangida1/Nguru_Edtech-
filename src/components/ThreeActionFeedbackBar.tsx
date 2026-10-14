/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Single-Row Horizontal Feedback Bar (Matches exact diagram):
 * [ ✓ Like ] [ Write your comment / review...              (✈) ] [ ✕ Dislike ]
 */

import React, { useState } from 'react';
import { Check, X, Send, Sparkles, RefreshCw } from 'lucide-react';
import { CourseStepReview } from '../types';

interface ThreeActionFeedbackBarProps {
  stepTitle: string;
  existingReview?: CourseStepReview;
  onLike: (comment?: string) => void;
  onNeutral: (note: string) => void;
  onDislikeAndReroute: (reason: string) => void;
  isRerouting?: boolean;
}

export const ThreeActionFeedbackBar: React.FC<ThreeActionFeedbackBarProps> = ({
  stepTitle: _stepTitle,
  existingReview,
  onLike,
  onNeutral,
  onDislikeAndReroute,
  isRerouting = false,
}) => {
  const [commentText, setCommentText] = useState('');
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [showDislikeMenu, setShowDislikeMenu] = useState(false);
  const [showLikeTags, setShowLikeTags] = useState(false);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3000);
  };

  const handleLike = (tag?: string) => {
    const preference = tag || commentText.trim() || undefined;
    onLike(preference);
    setCommentText('');
    showToast(tag ? `Liked: "${tag}"! Saved to Learner DNA.` : 'Marked as Liked! We will prioritize this style.');
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onNeutral(commentText.trim());
    showToast('Feedback recorded. Adapting lesson sequence.');
    setCommentText('');
  };

  const handleDislike = (reason?: string) => {
    const finalReason = reason || commentText.trim() || 'Did not match desired pace or depth';
    setShowDislikeMenu(false);
    onDislikeAndReroute(finalReason);
    setCommentText('');
    showToast(`Replacing video to address: "${finalReason}"...`);
  };

  const isLiked = existingReview?.action === 'like';
  const isDisliked = existingReview?.action === 'dislike';

  return (
    <div className="space-y-2 relative">
      {/* 
        Single Unified Horizontal Row (ALWAYS flex-row, never stacked)
        Directly attached beneath video player
      */}
      <div className="p-1.5 sm:p-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-row items-center gap-1.5 sm:gap-2.5 w-full">
        
        {/* Left Side: ✓ Like compact button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              if (isLiked) {
                setShowLikeTags((prev) => !prev);
              } else {
                handleLike();
                setShowLikeTags(true);
              }
            }}
            className={`inline-flex items-center justify-center gap-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 ${
              isLiked
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 active:scale-95'
            }`}
            title="Like this video style"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span className="hidden xs:inline sm:inline">{isLiked ? 'Liked' : 'Like'}</span>
          </button>

          {/* Quick Like Positive Trait Selector Popover */}
          {showLikeTags && (
            <div className="absolute left-0 bottom-full mb-2 p-2 bg-slate-900 border border-slate-800 text-white rounded-xl shadow-xl z-30 min-w-48 text-xs space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold px-1">
                <span>What worked best?</span>
                <button
                  type="button"
                  onClick={() => setShowLikeTags(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {[
                  'Crystal-clear visual breakdown',
                  'Great practical pace',
                  'Actionable real-world examples',
                  'Intuitive mental model',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      handleLike(tag);
                      setShowLikeTags(false);
                    }}
                    className="text-left px-2 py-1 rounded-lg hover:bg-[#003380] text-slate-200 hover:text-white text-[11px] transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: Flexible Width Inline Input with embedded submit icon */}
        <form onSubmit={handleSendComment} className="flex-1 min-w-0 relative flex items-center">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write your review or comment..."
            className="w-full text-xs pl-3 pr-9 py-2 sm:py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#003380] focus:bg-white transition-all truncate"
          />
          <button
            type="submit"
            disabled={!commentText.trim()}
            className="absolute right-1 w-7 h-7 rounded-lg bg-[#003380] hover:bg-[#002966] disabled:opacity-30 disabled:hover:bg-[#003380] text-white flex items-center justify-center transition-colors"
            title="Submit comment"
          >
            <Send className="w-3 h-3 translate-x-px" />
          </button>
        </form>

        {/* Right Side: ✕ Dislike compact button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowDislikeMenu(!showDislikeMenu)}
            disabled={isRerouting}
            className={`inline-flex items-center justify-center gap-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 ${
              isDisliked
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200 active:scale-95 disabled:opacity-50'
            }`}
            title="Dislike and immediately swap to a different video"
          >
            {isRerouting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-700" />
                <span className="hidden sm:inline">Swapping...</span>
              </>
            ) : (
              <>
                <X className="w-3.5 h-3.5 stroke-[3]" />
                <span className="hidden xs:inline sm:inline">Dislike</span>
              </>
            )}
          </button>

          {/* Quick Dislike Reason Popover */}
          {showDislikeMenu && (
            <div className="absolute right-0 bottom-full mb-2 p-2.5 bg-slate-900 border border-slate-800 text-white rounded-xl shadow-xl z-30 min-w-56 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold px-1">
                <span>Why replace this video?</span>
                <button
                  type="button"
                  onClick={() => setShowDislikeMenu(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {[
                  'Too slow / too much fluff',
                  'Too complex / too technical',
                  'Poor audio or visual clarity',
                  'I prefer hands-on demonstrations',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => handleDislike(reason)}
                    className="text-left px-2 py-1.5 rounded-lg hover:bg-rose-600/80 text-slate-200 hover:text-white text-[11px] transition-colors"
                  >
                    • {reason}
                  </button>
                ))}
              </div>

              <div className="pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleDislike('Different instructor needed')}
                  className="w-full text-center py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 font-bold text-white text-[11px] transition-colors"
                >
                  Swap Video Now
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Status Feedback Toast */}
      {statusToast && (
        <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-[#003380] font-medium flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-[#003380] shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Adaptive Reroute Notification */}
      {existingReview?.adaptiveRerouted && (
        <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-[#003380] flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-[#003380] shrink-0" />
          <span>
            <strong>Swapped to next lesson video:</strong> {existingReview.rerouteReason || 'Alternative presentation loaded.'}
          </span>
        </div>
      )}
    </div>
  );
};
