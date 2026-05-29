import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface SettlementWidgetProps {
  entityId: string;
  podId: string;
  entityType: 'clinic' | 'pharmacy' | 'lab';
  displayName?: string;
  theme?: 'light' | 'dark';
}

export const SettlementWidget: React.FC<SettlementWidgetProps> = React.memo(({
  entityId,
  podId,
  entityType,
  displayName = 'Settlement Account',
  theme = 'light'
}) => {
  const [activeVendor, setActiveVendor] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [vendorHolderName, setVendorHolderName] = useState('');
  const [vendorAccountNumber, setVendorAccountNumber] = useState('');
  const [vendorIfsc, setVendorIfsc] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Cashfree vendor connection for the entity
  const fetchVendor = async () => {
    if (!podId || !entityId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cashfree_vendors')
        .select('*')
        .eq('pod_id', podId)
        .eq('entity_id', entityId)
        .maybeSingle();

      if (!error) {
        setActiveVendor(data || null);
      }
    } catch (err) {
      console.error('[SettlementWidget] Failed to fetch vendor connection:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendor();
  }, [podId, entityId]);

  const handleDisconnect = async () => {
    if (!activeVendor) return;
    if (!window.confirm("Are you sure you want to disconnect this settlement bank account? Split settlements will revert to central system billing.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('cashfree_vendors')
        .delete()
        .eq('id', activeVendor.id);

      if (error) {
        alert("Error disconnecting account: " + error.message);
      } else {
        setActiveVendor(null);
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Account Disconnected! 🔴',
            message: 'Cashfree sub-account settlement channel detached successfully.',
            type: 'info'
          }
        }));
      }
    } catch (err: any) {
      alert("Failed to disconnect account: " + (err.message || err));
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorHolderName || !vendorAccountNumber || !vendorIfsc) {
      alert("Please fill in all banking details.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Trigger the Edge Function cashfree-vendor-sync using Supabase invoke
      const { data: resData, error: invokeErr } = await supabase.functions.invoke('cashfree-vendor-sync', {
        body: {
          holderName: vendorHolderName.trim(),
          accountNumber: vendorAccountNumber.trim(),
          ifsc: vendorIfsc.trim().toUpperCase(),
          email: vendorEmail.trim() || undefined,
          phone: vendorPhone.trim() || undefined,
          entityId,
          podId
        }
      });

      if (invokeErr || !resData || resData.error) {
        throw new Error(invokeErr?.message ?? resData?.error ?? "Registration API failed.");
      }

      setActiveVendor(resData.record);
      setVendorFormOpen(false);

      // Clear fields
      setVendorAccountNumber('');
      setVendorIfsc('');
      setVendorEmail('');
      setVendorPhone('');

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Bank Settlements Configured! 💳',
          message: `Cashfree sub-account splits are now active for your ${entityType}.`,
          type: 'success'
        }
      }));
    } catch (err: any) {
      alert("Bank onboarding registration failed: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDark = theme === 'dark';

  if (loading) {
    return (
      <div className={`p-6 rounded-2xl flex items-center justify-center ${isDark ? 'text-clinical-400' : 'text-slate-400'}`}>
        <span className="material-symbols-outlined animate-spin text-xl">autorenew</span>
        <span className="text-xs ml-2">Loading banking configurations...</span>
      </div>
    );
  }

  return (
    <div className={`glass-panel p-6 shadow-sm rounded-2xl space-y-4 text-left border ${
      isDark ? 'bg-surface-container border-outline-variant text-white' : 'bg-white border-slate-200/80 text-slate-800'
    }`}>
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-3 ${
        isDark ? 'border-white/10' : 'border-slate-100'
      }`}>
        <div>
          <h2 className="text-sm font-bold flex items-center gap-1.5">
            <span className={`material-symbols-outlined text-base font-bold ${isDark ? 'text-secondary' : 'text-primary'}`}>account_balance</span>
            {displayName} Bank Onboarding (Cashfree splits)
          </h2>
          <p className={`text-[10px] mt-0.5 ${isDark ? 'text-clinical-400' : 'text-slate-405'}`}>
            Provide official bank credentials to activate automated UPI payment settlements.
          </p>
        </div>
        
        {!activeVendor && (
          <button
            onClick={() => {
              setVendorHolderName('');
              setVendorFormOpen(true);
            }}
            className={`px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer border-0 ${
              isDark 
                ? 'bg-gradient-to-r from-secondary to-primary text-black hover:scale-105 active:scale-95' 
                : 'bg-primary hover:bg-primary-500 text-white text-white-force'
            }`}
          >
            Configure Bank Account
          </button>
        )}
      </div>

      {activeVendor ? (
        <div className={`flex flex-col md:flex-row items-center justify-between gap-4 p-4 border rounded-2xl ${
          isDark 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-emerald-50/50 border-emerald-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold shadow-sm ${
              isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100/60 text-emerald-600'
            }`}>
              <span className="material-symbols-outlined text-xl">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-xs font-bold ${isDark ? 'text-emerald-300' : 'text-slate-800'}`}>Verified Settlement Account</h3>
                <span className={`text-[8px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-105 text-emerald-700'
                }`}>Active</span>
              </div>
              <div className={`text-[10px] font-mono mt-1 space-y-0.5 ${isDark ? 'text-clinical-400' : 'text-slate-500'}`}>
                <div>Holder Name: <strong className={isDark ? 'text-white' : 'text-slate-700 font-sans'}>{activeVendor.holder_name}</strong></div>
                <div>Vendor ID: <strong className={isDark ? 'text-white' : 'text-slate-655'}>{activeVendor.vendor_id}</strong> • Bank Account: <strong className={isDark ? 'text-white' : 'text-slate-655'}>XXXX-XXXX-XXXX-{activeVendor.bank_account_last4}</strong></div>
              </div>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className={`px-3.5 py-1.5 border rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              isDark 
                ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10' 
                : 'border-rose-200 text-rose-600 hover:bg-rose-50'
            }`}
          >
            Disconnect Account
          </button>
        </div>
      ) : (
        <div className={`p-8 border border-dashed rounded-2xl text-center space-y-2 ${
          isDark ? 'border-outline-variant bg-black/20' : 'border-slate-205 bg-slate-50/50'
        }`}>
          <span className={`material-symbols-outlined text-4xl ${isDark ? 'text-clinical-500' : 'text-slate-300'}`}>account_balance_wallet</span>
          <div>
            <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>No Settlement Account Configured</h4>
            <p className={`text-[10px] mt-1 max-w-sm mx-auto ${isDark ? 'text-clinical-400' : 'text-slate-400'}`}>
              Provide your official bank account credentials to activate split payout settlements. Direct earnings will bypass central platform balance reserves.
            </p>
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      {vendorFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in text-slate-808">
          <div className={`glass-panel max-w-md w-full p-6 shadow-2xl relative overflow-hidden space-y-4 rounded-3xl ${
            isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className={`absolute top-0 left-0 w-full h-[3px] ${isDark ? 'bg-secondary' : 'bg-primary'}`} />
            
            <div className="flex justify-between items-start">
              <div>
                <h3 className={`text-sm font-extrabold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  <span className={`material-symbols-outlined font-bold ${isDark ? 'text-secondary' : 'text-primary'}`}>account_balance</span>
                  Bank Settlements Setup
                </h3>
                <p className={`text-[11px] mt-1 ${isDark ? 'text-clinical-400' : 'text-slate-400'}`}>
                  Configure Cashfree Marketplace vendor sub-account details.
                </p>
              </div>
              <button
                onClick={() => setVendorFormOpen(false)}
                className={`p-1 rounded-lg border-0 bg-transparent transition-colors cursor-pointer ${
                  isDark ? 'text-clinical-400 hover:text-white' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-3.5 text-xs font-sans text-left">
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-clinical-400' : 'text-slate-500'}`}>Account Holder Name</label>
                <input
                  type="text"
                  required
                  placeholder="Official Bank Account Name"
                  value={vendorHolderName}
                  onChange={(e) => setVendorHolderName(e.target.value)}
                  className={`w-full input-field py-2 px-3 text-xs ${
                    isDark ? 'bg-surface-container border-outline-variant text-white focus:ring-secondary focus:border-secondary' : 'bg-white'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-clinical-400' : 'text-slate-500'}`}>Bank Account Number</label>
                  <input
                    type="text"
                    required
                    placeholder="Account Number"
                    value={vendorAccountNumber}
                    onChange={(e) => setVendorAccountNumber(e.target.value)}
                    className={`w-full input-field py-2 px-3 text-xs font-mono ${
                      isDark ? 'bg-surface-container border-outline-variant text-white focus:ring-secondary focus:border-secondary' : 'bg-white'
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-clinical-400' : 'text-slate-500'}`}>Bank IFSC Code</label>
                  <input
                    type="text"
                    required
                    placeholder="IFSC Code"
                    value={vendorIfsc}
                    onChange={(e) => setVendorIfsc(e.target.value)}
                    className={`w-full input-field py-2 px-3 text-xs font-mono ${
                      isDark ? 'bg-surface-container border-outline-variant text-white focus:ring-secondary focus:border-secondary' : 'bg-white'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-clinical-400' : 'text-slate-500'}`}>Business Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={vendorEmail}
                    onChange={(e) => setVendorEmail(e.target.value)}
                    className={`w-full input-field py-2 px-3 text-xs ${
                      isDark ? 'bg-surface-container border-outline-variant text-white focus:ring-secondary focus:border-secondary' : 'bg-white'
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-clinical-400' : 'text-slate-500'}`}>Contact Phone (Optional)</label>
                  <input
                    type="text"
                    placeholder="Phone number"
                    value={vendorPhone}
                    onChange={(e) => setVendorPhone(e.target.value)}
                    className={`w-full input-field py-2 px-3 text-xs font-mono ${
                      isDark ? 'bg-surface-container border-outline-variant text-white focus:ring-secondary focus:border-secondary' : 'bg-white'
                    }`}
                  />
                </div>
              </div>

              <div className={`p-3 border rounded-xl text-[10px] leading-normal ${
                isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-blue-50/50 border-blue-100 text-slate-500'
              }`}>
                * By onboard saving these details, you agree to register this entity as a sub-account vendor. Payout settlements are run daily.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVendorFormOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl text-center text-xs border cursor-pointer ${
                    isDark ? 'bg-slate-800 border-white/10 hover:bg-slate-700 text-white' : 'btn-secondary'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 py-2.5 rounded-xl text-center text-xs font-bold border-0 cursor-pointer ${
                    isDark 
                      ? 'bg-gradient-to-r from-secondary to-primary text-black hover:scale-102 active:scale-98' 
                      : 'bg-primary hover:bg-primary-500 text-white text-white-force'
                  }`}
                >
                  {isSubmitting ? 'Verifying...' : 'Verify & Onboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
