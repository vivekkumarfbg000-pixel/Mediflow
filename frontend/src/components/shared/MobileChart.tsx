import React from 'react';

interface MobileChartProps {
  title: string;
  points: number[];
  labels?: string[];
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  minVal?: number;
  maxVal?: number;
}

export const MobileChart: React.FC<MobileChartProps> = ({
  title,
  points,
  labels = [],
  height = 90,
  strokeColor = '#22d3ee', // Cyan-400
  fillColor = 'rgba(34,211,238,0.1)',
  minVal,
  maxVal
}) => {
  if (points.length === 0) return null;

  const min = minVal ?? Math.min(...points) - 5;
  const max = maxVal ?? Math.max(...points) + 5;
  const range = max - min || 1;

  const width = 320;
  const paddingX = 10;
  const paddingY = 10;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;

  // Compute dynamic SVG coordinates
  const svgPoints = points.map((p, idx) => {
    const x = paddingX + (idx / (points.length - 1)) * usableWidth;
    const y = paddingY + usableHeight - ((p - min) / range) * usableHeight;
    return { x, y };
  });

  const pathD = svgPoints.reduce(
    (acc, curr, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x} ${curr.y}`,
    ''
  );

  const fillD = `${pathD} L ${svgPoints[svgPoints.length - 1].x} ${height - paddingY} L ${svgPoints[0].x} ${height - paddingY} Z`;

  return (
    <div className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 space-y-2 relative overflow-hidden">
      
      {/* Dynamic Header */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block font-mono">
          {title} Trend
        </span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[8px] font-bold text-zinc-400 font-mono">Live Sync</span>
        </div>
      </div>

      {/* SVG Canvas Sparkline */}
      <div className="relative w-full overflow-hidden flex justify-center items-center">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Grid Guideline */}
          <line 
            x1={0} 
            y1={height / 2} 
            x2={width} 
            y2={height / 2} 
            stroke="rgba(255,255,255,0.03)" 
            strokeWidth={1} 
            strokeDasharray="4,4" 
          />

          {/* Area Fill */}
          <path d={fillD} fill={fillColor} className="transition-all duration-500 ease-out" />

          {/* Sparkline Path */}
          <path 
            d={pathD} 
            fill="none" 
            stroke={strokeColor} 
            strokeWidth={2} 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="transition-all duration-500 ease-out filter drop-shadow-[0_0_2px_rgba(34,211,238,0.2)]"
          />

          {/* Intercept Data Points */}
          {svgPoints.map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r={idx === svgPoints.length - 1 ? 4 : 2}
              fill={idx === svgPoints.length - 1 ? strokeColor : '#ffffff'}
              className="transition-all duration-500"
            />
          ))}
        </svg>
      </div>

      {/* Label Indices */}
      {labels.length > 0 && (
        <div className="flex justify-between items-center text-[8px] font-bold text-zinc-500 font-mono uppercase px-1">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
};
