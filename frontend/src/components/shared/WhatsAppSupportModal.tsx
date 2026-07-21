import React, { useState } from 'react';
import { MessageSquare, Send, Sparkles, RefreshCw, X, ShieldAlert, CheckCircle, HelpCircle } from 'lucide-react';
import { WhatsAppSupportBotService } from '../../services/whatsappSupportBotService';

interface Props {
  userRole?: 'doctor' | 'compounder' | 'pharmacy' | 'patient';
  userName?: string;
  clinicName?: string;
}

export const WhatsAppSupportModal: React.FC<Props> = ({
  userRole = 'doctor',
  userName = 'Dr. User',
  clinicName = 'Mediflow Care Clinic'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'bot'; text: string; category?: string }>>([
    {
      sender: 'bot',
      text: `🤖 *Namaste ${userName}!* I am your 24/7 VitalSync Autonomous AI Support Sentry.\n\nAsk me how to use any feature, or report a glitch for instant auto-healing!`
    }
  ]);

  const handleSendQuery = async (textToSend?: string) => {
    const text = textToSend || queryText;
    if (!text.trim() || isProcessing) return;

    setChatHistory(prev => [...prev, { sender: 'user', text }]);
    if (!textToSend) setQueryText('');
    setIsProcessing(true);

    try {
      const result = await WhatsAppSupportBotService.processSupportQuery(text, {
        name: userName,
        clinicName: clinicName,
        role: userRole
      });

      setChatHistory(prev => [...prev, { sender: 'bot', text: result.response, category: result.category }]);
    } catch (_e) {
      setChatHistory(prev => [
        ...prev,
        { sender: 'bot', text: '⚠️ Connection error. Please refresh your dashboard or try again.' }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* ── Floating WhatsApp Support Badge ───────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-[9990] h-14 w-14 rounded-full bg-gradient-to-tr from-emerald-600 to-green-500 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-2xl shadow-emerald-600/40 cursor-pointer border-2 border-white/20 transition-all group"
        title="Open 24/7 Mediflow AI WhatsApp Support"
      >
        <MessageSquare className="h-6 w-6 group-hover:rotate-12 transition-transform" />
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-400 border-2 border-white animate-pulse" />
      </button>

      {/* ── Support Drawer Modal ──────────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in text-slate-800">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full h-[600px] flex flex-col relative overflow-hidden">
            
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-bold">
                  <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm flex items-center gap-2">
                    VitalSync AI WhatsApp Support
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-[9px] font-black uppercase text-emerald-200 border border-emerald-400/30">
                      24/7 RAG Agent
                    </span>
                  </h3>
                  <p className="text-[10px] text-emerald-100 font-medium">Auto-Healer & RAG Knowledge Base Active</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Prompt Pills */}
            <div className="p-3 bg-slate-50 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              {[
                { label: '📋 Prescriptions Guide', query: 'How to use 1-Tap Prescriptions and AI Scribe?' },
                { label: '🎫 Queue & Tokens', query: 'How to manage token queue and pending payments?' },
                { label: '🛠️ Auto-Heal System', query: 'System stuck, please scan and auto-heal error' },
                { label: '🚨 Owner Escalation', query: 'Need Cashfree credential approval from platform owner' },
              ].map(pill => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => handleSendQuery(pill.query)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 text-[10px] font-bold text-slate-600 uppercase tracking-wider shrink-0 transition-all cursor-pointer shadow-2xs"
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap font-sans ${
                      msg.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
                        : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.category === 'auto_healed' && (
                    <span className="mt-1 text-[9px] font-bold text-emerald-600 flex items-center gap-1 uppercase tracking-wider">
                      <CheckCircle className="h-3 w-3" /> Auto-Heal Triggered (240ms)
                    </span>
                  )}
                  {msg.category === 'owner_escalation' && (
                    <span className="mt-1 text-[9px] font-bold text-amber-600 flex items-center gap-1 uppercase tracking-wider">
                      <ShieldAlert className="h-3 w-3" /> Ticket Escalated to SaaS Admin Cockpit
                    </span>
                  )}
                </div>
              ))}

              {isProcessing && (
                <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold p-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                  <span>AI Support Sentry processing query...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendQuery()}
                placeholder="Type query or describe any system issue..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-xs font-semibold bg-slate-50"
              />
              <button
                type="button"
                onClick={() => handleSendQuery()}
                disabled={!queryText.trim() || isProcessing}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center cursor-pointer shadow-md transition-all shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
