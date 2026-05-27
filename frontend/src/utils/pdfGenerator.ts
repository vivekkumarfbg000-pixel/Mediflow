import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
  page.drawText('Thank you for choosing Mediflow!', {
    x: 30,
    y: 30,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
