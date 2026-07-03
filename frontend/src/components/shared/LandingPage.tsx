import React, { useState, useEffect, useRef } from 'react';
import { AuthGateway } from './AuthGateway';
import { BrandMark } from './BrandMark';
import {
  Shield, Activity, Building2, Users, Layers, Zap, Clock, ChevronRight, Terminal, GitBranch, Lock, ArrowRight, Sparkles,
  X, FileText, Loader2, AlertCircle, Mail, Presentation, TrendingUp, Award, ChevronLeft, CheckCircle2
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { StateHealingEngine } from '../../services/autoHealerAgent';

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

        // Connect nodes forming visual mesh network
        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const scale2 = 200 / p2.z;
          const projX2 = (p2.x - width / 2) * scale2 + width / 2;
          const projY2 = (p2.y - height / 2) * scale2 + height / 2;

          const dx = projX - projX2;
          const dy = projY - projY2;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            const alpha = ((130 - dist) / 130) * 0.15 * Math.min(scale, scale2);
            ctx.beginPath();
            ctx.moveTo(projX, projY);
            ctx.lineTo(projX2, projY2);
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.lineWidth = 0.6 * Math.min(scale, scale2);
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

export const LandingPage: React.FC<LandingPageProps> = ({ onAuthSuccess }) => {
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [isSignupUnlocked, setIsSignupUnlocked] = useState(false);
  const [preselectedSignupTab, setPreselectedSignupTab] = useState<'signin' | 'register' | 'join' | 'ops'>('signin');
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [isSigningInDemo, setIsSigningInDemo] = useState(false);
  const [showBenefitsTour, setShowBenefitsTour] = useState(false);
  const [tourSlide, setTourSlide] = useState(0);
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


  const handleDemoSignUpInstant = () => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const dashboardUrl = hostname === 'localhost' || hostname === '127.0.0.1'
      ? `http://app.localhost:${window.location.port || '5173'}?demo=true`
      : 'https://app.vitalsync.in?demo=true';
    window.location.href = dashboardUrl;
  };

  // Eligibility Form States
  const [ageConfirm, setAgeConfirm] = useState(false);
  const [complianceConfirm, setComplianceConfirm] = useState(false);
  const [baaConfirm, setBaaConfirm] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [registrationType, setRegistrationType] = useState<'doctor' | 'partner'>('doctor');
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  // Smooth scroll helper for landing CTAs
  const scrollToGate = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowAuthGate(true);
    setPreselectedSignupTab('signin');
    setTimeout(() => {
      const gate = document.getElementById('gate');
      if (gate) {
        gate.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const handleGetStartedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSignupUnlocked) {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const dashboardUrl = hostname === 'localhost' || hostname === '127.0.0.1'
        ? `http://app.localhost:${window.location.port || '5173'}?tab=register`
        : 'https://app.vitalsync.in?tab=register';
      window.location.href = dashboardUrl;
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
    const demoEmails = ['doctor@mediflow.com', 'labtech@mediflow.com', 'pharmacist@mediflow.com', 'owner@mediflow.com'];
    if (demoEmails.includes(normalizedEmail)) {
      setEligibilityError('An account with this email address already exists in the system. Please Sign In instead.');
      return;
    }

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
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const dashboardUrl = hostname === 'localhost' || hostname === '127.0.0.1'
      ? `http://app.localhost:${window.location.port || '5173'}?tab=${registrationTab}`
      : `https://app.vitalsync.in?tab=${registrationTab}`;

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Eligibility Verified',
        message: 'Redirecting you to initialize your secure clinical workspace...',
        type: 'success'
      }
    }));

    setTimeout(() => {
      window.location.href = dashboardUrl;
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
              <span className="text-[8.5px] text-slate-500 font-semibold tracking-wide mt-0.5">Integrated Clinical Network</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleDemoSignUpInstant}
              className="px-4.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Demo Sandbox
            </button>
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

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Column: Information, Branding & CTAs */}
        <div className="lg:col-span-6 flex flex-col space-y-8 mt-4 text-left">
          
          <div className="inline-flex items-center gap-2.5 self-start py-1 px-3.5 rounded-full border border-cyan-200 bg-cyan-50/60 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-600 animate-pulse" />
            <span className="text-[10px] text-cyan-700 font-mono font-extrabold uppercase tracking-widest">
              Integrated Clinical Network
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 leading-[1.1] tracking-tight">
              Clinical software for<br />
              <span className="bg-gradient-to-r from-cyan-600 to-emerald-600 bg-clip-text text-transparent italic font-extrabold font-serif">
                small clinic networks
              </span>
            </h1>

            <p className="text-sm lg:text-base text-slate-650 leading-relaxed max-w-lg font-medium">
              VitalSync connects your clinic, pharmacy, and pathology lab under a single secure care loop. 
              Prescriptions flow directly to the pharmacist. Lab reports land in the doctor's queue. 
              Billing split calculations resolve instantly.
            </p>
          </div>

          {/* Interactive CTAs */}
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={handleGetStartedClick}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 hover:scale-[1.02] active:scale-[0.98] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center gap-2"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
                const dashboardUrl = hostname === 'localhost' || hostname === '127.0.0.1'
                  ? `http://app.localhost:${window.location.port || '5173'}`
                  : 'https://app.vitalsync.in';
                window.location.href = dashboardUrl;
              }}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 hover:scale-[1.02] active:scale-[0.98] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg shadow-violet-500/20 cursor-pointer flex items-center gap-2"
            >
              Console Login <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setShowBenefitsTour(true);
                setTourSlide(0);
              }}
              className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] text-slate-800 border border-slate-200/80 font-extrabold text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Presentation className="h-4 w-4 text-indigo-500" /> Interactive Pitch Tour
            </button>
          </div>

          {/* Core Safeguard Callouts */}
          <div className="space-y-4 max-w-lg">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-350 shadow-sm transition-all duration-300">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 rounded-xl shrink-0">
                <Lock className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Row-Level Database Isolation</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-semibold">Each clinic's records are completely isolated at the Postgres database level using strict RLS. Zero cross-tenant data leaks.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-350 shadow-sm transition-all duration-300">
              <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 rounded-xl shrink-0">
                <GitBranch className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Unified Role-Aware Dashboards</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-semibold">Doctor, compounder, lab tech, pharmacist, and administrator — each sees a customized desktop interface operating on a single code repository.</p>
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
                <p className="uppercase tracking-widest font-black text-white">VitalSync Care Ecosystem</p>
              </div>
            </div>
            
            <div className="absolute bottom-6 left-6 right-6 z-20 text-white text-left">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-950/70 border border-cyan-500/30 px-3 py-1 rounded-full backdrop-blur-sm shadow-md animate-pulse">
                <Sparkles className="h-3 w-3" /> Unified Care Loop
              </span>
              <h3 className="text-base font-bold mt-2 tracking-wide uppercase">Clinic, Pharmacy, and Lab Ecosystem</h3>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed font-sans font-medium">
                Experience seamless split-billing and direct clinical data synchronizations in one consolidated workspace.
              </p>
            </div>
          </div>

          {/* Live Data Flow Activity box */}
          <div className="max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-md relative overflow-hidden group hover:border-slate-350 transition-all duration-500 w-full text-left">
            <div className="absolute top-0 right-0 p-3 text-[9px] font-mono font-bold text-cyan-600 bg-cyan-50 border-b border-l border-slate-200 rounded-bl-xl uppercase tracking-wider">
              Network Pulse Active
            </div>
            
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              Real-time synchronization loop
            </h4>

            <div className="flex items-center justify-between gap-4 relative">
              <div className="flex flex-col items-center text-center space-y-2 z-10">
                <div className="h-11 w-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-cyan-600 shadow-sm transition-transform group-hover:scale-105 duration-300">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">Doctor</span>
                <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded-full">ACTIVE</span>
              </div>

              {/* Connecting line 1 */}
              <div className="flex-1 h-[1px] border-t border-dashed border-slate-200 relative">
                <div className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-cyan-500 -translate-y-1/2 animate-pulse-flow" />
              </div>

              <div className="flex flex-col items-center text-center space-y-2 z-10">
                <div className="h-11 w-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-indigo-650 shadow-sm transition-transform group-hover:scale-105 duration-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">Pharmacy</span>
                <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded-full">SYNCED</span>
              </div>

              {/* Connecting line 2 */}
              <div className="flex-1 h-[1px] border-t border-dashed border-slate-200 relative">
                <div className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-indigo-500 -translate-y-1/2 animate-pulse-flow-delay" />
              </div>

              <div className="flex flex-col items-center text-center space-y-2 z-10">
                <div className="h-11 w-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-indigo-650 shadow-sm transition-transform group-hover:scale-105 duration-300">
                  <Layers className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">Pathology</span>
                <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded-full">READY</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-20 relative z-10 border-t border-slate-100 bg-slate-50/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">System Core Capabilities</h2>
            <p className="text-slate-500 text-sm font-semibold mt-2">Four role-specific interfaces operating on a single database.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200 hover:border-indigo-400/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.06)] hover:-translate-y-1.5 duration-350 transition-all group text-left">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Activity className="h-5 w-5 text-indigo-650" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Doctor Console</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Patient queue lists, prescription editors, lab requisitions, and WhatsApp sandbox simulator for instant patient contact.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.06)] hover:-translate-y-1.5 duration-350 transition-all group text-left mt-2 lg:mt-6">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Layers className="h-5 w-5 text-cyan-650" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Pathology Lab</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Incoming diagnostic requests, digital report upload interfaces, and automated injection directly into patient medical charts.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200 hover:border-indigo-400/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.06)] hover:-translate-y-1.5 duration-350 transition-all group text-left lg:mt-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-5 w-5 text-indigo-650" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Pharmacy POS</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Receives prescriptions in real-time, manages inventory, and handles split-payment disbursements between the clinic and pharmacy.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.06)] hover:-translate-y-1.5 duration-350 transition-all group text-left mt-1 lg:mt-8">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Terminal className="h-5 w-5 text-cyan-650" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Autonomous Healer</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Background telemetry agent detecting state drifts, retrying interrupted database connections, and managing UI integrity 24/7.
              </p>
            </div>
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
                title: 'Doctor Registration',
                desc: "Create an account on the Doctor tab. Copy your uniquely generated Clinic Code (e.g., MF-KANKAR10) from the panel.",
                color: 'text-indigo-600',
                bg: 'bg-indigo-500/10',
                border: 'border-indigo-500/20'
              },
              {
                step: '02',
                title: 'Distribute Code',
                desc: 'Provide your custom Clinic Code to your adjacent pharmacy partners and diagnostic lab technicians.',
                color: 'text-cyan-600',
                bg: 'bg-cyan-500/10',
                border: 'border-cyan-500/20'
              },
              {
                step: '03',
                title: 'Partners Join',
                desc: "Partners register using the Partner tab, inputting your Clinic Code to request a database connection.",
                color: 'text-indigo-600',
                bg: 'bg-indigo-500/10',
                border: 'border-indigo-500/20'
              },
              {
                step: '04',
                title: 'Authorized Approval',
                desc: 'Approve incoming partner requests in your Clinic settings to instantly activate the closed prescription loop.',
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

      {/* Footer */}
      <footer className="py-8 px-6 relative z-10 bg-white border-t border-slate-200 text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold">
          <span>© 2026 VitalSync Care Connected Ecosystem</span>
          <div className="flex items-center gap-4">
            <span className="text-cyan-700 font-semibold italic">Integrated Clinical Network</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            <span className="font-mono">v1.0.0-stable</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            <button
              type="button"
              onClick={() => {
                const adminUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                  ? `http://admin.localhost:${window.location.port || '5173'}`
                  : 'https://admin.vitalsync.in';
                window.location.href = adminUrl;
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors font-mono text-[10px] tracking-widest uppercase cursor-pointer select-none"
              title="Go to admin.vitalsync.in"
            >
              Platform Operations
            </button>
          </div>
        </div>
      </footer>

      {showAuthGate && (
        <div 
          onClick={() => setShowAuthGate(false)}
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in text-slate-800 font-sans cursor-default"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col space-y-5 max-h-[90vh] overflow-y-auto"
          >
            {/* Close Button */}
            <button
              onClick={() => setShowAuthGate(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-800 transition-colors cursor-pointer z-50"
            >
              <X className="h-5 w-5" />
            </button>

            <AuthGateway 
              onAuthSuccess={onAuthSuccess} 
              allowSignup={isSignupUnlocked}
              initialSignupTab={preselectedSignupTab}
            />
          </div>
        </div>
      )}

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

      {isSigningInDemo && (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in text-white font-sans">
          <div className="flex flex-col items-center space-y-6 text-center">
            <Loader2 className="h-12 w-12 text-indigo-500 animate-spin" />
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-100 tracking-wide">Initializing Demo Sandbox</h3>
              <p className="text-xs text-slate-300 max-w-sm">
                Signing you in automatically as <span className="text-indigo-450 font-extrabold">Dr. Vivek Kumar</span> to showcase the clinical dashboard...
              </p>
            </div>
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
                    key={idx}
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
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">Eliminate Administrative Friction</h3>
                    <p className="text-xs text-slate-650 leading-relaxed">
                      Healthcare is collaborative, but clinic software is typically isolated. VitalSync securely connects your clinic to local pharmacies and laboratories. Prescriptions flow instantly, lab reports deliver straight to your screen, and patient communication is completely automated.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                        <span className="text-xs font-bold text-indigo-700 block">Seamless Loop</span>
                        <span className="text-[10px] text-slate-500 mt-1 block">Prescriptions, diagnostics, and bills resolve automatically.</span>
                      </div>
                      <div className="p-3.5 bg-cyan-50/50 border border-cyan-100 rounded-2xl">
                        <span className="text-xs font-bold text-cyan-700 block">Staff Delegation</span>
                        <span className="text-[10px] text-slate-500 mt-1 block">Custom interfaces allow assistants to handle data entry.</span>
                      </div>
                    </div>
                  </div>
                )}

                {tourSlide === 1 && (
                  <div className="space-y-4 animate-fade-in text-left">
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">Zero-Time Prescribing (The Compounder Handoff)</h3>
                    <p className="text-xs text-slate-650 leading-relaxed">
                      Doctors don't have time to act as data-entry clerks during a busy OPD. With VitalSync, you do not have to change how you work:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="h-5 w-5 rounded-full bg-cyan-100 text-cyan-700 font-extrabold text-xs flex items-center justify-center shrink-0">A</div>
                        <div>
                          <span className="text-xs text-slate-800 font-bold block">The Assistant Handoff</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block">You consult and write or dictate exactly as you always have. Your clinic assistant or compounder enters the details in 30 seconds.</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-xs flex items-center justify-center shrink-0">B</div>
                        <div>
                          <span className="text-xs text-slate-800 font-bold block">One-Click Clinical Templates</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block">If you prefer typing, use pre-made dosage templates (e.g. "Standard Follow-up") to prescribe in a single click.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tourSlide === 2 && (
                  <div className="space-y-4 animate-fade-in text-left">
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">Stop Patient & Referral Leakage</h3>
                    <p className="text-xs text-slate-650 leading-relaxed">
                      Currently, up to 40% of patients take your paper prescriptions or lab slips to unaligned, random entities, breaking their care continuity and leading to revenue loss.
                    </p>
                    <div className="space-y-3">
                      <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-start gap-3">
                        <Mail className="h-4.5 w-4.5 text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-indigo-800">Instant WhatsApp Delivery</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">Before the patient even leaves your desk, their digital prescription and lab orders land directly on their WhatsApp.</span>
                        </div>
                      </div>
                      <div className="p-3 bg-cyan-50/50 border border-cyan-100 rounded-xl flex items-start gap-3">
                        <Sparkles className="h-4.5 w-4.5 text-cyan-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-cyan-800">Direct Partner Pickup Options</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">The patient's WhatsApp message guides them: *"Your medications are prepared at [Your Partner Pharmacy]. Tap to confirm pickup or delivery."* They choose convenience.</span>
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
                          <span className="text-indigo-600">{calcPatients} patients</span>
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
                          <span className="text-indigo-600">Rs {calcFee}</span>
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
                          <span className="text-indigo-600">Rs {calcLabFee}</span>
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
                          <span className="text-indigo-600">Rs {calcMedSale}</span>
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
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">Mutual Benefits for Pharmacy & Lab Partners</h3>
                    <p className="text-xs text-slate-650 leading-relaxed">
                      Your local partners will eagerly onboard with you. The network delivers massive efficiency upgrades for them:
                    </p>
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                        <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 rounded-lg mt-0.5">
                          <Building2 className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800">For Your Partner Pharmacy</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">Prescriptions land digitally. No handwriting to decipher. Auto stock-alerts let them prepare alternatives if items are low.</span>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                        <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 rounded-lg mt-0.5">
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800">For Your Partner Laboratory</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">Technicians drag-and-drop the PDF report. It instantly populates in your doctor screen, eliminating patients carrying physical chits.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tourSlide === 5 && (
                  <div className="space-y-4 animate-fade-in text-left">
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">Absolute Data Privacy & Security</h3>
                    <p className="text-xs text-slate-650 leading-relaxed">
                      Patient medical confidentiality is paramount. VitalSync uses database-level security to ensure your practice remains private and compliant:
                    </p>
                    <div className="space-y-3">
                      <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-start gap-3">
                        <Shield className="h-4.5 w-4.5 text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-emerald-800">Walled Patient Databases</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">Each clinic's patient records are strictly walled off from other practices using database row-isolation rules.</span>
                        </div>
                      </div>
                      <div className="p-3 bg-cyan-50/50 border border-cyan-100 rounded-xl flex items-start gap-3">
                        <Lock className="h-4.5 w-4.5 text-cyan-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-cyan-800">HIPAA Compliant Transfer</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">All clinical transmissions and uploads are encrypted end-to-end to protect confidentiality.</span>
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

    </div>
  );
};
