import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { RefractionRx } from '../types/ophthalmic';

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

  drawText(`Invoice #: ${data.invoiceId}`, height - 50);
  drawText(`Patient: ${data.patientName}`, height - 80);
  drawText(`Amount: ₹${data.amount.toFixed(2)}`, height - 110);
  drawText(`Date: ${data.date}`, height - 140);

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

  page.drawText('PATNA EYE CLINIC & DISPENSING PARTNER', {
    x: 30,
    y: height - 54,
    size: 8,
    font: font,
    color: rgb(0.8, 0.9, 1),
  });

  // Patient Meta Details
  const drawMetaText = (label: string, value: string, x: number, y: number) => {
    page.drawText(label, { x, y, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(value, { x: x + 70, y, size: 9, font: font, color: rgb(0.1, 0.1, 0.1) });
  };

  drawMetaText('Patient Name:', data.patientName, 30, height - 90);
  drawMetaText('Invoice ID:', data.invoiceId, 30, height - 105);
  drawMetaText('Lens Type:', data.refractionRx.lensType, 260, height - 90);
  drawMetaText('Exam Date:', data.date, 260, height - 105);

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
  const odVals = ['OD (Right)', data.refractionRx.od.sph || 'Plano', data.refractionRx.od.cyl || '0.00', data.refractionRx.od.axis || '—', data.refractionRx.od.add || '—'];
  odVals.forEach((val, i) => {
    const offsetMap = [10, 90, 180, 270, 360];
    page.drawText(val, {
      x: startX + offsetMap[i],
      y: tableTop - rowHeight - 16,
      size: 9,
      font: i === 0 ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
  });

  // Row 2: Left Eye (OS)
  const osVals = ['OS (Left)', data.refractionRx.os.sph || 'Plano', data.refractionRx.os.cyl || '0.00', data.refractionRx.os.axis || '—', data.refractionRx.os.add || '—'];
  osVals.forEach((val, i) => {
    const offsetMap = [10, 90, 180, 270, 360];
    page.drawText(val, {
      x: startX + offsetMap[i],
      y: tableTop - (2 * rowHeight) - 16,
      size: 9,
      font: i === 0 ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
  });

  // PD details and notes
  let bottomY = tableTop - (3 * rowHeight) - 20;
  if (data.refractionRx.pd) {
    page.drawText(`Pupil Distance (PD): ${data.refractionRx.pd} mm`, {
      x: 30,
      y: bottomY,
      size: 9,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    bottomY -= 15;
  }

  if (data.refractionRx.notes) {
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
