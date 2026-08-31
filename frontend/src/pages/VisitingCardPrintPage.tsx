import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, 
  Mail, 
  Printer, 
  RotateCw, 
  Download, 
  Sparkles, 
  ShieldCheck, 
  ArrowLeft, 
  Check, 
  Layers, 
  Smartphone, 
  Globe, 
  Presentation,
  Sun,
  Moon
} from 'lucide-react';
import { BrandMark } from '../components/shared/BrandMark';

export const VisitingCardPrintPage: React.FC = () => {
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'single' | 'sheet'>('single');
  const [sheetMode, setSheetMode] = useState<'duplex' | 'sideBySide'>('duplex');
  const [cardTheme, setCardTheme] = useState<'pearl' | 'dark'>('pearl');
  const [name, setName] = useState<string>('Vivek Kumar');
  const [title, setTitle] = useState<string>('Founder & CTO');
  const [phone, setPhone] = useState<string>('+91 96080 32073');
  const [email, setEmail] = useState<string>('vivek@vitalsync.in');
  const [websiteUrl, setWebsiteUrl] = useState<string>('https://vitalsync.in');
  const [pitchUrl, setPitchUrl] = useState<string>('https://vitalsync.in/pitch');
  const [copied, setCopied] = useState<boolean>(false);

  // Enforce document title
  useEffect(() => {
    document.title = `${name} - Executive Business Card | VitalSync`;
  }, [name]);

  const cleanPhone = phone.replace(/\D/g, '');

  // Back QR: Direct scan to Practice Economics Deck & Demo
  const pitchQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pitchUrl)}`;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyVCard = () => {
    const vCardData = `BEGIN:VCARD
