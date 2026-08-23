import React from 'react';
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
  Headphones,
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
  Lock
} from 'lucide-react';

export const DoctorPitchDeckPrintPage: React.FC = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white print:text-black p-4 md:p-8 font-sans antialiased">
      {/* Floating Action Header (Hidden in Print Mode) */}
      <div className="fixed top-4 right-4 z-50 print:hidden flex items-center gap-3 bg-slate-900/95 backdrop-blur-md text-white p-3 px-5 rounded-2xl shadow-2xl border border-white/20">
        <div className="text-xs font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Unified 14-Slide Master Doctor Presentation</span>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 cursor-pointer border-0"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      <div className="max-w-5xl mx-auto space-y-12 print:space-y-0">

        {/* ── SLIDE 1: COVER & GRAND VISION ───────────────────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-100/60 to-teal-100/40 rounded-full blur-3xl -mr-20 -mt-20 print:hidden" />
          
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">VitalSync</h1>
                  <p className="text-xs font-semibold text-emerald-700 tracking-wider uppercase">Smart Virtual Hospital Network</p>
                </div>
              </div>
              <span className="px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                Doctor Partnership Master Deck • Slide 1 / 14
              </span>
            </div>

            <div className="space-y-4 my-8">
              <span className="inline-block px-3.5 py-1.5 rounded-lg bg-teal-100 text-teal-900 text-xs font-bold uppercase tracking-wide">
                Exclusively For Visionary Physicians, Surgeons &amp; Clinic Directors
              </span>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight">
                Transform Your Clinic Into A <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Smart Virtual Hospital</span> On WhatsApp
              </h2>
              <p className="text-lg md:text-xl text-slate-600 max-w-3xl font-medium leading-relaxed">
                Connect your OPD consultation room, trusted local chemist, and diagnostic lab into an automated, hospital-grade outpatient ecosystem. Deliver elite patient care, boost chronic adherence, and unlock <strong className="text-slate-900">₹75,000 to ₹2,00,000+ monthly recurring practice revenue</strong> with <strong className="text-emerald-700">₹0 software cost</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="text-xs font-bold uppercase text-slate-500">Adoption Cost</div>
              <div className="text-xl font-black text-emerald-600 mt-1">100% FREE</div>
              <div className="text-[11px] text-slate-500 mt-0.5">₹0 SaaS or Setup Fees</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="text-xs font-bold uppercase text-slate-500">Doctor Fees</div>
              <div className="text-xl font-black text-slate-900 mt-1">100% PROTECTED</div>
              <div className="text-[11px] text-slate-500 mt-0.5">0% Platform Deductions</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="text-xs font-bold uppercase text-slate-500">Settlement Engine</div>
              <div className="text-xl font-black text-slate-900 mt-1">CASH &amp; DIGITAL</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Automated Pool Settlement</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="text-xs font-bold uppercase text-slate-500">Legal Shield</div>
              <div className="text-xl font-black text-teal-600 mt-1">NMC COMPLIANT</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Tripartite Care Framework</div>
            </div>
          </div>
        </section>

        {/* ── SLIDE 2: THE 4 CHRONIC LEAKS IN TRADITIONAL PRACTICE ──────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-rose-600 text-xs font-bold uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" /> The Ground Reality Today
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 2 / 14</span>
            </div>
            
            <h2 className="text-3xl font-black text-slate-900">Where 60% of Your Clinic Revenue &amp; Care is Leaking</h2>
            <p className="text-sm text-slate-600 mt-1">Independent doctors provide 80% of clinical care in Tier 2 &amp; 3 cities, but lose out completely on the downstream care economy.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              <div className="p-5 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
                  <Coins className="w-5 h-5 text-rose-600" /> 1. The One-Time ₹500 Consultation Trap
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  You diagnose the patient and earn a one-time ₹500 fee. But the patient spends ₹2,500 every single month on medicines and tests for 10+ years at external, disconnected shops where you have zero oversight or reward.
                </p>
              </div>

              <div className="p-5 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
                  <Pill className="w-5 h-5 text-rose-600" /> 2. Generic Pharmacy Substitution
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Random retail chemists often switch your prescribed branded medicine with high-margin generic alternatives without your consent, altering therapeutic efficacy and harming patient recovery.
                </p>
              </div>

              <div className="p-5 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
                  <HeartPulse className="w-5 h-5 text-rose-600" /> 3. 60% Chronic Care Dropout
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Diabetic and hypertensive patients forget to refill medications on Day 25 and skip their 90-day repeat HbA1c/Lipid profile checks, leading to preventable strokes, renal failure, and complications.
                </p>
              </div>

              <div className="p-5 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
                  <Clock className="w-5 h-5 text-rose-600" /> 4. Chaotic Evening Report Follow-Ups
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Patients call your personal mobile number and crowd your OPD clinic at 7:00 PM just to show test report printouts, creating fatigue, noise, and OPD overcrowding.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between mt-4">
            <span className="text-xs font-semibold">VitalSync unifies these fragmented touchpoints into one seamless, automated loop.</span>
            <span className="text-xs font-bold text-emerald-400">Next: The Virtual Triad →</span>
          </div>
        </section>

        {/* ── SLIDE 3: THE VIRTUAL HOSPITAL TRIAD ─────────────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" /> The VitalSync Architecture
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 3 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">The Category-Defining Virtual Hospital Triad</h2>
            <p className="text-sm text-slate-600 mt-1">You remain 100% independent while commanding a hospital-grade outpatient ecosystem.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              {/* Doctor */}
              <div className="p-5 bg-gradient-to-b from-indigo-50/80 to-slate-50 rounded-2xl border border-indigo-200 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900">1. Doctor (You)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The Clinical Head. Diagnoses patients, uses AI Scribe Voice Prescriptions, and sets dynamic SOP revenue splits.
                </p>
                <div className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 py-1 px-2 rounded-lg">
                  100% Free • ₹0 Subscription
                </div>
              </div>

              {/* Chemist */}
              <div className="p-5 bg-gradient-to-b from-emerald-50/80 to-slate-50 rounded-2xl border border-emerald-200 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <Pill className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900">2. Partner Chemist</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Local pharmacy linked to your OPD. Receives 1-Click Refills, delivers doorstep medicines, and provides 10% patient discounts.
                </p>
                <div className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 py-1 px-2 rounded-lg">
                  20%–30% Transparent Split
                </div>
              </div>

              {/* Lab */}
              <div className="p-5 bg-gradient-to-b from-purple-50/80 to-slate-50 rounded-2xl border border-purple-200 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <TestTube2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900">3. Partner Lab</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Diagnostic lab with LOINC worklist integration. Dispatches home blood sample collection and pushes verified instant PDF reports.
                </p>
                <div className="text-[10px] font-bold text-purple-700 bg-purple-100/70 py-1 px-2 rounded-lg">
                  30%–40% Transparent Split
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 mt-4">
            <MessageSquare className="w-6 h-6 text-emerald-600 shrink-0" />
            <div className="text-xs text-emerald-950">
              <strong>Zero Patient Apps Required:</strong> Patients interact naturally on WhatsApp. No app downloads, no logins, no technical resistance.
            </div>
          </div>
        </section>

        {/* ── SLIDE 4: 100% FREE ADOPTION & REVENUE ENGINE ────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" /> Doctor Freedom &amp; Financial Mechanics
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 4 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">100% Free Adoption &amp; Fee Immunity (Rule 58 / 103)</h2>
            <p className="text-sm text-slate-600 mt-1">Our sacred promise to physicians: Zero cost to adopt, and your consultation revenue is 100% immune.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="text-rose-600 text-xl font-black">₹0 / month</div>
                <h3 className="text-sm font-bold text-slate-900">Zero SaaS Fees</h3>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  No monthly software subscriptions, no AMC, no setup fees, and no per-doctor license costs ever.
                </p>
              </div>

              <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 space-y-1.5">
                <div className="text-emerald-700 text-xl font-black">100% To Doctor</div>
                <h3 className="text-sm font-bold text-slate-900">Consultation Fee Immunity</h3>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  100% of your OPD consultation fee goes directly into your pocket/bank. VitalSync never takes a cut from your consultation.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="text-indigo-600 text-xl font-black">Cash &amp; Digital</div>
                <h3 className="text-sm font-bold text-slate-900">Frictionless Reconciliation</h3>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Works seamlessly whether patients pay via UPI QR or physical Cash at the compounder desk.
                </p>
              </div>
            </div>

            {/* Complete VitalSync Revenue Sources Breakdown */}
            <div className="p-5 bg-slate-900 text-white rounded-2xl mt-5 space-y-2.5">
              <div className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Complete Transparency: How VitalSync Earns (3% Platform Infrastructure Share)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                  <div className="font-bold text-white">1. Pharmacy Counter &amp; Refills (3%)</div>
                  <span className="text-[11px] text-slate-300">When patients buy medicines at the clinic counter or order 30-day refills from partner chemist (Cash or Online).</span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                  <div className="font-bold text-white">2. Complete Diagnostic Lab Tests (3%)</div>
                  <span className="text-[11px] text-slate-300">When patients complete any diagnostic lab investigations — pathology, biochemistry, ECG, imaging, or lab panels (Cash or Online).</span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                  <div className="font-bold text-white">3. WhatsApp Booking Fee (3%)</div>
                  <span className="text-[11px] text-slate-300">A standard 3% digital convenience platform fee (e.g. ₹15 on a ₹500 consult) paid directly by online patients who book appointments on WhatsApp.</span>
                </div>
              </div>
              <div className="text-[11px] text-emerald-300 pt-1">
                ✔ <strong>Automated Cash Settlement Pool:</strong> When cash is collected at the counter by the compounder, the platform commission is automatically deducted from the clinic's pre-funded Commission Pool balance without disturbing cash flows.
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-between text-xs text-slate-700">
            <span>Guaranteed in our Master Service Agreement &amp; Legal Terms.</span>
            <span className="font-bold text-slate-900">Next: Doctor-Controlled Dynamic Splits →</span>
          </div>
        </section>

        {/* ── SLIDE 5: DOCTOR-CONTROLLED DYNAMIC SOP SPLITS ───────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-teal-600 text-xs font-bold uppercase tracking-wider">
                <Sliders className="w-4 h-4" /> Full Operational Control
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 5 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">Doctor-Controlled Dynamic SOP Splits</h2>
            <p className="text-sm text-slate-600 mt-1">You decide the terms of your virtual hospital. Upload your SOP document or configure splits in 1 tap.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" /> Dynamic SOP Configurator
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="font-semibold">💊 Pharmacy Refill Split</span>
                    <span className="font-bold font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">20% – 30%</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="font-semibold">🔬 Pathology Test Split</span>
                    <span className="font-bold font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">30% – 40%</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="font-semibold">🚨 Emergency SOS Priority Fee</span>
                    <span className="font-bold font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded">₹618.00</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="font-semibold">🏷️ Chronic Refill Patient Discount</span>
                    <span className="font-bold font-mono text-teal-600 bg-teal-50 px-2 py-0.5 rounded">10% OFF</span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-gradient-to-b from-teal-50 to-slate-50 rounded-2xl border border-teal-200 space-y-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-600" /> ₹1,000 Automated Safety Buffer &amp; Pool
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  All settlements are executed atomically at the Postgres database boundary. The clinic maintains an automated ₹1,000 Commission Safety Pool to handle cash settlements and instant payouts.
                </p>
                <div className="p-3.5 bg-white rounded-xl border border-teal-200/80 text-xs text-teal-900 font-medium space-y-1">
                  <div>✔ Direct automated payouts to Doctor Bank / UPI.</div>
                  <div>✔ Automated deduction on counter cash collections.</div>
                  <div>✔ 100% transparent audit ledger in Doctor Financials tab.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
            <span>You have 100% autonomy to change your SOP percentages whenever you want.</span>
            <span className="text-emerald-400 font-bold">Next: The 2-Touchpoint Care Loop →</span>
          </div>
        </section>

        {/* ── SLIDE 6: THE 2-TOUCHPOINT CARE LOOP ─────────────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                <Zap className="w-4 h-4" /> Outpatient Care Engine
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 6 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">The 2-Touchpoint WhatsApp Care Loop</h2>
            <p className="text-sm text-slate-600 mt-1">Eliminating evening crowds while capturing 100% of prescription fulfillment.</p>

            <div className="space-y-4 mt-6">
              {/* Touchpoint 1 */}
              <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Morning In-Person Consult (Clinic OPD)</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Compounder captures vitals and assigns token. Doctor examines patient, uses AI Scribe to generate digital prescription, and orders required blood tests.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase shrink-0">
                  Token #TK-001
                </span>
              </div>

              {/* Touchpoint 2 */}
              <div className="p-4.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Evening Lab Report Review on WhatsApp</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      When partner lab approves blood test results, WhatsApp automatically delivers the PDF report with two 1-Tap native buttons:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2.5 py-0.5 bg-white border border-emerald-300 rounded-lg text-emerald-800 text-[10px] font-bold shadow-xs">
                        🏥 Option A: Physical Review at Clinic (Primary Default)
                      </span>
                      <span className="px-2.5 py-0.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-[10px] font-bold shadow-xs">
                        💻 Option B: Virtual Video Review (Emergency / Busy Fallback)
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase shrink-0">
                  Sub-300ms Dispatch
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mt-6">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              🎁 1 Free Virtual Consult
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              🏷️ 10% Off Medicine Refills
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              📱 Daily WhatsApp Reminders
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              📄 Instant Verified PDFs
            </div>
          </div>
        </section>

        {/* ── SLIDE 7: 4 IRRESISTIBLE PATIENT BENEFITS ────────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider">
                <Award className="w-4 h-4" /> Patient Loyalty Engine
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 7 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">4 Benefits That Make Patients 100% Loyal To You</h2>
            <p className="text-sm text-slate-600 mt-1">Why patients will choose your virtual hospital over unorganized standalone clinics.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="text-sm font-bold text-slate-900">1 Free Virtual Follow-Up Consult</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Valid for 15–20 days after clinic visit. Patients can clarify medicine doses or symptom relief over WhatsApp video without travelling or paying twice.
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="text-sm font-bold text-slate-900">10% Off Chronic Medicine Refills</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Patients get an automatic 10% discount on 30-day medicine refills fulfilled through your partner pharmacy, saving families thousands of rupees annually.
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h3 className="text-sm font-bold text-slate-900">Daily WhatsApp Reminders &amp; AI Health Chart</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The automated WhatsApp bot sends morning and evening dose alerts (1-0-1) and tracks vital trends into longitudinal graphical health summaries.
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <h3 className="text-sm font-bold text-slate-900">Instant PDF Lab Reports on WhatsApp</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Zero waiting in lab queues. High-resolution NABL-standard PDF reports are delivered to the patient's phone the minute the pathologist signs off.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
            <span>Patients stay within your ecosystem forever instead of wandering to external pharmacies.</span>
            <span className="text-emerald-400 font-bold">Next: Chronic Disease Care Goldmine →</span>
          </div>
        </section>

        {/* ── SLIDE 8: THE CHRONIC PATIENT GOLDMINE ───────────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                <HeartPulse className="w-4 h-4" /> High Recurring Practice Value
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 8 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">The Chronic Patient Goldmine &amp; Refill Engine</h2>
            <p className="text-sm text-slate-600 mt-1">Turning one-time consultations into predictable, 10-year monthly practice income.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <h3 className="text-sm font-bold text-slate-900">8 Supported Chronic Protocols</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium">🩸 Type-2 Diabetes</div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium">🫀 Essential HTN</div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium">🦋 Hypothyroidism</div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium">🧪 CAD / Dyslipidemia</div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium">🫁 Asthma / COPD</div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium">🦴 Arthritis / OA</div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium">🔬 CKD Stage 1–3</div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium">⚡ Epilepsy</div>
                </div>
              </div>

              <div className="p-5 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2.5">
                <h3 className="text-sm font-bold text-slate-900">Automated Cron Automation</h3>
                <ul className="text-xs text-slate-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Day-25 WhatsApp 1-Tap Refill:</strong> Proactively prompts patient before pills run out: <span className="font-mono bg-white px-1 py-0.5 rounded border">[📦 Confirm 1-Click Refill]</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Day-75 Diagnostic Loop:</strong> Auto-schedules repeat HbA1c, Lipid, and TSH blood tests.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Refill Defaulter Safety Net:</strong> Highlights high-risk patients who missed medicines by &gt;7 days with 1-Tap WhatsApp Nudges.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
            <span>Clinical adherence improves by 42%, while practice revenue scales reliably.</span>
            <span className="text-emerald-400 font-bold">Next: AI Clinical Voice Scribe &amp; EMR →</span>
          </div>
        </section>

        {/* ── SLIDE 9: AI CLINICAL VOICE SCRIBE & MULTI-SPECIALTY EMR ─── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider">
                <Headphones className="w-4 h-4" /> Sub-2 Second Voice Scribing
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 9 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">AI Clinical Voice Scribe &amp; Multi-Specialty EMR</h2>
            <p className="text-sm text-slate-600 mt-1">Speak naturally in English or Hinglish. Zero typing required during busy OPD hours.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              <div className="p-5 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Headphones className="w-5 h-5 text-indigo-600" /> Groq Llama-3 70B + Gemini AI Engine
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Doctor taps the microphone and speaks: <em>"Patient complains of chest pain since 2 days, BP 140/90, prescribe Telmisartan 40mg 1-0-0 and ECG."</em>
                </p>
                <div className="p-3 bg-white rounded-xl border border-indigo-200 text-xs font-mono text-indigo-950 space-y-1">
                  <div>✔ Auto-extracts Complaints, Vitals, Diagnosis.</div>
                  <div>✔ Generates structured 1-0-1 dosage cards.</div>
                  <div>✔ Auto-populates pharmacy delivery &amp; lab worklist.</div>
                </div>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-teal-600" /> Multi-Specialty Adaptive Workspaces
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <strong>👁️ Ophthalmology:</strong> Auto-calculates RE/LE Sph/Cyl/Axis, IOP, Fundus, Biometry.
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <strong>🫀 Cardiology &amp; General Medicine:</strong> Chronic protocol adherence and ECG trackers.
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <strong>👶 Pediatrics &amp; Dermatology:</strong> Growth milestone charts and image lesion analysis.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
            <span>Prescription generation time drops from 4 minutes to under 20 seconds.</span>
            <span className="text-emerald-400 font-bold">Next: Compounder OPD Desk →</span>
          </div>
        </section>

        {/* ── SLIDE 10: COMPOUNDER OPD DESK & EMERGENCY SOS ROUTING ───── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-rose-600 text-xs font-bold uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4" /> Streamlined OPD Operations
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 10 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">Compounder OPD Desk &amp; Emergency SOS Priority</h2>
            <p className="text-sm text-slate-600 mt-1">Empower your assistant to manage patient queues, vitals, and payments without disturbing you.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                  #TK
                </div>
                <h3 className="text-sm font-bold text-slate-900">Digital Token System</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Issues printed thermal tokens (#TK-001) or WhatsApp SMS tokens for walk-in OPD queues.
                </p>
              </div>

              <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Pre-Consult Vitals Entry</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Records BP, Sugar, Pulse, Temp, SpO2, and BMI with automatic red-flag alert warnings.
                </p>
              </div>

              <div className="p-4.5 bg-rose-50/80 rounded-2xl border border-rose-200 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
                  🚨
                </div>
                <h3 className="text-sm font-bold text-slate-900">Priority #1 SOS Routing</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Emergency SOS cases jump straight to Position #1 at the top of Doctor EMR with a pulsing red banner.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 mt-5">
              <strong>15-Minute Eye Dilation Countdown:</strong> Compounder triggers one-click dilation timer; Doctor EMR alerts the physician the exact second pupils are ready for fundus examination.
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
            <span>Clean, peaceful OPD queue management with zero shouting or chaos.</span>
            <span className="text-emerald-400 font-bold">Next: Legal Shield &amp; Ethics →</span>
          </div>
        </section>

        {/* ── SLIDE 11: LEGAL SHIELD & NMC COMPLIANCE ─────────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-teal-600 text-xs font-bold uppercase tracking-wider">
                <Scale className="w-4 h-4" /> Medical Ethics &amp; Protection
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 11 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">100% Legal Shield &amp; NMC Ethics Compliance</h2>
            <p className="text-sm text-slate-600 mt-1">Architected to keep doctors 100% safe, legally protected, and compliant with all medical regulations.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900">1. NMC Ethics Alignment</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Doctor Consultation fees are 100% untouched. VitalSync does not take fee splits from professional medical consultations, ensuring zero violation of National Medical Commission regulations.
                </p>
              </div>

              <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900">2. Tripartite B2B Agreements</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pharmacy and pathology coordination fees are legally classified as technical infrastructure &amp; logistics service fees for inventory hold management and digital routing — NOT informal kickbacks.
                </p>
              </div>

              <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900">3. Telemedicine Guidelines 2020</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  All virtual video consults enforce explicit patient digital consent, registered practitioner verification, and digital prescription safeguards mandated by the Ministry of Health (MoHFW).
                </p>
              </div>
            </div>

            <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl text-xs text-teal-950 mt-5 font-medium">
              📄 Complete legal terms, business associate agreements, and privacy frameworks are codified in your portal at <span className="font-mono font-bold">/legal</span>.
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
            <span>Peace of mind. Zero legal ambiguity. Full institutional backing.</span>
            <span className="text-emerald-400 font-bold">Next: Practice Revenue Simulator →</span>
          </div>
        </section>

        {/* ── SLIDE 12: PRACTICE REVENUE SIMULATOR ───────────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                <TrendingUp className="w-4 h-4" /> Practice Income Expansion
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 12 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">Practice Revenue Simulator (Real Clinic Numbers)</h2>
            <p className="text-sm text-slate-600 mt-1">Demonstration for an average clinic seeing 25 OPD patients per day (600 visits/month).</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold uppercase text-slate-500">Without VitalSync (Traditional Model)</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between pb-2 border-b border-slate-200">
                    <span>OPD Consultations (600 × ₹500)</span>
                    <span className="font-bold font-mono">₹3,00,000</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-200 text-rose-600">
                    <span>Pharmacy Refills</span>
                    <span className="font-bold font-mono">₹0 (Lost to market)</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-200 text-rose-600">
                    <span>Pathology Diagnostics</span>
                    <span className="font-bold font-mono">₹0 (Lost to market)</span>
                  </div>
                  <div className="flex justify-between pt-2 text-sm font-bold text-slate-900">
                    <span>Total Monthly Income</span>
                    <span className="font-mono">₹3,00,000</span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-lg space-y-3">
                <div className="text-xs font-bold uppercase text-emerald-200">With VitalSync Virtual Hospital</div>
                <div className="space-y-2 text-xs text-emerald-50">
                  <div className="flex justify-between pb-2 border-b border-white/20">
                    <span>Protected Consultations (100%)</span>
                    <span className="font-bold font-mono text-white">₹3,00,000</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-white/20">
                    <span>Chronic Refill Split (25% on ₹4.5L pool)</span>
                    <span className="font-bold font-mono text-emerald-200">+₹1,12,500</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-white/20">
                    <span>Pathology Split (35% on ₹2.4L pool)</span>
                    <span className="font-bold font-mono text-emerald-200">+₹84,000</span>
                  </div>
                  <div className="flex justify-between pt-2 text-base font-black text-white">
                    <span>New Monthly Income</span>
                    <span className="font-mono">₹4,96,500</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-950 mt-5">
              <span className="text-xs font-bold">Net Practice Increase: +₹1,96,500 / Month (+65.5% Growth)</span>
              <span className="text-xs font-mono font-bold text-emerald-700">₹23,58,000 / Year Extra Value</span>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
            <span>Higher patient retention + Better health outcomes + Predictable practice cash flow.</span>
            <span className="text-emerald-400 font-bold">Next: Doctor FAQs &amp; Objections →</span>
          </div>
        </section>

        {/* ── SLIDE 13: DOCTOR FAQS & OBJECTIONS DEMOLISHER ─────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider">
                <HelpCircle className="w-4 h-4" /> Frequently Asked Questions
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 13 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">Doctor FAQs &amp; Addressing All Concerns</h2>
            <p className="text-sm text-slate-600 mt-1">Everything you need to know about partnering with VitalSync.</p>

            <div className="space-y-3.5 mt-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  Q: "Do I or my patients need to install any new apps?"
                </div>
                <p className="text-[11px] text-slate-600 pl-6 leading-relaxed">
                  <strong>No.</strong> Patients receive everything naturally on WhatsApp. Doctors and compounders access a fast, clean web dashboard on any laptop, tablet, or mobile phone.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  Q: "How do cash collections at the counter work with our revenue split?"
                </div>
                <p className="text-[11px] text-slate-600 pl-6 leading-relaxed">
                  When the compounder collects cash, you keep 100% of the physical cash in your drawer. The platform coordination share is automatically reconciled from the pre-funded Commission Pool balance.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  Q: "Can I choose my own chemist and pathology lab?"
                </div>
                <p className="text-[11px] text-slate-600 pl-6 leading-relaxed">
                  <strong>Yes, absolutely.</strong> You have 100% freedom to link your preferred local chemist down the street and your trusted diagnostic lab via their phone numbers.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  Q: "Is patient medical data secure and private?"
                </div>
                <p className="text-[11px] text-slate-600 pl-6 leading-relaxed">
                  <strong>100% Enterprise Security.</strong> End-to-end encryption with PostgreSQL Row-Level Security (RLS). Only you and your authorized staff can see clinical records.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
            <span>Zero risk. 100% control. Institutional growth.</span>
            <span className="text-emerald-400 font-bold">Next: How to Onboard in 5 Minutes →</span>
          </div>
        </section>

        {/* ── SLIDE 14: NEXT STEPS & 5-MINUTE ONBOARDING ─────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                <Building2 className="w-4 h-4" /> Fast Activation
              </div>
              <span className="text-xs font-bold text-slate-400">Slide 14 / 14</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900">Activate Your Virtual Hospital in 5 Minutes</h2>
            <p className="text-sm text-slate-600 mt-1">Zero hardware installation. Zero IT engineers needed. Go live today.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-center">
                <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white mx-auto flex items-center justify-center font-bold text-base">
                  1
                </div>
                <h3 className="text-sm font-bold text-slate-900">Scan WhatsApp QR</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Scan the clinic WhatsApp QR code to link your clinic WABA account. Takes under 2 minutes.
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-center">
                <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white mx-auto flex items-center justify-center font-bold text-base">
                  2
                </div>
                <h3 className="text-sm font-bold text-slate-900">Link Partner Chemist &amp; Lab</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Invite your trusted local chemist and diagnostic lab using their phone number or 6-digit clinic invite code.
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-center">
                <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white mx-auto flex items-center justify-center font-bold text-base">
                  3
                </div>
                <h3 className="text-sm font-bold text-slate-900">Set SOP Splits</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Confirm your pharmacy and pathology coordination splits and start printing digital OPD tokens immediately.
                </p>
              </div>
            </div>

            {/* Direct Contact Callout */}
            <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl mt-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-white/10">
              <div className="space-y-1">
                <div className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" /> Ready to Elevate Your Clinic?
                </div>
                <div className="text-xs text-slate-300">
                  Schedule your 5-minute VIP onboarding walkthrough right now with our Executive Lead.
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <a 
                  href="tel:+919608032073" 
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md no-underline"
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

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-950 mt-4">
            <span className="font-bold">VitalSync Smart Virtual Hospital Network</span>
            <span>Empowering Tier 2 &amp; Tier 3 Healthcare Providers Across India</span>
          </div>
        </section>

      </div>
    </div>
  );
};
