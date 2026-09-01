// =============================================================================
// Mediflow — Centralized Indian Standard Time (IST, UTC+5:30) Date Engine
// Enforces Directive 95: 100% reliable 24/7 date evaluation across midnight (00:00 - 05:30 AM).
// =============================================================================

/**
 * Returns YYYY-MM-DD date string in Indian Standard Time (IST, UTC+5:30).
 * Prevents UTC serverless date shifts between 12:00 AM and 05:30 AM IST.
 */
export function getIstDateString(date?: Date | string | null): string {
  if (!date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return typeof date === 'string' ? date.split('T')[0] : '';
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

/**
 * Returns human-readable date display string in Indian Standard Time (IST, UTC+5:30).
 * Example: "Sat, 22 Aug" or "Saturday, 22 August"
 */
export function getIstDateDisplay(date: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };
  return new Intl.DateTimeFormat('en-IN', options).format(date);
}

/**
 * Returns Indian Standard Time Date object with UTC+5:30 offset
 */
export function getIstNow(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (330 * 60000));
}

/**
 * Returns current hour (0-23) in Indian Standard Time (IST, UTC+5:30).
 */
export function getIstHour(date: Date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false
  }).format(date);
  return parseInt(hourStr, 10);
}

/**
 * Returns YYYY-MM-DD date string for today + offsetDays in Indian Standard Time.
 */
export function getIstOffsetDateString(offsetDays: number, baseDate: Date = new Date()): string {
  const target = new Date(baseDate.getTime() + (offsetDays * 24 * 60 * 60 * 1000));
  return getIstDateString(target);
}

/**
 * Returns human-readable date display for today + offsetDays in Indian Standard Time.
 */
export function getIstOffsetDateDisplay(offsetDays: number, baseDate: Date = new Date()): string {
  const target = new Date(baseDate.getTime() + (offsetDays * 24 * 60 * 60 * 1000));
  return getIstDateDisplay(target);
}

/**
 * Safely resolves the appointment date (YYYY-MM-DD) in Indian Standard Time (IST).
 * Prioritizes direct date fields (date, virtual_date, virtualDate, appointment_date, appointmentDate),
 * then converts ISO appointment_time / appointmentTime to IST.
 * Only falls back to created_at if no appointment date is specified.
 */
export function getEffectiveAppointmentDate(appt: any): string {
  if (!appt) return getIstDateString();
  
  const directDate = appt.date || appt.virtual_date || appt.virtualDate || appt.appointment_date || appt.appointmentDate;
  if (directDate) {
    if (typeof directDate === 'string') {
      const trimmed = directDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.substring(0, 10);
      }
      try {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          return getIstDateString(parsed);
        }
      } catch (_e) { /* ignore */ }
    } else if (directDate instanceof Date && !isNaN(directDate.getTime())) {
      return getIstDateString(directDate);
    }
  }

  const apptTime = appt.appointment_time || appt.appointmentTime;
  if (apptTime) {
    try {
      const parsed = new Date(apptTime);
      if (!isNaN(parsed.getTime())) {
        return getIstDateString(parsed);
      }
    } catch (_e) { /* ignore */ }
  }

  const creationTime = appt.created_at || appt.createdAt;
  if (creationTime) {
    try {
      const parsed = new Date(creationTime);
      if (!isNaN(parsed.getTime())) {
        return getIstDateString(parsed);
      }
    } catch (_e) { /* ignore */ }
  }

  return getIstDateString();
}
