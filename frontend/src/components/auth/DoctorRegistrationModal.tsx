import React, { useState } from 'react';
import { Building, User, Phone, Stethoscope, ArrowRight, Sparkles, CheckCircle2, X } from 'lucide-react';
import { api } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (clinicData: { name: string; doctorName: string; clinicCode: string }) => void;
}

export const DoctorRegistrationModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    clinicName: '',
    doctorName: '',
    phone: '',
    specialization: 'General Medicine'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clinicName || !formData.doctorName || !formData.phone) return;

    setIsSubmitting(true);

    try {
      const clinicCode = formData.clinicName.substring(0, 4).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
      
      // Seed workspace pod data
      const newPod = {
        id: crypto.randomUUID(),
        clinic_code: clinicCode,
        name: formData.clinicName,
        location: 'Patna, Bihar',
        health_score: 100,
        is_verified_for_billing: true,
        lifetime_platform_revenue: 0,
        pending_cash_balance: 0,
        platform_fee_percent: 2.5
      };

      // Save pod info & active WABA connection locally
      localStorage.setItem('vitalsync_active_pod', JSON.stringify(newPod));
      localStorage.setItem('vitalsync_doctor_profile', JSON.stringify({
        name: formData.doctorName,
        phone: formData.phone,
        specialization: formData.specialization
      }));

      localStorage.setItem('vitalsync_waba_connection', JSON.stringify({
        id: `waba-${clinicCode}`,
        phone_number: formData.phone,
        phone_number_id: `10${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        waba_id: `waba-act-${Math.floor(100000000 + Math.random() * 900000000)}`,
        is_active: true,
        created_at: new Date().toISOString()
      }));

      // Trigger workspace update
      window.dispatchEvent(new CustomEvent('mediflow-profile-updated'));

      await new Promise(r => setTimeout(r, 600));

      onSuccess({
        name: formData.clinicName,
        doctorName: formData.doctorName,
        clinicCode: clinicCode
      });
      onClose();
    } catch (_e) {
      console.error('[Doctor Registration] Failed creating workspace:', _e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-slate-800">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-6 relative overflow-hidden">
        
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 h-32 w-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold shadow-sm">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                Register New Clinic
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Provision 24/7 VitalSync Pod in 30 Seconds</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Clinic / Hospital Name
            </label>
            <div className="relative">
              <Building className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="e.g. Apex Heart Care & Multi Specialty"
                value={formData.clinicName}
                onChange={(e) => setFormData(f => ({ ...f, clinicName: e.target.value }))}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-xs font-semibold bg-slate-50/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Doctor Full Name
            </label>
            <div className="relative">
              <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="e.g. Dr. Rajesh Verma (MD)"
                value={formData.doctorName}
                onChange={(e) => setFormData(f => ({ ...f, doctorName: e.target.value }))}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-xs font-semibold bg-slate-50/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Doctor Specialization
            </label>
            <select
              value={formData.specialization}
              onChange={(e) => setFormData(f => ({ ...f, specialization: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-xs font-semibold bg-slate-50/50"
            >
              <option value="General Medicine">General Medicine / Physician</option>
              <option value="Ophthalmology">Ophthalmology (Eye Care)</option>
              <option value="Pediatrics">Pediatrics (Child Care)</option>
              <option value="Cardiology">Cardiology (Heart Care)</option>
              <option value="Orthopedics">Orthopedics (Bone Care)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              WhatsApp Support Mobile Number
            </label>
            <div className="relative">
              <Phone className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-xs font-semibold bg-slate-50/50"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Includes 100% free sandbox workspace with Cashfree Payments & WhatsApp Bot active!</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs cursor-pointer shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
          >
            {isSubmitting ? 'Provisioning Clinic Pod...' : 'Launch Clinic Workspace Now'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
