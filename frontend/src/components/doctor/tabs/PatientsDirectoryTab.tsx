import React from 'react';
import { api } from '../../../services/api';
import { BillingService } from '../../../services/billingService';
import { getIstDateString } from '../../../utils/dateUtils';
import type { Patient } from '../../../types';
import { 
  Users, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  Video, 
  Brain, 
  UploadCloud, 
  CheckCircle2,
  CalendarCheck,
  Info,
  Gift,
  Pill
} from 'lucide-react';

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
  const [refreshKey, setRefreshKey] = React.useState(0);
  const filteredPatients = React.useMemo(() => {
    const query = patientSearchQuery.trim().toLowerCase();
    let list = patients;
    
    if (query) {
      const cleanDigitsQuery = query.replace(/\D/g, '');
      list = (patients || []).filter(p => 
        (p?.name || '').toLowerCase().includes(query) ||
        (p?.phone || '').includes(query) ||
        (cleanDigitsQuery.length >= 3 && (p?.phone || '').replace(/\D/g, '').includes(cleanDigitsQuery)) ||
        (p?.patientCode || '').toLowerCase().includes(query) ||
        (p?.tokenNumber != null ? String(p.tokenNumber) : '').toLowerCase().includes(query) ||
        (p?.id || '').toLowerCase().includes(query) ||
        ((p?.abhaId || '').toLowerCase().includes(query))
      );
    }

    // Sort virtual appointments to the top chronologically
    const appts = api.getAppointments();
    
    const getVirtualApptInfo = (patientId: string) => {
      const activeVirtual = appts.find(a => 
        a.patientId === patientId && 
        a.isVirtual && 
        a.status !== 'completed' && 
        a.status !== 'cancelled'
      );
      if (!activeVirtual) return null;
      
      const date = activeVirtual.virtualDate || '9999-12-31';
      const time = activeVirtual.virtualTime || '11:59 PM';
      return { date, time };
    };

    return [...list].sort((a, b) => {
      const infoA = getVirtualApptInfo(a.id);
      const infoB = getVirtualApptInfo(b.id);

      if (infoA && !infoB) return -1;
      if (!infoA && infoB) return 1;
      
      if (infoA && infoB) {
        if (infoA.date !== infoB.date) {
          return String(infoA.date || '').localeCompare(String(infoB.date || ''));
        }
        const parseTime = (timeStr?: string) => {
          if (!timeStr || !timeStr.includes(' ')) return timeStr || ''; // fallback for non-AM/PM strings
          const [time, modifier] = timeStr.split(' ');
          const parts = time.split(':');
          let hours = parts[0];
          const minutes = parts[1];
          if (!hours || !minutes) return timeStr;
          if (hours === '12') hours = '00';
          if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12);
          return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
        };
        return String(parseTime(infoA.time) || '').localeCompare(String(parseTime(infoB.time) || ''));
      }
      return 0;
    });
  }, [patients, patientSearchQuery, refreshKey]);

  const [bulkInput, setBulkInput] = React.useState('');
  const [parsedList, setParsedList] = React.useState<any[]>([]);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [virtualDateInput, setVirtualDateInput] = React.useState('');
  const [virtualTimeInput, setVirtualTimeInput] = React.useState('');


  const handleParseBulkInput = () => {
    if (!bulkInput.trim()) return;
    const lines = bulkInput.split('\n');
    const parsed: any[] = [];
    
    lines.forEach(line => {
      if (!line.trim()) return;
      const parts = line.split(/[,\t;]+/);
      if (parts.length < 2) return;
      
      const name = parts[0]?.trim() || '';
      const phone = parts[1]?.trim().replace(/\D/g, '') || '';
      const ageStr = parts[2]?.trim() || '30';
      const genderStr = parts[3]?.trim() || 'Male';
      
      let gender: 'Male' | 'Female' | 'Other' = 'Male';
      const cleanG = genderStr.toLowerCase();
      if (cleanG.startsWith('f')) gender = 'Female';
      else if (cleanG.startsWith('o')) gender = 'Other';
      
      const age = parseInt(ageStr) || 30;
      
      if (name && phone) {
        parsed.push({
          name,
          phone,
          age,
          gender,
          allergies: [],
          chronicConditions: []
        });
      }
    });
    
    setParsedList(parsed);
  };

  const handleRunBulkImport = async () => {
    if (parsedList.length === 0) return;
    setIsImporting(true);
    setImportProgress(0);
    const totalCount = parsedList.length;
    try {
      const generateUUID = () => {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
          return window.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
      };

      for (let i = 0; i < parsedList.length; i++) {
        const p = parsedList[i];
        const newPatientId = generateUUID();
        api.registerPatient({
          ...p,
          id: newPatientId
        });
        setImportProgress(Math.round(((i + 1) / (parsedList.length || 1)) * 100));
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      setParsedList([]);
      setBulkInput('');
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Bulk Import Queued! 📤',
          message: `${totalCount} patients have been loaded locally and are syncing to the database in the background.`,
          type: 'success'
        }
      }));
    } catch (err) {
      console.error('[BulkImport] Failed:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Import Error', message: 'Some patients could not be loaded into the local queue. Please retry.', type: 'error' }
      }));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-800 animate-fade-in text-left">
      {/* Left Column: Search & Registry Directory */}
      <div className="space-y-6">
        <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-sm rounded-2xl h-full flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 shrink-0" />
              <h2 className="text-base font-bold text-slate-800">Patient Directory</h2>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, phone, or Patient ID (e.g. V56)..."
                value={patientSearchQuery}
                onChange={e => setPatientSearchQuery(e.target.value)}
                className="w-full input-field py-2 pl-9 text-xs"
              />
              <Search className="text-slate-400 absolute left-3 top-2.5 w-4 h-4 shrink-0" />
            </div>

            <div className="space-y-2 lg:max-h-[480px] max-h-none lg:overflow-y-auto pr-1">
              {filteredPatients.map(p => {
                const isSelected = selectedDirectoryPatient?.id === p.id;
                
                // Check if patient has a scheduled virtual consultation
                const appts = api.getAppointments();
                const hasVirtual = appts.some(a => a.patientId === p.id && a.isVirtual && a.status !== 'completed' && a.status !== 'cancelled');

                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedDirectoryPatient(p);
                      setPatientRAGSummary('');
                      setVirtualDateInput('');
                      setVirtualTimeInput('');
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-primary-container/20 border-primary text-slate-800 shadow-sm'
                        : 'bg-slate-50 border-slate-200/50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-xs flex justify-between items-center">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{p.name}</span>
                        {p.syncStatus === 'pending' && (
                          <span title="Syncing to Supabase..." className="inline-flex">
                            <RefreshCw className="w-3 h-3 text-amber-500 animate-spin shrink-0" />
                          </span>
                        )}
                        {p.syncStatus === 'failed' && (
                          <span title="Sync failed. Auto-retrying..." className="inline-flex">
                            <AlertTriangle className="w-3 h-3 text-rose-500 animate-pulse shrink-0" />
                          </span>
                        )}
                        {hasVirtual && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[8px] font-extrabold uppercase tracking-wider animate-pulse">
                            <Video className="w-2.5 h-2.5 text-emerald-800 shrink-0" />
                            Virtual
                          </span>
                        )}
                      </span>
                      <span className="text-[9px] font-mono text-primary font-bold bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10 shrink-0">ID: {p.patientCode || p.tokenNumber || 'PAT'}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">{p.gender}, {p.age} years • {p.phone}</div>
                  </button>
                );
              })}
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
                <p className="text-xs text-slate-600 mt-1">
                  Patient ID: <span className="font-mono text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/50">{selectedDirectoryPatient.tokenNumber || 'PAT'}</span> • {selectedDirectoryPatient.gender}, {selectedDirectoryPatient.age} years • Phone: {selectedDirectoryPatient.phone}
                </p>
              </div>
              {selectedDirectoryPatient.abhaId && (
                <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-205 px-2 py-0.5 rounded-full font-bold uppercase font-mono">
                  ABHA Verified
                </span>
              )}
            </div>

            {/* ── Premium VitalSync Telemedicine Workspace ──────────────────── */}
            {(() => {
              const appts = api.getAppointments();
              const patientAppts = appts.filter(a => a.patientId === selectedDirectoryPatient.id);
              const virtualAppt = patientAppts.find(a => a.isVirtual && a.status !== 'completed' && a.status !== 'cancelled');
              
              if (!virtualAppt) {
                return (
                  <div className="p-5 bg-slate-50 border border-slate-200/60 rounded-3xl space-y-3.5 animate-fade-in relative overflow-hidden text-left">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Telemedicine Status</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">No active virtual session scheduled for this patient.</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
                      <div className="text-[10px] text-slate-500 flex-1 leading-relaxed">
                        Schedule a free virtual consultation loop. Downstream revenue is automatically captured when the patient fulfills prescribed meds at the Pharmacy or runs laboratory diagnostics.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newAppt: any = {
                            id: `apt-${Date.now()}`,
                            patientId: selectedDirectoryPatient.id,
                            doctorId: 'doc-vivek',
                            isVirtual: true,
                            virtualDate: getIstDateString(),
                            virtualTime: '10:30 AM',
                            virtualTimeAllocated: false,
                            status: 'pending',
                            appointmentBookedAtCounter: false,
                            discountEligible: false
                          };
                          api.saveAppointment(newAppt);
                          const invId = `inv-dir-${(newAppt.id || '00000000').substring(0, 8)}`;
                          const newInv: any = {
                            id: invId,
                            appointmentId: newAppt.id,
                            patientId: selectedDirectoryPatient.id,
                            type: 'consult',
                            amount: 500,
                            status: 'paid',
                            paymentMethod: 'upi',
                            createdAt: new Date().toISOString(),
                            patientName: selectedDirectoryPatient.name
                          };
                          BillingService.saveInvoice(newInv);
                          BillingService.createLedgerSplitsForInvoiceFields(invId, newAppt.id, 'consult', 500, 'upi');
                          setRefreshKey(prev => prev + 1);
                          
                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                            detail: {
                              title: 'Telemedicine Scheduled! 📅',
                              message: `A free virtual follow-up appointment has been scheduled for ${selectedDirectoryPatient.name}.`,
                              type: 'success'
                            }
                          }));
                        }}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer border-0 active:scale-95 text-white-force bg-indigo-600-force shrink-0"
                      >
                        Schedule Free Session
                      </button>
                    </div>
                  </div>
                );
              }

              const JITSI_ROOM_URL = virtualAppt.virtualMeetingUrl || `https://meet.jit.si/vitalsync-consult-${virtualAppt.id || 'tele-001'}`;

              return (
                <div className="p-5 bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-slate-50/50 border border-emerald-200/60 rounded-3xl space-y-4 animate-fade-in relative overflow-hidden shadow-xs">
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-400 to-teal-500" />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <Video className="w-4 h-4 font-bold" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Telemedicine Hub</h4>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">ROOM: vitalsync-consult-{(virtualAppt.id || 'tele-001').substring(0, 8)}</p>
                      </div>
                    </div>

                    <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full font-mono uppercase tracking-wider flex items-center gap-1 ${
                      virtualAppt.virtualTimeAllocated 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/30' 
                        : 'bg-amber-100 text-amber-900 border border-amber-200/30 animate-pulse'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                      {virtualAppt.virtualTimeAllocated ? 'Timing Confirmed' : 'Awaiting Schedule'}
                    </span>
                  </div>

                  {/* Booking schedule inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Allocate Consultation Date</label>
                      <input
                        type="date"
                        value={virtualDateInput || virtualAppt.virtualDate || ''}
                        onChange={(e) => setVirtualDateInput(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 rounded-xl text-xs outline-none bg-white text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Allocate Slot Time</label>
                      <input
                        type="text"
                        placeholder="e.g. 10:30 AM"
                        value={virtualTimeInput || virtualAppt.virtualTime || ''}
                        onChange={(e) => setVirtualTimeInput(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 rounded-xl text-xs outline-none bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Actions & Launcher */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const finalDate = virtualDateInput || virtualAppt.virtualDate || (virtualAppt as any).virtual_date || (virtualAppt.createdAt || (virtualAppt as any).createdAt || '').split('T')[0] || getIstDateString();
                        const finalTime = virtualTimeInput || virtualAppt.virtualTime || '10:30 AM';
                        
                        // Update appointment
                        const updatedAppt = {
                          ...virtualAppt,
                          virtualDate: finalDate,
                          virtualTime: finalTime,
                          virtualTimeAllocated: true
                        };
                        api.saveAppointment(updatedAppt);
                        
                        // Notify patient on WhatsApp
                        const cachedProfStr = localStorage.getItem('vitalsync_cached_profile');
                        let docNameDisp = 'Your Doctor';
                        if (cachedProfStr) {
                          try {
                            const p = JSON.parse(cachedProfStr);
                            if (p.display_name) docNameDisp = p.display_name;
                          } catch (_e) { /* ignore */ }
                        }
                        const notificationText = `📅 *Virtual Consultation Confirmed!* \n\n${docNameDisp} has allocated your virtual consultation timing: \n🗓️ *Date:* ${finalDate} \n⏰ *Time:* ${finalTime} \n\nPlease join the meeting using this link when scheduled: \n🔗 ${JITSI_ROOM_URL}`;
                        api.pushWhatsAppMessageFromBot(selectedDirectoryPatient.phone, notificationText);

                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'Schedule Dispatched! 📅',
                            message: `Consultation timing sent to patient's WhatsApp.`,
                            type: 'success'
                          }
                        }));
                      }}
                      className="flex-1 py-3 border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer bg-white"
                    >
                      Confirm &amp; Notify (WhatsApp)
                    </button>

                    <a
                      href={JITSI_ROOM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:scale-102 active:scale-98 text-white-force bg-emerald-600-force border-0"
                    >
                      <Video className="w-4 h-4 text-white" />
                      Start Video Call
                    </a>
                  </div>

                  {/* USP explanation message */}
                  <div className="p-3 bg-emerald-50/50 border border-emerald-100/60 rounded-2xl flex gap-2.5 items-start text-emerald-800">
                    <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed">
                      <strong>💡 Monetization Hub:</strong> Virtual consultations are free for patients. Utilize your e-Prescription (e-Rx) or referral lab order buttons below to capture commissions on medicines and pathology tests.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* loyalty discounts dispatcher */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-amber-500 shrink-0" />
                WhatsApp Loyalty Offers Console
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'discount_30')}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer border-slate-200"
                >
                  <Pill className="w-5 h-5 text-teal-600" />
                  <strong className="block text-[11px] text-slate-700 font-semibold">30% Off Medicine Coupon</strong>
                  <p className="text-[9px] text-slate-400 leading-normal">For repeat glycemic drugs refill orders.</p>
                </button>
                <button
                  onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'virtual_appointment')}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer border-slate-200"
                >
                  <Video className="w-5 h-5 text-blue-600" />
                  <strong className="block text-[11px] text-slate-700 font-semibold">10-Day Virtual Invite</strong>
                  <p className="text-[9px] text-slate-400 leading-normal">Invite to virtual telemedicine follow-up.</p>
                </button>
                <button
                  onClick={() => api.dispatchWhatsAppLoyaltyOffer(selectedDirectoryPatient.id, 'quick_booking')}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left space-y-2 hover:scale-102 transition-all cursor-pointer border-slate-200"
                >
                  <CalendarCheck className="w-4 h-4 text-amber-600" />
                  <strong className="block text-[11px] text-slate-700 font-semibold">Portal Invite Link</strong>
                  <p className="text-[9px] text-slate-400 leading-normal">Invoice and home lab sample booking portal.</p>
                </button>
              </div>
            </div>

            {/* AI chronic health summary */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-705 flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-indigo-600 shrink-0" />
                  AI Chronic Longitudinal Health Summary
                </h3>
                <button
                  onClick={() => {
                    const sum = api.generateAIPatientSummary(selectedDirectoryPatient.id);
                    setPatientRAGSummary(sum);
                  }}
                  className="text-primary hover:text-primary-700 text-xs font-bold flex items-center gap-1 cursor-pointer border-0 bg-transparent"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" /> Generate Summary
                </button>
              </div>

              {patientRAGSummary ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-slate-700 leading-relaxed font-sans animate-fade-in font-medium italic">
                  {patientRAGSummary}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Click Generate Summary to run the RAG diagnostic prompt analyzing the patient chronic history.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bulk Onboarding Panel */}
            <div className="glass-panel p-6 bg-white border-slate-200/80 shadow-xs rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-indigo-600 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-800">Bulk Patient Onboarder</h3>
                </div>
                <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase">
                  Excel / CSV Copy-Paste
                </span>
              </div>
              
              <p className="text-[11px] text-slate-404 leading-relaxed font-sans">
                Paste patient lists directly from Excel or Text. 
                Format: <strong className="text-slate-600 font-mono">Name, Phone, Age, Gender</strong> (one patient per line). The engine automatically calculates memorable Patient IDs (e.g. <strong className="text-slate-600">V56</strong>).
              </p>
              
              <textarea
                rows={5}
                disabled={isImporting}
                placeholder="e.g.&#10;Amit Kumar, 9876543201, 34, Male&#10;Sunita Devi, 9876543202, 28, Female"
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/25 rounded-xl text-xs outline-none bg-slate-50/50 font-mono leading-relaxed"
              />
              
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleParseBulkInput}
                  disabled={!bulkInput.trim() || isImporting}
                  className="btn-primary px-4 py-2 text-xs font-semibold rounded-lg text-white-force border-0 cursor-pointer"
                >
                  Parse Input List
                </button>
                {parsedList.length > 0 && (
                  <span className="text-[10px] text-emerald-600 font-bold font-sans">
                    ✓ {parsedList.length} Patients parsed successfully
                  </span>
                )}
              </div>

              {parsedList.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100 animate-fade-in">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preview Import Queue</h4>
                  <div className="max-h-[140px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 bg-slate-50/30">
                    {parsedList.map((p, idx) => (
                      <div key={`import-preview-${idx}-${p.phone || p.name}`} className="p-2.5 flex justify-between items-center text-[10px] font-sans">
                        <div>
                          <span className="font-bold text-slate-700">{p.name}</span> ({p.gender}, {p.age} yrs)
                        </div>
                        <span className="font-mono text-slate-500 font-medium">{p.phone}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleRunBulkImport}
                    disabled={isImporting}
                    className="w-full btn-primary bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 text-white py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg border-0 cursor-pointer text-white-force bg-emerald-600-force"
                  >
                    {isImporting ? `Importing... (${importProgress}%)` : `Execute Bulk Import (${parsedList.length} Patients)`}
                  </button>
                </div>
              )}
            </div>

            <div className="glass-panel p-10 bg-white border-slate-200/80 shadow-sm rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
              <Users className="w-12 h-12 text-slate-200 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-slate-700">No Patient Selected</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Select an active patient registry profile from the directory on the left or paste new profiles above.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
