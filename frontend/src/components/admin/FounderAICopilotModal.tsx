import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Send,
  Bot,
  User,
  X,
  Zap,
  TrendingUp,
  Shield,
  Building,
  DollarSign,
  MessageSquare,
  Activity,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Copy
} from 'lucide-react';
import { FounderAICopilotService, type CopilotMessage, type CopilotActionChip } from '../../services/founderAICopilotService';

interface FounderAICopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const FounderAICopilotModal: React.FC<FounderAICopilotModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'init-1',
      sender: 'copilot',
      content: `### 👑 VitalSync Founder AI Operations Copilot\n\nNamaste Founder! I am your autonomous AI operating partner. You can manage revenue, clinic pods, self-healing audits, and customer support via plain text or voice commands.\n\n*What would you like to execute today?*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionChips: [
        { id: 'act-rev', label: 'Check Today\'s Revenue 💸', actionType: 'open_tab', payload: { tab: 'revenue' }, status: 'idle' },
        { id: 'act-sre', label: 'Run SRE Health Scan 🛡️', actionType: 'heal_schema', status: 'idle' },
        { id: 'act-pods', label: 'Review Active Pods 🏥', actionType: 'open_tab', payload: { tab: 'onboarding' }, status: 'idle' },
        { id: 'act-wa', label: 'WhatsApp Support Tickets 💬', actionType: 'open_tab', payload: { tab: 'saas_health' }, status: 'idle' }
      ]
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [executingChipId, setExecutingChipId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 150);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputPrompt;
    if (!textToSend.trim() || isProcessing) return;

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setIsProcessing(true);

    try {
      // Simulate intelligent thinking latency
      await new Promise(r => setTimeout(r, 450));
      const copilotResponse = await FounderAICopilotService.processCommand(textToSend);
      setMessages(prev => [...prev, copilotResponse]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'copilot',
          content: `⚠️ Failed to process command: ${err.message || String(err)}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteChip = async (chip: CopilotActionChip, messageId: string) => {
    if (chip.actionType === 'open_tab' && chip.payload?.tab && onNavigateTab) {
      onNavigateTab(chip.payload.tab);
      onClose();
      return;
    }

    setExecutingChipId(chip.id);
    try {
      const result = await FounderAICopilotService.executeAction(chip);
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== messageId || !m.actionChips) return m;
          return {
            ...m,
            actionChips: m.actionChips.map(c =>
              c.id === chip.id
                ? { ...c, status: result.success ? 'success' : 'failed', resultSummary: result.message }
                : c
            )
          };
        })
      );
    } catch {
      /* ignore */
    } finally {
      setExecutingChipId(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl max-w-2xl w-full h-[90vh] sm:h-[82vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* ── Top Header ────────────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-cyan-50/80 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-cyan-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <Bot className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                Founder AI Operations Copilot
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/40 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Solo Founder Agent
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Autonomous 24/7 Chief of Staff & Operations Orchestrator
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Quick Suggestions Bar ─────────────────────────────────────────────── */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Quick Prompts:
          </span>
          {[
            { label: '💸 Today\'s Revenue', query: 'Show me today\'s revenue and platform fee' },
            { label: '🛡️ SRE Health Scan', query: 'Run system health audit and check node latency' },
            { label: '🏥 Active Clinic Pods', query: 'Show active clinic pods and SLA uptime' },
            { label: '💊 Pharmacy Stock', query: 'Check pharmacy inventory and low stock batches' }
          ].map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(item.query)}
              className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all shrink-0"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* ── Message Chat Stream ───────────────────────────────────────────────── */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/40 dark:bg-slate-900/60">
          {messages.map(msg => {
            const isCopilot = msg.sender === 'copilot';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isCopilot ? 'items-start' : 'items-start flex-row-reverse'}`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs ${
                    isCopilot
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                      : 'bg-gradient-to-br from-slate-700 to-slate-900'
                  }`}
                >
                  {isCopilot ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>

                <div className={`space-y-2 max-w-[85%] sm:max-w-[78%] ${isCopilot ? '' : 'text-right'}`}>
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isCopilot
                        ? 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-zinc-100 shadow-sm'
                        : 'bg-indigo-600 text-white rounded-tr-xs shadow-md shadow-indigo-600/15'
                    }`}
                  >
                    <div className="whitespace-pre-line prose prose-xs dark:prose-invert font-sans">
                      {msg.content}
                    </div>

                    {/* Interactive Data Cards */}
                    {msg.dataCards && msg.dataCards.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                        {msg.dataCards.map((card, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-700/60"
                          >
                            <div className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">
                              {card.title}
                            </div>
                            <div className="text-sm font-black text-slate-800 dark:text-white mt-0.5">
                              {card.value}
                            </div>
                            {card.subtitle && (
                              <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                                {card.subtitle}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Execution Chips */}
                    {msg.actionChips && msg.actionChips.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                        {msg.actionChips.map(chip => {
                          const isExecuting = executingChipId === chip.id;
                          const isDone = chip.status === 'success';
                          return (
                            <button
                              key={chip.id}
                              type="button"
                              disabled={isExecuting || isDone}
                              onClick={() => handleExecuteChip(chip, msg.id)}
                              className={`px-3 py-1.5 rounded-xl text-[10.5px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs ${
                                isDone
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
                              }`}
                            >
                              {isExecuting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                              ) : isDone ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Zap className="h-3.5 w-3.5 text-amber-500" />
                              )}
                              <span>{isDone ? `${chip.label} (Done ✅)` : chip.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="text-[9.5px] text-slate-400 font-mono px-1">
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {isProcessing && (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 font-medium flex items-center gap-2 shadow-xs">
                <span>Executing multi-service intelligence query...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Box & Send Button ───────────────────────────────────────────── */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 sm:p-4 border-t border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900 flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Ask anything: 'Show revenue', 'Run auto-heal', 'Invite Dr. Sharma'..."
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl py-2.5 px-4 text-xs font-semibold text-slate-800 dark:text-white outline-none transition-all"
          />

          <button
            type="submit"
            disabled={!inputPrompt.trim() || isProcessing}
            className="h-10 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 shrink-0"
          >
            <span>Send</span>
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>

      </div>
    </div>,
    document.body
  );
};
