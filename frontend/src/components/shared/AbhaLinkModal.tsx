import React, { useState } from 'react';
import { X, ShieldCheck, Fingerprint, Smartphone, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Patient } from '../../types';
import { AbhaService } from '../../services/abhaService';
import { PatientService } from '../../services/patientService';

interface AbhaLinkModalProps {
  isOpen: boolean;
  patient: Patient | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const AbhaLinkModal: React.FC<AbhaLinkModalProps> = ({ isOpen, patient, onClose, onSuccess }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Aadhaar, 2: OTP, 3: Success
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');
  const [txnId, setTxnId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [abhaId, setAbhaId] = useState('');

  if (!isOpen || !patient) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanAadhaar = aadhaar.replace(/\D/g, '');
    if (cleanAadhaar.length !== 12) {
      setError('Aadhaar must be exactly 12 digits.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await AbhaService.requestAadhaarOtp(cleanAadhaar);
      if (res.success && res.txnId) {
        setTxnId(res.txnId);
        setStep(2);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError('Network error connecting to ABDM Sandbox.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) {
      setError('OTP must be 6 digits.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await AbhaService.verifyOtpAndLink(txnId, otp, patient.name);
      if (res.success && res.abhaId) {
        setAbhaId(res.abhaId);
        // Update local patient record
        const updatedPatient = { ...patient, abhaId: res.abhaId, abhaAddress: res.abhaAddress };
        PatientService.savePatient(updatedPatient);
        setStep(3);
        setTimeout(() => {
          onSuccess();
        }, 2500);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError('Error verifying OTP with ABDM Sandbox.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck className="w-5 h-5 text-indigo-200" />
            <h2 className="font-bold text-lg">Create ABHA ID</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
              {step === 1 && <Fingerprint className="w-8 h-8 text-indigo-600" />}
              {step === 2 && <Smartphone className="w-8 h-8 text-indigo-600" />}
              {step === 3 && <CheckCircle2 className="w-8 h-8 text-emerald-500" />}
            </div>
            <h3 className="text-lg font-bold text-slate-800 text-center">
              {step === 1 && 'Aadhaar Verification'}
              {step === 2 && 'Enter OTP'}
              {step === 3 && 'ABHA ID Linked Successfully!'}
            </h3>
            <p className="text-sm text-slate-500 text-center mt-1">
              {step === 1 && `Link ABHA ID for ${patient.name}`}
              {step === 2 && 'OTP sent to Aadhaar-linked mobile number'}
              {step === 3 && 'The patient records are now ABDM compliant.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Aadhaar Number</label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="xxxx xxxx xxxx"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-mono tracking-widest text-lg text-center"
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || aadhaar.length !== 12}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Get OTP'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">6-Digit OTP</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="------"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-mono tracking-[0.5em] text-2xl text-center"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                />
                <p className="text-xs text-center text-slate-500 mt-2">Mock OTP: 123456</p>
              </div>
              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Link'}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 text-center">
              <span className="block text-xs font-bold text-indigo-500 mb-1 uppercase tracking-wider">Generated ABHA ID</span>
              <span className="block text-xl font-mono font-bold text-indigo-700">{abhaId}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
