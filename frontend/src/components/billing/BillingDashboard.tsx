import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { UnifiedInvoice } from '../../types';
import { 
  QrCode, 
  CheckCircle, 
  Coins, 
  Building,
  User,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const BillingDashboard: React.FC = () => {
  const [invoices, setInvoices] = useState<UnifiedInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<UnifiedInvoice | null>(null);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);

  useEffect(() => {
    const list = api.getUnifiedInvoices();
    setInvoices(list);
    if (list.length > 0) {
      setSelectedInvoice(list[0]);
    }
  }, []);

  const handleSelectInvoice = (inv: UnifiedInvoice) => {
    setSelectedInvoice(inv);
  };

  const handleSimulatePayment = (id: string) => {
    setIsSimulatingPayment(true);

    // Simulate UPI settlement callbacks
    setTimeout(() => {
      api.clearInvoice(id);
      
      // Update local state lists
      setInvoices(api.getUnifiedInvoices());
      const updated = api.getUnifiedInvoices().find(i => i.id === id);
      if (updated) {
        setSelectedInvoice(updated);
      }
      
      setIsSimulatingPayment(false);
    }, 2000);
  };

  const pendingInvoices = invoices.filter(i => i.paymentStatus === 'pending');
  const clearedInvoices = invoices.filter(i => i.paymentStatus === 'cleared');

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      {/* LEFT COLUMN: Invoices list */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Invoice Pipeline */}
        <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-rose-500 to-primary opacity-50" />
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-400 text-xl">account_balance_wallet</span>
            Unified Bill Ledger
          </h2>

          <div className="space-y-5">
            {/* Pending Invoices */}
            <div>
              <h3 className="font-bold text-[10px] text-clinical-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Pending Payments ({pendingInvoices.length})
              </h3>
              {pendingInvoices.length === 0 ? (
                <div className="p-4 bg-surface-container-lowest/40 border border-outline-variant rounded-xl text-center text-xs text-clinical-500">
                  All accounts settled.
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingInvoices.map(inv => {
                    const isSelected = selectedInvoice?.id === inv.id;
                    return (
                      <button
                        key={inv.id}
                        onClick={() => handleSelectInvoice(inv)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden ${
                          isSelected 
                            ? 'bg-surface-container border-rose-500/80 shadow-md' 
                            : 'bg-surface-container-lowest border-outline-variant hover:border-outline hover:bg-surface-container-low'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-rose-500" />
                        )}
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-white text-xs group-hover:text-rose-400 transition-colors">{inv.patientName}</span>
                          <span className="font-bold text-white text-xs flex items-center font-mono">
                            INR {inv.totalAmount}.00
                          </span>
                        </div>
                        <p className="text-[9px] text-clinical-400 mt-2 font-mono tracking-wider uppercase bg-surface-container-high px-1.5 py-0.5 rounded w-max">
                          ID: {inv.id.toUpperCase()}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cleared Invoices */}
            <div className="border-t border-outline-variant pt-4">
              <h3 className="font-bold text-[10px] text-clinical-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Cleared Invoices ({clearedInvoices.length})
              </h3>
              {clearedInvoices.length === 0 ? (
                <div className="text-center py-6 text-clinical-500 text-xs">No settled invoices recorded today.</div>
              ) : (
                <div className="space-y-2">
                  {clearedInvoices.map(inv => {
                    const isSelected = selectedInvoice?.id === inv.id;
                    return (
                      <button
                        key={inv.id}
                        onClick={() => handleSelectInvoice(inv)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden ${
                          isSelected 
                            ? 'bg-surface-container border-emerald-500/80 text-white' 
                            : 'bg-surface-container-lowest border-outline-variant hover:border-outline hover:bg-surface-container-low'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-emerald-500" />
                        )}
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-clinical-300 text-xs group-hover:text-emerald-400 transition-colors">{inv.patientName}</span>
                          <span className="font-bold text-emerald-400 text-xs flex items-center font-mono">
                            INR {inv.totalAmount}.00
                          </span>
                        </div>
                        <p className="text-[9px] text-emerald-400 font-bold uppercase mt-2 tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-[10px]">check_circle</span>
                          Cleared
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Split breakdown & Simulated UPI QR Code */}
      <div className="lg:col-span-8">
        {selectedInvoice ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary via-secondary to-rose-500 opacity-50" />
            
            {/* Split breakdown details */}
            <div className="space-y-6">
              <div className="border-b border-outline-variant pb-4">
                <span className={`text-[9px] font-bold px-3 py-1 rounded-full border uppercase tracking-widest font-mono ${
                  selectedInvoice.paymentStatus === 'pending'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  Invoice {selectedInvoice.paymentStatus}
                </span>
                <h3 className="font-bold text-white text-lg mt-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary">account_balance</span>
                  Unified Split-Bill
                  <span className="text-clinical-400 font-medium text-xs font-mono uppercase bg-surface-container-high px-2 py-0.5 rounded ml-1">
                    ({selectedInvoice.id})
                  </span>
                </h3>
                <p className="text-xs text-clinical-400 mt-1.5">Patient: <strong className="text-white font-semibold">{selectedInvoice.patientName}</strong> (+91 {selectedInvoice.patientPhone})</p>
              </div>

              {/* Bill Split visual catalog */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-clinical-300 uppercase tracking-widest font-mono text-[10px]">Multi-Vendor Ledger Allocation</h4>
                
                {/* 1. Doctor consultation cut */}
                <div className="flex items-center justify-between p-4 bg-surface-container-lowest/80 rounded-xl border border-outline-variant hover:border-outline/30 transition-all">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-lg">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold block text-white text-xs">Clinic Consultation Fee</span>
                      <span className="text-[9px] text-clinical-400 mt-0.5 font-mono">DR_CLINIC_WALLET_01</span>
                    </div>
                  </div>
                  <span className="font-bold text-xs text-white flex items-center font-mono">
                    INR {selectedInvoice.doctorFee}.00
                  </span>
                </div>

                {/* 2. Laboratory cut */}
                <div className="flex items-center justify-between p-4 bg-surface-container-lowest/80 rounded-xl border border-outline-variant hover:border-outline/30 transition-all">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="p-2 bg-secondary/10 border border-secondary/20 text-secondary rounded-lg">
                      <Building className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold block text-white text-xs">Diagnostic Pathology Charge</span>
                      <span className="text-[9px] text-clinical-400 mt-0.5 font-mono">LAB_PARTNER_WALLET_02</span>
                    </div>
                  </div>
                  <span className="font-bold text-xs text-white flex items-center font-mono">
                    INR {selectedInvoice.labFee}.00
                  </span>
                </div>

                {/* 3. Pharmacy POS cut */}
                <div className="flex items-center justify-between p-4 bg-surface-container-lowest/80 rounded-xl border border-outline-variant hover:border-outline/30 transition-all">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                      <Building className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold block text-white text-xs">Pharmacy Medicine Holds Fee</span>
                      <span className="text-[9px] text-clinical-400 mt-0.5 font-mono">PHARMACY_PARTNER_WALLET_03</span>
                    </div>
                  </div>
                  <span className="font-bold text-xs text-white flex items-center font-mono">
                    INR {selectedInvoice.pharmacyFee}.00
                  </span>
                </div>

                {/* 4. Platform fee commission */}
                <div className="flex items-center justify-between p-4 bg-surface-container-lowest/80 rounded-xl border border-outline-variant hover:border-outline/30 transition-all">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
                      <Coins className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold block text-white text-xs">Mediflow SaaS Platform Fee</span>
                      <span className="text-[9px] text-clinical-400 mt-0.5 font-mono">SYSTEM_ESCROW_PROTECT</span>
                    </div>
                  </div>
                  <span className="font-bold text-xs text-white flex items-center font-mono">
                    INR {selectedInvoice.platformFee}.00
                  </span>
                </div>

              </div>

              {/* Total Aggregate Sum */}
              <div className="p-4 bg-surface-container border border-outline-variant rounded-xl flex items-center justify-between shadow-inner">
                <span className="font-bold text-xs text-clinical-300 uppercase tracking-widest font-mono">Total Invoice Amount</span>
                <span className="font-black text-white text-lg flex items-center font-mono">
                  INR {selectedInvoice.totalAmount}.00
                </span>
              </div>
            </div>

            {/* UPI Dynamic QR Code Simulator */}
            <div className="flex flex-col items-center justify-center p-6 border-t md:border-t-0 md:border-l border-outline-variant space-y-6 relative">
              
              {selectedInvoice.paymentStatus === 'pending' ? (
                <>
                  <h4 className="font-bold text-[10px] text-clinical-300 uppercase tracking-widest font-mono text-center flex items-center gap-1 justify-center">
                    <span className="material-symbols-outlined text-xs animate-pulse text-rose-400">qr_code_2</span>
                    UNIFIED UPI SPLIT-WALLET ROUTER
                  </h4>
                  
                  {/* Dynamic Mock QR Code design */}
                  <div className="scanner-container bg-white p-5 rounded-3xl border border-clinical-200 shadow-2xl w-48 h-48 flex items-center justify-center relative overflow-hidden group">
                    
                    {/* Simulated scanning laser overlays */}
                    <div className="scanner-beam" />
                    
                    {/* Dynamic styled visual QR code representation */}
                    <div className="w-full h-full relative grid grid-cols-5 grid-rows-5 gap-1.5 select-none">
                      {/* Anchor square TL */}
                      <div className="col-span-2 row-span-2 bg-clinical-950 rounded-lg p-[3px]">
                        <div className="w-full h-full bg-white rounded-md p-[3px]">
                          <div className="w-full h-full bg-clinical-950 rounded-sm"></div>
                        </div>
                      </div>
                      {/* Pattern dots */}
                      <div className="bg-clinical-950 rounded-sm"></div>
                      {/* Anchor square TR */}
                      <div className="col-span-2 row-span-2 col-start-4 bg-clinical-950 rounded-lg p-[3px]">
                        <div className="w-full h-full bg-white rounded-md p-[3px]">
                          <div className="w-full h-full bg-clinical-950 rounded-sm"></div>
                        </div>
                      </div>
                      <div className="bg-clinical-950 rounded-sm col-start-3 row-start-2"></div>
                      {/* Middle dots pattern */}
                      <div className="bg-clinical-950 rounded-sm row-start-3 col-start-1"></div>
                      <div className="bg-clinical-950 rounded-sm row-start-3 col-start-2"></div>
                      <div className="bg-clinical-950 rounded-sm row-start-3 col-start-3"></div>
                      <div className="bg-clinical-950 rounded-sm row-start-3 col-start-4"></div>
                      <div className="bg-clinical-950 rounded-sm row-start-3 col-start-5"></div>
                      {/* Anchor square BL */}
                      <div className="col-span-2 row-span-2 row-start-4 bg-clinical-950 rounded-lg p-[3px]">
                        <div className="w-full h-full bg-white rounded-md p-[3px]">
                          <div className="w-full h-full bg-clinical-950 rounded-sm"></div>
                        </div>
                      </div>
                      <div className="bg-clinical-950 rounded-sm row-start-4 col-start-3"></div>
                      <div className="bg-clinical-950 rounded-sm row-start-4 col-start-4"></div>
                      <div className="bg-clinical-950 rounded-sm row-start-4 col-start-5"></div>
                      <div className="bg-clinical-950 rounded-sm row-start-5 col-start-3"></div>
                      <div className="bg-clinical-950 rounded-sm row-start-5 col-start-4"></div>
                      <div className="bg-clinical-950 rounded-sm row-start-5 col-start-5"></div>
                      
                      {/* Tiny center branding */}
                      <div className="absolute inset-0 m-auto w-9 h-9 rounded-lg bg-white border border-clinical-200 shadow-md flex items-center justify-center font-black text-[8px] text-primary-600 tracking-tighter">
                        M-FLOW
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-clinical-400 font-medium text-center leading-relaxed">
                    Scan with any UPI application (BHIM, GooglePay, PhonePe, Paytm). Payment splits dynamically inside bank routers.
                  </p>

                  <button
                    onClick={() => handleSimulatePayment(selectedInvoice.id)}
                    disabled={isSimulatingPayment}
                    className="w-full btn-primary font-bold flex items-center justify-center gap-1.5 active:scale-95 shadow cursor-pointer bg-gradient-to-r from-rose-500 to-primary text-xs"
                  >
                    {isSimulatingPayment ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Settling Dynamic UPI Routing...
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4.5 w-4.5" /> Simulate UPI Callback Success
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="text-center space-y-4 py-3 animate-fade-in w-full">
                  <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <ShieldCheck className="h-8 w-8 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">UPI Split-Settlement Successful</h4>
                    <p className="text-xs text-emerald-400 mt-1">Transaction Cleared. Bank Callback Logged.</p>
                  </div>
                  
                  {/* Ledger Callback logs */}
                  <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl text-[10px] text-left leading-relaxed text-clinical-300 font-mono space-y-1.5 shadow-inner">
                    <p className="text-clinical-400 font-sans font-bold uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1 border-b border-outline-variant pb-1.5">
                      <span className="material-symbols-outlined text-xs text-emerald-400">terminal</span>
                      Gateway Callback Ledger Logs
                    </p>
                    <p>• Cr Clinic Account: +INR {selectedInvoice.doctorFee}.00</p>
                    <p>• Cr Lab Account: +INR {selectedInvoice.labFee}.00</p>
                    <p>• Cr Pharmacy Account: +INR {selectedInvoice.pharmacyFee}.00</p>
                    <p>• Cr Platform Fee Account: +INR {selectedInvoice.platformFee}.00</p>
                    <p className="text-emerald-400 mt-2.5 font-sans font-bold flex items-center gap-1 border-t border-outline-variant/60 pt-1.5"><CheckCircle className="h-3 w-3" /> Status: SETTLED_SUCCESS</p>
                  </div>
                </div>
              )}

            </div>

          </div>
        ) : (
          <div className="glass-panel p-8 text-center text-clinical-500 text-sm h-64 flex flex-col items-center justify-center border-white/10 shadow-xl">
            <AlertCircle className="h-10 w-10 text-clinical-600 mb-2" />
            No active billing invoice generated in ecosystem queue yet.
          </div>
        )}
      </div>
    </div>
  );
};
