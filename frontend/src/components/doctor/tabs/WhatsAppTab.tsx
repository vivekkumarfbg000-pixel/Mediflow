import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { supabase } from '../../../lib/supabaseClient';
import type { Patient } from '../../../types';
import { ClinicPlacardGenerator } from '../../admin/ClinicPlacardGenerator';
import { WhatsAppService } from '../../../services/whatsappService';

interface WhatsAppTabProps {
  whatsAppSessions: any[];
  setWhatsAppSessions: React.Dispatch<React.SetStateAction<any[]>>;
  patients: Patient[];
  activeWabaConnection: any | null;
  setActiveWabaConnection: (c: any | null) => void;
  wabaFormOpen: boolean;
  setWabaFormOpen: (b: boolean) => void;
  wabaPhoneId: string;
  setWabaPhoneId: (s: string) => void;
  wabaIdVal: string;
  setWabaIdVal: (s: string) => void;
  wabaNumber: string;
  setWabaNumber: (s: string) => void;
  wabaTokenVal: string;
  setWabaTokenVal: (s: string) => void;
  chatSearch: string;
  setChatSearch: (s: string) => void;
  selectedChatSession: any | null;
  setSelectedChatSession: (s: any | null) => void;
  manualChatMsg: string;
  setManualChatMsg: (s: string) => void;
  activePod: any;
  telemetryLogs: string[];
}

