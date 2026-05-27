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
  FileText,
  Activity
} from 'lucide-react';

export const CompounderDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'registry' | 'vitals'>('registry');

  // Swasthya Vitals Intake States
  const [vitalsPatient, setVitalsPatient] = useState<Patient | null>(null);
  const [tempVal, setTempVal] = useState('98.6');
  const [bpVal, setBpVal] = useState('120/80');
  const [pulseVal, setPulseVal] = useState('72');
  const [weightVal, setWeightVal] = useState('65');
  const [sugarVal, setSugarVal] = useState('');
  const [customToken, setCustomToken] = useState('');

  // Vernacular Dosage Assistant States
  const [selectedLanguage, setSelectedLanguage] = useState<'hindi' | 'bhojpuri'>('hindi');
  const [dosageTemplate, setDosageTemplate] = useState<'od' | 'bd' | 'tds' | 'sos'>('od');

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

  const handleRecordVitalsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vitalsPatient) return;

    const recordedToken = customToken.trim() || api.generateNextTokenNumber();

    api.updatePatientVitalsAndToken(vitalsPatient.id, {
      temperature: tempVal,
      bloodPressure: bpVal,
      pulseRate: pulseVal,
      weight: weightVal,
      bloodSugar: sugarVal || undefined,
      recordedAt: new Date().toISOString()
    }, recordedToken);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Vitals pre-loaded successfully for patient ${vitalsPatient.name}! Dispatched Token: ${recordedToken} to Doctor Vivek's chamber. 🩺`,
        type: 'success',
        title: 'Swasthya Token Dispatched'
      }
    }));

    // Reset Form
    setVitalsPatient(null);
    setTempVal('98.6');
    setBpVal('120/80');
    setPulseVal('72');
    setWeightVal('65');
    setSugarVal('');
    setCustomToken('');

    syncData();
  };

  const handlePushDosageWhatsApp = async (patient: Patient, dosageText: string) => {
    let session = sessions.find(s => s.patientPhone === patient.phone);
    if (!session) {
      session = api.initiateWhatsAppSession(patient.phone);
    }
    
    const chatHistory = [
      ...(session.sessionData.chatHistory || []),
      { sender: 'bot' as const, text: `📋 *Swasthya Dosage Slip (दवाई पर्ची)*\n\n${dosageText}`, time: new Date().toISOString() }
    ];
    
    api.updateWhatsAppState(patient.phone, session.currentState, {
      ...session.sessionData,
      chatHistory
    });
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Vernacular dosage slip pushed to +91 ${patient.phone} on WhatsApp!`,
        type: 'success',
        title: 'WhatsApp Slip Dispatched'
      }
    }));
    
    syncData();
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
            <h1 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-3">
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
            className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-wider tracking-wider cursor-pointer rounded-t-lg ${
              activeTab === 'registry'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            Patient Registry &amp; Shifts
          </button>

          <button
            onClick={() => setActiveTab('vitals')}
            className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-wider tracking-wider cursor-pointer rounded-t-lg ${
              activeTab === 'vitals'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Activity className="h-4 w-4 text-rose-500" />
            Swasthya Vitals &amp; Token Desk
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
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[16px]">person_search</span>
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
                <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[16px]">person_add</span>
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

        {/* TAB 1.5: SWAPSTHYA VITALS & TOKEN QUEUE */}
        {activeTab === 'vitals' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Hand Queue / Token list */}
            <div className="lg:col-span-6 space-y-6">
              <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-rose-500 to-indigo-500 opacity-60" />
                
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-rose-500 animate-pulse" />
                    Swasthya Token Queue (दैनिक टोकन कतार)
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full animate-pulse-subtle">
                    Live Status
                  </span>
                </div>

                <div className="space-y-4">
                  {patients.length === 0 ? (
                    <div className="p-8 bg-surface-container-lowest/40 border border-outline-variant rounded-xl text-center text-sm text-clinical-500">
                      No patients registered in active queue.
                    </div>
                  ) : (
                    patients.map(p => {
                      const hasVitals = !!p.vitals;
                      const isAwaitingVitals = p.queueStatus === 'awaiting_vitals' || !p.queueStatus;
                      const isAwaitingConsult = p.queueStatus === 'awaiting_consultation';
                      const isCompleted = p.queueStatus === 'completed';

                      return (
                        <div 
                          key={p.id} 
                          className={`p-4 bg-surface-container border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${
                            vitalsPatient?.id === p.id 
                              ? 'border-rose-500/50 bg-rose-500/5 shadow-md shadow-rose-500/5' 
                              : 'border-outline-variant hover:bg-surface-container-highest/40'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-lg border ${
                                p.tokenNumber 
                                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25' 
                                  : 'bg-slate-500/10 text-slate-400 border-slate-500/25'
                              }`}>
                                {p.tokenNumber || 'NO TOKEN'}
                              </span>
                              <h4 className="font-bold text-white text-xs">{p.name}</h4>
                              <span className="text-clinical-400 text-[10px] font-medium">({p.age}y · {p.gender})</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-clinical-400 font-semibold uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <Smartphone className="h-3 w-3 text-secondary" />
                                {p.phone}
                              </span>
                              {hasVitals && (
                                <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-500/5 px-2 py-0.2 rounded border border-emerald-500/10">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                  Vitals Logged
                                </span>
                              )}
                            </div>

                            {/* Quick Vitals Info Bar */}
                            {hasVitals && p.vitals && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-white/5 text-[9px] font-mono text-clinical-300">
                                <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">🌡️ Temp: {p.vitals.temperature}°F</span>
                                <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">🩺 BP: {p.vitals.bloodPressure}</span>
                                <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">💓 Pulse: {p.vitals.pulseRate} bpm</span>
                                <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">⚖️ Wt: {p.vitals.weight} kg</span>
                                {p.vitals.bloodSugar && <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5 text-amber-300">🩸 Sugar: {p.vitals.bloodSugar} mg/dL</span>}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isAwaitingVitals ? (
                              <button
                                onClick={() => {
                                  setVitalsPatient(p);
                                  setCustomToken(p.tokenNumber || api.generateNextTokenNumber());
                                }}
                                className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-black border border-rose-500/20 hover:border-rose-500 font-bold rounded-lg uppercase tracking-wider text-[9px] transition-all cursor-pointer"
                              >
                                Check Vitals
                              </button>
                            ) : isAwaitingConsult ? (
                              <div className="flex flex-col items-end gap-1.5">
                                <span className="text-[8px] bg-amber-500/10 text-amber-400 font-mono font-bold px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest animate-pulse-subtle">
                                  In Doctor Chamber
                                </span>
                                <button
                                  onClick={() => {
                                    api.updatePatientQueueStatus(p.id, 'completed');
                                    syncData();
                                  }}
                                  className="text-[8px] text-clinical-400 hover:text-white underline cursor-pointer"
                                >
                                  Mark Completed
                                </button>
                              </div>
                            ) : (
                              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                                Consult Complete
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Hand Forms (Intake & Translator) */}
            <div className="lg:col-span-6 space-y-6">
              {/* Vitals Intake Form */}
              {vitalsPatient ? (
                <div className="glass-panel p-6 border-white/10 shadow-xl relative animate-fade-in">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-rose-500 opacity-60" />
                  
                  <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-rose-400 text-base">monitor_heart</span>
                      Swasthya Vitals: {vitalsPatient.name}
                    </h2>
                    <button
                      onClick={() => setVitalsPatient(null)}
                      className="text-clinical-400 hover:text-white text-xs underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleRecordVitalsSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Token Number</label>
                        <input
                          type="text"
                          required
                          value={customToken}
                          onChange={(e) => setCustomToken(e.target.value)}
                          className="w-full input-field text-xs py-2 px-3 bg-surface-container border-outline-variant text-white rounded-lg font-mono font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Temperature (°F)</label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="e.g. 98.6"
                            value={tempVal}
                            onChange={(e) => setTempVal(e.target.value)}
                            className="w-full input-field text-xs py-2 px-3 bg-surface-container border-outline-variant text-white rounded-lg"
                          />
                          {parseFloat(tempVal) > 100 && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" title="Fever Alert!" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">BP (mmHg)</label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="e.g. 120/80"
                            value={bpVal}
                            onChange={(e) => setBpVal(e.target.value)}
                            className="w-full input-field text-xs py-2 px-3 bg-surface-container border-outline-variant text-white rounded-lg"
                          />
                          {bpVal.includes('/') && parseInt(bpVal.split('/')[0]) > 140 && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" title="High BP Alert!" />
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Pulse (bpm)</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 72"
                          value={pulseVal}
                          onChange={(e) => setPulseVal(e.target.value)}
                          className="w-full input-field text-xs py-2 px-3 bg-surface-container border-outline-variant text-white rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Weight (kg)</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 65"
                          value={weightVal}
                          onChange={(e) => setWeightVal(e.target.value)}
                          className="w-full input-field text-xs py-2 px-3 bg-surface-container border-outline-variant text-white rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Blood Sugar (mg/dL) - Optional</label>
                      <input
                        type="text"
                        placeholder="e.g. 110"
                        value={sugarVal}
                        onChange={(e) => setSugarVal(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 bg-surface-container border-outline-variant text-white rounded-lg"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-indigo-500 hover:scale-[1.02] active:scale-[0.98] text-black font-black tracking-wider uppercase border-0 rounded-xl text-xs cursor-pointer transition-transform"
                    >
                      Save &amp; Dispatch to Doctor 🩺
                    </button>
                  </form>
                </div>
              ) : (
                <div className="glass-panel p-6 border-white/10 shadow-xl relative text-center text-clinical-500 py-12">
                  <Activity className="h-8 w-8 text-clinical-600 mx-auto mb-3 animate-pulse" />
                  <p className="text-xs font-medium">Select an active patient from the Token Queue to record vitals.</p>
                </div>
              )}

              {/* Localised Bhojpuri & Hindi Dosage Assistant */}
              <div className="glass-panel p-6 border-white/10 shadow-xl relative">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-secondary opacity-60" />
                
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-base">translate</span>
                    Dosage Slip Assistant (दवाई पर्ची सहायक)
                  </h2>
                  
                  {/* Language switch */}
                  <div className="flex bg-surface-container p-0.5 rounded-lg border border-outline-variant">
                    <button
                      onClick={() => setSelectedLanguage('hindi')}
                      className={`px-2.5 py-1 text-[9px] font-black uppercase rounded cursor-pointer ${
                        selectedLanguage === 'hindi' ? 'bg-secondary text-black' : 'text-clinical-400 hover:text-white'
                      }`}
                    >
                      Hindi
                    </button>
                    <button
                      onClick={() => setSelectedLanguage('bhojpuri')}
                      className={`px-2.5 py-1 text-[9px] font-black uppercase rounded cursor-pointer ${
                        selectedLanguage === 'bhojpuri' ? 'bg-secondary text-black' : 'text-clinical-400 hover:text-white'
                      }`}
                    >
                      Bhojpuri
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'od', label: 'OD (1 Bar)' },
                      { id: 'bd', label: 'BD (2 Bar)' },
                      { id: 'tds', label: 'TDS (3 Bar)' },
                      { id: 'sos', label: 'SOS' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setDosageTemplate(t.id as any)}
                        className={`py-2 text-[10px] font-bold rounded-lg border cursor-pointer transition-all ${
                          dosageTemplate === t.id 
                            ? 'bg-secondary/15 border-secondary text-secondary' 
                            : 'border-outline-variant text-clinical-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Render vernacular dosage text */}
                  {(() => {
                    let hindiText = "";
                    let bhojpuriText = "";
                    let genericLabel = "";

                    if (dosageTemplate === 'od') {
                      hindiText = "दिन में एक बार: सुबह खाली पेट या रात को सोने से पहले (डॉक्टर के सलाह अनुसार)।";
                      bhojpuriText = "दिन में एक बार: भोर में खाली पेट भा रात को सूते से पहिले (डॉक्टर साहेब के सलाह से)।";
                      genericLabel = "OD Dosage Instruction";
                    } else if (dosageTemplate === 'bd') {
                      hindiText = "दिन में दो बार: सुबह और रात को खाना खाने के बाद (एक-एक गोली)।";
                      bhojpuriText = "दिन में दो बार: सुबह अउरी रात को भोजन कइला के बाद (एक-एक गोली)।";
                      genericLabel = "BD Dosage Instruction";
                    } else if (dosageTemplate === 'tds') {
                      hindiText = "दिन में तीन बार: सुबह, दोपहर और रात को भोजन के बाद (एक-एक गोली)।";
                      bhojpuriText = "दिन में तीन बार: सुबह, दुपहरिया अउरी रात को खाना खइला के बाद (एक-एक गोली)।";
                      genericLabel = "TDS Dosage Instruction";
                    } else if (dosageTemplate === 'sos') {
                      hindiText = "ज़रूरत पड़ने पर: अत्यधिक दर्द, बुखार या घबराहट होने पर ही लें।";
                      bhojpuriText = "ज़रूरत पड़ला पर: जब बेसी दरद भा बुखार होखे, खाली तबे लीं।";
                      genericLabel = "SOS Dosage Instruction";
                    }

                    const activeText = selectedLanguage === 'hindi' ? hindiText : bhojpuriText;

                    return (
                      <div className="space-y-4">
                        <div className="p-4 bg-surface-container border border-outline-variant rounded-xl space-y-2">
                          <span className="block text-[8px] font-bold text-secondary tracking-widest font-mono uppercase">
                            {genericLabel} ({selectedLanguage.toUpperCase()})
                          </span>
                          <p className="text-xs text-white leading-relaxed font-semibold italic">
                            "{activeText}"
                          </p>
                        </div>

                        {/* Push button selection */}
                        <div className="space-y-2">
                          <label className="text-[9px] text-clinical-400 font-bold uppercase tracking-wider font-mono block pl-1">
                            Push Instruction to Active Patient
                          </label>
                          <select
                            onChange={async (e) => {
                              const patId = e.target.value;
                              if (!patId) return;
                              const pat = patients.find(p => p.id === patId);
                              if (pat) {
                                await handlePushDosageWhatsApp(pat, activeText);
                                e.target.value = ""; // Reset dropdown selection
                              }
                            }}
                            className="w-full input-field text-xs py-2.5 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg cursor-pointer font-sans"
                            defaultValue=""
                          >
                            <option value="" disabled>-- Select Patient to Push Slip --</option>
                            {patients.map(p => (
                              <option key={p.id} value={p.id}>{p.name} (+91 {p.phone})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Real-time WhatsApp Loop simulator at the bottom */}
        <div className="glass-panel border-white/10 shadow-xl overflow-hidden flex flex-col h-[600px] relative mt-8">
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

      </div>
    </div>
  );
};
