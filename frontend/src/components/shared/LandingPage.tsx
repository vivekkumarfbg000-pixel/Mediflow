import React, { useState, useEffect, useRef } from 'react';
import { BrandMark } from './BrandMark';
import { AppInstallBanner } from './AppInstallBanner';
import { FounderNotificationService } from '../../services/founderNotificationService';
import {
  Shield, Activity, Building2, Users, Layers, Zap, Clock, ChevronRight, Terminal, GitBranch, Lock, ArrowRight, Sparkles,
  X, FileText, Loader2, AlertCircle, Mail, Presentation, TrendingUp, Award, ChevronLeft, CheckCircle2, Eye, MessageSquare,
  Stethoscope, Pill, Printer, Smartphone, Send, Check, ChevronDown, HelpCircle, Database,
  HeartPulse, RefreshCw, Calendar, FileSpreadsheet, Package, PhoneCall, Bot, Flame, ShieldAlert, Star, Percent, ArrowUpRight, BarChart3, Microscope,
  Camera, Video, MapPin, UploadCloud, Menu
} from 'lucide-react';
// Hero image — ES-module import ensures Vite hashes & bundles correctly for production
import heroImageSrc from '../../assets/hero.png';
import background3DSrc from '../../assets/3d_background.png';
import backgroundLeftSrc from '../../assets/3d_background_left.png';

interface LandingPageProps {
  onAuthSuccess: (session: any, profile: any) => void;
}

// GPU-Accelerated Interactive 3D Plexus Canvas Background (Light Theme Optimized)
const InteractivePlexus3D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let isIntersecting = true;

    const particles: Array<{
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      radius: number;
      alpha: number;
    }> = [];

    const particleCount = Math.min(80, Math.floor((width * height) / 20000));

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 200 + 50, // simulated depth
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        vz: (Math.random() - 0.5) * 0.1,
        radius: Math.random() * 1.5 + 1.2,
        alpha: Math.random() * 0.4 + 0.4,
      });
    }

    const mouse = { x: -1000, y: -1000 };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const resize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);

    const render = () => {
      if (!isIntersecting) return;
      ctx.clearRect(0, 0, width, height);

      // Plexus background is transparent to let the CSS Parallax 3D background show through underneath

      // Render particle plexus
      particles.forEach((p, idx) => {
        // Move particle
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Boundary bounds
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        if (p.z < 50 || p.z > 250) p.vz *= -1;

        // Perspective projections
        const scale = 200 / p.z;
        const projX = (p.x - width / 2) * scale + width / 2;
        const projY = (p.y - height / 2) * scale + height / 2;
        const size = p.radius * scale;

        // Subtle interactive mouse repulsion
        if (mouse.x > 0) {
          const dx = mouse.x - projX;
          const dy = mouse.y - projY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            const force = (180 - dist) / 1800;
            p.x -= (dx / dist) * force * scale;
            p.y -= (dy / dist) * force * scale;
          }
        }

        // Draw particle node (Inverted colors: indigo/blue)
        ctx.beginPath();
        ctx.arc(projX, projY, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(79, 70, 229, ${p.alpha * (scale * 0.4)})`;
        ctx.fill();

        // Connect particles within proximity (Inverted line color: slate-300 / indigo-200)
        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const scale2 = 200 / p2.z;
          const projX2 = (p2.x - width / 2) * scale2 + width / 2;
          const projY2 = (p2.y - height / 2) * scale2 + height / 2;

          const dx = projX - projX2;
          const dy = projY - projY2;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(projX, projY);
            ctx.lineTo(projX2, projY2);
            ctx.strokeStyle = `rgba(148, 163, 184, ${(1 - dist / 100) * 0.25})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting;
        if (isIntersecting) {
          // ensure we don't start multiple loops
          cancelAnimationFrame(animationFrameId);
          render();
        }
      },
      { threshold: 0 }
    );
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block pointer-events-none z-0" />;
};

const getIsSingleDomain = (hostname: string): boolean => {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname.endsWith('.localhost')) return true;
  if (hostname === 'vitalsync.in' || hostname === 'www.vitalsync.in') return false;
  if (hostname.endsWith('.vitalsync.in')) return false;
  return true;
};

