import React from 'react';
import type { BiometryData } from '../../types/ophthalmic';

interface BiometryWorksheetProps {
  value: BiometryData;
  onChange: (val: BiometryData) => void;
  readOnly?: boolean;
}

export const BiometryWorksheet: React.FC<BiometryWorksheetProps> = ({
  value,
  onChange,
  readOnly = false
}) => {
  const updateField = (field: keyof BiometryData, val: string) => {
    onChange({
      ...value,
      [field]: val
    });
  };

  return (
    <div className="glass-panel p-5 border-slate-200/80 shadow-sm bg-white space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500 text-lg">biotech</span>
          Cataract Pre-Op Biometry & IOL Planner
        </h3>
        <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
          Surgical Sheet
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Axial Length */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">Axial Length (mm)</label>
          {readOnly ? (
            <span className="text-xs font-bold text-slate-800 block py-1">{value.axialLength || '—'}</span>
          ) : (
            <input
              type="text"
              value={value.axialLength}
              onChange={(e) => updateField('axialLength', e.target.value)}
              placeholder="e.g. 23.45"
              className="w-full bg-white border border-slate-200 focus:border-indigo-450 rounded-lg py-1.5 px-2.5 text-xs text-slate-850 outline-none transition-all font-mono font-bold placeholder-slate-300"
            />
          )}
        </div>

        {/* K1 */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">K1 Flat (D)</label>
          {readOnly ? (
            <span className="text-xs font-bold text-slate-800 block py-1">{value.k1 || '—'}</span>
          ) : (
            <input
              type="text"
              value={value.k1}
              onChange={(e) => updateField('k1', e.target.value)}
              placeholder="e.g. 43.50"
              className="w-full bg-white border border-slate-200 focus:border-indigo-450 rounded-lg py-1.5 px-2.5 text-xs text-slate-850 outline-none transition-all font-mono font-bold placeholder-slate-300"
            />
          )}
        </div>

        {/* K2 */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">K2 Steep (D)</label>
          {readOnly ? (
            <span className="text-xs font-bold text-slate-800 block py-1">{value.k2 || '—'}</span>
          ) : (
            <input
              type="text"
              value={value.k2}
              onChange={(e) => updateField('k2', e.target.value)}
              placeholder="e.g. 44.25"
              className="w-full bg-white border border-slate-200 focus:border-indigo-450 rounded-lg py-1.5 px-2.5 text-xs text-slate-850 outline-none transition-all font-mono font-bold placeholder-slate-300"
            />
          )}
        </div>

        {/* Target Refraction */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">Target Rx (D)</label>
          {readOnly ? (
            <span className="text-xs font-bold text-slate-800 block py-1">{value.targetRefraction || '—'}</span>
          ) : (
            <input
              type="text"
              value={value.targetRefraction}
              onChange={(e) => updateField('targetRefraction', e.target.value)}
              placeholder="e.g. -0.50"
              className="w-full bg-white border border-slate-200 focus:border-indigo-450 rounded-lg py-1.5 px-2.5 text-xs text-slate-850 outline-none transition-all font-mono font-bold placeholder-slate-300"
            />
          )}
        </div>

        {/* IOL Model */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">Selected IOL Model</label>
          {readOnly ? (
            <span className="text-xs font-bold text-slate-800 block py-1">{value.iolModel || '—'}</span>
          ) : (
            <select
              value={value.iolModel}
              onChange={(e) => updateField('iolModel', e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-indigo-450 rounded-lg py-1.5 px-2 text-xs text-slate-850 outline-none transition-all font-medium"
            >
              <option value="">-- Select --</option>
              <option value="Alcon AcrySof Monofocal">Alcon AcrySof Monofocal</option>
              <option value="Johnson & Johnson Tecnis">Johnson & Johnson Tecnis</option>
              <option value="Zeiss AT LISA Trifocal">Zeiss AT LISA Trifocal</option>
              <option value="Bausch & Lomb enVista">Bausch & Lomb enVista</option>
            </select>
          )}
        </div>

        {/* Selected IOL Power */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">IOL Power Selected (D)</label>
          {readOnly ? (
            <span className="text-xs font-bold text-slate-800 block py-1">{value.iolPower || '—'}</span>
          ) : (
            <input
              type="text"
              value={value.iolPower}
              onChange={(e) => updateField('iolPower', e.target.value)}
              placeholder="e.g. +21.50"
              className="w-full bg-white border border-slate-200 focus:border-indigo-455 rounded-lg py-1.5 px-2.5 text-xs text-slate-850 outline-none transition-all font-mono font-bold placeholder-slate-300"
            />
          )}
        </div>
      </div>
    </div>
  );
};
