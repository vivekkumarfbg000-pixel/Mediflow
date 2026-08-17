import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, CheckCircle2, Monitor } from 'lucide-react';
import { BrandMark } from './BrandMark';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const AppInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);
  const [showDesktopModal, setShowDesktopModal] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false); // Tracks if native prompt is captured

  useEffect(() => {
    // 1. Initial State Check from Window (in case event fired before React hydration)
    if (typeof window !== 'undefined' && (window as any).deferredPwaPrompt) {
      setDeferredPrompt((window as any).deferredPwaPrompt);
      setIsReady(true);
    }

    // 2. Register Service Worker to meet PWA criteria
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[VitalSync PWA] SW Registered in React:', reg.scope);
      }).catch((err) => {
        console.warn('[VitalSync PWA] SW Registration:', err);
      });
    }

    // 3. Check standalone PWA mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 4. Detect iOS User-Agent
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 5. Listeners
    const handlePromptReady = () => {
      if ((window as any).deferredPwaPrompt) {
        setDeferredPrompt((window as any).deferredPwaPrompt);
        setIsReady(true);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPwaPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsReady(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setShowIosModal(false);
      setShowDesktopModal(false);
    };

    window.addEventListener('vitalsync-pwa-prompt-ready', handlePromptReady);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    // 6. Auto-trigger install prompt if routed from landing page with ?install=true
    let timer: any = null;
    if (typeof window !== 'undefined' && window.location.search.includes('install=true')) {
      timer = setTimeout(() => {
        const pInstance = (window as any).deferredPwaPrompt;
        if (pInstance && typeof pInstance.prompt === 'function') {
          pInstance.prompt().catch(() => {/* ignore */});
        }
      }, 600);
    }

    return () => {
      window.removeEventListener('vitalsync-pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    // 1. If currently on marketing landing page (vitalsync.in / www.vitalsync.in), redirect to app.vitalsync.in for Dashboard PWA download
    if (typeof window !== 'undefined') {
      const curHost = window.location.hostname;
      if (curHost === 'vitalsync.in' || curHost === 'www.vitalsync.in') {
        window.location.href = 'https://app.vitalsync.in?install=true';
        return;
      }
    }

    const promptInstance = deferredPrompt || (window as any).deferredPwaPrompt;

    // DIRECT NATIVE INSTALL (Triggers native browser install prompt)
    if (promptInstance) {
      try {
        await promptInstance.prompt();
        const choiceResult = await promptInstance.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsVisible(false);
          setIsInstalled(true);
        }
      } catch (err) {
        console.error('[VitalSync PWA] Native prompt execution error:', err);
        // Fallback if prompt fails
        if (isIos) setShowIosModal(true);
        else setShowDesktopModal(true);
      }
      return;
    }

    // IF NATIVE PROMPT IS NOT AVAILABLE (e.g. localhost limitations, iOS, or already dismissed)
    if (isIos) {
      setShowIosModal(true);
    } else {
      setShowDesktopModal(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setShowIosModal(false);
    setShowDesktopModal(false);
    sessionStorage.setItem('vitalsync_app_install_snoozed', 'true');
  };

  if (isInstalled || !isVisible) return null;

  return (
    <>
      {/* ── FLOATING BOTTOM-LEFT INSTALL CAPSULE ────────────────────────────── */}
      <div 
        className="fixed bottom-4 left-4 z-50 transition-all max-w-[calc(100vw-2rem)]"
        style={{ animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
      >
        <div className="bg-slate-950/90 border border-indigo-500/25 backdrop-blur-xl shadow-2xl shadow-indigo-950/60 rounded-full p-1.5 pr-3.5 flex items-center gap-2.5">
          
          <div className="w-8 h-8 rounded-full bg-slate-900 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
            <BrandMark size={18} />
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-600 text-white font-extrabold text-xs px-4 py-2 rounded-full shadow-md shadow-indigo-600/30 transition-all duration-300 transform hover:scale-[1.04] active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0 border border-indigo-400/30"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Install app</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white text-xs font-medium px-2 py-1 transition-colors cursor-pointer shrink-0"
          >
            Later
          </button>

        </div>
      </div>

      {/* ── DESKTOP CHROME/EDGE FALLBACK MODAL ────────────────────────────── */}
      {showDesktopModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative text-white space-y-4">
            <button
              onClick={() => setShowDesktopModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Install VitalSync App</h3>
                <p className="text-xs text-slate-400">Fast 1-tap app icon on your desktop</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs text-slate-300">
              <div className="flex items-start gap-3 bg-slate-850/60 p-3 rounded-xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center shrink-0 border border-indigo-500/30">
                  1
                </div>
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    Look at the Address Bar (Top Right)
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click the <span className="text-indigo-300 font-bold">(⊕ Install)</span> or Desktop icon in your Chrome/Edge URL bar</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-850/60 p-3 rounded-xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center shrink-0 border border-indigo-500/30">
                  2
                </div>
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    Or Open Browser Menu (⋮)
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Select "Install VitalSync..." or "Save and share -{">"} Install app"</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowDesktopModal(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── IOS SPECIFIC SHARE INSTRUCTIONS MODAL ────────────────────────── */}
      {showIosModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative text-white space-y-4">
            <button onClick={() => setShowIosModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Install VitalSync App</h3>
                <p className="text-xs text-slate-400">Add to iPhone / iPad home screen</p>
              </div>
            </div>
            <div className="space-y-3 pt-2 text-xs text-slate-300">
              <div className="flex items-start gap-3 bg-slate-850/60 p-3 rounded-xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center shrink-0 border border-indigo-500/30">1</div>
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">Tap the Share button <Share className="w-3.5 h-3.5 text-indigo-400 inline" /></p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Located in your Safari toolbar at bottom</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-slate-850/60 p-3 rounded-xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center shrink-0 border border-indigo-500/30">2</div>
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">Select Add to Home Screen <PlusSquare className="w-3.5 h-3.5 text-indigo-400 inline" /></p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Scroll down in the share options list</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-slate-850/60 p-3 rounded-xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center shrink-0 border border-indigo-500/30">3</div>
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">Tap "Add" in top right <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" /></p>
                  <p className="text-[11px] text-slate-400 mt-0.5">VitalSync icon will appear on your home screen</p>
                </div>
              </div>
            </div>
            <button onClick={() => setShowIosModal(false)} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all cursor-pointer">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
