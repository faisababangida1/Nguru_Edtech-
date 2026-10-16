/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface NguruLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  compact?: boolean;
}

export const NguruLogo: React.FC<NguruLogoProps> = ({
  className = '',
  size = 36,
  showText = true,
  compact = false,
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Official Interlocking Ribbon Nguru "N" Logo Mark */}
      <div
        className="relative shrink-0 flex items-center justify-center transition-transform hover:scale-105"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-xs"
        >
          <defs>
            <linearGradient id="nguru-blue-left" x1="15" y1="15" x2="35" y2="85" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0047AB" />
              <stop offset="100%" stopColor="#003380" />
            </linearGradient>
            <linearGradient id="nguru-blue-diag" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0052CC" />
              <stop offset="50%" stopColor="#003D99" />
              <stop offset="100%" stopColor="#002966" />
            </linearGradient>
            <linearGradient id="nguru-blue-right" x1="65" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0052CC" />
              <stop offset="100%" stopColor="#003380" />
            </linearGradient>
          </defs>

          {/* Left Vertical Pillar with Rounded Corners */}
          <rect
            x="14"
            y="14"
            width="20"
            height="72"
            rx="10"
            fill="url(#nguru-blue-left)"
          />

          {/* Diagonal Interlocking Ribbon Fold */}
          <path
            d="M20 22C24 16 34 16 40 24L74 74C80 82 72 90 64 88L28 38C22 30 16 26 20 22Z"
            fill="url(#nguru-blue-diag)"
          />

          {/* Right Vertical Pillar with Rounded Corners */}
          <rect
            x="66"
            y="14"
            width="20"
            height="72"
            rx="10"
            fill="url(#nguru-blue-right)"
          />

          {/* Subtle Dynamic Interlocking Highlight */}
          <circle cx="24" cy="24" r="4" fill="#60A5FA" opacity="0.6" />
          <circle cx="76" cy="76" r="4" fill="#93C5FD" opacity="0.6" />
        </svg>
      </div>

      {showText && (
        compact ? (
          <span className="text-lg font-black tracking-tight text-[#003380]">
            Nguru
          </span>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xl font-extrabold tracking-tight text-[#003380]">
                Nguru
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0047AB] bg-[#003380]/10 px-1.5 py-0.5 rounded">
                EdTech
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 tracking-tight mt-0.5">
              Learn Anything. Education for All.
            </span>
          </div>
        )
      )}
    </div>
  );
};
