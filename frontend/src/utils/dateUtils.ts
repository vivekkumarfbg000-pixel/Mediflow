// =============================================================================
// Mediflow — Centralized Indian Standard Time (IST, UTC+5:30) Date Engine
// Enforces Directive 95: 100% reliable 24/7 date evaluation across midnight (00:00 - 05:30 AM).
// =============================================================================

/**
 * Returns YYYY-MM-DD date string in Indian Standard Time (IST, UTC+5:30).
 * Prevents UTC serverless date shifts between 12:00 AM and 05:30 AM IST.
 */
export function getIstDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
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
  return new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
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
