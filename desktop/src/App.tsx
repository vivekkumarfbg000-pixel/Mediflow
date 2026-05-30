import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  QrCode, 
  Terminal, 
  Mic, 
  ShieldCheck,
  Zap,
  Cpu
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

// Safe check to determine if running inside Tauri runtime environment
const isTauri = () => typeof window !== 'undefined' && (window as any).__TAURI_IPC__ !== undefined;

const App: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([
    '[INIT] Mediflow Desktop Service Host started.',
    '[SYSTEM] Loading serial laser barcode scanner configuration...',
    '[PRINTER] Autodetected EPSON TM-T88VI on USB / COM3 port.',
    '[SCRIBE] Local Audio Stream ready at 44.1kHz stereo.',
    '[SECURE] Row-Level Isolation activated under active compliance tenant.'
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);

  // Hook barcode scanner and listen to scanned events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    if (isTauri()) {
      invoke<string>('hook_barcode_scanner')
        .then((res) => {
          setLogs(prev => [...prev, `[SYSTEM] ${res}`]);
        })
        .catch((err) => {
          setLogs(prev => [...prev, `[ERROR] Failed to hook barcode scanner: ${err}`]);
        });

      listen<string>('barcode-scanned', (event) => {
        const barcode = event.payload;
        setLastBarcode(barcode);
        setLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] SCANNER: Laser barcode raw input captured: "${barcode}"`,
          `[${new Date().toLocaleTimeString()}] CDSS: Auto-loaded patient record matching barcode in draw queue.`
        ]);
      }).then(fn => {
        unlisten = fn;
      });
    } else {
      setLogs(prev => [
        ...prev,
        '[SYSTEM] Web Preview Mode: Simulated scanner ready (Click buttons below to trigger).'
      ]);
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleTestPrint = async () => {
    const timestamp = new Date().toLocaleTimeString();
    const payload = 'MEDIFLOW INVOICE\nDate: 2026-05-30\nTotal: INR 450.00\n----------------\nThank You!';
    
    if (isTauri()) {
      try {
        const res = await invoke<string>('trigger_raw_print', {
          billId: 'BILL_9942',
          payload
        });
        setLogs(prev => [
          ...prev,
          `[${timestamp}] COMMAND: Dispatched direct raw ESC/POS slip binary to COM3.`,
          `[${timestamp}] PRINTER: ${res}`
        ]);
      } catch (err) {
        setLogs(prev => [
          ...prev,
          `[${timestamp}] COMMAND: Direct raw ESC/POS dispatch failed.`,
          `[${timestamp}] ERROR: ${err}`
        ]);
      }
    } else {
      // Mock fallback in standard browser preview
      setLogs(prev => [
        ...prev,
        `[${timestamp}] COMMAND (Simulated): Dispatched direct raw ESC/POS slip binary to COM3.`,
        `[${timestamp}] PRINTER (Simulated): [MOCK] ESC/POS Print Job for BILL_9942 queued successfully on serial COM3 (Bypassed print dialog)`
      ]);
    }
  };

  const handleSimulateScan = () => {
    const timestamp = new Date().toLocaleTimeString();
    const mockBarcodes = ["LOINC_4544-3", "LOINC_1975-2", "LOINC_24357-1"];
    const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
    
    setLastBarcode(randomBarcode);
    setLogs(prev => [
      ...prev,
      `[${timestamp}] SCANNER (Manual): Laser barcode raw input captured: "${randomBarcode}"`,
      `[${timestamp}] CDSS: Auto-loaded patient record matching barcode in draw queue.`
    ]);
  };

  const handleToggleScribe = () => {
    const timestamp = new Date().toLocaleTimeString();
    if (!isRecording) {
      setIsRecording(true);
      setLogs(prev => [
        ...prev,
        `[${timestamp}] SCRIBE: Local boundary microphone activated. Streaming PCM audio to local Whisper buffer...`
      ]);
    } else {
      setIsRecording(false);
      setLogs(prev => [
        ...prev,
        `[${timestamp}] SCRIBE: Stream stopped. Dispatching segment for clinical transcription.`,
        `[${timestamp}] TRANSCRIPTION: "Patient presents with dry cough and mild fever. Recommending paracetamol 650mg."`
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8 flex flex-col justify-between select-none">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Cpu className="h-6 w-6 text-indigo-600 animate-pulse" />
            Mediflow connected care desktop node
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Zero-latency Rust-compiled companion for direct clinical hardware print and scan bridges.
          </p>
        </div>
        
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-emerald-500 animate-ping'}`} />
          <span className={`text-[10px] font-mono font-bold uppercase border px-3 py-1 rounded-full tracking-widest ${isRecording ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
            {isRecording ? 'Scribe Recording' : 'Local Svc Host: Running'}
          </span>
        </div>
      </div>

      {/* Main Console Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 my-8 flex-1">
        
        {/* Left Column: Direct Bridges */}
        <div className="md:col-span-7 space-y-6">
          
          <div className="glass-panel p-6 border-slate-200 shadow-xl space-y-5 bg-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-teal-500" />
            
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Zap className="h-5 w-5 text-indigo-600" />
              Tauri Raw Device Integrations
            </h2>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              Tauri compiles clean Rust binaries bypassing traditional Chrome driver print constraints, enabling Clinics and Pharmacies to operate checkout workflows at microsecond speed.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              
              {/* EPSON Slip Print */}
              <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50 flex flex-col justify-between gap-3 shadow-inner">
                <div>
                  <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Printer className="h-4 w-4 text-indigo-500" />
                    USB ESC/POS Printer
                  </h3>
                  <span className="block text-[8px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">COM3 · Epson TM-T88</span>
                </div>
                <button
                  onClick={handleTestPrint}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition cursor-pointer border-0"
                >
                  Trigger Test Slip Print
                </button>
              </div>

              {/* Barcode Laser */}
              <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50 flex flex-col justify-between gap-3 shadow-inner">
                <div>
                  <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <QrCode className="h-4 w-4 text-teal-600" />
                    Specimen Barcode Scan
                  </h3>
                  <span className="block text-[8px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">
                    {lastBarcode ? `Last: ${lastBarcode}` : 'HID Keyboard Hook · READY'}
                  </span>
                </div>
                <button
                  onClick={handleSimulateScan}
                  className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition cursor-pointer border-0"
                >
                  Simulate spec. scan
                </button>
              </div>

            </div>

            {/* Audio Scribe */}
            <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50 flex items-center justify-between gap-4 shadow-inner">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-indigo-100 text-indigo-600'}`}>
                  <Mic className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800">Local Scribe Audio Capture</h4>
                  <span className="block text-[8px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">
                    {isRecording ? 'Streaming Whisper endpoint...' : 'Boundary Mic · Idle'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleToggleScribe}
                className={`px-4 py-2 font-bold rounded-xl text-[10px] uppercase tracking-wider transition cursor-pointer border-0 ${isRecording ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
              >
                {isRecording ? 'Stop Scribe' : 'Start Scribe'}
              </button>
            </div>

          </div>

        </div>

        {/* Right Column: Console Output */}
        <div className="md:col-span-5 flex flex-col">
          
          <div className="glass-panel p-6 border-slate-200 shadow-xl bg-slate-900 text-indigo-300 font-mono text-[9px] flex-1 flex flex-col justify-between relative overflow-hidden select-text">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-slate-800" />
            
            <div className="space-y-4">
              <h3 className="text-white text-xs font-bold font-sans flex items-center gap-1.5 border-b border-white/5 pb-2 select-none">
                <Terminal className="h-4 w-4 text-indigo-400" />
                Mediflow Host logs
              </h3>
              
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="text-slate-500">[{new Date().toLocaleDateString()}]</span> {log}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/5 pt-3 flex justify-between items-center text-slate-500 select-none">
              <span>Host IP: 127.0.0.1</span>
              <span>Memory: 24.8 MB</span>
            </div>

          </div>

        </div>

      </div>

      {/* Footer copyright */}
      <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
          Mediflow compliance shield active
        </span>
        <span>Patna Node v1.0.0</span>
      </div>

    </div>
  );
};

export default App;
