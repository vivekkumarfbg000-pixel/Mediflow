import { useId } from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

export function BrandMark({ size = 40, className = '', title = 'Mediflow' }: BrandMarkProps) {
  const instanceId = useId().replace(/:/g, '');
  const bgId = `mediflow-brand-bg-${instanceId}`;
  const cyanGradId = `mediflow-brand-cyan-grad-${instanceId}`;
  const goldGradId = `mediflow-brand-gold-grad-${instanceId}`;
  const cyanGlowId = `mediflow-brand-cyan-glow-${instanceId}`;
  const goldGlowId = `mediflow-brand-gold-glow-${instanceId}`;

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
        {/* Deep navy/slate professional clinical gradient */}
        <linearGradient id={bgId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0B1224" />
          <stop offset="0.5" stopColor="#0F172A" />
          <stop offset="1" stopColor="#1E293B" />
        </linearGradient>

        {/* Cyan 3D Sphere Radial Gradient */}
        <radialGradient id={cyanGradId} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#E0F7FA" />
          <stop offset="30%" stopColor="#26C6DA" />
          <stop offset="70%" stopColor="#0097A7" />
          <stop offset="100%" stopColor="#006064" />
        </radialGradient>

        {/* Gold 3D Sphere Radial Gradient */}
        <radialGradient id={goldGradId} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFDE7" />
          <stop offset="35%" stopColor="#FFD54F" />
          <stop offset="75%" stopColor="#FF8F00" />
          <stop offset="100%" stopColor="#E65100" />
        </radialGradient>

        {/* Glowing filters for the spheres */}
        <filter id={cyanGlowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur1" />
          <feColorMatrix type="matrix" values="
            0 0 0 0.08 0
            0 0 0 0.82 0
            0 0 0 0.88 0
            0 0 0 0.90 0
          " in="blur1" result="colorBlur" />
          <feMerge>
            <feMergeNode in="colorBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id={goldGlowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur1" />
          <feColorMatrix type="matrix" values="
            0 0 0 0.98 0
            0 0 0 0.70 0
            0 0 0 0.08 0
            0 0 0 0.80 0
          " in="blur1" result="colorBlur" />
          <feMerge>
            <feMergeNode in="colorBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Rounded gradient background container */}
      <rect x="2" y="2" width="96" height="96" rx="28" fill={`url(#${bgId})`} stroke="#1E293B" strokeWidth="1.5" />
      <rect x="3" y="3" width="94" height="94" rx="27" fill="white" fillOpacity="0.02" />

      {/* NEON GLOW BACKING PATHS (renders underneath white lines) */}
      <path
        d="M 40 82 L 40 68 Q 40 60 32 60 L 28 60 A 10 10 0 0 1 28 40 L 32 40 Q 40 40 40 32 L 40 28 A 10 10 0 0 1 60 28 L 60 32 Q 60 40 68 40 L 72 40 A 10 10 0 0 1 72 60 L 68 60 Q 60 60 60 68 L 60 82"
        stroke="#06B6D4"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.3"
        filter={`url(#${cyanGlowId})`}
      />
      <path
        d="M 50 18 L 50 38 Q 50 50 42 50 L 36 50 L 34 44 L 32 56 L 30 50 L 18 50"
        stroke="#06B6D4"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.25"
        filter={`url(#${cyanGlowId})`}
      />
      <path
        d="M 82 50 L 70 50 L 68 44 L 66 56 L 64 50 L 58 50 Q 50 50 50 62 L 50 82"
        stroke="#06B6D4"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.25"
        filter={`url(#${cyanGlowId})`}
      />

      {/* Curved outer medical cross outline */}
      <path
        d="M 40 82 L 40 68 Q 40 60 32 60 L 28 60 A 10 10 0 0 1 28 40 L 32 40 Q 40 40 40 32 L 40 28 A 10 10 0 0 1 60 28 L 60 32 Q 60 40 68 40 L 72 40 A 10 10 0 0 1 72 60 L 68 60 Q 60 60 60 68 L 60 82"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.95"
      />

      {/* Path 1: Top-to-Left ECG Connection */}
      <path
        d="M 50 18 L 50 38 Q 50 50 42 50 L 36 50 L 34 44 L 32 56 L 30 50 L 18 50"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Path 2: Right-to-Bottom ECG Connection */}
      <path
        d="M 82 50 L 70 50 L 68 44 L 66 56 L 64 50 L 58 50 Q 50 50 50 62 L 50 82"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Glowing Cyan Sphere: Top Peak */}
      <circle
        cx="50"
        cy="18"
        r="4.5"
        fill={`url(#${cyanGradId})`}
        filter={`url(#${cyanGlowId})`}
      />

      {/* Glowing Cyan Sphere: Left Peak */}
      <circle
        cx="18"
        cy="50"
        r="4.5"
        fill={`url(#${cyanGradId})`}
        filter={`url(#${cyanGlowId})`}
      />

      {/* Glowing Cyan Sphere: Right Peak */}
      <circle
        cx="82"
        cy="50"
        r="4.5"
        fill={`url(#${cyanGradId})`}
        filter={`url(#${cyanGlowId})`}
      />

      {/* Glowing Gold Sphere: Central Node */}
      <circle
        cx="50"
        cy="50"
        r="3.5"
        fill={`url(#${goldGradId})`}
        filter={`url(#${goldGlowId})`}
      />
    </svg>
  );
}
