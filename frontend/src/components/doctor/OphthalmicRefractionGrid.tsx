import React from 'react';
import type { RefractionRx } from '../../types/ophthalmic';

interface OphthalmicRefractionGridProps {
  value: RefractionRx;
  onChange: (rx: RefractionRx) => void;
  readOnly?: boolean;
}

const SPH_OPTIONS: string[] = [];
for (let i = -20; i <= 20; i += 0.25) {
  SPH_OPTIONS.push(i > 0 ? `+${i.toFixed(2)}` : i.toFixed(2));
}

const CYL_OPTIONS: string[] = [];
for (let i = -10; i <= 0; i += 0.25) {
  CYL_OPTIONS.push(i.toFixed(2));
}

const AXIS_OPTIONS: string[] = [];
for (let i = 0; i <= 180; i += 5) {
  AXIS_OPTIONS.push(i.toString());
}

const ADD_OPTIONS: string[] = [''];
for (let i = 0.5; i <= 4; i += 0.25) {
  ADD_OPTIONS.push(`+${i.toFixed(2)}`);
}

export const OphthalmicRefractionGrid: React.FC<OphthalmicRefractionGridProps> = ({
  value,
  onChange,
  readOnly = false
}) => {

  const updateEye = (eye: 'od' | 'os', field: string, val: string) => {
    onChange({
      ...value,
      [eye]: { ...value[eye], [field]: val }
    });
  };

  const renderEyeRow = (eye: 'od' | 'os', label: string, emoji: string) => {
    const data = value[eye];
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{emoji}</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</span>
          <span className="text-[9px] text-slate-400 font-mono">({eye.toUpperCase()})</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {/* SPH */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">SPH</label>
            {readOnly ? (
              <span className="text-xs font-bold text-slate-800 block py-1">{data.sph || 'Plano'}</span>
            ) : (
              <select
                value={data.sph}
                onChange={(e) => updateEye(eye, 'sph', e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-800 outline-none transition-all font-mono font-bold"
              >
                <option value="">Plano</option>
                {SPH_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>

          {/* CYL */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">CYL</label>
            {readOnly ? (
              <span className="text-xs font-bold text-slate-800 block py-1">{data.cyl || '—'}</span>
            ) : (
              <select
                value={data.cyl}
                onChange={(e) => updateEye(eye, 'cyl', e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-800 outline-none transition-all font-mono font-bold"
              >
                <option value="">—</option>
                {CYL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>

          {/* AXIS */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">AXIS°</label>
            {readOnly ? (
              <span className="text-xs font-bold text-slate-800 block py-1">{data.axis ? `${data.axis}°` : '—'}</span>
            ) : (
              <select
                value={data.axis}
                onChange={(e) => updateEye(eye, 'axis', e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-800 outline-none transition-all font-mono font-bold"
              >
                <option value="">—</option>
                {AXIS_OPTIONS.map(o => <option key={o} value={o}>{o}°</option>)}
              </select>
            )}
          </div>

          {/* ADD */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">ADD</label>
            {readOnly ? (
              <span className="text-xs font-bold text-slate-800 block py-1">{data.add || '—'}</span>
            ) : (
              <select
                value={data.add}
                onChange={(e) => updateEye(eye, 'add', e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-800 outline-none transition-all font-mono font-bold"
              >
                <option value="">—</option>
                {ADD_OPTIONS.filter(o => o).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel p-5 border-slate-200/80 shadow-sm bg-white space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500 text-lg">visibility</span>
          Spectacle / Lens Refraction Rx
        </h3>
        <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
          Ophthalmology
        </span>
      </div>

      {/* OD — Right Eye */}
      {renderEyeRow('od', 'Right Eye', '👁️')}

      <div className="border-t border-slate-100" />

      {/* OS — Left Eye */}
      {renderEyeRow('os', 'Left Eye', '👁️')}

      <div className="border-t border-slate-100" />

      {/* PD, Lens Type, Notes */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">PD (mm)</label>
          {readOnly ? (
            <span className="text-xs font-bold text-slate-800 block py-1">{value.pd || '—'}</span>
          ) : (
            <input
              type="text"
              value={value.pd}
              onChange={(e) => onChange({ ...value, pd: e.target.value })}
              placeholder="62"
              className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg py-1.5 px-2.5 text-xs text-slate-800 outline-none transition-all font-mono font-bold placeholder-slate-300"
            />
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lens Type</label>
          {readOnly ? (
            <span className="text-xs font-bold text-slate-800 block py-1">{value.lensType}</span>
          ) : (
            <select
              value={value.lensType}
              onChange={(e) => onChange({ ...value, lensType: e.target.value as RefractionRx['lensType'] })}
              className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-800 outline-none transition-all font-medium"
            >
              <option value="Single Vision">Single Vision</option>
              <option value="Bifocal">Bifocal</option>
              <option value="Progressive">Progressive</option>
              <option value="Contact Lens">Contact Lens</option>
            </select>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Notes</label>
          {readOnly ? (
            <span className="text-xs font-bold text-slate-800 block py-1">{value.notes || '—'}</span>
          ) : (
            <input
              type="text"
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
              placeholder="Anti-glare coating"
              className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-lg py-1.5 px-2.5 text-xs text-slate-800 outline-none transition-all font-medium placeholder-slate-300"
            />
          )}
        </div>
      </div>
    </div>
  );
};
