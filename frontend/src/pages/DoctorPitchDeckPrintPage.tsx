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
  AlertTriangle
} from 'lucide-react';

export const DoctorPitchDeckPrintPage: React.FC = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white print:text-black p-4 md:p-8 font-sans">
      {/* Floating Print Bar (Hidden in Print Mode) */}
      <div className="fixed bottom-6 right-6 z-50 print:hidden flex items-center gap-3 bg-slate-900/90 backdrop-blur-md text-white p-3 px-5 rounded-2xl shadow-2xl border border-white/20 animate-bounce">
        <div className="text-xs font-semibold">
          🖨️ Ready to print or export as PDF
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 cursor-pointer border-0"
        >
          <Printer className="w-4 h-4" /> Print Master Deck (A4)
        </button>
      </div>

      <div className="max-w-5xl mx-auto space-y-12 print:space-y-0">

        {/* ── SLIDE 1: COVER SLIDE ────────────────────────────────────── */}
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
                Doctor Partnership Master Deck
              </span>
            </div>

            <div className="space-y-4 my-10">
              <span className="inline-block px-3 py-1 rounded-lg bg-teal-100 text-teal-800 text-xs font-bold uppercase tracking-wide">
                Exclusively For Independent Doctors &amp; Clinics
              </span>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight">
                Transform Your Clinic Into A <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Smart Virtual Hospital</span> On WhatsApp
              </h2>
              <p className="text-lg md:text-xl text-slate-600 max-w-3xl font-medium leading-relaxed">
                Connect your OPD, local chemist, and diagnostic lab into an automated, hospital-grade network. Protect your patients, boost chronic adherence, and unlock recurring revenue with <strong className="text-slate-900">₹0 setup cost</strong>.
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
              <div className="text-xl font-black text-slate-900 mt-1">100% IMMUNE</div>
              <div className="text-[11px] text-slate-500 mt-0.5">0% Platform Deductions</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="text-xs font-bold uppercase text-slate-500">WhatsApp Engine</div>
              <div className="text-xl font-black text-slate-900 mt-1">SUB-300ms</div>
              <div className="text-[11px] text-slate-500 mt-0.5">1-Tap Interactive Buttons</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="text-xs font-bold uppercase text-slate-500">Legal Shield</div>
              <div className="text-xl font-black text-teal-600 mt-1">NMC COMPLIANT</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Tripartite Care Framework</div>
            </div>
          </div>
        </section>

        {/* ── SLIDE 2: THE PROBLEM / SILENT LEAKAGE ────────────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-rose-600 text-xs font-bold uppercase tracking-wider mb-2">
              <AlertTriangle className="w-4 h-4" /> The Ground Reality Today
            </div>
            <h2 className="text-3xl font-black text-slate-900">Where 60% of Your Clinic Revenue &amp; Care is Leaking</h2>
            <p className="text-sm text-slate-600 mt-1">Independent clinics deliver 80% of healthcare in Tier 2 &amp; 3 cities, but lose out on the recurring care loop.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8">
              <div className="p-6 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
                  <Coins className="w-5 h-5 text-rose-600" /> 1. The One-Time Consultation Trap
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Doctor earns a one-time ₹500 fee. But the patient spends ₹2,500/month on medicines and tests for 10+ years at external, disconnected shops where the doctor has zero oversight or reward.
                </p>
              </div>

              <div className="p-6 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
                  <Pill className="w-5 h-5 text-rose-600" /> 2. Generic Pharmacy Substitution
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  External chemists often substitute your prescribed branded medicines with high-margin generic brands without your consent, harming patient clinical outcomes.
                </p>
              </div>

              <div className="p-6 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
                  <HeartPulse className="w-5 h-5 text-rose-600" /> 3. 60% Chronic Care Defaulters
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Diabetic and hypertensive patients forget to refill medications on Day 25 and skip their 90-day repeat HbA1c/Lipid profile checks, leading to preventable complications.
                </p>
              </div>

              <div className="p-6 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
                  <Clock className="w-5 h-5 text-rose-600" /> 4. Chaotic Evening Report Follow-Ups
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Patients call personal mobile numbers and crowd your clinic at 7:00 PM just to show test report printouts, creating fatigue and OPD overcrowding.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between mt-6">
            <span className="text-xs font-semibold">VitalSync unifies these fragmented touchpoints into one seamless, automated loop.</span>
            <span className="text-xs font-bold text-emerald-400">Next: The Virtual Triad →</span>
          </div>
        </section>

        {/* ── SLIDE 3: THE VIRTUAL HOSPITAL TRIAD ─────────────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4" /> The VitalSync Architecture
            </div>
            <h2 className="text-3xl font-black text-slate-900">The Category-Defining Virtual Hospital Triad</h2>
            <p className="text-sm text-slate-600 mt-1">You remain 100% independent while commanding a hospital-grade outpatient ecosystem.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              {/* Doctor */}
              <div className="p-6 bg-gradient-to-b from-indigo-50/80 to-slate-50 rounded-2xl border border-indigo-200 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <Stethoscope className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-black text-slate-900">1. Doctor (You)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The Clinical Authority. Diagnoses patients, uses AI Scribe Prescriptions, and sets dynamic SOP revenue splits.
                </p>
                <div className="text-[11px] font-bold text-indigo-700 bg-indigo-100/70 py-1 px-2 rounded-lg">
                  100% Free • ₹0 Subscription
                </div>
              </div>

              {/* Chemist */}
              <div className="p-6 bg-gradient-to-b from-emerald-50/80 to-slate-50 rounded-2xl border border-emerald-200 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <Pill className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-black text-slate-900">2. Partner Chemist</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Local pharmacy linked to your OPD. Receives 1-Click Refills, delivers doorstep medicines, and provides 10% patient discounts.
                </p>
                <div className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 py-1 px-2 rounded-lg">
                  20%–30% Transparent Split
                </div>
              </div>

              {/* Lab */}
              <div className="p-6 bg-gradient-to-b from-purple-50/80 to-slate-50 rounded-2xl border border-purple-200 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <TestTube2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-black text-slate-900">3. Partner Lab</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Diagnostic lab with LOINC worklist integration. Dispatches home blood sample collection and pushes verified instant PDF reports.
                </p>
                <div className="text-[11px] font-bold text-purple-700 bg-purple-100/70 py-1 px-2 rounded-lg">
                  30%–40% Transparent Split
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-4 mt-6">
            <MessageSquare className="w-8 h-8 text-emerald-600 shrink-0" />
            <div className="text-xs text-emerald-950">
              <strong>Zero Patient Apps Required:</strong> Patients interact naturally on WhatsApp. No app downloads, no logins, no technical resistance.
            </div>
          </div>
        </section>

        {/* ── SLIDE 4: THE 2-TOUCHPOINT CARE LOOP ─────────────────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-teal-600 text-xs font-bold uppercase tracking-wider mb-2">
              <Zap className="w-4 h-4" /> Seamless Outpatient Workflow
            </div>
            <h2 className="text-3xl font-black text-slate-900">The 2-Touchpoint WhatsApp Care Loop</h2>
            <p className="text-sm text-slate-600 mt-1">Eliminating chaotic evening crowds while securing 100% pharmacy fulfillment.</p>

            <div className="space-y-6 mt-8">
              {/* Touchpoint 1 */}
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Morning In-Person Consult (Clinic OPD)</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Compounder captures vitals and assigns token. Doctor examines patient, uses AI Scribe to prescribe, and orders blood tests.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-[11px] font-bold uppercase shrink-0">
                  Token #TK-001
                </span>
              </div>

              {/* Touchpoint 2 */}
              <div className="p-6 bg-emerald-50/60 rounded-2xl border border-emerald-200 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Evening Lab Report Review on WhatsApp</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Upon lab report approval, WhatsApp dispatches the PDF with two 1-Tap native buttons:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-emerald-800 text-[10px] font-bold shadow-xs">
                        🏥 Physical Review at Clinic (Primary Default)
                      </span>
                      <span className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-800 text-[10px] font-bold shadow-xs">
                        💻 Virtual Video Review (Busy Fallback)
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase shrink-0">
                  Instant Dispatch
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
              📄 Verified PDF Reports
            </div>
          </div>
        </section>

        {/* ── SLIDE 5: CHRONIC GOLDMINE & REVENUE EXPANSION ───────────── */}
        <section className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-2">
              <TrendingUp className="w-4 h-4" /> Practice Revenue Multiplier
            </div>
            <h2 className="text-3xl font-black text-slate-900">The Chronic Patient Goldmine &amp; Financial Impact</h2>
            <p className="text-sm text-slate-600 mt-1">A consultation is a one-time ₹500 fee. Chronic care is a 10-year recurring revenue stream.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Chronic Engine */}
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <HeartPulse className="w-5 h-5 text-rose-500" /> Automated Chronic Refill Loops
                </h3>
                <ul className="text-xs text-slate-600 space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <strong>Day-25 WhatsApp Refill Engine:</strong> 1-Tap native buttons confirm 30-day refills at 10% discount.
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <strong>Day-75 Diagnostic Loop:</strong> Auto-books repeat HbA1c &amp; Lipid panels.
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <strong>Defaulter Safety Net:</strong> Proactively nudges patients who miss BP pills by &gt;7 days.
                  </li>
                </ul>
              </div>

              {/* Income Simulator */}
              <div className="p-6 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-lg space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-200">Practice Revenue Simulator</div>
                <div className="text-3xl font-black">+₹1,96,500 <span className="text-sm font-normal text-emerald-100">/ month</span></div>
                <p className="text-xs text-emerald-100 leading-relaxed">
                  Based on 25 patients/day OPD with 25% pharmacy refill split and 35% pathology split.
                </p>
                <div className="pt-2 border-t border-white/20 text-[11px] text-emerald-200">
                  ✔ 100% of Doctor Consultation fee stays untouched.
                </div>
              </div>
            </div>

            {/* Legal Shield */}
            <div className="p-4 bg-slate-100 rounded-xl border border-slate-300/80 flex items-center gap-3 mt-6">
              <Scale className="w-6 h-6 text-slate-700 shrink-0" />
              <div className="text-[11px] text-slate-700">
                <strong>100% NMC Ethics Compliant:</strong> Structured under formal Tripartite Care Coordination Agreements with explicit patient consent and protected physician consultation fees.
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between mt-6">
            <span className="text-xs font-semibold">Join the network today. Set up in 5 minutes with ₹0 investment.</span>
            <span className="text-xs font-bold text-emerald-400">VitalSync Health Network</span>
          </div>
        </section>

      </div>
    </div>
  );
};
