import { ClinicalEvidenceService } from './clinicalEvidenceService';
import type { Patient, PatientVitals } from '../types';

export interface ExtractedScribeData {
  rawTranscript: string;
  chiefComplaints: string;
  clinicalAssessment: string;
  extractedVitals: {
    bloodPressure?: string;
    pulseRate?: number;
    temperature?: number;
    spO2?: number;
    bloodSugar?: number;
    weight?: number;
  };
  medications: Array<{
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
    inStock?: boolean;
    matchedStockName?: string;
    matchedStockPrice?: number;
  }>;
  suggestedTests: Array<{
    loincCode: string;
    name: string;
    category: string;
    price?: number;
  }>;
  soapNotes: string;
  languageDetected: string;
}

export class AmbientAudioScribeService {
  private static recognitionInstance: any = null;

  /**
   * Checks if browser supports Speech Recognition
   */
  static isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  /**
   * Starts ambient chamber recording with live Speech Recognition
   */
  static startLiveTranscription(callbacks: {
    onInterimText: (text: string) => void;
    onFinalText: (text: string) => void;
    onError: (err: any) => void;
  }): boolean {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        callbacks.onError(new Error('Speech recognition not supported in this browser.'));
        return false;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Optimized for Indian English, Hindi & Hinglish accents
      recognition.maxAlternatives = 1;

      let accumulatedFinal = '';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            accumulatedFinal += (accumulatedFinal ? ' ' : '') + transcript;
            callbacks.onFinalText(accumulatedFinal);
          } else {
            interimTranscript += transcript;
          }
        }
        if (interimTranscript) {
          callbacks.onInterimText(accumulatedFinal + (accumulatedFinal ? ' ' : '') + interimTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('[AmbientScribe] Speech recognition error:', event.error);
          callbacks.onError(event.error);
        }
      };

      recognition.start();
      this.recognitionInstance = recognition;
      return true;
    } catch (e) {
      console.warn('[AmbientScribe] Failed to start speech recognition:', e);
      callbacks.onError(e);
      return false;
    }
  }

  /**
   * Stops live speech recognition
   */
  static stopLiveTranscription(): void {
    try {
      if (this.recognitionInstance) {
        this.recognitionInstance.stop();
        this.recognitionInstance = null;
      }
    } catch (_e) {
      /* ignore */
    }
  }

  /**
   * Intelligently parses spoken consultation transcript into structured clinical entities
   * Handles English, Hindi, and Hinglish dialogue.
   */
  static async extractClinicalEntities(
    transcript: string,
    options: {
      patient: Patient | null;
      isOphthalmology: boolean;
      existingVitals?: PatientVitals;
    }
  ): Promise<ExtractedScribeData> {
    const text = (transcript || '').trim();
    const lower = text.toLowerCase();

    // 1. Extract Spoken Vitals
    const extractedVitals: ExtractedScribeData['extractedVitals'] = {};

    // BP parsing (e.g., "130/80", "120 over 80", "bp 140 90")
    const bpMatch = text.match(/(?:bp|blood\s*pressure)?\s*(?:is|mila|recorded|check)?\s*(\d{2,3})\s*(?:\/|\s*over\s*|\s*by\s*|\s+)(\d{2,3})/i);
    if (bpMatch) {
      extractedVitals.bloodPressure = `${bpMatch[1]}/${bpMatch[2]}`;
    }

    // Pulse parsing (e.g., "pulse 78", "heart rate 82")
    const pulseMatch = text.match(/(?:pulse|heart\s*rate|hr)\s*(?:is|mila|hai)?\s*(\d{2,3})/i);
    if (pulseMatch) {
      extractedVitals.pulseRate = parseInt(pulseMatch[1], 10);
    }

    // Temperature parsing (e.g., "temp 101.4", "temperature 99", "bukhar 102")
    const tempMatch = text.match(/(?:temp|temperature|fever|bukhar)\s*(?:is|mila|hai)?\s*(\d{2,3}(?:\.\d)?)/i);
    if (tempMatch) {
      extractedVitals.temperature = parseFloat(tempMatch[1]);
    }

    // Blood Sugar parsing (e.g., "sugar 160", "rbs 180", "fasting 140")
    const sugarMatch = text.match(/(?:sugar|glucose|rbs|fbs|ppbs)\s*(?:is|mila|hai)?\s*(\d{2,3})/i);
    if (sugarMatch) {
      extractedVitals.bloodSugar = parseInt(sugarMatch[1], 10);
    }

    // SpO2 parsing (e.g., "spo2 98%", "oxygen 97")
    const spo2Match = text.match(/(?:spo2|oxygen|saturation)\s*(?:is|mila|hai)?\s*(\d{2,3})/i);
    if (spo2Match) {
      extractedVitals.spO2 = parseInt(spo2Match[1], 10);
    }

    // Weight parsing (e.g., "weight 65 kg", "vajan 70")
    const weightMatch = text.match(/(?:weight|vajan|wt)\s*(?:is|mila|hai)?\s*(\d{2,3})/i);
    if (weightMatch) {
      extractedVitals.weight = parseInt(weightMatch[1], 10);
    }

    // 2. Extract Chief Complaints
    const complaintsList: string[] = [];
    if (lower.includes('fever') || lower.includes('bukhar') || lower.includes('taap')) complaintsList.push('Acute Fever');
    if (lower.includes('cough') || lower.includes('khansi') || lower.includes('balgam')) complaintsList.push('Productive Cough');
    if (lower.includes('cold') || lower.includes('sardi') || lower.includes('rhinorrhea') || lower.includes('runny nose')) complaintsList.push('Common Cold / Rhinorrhea');
    if (lower.includes('throat') || lower.includes('gala') || lower.includes('kharash') || lower.includes('pharyngitis')) complaintsList.push('Sore Throat / Pharyngitis');
    if (lower.includes('headache') || lower.includes('sar dard') || lower.includes('cephalgia')) complaintsList.push('Cephalgia / Headache');
    if (lower.includes('body pain') || lower.includes('badan dard') || lower.includes('myalgia') || lower.includes('bodyache')) complaintsList.push('Generalized Body Ache & Myalgia');
    if (lower.includes('vomit') || lower.includes('ulti') || lower.includes('nausea')) complaintsList.push('Nausea & Vomiting');
    if (lower.includes('stomach') || lower.includes('pet dard') || lower.includes('abdominal pain') || lower.includes('cramps')) complaintsList.push('Acute Abdominal Discomfort');
    if (lower.includes('acidity') || lower.includes('gas') || lower.includes('seene me jalan') || lower.includes('heartburn')) complaintsList.push('GERD / Dyspepsia');
    if (lower.includes('loose motion') || lower.includes('dast') || lower.includes('diarrhea')) complaintsList.push('Acute Gastroenteritis / Diarrhea');
    if (lower.includes('breath') || lower.includes('saas') || lower.includes('dyspnea') || lower.includes('wheezing')) complaintsList.push('Shortness of Breath / Wheezing');
    if (lower.includes('joint') || lower.includes('ghutne') || lower.includes('arthritis') || lower.includes('swelling')) complaintsList.push('Joint Pain & Swelling');
    if (lower.includes('urine') || lower.includes('peshab') || lower.includes('burning') || lower.includes('jalan')) complaintsList.push('Dysuria / Burning Micturition');
    if (lower.includes('eye') || lower.includes('aankh') || lower.includes('redness') || lower.includes('itch') || lower.includes('watery')) complaintsList.push('Ocular Irritation / Redness');

    // Duration extraction (e.g., "3 days", "2 hafte se", "since 5 days")
    const durationMatch = text.match(/(?:since|for|se)?\s*(\d+)\s*(?:days?|din|hafta|weeks?|months?)/i);
    const durationSuffix = durationMatch ? ` (Duration: ${durationMatch[0].trim()})` : '';

    const chiefComplaints = complaintsList.length > 0 
      ? complaintsList.join(', ') + durationSuffix 
      : 'Patient presented with clinical symptoms for general evaluation.';

    // 3. Clinical Assessment / Provisional Diagnosis
    let clinicalAssessment = 'Acute Clinical Consultation';
    if (complaintsList.some(c => c.includes('Fever') || c.includes('Cold') || c.includes('Throat'))) {
      clinicalAssessment = 'Acute Upper Respiratory Tract Infection (URI) with Febrile Episode';
    } else if (complaintsList.some(c => c.includes('GERD') || c.includes('Abdominal') || c.includes('Nausea'))) {
      clinicalAssessment = 'Acute Gastroesophageal Reflux & Peptic Dyspepsia';
    } else if (complaintsList.some(c => c.includes('Body Ache') || c.includes('Joint'))) {
      clinicalAssessment = 'Musculoskeletal Strain & Inflammatory Myalgia';
    } else if (complaintsList.some(c => c.includes('Dysuria'))) {
      clinicalAssessment = 'Acute Urinary Tract Infection (Uncomplicated)';
    } else if (complaintsList.some(c => c.includes('Breath') || c.includes('Cough'))) {
      clinicalAssessment = 'Bronchial Airway Hyperreactivity / Acute Bronchitis';
    }

    // 4. Prescribed Medications Extraction & Pharmacy Stock Matching
    const extractedMeds: ExtractedScribeData['medications'] = [];

    // Check against standard clinical protocols
    const allProtocols = ClinicalEvidenceService.getProtocols(options.isOphthalmology);

    // If text mentions fever/URI or paracetamol/dolo
    if (lower.includes('fever') || lower.includes('dolo') || lower.includes('paracetamol') || lower.includes('calpol') || lower.includes('crocin')) {
      const p = allProtocols.find(pr => pr.id === 'fever-uri-pack');
      if (p) {
        p.medications.forEach(m => {
          const match = ClinicalEvidenceService.matchPharmacyStock(m.medicineName, m.dosage);
          extractedMeds.push({
            ...m,
            inStock: match.isInStock,
            matchedStockName: match.matchedItemName,
            matchedStockPrice: match.price
          });
        });
      }
    } else if (lower.includes('diabetes') || lower.includes('sugar') || lower.includes('metformin') || lower.includes('glycomet')) {
      const p = allProtocols.find(pr => pr.id === 't2dm-glycemic-pack');
      if (p) {
        p.medications.forEach(m => {
          const match = ClinicalEvidenceService.matchPharmacyStock(m.medicineName, m.dosage);
          extractedMeds.push({
            ...m,
            inStock: match.isInStock,
            matchedStockName: match.matchedItemName,
            matchedStockPrice: match.price
          });
        });
      }
    } else if (lower.includes('bp') || lower.includes('hypertension') || lower.includes('telmisartan') || lower.includes('telma') || lower.includes('amlodipine')) {
      const p = allProtocols.find(pr => pr.id === 'htn-cardio-pack');
      if (p) {
        p.medications.forEach(m => {
          const match = ClinicalEvidenceService.matchPharmacyStock(m.medicineName, m.dosage);
          extractedMeds.push({
            ...m,
            inStock: match.isInStock,
            matchedStockName: match.matchedItemName,
            matchedStockPrice: match.price
          });
        });
      }
    } else if (lower.includes('acidity') || lower.includes('gas') || lower.includes('pantop') || lower.includes('pan 40') || lower.includes('pantocid')) {
      const p = allProtocols.find(pr => pr.id === 'gerd-peptic-pack');
      if (p) {
        p.medications.forEach(m => {
          const match = ClinicalEvidenceService.matchPharmacyStock(m.medicineName, m.dosage);
          extractedMeds.push({
            ...m,
            inStock: match.isInStock,
            matchedStockName: match.matchedItemName,
            matchedStockPrice: match.price
          });
        });
      }
    } else if (lower.includes('pain') || lower.includes('spasm') || lower.includes('dard') || lower.includes('thiocolchicoside')) {
      const p = allProtocols.find(pr => pr.id === 'musculoskeletal-pain-pack');
      if (p) {
        p.medications.forEach(m => {
          const match = ClinicalEvidenceService.matchPharmacyStock(m.medicineName, m.dosage);
          extractedMeds.push({
            ...m,
            inStock: match.isInStock,
            matchedStockName: match.matchedItemName,
            matchedStockPrice: match.price
          });
        });
      }
    } else {
      // General baseline prescription
      const p = allProtocols[0];
      if (p) {
        p.medications.slice(0, 3).forEach(m => {
          const match = ClinicalEvidenceService.matchPharmacyStock(m.medicineName, m.dosage);
          extractedMeds.push({
            ...m,
            inStock: match.isInStock,
            matchedStockName: match.matchedItemName,
            matchedStockPrice: match.price
          });
        });
      }
    }

    // 5. Advised Diagnostic Tests Extraction
    const suggestedTests: ExtractedScribeData['suggestedTests'] = [];
    if (lower.includes('cbc') || lower.includes('blood count') || lower.includes('hemoglobin') || lower.includes('fever') || lower.includes('infection')) {
      suggestedTests.push({ loincCode: '6690-2', name: 'Complete Blood Count (CBC with ESR)', category: 'Hematology', price: 350 });
    }
    if (lower.includes('widal') || lower.includes('typhoid') || lower.includes('typhidot')) {
      suggestedTests.push({ loincCode: '24357-6', name: 'Widal Agglutination Slide Test (Typhoid)', category: 'Serology', price: 200 });
    }
    if (lower.includes('sugar') || lower.includes('diabetes') || lower.includes('hba1c')) {
      suggestedTests.push({ loincCode: '4544-3', name: 'HbA1c (Glycated Hemoglobin HPLC)', category: 'Biochemistry', price: 500 });
      suggestedTests.push({ loincCode: '2160-0', name: 'Serum Creatinine & eGFR (CKD-EPI)', category: 'Biochemistry', price: 250 });
    }
    if (lower.includes('lipid') || lower.includes('cholesterol') || lower.includes('heart')) {
      suggestedTests.push({ loincCode: '2093-3', name: 'Lipid Profile Comprehensive (Lipid Panel)', category: 'Biochemistry', price: 650 });
    }
    if (lower.includes('urine') || lower.includes('peshab') || lower.includes('infection')) {
      suggestedTests.push({ loincCode: '24357-6', name: 'Urine Routine & Microscopic Examination', category: 'Pathology', price: 150 });
    }

    // 6. Formulate Structured SOAP Notes
    const soapNotes = `CHIEF COMPLAINTS:
${chiefComplaints}

CLINICAL ASSESSMENT & DIAGNOSIS:
${clinicalAssessment}

SPOKEN CLINICAL TRANSCRIPT:
"${text || 'Spoken consultation recorded in chamber.'}"

ADVICE & DIRECTIONS:
- Take prescribed medications as directed with meals.
- Maintain adequate hydration and rest.
- Review in OPD after 5-7 days or earlier if red flag symptoms develop.`;

    return {
      rawTranscript: text,
      chiefComplaints,
      clinicalAssessment,
      extractedVitals,
      medications: extractedMeds,
      suggestedTests,
      soapNotes,
      languageDetected: lower.includes('hai') || lower.includes('se') || lower.includes('ko') ? 'Hinglish / Hindi' : 'English'
    };
  }
}
