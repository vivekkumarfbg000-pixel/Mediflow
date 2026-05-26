import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '../../services/api';
import type { Patient, WhatsAppSession, ClinicStaff, PathologyReport, PharmacyInventoryItem, MedicineBillItem, MedicineBill, CounterTransaction } from '../../types';
import { 
  Smartphone, 
  Upload, 
  Send, 
  Search, 
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Coins,
  QrCode,
  Printer,
  Truck,
  UserCheck,
  FileText
} from 'lucide-react';

export const CompounderDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'registry' | 'pathology' | 'medicine_billing'>('registry');

  // Registry Registry state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  
  // Real-time Network Resilience State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { message: 'Network connection restored. Syncing pending ledger entries...', type: 'success', title: 'System Online 🟢' }
      }));
    };
    const handleOffline = () => {
      setIsOnline(false);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { message: 'Flaky network detected. App in Offline Cache resiliency mode.', type: 'warning', title: 'Connection Lost 🔴' }
      }));
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Registration form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<Patient['gender']>('Male');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [chronicInput, setChronicInput] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected patient to initiate loop
  const [activeSession, setActiveSession] = useState<WhatsAppSession | null>(null);

  // Chat simulator input & scroll states
  const [replyInput, setReplyInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Clinic Staff State
  const [staffList, setStaffList] = useState<ClinicStaff[]>([]);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'compounder' | 'receptionist' | 'admin'>('compounder');

  // Pathology uploads state
  const [reports, setReports] = useState<PathologyReport[]>([]);


  // ─── PHARMACY BILLING STATES ──────────────────────────────────────────────
  const [activeInventory, setActiveInventory] = useState<PharmacyInventoryItem[]>([]);
  const [billingPatient, setBillingPatient] = useState<Patient | null>(null);
  const [billingItems, setBillingItems] = useState<MedicineBillItem[]>([]);
  
  // Search & add manual medicine in billing
  const [medSearchQuery, setMedSearchQuery] = useState('');
  
  // Simulated prescription OCR scan state
  const [isPrescriptionScanning, setIsPrescriptionScanning] = useState(false);
  const [prescriptionImage, setPrescriptionImage] = useState<string | null>(null);
  const [ocrLogs, setOcrLogs] = useState<string[]>([]);
  // Loyalty & delivery transaction helpers
  const [apptCounterBooked, setApptCounterBooked] = useState(false);
  const [labCounterBooked, setLabCounterBooked] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'shiprocket'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Post-scan patient assignment & quick registration
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [showQuickReg, setShowQuickReg] = useState(false);
  const [quickRegName, setQuickRegName] = useState('');
  const [quickRegPhone, setQuickRegPhone] = useState('');
  const [quickRegAge, setQuickRegAge] = useState('');
  const [quickRegGender, setQuickRegGender] = useState<Patient['gender']>('Male');
  const [quickRegAbha, setQuickRegAbha] = useState('');

  // Pathology upload scan queue states
  const [uploadPatientName, setUploadPatientName] = useState('');
  const [uploadTestCode, setUploadTestCode] = useState('4544-3'); // HbA1c standard
  const [uploadTestName, setUploadTestName] = useState('HbA1c Glycated Hemoglobin');
  const [uploadPatientId, setUploadPatientId] = useState('');
  const [isUploadingReport, setIsUploadingReport] = useState(false);

  const syncData = useCallback(() => {
    setPatients(api.getPatients());
    setSessions(api.getWhatsAppSessions());
    setStaffList(api.getClinicStaff());
    setActiveStaffId(api.getActiveStaffId());
    setReports(api.getPathologyReports());
    setActiveInventory(api.getPharmacyInventory());

    setActiveSession(prev => {
      if (!prev) return null;
      const fresh = api.getWhatsAppSessions().find(s => s.patientPhone === prev.patientPhone);
      return fresh || null;
    });
  }, []);

  useEffect(() => {
    syncData();
    return api.subscribe(syncData);
  }, [syncData]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.sessionData?.chatHistory]);

  // Sync loyalty checkboxes when billing patient changes
  useEffect(() => {
    if (billingPatient) {
      const txs = api.getCounterTransactions();
      const todayStr = new Date().toISOString().split('T')[0];
      const existingTx = txs.find(t => t.patientId === billingPatient.id && t.createdAt.startsWith(todayStr));
      
      if (existingTx) {
        setApptCounterBooked(existingTx.appointmentBookedAtCounter);
        setLabCounterBooked(existingTx.labBookedAtCounter);
      } else {
        setApptCounterBooked(false);
        setLabCounterBooked(false);
      }
    }
  }, [billingPatient]);

  // Handle staff methods
  const handleRegisterStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    api.registerClinicStaff(newStaffName.trim(), newStaffRole);
    setNewStaffName('');
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Registered ${newStaffName} as ${newStaffRole} successfully.`,
        type: 'success',
        title: 'Clinic Staff Registered'
      }
    }));
  };



  const handleSelectActiveStaff = (staffId: string) => {
    api.setActiveStaffId(staffId);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Active Checked-In Staff updated.`,
        type: 'info',
        title: 'Checked-In Active Staff'
      }
    }));
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !activeSession) return;
    const text = replyInput.trim();
    setReplyInput('');
    await api.processIncomingWhatsAppMessage(activeSession.patientPhone, text);
  };

  const handleRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !age) return;

    const registered = api.registerPatient({
      name,
      phone,
      age: Number(age),
      gender,
      allergies: allergiesInput.split(',').map(s => s.trim()).filter(Boolean),
      chronicConditions: chronicInput.split(',').map(s => s.trim()).filter(Boolean),
      abhaId: abhaId || undefined
    });

    api.setActivePatient(registered);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Patient ${name} registered successfully. ABHA profile linked.`,
        type: 'success',
        title: 'Patient Registered'
      }
    }));

    setName('');
    setPhone('');
    setAge('');
    setGender('Male');
    setAllergiesInput('');
    setChronicInput('');
    setAbhaId('');
  };

  const handleInitiateWhatsAppLoop = (patient: Patient) => {
    api.setActivePatient(patient);
    const session = api.initiateWhatsAppSession(patient.phone);
    setActiveSession(session);
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `WhatsApp verification session initiated for ${patient.name}.`,
        type: 'info',
        title: 'WhatsApp Loop Started'
      }
    }));
  };

  // Pathology Upload logic
  const handleUploadReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadPatientName || !uploadTestName || !uploadPatientId) {
      alert('Please fill out all required fields.');
      return;
    }

    setIsUploadingReport(true);

    setTimeout(() => {
      const reportsList = api.getPathologyReports();
      const newReport: PathologyReport = {
        id: `rep-${Date.now()}`,
        patientId: uploadPatientId,
        patientName: uploadPatientName,
        loincCode: uploadTestCode,
        testName: uploadTestName,
        status: 'pending',
        compounderScanned: true,
        timestamp: new Date().toISOString()
      };

      reportsList.unshift(newReport);
      api.savePathologyReports(reportsList);
      setIsUploadingReport(false);
      
      // Reset form
      setUploadPatientName('');
      setUploadPatientId('');

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Pathology report uploaded. Streamed barcode index lock: Approved queue dispatched to doctor workspace!`,
          type: 'success',
          title: 'Report Scanned & Queued'
        }
      }));
    }, 1200);
  };

  // ─── BILLING TAB HANDLERS ─────────────────────────────────────────────────
  
  // Set loyalty status and save to local API
  const handleToggleLoyaltyStatus = (type: 'appt' | 'lab') => {
    if (!billingPatient) return;
    
    const isAppt = type === 'appt' ? !apptCounterBooked : apptCounterBooked;
    const isLab = type === 'lab' ? !labCounterBooked : labCounterBooked;

    if (type === 'appt') setApptCounterBooked(isAppt);
    if (type === 'lab') setLabCounterBooked(isLab);

    const tx: CounterTransaction = {
      id: `tx-counter-${billingPatient.id}`,
      patientId: billingPatient.id,
      patientPhone: billingPatient.phone,
      patientName: billingPatient.name,
      appointmentBookedAtCounter: isAppt,
      labBookedAtCounter: isLab,
      discountEligible: isAppt && isLab,
      discountPercent: isAppt && isLab ? 10 : 0,
      createdAt: new Date().toISOString()
    };

    api.saveCounterTransaction(tx);
    
    if (isAppt && isLab) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Loyalty Bonus unlocked: Patient booked both appt & lab at counter today! 10% auto-discount applied.`,
          type: 'success',
          title: '10% Loyalty Unlocked'
        }
      }));
    }
  };

  // Scan Prescription Simulation
  const handlePrescriptionImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPrescriptionImage(reader.result as string);
      setOcrLogs([]);
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerPrescriptionOcr = async () => {
    if (!prescriptionImage) return;
    setIsPrescriptionScanning(true);
    setOcrLogs([
      `[${new Date().toLocaleTimeString()}] Reading prescription visual bounds...`,
      `[${new Date().toLocaleTimeString()}] Querying clinical RAG OCR pipeline...`
    ]);

    await new Promise(resolve => setTimeout(resolve, 800));
    setOcrLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Extracting handwriting strokes...`,
      `[${new Date().toLocaleTimeString()}] Parsed medications list from Doctor Vivek`
    ]);

    try {
      const parsedData = await api.parsePrescriptionOCR(prescriptionImage);
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Match from inventory
      const matched = api.matchPrescriptionMedicines(parsedData.medications.map(m => m.medicineName));
      
      const newItems: MedicineBillItem[] = matched.map(invItem => {
        const itemTotal = invItem.price * 10;
        const gst = invItem.hsn === '300410' ? 0.12 : 0.05;
        
        return {
          inventoryItemId: invItem.id,
          name: invItem.name,
          genericName: invItem.genericName,
          dosage: invItem.dosage,
          batchNumber: invItem.batchNumber,
          expiryDate: invItem.expiryDate,
          quantity: 10, // Default prescription qty
          mrp: invItem.mrp,
          sellingPrice: invItem.price,
          discountPercent: 0,
          gstPercent: gst * 100,
          lineTotal: itemTotal
        };
      });

      setBillingItems(prev => [...prev, ...newItems]);
      setOcrLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] SUCCESS: Digitized ${matched.length} medicines. Auto-populated bill workspace! [OK]`
      ]);
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `AI OCR parsed prescription: Loaded ${matched.length} medicines matching Patna live inventory!`,
          type: 'success',
          title: 'Prescription Parsed Successfully'
        }
      }));
    } catch (err: any) {
      setOcrLogs(prev => [...prev, `[ERROR] AI OCR failed: ${err.message}`]);
    } finally {
      setIsPrescriptionScanning(false);
    }
  };

  // Add item manually to bill
  const handleSelectMedForBilling = (med: PharmacyInventoryItem) => {
    // Check if already in billing items
    const exists = billingItems.find(i => i.inventoryItemId === med.id);
    if (exists) {
      alert('This batch is already added to checkout.');
      return;
    }

    const itemTotal = med.price * 10; // Default qty 10
    const gst = med.hsn === '300410' ? 0.12 : 0.05;

    const newItem: MedicineBillItem = {
      inventoryItemId: med.id,
      name: med.name,
      genericName: med.genericName,
      dosage: med.dosage,
      batchNumber: med.batchNumber,
      expiryDate: med.expiryDate,
      quantity: 10,
      mrp: med.mrp,
      sellingPrice: med.price,
      discountPercent: 0,
      gstPercent: gst * 100,
      lineTotal: itemTotal
    };

    setBillingItems(prev => [...prev, newItem]);
    setMedSearchQuery('');
  };

  const handleUpdateItemQty = (idx: number, qty: number) => {
    setBillingItems(prev => prev.map((item, i) => {
      if (i === idx) {
        const parsedQty = Math.max(1, qty);
        const itemTotal = item.sellingPrice * parsedQty * (1 - item.discountPercent / 100);
        return {
          ...item,
          quantity: parsedQty,
          lineTotal: itemTotal
        };
      }
      return item;
    }));
  };

  const handleUpdateItemDiscount = (idx: number, disc: number) => {
    setBillingItems(prev => prev.map((item, i) => {
      if (i === idx) {
        const parsedDisc = Math.min(100, Math.max(0, disc));
        const itemTotal = item.sellingPrice * item.quantity * (1 - parsedDisc / 100);
        return {
          ...item,
          discountPercent: parsedDisc,
          lineTotal: itemTotal
        };
      }
      return item;
    }));
  };

  // Suggest alternative brand from inventory
  const getCheaperAlternatives = (item: MedicineBillItem) => {
    return activeInventory.filter(inv => 
      inv.id !== item.inventoryItemId &&
      inv.genericName.toLowerCase() === item.genericName.toLowerCase() &&
      inv.price < item.sellingPrice &&
      inv.stock > 0
    );
  };

  const handleSwitchToAlternative = (itemIdx: number, alt: PharmacyInventoryItem) => {
    setBillingItems(prev => prev.map((item, i) => {
      if (i === itemIdx) {
        const itemTotal = alt.price * item.quantity * (1 - item.discountPercent / 100);
        const gst = alt.hsn === '300410' ? 0.12 : 0.05;
        
        return {
          ...item,
          inventoryItemId: alt.id,
          name: alt.name,
          batchNumber: alt.batchNumber,
          expiryDate: alt.expiryDate,
          mrp: alt.mrp,
          sellingPrice: alt.price,
          gstPercent: gst * 100,
          lineTotal: itemTotal,
          alternativeSuggested: `Cheaper brand switched to ${alt.name}`
        };
      }
      return item;
    }));

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Switched brand to cheaper alternative: ${alt.name} (Saved ₹${(billingItems[itemIdx].sellingPrice - alt.price).toFixed(2)} per unit!)`,
        type: 'success',
        title: 'Generic Switch Success'
      }
    }));
  };

  const handleRemoveBillingItem = (idx: number) => {
    setBillingItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Financial calculations
  const billingTotals = useMemo(() => {
    let subtotal = 0;
    let gstAmount = 0;
    let itemDiscountAmount = 0;

    billingItems.forEach(item => {
      subtotal += item.sellingPrice * item.quantity;
      itemDiscountAmount += (item.sellingPrice * item.quantity) * (item.discountPercent / 100);
      
      const lineGst = item.lineTotal * (item.gstPercent / 100);
      gstAmount += lineGst;
    });

    const isLoyaltyEligible = apptCounterBooked && labCounterBooked;
    const loyaltyDiscountPercent = isLoyaltyEligible ? 10 : 0;
    
    // Loyalty discount is calculated on the subtotal after item-level discounts
    const postItemDiscountSubtotal = subtotal - itemDiscountAmount;
    const loyaltyDiscountAmount = postItemDiscountSubtotal * (loyaltyDiscountPercent / 100);
    
    const deliveryCharge = deliveryType === 'shiprocket' ? 45 : 0;
    const totalAmount = postItemDiscountSubtotal - loyaltyDiscountAmount + gstAmount + deliveryCharge;

    return {
      subtotal,
      itemDiscountAmount,
      loyaltyDiscountPercent,
      loyaltyDiscountAmount,
      gstAmount,
      deliveryCharge,
      totalAmount
    };
  }, [billingItems, apptCounterBooked, labCounterBooked, deliveryType]);

  // Dispatch bill through API
  const handleGenerateInvoice = async (mode: 'whatsapp' | 'cash') => {
    if (!billingPatient || billingItems.length === 0) return;

    const billId = `bill-${Date.now()}`;
    const bill: MedicineBill = {
      id: billId,
      patientId: billingPatient.id,
      patientName: billingPatient.name,
      patientPhone: billingPatient.phone,
      items: billingItems,
      subtotal: billingTotals.subtotal,
      loyaltyDiscountPercent: billingTotals.loyaltyDiscountPercent,
      loyaltyDiscountAmount: billingTotals.loyaltyDiscountAmount,
      itemDiscountAmount: billingTotals.itemDiscountAmount,
      gstAmount: billingTotals.gstAmount,
      totalAmount: billingTotals.totalAmount,
      paymentMode: mode === 'whatsapp' ? 'whatsapp_pay' : 'cash',
      upiQrPayload: `upi://pay?pa=mediflow@icici&pn=Mediflow&am=${billingTotals.totalAmount.toFixed(2)}&cu=INR&tn=MF-BILL-${billId.substring(4, 8)}`,
      status: mode === 'cash' ? 'paid' : 'draft',
      source: 'counter',
      deliveryType: deliveryType,
      deliveryAddress: deliveryType === 'shiprocket' ? deliveryAddress : undefined,
      deliveryCharge: billingTotals.deliveryCharge,
      shiprocketOrderId: deliveryType === 'shiprocket' ? `SR-CTR-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
      createdAt: new Date().toISOString()
    };

    api.saveMedicineBill(bill);

    if (mode === 'cash') {
      api.dispenseMedicineBill(billId);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Direct cash transaction settled at counter! Stock deducted. Invoice printed.`,
          type: 'success',
          title: 'POS Settle Complete'
        }
      }));
      setBillingItems([]);
    } else {
      // WhatsApp dispatch
      // Find session or initiate
      let session = sessions.find(s => s.patientPhone === billingPatient.phone);
      if (!session) {
        session = api.initiateWhatsAppSession(billingPatient.phone);
      }

      // Format & push invoice message to patient WhatsApp sandbox!
      const invoiceText = api.generateMedicineInvoiceMessage(bill);
      
      // Update session state to MEDICINE_AWAITING_PAYMENT
      api.updateWhatsAppState(billingPatient.phone, 'MEDICINE_AWAITING_PAYMENT', {
        chatHistory: [
          ...(session.sessionData.chatHistory || []),
          { sender: 'bot', text: invoiceText, time: new Date().toISOString() }
        ],
        draftMedicineBill: bill
      });

      // Jump simulator focus
      handleInitiateWhatsAppLoop(billingPatient);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Invoice generated & pushed to +91 ${billingPatient.phone} on WhatsApp! Sandbox auto-focused.`,
          type: 'success',
          title: 'WhatsApp Invoice Sent'
        }
      }));

      setBillingItems([]);
    }
  };

  // Fuzzy search catalog filtering in billing
  const billingSearchMatches = useMemo(() => {
    if (!medSearchQuery.trim()) return [];
    return activeInventory.filter(inv => 
      (inv.name.toLowerCase().includes(medSearchQuery.toLowerCase()) ||
       inv.genericName.toLowerCase().includes(medSearchQuery.toLowerCase())) &&
      inv.stock > 0
    );
  }, [activeInventory, medSearchQuery]);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.phone.includes(searchQuery) ||
    (p.abhaId && p.abhaId.includes(searchQuery))
  );

  const assignFilteredPatients = useMemo(() => {
    if (!assignSearchQuery.trim()) return [];
    return patients.filter(p => 
      p.name.toLowerCase().includes(assignSearchQuery.toLowerCase().trim()) || 
      p.phone.includes(assignSearchQuery.trim()) ||
      (p.abhaId && p.abhaId.includes(assignSearchQuery.trim()))
    );
  }, [patients, assignSearchQuery]);

  const handleQuickRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRegName.trim() || !quickRegPhone.trim() || !quickRegAge) {
      alert('Please fill in Name, Phone, and Age.');
      return;
    }

    const registered = api.registerPatient({
      name: quickRegName.trim(),
      phone: quickRegPhone.trim(),
      age: Number(quickRegAge),
      gender: quickRegGender,
      allergies: [],
      chronicConditions: [],
      abhaId: quickRegAbha.trim() || undefined
    });

    // Refresh clinical lists
    setPatients(api.getPatients());
    setBillingPatient(registered);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Registered & Assigned Patient: ${quickRegName.trim()} successfully!`,
        type: 'success',
        title: 'Patient Assigned'
      }
    }));

    // Reset fields
    setQuickRegName('');
    setQuickRegPhone('');
    setQuickRegAge('');
    setQuickRegGender('Male');
    setQuickRegAbha('');
    setShowQuickReg(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
      <style>{`
        @keyframes sweep {
          0% { top: 0%; opacity: 0.3; }
          50% { top: 100%; opacity: 0.8; }
          100% { top: 0%; opacity: 0.3; }
        }
        .laser-sweep-line {
          animation: sweep 2s infinite ease-in-out;
        }
      `}</style>

      {/* DASHBOARD HEADER — integrated tabs */}
      <div className="border-b border-slate-200 pb-0">
        {/* Top row: title + status */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-indigo-600 text-white shadow-sm">
                <span className="material-symbols-outlined text-[20px]">medical_services</span>
              </span>
              Compounder Operations Desk
              <span className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-widest ${
                isOnline
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 animate-pulse'
                  : 'bg-rose-50 border-rose-200 text-rose-600'
              }`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 ml-12">
              Clinical checkup hub — appointments, medicine billing, pathology scans &amp; Shiprocket dispatches.
            </p>
          </div>
          <div className="ml-12 md:ml-0 flex items-center gap-2 shrink-0">
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full font-semibold uppercase tracking-wider font-mono">
              {staffList.find(s => s.id === activeStaffId)?.staffName || 'System Compounder'} · Checked-In
            </span>
          </div>
        </div>

        {/* Integrated Tab Switcher — lives in header */}
        <div className="flex overflow-x-auto gap-1 no-scrollbar select-none -mb-px">
          <button
            onClick={() => setActiveTab('registry')}
            className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-wider cursor-pointer rounded-t-lg ${
              activeTab === 'registry'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            Patient Registry &amp; Shifts
          </button>

          <button
            onClick={() => setActiveTab('pathology')}
            className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-wider cursor-pointer rounded-t-lg ${
              activeTab === 'pathology'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <FileText className="h-4 w-4" />
            Pathology Reports Queue
          </button>

          <button
            onClick={() => setActiveTab('medicine_billing')}
            className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-wider cursor-pointer rounded-t-lg ${
              activeTab === 'medicine_billing'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Coins className="h-4 w-4" />
            Medicine Billing &amp; POS
          </button>
        </div>
      </div>

      {/* TAB CONTENT SPACES */}
      <div className="space-y-6">
        
        {/* TAB 1: REGISTRY & STAFF */}
        {activeTab === 'registry' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              
              {/* Search Registry */}
              <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-xl">person_search</span>
                  Patient Registry Lookup
                </h2>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search patient by phone, name, or ABHA ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full input-field pl-12 focus:ring-1 focus:ring-secondary focus:border-secondary text-sm py-2 bg-surface-container-lowest border-outline-variant text-white rounded-lg"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-clinical-400 h-5 w-5" />
                </div>

                {searchQuery && (
                  <div className="mt-4 border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant bg-surface-container-lowest/50 glass-panel-inner animate-fade-in select-none">
                    {filteredPatients.length === 0 ? (
                      <div className="p-4 text-clinical-400 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-rose-400 text-base">warning</span>
                        No matching patient found in ecosystem registry.
                      </div>
                    ) : (
                      filteredPatients.map(p => {
                        const sess = sessions.find(s => s.patientPhone === p.phone);
                        return (
                          <div key={p.id} className="p-4 flex items-center justify-between hover:bg-surface-container/50 transition-colors">
                            <div>
                              <h4 className="font-bold text-white text-sm">
                                {p.name} <span className="text-clinical-400 font-medium text-xs">({p.age}y, {p.gender})</span>
                              </h4>
                              <p className="text-[11px] text-clinical-300 mt-1 flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[10px] text-secondary">phone</span>
                                  {p.phone}
                                </span>
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setBillingPatient(p);
                                  setActiveTab('medicine_billing');
                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: {
                                      message: `Loaded patient Aarav Sharma into Medicine Billing workspace!`,
                                      type: 'info',
                                      title: 'Workspace Active'
                                    }
                                  }));
                                }}
                                className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/20 font-bold rounded-lg uppercase tracking-wider text-[10px] transition-all cursor-pointer"
                              >
                                Checkout Billing
                              </button>
                              <button
                                onClick={() => handleInitiateWhatsAppLoop(p)}
                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                                  sess 
                                    ? 'bg-surface-container-highest text-white border-outline-variant' 
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 hover:border-emerald-600'
                                }`}
                              >
                                <Smartphone className="h-3 w-3" />
                                {sess ? 'Focus Loop' : 'Opt-In SMS'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Patient Registration Form */}
              <div className="glass-panel p-6 border-white/10 shadow-xl relative">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">person_add</span>
                  Manual Patient Registration
                </h2>
                <p className="text-xs text-clinical-400 mb-4 leading-relaxed">
                  Enter checkup counter details to register a fresh patient profile and auto-generate ABHA cards.
                </p>

                <form onSubmit={handleRegisterPatient} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Patient Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Kumar"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Age *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 35"
                        value={age}
                        onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value as any)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">ABHA Health ID</label>
                      <input
                        type="text"
                        placeholder="e.g. 14-digit index"
                        value={abhaId}
                        onChange={(e) => setAbhaId(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-gradient-to-r from-secondary to-primary hover:scale-105 active:scale-95 text-black font-black tracking-wider uppercase border-0 rounded-xl text-xs cursor-pointer transition-transform"
                    >
                      Register Patient
                    </button>
                  </div>
                </form>
              </div>

            </div>

            {/* Staff list and simulator panel */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Check-in staff list */}
              <div className="glass-panel p-6 border-white/10 shadow-xl space-y-4 select-none">
                <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-white/10 pb-3">
                  <UserCheck className="h-5 w-5 text-secondary" />
                  Checked-In Active Staffs
                </h3>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {staffList.length === 0 ? (
                    <p className="text-xs text-clinical-500 text-center py-4">No staffs checked-in.</p>
                  ) : (
                    staffList.map(staff => (
                      <div 
                        key={staff.id} 
                        onClick={() => handleSelectActiveStaff(staff.id)}
                        className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                          staff.id === activeStaffId 
                            ? 'border-secondary bg-secondary/5' 
                            : 'border-outline-variant hover:bg-surface-container/30'
                        }`}
                      >
                        <div>
                          <h5 className="font-bold text-xs text-white">{staff.staffName}</h5>
                          <span className="text-[9px] uppercase tracking-wider text-clinical-400 font-semibold">{staff.role}</span>
                        </div>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                          staff.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {staff.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* staff registration panel */}
              <div className="glass-panel p-6 border-white/10 shadow-xl space-y-4">
                <h4 className="font-bold text-sm text-white border-b border-white/10 pb-2">Register Shifts Compounders</h4>
                <form onSubmit={handleRegisterStaff} className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Enter Staff Name"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value as any)}
                      className="flex-1 input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg cursor-pointer"
                    >
                      <option value="compounder">Compounder</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="admin">Clinic Admin</option>
                    </select>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-secondary text-black font-black text-xs tracking-wider uppercase border-0 rounded-xl cursor-pointer hover:bg-secondary/80 active:scale-95 transition-transform"
                    >
                      Register
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: PATHOLOGY QUEUE */}
        {activeTab === 'pathology' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              
              {/* Active reports upload list */}
              <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary opacity-50" />
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-4">
                  <span className="material-symbols-outlined text-primary text-xl">upload_file</span>
                  Scanned Reports Queue (Awaiting Doctor Diagnosis)
                </h2>

                {reports.filter(r => r.status === 'pending').length === 0 ? (
                  <div className="p-8 bg-surface-container-lowest/40 border border-outline-variant rounded-xl text-center text-sm text-clinical-500">
                    No pathology scanned sheets awaiting review in doctor's inbox.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reports.filter(r => r.status === 'pending').map(rep => (
                      <div key={rep.id} className="p-4 bg-surface-container border border-outline-variant rounded-xl flex items-center justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-white text-xs">{rep.testName}</h4>
                          <p className="text-[10px] text-clinical-400">Patient: {rep.patientName} • Code: {rep.loincCode}</p>
                          <span className="text-[8px] bg-amber-500/10 text-amber-400 font-mono font-bold px-2 py-0.5 rounded border border-amber-500/20 uppercase mt-2 inline-block">
                            Awaiting Diagnosis
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: {
                                    message: `Report sheet for ${rep.patientName} is correctly synchronized in Doctor workspace.`,
                                    type: 'info',
                                    title: 'Sync Status OK'
                                  }
                              }));
                            }}
                            className="px-3 py-1.5 bg-surface-container-highest hover:bg-surface-container-highest border border-outline-variant text-[10px] text-white font-bold rounded-lg cursor-pointer"
                          >
                            Verify
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Scanned upload form */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Scan pathology form */}
              <div className="glass-panel p-6 border-white/10 shadow-xl space-y-4">
                <h3 className="font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">add_photo_alternate</span>
                  Scan Report Sheet
                </h3>

                <form onSubmit={handleUploadReportSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Select Patient *</label>
                    <select
                      required
                      value={uploadPatientId}
                      onChange={(e) => {
                        const pat = patients.find(p => p.id === e.target.value);
                        if (pat) {
                          setUploadPatientId(pat.id);
                          setUploadPatientName(pat.name);
                        }
                      }}
                      className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg cursor-pointer"
                    >
                      <option value="">Choose Registry Patient</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.name} (+91 {p.phone})</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Test LOINC Code *</label>
                    <select
                      value={uploadTestCode}
                      onChange={(e) => {
                        setUploadTestCode(e.target.value);
                        if (e.target.value === '4544-3') setUploadTestName('HbA1c Glycated Hemoglobin');
                        if (e.target.value === '2823-3') setUploadTestName('Serum Creatinine');
                        if (e.target.value === '718-7') setUploadTestName('Hemoglobin Panel');
                      }}
                      className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg cursor-pointer"
                    >
                      <option value="4544-3">LOINC 4544-3: HbA1c Glycated Hemoglobin</option>
                      <option value="2823-3">LOINC 2823-3: Serum Creatinine</option>
                      <option value="718-7">LOINC 718-7: Hemoglobin Panel</option>
                    </select>
                  </div>

                  {/* Dropzone mock */}
                  <div className="border border-dashed border-outline-variant rounded-xl p-5 text-center bg-black/25 select-none relative hover:border-secondary/50 transition-colors">
                    <span className="material-symbols-outlined text-3xl text-clinical-400 mb-1.5">clinical_notes</span>
                    <p className="text-[10px] text-white font-bold">Select report sheet scan photo</p>
                    <p className="text-[8px] text-clinical-500 mt-1">Accepts PDF, PNG, JPG (Max 5MB)</p>
                    <input type="file" disabled={isUploadingReport} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>

                  <button
                    type="submit"
                    disabled={isUploadingReport || !uploadPatientId}
                    className="w-full btn-primary py-2.5 text-xs font-black tracking-wider uppercase border-0 rounded-xl cursor-pointer bg-gradient-to-r from-secondary to-primary text-black font-semibold hover:scale-105 active:scale-95 transition-all"
                  >
                    {isUploadingReport ? 'Uploading Report...' : 'Upload & Dispatched Report'}
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: MEDICINE BILLING & POS */}
        {activeTab === 'medicine_billing' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
            
            {/* Left billing block (70%): scan, manual items add, list items */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* OCR scanner scan panel */}
              <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-primary opacity-50" />
                
                <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4 gap-4">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary font-bold">camera</span>
                      Prescription Handwritten AI Scribe Parser
                    </h3>
                    <p className="text-xs text-clinical-400 mt-1">
                      Directly scans supplier handwritten doctor prescriptions to match brand items from live Patna inventory.
                    </p>
                  </div>
                  
                  {billingPatient ? (
                    <div className="flex items-center gap-2 select-none shrink-0">
                      <div className="p-2.5 rounded-xl border border-secondary/20 bg-secondary/5 font-mono text-[10px] text-secondary font-bold leading-tight">
                        🛒 BILLING PATIENT:<br />
                        <strong className="text-white font-sans text-xs">{billingPatient.name}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBillingPatient(null);
                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                            detail: {
                              message: 'Cleared active billing patient context. Ready to reassign.',
                              type: 'info',
                              title: 'Patient Cleared'
                            }
                          }));
                        }}
                        className="px-3.5 py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 font-bold rounded-lg uppercase tracking-wider text-[10px] transition-all cursor-pointer h-[42px] flex items-center justify-center font-semibold"
                        title="Unassign patient"
                      >
                        SWITCH
                      </button>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 font-mono text-[10px] text-rose-400 font-bold shrink-0 select-none leading-tight animate-pulse">
                      ⚠️ PATIENT UNASSIGNED:<br />
                      <strong className="text-rose-300 font-sans text-xs font-semibold">Assign patient below</strong>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Prescription image upload */}
                    <div className="space-y-3">
                      <div className="relative border-2 border-dashed border-outline-variant hover:border-secondary/50 rounded-xl h-36 flex flex-col items-center justify-center bg-black/25 overflow-hidden select-none">
                        {prescriptionImage ? (
                          <>
                            <img src={prescriptionImage} className="w-full h-full object-cover opacity-60" alt="Suppliers bill upload" />
                            <div className="absolute inset-0 bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors">
                              <span className="text-white text-[10px] font-bold uppercase tracking-wider">Change photo</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-clinical-400 mb-1.5" />
                            <span className="text-[10px] text-white font-bold">Select prescription scan photo</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePrescriptionImageUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      
                      {prescriptionImage && (
                        <button
                          disabled={isPrescriptionScanning}
                          onClick={handleTriggerPrescriptionOcr}
                          className="w-full btn-primary py-2 text-xs font-black tracking-wider uppercase border-0 rounded-xl cursor-pointer bg-gradient-to-r from-secondary to-primary text-black font-semibold hover:scale-105 active:scale-95 transition-transform"
                        >
                          {isPrescriptionScanning ? 'Analyzing Handwritings...' : 'Scan Doctor Prescription'}
                        </button>
                      )}
                    </div>

                    {/* Scanner logs */}
                    <div className="flex flex-col h-36">
                      <div className="bg-black/50 border border-outline-variant rounded-xl p-3 font-mono text-[9px] text-clinical-300 space-y-1 overflow-y-auto flex-1 h-36 relative">
                        {isPrescriptionScanning && (
                          <div className="absolute left-0 w-full h-[1.5px] bg-rose-500 shadow-[0_0_8px_#ef4444] laser-sweep-line" />
                        )}
                        {ocrLogs.length === 0 ? (
                          <div className="text-clinical-500 italic">Logs will stream here during handwritten clinical analysis...</div>
                        ) : (
                          ocrLogs.map((log, i) => (
                            <div key={i} className={log.includes('SUCCESS') ? 'text-emerald-400 font-bold' : log.includes('handwriting') ? 'text-secondary' : ''}>
                              {log}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
              </div>

              {/* Manual search and add in billing */}
              <div className="glass-panel p-6 border-white/10 shadow-xl space-y-4">
                  <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-white/10 pb-3">
                    <span className="material-symbols-outlined text-secondary">search</span>
                    Fuzzy Match Pharmacy Batches
                  </h3>
                  
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type medicine name or generic to add manually..."
                      value={medSearchQuery}
                      onChange={(e) => setMedSearchQuery(e.target.value)}
                      className="w-full input-field pl-10 focus:ring-1 focus:ring-secondary focus:border-secondary text-xs py-2.5 bg-surface-container border-outline-variant text-white rounded-lg"
                    />
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-clinical-400 h-4.5 w-4.5" />
                  </div>

                  {billingSearchMatches.length > 0 && (
                    <div className="border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant bg-surface-container-lowest select-none animate-fade-in">
                      {billingSearchMatches.map(med => (
                        <div 
                          key={med.id} 
                          onClick={() => handleSelectMedForBilling(med)}
                          className="p-3.5 flex items-center justify-between hover:bg-surface-container-highest/20 cursor-pointer transition-colors"
                        >
                          <div>
                            <h5 className="font-bold text-xs text-white">{med.name} <span className="text-[10px] text-clinical-400 font-normal">({med.dosage})</span></h5>
                            <p className="text-[10px] text-clinical-400 italic font-mono">{med.genericName} • Exp: {med.expiryDate}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-white text-xs font-bold block">₹{med.price.toFixed(2)}</span>
                            <span className="text-[9px] text-emerald-400 font-bold font-mono">Stock: {med.stock} units</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Checkout table list items */}
                  <div className="border border-outline-variant rounded-xl overflow-hidden glass-panel-inner mt-6 select-none">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-surface-container text-clinical-300 border-b border-outline-variant font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="p-3">Dawa Name</th>
                            <th className="p-3 font-mono">Batch Details</th>
                            <th className="p-3 text-center font-mono">Qty</th>
                            <th className="p-3 text-right font-mono">Unit Price</th>
                            <th className="p-3 text-center font-mono">Disc %</th>
                            <th className="p-3 text-right font-mono">GST %</th>
                            <th className="p-3 text-right font-mono">Total</th>
                            <th className="p-3 text-center">Alt</th>
                            <th className="p-3 text-right">Del</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant bg-surface-container-lowest/30">
                          {billingItems.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-8 text-center text-clinical-500 font-medium">
                                Checkout bill is currently empty. Scan prescription or match search to add.
                              </td>
                            </tr>
                          ) : (
                            billingItems.map((item, idx) => {
                              const alternatives = getCheaperAlternatives(item);
                              return (
                                <tr key={`${item.inventoryItemId}-${idx}`} className="hover:bg-surface-container/30 transition-colors">
                                  <td className="p-3 font-bold text-white text-xs">
                                    {item.name}
                                    {item.alternativeSuggested && (
                                      <span className="block text-[8px] text-emerald-400 font-black font-mono mt-1 animate-pulse uppercase">
                                        {item.alternativeSuggested}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 space-y-0.5">
                                    <div className="font-mono text-white text-[10px] font-bold">B: {item.batchNumber}</div>
                                    <div className="text-[9px] text-clinical-400 font-mono">Exp: {item.expiryDate}</div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => handleUpdateItemQty(idx, Number(e.target.value))}
                                      className="w-12 bg-surface-container border border-outline-variant text-white text-center font-mono py-1 rounded focus:outline-none focus:border-secondary font-semibold"
                                    />
                                  </td>
                                  <td className="p-3 text-right font-mono text-white font-semibold">₹{item.sellingPrice.toFixed(2)}</td>
                                  <td className="p-3 text-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max="99"
                                      value={item.discountPercent}
                                      onChange={(e) => handleUpdateItemDiscount(idx, Number(e.target.value))}
                                      className="w-10 bg-surface-container border border-outline-variant text-white text-center font-mono py-1 rounded focus:outline-none focus:border-secondary font-semibold"
                                    />
                                  </td>
                                  <td className="p-3 text-right font-mono text-clinical-400">{item.gstPercent}%</td>
                                  <td className="p-3 text-right font-mono text-white font-bold">₹{item.lineTotal.toFixed(2)}</td>
                                  <td className="p-3 text-center relative">
                                    {alternatives.length > 0 ? (
                                      <div className="relative group">
                                        <button
                                          type="button"
                                          className="p-1 hover:bg-secondary/15 hover:text-secondary rounded border border-outline-variant active:scale-95 cursor-pointer text-[10px] font-black uppercase font-mono"
                                        >
                                          ⟳
                                        </button>
                                        <div className="absolute right-0 top-6 z-50 bg-surface-container-highest border border-outline-variant rounded-xl shadow-2xl p-2 w-48 text-left hidden group-hover:block animate-fade-in">
                                          <div className="text-[9px] font-bold text-clinical-400 uppercase tracking-wider mb-1.5 border-b border-white/5 pb-1 font-mono">
                                            Generic brand alternatives:
                                          </div>
                                          {alternatives.map(alt => (
                                            <div
                                              key={alt.id}
                                              onClick={() => handleSwitchToAlternative(idx, alt)}
                                              className="p-2 hover:bg-surface-container text-[10px] rounded-lg cursor-pointer transition-colors"
                                            >
                                              <span className="font-bold text-white block">{alt.name}</span>
                                              <span className="text-emerald-400 font-mono block font-semibold">₹{alt.price.toFixed(2)} (Save ₹{(item.sellingPrice - alt.price).toFixed(2)})</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-clinical-500 font-mono font-semibold">N/A</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right">
                                    <button
                                      onClick={() => handleRemoveBillingItem(idx)}
                                      className="p-1 hover:bg-rose-500/10 text-clinical-400 hover:text-rose-400 border border-transparent hover:border-rose-500/20 rounded transition-all cursor-pointer"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
            </div>

            {/* Right details block (30%): Loyalty, totals summary, dispatch */}
            <div className="lg:col-span-4 space-y-6">
              
              {billingPatient ? (
                <div className="glass-panel p-6 border-white/10 shadow-xl space-y-5">
                  <h3 className="font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-2">
                    <Coins className="h-5 w-5 text-emerald-400" />
                    Checkout Settlement
                  </h3>

                  {/* Loyalty Discount check widget */}
                  <div className="p-4 bg-surface-container border border-outline-variant rounded-xl space-y-3.5">
                    <h5 className="font-bold text-[10px] text-clinical-300 uppercase tracking-widest font-mono">Loyalty Bonus Checker</h5>
                    <p className="text-[10px] text-clinical-400 leading-normal font-semibold">
                      Enable checker if customer booked appointment & pathology test through counter today to trigger loyalty discounts:
                    </p>
                    
                    <div className="space-y-2 border-t border-white/5 pt-2 select-none">
                      <label className="flex items-center gap-2 text-xs text-white font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={apptCounterBooked}
                          onChange={() => handleToggleLoyaltyStatus('appt')}
                          className="h-4 w-4 bg-surface-container rounded border-outline-variant focus:ring-secondary checked:bg-secondary text-black"
                        />
                        Appointment Booked at Counter
                      </label>
                      <label className="flex items-center gap-2 text-xs text-white font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={labCounterBooked}
                          onChange={() => handleToggleLoyaltyStatus('lab')}
                          className="h-4 w-4 bg-surface-container rounded border-outline-variant focus:ring-secondary checked:bg-secondary text-black"
                        />
                        Lab Test Fees Settled at Counter
                      </label>
                    </div>

                    {apptCounterBooked && labCounterBooked && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg uppercase tracking-wider animate-pulse flex items-center gap-2 leading-tight">
                        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                        Loyalty Bonus 10% Activated Successfully!
                      </div>
                    )}
                  </div>

                  {/* Logistics options */}
                  <div className="p-4 bg-surface-container border border-outline-variant rounded-xl space-y-3.5">
                    <h5 className="font-bold text-[10px] text-clinical-300 uppercase tracking-widest font-mono flex items-center gap-1">
                      <Truck className="h-4 w-4 text-primary" /> Delivery Logistics Setup
                    </h5>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeliveryType('pickup')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider transition-all cursor-pointer ${
                          deliveryType === 'pickup'
                            ? 'border-secondary text-secondary bg-secondary/5 font-black'
                            : 'border-outline-variant text-clinical-400 hover:text-white'
                        }`}
                      >
                        Pickup
                      </button>
                      <button
                        onClick={() => setDeliveryType('shiprocket')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider transition-all cursor-pointer ${
                          deliveryType === 'shiprocket'
                            ? 'border-secondary text-secondary bg-secondary/5 font-black'
                            : 'border-outline-variant text-clinical-400 hover:text-white'
                        }`}
                      >
                        Shiprocket (₹45)
                      </button>
                    </div>

                    {deliveryType === 'shiprocket' && (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Home Delivery Address *</label>
                        <textarea
                          required
                          placeholder="e.g. Fraser Road, Patna, Bihar - 800001"
                          rows={2}
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          className="w-full bg-surface-container-lowest border border-outline-variant text-white p-2.5 rounded-lg text-xs focus:outline-none focus:border-secondary font-medium"
                        />
                      </div>
                    )}
                  </div>

                  {/* Invoice Summary totals */}
                  <div className="p-4 bg-surface-container border border-outline-variant rounded-xl space-y-3 font-mono">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-clinical-400">Medicine Subtotal:</span>
                      <span className="text-white font-bold">₹{billingTotals.subtotal.toFixed(2)}</span>
                    </div>

                    {billingTotals.itemDiscountAmount > 0 && (
                      <div className="flex justify-between items-center text-xs text-rose-400">
                        <span>Item Discounts:</span>
                        <span>-₹{billingTotals.itemDiscountAmount.toFixed(2)}</span>
                      </div>
                    )}

                    {billingTotals.loyaltyDiscountAmount > 0 && (
                      <div className="flex justify-between items-center text-xs text-emerald-400">
                        <span>Loyalty Bonus (10%):</span>
                        <span>-₹{billingTotals.loyaltyDiscountAmount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-clinical-400">GST (5% & 12%):</span>
                      <span className="text-white font-bold">₹{billingTotals.gstAmount.toFixed(2)}</span>
                    </div>

                    {billingTotals.deliveryCharge > 0 && (
                      <div className="flex justify-between items-center text-xs text-primary">
                        <span>Shiprocket Cargo Fee:</span>
                        <span>+₹{billingTotals.deliveryCharge.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="border-t border-white/5 pt-3 flex justify-between items-center text-sm font-black">
                      <span className="text-white">TOTAL PAYABLE:</span>
                      <span className="text-secondary text-base">₹{billingTotals.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Action dispatches buttons */}
                  <div className="space-y-3 select-none">
                    <button
                      disabled={billingItems.length === 0}
                      onClick={() => handleGenerateInvoice('whatsapp')}
                      className={`w-full py-3 rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 border-0 cursor-pointer transition-transform ${
                        billingItems.length === 0
                          ? 'bg-surface-container-highest text-clinical-500 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 hover:scale-105 active:scale-95 text-white shadow-lg shadow-emerald-500/10'
                      }`}
                    >
                      <Smartphone className="h-4.5 w-4.5" /> Send Invoice to WhatsApp
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        disabled={billingItems.length === 0}
                        onClick={() => handleGenerateInvoice('cash')}
                        className="py-2.5 bg-gradient-to-r from-secondary to-primary text-black border-0 hover:scale-105 active:scale-95 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer font-semibold transition-transform"
                      >
                        <QrCode className="h-4 w-4 text-black font-semibold" /> Direct Settle
                      </button>
                      <button
                        disabled={billingItems.length === 0}
                        onClick={() => window.print()}
                        className="py-2.5 bg-surface-container hover:bg-surface-container-highest border border-outline-variant text-white hover:scale-105 active:scale-95 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer font-semibold transition-transform"
                      >
                        <Printer className="h-4 w-4 text-white" /> Print Bill
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-panel p-6 border-white/10 shadow-xl space-y-5 animate-fade-in relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-rose-500/50 to-amber-500/50 opacity-60" />
                  
                  <h3 className="font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-2 select-none">
                    <span className="material-symbols-outlined text-rose-400">person_add</span>
                    Assign Patient to Checkout
                  </h3>

                  <div className="space-y-4">
                    <div className="flex gap-2 p-1 bg-surface-container rounded-xl border border-outline-variant select-none">
                      <button
                        type="button"
                        onClick={() => setShowQuickReg(false)}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                          !showQuickReg 
                            ? 'bg-secondary text-black shadow-md' 
                            : 'text-clinical-400 hover:text-white'
                        }`}
                      >
                        Search Registry
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQuickReg(true)}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                          showQuickReg 
                            ? 'bg-secondary text-black shadow-md' 
                            : 'text-clinical-400 hover:text-white'
                        }`}
                      >
                        Register New
                      </button>
                    </div>

                    {!showQuickReg ? (
                      <div className="space-y-4">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search patient by name, phone, or ABHA ID..."
                            value={assignSearchQuery}
                            onChange={(e) => setAssignSearchQuery(e.target.value)}
                            className="w-full input-field pl-10 focus:ring-1 focus:ring-secondary focus:border-secondary text-xs py-2.5 bg-surface-container border-outline-variant text-white rounded-lg font-sans"
                          />
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-clinical-400 h-4.5 w-4.5" />
                        </div>

                        {assignFilteredPatients.length > 0 ? (
                          <div className="border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant bg-surface-container-lowest/50 glass-panel-inner max-h-[220px] overflow-y-auto select-none animate-fade-in font-sans">
                            {assignFilteredPatients.map(p => (
                              <div key={p.id} className="p-3 flex items-center justify-between hover:bg-surface-container/50 transition-colors font-sans">
                                <div>
                                  <h4 className="font-bold text-white text-xs font-sans">
                                    {p.name} <span className="text-clinical-400 font-medium text-[10px]">({p.age}y, {p.gender})</span>
                                  </h4>
                                  <p className="text-[10px] text-clinical-300 mt-0.5 font-mono">{p.phone}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBillingPatient(p);
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: {
                                        message: `Loaded patient ${p.name} into active billing workspace!`,
                                        type: 'info',
                                        title: 'Patient Assigned'
                                      }
                                    }));
                                  }}
                                  className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/20 font-bold rounded-lg uppercase tracking-wider text-[9px] transition-all cursor-pointer font-semibold font-sans"
                                >
                                  Assign
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : assignSearchQuery.trim() ? (
                          <div className="p-4 text-center border border-dashed border-outline-variant rounded-xl text-clinical-400 text-xs bg-black/10 select-none font-sans">
                            No matching patient found in registry.<br />
                            <button
                              type="button"
                              onClick={() => setShowQuickReg(true)}
                              className="text-secondary font-bold hover:underline mt-2 inline-block text-[10px] uppercase tracking-wider font-sans"
                            >
                              Create profile inline
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <form onSubmit={handleQuickRegisterPatient} className="space-y-3.5 font-sans">
                        <div className="space-y-1">
                          <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Patient Full Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Ramesh Kumar"
                            value={quickRegName}
                            onChange={(e) => setQuickRegName(e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-secondary font-semibold font-sans"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">WhatsApp Phone Number *</label>
                          <input
                            type="tel"
                            required
                            placeholder="e.g. 9876543210"
                            value={quickRegPhone}
                            onChange={(e) => setQuickRegPhone(e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-secondary font-semibold font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Age *</label>
                            <input
                              type="number"
                              required
                              min="1"
                              max="120"
                              placeholder="42"
                              value={quickRegAge}
                              onChange={(e) => setQuickRegAge(e.target.value)}
                              className="w-full bg-surface-container-lowest border border-outline-variant text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-secondary font-semibold font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Gender *</label>
                            <select
                              value={quickRegGender}
                              onChange={(e) => setQuickRegGender(e.target.value as any)}
                              className="w-full bg-surface-container-lowest border border-outline-variant text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-secondary font-semibold font-sans"
                            >
                              <option value="Male" className="bg-surface-container-lowest text-white">Male</option>
                              <option value="Female" className="bg-surface-container-lowest text-white">Female</option>
                              <option value="Other" className="bg-surface-container-lowest text-white">Other</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">ABHA National Health ID (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. 91-8843-9921-2210"
                            value={quickRegAbha}
                            onChange={(e) => setQuickRegAbha(e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-secondary font-semibold font-mono"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2.5 bg-gradient-to-r from-secondary to-primary text-black hover:scale-105 active:scale-95 border-0 font-black tracking-wider uppercase rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer font-semibold transition-all mt-2 font-sans"
                        >
                          Register & Assign Patient
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Real-time WhatsApp Loop simulator at the bottom */}
        {activeTab !== 'medicine_billing' && (
          <div className="glass-panel border-white/10 shadow-xl overflow-hidden flex flex-col h-[600px] relative">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500 opacity-60" />
            
            <div className="bg-surface-container p-4 border-b border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-3 select-none">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">WhatsApp Sandbox Simulation Bot</h3>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    LIVE GATEWAY CONNECTED
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-surface-container-lowest p-4 overflow-y-auto space-y-4 font-sans text-xs">
              {activeSession ? (
                <div className="space-y-4">
                  <div className="text-center select-none">
                    <span className="bg-surface-container text-clinical-300 border border-outline-variant px-3 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase font-mono">
                      CHAT TIMELINE
                    </span>
                  </div>

                  <div className="bg-surface-container/60 border border-outline-variant p-3.5 rounded-xl flex gap-3 leading-relaxed select-none">
                    <ShieldAlert className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                    <p className="text-clinical-400 text-[10px] leading-relaxed">
                      Time-locked patient clinical consent simulation for +91 {activeSession.patientPhone}. Current state: <span className="font-mono text-emerald-400 uppercase font-semibold">{activeSession.currentState}</span>
                    </p>
                  </div>

                  {(activeSession.sessionData.chatHistory || []).map((msg, idx) => {
                    const isBot = msg.sender === 'bot';
                    return (
                      <div 
                        key={idx} 
                        className={`flex ${isBot ? 'justify-start' : 'justify-end'} animate-fade-in`}
                      >
                        <div 
                          className={`max-w-[85%] p-4 rounded-2xl border shadow-md relative ${
                            isBot 
                              ? 'bg-surface-container rounded-tl-none border-outline-variant text-white' 
                              : 'bg-emerald-600/90 rounded-tr-none border-emerald-500/30 text-white'
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-line font-mono text-[11px] font-medium">{msg.text}</p>
                          
                          {isBot && msg.text.includes('Welcome to Mediflow') && activeSession.currentState === 'AWAITING_WELCOME' && (
                            <div className="mt-3 pt-3 border-t border-outline-variant/50 flex flex-col gap-2 select-none">
                              <button
                                onClick={() => api.processIncomingWhatsAppMessage(activeSession.patientPhone, '1')}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-center shadow active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer border-0"
                              >
                                Grant Consent (Aarav Sharma)
                              </button>
                            </div>
                          )}

                          {isBot && msg.text.includes('consent is committed') && activeSession.currentState !== 'AWAITING_WELCOME' && (
                            <div className="mt-2 flex items-center gap-1 text-emerald-400 text-[9px] font-bold uppercase tracking-wider select-none">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 animate-pulse" /> Consent Registered
                            </div>
                          )}

                          <span className="block text-[8px] text-clinical-500 text-right mt-1.5 font-mono select-none">
                            {msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 select-none">
                  <span className="material-symbols-outlined text-6xl text-clinical-700 animate-pulse">forum</span>
                  <div>
                    <h4 className="font-bold text-white text-sm">No Active WhatsApp Loop</h4>
                    <p className="text-clinical-400 text-xs mt-1 leading-relaxed">
                      Lookup a patient in patient registry lookup or register a new one, then click "SMS opt-in" to trigger simulated messaging sandboxing.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendReply} className="bg-surface-container p-3 border-t border-outline-variant flex gap-2">
              <input
                type="text"
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                disabled={!activeSession}
                placeholder={activeSession ? "Type simulated message (e.g. '1', 'PAY', 'Metformin 30 tabs')..." : "Simulated WhatsApp Sandbox Interface"}
                className="flex-1 bg-surface-container-lowest/80 border border-outline-variant rounded-xl px-3 py-2 text-xs text-white placeholder-clinical-500 focus:outline-none focus:border-emerald-500/50"
              />
              <button 
                type="submit"
                disabled={!activeSession || !replyInput.trim()} 
                className={`p-2 rounded-xl transition-colors border-0 ${
                  activeSession && replyInput.trim() 
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer' 
                    : 'bg-surface-container-highest text-clinical-500'
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