VERSION:3.0
N:Kumar;Vivek;;;
FN:${name}
ORG:VitalSync Smart Virtual Hospital Network
TITLE:${title}
TEL;TYPE=CELL,VOICE,MSG:${phone}
EMAIL;TYPE=PREF,INTERNET:${email}
URL:${websiteUrl}
NOTE:Your Clinic. Now a Hospital. Connected Outpatient Care on WhatsApp. Website: ${websiteUrl} | Practice Demo: ${pitchUrl}
END:VCARD`;

    const blob = new Blob([vCardData], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${name.replace(/\s+/g, '_')}_VitalSync.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Reusable Single Front Card Component for 3D & Sheet Rendering
  const renderFrontCard = (isPrintMini = false) => (
    <div className={`w-full h-full rounded-[18px] ${
      cardTheme === 'pearl'
        ? 'bg-white text-slate-900'
        : 'bg-gradient-to-br from-[#0B132B] via-[#0D1B2A] to-[#081C15] text-white'
    } flex flex-col justify-between relative overflow-hidden shadow-inner`}>
      {/* Faint Background Watermark */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-[0.035] pointer-events-none select-none">
        <BrandMark size={isPrintMini ? 140 : 220} title="Subtle Watermark" />
      </div>

      {/* Top & Center Body */}
      <div className={`${isPrintMini ? 'p-3.5 pb-1' : 'p-6 sm:p-7 pb-3'} flex flex-col justify-between flex-1 relative z-10`}>
        {/* Brand Header */}
        <div className="flex items-center gap-2.5">
          <div className={`p-1 rounded-xl ${
            cardTheme === 'pearl' 
              ? 'bg-white shadow-sm border border-teal-100 ring-1 ring-emerald-500/20' 
              : 'bg-white/10 backdrop-blur-md border border-white/20'
          }`}>
            <BrandMark size={isPrintMini ? 22 : 32} title="VitalSync Logo" />
          </div>
          <div>
            <div className={`${isPrintMini ? 'text-sm font-black' : 'text-xl sm:text-2xl font-black'} tracking-tight flex items-center leading-none`}>
              <span className={cardTheme === 'pearl' ? 'text-[#0284C7]' : 'text-[#38BDF8]'}>Vital</span>
              <span className={cardTheme === 'pearl' ? 'text-[#059669]' : 'text-[#34D399]'}>Sync</span>
            </div>
            <div className={`${isPrintMini ? 'text-[7px]' : 'text-[8.5px]'} uppercase tracking-[0.24em] font-black mt-0.5 ${
              cardTheme === 'pearl' ? 'text-teal-800' : 'text-teal-400'
            }`}>
              Smart Virtual Hospital Network
            </div>
          </div>
        </div>

        {/* Founder Name & Title */}
        <div className="space-y-0.5 my-auto">
          <h3 className={`${isPrintMini ? 'text-base font-black' : 'text-2xl sm:text-3xl font-black'} tracking-tight leading-none ${
            cardTheme === 'pearl' ? 'text-slate-950' : 'text-white'
          }`}>
            {name}
          </h3>
          <p className={`${isPrintMini ? 'text-[10px]' : 'text-xs sm:text-sm'} font-bold tracking-wide ${
            cardTheme === 'pearl' ? 'text-teal-700' : 'text-teal-300'
          }`}>
            {title}
          </p>
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`${isPrintMini ? 'text-[8.5px]' : 'text-[11px]'} italic font-semibold ${
              cardTheme === 'pearl' ? 'text-slate-600' : 'text-slate-300'
            }`}>
              "Your Clinic. Now a Hospital."
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Emerald Contact Ribbon */}
      <div className={`w-full ${isPrintMini ? 'py-1.5 px-3.5 text-[8px]' : 'py-2.5 px-6 sm:px-7 text-[10px] sm:text-[11px]'} font-bold flex items-center justify-between ${
        cardTheme === 'pearl'
          ? 'bg-gradient-to-r from-teal-800 via-emerald-700 to-teal-900 text-white shadow-md'
          : 'bg-gradient-to-r from-teal-900 via-emerald-800 to-cyan-950 text-white border-t border-teal-500/30'
      }`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <PhoneCall className={isPrintMini ? 'w-2.5 h-2.5 text-teal-300' : 'w-3.5 h-3.5 text-teal-300'} />
            <span>{phone}</span>
          </div>
          <div className="flex items-center gap-1 text-teal-100 font-medium">
            <Mail className={isPrintMini ? 'w-2.5 h-2.5 text-teal-300' : 'w-3.5 h-3.5 text-teal-300'} />
            <span>{email}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 font-mono font-black text-white">
          <Globe className={isPrintMini ? 'w-2.5 h-2.5 text-emerald-300' : 'w-3.5 h-3.5 text-emerald-300'} />
          <span className={isPrintMini ? 'text-[8.5px]' : 'text-xs tracking-tight'}>vitalsync.in</span>
        </div>
      </div>
    </div>
  );

  // Reusable Single Back Card Component
  const renderBackCard = (isPrintMini = false) => (
    <div className={`w-full h-full rounded-[18px] ${
      cardTheme === 'pearl'
        ? 'bg-gradient-to-br from-[#FFFFFF] via-[#FAFCFC] to-[#F3F8F6] text-slate-900 border border-slate-200/90'
        : 'bg-gradient-to-br from-[#060D1A] via-[#0A1826] to-[#041410] text-white'
    } ${isPrintMini ? 'p-3' : 'p-4 sm:p-5'} flex flex-col justify-between relative overflow-hidden shadow-inner`}>
      {/* Top Header */}
      <div className={`flex items-center justify-between border-b pb-1 relative z-10 ${
        cardTheme === 'pearl' ? 'border-slate-200' : 'border-slate-800'
      }`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-3.5 h-3.5 rounded-md flex items-center justify-center ${
            cardTheme === 'pearl' ? 'bg-teal-100 text-teal-800' : 'bg-teal-500/20 text-teal-400'
          }`}>
            <ShieldCheck className="w-2.5 h-2.5" />
          </span>
          <span className={`${isPrintMini ? 'text-[8px]' : 'text-[10px]'} font-black uppercase tracking-wider ${
            cardTheme === 'pearl' ? 'text-slate-950' : 'text-white'
          }`}>
            The Virtual Hospital Business Model
          </span>
        </div>
        <span className={`${isPrintMini ? 'text-[6.5px]' : 'text-[8px]'} font-mono font-black px-2 py-0.2 rounded-full border shadow-xs ${
          cardTheme === 'pearl'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
            : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
        }`}>
          ₹0 Setup • ₹0 SaaS
        </span>
      </div>

      {/* Center QR & 5 Pillars */}
      <div className={`flex items-center ${isPrintMini ? 'gap-2.5' : 'gap-3.5'} my-auto relative z-10`}>
        {/* QR Code */}
        <div className={`p-1.5 bg-white rounded-xl shrink-0 flex flex-col items-center border-2 ${
          cardTheme === 'pearl' ? 'border-teal-400 shadow-sm' : 'border-emerald-400/50 shadow-md'
        }`}>
          <img 
            src={pitchQrUrl} 
            alt="VitalSync Practice Demo QR" 
            className={isPrintMini ? 'w-13 h-13 rounded' : 'w-16 h-16 sm:w-18 sm:h-18 rounded-lg'}
          />
          <span className={`${isPrintMini ? 'text-[6px]' : 'text-[7px]'} font-black uppercase mt-0.5 tracking-tighter flex items-center gap-0.5 px-1 py-0.2 rounded font-mono ${
            cardTheme === 'pearl' ? 'bg-teal-100 text-teal-950' : 'bg-emerald-100 text-slate-950'
          }`}>
            <Presentation className="w-2 h-2 text-teal-800" /> Scan Demo
          </span>
        </div>

        {/* 6 High-Impact Pillars */}
        <div className={`space-y-0.5 ${isPrintMini ? 'text-[7px]' : 'text-[9.5px] sm:text-[10px]'} font-medium leading-tight`}>
          <div><strong className={cardTheme === 'pearl' ? 'text-teal-900 font-black' : 'text-teal-300'}>1. Hospital Network:</strong> Unite clinic, chemist &amp; lab under ₹0 capital.</div>
          <div><strong className={cardTheme === 'pearl' ? 'text-emerald-900 font-black' : 'text-emerald-300'}>2. +20%–50% Earnings:</strong> Retain Medicine &amp; Lab income lost to outside shops.</div>
          <div><strong className={cardTheme === 'pearl' ? 'text-cyan-900 font-black' : 'text-cyan-300'}>3. Patient Retention:</strong> Follow-up consults, refills &amp; 90-day re-tests on WhatsApp.</div>
          <div><strong className={cardTheme === 'pearl' ? 'text-amber-900 font-black' : 'text-amber-300'}>4. 100% Doctor Fee Protection:</strong> 100% consultation fees to bank with ₹0 SaaS &amp; ₹0 commission.</div>
          <div><strong className={cardTheme === 'pearl' ? 'text-indigo-900 font-black' : 'text-indigo-300'}>5. 1-Tap WhatsApp:</strong> Appointment booking, digital e-Rx &amp; lab PDFs on WA.</div>
          <div><strong className={cardTheme === 'pearl' ? 'text-purple-900 font-black' : 'text-purple-300'}>6. AI Clinical Suite:</strong> PubMed-backed OPD EMR &amp; AI Lab Report Analyzer.</div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className={`pt-1 border-t flex items-center justify-between ${isPrintMini ? 'text-[7.5px]' : 'text-[9px]'} relative z-10 ${
        cardTheme === 'pearl' ? 'border-slate-200 text-slate-800' : 'border-slate-800 text-slate-300'
      }`}>
        <div className="flex items-center gap-1 font-bold">
          <Presentation className="w-2.5 h-2.5 text-teal-600" />
          <span>Demo: <strong className="font-mono">vitalsync.in/pitch</strong></span>
        </div>
        <div className="flex items-center gap-1 font-bold">
          <Globe className="w-2.5 h-2.5 text-emerald-600" />
          <span>Web: <strong className="font-mono">vitalsync.in</strong></span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 font-sans antialiased selection:bg-teal-600 selection:text-white pb-20 print:bg-white print:text-slate-900 print:pb-0">
      
      {/* ── Top Navigation & Control Bar (Hidden on Print) ── */}
      <header className="sticky top-0 z-50 bg-[#0B1222]/95 backdrop-blur-xl border-b border-cyan-500/20 px-4 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.5)] no-print">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a 
              href="/pitch" 
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all no-underline border border-slate-700/80 shadow-inner"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Practice Deck
            </a>
            <div className="h-4 w-px bg-slate-700/80 hidden sm:block" />
            <div className="flex items-center gap-2">
              <BrandMark size={26} title="VitalSync" />
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white leading-none tracking-tight flex items-center gap-1.5">
                  <span>VitalSync Executive Business Card</span>
                  <span className="text-[9px] bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full uppercase">
                    PRO
                  </span>
                </h1>
                <p className="text-[10px] text-teal-400 font-semibold mt-0.5">Bottom Emerald Ribbon • ISO 3.5" × 2" Format</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <div className="flex bg-slate-900/90 p-0.5 rounded-xl border border-slate-800 text-xs shadow-inner">
              <button
                onClick={() => setCardTheme('pearl')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
                  cardTheme === 'pearl' ? 'bg-white text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" /> Pearl &amp; Emerald
              </button>
              <button
                onClick={() => setCardTheme('dark')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
                  cardTheme === 'dark' ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-teal-300" /> Titanium Dark
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-900/90 p-0.5 rounded-xl border border-slate-800 text-xs shadow-inner">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
                  viewMode === 'single' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> 3D Preview
              </button>
              <button
                onClick={() => setViewMode('sheet')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
                  viewMode === 'sheet' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> A4 Print Sheet (10 Cards)
              </button>
            </div>

            {/* vCard Download */}
            <button
              onClick={handleCopyVCard}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Download Digital vCard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{copied ? 'Saved!' : 'Save vCard'}</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-[0_0_20px_rgba(20,184,166,0.4)] cursor-pointer border-0"
            >
              <Printer className="w-3.5 h-3.5 text-slate-950" /> Print Cards (PDF)
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Single Card 3D Flip Interactive Mode */}
        {viewMode === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start no-print">
            
            {/* Left: 3D Interactive Card Stage */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center space-y-6">
              
              <div className="text-center space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-bold shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Full-Bleed Executive Layout (3.5" × 2" ISO Format)
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {isFlipped ? 'Back Side: The Practice Business Model & QR' : 'Front Side: Executive Medical Identity'}
                </h2>
                <p className="text-xs text-slate-400">Click card or press button to flip between front and back.</p>
              </div>

              {/* 3D Flip Card Outer Wrap */}
              <div 
                className="relative cursor-pointer group select-none"
                style={{ perspective: '1400px' }}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div 
                  className="w-[360px] sm:w-[480px] h-[230px] sm:h-[280px] rounded-3xl transition-transform duration-700 relative [transform-style:preserve-3d] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.9),0_0_50px_rgba(20,184,166,0.2)]"
                  style={{
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}
                >
                  {/* FRONT SIDE */}
                  <div className={`absolute inset-0 rounded-3xl p-[2px] ${
                    cardTheme === 'pearl' 
                      ? 'bg-gradient-to-br from-teal-500/50 via-slate-300 to-emerald-500/50 shadow-2xl' 
                      : 'bg-gradient-to-br from-teal-400/80 via-emerald-500/40 to-cyan-400/80 shadow-2xl'
                  } [backface-visibility:hidden]`}>
                    {renderFrontCard(false)}
                  </div>

                  {/* BACK SIDE */}
                  <div className={`absolute inset-0 rounded-3xl p-[2px] ${
                    cardTheme === 'pearl'
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 shadow-2xl'
                      : 'bg-gradient-to-br from-emerald-400/80 via-teal-500/40 to-cyan-400/80 shadow-2xl'
                  } [backface-visibility:hidden] [transform:rotateY(180deg)]`}>
                    {renderBackCard(false)}
                  </div>
                </div>
              </div>

              {/* Flip Button */}
              <button
                onClick={() => setIsFlipped(!isFlipped)}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-teal-300 border border-teal-500/30 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-teal-500/20"
              >
                <RotateCw className="w-4 h-4 text-teal-400 animate-spin-slow" /> Flip Card (View {isFlipped ? 'Front' : 'Back'})
              </button>
            </div>

            {/* Right: Customization Controls & Quick Actions */}
            <div className="lg:col-span-5 bg-[#0B132B]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-400" /> Card Customization Panel
                </h3>
                <p className="text-xs text-slate-400">
                  Update contact info and URLs. Live changes apply to 3D preview and printable A4 sheet.
                </p>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Founder / Executive Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Official Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-teal-500/50 rounded-xl text-teal-300 text-xs font-bold focus:outline-none focus:border-teal-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block mb-1">
                    Official Website URL
                  </label>
                  <input
                    type="text"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-teal-500/50 rounded-xl text-teal-300 text-xs font-mono font-bold focus:outline-none focus:border-teal-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                    Practice Demo Link (Generates QR Code)
                  </label>
                  <input
                    type="text"
                    value={pitchUrl}
                    onChange={(e) => setPitchUrl(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-mono font-bold focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <button
                  onClick={handlePrint}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_25px_rgba(20,184,166,0.35)] cursor-pointer border-0"
                >
                  <Printer className="w-4 h-4" /> Print High-Res Card Sheet (A4)
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-teal-300 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all no-underline"
                  >
                    <Globe className="w-3.5 h-3.5 text-teal-400" /> Test Website
                  </a>
                  <a
                    href={pitchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all no-underline"
                  >
                    <Presentation className="w-3.5 h-3.5 text-emerald-400" /> Test Practice Demo
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            A4 PRINT SHEET MODE: 10 CARDS GRID (DUPLEX 2-PAGE PRINT SHOP READY)
           ════════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'sheet' || true) && (
          <div className={`${viewMode === 'sheet' ? 'block' : 'hidden print:block'} space-y-6`}>
            
            {/* Sheet Mode Header (Hidden on Print) */}
            <div className="p-4 bg-[#0B132B] border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4 no-print shadow-xl">
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-400" /> A4 Multi-Card Print Sheet (10 Cards per Sheet)
                </h3>
                <p className="text-xs text-slate-400">
                  Formatted for double-sided printing on 300–350 GSM cardstock (Page 1 = 10 Fronts, Page 2 = 10 Backs).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setSheetMode('duplex')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border-0 ${
                      sheetMode === 'duplex' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    2-Page Duplex (Standard)
                  </button>
                  <button
                    onClick={() => setSheetMode('sideBySide')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border-0 ${
                      sheetMode === 'sideBySide' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    1-Page Side-by-Side
                  </button>
                </div>

                <button
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer border-0"
                >
                  <Printer className="w-4 h-4" /> Print Sheet Now
                </button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                MODE A: 2-PAGE DUPLEX (Page 1 = 10 Fronts, Page 2 = 10 Backs)
               ══════════════════════════════════════════════════════════════════ */}
            {sheetMode === 'duplex' ? (
              <div className="space-y-8 print:space-y-0">
                {/* ── PAGE 1: 10 FRONTS ── */}
                <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 page-break-after">
                  <div className="text-center pb-3 border-b border-slate-200 mb-5 print:hidden">
                    <span className="text-xs font-black uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                      Page 1 of 2: Front Faces (10 Cards • 5 Rows × 2 Columns)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 print:grid-cols-2 print:gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <div 
                        key={`front-card-${num}`} 
                        className={`w-full h-[185px] rounded-xl border-2 shadow-xs relative overflow-hidden ${
                          cardTheme === 'pearl' ? 'border-teal-500/70 print:border-slate-300' : 'border-teal-500/80 print:border-teal-900'
                        }`}
                      >
                        {renderFrontCard(true)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── PAGE 2: 10 BACKS (PERFECTLY ALIGNED FOR REVERSE PRINTING) ── */}
                <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0">
                  <div className="text-center pb-3 border-b border-slate-200 mb-5 print:hidden">
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      Page 2 of 2: Back Faces (10 Cards • Reverse Side Alignment)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 print:grid-cols-2 print:gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <div 
                        key={`back-card-${num}`} 
                        className={`w-full h-[185px] rounded-xl border-2 shadow-xs relative overflow-hidden ${
                          cardTheme === 'pearl' ? 'border-slate-300 print:border-slate-300' : 'border-emerald-500/80 print:border-teal-900'
                        }`}
                      >
                        {renderBackCard(true)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ════════════════════════════════════════════════════════════════
                  MODE B: 1-PAGE SIDE-BY-SIDE (5 Fronts on Left + 5 Backs on Right)
                 ════════════════════════════════════════════════════════════════ */
              <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0">
                <div className="text-center pb-4 border-b border-slate-200 mb-6 print:hidden">
                  <span className="text-xs font-black uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                    Single Page Layout: 5 Front Faces (Left) + 5 Back Faces (Right)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 print:grid-cols-2 print:gap-2">
                  {[1, 2, 3, 4, 5].map((idx) => (
                    <React.Fragment key={`side-pair-${idx}`}>
                      <div className="w-full h-[185px] rounded-xl border-2 border-teal-500/70 shadow-xs relative overflow-hidden print:border-slate-300">
                        {renderFrontCard(true)}
                      </div>
                      <div className="w-full h-[185px] rounded-xl border-2 border-slate-300 shadow-xs relative overflow-hidden print:border-slate-300">
                        {renderBackCard(true)}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Print Specific CSS Rules for Page Breaks & Clean Colors */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-after {
            page-break-after: always !important;
            break-after: page !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}} />
    </div>
  );
};
