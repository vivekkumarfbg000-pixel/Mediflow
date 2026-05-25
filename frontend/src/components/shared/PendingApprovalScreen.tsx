import React from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Clock, ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';

interface PendingApprovalScreenProps {
  onSignOut: () => void;
}

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({ onSignOut }) => {
  const { activeEntity, isLoading } = useClinic();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      onSignOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-clinical-900 text-clinical-100 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Neon Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-500/5 blur-[120px] pointer-events-none animate-pulse-subtle"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none animate-pulse-subtle"></div>

      <div className="w-full max-w-lg glass-panel p-8 shadow-xl flex flex-col space-y-6 text-center z-10">
        
        {/* Pulsing Status Icon */}
        <div className="mx-auto relative">
          <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/20 relative z-10 animate-pulse">
            <Clock className="h-10 w-10 text-amber-400" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-amber-500/20 blur-md scale-110 pointer-events-none animate-ping opacity-30"></div>
        </div>

        <div className="space-y-3">
          <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 uppercase tracking-widest inline-block">
            Pending Doctor Approval
          </span>
          <h3 className="text-2xl font-extrabold text-white">Awaiting Node Verification</h3>
          <p className="text-sm text-clinical-300">
            Your connection request was successfully submitted and is currently being reviewed by the clinic administrator.
          </p>
        </div>

        {activeEntity && (
          <div className="bg-clinical-900/80 border border-clinical-800 rounded-2xl p-5 text-left space-y-3">
            <div className="flex justify-between items-center border-b border-clinical-800/80 pb-2.5">
              <span className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest">
                Partner Node Detail
              </span>
              <span className="text-xs font-black text-cyan-400 uppercase font-sans">
                {activeEntity.entityType}
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-clinical-400 block font-semibold">Registered Entity Name:</span>
                <strong className="text-white text-sm font-bold">{activeEntity.name}</strong>
              </div>
              {activeEntity.phone && (
                <div>
                  <span className="text-clinical-400 block font-semibold">Contact Phone:</span>
                  <span className="text-white font-medium">{activeEntity.phone}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-clinical-400 leading-relaxed bg-clinical-900/40 p-4 rounded-xl border border-clinical-800/50 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <p className="text-left font-medium">
            Once the clinic doctor approves this node on their dashboard, this screen will **automatically unlock** in real-time to load your workspace dashboard.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex-1 py-3 px-4 btn-secondary rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" /> Log Out
          </button>
          
          {isLoading && (
            <div className="flex items-center justify-center p-2">
              <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
