/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  🧠 J.A.R.V.I.S. MILITARY-GRADE AMBIENT CLINICAL SCRIBE SERVICE          ║
 * ║  Phase 22: Hands-Free Realtime Clinical Speech-to-SOAP Architecture       ║
 * ║  Supports: English, Hindi, Hinglish + Indian Clinical Chamber Speech      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { ClinicalEvidenceService } from './clinicalEvidenceService';
import { PharmacyService } from './pharmacyService';
import { supabase } from '../lib/supabaseClient';
import { getPodContext, FALLBACK_POD_ID, FALLBACK_DOCTOR_ID } from './podContext';
import type { 
  Patient, 
  PatientVitals, 
  ExtractedScribeData, 
  SoapRecord, 
  ScribeMedication,
  AmbientAudioRecordingState 
} from '../types';

export type { ExtractedScribeData, SoapRecord, ScribeMedication, AmbientAudioRecordingState };

export class AmbientAudioScribeService {
  private static recognitionInstance: any = null;
  private static isListeningActive: boolean = false;
  private static mediaRecorderInstance: MediaRecorder | null = null;
  private static audioChunks: Blob[] = [];
  private static mediaStreamInstance: MediaStream | null = null;
  private static audioStartTime: number = 0;

  /**
   * Checks if browser supports Speech Recognition
   */
  static isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  /**
   * Checks if MediaRecorder Web API is supported for audio recording fallback
   */
  static isMediaRecorderSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined');
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
        callbacks.onError(new Error('Speech recognition not supported in this browser. MediaRecorder fallback available.'));
        return false;
      }

      if (this.recognitionInstance) {
        try { this.recognitionInstance.stop(); } catch (_e) { /* ignore */ }
      }

      this.isListeningActive = true;
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
          console.warn('[AmbientScribe] Speech recognition notice:', event.error);
          callbacks.onError(event.error);
        }
      };

      recognition.onend = () => {
        // Auto-reconnect if browser speech recognition times out due to temporary silence
        if (this.isListeningActive) {
          try {
            recognition.start();
          } catch (_e) {
            /* ignore restart collision */
          }
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
      this.isListeningActive = false;
      if (this.recognitionInstance) {
        this.recognitionInstance.stop();
        this.recognitionInstance = null;
      }
    } catch (_e) {
      /* ignore */
    }
  }

  /**
   * Fallback Audio Recording: Captures raw audio stream via MediaRecorder Web API
   */
  static async startAudioRecording(): Promise<boolean> {
    if (!this.isMediaRecorderSupported()) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStreamInstance = stream;
      this.audioChunks = [];
      this.audioStartTime = Date.now();

      const options = MediaRecorder.isTypeSupported('audio/webm') 
        ? { mimeType: 'audio/webm' } 
        : undefined;

      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      recorder.start(1000); // 1-second chunks
      this.mediaRecorderInstance = recorder;
      return true;
    } catch (err) {
      console.warn('[AmbientScribe] MediaRecorder mic permission or init notice:', err);
      return false;
    }
  }

  /**
   * Stops audio buffer recording and returns composite audio Blob
   */
  static async stopAudioRecording(): Promise<{ blob: Blob | null; durationSeconds: number }> {
    const durationSeconds = this.audioStartTime > 0 
      ? Math.round((Date.now() - this.audioStartTime) / 1000) 
      : 0;

    return new Promise((resolve) => {
      if (!this.mediaRecorderInstance) {
        resolve({ blob: null, durationSeconds });
        return;
      }

      this.mediaRecorderInstance.onstop = () => {
        const mimeType = this.mediaRecorderInstance?.mimeType || 'audio/webm';
        const compositeBlob = new Blob(this.audioChunks, { type: mimeType });
        this.audioChunks = [];
        this.mediaRecorderInstance = null;

        if (this.mediaStreamInstance) {
          this.mediaStreamInstance.getTracks().forEach(track => track.stop());
          this.mediaStreamInstance = null;
        }
        resolve({ blob: compositeBlob, durationSeconds });
      };

      try {
        this.mediaRecorderInstance.stop();
      } catch (_e) {
        resolve({ blob: null, durationSeconds });
      }
    });
  }

  /**
   * Spoken Indian Dosage Parser: Maps colloquial dialogue to canonical frequencies & timings
   */
  static parseSpokenDosage(text: string): { frequency: string; duration: string; instructions: string } {
    const lower = (text || '').toLowerCase();

    // 1. Frequency resolution
    let frequency = '1-0-1';
    if (lower.includes('subah sham') || lower.includes('subah shaam') || lower.includes('twice daily') || lower.includes('bd') || lower.includes('do baar') || lower.includes('2 baar')) {
      frequency = '1-0-1';
    } else if (lower.includes('teen baar') || lower.includes('3 baar') || lower.includes('thrice daily') || lower.includes('tds') || lower.includes('din me 3')) {
      frequency = '1-1-1';
    } else if (lower.includes('din me ek baar') || lower.includes('once daily') || lower.includes('od') || lower.includes('ek baar') || lower.includes('subah khali')) {
      frequency = '1-0-0';
    } else if (lower.includes('raat ko') || lower.includes('sone se pehle') || lower.includes('bedtime') || lower.includes('hs') || lower.includes('night')) {
      frequency = '0-0-1';
    } else if (lower.includes('dard hone pe') || lower.includes('zaroorat padne') || lower.includes('sos') || lower.includes('prn')) {
      frequency = 'SOS';
    }

    // 2. Instructions / Timing
    let instructions = 'After meals';
    if (lower.includes('khali pet') || lower.includes('empty stomach') || lower.includes('nahaar munh') || lower.includes('before food') || lower.includes('before meals')) {
      instructions = 'Empty stomach (Before meals)';
    } else if (lower.includes('sone se pehle') || lower.includes('at bedtime')) {
      instructions = 'At bedtime';
    } else if (lower.includes('dudh ke sath') || lower.includes('with milk')) {
      instructions = 'With warm milk';
    }

    // 3. Duration
    let duration = '5 Days';
    const durMatch = lower.match(/(\d+)\s*(?:days?|din|hafta|hafte|weeks?|mahine|months?)/i);
    if (durMatch) {
      const num = parseInt(durMatch[1], 10);
      if (durMatch[0].includes('hafta') || durMatch[0].includes('week')) {
        duration = `${num * 7} Days`;
      } else if (durMatch[0].includes('mahine') || durMatch[0].includes('month')) {
        duration = `${num * 30} Days`;
      } else {
        duration = `${num} Days`;
      }
    } else if (lower.includes('1 week') || lower.includes('ek hafta')) {
      duration = '7 Days';
    } else if (lower.includes('2 weeks') || lower.includes('do hafte')) {
      duration = '14 Days';
    } else if (lower.includes('1 month') || lower.includes('ek mahina')) {
      duration = '30 Days';
    }

    return { frequency, duration, instructions };
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
      audioDurationSeconds?: number;
    }
  ): Promise<ExtractedScribeData> {
    const text = (transcript || '').trim();
    const lower = text.toLowerCase();

    // 1. Extract Spoken Vitals
    const extractedVitals: ExtractedScribeData['extractedVitals'] = {};

    // BP parsing (e.g., "130/80", "120 over 80", "bp 140 90", "130 by 85")
    const bpMatch = text.match(/(?:bp|blood\s*pressure)?\s*(?:is|mila|recorded|check)?\s*(\d{2,3})\s*(?:\/|\s*over\s*|\s*by\s*|\s+)(\d{2,3})/i);
    if (bpMatch) {
      extractedVitals.bloodPressure = `${bpMatch[1]}/${bpMatch[2]}`;
    }

    // Pulse parsing (e.g., "pulse 78", "heart rate 82", "hr 76")
    const pulseMatch = text.match(/(?:pulse|heart\s*rate|hr)\s*(?:is|mila|hai)?\s*(\d{2,3})/i);
    if (pulseMatch) {
      extractedVitals.pulseRate = parseInt(pulseMatch[1], 10);
    }

    // Temperature parsing (e.g., "temp 101.4", "temperature 99.2", "bukhar 102")
    const tempMatch = text.match(/(?:temp|temperature|fever|bukhar)\s*(?:is|mila|hai)?\s*(\d{2,3}(?:\.\d)?)/i);
    if (tempMatch) {
      extractedVitals.temperature = parseFloat(tempMatch[1]);
    }

    // Blood Sugar parsing (e.g., "sugar 160", "rbs 180", "fbs 110", "ppbs 190")
    const sugarMatch = text.match(/(?:sugar|glucose|rbs|fbs|ppbs)\s*(?:is|mila|hai)?\s*(\d{2,3})/i);
    if (sugarMatch) {
      extractedVitals.bloodSugar = parseInt(sugarMatch[1], 10);
    }

    // SpO2 parsing (e.g., "spo2 98%", "oxygen 97")
    const spo2Match = text.match(/(?:spo2|oxygen|saturation)\s*(?:is|mila|hai)?\s*(\d{2,3})/i);
    if (spo2Match) {
      extractedVitals.spO2 = parseInt(spo2Match[1], 10);
    }

    // Weight parsing (e.g., "weight 65 kg", "vajan 70", "wt 68")
    const weightMatch = text.match(/(?:weight|vajan|wt)\s*(?:is|mila|hai)?\s*(\d{2,3})/i);
    if (weightMatch) {
      extractedVitals.weight = parseInt(weightMatch[1], 10);
    }

    // 2. Comprehensive Indian Clinical Symptom Dictionary (Colloquial Hinglish -> SNOMED/ICD)
    const complaintsList: string[] = [];
    if (lower.includes('fever') || lower.includes('bukhar') || lower.includes('taap') || lower.includes('chills') || lower.includes('thand')) {
      complaintsList.push('Acute High-Grade Fever / Febrile Episode');
    }
    if (lower.includes('cough') || lower.includes('khansi') || lower.includes('balgam') || lower.includes('dhaska')) {
      complaintsList.push('Productive / Spasmodic Cough');
    }
    if (lower.includes('cold') || lower.includes('sardi') || lower.includes('rhinorrhea') || lower.includes('runny nose') || lower.includes('naak behna') || lower.includes('cheenk')) {
      complaintsList.push('Common Cold & Upper Airway Rhinorrhea');
    }
    if (lower.includes('throat') || lower.includes('gala') || lower.includes('kharash') || lower.includes('pharyngitis') || lower.includes('nigalne')) {
      complaintsList.push('Sore Throat & Acute Pharyngitis');
    }
    if (lower.includes('headache') || lower.includes('sar dard') || lower.includes('sir dard') || lower.includes('cephalgia') || lower.includes('aadha sar')) {
      complaintsList.push('Cephalgia / Acute Tension Headache');
    }
    if (lower.includes('chakkar') || lower.includes('dizziness') || lower.includes('vertigo') || lower.includes('sir ghumna')) {
      complaintsList.push('Vestibular Vertigo / Benign Giddiness');
    }
    if (lower.includes('body pain') || lower.includes('badan dard') || lower.includes('myalgia') || lower.includes('bodyache') || lower.includes('hath pair dard') || lower.includes('kamzori')) {
      complaintsList.push('Generalized Myalgia & Physical Asthenia');
    }
    if (lower.includes('vomit') || lower.includes('ulti') || lower.includes('nausea') || lower.includes('jee machlana')) {
      complaintsList.push('Nausea & Recurrent Emesis');
    }
    if (lower.includes('stomach') || lower.includes('pet dard') || lower.includes('abdominal') || lower.includes('marod') || lower.includes('pet me aithan') || lower.includes('cramps')) {
      complaintsList.push('Acute Abdominal Spasm / Colic');
    }
    if (lower.includes('acidity') || lower.includes('gas') || lower.includes('seene me jalan') || lower.includes('heartburn') || lower.includes('khatti dakar') || lower.includes('dyspepsia')) {
      complaintsList.push('GERD / Hyperacidity Syndrome');
    }
    if (lower.includes('loose motion') || lower.includes('dast') || lower.includes('diarrhea') || lower.includes('pet kharab')) {
      complaintsList.push('Acute Gastroenteritis / Diarrhea');
    }
    if (lower.includes('breath') || lower.includes('saas') || lower.includes('dyspnea') || lower.includes('wheezing') || lower.includes('dum ghutna')) {
      complaintsList.push('Exertional Dyspnea / Wheezing');
    }
    if (lower.includes('joint') || lower.includes('ghutne') || lower.includes('arthritis') || lower.includes('kamar dard') || lower.includes('back pain') || lower.includes('sandhi')) {
      complaintsList.push('Lumbago & Degenerative Arthralgia');
    }
    if (lower.includes('urine') || lower.includes('peshab') || lower.includes('burning') || lower.includes('jalan') || lower.includes('baar baar')) {
      complaintsList.push('Dysuria / Burning Micturition (Suspected UTI)');
    }
    if (lower.includes('khujli') || lower.includes('itching') || lower.includes('rash') || lower.includes('daane') || lower.includes('allergy')) {
      complaintsList.push('Pruritic Dermatitis & Cutaneous Allergy');
    }
    if (lower.includes('eye') || lower.includes('aankh') || lower.includes('redness') || lower.includes('watery')) {
      complaintsList.push('Ocular Irritation / Conjunctival Redness');
    }

    // Duration extraction (e.g., "3 days", "2 hafte se", "since 5 days", "kal raat se")
    const durationMatch = text.match(/(?:since|for|se)?\s*(\d+)\s*(?:days?|din|hafta|hafte|weeks?|months?)/i);
    const durationSuffix = durationMatch ? ` (Onset: ${durationMatch[0].trim()})` : '';

    const chiefComplaints = complaintsList.length > 0 
      ? complaintsList.join(', ') + durationSuffix 
      : 'Patient presented with clinical symptoms for general evaluation.';

    // 3. Clinical Assessment & ICD-10 Codification Suggestions
    let clinicalAssessment = 'Acute Clinical Consultation';
    const icd10Suggestions: string[] = [];

    if (complaintsList.some(c => c.includes('Fever') || c.includes('Throat') || c.includes('Rhinorrhea'))) {
      clinicalAssessment = 'Acute Upper Respiratory Tract Infection (URI) with Febrile Episode';
      icd10Suggestions.push('J06.9 (Acute Upper Respiratory Infection)', 'R50.9 (Fever, Unspecified)');
    } else if (complaintsList.some(c => c.includes('GERD') || c.includes('Abdominal') || c.includes('Emesis'))) {
      clinicalAssessment = 'Acute Gastroesophageal Reflux & Peptic Dyspepsia';
      icd10Suggestions.push('K21.9 (GERD without Esophagitis)', 'K30 (Functional Dyspepsia)');
    } else if (complaintsList.some(c => c.includes('Gastroenteritis'))) {
      clinicalAssessment = 'Acute Infectious Gastroenteritis & Enteric Spasm';
      icd10Suggestions.push('A09 (Infectious Gastroenteritis and Colitis)');
    } else if (complaintsList.some(c => c.includes('Vertigo'))) {
      clinicalAssessment = 'Peripheral Vestibular Vertigo / Benign Positional Vertigo';
      icd10Suggestions.push('H81.1 (Benign Paroxysmal Positional Vertigo)');
    } else if (complaintsList.some(c => c.includes('Myalgia') || c.includes('Lumbago'))) {
      clinicalAssessment = 'Musculoskeletal Strain & Inflammatory Myalgia';
      icd10Suggestions.push('M54.5 (Low Back Pain / Lumbago)', 'M79.1 (Myalgia)');
    } else if (complaintsList.some(c => c.includes('Dysuria'))) {
      clinicalAssessment = 'Acute Urinary Tract Infection (Uncomplicated)';
      icd10Suggestions.push('N39.0 (Urinary Tract Infection, Unspecified)');
    } else if (complaintsList.some(c => c.includes('Dyspnea') || c.includes('Cough'))) {
      clinicalAssessment = 'Bronchial Airway Hyperreactivity / Acute Bronchitis';
      icd10Suggestions.push('J20.9 (Acute Bronchitis, Unspecified)', 'J45.9 (Asthma, Unspecified)');
    }

    // 4. Prescribed Medications Extraction & Pharmacy Stock Matching
    const extractedMeds: ExtractedScribeData['medications'] = [];

    // Master list of Indian Brand and Generic Medicines for extraction
    const DRUG_CANDIDATES = [
      { trigger: 'dolo 650', name: 'Dolo 650mg Tablet', dosage: '650mg' },
      { trigger: 'dolo', name: 'Dolo 650mg Tablet', dosage: '650mg' },
      { trigger: 'paracetamol', name: 'Paracetamol 650mg Tablet', dosage: '650mg' },
      { trigger: 'crocin', name: 'Crocin 650mg Tablet', dosage: '650mg' },
      { trigger: 'calpol', name: 'Calpol 650mg Tablet', dosage: '650mg' },
      { trigger: 'azithromycin 500', name: 'Azithromycin 500mg Tablet', dosage: '500mg' },
      { trigger: 'azithromycin', name: 'Azithromycin 500mg Tablet', dosage: '500mg' },
      { trigger: 'augmentin 625', name: 'Augmentin 625 Duo Tablet', dosage: '625mg' },
      { trigger: 'augmentin', name: 'Augmentin 625 Duo Tablet', dosage: '625mg' },
      { trigger: 'amoxiclav', name: 'Amoxyclav 625mg Tablet', dosage: '625mg' },
      { trigger: 'pantocid 40', name: 'Pantocid 40mg Tablet', dosage: '40mg' },
      { trigger: 'pantocid', name: 'Pantocid 40mg Tablet', dosage: '40mg' },
      { trigger: 'pan 40', name: 'Pan 40mg Tablet', dosage: '40mg' },
      { trigger: 'pan-d', name: 'Pan-D Capsule', dosage: '40mg/30mg' },
      { trigger: 'pantop', name: 'Pantop 40mg Tablet', dosage: '40mg' },
      { trigger: 'omez 20', name: 'Omez 20mg Capsule', dosage: '20mg' },
      { trigger: 'omez', name: 'Omez 20mg Capsule', dosage: '20mg' },
      { trigger: 'telma 40', name: 'Telma 40mg Tablet', dosage: '40mg' },
      { trigger: 'telma', name: 'Telma 40mg Tablet', dosage: '40mg' },
      { trigger: 'telmisartan', name: 'Telmisartan 40mg Tablet', dosage: '40mg' },
      { trigger: 'amlong 5', name: 'Amlong 5mg Tablet', dosage: '5mg' },
      { trigger: 'amlong', name: 'Amlong 5mg Tablet', dosage: '5mg' },
      { trigger: 'amlodipine', name: 'Amlodipine 5mg Tablet', dosage: '5mg' },
      { trigger: 'glycomet gp2', name: 'Glycomet-GP 2 Tablet', dosage: '500mg/2mg' },
      { trigger: 'glycomet', name: 'Glycomet 500mg Tablet', dosage: '500mg' },
      { trigger: 'metformin 500', name: 'Metformin 500mg Tablet', dosage: '500mg' },
      { trigger: 'metformin', name: 'Metformin 500mg Tablet', dosage: '500mg' },
      { trigger: 'montair lc', name: 'Montair-LC Tablet', dosage: '10mg/5mg' },
      { trigger: 'montair', name: 'Montair-LC Tablet', dosage: '10mg/5mg' },
      { trigger: 'cetirizine', name: 'Cetirizine 10mg Tablet', dosage: '10mg' },
      { trigger: 'cetzine', name: 'Cetzine 10mg Tablet', dosage: '10mg' },
      { trigger: 'allegra 120', name: 'Allegra 120mg Tablet', dosage: '120mg' },
      { trigger: 'allegra', name: 'Allegra 120mg Tablet', dosage: '120mg' },
      { trigger: 'combiflam', name: 'Combiflam Tablet', dosage: '400mg/325mg' },
      { trigger: 'voveran', name: 'Voveran 50mg Tablet', dosage: '50mg' },
      { trigger: 'zerodol sp', name: 'Zerodol-SP Tablet', dosage: '100mg/325mg/15mg' },
      { trigger: 'zerodol', name: 'Zerodol 100mg Tablet', dosage: '100mg' },
      { trigger: 'ecosprin 75', name: 'Ecosprin 75mg Tablet', dosage: '75mg' },
      { trigger: 'ecosprin', name: 'Ecosprin 75mg Tablet', dosage: '75mg' },
      { trigger: 'atorva 10', name: 'Atorva 10mg Tablet', dosage: '10mg' },
      { trigger: 'atorva', name: 'Atorva 10mg Tablet', dosage: '10mg' },
      { trigger: 'thyronorm 50', name: 'Thyronorm 50mcg Tablet', dosage: '50mcg' },
      { trigger: 'thyronorm', name: 'Thyronorm 50mcg Tablet', dosage: '50mcg' },
      { trigger: 'ascoril', name: 'Ascoril-D Cough Syrup', dosage: '100ml' },
      { trigger: 'oflox oz', name: 'Oflox-OZ Tablet', dosage: '200mg/500mg' }
    ];

    const seenDrugs = new Set<string>();
    const inventory = PharmacyService.getPharmacyInventory();

    // Check direct mentions in speech
    for (const cand of DRUG_CANDIDATES) {
      if (lower.includes(cand.trigger) && !seenDrugs.has(cand.name)) {
        seenDrugs.add(cand.name);
        const dosageInfo = this.parseSpokenDosage(text);

        // Ground against active clinic stock
        const stockMatch = ClinicalEvidenceService.matchPharmacyStock(cand.name, cand.dosage);

        extractedMeds.push({
          medicineName: cand.name,
          dosage: cand.dosage,
          frequency: dosageInfo.frequency,
          duration: dosageInfo.duration,
          instructions: dosageInfo.instructions,
          inStock: stockMatch.isInStock,
          matchedStockName: stockMatch.matchedItemName || cand.name,
          matchedStockPrice: stockMatch.price || 50
        });
      }
    }

    // If no specific drug was directly mentioned, fallback to evidence-based packs
    if (extractedMeds.length === 0) {
      const allProtocols = ClinicalEvidenceService.getProtocols(options.isOphthalmology);
      let targetProtocol = allProtocols[0]; // General baseline

      if (lower.includes('fever') || lower.includes('bukhar') || lower.includes('uri')) {
        targetProtocol = allProtocols.find(pr => pr.id === 'fever-uri-pack') || targetProtocol;
      } else if (lower.includes('diabetes') || lower.includes('sugar')) {
        targetProtocol = allProtocols.find(pr => pr.id === 't2dm-glycemic-pack') || targetProtocol;
      } else if (lower.includes('bp') || lower.includes('hypertension')) {
        targetProtocol = allProtocols.find(pr => pr.id === 'htn-cardio-pack') || targetProtocol;
      } else if (lower.includes('acidity') || lower.includes('gas') || lower.includes('gerd')) {
        targetProtocol = allProtocols.find(pr => pr.id === 'gerd-peptic-pack') || targetProtocol;
      } else if (lower.includes('pain') || lower.includes('dard') || lower.includes('spasm')) {
        targetProtocol = allProtocols.find(pr => pr.id === 'musculoskeletal-pain-pack') || targetProtocol;
      }

      if (targetProtocol) {
        targetProtocol.medications.slice(0, 3).forEach(m => {
          const match = ClinicalEvidenceService.matchPharmacyStock(m.medicineName, m.dosage);
          extractedMeds.push({
            medicineName: m.medicineName,
            dosage: m.dosage,
            frequency: m.frequency,
            duration: m.duration,
            instructions: m.instructions,
            inStock: match.isInStock,
            matchedStockName: match.matchedItemName,
            matchedStockPrice: match.price
          });
        });
      }
    }

    // 5. Advised Diagnostic Tests Extraction (Deterministic LOINC resolver)
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
    if (lower.includes('lipid') || lower.includes('cholesterol') || lower.includes('heart') || lower.includes('chhati')) {
      suggestedTests.push({ loincCode: '2093-3', name: 'Lipid Profile Comprehensive (Lipid Panel)', category: 'Biochemistry', price: 650 });
    }
    if (lower.includes('urine') || lower.includes('peshab') || lower.includes('infection') || lower.includes('uti')) {
      suggestedTests.push({ loincCode: '24357-6', name: 'Urine Routine & Microscopic Examination', category: 'Pathology', price: 150 });
    }
    if (lower.includes('lft') || lower.includes('liver') || lower.includes('jaundice') || lower.includes('piliya')) {
      suggestedTests.push({ loincCode: '24325-3', name: 'Liver Function Test Comprehensive (LFT)', category: 'Biochemistry', price: 600 });
    }

    // 6. Formulate Standardized 4-Pillar SOAP Note
    const vitalsFormatted = [
      extractedVitals.bloodPressure ? `BP: ${extractedVitals.bloodPressure} mmHg` : '',
      extractedVitals.pulseRate ? `PR: ${extractedVitals.pulseRate} bpm` : '',
      extractedVitals.temperature ? `Temp: ${extractedVitals.temperature} °F` : '',
      extractedVitals.spO2 ? `SpO2: ${extractedVitals.spO2}%` : '',
      extractedVitals.bloodSugar ? `RBS: ${extractedVitals.bloodSugar} mg/dL` : '',
      extractedVitals.weight ? `Weight: ${extractedVitals.weight} kg` : ''
    ].filter(Boolean).join(' | ') || 'Vitals stable on physical assessment.';

    const medsFormatted = extractedMeds.map(m => 
      `• ${m.medicineName} (${m.dosage}) - ${m.frequency} x ${m.duration} [${m.instructions}]`
    ).join('\n') || '• Symptomatic therapy as advised.';

    const testsFormatted = suggestedTests.map(t => 
      `• ${t.name} (LOINC: ${t.loincCode})`
    ).join('\n') || 'None required currently.';

    const soapRecord: SoapRecord = {
      subjective: `Chief Complaints: ${chiefComplaints}\nNarrative: Patient presented for clinical chamber evaluation.`,
      objective: `Physiological Vitals: ${vitalsFormatted}\nExamination: General condition fair, alert and oriented.`,
      assessment: `Provisional Diagnosis: ${clinicalAssessment}\nICD-10 Suggestions: ${icd10Suggestions.join(', ') || 'R69 (Illness, unspecified)'}`,
      plan: `Pharmacotherapy:\n${medsFormatted}\n\nInvestigations:\n${testsFormatted}\n\nAdvice: Adequate rest, oral hydration, review in OPD after 5 days.`,
      icd10Suggestions,
      fullFormattedText: `[SUBJECTIVE]
Chief Complaints: ${chiefComplaints}

[OBJECTIVE]
Vitals: ${vitalsFormatted}

[ASSESSMENT]
Provisional Diagnosis: ${clinicalAssessment} (${icd10Suggestions.join(', ') || 'Clinical Evaluation'})

[PLAN]
Prescriptions:
${medsFormatted}

Investigations Advised:
${testsFormatted}

Directions: Take prescribed medications with meals. Return for review in 5-7 days.`
    };

    const isHinglish = lower.includes('hai') || lower.includes('se') || lower.includes('ko') || lower.includes('ka') || lower.includes('dard') || lower.includes('bukhar');

    return {
      rawTranscript: text,
      chiefComplaints,
      clinicalAssessment,
      extractedVitals,
      medications: extractedMeds,
      suggestedTests,
      soapNotes: soapRecord.fullFormattedText,
      soapRecord,
      languageDetected: isHinglish ? 'Hinglish / Hindi' : 'English',
      audioDurationSeconds: options.audioDurationSeconds || 0
    };
  }

  /**
   * Persists Ambient Scribe Session into Supabase Postgres & Local Audit
   */
  static async saveScribeSession(data: {
    patientId: string;
    transcript: string;
    soapRecord: SoapRecord;
    extractedEntities: any;
    durationSeconds?: number;
    language?: string;
    encounterId?: string;
  }): Promise<string | null> {
    const ctx = getPodContext();
    const sessionId = crypto.randomUUID();
    const podId = ctx.podId || FALLBACK_POD_ID;
    const doctorId = ctx.doctorId || FALLBACK_DOCTOR_ID;

    try {
      await supabase.from('ambient_scribe_sessions').insert({
        id: sessionId,
        pod_id: podId,
        patient_id: data.patientId,
        doctor_id: doctorId,
        encounter_id: data.encounterId || null,
        transcript: data.transcript,
        soap_data: data.soapRecord,
        extracted_entities: data.extractedEntities || {},
        audio_duration_seconds: data.durationSeconds || 0,
        language_detected: data.language || 'Hinglish'
      });
      return sessionId;
    } catch (err) {
      console.warn('[AmbientScribe] Remote session save note (retained locally):', err);
      try {
        const key = 'vitalsync_ambient_sessions';
        const raw = localStorage.getItem(key);
        const list = raw ? JSON.parse(raw) : [];
        list.push({ id: sessionId, ...data, podId, createdAt: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(list.slice(-50)));
      } catch (_e) { /* ignore */ }
      return sessionId;
    }
  }
}
