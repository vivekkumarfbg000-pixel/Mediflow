import React, { useId } from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

export function BrandMark({ size = 40, className = '', title = 'VitalSync' }: BrandMarkProps) {
  const instanceId = useId().replace(/:/g, '');
  const tealGradId = `vitalsync-brand-teal-grad-${instanceId}`;
  const greenGradId = `vitalsync-brand-green-grad-${instanceId}`;
  const shadowId = `vitalsync-brand-shadow-${instanceId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        {/* VitalSync Brand Teal Gradient (Teal to Deep Teal) */}
        <linearGradient id={tealGradId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>

        {/* VitalSync Brand Green Gradient (Light Green to Leaf Green) */}
        <linearGradient id={greenGradId} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* Premium Drop Shadow for the ECG Line */}
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="1.8" floodColor="#0F172A" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* ── GEOMETRICALLY BALANCED VECTOR EMBLEM (SOLID HERALDIC SHIELD + ECG) ── */}
      <g transform="translate(1, 1) scale(0.98)">
        {/* Left Shield Half (Green Gradient) */}
        <path
          d="M 50 84 C 26 80 18 55 18 35 L 18 18 C 30 18 42 22 50 24 L 50 84 Z"
          fill={`url(#${greenGradId})`}
        />

        {/* Right Shield Half (Teal Gradient) */}
        <path
          d="M 50 84 C 74 80 82 55 82 35 L 82 18 C 70 18 58 22 50 24 L 50 84 Z"
          fill={`url(#${tealGradId})`}
        />

        {/* Center: ECG heartbeat pulse running from x=14 to x=86, protruding slightly without nodes */}
        {/* Active White ECG Line with Drop Shadow */}
        <path
          d="M 14 52 L 36 52 L 40 66 L 45 22 L 51 80 L 56 36 L 60 56 L 64 52 L 86 52"
          stroke="#FFFFFF"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${shadowId})`}
        />
      </g>
    </svg>
  );
}
