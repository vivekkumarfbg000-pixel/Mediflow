// =============================================================================
// VitalSync — Email Verification & Identity Ownership Enforcement Modal
// Enforces verified email ownership before activating clinical consoles or PHI access.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RotateCw, 
  LogOut, 
  ShieldCheck, 
  Clock 
} from 'lucide-react';
import { checkRateLimit, recordRateLimitAttempt } from '../../utils/rateLimiter';

interface EmailVerificationModalProps {
  isOpen: boolean;
  email: string;
  onVerified: () => void;
  onSignOut: () => void;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  email,
  onVerified,
  onSignOut
}) => {
  useBodyScrollLock(isOpen);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  if (!isOpen) return null;

  const handleResendEmail = async () => {
    if (cooldown > 0 || resending) return;

    // Rate limiting check
    const rateStatus = checkRateLimit('resend_verification', email);
    if (!rateStatus.allowed) {
      setMessage({
        text: rateStatus.message || 'Too many verification email requests. Please wait a few minutes.',
        type: 'error'
      });
      return;
    }

    setResending(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) throw error;

      recordRateLimitAttempt('resend_verification', email, true);
      setCooldown(60); // 60-second cooldown
      setMessage({
        text: 'A fresh verification link has been dispatched to your email address.',
        type: 'success'
      });
    } catch (_err: any) {
      recordRateLimitAttempt('resend_verification', email, false);
      // Uniform generic response to prevent enumeration
      setMessage({
        text: 'If your email requires verification, a link has been dispatched. Please check your spam folder.',
        type: 'info'
      });
      setCooldown(60);
    } finally {
      setResending(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;

      if (user?.email_confirmed_at || (user as any)?.confirmed_at) {
        setMessage({
          text: 'Email verified successfully! Loading your clinical workspace...',
          type: 'success'
        });
        setTimeout(() => {
          onVerified();
        }, 1000);
      } else {
        setMessage({
          text: 'Email not yet verified. Please click the confirmation link sent to your inbox.',
          type: 'info'
        });
      }
    } catch (err: any) {
      setMessage({
        text: err.message || 'Could not verify status. Please check your internet connection.',
        type: 'error'
      });
    } finally {
      setChecking(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 text-slate-800">
        
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 shadow-inner">
            <Mail className="h-8 w-8 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Verify Your Email Address
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Clinical safety policy requires verified email ownership before unlocking hospital operations and patient health records (EHR).
            </p>
          </div>
        </div>

        {/* Email Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Verification Sent To
          </span>
          <span className="text-sm sm:text-base font-bold text-slate-800 font-mono break-all">
            {email}
          </span>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
            message.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : message.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-cyan-50 border-cyan-200 text-cyan-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            ) : message.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-cyan-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-2 text-xs text-amber-900">
          <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wider text-amber-800">
            <Clock className="h-3.5 w-3.5 text-amber-600" /> Next Steps
          </div>
          <ol className="list-decimal list-inside space-y-1 text-amber-900/90 font-medium pl-1">
            <li>Open the confirmation email from <strong>VitalSync Health</strong>.</li>
            <li>Click <strong>Confirm My Account</strong> to activate your clinical credentials.</li>
            <li>Return here and click <strong>I have verified my email</strong> below.</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-550 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <>I have verified my email <CheckCircle2 className="h-4 w-4" /></>}
          </button>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={resending || cooldown > 0}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {resending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" />
              )}
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Email'}
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
