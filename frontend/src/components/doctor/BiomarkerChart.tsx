import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { HistoricalBiomarker } from '../../types';
import { Activity, AlertTriangle, Sparkles } from 'lucide-react';

interface BiomarkerChartProps {
  patientId: string;
}

export const BiomarkerChart: React.FC<BiomarkerChartProps> = ({ patientId }) => {
  const [history, setHistory] = useState<HistoricalBiomarker[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    val: number;
    date: string;
    label: string;
    threshold: string;
  } | null>(null);

  useEffect(() => {
    const fetchHistory = () => {
      const data = api.getPatientHistoricalBiomarkers(patientId) || [];
      // Sort chronologically by date
      const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setHistory(sorted);
    };

    fetchHistory();
    // Subscribe to state changes to reload immediately upon completed lab tests
    return api.subscribe(fetchHistory);
  }, [patientId]);

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-center text-slate-500 text-xs italic">
        Awaiting completed laboratory quantitative biomarkers to chart longitudinal trend lines.
      </div>
    );
  }

  // Chart coordinate calculations (Canvas size: 500x160)
  const width = 500;
  const height = 160;
  const padding = 35;

  const pointsCount = history.length;
  const xCoords = history.map((_, idx) => 
    pointsCount > 1 
      ? padding + (idx / (pointsCount - 1)) * (width - padding * 2) 
      : width / 2
  );

  // Helper to map values to Y coordinate relative to range
  const getScaleY = (val: number, min: number, max: number) => {
    const denom = max - min === 0 ? 1 : max - min;
    return height - padding - ((val - min) / denom) * (height - padding * 2);
  };

  // Biomarker ranges for clinical safety
  // 1. HbA1c (range: 4 to 10)
  const hba1cY = history.map(h => getScaleY(h.HbA1c, 4, 10));
  // 2. Creatinine (range: 0.4 to 1.8)
  const creatinineY = history.map(h => getScaleY(h.creatinine, 0.4, 1.8));
  // 3. Hemoglobin (range: 9 to 17)
  const hemoglobinY = history.map(h => getScaleY(h.hemoglobin, 9, 17));

  // Generate SVG Path line descriptors
  const getPathData = (yValues: number[]) => {
    if (yValues.length === 0) return '';
    if (yValues.length === 1) return `M ${xCoords[0]} ${yValues[0]} L ${xCoords[0]} ${yValues[0]}`;
    return yValues.reduce((acc, y, idx) => 
      idx === 0 ? `M ${xCoords[idx]} ${y}` : `${acc} L ${xCoords[idx]} ${y}`, 
    '');
  };

  // CDSS Warning Checks
  const latest = history[history.length - 1];
  const isCreatinineHigh = latest?.creatinine > 1.2;
  
  // Calculate creatinine percentage change if baseline exists
  let creatinineSpike = false;
  let creatinineSpikePercentage = 0;
  if (history.length > 1) {
    const baseVal = history[0].creatinine;
    const currentVal = latest.creatinine;
    if (baseVal > 0) {
      creatinineSpikePercentage = Math.round(((currentVal - baseVal) / baseVal) * 100);
      if (creatinineSpikePercentage >= 20) {
        creatinineSpike = true;
      }
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-slate-700/80">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Activity className="h-4.5 w-4.5 text-blue-400" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Longitudinal Biomarkers Trend</h4>
              <p className="text-[10px] text-slate-500 font-medium">6-Month historical laboratory result telemetry.</p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-3 text-[9px] font-mono font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20" /> HbA1c
            </span>
            <span className="flex items-center gap-1 text-teal-400">
              <span className="w-2 h-2 rounded-full bg-teal-500 shadow-sm shadow-teal-500/20" /> Creatinine
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/20" /> Hb
            </span>
          </div>
        </div>

        {/* SVG multiline line graph */}
        <div className="relative border border-slate-950/60 bg-slate-950/40 rounded-xl p-2 select-none overflow-visible">
          <svg className="w-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
            {/* Grid coordinates */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1e293b" strokeWidth="0.5" />

            {/* Left Y Axis label */}
            <text x={padding - 8} y={padding + 4} className="text-[7px] font-mono fill-slate-500 text-right" textAnchor="end">High</text>
            <text x={padding - 8} y={height / 2 + 3} className="text-[7px] font-mono fill-slate-500 text-right" textAnchor="end">Med</text>
            <text x={padding - 8} y={height - padding + 2} className="text-[7px] font-mono fill-slate-500 text-right" textAnchor="end">Normal</text>

            {/* Timestamps X Axis labels */}
            {history.map((h, idx) => (
              <text 
                key={h.date} 
                x={xCoords[idx]} 
                y={height - padding + 12} 
                className="text-[7px] font-mono font-bold fill-slate-500" 
                textAnchor="middle"
              >
                {h.date.split('-').slice(1).join('/')}
              </text>
            ))}

            {/* SVG Path lines */}
            <path d={getPathData(hba1cY)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" className="drop-shadow-[0_2px_8px_rgba(59,130,246,0.15)]" />
            <path d={getPathData(creatinineY)} fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" className="drop-shadow-[0_2px_8px_rgba(20,184,166,0.15)]" />
            <path d={getPathData(hemoglobinY)} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" className="drop-shadow-[0_2px_8px_rgba(245,158,11,0.15)]" />

            {/* Interactive Circles with Hover States */}
            {history.map((h, idx) => (
              <g key={idx} className="cursor-pointer">
                {/* HbA1c points */}
                <circle 
                  cx={xCoords[idx]} 
                  cy={hba1cY[idx]} 
                  r="4" 
                  fill="#1e293b" 
                  stroke="#3b82f6" 
                  strokeWidth="2" 
                  onMouseEnter={() => setHoveredPoint({
                    x: xCoords[idx],
                    y: hba1cY[idx],
                    val: h.HbA1c,
                    date: h.date,
                    label: 'HbA1c (Average Sugar)',
                    threshold: 'Diabetic: > 6.5% | Normal: < 5.7%'
                  })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                
                {/* Creatinine points */}
                <circle 
                  cx={xCoords[idx]} 
                  cy={creatinineY[idx]} 
                  r="4" 
                  fill="#1e293b" 
                  stroke="#14b8a6" 
                  strokeWidth="2" 
                  onMouseEnter={() => setHoveredPoint({
                    x: xCoords[idx],
                    y: creatinineY[idx],
                    val: h.creatinine,
                    date: h.date,
                    label: 'Serum Creatinine',
                    threshold: 'Kidney Hazard: > 1.2 mg/dL'
                  })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />

                {/* Hemoglobin points */}
                <circle 
                  cx={xCoords[idx]} 
                  cy={hemoglobinY[idx]} 
                  r="4" 
                  fill="#1e293b" 
                  stroke="#f59e0b" 
                  strokeWidth="2" 
                  onMouseEnter={() => setHoveredPoint({
                    x: xCoords[idx],
                    y: hemoglobinY[idx],
                    val: h.hemoglobin,
                    date: h.date,
                    label: 'Hemoglobin (Anemia check)',
                    threshold: 'Normal: 12.0 - 16.0 g/dL'
                  })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            ))}
          </svg>

          {/* Interactive Floating Tooltip */}
          {hoveredPoint && (
            <div 
              className="absolute z-20 rounded-lg border border-slate-800 bg-slate-950/95 p-2 font-mono text-[9px] text-slate-300 leading-snug shadow-xl backdrop-blur-md pointer-events-none select-none"
              style={{
                left: `${(hoveredPoint.x / width) * 100}%`,
                top: `${(hoveredPoint.y / height) * 100 - 45}%`,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="font-extrabold text-[10px] text-slate-200">{hoveredPoint.label}</div>
              <div className="mt-0.5 text-emerald-400 font-bold">Value: {hoveredPoint.val} | Date: {hoveredPoint.date}</div>
              <div className="text-[8px] text-slate-500 mt-0.5">{hoveredPoint.threshold}</div>
            </div>
          )}
        </div>

        {/* CDSS Safety Warning Alerts */}
        {(isCreatinineHigh || creatinineSpike) && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 flex gap-2.5 items-start animate-fade-in select-none">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
            <div className="text-xs">
              <h4 className="font-extrabold text-rose-300 uppercase tracking-tight flex items-center gap-1.5">
                CDSS Renal Safety Warning 
                <span className="flex items-center gap-1 rounded bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 text-[8px] font-bold text-rose-400 uppercase tracking-wider">
                  <Sparkles className="h-3 w-3 animate-pulse" /> Active Scribe Intercept
                </span>
              </h4>
              <p className="text-rose-400/80 mt-1 leading-relaxed">
                {creatinineSpike 
                  ? `Creatinine level has spiked by ${creatinineSpikePercentage}% (baseline ${history[0].creatinine} $\\rightarrow$ current ${latest.creatinine} mg/dL). ` 
                  : `Serum creatinine (${latest.creatinine} mg/dL) exceeds KDIGO thresholds. `}
                NSAIDs (Ibuprofen, Diclofenac) are strictly contraindicated due to high acute kidney injury risk.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
