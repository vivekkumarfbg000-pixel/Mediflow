import React, { useState, useRef } from 'react';
import { api } from '../../services/api';

/**
 * InvoiceGenerator – Compounder tool to:
 *   1. Upload a scanned paper invoice (image/PDF)
 *   2. Run OCR via FastAPI to extract text
 *   3. Preview extracted data
 *   4. Generate a printable HTML invoice that opens in a new tab
 *
 * Uses the `ocrScan` method from `MediflowApiService` which gracefully
 * falls back to mock data when the FastAPI backend is offline.
 */

interface ExtractedData {
  raw: string;
  structured: Record<string, string>;
}

const InvoiceGenerator: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string, durationMs = 3000) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), durationMs);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setExtracted(null);
    }
  };

  const handleScan = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) { showToast('Please select a file first.'); return; }
    setIsScanning(true);
    try {
      const result = await api.ocrScan(file);
      setExtracted({ raw: result.extracted_text, structured: result.structured_data });
      showToast('✅ OCR scan complete!');
    } catch {
      showToast('❌ OCR scan failed. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!extracted) { showToast('Please scan a file first.'); return; }
    setIsGenerating(true);
    try {
      // Build a printable HTML invoice in a new tab
      const rows = Object.entries(extracted.structured)
        .map(([k, v]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;color:#475569">${k}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a">${v}</td></tr>`)
        .join('');
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>VitalSync Invoice</title>
  <style>
    body { font-family: 'Inter', sans-serif; margin: 40px; color: #0f172a; }
    h1 { color: #106675; margin-bottom: 4px; }
    .meta { color: #94a3b8; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 12px; background: #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
    .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>
  <h1>🏥 VitalSync Clinic</h1>
  <p class="meta">Invoice generated on ${new Date().toLocaleString('en-IN')} | Powered by VitalSync AI OCR</p>
  <table>
    <thead><tr><th>Field</th><th>Value</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="raw-ocr" style="margin-top:24px;padding:12px;background:#f8fafc;border-radius:8px;font-size:12px;color:#64748b;white-space:pre-wrap">${extracted.raw}</div>
  <div class="footer">This is a computer-generated invoice. For queries contact VitalSync Support.</div>
</body>
</html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      showToast('📄 Invoice opened in new tab. Use Ctrl+P to print / save as PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="glass-panel p-6 space-y-6 relative">
      {/* Toast */}
      {toastMsg && (
        <div className="absolute top-4 right-4 bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-fade-in z-50">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-clinical-50">AI Invoice Generator</h2>
          <p className="text-xs text-clinical-300">Upload scanned invoice → OCR → Generate printable PDF</p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className="glass-panel-inner border-2 border-dashed border-primary/20 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-all duration-200"
        onClick={() => fileInputRef.current?.click()}
      >
        <svg className="w-10 h-10 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-clinical-300">
          {fileName ? (
            <span className="text-primary font-medium">{fileName}</span>
          ) : (
            <><span className="text-primary font-medium">Click to upload</span> or drag &amp; drop</>
          )}
        </p>
        <p className="text-xs text-clinical-400">Supports: JPG, PNG, PDF (max 10 MB)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <button
          className="btn-primary flex-1"
          onClick={handleScan}
          disabled={isScanning || !fileName}
        >
          {isScanning ? (
            <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Scanning…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>Run OCR Scan</>
          )}
        </button>
        <button
          className="btn-secondary flex-1"
          onClick={handleGenerateInvoice}
          disabled={isGenerating || !extracted}
        >
          {isGenerating ? (
            <><span className="animate-spin inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2" />Generating…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>Generate Invoice PDF</>
          )}
        </button>
      </div>

      {/* Extracted Data Preview */}
      {extracted && (
        <div className="glass-panel-inner p-4 space-y-3 animate-fade-in">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest">Extracted Data</p>
          <div className="space-y-1">
            {Object.entries(extracted.structured).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-clinical-300">{k}</span>
                <span className="font-medium text-clinical-50">{v}</span>
              </div>
            ))}
          </div>
          <details className="mt-2">
            <summary className="text-xs text-clinical-400 cursor-pointer">Raw OCR text</summary>
            <pre className="mt-2 text-xs text-clinical-300 whitespace-pre-wrap">{extracted.raw}</pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default InvoiceGenerator;
