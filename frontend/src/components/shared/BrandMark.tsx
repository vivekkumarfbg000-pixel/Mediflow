import React, { useId } from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

export function BrandMark({ size = 40, className = '', title = 'VitalSync' }: BrandMarkProps) {
  const instanceId = useId().replace(/:/g, '');
  const primaryGradId = `vitalsync-brand-primary-grad-${instanceId}`;
  const glowId = `vitalsync-brand-glow-${instanceId}`;

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
        {/* VitalSync Indigo-Teal Glow Gradient */}
        <linearGradient id={primaryGradId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>

        {/* Neon Glow Filter */}
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* VitalSync Emblem: Double Intersecting Nodes forming a 'V' + Heartbeat Sync */}
      <g transform="translate(10, 10) scale(0.8)">
        {/* Main Glowing Loop Connection */}
        <path
          d="M 20 40 C 20 20, 50 20, 50 50 C 50 80, 80 80, 80 60 C 80 40, 50 40, 50 50 C 50 60, 20 60, 20 40 Z"
          stroke={`url(#${primaryGradId})`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={`url(#${glowId})`}
        />
        
        {/* Outer Sync Ring */}
        <circle cx="50" cy="50" r="36" stroke="#4F46E5" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.4" />
        
        {/* Central Pulse Heartbeat Node */}
        <path
          d="M 38 50 L 44 50 L 47 62 L 50 35 L 53 65 L 56 46 L 59 52 L 62 50 L 68 50"
          stroke="#4F46E5"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