export const LandingPage: React.FC<LandingPageProps> = ({ onAuthSuccess }) => {
  // Satisfy ESLint prop-types and unused-vars checks
  useEffect(() => {
    if (onAuthSuccess) {
      console.log('Landing page initialized with auth handler:', typeof onAuthSuccess);
    }
  }, [onAuthSuccess]);

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [calcPatients, setCalcPatients] = useState(25);
  const [calcFee, setCalcFee] = useState(500);
  const [calcLabFee, setCalcLabFee] = useState(800);
  const [calcMedSale, setCalcMedSale] = useState(600);
  // 5-Step Clinic Operating Highway Active Step (0: Paper Rx, 1: Compounder Scan, 2: AI Profile, 3: WhatsApp Assistant, 4: Distant Patient Loop)
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);
  // Interactive Console Switcher Tab
  const [activeConsoleTab, setActiveConsoleTab] = useState<'doctor' | 'chronic' | 'pharmacy' | 'lab' | 'whatsapp'>('doctor');
  // 360° Chronic Patient Journey Timeline Step (0: Day 1, 1: Day 7, 2: Day 25, 3: Day 85, 4: Day 90)
  const [activeTimelineStep, setActiveTimelineStep] = useState(2);
  // Chronic Patient % in Practice Calculator
  const [calcChronicRatio, setCalcChronicRatio] = useState(45);
  // WhatsApp Patient Simulator State
  const [simStep, setSimStep] = useState<'refill_prompt' | 'refill_confirmed' | 'booking_prompt' | 'booking_confirmed' | 'report_prompt' | 'report_viewed'>('refill_prompt');
  const [isSimTyping, setIsSimTyping] = useState(false);

  // Figma/Canva-Style Interactive Canvas State
  const [figmaCanvasTab, setFigmaCanvasTab] = useState<'scan' | 'ai' | 'whatsapp'>('scan');
  // Advanced Clinic Ingestion Workstation: Camera Scan vs Rx Document Upload
  const [ingestionInputMode, setIngestionInputMode] = useState<'camera' | 'upload'>('camera');

  // Live Demo Booking Form States
  const [demoDoctorName, setDemoDoctorName] = useState('');
  const [demoClinicName, setDemoClinicName] = useState('');
  const [demoCity, setDemoCity] = useState('');
  const [demoPhone, setDemoPhone] = useState('');
  const [demoSpecialty, setDemoSpecialty] = useState('General Medicine');
  const [demoPatientsVolume, setDemoPatientsVolume] = useState('25-50 OPD / day');
  const [demoPreferredTime, setDemoPreferredTime] = useState('Today Evening');
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoSuccess, setDemoSuccess] = useState(false);

  const handleBookDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoError(null);

    const cleanPhone = demoPhone.trim().replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setDemoError('Please enter a valid 10-digit WhatsApp/mobile number.');
      return;
    }
    if (!demoDoctorName.trim()) {
      setDemoError('Please enter your Doctor / Contact Name.');
      return;
    }

    // Dispatch silent backend alert to Founder — no personal WA link exposed publicly
    FounderNotificationService.notifyOnDemoRequested({
      doctorName: demoDoctorName.trim(),
      clinicName: demoClinicName.trim() || undefined,
      phone: cleanPhone,
      specialty: demoSpecialty,
      patientsVolume: demoPatientsVolume,
      preferredTime: demoPreferredTime,
      city: demoCity.trim() || 'Patna, Bihar',
    }).catch(() => { /* non-blocking */ });

    // Show premium in-modal success confirmation
    setDemoSuccess(true);
  };

  const handleSimAction = (nextStep: 'refill_prompt' | 'refill_confirmed' | 'booking_prompt' | 'booking_confirmed' | 'report_prompt' | 'report_viewed') => {
    setIsSimTyping(true);
    setTimeout(() => {
      setIsSimTyping(false);
      setSimStep(nextStep);
    }, 400);
  };
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let ticking = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const pxX = e.clientX - rect.left;
            const pxY = e.clientY - rect.top;
            containerRef.current.style.setProperty('--mouse-x', `${pxX}px`);
            containerRef.current.style.setProperty('--mouse-y', `${pxY}px`);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);



  const handleContactSupport = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = 'mailto:contact@vitalsync.in';
  };

  // Redirect to app subdomain for sign-in (or inline console query param on local origins)
  const scrollToGate = (e: React.MouseEvent) => {
    e.preventDefault();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
    const isSingleDomain = getIsSingleDomain(hostname) || isLocal;

    if (isSingleDomain) {
      const url = new URL(window.location.href);
      url.searchParams.set('console', 'true');
      window.location.href = url.toString();
      return;
    }

    window.location.href = 'https://app.vitalsync.in';
  };

  const handleSignUpClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
    const isSingleDomain = getIsSingleDomain(hostname) || isLocal;

    if (isSingleDomain) {
      const url = new URL(window.location.href);
      url.searchParams.set('console', 'true');
      url.searchParams.set('tab', 'register');
      window.location.href = url.toString();
      return;
    }

    window.location.href = 'https://app.vitalsync.in?tab=register';
  };

  const handleGetStartedClick = (e: React.MouseEvent) => {
    handleSignUpClick(e);
  };

  return (
    <div ref={containerRef} className="min-h-screen text-slate-800 font-sans relative overflow-x-hidden select-none bg-slate-50">
      
      {/* 3D Parallax Background Layer */}
      <div 
        className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden transition-all duration-300"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 40%, #ffffff 0%, #f8fafc 60%, #f1f5f9 100%)`
        }}
      >
        {/* Cursor-following ambient spotlight glow */}
        <div 
          className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
          style={{
            background: `radial-gradient(circle 450px at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(99, 102, 241, 0.05) 0%, rgba(6, 182, 212, 0.02) 50%, transparent 100%)`
          }}
        />

        {/* Glow elements */}
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-cyan-500/5 rounded-full filter blur-3xl pointer-events-none" />

        {/* Clean luminous ambient spotlight gradients */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-teal-500/5 rounded-full filter blur-[100px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full filter blur-[100px] pointer-events-none" />
      </div>

      {/* 3D Plexus interactive network loop background */}
      <InteractivePlexus3D />

      {/* Premium Fixed Glass Header — stays pinned on all scroll depths */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xs transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand — Circular VitalSync Branding Widget */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200/60 shadow-sm">
              <BrandMark size={34} title="VitalSync logo" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-black tracking-tight font-sans">
                <span className="text-[#1A7B8F]">Vital</span>
                <span className="text-[#7AC47F]">Sync</span>
              </span>
              <span className="text-[8.5px] text-teal-700 font-bold tracking-wider uppercase mt-0.5">Virtual Hospital Network</span>
            </div>
          </div>

          {/* Desktop Navigation Links — Linear / Stripe Style */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <a href="#how-it-works" className="hover:text-teal-700 transition-colors font-bold text-teal-800">How It Works</a>
            <a href="#triad-architecture" className="hover:text-teal-700 transition-colors">Why VitalSync</a>
            <a href="#optional-emr" className="hover:text-teal-700 transition-colors flex items-center gap-1">
              Cloud EMR
              <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-bold">Optional</span>
            </a>
            <a href="#emr-comparison" className="hover:text-teal-700 transition-colors flex items-center gap-1">
              vs Practo Ray
              <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">New</span>
            </a>
            <a href="#chronic-care" className="hover:text-teal-700 transition-colors">Chronic Care</a>
            <a href="#pricing" className="hover:text-teal-700 transition-colors">Pricing</a>
          </nav>

          {/* Header Action Suite */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700 tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              NMC Ethics Protected
            </div>

            <button
              onClick={scrollToGate}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
            >
              Sign In
            </button>

            {/* Mobile: Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-slate-700"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/98 backdrop-blur-xl px-6 py-4 flex flex-col gap-4 shadow-lg">
            <nav className="flex flex-col gap-1">
              {[
                { href: '#how-it-works', label: 'How It Works' },
                { href: '#triad-architecture', label: 'Why VitalSync' },
                { href: '#optional-emr', label: 'Cloud EMR (Optional)' },
                { href: '#emr-comparison', label: 'vs Practo Ray' },
                { href: '#chronic-care', label: 'Chronic Care Engine' },
                { href: '#pricing', label: 'Pricing' },
                { href: '#faq', label: 'FAQs' },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="py-2.5 px-3 rounded-xl text-sm font-semibold text-slate-700 hover:text-teal-700 hover:bg-teal-50 transition-all"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={(e) => { setIsMobileMenuOpen(false); scrollToGate(e); }}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>
        )}
      </header>


      {/* Style blocks for flows */}
      <style>{`
        @keyframes scanLaser {
          0% { top: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan-laser {
          animation: scanLaser 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
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
        @keyframes float-drift {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(1.5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float-drift {
          animation: float-drift 12s ease-in-out infinite;
        }
        @keyframes float-drift-slow {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(12px) rotate(-1.2deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float-drift-slow {
          animation: float-drift-slow 16s ease-in-out infinite;
        }
      `}</style>

      {/* Hero Section — pt-20 compensates for fixed header height */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Column: Information, Branding & CTAs */}
        <div className="lg:col-span-6 flex flex-col space-y-7 mt-4 text-left">
          
          {/* Linear-Style Announcement Pill */}
          <div className="inline-flex items-center gap-2.5 self-start py-1 px-3.5 rounded-full border border-slate-200/90 bg-white/95 shadow-xs backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] text-slate-700 font-semibold tracking-tight">
              The Smart Clinic OS · From Handwritten Paper to WhatsApp Automation
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider font-mono">
              90-Day Free Pilot
            </span>
          </div>

          {/* SaaS Headline & Subtitle */}
          <div className="space-y-6 animate-fade-in-up">
            <h1 className="text-3xl sm:text-4xl lg:text-[2.5rem] font-bold text-slate-900 dark:text-white leading-[1.2] tracking-tight">
              Turn Your Clinic Into a Virtual Hospital.<br />
              <span className="text-xl sm:text-2xl lg:text-[1.75rem] font-bold bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 bg-clip-text text-transparent mt-2 inline-block">
                Write on Paper Prescription Pad. VitalSync AI &amp; Your Clinic OS Automate the Rest.
              </span>
            </h1>

            {/* Attractive Premium Box for the Paragraph */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700 p-5 sm:p-6 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 inline-block max-w-3xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-teal-500 to-emerald-500"></div>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                Keep writing paper prescriptions as usual. Your compounder scans or uploads it; VitalSync AI builds the digital profile, delivers the e-Rx on WhatsApp, and automates clinic operations. Unites your practice, pharmacy, and lab on interconnected dashboards—while giving chronic patients 100–200 km away remote video care with their trusted doctor.
              </p>
            </div>

            {/* Visual Workflow Map with WhatsApp Connection */}
            <div className="flex flex-col items-center justify-center mt-6 space-y-1">
              {/* The Clinic Network (Grouped) */}
              <div className="flex flex-wrap items-center justify-center gap-2 p-2 bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/50 rounded-2xl shadow-sm">
                <span className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" /> Doctor EMR
                </span>
                <span className="text-slate-300 dark:text-slate-600 font-bold px-1">↔</span>
                <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5" /> Pharmacy
                </span>
                <span className="text-slate-300 dark:text-slate-600 font-bold px-1">↔</span>
                <span className="px-3 py-1.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Microscope className="w-3.5 h-3.5" /> Pathology
                </span>
              </div>
              
              {/* Vertical Connection Bridge */}
              <div className="flex flex-col items-center justify-center py-1">
                <div className="w-px h-5 bg-gradient-to-b from-slate-300 to-[#25D366] dark:from-slate-600 dark:to-[#25D366]"></div>
                <div className="w-2 h-2 rounded-full bg-[#25D366] -mt-1 shadow-[0_0_8px_rgba(37,211,102,0.6)]"></div>
              </div>

              {/* Patient Endpoint */}
              <span className="px-5 py-2.5 bg-[#25D366]/10 text-[#128C7E] dark:text-[#25D366] border border-[#25D366]/40 rounded-xl text-sm font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[#25D366]/10 relative overflow-hidden group hover:scale-105 transition-transform cursor-default">
                <div className="absolute inset-0 bg-[#25D366]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <MessageSquare className="w-4 h-4" /> Patient's WhatsApp
              </span>
            </div>
          </div>

          {/* 3-Pillar Glassmorphic Bento Cards — Clean & Modern */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
            <div className="p-3.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs hover:border-teal-400/70 hover:bg-white transition-all text-left">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600 border border-teal-100">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900">Instant Paper-to-AI</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug font-medium">
                Write on paper as usual. Compounder snaps a photo or uploads Rx; AI extracts drugs (`1-0-1`) and creates structured EMR automatically.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs hover:border-emerald-400/70 hover:bg-white transition-all text-left">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900">WhatsApp Assistant</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug font-medium">
                Zero patient apps. Auto-delivers e-Rx, issues OPD tokens, answers FAQs, and schedules follow-up reminders.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs hover:border-indigo-400/70 hover:bg-white transition-all text-left">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Video className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900">100–200km Care Loop</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug font-medium">
                Distant chronic patients consult via video and get 1-click home medicine delivery, keeping them loyal forever.
              </p>
            </div>
          </div>

          {/* Interactive CTAs & Trust Signals — Clean & Consolidated (One Primary Demo, One Secondary Sign In) */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowDemoModal(true)}
                className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center gap-2 group"
              >
                Book 1-on-1 Live Demo
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-medium pt-1">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 100% Direct Doctor Payout (0% OPD cut)
              </span>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Flat ₹999/mo after 90 days
              </span>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp Connected
              </span>
            </div>
          </div>

          {/* Doctor Protection Trust Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50/80 via-emerald-50/60 to-white border border-teal-200/80 shadow-xs flex items-center justify-between gap-4 max-w-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white rounded-xl shadow-xs border border-teal-100 text-teal-700 shrink-0">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Doctor Consultation Fee Immunity (100% Direct)</p>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  100% of patient consultation fees go directly to the Doctor's bank account or counter drawer with 0% platform deductions.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-md shrink-0 uppercase">
              0% OPD Fee
            </span>
          </div>
        </div>

        {/* Right Column: Premium Showcase Display & Interactive Triad Visual */}
        <div className="lg:col-span-6 flex flex-col space-y-6 relative mt-4">
          
          {/* Live Network Pulse Bar */}
          <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-3.5 rounded-2xl border border-teal-500/30 text-white shadow-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="font-bold text-emerald-300 text-[11px] uppercase tracking-wider font-mono">Live Triad Network</span>
            </div>
            <div className="flex items-center gap-4 text-[10.5px] font-mono text-slate-300">
              <span><strong className="text-white">1,482</strong> Chronic Cohorts</span>
              <span className="hidden sm:inline text-teal-400">·</span>
              <span className="hidden sm:inline"><strong className="text-emerald-400">98.4%</strong> Adherence</span>
              <span className="text-teal-400">·</span>
              <span><strong className="text-cyan-300">Day-25</strong> Refill Engine</span>
            </div>
          </div>

          {/* Canva/Figma-Style Advanced Clinic Ingestion Workstation Widget */}
          <div className="max-w-lg w-full rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-2xl overflow-hidden transition-all duration-500 hover:border-slate-750">
            {/* Figma/Canva Studio Header Bar */}
            <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
              {/* Left: Window Dots & Canvas Title */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-300 ml-1.5 hidden sm:inline">
                  VitalSync Studio · Paper-to-Cloud Workstation
                </span>
              </div>

              {/* Right: Interactive Mode Selector Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFigmaCanvasTab('scan')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    figmaCanvasTab === 'scan'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Camera className="h-3 w-3" /> Scan &amp; Profile
                </button>
                <button
                  type="button"
                  onClick={() => setFigmaCanvasTab('ai')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    figmaCanvasTab === 'ai'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bot className="h-3 w-3" /> AI Vision
                </button>
                <button
                  type="button"
                  onClick={() => setFigmaCanvasTab('whatsapp')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    figmaCanvasTab === 'whatsapp'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="h-3 w-3" /> WhatsApp
                </button>
              </div>
            </div>

            {/* Interactive Canvas Body */}
            <div className="p-4 relative min-h-[380px] flex flex-col justify-between">
              {figmaCanvasTab === 'scan' && (
                <div className="space-y-3 animate-fade-in text-left">
                  {/* Compounder Action Mode Selector (Camera Scan vs Rx Document Upload) */}
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIngestionInputMode('camera')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          ingestionInputMode === 'camera'
                            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Camera className="h-3 w-3" /> Scan Rx Pad
                      </button>
                      <button
                        type="button"
                        onClick={() => setIngestionInputMode('upload')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          ingestionInputMode === 'upload'
                            ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <UploadCloud className="h-3 w-3" /> Upload Rx Slip
                      </button>
                    </div>
                    <span className="text-[9.5px] font-mono font-semibold text-slate-400 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 hidden sm:inline">
                      {ingestionInputMode === 'camera' ? '● Compounder Camera Active' : '● Document Ingestion Active'}
                    </span>
                  </div>

                  {/* Doctor Handwritten Prescription Simulation Card */}
                  <div className="relative bg-amber-50/95 text-slate-900 p-3.5 rounded-2xl border border-amber-200/80 shadow-inner overflow-hidden font-sans">
                    {/* Laser Scan Animation Line */}
                    <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_14px_#10b981] animate-scan-laser pointer-events-none" />

                    {/* Prescription Letterhead */}
                    <div className="border-b border-amber-300/60 pb-1.5 mb-1.5 flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-black tracking-tight text-slate-900 font-serif">DR. A. K. SHARMA, MD</h4>
                        <p className="text-[9px] text-slate-600 font-mono">Reg #48921/NMC · Consultant Physician</p>
                      </div>
                      <div className="text-right text-[9px] font-mono text-slate-500">
                        <span>OPD #TK-104 · 18 Sep 2026</span>
                      </div>
                    </div>

                    {/* Patient Details on Paper */}
                    <div className="text-[9.5px] text-slate-700 pb-1.5 border-b border-amber-200/50 flex justify-between">
                      <span><strong>Pt:</strong> Rajesh Verma (54/M)</span>
                      <span><strong>BP:</strong> 148/92 mmHg</span>
                      <span><strong>Sugar:</strong> 178 mg/dL</span>
                    </div>

                    {/* Rx Drugs on Paper */}
                    <div className="pt-1.5 space-y-1 font-serif text-slate-800 text-[10.5px]">
                      <div className="flex items-center justify-between">
                        <span>1. Tab Telmisartan 40mg (1-0-0) x 30d</span>
                        <span className="text-[8.5px] font-mono text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded font-sans">✓ Detected</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>2. Tab Metformin 500mg SR (1-0-1) x 30d</span>
                        <span className="text-[8.5px] font-mono text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded font-sans">✓ Detected</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>3. Tab Atorvastatin 10mg (0-0-1) x 30d</span>
                        <span className="text-[8.5px] font-mono text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded font-sans">✓ Detected</span>
                      </div>
                    </div>
                  </div>

                  {/* Directly Below Scan: The Live Auto-Created Cloud Profile & Digital Prescription Card */}
                  <div className="bg-slate-900/95 border border-teal-500/40 p-3 rounded-2xl space-y-2.5 shadow-xl text-left">
                    {/* Header: Title & Cloud Saved Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                        <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider font-mono">
                          Auto-Created Cloud Profile
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold border border-emerald-500/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Saved to Clinic Cloud
                      </span>
                    </div>

                    {/* Patient Demographics & ID Grid */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">Rajesh Verma</span>
                          <span className="text-[10px] text-slate-400 font-mono">54 Y / Male</span>
                        </div>
                        <span className="font-mono text-cyan-300 font-bold text-[10.5px] bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                          ID: #VS-84920
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-slate-300 font-mono">
                        <span><strong>Vitals:</strong> BP 148/92 mmHg</span>
                        <span className="text-slate-600">·</span>
                        <span>Sugar 178 mg/dL</span>
                        <span className="text-slate-600">·</span>
                        <span>BMI 27.4</span>
                      </div>
                    </div>

                    {/* WhatsApp Mobile Number Resolution & Missing Number Fallback Alert */}
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-300 font-mono flex items-center gap-1">
                          📱 WhatsApp Phone: <strong className="text-white">+91 98765-43210</strong>
                        </span>
                        <span className="text-[8.5px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                          ✓ Verified Link
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[9px] text-amber-300/90 leading-tight">
                        <strong>Missing Number Safety:</strong> If phone number is not written on paper slip, compounder desk prompts for 10-digit WhatsApp number to auto-link cloud records.
                      </div>
                    </div>

                    {/* Auto-Extracted Chronic Disease Badges */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                        Auto-Extracted Chronic Cohort Badges:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[9px] font-mono font-bold text-rose-300 bg-rose-950/70 border border-rose-500/40 px-2 py-0.5 rounded-md">
                          🔴 Essential Hypertension (Stage 2)
                        </span>
                        <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded-md">
                          🟠 Type-2 Diabetes Mellitus
                        </span>
                        <span className="text-[9px] font-mono font-bold text-yellow-300 bg-yellow-950/70 border border-yellow-500/40 px-2 py-0.5 rounded-md">
                          🟡 Dyslipidemia (CAD Risk)
                        </span>
                      </div>
                    </div>

                    {/* Auto-Generated Structured Digital Prescription (e-Rx) */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                        Generated Digital Prescription (e-Rx):
                      </span>
                      <div className="grid grid-cols-3 gap-1.5 text-slate-200 font-mono text-[9px]">
                        <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                          <span className="text-emerald-400 font-bold block">Telmisartan 40</span>
                          <span className="text-slate-400">1-0-0 · 30 Days</span>
                        </div>
                        <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                          <span className="text-emerald-400 font-bold block">Metformin 500</span>
                          <span className="text-slate-400">1-0-1 · 30 Days</span>
                        </div>
                        <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                          <span className="text-emerald-400 font-bold block">Atorvastatin 10</span>
                          <span className="text-slate-400">0-0-1 · 30 Days</span>
                        </div>
                      </div>
                    </div>

                    {/* Realtime Routing Status Strip */}
                    <div className="pt-0.5 text-[8.5px] font-mono text-emerald-400 flex items-center justify-between border-t border-slate-800">
                      <span>✓ Queued to Pharmacy POS (10% Refill)</span>
                      <span>✓ Day-75 Lab Requisition Armed</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10.5px] text-slate-400">
                      Doctor writes freely on paper pad. Compounder scans or uploads at desk.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFigmaCanvasTab('ai')}
                      className="text-[10.5px] font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      Inspect AI Vision <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {figmaCanvasTab === 'ai' && (
                <div className="space-y-3 animate-fade-in text-left">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-teal-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" /> AI Vision Engine · 99.8% Clinical Accuracy
                    </span>
                    <span className="text-slate-400 font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                      Instant Optical Extraction
                    </span>
                  </div>

                  <div className="space-y-2">
                    {/* Auto-Structured Drugs */}
                    <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl space-y-1.5 text-[11px]">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                        Extracted Medications &amp; Dosage Structure
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-slate-200 font-mono text-[10px]">
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                          <span className="text-emerald-400 font-bold block">Telmisartan 40</span>
                          <span className="text-slate-400">1-0-0 · 30 Days</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                          <span className="text-emerald-400 font-bold block">Metformin 500</span>
                          <span className="text-slate-400">1-0-1 · 30 Days</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                          <span className="text-emerald-400 font-bold block">Atorvastatin 10</span>
                          <span className="text-slate-400">0-0-1 · 30 Days</span>
                        </div>
                      </div>
                    </div>

                    {/* Instant Connected Routing */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-teal-950/40 border border-teal-500/30 p-2.5 rounded-xl">
                        <span className="font-bold text-teal-300 block">🏥 Pharmacy Reserve</span>
                        <span className="text-slate-300 mt-0.5 block">Order #ORD-842 reserved at Clinic Counter</span>
                      </div>
                      <div className="bg-indigo-950/40 border border-indigo-500/30 p-2.5 rounded-xl">
                        <span className="font-bold text-indigo-300 block">🔬 Diagnostic Re-Test</span>
                        <span className="text-slate-300 mt-0.5 block">LOINC #4544-3 HbA1c set for Day-75</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-slate-400">
                      Creates ABHA-ready longitudinal chart with zero typing by doctor.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFigmaCanvasTab('whatsapp')}
                      className="text-[10.5px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      See Patient WhatsApp <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {figmaCanvasTab === 'whatsapp' && (
                <div className="space-y-3 animate-fade-in text-left">
                  {/* WhatsApp Verified Banner */}
                  <div className="bg-emerald-950/60 border border-emerald-500/30 p-2 rounded-xl flex items-center justify-between text-[10.5px]">
                    <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>VitalSync Smart Clinic · Official Verified</span>
                    </div>
                    <span className="text-[9.5px] font-mono text-emerald-400">Sub-250ms Delivery</span>
                  </div>

                  {/* WhatsApp Chat Bubble */}
                  <div className="bg-[#0b141a] p-3 rounded-2xl border border-slate-800 text-[11px] space-y-2">
                    <p className="text-slate-200 leading-snug">
                      Namaste Rajesh Ji! 🙏 Dr. Sharma has finalized your digital prescription and follow-up plan:
                    </p>
                    <div className="bg-[#1f2c34] p-2.5 rounded-xl border border-slate-700/60 space-y-1 text-slate-300 text-[10.5px]">
                      <div className="flex justify-between font-bold text-white">
                        <span>📋 Daily Medication Regimen</span>
                        <span className="text-emerald-400">30-Day Supply</span>
                      </div>
                      <p className="text-slate-400 text-[10px]">
                        • Morning: Telmisartan 40mg (1-0-0) after breakfast<br />
                        • Evening: Metformin 500mg SR (1-0-1) + Atorvastatin 10mg
                      </p>
                    </div>

                    {/* Interactive 1-Tap Buttons inside WhatsApp */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div className="bg-[#202c33] border border-slate-700 py-1.5 px-2 rounded-lg text-center font-bold text-emerald-400 text-[10px]">
                        📦 1-Click Refill (10% OFF)
                      </div>
                      <div className="bg-[#202c33] border border-slate-700 py-1.5 px-2 rounded-lg text-center font-bold text-cyan-400 text-[10px]">
                        📹 100-200km Video Consult
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-slate-400">
                      Zero app install. Works natively for patients aged 18 to 80 on WhatsApp.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFigmaCanvasTab('scan')}
                      className="text-[10.5px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      Replay Flow ↺
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Figma-Style Footer Status Strip */}
            <div className="bg-slate-900/60 border-t border-slate-800/80 px-4 py-2 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <span>Zero Change to Doctor Habits</span>
              </div>
              <span className="text-slate-500">Click tabs above to simulate</span>
            </div>
          </div>

          {/* Interactive Triad Care Loop Box */}
          <div className="max-w-lg bg-white border border-slate-200 rounded-3xl p-5 shadow-md relative overflow-hidden group hover:border-slate-350 transition-all duration-500 w-full text-left">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  Zero Patient Leakage Loop
                </span>
              </div>
              <span className="text-[9px] font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                100% Doctor Fee Protected
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {/* Node 1: Doctor Chamber */}
              <div className="p-3 rounded-2xl bg-teal-50/60 border border-teal-200/80 hover:bg-teal-50 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-teal-600 text-white mx-auto flex items-center justify-center shadow-sm mb-2">
                  <Activity className="h-4.5 w-4.5" />
                </div>
                <div className="text-[11px] font-black text-slate-800">Doctor Chamber</div>
                <div className="text-[9px] text-teal-800 font-bold mt-0.5">Clinical Brain</div>
                <div className="text-[8px] font-mono text-slate-500 mt-1">Paper or Cloud EMR</div>
              </div>

              {/* Node 2: Chemist */}
              <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 hover:bg-emerald-50 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-sm mb-2">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div className="text-[11px] font-black text-slate-800">Partner Chemist</div>
                <div className="text-[9px] text-emerald-800 font-bold mt-0.5">Day-25 Refills</div>
                <div className="text-[8px] font-mono text-slate-500 mt-1">10% VIP Discount</div>
              </div>

              {/* Node 3: Lab */}
              <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 hover:bg-indigo-50 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white mx-auto flex items-center justify-center shadow-sm mb-2">
                  <Layers className="h-4.5 w-4.5" />
                </div>
                <div className="text-[11px] font-black text-slate-800">Partner Lab</div>
                <div className="text-[9px] text-indigo-800 font-bold mt-0.5">90-Day Diagnostics</div>
                <div className="text-[8px] font-mono text-slate-500 mt-1">Instant WhatsApp PDF</div>
              </div>
            </div>

            {/* Micro-Callout */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <Check className="h-3 w-3 text-emerald-600" /> WhatsApp Direct Connect
              </span>
              <span className="font-mono text-teal-700 font-bold">90 Days Free • Then ₹999/mo</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 0.5: THE 5-STEP CLINIC OPERATING HIGHWAY ── */}
      <section id="how-it-works" className="scroll-mt-20 py-20 relative z-10 bg-gradient-to-b from-slate-50/50 via-white to-slate-50/70 border-t border-slate-200 text-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* Header */}
          <div className="mb-14 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-slate-900 border border-slate-700 text-slate-100 text-xs font-bold uppercase tracking-widest font-mono shadow-sm">
              <Zap className="h-3.5 w-3.5 text-teal-400" /> The Connected Clinic Operating System
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">
              The Virtual Hospital Automation Loop
            </h2>
            <p className="text-slate-600 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed font-normal">
              Doctors write on paper as usual. The compounder scans the prescription to instantly build a complete patient profile. From there, the Clinic OS automates the next booking, follow-ups, VIP scheduling, video consults, and fully integrates your financial dashboard with the pharmacy and lab.
            </p>
          </div>

          {/* Stepper Navigation Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {[
              { idx: 0, step: '01', title: 'Doctor Paper Consult', icon: FileText },
              { idx: 1, step: '02', title: 'Compounder Scan & Upload', icon: Camera },
              { idx: 2, step: '03', title: 'AI Profile & Chart', icon: Sparkles },
              { idx: 3, step: '04', title: 'WhatsApp Assistant', icon: MessageSquare },
              { idx: 4, step: '05', title: '100–200km Distant Care', icon: Video },
            ].map(({ idx, step, title, icon: StepIcon }) => (
              <button
                key={`workflow-step-${step}-${idx}`}
                type="button"
                onClick={() => setActiveWorkflowStep(idx)}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  activeWorkflowStep === idx
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10 font-extrabold'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  activeWorkflowStep === idx ? 'bg-teal-400 text-slate-950 font-black' : 'bg-slate-100 text-slate-500'
                }`}>
                  {step}
                </span>
                <StepIcon className="h-4 w-4" />
                <span>{title}</span>
              </button>
            ))}
          </div>

          {/* Active Step Showcase Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden text-left p-8 sm:p-10">
            {/* Step 1: Doctor Writes on Paper */}
            {activeWorkflowStep === 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fade-in">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                    Step 01 · Zero Habit Change for Doctors
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Write on Paper as Usual. Maintain 100% Patient Eye Contact.
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-normal">
                    You never have to sit in front of a laptop or type while your patient talks. Sit face-to-face, listen to symptoms, examine vitals, and write your diagnosis and medication instructions on your regular clinic prescription pad.
                  </p>
                  <div className="space-y-2.5 pt-2 text-xs text-slate-700 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>0 Screen Fatigue:</strong> No keyboard typing, no looking away from the patient's eyes.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>0 Workflow Disruption:</strong> Write in English, Hindi, or medical shorthand exactly as you always have.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Dual-Mode Flexibility:</strong> Prefer a screen? Toggle to full Cloud EMR anytime in 1 click.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-gradient-to-br from-amber-50/80 via-white to-slate-50 p-6 rounded-2xl border border-amber-200/70 shadow-sm relative">
                  <div className="flex items-center justify-between pb-3 border-b border-amber-200/60 mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-700" />
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Doctor Chamber Rx Pad</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      Physical Paper
                    </span>
                  </div>
                  <div className="space-y-3 font-serif text-slate-800 text-xs">
                    <div className="text-[11px] text-slate-500 font-sans flex justify-between">
                      <span>Pt: <strong>Ramesh Sharma (54M)</strong></span>
                      <span>BP: <strong>140/90</strong> · Sugar: <strong>180</strong></span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-amber-100/80 shadow-xs space-y-1.5 italic">
                      <p className="font-bold font-sans not-italic text-[10px] text-teal-800 uppercase">Rx (Handwritten by Doctor):</p>
                      <p>1. Tab. Glycomet-GP 2 — 1 tab BD before meals x 30 days</p>
                      <p>2. Tab. Telma 40mg — 1 tab OD morning x 30 days</p>
                      <p className="text-[11px] not-italic text-slate-500 font-sans pt-1">Adv: Fasting blood sugar after 7 days · Repeat HbA1c at 90 days</p>
                    </div>
                    <div className="flex justify-between items-center pt-2 text-[10px] font-sans text-slate-500">
                      <span>Sign: <em>Dr. Verma (MD Med)</em></span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">Ready for Desk Scan</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Compounder Scans & Uploads */}
            {activeWorkflowStep === 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fade-in">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                    Step 02 · Front Desk Speed (Optical AI Ingestion)
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Compounder Scans to Build Patient Profile.
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-normal">
                    When the patient steps out, they hand the paper slip to the front desk. Your compounder opens the VitalSync OS on any device and clicks "Scan Rx". Instantly, the AI digitizes the document and builds a comprehensive digital patient profile, triggering the automation loop.
                  </p>
                  <div className="space-y-2.5 pt-2 text-xs text-slate-700 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Works with Any Camera:</strong> Android phone, iPad, inexpensive webcam, or flatbed scanner.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Zero Manual Typing:</strong> Front desk staff never type lengthy drug names or dosages.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Instant Queue Turn:</strong> The original paper pad remains with the patient as a physical backup.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-slate-900 text-white p-6 rounded-2xl border border-cyan-500/30 shadow-xl relative overflow-hidden">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-cyan-400" />
                      <span className="font-bold uppercase tracking-wider font-mono text-[11px]">Compounder Camera Scanner</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                      ⚡ Optical AI Ingestion
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="relative border-2 border-dashed border-cyan-400/50 rounded-xl p-4 bg-slate-950/70 text-center">
                      <div className="inline-block p-3 rounded-full bg-cyan-500/20 text-cyan-300 mb-2 animate-pulse">
                        <UploadCloud className="h-6 w-6 mx-auto" />
                      </div>
                      <p className="text-xs font-mono text-slate-300">Prescription Frame Detected</p>
                      <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-2 py-1 rounded">
                        <Check className="h-3 w-3" /> Auto-Cropped · High Contrast Vision Ready
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Capture Mode: Auto-Focus</span>
                      <span className="text-cyan-300 font-bold">Uploading to Cloud...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: AI Builds Digital Patient Profile */}
            {activeWorkflowStep === 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fade-in">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                    Step 03 · AI Clinical Digitization
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    VitalSync AI Builds the Structured Patient Profile.
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-normal">
                    VitalSync's Medical AI engine reads the handwritten doctor prescription, extracts each medication with exact strength and dosage schedule (<code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-bold">1-0-1</code>), auto-assigns ICD-10 diagnostic codes, and computes total days-supply triggers for refill reminders.
                  </p>
                  <div className="space-y-2.5 pt-2 text-xs text-slate-700 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Drug Interaction Safety Check:</strong> Auto-flags any contraindications or dosage anomalies.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>ABDM / ABHA Longitudinal Record:</strong> Digital profile links directly to the patient's national health ID.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Days-Supply Supply Math:</strong> Computes that 60 tablets of BD dosage will run out exactly on Day 30.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-slate-50 p-6 rounded-2xl border border-indigo-200 shadow-sm space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-900 text-[11px] uppercase">AI Extracted Clinical Entity</span>
                    <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 px-2 py-0.5 rounded">Verified 🟢</span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>Glycomet-GP 2</span>
                        <span className="text-indigo-700">1-0-1 (BD)</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Metformin 500mg + Glimepiride 2mg · 30 Days (60 tabs)</div>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>Telma 40mg</span>
                        <span className="text-indigo-700">1-0-0 (OD)</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Telmisartan 40mg · 30 Days (30 tabs)</div>
                    </div>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-[10.5px] text-emerald-800 font-sans font-semibold">
                    ✓ ICD-10 Assigned: E11.9 (Type-2 Diabetes) &amp; I10 (Essential HTN)
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: WhatsApp Assistant Takes Over */}
            {activeWorkflowStep === 3 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fade-in">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                    Step 04 · Frictionless WhatsApp Assistant
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Automated Bookings, Follow-ups & VIP Access.
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-normal">
                    Before the patient leaves, their WhatsApp buzzes. The system automatically schedules their next booking, sends routine follow-ups, and offers VIP queue upgrades. All interactions sync in real-time with your interconnected virtual hospital (Lab & Pharmacy) and financial dashboard.
                  </p>
                  <div className="space-y-2.5 pt-2 text-xs text-slate-700 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Zero App Downloads:</strong> 100% of communication happens inside WhatsApp with 1-Tap native buttons.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Instant Digital Prescription:</strong> Never lose a paper slip again; always available on WhatsApp.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Automated Queue Tokens:</strong> Live turn updates ("Turn in 2 patients") prevent crowded waiting rooms.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-[#0b141a] text-white p-5 rounded-2xl border border-emerald-500/30 shadow-xl space-y-3 text-xs">
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
                      VS
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs flex items-center gap-1">
                        Verma Clinic Assistant
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <div className="text-[10px] text-emerald-400">Official WhatsApp Business</div>
                    </div>
                  </div>
                  <div className="bg-[#1f2c34] p-3.5 rounded-xl rounded-tl-none space-y-2 text-slate-200 text-xs">
                    <p>Namaste Ramesh Ji! 🙏 Dr. Verma ne aapka digital prescription issue kar diya hai.</p>
                    <div className="p-2 bg-[#111b21] rounded-lg border border-slate-700 text-[11px] space-y-1">
                      <div className="font-bold text-white">📋 Rx_Ramesh_Sharma_18Sep.pdf</div>
                      <div className="text-slate-400 text-[10px]">Glycomet-GP 2 (1-0-1) · Telma 40 (1-0-0)</div>
                    </div>
                    <p className="text-[10px] text-slate-300">📅 Agla checkup: 14 dino mein. Main aapko 1 din pehle reminder bhej doonga!</p>
                  </div>
                  <div className="flex gap-2 text-[10px]">
                    <div className="bg-[#202c33] text-emerald-400 border border-[#2a3942] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                      [ 📎 Download e-Rx PDF ]
                    </div>
                    <div className="bg-[#202c33] text-cyan-400 border border-[#2a3942] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                      [ 📦 Order Refill (10% OFF) ]
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Distant Patient Care & Virtual Hospital Loop */}
            {activeWorkflowStep === 4 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fade-in">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                    Step 05 · The Virtual Hospital Advantage
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Retain Distant Patients 100–200 km Away via Video &amp; Refills.
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-normal">
                    In India, thousands of chronic patients travel 100–200 km from villages and smaller towns for their first doctor consult. But they cannot travel 6 hours every month for a routine BP check or refill! VitalSync schedules automated <strong>WhatsApp Video Reviews</strong> and dispatches <strong>Day-25 Refills</strong> from your partner pharmacy to their home town, keeping them loyal to you forever.
                  </p>
                  <div className="space-y-2.5 pt-2 text-xs text-slate-700 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>1-Tap Video Review on WhatsApp:</strong> Zero apps. Patient taps a secure WhatsApp link for a remote follow-up with their doctor.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Automated Day-25 Pharmacy Refill:</strong> 10% VIP discount pack delivered to distant patients without them traveling.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Zero Patient Leakage:</strong> Protects your patients from turning to unlinked chemists or local quacks.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl border border-purple-500/30 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-purple-800/60 text-xs">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-purple-400" />
                      <span className="font-bold uppercase tracking-wider font-mono text-[11px]">Distant Patient Lifeline</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-900/80 px-2 py-0.5 rounded border border-purple-500/30">
                      140 km from Clinic
                    </span>
                  </div>
                  <div className="p-3.5 bg-white/10 rounded-xl border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp Video Consult
                      </span>
                      <span className="text-emerald-400 font-mono text-[10px] font-bold">Confirmed ✅</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Pt. Ramesh Sharma (Forbesganj, 140km away) connects with Dr. Verma from home. Zero travel fatigue.
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-emerald-300">
                      <span>Partner Chemist Refill Pack:</span>
                      <span>Dispatched 🚚</span>
                    </div>
                    <div className="text-[10.5px] text-slate-300 font-normal">
                      Glycomet-GP 2 + Telma 40 delivered via courier (10% VIP Discount).
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stepper Navigation Footer */}
          <div className="mt-8 flex items-center justify-between text-xs font-semibold text-slate-500">
            <button
              onClick={() => setActiveWorkflowStep(prev => Math.max(0, prev - 1))}
              disabled={activeWorkflowStep === 0}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <ChevronLeft className="h-4 w-4" /> Previous Step
            </button>
            <span className="font-mono text-xs font-bold text-slate-700">
              Step {activeWorkflowStep + 1} of 5
            </span>
            <button
              onClick={() => setActiveWorkflowStep(prev => Math.min(4, prev + 1))}
              disabled={activeWorkflowStep === 4}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-all"
            >
              Next Step <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Dedicated 100-200 km Distant Chronic Patient Spotlight Banner */}
          <div className="mt-12 p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 border border-teal-500/30 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-3">
                <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-mono text-[11px] font-bold uppercase tracking-widest">
                  <HeartPulse className="h-3.5 w-3.5" /> Stop Losing Distant Chronic Patients
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  The 100–200 km Patient Lifeline: Never Lose a Patient to Distance Again
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-normal">
                  In India's Tier 2 &amp; 3 cities, over 40% of patients travel from villages and smaller towns 100–200 km away to consult you. But traveling 6 hours every month for a routine BP or sugar review is impossible—so they lapse or buy from local quacks. VitalSync gives them scheduled <strong>WhatsApp Video Reviews</strong> and <strong>doorstep medicine refills</strong>, keeping them healthy and loyal to your clinic for life.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                    <span className="text-slate-400 block text-[10px]">THE PROBLEM</span>
                    <strong className="text-rose-400 text-xs">6-Hr Travel = 78% Dropout</strong>
                  </div>
                  <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                    <span className="text-slate-400 block text-[10px]">VITASYNC SOLUTION</span>
                    <strong className="text-emerald-400 text-xs">WhatsApp Video Follow-Up</strong>
                  </div>
                  <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                    <span className="text-slate-400 block text-[10px]">PRACTICE IMPACT</span>
                    <strong className="text-cyan-300 text-xs">100% Patient Retention</strong>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/15 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500 text-slate-950 flex items-center justify-center mx-auto shadow-md">
                  <Video className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">Start Virtual Follow-Ups</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Provide hospital-grade continuity of care for your most loyal chronic patients, no matter how far they live.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── SECTION 1: THE CONNECTED TRIAD ARCHITECTURE ── */}
      <section id="triad-architecture" className="scroll-mt-20 py-20 relative z-10 bg-white border-t border-slate-200 text-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-14 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold uppercase tracking-widest font-mono">
              <Building2 className="h-3.5 w-3.5 text-teal-600" /> Decentralized Virtual Hospital Network
            </div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">
              The Connected Triad Architecture
            </h2>
            <p className="text-slate-600 text-sm lg:text-base max-w-3xl mx-auto leading-relaxed font-medium">
              Why build an expensive multi-specialty hospital when the infrastructure already exists in your neighborhood? VitalSync unites independent doctors, local chemists, and pathology labs on WhatsApp.
            </p>
          </div>

          {/* 3D Decentralized Virtual Hospital Interconnection Loop Banner (Featuring Image 3) */}
          <div className="mb-14 rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 border border-teal-500/30 p-6 lg:p-8 text-white shadow-2xl overflow-hidden relative group">
            {/* Background ambient glow */}
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              {/* Left Column: Conceptual Clinical Value */}
              <div className="lg:col-span-6 space-y-4 text-left order-2 lg:order-1">
                <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-mono font-bold uppercase tracking-widest border border-teal-500/30">
                  <Sparkles className="h-3 w-3 text-teal-400" />
                  Sovereign Triad Architecture
                </div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                  Interconnected Dashboards for Clinic, Chemist &amp; Lab — Seamless WhatsApp for Patients
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-normal">
                  VitalSync unites your Doctor Chamber, Partner Chemist, and Pathology Lab with realtime synchronized cloud dashboards, while keeping patients engaged through zero-install WhatsApp care loops. Stop leaking up to 60% of medicine and diagnostic value to unlinked aggregators.
                </p>

                <div className="space-y-2.5 pt-2 text-xs font-medium">
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                    <span className="text-slate-200"><strong>Doctor &amp; Compounder Desk:</strong> Dual input (Paper Pad Optical AI or Cloud EMR) with 100% consultation fee direct to doctor.</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-slate-200"><strong>Chemist Pharmacy Counter:</strong> Interconnected POS dispensing queue + automated Day-25 1-click refill loop with 10% VIP savings.</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                    <span className="text-slate-200"><strong>Pathology Lab Station:</strong> Interconnected LIS sample barcoding &amp; requisition worklist + automated electronic test records.</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                    <span className="text-slate-200"><strong>Patient Experience (WhatsApp):</strong> Zero app install — instant digital prescriptions, live OPD queue alerts &amp; PDF lab reports on WhatsApp.</span>
                  </div>
                </div>
              </div>

              {/* Right Column: 3D Triad Glass Cards Graphic (heroImageSrc) */}
              <div className="lg:col-span-6 flex justify-center items-center order-1 lg:order-2">
                <div className="relative rounded-2xl overflow-hidden border border-teal-500/30 shadow-2xl bg-slate-950/60 p-2 sm:p-3 w-full group/img">
                  <img
                    src={heroImageSrc}
                    alt="VitalSync Connected Triad: Clinic, Pharmacy, and Pathology Lab Decentralized Virtual Hospital"
                    className="w-full h-auto max-h-[360px] object-contain rounded-xl transition-transform duration-700 group-hover/img:scale-[1.02] mx-auto"
                    loading="lazy"
                  />
                  <div className="mt-2 bg-slate-900/80 backdrop-blur-md border border-teal-500/30 px-3.5 py-2 rounded-xl flex items-center justify-between text-[10px] font-mono text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="font-bold text-teal-300">Interconnected Dashboards · WhatsApp for Patients</span>
                    </div>
                    <span className="text-slate-400 hidden sm:inline">Zero Leakage · 360° CDC Sync</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7 text-left">
            {/* Triad 1: Doctor Chamber */}
            <div className="p-7 rounded-3xl bg-white/70 backdrop-blur-md border border-white/80 shadow-sm hover:border-teal-300 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between relative group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md">
                    <Activity className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-teal-900 bg-teal-100 border border-teal-300 px-3 py-1 rounded-full uppercase tracking-wider">
                    The Clinical Brain
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Independent Doctor Chamber</h3>
                  <p className="text-xs text-slate-600 mt-1 font-medium">Preserves clinical sovereignty, autonomy, and doctor-patient trust.</p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-700 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Doctor Fee Immunity:</strong> 100% of patient consultation fees go directly to your account (0% platform cut).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Zero Screen Fatigue:</strong> Write on paper prescription pads (Optical AI Vision scan) or use Cloud EMR.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>NMC Anti-Kickback Safe-Harbor:</strong> Earn 10%–15% for Pharmacotherapy Review &amp; 30%–40% for Lab Clinical Correlation — 100% NMC Ethics compliant.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>90-Day Free Pilot · Then ₹999/mo:</strong> Full-access clinical pilot with 0% OPD commission and zero hardware cost.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-teal-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">OPD Consultation Fee:</span>
                  <span className="font-black text-teal-800 bg-teal-100 px-2 py-0.5 rounded">100% Direct → Doctor (0% Platform Cut)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Zero Commission · Professional Medical Review Honorarium
                </div>
              </div>
            </div>

            {/* Triad 2: Partner Chemist */}
            <div className="p-7 rounded-3xl bg-white/70 backdrop-blur-md border border-white/80 shadow-sm hover:border-emerald-300 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between relative group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full uppercase tracking-wider">
                    The Fulfillment Hub
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Partner Chemist &amp; POS</h3>
                  <p className="text-xs text-slate-600 mt-1 font-medium">Captures recurring prescription refills that previously walked away.</p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-700 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>FEFO Batch Tracking:</strong> Near-expiry alerts and batch trace (<code className="text-[10px] bg-slate-100 px-1 rounded">BATCH-2026-X1</code>).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Day-25 1-Tap Refill Engine:</strong> Automated WhatsApp nudges lock in monthly repeat orders.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>10% VIP Chronic Discount:</strong> Patients get 10% off refills, incentivizing 100% clinic loyalty.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>1-Click Home Delivery:</strong> Local delivery dispatch with automated billing &amp; instant ledger settlement.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Clinical MTM &amp; Drug Review:</span>
                  <span className="font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">10% – 15% Standard</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  NMC Safe-Harbor · Anti-Kickback Protected (Medication Therapy Management)
                </div>
              </div>
            </div>

            {/* Triad 3: Partner Pathology Lab */}
            <div className="p-7 rounded-3xl bg-white/70 backdrop-blur-md border border-white/80 shadow-sm hover:border-indigo-300 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between relative group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                    <Layers className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-indigo-900 bg-indigo-100 border border-indigo-300 px-3 py-1 rounded-full uppercase tracking-wider">
                    Precision Diagnostics
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Partner Pathology Lab LIS</h3>
                  <p className="text-xs text-slate-600 mt-1 font-medium">Standardizes clinical diagnostics with zero manual report handling.</p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-700 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>Direct LOINC Requisitions:</strong> Standardized test worklist (<code className="text-[10px] bg-slate-100 px-1 rounded">4544-3</code> HbA1c, <code className="text-[10px] bg-slate-100 px-1 rounded">2160-0</code> Creatinine).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>Barcode Specimen Verification:</strong> Track sample vials securely (<code className="text-[10px] bg-slate-100 px-1 rounded">BAR-XXXX</code>).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>Instant WhatsApp PDF Dispatch:</strong> Report delivers to patient phone the second lab verifies.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>90-Day Diagnostic Loops:</strong> Proactive Day-85 sample collection prompts for chronic cohorts.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-indigo-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Diagnostic Tele-Interpretation:</span>
                  <span className="font-black text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">30% – 40% Dynamic</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                  Tele-Reporting Honorarium · NMC Ethics Compliant
                </div>
              </div>
            </div>
          </div>

          {/* Central Triad Highway Invariant Banner */}
          <div className="mt-10 p-5 rounded-2xl bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-medium">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Zap className="h-4 w-4" />
              </span>
              <span>
                <strong>Unified Realtime Highway:</strong> Instant cloud synchronization connects Doctor EMR, Pharmacy POS, and Lab LIS at <strong>sub-250ms speed</strong> with zero manual copy-pasting.
              </span>
            </div>
            <span className="font-mono text-[11px] text-teal-400 whitespace-nowrap bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              100% Patient Retention · Zero Leakage
            </span>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: THE CHRONIC DISEASE CARE MODEL & RECURRING REFILL GOLDMINE ── */}
      <section id="chronic-care" className="scroll-mt-20 py-20 relative z-10 bg-slate-50/70 border-t border-slate-200 text-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-14 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-widest font-mono">
              <HeartPulse className="h-3.5 w-3.5 text-emerald-600" /> Multi-Chronic Disease Care Engine
            </div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">
              Turn One-Off OPD Visits Into 10-Year Recurring Care
            </h2>
            <p className="text-slate-600 text-sm lg:text-base max-w-3xl mx-auto leading-relaxed font-medium">
              Over 70% of outpatient consultations in India are chronic patients who forget doses, lapse on medicine refills, or drop out of care. VitalSync automates adherence, refills, and diagnostic follow-ups on WhatsApp.
            </p>
          </div>

          {/* 8 Chronic Disease Protocol Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            {[
              {
                condition: 'Type-2 Diabetes',
                code: 'ICD-10 E11',
                drugs: 'Metformin, Glimepiride, Sitagliptin',
                lab: 'HbA1c & Fasting Sugar (90-Day)',
                color: 'border-emerald-250 bg-emerald-50/60 text-emerald-900',
                icon: HeartPulse
              },
              {
                condition: 'Essential Hypertension',
                code: 'ICD-10 I10',
                drugs: 'Telmisartan, Amlodipine, Metoprolol',
                lab: 'Lipid Profile & Serum Electrolytes',
                color: 'border-teal-250 bg-teal-50/60 text-teal-900',
                icon: Activity
              },
              {
                condition: 'Hypothyroidism',
                code: 'ICD-10 E03.9',
                drugs: 'Levothyroxine (25/50/100 mcg)',
                lab: 'Free T3, Free T4, TSH Panel',
                color: 'border-cyan-250 bg-cyan-50/60 text-cyan-900',
                icon: Zap
              },
              {
                condition: 'CAD & Dyslipidemia',
                code: 'ICD-10 I25.1',
                drugs: 'Atorvastatin, Rosuvastatin, Aspirin',
                lab: 'Lipid Profile & ECG Re-check',
                color: 'border-indigo-250 bg-indigo-50/60 text-indigo-900',
                icon: Shield
              },
              {
                condition: 'Asthma & COPD',
                code: 'ICD-10 J44.9',
                drugs: 'Formoterol + Budesonide Inhaler',
                lab: 'Spirometry & Peak Expiratory Flow',
                color: 'border-purple-250 bg-purple-50/60 text-purple-900',
                icon: Pill
              },
              {
                condition: 'Osteoarthritis & RA',
                code: 'ICD-10 M19.9',
                drugs: 'Glucosamine, Calcium, Vit D3',
                lab: 'Serum Uric Acid & ESR / CRP',
                color: 'border-amber-250 bg-amber-50/60 text-amber-900',
                icon: Award
              },
              {
                condition: 'CKD Stage 1–3',
                code: 'ICD-10 N18.3',
                drugs: 'Torsemide, Sodium Bicarbonate',
                lab: 'Serum Creatinine & eGFR (60-Day)',
                color: 'border-rose-250 bg-rose-50/60 text-rose-900',
                icon: Microscope
              },
              {
                condition: 'Epilepsy / Neuro',
                code: 'ICD-10 G40',
                drugs: 'Levetiracetam, Valproate, Clobazam',
                lab: 'Serum Drug Levels & LFT Panels',
                color: 'border-blue-250 bg-blue-50/60 text-blue-900',
                icon: Clock
              }
            ].map((proto, idx) => {
              const IconComp = proto.icon;
              return (
                <div key={`chronic-proto-${idx}-${proto.code}`} className={`p-4 rounded-2xl border ${proto.color} hover:shadow-md transition-all text-left flex flex-col justify-between`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <IconComp className="h-4 w-4 text-slate-700" />
                      <span className="text-[9px] font-mono font-bold bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                        {proto.code}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-xs text-slate-900 leading-snug">{proto.condition}</h4>
                    <p className="text-[10px] text-slate-600 mt-1 font-medium leading-tight">Rx: {proto.drugs}</p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[9.5px] font-bold text-slate-700">
                    🔬 {proto.lab}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3 Engines of the Recurring Refill Goldmine */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Engine 1 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:border-teal-400 transition-all space-y-3">
              <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900">Automated Days-Supply Calculation</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Our AI parses dosage strings (<code className="text-[10px] bg-slate-100 px-1 rounded font-bold">1-0-1</code> = 2 tabs/day; 30 tabs = 15-day supply). Exactly 5 days before medicines run out, the system triggers the fulfillment cycle.
              </p>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-700">
                Formula: <span className="text-teal-700 font-bold">PackQty / DailyDose - 5 Days = RefillTrigger</span>
              </div>
            </div>

            {/* Engine 2 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:border-emerald-400 transition-all space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                <RefreshCw className="h-5 w-5" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900">Day-25 1-Tap WhatsApp Refills</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Autonomous morning cron workers send interactive WhatsApp messages with native single-tap reply buttons (<code className="text-[10px] bg-emerald-50 text-emerald-800 px-1 rounded font-bold">[ 📦 Confirm 1-Click Refill (10% OFF) ]</code>).
              </p>
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-250 font-sans text-[10px] text-emerald-900 font-semibold">
                ✓ 10% VIP Chronic Discount unlocks 98.4% patient retention.
              </div>
            </div>

            {/* Engine 3 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:border-indigo-400 transition-all space-y-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                <Microscope className="h-5 w-5" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900">90-Day Diagnostic Re-test Loops</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Proactively schedules Day-75/Day-85 WhatsApp Home Blood Sample Collection for repeat biomarker panels (HbA1c, Lipid Profile, TSH, Serum Creatinine) before quarterly doctor reviews.
              </p>
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-250 font-sans text-[10px] text-indigo-900 font-semibold">
                ✓ Continuous clinical monitoring + practice diagnostic revenue.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: THE 360° CHRONIC PATIENT JOURNEY (INTERACTIVE TIMELINE) ── */}
      <section id="patient-journey" className="scroll-mt-20 py-20 relative z-10 bg-white border-t border-slate-200 text-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold uppercase tracking-widest font-mono">
              <Calendar className="h-3.5 w-3.5 text-cyan-600" /> Longitudinal Care Flow
            </div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">
              The 360° Chronic Patient Journey
            </h2>
            <p className="text-slate-600 text-sm lg:text-base max-w-3xl mx-auto leading-relaxed font-medium">
              See what happens to a chronic diabetic patient across 90 days. Click each milestone below to inspect the automated clinical events.
            </p>
          </div>

          {/* Interactive Step Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            {[
              { step: 0, label: 'Day 1: OPD Consult', icon: Stethoscope },
              { step: 1, label: 'Day 7: Adherence Pulse', icon: MessageSquare },
              { step: 2, label: 'Day 25: 1-Tap Refill', icon: Package },
              { step: 3, label: 'Day 85: Lab Re-test', icon: Microscope },
              { step: 4, label: 'Day 90: Outcome Review', icon: Award },
            ].map(({ step, label, icon: StepIcon }) => (
              <button
                key={step}
                type="button"
                onClick={() => setActiveTimelineStep(step)}
                className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTimelineStep === step
                    ? 'bg-white text-teal-900 shadow-md border border-teal-300 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <StepIcon className={`h-4 w-4 ${activeTimelineStep === step ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Timeline Detail Card Display */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950 p-8 rounded-3xl text-white border border-teal-500/30 shadow-2xl text-left">
            {activeTimelineStep === 0 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-3 py-1 rounded-full uppercase">
                    Milestone 01 · Day 1
                  </span>
                  <span className="text-xs text-slate-400">Doctor Chamber Consultation</span>
                </div>
                <h3 className="text-2xl font-black text-white">Chamber Intake &amp; Compounder AI Scan</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  Ramesh Ji (Age 52, Type-2 Diabetes) visits Dr. Verma. Doctor writes on paper as usual. The compounder scans the slip at the front desk ➡️ Clinic OS instantly builds a digital patient profile and extracts the structured dosage (<code className="text-cyan-300 font-mono">Glycomet-GP2 1-0-1</code>).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-slate-400 block text-[10px]">1. CONSULTATION FEE</span>
                    <strong className="text-emerald-400 text-sm">₹500.00 (100% Doctor)</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-slate-400 block text-[10px]">2. CONNECTED PHARMACY</span>
                    <strong className="text-teal-300 text-sm">₹720 (30 Days Dispensed)</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-slate-400 block text-[10px]">3. PATIENT PRIVILEGE</span>
                    <strong className="text-cyan-300 text-sm">1 Free Follow-up Pass</strong>
                  </div>
                </div>
              </div>
            )}

            {activeTimelineStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 border border-cyan-500/40 px-3 py-1 rounded-full uppercase">
                    Milestone 02 · Day 7
                  </span>
                  <span className="text-xs text-slate-400">Autonomous WhatsApp Care Touchpoint</span>
                </div>
                <h3 className="text-2xl font-black text-white">Adherence Pulse &amp; Fasting Vitals Logging</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  VitalSync AI sends an automated morning WhatsApp checkup in friendly Hinglish: <em>"Namaste Ramesh Ji! Nayi dawa shuru kiye hue 7 din ho gaye hain. Sugar level kaisa hai?"</em> Ramesh replies with <strong>138 mg/dL</strong>, which logs directly to Dr. Verma's EMR chart.
                </p>
                <div className="p-4 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-xs text-cyan-200">
                  💡 <strong>Zero Doctor Effort:</strong> The AI agent manages communication, triaging alerts only if vitals breach doctor-configured safe thresholds (&gt;250 mg/dL or &lt;70 mg/dL).
                </div>
              </div>
            )}

            {activeTimelineStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-3 py-1 rounded-full uppercase">
                    Milestone 03 · Day 25
                  </span>
                  <span className="text-xs text-slate-400">The 1-Tap Refill Engine</span>
                </div>
                <h3 className="text-2xl font-black text-white">Day-25 WhatsApp 1-Tap Refill (10% VIP Discount)</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  Exactly 5 days before Glycomet-GP2 runs out, WhatsApp dispatches: <em>"Aapki Glycomet-GP2 dawa agle 5 dino mein khatam hone wali hai. Verma Clinic Pharmacy ne 1 Month Refill Pack (10% VIP Discount) ready rakha hai."</em> Ramesh taps <strong>[ 📦 Confirm 1-Click Refill ]</strong>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-slate-400 block text-[10px]">PATIENT PRICE (10% OFF)</span>
                    <strong className="text-emerald-400 text-sm">₹648.00 (vs MRP ₹720)</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-slate-400 block text-[10px]">FULFILLMENT DISPATCH</span>
                    <strong className="text-teal-300 text-sm">Chemist POS Queue Auto-Provisioned</strong>
                  </div>
                </div>
              </div>
            )}

            {activeTimelineStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950 border border-indigo-500/40 px-3 py-1 rounded-full uppercase">
                    Milestone 04 · Day 85
                  </span>
                  <span className="text-xs text-slate-400">Proactive Diagnostic Loop</span>
                </div>
                <h3 className="text-2xl font-black text-white">Automated Interconnected Virtual Lab Re-test</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  Before the quarterly checkup, the Clinic OS prompts a repeat HbA1c test. Your interconnected Partner Lab sends a phlebotomist. The report is automatically synced to the doctor's EMR and delivered to the patient via WhatsApp, fully integrating the virtual hospital loop.
                </p>
                <div className="p-4 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-xs text-indigo-200">
                  🔬 <strong>Closed-Loop Diagnostics:</strong> Dr. Verma's EMR receives the HbA1c result before Ramesh even arrives at the clinic chamber.
                </div>
              </div>
            )}

            {activeTimelineStep === 4 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950 border border-teal-500/40 px-3 py-1 rounded-full uppercase">
                    Milestone 05 · Day 90
                  </span>
                  <span className="text-xs text-slate-400">Quarterly Clinical Review</span>
                </div>
                <h3 className="text-2xl font-black text-white">VIP Booking, Outcomes &amp; Financial Dashboard</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  Ramesh books a VIP slot via WhatsApp for his 90-day consult. Dr. Verma reviews the clean HbA1c trajectory. Simultaneously, your centralized Financial Dashboard records the consultation and automated lab/pharmacy splits, capturing complete practice revenue.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-slate-400 block text-[10px]">HbA1c TRAJECTORY</span>
                    <strong className="text-emerald-400 text-sm">9.2% ➡️ 6.8% (Target Met)</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-slate-400 block text-[10px]">PATIENT RETENTION</span>
                    <strong className="text-cyan-300 text-sm">100% Loyal to Clinic</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-slate-400 block text-[10px]">PRACTICE RECURRING GMV</span>
                    <strong className="text-teal-300 text-sm">₹2,840 / Quarter Captured</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: INTERACTIVE SILICON VALLEY 5-CONSOLE SWITCHER & WHATSAPP SIMULATOR ── */}
      <section id="consoles-simulator" className="scroll-mt-20 py-20 relative z-10 bg-slate-50 border-t border-slate-200 text-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold uppercase tracking-widest font-mono">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Interactive Platform Tour
            </div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">
              5 Connected Consoles. One Realtime Highway.
            </h2>
            <p className="text-slate-600 text-sm lg:text-base max-w-3xl mx-auto leading-relaxed font-medium">
              Click between the 5 roles to see how data flows in real-time. Test our live WhatsApp simulator with clickable buttons on the right.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {[
              { id: 'doctor', label: '1. Doctor EMR Console', icon: Stethoscope },
              { id: 'chronic', label: '2. Chronic Care Cockpit', icon: HeartPulse },
              { id: 'pharmacy', label: '3. Pharmacy POS & Refills', icon: Building2 },
              { id: 'lab', label: '4. Pathology Lab LIS', icon: Layers },
              { id: 'whatsapp', label: '5. WhatsApp Phone Simulator 📱', icon: Smartphone, highlight: true },
            ].map(({ id, label, icon: TabIcon, highlight }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveConsoleTab(id as any)}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  activeConsoleTab === id
                    ? highlight
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 font-black'
                      : 'bg-slate-900 text-white shadow-md font-black'
                    : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <TabIcon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Display Container */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden text-left">
            {/* Console 1: Doctor EMR */}
            {activeConsoleTab === 'doctor' && (
              <div className="p-8 space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 uppercase">
                      Chamber Console · Active Patient: Ramesh Sharma (#TK-003)
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-1">Doctor EMR &amp; CDSS AI Scribe</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      100% Consultation Protected
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Patient Vitals (Auto-Synced)</span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 bg-white rounded-lg border border-slate-150">BP: <strong>138/86</strong></div>
                      <div className="p-2 bg-white rounded-lg border border-slate-150">Pulse: <strong>76 bpm</strong></div>
                      <div className="p-2 bg-white rounded-lg border border-slate-150">SpO2: <strong>98%</strong></div>
                      <div className="p-2 bg-white rounded-lg border border-slate-150">Sugar: <strong>142 mg/dL</strong></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Dual Consultation Input</span>
                    <div className="space-y-1.5 text-xs">
                      <div className="p-2 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 font-semibold">
                        ✍️ Option A: Paper Pad (Optical AI Vision scan)
                      </div>
                      <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 font-semibold">
                        💻 Option B: Cloud EMR Scribe + 1-Click Rx
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">SOP Practice Coordination</span>
                    <div className="text-xs font-mono space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Consult Fee:</span> <strong className="text-slate-900">₹500 (100% Doctor)</strong>
                      </div>
                      <div className="flex justify-between text-teal-700">
                        <span>Chemist Split (15%):</span> <strong>₹108.00</strong>
                      </div>
                      <div className="flex justify-between text-indigo-700">
                        <span>Lab Split (35%):</span> <strong>₹280.00</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Console 2: Chronic Care Cockpit */}
            {activeConsoleTab === 'chronic' && (
              <div className="p-8 space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                      Practice Cohort Intelligence · 1,482 Active Chronic Patients
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-1">Chronic Care Adherence Cockpit</h3>
                  </div>
                  <span className="text-xs font-mono text-cyan-700 font-bold bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200">
                    Day-25 Refill Engine Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-2xl font-black text-emerald-800 font-mono">98.4%</span>
                    <span className="text-[11px] font-bold text-slate-600 block mt-1">Cohort Adherence Rate</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200">
                    <span className="text-2xl font-black text-teal-800 font-mono">342</span>
                    <span className="text-[11px] font-bold text-slate-600 block mt-1">Day-25 Refills This Month</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
                    <span className="text-2xl font-black text-indigo-800 font-mono">186</span>
                    <span className="text-[11px] font-bold text-slate-600 block mt-1">90-Day Diagnostic Loops</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200">
                    <span className="text-2xl font-black text-slate-900 font-mono">₹2.84L</span>
                    <span className="text-[11px] font-bold text-slate-600 block mt-1">Refill GMV Generated</span>
                  </div>
                </div>
              </div>
            )}

            {/* Console 3: Pharmacy POS */}
            {activeConsoleTab === 'pharmacy' && (
              <div className="p-8 space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 uppercase">
                      Chemist Fulfillment Node · FEFO Batch Inventory
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-1">Pharmacy Counter POS &amp; Refill Delivery</h3>
                  </div>
                  <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    Auto-Dispense Ready
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono space-y-2">
                  <div className="flex justify-between font-bold text-slate-700 border-b border-slate-200 pb-2">
                    <span>Active Queue Item</span>
                    <span>Batch #</span>
                    <span>Quantity</span>
                    <span>Status</span>
                  </div>
                  <div className="flex justify-between items-center py-1 text-slate-800">
                    <span>Glycomet-GP2 (Metformin 500 + Glimepiride 2)</span>
                    <span className="text-slate-500">BATCH-2026-X1</span>
                    <span>60 Tablets</span>
                    <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">Packed for Delivery</span>
                  </div>
                  <div className="flex justify-between items-center py-1 text-slate-800">
                    <span>Telma-40 (Telmisartan 40mg)</span>
                    <span className="text-slate-500">BATCH-2026-A4</span>
                    <span>30 Tablets</span>
                    <span className="text-cyan-700 font-bold bg-cyan-100 px-2 py-0.5 rounded">1-Click Refill Cleared</span>
                  </div>
                </div>
              </div>
            )}

            {/* Console 4: Pathology Lab */}
            {activeConsoleTab === 'lab' && (
              <div className="p-8 space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 uppercase">
                      Diagnostic Node · LOINC Electronic Requisitions
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-1">Pathology Lab LIS &amp; WhatsApp PDF</h3>
                  </div>
                  <span className="text-xs font-mono text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    Barcode BAR-9082 Verified
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-700 block">LOINC Test Order: 4544-3 HbA1c</span>
                    <div className="text-slate-600">Sample: Whole Blood (EDTA Purple Top)</div>
                    <div className="text-emerald-700 font-bold">Result: 6.8% (Good Glycemic Control)</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2">
                    <span className="font-bold text-indigo-900 block">Instant WhatsApp PDF Delivery</span>
                    <div className="text-indigo-800">Directly dispatches PDF to patient + Hinglish AI summary the moment lab approves.</div>
                  </div>
                </div>
              </div>
            )}

            {/* Console 5: Live WhatsApp Phone Simulator */}
            {activeConsoleTab === 'whatsapp' && (
              <div className="p-6 md:p-8 space-y-6 animate-fade-in bg-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 uppercase">
                      Live Interactive Simulation
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-900 mt-1">Experience VitalSync from the Patient's Phone</h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-sans">
                    <span className="text-slate-500">Select Flow:</span>
                    <button
                      type="button"
                      onClick={() => setSimStep('refill_prompt')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                        simStep.startsWith('refill') ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      Refill
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimStep('booking_prompt')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                        simStep.startsWith('booking') ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      Booking
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimStep('report_prompt')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                        simStep.startsWith('report') ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      Lab PDF
                    </button>
                  </div>
                </div>

                {/* Smartphone Mockup */}
                <div className="max-w-md mx-auto rounded-[36px] bg-slate-900 p-3 shadow-2xl border-4 border-slate-800">
                  <div className="rounded-[28px] bg-[#EFEAE2] overflow-hidden flex flex-col h-[520px] relative text-left">
                    {/* WhatsApp Top Header Bar */}
                    <div className="bg-[#075E54] text-white p-3 flex items-center justify-between shadow-md z-10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center font-bold text-xs text-white">
                          VS
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs">VitalSync Virtual Hospital</span>
                            <CheckCircle2 className="h-3.5 w-3.5 text-cyan-300" />
                          </div>
                          <span className="text-[10px] text-teal-200 block leading-none">Verified Business · Always Active</span>
                        </div>
                      </div>
                      <PhoneCall className="h-4 w-4 text-teal-200" />
                    </div>

                    {/* Chat Bubble Thread Area */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
                      {/* Flow 1: Day-25 Refill Prompt */}
                      {simStep === 'refill_prompt' && (
                        <div className="space-y-2 animate-fade-in">
                          <div className="bg-white rounded-2xl rounded-tl-sm p-3.5 shadow-sm max-w-[90%] border border-slate-200 text-slate-800 space-y-2">
                            <p className="font-semibold">
                              Namaste Ramesh Ji! 🩺<br />
                              Aapki <strong>Glycomet-GP2</strong> dawa agle <strong>5 dino mein khatam</strong> hone wali hai.
                            </p>
                            <p className="text-[11px] text-slate-600">
                              Sugar control mein gap na aaye, isliye Verma Clinic Pharmacy ne aapka <strong>1 Month Refill Pack (10% VIP Discount)</strong> ready rakha hai:
                            </p>
                            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-mono">
                              • MRP: <span className="line-through text-slate-400">₹720.00</span><br />
                              • Your VIP Price: <strong className="text-emerald-800">₹648.00 (10% OFF)</strong><br />
                              • Free Clinic Counter Pickup or Home Delivery
                            </div>
                            <span className="text-[9px] text-slate-400 block text-right font-mono">09:15 AM · Read ✓✓</span>
                          </div>

                          {/* 1-Tap Action Reply Buttons */}
                          <div className="space-y-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSimAction('refill_confirmed')}
                              disabled={isSimTyping}
                              className="w-full py-2.5 px-3 rounded-xl bg-white border border-[#25D366] text-[#075E54] font-black text-xs hover:bg-emerald-50 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Package className="h-4 w-4 text-emerald-600" />
                              <span>[ 📦 Confirm 1-Click Refill (10% OFF) ]</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSimAction('refill_confirmed')}
                              disabled={isSimTyping}
                              className="w-full py-2 px-3 rounded-xl bg-white/90 border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                            >
                              [ 👨‍⚕️ Speak to Doctor ]
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Flow 1: Confirmed State */}
                      {simStep === 'refill_confirmed' && (
                        <div className="space-y-2 animate-fade-in">
                          <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm p-3 shadow-sm max-w-[85%] ml-auto text-slate-900 text-right">
                            <p className="font-bold text-xs">📦 Confirm 1-Click Refill (10% OFF)</p>
                            <span className="text-[9px] text-slate-500 font-mono">09:16 AM · Sent ✓✓</span>
                          </div>

                          <div className="bg-white rounded-2xl rounded-tl-sm p-3.5 shadow-sm max-w-[90%] border border-slate-200 text-slate-800 space-y-1.5">
                            <p className="font-bold text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> REFILL ORDER CONFIRMED!
                            </p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              Aapka 1 Month Refill Pack pack ho chuka hai. Chemist delivery boy aaj shaam 05:00 PM tak aapke address par deliver kar dega.
                            </p>
                            <div className="p-2 rounded-lg bg-slate-50 font-mono text-[10px] text-slate-700">
                              Order #ORD-7842 · Pay Cash or UPI on delivery (₹648.00).
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Flow 2: Booking Prompt */}
                      {simStep === 'booking_prompt' && (
                        <div className="space-y-2 animate-fade-in">
                          <div className="bg-white rounded-2xl rounded-tl-sm p-3.5 shadow-sm max-w-[90%] border border-slate-200 text-slate-800 space-y-2">
                            <p className="font-semibold">
                              Namaste! 🙏 Welcome to Verma Clinic.<br />
                              Dr. Verma ke liye checkup slot select karein:
                            </p>
                            <p className="text-[11px] text-slate-600">
                              • Doctor Consultation Fee: <strong>₹500.00</strong> (Direct UPI)<br />
                              • Instant Sequential OPD Token
                            </p>
                            <span className="text-[9px] text-slate-400 block text-right font-mono">10:00 AM · Read ✓✓</span>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSimAction('booking_confirmed')}
                              disabled={isSimTyping}
                              className="w-full py-2.5 px-3 rounded-xl bg-white border border-[#25D366] text-[#075E54] font-black text-xs hover:bg-emerald-50 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Check className="h-4 w-4 text-emerald-600" />
                              <span>[ 🏥 Book Physical Visit (Token) ]</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSimAction('booking_confirmed')}
                              disabled={isSimTyping}
                              className="w-full py-2 px-3 rounded-xl bg-white/90 border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                            >
                              [ 💻 Virtual Video Review ]
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Flow 2: Booking Confirmed */}
                      {simStep === 'booking_confirmed' && (
                        <div className="space-y-2 animate-fade-in">
                          <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm p-3 shadow-sm max-w-[85%] ml-auto text-slate-900 text-right">
                            <p className="font-bold text-xs">🏥 Book Physical Visit (Token)</p>
                            <span className="text-[9px] text-slate-500 font-mono">10:01 AM · Sent ✓✓</span>
                          </div>

                          <div className="bg-white rounded-2xl rounded-tl-sm p-3.5 shadow-sm max-w-[90%] border border-slate-200 text-slate-800 space-y-1.5">
                            <p className="font-bold text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> TOKEN ALLOCATED: #TK-003 🎫
                            </p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              Hi Ramesh! Dr. Verma ke dashboard par aapka checkup lock ho chuka hai:
                            </p>
                            <div className="p-2 rounded-lg bg-teal-50 border border-teal-200 font-mono text-[10.5px] text-teal-900">
                              • Token: <strong>#TK-003</strong><br />
                              • Ahead: 2 Patients (~18 mins wait)<br />
                              • Live Turn Alert: 2 patient pehle WhatsApp notification aayega!
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Flow 3: Report Prompt */}
                      {simStep === 'report_prompt' && (
                        <div className="space-y-2 animate-fade-in">
                          <div className="bg-white rounded-2xl rounded-tl-sm p-3.5 shadow-sm max-w-[90%] border border-slate-200 text-slate-800 space-y-2">
                            <p className="font-semibold text-indigo-900 flex items-center gap-1.5">
                              <Microscope className="h-4 w-4 text-indigo-600" /> Aapki Pathology Report Taiyar Hai!
                            </p>
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1 font-mono">
                              <div>• Patient: Ramesh Sharma</div>
                              <div>• Test: HbA1c Glycated Hemoglobin</div>
                              <div>• Result: <strong className="text-emerald-700">6.8%</strong> (Target Met)</div>
                              <div>• Status: Verified by Lab Director 🟢</div>
                            </div>
                            <span className="text-[9px] text-slate-400 block text-right font-mono">03:45 PM · Read ✓✓</span>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSimAction('report_viewed')}
                              disabled={isSimTyping}
                              className="w-full py-2.5 px-3 rounded-xl bg-white border border-indigo-400 text-indigo-900 font-black text-xs hover:bg-indigo-50 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <FileText className="h-4 w-4 text-indigo-600" />
                              <span>[ 📎 Download Full Lab Report PDF ]</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Flow 3: Report Viewed */}
                      {simStep === 'report_viewed' && (
                        <div className="space-y-2 animate-fade-in">
                          <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm p-3 shadow-sm max-w-[85%] ml-auto text-slate-900 text-right">
                            <p className="font-bold text-xs">📎 Download Full Lab Report PDF</p>
                            <span className="text-[9px] text-slate-500 font-mono">03:46 PM · Sent ✓✓</span>
                          </div>

                          <div className="bg-white rounded-2xl rounded-tl-sm p-3.5 shadow-sm max-w-[90%] border border-slate-200 text-slate-800 space-y-1.5">
                            <p className="font-bold text-slate-900">Dr. Verma se report review ke liye option chuniye:</p>
                            <div className="space-y-1 pt-1">
                              <button
                                type="button"
                                onClick={() => setSimStep('report_prompt')}
                                className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-left text-[11px] font-bold text-teal-900"
                              >
                                🏥 Physical Review at Clinic (Meds Reserved)
                              </button>
                              <button
                                type="button"
                                onClick={() => setSimStep('report_prompt')}
                                className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-left text-[11px] font-bold text-indigo-900"
                              >
                                💻 Virtual Video Review (1 Free Follow-up)
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Typing indicator */}
                      {isSimTyping && (
                        <div className="bg-white rounded-2xl rounded-tl-sm p-2.5 shadow-sm w-fit border border-slate-200 text-slate-400 text-xs flex items-center gap-1">
                          <span className="animate-bounce">●</span>
                          <span className="animate-bounce" style={{ animationDelay: '0.15s' }}>●</span>
                          <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>●</span>
                          <span className="text-[10px] text-slate-500 ml-1 font-mono">VitalSync AI is typing...</span>
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Bottom Chat Input Bar */}
                    <div className="bg-[#F0F2F5] p-2 flex items-center gap-2 border-t border-slate-200">
                      <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-xs text-slate-400 border border-slate-200 flex items-center justify-between">
                        <span>Tap button above to reply...</span>
                        <Send className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4 Premium Patient Member Benefits Section */}
      <section className="py-16 relative z-10 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white border-y border-emerald-700/40">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5" /> 4 Premium Member Perks for Clinic Patients
          </div>
          <h2 className="text-2xl md:text-4xl font-black tracking-tight">
            Why Patients Stay 100% Loyal to Your Virtual Hospital
          </h2>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl mx-auto leading-relaxed">
            Every time a patient fulfills medicines or lab tests through your clinic's connected network, they automatically unlock 4 hospital-grade member privileges.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left pt-4">
            <div className="p-6 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md space-y-2.5">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl w-fit font-black text-sm">
                🆓 FREE
              </div>
              <h3 className="font-bold text-sm text-white">1 Free Virtual Follow-up</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                Patients unlock 1 free telemedicine video/audio consult within 15–20 days of treatment for fast recovery checks.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md space-y-2.5">
              <div className="p-2.5 bg-teal-500/20 text-teal-300 rounded-xl w-fit font-black text-sm">
                🏷️ 10% OFF
              </div>
              <h3 className="font-bold text-sm text-white">10% Off Chronic Refills</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                Permanent 10% discount on monthly chronic prescriptions with free 1-click home delivery via partner chemist.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md space-y-2.5">
              <div className="p-2.5 bg-cyan-500/20 text-cyan-300 rounded-xl w-fit font-black text-sm">
                📱 WHATSAPP
              </div>
              <h3 className="font-bold text-sm text-white">Daily WhatsApp Dose Reminders</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                Automated morning and evening WhatsApp nudges plus an AI Longitudinal Health Summary tracking vitals over time.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md space-y-2.5">
              <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl w-fit font-black text-sm">
                📄 INSTANT PDF
              </div>
              <h3 className="font-bold text-sm text-white">Instant WhatsApp Lab Reports</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                Blood test results and pathology PDF reports sent directly to patient handsets the moment the lab approves them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Virtual Hospital Revenue Calculator Section */}
      <section className="py-20 relative z-10 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 font-mono text-[10px] font-extrabold uppercase tracking-widest">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              Practice Economics &amp; Refill Simulator
            </div>
            <h2 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight uppercase">
              Chronic Care &amp; Virtual Hospital Revenue Calculator
            </h2>
            <p className="text-slate-600 text-sm font-semibold max-w-2xl mx-auto">
              Simulate how much recurring care coordination value your clinic captures by turning one-off OPD visits into automated Day-25 refills and 90-day diagnostic loops.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Sliders */}
            <div className="lg:col-span-7 bg-slate-50 p-8 rounded-3xl border border-slate-200 space-y-6 text-left shadow-sm">
              {/* Slider 1: Daily Patients */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Daily OPD Patients:</span>
                  <span className="text-emerald-700 font-mono font-black text-sm">{calcPatients} Patients / Day</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="5"
                  value={calcPatients}
                  onChange={(e) => setCalcPatients(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Slider 2: Doctor Consultation Fee */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Doctor Consultation Fee (100% Retained):</span>
                  <span className="text-emerald-700 font-mono font-black text-sm">₹{calcFee} / Visit</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1500"
                  step="50"
                  value={calcFee}
                  onChange={(e) => setCalcFee(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Slider 3: % Chronic Patients in Practice */}
              <div className="space-y-2 bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200">
                <div className="flex justify-between text-xs font-bold text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <HeartPulse className="h-4 w-4 text-emerald-600" />
                    <span>Chronic Patients in Practice (Diabetes, BP, Thyroid):</span>
                  </span>
                  <span className="text-emerald-800 font-mono font-black text-sm">{calcChronicRatio}% of OPD</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="75"
                  step="5"
                  value={calcChronicRatio}
                  onChange={(e) => setCalcChronicRatio(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="text-[10.5px] text-emerald-800 font-medium">
                  Estimated Active Chronic Cohort: <strong>{Math.round((calcPatients * 26) * (calcChronicRatio / 100))} patients</strong> under continuous care.
                </div>
              </div>

              {/* Slider 4: Average Monthly Medicine Spend */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Average Monthly Chronic Medicine Spend:</span>
                  <span className="text-teal-700 font-mono font-black text-sm">₹{calcMedSale} / Month</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="2000"
                  step="50"
                  value={calcMedSale}
                  onChange={(e) => setCalcMedSale(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>

              {/* Slider 5: Average Diagnostic Spend */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Average Quarterly Diagnostic Spend:</span>
                  <span className="text-indigo-700 font-mono font-black text-sm">₹{calcLabFee} / Re-test</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="2500"
                  step="50"
                  value={calcLabFee}
                  onChange={(e) => setCalcLabFee(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Right Column: Earnings Summary Card */}
            {(() => {
              const monthlyOPD = calcPatients * 26;
              const directOpdEarnings = monthlyOPD * calcFee;
              const chronicPatients = Math.round(monthlyOPD * (calcChronicRatio / 100));
              const refillGMV = chronicPatients * calcMedSale;
              const pharmacyDoctorSplit = refillGMV * 0.15; // 15% SOP split
              // Assume 35% of chronic patients do a diagnostic test in any given month (approx every 90 days)
              const labMonthlyGMV = Math.round(chronicPatients * 0.35 * calcLabFee);
              const labDoctorSplit = labMonthlyGMV * 0.35; // 35% SOP split
              const netPracticeOutput = directOpdEarnings + pharmacyDoctorSplit + labDoctorSplit;
              const additionalCareValue = pharmacyDoctorSplit + labDoctorSplit;

              return (
                <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950 p-8 rounded-3xl text-white space-y-6 shadow-2xl border border-teal-500/30 text-left">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-[10px] font-mono font-extrabold uppercase text-emerald-400 tracking-widest block">
                      Estimated Monthly Practice Output
                    </span>
                    <p className="text-3xl font-black text-white mt-1">
                      ₹{(netPracticeOutput || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      <span className="text-xs text-slate-400 font-normal"> / month</span>
                    </p>
                    <span className="text-[11px] font-mono text-cyan-300 block mt-0.5">
                      Annual Run-Rate: ₹{((netPracticeOutput || 0) * 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / yr
                    </span>
                  </div>

                  <div className="space-y-3 text-xs font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span>1. Direct OPD Consultations (100%):</span>
                      <span className="font-bold text-white">₹{(directOpdEarnings || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-teal-300">
                      <span>2. Day-25 Refills (Chemist 15% SOP):</span>
                      <span className="font-bold">₹{(pharmacyDoctorSplit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between text-indigo-300">
                      <span>3. 90-Day Diagnostics (Lab 35% SOP):</span>
                      <span className="font-bold">₹{(labDoctorSplit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-[11px] text-emerald-200 leading-relaxed font-sans font-medium space-y-1">
                    <p>
                      💡 <strong>The Virtual Hospital Advantage:</strong> Your clinic unlocks an extra <strong>₹{(additionalCareValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / month</strong> (<strong>₹{((additionalCareValue || 0) * 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / year</strong>) in automated recurring care coordination value from medicines and lab tests that used to walk away to random unlinked vendors.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* ── SECTION: BUILT-IN CLOUD DOCTOR EMR SUITE (OPTIONAL POWER MODULE) ── */}
      <section id="optional-emr" className="scroll-mt-20 py-20 relative z-10 border-t border-slate-200 bg-gradient-to-b from-slate-50/60 via-white to-slate-50/40 text-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* Section Header */}
          <div className="mb-14 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800 font-mono text-[10px] font-extrabold uppercase tracking-widest">
              <Activity className="h-3.5 w-3.5 text-indigo-600" />
              Optional Power Module · Included At ₹0 Extra Cost
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight font-heading">
              Prefer Screens Over Paper?<br />
              <span className="bg-gradient-to-r from-indigo-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
                Full Cloud Doctor EMR Ready on Day 1.
              </span>
            </h2>
            
            <p className="text-slate-600 text-sm sm:text-base font-normal max-w-3xl mx-auto leading-relaxed">
              Our primary philosophy is zero-screen: keep writing on your trusted paper pad, your compounder scans or uploads it, and AI instantly digitizes everything. But if you or your associates prefer digital charting on desktop or iPad, VitalSync includes a hospital-grade Cloud Doctor EMR at zero extra cost. Ready when you are—or never touch a keyboard if you love paper.
            </p>
          </div>

          {/* 4 Feature Bento Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            
            {/* Card 1: CDSS AI Scribe & Clinical Decision Support */}
            <div className="p-7 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-400 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Bot className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full uppercase tracking-wider">
                    CDSS AI Clinical Scribe
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-heading">
                    AI Clinical Decision Support &amp; Voice Scribe
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Ambient voice-to-SOAP notes with intelligent drug-safety alerts.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>Voice-to-SOAP Scribe:</strong> Dictate clinical findings naturally; AI structures chief complaints, diagnosis &amp; advice.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>Realtime Drug-Safety Guard:</strong> Instant warnings for drug-drug interactions, contraindications, and pediatric dosage caps.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>ICD-10 Smart Typeahead:</strong> Standardized diagnostic coding with one-tap suggestions.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-indigo-700">
                <span>Groq Llama-3 70B + Gemini Clinical Engine</span>
                <span className="font-bold">Sub-250ms latency</span>
              </div>
            </div>

            {/* Card 2: Multi-Specialty Clinical Grids */}
            <div className="p-7 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-teal-400 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-2xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Eye className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full uppercase tracking-wider">
                    Multi-Specialty Grids
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-heading">
                    Ophthalmology, Pediatrics &amp; Cardiology Modes
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Specialized charting interfaces designed for clinical specialty workflows.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Ophthalmic Refraction Matrix:</strong> 8-point RE/LE grid (Sph, Cyl, Axis, VA, IOP, Fundus) with 1-click spectacle print.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Pediatrics Growth Curves:</strong> Interactive WHO percentile curves (Weight/Age, Height/Age) + automated vaccination milestones.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Cardiology &amp; Diabetology:</strong> Longitudinal BP, HbA1c &amp; Blood Glucose trend graphs.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-teal-700">
                <span>SpecializationContext Dynamic Layouts</span>
                <span className="font-bold">5 Specialties Built-In</span>
              </div>
            </div>

            {/* Card 3: 1-Tap Digital Rx Builder */}
            <div className="p-7 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-400 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Pill className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-wider">
                    Smart Rx Studio
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-heading">
                    1-Tap Digital Prescription Builder
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Rapid drug selector connected live to your partner chemist's inventory.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Fast Dosage Regimens:</strong> 1-click frequency shortcuts (<code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">1-0-1</code>, <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">0-1-0</code>) and meal timing tags.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Live Chemist Stock Check:</strong> Real-time visibility into local pharmacy inventory avoids out-of-stock substitutions.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Instant Multi-Channel Dispatch:</strong> Auto-delivers branded PDF to patient WhatsApp and pushes dispensing order to pharmacy POS.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-emerald-700">
                <span>FEFO Chemist Sync</span>
                <span className="font-bold">Zero Re-Typing</span>
              </div>
            </div>

            {/* Card 4: Unified Longitudinal Timeline */}
            <div className="p-7 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-cyan-400 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-2xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-full uppercase tracking-wider">
                    ABHA / ABDM Unified Record
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-heading">
                    Unified Longitudinal Health Record
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Complete patient history, previous visits, and verified lab trends on one screen.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
                    <span><strong>Chronological Visit Timeline:</strong> Previous prescriptions, vital trends, and doctor notes visible side-by-side in &lt;1s.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
                    <span><strong>Integrated Lab Correlation:</strong> Pathology biomarker curves (HbA1c, Creatinine) plotted alongside medication changes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
                    <span><strong>ABHA ID Health Locker:</strong> ABDM M1, M2 &amp; M3 compliant consent-based record exchange across India.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-cyan-700">
                <span>DPDP Act 2023 &amp; HIPAA Compliant</span>
                <span className="font-bold">100% Doctor-Owned</span>
              </div>
            </div>

          </div>

          {/* Dual-Mode Sovereign Invariant Callout */}
          <div className="mt-10 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 text-left">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 py-0.5 px-3 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-indigo-400" />
                The Doctor's Autonomous Choice
              </div>
              <h4 className="text-base font-bold text-white font-heading">
                Write on Paper Pad (Optical AI Vision) ⇄ Click on Screen (Cloud EMR)
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                Choose your consultation mode per patient. Both flows feed the exact same automated WhatsApp Assistant, Chemist POS dispensing queue, and Lab LIS test worklist.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Comprehensive EMR Architecture Comparison Section: VitalSync vs Practo Ray */}
      <section id="emr-comparison" className="scroll-mt-20 py-20 relative z-10 bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800 font-mono text-[10px] font-extrabold uppercase tracking-widest">
              <Database className="h-3.5 w-3.5 text-indigo-600" />
              Direct Clinical Comparison
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Why Doctors Choose VitalSync Over Practo Ray &amp; Legacy EMRs
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-normal max-w-3xl mx-auto leading-relaxed">
              Traditional EMRs were designed for desktop typing and billing, not patient retention. Here is what actually makes VitalSync category-defining for independent clinics in India.
            </p>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-xl bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="p-5 font-black text-slate-700 uppercase tracking-wider text-[11px] w-[26%]">Clinical &amp; Operational Dimension</th>
                  <th className="p-5 font-black text-teal-800 uppercase tracking-wider text-[11px] bg-teal-50/70 border-x border-teal-200/80 w-[32%]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      VitalSync (WhatsApp Clinic OS)
                    </div>
                  </th>
                  <th className="p-5 font-bold text-slate-600 uppercase tracking-wider text-[11px] w-[22%]">Practo Ray &amp; Legacy EMRs</th>
                  <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-[11px] w-[20%]">Standalone Chatbots (Wati / Interakt)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {/* Row 1: Doctor Consultation Experience */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-800">
                    <div>Doctor Consultation Workflow</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Screen distraction, typing burden &amp; habit change</div>
                  </td>
                  <td className="p-5 bg-teal-50/30 border-x border-teal-200/60 font-semibold text-slate-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Zero Screen Typing (0 Habit Change):</strong> Write on paper pad as usual; staff AI Vision digitizes instantly at the desk. Or toggle to Cloud EMR in 1 click.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">⚠️</span>
                      <span><strong>8 Hours Typing on Keyboard:</strong> Doctor must stare at a computer monitor during consults, breaking eye contact and patient rapport.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>None:</strong> Only basic marketing chat; zero clinical EMR or prescription tools.</span>
                    </div>
                  </td>
                </tr>

                {/* Row 2: Patient Mobile Experience */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-800">
                    <div>Patient Mobile Adoption</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Friction to book, track token &amp; receive prescriptions</div>
                  </td>
                  <td className="p-5 bg-teal-50/30 border-x border-teal-200/60 font-semibold text-slate-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>100% Native WhatsApp:</strong> Zero app downloads. Instant OPD tokens, live queue alerts ("Turn in 2 patients"), and e-Rx delivered directly to WhatsApp.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">⚠️</span>
                      <span><strong>50MB App Download Fatigue:</strong> Patients must install separate app, register, and remember logins. 92% uninstall within 14 days.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>High Friction:</strong> Disconnected from clinic queue; staff must manually re-enter data between systems.</span>
                    </div>
                  </td>
                </tr>

                {/* Row 3: Chronic Patient Retention & Refills */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-800">
                    <div>Chronic Retention &amp; Refill Loops</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Capturing repeat medicine &amp; lab revenue after Day 1</div>
                  </td>
                  <td className="p-5 bg-teal-50/30 border-x border-teal-200/60 font-semibold text-slate-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Autonomous Chronic Care Engine:</strong> Proactive Day-25 1-tap WhatsApp refills (10% VIP discount) and Day-85 diagnostic loops retain patients for years.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>Zero Retention After Day 1:</strong> Once the consult ends, patient walks away. Prescriptions are lost to 1mg/Apollo; follow-ups are forgotten.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>None:</strong> Cannot track medication supply schedules (`1-0-1`) or coordinate pharmacy refill dispatch.</span>
                    </div>
                  </td>
                </tr>

                {/* Row 4: Chemist & Pathology Integration */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-800">
                    <div>Chemist &amp; Pathology Ecosystem</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Real-time collaboration with local pharmacy &amp; lab</div>
                  </td>
                  <td className="p-5 bg-teal-50/30 border-x border-teal-200/60 font-semibold text-slate-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Connected Triad Highway:</strong> Sub-250ms realtime sync connects Doctor Chamber, local Chemist POS (FEFO batch tracking), and Pathology Lab LIS.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>Isolated Doctor Silo:</strong> No live inventory link with local chemist; lab reports must be manually brought by patient on paper.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>None:</strong> No fulfillment, inventory, or diagnostic capabilities.</span>
                    </div>
                  </td>
                </tr>

                {/* Row 5: ABDM & ABHA Compliance */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-800">
                    <div>ABDM &amp; ABHA ID Compliance</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Ayushman Bharat Digital Mission readiness</div>
                  </td>
                  <td className="p-5 bg-teal-50/30 border-x border-teal-200/60 font-semibold text-slate-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Native ABDM Architecture:</strong> ABHA creation, verification, and M1/M2/M3 consent-driven health records built-in.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">⚠️</span>
                      <span>Varying; often requires paid enterprise add-on modules.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>Non-Compliant:</strong> Standard chat bots cannot handle cryptographic ABDM consent.</span>
                    </div>
                  </td>
                </tr>

                {/* Row 6: Pricing & Doctor Autonomy */}
                <tr className="hover:bg-slate-50/50 transition-colors bg-teal-50/20">
                  <td className="p-5 font-bold text-slate-900">
                    <div>Pricing &amp; Doctor Autonomy</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Software license fees &amp; consultation revenue</div>
                  </td>
                  <td className="p-5 bg-teal-100/50 border-x border-teal-300 font-extrabold text-teal-950">
                    <div className="flex items-start gap-2">
                      <Award className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>90 Days Free · Then ₹999/mo:</strong> 100% of patient consultation fees go directly to doctor with 0% OPD commission (vs ₹1,500–₹5,000/mo by legacy EMRs).</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600 font-medium">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>₹1,500 – ₹5,000 / month / doctor</strong> recurring SaaS subscription charges + platform lock-in.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600 font-medium">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span>₹2,500+ / month base platform charge + high per-conversation Meta charges.</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Onboarding Steps Section — Exactly Matching Slide 13 of the Doctor Booklet */}
      <section id="onboarding" className="scroll-mt-20 py-20 relative z-10 bg-[#F8F9FA] border-t border-slate-200/60">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full border border-teal-200 bg-teal-50 text-teal-800 font-mono text-[10px] font-extrabold uppercase tracking-widest mb-3">
              <Zap className="h-3.5 w-3.5 text-teal-600" />
              15-Minute Practice Onboarding
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Launch Your Connected Practice in 3 Simple Steps</h2>
            <p className="text-slate-500 text-sm font-semibold mt-2">First 90 days 100% Free. Zero complex hardware. Practice onboarding in under 15 minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative text-left">
            {/* Desktop step connectors */}
            <div className="hidden md:block absolute top-6 left-[16%] right-[16%] h-[1px] border-t border-dashed border-slate-200 pointer-events-none" />

            {[
              {
                step: '01',
                title: 'Practice Profile & Direct Bank Setup',
                desc: "Register your clinic profile, set up your doctor credentials, and link your direct settlement bank account or UPI QR with 100% consultation fee protection.",
                color: 'text-teal-700',
                bg: 'bg-teal-50',
                border: 'border-teal-200'
              },
              {
                step: '02',
                title: 'Connect Chemist & Pathology Lab',
                desc: "Link your trusted neighborhood pharmacy and diagnostic laboratory partners with custom SOP split parameters (10%-15% pharmacy, 30%-40% lab).",
                color: 'text-indigo-700',
                bg: 'bg-indigo-50',
                border: 'border-indigo-200'
              },
              {
                step: '03',
                title: 'Front-Desk OPD Go-Live',
                desc: "Your compounder starts generating smart tokens (#TK-001) and recording vitals. Doctor consults on paper pad (Option A) or digital screen (Option B) with live WhatsApp delivery.",
                color: 'text-emerald-700',
                bg: 'bg-emerald-50',
                border: 'border-emerald-200'
              }
            ].map(({ step, title, desc, color, bg, border }, idx) => (
              <div key={step} className="flex flex-col gap-4 relative">
                <div className={`w-12 h-12 rounded-2xl ${bg} border ${border} flex items-center justify-center font-black text-sm ${color} z-10 shadow-md`}>
                  {step}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">{title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">{desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Transparent Pricing: 0% OPD, 0% WhatsApp, 5% Lab, 2% Pharmacy */}
      <section id="pricing" className="scroll-mt-20 py-20 relative z-10 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700 font-mono text-[10px] font-extrabold uppercase tracking-widest mb-3">
              <Shield className="h-3.5 w-3.5 text-teal-600" />
              100% Transparent Platform Pricing
            </div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight uppercase">Platform Fee Schedule</h2>
            <p className="text-slate-500 text-sm font-semibold mt-2 max-w-2xl mx-auto">
              VitalSync offers a 90-Day Full-Access Free Pilot followed by a flat ₹999/month Clinical Operations Fee. We maintain 0% commission on Doctor OPD consultations, alongside ultra-low B2B splits on partner Pathology Lab (2%) and Pharmacy Counter (1%).
            </p>
          </div>

          {/* 90-Day Free Pilot & ₹999 Operations Infrastructure Banner */}
          <div className="mb-12 p-8 rounded-3xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border border-emerald-500/30 text-white shadow-xl relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <Zap className="w-56 h-56 text-teal-400" />
            </div>
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-3">
                <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-mono text-[11px] font-bold uppercase tracking-widest">
                  <Sparkles className="h-3.5 w-3.5" /> 90-Day Risk-Free Clinical Pilot
                </div>
                <h3 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
                  First 90 Days 100% Free · Then Flat ₹999/mo Operations Fee
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-xl">
                  Test the complete WhatsApp agentic care loop, AI scribe, and automated chronic refill engine for 90 days with zero financial commitment. Experience 10x ROI before paying a single rupee.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span><strong>100% Doctor Fee Immunity</strong> (0% OPD Commission)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span><strong>Sub-250ms Outbound WhatsApp</strong> Business Engine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span><strong>Automated Chronic Care Loop</strong> &amp; 1-Tap Refills</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span><strong>Zero Hardware Required</strong> · Runs on Mobile / PC</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/15 text-center flex flex-col justify-between space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 font-mono block">Clinical Operations Plan</span>
                  <div className="mt-2 flex items-baseline justify-center gap-1.5">
                    <span className="text-4xl font-extrabold text-white">₹999</span>
                    <span className="text-xs text-slate-300 font-medium">/ month / clinic</span>
                  </div>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono">
                    First 90 Days: ₹0 (Free Trial)
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                  Covers 24/7 official WhatsApp Business messaging, real-time cloud data sync, AI clinical triage, and automated 5-console clinic networking.
                </p>

              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {/* Card 1: Online WhatsApp Bookings */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-teal-50/50 to-white border border-teal-200/80 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-teal-700 bg-teal-100 border border-teal-300 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                    0% OPD Platform Fee (100% Doctor Payout)
                  </span>
                  <Sparkles className="h-4 w-4 text-teal-600" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Online WhatsApp Appointments</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Direct patient bookings via WhatsApp Chatbot. 100% of consultation fees go straight to the Doctor's UPI account with zero platform deductions.
                </p>
                <div className="p-4 rounded-2xl bg-white border border-teal-100 text-xs space-y-2 font-mono">
                  <div className="flex justify-between text-slate-500">
                    <span>Consultation Fee:</span>
                    <span>₹500.00</span>
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 flex justify-between font-extrabold text-slate-900">
                    <span>Total Patient Invoice:</span>
                    <span>₹500.00</span>
                  </div>
                  <div className="text-[10px] text-teal-700 font-bold font-sans pt-1">
                    ✓ 100% Direct to Doctor UPI • ₹0 Deductions
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Counter Physical Consultations */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-200/80 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                    0% OPD Platform Fee (100% Doctor Payout)
                  </span>
                  <Award className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Counter Physical Consultations</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Direct walk-in checkups booked at the Compounder desk carry 0% platform fee. 100% of the consultation fee goes to the Doctor.
                </p>
                <div className="p-4 rounded-2xl bg-white border border-emerald-100 text-xs space-y-2 font-mono">
                  <div className="flex justify-between text-slate-500">
                    <span>Counter Consultation Fee:</span>
                    <span>₹500.00</span>
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 flex justify-between font-extrabold text-slate-900">
                    <span>Doctor Earnings:</span>
                    <span>₹500.00 (100%)</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold font-sans pt-1">
                    ✓ 90 Days Free • Flat ₹999/mo • Zero OPD Commission
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Pathology Lab Diagnostic Requisitions */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-indigo-50/50 to-white border border-indigo-200/80 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 border border-indigo-300 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                    2% Platform Fee
                  </span>
                  <Building2 className="h-4 w-4 text-indigo-600" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Pathology Lab Requisitions</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Digital diagnostic orders and electronic LOINC lab requisitions fulfilled through the clinic's connected partner lab.
                </p>
                <div className="p-4 rounded-2xl bg-white border border-indigo-100 text-xs space-y-2 font-mono">
                  <div className="flex justify-between text-slate-500">
                    <span>Digital Lab Order:</span>
                    <span>₹1,000.00</span>
                  </div>
                  <div className="flex justify-between text-indigo-700 font-bold">
                    <span>Platform Split (2%):</span>
                    <span>₹20.00</span>
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 flex justify-between font-extrabold text-slate-900">
                    <span>Net Lab Vendor Credit:</span>
                    <span>₹980.00</span>
                  </div>
                  <div className="text-[10px] text-indigo-700 font-bold font-sans pt-1">
                    ✓ Automated B2B Ledger Settlement
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Pharmacy Counter Dispensary */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-sky-50/50 to-white border border-sky-200/80 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-sky-800 bg-sky-100 border border-sky-300 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                    1% Platform Fee
                  </span>
                  <Pill className="h-4 w-4 text-sky-600" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Pharmacy Counter POS</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  FEFO batch inventory dispensing and digital Paytm/UPI medicine sales at the clinic pharmacy counter.
                </p>
                <div className="p-4 rounded-2xl bg-white border border-sky-100 text-xs space-y-2 font-mono">
                  <div className="flex justify-between text-slate-500">
                    <span>Medicine Order:</span>
                    <span>₹1,000.00</span>
                  </div>
                  <div className="flex justify-between text-sky-700 font-bold">
                    <span>Platform Split (1%):</span>
                    <span>₹10.00</span>
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 flex justify-between font-extrabold text-slate-900">
                    <span>Net Pharmacy Credit:</span>
                    <span>₹990.00</span>
                  </div>
                  <div className="text-[10px] text-sky-700 font-bold font-sans pt-1">
                    ✓ Realtime Retail Stock Depletion
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions (FAQ) & ABDM Architecture Section */}
      <section id="faq" className="scroll-mt-20 py-20 relative z-10 bg-slate-50/70 border-t border-slate-200">
        <div id="emr-architecture" className="max-w-4xl mx-auto px-6">
          <div className="mb-12 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full border border-teal-200 bg-teal-50 text-teal-800 font-mono text-[10px] font-extrabold uppercase tracking-widest">
              <HelpCircle className="h-3.5 w-3.5 text-teal-600" />
              Clinical &amp; Architecture FAQ
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-650 text-sm font-semibold max-w-2xl mx-auto">
              Everything doctors and clinic administrators need to know about VitalSync's standalone EMR capabilities, WhatsApp data sync, ABDM compliance, and security.
            </p>
          </div>

          <div className="space-y-4 text-left">
            {[
              {
                id: 0,
                question: "Do I need a separate or standalone EMR software (like Practo, HealthPlix, or MocDoc) to use VitalSync?",
                badge: "EMR Architecture",
                answer: (
                  <div className="space-y-2.5 text-xs text-slate-650 leading-relaxed font-normal">
                    <p>
                      <strong className="text-slate-900">No, absolutely not.</strong> VitalSync is a complete, standalone Electronic Medical Record (EMR) system. It natively provides the full <strong>Doctor EMR Console</strong> (with CDSS AI Scribe, Ophthalmic Refraction Grid, and 1-Click Digital Prescriptions), <strong>Compounder OPD Desk</strong>, <strong>Pharmacy POS</strong>, and <strong>Pathology Lab LIS</strong>.
                    </p>
                    <p>
                      Clinics do not need to buy, maintain, or pay subscriptions for any third-party EMR software. VitalSync is your entire clinical operating system.
                    </p>
                  </div>
                )
              },
              {
                id: 1,
                question: "Do doctors or clinic staff have to manually copy-paste or parallel-enter data between WhatsApp and the EMR?",
                badge: "Zero Double-Entry",
                answer: (
                  <div className="space-y-2.5 text-xs text-slate-650 leading-relaxed font-normal">
                    <p>
                      <strong className="text-slate-900">Zero manual entry or copy-pasting is required.</strong> WhatsApp functions purely as the friction-free patient interface (for booking, receiving prescriptions, and ordering refills).
                    </p>
                    <p>
                      All interactions synchronize instantly across all clinic devices at <strong>sub-250ms speed</strong>. When a patient books an appointment or a doctor issues a digital prescription, tokens and clinical records are automatically populated inside the Doctor EMR, Compounder Desk, and Pharmacy POS in real time.
                    </p>
                  </div>
                )
              },
              {
                id: 2,
                question: "How does VitalSync comply with the Ayushman Bharat Digital Mission (ABDM) and ABHA IDs?",
                badge: "ABDM & ABHA Compliant",
                answer: (
                  <div className="space-y-2.5 text-xs text-slate-650 leading-relaxed font-normal">
                    <p>
                      <strong className="text-slate-900">VitalSync is built from the ground up for ABDM compliance.</strong> It features native ABHA ID creation, verification, and Milestone 1, 2, and 3 consent-driven healthcare data exchange.
                    </p>
                    <p>
                      Patient consent is cryptographically verified before any longitudinal record access is authorized, strictly meeting all National Health Authority (NHA) and ABDM standards.
                    </p>
                  </div>
                )
              },
              {
                id: 3,
                question: "Who owns the clinical patient records, and how is medical data privacy protected?",
                badge: "DPDP Act & HIPAA",
                answer: (
                  <div className="space-y-2.5 text-xs text-slate-650 leading-relaxed font-normal">
                    <p>
                      <strong className="text-slate-900">You and your clinic retain 100% ownership of your patient records.</strong> In strict compliance with India's <strong>Digital Personal Data Protection (DPDP) Act 2023</strong> and HIPAA privacy guidelines, your clinic's patient records are isolated in dedicated private encrypted storage.
                    </p>
                    <p>
                      All payloads are encrypted in transit using <strong>TLS 1.3</strong> and at rest using <strong>AES-256</strong>. VitalSync never aggregates, sells, or monetizes patient data.
                    </p>
                  </div>
                )
              },
              {
                id: 4,
                question: "How is VitalSync fundamentally different from generic third-party WhatsApp chatbot plugins?",
                badge: "Full Ecosystem",
                answer: (
                  <div className="space-y-2.5 text-xs text-slate-650 leading-relaxed font-normal">
                    <p>
                      Third-party WhatsApp bots (like WATI or Interakt) are generic marketing tools that require complex custom API coding or manual copy-pasting into disconnected EMRs.
                    </p>
                    <p>
                      <strong>VitalSync is a unified clinical ecosystem:</strong> the Doctor EMR, Compounder OPD Desk, Pharmacy POS, Pathology Lab LIS, and WhatsApp interact seamlessly on a single shared database with zero integration hassle and zero custom developer fees.
                    </p>
                  </div>
                )
              },
              {
                id: 5,
                question: "How does VitalSync pricing and the 90-Day Free Pilot work?",
                badge: "90-Day Free Pilot + ₹999/mo",
                answer: (
                  <div className="space-y-2.5 text-xs text-slate-650 leading-relaxed font-normal">
                    <p>
                      <strong className="text-slate-900">Every clinic begins with a 100% Free 90-Day Full-Access Clinical Pilot.</strong> There are zero setup fees, zero hardware costs, and zero credit card requirements.
                    </p>
                    <p>
                      After 90 days of proven clinical ROI and patient retention, clinics continue on our standard <strong className="text-emerald-800">Clinical Operations Fee of flat ₹999/month</strong>. This covers secure cloud database hosting, Meta WhatsApp Business API relays, AI triage inference, and continuous 24/7 autonomous agents.
                    </p>
                    <p>
                      Crucially, under our <strong>Doctor Consultation Fee Immunity Guarantee</strong>, VitalSync NEVER takes a single rupee from your patient consultation fees — 100% of your OPD earnings remain 100% yours.
                    </p>
                  </div>
                )
              },
              {
                id: 6,
                question: "How does the Day-25 Chronic Refill Engine work without spamming patients?",
                badge: "Chronic Refill Engine",
                answer: (
                  <div className="space-y-2.5 text-xs text-slate-650 leading-relaxed font-normal">
                    <p>
                      <strong className="text-slate-900">It is 100% consent-driven and clinically timed.</strong> When a doctor prescribes chronic medicines (for Diabetes, BP, Thyroid, etc.), our system parses the dosage (<code className="text-teal-800 font-mono bg-teal-50 px-1 rounded">1-0-1</code> = 2/day) to calculate the exact days-supply.
                    </p>
                    <p>
                      Exactly 5 days before the pack is depleted (Day 25 for a 30-day supply), the patient receives an interactive WhatsApp message with a permanent <strong>10% VIP Chronic Discount</strong>. With a single tap on <strong>[ 📦 Confirm 1-Click Refill ]</strong>, the order is packed by the partner chemist for free home delivery or express pickup.
                    </p>
                  </div>
                )
              },
              {
                id: 7,
                question: "Can I use VitalSync if I prefer writing paper prescriptions and don't want to type on a screen?",
                badge: "Zero Screen Habit",
                answer: (
                  <div className="space-y-2.5 text-xs text-slate-650 leading-relaxed font-normal">
                    <p>
                      <strong className="text-slate-900">Yes! VitalSync supports a Zero-Doctor-Screen workflow.</strong> You can continue writing on your standard printed clinic prescription pad with a ballpoint pen as you have always done.
                    </p>
                    <p>
                      When the patient steps to the compounder desk, your assistant snaps a single photo with a smartphone or webcam. VitalSync's specialized clinical AI model instantly digitizes the handwriting into structured digital records, dispatches the WhatsApp e-Rx, and queues the medicines at the pharmacy.
                    </p>
                  </div>
                )
              },
              {
                id: 8,
                question: "How does the Connected Triad settlement between Doctor, Chemist, and Lab operate?",
                badge: "Triad Settlements",
                answer: (
                  <div className="space-y-2.5 text-xs text-slate-650 leading-relaxed font-normal">
                    <p>
                      <strong className="text-slate-900">Settlements are automated, transparent, and governed by clinic SOPs.</strong> The doctor sets custom coordination splits (e.g. 20%–30% on medicines, 30%–40% on diagnostics) in the Doctor EMR SOP Config Tab.
                    </p>
                    <p>
                      When a patient pays for medicines or blood tests at the counter or via UPI, the platform's multi-tenant ledger calculates and deposits each party's share directly into their bank account via automated gateway settlement, maintaining a ₹1,000 safety buffer with zero manual bookkeeping.
                    </p>
                  </div>
                )
              }
            ].map((faq) => {
              const isOpen = expandedFaq === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`rounded-2xl border transition-all duration-300 overflow-hidden bg-white ${
                    isOpen ? 'border-teal-400/80 shadow-md ring-1 ring-teal-400/20' : 'border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isOpen ? null : faq.id)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full shrink-0">
                        {faq.badge}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{faq.question}</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform duration-300 shrink-0 ${
                        isOpen ? 'rotate-180 text-teal-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50/40 animate-fade-in">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PRE-FOOTER ENTERPRISE CTA ── */}
      <section className="py-20 relative z-10 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-[600px] h-[400px] bg-teal-500/10 rounded-full filter blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-emerald-500/10 rounded-full filter blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-widest font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> VitalSync — 100% Free for Doctors
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Your Clinic.<br />
            <span className="bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300 bg-clip-text text-transparent">Now a Hospital-Grade Smart Network.</span>
          </h2>
          <p className="text-slate-300 text-sm font-medium max-w-2xl mx-auto leading-relaxed">
            Join independent doctors across Patna, Bihar who have digitised their OPD, automated WhatsApp care loops, and unlocked recurring refill revenue — all at zero SaaS cost.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => { setShowDemoModal(true); setDemoSuccess(false); setDemoError(null); }}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-teal-500/25 transition-all cursor-pointer flex items-center gap-2.5 group"
            >
              <Calendar className="h-4 w-4" /> Book Your 1-on-1 Clinic Demo
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] text-slate-400 font-medium pt-2">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />0% Doctor Fee Cut</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />WhatsApp Care Loop Included</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />DPDP &amp; NMC Ethics Compliant</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 relative z-10 bg-slate-950 border-t border-slate-800 text-slate-400">
        <div className="max-w-6xl mx-auto">
          {/* Top Row */}
          <div className="flex flex-col lg:flex-row lg:justify-between gap-10 pb-10 border-b border-slate-800">
            {/* Brand Column */}
            <div className="flex flex-col space-y-4 text-left max-w-xs">
              <div className="flex items-center gap-2">
                <BrandMark size={22} title="VitalSync" />
                <span className="text-sm font-black text-white tracking-tight">VitalSync</span>
                <span className="text-[9px] font-mono bg-teal-500/20 text-teal-400 border border-teal-500/30 px-2 py-0.5 rounded-full">v1.0</span>
              </div>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Empowering independent clinics, pharmacies, and pathology labs to operate as a hospital-grade smart network on WhatsApp.
              </p>
              <div className="flex flex-col gap-1 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-teal-500 shrink-0" />
                  <span>Patna Bailey Road, Patna, Bihar 800014</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-teal-500 shrink-0" />
                  <a href="mailto:contact@vitalsync.in" className="hover:text-teal-400 transition-colors">contact@vitalsync.in</a>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs">
              <div className="space-y-2">
                <p className="text-white font-bold uppercase tracking-wider text-[10px] font-mono mb-3">Platform</p>
                <a href="#how-it-works" className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5">How It Works</a>
                <a href="#triad-architecture" className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5">Clinic Triad</a>
                <a href="#chronic-care" className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5">Chronic Care</a>
                <a href="#optional-emr" className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5">Cloud EMR</a>
                <a href="#emr-comparison" className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5">vs Practo Ray</a>
              </div>
              <div className="space-y-2">
                <p className="text-white font-bold uppercase tracking-wider text-[10px] font-mono mb-3">For Partners</p>
                <a href="#pricing" className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5">Pricing</a>
                <a href="#faq" className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5">FAQs</a>
                <button onClick={handleSignUpClick} className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5 cursor-pointer text-left">Clinic Sign Up</button>
                <button onClick={() => { setShowDemoModal(true); setDemoSuccess(false); setDemoError(null); }} className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5 cursor-pointer text-left">Book Demo</button>
              </div>
              <div className="space-y-2">
                <p className="text-white font-bold uppercase tracking-wider text-[10px] font-mono mb-3">Legal</p>
                <a href="/terms" className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5">Terms &amp; Conditions</a>
                <a href="/privacy" className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5">Privacy Policy</a>
                <a href="/refund-policy" className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5">Refund Policy</a>
                <a href="/contact-us" className="block text-slate-400 hover:text-teal-400 transition-colors py-0.5">Contact Us</a>
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-6 text-xs">
            <span className="text-slate-500 font-medium">© 2026 VitalSync Care Connected Ecosystem · Virtual Hospital Network</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[10px]">DPDP Act 2023</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[10px]">NMC Ethics</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[10px]">ABDM Compliant</span>
              <button
                type="button"
                onClick={() => {
                  const curHostname = window.location.hostname;
                  const isSingleDomain = getIsSingleDomain(curHostname);
                  const adminUrl = isSingleDomain
                    ? `${window.location.origin}?console=true`
                    : (curHostname === 'localhost' || curHostname === '127.0.0.1'
                      ? `http://admin.localhost:${window.location.port || '5173'}`
                      : 'https://admin.vitalsync.in');
                  window.location.href = adminUrl;
                }}
                className="text-slate-600 hover:text-slate-400 transition-colors font-mono text-[10px] tracking-widest uppercase cursor-pointer select-none"
                title="Go to Platform Operations"
              >
                Platform Ops ↗
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth happens on app.vitalsync.in — no inline auth modal on the landing page */}


      {showDemoModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-slate-800 font-sans">
          <div className="relative w-full max-w-lg bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden animate-scale-up text-left">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-6 text-white relative">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full filter blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                      Book 1-on-1 Live Demo <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">Free</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Official VitalSync Enterprise Clinical Onboarding Desk
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDemoModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Success State or Form */}
            {demoSuccess ? (
              <div className="p-8 flex flex-col items-center text-center gap-5">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 mb-1">Demo Request Confirmed! 🎉</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Our clinical onboarding specialist will reach out to <span className="font-bold text-slate-700">+91 {demoPhone}</span> within <span className="font-bold text-emerald-700">2 hours</span> to schedule your personalized live demo.
                  </p>
                </div>
                <div className="w-full p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-800 font-medium text-left">
                  <p className="font-bold text-teal-900 mb-1">What happens next?</p>
                  <p>✅ Our team reviews your clinic profile</p>
                  <p>✅ We schedule a 30-min product walkthrough on your preferred slot</p>
                  <p>✅ Your clinic's WhatsApp ID gets activated — 100% Free</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowDemoModal(false); setDemoSuccess(false); }}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
            <form onSubmit={handleBookDemoSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {demoError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{demoError}</span>
                </div>
              )}

              {/* Clinician Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Doctor / Contact Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={demoDoctorName}
                  onChange={(e) => setDemoDoctorName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-800 transition-all placeholder:text-slate-400"
                  required
                />
              </div>

              {/* Clinic Name & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Clinic / Hospital Name</label>
                  <input
                    type="text"
                    value={demoClinicName}
                    onChange={(e) => setDemoClinicName(e.target.value)}
                    placeholder="e.g. Sharma Health Clinic"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-800 transition-all placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City / Town</label>
                  <input
                    type="text"
                    value={demoCity}
                    onChange={(e) => setDemoCity(e.target.value)}
                    placeholder="e.g. Patna, Bihar"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-800 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* WhatsApp Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp Number (for Confirmation &amp; Demo) <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-slate-500 font-mono">+91</span>
                  <input
                    type="tel"
                    value={demoPhone}
                    onChange={(e) => setDemoPhone(e.target.value)}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-800 transition-all placeholder:text-slate-400 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Clinical Specialty */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Clinical Specialty</label>
                <select
                  value={demoSpecialty}
                  onChange={(e) => setDemoSpecialty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-800 transition-all bg-white"
                >
                  <option value="General Medicine">General Medicine / Physician</option>
                  <option value="Cardiology">Cardiology / Hypertension</option>
                  <option value="Ophthalmology">Ophthalmology / Eye Care</option>
                  <option value="Pediatrics">Pediatrics / Child Care</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Diabetology">Diabetology / Endocrinology</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Multi-Specialty Clinic">Multi-Specialty Clinic / Nursing Home</option>
                  <option value="Partner Pharmacy">Partner Pharmacy</option>
                  <option value="Pathology Lab">Pathology Laboratory</option>
                </select>
              </div>

              {/* Daily OPD Volume */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Daily OPD Volume</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['< 25 OPD', '25-50 OPD', '50-100 OPD', '100+ OPD'].map((vol, idx) => (
                    <button
                      type="button"
                      key={`demo-vol-${idx}-${vol}`}
                      onClick={() => setDemoPatientsVolume(vol)}
                      className={`py-2 px-2.5 rounded-xl text-center text-xs font-bold transition-all cursor-pointer border ${
                        demoPatientsVolume === vol
                          ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {vol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Time */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Preferred Demo Slot</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Today Evening', 'Tomorrow Morning', 'Tomorrow Evening', 'This Weekend'].map((slot, idx) => (
                    <button
                      type="button"
                      key={`demo-slot-${idx}-${slot}`}
                      onClick={() => setDemoPreferredTime(slot)}
                      className={`py-2 px-2 rounded-xl text-center text-[11px] font-bold transition-all cursor-pointer border ${
                        demoPreferredTime === slot
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-teal-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Request Your Free Live Demo
                </button>
                <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500 font-medium pt-2.5">
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-600" /> Instant Response
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-600" /> Dedicated Clinical Specialist
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-600" /> 100% Free
                  </span>
                </div>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Floating App Install Banner (PWA Install Prompt) */}
      <AppInstallBanner />
    </div>
  );
};
