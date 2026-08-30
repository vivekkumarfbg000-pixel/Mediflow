import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { RefractionRx } from '../types/ophthalmic';
import { getIstDateDisplay } from './dateUtils';

/**
 * Generates a simple PDF invoice with provided data.
 * Returns a Uint8Array representing the PDF bytes.
 */
export async function generatePdfInvoice(data: {
  invoiceId: string;
  patientName: string;
  amount: number;
  date: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 600]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();

  const fontSize = 12;
  const textColor = rgb(0, 0, 0);

  const drawText = (text: string, y: number) => {
    page.drawText(text, {
      x: 30,
      y,
      size: fontSize,
      font,
      color: textColor,
    });
  };

  drawText(`Invoice #: ${data.invoiceId || 'N/A'}`, height - 50);
  drawText(`Patient: ${data.patientName || 'Patient'}`, height - 80);
  drawText(`Amount: ₹${(data.amount || 0).toFixed(2)}`, height - 110);
  drawText(`Date: ${data.date || getIstDateDisplay()}`, height - 140);

  // Footer
  page.drawText('Thank you for choosing VitalSync!', {
    x: 30,
    y: 30,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Generates a premium compact visual PDF prescription card for Chashma Ghar grinding opticians.
 * Returns a Uint8Array representing the PDF bytes.
 */
export async function generateSpectaclePdfCard(data: {
  invoiceId: string;
  patientName: string;
  refractionRx: RefractionRx;
  date: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([500, 350]); // premium compact card size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  // Background and border
  page.drawRectangle({
    x: 10,
    y: 10,
    width: width - 20,
    height: height - 20,
    borderColor: rgb(0.2, 0.4, 0.8),
    borderWidth: 2,
    color: rgb(0.97, 0.98, 1.0), // elegant off-white clinical background
  });

  // Header Title banner
  page.drawRectangle({
    x: 10,
    y: height - 60,
    width: width - 20,
    height: 50,
    color: rgb(0.2, 0.4, 0.8), // Medical Blue banner
  });

  page.drawText('VITALSYNC CONNECTED OPTICALS', {
    x: 30,
    y: height - 42,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(((data as any).clinicName || 'VITALSYNC CLINIC PARTNER').toUpperCase(), {
    x: 30,
    y: height - 54,
    size: 8,
    font: font,
    color: rgb(0.8, 0.9, 1),
  });

  // Patient Meta Details
  const drawMetaText = (label: string, value: string, x: number, y: number) => {
    page.drawText(label || '', { x, y, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(value || '—', { x: x + 70, y, size: 9, font: font, color: rgb(0.1, 0.1, 0.1) });
  };

  drawMetaText('Patient Name:', data.patientName || 'Patient', 30, height - 90);
  drawMetaText('Invoice ID:', data.invoiceId || 'N/A', 30, height - 105);
  drawMetaText('Lens Type:', data.refractionRx?.lensType || 'Standard Single Vision', 260, height - 90);
  drawMetaText('Exam Date:', data.date || getIstDateDisplay(), 260, height - 105);

  // Draw Grid Table for Refraction Matrix
  const tableTop = height - 120;
  const rowHeight = 25;
  const startX = 30;

  // Table Header
  const headers = ['EYE', 'SPHERE (SPH)', 'CYLINDER (CYL)', 'AXIS', 'ADD'];
  page.drawRectangle({
    x: startX,
    y: tableTop - rowHeight,
    width: 440,
    height: rowHeight,
    color: rgb(0.9, 0.93, 0.98),
  });

  // Draw table grid lines
  for (let i = 0; i <= 3; i++) {
    const y = tableTop - (i * rowHeight);
    page.drawLine({
      start: { x: startX, y: y },
      end: { x: startX + 440, y: y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  const verticalLines = [0, 80, 170, 260, 350, 440];
  for (const offset of verticalLines) {
    page.drawLine({
      start: { x: startX + offset, y: tableTop },
      end: { x: startX + offset, y: tableTop - (3 * rowHeight) },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  // Draw header text
  headers.forEach((h, i) => {
    const offsetMap = [10, 90, 180, 270, 360];
    page.drawText(h, {
      x: startX + offsetMap[i],
      y: tableTop - 16,
      size: 8,
      font: fontBold,
      color: rgb(0.2, 0.3, 0.5),
    });
  });

  // Row 1: Right Eye (OD)
  const odVals = [
    'OD (Right)',
    data.refractionRx?.od?.sph || 'Plano',
    data.refractionRx?.od?.cyl || '0.00',
    data.refractionRx?.od?.axis || '—',
    data.refractionRx?.od?.add || '—'
  ];
  odVals.forEach((val, i) => {
    const offsetMap = [10, 90, 180, 270, 360];
    page.drawText(String(val || '—'), {
      x: startX + offsetMap[i],
      y: tableTop - rowHeight - 16,
      size: 9,
      font: i === 0 ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
  });

  // Row 2: Left Eye (OS)
  const osVals = [
    'OS (Left)',
    data.refractionRx?.os?.sph || 'Plano',
    data.refractionRx?.os?.cyl || '0.00',
    data.refractionRx?.os?.axis || '—',
    data.refractionRx?.os?.add || '—'
  ];
  osVals.forEach((val, i) => {
    const offsetMap = [10, 90, 180, 270, 360];
    page.drawText(String(val || '—'), {
      x: startX + offsetMap[i],
      y: tableTop - (2 * rowHeight) - 16,
      size: 9,
      font: i === 0 ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
  });

  // PD details and notes
  let bottomY = tableTop - (3 * rowHeight) - 20;
  if (data.refractionRx?.pd) {
    page.drawText(`Pupil Distance (PD): ${data.refractionRx.pd} mm`, {
      x: 30,
      y: bottomY,
      size: 9,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    bottomY -= 15;
  }

  if (data.refractionRx?.notes) {
    page.drawText(`Clinical Notes: ${data.refractionRx.notes}`, {
      x: 30,
      y: bottomY,
      size: 9,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  // Footer branding
  page.drawText('Powered by VitalSync Connected Care Platform', {
    x: 30,
    y: 25,
    size: 7,
    font: font,
    color: rgb(0.6, 0.6, 0.6),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Generates an official pathology lab diagnostic report PDF.
 * Returns a Uint8Array representing the PDF bytes.
 */
export async function generateLabReportPdf(data: {
  reportId?: string;
  patientName: string;
  patientPhone?: string;
  age?: number | string;
  gender?: string;
  testName: string;
  loincCode?: string;
  biomarkers: Record<string, any>;
  hinglishSummary?: string;
  doctorName?: string;
  clinicName?: string;
  date?: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // Standard A4 (595 x 842 pt)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  // Top header banner
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: rgb(0.08, 0.18, 0.36), // Deep Medical Navy
  });

  // Clinic Title
  page.drawText(data.clinicName || 'VITALSYNC PATHOLOGY LAB & DIAGNOSTICS', {
    x: 40,
    y: height - 40,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('NABL Aligned • LOINC Standardized Diagnostic Network', {
    x: 40,
    y: height - 58,
    size: 9,
    font,
    color: rgb(0.8, 0.88, 1),
  });

  // Patient Demographics Box
  page.drawRectangle({
    x: 35,
    y: height - 190,
    width: width - 70,
    height: 85,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.85, 0.88, 0.93),
    borderWidth: 1,
  });

  // Patient info columns
  page.drawText(`Patient: ${data.patientName || 'N/A'}`, { x: 50, y: height - 125, size: 10, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  page.drawText(`Age/Gender: ${data.age || '—'} Y / ${data.gender || '—'}`, { x: 50, y: height - 145, size: 9, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawText(`Contact: ${data.patientPhone || '—'}`, { x: 50, y: height - 165, size: 9, font, color: rgb(0.3, 0.35, 0.45) });

  page.drawText(`Report ID: ${(data.reportId || 'REP-' + Date.now().toString().slice(-6)).toUpperCase()}`, { x: 340, y: height - 125, size: 9, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  page.drawText(`Date: ${data.date || getIstDateDisplay()}`, { x: 340, y: height - 145, size: 9, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawText(`Ref. Doctor: ${data.doctorName || 'Attending Physician'}`, { x: 340, y: height - 165, size: 9, font, color: rgb(0.3, 0.35, 0.45) });

  // Test Title Banner
  page.drawRectangle({
    x: 35,
    y: height - 230,
    width: width - 70,
    height: 28,
    color: rgb(0.91, 0.94, 0.99),
  });

  page.drawText(`INVESTIGATION: ${(data.testName || 'PATHOLOGY TEST').toUpperCase()}${data.loincCode ? ` (LOINC: ${data.loincCode})` : ''}`, {
    x: 45,
    y: height - 218,
    size: 10,
    font: fontBold,
    color: rgb(0.12, 0.25, 0.55),
  });

  // Table Header
  const tableTop = height - 250;
  page.drawRectangle({
    x: 35,
    y: tableTop - 20,
    width: width - 70,
    height: 20,
    color: rgb(0.2, 0.3, 0.45),
  });

  page.drawText('TEST PARAMETER', { x: 45, y: tableTop - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('RESULT VALUE', { x: 230, y: tableTop - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('REFERENCE RANGE', { x: 350, y: tableTop - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('STATUS', { x: 480, y: tableTop - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });

  // Biomarker rows
  let rowY = tableTop - 40;
  const biomarkers = data.biomarkers || {};
  const entries = Object.entries(biomarkers).filter(([k]) => !k.endsWith('_unit') && k !== 'unit' && k !== 'testCode' && k !== 'timestamp' && k !== 'patientId' && k !== 'testName');

  if (entries.length === 0) {
    page.drawText('Standard laboratory panel completed. All parameters within normal baseline limits.', {
      x: 45,
      y: rowY,
      size: 9,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    rowY -= 25;
  } else {
    entries.forEach(([key, val], idx) => {
      const unit = biomarkers[`${key}_unit`] || biomarkers.unit || '';
      const valNum = parseFloat(String(val));
      let refRange = 'Normal Reference';
      let statusText = 'NORMAL';
      let isAbnormal = false;

      const kLower = key.toLowerCase();
      if (kLower.includes('hba1c')) {
        refRange = '4.0 - 5.6 %';
        if (valNum > 6.5) { statusText = 'HIGH (Diabetic)'; isAbnormal = true; }
        else if (valNum >= 5.7) { statusText = 'BORDERLINE'; isAbnormal = true; }
      } else if (kLower.includes('creatinine')) {
        refRange = '0.6 - 1.2 mg/dL';
        if (valNum > 1.3) { statusText = 'ELEVATED'; isAbnormal = true; }
      } else if (kLower.includes('hemoglobin') || kLower === 'hb') {
        refRange = '12.0 - 16.0 g/dL';
        if (valNum < 11.0) { statusText = 'LOW (Anemia)'; isAbnormal = true; }
      } else if (kLower.includes('glucose') || kLower.includes('sugar') || kLower.includes('eag')) {
        refRange = '70 - 140 mg/dL';
        if (valNum > 140) { statusText = 'HIGH'; isAbnormal = true; }
      } else if (kLower.includes('egfr')) {
        refRange = '> 90 mL/min';
        if (valNum < 60) { statusText = 'REDUCED'; isAbnormal = true; }
      }

      // Alternating row background
      if (idx % 2 === 1) {
        page.drawRectangle({
          x: 35,
          y: rowY - 6,
          width: width - 70,
          height: 18,
          color: rgb(0.97, 0.98, 0.99),
        });
      }

      // Key name
      page.drawText(key.replace(/([A-Z])/g, ' $1').trim(), { x: 45, y: rowY, size: 9, font: fontBold, color: rgb(0.15, 0.2, 0.3) });
      // Value & Unit
      page.drawText(`${val} ${unit}`.trim(), { x: 230, y: rowY, size: 9, font: fontBold, color: isAbnormal ? rgb(0.75, 0.1, 0.1) : rgb(0.1, 0.5, 0.2) });
      // Ref range
      page.drawText(refRange, { x: 350, y: rowY, size: 9, font, color: rgb(0.4, 0.45, 0.5) });
      // Status
      page.drawText(statusText, { x: 480, y: rowY, size: 8, font: fontBold, color: isAbnormal ? rgb(0.75, 0.1, 0.1) : rgb(0.1, 0.5, 0.2) });

      rowY -= 20;
    });
  }

  // Hinglish Patient Guidance Section Box
  rowY -= 15;
  page.drawRectangle({
    x: 35,
    y: rowY - 75,
    width: width - 70,
    height: 80,
    color: rgb(0.98, 0.99, 0.95),
    borderColor: rgb(0.85, 0.9, 0.7),
    borderWidth: 1,
  });

  page.drawText('PATIENT REPORT GUIDANCE & AI ANALYSIS (Hinglish):', {
    x: 45,
    y: rowY - 14,
    size: 8,
    font: fontBold,
    color: rgb(0.2, 0.45, 0.15),
  });

  const summary = data.hinglishSummary || 'Aapki lab report generate ho chuki hai. Doctor se milkar dosage aur dietary guidance zaroor lein.';
  const line1 = summary.substring(0, 85);
  const line2 = summary.substring(85, 170);

  page.drawText(line1, { x: 45, y: rowY - 32, size: 8.5, font, color: rgb(0.25, 0.3, 0.25) });
  if (line2) {
    page.drawText(line2, { x: 45, y: rowY - 46, size: 8.5, font, color: rgb(0.25, 0.3, 0.25) });
  }

  page.drawText('2-Touchpoint Care: Same-day evening clinic review or virtual video consult available on WhatsApp.', {
    x: 45,
    y: rowY - 64,
    size: 8,
    font: fontBold,
    color: rgb(0.2, 0.45, 0.15),
  });

  // Footer & Signatures
  page.drawRectangle({
    x: 35,
    y: 70,
    width: width - 70,
    height: 1,
    color: rgb(0.85, 0.88, 0.92),
  });

  page.drawText('Verified by Lab Technologist & Pathologist', { x: 45, y: 50, size: 8, font, color: rgb(0.5, 0.55, 0.6) });
  page.drawText('Attending Physician Final Review', { x: 380, y: 50, size: 8, font, color: rgb(0.5, 0.55, 0.6) });
  page.drawText('VitalSync Connected Outpatient Network • Verified Digital Health Record', { x: 45, y: 25, size: 7, font, color: rgb(0.6, 0.65, 0.7) });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Generates an official Doctor e-Prescription PDF document.
 * Returns a Uint8Array representing the PDF bytes.
 */
export async function generatePrescriptionPdf(data: {
  prescriptionId?: string;
  patientName: string;
  patientPhone?: string;
  age?: number | string;
  gender?: string;
  tokenNumber?: string;
  abhaId?: string;
  doctorName?: string;
  clinicName?: string;
  date?: string;
  notes?: string;
  medications: Array<{ medicineName: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }>;
  diagnosticTests?: Array<{ name: string; loincCode?: string }>;
  refractionRx?: RefractionRx;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // Standard A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  // Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: rgb(0.18, 0.25, 0.55), // Indigo / Navy
  });

  page.drawText(data.clinicName || 'VITALSYNC SMART CLINIC NETWORK', {
    x: 40,
    y: height - 42,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Dr. ${data.doctorName || 'Practitioner'} • Connected OPD Consultation`, {
    x: 40,
    y: height - 60,
    size: 9,
    font,
    color: rgb(0.85, 0.9, 1),
  });

  // Patient Info Box
  page.drawRectangle({
    x: 35,
    y: height - 180,
    width: width - 70,
    height: 75,
    color: rgb(0.97, 0.98, 1.0),
    borderColor: rgb(0.85, 0.88, 0.95),
    borderWidth: 1,
  });

  page.drawText(`Patient: ${data.patientName || 'Patient'}`, { x: 50, y: height - 120, size: 10, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  page.drawText(`Age / Gender: ${data.age || '—'} Y / ${data.gender || '—'}`, { x: 50, y: height - 140, size: 9, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawText(`Contact: ${data.patientPhone || '—'}`, { x: 50, y: height - 160, size: 9, font, color: rgb(0.3, 0.35, 0.45) });

  page.drawText(`Token: #${data.tokenNumber || 'T-01'}`, { x: 340, y: height - 120, size: 10, font: fontBold, color: rgb(0.18, 0.25, 0.55) });
  page.drawText(`Date: ${data.date || getIstDateDisplay()}`, { x: 340, y: height - 140, size: 9, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawText(`ABHA ID: ${data.abhaId || 'N/A'}`, { x: 340, y: height - 160, size: 9, font, color: rgb(0.3, 0.35, 0.45) });

  let curY = height - 205;

  // Prescribed Medications Table
  if (data.medications && data.medications.length > 0) {
    page.drawRectangle({
      x: 35,
      y: curY - 20,
      width: width - 70,
      height: 20,
      color: rgb(0.18, 0.25, 0.55),
    });

    page.drawText('PRESCRIBED MEDICINE (Rx)', { x: 45, y: curY - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText('DOSAGE', { x: 250, y: curY - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText('FREQUENCY', { x: 350, y: curY - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText('DURATION', { x: 450, y: curY - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });

    curY -= 35;
    data.medications.forEach((med, idx) => {
      if (idx % 2 === 1) {
        page.drawRectangle({
          x: 35,
          y: curY - 4,
          width: width - 70,
          height: 18,
          color: rgb(0.97, 0.98, 0.99),
        });
      }
      page.drawText(med.medicineName || 'Medicine', { x: 45, y: curY, size: 9, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
      page.drawText(med.dosage || '—', { x: 250, y: curY, size: 9, font, color: rgb(0.2, 0.25, 0.35) });
      page.drawText(med.frequency || '1-0-1', { x: 350, y: curY, size: 9, font, color: rgb(0.2, 0.25, 0.35) });
      page.drawText(med.duration || '5 Days', { x: 450, y: curY, size: 9, font, color: rgb(0.2, 0.25, 0.35) });
      curY -= 20;
    });
  }

  // Clinical Directions / Notes
  if (data.notes) {
    curY -= 15;
    page.drawText('CLINICAL ADVICE & DIRECTIONS:', { x: 45, y: curY, size: 8.5, font: fontBold, color: rgb(0.18, 0.25, 0.55) });
    curY -= 15;
    const cleanNotes = data.notes.slice(0, 180);
    page.drawText(cleanNotes, { x: 45, y: curY, size: 8.5, font, color: rgb(0.25, 0.3, 0.35) });
    curY -= 20;
  }

  // Footer & Signatures
  page.drawRectangle({
    x: 35,
    y: 70,
    width: width - 70,
    height: 1,
    color: rgb(0.85, 0.88, 0.92),
  });

  page.drawText('Digital Signature: Valid Electronic Prescription', { x: 45, y: 50, size: 8, font, color: rgb(0.5, 0.55, 0.6) });
  page.drawText(`Dr. ${data.doctorName || 'Physician'} (Registered Medical Practitioner)`, { x: 320, y: 50, size: 8, font, color: rgb(0.5, 0.55, 0.6) });
  page.drawText('VitalSync Connected Outpatient Network • Verified Digital Health Record', { x: 45, y: 25, size: 7, font, color: rgb(0.6, 0.65, 0.7) });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
