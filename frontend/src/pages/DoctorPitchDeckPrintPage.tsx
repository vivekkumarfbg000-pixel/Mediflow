import React, { useState, useEffect, useMemo } from 'react';
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
  Calculator,
  CalendarCheck,
  Share2,
  ChevronRight
} from 'lucide-react';

export const DoctorPitchDeckPrintPage: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState<number>(1);
  const [dailyPatients, setDailyPatients] = useState<number>(25);
  const [avgMedicinePerPatient, setAvgMedicinePerPatient] = useState<number>(1200);
  const [avgLabPerPatient, setAvgLabPerPatient] = useState<number>(800);
  const [pharmacySplit, setPharmacySplit] = useState<number>(25);
  const [labSplit, setLabSplit] = useState<number>(35);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        prevSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ROI Calculations
  const monthlyMetrics = useMemo(() => {
    const monthlyPatients = dailyPatients * 26; // 26 clinic working days
    const monthlyOpdRevenue = monthlyPatients * 500;
    
    // 60% of patients need medicines, 35% need lab investigations
    const monthlyPharmPatients = Math.round(monthlyPatients * 0.60);
    const monthlyLabPatients = Math.round(monthlyPatients * 0.35);
    
    const monthlyMedVolume = monthlyPharmPatients * avgMedicinePerPatient;
    const monthlyLabVolume = monthlyLabPatients * avgLabPerPatient;

    const doctorMedAdvisorySplit = monthlyMedVolume * (pharmacySplit / 100);
    const doctorLabInterpretationSplit = monthlyLabVolume * (labSplit / 100);

    const totalNewIncome = doctorMedAdvisorySplit + doctorLabInterpretationSplit;
    const totalPracticeRevenue = monthlyOpdRevenue + totalNewIncome;

    return {
      monthlyPatients,
      monthlyOpdRevenue,
      monthlyMedVolume,
      monthlyLabVolume,
      doctorMedAdvisorySplit,
      doctorLabInterpretationSplit,
      totalNewIncome,
      totalPracticeRevenue
    };
  }, [dailyPatients, avgMedicinePerPatient, avgLabPerPatient, pharmacySplit, labSplit]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased selection:bg-teal-500 selection:text-white pb-24 print:bg-white print:text-slate-900 print:pb-0">
      
      {/* ── Fixed Presentation Navigation Toolbar (Hidden in Print) ── */}
      <header className="sticky top-0 z-50 print:hidden bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 px-4 md:px-8 py-3.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                <span>VitalSync</span>
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-teal-400 bg-teal-950/80 px-2.5 py-0.5 rounded-full border border-teal-800/80">
                  Doctor Partnership Pitch
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Smart Virtual Hospital Network • Executive Presentation</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Slide Quick Jumper */}
            <div className="hidden sm:flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700">
              <button
                onClick={prevSlide}
                disabled={activeSlide === 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer border-0"
                title="Previous Slide (Left Arrow)"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-mono font-bold text-teal-400">
                Slide {String(activeSlide).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
              </span>
              <button
                onClick={nextSlide}
                disabled={activeSlide === totalSlides}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer border-0"
                title="Next Slide (Right Arrow)"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-teal-500/25 transition-all flex items-center gap-2 cursor-pointer border-0"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
          </div>
        </div>
      </header>

      {/* ── Slide Deck Container ── */}
      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-12 print:space-y-0 print:p-0 print:max-w-none">

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 01: COVER & EXECUTIVE PROPOSITION
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none print:hidden" />
          
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-8 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  01
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-400 bg-teal-950/80 px-3 py-1 rounded-full border border-teal-800/60 print:bg-teal-50 print:text-teal-800 print:border-teal-200">
                  Category-Defining Clinical Partnership
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 01 / 12</span>
            </div>

            <div className="space-y-6 max-w-4xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider border border-slate-700 print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                Exclusively For Independent Doctors, Surgeons &amp; Clinic Owners
              </div>
              
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-[1.12] print:text-slate-900">
                Your Clinic. <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 print:text-teal-600">Now a Hospital.</span>
              </h1>
              
              <p className="text-xl md:text-2xl font-bold text-teal-300 tracking-tight print:text-teal-800">
                Clinic Freedom. Hospital Revenue. On WhatsApp.
              </p>
              
              <p className="text-base md:text-lg text-slate-300 leading-relaxed font-normal print:text-slate-700">
                Unite your OPD consultation room with your trusted neighborhood pharmacy and pathology laboratory into an automated, hospital-grade outpatient ecosystem. Deliver continuous chronic care, retain 100% patient loyalty, and unlock <strong className="text-white font-semibold print:text-slate-900">+₹1,00,000 to +₹2,50,000+ monthly recurring practice revenue</strong> with <strong className="text-teal-400 font-semibold print:text-teal-700">zero setup costs, zero SaaS fees, and zero change to your daily OPD workflow</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-slate-800 mt-8 print:border-slate-200">
            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 print:bg-slate-50 print:border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500">Adoption Cost</div>
              <div className="text-xl font-black text-teal-400 mt-1 print:text-teal-700">₹0 Setup / ₹0 SaaS</div>
              <div className="text-[11px] text-slate-400 mt-0.5 print:text-slate-600">100% Free Lifetime Access</div>
            </div>
            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 print:bg-slate-50 print:border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500">Doctor Consultation</div>
              <div className="text-xl font-black text-white mt-1 print:text-slate-900">100% Protected</div>
              <div className="text-[11px] text-slate-400 mt-0.5 print:text-slate-600">0% Platform Deductions (Rule 58)</div>
            </div>
            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 print:bg-slate-50 print:border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500">Patient Adoption</div>
              <div className="text-xl font-black text-white mt-1 print:text-slate-900">Zero Apps</div>
              <div className="text-[11px] text-slate-400 mt-0.5 print:text-slate-600">100% Native WhatsApp Chat</div>
            </div>
            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 print:bg-slate-50 print:border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500">Clinical Workflow</div>
              <div className="text-xl font-black text-emerald-400 mt-1 print:text-emerald-700">Zero Disruption</div>
              <div className="text-[11px] text-slate-400 mt-0.5 print:text-slate-600">Assistant manages queue &amp; vitals</div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 02: PROBLEM 1 — THE ₹5,000 PATIENT WALLET INEQUALITY
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-rose-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  02
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-rose-400 bg-rose-950/80 px-3 py-1 rounded-full border border-rose-800/60 print:bg-rose-50 print:text-rose-800 print:border-rose-200">
                  The Clinical &amp; Revenue Problem
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 02 / 12</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight print:text-slate-900">
              The ₹5,000 Patient Wallet Inequality
            </h2>
            <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl print:text-slate-600">
              Every individual patient spends almost <strong>₹3,000 to ₹5,000</strong> on their complete clinical journey across your Clinic, Diagnostic Blood Tests, and Prescribed Medicines.
            </p>

            {/* Cognitive vs Financial Gap Visual */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/80 space-y-4 print:bg-slate-50 print:border-slate-200">
                <div className="flex items-center gap-2 text-teal-400 font-bold text-sm uppercase tracking-wide print:text-teal-800">
                  <Stethoscope className="w-4 h-4" /> 100% of Cognitive &amp; Clinical Work (Done by You)
                </div>
                <div className="space-y-2 text-xs text-slate-300 print:text-slate-700">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span><strong>Accurately diagnose</strong> the complex disease and symptoms.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span><strong>Interpret diagnostic lab reports</strong> and abnormal pathology biomarkers.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span><strong>Advise precise medication</strong>, active molecules, dosage frequencies (1-0-1), and drug safety precautions.</span>
                  </div>
                </div>
                <div className="p-3 bg-teal-950/60 rounded-xl border border-teal-800/60 text-xs font-semibold text-teal-300 print:bg-teal-50 print:border-teal-200 print:text-teal-800">
                  👨‍⚕️ You shoulder 100% of the medical liability and intellectual effort.
                </div>
              </div>

              <div className="p-6 bg-rose-950/30 rounded-2xl border border-rose-800/50 space-y-4 print:bg-rose-50 print:border-rose-200">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm uppercase tracking-wide print:text-rose-800">
                  <Coins className="w-4 h-4" /> But You Capture Only 10%–15% of the Revenue
                </div>
                <div className="space-y-2.5 text-xs text-slate-300 print:text-slate-700">
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 flex justify-between items-center print:bg-white print:border-slate-200">
                    <span>🏥 <strong>Independent Clinic:</strong> Only OPD Consultation Fee</span>
                    <span className="font-mono font-black text-rose-400 print:text-rose-600">₹500 (10%)</span>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 flex justify-between items-center print:bg-white print:border-slate-200">
                    <span>💊 <strong>External Chemist:</strong> Sells branded/generic medicines</span>
                    <span className="font-mono font-bold text-slate-400 print:text-slate-600">₹2,800 (56%)</span>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 flex justify-between items-center print:bg-white print:border-slate-200">
                    <span>🔬 <strong>Standalone Lab:</strong> Performs blood &amp; urine panels</span>
                    <span className="font-mono font-bold text-slate-400 print:text-slate-600">₹1,700 (34%)</span>
                  </div>
                </div>
                <div className="p-3 bg-rose-900/40 rounded-xl border border-rose-700/60 text-xs font-semibold text-rose-300 print:bg-rose-100 print:border-rose-300 print:text-rose-900">
                  ⚠️ <strong>Corporate Hospital Contrast:</strong> Corporate hospitals capture <strong>60%–70%</strong> of this ₹5,000 spend in-house because their lab &amp; pharmacy are digitally connected to the doctor.
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:bg-slate-100 print:border-slate-200 print:text-slate-800">
            <span className="text-slate-300 font-medium print:text-slate-700">VitalSync bridges this gap by turning your standalone clinic into an interconnected outpatient care network.</span>
            <span className="text-teal-400 font-bold print:text-teal-800">The Revenue Leap →</span>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 03: THE REVENUE LEAP — BEFORE VS AFTER
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  03
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/60 print:bg-emerald-50 print:text-emerald-800 print:border-emerald-200">
                  The Practice Economics
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 03 / 12</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight print:text-slate-900">
              Revenue Comparison: Today vs. With VitalSync
            </h2>
            <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl print:text-slate-600">
              Transforming your practice from a single episodic consultation fee to a continuous, institutional clinical revenue stream.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Status Quo Card */}
              <div className="p-6 bg-slate-800/60 rounded-3xl border border-slate-700 space-y-4 print:bg-slate-50 print:border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400 print:text-rose-700">Your Clinic Right Now</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 print:bg-rose-100 print:text-rose-800">Status Quo</span>
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-700/60 print:border-slate-200">
                    <span className="text-slate-300 print:text-slate-700">OPD Patient Consultation Fee</span>
                    <span className="font-mono font-bold text-white print:text-slate-900">₹500.00</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-700/60 text-slate-400 print:text-slate-500">
                    <span>Lab Report Interpretation Fee</span>
                    <span className="font-mono">₹0.00 (Lab keeps 100%)</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-700/60 text-slate-400 print:text-slate-500">
                    <span>Medication Advisory &amp; Dosage Fee</span>
                    <span className="font-mono">₹0.00 (Chemist keeps 100%)</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400 print:text-slate-500">
                    <span>Chronic Patient 30-Day Refill</span>
                    <span className="font-mono">₹0.00 (Lost to external shops)</span>
                  </div>
                </div>
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700/80 flex justify-between items-center print:bg-white print:border-slate-200">
                  <span className="text-xs font-bold text-slate-300 print:text-slate-700">Total Net Income per Patient:</span>
                  <span className="text-xl font-black text-white font-mono print:text-slate-900">₹500.00</span>
                </div>
              </div>

              {/* VitalSync Loop Card */}
              <div className="p-6 bg-gradient-to-br from-teal-950/60 to-emerald-950/60 rounded-3xl border border-teal-500/40 space-y-4 print:bg-teal-50/50 print:border-teal-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400 print:text-teal-800">With VitalSync Connected Loop</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-teal-900 text-teal-200 border border-teal-700 print:bg-teal-100 print:text-teal-900">3x Growth</span>
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-teal-900/60 print:border-teal-200">
                    <span className="text-teal-200 font-semibold print:text-slate-900">OPD Consultation Fee (100% Doctor)</span>
                    <span className="font-mono font-bold text-white print:text-slate-900">₹500.00</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-teal-900/60 text-teal-200 print:text-slate-800">
                    <span>🔬 Lab Interpretation Split (30%–40%)</span>
                    <span className="font-mono font-bold text-teal-400 print:text-teal-700">+₹350 – ₹600</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-teal-900/60 text-teal-200 print:text-slate-800">
                    <span>💊 Medication Advisory Split (20%–30%)</span>
                    <span className="font-mono font-bold text-teal-400 print:text-teal-700">+₹250 – ₹500</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-teal-200 print:text-slate-800">
                    <span>📦 Chronic 30-Day Refill Equity (Day 25)</span>
                    <span className="font-mono font-bold text-emerald-400 print:text-emerald-700">+₹150 – ₹300 / mo</span>
                  </div>
                </div>
                <div className="p-4 bg-teal-900/70 rounded-2xl border border-teal-500/50 flex justify-between items-center print:bg-white print:border-teal-300">
                  <span className="text-xs font-bold text-teal-100 print:text-teal-900">Total Net Income per Patient:</span>
                  <span className="text-2xl font-black text-teal-300 font-mono print:text-teal-800">₹1,250 – ₹1,900+</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:bg-slate-100 print:border-slate-200 print:text-slate-800">
            <span className="text-slate-300 font-medium print:text-slate-700">Doctors earn 2.5x to 3.8x higher practice revenue without spending an extra minute or rupee.</span>
            <span className="text-teal-400 font-bold print:text-teal-800">Problem 2: Patient Retention →</span>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 04: PROBLEM 2 — PATIENT RETENTION & FOLLOW-UP BLACK HOLE
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  04
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-950/80 px-3 py-1 rounded-full border border-amber-800/60 print:bg-amber-50 print:text-amber-800 print:border-amber-200">
                  The Clinical Retention Challenge
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 04 / 12</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight print:text-slate-900">
              Problem #2: Patient Records &amp; 65% Follow-Up Drop-Off
            </h2>
            <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl print:text-slate-600">
              Independent doctors struggle with 4 critical operational bottlenecks that leak patient loyalty and damage long-term clinical recovery.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              <div className="p-5 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-2 print:bg-slate-50 print:border-slate-200">
                <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm print:text-amber-800">
                  <FileText className="w-4 h-4 text-amber-400" /> 1. Lost Paper Prescriptions &amp; Records
                </div>
                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-700">
                  Patients lose their paper prescription slips or forget them at home. Doctors are forced to re-examine without knowing past baselines or drug reactions.
                </p>
              </div>

              <div className="p-5 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-2 print:bg-slate-50 print:border-slate-200">
                <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm print:text-amber-800">
                  <Activity className="w-4 h-4 text-amber-400" /> 2. Inaccessible Medical History
                </div>
                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-700">
                  In a fast-paced OPD with 30–50 patients waiting, finding past lab test values, BP trends, or allergy notes on paper takes valuable minutes you don't have.
                </p>
              </div>

              <div className="p-5 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-2 print:bg-slate-50 print:border-slate-200">
                <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm print:text-amber-800">
                  <Users className="w-4 h-4 text-amber-400" /> 3. 65% Follow-Up Attrition Rate
                </div>
                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-700">
                  The moment acute pain subsides, patients forget their Day-15 follow-up visit. The clinic has no automated communication channel to bring them back.
                </p>
              </div>

              <div className="p-5 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-2 print:bg-slate-50 print:border-slate-200">
                <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm print:text-amber-800">
                  <HeartPulse className="w-4 h-4 text-amber-400" /> 4. Chronic Patient Retention Leakage
                </div>
                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-700">
                  Diabetic and hypertensive patients take medicines for months without checkups, skip quarterly HbA1c tests, and switch to random substitutes at local chemists.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:bg-slate-100 print:border-slate-200 print:text-slate-800">
            <span className="text-slate-300 font-medium print:text-slate-700">VitalSync automates complete patient record tracking and follow-up loops on 24/7 WhatsApp.</span>
            <span className="text-teal-400 font-bold print:text-teal-800">The WhatsApp Solution →</span>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 05: THE 24/7 WHATSAPP CARE & EMR SOLUTION
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  05
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-400 bg-teal-950/80 px-3 py-1 rounded-full border border-teal-800/60 print:bg-teal-50 print:text-teal-800 print:border-teal-200">
                  The VitalSync Technology Suite
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 05 / 12</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight print:text-slate-900">
              1-Click EMR &amp; 24/7 WhatsApp Clinic Chatbot
            </h2>
            <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl print:text-slate-600">
              Maintaining 100% digital records on your Doctor Dashboard while our automated AI bot stays inside your patient's WhatsApp 24/7.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Doctor Dashboard Side */}
              <div className="p-6 bg-slate-800/60 rounded-3xl border border-slate-700 space-y-3.5 print:bg-slate-50 print:border-slate-200">
                <div className="flex items-center gap-2 text-teal-400 font-bold text-sm uppercase tracking-wider print:text-teal-800">
                  <Stethoscope className="w-4 h-4" /> 1. Doctor EMR Dashboard (Ultra-Fast)
                </div>
                <div className="space-y-2 text-xs text-slate-300 print:text-slate-700">
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-700 flex items-center gap-2 print:bg-white print:border-slate-200">
                    <Check className="w-4 h-4 text-teal-400 shrink-0" />
                    <span><strong>1-Click Medical History:</strong> Press <code className="bg-slate-800 px-1 py-0.5 rounded text-teal-300">Ctrl + K</code> to instantly pull up past vitals, prescriptions &amp; lab reports.</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-700 flex items-center gap-2 print:bg-white print:border-slate-200">
                    <Check className="w-4 h-4 text-teal-400 shrink-0" />
                    <span><strong>AI Voice Scribe:</strong> Speak Hindi or English notes; AI formats structured SOAP digital prescriptions.</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-700 flex items-center gap-2 print:bg-white print:border-slate-200">
                    <Check className="w-4 h-4 text-teal-400 shrink-0" />
                    <span><strong>Specialty Worksheets:</strong> Ophthalmic Refraction (RE/LE), Cardiology ECG, Pediatric growth charts.</span>
                  </div>
                </div>
              </div>

              {/* WhatsApp Patient Side */}
              <div className="p-6 bg-teal-950/40 rounded-3xl border border-teal-800/60 space-y-3.5 print:bg-teal-50/60 print:border-teal-200">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm uppercase tracking-wider print:text-emerald-800">
                  <MessageSquare className="w-4 h-4" /> 2. 24/7 Clinic Chatbot on Patient WhatsApp
                </div>
                <div className="space-y-2 text-xs text-slate-300 print:text-slate-700">
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-teal-900/60 flex items-center gap-2 print:bg-white print:border-teal-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Always Inside Patient's Chat:</strong> The patient never deletes WhatsApp. Your clinic is always 1 tap away.</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-teal-900/60 flex items-center gap-2 print:bg-white print:border-teal-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Automated Doctor Reminders:</strong> Sends timely follow-up notices on behalf of the doctor to bring patients back.</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-teal-900/60 flex items-center gap-2 print:bg-white print:border-teal-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>1-Tap Interactive Buttons:</strong> Patients book slots, review reports, and request refills with single-tap buttons.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:bg-slate-100 print:border-slate-200 print:text-slate-800">
            <span className="text-slate-300 font-medium print:text-slate-700">Zero app downloads. 100% of communication happens on native WhatsApp.</span>
            <span className="text-teal-400 font-bold print:text-teal-800">Chronic Care Goldmine →</span>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 06: CHRONIC PATIENT CARE & RECURRING REFILL GOLDMINE
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-indigo-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  06
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60 print:bg-indigo-50 print:text-indigo-800 print:border-indigo-200">
                  Lifelong Care Loop
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 06 / 12</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight print:text-slate-900">
              The Chronic Patient Goldmine &amp; Connected Care Loop
            </h2>
            <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl print:text-slate-600">
              Chronic patients (Diabetes, Hypertension, Thyroid, Heart Disease) need treatment for 10–20+ years. VitalSync gives them the reassurance that their doctor genuinely cares for them.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="p-4.5 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-2 print:bg-slate-50 print:border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Proactive Care Reminders</h3>
                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-600">
                  Doctor's chatbot sends daily morning &amp; evening dose reminders (1-0-1), giving patients assurance that their doctor is actively monitoring them.
                </p>
              </div>

              <div className="p-4.5 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-2 print:bg-slate-50 print:border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Day-25 1-Tap Refills</h3>
                <p className="text-xs text-slate-600 leading-relaxed print:text-slate-600">
                  On Day 25, WhatsApp prompts: <em>"Aapki dawa 5 din me khatam hogi. 10% discount ke saath refill order karein?"</em> with 1-Tap native confirm button.
                </p>
              </div>

              <div className="p-4.5 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-2 print:bg-slate-50 print:border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">90-Day Diagnostic Re-Tests</h3>
                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-600">
                  Proactively schedules quarterly home blood collection for HbA1c, Lipid Profile, Creatinine, ensuring clinical safety and lab revenue.
                </p>
              </div>

              <div className="p-4.5 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-2 print:bg-slate-50 print:border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Paid Consultation Loop</h3>
                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-600">
                  Patients pay their routine consultation fee either in-clinic or via 1-click video review, keeping them bound to your practice forever.
                </p>
              </div>
            </div>

            {/* Refill Defaulter Safety Net Callout */}
            <div className="p-4 bg-teal-950/50 rounded-2xl mt-5 border border-teal-800/60 flex items-center justify-between gap-4 print:bg-teal-50 print:border-teal-200">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-teal-400 shrink-0" />
                <span className="text-xs text-teal-200 font-medium print:text-teal-900">
                  <strong>Refill Defaulter Safety Net:</strong> If a chronic patient misses their refill by &gt;7 days, your EMR alerts you with a 1-Tap WhatsApp outreach button to prevent health complications.
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:bg-slate-100 print:border-slate-200 print:text-slate-800">
            <span className="text-slate-300 font-medium print:text-slate-700">Turn one-time walk-ins into 10-year recurring patient relationships.</span>
            <span className="text-teal-400 font-bold print:text-teal-800">The VIP Member Benefits →</span>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 07: THE 6 VIP MEMBER BENEFITS (THE PATIENT MAGNET)
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  07
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-400 bg-teal-950/80 px-3 py-1 rounded-full border border-teal-800/60 print:bg-teal-50 print:text-teal-800 print:border-teal-200">
                  The Patient Magnet
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 07 / 12</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight print:text-slate-900">
              Why Patients LOVE Buying From Your Connected Loop
            </h2>
            <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl print:text-slate-600">
              When patients purchase medicines and tests from your partnered pharmacy and lab, their WhatsApp instantly unlocks <strong>6 VIP Club Benefits</strong>:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-1.5 print:bg-slate-50 print:border-slate-200">
                <div className="text-xl">📄</div>
                <h3 className="text-xs font-bold text-white print:text-slate-900">1. Instant WhatsApp PDF Lab Reports</h3>
                <p className="text-[11px] text-slate-300 leading-relaxed print:text-slate-600">
                  Delivered the second the lab creates the report. <strong>Zero revisiting the lab</strong> or waiting in queues.
                </p>
              </div>

              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-1.5 print:bg-slate-50 print:border-slate-200">
                <div className="text-xl">🗣️</div>
                <h3 className="text-xs font-bold text-white print:text-slate-900">2. Hinglish AI Lab Report Analysis</h3>
                <p className="text-[11px] text-slate-300 leading-relaxed print:text-slate-600">
                  Plain-language audio &amp; text summaries explaining what high/low biomarkers mean in simple words.
                </p>
              </div>

              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-1.5 print:bg-slate-50 print:border-slate-200">
                <div className="text-xl">💊</div>
                <h3 className="text-xs font-bold text-white print:text-slate-900">3. Daily Dosage Reminders</h3>
                <p className="text-[11px] text-slate-300 leading-relaxed print:text-slate-600">
                  Morning &amp; evening alerts (1-0-1) with voice instructions so patients never skip crucial doses.
                </p>
              </div>

              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-1.5 print:bg-slate-50 print:border-slate-200">
                <div className="text-xl">🎁</div>
                <h3 className="text-xs font-bold text-white print:text-slate-900">4. 1 Free Virtual Follow-Up Consult</h3>
                <p className="text-[11px] text-slate-300 leading-relaxed print:text-slate-600">
                  Valid for 15–20 days. Patients can clarify symptoms over WhatsApp video review without paying again.
                </p>
              </div>

              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-1.5 print:bg-slate-50 print:border-slate-200">
                <div className="text-xl">🏷️</div>
                <h3 className="text-xs font-bold text-white print:text-slate-900">5. 10% OFF Chronic Medicine Refills</h3>
                <p className="text-[11px] text-slate-300 leading-relaxed print:text-slate-600">
                  Guaranteed 10% discount on recurring 30-day medicine orders, saving families thousands annually.
                </p>
              </div>

              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-1.5 print:bg-slate-50 print:border-slate-200">
                <div className="text-xl">📊</div>
                <h3 className="text-xs font-bold text-white print:text-slate-900">6. Longitudinal Health Charting</h3>
                <p className="text-[11px] text-slate-300 leading-relaxed print:text-slate-600">
                  WhatsApp automatically charts blood pressure, blood sugar, and weight trends over months.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:bg-slate-100 print:border-slate-200 print:text-slate-800">
            <span className="text-slate-300 font-medium print:text-slate-700">Patients will naturally choose your network pharmacy and lab to get these free VIP benefits.</span>
            <span className="text-teal-400 font-bold print:text-teal-800">Dynamic SOP Splits →</span>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 08: DOCTOR-CONTROLLED DYNAMIC SPLITS & FEE IMMUNITY
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-purple-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  08
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-purple-400 bg-purple-950/80 px-3 py-1 rounded-full border border-purple-800/60 print:bg-purple-50 print:text-purple-800 print:border-purple-200">
                  Governance &amp; Fee Protection
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 08 / 12</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight print:text-slate-900">
              Doctor-Controlled Dynamic Splits &amp; Fee Immunity
            </h2>
            <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl print:text-slate-600">
              You maintain 100% autonomy over your network economics. Set custom splits with 1 tap in your clinic SOP settings.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="p-5 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-3 print:bg-slate-50 print:border-slate-200">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 print:text-slate-900">
                  <Sliders className="w-4 h-4 text-teal-400" /> Dynamic Practice Parameters
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center p-3 bg-slate-900/60 rounded-xl border border-slate-700 print:bg-white print:border-slate-200">
                    <span className="font-semibold text-slate-200 print:text-slate-800">💊 Pharmacy Medication Split</span>
                    <span className="font-mono font-bold text-teal-400 bg-teal-950 px-2.5 py-0.5 rounded border border-teal-800 print:bg-teal-50 print:text-teal-800 print:border-teal-200">20% – 30%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-900/60 rounded-xl border border-slate-700 print:bg-white print:border-slate-200">
                    <span className="font-semibold text-slate-200 print:text-slate-800">🔬 Pathology Diagnostic Split</span>
                    <span className="font-mono font-bold text-purple-400 bg-purple-950 px-2.5 py-0.5 rounded border border-purple-800 print:bg-purple-50 print:text-purple-800 print:border-purple-200">30% – 40%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-900/60 rounded-xl border border-slate-700 print:bg-white print:border-slate-200">
                    <span className="font-semibold text-slate-200 print:text-slate-800">🚨 Emergency SOS Priority Fee</span>
                    <span className="font-mono font-bold text-rose-400 bg-rose-950 px-2.5 py-0.5 rounded border border-rose-800 print:bg-rose-50 print:text-rose-800 print:border-rose-200">₹618.00</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-900/60 rounded-xl border border-slate-700 print:bg-white print:border-slate-200">
                    <span className="font-semibold text-slate-200 print:text-slate-800">🏷️ Chronic Refill Patient Loyalty Discount</span>
                    <span className="font-mono font-bold text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800 print:bg-emerald-50 print:text-emerald-800 print:border-emerald-200">10% OFF</span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-3 print:bg-slate-50 print:border-slate-200">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 print:text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Rule 58 / 103: Consultation Fee Immunity
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-700">
                  100% of patient consultation fees booked at the counter go directly into your account with <strong>0% platform deduction</strong>.
                </p>
                <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-700 text-xs text-slate-300 space-y-1.5 font-medium print:bg-white print:border-slate-200 print:text-slate-800">
                  <div className="text-emerald-400 print:text-emerald-800">✔ 100% Doctor consultation fee immunity.</div>
                  <div>✔ Counter cash stays 100% in your clinic drawer.</div>
                  <div>✔ ₹1,000 automated commission safety buffer &amp; direct bank settlements.</div>
                  <div>✔ Transparent 3% digital technical coordination fee only on lab &amp; pharmacy clearing.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:bg-slate-100 print:border-slate-200 print:text-slate-800">
            <span className="text-slate-300 font-medium print:text-slate-700">You retain 100% sovereign control over your clinic's commercial agreements.</span>
            <span className="text-teal-400 font-bold print:text-teal-800">The 2-Touchpoint Loop →</span>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 09: THE 2-TOUCHPOINT WHATSAPP CARE LOOP
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  09
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-400 bg-teal-950/80 px-3 py-1 rounded-full border border-teal-800/60 print:bg-teal-50 print:text-teal-800 print:border-teal-200">
                  Operational Workflow
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 09 / 12</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight print:text-slate-900">
              The 2-Touchpoint WhatsApp Care Loop
            </h2>
            <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl print:text-slate-600">
              Eliminating evening OPD crowding while ensuring 100% of prescribed medications and diagnostic tests are fulfilled within your network.
            </p>

            <div className="space-y-4 mt-6">
              {/* Touchpoint 1 */}
              <div className="p-5 bg-slate-800/60 rounded-2xl border border-slate-700 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between print:bg-slate-50 print:border-slate-200">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center font-black shrink-0 print:bg-slate-900">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white print:text-slate-900">Morning In-Person Consultation (OPD)</h3>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed print:text-slate-600">
                      Compounder registers walk-ins, records vitals (BP, Sugar, SpO2, Temp), and issues token (#TK-001). Doctor examines patient and writes prescription without slow keyboard typing.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-indigo-950 text-indigo-300 text-[10px] font-bold uppercase font-mono shrink-0 border border-indigo-800 print:bg-indigo-100 print:text-indigo-800 print:border-indigo-200">
                  OPD Queue #TK-001
                </span>
              </div>

              {/* Touchpoint 2 */}
              <div className="p-5 bg-teal-950/50 rounded-2xl border border-teal-800/60 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between print:bg-teal-50 print:border-teal-200">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-md">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white print:text-slate-900">Evening Diagnostic Report Review on WhatsApp</h3>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed print:text-slate-600">
                      When the diagnostic lab approves reports, WhatsApp delivers the verified PDF to the patient with two single-tap interactive options:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2.5 py-0.5 bg-slate-900 border border-teal-500/40 rounded-lg text-teal-300 text-[10px] font-bold print:bg-white print:border-teal-300 print:text-teal-800">
                        🏥 Physical Clinic Review (Primary / Reserved Pharmacy Hold)
                      </span>
                      <span className="px-2.5 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 text-[10px] font-bold print:bg-white print:border-slate-300 print:text-slate-800">
                        💻 Virtual Video Review (Emergency / 1-Click Home Delivery)
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-teal-950 text-teal-300 text-[10px] font-bold uppercase font-mono shrink-0 border border-teal-800 print:bg-teal-100 print:text-teal-800 print:border-teal-200">
                  Sub-300ms Dispatch
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mt-6">
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 print:bg-slate-50 print:border-slate-200 print:text-slate-800">
              🎁 1 Free Virtual Consult
            </div>
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 print:bg-slate-50 print:border-slate-200 print:text-slate-800">
              🏷️ 10% Off Chronic Refills
            </div>
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 print:bg-slate-50 print:border-slate-200 print:text-slate-800">
              📱 Daily WhatsApp Dose Alerts
            </div>
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 print:bg-slate-50 print:border-slate-200 print:text-slate-800">
              📄 Instant Verified Reports
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 10: INTERACTIVE PRACTICE ROI & REVENUE CALCULATOR
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  10
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/60 print:bg-emerald-50 print:text-emerald-800 print:border-emerald-200">
                  Practice Revenue Forecast
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 10 / 12</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight print:text-slate-900">
              Interactive Practice Revenue Simulator
            </h2>
            <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl print:text-slate-600">
              Simulate your monthly clinic revenue growth based on your daily OPD patient volume.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Sliders Control */}
              <div className="p-6 bg-slate-800/60 rounded-3xl border border-slate-700 space-y-4 print:bg-slate-50 print:border-slate-200">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300 print:text-slate-700">Daily OPD Patients:</span>
                    <span className="font-mono text-teal-400 print:text-teal-700">{dailyPatients} Patients / day</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="80" 
                    step="5"
                    value={dailyPatients} 
                    onChange={(e) => setDailyPatients(Number(e.target.value))}
                    className="w-full accent-teal-400 cursor-pointer" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300 print:text-slate-700">Average Medicine Bill per Patient:</span>
                    <span className="font-mono text-teal-400 print:text-teal-700">₹{avgMedicinePerPatient}</span>
                  </div>
                  <input 
                    type="range" 
                    min="500" 
                    max="3000" 
                    step="100"
                    value={avgMedicinePerPatient} 
                    onChange={(e) => setAvgMedicinePerPatient(Number(e.target.value))}
                    className="w-full accent-teal-400 cursor-pointer" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300 print:text-slate-700">Average Lab Tests Bill per Patient:</span>
                    <span className="font-mono text-purple-400 print:text-purple-700">₹{avgLabPerPatient}</span>
                  </div>
                  <input 
                    type="range" 
                    min="400" 
                    max="2500" 
                    step="100"
                    value={avgLabPerPatient} 
                    onChange={(e) => setAvgLabPerPatient(Number(e.target.value))}
                    className="w-full accent-purple-400 cursor-pointer" 
                  />
                </div>
              </div>

              {/* Live Output Card */}
              <div className="p-6 bg-gradient-to-br from-teal-950/80 to-emerald-950/80 rounded-3xl border border-teal-500/50 space-y-4 print:bg-teal-50 print:border-teal-300">
                <div className="text-xs font-bold uppercase tracking-wider text-teal-300 print:text-teal-900">
                  Estimated Monthly Practice Financials (26 Days)
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between pb-1.5 border-b border-teal-900/60 print:border-teal-200">
                    <span className="text-teal-200 print:text-slate-700">Monthly OPD Consultation Earnings:</span>
                    <span className="font-mono font-bold text-white print:text-slate-900">₹{monthlyMetrics.monthlyOpdRevenue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-teal-900/60 print:border-teal-200">
                    <span className="text-teal-200 print:text-slate-700">💊 Pharmacy Medication Split ({pharmacySplit}%):</span>
                    <span className="font-mono font-bold text-teal-300 print:text-teal-800">+₹{Math.round(monthlyMetrics.doctorMedAdvisorySplit).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-teal-900/60 print:border-teal-200">
                    <span className="text-teal-200 print:text-slate-700">🔬 Pathology Lab Split ({labSplit}%):</span>
                    <span className="font-mono font-bold text-purple-300 print:text-purple-800">+₹{Math.round(monthlyMetrics.doctorLabInterpretationSplit).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="p-4 bg-teal-900/60 rounded-2xl border border-teal-400/40 text-center space-y-1 print:bg-white print:border-teal-300">
                  <div className="text-[11px] font-bold uppercase text-teal-200 print:text-teal-800">New Net Practice Income Unlocked:</div>
                  <div className="text-3xl font-black text-white font-mono tracking-tight print:text-teal-700">
                    +₹{Math.round(monthlyMetrics.totalNewIncome).toLocaleString('en-IN')} <span className="text-xs text-teal-300 font-sans font-medium">/ month</span>
                  </div>
                  <div className="text-[10px] text-teal-300 print:text-slate-600">Total Practice Gross: ₹{Math.round(monthlyMetrics.totalPracticeRevenue).toLocaleString('en-IN')} / month</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:bg-slate-100 print:border-slate-200 print:text-slate-800">
            <span className="text-slate-300 font-medium print:text-slate-700">Zero extra staff needed. 100% automated accounting and bank settlement.</span>
            <span className="text-teal-400 font-bold print:text-teal-800">Doctor FAQs →</span>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 11: DOCTOR OBJECTION HANDLING & LEGAL COMPLIANCE
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-indigo-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  11
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60 print:bg-indigo-50 print:text-indigo-800 print:border-indigo-200">
                  Legal &amp; Practical FAQs
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 11 / 12</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight print:text-slate-900">
              Addressing Doctor Questions &amp; Legal Compliance
            </h2>
            <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl print:text-slate-600">
              Clear, transparent answers to every clinical, operational, and commercial question.
            </p>

            <div className="space-y-3 mt-6">
              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-1 print:bg-slate-50 print:border-slate-200">
                <div className="text-xs font-bold text-white flex items-center gap-2 print:text-slate-900">
                  <Check className="w-4 h-4 text-teal-400 shrink-0" />
                  Q: "Is it legal and ethical for me to earn from lab/pharmacy splits?"
                </div>
                <p className="text-[11px] text-slate-300 pl-6 leading-relaxed print:text-slate-600">
                  <strong>Yes, 100%.</strong> You are receiving a legitimate <em>Clinical Report Interpretation &amp; Tele-Monitoring Advisory Fee</em> for reviewing diagnostic values and supervising chronic dosage adherence under your clinic's formal SOP agreement.
                </p>
              </div>

              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-1 print:bg-slate-50 print:border-slate-200">
                <div className="text-xs font-bold text-white flex items-center gap-2 print:text-slate-900">
                  <Check className="w-4 h-4 text-teal-400 shrink-0" />
                  Q: "My patients are elderly or rural; will they be able to use this?"
                </div>
                <p className="text-[11px] text-slate-300 pl-6 leading-relaxed print:text-slate-600">
                  <strong>Zero app downloads required.</strong> 100% of patient interactions happen on standard WhatsApp using single-tap native reply buttons and voice notes. If a patient knows how to open WhatsApp, they are already fully onboarded.
                </p>
              </div>

              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-1 print:bg-slate-50 print:border-slate-200">
                <div className="text-xs font-bold text-white flex items-center gap-2 print:text-slate-900">
                  <Check className="w-4 h-4 text-teal-400 shrink-0" />
                  Q: "Can I choose my own preferred chemist and pathology lab?"
                </div>
                <p className="text-[11px] text-slate-300 pl-6 leading-relaxed print:text-slate-600">
                  <strong>Yes, absolutely.</strong> You have 100% freedom to connect your existing trusted neighborhood chemist down the street and your preferred diagnostic center via their phone numbers.
                </p>
              </div>

              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-1 print:bg-slate-50 print:border-slate-200">
                <div className="text-xs font-bold text-white flex items-center gap-2 print:text-slate-900">
                  <Check className="w-4 h-4 text-teal-400 shrink-0" />
                  Q: "How does counter cash collection work?"
                </div>
                <p className="text-[11px] text-slate-300 pl-6 leading-relaxed print:text-slate-600">
                  100% of physical cash collected at your counter stays directly in your clinic drawer. Platform reconciliation happens automatically via your pre-funded Commission Pool balance.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 rounded-2xl flex items-center justify-between text-xs mt-6 border border-slate-700 print:bg-slate-100 print:border-slate-200 print:text-slate-800">
            <span className="text-slate-300 font-medium print:text-slate-700">Zero risk. 100% control. Transform your independent clinic today.</span>
            <span className="text-teal-400 font-bold print:text-teal-800">Get Started in 5 Minutes →</span>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 12: 5-MINUTE ONBOARDING & CONTACT
           ════════════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800/80 print:bg-white print:text-slate-900 print:shadow-none print:border-none print:p-8 print:h-[270mm] print:page-break-after-always flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6 print:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  12
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-400 bg-teal-950/80 px-3 py-1 rounded-full border border-teal-800/60 print:bg-teal-50 print:text-teal-800 print:border-teal-200">
                  Rapid Deployment
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 print:text-slate-400">SLIDE 12 / 12</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight print:text-slate-900">
              Launch Your Connected Practice in 3 Simple Steps
            </h2>
            <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl print:text-slate-600">
              Zero upfront SaaS subscription fees. Zero complex hardware. Seamless practice onboarding in under 15 minutes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              <div className="p-6 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-3 text-center print:bg-slate-50 print:border-slate-200">
                <div className="w-12 h-12 rounded-2xl bg-teal-500 text-slate-950 mx-auto flex items-center justify-center font-black text-lg shadow-lg shadow-teal-500/20">
                  1
                </div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Practice Setup &amp; Bank Link</h3>
                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-600">
                  Register your clinic profile and link your direct settlement bank account (100% consultation fee immunity).
                </p>
              </div>

              <div className="p-6 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-3 text-center print:bg-slate-50 print:border-slate-200">
                <div className="w-12 h-12 rounded-2xl bg-teal-500 text-slate-950 mx-auto flex items-center justify-center font-black text-lg shadow-lg shadow-teal-500/20">
                  2
                </div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Connect Chemist &amp; Lab</h3>
                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-600">
                  Link your trusted neighborhood pharmacy and pathology center with custom clinic SOP split parameters.
                </p>
              </div>

              <div className="p-6 bg-slate-800/60 rounded-2xl border border-slate-700 space-y-3 text-center print:bg-slate-50 print:border-slate-200">
                <div className="w-12 h-12 rounded-2xl bg-teal-500 text-slate-950 mx-auto flex items-center justify-center font-black text-lg shadow-lg shadow-teal-500/20">
                  3
                </div>
                <h3 className="text-sm font-bold text-white print:text-slate-900">Front-Desk OPD Go-Live</h3>
                <p className="text-xs text-slate-300 leading-relaxed print:text-slate-600">
                  Compounder issues tokens and records vitals, while you consult with automated WhatsApp follow-ups active.
                </p>
              </div>
            </div>

            {/* Direct Contact Card */}
            <div className="p-6 bg-slate-950 rounded-2xl mt-6 flex flex-col md:flex-row items-center justify-between gap-6 border border-teal-500/40 shadow-xl print:bg-slate-900 print:text-white">
              <div className="space-y-1 text-center md:text-left">
                <div className="text-base font-black text-white flex items-center gap-2 justify-center md:justify-start">
                  <Sparkles className="w-4 h-4 text-teal-400" /> Schedule Your 15-Minute Practice Onboarding
                </div>
                <div className="text-xs text-slate-300">
                  Speak directly with our Executive Network Lead for on-site clinic onboarding and chemist integration.
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <a 
                  href="tel:+919608032073" 
                  className="px-5 py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20 no-underline"
                >
                  <PhoneCall className="w-4 h-4" /> +91 96080 32073
                </a>
                <a 
                  href="mailto:vivekobray2073@gmail.com" 
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all no-underline"
                >
                  <Mail className="w-4 h-4" /> vivekobray2073@gmail.com
                </a>
              </div>
            </div>
          </div>

          <div className="p-4 bg-teal-950/60 border border-teal-800/60 rounded-2xl flex items-center justify-between text-xs text-slate-300 mt-4 print:bg-teal-50 print:border-teal-200 print:text-slate-800">
            <span className="font-bold text-teal-300 print:text-teal-900">VitalSync: Virtual Hospital Network — "Your Clinic. Now a Hospital."</span>
            <span>Empowering Independent Physicians Across Tier 2 &amp; Tier 3 Healthcare Hubs</span>
          </div>
        </section>

      </main>
    </div>
  );
};
