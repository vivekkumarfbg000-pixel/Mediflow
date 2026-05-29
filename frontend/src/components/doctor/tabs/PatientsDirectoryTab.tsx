import React from 'react';
import { api } from '../../../services/api';
import type { Patient } from '../../../types';

interface PatientsDirectoryTabProps {
  patients: Patient[];
  patientSearchQuery: string;
  setPatientSearchQuery: (s: string) => void;
  selectedDirectoryPatient: Patient | null;
  setSelectedDirectoryPatient: (p: Patient | null) => void;
  newPatientName: string;
  setNewPatientName: (s: string) => void;
  newPatientPhone: string;
  setNewPatientPhone: (s: string) => void;
  newPatientAge: string;
  setNewPatientAge: (s: string) => void;
  newPatientGender: 'Male' | 'Female' | 'Other';
  setNewPatientGender: (g: 'Male' | 'Female' | 'Other') => void;
  patientRAGSummary: string;
  setPatientRAGSummary: (s: string) => void;
}

export const PatientsDirectoryTab: React.FC<PatientsDirectoryTabProps> = React.memo(({
  patients,
  patientSearchQuery,
  setPatientSearchQuery,
  selectedDirectoryPatient,
  setSelectedDirectoryPatient,
  newPatientName,
  setNewPatientName,
  newPatientPhone,
  setNewPatientPhone,
  newPatientAge,
  setNewPatientAge,
  newPatientGender,
  setNewPatientGender,
  patientRAGSummary,
  setPatientRAGSummary
}) => {
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(patientSearchQuery.toLowerCase()) ||
    p.phone.includes(patientSearchQuery)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-800 animate-fade-in text-left">
      {/* Left Column: Search & Registry Directory */}
      <div className="space-y-6">
        <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl h-full flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">group</span>
              <h2 className="text-base font-bold text-slate-800">Patient Directory</h2>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={patientSearchQuery}
                onChange={e => setPatientSearchQuery(e.target.value)}
                className="w-full input-field py-2 pl-9 text-xs"
              />
              <span className="material-symbols-outlined text-slate-400 absolute left-3 top-2.5 text-sm">search</span>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {filteredPatients.map(p => {
                const isSelected = selectedDirectoryPatient?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedDirectoryPatient(p);
                      setPatientRAGSummary('');
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-primary-container/20 border-primary text-slate-800'
                        : 'bg-slate-50 border-slate-200/50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-xs">{p.name}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{p.gender}, {p.age} years • {p.phone}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* New Patient Drawer */}
          <div className="pt-4 border-t border-slate-100 mt-4">
            <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1 font-sans">
              <span className="material-symbols-outlined text-sm text-primary">person_add</span>
              Add New Patient Registry
            </h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Patient Full Name"
                value={newPatientName}
                onChange={e => setNewPatientName(e.target.value)}
                className="w-full input-field py-1.5 text-xs bg-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Phone"
                  value={newPatientPhone}
                  onChange={e => setNewPatientPhone(e.target.value)}
                  className="w-full input-field py-1.5 text-xs bg-white"
                />
                <input
                  type="number"
                  placeholder="Age"
                  value={newPatientAge}
                  onChange={e => setNewPatientAge(e.target.value)}
                  className="w-full input-field py-1.5 text-xs bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newPatientGender}
                  onChange={e => setNewPatientGender(e.target.value as any)}
                  className="w-full input-field py-1.5 text-xs bg-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <button
                  onClick={() => {
                    if (!newPatientName || !newPatientPhone || !newPatientAge) return;
                    const added = api.registerPatient({
                      name: newPatientName,
                      phone: newPatientPhone,
                      age: parseInt(newPatientAge),
                      gender: newPatientGender,
                      allergies: [],
                      chronicConditions: []
                    });
                    setSelectedDirectoryPatient(added);
                    setNewPatientName('');
                    setNewPatientPhone('');
                    setNewPatientAge('');
                  }}
                  className="w-full btn-primary py-1.5 text-center text-xs font-semibold rounded-lg text-white-force"
                >
                  Register Patient
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Columns: Patient profile, loyalty coupons, AI RAG */}
      <div className="lg:col-span-2 space-y-6">
        {selectedDirectoryPatient ? (
          <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl space-y-6">
            <div className="border-b border-slate-100 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-base font-bold text-slate-800">{selectedDirectoryPatient.name}</h2>
                <p className="text-xs text-slate-400 mt-1">{selectedDirectoryPatient.gender}, {selectedDirectoryPatient.age} years • phone: {selectedDirectoryPatient.phone}</p>
              </div>
              {selectedDirectoryPatient.abhaId && (
                <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-205 px-2 py-0.5 rounded-full font-bold uppercase font-mono">
                  ABHA Verified
                </span>
              )}
            </div>

            {/* loyalty discounts dispatcher */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-amber-500">reward</span>
                WhatsApp Loyalty Offers Console
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'discount_30')}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer border-slate-200"
                >
                  <span className="material-symbols-outlined text-teal-600 text-lg">local_pharmacy</span>
                  <strong className="block text-[11px] text-slate-700 font-semibold">30% Off Medicine Coupon</strong>
                  <p className="text-[9px] text-slate-404 leading-normal">For repeat glycemic drugs refill orders.</p>
                </button>
                <button
                  onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'virtual_appointment')}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer border-slate-200"
                >
                  <span className="material-symbols-outlined text-blue-600 text-lg">video_call</span>
                  <strong className="block text-[11px] text-slate-700 font-semibold">10-Day Virtual Invite</strong>
                  <p className="text-[9px] text-slate-404 leading-normal">Invite to virtual telemedicine follow-up.</p>
                </button>
                <button
                  onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'quick_booking')}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer border-slate-200"
                >
                  <span className="material-symbols-outlined text-amber-600 text-lg">event_available</span>
                  <strong className="block text-[11px] text-slate-700 font-semibold">Portal Invite Link</strong>
                  <p className="text-[9px] text-slate-404 leading-normal">Invoice and home lab sample booking portal.</p>
                </button>
              </div>
            </div>

            {/* AI chronic health summary */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-705 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-secondary">psychology</span>
                  AI Chronic Longitudinal Health Summary
                </h3>
                <button
                  onClick={() => {
                    const sum = api.generateAIPatientSummary(selectedDirectoryPatient.id);
                    setPatientRAGSummary(sum);
                  }}
                  className="text-primary hover:text-primary-700 text-xs font-bold flex items-center gap-0.5 cursor-pointer border-0 bg-transparent"
                >
                  <span className="material-symbols-outlined text-sm">sync</span> Generate Summary
                </button>
              </div>

              {patientRAGSummary ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-slate-700 leading-relaxed font-sans animate-fade-in font-medium italic">
                  {patientRAGSummary}
                </div>
              ) : (
                <p className="text-xs text-slate-404 italic">Click Generate Summary to run the RAG diagnostic prompt analyzing the patient chronic history.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-panel p-12 bg-white border-slate-200/80 shadow-sm rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
            <span className="material-symbols-outlined text-slate-300 text-5xl">group</span>
            <div>
              <h3 className="text-slate-700 font-bold">No Patient Profile Selected</h3>
              <p className="text-xs text-slate-404 mt-1 max-w-sm">Select an active patient registry profile from the directory on the left to dispatch loyalty rewards or generate chronic summaries.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
