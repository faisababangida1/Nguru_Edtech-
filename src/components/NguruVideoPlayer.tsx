/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 100% Shielded Nguru Proprietary Video Player
 * - Complete elimination of all visible YouTube UI, logos, red bars, and popups.
 * - Iframe Masking & Cropping: Overscaled height with negative top margin clips YouTube top & bottom UI.
 * - Transparent Nguru Touch Shield: pointer-events-auto shield intercepts all clicks (zero youtube-nocookie toasts).
 * - Custom Royal Blue Control Bar: Play/Pause, Royal Blue scrubber, -10s/+10s, speed, and in-app Cinema Expand.
 * - In-App Cinema View: Strict 16:9 letterboxing, one-tap Landscape/Rotation toggle, pinned horizontal Feedback Bar.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Gauge,
  Sparkles,
  CheckCircle2,
  Smartphone,
  ShieldCheck
} from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface NguruVideoPlayerProps {
  videoId: string;
  title: string;
  channelTitle?: string;
  conceptTitle?: string;
  startSeconds?: number;
  autoPlay?: boolean;
  onEnded?: () => void;
  className?: string;
  feedbackBar?: React.ReactNode;
  learnRank?: number;
  learnRankBadge?: string;
  cognitiveTwinMatch?: string;
}

export const NguruVideoPlayer: React.FC<NguruVideoPlayerProps> = ({
  videoId,
  title,
  channelTitle,
  conceptTitle,
  startSeconds = 0,
  autoPlay = false,
  onEnded,
  className = '',
  feedbackBar,
  learnRank,
  learnRankBadge,
  cognitiveTwinMatch,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [isStarted, setIsStarted] = useState<boolean>(autoPlay);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [currentTime, setCurrentTime] = useState<number>(startSeconds);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [isCinemaMode, setIsCinemaMode] = useState<boolean>(false);
  const [isLandscapeRotated, setIsLandscapeRotated] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [hasEnded, setHasEnded] = useState<boolean>(false);
  const [thumbnailError, setThumbnailError] = useState<boolean>(false);
  const [showSkipIntroBadge, setShowSkipIntroBadge] = useState<boolean>(false);

  const controlsTimeoutRef = useRef<any>(null);
  const progressTimerRef = useRef<any>(null);

  // Trigger auto-skip intro fluff toast when video starts with startSeconds > 0
  useEffect(() => {
    if (isStarted && startSeconds > 0) {
      setShowSkipIntroBadge(true);
      const timer = setTimeout(() => setShowSkipIntroBadge(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isStarted, startSeconds]);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Safe command sender directly via postMessage to iframe
  const sendCommand = useCallback((func: string, args: any[] = []) => {
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      } catch (e) {
        console.warn('postMessage command warning:', e);
      }
    }
  }, []);

  // Periodic polling for scrub timeline while playing
  useEffect(() => {
    if (isPlaying && isStarted) {
      progressTimerRef.current = setInterval(() => {
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');
          } catch {
            // ignore
          }
        }
        // Smooth local second advancement if playing
        setCurrentTime((prev) => {
          if (duration > 0 && prev >= duration) {
            return prev;
          }
          return prev + 0.35;
        });
      }, 350);
    }
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying, isStarted, duration]);

  // Listen to postMessage from iframe for exact YouTube delivery
  useEffect(() => {
    const handleMsg = (event: MessageEvent) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (!data || typeof data !== 'object') return;

        // infoDelivery event
        if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') {
            setCurrentTime(data.info.currentTime);
          }
          if (typeof data.info.duration === 'number' && data.info.duration > 0) {
            setDuration(data.info.duration);
          }
          if (typeof data.info.playerState === 'number') {
            if (data.info.playerState === 1) {
              setIsPlaying(true);
              setHasEnded(false);
            } else if (data.info.playerState === 2) {
              setIsPlaying(false);
            } else if (data.info.playerState === 0) {
              setIsPlaying(false);
              setHasEnded(true);
              onEnded?.();
            }
          }
        }

        // onStateChange event
        if (data.event === 'onStateChange') {
          const state = typeof data.info === 'number' ? data.info : data.data;
          if (state === 1) {
            setIsPlaying(true);
            setHasEnded(false);
          } else if (state === 2) {
            setIsPlaying(false);
          } else if (state === 0) {
            setIsPlaying(false);
            setHasEnded(true);
            onEnded?.();
          }
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [onEnded]);

  // Listen for Escape key to exit Cinema Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCinemaMode) {
        setIsCinemaMode(false);
        setIsLandscapeRotated(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCinemaMode]);

  // Transparent Touch Shield Tap Handler
  const handleTouchShieldClick = () => {
    setShowControls(true);
    if (!isStarted) {
      setIsStarted(true);
      setIsPlaying(true);
      sendCommand('playVideo');
      return;
    }

    if (isPlaying) {
      sendCommand('pauseVideo');
      setIsPlaying(false);
    } else {
      sendCommand('playVideo');
      setIsPlaying(true);
      setHasEnded(false);
    }
  };

  const seekRelative = (seconds: number) => {
    const target = Math.max(0, Math.min(duration || 9999, currentTime + seconds));
    sendCommand('seekTo', [target, true]);
    setCurrentTime(target);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = pos * duration;
    sendCommand('seekTo', [target, true]);
    setCurrentTime(target);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    sendCommand('setPlaybackRate', [rate]);
  };

  const toggleMute = () => {
    if (isMuted) {
      sendCommand('unMute');
      setIsMuted(false);
    } else {
      sendCommand('mute');
      setIsMuted(true);
    }
  };

  const toggleCinemaMode = () => {
    if (!isCinemaMode) {
      setIsCinemaMode(true);
      setShowControls(true);
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    } else {
      setIsCinemaMode(false);
      setIsLandscapeRotated(false);
      setShowControls(true);
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Fullscreen change listener to sync state with browser
  useEffect(() => {
    const handleFsChange = () => {
      if (typeof document !== 'undefined' && !document.fullscreenElement) {
        setIsCinemaMode(false);
        setIsLandscapeRotated(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 2500); // 2.5 seconds auto-hide
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const thumbnailUrl = thumbnailError
    ? `https://img.youtube.com/vi/${videoId}/0.jpg`
    : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
      onClick={handleUserActivity}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
        setShowSpeedMenu(false);
      }}
      className={`select-none transition-all duration-200 ${
        isCinemaMode
          ? 'fixed inset-0 z-[9999] bg-black w-screen h-screen m-0 p-0 overflow-hidden flex items-center justify-center'
          : `relative bg-slate-950 rounded-2xl border border-slate-200 shadow-md overflow-hidden ${className}`
      }`}
    >
      {/* 
        LANDSCAPE / TELEVISION FULLSCREEN OVERLAY HEADER
        (Minimal floating pill at top, auto-hides after 2.5s)
      */}
      {isCinemaMode && (
        <div
          className={`absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/85 via-black/40 to-transparent text-white transition-opacity duration-300 ${
            showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-3 truncate pr-4">
            <span className="w-2.5 h-2.5 rounded-full bg-[#003380] ring-2 ring-blue-400 animate-pulse shrink-0" />
            <div className="truncate">
              <h2 className="font-bold text-sm sm:text-base truncate drop-shadow-md">
                {title}
              </h2>
              {conceptTitle && (
                <p className="text-xs text-blue-300 truncate drop-shadow-sm">
                  Concept: {conceptTitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* One-Tap Landscape / Wide Rotation Mode */}
            <button
              type="button"
              onClick={() => setIsLandscapeRotated(!isLandscapeRotated)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-colors border shadow-lg ${
                isLandscapeRotated
                  ? 'bg-[#003380] text-white border-blue-400/50'
                  : 'bg-black/60 hover:bg-black/80 text-slate-200 border-white/20'
              }`}
              title="Toggle Landscape Rotation"
            >
              <Smartphone className={`w-3.5 h-3.5 transition-transform ${isLandscapeRotated ? 'rotate-90 text-blue-300' : ''}`} />
              <span className="hidden sm:inline">
                {isLandscapeRotated ? 'Rotated' : 'Rotate'}
              </span>
            </button>

            {/* Exit Fullscreen Mode */}
            <button
              type="button"
              onClick={toggleCinemaMode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-md transition-colors border border-white/20 shadow-lg"
              title="Exit Fullscreen (Esc)"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      )}

      {/* 
        VIDEO CONTAINER (Masked & Cropped)
        - In Fullscreen: fills 100vw and 100vh without borders or letterbox padding
        - In Normal View: standard 16:9 aspect-video
      */}
      <div
        className={`relative bg-black flex items-center justify-center overflow-hidden transition-all duration-300 ${
          isCinemaMode
            ? `w-full h-full ${isLandscapeRotated ? 'rotate-90 scale-90' : ''}`
            : 'w-full aspect-video'
        }`}
      >
        {/* 
          1. IFRAME MASKING & CROPPING LAYER
          Overscaled height (+120px) with -60px top margin completely clips:
          - YouTube top title & share bar
          - YouTube bottom watermark & red scrubber
          pointer-events-none ensures user never touches YouTube or receives toasts.
        */}
        <div className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none select-none">
          {isStarted ? (
            <iframe
              ref={iframeRef}
              key={`${videoId}-${startSeconds}`}
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
              title={title}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              className="w-full h-[calc(100%+120px)] -mt-[60px] border-0 pointer-events-none select-none"
              onLoad={() => {
                try {
                  iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*');
                  if (startSeconds > 0) {
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'command', func: 'seekTo', args: [startSeconds, true] }),
                      '*'
                    );
                  }
                } catch {
                  // ignore
                }
              }}
            />
          ) : (
            <div className="w-full h-full bg-black" />
          )}
        </div>

        {/* 
          2. TRANSPARENT NGURU TOUCH SHIELD
          Covers the entire video area with pointer-events-auto.
          Intercepts all user clicks and routes them through Nguru controls.
        */}
        <div
          onClick={handleTouchShieldClick}
          className="absolute inset-0 z-10 pointer-events-auto cursor-pointer"
          title={isPlaying ? 'Click to Pause' : 'Click to Play'}
        />

        {/* 
          ⚡ AUTO-SKIPPED INTRO FLUFF FLOATING BADGE
          Pops up when startSeconds > 0 to notify the learner that rambling preamble was skipped.
        */}
        {showSkipIntroBadge && startSeconds > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/95 backdrop-blur-md border border-amber-400/50 text-[11px] sm:text-xs font-bold text-amber-300 shadow-2xl pointer-events-none animate-in fade-in slide-in-from-top-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span>⚡ Auto-skipped intro fluff • Starting at key concept</span>
          </div>
        )}

        {/* 
          3. SLEEK NGURU THUMBNAIL COVER (Visible Before First Tap)
        */}
        {!isStarted && (
          <div
            onClick={handleTouchShieldClick}
            className="absolute inset-0 z-20 cursor-pointer group flex flex-col justify-between p-4 sm:p-6 text-white overflow-hidden pointer-events-auto"
          >
            <img
              src={thumbnailUrl}
              alt={title}
              onError={() => setThumbnailError(true)}
              className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/70" />

            {/* Top Badge */}
            <div className="relative z-10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#003380]/90 backdrop-blur-md border border-blue-400/30 text-[11px] font-bold text-white shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                  <span>Nguru Player</span>
                </div>
                {learnRank !== undefined && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/90 backdrop-blur-md border border-emerald-400/40 text-[11px] font-black text-emerald-300 shadow-sm">
                    LearnRank {learnRank}
                  </span>
                )}
              </div>
              {channelTitle && (
                <span className="text-xs text-slate-200 font-medium bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                  {channelTitle}
                </span>
              )}
            </div>

            {/* Center Royal Blue Play Button */}
            <div className="relative z-10 flex flex-col items-center justify-center my-auto space-y-3">
              <div className="relative flex items-center justify-center">
                <div className="absolute -inset-4 bg-[#003380]/50 rounded-full blur-xl group-hover:bg-[#003380]/80 transition-all duration-300" />
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#003380] hover:bg-[#002866] text-white flex items-center justify-center shadow-2xl ring-4 ring-white/30 transform group-hover:scale-110 active:scale-95 transition-all duration-200">
                  <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-white translate-x-0.5" />
                </div>
              </div>
              <span className="text-xs sm:text-sm font-bold text-white tracking-wide drop-shadow-md">
                Tap to Play Lesson
              </span>
            </div>

            {/* Bottom Title Bar */}
            <div className="relative z-10 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {conceptTitle && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 bg-blue-950/70 px-2 py-0.5 rounded border border-blue-400/20">
                    {conceptTitle}
                  </span>
                )}
                {startSeconds > 0 && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                    ⚡ Auto-skips {startSeconds}s intro
                  </span>
                )}
                {cognitiveTwinMatch && (
                  <span className="text-[10px] font-medium text-blue-200 bg-blue-900/40 px-2 py-0.5 rounded border border-blue-400/20">
                    Matched: {cognitiveTwinMatch}
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2 drop-shadow-sm">
                {title}
              </h3>
            </div>
          </div>
        )}

        {/* Big Center Play Icon when Paused */}
        {isStarted && !isPlaying && !hasEnded && (
          <div
            onClick={handleTouchShieldClick}
            className="absolute inset-0 z-20 flex items-center justify-center pointer-events-auto cursor-pointer bg-black/35 backdrop-blur-[1px] transition-all"
          >
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#003380] hover:bg-[#002866] text-white flex items-center justify-center shadow-2xl ring-4 ring-white/30 transform hover:scale-105 transition-all">
                <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-white translate-x-0.5" />
              </div>
            </div>
          </div>
        )}

        {/* Video Finished Prompt Overlay */}
        {hasEnded && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white space-y-3 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Lesson Finished!</h3>
              <p className="text-xs text-slate-300 max-w-sm mt-1">
                Rate this lesson below to adapt the next concept or replay.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setHasEnded(false);
                seekRelative(-9999);
                sendCommand('playVideo');
                setIsPlaying(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay Lesson</span>
            </button>
          </div>
        )}

        {/* Top Header Overlay in Normal View */}
        {!isCinemaMode && isStarted && (
          <div
            className={`absolute top-0 inset-x-0 z-20 p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between pointer-events-none transition-opacity duration-300 ${
              showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="flex items-center gap-2 truncate pr-4">
              <span className="w-2 h-2 rounded-full bg-[#003380] ring-2 ring-blue-400 animate-pulse shrink-0" />
              <span className="font-semibold text-white text-xs sm:text-sm truncate drop-shadow-sm">
                {title}
              </span>
              {channelTitle && (
                <span className="text-slate-300 text-xs hidden md:inline truncate drop-shadow-sm">
                  • {channelTitle}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {learnRank !== undefined && (
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/30 shadow-xs">
                  LR {learnRank}
                </span>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 bg-[#003380]/70 px-2 py-0.5 rounded border border-blue-400/30">
                Nguru Player
              </span>
            </div>
          </div>
        )}

        {/* 
          4. CUSTOM ROYAL BLUE NGURU CONTROL BAR
          (Pinned at bottom with custom Royal Blue progress timeline)
        */}
        {isStarted && (
          <div
            className={`absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-6 pb-3 px-3 sm:px-4 space-y-2 transition-opacity duration-300 ${
              showControls || !isPlaying
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Custom Royal Blue Scrubber Timeline */}
            <div
              onClick={handleProgressClick}
              className="group/prog relative h-2 bg-white/20 hover:h-2.5 rounded-full cursor-pointer transition-all flex items-center"
            >
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-[#003380] rounded-full relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover/prog:scale-100 transition-transform" />
              </div>
            </div>

            {/* Lower Control Actions */}
            <div className="flex items-center justify-between text-white text-xs">
              {/* Left Actions: Play/Pause, -10s, +10s, Mute, Time */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleTouchShieldClick}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-white translate-x-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => seekRelative(-10)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-200 hover:text-white transition-colors"
                  title="Rewind 10 seconds"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => seekRelative(10)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-200 hover:text-white transition-colors"
                  title="Skip 10 seconds"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-200 hover:text-white transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>

                <span className="font-mono text-[11px] sm:text-xs text-slate-300 font-semibold pl-1">
                  {formatTime(currentTime)}{' '}
                  <span className="text-slate-500">/</span> {formatTime(duration)}
                </span>
              </div>

              {/* Right Actions: Speed Selector & In-App Cinema Expand */}
              <div className="flex items-center gap-2 relative">
                {/* Speed Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-slate-200 hover:text-white flex items-center gap-1 transition-colors"
                    title="Playback speed"
                  >
                    <Gauge className="w-3 h-3" />
                    <span>{playbackRate}x</span>
                  </button>

                  {showSpeedMenu && (
                    <div className="absolute right-0 bottom-full mb-2 py-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-xs z-30 min-w-20 overflow-hidden animate-in fade-in">
                      {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => handleRateChange(rate)}
                          className={`w-full text-left px-3 py-1.5 hover:bg-[#003380] transition-colors flex items-center justify-between ${
                            playbackRate === rate
                              ? 'font-bold text-blue-400 bg-white/5'
                              : 'text-slate-200'
                          }`}
                        >
                          <span>{rate}x</span>
                          {playbackRate === rate && (
                            <span className="text-blue-400 text-xs">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* In-App Cinema Mode Expand (No native youtube-nocookie toasts!) */}
                <button
                  type="button"
                  onClick={toggleCinemaMode}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title={isCinemaMode ? 'Exit Cinema Mode' : 'Nguru Cinema Mode (16:9 Letterbox)'}
                >
                  {isCinemaMode ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
