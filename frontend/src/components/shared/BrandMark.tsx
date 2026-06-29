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
  const maskId = `vitalsync-brand-mask-${instanceId}`;

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
          <stop offset="0%" stopColor="#1E8C9E" />
          <stop offset="100%" stopColor="#106675" />
        </linearGradient>

        {/* VitalSync Brand Green Gradient (Light Green to Leaf Green) */}
        <linearGradient id={greenGradId} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7AD38D" />
          <stop offset="100%" stopColor="#4CAF50" />
        </linearGradient>

        {/* Premium Mask to create a transparent cut-out leaf vein */}
        <mask id={maskId}>
          {/* Base white color keeps everything visible */}
          <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
          {/* Black stroke cuts out the leaf vein path cleanly down the leaf's center line */}
          <path
            d="M 20 78 C 19 58 19 38 20 20"
            stroke="#000000"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </mask>
      </defs>

      {/* ── MATHEMatically CENTERED VECTOR EMBLEM (LEAF + ECG + ARROWS) ── */}
      <g transform="translate(1, 1) scale(0.98)">
        
        {/* Left Side: Symmetrical, elegant leaf shape with centered cut-out vein */}
        <path
          d="M 20 80 C 4 60 4 38 20 18 C 28 38 28 60 20 80 Z"
          fill={`url(#${greenGradId})`}
          mask={`url(#${maskId})`}
        />

        {/* Center: Clean integrated ECG heartbeat pulse, starting inside leaf body */}
        <path
          d="M 22 50 L 30 50 L 34 26 L 39 72 L 44 34 L 49 58 L 53 44 L 57 48 L 65 48"
          stroke={`url(#${tealGradId})`}
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Concentric Sweeps at the bottom-right forming the unified care loop */}
        {/* Swoosh 1 (Inner Teal Curve) */}
        <path
          d="M 20 80 C 34 94 58 92 68 76 C 74 68 76 58 76 48"
          stroke={`url(#${tealGradId})`}
          strokeWidth="4.8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Arrow head 1 (Teal) - Aligned up-right with the curve tangent */}
        <path
          d="M 69 52 L 76 48 L 79 56"
          stroke={`url(#${tealGradId})`}
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Swoosh 2 (Outer Green Curve) */}
        <path
          d="M 16 84 C 32 102 64 100 78 82 C 85 73 87 62 87 52"
          stroke={`url(#${greenGradId})`}
          strokeWidth="4.8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Arrow head 2 (Green) - Aligned up-right with the curve tangent */}
        <path
          d="M 80 56 L 87 52 L 90 60"
          stroke={`url(#${greenGradId})`}
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
