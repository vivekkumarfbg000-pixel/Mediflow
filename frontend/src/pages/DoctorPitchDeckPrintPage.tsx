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
  Bot,
  RefreshCw,
  QrCode,
  Shield,
  FileCheck
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
    "Ecosystem Architecture",
    "₹5,000 Patient Budget Split",
    "Practice Revenue Leap (3.8x)",
    "Patient Retention Friction",
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
    <div className="min-h-screen bg-slate-100/90 text-slate-800 font-sans antialiased selection:bg-teal-600 selection:text-white pb-16 print:bg-white print:text-slate-900 print:pb-0">
      
      {/* ── Strict Page-Break CSS for Print / PDF Engine ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 4mm 6mm;
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
            height: 195mm !important;
            max-height: 195mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            gap: 8px !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 12px !important;
            padding: 12px 16px !important;
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
      <main className="max-w-6xl mx-auto p-3 md:p-6 space-y-8 print:space-y-0 print:p-0 print:max-w-none">

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 01: COVER & THE CONNECTED VIRTUAL HOSPITAL ECOSYSTEM
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 1) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">01</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    Category-Defining Clinical Partnership
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 01 / 12</span>
              </div>

              {/* Headline & Mission */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  Exclusively For Independent Doctors, Surgeons &amp; Clinic Owners
                </div>
                
                <h1 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                  Your Clinic. <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">Now a Hospital.</span>
                </h1>
                
                <p className="text-sm md:text-base font-bold text-teal-800 tracking-tight">
                  Clinic Freedom. Hospital Revenue. On WhatsApp.
                </p>
                
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  Unite your OPD room with your local pharmacy and lab into an automated outpatient network. Deliver continuous care, retain 100% patient loyalty, and unlock <strong className="text-slate-900 font-semibold">+₹1,00,000 to +₹2,50,000+ monthly recurring income</strong> with <strong className="text-teal-700 font-semibold">zero setup costs, zero SaaS fees, and zero workflow changes</strong>.
                </p>
              </div>

              {/* ── Center Infographic: The 4-Node Connected Triad Diagram ── */}
              <div className="my-3 p-3 bg-gradient-to-br from-slate-50 to-teal-50/40 rounded-2xl border border-teal-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800 mb-2 text-center">
                  ⚡ The VitalSync Connected Care Loop (Zero App Downloads)
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-white rounded-xl border border-teal-200 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 mx-auto flex items-center justify-center font-bold text-sm mb-1">
                      👨‍⚕️
                    </div>
                    <div className="text-[11px] font-bold text-slate-900">Doctor OPD</div>
                    <div className="text-[9px] text-teal-700 font-medium">1-Click EMR &amp; Rx</div>
                  </div>

                  <div className="p-2 bg-white rounded-xl border border-emerald-200 shadow-sm relative">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center font-bold text-sm mb-1">
                      📱
                    </div>
                    <div className="text-[11px] font-bold text-slate-900">WhatsApp Bot</div>
                    <div className="text-[9px] text-emerald-700 font-medium">24/7 Patient Concierge</div>
                  </div>

                  <div className="p-2 bg-white rounded-xl border border-purple-200 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 mx-auto flex items-center justify-center font-bold text-sm mb-1">
                      🔬
                    </div>
                    <div className="text-[11px] font-bold text-slate-900">Pathology Lab</div>
                    <div className="text-[9px] text-purple-700 font-medium">Auto-PDF Dispatch</div>
                  </div>

                  <div className="p-2 bg-white rounded-xl border border-blue-200 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 mx-auto flex items-center justify-center font-bold text-sm mb-1">
                      💊
                    </div>
                    <div className="text-[11px] font-bold text-slate-900">Local Chemist</div>
                    <div className="text-[9px] text-blue-700 font-medium">1-Click Refills (10% OFF)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom 4 Institutional Guarantees */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-[9px] font-bold uppercase text-teal-700">Adoption Cost</div>
                <div className="text-xs font-black text-slate-900">₹0 Setup / ₹0 SaaS</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-[9px] font-bold uppercase text-indigo-700">Doctor Consultation</div>
                <div className="text-xs font-black text-slate-900">100% Protected (Rule 58)</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-[9px] font-bold uppercase text-emerald-700">Patient Adoption</div>
                <div className="text-xs font-black text-slate-900">100% Native WhatsApp</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-[9px] font-bold uppercase text-purple-700">Clinical Workflow</div>
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
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs shadow-sm">02</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                    The Clinical &amp; Revenue Reality
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 02 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                The ₹5,000 Patient Wallet Inequality
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Every patient spends <strong>₹3,000 to ₹5,000</strong> across your Clinic, Diagnostic Tests, and Prescribed Medicines.
              </p>

              {/* Visual Wallet Bar Infographic */}
              <div className="my-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] font-bold text-slate-700 mb-1 flex justify-between">
                  <span>Where Patient's ₹5,000 Budget Goes Today:</span>
                  <span className="text-rose-600 font-black">Doctor Takes Only 10%</span>
                </div>
                <div className="w-full h-6 rounded-full overflow-hidden flex shadow-inner border border-slate-300">
                  <div className="h-full bg-rose-500 text-[10px] text-white font-bold flex items-center justify-center" style={{ width: '10%' }}>
                    10% Dr (₹500)
                  </div>
                  <div className="h-full bg-teal-500 text-[10px] text-white font-bold flex items-center justify-center" style={{ width: '56%' }}>
                    56% Chemist (₹2,800)
                  </div>
                  <div className="h-full bg-purple-500 text-[10px] text-white font-bold flex items-center justify-center" style={{ width: '34%' }}>
                    34% Lab (₹1,700)
                  </div>
                </div>
              </div>

              {/* Side-by-Side Cognitive vs Capture Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2">
                <div className="p-3 bg-teal-50/40 rounded-xl border-l-4 border-l-teal-600 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-teal-900 font-bold text-xs">
                    <Stethoscope className="w-3.5 h-3.5 text-teal-600" /> 100% Cognitive &amp; Clinical Work (You)
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-700">
                    <div>✔ <strong>Diagnose</strong> complex pathology, symptoms &amp; vitals.</div>
                    <div>✔ <strong>Interpret lab reports</strong> and abnormal biomarkers.</div>
                    <div>✔ <strong>Advise medication</strong>, active molecules &amp; dosage (1-0-1).</div>
                  </div>
                  <div className="p-1.5 bg-teal-100 rounded-lg text-[10px] font-bold text-teal-900">
                    👨‍⚕️ You shoulder 100% of the clinical liability.
                  </div>
                </div>

                <div className="p-3 bg-rose-50/40 rounded-xl border-l-4 border-l-rose-600 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                    <Coins className="w-3.5 h-3.5 text-rose-600" /> But Standalone Clinics Get Only 10%
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-700">
                    <div>⚠️ <strong>Clinic Revenue:</strong> Only ₹500 consultation fee.</div>
                    <div>⚠️ <strong>External Chemist &amp; Lab:</strong> Capture 90% of value.</div>
                    <div>⚠️ <strong>Corporate Contrast:</strong> Apollo/Max capture <strong>70%</strong> in-house.</div>
                  </div>
                  <div className="p-1.5 bg-rose-100 rounded-lg text-[10px] font-bold text-rose-900">
                    💡 VitalSync brings the corporate loop to your clinic.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200 mt-2">
              <span className="text-slate-700 font-medium">VitalSync connects your clinic to local pharmacies &amp; labs.</span>
              <span className="text-teal-700 font-bold">The Revenue Leap →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 03: THE REVENUE LEAP — BEFORE VS AFTER
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 3) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm">03</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    The Practice Economics
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 03 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Revenue Comparison: Today vs. With VitalSync
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                From a single episodic consultation fee to a continuous clinical revenue stream.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {/* Status Quo Card */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-rose-700">Your Clinic Right Now</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">Status Quo</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between pb-1 border-b border-slate-200">
                      <span>OPD Patient Consultation Fee</span>
                      <span className="font-mono font-bold text-slate-900">₹500.00</span>
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
                  <div className="p-2 bg-white rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                    <span className="text-xs font-bold text-slate-700">Net Income / Patient:</span>
                    <span className="text-base font-black text-slate-900 font-mono">₹500.00</span>
                  </div>
                </div>

                {/* VitalSync Loop Card */}
                <div className="p-3.5 bg-gradient-to-br from-teal-50/70 to-emerald-50/70 rounded-xl border border-teal-300 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-teal-900 font-black">With VitalSync Loop</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold">3.8x Leap</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between pb-1 border-b border-teal-200">
                      <span className="text-slate-800 font-bold">OPD Consultation Fee</span>
                      <span className="font-mono font-bold text-slate-900">₹500.00</span>
                    </div>
                    <div className="flex justify-between pb-1 border-b border-teal-200 text-slate-700">
                      <span>🔬 Lab Interpretation Split (35%)</span>
                      <span className="font-mono font-bold text-teal-700">+₹350 – ₹600</span>
                    </div>
                    <div className="flex justify-between pb-1 border-b border-teal-200 text-slate-700">
                      <span>💊 Medication Advisory Split (25%)</span>
                      <span className="font-mono font-bold text-teal-700">+₹250 – ₹500</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>📦 Chronic Refill Equity (Day 25)</span>
                      <span className="font-mono font-bold text-emerald-700">+₹150 – ₹300</span>
                    </div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-teal-300 flex justify-between items-center shadow-sm">
                    <span className="text-xs font-bold text-teal-900">Net Income / Patient:</span>
                    <span className="text-lg font-black text-teal-700 font-mono">₹1,250 – ₹1,900+</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200 mt-2">
              <span className="text-slate-700 font-medium">Doctors earn 2.5x to 3.8x higher practice revenue per patient.</span>
              <span className="text-teal-700 font-bold">Problem 2: Patient Retention →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 04: PROBLEM 2 — PATIENT RETENTION & FOLLOW-UP BOTTLENECK
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 4) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-sm">04</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    The Clinical Retention Challenge
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 04 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Problem #2: Patient Records &amp; 65% Follow-Up Drop-Off
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                4 critical operational bottlenecks that leak patient loyalty and damage long-term recovery.
              </p>

              {/* 4-Box Infographic Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3">
                <div className="p-3 bg-gradient-to-br from-amber-50/60 to-white rounded-xl border-l-4 border-l-amber-500 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <FileText className="w-3.5 h-3.5 text-amber-600" /> 1. Lost Paper Prescriptions
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Patients lose paper slips. Doctors are forced to re-examine without past clinical baselines or drug reaction history.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-br from-amber-50/60 to-white rounded-xl border-l-4 border-l-amber-500 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <Activity className="w-3.5 h-3.5 text-amber-600" /> 2. Inaccessible History in OPD
                  </div>
                  <p className="text-[11px] text-slate-600">
                    In a fast-paced OPD with 40 patients, finding past lab test values, BP trends, or allergy notes on paper takes minutes.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-br from-amber-50/60 to-white rounded-xl border-l-4 border-l-amber-500 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <Users className="w-3.5 h-3.5 text-amber-600" /> 3. 65% Follow-Up Attrition
                  </div>
                  <p className="text-[11px] text-slate-600">
                    The moment acute pain subsides, patients forget their Day-15 follow-up. Clinics have no automated channel to bring them back.
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-br from-amber-50/60 to-white rounded-xl border-l-4 border-l-amber-500 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <HeartPulse className="w-3.5 h-3.5 text-amber-600" /> 4. Chronic Patient Leakage
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Diabetic &amp; hypertensive patients take medicines for months without checkups, skip quarterly HbA1c tests, and drift away.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200 mt-2">
              <span className="text-slate-700 font-medium">VitalSync automates complete patient records and follow-ups on WhatsApp.</span>
              <span className="text-teal-700 font-bold">The WhatsApp Solution →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 05: THE 24/7 WHATSAPP CARE & EMR SOLUTION
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 5) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">05</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    The VitalSync Technology Suite
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 05 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                1-Click EMR &amp; 24/7 WhatsApp Clinic Chatbot
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Digital records on your Doctor Dashboard + Automated WhatsApp Bot in your patient's phone.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {/* Doctor EMR Card */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-teal-800 font-bold text-xs uppercase">
                    <Stethoscope className="w-3.5 h-3.5 text-teal-600" /> 1. Doctor EMR Dashboard
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-700">
                    <div className="p-1.5 bg-white rounded-lg border border-slate-200 flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-teal-600 shrink-0" />
                      <span><strong>1-Click History:</strong> Press <code className="bg-slate-100 px-1 rounded text-teal-700 font-mono">Ctrl + K</code> for past vitals &amp; lab tests.</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-lg border border-slate-200 flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-teal-600 shrink-0" />
                      <span><strong>AI Voice Scribe:</strong> Speak Hindi or English notes; auto-generates digital Rx.</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-lg border border-slate-200 flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-teal-600 shrink-0" />
                      <span><strong>Specialty Sheets:</strong> Eye Refraction (RE/LE), Cardiology ECG, Pediatrics.</span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Chat Simulation Frame */}
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs uppercase">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> 2. WhatsApp Patient Chatbot
                    </div>
                    <span className="text-[9px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                      Online 24/7
                    </span>
                  </div>

                  <div className="bg-white rounded-lg p-2 border border-emerald-200 shadow-sm space-y-1 text-[10px]">
                    <div className="bg-slate-100 rounded-md p-1.5 text-slate-800">
                      💬 <em>"Namaste Sharma ji! Doctor Sahab ne aapka prescription aur report bhej diya hai."</em>
                    </div>
                    <div className="flex gap-1">
                      <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded text-[9px]">
                        📦 1-Click Refill (10% OFF)
                      </span>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-bold rounded text-[9px]">
                        📄 Download PDF
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200 mt-2">
              <span className="text-slate-700 font-medium">Zero app downloads. 100% of communication happens on native WhatsApp.</span>
              <span className="text-teal-700 font-bold">Chronic Care Loop →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 06: CHRONIC PATIENT CARE FLYWHEEL
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 6) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">06</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    Lifelong Care Loop
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 06 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                The Chronic Patient Care Flywheel
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Chronic patients (Diabetes, Hypertension, Thyroid, Heart) need 10–20+ years of active monitoring.
              </p>

              {/* 4-Stage Flywheel Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3">
                <div className="p-2.5 bg-gradient-to-b from-teal-50 to-white rounded-xl border border-teal-200 text-center space-y-0.5">
                  <div className="w-6 h-6 rounded-md bg-teal-600 text-white mx-auto flex items-center justify-center font-bold text-xs">1</div>
                  <div className="text-[11px] font-bold text-slate-900">Dose Alerts</div>
                  <p className="text-[10px] text-slate-600">Daily morning &amp; evening reminders (1-0-1) on WhatsApp.</p>
                </div>

                <div className="p-2.5 bg-gradient-to-b from-indigo-50 to-white rounded-xl border border-indigo-200 text-center space-y-0.5">
                  <div className="w-6 h-6 rounded-md bg-indigo-600 text-white mx-auto flex items-center justify-center font-bold text-xs">2</div>
                  <div className="text-[11px] font-bold text-slate-900">Day-25 Refills</div>
                  <p className="text-[10px] text-slate-600">1-Tap 10% discounted medicine refills delivered home.</p>
                </div>

                <div className="p-2.5 bg-gradient-to-b from-purple-50 to-white rounded-xl border border-purple-200 text-center space-y-0.5">
                  <div className="w-6 h-6 rounded-md bg-purple-600 text-white mx-auto flex items-center justify-center font-bold text-xs">3</div>
                  <div className="text-[11px] font-bold text-slate-900">90-Day Tests</div>
                  <p className="text-[10px] text-slate-600">Quarterly home blood collection for HbA1c, Lipid panels.</p>
                </div>

                <div className="p-2.5 bg-gradient-to-b from-emerald-50 to-white rounded-xl border border-emerald-200 text-center space-y-0.5">
                  <div className="w-6 h-6 rounded-md bg-emerald-600 text-white mx-auto flex items-center justify-center font-bold text-xs">4</div>
                  <div className="text-[11px] font-bold text-slate-900">Paid Consults</div>
                  <p className="text-[10px] text-slate-600">Continuous in-person or video follow-up fees to doctor.</p>
                </div>
              </div>

              <div className="p-2 bg-teal-50 rounded-xl mt-2.5 border border-teal-200 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="text-[10px] text-teal-900 font-medium">
                  <strong>Refill Defaulter Safety Net:</strong> If a chronic patient misses their refill by &gt;7 days, your EMR alerts you with a 1-Tap outreach button.
                </span>
              </div>
            </div>

            <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200 mt-2">
              <span className="text-slate-700 font-medium">Turn one-time walk-ins into continuous 10-year recurring patient relationships.</span>
              <span className="text-teal-700 font-bold">The VIP Member Benefits →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 07: THE 6 VIP MEMBER BENEFITS (THE PATIENT MAGNET)
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 7) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">07</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    The Patient Magnet
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 07 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Why Patients Choose Your Connected Loop
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                When patients purchase from your partnered pharmacy &amp; lab, their WhatsApp unlocks <strong>6 VIP Benefits</strong>:
              </p>

              {/* 6 VIP Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-200 space-y-0.5">
                  <div className="text-sm">📄</div>
                  <div className="text-[11px] font-bold text-slate-900">1. Instant PDF Lab Reports</div>
                  <p className="text-[10px] text-slate-600">Delivered immediately on WhatsApp. <strong>Zero lab revisiting</strong>.</p>
                </div>

                <div className="p-2.5 bg-purple-50/70 rounded-xl border border-purple-200 space-y-0.5">
                  <div className="text-sm">🗣️</div>
                  <div className="text-[11px] font-bold text-slate-900">2. Hinglish AI Voice Analysis</div>
                  <p className="text-[10px] text-slate-600">Audio/text explanations of high/low biomarkers in simple Hindi.</p>
                </div>

                <div className="p-2.5 bg-teal-50/70 rounded-xl border border-teal-200 space-y-0.5">
                  <div className="text-sm">💊</div>
                  <div className="text-[11px] font-bold text-slate-900">3. Daily Dosage Reminders</div>
                  <p className="text-[10px] text-slate-600">Morning &amp; evening (1-0-1) dose alerts so medicines are never skipped.</p>
                </div>

                <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-0.5">
                  <div className="text-sm">🎁</div>
                  <div className="text-[11px] font-bold text-slate-900">4. 1 Free Virtual Consult</div>
                  <p className="text-[10px] text-slate-600">Valid for 15–20 days. Patients clarify symptoms without paying twice.</p>
                </div>

                <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-0.5">
                  <div className="text-sm">🏷️</div>
                  <div className="text-[11px] font-bold text-slate-900">5. 10% OFF Chronic Refills</div>
                  <p className="text-[10px] text-slate-600">Structured 10% loyalty discount on recurring 30-day medicine orders.</p>
                </div>

                <div className="p-2.5 bg-rose-50/70 rounded-xl border border-rose-200 space-y-0.5">
                  <div className="text-sm">📊</div>
                  <div className="text-[11px] font-bold text-slate-900">6. Longitudinal Health Charts</div>
                  <p className="text-[10px] text-slate-600">WhatsApp automatically charts blood pressure and sugar trends over time.</p>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200 mt-2">
              <span className="text-slate-700 font-medium">Patients naturally choose your network pharmacy and lab for these VIP benefits.</span>
              <span className="text-teal-700 font-bold">Dynamic SOP Splits →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 08: DOCTOR-CONTROLLED DYNAMIC SPLITS & FEE PROTECTION
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 8) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-sm">08</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                    Governance &amp; Fee Protection
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 08 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Doctor-Controlled Dynamic Splits &amp; Fee Protection
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                You maintain 100% autonomy over your network economics. Set custom splits with 1 tap.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-teal-600" /> Dynamic Practice Parameters
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-800">💊 Pharmacy Medication Split</span>
                      <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">20% – 30%</span>
                    </div>
                    <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-800">🔬 Pathology Diagnostic Split</span>
                      <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">30% – 40%</span>
                    </div>
                    <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-800">🚨 Emergency SOS Priority Fee</span>
                      <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">₹618.00</span>
                    </div>
                    <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-800">🏷️ Chronic Refill Loyalty Discount</span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">10% OFF</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Rule 58 / 103: Fee Protection
                  </div>
                  <p className="text-[10px] text-slate-600">
                    100% of patient consultation fees booked at counter go directly to you with <strong>0% platform deduction</strong>.
                  </p>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-[10px] text-slate-700 space-y-0.5 font-medium">
                    <div className="text-emerald-700 font-bold">✔ 100% Doctor consultation fee protection.</div>
                    <div>✔ Counter cash stays 100% in your clinic drawer.</div>
                    <div>✔ ₹1,000 automated commission safety buffer &amp; direct bank settlements.</div>
                    <div>✔ Transparent 3% coordination fee only on digital clearing.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200 mt-2">
              <span className="text-slate-700 font-medium">You retain sovereign control over your clinic's commercial agreements.</span>
              <span className="text-teal-700 font-bold">The 2-Touchpoint Loop →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 09: THE 2-TOUCHPOINT CARE TIMELINE
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 9) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">09</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    Operational Workflow
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 09 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                The 2-Touchpoint WhatsApp Care Timeline
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Eliminating evening OPD crowding while keeping 100% of medicine and test volume in your network.
              </p>

              {/* Timeline Diagram */}
              <div className="space-y-2 mt-3">
                <div className="p-2.5 bg-slate-50 rounded-xl border-l-4 border-l-slate-900 border border-slate-200 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">1</div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Morning In-Person Consultation (OPD)</div>
                      <p className="text-[10px] text-slate-600">Compounder registers walk-ins, records vitals (BP, Sugar, SpO2, Temp), issues token (#TK-001).</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[9px] font-bold uppercase font-mono shrink-0">
                    OPD Token #TK-001
                  </span>
                </div>

                <div className="p-2.5 bg-teal-50/70 rounded-xl border-l-4 border-l-teal-600 border border-teal-200 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-md bg-teal-600 text-white flex items-center justify-center font-black text-xs shrink-0">2</div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Evening Diagnostic Report Review on WhatsApp</div>
                      <p className="text-[10px] text-slate-600">Lab approves reports ➔ WhatsApp delivers PDF with 2 interactive single-tap buttons:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="px-1.5 py-0.5 bg-white border border-teal-300 rounded text-teal-800 text-[9px] font-bold">
                          🏥 Physical Review (Pharmacy Hold)
                        </span>
                        <span className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-800 text-[9px] font-bold">
                          💻 Virtual Video Review (1-Click Delivery)
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[9px] font-bold uppercase font-mono shrink-0">
                    Sub-300ms Dispatch
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Bottom Value Badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center mt-2">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-700">
                🎁 1 Free Virtual Consult
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-700">
                🏷️ 10% Off Chronic Refills
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-700">
                📱 Daily WhatsApp Alerts
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-700">
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
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm">10</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Practice Revenue Forecast
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 10 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Interactive Practice Revenue Simulator
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Simulate your monthly clinic revenue growth based on your daily OPD patient volume.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="space-y-0.5">
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

                  <div className="space-y-0.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">Avg Medicine Bill / Patient:</span>
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

                  <div className="space-y-0.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">Avg Lab Bill / Patient:</span>
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

                <div className="p-3 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl border border-teal-300 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-teal-900">
                    Estimated Monthly Practice Financials (26 Days)
                  </div>

                  <div className="space-y-0.5 text-xs">
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

                  <div className="p-2 bg-white rounded-lg border border-teal-300 text-center space-y-0.5 shadow-sm">
                    <div className="text-[9px] font-bold uppercase text-teal-800">New Net Practice Income:</div>
                    <div className="text-xl font-black text-teal-700 font-mono tracking-tight">
                      +₹{Math.round(monthlyMetrics.totalNewIncome).toLocaleString('en-IN')} <span className="text-[11px] text-teal-600 font-sans font-medium">/ mo</span>
                    </div>
                    <div className="text-[8px] text-slate-500">Total Practice Gross: ₹{Math.round(monthlyMetrics.totalPracticeRevenue).toLocaleString('en-IN')} / month</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200 mt-2">
              <span className="text-slate-700 font-medium">Zero extra staff needed. 100% automated accounting and bank settlement.</span>
              <span className="text-teal-700 font-bold">Doctor FAQs →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 11: DOCTOR OBJECTION HANDLING & LEGAL COMPLIANCE
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 11) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">11</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    Legal &amp; Practical FAQs
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 11 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Addressing Doctor Questions &amp; Legal Compliance
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Clear, transparent answers to every clinical, operational, and commercial question.
              </p>

              <div className="space-y-1.5 mt-3">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Check className="w-3 h-3 text-teal-600 shrink-0" />
                    Q: "Is it legal and ethical for me to earn from lab/pharmacy splits?"
                  </div>
                  <p className="text-[10px] text-slate-600 pl-4">
                    <strong>Yes, 100%.</strong> You receive a legitimate <em>Clinical Report Interpretation &amp; Tele-Monitoring Advisory Fee</em> for reviewing diagnostic values and supervising chronic dosage adherence under your clinic's formal SOP agreement.
                  </p>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Check className="w-3 h-3 text-teal-600 shrink-0" />
                    Q: "My patients are elderly or rural; will they be able to use this?"
                  </div>
                  <p className="text-[10px] text-slate-600 pl-4">
                    <strong>Zero app downloads required.</strong> 100% of patient interactions happen on standard WhatsApp using single-tap native reply buttons and voice notes.
                  </p>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Check className="w-3 h-3 text-teal-600 shrink-0" />
                    Q: "Can I choose my own preferred chemist and pathology lab?"
                  </div>
                  <p className="text-[10px] text-slate-600 pl-4">
                    <strong>Yes, absolutely.</strong> You have 100% freedom to connect your existing trusted neighborhood chemist and diagnostic center via their phone numbers.
                  </p>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Check className="w-3 h-3 text-teal-600 shrink-0" />
                    Q: "How does counter cash collection work?"
                  </div>
                  <p className="text-[10px] text-slate-600 pl-4">
                    100% of physical cash collected at your counter stays in your clinic drawer. Platform reconciliation happens automatically via your pre-funded Commission Pool balance.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200 mt-2">
              <span className="text-slate-700 font-medium">Zero risk. 100% control. Transform your independent clinic today.</span>
              <span className="text-teal-700 font-bold">Get Started in 5 Minutes →</span>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SLIDE 12: 3-STEP GO-LIVE ROADMAP & EXECUTIVE CONTACT
           ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'continuous' || activeSlide === 12) && (
          <section className="print-slide bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">12</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    Rapid Deployment
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">SLIDE 12 / 12</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Launch Your Connected Practice in 3 Simple Steps
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Zero upfront SaaS subscription fees. Zero complex hardware. Practice onboarding in under 15 minutes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-center">
                  <div className="w-7 h-7 rounded-lg bg-teal-600 text-white mx-auto flex items-center justify-center font-black text-xs shadow-sm">1</div>
                  <div className="text-xs font-bold text-slate-900">Practice Setup &amp; Bank</div>
                  <p className="text-[10px] text-slate-600">Register clinic profile and link direct settlement bank account (Rule 58).</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-center">
                  <div className="w-7 h-7 rounded-lg bg-teal-600 text-white mx-auto flex items-center justify-center font-black text-xs shadow-sm">2</div>
                  <div className="text-xs font-bold text-slate-900">Connect Chemist &amp; Lab</div>
                  <p className="text-[10px] text-slate-600">Link trusted neighborhood pharmacy &amp; lab with custom SOP split parameters.</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-center">
                  <div className="w-7 h-7 rounded-lg bg-teal-600 text-white mx-auto flex items-center justify-center font-black text-xs shadow-sm">3</div>
                  <div className="text-xs font-bold text-slate-900">Front-Desk OPD Go-Live</div>
                  <p className="text-[10px] text-slate-600">Compounder issues tokens &amp; vitals; doctor consults with WhatsApp active.</p>
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

            <div className="p-2 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between text-xs text-slate-800 mt-2">
              <span className="font-bold text-teal-900">VitalSync: Virtual Hospital Network — "Your Clinic. Now a Hospital."</span>
              <span>Empowering Independent Physicians Across Tier 2 &amp; Tier 3 Healthcare Hubs</span>
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
