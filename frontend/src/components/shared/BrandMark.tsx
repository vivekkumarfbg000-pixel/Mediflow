import React from 'react';

export interface BrandMarkProps {
  /** Size in pixels (height for logo lockups, width/height for square icon) */
  size?: number;
  /** Custom CSS classes */
  className?: string;
  /** Accessible title attribute */
  title?: string;
  /** Layout variant */
  variant?: 'icon' | 'horizontal' | 'stacked' | 'monochrome';
  /** Show the official brand tagline: "Smarter Clinics. Healthier Lives." */
  showTagline?: boolean;
  /** Theme styling override */
  theme?: 'dark' | 'light' | 'auto';
  /** Render inside the official squircle app-icon tile */
  isSquircle?: boolean;
}

/**
 * 🔤 Official VitalSync Custom Wordmark
 * Features:
 * - Full Geometric Bold UPPERCASE: "VIT∧LSYNC"
 * - Signature Crossbar-less Inverted Chevron / Lambda "∧" for the letter 'A'
 * - Dual-Tone: "VIT∧L" in #0E7A8A (dark:text-white) + "SYNC" in #4CC26B
 * - Expanded optical tracking: 0.14em
 */
export function VitalSyncWordmark({
  className = '',
  theme = 'auto',
  fontSize = '1em'
}: {
  className?: string;
  theme?: 'dark' | 'light' | 'auto';
  fontSize?: string;
}) {
  return (
    <span 
      className={`inline-flex items-center font-extrabold tracking-tight uppercase font-sans select-none leading-none ${className}`}
      style={{ fontSize }}
    >
      <span className={`${theme === 'dark' ? 'text-white' : 'text-[#0E7A8A] dark:text-white'} inline-flex items-center`}>
        VIT
        <svg 
          className="inline-block mx-[0.01em]" 
          width="0.68em" 
          height="0.82em" 
          viewBox="0 0 16 18" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="3.2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M 1.5 16.5 L 8 2.5 L 14.5 16.5" />
        </svg>
        L
      </span>
      <span className="text-[#4CC26B] ml-[0.02em]">SYNC</span>
    </span>
  );
}

/**
 * 🏛️ VitalSync Enterprise Brand Mark (Official Master Specification)
 * 
 * Renders the exact 3D Origami Ribbon "VS" Monogram alongside
 * the custom "VIT∧LSYNC" chevron-A typography.
 */
export function BrandMark({
  size = 40,
  className = '',
  title = 'VitalSync',
  variant = 'icon',
  showTagline = false,
  theme = 'auto',
  isSquircle = false
}: BrandMarkProps) {
  // ─────────────────────────────────────────────────────────────
  // 1. SQUIRCLE APP ICON (App Icon / Favicon Tile)
  // ─────────────────────────────────────────────────────────────
  if (isSquircle) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-[22%] bg-white border border-[#E2EDF0] shadow-xs overflow-hidden select-none shrink-0 ${className}`}
        style={{ width: size, height: size, padding: `${Math.round(size * 0.12)}px` }}
        title={title}
        role="img"
        aria-label={title}
      >
        <img
          src="/brand/vitalsync-mark.png"
          alt={title}
          className="w-full h-full object-contain pointer-events-none drop-shadow-xs"
          loading="eager"
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. HORIZONTAL LOCKUP (VS Mark + Custom VIT∧LSYNC Wordmark)
  // ─────────────────────────────────────────────────────────────
  if (variant === 'horizontal') {
    return (
      <div 
        className={`inline-flex items-center gap-2.5 select-none shrink-0 ${className}`} 
        style={{ height: size }}
        title={title}
        role="img"
        aria-label={title}
      >
        <img
          src="/brand/vitalsync-mark.png"
          alt={title}
          style={{ height: size, width: 'auto' }}
          className="object-contain pointer-events-none shrink-0 drop-shadow-xs"
          loading="eager"
        />
        <div className="flex flex-col justify-center leading-none">
          <VitalSyncWordmark 
            theme={theme} 
            fontSize={`${Math.max(15, Math.round(size * 0.46))}px`} 
          />
          {showTagline && (
            <span className="text-[8px] font-bold tracking-wider text-[#0E7A8A] dark:text-[#14C3D0] uppercase mt-1">
              Smarter Clinics. Healthier Lives.
            </span>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. STACKED LOGO (Mark Centered Above VIT∧LSYNC Wordmark)
  // ─────────────────────────────────────────────────────────────
  if (variant === 'stacked') {
    return (
      <div 
        className={`inline-flex flex-col items-center select-none text-center shrink-0 ${className}`}
        title={title}
        role="img"
        aria-label={title}
      >
        <img
          src="/brand/vitalsync-mark.png"
          alt={title}
          style={{ height: size, width: 'auto' }}
          className="object-contain pointer-events-none drop-shadow-xs"
          loading="eager"
        />
        <div className="mt-2.5">
          <VitalSyncWordmark 
            theme={theme} 
            fontSize={`${Math.max(16, Math.round(size * 0.38))}px`} 
          />
        </div>
        {showTagline && (
          <span className="text-[9px] font-bold tracking-wider text-[#0E7A8A] dark:text-[#14C3D0] uppercase mt-1">
            Smarter Clinics. Healthier Lives.
          </span>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. MONOCHROME / GRAYSCALE
  // ─────────────────────────────────────────────────────────────
  if (variant === 'monochrome') {
    return (
      <div 
        className={`inline-flex items-center justify-center select-none shrink-0 grayscale opacity-80 ${className}`}
        style={{ width: size, height: size }}
        title={title}
        role="img"
        aria-label={title}
      >
        <img
          src="/brand/vitalsync-mark.png"
          alt={title}
          style={{ width: size, height: size }}
          className="object-contain pointer-events-none"
          loading="eager"
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 5. DEFAULT ICON (Exact Authentic VS Ribbon Monogram)
  // ─────────────────────────────────────────────────────────────
  return (
    <div 
      className={`inline-flex items-center justify-center select-none shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={title}
      role="img"
      aria-label={title}
    >
      <img
        src="/brand/vitalsync-mark.png"
        alt={title}
        style={{ width: size, height: size }}
        className="object-contain pointer-events-none drop-shadow-xs"
        loading="eager"
      />
    </div>
  );
}
