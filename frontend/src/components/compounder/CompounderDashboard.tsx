import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api, MASTER_TEST_CATALOG } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeSyncService } from '../../services/realtimeSyncService';
import { useSpecialization } from '../../context/SpecializationContext';
import { useClinic } from '../../context/ClinicContext';
import { VISUAL_ACUITY_OPTIONS } from '../../types/ophthalmic';
import { EncounterService } from '../../services/encounterService';
import { PharmacyService } from '../../services/pharmacyService';
import { BillingService } from '../../services/billingService';
import { PaymentService } from '../../services/paymentService';
import { LabService } from '../../services/labService';
import { load } from '../../services/apiHelper';
import { getPodContext } from '../../services/podContext';
import { ZeroQueueState, InlineEmptyState } from '../shared/EmptyState';
import { getIstDateString, getEffectiveAppointmentDate, getIstOffsetDateString } from '../../utils/dateUtils';
import type {
  PharmacyInventoryItem,
  MedicineBill,
  MedicineBillItem,
  ChatMessage,
  Invoice,
  Prescription,
  Patient,
  PatientVitals,
  WhatsAppSession,
  ClinicStaff,
  PathologyReport,
  CounterTransaction,
  LabReport,
  LabRequisition,
  Appointment,
  EveningSlot
} from '../../types';
import { BillHubTab } from './tabs/BillHubTab';
import { InvoiceCard } from '../InvoiceCard';
import { PatientsDirectoryTab } from '../doctor/tabs/PatientsDirectoryTab';
import { WhatsAppSupportModal } from '../shared/WhatsAppSupportModal';
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
  Activity,
  LogOut,
  Users,
  Stethoscope,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Clock,
  Video,
  Layers,
  FlaskConical,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  HeartPulse,
  UserPlus,
  Phone,
  X,
  Pill,
  Receipt,
  Save,
  RefreshCw,
  MessageSquare,
  MessagesSquare,
  Loader2,
  Sparkles,
  LayoutDashboard,
  Volume2,
  Eye,
  Flame,
  Timer,
  ChevronRight,
  TrendingUp,
  Plus,
  PhoneCall,
  Scissors,
  Check,
  Menu,
  ArrowRight,
  Crosshair,
  Camera,
  CreditCard,
  Download,
  Zap,
  ExternalLink,
  FileSpreadsheet,
  User,
  FileCheck
} from 'lucide-react';

const getBilingualInstruction = (medicineName: string, dosage?: string) => {
  const nameLower = (medicineName || '').toLowerCase();
  const dosageLower = (dosage || '').toLowerCase();
  
  let english = 'As directed by physician';
  let hindi = 'चिकित्सक के निर्देशानुसार';
  
  if (nameLower.includes('metformin') || dosageLower.includes('1-0-1') || dosageLower.includes('bd') || dosageLower.includes('twice')) {
    english = '1 Tablet - Morning & Evening (Post Meal)';
    hindi = '1 गोली - सुबह और शाम (खाने के बाद)';
  } else if (nameLower.includes('pantoprazole') || dosageLower.includes('1-0-0') || dosageLower.includes('od') || dosageLower.includes('empty stomach')) {
    english = '1 Tablet - Morning (Empty Stomach, 30 min before food)';
    hindi = '1 गोली - सुबह खाली पेट (खाने से ३० मिनट पहले)';
  } else if (nameLower.includes('paracetamol') || dosageLower.includes('sos') || dosageLower.includes('prn')) {
    english = '1 Tablet - As needed for fever/pain (Max 3 times daily)';
    hindi = '1 गोली - बुखार या दर्द होने पर (दिन में अधिकतम ३ बार)';
  } else if (nameLower.includes('amoxicillin') || nameLower.includes('azithromycin') || nameLower.includes('antibiotic')) {
    english = '1 Capsule - Morning & Evening (After food, complete full course)';
    hindi = '1 कैप्सूल - सुबह और शाम (खाने के बाद, कोर्स पूरा करें)';
  } else if (nameLower.includes('atorvastatin') || dosageLower.includes('0-0-1') || dosageLower.includes('night')) {
    english = '1 Tablet - Night (Before sleeping)';
    hindi = '1 गोली - रात को (सोने से पहले)';
  } else if (dosageLower.includes('1-1-1') || dosageLower.includes('tds') || dosageLower.includes('thrice')) {
    english = '1 Tablet - Morning, Afternoon & Evening (Post Meal)';
    hindi = '1 गोली - सुबह, दोपहर और शाम (खाने के बाद)';
  }
  
  return { english, hindi };
};

