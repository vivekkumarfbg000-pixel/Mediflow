import React from 'react';
import { AuthGateway } from './AuthGateway';
import { BrandMark } from './BrandMark';
import {
  Shield, Activity, Building2, Users, Layers, Zap, Clock, ChevronRight, Terminal, GitBranch, Lock, ArrowRight, Sparkles
} from 'lucide-react';

interface LandingPageProps {
  onAuthSuccess: (session: any, profile: any) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onAuthSuccess }) => {
  
  // Smooth scroll helper for landing CTAs
  const scrollToGate = (e: React.MouseEvent) => {
    e.preventDefault();
    const gate = document.getElementById('gate');
    if (gate) {
      gate.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="min-h-screen bg-warmGray-50 text-warmGray-900 font-sans relative overflow-x-hidden bg-paper-texture">

      {/* Organic blobs and texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage: `radial-gradient(ellipse 800px 600px at 20% -10%, rgba(140,165,155,0.15) 0%, transparent 70%),
                            radial-gradient(ellipse 600px 500px at 80% 90%, rgba(226,139,123,0.1) 0%, transparent 70%)`
        }}
      />

      {/* Premium Sticky Glass Header */}
      <header className="sticky top-0 z-50 border-b border-warmGray-200/40 bg-white/70 backdrop-blur-md shadow-sm shadow-warmGray-200/5 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-gradient-to-br from-terracotta-500 to-terracotta-600 overflow-hidden shadow-md shadow-terracotta-500/20">
              <BrandMark size={34} title="Mediflow logo" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-serif font-extrabold text-warmGray-900 tracking-wide">Mediflow</span>
              <span className="text-[10px] text-warmGray-500 font-sans font-semibold mt-0.5">care loop v1.0</span>
            </div>
          </div>

          {/* Premium Nav links with hover underlines */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-semibold text-warmGray-600 hover:text-terracotta-600 transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-terracotta-500 after:transition-all hover:after:w-full">
              Features
            </a>
            <a href="#onboarding" className="text-sm font-semibold text-warmGray-600 hover:text-terracotta-600 transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-terracotta-500 after:transition-all hover:after:w-full">
              How it works
            </a>
            <a
              href="#gate"
              onClick={scrollToGate}
              className="text-sm font-semibold text-warmGray-600 hover:text-terracotta-600 transition-colors px-3 py-2 rounded-xl hover:bg-warmGray-100/50"
            >
              Sign In
            </a>
            <a
              href="#gate"
              onClick={scrollToGate}
              className="text-sm font-extrabold px-5 py-2.5 rounded-xl bg-gradient-to-r from-terracotta-500 to-terracotta-600 hover:from-terracotta-600 hover:to-terracotta-700 hover:scale-[1.02] active:scale-[0.98] text-white transition-all shadow-md shadow-terracotta-500/20"
            >
              Get Started
            </a>
          </nav>
        </div>
      </header>

      {/* Dynamic Background Mesh Grid & Glow Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[5%] w-[450px] h-[450px] rounded-full bg-cyan-400/5 blur-[120px] animate-pulse-subtle" />
        <div className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[130px] animate-pulse-subtle" style={{ animationDelay: '3s' }} />
        
        <svg className="absolute inset-0 w-full h-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <style>{`
        @keyframes pulse-flow {
          0% { left: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        .animate-pulse-flow {
          animation: pulse-flow 2.5s infinite linear;
        }
        .animate-pulse-flow-delay {
          animation: pulse-flow 2.5s infinite linear;
          animation-delay: 1.25s;
        }
      `}</style>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-12 lg:pt-20 lg:pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start relative z-10">

        {/* Left column: Branding, Value Prop & Graphic Assets */}
        <div className="lg:col-span-6 flex flex-col space-y-7 relative mt-4">
          {/* Version badge */}
          <div className="inline-flex items-center gap-2 self-start -rotate-1">
            <span className="font-serif italic text-[12px] text-terracotta-700 bg-terracotta-50 border border-terracotta-200 px-3.5 py-1 rounded-full shadow-sm">
              v1.0.0-stable
            </span>
            <span className="text-[11px] text-warmGray-500 font-bold tracking-wide">· beautifully deployed</span>
          </div>

          <div className="space-y-5">
            <h1 className="text-4xl lg:text-[3.25rem] font-serif font-black text-warmGray-900 leading-[1.1] tracking-tight">
              Clinical software for<br />
              <span className="text-terracotta-600 italic">
                small clinic networks
              </span>
            </h1>

            <p className="text-base text-warmGray-600 leading-relaxed max-w-lg font-sans font-medium">
              Mediflow connects your clinic, pharmacy, and pathology lab under a single secure care loop. 
              Prescriptions flow directly to the pharmacist. Lab reports land in the doctor's queue. 
              Billing is split automatically.
            </p>
          </div>

          {/* Premium Illustration Showcase */}
          <div className="max-w-lg relative rounded-3xl overflow-hidden border border-warmGray-200/60 bg-white shadow-lg shadow-warmGray-200/20 group hover:shadow-xl transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/10 to-transparent opacity-85 pointer-events-none z-10" />
            <img 
              src="/src/assets/hero.png" 
              alt="Mediflow Care Network Connected Loop Illustration" 
              className="w-full h-auto object-cover transform scale-100 group-hover:scale-[1.03] transition-transform duration-700"
            />
            <div className="absolute bottom-6 left-6 right-6 z-20 text-white">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/50 border border-cyan-500/30 px-2.5 py-1 rounded-full backdrop-blur-sm">
                <Sparkles className="h-3 w-3" /> Unified Ecosystem
              </span>
              <h3 className="text-lg font-serif font-extrabold mt-2 tracking-wide">Connect Clinic, Pharmacy, and Lab</h3>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed font-sans font-medium">
                Experience seamless split-billing and direct clinical data synchronizations in one unified loop.
              </p>
            </div>
          </div>

          {/* Two quick feature callouts */}
          <div className="space-y-4 max-w-lg">
            <div className="flex items-start gap-4 p-4.5 rounded-2xl bg-white border border-warmGray-200/80 hover:shadow-md hover:-rotate-1 transition-all duration-300">
              <div className="p-2.5 bg-sage-50 rounded-xl shrink-0">
                <Lock className="h-4.5 w-4.5 text-sage-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-warmGray-900 font-serif">Row-level security by default</p>
                <p className="text-xs text-warmGray-500 mt-1 leading-relaxed font-medium">Each clinic's data is isolated at the database level using Postgres RLS. Zero cross-tenant data leaks.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4.5 rounded-2xl bg-white border border-warmGray-200/80 hover:shadow-md hover:rotate-1 transition-all duration-300">
              <div className="p-2.5 bg-terracotta-50 rounded-xl shrink-0">
                <GitBranch className="h-4.5 w-4.5 text-terracotta-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-warmGray-900 font-serif">Multi-role, one codebase</p>
                <p className="text-xs text-warmGray-500 mt-1 leading-relaxed font-medium">Doctor, compounder, lab tech, pharmacist, and admin — each see a customized dashboard based on their profile role.</p>
              </div>
            </div>
          </div>

          {/* Animated Connected Care Loop Diagram */}
          <div className="max-w-lg bg-white/50 backdrop-blur-sm border border-warmGray-200/60 rounded-3xl p-6 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-500">
            <div className="absolute top-0 right-0 p-3 text-[9px] font-mono font-bold text-cyan-600 bg-cyan-50/60 border-b border-l border-warmGray-200/40 rounded-bl-xl uppercase tracking-wider">
              Live Loop Activity
            </div>
            
            <h4 className="text-xs font-bold text-warmGray-900 uppercase tracking-widest mb-5 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
              Ecosystem Data Flow
            </h4>

            <div className="flex items-center justify-between gap-4 relative">
              <div className="flex flex-col items-center text-center space-y-2 z-10">
                <div className="h-11 w-11 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 shadow-sm transition-transform group-hover:scale-105 duration-300">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold text-warmGray-700">Doctor</span>
                <span className="text-[8px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Active</span>
              </div>

              {/* Connecting line 1 */}
              <div className="flex-1 h-0.5 border-t border-dashed border-warmGray-300 relative">
                <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-cyan-500 -translate-y-1/2 animate-pulse-flow" />
              </div>

              <div className="flex flex-col items-center text-center space-y-2 z-10">
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm transition-transform group-hover:scale-105 duration-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold text-warmGray-700">Pharmacy</span>
                <span className="text-[8px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Synced</span>
              </div>

              {/* Connecting line 2 */}
              <div className="flex-1 h-0.5 border-t border-dashed border-warmGray-300 relative">
                <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-indigo-500 -translate-y-1/2 animate-pulse-flow-delay" />
              </div>

              <div className="flex flex-col items-center text-center space-y-2 z-10">
                <div className="h-11 w-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-sm transition-transform group-hover:scale-105 duration-300">
                  <Layers className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold text-warmGray-700">Pathology</span>
                <span className="text-[8px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Auth card container */}
        <div id="gate" className="lg:col-span-6 mt-8 lg:mt-0 relative hover:scale-[1.01] transition-transform duration-500">
          <div className="absolute -inset-4 bg-terracotta-100/50 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] blur-2xl opacity-60 pointer-events-none" />
          <div className="relative bg-white border border-warmGray-200/80 rounded-3xl overflow-hidden shadow-xl p-2.5">
            <div className="rounded-[1.25rem] overflow-hidden bg-warmGray-50 border border-warmGray-100/50">
              <AuthGateway onAuthSuccess={onAuthSuccess} />
            </div>
          </div>
        </div>
      </section>


      {/* Features section */}
      <section id="features" className="py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-serif font-bold text-warmGray-900 mb-3">What's in the system</h2>
            <p className="text-warmGray-500 font-medium">Four role-specific interfaces, one connected backend.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-organic-2 bg-white border border-warmGray-200 hover:border-sage-400/50 hover:shadow-lg hover:-translate-y-1 transition-all group">
              <div className="w-10 h-10 rounded-organic-1 bg-sage-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Activity className="h-5 w-5 text-sage-600" />
              </div>
              <h3 className="text-base font-serif font-bold text-warmGray-900 mb-2">Doctor's Dashboard</h3>
              <p className="text-sm text-warmGray-500 leading-relaxed font-sans">
                Patient queue, prescription writer, lab order panel, and WhatsApp message simulator for patient communication.
              </p>
            </div>

            <div className="p-6 rounded-organic-3 bg-white border border-warmGray-200 hover:border-terracotta-400/50 hover:shadow-lg hover:-translate-y-1 transition-all group mt-2 lg:mt-6">
              <div className="w-10 h-10 rounded-organic-2 bg-terracotta-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Layers className="h-5 w-5 text-terracotta-600" />
              </div>
              <h3 className="text-base font-serif font-bold text-warmGray-900 mb-2">Pathology Lab</h3>
              <p className="text-sm text-warmGray-500 leading-relaxed font-sans">
                Incoming test requisitions, digital report uploads, and direct file injection into the clinic's patient records.
              </p>
            </div>

            <div className="p-6 rounded-organic-1 bg-white border border-warmGray-200 hover:border-warmGray-400/50 hover:shadow-lg hover:-translate-y-1 transition-all group lg:mt-3">
              <div className="w-10 h-10 rounded-organic-3 bg-warmGray-100 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5 text-warmGray-600" />
              </div>
              <h3 className="text-base font-serif font-bold text-warmGray-900 mb-2">Pharmacy POS</h3>
              <p className="text-sm text-warmGray-500 leading-relaxed font-sans">
                Receives prescriptions instantly, tracks inventory, handles billing with split-payment support between the clinic and pharmacy.
              </p>
            </div>

            <div className="p-6 rounded-organic-2 bg-white border border-warmGray-200 hover:border-sage-400/50 hover:shadow-lg hover:-translate-y-1 transition-all group mt-1 lg:mt-8">
              <div className="w-10 h-10 rounded-organic-1 bg-sage-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Terminal className="h-5 w-5 text-sage-600" />
              </div>
              <h3 className="text-base font-serif font-bold text-warmGray-900 mb-2">Auto-Healer</h3>
              <p className="text-sm text-warmGray-500 leading-relaxed font-sans">
                Background telemetry agent that detects stuck states, retries failed DB operations and keeps the app healthy 24/7.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works / Onboarding */}
      <section id="onboarding" className="py-20 relative z-10 bg-warmGray-100/50 border-t border-warmGray-200/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-serif font-bold text-warmGray-900 mb-3">Getting your clinic set up</h2>
            <p className="text-warmGray-500 font-medium">Takes about 5 minutes if everyone has their login details ready.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Connector line (desktop only) */}
            <div className="hidden md:block absolute top-6 left-[12%] right-[12%] h-px border-t-2 border-dashed border-warmGray-300 pointer-events-none" />

            {[
              {
                step: '01',
                title: 'Doctor registers',
                desc: "Sign up using the Doctor tab. You'll get a clinic code (e.g. MF-556D) after registration. Keep it handy.",
                color: 'text-sage-700',
                bg: 'bg-sage-100',
                border: 'border-sage-200'
              },
              {
                step: '02',
                title: 'Share the code',
                desc: 'Copy the clinic code from your dashboard settings and send it to your pharmacist and lab technician.',
                color: 'text-terracotta-700',
                bg: 'bg-terracotta-100',
                border: 'border-terracotta-200'
              },
              {
                step: '03',
                title: 'Partners sign up',
                desc: "Pharmacists and lab techs register using the Partner tab and paste the clinic code to link their account.",
                color: 'text-warmGray-700',
                bg: 'bg-warmGray-200',
                border: 'border-warmGray-300'
              },
              {
                step: '04',
                title: 'Approve and go live',
                desc: 'Once you approve the connection requests in your settings, the full prescription and billing loop goes live.',
                color: 'text-sage-700',
                bg: 'bg-sage-100',
                border: 'border-sage-200'
              }
            ].map(({ step, title, desc, color, bg, border }, idx) => (
              <div key={step} className={`flex flex-col gap-4 relative ${idx % 2 !== 0 ? 'md:mt-6' : ''}`}>
                <div className={`w-12 h-12 rounded-organic-${(idx % 3) + 1} ${bg} border ${border} flex items-center justify-center font-serif text-sm font-bold ${color} z-10 shadow-sm mx-auto md:mx-0`}>
                  {step}
                </div>
                <div className="text-center md:text-left">
                  <h4 className="text-base font-serif font-bold text-warmGray-900 mb-1">{title}</h4>
                  <p className="text-sm text-warmGray-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Small CTA at the bottom of onboarding */}
          <div className="mt-16 p-6 rounded-organic-2 bg-white border border-warmGray-200 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm rotate-1 hover:rotate-0 transition-transform">
            <div className="text-center sm:text-left">
              <p className="text-lg font-serif font-bold text-warmGray-900">Ready to connect your clinic?</p>
              <p className="text-sm text-warmGray-500 mt-1">Scroll up to the sign-in panel and use the Doctor tab to get started.</p>
            </div>
            <a
              href="#gate"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-organic-1 bg-terracotta-500 text-white font-medium hover:bg-terracotta-600 hover:-rotate-2 transition-all whitespace-nowrap shadow-md"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 relative z-10 bg-warmGray-900 text-warmGray-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-medium">
          <span>© {new Date().getFullYear()} Mediflow Care Ecosystem</span>
          <div className="flex items-center gap-4">
            <span className="font-serif italic text-terracotta-400">crafted with care</span>
            <span className="w-1.5 h-1.5 rounded-full bg-warmGray-600" />
            <span className="font-mono text-xs">v1.0.0</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
