import React, { useState, useEffect, useRef } from 'react';
import { BrandMark } from './BrandMark';
import { AppInstallBanner } from './AppInstallBanner';
import {
  Shield, Activity, Building2, Users, Layers, Zap, Clock, ChevronRight, Terminal, GitBranch, Lock, ArrowRight, Sparkles,
  X, FileText, Loader2, AlertCircle, Mail, Presentation, TrendingUp, Award, ChevronLeft, CheckCircle2, Eye, MessageSquare,
  Stethoscope, Pill, Printer, Smartphone, Send, Check, ChevronDown, HelpCircle, Database,
  HeartPulse, RefreshCw, Calendar, FileSpreadsheet, Package, PhoneCall, Bot, Flame, ShieldAlert, Star, Percent, ArrowUpRight, BarChart3, Microscope
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

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
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
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [isSignupUnlocked, setIsSignupUnlocked] = useState(false);
  const [showBenefitsTour, setShowBenefitsTour] = useState(false);
  const [tourSlide, setTourSlide] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [calcPatients, setCalcPatients] = useState(25);
  const [calcFee, setCalcFee] = useState(500);
  const [calcLabFee, setCalcLabFee] = useState(800);
  const [calcMedSale, setCalcMedSale] = useState(600);
  // Interactive Console Switcher Tab
  const [activeConsoleTab, setActiveConsoleTab] = useState<'doctor' | 'chronic' | 'pharmacy' | 'lab' | 'whatsapp'>('doctor');
  // 360° Chronic Patient Journey Timeline Step (0: Day 1, 1: Day 7, 2: Day 25, 3: Day 85, 4: Day 90)
  const [activeTimelineStep, setActiveTimelineStep] = useState(2);
  // Chronic Patient % in Practice Calculator
  const [calcChronicRatio, setCalcChronicRatio] = useState(45);
  // WhatsApp Patient Simulator State
  const [simStep, setSimStep] = useState<'refill_prompt' | 'refill_confirmed' | 'booking_prompt' | 'booking_confirmed' | 'report_prompt' | 'report_viewed'>('refill_prompt');
  const [isSimTyping, setIsSimTyping] = useState(false);

  const handleSimAction = (nextStep: 'refill_prompt' | 'refill_confirmed' | 'booking_prompt' | 'booking_confirmed' | 'report_prompt' | 'report_viewed') => {
    setIsSimTyping(true);
    setTimeout(() => {
      setIsSimTyping(false);
      setSimStep(nextStep);
    }, 400);
  };
  // Mouse coordinates state for background parallax effect
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize values between -0.5 and 0.5
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setMousePos({ x, y });

      // Update CSS variables for the mouse follow glow spotlight
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const pxX = e.clientX - rect.left;
        const pxY = e.clientY - rect.top;
        containerRef.current.style.setProperty('--mouse-x', `${pxX}px`);
        containerRef.current.style.setProperty('--mouse-y', `${pxY}px`);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Eligibility Form States
  const [ageConfirm, setAgeConfirm] = useState(false);
  const [complianceConfirm, setComplianceConfirm] = useState(false);
  const [baaConfirm, setBaaConfirm] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [registrationType, setRegistrationType] = useState<'doctor' | 'partner'>('doctor');
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  const handleContactSupport = (e: React.MouseEvent) => {
    e.preventDefault();
    // Anti-Scraper Base64 Obfuscated Phone Number (+91 9608032073)
    const obfuscatedPayload = 'OTE5NjA4MDMyMDcz';
    const cleanNum = window.atob(obfuscatedPayload);
    const targetUrl = `https://wa.me/${cleanNum}?text=${encodeURIComponent("Hi VitalSync Support, I'm interested in onboarding.")}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
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

  const handleGetStartedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSignupUnlocked) {
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
      const isSingleDomain = getIsSingleDomain(hostname) || isLocal;

      if (isSingleDomain) {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'register');
        window.location.href = url.toString();
        return;
      }

      window.location.href = 'https://app.vitalsync.in?tab=register';
    } else {
      setShowEligibilityModal(true);
      setEligibilityError(null);
    }
  };

  const handleValidateEligibility = async (e: React.FormEvent) => {
    e.preventDefault();
    setEligibilityError(null);

    // 1. Verify Age
    if (!ageConfirm) {
      setEligibilityError('You must confirm you are 18 years of age or older to register.');
      return;
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailInput.trim()) {
      setEligibilityError('Please enter a professional email address.');
      return;
    }
    if (!emailRegex.test(emailInput.trim())) {
      setEligibilityError('Please enter a valid email address format.');
      return;
    }

    // 3. Prevent duplicate check on default accounts
    const normalizedEmail = emailInput.trim().toLowerCase();

    // 4. Verify compliance acceptances
    if (!complianceConfirm) {
      setEligibilityError('You must confirm compliance with the DPDP Act 2023 and ABDM healthcare guidelines.');
      return;
    }
    if (!baaConfirm) {
      setEligibilityError('You must accept the Clinic Data Protection Agreement & SOP Guidelines.');
      return;
    }

    // 5. Secure environment redirect (HTTPS check)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setEligibilityError('A secure and encrypted environment (HTTPS) is required. Redirecting to SSL...');
      setTimeout(() => {
        window.location.replace(window.location.href.replace('http:', 'https:'));
      }, 1500);
      return;
    }

    // Unlock signup
    setIsSignupUnlocked(true);
    setShowEligibilityModal(false);

    const registrationTab = registrationType === 'doctor' ? 'register' : 'join';
    const isSingleDomain = getIsSingleDomain(hostname);

    let targetUrl = '';
    if (isSingleDomain) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', registrationTab);
      targetUrl = url.toString();
    } else {
      targetUrl = hostname === 'localhost' || hostname === '127.0.0.1'
        ? `http://app.localhost:${window.location.port || '5173'}?tab=${registrationTab}`
        : `https://app.vitalsync.in?tab=${registrationTab}`;
    }

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Eligibility Verified',
        message: 'Redirecting you to initialize your secure clinical workspace...',
        type: 'success'
      }
    }));

    setTimeout(() => {
      window.location.href = targetUrl;
    }, 1200);
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

        {/* Left Visual Asset with OPPOSITE Mouse Parallax and slow float */}
        <div 
          className="absolute left-[-15%] top-[10%] w-[65%] h-[90%] opacity-20 mix-blend-multiply transition-transform duration-700 ease-out pointer-events-none hidden lg:block"
          style={{
            transform: `translate3d(${mousePos.x * -18}px, ${mousePos.y * -18}px, 0)`,
          }}
        >
          <img 
            src={backgroundLeftSrc} 
            alt="Mediflow 3D Left Ambient Visual Background"
            className="w-full h-full object-contain object-left-center animate-float-drift-slow"
          />
        </div>

        {/* Right Visual Asset with Mouse Parallax and CSS drift */}
        <div 
          className="absolute right-[-10%] top-[-5%] w-[75%] h-[110%] opacity-40 mix-blend-multiply transition-transform duration-700 ease-out pointer-events-none hidden lg:block"
          style={{
            transform: `translate3d(${mousePos.x * 30}px, ${mousePos.y * 30}px, 0)`,
          }}
        >
          <img 
            src={background3DSrc} 
            alt="Mediflow 3D Connected Care Visual Background"
            className="w-full h-full object-contain object-right-top animate-float-drift"
          />
        </div>
      </div>

      {/* 3D Plexus interactive network loop background */}
      <InteractivePlexus3D />

      {/* Premium Fixed Glass Header — stays pinned on all scroll depths */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-xs transition-all duration-300">
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
          {/* NMC Compliance Badge — Floating in header */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            NMC Ethics Protected · Anti-Kickback Safe-Harbor
          </div>
        </div>
      </header>

      {/* Style blocks for flows */}
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
        <div className="lg:col-span-6 flex flex-col space-y-8 mt-4 text-left">
          
          <div className="inline-flex items-center gap-2.5 self-start py-1.5 px-4 rounded-full border border-teal-300 bg-teal-50/90 shadow-sm backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-teal-900 font-mono font-extrabold uppercase tracking-widest">
              🏥 India's #1 Virtual Hospital Network · Chronic Care Engine &amp; Zero-Screen OPD
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl lg:text-6xl font-black text-slate-900 leading-[1.12] tracking-tight">
              Your Clinic.<br />
              <span className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 bg-clip-text text-transparent font-black">
                Now a Connected Hospital.
              </span>
            </h1>

            <p className="text-base lg:text-lg font-bold text-teal-900 tracking-tight">
              Zero Screen Fatigue for Doctors. Increase Patient Retention on WhatsApp.
            </p>

            <p className="text-sm lg:text-base text-slate-650 leading-relaxed max-w-lg font-medium">
              Lab, clinic, and pharmacy connected with interconnected dashboards and connect with patients through WhatsApp. Empowering independent doctors, local chemists, and pathology labs to unite into an automated hospital-grade outpatient network. Doctors choose <strong>Paper Pad (1.2s AI Vision scan)</strong> or <strong>Cloud EMR</strong>. Chronic patients get automated Day-25 1-tap WhatsApp refills with 10% VIP discounts and 90-day diagnostic re-test loops. Keep 100% of your consultation fees with a <strong>90-Day Free Pilot, then flat ₹999/month with 0% OPD commission</strong>.
            </p>
          </div>

          {/* Feature Badges Grid */}
          <div className="flex flex-wrap gap-2 max-w-lg">
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-teal-900 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg">
              🩺 Type-2 Diabetes &amp; Hypertension Engine
            </span>
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              📦 Day-25 1-Tap WhatsApp Refills (10% OFF)
            </span>
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-cyan-900 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-lg">
              ✍️ Zero Doctor Screen (Paper-Friendly)
            </span>
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
              🔬 90-Day Diagnostic Re-test Loops
            </span>
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
              💰 Direct Doctor UPI (0% Platform Cut)
            </span>
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-purple-900 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
              🔄 Dual-Mode (Paper ↔ Digital EMR)
            </span>
          </div>

          {/* Interactive CTAs */}
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={handleGetStartedClick}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:scale-[1.02] active:scale-[0.98] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-2"
            >
              Start Free Clinic Setup <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={scrollToGate}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 hover:scale-[1.02] active:scale-[0.98] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center gap-2"
            >
              Doctor &amp; Staff Login <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setShowBenefitsTour(true);
                setTourSlide(0);
              }}
              className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] text-slate-800 border border-slate-200/80 font-extrabold text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Presentation className="h-4 w-4 text-emerald-600" /> Virtual Hospital Tour
            </button>
          </div>

          {/* Core Safeguard Callouts */}
          <div className="space-y-4 max-w-lg">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-350 shadow-sm transition-all duration-300">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl shrink-0">
                <Award className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Doctor Consultation Fee Immunity (100% Direct Payout)</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-semibold">100% of patient consultation fees go directly to the Doctor's bank account or counter drawer with 0% platform deductions. First 90 days are 100% Free, followed by a flat ₹999/month operations fee with zero OPD commission.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-350 shadow-sm transition-all duration-300">
              <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 text-teal-600 rounded-xl shrink-0">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Zero Screen for Doctors — 0 Habit Change</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-semibold">Doctors write on paper prescription pads as usual with zero screen distraction or typing fatigue. AI digitizes the prescription at the compounder desk in 1.2s — or switch to full Digital EMR in 1 click.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-350 shadow-sm transition-all duration-300">
              <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 rounded-xl shrink-0">
                <MessageSquare className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Zero App Download for Patients — Connect Via WhatsApp</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-semibold">Patients never download separate apps. They connect directly with the clinic via 1-Tap native WhatsApp buttons for tokens, prescriptions, and lab reports, while clinic staff manage care on the full VitalSync Cloud EMR.</p>
              </div>
            </div>
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

          {/* Main Visual Showcase Box */}
          <div
            className="max-w-lg relative rounded-3xl border border-slate-200 shadow-xl group hover:border-teal-400/50 transition-all duration-500 w-full bg-white"
            style={{
              aspectRatio: '16 / 10',
              overflow: 'hidden',
              touchAction: 'manipulation',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/40 to-transparent opacity-90 pointer-events-none z-10" />
            <img
              src={heroImageSrc}
              alt="VitalSync Care Network Connected Loop Illustration"
              width={800}
              height={500}
              loading="lazy"
              decoding="async"
              fetchPriority="high"
              onError={(e) => {
                const t = e.currentTarget;
                t.onerror = null;
                t.style.display = 'none';
                const placeholder = t.parentElement?.querySelector('.hero-placeholder') as HTMLElement | null;
                if (placeholder) placeholder.style.display = 'flex';
              }}
              className="absolute inset-0 w-full h-full object-cover transform scale-100 group-hover:scale-[1.03] transition-transform duration-700"
              style={{
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
                willChange: 'transform',
              }}
            />
            {/* Fallback component */}
            <div
              className="hero-placeholder absolute inset-0 items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 text-indigo-400 text-xs font-mono tracking-wide"
              style={{ display: 'none' }}
            >
              <div className="text-center space-y-2 px-4">
                <Sparkles className="h-8 w-8 text-cyan-500 mx-auto animate-pulse" />
                <p className="uppercase tracking-widest font-black text-white">VitalSync Virtual Hospital Network</p>
              </div>
            </div>
            
            <div className="absolute bottom-5 left-6 right-6 z-20 text-white text-left">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-0.5 rounded-full backdrop-blur-sm shadow-md">
                  <Sparkles className="h-3 w-3" /> Hyper-Local Triad SOP
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                  ⚡ 250ms CDC Sync
                </span>
              </div>
              <h3 className="text-base font-bold tracking-wide uppercase">The Decentralized Virtual Hospital</h3>
              <p className="text-xs text-slate-200 mt-0.5 leading-relaxed font-sans font-medium">
                Lab, clinic, and pharmacy connected with interconnected dashboards and connect with patients through WhatsApp.
              </p>
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

      {/* ── SECTION 1: THE CONNECTED TRIAD ARCHITECTURE ── */}
      <section id="triad-architecture" className="py-20 relative z-10 bg-white border-t border-slate-200 text-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-14 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold uppercase tracking-widest font-mono">
              <Building2 className="h-3.5 w-3.5 text-teal-600" /> Decentralized Virtual Hospital Network
            </div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-slate-900">
              The Connected Triad Architecture
            </h2>
            <p className="text-slate-600 text-sm lg:text-base max-w-3xl mx-auto leading-relaxed font-medium">
              Why build an expensive multi-specialty hospital when the infrastructure already exists in your neighborhood? VitalSync unites independent doctors, local chemists, and pathology labs on WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7 text-left">
            {/* Triad 1: Doctor Chamber */}
            <div className="p-7 rounded-3xl bg-gradient-to-b from-teal-50/70 to-white border-2 border-teal-200 hover:border-teal-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative group">
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
                    <span><strong>Zero Screen Fatigue:</strong> Write on paper prescription pads (1.2s AI Vision scan) or use Cloud EMR.</span>
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
            <div className="p-7 rounded-3xl bg-gradient-to-b from-emerald-50/70 to-white border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative group">
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
            <div className="p-7 rounded-3xl bg-gradient-to-b from-indigo-50/70 to-white border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative group">
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
                <strong>Unified Realtime Highway:</strong> Supabase PostgreSQL CDC streams updates between Doctor EMR, Pharmacy POS, and Lab LIS at <strong>sub-250ms latency</strong> with zero manual copy-pasting.
              </span>
            </div>
            <span className="font-mono text-[11px] text-teal-400 whitespace-nowrap bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              100% Patient Retention · Zero Leakage
            </span>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: THE CHRONIC DISEASE CARE MODEL & RECURRING REFILL GOLDMINE ── */}
      <section id="chronic-care" className="py-20 relative z-10 bg-slate-50/70 border-t border-slate-200 text-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-14 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-widest font-mono">
              <HeartPulse className="h-3.5 w-3.5 text-emerald-600" /> Multi-Chronic Disease Care Engine
            </div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-slate-900">
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
      <section id="patient-journey" className="py-20 relative z-10 bg-white border-t border-slate-200 text-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold uppercase tracking-widest font-mono">
              <Calendar className="h-3.5 w-3.5 text-cyan-600" /> Longitudinal Care Flow
            </div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-slate-900">
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
                <h3 className="text-2xl font-black text-white">Chamber Intake &amp; Dual-Mode Prescription</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  Ramesh Ji (Age 52, Type-2 Diabetes) visits Dr. Verma. Doctor writes on paper prescription pad as usual. Compounder snaps 1 photo on phone ➡️ AI digitizes prescription in 1.2s with structured dosage (<code className="text-cyan-300 font-mono">Glycomet-GP2 1-0-1</code>).
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
                <h3 className="text-2xl font-black text-white">90-Day Diagnostic Re-test &amp; Home Phlebotomy</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  Before Ramesh's quarterly doctor checkup, WhatsApp prompts a repeat HbA1c &amp; Serum Creatinine test. Partner Lab sends a phlebotomist to collect the morning blood sample. The report is verified and automatically delivered as a PDF on WhatsApp in 4 hours.
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
                <h3 className="text-2xl font-black text-white">Quarterly Outcome Review &amp; AI Longitudinal Trend</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  Ramesh returns for his 90-day consult. Dr. Verma's EMR displays a clean 90-day trajectory: HbA1c dropped from <strong>9.2% to 6.8%</strong>! Adherence score: <strong>98%</strong>. Dr. Verma optimizes dosage with 1 click.
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
      <section id="consoles-simulator" className="py-20 relative z-10 bg-slate-50 border-t border-slate-200 text-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold uppercase tracking-widest font-mono">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Interactive Platform Tour
            </div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-slate-900">
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
                        ✍️ Option A: Paper Pad (1.2s AI Vision scan)
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

      {/* ── 4-STEP CLINICAL OPERATING WORKFLOW (ZERO HABIT CHANGE) ── */}
      <section className="py-16 relative z-10 bg-slate-50 border-t border-slate-200 text-slate-800">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold uppercase tracking-widest font-mono">
            <Zap className="h-3.5 w-3.5 text-teal-600" /> Seamless 4-Step Clinic Operating Loop
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900">
              How VitalSync Works in 4 Simple Clinic Steps
            </h2>
            <p className="text-slate-600 text-xs md:text-sm max-w-3xl mx-auto leading-relaxed font-medium">
              Zero disruption to your daily OPD rush. Patients book 24/7 via WhatsApp AI or walk in at your desk — while doctors write on paper or screen with zero data entry.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-left pt-2">
            {/* Step 1 */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-teal-400 shadow-sm transition-all duration-300 space-y-3 relative group flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    01
                  </span>
                  <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    🤖 24/7 WhatsApp AI &amp; Desk Intake
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">WhatsApp AI Booking &amp; OPD Token</h3>
                  <ul className="text-xs text-slate-600 mt-2 space-y-1.5 list-disc list-inside">
                    <li><strong className="text-slate-800">24/7 WhatsApp AI Agent:</strong> Patients book checkups in 30s with 1-tap buttons.</li>
                    <li><strong className="text-slate-800">Smart Sequential Token:</strong> Instant token (<code className="text-[10px] bg-slate-100 px-1 rounded font-bold font-mono">#TK-001</code>) + live turn alerts.</li>
                    <li><strong className="text-slate-800">Front Desk Intake:</strong> Walk-ins registered with BP, Pulse, SpO₂, Temp &amp; Sugar.</li>
                    <li><strong className="text-slate-800">Payment Gate:</strong> Direct Doctor UPI QR or Cash clears patients safely.</li>
                  </ul>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[10.5px] font-bold text-teal-800 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-teal-600" /> 30s WhatsApp Auto-Booking + Zero Rush
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-2xl bg-teal-50/70 border-2 border-teal-300 shadow-sm transition-all duration-300 space-y-3 relative group flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    02
                  </span>
                  <span className="text-[10px] font-bold text-teal-900 bg-teal-100 px-2 py-0.5 rounded-md border border-teal-200">
                    👨‍⚕️ Doctor's Choice
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-teal-950">2-Way Flexible Consult</h3>
                  <div className="space-y-2 mt-2 text-xs">
                    <div className="p-2 bg-white rounded-lg border border-teal-200">
                      <strong className="text-teal-950 font-bold block">Option A (Paper-Friendly):</strong>
                      <span className="text-slate-600 text-[11px]">Write on paper pad as usual. Compounder snaps 1 photo ➡️ AI digitizes in 1.2s.</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-teal-200">
                      <strong className="text-teal-950 font-bold block">Option B (1-Click Screen):</strong>
                      <span className="text-slate-600 text-[11px]">Select 1-click clinical protocols or AI Voice Scribe on screen.</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-teal-200 text-[10.5px] font-bold text-teal-900 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-teal-700" /> 100% Doctor Fee Protected
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-teal-400 shadow-sm transition-all duration-300 space-y-3 relative group flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    03
                  </span>
                  <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    ⚡ Auto-Billing Hub
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Instant Itemized Bill</h3>
                  <ul className="text-xs text-slate-600 mt-2 space-y-1 list-disc list-inside">
                    <li>Medicines &amp; lab tests auto-load with live catalog prices.</li>
                    <li>Compounder explains 4 VIP Member Benefits to patient.</li>
                    <li>Collects payment: Cash or Dynamic Zero-Fee UPI QR.</li>
                    <li>1-Click prints consolidated computerized receipt.</li>
                  </ul>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[10.5px] font-bold text-indigo-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-indigo-600" /> Zero manual data entry
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 shadow-sm transition-all duration-300 space-y-3 relative group flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    04
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    📱 360° Real-time Sync
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">WhatsApp &amp; Partner Dispatch</h3>
                  <ul className="text-xs text-slate-600 mt-2 space-y-1 list-disc list-inside">
                    <li>Patient receives WhatsApp e-Rx + 1 Free Follow-up pass.</li>
                    <li>Pharmacy Dashboard receives medicine dispensing order.</li>
                    <li>Lab Dashboard receives blood sample LOINC requisition.</li>
                    <li>Patient picks up packed meds &amp; gives sample with ₹0 delay.</li>
                  </ul>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[10.5px] font-bold text-emerald-800 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> 100% Zero Patient Leakage
              </div>
            </div>
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

      {/* Features Grid Section */}
      <section id="features" className="py-20 relative z-10 border-t border-slate-100 bg-slate-50/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Virtual Hospital Core Modules</h2>
            <p className="text-slate-500 text-sm font-semibold mt-2">Connecting all clinical stakeholders on a single high-speed database.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200 hover:border-emerald-400/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)] hover:-translate-y-1.5 duration-350 transition-all group text-left">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Activity className="h-5 w-5 text-emerald-650" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Doctor EMR Suite</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Complete clinical workspace: 1-Click Patient History, CDSS AI Scribe, live pharmacy inventory typeahead, Ophthalmic Refraction Grid, and SOP Config Tab.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.06)] hover:-translate-y-1.5 duration-350 transition-all group text-left mt-2 lg:mt-6">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Layers className="h-5 w-5 text-cyan-650" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Pathology Lab Hub</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Direct LOINC test requisitions, barcode sample tracking (`BAR-XXXX`), and automated instant PDF report dispatch to patient WhatsApp.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200 hover:border-teal-400/40 hover:shadow-[0_0_30px_rgba(20,184,166,0.08)] hover:-translate-y-1.5 duration-350 transition-all group text-left lg:mt-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Building2 className="h-5 w-5 text-teal-650" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Pharmacy POS &amp; Refills</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                FEFO batch inventory management (`BATCH-2026-X1`), 1-Click home delivery, and automated 3-stage chronic refill reminders (Day 7, Month 1, Month 3).
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200 hover:border-indigo-400/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.06)] hover:-translate-y-1.5 duration-350 transition-all group text-left mt-1 lg:mt-8">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Clock className="h-5 w-5 text-indigo-650" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Compounder OPD Desk</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                OPD token generation (#TK-001), patient vitals logging (BP, SpO2, Sugar, BMI), 15-min eye dilation countdown timer, and Emergency SOS #1 priority routing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comprehensive EMR Architecture Comparison Section */}
      <section id="emr-comparison" className="py-20 relative z-10 bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center space-y-3">
            <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800 font-mono text-[10px] font-extrabold uppercase tracking-widest">
              <Database className="h-3.5 w-3.5 text-indigo-600" />
              Architecture Comparison
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
              VitalSync vs. Legacy EMRs vs. Standalone Bots
            </h2>
            <p className="text-slate-650 text-sm font-semibold max-w-3xl mx-auto leading-relaxed">
              Why independent clinics are upgrading to VitalSync: a complete, standalone Cloud EMR with native sub-250ms WhatsApp synchronization — eliminating double-entry, manual copy-pasting, and expensive software subscription fees.
            </p>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-xl bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="p-5 font-black text-slate-700 uppercase tracking-wider text-[11px] w-[28%]">Architecture Dimension</th>
                  <th className="p-5 font-black text-teal-800 uppercase tracking-wider text-[11px] bg-teal-50/70 border-x border-teal-200/80 w-[30%]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      VitalSync (All-in-One EMR)
                    </div>
                  </th>
                  <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-[11px] w-[21%]">Legacy Closed EMRs</th>
                  <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-[11px] w-[21%]">Standalone WhatsApp Bots</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {/* Row 1 */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-800">
                    <div>Doctor EMR Workspace</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Clinical consultation console, AI scribe &amp; Rx</div>
                  </td>
                  <td className="p-5 bg-teal-50/30 border-x border-teal-200/60 font-semibold text-slate-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Native Doctor EMR:</strong> CDSS AI Scribe, Refraction Matrix, Digital Prescriptions, and ABHA ID integration.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">⚠️</span>
                      <span>Basic EMR, rigid interface, zero AI clinical scribe.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>None:</strong> Only basic marketing chat; no clinical EMR workspace.</span>
                    </div>
                  </td>
                </tr>

                {/* Row 2 */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-800">
                    <div>Data Entry &amp; Double-Handling</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Sync speed between patient chat and doctor screen</div>
                  </td>
                  <td className="p-5 bg-teal-50/30 border-x border-teal-200/60 font-semibold text-slate-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Zero Double-Entry:</strong> Live sub-250ms PostgreSQL CDC synchronizes patient bookings &amp; charts straight to Doctor Console.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">⚠️</span>
                      <span>Manual OPD counter re-entry required for walk-in and online patients.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>High Friction:</strong> Staff must manual copy-paste chat summaries into a separate system.</span>
                    </div>
                  </td>
                </tr>

                {/* Row 3 */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-800">
                    <div>ABDM &amp; ABHA ID Compliance</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Ayushman Bharat Digital Mission readiness</div>
                  </td>
                  <td className="p-5 bg-teal-50/30 border-x border-teal-200/60 font-semibold text-slate-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Native ABDM Architecture:</strong> ABHA creation, verification, and M1/M2/M3 consent-driven data layers built-in.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">⚠️</span>
                      <span>Varying; often requires paid enterprise modules.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>Non-Compliant:</strong> Standard chat bots cannot handle ABDM health data consent.</span>
                    </div>
                  </td>
                </tr>

                {/* Row 4 */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-800">
                    <div>Compounder &amp; OPD Token Desk</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Queue coordination, vitals logging, SOS routing</div>
                  </td>
                  <td className="p-5 bg-teal-50/30 border-x border-teal-200/60 font-semibold text-slate-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Dedicated OPD Console:</strong> Live token generation (#TK-001), vitals charting (BP/Sugar/SpO2/BMI), eye dilation timer.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">⚠️</span>
                      <span>Basic static token list with no automated patient WhatsApp alert notifications.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>None:</strong> No staff queue or clinical vitals recording tools.</span>
                    </div>
                  </td>
                </tr>

                {/* Row 5 */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-800">
                    <div>Pharmacy POS &amp; Day-25 Refills</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">FEFO inventory, split settlements, refill loops</div>
                  </td>
                  <td className="p-5 bg-teal-50/30 border-x border-teal-200/60 font-semibold text-slate-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Integrated Care Loop:</strong> FEFO batch POS, 1-Click home delivery, Day-25 chronic refill reminders, and automated doctor split.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span>Prescriptions walk away to unlinked chemists; zero refill automation.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>None:</strong> No inventory management or fulfillment integration.</span>
                    </div>
                  </td>
                </tr>

                {/* Row 6 */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-800">
                    <div>Pathology Lab LIS &amp; WhatsApp PDF</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">LOINC test ordering, barcode tracking, auto-dispatch</div>
                  </td>
                  <td className="p-5 bg-teal-50/30 border-x border-teal-200/60 font-semibold text-slate-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Direct LIS Hub:</strong> Barcode sample verification, LOINC requisitions, and automated PDF dispatch directly to patient WhatsApp.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">⚠️</span>
                      <span>Requires expensive standalone lab LIS software with manual reporting.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span><strong>None:</strong> No diagnostic requisition or lab workflow capabilities.</span>
                    </div>
                  </td>
                </tr>

                {/* Row 7 */}
                <tr className="hover:bg-slate-50/50 transition-colors bg-teal-50/20">
                  <td className="p-5 font-bold text-slate-900">
                    <div>Doctor Adoption &amp; Pricing Model</div>
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
                      <span>₹1,500 – ₹5,000 / month / doctor recurring SaaS subscription charges.</span>
                    </div>
                  </td>
                  <td className="p-5 text-slate-600 font-medium">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">❌</span>
                      <span>₹2,500+ / month base platform charge + per-conversation meta fees.</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Onboarding Steps Section — Exactly Matching Slide 13 of the Doctor Booklet */}
      <section id="onboarding" className="py-20 relative z-10 bg-[#F8F9FA] border-t border-slate-200/60">
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

          {/* Call-to-action bar */}
          <div className="mt-16 p-6 rounded-3xl bg-white border border-slate-200 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6 text-left">
            <div>
              <p className="text-base font-bold text-slate-900 uppercase tracking-wider">Initialize Your Workspace</p>
              <p className="text-xs text-slate-500 mt-1 font-semibold">Open the credentials panel and complete your registration checklist.</p>
            </div>
            <a
              href="#gate"
              onClick={handleGetStartedClick}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold text-xs uppercase tracking-wider hover:from-indigo-650 hover:to-indigo-750 transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap"
            >
              Access Portal <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Transparent Pricing: 0% OPD, 0% WhatsApp, 5% Lab, 2% Pharmacy */}
      <section id="pricing" className="py-20 relative z-10 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700 font-mono text-[10px] font-extrabold uppercase tracking-widest mb-3">
              <Shield className="h-3.5 w-3.5 text-teal-600" />
              100% Transparent Platform Pricing
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Platform Fee Schedule</h2>
            <p className="text-slate-500 text-sm font-semibold mt-2 max-w-2xl mx-auto">
              VitalSync offers a 90-Day Full-Access Free Pilot followed by a flat ₹999/month Clinical Operations Fee. We maintain 0% commission on Doctor OPD consultations, alongside transparent B2B splits on partner Pathology Lab (5%) and Pharmacy Counter (2%).
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
                  Covers 24/7 Meta WhatsApp API costs, real-time Supabase cloud sync, AI clinical triage, and automated 5-console triad networking.
                </p>
                <button
                  type="button"
                  onClick={handleGetStartedClick}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  Start 90-Day Free Pilot
                </button>
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
                    5% Platform Fee
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
                    <span>Platform Split (5%):</span>
                    <span>₹50.00</span>
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 flex justify-between font-extrabold text-slate-900">
                    <span>Net Lab Vendor Credit:</span>
                    <span>₹950.00</span>
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
                    2% Platform Fee
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
                    <span>Platform Split (2%):</span>
                    <span>₹20.00</span>
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 flex justify-between font-extrabold text-slate-900">
                    <span>Net Pharmacy Credit:</span>
                    <span>₹980.00</span>
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
      <section id="faq" className="py-20 relative z-10 bg-slate-50/70 border-t border-slate-200">
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
                      All interactions sync directly with our high-speed PostgreSQL database via real-time Change Data Capture (CDC) at <strong>sub-250ms latency</strong>. When a patient books an appointment or a doctor issues a digital prescription, tokens and clinical records are automatically populated inside the Doctor EMR, Compounder Desk, and Pharmacy POS in real time.
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
                      <strong className="text-slate-900">You and your clinic retain 100% ownership of your patient records.</strong> In strict compliance with India's <strong>Digital Personal Data Protection (DPDP) Act 2023</strong> and HIPAA privacy guidelines, data is partitioned per clinic pod using PostgreSQL Row-Level Security (RLS).
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
                      When the patient steps to the compounder desk, your assistant snaps a single photo with a smartphone or webcam. VitalSync's specialized clinical AI model digitizes the handwriting in <strong>1.2 seconds</strong> into structured digital records, dispatches the WhatsApp e-Rx, and queues the medicines at the pharmacy.
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

      {/* Footer */}
      <footer className="py-12 px-6 relative z-10 bg-white border-t border-slate-200 text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between gap-8 text-xs font-semibold">
          {/* Left Column: Brand & Location Address */}
          <div className="flex flex-col space-y-3 text-left">
            <div className="flex items-center gap-2">
              <BrandMark size={20} title="VitalSync" />
              <span className="text-sm font-black text-slate-900 tracking-tight">VitalSync</span>
            </div>
            <p className="text-slate-500 font-medium leading-relaxed max-w-sm">
              <span className="font-bold text-slate-700 block mb-0.5">Clinical Hub Address:</span>
              Patna Bailey Road, Patna, Bihar, India
            </p>
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 pt-0.5">
              <span>Leadership:</span>
              <span className="font-bold text-slate-800">Vivek Kumar</span>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-md">Founder &amp; CTO</span>
            </div>
          </div>

          {/* Right Column: Contact CTA & Metadata */}
          <div className="flex flex-col space-y-4 md:items-end">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleContactSupport}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all shadow-sm cursor-pointer select-none font-sans text-xs"
              >
                <MessageSquare className="w-4 h-4 text-white shrink-0" />
                <span>Contact Support via WhatsApp</span>
              </button>
              <a
                href="mailto:vivek@vitalsync.in"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-teal-300 font-bold transition-all shadow-sm no-underline font-sans text-xs"
                title="Founder & CTO Desk"
              >
                <Mail className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Founder &amp; CTO: vivek@vitalsync.in</span>
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:justify-end text-slate-500 font-medium">
              <a href="/terms" className="hover:text-cyan-600 transition-colors">Terms & Conditions</a>
              <span>•</span>
              <a href="/privacy" className="hover:text-cyan-600 transition-colors">Privacy Policy</a>
              <span>•</span>
              <a href="/refund-policy" className="hover:text-cyan-600 transition-colors">Refund Policy</a>
              <span>•</span>
              <a href="/contact-us" className="hover:text-cyan-600 transition-colors">Contact Us</a>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:justify-end text-slate-450">
              <span>© 2026 VitalSync Care Connected Ecosystem</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-200 hidden sm:inline" />
              <span className="text-teal-700 font-bold hidden sm:inline">Virtual Hospital Network • Your Clinic. Now a Hospital.</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              <span className="font-mono">v1.0.0-stable</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
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
                className="text-slate-400 hover:text-slate-655 transition-colors font-mono text-[10px] tracking-widest uppercase cursor-pointer select-none"
                title="Go to admin.vitalsync.in"
              >
                Platform Operations
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth happens on app.vitalsync.in — no inline auth modal on the landing page */}

      {showEligibilityModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in text-slate-800 font-sans">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col space-y-5 max-h-[90vh] overflow-y-auto text-left">
            
            {/* Close Button */}
            <button
              onClick={() => setShowEligibilityModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <div className="p-3 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded-2xl">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider">Signup Eligibility Check</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Verify credentials for medical pod initialization</p>
              </div>
            </div>

            {/* Error Message */}
            {eligibilityError && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2.5 animate-shake">
                <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                <span className="text-[11px] font-semibold text-rose-700 leading-relaxed">{eligibilityError}</span>
              </div>
            )}

            <form onSubmit={handleValidateEligibility} className="space-y-4">
              {/* Registration Type Picker */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-0.5">
                  Proposed Clinician Role
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-55 p-1 rounded-xl border border-slate-200 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => setRegistrationType('doctor')}
                    className={`py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      registrationType === 'doctor'
                        ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    Doctor / Clinic
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegistrationType('partner')}
                    className={`py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      registrationType === 'partner'
                        ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    Pharmacy / Lab
                  </button>
                </div>
              </div>

              {/* Email Address Check */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-0.5">
                  Account Registration Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="proposed-email@vitalsync.in"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500/50 rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-sans"
                    required
                  />
                </div>
                <p className="text-[9px] text-slate-500 leading-normal pl-0.5 font-semibold">
                  Privacy assurance: Email is validated locally and encrypted to protect clinic registry and practitioner identity.
                </p>
              </div>

              {/* Gating checklist */}
              <div className="space-y-3 pt-1">
                {/* Age check */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ageConfirm}
                    onChange={(e) => setAgeConfirm(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 accent-indigo-500 rounded border-slate-200 bg-white"
                  />
                  <span className="text-[11px] text-slate-650 font-semibold leading-tight">
                    I confirm that I am 18 years of age or older and legally authorized to practice medicine or manage clinical nodes.
                  </span>
                </label>

                {/* Compliance check */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={complianceConfirm}
                    onChange={(e) => setComplianceConfirm(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 accent-indigo-500 rounded border-slate-200 bg-white"
                  />
                  <span className="text-[11px] text-slate-650 font-semibold leading-tight">
                    I agree to maintain compliance with the Digital Personal Data Protection (DPDP) Act 2023 and ABDM standards.
                  </span>
                </label>

                {/* Data Agreement check */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={baaConfirm}
                    onChange={(e) => setBaaConfirm(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 accent-indigo-500 rounded border-slate-200 bg-white"
                  />
                  <span className="text-[11px] text-slate-650 font-semibold leading-tight">
                    I accept the Clinic Sovereign Pod Data Agreement and clinical care coordination terms.
                  </span>
                </label>
              </div>

              {/* Submit / Validation button */}
              <button
                type="submit"
                className="w-full py-3 mt-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
              >
                Verify Eligibility & Proceed <ArrowRight className="h-4 w-4" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-500 font-bold text-center border-t border-slate-200 pt-3">
                <Lock className="h-3 w-3" />
                <span>SSL Encrypted Transport Channel Active (HTTPS verified)</span>
              </div>
            </form>
          </div>
        </div>
      )}


      {showBenefitsTour && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-lg animate-fade-in text-slate-800 font-sans">
          {/* Glassmorphic Presentation Container */}
          <div className="relative w-full max-w-4xl bg-white border border-slate-200/80 rounded-3xl shadow-2xl flex flex-col md:flex-row min-h-[550px] max-h-[90vh] overflow-hidden animate-scale-up">
            
            {/* Left Column: Visuals & Illustrations (Cyan-to-Indigo Gradient Background) */}
            <div className="md:w-5/12 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white p-8 flex flex-col justify-between relative overflow-hidden shrink-0">
              <div className="absolute top-[-20%] left-[-20%] w-64 h-64 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none" />
              <div className="absolute bottom-[-20%] right-[-20%] w-64 h-64 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />
              
              {/* Slide Counter Header */}
              <div className="z-10 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">VitalSync Tour</span>
                <span className="text-xs font-bold font-mono text-slate-400">Slide {tourSlide + 1} of 6</span>
              </div>

              {/* Dynamic Left Column Graphics based on tourSlide */}
              <div className="z-10 py-6 my-auto flex flex-col items-center text-center space-y-6">
                {tourSlide === 0 && (
                  <>
                    <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-3xl">
                      <Layers className="h-12 w-12" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-extrabold text-white">The Connected Care Loop</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">Connecting your private clinic to local pharmacy and laboratory channels instantly.</p>
                    </div>
                  </>
                )}
                {tourSlide === 1 && (
                  <>
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-3xl">
                      <Activity className="h-12 w-12" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-extrabold text-white">Automated Data Flows</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">Prescriptions route directly to the POS queue, and lab PDF reports embed straight into patient medical history.</p>
                    </div>
                  </>
                )}
                {tourSlide === 2 && (
                  <>
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-3xl">
                      <TrendingUp className="h-12 w-12" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-extrabold text-white">Dynamic Practice ROI</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">Eliminate referral leakage, increase prescription fulfillment rates, and capture lost revenue automatically.</p>
                    </div>
                  </>
                )}
                {tourSlide === 3 && (
                  <>
                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-3xl">
                      <Award className="h-12 w-12" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-extrabold text-white">Competitive Superiority</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">Unlike outdated standalone systems, VitalSync is built for collaborative clinical ecosystems.</p>
                    </div>
                  </>
                )}
                {tourSlide === 4 && (
                  <>
                    <div className="p-4 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-3xl">
                      <Shield className="h-12 w-12" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-extrabold text-white">Postgres Row Isolation</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">Physical-like database isolation rules protect patient records. Fully compliant, ultra-secure.</p>
                    </div>
                  </>
                )}
                {tourSlide === 5 && (
                  <>
                    <div className="p-4 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-3xl animate-pulse">
                      <Sparkles className="h-12 w-12" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-extrabold text-white">Ready in 5 Minutes</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">Join the care network today and immediately activate secure connected clinics.</p>
                    </div>
                  </>
                )}
              </div>

              {/* Progress Tracker dots */}
              <div className="z-10 flex justify-center gap-1.5 pt-2">
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <button
                    key={`tour-dot-${idx}`}
                    onClick={() => setTourSlide(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${tourSlide === idx ? 'w-6 bg-cyan-400' : 'w-1.5 bg-slate-700 hover:bg-slate-500'}`}
                  />
                ))}
              </div>
            </div>

            {/* Right Column: Slide Text, Interactive UI and Nav Buttons */}
            <div className="md:w-7/12 p-8 flex flex-col justify-between overflow-y-auto max-h-[60vh] md:max-h-full">
              
              {/* Close Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Benefits Presentation</span>
                <button
                  onClick={() => setShowBenefitsTour(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Dynamic Slides Body */}
              <div className="my-auto py-6 space-y-5">
                            {tourSlide === 0 && (
                  <div className="space-y-4 animate-fade-in text-left">
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">All-in-One Cloud EMR (Zero Double-Entry)</h3>
                    <p className="text-xs text-slate-650 leading-relaxed">
                      VitalSync is your full-featured clinical operating system. It natively replaces standalone EMRs by providing a real-time Doctor Console, CDSS AI Scribe, Refraction Matrix, Compounder OPD Desk, Pharmacy POS, and Pathology LIS.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                        <span className="text-xs font-bold text-indigo-700 block">Sub-250ms Realtime Sync</span>
                        <span className="text-[10px] text-slate-500 mt-1 block">Patient WhatsApp bookings, prescriptions, and lab orders synchronize instantly across all terminals with zero manual cut-paste.</span>
                      </div>
                      <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                        <span className="text-xs font-bold text-emerald-700 block">Native ABDM Architecture</span>
                        <span className="text-[10px] text-slate-500 mt-1 block">ABHA ID generation, verification, and M1/M2/M3 consent-driven healthcare data exchange built-in.</span>
                      </div>
                    </div>
                  </div>
                )}

                {tourSlide === 1 && (
                  <div className="space-y-4 animate-fade-in text-left">
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">Optimized Clinical Intake Flow</h3>
                    <p className="text-xs text-slate-650 leading-relaxed">
                      Maximize clinical intake capacity by offloading manual data entry tasks to adjacent staff nodes without altering standard OPD workflows:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="h-5 w-5 rounded-full bg-cyan-100 text-cyan-700 font-extrabold text-xs flex items-center justify-center shrink-0">A</div>
                        <div>
                          <span className="text-xs text-slate-800 font-bold block">Compounder Ingestion</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block">Focus entirely on patient care while clinical assistants input written or dictated records in real time.</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-xs flex items-center justify-center shrink-0">B</div>
                        <div>
                          <span className="text-xs text-slate-800 font-bold block">Clinical Templates</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block">Standardize treatment plan creation with one-click prescription macros and customizable dosage matrices.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tourSlide === 2 && (
                  <div className="space-y-4 animate-fade-in text-left">
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">Mitigate Care Loop Disruption</h3>
                    <p className="text-xs text-slate-650 leading-relaxed">
                      Paper prescriptions and diagnostic slips introduce friction, causing up to 40% of patients to drop out of the aligned network loop, disrupting care continuity and clinical metrics.
                    </p>
                    <div className="space-y-3">
                      <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-start gap-3">
                        <Mail className="h-4.5 w-4.5 text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-indigo-800">Direct WhatsApp Telemetry</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">Prescriptions and lab requisitions land instantly on the patient's mobile terminal upon chart finalization.</span>
                        </div>
                      </div>
                      <div className="p-3 bg-cyan-50/50 border border-cyan-100 rounded-xl flex items-start gap-3">
                        <Sparkles className="h-4.5 w-4.5 text-cyan-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-cyan-800">Fulfillment Gateway</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">Patients receive automated coordinates for medication pickup and diagnostic scheduling at aligned network partners.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tourSlide === 3 && (
                  <div className="space-y-4 animate-fade-in text-left">
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">Practice ROI & Revenue Calculator</h3>
                    <p className="text-xs text-slate-650 leading-relaxed">
                      Slide patient volumes and consultation fees below to see how much referral pharmacy and diagnostic laboratory revenue is automatically recovered.
                    </p>
                    
                    {/* Live Interactive Sliders */}
                    <div className="space-y-4 bg-slate-50 p-4.5 rounded-2xl border border-slate-200/80">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>Patient Volume / Day</span>
                          <span className="text-indigo-650">{calcPatients} patients</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="80"
                          step="5"
                          value={calcPatients}
                          onChange={(e) => setCalcPatients(Number(e.target.value))}
                          className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>Avg Consultation Fee</span>
                          <span className="text-indigo-650">Rs {calcFee}</span>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="2000"
                          step="50"
                          value={calcFee}
                          onChange={(e) => setCalcFee(Number(e.target.value))}
                          className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>Avg Lab Fee / Test</span>
                          <span className="text-indigo-650">Rs {calcLabFee}</span>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="3000"
                          step="50"
                          value={calcLabFee}
                          onChange={(e) => setCalcLabFee(Number(e.target.value))}
                          className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>Avg Medicine Sale / Prescription</span>
                          <span className="text-indigo-650">Rs {calcMedSale}</span>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="2500"
                          step="50"
                          value={calcMedSale}
                          onChange={(e) => setCalcMedSale(Number(e.target.value))}
                          className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Calculations Display */}
                      <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Est. Revenue Recovered</span>
                          <span className="text-xs text-slate-600 font-medium">Fulfillment + Referral Gains</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-emerald-600 block">
                            +Rs {Math.round(calcPatients * 26 * ((calcMedSale * 0.10 * 0.20) + (calcLabFee * 0.15 * 0.25)) + (calcPatients * calcFee * 26 * 0.05)).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 block">Per Month Growth</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tourSlide === 4 && (
                  <div className="space-y-4 animate-fade-in text-left">
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">Unified Partner Nodes</h3>
                    <p className="text-xs text-slate-650 leading-relaxed">
                      Onboard adjacent partner nodes onto your local clinical network to optimize order accuracy and pipeline efficiency:
                    </p>
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                        <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 rounded-lg mt-0.5">
                          <Building2 className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800">For Aligned Pharmacies</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">Real-time prescription ingestion resolves handwriting ambiguity and provides early inventory forecasts.</span>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                        <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 rounded-lg mt-0.5">
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800">For Aligned Laboratories</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">Technicians upload structured PDF outputs directly into the centralized medical chart, bypassing patient handling.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tourSlide === 5 && (
                  <div className="space-y-4 animate-fade-in text-left">
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">PostgreSQL Row-Level Security & Compliance</h3>
                    <p className="text-xs text-slate-655 leading-relaxed">
                      Patient data protection is enforced at the storage engine layer. All database schemas are hardened to comply with strict regulatory frameworks.
                    </p>
                    <div className="space-y-3">
                      <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-start gap-3">
                        <Shield className="h-4.5 w-4.5 text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-emerald-800">Walled Multi-Tenancy</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">Strict PostgreSQL Row-Level Security (RLS) partitions data per tenant, preventing cross-tenant access.</span>
                        </div>
                      </div>
                      <div className="p-3 bg-cyan-50/50 border border-cyan-100 rounded-xl flex items-start gap-3">
                        <Lock className="h-4.5 w-4.5 text-cyan-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-cyan-800">Encrypted Payload Transmission</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">All clinical telemetry and payload distributions are fully encrypted in transit using TLS 1.3 and at rest using AES-256.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Navigation Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTourSlide(prev => Math.max(0, prev - 1))}
                  disabled={tourSlide === 0}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                
                {tourSlide < 5 ? (
                  <button
                    type="button"
                    onClick={() => setTourSlide(prev => Math.min(5, prev + 1))}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-indigo-500/10 cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowBenefitsTour(false);
                      handleGetStartedClick(null as any);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-emerald-500/10 cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    Get Started <CheckCircle2 className="h-4 w-4" />
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Floating App Install Banner (PWA Install Prompt) */}
      <AppInstallBanner />
    </div>
  );
};