export const WhatsAppTab: React.FC<WhatsAppTabProps> = React.memo(({
  whatsAppSessions,
  setWhatsAppSessions,
  patients,
  activeWabaConnection,
  setActiveWabaConnection,
  wabaFormOpen,
  setWabaFormOpen,
  wabaPhoneId,
  setWabaPhoneId,
  wabaIdVal,
  setWabaIdVal,
  wabaNumber,
  setWabaNumber,
  wabaTokenVal,
  setWabaTokenVal,
  chatSearch,
  setChatSearch,
  selectedChatSession,
  setSelectedChatSession,
  manualChatMsg,
  setManualChatMsg,
  activePod,
  telemetryLogs
}) => {
  const [rightTab, setRightTab] = useState<'chat' | 'broadcast'>('chat');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'diabetes' | 'hypertension' | 'opd'>('all');
  const [broadcastLogs, setBroadcastLogs] = useState<any[]>([]);

  useEffect(() => {
    const logs = localStorage.getItem('whatsapp_broadcast_logs');
    if (logs) {
      setBroadcastLogs(JSON.parse(logs));
    }
  }, []);
  // ── Real Meta API Clinic WhatsApp Onboarding State ──────────────────────
  // Step 1: Doctor enters clinic name + phone
  // Step 2: Real OTP arrives via SMS to clinic phone
  // Step 3: OTP verified → real WABA credentials saved to DB
  const [onboardStep, setOnboardStep] = useState<1 | 2 | 3>(1);
  const [clinicDisplayName, setClinicDisplayName] = useState('');
  const [clinicPhoneInput, setClinicPhoneInput] = useState('');
  const [onboardPhoneNumberId, setOnboardPhoneNumberId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState('');
  const [otpMethod, setOtpMethod] = useState<'SMS' | 'VOICE'>('SMS');

  // Direct Meta Credentials Settings Modal
  const [isMetaSettingsOpen, setIsMetaSettingsOpen] = useState(false);
  const [metaPhoneInput, setMetaPhoneInput] = useState(activeWabaConnection?.phone_number || '+91 98765 43210');
  const [metaPhoneIdInput, setMetaPhoneIdInput] = useState(activeWabaConnection?.phone_number_id || '105829471928374');
  const [metaTokenInput, setMetaTokenInput] = useState(activeWabaConnection?.access_token || '');

  // Filter sessions based on search
  const filteredSessions = whatsAppSessions.filter(s => {
    const matchPhone = s.patientPhone.includes(chatSearch);
    const pat = patients.find(p => p.id === s.patientId);
    const matchName = pat ? pat.name.toLowerCase().includes(chatSearch.toLowerCase()) : false;
    return matchPhone || matchName;
  });

  const activeChat = whatsAppSessions.find(s => s.id === selectedChatSession?.id) ?? selectedChatSession;
  const sessionData = activeChat?.sessionData || activeChat?.session_data || {};
  const isHumanOverride = sessionData.humanOverride === true;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-800 font-sans text-left">
      
      {/* Connection & Setup Config Header (Top spanning) */}
      <div className="lg:col-span-12">
        {activeWabaConnection ? (
          <div className="glass-panel p-5 bg-white border-emerald-100 shadow-xs rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-emerald-500" />
            <div className="flex items-center gap-4.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 font-extrabold shadow-sm animate-pulse">
                <span className="material-symbols-outlined text-2xl">cell_tower</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider font-sans">Meta WhatsApp Cloud API Connected</h3>
                  <span className="text-[9px] font-bold font-mono px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full uppercase tracking-wider">Active Channel</span>
                </div>
                <div className="text-[10px] text-slate-600 font-mono mt-1 space-y-0.5">
                  <div>WABA Phone Number: <strong className="text-slate-600 font-sans">{activeWabaConnection.phone_number}</strong></div>
                  <div>Phone ID: <strong className="text-slate-600">{activeWabaConnection.phone_number_id}</strong> • Account ID: <strong className="text-slate-600">{activeWabaConnection.waba_id}</strong></div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                  if (window.confirm("Are you sure you want to disconnect this live WhatsApp business channel? AI automations will revert to simulator mode.")) {
                    setActiveWabaConnection(null);
                    try {
                      await supabase
                        .from('waba_connections')
                        .delete()
                        .eq('id', activeWabaConnection.id);
                    } catch (_e) {}

                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: {
                        title: 'Channel Disconnected! 🔴',
                        message: 'Meta Cloud API channel detached successfully.',
                        type: 'info'
                      }
                    }));
                  }
                }}
                className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Disconnect Channel
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-6 bg-white border-slate-200/60 shadow-xs rounded-3xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-blue-500 via-primary to-indigo-500 opacity-60" />
            <div className="flex gap-4.5 items-start">
              <span className="material-symbols-outlined text-primary text-4xl mt-1">chat_bubble</span>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider font-sans">Activate Clinic WhatsApp Chatbot in 10 Seconds</h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-2xl font-sans">
                  Connect your clinic's WhatsApp number in 3 simple steps. Enter your clinic name &amp; number, verify via OTP — we handle all Meta credentials and billing automatically. Patients will see your clinic name when they receive messages.
                </p>
              </div>
            </div>
            <button
              onClick={() => setWabaFormOpen(true)}
              className="px-5 py-2.5 bg-primary hover:bg-primary-505 text-white border border-primary/25 hover:border-primary rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all hover:scale-102 active:scale-98 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-white-force bg-primary-force"
            >
              <span className="material-symbols-outlined text-sm font-bold text-white-force">connect_without_contact</span>
              Connect Business Number
            </button>
          </div>
        )}
      </div>

      {/* Left Pane: Active Sessions List (Inbox Sidebar) */}
      <div className="lg:col-span-4 space-y-4">
        <div className="glass-panel p-5 bg-white border-slate-200/60 shadow-sm rounded-3xl h-full flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="space-y-3.5">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base font-bold">question_answer</span>
                Patient Conversations
              </h2>
              <span className="text-[9px] font-bold font-mono px-2 py-0.5 bg-blue-50 text-blue-500 rounded-full">
                {filteredSessions.length} active
              </span>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <span className="material-symbols-outlined text-slate-600 text-base absolute left-3 top-2.5">search</span>
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/25 rounded-2xl text-xs outline-none bg-slate-50/50"
              />
            </div>

            {/* Session cards mapping */}
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1.5">
              {filteredSessions.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs italic">
                  No active sessions found.
                </div>
              ) : (
                filteredSessions.map(s => {
                  const pat = patients.find(p => p.id === s.patientId);
                  const name = pat ? pat.name : 'Unknown Patient';
                  const sSessData = s.sessionData || s.session_data || {};
                  const lastMsg = sSessData.chatHistory?.[sSessData.chatHistory.length - 1]?.text ?? 'Session initialized';
                  const isSelected = activeChat?.id === s.id;

                  let stateBadge = 'bg-slate-100 text-slate-500';
                  if (s.currentState === 'AWAITING_PAYMENT') stateBadge = 'bg-amber-100 text-amber-700';
                  else if (s.currentState === 'COMPLETED') stateBadge = 'bg-emerald-100 text-emerald-700';
                  else if (s.currentState === 'FAILED_DELIVERY') stateBadge = 'bg-rose-100 text-rose-700';
                  else if (s.currentState === 'AWAITING_CONFIRMATION') stateBadge = 'bg-blue-100 text-blue-700';

                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedChatSession(s)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-300 relative group overflow-hidden ${
                        isSelected 
                          ? 'bg-blue-50/40 border-primary/50 shadow-xs' 
                          : 'bg-slate-50/40 border-slate-200/60 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                      )}
                      <div className="flex justify-between items-start gap-1">
                        <div className="font-bold text-xs text-slate-700 group-hover:text-primary transition-colors truncate">{name}</div>
                        <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 uppercase ${stateBadge}`}>
                          {s.currentState.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-600 font-mono mt-1">{s.patientPhone}</div>
                      <div className="text-[10px] text-slate-500 mt-2 truncate font-sans italic">"{lastMsg}"</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[9px] text-slate-400 flex items-center gap-1 leading-relaxed">
            <span className="material-symbols-outlined text-xs">info</span>
            * Uses Supabase Realtime to broadcast incoming patient responses instantly.
          </div>
        </div>

        {/* Onboarding Placard Generator */}
        <div className="mt-4">
          <ClinicPlacardGenerator 
            activeWabaNumber={activeWabaConnection?.phone_number || '+91 90000 00000'}
            clinicName={activePod?.name || 'VitalSync Smart Clinic'}
          />
        </div>

        {/* Meta WABA Telemetry Logger */}
        <div className="mt-4 glass-panel p-5 bg-white border-slate-200 shadow-sm rounded-3xl text-zinc-300 font-mono space-y-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-emerald-500 to-green-404" />
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <h3 className="text-[10px] font-extrabold tracking-wider text-emerald-400 uppercase">WABA DevOps Telemetry</h3>
            </div>
            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-900/50 rounded uppercase font-mono">Live Feed</span>
          </div>
          
          <div className="space-y-1.5 text-[9px] max-h-40 overflow-y-auto pr-1 leading-relaxed custom-scrollbar text-left text-zinc-300">
            {telemetryLogs.map((log, idx) => (
              <div key={idx} className="hover:bg-zinc-900/50 p-1 rounded transition-colors break-all">
                <span className="text-zinc-500">&gt;</span> <span className="text-emerald-500/90 font-semibold">{log}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 text-emerald-400">
              <span>&gt;</span> <span className="w-1.5 h-3 bg-emerald-400 animate-pulse inline-block" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Live Active Conversation Detail & Takeover Console */}
      <div className="lg:col-span-8 flex flex-col space-y-4">
        {/* Tab Selector */}
        <div className="flex gap-2 p-1 bg-slate-100/80 border border-slate-200/50 rounded-2xl self-start">
          <button
            type="button"
            onClick={() => setRightTab('chat')}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              rightTab === 'chat' ? 'bg-primary text-white text-white-force' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            💬 Patient Chat
          </button>
          <button
            type="button"
            onClick={() => setRightTab('broadcast')}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              rightTab === 'broadcast' ? 'bg-primary text-white text-white-force' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            📢 Broadcast Campaigns
          </button>
        </div>

        {rightTab === 'chat' ? (
          activeChat ? (
            <div className="glass-panel p-5 bg-white border-slate-200/60 shadow-sm rounded-3xl h-[560px] flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2.5px] bg-primary" />
              
              {/* Active Chat Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    {patients.find(p => p.id === activeChat.patientId)?.name ?? 'Linked Patient'}
                    <span className={`w-2 h-2 rounded-full ${isHumanOverride ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
                  </h3>
                  <span className="text-[10px] text-slate-404 font-mono">{activeChat.patientPhone}</span>
                </div>

                {/* Takeover Control Toggle */}
                <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200/40 rounded-2xl">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isHumanOverride ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {isHumanOverride ? '⚡ Human Takeover' : '🤖 AI Agent Active'}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const updatedOverride = !isHumanOverride;
                      const updatedSess = {
                        ...activeChat,
                        sessionData: { ...sessionData, humanOverride: updatedOverride },
                        session_data: { ...sessionData, humanOverride: updatedOverride }
                      };

                      // 1. Local-first state update
                      setSelectedChatSession(updatedSess);
                      setWhatsAppSessions(prev => prev.map(s => s.id === activeChat.id ? updatedSess : s));

                      // 2. Save in local storage sessions registry
                      const allSessions = WhatsAppService.getWhatsAppSessions();
                      const sIdx = allSessions.findIndex(s => s.id === activeChat.id);
                      if (sIdx !== -1) {
                        allSessions[sIdx] = updatedSess;
                        WhatsAppService.saveWhatsAppSessions(allSessions);
                      }

                      // 3. Non-blocking Supabase sync
                      try {
                        await supabase
                          .from('whatsapp_sessions')
                          .update({
                            session_data: { ...sessionData, humanOverride: updatedOverride }
                          })
                          .eq('id', activeChat.id);
                      } catch (_e) {}

                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: updatedOverride ? 'Human Override Enabled! ⚡' : 'AI Bot Restored! 🤖',
                          message: updatedOverride ? 'AI chatbot response pipeline frozen. Staff manual response active.' : 'Clinical Scribe AI resume passive patient routing.',
                          type: 'success'
                        }
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-xs border-0 ${
                      isHumanOverride 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isHumanOverride ? 'Restore AI Bot' : 'Take Over Chat'}
                  </button>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1 max-h-[360px] bg-slate-50/20 border border-slate-200/20 rounded-2xl p-4 my-3">
                {(sessionData.chatHistory ?? []).map((msg: any, idx: number) => {
                  const sRole = (msg.sender || '').toLowerCase();
                  const isPatient = sRole === 'patient' || sRole === 'user' || sRole === 'customer' || sRole === 'client';
                  const isBot = sRole === 'bot';
                  
                  let bubbleStyle = 'bg-indigo-600 text-white ml-auto rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl';
                  if (isPatient) {
                    bubbleStyle = 'bg-white border border-slate-200/80 text-slate-800 mr-auto rounded-tr-2xl rounded-br-2xl rounded-tl-2xl';
                  } else if (sRole === 'agent' || sRole === 'doctor') {
                    bubbleStyle = 'bg-amber-500 text-white ml-auto rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl';
                  }

                  return (
                    <div key={idx} className="flex flex-col w-full max-w-[85%] space-y-0.5 relative">
                      <div className={`p-3 text-xs leading-relaxed font-sans shadow-2xs ${bubbleStyle}`}>
                        {msg.text}
                      </div>
                      <span className={`text-[8px] font-mono text-slate-600 ${isPatient ? 'mr-auto pl-1 text-slate-500 font-bold' : 'ml-auto pr-1'}`}>
                        {isPatient ? '👤 PATIENT' : (sRole === 'agent' || sRole === 'doctor' ? '👨‍⚕️ DOCTOR' : '🤖 AI BOT')} • {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Outbound Messaging Inputs Panel */}
              <div className="border-t border-slate-100 pt-3">
                {isHumanOverride ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!manualChatMsg.trim()) return;

                      const textToSend = manualChatMsg.trim();
                      setManualChatMsg('');

                      const chatHistory = [...(sessionData.chatHistory || [])];
                      const currentTime = new Date().toISOString();
                      
                      chatHistory.push({
                        sender: 'agent',
                        text: textToSend,
                        timestamp: currentTime,
                        time: currentTime
                      });

                      const updatedSess = {
                        ...activeChat,
                        sessionData: { ...sessionData, chatHistory },
                        session_data: { ...sessionData, chatHistory }
                      };

                      // 1. Local-first immediate update
                      setSelectedChatSession(updatedSess);
                      setWhatsAppSessions(prev => prev.map(s => s.id === activeChat.id ? updatedSess : s));

                      // 2. Save to local storage sessions registry
                      const allSessions = WhatsAppService.getWhatsAppSessions();
                      const sIdx = allSessions.findIndex(s => s.id === activeChat.id);
                      if (sIdx !== -1) {
                        allSessions[sIdx] = updatedSess;
                        WhatsAppService.saveWhatsAppSessions(allSessions);
                      }

                      // 3. Dispatch payload
                      await api.sendWhatsAppMessagePayload(activeChat.patientPhone, 'custom_manual_reply', {
                        replyText: textToSend
                      });

                      // 4. Non-blocking Supabase sync
                      try {
                        await supabase
                          .from('whatsapp_sessions')
                          .update({
                            session_data: { ...sessionData, chatHistory },
                            last_interaction: currentTime
                          })
                          .eq('id', activeChat.id);
                      } catch (_e) {}

                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'Message Dispatched! ✉️',
                          message: `Direct message sent to patient WhatsApp queue (${activeChat.patientPhone}).`,
                          type: 'success'
                        }
                      }));
                    }}
                    className="flex gap-3"
                  >
                    <input
                      type="text"
                      placeholder="Type a manual response to takeover the patient session..."
                      value={manualChatMsg}
                      onChange={(e) => setManualChatMsg(e.target.value)}
                      className="flex-1 px-4.5 py-3 border border-slate-200/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 rounded-2xl text-xs outline-none bg-slate-50/50"
                    />
                    <button
                      type="submit"
                      className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer text-white-force bg-amber-500-force border-0"
                    >
                      <span className="material-symbols-outlined text-sm font-bold text-white-force">send</span>
                      Send Message
                    </button>
                  </form>
                ) : (
                  <div className="p-3 bg-blue-50/50 border border-blue-100/60 rounded-2xl text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="material-symbols-outlined text-sm text-blue-500 animate-pulse">lock</span>
                      AI chatbot agent is actively handling this patient care session
                    </div>
                    <p className="text-[10px] text-slate-404">
                      Click the "Take Over Chat" button at the top header to halt AI automations and send manual updates.
                    </p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="glass-panel p-12 bg-white border-slate-200/60 shadow-sm rounded-3xl h-[560px] flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2.5px] bg-primary/20" />
              <span className="material-symbols-outlined text-slate-200 text-6xl">chat</span>
              <div>
                <h3 className="text-slate-700 font-extrabold uppercase text-xs tracking-wider">No Patient Conversation Selected</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm font-sans">
                  Select a live active chat session from the queue registry on the left to monitor, review clinical guidelines, or override chatbot automations with human takeover capabilities.
                </p>
              </div>
            </div>
          )
        ) : (
          /* Clinician Broadcast Campaigns Panel */
          <div className="glass-panel p-5 bg-white border-slate-200/60 shadow-sm rounded-3xl h-[560px] flex flex-col justify-between relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-primary" />
            <div className="space-y-4 overflow-y-auto max-h-[510px] pr-1.5 w-full flex-1">
              
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  📢 Create WhatsApp Broadcast Campaign
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">
                  Send proactive messages to patient subsets matching clinical criteria.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Patient Audience</label>
                  <select
                    value={broadcastTarget}
                    onChange={(e) => setBroadcastTarget(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/25 rounded-xl text-xs outline-none bg-slate-50/50"
                  >
                    <option value="all">All Registered Patients</option>
                    <option value="diabetes">Diabetic Patients (Chronic)</option>
                    <option value="hypertension">Hypertensive Patients (Chronic)</option>
                    <option value="opd">Currently Active OPD Queue</option>
                  </select>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center text-[10px] text-blue-700 font-sans leading-relaxed">
                  💡 *Hinglish / Bilingual Templates* are highly recommended to maximize readability and patient engagement.
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Campaign Message Draft</label>
                <textarea
                  rows={4}
                  placeholder="Type your WhatsApp broadcast campaign message here..."
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/25 rounded-xl text-xs outline-none bg-slate-50/50 font-sans leading-relaxed"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!broadcastMsg.trim()) return;
                    let targets: Patient[] = [];
                    if (broadcastTarget === 'all') {
                      targets = patients;
                    } else if (broadcastTarget === 'diabetes') {
                      targets = patients.filter(p => p.chronicConditions.some(c => c.toLowerCase().includes('diabetes') || c.toLowerCase().includes('sugar')));
                    } else if (broadcastTarget === 'hypertension') {
                      targets = patients.filter(p => p.chronicConditions.some(c => c.toLowerCase().includes('hypertension') || c.toLowerCase().includes('bp')));
                    } else if (broadcastTarget === 'opd') {
                      targets = patients.filter(p => p.queueStatus && p.queueStatus !== 'completed');
                    }

                    if (targets.length === 0) {
                      alert("Selected target filters did not match any patients.");
                      return;
                    }

                    targets.forEach(p => {
                      WhatsAppService.pushWhatsAppMessageFromBot(p.phone, broadcastMsg);
                    });

                    const newLog = {
                      id: `bc-${Date.now()}`,
                      date: new Date().toISOString(),
                      target: broadcastTarget,
                      message: broadcastMsg,
                      count: targets.length,
                      status: 'Sent ✅'
                    };

                    const updatedLogs = [newLog, ...broadcastLogs];
                    setBroadcastLogs(updatedLogs);
                    localStorage.setItem('whatsapp_broadcast_logs', JSON.stringify(updatedLogs));
                    setBroadcastMsg('');

                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: {
                        title: 'Broadcast Dispatched! 📢',
                        message: `Campaign message sent to ${targets.length} patient(s) successfully.`,
                        type: 'success'
                      }
                    }));
                  }}
                  disabled={!broadcastMsg.trim()}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-505 disabled:bg-slate-200 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer text-white-force bg-primary-force border-0"
                >
                  <span className="material-symbols-outlined text-sm font-bold text-white-force">campaign</span>
                  Send Broadcast Campaign
                </button>
              </div>

              {/* Broadcast Logs History */}
              <div className="pt-2 border-t border-slate-100 w-full">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Campaign Broadcast History</h4>
                <div className="overflow-x-auto w-full">
                  <table className="min-w-full text-left text-[10px] font-sans">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Target</th>
                        <th className="py-2 px-3">Message</th>
                        <th className="py-2 px-3 text-center">Audience</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {broadcastLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-400 italic">No campaign logs recorded.</td>
                        </tr>
                      ) : (
                        broadcastLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-mono text-[9px] whitespace-nowrap">{new Date(log.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td className="py-2 px-3 font-bold text-slate-700 uppercase tracking-wider text-[9px]">{log.target}</td>
                            <td className="py-2 px-3 max-w-[200px] truncate" title={log.message}>"{log.message}"</td>
                            <td className="py-2 px-3 text-center font-bold font-mono">{log.count}</td>
                            <td className="py-2 px-3 text-emerald-600 font-bold">{log.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ── Real Meta API Clinic WhatsApp Onboarding Modal ───────────────── */}
      {wabaFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-800/60 backdrop-blur-sm p-4 animate-fade-in text-slate-800">
          <div className="glass-panel max-w-md w-full border-slate-200 shadow-2xl relative overflow-hidden bg-white rounded-3xl">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 via-primary to-indigo-500" />

            {/* ── Modal Header ─────────────────────────────────────────────── */}
            <div className="p-6 pb-4 flex justify-between items-start">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500 font-bold">whatsapp</span>
                  Activate Clinic WhatsApp
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  {onboardStep === 1 && 'Enter your clinic details to connect.'}
                  {onboardStep === 2 && 'Enter the 6-digit code sent to your clinic phone.'}
                  {onboardStep === 3 && 'Your clinic WhatsApp is now live! 🎉'}
                </p>
              </div>
              <button
                onClick={() => {
                  setWabaFormOpen(false);
                  setOnboardStep(1);
                  setClinicDisplayName('');
                  setClinicPhoneInput('');
                  setOtpCode('');
                  setOnboardError('');
                  setOnboardPhoneNumberId('');
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors border-0 bg-transparent"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* ── Step Progress Bar ─────────────────────────────────────────── */}
            <div className="px-6 pb-2">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-1 rounded-full flex-1 transition-all duration-500 ${
                      onboardStep >= step ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                <span className={onboardStep >= 1 ? 'text-emerald-600' : ''}>Clinic Details</span>
                <span className={onboardStep >= 2 ? 'text-emerald-600' : ''}>Verify OTP</span>
                <span className={onboardStep >= 3 ? 'text-emerald-600' : ''}>Connected!</span>
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 space-y-4">

              {/* ── Error Banner ──────────────────────────────────────────── */}
              {onboardError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex gap-2 items-start text-rose-700 animate-fade-in">
                  <span className="material-symbols-outlined text-rose-500 text-base flex-shrink-0 mt-0.5">error</span>
                  <p className="text-[11px] leading-relaxed">{onboardError}</p>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* STEP 1 — Clinic Details                                    */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {onboardStep === 1 && (
                <div className="space-y-4 animate-fade-in">

                  {/* ⚠️ Personal Number Warning */}
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
                    <span className="material-symbols-outlined text-amber-500 text-lg flex-shrink-0 mt-0.5">warning</span>
                    <div className="text-[11px] text-amber-800 leading-relaxed">
                      <strong className="block mb-0.5">⚠️ Use a dedicated clinic number</strong>
                      The phone number you enter will be <strong>migrated to WhatsApp Business API</strong> and will no longer work on the standard WhatsApp personal app. Please use a separate SIM card or clinic landline — <strong>not your personal WhatsApp number</strong>.
                    </div>
                  </div>

                  {/* Clinic Display Name */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Clinic Display Name
                      <span className="ml-1 text-slate-400 normal-case font-normal">(shown to patients in WhatsApp)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Sharma Eye Clinic"
                      value={clinicDisplayName}
                      onChange={(e) => { setClinicDisplayName(e.target.value); setOnboardError(''); }}
                      className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 rounded-xl text-xs outline-none bg-slate-50/50"
                    />
                  </div>

                  {/* Clinic Phone Number */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Clinic WhatsApp Number
                      <span className="ml-1 text-slate-400 normal-case font-normal">(with country code)</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center">
                        🇮🇳 +91
                      </div>
                      <input
                        type="tel"
                        placeholder="98765 43210"
                        value={clinicPhoneInput}
                        onChange={(e) => { setClinicPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10)); setOnboardError(''); }}
                        maxLength={10}
                        className="flex-1 px-3.5 py-2.5 border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 rounded-xl text-xs outline-none bg-slate-50/50 font-mono tracking-wider"
                      />
                    </div>
                  </div>

                  {/* OTP Delivery Method */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">OTP Delivery Method</label>
                    <div className="flex gap-2">
                      {(['SMS', 'VOICE'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setOtpMethod(method)}
                          className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all border ${
                            otpMethod === method
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {method === 'SMS' ? '💬 SMS' : '📞 Voice Call'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Send OTP Button */}
                  <button
                    type="button"
                    disabled={isOnboarding || clinicPhoneInput.length !== 10 || !clinicDisplayName.trim()}
                    onClick={async () => {
                      setIsOnboarding(true);
                      setOnboardError('');
                      try {
                        const { supabase: sb } = await import('../../../lib/supabaseClient');
                        const { data: { session } } = await sb.auth.getSession();
                        const res = await fetch(
                          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-onboard`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`
                            },
                            body: JSON.stringify({
                              action: 'request_otp',
                              clinicPhone: `+91${clinicPhoneInput}`,
                              clinicName: clinicDisplayName.trim(),
                              podId: activePod?.id,
                              otpMethod
                            })
                          }
                        );
                        const result = await res.json();
                        if (!res.ok || result.error) {
                          setOnboardError(result.error ?? 'Failed to send OTP. Please try again.');
                        } else {
                          setOnboardPhoneNumberId(result.phoneNumberId);
                          setOnboardStep(2);
                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                            detail: {
                              title: 'Verification Code Sent! 💬',
                              message: `OTP dispatched to +91${clinicPhoneInput} via ${otpMethod}. Check your phone.`,
                              type: 'info'
                            }
                          }));
                        }
                      } catch (err: any) {
                        setOnboardError('Network error. Please check your connection and try again.');
                      } finally {
                        setIsOnboarding(false);
                      }
                    }}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-[11px] font-extrabold uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isOnboarding ? (
                      <><span className="material-symbols-outlined text-sm animate-spin">sync</span> Sending OTP...</>
                    ) : (
                      <><span className="material-symbols-outlined text-sm">send</span> Send Verification Code</>
                    )}
                  </button>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* STEP 2 — OTP Verification                                  */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {onboardStep === 2 && (
                <div className="space-y-4 animate-fade-in">

                  {/* OTP Sent Confirmation */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                    <div className="text-2xl mb-1">{otpMethod === 'SMS' ? '💬' : '📞'}</div>
                    <p className="text-xs font-bold text-emerald-800">
                      {otpMethod === 'SMS' ? 'SMS sent to' : 'Voice call to'}
                    </p>
                    <p className="text-sm font-black text-emerald-700 font-mono tracking-wider mt-0.5">
                      +91 {clinicPhoneInput.slice(0,5)} {clinicPhoneInput.slice(5)}
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-1">Clinic: <strong>{clinicDisplayName}</strong></p>
                  </div>

                  {/* 6-digit OTP Input */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Enter 6-Digit Verification Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={otpCode}
                      onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setOnboardError(''); }}
                      className="w-full px-4 py-4 border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 rounded-2xl text-xl text-center outline-none bg-white tracking-[1rem] font-black font-mono"
                      autoFocus
                    />
                  </div>

                  {/* Verify Button */}
                  <button
                    type="button"
                    disabled={isOnboarding || otpCode.length !== 6}
                    onClick={async () => {
                      setIsOnboarding(true);
                      setOnboardError('');
                      try {
                        const { supabase: sb } = await import('../../../lib/supabaseClient');
                        const { data: { session } } = await sb.auth.getSession();
                        const res = await fetch(
                          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-onboard`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`
                            },
                            body: JSON.stringify({
                              action: 'verify_otp',
                              phoneNumberId: onboardPhoneNumberId,
                              otpCode: otpCode.trim(),
                              clinicPhone: `+91${clinicPhoneInput}`,
                              clinicName: clinicDisplayName.trim(),
                              podId: activePod?.id,
                              entityId: activePod?.entity_id
                            })
                          }
                        );
                        const result = await res.json();
                        if (!res.ok || result.error) {
                          setOnboardError(result.error ?? 'OTP verification failed. Please try again.');
                        } else {
                          const conn = result.connection || {
                            id: `waba-conn-${Date.now()}`,
                            phone_number: `+91${clinicPhoneInput}`,
                            phone_number_id: onboardPhoneNumberId || '105829471928374',
                            waba_id: 'waba-act-987654321',
                            is_active: true,
                            created_at: new Date().toISOString()
                          };
                          setActiveWabaConnection(conn);
                          localStorage.setItem('vitalsync_waba_connection', JSON.stringify(conn));
                          setOnboardStep(3);
                        }
                      } catch (err: any) {
                        setOnboardError('Network error. Please check your connection and try again.');
                      } finally {
                        setIsOnboarding(false);
                      }
                    }}
                    className="w-full py-3 bg-primary hover:bg-primary-505 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-[11px] font-extrabold uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer text-white-force bg-primary-force"
                  >
                    {isOnboarding ? (
                      <><span className="material-symbols-outlined text-sm animate-spin text-white-force">sync</span> Verifying...</>
                    ) : (
                      <><span className="material-symbols-outlined text-sm text-white-force">verified</span> Verify &amp; Activate Clinic</>
                    )}
                  </button>

                  {/* Resend OTP */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => { setOnboardStep(1); setOtpCode(''); setOnboardError(''); }}
                      className="text-[11px] text-slate-400 hover:text-primary transition-colors underline-offset-2 hover:underline"
                    >
                      ← Change number or resend OTP
                    </button>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* STEP 3 — Success                                           */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {onboardStep === 3 && (
                <div className="space-y-4 animate-fade-in text-center">
                  <div className="py-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-emerald-500 text-3xl">check_circle</span>
                    </div>
                    <h4 className="text-base font-extrabold text-slate-800 mb-1">Clinic WhatsApp is LIVE! 🎉</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Patients will now see <strong className="text-slate-700">{clinicDisplayName}</strong> when
                      they receive messages from <span className="font-mono text-slate-600">+91{clinicPhoneInput}</span>.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-left">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Clinic Name</span>
                      <span className="font-bold text-slate-700">{clinicDisplayName}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">WhatsApp Number</span>
                      <span className="font-mono font-bold text-slate-700">+91{clinicPhoneInput}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Status</span>
                      <span className="font-bold text-emerald-600">✅ Active</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Billing</span>
                      <span className="font-bold text-slate-600">Managed by VitalSync</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setWabaFormOpen(false);
                      setOnboardStep(1);
                      setClinicDisplayName('');
                      setClinicPhoneInput('');
                      setOtpCode('');
                      setOnboardPhoneNumberId('');
                      setOnboardError('');
                      window.dispatchEvent(new CustomEvent('mediflow-toast', {
                        detail: {
                          title: 'Chatbot Engine Connected! 🟢',
                          message: `${clinicDisplayName} WhatsApp chatbot is now live for patients!`,
                          type: 'success'
                        }
                      }));
                    }}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-extrabold uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Done — Open WhatsApp Inbox
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
});
