import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { UnifiedInvoice, FinancialLedgerEntry } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { 
  QrCode, 
  Coins, 
  Building,
  User,
  AlertCircle,
  Printer
} from 'lucide-react';

export const BillingDashboard: React.FC = () => {
  const [invoices, setInvoices] = useState<UnifiedInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<UnifiedInvoice | null>(null);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoice' | 'ledger' | 'analytics'>('invoice');
  const [ledgerEntries, setLedgerEntries] = useState<FinancialLedgerEntry[]>([]);

  // V2.0 Animated Split Payout Wheel Active Selection
  const [selectedNode, setSelectedNode] = useState<'escrow' | 'clinic' | 'lab' | 'pharmacy' | 'platform'>('escrow');
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setAdminEmail(session.user.email);
      }
    });
  }, []);

  const calcSplits = (inv: UnifiedInvoice) => {
    // Convert Rupee fees to integer paise
    const doctorFeePaise = Math.round(inv.doctorFee * 100);
    const labFeePaise = Math.round(inv.labFee * 100);
    const pharmacyFeePaise = Math.round(inv.pharmacyFee * 100);

    // Compute TDS (10%) in integer paise
    const docTdsPaise = Math.round(doctorFeePaise * 0.10);
    const labTdsPaise = Math.round(labFeePaise * 0.10);
    const pharmaTdsPaise = Math.round(pharmacyFeePaise * 0.10);

    // Compute CGST (9%) and SGST (9%) in integer paise
    const docCgstPaise = Math.round(doctorFeePaise * 0.09);
    const docSgstPaise = Math.round(doctorFeePaise * 0.09);
    const labCgstPaise = Math.round(labFeePaise * 0.09);
    const labSgstPaise = Math.round(labFeePaise * 0.09);
    const pharmaCgstPaise = Math.round(pharmacyFeePaise * 0.09);
    const pharmaSgstPaise = Math.round(pharmacyFeePaise * 0.09);

    // Compute Net Credits in integer paise
    const docNetPaise = doctorFeePaise - docTdsPaise;
    const labNetPaise = labFeePaise - labTdsPaise;
    const pharmaNetPaise = pharmacyFeePaise - pharmaTdsPaise;

    // Convert back to Rupees (divided by 100)
    const docTds = Math.round(docTdsPaise / 100);
    const labTds = Math.round(labTdsPaise / 100);
    const pharmaTds = Math.round(pharmaTdsPaise / 100);

    const docCgst = Math.round(docCgstPaise / 100);
    const docSgst = Math.round(docSgstPaise / 100);
    const labCgst = Math.round(labCgstPaise / 100);
    const labSgst = Math.round(labSgstPaise / 100);
    const pharmaCgst = Math.round(pharmaCgstPaise / 100);
    const pharmaSgst = Math.round(pharmaSgstPaise / 100);

    const docNet = Math.round(docNetPaise / 100);
    const labNet = Math.round(labNetPaise / 100);
    const pharmaNet = Math.round(pharmaNetPaise / 100);

    const totalTds = docTds + labTds + pharmaTds;
    const totalGst = (docCgst + docSgst) + (labCgst + labSgst) + (pharmaCgst + pharmaSgst);

    return {
      docTds, docCgst, docSgst, docNet,
      labTds, labCgst, labSgst, labNet,
      pharmaTds, pharmaCgst, pharmaSgst, pharmaNet,
      totalTds, totalGst
    };
  };

  useEffect(() => {
    const syncBilling = () => {
      const list = api.getUnifiedInvoices();
      setInvoices(list);
      setLedgerEntries(api.getFinancialLedgers());
      
      setSelectedInvoice(prev => {
        if (!prev) {
          const pending = list.filter(i => i.paymentStatus === 'pending');
          if (pending.length > 0) return pending[0];
          return list.length > 0 ? list[0] : null;
        }
        const stillExists = list.find(i => i.id === prev.id);
        return stillExists || (list.length > 0 ? list[0] : null);
      });
    };

    syncBilling();
    return api.subscribe(syncBilling);
  }, []);

  const handleSelectInvoice = (inv: UnifiedInvoice) => {
    setSelectedInvoice(inv);
    setSelectedNode('escrow');
    const patients = api.getPatients();
    const patient = patients.find(p => p.id === inv.patientId);
    if (patient) {
      api.setActivePatient(patient);
    }
  };
  const handleSimulatePayment = (id: string) => {
    setIsSimulatingPayment(true);

    // Simulate UPI settlement callbacks
    setTimeout(() => {
      api.clearInvoice(id);
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: 'UPI transaction cleared successfully. Bank router splits settled in multi-vendor wallets.',
          type: 'success',
          title: 'UPI Split Settled'
        }
      }));
      
      setIsSimulatingPayment(false);
    }, 2000);
  };

  const handlePrintLedger = () => {
    window.print();
  };

  const pendingInvoices = invoices.filter(i => i.paymentStatus === 'pending');
  const clearedInvoices = invoices.filter(i => i.paymentStatus === 'cleared');

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in print-hidden">
      
      {/* V2.0 High Precision Printable Styles & Keyframes */}
      <style>{`
        @keyframes flow {
          to { stroke-dashoffset: -24; }
        }
        .flowing-line {
          animation: flow 1.5s linear infinite;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-statement-layer, #printable-statement-layer * {
            visibility: visible;
          }
          #printable-statement-layer {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 30px;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
          }
          .print-hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* LEFT COLUMN: Invoices list */}
      <div className="lg:col-span-4 space-y-6 print-hidden">
        
        {/* Invoice Pipeline */}
        <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-rose-500 to-primary opacity-50" />
          <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-500 text-[16px]">account_balance_wallet</span>
            Unified Bill Ledger
          </h2>

          <div className="space-y-5">
            {/* Pending Invoices */}
            <div>
              <h3 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Pending Payments ({pendingInvoices.length})
              </h3>
              {pendingInvoices.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-semibold">
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
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden cursor-pointer ${
                          isSelected 
                            ? 'bg-slate-50 border-rose-500/80 shadow-md' 
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-rose-500" />
                        )}
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-slate-800 text-xs group-hover:text-rose-600 transition-colors">{inv.patientName}</span>
                          <span className="font-bold text-slate-800 text-xs flex items-center font-mono">
                            INR {inv.totalAmount}.00
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-2 font-mono tracking-wider uppercase bg-slate-100 px-1.5 py-0.5 rounded w-max">
                          ID: {inv.id.toUpperCase()}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cleared Invoices */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Cleared Invoices ({clearedInvoices.length})
              </h3>
              {clearedInvoices.length === 0 ? (
                <div className="text-center py-6 text-slate-500 font-semibold text-xs">No settled invoices recorded today.</div>
              ) : (
                <div className="space-y-2">
                  {clearedInvoices.map(inv => {
                    const isSelected = selectedInvoice?.id === inv.id;
                    return (
                      <button
                        key={inv.id}
                        onClick={() => handleSelectInvoice(inv)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden cursor-pointer ${
                          isSelected 
                            ? 'bg-slate-50 border-emerald-500/80 text-slate-800' 
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-emerald-500" />
                        )}
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-slate-600 text-xs group-hover:text-emerald-600 transition-colors">{inv.patientName}</span>
                          <span className="font-bold text-emerald-600 text-xs flex items-center font-mono">
                            INR {inv.totalAmount}.00
                          </span>
                        </div>
                        <p className="text-[9px] text-emerald-600 font-bold uppercase mt-2 tracking-wider flex items-center gap-1">
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
      <div className="lg:col-span-8 print-hidden">
        {selectedInvoice ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 border border-slate-200 shadow-xl relative overflow-hidden rounded-xl">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-600 via-cyan-600 to-rose-500 opacity-50" />
            
            {/* Split breakdown details */}
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <div className="flex justify-between items-start">
                  <span className={`text-[9px] font-bold px-3 py-1 rounded-full border uppercase tracking-widest font-mono ${
                    selectedInvoice.paymentStatus === 'pending'
                      ? 'bg-rose-50 text-rose-600 border-rose-200'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  }`}>
                    Invoice {selectedInvoice.paymentStatus}
                  </span>
                  {selectedInvoice.paymentStatus === 'cleared' && (
                    <button
                      onClick={handlePrintLedger}
                      className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print Ledger Statement
                    </button>
                  )}
                </div>
                <h3 className="font-semibold text-slate-850 text-sm mt-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-indigo-600 text-[16px]">account_balance</span>
                  Unified Split-Bill
                  <span className="text-slate-500 font-medium text-xs font-mono uppercase bg-slate-100 px-2 py-0.5 rounded ml-1">
                    ({selectedInvoice.id.substring(0, 8)}...)
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-1.5">Patient: <strong className="text-slate-800 font-semibold">{selectedInvoice.patientName}</strong> (+91 {selectedInvoice.patientPhone})</p>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-slate-100 border border-slate-200 p-1.5 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('invoice')}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'invoice'
                      ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/70'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm font-bold">receipt</span>
                  Customer Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ledger')}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'ledger'
                      ? 'bg-gradient-to-r from-cyan-600 to-rose-500 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/70'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm font-bold">account_tree</span>
                  B2B Commission Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('analytics')}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'analytics'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/70'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm font-bold">bar_chart</span>
                  Executive Analytics
                </button>
              </div>

              {activeTab === 'invoice' && (
                <>
                  {/* Bill Split visual catalog */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest font-mono">Multi-Vendor Ledger Allocation</h4>
                    
                    {/* 1. Doctor consultation cut */}
                    <div 
                      onClick={() => setSelectedNode('clinic')}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedNode === 'clinic' 
                          ? 'bg-indigo-50 border-indigo-400 shadow-lg scale-[1.01]' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-xs">
                        <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-bold block text-slate-800 text-xs">Clinic Consultation Fee</span>
                          <span className="text-[9px] text-slate-400 mt-0.5 font-mono">DR_CLINIC_WALLET_01</span>
                        </div>
                      </div>
                      <span className="font-bold text-xs text-slate-800 flex items-center font-mono">
                        INR {selectedInvoice.doctorFee}.00
                      </span>
                    </div>

                    {/* 2. Laboratory cut */}
                    <div 
                      onClick={() => setSelectedNode('lab')}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedNode === 'lab' 
                          ? 'bg-cyan-50 border-cyan-400 shadow-lg scale-[1.01]' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-xs">
                        <div className="p-2 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded-lg">
                          <Building className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-bold block text-slate-800 text-xs">Diagnostic Pathology Charge</span>
                          <span className="text-[9px] text-slate-400 mt-0.5 font-mono">LAB_PARTNER_WALLET_02</span>
                        </div>
                      </div>
                      <span className="font-bold text-xs text-slate-800 flex items-center font-mono">
                        INR {selectedInvoice.labFee}.00
                      </span>
                    </div>

                    {/* 3. Pharmacy POS cut */}
                    <div 
                      onClick={() => setSelectedNode('pharmacy')}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedNode === 'pharmacy' 
                          ? 'bg-emerald-50 border-emerald-400 shadow-lg scale-[1.01]' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-xs">
                        <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg">
                          <Building className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-bold block text-slate-800 text-xs">Pharmacy Medicine Holds Fee</span>
                          <span className="text-[9px] text-slate-400 mt-0.5 font-mono">PHARMACY_PARTNER_WALLET_03</span>
                        </div>
                      </div>
                      <span className="font-bold text-xs text-slate-800 flex items-center font-mono">
                        INR {selectedInvoice.pharmacyFee}.00
                      </span>
                    </div>

                    {/* 4. Platform fee commission */}
                    <div 
                      onClick={() => setSelectedNode('platform')}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedNode === 'platform' 
                          ? 'bg-rose-50 border-rose-400 shadow-lg scale-[1.01]' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-xs">
                        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg">
                          <Coins className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-bold block text-slate-800 text-xs">Mediflow SaaS Platform Fee</span>
                          <span className="text-[9px] text-slate-400 mt-0.5 font-mono">SYSTEM_ESCROW_PROTECT</span>
                        </div>
                      </div>
                      <span className="font-bold text-xs text-slate-800 flex items-center font-mono">
                        INR {selectedInvoice.platformFee}.00
                      </span>
                    </div>

                  </div>

                  {/* Total Aggregate Sum */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between shadow-inner">
                    <span className="font-bold text-xs text-slate-600 uppercase tracking-widest font-mono">Total Invoice Amount</span>
                    <span className="font-bold text-slate-800 text-base flex items-center font-mono">
                      INR {selectedInvoice.totalAmount}.00
                    </span>
                  </div>
                </>
              )}

              {activeTab === 'ledger' && (
                /* Tab 2: Inter-Entity Commission Ledger — Live from financial_ledgers */
                <div className="space-y-4 animate-fade-in text-xs">
                  {/* Summary Box */}
                  <div className="bg-slate-50 p-3.5 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider font-mono">UPI Escrow Settlement</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono border ${
                        selectedInvoice.paymentStatus === 'pending'
                          ? 'text-amber-600 bg-amber-50 border-amber-200'
                          : 'text-emerald-600 bg-emerald-50 border-emerald-200'
                      }`}>
                        {selectedInvoice.paymentStatus === 'pending' ? 'HELD_IN_ESCROW' : 'SETTLED_TO_WALLETS'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="p-2 bg-white border border-slate-100 rounded-lg">
                        <span className="text-slate-500 block mb-0.5 font-mono text-[9px] uppercase tracking-wider">Gross Escrow</span>
                        <strong className="text-slate-800 font-mono">INR {selectedInvoice.totalAmount}.00</strong>
                      </div>
                      <div className="p-2 bg-white border border-slate-100 rounded-lg">
                        <span className="text-slate-500 block mb-0.5 font-mono text-[9px] uppercase tracking-wider">Platform Take (5%)</span>
                        <strong className="text-rose-600 font-mono">INR {selectedInvoice.platformFee}.00</strong>
                      </div>
                      <div className="p-2 bg-white border border-slate-100 rounded-lg">
                        <span className="text-slate-500 block mb-0.5 font-mono text-[9px] uppercase tracking-wider">TDS Reserved (10%)</span>
                        <strong className="text-amber-600 font-mono">INR {calcSplits(selectedInvoice).totalTds}.00</strong>
                      </div>
                      <div className="p-2 bg-white border border-slate-100 rounded-lg">
                        <span className="text-slate-500 block mb-0.5 font-mono text-[9px] uppercase tracking-wider">Est. GST Pool (18%)</span>
                        <strong className="text-cyan-700 font-mono">INR {calcSplits(selectedInvoice).totalGst}.00</strong>
                      </div>
                    </div>
                  </div>

                  {/* Live Ledger Rows from financial_ledgers table */}
                  <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    Live Inter-Entity Payout Records
                  </h4>

                  {(() => {
                    const invoiceLedgers = ledgerEntries.filter(l => l.invoiceId === selectedInvoice.id);
                    return invoiceLedgers.length === 0 ? (
                      <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                        <span className="material-symbols-outlined text-xl text-slate-400 block mb-2">receipt_long</span>
                        <p className="text-[11px] text-slate-500">No ledger rows yet. Trigger UPI callback to generate splits.</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">DB trigger <code>trg_payment_cleared</code> populates rows on payment clearance.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-[10px]">
                          <thead className="bg-slate-100 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider font-mono text-[8px]">
                            <tr>
                              <th className="p-2.5">Type</th>
                              <th className="p-2.5">Gross</th>
                              <th className="p-2.5">Rate</th>
                              <th className="p-2.5">Net Payout</th>
                              <th className="p-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {invoiceLedgers.map(entry => (
                              <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-2.5">
                                  <span className="capitalize font-semibold text-slate-800">{entry.transactionType.replace(/_/g, ' ')}</span>
                                  <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-[80px]">{entry.destinationEntityId.substring(0, 12)}...</div>
                                </td>
                                <td className="p-2.5 font-mono text-slate-700">₹{entry.grossAmount}</td>
                                <td className="p-2.5 font-mono text-slate-500">{(entry.commissionRate * 100).toFixed(0)}%</td>
                                <td className="p-2.5 font-mono font-bold text-emerald-600">₹{entry.netPayout}</td>
                                <td className="p-2.5 text-right">
                                  <span className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded border font-mono uppercase ${
                                    entry.paymentStatus === 'cleared'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : entry.paymentStatus === 'disputed'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                                  }`}>
                                    {entry.paymentStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* Gateway References */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-mono leading-relaxed space-y-1 text-slate-500">
                    <div className="flex justify-between">
                      <span>Gateway Escrow Channel:</span>
                      <span className="text-slate-800 font-semibold">DIRECT_BANK_UPI_SPLIT_ROUTING</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bank Settlement Route ID:</span>
                      <span className="text-slate-800 font-mono uppercase font-bold">TXN_UPI_SPLIT_REF_{selectedInvoice.id.substring(0, 8).toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                /* Tab 3: Executive Analytics */
                <div className="space-y-6 animate-fade-in text-xs select-none">
                  {/* Revenue Splits 3D Cylinder Grouped Bars */}
                  <div className="p-5 border border-slate-200 shadow-lg relative overflow-hidden bg-slate-50/50 rounded-2xl">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-widest font-mono mb-4 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-emerald-600 text-sm animate-pulse">analytics</span>
                      Executive Clinic Revenue Splits & SaaS Commission
                    </h4>

                    <div className="space-y-4">
                      {[
                        { label: 'Doctor Consulting share', val: selectedInvoice.doctorFee, color: 'from-purple-500 to-indigo-600', pct: Math.round((Number(selectedInvoice.doctorFee) / Number(selectedInvoice.totalAmount)) * 100) || 0 },
                        { label: 'Pathology Lab testing share', val: selectedInvoice.labFee, color: 'from-blue-500 to-cyan-600', pct: Math.round((Number(selectedInvoice.labFee) / Number(selectedInvoice.totalAmount)) * 100) || 0 },
                        { label: 'Pharmacy Medicine checkout share', val: selectedInvoice.pharmacyFee, color: 'from-emerald-500 to-teal-600', pct: Math.round((Number(selectedInvoice.pharmacyFee) / Number(selectedInvoice.totalAmount)) * 100) || 0 },
                        { label: 'Mediflow SaaS Platform fee (5%)', val: selectedInvoice.platformFee, color: 'from-rose-500 to-red-600', pct: Math.round((Number(selectedInvoice.platformFee) / Number(selectedInvoice.totalAmount)) * 100) || 0 }
                      ].map((item, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-600">
                            <span>{item.label}</span>
                            <span className="font-mono text-slate-800">₹{item.val}.00 ({item.pct}%)</span>
                          </div>
                          {/* 3D horizontal cylinder bar */}
                          <div className="h-4 w-full bg-slate-100 rounded-full border border-slate-200/60 overflow-hidden shadow-inner p-[1px]">
                            <div 
                              className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-1000`}
                              style={{ width: `${item.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expiry and Swapper Savings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-2xl space-y-3">
                      <h5 className="font-extrabold text-slate-800 text-[10px] uppercase tracking-widest font-mono flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-amber-600 text-sm">schedule</span>
                        FEFO Expiry Burn Velocity
                      </h5>
                      <div className="flex items-center gap-4">
                        {/* CSS circular meter */}
                        <div className="relative w-12 h-12 rounded-full border-4 border-dashed border-emerald-500/30 flex items-center justify-center font-mono font-extrabold text-xs text-emerald-600">
                          94%
                        </div>
                        <div className="text-[10px] leading-relaxed text-slate-500">
                          <div className="text-slate-800 font-bold">FEFO Safety Clearance</div>
                          <div className="mt-0.5">94% of unexpired inventory batches safely rotated.</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-2xl space-y-3">
                      <h5 className="font-extrabold text-slate-800 text-[10px] uppercase tracking-widest font-mono flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-rose-500 text-sm">swap_horiz</span>
                        Generic Brand Cost Savings
                      </h5>
                      <div className="flex items-center gap-4">
                        <div className="relative w-12 h-12 rounded-full border-4 border-dashed border-rose-500/30 flex items-center justify-center font-mono font-extrabold text-xs text-rose-600">
                          ₹420
                        </div>
                        <div className="text-[10px] leading-relaxed text-slate-500">
                          <div className="text-slate-800 font-bold">Total Patient Savings</div>
                          <div className="mt-0.5">₹420 saved by swapping generic brands.</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reagent Deduction Burn velocity & Speed */}
                  <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-2xl space-y-3">
                    <h5 className="font-extrabold text-slate-800 text-[10px] uppercase tracking-widest font-mono">Reagent & Wait Time Analytics</h5>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-3 bg-slate-100 rounded-xl border border-slate-200/60">
                        <span className="text-slate-500 block text-[9px] font-mono uppercase tracking-wider">Avg Lab Wait Time</span>
                        <strong className="text-slate-850 text-base font-mono">1.8 Min</strong>
                      </div>
                      <div className="p-3 bg-slate-100 rounded-xl border border-slate-200/60">
                        <span className="text-slate-500 block text-[9px] font-mono uppercase tracking-wider">Reagents Ded. Volume</span>
                        <strong className="text-cyan-600 text-base font-mono">1.2 Litres</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* UPI Dynamic QR Code / Split Payout Wheel Simulator */}
            <div className="flex flex-col items-center justify-center p-6 border-t md:border-t-0 md:border-l border-slate-200 space-y-6 relative">
              
              {selectedInvoice.paymentStatus === 'pending' ? (
                <>
                  <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest font-mono text-center flex items-center gap-1 justify-center">
                    <span className="material-symbols-outlined text-xs animate-pulse text-rose-500">qr_code_2</span>
                    UNIFIED UPI SPLIT-WALLET ROUTER
                  </h4>
                  
                  {/* Dynamic Mock QR Code design */}
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xl w-48 h-48 flex items-center justify-center relative overflow-hidden group">
                    
                    {/* Simulated scanning laser overlays */}
                    <div className="absolute left-0 w-full h-[2px] bg-rose-500 shadow-[0_0_12px_#ef4444] laser-line z-10" />
                    
                    {/* Dynamic styled visual QR code representation */}
                    <div className="w-full h-full relative grid grid-cols-5 grid-rows-5 gap-1.5 select-none">
                      {/* Anchor square TL */}
                      <div className="col-span-2 row-span-2 bg-slate-900 rounded-lg p-[3px]">
                        <div className="w-full h-full bg-white rounded-md p-[3px]">
                           <div className="w-full h-full bg-slate-900 rounded-sm"></div>
                        </div>
                      </div>
                      {/* Pattern dots */}
                      <div className="bg-slate-900 rounded-sm"></div>
                      {/* Anchor square TR */}
                      <div className="col-span-2 row-span-2 col-start-4 bg-slate-900 rounded-lg p-[3px]">
                        <div className="w-full h-full bg-white rounded-md p-[3px]">
                           <div className="w-full h-full bg-slate-900 rounded-sm"></div>
                        </div>
                      </div>
                      <div className="bg-slate-900 rounded-sm col-start-3 row-start-2"></div>
                      {/* Middle dots pattern */}
                      <div className="bg-slate-900 rounded-sm row-start-3 col-start-1"></div>
                      <div className="bg-slate-900 rounded-sm row-start-3 col-start-2"></div>
                      <div className="bg-slate-900 rounded-sm row-start-3 col-start-3"></div>
                      <div className="bg-slate-900 rounded-sm row-start-3 col-start-4"></div>
                      <div className="bg-slate-900 rounded-sm row-start-3 col-start-5"></div>
                      {/* Anchor square BL */}
                      <div className="col-span-2 row-span-2 row-start-4 bg-slate-900 rounded-lg p-[3px]">
                        <div className="w-full h-full bg-white rounded-md p-[3px]">
                           <div className="w-full h-full bg-slate-900 rounded-sm"></div>
                        </div>
                      </div>
                      <div className="bg-slate-900 rounded-sm row-start-4 col-start-3"></div>
                      <div className="bg-slate-900 rounded-sm row-start-4 col-start-4"></div>
                      <div className="bg-slate-900 rounded-sm row-start-4 col-start-5"></div>
                      <div className="bg-slate-900 rounded-sm row-start-5 col-start-3"></div>
                      <div className="bg-slate-900 rounded-sm row-start-5 col-start-4"></div>
                      <div className="bg-slate-900 rounded-sm row-start-5 col-start-5"></div>
                      
                      {/* Tiny center branding */}
                      <div className="absolute inset-0 m-auto w-9 h-9 rounded-lg bg-white border border-slate-200 shadow-md flex items-center justify-center font-black text-[8px] text-indigo-600 tracking-tighter">
                        M-FLOW
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 font-medium text-center leading-relaxed">
                    Scan with any UPI application (BHIM, GooglePay, PhonePe, Paytm). Payment splits dynamically inside bank routers.
                  </p>

                  <button
                    onClick={() => handleSimulatePayment(selectedInvoice.id)}
                    disabled={isSimulatingPayment}
                    className="w-full font-bold flex items-center justify-center gap-1.5 active:scale-95 shadow cursor-pointer bg-gradient-to-r from-rose-500 to-indigo-600 text-white text-xs py-3 rounded-lg"
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
                /* V2.0 INTERACTIVE SVG SPLIT PAYOUT WHEEL */
                <div className="text-center space-y-4 py-1 animate-fade-in w-full">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-widest font-mono mb-2">B2B Split Routing Wheel</h4>
                    <p className="text-[10px] text-slate-500">Interactive live payout map. Click any wallet node to audit.</p>
                  </div>

                  <div className="relative bg-slate-50 rounded-2xl border border-slate-200/60 p-4">
                    <svg className="w-full max-w-[280px] h-[280px] mx-auto overflow-visible select-none" viewBox="0 0 300 300">
                      {/* Connections with flowing dot animation */}
                      <path d="M 150 150 L 150 45" stroke={selectedNode === 'clinic' ? '#a855f7' : 'rgba(79, 70, 229, 0.15)'} strokeWidth="2.5" strokeDasharray="6 6" className="flowing-line text-indigo-600" style={{ animationDuration: '1s' }} />
                      <path d="M 150 150 L 255 150" stroke={selectedNode === 'lab' ? '#3b82f6' : 'rgba(79, 70, 229, 0.15)'} strokeWidth="2.5" strokeDasharray="6 6" className="flowing-line text-cyan-600" style={{ animationDuration: '1.4s' }} />
                      <path d="M 150 150 L 150 255" stroke={selectedNode === 'pharmacy' ? '#10b981' : 'rgba(79, 70, 229, 0.15)'} strokeWidth="2.5" strokeDasharray="6 6" className="flowing-line text-emerald-500" style={{ animationDuration: '1.2s' }} />
                      <path d="M 150 150 L 45 150" stroke={selectedNode === 'platform' ? '#f43f5e' : 'rgba(79, 70, 229, 0.15)'} strokeWidth="2.5" strokeDasharray="6 6" className="flowing-line text-rose-500" style={{ animationDuration: '1.6s' }} />

                      {/* Outer Nodes */}
                      {/* 1. Clinic (Top) */}
                      <g onClick={() => setSelectedNode('clinic')} className="cursor-pointer group">
                        <circle cx="150" cy="45" r="28" fill="#1e152a" stroke={selectedNode === 'clinic' ? '#a855f7' : '#a855f740'} strokeWidth="2.5" className="transition-all hover:scale-105" />
                        <text x="150" y="42" textAnchor="middle" fill="#a855f7" className="text-[9px] font-black font-sans uppercase">Clinic</text>
                        <text x="150" y="53" textAnchor="middle" fill="#ffffff80" className="text-[8px] font-bold font-mono">₹{selectedInvoice.doctorFee}</text>
                      </g>

                      {/* 2. Lab (Right) */}
                      <g onClick={() => setSelectedNode('lab')} className="cursor-pointer group">
                        <circle cx="255" cy="150" r="28" fill="#0f192b" stroke={selectedNode === 'lab' ? '#3b82f6' : '#3b82f640'} strokeWidth="2.5" className="transition-all hover:scale-105" />
                        <text x="255" y="147" textAnchor="middle" fill="#3b82f6" className="text-[9px] font-black font-sans uppercase">Lab</text>
                        <text x="255" y="158" textAnchor="middle" fill="#ffffff80" className="text-[8px] font-bold font-mono">₹{selectedInvoice.labFee}</text>
                      </g>

                      {/* 3. Pharmacy (Bottom) */}
                      <g onClick={() => setSelectedNode('pharmacy')} className="cursor-pointer group">
                        <circle cx="150" cy="255" r="28" fill="#0a2118" stroke={selectedNode === 'pharmacy' ? '#10b981' : '#10b98140'} strokeWidth="2.5" className="transition-all hover:scale-105" />
                        <text x="150" y="252" textAnchor="middle" fill="#10b981" className="text-[9px] font-black font-sans uppercase">POS</text>
                        <text x="150" y="263" textAnchor="middle" fill="#ffffff80" className="text-[8px] font-bold font-mono">₹{selectedInvoice.pharmacyFee}</text>
                      </g>

                      {/* 4. Platform (Left) */}
                      <g onClick={() => setSelectedNode('platform')} className="cursor-pointer group">
                        <circle cx="45" cy="150" r="28" fill="#240f16" stroke={selectedNode === 'platform' ? '#f43f5e' : '#f43f5e40'} strokeWidth="2.5" className="transition-all hover:scale-105" />
                        <text x="45" y="147" textAnchor="middle" fill="#f43f5e" className="text-[9px] font-black font-sans uppercase">SaaS</text>
                        <text x="45" y="158" textAnchor="middle" fill="#ffffff80" className="text-[8px] font-bold font-mono">₹{selectedInvoice.platformFee}</text>
                      </g>

                      {/* Center Escrow Node */}
                      <g onClick={() => setSelectedNode('escrow')} className="cursor-pointer">
                        <circle cx="150" cy="150" r="34" fill="#18181b" stroke={selectedNode === 'escrow' ? '#4f46e5' : 'rgba(79, 70, 229, 0.15)'} strokeWidth="3" />
                        <circle cx="150" cy="150" r="30" fill="url(#escrowGrad)" />
                        <text x="150" y="146" textAnchor="middle" fill="#ffffff" className="text-[9px] font-black font-sans uppercase tracking-tighter">Escrow</text>
                        <text x="150" y="157" textAnchor="middle" fill="#ffffffef" className="text-[8px] font-black font-mono">₹{selectedInvoice.totalAmount}</text>
                      </g>

                      {/* Gradient definition */}
                      <defs>
                        <linearGradient id="escrowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#4f46e5" />
                          <stop offset="100%" stopColor="#c084fc" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Interactive Node Description Panel */}
                    <div className="mt-4 p-3 bg-white rounded-xl text-left border border-slate-200 text-[10px]">
                      {selectedNode === 'escrow' && (
                        <div className="animate-fade-in">
                          <strong className="text-slate-800 block font-bold">Central Bank Escrow (Gross Amount)</strong>
                          <p className="text-slate-500 mt-1 leading-normal">
                            Aggregate amount ₹{selectedInvoice.totalAmount}.00 is currently held securely in banks UPI clearing channel awaiting final settlement to distributed wallets.
                          </p>
                        </div>
                      )}
                      {selectedNode === 'clinic' && (
                        <div className="animate-fade-in">
                          <strong className="text-indigo-700 block font-bold">DR_CLINIC_WALLET_01 (Consultation Cut)</strong>
                          <p className="text-slate-500 mt-1 leading-normal">
                            Doctor Consultation share: Gross amount ₹{selectedInvoice.doctorFee}.00. Commission allocated: ₹{calcSplits(selectedInvoice).docNet}.00 after 10% TDS deduction (₹{calcSplits(selectedInvoice).docTds}.00 reserved).
                          </p>
                        </div>
                      )}
                      {selectedNode === 'lab' && (
                        <div className="animate-fade-in">
                          <strong className="text-cyan-700 block font-bold">LAB_PARTNER_WALLET_02 (Pathology Cut)</strong>
                          <p className="text-slate-500 mt-1 leading-normal">
                            Pathology Test share: Gross amount ₹{selectedInvoice.labFee}.00. Commission allocated: ₹{calcSplits(selectedInvoice).labNet}.00 after 10% TDS deduction (₹{calcSplits(selectedInvoice).labTds}.00 reserved).
                          </p>
                        </div>
                      )}
                      {selectedNode === 'pharmacy' && (
                        <div className="animate-fade-in">
                          <strong className="text-emerald-600 block font-bold">PHARMACY_PARTNER_WALLET_03 (POS Cut)</strong>
                          <p className="text-slate-500 mt-1 leading-normal">
                            Pharmacy Medicine share: Gross amount ₹{selectedInvoice.pharmacyFee}.00. Commission allocated: ₹{calcSplits(selectedInvoice).pharmaNet}.00 after 10% TDS deduction (₹{calcSplits(selectedInvoice).pharmaTds}.00 reserved).
                          </p>
                        </div>
                      )}
                      {selectedNode === 'platform' && (
                        <div className="animate-fade-in">
                          <strong className="text-rose-600 block font-bold">SYSTEM_ESCROW_PROTECT (Platform SaaS Fee)</strong>
                          <p className="text-slate-500 mt-1 leading-normal">
                            Mediflow SaaS standard B2B routing fee: ₹{selectedInvoice.platformFee}.00. Settled instantly to system admin account. GST compliance pool updated.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>
        ) : (
          <div className="bg-white p-8 text-center text-slate-500 font-semibold text-sm h-64 flex flex-col items-center justify-center border border-slate-200 shadow-xl rounded-xl print-hidden">
            <AlertCircle className="h-10 w-10 text-slate-400 mb-2" />
            No active billing invoice generated in ecosystem queue yet.
          </div>
        )}
      </div>



      {/* V2.0 DEDICATED HIGH-PRECISION PRINTABLE STATEMENT LAYER (VISUALLY ACCESSIBLE TO THE PRINTER BYPASS ONLY) */}
      {selectedInvoice && (
        <div id="printable-statement-layer" className="hidden border-2 border-black p-10 bg-white text-black text-xs font-sans space-y-6">
          <div className="flex justify-between items-center border-b-2 border-black pb-4">
            <div>
              <h1 className="text-lg font-black tracking-tight text-black">MEDIFLOW HEALTHCARE SYSTEM</h1>
              <p className="text-[10px] text-black font-semibold mt-1">B2B Commission Ledger & Audit Statement</p>
            </div>
            <div className="text-right text-[10px] font-mono">
              <div>Invoice Reference: #{selectedInvoice.id.toUpperCase()}</div>
              <div>Audit Date: {new Date().toLocaleString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-[11px] leading-relaxed border-b border-black/20 pb-4">
            <div>
              <h3 className="font-extrabold uppercase text-[10px] mb-2 tracking-wider">Patient Meta Data</h3>
              <div>Name: <strong>{selectedInvoice.patientName}</strong></div>
              <div>Phone: +91 {selectedInvoice.patientPhone}</div>
              <div>Patient ID: {selectedInvoice.patientId}</div>
            </div>
            <div>
              <h3 className="font-extrabold uppercase text-[10px] mb-2 tracking-wider">UPI Settlement Info</h3>
              <div>Payment Gateway: <strong>DIRECT_BANK_UPI_SPLIT_ROUTING</strong></div>
              <div>Clearance Status: <strong className="uppercase">{selectedInvoice.paymentStatus}</strong></div>
              <div>Escrow Ref Hash: <span className="font-mono text-[9px]">e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</span></div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-extrabold uppercase text-[10px] tracking-wider">Multi-Vendor Ledger Splits Allocation</h3>
            <table className="w-full text-[11px] border-collapse border border-black/30">
              <thead>
                <tr className="bg-slate-800/5 text-[10px] font-bold border-b border-black">
                  <th className="p-2 border-r border-black/30 text-left">Destination Wallet ID</th>
                  <th className="p-2 border-r border-black/30 text-left">Entity Segment</th>
                  <th className="p-2 border-r border-black/30 text-right">Gross Amount</th>
                  <th className="p-2 border-r border-black/30 text-right">10% TDS Res.</th>
                  <th className="p-2 text-right">Net Payout</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-black/30">
                  <td className="p-2 border-r border-black/30 font-mono text-[10px]">DR_CLINIC_WALLET_01</td>
                  <td className="p-2 border-r border-black/30">Clinic Consultation Fee</td>
                  <td className="p-2 border-r border-black/30 text-right font-mono">₹{selectedInvoice.doctorFee}.00</td>
                  <td className="p-2 border-r border-black/30 text-right font-mono text-rose-700">-₹{calcSplits(selectedInvoice).docTds}.00</td>
                  <td className="p-2 text-right font-mono font-bold">₹{calcSplits(selectedInvoice).docNet}.00</td>
                </tr>
                <tr className="border-b border-black/30">
                  <td className="p-2 border-r border-black/30 font-mono text-[10px]">LAB_PARTNER_WALLET_02</td>
                  <td className="p-2 border-r border-black/30">Pathology Diagnostics Charge</td>
                  <td className="p-2 border-r border-black/30 text-right font-mono">₹{selectedInvoice.labFee}.00</td>
                  <td className="p-2 border-r border-black/30 text-right font-mono text-rose-700">-₹{calcSplits(selectedInvoice).labTds}.00</td>
                  <td className="p-2 text-right font-mono font-bold">₹{calcSplits(selectedInvoice).labNet}.00</td>
                </tr>
                <tr className="border-b border-black/30">
                  <td className="p-2 border-r border-black/30 font-mono text-[10px]">PHARMACY_PARTNER_WALLET_03</td>
                  <td className="p-2 border-r border-black/30">Pharmacy Medication Reserve</td>
                  <td className="p-2 border-r border-black/30 text-right font-mono">₹{selectedInvoice.pharmacyFee}.00</td>
                  <td className="p-2 border-r border-black/30 text-right font-mono text-rose-700">-₹{calcSplits(selectedInvoice).pharmaTds}.00</td>
                  <td className="p-2 text-right font-mono font-bold">₹{calcSplits(selectedInvoice).pharmaNet}.00</td>
                </tr>
                <tr className="border-b-2 border-black">
                  <td className="p-2 border-r border-black/30 font-mono text-[10px]">SYSTEM_ESCROW_PROTECT</td>
                  <td className="p-2 border-r border-black/30">Platform SaaS Fee</td>
                  <td className="p-2 border-r border-black/30 text-right font-mono">₹{selectedInvoice.platformFee}.00</td>
                  <td className="p-2 border-r border-black/30 text-right font-mono">—</td>
                  <td className="p-2 text-right font-mono font-bold">₹{selectedInvoice.platformFee}.00</td>
                </tr>
                <tr className="font-extrabold bg-slate-800/5 text-[12px]">
                  <td colSpan={2} className="p-2 border-r border-black text-left uppercase">Total Settlements</td>
                  <td className="p-2 border-r border-black text-right font-mono">₹{selectedInvoice.totalAmount}.00</td>
                  <td className="p-2 border-r border-black text-right font-mono text-rose-700">-₹{calcSplits(selectedInvoice).totalTds}.00</td>
                  <td className="p-2 text-right font-mono text-lg font-black">₹{selectedInvoice.totalAmount - calcSplits(selectedInvoice).totalTds}.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-8 text-[10px] pt-8">
            <div className="space-y-4">
              <div className="border-b border-black pb-1 uppercase font-bold text-[9px] tracking-wide">Gateway Settlement Audit Logs</div>
              <div className="font-mono space-y-1 text-[9px]">
                <div>[OK] Cr Clinic Wallet: +₹{calcSplits(selectedInvoice).docNet}.00</div>
                <div>[OK] Cr Lab Wallet: +₹{calcSplits(selectedInvoice).labNet}.00</div>
                <div>[OK] Cr Pharmacy Wallet: +₹{calcSplits(selectedInvoice).pharmaNet}.00</div>
                <div>[OK] Cr Platform Escrow: +₹{selectedInvoice.platformFee}.00</div>
              </div>
            </div>
            <div className="flex flex-col justify-end items-end space-y-6">
              <div className="w-40 border-b border-black text-center text-[10px] font-mono pb-1">MEDIFLOW_CLEARING_BANK</div>
              <div className="text-[9px] uppercase tracking-wider font-extrabold text-black/60">Digital Signature and Clearing Seal</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
