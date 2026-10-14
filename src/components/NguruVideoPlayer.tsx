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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerIdRef = useRef<string>(`nguru-yt-${Math.random().toString(36).slice(2, 9)}`);
  const playerRef = useRef<any>(null);
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

  const controlsTimeoutRef = useRef<any>(null);
  const progressTimerRef = useRef<any>(null);

  // Load YouTube IFrame API script globally once
  useEffect(() => {
    if (!window.YT) {
      const existingScript = document.getElementById('yt-iframe-api-script');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }
    }
  }, []);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Safe command sender (via YT API instance or postMessage fallback)
  const sendCommand = useCallback((func: string, args: any[] = []) => {
    if (playerRef.current && typeof playerRef.current[func] === 'function') {
      try {
        playerRef.current[func](...args);
        return;
      } catch (err) {
        console.warn('YT player instance error:', err);
      }
    }

    // Fallback: postMessage to iframe directly
    try {
      const iframe =
        iframeRef.current ||
        (document.getElementById(playerIdRef.current) as HTMLIFrameElement) ||
        containerRef.current?.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      }
    } catch (e) {
      console.warn('postMessage fallback warning:', e);
    }
  }, []);

  // Initialize YT.Player instance
  const initYTPlayer = useCallback(() => {
    if (!window.YT || !window.YT.Player) return;

    const el = document.getElementById(playerIdRef.current);
    if (!el) return;

    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      try {
        playerRef.current.loadVideoById({
          videoId,
          startSeconds: Math.floor(startSeconds),
        });
        return;
      } catch {
        // proceed to rebuild
      }
    }

    try {
      playerRef.current = new window.YT.Player(playerIdRef.current, {
        videoId,
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
          disablekb: 1,
          playsinline: 1,
          enablejsapi: 1,
          start: Math.floor(startSeconds),
          autoplay: isStarted ? 1 : 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            const dur = event.target.getDuration();
            if (typeof dur === 'number' && dur > 0) setDuration(dur);
            if (isStarted) {
              event.target.playVideo();
              setIsPlaying(true);
            }
          },
          onStateChange: (event: any) => {
            // 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 3 = BUFFERING
            if (event.data === 1) {
              setIsPlaying(true);
              setHasEnded(false);
            } else if (event.data === 2) {
              setIsPlaying(false);
            } else if (event.data === 0) {
              setIsPlaying(false);
              setHasEnded(true);
              onEnded?.();
            }
          },
        },
      });
    } catch (err) {
      console.warn('Failed to construct YT.Player:', err);
    }
  }, [videoId, startSeconds, isStarted, onEnded]);

  // Setup player on mount or video change
  useEffect(() => {
    setIsPlaying(autoPlay);
    setIsStarted(autoPlay);
    setCurrentTime(startSeconds);
    setDuration(0);
    setHasEnded(false);
    setThumbnailError(false);

    if (window.YT && window.YT.Player) {
      initYTPlayer();
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.YT && window.YT.Player) {
          clearInterval(interval);
          initYTPlayer();
        } else if (attempts > 30) {
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [videoId, autoPlay, startSeconds, initYTPlayer]);

  // Periodic polling for scrub timeline while playing
  useEffect(() => {
    if (isPlaying) {
      progressTimerRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const curr = playerRef.current.getCurrentTime();
            const dur = playerRef.current.getDuration();
            if (typeof curr === 'number') setCurrentTime(curr);
            if (typeof dur === 'number' && dur > 0) setDuration(dur);
          } catch {
            // ignore
          }
        }
      }, 350);
    }
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying]);

  // Listen to postMessage from iframe
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

        if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') setCurrentTime(data.info.currentTime);
          if (typeof data.info.duration === 'number' && data.info.duration > 0) setDuration(data.info.duration);
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
    setIsCinemaMode((prev) => {
      const next = !prev;
      if (!next) setIsLandscapeRotated(false);
      return next;
    });
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3500);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const thumbnailUrl = thumbnailError
    ? `https://img.youtube.com/vi/${videoId}/0.jpg`
    : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
        setShowSpeedMenu(false);
      }}
      className={`select-none transition-all duration-200 ${
        isCinemaMode
          ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-3 sm:p-6 overflow-y-auto'
          : `relative bg-slate-950 rounded-2xl border border-slate-200 shadow-md overflow-hidden ${className}`
      }`}
    >
      {/* 
        IN-APP CINEMA VIEW HEADER
        (Clean Nguru branding, Landscape rotation mode toggle, Exit Cinema button)
      */}
      {isCinemaMode && (
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between pb-3 px-2 text-white shrink-0">
          <div className="flex items-center gap-2 truncate pr-4">
            <span className="w-2.5 h-2.5 rounded-full bg-[#003380] ring-2 ring-blue-400 animate-pulse shrink-0" />
            <div className="truncate">
              <h2 className="font-bold text-sm sm:text-base truncate drop-shadow-sm">
                {title}
              </h2>
              {conceptTitle && (
                <p className="text-xs text-blue-300 truncate">
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-sm transition-colors border ${
                isLandscapeRotated
                  ? 'bg-[#003380] text-white border-blue-400/40 shadow-xs'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10'
              }`}
              title="Toggle Landscape / Wide Theater Mode"
            >
              <Smartphone className={`w-3.5 h-3.5 transition-transform ${isLandscapeRotated ? 'rotate-90 text-blue-300' : ''}`} />
              <span className="hidden sm:inline">
                {isLandscapeRotated ? 'Wide View Active' : 'Landscape Mode'}
              </span>
            </button>

            {/* Exit Cinema Mode */}
            <button
              type="button"
              onClick={toggleCinemaMode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm transition-colors border border-white/10"
              title="Exit Cinema Mode (Esc)"
            >
              <Minimize2 className="w-4 h-4" />
              <span className="hidden xs:inline sm:inline">Exit</span>
            </button>
          </div>
        </div>
      )}

      {/* 
        16:9 VIDEO CONTAINER (Masked & Cropped)
        - aspect-video with overflow-hidden
        - The YouTube iframe is overscaled and shifted -mt-[60px] to clip all YouTube UI
      */}
      <div
        className={`relative bg-black flex items-center justify-center overflow-hidden transition-all duration-300 ${
          isCinemaMode
            ? `w-full max-w-5xl aspect-video max-h-[72vh] mx-auto rounded-2xl shadow-2xl border border-white/10 ${
                isLandscapeRotated ? 'max-w-6xl max-h-[78vh]' : ''
              }`
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
          <div className="w-full h-[calc(100%+120px)] -mt-[60px] pointer-events-none select-none">
            <div id={playerIdRef.current} className="w-full h-full pointer-events-none" />
          </div>
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
            <div className="relative z-10 flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#003380]/90 backdrop-blur-md border border-blue-400/30 text-[11px] font-bold text-white shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                <span>Nguru Shielded Player</span>
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
            <div className="relative z-10">
              {conceptTitle && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 bg-blue-950/70 px-2 py-0.5 rounded border border-blue-400/20 mb-1 inline-block">
                  {conceptTitle}
                </span>
              )}
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

      {/* 
        5. PINNED FEEDBACK BAR IN CINEMA VIEW
        When expanded to in-app Cinema View, pinned cleanly at the bottom
      */}
      {isCinemaMode && feedbackBar && (
        <div className="w-full max-w-5xl mx-auto pt-4 shrink-0">
          {feedbackBar}
        </div>
      )}
    </div>
  );
};
