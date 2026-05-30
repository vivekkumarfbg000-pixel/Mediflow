import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import type { Patient, WhatsAppSession, ChatMessage } from '../../types';
import { Send, Check, Phone, Video, MoreVertical, ShieldAlert, Award, Smartphone } from 'lucide-react';

interface PatientWhatsAppSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PatientWhatsAppSimulator: React.FC<PatientWhatsAppSimulatorProps> = ({ isOpen, onClose }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>('9876543210'); // Default to Aarav Sharma
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [typedMessage, setTypedMessage] = useState<string>('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncData = () => {
      const allPatients = api.getPatients();
      setPatients(allPatients);
      const waSessions = api.getWhatsAppSessions();
      setSessions(waSessions);
      const allInvoices = api.getUnifiedInvoices();
      setInvoices(allInvoices);
      
      // Auto-initialize session if none exists for the selected phone number
      const activeSession = waSessions.find(s => s.patientPhone === selectedPhone);
      if (!activeSession && allPatients.some(p => p.phone === selectedPhone)) {
        api.initiateWhatsAppSession(selectedPhone);
      }
    };

    syncData();
    const unsubscribe = api.subscribe(syncData);
    return () => unsubscribe();
  }, [selectedPhone]);

  useEffect(() => {
    // Scroll chats to bottom when history shifts
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, selectedPhone]);

  const activePatient = patients.find(p => p.phone === selectedPhone) || patients[0];
  const activeSession = sessions.find(s => s.patientPhone === selectedPhone);
  const chatHistory: ChatMessage[] = activeSession?.sessionData?.chatHistory || [];
  const activeState = activeSession?.currentState || 'AWAITING_WELCOME';

  const pendingInvoice = invoices.find(i => i.patientId === activePatient?.id && i.paymentStatus === 'pending');
  const docFee = pendingInvoice ? Number(pendingInvoice.doctorFee || 0) : 500;
  const labFee = pendingInvoice ? Number(pendingInvoice.labFee || 0) : 350;
  const pharmFee = pendingInvoice ? Number(pendingInvoice.pharmacyFee || 0) : 375;
  const totalFee = pendingInvoice ? Number(pendingInvoice.totalAmount || 0) : 1225;

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    setTypedMessage('');
    
    // Process message immediately inside state machine
    await api.processIncomingWhatsAppMessage(selectedPhone, text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[410px] bg-slate-100 border-l border-slate-200/80 shadow-2xl z-[90] flex flex-col justify-between animate-slide-in text-slate-800 font-sans">
      
      {/* Simulator top controller bar */}
      <div className="p-4 bg-white text-white flex justify-between items-center border-b border-slate-950">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-emerald-400 animate-pulse" />
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider uppercase text-emerald-400">Mediflow Patient Sandbox</h2>
            <p className="text-[10px] text-slate-600 mt-0.5">Dual-Screen Conversational Simulator</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-600 hover:text-white transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm font-bold">close</span>
        </button>
      </div>

      {/* Simulator session selector */}
      <div className="p-3 bg-white border-b border-slate-200/50 flex gap-2 items-center">
        <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Simulate Patient:</span>
        <select
          value={selectedPhone}
          onChange={e => setSelectedPhone(e.target.value)}
          className="flex-1 input-field py-1 text-xs bg-slate-50 border-slate-200"
        >
          {patients.map(p => (
            <option key={p.id} value={p.phone}>{p.name} ({p.phone})</option>
          ))}
        </select>
      </div>

      {/* Dynamic Mobile phone frame */}
      <div className="flex-1 bg-slate-50 p-4 flex justify-center items-center overflow-hidden">
        <div className="w-full h-full max-w-[340px] max-h-[560px] bg-white border-[6px] border-slate-900 rounded-[32px] shadow-2xl flex flex-col relative overflow-hidden">
          
          {/* Mobile top camera notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-white rounded-b-xl z-20 flex justify-center items-center">
            <div className="w-3 h-3 rounded-full bg-slate-800 mr-2 border border-slate-700/50" />
            <div className="w-8 h-1 bg-slate-800 rounded-full" />
          </div>

          {/* WhatsApp top navigation header */}
          <div className="pt-6 pb-2.5 px-3 bg-[#075e54] text-white flex justify-between items-center z-10 shrink-0 shadow-md">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-400/20 flex items-center justify-center text-emerald-400 font-bold text-xs font-mono shadow-inner">
                {activePatient?.name.substring(0, 2).toUpperCase() || 'MF'}
              </div>
              <div>
                <div className="text-xs font-bold flex items-center gap-1">
                  Mediflow Assistant
                  <Check className="h-3 w-3 bg-emerald-400 text-[#075e54] rounded-full p-0.5" />
                </div>
                <span className="text-[8px] text-emerald-300 font-medium">Online • पटना केयर पॉड</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-emerald-100">
              <Phone className="h-3.5 w-3.5 hover:text-white cursor-pointer" />
              <Video className="h-3.5 w-3.5 hover:text-white cursor-pointer" />
              <MoreVertical className="h-3.5 w-3.5 hover:text-white cursor-pointer" />
            </div>
          </div>

          {/* WhatsApp Chat messages feed background */}
          <div 
            className="flex-1 px-3 py-4 overflow-y-auto space-y-3 flex flex-col"
            style={{ 
              backgroundColor: '#e5ddd5', 
              backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
              backgroundSize: 'contain'
            }}
          >
            <div className="mx-auto bg-slate-100/90 text-slate-500 text-[8px] py-1 px-2.5 rounded-md text-center max-w-[200px] border border-slate-200/40 uppercase tracking-wider font-mono font-bold">
              🔒 Messages are end-to-end encrypted across RLS.
            </div>

            {chatHistory.map((msg, i) => {
              const isBot = msg.sender === 'bot';
              return (
                <div 
                  key={i} 
                  className={`max-w-[85%] p-2 rounded-xl text-[11px] shadow-sm leading-relaxed ${
                    isBot 
                      ? 'bg-white text-slate-800 self-start rounded-tl-none border-l-2 border-emerald-500' 
                      : 'bg-[#dcf8c6] text-slate-800 self-end rounded-tr-none border-r-2 border-[#82d641]'
                  }`}
                >
                  <p className="whitespace-pre-line font-medium leading-normal">{msg.text}</p>
                  <div className="text-[7px] text-slate-600 text-right mt-1 font-mono">
                    {msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM'}
                  </div>
                </div>
              );
            })}

            {/* UPGRADE INTERACTIVE SIMULATORS INTERFACES */}

            {/* 1. Consent welcomes permissions card */}
            {activeState === 'AWAITING_WELCOME' && (
              <div className="bg-white rounded-2xl p-3 border border-emerald-100 shadow-lg text-slate-800 self-center max-w-[92%] space-y-3 animate-fade-in">
                <div className="flex gap-2 items-start text-[#075e54] font-bold text-xs">
                  <ShieldAlert className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  Ecosystem Permission Access
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                  Dr. Sharma's Clinic is requesting permission to secure-sync e-Rx, lab result history, and invoice payments inside care pod.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSendMessage('1')}
                    className="flex-1 bg-[#075e54] hover:bg-[#0c4e46] text-white text-[9px] font-bold py-1.5 rounded-lg uppercase tracking-wider transition-colors cursor-pointer text-white-force"
                  >
                    Grant Access
                  </button>
                  <button
                    onClick={() => handleSendMessage('stop')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9px] font-bold py-1.5 rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {/* 2. Unified billing UPI payment card */}
            {activeState === 'AWAITING_PAYMENT' && (
              <div className="bg-white rounded-2xl p-3.5 border border-primary/20 shadow-xl text-slate-800 self-center max-w-[92%] space-y-3.5 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div className="flex gap-1.5 items-center text-primary font-bold text-xs">
                    <span className="material-symbols-outlined text-sm">payments</span>
                    Unified Care Invoice
                  </div>
                  <span className="text-[8px] font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">Pending</span>
                </div>
                
                <div className="text-[10px] space-y-1.5 text-slate-600">
                  <div className="flex justify-between font-medium"><span>Doctor Appt Fee:</span><span className="font-mono text-slate-800">₹{docFee.toFixed(2)}</span></div>
                  <div className="flex justify-between font-medium"><span>Lab Test charge:</span><span className="font-mono text-slate-800">₹{labFee.toFixed(2)}</span></div>
                  <div className="flex justify-between font-medium"><span>Pharmacy Prescr:</span><span className="font-mono text-slate-800">₹{pharmFee.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1.5 text-[11px]">
                    <span>Total Amount:</span>
                    <span className="font-mono text-primary">₹{totalFee.toFixed(2)}</span>
                  </div>
                </div>

                {/* Simulated payment trigger button */}
                <button
                  onClick={() => handleSendMessage('pay')}
                  className="w-full btn-primary py-2 text-center text-xs font-bold rounded-lg hover:scale-102 transition-transform flex justify-center items-center gap-1.5 text-white-force"
                >
                  <span className="material-symbols-outlined text-xs">qr_code_scanner</span>
                  Pay via UPI Split Gateway
                </button>
              </div>
            )}

            {/* 3. Loyalty reward trigger card */}
            {activeState === 'COMPLETED' && (
              <div className="bg-white rounded-2xl p-3 border border-amber-200 shadow-md text-slate-800 self-center max-w-[92%] space-y-2 animate-fade-in">
                <div className="flex gap-1.5 items-center text-amber-600 font-bold text-xs font-sans">
                  <Award className="h-4 w-4 text-amber-500" />
                  Ecosystem Loyalty Refills
                </div>
                <p className="text-[9.5px] text-slate-500 leading-normal font-sans">
                  Secure ongoing care pod benefits. Book direct virtual meetings or auto-order pharmacy refills.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleSendMessage('refill')}
                    className="bg-amber-50 hover:bg-amber-100/80 border border-amber-200/50 text-[#075e54] text-[8.5px] font-bold py-1 rounded transition-all cursor-pointer"
                  >
                    Request Refill
                  </button>
                  <button
                    onClick={() => handleSendMessage('revoke')}
                    className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-rose-500 text-[8.5px] font-bold py-1 rounded transition-all cursor-pointer"
                  >
                    Lock Session
                  </button>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* WhatsApp bottom message input bar */}
          <div className="bg-[#f0f0f0] p-2 flex items-center gap-1.5 border-t border-slate-200 shrink-0">
            <input
              type="text"
              placeholder="Type message..."
              value={typedMessage}
              onChange={e => setTypedMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage(typedMessage)}
              className="flex-1 bg-white border border-slate-300 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
            />
            <button
              onClick={() => handleSendMessage(typedMessage)}
              className="w-8 h-8 rounded-full bg-[#075e54] text-white flex items-center justify-center shadow-md hover:bg-[#0c4e46] shrink-0 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Send className="h-3.5 w-3.5 text-white-force" />
            </button>
          </div>

        </div>
      </div>

      {/* Simulator instructions footer */}
      <div className="p-4 bg-white border-t border-slate-950 text-[10px] text-slate-600 space-y-1">
        <div><strong>Interactive Instructions:</strong></div>
        <p className="leading-normal">Select a patient, view their current conversational state on the phone screen, and trigger events reactively to watch billing splits and pharmacy flows sync instantly.</p>
      </div>

    </div>
  );
};
