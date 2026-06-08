import React from 'react';
import { AuthGateway } from './AuthGateway';
import { BrandMark } from './BrandMark';
import { 
  Shield, Activity, Building2, Key, Users, Layers, Zap, Clock, ChevronRight
} from 'lucide-react';

interface LandingPageProps {
  onAuthSuccess: (session: any, profile: any) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onAuthSuccess }) => {
  return (
    <div className="min-h-screen bg-clinical-900 text-clinical-100 font-sans relative overflow-x-hidden">
      
      {/* Background Glow Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[150px] pointer-events-none animate-pulse-subtle"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[180px] pointer-events-none animate-pulse-subtle" style={{ animationDelay: '3s' }}></div>

      {/* Sticky Premium Navigation Header */}
      <header className="sticky top-0 z-50 bg-clinical-950/80 backdrop-blur-xl border-b border-clinical-800/80 px-6 py-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white p-0.5 shadow-md ring-1 ring-slate-200/40">
              <BrandMark size={36} title="Mediflow Care logo" />
            </div>
            <div>
              <span className="text-lg font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400">
                MEDIFLOW
              </span>
              <span className="text-[8px] tracking-[0.25em] font-black text-cyan-500 uppercase block leading-none">
                Care Loop Ecosystem
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-clinical-400">
            <a href="#features" className="hover:text-white hover:scale-105 transition-all">Features</a>
            <a href="#onboarding" className="hover:text-white hover:scale-105 transition-all">Onboarding Steps</a>
            <a href="#gate" className="px-4 py-2 bg-clinical-800/50 hover:bg-clinical-800 border border-clinical-700/80 rounded-xl hover:text-cyan-400 hover:border-cyan-500/30 transition-all shadow-inner">
              Sign In / Access
            </a>
          </nav>
        </div>
      </header>

      {/* Hero split-grid section */}
      <section className="max-w-7xl mx-auto px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Grid: Value Proposition & Onboarding Guide */}
        <div className="lg:col-span-5 flex flex-col justify-center text-left space-y-8 animate-fade-in">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 rounded-full px-4.5 py-1.5 text-[9px] font-black uppercase tracking-widest leading-none">
              <Zap className="h-3 w-3 animate-pulse" /> Production Ready v1.0.0
            </div>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.15]">
              Unified Digital Care Loops, <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400">
                Re-imagined.
              </span>
            </h1>
            <p className="text-sm lg:text-base text-clinical-300 leading-relaxed font-medium">
              A state-of-the-art multi-tenant ecosystem connecting independent clinics, adjacent pharmacies, and referral pathology labs under one secure, split-billed digital workflow.
            </p>
          </div>

          {/* Quick value statements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex gap-3 bg-clinical-950/40 border border-clinical-850 p-4 rounded-2xl shadow-sm hover:scale-[1.02] transition-all">
              <Shield className="h-5 w-5 text-cyan-400 shrink-0" />
              <div className="space-y-1">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Secure RLS Isolation</h4>
                <p className="text-[11px] text-clinical-400 leading-snug">Multi-tenant Row-Level Security secures client pods.</p>
              </div>
            </div>

            <div className="flex gap-3 bg-clinical-950/40 border border-clinical-850 p-4 rounded-2xl shadow-sm hover:scale-[1.02] transition-all">
              <Building2 className="h-5 w-5 text-cyan-400 shrink-0" />
              <div className="space-y-1">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Clinical Pods</h4>
                <p className="text-[11px] text-clinical-400 leading-snug">Connect one clinic with a pharmacy & pathology lab.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-clinical-800/80 pt-6">
            <a 
              href="#onboarding" 
              className="text-xs font-black text-cyan-400 hover:text-cyan-300 uppercase tracking-widest inline-flex items-center gap-1.5 group transition-colors"
            >
              See Onboarding Roadmap <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>

        {/* Right Grid: Embedded Auth Gateway */}
        <div id="gate" className="lg:col-span-7 relative flex justify-center lg:justify-end animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-indigo-500/10 rounded-3xl blur-2xl opacity-60 pointer-events-none"></div>
          <div className="w-full max-w-2xl bg-clinical-950/40 border border-clinical-800/80 rounded-3xl overflow-hidden shadow-2xl relative z-10">
            <AuthGateway onAuthSuccess={onAuthSuccess} />
          </div>
        </div>

      </section>

      {/* Features Showcase Section */}
      <section id="features" className="bg-clinical-950/60 border-y border-clinical-850 py-20 relative z-10">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              A Complete Medical Cooperation Suite
            </h2>
            <p className="text-xs lg:text-sm text-clinical-400 leading-relaxed font-semibold">
              Mediflow coordinates critical clinical data flows synchronously, enabling high-performance cooperation between doctors and medical practitioners.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-clinical-900/40 border border-clinical-850 p-6 rounded-2xl flex flex-col space-y-3 hover:scale-[1.01] transition-all">
              <Activity className="h-8 w-8 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Clinicians & Doctors</h3>
              <p className="text-xs text-clinical-400 leading-relaxed font-medium">
                Detailed CDSS dashboards, prescribing, pathology requisitions ordering, patient queue logs, and WhatsApp status simulator.
              </p>
            </div>

            <div className="bg-clinical-900/40 border border-clinical-850 p-6 rounded-2xl flex flex-col space-y-3 hover:scale-[1.01] transition-all">
              <Layers className="h-8 w-8 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pathology Labs</h3>
              <p className="text-xs text-clinical-400 leading-relaxed font-medium">
                Automated incoming requisition logs, digital test report generation, and real-time medical files upload directly into clinic records.
              </p>
            </div>

            <div className="bg-clinical-900/40 border border-clinical-850 p-6 rounded-2xl flex flex-col space-y-3 hover:scale-[1.01] transition-all">
              <Users className="h-8 w-8 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pharmacy POS</h3>
              <p className="text-xs text-clinical-400 leading-relaxed font-medium">
                Instantly receives digital prescriptions, manages real-time billing inventories, and completes orders.
              </p>
            </div>

            <div className="bg-clinical-900/40 border border-clinical-850 p-6 rounded-2xl flex flex-col space-y-3 hover:scale-[1.01] transition-all">
              <Clock className="h-8 w-8 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Auto-Healer CDSS</h3>
              <p className="text-xs text-clinical-400 leading-relaxed font-medium">
                Autonomous system checks, telemetry recording, database repairs, and circuit-breaker safeguards for 24/7 uptime.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Onboarding Steps Section */}
      <section id="onboarding" className="py-20 relative z-10">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Onboard Your Clinic Node in 4 Steps
            </h2>
            <p className="text-xs lg:text-sm text-clinical-400 leading-relaxed font-semibold">
              Mediflow operates as a decentralized network node. Follow these steps to link your diagnostic lab and pharmacy POS to your clinic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Step 1 */}
            <div className="space-y-4 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-xs font-black text-cyan-400 font-mono shadow-md">
                01
              </div>
              <h4 className="text-xs font-black uppercase text-white tracking-wider">Initialize Clinical Pod</h4>
              <p className="text-xs text-clinical-400 leading-relaxed font-medium">
                The doctor registers their clinic in the "Doctor Signup" tab, initializing a new node and receiving a unique Clinic Network Code (e.g. `MF-556D`).
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-xs font-black text-cyan-400 font-mono shadow-md">
                02
              </div>
              <h4 className="text-xs font-black uppercase text-white tracking-wider">Distribute Network Code</h4>
              <p className="text-xs text-clinical-400 leading-relaxed font-medium">
                The doctor copies the Clinic Code and shares it directly with their partner laboratory technicians and pharmacist staff.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-xs font-black text-cyan-400 font-mono shadow-md">
                03
              </div>
              <h4 className="text-xs font-black uppercase text-white tracking-wider">Partner Request</h4>
              <p className="text-xs text-clinical-400 leading-relaxed font-medium">
                Pharmacists and Lab technicians sign up on the "Partner Sign In" tab, inputting the Doctor's clinic code to request a secure data bridge.
              </p>
            </div>

            {/* Step 4 */}
            <div className="space-y-4 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-xs font-black text-cyan-400 font-mono shadow-md">
                04
              </div>
              <h4 className="text-xs font-black uppercase text-white tracking-wider">Approval & Activation</h4>
              <p className="text-xs text-clinical-400 leading-relaxed font-medium">
                The Doctor approves the connection requests inside the clinic settings panel. The billing splits and prescription loop activate instantly!
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-clinical-850/80 bg-clinical-950/80 py-8 px-6 relative z-10 text-center text-[10px] text-clinical-500 font-bold uppercase tracking-widest">
        &copy; {new Date().getFullYear()} Mediflow Connected Care Ecosystem. All Rights Reserved.
      </footer>

    </div>
  );
};
