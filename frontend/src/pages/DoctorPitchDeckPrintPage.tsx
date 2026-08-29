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
  ChevronRight,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Presentation,
  CheckCircle,
  BarChart3,
  PieChart,
  Repeat,
  Send,
  Bot
} from 'lucide-react';

export const DoctorPitchDeckPrintPage: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'keynote' | 'continuous'>('keynote');

  // ROI Calculator Parameters
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
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        if (viewMode === 'keynote') {
          e.preventDefault();
          nextSlide();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (viewMode === 'keynote') {
          e.preventDefault();
          prevSlide();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  // Monthly Metrics Computation
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

  const slideTitles = [
    "Executive Proposition",
    "₹5,000 Patient Budget Inequality",
    "Revenue Comparison (3.8x Leap)",
    "Patient Retention Bottlenecks",
    "1-Click EMR & WhatsApp Chatbot",
    "Chronic Care Management Flywheel",
    "6 VIP Member Benefits",
    "Doctor-Controlled Dynamic Splits",
    "2-Touchpoint Care Timeline",
    "Interactive Practice ROI Simulator",
    "Legal & Operational FAQs",
    "3-Step Practice Go-Live"
  ];

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 font-sans antialiased selection:bg-teal-600 selection:text-white pb-16 print:bg-white print:text-slate-900 print:pb-0">
      
      {/* ── Strict Page-Break CSS for Print / PDF Engine ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm 8mm;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-slide {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            height: 185mm !important;
            max-height: 185mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-shadow: none !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 16px !important;
            padding: 16px 20px !important;
            margin-bottom: 0 !important;
            overflow: hidden !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* ── Fixed Presentation Navigation Toolbar (Hidden in Print) ── */}
      <header className="sticky top-0 z-50 no-print bg-white/95 backdrop-blur-xl border-b border-slate-200/80 px-4 md:px-8 py-2.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-600/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-slate-900 flex items-center gap-2">
                <span>VitalSync</span>
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  Doctor Partnership Pitch
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">Smart Virtual Hospital Network • Executive Presentation</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <button
                onClick={() => setViewMode('keynote')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border-0 ${
                  viewMode === 'keynote' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Presentation className="w-3.5 h-3.5" /> Slide Mode
              </button>
              <button
                onClick={() => setViewMode('continuous')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border-0 ${
                  viewMode === 'continuous' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> All Slides
              </button>
            </div>

            {/* Slide Navigation Buttons */}
            {viewMode === 'keynote' && (
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                <button
                  onClick={prevSlide}
                  disabled={activeSlide === 1}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer border-0"
                  title="Previous Slide (Left Arrow)"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="px-2.5 text-xs font-mono font-bold text-teal-800">
                  {String(activeSlide).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
                </span>
                <button
                  onClick={nextSlide}
                  disabled={activeSlide === totalSlides}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer border-0"
                  title="Next Slide (Right Arrow / Spacebar)"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5 cursor-pointer border-0"
              title="Print to PDF (A4 Landscape)"
            >
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </button>
          </div>
        </div>
      </header>

      {/* ── Slide Content Container ── */}
      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 print:space-y-0 print:p-0 print:max-w-none">

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 01: COVER & EXECUTIVE PROPOSITION
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 1) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    01
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-0.5 rounded-full border border-teal-200">
                    Category-Defining Clinical Partnership
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 01 / 12</span>
              </div>

              <div className="space-y-3.5 max-w-4xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border border-slate-200">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  Exclusively For Independent Doctors, Surgeons &amp; Clinic Owners
                </div>
                
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.15]">
                  Your Clinic. <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">Now a Hospital.</span>
                </h1>
                
                <p className="text-base md:text-xl font-bold text-teal-800 tracking-tight">
                  Clinic Freedom. Hospital Revenue. On WhatsApp.
                </p>
                
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-normal">
                  Unite your OPD consultation room with your trusted neighborhood pharmacy and pathology laboratory into an automated, hospital-grade outpatient ecosystem. Deliver continuous chronic care, retain 100% patient loyalty, and unlock <strong className="text-slate-900 font-semibold">+₹1,00,000 to +₹2,50,000+ monthly recurring practice revenue</strong> with <strong className="text-teal-700 font-semibold">zero setup costs, zero SaaS fees, and zero change to your daily OPD workflow</strong>.
                </p>
              </div>
            </div>

            {/* 4 Feature Matrix Cards with Gradient Accents */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100 mt-4">
              <div className="p-3 bg-gradient-to-br from-teal-50/60 to-white rounded-2xl border border-teal-200/80 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Adoption Cost</div>
                <div className="text-base font-black text-teal-800 mt-0.5">₹0 Setup / ₹0 SaaS</div>
                <div className="text-[10px] text-slate-500">100% Free Lifetime Access</div>
              </div>
              <div className="p-3 bg-gradient-to-br from-indigo-50/60 to-white rounded-2xl border border-indigo-200/80 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Doctor Consultation</div>
                <div className="text-base font-black text-slate-900 mt-0.5">100% Protected</div>
                <div className="text-[10px] text-slate-500">0% Platform Deductions (Rule 58)</div>
              </div>
              <div className="p-3 bg-gradient-to-br from-emerald-50/60 to-white rounded-2xl border border-emerald-200/80 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Patient Adoption</div>
                <div className="text-base font-black text-slate-900 mt-0.5">Zero Apps</div>
                <div className="text-[10px] text-slate-500">100% Native WhatsApp Chat</div>
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-50/60 to-white rounded-2xl border border-purple-200/80 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Clinical Workflow</div>
                <div className="text-base font-black text-purple-900 mt-0.5">Zero Disruption</div>
                <div className="text-[10px] text-slate-500">Assistant manages queue &amp; vitals</div>
              </div>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 02: PROBLEM 1 — THE ₹5,000 PATIENT WALLET INEQUALITY (DIAGRAM)
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 2) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    02
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-rose-800 bg-rose-50 px-3 py-0.5 rounded-full border border-rose-200">
                    The Clinical &amp; Revenue Reality
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 02 / 12</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                The ₹5,000 Patient Wallet Inequality
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl">
                Every individual patient spends almost <strong>₹3,000 to ₹5,000</strong> across your Clinic, Diagnostic Tests, and Prescribed Medicines.
              </p>

              {/* Visual Wallet Breakdown Diagram */}
              <div className="my-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex justify-between">
                  <span>Where Patient's ₹5,000 Total Budget Goes Today:</span>
                  <span className="text-rose-600 font-black">Doctor Takes Only 10%</span>
                </div>
                <div className="w-full h-5 rounded-full overflow-hidden flex shadow-inner border border-slate-300">
                  <div className="h-full bg-rose-500 text-[10px] text-white font-bold flex items-center justify-center" style={{ width: '10%' }}>
                    10% Doctor
                  </div>
                  <div className="h-full bg-teal-500 text-[10px] text-white font-bold flex items-center justify-center" style={{ width: '56%' }}>
                    56% Chemist (₹2,800)
                  </div>
                  <div className="h-full bg-purple-500 text-[10px] text-white font-bold flex items-center justify-center" style={{ width: '34%' }}>
                    34% Lab (₹1,700)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2">
                <div className="p-3.5 bg-teal-50/40 rounded-2xl border-l-4 border-l-teal-600 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-teal-900 font-bold text-xs uppercase tracking-wide">
                    <Stethoscope className="w-4 h-4 text-teal-600" /> 100% Cognitive &amp; Clinical Work (You)
                  </div>
                  <div className="space-y-1 text-xs text-slate-700">
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <span><strong>Diagnose</strong> complex diseases, symptoms &amp; vital markers.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <span><strong>Interpret diagnostic lab reports</strong> and abnormal pathology biomarkers.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <span><strong>Advise medication</strong>, active molecules, dosage frequencies &amp; drug safety.</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-rose-50/40 rounded-2xl border-l-4 border-l-rose-600 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase tracking-wide">
                    <Coins className="w-4 h-4 text-rose-600" /> But Standalone Clinics Get Only 10%
                  </div>
                  <div className="space-y-1 text-xs text-slate-700">
                    <div className="flex items-start gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-rose-200 text-rose-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">!</span>
                      <span><strong>Clinic Revenue:</strong> Only ₹500 OPD consultation fee.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-rose-200 text-rose-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">!</span>
                      <span><strong>External Chemist &amp; Lab:</strong> Capture 90% (₹4,500) of your prescription value.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-rose-200 text-rose-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">!</span>
                      <span><strong>Corporate Hospital Contrast:</strong> Apollo/Max capture <strong>60%–70%</strong> in-house.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs mt-3 border border-slate-200">
              <span className="text-slate-700 font-medium">VitalSync bridges this gap by turning your standalone clinic into an interconnected outpatient care network.</span>
              <span className="text-teal-700 font-bold">The Revenue Leap →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 03: THE REVENUE LEAP — BEFORE VS AFTER (VISUAL GROWTH)
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 3) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    03
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200">
                    The Practice Economics
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 03 / 12</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Revenue Comparison: Today vs. With VitalSync
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl">
                Transforming your practice from a single episodic consultation fee to a continuous, institutional clinical revenue stream.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3.5">
                {/* Status Quo Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Your Clinic Right Now</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 font-bold">Status Quo</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200">
                      <span className="text-slate-700">OPD Patient Consultation Fee</span>
                      <span className="font-mono font-bold text-slate-900">₹500.00</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200 text-slate-500">
                      <span>Lab Report Interpretation Fee</span>
                      <span className="font-mono">₹0.00 (Lab keeps 100%)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200 text-slate-500">
                      <span>Medication Advisory &amp; Dosage Fee</span>
                      <span className="font-mono">₹0.00 (Chemist keeps 100%)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Chronic Patient 30-Day Refill</span>
                      <span className="font-mono">₹0.00 (Lost outside)</span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                    <span className="text-xs font-bold text-slate-700">Total Net Income per Patient:</span>
                    <span className="text-base font-black text-slate-900 font-mono">₹500.00</span>
                  </div>
                </div>

                {/* VitalSync Loop Card */}
                <div className="p-4 bg-gradient-to-br from-teal-50/70 to-emerald-50/70 rounded-2xl border border-teal-300 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-900 font-black">With VitalSync Connected Loop</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">3.8x Leap</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-xs pb-1 border-b border-teal-200">
                      <span className="text-slate-800 font-bold">OPD Consultation Fee (100% Doctor)</span>
                      <span className="font-mono font-bold text-slate-900">₹500.00</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-1 border-b border-teal-200 text-slate-700">
                      <span>🔬 Lab Interpretation Split (30%–40%)</span>
                      <span className="font-mono font-bold text-teal-700">+₹350 – ₹600</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-1 border-b border-teal-200 text-slate-700">
                      <span>💊 Medication Advisory Split (20%–30%)</span>
                      <span className="font-mono font-bold text-teal-700">+₹250 – ₹500</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-700">
                      <span>📦 Chronic 30-Day Refill Equity (Day 25)</span>
                      <span className="font-mono font-bold text-emerald-700">+₹150 – ₹300 / mo</span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-teal-300 flex justify-between items-center shadow-sm">
                    <span className="text-xs font-bold text-teal-900">Total Net Income per Patient:</span>
                    <span className="text-lg font-black text-teal-700 font-mono">₹1,250 – ₹1,900+</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs mt-3 border border-slate-200">
              <span className="text-slate-700 font-medium">Doctors earn 2.5x to 3.8x higher practice revenue without spending extra minutes or rupees.</span>
              <span className="text-teal-700 font-bold">Problem 2: Patient Retention →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 04: PROBLEM 2 — PATIENT RETENTION & FOLLOW-UP BLACK HOLE
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 4) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    04
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-800 bg-amber-50 px-3 py-0.5 rounded-full border border-amber-200">
                    The Clinical Retention Challenge
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 04 / 12</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Problem #2: Patient Records &amp; 65% Follow-Up Drop-Off
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl">
                Independent doctors struggle with 4 critical operational bottlenecks that leak patient loyalty and damage long-term clinical recovery.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3.5">
                <div className="p-3 bg-gradient-to-br from-amber-50/60 to-white rounded-2xl border-l-4 border-l-amber-500 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <FileText className="w-3.5 h-3.5 text-amber-600" /> 1. Lost Paper Prescriptions &amp; Records
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Patients lose paper slips or leave them at home. Doctors are forced to re-examine without past clinical baselines or drug reaction history.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-br from-amber-50/60 to-white rounded-2xl border-l-4 border-l-amber-500 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <Activity className="w-3.5 h-3.5 text-amber-600" /> 2. Inaccessible Medical History
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    In a fast-paced OPD with 30–50 patients, finding past lab test values, BP trends, or allergy notes on paper takes valuable minutes you don't have.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-br from-amber-50/60 to-white rounded-2xl border-l-4 border-l-amber-500 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <Users className="w-3.5 h-3.5 text-amber-600" /> 3. 65% Follow-Up Attrition Rate
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    The moment acute pain subsides, patients forget their Day-15 follow-up visit. The clinic has no automated communication channel to bring them back.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-br from-amber-50/60 to-white rounded-2xl border-l-4 border-l-amber-500 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <HeartPulse className="w-3.5 h-3.5 text-amber-600" /> 4. Chronic Patient Retention Leakage
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Diabetic and hypertensive patients take medicines for months without checkups, skip quarterly HbA1c tests, and switch to random substitutes.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs mt-3 border border-slate-200">
              <span className="text-slate-700 font-medium">VitalSync automates complete patient record tracking and follow-up loops on 24/7 WhatsApp.</span>
              <span className="text-teal-700 font-bold">The WhatsApp Solution →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 05: THE 24/7 WHATSAPP CARE & EMR SOLUTION (MOCKUP DIAGRAM)
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 5) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    05
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-0.5 rounded-full border border-teal-200">
                    The VitalSync Technology Suite
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 05 / 12</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                1-Click EMR &amp; 24/7 WhatsApp Clinic Chatbot
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl">
                Maintaining 100% digital records on your Doctor Dashboard while our automated AI bot stays inside your patient's WhatsApp 24/7.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3.5">
                {/* Doctor EMR Card */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-teal-800 font-bold text-xs uppercase tracking-wider">
                    <Stethoscope className="w-4 h-4 text-teal-600" /> 1. Doctor EMR Dashboard (Ultra-Fast)
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center gap-2 shadow-sm">
                      <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span><strong>1-Click Medical History:</strong> Press <code className="bg-slate-100 px-1 py-0.5 rounded text-teal-700 border border-slate-200 font-mono">Ctrl + K</code> for past vitals &amp; lab reports.</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center gap-2 shadow-sm">
                      <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span><strong>AI Voice Scribe:</strong> Speak Hindi or English notes; AI formats structured SOAP digital prescriptions.</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center gap-2 shadow-sm">
                      <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span><strong>Specialty Worksheets:</strong> Ophthalmic Refraction (RE/LE), Cardiology ECG, Pediatric charts.</span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Chat Simulation Frame */}
                <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs uppercase tracking-wider">
                      <MessageSquare className="w-4 h-4 text-emerald-600" /> 2. WhatsApp Patient Chatbot
                    </div>
                    <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> Online 24/7
                    </span>
                  </div>

                  <div className="bg-white rounded-xl p-2.5 border border-emerald-200 shadow-sm space-y-1.5 text-[11px]">
                    <div className="bg-slate-100 rounded-lg p-2 text-slate-800">
                      💬 <em>"Namaste Sharma ji! Doctor Sahab ne aapka prescription aur test report WhatsApp par bhej diya hai."</em>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="px-2 py-1 bg-emerald-600 text-white font-bold rounded-lg text-[10px]">
                        📦 1-Click Refill (10% OFF)
                      </span>
                      <span className="px-2 py-1 bg-slate-200 text-slate-800 font-bold rounded-lg text-[10px]">
                        📄 Download PDF Report
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs mt-3 border border-slate-200">
              <span className="text-slate-700 font-medium">Zero app downloads. 100% of communication happens on native WhatsApp.</span>
              <span className="text-teal-700 font-bold">Chronic Care Loop →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 06: CHRONIC PATIENT CARE & RECURRING REFILL FLYWHEEL
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 6) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    06
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-800 bg-indigo-50 px-3 py-0.5 rounded-full border border-indigo-200">
                    Lifelong Care Loop
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 06 / 12</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                The Chronic Patient Care Flywheel
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl">
                Chronic patients (Diabetes, Hypertension, Thyroid, Heart Disease) need treatment for 10–20+ years. VitalSync assures them they are monitored.
              </p>

              {/* 4-Quadrant Flywheel Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3.5">
                <div className="p-3 bg-gradient-to-b from-teal-50 to-white rounded-2xl border border-teal-200 space-y-1 shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    1
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Proactive Care Alerts</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Doctor's chatbot sends morning &amp; evening dose reminders (1-0-1), assuring patients they are monitored.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-b from-indigo-50 to-white rounded-2xl border border-indigo-200 space-y-1 shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    2
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Day-25 1-Tap Refills</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    On Day 25, WhatsApp prompts: <em>"Aapki dawa 5 din me khatam hogi. 10% discount ke saath refill order karein?"</em>
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-b from-purple-50 to-white rounded-2xl border border-purple-200 space-y-1 shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    3
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">90-Day Diagnostic Tests</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Schedules quarterly home blood collection for HbA1c, Lipid, maintaining clinical safety and practice lab revenue.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-b from-emerald-50 to-white rounded-2xl border border-emerald-200 space-y-1 shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    4
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Paid Consultation Loop</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Patients pay their consultation fee in-clinic or via video review, keeping them connected to your practice.
                  </p>
                </div>
              </div>

              <div className="p-2.5 bg-teal-50 rounded-xl mt-3 border border-teal-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-[11px] text-teal-900 font-medium">
                    <strong>Refill Defaulter Safety Net:</strong> If a chronic patient misses their refill by &gt;7 days, your EMR alerts you with a 1-Tap WhatsApp outreach button.
                  </span>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs mt-3 border border-slate-200">
              <span className="text-slate-700 font-medium">Turn one-time walk-ins into continuous 10-year recurring patient relationships.</span>
              <span className="text-teal-700 font-bold">The VIP Member Benefits →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 07: THE 6 VIP MEMBER BENEFITS (THE PATIENT MAGNET)
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 7) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    07
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-0.5 rounded-full border border-teal-200">
                    The Patient Magnet
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 07 / 12</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Why Patients Choose Your Connected Loop
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl">
                When patients purchase medicines and tests from your partnered pharmacy and lab, their WhatsApp unlocks <strong>6 VIP Club Benefits</strong>:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3.5">
                <div className="p-3 bg-gradient-to-br from-blue-50/70 to-white rounded-2xl border border-blue-200 space-y-1 shadow-sm">
                  <div className="text-base">📄</div>
                  <h3 className="text-xs font-bold text-slate-900">1. Instant PDF Lab Reports</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Delivered the second the lab finishes. <strong>Zero revisiting the lab</strong>.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-br from-purple-50/70 to-white rounded-2xl border border-purple-200 space-y-1 shadow-sm">
                  <div className="text-base">🗣️</div>
                  <h3 className="text-xs font-bold text-slate-900">2. Hinglish AI Lab Analysis</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Plain-language audio &amp; text summaries explaining what high/low biomarkers mean.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-br from-teal-50/70 to-white rounded-2xl border border-teal-200 space-y-1 shadow-sm">
                  <div className="text-base">💊</div>
                  <h3 className="text-xs font-bold text-slate-900">3. Daily Dosage Reminders</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Morning &amp; evening alerts (1-0-1) with voice instructions so doses are never skipped.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-br from-emerald-50/70 to-white rounded-2xl border border-emerald-200 space-y-1 shadow-sm">
                  <div className="text-base">🎁</div>
                  <h3 className="text-xs font-bold text-slate-900">4. 1 Free Virtual Consult</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Valid for 15–20 days. Patients clarify symptoms over WhatsApp video without paying again.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-br from-amber-50/70 to-white rounded-2xl border border-amber-200 space-y-1 shadow-sm">
                  <div className="text-base">🏷️</div>
                  <h3 className="text-xs font-bold text-slate-900">5. 10% OFF Chronic Refills</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Structured 10% loyalty discount on recurring 30-day medicine orders.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-br from-rose-50/70 to-white rounded-2xl border border-rose-200 space-y-1 shadow-sm">
                  <div className="text-base">📊</div>
                  <h3 className="text-xs font-bold text-slate-900">6. Health Charting</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    WhatsApp automatically charts blood pressure, sugar, and vitals trends over time.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs mt-3 border border-slate-200">
              <span className="text-slate-700 font-medium">Patients naturally choose your network pharmacy and lab to receive these VIP benefits.</span>
              <span className="text-teal-700 font-bold">Dynamic SOP Splits →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 08: DOCTOR-CONTROLLED DYNAMIC SPLITS & FEE PROTECTION
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 8) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    08
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-purple-800 bg-purple-50 px-3 py-0.5 rounded-full border border-purple-200">
                    Governance &amp; Fee Protection
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 08 / 12</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Doctor-Controlled Dynamic Splits &amp; Fee Protection
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl">
                You maintain 100% autonomy over your network economics. Set custom splits with 1 tap in your clinic SOP settings.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3.5">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-teal-600" /> Dynamic Practice Parameters
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <span className="font-semibold text-slate-800">💊 Pharmacy Medication Split</span>
                      <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">20% – 30%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <span className="font-semibold text-slate-800">🔬 Pathology Diagnostic Split</span>
                      <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">30% – 40%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <span className="font-semibold text-slate-800">🚨 Emergency SOS Priority Fee</span>
                      <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">₹618.00</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <span className="font-semibold text-slate-800">🏷️ Chronic Refill Loyalty Discount</span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">10% OFF</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Rule 58 / 103: Fee Protection
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    100% of patient consultation fees booked at the counter go directly to you with <strong>0% platform deduction</strong>.
                  </p>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-700 space-y-1 font-medium shadow-sm">
                    <div className="text-emerald-700 font-bold">✔ 100% Doctor consultation fee protection.</div>
                    <div>✔ Counter cash stays 100% in your clinic drawer.</div>
                    <div>✔ ₹1,000 automated commission safety buffer &amp; direct bank settlements.</div>
                    <div>✔ Transparent 3% coordination fee only on digital lab &amp; pharmacy clearing.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs mt-3 border border-slate-200">
              <span className="text-slate-700 font-medium">You retain sovereign control over your clinic's commercial agreements.</span>
              <span className="text-teal-700 font-bold">The 2-Touchpoint Loop →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 09: THE 2-TOUCHPOINT WHATSAPP CARE LOOP (TIMELINE)
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 9) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    09
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-0.5 rounded-full border border-teal-200">
                    Operational Workflow
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 09 / 12</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                The 2-Touchpoint WhatsApp Care Timeline
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl">
                Eliminating evening OPD crowding while ensuring 100% of prescribed medications and diagnostic tests are fulfilled within your network.
              </p>

              {/* Timeline Diagram */}
              <div className="space-y-3 mt-3.5">
                <div className="p-3 bg-slate-50 rounded-2xl border-l-4 border-l-slate-900 border border-slate-200 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                      1
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Morning In-Person Consultation (OPD)</h3>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Compounder registers walk-ins, records vitals (BP, Sugar, SpO2, Temp), and issues token (#TK-001). Doctor examines patient naturally.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-[10px] font-bold uppercase font-mono shrink-0 border border-indigo-200">
                    OPD Token #TK-001
                  </span>
                </div>

                <div className="p-3 bg-teal-50/70 rounded-2xl border-l-4 border-l-teal-600 border border-teal-200 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-md">
                      2
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Evening Diagnostic Report Review on WhatsApp</h3>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        When lab approves reports, WhatsApp delivers verified PDF with 2 single-tap reply options:
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="px-2 py-0.5 bg-white border border-teal-300 rounded-lg text-teal-800 text-[10px] font-bold shadow-sm">
                          🏥 Physical Review (Pharmacy Hold)
                        </span>
                        <span className="px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-[10px] font-bold shadow-sm">
                          💻 Virtual Video Review (1-Click Delivery)
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-800 text-[10px] font-bold uppercase font-mono shrink-0 border border-teal-200">
                    Sub-300ms Dispatch
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center mt-3">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-700">
                🎁 1 Free Virtual Consult
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-700">
                🏷️ 10% Off Chronic Refills
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-700">
                📱 Daily WhatsApp Alerts
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-700">
                📄 Instant PDF Reports
              </div>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 10: INTERACTIVE PRACTICE ROI & REVENUE SIMULATOR (DIAGRAM)
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 10) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    10
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200">
                    Practice Revenue Forecast
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 10 / 12</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Interactive Practice Revenue Simulator
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl">
                Simulate your monthly clinic revenue growth based on your daily OPD patient volume.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3.5">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">Daily OPD Patients:</span>
                      <span className="font-mono text-teal-700 font-black">{dailyPatients} Patients / day</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="80" 
                      step="5"
                      value={dailyPatients} 
                      onChange={(e) => setDailyPatients(Number(e.target.value))}
                      className="w-full accent-teal-600 cursor-pointer" 
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">Average Medicine Bill per Patient:</span>
                      <span className="font-mono text-teal-700 font-black">₹{avgMedicinePerPatient}</span>
                    </div>
                    <input 
                      type="range" 
                      min="500" 
                      max="3000" 
                      step="100"
                      value={avgMedicinePerPatient} 
                      onChange={(e) => setAvgMedicinePerPatient(Number(e.target.value))}
                      className="w-full accent-teal-600 cursor-pointer" 
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">Average Lab Tests Bill per Patient:</span>
                      <span className="font-mono text-purple-700 font-black">₹{avgLabPerPatient}</span>
                    </div>
                    <input 
                      type="range" 
                      min="400" 
                      max="2500" 
                      step="100"
                      value={avgLabPerPatient} 
                      onChange={(e) => setAvgLabPerPatient(Number(e.target.value))}
                      className="w-full accent-purple-600 cursor-pointer" 
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl border border-teal-300 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-teal-900">
                    Estimated Monthly Practice Financials (26 Days)
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between pb-0.5 border-b border-teal-200">
                      <span className="text-slate-700">Monthly OPD Consultation:</span>
                      <span className="font-mono font-bold text-slate-900">₹{monthlyMetrics.monthlyOpdRevenue.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pb-0.5 border-b border-teal-200">
                      <span className="text-slate-700">💊 Pharmacy Split ({pharmacySplit}%):</span>
                      <span className="font-mono font-bold text-teal-700">+₹{Math.round(monthlyMetrics.doctorMedAdvisorySplit).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pb-0.5 border-b border-teal-200">
                      <span className="text-slate-700">🔬 Pathology Lab Split ({labSplit}%):</span>
                      <span className="font-mono font-bold text-purple-700">+₹{Math.round(monthlyMetrics.doctorLabInterpretationSplit).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-teal-300 text-center space-y-0.5 shadow-sm">
                    <div className="text-[10px] font-bold uppercase text-teal-800">New Net Practice Income:</div>
                    <div className="text-2xl font-black text-teal-700 font-mono tracking-tight">
                      +₹{Math.round(monthlyMetrics.totalNewIncome).toLocaleString('en-IN')} <span className="text-xs text-teal-600 font-sans font-medium">/ mo</span>
                    </div>
                    <div className="text-[9px] text-slate-500">Total Practice Gross: ₹{Math.round(monthlyMetrics.totalPracticeRevenue).toLocaleString('en-IN')} / month</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs mt-3 border border-slate-200">
              <span className="text-slate-700 font-medium">Zero extra staff needed. 100% automated accounting and bank settlement.</span>
              <span className="text-teal-700 font-bold">Doctor FAQs →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 11: DOCTOR OBJECTION HANDLING & LEGAL COMPLIANCE
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 11) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    11
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-800 bg-indigo-50 px-3 py-0.5 rounded-full border border-indigo-200">
                    Legal &amp; Practical FAQs
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 11 / 12</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Addressing Doctor Questions &amp; Legal Compliance
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl">
                Clear, transparent answers to every clinical, operational, and commercial question.
              </p>

              <div className="space-y-2 mt-3.5">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    Q: "Is it legal and ethical for me to earn from lab/pharmacy splits?"
                  </div>
                  <p className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                    <strong>Yes, 100%.</strong> You receive a legitimate <em>Clinical Report Interpretation &amp; Tele-Monitoring Advisory Fee</em> for reviewing diagnostic values and supervising chronic dosage adherence under your clinic's formal SOP agreement.
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    Q: "My patients are elderly or rural; will they be able to use this?"
                  </div>
                  <p className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                    <strong>Zero app downloads required.</strong> 100% of patient interactions happen on standard WhatsApp using single-tap native reply buttons and voice notes.
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    Q: "Can I choose my own preferred chemist and pathology lab?"
                  </div>
                  <p className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                    <strong>Yes, absolutely.</strong> You have 100% freedom to connect your existing trusted neighborhood chemist and diagnostic center via their phone numbers.
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    Q: "How does counter cash collection work?"
                  </div>
                  <p className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                    100% of physical cash collected at your counter stays in your clinic drawer. Platform reconciliation happens automatically via your pre-funded Commission Pool balance.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs mt-3 border border-slate-200">
              <span className="text-slate-700 font-medium">Zero risk. 100% control. Transform your independent clinic today.</span>
              <span className="text-teal-700 font-bold">Get Started in 5 Minutes →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 12: 3-STEP GO-LIVE ROADMAP & EXECUTIVE CONTACT
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 12) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    12
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-0.5 rounded-full border border-teal-200">
                    Rapid Deployment
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 12 / 12</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Launch Your Connected Practice in 3 Simple Steps
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl">
                Zero upfront SaaS subscription fees. Zero complex hardware. Seamless practice onboarding in under 15 minutes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3.5">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-center">
                  <div className="w-8 h-8 rounded-xl bg-teal-600 text-white mx-auto flex items-center justify-center font-black text-xs shadow-md shadow-teal-600/20">
                    1
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Practice Setup &amp; Bank Link</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Register your clinic profile and link your direct settlement bank account (100% consultation fee protection).
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-center">
                  <div className="w-8 h-8 rounded-xl bg-teal-600 text-white mx-auto flex items-center justify-center font-black text-xs shadow-md shadow-teal-600/20">
                    2
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Connect Chemist &amp; Lab</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Link your trusted neighborhood pharmacy and pathology center with custom clinic SOP split parameters.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-center">
                  <div className="w-8 h-8 rounded-xl bg-teal-600 text-white mx-auto flex items-center justify-center font-black text-xs shadow-md shadow-teal-600/20">
                    3
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Front-Desk OPD Go-Live</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Compounder issues tokens and records vitals, while you consult with automated WhatsApp follow-ups active.
                  </p>
                </div>
              </div>

              {/* Direct Executive Contact Card */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl mt-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                <div className="space-y-0.5 text-center sm:text-left">
                  <div className="text-xs font-black text-white flex items-center gap-1.5 justify-center sm:justify-start">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" /> Schedule Your 15-Minute Practice Onboarding
                  </div>
                  <div className="text-[10px] text-slate-300">
                    Speak directly with our Executive Network Lead for on-site clinic onboarding and chemist integration.
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <a 
                    href="tel:+919608032073" 
                    className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md no-underline"
                  >
                    <PhoneCall className="w-3.5 h-3.5" /> +91 96080 32073
                  </a>
                  <a 
                    href="mailto:vivekobray2073@gmail.com" 
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all no-underline"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </a>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-2xl flex items-center justify-between text-xs text-slate-800 mt-2.5">
              <span className="font-bold text-teal-900">VitalSync: Virtual Hospital Network — "Your Clinic. Now a Hospital."</span>
              <span>Empowering Independent Physicians Across Tier 2 &amp; Tier 3 Healthcare Hubs</span>
            </div>
          </section>
        )}

      </main>

      {/* ── Slide Thumbnail Navigation Scrubber (Keynote Mode Only) ── */}
      {viewMode === 'keynote' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 no-print bg-white/95 backdrop-blur-md border-t border-slate-200 py-2.5 px-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
              {slideTitles.map((title, idx) => {
                const slideNum = idx + 1;
                const isActive = activeSlide === slideNum;
                return (
                  <button
                    key={slideNum}
                    onClick={() => setActiveSlide(slideNum)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border-0 ${
                      isActive 
                        ? 'bg-teal-600 text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {slideNum}. {title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
