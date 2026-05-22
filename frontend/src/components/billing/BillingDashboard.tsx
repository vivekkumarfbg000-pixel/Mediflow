import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { UnifiedInvoice } from '../../types';
import { 
  QrCode, 
  IndianRupee, 
  CheckCircle, 
  CreditCard, 
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
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT COLUMN: Invoices list */}
      <div className="lg:col-span-4 space-y-8">
        
        {/* Invoice Pipeline */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-rose-500 animate-pulse-subtle" /> Unified Bill Ledger
          </h2>

          <div className="space-y-4">
            {/* Pending Invoices */}
            <div>
              <h3 className="font-bold text-[10px] text-clinical-400 uppercase tracking-wider mb-2.5">Pending Payments ({pendingInvoices.length})</h3>
              {pendingInvoices.length === 0 ? (
                <div className="p-3 bg-clinical-950/40 border border-clinical-855 rounded-xl text-center text-[11px] text-clinical-500">
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
                        className={`w-full text-left p-3.5 rounded-xl border transition-all duration-300 ${
                          isSelected 
                            ? 'bg-rose-950/20 border-rose-500 shadow-md' 
                            : 'bg-clinical-900/40 border-clinical-800 hover:border-clinical-700'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-white text-xs">{inv.patientName}</span>
                          <span className="font-extrabold text-white text-xs flex items-center">
                            <IndianRupee className="h-3 w-3" />{inv.totalAmount}
                          </span>
                        </div>
                        <p className="text-[10px] text-clinical-500 mt-1 uppercase">ID: {inv.id}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cleared Invoices */}
            <div className="border-t border-clinical-800/80 pt-4">
              <h3 className="font-bold text-[10px] text-clinical-400 uppercase tracking-wider mb-2.5">Cleared Invoices ({clearedInvoices.length})</h3>
              {clearedInvoices.length === 0 ? (
                <div className="text-center py-4 text-clinical-500 text-xs">No settled invoices recorded today.</div>
              ) : (
                <div className="space-y-2">
                  {clearedInvoices.map(inv => {
                    const isSelected = selectedInvoice?.id === inv.id;
                    return (
                      <button
                        key={inv.id}
                        onClick={() => handleSelectInvoice(inv)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all duration-300 ${
                          isSelected 
                            ? 'bg-clinical-800/80 border-clinical-700 text-white' 
                            : 'bg-clinical-900/40 border-clinical-800 hover:border-clinical-700'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-clinical-300 text-xs">{inv.patientName}</span>
                          <span className="font-extrabold text-emerald-400 text-xs flex items-center">
                            <IndianRupee className="h-3 w-3" />{inv.totalAmount}
                          </span>
                        </div>
                        <p className="text-[9px] text-emerald-500 font-bold uppercase mt-1">Cleared</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 glass-panel p-6">
            
            {/* Split breakdown details */}
            <div className="space-y-6">
              <div className="border-b border-clinical-800 pb-4">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                  selectedInvoice.paymentStatus === 'pending'
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}>
                  Invoice {selectedInvoice.paymentStatus}
                </span>
                <h3 className="font-extrabold text-white text-lg mt-3 flex items-center gap-1">
                  Unified Split-Bill <span className="text-clinical-400 font-medium text-xs font-mono uppercase">({selectedInvoice.id})</span>
                </h3>
                <p className="text-xs text-clinical-400 mt-1">Patient: <strong className="text-white">{selectedInvoice.patientName}</strong> (+91 {selectedInvoice.patientPhone})</p>
              </div>

              {/* Bill Split visual catalog */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-clinical-400 uppercase tracking-wider">Multi-Vendor Ledger Allocation</h4>
                
                {/* 1. Doctor consultation cut */}
                <div className="flex items-center justify-between p-3 bg-clinical-950/60 rounded-xl border border-clinical-800">
                  <div className="flex items-center gap-2 text-xs">
                    <User className="h-4 w-4 text-primary-400" />
                    <div>
                      <span className="font-bold block text-white">Clinic Consultation Fee</span>
                      <span className="text-[9px] text-clinical-500">Destination: Dr. Clinic Wallet</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-xs text-white flex items-center">
                    <IndianRupee className="h-3.5 w-3.5" />{selectedInvoice.doctorFee}
                  </span>
                </div>

                {/* 2. Laboratory cut */}
                <div className="flex items-center justify-between p-3 bg-clinical-950/60 rounded-xl border border-clinical-800">
                  <div className="flex items-center gap-2 text-xs">
                    <Building className="h-4 w-4 text-blue-400" />
                    <div>
                      <span className="font-bold block text-white">Diagnostic Pathology Charge</span>
                      <span className="text-[9px] text-clinical-500">Destination: Lab Partner Wallet</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-xs text-white flex items-center">
                    <IndianRupee className="h-3.5 w-3.5" />{selectedInvoice.labFee}
                  </span>
                </div>

                {/* 3. Pharmacy POS cut */}
                <div className="flex items-center justify-between p-3 bg-clinical-950/60 rounded-xl border border-clinical-800">
                  <div className="flex items-center gap-2 text-xs">
                    <Building className="h-4 w-4 text-emerald-400" />
                    <div>
                      <span className="font-bold block text-white">Pharmacy Medicine Holds Fee</span>
                      <span className="text-[9px] text-clinical-500">Destination: Pharmacy Partner Wallet</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-xs text-white flex items-center">
                    <IndianRupee className="h-3.5 w-3.5" />{selectedInvoice.pharmacyFee}
                  </span>
                </div>

                {/* 4. Platform fee commission */}
                <div className="flex items-center justify-between p-3 bg-clinical-950/60 rounded-xl border border-clinical-800">
                  <div className="flex items-center gap-2 text-xs">
                    <Coins className="h-4 w-4 text-rose-400" />
                    <div>
                      <span className="font-bold block text-white">Mediflow SaaS Platform Fee</span>
                      <span className="text-[9px] text-clinical-500">System Charge (Gross Margin Protection)</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-xs text-white flex items-center">
                    <IndianRupee className="h-3.5 w-3.5" />{selectedInvoice.platformFee}
                  </span>
                </div>

              </div>

              {/* Total Aggregate Sum */}
              <div className="p-4 bg-clinical-900 border border-clinical-850 rounded-2xl flex items-center justify-between shadow">
                <span className="font-bold text-sm text-clinical-300">Total Invoice Amount</span>
                <span className="font-black text-white text-xl flex items-center">
                  <IndianRupee className="h-5 w-5 text-accent-400" />{selectedInvoice.totalAmount}
                </span>
              </div>
            </div>

            {/* UPI Dynamic QR Code Simulator */}
            <div className="flex flex-col items-center justify-center p-6 border-l border-clinical-800/80 space-y-6">
              
              {selectedInvoice.paymentStatus === 'pending' ? (
                <>
                  <h4 className="font-bold text-xs text-clinical-400 uppercase tracking-wider text-center">Unified UPI Instant Split Payment</h4>
                  
                  {/* Dynamic Mock QR Code design (SVG/Visual markup) */}
                  <div className="bg-white p-4 rounded-3xl border-4 border-clinical-200 shadow-xl w-48 h-48 flex items-center justify-center relative overflow-hidden group">
                    
                    {/* Simulated scanning scanline animate indicator */}
                    <div className="absolute left-0 right-0 h-0.5 bg-rose-500/80 animate-bounce top-4 z-10"></div>
                    
                    {/* Dynamic styled visual QR code representation */}
                    <div className="w-full h-full relative grid grid-cols-5 grid-rows-5 gap-1 select-none">
                      {/* Anchor square TL */}
                      <div className="col-span-2 row-span-2 bg-clinical-950 rounded-lg p-1">
                        <div className="w-full h-full bg-white rounded-md p-1">
                          <div className="w-full h-full bg-clinical-950 rounded-sm"></div>
                        </div>
                      </div>
                      {/* Pattern dots */}
                      <div className="bg-clinical-950 rounded-sm"></div>
                      {/* Anchor square TR */}
                      <div className="col-span-2 row-span-2 col-start-4 bg-clinical-950 rounded-lg p-1">
                        <div className="w-full h-full bg-white rounded-md p-1">
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
                      <div className="col-span-2 row-span-2 row-start-4 bg-clinical-950 rounded-lg p-1">
                        <div className="w-full h-full bg-white rounded-md p-1">
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
                      <div className="absolute inset-0 m-auto w-8 h-8 rounded-lg bg-white border border-clinical-200 shadow flex items-center justify-center font-black text-[8px] text-primary-600 tracking-tighter">
                        M-FLOW
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-clinical-500 font-medium text-center">
                    Scan with any UPI application (BHIM, GooglePay, PhonePe, Paytm). Payment splits dynamically inside bank routers.
                  </p>

                  <button
                    onClick={() => handleSimulatePayment(selectedInvoice.id)}
                    disabled={isSimulatingPayment}
                    className="w-full btn-primary font-bold flex items-center justify-center gap-2 active:scale-95 shadow"
                  >
                    {isSimulatingPayment ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Settling Dynamic UPI Routing...
                      </>
                    ) : (
                      <>
                        <QrCode className="h-5 w-5" /> Simulate UPI Callback Success
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="text-center space-y-4 py-8 animate-fade-in">
                  <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full inline-block border border-emerald-500/20">
                    <ShieldCheck className="h-12 w-12 text-emerald-500 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-base">UPI Split-Settlement Successful</h4>
                    <p className="text-xs text-emerald-400 mt-1">Transaction Cleared. Bank Callback Logged.</p>
                  </div>
                  
                  <div className="bg-clinical-950 border border-clinical-800 p-4 rounded-2xl text-[10px] text-left leading-relaxed text-clinical-400 font-mono space-y-1">
                    <p className="text-clinical-300 font-sans font-bold">Ledger Settlement Logs:</p>
                    <p>• Cr Clinic Account: +INR {selectedInvoice.doctorFee}.00</p>
                    <p>• Cr Lab Account: +INR {selectedInvoice.labFee}.00</p>
                    <p>• Cr Pharmacy Account: +INR {selectedInvoice.pharmacyFee}.00</p>
                    <p>• Cr Platform Fee Account: +INR {selectedInvoice.platformFee}.00</p>
                    <p className="text-emerald-400 mt-2 font-sans font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Status: SETTLED_SUCCESS</p>
                  </div>
                </div>
              )}

            </div>

          </div>
        ) : (
          <div className="glass-panel p-8 text-center text-clinical-500 text-sm h-64 flex flex-col items-center justify-center">
            <AlertCircle className="h-10 w-10 text-clinical-600 mb-2" />
            No active billing invoice generated in ecosystem queue yet.
          </div>
        )}
      </div>
    </div>
  );
};
