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
  AlertTriangle,
  FileText,
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
  Lock,
  Users,
  Target,
  BadgePercent,
  CheckCircle
} from 'lucide-react';

export const DoctorPitchDeckPrintPage: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState<number>(1);
  const totalSlides = 12;

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
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans antialiased selection:bg-teal-500 selection:text-white pb-20">
      
      {/* ── Fixed Presentation Toolbar (Hidden in Print Mode) ── */}
      <header className="sticky top-0 z-50 print:hidden bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-700/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-slate-900 flex items-center gap-2">
                <span>VitalSync</span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  Doctor Partnership Proposal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Smart Virtual Hospital Network • Executive Presentation</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <button
                onClick={prevSlide}
                disabled={activeSlide === 1}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer border-0"
                title="Previous Slide"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-mono font-bold text-teal-700">
                {String(activeSlide).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
              </span>
              <button
                onClick={nextSlide}
                disabled={activeSlide === totalSlides}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer border-0"
                title="Next Slide"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-teal-700/20 transition-all flex items-center gap-2 cursor-pointer border-0"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
          </div>
        </div>
      </header>

      {/* ── Slide Container ── */}
      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-12 print:space-y-0 print:p-0">

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 01: COVER & EXECUTIVE PROPOSITION
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between relative overflow-hidden">
          <div>
            {/* Top Tag & Slide Number */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-8">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs">
                  01
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                  Strategic Clinical Proposal
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 01 / 12</span>
            </div>

            {/* Main Headline & Narrative */}
            <div className="space-y-5 max-w-4xl">
              <span className="inline-block px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider">
                Exclusively For Independent Physicians, Surgeons &amp; Clinic Directors
              </span>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.2]">
                Transform Your Clinic Into A <span className="text-teal-600">Hospital-Grade Outpatient Network</span> On WhatsApp
              </h1>
              <p className="text-base md:text-lg text-slate-600 leading-relaxed font-normal">
                Unite your OPD consultation room with your trusted local pharmacy and diagnostic laboratory into an automated, hospital-grade outpatient ecosystem. Deliver continuous chronic care, maintain 100% patient loyalty, and unlock <strong className="text-slate-900 font-semibold">+₹1,00,000 to +₹2,00,000+ monthly recurring practice equity</strong> with <strong className="text-teal-700 font-semibold">zero software subscription fees and zero change to your daily OPD workflow</strong>.
              </p>
            </div>
          </div>

          {/* 4 Feature Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-slate-100 mt-8">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Adoption Cost</div>
              <div className="text-xl font-black text-teal-600 mt-1">₹0 Setup / ₹0 SaaS</div>
              <div className="text-[11px] text-slate-500 mt-0.5">100% Free Lifetime Adoption</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Doctor Consultation</div>
              <div className="text-xl font-black text-slate-900 mt-1">100% Protected</div>
              <div className="text-[11px] text-slate-500 mt-0.5">0% Platform Deductions (Rule 58)</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Doctor Routine</div>
              <div className="text-xl font-black text-slate-900 mt-1">Zero Disruption</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Assistant manages queue &amp; vitals</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Legal Compliance</div>
              <div className="text-xl font-black text-teal-700 mt-1">NMC Compliant</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Formal B2B Care Framework</div>
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 02: THE CLINICAL & PRACTICE CHALLENGE
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs">
                  02
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                  The Clinical &amp; Practice Challenge
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 02 / 12</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Where 60% of Your Clinical Impact &amp; Practice Value Is Lost
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              You invest decades building clinical mastery and patient trust. Yet, the moment a patient leaves your OPD clinic, third-party retail shops capture 90% of the financial value while compromising clinical outcomes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2.5 text-rose-800 font-bold text-sm">
                  <Coins className="w-4 h-4 text-rose-600" /> 1. The Episodic Consultation Trap
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  You diagnose and earn a single ₹500 fee. The patient subsequently spends ₹2,500 to ₹4,000 every month for 10+ years at disconnected pharmacies and labs where you have zero visibility or equity.
                </p>
              </div>

              <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2.5 text-rose-800 font-bold text-sm">
                  <Pill className="w-4 h-4 text-rose-600" /> 2. Retail Generic Substitution
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Commercial retail pharmacies frequently switch your prescribed branded formulations with high-margin generic substitutes without your knowledge, compromising therapeutic recovery.
                </p>
              </div>

              <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2.5 text-rose-800 font-bold text-sm">
                  <HeartPulse className="w-4 h-4 text-rose-600" /> 3. 60% Chronic Care Attrition
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Hypertensive and diabetic patients routinely forget to refill on Day 25 and skip their 90-day repeat diagnostic panels (HbA1c, Lipid profile), resulting in uncontrolled vitals and complications.
                </p>
              </div>

              <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2.5 text-rose-800 font-bold text-sm">
                  <Clock className="w-4 h-4 text-rose-600" /> 4. Unorganized Evening Follow-Ups
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Patients call your personal mobile number or crowd your clinic at 7:00 PM simply to show physical test printouts, overloading staff and causing OPD overcrowding.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-200">
            <span className="text-slate-700 font-medium">VitalSync solves this by creating a closed, automated outpatient care loop centered around your clinic.</span>
            <span className="text-teal-700 font-bold">The Strategic Solution →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 03: THE VIRTUAL HOSPITAL TRIAD
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs">
                  03
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                  The Care Triad
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 03 / 12</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              The Virtual Outpatient Triad on WhatsApp
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              Connect your clinic with your preferred neighborhood pharmacy and accredited diagnostic laboratory into a unified outpatient network on WhatsApp.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              {/* Doctor */}
              <div className="p-6 bg-slate-50 rounded-2xl border border-indigo-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900">1. Doctor (Clinical Head)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Diagnoses and prescribes freely. Configures clinic revenue splits and retains 100% consultation fee income.
                </p>
                <div className="text-[11px] font-bold text-indigo-800 bg-indigo-100 py-1 px-2.5 rounded-lg border border-indigo-200">
                  100% Free Adoption
                </div>
              </div>

              {/* Chemist */}
              <div className="p-6 bg-slate-50 rounded-2xl border border-teal-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <Pill className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900">2. Partner Chemist</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Dispenses authentic branded medicines, manages 30-day chronic refills, and provides 10% patient discounts.
                </p>
                <div className="text-[11px] font-bold text-teal-800 bg-teal-100 py-1 px-2.5 rounded-lg border border-teal-200">
                  20%–30% Practice Split
                </div>
              </div>

              {/* Lab */}
              <div className="p-6 bg-slate-50 rounded-2xl border border-purple-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <TestTube2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900">3. Partner Lab</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Performs pathology &amp; diagnostic investigations, provides home sample collection, and pushes verified PDF reports to WhatsApp.
                </p>
                <div className="text-[11px] font-bold text-purple-800 bg-purple-100 py-1 px-2.5 rounded-lg border border-purple-200">
                  30%–40% Practice Split
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-3 text-xs mt-6">
            <Smartphone className="w-5 h-5 text-teal-600 shrink-0" />
            <div className="text-slate-800">
              <strong>Zero App Downloads for Patients:</strong> Patients interact directly through WhatsApp. No app installs, passwords, or technical friction.
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 04: 100% FREE ADOPTION & FEE IMMUNITY
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                  04
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-800 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                  Fee Protection &amp; Rule 58 / 103
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 04 / 12</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              100% Free Adoption &amp; Complete Fee Immunity
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              Our core operating standard: Zero SaaS subscription fees, and 100% of your OPD consultation fee goes directly to you.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="text-rose-600 text-xl font-black font-mono">₹0 / month</div>
                <h3 className="text-sm font-bold text-slate-900">Zero SaaS Overhead</h3>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  No monthly software fees, no annual maintenance contracts, and no per-terminal licensing charges.
                </p>
              </div>

              <div className="p-4.5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1.5">
                <div className="text-emerald-700 text-xl font-black font-mono">100% To Doctor</div>
                <h3 className="text-sm font-bold text-slate-900">Consultation Immunity</h3>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  100% of your consultation fee is credited directly to you. VitalSync never takes a cut from your medical consultation.
                </p>
              </div>

              <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="text-teal-700 text-xl font-black font-mono">Cash &amp; Digital</div>
                <h3 className="text-sm font-bold text-slate-900">Automated Pool Settlement</h3>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Counter cash stays 100% in your clinic drawer. Platform reconciliation happens seamlessly via the pre-funded pool.
                </p>
              </div>
            </div>

            {/* Complete Transparency: 3% Platform Share */}
            <div className="p-5 bg-slate-50 rounded-2xl mt-5 border border-slate-200 space-y-3">
              <div className="text-xs font-mono font-bold uppercase text-teal-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Full Transparency: How VitalSync Operates (3% Technical Platform Share)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">1. Pharmacy Counter &amp; Refills (3%)</div>
                  <span className="text-[11px] text-slate-600">When patients purchase medicines at the clinic counter or order 30-day refills from the partner chemist (Cash or Online).</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">2. Complete Diagnostic Lab Tests (3%)</div>
                  <span className="text-[11px] text-slate-600">When patients complete diagnostic lab investigations — pathology, biochemistry, ECG, imaging, or full panels (Cash or Online).</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">3. WhatsApp Booking Fee (3%)</div>
                  <span className="text-[11px] text-slate-600">A standard 3% digital convenience fee (e.g. ₹15 on a ₹500 consult) paid directly by online patients who book on WhatsApp.</span>
                </div>
              </div>
              <div className="text-[11px] text-teal-900 pt-1 font-medium">
                ✔ <strong>Automated Cash Settlement Pool:</strong> Physical cash stays in your drawer. The platform share is automatically deducted from the pre-funded Commission Pool balance (maintaining a ₹1,000 Safety Buffer).
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-between text-xs text-slate-700 mt-4 border border-slate-200">
            <span>Guaranteed in our Master Service Agreement &amp; B2B Terms.</span>
            <span className="font-bold text-slate-900">Next: Practice SOP Splits →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 05: DOCTOR-CONTROLLED DYNAMIC SPLITS
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs">
                  05
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                  Practice Governance
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 05 / 12</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Doctor-Controlled Dynamic SOP Splits
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              You maintain 100% autonomy over your network economics. Set custom splits with 1 tap in your clinic SOP settings.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" /> Dynamic Practice Parameters
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-semibold text-slate-800">💊 Pharmacy Medication Split</span>
                    <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">20% – 30%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-semibold text-slate-800">🔬 Pathology Diagnostic Split</span>
                    <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded border border-purple-200">30% – 40%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-semibold text-slate-800">🚨 Emergency SOS Priority Fee</span>
                    <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">₹618.00</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-semibold text-slate-800">🏷️ Chronic Refill Patient Loyalty Discount</span>
                    <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">10% OFF</span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-teal-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600" /> ₹1,000 Automated Safety Buffer &amp; Pool
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  All settlements are executed atomically at the Postgres database boundary into your verified bank account with zero manual accounting overhead.
                </p>
                <div className="p-3.5 bg-white rounded-xl border border-teal-200 text-xs text-teal-950 space-y-1.5 font-medium">
                  <div>✔ Automated direct payouts to Doctor Bank / UPI.</div>
                  <div>✔ Seamless reconciliation on counter cash collections.</div>
                  <div>✔ Complete audit ledger available in Doctor Financials tab.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-200">
            <span className="text-slate-700">You retain 100% freedom to adjust SOP parameters whenever your practice scales.</span>
            <span className="text-teal-800 font-bold">The 2-Touchpoint Care Loop →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 06: THE 2-TOUCHPOINT CARE LOOP
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs">
                  06
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                  Operational Efficiency
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 06 / 12</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              The 2-Touchpoint WhatsApp Care Loop
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              Eliminating evening OPD chaos while ensuring 100% of prescribed medications and diagnostic tests are fulfilled within your network.
            </p>

            <div className="space-y-4 mt-6">
              {/* Touchpoint 1 */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Morning In-Person Consultation (OPD)</h3>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Assistant registers walk-ins, records vitals (BP, Sugar, SpO2), and issues token (#TK-001). Doctor examines patient and prescribes naturally without keyboard typing.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase font-mono shrink-0 border border-indigo-200">
                  OPD Queue #TK-001
                </span>
              </div>

              {/* Touchpoint 2 */}
              <div className="p-5 bg-teal-50 rounded-2xl border border-teal-200 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black shrink-0 shadow-md">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Evening Diagnostic Report Review on WhatsApp</h3>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      When the diagnostic lab approves reports, WhatsApp delivers the verified PDF to the patient with two single-tap interactive options:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2.5 py-0.5 bg-white border border-teal-300 rounded-lg text-teal-800 text-[10px] font-bold">
                        🏥 Physical Clinic Review (Primary / Reserved Pharmacy Hold)
                      </span>
                      <span className="px-2.5 py-0.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-[10px] font-bold">
                        💻 Virtual Video Review (Emergency / 1-Click Home Delivery)
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-teal-100 text-teal-800 text-[10px] font-bold uppercase font-mono shrink-0 border border-teal-200">
                  Sub-300ms Dispatch
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mt-6">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
              🎁 1 Free Virtual Consult
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
              🏷️ 10% Off Chronic Refills
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
              📱 Daily WhatsApp Dose Alerts
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
              📄 Instant Verified Reports
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 07: 4 PATIENT VALUE DRIVERS & 10-YEAR LOYALTY
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                  07
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-800 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                  Patient Loyalty Engine
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 07 / 12</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              4 Benefits That Make Patients 100% Loyal To Your Clinic
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              Why patients will consistently choose your outpatient network over disconnected standalone clinics.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="text-sm font-bold text-slate-900">1 Free Virtual Follow-Up Consult</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Valid for 15–20 days after clinic visit. Patients can clarify medication doses or symptom relief over WhatsApp video without travelling or paying twice.
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="text-sm font-bold text-slate-900">10% Off Chronic Medicine Refills</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Patients get an automatic 10% discount on 30-day medicine refills fulfilled through your partner pharmacy, saving families thousands of rupees annually.
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h3 className="text-sm font-bold text-slate-900">Daily WhatsApp Dose Alerts &amp; Health Charts</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automated WhatsApp messages send morning and evening dose alerts (1-0-1) and track vital trends into longitudinal health summaries.
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <h3 className="text-sm font-bold text-slate-900">Instant Verified PDF Lab Reports</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Zero waiting in lab queues. High-resolution verified PDF reports are delivered to the patient's phone the minute the lab releases the results.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-200">
            <span className="text-slate-700">Patients stay attached to your clinic for life instead of wandering to external medical stores.</span>
            <span className="text-teal-800 font-bold">Chronic Disease Care Engine →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 08: CHRONIC CARE MANAGEMENT & REFILL ENGINE
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs">
                  08
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                  Patient Retention &amp; Adherence
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 08 / 12</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Longitudinal Chronic Care &amp; Automated Refills
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              Transforming one-time patient visits into predictable, 10-year therapeutic relationships and practice equity.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">8 Supported Chronic Care Protocols</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium">🩸 Type-2 Diabetes</div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium">🫀 Essential HTN</div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium">🦋 Hypothyroidism</div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium">🧪 CAD / Dyslipidemia</div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium">🫁 Asthma / COPD</div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium">🦴 Arthritis / OA</div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium">🔬 CKD Stage 1–3</div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium">⚡ Epilepsy</div>
                </div>
              </div>

              <div className="p-5 bg-teal-50 rounded-2xl border border-teal-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Automated Patient Adherence Engine</h3>
                <ul className="text-xs text-slate-700 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Day-25 WhatsApp 1-Tap Refill:</strong> Prompts patient 5 days before medication runs out with native 1-tap confirmation: <code className="text-teal-800 font-semibold">[📦 Confirm 1-Click Refill]</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Day-75 Diagnostic Loop:</strong> Automatically coordinates repeat HbA1c, Lipid profile, and TSH tests with home sample collection.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Refill Defaulter Safety Net:</strong> Automatically highlights high-risk patients who missed medicines by &gt;7 days with 1-Tap WhatsApp alerts to staff.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-200">
            <span className="text-slate-700">Patient adherence improves by 42%, while practice revenue scales reliably.</span>
            <span className="text-teal-800 font-bold">Legal Shield &amp; Compliance →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 09: LEGAL SHIELD & NMC COMPLIANCE
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs">
                  09
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                  Medical Ethics &amp; Legal Protection
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 09 / 12</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              100% Legal Protection &amp; NMC Ethics Compliance
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              Architected to keep medical practitioners completely shielded, legally compliant, and aligned with Indian medical governance.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900">1. NMC Ethics Alignment</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Doctor Consultation fees are 100% untouched. VitalSync does not take fee splits from professional medical consultations, ensuring zero violation of National Medical Commission regulations.
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900">2. Tripartite B2B Agreements</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pharmacy and pathology coordination fees are legally classified as technical infrastructure &amp; logistics service fees for inventory hold management and digital routing — NOT informal kickbacks.
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900">3. Telemedicine Guidelines 2020</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  All virtual video consults enforce explicit patient digital consent, registered practitioner verification, and digital prescription safeguards mandated by the Ministry of Health (MoHFW).
                </p>
              </div>
            </div>

            <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl text-xs text-teal-950 mt-6 font-medium">
              📄 Complete legal terms, business associate agreements, and privacy frameworks are codified in your portal at <span className="font-mono font-bold">/legal</span>.
            </div>
          </div>

          <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-between text-xs mt-4 border border-slate-200">
            <span className="text-slate-700">Full institutional backing with zero legal ambiguity.</span>
            <span className="text-teal-800 font-bold">Practice Economics Simulator →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 10: PRACTICE REVENUE SIMULATOR
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                  10
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Financial Economics
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 10 / 12</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Practice Economics Simulator (Real Clinic Numbers)
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              Conservative financial model based on a typical private clinic seeing 25 OPD patients per day (600 visits/month).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Traditional Model */}
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="text-xs font-mono font-bold uppercase text-slate-500">Traditional Standalone Clinic</div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between pb-2 border-b border-slate-200">
                    <span className="text-slate-700">OPD Consultation Fees (600 × ₹500)</span>
                    <span className="font-mono font-bold text-slate-900">₹3,00,000</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-200 text-rose-600">
                    <span>Pharmacy Medication Sales</span>
                    <span className="font-mono font-bold">₹0 (Lost to external shops)</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-200 text-rose-600">
                    <span>Pathology Diagnostic Tests</span>
                    <span className="font-mono font-bold">₹0 (Lost to external labs)</span>
                  </div>
                  <div className="flex justify-between pt-2 text-sm font-bold text-slate-900">
                    <span>Total Practice Monthly Income</span>
                    <span className="font-mono text-base">₹3,00,000</span>
                  </div>
                </div>
              </div>

              {/* VitalSync Network */}
              <div className="p-6 bg-teal-50/70 rounded-2xl border border-teal-300 space-y-3 shadow-xs">
                <div className="text-xs font-mono font-bold uppercase text-teal-800">With VitalSync Virtual Hospital</div>
                <div className="space-y-2.5 text-xs text-slate-800">
                  <div className="flex justify-between pb-2 border-b border-teal-200">
                    <span>Protected Doctor Consultations (100%)</span>
                    <span className="font-mono font-bold text-slate-900">₹3,00,000</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-teal-200">
                    <span>Chronic Medication Split (25% on ₹4.5L pool)</span>
                    <span className="font-mono font-bold text-teal-700">+₹1,12,500</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-teal-200">
                    <span>Diagnostic Lab Split (35% on ₹2.4L pool)</span>
                    <span className="font-mono font-bold text-teal-700">+₹84,000</span>
                  </div>
                  <div className="flex justify-between pt-2 text-base font-black text-slate-900">
                    <span>New Practice Monthly Income</span>
                    <span className="font-mono text-teal-700 text-lg">₹4,96,500</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs mt-6">
              <span className="font-bold text-emerald-900">Net Monthly Practice Increase: +₹1,96,500 / Month (+65.5% Practice Growth)</span>
              <span className="font-mono font-bold text-emerald-900 text-sm">₹23,58,000 / Year Extra Value</span>
            </div>
          </div>

          <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-between text-xs mt-4 border border-slate-200">
            <span className="text-slate-700">Predictable monthly practice cash flow with zero financial capital at risk.</span>
            <span className="text-teal-800 font-bold">Practice Integration FAQs →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 11: DOCTOR FAQS & COMMON CONCERNS
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                  11
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-800 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                  Practice Integration FAQs
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 11 / 12</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Doctor FAQs &amp; Common Concerns Answered
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              Everything you need to know about partnering with VitalSync.
            </p>

            <div className="space-y-3.5 mt-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  Q: "Do I have to change my clinical consultation style or type on a laptop?"
                </div>
                <p className="text-[11px] text-slate-600 pl-6 leading-relaxed">
                  <strong>No.</strong> Your compounder/assistant handles the token queue and records vitals. You examine patients naturally and write prescriptions as you always have.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  Q: "How do cash collections at the counter work with our revenue split?"
                </div>
                <p className="text-[11px] text-slate-600 pl-6 leading-relaxed">
                  When the compounder collects cash, you keep 100% of the physical cash in your drawer. The platform coordination share is automatically reconciled from the pre-funded Commission Pool balance.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  Q: "Can I choose my own chemist and pathology lab?"
                </div>
                <p className="text-[11px] text-slate-600 pl-6 leading-relaxed">
                  <strong>Yes, absolutely.</strong> You have 100% freedom to link your preferred local chemist down the street and your trusted diagnostic lab via their phone numbers.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  Q: "Is patient medical data secure and private?"
                </div>
                <p className="text-[11px] text-slate-600 pl-6 leading-relaxed">
                  <strong>100% Enterprise Security.</strong> End-to-end encryption with PostgreSQL Row-Level Security (RLS). Only you and your authorized clinic staff can access patient records.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-between text-xs mt-4 border border-slate-200">
            <span className="text-slate-700">Zero risk. 100% control. Institutional growth.</span>
            <span className="text-teal-800 font-bold">5-Minute Onboarding →</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════════════
            SLIDE 12: 5-MINUTE ONBOARDING & EXECUTIVE CONTACT
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-8 md:p-14 shadow-lg border border-slate-200/90 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs">
                  12
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                  Rapid Deployment
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">SLIDE 12 / 12</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Activate Your Virtual Hospital in Under 5 Minutes
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              Zero hardware installation. Zero IT consultants needed. Launch your connected clinic network today.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white mx-auto flex items-center justify-center font-black text-lg shadow-md">
                  1
                </div>
                <h3 className="text-sm font-bold text-slate-900">Scan WhatsApp QR</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Scan your clinic WhatsApp QR code to connect your official WhatsApp Business API channel in 2 minutes.
                </p>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white mx-auto flex items-center justify-center font-black text-lg shadow-md">
                  2
                </div>
                <h3 className="text-sm font-bold text-slate-900">Link Chemist &amp; Lab</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Invite your trusted neighborhood chemist and diagnostic lab using their phone numbers.
                </p>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white mx-auto flex items-center justify-center font-black text-lg shadow-md">
                  3
                </div>
                <h3 className="text-sm font-bold text-slate-900">Set SOP Parameters</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Confirm your clinic split percentages and start issuing digital OPD tokens immediately.
                </p>
              </div>
            </div>

            {/* Direct Contact Card */}
            <div className="p-6 bg-slate-900 text-white rounded-2xl mt-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
              <div className="space-y-1 text-center md:text-left">
                <div className="text-base font-black text-white flex items-center gap-2 justify-center md:justify-start">
                  <Sparkles className="w-4 h-4 text-teal-400" /> Schedule Your 5-Minute Practice Onboarding
                </div>
                <div className="text-xs text-slate-300">
                  Speak directly with our Executive Network Lead for on-site onboarding and chemist integration.
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <a 
                  href="tel:+919608032073" 
                  className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md no-underline"
                >
                  <PhoneCall className="w-4 h-4" /> +91 96080 32073
                </a>
                <a 
                  href="mailto:vivekobray2073@gmail.com" 
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all no-underline"
                >
                  <Mail className="w-4 h-4" /> vivekobray2073@gmail.com
                </a>
              </div>
            </div>
          </div>

          <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-center justify-between text-xs text-slate-800 mt-4">
            <span className="font-bold text-teal-900">VitalSync Smart Virtual Hospital Network</span>
            <span>Empowering Independent Physicians Across Tier 2 &amp; Tier 3 Healthcare Hubs</span>
          </div>
        </section>

      </main>
    </div>
  );
};
