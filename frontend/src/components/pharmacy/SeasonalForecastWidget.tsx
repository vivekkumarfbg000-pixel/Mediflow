import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { SeasonalForecast } from '../../types';
import { 
  TrendingUp, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight
} from 'lucide-react';

export const SeasonalForecastWidget: React.FC = () => {
  const [forecasts, setForecasts] = useState<SeasonalForecast[]>([]);

  const loadForecasts = () => {
    let data = api.getSeasonalForecasts() || [];
    
    // Seed realistic premium forecast items if empty
    if (data.length === 0) {
      const seeded: SeasonalForecast[] = [
        {
          id: 'fc-101',
          pharmacyId: 'pharmacy-partner-entity',
          medicineName: 'Paracetamol 650mg',
          suggestedIncreasePercentage: 85,
          reason: 'Pre-monsoon humidity & pathogen surge (Dengue/Chikungunya outbreak telemetry)',
          forecastConfidence: 94,
          isActedUpon: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'fc-102',
          pharmacyId: 'pharmacy-partner-entity',
          medicineName: 'Amoxicillin 250mg',
          suggestedIncreasePercentage: 45,
          reason: 'Seasonal temperature fluctuations leading to secondary bacterial throat infections',
          forecastConfidence: 87,
          isActedUpon: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'fc-103',
          pharmacyId: 'pharmacy-partner-entity',
          medicineName: 'Azithromycin 500mg',
          suggestedIncreasePercentage: 60,
          reason: 'Waterborne typhoid spikes correlated with Patna drainage pathogen surveillance',
          forecastConfidence: 81,
          isActedUpon: false,
          createdAt: new Date().toISOString()
        }
      ];
      data = seeded;
    }
    setForecasts(data);
  };

  useEffect(() => {
    loadForecasts();
    return api.subscribe(loadForecasts);
  }, []);

  const handleActionPO = (forecastId: string, medicineName: string) => {
    try {
      api.actOnSeasonalForecast(forecastId);
      
      // Dispatch standard success toast
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'PO Draft Dispatched! 📦',
          message: `Actioned restock PO for ${medicineName}. Added +100 units to active pharmacy inventory.`,
          type: 'success'
        }
      }));
    } catch (err) {
      console.error('[Forecast Widget] Error actioning PO:', err);
    }
  };

  return (
    <div className="glass-panel p-6 bg-white border-slate-200/60 shadow-sm rounded-3xl relative overflow-hidden space-y-5">
      <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-blue-500 to-indigo-600 opacity-60" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="h-5 w-5 text-indigo-500" />
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              Predictive Seasonal Demand restock
              <span className="flex items-center gap-1 rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[8px] font-bold text-indigo-600 uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5 animate-pulse" /> AI CDSS Forecast
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium font-sans">
              Clinical demand forecasting based on epidemiology & sewage pathogen density surveillance models.
            </p>
          </div>
        </div>
      </div>

      {/* Forecast list grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
        {forecasts.map((fc) => {
          const isActed = fc.isActedUpon;
          return (
            <div 
              key={fc.id} 
              className={`p-4.5 rounded-2xl border transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${
                isActed 
                  ? 'bg-slate-50/50 border-slate-200/60 opacity-80' 
                  : 'bg-gradient-to-br from-white to-slate-50/20 border-slate-200/80 hover:border-indigo-300 hover:shadow-md'
              }`}
            >
              <div className="space-y-3">
                {/* Medicine & Increase Badge */}
                <div className="flex justify-between items-start gap-2">
                  <span className="font-extrabold text-xs text-slate-700 tracking-tight block truncate">
                    {fc.medicineName}
                  </span>
                  <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                    isActed 
                      ? 'bg-slate-200 text-slate-500' 
                      : 'bg-rose-50 border border-rose-100 text-rose-600'
                  }`}>
                    +{fc.suggestedIncreasePercentage}% Demand
                  </span>
                </div>

                {/* Epidemiological Reason */}
                <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                  {fc.reason}
                </p>

                {/* Confidence Meter */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <span>Forecast Confidence</span>
                    <span className={isActed ? 'text-slate-500' : 'text-indigo-600'}>
                      {fc.forecastConfidence}% Accurate
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isActed ? 'bg-slate-300' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${fc.forecastConfidence}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-3 border-t border-slate-100/50 flex justify-between items-center gap-2">
                <span className="text-[8px] font-mono font-bold text-slate-400">
                  Target: {fc.pharmacyId.split('-')[0].toUpperCase()}
                </span>
                
                {isActed ? (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                    <CheckCircle2 className="h-3 w-3" />
                    PO Actioned
                  </span>
                ) : (
                  <button
                    onClick={() => handleActionPO(fc.id, fc.medicineName)}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 shadow-2xs hover:scale-102 cursor-pointer text-white-force bg-indigo-600-force"
                  >
                    Action PO Draft
                    <ArrowRight className="h-3 w-3 text-white-force" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
