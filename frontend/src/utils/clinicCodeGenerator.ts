/**
 * VitalSync Personalized Clinic Code Architecture
 * Format: VS + [FirstLetterOfDoctor] + [2-Digit Sequence Number] + [LastLetterOfDoctor]
 * Example: 3rd Doctor Dr. Suman => VS-S03N
 */
export function generateVitalSyncClinicCode(doctorName: string, sequenceNumber: number = 1): string {
  // 1. Sanitize doctor name: Strip prefixes like "Dr.", "Dr ", "Doctor ", "Prof."
  const cleanName = (doctorName || '')
    .trim()
    .replace(/^(dr\.?|doctor|prof\.?)\s+/i, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();

  // 2. Extract First and Last characters with safe fallbacks
  const firstChar = cleanName.length > 0 ? cleanName.charAt(0) : 'D';
  const lastChar = cleanName.length > 1 ? cleanName.charAt(cleanName.length - 1) : (cleanName.charAt(0) || 'R');

  // 3. Format Sequence number (2 digits for 1-99, full number for 100+)
  const seqStr = String(Math.max(1, sequenceNumber)).padStart(2, '0');

  return `VS-${firstChar}${seqStr}${lastChar}`;
}
