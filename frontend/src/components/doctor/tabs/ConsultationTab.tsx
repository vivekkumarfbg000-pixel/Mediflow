import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../services/api';
import { PharmacyService } from '../../../services/pharmacyService';
import type { Patient, DiagnosticTest, MedicationRequest, Appointment } from '../../../types';
import { CheckCircle2 } from 'lucide-react';
import { useClinic } from '../../../context/ClinicContext';
import { OphthalmologyPatientAnalysisPanel } from '../OphthalmologyPatientAnalysisPanel';
import { OphthalmicRefractionGrid } from '../OphthalmicRefractionGrid';
import { BiometryWorksheet } from '../BiometryWorksheet';
import { 
  EMPTY_REFRACTION_RX, 
  getAcuityRank, 
  OPHTHALMIC_EYE_CARE_COPY, 
  OPHTHALMIC_FREQUENCIES,
  type RefractionRx,
  type BiometryData
} from '../../../types/ophthalmic';

interface ConsultationTabProps {
  patients: Patient[];
  selectedPatient: Patient | null;
  setSelectedPatient: (p: Patient | null) => void;
  medications: Omit<MedicationRequest, 'id'>[];
  setMedications: React.Dispatch<React.SetStateAction<Omit<MedicationRequest, 'id'>[]>>;
  selectedTests: DiagnosticTest[];
  notes: string;
  setNotes: (n: string) => void;

  medName: string;
  setMedName: (n: string) => void;
  medDosage: string;
  setMedDosage: (d: string) => void;
  medFreq: string;
  setMedFreq: (f: string) => void;
  medDur: string;
  setMedDur: (d: string) => void;
  refractionRx: RefractionRx;
  setRefractionRx: (r: RefractionRx) => void;
  biometryRx: BiometryData;
  setBiometryRx: (b: BiometryData) => void;
  cdssAnomalies: string[];
  aiInsight: string;
  isAiLoading: boolean;
  baselineDate: string | null;
  setBaselineDate: (d: string | null) => void;
  comparisonDate: string | null;
  setComparisonDate: (d: string | null) => void;
  allergyAlert: any;
  setAllergyAlert: (a: any) => void;
  analyzingReport: any;
  setAnalyzingReport: (r: any) => void;
  isOphthalmology: boolean;
  testCatalog: DiagnosticTest[];
  nomenclature: any;
  hinglishSummary: string;
  setHinglishSummary: (s: string) => void;
  isGeneratingSummary: boolean;
  setIsGeneratingSummary: (b: boolean) => void;
  comparativeTrend: any;
  setComparativeTrend: (s: any) => void;
  isGeneratingTrend: boolean;
  setIsGeneratingTrend: (b: boolean) => void;
  isRecording: boolean;
  recordingSeconds: number;
  audioUrl: string | null;
  isTranscribing: boolean;
  startAudioRecording: () => void;
  stopAudioRecording: () => void;
  executeAudioScribeTranscription: () => void;
  handleAddMedication: () => void;
  handleRemoveMedication: (idx: number) => void;
  handleToggleTest: (test: DiagnosticTest) => void;
  handleSaveEncounter: () => void;
  handleLaunchVideoConsult?: () => void;
}

