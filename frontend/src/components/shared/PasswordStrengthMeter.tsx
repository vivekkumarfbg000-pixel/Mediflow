import React from 'react';
import { CheckCircle2, Circle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { getPasswordRequirementItems, getPasswordStrengthScore, isStrongPassword } from '../../utils/passwordPolicy';

interface PasswordStrengthMeterProps {
  password?: string;
  className?: string;
  showAlways?: boolean;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password = '',
  className = '',
  showAlways = false,
}) => {
  // Only show once user starts typing, unless showAlways is true
  if (!password && !showAlways) {
    return null;
  }

  const items = getPasswordRequirementItems(password);
  const score = getPasswordStrengthScore(password);
  const isComplete = isStrongPassword(password);

  const getBarColor = () => {
    if (score <= 2) return 'bg-rose-500';
    if (score <= 4) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getStrengthLabel = () => {
    if (score === 0) return 'Enter a password';
    if (score <= 2) return 'Weak Password';
    if (score <= 4) return 'Moderate Strength';
    return 'Strong Password';
  };

  const getStrengthBadgeClass = () => {
    if (score <= 2) return 'text-rose-600 bg-rose-50 border-rose-200';
    if (score <= 4) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  return (
    <div className={`p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-2.5 transition-all duration-200 ${className}`}>
      {/* Header with Strength Label & Progress Bar */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 font-medium text-slate-700">
          {isComplete ? (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          )}
          <span>Password Requirements</span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStrengthBadgeClass()}`}>
          {getStrengthLabel()} ({score}/5)
        </span>
      </div>

      {/* Segmented Strength Bar */}
      <div className="grid grid-cols-5 gap-1.5 h-1.5">
        {[0, 1, 2, 3, 4].map((segIdx) => (
          <div
            key={`pwd-bar-seg-${segIdx}`}
            className={`h-full rounded-full transition-all duration-300 ${
              segIdx < score ? getBarColor() : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* 5 Elements Checklist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-1.5 text-[11px] transition-colors duration-200 ${
              item.met ? 'text-emerald-700 font-medium' : 'text-slate-500'
            }`}
          >
            {item.met ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            )}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
