import React, { useState } from 'react';
import { 
  Building2, 
  HeartPulse, 
  Stethoscope, 
  Pill, 
  TestTube2, 
  ShieldCheck, 
  TrendingUp, 
  Printer, 
  MessageSquare, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2, 
  Coins, 
  Clock, 
  Scale, 
  Zap, 
  Award,
  Calendar,
  AlertTriangle,
  QrCode,
  FileText,
  UserCheck,
  Sliders,
  PhoneCall,
  Mail,
  DollarSign,
  Layers,
  Activity,
  Receipt,
  HelpCircle,
  Video,
  ShieldAlert,
  Smartphone,
  Check,
  Eye,
  Crosshair,
  Lock,
  Users,
  Target,
  BadgePercent,
  ChevronRight,
  Maximize2,
  FileSpreadsheet
} from 'lucide-react';

export const DoctorPitchDeckPrintPage: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState<number>(1);
  const totalSlides = 10;

  const handlePrint = () => {
    window.print();
  };

  const nextSlide = () => {
    setActiveSlide((prev) => (prev < totalSlides ? prev + 1 : prev));
  };

  const prevSlide = () => {
    setActiveSlide((prev) => (prev > 1 ? prev - 1 : prev));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 print:bg-white print:text-black font-sans antialiased selection:bg-emerald-500 selection:text-white pb-16">
      
      {/* ── Top Executive Presentation Controller (Hidden in Print Mode) ── */}
      <header className="sticky top-0 z-50 print:hidden bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-6 py-3.5 shadow-2xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                <span>VitalSync</span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">Executive Briefing</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Virtual Hospital Network • Strategic Doctor Partnership Proposal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/60">
              <button
                onClick={prevSlide}
                disabled={activeSlide === 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer border-0"
                title="Previous Slide"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-mono font-bold text-emerald-400">
                {String(activeSlide).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
              </span>
              <button
                onClick={nextSlide}
                disabled={activeSlide === totalSlides}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer border-0"
                title="Next Slide"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2 cursor-pointer border-0"
            >
              <Printer className="w-4 h-4" /> Print / Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* ── Slide Content Container ── */}
      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-12 print:space-y-0 print:p-0">

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 01: TITLE & STRATEGIC PROPOSITION
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-black print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none print:hidden" />

          {/* Slide Header Tag */}
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-5 mb-8">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-800/50 print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                  CONFIDENTIAL STRATEGIC PROPOSAL
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 01 / 10</span>
            </div>

            {/* Core Hero Headline */}
            <div className="space-y-4 max-w-4xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider print:bg-slate-100 print:text-emerald-800">
                <Sparkles className="w-3.5 h-3.5" /> For Clinical Practice Leaders &amp; Specialists
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white print:text-slate-900 leading-[1.15]">
                Unify Your Practice Into An <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 print:text-emerald-700">Outpatient Network</span> On WhatsApp.
              </h1>
              <p className="text-base md:text-lg text-slate-300 print:text-slate-700 leading-relaxed font-normal pt-2">
                VitalSync links your OPD consultation room with your chosen chemist and diagnostic centre into an automated, coordinated outpatient ecosystem. Retain 100% clinical sovereignty, eliminate care dropouts, and unlock <strong className="text-white print:text-black font-semibold">+₹1,00,000 to +₹2,00,000+ monthly recurring practice value</strong> with <strong className="text-emerald-400 print:text-emerald-700 font-semibold">zero software subscription cost and zero change to your daily OPD workflow</strong>.
              </p>
            </div>
          </div>

          {/* 4 Pillars Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-slate-800 print:border-slate-200 mt-8">
            <div className="p-4 bg-slate-800/50 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Adoption Cost</div>
              <div className="text-xl font-black text-emerald-400 print:text-emerald-700 mt-1">₹0 Setup / ₹0 SaaS</div>
              <div className="text-[11px] text-slate-400 mt-0.5">100% Free Lifetime Adoption</div>
            </div>
            <div className="p-4 bg-slate-800/50 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Doctor Consultation</div>
              <div className="text-xl font-black text-white print:text-slate-900 mt-1">100% Protected</div>
              <div className="text-[11px] text-slate-400 mt-0.5">0% Platform Deductions (Rule 58)</div>
            </div>
            <div className="p-4 bg-slate-800/50 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Doctor Workflow</div>
              <div className="text-xl font-black text-teal-400 print:text-teal-700 mt-1">Zero Disruption</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Assistant manages queue &amp; vitals</div>
            </div>
            <div className="p-4 bg-slate-800/50 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Governance &amp; Law</div>
              <div className="text-xl font-black text-cyan-400 print:text-cyan-700 mt-1">NMC Compliant</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Legally recognized B2B framework</div>
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 02: THE OPD CLINICAL & FINANCIAL LEAKAGE
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-black print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-5 mb-6">
              <div className="flex items-center gap-2 text-rose-400 print:text-rose-700 text-xs font-mono font-bold uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" /> Practice Diagnosis: The Current OPD Landscape
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 02 / 10</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white print:text-slate-900 tracking-tight">
              Where 60% of Your Clinical Impact &amp; Practice Revenue Is Lost
            </h2>
            <p className="text-sm text-slate-300 print:text-slate-600 mt-2 max-w-3xl">
              You invest 15+ years building diagnostic mastery and patient trust. Yet, the moment the patient walks out of your OPD chamber, third-party retail shops capture 90% of the financial value while compromising clinical outcomes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              <div className="p-5 bg-slate-800/60 print:bg-rose-50/50 rounded-2xl border border-rose-500/20 print:border-rose-200 space-y-2">
                <div className="flex items-center gap-2.5 text-rose-400 print:text-rose-800 font-bold text-sm">
                  <Coins className="w-4 h-4 text-rose-400" /> 1. The Episodic Consultation Trap
                </div>
                <p className="text-xs text-slate-300 print:text-slate-700 leading-relaxed">
                  You diagnose and earn a single ₹500 fee. The patient subsequently spends ₹2,500 to ₹4,000 every month for 10+ years at disconnected pharmacies and labs where you have zero visibility or equity.
                </p>
              </div>

              <div className="p-5 bg-slate-800/60 print:bg-rose-50/50 rounded-2xl border border-rose-500/20 print:border-rose-200 space-y-2">
                <div className="flex items-center gap-2.5 text-rose-400 print:text-rose-800 font-bold text-sm">
                  <Pill className="w-4 h-4 text-rose-400" /> 2. Retail Generic Substitution
                </div>
                <p className="text-xs text-slate-300 print:text-slate-700 leading-relaxed">
                  Commercial retail pharmacies frequently switch your prescribed branded formulations with high-margin generic substitutes without your knowledge, compromising therapeutic recovery.
                </p>
              </div>

              <div className="p-5 bg-slate-800/60 print:bg-rose-50/50 rounded-2xl border border-rose-500/20 print:border-rose-200 space-y-2">
                <div className="flex items-center gap-2.5 text-rose-400 print:text-rose-800 font-bold text-sm">
                  <HeartPulse className="w-4 h-4 text-rose-400" /> 3. 60% Chronic Care Attrition
                </div>
                <p className="text-xs text-slate-300 print:text-slate-700 leading-relaxed">
                  Hypertensive and diabetic patients routinely forget to refill on Day 25 and skip their 90-day repeat diagnostic panels (HbA1c, Lipid profile), resulting in preventable strokes and organ damage.
                </p>
              </div>

              <div className="p-5 bg-slate-800/60 print:bg-rose-50/50 rounded-2xl border border-rose-500/20 print:border-rose-200 space-y-2">
                <div className="flex items-center gap-2.5 text-rose-400 print:text-rose-800 font-bold text-sm">
                  <Clock className="w-4 h-4 text-rose-400" /> 4. Unorganized Evening Follow-Ups
                </div>
                <p className="text-xs text-slate-300 print:text-slate-700 leading-relaxed">
                  Patients call your personal mobile number or crowd your clinic at 7:00 PM simply to show physical test printouts, overloading staff and causing patient dissatisfaction.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 print:bg-slate-100 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:border-slate-200">
            <span className="text-slate-300 print:text-slate-800 font-medium">VitalSync solves this by creating a closed, automated outpatient care loop centered around your clinic.</span>
            <span className="text-emerald-400 print:text-emerald-800 font-bold">The Strategic Solution →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 03: THE VIRTUAL HOSPITAL TRIAD
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-black print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-5 mb-6">
              <div className="flex items-center gap-2 text-emerald-400 print:text-emerald-700 text-xs font-mono font-bold uppercase tracking-wider">
                <Layers className="w-4 h-4" /> System Design: The Care Triad
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 03 / 10</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white print:text-slate-900 tracking-tight">
              The Virtual Outpatient Triad on WhatsApp
            </h2>
            <p className="text-sm text-slate-300 print:text-slate-600 mt-2 max-w-3xl">
              Connect your clinic with your preferred neighborhood pharmacy and accredited diagnostic laboratory into a unified digital hospital on WhatsApp.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              {/* Doctor */}
              <div className="p-6 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-indigo-500/30 print:border-indigo-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-indigo-950/50">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-white print:text-slate-900">1. Doctor (Clinical Authority)</h3>
                <p className="text-xs text-slate-300 print:text-slate-600 leading-relaxed">
                  Diagnoses and prescribes freely. Configures clinic revenue splits and retains 100% consultation fee income.
                </p>
                <div className="text-[11px] font-bold text-indigo-300 print:text-indigo-800 bg-indigo-950/60 print:bg-indigo-100 py-1 px-2.5 rounded-lg border border-indigo-800/50">
                  100% Free Adoption
                </div>
              </div>

              {/* Chemist */}
              <div className="p-6 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-emerald-500/30 print:border-emerald-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-950/50">
                  <Pill className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-white print:text-slate-900">2. Partner Chemist</h3>
                <p className="text-xs text-slate-300 print:text-slate-600 leading-relaxed">
                  Dispenses authentic branded medicines, manages 30-day chronic refills, and provides 10% patient discounts.
                </p>
                <div className="text-[11px] font-bold text-emerald-300 print:text-emerald-800 bg-emerald-950/60 print:bg-emerald-100 py-1 px-2.5 rounded-lg border border-emerald-800/50">
                  20%–30% Practice Split
                </div>
              </div>

              {/* Lab */}
              <div className="p-6 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-purple-500/30 print:border-purple-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-purple-950/50">
                  <TestTube2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-white print:text-slate-900">3. Partner Lab</h3>
                <p className="text-xs text-slate-300 print:text-slate-600 leading-relaxed">
                  Performs pathology &amp; diagnostic investigations, provides home sample collection, and pushes verified PDF reports to WhatsApp.
                </p>
                <div className="text-[11px] font-bold text-purple-300 print:text-purple-800 bg-purple-950/60 print:bg-purple-100 py-1 px-2.5 rounded-lg border border-purple-800/50">
                  30%–40% Practice Split
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-950/40 print:bg-emerald-50 border border-emerald-800/60 print:border-emerald-200 rounded-2xl flex items-center gap-3 text-xs mt-6">
            <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-slate-200 print:text-slate-800">
              <strong>Zero App Downloads:</strong> Patients interact directly through WhatsApp. No app installs, logins, or tech friction for rural and urban patients alike.
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 04: 100% FREE ADOPTION & FEE IMMUNITY
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-black print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-5 mb-6">
              <div className="flex items-center gap-2 text-indigo-400 print:text-indigo-700 text-xs font-mono font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" /> Financial Integrity &amp; Rule 58 / 103
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 04 / 10</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white print:text-slate-900 tracking-tight">
              100% Free Adoption &amp; Complete Fee Immunity
            </h2>
            <p className="text-sm text-slate-300 print:text-slate-600 mt-2 max-w-3xl">
              Our core operating contract: Zero SaaS subscription fees, and 100% of your OPD consultation fee goes directly into your bank account.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4.5 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 space-y-1.5">
                <div className="text-rose-400 print:text-rose-600 text-xl font-black font-mono">₹0 / month</div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Zero SaaS Overhead</h3>
                <p className="text-[11px] text-slate-300 print:text-slate-600 leading-relaxed">
                  No monthly software fees, no annual maintenance contracts, and no per-terminal licensing charges.
                </p>
              </div>

              <div className="p-4.5 bg-slate-800/60 print:bg-emerald-50 rounded-2xl border border-emerald-500/30 print:border-emerald-200 space-y-1.5">
                <div className="text-emerald-400 print:text-emerald-700 text-xl font-black font-mono">100% To Doctor</div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Consultation Immunity</h3>
                <p className="text-[11px] text-slate-300 print:text-slate-600 leading-relaxed">
                  100% of your consultation fee is credited directly to you. VitalSync never takes a cut from your medical consultation.
                </p>
              </div>

              <div className="p-4.5 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 space-y-1.5">
                <div className="text-teal-400 print:text-teal-700 text-xl font-black font-mono">Cash &amp; Digital</div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Automated Pool Settlement</h3>
                <p className="text-[11px] text-slate-300 print:text-slate-600 leading-relaxed">
                  Counter cash stays 100% in your clinic drawer. Platform reconciliation happens seamlessly via the pre-funded pool.
                </p>
              </div>
            </div>

            {/* Complete Transparency: 3% Platform Share */}
            <div className="p-5 bg-slate-950/80 print:bg-slate-100 rounded-2xl mt-5 border border-slate-800 print:border-slate-300 space-y-3">
              <div className="text-xs font-mono font-bold uppercase text-emerald-400 print:text-emerald-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Full Transparency: How VitalSync Operates (3% Technical Platform Share)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-900/90 print:bg-white rounded-xl border border-slate-800 print:border-slate-200 space-y-1">
                  <div className="font-bold text-white print:text-slate-900">1. Pharmacy Counter &amp; Refills (3%)</div>
                  <span className="text-[11px] text-slate-400 print:text-slate-600">When patients purchase medicines at the clinic counter or order 30-day refills from the partner chemist (Cash or Online).</span>
                </div>
                <div className="p-3 bg-slate-900/90 print:bg-white rounded-xl border border-slate-800 print:border-slate-200 space-y-1">
                  <div className="font-bold text-white print:text-slate-900">2. Complete Diagnostic Lab Tests (3%)</div>
                  <span className="text-[11px] text-slate-400 print:text-slate-600">When patients complete diagnostic lab investigations — pathology, biochemistry, ECG, imaging, or full panels (Cash or Online).</span>
                </div>
                <div className="p-3 bg-slate-900/90 print:bg-white rounded-xl border border-slate-800 print:border-slate-200 space-y-1">
                  <div className="font-bold text-white print:text-slate-900">3. WhatsApp Booking Fee (3%)</div>
                  <span className="text-[11px] text-slate-400 print:text-slate-600">A standard 3% digital convenience fee (e.g. ₹15 on a ₹500 consult) paid directly by online patients who book on WhatsApp.</span>
                </div>
              </div>
              <div className="text-[11px] text-emerald-400 print:text-emerald-900 pt-1">
                ✔ <strong>Automated Cash Settlement Pool:</strong> Physical cash stays in your drawer. The platform share is automatically deducted from the pre-funded Commission Pool balance (maintaining a ₹1,000 Safety Buffer).
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 print:bg-slate-100 rounded-2xl flex items-center justify-between text-xs text-slate-300 print:text-slate-700 mt-4 border border-slate-700 print:border-slate-200">
            <span>Guaranteed in our Master Service Agreement &amp; B2B Terms.</span>
            <span className="font-bold text-white print:text-slate-900">Next: Practice SOP Splits →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 05: DOCTOR-CONTROLLED DYNAMIC SPLITS
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-black print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-5 mb-6">
              <div className="flex items-center gap-2 text-teal-400 print:text-teal-700 text-xs font-mono font-bold uppercase tracking-wider">
                <Sliders className="w-4 h-4" /> Practice Governance
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 05 / 10</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white print:text-slate-900 tracking-tight">
              Doctor-Controlled Dynamic SOP Splits
            </h2>
            <p className="text-sm text-slate-300 print:text-slate-600 mt-2 max-w-3xl">
              You maintain 100% autonomy over your network economics. Set custom splits with 1 tap in your clinic SOP settings.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="p-5 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-white print:text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" /> Dynamic Practice Parameters
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center p-3 bg-slate-900 print:bg-white rounded-xl border border-slate-800 print:border-slate-200">
                    <span className="font-semibold text-slate-200 print:text-slate-800">💊 Pharmacy Medication Split</span>
                    <span className="font-mono font-bold text-emerald-400 print:text-emerald-700 bg-emerald-950/60 print:bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-800/50">20% – 30%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-900 print:bg-white rounded-xl border border-slate-800 print:border-slate-200">
                    <span className="font-semibold text-slate-200 print:text-slate-800">🔬 Pathology Diagnostic Split</span>
                    <span className="font-mono font-bold text-purple-400 print:text-purple-700 bg-purple-950/60 print:bg-purple-50 px-2.5 py-0.5 rounded border border-purple-800/50">30% – 40%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-900 print:bg-white rounded-xl border border-slate-800 print:border-slate-200">
                    <span className="font-semibold text-slate-200 print:text-slate-800">🚨 Emergency SOS Priority Fee</span>
                    <span className="font-mono font-bold text-rose-400 print:text-rose-700 bg-rose-950/60 print:bg-rose-50 px-2.5 py-0.5 rounded border border-rose-800/50">₹618.00</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-900 print:bg-white rounded-xl border border-slate-800 print:border-slate-200">
                    <span className="font-semibold text-slate-200 print:text-slate-800">🏷️ Chronic Refill Patient Loyalty Discount</span>
                    <span className="font-mono font-bold text-teal-400 print:text-teal-700 bg-teal-950/60 print:bg-teal-50 px-2.5 py-0.5 rounded border border-teal-800/50">10% OFF</span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-teal-500/30 print:border-teal-200 space-y-3">
                <h3 className="text-sm font-bold text-white print:text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-400" /> ₹1,000 Automated Safety Buffer &amp; Pool
                </h3>
                <p className="text-xs text-slate-300 print:text-slate-600 leading-relaxed">
                  All settlements are executed atomically at the Postgres database boundary into your verified bank account with zero manual accounting overhead.
                </p>
                <div className="p-3.5 bg-slate-900 print:bg-white rounded-xl border border-teal-500/30 print:border-teal-200 text-xs text-teal-300 print:text-teal-950 space-y-1.5 font-medium">
                  <div>✔ Automated direct payouts to Doctor Bank / UPI.</div>
                  <div>✔ Seamless reconciliation on counter cash collections.</div>
                  <div>✔ Complete audit ledger available in Doctor Financials tab.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 print:bg-slate-100 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:border-slate-200">
            <span className="text-slate-300 print:text-slate-700">You retain 100% freedom to adjust SOP parameters whenever your practice scales.</span>
            <span className="text-emerald-400 print:text-emerald-800 font-bold">The 2-Touchpoint Care Loop →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 06: THE 2-TOUCHPOINT CARE LOOP
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-black print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-5 mb-6">
              <div className="flex items-center gap-2 text-emerald-400 print:text-emerald-700 text-xs font-mono font-bold uppercase tracking-wider">
                <Zap className="w-4 h-4" /> Operational Efficiency
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 06 / 10</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white print:text-slate-900 tracking-tight">
              The 2-Touchpoint WhatsApp Care Loop
            </h2>
            <p className="text-sm text-slate-300 print:text-slate-600 mt-2 max-w-3xl">
              Eliminating evening OPD chaos while ensuring 100% of prescribed medications and diagnostic tests are fulfilled within your network.
            </p>

            <div className="space-y-4 mt-6">
              {/* Touchpoint 1 */}
              <div className="p-5 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center font-black shrink-0 border border-slate-700">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white print:text-slate-900">Morning In-Person Consultation (OPD)</h3>
                    <p className="text-xs text-slate-300 print:text-slate-600 mt-0.5 leading-relaxed">
                      Assistant registers walk-ins, records vitals (BP, Sugar, SpO2), and issues token (#TK-001). Doctor examines patient and prescribes naturally without keyboard typing.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-indigo-950/80 text-indigo-300 print:bg-indigo-100 print:text-indigo-800 text-[10px] font-bold uppercase font-mono shrink-0 border border-indigo-800/40">
                  OPD Queue #TK-001
                </span>
              </div>

              {/* Touchpoint 2 */}
              <div className="p-5 bg-emerald-950/40 print:bg-emerald-50 rounded-2xl border border-emerald-500/30 print:border-emerald-200 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0 shadow-lg shadow-emerald-950/50">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white print:text-slate-900">Evening Diagnostic Report Review on WhatsApp</h3>
                    <p className="text-xs text-slate-300 print:text-slate-600 mt-0.5 leading-relaxed">
                      When the diagnostic lab approves reports, WhatsApp delivers the verified PDF to the patient with two single-tap interactive options:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2.5 py-0.5 bg-slate-900 print:bg-white border border-emerald-500/40 print:border-emerald-300 rounded-lg text-emerald-300 print:text-emerald-800 text-[10px] font-bold">
                        🏥 Physical Clinic Review (Primary / Reserved Pharmacy Hold)
                      </span>
                      <span className="px-2.5 py-0.5 bg-slate-900 print:bg-white border border-slate-700 print:border-slate-300 rounded-lg text-slate-300 print:text-slate-800 text-[10px] font-bold">
                        💻 Virtual Video Review (Emergency / 1-Click Home Delivery)
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-emerald-900/80 text-emerald-300 print:bg-emerald-100 print:text-emerald-800 text-[10px] font-bold uppercase font-mono shrink-0 border border-emerald-700/40">
                  Sub-300ms Dispatch
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mt-6">
            <div className="p-3 bg-slate-800 print:bg-slate-100 rounded-xl border border-slate-700 print:border-slate-200 text-xs font-semibold text-slate-300 print:text-slate-800">
              🎁 1 Free Virtual Consult
            </div>
            <div className="p-3 bg-slate-800 print:bg-slate-100 rounded-xl border border-slate-700 print:border-slate-200 text-xs font-semibold text-slate-300 print:text-slate-800">
              🏷️ 10% Off Chronic Refills
            </div>
            <div className="p-3 bg-slate-800 print:bg-slate-100 rounded-xl border border-slate-700 print:border-slate-200 text-xs font-semibold text-slate-300 print:text-slate-800">
              📱 Daily WhatsApp Dose Alerts
            </div>
            <div className="p-3 bg-slate-800 print:bg-slate-100 rounded-xl border border-slate-700 print:border-slate-200 text-xs font-semibold text-slate-300 print:text-slate-800">
              📄 Instant Verified Reports
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 07: CHRONIC CARE MANAGEMENT & REFILL ENGINE
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-black print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-5 mb-6">
              <div className="flex items-center gap-2 text-emerald-400 print:text-emerald-700 text-xs font-mono font-bold uppercase tracking-wider">
                <HeartPulse className="w-4 h-4" /> Patient Retention &amp; Adherence
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 07 / 10</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white print:text-slate-900 tracking-tight">
              Longitudinal Chronic Care &amp; Automated Refills
            </h2>
            <p className="text-sm text-slate-300 print:text-slate-600 mt-2 max-w-3xl">
              Transforming one-time patient visits into predictable, 10-year therapeutic relationships and practice equity.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="p-5 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-white print:text-slate-900">8 Supported Chronic Protocols</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-900 print:bg-white rounded-lg border border-slate-800 print:border-slate-200 text-slate-300 print:text-slate-800 font-medium">🩸 Type-2 Diabetes</div>
                  <div className="p-2.5 bg-slate-900 print:bg-white rounded-lg border border-slate-800 print:border-slate-200 text-slate-300 print:text-slate-800 font-medium">🫀 Essential HTN</div>
                  <div className="p-2.5 bg-slate-900 print:bg-white rounded-lg border border-slate-800 print:border-slate-200 text-slate-300 print:text-slate-800 font-medium">🦋 Hypothyroidism</div>
                  <div className="p-2.5 bg-slate-900 print:bg-white rounded-lg border border-slate-800 print:border-slate-200 text-slate-300 print:text-slate-800 font-medium">🧪 CAD / Dyslipidemia</div>
                  <div className="p-2.5 bg-slate-900 print:bg-white rounded-lg border border-slate-800 print:border-slate-200 text-slate-300 print:text-slate-800 font-medium">🫁 Asthma / COPD</div>
                  <div className="p-2.5 bg-slate-900 print:bg-white rounded-lg border border-slate-800 print:border-slate-200 text-slate-300 print:text-slate-800 font-medium">🦴 Arthritis / OA</div>
                  <div className="p-2.5 bg-slate-900 print:bg-white rounded-lg border border-slate-800 print:border-slate-200 text-slate-300 print:text-slate-800 font-medium">🔬 CKD Stage 1–3</div>
                  <div className="p-2.5 bg-slate-900 print:bg-white rounded-lg border border-slate-800 print:border-slate-200 text-slate-300 print:text-slate-800 font-medium">⚡ Epilepsy</div>
                </div>
              </div>

              <div className="p-5 bg-slate-800/60 print:bg-emerald-50 rounded-2xl border border-emerald-500/30 print:border-emerald-200 space-y-3">
                <h3 className="text-sm font-bold text-white print:text-slate-900">Automated Adherence Automation</h3>
                <ul className="text-xs text-slate-300 print:text-slate-700 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Day-25 WhatsApp 1-Tap Refill:</strong> Prompts patient 5 days before medication runs out with native 1-tap confirmation: <code className="text-emerald-300 print:text-emerald-800">[📦 Confirm 1-Click Refill]</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Day-75 Diagnostic Loop:</strong> Automatically coordinates repeat HbA1c, Lipid profile, and TSH tests with home sample collection.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Refill Defaulter Safety Net:</strong> Automatically highlights high-risk patients who missed medicines by &gt;7 days with 1-Tap WhatsApp alerts to staff.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 print:bg-slate-100 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:border-slate-200">
            <span className="text-slate-300 print:text-slate-700">Patient adherence improves by 42%, while practice revenue scales reliably.</span>
            <span className="text-emerald-400 print:text-emerald-800 font-bold">Legal Shield &amp; Compliance →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 08: LEGAL SHIELD & NMC COMPLIANCE
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-black print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-5 mb-6">
              <div className="flex items-center gap-2 text-teal-400 print:text-teal-700 text-xs font-mono font-bold uppercase tracking-wider">
                <Scale className="w-4 h-4" /> Medical Ethics &amp; Legal Protection
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 08 / 10</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white print:text-slate-900 tracking-tight">
              100% Legal Protection &amp; NMC Ethics Compliance
            </h2>
            <p className="text-sm text-slate-300 print:text-slate-600 mt-2 max-w-3xl">
              Architected to keep medical practitioners completely shielded, legally compliant, and aligned with Indian medical governance.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              <div className="p-5 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-white print:text-slate-900">1. NMC Ethics Alignment</h3>
                <p className="text-xs text-slate-300 print:text-slate-600 leading-relaxed">
                  Doctor Consultation fees are 100% untouched. VitalSync does not take fee splits from professional medical consultations, ensuring zero violation of National Medical Commission regulations.
                </p>
              </div>

              <div className="p-5 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-white print:text-slate-900">2. Tripartite B2B Agreements</h3>
                <p className="text-xs text-slate-300 print:text-slate-600 leading-relaxed">
                  Pharmacy and pathology coordination fees are legally classified as technical infrastructure &amp; logistics service fees for inventory hold management and digital routing — NOT informal kickbacks.
                </p>
              </div>

              <div className="p-5 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-white print:text-slate-900">3. Telemedicine Guidelines 2020</h3>
                <p className="text-xs text-slate-300 print:text-slate-600 leading-relaxed">
                  All virtual video consults enforce explicit patient digital consent, registered practitioner verification, and digital prescription safeguards mandated by the Ministry of Health (MoHFW).
                </p>
              </div>
            </div>

            <div className="p-4 bg-teal-950/40 print:bg-teal-50 border border-teal-800/60 print:border-teal-200 rounded-2xl text-xs text-teal-300 print:text-teal-950 mt-6 font-medium">
              📄 Complete legal terms, business associate agreements, and privacy frameworks are codified in your portal at <span className="font-mono font-bold">/legal</span>.
            </div>
          </div>

          <div className="p-4 bg-slate-800 print:bg-slate-100 rounded-2xl flex items-center justify-between text-xs mt-4 border border-slate-700 print:border-slate-200">
            <span className="text-slate-300 print:text-slate-700">Full institutional backing with zero legal ambiguity.</span>
            <span className="text-emerald-400 print:text-emerald-800 font-bold">Practice Economics Simulator →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 09: PRACTICE REVENUE SIMULATOR
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-black print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-5 mb-6">
              <div className="flex items-center gap-2 text-emerald-400 print:text-emerald-700 text-xs font-mono font-bold uppercase tracking-wider">
                <TrendingUp className="w-4 h-4" /> Financial Economics
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 09 / 10</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white print:text-slate-900 tracking-tight">
              Practice Economics Simulator (Real Clinic Numbers)
            </h2>
            <p className="text-sm text-slate-300 print:text-slate-600 mt-2 max-w-3xl">
              Conservative model based on a typical private clinic seeing 25 OPD patients per day (600 visits/month).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Traditional Model */}
              <div className="p-6 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 space-y-3">
                <div className="text-xs font-mono font-bold uppercase text-slate-400">Traditional Standalone Clinic</div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between pb-2 border-b border-slate-700 print:border-slate-200">
                    <span className="text-slate-300 print:text-slate-700">OPD Consultation Fees (600 × ₹500)</span>
                    <span className="font-mono font-bold text-white print:text-slate-900">₹3,00,000</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-700 print:border-slate-200 text-rose-400 print:text-rose-600">
                    <span>Pharmacy Medication Sales</span>
                    <span className="font-mono font-bold">₹0 (Lost to external shops)</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-700 print:border-slate-200 text-rose-400 print:text-rose-600">
                    <span>Pathology Diagnostic Tests</span>
                    <span className="font-mono font-bold">₹0 (Lost to external labs)</span>
                  </div>
                  <div className="flex justify-between pt-2 text-sm font-bold text-white print:text-slate-900">
                    <span>Total Practice Monthly Income</span>
                    <span className="font-mono text-base">₹3,00,000</span>
                  </div>
                </div>
              </div>

              {/* VitalSync Network */}
              <div className="p-6 bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 print:bg-emerald-50 rounded-2xl border border-emerald-500/40 print:border-emerald-300 space-y-3 shadow-xl">
                <div className="text-xs font-mono font-bold uppercase text-emerald-400 print:text-emerald-800">With VitalSync Virtual Hospital</div>
                <div className="space-y-2.5 text-xs text-slate-200 print:text-slate-800">
                  <div className="flex justify-between pb-2 border-b border-emerald-800/40 print:border-emerald-200">
                    <span>Protected Doctor Consultations (100%)</span>
                    <span className="font-mono font-bold text-white print:text-slate-900">₹3,00,000</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-emerald-800/40 print:border-emerald-200">
                    <span>Chronic Medication Split (25% on ₹4.5L pool)</span>
                    <span className="font-mono font-bold text-emerald-400 print:text-emerald-700">+₹1,12,500</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-emerald-800/40 print:border-emerald-200">
                    <span>Diagnostic Lab Split (35% on ₹2.4L pool)</span>
                    <span className="font-mono font-bold text-emerald-400 print:text-emerald-700">+₹84,000</span>
                  </div>
                  <div className="flex justify-between pt-2 text-base font-black text-white print:text-slate-900">
                    <span>New Practice Monthly Income</span>
                    <span className="font-mono text-emerald-400 print:text-emerald-700 text-lg">₹4,96,500</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-950/60 print:bg-emerald-100 border border-emerald-700/60 print:border-emerald-300 rounded-2xl flex items-center justify-between text-xs mt-6">
              <span className="font-bold text-emerald-300 print:text-emerald-950">Net Monthly Practice Increase: +₹1,96,500 / Month (+65.5% Practice Growth)</span>
              <span className="font-mono font-bold text-white print:text-emerald-900 text-sm">₹23,58,000 / Year Extra Value</span>
            </div>
          </div>

          <div className="p-4 bg-slate-800 print:bg-slate-100 rounded-2xl flex items-center justify-between text-xs mt-4 border border-slate-700 print:border-slate-200">
            <span className="text-slate-300 print:text-slate-700">Predictable monthly practice cash flow with zero financial capital at risk.</span>
            <span className="text-emerald-400 print:text-emerald-800 font-bold">5-Minute Onboarding →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 10: 5-MINUTE ACTIVATION & VIP CONTACT
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-black print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-5 mb-6">
              <div className="flex items-center gap-2 text-emerald-400 print:text-emerald-700 text-xs font-mono font-bold uppercase tracking-wider">
                <Building2 className="w-4 h-4" /> Rapid Deployment
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 10 / 10</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white print:text-slate-900 tracking-tight">
              Activate Your Virtual Hospital in Under 5 Minutes
            </h2>
            <p className="text-sm text-slate-300 print:text-slate-600 mt-2 max-w-3xl">
              Zero hardware installation. Zero IT consultants needed. Launch your connected clinic network today.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              <div className="p-6 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-950 text-white mx-auto flex items-center justify-center font-black text-lg border border-slate-700">
                  1
                </div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Scan WhatsApp QR</h3>
                <p className="text-xs text-slate-300 print:text-slate-600 leading-relaxed">
                  Scan your clinic WhatsApp QR code to connect your official WhatsApp Business API channel in 2 minutes.
                </p>
              </div>

              <div className="p-6 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-950 text-white mx-auto flex items-center justify-center font-black text-lg border border-slate-700">
                  2
                </div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Link Chemist &amp; Lab</h3>
                <p className="text-xs text-slate-300 print:text-slate-600 leading-relaxed">
                  Invite your trusted neighborhood chemist and diagnostic lab using their phone numbers.
                </p>
              </div>

              <div className="p-6 bg-slate-800/60 print:bg-slate-50 rounded-2xl border border-slate-700/60 print:border-slate-200 space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-950 text-white mx-auto flex items-center justify-center font-black text-lg border border-slate-700">
                  3
                </div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Set SOP Parameters</h3>
                <p className="text-xs text-slate-300 print:text-slate-600 leading-relaxed">
                  Confirm your clinic split percentages and start issuing digital OPD tokens immediately.
                </p>
              </div>
            </div>

            {/* Direct Contact Card */}
            <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 print:bg-slate-100 rounded-2xl mt-6 flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800 print:border-slate-300">
              <div className="space-y-1 text-center md:text-left">
                <div className="text-base font-black text-white print:text-slate-900 flex items-center gap-2 justify-center md:justify-start">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> Schedule Your 5-Minute Practice Onboarding
                </div>
                <div className="text-xs text-slate-400 print:text-slate-600">
                  Speak directly with our Executive Network Lead for on-site onboarding and chemist integration.
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <a 
                  href="tel:+919608032073" 
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/50 no-underline"
                >
                  <PhoneCall className="w-4 h-4" /> +91 96080 32073
                </a>
                <a 
                  href="mailto:vivekobray2073@gmail.com" 
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white print:text-black rounded-xl text-xs font-bold flex items-center gap-2 transition-all no-underline"
                >
                  <Mail className="w-4 h-4" /> vivekobray2073@gmail.com
                </a>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-950/40 print:bg-emerald-50 border border-emerald-800/60 print:border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-slate-300 print:text-slate-800 mt-4">
            <span className="font-bold text-white print:text-slate-900">VitalSync Smart Virtual Hospital Network</span>
            <span>Empowering Independent Physicians Across Tier 2 &amp; Tier 3 Healthcare Hubs</span>
          </div>
        </section>

      </main>
    </div>
  );
};
