// ─── OPHTHALMIC / EYE CARE TYPE DEFINITIONS ─────────────────────────────────

export interface EyeRefraction {
  sph: string;   // Sphere power e.g. "-1.25", "+0.50"
  cyl: string;   // Cylinder power e.g. "-0.50"
  axis: string;  // Axis in degrees (0-180) e.g. "90"
  add: string;   // Addition for presbyopia e.g. "+1.00"
}

export interface RefractionRx {
  od: EyeRefraction;     // Right eye (Oculus Dexter)
  os: EyeRefraction;     // Left eye (Oculus Sinister)
  pd: string;            // Pupil Distance (mm)
  lensType: 'Single Vision' | 'Bifocal' | 'Progressive' | 'Contact Lens';
  notes: string;         // e.g. "Anti-glare coating recommended"
}

export interface EyeVitals {
  visualAcuityOD: string;       // e.g. "6/6"
  visualAcuityOS: string;       // e.g. "6/12"
  visualAcuityAidedOD?: string; // With spectacles
  visualAcuityAidedOS?: string;
  iop: string;                  // Intraocular Pressure (mmHg)
  recordedAt: string;
}

// Default empty refraction for form initialization
export const EMPTY_REFRACTION_RX: RefractionRx = {
  od: { sph: '', cyl: '', axis: '', add: '' },
  os: { sph: '', cyl: '', axis: '', add: '' },
  pd: '',
  lensType: 'Single Vision',
  notes: ''
};

// Clinical delimiter tags for serializing refraction JSON inside clinicalNotes
export const REFRACTION_START_TAG = '---REFRACTION_RX_START---';
export const REFRACTION_END_TAG = '---REFRACTION_RX_END---';

// Serialize refraction to embeddable clinicalNotes block
export function serializeRefractionRx(rx: RefractionRx): string {
  return `\n${REFRACTION_START_TAG}\n${JSON.stringify(rx)}\n${REFRACTION_END_TAG}\n`;
}

// Parse refraction from clinicalNotes string
export function parseRefractionRx(notes: string): RefractionRx | null {
  const startIdx = notes.indexOf(REFRACTION_START_TAG);
  const endIdx = notes.indexOf(REFRACTION_END_TAG);
  if (startIdx === -1 || endIdx === -1) return null;
  try {
    const jsonStr = notes.substring(startIdx + REFRACTION_START_TAG.length, endIdx).trim();
    return JSON.parse(jsonStr) as RefractionRx;
  } catch {
    return null;
  }
}

// Format refraction as a clean WhatsApp Spectacle Card text
export function formatSpectacleCard(rx: RefractionRx, patientName: string): string {
  let card = `👓 *Digital Spectacle Prescription* 👓\n\n`;
  card += `Patient: *${patientName}*\n\n`;
  card += `*Right Eye (OD):*\n`;
  card += `  SPH: ${rx.od.sph || 'Plano'} | CYL: ${rx.od.cyl || '—'} | Axis: ${rx.od.axis || '—'}°`;
  if (rx.od.add) card += ` | ADD: ${rx.od.add}`;
  card += `\n\n`;
  card += `*Left Eye (OS):*\n`;
  card += `  SPH: ${rx.os.sph || 'Plano'} | CYL: ${rx.os.cyl || '—'} | Axis: ${rx.os.axis || '—'}°`;
  if (rx.os.add) card += ` | ADD: ${rx.os.add}`;
  card += `\n\n`;
  if (rx.pd) card += `*PD (Pupil Distance):* ${rx.pd} mm\n`;
  card += `*Lens Type:* ${rx.lensType}\n`;
  if (rx.notes) card += `*Notes:* ${rx.notes}\n`;
  card += `\n📍 Collect at your nearest partner Optical Shop.\n`;
  card += `💳 Pay securely via UPI link below.`;
  return card;
}

// Visual acuity options for compounder dropdown
export const VISUAL_ACUITY_OPTIONS = [
  '6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60',
  'CF (Counting Fingers)', 'HM (Hand Movement)', 'PL (Perception of Light)', 'NPL (No PL)'
];

// Ophthalmic medication frequency presets
export const OPHTHALMIC_FREQUENCIES = [
  '1 drop 4 times daily',
  '1 drop 3 times daily',
  '1 drop twice daily',
  '1 drop once daily',
  '1 drop every 2 hours',
  '1 drop every 4 hours',
  'Apply ointment at bedtime',
  'Apply ointment twice daily',
  'As directed'
];

export const OPHTHALMIC_EYE_CARE_COPY = {
  analysisTitle: 'Ophthalmology Clinical Analysis',
  timelineTitle: 'Ophthalmology Patient Timeline',
  timelineSubtitle: 'Click a report to open a dedicated eye-care analysis',
  odLabel: 'Visual Acuity (OD)',
  osLabel: 'Visual Acuity (OS)',
  iopLabel: 'Intraocular Pressure (IOP)',
  odRefRange: '6/6 (Unaided)',
  osRefRange: '6/6 (Unaided)',
  iopRefRange: '10 - 21 mmHg',
  odFallback: '6/6',
  osFallback: '6/9',
  iopFallback: 16,
} as const;

export function getAcuityRank(val: string) {
  if (!val) return 0;
  const clean = val.toUpperCase().trim();
  if (clean.includes('6/60')) return 7;
  if (clean.includes('6/36')) return 6;
  if (clean.includes('6/24')) return 5;
  if (clean.includes('6/18')) return 4;
  if (clean.includes('6/12')) return 3;
  if (clean.includes('6/9')) return 2;
  if (clean.includes('6/6')) return 1;
  if (clean.includes('CF') || clean.includes('COUNTING')) return 8;
  if (clean.includes('HM') || clean.includes('HAND')) return 9;
  if (clean.includes('PL')) return 10;
  if (clean.includes('NPL')) return 11;
  return 0;
}
