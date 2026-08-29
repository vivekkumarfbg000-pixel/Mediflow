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
import { BrandMark } from '../components/shared/BrandMark';

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

  // Enforce pure bright executive light theme while on pitch deck
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    const oldColorScheme = document.documentElement.style.getPropertyValue('color-scheme');
    const oldBg = document.body.style.getPropertyValue('background-color');

    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    
    // Aggressively override OS-level auto-dark mode or browser extensions
    document.documentElement.style.setProperty('color-scheme', 'light', 'important');
    document.body.style.setProperty('background-color', '#f1f5f9', 'important');

    return () => {
      if (wasDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      }
      
      if (oldColorScheme) {
        document.documentElement.style.setProperty('color-scheme', oldColorScheme);
      } else {
        document.documentElement.style.removeProperty('color-scheme');
      }
      
      if (oldBg) {
        document.body.style.setProperty('background-color', oldBg);
      } else {
        document.body.style.removeProperty('background-color');
      }
    };
  }, []);

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
    "Ecosystem Architecture",
    "₹5,000 Patient Budget Split",
    "Practice Revenue Leap (3.8x)",
    "Paper Trap vs Digital Rx",
    "1-Click EMR & WhatsApp Bot",
    "Chronic Care Flywheel",
    "6 VIP Member Benefits",
    "Dynamic SOP Splits & Shield",
    "2-Touchpoint Care Timeline",
    "Practice Revenue Simulator",
    "Legal & Practical FAQs",
    "3-Step Practice Go-Live"
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans antialiased selection:bg-teal-600 selection:text-white pb-16 print:bg-white print:text-slate-900 print:pb-0">
      
      {/* ── High-Definition Magazine & Presentation Print Engine ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 0 !important;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-slide {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 297mm !important;
            max-width: 297mm !important;
            height: 210mm !important;
            max-height: 210mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            padding: 12mm 16mm !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }
          .print-box {
            border: 1.5px solid #cbd5e1 !important;
            background: #ffffff !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06) !important;
          }
          .print-tint {
            background-color: #f1f5f9 !important;
            border: 1px solid #cbd5e1 !important;
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
            <div className="w-9 h-9 shrink-0 flex items-center justify-center">
              <BrandMark size={36} title="VitalSync Logo" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-slate-900 flex items-center gap-2">
                <span className="font-black text-slate-900 leading-none">
                  <span className="text-[#1A7B8F]">Vital</span><span className="text-[#7AC47F]">Sync</span>
                </span>
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
              title="Print to PDF (A4 Landscape, Background Graphics ON)"
            >
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </button>
          </div>
        </div>
      </header>

      {/* ── Slide Content Container ── */}
      <main className="max-w-6xl mx-auto p-3 md:p-6 space-y-8 print:space-y-0 print:p-0 print:max-w-none">

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 01: COVER & THE CONNECTED VIRTUAL HOSPITAL ECOSYSTEM
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 1) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between relative overflow-hidden">
            <div>
              {/* Top Slide Header with Master Brand Badge & Slide Index */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                    <BrandMark size={40} title="VitalSync Logo" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base md:text-xl font-black tracking-tight text-slate-900 leading-none">
                        <span className="text-[#1A7B8F]">Vital</span><span className="text-[#7AC47F]">Sync</span>
                      </span>
                      <span className="text-[10px] uppercase font-black tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                        The Virtual Hospital Network
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-teal-700 tracking-tight mt-0.5">
                      Your Clinic. Now a Hospital. • Clinic Freedom. Hospital Revenue. On WhatsApp.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-teal-900 bg-teal-100 px-2.5 py-1 rounded-full border border-teal-300 hidden sm:inline-block">
                    Category-Defining Clinical Partnership
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                    SLIDE 01 / 12
                  </span>
                </div>
              </div>

              {/* Headline & Mission */}
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold uppercase tracking-wider border border-slate-300">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  Exclusively For Independent Doctors, Surgeons &amp; Clinic Owners
                </div>
                
                <h1 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                  Your Clinic. <span className="text-teal-700">Now a Hospital.</span>
                </h1>
                
                <p className="text-sm md:text-base font-bold text-teal-800 tracking-tight">
                  Clinic Freedom. Hospital Revenue. On WhatsApp.
                </p>
                
                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  Unite your OPD room with your local pharmacy and lab into an automated outpatient network. Deliver continuous care, <strong className="text-slate-950 font-bold">maximize lifelong patient retention</strong>, and <strong className="text-slate-950 font-bold">recover the 90% diagnostic &amp; medication value currently lost outside your clinic</strong> — expanding practice revenue by <strong className="text-teal-800 font-bold">2.5x to 3.8x per patient</strong> with <strong className="text-slate-950 font-bold">zero setup costs, zero SaaS fees, and zero workflow changes</strong>.
                </p>
              </div>

              {/* ── Center Infographic: The 4-Node Connected Triad Diagram ── */}
              <div className="my-2.5 p-3 bg-slate-50 rounded-2xl border-2 border-teal-200">
                <div className="text-[10px] font-black uppercase tracking-wider text-teal-900 mb-2 text-center">
                  ⚡ The VitalSync Connected Outpatient Loop (Zero App Downloads)
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-white rounded-xl border-2 border-teal-300 shadow-sm">
                    <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-900 mx-auto flex items-center justify-center font-bold text-base mb-1">
                      👨‍⚕️
                    </div>
                    <div className="text-xs font-black text-slate-900">Doctor OPD</div>
                    <div className="text-[10px] text-teal-800 font-bold">1-Click EMR &amp; Rx</div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border-2 border-emerald-300 shadow-sm">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-900 mx-auto flex items-center justify-center font-bold text-base mb-1">
                      📱
                    </div>
                    <div className="text-xs font-black text-slate-900">WhatsApp Bot</div>
                    <div className="text-[10px] text-emerald-800 font-bold">24/7 Patient Care</div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border-2 border-purple-300 shadow-sm">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-900 mx-auto flex items-center justify-center font-bold text-base mb-1">
                      🔬
                    </div>
                    <div className="text-xs font-black text-slate-900">Pathology Lab</div>
                    <div className="text-[10px] text-purple-800 font-bold">Auto-PDF Dispatch</div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border-2 border-blue-300 shadow-sm">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-900 mx-auto flex items-center justify-center font-bold text-base mb-1">
                      💊
                    </div>
                    <div className="text-xs font-black text-slate-900">Local Chemist</div>
                    <div className="text-[10px] text-blue-800 font-bold">1-Click Refills (10% OFF)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom 4 Institutional Guarantees */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200">
              <div className="p-2 bg-slate-100 rounded-xl border border-slate-300 text-center">
                <div className="text-[9px] font-bold uppercase text-teal-800">Adoption Cost</div>
                <div className="text-xs font-black text-slate-900">₹0 Setup / ₹0 SaaS</div>
              </div>
              <div className="p-2 bg-slate-100 rounded-xl border border-slate-300 text-center">
                <div className="text-[9px] font-bold uppercase text-indigo-800">Doctor Consultation</div>
                <div className="text-xs font-black text-slate-900">100% Protected (Rule 58)</div>
              </div>
              <div className="p-2 bg-slate-100 rounded-xl border border-slate-300 text-center">
                <div className="text-[9px] font-bold uppercase text-emerald-800">Patient Adoption</div>
                <div className="text-xs font-black text-slate-900">100% Native WhatsApp</div>
              </div>
              <div className="p-2 bg-slate-100 rounded-xl border border-slate-300 text-center">
                <div className="text-[9px] font-bold uppercase text-purple-800">Clinical Workflow</div>
                <div className="text-xs font-black text-slate-900">Zero Disruption</div>
              </div>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 02: PROBLEM 1 — THE ₹5,000 PATIENT WALLET INEQUALITY
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 2) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs shadow-sm">02</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-rose-900 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300">
                    The Clinical &amp; Revenue Reality
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">SLIDE 02 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                The ₹5,000 Patient Wallet Inequality
              </h2>
              <p className="text-xs text-slate-700 mt-0.5">
                Every patient spends <strong>₹3,000 to ₹5,000</strong> across your Clinic, Diagnostic Tests, and Prescribed Medicines.
              </p>

              {/* Visual Wallet Bar Infographic */}
              <div className="my-2.5 p-2.5 bg-slate-50 rounded-xl border-2 border-slate-300">
                <div className="text-[10px] font-bold text-slate-800 mb-1 flex justify-between">
                  <span>Where Patient's ₹5,000 Budget Goes Today:</span>
                  <span className="text-rose-700 font-black">Doctor Takes Only 10%</span>
                </div>
                <div className="w-full h-6 rounded-full overflow-hidden flex shadow-inner border border-slate-400">
                  <div className="h-full bg-rose-600 text-[10px] text-white font-black flex items-center justify-center" style={{ width: '10%' }}>
                    10% Dr (₹500)
                  </div>
                  <div className="h-full bg-teal-600 text-[10px] text-white font-black flex items-center justify-center" style={{ width: '56%' }}>
                    56% Chemist (₹2,800)
                  </div>
                  <div className="h-full bg-purple-600 text-[10px] text-white font-black flex items-center justify-center" style={{ width: '34%' }}>
                    34% Lab (₹1,700)
                  </div>
                </div>
              </div>

              {/* Side-by-Side Cognitive vs Capture Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2">
                <div className="p-3 bg-teal-50/60 rounded-xl border-l-4 border-l-teal-600 border border-teal-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-teal-950 font-black text-xs">
                    <Stethoscope className="w-3.5 h-3.5 text-teal-700" /> 100% Cognitive &amp; Clinical Work (You)
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-800 font-medium">
                    <div>✔ <strong>Diagnose</strong> complex pathology, symptoms &amp; vitals.</div>
                    <div>✔ <strong>Interpret lab reports</strong> and abnormal biomarkers.</div>
                    <div>✔ <strong>Advise medication</strong>, molecules &amp; dosage (1-0-1).</div>
                  </div>
                  <div className="p-1.5 bg-teal-100 rounded-lg text-[10px] font-black text-teal-950 border border-teal-200">
                    👨‍⚕️ You shoulder 100% of the clinical liability.
                  </div>
                </div>

                <div className="p-3 bg-rose-50/60 rounded-xl border-l-4 border-l-rose-600 border border-rose-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-rose-950 font-black text-xs">
                    <Coins className="w-3.5 h-3.5 text-rose-700" /> But Standalone Clinics Get Only 10%
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-800 font-medium">
                    <div>⚠️ <strong>Clinic Revenue:</strong> Only ₹500 consultation fee.</div>
                    <div>⚠️ <strong>External Chemist &amp; Lab:</strong> Capture 90% of value.</div>
                    <div>⚠️ <strong>Corporate Contrast:</strong> Apollo/Max capture <strong>70%</strong> in-house.</div>
                  </div>
                  <div className="p-1.5 bg-rose-100 rounded-lg text-[10px] font-black text-rose-950 border border-rose-200">
                    💡 VitalSync brings the corporate loop to your clinic.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-100 rounded-xl flex items-center justify-between text-xs border border-slate-300 mt-2">
              <span className="text-slate-800 font-bold">VitalSync connects your clinic to local pharmacies &amp; labs.</span>
              <span className="text-teal-800 font-black">The Revenue Leap →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 03: THE REVENUE LEAP — BEFORE VS AFTER
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 3) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm">03</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    The Practice Economics
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">SLIDE 03 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Revenue Comparison: Today vs. With VitalSync
              </h2>
              <p className="text-xs text-slate-700 mt-0.5">
                From a single episodic consultation fee to a continuous clinical revenue stream.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {/* Status Quo Card */}
                <div className="p-3.5 bg-slate-50 rounded-xl border-2 border-slate-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-rose-800">Your Clinic Right Now</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-bold">Status Quo</span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-800 font-medium">
                    <div className="flex justify-between pb-1 border-b border-slate-200">
                      <span>OPD Patient Consultation Fee</span>
                      <span className="font-mono font-bold text-slate-950">₹500.00</span>
                    </div>
                    <div className="flex justify-between pb-1 border-b border-slate-200 text-slate-500">
                      <span>Lab Report Interpretation Fee</span>
                      <span className="font-mono">₹0.00</span>
                    </div>
                    <div className="flex justify-between pb-1 border-b border-slate-200 text-slate-500">
                      <span>Medication Advisory Fee</span>
                      <span className="font-mono">₹0.00</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Chronic 30-Day Refill</span>
                      <span className="font-mono">₹0.00</span>
                    </div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-300 flex justify-between items-center shadow-sm">
                    <span className="text-xs font-black text-slate-800">Net Income / Patient:</span>
                    <span className="text-base font-black text-slate-950 font-mono">₹500.00</span>
                  </div>
                </div>

                {/* VitalSync Loop Card */}
                <div className="p-3.5 bg-teal-50/70 rounded-xl border-2 border-teal-300 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-teal-950 font-black">With VitalSync Loop</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">3.8x Leap</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between pb-1 border-b border-teal-200">
                      <span className="text-slate-900 font-bold">OPD Consultation Fee</span>
                      <span className="font-mono font-bold text-slate-950">₹500.00</span>
                    </div>
                    <div className="flex justify-between pb-1 border-b border-teal-200 text-slate-800 font-medium">
                      <span>🔬 Lab Interpretation Split (35%)</span>
                      <span className="font-mono font-bold text-teal-800">+₹350 – ₹600</span>
                    </div>
                    <div className="flex justify-between pb-1 border-b border-teal-200 text-slate-800 font-medium">
                      <span>💊 Medication Advisory Split (25%)</span>
                      <span className="font-mono font-bold text-teal-800">+₹250 – ₹500</span>
                    </div>
                    <div className="flex justify-between text-slate-800 font-medium">
                      <span>📦 Chronic Refill Equity (Day 25)</span>
                      <span className="font-mono font-bold text-emerald-800">+₹150 – ₹300</span>
                    </div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border-2 border-teal-300 flex justify-between items-center shadow-sm">
                    <span className="text-xs font-black text-teal-950">Net Income / Patient:</span>
                    <span className="text-lg font-black text-teal-800 font-mono">₹1,250 – ₹1,900+</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-100 rounded-xl flex items-center justify-between text-xs border border-slate-300 mt-2">
              <span className="text-slate-800 font-bold">Doctors earn 2.5x to 3.8x higher practice revenue per patient.</span>
              <span className="text-teal-800 font-black">Problem 2: Patient Retention →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 04: THE PAPER PRESCRIPTION TRAP VS. DIGITAL RX & HOSPITAL BENCHMARK
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 4) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs shadow-sm">04</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-rose-900 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300">
                    The Clinical Safety &amp; Discounter Threat
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">SLIDE 04 / 12</span>
              </div>

              {/* Core Problem Headline & Quote */}
              <div className="space-y-1">
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>The Paper Prescription Trap:</span>
                  <span className="text-rose-700">Why Top Hospitals Banned Paper Rx</span>
                </h2>
                <div className="p-2 bg-slate-900 text-slate-100 rounded-xl border-l-4 border-l-amber-400 shadow-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] md:text-xs leading-relaxed font-semibold italic text-slate-200">
                    "Every time you write an Rx on paper, your patient walks out the door and is targeted by online discounters. You lose follow-up visibility, and the patient loses care continuity."
                  </p>
                </div>
              </div>

              {/* Tier-1 Hospital Benchmark Banner */}
              <div className="mt-2 p-2 bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 rounded-xl border border-teal-300 flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-900">
                    <strong className="text-teal-950 font-black uppercase tracking-wider">The Tier-1 Hospital Standard: </strong>
                    <span>Apollo, Max, Fortis &amp; Medanta <strong>100% mandate digital prescriptions</strong> to eliminate handwriting malpractice lawsuits and capture 70% in-house downstream care. VitalSync brings this exact digital power to your OPD for <strong className="text-teal-800 font-bold">₹0</strong>.</span>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Visual Comparison Diagram */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2.5">
                {/* Status Quo: Paper Prescription Card */}
                <div className="p-3 bg-rose-50/50 rounded-xl border-2 border-rose-200 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-rose-200">
                    <span className="text-xs font-black uppercase text-rose-950 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-rose-700" /> ❌ Paper Prescriptions (Status Quo)
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-200 text-rose-900">3 Deadly Practice Risks</span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-800">
                    <div className="p-1.5 bg-white rounded-lg border border-rose-200 shadow-xs">
                      <div className="font-bold text-rose-950 flex items-center gap-1">
                        <span className="text-rose-600 font-black">1.</span> Online Discounter Poaching
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Patient uploads paper slip to Tata 1mg / PharmEasy for 15% discount. Doctor loses chronic refills &amp; patient loyalty forever.
                      </p>
                    </div>

                    <div className="p-1.5 bg-white rounded-lg border border-rose-200 shadow-xs">
                      <div className="font-bold text-rose-950 flex items-center gap-1">
                        <span className="text-rose-600 font-black">2.</span> Pharmacist Misinterpretation
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Illegible handwriting causes chemists to dispense Look-Alike / Sound-Alike (LASA) molecules or wrong dosage frequencies.
                      </p>
                    </div>

                    <div className="p-1.5 bg-white rounded-lg border border-rose-200 shadow-xs">
                      <div className="font-bold text-rose-950 flex items-center gap-1">
                        <span className="text-rose-600 font-black">3.</span> Zero Interaction Defense
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        In a 40-patient OPD rush, paper offers zero real-time warning for harmful drug-drug interactions, duplicate therapies, or allergies.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Solution: VitalSync Digital Rx Card */}
                <div className="p-3 bg-teal-50/70 rounded-xl border-2 border-teal-300 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between pb-1.5 border-b border-teal-200">
                    <span className="text-xs font-black uppercase text-teal-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-700" /> 🛡️ VitalSync Digital Rx &amp; CDSS
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">Hospital-Grade Safety</span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-800">
                    <div className="p-1.5 bg-white rounded-lg border border-teal-200 shadow-xs">
                      <div className="font-bold text-teal-950 flex items-center gap-1">
                        <span className="text-teal-700 font-black">1.</span> 1-Tap WhatsApp Retention
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Digital Rx routed instantly to patient's WhatsApp + 10% VIP local chemist fulfillment — 100% patient retention, zero discounter leakage.
                      </p>
                    </div>

                    <div className="p-1.5 bg-white rounded-lg border border-teal-200 shadow-xs">
                      <div className="font-bold text-teal-950 flex items-center gap-1">
                        <span className="text-teal-700 font-black">2.</span> 100% Accurate Dispensing
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Standardized molecule names &amp; structured dosages (<code className="bg-slate-100 px-1 rounded text-teal-800 font-mono font-bold">1-0-1</code>, meal timing) eliminate pharmacist misinterpretation.
                      </p>
                    </div>

                    <div className="p-1.5 bg-white rounded-lg border border-teal-200 shadow-xs">
                      <div className="font-bold text-teal-950 flex items-center gap-1">
                        <span className="text-teal-700 font-black">3.</span> Real-Time CDSS Safety Alerts
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Automated pop-up warnings flag dangerous drug-drug combinations, duplicate molecules &amp; allergy conflicts before signing.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-100 rounded-xl flex items-center justify-between text-xs border border-slate-300 mt-2">
              <span className="text-slate-800 font-bold">VitalSync protects clinical reputation and automates lifelong patient loyalty.</span>
              <span className="text-teal-800 font-black">The 1-Click EMR Solution →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 05: THE 24/7 WHATSAPP CARE & EMR SOLUTION
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 5) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">05</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-teal-900 bg-teal-100 px-2.5 py-0.5 rounded-full border border-teal-300">
                    The VitalSync Technology Suite
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">SLIDE 05 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                1-Click EMR &amp; 24/7 WhatsApp Clinic Chatbot
              </h2>
              <p className="text-xs text-slate-700 mt-0.5">
                Digital records on your Doctor Dashboard + Automated WhatsApp Bot in your patient's phone.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {/* Doctor EMR Card */}
                <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-teal-950 font-black text-xs uppercase">
                    <Stethoscope className="w-3.5 h-3.5 text-teal-700" /> 1. Doctor EMR Dashboard
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-800 font-medium">
                    <div className="p-1.5 bg-white rounded-lg border border-slate-300 flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-teal-700 shrink-0" />
                      <span><strong>1-Click History:</strong> Press <code className="bg-slate-100 px-1 rounded text-teal-800 font-mono font-bold">Ctrl + K</code> for past vitals &amp; tests.</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-lg border border-slate-300 flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-teal-700 shrink-0" />
                      <span><strong>AI Voice Scribe:</strong> Speak Hindi or English notes; auto-generates digital Rx.</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-lg border border-teal-300 bg-teal-50/50 flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-teal-700 shrink-0" />
                      <span><strong>CDSS Safety Sentry:</strong> Real-time alert on dangerous drug interactions &amp; allergies.</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-lg border border-slate-300 flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-teal-700 shrink-0" />
                      <span><strong>Specialty Sheets:</strong> Eye Refraction (RE/LE), Cardiology ECG, Pediatrics.</span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Chat Simulation Frame */}
                <div className="p-3 bg-emerald-50/70 rounded-xl border-2 border-emerald-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-950 font-black text-xs uppercase">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-700" /> 2. WhatsApp Patient Chatbot
                    </div>
                    <span className="text-[9px] bg-emerald-700 text-white font-black px-2 py-0.5 rounded-full">
                      Online 24/7
                    </span>
                  </div>

                  <div className="bg-white rounded-lg p-2 border border-emerald-300 shadow-sm space-y-1 text-[10px]">
                    <div className="bg-slate-100 rounded-md p-1.5 text-slate-900 font-medium">
                      💬 <em>"Namaste Sharma ji! Doctor Sahab ne aapka prescription aur report bhej diya hai."</em>
                    </div>
                    <div className="flex gap-1">
                      <span className="px-2 py-0.5 bg-emerald-700 text-white font-bold rounded text-[9px]">
                        📦 1-Click Refill (10% OFF)
                      </span>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-900 font-bold rounded text-[9px]">
                        📄 Download PDF
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-100 rounded-xl flex items-center justify-between text-xs border border-slate-300 mt-2">
              <span className="text-slate-800 font-bold">Zero app downloads. 100% of communication happens on native WhatsApp.</span>
              <span className="text-teal-800 font-black">Chronic Care Loop →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 06: CHRONIC PATIENT CARE FLYWHEEL
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 6) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">06</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-900 bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-300">
                    Lifelong Care Loop
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">SLIDE 06 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                The Chronic Patient Care Flywheel
              </h2>
              <p className="text-xs text-slate-700 mt-0.5">
                Chronic patients (Diabetes, Hypertension, Thyroid, Heart) need 10–20+ years of active monitoring.
              </p>

              {/* 4-Stage Flywheel Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3">
                <div className="p-2.5 bg-teal-50 rounded-xl border-2 border-teal-300 text-center space-y-0.5">
                  <div className="w-6 h-6 rounded-md bg-teal-700 text-white mx-auto flex items-center justify-center font-bold text-xs">1</div>
                  <div className="text-[11px] font-black text-slate-950">Dose Alerts</div>
                  <p className="text-[10px] text-slate-800 font-medium">Daily morning &amp; evening reminders (1-0-1) on WhatsApp.</p>
                </div>

                <div className="p-2.5 bg-indigo-50 rounded-xl border-2 border-indigo-300 text-center space-y-0.5">
                  <div className="w-6 h-6 rounded-md bg-indigo-700 text-white mx-auto flex items-center justify-center font-bold text-xs">2</div>
                  <div className="text-[11px] font-black text-slate-950">Day-25 Refills</div>
                  <p className="text-[10px] text-slate-800 font-medium">1-Tap 10% discounted medicine refills delivered home.</p>
                </div>

                <div className="p-2.5 bg-purple-50 rounded-xl border-2 border-purple-300 text-center space-y-0.5">
                  <div className="w-6 h-6 rounded-md bg-purple-700 text-white mx-auto flex items-center justify-center font-bold text-xs">3</div>
                  <div className="text-[11px] font-black text-slate-950">90-Day Tests</div>
                  <p className="text-[10px] text-slate-800 font-medium">Quarterly home blood collection for HbA1c, Lipid panels.</p>
                </div>

                <div className="p-2.5 bg-emerald-50 rounded-xl border-2 border-emerald-300 text-center space-y-0.5">
                  <div className="w-6 h-6 rounded-md bg-emerald-700 text-white mx-auto flex items-center justify-center font-bold text-xs">4</div>
                  <div className="text-[11px] font-black text-slate-950">Paid Consults</div>
                  <p className="text-[10px] text-slate-800 font-medium">Continuous in-person or video follow-up fees to doctor.</p>
                </div>
              </div>

              <div className="p-2 bg-teal-100 rounded-xl mt-2.5 border border-teal-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-teal-800 shrink-0" />
                <span className="text-[10px] text-teal-950 font-bold">
                  <strong>Refill Defaulter Safety Net:</strong> If a chronic patient misses their refill by &gt;7 days, your EMR alerts you with a 1-Tap outreach button.
                </span>
              </div>
            </div>

            <div className="p-2 bg-slate-100 rounded-xl flex items-center justify-between text-xs border border-slate-300 mt-2">
              <span className="text-slate-800 font-bold">Turn one-time walk-ins into continuous 10-year recurring patient relationships.</span>
              <span className="text-teal-800 font-black">The VIP Member Benefits →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 07: THE 6 VIP MEMBER BENEFITS (THE PATIENT MAGNET)
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 7) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">07</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-teal-900 bg-teal-100 px-2.5 py-0.5 rounded-full border border-teal-300">
                    The Patient Magnet
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">SLIDE 07 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Why Patients Choose Your Connected Loop
              </h2>
              <p className="text-xs text-slate-700 mt-0.5">
                When patients purchase from your partnered pharmacy &amp; lab, their WhatsApp unlocks <strong>6 VIP Benefits</strong>:
              </p>

              {/* 6 VIP Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-300 space-y-0.5">
                  <div className="text-sm">📄</div>
                  <div className="text-[11px] font-black text-slate-950">1. Instant PDF Lab Reports</div>
                  <p className="text-[10px] text-slate-800 font-medium">Delivered immediately on WhatsApp. <strong>Zero lab revisiting</strong>.</p>
                </div>

                <div className="p-2.5 bg-purple-50/80 rounded-xl border border-purple-300 space-y-0.5">
                  <div className="text-sm">🗣️</div>
                  <div className="text-[11px] font-black text-slate-950">2. Hinglish AI Voice Analysis</div>
                  <p className="text-[10px] text-slate-800 font-medium">Audio/text explanations of high/low biomarkers in simple Hindi.</p>
                </div>

                <div className="p-2.5 bg-teal-50/80 rounded-xl border border-teal-300 space-y-0.5">
                  <div className="text-sm">💊</div>
                  <div className="text-[11px] font-black text-slate-950">3. Daily Dosage Reminders</div>
                  <p className="text-[10px] text-slate-800 font-medium">Morning &amp; evening (1-0-1) dose alerts so medicines are never skipped.</p>
                </div>

                <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-300 space-y-0.5">
                  <div className="text-sm">🎁</div>
                  <div className="text-[11px] font-black text-slate-950">4. 1 Free Virtual Consult</div>
                  <p className="text-[10px] text-slate-800 font-medium">Valid for 15–20 days. Patients clarify symptoms without paying twice.</p>
                </div>

                <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-300 space-y-0.5">
                  <div className="text-sm">🏷️</div>
                  <div className="text-[11px] font-black text-slate-950">5. 10% OFF Chronic Refills</div>
                  <p className="text-[10px] text-slate-800 font-medium">Structured 10% loyalty discount on recurring 30-day medicine orders.</p>
                </div>

                <div className="p-2.5 bg-rose-50/80 rounded-xl border border-rose-300 space-y-0.5">
                  <div className="text-sm">📊</div>
                  <div className="text-[11px] font-black text-slate-950">6. Health Trend Charts</div>
                  <p className="text-[10px] text-slate-800 font-medium">WhatsApp automatically charts blood pressure and sugar trends over time.</p>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-100 rounded-xl flex items-center justify-between text-xs border border-slate-300 mt-2">
              <span className="text-slate-800 font-bold">Patients naturally choose your network pharmacy and lab for these VIP benefits.</span>
              <span className="text-teal-800 font-black">Dynamic SOP Splits →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 08: DOCTOR-CONTROLLED DYNAMIC SPLITS & FEE PROTECTION
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 8) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-sm">08</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-purple-900 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-300">
                    Governance &amp; Fee Protection
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">SLIDE 08 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Doctor-Controlled Dynamic Splits &amp; Fee Protection
              </h2>
              <p className="text-xs text-slate-700 mt-0.5">
                You maintain 100% autonomy over your network economics. Set custom splits with 1 tap.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-300 space-y-1.5">
                  <div className="text-xs font-black text-slate-950 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-teal-700" /> Dynamic Practice Parameters
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-300">
                      <span className="font-bold text-slate-900">💊 Pharmacy Medication Split</span>
                      <span className="font-mono font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">20% – 30%</span>
                    </div>
                    <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-300">
                      <span className="font-bold text-slate-900">🔬 Pathology Diagnostic Split</span>
                      <span className="font-mono font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">30% – 40%</span>
                    </div>
                    <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-300">
                      <span className="font-bold text-slate-900">🚨 Emergency SOS Priority Fee</span>
                      <span className="font-mono font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded">₹618.00</span>
                    </div>
                    <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-300">
                      <span className="font-bold text-slate-900">🏷️ Chronic Refill Loyalty Discount</span>
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">10% OFF</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-300 space-y-1.5">
                  <div className="text-xs font-black text-slate-950 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> Rule 58 / 103: Fee Protection
                  </div>
                  <p className="text-[10px] text-slate-800 font-medium">
                    100% of patient consultation fees booked at counter go directly to you with <strong>0% platform deduction</strong>.
                  </p>
                  <div className="p-2 bg-white rounded-lg border border-slate-300 text-[10px] text-slate-800 space-y-0.5 font-bold">
                    <div className="text-emerald-800">✔ 100% Doctor consultation fee protection.</div>
                    <div>✔ Counter cash stays 100% in your clinic drawer.</div>
                    <div>✔ ₹1,000 automated commission safety buffer &amp; direct bank settlements.</div>
                    <div>✔ Transparent 3% coordination fee only on digital clearing.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-100 rounded-xl flex items-center justify-between text-xs border border-slate-300 mt-2">
              <span className="text-slate-800 font-bold">You retain sovereign control over your clinic's commercial agreements.</span>
              <span className="text-teal-800 font-black">The 2-Touchpoint Loop →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 09: THE 2-TOUCHPOINT CARE TIMELINE
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 9) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">09</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-teal-900 bg-teal-100 px-2.5 py-0.5 rounded-full border border-teal-300">
                    Operational Workflow
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">SLIDE 09 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                The 2-Touchpoint WhatsApp Care Timeline
              </h2>
              <p className="text-xs text-slate-700 mt-0.5">
                Minimizing evening OPD crowding while capturing high-value diagnostic and medication volume in your network.
              </p>

              {/* Timeline Diagram */}
              <div className="space-y-2 mt-3">
                <div className="p-2.5 bg-slate-50 rounded-xl border-l-4 border-l-slate-900 border border-slate-300 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">1</div>
                    <div>
                      <div className="text-xs font-black text-slate-950">Morning In-Person Consultation (OPD)</div>
                      <p className="text-[10px] text-slate-800 font-medium">Compounder registers walk-ins, records vitals (BP, Sugar, SpO2, Temp), issues token (#TK-001).</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[9px] font-black uppercase font-mono shrink-0 border border-indigo-200">
                    OPD Token #TK-001
                  </span>
                </div>

                <div className="p-2.5 bg-teal-50/70 rounded-xl border-l-4 border-l-teal-600 border border-teal-300 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-md bg-teal-700 text-white flex items-center justify-center font-black text-xs shrink-0">2</div>
                    <div>
                      <div className="text-xs font-black text-slate-950">Evening Diagnostic Report Review on WhatsApp</div>
                      <p className="text-[10px] text-slate-800 font-medium">Lab approves reports ➔ WhatsApp delivers PDF with 2 interactive single-tap buttons:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="px-1.5 py-0.5 bg-white border border-teal-400 rounded text-teal-900 text-[9px] font-bold">
                          🏥 Physical Review (Pharmacy Hold)
                        </span>
                        <span className="px-1.5 py-0.5 bg-white border border-slate-400 rounded text-slate-900 text-[9px] font-bold">
                          💻 Virtual Video Review (1-Click Delivery)
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 text-[9px] font-black uppercase font-mono shrink-0 border border-teal-200">
                    Sub-300ms Dispatch
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Bottom Value Badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center mt-2">
              <div className="p-2 bg-slate-100 rounded-lg border border-slate-300 text-[10px] font-black text-slate-800">
                🎁 1 Free Virtual Consult
              </div>
              <div className="p-2 bg-slate-100 rounded-lg border border-slate-300 text-[10px] font-black text-slate-800">
                🏷️ 10% Off Chronic Refills
              </div>
              <div className="p-2 bg-slate-100 rounded-lg border border-slate-300 text-[10px] font-black text-slate-800">
                📱 Daily WhatsApp Alerts
              </div>
              <div className="p-2 bg-slate-100 rounded-lg border border-slate-300 text-[10px] font-black text-slate-800">
                📄 Instant PDF Reports
              </div>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 10: INTERACTIVE PRACTICE ROI & REVENUE SIMULATOR
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 10) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm">10</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    Practice Revenue Forecast
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">SLIDE 10 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Interactive Practice Revenue Simulator
              </h2>
              <p className="text-xs text-slate-700 mt-0.5">
                Simulate your monthly clinic revenue growth based on your daily OPD patient volume.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-300 space-y-2">
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-slate-800">Daily OPD Patients:</span>
                      <span className="font-mono text-teal-800">{dailyPatients} Patients / day</span>
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

                  <div className="space-y-0.5">
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-slate-800">Avg Medicine Bill / Patient:</span>
                      <span className="font-mono text-teal-800">₹{avgMedicinePerPatient}</span>
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

                  <div className="space-y-0.5">
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-slate-800">Avg Lab Bill / Patient:</span>
                      <span className="font-mono text-purple-800">₹{avgLabPerPatient}</span>
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

                <div className="p-3 bg-teal-50/80 rounded-xl border-2 border-teal-300 space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-teal-950">
                    Estimated Monthly Practice Financials (26 Days)
                  </div>

                  <div className="space-y-0.5 text-xs text-slate-800 font-medium">
                    <div className="flex justify-between pb-0.5 border-b border-teal-200">
                      <span>Monthly OPD Consultation:</span>
                      <span className="font-mono font-bold text-slate-950">₹{monthlyMetrics.monthlyOpdRevenue.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pb-0.5 border-b border-teal-200">
                      <span>💊 Pharmacy Split ({pharmacySplit}%):</span>
                      <span className="font-mono font-bold text-teal-800">+₹{Math.round(monthlyMetrics.doctorMedAdvisorySplit).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pb-0.5 border-b border-teal-200">
                      <span>🔬 Pathology Lab Split ({labSplit}%):</span>
                      <span className="font-mono font-bold text-purple-800">+₹{Math.round(monthlyMetrics.doctorLabInterpretationSplit).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-lg border-2 border-teal-300 text-center space-y-0.5 shadow-sm">
                    <div className="text-[9px] font-black uppercase text-teal-900">New Net Practice Income:</div>
                    <div className="text-xl font-black text-teal-800 font-mono tracking-tight">
                      +₹{Math.round(monthlyMetrics.totalNewIncome).toLocaleString('en-IN')} <span className="text-[11px] text-teal-700 font-sans font-bold">/ mo</span>
                    </div>
                    <div className="text-[8px] text-slate-600 font-medium">Total Practice Gross: ₹{Math.round(monthlyMetrics.totalPracticeRevenue).toLocaleString('en-IN')} / month</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-100 rounded-xl flex items-center justify-between text-xs border border-slate-300 mt-2">
              <span className="text-slate-800 font-bold">Seamlessly integrates with your existing clinic workflow. Automated ledger reconciliation and secure bank settlements.</span>
              <span className="text-teal-800 font-black">Doctor FAQs →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 11: DOCTOR OBJECTION HANDLING & LEGAL COMPLIANCE
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 11) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">11</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-900 bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-300">
                    Legal &amp; Practical FAQs
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">SLIDE 11 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Addressing Doctor Questions &amp; Legal Compliance
              </h2>
              <p className="text-xs text-slate-700 mt-0.5">
                Clear, transparent answers to every clinical, operational, and commercial question.
              </p>

              <div className="space-y-1.5 mt-3">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-300 space-y-0.5">
                  <div className="text-xs font-black text-slate-950 flex items-center gap-1">
                    <Check className="w-3 h-3 text-teal-700 shrink-0" />
                    Q: "Is it legal and ethical for me to earn from lab/pharmacy splits?"
                  </div>
                  <p className="text-[10px] text-slate-800 pl-4 font-medium">
                    <strong>Yes, 100%.</strong> You receive a legitimate <em>Clinical Report Interpretation &amp; Tele-Monitoring Advisory Fee</em> for reviewing diagnostic values and supervising chronic dosage adherence under your clinic's formal SOP agreement.
                  </p>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg border border-slate-300 space-y-0.5">
                  <div className="text-xs font-black text-slate-950 flex items-center gap-1">
                    <Check className="w-3 h-3 text-teal-700 shrink-0" />
                    Q: "My patients are elderly or rural; will they be able to use this?"
                  </div>
                  <p className="text-[10px] text-slate-800 pl-4 font-medium">
                    <strong>Zero app downloads required.</strong> 100% of patient interactions happen on standard WhatsApp using single-tap native reply buttons and voice notes.
                  </p>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg border border-slate-300 space-y-0.5">
                  <div className="text-xs font-black text-slate-950 flex items-center gap-1">
                    <Check className="w-3 h-3 text-teal-700 shrink-0" />
                    Q: "Can I choose my own preferred chemist and pathology lab?"
                  </div>
                  <p className="text-[10px] text-slate-800 pl-4 font-medium">
                    <strong>Yes, absolutely.</strong> You have 100% freedom to connect your existing trusted neighborhood chemist and diagnostic center via their phone numbers.
                  </p>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg border border-slate-300 space-y-0.5">
                  <div className="text-xs font-black text-slate-950 flex items-center gap-1">
                    <Check className="w-3 h-3 text-teal-700 shrink-0" />
                    Q: "How does counter cash collection work?"
                  </div>
                  <p className="text-[10px] text-slate-800 pl-4 font-medium">
                    100% of physical cash collected at your counter stays in your clinic drawer. Platform reconciliation happens automatically via your pre-funded Commission Pool balance.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-100 rounded-xl flex items-center justify-between text-xs border border-slate-300 mt-2">
              <span className="text-slate-800 font-bold">Secure, compliant, and fully autonomous. Modernize your independent clinic today.</span>
              <span className="text-teal-800 font-black">Get Started in 5 Minutes →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 12: 3-STEP GO-LIVE ROADMAP & EXECUTIVE CONTACT
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 12) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">12</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-teal-900 bg-teal-100 px-2.5 py-0.5 rounded-full border border-teal-300">
                    Rapid Deployment
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">SLIDE 12 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Launch Your Connected Practice in 3 Simple Steps
              </h2>
              <p className="text-xs text-slate-700 mt-0.5">
                Zero upfront SaaS subscription fees. Zero complex hardware. Practice onboarding in under 15 minutes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3">
                <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-300 space-y-1 text-center">
                  <div className="w-7 h-7 rounded-lg bg-teal-700 text-white mx-auto flex items-center justify-center font-black text-xs shadow-sm">1</div>
                  <div className="text-xs font-black text-slate-950">Practice Setup &amp; Bank</div>
                  <p className="text-[10px] text-slate-800 font-medium">Register clinic profile and link direct settlement bank account (Rule 58).</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-300 space-y-1 text-center">
                  <div className="w-7 h-7 rounded-lg bg-teal-700 text-white mx-auto flex items-center justify-center font-black text-xs shadow-sm">2</div>
                  <div className="text-xs font-black text-slate-950">Connect Chemist &amp; Lab</div>
                  <p className="text-[10px] text-slate-800 font-medium">Link trusted neighborhood pharmacy &amp; lab with custom SOP split parameters.</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-300 space-y-1 text-center">
                  <div className="w-7 h-7 rounded-lg bg-teal-700 text-white mx-auto flex items-center justify-center font-black text-xs shadow-sm">3</div>
                  <div className="text-xs font-black text-slate-950">Front-Desk OPD Go-Live</div>
                  <p className="text-[10px] text-slate-800 font-medium">Compounder issues tokens &amp; vitals; doctor consults with WhatsApp active.</p>
                </div>
              </div>

              {/* Direct Executive Contact Card */}
              <div className="p-3 bg-slate-900 text-white rounded-xl mt-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                <div className="space-y-0.5 text-center sm:text-left">
                  <div className="text-xs font-black text-white flex items-center gap-1.5 justify-center sm:justify-start">
                    <Sparkles className="w-3 h-3 text-teal-400" /> Schedule Your 15-Minute Practice Onboarding
                  </div>
                  <div className="text-[10px] text-slate-300">
                    Speak directly with our Executive Lead for on-site clinic onboarding and chemist integration.
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <a 
                    href="tel:+919608032073" 
                    className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1 transition-all shadow-md no-underline"
                  >
                    <PhoneCall className="w-3 h-3" /> +91 96080 32073
                  </a>
                  <a 
                    href="mailto:vivekobray2073@gmail.com" 
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all no-underline"
                  >
                    <Mail className="w-3 h-3" /> Email
                  </a>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-teal-50 border-2 border-teal-300 rounded-xl flex items-center justify-between text-xs text-slate-900 mt-2 font-medium">
              <div className="flex items-center gap-2.5">
                <BrandMark size={22} title="VitalSync Logo" />
                <span className="font-black text-teal-950">
                  <span className="text-[#1A7B8F]">Vital</span><span className="text-[#7AC47F]">Sync</span>: Virtual Hospital Network — "Your Clinic. Now a Hospital."
                </span>
              </div>
              <span className="text-slate-700 text-[11px] hidden sm:inline">Empowering Independent Physicians Across Tier 2 &amp; Tier 3 Healthcare Hubs</span>
            </div>
          </section>
        )}

      </main>

      {/* ── Slide Thumbnail Navigation Scrubber (Keynote Mode Only) ── */}
      {viewMode === 'keynote' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 no-print bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
              {slideTitles.map((title, idx) => {
                const slideNum = idx + 1;
                const isActive = activeSlide === slideNum;
                return (
                  <button
                    key={slideNum}
                    onClick={() => setActiveSlide(slideNum)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer border-0 ${
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
