import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { Patient, WhatsAppSession } from '../../types';
import { 
  UserPlus, 
  Smartphone, 
  Upload, 
  Send, 
  CheckCircle, 
  Search, 
  FileText, 
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

export const CompounderDashboard: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  
  // Registration state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<Patient['gender']>('Male');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [chronicInput, setChronicInput] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Prescription scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);

  // Selected patient to initiate loop
  const [activeSession, setActiveSession] = useState<WhatsAppSession | null>(null);

  useEffect(() => {
    setPatients(api.getPatients());
    setSessions(api.getWhatsAppSessions());
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !age) return;

    api.registerPatient({
      name,
      phone,
      age: Number(age),
      gender,
      allergies: allergiesInput.split(',').map(s => s.trim()).filter(Boolean),
      chronicConditions: chronicInput.split(',').map(s => s.trim()).filter(Boolean),
      abhaId: abhaId || undefined
    });

    setPatients(api.getPatients());
    
    // Reset Form
    setName('');
    setPhone('');
    setAge('');
    setGender('Male');
    setAllergiesInput('');
    setChronicInput('');
    setAbhaId('');
  };

  const handleInitiateLoop = (patient: Patient) => {
    const session = api.initiateWhatsAppSession(patient.phone);
    setSessions(api.getWhatsAppSessions());
    setActiveSession(session);
  };

  const simulatePatientConsent = (phone: string) => {
    // Simulate user tapping "Grant Access" inside WhatsApp
    api.updateWhatsAppState(phone, 'AWAITING_CONFIRMATION', {
      consentGranted: true,
      consentTime: new Date().toISOString()
    });
    setSessions(api.getWhatsAppSessions());
    const sess = api.getWhatsAppSessions().find(s => s.patientPhone === phone);
    if (sess) {
      setActiveSession(sess);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsScanning(true);
      setScanSuccess(false);
      
      // Simulate physical scanner reading text
      setTimeout(() => {
        setIsScanning(false);
        setScanSuccess(true);
      }, 2000);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.phone.includes(searchQuery) ||
    (p.abhaId && p.abhaId.includes(searchQuery))
  );

  const getSessionForPatient = (phone: string) => {
    return sessions.find(s => s.patientPhone === phone);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT COLUMN: Registration & Search */}
      <div className="lg:col-span-8 space-y-8">
        
        {/* Search registry */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Search className="h-5 w-5 text-accent-500" /> Patient Registry Lookup
          </h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Search patient by phone, name, or ABHA ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full input-field pl-12"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-clinical-500 h-5 w-5" />
          </div>

          {searchQuery && (
            <div className="mt-4 border border-clinical-800 rounded-xl overflow-hidden divide-y divide-clinical-800">
              {filteredPatients.length === 0 ? (
                <div className="p-4 text-clinical-400 text-sm">No matching patient found in ecosystem registry.</div>
              ) : (
                filteredPatients.map(p => {
                  const sess = getSessionForPatient(p.phone);
                  return (
                    <div key={p.id} className="p-4 flex items-center justify-between hover:bg-clinical-900/40 transition-colors">
                      <div>
                        <h4 className="font-bold text-white text-sm">{p.name} <span className="text-clinical-400 font-medium text-xs">({p.age}y, {p.gender})</span></h4>
                        <p className="text-xs text-clinical-400 mt-1 flex items-center gap-3">
                          <span>Phone: {p.phone}</span>
                          {p.abhaId && <span>ABHA: {p.abhaId}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sess ? (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                            sess.currentState === 'AWAITING_WELCOME' 
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' 
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                          }`}>
                            {sess.currentState}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInitiateLoop(p)}
                            className="bg-accent-600 hover:bg-accent-500 text-white font-medium text-xs px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                          >
                            Initiate Loop
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Demographic Registration */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-accent-500" /> New Patient Registration
          </h2>
          <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-clinical-400 mb-2 uppercase">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aarav Kumar"
                className="w-full input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinical-400 mb-2 uppercase">Phone Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full input-field"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-clinical-400 mb-2 uppercase">Age *</label>
                <input
                  type="number"
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value !== '' ? Number(e.target.value) : '')}
                  placeholder="35"
                  className="w-full input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-clinical-400 mb-2 uppercase">Gender *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Patient['gender'])}
                  className="w-full input-field bg-clinical-950"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinical-400 mb-2 uppercase">ABHA Card ID</label>
              <input
                type="text"
                value={abhaId}
                onChange={(e) => setAbhaId(e.target.value)}
                placeholder="12-3456-7890-1234"
                className="w-full input-field"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-clinical-400 mb-2 uppercase">Allergies (comma-separated)</label>
              <input
                type="text"
                value={allergiesInput}
                onChange={(e) => setAllergiesInput(e.target.value)}
                placeholder="Penicillin, Peanuts"
                className="w-full input-field"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-clinical-400 mb-2 uppercase">Chronic Conditions (comma-separated)</label>
              <input
                type="text"
                value={chronicInput}
                onChange={(e) => setChronicInput(e.target.value)}
                placeholder="Diabetes, Asthma, Thyroid"
                className="w-full input-field"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="btn-primary w-full md:w-auto px-8">
                Register & Initialize patient
              </button>
            </div>
          </form>
        </div>

        {/* Scan physical prescription */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent-500" /> Physical Prescription Scanning
          </h2>
          <p className="text-clinical-400 text-sm mb-6">
            Upload or snap a physical hand-written note to digitize and attach to the care queue.
          </p>
          <div className="border-2 border-dashed border-clinical-800 rounded-2xl p-8 text-center bg-clinical-950/20 hover:border-accent-500/50 hover:bg-clinical-950/40 transition-all duration-300 relative overflow-hidden group">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {isScanning ? (
              <div className="space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-accent-500/20"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-t-accent-500 border-r-accent-500 animate-spin"></div>
                </div>
                <h4 className="font-semibold text-white text-sm">Digitizing Handwriting & OCR Extraction...</h4>
                <p className="text-xs text-clinical-500">Mapping extraction values to patient record catalog.</p>
              </div>
            ) : scanSuccess ? (
              <div className="space-y-3">
                <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
                <h4 className="font-semibold text-white text-sm">Prescription Digitized Successfully!</h4>
                <p className="text-xs text-emerald-400">Scan matched: Aarav Sharma (p-1). Paracetamol hold mapped.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-clinical-900 rounded-2xl inline-block group-hover:-translate-y-1 transition-transform duration-300 border border-clinical-800">
                  <Upload className="h-6 w-6 text-accent-400 animate-pulse-subtle" />
                </div>
                <h4 className="font-bold text-white text-sm">Click to Scan or Upload Note</h4>
                <p className="text-xs text-clinical-500">Supports JPG, PNG, PDF formats from clinical devices</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: WhatsApp patient simulation panel */}
      <div className="lg:col-span-4 space-y-8">
        
        {/* Real-time WhatsApp Loop simulator */}
        <div className="glass-panel border-accent-500/20 shadow-md overflow-hidden flex flex-col h-[550px]">
          {/* WhatsApp Header */}
          <div className="bg-clinical-900 p-4 border-b border-clinical-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent-500/20 text-accent-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">WhatsApp Bot Simulator</h3>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-subtle"></span> Live Connection
                </p>
              </div>
            </div>
            <div className="text-[10px] bg-clinical-950 text-clinical-400 border border-clinical-800 px-2 py-0.5 rounded-full font-semibold">
              OTP Session
            </div>
          </div>

          {/* WhatsApp Screen Body */}
          <div className="flex-1 bg-clinical-950 p-4 overflow-y-auto space-y-4 font-sans text-xs">
            
            {activeSession ? (
              <>
                <div className="text-center">
                  <span className="bg-clinical-900 text-clinical-400 border border-clinical-800 px-3 py-1 rounded-md text-[10px] font-medium">
                    Today
                  </span>
                </div>

                {/* System Message */}
                <div className="bg-clinical-900/60 border border-clinical-800 p-3 rounded-xl flex gap-2">
                  <ShieldAlert className="h-4 w-4 text-accent-400 flex-shrink-0 mt-0.5" />
                  <p className="text-clinical-400 text-[10px] leading-relaxed">
                    Mediflow utilizes time-bound patient-controlled consent. Opt-in link sent to +91 {activeSession.patientPhone}.
                  </p>
                </div>

                {/* Bot Welcome message */}
                <div className="max-w-[85%] bg-clinical-900 p-3 rounded-2xl rounded-tl-none border border-clinical-800 space-y-2">
                  <p className="text-white leading-relaxed">
                    Hello! Welcome to <strong>Mediflow Healthcare</strong>. 🏥
                  </p>
                  <p className="text-clinical-300 leading-relaxed">
                    To securely synchronize your clinical e-prescriptions, lab report cards, and invoices, please grant permission.
                  </p>
                  <div className="mt-3 pt-3 border-t border-clinical-800 flex flex-col gap-2">
                    {activeSession.currentState === 'AWAITING_WELCOME' ? (
                      <button
                        onClick={() => simulatePatientConsent(activeSession.patientPhone)}
                        className="bg-accent-600 hover:bg-accent-500 text-white font-bold py-2 rounded-xl text-center shadow active:scale-95 transition-all"
                      >
                        Grant Access (Simulate Patient)
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-[10px] font-semibold">
                        <ShieldCheck className="h-4 w-4" /> Consent Saved & Registered
                      </div>
                    )}
                  </div>
                </div>

                {/* Awaiting Confirmation follow-up */}
                {activeSession.currentState !== 'AWAITING_WELCOME' && (
                  <div className="max-w-[85%] bg-clinical-900 p-3 rounded-2xl rounded-tl-none border border-clinical-800 space-y-1 animate-fade-in">
                    <p className="text-white leading-relaxed">
                      Thank you! Your patient consent is committed to the secure ledger. 
                    </p>
                    <p className="text-clinical-300 leading-relaxed font-semibold">
                      State: READY_FOR_ENCOUNTER
                    </p>
                    <p className="text-[10px] text-clinical-500 mt-2">
                      Timestamp: {new Date(activeSession.sessionData.consentTime).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <Smartphone className="h-12 w-12 text-clinical-600" />
                <div>
                  <h4 className="font-bold text-white text-sm">No Active WhatsApp Loop</h4>
                  <p className="text-clinical-500 text-xs mt-1">
                    Select a patient from the registry lookup or register a new one, then click "Initiate Loop".
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* WhatsApp Footer */}
          <div className="bg-clinical-900 p-3 border-t border-clinical-800 flex gap-2">
            <input
              type="text"
              disabled
              placeholder="Simulated WhatsApp Interface"
              className="flex-1 bg-clinical-950/80 border border-clinical-800 rounded-xl px-3 py-1.5 text-xs text-clinical-500 focus:outline-none"
            />
            <button disabled className="p-2 rounded-xl bg-clinical-800 text-clinical-500">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
