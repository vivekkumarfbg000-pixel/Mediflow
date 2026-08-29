import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FlaskConical, Receipt, UserPlus, Upload, BarChart3, Landmark, Network, X, Check,
  Lock, Tag, ClipboardEdit, ShieldCheck, FileText, Printer, Send, Search,
  UserCheck, CheckCircle2, RefreshCw, PlusCircle, Info, PieChart,
  CloudUpload, Microscope, Calendar, Coins, Activity, Sparkles, Eye, Camera,
  FileCheck, ArrowRight, Clock, Smartphone, CheckCheck, QrCode, AlertTriangle, Trash2
} from 'lucide-react';
import { api, MASTER_TEST_CATALOG } from '../../services/api';
import { PaymentService } from '../../services/paymentService';
import { BillingService } from '../../services/billingService';
import { PatientService } from '../../services/patientService';
import { ForecastService } from '../../services/forecastService';
import { WhatsAppService } from '../../services/whatsappService';
import { useSpecialization } from '../../context/SpecializationContext';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeSyncService } from '../../services/realtimeSyncService';
import { generateLabReportPdf } from '../../utils/pdfGenerator';
import { ClinicalNotificationService } from '../../services/clinicalNotificationService';
import type { ReagentStock } from '../../services/api';
import type { LabRequisition, Patient, Invoice, LabReport, UnifiedInvoice } from '../../types';
import { useClinic } from '../../context/ClinicContext';
import { SettlementWidget } from '../shared/SettlementWidget';
import { ZeroQueueState, InlineEmptyState } from '../shared/EmptyState';
import { getIstDateString, getIstDateDisplay } from '../../utils/dateUtils';

/* ─────────────────────────────────────────────────────────────────────────────
   Mediflow Pathology Lab Dashboard  V2.0
   Interconnected clinical node — Doctor › Lab › Pharmacy › WhatsApp
 ───────────────────────────────────────────────────────────────────────────── */

type LabTab = 'queue' | 'walkin' | 'upload_report' | 'analytics' | 'settlements' | 'pod_network' | 'billing_invoices';

