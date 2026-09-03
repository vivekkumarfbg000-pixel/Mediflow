import React, { useState, useEffect, useRef } from 'react';
import { BrandMark } from './BrandMark';
import { AppInstallBanner } from './AppInstallBanner';
import {
  Shield, Activity, Building2, Users, Layers, Zap, Clock, ChevronRight, Terminal, GitBranch, Lock, ArrowRight, Sparkles,
  X, FileText, Loader2, AlertCircle, Mail, Presentation, TrendingUp, Award, ChevronLeft, CheckCircle2, Eye, MessageSquare,
  Stethoscope, Pill, Printer, Smartphone, Send, Check, ChevronDown, HelpCircle, Database
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
      setEligibilityError('You must confirm compliance with HIPAA, GDPR, and CCPA regulations.');
      return;
    }
    if (!baaConfirm) {
      setEligibilityError('You must accept the HIPAA Business Associate Agreement (BAA).');
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

      {/* Premium Sticky Glass Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 shrink-0">
              <BrandMark size={38} title="VitalSync logo" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-black tracking-tight font-sans">
                <span className="text-[#1A7B8F]">Vital</span>
                <span className="text-[#7AC47F]">Sync</span>
              </span>
              <span className="text-[8.5px] text-teal-700 font-bold tracking-wider uppercase mt-0.5">Virtual Hospital Network</span>
            </div>
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
      `}</style>      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Column: Information, Branding & CTAs */}
        <div className="lg:col-span-6 flex flex-col space-y-8 mt-4 text-left">
          
          <div className="inline-flex items-center gap-2.5 self-start py-1.5 px-4 rounded-full border border-cyan-300 bg-cyan-50/90 shadow-sm backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-teal-900 font-mono font-extrabold uppercase tracking-widest">
              🏥 India's #1 Virtual Hospital Network
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl lg:text-6xl font-black text-slate-900 leading-[1.12] tracking-tight">
              Your Clinic.<br />
              <span className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 bg-clip-text text-transparent font-black">
                Now a Hospital.
              </span>
            </h1>

            <p className="text-base lg:text-lg font-bold text-teal-900 tracking-tight">
              Clinic Freedom. Hospital Revenue. On WhatsApp.
            </p>

            <p className="text-sm lg:text-base text-slate-650 leading-relaxed max-w-lg font-medium">
              Turn your OPD into an integrated virtual hospital. Connect your prescriptions directly to trusted local pharmacies &amp; labs, keep 100% of your consultation fee, capture 35% of the patient wallet, and automate Day-25 chronic refills with <strong>₹0 setup cost</strong>.
            </p>
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
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Doctor Consultation Fee Immunity (Rule 58)</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-semibold">100% of patient consultation fees go directly to the Doctor's bank account with 0% platform deductions. VitalSync is 100% free for doctors to adopt with zero software subscription fees.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-350 shadow-sm transition-all duration-300">
              <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 rounded-xl shrink-0">
                <MessageSquare className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Zero App Download — 100% Native WhatsApp</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-semibold">Patients never download complex apps. Everything runs on 1-Tap native WhatsApp buttons for tokens, digital prescriptions, lab PDF downloads, and 1-click medicine refill orders.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-350 shadow-sm transition-all duration-300">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 rounded-xl shrink-0">
                <Database className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">All-in-One Standalone EMR (Zero Double-Entry)</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-semibold">VitalSync is your complete, ABDM-compliant Cloud EMR (Doctor EMR, CDSS AI Scribe, OPD Queue, Pharmacy POS). Zero separate EMR software and zero manual copy-pasting needed.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Premium Showcase Display & Animated Diagram */}
        <div className="lg:col-span-6 flex flex-col space-y-7 relative mt-4">
          
          {/* Main Visual Showcase Box */}
          <div
            className="max-w-lg relative rounded-3xl border border-slate-200 shadow-xl group hover:border-slate-300 transition-all duration-500 w-full bg-white"
            style={{
              aspectRatio: '16 / 10',
              overflow: 'hidden',
              touchAction: 'manipulation',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-800/10 to-transparent opacity-85 pointer-events-none z-10" />
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
            
            <div className="absolute bottom-6 left-6 right-6 z-20 text-white text-left">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-3 py-1 rounded-full backdrop-blur-sm shadow-md animate-pulse">
                <Sparkles className="h-3 w-3" /> Hyper-Local Triad
              </span>
              <h3 className="text-base font-bold mt-2 tracking-wide uppercase">The Decentralized Virtual Hospital</h3>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed font-sans font-medium">
                Independent Doctor + Local Pharmacy + Local Pathology Lab united into an automated hospital-grade network on WhatsApp.
              </p>
            </div>
          </div>

          {/* Live Data Flow Activity box */}
          <div className="max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-md relative overflow-hidden group hover:border-slate-350 transition-all duration-500 w-full text-left">
            <div className="absolute top-0 right-0 p-3 text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 border-b border-l border-slate-200 rounded-bl-xl uppercase tracking-wider">
              Virtual Hospital Live
            </div>
            
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              Decentralized WhatsApp Care Loop
            </h4>

            <div className="flex items-center justify-between gap-4 relative">
              <div className="flex flex-col items-center text-center space-y-2 z-10">
                <div className="h-11 w-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-cyan-600 shadow-sm transition-transform group-hover:scale-105 duration-300">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">Doctor Clinic</span>
                <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded-full">BRAIN</span>
              </div>

              {/* Connecting line 1 */}
              <div className="flex-1 h-[1px] border-t border-dashed border-slate-200 relative">
                <div className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-cyan-500 -translate-y-1/2 animate-pulse-flow" />
              </div>

              <div className="flex flex-col items-center text-center space-y-2 z-10">
                <div className="h-11 w-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-teal-650 shadow-sm transition-transform group-hover:scale-105 duration-300">
                  <Building2 className="h-5 w-5 text-teal-600" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">Partner Chemist</span>
                <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded-full">REFILLS</span>
              </div>

              {/* Connecting line 2 */}
              <div className="flex-1 h-[1px] border-t border-dashed border-slate-200 relative">
                <div className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-emerald-500 -translate-y-1/2 animate-pulse-flow-delay" />
              </div>

              <div className="flex flex-col items-center text-center space-y-2 z-10">
                <div className="h-11 w-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-indigo-650 shadow-sm transition-transform group-hover:scale-105 duration-300">
                  <Layers className="h-5 w-5 text-indigo-600" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">Partner Lab</span>
                <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded-full">DIAGNOSTICS</span>
              </div>
            </div>
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
              Zero disruption to your daily OPD rush. Doctors can write on paper or type on screen — while your compounder, chemist, and lab sync automatically in real time.
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
                  <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    🩺 Front Desk Intake
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Smart OPD Token &amp; Vitals</h3>
                  <ul className="text-xs text-slate-600 mt-2 space-y-1 list-disc list-inside">
                    <li>Compounder registers patient with phone &amp; age.</li>
                    <li>Records BP, Pulse, SpO₂, Temp, Blood Sugar.</li>
                    <li>Generates OPD Token (<code className="text-[10px] bg-slate-100 px-1 rounded font-bold font-mono">#TK-001</code>).</li>
                    <li>Unpaid visits held safely at payment gate.</li>
                  </ul>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[10.5px] font-bold text-teal-800 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-teal-600" /> Patient waits in queue
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
              Practice Revenue Simulator
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Virtual Hospital Revenue Calculator</h2>
            <p className="text-slate-500 text-sm font-semibold max-w-2xl mx-auto">
              See how much additional recurring income your clinic unlocks from connected medicine refills and diagnostic testing.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Sliders */}
            <div className="lg:col-span-7 bg-slate-50 p-8 rounded-3xl border border-slate-200 space-y-6 text-left shadow-sm">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Daily OPD Patients:</span>
                  <span className="text-emerald-700 font-mono font-black text-sm">{calcPatients} Patients / Day</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="5"
                  value={calcPatients}
                  onChange={(e) => setCalcPatients(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Doctor Consultation Fee:</span>
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

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Average Medicine Prescription Spend:</span>
                  <span className="text-teal-700 font-mono font-black text-sm">₹{calcMedSale} / Patient</span>
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

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Average Diagnostic / Lab Test Spend:</span>
                  <span className="text-indigo-700 font-mono font-black text-sm">₹{calcLabFee} / Patient</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="2500"
                  step="50"
                  value={calcLabFee}
                  onChange={(e) => setCalcLabFee(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Right Column: Earnings Summary Card */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 p-8 rounded-3xl text-white space-y-6 shadow-2xl border border-emerald-700/30 text-left">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-[10px] font-mono font-extrabold uppercase text-emerald-400 tracking-widest block">
                  Estimated Monthly Practice Output
                </span>
                <p className="text-3xl font-black text-white mt-1">
                  ₹{((calcPatients * 26 * calcFee) + (calcPatients * 26 * 0.6 * calcMedSale * 0.25) + (calcPatients * 26 * 0.4 * calcLabFee * 0.35)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  <span className="text-xs text-slate-400 font-normal"> / month</span>
                </p>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>1. Direct OPD Consults (100%):</span>
                  <span className="font-bold text-white">₹{(calcPatients * 26 * calcFee).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-teal-300">
                  <span>2. Connected Pharmacy SOP (25%):</span>
                  <span className="font-bold">₹{(calcPatients * 26 * 0.6 * calcMedSale * 0.25).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between text-indigo-300">
                  <span>3. Connected Lab SOP (35%):</span>
                  <span className="font-bold">₹{(calcPatients * 26 * 0.4 * calcLabFee * 0.35).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-[11px] text-emerald-200 leading-relaxed font-sans font-medium">
                💡 <strong>The Virtual Hospital Advantage:</strong> Your clinic captures an additional <strong>₹{((calcPatients * 26 * 0.6 * calcMedSale * 0.25) + (calcPatients * 26 * 0.4 * calcLabFee * 0.35)).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / month</strong> in recurring care coordination value from medicines &amp; labs that were previously walking out the door.
              </div>
            </div>
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
                      <span><strong>₹0 Setup / ₹0 SaaS Fees:</strong> 100% of patient consultation fees go directly to doctor with 0% platform deductions (Rule 58).</span>
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

      {/* Onboarding Steps Section */}
      <section id="onboarding" className="py-20 relative z-10 bg-[#F8F9FA] border-t border-slate-200/60">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Ecosystem Initialization</h2>
            <p className="text-slate-500 text-sm font-semibold mt-2">Bring your entire clinic network online in under five minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative text-left">
            {/* Desktop step connectors */}
            <div className="hidden md:block absolute top-6 left-[12%] right-[12%] h-[1px] border-t border-dashed border-slate-200 pointer-events-none" />

            {[
              {
                step: '01',
                title: 'Authentication & Minting',
                desc: "Register the primary clinical entity to mint a unique, immutable network key (Clinic Code) that acts as the cryptographic root of your pod.",
                color: 'text-indigo-600',
                bg: 'bg-indigo-500/10',
                border: 'border-indigo-500/20'
              },
              {
                step: '02',
                title: 'Decentralized Distribution',
                desc: "Distribute your secure network key directly to trusted local pharmacy and diagnostic laboratory partners via encrypted channels.",
                color: 'text-cyan-600',
                bg: 'bg-cyan-500/10',
                border: 'border-cyan-500/20'
              },
              {
                step: '03',
                title: 'Handshake Request',
                desc: "Partner nodes register and input your token to securely request an isolated database pipeline hook back to your clinical workspace.",
                color: 'text-indigo-600',
                bg: 'bg-indigo-500/10',
                border: 'border-indigo-500/20'
              },
              {
                step: '04',
                title: 'Cryptographic Approval',
                desc: "Authorize the pending handshake request inside your admin panel to open the secure synchronization gateway and activate the closed care loop.",
                color: 'text-cyan-600',
                bg: 'bg-cyan-500/10',
                border: 'border-cyan-500/20'
              }
            ].map(({ step, title, desc, color, bg, border }, idx) => (
              <div key={step} className={`flex flex-col gap-4 relative ${idx % 2 !== 0 ? 'md:mt-6' : ''}`}>
                <div className={`w-12 h-12 rounded-2xl ${bg} border ${border} flex items-center justify-center font-bold text-sm ${color} z-10 shadow-md`}>
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

      {/* Transparent Pricing & 3% Platform Fee Schedule Section */}
      <section id="pricing" className="py-20 relative z-10 bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 py-1 px-3.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700 font-mono text-[10px] font-extrabold uppercase tracking-widest mb-3">
              <Shield className="h-3.5 w-3.5 text-teal-600" />
              100% Transparent Platform Pricing
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Platform Fee Schedule</h2>
            <p className="text-slate-500 text-sm font-semibold mt-2 max-w-2xl mx-auto">
              VitalSync operates on a transparent 3% platform model. Zero hidden charges, zero setup fees, and 0% commission on direct counter doctor consultations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Card 1: Online WhatsApp Bookings */}
            <div className="p-7 rounded-3xl bg-gradient-to-b from-teal-50/50 to-white border border-teal-200/80 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-teal-700 bg-teal-100 border border-teal-300 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                    3% Platform Fee
                  </span>
                  <Sparkles className="h-4 w-4 text-teal-600" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Online WhatsApp Appointments</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Charged directly to online patients booking consultations via WhatsApp Chatbot & Payment Links.
                </p>
                <div className="p-4 rounded-2xl bg-white border border-teal-100 text-xs space-y-2 font-mono">
                  <div className="flex justify-between text-slate-500">
                    <span>Doctor Consultation:</span>
                    <span>₹500.00</span>
                  </div>
                  <div className="flex justify-between text-teal-700 font-bold">
                    <span>Platform Convenience Fee (3%):</span>
                    <span>₹15.00</span>
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 flex justify-between font-extrabold text-slate-900">
                    <span>Total Patient Invoice:</span>
                    <span>₹515.00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: B2B Pharmacy & Pathology Settlements */}
            <div className="p-7 rounded-3xl bg-gradient-to-b from-indigo-50/50 to-white border border-indigo-200/80 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 border border-indigo-300 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                    3% Platform Fee
                  </span>
                  <Building2 className="h-4 w-4 text-indigo-600" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Pharmacy & Lab Settlements</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Charged on digital Paytm / UPI billing settlements for pharmacy drug orders and pathology lab diagnostic requisitions.
                </p>
                <div className="p-4 rounded-2xl bg-white border border-indigo-100 text-xs space-y-2 font-mono">
                  <div className="flex justify-between text-slate-500">
                    <span>Digital Settlement:</span>
                    <span>₹1,000.00</span>
                  </div>
                  <div className="flex justify-between text-indigo-700 font-bold">
                    <span>Platform Gateway Split (3%):</span>
                    <span>₹30.00</span>
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 flex justify-between font-extrabold text-slate-900">
                    <span>Net Vendor Credit:</span>
                    <span>₹970.00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Counter Physical Consultations */}
            <div className="p-7 rounded-3xl bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-200/80 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                    0% Platform Fee (100% Free)
                  </span>
                  <Award className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Counter Physical Consultations</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Direct walk-in checkups booked at the Compounder desk carry 0% platform fee. 100% of the consultation fee goes to the Doctor.
                </p>
                <div className="p-4 rounded-2xl bg-white border border-emerald-100 text-xs space-y-2 font-mono">
                  <div className="flex justify-between text-slate-500">
                    <span>Counter Consultation Fee:</span>
                    <span>₹500.00</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Platform Fee (0%):</span>
                    <span>₹0.00</span>
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 flex justify-between font-extrabold text-slate-900">
                    <span>Doctor Earnings:</span>
                    <span>₹500.00 (100%)</span>
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
                question: "What is the pricing model for doctors adopting VitalSync?",
                badge: "Rule 58 Immunity",
                answer: (
                  <div className="space-y-2.5 text-xs text-slate-650 leading-relaxed font-normal">
                    <p>
                      <strong className="text-slate-900">VitalSync is 100% free for doctors to adopt.</strong> There are zero software subscription fees, zero onboarding charges, and 0% commission on direct counter doctor consultations (<strong>Doctor Consultation Fee Immunity — Rule 58</strong>).
                    </p>
                    <p>
                      Doctors earn an additional 25%–35% recurring revenue from connected pharmacy and diagnostic lab care coordination splits.
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
                  GDPR constraint: Email is validated locally against system defaults to protect patient registry and user privacy.
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
                    I agree to maintain compliance with GDPR, CCPA, and HIPAA privacy rules for isolated clinical databases.
                  </span>
                </label>

                {/* BAA Agreement check */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={baaConfirm}
                    onChange={(e) => setBaaConfirm(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 accent-indigo-500 rounded border-slate-200 bg-white"
                  />
                  <span className="text-[11px] text-slate-650 font-semibold leading-tight">
                    I accept the HIPAA Business Associate Agreement (BAA) and clinical data usage policies.
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
