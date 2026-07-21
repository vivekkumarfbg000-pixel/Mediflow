import React, { useState } from 'react';
import { Smartphone, Send, CheckCircle2, Sparkles, X, FileText } from 'lucide-react';
import { api } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clinicName?: string;
  doctorName?: string;
}

export const WhatsAppTestDispatcherModal: React.FC<Props> = ({
  isOpen,
  onClose,
  clinicName = 'Apex Medical Center',
  doctorName = 'Dr. Rajesh Verma'
}) => {
  const [phone, setPhone] = useState('');
  const [testType, setTestType] = useState<'rx_pdf' | 'token' | 'care_loop'>('rx_pdf');
  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || isSending) return;

    setIsSending(true);
    setSuccessMsg(null);

    try {
      let bodyText = '';
      if (testType === 'rx_pdf') {
        bodyText = `📄 *LIVE TEST PRESCRIPTION DISPATCH*\n\nClinic: ${clinicName}\nDoctor: ${doctorName}\nPatient: Test Patient\n\nPrescribed: Tab Paracetamol 500mg (1-0-1), Tab Amoxicillin 500mg (1-0-1)\n\n🔗 *Download PDF Prescription*: https://mediflow.in/rx/test-pdf-101`;
      } else if (testType === 'token') {
        bodyText = `🎫 *LIVE TEST TOKEN QUEUE CONFIRMATION*\n\nClinic: ${clinicName}\nToken Number: *MF-1088*\nQueue Position: #2 (Est. Wait: 10 mins)\n\nStatus: Verified`;
      } else {
        bodyText = `🔄 *LIVE TEST 2-TOUCHPOINT CARE LOOP*\n\nNamaste! Your lab reports for ${clinicName} are ready.\n\nPlease select your Evening Review Option:\n1. 🏥 *Physical Review at Clinic*\n2. 💻 *Virtual Video Review*`;
      }

      await api.pushWhatsAppMessageFromBot(phone, bodyText);
      await new Promise(r => setTimeout(r, 400));

      setSuccessMsg(`✅ Test WhatsApp message dispatched to ${phone}! Check your phone.`);
    } catch (_e) {
      setSuccessMsg('⚠️ Failed to dispatch test WhatsApp message.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-slate-800">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-extrabold">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                Live WhatsApp Demo Tester
                <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Send Live Prescription PDF to Doctor's Phone</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSendTest} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select Demo Dispatch Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'rx_pdf', label: '📋 Rx PDF', icon: FileText },
                { id: 'token', label: '🎫 Queue Token', icon: Smartphone },
                { id: 'care_loop', label: '🔄 Care Loop', icon: Sparkles },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTestType(item.id as any)}
                  className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    testType === item.id
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Enter Your WhatsApp Mobile Number
            </label>
            <input
              type="tel"
              required
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-xs font-semibold bg-slate-50/50"
            />
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!phone.trim() || isSending}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-extrabold text-xs cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
          >
            <Send className="h-4 w-4" />
            {isSending ? 'Dispatching Test Message...' : 'Send Test WhatsApp Message Now'}
          </button>
        </form>

      </div>
    </div>
  );
};
