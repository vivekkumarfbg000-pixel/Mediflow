import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, Search, FileText, Activity, QrCode, Check, X, ShieldAlert, Sparkles, Upload, Printer, Mic, MicOff, Plus, AlertCircle
} from 'lucide-react';
import { api } from '../../../services/api';
import { EncounterService } from '../../../services/encounterService';
import { PharmacyService } from '../../../services/pharmacyService';
import { LabService, MASTER_TEST_CATALOG } from '../../../services/labService';
import { BillingService } from '../../../services/billingService';
import { PatientService } from '../../../services/patientService';
import type { Patient, UnifiedInvoice, PharmacyInventoryItem, DiagnosticTest } from '../../../types';

export const BillHubTab: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // App States
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [billingMode, setBillingMode] = useState<'digital' | 'manual'>('digital');
  
  // Manual Upload / OCR States
  const [fileName, setFileName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualExtractedData, setManualExtractedData] = useState<{
    raw: string;
    structured: Record<string, string>;
  } | null>(null);

  // Manual Billing & Catalog Search States
  const [manualItemSearchQuery, setManualItemSearchQuery] = useState('');
  const [manualMedicinesList, setManualMedicinesList] = useState<Array<{ name: string; mrp: number; price: number; batch: string; stock: number }>>([]);
  const [manualTestsList, setManualTestsList] = useState<DiagnosticTest[]>([]);

  // Voice Billing States
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  // Billing Item States (Toggles & Quantities)
  const [includeConsult, setIncludeConsult] = useState(true);
  const [selectedMedicines, setSelectedMedicines] = useState<Record<string, { selected: boolean; qty: number }>>({});
  const [selectedTests, setSelectedTests] = useState<Record<string, boolean>>({});
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('upi');
  const [isClearing, setIsClearing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch initial list of patients
  useEffect(() => {
    setPatients(PatientService.getPatients());
  }, [refreshKey]);

  // Sync state if selected patient changes
  useEffect(() => {
    if (selectedPatient) {
      setFileName(null);
      setManualExtractedData(null);
      setDiscountInput(0);
      setIncludeConsult(true);
      setManualMedicinesList([]);
      setManualTestsList([]);
      setVoiceTranscript('');

      // Check if there is an active digital prescription / encounter
      const encounters = EncounterService.getEncounters().filter(e => e.patientId === selectedPatient.id);
      const latestEncounter = encounters[encounters.length - 1];

      if (latestEncounter) {
        setBillingMode('digital');
        // Pre-select all digital medicines
        const initialMeds: Record<string, { selected: boolean; qty: number }> = {};
        latestEncounter.medications.forEach(m => {
          initialMeds[m.medicineName.toLowerCase()] = { selected: true, qty: 10 };
        });
        setSelectedMedicines(initialMeds);

        // Pre-select all digital tests
        const initialTests: Record<string, boolean> = {};
        latestEncounter.diagnosticTests.forEach(t => {
          initialTests[t.loincCode] = true;
        });
        setSelectedTests(initialTests);
      } else {
        setBillingMode('manual');
        setSelectedMedicines({});
        setSelectedTests({});
      }
    }
  }, [selectedPatient]);

  // Catalogs
  const inventory = useMemo(() => PharmacyService.getPharmacyInventory(), []);
  
  // Filtered patients list
  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.phone.includes(query) ||
      (p.tokenNumber && p.tokenNumber.toLowerCase().includes(query))
    );
  }, [patients, searchQuery]);

  // Catalog item search suggestions
  const catalogSuggestions = useMemo(() => {
    const query = manualItemSearchQuery.trim().toLowerCase();
    if (!query) return [];

    const matchedMeds = inventory
      .filter(m => m.name.toLowerCase().includes(query) || (m.genericName && m.genericName.toLowerCase().includes(query)))
      .slice(0, 5)
      .map(m => ({ id: m.id, name: m.name, type: 'pharmacy' as const, price: m.price, item: m }));

    const matchedTests = MASTER_TEST_CATALOG
      .filter(t => t.name.toLowerCase().includes(query))
      .slice(0, 5)
      .map(t => ({ id: t.loincCode, name: t.name, type: 'lab' as const, price: t.price, item: t }));

    return [...matchedMeds, ...matchedTests];
  }, [manualItemSearchQuery, inventory]);

  // Add selected item from catalog search
  const handleAddSuggestedItem = (s: any) => {
    if (s.type === 'pharmacy') {
      const med = s.item as PharmacyInventoryItem;
      if (!manualMedicinesList.some(m => m.name.toLowerCase() === med.name.toLowerCase())) {
        setManualMedicinesList(prev => [...prev, {
          name: med.name,
          mrp: med.mrp,
          price: med.price,
          batch: med.batchNumber,
          stock: med.stock
        }]);
      }
      setSelectedMedicines(prev => ({
        ...prev,
        [med.name.toLowerCase()]: { selected: true, qty: 10 }
      }));
    } else {
      const test = s.item as DiagnosticTest;
      if (!manualTestsList.some(t => t.loincCode === test.loincCode)) {
        setManualTestsList(prev => [...prev, test]);
      }
      setSelectedTests(prev => ({
        ...prev,
        [test.loincCode]: true
      }));
    }
    setManualItemSearchQuery('');
  };

  // Voice Billing NLP Parser
  const parseVoiceCommand = (text: string) => {
    const textLower = text.toLowerCase();
    
    // Help parse spoken numbers in English
    const numberWords: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, fifty: 50
    };

    const findQty = (sentence: string, defaultValue = 10): number => {
      const matchDigit = sentence.match(/\b\d+\b/);
      if (matchDigit) return parseInt(matchDigit[0]);
      
      for (const [word, val] of Object.entries(numberWords)) {
        if (sentence.includes(word)) return val;
      }
      return defaultValue;
    };

    let recognizedItems: string[] = [];

    // 1. Scan pharmacy catalog
    const newMedsList = [...manualMedicinesList];
    const newMedsRecord = { ...selectedMedicines };

    inventory.forEach(item => {
      const nameLower = item.name.toLowerCase();
      const genericLower = item.genericName ? item.genericName.toLowerCase() : '';
      
      if (textLower.includes(nameLower) || (genericLower && textLower.includes(genericLower))) {
        if (!newMedsList.some(m => m.name.toLowerCase() === item.name.toLowerCase())) {
          newMedsList.push({
            name: item.name,
            mrp: item.mrp,
            price: item.price,
            batch: item.batchNumber,
            stock: item.stock
          });
        }
        
        const qty = findQty(textLower);
        newMedsRecord[item.name.toLowerCase()] = { selected: true, qty };
        recognizedItems.push(`${qty}x ${item.name}`);
      }
    });

    // 2. Scan lab tests catalog
    const newTestsList = [...manualTestsList];
    const newTestsRecord = { ...selectedTests };

    MASTER_TEST_CATALOG.forEach(test => {
      const nameLower = test.name.toLowerCase();
      if (textLower.includes(nameLower) || (textLower.includes('hba1c') && test.name.includes('HbA1c'))) {
        if (!newTestsList.some(t => t.loincCode === test.loincCode)) {
          newTestsList.push(test);
        }
        newTestsRecord[test.loincCode] = true;
        recognizedItems.push(test.name);
      }
    });

    setManualMedicinesList(newMedsList);
    setSelectedMedicines(newMedsRecord);
    setManualTestsList(newTestsList);
    setSelectedTests(newTestsRecord);

    if (recognizedItems.length > 0) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Voice Billing Success! 🎤',
          message: `Successfully added: ${recognizedItems.join(', ')}`,
          type: 'success'
        }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Voice Match Alert',
          message: 'No medicines/tests matched catalog names. Try: "Add Paracetamol" or "Add HbA1c test".',
          type: 'info'
        }
      }));
    }
  };

  // Start voice recognition
  const handleStartVoiceBilling = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { 
          title: 'Web Speech Not Supported', 
          message: 'Voice recognition is not supported in this browser. Please use Chrome or Safari.', 
          type: 'error' 
        }
      }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-IN';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceTranscript('Listening... Describe billing details now.');
    };

    recognition.onerror = (e: any) => {
      console.error('Speech recognition error:', e);
      setIsListening(false);
      setVoiceTranscript('Error capturing audio.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoiceTranscript(`Transcribed: "${transcript}"`);
      parseVoiceCommand(transcript);
    };

    recognition.start();
  };

  // Active items mapping (syncing prices)
  const billingLedger = useMemo(() => {
    if (!selectedPatient) return null;

    let baseConsultFee = 500;
    const activeSop = BillingService.getActiveSop();
    if (activeSop?.extractedConfig?.doctor_fee) {
      baseConsultFee = activeSop.extractedConfig.doctor_fee;
    }

    const feeResult = PatientService.calculateDynamicOPDFee(selectedPatient.id);
    let consultFee = feeResult.amount;
    if (feeResult.type === 'First Visit') {
      consultFee = baseConsultFee;
    } else if (feeResult.type === 'Follow-up') {
      consultFee = Math.round(baseConsultFee * 0.4);
    }

    let medicinesList: Array<{ name: string; mrp: number; price: number; batch: string; stock: number }> = [];
    let testsList: DiagnosticTest[] = [];

    if (billingMode === 'digital') {
      const encounters = EncounterService.getEncounters().filter(e => e.patientId === selectedPatient.id);
      const latest = encounters[encounters.length - 1];
      if (latest) {
        latest.medications.forEach(med => {
          const matched = inventory.find(i => i.name.toLowerCase() === med.medicineName.toLowerCase() || i.genericName.toLowerCase() === med.medicineName.toLowerCase());
          medicinesList.push({
            name: med.medicineName,
            mrp: matched?.mrp || 120,
            price: matched?.price || 100,
            batch: matched?.batchNumber || 'N/A',
            stock: matched?.stock ?? 0
          });
        });

        latest.diagnosticTests.forEach(test => {
          const matched = MASTER_TEST_CATALOG.find(t => t.loincCode === test.loincCode);
          testsList.push({
            loincCode: test.loincCode,
            name: test.name,
            price: matched?.price || 250,
            category: matched?.category || 'General',
            normalRange: matched?.normalRange || '',
            unit: matched?.unit || ''
          });
        });
      }
    } else {
      // Manual billing combines OCR + Manual list additions
      const combinedMeds = [...manualMedicinesList];
      const combinedTests = [...manualTestsList];

      if (manualExtractedData) {
        Object.entries(manualExtractedData.structured).forEach(([k, v]) => {
          const itemLower = k.toLowerCase();
          const matchedMed = inventory.find(i => i.name.toLowerCase().includes(itemLower) || i.genericName.toLowerCase().includes(itemLower));
          if (matchedMed) {
            if (!combinedMeds.some(m => m.name.toLowerCase() === matchedMed.name.toLowerCase())) {
              combinedMeds.push({
                name: matchedMed.name,
                mrp: matchedMed.mrp,
                price: matchedMed.price,
                batch: matchedMed.batchNumber,
                stock: matchedMed.stock
              });
            }
            return;
          }

          const matchedTest = MASTER_TEST_CATALOG.find(t => t.name.toLowerCase().includes(itemLower));
          if (matchedTest) {
            if (!combinedTests.some(t => t.loincCode === matchedTest.loincCode)) {
              combinedTests.push(matchedTest);
            }
            return;
          }

          // Fallback
          const priceNum = parseFloat(v.replace(/[^0-9.]/g, '')) || 150;
          if (!combinedMeds.some(m => m.name.toLowerCase() === k.toLowerCase())) {
            combinedMeds.push({
              name: k,
              mrp: priceNum + 20,
              price: priceNum,
              batch: 'GEN-01',
              stock: 10
            });
          }
        });
      }

      medicinesList = combinedMeds;
      testsList = combinedTests;
    }

    // Totals Calculation
    let consultTotal = includeConsult ? consultFee : 0;
    let pharmacySub = 0;
    let labSub = 0;

    medicinesList.forEach(m => {
      const state = selectedMedicines[m.name.toLowerCase()];
      if (state?.selected) {
        pharmacySub += m.price * state.qty;
      }
    });

    testsList.forEach(t => {
      if (selectedTests[t.loincCode]) {
        labSub += t.price;
      }
    });

    const pharmGst = parseFloat((pharmacySub * 0.12).toFixed(2));
    const labGst = parseFloat((labSub * 0.18).toFixed(2));
    const totalGst = parseFloat((pharmGst + labGst).toFixed(2));

    const totalBeforeDiscount = consultTotal + pharmacySub + labSub + totalGst;
    const finalTotal = Math.max(0, parseFloat((totalBeforeDiscount - discountInput).toFixed(2)));

    return {
      consultFee,
      medicinesList,
      testsList,
      consultTotal,
      pharmacySub,
      labSub,
      pharmGst,
      labGst,
      totalGst,
      finalTotal
    };
  }, [selectedPatient, billingMode, manualExtractedData, manualMedicinesList, manualTestsList, includeConsult, selectedMedicines, selectedTests, discountInput, inventory]);

  // Handle OCR file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setManualExtractedData(null);
    }
  };

  const handleScan = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      const result = await api.ocrScan(file);
      setManualExtractedData({ raw: result.extracted_text, structured: result.structured_data });
      
      const initialMeds: Record<string, { selected: boolean; qty: number }> = {};
      const initialTests: Record<string, boolean> = {};

      Object.entries(result.structured).forEach(([k, v]) => {
        const itemLower = k.toLowerCase();
        const matchedMed = inventory.find(i => i.name.toLowerCase().includes(itemLower) || i.genericName.toLowerCase().includes(itemLower));
        const matchedTest = MASTER_TEST_CATALOG.find(t => t.name.toLowerCase().includes(itemLower));
        
        if (matchedMed) {
          initialMeds[matchedMed.name.toLowerCase()] = { selected: true, qty: 10 };
        } else if (matchedTest) {
          initialTests[matchedTest.loincCode] = true;
        } else {
          initialMeds[k.toLowerCase()] = { selected: true, qty: 10 };
        }
      });
      setSelectedMedicines(initialMeds);
      setSelectedTests(initialTests);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Prescription Scanned! 🔍', message: 'Extracting medications and referred tests.', type: 'success' }
      }));
    } catch {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'OCR Failed', message: 'Unable to parse file. Please try again.', type: 'error' }
      }));
    } finally {
      setIsScanning(false);
    }
  };

  // Printing handlers
  const handlePrintSplitInvoice = (type: 'pharmacy' | 'lab' | 'combined') => {
    if (!selectedPatient || !billingLedger) return;

    let itemsHtml = '';
    let sectionTitle = 'Unified Invoice';
    let chargesBreakdown = '';

    if (type === 'pharmacy') {
      sectionTitle = 'Pharmacy Bill / Invoice';
      const rows = billingLedger.medicinesList
        .filter(m => selectedMedicines[m.name.toLowerCase()]?.selected)
        .map(m => {
          const qty = selectedMedicines[m.name.toLowerCase()].qty;
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${m.name}<br/><span style="font-size:10px;color:#94a3b8">Batch: ${m.batch}</span></td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${m.price.toFixed(2)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${qty}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${(m.price * qty).toFixed(2)}</td>
          </tr>`;
        }).join('');

      itemsHtml = `<thead>
        <tr style="background:#f1f5f9;color:#64748b;font-size:11px;text-transform:uppercase;">
          <th style="padding:8px 12px;text-align:left;">Medicine / Item</th>
          <th style="padding:8px 12px;text-align:right;">Rate</th>
          <th style="padding:8px 12px;text-align:center;">Qty</th>
          <th style="padding:8px 12px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>`;

      chargesBreakdown = `
        <tr><td style="padding:6px 0;color:#64748b">Pharmacy Subtotal:</td><td style="text-align:right;font-weight:600">₹${billingLedger.pharmacySub.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">CGST + SGST (12%):</td><td style="text-align:right;font-weight:600">₹${billingLedger.pharmGst.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Discount Given:</td><td style="text-align:right;font-weight:600;color:#e11d48">-₹${discountInput.toFixed(2)}</td></tr>
        <tr style="border-top:2px solid #cbd5e1"><td style="padding:10px 0;font-size:14px;font-weight:bold;color:#0f172a">Net Payable:</td><td style="text-align:right;font-size:14px;font-weight:bold;color:#106675">₹${Math.max(0, billingLedger.pharmacySub + billingLedger.pharmGst - discountInput).toFixed(2)}</td></tr>`;
    } 
    else if (type === 'lab') {
      sectionTitle = 'Diagnostics Pathology Bill';
      const rows = billingLedger.testsList
        .filter(t => selectedTests[t.loincCode])
        .map(t => {
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${t.name}<br/><span style="font-size:10px;color:#94a3b8">LOINC: ${t.loincCode}</span></td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${t.price.toFixed(2)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">1</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${t.price.toFixed(2)}</td>
          </tr>`;
        }).join('');

      itemsHtml = `<thead>
        <tr style="background:#f1f5f9;color:#64748b;font-size:11px;text-transform:uppercase;">
          <th style="padding:8px 12px;text-align:left;">Prescribed Diagnostic Test</th>
          <th style="padding:8px 12px;text-align:right;">Rate</th>
          <th style="padding:8px 12px;text-align:center;">Qty</th>
          <th style="padding:8px 12px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>`;

      chargesBreakdown = `
        <tr><td style="padding:6px 0;color:#64748b">Diagnostics Subtotal:</td><td style="text-align:right;font-weight:600">₹${billingLedger.labSub.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">CGST + SGST (18%):</td><td style="text-align:right;font-weight:600">₹${billingLedger.labGst.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Discount Given:</td><td style="text-align:right;font-weight:600;color:#e11d48">-₹${discountInput.toFixed(2)}</td></tr>
        <tr style="border-top:2px solid #cbd5e1"><td style="padding:10px 0;font-size:14px;font-weight:bold;color:#0f172a">Net Payable:</td><td style="text-align:right;font-size:14px;font-weight:bold;color:#106675">₹${Math.max(0, billingLedger.labSub + billingLedger.labGst - discountInput).toFixed(2)}</td></tr>`;
    } 
    else {
      // Combined Bill
      sectionTitle = 'Consolidated Clinic Receipt';
      let rows = '';
      if (includeConsult) {
        rows += `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">OPD Consultation Fee</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${billingLedger.consultFee.toFixed(2)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">1</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${billingLedger.consultFee.toFixed(2)}</td>
        </tr>`;
      }
      billingLedger.medicinesList
        .filter(m => selectedMedicines[m.name.toLowerCase()]?.selected)
        .forEach(m => {
          const qty = selectedMedicines[m.name.toLowerCase()].qty;
          rows += `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">[Pharmacy] ${m.name}<br/><span style="font-size:10px;color:#94a3b8">Batch: ${m.batch}</span></td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${m.price.toFixed(2)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${qty}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${(m.price * qty).toFixed(2)}</td>
          </tr>`;
        });
      billingLedger.testsList
        .filter(t => selectedTests[t.loincCode])
        .forEach(t => {
          rows += `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">[Lab] ${t.name}<br/><span style="font-size:10px;color:#94a3b8">LOINC: ${t.loincCode}</span></td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${t.price.toFixed(2)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">1</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${t.price.toFixed(2)}</td>
          </tr>`;
        });

      itemsHtml = `<thead>
        <tr style="background:#f1f5f9;color:#64748b;font-size:11px;text-transform:uppercase;">
          <th style="padding:8px 12px;text-align:left;">Item Details</th>
          <th style="padding:8px 12px;text-align:right;">Rate</th>
          <th style="padding:8px 12px;text-align:center;">Qty</th>
          <th style="padding:8px 12px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>`;

      chargesBreakdown = `
        <tr><td style="padding:6px 0;color:#64748b">Consultation Subtotal:</td><td style="text-align:right;font-weight:600">₹${billingLedger.consultTotal.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Pharmacy Items Subtotal:</td><td style="text-align:right;font-weight:600">₹${billingLedger.pharmacySub.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Diagnostics Subtotal:</td><td style="text-align:right;font-weight:600">₹${billingLedger.labSub.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">GST Amount (12% Pharm / 18% Lab):</td><td style="text-align:right;font-weight:600">₹${billingLedger.totalGst.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Discount Input:</td><td style="text-align:right;font-weight:600;color:#e11d48">-₹${discountInput.toFixed(2)}</td></tr>
        <tr style="border-top:2px solid #cbd5e1"><td style="padding:10px 0;font-size:14px;font-weight:bold;color:#0f172a">Grand Total Paid:</td><td style="text-align:right;font-size:14px;font-weight:bold;color:#106675">₹${billingLedger.finalTotal.toFixed(2)}</td></tr>`;
    }

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>VitalSync Receipt</title>
  <style>
    body { font-family: 'Inter', sans-serif; margin: 40px; color: #0f172a; font-size:13px; line-height:1.5; }
    .header-box { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #106675; padding-bottom:12px; margin-bottom:20px; }
    h1 { color: #106675; margin:0; font-size:22px; }
    .subtitle { color:#64748b; font-size:11px; margin-top:2px; text-transform:uppercase; letter-spacing:0.05em; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .summary-table { width:300px; margin-left:auto; margin-top:20px; }
    .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align:center; }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <h1>🏥 VitalSync Healthcare</h1>
      <div class="subtitle">${sectionTitle}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748b">
      <strong>Receipt ID:</strong> RCP-${Date.now().toString().substring(6)}<br/>
      <strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}
    </div>
  </div>
  
  <div style="margin-bottom:20px;background:#f8fafc;padding:12px;border-radius:8px;">
    <strong>Patient Name:</strong> ${selectedPatient.name} &nbsp;|&nbsp; 
    <strong>Age/Sex:</strong> ${selectedPatient.age}y / ${selectedPatient.gender} &nbsp;|&nbsp; 
    <strong>Phone:</strong> ${selectedPatient.phone}
  </div>

  <table style="width:100%">
    ${itemsHtml}
  </table>

  <table class="summary-table">
    ${chargesBreakdown}
  </table>

  <div class="footer">
    This is a computerized receipt generated securely. Thank you for choosing VitalSync Integrated Care.
  </div>
  <script>window.print();</script>
</body>
</html>`;

    const blob = new Blob([printHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Clear Payment & Sync Inventory
  const handleClearBill = async () => {
    if (!selectedPatient || !billingLedger) return;
    setIsClearing(true);

    try {
      const invoiceId = `inv-${crypto.randomUUID().substring(0, 8)}`;
      const newInvoice: UnifiedInvoice = {
        id: invoiceId,
        encounterId: 'walkin',
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        patientPhone: selectedPatient.phone,
        doctorFee: billingLedger.consultTotal,
        labFee: billingLedger.labSub,
        pharmacyFee: billingLedger.pharmacySub,
        platformFee: parseFloat((billingLedger.finalTotal * 0.03).toFixed(2)),
        totalAmount: billingLedger.finalTotal,
        upiQrPayload: `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=${billingLedger.finalTotal}&cu=INR&tn=VitalSync-${invoiceId}`,
        paymentStatus: 'cleared',
        paymentMethod: paymentMethod,
        createdAt: new Date().toISOString()
      };

      BillingService.saveUnifiedInvoice(newInvoice);
      BillingService.clearInvoice(invoiceId, paymentMethod);

      setRefreshKey(prev => prev + 1);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Bill Settled! 🧾', message: `Invoice amount of ₹${billingLedger.finalTotal} received via ${paymentMethod.toUpperCase()}.`, type: 'success' }
      }));

      handlePrintSplitInvoice('combined');
      setSelectedPatient(null);
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Checkout Error', message: 'Could not settle invoice.', type: 'error' }
      }));
    } finally {
      setIsClearing(false);
    }
  };

  const dynamicUpiPayload = useMemo(() => {
    if (!billingLedger) return '';
    return `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=${billingLedger.finalTotal}&cu=INR&tn=BillHub-${selectedPatient?.id?.substring(0, 8)}`;
  }, [billingLedger, selectedPatient]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* 1. Left Patient Panel */}
      <div className="lg:col-span-1 glass-panel p-5 bg-white dark:bg-clinical-900/40 border-slate-200/80 shadow-sm rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            Patient Queue Registry
          </h3>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 rounded-xl text-xs outline-none bg-white text-slate-800"
          />
        </div>

        {/* List */}
        <div className="space-y-2 max-h-[450px] overflow-y-auto no-scrollbar">
          {filteredPatients.map(p => {
            const isSelected = selectedPatient?.id === p.id;
            const appts = BillingService.getAppointments();
            const activeVirtual = appts.find(a => a.patientId === p.id && a.isVirtual && a.status !== 'completed' && a.status !== 'cancelled');
            
            const encounters = EncounterService.getEncounters().filter(e => e.patientId === p.id);
            const hasRx = encounters.length > 0;

            return (
              <button
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                className={`w-full p-3 rounded-xl border text-left transition-all relative flex flex-col gap-1.5 cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-500/10 border-indigo-500/30' 
                    : 'bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-950/20 border-slate-200/50 dark:border-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[70%]">{p.name}</span>
                  <span className="text-[9px] font-mono text-slate-400">{p.tokenNumber || 'PAT'}</span>
                </div>
                
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{p.phone}</span>
                  <div className="flex items-center gap-1.5">
                    {hasRx && (
                      <span className="text-[8px] font-extrabold px-1.5 py-0.2 bg-indigo-500/15 text-indigo-600 rounded">Rx</span>
                    )}
                    {activeVirtual && (
                      <span className="text-[8px] font-extrabold px-1.5 py-0.2 bg-emerald-500/15 text-emerald-600 rounded animate-pulse">Virtual</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Middle Billing Details Panel */}
      <div className="lg:col-span-2 space-y-6">
        {selectedPatient ? (
          <div className="glass-panel p-6 bg-white dark:bg-clinical-900/40 border-slate-200/80 shadow-sm rounded-2xl space-y-6 text-left">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">{selectedPatient.name}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  ID: <span className="font-mono text-slate-800 dark:text-slate-200 font-bold bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-lg">{selectedPatient.tokenNumber || 'PAT'}</span> • {selectedPatient.phone}
                </p>
              </div>

              {/* Billing Mode Toggle */}
              <div className="flex border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <button
                  onClick={() => setBillingMode('digital')}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase transition ${
                    billingMode === 'digital' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Digital Sync
                </button>
                <button
                  onClick={() => setBillingMode('manual')}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase transition ${
                    billingMode === 'manual' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Manual / Voice
                </button>
              </div>
            </div>

            {/* Voice & Manual Search Workspace */}
            {billingMode === 'manual' && (
              <div className="p-5 bg-gradient-to-br from-indigo-50/50 via-slate-50/20 to-white border border-indigo-100 dark:border-slate-800 rounded-2xl space-y-4">
                
                {/* Voice Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Voice Billing Companion</span>
                      <span className="block text-[9px] text-slate-400">Speak drugs and tests to auto-fill the bill</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartVoiceBilling}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border-0 transition-all cursor-pointer ${
                      isListening 
                        ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/20' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm hover:shadow'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="h-4 w-4 animate-spin text-white-force" />
                        <span>Listening...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 text-white-force" />
                        <span>Speak Billing</span>
                      </>
                    )}
                  </button>
                </div>

                {voiceTranscript && (
                  <div className="p-3 bg-slate-100 dark:bg-slate-950/80 border border-slate-200/50 dark:border-slate-800/60 rounded-xl text-[10px] text-slate-650 dark:text-slate-300 font-medium">
                    {voiceTranscript}
                  </div>
                )}

                {/* Manual Catalog Search Area */}
                <div className="space-y-2">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Search & Add Catalog Item manually</span>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Type medicine name or lab test name to add..."
                      value={manualItemSearchQuery}
                      onChange={(e) => setManualItemSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 rounded-xl text-xs outline-none bg-white text-slate-800"
                    />
                    
                    {/* Search suggestions dropdown */}
                    {catalogSuggestions.length > 0 && (
                      <div className="absolute top-11 left-0 right-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-[220px] overflow-y-auto overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                        {catalogSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleAddSuggestedItem(s)}
                            className="w-full px-4 py-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-0 bg-transparent flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-100">{s.name}</span>
                              <span className="block text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{s.type === 'pharmacy' ? 'Medicine Stock' : 'Pathology Lab'}</span>
                            </div>
                            <span className="font-black text-indigo-600 dark:text-indigo-400">₹{s.price}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Section */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Or Scan Written Slip</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer shadow-xs transition select-none">
                      <span>{fileName ? fileName : 'Choose image'}</span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                        className="hidden"
                      />
                    </label>
                    {fileName && (
                      <button
                        onClick={handleScan}
                        disabled={isScanning}
                        className="btn-primary px-3 py-1.5 text-[10px] font-bold rounded-xl text-white-force bg-indigo-600-force hover:bg-indigo-700-force transition disabled:opacity-60"
                      >
                        {isScanning ? 'Scanning...' : 'Process'}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Interactive Billing Ledger */}
            {billingLedger && (
              <div className="space-y-6">
                
                {/* 1. OPD Consultation Fee */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">1. Doctor Consultation OPD</h4>
                  <div className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeConsult}
                        onChange={(e) => setIncludeConsult(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">OPD Attendance & consultation</span>
                        <span className="block text-[10px] text-slate-500">Regular clinic consultation visit fee</span>
                      </div>
                    </label>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">₹{billingLedger.consultFee}</span>
                  </div>
                </div>

                {/* 2. Pharmacy items list */}
                {billingLedger.medicinesList.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">2. Pharmacy Medicines Ledger</h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Include</th>
                            <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Medicine</th>
                            <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono text-right">Price</th>
                            <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono text-center">Quantity</th>
                            <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingLedger.medicinesList.map((m, idx) => {
                            const state = selectedMedicines[m.name.toLowerCase()] || { selected: false, qty: 10 };
                            return (
                              <tr key={idx} className="border-b border-slate-200/50 dark:border-slate-800/50 last:border-0">
                                <td className="p-3">
                                  <input
                                    type="checkbox"
                                    checked={state.selected}
                                    onChange={(e) => setSelectedMedicines(prev => ({
                                      ...prev,
                                      [m.name.toLowerCase()]: { ...state, selected: e.target.checked }
                                    }))}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                  />
                                </td>
                                <td className="p-3">
                                  <div className="font-bold text-slate-800 dark:text-slate-200">{m.name}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">Batch: {m.batch} | Stock: {m.stock} units</div>
                                </td>
                                <td className="p-3 text-right text-slate-600 dark:text-slate-400">₹{m.price}</td>
                                <td className="p-3 text-center">
                                  <div className="inline-flex items-center border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedMedicines(prev => ({
                                        ...prev,
                                        [m.name.toLowerCase()]: { ...state, qty: Math.max(1, state.qty - 1) }
                                      }))}
                                      className="px-2 py-1 text-slate-500 hover:bg-slate-100 cursor-pointer border-0 bg-transparent text-xs"
                                    >
                                      -
                                    </button>
                                    <span className="px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">{state.qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedMedicines(prev => ({
                                        ...prev,
                                        [m.name.toLowerCase()]: { ...state, qty: state.qty + 1 }
                                      }))}
                                      className="px-2 py-1 text-slate-500 hover:bg-slate-100 cursor-pointer border-0 bg-transparent text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">
                                  ₹{m.price * state.qty}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. Pathology tests list */}
                {billingLedger.testsList.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">3. Pathology Requisitions</h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Include</th>
                            <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">LOINC Test Code</th>
                            <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Test Name</th>
                            <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingLedger.testsList.map((t, idx) => (
                            <tr key={idx} className="border-b border-slate-200/50 dark:border-slate-800/50 last:border-0">
                              <td className="p-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedTests[t.loincCode] || false}
                                    onChange={(e) => setSelectedTests(prev => ({
                                      ...prev,
                                      [t.loincCode]: e.target.checked
                                    }))}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                  />
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-500 dark:text-slate-400">{t.loincCode}</td>
                              <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{t.name}</td>
                              <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">₹{t.price}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. Bottom Billing Workspace Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  
                  {/* Left Column: Split Invoices Print buttons */}
                  <div className="md:col-span-1 space-y-3">
                    <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Generate Split Invoices</h5>
                    <button
                      type="button"
                      onClick={() => handlePrintSplitInvoice('pharmacy')}
                      disabled={billingLedger.pharmacySub === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350 cursor-pointer shadow-xs transition active:scale-95 disabled:opacity-50"
                    >
                      <Printer className="h-4 w-4" />
                      Pharmacy Receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintSplitInvoice('lab')}
                      disabled={billingLedger.labSub === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350 cursor-pointer shadow-xs transition active:scale-95 disabled:opacity-50"
                    >
                      <Printer className="h-4 w-4" />
                      Diagnostics Receipt
                    </button>
                  </div>

                  {/* Middle Column: Payment Details & QR */}
                  <div className="md:col-span-1 space-y-3">
                    <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Select Payment Method</h5>
                    
                    <div className="flex flex-col gap-2">
                      {['upi', 'cash', 'card'].map((method) => (
                        <label
                          key={method}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition select-none ${
                            paymentMethod === method
                              ? 'bg-indigo-500/10 border-indigo-500/30 font-bold text-slate-800 dark:text-slate-100'
                              : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === method}
                            onChange={() => setPaymentMethod(method as any)}
                            className="text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span className="text-xs uppercase font-mono">{method} Payment</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Checkout Panel */}
                  <div className="md:col-span-1 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Items Subtotal:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">₹{(billingLedger.consultTotal + billingLedger.pharmacySub + billingLedger.labSub).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>GST Amount:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">₹{billingLedger.totalGst.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Discount (₹):</span>
                        <input
                          type="number"
                          value={discountInput === 0 ? '' : discountInput}
                          onChange={(e) => setDiscountInput(Math.max(0, parseFloat(e.target.value) || 0))}
                          placeholder="0"
                          className="w-16 px-1.5 py-0.5 border border-slate-200 rounded-md text-right text-xs outline-none bg-white text-slate-800 font-bold"
                        />
                      </div>
                      
                      <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
                      <div className="flex justify-between text-slate-800 dark:text-white font-bold">
                        <span>Net Payable:</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black">₹{billingLedger.finalTotal}</span>
                      </div>
                    </div>

                    {paymentMethod === 'upi' && billingLedger.finalTotal > 0 && (
                      <div className="flex flex-col items-center gap-1.5 p-2 bg-white rounded-xl border border-slate-100 shadow-xs">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&color=0f172a&data=${encodeURIComponent(dynamicUpiPayload)}`}
                          alt="Dynamic Payment UPI QR"
                          className="w-20 h-20"
                        />
                        <span className="text-[8px] text-slate-400 uppercase font-mono tracking-widest">Scan with GPay/PhonePe</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleClearBill}
                      disabled={isClearing}
                      className="w-full btn-primary py-2.5 text-center text-xs font-bold rounded-xl text-white-force bg-indigo-600-force hover:bg-indigo-700-force transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      <Check className="h-4 w-4" />
                      {isClearing ? 'Clearing...' : 'Clear Bill & Print'}
                    </button>
                  </div>

                </div>

              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel p-10 bg-white dark:bg-clinical-900/40 border-slate-200/80 shadow-sm rounded-2xl flex flex-col items-center justify-center text-center space-y-3 min-h-[400px]">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-500">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">No Patient Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">Select an active patient registry profile from the left sidebar queue to initiate invoicing, fetch digital prescriptions, or upload manual slips.</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