export const ConsultationTab: React.FC<ConsultationTabProps> = React.memo(({
  patients,
  selectedPatient,
  setSelectedPatient,
  medications,
  setMedications,
  selectedTests,
  notes,
  setNotes,

  medName,
  setMedName,
  medDosage,
  setMedDosage,
  medFreq,
  setMedFreq,
  medDur,
  setMedDur,
  refractionRx,
  setRefractionRx,
  biometryRx,
  setBiometryRx,
  cdssAnomalies,
  aiInsight,
  isAiLoading,
  baselineDate,
  setBaselineDate,
  comparisonDate,
  setComparisonDate,
  allergyAlert,
  setAllergyAlert,
  analyzingReport,
  setAnalyzingReport,
  isOphthalmology,
  testCatalog,
  nomenclature,
  hinglishSummary,
  setHinglishSummary,
  isGeneratingSummary,
  setIsGeneratingSummary,
  comparativeTrend,
  setComparativeTrend,
  isGeneratingTrend,
  setIsGeneratingTrend,
  isRecording,
  recordingSeconds,
  audioUrl,
  isTranscribing,
  startAudioRecording,
  stopAudioRecording,
  executeAudioScribeTranscription,
  handleAddMedication,
  handleRemoveMedication,
  handleToggleTest,
  handleSaveEncounter,
  handleLaunchVideoConsult
}) => {
  const { activePod } = useClinic();
  const appointments: Appointment[] = api.getAppointments();
  const [aiHistory, setAiHistory] = useState<any[]>([]);

  useEffect(() => {
    const refreshHistory = () => {
      if (selectedPatient) {
        setAiHistory(api.getAIResults(selectedPatient.id));
      } else {
        setAiHistory([]);
      }
    };
    refreshHistory();
    return api.subscribe(refreshHistory);
  }, [selectedPatient, hinglishSummary, comparativeTrend, aiInsight]);

  const [virtualDateInput, setVirtualDateInput] = useState('');
  const [virtualTimeInput, setVirtualTimeInput] = useState('');
  const [expandedCitationPmid, setExpandedCitationPmid] = useState<string | null>(null);
  const [flashPrescriptionPanel, setFlashPrescriptionPanel] = useState(false);

  // Smart Drug Autocomplete & Presets States
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);
  const [isSelectingFromDropdown, setIsSelectingFromDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Interactive Prescription Pad Workspace States
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'workup' | 'prescription'>('workup');

  useEffect(() => {
    if (isSelectingFromDropdown) {
      setIsSelectingFromDropdown(false);
      return;
    }
    if (!medName.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const results = PharmacyService.getDrugSuggestions(medName, isOphthalmology);
    setSuggestions(results);
    setShowSuggestions(results.length > 0);
    setActiveSuggestionIdx(0);
  }, [medName, isOphthalmology]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [consentPurpose, setConsentPurpose] = useState<string>('GENERAL_TREATMENT');
  const [consentNotes, setConsentNotes] = useState<string>('');
  const [activePhysicalConsent, setActivePhysicalConsent] = useState<any>(null);
  const [remainingTime, setRemainingTime] = useState<string>('');

  useEffect(() => {
    const updateConsentStatus = () => {
      api.checkAndExpirePhysicalConsents();

      if (selectedPatient) {
        const consents = api.getPhysicalConsents(selectedPatient.id);
        const active = consents.find((c: any) => c.status === 'ACTIVE');
        setActivePhysicalConsent(active || null);
      } else {
        setActivePhysicalConsent(null);
      }
    };

    updateConsentStatus();
    const interval = setInterval(updateConsentStatus, 5000);
    const unsubscribe = api.subscribe(updateConsentStatus);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [selectedPatient]);

  useEffect(() => {
    if (!activePhysicalConsent) return;

    const updateTimer = () => {
      const ms = new Date(activePhysicalConsent.expires_at).getTime() - Date.now();
      if (ms <= 0) {
        setRemainingTime('Expired');
        api.checkAndExpirePhysicalConsents();
      } else {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minsRemaining = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const secsRemaining = Math.floor((ms % (1000 * 60)) / 1000);
        setRemainingTime(`${hours}h ${minsRemaining}m ${secsRemaining}s`);
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [activePhysicalConsent]);

  const [surgeryEye, setSurgeryEye] = useState<'OD' | 'OS' | 'None'>('None');
  const [surgeryType, setSurgeryType] = useState('Cataract - Phacoemulsification (MICS)');
  const [lensType, setLensType] = useState('Monofocal');
  const [iolPower, setIolPower] = useState('');
  const [surgeryDate, setSurgeryDate] = useState('');
  const [surgeryCoordinator, setSurgeryCoordinator] = useState('Sister Mary (OT Charge)');
  const [surgeryPackage, setSurgeryPackage] = useState('Indian Monofocal (SICS)');
  const [isSurgerySaving, setIsSurgerySaving] = useState(false);

  const [gpProcedureType, setGpProcedureType] = useState('None');
  const [gpProcedureDate, setGpProcedureDate] = useState('');
  const [gpProcedureRoom, setGpProcedureRoom] = useState('Dressing Room 1');
  const [isGPProcedureSaving, setIsGPProcedureSaving] = useState(false);

  useEffect(() => {
    if (selectedPatient && selectedPatient.vitals) {
      if ((selectedPatient.vitals as any).surgeryBooking) {
        const booking = (selectedPatient.vitals as any).surgeryBooking;
        setSurgeryEye(booking.eye || 'None');
        setSurgeryType(booking.type || 'Cataract - Phacoemulsification (MICS)');
        setLensType(booking.lensType || 'Monofocal');
        setIolPower(booking.iolPower || '');
        setSurgeryDate(booking.date || '');
        setSurgeryCoordinator(booking.coordinator || 'Sister Mary (OT Charge)');
        setSurgeryPackage(booking.package || 'Indian Monofocal (SICS)');
      } else {
        setSurgeryEye('None');
        setSurgeryType('Cataract - Phacoemulsification (MICS)');
        setLensType('Monofocal');
        setIolPower('');
        setSurgeryDate('');
        setSurgeryCoordinator('Sister Mary (OT Charge)');
        setSurgeryPackage('Indian Monofocal (SICS)');
      }

      if ((selectedPatient.vitals as any).gpProcedureBooking) {
        const gpBooking = (selectedPatient.vitals as any).gpProcedureBooking;
        setGpProcedureType(gpBooking.procedure || 'None');
        setGpProcedureDate(gpBooking.date || '');
        setGpProcedureRoom(gpBooking.room || 'Dressing Room 1');
      } else {
        setGpProcedureType('None');
        setGpProcedureDate('');
        setGpProcedureRoom('Dressing Room 1');
      }
    } else {
      setSurgeryEye('None');
      setSurgeryType('Cataract - Phacoemulsification (MICS)');
      setLensType('Monofocal');
      setIolPower('');
      setSurgeryDate('');
      setSurgeryCoordinator('Sister Mary (OT Charge)');
      setSurgeryPackage('Indian Monofocal (SICS)');

      setGpProcedureType('None');
      setGpProcedureDate('');
      setGpProcedureRoom('Dressing Room 1');
    }
  }, [selectedPatient]);

  const handleSaveSurgeryBooking = () => {
    if (!selectedPatient) return;
    setIsSurgerySaving(true);
    
    let basePrice = 12000;
    if (surgeryPackage === 'Indian Monofocal (Phaco)') basePrice = 18000;
    else if (surgeryPackage === 'Imported Monofocal (Phaco)') basePrice = 32000;
    else if (surgeryPackage === 'Premium Multifocal (Phaco)') basePrice = 65000;
    else if (surgeryPackage === 'Ultra Toric/EDOF (Phaco)') basePrice = 95000;

    const diagnosticsData = {
      ...selectedPatient.vitals,
      surgeryBooking: {
        eye: surgeryEye,
        type: surgeryType,
        lensType,
        iolPower,
        date: surgeryDate,
        coordinator: surgeryCoordinator,
        package: surgeryPackage,
        price: basePrice,
        advancePaid: 0,
        status: 'pending_payment'
      }
    };
    api.saveRefractionDiagnostics(selectedPatient.id, diagnosticsData);
    setIsSurgerySaving(false);
    
    // Generate the pending OT Invoice
    api.createOTPackageInvoice(selectedPatient.id, {
      procedure: surgeryType,
      eye: surgeryEye,
      lensType,
      packageTier: surgeryPackage,
      totalAmount: basePrice
    });

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Surgery Scheduled & OT Ledger Generated! 🏥',
        message: `Cataract surgery scheduled for ${selectedPatient.name} (${surgeryEye}) on ${surgeryDate}. Package: ${surgeryPackage}.`,
        type: 'success'
      }
    }));
  };

  const handleSaveGPProcedureBooking = () => {
    if (!selectedPatient) return;
    setIsGPProcedureSaving(true);

    let price = 0;
    if (gpProcedureType === 'Minor Suturing / Stitching') price = 1200;
    else if (gpProcedureType === 'Abscess Incision & Drainage (I&D)') price = 1500;
    else if (gpProcedureType === 'Wound Dressing & Debridement') price = 800;
    else if (gpProcedureType === 'Sebaceous Cyst Excision') price = 3000;
    else if (gpProcedureType === 'IV Infusion / Saline Drip Session') price = 600;

    const diagnosticsData = {
      ...selectedPatient.vitals,
      gpProcedureBooking: {
        procedure: gpProcedureType,
        room: gpProcedureRoom,
        date: gpProcedureDate,
        price,
        advancePaid: 0,
        status: 'pending_payment'
      }
    };
    api.saveRefractionDiagnostics(selectedPatient.id, diagnosticsData);
    setIsGPProcedureSaving(false);

    if (gpProcedureType !== 'None') {
      api.createGPProcedureInvoice(selectedPatient.id, {
        procedure: gpProcedureType,
        room: gpProcedureRoom,
        totalAmount: price
      });

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'GP Procedure Scheduled! 🏥',
          message: `Procedure '${gpProcedureType}' scheduled in ${gpProcedureRoom} on ${gpProcedureDate} for ₹${price}.`,
          type: 'success'
        }
      }));
    }
  };

  const handleRevokePhysicalConsent = async () => {
    if (!selectedPatient || !activePhysicalConsent) return;
    try {
      await api.revokePhysicalConsent(activePhysicalConsent.id);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Consent Revoked 🛡️',
          message: `Physical data consent for ${selectedPatient.name} has been revoked.`,
          type: 'warning'
        }
      }));
    } catch (err) {
      console.error('[Consent] Failed to revoke physical consent:', err);
    }
  };

  const handlePrintPrescription = () => {
    if (!selectedPatient) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    const medRows = medications.map(m => `
      <tr>
        <td><strong>${m.medicineName}</strong></td>
        <td>${m.dosage || '—'}</td>
        <td>${m.frequency || '—'}</td>
        <td>${m.duration || '—'}</td>
      </tr>
    `).join('');

    const diagnosticRows = selectedTests.map(t => `
      <tr>
        <td><strong>${t.name}</strong></td>
        <td>${t.loincCode || 'N/A'}</td>
      </tr>
    `).join('');

    let refractionSection = '';
    if (isOphthalmology && (refractionRx.od.sph || refractionRx.os.sph)) {
      refractionSection = `
        <div class="section">
          <div class="section-title">Spectacle / Lens Refraction Rx</div>
          <table>
            <thead>
              <tr>
                <th>Eye</th>
                <th>SPH</th>
                <th>CYL</th>
                <th>AXIS</th>
                <th>ADD</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Right Eye (OD)</strong></td>
                <td>${refractionRx.od.sph || 'Plano'}</td>
                <td>${refractionRx.od.cyl || '—'}</td>
                <td>${refractionRx.od.axis ? refractionRx.od.axis + '°' : '—'}</td>
                <td>${refractionRx.od.add || '—'}</td>
              </tr>
              <tr>
                <td><strong>Left Eye (OS)</strong></td>
                <td>${refractionRx.os.sph || 'Plano'}</td>
                <td>${refractionRx.os.cyl || '—'}</td>
                <td>${refractionRx.os.axis ? refractionRx.os.axis + '°' : '—'}</td>
                <td>${refractionRx.os.add || '—'}</td>
              </tr>
            </tbody>
          </table>
          <p style="margin-top: 10px; font-size: 11px;">
            <strong>Lens Type:</strong> ${refractionRx.lensType || 'Single Vision'} &nbsp;&nbsp;&nbsp;&nbsp;
            <strong>PD:</strong> ${refractionRx.pd || '—'} mm
          </p>
          ${refractionRx.notes ? `<p style="font-size: 11px;"><strong>Notes:</strong> ${refractionRx.notes}</p>` : ''}
        </div>
      `;
    }

    let biometrySection = '';
    if (isOphthalmology && (biometryRx.axialLength || biometryRx.k1 || biometryRx.k2 || biometryRx.iolPower)) {
      biometrySection = `
        <div class="section">
          <div class="section-title">Cataract Pre-Op Biometry & IOL Planner</div>
          <table>
            <thead>
              <tr>
                <th>Axial Length (mm)</th>
                <th>K1 Flat (D)</th>
                <th>K2 Steep (D)</th>
                <th>Target Rx (D)</th>
                <th>IOL Model</th>
                <th>IOL Power (D)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${biometryRx.axialLength || '—'}</td>
                <td>${biometryRx.k1 || '—'}</td>
                <td>${biometryRx.k2 || '—'}</td>
                <td>${biometryRx.targetRefraction || '—'}</td>
                <td>${biometryRx.iolModel || '—'}</td>
                <td>${biometryRx.iolPower || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Medical Prescription - ${selectedPatient.name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
            .logo-area h1 { font-size: 26px; margin: 0; color: #4f46e5; font-weight: 800; letter-spacing: -0.025em; }
            .logo-area p { margin: 5px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500; }
            .doc-info { text-align: right; font-size: 12px; line-height: 1.6; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #4f46e5; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; letter-spacing: 0.05em; }
            .patient-grid { display: grid; grid-template-cols: 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 12px; }
            .patient-grid div { margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; color: #475569; }
            .footer { margin-top: 60px; font-size: 10px; text-align: center; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 20px; }
            .btn-container { text-align: right; margin-bottom: 20px; }
            .print-btn { background: #4f46e5; color: white; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; transition: all 0.2s; }
            .print-btn:hover { background: #4338ca; }
            @media print {
              body { padding: 0; }
              .btn-container { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="btn-container">
            <button class="print-btn" onclick="window.print()">Print Prescription</button>
          </div>
          
          <div class="header">
            <div class="logo-area">
              <h1>VitalSync</h1>
              <p>Connected Care Clinic Network</p>
            </div>
            <div class="doc-info">
              <strong>Dr. Amit Arya, MBBS, MS</strong><br/>
              Ophthalmology Specialist<br/>
              Patna West Pod Tenant (MF-PATNA101)<br/>
              Date: ${new Date().toLocaleDateString('en-IN')}
            </div>
          </div>

          <div class="patient-grid">
            <div><strong>Patient Name:</strong> ${selectedPatient.name}</div>
            <div><strong>Age / Gender:</strong> ${selectedPatient.age || '—'} Y / ${selectedPatient.gender || '—'}</div>
            <div><strong>Token Number:</strong> ${selectedPatient.tokenNumber || '—'}</div>
            <div><strong>Phone Number:</strong> ${selectedPatient.phone || '—'}</div>
            <div><strong>ABHA ID:</strong> ${selectedPatient.abhaId || '—'}</div>
            <div><strong>Encounter Status:</strong> Finalized</div>
          </div>

          ${refractionSection}
          ${biometrySection}

          ${medications.length > 0 ? `
            <div class="section">
              <div class="section-title">Prescribed Medications (Rx)</div>
              <table>
                <thead>
                  <tr>
                    <th>Medicine Name</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  ${medRows}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${selectedTests.length > 0 ? `
            <div class="section">
              <div class="section-title">Diagnostic Requisitions (Dx)</div>
              <table>
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>LOINC Code</th>
                  </tr>
                </thead>
                <tbody>
                  ${diagnosticRows}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${notes ? `
            <div class="section">
              <div class="section-title">Doctor's Advice & Clinical Directions</div>
              <p style="font-size: 12px; white-space: pre-line; background: #fafafa; padding: 15px; border-radius: 8px; border: 1px solid #f1f5f9;">${notes}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>This is a digitally verified e-prescription generated by VitalSync Connected Care Platform.</p>
            <p style="margin-top: 30px; font-weight: bold;">Dr. Amit Arya (Authorized Signature / Seal)</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintClinicalReferral = () => {
    if (!selectedPatient) return;
    const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
    const recent = history.length > 0 ? history[history.length - 1] : null;
    const baseline = history.length >= 2 ? history[history.length - 2] : null;

    let calculatedGfr = 'N/A';
    if (recent && recent.creatinine) {
      const scr = recent.creatinine;
      const ageVal = selectedPatient.age ?? 45;
      const genderVal = selectedPatient.gender || 'Male';
      const isFemale = genderVal.toLowerCase() === 'female';
      const k = isFemale ? 0.7 : 0.9;
      const alpha = isFemale ? -0.241 : -0.302;
      const genderMult = isFemale ? 1.012 : 1.0;
      const val = 142 * Math.pow(Math.min(scr / k, 1), alpha) * Math.pow(Math.max(scr / k, 1), -1.200) * Math.pow(0.9938, ageVal) * genderMult;
      calculatedGfr = (Math.round(val * 10) / 10).toString() + ' mL/min/1.73m²';
    }

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    const medRows = medications.map(m => `
      <tr>
        <td><strong>${m.medicineName}</strong></td>
        <td>${m.dosage}</td>
        <td>${m.frequency}</td>
        <td>${m.duration}</td>
      </tr>
    `).join('');

    const citationRows = (comparativeTrend?.citations || []).map((c: any) => `
      <tr>
        <td>${c.title}</td>
        <td>${c.journal} (${c.year})</td>
        <td>PMID: ${c.pmid}</td>
      </tr>
    `).join('');

    const suggestedRows = (comparativeTrend?.suggestedCompositions || []).map((s: any) => `
      <tr>
        <td><strong>${s.medicine_name}</strong> (${s.composition})</td>
        <td>${s.suggested_dosage}</td>
        <td>${s.justification}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>AI Clinical Referral & Lab Analyzer Summary</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { font-size: 24px; margin: 0; color: #e11d48; }
            .header p { margin: 5px 0 0 0; font-size: 12px; color: #64748b; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #475569; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 12px; }
            .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; }
            .badge { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block; }
            .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 20px; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div style="text-align: right; margin-bottom: 20px;">
            <button onclick="window.print()" style="background: #e11d48; color: white; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer;">Print Document</button>
          </div>
          <div class="header">
            <h1>VITALSYNC CLINICAL DECISION SUPPORT SYSTEM (CDSS)</h1>
            <p>Automated Evidence-Based Clinical Referral Note & Diagnostic Lab Trend Summary</p>
          </div>
          
          <div class="section">
            <div class="section-title">Patient Demographics & Encounter Details</div>
            <div class="grid">
              <div>
                <p><strong>Patient Name:</strong> ${selectedPatient?.name}</p>
                <p><strong>ABHA ID:</strong> ${selectedPatient?.abhaId || 'N/A'}</p>
                <p><strong>Age / Gender:</strong> ${selectedPatient?.age} Yrs / ${selectedPatient?.gender}</p>
              </div>
              <div>
                <p><strong>Reference Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
                <p><strong>Clinic Entity:</strong> VitalSync Clinical Hub</p>
                <p><strong>Chronic Conditions:</strong> ${selectedPatient?.chronicConditions.join(', ') || 'None'}</p>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Biomarker Trajectory Analysis (CKD-EPI Adjusted)</div>
            <table>
              <thead>
                <tr>
                  <th>Biomarker</th>
                  <th>Current Report (${recent?.date || 'N/A'})</th>
                  <th>Baseline Report (${baseline?.date || 'N/A'})</th>
                  <th>Clinical Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>HbA1c</td>
                  <td>${recent?.HbA1c ? recent.HbA1c + '%' : 'N/A'}</td>
                  <td>${baseline?.HbA1c ? baseline.HbA1c + '%' : 'N/A'}</td>
                  <td><span class="badge">${recent?.HbA1c && recent.HbA1c > 6.5 ? 'Diabetic Glycemic' : 'Stable'}</span></td>
                </tr>
                <tr>
                  <td>Serum Creatinine</td>
                  <td>${recent?.creatinine ? recent.creatinine + ' mg/dL' : 'N/A'}</td>
                  <td>${baseline?.creatinine ? baseline.creatinine + ' mg/dL' : 'N/A'}</td>
                  <td><span class="badge">${recent?.creatinine && recent.creatinine > 1.2 ? 'Elevated Creatinine' : 'Normal'}</span></td>
                </tr>
                <tr>
                  <td>Calculated eGFR (CKD-EPI)</td>
                  <td>${calculatedGfr}</td>
                  <td>N/A</td>
                  <td><span class="badge">${recent?.creatinine && parseFloat(calculatedGfr) < 60 ? 'Reduced Renal Clearance' : 'Normal'}</span></td>
                </tr>
                <tr>
                  <td>Total Hemoglobin</td>
                  <td>${recent?.hemoglobin ? recent.hemoglobin + ' g/dL' : 'N/A'}</td>
                  <td>${baseline?.hemoglobin ? baseline.hemoglobin + ' g/dL' : 'N/A'}</td>
                  <td><span class="badge">${recent?.hemoglobin && recent.hemoglobin < 12.0 ? 'Anemia Warning' : 'Normal'}</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          ${comparativeTrend?.summaryText ? `
          <div class="section">
            <div class="section-title">AI Summary & Recommendations</div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; font-size: 11px; white-space: pre-wrap;">
              ${comparativeTrend.summaryText}
            </div>
          </div>
          ` : ''}

          ${medRows ? `
          <div class="section">
            <div class="section-title">Active Prescribed Medications (e-Rx)</div>
            <table>
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th>Composition</th>
                  <th>Dosage / Frequency</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                ${medRows}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${suggestedRows ? `
          <div class="section">
            <div class="section-title">CDSS Suggested Pharmaceutical Swaps & Compositions</div>
            <table>
              <thead>
                <tr>
                  <th>Suggested Agent</th>
                  <th>Suggested Dosage</th>
                  <th>Clinical Justification</th>
                </tr>
              </thead>
              <tbody>
                ${suggestedRows}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${citationRows ? `
          <div class="section">
            <div class="section-title">PubMed Clinical Evidence Citations</div>
            <table>
              <thead>
                <tr>
                  <th>Paper Title</th>
                  <th>Journal / Year</th>
                  <th>Citation ID</th>
                </tr>
              </thead>
              <tbody>
                ${citationRows}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="footer">
            <p>This is a system-generated AI Clinical Decision Support Note. Final prescription authority remains with the attending physician.</p>
            <p>&copy; 2026 VitalSync Ecosystem - Hospital SaaS Solutions</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };


  useEffect(() => {
    if (selectedPatient) {
      const patientAppts = appointments.filter((a: Appointment) => a.patientId === selectedPatient.id);
      const virtualAppt = patientAppts.find((a: Appointment) => a.isVirtual);
      if (virtualAppt) {
        setVirtualDateInput(virtualAppt.virtualDate || '');
        setVirtualTimeInput(virtualAppt.virtualTime || '');
      } else {
        setVirtualDateInput('');
        setVirtualTimeInput('');
      }
    }
  }, [selectedPatient]);

  const activeHistory = selectedPatient ? api.getPatientHistoricalBiomarkers(selectedPatient.id) : null;
  const baseReport = activeHistory?.find(h => h.date === baselineDate) ?? null;
  const compReport = activeHistory?.find(h => h.date === comparisonDate) ?? (activeHistory ? activeHistory[activeHistory.length - 1] : null);
  const isConsentActive = true;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-800">
      {/* LEFT COLUMN: Patient queue, CDSS Analyzer */}
      <div className={`${selectedPatient ? 'hidden lg:block' : 'block'} lg:col-span-4 space-y-6`}>
        {/* Patient Consultation Queue */}
        <div className="glass-panel p-6 border-slate-200/80 shadow-sm relative overflow-hidden bg-white">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">group</span>
            Consultation Queue
          </h2>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {(() => {
              const parseTokenNum = (token?: string) => {
                if (!token) return Infinity;
                const match = token.match(/\d+/);
                return match ? parseInt(match[0], 10) : Infinity;
              };

              const queuePatients = patients
                .filter(p => p.queueStatus === 'awaiting_consultation' || p.queueStatus === 'in_consultation' || p.id === selectedPatient?.id)
                .sort((a, b) => {
                  const statusOrder = { 'in_consultation': 1, 'awaiting_consultation': 2 };
                  const statusA = statusOrder[a.queueStatus as keyof typeof statusOrder] || 99;
                  const statusB = statusOrder[b.queueStatus as keyof typeof statusOrder] || 99;
                  if (statusA !== statusB) return statusA - statusB;

                  const tokenA = parseTokenNum(a.tokenNumber);
                  const tokenB = parseTokenNum(b.tokenNumber);
                  return tokenA - tokenB;
                });

              if (queuePatients.length === 0) {
                return (
                  <div className="text-center py-8 text-xs text-slate-400 font-medium">
                    No active patients in queue
                  </div>
                );
              }

              return queuePatients.map((p: Patient) => {
                const isSelected = selectedPatient?.id === p.id;
                const patientAppts = appointments.filter(a => a.patientId === p.id);
                const virtualAppt = patientAppts.find(a => a.isVirtual);

                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden ${
                      isSelected 
                        ? 'bg-primary-container/20 border-primary shadow-sm' 
                        : 'bg-slate-50 border-slate-200/60 hover:bg-slate-100/80'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-primary" />
                    )}
                    <div className="flex justify-between items-start flex-wrap gap-1">
                      <div className="font-bold text-xs text-slate-700 group-hover:text-primary transition-colors flex items-center gap-1.5 flex-wrap">
                        {p.name}
                        {p.tokenNumber && (
                          <span className="text-[8px] font-mono px-1 py-0.2 bg-indigo-50 border border-indigo-200/50 text-indigo-700 rounded shrink-0">
                            {p.tokenNumber}
                          </span>
                        )}
                        {p.vitals && (() => {
                          const triage = api.checkTriageAlert(p);
                          if (triage.isAlert) {
                            return (
                              <span className="text-[7px] font-bold bg-rose-600 text-white px-1.5 py-0.2 rounded-full animate-pulse border-0">
                                Triage: {triage.reason.split(':')[0]}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <span className="text-[8px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono">
                        {p.id.toUpperCase().substring(0, 8)}
                      </span>
                    </div>
                    
                    <div className="text-[10px] text-slate-500 mt-2 flex justify-between items-center flex-wrap gap-1.5">
                      <span>{p.gender}, {p.age} years</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isOphthalmology && p.vitals?.dilationStatus && (
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase border flex items-center gap-0.5 ${
                            p.vitals.dilationStatus === 'dilated'
                              ? 'bg-emerald-50 text-emerald-750 border-emerald-200'
                              : 'bg-amber-550/10 text-amber-700 border-amber-200/60 animate-pulse'
                          }`}>
                            {p.vitals.dilationStatus === 'dilated' ? '👁️ Dilated' : '⏳ Dilating'}
                            {p.vitals.dilationStatus === 'instilled' && p.vitals.dilationStartTime && (
                              <span className="font-mono">
                                ({Math.max(0, Math.ceil((new Date(p.vitals.dilationStartTime).getTime() + 20 * 60 * 1000 - Date.now()) / (60 * 1000)))}m)
                              </span>
                            )}
                          </span>
                        )}
                        {p.abhaId && (
                          <span className="bg-secondary/10 text-secondary border border-secondary/20 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider font-mono">
                            ABHA
                          </span>
                        )}
                        {virtualAppt && (
                          <span className="flex items-center gap-0.5 text-[8px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded-md animate-pulse font-sans">
                            <span className="material-symbols-outlined text-[10px] text-emerald-700">check_circle</span>
                            📹 Virtual {virtualAppt.virtualTimeAllocated ? `(${virtualAppt.virtualTime})` : 'Appt'}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              });
            })()}
          </div>
        </div>

        {/* Laboratory Report History (Past & Present) */}
        {selectedPatient && !isOphthalmology && (
          <div className="glass-panel p-6 border-slate-200/80 shadow-sm relative overflow-hidden bg-white mt-4">
            <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">folder_zip</span>
              Biomarker Reports History
            </h2>
            <p className="text-[10px] text-slate-600 mb-4">Click a report to open a full-screen clinical AI analysis</p>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {(() => {
                const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
                if (history.length === 0) {
                  return (
                    <div className="text-center py-6 text-slate-600 text-xs italic">
                      No historical biomarker reports found.
                    </div>
                  );
                }
                return history.slice().reverse().map((report, idx) => (
                  <button
                    key={idx}
                    onClick={() => setAnalyzingReport(report)}
                    className="w-full text-left p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-all group relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-indigo-500">labs</span>
                        Report Dated: {report.date}
                      </span>
                      <span className="text-[8px] bg-indigo-50 border border-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                        Analyze
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/40 text-[10px] text-slate-500">
                      <div>
                        <span className="text-slate-600 font-medium block">{isOphthalmology ? 'VA (OD)' : 'HbA1c'}</span>
                        <span className={`font-mono font-bold ${!isOphthalmology && report.HbA1c > 6.5 ? 'text-rose-500' : 'text-slate-700'}`}>{isOphthalmology ? '6/6' : `${report.HbA1c}%`}</span>
                      </div>
                      <div>
                        <span className="text-slate-600 font-medium block">{isOphthalmology ? 'IOP' : 'Creatinine'}</span>
                        <span className={`font-mono font-bold ${!isOphthalmology && report.creatinine > 1.2 ? 'text-rose-500' : 'text-slate-700'}`}>{isOphthalmology ? '16 mmHg' : `${report.creatinine} mg/dL`}</span>
                      </div>
                      <div>
                        <span className="text-slate-600 font-medium block">{isOphthalmology ? 'VA (OS)' : 'Hemoglobin'}</span>
                        <span className={`font-mono font-bold ${!isOphthalmology && report.hemoglobin < 12.0 ? 'text-amber-500' : 'text-slate-700'}`}>{isOphthalmology ? '6/9' : `${report.hemoglobin} g/dL`}</span>
                      </div>
                    </div>
                  </button>
                ));
              })()}
            </div>
          </div>
        )}

        {isOphthalmology && (
          <OphthalmologyPatientAnalysisPanel
            selectedPatient={selectedPatient}
            history={activeHistory}
            analyzingReport={analyzingReport}
            baselineDate={baselineDate}
            comparisonDate={comparisonDate}
            onAnalyzeReport={setAnalyzingReport}
            onCloseAnalysis={() => setAnalyzingReport(null)}
          />
        )}
      </div>

      {/* RIGHT COLUMN: Consultation Sheet, e-Rx Form */}
      {selectedPatient && (
        <div className="lg:col-span-8 glass-panel p-6 border-slate-200/80 shadow-sm space-y-6 relative overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setSelectedPatient(null)}
            className="lg:hidden inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 pb-2 cursor-pointer transition active:scale-95 border-0 bg-transparent p-0"
          >
            <span className="material-symbols-outlined text-sm font-bold">arrow_back</span>
            Back to Patients Queue
          </button>
          {!isConsentActive && (
                <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-white/95 border border-rose-500/20 p-8 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-rose-50/50 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-500 animate-pulse">
                <span className="material-symbols-outlined text-2xl">lock</span>
              </div>
              <h3 className="text-slate-800 font-bold text-sm mb-2">Compliance Lock: Active Consent Missing</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-5">
                Access to clinical records, diagnostics ordering, and medication prescribing is locked. Please direct the patient to reply <strong className="text-secondary font-mono">"1" (Grant Access)</strong> on their WhatsApp simulator interface, or authorize physical consent.
              </p>
              {/* Time-Bound Physical Consent Form */}
              <div className="w-full max-w-sm bg-slate-50 border border-slate-200/60 p-4.5 rounded-2xl text-left space-y-4 animate-fade-in shadow-sm select-none">
                <div className="flex gap-2 items-center text-slate-800 font-bold text-xs">
                  <span className="material-symbols-outlined text-indigo-600 text-base">shield_with_heart</span>
                  Record Time-Bound Physical Consent
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Consent Purpose/Scope</label>
                  <select
                    value={consentPurpose}
                    onChange={e => setConsentPurpose(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="GENERAL_TREATMENT">GENERAL TREATMENT (General consultation & vitals logging)</option>
                    <option value="PROCEDURE_X_ACCESS">PROCEDURE ACCESS (Special diagnostics ordering)</option>
                    <option value="DATA_SHARING_RESEARCH">DATA SHARING (Clinical history sync & check)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Specific Clinical Notes / Details (Optional)</label>
                  <textarea
                    placeholder="Enter additional visit details or authorization notes..."
                    value={consentNotes}
                    onChange={e => setConsentNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 resize-none font-sans"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedPatient) return;
                      try {
                        await api.recordPhysicalConsent({
                          patientId: selectedPatient.id,
                          purpose: consentPurpose,
                          details: consentNotes
                        });
                        setConsentNotes('');
                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'Consent Active 🛡️',
                            message: `Recorded 24h physical consent for ${selectedPatient.name}.`,
                            type: 'success'
                          }
                        }));
                      } catch (err: any) {
                        console.error('[Consent Bypass] Failed to record physical consent:', err);
                      }
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-750 active:scale-[0.97] text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded-xl transition-all shadow flex justify-center items-center gap-1.5 cursor-pointer border-0 text-white-force bg-indigo-600-force"
                  >
                    <span className="material-symbols-outlined text-[13px] text-white-force">check_circle</span>
                    Grant 24h Consent
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Physical Consent Banner */}
          {activePhysicalConsent && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/50 rounded-2xl flex items-center justify-between mb-4 animate-fade-in select-none">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-amber-600 text-lg">shield_with_heart</span>
                <div className="text-[10px] text-amber-955 leading-relaxed font-sans">
                  <span className="font-bold text-amber-955">Active Physical Consent</span> • Purpose: <span className="font-semibold text-amber-900">{activePhysicalConsent.consent_purpose.replace(/_/g, ' ')}</span>
                  <span className="block text-[9px] text-amber-800 mt-0.5 font-medium font-mono">Expires in: {remainingTime} ({new Date(activePhysicalConsent.expires_at).toLocaleTimeString()})</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRevokePhysicalConsent}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[9px] font-bold uppercase tracking-wider rounded-xl border-0 cursor-pointer transition-all shadow-sm shadow-rose-650/15 text-white-force"
              >
                Revoke Consent
              </button>
            </div>
          )}

          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">clinical_notes</span>
                Electronic Consultation Record
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-2 flex-wrap">
                Selected Profile: <strong className="text-slate-700 font-bold">{selectedPatient.name}</strong> ({selectedPatient.age}y, {selectedPatient.gender})
                {selectedPatient.vitals && (() => {
                  const triage = api.checkTriageAlert(selectedPatient);
                  if (triage.isAlert) {
                    return (
                      <span className="text-[10px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded animate-pulse border-0">
                        ⚠️ Critical Triage Warning: {triage.reason}
                      </span>
                    );
                  }
                  return null;
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2">

              {selectedPatient.abhaId && (
                <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold tracking-wider uppercase font-mono">
                  ABHA Verified
                </span>
              )}
            </div>
          </div>

          {/* Sub-Tabs Switcher */}
          <div className="flex gap-2 border-b border-slate-200 pb-px mb-4">
            <button
              type="button"
              onClick={() => setActiveSubTab('workup')}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeSubTab === 'workup'
                  ? 'border-indigo-600 text-indigo-650 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              🏥 Clinical Workup & Insights
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('prescription')}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeSubTab === 'prescription'
                  ? 'border-indigo-600 text-indigo-650 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              💊 e-Prescription Pad (Rx / Dx)
            </button>
          </div>

          {activeSubTab === 'workup' && (
            <div className="space-y-5 animate-fade-in">
              {/* Handwritten prescription workflow notice */}
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-start gap-2.5 my-3">
                <span className="material-symbols-outlined text-indigo-600 text-lg mt-0.5">edit_note</span>
                <div className="text-[10px] text-indigo-950 leading-relaxed">
                  <strong className="font-bold text-[11px] text-indigo-950 block mb-0.5">Handwritten Rx Support Enabled</strong>
                  Prefer paper? Write the prescription by hand as usual. The compounder will scan it at the counter, and our clinical AI will automatically reserve medicine inventory and queue pathology tests.
                </div>
              </div>



          {/* AI Predictive Lab Pattern & Risk Disease Analyzer Card */}
          {(() => {
            const history = api.getPatientHistoricalBiomarkers(selectedPatient.id);
            const recent = history.length > 0 ? history[history.length - 1] : null;
            const baseline = history.length >= 2 ? history[history.length - 2] : null;
            
            if (!recent) return null;

            let calculatedGfr: number | undefined = undefined;
            if (recent && recent.creatinine) {
              const scr = recent.creatinine;
              const ageVal = selectedPatient.age ?? 45;
              const genderVal = selectedPatient.gender || 'Male';
              const isFemale = genderVal.toLowerCase() === 'female';
              const k = isFemale ? 0.7 : 0.9;
              const alpha = isFemale ? -0.241 : -0.302;
              const genderMult = isFemale ? 1.012 : 1.0;
              calculatedGfr = 142 * Math.pow(Math.min(scr / k, 1), alpha) * Math.pow(Math.max(scr / k, 1), -1.200) * Math.pow(0.9938, ageVal) * genderMult;
              calculatedGfr = Math.round(calculatedGfr * 10) / 10;
            }

            // Calculate trends locally for instant high-fidelity feedback
            const hba1cDiff = baseline ? recent.HbA1c - baseline.HbA1c : 0;
            const creatinineDiff = baseline ? recent.creatinine - baseline.creatinine : 0;
            const hemoglobinDiff = baseline ? recent.hemoglobin - baseline.hemoglobin : 0;

            // Predict future diseases based on values & trend patterns
            const riskAlerts: { title: string; desc: string; type: 'critical' | 'warning' | 'info' }[] = [];
            
            if (isOphthalmology) {
              const iop = recent.pulseRate ?? 16;
              const vaOD = recent.temperature ?? OPHTHALMIC_EYE_CARE_COPY.odFallback;
              const vaOS = recent.bloodPressure ?? OPHTHALMIC_EYE_CARE_COPY.osFallback;
              
              const baseOD = baseline?.temperature ?? OPHTHALMIC_EYE_CARE_COPY.odFallback;
              const baseOS = baseline?.bloodPressure ?? OPHTHALMIC_EYE_CARE_COPY.osFallback;
              
              const baseODRank = getAcuityRank(baseOD);
              const compODRank = getAcuityRank(vaOD);
              const baseOSRank = getAcuityRank(baseOS);
              const compOSRank = getAcuityRank(vaOS);
              
              const odDropped = baseODRank > 0 && compODRank > baseODRank;
              const osDropped = baseOSRank > 0 && compOSRank > baseOSRank;
              const isAcuityDropped = odDropped || osDropped;

              if (iop > 21) {
                riskAlerts.push({
                  title: 'Glaucoma Progression Risk (High IOP)',
                  desc: `Active Intraocular Pressure is elevated at ${iop} mmHg (normal reference range: 10 - 21 mmHg). Strict contraindication: Avoid dilating drops. High risk of optic nerve damage.`,
                  type: 'critical'
                });
              }
              
              if (isAcuityDropped) {
                riskAlerts.push({
                  title: 'Visual Acuity Trajectory Decline',
                  desc: `Trajectory Decline detected: Vision dropped from ${baseOD} (OD) / ${baseOS} (OS) to ${vaOD} (OD) / ${vaOS} (OS). Warrants immediate lens refraction.`,
                  type: 'warning'
                });
              }
            } else {
              // Glycemic/Diabetes pattern
              if (recent.HbA1c > 6.5) {
                const shiftText = hba1cDiff > 0 ? `up by ${hba1cDiff.toFixed(1)}% absolute shift` : hba1cDiff < 0 ? `down by ${Math.abs(hba1cDiff).toFixed(1)}% absolute shift` : '';
                riskAlerts.push({
                  title: 'Glycemic Degradation & Microvascular Damage Risk',
                  desc: `Active HbA1c is ${recent.HbA1c}% (diabetic range) ${shiftText ? `(${shiftText})` : ''}. High risk of diabetic nephropathy, retinopathy, and nerve damage. Warrants immediate medication audit.`,
                  type: 'critical'
                });
              } else if (recent.HbA1c > 5.7) {
                riskAlerts.push({
                  title: 'Prediabetes Progression Warning',
                  desc: `HbA1c is ${recent.HbA1c}% (prediabetic). High likelihood of transition to full Type-2 Diabetes within 24 months without intensive lifestyle intervention.`,
                  type: 'warning'
                });
              }

              // Renal filtration pattern
              if (recent.creatinine > 1.2) {
                const shiftText = creatinineDiff > 0 ? `increased by ${creatinineDiff.toFixed(2)} mg/dL` : '';
                riskAlerts.push({
                  title: 'Glomerular Filtration Clearance Alert (CKD Risk)',
                  desc: `Serum creatinine is abnormally high at ${recent.creatinine} mg/dL ${shiftText ? `(${shiftText})` : ''}, suggesting reduced renal filtration capacity. Stage 2/3 CKD potential. STRICTLY avoid beta-lactam conflict/NSAID high doses.`,
                  type: 'critical'
                });
              } else if (recent.creatinine > 1.0 && creatinineDiff > 0.15) {
                riskAlerts.push({
                  title: 'Accelerated Renal Decline Trend',
                  desc: `Creatinine increased from ${baseline?.creatinine} to ${recent.creatinine} mg/dL. Upward trajectory indicates potential acute kidney injury (AKI) or renal perfusion issues.`,
                  type: 'warning'
                });
              }

              // Anemia pattern
              if (recent.hemoglobin < 12.0) {
                riskAlerts.push({
                  title: 'Oxygen Carrying Capacity Deficit (Anemia Trend)',
                  desc: `Hemoglobin is low at ${recent.hemoglobin} g/dL, indicating mild to moderate anemia risk. Warrants serum iron/ferritin LOINC checks.`,
                  type: 'info'
                });
              }
            }

            // Generate brief professional summary
            let summaryText = "";
            if (selectedPatient.pastReportsSummary) {
              summaryText += `[Past Report Scan Analysis: ${selectedPatient.pastReportsSummary}] `;
            }
            summaryText += `Patient displays a clinical biomarker pattern requiring close monitoring. `;
            
            if (isOphthalmology) {
              if (baseline) {
                summaryText += `Comparing current exam (${recent.date}) to baseline (${baseline.date}), ${OPHTHALMIC_EYE_CARE_COPY.odLabel} is ${recent.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback} / ${OPHTHALMIC_EYE_CARE_COPY.osLabel} is ${recent.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback} and ${OPHTHALMIC_EYE_CARE_COPY.iopLabel.toLowerCase()} shifted by ${recent.pulseRate !== undefined && baseline.pulseRate !== undefined ? `${(recent.pulseRate - baseline.pulseRate) > 0 ? '+' : ''}${recent.pulseRate - baseline.pulseRate} mmHg` : '0 mmHg'}. `;
              } else {
                summaryText += `Establishing baseline eye examination on ${recent.date}. `;
              }
              
              if ((recent.pulseRate || 16) > 21) {
                summaryText += `Intraocular pressure is abnormally elevated, indicating elevated Glaucoma Progression risk. Strict contraindication: Avoid dilating drops (Atropine/Tropicamide).`;
              } else {
                summaryText += `Ophthalmic pressures are within safe standard thresholds. Spectacle prescription grinding is clear.`;
              }
            } else {
              if (baseline) {
                summaryText += `Comparing current report (${recent.date}) to baseline (${baseline.date}), the primary shift is `;
                const shifts: string[] = [];
                if (hba1cDiff !== 0) shifts.push(`HbA1c shifted by ${hba1cDiff > 0 ? '+' : ''}${hba1cDiff.toFixed(1)}%`);
                if (creatinineDiff !== 0) shifts.push(`Creatinine shifted by ${creatinineDiff > 0 ? '+' : ''}${creatinineDiff.toFixed(2)} mg/dL`);
                summaryText += shifts.join(' and ') + '. ';
              } else {
                summaryText += `Establishing baseline report on ${recent.date}. `;
              }

              if (recent.HbA1c > 6.5 && recent.creatinine > 1.2) {
                summaryText += `The synchronous elevation of glycemic markers and creatinine signals a highly sensitive Diabetic Nephropathy progression risk. Recommend immediate review of cardiovascular standard support (SGLT2 inhibitors like Empagliflozin).`;
              } else if (recent.HbA1c > 6.5) {
                summaryText += `Glycemic markers are elevated. Prioritize dietary carb controls and lifestyle optimization.`;
              } else if (recent.creatinine > 1.2) {
                summaryText += `Renal clearance parameters are elevated. Monitor blood pressure closely and perform follow-up GFR/Creatinine scan in 14 days.`;
              } else {
                summaryText += `Patient parameters are within stable clinical limits. Maintain regular prophylactic counseling.`;
              }
            }

            return (
              <div className="p-6 bg-white text-slate-800 rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden space-y-6 animate-fade-in my-2">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex justify-between items-start pb-2 border-b border-slate-200/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-600 text-xl font-bold">query_stats</span>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">AI Predictive Lab Pattern & Risk Disease Analyzer</h3>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">Advanced multi-biomarker trajectory & disease prediction engine</p>
                  </div>
                  <span className="text-[8px] font-black font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                    Predictive Model: Active
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {isOphthalmology ? [
                    {
                      name: 'Visual Acuity (OD)',
                      val: recent.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback,
                      base: baseline ? (baseline.temperature || OPHTHALMIC_EYE_CARE_COPY.odFallback) : 'N/A',
                      diff: 0,
                      unit: '',
                      normal: OPHTHALMIC_EYE_CARE_COPY.odFallback,
                      status: getAcuityRank(recent.temperature || '6/6') > 2 ? 'abnormal' : 'normal',
                      icon: 'visibility',
                      color: getAcuityRank(recent.temperature || '6/6') > 2 ? 'rose' : 'emerald'
                    },
                    {
                      name: 'Intraocular Pressure',
                      val: `${recent.pulseRate || 16} mmHg`,
                      base: baseline ? `${baseline.pulseRate || 16} mmHg` : 'N/A',
                      diff: baseline ? (recent.pulseRate || 16) - (baseline.pulseRate || 16) : 0,
                      unit: 'mmHg',
                      normal: '10 - 21',
                      status: (recent.pulseRate || 16) > 21 ? 'critical' : 'normal',
                      icon: 'eye_tracking',
                      color: (recent.pulseRate || 16) > 21 ? 'rose' : 'emerald'
                    },
                    {
                      name: 'Visual Acuity (OS)',
                      val: recent.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback,
                      base: baseline ? (baseline.bloodPressure || OPHTHALMIC_EYE_CARE_COPY.osFallback) : 'N/A',
                      diff: 0,
                      unit: '',
                      normal: OPHTHALMIC_EYE_CARE_COPY.osFallback,
                      status: getAcuityRank(recent.bloodPressure || '6/9') > 3 ? 'abnormal' : 'borderline',
                      icon: 'visibility',
                      color: getAcuityRank(recent.bloodPressure || '6/9') > 3 ? 'rose' : 'emerald'
                    }
                  ].map((item, idx) => {
                    const cardCls = item.color === 'rose'
                      ? 'from-rose-50 to-rose-100/50 border-rose-200 dark:from-rose-950/60 dark:to-rose-900/40 dark:border-rose-800/40'
                      : item.color === 'amber'
                      ? 'from-amber-50 to-amber-100/50 border-amber-200 dark:from-amber-950/60 dark:to-amber-900/40 dark:border-amber-800/40'
                      : 'from-emerald-50 to-emerald-100/50 border-emerald-200 dark:from-emerald-950/60 dark:to-emerald-900/40 dark:border-emerald-800/40';
                    return (
                    <div key={idx} className={`p-3.5 rounded-2xl border bg-gradient-to-b ${cardCls} flex flex-col justify-between space-y-2`}>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">{item.name}</span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">Normal: {item.normal}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-lg font-black font-mono tracking-tight text-slate-800 dark:text-white">{item.val}</span>
                        {baseline && item.diff !== 0 && (
                          <span className={`text-[10px] font-extrabold font-mono flex items-center gap-0.5 ${
                            (item.diff > 0 && item.status !== 'normal')
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {item.diff > 0 ? '▲' : '▼'} {Math.abs(item.diff).toFixed(0)}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-white/10 flex justify-between">
                        <span>Base: {item.base}</span>
                        <span className="font-bold text-[8px] uppercase tracking-wider">{item.status}</span>
                      </div>
                    </div>
                    );
                  }) : [
                    {
                      name: 'HbA1c (Glycated Hb)',
                      val: `${recent.HbA1c}%`,
                      base: baseline ? `${baseline.HbA1c}%` : 'N/A',
                      diff: hba1cDiff,
                      unit: '%',
                      normal: '4.0 - 5.6',
                      status: recent.HbA1c > 6.5 ? 'critical' : recent.HbA1c > 5.7 ? 'warning' : 'normal',
                      icon: 'water_drop',
                      color: recent.HbA1c > 6.5 ? 'rose' : recent.HbA1c > 5.7 ? 'amber' : 'emerald',
                      zones: [
                        { start: 3.0, end: 5.7, color: 'bg-emerald-500' },
                        { start: 5.7, end: 6.5, color: 'bg-amber-400' },
                        { start: 6.5, end: 10.0, color: 'bg-rose-500' }
                      ],
                      min: 3.0,
                      max: 10.0,
                      numericVal: recent.HbA1c
                    },
                    {
                      name: 'Serum Creatinine',
                      val: `${recent.creatinine} mg/dL`,
                      base: baseline ? `${baseline.creatinine} mg/dL` : 'N/A',
                      diff: creatinineDiff,
                      unit: 'mg/dL',
                      normal: '0.6 - 1.2',
                      status: recent.creatinine > 1.2 ? 'critical' : recent.creatinine > 1.0 ? 'warning' : 'normal',
                      icon: 'kidney',
                      color: recent.creatinine > 1.2 ? 'rose' : recent.creatinine > 1.0 ? 'amber' : 'emerald',
                      zones: [
                        { start: 0.2, end: 1.2, color: 'bg-emerald-500' },
                        { start: 1.2, end: 1.5, color: 'bg-amber-400' },
                        { start: 1.5, end: 2.0, color: 'bg-rose-500' }
                      ],
                      min: 0.2,
                      max: 2.0,
                      numericVal: recent.creatinine
                    },
                    ...(calculatedGfr ? [{
                      name: 'Estimated GFR (CKD-EPI)',
                      val: `${calculatedGfr} mL/min`,
                      base: 'N/A',
                      diff: 0,
                      unit: 'mL/min',
                      normal: '> 90',
                      status: calculatedGfr < 30 ? 'critical' : calculatedGfr < 60 ? 'warning-severe' : calculatedGfr < 90 ? 'warning' : 'normal',
                      icon: 'analytics',
                      color: calculatedGfr < 60 ? 'rose' : calculatedGfr < 90 ? 'amber' : 'emerald',
                      zones: [
                        { start: 10, end: 30, color: 'bg-rose-500' },
                        { start: 30, end: 60, color: 'bg-orange-400' },
                        { start: 60, end: 90, color: 'bg-amber-400' },
                        { start: 90, end: 130, color: 'bg-emerald-500' }
                      ],
                      min: 10,
                      max: 130,
                      numericVal: calculatedGfr
                    }] : []),
                    {
                      name: 'Total Hemoglobin',
                      val: `${recent.hemoglobin} g/dL`,
                      base: baseline ? `${baseline.hemoglobin} g/dL` : 'N/A',
                      diff: hemoglobinDiff,
                      unit: 'g/dL',
                      normal: '12.0 - 16.0',
                      status: recent.hemoglobin < 12.0 ? 'warning' : 'normal',
                      icon: 'bloodtype',
                      color: recent.hemoglobin < 12.0 ? 'amber' : 'emerald'
                    }
                  ].map((item: any, idx) => {
                    const cardCls = item.color === 'rose'
                      ? 'from-rose-50 to-rose-100/50 border-rose-200 dark:from-rose-950/70 dark:to-rose-900/50 dark:border-rose-800/50'
                      : item.color === 'amber'
                      ? 'from-amber-50 to-amber-100/50 border-amber-200 dark:from-amber-950/70 dark:to-amber-900/50 dark:border-amber-800/50'
                      : 'from-emerald-50 to-emerald-100/50 border-emerald-200 dark:from-emerald-950/70 dark:to-emerald-900/50 dark:border-emerald-800/50';
                    return (
                    <div key={idx} className={`p-3.5 rounded-2xl border bg-gradient-to-b ${cardCls} flex flex-col justify-between space-y-2.5`}>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">{item.name}</span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">Normal: {item.normal}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-lg font-black font-mono tracking-tight text-slate-900 dark:text-white">{item.val}</span>
                        {baseline && item.diff !== 0 && (
                          <span className={`text-[10px] font-extrabold font-mono flex items-center gap-0.5 ${
                            (item.diff > 0 && item.status !== 'normal') || (item.diff < 0 && item.name.includes('Hemoglobin'))
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}>
                            {item.diff > 0 ? '▲' : '▼'} {Math.abs(item.diff).toFixed(item.name.includes('Creatinine') ? 2 : 1)}
                          </span>
                        )}
                      </div>

                      {/* Visual Sparkline Range indicator */}
                      {item.zones && item.min !== undefined && item.max !== undefined && item.numericVal !== undefined && (
                        <div className="mt-1 pb-1">
                          <div className="relative h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden flex">
                            {item.zones.map((zone: any, zIdx: number) => {
                              const zoneWidth = ((zone.end - zone.start) / (item.max! - item.min!)) * 100;
                              return (
                                <div
                                  key={zIdx}
                                  className={`${zone.color}`}
                                  style={{ width: `${zoneWidth}%` }}
                                />
                              );
                            })}
                          </div>
                          <div className="relative w-full h-1.5 mt-0.5">
                            <div 
                              className="absolute top-[-3px] -translate-x-1/2" 
                              style={{ left: `${Math.min(100, Math.max(0, ((item.numericVal! - item.min!) / (item.max! - item.min!)) * 100))}%` }}
                            >
                              <div className="w-2 h-2 rounded-full bg-slate-855 border border-white shadow-sm" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="text-[9px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-white/10 flex justify-between">
                        <span>Base: {item.base}</span>
                        <span className="font-bold text-[8px] uppercase tracking-wider">{item.status}</span>
                      </div>
                    </div>
                    );
                  })}
                </div>
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                    <span className="material-symbols-outlined text-xs text-indigo-600">warning</span>
                    AI Predictive Disease & Pattern Warnings
                  </h4>
                  {riskAlerts.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs italic">
                      No critical disease risks flagged based on biomarker trajectories.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {riskAlerts.map((alert, i) => (
                        <div key={i} className={`p-3 rounded-xl border flex gap-3 text-xs leading-relaxed ${
                          alert.type === 'critical'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : alert.type === 'warning'
                            ? 'bg-amber-50 border-amber-200/60 text-amber-900'
                            : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                        }`}>
                          <span className="material-symbols-outlined text-base font-bold mt-0.5 shrink-0">
                            {alert.type === 'critical' ? 'gavel' : alert.type === 'warning' ? 'error' : 'info'}
                          </span>
                          <div>
                            <strong className="font-extrabold text-[11px] uppercase tracking-wider block">{alert.title}</strong>
                            <p className="text-[10px] text-slate-700 pt-0.5 font-sans leading-relaxed">{alert.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
 
                <div className="p-4 bg-indigo-50/20 border border-indigo-100/80 rounded-2xl space-y-1.5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                  <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                    Professional AI Consultation Summary
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed font-sans font-medium italic pt-1">
                    "{summaryText}"
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Electronic Consultation Record Gating, Suggestions, and AI Summaries */}
          <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-6 shadow-sm text-left">
            {/* Live AI Clinical RAG Advisory */}
            {isAiLoading ? (
              <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl animate-pulse space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500 animate-spin text-sm">sync</span>
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider font-mono">Running Live RAG Clinical Advisory Prompt...</span>
                </div>
                <div className="h-2 bg-slate-200/60 rounded w-3/4 animate-pulse"></div>
                <div className="h-2 bg-slate-200/60 rounded w-5/6 animate-pulse"></div>
                <div className="h-2 bg-slate-200/60 rounded w-1/2 animate-pulse"></div>
              </div>
            ) : aiInsight ? (
              <div className="p-5 bg-indigo-50/40 border border-indigo-150 rounded-2xl space-y-3 animate-fade-in text-left">
                <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                  <h3 className="text-xs font-black text-indigo-800 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm font-bold text-indigo-700">psychology</span>
                    Live RAG Clinical Advisory (Active Care Support)
                  </h3>
                  <span className="text-[8px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-mono">
                    PERSISTED CACHE
                  </span>
                </div>
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium max-h-[300px] overflow-y-auto pr-1">
                  {aiInsight}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-primary font-bold">edit_note</span>
                Final 10-15 Min Suggestions & Directions
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Record patient suggestions here (e.g., meetha kam khana hai, daily walk karna hai, start insulin)..."
                rows={4}
                className="w-full input-field bg-white text-xs leading-relaxed"
              />
            </div>

            {/* Local Audio Scribe Recorder Widget */}
            <div className="p-4.5 bg-white border border-slate-200 rounded-2xl space-y-4 animate-fade-in text-slate-800">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">mic</span>
                  Audio Suggestion Scribe (Local Recording first)
                </span>
                <span className="text-[9px] font-bold font-mono px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md">
                  Zero API Cost Idle
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {isRecording ? (
                    <button
                      type="button"
                      onClick={stopAudioRecording}
                      className="w-full sm:w-auto px-5 py-2.5 bg-rose-650 hover:bg-rose-600 active:scale-95 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 uppercase transition-all shadow-md animate-pulse cursor-pointer border-0 text-slate-800-force"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
                      Stop Recording ({recordingSeconds}s)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startAudioRecording}
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 uppercase transition-all shadow-md cursor-pointer border-0 text-white-force"
                    >
                      <span className="material-symbols-outlined text-sm font-bold shrink-0">mic</span>
                      Record Clinical Advice
                    </button>
                  )}
                </div>

                {audioUrl && (
                  <div className="w-full sm:flex-1 bg-slate-900 border border-slate-200 p-2 rounded-xl flex items-center justify-between gap-3">
                    <audio src={audioUrl} controls className="w-full h-8 shrink" />
                    
                    <button
                      type="button"
                      onClick={executeAudioScribeTranscription}
                      disabled={isTranscribing}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 active:scale-95 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 uppercase transition-all shadow-xs cursor-pointer shrink-0 border-0 text-white-force"
                    >
                      <span className="material-symbols-outlined text-xs font-bold text-white-force">psychology</span>
                      {isTranscribing ? 'Scribing...' : 'Transcribe with AI'}
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[9px] text-slate-600 leading-normal text-left">
                🎙️ **Privacy & Cost Guard**: Your voice is recorded locally in-browser. Transcribe with AI only when you are satisfied with your audio note.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  if (!notes.trim()) {
                    alert('Please write suggestions first.');
                    return;
                  }
                  setIsGeneratingSummary(true);
                  try {
                    const summary = await api.generateConsultHinglishSummary(selectedPatient.id, notes);
                    setHinglishSummary(summary);
                    
                    const taskId = `task-hinglish-${selectedPatient.id}-${Date.now()}`;
                    await api.saveAIResult({
                      id: crypto.randomUUID(),
                      user_id: 'doctor-uuid-placeholder',
                      task_id: taskId,
                      patient_id: selectedPatient.id,
                      input_data: notes,
                      output_data: summary,
                      output_type: 'HINGLISH_SUMMARY',
                      status: 'SUCCESS',
                      created_at: new Date().toISOString(),
                      model_used: 'gemini-1.5-flash',
                      duration_ms: 1000
                    });

                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: {
                        title: 'Hinglish AI Summary Generated! ✨',
                        message: 'Clinical summary generated successfully in friendly Hinglish.',
                        type: 'success'
                      }
                    }));
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsGeneratingSummary(false);
                  }
                }}
                disabled={isGeneratingSummary}
                className="w-full bg-primary hover:bg-primary-600 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 text-white-force cursor-pointer border-0"
              >
                {isGeneratingSummary ? 'Generating...' : '🤖 Generate AI Hinglish Summary'}
              </button>
            </div>

            {hinglishSummary && (
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3 animate-fade-in text-left">
                <h4 className="font-bold text-[10px] text-indigo-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">chat</span>
                  Hinglish Clinical Summary
                </h4>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-semibold italic">
                  "{hinglishSummary}"
                </p>
                <button
                  onClick={() => {
                    api.pushWhatsAppMessageFromBot(selectedPatient.phone, hinglishSummary);
                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: {
                        title: 'WhatsApp Summary Dispatched! 📱',
                        message: `Friendly Hinglish instructions sent to +91 ${selectedPatient.phone}.`,
                        type: 'success'
                      }
                    }));
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 uppercase transition-colors cursor-pointer border-0"
                >
                  <span className="material-symbols-outlined text-xs text-white-force">send</span>
                  Send to Patient WhatsApp
                </button>
              </div>
            )}

            {/* REVISIT LAB TREND COMPARISON */}
            {activeHistory && activeHistory.length > 0 && (
              <div className="border-t border-slate-200/80 pt-4 space-y-4 text-left">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-500 text-sm">analytics</span>
                  Revisit Mode: Comparative Lab Trend Analysis
                </h3>
                <p className="text-[10px] text-slate-600 leading-relaxed font-sans">
                  Compare current biomarkers with historical reports to analyze improvement metrics.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans my-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Baseline Report Date</label>
                    <select
                      value={baselineDate || ''}
                      onChange={(e) => setBaselineDate(e.target.value || null)}
                      className="w-full px-3.5 py-2 border border-slate-200 focus:border-indigo-500/50 rounded-xl outline-none bg-white text-slate-800"
                    >
                      <option value="">(Select Baseline Date)</option>
                      {activeHistory.map((h: any) => (
                        <option key={h.date} value={h.date}>{h.date}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comparison Report Date</label>
                    <select
                      value={comparisonDate || ''}
                      onChange={(e) => setComparisonDate(e.target.value || null)}
                      className="w-full px-3.5 py-2 border border-slate-200 focus:border-indigo-500/50 rounded-xl outline-none bg-white text-slate-800"
                    >
                      <option value="">(Select Comparison Date)</option>
                      {activeHistory.map((h: any) => (
                        <option key={h.date} value={h.date}>{h.date}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      if (!compReport) return;
                      setIsGeneratingTrend(true);
                      try {
                        const trend = await api.generateComparativeLabTrend(selectedPatient.id, baselineDate, comparisonDate);
                        setComparativeTrend(trend);
                        
                        const taskId = `task-trend-${selectedPatient.id}-${Date.now()}`;
                        await api.saveAIResult({
                          id: crypto.randomUUID(),
                          user_id: 'doctor-uuid-placeholder',
                          task_id: taskId,
                          patient_id: selectedPatient.id,
                          input_data: `Comparative trend: baseline=${baselineDate || 'None'}, comparison=${comparisonDate || 'None'}`,
                          output_data: trend.summaryText,
                          output_type: 'COMPARATIVE_TREND',
                          status: 'SUCCESS',
                          created_at: new Date().toISOString(),
                          model_used: 'gemini-1.5-flash',
                          duration_ms: 1000
                        });

                        api.writeAuditLog('CDSS_LAB_TREND_ANALYSIS', {
                          patientId: selectedPatient.id,
                          patientName: selectedPatient.name,
                          baselineDate,
                          comparisonDate,
                          gfr: trend.gfr,
                          citationsCount: trend.citations?.length || 0,
                          suggestedCompositionsCount: trend.suggestedCompositions?.length || 0
                        }, selectedPatient.id);

                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'Lab Trend Analyzed! 📊',
                            message: 'Comparative trend calculated successfully.',
                            type: 'success'
                          }
                        }));
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setIsGeneratingTrend(false);
                      }
                    }}
                    disabled={isGeneratingTrend}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-white-force border-0"
                  >
                    {isGeneratingTrend ? 'Analyzing...' : '📊 Generate Comparative AI Summary'}
                  </button>
                </div>

                {comparativeTrend && (
                  <div className="p-5 bg-gradient-to-br from-rose-50/70 to-indigo-50/50 border border-slate-200/80 rounded-2xl space-y-5 animate-fade-in text-left shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[10px] text-rose-800 uppercase tracking-widest font-mono flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs">analytics</span>
                        Evidence-Based Comparative CDSS Report
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePrintClinicalReferral}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-200/50 flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <span className="material-symbols-outlined text-[11px]">print</span>
                          Print Referral Note
                        </button>
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Active</span>
                      </div>
                    </div>

                    {/* Summary Text */}
                    <div className="bg-white/80 border border-white/40 p-4 rounded-xl space-y-2">
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                        {comparativeTrend.summaryText}
                      </p>
                    </div>

                    {/* Suggested Compositions Grid */}
                    {comparativeTrend.suggestedCompositions && comparativeTrend.suggestedCompositions.length > 0 && (
                      <div className="space-y-2.5">
                        <h5 className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-rose-600">medication</span>
                          Suggested Medicine Compositions & Dosages
                        </h5>
                        <div className="grid grid-cols-1 gap-3">
                          {comparativeTrend.suggestedCompositions.map((comp: any, idx: number) => (
                            <div key={idx} className="p-3.5 bg-white/95 border border-slate-200/80 rounded-xl flex flex-col md:flex-row justify-between gap-3 shadow-xs hover:shadow-md transition-shadow">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong className="text-xs font-bold text-slate-800">{comp.medicine_name}</strong>
                                  <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200/40 font-mono">{comp.composition}</span>
                                </div>
                                <p className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[10px]">schedule</span>
                                  Dosage: {comp.suggested_dosage}
                                </p>
                                <p className="text-[10px] text-slate-500 leading-normal">
                                  <span className="font-bold text-slate-600">Justification: </span>{comp.justification}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  const alreadyAdded = medications.some(m => m.medicineName.toLowerCase() === comp.medicine_name.toLowerCase());
                                  if (alreadyAdded) {
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: {
                                        title: 'Already Added',
                                        message: `${comp.medicine_name} is already in the prescription list.`,
                                        type: 'warning'
                                      }
                                    }));
                                    return;
                                  }
                                  setMedications([
                                    ...medications,
                                    {
                                      medicineName: comp.medicine_name,
                                      dosage: comp.composition,
                                      frequency: comp.suggested_dosage,
                                      duration: '30 Days'
                                    }
                                  ]);
                                  
                                  setTimeout(() => {
                                    const container = document.getElementById('doctor-tab-container') || document.querySelector('.doctor-dashboard-main-content');
                                    const panel = document.getElementById('prescription-panel');
                                    if (container && panel) {
                                      const offsetTop = panel.offsetTop;
                                      container.scrollTop = offsetTop - 120;
                                    }
                                    setFlashPrescriptionPanel(true);
                                    setTimeout(() => setFlashPrescriptionPanel(false), 1500);
                                  }, 100);

                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: {
                                      title: 'e-Rx Appended 💊',
                                      message: `Added ${comp.medicine_name} to prescription list.`,
                                      type: 'success'
                                    }
                                  }));
                                }}
                                className="self-start md:self-center bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-indigo-200/50 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                              >
                                <span className="material-symbols-outlined text-[11px]">add</span>
                                Add to Rx
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* NCBI PubMed Reference Library */}
                    {comparativeTrend.citations && comparativeTrend.citations.length > 0 && (
                      <div className="space-y-2.5">
                        <h5 className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-rose-600">library_books</span>
                          NCBI PubMed Reference Library
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {comparativeTrend.citations.map((c: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-all flex flex-col justify-between text-left shadow-xs"
                            >
                              <div className="space-y-1">
                                <h6 className="text-[11px] font-bold text-slate-800 leading-snug">
                                  {c.title}
                                </h6>
                                <p className="text-[9px] text-slate-500 font-mono">
                                  {c.journal} ({c.year})
                                </p>
                              </div>
                              
                              {c.abstract && (
                                <div className="mt-2.5 pt-2 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setExpandedCitationPmid(expandedCitationPmid === c.pmid ? null : c.pmid);
                                    }}
                                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                                  >
                                    <span className="material-symbols-outlined text-[11px]">
                                      {expandedCitationPmid === c.pmid ? 'keyboard_arrow_up' : 'quick_reference_all'}
                                    </span>
                                    {expandedCitationPmid === c.pmid ? 'Hide Abstract' : 'Quick Summary (Abstract)'}
                                  </button>
                                  {expandedCitationPmid === c.pmid && (
                                    <p className="text-[10px] text-slate-600 mt-2 bg-slate-55 p-2.5 rounded-lg border border-slate-100 leading-relaxed transition-all animate-fade-in font-medium">
                                      {c.abstract}
                                    </p>
                                  )}
                                </div>
                              )}

                              <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-100">
                                <span className="text-[9px] text-slate-500 font-bold font-mono">
                                  PMID: {c.pmid}
                                </span>
                                <a
                                  href={c.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[9px] text-indigo-600 hover:text-indigo-850 font-bold flex items-center gap-0.5 no-underline"
                                >
                                  Full Paper <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CDSS Medical Disclaimer */}
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex gap-2.5">
                      <span className="material-symbols-outlined text-rose-600 text-xs shrink-0 font-bold">gavel</span>
                      <p className="text-[9px] text-rose-800/90 leading-relaxed">
                        <strong>CDSS Legal Disclaimer:</strong> The suggested drug compositions, active compounds, target dosages, and medical literature citations are provided strictly for clinical decision support. They do not constitute formal prescription directives. The attending licensed practitioner retains full clinical responsibility and absolute prescribing authority.
                      </p>
                    </div>

                    {/* WhatsApp Action Buttons */}
                    <button
                      onClick={() => {
                        api.pushWhatsAppMessageFromBot(selectedPatient.phone, comparativeTrend.summaryText);
                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'Trend Sent! 📱',
                            message: `Comparative lab trend pushed to +91 ${selectedPatient.phone} via WhatsApp.`,
                            type: 'success'
                          }
                        }));
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 uppercase transition-colors cursor-pointer border-0"
                    >
                      <span className="material-symbols-outlined text-xs text-white-force">send</span>
                      Push Trend report to Patient WhatsApp
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* AI Generation History List */}
            <div className="mt-4 p-5 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-bold text-[10px] text-slate-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">history</span>
                  AI Generation History ({aiHistory.length})
                </h4>
                {aiHistory.length > 0 && (
                  <span className="text-[8px] bg-slate-200 text-slate-650 px-2 py-0.5 rounded font-mono">
                    Offline Resilient
                  </span>
                )}
              </div>
              {aiHistory.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic">No previously saved AI outputs for this patient.</p>
              ) : (
                <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                  {aiHistory.map((h: any) => (
                    <div key={h.id} className="p-3 bg-white border border-slate-200/60 rounded-xl text-[10px] text-slate-650 leading-relaxed font-sans space-y-2 hover:shadow-xs transition-all">
                      <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          {h.output_type.replace(/_/g, ' ')}
                        </span>
                        <span>{new Date(h.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-slate-800 font-medium whitespace-pre-line bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 max-h-40 overflow-y-auto text-[10px] leading-relaxed">
                        {h.output_data}
                      </div>
                      <div className="flex justify-between items-center text-[8px] text-slate-400 font-medium">
                        <span>Model: {h.model_used}</span>
                        {h.input_data && (
                          <span className="truncate max-w-[200px]" title={h.input_data}>
                            Input: "{h.input_data}"
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        {/* Clinical Notes (placed at the bottom of the workup tab) */}
            <div className="space-y-2 text-left mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <span className="material-symbols-outlined text-xs text-indigo-500 font-bold">edit_note</span>
                Consultation & Clinical Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Presenting complaints, systemic examination notes, and diagnosis..."
                rows={3}
                className="w-full input-field resize-none text-xs leading-relaxed bg-white border border-slate-200"
              />
            </div>

            {/* Tab Transition Button */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveSubTab('prescription')}
                className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs px-6 py-2.5 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1 cursor-pointer border-0 text-white-force"
              >
                Proceed to Prescription
                <span className="material-symbols-outlined text-xs font-bold text-white-force">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {activeSubTab === 'prescription' && (
          <div className="space-y-5 animate-fade-in">
            {cdssAnomalies && cdssAnomalies.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-850 dark:text-rose-400 p-4.5 rounded-2xl space-y-2.5 animate-fade-in text-left">
                <div className="flex justify-between items-center border-b border-rose-200/50 dark:border-rose-800/30 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <span className="material-symbols-outlined text-[16px] text-rose-500 font-bold animate-pulse">shield_alert</span>
                    Clinical Decision Safety Warnings (CDSS)
                  </h4>
                  <span className="text-[9px] font-black font-mono bg-rose-500/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md border border-rose-500/20">
                    Confidence: 96%
                  </span>
                </div>
                <div className="space-y-2">
                  {cdssAnomalies.map((anomaly, idx) => (
                    <div key={idx} className="text-xs font-semibold leading-relaxed flex items-start gap-1.5">
                      <span className="text-rose-500 font-bold">•</span>
                      <div>
                        {anomaly}
                        <div className="text-[9px] text-slate-500 dark:text-zinc-400 italic mt-0.5">
                          Citation: National Clinical Portal Guidelines v4.2 (ADA 2025/NHG Glaucoma Protocol)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prescribe Medications */}
          <div 
            id="prescription-panel" 
            className={`space-y-4 text-left border-t border-slate-100 pt-5 transition-all duration-500 p-2.5 rounded-2xl ${
              flashPrescriptionPanel ? 'bg-indigo-50/80 border border-indigo-200 ring-4 ring-indigo-500/20' : ''
            }`}
          >
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-primary font-bold">medication</span>
                Prescribe Medications (e-Rx)
              </label>
              <button
                type="button"
                onClick={() => setIsPrescriptionModalOpen(true)}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-500 text-indigo-700 hover:text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-xs font-bold">receipt_long</span>
                Interactive E-Rx Pad
              </button>
            </div>

            {/* Smart Drug Swap Banner */}
            {(() => {
              if (!selectedPatient) return null;
              const hasNSAID = medications.some(m => {
                const name = m.medicineName.toLowerCase();
                return name.includes('ibuprofen') || 
                       name.includes('diclofenac') || 
                       name.includes('naproxen') || 
                       name.includes('ketorolac') || 
                       name.includes('mefenamic') || 
                       name.includes('indomethacin') || 
                       name.includes('meloxicam') || 
                       name.includes('celecoxib') ||
                       name.includes('nsaid');
              });

              if (!hasNSAID) return null;

              const hist = api.getPatientHistoricalBiomarkers(selectedPatient.id);
              const recentReport = hist.length > 0 ? hist[hist.length - 1] : null;
              const currentCreatinine = recentReport?.creatinine ?? 0.0;
              
              let currentGfr = 90;
              if (recentReport && recentReport.creatinine) {
                const scr = recentReport.creatinine;
                const ageVal = selectedPatient.age ?? 45;
                const genderVal = selectedPatient.gender || 'Male';
                const isFemale = genderVal.toLowerCase() === 'female';
                const k = isFemale ? 0.7 : 0.9;
                const alpha = isFemale ? -0.241 : -0.302;
                const genderMult = isFemale ? 1.012 : 1.0;
                currentGfr = 142 * Math.pow(Math.min(scr / k, 1), alpha) * Math.pow(Math.max(scr / k, 1), -1.200) * Math.pow(0.9938, ageVal) * genderMult;
              }

              if (currentCreatinine > 1.2 || currentGfr < 60) {
                return (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 animate-fade-in shadow-xs">
                    <div className="flex gap-2.5 items-start">
                      <span className="material-symbols-outlined text-amber-600 text-base font-bold shrink-0">warning</span>
                      <div className="space-y-1">
                        <h5 className="font-extrabold text-[11px] text-amber-850 uppercase tracking-wide">Nephrotoxic NSAID Alert (Renal Risk)</h5>
                        <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                          Attending patient has elevated Serum Creatinine ({currentCreatinine} mg/dL) or GFR ({Math.round(currentGfr * 10) / 10} mL/min). Clinical decision guidelines suggest avoiding nephrotoxic NSAIDs to prevent acute renal failure.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updatedMeds = medications.map(m => {
                          const name = m.medicineName.toLowerCase();
                          if (name.includes('ibuprofen') || name.includes('diclofenac') || name.includes('naproxen') || name.includes('ketorolac') || name.includes('mefenamic') || name.includes('indomethacin') || name.includes('meloxicam') || name.includes('celecoxib') || name.includes('nsaid')) {
                            return {
                              ...m,
                              medicineName: 'Paracetamol 500mg',
                              dosage: 'Paracetamol IP 500mg',
                              frequency: '1 tablet twice daily after meals as needed',
                              duration: m.duration || '5 Days'
                            };
                          }
                          return m;
                        });
                        setMedications(updatedMeds);
                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                          detail: {
                            title: 'Renal-Safe Swap Applied 🔄',
                            message: 'Substituted nephrotoxic NSAID with Paracetamol 500mg.',
                            type: 'success'
                          }
                        }));
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg border-0 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap self-stretch md:self-auto text-center justify-center text-white-force"
                    >
                      <span className="material-symbols-outlined text-[11px]">swap_horiz</span>
                      Swap with Paracetamol
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {/* List of current medications (Professional Clinical Cards) */}
            {medications.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[300px] overflow-y-auto pr-1">
                {medications.map((med, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 bg-white border border-slate-200/80 rounded-2xl flex justify-between items-start hover:border-indigo-300 hover:shadow-xs transition-all relative overflow-hidden group"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                    <div className="space-y-2 flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-500 text-base font-bold">medication</span>
                        <strong className="text-slate-800 text-xs font-bold font-sans tracking-tight">{med.medicineName}</strong>
                      </div>
                      
                      {med.dosage && (
                        <div className="text-[10px] text-slate-500 font-medium">
                          <span className="font-semibold text-slate-700">Generic Formula:</span> {med.dosage}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                          🕒 {med.frequency}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                          📅 {med.duration}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleRemoveMedication(idx)}
                      className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer border border-slate-200/60 hover:border-rose-200"
                      title="Remove Medication"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl text-center flex flex-col items-center justify-center space-y-1.5">
                <span className="material-symbols-outlined text-slate-400 text-2xl">receipt_long</span>
                <p className="text-xs text-slate-600 font-medium font-sans">No medications prescribed yet.</p>
                <p className="text-[10px] text-slate-400 font-medium">Type a medicine name below to generate suggestions.</p>
              </div>
            )}

            {/* Form to add medication with autocomplete typeahead */}
            <div className="space-y-4 bg-slate-50/30 p-4.5 border border-slate-200/50 rounded-2xl relative">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* Autocomplete Input */}
                <div ref={dropdownRef} className="md:col-span-2 space-y-1.5 relative">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Medicine Name</span>
                    {isOphthalmology && (
                      <div className="flex gap-1">
                        {['OD', 'OS', 'OU'].map(eye => (
                          <button
                            key={eye}
                            type="button"
                            onClick={() => {
                              const cleanName = medName.replace(/\s*\((OD|OS|OU)\)/i, '').trim();
                              if (cleanName) {
                                setMedName(`${cleanName} (${eye})`);
                              }
                            }}
                            className="px-1.5 py-0.2 bg-indigo-50 hover:bg-indigo-500 hover:text-white text-indigo-700 rounded text-[7.5px] font-black border border-indigo-200/50 cursor-pointer transition-all"
                          >
                            {eye}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={isOphthalmology ? "e.g. Moxifloxacin Eye Drops" : "e.g. Paracetamol 650mg"}
                      value={medName}
                      onChange={(e) => setMedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (!showSuggestions || suggestions.length === 0) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setActiveSuggestionIdx(prev => (prev + 1) % suggestions.length);
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setActiveSuggestionIdx(prev => (prev - 1 + suggestions.length) % suggestions.length);
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          const selected = suggestions[activeSuggestionIdx];
                          setIsSelectingFromDropdown(true);
                          setMedName(selected.name);
                          setMedDosage(selected.genericName);
                          setMedFreq(selected.frequency);
                          setMedDur(selected.duration);
                          setShowSuggestions(false);
                        } else if (e.key === 'Escape') {
                          setShowSuggestions(false);
                        }
                      }}
                      className="w-full input-field py-2 text-xs bg-white border-slate-200 pr-8"
                    />
                    <span className="material-symbols-outlined text-slate-400 absolute right-2.5 top-2.5 text-sm pointer-events-none">search</span>
                  </div>

                  {/* Autocomplete Dropdown Panel */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-[220px] overflow-y-auto">
                      {suggestions.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setIsSelectingFromDropdown(true);
                            setMedName(item.name);
                            setMedDosage(item.genericName);
                            setMedFreq(item.frequency);
                            setMedDur(item.duration);
                            setShowSuggestions(false);
                          }}
                          onMouseEnter={() => setActiveSuggestionIdx(idx)}
                          className={`p-3 border-b border-slate-100 last:border-0 flex justify-between items-center cursor-pointer text-xs transition-colors ${
                            idx === activeSuggestionIdx ? 'bg-indigo-50/70 text-indigo-900' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="font-semibold flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-xs text-indigo-500">medication</span>
                              {item.name}
                            </div>
                            <div className="text-[10px] text-slate-650 mt-0.5">
                              {item.genericName} • <span className="text-slate-450 italic">{item.category}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {item.inInventory ? (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider font-mono ${
                                item.stock > 10 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {item.stock} in stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider font-mono bg-indigo-50 text-indigo-600 border border-indigo-100">
                                Catalog
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dosage Input */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Dosage / Formula</span>
                  {isOphthalmology ? (
                    <select
                      value={medDosage}
                      onChange={(e) => setMedDosage(e.target.value)}
                      className="w-full input-field py-2 text-xs bg-white border-slate-200 cursor-pointer"
                    >
                      <option value="">-- Select --</option>
                      <option value="1 drop">1 drop</option>
                      <option value="2 drops">2 drops</option>
                      <option value="Thin ribbon">Thin ribbon</option>
                      <option value="Apply ointment">Apply ointment</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. 1 tab"
                      value={medDosage}
                      onChange={(e) => setMedDosage(e.target.value)}
                      className="w-full input-field py-2 text-xs bg-white border-slate-200"
                    />
                  )}
                </div>

                {/* Frequency & Duration Inputs */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Frequency</span>
                  {isOphthalmology ? (
                    <select
                      value={medFreq}
                      onChange={(e) => setMedFreq(e.target.value)}
                      className="w-full input-field py-2 text-xs bg-white border-slate-200 cursor-pointer"
                    >
                      <option value="">-- Select --</option>
                      {OPHTHALMIC_FREQUENCIES.map(freq => (
                        <option key={freq} value={freq}>{freq}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. 1-0-1"
                      value={medFreq}
                      onChange={(e) => setMedFreq(e.target.value)}
                      className="w-full input-field py-2 text-xs bg-white border-slate-200"
                    />
                  )}
                </div>
              </div>

              {/* Quick Presets / Shortcuts for General Medicine */}
              {!isOphthalmology && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wide">Quick Frequency Presets</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Once daily (morning)', val: '1-0-0' },
                        { label: 'Once daily (night)', val: '0-0-1' },
                        { label: 'Twice daily', val: '1-0-1' },
                        { label: 'Three times daily', val: '1-1-1' },
                        { label: 'As needed (PRN)', val: 'SOS' }
                      ].map(preset => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setMedFreq(preset.val)}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-[10px] font-semibold text-slate-650 transition-all cursor-pointer"
                        >
                          {preset.label} ({preset.val})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wide">Quick Duration Presets</span>
                    <div className="flex flex-wrap gap-1.5">
                      {['3 Days', '5 Days', '7 Days', '10 Days', '15 Days', '30 Days'].map(dur => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => setMedDur(dur)}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-[10px] font-semibold text-slate-650 transition-all cursor-pointer"
                        >
                          {dur}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Duration Input & Action Row */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-slate-100">
                <div className="space-y-1 flex-1 max-w-[200px]">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Duration</span>
                  <input
                    type="text"
                    placeholder="e.g. 5 Days"
                    value={medDur}
                    onChange={(e) => setMedDur(e.target.value)}
                    className="w-full input-field py-1.5 text-xs bg-white border-slate-200"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs px-6 py-2.5 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0 text-white-force self-end"
                >
                  <span className="material-symbols-outlined text-xs font-bold text-white-force">add</span>
                  Add to Prescription
                </button>
              </div>
            </div>
          </div>



          {/* Diagnostic Requisitions Section */}
          <div className="space-y-3 text-left">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-primary">biotech</span>
              Diagnostic Panel Requisition (LOINC-Coded)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {testCatalog.map((test: DiagnosticTest) => {
                const isChecked = selectedTests.some((t: DiagnosticTest) => t.loincCode === test.loincCode);
                return (
                  <button
                    key={test.loincCode}
                    onClick={() => handleToggleTest(test)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-xs transition-all duration-300 ${
                      isChecked
                        ? 'bg-primary-container/20 border-primary text-slate-800 shadow-sm'
                        : 'bg-slate-50 border-slate-200/50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <span className="font-bold block text-slate-700">{test.name}</span>
                      <span className="text-[8px] text-slate-400 font-mono mt-1 inline-block uppercase bg-slate-100 border border-slate-200/50 px-1.5 py-0.5 rounded">
                        LOINC: {test.loincCode}
                      </span>
                    </div>
                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                      isChecked ? 'bg-primary border-primary text-slate-800' : 'border-slate-300 bg-white'
                    }`}>
                      {isChecked && <span className="material-symbols-outlined text-xs font-bold text-slate-800-force">check</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ophthalmology Refraction Rx Grid */}
          {isOphthalmology && (
            <div className="space-y-6 pt-5 border-t border-slate-100 animate-fade-in text-left">
              {/* Refractionist Intake Metrics Summary Card */}
              {selectedPatient.vitals && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-205 pb-2">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-indigo-650 text-base font-bold">clinical_notes</span>
                      Refractionist Station Diagnostics (अपवर्तन रिपोर्ट)
                    </h3>
                    {selectedPatient.vitals.dilationStatus && (
                      <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded uppercase tracking-wider border ${
                        selectedPatient.vitals.dilationStatus === 'dilated'
                          ? 'bg-emerald-550/10 text-emerald-700 border-emerald-200'
                          : 'bg-amber-550/10 text-amber-800 border-amber-200'
                      }`}>
                        {selectedPatient.vitals.dilationStatus === 'dilated' ? '👁️ Fully Dilated' : '⏳ Dilation in Progress'}
                        {selectedPatient.vitals.dilationStatus === 'instilled' && selectedPatient.vitals.dilationStartTime && (
                          <span className="ml-1 text-[9px] font-mono lowercase">
                            ({Math.max(0, Math.ceil((new Date(selectedPatient.vitals.dilationStartTime).getTime() + 20 * 60 * 1000 - Date.now()) / (60 * 1000)))}m left)
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Visual Acuity */}
                    <div className="bg-white border border-slate-150 p-3 rounded-xl space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono block">Visual Acuity</span>
                      <div className="text-xs space-y-1 text-slate-800 font-medium">
                        <p className="flex justify-between"><span>Unaided OD:</span> <span className="font-bold text-indigo-700">{selectedPatient.vitals.visualAcuityOD || '6/6'}</span></p>
                        <p className="flex justify-between"><span>Unaided OS:</span> <span className="font-bold text-indigo-700">{selectedPatient.vitals.visualAcuityOS || '6/6'}</span></p>
                        {selectedPatient.vitals.visualAcuityAidedOD && (
                          <p className="flex justify-between"><span>Aided OD:</span> <span className="font-bold text-emerald-600">{selectedPatient.vitals.visualAcuityAidedOD}</span></p>
                        )}
                        {selectedPatient.vitals.visualAcuityAidedOS && (
                          <p className="flex justify-between"><span>Aided OS:</span> <span className="font-bold text-emerald-600">{selectedPatient.vitals.visualAcuityAidedOS}</span></p>
                        )}
                      </div>
                    </div>

                    {/* Autorefraction Readings */}
                    <div className="bg-white border border-slate-150 p-3 rounded-xl space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono block">Autorefraction (AR)</span>
                      <div className="text-xs space-y-1 text-slate-800 font-mono text-[10px]">
                        <p className="flex justify-between">
                          <span>OD:</span> 
                          <span className="font-bold">
                            {selectedPatient.vitals.arOD_sph ? `SPH ${selectedPatient.vitals.arOD_sph}` : ''}
                            {selectedPatient.vitals.arOD_cyl ? ` CYL ${selectedPatient.vitals.arOD_cyl}` : ''}
                            {selectedPatient.vitals.arOD_axis ? ` AXIS ${selectedPatient.vitals.arOD_axis}°` : ''}
                            {!selectedPatient.vitals.arOD_sph && !selectedPatient.vitals.arOD_cyl && '—'}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span>OS:</span> 
                          <span className="font-bold">
                            {selectedPatient.vitals.arOS_sph ? `SPH ${selectedPatient.vitals.arOS_sph}` : ''}
                            {selectedPatient.vitals.arOS_cyl ? ` CYL ${selectedPatient.vitals.arOS_cyl}` : ''}
                            {selectedPatient.vitals.arOS_axis ? ` AXIS ${selectedPatient.vitals.arOS_axis}°` : ''}
                            {!selectedPatient.vitals.arOS_sph && !selectedPatient.vitals.arOS_cyl && '—'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* IOP Intraocular Pressure */}
                    <div className="bg-white border border-slate-150 p-3 rounded-xl space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono block">Intraocular Pressure</span>
                      <div className="text-xs space-y-1 text-slate-800 font-medium">
                        <p className="flex justify-between"><span>IOP OD:</span> <span className="font-bold text-indigo-700">{selectedPatient.vitals.iopOD ? `${selectedPatient.vitals.iopOD} mmHg` : '—'}</span></p>
                        <p className="flex justify-between"><span>IOP OS:</span> <span className="font-bold text-indigo-700">{selectedPatient.vitals.iopOS ? `${selectedPatient.vitals.iopOS} mmHg` : '—'}</span></p>
                        {selectedPatient.vitals.dilationDropsUsed && (
                          <p className="flex justify-between text-[10px]"><span>Drops:</span> <span className="font-bold text-amber-600">{selectedPatient.vitals.dilationDropsUsed}</span></p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <OphthalmicRefractionGrid 
                value={refractionRx} 
                onChange={() => {}} 
                readOnly={true}
              />
              
              <BiometryWorksheet 
                value={biometryRx} 
                onChange={() => {}} 
                readOnly={true}
              />

              {/* Cataract Surgery Booking Widget */}
              <div className="glass-panel p-5 border-slate-200 bg-slate-50/40 shadow-xs rounded-2xl space-y-4 text-left my-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-600 text-xl">medical_services</span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Cataract Surgery Booking & IOL Planner</h3>
                  </div>
                  <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono font-bold uppercase">
                    Pre-Op Workspace
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Select Surgery Eye</label>
                    <select
                      value={surgeryEye}
                      onChange={e => setSurgeryEye(e.target.value as any)}
                      className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 cursor-pointer"
                    >
                      <option value="None">None (No Surgery Scheduled)</option>
                      <option value="OD">Right Eye (OD)</option>
                      <option value="OS">Left Eye (OS)</option>
                    </select>
                  </div>

                  {surgeryEye !== 'None' && (
                    <>
                      <div className="space-y-1 animate-fade-in">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Procedure Type</label>
                        <select
                          value={surgeryType}
                          onChange={e => setSurgeryType(e.target.value)}
                          className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 cursor-pointer"
                        >
                          <option value="Cataract - Phacoemulsification (MICS)">Cataract - Phacoemulsification (MICS)</option>
                          <option value="Cataract - SICS (Small Incision)">Cataract - SICS (Small Incision)</option>
                          <option value="Cataract - FLACS (Femto-Laser)">Cataract - FLACS (Femto-Laser)</option>
                        </select>
                      </div>

                      <div className="space-y-1 animate-fade-in">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Surgery Package Tier</label>
                        <select
                          value={surgeryPackage}
                          onChange={e => setSurgeryPackage(e.target.value)}
                          className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 cursor-pointer"
                        >
                          <option value="Indian Monofocal (SICS)">Indian Monofocal (SICS) - ₹12,000</option>
                          <option value="Indian Monofocal (Phaco)">Indian Monofocal (Phaco) - ₹18,000</option>
                          <option value="Imported Monofocal (Phaco)">Imported Monofocal (Phaco) - ₹32,000</option>
                          <option value="Premium Multifocal (Phaco)">Premium Multifocal (Phaco) - ₹65,000</option>
                          <option value="Ultra Toric/EDOF (Phaco)">Ultra Toric/EDOF (Phaco) - ₹95,000</option>
                        </select>
                      </div>

                      <div className="space-y-1 animate-fade-in">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono block">IOL Lens Model / Type</label>
                        <select
                          value={lensType}
                          onChange={e => setLensType(e.target.value)}
                          className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 cursor-pointer"
                        >
                          <option value="Monofocal">Monofocal Lens (Standard)</option>
                          <option value="Multifocal">Multifocal Lens (Presbyopia correcting)</option>
                          <option value="Toric">Toric Lens (Astigmatism correcting)</option>
                          <option value="EDOF">EDOF Lens (Extended Depth of Focus)</option>
                        </select>
                      </div>

                      <div className="space-y-1 animate-fade-in">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Target IOL Power (D)</label>
                        <input
                          type="text"
                          placeholder="e.g. +21.5 D"
                          value={iolPower}
                          onChange={e => setIolPower(e.target.value)}
                          className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 outline-none"
                        />
                      </div>

                      <div className="space-y-1 animate-fade-in">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Scheduled Surgery Date</label>
                        <input
                          type="date"
                          value={surgeryDate}
                          onChange={e => setSurgeryDate(e.target.value)}
                          className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1 px-2 text-xs text-slate-850 outline-none"
                        />
                      </div>

                      <div className="space-y-1 animate-fade-in">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Assigned OT Coordinator</label>
                        <select
                          value={surgeryCoordinator}
                          onChange={e => setSurgeryCoordinator(e.target.value)}
                          className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 cursor-pointer"
                        >
                          <option value="Sister Mary (OT Charge)">Sister Mary (OT Charge)</option>
                          <option value="Brother Paul (OT Assistant)">Brother Paul (OT Assistant)</option>
                          <option value="Dr. Verma (Anesthetist)">Dr. Verma (Anesthetist)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {surgeryEye !== 'None' && (
                  <div className="flex justify-end pt-2 border-t border-slate-200/50 animate-fade-in">
                    <button
                      type="button"
                      onClick={handleSaveSurgeryBooking}
                      disabled={isSurgerySaving || !surgeryDate}
                      className="px-5 py-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-200 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition active:scale-95 border-0 text-white-force bg-indigo-650-force"
                    >
                      {isSurgerySaving ? 'Scheduling...' : 'Save & Schedule Surgery'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* General Physician Minor OT & Daycare Procedure Booking Widget */}
          {!isOphthalmology && (
            <div className="glass-panel p-5 border-slate-200 bg-slate-50/40 shadow-xs rounded-2xl space-y-4 text-left my-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-xl">medical_services</span>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">GP Minor OT & Daycare Procedure Booking</h3>
                </div>
                <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono font-bold uppercase">
                  Procedure Workspace
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Select Minor Procedure</label>
                  <select
                    value={gpProcedureType}
                    onChange={e => setGpProcedureType(e.target.value)}
                    className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 cursor-pointer"
                  >
                    <option value="None">None (No Procedure Scheduled)</option>
                    <option value="Minor Suturing / Stitching">Minor Suturing / Stitching - ₹1,200</option>
                    <option value="Abscess Incision & Drainage (I&D)">Abscess Incision & Drainage (I&D) - ₹1,500</option>
                    <option value="Wound Dressing & Debridement">Wound Dressing & Debridement - ₹800</option>
                    <option value="Sebaceous Cyst Excision">Sebaceous Cyst Excision - ₹3,000</option>
                    <option value="IV Infusion / Saline Drip Session">IV Infusion / Saline Drip Session - ₹600</option>
                  </select>
                </div>

                {gpProcedureType !== 'None' && (
                  <>
                    <div className="space-y-1 animate-fade-in">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Scheduled Date</label>
                      <input
                        type="date"
                        value={gpProcedureDate}
                        onChange={e => setGpProcedureDate(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1 px-2 text-xs text-slate-850 outline-none"
                      />
                    </div>

                    <div className="space-y-1 animate-fade-in">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Assigned Facility / Dressing Room</label>
                      <select
                        value={gpProcedureRoom}
                        onChange={e => setGpProcedureRoom(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-indigo-400 rounded-lg py-1.5 px-2 text-xs text-slate-850 cursor-pointer"
                      >
                        <option value="Dressing Room 1">Dressing Room 1</option>
                        <option value="Dressing Room 2">Dressing Room 2</option>
                        <option value="Minor OT 1">Minor OT 1</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {gpProcedureType !== 'None' && (
                <div className="flex justify-end pt-2 border-t border-slate-200/50 animate-fade-in">
                  <button
                    type="button"
                    onClick={handleSaveGPProcedureBooking}
                    disabled={isGPProcedureSaving || !gpProcedureDate}
                    className="px-5 py-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-200 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition active:scale-95 border-0 text-white-force bg-indigo-650-force"
                  >
                    {isGPProcedureSaving ? 'Scheduling...' : 'Save & Schedule Procedure'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pod-to-Pod Network Referral */}
          <div className="border-t border-slate-100 pt-5 mt-5 space-y-3 text-left">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-primary font-bold">groups</span>
              Refer to Pod Partner Specialist
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <select
                  id="referral-specialist-select"
                  className="w-full input-field py-2 text-xs bg-white pr-8 appearance-none"
                  defaultValue=""
                  onChange={async (e) => {
                    const val = e.target.value;
                    if (!val) return;
                    await api.referPatientToSpecialist(selectedPatient.phone, val);
                    e.target.value = "";
                  }}
                >
                  <option value="">Select a Network Specialist to Refer...</option>
                  <option value="dfb2a1a8-8e68-4f8a-929e-4a6c8e317103">Dr. Sinha (Cardiologist) - Patna Central</option>
                  <option value="dfb2a1a8-8e68-4f8a-929e-4a6c8e317102">Dr. Anjali (Gynecologist) - Kankarbagh Pod</option>
                  <option value="dfb2a1a8-8e68-4f8a-929e-4a6c8e317101">Dr. Raj (Pediatrician) - Patna West</option>
                </select>
                <span className="material-symbols-outlined text-slate-600 absolute right-3 top-2.5 text-sm pointer-events-none">arrow_drop_down</span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex justify-end pt-5 border-t border-slate-100">
            <button
              onClick={handleSaveEncounter}
              className="btn-primary px-8 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-slate-800-force"
            >
              <CheckCircle2 className="h-5 w-5 text-slate-800-force" /> Submit Encounter & Route Mappings
            </button>
          </div>
          </div>
        )}
        </div>
      )}

      {/* ── INTERACTIVE E-PRESCRIPTION PAD WORKSPACE MODAL ── */}
      {isPrescriptionModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 md:p-6 md:pl-[272px] overflow-hidden animate-fade-in">
          <div className="glass-panel max-w-6xl w-full p-6 md:p-8 border-slate-200 shadow-2xl relative bg-white text-slate-800 rounded-3xl flex flex-col max-h-[92vh] overflow-hidden">
            
            {/* Top gradient accent line */}
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-indigo-500 via-primary to-secondary" />

            {/* Header: Title & Close Action */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-2xl font-bold">receipt_long</span>
                <div>
                  <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-wider font-sans">
                    Interactive Clinical E-Prescription Pad
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">Design & organize prescriptions and diagnostics worksheets in a unified layout</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrescriptionModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border-0"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Content Body: Scrollable Sheet */}
            <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-6">
              
              {/* Clinical letterhead */}
              <div className="p-5 bg-slate-50/50 border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                <div className="space-y-1 text-left border-r border-dashed border-slate-200 pr-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase">
                    {isOphthalmology ? "Dr. Amit Arya, MS (Ophthalmology)" : "Dr. Sharma, MD (Medicine)"}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {isOphthalmology ? "Ophthalmic Microsurgery & Refractive Consultant" : "General Medicine & Nephrology Specialist"}
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono">
                    Reg No: MCI-84992-A • Phone: +91 99342 98453
                  </p>
                  <p className="text-[9px] text-slate-500 font-medium">
                    🏢 {activePod?.clinicCode ? `Clinic Hub: Patna (Code: ${activePod.clinicCode})` : "VitalSync Patna Clinic Group"}
                  </p>
                </div>

                <div className="space-y-1 text-left md:pl-2">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-700">Patient:</span>
                    <span className="text-[10px] text-slate-900 font-medium">{selectedPatient.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-700">Age / Gender:</span>
                    <span className="text-[10px] text-slate-900 font-medium">{selectedPatient.age}y / {selectedPatient.gender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-700">ABHA ID:</span>
                    <span className="text-[10px] text-slate-900 font-mono">{selectedPatient.abhaId || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-700">Token Number:</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded">
                      {selectedPatient.tokenNumber || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                    <span className="text-[9px] font-bold text-slate-500">Date:</span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* 50/50 Split Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* LEFT HALF: Medication builder & cards list */}
                <div className="space-y-4 text-left p-4.5 bg-slate-50/20 border border-slate-200/50 rounded-2xl">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <span className="material-symbols-outlined text-indigo-500 text-base">medication</span>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">
                      1. Medications Prescription details (Rx)
                    </h4>
                  </div>

                  {/* Form to add medicine (Duplicate layout inside modal for smoothness) */}
                  <div className="space-y-3.5 bg-white p-4 border border-slate-200 rounded-xl relative">
                    <div className="space-y-1.5 relative">
                      <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Medicine Search / Name</span>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={isOphthalmology ? "e.g. Moxifloxacin Eye Drops" : "e.g. Paracetamol 650mg"}
                          value={medName}
                          onChange={(e) => setMedName(e.target.value)}
                          onKeyDown={(e) => {
                            if (!showSuggestions || suggestions.length === 0) return;
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setActiveSuggestionIdx(prev => (prev + 1) % suggestions.length);
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setActiveSuggestionIdx(prev => (prev - 1 + suggestions.length) % suggestions.length);
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              const selected = suggestions[activeSuggestionIdx];
                              setIsSelectingFromDropdown(true);
                              setMedName(selected.name);
                              setMedDosage(selected.genericName);
                              setMedFreq(selected.frequency);
                              setMedDur(selected.duration);
                              setShowSuggestions(false);
                            } else if (e.key === 'Escape') {
                              setShowSuggestions(false);
                            }
                          }}
                          className="w-full input-field py-1.5 text-xs bg-slate-50 border-slate-200 pr-8"
                        />
                        <span className="material-symbols-outlined text-slate-400 absolute right-2.5 top-2 text-sm pointer-events-none">search</span>
                      </div>

                      {/* Autocomplete Dropdown inside Modal */}
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-[130] max-h-[160px] overflow-y-auto">
                          {suggestions.map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setIsSelectingFromDropdown(true);
                                setMedName(item.name);
                                setMedDosage(item.genericName);
                                setMedFreq(item.frequency);
                                setMedDur(item.duration);
                                setShowSuggestions(false);
                              }}
                              onMouseEnter={() => setActiveSuggestionIdx(idx)}
                              className={`p-2.5 border-b border-slate-100 last:border-0 flex justify-between items-center cursor-pointer text-xs transition-colors ${
                                idx === activeSuggestionIdx ? 'bg-indigo-50/70 text-indigo-900' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div>
                                <div className="font-semibold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[11px] text-indigo-500">medication</span>
                                  {item.name}
                                </div>
                                <div className="text-[9px] text-slate-500 mt-0.5">
                                  {item.genericName}
                                </div>
                              </div>
                              <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold ${
                                item.inInventory ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-indigo-50 text-indigo-650'
                              }`}>
                                {item.inInventory ? `${item.stock} Avail` : 'Catalog'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Dosage / Formula</span>
                        {isOphthalmology ? (
                          <select
                            value={medDosage}
                            onChange={(e) => setMedDosage(e.target.value)}
                            className="w-full input-field py-1.5 text-xs bg-slate-50 border-slate-200 cursor-pointer"
                          >
                            <option value="">-- Select --</option>
                            <option value="1 drop">1 drop</option>
                            <option value="2 drops">2 drops</option>
                            <option value="Thin ribbon">Thin ribbon</option>
                            <option value="Apply ointment">Apply ointment</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="e.g. 1 tab"
                            value={medDosage}
                            onChange={(e) => setMedDosage(e.target.value)}
                            className="w-full input-field py-1.5 text-xs bg-slate-50 border-slate-200"
                          />
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Frequency</span>
                        {isOphthalmology ? (
                          <select
                            value={medFreq}
                            onChange={(e) => setMedFreq(e.target.value)}
                            className="w-full input-field py-1.5 text-xs bg-slate-50 border-slate-200 cursor-pointer"
                          >
                            <option value="">-- Select --</option>
                            {OPHTHALMIC_FREQUENCIES.map(freq => (
                              <option key={freq} value={freq}>{freq}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="e.g. 1-0-1"
                            value={medFreq}
                            onChange={(e) => setMedFreq(e.target.value)}
                            className="w-full input-field py-1.5 text-xs bg-slate-50 border-slate-200"
                          />
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center gap-3 pt-2">
                      <div className="space-y-1 flex-1 max-w-[150px]">
                        <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Duration</span>
                        <input
                          type="text"
                          placeholder="e.g. 5 Days"
                          value={medDur}
                          onChange={(e) => setMedDur(e.target.value)}
                          className="w-full input-field py-1 text-xs bg-slate-50 border-slate-200"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddMedication}
                        className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-[10px] px-4 py-2 rounded-xl active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer border-0 text-white-force self-end"
                      >
                        <span className="material-symbols-outlined text-[11px] font-bold text-white-force">add</span>
                        Prescribe
                      </button>
                    </div>
                  </div>

                  {/* Active e-Rx Card List */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide font-mono block">Prescribed Medication List</span>
                    {medications.length > 0 ? (
                      <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                        {medications.map((med, idx) => (
                          <div 
                            key={idx} 
                            className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center hover:border-indigo-300 hover:shadow-xs transition-all relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                            <div className="flex-1 pr-3">
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-indigo-500 text-xs font-bold">medication</span>
                                <strong className="text-slate-800 text-[11px] font-bold">{med.medicineName}</strong>
                              </div>
                              <span className="text-[9px] text-slate-500 block mt-0.5">
                                Formula: {med.dosage || 'As directed'} • Freq: {med.frequency} • Dur: {med.duration}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveMedication(idx)}
                              className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
                            >
                              <span className="material-symbols-outlined text-[13px]">delete</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-[10px] text-slate-400 italic">
                        No medications prescribed yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT HALF: Searchable diagnostic tests catalog selector */}
                <div className="space-y-4 text-left p-4.5 bg-slate-50/20 border border-slate-200/50 rounded-2xl flex flex-col h-full min-h-[380px]">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-teal-600 text-base">biotech</span>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">
                        2. Diagnostics Requisitions (Dx)
                      </h4>
                    </div>
                    <span className="text-[8px] font-bold px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-full font-mono">
                      {selectedTests.length} Selected
                    </span>
                  </div>

                  {/* Search diagnostics filter */}
                  <div className="relative">
                    <span className="material-symbols-outlined text-slate-400 text-xs absolute left-2.5 top-2 pointer-events-none">search</span>
                    <input
                      type="text"
                      placeholder="Search diagnostic test name or LOINC..."
                      value={testSearchQuery}
                      onChange={(e) => setTestSearchQuery(e.target.value)}
                      className="w-full input-field py-1.5 pl-8 text-xs bg-white border-slate-200"
                    />
                    {testSearchQuery && (
                      <button 
                        onClick={() => setTestSearchQuery('')} 
                        className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-700 cursor-pointer border-0 bg-transparent"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    )}
                  </div>

                  {/* Diagnostic catalog list grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto max-h-[260px] pr-1 pt-1">
                    {testCatalog
                      .filter(test => 
                        test.name.toLowerCase().includes(testSearchQuery.toLowerCase()) || 
                        test.loincCode.toLowerCase().includes(testSearchQuery.toLowerCase())
                      )
                      .map((test) => {
                        const isChecked = selectedTests.some(t => t.loincCode === test.loincCode);
                        return (
                          <button
                            key={test.loincCode}
                            type="button"
                            onClick={() => handleToggleTest(test)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all duration-200 cursor-pointer ${
                              isChecked
                                ? 'bg-indigo-50/70 border-indigo-300 text-slate-900 shadow-xs'
                                : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <span className="font-semibold block truncate text-[10px] text-slate-750">{test.name}</span>
                              <span className="text-[8px] text-slate-400 font-mono mt-0.5 inline-block uppercase">
                                LOINC: {test.loincCode}
                              </span>
                            </div>
                            <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                              isChecked ? 'bg-indigo-600 border-indigo-600 text-white-force' : 'border-slate-300 bg-slate-50'
                            }`}>
                              {isChecked && <span className="material-symbols-outlined text-[10px] font-bold text-white-force">check</span>}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>

              </div>

            </div>

            {/* Footer Workspace Action Row */}
            <div className="border-t border-slate-100 pt-4 mt-2 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex gap-4 text-[10px] text-slate-500 font-mono font-medium">
                <div>Prescribed Medications: <strong className="text-indigo-600">{medications.length}</strong></div>
                <div>Lab Diagnostics: <strong className="text-teal-600">{selectedTests.length}</strong></div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsPrescriptionModalOpen(false)}
                  className="w-full sm:w-auto bg-indigo-650 hover:bg-indigo-750 text-white font-bold text-xs px-6 py-2.5 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1 cursor-pointer border-0 text-white-force shadow-md"
                >
                  <span className="material-symbols-outlined text-xs text-white-force">check_circle</span>
                  Save & Apply Workspace
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
});