export const CompounderDashboard: React.FC = () => {
  const { isOphthalmology, nomenclature } = useSpecialization();
  const { podEntities, activePod, activeProfile } = useClinic();
  const clinicTitle = activePod?.name || activeProfile?.clinicName || 'Clinic Node';
  const [activeTab, setActiveTab] = useState<'overview' | 'opd_patients' | 'clinical_hub' | 'billing_daycare'>('overview');
  const [opdSubTab, setOpdSubTab] = useState<'today_queue' | 'directory' | 'history'>('today_queue');
  const [opdQueueFilter, setOpdQueueFilter] = useState<'today' | 'upcoming'>('today');
  const [pastHistorySearchQuery, setPastHistorySearchQuery] = useState('');
  const [clinicalSubTab, setClinicalSubTab] = useState<'labs' | 'pharmacy'>('labs');
  const [billingSubTab, setBillingSubTab] = useState<'billing' | 'ocr_scan' | 'ot_daycare'>('billing');
  const [billHubInitialMode, setBillHubInitialMode] = useState<'ocr_scan' | 'manual_billing'>('ocr_scan');
  const [patientsSubTab, setPatientsSubTab] = useState<'directory' | 'register'>('directory');
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);

  // Core Registry & Live Sync States
  const [patients, setPatients] = useState<Patient[]>(() => api.getPatients());
  const [sessions, setSessions] = useState<WhatsAppSession[]>(() => api.getWhatsAppSessions());
  const [appointments, setAppointments] = useState<Appointment[]>(() => api.getAppointments());
  const [dataRevision, setDataRevision] = useState(0);
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const [heightVal, setHeightVal] = useState('170');

  // Modern Mobile Native Sheets & Modals
  const [showInstantAppointmentModal, setShowInstantAppointmentModal] = useState(false);
  const [lastIssuedInstantToken, setLastIssuedInstantToken] = useState<{ token: string; name: string } | null>(null);
  const [showVitalsBottomSheet, setShowVitalsBottomSheet] = useState(false);
  const [showQuickAddSheet, setShowQuickAddSheet] = useState(false);
  const [showDilationModal, setShowDilationModal] = useState<Patient | null>(null);
  const [selectedDilationEye, setSelectedDilationEye] = useState<'both' | 're' | 'le'>('both');
  const [selectedDilationDrop, setSelectedDilationDrop] = useState<'tropicamide' | 'phenylephrine' | 'cyclopentolate'>('tropicamide');
  // Batch Prescription Printing States
  const [showBatchPrescriptionPrintModal, setShowBatchPrescriptionPrintModal] = useState(false);
  const [selectedPatientIdsForPrint, setSelectedPatientIdsForPrint] = useState<string[]>([]);
  const [batchPrintSearchTerm, setBatchPrintSearchTerm] = useState('');
  const [previewPatientId, setPreviewPatientId] = useState<string | null>(null);

  const vitalsDonePatients = useMemo(() => {
    return patients.filter(p => {
      const v = p.vitals;
      return v && (v.bloodPressure || v.pulseRate || v.temperature || v.spO2 || v.bloodSugar || v.weight);
    });
  }, [patients, dataRevision]);

  const filteredVitalsPatients = useMemo(() => {
    if (!batchPrintSearchTerm.trim()) return vitalsDonePatients;
    const term = batchPrintSearchTerm.toLowerCase();
    return vitalsDonePatients.filter(p => 
      (p.name || '').toLowerCase().includes(term) ||
      (p.phone || '').includes(term) ||
      String(p.tokenNumber || (p as any).token_number || '').toLowerCase().includes(term)
    );
  }, [vitalsDonePatients, batchPrintSearchTerm]);

  const handlePrintPrescriptionSlips = useCallback((targetPatients: Patient[]) => {
    if (targetPatients.length === 0) return;
    const template = api.getPrescriptionTemplate();
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;

    const slipsHtml = targetPatients.map((p, idx) => {
      const v = p.vitals || ({} as any);
      const isLast = idx === targetPatients.length - 1;

      return `
        <div class="prescription-slip ${!isLast ? 'page-break' : ''}">
          <!-- Clinic Letterhead Header (Top) -->
          <div class="header" style="border-bottom: 2.5px solid ${template.headerColor || '#0284c7'};">
            <div class="header-clinic-info">
              <h1 style="color: ${template.headerColor || '#0284c7'}; font-size: 20px; font-weight: 800;">
                🏥 ${template.clinicName || 'Smart Care Clinic & Hospital'}
              </h1>
              <p class="address" style="font-size: 11px; color: #475569; margin-top: 2px;">
                ${template.clinicAddress || 'Main Road, Health Plaza, City Center'}
              </p>
            </div>
            <div class="header-timing-contact" style="text-align: right;">
              <p class="phone" style="font-size: 11px; font-weight: 700; color: ${template.headerColor || '#0284c7'};">
                📞 ${template.clinicPhone || '+91 99342 98453'}
              </p>
              <p style="font-size: 10px; color: #64748b; margin-top: 1px;">OPD: 09:00 AM - 08:00 PM</p>
            </div>
          </div>

          <!-- Patient Demographics Bar -->
          <div class="patient-bar">
            <div class="pat-col">
              <span class="lbl">Patient Name:</span> <strong>${p.name || 'Patient'}</strong>
            </div>
            <div class="pat-col">
              <span class="lbl">Age / Sex:</span> <strong>${p.age || '—'} Y / ${p.gender || '—'}</strong>
            </div>
            <div class="pat-col">
              <span class="lbl">Phone:</span> <strong>${p.phone || '—'}</strong>
            </div>
            <div class="pat-col">
              <span class="lbl">Token No:</span> <span class="token-badge">#${p.tokenNumber || (p as any).token_number || 'OPD'}</span>
            </div>
            <div class="pat-col">
              <span class="lbl">Date:</span> <strong>${getIstDateString()}</strong>
            </div>
            <div class="pat-col">
              <span class="lbl">ABHA ID:</span> <span class="mono">${p.abhaId || '—'}</span>
            </div>
          </div>

          <!-- Single Horizontal Row Vitals Strip in Header -->
          <div class="vitals-horizontal-row">
            <span class="v-strip-title">🩺 PRE-CHECKED VITALS:</span>
            <div class="v-items-inline">
              <span>BP: <strong>${v.bloodPressure || '120/80'}</strong> mmHg</span>
              <span class="v-sep">|</span>
              <span>Pulse: <strong>${v.pulseRate || '72'}</strong> bpm</span>
              <span class="v-sep">|</span>
              <span>SpO2: <strong>${v.spO2 || '99'}</strong>%</span>
              <span class="v-sep">|</span>
              <span>Temp: <strong>${v.temperature || '98.6'}</strong>°F</span>
              <span class="v-sep">|</span>
              <span>Sugar: <strong>${v.bloodSugar || '105'}</strong> mg/dL</span>
              <span class="v-sep">|</span>
              <span>Weight: <strong>${v.weight || '65'}</strong> kg</span>
            </div>
          </div>

          <!-- Clinical Ruled Worksheet Body -->
          <div class="clinical-body">
            <div class="section-row">
              <div class="sec-title">Chief Complaints / Clinical Findings:</div>
              <div class="ruled-area" style="height: 95px;"></div>
            </div>

            <div class="rx-symbol">℞</div>

            <div class="section-row">
              <div class="sec-title">Prescribed Medications (Handwritten by Doctor):</div>
              <div class="med-table">
                <div class="med-head">
                  <div class="col-sno">#</div>
                  <div class="col-drug">Medicine Name / Formulation</div>
                  <div class="col-dose">Dosage & Frequency (1-0-1)</div>
                  <div class="col-dur">Duration</div>
                  <div class="col-inst">Timing / Instructions</div>
                </div>
                ${[1, 2, 3, 4, 5].map(i => `
                  <div class="med-row">
                    <div class="col-sno">${i}.</div>
                    <div class="col-drug"></div>
                    <div class="col-dose"></div>
                    <div class="col-dur"></div>
                    <div class="col-inst"></div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="section-row" style="margin-top: 10px;">
              <div class="sec-title">Advised Lab / Diagnostic Tests:</div>
              <div class="ruled-area" style="height: 55px;"></div>
            </div>
          </div>

          <!-- Doctor Information in Bottom Footer of Page -->
          <div class="footer">
            <div class="footer-left">
              <div class="doc-info-block">
                <h3 class="doc-name" style="color: ${template.headerColor || '#0284c7'}; font-size: 13px; font-weight: 800;">
                  👨‍⚕️ ${template.doctorName || 'Attending Physician'}
                </h3>
                <p class="doc-qual" style="font-size: 10px; font-weight: 600; color: #475569;">
                  ${template.doctorQualification || 'MBBS, MS (Ophthalmology), FICO (London)'}
                </p>
                <p class="doc-reg" style="font-size: 9px; font-family: monospace; color: #64748b;">
                  Reg No: <strong>${template.doctorRegNo || 'MCI-84992-A'}</strong>
                </p>
              </div>
              <p class="followup-line" style="margin-top: 6px;">Next Follow-Up Review: ____________________</p>
              <p class="disclaimer">${template.footerNote || 'Emergency Care: Available 24x7 · Valid for 15 days.'}</p>
            </div>
            <div class="footer-right">
              <div class="sig-line"></div>
              <p class="doc-sig-text">${template.doctorName || 'Doctor'}'s Signature & Stamp</p>
            </div>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OPD Prescription Slips - ${template.clinicName || 'Clinic'}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }
          body { background: #f8fafc; color: #1e293b; }
          @page { size: A4 portrait; margin: 10mm 12mm; }
          @media print {
            body { background: #fff; }
            .no-print { display: none !important; }
            .prescription-slip { 
              border: none !important; 
              box-shadow: none !important; 
              margin: 0 !important; 
              width: 100% !important; 
              padding: 0 !important; 
              page-break-after: always !important; 
              break-after: page !important; 
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              max-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .prescription-slip:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          }
          .prescription-slip {
            background: #fff;
            max-width: 800px;
            margin: 15px auto;
            padding: 24px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          }
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; margin-bottom: 10px; }
          .header-clinic-info h1 { font-size: 18px; font-weight: 800; }
          .address { font-size: 10px; color: #475569; margin-top: 2px; }
          .phone { font-size: 10px; font-weight: 700; color: #0284c7; }
          
          .patient-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 8px; font-size: 11px; }
          .pat-col .lbl { color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: 700; }
          .token-badge { background: #e0e7ff; color: #3730a3; font-weight: 800; font-family: monospace; padding: 1px 6px; border-radius: 4px; border: 1px solid #c7d2fe; }
          .mono { font-family: monospace; }

          .vitals-horizontal-row { display: flex; align-items: center; gap: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; font-size: 10px; }
          .v-strip-title { font-size: 9px; font-weight: 800; font-family: monospace; color: #166534; white-space: nowrap; }
          .v-items-inline { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: #14532d; font-family: monospace; font-size: 10px; }
          .v-items-inline strong { color: #15803d; }
          .v-sep { color: #86efac; font-weight: bold; }

          .clinical-body { margin-top: 6px; }
          .section-row { margin-bottom: 8px; }
          .sec-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #334155; margin-bottom: 3px; }
          .ruled-area { border: 1px solid #e2e8f0; border-radius: 4px; background: repeating-linear-gradient(to bottom, transparent, transparent 27px, #e2e8f0 28px); }

          .rx-symbol { font-size: 24px; font-weight: 900; color: #0284c7; font-family: 'Times New Roman', serif; margin: 2px 0; }

          .med-table { width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; font-size: 10px; }
          .med-head { display: flex; background: #f8fafc; font-weight: 700; color: #475569; border-bottom: 1px solid #cbd5e1; padding: 5px 8px; }
          .med-row { display: flex; border-bottom: 1px solid #e2e8f0; height: 30px; align-items: center; padding: 0 8px; }
          .med-row:last-child { border-bottom: none; }
          .col-sno { width: 28px; font-weight: 700; color: #94a3b8; }
          .col-drug { flex: 2; border-right: 1px dashed #e2e8f0; height: 100%; }
          .col-dose { flex: 1.5; border-right: 1px dashed #e2e8f0; height: 100%; }
          .col-dur { flex: 1; border-right: 1px dashed #e2e8f0; height: 100%; }
          .col-inst { flex: 1.5; height: 100%; }

          .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; padding-top: 8px; border-top: 1px dashed #cbd5e1; }
          .doc-info-block { margin-bottom: 4px; }
          .followup-line { font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 3px; }
          .disclaimer { font-size: 8.5px; color: #64748b; }
          .footer-right { text-align: center; }
          .sig-line { width: 150px; border-bottom: 1.5px solid #0f172a; margin-bottom: 3px; margin-left: auto; }
          .doc-sig-text { font-size: 9px; font-weight: 700; color: #334155; }
        </style>
      </head>
      <body>
        <div class="no-print" style="background: #0284c7; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <div style="font-weight: bold; font-size: 14px;">VitalSync OPD Batch Prescription Printing (${targetPatients.length} Slips)</div>
          <div style="display: flex; gap: 10px;">
            <button onclick="window.print()" style="background: white; color: #0284c7; font-weight: 800; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer;">🖨️ Print / Save as PDF</button>
            <button onclick="alert('Slips batch dispatched to patient WhatsApp queue');" style="background: #16a34a; color: white; font-weight: 800; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer;">📲 Send via WhatsApp</button>
          </div>
        </div>
        ${slipsHtml}
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }, []);

  // Realtime 1-sec clock ticker for live dilation countdowns
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Synchronize tabs from mobile footer dock & ecosystem events
  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const target = customEvent.detail;
      if (target === 'overview' || target === 'opd_patients' || target === 'clinical_hub' || target === 'billing_daycare') {
        setActiveTab(target);
      } else if (target === 'tokens' || target === 'patients') {
        setActiveTab('opd_patients');
        setOpdSubTab('today_queue');
      } else if (target === 'labs' || target === 'pharmacy') {
        setActiveTab('clinical_hub');
        setClinicalSubTab(target === 'pharmacy' ? 'pharmacy' : 'labs');
      } else if (target === 'ot_billing' || target === 'invoice_generator') {
        setActiveTab('billing_daycare');
        setBillingSubTab('billing');
      }
    };

    window.addEventListener('mediflow-compounder-tab-changed', handleTabChange);
    window.addEventListener('mediflow-change-tab', handleTabChange);
    return () => {
      window.removeEventListener('mediflow-compounder-tab-changed', handleTabChange);
      window.removeEventListener('mediflow-change-tab', handleTabChange);
    };
  }, []);

  // Patient Directory Tab Local States
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedDirectoryPatient, setSelectedDirectoryPatient] = useState<Patient | null>(null);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientAge, setNewPatientAge] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [patientRAGSummary, setPatientRAGSummary] = useState('');

  // Active patient in care loop
  const [activePatient, setActivePatientState] = useState<Patient | null>(null);
  const [activePatientStage, setActivePatientStage] = useState<'registered' | 'diagnosing' | 'lab' | 'pharmacy' | 'settled'>('registered');
  const [scannedSummary, setScannedSummary] = useState<string | null>(null);
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [viewingDocUrl, setViewingDocUrl] = useState<string | null>(null);

  // SaaS Gate States
  const [ocrScanningApptId, setOcrScanningApptId] = useState<string | null>(null);
  const [revisitPatientId, setRevisitPatientId] = useState<string>('');
  const [revisitDate, setRevisitDate] = useState<string>('');
  const [revisitTime, setRevisitTime] = useState<string>('');

  // Swasthya Vitals Intake States
  const [vitalsPatient, setVitalsPatient] = useState<Patient | null>(null);
  const [tempVal, setTempVal] = useState('98.6');
  const [bpVal, setBpVal] = useState('120/80');
  const [pulseVal, setPulseVal] = useState('72');
  const [spo2Val, setSpo2Val] = useState('99');
  const [weightVal, setWeightVal] = useState('65');
  const [sugarVal, setSugarVal] = useState('105');
  const [isSavingVitals, setIsSavingVitals] = useState(false);

  // Quick Vitals Source Filter Tab
  const [vitalsSourceFilter, setVitalsSourceFilter] = useState<'all' | 'whatsapp' | 'qr_scan' | 'counter'>('all');
  const [vitalsSearchTerm, setVitalsSearchTerm] = useState('');

  // Instant Fast-Intake Panel States
  const [instantSearchQuery, setInstantSearchQuery] = useState('');
  const [instantSelectedPatient, setInstantSelectedPatient] = useState<Patient | null>(null);
  const [instantName, setInstantName] = useState('');
  const [instantPhone, setInstantPhone] = useState('');
  const [instantAge, setInstantAge] = useState('');
  const [instantGender, setInstantGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [instantFeeStatus, setInstantFeeStatus] = useState<'paid_cash' | 'paid_upi'>('paid_upi');
  const [instantBpSys, setInstantBpSys] = useState('120');
  const [instantBpDia, setInstantBpDia] = useState('80');
  const [instantPulse, setInstantPulse] = useState('72');
  const [instantSpO2, setInstantSpO2] = useState('99');
  const [instantTemp, setInstantTemp] = useState('98.6');
  const [instantSugar, setInstantSugar] = useState('');
  const [instantWeight, setInstantWeight] = useState('65');
  const [isSubmittingInstant, setIsSubmittingInstant] = useState(false);

  useEffect(() => {
    if (vitalsPatient) {
      setBpVal(vitalsPatient.vitals?.bloodPressure || '120/80');
      setPulseVal(String(vitalsPatient.vitals?.pulseRate || '72'));
      setTempVal(String(vitalsPatient.vitals?.temperature || '98.6'));
      setSpo2Val(String(vitalsPatient.vitals?.spO2 || '99'));
      setSugarVal(vitalsPatient.vitals?.bloodSugar ? String(vitalsPatient.vitals.bloodSugar) : '105');
      setWeightVal(String(vitalsPatient.vitals?.weight || '65'));
    }
  }, [vitalsPatient]);

  const handleApproveVitalsAndRouteToDoctor = async () => {
    if (!vitalsPatient || isSavingVitals) return;
    setIsSavingVitals(true);
    try {
      const updatedVitals: PatientVitals = {
        temperature: String(tempVal || '98.6'),
        bloodPressure: String(bpVal || '120/80'),
        pulseRate: String(pulseVal || '72'),
        spO2: String(spo2Val || '99'),
        weight: String(weightVal || '65'),
        bloodSugar: sugarVal ? String(sugarVal) : undefined,
        recordedAt: new Date().toISOString()
      };

      const patId = vitalsPatient.id;
      const assignedToken = vitalsPatient.tokenNumber || (vitalsPatient as any).token_number || api.generateNextTokenNumber();

      // 1. Update local patient record & queue status
      const existingPatient = patients.find(p => p.id === patId);
      if (existingPatient) {
        existingPatient.vitals = updatedVitals;
        existingPatient.queueStatus = 'awaiting_consultation';
        existingPatient.tokenNumber = String(assignedToken);
        api.savePatients([...patients]);
      }
      api.updatePatientQueueStatus(patId, 'awaiting_consultation');

      // 2. Find and update appointment status to ready_for_consult
      const existingAppt = appointments.find(a => a.patientId === patId || (a as any).patient_id === patId);
      if (existingAppt) {
        existingAppt.status = 'ready_for_consult';
        existingAppt.tokenNumber = String(assignedToken);
        (existingAppt as any).token_number = String(assignedToken);
        BillingService.saveAppointments([...appointments]);
      } else {
        const newAppt: Appointment = {
          id: `apt-${Date.now()}`,
          patientId: patId,
          doctorId: (activePod as any)?.doctor_id || (activePod as any)?.doctorId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
          status: 'ready_for_consult',
          date: getIstDateString(),
          tokenNumber: String(assignedToken),
          isVirtual: false,
          source: 'whatsapp_physical'
        } as any;
        BillingService.saveAppointments([newAppt, ...appointments]);
      }

      // 3. Ensure Doctor Consultation invoice & financial ledger are settled
      try {
        const matchingInvoice = BillingService.getInvoices().find(i => (i.patientId === patId || (i as any).patient_id === patId) && i.type === 'consult');
        if (matchingInvoice) {
          if (matchingInvoice.status !== 'paid') {
            await BillingService.recordInvoicePayment(matchingInvoice.id, 'upi');
          }
        } else {
          const inv = BillingService.createGate1Consult(patId);
          if (inv) {
            await BillingService.recordInvoicePayment(inv.id, 'upi');
          }
        }
      } catch (_invErr) {
        console.warn('[CompounderDashboard] Invoice auto-settle notice:', _invErr);
      }

      // 4. Remote Postgres Sync (Non-blocking)
      (async () => {
        try {
          await supabase
            .from('patient_registry')
            .update({
              vitals: updatedVitals,
              queue_status: 'awaiting_consultation',
              token_number: String(assignedToken)
            })
            .eq('id', patId);

          if (existingAppt?.id) {
            await supabase
              .from('appointments')
              .update({
                status: 'ready_for_consult',
                token_number: String(assignedToken)
              })
              .eq('id', existingAppt.id);
          }
        } catch (_dbErr) {
          console.warn('[CompounderDashboard] Supabase DB vitals sync error:', _dbErr);
        }
      })();

      // 5. Toast notification & State Refresh
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Patient Dispatched to Doctor! 🩺',
          message: `Token #${assignedToken} (${vitalsPatient.name}) routed to Doctor Consultation Queue with live vitals.`,
          type: 'success'
        }
      }));

      setDataRevision(prev => prev + 1);
      setPatients(api.getPatients());
      setAppointments(api.getAppointments());
      setVitalsPatient(null);
    } catch (err) {
      console.error('[CompounderDashboard] Error approving vitals:', err);
    } finally {
      setIsSavingVitals(false);
    }
  };
  
  // Interactive Workflow Modal State
  const [activeWorkflowDetail, setActiveWorkflowDetail] = useState<{
    type: 'prescription' | 'lab' | 'summary';
    patientId: string;
    patientName: string;
  } | null>(null);

  // Central Realtime CDC & Ecosystem Event Listener (Sub-250ms Live Sync)
  useEffect(() => {
    const syncData = () => {
      setPatients(api.getPatients());
      setAppointments(api.getAppointments());
      setSessions(api.getWhatsAppSessions());
      setDataRevision(prev => prev + 1);
    };

    syncData();
    window.addEventListener('mediflow-state-change', syncData);
    window.addEventListener('storage', syncData);

    const unsubscribeApi = api.subscribe(syncData);
    const unsubscribeRealtime = RealtimeSyncService.subscribeToLiveClinicUpdates({
      onPatientChange: () => syncData(),
      onAppointmentChange: () => syncData(),
      onUnifiedInvoiceChange: () => syncData(),
      onMedicineBillChange: () => syncData(),
      onLabRequisitionChange: () => syncData(),
      onPathologyReportChange: () => syncData(),
      onFinancialLedgerChange: () => syncData(),
      onWhatsAppSessionChange: () => syncData(),
      onClinicSopChange: () => syncData(),
      onPoolSettlementChange: () => syncData(),
    });

    return () => {
      window.removeEventListener('mediflow-state-change', syncData);
      window.removeEventListener('storage', syncData);
      unsubscribeApi();
      unsubscribeRealtime();
    };
  }, []);

  // Memoized Smart Prefix & Code Patient Search for Instant Intake Desk
  const instantMatchingPatients = useMemo(() => {
    const cleanQ = (instantSearchQuery || '').trim().toLowerCase();
    if (!cleanQ || instantSelectedPatient) return [];
    const digits = cleanQ.replace(/\D/g, '');
    
    return patients.filter(p => {
      const nameLower = (p.name || '').toLowerCase();
      // Prefix matching on first name or any word in patient name (e.g. 'N' -> 'Neha', 'Nitin', NOT 'Priyanka')
      const nameMatches = nameLower.startsWith(cleanQ) || nameLower.split(/\s+/).some(w => w.startsWith(cleanQ));
      // Patient ID or Smart Code matching (e.g. 'N2', 'PID-01', 'P101')
      const code = (p.patientCode || (p as any).patient_code || p.id || '').toLowerCase();
      const codeMatches = code === cleanQ || code.startsWith(cleanQ);
      // Mobile matching (if at least 3 digits typed)
      const phoneMatches = digits.length >= 3 && (p.phone || '').includes(digits);
      const abhaMatches = cleanQ.length >= 3 && (p.abhaId || '').toLowerCase().includes(cleanQ);

      return nameMatches || codeMatches || phoneMatches || abhaMatches;
    }).slice(0, 5);
  }, [instantSearchQuery, patients, instantSelectedPatient]);



  // Memoize workflow lookup datasets to avoid thousands of localStorage JSON parses per render
  const cachedEncountersMap = useMemo(() => {
    const map = new Map<string, any[]>();
    EncounterService.getEncounters().forEach(e => {
      if (!map.has(e.patientId)) map.set(e.patientId, []);
      map.get(e.patientId)!.push(e);
    });
    return map;
  }, [dataRevision]);

  const cachedLabReqsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    LabService.getLabRequisitions().forEach(r => {
      if (!map.has(r.patientId)) map.set(r.patientId, []);
      map.get(r.patientId)!.push(r);
    });
    return map;
  }, [dataRevision]);

  const cachedLabReportsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    LabService.getFullLabReports().forEach(r => {
      if (!map.has(r.patientId)) map.set(r.patientId, []);
      map.get(r.patientId)!.push(r);
    });
    return map;
  }, [dataRevision]);

  const cachedWhatsAppPhoneMap = useMemo(() => {
    const map = new Map<string, boolean>();
    api.getWhatsAppSessions().forEach(s => {
      const hasMsg = !!s?.sessionData?.chatHistory?.some(
        (m: any) => m?.sender === 'bot' && ((m?.text || '').includes('🏥') || (m?.text || '').includes('Advice') || (m?.text || '').includes('spectacle') || (m?.text || '').includes('Prescription') || (m?.text || '').includes('Summary'))
      );
      if (s.patientPhone) map.set(s.patientPhone, hasMsg);
    });
    return map;
  }, [dataRevision]);

  const cachedMedicineBillsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    PharmacyService.getMedicineBills().forEach(b => {
      if (!map.has(b.patientId)) map.set(b.patientId, []);
      map.get(b.patientId)!.push(b);
    });
    return map;
  }, [dataRevision]);

  const daycarePatients = useMemo(() => {
    return patients.filter(p => {
      if (isOphthalmology) {
        return p.vitals?.surgeryBooking && p.vitals.surgeryBooking.eye !== 'None';
      } else {
        return p.vitals?.gpProcedureBooking && p.vitals.gpProcedureBooking.procedure !== 'None';
      }
    });
  }, [patients, isOphthalmology]);

  const computedBmi = useMemo(() => {
    const w = parseFloat(weightVal) || 0;
    const h = (parseFloat(heightVal) || 165) / 100;
    if (w <= 0 || h <= 0) return { bmi: 22.5, category: 'Normal' };
    const bmiVal = parseFloat((w / (h * h)).toFixed(1));
    let cat = 'Normal';
    if (bmiVal < 18.5) cat = 'Underweight';
    else if (bmiVal >= 25 && bmiVal < 30) cat = 'Overweight';
    else if (bmiVal >= 30) cat = 'Obese';
    return { bmi: bmiVal, category: cat };
  }, [weightVal, heightVal]);

  const handleCallPatientChamber = (patientName: string, tokenNum: string) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const text = `Token number ${tokenNum}. Patient ${patientName}, please proceed to Doctor Chamber.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: `📢 Calling Token ${tokenNum}`,
          message: `${patientName} called to Doctor Chamber.`,
          type: 'info'
        }
      }));
    } catch (_e) {
      console.warn('[Speech] Call out notice:', _e);
    }
  };

  const handleStartEyeDilation = async (patient: Patient) => {
    const nowIso = new Date().toISOString();
    const updatedPatient: Patient = {
      ...patient,
      eyeDilationStatus: 'in_progress',
      dilationTimestamp: nowIso
    };
    
    try {
      const allPatients = api.getPatients();
      const updatedList = allPatients.map(p => p.id === patient.id ? updatedPatient : p);
      localStorage.setItem('mediflow_patients', JSON.stringify(updatedList));
    } catch (_e) { /* ignore */ }

    setPatients(api.getPatients());
    setDataRevision(prev => prev + 1);

    try {
      await supabase
        .from('patient_registry')
        .update({
          eye_dilation_status: 'in_progress',
          dilation_timestamp: nowIso
        })
        .eq('id', patient.id);
    } catch (_e) { /* ignore */ }

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: '👁️ Eye Dilation Started (15m Timer)',
        message: `${patient.name} dilation drops applied. 15-minute countdown running.`,
        type: 'success'
      }
    }));
    setShowDilationModal(null);
  };

  const activeOpdAppointments = useMemo(() => {
    const todayStr = getIstDateString();
    return appointments.filter(a => {
      const aDate = getEffectiveAppointmentDate(a);
      return (aDate === todayStr || (a.createdAt || '').startsWith(todayStr)) && a.status !== 'cancelled';
    });
  }, [appointments, dataRevision]);

  const inChamberAppointment = useMemo(() => {
    return appointments.find(a => a.status === 'in_consult');
  }, [appointments, dataRevision]);

  const pendingVitalsList = useMemo(() => {
    const todayStr = getIstDateString();
    return patients.filter(p => {
      const isToday = (p.registeredAt || (p as any).createdAt || (p as any).created_at || '').startsWith(todayStr) ||
        activeOpdAppointments.some(a => a.patientId === p.id || (a as any).patient_id === p.id);
      const lacksVitals = !p.vitals || !p.vitals.bloodPressure || p.vitals.bloodPressure === '';
      const isPendingQueue = p.queueStatus === 'awaiting_vitals' || p.queueStatus === 'registered' || p.queueStatus === 'awaiting_consultation' || !p.queueStatus;
      return isToday && lacksVitals && isPendingQueue;
    });
  }, [patients, activeOpdAppointments, dataRevision]);

  const nextQueuedPatient = useMemo(() => {
    return activeOpdAppointments.find(a => a.status === 'ready_for_consult');
  }, [activeOpdAppointments]);

  const getPatientSourceTag = useCallback((p: Patient) => {
    const todayStr = getIstDateString();
    const appt = appointments.find(a => 
      (a.patientId === p.id || (a as any).patient_id === p.id) &&
      (getEffectiveAppointmentDate(a) === todayStr || (a.createdAt || '').startsWith(todayStr))
    );
    const src = String(appt?.source || (p as any).source || '').toLowerCase();
    if (src.includes('whatsapp') || src.includes('bot')) return 'whatsapp';
    if (src.includes('qr') || (p.patientCode && p.patientCode.startsWith('QR'))) return 'qr_scan';
    return 'counter';
  }, [appointments]);

  const whatsappPendingVitals = useMemo(() => {
    return pendingVitalsList.filter(p => getPatientSourceTag(p) === 'whatsapp');
  }, [pendingVitalsList, getPatientSourceTag]);

  const qrPendingVitals = useMemo(() => {
    return pendingVitalsList.filter(p => getPatientSourceTag(p) === 'qr_scan');
  }, [pendingVitalsList, getPatientSourceTag]);

  const counterPendingVitals = useMemo(() => {
    return pendingVitalsList.filter(p => getPatientSourceTag(p) === 'counter');
  }, [pendingVitalsList, getPatientSourceTag]);

  const filteredPendingVitalsList = useMemo(() => {
    let list = pendingVitalsList;
    if (vitalsSourceFilter === 'whatsapp') list = whatsappPendingVitals;
    else if (vitalsSourceFilter === 'qr_scan') list = qrPendingVitals;
    else if (vitalsSourceFilter === 'counter') list = counterPendingVitals;
    
    if (vitalsSearchTerm.trim()) {
      const q = vitalsSearchTerm.toLowerCase().trim();
      list = list.filter(p => 
        (p.name || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q) ||
        String(p.tokenNumber || '').toLowerCase().includes(q) ||
        (p.patientCode || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [pendingVitalsList, vitalsSourceFilter, vitalsSearchTerm, whatsappPendingVitals, qrPendingVitals, counterPendingVitals]);

  const arrivedLabReports = useMemo(() => {
    const reqs = LabService.getLabRequisitions();
    const seen = new Set<string>();
    const uniqueReqs: typeof reqs = [];

    for (const r of reqs) {
      const isDone = r.status === 'collected' || Boolean(r.quantitativeResult) || (r as any).status === 'completed' || (r as any).status === 'processed';
      if (!isDone) continue;
      const key = `${r.patientId || (r as any).patient_id}-${r.testCode || r.testName}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueReqs.push(r);
      }
    }
    return uniqueReqs.slice(0, 8);
  }, [dataRevision]);

  const formatBiomarkerResult = (res: any): string => {
    if (!res) return 'Verified Normal ✅';
    if (typeof res === 'object') {
      const obj = res.biomarkers || res;
      return Object.entries(obj).map(([k, v]) => `${k}: ${v}${typeof v === 'number' && k.toLowerCase().includes('hba1c') ? '%' : ''}`).join(', ') || 'Verified ✅';
    }
    if (typeof res === 'string') {
      if (res.startsWith('{') || res.startsWith('[')) {
        try {
          const parsed = JSON.parse(res);
          const obj = parsed.biomarkers || parsed;
          if (typeof obj === 'object') {
            return Object.entries(obj).map(([k, v]) => `${k}: ${v}${typeof v === 'number' && k.toLowerCase().includes('hba1c') ? '%' : ''}`).join(', ') || res;
          }
        } catch {
          return res;
        }
      }
      return res;
    }
    return String(res);
  };

  const handleSendLabReportWhatsApp = async (req: LabRequisition) => {
    try {
      const p = patients.find(pat => pat.id === req.patientId);
      const rawPhone = p?.phone || (req as any).patientPhone || (req as any).patient_phone || '';
      if (!rawPhone) {
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Missing Phone Number ⚠️',
            message: `No registered contact number found for ${req.patientName || 'this patient'}.`,
            type: 'error'
          }
        }));
        return;
      }
      const phone = rawPhone.replace(/\D/g, '').slice(-10);
      const patientName = req.patientName || p?.name || 'Patient';
      
      const msgText = `🔬 *VitalSync Lab Alert — Report Ready!* 📄\n\nDear *${patientName}*, your laboratory test *${req.testName}* report is ready.\n\n📊 *Result Summary:* ${req.quantitativeResult || 'Test Normal & Verified'}\n🏥 *Evening Review:* 04:30 PM - 05:30 PM at Clinic Counter with Dr. ${activePod?.doctor_name || 'Attending Physician'}.\n\n_VitalSync Virtual Hospital Network_`;

      await api.pushWhatsAppMessageFromBot(phone, msgText);
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'WhatsApp Alert Dispatched! 📲',
          message: `Lab result notification sent to ${patientName} (+91 ${phone.slice(-4)}).`,
          type: 'success'
        }
      }));
      setDataRevision(prev => prev + 1);
    } catch (_err) {
      console.warn('[LabWhatsApp] Error sending alert:', _err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Alert Notice',
          message: `WhatsApp notification queued for dispatch.`,
          type: 'info'
        }
      }));
    }
  };

  const handleInstantAppointmentAndVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingInstant) return;
    
    const pName = (instantSelectedPatient ? instantSelectedPatient.name : instantName).trim();
    const pPhone = (instantSelectedPatient ? instantSelectedPatient.phone : instantPhone).replace(/\D/g, '');

    if (!pName) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Name Required', message: 'Please enter patient full name.', type: 'error' }
      }));
      return;
    }
    if (pPhone.length < 10) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'Valid Phone Required', message: 'Please enter a 10-digit mobile number.', type: 'error' }
      }));
      return;
    }

    setIsSubmittingInstant(true);
    try {
      let targetPatient: Patient;
      if (instantSelectedPatient) {
        targetPatient = instantSelectedPatient;
      } else {
        const existing = patients.find(p => p.phone.slice(-10) === pPhone.slice(-10));
        if (existing) {
          targetPatient = existing;
        } else {
          targetPatient = api.registerPatient({
            name: pName,
            phone: pPhone,
            age: parseInt(instantAge) || 35,
            gender: instantGender,
            allergies: [],
            chronicConditions: []
          });
        }
      }

      const assignedToken = api.generateNextTokenNumber();
      const bp = (instantBpSys && instantBpDia) ? `${instantBpSys}/${instantBpDia}` : (instantBpSys || '120/80');
      const vitals: PatientVitals = {
        bloodPressure: bp,
        pulseRate: instantPulse || '72',
        spO2: instantSpO2 || '99',
        temperature: instantTemp || '98.6',
        weight: instantWeight || '65',
        bloodSugar: instantSugar ? String(instantSugar) : undefined,
        recordedAt: new Date().toISOString()
      };

      // 1. Update Patient with Vitals and Token
      targetPatient.vitals = vitals;
      targetPatient.queueStatus = 'awaiting_consultation';
      targetPatient.tokenNumber = String(assignedToken);
      api.savePatients([...patients]);

      // 2. Create Gate 1 Consultation Invoice and clear payment
      const inv = BillingService.createGate1Consult(targetPatient.id);
      if (inv) {
        await BillingService.recordInvoicePayment(inv.id, instantFeeStatus === 'paid_cash' ? 'cash' : 'upi');
      }

      // 3. Create or update Appointment
      const todayStr = getIstDateString();
      const existingAppt = appointments.find(a => 
        (a.patientId === targetPatient.id || (a as any).patient_id === targetPatient.id) &&
        (getEffectiveAppointmentDate(a) === todayStr || (a.createdAt || '').startsWith(todayStr))
      );

      if (existingAppt) {
        existingAppt.status = 'ready_for_consult';
        existingAppt.tokenNumber = String(assignedToken);
        (existingAppt as any).token_number = String(assignedToken);
        BillingService.saveAppointments([...appointments]);
      } else {
        const newAppt: Appointment = {
          id: `apt-${Date.now()}`,
          patientId: targetPatient.id,
          doctorId: (activePod as any)?.doctor_id || (activePod as any)?.doctorId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
          status: 'ready_for_consult',
          date: todayStr,
          tokenNumber: String(assignedToken),
          patientName: targetPatient.name,
          patientPhone: targetPatient.phone,
          isVirtual: false,
          source: 'counter'
        } as any;
        BillingService.saveAppointments([newAppt, ...appointments]);
      }

      // 4. Remote Postgres Sync (Non-blocking)
      (async () => {
        try {
          await supabase.from('patient_registry').upsert({
            id: targetPatient.id,
            name: targetPatient.name,
            phone: targetPatient.phone,
            vitals: vitals,
            queue_status: 'awaiting_consultation',
            token_number: String(assignedToken)
          });
        } catch (_err) { /* ignore */ }
      })();

      // 5. Toast & Voice announcement
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: `Token #${assignedToken} Confirmed! 🩺`,
          message: `${targetPatient.name} booked, fee cleared (₹500.00 ${instantFeeStatus === 'paid_cash' ? 'Cash' : 'UPI'}), vitals recorded & routed to Doctor!`,
          type: 'success'
        }
      }));

      handleCallPatientChamber(targetPatient.name, String(assignedToken));
      setLastIssuedInstantToken({ token: String(assignedToken), name: targetPatient.name });

      // Reset form for next continuous booking
      setInstantSearchQuery('');
      setInstantSelectedPatient(null);
      setInstantName('');
      setInstantPhone('');
      setInstantAge('');
      setInstantBpSys('120');
      setInstantBpDia('80');
      setInstantPulse('72');
      setInstantSpO2('99');
      setInstantTemp('98.6');
      setInstantSugar('');
      setDataRevision(prev => prev + 1);
      setPatients(api.getPatients());
      fetchLiveAppointments();
    } catch (err) {
      console.error('[InstantBooking] Error:', err);
    } finally {
      setIsSubmittingInstant(false);
    }
  };

  const activeDilationPatients = useMemo(() => {
    return patients.filter(p => {
      if (p.eyeDilationStatus === 'in_progress' && p.dilationTimestamp) {
        const elapsedSec = (currentTime.getTime() - new Date(p.dilationTimestamp).getTime()) / 1000;
        return elapsedSec < 900; // 15 mins
      }
      return false;
    });
  }, [patients, currentTime, dataRevision]);

  const sosEmergencyAppointment = useMemo(() => {
    return appointments.find(a => a.source === 'whatsapp_sos' || (a as any).isEmergency);
  }, [appointments, dataRevision]);

  const lowStockItems = useMemo(() => {
    const inv = api.getPharmacyInventory();
    return inv.filter(item => (item.stock || 0) <= 15);
  }, [dataRevision]);

  // High-Speed Memoized Dynamic Patient Workflow Calculator (< 3ms)
  const getPatientWorkflowState = useCallback((patient: Patient, appt: Appointment) => {
    const patientEncounters = cachedEncountersMap.get(patient.id) || [];
    const latestEncounter = patientEncounters[patientEncounters.length - 1];

    const reqs = cachedLabReqsMap.get(patient.id) || [];
    const reports = cachedLabReportsMap.get(patient.id) || [];
    const hasWhatsAppMsg = cachedWhatsAppPhoneMap.get(patient.phone) || false;
    const mbills = cachedMedicineBillsMap.get(patient.id) || [];

    // Step 1: Appointment Done
    const s1_status = 'completed';

    // Step 2: Doctor Consult
    let s2_status: 'completed' | 'active' | 'pending' = 'pending';
    if (latestEncounter) {
      s2_status = 'completed';
    } else if (appt.status === 'ready_for_consult' || patient.queueStatus === 'in_consultation') {
      s2_status = 'active';
    }

    // Step 3: Rx Made
    const s3_status = latestEncounter ? 'completed' : 'pending';

    // Step 4: Lab
    let s4_status: 'completed' | 'active' | 'pending' | 'skipped' = 'pending';
    if (latestEncounter) {
      if (latestEncounter.diagnosticTests.length === 0 && reqs.length === 0) {
        s4_status = 'skipped';
      } else {
        const allDone = reqs.length > 0 && reqs.every(r => r.status === 'completed' || r.status === 'processed');
        s4_status = allDone ? 'completed' : 'active';
      }
    } else if (reqs.length > 0) {
      const allDone = reqs.every(r => r.status === 'completed' || r.status === 'processed');
      s4_status = allDone ? 'completed' : 'active';
    }

    // Step 5: Doctor Re-verify (Post-Lab)
    let s5_status: 'completed' | 'active' | 'pending' | 'skipped' = 'pending';
    if (latestEncounter) {
      if (latestEncounter.diagnosticTests.length === 0 && reqs.length === 0) {
        s5_status = 'skipped';
      } else {
        const allApproved = reports.length > 0 && reports.every(r => r.status === 'approved');
        s5_status = allApproved ? 'completed' : (reqs.length > 0 ? 'active' : 'pending');
      }
    }

    // Step 6: Patient WhatsApp
    let s6_status: 'completed' | 'active' | 'pending' = 'pending';
    if (hasWhatsAppMsg) {
      s6_status = 'completed';
    } else if (latestEncounter) {
      s6_status = 'active';
    }

    // Step 7: Pharmacy
    let s7_status: 'completed' | 'active' | 'pending' | 'skipped' = 'pending';
    if (latestEncounter) {
      if ((latestEncounter.medications || []).length === 0) {
        s7_status = 'skipped';
      } else {
        const allSettled = mbills.length > 0 && mbills.every(b => b.status === 'paid' || b.status === 'confirmed');
        s7_status = allSettled ? 'completed' : 'active';
      }
    } else if (mbills.length > 0) {
      const allSettled = mbills.every(b => b.status === 'paid' || b.status === 'confirmed');
      s7_status = allSettled ? 'completed' : 'active';
    }

    // Step 8: Complete
    const mandatorySteps = [s1_status, s2_status, s3_status, s4_status, s5_status, s6_status, s7_status];
    const isFullComplete = mandatorySteps.every(st => st === 'completed' || st === 'skipped');
    const s8_status = isFullComplete ? 'completed' : 'pending';

    return [
      { id: 'apt_done', label: 'Apt', status: s1_status },
      { id: 'consult', label: 'Consult', status: s2_status },
      { id: 'rx_made', label: 'Rx', status: s3_status },
      { id: 'lab', label: 'Lab', status: s4_status },
      { id: 'reverify', label: 'Verify', status: s5_status },
      { id: 'whatsapp', label: 'WhatsApp', status: s6_status },
      { id: 'pharmacy', label: 'Pharma', status: s7_status },
      { id: 'complete', label: 'Done', status: s8_status }
    ];
  }, [cachedEncountersMap, cachedLabReqsMap, cachedLabReportsMap, cachedWhatsAppPhoneMap, cachedMedicineBillsMap]);
  
  // Appointment Booking States
  const [searchApptPatient, setSearchApptPatient] = useState('');
  const [showAllApptPatients, setShowAllApptPatients] = useState(false);
  const [selectedApptPatient, setSelectedApptPatient] = useState<Patient | null>(null);
  const [apptPaymentMode, setApptPaymentMode] = useState<'cash' | 'upi' | 'razorpay' | 'cashfree' | 'paytm'>('cash');
  const [isBookingAppt, setIsBookingAppt] = useState(false);

  // Multi-Field Intelligent Patient Search Matcher
  const cleanApptQuery = (searchApptPatient || '').trim().toLowerCase();
  const cleanApptDigits = (searchApptPatient || '').replace(/\D/g, '');

  const filteredApptPatients = useMemo(() => {
    if (!cleanApptQuery) {
      return patients;
    }
    return patients.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(cleanApptQuery);
      const idMatch = (p.id || '').toLowerCase().includes(cleanApptQuery);
      const codeMatch = (p.patientCode || (p as any).patient_code || '').toLowerCase().includes(cleanApptQuery);
      const abhaMatch = (p.abhaId || (p as any).abha_id || '').toLowerCase().includes(cleanApptQuery);
      const tokenMatch = (p.tokenNumber && String(p.tokenNumber).toLowerCase().includes(cleanApptQuery)) ||
                         ((p as any).token_number && String((p as any).token_number).toLowerCase().includes(cleanApptQuery));
      
      const rawPhone = (p.phone || (p as any).patient_phone || '').toLowerCase();
      const phoneDigits = rawPhone.replace(/\D/g, '');
      const phoneMatch = rawPhone.includes(cleanApptQuery) || (cleanApptDigits.length > 0 && phoneDigits.includes(cleanApptDigits));

      return nameMatch || idMatch || codeMatch || abhaMatch || tokenMatch || phoneMatch;
    });
  }, [patients, cleanApptQuery, cleanApptDigits]);

  // 1-Click Professional Past Appointments CSV Export
  const handleDownloadPastAppointmentsCsv = useCallback(() => {
    const todayStr = getIstDateString();
    const pastAppts = appointments.filter(a => {
      if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
      const apptDate = getEffectiveAppointmentDate(a);
      return Boolean(apptDate && apptDate < todayStr) || a.status === 'completed';
    }).sort((a, b) => {
      const dateA = getEffectiveAppointmentDate(a);
      const dateB = getEffectiveAppointmentDate(b);
      return dateB.localeCompare(dateA);
    });

    if (pastAppts.length === 0) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { title: 'No Past Records', message: 'There are no past appointment records available for export.', type: 'info' }
      }));
      return;
    }

    const headers = ['Token #', 'Patient Name', 'Phone', 'Age', 'Gender', 'Appointment Date', 'Time Slot', 'Consult Mode', 'Doctor', 'Status', 'Fee Clearance'];
    const rows = pastAppts.map((appt, idx) => {
      const p = patients.find(pt => pt.id === (appt.patientId || (appt as any).patient_id));
      const pName = (appt.patientName || p?.name || 'Patient').replace(/"/g, '""');
      const pPhone = appt.patientPhone || p?.phone || '';
      const pAge = p?.age || (appt as any).patientAge || '';
      const pGender = p?.gender || (appt as any).patientGender || '';
      const apptDate = getEffectiveAppointmentDate(appt) || (appt.createdAt || '').split('T')[0];
      const slot = appt.virtual_time || (appt as any).virtualTime || 'Standard OPD';
      const mode = (appt.is_virtual || appt.isVirtual) ? 'Virtual Video' : 'Physical Chamber';
      const doctor = (activePod?.doctor_name || 'Dr. Attending Physician').replace(/"/g, '""');
      const status = appt.status === 'completed' ? 'Completed' : 'Seen / Archived';
      const fee = appt.amount === 0 ? 'Waived / Free' : 'Cleared (₹500.00)';
      const rawToken = appt.token_number || appt.tokenNumber || (appt as any).token || `TK-${String(idx + 1).padStart(2, '0')}`;

      return [
        `"${rawToken}"`,
        `"${pName}"`,
        `"${pPhone}"`,
        `"${pAge}"`,
        `"${pGender}"`,
        `"${apptDate}"`,
        `"${slot}"`,
        `"${mode}"`,
        `"${doctor}"`,
        `"${status}"`,
        `"${fee}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mediflow_past_appointments_${getIstDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: { title: 'Export Downloaded 📥', message: `Exported ${pastAppts.length} past appointment records to CSV.`, type: 'success' }
    }));
  }, [appointments, patients, activePod]);

  // Vernacular Dosage Assistant States
  const [selectedLanguage, setSelectedLanguage] = useState<'hindi' | 'bhojpuri'>('hindi');
  const [dosageTemplate, setDosageTemplate] = useState<'od' | 'bd' | 'tds' | 'sos'>('od');

  const fetchLiveAppointments = useCallback(async () => {
    try {
      const podId = getPodContext().podId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
      let apptQuery = supabase
        .from('appointments')
        .select('*')
        .order('created_at', { ascending: false });

      if (podId && podId !== 'default-pod') {
        apptQuery = apptQuery.or(`pod_id.eq.${podId},pod_id.eq.dfb2a1a8-8e68-4f8a-929e-4a6c8e317001`);
      }

      let patQuery = supabase
        .from('patient_registry')
        .select('*')
        .order('created_at', { ascending: false });
      if (podId && podId !== 'default-pod') {
        patQuery = patQuery.or(`pod_id.eq.${podId},pod_id.eq.dfb2a1a8-8e68-4f8a-929e-4a6c8e317001`);
      }

      const [apptRes, patRes] = await Promise.all([apptQuery, patQuery]);

      const patMap = new Map<string, any>();
      if (patRes.data && patRes.data.length > 0) {
        patRes.data.forEach((p: any) => {
          if (p.id) patMap.set(p.id, p);
        });
        const localPatients = api.getPatients();
        const mergedMap = new Map<string, Patient>();
        localPatients.forEach(p => mergedMap.set(p.id, p));
        patRes.data.forEach((dbP: any) => {
          const existing = mergedMap.get(dbP.id);
          mergedMap.set(dbP.id, {
            ...(existing || {}),
            id: dbP.id,
            name: dbP.name || (existing?.name) || 'Patient',
            phone: dbP.phone || (existing?.phone) || '',
            age: dbP.age || (existing?.age) || 30,
            gender: dbP.gender || (existing?.gender) || 'Male',
            patientCode: dbP.patient_code || dbP.patientCode || existing?.patientCode,
            abhaId: dbP.abha_id || dbP.abhaId || existing?.abhaId,
            vitals: dbP.vitals || existing?.vitals,
            queueStatus: dbP.queue_status || dbP.queueStatus || existing?.queueStatus || 'registered',
            tokenNumber: dbP.token_number || dbP.tokenNumber || existing?.tokenNumber,
            registeredAt: dbP.created_at || (existing as any)?.registeredAt || (existing as any)?.createdAt
          } as any);
        });
        const mergedList = Array.from(mergedMap.values());
        setPatients(mergedList);
        api.savePatients(mergedList);
      } else {
        setPatients(api.getPatients());
      }

      if (apptRes.data && apptRes.data.length > 0) {
        const mapped = apptRes.data.map((a: any) => {
          const patInfo = patMap.get(a.patient_id) || {};
          const resolvedToken = String(a.token_number || patInfo.token_number || (a as any).tokenNumber || (patInfo as any).token || 'T-01');
          const resolvedName = patInfo.name || (a.patient_name && a.patient_name !== 'Patient' ? a.patient_name : 'WhatsApp Patient');
          const resolvedPhone = patInfo.phone || a.patient_phone || '';
          const apptDate = getEffectiveAppointmentDate(a);
          return {
            id: a.id,
            patientId: a.patient_id,
            patient_id: a.patient_id,
            doctorId: a.doctor_id,
            doctor_id: a.doctor_id,
            status: a.status || 'scheduled',
            isVirtual: a.is_virtual === true,
            is_virtual: a.is_virtual === true,
            date: apptDate,
            virtualDate: a.virtual_date || apptDate,
            virtual_date: a.virtual_date || apptDate,
            appointmentDate: apptDate,
            appointment_date: apptDate,
            virtualTime: a.virtual_time || '10:00 AM',
            virtual_time: a.virtual_time || '10:00 AM',
            virtualMeetingUrl: a.virtual_meeting_url,
            virtual_meeting_url: a.virtual_meeting_url,
            tokenNumber: resolvedToken,
            token_number: resolvedToken,
            source: a.source || (a.is_virtual ? 'whatsapp_virtual' : 'whatsapp_physical'),
            patientName: resolvedName,
            patient_name: resolvedName,
            patientPhone: resolvedPhone,
            patient_phone: resolvedPhone,
            patientAge: patInfo.age || 30,
            patientGender: patInfo.gender || 'Male',
            createdAt: a.created_at || a.appointment_time || new Date().toISOString(),
            created_at: a.created_at || a.appointment_time || new Date().toISOString(),
            appointmentTime: a.appointment_time,
            appointment_time: a.appointment_time
          };
        });
        const localAppts = api.getAppointments();
        const mergedApptsMap = new Map();
        localAppts.forEach(la => mergedApptsMap.set(la.id, la));
        mapped.forEach(ma => mergedApptsMap.set(ma.id, ma));
        const mergedApptsList = Array.from(mergedApptsMap.values());
        setAppointments(mergedApptsList as any);
        BillingService.saveAppointments(mergedApptsList as any);
      }
    } catch (err) {
      console.warn('[CompounderDashboard] Error fetching live appointments:', err);
    }
  }, []);

  useEffect(() => {
    const handleCompounderTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail as any);
      }
    };
    window.addEventListener('mediflow-compounder-tab-changed', handleCompounderTabChange);
    return () => window.removeEventListener('mediflow-compounder-tab-changed', handleCompounderTabChange);
  }, []);

  // Keyboard shortcut listener to close vitals modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && vitalsPatient) {
        setVitalsPatient(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vitalsPatient]);

  useEffect(() => {
    fetchLiveAppointments();
    const handleFocus = () => fetchLiveAppointments();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
    const interval = setInterval(fetchLiveAppointments, 4000);
    const unsubscribe = RealtimeSyncService.subscribeToLiveClinicUpdates({
      onAppointmentChange: (payload) => {
        console.log('[CompounderDashboard] Realtime Appointment update:', payload);
        fetchLiveAppointments();
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: '📅 NEW APPOINTMENT BOOKED! 🟢',
            message: 'A patient has booked a physical or virtual visit on WhatsApp.',
            type: 'info'
          }
        }));
      },
      onPatientChange: () => fetchLiveAppointments(),
      onMedicineBillChange: () => fetchLiveAppointments(),
      onLabRequisitionChange: () => fetchLiveAppointments(),
      onFinancialLedgerChange: () => fetchLiveAppointments(),
      onUnifiedInvoiceChange: () => fetchLiveAppointments(),
      onWhatsAppSessionChange: () => fetchLiveAppointments(),
      onPathologyReportChange: () => fetchLiveAppointments(),
      onPoolSettlementChange: () => fetchLiveAppointments(),
      onClinicSopChange: () => fetchLiveAppointments(),
      onSaaSInvoiceChange: () => fetchLiveAppointments(),
      onSaaSPrescriptionChange: () => fetchLiveAppointments(),
      onInventoryHoldChange: () => fetchLiveAppointments(),
      onChronicCohortChange: () => fetchLiveAppointments()
    });

    return () => unsubscribe();
  }, [fetchLiveAppointments]);
  
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
  const [bloodGroupInput, setBloodGroupInput] = useState('');
  const [whatsAppInput, setWhatsAppInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Previous report scan states
  const [isReportScanning, setIsReportScanning] = useState(false);
  const [reportScanLogs, setReportScanLogs] = useState<string[]>([]);

  // Selected patient to initiate loop
  const [activeSession, setActiveSession] = useState<WhatsAppSession | null>(null);

  // Chat simulator input & scroll states
  const [replyInput, setReplyInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    setIsAtBottom(distanceFromBottom <= 30);
  };

  // Clinic Staff State
  const [staffList, setStaffList] = useState<ClinicStaff[]>([]);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'compounder' | 'receptionist' | 'admin'>('compounder');

  // Pathology uploads state
  const [reports, setReports] = useState<PathologyReport[]>([]);


  // Lab reports state
  const [fullLabReports, setFullLabReports] = useState<LabReport[]>([]);
  const [reportFilterTab, setReportFilterTab] = useState<'pending' | 'approved'>('pending');

  // Prescription Dispatch states
  const [dispatchFile, setDispatchFile] = useState<File | null>(null);
  const [dispatchPreviewUrl, setDispatchPreviewUrl] = useState<string>('');
  const [isDispatchOcrParsing, setIsDispatchOcrParsing] = useState(false);
  const [dispatchPatientName, setDispatchPatientName] = useState('');
  const [dispatchPatientAge, setDispatchPatientAge] = useState('');
  const [dispatchPatientGender, setDispatchPatientGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dispatchPatientPhone, setDispatchPatientPhone] = useState('');
  const [dispatchSelectedTestCode, setDispatchSelectedTestCode] = useState('');
  const [isDispatchingToLab, setIsDispatchingToLab] = useState(false);
  const [dispatchOcrLogs, setDispatchOcrLogs] = useState<string[]>([]);

  // Lab Billing states
  const [labPaymentMode, setLabPaymentMode] = useState<'cash' | 'upi' | 'whatsapp_pay'>('upi');
  const [labDiscountPercent, setLabDiscountPercent] = useState<number>(0);

  // Report approval states
  const [reportRevisitDates, setReportRevisitDates] = useState<Record<string, string>>({});
  const [reportRevisitTimes, setReportRevisitTimes] = useState<Record<string, string>>({});
  const [reportRevisitNotes, setReportRevisitNotes] = useState<Record<string, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [showRejectModalForId, setShowRejectModalForId] = useState<string | null>(null);

  // ─── PHARMACY BILLING STATES ──────────────────────────────────────────────
  const [activeInventory, setActiveInventory] = useState<PharmacyInventoryItem[]>([]);
  const [billingPatient, setBillingPatient] = useState<Patient | null>(null);
  const [billingItems, setBillingItems] = useState<MedicineBillItem[]>([]);
  const [customDiscountPercent, setCustomDiscountPercent] = useState<number>(0);
  
  // Search & add manual medicine in billing
  const [medSearchQuery, setMedSearchQuery] = useState('');
  
  // Loyalty & delivery transaction helpers
  const [apptCounterBooked, setApptCounterBooked] = useState(false);
  const [labCounterBooked, setLabCounterBooked] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'shiprocket'>('pickup');

  // ── Evening Slot States ──────────────────────────────────────────────────
  const [eveningSlot, setEveningSlot] = useState<EveningSlot | null>(null);
  const [isAllocatingSlot, setIsAllocatingSlot] = useState(false);
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
    setDataRevision(prev => prev + 1);
    setPatients(api.getPatients());
    setSessions(api.getWhatsAppSessions());
    setStaffList(api.getClinicStaff());
    setActiveStaffId(api.getActiveStaffId());
    setReports(api.getPathologyReports());
    setActiveInventory(api.getPharmacyInventory());
    setFullLabReports(api.getFullLabReports());
    setAppointments(api.getAppointments());

    const activePat = api.getActivePatient();
    setActivePatientState(activePat);
    if (activePat) {
      setActivePatientStage(api.getActivePatientCareStage(activePat.id));
      setBillingPatient(activePat);
    } else {
      setActivePatientStage('registered');
      setBillingPatient(null);
    }

    setActiveSession((prev: WhatsAppSession | null) => {
      if (!prev) return null;
      const fresh = api.getWhatsAppSessions().find(s => s.patientPhone === prev.patientPhone);
      return fresh || null;
    });
  }, []);

  useEffect(() => {
    syncData();
    return api.subscribe(syncData);
  }, [syncData]);

  // Auto-refresh every 60 seconds so the dilation countdown timer ticks down
  // without requiring a manual user interaction or page reload
  useEffect(() => {
    const dilationRefreshInterval = setInterval(() => {
      syncData();
    }, 60_000);
    return () => clearInterval(dilationRefreshInterval);
  }, [syncData]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
      setIsAtBottom(true);
    }
  }, [activeSession?.patientPhone]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container && isAtBottom) {
      const scrollTimer = setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
      return () => clearTimeout(scrollTimer);
    }
  }, [activeSession?.sessionData?.chatHistory, isAtBottom]);

  // Auto-focus active patient in vitals intake form if they do not have vitals recorded yet
  useEffect(() => {
    if (activePatient && !activePatient.vitals && !vitalsPatient) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.style.overflow = 'hidden';
      setVitalsPatient(activePatient);
    }
    return () => { document.body.style.overflow = ''; };
  }, [activePatient, vitalsPatient]);

  // Load existing vitals into form fields & lock body scroll when vitalsPatient changes
  useEffect(() => {
    if (vitalsPatient) {
      document.body.style.overflow = 'hidden';

      if (vitalsPatient.vitals) {
        const rawTemp = vitalsPatient.vitals.temperature || '';
        const rawBp = vitalsPatient.vitals.bloodPressure || '';
        const rawPulse = vitalsPatient.vitals.pulseRate || '';
        const rawWeight = vitalsPatient.vitals.weight || '';
        const rawSugar = vitalsPatient.vitals.bloodSugar || '';

        setTempVal(rawTemp || '98.6');
        setBpVal(rawBp || '120/80');
        setPulseVal(rawPulse || '72');
        setWeightVal(rawWeight || '65');
        setSugarVal(rawSugar || '');
      } else {
        setTempVal('98.6');
        setBpVal('120/80');
        setPulseVal('72');
        setWeightVal('65');
        setSugarVal('');
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [vitalsPatient, isOphthalmology]);

  // Auto-focus active patient in Revisit Scheduler & Reset draft report summary
  useEffect(() => {
    if (activePatient) {
      setRevisitPatientId(activePatient.id);
    }
    setScannedSummary(null);
  }, [activePatient?.id]);

  // Clean up body scroll lock when modal viewers open/close
  useEffect(() => {
    if (viewingDocUrl || activeWorkflowDetail) {
      document.body.style.overflow = 'hidden';
    } else if (!vitalsPatient) {
      document.body.style.overflow = '';
    }
    return () => {
      if (!vitalsPatient) {
        document.body.style.overflow = '';
      }
    };
  }, [viewingDocUrl, activeWorkflowDetail, vitalsPatient]);

  // Sync loyalty checkboxes when billing patient changes
  useEffect(() => {
    if (billingPatient) {
      const txs = api.getCounterTransactions();
      const todayStr = getIstDateString();
      const existingTx = txs.find(t => t.patientId === billingPatient.id && (t.createdAt || '').startsWith(todayStr));
      
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

    const generateUUID = () => {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    };

    const newPatientId = generateUUID();
    const registered = api.registerPatient({
      id: newPatientId,
      name,
      phone,
      age: Number(age),
      gender,
      allergies: allergiesInput.split(',').map(s => s.trim()).filter(Boolean),
      chronicConditions: chronicInput.split(',').map(s => s.trim()).filter(Boolean),
      abhaId: abhaId || undefined,
      vitals: bloodGroupInput ? {
        temperature: '',
        bloodPressure: '',
        pulseRate: '',
        bloodGroup: bloodGroupInput,
        recordedAt: new Date().toISOString()
      } as any : undefined,
      whatsApp: whatsAppInput || phone
    } as any);

    // Auto-create consultation appointment & invoice (₹500.00) in status 'pending_payment'
    api.createGate1Consult(registered.id, 'counter');

    // Update patients state & sync across components
    setPatients(api.getPatients());
    api.setActivePatient(registered);
    setBillingPatient(registered);
    setSelectedApptPatient(registered);
    setActiveTab('opd_patients');
    setOpdSubTab('today_queue');
    syncData();
    fetchLiveAppointments();

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Registered & Dispatched ${name} to Payment Counter. Please collect ₹500.00 (Cash / UPI QR) to confirm appointment.`,
        type: 'success',
        title: 'Patient Registered — Collect Payment'
      }
    }));

    setName('');
    setPhone('');
    setAge('');
    setGender('Male');
    setAllergiesInput('');
    setChronicInput('');
    setAbhaId('');
    setBloodGroupInput('');
    setWhatsAppInput('');
  };

  const handleRecordVitalsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vitalsPatient) return;

    // Strict Cashfree Payment Gate Check (USP 3 & Rule 3): Verify consultation fee is cleared before token dispatch
    const unifiedInvoices = BillingService.getInvoices();
    const saasInvoices = load<any[]>('saas_invoices', []);
    const allInvoices = [...unifiedInvoices, ...saasInvoices];

    const isPaidInvoice = allInvoices.some(i => 
      (i.patientId === vitalsPatient.id || i.patient_id === vitalsPatient.id) && 
      ((i as any).paymentStatus === 'cleared' || (i as any).paymentStatus === 'paid' || (i as any).status === 'paid' || (i as any).status === 'cleared')
    );
    const appts = api.getAppointments();
    const hasPaidAppt = appts.some(a => 
      (a.patientId === vitalsPatient.id || (a as any).patient_id === vitalsPatient.id) && 
      a.status !== 'pending_payment'
    );

    if (!isPaidInvoice && !hasPaidAppt) {
      // Auto-create pending appointment if not existing yet
      api.createGate1Consult(vitalsPatient.id, 'counter');
      setBillingPatient(vitalsPatient);
      setSelectedApptPatient(vitalsPatient);
      setActiveTab('opd_patients');
      setOpdSubTab('today_queue');
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `⚠️ Consultation Fee Pending: Please collect ₹500.00 at the Payment Counter before dispatching ${vitalsPatient.name} to Doctor's chamber.`,
          type: 'error',
          title: 'Payment Required'
        }
      }));
      setVitalsPatient(null);
      return;
    }

    const recordedToken = vitalsPatient.tokenNumber || api.generateNextTokenNumber();

    api.updatePatientVitalsAndToken(vitalsPatient.id, {
      temperature: tempVal,
      bloodPressure: bpVal,
      pulseRate: pulseVal,
      weight: weightVal,
      bloodSugar: sugarVal || undefined,
      recordedAt: new Date().toISOString()
    }, recordedToken);

    if (vitalsPatient.phone) {
      api.dispatchAppointmentTimingGreetingWhatsApp({
        patientPhone: vitalsPatient.phone,
        patientName: vitalsPatient.name,
        tokenNumber: String(recordedToken),
        appointmentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        doctorName: activePod?.doctor_name,
        clinicName: activePod?.name,
        mode: 'physical'
      }).catch(err => console.warn('[CompounderDashboard] Timing greeting error:', err));
    }

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Vitals pre-loaded successfully for patient ${vitalsPatient.name}! Dispatched Token: ${recordedToken} to Doctor's chamber & WhatsApp confirmed. 🩺`,
        type: 'success',
        title: 'Swasthya Token Dispatched'
      }
    }));

    // Reset Form
    document.body.style.overflow = '';
    setVitalsPatient(null);
    setTempVal('98.6');
    setBpVal('120/80');
    setPulseVal('72');
    setWeightVal('65');
    setSugarVal('');

    syncData();
    fetchLiveAppointments();
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
    setIsChatDrawerOpen(true);
    
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
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Missing Required Fields',
          message: 'Please fill out patient name, test name, and patient ID.',
          type: 'error'
        }
      }));
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



  // Add item manually to bill
  const handleSelectMedForBilling = (med: PharmacyInventoryItem) => {
    // Check if already in billing items
    const exists = billingItems.find(i => i.inventoryItemId === med.id);
    if (exists) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Already Added',
          message: 'This medicine batch is already added to checkout.',
          type: 'warning'
        }
      }));
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
      (inv.genericName || '').toLowerCase() === (item.genericName || '').toLowerCase() &&
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
        message: `Switched brand to cheaper alternative: ${alt.name} (Saved ₹${((billingItems[itemIdx]?.sellingPrice || 0) - (alt.price || 0)).toFixed(2)} per unit!)`,
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
    const loyaltyDiscountPercent = customDiscountPercent || (isLoyaltyEligible ? 10 : 0);
    
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
  }, [billingItems, apptCounterBooked, labCounterBooked, deliveryType, customDiscountPercent]);

  // Dispatch bill through API
  const handleGenerateInvoice = async (mode: 'whatsapp' | 'cash') => {
    if (!billingPatient || billingItems.length === 0) return;

    const pharmacyGstin = podEntities.find(pe => pe.entityType === 'pharmacy' && pe.status === 'approved')?.gstin;
    const billId = `bill-${Date.now()}`;
    const bill: MedicineBill = {
      id: billId,
      patientId: billingPatient.id,
      patientName: billingPatient.name,
      patientPhone: billingPatient.phone,
      pharmacyGstin: pharmacyGstin,
      items: billingItems,
      subtotal: billingTotals.subtotal,
      loyaltyDiscountPercent: billingTotals.loyaltyDiscountPercent,
      loyaltyDiscountAmount: billingTotals.loyaltyDiscountAmount,
      itemDiscountAmount: billingTotals.itemDiscountAmount,
      gstAmount: billingTotals.gstAmount,
      totalAmount: billingTotals.totalAmount,
      paymentMode: mode === 'whatsapp' ? 'whatsapp_pay' : 'cash',
      upiQrPayload: PaymentService.generateDirectUpiPayload(billingTotals.totalAmount || 0, billId).upiDeepLink,
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

      // Build dosage invoice text using getBilingualInstruction() for each item
      let dosageInvoiceText = `📋 *दवाई की खुराक की जानकारी (Bilingual Dosage Slip)*\n\nनमस्ते, यहाँ आपकी दवाइयों की खुराक की जानकारी हिंदी/Hinglish में है:\n\n`;
      bill.items.forEach((item, idx) => {
        const instr = getBilingualInstruction(item.name, item.dosage);
        dosageInvoiceText += `💊 *${item.name}* (${item.dosage || '1 Tab'})\n`;
        dosageInvoiceText += `👉 *Directions:* ${instr.english}\n`;
        dosageInvoiceText += `👉 *खुराक:* ${instr.hindi}\n\n`;
      });
      dosageInvoiceText += `Dhyan rakhein aur time par medicine lein! 🟢`;

      // ── Append same-day evening appointment info ────────────────────────
      const activeDocName = activePod?.doctor_name || 'Doctor';
      const apptSlot = eveningSlot || api.getAppointmentByPatient(billingPatient.id);
      if (apptSlot) {
        dosageInvoiceText += `\n\n🕒 *Doctor Follow-up (Aaj Shaam):*\n${activeDocName} aapko aaj *${apptSlot.startTime}* se *${apptSlot.endTime}* ke beech dekhenge.\nKrupaya 5 minute pehle clinic pahunchen.`;
      } else {
        // Auto-allocate slot for this patient if none exists
        try {
          const newSlot = await api.createEveningSlot(billingPatient.id, 'doc-1');
          if (newSlot) {
            setEveningSlot(newSlot);
            dosageInvoiceText += `\n\n🕒 *Doctor Follow-up (Aaj Shaam):*\n${activeDocName} aapko aaj *${newSlot.startTime}* se *${newSlot.endTime}* ke beech dekhenge.\nKrupaya 5 minute pehle clinic pahunchen.`;
          }
        } catch (slotErr) {
          console.warn('[EveningSlot] Compounder slot auto-allocation failed:', slotErr);
        }
      }

      api.pushWhatsAppMessageFromBot(billingPatient.phone, dosageInvoiceText);
      api.pushWhatsAppMessageFromBot(billingPatient.phone, invoiceText);
      
      // Update session state to MEDICINE_AWAITING_PAYMENT
      const updatedSessions = api.getWhatsAppSessions();
      const updatedSession = updatedSessions.find(s => s.patientPhone === billingPatient.phone) || session;

      api.updateWhatsAppState(billingPatient.phone, 'MEDICINE_AWAITING_PAYMENT', {
        chatHistory: updatedSession.sessionData.chatHistory || [],
        draftMedicineBill: bill
      });

      // Jump simulator focus
      handleInitiateWhatsAppLoop(billingPatient);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Invoice & bilingual dosage generated & pushed to +91 ${billingPatient.phone} on WhatsApp! Sandbox auto-focused.`,
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
      ((inv.name || '').toLowerCase().includes(medSearchQuery.toLowerCase()) ||
       (inv.genericName || '').toLowerCase().includes(medSearchQuery.toLowerCase())) &&
      inv.stock > 0
    );
  }, [activeInventory, medSearchQuery]);

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return patients.filter(p => 
      (p.name || '').toLowerCase().includes(query) || 
      (p.phone || '').includes(query) ||
      (p.patientCode && String(p.patientCode).toLowerCase().includes(query)) ||
      (p.tokenNumber && String(p.tokenNumber).toLowerCase().includes(query)) ||
      (p.abhaId && p.abhaId.includes(query))
    );
  }, [patients, searchQuery]);

  const assignFilteredPatients = useMemo(() => {
    const query = assignSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return patients.filter(p => 
      (p.name || '').toLowerCase().includes(query) || 
      (p.phone || '').includes(query) ||
      (p.patientCode && String(p.patientCode).toLowerCase().includes(query)) ||
      (p.tokenNumber && String(p.tokenNumber).toLowerCase().includes(query)) ||
      (p.abhaId && p.abhaId.includes(query))
    );
  }, [patients, assignSearchQuery]);

  const handleQuickRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRegName.trim() || !quickRegPhone.trim() || !quickRegAge) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Incomplete Registration',
          message: 'Please fill in Name, Phone, and Age.',
          type: 'error'
        }
      }));
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

    // Auto-create consultation appointment & invoice (₹500.00) in status 'pending_payment'
    api.createGate1Consult(registered.id, 'counter');

    // Refresh clinical lists
    setPatients(api.getPatients());
    api.setActivePatient(registered);
    setBillingPatient(registered);
    setSelectedApptPatient(registered);
    setActiveTab('opd_patients');
    setOpdSubTab('today_queue');

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Registered & Dispatched: ${quickRegName.trim()} to Payment Counter. Please collect ₹500.00 (Cash / UPI QR).`,
        type: 'success',
        title: 'Patient Registered — Collect Payment'
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

  const handlePreviousReportScan = async (file: File) => {
    if (!activePatient) return;
    setIsReportScanning(true);
    setReportScanLogs([
      `[${new Date().toLocaleTimeString()}] Accessing previous health records archive...`,
      `[${new Date().toLocaleTimeString()}] Uploading file to Clinical OCR parser...`
    ]);

    try {
      // 1. Run live OCR scan via FastAPI backend
      const ocrResult = await api.ocrScan(file);
      setReportScanLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] OCR Success: Document text parsed.`,
        `[${new Date().toLocaleTimeString()}] Structuring biomarkers...`,
        `[${new Date().toLocaleTimeString()}] Dispatching biomarkers to Gemini CDSS comparative engine...`
      ]);

      // Parse biomarkers from OCR structured data
      const hba1cStr = ocrResult.structured_data?.HbA1c || ocrResult.structured_data?.hba1c || '7.8';
      const creatinineStr = ocrResult.structured_data?.Creatinine || ocrResult.structured_data?.creatinine || '1.4';
      const hemoglobinStr = ocrResult.structured_data?.Hemoglobin || ocrResult.structured_data?.hemoglobin || '11.2';
      
      const current_data = {
        age: activePatient.age.toString(),
        gender: activePatient.gender,
        HbA1c: parseFloat(hba1cStr.toString().replace(/[^0-9.]/g, '')) || 7.8,
        creatinine: parseFloat(creatinineStr.toString().replace(/[^0-9.]/g, '')) || 1.4,
        hemoglobin: parseFloat(hemoglobinStr.toString().replace(/[^0-9.]/g, '')) || 11.2
      };

      // 2. Query `/api/lab-trend` via the labTrend service
      const trendResult = await api.labTrend({ current_data });
      
      // Update scanned summary with analysis text
      setScannedSummary(trendResult.analysis);

      setReportScanLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] SUCCESS: Longitudinal report mapped successfully! [OK]`
      ]);
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: 'Previous report parsed by AI. Please review the draft summary below to save & submit.',
          type: 'success',
          title: 'Longitudinal Summary Parsed'
        }
      }));
    } catch (err: any) {
      console.error(err);
      setReportScanLogs(prev => [...prev, `[ERROR] OCR/Analysis failed: ${err?.message || err}`]);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: 'Failed to scan and analyze previous report.',
          type: 'error',
          title: 'Scan Error'
        }
      }));
    } finally {
      setIsReportScanning(false);
    }
  };

  return (
    <div 
      className="max-w-7xl mx-auto p-2 sm:p-4 md:p-8 pb-32 md:pb-12 space-y-6 sm:space-y-8 animate-fade-in bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-clinical-950 dark:to-indigo-950/20 text-slate-800 dark:text-clinical-100 min-h-screen transition-colors duration-300"
      style={{ paddingTop: 'env(safe-area-inset-top, 16px)' }}
    >
      {/* Ambient Background Glow for visual hierarchy */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

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

      {/* ── DESKTOP HEADER (Hidden on mobile to prevent duplicate headers with global navbar) ──────────── */}
      <div className="hidden md:flex items-center justify-between gap-2 px-3 py-2.5 bg-white/95 dark:bg-clinical-900/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/5 mb-3 md:mb-4 sticky top-0 z-20 md:mx-0 md:rounded-2xl md:border md:shadow-xs">
        {/* Left: Icon + Clinic name + live status */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/25">
            <Stethoscope className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-extrabold text-slate-900 dark:text-white truncate leading-tight">
              {clinicTitle}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isOnline ? 'Live' : 'Offline'} · {staffList.find(s => s.id === activeStaffId)?.staffName || 'Compounder'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Walk-In CTA */}
        <button
          type="button"
          onClick={() => setShowQuickAddSheet(true)}
          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-[10px] rounded-xl shadow-sm flex items-center gap-1 transition cursor-pointer border-0 shrink-0"
        >
          <UserPlus className="w-3 h-3" />
          + Walk-In
        </button>
      </div>

      {/* Desktop Tab Bar — hidden on mobile (handled by bottom nav) */}
      <div className="hidden md:flex overflow-x-auto gap-2 no-scrollbar select-none p-1.5 bg-slate-100/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-white/5 backdrop-blur-md mb-4">
        {[
          { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4 text-indigo-500" /> },
          { id: 'opd_patients', label: 'OPD & Patients', icon: <Users className="h-4 w-4 text-indigo-600" /> },
          { id: 'clinical_hub', label: isOphthalmology ? 'Biometry & Optical' : 'Labs & Pharmacy', icon: <FlaskConical className="h-4 w-4 text-teal-500" /> },
          { id: 'billing_daycare', label: isOphthalmology ? 'Billing & Daycare' : 'Billing & Minor OT', icon: <Receipt className="h-4 w-4 text-amber-500" /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-black flex items-center gap-2 whitespace-nowrap transition-all uppercase cursor-pointer rounded-xl ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT SPACES */}
      <div className="space-y-6">
        {/* ══════════════════════════════════════════════════════════
            TAB: OVERVIEW COCKPIT (MODERN MOBILE-FIRST HUB)
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-5 sm:space-y-6 animate-fade-in text-left">
            {/* 1. MODERN AESTHETIC TODAY'S DOCTOR APPOINTMENTS & OPD QUEUE WIDGET */}
            <div className="glass-panel p-4 sm:p-6 rounded-3xl border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/10 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/20 shadow-md">
              {/* Header with Title, Doctor Badge, Live OPD Counter & View All link */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-slate-200/80 dark:border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                        Today's Doctor Appointments
                      </h3>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 text-[10px] font-bold rounded-full shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {activeOpdAppointments.length} Active in Queue
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setActiveTab('opd_patients'); setOpdSubTab('today_queue'); }}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer border-0 bg-transparent py-1 transition group shrink-0"
                >
                  <span>View Full Queue ({activeOpdAppointments.length})</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Patient Queue Cards Stream */}
              {activeOpdAppointments.length === 0 ? (
                <div className="p-6 sm:p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20">
                  <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2 opacity-90 animate-pulse" />
                  <div className="text-sm font-bold text-slate-800 dark:text-white">OPD Appointments Queue is Clear</div>
                  <p className="text-xs text-slate-400 mt-1">No patients currently waiting in today's doctor consultation queue.</p>
                  <button
                    type="button"
                    onClick={() => setShowInstantAppointmentModal(true)}
                    className="mt-3.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer inline-flex items-center gap-1.5 active:scale-95 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Register Walk-In Patient
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeOpdAppointments.slice(0, 6).map((a) => {
                    const p = patients.find(pt => pt.id === a.patientId || pt.id === (a as any).patient_id);
                    const hasVitals = !!p?.vitals;
                    const src = String(a.source || (p as any)?.source || '').toLowerCase();
                    const isSOS = a.id === sosEmergencyAppointment?.id;
                    const isInConsult = a.status === 'in_consult';
                    const pid = p?.patientCode || (p as any)?.patient_code || ('PID-' + (p?.id || a.id).slice(0, 6).toUpperCase());

                    return (
                      <div
                        key={a.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 shadow-xs ${
                          isSOS
                            ? 'border-rose-300 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/30'
                            : isInConsult
                            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 ring-1 ring-emerald-500/20'
                            : 'border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-800/90 hover:border-indigo-300 dark:hover:border-indigo-700'
                        }`}
                      >
                        {/* Token Badge & Patient Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center text-white shrink-0 font-mono shadow-xs ${
                            isSOS
                              ? 'bg-rose-600 animate-pulse'
                              : isInConsult
                              ? 'bg-emerald-600'
                              : hasVitals
                              ? 'bg-indigo-600'
                              : 'bg-amber-500'
                          }`}>
                            <span className="text-[7.5px] font-bold uppercase opacity-80">TOKEN</span>
                            <span className="text-xs font-black -mt-0.5">#{String(a.tokenNumber || 'TK').replace(/\D/g, '').slice(-2) || '01'}</span>
                          </div>

                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                              <span className="truncate capitalize">{a.patientName}</span>
                              {src.includes('whatsapp') && <span className="text-[8.5px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">🟢 WA</span>}
                              {src.includes('qr') && <span className="text-[8.5px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded font-bold">📲 QR</span>}
                              {isSOS && <span className="text-[8.5px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-1.5 py-0.2 rounded font-bold">🚨 SOS</span>}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5 flex items-center gap-1.5">
                              <span className="font-mono font-semibold">ID: {pid}</span>
                              <span>·</span>
                              <span>
                                {p && (p.age || p.gender)
                                  ? `${p.age ? p.age + 'y' : ''}${p.age && p.gender ? ' · ' : ''}${p.gender || ''}`
                                  : (a.patientPhone ? '+91 ' + String(a.patientPhone).replace(/\D/g, '').slice(-10) : 'Walk-in')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Status Button */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!hasVitals ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (p) {
                                  setVitalsPatient(p);
                                  setShowVitalsBottomSheet(true);
                                }
                              }}
                              className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[11px] font-bold rounded-xl transition cursor-pointer border-0 flex items-center gap-1 shadow-xs"
                            >
                              <Activity className="w-3 h-3" />
                              <span>+ Vitals</span>
                            </button>
                          ) : isInConsult ? (
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              In Chamber 🩺
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCallPatientChamber(a.patientName || 'Patient', a.tokenNumber || 'Next')}
                              className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] font-bold rounded-xl transition cursor-pointer border-0 flex items-center gap-1 shadow-xs"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>Call Token</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. THUMB-FRIENDLY QUICK ACTION BENTO GRID */}
            <div className="glass-panel p-4 sm:p-5 rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm">
              <h3 className="text-xs font-extrabold tracking-tight text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Quick Clinical Actions
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowInstantAppointmentModal(true)}
                  className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-indigo-100/50 dark:from-indigo-950/40 dark:to-indigo-900/20 border border-indigo-200/80 dark:border-indigo-800/60 hover:scale-[1.02] active:scale-95 transition text-left flex flex-col justify-between cursor-pointer shadow-xs"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center mb-2.5 shadow-md shadow-indigo-500/25">
                    <Sparkles className="w-4 h-4 text-white animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      <span>Instant OPD Desk</span>
                      <span className="text-[8px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1 py-0.2 rounded font-mono font-bold">1-Click</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Fast Walk-In, Vitals &amp; Token</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowVitalsBottomSheet(true)}
                  className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/60 hover:scale-[1.02] active:scale-95 transition text-left flex flex-col justify-between cursor-pointer shadow-xs"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-2.5 shadow-md shadow-emerald-500/20">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Quick Vitals Intake</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">WhatsApp, QR &amp; BMI Pad</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBatchPrescriptionPrintModal(true)}
                  className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-blue-50/80 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 border border-blue-200/80 dark:border-blue-800/60 hover:scale-[1.02] active:scale-95 transition text-left flex flex-col justify-between cursor-pointer shadow-xs"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-2.5 shadow-md shadow-blue-500/20">
                    <Printer className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      <span>Print Rx Pads</span>
                      <span className="text-[8px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1 py-0.2 rounded font-mono font-bold">Batch</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Pre-filled Vitals &amp; Slips</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBillHubInitialMode('ocr_scan');
                    setBillingSubTab('ocr_scan');
                    setActiveTab('billing_daycare');
                  }}
                  className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-purple-50/80 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20 border border-purple-200/80 dark:border-purple-800/60 hover:scale-[1.02] active:scale-95 transition text-left flex flex-col justify-between cursor-pointer shadow-xs"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-2.5 shadow-md shadow-purple-500/20">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Scan Rx OCR</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">AI Prescription Parser</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBillHubInitialMode('manual_billing');
                    setBillingSubTab('billing');
                    setActiveTab('billing_daycare');
                  }}
                  className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/80 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200/80 dark:border-amber-800/60 hover:scale-[1.02] active:scale-95 transition text-left flex flex-col justify-between cursor-pointer shadow-xs"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center mb-2.5 shadow-md shadow-amber-500/20">
                    <Receipt className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">New Invoice</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Counter Billing &amp; UPI</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('clinical_hub');
                    setClinicalSubTab('labs');
                  }}
                  className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-teal-50/80 to-teal-100/50 dark:from-teal-950/40 dark:to-teal-900/20 border border-teal-200/80 dark:border-teal-800/60 hover:scale-[1.02] active:scale-95 transition text-left flex flex-col justify-between cursor-pointer shadow-xs"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center mb-2.5 shadow-md shadow-teal-500/20">
                    <FlaskConical className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Lab &amp; Pathology</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Requisitions &amp; Reports</div>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. EMERGENCY SOS PRIORITY SENTINEL (If Active) */}
            {sosEmergencyAppointment && (
              <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-600 via-red-600 to-orange-600 text-white rounded-3xl shadow-xl shadow-rose-600/30 border border-rose-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="px-2 py-0.5 bg-white text-rose-700 text-[10px] font-black uppercase tracking-wider rounded-full">
                      🚨 PRIORITY #1 EMERGENCY SOS ACTIVE
                    </span>
                    <h3 className="text-sm sm:text-base font-black mt-1">
                      {sosEmergencyAppointment.patientName || 'Emergency Patient'} (Token: #{sosEmergencyAppointment.tokenNumber})
                    </h3>
                    <p className="text-xs text-rose-100 font-mono">
                      Phone: +91 {sosEmergencyAppointment.patientPhone || 'Emergency'} · Surcharge: ₹618.00 Verified
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleCallPatientChamber(sosEmergencyAppointment.patientName || 'Emergency Patient', sosEmergencyAppointment.tokenNumber || 'SOS');
                    setActiveTab('opd_patients');
                    setOpdSubTab('today_queue');
                  }}
                  className="w-full md:w-auto px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-700 font-black text-xs rounded-xl shadow-md cursor-pointer transition border-0 uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Route to Doctor Chamber Now
                </button>
              </div>
            )}

            {/* 4. LAB REPORTS ARRIVED & EVENING REVIEW WIDGET */}
            <div className="w-full">
              <div className="glass-panel p-4 sm:p-5 rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      Lab Reports Arrived
                    </h3>
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 shadow-xs">
                      {arrivedLabReports.length} Reports Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3.5">
                    Instant biomarker alerts &amp; evening physical/video doctor follow-up review dispatcher.
                  </p>

                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {arrivedLabReports.map((req) => (
                      <div 
                        key={req.id}
                        className="p-3.5 rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-gradient-to-r from-purple-50/50 via-white to-indigo-50/30 dark:from-purple-950/30 dark:via-slate-900/90 dark:to-indigo-950/20 hover:border-purple-300 dark:hover:border-purple-700 transition shadow-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white">{req.patientName}</span>
                              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[9px] font-mono font-bold rounded-lg border border-purple-200/60 dark:border-purple-800">
                                #{(req.barcode || 'LAB').slice(-8)}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-purple-900 dark:text-purple-200">
                              {req.testName}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap pt-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                📊 {formatBiomarkerResult(req.quantitativeResult)}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                🕒 Evening Slot: {req.revisitScheduledAt ? new Date(req.revisitScheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '04:30 PM - 05:30 PM'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleSendLabReportWhatsApp(req)}
                              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-[11px] font-bold rounded-xl cursor-pointer transition border-0 flex items-center gap-1.5 shadow-sm"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>WhatsApp Alert</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('clinical_hub');
                                setClinicalSubTab('labs');
                              }}
                              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[11px] font-bold rounded-xl cursor-pointer transition border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 shadow-xs"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Worklist</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {arrivedLabReports.length === 0 && (
                      <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20">
                        <FlaskConical className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">No Arrived Reports Pending Review</div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Completed lab investigations will automatically appear here with 1-click WhatsApp alerts.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('clinical_hub');
                            setClinicalSubTab('labs');
                          }}
                          className="mt-3 px-3.5 py-1.5 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[11px] font-bold rounded-xl cursor-pointer inline-flex items-center gap-1.5 hover:bg-purple-100 transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Open Lab Requisition Worklist
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Specialization Station: Eye Dilation (Ophthalmology) vs Clinical Procedures & Triage (GP) */}
            <div className="w-full">
              {isOphthalmology ? (
                <div className="glass-panel p-5 rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <Eye className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        15-Min Eye Dilation Station
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          const candidate = patients.find(p => p.eyeDilationStatus !== 'in_progress');
                          if (candidate) setShowDilationModal(candidate);
                          else setShowQuickAddSheet(true);
                        }}
                        className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> Start Dilation
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                      Tropicamide &amp; Phenylephrine eye drop tracking with automated 15-minute countdown alert for Doctor Retinoscopy.
                    </p>

                    {activeDilationPatients.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                        <Timer className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">No Active Eye Dilations Running</div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Click '+ Start Dilation' when applying drops to patient.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {activeDilationPatients.map((p) => {
                          const elapsedSec = (currentTime.getTime() - new Date(p.dilationTimestamp!).getTime()) / 1000;
                          const remSec = Math.max(0, 900 - elapsedSec);
                          const remMin = Math.floor(remSec / 60);
                          const remSeconds = Math.floor(remSec % 60);
                          const isReady = remSec <= 0;

                          return (
                            <div 
                              key={p.id} 
                              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between shadow-xs ${
                                isReady
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-cyan-50/50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800/60'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">{p.name}</span>
                                  <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    Token #{p.tokenNumber || 'TK-01'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Drops given: Tropicamide + Phenylephrine (BE)
                                </div>
                              </div>

                              <div className="text-right">
                                {isReady ? (
                                  <span className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg shadow-sm">
                                    Ready for Fundus 👁️
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs font-bold font-mono text-cyan-700 dark:text-cyan-300">
                                    <Clock className="w-3.5 h-3.5 animate-spin" />
                                    <span>{String(remMin).padStart(2, '0')}:{String(remSeconds).padStart(2, '0')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* GENERAL CLINIC / GP / CARDIOLOGY / PEDIATRICS / DERMATOLOGY STATION */
                <div className="glass-panel p-5 rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Clinical Procedures &amp; Triage Station
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowVitalsBottomSheet(true)}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> Record Procedure
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                      Live monitoring for ongoing minor treatments: Nebulization, IV Infusions, Injections &amp; Wound Dressing.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 bg-gradient-to-br from-teal-50/80 to-teal-100/40 dark:from-teal-950/40 dark:to-teal-900/20 border border-teal-200/80 dark:border-teal-800/50 rounded-2xl shadow-xs">
                        <div className="flex items-center justify-between text-teal-800 dark:text-teal-300 mb-1.5">
                          <span className="text-[11px] font-bold">🫁 Nebulizer</span>
                          <span className="text-[9px] bg-teal-600 text-white font-mono px-1.5 py-0.2 rounded font-bold">15m</span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">Duolin / Budecort</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Triage Bed #1 Ready</div>
                      </div>

                      <div className="p-3.5 bg-gradient-to-br from-blue-50/80 to-blue-100/40 dark:from-blue-950/40 dark:to-blue-900/20 border border-blue-200/80 dark:border-blue-800/50 rounded-2xl shadow-xs">
                        <div className="flex items-center justify-between text-blue-800 dark:text-blue-300 mb-1.5">
                          <span className="text-[11px] font-bold">💧 IV Infusion</span>
                          <span className="text-[9px] bg-blue-600 text-white font-mono px-1.5 py-0.2 rounded font-bold">Flowing</span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">NS 500ml / RL</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Drip Stand Ready</div>
                      </div>

                      <div className="p-3.5 bg-gradient-to-br from-amber-50/80 to-amber-100/40 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl shadow-xs">
                        <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 mb-1.5">
                          <span className="text-[11px] font-bold">🩹 Wound Care</span>
                          <span className="text-[9px] bg-amber-600 text-white font-mono px-1.5 py-0.2 rounded font-bold">Clean</span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">Sterile Dressing</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Tray Sterilized</div>
                      </div>

                      <div className="p-3.5 bg-gradient-to-br from-indigo-50/80 to-indigo-100/40 dark:from-indigo-950/40 dark:to-indigo-900/20 border border-indigo-200/80 dark:border-indigo-800/50 rounded-2xl shadow-xs">
                        <div className="flex items-center justify-between text-indigo-800 dark:text-indigo-300 mb-1.5">
                          <span className="text-[11px] font-bold">💉 Injections</span>
                          <span className="text-[9px] bg-indigo-600 text-white font-mono px-1.5 py-0.2 rounded font-bold">IM/IV</span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">Diclo / Pantop / TT</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Counter Stocked</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: OPD QUEUE & PATIENTS (CONSOLIDATED)
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'opd_patients' && (
          <div className="space-y-6 animate-fade-in text-left">
            {/* 3-Column Mobile-Native Horizontal OPD Sub-Tab Switcher */}
            <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-100/90 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 select-none mb-2">
              <button
                type="button"
                onClick={() => setOpdSubTab('today_queue')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 border-0 ${
                  opdSubTab === 'today_queue'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-black'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span className="truncate">Today's OPD</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                  opdSubTab === 'today_queue' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {(() => {
                    const todayStr = getIstDateString();
                    return appointments.filter(a => {
                      if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                      return getEffectiveAppointmentDate(a) === todayStr;
                    }).length;
                  })()}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOpdSubTab('directory')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 border-0 ${
                  opdSubTab === 'directory'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-black'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span className="truncate">Patient Registry</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                  opdSubTab === 'directory' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {patients.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOpdSubTab('history')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 border-0 ${
                  opdSubTab === 'history'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-black'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span className="truncate">Past History</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                  opdSubTab === 'history' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {(() => {
                    const todayStr = getIstDateString();
                    return appointments.filter(a => {
                      if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                      const apptDate = getEffectiveAppointmentDate(a);
                      return Boolean(apptDate && apptDate < todayStr) || a.status === 'completed';
                    }).length;
                  })()}
                </span>
              </button>
            </div>

            {/* Sub-View 1: EHR Registry & Walk-In Registration */}
            {opdSubTab === 'directory' && (
              <div className="space-y-6 animate-fade-in text-left">
                {/* Sub Switcher */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 pb-2 gap-4">
                  <button
                    onClick={() => setPatientsSubTab('directory')}
                    className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 bg-transparent border-0 cursor-pointer ${
                      patientsSubTab === 'directory'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    EHR Registry Directory
                  </button>
                  <button
                    onClick={() => setPatientsSubTab('register')}
                    className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 bg-transparent border-0 cursor-pointer ${
                      patientsSubTab === 'register'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    Register New Profile
                  </button>
                </div>

            {patientsSubTab === 'directory' ? (
              <PatientsDirectoryTab
                patients={patients}
                patientSearchQuery={patientSearchQuery}
                setPatientSearchQuery={setPatientSearchQuery}
                selectedDirectoryPatient={selectedDirectoryPatient}
                setSelectedDirectoryPatient={setSelectedDirectoryPatient}
                newPatientName={newPatientName}
                setNewPatientName={setNewPatientName}
                newPatientPhone={newPatientPhone}
                setNewPatientPhone={setNewPatientPhone}
                newPatientAge={newPatientAge}
                setNewPatientAge={setNewPatientAge}
                newPatientGender={newPatientGender}
                setNewPatientGender={setNewPatientGender}
                patientRAGSummary={patientRAGSummary}
                setPatientRAGSummary={setPatientRAGSummary}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
            <div className="lg:col-span-8 space-y-6">
              
              {/* Search Registry */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-60" />
                <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-600" />
                  Patient Registry Lookup
                </h2>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search patient by phone, name, or ABHA ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full input-field pl-12 focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-600 text-sm py-2.5 bg-white border-slate-200 text-slate-800 rounded-xl"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 h-5 w-5" />
                </div>

                {searchQuery && (
                  <div className="mt-4 border border-slate-200/80 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-sm animate-fade-in select-none">
                    {filteredPatients.length === 0 ? (
                      <div className="p-5 text-slate-600 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        No matching patient found in registry.
                      </div>
                    ) : (
                      filteredPatients.map(p => {
                        const sess = sessions.find(s => s.patientPhone === p.phone);
                        const stage = api.getActivePatientCareStage(p.id);
                        const isSelected = activePatient?.id === p.id;

                        return (
                          <div 
                            key={p.id} 
                            onClick={() => api.setActivePatient(p)}
                            className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer ${
                              isSelected ? 'bg-indigo-50/40 border-l-4 border-indigo-600 pl-3' : ''
                            }`}
                          >
                            <div className="space-y-1">
                              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                                {p.name}
                                <span className="text-[9px] font-black font-mono bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                                  ID: {p.tokenNumber || 'N/A'}
                                </span>
                                <span className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                                  {p.age}y · {p.gender}
                                </span>
                              </h4>
                              
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-500" />
                                  {p.phone}
                                </span>
                                
                                {p.abhaId && (
                                  <span className="text-[9px] font-mono text-slate-600 bg-slate-50 border border-slate-200 px-1 rounded">
                                    ABHA: {p.abhaId}
                                  </span>
                                )}

                                {p.vitals ? (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-rose-50 border border-rose-200 text-rose-600 rounded">
                                    {isOphthalmology ? '👁️' : '🌡️'} Vitals Logged
                                  </span>
                                ) : (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-slate-50 border border-slate-200 text-slate-600 rounded">
                                    Awaiting Vitals
                                  </span>
                                )}

                                {(() => {
                                  const virtualAppt = appointments.find(a => (a.patientId === p.id || (a as any).patient_id === p.id) && Boolean(a.isVirtual || (a as any).is_virtual));
                                  if (!virtualAppt) return null;
                                  return (
                                    <span className="flex items-center gap-0.5 text-[8px] font-bold bg-emerald-50 border border-emerald-255 text-emerald-700 px-1.5 py-0.2 rounded animate-pulse font-sans">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-700 font-bold" />
                                      📹 Virtual {virtualAppt.virtualTimeAllocated ? `(${virtualAppt.virtualTime})` : 'Appt'}
                                    </span>
                                  );
                                })()}

                                {stage === 'diagnosing' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded animate-pulse-subtle">
                                    🩺 In Consult
                                  </span>
                                )}
                                {stage === 'lab' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded animate-pulse-subtle">
                                    🧪 Lab Requisitions
                                  </span>
                                )}
                                {stage === 'pharmacy' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-amber-50 border border-amber-200 text-amber-700 rounded animate-pulse-subtle">
                                    💊 Rx Dispensation
                                  </span>
                                )}
                                {stage === 'settled' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded animate-pulse-subtle">
                                    ✅ Settle Ledger
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex gap-2 self-end sm:self-auto" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  api.setActivePatient(p);
                                  handleInitiateWhatsAppLoop(p);
                                }}
                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                                  sess 
                                    ? 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-slate-200' 
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-slate-800 border-emerald-500 hover:border-emerald-600'
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
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative">
                <h2 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  Manual Patient Registration
                </h2>
                <p className="text-xs text-clinical-400 mb-4 leading-relaxed">
                  Enter patient details at the checkup counter to register a fresh profile and generate ID.
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
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
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
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
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
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value as any)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer"
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
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Blood Group</label>
                      <select
                        value={bloodGroupInput}
                        onChange={(e) => setBloodGroupInput(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg cursor-pointer"
                      >
                        <option value="">Select</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">WhatsApp Number</label>
                      <input
                        type="tel"
                        placeholder="WhatsApp (if diff)"
                        value={whatsAppInput}
                        onChange={(e) => setWhatsAppInput(e.target.value)}
                        className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 bg-slate-50 border-slate-200 text-slate-800 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-gradient-to-r from-secondary to-primary hover:scale-105 active:scale-95 text-slate-850 font-black tracking-wider uppercase border-0 rounded-xl text-xs cursor-pointer transition-transform"
                    >
                      Register Patient
                    </button>
                  </div>
                </form>
              </div>

              {/* Scan & Analyze Previous Reports Card — always visible */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800 rounded-3xl mt-6">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 to-indigo-500 opacity-60" />
                <h2 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 font-bold" />
                  Scan &amp; Analyze Patient's Past Reports
                </h2>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Upload or snap a photo of the patient's previous diagnostic reports. Clinical AI OCR will build a longitudinal health trajectory for the doctor.
                </p>

                {activePatient ? (
                  <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                      <label className="flex-1 flex flex-col items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-4 bg-slate-50 text-center cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all shadow-sm hover:shadow-md relative overflow-hidden">
                        {isReportScanning && (
                          <div className="absolute inset-0 bg-indigo-50/40 flex items-center justify-center">
                            <div className="w-full h-0.5 bg-emerald-500 absolute laser-sweep-line" />
                          </div>
                        )}
                        <Upload className="w-5 h-5 text-indigo-600" />
                        <span>{isReportScanning ? 'AI OCR Analyzing Clinical Values...' : 'Upload / Snap Previous Report'}</span>
                        <span className="text-[9px] text-slate-500 font-medium">Supports JPG, PNG, PDF</span>
                        <input
                          type="file"
                          disabled={isReportScanning}
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePreviousReportScan(file);
                          }}
                        />
                      </label>
                    </div>

                    {reportScanLogs.length > 0 && (
                      <div className="bg-slate-900 border border-slate-950 rounded-xl p-3 font-mono text-[9px] text-indigo-300 space-y-1 max-h-[85px] overflow-y-auto shadow-inner">
                        {reportScanLogs.map((log, index) => (
                          <div key={`report-scan-log-${index}-${log.slice(0, 15)}`} className={log.includes('[ERROR]') ? 'text-rose-400 font-bold' : log.includes('SUCCESS') ? 'text-emerald-400 font-bold' : ''}>
                            {log}
                          </div>
                        ))}
                      </div>
                    )}

                    {scannedSummary ? (
                      <div className="bg-indigo-50 border border-indigo-200/60 p-4 rounded-xl space-y-3 animate-fade-in text-slate-800">
                        <span className="block text-[8px] font-black text-indigo-700 tracking-widest uppercase font-mono">AI Scanned Report Summary (Draft)</span>
                        <textarea
                          value={scannedSummary}
                          onChange={(e) => setScannedSummary(e.target.value)}
                          rows={3}
                          className="w-full text-xs font-semibold leading-relaxed bg-white border border-slate-200 p-2 rounded-lg text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-650"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={async () => {
                              setIsSavingSummary(true);
                              try {
                                await api.updatePatientPastReportsSummary(activePatient.id, scannedSummary);
                                // Update active patient in state immediately
                                setActivePatientState(prev => prev ? { ...prev, pastReportsSummary: scannedSummary } : null);
                                setScannedSummary(null);
                                window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                  detail: {
                                    message: 'Report summary successfully saved to patient profile database!',
                                    type: 'success',
                                    title: 'Summary Persisted'
                                  }
                                }));
                              } catch (err) {
                                console.error('Error saving summary:', err);
                              } finally {
                                setIsSavingSummary(false);
                              }
                            }}
                            disabled={isSavingSummary}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer border-0 disabled:opacity-50 transition-all text-white-force"
                          >
                            <Save className="w-3.5 h-3.5 text-white" />
                            {isSavingSummary ? 'Saving...' : 'Save & Submit to Database'}
                          </button>
                        </div>
                      </div>
                    ) : activePatient.pastReportsSummary ? (
                      <div className="bg-indigo-50 border border-indigo-200/60 p-4 rounded-xl space-y-2.5 animate-fade-in text-slate-800">
                        <span className="block text-[8px] font-black text-indigo-700 tracking-widest uppercase font-mono">AI — Longitudinal Report Summary</span>
                        <p className="text-xs font-semibold leading-relaxed italic">
                          "{activePatient.pastReportsSummary}"
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-600 italic">
                        No previous reports scanned yet. Upload a report above to generate AI longitudinal summary.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-indigo-200 rounded-2xl p-6 bg-indigo-50/30 text-center">
                    <Search className="w-6 h-6 text-indigo-400" />
                    <p className="text-xs text-slate-600 font-medium">Search or register a patient first to enable AI report scanning.</p>
                  </div>
                )}
              </div>

            </div>

            {/* Staff list and simulator panel */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Check-in staff list */}
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-4 select-none">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <UserCheck className="h-5 w-5 text-secondary" />
                  Checked-In Active Staffs
                </h3>
                
                <div className="space-y-3 lg:max-h-[300px] max-h-none lg:overflow-y-auto">
                  {staffList.length === 0 ? (
                    <p className="text-xs text-clinical-500 text-center py-4">No staffs checked-in.</p>
                  ) : (
                    staffList.map((staff, idx) => (
                      <div 
                        key={`${staff.id}-${idx}`} 
                        onClick={() => handleSelectActiveStaff(staff.id)}
                        className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                          staff.id === activeStaffId 
                            ? 'border-secondary bg-secondary/5' 
                            : 'border-outline-variant hover:bg-surface-container/30'
                        }`}
                      >
                        <div>
                          <h5 className="font-bold text-xs text-slate-800">{staff.staffName}</h5>
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
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-4">
                <h4 className="font-bold text-sm text-slate-800 border-b border-slate-200/60 pb-2">Register Shifts Compounders</h4>
                <form onSubmit={handleRegisterStaff} className="space-y-3">
                  <input
                    type="text"
                    required
                      className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-slate-850 rounded-lg"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value as any)}
                      className="flex-1 input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-slate-850 rounded-lg cursor-pointer"
                    >
                      <option value="compounder">Compounder</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="admin">Clinic Admin</option>
                    </select>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer border-0 transition active:scale-95 shrink-0"
                    >
                      Register
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

            {/* Sub-View 2: Past Consultation History & Clinic Records with 1-Click CSV Export */}
            {opdSubTab === 'history' && (
              <div className="space-y-6 animate-fade-in text-left">
                <div className="glass-panel p-4 sm:p-6 border-slate-200/60 dark:border-white/10 shadow-xl bg-white dark:bg-slate-950/80 text-slate-800 dark:text-white rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-600 to-indigo-600 opacity-80" />
                  
                  {/* Header with Title, Count, and 1-Click Export CSV Action */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-slate-200/60 dark:border-white/10">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-500 shrink-0" />
                        Past Consultation History & Clinic Records
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Comprehensive log of all completed patient visits, token numbers, and clinical encounters.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl">
                        {(() => {
                          const todayStr = getIstDateString();
                          return appointments.filter(a => {
                            if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                            const apptDate = getEffectiveAppointmentDate(a);
                            return Boolean(apptDate && apptDate < todayStr) || a.status === 'completed';
                          }).length;
                        })()} Records
                      </span>

                      <button
                        type="button"
                        onClick={handleDownloadPastAppointmentsCsv}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer border-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Past Records (CSV)</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Bar for Past Records */}
                  <div className="mb-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search past appointments by Patient Name, Phone, Token #, or Date..."
                        value={pastHistorySearchQuery}
                        onChange={(e) => setPastHistorySearchQuery(e.target.value)}
                        className="w-full input-field text-xs py-2.5 pl-10 pr-9 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-xl outline-none placeholder:text-slate-400"
                      />
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                      {pastHistorySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setPastHistorySearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-0.5 bg-transparent border-0"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Table of Past Records */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 uppercase font-mono font-bold text-[10px]">
                        <tr>
                          <th className="p-3">Token #</th>
                          <th className="p-3">Patient Name</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Mode</th>
                          <th className="p-3">Attending Doctor</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Fee Clearance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {(() => {
                          const todayStr = getIstDateString();
                          const q = (pastHistorySearchQuery || '').trim().toLowerCase();
                          const pastAppts = appointments
                            .filter(a => {
                              if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                              const apptDate = getEffectiveAppointmentDate(a);
                              return Boolean(apptDate && apptDate < todayStr) || a.status === 'completed';
                            })
                            .filter(appt => {
                              if (!q) return true;
                              const pat = patients.find(p => p.id === (appt.patientId || (appt as any).patient_id));
                              const name = (appt.patientName || pat?.name || '').toLowerCase();
                              const phone = (appt.patientPhone || pat?.phone || '').toLowerCase();
                              const token = String(appt.token_number || appt.tokenNumber || (appt as any).token || '').toLowerCase();
                              const date = (getEffectiveAppointmentDate(appt) || '').toLowerCase();
                              return name.includes(q) || phone.includes(q) || token.includes(q) || date.includes(q);
                            })
                            .sort((a, b) => {
                              const dateA = getEffectiveAppointmentDate(a);
                              const dateB = getEffectiveAppointmentDate(b);
                              return dateB.localeCompare(dateA);
                            });

                          if (pastAppts.length === 0) {
                            return (
                              <tr>
                                <td colSpan={8} className="p-8 text-center text-slate-400">
                                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                                  <p className="text-xs font-medium">No past appointment records found matching your search.</p>
                                </td>
                              </tr>
                            );
                          }

                          return pastAppts.map((appt, idx) => {
                            const pat = patients.find(p => p.id === (appt.patientId || (appt as any).patient_id));
                            const apptDate = getEffectiveAppointmentDate(appt) || (appt.createdAt || '').split('T')[0];
                            const rawToken = appt.token_number || appt.tokenNumber || (appt as any).token;
                            const tokenDisplay = String(rawToken || `TK-${String(idx + 1).padStart(2, '0')}`);
                            const patName = appt.patientName || pat?.name || 'Patient';
                            const patPhone = appt.patientPhone || pat?.phone || 'N/A';

                            return (
                              <tr key={appt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                                <td className="p-3">
                                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-black text-[11px] border border-slate-200 dark:border-white/10">
                                    #{tokenDisplay.startsWith('TK-') || tokenDisplay.startsWith('T-') ? tokenDisplay : `TK-${tokenDisplay.padStart(2, '0')}`}
                                  </span>
                                </td>
                                <td className="p-3 font-bold text-slate-900 dark:text-white">
                                  <div>
                                    <div className="text-xs">{patName}</div>
                                    <div className="text-[10px] text-slate-500 font-mono font-normal">{pat?.age ? `${pat.age}y (${pat.gender})` : ''}</div>
                                  </div>
                                </td>
                                <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{patPhone}</td>
                                <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 font-mono">
                                  {apptDate}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${(appt.is_virtual || appt.isVirtual) ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
                                    {(appt.is_virtual || appt.isVirtual) ? 'Virtual 💻' : 'Physical 🏥'}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-700 dark:text-slate-300 text-xs">
                                  {activePod?.doctor_name || 'Dr. Attending Physician'}
                                </td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                    Completed ✅
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                  Cleared ✅
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-View 4: Today's Active OPD Queue & Consultation Intake */}
            {opdSubTab === 'today_queue' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
                {/* Left Column: Today's Appointments List */}
                <div className="lg:col-span-8 space-y-6">
                  <div className="glass-panel p-6 border-slate-200/60 dark:border-white/10 shadow-xl relative overflow-hidden bg-white dark:bg-slate-950/80 text-slate-800 dark:text-white rounded-3xl">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 to-indigo-500 opacity-60" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-white/10 pb-4 mb-4">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                          <Activity className="h-5 w-5 text-rose-500 animate-pulse" />
                          {opdQueueFilter === 'today' ? "Today's Appointments Queue" : "Upcoming WhatsApp Advance Bookings"}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {opdQueueFilter === 'today' 
                            ? "Active OPD patient token stream, clinical vitals intake, and chamber triage." 
                            : "Patient bookings registered for upcoming dates via WhatsApp Bot & online portals."}
                        </p>
                      </div>

                      {/* 1-Tap Switcher: Today's Live Queue vs Upcoming Advance Bookings */}
                      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-white/10 shrink-0">
                        <button
                          type="button"
                          onClick={() => setOpdQueueFilter('today')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
                            opdQueueFilter === 'today'
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm font-black'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 shrink-0" />
                          <span>Today's Queue</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                            opdQueueFilter === 'today' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            {(() => {
                              const todayStr = getIstDateString();
                              return appointments.filter(a => {
                                if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                                return getEffectiveAppointmentDate(a) === todayStr;
                              }).length;
                            })()}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOpdQueueFilter('upcoming')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
                            opdQueueFilter === 'upcoming'
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm font-black'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>Upcoming Bookings</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                            opdQueueFilter === 'upcoming' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            {(() => {
                              const todayStr = getIstDateString();
                              return appointments.filter(a => {
                                if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                                const apptDate = getEffectiveAppointmentDate(a);
                                return Boolean(apptDate && apptDate > todayStr);
                              }).length;
                            })()}
                          </span>
                        </button>
                      </div>
                    </div>

                <div className="space-y-4">
                  {(() => {
                    const todayStr = getIstDateString();

                    const confirmedAppts = appointments.filter(a => {
                      if (a.status === 'pending_payment' || a.status === 'cancelled') return false;
                      const apptDate = getEffectiveAppointmentDate(a);
                      if (opdQueueFilter === 'today') {
                        return !apptDate || apptDate === todayStr;
                      } else {
                        return Boolean(apptDate && apptDate > todayStr);
                      }
                    });

                    if (opdQueueFilter === 'today') {
                      // 1. Emergency SOS takes Priority #1 at top of queue
                      // 2. Awaiting / Active patients before seen/completed patients (demote seen from top)
                      // 3. Strict Sequential Token Number sorting (#TK-001 > #TK-002 > #TK-003)
                      const parseTokenNum = (token?: string | number) => {
                        if (!token) return 999999;
                        if (typeof token === 'number') return token;
                        const match = String(token).match(/\d+/);
                        return match ? parseInt(match[0], 10) : 999999;
                      };

                      confirmedAppts.sort((a, b) => {
                        // Priority #1: Emergency SOS
                        const isSOSA = Boolean((a as any).isEmergency || (a as any).is_emergency || String(a.source || '').toLowerCase().includes('sos') || String(a.source || '').toLowerCase().includes('emergency') || String(a.tokenNumber || '').toUpperCase().includes('SOS') || String(a.tokenNumber || '').toUpperCase().includes(' E') || String(a.tokenNumber || '').toUpperCase().includes('E-') || String(a.tokenNumber || '').startsWith('#EM-'));
                        const isSOSB = Boolean((b as any).isEmergency || (b as any).is_emergency || String(b.source || '').toLowerCase().includes('sos') || String(b.source || '').toLowerCase().includes('emergency') || String(b.tokenNumber || '').toUpperCase().includes('SOS') || String(b.tokenNumber || '').toUpperCase().includes(' E') || String(b.tokenNumber || '').toUpperCase().includes('E-') || String(b.tokenNumber || '').startsWith('#EM-'));
                        if (isSOSA && !isSOSB) return -1;
                        if (!isSOSA && isSOSB) return 1;

                        // Priority #2: Demote completed/seen patients from top
                        const patientA = patients.find(p => p.id === (a.patientId || (a as any).patient_id));
                        const patientB = patients.find(p => p.id === (b.patientId || (b as any).patient_id));

                        const isDoneA = a.status === 'completed' || (patientA?.queueStatus as string) === 'completed' || (patientA?.queueStatus as string) === 'settled' || (patientA?.queueStatus as string) === 'pharmacy' || (patientA?.queueStatus as string) === 'lab';
                        const isDoneB = b.status === 'completed' || (patientB?.queueStatus as string) === 'completed' || (patientB?.queueStatus as string) === 'settled' || (patientB?.queueStatus as string) === 'pharmacy' || (patientB?.queueStatus as string) === 'lab';
                        if (!isDoneA && isDoneB) return -1;
                        if (isDoneA && !isDoneB) return 1;

                        // Priority #3: Sequential Numeric Token Number (Token 1 before Token 2)
                        const tokenA = parseTokenNum(a.tokenNumber || (a as any).token_number || patientA?.tokenNumber);
                        const tokenB = parseTokenNum(b.tokenNumber || (b as any).token_number || patientB?.tokenNumber);
                        if (tokenA !== tokenB) return tokenA - tokenB;

                        // Tie break by creation time
                        return (a.createdAt || '').localeCompare(b.createdAt || '');
                      });
                    } else {
                      // Upcoming appointments: closest date first
                      confirmedAppts.sort((a, b) => {
                        const dateA = getEffectiveAppointmentDate(a);
                        const dateB = getEffectiveAppointmentDate(b);
                        return dateA.localeCompare(dateB);
                      });
                    }

                    if (confirmedAppts.length === 0) {
                      return (
                        <div className="p-8 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40">
                          {opdQueueFilter === 'today' ? (
                            <>
                              <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50 shrink-0" />
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No active tokens in today's OPD queue.</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Walk-in registrations and WhatsApp bookings for today will appear here.</p>
                            </>
                          ) : (
                            <>
                              <Calendar className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-60 shrink-0" />
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No upcoming advance bookings found.</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Patients booking future dates on WhatsApp will automatically queue here.</p>
                            </>
                          )}
                        </div>
                      );
                    }
                    return confirmedAppts.map((appt, idx) => {
                      const patId = appt.patientId || (appt as any).patient_id;
                      const patient: any = patients.find(p => p.id === patId) || {
                        id: patId,
                        name: (appt as any).patientName || (appt as any).patient_name || 'WhatsApp Patient',
                        phone: (appt as any).patientPhone || (appt as any).patient_phone || 'N/A',
                        age: (appt as any).patientAge || (appt as any).patient_age || 30,
                        gender: (appt as any).patientGender || (appt as any).patient_gender || 'Male',
                        queueStatus: 'awaiting_vitals',
                        allergies: [],
                        chronicConditions: [],
                        createdAt: new Date().toISOString()
                      };

                      // Find matching consult invoice
                      const invoice = api.getInvoices().find(i => i.appointmentId === appt.id && i.type === 'consult');

                      const isAwaitingVitals = patient.queueStatus === 'awaiting_vitals' || !patient.queueStatus;
                      const isAwaitingConsult = patient.queueStatus === 'awaiting_consultation';
                      const isSOS = Boolean((appt as any).isEmergency || (appt as any).is_emergency || String(appt.source || '').toLowerCase().includes('sos') || String(appt.source || '').toLowerCase().includes('emergency') || String(appt.tokenNumber || '').toUpperCase().includes('SOS') || String(appt.tokenNumber || '').startsWith('#EM-'));
                      const rawToken = appt.token_number || appt.tokenNumber || (appt as any).token;
                      const tokenDisplay = String(rawToken || `TK-${String(idx + 1).padStart(2, '0')}`);

                      return (
                        <div 
                          key={appt.id} 
                          className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${
                            isSOS
                              ? 'border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/20 ring-2 ring-rose-500/30'
                              : vitalsPatient?.id === patient.id 
                              ? 'border-rose-500/50 bg-rose-500/5 shadow-md shadow-rose-500/5' 
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'
                          }`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono font-black text-[10px] border border-indigo-200 dark:border-indigo-700/50 shadow-sm">
                                #{tokenDisplay.startsWith('T-') || tokenDisplay.startsWith('TK-') ? tokenDisplay : `TK-${tokenDisplay.padStart(2, '0')}`}
                              </span>
                              {isSOS ? (
                                <span className="flex items-center gap-1 text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-lg bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse">
                                  <ShieldAlert className="h-3 w-3" />
                                  🚨 EMERGENCY SOS PRIORITY #1
                                </span>
                              ) : (
                                <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-lg border ${
                                  appt.isVirtual
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                                    : String((appt as any).source || '').toLowerCase().includes('whatsapp')
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                    : 'bg-slate-500/10 text-slate-600 border-slate-500/25'
                                }`}>
                                  {appt.isVirtual ? '📹 VIRTUAL CALL' : String((appt as any).source || '').toLowerCase().includes('whatsapp') ? '🟢 [W] WhatsApp Bot' : '🏢 COUNTER'}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setVitalsPatient(patient)}
                                className="text-left font-bold text-slate-805 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer bg-transparent border-0 p-0 text-xs flex items-center gap-1 group"
                              >
                                <span className="group-hover:underline">{patient.name}</span>
                              </button>
                              {patient && (patient.age || patient.gender) && (
                                <span className="text-slate-500 text-[10px] font-medium">
                                  ({patient.age ? patient.age + 'y' : ''}{patient.age && patient.gender ? ' · ' : ''}{patient.gender || ''})
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <Smartphone className="h-3 w-3 text-indigo-500" />
                                {patient.phone}
                              </span>
                              
                              <span className={`flex items-center gap-1.5 px-2 py-0.2 rounded border text-[8px] font-bold uppercase tracking-wider ${
                                appt.status === 'ready_for_consult'
                                  ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10'
                                  : appt.status === 'completed'
                                  ? 'bg-indigo-500/5 text-indigo-600 border-indigo-500/10'
                                  : 'bg-amber-500/5 text-amber-600 border-amber-500/10'
                              }`}>
                                {appt.status === 'ready_for_consult' ? 'Paid & Active' : appt.status}
                              </span>

                              {opdQueueFilter === 'upcoming' && (() => {
                                const aDate = getEffectiveAppointmentDate(appt);
                                const isTomorrow = aDate === getIstOffsetDateString(1);

                                return (
                                  <span className={`flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                                    isTomorrow 
                                      ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 shadow-xs' 
                                      : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-700 shadow-xs'
                                  }`}>
                                    <Calendar className="h-3 w-3" />
                                    {isTomorrow ? '📅 Tomorrow' : `📅 ${aDate || 'Scheduled'}`} {appt.virtual_time || (appt as any).virtualTime ? `· ${appt.virtual_time || (appt as any).virtualTime}` : ''}
                                  </span>
                                );
                              })()}
                            </div>

                            {patient.vitals && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-slate-200/60 text-[9px] font-mono text-slate-600">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">🌡️ Temp: {patient.vitals.temperature}°F</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">🩺 BP: {patient.vitals.bloodPressure}</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">💓 Pulse: {patient.vitals.pulseRate} bpm</span>
                              </div>
                            )}

                            {/* Patient Visual Workflow & Quick Actions */}
                            {(() => {
                              const steps = getPatientWorkflowState(patient, appt);
                              const patientEncounters = EncounterService.getEncounters().filter(e => e.patientId === patient.id);
                              const latestEncounter = patientEncounters[patientEncounters.length - 1];
                              const reports = LabService.getFullLabReports().filter(r => r.patientId === patient.id);
                              
                              const hasPrescription = latestEncounter && (latestEncounter.clinicalNotes || latestEncounter.medications.length > 0);
                              const hasLabReport = reports.length > 0 && reports.some(r => r.status === 'approved');
                              const sessionList = api.getWhatsAppSessions();
                              const session = sessionList.find(s => s.patientPhone === patient.phone);
                              const hasWhatsAppHistory = session && session.sessionData?.chatHistory && session.sessionData.chatHistory.length > 0;

                              return (
                                <div className="mt-2.5 pt-2.5 border-t border-slate-200/40 space-y-2">
                                  {/* Compact Workflow Indicator in Single Horizontal Row */}
                                  <div className="flex items-center justify-start w-full flex-nowrap gap-[6px] overflow-x-auto scrollbar-none py-1.5 mt-1">
                                    {steps.map((step) => {
                                      let colorClass = 'bg-slate-800/30 text-slate-400 border border-slate-700/40';
                                      let checkIcon = '○';
                                      
                                      if (step.status === 'completed') {
                                        colorClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]';
                                        checkIcon = '✓';
                                      } else if (step.status === 'skipped') {
                                        colorClass = 'bg-slate-900/40 text-slate-550 border border-slate-800/55 line-through opacity-50';
                                        checkIcon = '⊘';
                                      } else if (step.status === 'active') {
                                        colorClass = 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/50 shadow-[0_0_8px_rgba(99,102,241,0.3)] animate-pulse font-extrabold';
                                        checkIcon = '●';
                                      }

                                      return (
                                        <div 
                                          key={step.id} 
                                          className={`flex items-center gap-[2.5px] px-2 py-[3px] rounded-lg border text-[8px] font-bold tracking-tight uppercase font-sans transition-all duration-300 shrink-0 ${colorClass}`}
                                          title={`${step.label}: ${step.status}`}
                                        >
                                          <span className="text-[8.5px] leading-none">{checkIcon}</span>
                                          <span className="leading-none">{step.label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Quick Document Actions (Horizontal Scrollable Strip for Mobile) */}
                                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                                    <button
                                      type="button"
                                      onClick={() => setActiveWorkflowDetail({ type: 'prescription', patientId: patient.id, patientName: patient.name })}
                                      className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-450 hover:bg-indigo-500/25 border border-indigo-500/25 rounded text-[8.5px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                                    >
                                      <FileText className="h-2.5 w-2.5" />
                                      Prescription
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setActiveWorkflowDetail({ type: 'lab', patientId: patient.id, patientName: patient.name })}
                                      className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 text-rose-450 hover:bg-rose-500/25 border border-rose-500/25 rounded text-[8.5px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                                    >
                                      <Activity className="h-2.5 w-2.5" />
                                      Lab Results
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleInitiateWhatsAppLoop(patient)}
                                      className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 rounded text-[8.5px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                                    >
                                      <Smartphone className="h-2.5 w-2.5" />
                                      WhatsApp Chat
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* If appointment is pending payment (whatsapp booking unpaid) */}
                            {invoice && invoice.status === 'unpaid' ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    await BillingService.recordInvoicePayment(invoice.id, 'cash');
                                    syncData();
                                    if (patient.phone) {
                                      api.dispatchFreeFollowupLoyaltyWhatsApp({
                                        patientPhone: patient.phone,
                                        patientName: patient.name,
                                        doctorName: activePod?.doctor_name,
                                        clinicName: activePod?.name
                                      }).catch(err => console.warn('[Compounder] Cash loyalty dispatch error:', err));
                                    }
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: { message: 'Cash collected! 🌟 VitalSync Premium Member Unlocked (1 Free Virtual Consult + 10% OFF Refills + WhatsApp PDF Reports)!', type: 'success', title: 'Payment Settled ✔️' }
                                    }));
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                    setVitalsPatient(patient);
                                  }}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold uppercase tracking-wider text-[8px] transition-all cursor-pointer border-0"
                                >
                                  Collect Cash
                                </button>
                                <button
                                  onClick={async () => {
                                    await BillingService.recordInvoicePayment(invoice.id, 'upi');
                                    syncData();
                                    if (patient.phone) {
                                      api.dispatchFreeFollowupLoyaltyWhatsApp({
                                        patientPhone: patient.phone,
                                        patientName: patient.name,
                                        doctorName: activePod?.doctor_name,
                                        clinicName: activePod?.name
                                      }).catch(err => console.warn('[Compounder] UPI loyalty dispatch error:', err));
                                    }
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: { message: 'UPI verified! 🌟 Mediflow Premium Member Unlocked (1 Free Virtual Consult + 10% OFF Refills + WhatsApp PDF Reports)!', type: 'success', title: 'Payment Settled ✔️' }
                                    }));
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                    setVitalsPatient(patient);
                                  }}
                                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold uppercase tracking-wider text-[8px] transition-all cursor-pointer border-0"
                                >
                                  Verify UPI
                                </button>
                              </div>
                            ) : isAwaitingVitals ? (
                              <button
                                onClick={() => {
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                  setVitalsPatient(patient);
                                }}
                                className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white border border-rose-600 font-bold rounded-lg uppercase tracking-wider text-[9px] transition-all cursor-pointer"
                              >
                                🩺 Record Vitals
                              </button>
                            ) : isAwaitingConsult ? (
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-[8px] bg-amber-500/10 text-amber-700 font-mono font-bold px-2 py-0.5 rounded border border-amber-200 uppercase tracking-widest animate-pulse">
                                  In Doctor Chamber
                                </span>
                                <button
                                  onClick={() => {
                                    api.updatePatientQueueStatus(patient.id, 'completed');
                                    appt.status = 'completed';
                                    BillingService.saveAppointment(appt);
                                    syncData();
                                  }}
                                  className="text-[8px] text-slate-500 hover:text-slate-800 underline cursor-pointer bg-transparent border-0 p-0"
                                >
                                  Mark Completed
                                </button>
                              </div>
                            ) : (
                              <span className="text-[8px] bg-emerald-500/10 text-emerald-600 font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                                Consult Complete
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  })()}
                </div>
              </div>
            </div>

            {/* Right Column: Active Vitals Quick Status */}
            <div className="lg:col-span-4 space-y-6">
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative text-center text-slate-500 py-8 bg-white dark:bg-slate-800/80 rounded-3xl">
                <Activity className="h-8 w-8 text-rose-500 mx-auto mb-2 animate-pulse" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">Vitals Intake Command</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Select any patient from the OPD Queue to open the instant Vitals Recording Modal window.</p>
              </div>

              {/* INSTANT FLOATING VITALS RECORDING MODAL OVERLAY
                   CRITICAL: outer div must be `fixed inset-0 flex items-center justify-center`
                   with NO overflow-y-auto — that breaks flexbox centering and pushes the
                   modal above the viewport. The inner panel handles its own scroll. */}
              {vitalsPatient && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
                  <div className="glass-panel w-full max-w-lg p-6 border-slate-200/60 dark:border-white/10 shadow-2xl relative bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto">
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500" />
                    
                    <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/10 pb-3 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          <Activity className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Record Vitals: {vitalsPatient.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                            {vitalsPatient.patientCode && (
                              <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-700 px-1.5 py-0 rounded font-mono">
                                [{vitalsPatient.patientCode}]
                              </span>
                            )}
                            Token: {vitalsPatient.tokenNumber || '—'} · {vitalsPatient.age}y · {vitalsPatient.gender}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVitalsPatient(null)}
                        className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer border-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleRecordVitalsSubmit} className="space-y-4 text-left">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">OPD Token (System Allocated)</label>
                          <div className="w-full py-2 px-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg font-mono font-black text-xs flex items-center justify-between">
                            <span>{vitalsPatient.tokenNumber || api.generateNextTokenNumber()}</span>
                            <span className="text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Auto Token</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
                            {isOphthalmology ? 'Visual Acuity OD (Right Eye)' : 'Temperature (°F)'}
                          </label>
                          <input
                            type="text"
                            value={tempVal}
                            onChange={(e) => setTempVal(e.target.value)}
                            list="vitals-temp-list"
                            placeholder={isOphthalmology ? 'e.g. 6/6' : 'e.g. 98.6'}
                            className="w-full input-field text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none"
                          />
                          <datalist id="vitals-temp-list">
                            {isOphthalmology ? (
                              ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            ) : (
                              ['97.0', '97.5', '98.0', '98.4', '98.6', '98.8', '99.0', '99.5', '100.0', '100.5', '101.0', '102.0'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            )}
                          </datalist>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
                            {isOphthalmology ? 'VA OS (Left Eye)' : 'BP (mmHg)'}
                          </label>
                          <input
                            type="text"
                            value={bpVal}
                            onChange={(e) => setBpVal(e.target.value)}
                            list="vitals-bp-list"
                            placeholder={isOphthalmology ? 'e.g. 6/6' : 'e.g. 120/80'}
                            className="w-full input-field text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none"
                          />
                          <datalist id="vitals-bp-list">
                            {isOphthalmology ? (
                              ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            ) : (
                              ['90/60', '100/60', '110/70', '115/75', '120/80', '125/80', '130/80', '135/85', '140/90', '150/95', '160/100'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            )}
                          </datalist>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
                            {isOphthalmology ? 'IOP (mmHg)' : 'Pulse (bpm)'}
                          </label>
                          <input
                            type="text"
                            value={pulseVal}
                            onChange={(e) => setPulseVal(e.target.value)}
                            list="vitals-pulse-list"
                            placeholder={isOphthalmology ? 'e.g. 15' : 'e.g. 72'}
                            className="w-full input-field text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none"
                          />
                          <datalist id="vitals-pulse-list">
                            {isOphthalmology ? (
                              Array.from({ length: 23 }, (_, i) => String(i + 8)).map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            ) : (
                              ['50', '55', '60', '64', '68', '72', '76', '80', '85', '90', '95', '100', '105', '110', '120'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            )}
                          </datalist>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
                            {isOphthalmology ? 'Aided OD' : 'Weight (kg)'}
                          </label>
                          <input
                            type="text"
                            value={weightVal}
                            onChange={(e) => setWeightVal(e.target.value)}
                            list="vitals-weight-list"
                            placeholder={isOphthalmology ? 'e.g. 6/6' : 'e.g. 60'}
                            className="w-full input-field text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none"
                          />
                          <datalist id="vitals-weight-list">
                            {isOphthalmology ? (
                              ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'].map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            ) : (
                              Array.from({ length: 21 }, (_, i) => String(35 + i * 5)).map(opt => (
                                <option key={opt} value={opt} />
                              ))
                            )}
                          </datalist>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
                          {isOphthalmology ? 'Aided OS' : 'Blood Sugar (mg/dL) - Optional'}
                        </label>
                        <input
                          type="text"
                          value={sugarVal}
                          onChange={(e) => setSugarVal(e.target.value)}
                          list="vitals-sugar-list"
                          placeholder={isOphthalmology ? 'e.g. 110' : 'e.g. None'}
                          className="w-full input-field text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg outline-none"
                        />
                        <datalist id="vitals-sugar-list">
                          {isOphthalmology ? (
                            ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'].map(opt => (
                              <option key={opt} value={opt} />
                            ))
                          ) : (
                            ['70', '80', '90', '100', '110', '120', '130', '140', '150', '160', '180', '200', '220', '250'].map(opt => (
                              <option key={opt} value={opt} />
                            ))
                          )}
                        </datalist>
                      </div>

                      <div className="pt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setVitalsPatient(null)}
                          className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all border-0 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-[2] py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold tracking-wider uppercase border-0 rounded-xl text-xs cursor-pointer shadow-lg shadow-rose-500/20 transition-transform active:scale-95"
                        >
                          Save &amp; Dispatch to Doctor 🩺
                        </button>
                      </div>
                    </form>
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>
        )}
      </div>
    )}

        {/* ══════════════════════════════════════════════════════════
            TAB: CLINICAL HUB (LABS & PHARMACY CONSOLIDATED)
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'clinical_hub' && (
          <div className="space-y-6 animate-fade-in text-left">
            {/* Consolidated Clinical Sub-Tab Header — 2-Column Mobile-First Horizontal Icon Grid */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-white/5 backdrop-blur-md mb-2">
              <button
                type="button"
                onClick={() => setClinicalSubTab('labs')}
                className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border-0 ${
                  clinicalSubTab === 'labs'
                    ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-md shadow-teal-500/20'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <FlaskConical className={`w-4 h-4 shrink-0 ${clinicalSubTab === 'labs' ? 'text-white' : 'text-teal-500'}`} />
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] font-extrabold">{isOphthalmology ? 'Biometry & Labs' : 'Pathology Labs'}</span>
                  <span className={`text-[8px] font-medium ${clinicalSubTab === 'labs' ? 'text-white/75' : 'text-slate-400 dark:text-slate-500'}`}>
                    {isOphthalmology ? 'Biometry / Labs' : 'Diagnostics & Worklist'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setClinicalSubTab('pharmacy')}
                className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border-0 ${
                  clinicalSubTab === 'pharmacy'
                    ? 'bg-gradient-to-r from-amber-600 to-indigo-600 text-white shadow-md shadow-amber-500/20'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <QrCode className={`w-4 h-4 shrink-0 ${clinicalSubTab === 'pharmacy' ? 'text-white' : 'text-amber-500'}`} />
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] font-extrabold">{isOphthalmology ? 'Optics & Pharmacy' : 'Pharmacy Dispensing'}</span>
                  <span className={`text-[8px] font-medium ${clinicalSubTab === 'pharmacy' ? 'text-white/75' : 'text-slate-400 dark:text-slate-500'}`}>
                    {isOphthalmology ? 'Optics / Pharmacy Counter' : 'Medicine Counter'}
                  </span>
                </div>
              </button>
            </div>

            {/* Sub-View 1: Pathology & Biometry */}
            {/* Sub-View 1: Pathology & Biometry */}
            {clinicalSubTab === 'labs' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                {/* Left Column: Scheduled Pathology Tests Queue */}
                <div className="lg:col-span-7 space-y-6 text-left">
                  <div className="glass-panel p-4 sm:p-6 border-slate-200/80 dark:border-white/10 shadow-xl relative overflow-hidden bg-white dark:bg-slate-900/90 text-slate-800 dark:text-white rounded-3xl">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 to-indigo-600 opacity-80" />
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        Pathology Lab Requisition Queue
                      </h2>
                      <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                        Live Worklist
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Clinical operational queue showing all laboratory orders, sample collection tracking, and processing status.
                    </p>

                    {(() => {
                      const reqs = LabService.getLabRequisitions();
                      if (reqs.length === 0) {
                        return (
                          <div className="p-8 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                            <FlaskConical className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">No Lab Orders Today</div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Doctor-ordered pathology tests and sample collection requests will appear here.</p>
                          </div>
                        );
                      }
                      return (
                        <div className="border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 shadow-xs">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/10">
                                <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono">Patient</th>
                                <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono">Test Order</th>
                                <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono text-center">Status</th>
                                <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                              {reqs.map((req) => {
                                let statusClass = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
                                if (req.status === 'pending') statusClass = "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700 animate-pulse";
                                else if (req.status === 'collected') statusClass = "bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700";
                                else if ((req as any).status === 'processed') statusClass = "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700";
                                else if ((req as any).status === 'completed' || Boolean(req.quantitativeResult)) statusClass = "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700";

                                const isReady = (req as any).status === 'completed' || Boolean(req.quantitativeResult);

                                return (
                                  <tr key={req.id} className="hover:bg-white/60 dark:hover:bg-white/5 transition-colors">
                                    <td className="p-3">
                                      <div className="font-extrabold text-slate-900 dark:text-white">{req.patientName}</div>
                                      <span className="text-[9px] text-slate-400 font-mono block">ID: {(req.patientId || '').substring(0, 8)}</span>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-bold text-slate-800 dark:text-slate-200">{req.testName}</div>
                                      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono block">LOINC: {req.testCode}</span>
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${statusClass}`}>
                                        {req.status}
                                      </span>
                                    </td>
                                    <td className="p-3 text-right">
                                      {isReady ? (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const p = patients.find(pt => pt.id === req.patientId);
                                            if (p?.phone) {
                                              await api.dispatchLabArrivalRevisitAlert({
                                                patientPhone: p.phone,
                                                patientName: req.patientName,
                                                testName: req.testName,
                                                revisitSlotTime: '04:30 PM - 05:30 PM',
                                                doctorName: activePod?.doctor_name,
                                                clinicName: clinicTitle
                                              });
                                              window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                                detail: {
                                                  title: 'Revisit WhatsApp Sent 📲',
                                                  message: `Doctor re-visit timing alert sent to ${req.patientName} on WhatsApp!`,
                                                  type: 'success'
                                                }
                                              }));
                                            }
                                          }}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-[10px] font-bold cursor-pointer transition active:scale-95 shadow-sm border-0"
                                        >
                                          <MessageSquare className="w-3 h-3 text-white" />
                                          <span>WhatsApp Alert</span>
                                        </button>
                                      ) : (
                                        <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                                          {req.barcode || 'SAMPLE-AWAITING'}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Right Column: Approved Lab Reports Timeline */}
                <div className="lg:col-span-5 space-y-6 text-left select-none">
                  <div className="glass-panel p-4 sm:p-6 border-slate-200/80 dark:border-white/10 shadow-xl relative overflow-hidden bg-white dark:bg-slate-900/90 text-slate-800 dark:text-white rounded-3xl">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500 opacity-80" />
                    
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Approved Diagnostics
                      </h2>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        Verified
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Chronological log of verified diagnostic outcomes, critical biomarkers, and scheduled physician final review timings.
                    </p>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {(() => {
                        const approved = fullLabReports.filter(r => r.status === 'approved');
                        if (approved.length === 0) {
                          return (
                            <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                              No verified pathology reports logged today.
                            </div>
                          );
                        }

                        return approved.map((report) => {
                          const biomarkers = report.biomarkerJson?.biomarkers || {};
                          return (
                            <div key={report.id} className="p-3.5 border border-slate-200/80 dark:border-white/10 rounded-2xl bg-slate-50/60 dark:bg-slate-800/60 space-y-2.5 shadow-xs">
                              <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-white/10 pb-2">
                                <div>
                                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">{report.patientName}</h4>
                                  <span className="text-[9px] text-slate-400 font-mono block">ID: {(report.patientId || '').substring(0, 8)}</span>
                                </div>
                                <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                                  Verified ✅
                                </span>
                              </div>

                              <div className="space-y-1">
                                <span className="block text-[8px] font-black text-slate-500 dark:text-slate-400 tracking-widest uppercase font-mono">Biomarker Log</span>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {Object.keys(biomarkers).filter(k => !k.endsWith('_unit')).map(key => {
                                    const val = biomarkers[key];
                                    const unit = biomarkers[`${key}_unit`] || biomarkers.unit || '';
                                    return (
                                      <span key={key} className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold">
                                        {key}: {val} {unit}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>

                              {report.revisitScheduledAt && (
                                <div className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[10px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                                  <strong>📅 Locked Revisit Consult:</strong> {new Date(report.revisitScheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                  {report.revisitNote && <p className="mt-0.5 text-slate-600 dark:text-slate-400 italic">Note: {report.revisitNote}</p>}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-View 2: Pharmacy Dispensing & Stock */}
            {clinicalSubTab === 'pharmacy' && (
              <div className="space-y-6 text-left animate-fade-in">
                {/* Reorder limit alerts banner */}
                {(() => {
                  const lowStockItems = activeInventory.filter(item => item.stock <= item.threshold);
                  if (lowStockItems.length === 0) return null;
                  return (
                    <div className="glass-panel p-4 border-amber-200/80 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/30 rounded-2xl flex items-start gap-3 shadow-md">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-bounce" />
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">⚠️ Low Stock &amp; Reorder Limit Alerts</h3>
                        <p className="text-[11px] text-amber-800/90 dark:text-amber-300 leading-relaxed">
                          The following {lowStockItems.length} pharmacy items are running below designated safety thresholds. Please notify procurement:
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {lowStockItems.map(item => (
                            <span key={item.id} className="bg-amber-600/10 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-600/20 dark:border-amber-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              💊 {item.name} ({item.stock} {item.unit} left | Min: {item.threshold})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Main inventory stock list catalog */}
                <div className="glass-panel p-4 sm:p-6 border-slate-200/80 dark:border-white/10 shadow-xl relative overflow-hidden bg-white dark:bg-slate-900/90 text-slate-800 dark:text-white rounded-3xl">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 to-indigo-600 opacity-80" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="space-y-1">
                      <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <Pill className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        Pharmacy Inventory &amp; Stock Catalog
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Real-time clinic medicine catalog lookup. View expiry dates, FEFO batches, prices, and stock indicators.
                      </p>
                    </div>

                    {/* Search Bar */}
                    <div className="w-full sm:w-80 relative select-none">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                        <Search className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        placeholder="Search medicine or generic name..."
                        value={medSearchQuery}
                        onChange={(e) => setMedSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition-all shadow-xs"
                      />
                      {medSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMedSearchQuery('')}
                          className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer border-0 bg-transparent"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {(() => {
                    const filtered = activeInventory.filter(item => 
                      (item.name || '').toLowerCase().includes(medSearchQuery.toLowerCase()) ||
                      (item.genericName || '').toLowerCase().includes(medSearchQuery.toLowerCase()) ||
                      (item.category || '').toLowerCase().includes(medSearchQuery.toLowerCase())
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400 font-medium select-none">
                          No medicines matched your search query.
                        </div>
                      );
                    }

                    return (
                      <div className="border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 shadow-xs">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/10">
                              <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono">Medicine Details</th>
                              <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono">Category / Mfr</th>
                              <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono text-center">Stock Level</th>
                              <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono">Batch / Expiry</th>
                              <th className="p-3.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase tracking-wider font-mono text-right">Price (MRP)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                            {filtered.map((item) => {
                              const isLowStock = item.stock <= item.threshold && item.stock > 0;
                              const isOutOfStock = item.stock === 0;
                              
                              let stockStatus = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
                              let stockText = "In Stock";
                              if (isOutOfStock) {
                                stockStatus = "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
                                stockText = "Out of Stock";
                              } else if (isLowStock) {
                                stockStatus = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 animate-pulse";
                                stockText = "Low Stock";
                              }

                              return (
                                <tr key={item.id} className="hover:bg-white/60 dark:hover:bg-white/5 transition-colors">
                                  <td className="p-3.5">
                                    <div className="font-extrabold text-slate-900 dark:text-white">{item.name}</div>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">{item.genericName}</span>
                                  </td>
                                  <td className="p-3.5">
                                    <span className="font-mono bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.2 rounded text-[10px]">{item.category}</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">{item.manufacturer}</span>
                                  </td>
                                  <td className="p-3.5 text-center">
                                    <div className="font-bold text-slate-900 dark:text-white">{item.stock} {item.unit}</div>
                                    <span className={`inline-block px-2 py-0.2 mt-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${stockStatus}`}>
                                      {stockText}
                                    </span>
                                  </td>
                                  <td className="p-3.5">
                                    <div className="font-mono font-bold text-slate-700 dark:text-slate-300">Batch: {item.batchNumber}</div>
                                    <span className={`text-[10px] font-medium block ${new Date(item.expiryDate) < new Date() ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                                      Exp: {new Date(item.expiryDate).toLocaleDateString()}
                                    </span>
                                  </td>
                                  <td className="p-3.5 text-right">
                                    <div className="font-extrabold text-slate-900 dark:text-white">₹{(item.price || 0).toFixed(2)}</div>
                                    <span className="text-[9px] text-slate-500 dark:text-slate-400 block font-mono">MRP: ₹{(item.mrp || 0).toFixed(2)}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
      </div>
    )}

        {/* ══════════════════════════════════════════════════════════
            TAB: BILLING & MINOR OT (CONSOLIDATED)
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'billing_daycare' && (
          <div className="space-y-6 animate-fade-in text-left">
            {/* Compact 3-column horizontal icon row — replaces verbose flex-wrap buttons */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-white/5">
              {/* 1. Counter Invoice */}
              <button
                type="button"
                onClick={() => {
                  setBillingSubTab('billing');
                  setBillHubInitialMode('manual_billing');
                }}
                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition active:scale-95 cursor-pointer border-0 ${
                  billingSubTab === 'billing'
                    ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  billingSubTab === 'billing' ? 'bg-white/20' : 'bg-indigo-100 dark:bg-indigo-900/40'
                }`}>
                  <Receipt className={`w-3.5 h-3.5 ${billingSubTab === 'billing' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                </div>
                <span className="text-[9.5px] font-extrabold text-center leading-tight">Counter Bill</span>
                <span className={`text-[8px] font-medium leading-tight ${billingSubTab === 'billing' ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>POS Invoicing</span>
              </button>

              {/* 2. AI Scan OCR */}
              <button
                type="button"
                onClick={() => {
                  setBillingSubTab('ocr_scan');
                  setBillHubInitialMode('ocr_scan');
                }}
                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition active:scale-95 cursor-pointer border-0 ${
                  billingSubTab === 'ocr_scan'
                    ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  billingSubTab === 'ocr_scan' ? 'bg-white/20' : 'bg-purple-100 dark:bg-purple-900/40'
                }`}>
                  <Camera className={`w-3.5 h-3.5 ${billingSubTab === 'ocr_scan' ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`} />
                </div>
                <span className="text-[9.5px] font-extrabold text-center leading-tight">AI Rx Scan</span>
                <span className={`text-[8px] font-medium leading-tight ${billingSubTab === 'ocr_scan' ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>Prescription OCR</span>
              </button>

              {/* 3. Minor OT / Daycare */}
              <button
                type="button"
                onClick={() => setBillingSubTab('ot_daycare')}
                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition active:scale-95 cursor-pointer border-0 ${
                  billingSubTab === 'ot_daycare'
                    ? 'bg-gradient-to-br from-rose-600 to-orange-500 text-white shadow-md shadow-rose-500/20'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  billingSubTab === 'ot_daycare' ? 'bg-white/20' : 'bg-rose-100 dark:bg-rose-900/40'
                }`}>
                  <Scissors className={`w-3.5 h-3.5 ${billingSubTab === 'ot_daycare' ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`} />
                </div>
                <span className="text-[9.5px] font-extrabold text-center leading-tight">{isOphthalmology ? 'Daycare' : 'Minor OT'}</span>
                <span className={`text-[8px] font-medium leading-tight ${billingSubTab === 'ot_daycare' ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>Procedures &amp; Triage</span>
              </button>
            </div>

            {/* Sub-View 1: Manual Counter Billing */}
            {billingSubTab === 'billing' && (
              <BillHubTab initialMode="manual_billing" />
            )}

            {/* Sub-View 2: AI Prescription Scan OCR */}
            {billingSubTab === 'ocr_scan' && (
              <BillHubTab initialMode="ocr_scan" />
            )}

            {/* Sub-View 3: OT & Daycare Surgery */}
            {billingSubTab === 'ot_daycare' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-800">
            {/* Left Column: Scheduled Daycare List */}
              <div className="lg:col-span-6 space-y-6">
                <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-left">
                  <div className={`absolute top-0 left-0 w-full h-[2px] ${isOphthalmology ? 'bg-rose-600' : 'bg-amber-600'} opacity-60`} />
                  <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-rose-600 shrink-0" />
                    {isOphthalmology 
                      ? `Active Scheduled Daycare Surgeries (${daycarePatients.length})` 
                      : `Active Scheduled Daycare Procedures (${daycarePatients.length})`}
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    {isOphthalmology 
                      ? 'Daycare admission OT tracker. Track lens packages, surgical preparation, and patient timeline status.'
                      : 'Daycare minor OT procedure tracker. Track dressing room status and patient timeline status.'}
                  </p>

                  <div className="space-y-3.5 lg:max-h-[480px] max-h-none lg:overflow-y-auto pr-1">
                    {daycarePatients.length === 0 ? (
                      <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-medium select-none">
                        {isOphthalmology 
                          ? 'No surgeries currently scheduled by doctors.' 
                          : 'No minor procedures currently scheduled by doctors.'}
                      </div>
                    ) : (
                      daycarePatients.map(p => {
                        const isSelected = activePatient?.id === p.id;
                        if (isOphthalmology) {
                          const booking = p.vitals?.surgeryBooking;
                          if (!booking) return null;
                          return (
                            <div
                              key={p.id}
                              onClick={() => api.setActivePatient(p)}
                              className={`p-4 border rounded-xl flex justify-between items-start cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-500/5 shadow-xs'
                                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                              }`}
                            >
                              <div className="space-y-1.5 flex-1 pr-4 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-xs text-slate-800">{p.name}</h4>
                                  <span className="text-[8px] font-mono font-bold bg-indigo-50 text-indigo-755 border border-indigo-200 px-1.5 py-0.2 rounded uppercase">
                                    Eye: {booking.eye}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500">
                                  Package: <strong>{booking.package}</strong> | Date: {booking.date}
                                </p>
                                <p className="text-[10px] text-slate-650 font-medium">
                                  Lens: {booking.lensType} | Power: {booking.iolPower || 'N/A'}
                                </p>
                              </div>
                            </div>
                          );
                        } else {
                          const booking = p.vitals?.gpProcedureBooking;
                          if (!booking) return null;
                          return (
                            <div
                              key={p.id}
                              onClick={() => api.setActivePatient(p)}
                              className={`p-4 border rounded-xl flex justify-between items-start cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-500/5 shadow-xs'
                                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                              }`}
                            >
                              <div className="space-y-1.5 flex-1 pr-4 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-xs text-slate-800">{p.name}</h4>
                                  <span className="text-[8px] font-mono font-bold bg-amber-50 text-amber-750 border border-amber-200 px-1.5 py-0.2 rounded uppercase">
                                    Room: {booking.room}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500">
                                  Type: <strong>{booking.procedure}</strong> | Date: {booking.date}
                                </p>
                              </div>
                            </div>
                          );
                        }
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Daycare Room Timelines & Surgeon Schedules */}
              <div className="lg:col-span-6 space-y-6 text-left select-none animate-fade-in">
                {/* Scheduled Surgeons list */}
                <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-rose-650 opacity-60" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase font-mono tracking-wider mb-4 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    Scheduled Surgeons &amp; Specialists Today
                  </h3>
                  
                  <div className="space-y-3.5">
                    {[
                      { name: activePod?.doctor_name || 'Chief Ophthalmic Surgeon', role: 'Chief Ophthalmic Surgeon', status: 'In OT (Eye Room A)', time: '10:00 AM - 02:00 PM', specialty: 'Phacoemulsification & Glaucoma' },
                      { name: 'Dr. Priya Sen', role: 'Consultant Anesthesiologist', status: 'Pre-op Blocks (Ward B)', time: '09:30 AM - 01:30 PM', specialty: 'Regional & Topical Anesthesia' },
                      { name: 'Dr. Amit Roy', role: 'General & Laparoscopic Surgeon', status: 'On Call (Minor OT)', time: '12:00 PM - 04:00 PM', specialty: 'Excision & Wound Debridement' }
                    ].map((s, idx) => (
                      <div key={`surgeon-stat-${idx}-${s.name}`} className="p-3 border border-slate-200 rounded-xl bg-slate-50 flex items-start gap-3 hover:bg-slate-100/65 transition-all">
                        <UserCheck className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-0.5">
                          <div className="flex justify-between items-center flex-wrap gap-1">
                            <h4 className="font-bold text-xs text-slate-800">{s.name}</h4>
                            <span className="text-[9px] bg-rose-50 text-rose-800 border border-rose-150 px-1.5 py-0.2 rounded font-mono font-bold">{s.time}</span>
                          </div>
                          <p className="text-[10px] text-slate-555 font-semibold">{s.role} · <span className="text-slate-455">{s.specialty}</span></p>
                          <div className="flex items-center gap-1 mt-1 text-[9px] text-emerald-650 font-bold font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {s.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daycare Room Log Timelines */}
                <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden bg-white text-slate-800">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-655 opacity-60" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase font-mono tracking-wider mb-4 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    Daycare OT Room Timelines &amp; Pre-op Checks
                  </h3>

                  <div className="relative border-l border-indigo-100 pl-4 ml-2.5 space-y-5 py-1 text-xs">
                    {[
                      { time: '10:15 AM', label: 'Patient admission checks completed', desc: 'Pre-op vitals logged, ABHA consent verified at desk.' },
                      { time: '11:00 AM', label: 'Local block anesthetic administration', desc: 'Topical anesthetic drops and block administered by Dr. Sen.' },
                      { time: '11:30 AM', label: 'OT Procedure started (Cataract Phaco)', desc: `Surgeon ${activePod?.doctor_name || 'Chief Surgeon'} started Phaco surgery under microscope.` },
                      { time: '12:00 PM', label: 'Patient shifted to Recovery Ward', desc: 'IOL lens successfully placed. Shifted to Ward B for monitoring.' },
                      { time: '12:45 PM', label: 'Discharge clearance & counseling', desc: 'Post-op dosage directions pushed to patient WhatsApp.' }
                    ].map((t, idx) => (
                      <div key={`ot-timeline-${idx}-${t.time}`} className="relative group">
                        <span className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white shadow-xs group-hover:scale-125 transition-transform" />
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-[9px] text-indigo-600 block">{t.time}</span>
                          <h4 className="font-bold text-slate-800 text-[11px]">{t.label}</h4>
                          <p className="text-[10px] text-slate-500 leading-normal">{t.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Sliding WhatsApp Chat Drawer */}
      <div 
        className={[
          "fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl transition-transform duration-350 ease-in-out transform flex flex-col",
          isChatDrawerOpen ? "translate-x-0" : "translate-x-full"
].join(" ")}
      >
        <div className="bg-[#075e54] p-4 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3 select-none">
            <div className="h-9 w-9 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-sm shrink-0 border border-white/20">
              💬
            </div>
            <div className="text-left">
              <h3 className="font-bold text-sm text-white">WhatsApp Live Simulator</h3>
              <p className="text-[9px] text-emerald-250 flex items-center gap-1 font-semibold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ACTIVE VERIFICATION SERVICE
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsChatDrawerOpen(false)}
            className="p-1.5 text-white hover:text-slate-100 rounded-lg hover:bg-white/10 transition cursor-pointer border-0 bg-transparent flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Session Selector Dropdown */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800 p-3 flex items-center gap-2 select-none text-left shrink-0">
          <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0">
            Select Patient Loop:
          </span>
          <select
            value={activeSession?.patientPhone || ''}
            onChange={(e) => {
              const phone = e.target.value;
              const sess = sessions.find(s => s.patientPhone === phone);
              if (sess) {
                setActiveSession(sess);
                const phoneDigits = (phone || '').replace(/\D/g, '').slice(-10);
                const pat = patients.find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === phoneDigits);
                if (pat) {
                  api.setActivePatient(pat);
                }
              } else {
                setActiveSession(null);
              }
            }}
            className="flex-1 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-350 outline-none font-medium"
          >
            <option value="">-- Select Active Loop --</option>
            {sessions.map(s => {
              const sDigits = (s.patientPhone || (s as any).patient_phone || '').replace(/\D/g, '').slice(-10);
              const pat = patients.find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === sDigits);
              const name = pat ? pat.name : 'Unknown Patient';
              return (
                <option key={s.id} value={s.patientPhone}>
                  {name} ({s.patientPhone}) - State: {s.currentState.replace('_', ' ')}
                </option>
              );
            })}
          </select>
        </div>

        {activeSession ? (
          <div 
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 bg-[#efeae2] dark:bg-slate-950 p-4 overflow-y-auto space-y-4 font-sans text-xs"
          >
            {(() => {
                const sessData = activeSession.sessionData || (activeSession as any).session_data || {};
                const chatHistory = sessData.chatHistory || [];
                return chatHistory.map((msg: ChatMessage, idx: number) => {
                  const isBot = msg.sender === 'bot';
                  return (
                    <div 
                      key={`sim-chat-${idx}-${msg.sender}-${(msg.text || '').slice(0, 15)}`} 
                      className={`flex ${isBot ? 'justify-start' : 'justify-end'} animate-fade-in`}
                    >
                      <div 
                        className={`max-w-[85%] p-3 rounded-xl shadow-xs relative leading-relaxed ${
                          isBot 
                            ? 'bg-white dark:bg-slate-900 rounded-tl-none text-slate-800 dark:text-slate-250 border border-slate-250/20' 
                            : 'bg-[#d9fdd3] dark:bg-emerald-950/45 rounded-tr-none text-slate-855 dark:text-slate-200 border border-emerald-500/10'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-line font-mono text-[11px] font-medium">{msg.text}</p>
                        
                        {isBot && (msg?.text || '').includes('Welcome to Mediflow') && activeSession.currentState === 'AWAITING_WELCOME' && (
                          <div className="mt-3 pt-3 border-t border-slate-105 dark:border-slate-850 flex flex-col gap-2 select-none">
                            <button
                              onClick={() => {
                                api.processIncomingWhatsAppMessage(activeSession.patientPhone, '1');
                                syncData();
                              }}
                              className="bg-emerald-655 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-center shadow active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer border-0"
                            >
                              Grant Consent
                            </button>
                          </div>
                        )}
                        {isBot && (msg?.text || '').includes('consent is committed') && activeSession.currentState !== 'AWAITING_WELCOME' && (
                          <div className="mt-2 flex items-center gap-1 text-emerald-600 dark:text-emerald-450 text-[9px] font-bold uppercase tracking-wider select-none">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-655 animate-pulse" /> Consent Registered
                          </div>
                        )}

                        <span className="block text-[8px] text-slate-500 text-right mt-1.5 font-mono select-none">
                          {msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 select-none">
              <MessagesSquare className="w-12 h-12 text-slate-400 animate-pulse" />
              <div>
                <h4 className="font-bold text-slate-705 dark:text-slate-350 text-xs">No Active Chat Loop</h4>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1 leading-relaxed">
                  Search a patient registry or click the WhatsApp button next to a patient to select active chat session.
                </p>
              </div>
            </div>
          )}
        
        <form onSubmit={handleSendReply} className="bg-[#f0f2f5] dark:bg-slate-900 p-3 border-t border-slate-205 dark:border-slate-800 flex gap-2 shrink-0">
          <input
            type="text"
            value={replyInput}
            onChange={(e) => setReplyInput(e.target.value)}
            disabled={!activeSession}
            placeholder={activeSession ? "Send message over secure gateway..." : "Select patient loop to type"}
            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-full px-4 py-2.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
          <button 
            type="submit"
            disabled={!activeSession || !replyInput.trim()} 
            className={
              'p-2.5 rounded-full transition-colors border-0 shrink-0 ' +
              (activeSession && replyInput.trim() 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-slate-855 cursor-pointer shadow active:scale-95' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-655')
            }
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {viewingDocUrl && createPortal(
        <div className="fixed inset-0 bg-slate-800/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200/60 rounded-2xl max-w-2xl w-full p-6 space-y-4 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-teal-500" />
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400 shrink-0" />
                Prescription Document Viewer
              </h3>
              <button
                onClick={() => setViewingDocUrl(null)}
                className="p-1.5 text-slate-600 hover:text-slate-800 bg-white/5 hover:bg-white/10 border-0 rounded-lg cursor-pointer transition active:scale-95 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-slate-800/40 rounded-xl border border-white/5 overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh] p-2">
              {viewingDocUrl.startsWith('data:application/pdf') ? (
                <iframe src={viewingDocUrl} className="w-full h-[500px] border-0 rounded-lg" title="PDF Document Viewer" />
              ) : (
                <img src={viewingDocUrl} className="max-w-full max-h-[500px] object-contain rounded-lg shadow-md" alt="Prescription Document Preview" />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setViewingDocUrl(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-800 font-bold rounded-xl text-xs cursor-pointer border-0 active:scale-95 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Interactive Workflow Document Viewer Modal */}
      {activeWorkflowDetail && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] text-slate-800 dark:text-slate-100">
            {/* Header */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-rose-500 to-emerald-500" />
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {activeWorkflowDetail.type === 'prescription' && <FileText className="h-5 w-5 text-indigo-500" />}
                {activeWorkflowDetail.type === 'lab' && <Activity className="h-5 w-5 text-rose-500" />}
                {activeWorkflowDetail.type === 'summary' && <Smartphone className="h-5 w-5 text-emerald-500" />}
                {activeWorkflowDetail.type === 'prescription' && 'Consultation Prescription'}
                {activeWorkflowDetail.type === 'lab' && 'Pathology Lab Results'}
                {activeWorkflowDetail.type === 'summary' && 'WhatsApp Summary & Logs'}
              </h3>
              <button
                onClick={() => setActiveWorkflowDetail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer bg-transparent border-0 outline-none flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-3 rounded-xl">
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">Patient Name</div>
                  <div className="text-xs font-bold font-mono">{activeWorkflowDetail.patientName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">Patient ID / Ref</div>
                  <div className="text-xs font-bold font-mono">{(activeWorkflowDetail.patientId || '').substring(0, 8).toUpperCase()}</div>
                </div>
              </div>

              {/* PRESCRIPTION TYPE */}
              {activeWorkflowDetail.type === 'prescription' && (() => {
                const patientEncounters = EncounterService.getEncounters().filter(e => e.patientId === activeWorkflowDetail.patientId);
                const latestEncounter = patientEncounters[patientEncounters.length - 1];

                if (!latestEncounter) {
                  return (
                    <div className="text-center py-8 px-4 border border-dashed border-slate-350 dark:border-slate-800 rounded-2xl">
                      <p className="text-slate-500 dark:text-slate-400 italic text-[11px]">
                        No active consultation record found. The consultation is either pending or the doctor has not submitted the final e-prescription for this session yet.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {latestEncounter.clinicalNotes && (
                      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-950/40 p-4 rounded-2xl">
                        <h4 className="font-bold text-indigo-750 dark:text-indigo-400 mb-1.5 uppercase tracking-wider text-[9px] font-mono flex items-center gap-1.5">
                          Clinical Notes / Advice
                        </h4>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{latestEncounter.clinicalNotes}</p>
                      </div>
                    )}

                    {latestEncounter.medications && latestEncounter.medications.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider text-[9px] font-mono flex items-center gap-1.5">
                          Prescribed Medications
                        </h4>
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950/60">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Medicine</th>
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Dosage</th>
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {latestEncounter.medications.map((med, idx) => {
                                const bilingual = getBilingualInstruction(med.medicineName, med.dosage);
                                return (
                                  <tr key={`wf-med-${idx}-${med.medicineName}`} className="border-b border-slate-200 dark:border-slate-800/80 last:border-0">
                                    <td className="p-2.5">
                                      <div className="font-bold text-slate-800 dark:text-slate-200">{med.medicineName}</div>
                                      <div className="text-[9.5px] text-slate-500 dark:text-slate-400 italic mt-0.5">{bilingual.english} / {bilingual.hindi}</div>
                                    </td>
                                    <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">{med.dosage || med.frequency}</td>
                                    <td className="p-2.5 text-slate-500 dark:text-slate-400">{med.duration}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400 italic text-center py-4">No medications prescribed in this session.</p>
                    )}
                  </div>
                );
              })()}

              {/* LAB TYPE */}
              {activeWorkflowDetail.type === 'lab' && (() => {
                const reqs = LabService.getLabRequisitions().filter(r => r.patientId === activeWorkflowDetail.patientId);
                const reports = LabService.getFullLabReports().filter(r => r.patientId === activeWorkflowDetail.patientId);

                if (reqs.length === 0 && reports.length === 0) {
                  return (
                    <div className="text-center py-8 px-4 border border-dashed border-slate-350 dark:border-slate-800 rounded-2xl">
                      <p className="text-slate-500 dark:text-slate-400 italic text-[11px]">
                        No laboratory requisitions or processed pathology results have been registered for this patient yet.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {reports.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider text-[9px] font-mono">
                          Approved Pathology Reports
                        </h4>
                        <div className="space-y-2">
                          {reports.map((report) => (
                            <div key={report.id} className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950/40 p-4 rounded-2xl">
                              <div className="flex justify-between items-center mb-2.5 pb-1 border-b border-rose-200/40">
                                <span className="font-bold text-[10px] text-rose-700 dark:text-rose-450 uppercase font-mono">Report: {report.status}</span>
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                                  Approved: {report.approvedAt ? new Date(report.approvedAt).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>

                              {report.biomarkerJson ? (
                                <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                                  {Object.entries(report.biomarkerJson).map(([key, val]: [string, any]) => (
                                    <div key={key} className="bg-white/80 dark:bg-slate-900 border border-rose-100/50 dark:border-slate-800 p-2 rounded-xl flex justify-between items-center">
                                      <span className="font-semibold text-slate-600 dark:text-slate-400 font-mono text-[9.5px] uppercase">{key}</span>
                                      <span className="font-bold text-slate-805 dark:text-slate-200">{val}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-slate-500 dark:text-slate-400 italic text-center text-[10px]">No biomarker values logged in results.</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {reqs.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider text-[9px] font-mono">
                          Requisitions &amp; Sample Status
                        </h4>
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950/60">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Test Name</th>
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Barcode</th>
                                <th className="p-2.5 font-bold text-slate-600 dark:text-slate-400 text-[9px] uppercase font-mono">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reqs.map((req, idx) => (
                                <tr key={`wf-req-${idx}-${req.barcode || req.testName}`} className="border-b border-slate-200 dark:border-slate-800/80 last:border-0">
                                  <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{req.testName}</td>
                                  <td className="p-2.5 font-mono text-slate-500 dark:text-slate-400">{req.barcode}</td>
                                  <td className="p-2.5">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                      req.status === 'completed'
                                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                    }`}>
                                      {req.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SUMMARY TYPE */}
              {activeWorkflowDetail.type === 'summary' && (() => {
                const patientObj = patients.find(p => p.id === activeWorkflowDetail.patientId);
                const pDigits = (patientObj?.phone || '').replace(/\D/g, '').slice(-10);
                const sessionList = api.getWhatsAppSessions();
                const session = sessionList.find(s => {
                  const sDigits = (s.patientPhone || (s as any).patient_phone || '').replace(/\D/g, '').slice(-10);
                  return sDigits && pDigits && sDigits === pDigits;
                });

                if (!session || !session.sessionData?.chatHistory || session.sessionData.chatHistory.length === 0) {
                  return (
                    <div className="text-center py-8 px-4 border border-dashed border-slate-350 dark:border-slate-800 rounded-2xl">
                      <p className="text-slate-500 dark:text-slate-400 italic text-[11px]">
                        No active WhatsApp conversation history or summary logs found for this patient phone number.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider text-[9px] font-mono">
                      WhatsApp Dialogue History
                    </h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-950/60 space-y-3 max-h-[350px] overflow-y-auto">
                      {session.sessionData.chatHistory.map((msg: any, idx: number) => {
                        const isBot = msg.sender === 'bot' || msg.sender === 'system';
                        return (
                          // Bug Fix #8: Use stable composite key to prevent React reconciliation glitches
                          <div key={msg.id || msg.timestamp || `cmsg-${idx}-${(msg.text || '').slice(0, 10)}`} className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}>
                            <div className={`p-2.5 rounded-2xl max-w-[85%] border text-[11px] leading-relaxed whitespace-pre-wrap ${
                              isBot
                                ? 'bg-indigo-500/10 text-indigo-750 dark:text-indigo-300 border-indigo-500/20 rounded-tl-none'
                                : 'bg-emerald-500/10 text-emerald-750 dark:text-emerald-300 border-emerald-500/20 rounded-tr-none'
                            }`}>
                              {msg.text}
                            </div>
                            <span className="text-[8px] text-slate-400 mt-1 font-mono">{msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveWorkflowDetail(null)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer border-0 active:scale-95 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Vitals Intake & Payment Clearance Modal for Routing Patient to Doctor */}
      {vitalsPatient && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={() => setVitalsPatient(null)}
        >
          <div 
            className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-scale-in text-slate-800 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white relative">
              {(() => {
                const activeSrcTag = getPatientSourceTag(vitalsPatient);
                const activeSrcBadge = activeSrcTag === 'whatsapp' 
                  ? '🟢 [W] WhatsApp Confirmed'
                  : activeSrcTag === 'qr_scan'
                  ? '📲 [QR] Self-Registered'
                  : '🏥 [C] Counter Registered';

                return (
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2.5 py-0.5 rounded-lg bg-white/20 text-white font-mono font-black text-xs">
                            #{String(vitalsPatient.tokenNumber || (vitalsPatient as any).token_number || 'T-04').startsWith('T-') || String(vitalsPatient.tokenNumber || (vitalsPatient as any).token_number || '').startsWith('TK-') ? (vitalsPatient.tokenNumber || (vitalsPatient as any).token_number || 'T-04') : `TK-${String(vitalsPatient.tokenNumber || (vitalsPatient as any).token_number || '04').padStart(2, '0')}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 ${
                            activeSrcTag === 'whatsapp'
                              ? 'bg-emerald-400 text-emerald-950'
                              : activeSrcTag === 'qr_scan'
                              ? 'bg-purple-300 text-purple-950'
                              : 'bg-amber-300 text-amber-950'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                            {activeSrcBadge}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-white">{vitalsPatient.name}</h3>
                        <p className="text-xs text-indigo-100/90 font-mono mt-0.5">
                          📱 +91 {vitalsPatient.phone} · {vitalsPatient.age ? `${vitalsPatient.age}y` : 'Adult'} ({vitalsPatient.gender || 'Male'})
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVitalsPatient(null)}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer border-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Inline Switch Patient Dropdown */}
                    <div className="mt-3 pt-3 border-t border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-white/90 shrink-0">
                        Switch Patient ({pendingVitalsList.length} in queue):
                      </span>
                      <select
                        className="w-full sm:w-auto flex-1 bg-white/20 hover:bg-white/30 border border-white/30 text-white rounded-xl px-2.5 py-1 text-xs font-bold outline-none cursor-pointer backdrop-blur-sm transition"
                        value={vitalsPatient.id}
                        onChange={(e) => {
                          const next = patients.find(p => p.id === e.target.value);
                          if (next) {
                            setVitalsPatient(next);
                          }
                        }}
                      >
                        <option value={vitalsPatient.id} className="text-slate-900 font-bold">
                          #{vitalsPatient.tokenNumber || 'TK'} · {vitalsPatient.name} (Current)
                        </option>
                        {pendingVitalsList.filter(p => p.id !== vitalsPatient.id).map(p => {
                          const tag = getPatientSourceTag(p);
                          const tagLabel = tag === 'whatsapp' ? 'WhatsApp 🟢' : tag === 'qr_scan' ? 'QR 📲' : 'Counter 🏥';
                          return (
                            <option key={p.id} value={p.id} className="text-slate-900 font-medium">
                              #{p.tokenNumber || 'TK'} · {p.name} [{tagLabel}] (+91 {p.phone.slice(-4)})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Modal Body: Vitals Intake Form */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                    Consultation Fee &amp; Payment Clearance
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    ₹500.00 Doctor Consultation Fee
                  </span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-mono font-bold rounded-lg shadow-sm">
                  Payment Verified ✅
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  Clinical Vitals Entry
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {/* Blood Pressure */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      🩺 Blood Pressure
                    </label>
                    <input
                      type="text"
                      value={bpVal}
                      onChange={(e) => setBpVal(e.target.value)}
                      placeholder="120/80"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">mmHg</span>
                  </div>

                  {/* Pulse Rate */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      💓 Pulse Rate
                    </label>
                    <input
                      type="number"
                      value={pulseVal}
                      onChange={(e) => setPulseVal(e.target.value)}
                      placeholder="72"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">bpm</span>
                  </div>

                  {/* Temperature */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      🌡️ Temperature
                    </label>
                    <input
                      type="text"
                      value={tempVal}
                      onChange={(e) => setTempVal(e.target.value)}
                      placeholder="98.6"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">°F</span>
                  </div>

                  {/* SpO2 Level */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      🫁 SpO2 Level
                    </label>
                    <input
                      type="number"
                      value={spo2Val}
                      onChange={(e) => setSpo2Val(e.target.value)}
                      placeholder="99"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">%</span>
                  </div>

                  {/* Blood Sugar */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      🩸 Blood Sugar (RBS)
                    </label>
                    <input
                      type="number"
                      value={sugarVal}
                      onChange={(e) => setSugarVal(e.target.value)}
                      placeholder="105"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">mg/dL</span>
                  </div>

                  {/* Weight */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      ⚖️ Body Weight
                    </label>
                    <input
                      type="number"
                      value={weightVal}
                      onChange={(e) => setWeightVal(e.target.value)}
                      placeholder="65"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">kg</span>
                  </div>

                  {/* Height */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      📏 Height
                    </label>
                    <input
                      type="number"
                      value={heightVal}
                      onChange={(e) => setHeightVal(e.target.value)}
                      placeholder="165"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">cm</span>
                  </div>

                  {/* Computed BMI Badge */}
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl space-y-1">
                    <label className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase font-mono block">
                      ⚡ Calculated BMI
                    </label>
                    <div className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                      {computedBmi.bmi} <span className="text-[9px] font-normal">kg/m²</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold block">{computedBmi.category}</span>
                  </div>
                </div>

                {/* Quick Presets for Rapid Entry */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Rapid Vitals Presets (1-Tap Fast Fill)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { setBpVal('120/80'); setPulseVal('72'); setTempVal('98.6'); setSpo2Val('99'); }}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer transition border border-slate-200 dark:border-slate-700"
                    >
                      BP 120/80 · Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => { setBpVal('140/90'); setPulseVal('84'); setTempVal('98.6'); setSpo2Val('98'); }}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer transition border border-slate-200 dark:border-slate-700"
                    >
                      BP 140/90 · Mild HTN
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTempVal('101.2'); setPulseVal('96'); setSpo2Val('97'); }}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-[10px] font-mono font-bold text-rose-700 dark:text-rose-400 rounded-lg cursor-pointer transition border border-rose-200 dark:border-rose-800"
                    >
                      Temp 101.2°F · Fever
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setVitalsPatient(null)}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer border-0"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingVitals}
                onClick={handleApproveVitalsAndRouteToDoctor}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer transition border-0 uppercase tracking-wider"
              >
                {isSavingVitals ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Routing to Doctor Chamber...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Vitals &amp; Route to Doctor 🩺
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Enhanced Rapid Vitals Intake Bottom Sheet (showVitalsBottomSheet) ──── */}
      {showVitalsBottomSheet && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={() => {
            setShowVitalsBottomSheet(false);
            setVitalsSearchTerm('');
          }}
        >
          <div 
            className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up text-slate-800 dark:text-white flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-teal-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-black">Rapid Vitals Intake — Today's OPD</h3>
                  <p className="text-[10px] text-indigo-100/90 font-mono">
                    WhatsApp Chatbot Bookings, QR Self-Registrations &amp; Counter Intake
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowVitalsBottomSheet(false);
                  setVitalsSearchTerm('');
                }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Source Segment Tabs */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-white/10 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVitalsSourceFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    vitalsSourceFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  All Awaiting ({pendingVitalsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVitalsSourceFilter('whatsapp')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    vitalsSourceFilter === 'whatsapp'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  WhatsApp Bot 🟢 ({whatsappPendingVitals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVitalsSourceFilter('qr_scan')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    vitalsSourceFilter === 'qr_scan'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" /> QR Scan 📲 ({qrPendingVitals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVitalsSourceFilter('counter')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    vitalsSourceFilter === 'counter'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  Walk-In 🏥 ({counterPendingVitals.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mt-2.5">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  value={vitalsSearchTerm}
                  onChange={(e) => setVitalsSearchTerm(e.target.value)}
                  placeholder="Search patient by name, mobile number, or token #..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Dropdown Quick Pick & Patient List */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Or Quick Dropdown Selection
                </label>
                <select 
                  className="w-full input-field text-xs font-bold py-2.5"
                  onChange={(e) => {
                    const found = patients.find(p => p.id === e.target.value);
                    if (found) {
                      setShowVitalsBottomSheet(false);
                      setVitalsSearchTerm('');
                      setVitalsPatient(found);
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Choose Patient ({filteredPendingVitalsList.length} in view)...</option>
                  {filteredPendingVitalsList.map(p => {
                    const srcTag = getPatientSourceTag(p);
                    const srcLabel = srcTag === 'whatsapp' ? 'WhatsApp Bot 🟢' : srcTag === 'qr_scan' ? 'QR Scan 📲' : 'Walk-In 🏥';
                    return (
                      <option key={p.id} value={p.id}>
                        #{p.tokenNumber || 'TK'} · {p.name} · [{srcLabel}] (+91 {p.phone.slice(-4)})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 pt-2">
                Patients Awaiting Vitals ({filteredPendingVitalsList.length})
              </div>

              <div className="space-y-2">
                {filteredPendingVitalsList.map((p) => {
                  const srcTag = getPatientSourceTag(p);
                  const isWhatsApp = srcTag === 'whatsapp';
                  const isQr = srcTag === 'qr_scan';

                  return (
                    <div 
                      key={p.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                        isWhatsApp
                          ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : isQr
                          ? 'border-purple-200 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-xl font-mono font-black text-xs flex items-center justify-center shadow-xs ${
                          isWhatsApp
                            ? 'bg-emerald-600 text-white'
                            : isQr
                            ? 'bg-purple-600 text-white'
                            : 'bg-indigo-600 text-white'
                        }`}>
                          #{p.tokenNumber ? String(p.tokenNumber).slice(-2) : 'TK'}
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-white">{p.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-mono font-bold ${
                              isWhatsApp
                                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                : isQr
                                ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}>
                              {isWhatsApp ? 'WhatsApp Bot 🟢' : isQr ? 'QR Scan 📲' : 'Walk-In 🏥'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            +91 {p.phone} · Age: {p.age || '35'} · {p.gender}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowVitalsBottomSheet(false);
                          setVitalsSearchTerm('');
                          setVitalsPatient(p);
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-[10px] font-bold rounded-xl cursor-pointer transition border-0 flex items-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        Record Vitals
                      </button>
                    </div>
                  );
                })}

                {filteredPendingVitalsList.length === 0 && (
                  <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No Patients Waiting in This Category
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {vitalsSearchTerm
                        ? `No patients matching "${vitalsSearchTerm}"`
                        : 'All patients in this segment have completed their vitals intake.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Quick Add Patient Modal (showQuickAddSheet) ───────────────────────── */}
      {showQuickAddSheet && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={() => setShowQuickAddSheet(false)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up text-slate-800 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-black">Quick Walk-In Registration</h3>
                  <p className="text-[10px] text-indigo-100/90 font-mono">Auto-assigns token &amp; consultation invoice</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddSheet(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => {
              handleQuickRegisterPatient(e);
              setShowQuickAddSheet(false);
            }} className="p-5 space-y-3.5">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={quickRegName}
                  onChange={e => setQuickRegName(e.target.value)}
                  className="w-full input-field text-xs py-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={quickRegPhone}
                    onChange={e => setQuickRegPhone(e.target.value)}
                    className="w-full input-field text-xs py-2.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    Age (Years) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="120"
                    placeholder="35"
                    value={quickRegAge}
                    onChange={e => setQuickRegAge(e.target.value)}
                    className="w-full input-field text-xs py-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    Gender
                  </label>
                  <select
                    value={quickRegGender}
                    onChange={e => setQuickRegGender(e.target.value as any)}
                    className="w-full input-field text-xs py-2.5"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    ABHA ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="ABHA-1234..."
                    value={quickRegAbha}
                    onChange={e => setQuickRegAbha(e.target.value)}
                    className="w-full input-field text-xs py-2.5"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer transition border-0 uppercase tracking-wider"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Register &amp; Issue OPD Token 🎫
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Start Eye Dilation Modal (showDilationModal) ───────────────────────── */}
      {showDilationModal && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={() => setShowDilationModal(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-scale-in text-slate-800 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Eye className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-black">Start 15-Min Eye Dilation</h3>
                  <p className="text-[10px] text-cyan-100 font-mono">{showDilationModal.name} · Token #{showDilationModal.tokenNumber || 'TK'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDilationModal(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                  Select Eye
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'both', label: 'Both Eyes (BE)' },
                    { id: 're', label: 'Right Eye (OD)' },
                    { id: 'le', label: 'Left Eye (OS)' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedDilationEye(opt.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        selectedDilationEye === opt.id
                          ? 'bg-cyan-50 dark:bg-cyan-950 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                  Mydriatic Eye Drop
                </label>
                <select
                  value={selectedDilationDrop}
                  onChange={e => setSelectedDilationDrop(e.target.value as any)}
                  className="w-full input-field text-xs py-2.5 font-bold"
                >
                  <option value="tropicamide">Tropicamide 0.8% + Phenylephrine 5% (Standard 15m)</option>
                  <option value="cyclopentolate">Cyclopentolate 1% (Pediatric / Refraction)</option>
                  <option value="homatropine">Homatropine 2% (Uveitis / Extended)</option>
                </select>
              </div>

              <div className="p-3 bg-cyan-50 dark:bg-cyan-950/40 rounded-xl border border-cyan-200 dark:border-cyan-800 text-[11px] text-cyan-800 dark:text-cyan-300">
                ⏱️ Starts an autonomous 15-minute countdown on the Compounder &amp; Doctor Dashboards. Alerts when pupil is fully dilated.
              </div>

              <button
                type="button"
                onClick={() => handleStartEyeDilation(showDilationModal)}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition border-0 uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Timer className="w-4 h-4" />
                Apply Drops &amp; Start 15-Min Timer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Dedicated Instant Appointment & Vitals Intake Desk Modal (showInstantAppointmentModal) ── */}
      {showInstantAppointmentModal && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={() => setShowInstantAppointmentModal(false)}
        >
          <div 
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up text-slate-800 dark:text-white flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shadow-inner">
                  <Sparkles className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black">Instant Appointment &amp; Vitals Desk</h3>
                    <span className="px-2 py-0.5 bg-white/20 text-[9px] font-bold rounded-full uppercase font-mono">
                      Fast OPD
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-100/90 font-medium">
                    1-Click Walk-In Registration, Fee Clearance &amp; Token Dispatch
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstantAppointmentModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer border-0 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* Last Issued Token Banner (Multi-Person Booking Helper) */}
              {lastIssuedInstantToken && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between gap-3 text-emerald-900 dark:text-emerald-200 animate-fade-in shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-xs">
                      #{lastIssuedInstantToken.token}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black truncate">
                        Token #{lastIssuedInstantToken.token} Issued for {lastIssuedInstantToken.name}!
                      </div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                        ✓ Routed to Doctor chamber. Ready for next walk-in patient below:
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setLastIssuedInstantToken(null)}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 underline cursor-pointer border-0 bg-transparent shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <form onSubmit={handleInstantAppointmentAndVitals} className="space-y-4">
                {/* 1. Search & Patient Auto-Suggest */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-12 relative">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                      Search Existing Patient (Prefix e.g. "N", "Ramesh" / Patient ID e.g. "N2" / Mobile)
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="text"
                        value={instantSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInstantSearchQuery(val);
                          const q = val.trim().toLowerCase();
                          if (!q) {
                            setInstantSelectedPatient(null);
                          } else {
                            // Check exact single code match (e.g. typing "N2" where patientCode === "N2")
                            const exactMatch = patients.find(p => {
                              const code = (p.patientCode || (p as any).patient_code || p.id || '').toLowerCase();
                              return code === q;
                            });
                            if (exactMatch) {
                              setInstantSelectedPatient(exactMatch);
                              setInstantName(exactMatch.name);
                              setInstantPhone(exactMatch.phone);
                              setInstantAge(String(exactMatch.age || '35'));
                              setInstantGender(exactMatch.gender || 'Male');
                            }
                          }
                        }}
                        placeholder="Search by name prefix (N...), Patient ID / Smart Code (N2...), or mobile number..."
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-2xl pl-10 pr-9 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition"
                      />
                      {instantSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setInstantSearchQuery('');
                            setInstantSelectedPatient(null);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer border-0 bg-transparent"
                        >
                          ✕
                        </button>
                      )}

                      {/* Dropdown Suggestions List (Prefix & Smart Code Matches) */}
                      {instantMatchingPatients.length > 0 && !instantSelectedPatient && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-slide-up">
                          <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800/90 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center justify-between">
                            <span>Matching Registered Patients</span>
                            <span>Tap to Select</span>
                          </div>
                          {instantMatchingPatients.map((p) => {
                            const pCode = p.patientCode || (p as any).patient_code || ('PID-' + p.id.slice(0, 6).toUpperCase());
                            return (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setInstantSelectedPatient(p);
                                  setInstantName(p.name);
                                  setInstantPhone(p.phone);
                                  setInstantAge(String(p.age || '35'));
                                  setInstantGender(p.gender || 'Male');
                                  setInstantSearchQuery('');
                                }}
                                className="p-2.5 px-3.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer transition flex items-center justify-between gap-3 text-left"
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <span>{p.name}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-200/60 dark:border-indigo-800 font-bold">
                                      ID: {pCode}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                    +91 {p.phone} · {p.age}y / {p.gender}
                                  </div>
                                </div>
                                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                  Select ➔
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Selected Patient Confirmation Banner (Shows Patient ID, NEVER past token number) */}
                    {instantSelectedPatient && (
                      <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between gap-2 animate-fade-in shadow-2xs">
                        <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 text-xs font-bold min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="truncate">
                            Registered Record: <span className="font-black">{instantSelectedPatient.name}</span> · ID: <span className="font-mono font-black">{instantSelectedPatient.patientCode || (instantSelectedPatient as any).patient_code || ('PID-' + instantSelectedPatient.id.slice(0, 6).toUpperCase())}</span> (+91 {instantSelectedPatient.phone.slice(-4)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setInstantSelectedPatient(null);
                            setInstantSearchQuery('');
                            setInstantName('');
                            setInstantPhone('');
                            setInstantAge('');
                          }}
                          className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 underline cursor-pointer border-0 bg-transparent shrink-0"
                        >
                          ✕ Clear / Change
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                      Patient Full Name *
                    </label>
                    <input 
                      type="text"
                      required
                      value={instantName}
                      onChange={(e) => setInstantName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                      10-Digit Mobile *
                    </label>
                    <input 
                      type="tel"
                      required
                      maxLength={10}
                      value={instantPhone}
                      onChange={(e) => setInstantPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="9876543210"
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                      Age
                    </label>
                    <input 
                      type="number"
                      value={instantAge}
                      onChange={(e) => setInstantAge(e.target.value)}
                      placeholder="35"
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 text-center transition"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                      Gender
                    </label>
                    <select
                      value={instantGender}
                      onChange={(e) => setInstantGender(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 text-center transition"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* 2. Vitals Numeric Grid */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-white/5 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Patient Vitals Intake
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                    <div>
                      <label className="text-[9px] font-mono font-bold text-slate-500 uppercase block mb-0.5">BP (mmHg)</label>
                      <div className="flex items-center gap-1">
                        <input 
                          type="text"
                          value={instantBpSys}
                          onChange={(e) => setInstantBpSys(e.target.value)}
                          placeholder="120"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-center text-slate-800 dark:text-white outline-none"
                        />
                        <span className="text-slate-400 text-xs font-mono">/</span>
                        <input 
                          type="text"
                          value={instantBpDia}
                          onChange={(e) => setInstantBpDia(e.target.value)}
                          placeholder="80"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-center text-slate-800 dark:text-white outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-mono font-bold text-slate-500 uppercase block mb-0.5">Pulse (bpm)</label>
                      <input 
                        type="text"
                        value={instantPulse}
                        onChange={(e) => setInstantPulse(e.target.value)}
                        placeholder="72"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-center text-slate-800 dark:text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-mono font-bold text-slate-500 uppercase block mb-0.5">SpO2 (%)</label>
                      <input 
                        type="text"
                        value={instantSpO2}
                        onChange={(e) => setInstantSpO2(e.target.value)}
                        placeholder="99"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-center text-slate-800 dark:text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-mono font-bold text-slate-500 uppercase block mb-0.5">Temp (°F)</label>
                      <input 
                        type="text"
                        value={instantTemp}
                        onChange={(e) => setInstantTemp(e.target.value)}
                        placeholder="98.6"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-center text-slate-800 dark:text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-mono font-bold text-slate-500 uppercase block mb-0.5">Sugar (mg/dL)</label>
                      <input 
                        type="text"
                        value={instantSugar}
                        onChange={(e) => setInstantSugar(e.target.value)}
                        placeholder="e.g. 110"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-center text-slate-800 dark:text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-mono font-bold text-slate-500 uppercase block mb-0.5">Weight (kg)</label>
                      <input 
                        type="text"
                        value={instantWeight}
                        onChange={(e) => setInstantWeight(e.target.value)}
                        placeholder="65"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-center text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Fee Payment Mode Selector */}
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                    Consultation Fee Clearance (₹500.00 Doctor Fee)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setInstantFeeStatus('paid_upi')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
                        instantFeeStatus === 'paid_upi'
                          ? 'bg-emerald-600 text-white shadow-sm font-black'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>₹500 UPI Paid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstantFeeStatus('paid_cash')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
                        instantFeeStatus === 'paid_cash'
                          ? 'bg-emerald-600 text-white shadow-sm font-black'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <Coins className="w-4 h-4" />
                      <span>₹500 Cash</span>
                    </button>
                  </div>
                </div>

                {/* 4. Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowInstantAppointmentModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border-0"
                  >
                    Done / Close Desk
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingInstant}
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-500/25 flex items-center gap-2 cursor-pointer transition border-0 uppercase tracking-wider"
                  >
                    {isSubmittingInstant ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Issuing Token...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>⚡ Confirm Fee &amp; Issue Token</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── BATCH PHYSICAL OPD PRESCRIPTION PAD PRINTING MODAL ────────────────── */}
      {showBatchPrescriptionPrintModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 overflow-hidden animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3 bg-slate-50/80 dark:bg-slate-900/80 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                      🖨️ Batch Print Physical OPD Prescription Pads (Pre-filled Vitals)
                    </h3>
                    <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[9px] rounded-full uppercase font-mono border border-blue-200 dark:border-blue-800">
                      {vitalsDonePatients.length} Patients with Vitals Today
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Print custom letterhead prescription slips pre-filled with patient vitals for Doctor physical OPD consults.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBatchPrescriptionPrintModal(false);
                    setBillHubInitialMode('ocr_scan');
                    setBillingSubTab('ocr_scan');
                    setActiveTab('billing_daycare');
                  }}
                  className="px-3.5 py-1.5 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan Completed Rx (OCR)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchPrescriptionPrintModal(false)}
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition cursor-pointer border-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
              
              {/* Left Column: Patient List with Checkboxes */}
              <div className="lg:col-span-6 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden p-4 space-y-3">
                {/* Search and Select All Bar */}
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search by name, phone, or token..."
                      value={batchPrintSearchTerm}
                      onChange={(e) => setBatchPrintSearchTerm(e.target.value)}
                      className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPatientIdsForPrint.length === filteredVitalsPatients.length) {
                        setSelectedPatientIdsForPrint([]);
                      } else {
                        setSelectedPatientIdsForPrint(filteredVitalsPatients.map(p => p.id));
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
                  >
                    {selectedPatientIdsForPrint.length === filteredVitalsPatients.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Patient Cards List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {filteredVitalsPatients.length > 0 ? (
                    filteredVitalsPatients.map((p) => {
                      const isSelected = selectedPatientIdsForPrint.includes(p.id);
                      const v = p.vitals || ({} as any);
                      const isPreviewing = previewPatientId === p.id;

                      return (
                        <div
                          key={p.id}
                          onClick={() => setPreviewPatientId(p.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isPreviewing
                              ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-sm'
                              : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (isSelected) {
                                  setSelectedPatientIdsForPrint(selectedPatientIdsForPrint.filter(id => id !== p.id));
                                } else {
                                  setSelectedPatientIdsForPrint([...selectedPatientIdsForPrint, p.id]);
                                }
                              }}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px] rounded">
                                  #{p.tokenNumber || (p as any).token_number || 'OPD'}
                                </span>
                                <strong className="text-xs font-bold text-slate-900 dark:text-white">{p.name}</strong>
                                <span className="text-[10px] text-slate-500">({p.age}y/{p.gender})</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                                <span>BP: {v.bloodPressure || '—'}</span>
                                <span>•</span>
                                <span>Pulse: {v.pulseRate || '—'}</span>
                                <span>•</span>
                                <span>Sugar: {v.bloodSugar || '—'}</span>
                                <span>•</span>
                                <span>SpO2: {v.spO2 || '—'}%</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintPrescriptionSlips([p]);
                              }}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Print 🖨️
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No patients with vitals recorded found today.
                    </div>
                  )}
                </div>

                {/* Batch Print Actions Bar */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Selected: <strong className="text-blue-600 dark:text-blue-400">{selectedPatientIdsForPrint.length}</strong> / {filteredVitalsPatients.length}
                  </div>
                  <button
                    type="button"
                    disabled={selectedPatientIdsForPrint.length === 0}
                    onClick={() => {
                      const targets = (vitalsDonePatients || []).filter(p => p && p.id && selectedPatientIdsForPrint.includes(p.id));
                      handlePrintPrescriptionSlips(targets);
                    }}
                    className={`px-5 py-2 rounded-xl text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer border-0 ${
                      selectedPatientIdsForPrint.length > 0
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-95'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Selected ({selectedPatientIdsForPrint.length} Slips)</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Visual Slip Preview */}
              <div className="lg:col-span-6 bg-slate-100 dark:bg-slate-950 p-4 sm:p-5 flex flex-col overflow-y-auto">
                <div className="text-xs font-black text-slate-500 uppercase font-mono mb-2 flex items-center justify-between">
                  <span>Physical Prescription Pad Preview (A4 / Letter)</span>
                  <span className="text-blue-600 font-bold">1 Page per Patient</span>
                </div>

                {(() => {
                  const previewPatient = (previewPatientId ? patients.find(p => p.id === previewPatientId) : null) || filteredVitalsPatients[0];
                  const template = api.getPrescriptionTemplate();
                  const v = previewPatient?.vitals || ({} as any);

                  if (!previewPatient) {
                    return (
                      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                        Select a patient on the left to preview their printed prescription slip.
                      </div>
                    );
                  }

                  return (
                    <div className="bg-white text-slate-800 p-5 rounded-2xl border border-slate-300 shadow-md space-y-2.5 text-xs">
                      {/* Top Clinic Header */}
                      <div className="border-b-2 border-blue-600 pb-2 flex justify-between items-start">
                        <div>
                          <h3 className="text-sm font-extrabold text-blue-700">🏥 {template.clinicName || 'Smart Care Clinic & Hospital'}</h3>
                          <p className="text-[9px] text-slate-500">{template.clinicAddress || 'Main Road, Health Plaza, City Center'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-mono text-blue-600 font-bold">{template.clinicPhone || '+91 99342 98453'}</p>
                          <p className="text-[8px] text-slate-400">OPD: 09:00 AM - 08:00 PM</p>
                        </div>
                      </div>

                      {/* Patient Details Strip */}
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-3 gap-1.5 text-[9.5px]">
                        <div><span className="text-slate-400">NAME:</span> <strong>{previewPatient.name}</strong></div>
                        <div><span className="text-slate-400">AGE/SEX:</span> <strong>{previewPatient.age}y / {previewPatient.gender}</strong></div>
                        <div><span className="text-slate-400">TOKEN:</span> <strong className="text-indigo-600">#{previewPatient.tokenNumber || (previewPatient as any).token_number || 'OPD'}</strong></div>
                        <div><span className="text-slate-400">PHONE:</span> <strong>{previewPatient.phone}</strong></div>
                        <div><span className="text-slate-400">DATE:</span> <strong>{getIstDateString()}</strong></div>
                        <div><span className="text-slate-400">ABHA:</span> <span className="font-mono">{previewPatient.abhaId || '—'}</span></div>
                      </div>

                      {/* Single-Row Horizontal Vitals Strip in Header */}
                      <div className="p-2 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between flex-wrap gap-1 text-[9px] text-emerald-950 font-mono">
                        <span className="font-extrabold text-emerald-800">🩺 VITALS:</span>
                        <span>BP: <strong>{v.bloodPressure || '120/80'}</strong></span>
                        <span className="text-emerald-300">|</span>
                        <span>Pulse: <strong>{v.pulseRate || '72'}</strong></span>
                        <span className="text-emerald-300">|</span>
                        <span>SpO2: <strong>{v.spO2 || '99'}%</strong></span>
                        <span className="text-emerald-300">|</span>
                        <span>Temp: <strong>{v.temperature || '98.6'}°F</strong></span>
                        <span className="text-emerald-300">|</span>
                        <span>Sugar: <strong>{v.bloodSugar || '105'}</strong></span>
                        <span className="text-emerald-300">|</span>
                        <span>Weight: <strong>{v.weight || '65'}kg</strong></span>
                      </div>

                      {/* Ruled Body Sections */}
                      <div className="space-y-2 pt-1">
                        <div className="text-[9.5px] font-bold text-slate-600">Chief Complaints / Clinical Diagnosis:</div>
                        <div className="h-12 border border-slate-200 rounded-lg bg-slate-50/50"></div>

                        <div className="text-base font-black text-blue-600 font-serif leading-none">℞</div>
                        
                        <div className="border border-slate-200 rounded-lg overflow-hidden text-[8.5px]">
                          <div className="grid grid-cols-12 bg-slate-100 font-bold p-1 border-b border-slate-200">
                            <div className="col-span-1">#</div>
                            <div className="col-span-5">Medicine Name</div>
                            <div className="col-span-3">Dose / Frequency</div>
                            <div className="col-span-3">Duration &amp; Instructions</div>
                          </div>
                          {[1, 2, 3].map(i => (
                            <div key={`pad-rx-line-${i}`} className="grid grid-cols-12 p-1 border-b border-slate-100 last:border-0 h-5 items-center">
                              <div className="col-span-1 text-slate-400">{i}.</div>
                              <div className="col-span-5 border-r border-dashed border-slate-200 h-full"></div>
                              <div className="col-span-3 border-r border-dashed border-slate-200 h-full"></div>
                              <div className="col-span-3 h-full"></div>
                            </div>
                          ))}
                        </div>

                        <div className="text-[9.5px] font-bold text-slate-600">Advised Lab / Diagnostics:</div>
                        <div className="h-7 border border-slate-200 rounded-lg bg-slate-50/50"></div>
                      </div>

                      {/* Doctor Information in Bottom Footer of Page */}
                      <div className="pt-2.5 border-t border-dashed border-slate-200 flex justify-between items-end text-[9px] text-slate-600">
                        <div>
                          <div className="font-extrabold text-blue-700 text-[11px]">{template.doctorName || 'Attending Physician'}</div>
                          <div className="text-[9px] text-slate-600 font-semibold">{template.doctorQualification || 'MBBS, MS (Ophthalmology), FICO'}</div>
                          <div className="text-[8px] font-mono text-slate-400">Reg No: {template.doctorRegNo || 'MCI-84992-A'}</div>
                          <div className="mt-1 text-[8.5px] font-bold text-slate-500">Next Review: ____________________</div>
                        </div>
                        <div className="text-right">
                          <div className="w-24 border-b border-slate-400 mb-1 ml-auto"></div>
                          <div className="text-[8.5px] font-bold text-slate-700">Doctor's Signature &amp; Stamp</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}
      <div className="hidden md:flex items-center justify-between pt-4 mt-6 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Mediflow Realtime Engine · {clinicTitle} Node</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Sub-300ms Outbound WhatsApp</span>
          <span>·</span>
          <span>Cashfree Payment Gate Active</span>
          <span>·</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">RLS Encrypted · Compounder</span>
        </div>
      </div>

      {/* Floating 24/7 Mediflow AI Support Widget */}
      <WhatsAppSupportModal userRole="compounder" userName="Compounder Desk" clinicName={clinicTitle} />
    </div>
  );
};

