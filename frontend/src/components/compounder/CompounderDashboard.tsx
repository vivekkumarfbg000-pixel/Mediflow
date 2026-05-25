import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import type { Patient, WhatsAppSession, ClinicStaff } from '../../types';
import { 
  Smartphone, 
  Upload, 
  Send, 
  CheckCircle, 
  Search, 
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
  const [scannedPatientInfo, setScannedPatientInfo] = useState<{ name: string; phone: string } | null>(null);

  // Selected patient to initiate loop
  const [activeSession, setActiveSession] = useState<WhatsAppSession | null>(null);

  // Chat simulator input & scroll states
  const [replyInput, setReplyInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Clinic Staff State
  const [staffList, setStaffList] = useState<ClinicStaff[]>([]);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'compounder' | 'receptionist' | 'admin'>('compounder');

  const handleRegisterStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    api.registerClinicStaff(newStaffName.trim(), newStaffRole);
    setNewStaffName('');
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Registered ${newStaffName} as ${newStaffRole} successfully.`,
        type: 'success',
        title: 'Clinic Staff Registered'
      }
    }));
  };

  const handleToggleStaffActive = (staffId: string, currentStatus: boolean) => {
    api.toggleStaffActive(staffId, !currentStatus);
  };

  const handleSelectActiveStaff = (staffId: string) => {
    api.setActiveStaffId(staffId);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Active Checked-In Staff updated.`,
        type: 'info',
        title: 'Checked-In Active Staff'
      }
    }));
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.sessionData?.chatHistory]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !activeSession) return;
    const text = replyInput.trim();
    setReplyInput('');

    // Trigger state machine router & bot dispatch
    await api.processIncomingWhatsAppMessage(activeSession.patientPhone, text);
  };

  useEffect(() => {
    const syncData = () => {
      const dbPatients = api.getPatients();
      const dbSessions = api.getWhatsAppSessions();
      const dbStaff = api.getClinicStaff();
      const activeId = api.getActiveStaffId();

      setPatients(dbPatients);
      setSessions(dbSessions);
      setStaffList(dbStaff);
      setActiveStaffId(activeId);
      
      setActiveSession(prev => {
        if (!prev) return null;
        const fresh = dbSessions.find(s => s.patientPhone === prev.patientPhone);
        return fresh || null;
      });
    };

    syncData();
    return api.subscribe(syncData);
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !age) return;

    const registered = api.registerPatient({
      name,
      phone,
      age: Number(age),
      gender,
      allergies: allergiesInput.split(',').map(s => s.trim()).filter(Boolean),
      chronicConditions: chronicInput.split(',').map(s => s.trim()).filter(Boolean),
      abhaId: abhaId || undefined
    });

    api.setActivePatient(registered);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Patient ${name} registered successfully. ABHA profile linked.`,
        type: 'success',
        title: 'Patient Registered'
      }
    }));

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
    api.setActivePatient(patient);
    const session = api.initiateWhatsAppSession(patient.phone);
    setActiveSession(session);
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `WhatsApp verification session initiated for ${patient.name}.`,
        type: 'info',
        title: 'WhatsApp Loop Started'
      }
    }));
  };

  const simulatePatientConsent = (phone: string) => {
    // Simulate user tapping "Grant Access" inside WhatsApp by routing message payload
    api.processIncomingWhatsAppMessage(phone, '1');
  };

  const [isCameraActive, setIsCameraActive] = useState(false);

  const handleOCRScan = async (sourceType: 'camera' | 'file', base64Data?: string) => {
    setIsScanning(true);
    setScanSuccess(false);
    setScannedPatientInfo(null);
    
    try {
      const parsedData = await api.parsePrescriptionOCR(base64Data || (sourceType === 'camera' ? 'camera_snapshot.png' : 'uploaded_file.png'));
      
      setIsScanning(false);
      setScanSuccess(true);
      setIsCameraActive(false);

      // Auto-populate manual entry states
      setName(parsedData.patientName);
      setAge(parsedData.patientAge);
      setGender(parsedData.patientGender);
      setPhone('9876543210'); // Default demo number matching simulator Aarav Sharma
      setAbhaId('12-3456-7890-1234');
      setAllergiesInput('Penicillin');
      setChronicInput('Type-2 Diabetes, Hypertension');

      // Directly register the patient in the database to trigger WhatsApp Sandbox!
      const registered = api.registerPatient({
        name: parsedData.patientName,
        phone: '9876543210',
        age: parsedData.patientAge,
        gender: parsedData.patientGender,
        allergies: ['Penicillin'],
        chronicConditions: ['Type-2 Diabetes', 'Hypertension'],
        abhaId: '12-3456-7890-1234'
      });

      api.setActivePatient(registered);

      // Instantly start WhatsApp opt-in welcome session
      const session = api.initiateWhatsAppSession('9876543210');
      setScannedPatientInfo({ name: registered.name, phone: registered.phone });
      setActiveSession(session);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Gemini OCR Extracted: Digitized patient Aarav Sharma (+91 9876543210). Auto-populated registration worksheets & fired Patient WhatsApp Sandbox!`,
          type: 'success',
          title: 'AI OCR Extraction Complete'
        }
      }));
    } catch (err) {
      setIsScanning(false);
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        handleOCRScan('file', base64Data);
      };
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        handleOCRScan('file');
      };
      reader.readAsDataURL(file);
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
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      {/* LEFT COLUMN: Registration & Search */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Search registry */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-primary opacity-50" />
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-xl">person_search</span>
            Patient Registry Lookup
          </h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Search patient by phone, name, or ABHA ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full input-field pl-12 focus:ring-1 focus:ring-secondary focus:border-secondary text-sm"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-clinical-400 h-5 w-5" />
          </div>

          {searchQuery && (
            <div className="mt-4 border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant bg-surface-container-lowest/50 glass-panel-inner animate-fade-in">
              {filteredPatients.length === 0 ? (
                <div className="p-4 text-clinical-400 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-400 text-base">warning</span>
                  No matching patient found in ecosystem registry.
                </div>
              ) : (
                filteredPatients.map(p => {
                  const sess = getSessionForPatient(p.phone);
                  return (
                    <div key={p.id} className="p-4 flex items-center justify-between hover:bg-surface-container/50 transition-colors">
                      <div>
                        <h4 className="font-bold text-white text-sm">
                          {p.name} <span className="text-clinical-400 font-medium text-xs">({p.age}y, {p.gender})</span>
                        </h4>
                        <p className="text-[11px] text-clinical-300 mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px] text-secondary">phone</span>
                            {p.phone}
                          </span>
                          {p.abhaId && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[10px] text-primary">badge</span>
                              ABHA: {p.abhaId}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sess ? (
                          <span className={`text-[10px] px-3 py-1 rounded-full font-bold tracking-wider font-mono border uppercase ${
                            sess.currentState === 'AWAITING_WELCOME' 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            {sess.currentState}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInitiateLoop(p)}
                            className="btn-primary py-1.5 px-4 text-xs hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-xs">sync</span>
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
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-50" />
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">person_add</span>
            New Patient Registration
          </h2>
          <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-clinical-300 mb-2 uppercase tracking-wide">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aarav Kumar"
                className="w-full input-field focus:ring-1 focus:ring-primary focus:border-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-clinical-300 mb-2 uppercase tracking-wide">Phone Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full input-field focus:ring-1 focus:ring-primary focus:border-primary text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-clinical-300 mb-2 uppercase tracking-wide">Age *</label>
                <input
                  type="number"
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value !== '' ? Number(e.target.value) : '')}
                  placeholder="35"
                  className="w-full input-field focus:ring-1 focus:ring-primary focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-clinical-300 mb-2 uppercase tracking-wide">Gender *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Patient['gender'])}
                  className="w-full input-field bg-clinical-950 text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-clinical-300 mb-2 uppercase tracking-wide">ABHA Card ID</label>
              <input
                type="text"
                value={abhaId}
                onChange={(e) => setAbhaId(e.target.value)}
                placeholder="12-3456-7890-1234"
                className="w-full input-field focus:ring-1 focus:ring-primary focus:border-primary text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-clinical-300 mb-2 uppercase tracking-wide">Allergies (comma-separated)</label>
              <input
                type="text"
                value={allergiesInput}
                onChange={(e) => setAllergiesInput(e.target.value)}
                placeholder="Penicillin, Peanuts"
                className="w-full input-field focus:ring-1 focus:ring-primary focus:border-primary text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-clinical-300 mb-2 uppercase tracking-wide">Chronic Conditions (comma-separated)</label>
              <input
                type="text"
                value={chronicInput}
                onChange={(e) => setChronicInput(e.target.value)}
                placeholder="Diabetes, Asthma, Thyroid"
                className="w-full input-field focus:ring-1 focus:ring-primary focus:border-primary text-sm"
              />
            </div>
            <div className="md:col-span-2 flex justify-end pt-3">
              <button type="submit" className="btn-primary w-full md:w-auto px-8 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
                Register & Initialize Patient
              </button>
            </div>
          </form>
        </div>

        {/* Scan physical prescription */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          {/* Custom style inject block to ensure smooth animation under pure HTML components */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes scannerSweep {
              0% { top: 0%; }
              50% { top: 100%; }
              100% { top: 0%; }
            }
            .animate-scanner-sweep {
              animation: scannerSweep 3s infinite linear;
            }
          `}} />
          
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-primary opacity-50" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-xl">scanner</span>
                Gemini Vision AI OCR Rx Scanner
              </h2>
              <p className="text-clinical-400 text-xs mt-1 leading-relaxed">
                Scan handwritten physical prescriptions using high-definition AI Vision model extraction layers.
              </p>
            </div>
            <button
              onClick={() => setIsCameraActive(!isCameraActive)}
              className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                isCameraActive
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-clinical-900 border-clinical-800 text-clinical-400 hover:text-clinical-200'
              }`}
            >
              {isCameraActive ? 'Cancel Camera' : 'Activate Camera'}
            </button>
          </div>
          
          {isScanning ? (
            <div className="border border-outline-variant rounded-xl p-8 text-center bg-surface-container-lowest/30 animate-pulse space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-secondary animate-spin">sync</span>
              </div>
              <h4 className="font-semibold text-white text-sm">Digitizing Handwriting & OCR Extraction...</h4>
              <div className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 py-1 px-3.5 border border-emerald-500/10 rounded max-w-xs mx-auto space-y-1">
                <p>⚡ running vision convolutional layers...</p>
                <p>⚡ generic drug mapping to FHIR...</p>
                <p>⚡ auto-populating demographic worksheets...</p>
              </div>
            </div>
          ) : scanSuccess ? (
            <div className="border border-emerald-500/20 rounded-xl p-6 text-center bg-emerald-500/5 animate-fade-in space-y-3.5">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Prescription Digitized Successfully!</h4>
                <p className="text-xs text-clinical-400 mt-1">Matched generics Metformin & Atorvastatin. Fired consent opt-in WhatsApp logs.</p>
              </div>
              <div className="text-xs text-emerald-400 bg-emerald-500/10 py-2 px-4 border border-emerald-500/20 rounded-xl max-w-sm mx-auto leading-relaxed font-semibold">
                Patient: <strong className="text-white font-bold">{scannedPatientInfo?.name}</strong> (+91 {scannedPatientInfo?.phone})
              </div>
              <button
                onClick={() => setScanSuccess(false)}
                className="text-[10px] text-clinical-400 hover:text-white uppercase tracking-wider font-bold underline"
              >
                Scan Another Prescription
              </button>
            </div>
          ) : isCameraActive ? (
            <div className="relative w-full h-64 bg-slate-950 border border-outline-variant rounded-xl overflow-hidden shadow-2xl flex flex-col items-center justify-between p-4 group">
              {/* Blur script handwritten rx note background */}
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-[0.5px] transition-all duration-500"
                style={{ backgroundImage: 'url("https://media.istockphoto.com/id/1149495759/vector/doctors-prescription-rx-handwritten-recipe.jpg?s=612x612&w=0&k=20&c=0sB7bKkR36K9e6i-M4w9U-qV6R38U-xS0e9600s_c=")' }} 
              />
              
              {/* Viewfinder Target Corner Brackets */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-400" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-400" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-400" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-400" />
              
              {/* Animating Green Laser Line sweep */}
              <div className="absolute left-0 w-full h-[2.5px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-scanner-sweep z-10" />

              {/* Monospace telemetry HUD overlay details */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700/50 px-3 py-1 rounded text-[8px] text-emerald-400 font-mono tracking-widest uppercase z-10 flex items-center gap-1.5 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Gemini Vision AI: READY
              </div>

              {/* Centered Reticle */}
              <div className="flex-1 flex items-center justify-center relative">
                <div className="w-14 h-14 border border-emerald-400/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                </div>
              </div>

              {/* Viewfinder bottom capture trigger button */}
              <button
                onClick={() => handleOCRScan('camera')}
                className="w-full max-w-xs btn-primary bg-emerald-600 hover:bg-emerald-500 border-emerald-500 py-2.5 text-xs font-bold rounded-xl transition-all shadow-xl hover:scale-102 flex justify-center items-center gap-1.5 text-white-force relative z-20"
              >
                <span className="material-symbols-outlined text-sm">photo_camera</span>
                Capture and Transcribe with Gemini
              </button>
            </div>
          ) : (
            <div className="scanner-container border-2 border-dashed border-outline-variant rounded-xl p-8 text-center bg-surface-container-lowest/30 hover:border-secondary/40 hover:bg-surface-container-lowest/50 transition-all duration-300 relative group cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer z-20"
              />
              <div className="space-y-4 py-3 flex flex-col items-center">
                <div className="p-3.5 bg-surface-container-lowest/80 rounded-full inline-flex group-hover:scale-105 group-hover:border-secondary transition-all duration-300 border border-outline-variant shadow-md">
                  <Upload className="h-6 w-6 text-secondary animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Click to Scan or Upload Note</h4>
                  <p className="text-xs text-clinical-400 mt-1">Supports JPG, PNG, PDF formats from clinical devices</p>
                </div>
                <div className="text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full uppercase tracking-wider font-semibold font-mono">
                  Or click "Activate Camera" above
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: WhatsApp patient simulation panel */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Clinic Staff Console */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 to-indigo-500 opacity-50" />
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-400 text-xl font-bold">badge</span>
            Clinic Staff Console
          </h2>
          
          {/* Active checked-in status */}
          <div className="mb-5 p-3.5 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-teal-400 uppercase tracking-widest font-bold">Current Shift Lead</span>
              <h4 className="font-bold text-white text-sm mt-0.5">
                {activeStaffId 
                  ? staffList.find(s => s.id === activeStaffId)?.staffName || 'System Compounder' 
                  : 'No Staff Checked-in'}
              </h4>
            </div>
            <span className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded uppercase ${
              activeStaffId ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {activeStaffId ? 'ACTIVE SHIFT' : 'SHIFT VACANT'}
            </span>
          </div>

          {/* Quick Staff Registration Form */}
          <form onSubmit={handleRegisterStaff} className="flex gap-3 mb-5">
            <input
              type="text"
              required
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              placeholder="Enter name..."
              className="flex-1 input-field text-xs py-2 focus:ring-1 focus:ring-teal-500 text-white"
            />
            <select
              value={newStaffRole}
              onChange={(e) => setNewStaffRole(e.target.value as any)}
              className="input-field bg-clinical-950 text-xs py-2 w-32 focus:ring-1 focus:ring-teal-500"
            >
              <option value="compounder">Compounder</option>
              <option value="receptionist">Receptionist</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="btn-primary px-4 py-2 text-xs bg-teal-600 hover:bg-teal-500 border-teal-500 text-white">
              Add
            </button>
          </form>

          {/* Staff List */}
          <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
            {staffList.length === 0 ? (
              <p className="text-clinical-500 text-xs text-center py-2">No staff registered. Add compounders above.</p>
            ) : (
              staffList.map(staff => (
                <div 
                  key={staff.id} 
                  className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    activeStaffId === staff.id 
                      ? 'bg-teal-500/5 border-teal-500/30' 
                      : 'bg-surface-container-lowest/30 border-outline-variant'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleSelectActiveStaff(staff.id)}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                        activeStaffId === staff.id 
                          ? 'border-teal-400 bg-teal-400/20' 
                          : 'border-clinical-600 hover:border-clinical-400'
                      }`}
                    >
                      {activeStaffId === staff.id && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                    </button>
                    <div>
                      <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                        {staff.staffName}
                        <span className="text-[10px] text-teal-400 font-mono capitalize">({staff.role})</span>
                      </h5>
                      <span className="text-[9px] text-clinical-500 font-mono">ID: {staff.id.substring(0, 8)}...</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleToggleStaffActive(staff.id, staff.isActive)}
                    className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded transition-all ${
                      staff.isActive 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' 
                        : 'bg-clinical-500/10 text-clinical-400 border border-clinical-500/20 hover:bg-clinical-500/20'
                    }`}
                  >
                    {staff.isActive ? 'IN SHIFT' : 'OFF SHIFT'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Real-time WhatsApp Loop simulator */}
        <div className="glass-panel border-white/10 shadow-xl overflow-hidden flex flex-col h-[600px] relative">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500 opacity-60" />
          
          {/* WhatsApp Header */}
          <div className="bg-surface-container p-4 border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">WhatsApp Bot Simulator</h3>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LIVE CONNECTION
                </p>
              </div>
            </div>
            <div className="text-[9px] bg-surface-container-highest text-clinical-300 border border-outline-variant px-2.5 py-1 rounded-full font-bold tracking-widest uppercase font-mono">
              OTP ACTIVE
            </div>
          </div>

          {/* WhatsApp Screen Body */}
          <div className="flex-1 bg-surface-container-lowest p-4 overflow-y-auto space-y-4 font-sans text-xs">
            
            {activeSession ? (
              <div className="space-y-4">
                <div className="text-center">
                  <span className="bg-surface-container text-clinical-300 border border-outline-variant px-3 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase font-mono">
                    TODAY
                  </span>
                </div>

                {/* System Message */}
                <div className="bg-surface-container/60 border border-outline-variant p-3.5 rounded-xl flex gap-3 leading-relaxed">
                  <ShieldAlert className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                  <p className="text-clinical-400 text-[10px] leading-relaxed">
                    Mediflow utilizes time-bound patient-controlled consent. Opt-in link sent to +91 {activeSession.patientPhone}. Current state: <span className="font-mono text-emerald-400 uppercase font-semibold">{activeSession.currentState}</span>
                  </p>
                </div>

                {/* Dynamic Messages */}
                {(activeSession.sessionData.chatHistory || []).map((msg, idx: number) => {
                  const isBot = msg.sender === 'bot';
                  return (
                    <div 
                      key={idx} 
                      className={`flex ${isBot ? 'justify-start' : 'justify-end'} animate-fade-in`}
                    >
                      <div 
                        className={`max-w-[85%] p-4 rounded-2xl border shadow-md relative ${
                          isBot 
                            ? 'bg-surface-container rounded-tl-none border-outline-variant text-white' 
                            : 'bg-emerald-600/90 rounded-tr-none border-emerald-500/30 text-white'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
                        
                        {/* If it's a welcome message from the bot and the state is still AWAITING_WELCOME, show the consent button */}
                        {isBot && msg.text.includes('Welcome to Mediflow') && activeSession.currentState === 'AWAITING_WELCOME' && (
                          <div className="mt-3 pt-3 border-t border-outline-variant/50 flex flex-col gap-2">
                            <button
                              onClick={() => simulatePatientConsent(activeSession.patientPhone)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-center shadow active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">lock_open</span>
                              Grant Access (Patient)
                            </button>
                          </div>
                        )}

                        {/* If it is an active consent registered state, show a clean indicator */}
                        {isBot && msg.text.includes('consent is committed') && activeSession.currentState !== 'AWAITING_WELCOME' && (
                          <div className="mt-2 flex items-center gap-1 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Consent Registered
                          </div>
                        )}

                        <span className="block text-[8px] text-clinical-500 text-right mt-1.5 font-mono">
                          {msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <span className="material-symbols-outlined text-6xl text-clinical-700 animate-pulse">forum</span>
                <div>
                  <h4 className="font-bold text-white text-sm">No Active WhatsApp Loop</h4>
                  <p className="text-clinical-400 text-xs mt-1 leading-relaxed">
                    Select a patient from the registry lookup or register a new one, then click "Initiate Loop" to begin.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* WhatsApp Footer */}
          <form onSubmit={handleSendReply} className="bg-surface-container p-3 border-t border-outline-variant flex gap-2">
            <input
              type="text"
              value={replyInput}
              onChange={(e) => setReplyInput(e.target.value)}
              disabled={!activeSession}
              placeholder={activeSession ? "Type a reply (e.g. '1', 'STOP CONSENT', 'REFILL')..." : "Simulated WhatsApp Interface"}
              className="flex-1 bg-surface-container-lowest/80 border border-outline-variant rounded-xl px-3 py-2 text-xs text-white placeholder-clinical-500 focus:outline-none focus:border-emerald-500/50"
            />
            <button 
              type="submit"
              disabled={!activeSession || !replyInput.trim()} 
              className={`p-2 rounded-xl transition-colors ${
                activeSession && replyInput.trim() 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer animate-pulse' 
                  : 'bg-surface-container-highest text-clinical-500'
              }`}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
