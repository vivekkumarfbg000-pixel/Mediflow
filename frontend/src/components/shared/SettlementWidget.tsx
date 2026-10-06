import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { QrCode, CheckCircle2, X, Sparkles, Copy, Check, Building2, ShieldCheck, RefreshCw } from 'lucide-react';
import { generateQRCodeDataURI } from '../../utils/qrCode';
import { safeGetStorageJSON, safeSetStorageJSON } from '../../utils/storage';

interface SettlementWidgetProps {
  entityId: string;
  podId: string;
  entityType: 'clinic' | 'pharmacy' | 'lab';
  displayName?: string;
  theme?: 'light' | 'dark';
}

interface DirectPaymentConfig {
  upiVpa: string;
  payeeName: string;
  regNumber?: string;
  updatedAt: string;
}

export const SettlementWidget: React.FC<SettlementWidgetProps> = React.memo(({
  entityId,
  podId,
  entityType,
  displayName = 'Direct Settlement Account',
  theme = 'light'
}) => {
  const isDark = theme === 'dark';
  const storageKey = `vitalsync_direct_payment_${podId || 'global'}_${entityType}`;

  // Default fallback VPA if not yet set
  const defaultPayee = displayName.replace(/\s+/g, ' ') || 'Healthcare Clinic';
  const [config, setConfig] = useState<DirectPaymentConfig | null>(() => {
    return safeGetStorageJSON<DirectPaymentConfig | null>(storageKey, null);
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [formVpa, setFormVpa] = useState('');
  const [formName, setFormName] = useState('');
  const [formReg, setFormReg] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loaded = safeGetStorageJSON<DirectPaymentConfig | null>(storageKey, null);
    if (loaded) {
      setConfig(loaded);
    }
  }, [storageKey]);

  const activeVpa = config?.upiVpa || 'vitalsync@upi';
  const activeName = config?.payeeName || defaultPayee;

  // Generate standard NPCI/UPI URI: upi://pay?pa=<vpa>&pn=<name>&cu=INR
  const upiUri = useMemo(() => {
    const cleanVpa = encodeURIComponent((activeVpa || '').trim());
    const cleanName = encodeURIComponent((activeName || '').trim());
    return `upi://pay?pa=${cleanVpa}&pn=${cleanName}&cu=INR`;
  }, [activeVpa, activeName]);

  const qrDataUri = useMemo(() => {
    try {
      return generateQRCodeDataURI(upiUri, {
        size: 240,
        color: isDark ? '#10b981' : '#0f172a',
        bgColor: isDark ? '#090d16' : '#ffffff',
        margin: 2
      });
    } catch {
      return '';
    }
  }, [upiUri, isDark]);

  const handleOpenModal = () => {
    setFormVpa(config?.upiVpa || '');
    setFormName(config?.payeeName || defaultPayee);
    setFormReg(config?.regNumber || '');
    setModalOpen(true);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVpa.trim()) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'UPI ID Required',
          message: 'Please provide a valid Clinic or Doctor UPI VPA (e.g. clinic@upi).',
          type: 'error'
        }
      }));
      return;
    }

    setIsSaving(true);
    const newConfig: DirectPaymentConfig = {
      upiVpa: formVpa.trim().toLowerCase(),
      payeeName: formName.trim() || defaultPayee,
      regNumber: formReg.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    safeSetStorageJSON(storageKey, newConfig);
    setConfig(newConfig);
    setIsSaving(false);
    setModalOpen(false);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Direct UPI Settled! 💳',
        message: 'Patient payments will now settle 100% directly to your registered UPI ID with 0% platform deductions.',
        type: 'success'
      }
    }));
  };

  const handleCopyVpa = () => {
    if (!activeVpa) return;
    navigator.clipboard.writeText(activeVpa);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`p-6 shadow-sm rounded-2xl space-y-5 text-left border ${
      isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200/80 text-slate-800'
    }`}>
      {/* Header */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 ${
        isDark ? 'border-slate-800' : 'border-slate-100'
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <Building2 className={`w-4 h-4 shrink-0 font-bold ${isDark ? 'text-teal-400' : 'text-indigo-600'}`} />
              {displayName} — Direct Counter Collection (Practo Model)
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              100% Direct Payout
            </span>
          </div>
          <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            NMC Ethics Code §6.4 & RBI Compliant: Patients pay your clinic account directly. Zero escrow custody, 0% platform transaction fees.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className={`px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer border ${
            isDark 
              ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700' 
              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
          }`}
        >
          {config ? 'Edit UPI & Receipt Details' : 'Configure Clinic UPI'}
        </button>
      </div>

      {/* Main Content Grid: Direct UPI QR + Settlement Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
        {/* Left Column: Direct QR Display */}
        <div className={`p-4 rounded-2xl border flex flex-col items-center text-center ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50/70 border-slate-200'
        }`}>
          {qrDataUri ? (
            <img 
              src={qrDataUri} 
              alt="Direct Clinic UPI QR" 
              className="w-36 h-36 rounded-xl border border-slate-200 dark:border-slate-800 bg-white p-1.5 shadow-sm select-none"
            />
          ) : (
            <div className="w-36 h-36 rounded-xl border border-dashed flex items-center justify-center text-slate-400">
              <QrCode className="w-10 h-10" />
            </div>
          )}
          <span className="text-[10px] font-mono text-slate-500 font-bold mt-2">
            Scan to Pay Directly (Any UPI App)
          </span>
        </div>

        {/* Right 2 Columns: Credentials & Compliance Assurance */}
        <div className="md:col-span-2 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <div>
              <span className="text-[9.5px] uppercase font-black text-slate-400 block tracking-wider">
                Active Receiving UPI VPA
              </span>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-teal-400">
                {activeVpa}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyVpa}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied VPA' : 'Copy VPA'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <span className="text-[9.5px] uppercase font-black text-slate-400 block">Registered Payee Name</span>
              <span className="font-bold text-slate-800 dark:text-white truncate block mt-0.5">{activeName}</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <span className="text-[9.5px] uppercase font-black text-slate-400 block">Registration / GSTIN</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 truncate block mt-0.5">
                {config?.regNumber || 'Self-Employed Clinical Establishment'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-[10.5px] text-emerald-800 dark:text-emerald-300 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <span>
              <strong>Zero Payment Aggregator Liability:</strong> VitalSync never holds patient funds in escrow or takes transaction cuts. 100% of patient fees land instantly in your bank account, and any partner vendor settlement occurs offline via standard commercial B2B invoices.
            </span>
          </div>
        </div>
      </div>

      {/* Edit Direct UPI & Branding Modal */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in text-slate-800">
          <div className={`max-w-md w-full p-6 shadow-2xl relative overflow-hidden space-y-4 rounded-3xl border ${
            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-start border-b pb-3 border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2 text-slate-800 dark:text-white">
                  <Building2 className="w-4 h-4 text-indigo-600 dark:text-teal-400 shrink-0" />
                  Clinic Direct UPI & Branding Setup
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Set up your clinic's own receiving UPI VPA for patient bills and receipts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg border-0 bg-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs text-left">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Clinic Direct UPI ID (VPA) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. drsharma@okaxis or clinicname@upi"
                  value={formVpa}
                  onChange={(e) => setFormVpa(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 block">
                  Payments made by patients scan directly to this UPI address.
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Payee / Clinic Trade Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Care Polyclinic"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Registration / GSTIN / Drug License No. (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. BR-CLN-2026-9041 or DL-20B-1142"
                  value={formReg}
                  onChange={(e) => setFormReg(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="p-3 border rounded-xl text-[10.5px] leading-relaxed bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40 text-blue-900 dark:text-blue-300">
                <strong>⚖️ Legal Shield:</strong> We do not collect bank account numbers or IFSC codes. Mediflow acts purely as a clinical ERP software providing unified billing and digital records.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-center text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl text-center text-xs font-bold border-0 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow"
                >
                  {isSaving ? 'Saving...' : 'Save & Activate Direct UPI'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});
SettlementWidget.displayName = 'SettlementWidget';
