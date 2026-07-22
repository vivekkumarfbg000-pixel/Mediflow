import React, { useState, useRef, useEffect } from 'react';
import { Printer, QrCode, Sparkles, Settings, Smartphone } from 'lucide-react';

interface ClinicPlacardGeneratorProps {
  activeWabaNumber?: string;
  clinicName?: string;
}

export const ClinicPlacardGenerator: React.FC<ClinicPlacardGeneratorProps> = ({
  activeWabaNumber = '+91 90000 00000',
  clinicName = 'VitalSync Smart Clinic'
}) => {
  const [phoneNumber, setPhoneNumber] = useState(activeWabaNumber.replace(/[^0-9+]/g, '') || '+919000000000');
  const [customClinicName, setCustomClinicName] = useState(clinicName);
  const [welcomeText, setWelcomeText] = useState('Hello VitalSync, I would like to check-in and register for my consultation. Please guide me through my ABHA onboarding.');
  const [themeColor, setThemeColor] = useState<'emerald' | 'blue' | 'indigo' | 'violet'>('emerald');
  const [showSettings, setShowSettings] = useState(false);
  const placardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeWabaNumber && activeWabaNumber !== '+91 90000 00000') {
      setPhoneNumber(activeWabaNumber.replace(/[^0-9+]/g, ''));
    }
  }, [activeWabaNumber]);

  useEffect(() => {
    if (clinicName) {
      setCustomClinicName(clinicName);
    }
  }, [clinicName]);

  // Generate wa.me link
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  const qrUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(welcomeText)}`;
  const qrCodeImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=0f172a&data=${encodeURIComponent(qrUrl)}`;

  // Handle printing
  const handlePrint = () => {
    const printContent = placardRef.current?.innerHTML;
    if (!printContent) return;

    // Create print-specific document styling
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.innerText = `
      @media print {
        body {
          background: white !important;
          color: black !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .no-print {
          display: none !important;
        }
        .print-container {
          width: 100vw !important;
          height: 100vh !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: white !important;
          padding: 40px !important;
          box-sizing: border-box !important;
        }
        .placard-border {
          border: 4px double #10b981 !important;
          padding: 40px !important;
          border-radius: 20px !important;
          max-width: 550px !important;
          text-align: center !important;
          box-shadow: none !important;
          background: white !important;
        }
      }
    `;
    document.head.appendChild(styleSheet);

    window.print();
    
    // Remove the style tag after printing to restore original interface styles
    document.head.removeChild(styleSheet);
  };

  const colors = {
    emerald: {
      primary: 'text-emerald-600',
      bg: 'bg-emerald-50/40',
      border: 'border-emerald-200/60',
      badge: 'bg-emerald-100 text-emerald-800',
      accent: 'emerald',
      gradient: 'from-emerald-500 to-teal-600',
      lightGlow: 'shadow-emerald-500/20'
    },
    blue: {
      primary: 'text-blue-600',
      bg: 'bg-blue-50/40',
      border: 'border-blue-200/60',
      badge: 'bg-blue-100 text-blue-800',
      accent: 'blue',
      gradient: 'from-blue-500 to-indigo-600',
      lightGlow: 'shadow-blue-500/20'
    },
    indigo: {
      primary: 'text-indigo-600',
      bg: 'bg-indigo-50/40',
      border: 'border-indigo-200/60',
      badge: 'bg-indigo-100 text-indigo-800',
      accent: 'indigo',
      gradient: 'from-indigo-500 to-purple-600',
      lightGlow: 'shadow-indigo-500/20'
    },
    violet: {
      primary: 'text-violet-600',
      bg: 'bg-violet-50/40',
      border: 'border-violet-200/60',
      badge: 'bg-violet-100 text-violet-800',
      accent: 'violet',
      gradient: 'from-violet-500 to-fuchsia-600',
      lightGlow: 'shadow-violet-500/20'
    }
  };

  const selectedColor = colors[themeColor];

  return (
    <div className="space-y-6">
      {/* Configuration & Action Card */}
      <div className="glass-panel p-5 bg-white border-slate-200/60 shadow-sm rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500 opacity-40" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <QrCode className="h-5 w-5 text-emerald-500 animate-pulse" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Walk-In WhatsApp Onboarding</h4>
              <p className="text-[10px] text-slate-600 font-medium font-sans">Print placard for front-desk zero-type patient registrations.</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-center"
              title="Customize settings"
            >
              <Settings className={`h-4 w-4 ${showSettings ? 'rotate-45' : ''} transition-transform duration-300`} />
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm cursor-pointer text-white-force bg-emerald-600-force"
            >
              <Printer className="h-3.5 w-3.5 text-white-force" />
              Print Placard
            </button>
          </div>
        </div>

        {/* Live configuration settings */}
        {showSettings && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in text-xs">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">Clinic Placard Name</label>
                <input
                  type="text"
                  value={customClinicName}
                  onChange={(e) => setCustomClinicName(e.target.value)}
                  className="w-full input-field py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 focus:ring-1 outline-none"
                  placeholder="e.g. VitalSync Prime Clinic"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">WhatsApp Business Phone</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full input-field py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 focus:ring-1 outline-none font-mono"
                  placeholder="e.g. +91 90000 00000"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">Prefilled WhatsApp Cue Message</label>
                <textarea
                  value={welcomeText}
                  onChange={(e) => setWelcomeText(e.target.value)}
                  rows={2}
                  className="w-full input-field py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 focus:ring-1 outline-none resize-none"
                  placeholder="Onboarding trigger message..."
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">Select Theme Color</label>
                <div className="flex gap-2">
                  {(['emerald', 'blue', 'indigo', 'violet'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setThemeColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${
                        themeColor === c ? 'border-slate-200 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                      }`}
                      style={{
                        backgroundColor:
                          c === 'emerald'
                            ? '#10b981'
                            : c === 'blue'
                            ? '#3b82f6'
                            : c === 'indigo'
                            ? '#6366f1'
                            : '#8b5cf6'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Outer wrapper holding physical print dimensions */}
      <div className="flex justify-center p-2">
        <div 
          ref={placardRef}
          className={`w-full max-w-[420px] bg-slate-50 border border-slate-200/80 rounded-[2.5rem] shadow-xl p-8 text-center relative overflow-hidden transition-all duration-300 hover:shadow-2xl`}
        >
          {/* Subtle grid watermark */}
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:20px_20px] opacity-35" />
          
          {/* Aesthetic outer neon borders */}
          <div className={`absolute top-0 left-0 w-full h-[5px] bg-gradient-to-r ${selectedColor.gradient}`} />
          
          {/* Card Content inside */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Mediflow Logo Badge */}
            <div className={`px-4 py-1.5 rounded-full ${selectedColor.badge} border ${selectedColor.border} text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 mb-6 shadow-xs`}>
              <Sparkles className="h-3 w-3 animate-pulse" />
              {customClinicName}
            </div>

            {/* Core Instruction Headings */}
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase font-sans">
              Scan & Onboard
            </h1>
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1 mb-6">
              Instant Paperless Registration
            </p>

            {/* QR Code Container */}
            <div className={`p-4 bg-white border-2 ${selectedColor.border} rounded-3xl shadow-2xl relative group overflow-hidden ${selectedColor.lightGlow} hover:scale-102 transition-transform duration-300`}>
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-teal-400 to-emerald-500 opacity-20" />
              <img 
                src={qrCodeImageSrc} 
                alt="Walk-in WhatsApp QR Code" 
                className="w-48 h-48 rounded-2xl relative z-10 mx-auto"
                crossOrigin="anonymous"
              />
              <div className="mt-2 text-[8px] font-mono text-slate-600 select-none">
                Scan using Camera / WhatsApp
              </div>
            </div>

            {/* Instruction Steps */}
            <div className="mt-8 w-full space-y-3.5 text-left bg-white/70 border border-slate-200/50 p-4 rounded-2xl backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full ${selectedColor.badge} border ${selectedColor.border} flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5`}>
                  1
                </div>
                <div>
                  <h5 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">Scan the QR code</h5>
                  <p className="text-[9px] text-slate-600 font-sans mt-0.5 leading-relaxed">Launch your WhatsApp camera or system scanner to read the secure clinic token.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full ${selectedColor.badge} border ${selectedColor.border} flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5`}>
                  2
                </div>
                <div>
                  <h5 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">Press "Send"</h5>
                  <p className="text-[9px] text-slate-600 font-sans mt-0.5 leading-relaxed">The onboarding cue triggers automatically. Zero-type consent starts immediately.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full ${selectedColor.badge} border ${selectedColor.border} flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5`}>
                  3
                </div>
                <div>
                  <h5 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">Clinical AI Queue Sync</h5>
                  <p className="text-[9px] text-slate-600 font-sans mt-0.5 leading-relaxed">The WhatsApp bot auto-syncs your details with VitalSync. You are placed in the Doctor's Queue!</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 flex items-center gap-1.5 text-[8px] font-mono font-extrabold uppercase text-slate-600 tracking-wider">
              <Smartphone className="h-3 w-3 text-slate-600 shrink-0" />
              Powered by VitalSync Clinical AI Scribe
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