export const LabDashboard: React.FC = () => {
  const { isOphthalmology, testCatalog, nomenclature } = useSpecialization();
  const { activePod, activeEntity, podEntities } = useClinic();
  const [activeTab, setActiveTab] = useState<LabTab>('queue');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [requisitions, setRequisitions] = useState<LabRequisition[]>([]);
  const [invoices, setInvoices] = useState<UnifiedInvoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewingDocUrl, setViewingDocUrl] = useState<string | null>(null);
  const [walkinFileUrl, setWalkinFileUrl] = useState<string | null>(null);

  // Specimen label / processing states
  const [printLabelReq, setPrintLabelReq] = useState<LabRequisition | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeReqId, setActiveReqId] = useState<string | null>(null);

  // File Upload states for lab report PDF/Image
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportFilePreviewUrl, setReportFilePreviewUrl] = useState<string>('');

  // Biomarker form states
  const [hba1cVal, setHba1cVal] = useState('6.5');
  const [eagVal, setEagVal] = useState('140');
  const [creatinineVal, setCreatinineVal] = useState('1.1');
  const [egfrVal, setEgfrVal] = useState('85');
  const [bunVal, setBunVal] = useState('14');
  const [hbVal, setHbVal] = useState('13.5');
  const [hctVal, setHctVal] = useState('41');
  const [genericVal, setGenericVal] = useState('');
  const [genericUnit, setGenericUnit] = useState('');
  const [jsonPayload, setJsonPayload] = useState('{}');

  // Walk-in registration states
  const [walkinPatientId, setWalkinPatientId] = useState('');
  const [walkinTestCode, setWalkinTestCode] = useState('');
  const [walkinBusy, setWalkinBusy] = useState(false);
  const [walkinSearch, setWalkinSearch] = useState('');

  // Direct Report Upload states
  const [directPatientId, setDirectPatientId] = useState('');
  const [directTestCode, setDirectTestCode] = useState('4544-3'); // HbA1c default
  const [directFile, setDirectFile] = useState<File | null>(null);
  const [directFilePreviewUrl, setDirectFilePreviewUrl] = useState('');
  const [directSearch, setDirectSearch] = useState('');
  const [directBusy, setDirectBusy] = useState(false);
  const [directQueueFilterTab, setDirectQueueFilterTab] = useState<'prescribed_lab' | 'today_consultations' | 'all'>('prescribed_lab');
  const [isAiScanningReport, setIsAiScanningReport] = useState(false);
  const [lastDirectSubmission, setLastDirectSubmission] = useState<{
    reportId: string;
    patientName: string;
    patientPhone: string;
    testName: string;
    loincCode: string;
    pdfBlobUrl?: string;
    pdfFileUrl?: string;
    time: string;
    biomarkers: any;
  } | null>(null);

  const directFileInputRef = useRef<HTMLInputElement>(null);
  const directCameraInputRef = useRef<HTMLInputElement>(null);

  const activeReq = useMemo(
    () => requisitions.find(r => r.id === activeReqId),
    [activeReqId, requisitions]
  );

  useEffect(() => {
    const handleLabTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail as any);
      }
    };
    window.addEventListener('mediflow-lab-tab-changed', handleLabTabChange);
    return () => window.removeEventListener('mediflow-lab-tab-changed', handleLabTabChange);
  }, []);

  /* ─── Main data sync ─────────────────────────────────────────── */
  useEffect(() => {
    const sync = () => {
      setRequisitions(api.getLabRequisitions());
      setInvoices(api.getUnifiedInvoices());
      setPatients(api.getPatients());
    };
    sync();
    window.addEventListener('mediflow-state-change', sync);

    const unsubscribeApi = api.subscribe(sync);
    const unsubscribeRealtime = RealtimeSyncService.subscribeToLiveClinicUpdates({
      onLabRequisitionChange: () => sync(),
      onPatientChange: () => sync(),
      onUnifiedInvoiceChange: () => sync(),
      onPathologyReportChange: () => sync(),
      onFinancialLedgerChange: () => sync(),
      onAppointmentChange: () => sync()
    });

    return () => {
      window.removeEventListener('mediflow-state-change', sync);
      unsubscribeApi();
      unsubscribeRealtime();
    };
  }, []);

  /* ─── Set active patient when selecting a requisition ────────── */
  useEffect(() => {
    if (activeReq) {
      const p = api.getPatients().find(pt => pt.id === activeReq.patientId);
      if (p) api.setActivePatient(p);
    }
  }, [activeReqId, requisitions]);

  /* ─── Live JSON payload builder ──────────────────────────────── */
  useEffect(() => {
    if (!activeReq) return;
    const data: Record<string, any> = {
      testCode: activeReq.testCode,
      testName: activeReq.testName,
      patientId: activeReq.patientId,
      timestamp: new Date().toISOString()
    };
    switch (activeReq.testCode) {
      case '4544-3':
        data.biomarkers = {
          HbA1c: parseFloat(hba1cVal) || 0, HbA1c_unit: '%',
          estimatedAverageGlucose: parseFloat(eagVal) || 0, eAG_unit: 'mg/dL'
        };
        break;
      case '2160-0':
        data.biomarkers = {
          serumCreatinine: parseFloat(creatinineVal) || 0, creatinine_unit: 'mg/dL',
          eGFR: parseFloat(egfrVal) || 0, eGFR_unit: 'mL/min/1.73m2',
          bloodUreaNitrogen: parseFloat(bunVal) || 0, BUN_unit: 'mg/dL'
        };
        break;
      case '3024-7':
        data.biomarkers = {
          hemoglobin: parseFloat(hbVal) || 0, hemoglobin_unit: 'g/dL',
          hematocrit: parseFloat(hctVal) || 0, hematocrit_unit: '%'
        };
        break;
      default:
        data.biomarkers = { resultValue: genericVal, unit: genericUnit || 'N/A' };
    }
    setJsonPayload(JSON.stringify(data, null, 2));
  }, [activeReqId, hba1cVal, eagVal, creatinineVal, egfrVal, bunVal, hbVal, hctVal, genericVal, genericUnit, activeReq]);

  /* ─── Derived lists ──────────────────────────────────────────── */
  const gatedRequisitions = useMemo(() => {
    return requisitions.filter(req => {
      // Walk-ins, direct manual uploads, or completed tests are always visible
      if (req.encounterId === 'walkin' || req.encounterId?.startsWith('walkin-') || (req as any).source === 'direct' || req.status === 'completed') {
        return true;
      }
      // If linked to a pending payment invoice, gate until cleared
      const matchingInv = invoices.find(i => i.id === req.id || i.encounterId === req.encounterId || (i.patientId === req.patientId && i.labFee > 0));
      if (matchingInv && (matchingInv.paymentStatus === 'pending' || (matchingInv.paymentStatus as string) === 'unpaid')) {
        return false;
      }
      return true;
    });
  }, [requisitions, invoices]);

  const pendingList = useMemo(() => gatedRequisitions.filter(r => r.status === 'pending'), [gatedRequisitions]);
  const collectedList = useMemo(
    () => gatedRequisitions.filter(r => r.status === 'collected' || r.status === 'processed'),
    [gatedRequisitions]
  );
  const completedList = useMemo(() => gatedRequisitions.filter(r => r.status === 'completed'), [gatedRequisitions]);
  const walkinList = useMemo(() => gatedRequisitions.filter(r => r.encounterId === 'walkin'), [gatedRequisitions]);
  const filteredPatients = useMemo(
    () =>
      patients.filter(p =>
        (p.name || '').toLowerCase().includes(walkinSearch.toLowerCase()) ||
        (p.phone || '').includes(walkinSearch)
      ),
    [patients, walkinSearch]
  );

  const todayAppointments = useMemo(() => {
    const todayStr = getIstDateString();
    const appts = BillingService.getAppointments();
    return appts.filter(a => (a.date || '').startsWith(todayStr) || (a.createdAt || (a as any).created_at || '').startsWith(todayStr));
  }, [requisitions, invoices, patients]);

  const todayQueuePatients = useMemo(() => {
    const todayStr = getIstDateString();
    const activeReqs = requisitions.filter(r => (r.createdAt || '').startsWith(todayStr) || r.status !== 'completed');
    
    const map = new Map<string, {
      patient: Patient;
      requisitions: LabRequisition[];
      appointment?: any;
      source: 'whatsapp' | 'qr' | 'walkin' | 'emergency';
      tokenNumber: string | number;
      isPrescribedLab: boolean;
      status: string;
    }>();

    activeReqs.forEach(r => {
      const p = patients.find(pt => pt.id === r.patientId);
      if (!p) return;
      const appt = todayAppointments.find(a => a.patientId === p.id || a.patient_id === p.id || (a.patientName || '').toLowerCase() === (p.name || '').toLowerCase());
      if (!map.has(p.id)) {
        map.set(p.id, {
          patient: p,
          requisitions: [r],
          appointment: appt,
          source: (appt?.source || (p as any).source || 'walkin') as any,
          tokenNumber: appt?.tokenNumber || p.tokenNumber || '#TK',
          isPrescribedLab: true,
          status: appt?.status || 'Lab Ordered'
        });
      } else {
        const item = map.get(p.id)!;
        item.requisitions.push(r);
        item.isPrescribedLab = true;
      }
    });

    todayAppointments.forEach(a => {
      const p = patients.find(pt => pt.id === a.patientId || pt.id === a.patient_id || (pt.name || '').toLowerCase() === (a.patientName || '').toLowerCase());
      if (p && !map.has(p.id)) {
        map.set(p.id, {
          patient: p,
          requisitions: [],
          appointment: a,
          source: (a.source || (p as any).source || 'walkin') as any,
          tokenNumber: a.tokenNumber || p.tokenNumber || '#TK',
          isPrescribedLab: false,
          status: a.status || 'Consulted'
        });
      }
    });

    // If no active appointments/requisitions exist today, fall back to registered patients
    if (map.size === 0) {
      patients.slice(0, 8).forEach(p => {
        map.set(p.id, {
          patient: p,
          requisitions: [],
          source: ((p as any).source || 'walkin') as any,
          tokenNumber: p.tokenNumber || '#TK-01',
          isPrescribedLab: false,
          status: 'Registered'
        });
      });
    }

    return Array.from(map.values());
  }, [requisitions, patients, todayAppointments]);

  const directFilteredQueuePatients = useMemo(() => {
    let list = todayQueuePatients;
    if (directQueueFilterTab === 'prescribed_lab') {
      const prescribed = todayQueuePatients.filter(item => item.isPrescribedLab || item.requisitions.length > 0);
      list = prescribed.length > 0 ? prescribed : todayQueuePatients;
    } else if (directQueueFilterTab === 'today_consultations') {
      const consulted = todayQueuePatients.filter(item => !!item.appointment);
      list = consulted.length > 0 ? consulted : todayQueuePatients;
    } else if (directQueueFilterTab === 'all') {
      // Full patient directory
      if (directSearch.trim()) {
        const q = directSearch.toLowerCase();
        return patients
          .filter(p => (p.name || '').toLowerCase().includes(q) || (p.phone || '').includes(q))
          .map(p => ({
            patient: p,
            requisitions: requisitions.filter(r => r.patientId === p.id),
            source: ((p as any).source || 'walkin') as any,
            tokenNumber: p.tokenNumber || '#TK',
            isPrescribedLab: requisitions.some(r => r.patientId === p.id),
            status: 'Registered'
          }));
      }
    }

    if (!directSearch.trim()) return list;

    const q = directSearch.toLowerCase();
    return list.filter(item =>
      (item.patient.name || '').toLowerCase().includes(q) ||
      (item.patient.phone || '').includes(q) ||
      String(item.tokenNumber).toLowerCase().includes(q) ||
      item.requisitions.some(r => (r.testName || '').toLowerCase().includes(q) || r.testCode.includes(q))
    );
  }, [todayQueuePatients, directQueueFilterTab, directSearch, patients, requisitions]);

  const directFilteredPatients = useMemo(
    () =>
      patients.filter(p =>
        (p.name || '').toLowerCase().includes(directSearch.toLowerCase()) ||
        (p.phone || '').includes(directSearch) ||
        (p.patientCode && String(p.patientCode).toLowerCase().includes(directSearch.toLowerCase())) ||
        (p.tokenNumber && String(p.tokenNumber).toLowerCase().includes(directSearch.toLowerCase()))
      ),
    [patients, directSearch]
  );

  /* ─── Analytics data ─────────────────────────────────────────── */
  const todayStr = getIstDateString();
  const todayCompleted = useMemo(
    () => completedList.filter(r => (r.createdAt || '').startsWith(todayStr)),
    [completedList, todayStr]
  );
  const todayRevenue = useMemo(() => {
    return todayCompleted.reduce((sum, r) => {
      const test = testCatalog.find(t => t.loincCode === r.testCode);
      return sum + (test?.price || 0);
    }, 0);
  }, [todayCompleted, testCatalog]);
  const totalTests = useMemo(() => completedList.length, [completedList]);
  const testBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    completedList.forEach(r => {
      const name = r.testName || 'Laboratory Test';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [completedList]);

  /* ─── Handlers ───────────────────────────────────────────────── */

  const handleCollectSample = React.useCallback((req: LabRequisition) => {
    api.collectLabSample(req.id);
    setPrintLabelReq(req);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'Specimen collected and barcoded. Label ready for printing.',
        type: 'success',
        title: 'Sample Collected'
      }
    }));
  }, []);

  const handleOpenSubmit = React.useCallback((req: LabRequisition) => {
    setActiveReqId(req.id);
    if (req.testCode === '4544-3') { setHba1cVal('6.5'); setEagVal('140'); }
    else if (req.testCode === '2160-0') { setCreatinineVal('1.1'); setEgfrVal('85'); setBunVal('14'); }
    else if (req.testCode === '3024-7') { setHbVal('13.5'); setHctVal('41'); }
    else { setGenericVal(''); setGenericUnit(''); }
  }, []);

  const handlePublishReport = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReqId || !activeReq) return;
    setIsProcessing(true);

    (async () => {
      try {
        // Parse payload safely
        let parsedPayload: any = {};
        try {
          parsedPayload = JSON.parse(jsonPayload);
        } catch {
          parsedPayload = { raw: jsonPayload };
        }

        const targetPatient = patients.find(p => p.id === activeReq.patientId);
        const patientPhone = targetPatient?.phone || (activeReq as any).patientPhone || (activeReq as any).patient_phone || '';

        let reportFileUrl = '';
        if (reportFile) {
          reportFileUrl = await api.uploadLabReportToStorage(reportFile, activeReqId);
        } else {
          try {
            const biomarkersObj = parsedPayload?.biomarkers || parsedPayload;
            const interpretation = ClinicalNotificationService.generateHinglishLabInterpretation(activeReq.testCode, activeReq.testName || 'Pathology Test', biomarkersObj);
            const pdfBytes = await generateLabReportPdf({
              reportId: activeReqId,
              patientName: activeReq.patientName,
              patientPhone,
              age: targetPatient?.age,
              gender: targetPatient?.gender,
              testName: activeReq.testName || 'Pathology Diagnostic Panel',
              loincCode: activeReq.testCode,
              biomarkers: biomarkersObj,
              hinglishSummary: interpretation,
              doctorName: activePod?.doctor_name || 'Dr. Attending Physician',
              clinicName: activePod?.name || activeEntity?.name || 'VitalSync Care Clinic',
              date: getIstDateDisplay()
            });
            const pdfBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            const genFile = new File([pdfBlob], `Report_${activeReqId}.pdf`, { type: 'application/pdf' });
            reportFileUrl = await api.uploadLabReportToStorage(genFile, activeReqId);
          } catch (pdfErr) {
            console.warn('[LabDashboard] Auto-PDF generation fallback notice:', pdfErr);
          }
        }

        // Submit the standard lab result (updates local state and pushes to DB requisitions)
        await api.submitLabResult(activeReqId, jsonPayload);
        
        // Save the full structured report (so the compounder and doctor see it instantly)
        const reportUuid = crypto.randomUUID();
        const newReport: LabReport = {
          id: reportUuid,
          requisitionId: activeReqId,
          patientId: activeReq.patientId,
          patientName: activeReq.patientName,
          reportFileUrl: reportFileUrl || undefined,
          biomarkerJson: parsedPayload,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        api.saveFullLabReport(newReport);

        // Dispatch automated WhatsApp Lab Report with structured biomarkers and Hinglish interpretation
        if (patientPhone) {
          api.dispatchLabReportWhatsApp({
            patientPhone,
            patientName: activeReq.patientName,
            testName: activeReq.testName || 'Pathology Test',
            loincCode: activeReq.testCode,
            biomarkers: parsedPayload?.biomarkers || parsedPayload,
            reportPdfUrl: reportFileUrl || undefined,
            clinicName: activePod?.name || activeEntity?.name
          }).catch(err => console.warn('[LabDashboard] WhatsApp dispatch notice:', err));
        }

        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            message: `Report verified, uploaded & published successfully for ${activeReq.patientName}! Delivered to WhatsApp.`,
            type: 'success',
            title: 'Report Published'
          }
        }));

        // Reset states
        setActiveReqId(null);
        setReportFile(null);
        setReportFilePreviewUrl('');
        setGenericVal('');
        setGenericUnit('');
      } catch (err: any) {
        console.error(err);
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Report Publish Failed',
            message: err?.message || 'Error publishing lab diagnostic report.',
            type: 'error'
          }
        }));
      } finally {
        setIsProcessing(false);
      }
    })();
  }, [activeReqId, jsonPayload, activeReq, reportFile, patients, activePod, activeEntity]);

  const handleHba1cChange = React.useCallback((val: string) => {
    setHba1cVal(val);
    const n = parseFloat(val);
    setEagVal(!isNaN(n) && n > 0 ? Math.round(28.7 * n - 46.7).toString() : '');
  }, []);

  const handleHbChange = React.useCallback((val: string) => {
    setHbVal(val);
    const n = parseFloat(val);
    setHctVal(!isNaN(n) && n > 0 ? Math.round(n * 3).toString() : '');
  }, []);

  const handleWalkinRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinPatientId || !walkinTestCode) return;
    setWalkinBusy(true);
    const test = testCatalog.find(t => t.loincCode === walkinTestCode);
    if (!test) { setWalkinBusy(false); return; }
    api.registerWalkinLabTest(walkinPatientId, walkinTestCode, test.name, walkinFileUrl || undefined);
    setTimeout(() => {
      setWalkinBusy(false);
      setWalkinPatientId('');
      setWalkinTestCode('');
      setWalkinSearch('');
      setWalkinFileUrl(null);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Walk-in test "${test.name}" registered. Requisition pushed to Queue.`,
          type: 'success',
          title: 'Walk-in Registered'
        }
      }));
      setActiveTab('queue');
    }, 700);
  };

  const handleBillWalkinTest = (reqId: string, paymentMethod: 'cash' | 'upi') => {
    const req = requisitions.find(r => r.id === reqId);
    if (!req) return;

    const test = testCatalog.find(t => t.loincCode === req.testCode) || { price: 350 };
    const testPrice = test.price || 350;
    const platformFee = Math.round(testPrice * 0.03);
    const total = testPrice + platformFee;
    const invoiceId = crypto.randomUUID();

    const newInvoice = {
      id: invoiceId,
      encounterId: req.id,
      patientId: req.patientId,
      patientName: req.patientName,
      patientPhone: patients.find(p => p.id === req.patientId)?.phone || '',
      doctorFee: 0,
      labFee: testPrice,
      pharmacyFee: 0,
      platformFee: platformFee,
      totalAmount: total,
      upiQrPayload: `upi://pay?pa=vitalsync@axl&pn=VitalSync&am=${(total || 0).toFixed(2)}&cu=INR&tn=VitalSync-LAB-${(req.id || 'N/A').substring(0,6)}`,
      paymentStatus: 'pending' as const,
      createdAt: new Date().toISOString()
    };

    // Save Unified Invoice locally and sync to Supabase
    api.saveUnifiedInvoice(newInvoice);

    // Clear Payment
    api.clearInvoice(invoiceId, paymentMethod);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Walk-in test invoice generated and payment cleared via ${paymentMethod.toUpperCase()}!`,
        type: 'success',
        title: 'Billing Succeeded'
      }
    }));
  };

  const handleAutoExtractLabReport = async (file: File) => {
    setIsAiScanningReport(true);
    try {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'AI Vision Reading Report 🔬', message: 'Extracting quantified LOINC biomarkers...', type: 'info' }
      }));

      const res = await ForecastService.ocrScan(file);
      const structured = res.structured_data || {};
      
      let matchCount = 0;
      Object.entries(structured).forEach(([k, v]) => {
        const keyLower = (k || '').toLowerCase();
        const valStr = String(v || '');
        if (keyLower.includes('hba1c') || keyLower.includes('glycated')) {
          const match = valStr.match(/(\d+\.?\d*)/);
          if (match) {
            setDirectTestCode('4544-3');
            handleHba1cChange(match[1]);
            matchCount++;
          }
        } else if (keyLower.includes('creatinine')) {
          const match = valStr.match(/(\d+\.?\d*)/);
          if (match) {
            setDirectTestCode('2160-0');
            setCreatinineVal(match[1]);
            matchCount++;
          }
        } else if (keyLower.includes('hemoglobin') || keyLower.includes('hb')) {
          const match = valStr.match(/(\d+\.?\d*)/);
          if (match) {
            setDirectTestCode('3024-7');
            handleHbChange(match[1]);
            matchCount++;
          }
        }
      });

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: matchCount > 0 ? 'Biomarkers Auto-Filled! ✨' : 'Report Slip Loaded',
          message: matchCount > 0 ? `AI auto-filled ${matchCount} values from the analyzer printout.` : 'Report slip attached. Verify biomarker values and submit.',
          type: 'success'
        }
      }));
    } catch (e) {
      console.warn('[LabDashboard] AI OCR extraction failed:', e);
    } finally {
      setIsAiScanningReport(false);
    }
  };

  const handleDirectReportUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directPatientId || !directTestCode) return;
    setDirectBusy(true);

    try {
      const selectedPatient = patients.find(p => p.id === directPatientId);
      const testItem = testCatalog.find(t => t.loincCode === directTestCode);
      if (!selectedPatient || !testItem) {
        setDirectBusy(false);
        return;
      }

      const reqId = crypto.randomUUID();
      const barcode = `DIR-${Date.now()}-${directTestCode}`.toUpperCase();

      const data: Record<string, any> = {
        testCode: directTestCode,
        testName: testItem.name,
        patientId: directPatientId,
        timestamp: new Date().toISOString()
      };
      
      switch (directTestCode) {
        case '4544-3':
          data.biomarkers = {
            HbA1c: parseFloat(hba1cVal) || 0, HbA1c_unit: '%',
            estimatedAverageGlucose: parseFloat(eagVal) || 0, eAG_unit: 'mg/dL'
          };
          break;
        case '2160-0':
          data.biomarkers = {
            serumCreatinine: parseFloat(creatinineVal) || 0, creatinine_unit: 'mg/dL',
            eGFR: parseFloat(egfrVal) || 0, eGFR_unit: 'mL/min/1.73m2',
            bloodUreaNitrogen: parseFloat(bunVal) || 0, BUN_unit: 'mg/dL'
          };
          break;
        case '3024-7':
          data.biomarkers = {
            hemoglobin: parseFloat(hbVal) || 0, hemoglobin_unit: 'g/dL',
            hematocrit: parseFloat(hctVal) || 0, hematocrit_unit: '%'
          };
          break;
        default:
          data.biomarkers = { resultValue: genericVal, unit: genericUnit || 'N/A' };
      }

      let reportFileUrl = '';
      let generatedBlobUrl = '';

      if (directFile) {
        reportFileUrl = await api.uploadLabReportToStorage(directFile, reqId);
      }
      
      try {
        const biomarkersObj = data.biomarkers || data;
        const interpretation = ClinicalNotificationService.generateHinglishLabInterpretation(directTestCode, testItem.name, biomarkersObj);
        const pdfBytes = await generateLabReportPdf({
          reportId: reqId,
          patientName: selectedPatient.name,
          patientPhone: selectedPatient.phone,
          age: selectedPatient.age,
          gender: selectedPatient.gender,
          testName: testItem.name,
          loincCode: directTestCode,
          biomarkers: biomarkersObj,
          hinglishSummary: interpretation,
          doctorName: activePod?.doctor_name || 'Dr. Attending Physician',
          clinicName: activePod?.name || activeEntity?.name || 'VitalSync Care Clinic',
          date: getIstDateDisplay()
        });
        const pdfBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        generatedBlobUrl = URL.createObjectURL(pdfBlob);
        const genFile = new File([pdfBlob], `Report_${reqId}.pdf`, { type: 'application/pdf' });
        if (!reportFileUrl) {
          reportFileUrl = await api.uploadLabReportToStorage(genFile, reqId);
        }
      } catch (pdfErr) {
        console.warn('[LabDashboard] Direct Auto-PDF generation notice:', pdfErr);
      }

      const stringifiedPayload = JSON.stringify(data);
      const requisitionDate = new Date().toISOString();

      const newReq: LabRequisition = {
        id: reqId,
        encounterId: 'walkin',
        patientId: directPatientId,
        patientName: selectedPatient.name,
        testCode: directTestCode,
        testName: testItem.name,
        status: 'completed',
        barcode,
        quantitativeResult: stringifiedPayload,
        createdAt: requisitionDate,
        reagentDeductions: []
      };

      const currentReqs = api.getLabRequisitions();
      currentReqs.unshift(newReq);
      api.saveLabRequisitions(currentReqs);

      await supabase.from('lab_requisitions').insert({
        id: reqId,
        encounter_id: 'walkin',
        patient_id: directPatientId,
        patient_name: selectedPatient.name,
        test_code: directTestCode,
        test_name: testItem.name,
        status: 'completed',
        barcode,
        quantitative_result: stringifiedPayload,
        created_at: requisitionDate,
        updated_at: requisitionDate,
        pod_id: activePod?.id || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'
      });

      const reportUuid = crypto.randomUUID();
      const newReport: LabReport = {
        id: reportUuid,
        requisitionId: reqId,
        patientId: directPatientId,
        patientName: selectedPatient.name,
        reportFileUrl: reportFileUrl || generatedBlobUrl || undefined,
        biomarkerJson: data,
        status: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      api.saveFullLabReport(newReport);

      // Dispatch automated WhatsApp Lab Report with structured biomarkers and Hinglish interpretation
      if (selectedPatient.phone) {
        api.dispatchLabReportWhatsApp({
          patientPhone: selectedPatient.phone,
          patientName: selectedPatient.name,
          testName: testItem.name,
          loincCode: directTestCode,
          biomarkers: data.biomarkers || data,
          reportPdfUrl: reportFileUrl || generatedBlobUrl || undefined,
          clinicName: activePod?.name || activeEntity?.name
        }).catch(err => console.warn('[LabDashboard] Direct WhatsApp dispatch notice:', err));
      }

      // Realtime CDC broadcast to Doctor Dashboard & Compounder Desk
      window.dispatchEvent(new CustomEvent('mediflow-lab-report-ready', {
        detail: {
          reportId: reqId,
          patientId: directPatientId,
          patientName: selectedPatient.name,
          testName: testItem.name,
          loincCode: directTestCode,
          pdfUrl: reportFileUrl || generatedBlobUrl
        }
      }));
      window.dispatchEvent(new CustomEvent('mediflow-state-change'));

      setLastDirectSubmission({
        reportId: reqId,
        patientName: selectedPatient.name,
        patientPhone: selectedPatient.phone,
        testName: testItem.name,
        loincCode: directTestCode,
        pdfBlobUrl: generatedBlobUrl || reportFileUrl,
        pdfFileUrl: reportFileUrl,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        biomarkers: data.biomarkers || data
      });

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Direct lab report submitted for ${selectedPatient.name}! Synced to Doctor Consultation & WhatsApp delivered.`,
          type: 'success',
          title: 'Report Published & Synced! 🚀'
        }
      }));

      // Keep directPatientId selected or reset for next
      setDirectFile(null);
      setDirectFilePreviewUrl('');
    } catch (err: any) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Direct Submission Failed',
          message: err?.message || 'Error submitting direct lab report.',
          type: 'error'
        }
      }));
    } finally {
      setDirectBusy(false);
    }
  };

  /* ─── Sub-components ─────────────────────────────────────────── */
  const renderStepper = (status: 'pending' | 'collected' | 'processed' | 'completed') => {
    const steps = [
      { label: 'Pending', key: 'pending' },
      { label: 'Collected', key: 'collected' },
      { label: 'Processing', key: 'processed' },
      { label: 'Approved', key: 'completed' }
    ];
    const activeIdx =
      status === 'collected' ? 1 : status === 'processed' ? 2 : status === 'completed' ? 3 : 0;
    return (
      <div className="w-full py-3">
        <div className="flex items-center justify-between relative px-2">
          <div className="absolute left-6 right-6 top-3 h-[2px] bg-slate-200 z-0" />
          <div
            className="absolute left-6 top-3 h-[2px] bg-gradient-to-r from-indigo-600 to-teal-500 transition-all duration-500 z-0"
            style={{ width: `${activeIdx === 0 ? 0 : activeIdx === 1 ? 33 : activeIdx === 2 ? 66 : 100}%` }}
          />
          {steps.map((step, idx) => {
            const isCompleted = idx < activeIdx;
            const isActive = idx === activeIdx;
            return (
              <div key={step.key} className="flex flex-col items-center z-10 relative">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300 ${
                  isCompleted ? 'bg-indigo-600 border-indigo-500 text-slate-800 shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]'
                    : isActive ? 'bg-white border-teal-500 text-teal-600 shadow-[0_0_12px_rgba(var(--secondary-rgb),0.6)]'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  {isCompleted ? <Check className="w-3.5 h-3.5 text-white" /> : idx + 1}
                </div>
                <span className={`text-[9px] mt-1.5 font-bold tracking-tight ${isActive ? 'text-teal-600' : isCompleted ? 'text-indigo-600' : 'text-slate-500'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderResultValue = (resultStr?: string) => {
    if (!resultStr) return <span className="text-slate-400 font-mono">N/A</span>;
    try {
      if (resultStr.trim().startsWith('{')) {
        const data = JSON.parse(resultStr);
        if (data.biomarkers) {
          const unitKeys = new Set(['HbA1c_unit','eAG_unit','creatinine_unit','eGFR_unit','BUN_unit','hemoglobin_unit','hematocrit_unit','unit']);
          const labelMap: Record<string, string> = {
            HbA1c: 'HbA1c', estimatedAverageGlucose: 'eAG', serumCreatinine: 'Creatinine',
            eGFR: 'eGFR', bloodUreaNitrogen: 'BUN', hemoglobin: 'Hemoglobin',
            hematocrit: 'Hematocrit', resultValue: 'Result'
          };
          const unitMap: Record<string, string> = {
            HbA1c: '%', estimatedAverageGlucose: ' mg/dL', serumCreatinine: ' mg/dL',
            eGFR: ' mL/min', bloodUreaNitrogen: ' mg/dL', hemoglobin: ' g/dL',
            hematocrit: '%'
          };
          return (
            <div className="space-y-1 font-mono text-[10px]">
              {Object.entries(data.biomarkers)
                .filter(([k]) => !unitKeys.has(k) && k !== 'unit')
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center gap-2 bg-teal-500/20 border border-teal-500/40 px-2 py-1 rounded text-teal-700 dark:text-teal-300 font-bold">
                    <span>{labelMap[k] || k}:</span>
                    <span className="font-extrabold text-teal-800 dark:text-teal-200">{String(v)}{unitMap[k] || (k === 'resultValue' ? ` ${data.biomarkers.unit || ''}` : '')}</span>
                  </div>
                ))}
            </div>
          );
        }
      }
    } catch (_) { /* noop */ }
    return (
      <span className="font-extrabold text-teal-800 dark:text-teal-300 bg-teal-500/20 border border-teal-500/40 px-3 py-1 rounded-lg font-mono text-center block">
        {resultStr}
      </span>
    );
  };

  const tabItems: { id: LabTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'queue', label: 'Test Queue', icon: <FlaskConical className="w-4 h-4 shrink-0" />, badge: pendingList.length + collectedList.length },
    { id: 'billing_invoices', label: 'Billing & Invoices', icon: <Receipt className="w-4 h-4 shrink-0" /> },
    { id: 'walkin', label: 'Walk-in Register', icon: <UserPlus className="w-4 h-4 shrink-0" />, badge: walkinList.length },
    { id: 'upload_report', label: 'Direct Report Upload', icon: <Upload className="w-4 h-4 shrink-0" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4 shrink-0" /> },
    { id: 'settlements', label: 'Settlements', icon: <Landmark className="w-4 h-4 shrink-0" /> },
    { id: 'pod_network', label: 'Pod Network', icon: <Network className="w-4 h-4 shrink-0" /> }
  ];

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div 
      className="max-w-7xl mx-auto p-2 sm:p-4 md:p-6 pb-32 md:pb-12 space-y-6 animate-fade-in"
      style={{ paddingTop: 'env(safe-area-inset-top, 16px)' }}
    >
      {viewingDocUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-800/80 backdrop-blur-md">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 border border-slate-200 shadow-2xl relative">
            <button onClick={() => setViewingDocUrl(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-500 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-slate-800 font-bold mb-4">Document Preview</h3>
            <iframe src={viewingDocUrl} className="w-full h-[60vh] rounded-lg border border-slate-200" title="Document Viewer" />
          </div>
        </div>
      )}

      {/* ── TAB NAV — Desktop Bar ───────────────────────────────────────────── */}
      <div className="hidden md:flex overflow-x-auto gap-2 pb-1.5 no-scrollbar select-none -mb-px">
        {tabItems.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer relative whitespace-nowrap ${
              activeTab === tab.id
                ? 'premium-nav-pill-active'
                : 'bg-slate-50 border-slate-200/60 text-slate-650 hover:border-slate-300 hover:text-slate-850 hover:bg-slate-100/50'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-slate-800 text-[9px] font-black flex items-center justify-center">
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB NAV — Mobile Horizontal Swipe Strip ─────────────────────────── */}
      <div className="flex md:hidden items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 overflow-x-auto no-scrollbar -mt-2 mb-3 select-none">
        {tabItems.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 py-1.5 px-2.5 text-[10px] font-extrabold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer active:scale-95 border-0 ${
                isActive
                  ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-sm font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-1 py-0.2 text-[8px] rounded-full font-black ${
                  isActive ? 'bg-white/25 text-white' : 'bg-rose-500 text-white animate-pulse'
                }`}>
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB: TEST QUEUE
      ══════════════════════════════════════════════════════════ */}
      {activeTab === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Requisition queue cards */}
          <div className="lg:col-span-8 space-y-6">

            {/* Pending draws */}
            <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 to-orange-500 opacity-50" />
              <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Awaiting Sample Collection ({pendingList.length})
              </h2>
              {pendingList.length === 0 ? (
                <ZeroQueueState queueType="lab_draws" className="mx-0" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingList.map(req => {
                    const isConsentActive = api.isPatientConsentActive(req.patientId);
                    const isWalkin = req.encounterId === 'walkin';
                    const inv = invoices.find(i => i.encounterId === req.encounterId);
                    const isUnpaid = !isWalkin && inv && inv.paymentStatus === 'pending' && inv.labFee > 0;
                    return (
                      <div key={req.id} className="p-5 bg-white rounded-xl border border-slate-200 flex flex-col justify-between gap-4 hover:border-slate-300 transition-all duration-300 relative overflow-hidden">
                        {!isConsentActive && !isWalkin && (
                          <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-slate-800/90 backdrop-blur-sm border border-rose-500/20 p-4 text-center animate-fade-in">
                            <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-2 text-rose-500 animate-pulse">
                              <Lock className="w-4 h-4 text-rose-500" />
                            </div>
                            <h4 className="text-slate-800 font-bold text-xs">Consent Lock</h4>
                            <p className="text-[9px] text-slate-500 mt-1">Patient consent not verified.</p>
                          </div>
                        )}
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-bold text-sm text-slate-800">{req.patientName}</h4>
                            <div className="flex items-center gap-1">
                              {isWalkin && (
                                <span className="text-[8px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Walk-in</span>
                              )}
                              {isUnpaid ? (
                                <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse font-mono">
                                  UNPAID: ₹{(inv?.labFee || 0).toFixed(2)} ⚠️
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                                  PAID ✓
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs font-bold text-indigo-600 mt-2 flex items-center gap-1">
                            <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
                            {req.testName}
                          </p>
                          <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                            {renderStepper(req.status)}
                          </div>
                          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                            <div className="flex justify-between text-[8px] text-slate-500 font-mono font-bold tracking-widest uppercase">
                              <span>REQUISITION</span>
                              <span>ID: {(req.id || '').slice(0, 8).toUpperCase()}</span>
                            </div>
                            <div className="simulated-barcode h-8 w-full" />
                            <p className="text-[9px] text-center text-slate-600 font-mono tracking-wider font-bold">*{req.barcode}*</p>
                          </div>
                        </div>
                        {req.prescriptionFileUrl && (
                          <button
                            type="button"
                            onClick={() => setViewingDocUrl(req.prescriptionFileUrl || null)}
                            className="mb-2 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded-lg border border-indigo-500/20 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1 w-full font-sans"
                          >
                            View Scanned Requisition / Rx
                          </button>
                        )}
                        {isUnpaid && inv ? (
                          <div className="space-y-2">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider font-mono text-center">Clear Lab Bill to Collect</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  api.clearInvoice(inv.id, 'cash');
                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: {
                                      message: `Lab Fee ₹${(inv.labFee || 0).toFixed(2)} cleared via CASH! Split settled in financial ledger.`,
                                      type: 'success',
                                      title: 'Lab Fee Cleared'
                                    }
                                  }));
                                }}
                                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-slate-900 font-black rounded-xl uppercase tracking-wider text-[9px] cursor-pointer text-center active:scale-95 transition-transform"
                              >
                                Cash
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await PaymentService.initiatePaymentOrder({
                                      gateway: 'paytm',
                                      invoiceId: inv.id,
                                      amount: inv.totalAmount || inv.labFee,
                                      patientName: inv.patientName || 'Patient',
                                      patientPhone: inv.patientPhone || '9999999999'
                                    });
                                    if (res.success && res.paymentSessionId) {
                                      window.open(res.paymentSessionId, '_blank');
                                    } else {
                                      throw new Error('Failed to initialize Paytm PG');
                                    }
                                  } catch (pErr) {
                                    console.warn('[Paytm Lab Error]:', pErr);
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: { message: 'Failed to connect to Paytm PG.', type: 'error', title: 'Payment Failed ⚠️' }
                                    }));
                                    return;
                                  }
                                  api.clearInvoice(inv.id, 'paytm');
                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: {
                                      message: `Lab Fee ₹${(inv.labFee || 0).toFixed(2)} cleared via Paytm PG! Split settled in financial ledger.`,
                                      type: 'success',
                                      title: 'Lab Fee Cleared'
                                    }
                                  }));
                                }}
                                className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white font-black rounded-xl uppercase tracking-wider text-[9px] cursor-pointer text-center active:scale-95 transition-transform"
                              >
                                Paytm PG
                              </button>
                              <button
                                onClick={() => {
                                  api.clearInvoice(inv.id, 'upi');
                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: {
                                      message: `Lab Fee ₹${(inv.labFee || 0).toFixed(2)} cleared via UPI! Split settled in financial ledger.`,
                                      type: 'success',
                                      title: 'Lab Fee Cleared'
                                    }
                                  }));
                                }}
                                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl uppercase tracking-wider text-[9px] cursor-pointer text-center active:scale-95 transition-transform"
                              >
                                UPI / QR
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCollectSample(req)}
                            className="btn-primary py-2 text-xs flex items-center justify-center gap-2 active:scale-95 transition-all w-full font-bold bg-gradient-to-r from-indigo-600 to-teal-500 border-0 cursor-pointer"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                            Collect Sample
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Collected / Processing */}
            <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-600 to-teal-500 opacity-50" />
              <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                Collected Samples in Processing ({collectedList.length})
              </h2>
              {collectedList.length === 0 ? (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  No samples in active processing.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {collectedList.map(req => {
                    const isConsentActive = api.isPatientConsentActive(req.patientId) || req.encounterId === 'walkin';
                    return (
                      <div key={req.id} className="p-5 bg-white rounded-xl border border-slate-200 flex flex-col justify-between gap-4 hover:border-slate-300 transition-all duration-300 relative overflow-hidden">
                        {!isConsentActive && (
                          <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-slate-800/90 backdrop-blur-sm border border-rose-500/20 p-4 text-center animate-fade-in">
                            <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-2 text-rose-500 animate-pulse">
                              <Lock className="w-4 h-4 text-rose-500" />
                            </div>
                            <h4 className="text-slate-800 font-bold text-xs">Consent Lock</h4>
                          </div>
                        )}
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-bold text-sm text-slate-800">{req.patientName}</h4>
                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">Processing</span>
                          </div>
                          <p className="text-xs font-bold text-teal-600 mt-2 flex items-center gap-1">
                            <FlaskConical className="w-3.5 h-3.5 text-teal-600" />
                            {req.testName}
                          </p>
                          <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                            {renderStepper(req.status)}
                          </div>
                          <div className="mt-3 flex items-center gap-2 bg-slate-50/70 border border-slate-200 p-2.5 rounded-lg">
                            <Tag className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <div className="text-[10px] text-slate-600">
                              Barcode <strong className="text-slate-800 font-mono">{req.barcode}</strong>
                            </div>
                          </div>
                        </div>
                        {req.prescriptionFileUrl && (
                          <button
                            type="button"
                            onClick={() => setViewingDocUrl(req.prescriptionFileUrl || null)}
                            className="mb-2 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded-lg border border-indigo-500/20 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1 w-full"
                          >
                            View Scanned Requisition / Rx
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenSubmit(req)}
                          className="btn-primary py-2 text-xs flex items-center justify-center gap-2 active:scale-95 transition-all w-full font-bold bg-gradient-to-r from-indigo-600 to-teal-500 cursor-pointer"
                        >
                          <ClipboardEdit className="w-3.5 h-3.5" />
                          Input Analyzer Result
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Completed reports table */}
            <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-indigo-500 opacity-50" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
                Completed Diagnostic Report Cards
              </h2>
              {completedList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No completed tests logged today.</div>
              ) : (
                <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                  
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto responsive-table-container">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-white/10 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3.5">Patient</th>
                          <th className="p-3.5">Test</th>
                          <th className="p-3.5">Result</th>
                          {!isOphthalmology && <th className="p-3.5 text-right">Reagent Used</th>}
                          <th className="p-3.5 text-right">Report File</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5 bg-white dark:bg-slate-950">
                        {completedList.map(req => (
                          <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                            <td className="p-3.5 font-semibold text-slate-800 dark:text-white">
                              <div>{req.patientName}</div>
                              {req.encounterId === 'walkin' && (
                                <span className="text-[8px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full uppercase font-mono">Walk-in</span>
                              )}
                            </td>
                            <td className="p-3.5 text-slate-600 dark:text-slate-300">
                              <div className="font-semibold text-slate-800 dark:text-white">{req.testName}</div>
                              <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 uppercase font-mono tracking-wider">
                                LOINC: {req.testCode}
                              </div>
                            </td>
                            <td className="p-3.5">{renderResultValue(req.quantitativeResult)}</td>
                            {!isOphthalmology && (
                              <td className="p-3.5 text-right">
                                {(req.reagentDeductions || []).map((ded, idx) => (
                                  <div key={`reagent-ded-${idx}-${ded.reagentName}-${ded.volumeDeducted}`} className="text-right text-[10px] text-rose-400 flex items-center justify-end gap-1.5 font-bold font-mono">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                    -{ded.volumeDeducted}{ded.unit} {(ded.reagentName || '').replace(' Reagent', '')}
                                  </div>
                                ))}
                              </td>
                            )}
                            <td className="p-3.5 text-right">
                              {(() => {
                                const rep = api.getFullLabReports().find(r => r.requisitionId === req.id);
                                return rep?.reportFileUrl ? (
                                  <button 
                                    onClick={() => setViewingDocUrl(rep.reportFileUrl || null)}
                                    className="ml-auto px-2.5 py-1 bg-slate-200 hover:bg-white/20 border border-white/20 hover:border-white/30 text-slate-800 rounded text-[10px] flex items-center gap-1 font-bold cursor-pointer active:scale-95 transition-transform"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    View Doc
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No File</span>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List View */}
                  <div className="block md:hidden divide-y divide-slate-200 bg-slate-50/30">
                    {completedList.map(req => {
                      const rep = api.getFullLabReports().find(r => r.requisitionId === req.id);
                      return (
                        <div key={req.id} className="p-4 space-y-3 hover:bg-white/40 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-slate-800 text-xs">{req.patientName}</div>
                              {req.encounterId === 'walkin' && (
                                <span className="inline-block text-[8px] text-blue-500 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full uppercase font-mono mt-1">Walk-in</span>
                              )}
                            </div>
                            <span className="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              Completed
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Diagnostic Test</span>
                            <div className="font-semibold text-slate-700 text-xs">{req.testName}</div>
                            <div className="text-[9px] text-slate-500 font-mono">LOINC: {req.testCode}</div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] bg-white/40 p-2.5 rounded-lg border border-slate-200/50">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Report Result</span>
                              <div className="mt-1">{renderResultValue(req.quantitativeResult)}</div>
                            </div>
                            {!isOphthalmology && (
                              <div>
                                <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Reagents Used</span>
                                <div className="space-y-0.5 mt-1">
                                  {(req.reagentDeductions || []).map((ded, idx) => (
                                    <div key={`mob-reagent-ded-${idx}-${ded.reagentName}-${ded.volumeDeducted}`} className="text-[9px] text-rose-500 flex items-center gap-1 font-bold font-mono">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                      -{ded.volumeDeducted}{ded.unit} {(ded.reagentName || '').replace(' Reagent', '')}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-between items-center pt-1">
                            <span className="text-[9px] text-slate-400 font-mono">ID: {(req.id || 'N/A').substring(0, 8)}...</span>
                            {rep?.reportFileUrl ? (
                              <button 
                                onClick={() => setViewingDocUrl(rep.reportFileUrl || null)}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-black font-bold rounded-lg text-[9px] flex items-center gap-1 cursor-pointer border-0 active:scale-95 transition"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                View Report
                              </button>
                            ) : (
                              <span className="text-[9px] text-slate-400 italic">No PDF Uploaded</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              )}
            </div>
          </div>

          {/* Right: Result entry form (appears when a req is active) */}
          <div className="lg:col-span-4 space-y-5">
            {activeReqId && activeReq ? (
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden animate-fade-in">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-indigo-500 opacity-50" />
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2 text-sm">
                  <ClipboardEdit className="w-4 h-4 text-teal-600 shrink-0" />
                  Biomarker Entry Form
                </h3>
                <p className="text-xs text-slate-500 mb-4">Enter quantitative clinical metrics.</p>
                <form onSubmit={handlePublishReport} className="space-y-4">
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-600 font-mono font-bold uppercase tracking-wider">{activeReq.testName}</div>
                    <div className="text-[9px] text-slate-500 font-mono uppercase mt-1">LOINC: {activeReq.testCode}</div>
                  </div>

                  {activeReq.testCode === '4544-3' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">HbA1c (%)</label>
                        <input type="number" required step="0.1" min="3" max="20" value={hba1cVal}
                          onChange={e => handleHba1cChange(e.target.value)}
                          className="w-full input-field text-sm focus:ring-1 focus:ring-teal-400" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">eAG (mg/dL)</label>
                        <input type="number" required value={eagVal}
                          onChange={e => setEagVal(e.target.value)}
                          className="w-full input-field text-sm focus:ring-1 focus:ring-teal-400" />
                        <span className="text-[8px] text-slate-500 font-mono mt-1 block">Auto: eAG = 28.7 × HbA1c − 46.7</span>
                      </div>
                    </div>
                  ) : activeReq.testCode === '2160-0' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">Serum Creatinine (mg/dL)</label>
                        <input type="number" required step="0.01" min="0.1" max="15" value={creatinineVal}
                          onChange={e => setCreatinineVal(e.target.value)}
                          className="w-full input-field text-sm focus:ring-1 focus:ring-teal-400" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">eGFR (mL/min/1.73m²)</label>
                        <input type="number" required value={egfrVal}
                          onChange={e => setEgfrVal(e.target.value)}
                          className="w-full input-field text-sm focus:ring-1 focus:ring-teal-400" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">BUN (mg/dL)</label>
                        <input type="number" required value={bunVal}
                          onChange={e => setBunVal(e.target.value)}
                          className="w-full input-field text-sm focus:ring-1 focus:ring-teal-400" />
                      </div>
                    </div>
                  ) : activeReq.testCode === '3024-7' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">Hemoglobin (g/dL)</label>
                        <input type="number" required step="0.1" min="2" max="25" value={hbVal}
                          onChange={e => handleHbChange(e.target.value)}
                          className="w-full input-field text-sm focus:ring-1 focus:ring-teal-400" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">Hematocrit (%)</label>
                        <input type="number" required value={hctVal}
                          onChange={e => setHctVal(e.target.value)}
                          className="w-full input-field text-sm focus:ring-1 focus:ring-teal-400" />
                        <span className="text-[8px] text-slate-500 font-mono mt-1 block">Auto: Hct ≈ Hb × 3</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">Result Value</label>
                        <input type="text" required placeholder="e.g., 98.4" value={genericVal}
                          onChange={e => setGenericVal(e.target.value)}
                          className="w-full input-field text-sm focus:ring-1 focus:ring-teal-400" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">Unit</label>
                        <input type="text" placeholder="e.g., mg/dL" value={genericUnit}
                          onChange={e => setGenericUnit(e.target.value)}
                          className="w-full input-field text-sm focus:ring-1 focus:ring-teal-400" />
                      </div>
                    </div>
                  )}

                  {/* Reference range */}
                  <div className="bg-slate-50 p-3.5 border border-slate-200 rounded-lg space-y-2">
                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider font-mono">LOINC Reference Range</span>
                    <div className="h-[2px] w-full bg-outline-variant relative rounded-full">
                      <div className="absolute left-[25%] right-[25%] h-full bg-teal-600" />
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                      {activeReq.testCode === '4544-3' ? (
                        <><span>{'< 5.7% Normal'}</span><span className="text-teal-600 font-bold">5.7–6.4% Pre-diab</span><span>≥ 6.5% Diabetic</span></>
                      ) : activeReq.testCode === '2160-0' ? (
                        <><span>{'< 0.6 mg/dL'}</span><span className="text-teal-600 font-bold">0.6–1.2 mg/dL</span><span>{'> 1.2 mg/dL'}</span></>
                      ) : activeReq.testCode === '3024-7' ? (
                        <><span>{'< 12.0 g/dL'}</span><span className="text-teal-600 font-bold">12.0–16.0 g/dL</span><span>{'> 16.0 g/dL'}</span></>
                      ) : (
                        <><span>Low</span><span className="text-teal-600 font-bold">Normal Range</span><span>High</span></>
                      )}
                    </div>
                  </div>

                  {/* Attach Lab Report PDF/Image Document */}
                  <div className="bg-slate-50 p-3.5 border border-slate-200 rounded-lg space-y-2">
                    <span className="text-[10px] text-slate-700 font-bold uppercase tracking-wider font-mono block text-slate-800">Attach Lab Report File (PDF / Image)</span>
                    <div className="flex gap-4 items-center">
                      <label className="flex-1 flex flex-col items-center justify-center gap-1.5 border border-dashed border-slate-200 hover:border-teal-500 rounded-xl p-3 bg-slate-50 text-center cursor-pointer text-[11px] font-semibold text-slate-600 hover:text-slate-800 transition-colors">
                        <Upload className="w-4 h-4 text-teal-600 shrink-0" />
                        <span>{reportFile ? reportFile.name : 'Upload Report Document'}</span>
                        <input 
                          type="file" 
                          accept="image/*,application/pdf" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setReportFile(file);
                              const reader = new FileReader();
                              reader.onload = () => {
                                setReportFilePreviewUrl(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {reportFilePreviewUrl && (
                        <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden shrink-0 relative group">
                          <img src={reportFilePreviewUrl} alt="Report Thumbnail" className="w-full h-full object-cover" />
                          <button 
                            type="button" 
                            onClick={() => setViewingDocUrl(reportFilePreviewUrl)}
                            className="absolute inset-0 bg-slate-800/60 flex items-center justify-center text-[8px] text-slate-800 opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                          >
                            Zoom
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Live JSON terminal */}
                  <div className="border border-indigo-100 rounded-xl overflow-hidden bg-indigo-50">
                    <div className="bg-indigo-100 px-4 py-2.5 border-b border-indigo-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        </div>
                        <span className="text-[10px] text-indigo-600 font-mono font-bold ml-2 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          chemistry_analyzer_output.json
                        </span>
                      </div>
                      <span className="text-[8px] text-indigo-600 font-mono font-black tracking-widest uppercase bg-white px-2 py-0.5 rounded border border-indigo-200">LIVE</span>
                    </div>
                    <div className="py-4 text-[9px] font-mono text-indigo-700 overflow-x-auto max-h-40 leading-relaxed bg-indigo-50">
                      <pre className="m-0 bg-transparent text-left select-text">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(jsonPayload), null, 2)
                              .split('\n')
                              .map((line, i) => (
                                <div key={`json-line-${i}`} className="min-h-[1.25rem] px-5 hover:bg-indigo-100 flex">
                                  <span className="w-6 shrink-0 text-indigo-300 select-none text-[8px] text-right pr-2 border-r border-indigo-200 mr-3">{i + 1}</span>
                                  <span className="flex-1 whitespace-pre">{line}</span>
                                </div>
                              ));
                          } catch (_) {
                            return <div className="px-5 text-rose-600">Malformed JSON</div>;
                          }
                        })()}
                      </pre>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={() => setActiveReqId(null)} className="btn-secondary py-1.5 px-3 text-xs cursor-pointer">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary py-1.5 px-4 text-xs font-bold bg-gradient-to-r from-secondary to-indigo-500 hover:scale-105 active:scale-95 transition-transform cursor-pointer">
                      Publish & Verify
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-4">
                <div className="text-center py-6">
                  <ClipboardEdit className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">Select a collected sample from the queue to enter analyzer results.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: WALK-IN REGISTRATION
      ══════════════════════════════════════════════════════════ */}
      {activeTab === 'walkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Registration form */}
          <div className="lg:col-span-5 space-y-5">
            <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 opacity-60" />
              <h2 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400 shrink-0" />
                Walk-in Lab Test Registration
              </h2>
              <p className="text-[11px] text-slate-500 mb-5 leading-relaxed">
                Register a patient for lab tests without a doctor's prescription. Walk-in tests are tagged separately in the Queue.
              </p>

              <form onSubmit={handleWalkinRegister} className="space-y-4">
                {/* Patient search */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Search Patient
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search by name or phone..."
                      value={walkinSearch}
                      onChange={e => { setWalkinSearch(e.target.value); setWalkinPatientId(''); }}
                      className="w-full input-field text-xs py-2.5 pl-9 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {/* Patient list */}
                {walkinSearch.length >= 2 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {filteredPatients.length === 0 ? (
                      <div className="text-center py-3 text-xs text-slate-400">No matching patients found.</div>
                    ) : filteredPatients.map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => { setWalkinPatientId(p.id); setWalkinSearch(''); }}
                        className={`w-full text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                          walkinPatientId === p.id
                            ? 'bg-blue-500/15 border-blue-500/40 text-slate-800'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="font-bold text-xs">{p.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{p.phone} · {p.age}y {p.gender}</div>
                        {p.abhaId && <div className="text-[9px] text-blue-400 font-mono mt-0.5">ABHA: {p.abhaId}</div>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected patient badge */}
                {walkinPatientId && !walkinSearch && (
                  <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-800">
                        {patients.find(p => p.id === walkinPatientId)?.name || 'Selected Patient'}
                      </div>
                      <div className="text-[10px] text-blue-300 font-mono">
                        {patients.find(p => p.id === walkinPatientId)?.phone}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWalkinPatientId('')}
                      className="text-slate-500 hover:text-slate-800 text-[10px] cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Test selection */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Select Diagnostic Test
                  </label>
                  <div className="space-y-2">
                    {testCatalog.map(test => (
                      <label
                        key={test.loincCode}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                          walkinTestCode === test.loincCode
                            ? 'bg-indigo-50 border-indigo-300'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="walkinTest"
                            value={test.loincCode}
                            checked={walkinTestCode === test.loincCode}
                            onChange={e => setWalkinTestCode(e.target.value)}
                            className="accent-indigo-600 w-3.5 h-3.5"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-800">{test.name}</div>
                            <div className="text-[9px] text-slate-500 font-mono">
                              {test.category} · LOINC: {test.loincCode}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-indigo-600">₹{test.price}</div>
                          <div className="text-[9px] text-slate-400 font-mono">{test.unit}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Upload Request Slip / Prescription */}
                <div className="mt-2.5">
                  <label className="block text-[10px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Upload Request Slip / Prescription (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex flex-col items-center justify-center gap-1.5 border border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-3 bg-slate-50 text-center cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors">
                      <Upload className="w-5 h-5 text-blue-400 shrink-0" />
                      <span>{walkinFileUrl ? 'Re-upload / Change Slip' : 'Upload File (JPG, PNG, PDF)'}</span>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setWalkinFileUrl(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  {walkinFileUrl && (
                    <div className="flex items-center justify-between mt-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Slip Attached
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setWalkinFileUrl(null)} 
                        className="text-[10px] text-rose-500 hover:text-rose-400 cursor-pointer bg-transparent border-0"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!walkinPatientId || !walkinTestCode || walkinBusy}
                  className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
                >
                  {walkinBusy ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlusCircle className="w-4 h-4" />
                  )}
                  {walkinBusy ? 'Registering...' : 'Register Walk-in Test'}
                </button>
              </form>
            </div>

            {/* Info box */}
            <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl text-[11px] text-blue-300 leading-relaxed">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <span>
                Walk-in tests are auto-tagged with a <strong className="font-mono">WALK-</strong> barcode prefix and appear immediately in the test queue. No encounter ID is required — billing is handled separately at the counter.
              </span>
            </div>
          </div>

          {/* Walk-in history */}
          <div className="lg:col-span-7">
            <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 opacity-50" />
              <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-400 shrink-0" />
                Walk-in Test History ({walkinList.length})
              </h2>
              {walkinList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm space-y-2">
                  <UserPlus className="w-8 h-8 text-slate-300 mx-auto block" />
                  No walk-in tests registered yet today.
                </div>
              ) : (
                <div className="space-y-3">
                  {walkinList.map(req => {
                    const invoices = api.getUnifiedInvoices();
                    const inv = invoices.find(i => i.encounterId === req.id);
                    const isPaid = inv && inv.paymentStatus === 'cleared';
                    const test = testCatalog.find(t => t.loincCode === req.testCode) || { price: 350 };
                    const testPrice = test.price || 350;

                    return (
                      <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            req.status === 'completed' ? 'bg-emerald-400' :
                            req.status === 'collected' || req.status === 'processed' ? 'bg-indigo-600 animate-pulse' :
                            'bg-amber-400 animate-pulse'
                          }`} />
                          <div>
                            <div className="text-xs font-bold text-slate-800">{req.patientName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{req.testName} · {req.testCode}</div>
                            <div className="text-[9px] text-blue-400 font-mono mt-0.5">Barcode: {req.barcode}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 justify-end">
                          {/* Invoice Billing Options */}
                          {isPaid ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                                PAID ✅ (₹{inv.totalAmount})
                              </span>
                              <button
                                onClick={() => {
                                  // Open lab receipt print window
                                  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Lab Bill Receipt</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#1a1a2e; }
  .page { max-width:600px; margin:0 auto; padding:20px 28px; }
  .header { border-bottom:2px solid #4f46e5; padding-bottom:12px; margin-bottom:14px; display:flex; justify-content:space-between; }
  .clinic { font-size:16px; font-weight:800; color:#4f46e5; }
  .sub { font-size:10px; color:#6b7280; }
  .badge { background:#e0e7ff; color:#3730a3; font-size:9px; font-weight:800; padding:2px 8px; border-radius:99px; border:1px solid #c7d2fe; }
  .section-title { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#4f46e5; border-bottom:1px solid #e5e7eb; padding-bottom:3px; margin:12px 0 8px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
  .field label { font-size:9px; font-weight:700; color:#9ca3af; text-transform:uppercase; }
  .field span { font-size:12px; font-weight:600; color:#111827; display:block; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#f5f3ff; text-align:left; padding:5px 8px; font-size:9px; font-weight:800; text-transform:uppercase; color:#6b7280; }
  td { padding:5px 8px; border-bottom:1px solid #f3f4f6; }
  .total { font-weight:900; font-size:14px; color:#4f46e5; text-align:right; margin-top:10px; }
  .footer { margin-top:24px; font-size:9px; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; padding-top:8px; }
  @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
</style></head>
<body><div class="page">
  <div class="header">
    <div><div class="clinic">${activePod?.name ? `${activePod.name} Diagnostics` : (activeEntity?.name || 'Clinical Diagnostics Lab')}</div><div class="sub">Walk-in Laboratory Bill Receipt</div></div>
    <div style="text-align:right">
      <div class="badge">PAID ✅</div>
      <div class="sub" style="margin-top:4px">Date: ${new Date(inv.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
      <div class="sub">Invoice: ${(inv.id || 'N/A').substring(0,8)}...</div>
    </div>
  </div>
  <div class="section-title">Patient Details</div>
  <div class="grid">
    <div class="field"><label>Name</label><span>${req.patientName}</span></div>
    <div class="field"><label>Barcode</label><span>${req.barcode}</span></div>
    <div class="field"><label>Amount Paid</label><span style="color:#4f46e5">₹${inv.totalAmount}</span></div>
  </div>
  <div class="section-title">Subscribed Lab Tests</div>
  <table><thead><tr><th>#</th><th>Test Name</th><th>LOINC Code</th><th>Price</th></tr></thead>
  <tbody><tr><td>1</td><td><b>${req.testName}</b></td><td>${req.testCode}</td><td>₹${inv.labFee}</td></tr></tbody></table>
  <div class="total">Total Paid (incl. platform commission): ₹${inv.totalAmount}</div>
  <div class="footer">Diagnostics bill cleared at counter. Test results will sync to physician console. VitalSync Pod network &copy; ${new Date().getFullYear()}</div>
</div><script>window.onload=function(){window.print()}<\/script></body></html>`;
                                  const win = window.open('','_blank','width=720,height=800');
                                  if (win) { win.document.write(html); win.document.close(); }
                                }}
                                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-350 text-slate-800 text-[9px] font-black rounded-lg cursor-pointer flex items-center gap-1 border-0"
                              >
                                <Printer className="w-3 h-3" />
                                Receipt
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black text-rose-500 font-mono">UNPAID (₹{testPrice}) ⚠️</span>
                              <button
                                onClick={() => handleBillWalkinTest(req.id, 'cash')}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 active:scale-95 text-slate-800 text-[9px] font-black rounded-lg cursor-pointer border-0"
                              >
                                Collect Cash
                              </button>
                              <button
                                onClick={() => handleBillWalkinTest(req.id, 'upi')}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[9px] font-black rounded-lg cursor-pointer border-0"
                              >
                                UPI QR
                              </button>
                            </div>
                          )}
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono border ${
                            req.status === 'completed'
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : req.status === 'collected'
                              ? 'text-indigo-600 bg-indigo-50 border-indigo-200'
                              : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                          }`}>
                            {req.status}
                          </span>
                          <div className="text-[9px] text-slate-400 font-mono">
                            {new Date(req.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: DIRECT REPORT UPLOAD
      ══════════════════════════════════════════════════════════ */}
      {activeTab === 'upload_report' && (
        <form onSubmit={handleDirectReportUploadSubmit} className="space-y-6">
          {/* Post-Submission Success Card if recently submitted */}
          {lastDirectSubmission && (
            <div className="glass-panel p-5 border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Report Published &amp; Synced! 🚀</span>
                    <span className="text-[10px] text-slate-500 font-mono">({lastDirectSubmission.time})</span>
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">
                    {lastDirectSubmission.patientName} · {lastDirectSubmission.testName} (LOINC: {lastDirectSubmission.loincCode})
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Official PDF &amp; 2-Touchpoint Care Loop Dispatched to +91 {lastDirectSubmission.patientPhone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
                {lastDirectSubmission.pdfBlobUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      if (lastDirectSubmission.pdfBlobUrl) {
                        window.open(lastDirectSubmission.pdfBlobUrl, '_blank');
                      }
                    }}
                    className="flex-1 md:flex-initial py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer border-0"
                  >
                    <FileText className="w-4 h-4" />
                    <span>📄 Open / Print PDF</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setLastDirectSubmission(null);
                    setDirectPatientId('');
                    setDirectSearch('');
                  }}
                  className="flex-1 md:flex-initial py-2.5 px-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0"
                >
                  <PlusCircle className="w-4 h-4 text-indigo-500" />
                  <span>Next Patient</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Patient Queue Selector & Diagnostic Test */}
            <div className="lg:col-span-6 space-y-6">
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-600 to-teal-500 opacity-60" />
                
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    1. Select Patient from Today's Queue (आज के मरीज़)
                  </h2>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold font-mono">
                    {directFilteredQueuePatients.length} Active
                  </span>
                </div>
                
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                  Select the patient who completed consultation or has ordered lab tests for today. Mediflow will automatically sync the report across Doctor EMR and Compounder Desk.
                </p>

                {/* Queue Filter Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mb-3 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setDirectQueueFilterTab('prescribed_lab')}
                    className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer border-0 ${
                      directQueueFilterTab === 'prescribed_lab'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    🧪 Prescribed Lab ({todayQueuePatients.filter(p => p.isPrescribedLab || p.requisitions.length > 0).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectQueueFilterTab('today_consultations')}
                    className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer border-0 ${
                      directQueueFilterTab === 'today_consultations'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    👨‍⚕️ Consultations ({todayQueuePatients.filter(p => !!p.appointment).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectQueueFilterTab('all')}
                    className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer border-0 ${
                      directQueueFilterTab === 'all'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    🔍 All ({patients.length})
                  </button>
                </div>

                {/* Patient Search Input */}
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter by name, phone, or token (#TK-001)..."
                    value={directSearch}
                    onChange={e => setDirectSearch(e.target.value)}
                    className="w-full input-field text-xs py-2 pl-9 pr-8 focus:ring-1 focus:ring-indigo-400"
                  />
                  {directSearch && (
                    <button
                      type="button"
                      onClick={() => setDirectSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer border-0 bg-transparent"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Selected Patient Confirmation Banner */}
                {directPatientId && (
                  <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                        ✓
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span>{patients.find(p => p.id === directPatientId)?.name || 'Selected Patient'}</span>
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-mono font-bold">Selected</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          +91 {patients.find(p => p.id === directPatientId)?.phone} · {patients.find(p => p.id === directPatientId)?.age}y ({patients.find(p => p.id === directPatientId)?.gender})
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDirectPatientId('')}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer border-0 bg-transparent"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Scrollable Patient Queue List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 mb-5">
                  {directFilteredQueuePatients.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                      No matching patients in this view. Try switching to "All" or searching.
                    </div>
                  ) : (
                    directFilteredQueuePatients.map(item => {
                      const isSelected = directPatientId === item.patient.id;
                      const reqTest = item.requisitions[0];

                      return (
                        <div
                          key={`queue-${item.patient.id}`}
                          onClick={() => {
                            setDirectPatientId(item.patient.id);
                            if (reqTest && reqTest.testCode) {
                              setDirectTestCode(reqTest.testCode);
                            }
                          }}
                          className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 ring-2 ring-indigo-500/20 text-slate-800 dark:text-white shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-indigo-300 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-black shrink-0 font-mono">
                              {String(item.tokenNumber || '#TK').slice(-3)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs flex items-center gap-1.5 truncate">
                                <span>{item.patient.name}</span>
                                {item.source === 'whatsapp' && (
                                  <span className="text-[8px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1 py-0.2 rounded font-bold">🟢 WA</span>
                                )}
                                {item.source === 'qr' && (
                                  <span className="text-[8px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1 py-0.2 rounded font-bold">📲 QR</span>
                                )}
                                {item.source === 'emergency' && (
                                  <span className="text-[8px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-1 py-0.2 rounded font-bold">🚨 SOS</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">
                                +91 {item.patient.phone} · {item.patient.age}y {item.patient.gender}
                              </div>
                              {reqTest && (
                                <div className="text-[9px] text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1 mt-0.5 truncate font-mono">
                                  <FlaskConical className="w-2.5 h-2.5 shrink-0" />
                                  <span>Prescribed: {reqTest.testName}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}>
                              {isSelected ? 'Selected ✓' : 'Select'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Test Selection */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                    Select Diagnostic Test (जांच चुनें)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {testCatalog.map(test => (
                      <label
                        key={test.loincCode}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                          directTestCode === test.loincCode
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="radio"
                            name="directTest"
                            value={test.loincCode}
                            checked={directTestCode === test.loincCode}
                            onChange={e => setDirectTestCode(e.target.value)}
                            className="accent-indigo-600 w-3.5 h-3.5 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{test.name}</div>
                            <div className="text-[9px] text-slate-500 font-mono">
                              LOINC: {test.loincCode}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">₹{test.price}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Biomarker Entry Form & File Dropzone & Submit Action */}
            <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex-1">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 to-indigo-500 opacity-60" />
                
                <h3 className="font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2 text-sm">
                  <ClipboardEdit className="w-4 h-4 text-teal-600 shrink-0" />
                  2. Upload Report File &amp; Review Biomarkers
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                  Attach an analyzer slip/PDF or type biomarker numbers. An official signed LOINC PDF will be created and delivered to WhatsApp instantly.
                </p>

                {/* File Dropzone & Camera */}
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <label
                      className={`flex-1 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                        directFile
                          ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50 dark:bg-slate-800/40'
                      }`}
                    >
                      <Upload className="w-5 h-5 text-indigo-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {directFile ? directFile.name : 'Click to Upload Report File (PDF / JPG / PNG)'}
                      </span>
                      <span className="text-[10px] text-slate-400">Drag &amp; drop physical analyzer slip or generated PDF</span>
                      <input 
                        ref={directFileInputRef}
                        type="file" 
                        accept="image/*,application/pdf" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setDirectFile(file);
                            const reader = new FileReader();
                            reader.onload = () => {
                              setDirectFilePreviewUrl(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => directCameraInputRef.current?.click()}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all shadow-sm"
                      title="Snap photo with camera"
                    >
                      <Camera className="w-5 h-5 text-indigo-600" />
                      <span className="text-[9px] font-bold">Camera</span>
                      <input
                        ref={directCameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setDirectFile(file);
                            const reader = new FileReader();
                            reader.onload = () => {
                              setDirectFilePreviewUrl(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </button>
                  </div>

                  {/* Loaded File Actions & AI Vision Auto-Fill */}
                  {directFile && (
                    <div className="flex flex-wrap items-center justify-between mt-2.5 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl gap-2">
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="truncate">{directFile.name} ({(directFile.size / 1024).toFixed(1)} KB)</span>
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isAiScanningReport}
                          onClick={() => handleAutoExtractLabReport(directFile)}
                          className="py-1 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer border-0 shadow-sm disabled:opacity-50"
                        >
                          {isAiScanningReport ? (
                            <RefreshCw className="w-3 h-3 animate-spin text-white" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-amber-300" />
                          )}
                          <span>{isAiScanningReport ? 'Reading...' : '✨ Auto-Read Biomarkers'}</span>
                        </button>

                        <button 
                          type="button" 
                          onClick={() => { setDirectFile(null); setDirectFilePreviewUrl(''); }} 
                          className="text-[10px] text-rose-500 hover:text-rose-400 cursor-pointer bg-transparent border-0 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Biomarker Form Inputs */}
                <div className="space-y-3.5">
                  {directTestCode === '4544-3' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                          HbA1c (%)
                        </label>
                        <input
                          type="number"
                          required
                          step="0.1"
                          min="3"
                          max="20"
                          value={hba1cVal}
                          onChange={e => handleHba1cChange(e.target.value)}
                          className="w-full input-field text-sm font-bold focus:ring-1 focus:ring-teal-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                          eAG (mg/dL)
                        </label>
                        <input
                          type="number"
                          required
                          value={eagVal}
                          onChange={e => setEagVal(e.target.value)}
                          className="w-full input-field text-sm font-bold focus:ring-1 focus:ring-teal-400"
                        />
                        <span className="text-[8px] text-slate-400 font-mono mt-0.5 block">Auto: eAG = 28.7 × HbA1c − 46.7</span>
                      </div>
                    </div>
                  ) : directTestCode === '2160-0' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                          Serum Creatinine (mg/dL)
                        </label>
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="0.1"
                          max="15"
                          value={creatinineVal}
                          onChange={e => setCreatinineVal(e.target.value)}
                          className="w-full input-field text-sm font-bold focus:ring-1 focus:ring-teal-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                          eGFR (mL/min/1.73m²)
                        </label>
                        <input
                          type="number"
                          required
                          value={egfrVal}
                          onChange={e => setEgfrVal(e.target.value)}
                          className="w-full input-field text-sm font-bold focus:ring-1 focus:ring-teal-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                          BUN (mg/dL)
                        </label>
                        <input
                          type="number"
                          required
                          value={bunVal}
                          onChange={e => setBunVal(e.target.value)}
                          className="w-full input-field text-sm font-bold focus:ring-1 focus:ring-teal-400"
                        />
                      </div>
                    </div>
                  ) : directTestCode === '3024-7' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                          Hemoglobin (g/dL)
                        </label>
                        <input
                          type="number"
                          required
                          step="0.1"
                          min="2"
                          max="25"
                          value={hbVal}
                          onChange={e => handleHbChange(e.target.value)}
                          className="w-full input-field text-sm font-bold focus:ring-1 focus:ring-teal-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                          Hematocrit (%)
                        </label>
                        <input
                          type="number"
                          required
                          value={hctVal}
                          onChange={e => setHctVal(e.target.value)}
                          className="w-full input-field text-sm font-bold focus:ring-1 focus:ring-teal-400"
                        />
                        <span className="text-[8px] text-slate-400 font-mono mt-0.5 block">Auto: Hct ≈ Hb × 3</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                          Result Value
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., 98.4"
                          value={genericVal}
                          onChange={e => setGenericVal(e.target.value)}
                          className="w-full input-field text-sm font-bold focus:ring-1 focus:ring-teal-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                          Unit
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., mg/dL"
                          value={genericUnit}
                          onChange={e => setGenericUnit(e.target.value)}
                          className="w-full input-field text-sm font-bold focus:ring-1 focus:ring-teal-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* LOINC Reference Range graphic */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                      LOINC Clinical Reference Band
                    </span>
                    <div className="h-[3px] w-full bg-slate-200 dark:bg-slate-700 relative rounded-full overflow-hidden">
                      <div className="absolute left-[25%] right-[25%] h-full bg-teal-500" />
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                      {directTestCode === '4544-3' ? (
                        <><span>{'< 5.7% Normal'}</span><span className="text-teal-600 font-bold">5.7–6.4% Pre-diab</span><span>≥ 6.5% Diabetic</span></>
                      ) : directTestCode === '2160-0' ? (
                        <><span>{'< 0.6 mg/dL'}</span><span className="text-teal-600 font-bold">0.6–1.2 mg/dL</span><span>{'> 1.2 mg/dL'}</span></>
                      ) : directTestCode === '3024-7' ? (
                        <><span>{'< 12.0 g/dL'}</span><span className="text-teal-600 font-bold">12.0–16.0 g/dL</span><span>{'> 16.0 g/dL'}</span></>
                      ) : (
                        <><span>Low</span><span className="text-teal-600 font-bold">Normal Range</span><span>High</span></>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-5">
                  <button
                    type="submit"
                    disabled={!directPatientId || !directTestCode || directBusy}
                    className="w-full py-3.5 px-6 text-xs sm:text-sm font-black flex items-center justify-center gap-2 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-95 transition-all bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-500 shadow-xl text-white cursor-pointer border-0 text-white-force"
                  >
                    {directBusy ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white-force" />
                    ) : (
                      <CloudUpload className="w-4 h-4 text-white-force" />
                    )}
                    <span>{directBusy ? 'Publishing Report & Dispatching PDF...' : '🚀 Submit Report to Database & WhatsApp (रिपोर्ट सुरक्षित करें व भेजें)'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: ANALYTICS
      ══════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Tests Processed', value: totalTests, icon: <BarChart3 className="w-5 h-5 text-indigo-600" />, color: 'primary' },
              { label: "Today's Tests", value: todayCompleted.length, icon: <Calendar className="w-5 h-5 text-emerald-500" />, color: 'emerald' },
              { label: "Today's Revenue", value: `₹${todayRevenue.toLocaleString('en-IN')}`, icon: <Coins className="w-5 h-5 text-amber-500" />, color: 'amber' },
              { label: 'Walk-in Tests', value: walkinList.length, icon: <UserPlus className="w-5 h-5 text-blue-500" />, color: 'blue' }
            ].map(card => (
              <div key={card.label} className="glass-panel p-5 border-slate-200/60 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-[2px] ${
                  card.color === 'primary' ? 'bg-indigo-600' :
                  card.color === 'emerald' ? 'bg-emerald-500' :
                  card.color === 'amber' ? 'bg-amber-500' : 'bg-blue-500'
                } opacity-60`} />
                <div className="mb-2">{card.icon}</div>
                <div className="text-2xl font-bold text-slate-800 mt-2 font-mono">{card.value}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1">{card.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Test frequency breakdown */}
            <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-600 to-teal-500 opacity-50" />
              <h2 className="text-sm font-semibold text-slate-800 mb-5 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-600 shrink-0" />
                Test Frequency Breakdown
              </h2>
              {testBreakdown.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No completed tests to analyze yet.</div>
              ) : (
                <div className="space-y-3">
                  {testBreakdown.map(([name, count]) => {
                    const pct = Math.round((count / totalTests) * 100);
                    return (
                      <div key={name}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-700 font-semibold truncate max-w-[200px]">{name}</span>
                          <span className="text-slate-500 font-mono font-bold ml-2">{count} tests ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-600 to-teal-500 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* LOINC catalog pricing reference */}
            <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-secondary to-indigo-500 opacity-50" />
              <h2 className="text-sm font-semibold text-slate-800 mb-5 flex items-center gap-2">
                <Microscope className="w-4 h-4 text-teal-600 shrink-0" />
                LOINC Test Catalog & Pricing
              </h2>
              <div className="space-y-2">
                {testCatalog.map(test => (
                  <div key={test.loincCode} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <div className="text-xs font-bold text-slate-800">{test.name}</div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        LOINC: {test.loincCode} · {test.category} · Range: {test.normalRange} {test.unit}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-indigo-600 font-mono ml-3 shrink-0">₹{test.price}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chemical deduction audit log */}
          <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-rose-500 to-amber-500 opacity-40" />
            <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-500 shrink-0" />
              Chemical Reagent Deduction Audit Log
            </h2>
            {completedList.flatMap(r => r.reagentDeductions || []).length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">No reagent deductions logged yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Test</th>
                      <th className="p-3">Patient</th>
                      <th className="p-3">Reagent</th>
                      <th className="p-3 text-right">Deducted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40">
                    {completedList.flatMap(req =>
                      (req.reagentDeductions || []).map((ded, i) => (
                        <tr key={`${req.id}-${i}`} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-slate-800">{req.testName}</td>
                          <td className="p-3 text-slate-600">{req.patientName}</td>
                          <td className="p-3 text-amber-600 font-mono">{ded.reagentName}</td>
                          <td className="p-3 text-right text-rose-400 font-bold font-mono">−{ded.volumeDeducted}{ded.unit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}



      {/* TAB: SETTLEMENTS */}
      {activeTab === 'settlements' && (
        <div className="space-y-6">
          <SettlementWidget 
            entityId={activeEntity?.id || ''}
            podId={activeEntity?.podId || ''}
            entityType="lab"
            displayName="Pathology Lab Settlements"
            theme="dark"
          />
          
          {/* Split rules display */}
          <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              Active SOP Split Configuration
            </h3>
            <p className="text-xs text-slate-500">
              These percentages represent your shared payouts calculated dynamically on invoice clearance.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-white border border-slate-200 rounded-xl text-center">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Your Split</p>
                <p className="text-xl font-extrabold text-slate-800 mt-1">Lab Split</p>
                <p className="text-xs text-slate-400 mt-0.5 font-semibold">Calculated per test catalog price</p>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-xl text-center">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Doctor Split</p>
                <p className="text-xl font-extrabold text-slate-800 mt-1">Managed by SOP</p>
                <p className="text-xs text-slate-400 mt-0.5 font-semibold">Based on active agreements</p>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-xl text-center">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Platform Fee</p>
                <p className="text-xl font-extrabold text-slate-800 mt-1">3%</p>
                <p className="text-xs text-slate-400 mt-0.5 font-semibold">Platform service charge</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: BILLING & INVOICES */}
      {activeTab === 'billing_invoices' && (
        <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden text-left">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400 shrink-0" />
                Lab Billing & Invoices
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Generate itemized pathology invoices from doctor-prescribed test requisitions, process walk-in bills, and print/send invoices.
              </p>
            </div>
          </div>

          {(() => {
            const labTestBills = api.getLabTestBills();
            const activeRequisitions = requisitions.filter(r => {
              if (r.status !== 'pending') return false;
              // Check if paid via unified invoice
              const inv = invoices.find(i => i.encounterId === r.encounterId);
              if (inv && inv.paymentStatus === 'cleared') return false;
              // Check if already linked to any active lab test bill (draft, confirmed, or paid)
              const hasBill = labTestBills.some(b => b.status !== 'cancelled' && b.items.some(item => item.requisitionId === r.id));
              if (hasBill) return false;
              return true;
            });
            const patientsList = api.getPatients();

            // Group requisitions by patientId
            const reqsByPatient: Record<string, typeof activeRequisitions> = {};
            activeRequisitions.forEach(r => {
              if (!reqsByPatient[r.patientId]) reqsByPatient[r.patientId] = [];
              reqsByPatient[r.patientId].push(r);
            });

            const pendingBills = labTestBills.filter(b => b.status === 'draft' || b.status === 'confirmed');
            const paidBills = labTestBills.filter(b => b.status === 'paid');

            return (
              <div className="space-y-8">
                {/* 1. Pending Requisitions Awaiting Billing */}
                <div>
                  <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Doctor Requisitions Awaiting Billing ({Object.keys(reqsByPatient).length} patients)
                  </h3>
                  {Object.keys(reqsByPatient).length === 0 ? (
                    <InlineEmptyState
                      icon="receipt_long"
                      label="No Pending Requisitions"
                      sublabel="All doctor-ordered test requisitions have been billed."
                      variant="success"
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(reqsByPatient).map(([patientId, patientReqs]) => {
                        const patient = patientsList.find(p => p.id === patientId);
                        if (!patient) return null;
                        const totalAmt = patientReqs.reduce((sum, r) => {
                          const test = testCatalog.find(t => t.loincCode === r.testCode);
                          return sum + (test?.price || 350);
                        }, 0);

                        return (
                          <div key={patientId} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-slate-800 text-xs">{patient.name}</h4>
                                <p className="text-[10px] text-slate-500 font-mono">+91 {patient.phone}</p>
                              </div>
                              <span className="text-xs font-black text-amber-600">₹{totalAmt.toFixed(0)}</span>
                            </div>
                            <div className="space-y-1">
                              {patientReqs.map(r => {
                                const test = testCatalog.find(t => t.loincCode === r.testCode);
                                return (
                                  <div key={r.id} className="flex justify-between text-[10px] text-slate-600 font-mono">
                                    <span>🧪 {r.testName}</span>
                                    <span>₹{test?.price || '350'}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => {
                                const billItems = patientReqs.map(r => {
                                  const test = testCatalog.find(t => t.loincCode === r.testCode);
                                  const price = test?.price || 350;
                                  return {
                                    requisitionId: r.id,
                                    loincCode: r.testCode,
                                    testName: r.testName,
                                    price,
                                    discountPercent: 0,
                                    gstPercent: 0,
                                    lineTotal: price
                                  };
                                });
                                const subtotal = billItems.reduce((s, i) => s + i.price, 0);
                                const bill = {
                                  id: crypto.randomUUID(),
                                  patientId: patient.id,
                                  patientName: patient.name,
                                  patientPhone: patient.phone,
                                  encounterId: patientReqs[0]?.encounterId,
                                  items: billItems,
                                  subtotal,
                                  discountAmount: 0,
                                  gstAmount: 0,
                                  totalAmount: subtotal,
                                  paymentMode: 'cash' as const,
                                  status: 'draft' as const,
                                  source: 'encounter' as const,
                                  createdAt: new Date().toISOString()
                                };
                                api.saveLabTestBill(bill);
                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: { message: `Lab test bill generated for ${patient.name}!`, type: 'success', title: 'Lab Bill Created' }
                                }));
                              }}
                              className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-all border-0"
                            >
                              Generate Lab Invoice
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Pending Invoices (Awaiting Payment Collection) */}
                <div>
                  <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-505" />
                    Pending Payments ({pendingBills.length})
                  </h3>
                  {pendingBills.length === 0 ? (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                      No pending bills.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pendingBills.map(bill => (
                        <div key={bill.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 relative">
                          <div className="absolute top-0 right-0 bg-amber-500 text-slate-800 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl">
                            {(bill.status || '').toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs">{bill.patientName}</h4>
                            <p className="text-[10px] text-slate-500 font-mono">Invoice #{(bill.id || 'N/A').substring(0, 8)} • {(bill.items || []).length} tests</p>
                          </div>
                          <div className="text-xs font-black text-slate-800">Total: ₹{(bill.totalAmount || 0).toFixed(2)}</div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                api.payLabTestBill(bill.id, 'cash');
                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: { message: `Collected ₹${(bill.totalAmount || 0).toFixed(0)} cash! Invoice marked paid.`, type: 'success', title: 'Payment Collected' }
                                }));
                              }}
                              className="flex-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-850 font-black rounded-lg uppercase tracking-wider text-[9px] cursor-pointer border-0"
                            >
                              Cash
                            </button>
                            <button
                              onClick={() => {
                                api.payLabTestBill(bill.id, 'upi');
                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: { message: `Collected ₹${(bill.totalAmount || 0).toFixed(0)} via UPI! Invoice marked paid.`, type: 'success', title: 'Payment Collected' }
                                }));
                              }}
                              className="flex-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg uppercase tracking-wider text-[9px] cursor-pointer border-0"
                            >
                              UPI / QR
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Paid Invoices (Receipts & WhatsApp) */}
                <div>
                  <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Paid Invoices ({paidBills.length})
                  </h3>
                  {paidBills.length === 0 ? (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                      No paid invoices yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {paidBills.map(bill => (
                        <div key={bill.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 relative">
                          <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl">
                            PAID
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs">{bill.patientName || 'Patient'}</h4>
                            <p className="text-[10px] text-slate-500 font-mono">Invoice #{(bill.id || 'N/A').substring(0, 8)} • {(bill.items || []).length} tests</p>
                          </div>
                          <div className="text-xs font-black text-emerald-600">Total: ₹{(bill.totalAmount || 0).toFixed(2)}</div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const url = URL.createObjectURL(new Blob([`Lab Invoice #${bill.id || 'N/A'}\nPatient: ${bill.patientName || 'Patient'}\nTotal: ₹${(bill.totalAmount || 0).toFixed(2)}`], { type: 'text/plain' }));
                                window.open(url, '_blank');
                                setTimeout(() => URL.revokeObjectURL(url), 1500);
                              }}
                              className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-bold rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1 border-0"
                            >
                              <Printer className="w-3 h-3" /> Print
                            </button>
                            <button
                              onClick={() => {
                                api.sendLabInvoiceToPatient(bill);
                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: { message: `Invoice sent to ${bill.patientName} on WhatsApp!`, type: 'success', title: 'Invoice Sent' }
                                }));
                              }}
                              className="flex-1 px-2 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-[9px] font-bold rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1 border-0"
                            >
                              <Send className="w-3 h-3" /> WhatsApp
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB: POD NETWORK */}
      {activeTab === 'pod_network' && (
        <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-6">
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Network className="w-4 h-4 text-indigo-400 shrink-0" />
                Pod Network HUB
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Connected clinical clinic node and ecosystem partner network details.
              </p>
            </div>
            <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${
              activeEntity?.status === 'approved' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              {activeEntity?.status || 'Pending Connection'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest font-mono">
                🏥 Primary Clinic Connection
              </h3>
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <p className="text-xs font-bold text-slate-800">{activePod?.name || 'Primary Clinical Network'}</p>
                <div className="text-[10px] text-slate-500 space-y-1">
                  <div>Clinic Code: <span className="font-mono font-bold text-slate-800 bg-slate-800/40 px-1.5 py-0.5 rounded">{activePod?.clinicCode || 'N/A'}</span></div>
                  <div>Location: {activePod?.location || 'Clinic Hub'}</div>
                  <div>Established: {activePod?.createdAt ? new Date(activePod.createdAt).toLocaleDateString() : 'N/A'}</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest font-mono">
                👥 Node Partner Network
              </h3>
              <div className="space-y-2">
                {podEntities.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No partners found in this Pod.</p>
                ) : (
                  podEntities.map(pe => (
                    <div key={pe.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${pe.entityType === 'clinic' ? 'bg-indigo-400' : pe.entityType === 'lab' ? 'bg-teal-400' : 'bg-amber-400'}`} />
                        <div>
                          <p className="font-bold text-slate-800">{pe.name}</p>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">{pe.entityType}</p>
                        </div>
                      </div>
                      <span className={`text-[8px] font-bold font-mono px-2 py-0.5 rounded border ${
                        pe.status === 'approved' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      }`}>
                        {pe.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SPECIMEN LABEL PRINT MODAL ──────────────────────────── */}
      {printLabelReq && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-800/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 border-indigo-200 shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-600" />
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600 shrink-0" />
                Specimen Label Printer
              </h3>
              <button onClick={() => setPrintLabelReq(null)} className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div id="specimen-label-print-area" className="p-4 bg-white text-black rounded-lg border-2 border-dashed border-black/30 font-sans shadow-inner space-y-4">
              <div className="flex justify-between items-center border-b border-black/20 pb-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider">{activePod?.name ? `${activePod.name} Labs` : (activeEntity?.name || 'Clinical Diagnostics Lab')}</div>
                <div className="text-[8px] bg-slate-800 text-slate-800 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide">Specimen Card</div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                {[
                  ['Patient Name', printLabelReq.patientName],
                  ['ABHA ID', api.getPatients().find(p => p.id === printLabelReq.patientId)?.abhaId || '—'],
                  ['Biomarker Test', printLabelReq.testName],
                  ['LOINC Reference', printLabelReq.testCode],
                  ['Pathologist', 'Lalit Prasad (Tech-ID)'],
                  ['Drawn At', new Date(printLabelReq.createdAt).toLocaleString()]
                ].map(([label, val]) => (
                  <div key={label}>
                    <span className="text-[8px] text-black/50 block font-bold uppercase">{label}</span>
                    <strong className="text-black font-extrabold">{val}</strong>
                  </div>
                ))}
              </div>
              <div className="border-t border-black/20 pt-3 text-center space-y-1.5">
                <div className="bg-slate-800 p-2 rounded flex justify-center">
                  <svg viewBox="0 0 100 30" className="w-full h-10" preserveAspectRatio="none">
                    {[5,9,12,17,21,27,30,34,39,42,48,52,57,60,64,70,73,78,82,88,91].map((x, i) => (
                      <rect key={`barcode-bar-${i}-${x}`} x={x} y="2" width={i % 4 === 0 ? 3 : i % 3 === 0 ? 4 : i % 2 === 0 ? 2 : 1} height="26" fill="#ffffff" />
                    ))}
                  </svg>
                </div>
                <div className="text-[10px] font-mono tracking-widest font-extrabold text-black">*{printLabelReq.barcode}*</div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPrintLabelReq(null)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 font-semibold hover:bg-white-high cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const content = document.getElementById('specimen-label-print-area')?.innerHTML;
                  if (content) {
                    const pw = window.open('', '', 'height=500,width=500');
                    if (pw) {
                      pw.document.write('<html><head><title>Specimen Label</title>');
                      pw.document.write('<style>body{font-family:sans-serif;padding:20px;color:black;background:white;} #specimen-label-print-area{width:350px;border:2px dashed black;padding:15px;margin:auto;}</style>');
                      pw.document.write('</head><body><div id="specimen-label-print-area">');
                      pw.document.write(content);
                      pw.document.write('</div></body></html>');
                      pw.document.close();
                      pw.focus();
                      setTimeout(() => { pw.print(); pw.close(); }, 500);
                    }
                  }
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-black bg-teal-600 hover:bg-teal-600/80 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Label
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── PROCESSING OVERLAY ──────────────────────────────────── */}
      {isProcessing && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-800/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-panel max-w-sm w-full p-8 border-indigo-200 shadow-2xl text-center space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-600 to-teal-500 animate-pulse" />
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10 border-t-primary animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-teal-200 border-b-secondary animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
              <div className="absolute inset-4 rounded-full bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 animate-pulse shadow-sm">
                <FlaskConical className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-slate-800 font-bold text-base">Pathology Analyzer Active</h3>
              <p className="text-xs text-slate-500 font-mono animate-pulse tracking-wide uppercase">
                CALIBRATING LOINC-{activeReq?.testCode || 'SPECIMEN'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 font-mono text-[9px] text-indigo-600 text-left space-y-1 max-h-24 overflow-y-auto">
              <div>&gt; Specimen Barcode verified: {activeReq?.barcode}</div>
              <div>&gt; Injecting chemical reagent...</div>
              <div>&gt; Reading optical absorption values...</div>
              <div className="animate-pulse">&gt; Compiling biomarker quantitative report...</div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {viewingDocUrl && createPortal(
        <div className="fixed inset-0 bg-slate-800/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200/60 rounded-2xl max-w-2xl w-full p-6 space-y-4 relative shadow-2xl overflow-hidden font-sans">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-600 to-teal-500" />
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600 shrink-0" />
                Prescription / Request Slip Viewer
              </h3>
              <button
                onClick={() => setViewingDocUrl(null)}
                className="p-1.5 text-slate-600 hover:text-slate-800 bg-white/5 hover:bg-slate-200 border-0 rounded-lg cursor-pointer transition active:scale-95 flex items-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-slate-800/40 rounded-xl border border-white/5 overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh] p-2">
              {viewingDocUrl.startsWith('data:application/pdf') ? (
                <iframe src={viewingDocUrl} className="w-full h-[500px] border-0 rounded-lg" title="PDF Document Viewer" />
              ) : (
                <img src={viewingDocUrl} className="max-w-full max-h-[500px] object-contain rounded-lg shadow-md" alt="Request Slip Preview" />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setViewingDocUrl(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-600/85 text-slate-800 font-bold rounded-xl text-xs cursor-pointer border-0 active:scale-95 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Desktop Enterprise Status Footer */}
      <div className="hidden md:flex items-center justify-between pt-4 mt-6 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Mediflow Realtime Engine · Pathology & Diagnostic Lab Node</span>
        </div>
        <div className="flex items-center gap-4">
          <span>AI Longitudinal Report Analysis</span>
          <span>·</span>
          <span>WhatsApp PDF Auto-Dispatch</span>
          <span>·</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">RLS Encrypted · Pathology</span>
        </div>
      </div>


    </div>
  );
};

