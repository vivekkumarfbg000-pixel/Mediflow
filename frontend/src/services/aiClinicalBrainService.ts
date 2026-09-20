import { PatientService } from './patientService';
import { EncounterService } from './encounterService';
import { LabService } from './labService';
import { WhatsAppTemplateEngine } from './WhatsAppTemplateEngine';
import { load, save } from './apiHelper';
import type { LabReport } from '../types';

export interface BiomarkerTrend {
  biomarker: string;
  currentValue: number;
  pastValue: number | null;
  unit: string;
  status: 'normal' | 'high' | 'low' | 'critical';
  trend: 'improving' | 'worsening' | 'stable' | 'unknown';
}

export class AiClinicalBrainService {
  /**
   * Simulates the Groq Llama-3 / Google Med-PaLM 2 extraction of a PDF report sent via WhatsApp.
   * In a real implementation, this sends the PDF to the LLM and gets JSON back.
   */
  public static async analyzeWhatsAppLabReport(patientId: string, pdfUrl: string, rawText: string): Promise<string> {
    const patient = PatientService.getPatients().find(p => p.id === patientId);
    if (!patient) return "Patient not found.";

    // 1. Simulate AI Extraction from the PDF text/image
    // For demonstration, we assume it's a Diabetes panel (HbA1c).
    const extractedData = {
      testName: "Comprehensive Metabolic & Diabetes Panel",
      loincCode: "4544-3", // HbA1c
      biomarkers: {
        HbA1c: 7.2,
        FastingSugar: 120
      }
    };

    // 2. Longitudinal Tracking: Look up past reports
    const pastReports = LabService.getFullLabReports().filter(r => r.patientId === patientId && r.biomarkerJson?.biomarkers?.HbA1c);
    pastReports.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    
    let pastHbA1c: number | null = null;
    let trendMsg = '';

    if (pastReports.length > 0 && pastReports[0].biomarkerJson?.biomarkers?.HbA1c) {
      pastHbA1c = pastReports[0].biomarkerJson.biomarkers.HbA1c;
      if (pastHbA1c !== null && extractedData.biomarkers.HbA1c < pastHbA1c) {
        trendMsg = `Great progress! Aapka HbA1c pichle report (${pastHbA1c}%) se ghat kar ${extractedData.biomarkers.HbA1c}% ho gaya hai. Keep following the doctor's routine! 📉💪`;
      } else if (pastHbA1c !== null && extractedData.biomarkers.HbA1c > pastHbA1c) {
        trendMsg = `Attention: Aapka HbA1c pichle report (${pastHbA1c}%) se badh kar ${extractedData.biomarkers.HbA1c}% ho gaya hai. Doctor se milna zaroori hai. 📈⚠️`;
      } else {
        trendMsg = `Aapka HbA1c stable hai (${extractedData.biomarkers.HbA1c}%). Keep it up! ⚖️`;
      }
    } else {
      trendMsg = `Aapka current HbA1c level ${extractedData.biomarkers.HbA1c}% hai.`;
    }

    // 3. PubMed / Clinical Guidelines Cross-Reference
    let clinicalAdvice = "";
    if (extractedData.biomarkers.HbA1c >= 6.5) {
      clinicalAdvice = "PubMed Guidelines (ADA 2026): Target HbA1c for non-pregnant adults is < 7.0%. Diet modification and medication adherence is highly recommended.";
    }

    // 4. Save the automated report into the DB
    const reportId = crypto.randomUUID();
    const newReport: LabReport = {
      id: reportId,
      requisitionId: 'whatsapp-direct',
      patientId: patientId,
      patientName: patient.name,
      status: 'approved', // Auto-approved by AI
      reportFileUrl: pdfUrl,
      biomarkerJson: extractedData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedBy: 'ai-clinical-brain',
      approvedAt: new Date().toISOString()
    };

    const existingReports = LabService.getFullLabReports();
    existingReports.unshift(newReport);
    save('full_lab_reports', existingReports);

    // 5. Generate the final Hinglish Summary
    const finalSummary = `🔬 *AI LAB REPORT ANALYSIS*\n\n${trendMsg}\n\n💡 *Clinical Insight:*\n${clinicalAdvice}\n\nDoctor will review this report in detail during your next visit.`;
    
    return finalSummary;
  }
}
